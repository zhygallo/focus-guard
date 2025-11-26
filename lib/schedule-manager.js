/**
 * FocusGuard - Schedule Manager
 * Handles scheduled blocking logic
 */

import { ALARMS, DEFAULTS, BLOCK_REASONS } from './constants.js'
import { ErrorCodes, FocusGuardError, successResponse } from './errors.js'
import { validateSchedule } from './validation.js'
import { getCurrentTime, getCurrentDay, minutesUntilEndTime, isInTimeWindow } from './time-utils.js'
import * as storage from './storage.js'
import { blockManager as defaultBlockManager } from './block-manager.js'

/**
 * Create a schedule manager instance
 * @param {Object} deps - Dependencies (for testing, can inject mocks)
 * @param {Object} [deps.storage] - Storage module
 * @param {Object} [deps.blockManager] - Block manager instance
 * @returns {Object} - Schedule manager API
 */
export function createScheduleManager(deps = {}) {
  const store = deps.storage || storage
  const blockMgr = deps.blockManager || defaultBlockManager

  return {
    /**
     * Add a new schedule
     * @param {Object} schedule - Schedule configuration
     * @param {string[]} schedule.domains - Domains to block
     * @param {string} schedule.startTime - Start time (HH:MM)
     * @param {string} schedule.endTime - End time (HH:MM)
     * @param {number[]} schedule.days - Days of week (0-6, 0=Sunday)
     * @returns {Promise<Object>} - Response with schedule ID
     */
    async add(schedule) {
      // Validate schedule
      const result = validateSchedule(schedule)
      if (!result.valid) {
        throw new FocusGuardError(
          result.errors[0].code,
          result.errors[0].message
        )
      }

      const validSchedule = result.value

      // Generate ID
      const id = `sch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const newSchedule = {
        id,
        domains: validSchedule.domains,
        startTime: validSchedule.startTime,
        endTime: validSchedule.endTime,
        days: validSchedule.days,
        enabled: true,
        createdAt: Date.now()
      }

      // Add to storage
      await store.updateSchedules(schedules => {
        schedules.push(newSchedule)
        return schedules
      })

      // Ensure schedule checking alarm is set up
      this.setupAlarm()

      // Check if schedule should be active now
      await this.checkSingle(newSchedule)

      return successResponse({ id, schedule: newSchedule })
    },

    /**
     * Delete a schedule
     * @param {string} id - Schedule ID
     * @returns {Promise<Object>}
     */
    async delete(id) {
      let found = false

      await store.updateSchedules(schedules => {
        const index = schedules.findIndex(s => s.id === id)
        if (index !== -1) {
          schedules.splice(index, 1)
          found = true
        }
        return schedules
      })

      if (!found) {
        throw new FocusGuardError(ErrorCodes.INVALID_SCHEDULE, 'Schedule not found')
      }

      return successResponse({ id })
    },

    /**
     * Toggle schedule enabled/disabled
     * @param {string} id - Schedule ID
     * @param {boolean} enabled - New enabled state
     * @returns {Promise<Object>}
     */
    async toggle(id, enabled) {
      let found = false

      await store.updateSchedules(schedules => {
        const schedule = schedules.find(s => s.id === id)
        if (schedule) {
          schedule.enabled = !!enabled
          found = true
        }
        return schedules
      })

      if (!found) {
        throw new FocusGuardError(ErrorCodes.INVALID_SCHEDULE, 'Schedule not found')
      }

      return successResponse({ id, enabled: !!enabled })
    },

    /**
     * Update a schedule
     * @param {string} id - Schedule ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>}
     */
    async update(id, updates) {
      // Validate if full schedule provided
      if (updates.domains && updates.startTime && updates.endTime && updates.days) {
        const result = validateSchedule(updates)
        if (!result.valid) {
          throw new FocusGuardError(
            result.errors[0].code,
            result.errors[0].message
          )
        }
      }

      let found = false
      let updatedSchedule = null

      await store.updateSchedules(schedules => {
        const schedule = schedules.find(s => s.id === id)
        if (schedule) {
          Object.assign(schedule, updates)
          found = true
          updatedSchedule = { ...schedule }
        }
        return schedules
      })

      if (!found) {
        throw new FocusGuardError(ErrorCodes.INVALID_SCHEDULE, 'Schedule not found')
      }

      return successResponse({ id, schedule: updatedSchedule })
    },

    /**
     * Get all schedules
     * @returns {Promise<Array>}
     */
    async getAll() {
      return await store.getSchedules()
    },

    /**
     * Get a schedule by ID
     * @param {string} id - Schedule ID
     * @returns {Promise<Object|null>}
     */
    async get(id) {
      const schedules = await store.getSchedules()
      return schedules.find(s => s.id === id) || null
    },

    /**
     * Check a single schedule and activate if needed
     * @param {Object} schedule - Schedule object
     */
    async checkSingle(schedule) {
      if (!schedule.enabled) return

      const currentDay = getCurrentDay()
      if (!schedule.days.includes(currentDay)) return

      const inWindow = isInTimeWindow(schedule.startTime, schedule.endTime)
      if (!inWindow) return

      // Calculate remaining time in schedule window
      const remainingMinutes = minutesUntilEndTime(schedule.endTime)
      if (remainingMinutes <= 0) return

      // Activate blocks for each domain
      for (const domain of schedule.domains) {
        try {
          // Check if already blocked by this schedule or manually
          const blockInfo = await blockMgr.getBlockInfo(domain)

          // Only add if not already blocked, or if schedule would extend it
          if (!blockInfo || blockInfo.reason !== BLOCK_REASONS.SCHEDULE) {
            await blockMgr.add(domain, remainingMinutes, BLOCK_REASONS.SCHEDULE)
          }
        } catch (error) {
          // Log but don't fail the whole schedule check
          console.error(`Failed to activate schedule block for ${domain}:`, error)
        }
      }
    },

    /**
     * Check all schedules and activate as needed
     * Called periodically by Chrome alarm
     */
    async checkAll() {
      const schedules = await store.getSchedules()

      for (const schedule of schedules) {
        await this.checkSingle(schedule)
      }
    },

    /**
     * Set up Chrome alarm for periodic schedule checking
     */
    setupAlarm() {
      try {
        chrome.alarms.create(ALARMS.CHECK_SCHEDULES, {
          periodInMinutes: DEFAULTS.SCHEDULE_CHECK_INTERVAL_MINUTES
        })
      } catch (error) {
        console.error('Failed to create schedule check alarm:', error)
      }
    },

    /**
     * Get schedules that are currently active
     * @returns {Promise<Array>}
     */
    async getActive() {
      const schedules = await store.getSchedules()
      const currentDay = getCurrentDay()

      return schedules.filter(schedule => {
        if (!schedule.enabled) return false
        if (!schedule.days.includes(currentDay)) return false
        return isInTimeWindow(schedule.startTime, schedule.endTime)
      })
    }
  }
}

// Default singleton instance
export const scheduleManager = createScheduleManager()
