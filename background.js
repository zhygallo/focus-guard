/**
 * FocusGuard - Background Service Worker
 * Thin orchestration layer using modular managers
 */

import { ACTIONS, ALARMS } from './lib/constants.js'
import { isBlockableUrl } from './lib/domain-utils.js'
import { initializeStorage } from './lib/storage.js'
import { createMessageHandler } from './lib/messaging.js'
import { blockManager } from './lib/block-manager.js'
import { unblockManager } from './lib/unblock-manager.js'
import { scheduleManager } from './lib/schedule-manager.js'
import { statsManager } from './lib/stats-manager.js'

// ============================================
// INITIALIZATION
// ============================================

chrome.runtime.onInstalled.addListener(async () => {
  console.log('FocusGuard installed')
  await initializeStorage()
  scheduleManager.setupAlarm()
})

// ============================================
// TAB MONITORING
// ============================================

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, _tab) => {
  if (changeInfo.url) {
    await checkAndBlockUrl(tabId, changeInfo.url)
  }
})

chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.url) {
    await checkAndBlockUrl(tab.id, tab.url)
  }
})

/**
 * Check if URL should be blocked and redirect if so
 */
async function checkAndBlockUrl(tabId, url) {
  // Skip non-blockable URLs
  if (!isBlockableUrl(url)) {
    return
  }

  try {
    const blockPageUrl = await blockManager.getBlockPageUrl(url)

    if (blockPageUrl) {
      // Record the blocked attempt
      await statsManager.recordBlockedAttempt(url)

      // Redirect to block page
      chrome.tabs.update(tabId, { url: blockPageUrl })
    }
  } catch (error) {
    console.error('Error checking URL:', error)
  }
}

// ============================================
// ALARM HANDLERS
// ============================================

chrome.alarms.onAlarm.addListener(async (alarm) => {
  try {
    if (alarm.name === ALARMS.CHECK_SCHEDULES) {
      await scheduleManager.checkAll()
    } else if (alarm.name.startsWith(ALARMS.UNBLOCK_PREFIX)) {
      const domain = alarm.name.replace(ALARMS.UNBLOCK_PREFIX, '')
      console.log(`Unblock delay completed for ${domain}`)
      // Cleanup can be done here if needed
    }
  } catch (error) {
    console.error('Alarm handler error:', error)
  }
})

// ============================================
// MESSAGE HANDLER
// ============================================

const messageHandler = createMessageHandler({
  // Block operations
  [ACTIONS.ADD_BLOCK]: (msg) =>
    blockManager.addAndRedirect(msg.domain, msg.minutes, msg.reason),

  [ACTIONS.REMOVE_BLOCK]: (msg) =>
    blockManager.remove(msg.domain),

  [ACTIONS.GET_BLOCKS]: () =>
    blockManager.getAll(),

  // Unblock operations
  [ACTIONS.REQUEST_UNBLOCK]: (msg) =>
    unblockManager.request(msg.domain),

  [ACTIONS.CANCEL_UNBLOCK]: (msg) =>
    unblockManager.cancel(msg.domain),

  [ACTIONS.CONFIRM_UNBLOCK]: (msg) =>
    unblockManager.confirm(msg.domain),

  [ACTIONS.GET_PENDING_UNBLOCKS]: () =>
    unblockManager.getPending(),

  // Stats operations
  [ACTIONS.GET_STATS]: () =>
    statsManager.getStats(),

  // Schedule operations
  [ACTIONS.ADD_SCHEDULE]: (msg) =>
    scheduleManager.add(msg.schedule),

  [ACTIONS.DELETE_SCHEDULE]: (msg) =>
    scheduleManager.delete(msg.id),

  [ACTIONS.TOGGLE_SCHEDULE]: (msg) =>
    scheduleManager.toggle(msg.id, msg.enabled),

  [ACTIONS.GET_SCHEDULES]: () =>
    scheduleManager.getAll()
})

chrome.runtime.onMessage.addListener(messageHandler)

// ============================================
// STARTUP
// ============================================

// Set up schedule checking on startup
scheduleManager.setupAlarm()

// Clean up old data periodically
async function periodicCleanup() {
  try {
    await unblockManager.cleanupDailyAttempts()
    await statsManager.cleanup()
  } catch (error) {
    console.error('Cleanup error:', error)
  }
}

// Run cleanup once on startup
periodicCleanup()

console.log('FocusGuard background service worker loaded')
