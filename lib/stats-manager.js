/**
 * FocusGuard - Stats Manager
 * Handles statistics tracking for blocked attempts
 */

import { getTodayKey } from './time-utils.js'
import { extractDomain } from './domain-utils.js'
import * as storage from './storage.js'

/**
 * Create a stats manager instance
 * @param {Object} deps - Dependencies (for testing, can inject mocks)
 * @param {Object} [deps.storage] - Storage module
 * @returns {Object} - Stats manager API
 */
export function createStatsManager(deps = {}) {
  const store = deps.storage || storage

  return {
    /**
     * Record a blocked attempt (when user tries to visit blocked site)
     * @param {string} domain - Domain that was blocked
     */
    async recordBlockedAttempt(domain) {
      const cleanDomain = extractDomain(domain) || domain
      const today = getTodayKey()

      await store.updateStats(stats => {
        // Daily attempts
        stats.blockedAttempts = stats.blockedAttempts || {}
        stats.blockedAttempts[today] = (stats.blockedAttempts[today] || 0) + 1

        // Per-site attempts
        stats.siteAttempts = stats.siteAttempts || {}
        stats.siteAttempts[cleanDomain] = (stats.siteAttempts[cleanDomain] || 0) + 1

        // Update streak tracking
        stats.lastActiveDate = today
        if (!stats.streakStartDate) {
          stats.streakStartDate = today
        }

        return stats
      })
    },

    /**
     * Get all statistics
     * @returns {Promise<Object>}
     */
    async getStats() {
      return await store.getStats()
    },

    /**
     * Get today's blocked attempts count
     * @returns {Promise<number>}
     */
    async getTodayCount() {
      const stats = await store.getStats()
      const today = getTodayKey()
      return stats.blockedAttempts?.[today] || 0
    },

    /**
     * Get blocked attempts for a specific date
     * @param {string} dateKey - Date in YYYY-MM-DD format
     * @returns {Promise<number>}
     */
    async getCountForDate(dateKey) {
      const stats = await store.getStats()
      return stats.blockedAttempts?.[dateKey] || 0
    },

    /**
     * Get total blocked attempts for this week
     * @returns {Promise<number>}
     */
    async getWeekCount() {
      const stats = await store.getStats()
      const attempts = stats.blockedAttempts || {}

      // Get dates for the last 7 days
      const today = new Date()
      let total = 0

      for (let i = 0; i < 7; i++) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        const dateKey = date.toISOString().split('T')[0]
        total += attempts[dateKey] || 0
      }

      return total
    },

    /**
     * Get top blocked sites
     * @param {number} [limit=5] - Number of sites to return
     * @returns {Promise<Array<{domain: string, count: number}>>}
     */
    async getTopSites(limit = 5) {
      const stats = await store.getStats()
      const siteAttempts = stats.siteAttempts || {}

      const sorted = Object.entries(siteAttempts)
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)

      return sorted
    },

    /**
     * Get current streak (consecutive days with blocks)
     * @returns {Promise<number>}
     */
    async getStreak() {
      const stats = await store.getStats()
      const attempts = stats.blockedAttempts || {}

      let streak = 0
      const today = new Date()

      // Count backwards from today
      for (let i = 0; i < 365; i++) { // Max 1 year
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        const dateKey = date.toISOString().split('T')[0]

        if (attempts[dateKey] > 0) {
          streak++
        } else if (i > 0) { // Allow today to have no blocks yet
          break
        }
      }

      return streak
    },

    /**
     * Get total blocks created (all time)
     * @returns {Promise<number>}
     */
    async getTotalBlocksCreated() {
      const stats = await store.getStats()
      return stats.totalBlocksCreated || 0
    },

    /**
     * Increment total blocks created count
     */
    async incrementBlocksCreated() {
      await store.updateStats(stats => {
        stats.totalBlocksCreated = (stats.totalBlocksCreated || 0) + 1
        return stats
      })
    },

    /**
     * Get summary statistics
     * @returns {Promise<Object>}
     */
    async getSummary() {
      const [
        todayCount,
        weekCount,
        topSites,
        streak,
        totalBlocks
      ] = await Promise.all([
        this.getTodayCount(),
        this.getWeekCount(),
        this.getTopSites(5),
        this.getStreak(),
        this.getTotalBlocksCreated()
      ])

      return {
        today: todayCount,
        week: weekCount,
        topSites,
        streak,
        totalBlocksCreated: totalBlocks
      }
    },

    /**
     * Clean up old statistics (older than 30 days)
     * Should be called periodically to prevent storage bloat
     */
    async cleanup() {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 30)
      const cutoffKey = cutoffDate.toISOString().split('T')[0]

      await store.updateStats(stats => {
        // Clean old daily attempts
        if (stats.blockedAttempts) {
          const cleaned = {}
          for (const [date, count] of Object.entries(stats.blockedAttempts)) {
            if (date >= cutoffKey) {
              cleaned[date] = count
            }
          }
          stats.blockedAttempts = cleaned
        }

        return stats
      })
    },

    /**
     * Reset all statistics
     */
    async reset() {
      await store.setStats({
        totalBlocksCreated: 0,
        blockedAttempts: {},
        siteAttempts: {},
        streakStartDate: null,
        lastActiveDate: null
      })
    }
  }
}

// Default singleton instance
export const statsManager = createStatsManager()
