/**
 * FocusGuard - Unblock Manager
 * Handles delayed unblock logic with escalating delays
 */

import { DEFAULTS, ALARMS } from './constants.js'
import { ErrorCodes, FocusGuardError, successResponse } from './errors.js'
import { extractDomain } from './domain-utils.js'
import { getTodayKey } from './time-utils.js'
import * as storage from './storage.js'
import { blockManager as defaultBlockManager } from './block-manager.js'

/**
 * Create an unblock manager instance
 * @param {Object} deps - Dependencies (for testing, can inject mocks)
 * @param {Object} [deps.storage] - Storage module
 * @param {Object} [deps.blockManager] - Block manager instance
 * @returns {Object} - Unblock manager API
 */
export function createUnblockManager(deps = {}) {
  const store = deps.storage || storage
  const blockMgr = deps.blockManager || defaultBlockManager

  return {
    /**
     * Request to unblock a domain (starts delay timer)
     * @param {string} domain - Domain to unblock
     * @returns {Promise<Object>} - Response with wait time
     */
    async request(domain) {
      const cleanDomain = extractDomain(domain)
      if (!cleanDomain) {
        throw new FocusGuardError(ErrorCodes.INVALID_DOMAIN)
      }

      // Check if already has pending unblock
      const pending = await store.getPendingUnblocks()
      if (pending[cleanDomain]) {
        const remaining = Math.ceil((pending[cleanDomain].unlocksAt - Date.now()) / 1000)
        if (remaining > 0) {
          throw new FocusGuardError(
            ErrorCodes.UNBLOCK_PENDING,
            `Unblock already pending. ${Math.ceil(remaining / 60)} minutes remaining.`,
            { remainingTime: remaining }
          )
        }
      }

      // Get settings for delay configuration
      const settings = await store.getSettings()

      // Calculate attempt number for today (for escalation)
      const today = getTodayKey()
      const attemptKey = `${cleanDomain}_${today}`

      const dailyAttempts = await store.getDailyAttempts()
      const attemptNumber = (dailyAttempts[attemptKey] || 0) + 1

      // Update daily attempts
      await store.updateDailyAttempts(attempts => {
        attempts[attemptKey] = attemptNumber
        return attempts
      })

      // Calculate delay with escalation
      let delayMinutes = settings.unblockDelayBase || DEFAULTS.UNBLOCK_DELAY_BASE_MINUTES

      if (settings.unblockDelayEscalation && attemptNumber > 1) {
        delayMinutes = Math.min(
          DEFAULTS.UNBLOCK_DELAY_MAX_MINUTES,
          delayMinutes + (attemptNumber - 1) * DEFAULTS.UNBLOCK_DELAY_ESCALATION_MINUTES
        )
      }

      const waitTimeSeconds = delayMinutes * 60
      const unlocksAt = Date.now() + (waitTimeSeconds * 1000)

      // Create pending unblock
      await store.updatePendingUnblocks(pending => {
        pending[cleanDomain] = {
          requestedAt: Date.now(),
          unlocksAt,
          attemptNumber
        }
        return pending
      })

      // Set Chrome alarm to notify when ready
      try {
        chrome.alarms.create(`${ALARMS.UNBLOCK_PREFIX}${cleanDomain}`, {
          when: unlocksAt
        })
      } catch (error) {
        console.error('Failed to create unblock alarm:', error)
      }

      return successResponse({
        waitTime: waitTimeSeconds,
        unlocksAt,
        attemptNumber
      })
    },

    /**
     * Cancel a pending unblock request
     * @param {string} domain - Domain to cancel unblock for
     * @returns {Promise<Object>}
     */
    async cancel(domain) {
      const cleanDomain = extractDomain(domain)
      if (!cleanDomain) {
        throw new FocusGuardError(ErrorCodes.INVALID_DOMAIN)
      }

      let found = false
      await store.updatePendingUnblocks(pending => {
        if (pending[cleanDomain]) {
          delete pending[cleanDomain]
          found = true
        }
        return pending
      })

      // Clear the alarm
      try {
        chrome.alarms.clear(`${ALARMS.UNBLOCK_PREFIX}${cleanDomain}`)
      } catch (error) {
        console.error('Failed to clear unblock alarm:', error)
      }

      if (!found) {
        throw new FocusGuardError(ErrorCodes.NO_PENDING_UNBLOCK)
      }

      return successResponse({ domain: cleanDomain })
    },

    /**
     * Confirm unblock (after delay has passed)
     * @param {string} domain - Domain to unblock
     * @returns {Promise<Object>}
     */
    async confirm(domain) {
      const cleanDomain = extractDomain(domain)
      if (!cleanDomain) {
        throw new FocusGuardError(ErrorCodes.INVALID_DOMAIN)
      }

      const pending = await store.getPendingUnblocks()

      // Check if delay has passed
      if (pending[cleanDomain]) {
        const remaining = pending[cleanDomain].unlocksAt - Date.now()
        if (remaining > 0) {
          throw new FocusGuardError(
            ErrorCodes.UNBLOCK_DELAY_NOT_COMPLETE,
            `Please wait ${Math.ceil(remaining / 1000)} more seconds`,
            { remainingTime: Math.ceil(remaining / 1000) }
          )
        }
      }

      // Remove the block
      await blockMgr.remove(cleanDomain)

      // Clear pending unblock
      await store.updatePendingUnblocks(pending => {
        delete pending[cleanDomain]
        return pending
      })

      return successResponse({ domain: cleanDomain })
    },

    /**
     * Get all pending unblock requests
     * @returns {Promise<Object>} - Map of domain -> pending info
     */
    async getPending() {
      const pending = await store.getPendingUnblocks()
      const now = Date.now()

      // Clean up very old entries (more than 1 hour past unlock time)
      let hasExpired = false
      const activePending = {}

      for (const [domain, info] of Object.entries(pending)) {
        const graceExpired = now >= info.unlocksAt + DEFAULTS.PENDING_UNBLOCK_GRACE_PERIOD_MS
        if (!graceExpired) {
          activePending[domain] = info
        } else {
          hasExpired = true
        }
      }

      if (hasExpired) {
        await store.setPendingUnblocks(activePending)
      }

      return activePending
    },

    /**
     * Check if a domain has a ready (completed delay) unblock
     * @param {string} domain - Domain to check
     * @returns {Promise<boolean>}
     */
    async isReady(domain) {
      const cleanDomain = extractDomain(domain)
      if (!cleanDomain) return false

      const pending = await store.getPendingUnblocks()
      const info = pending[cleanDomain]

      if (!info) return false

      return Date.now() >= info.unlocksAt
    },

    /**
     * Get pending unblock info for a domain
     * @param {string} domain - Domain to check
     * @returns {Promise<Object|null>}
     */
    async getPendingInfo(domain) {
      const cleanDomain = extractDomain(domain)
      if (!cleanDomain) return null

      const pending = await store.getPendingUnblocks()
      return pending[cleanDomain] || null
    },

    /**
     * Clean up old daily attempts (older than today)
     * Should be called periodically
     */
    async cleanupDailyAttempts() {
      const today = getTodayKey()

      await store.updateDailyAttempts(attempts => {
        const cleaned = {}
        for (const [key, value] of Object.entries(attempts)) {
          // Keep only today's attempts
          if (key.endsWith(`_${today}`)) {
            cleaned[key] = value
          }
        }
        return cleaned
      })
    }
  }
}

// Default singleton instance
export const unblockManager = createUnblockManager()
