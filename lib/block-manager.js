/**
 * FocusGuard - Block Manager
 * Handles block CRUD operations with dependency injection for testability
 */

import { BLOCK_REASONS } from './constants.js'
import { ErrorCodes, FocusGuardError, successResponse } from './errors.js'
import { extractDomain, isBlockableUrl, domainMatches } from './domain-utils.js'
import { validateDomain, validateDuration } from './validation.js'
import * as storage from './storage.js'

/**
 * Create a block manager instance
 * @param {Object} deps - Dependencies (for testing, can inject mocks)
 * @param {Object} [deps.storage] - Storage module
 * @returns {Object} - Block manager API
 */
export function createBlockManager(deps = {}) {
  const store = deps.storage || storage

  return {
    /**
     * Add a new block for a domain
     * @param {string} domain - Domain to block
     * @param {number} minutes - Duration in minutes
     * @param {string} [reason] - Reason for block (manual/schedule)
     * @returns {Promise<Object>} - Response with success status
     */
    async add(domain, minutes, reason = BLOCK_REASONS.MANUAL) {
      // Validate domain
      const domainResult = validateDomain(domain)
      if (!domainResult.valid) {
        throw new FocusGuardError(
          domainResult.errors[0].code,
          domainResult.errors[0].message
        )
      }
      const cleanDomain = domainResult.value

      // Validate duration
      const durationResult = validateDuration(minutes)
      if (!durationResult.valid) {
        throw new FocusGuardError(
          durationResult.errors[0].code,
          durationResult.errors[0].message
        )
      }
      const validMinutes = durationResult.value

      // Add block atomically
      await store.updateActiveBlocks(blocks => {
        blocks[cleanDomain] = {
          until: Date.now() + (validMinutes * 60 * 1000),
          blockedAt: Date.now(),
          reason
        }
        return blocks
      })

      // Update stats
      await store.updateStats(stats => {
        stats.totalBlocksCreated = (stats.totalBlocksCreated || 0) + 1
        return stats
      })

      return successResponse({ domain: cleanDomain })
    },

    /**
     * Remove a block for a domain
     * @param {string} domain - Domain to unblock
     * @returns {Promise<Object>} - Response with success status
     */
    async remove(domain) {
      const cleanDomain = extractDomain(domain)
      if (!cleanDomain) {
        throw new FocusGuardError(ErrorCodes.INVALID_DOMAIN)
      }

      let found = false
      await store.updateActiveBlocks(blocks => {
        if (blocks[cleanDomain]) {
          delete blocks[cleanDomain]
          found = true
        }
        return blocks
      })

      // Also clear any pending unblock
      await store.updatePendingUnblocks(pending => {
        delete pending[cleanDomain]
        return pending
      })

      if (!found) {
        throw new FocusGuardError(ErrorCodes.BLOCK_NOT_FOUND)
      }

      return successResponse({ domain: cleanDomain })
    },

    /**
     * Get all active blocks
     * @returns {Promise<Object>} - Map of domain -> block info
     */
    async getAll() {
      const blocks = await store.getActiveBlocks()

      // Clean up expired blocks
      const now = Date.now()
      let hasExpired = false
      const activeBlocks = {}

      for (const [domain, info] of Object.entries(blocks)) {
        if (now < info.until) {
          activeBlocks[domain] = info
        } else {
          hasExpired = true
        }
      }

      // Persist cleaned blocks if any expired
      if (hasExpired) {
        await store.setActiveBlocks(activeBlocks)
      }

      return activeBlocks
    },

    /**
     * Check if a domain is currently blocked
     * @param {string} domain - Domain to check
     * @returns {Promise<boolean>}
     */
    async isBlocked(domain) {
      const cleanDomain = extractDomain(domain)
      if (!cleanDomain) return false

      const blocks = await this.getAll()

      // Direct match
      if (blocks[cleanDomain]) {
        return true
      }

      // Check if any blocked domain is a parent of this domain
      for (const blockedDomain of Object.keys(blocks)) {
        if (domainMatches(cleanDomain, blockedDomain)) {
          return true
        }
      }

      return false
    },

    /**
     * Get block info for a specific domain
     * @param {string} domain - Domain to check
     * @returns {Promise<Object|null>} - Block info or null if not blocked
     */
    async getBlockInfo(domain) {
      const cleanDomain = extractDomain(domain)
      if (!cleanDomain) return null

      const blocks = await this.getAll()

      // Direct match
      if (blocks[cleanDomain]) {
        return { domain: cleanDomain, ...blocks[cleanDomain] }
      }

      // Check parent domains
      for (const [blockedDomain, info] of Object.entries(blocks)) {
        if (domainMatches(cleanDomain, blockedDomain)) {
          return { domain: blockedDomain, ...info }
        }
      }

      return null
    },

    /**
     * Check URL and return block page URL if blocked
     * @param {string} url - URL to check
     * @returns {Promise<string|null>} - Block page URL or null if not blocked
     */
    async getBlockPageUrl(url) {
      if (!isBlockableUrl(url)) {
        return null
      }

      const blockInfo = await this.getBlockInfo(url)
      if (!blockInfo) {
        return null
      }

      const blockedPageUrl = chrome.runtime.getURL('blocked/blocked.html') +
        `?domain=${encodeURIComponent(blockInfo.domain)}` +
        `&until=${blockInfo.until}`

      return blockedPageUrl
    },

    /**
     * Redirect all tabs with a blocked domain to block page
     * @param {string} domain - Domain that was blocked
     * @param {Object} blockInfo - Block info object
     */
    async redirectBlockedTabs(domain, blockInfo) {
      const cleanDomain = extractDomain(domain)
      if (!cleanDomain) return

      const blockedUrl = chrome.runtime.getURL('blocked/blocked.html') +
        `?domain=${encodeURIComponent(cleanDomain)}` +
        `&until=${blockInfo.until}`

      try {
        const tabs = await chrome.tabs.query({})
        for (const tab of tabs) {
          if (tab.url) {
            const tabDomain = extractDomain(tab.url)
            if (tabDomain && domainMatches(tabDomain, cleanDomain)) {
              chrome.tabs.update(tab.id, { url: blockedUrl })
            }
          }
        }
      } catch (error) {
        console.error('Error redirecting tabs:', error)
      }
    },

    /**
     * Add block and redirect matching tabs
     * @param {string} domain - Domain to block
     * @param {number} minutes - Duration in minutes
     * @param {string} [reason] - Reason for block
     * @returns {Promise<Object>}
     */
    async addAndRedirect(domain, minutes, reason = BLOCK_REASONS.MANUAL) {
      const result = await this.add(domain, minutes, reason)

      if (result.success) {
        const blocks = await store.getActiveBlocks()
        const blockInfo = blocks[result.domain]
        if (blockInfo) {
          await this.redirectBlockedTabs(result.domain, blockInfo)
        }
      }

      return result
    }
  }
}

// Default singleton instance
export const blockManager = createBlockManager()
