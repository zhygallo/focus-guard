/**
 * FocusGuard - Storage Utilities
 * Helper functions for Chrome storage operations
 */

// ============================================
// SYNC STORAGE (synced across devices)
// ============================================

export async function getSyncData(key) {
  const result = await chrome.storage.sync.get(key)
  return result[key]
}

export async function setSyncData(key, value) {
  await chrome.storage.sync.set({ [key]: value })
}

export async function getActiveBlocks() {
  return await getSyncData('activeBlocks') || {}
}

export async function setActiveBlocks(blocks) {
  await setSyncData('activeBlocks', blocks)
}

export async function getSchedules() {
  return await getSyncData('schedules') || []
}

export async function setSchedules(schedules) {
  await setSyncData('schedules', schedules)
}

export async function getSettings() {
  return await getSyncData('settings') || {
    defaultBlockDuration: 60,
    unblockDelayBase: 5,
    unblockDelayEscalation: true,
    showMotivationalQuotes: true
  }
}

export async function setSettings(settings) {
  await setSyncData('settings', settings)
}

// ============================================
// LOCAL STORAGE (device only)
// ============================================

export async function getLocalData(key) {
  const result = await chrome.storage.local.get(key)
  return result[key]
}

export async function setLocalData(key, value) {
  await chrome.storage.local.set({ [key]: value })
}

export async function getStats() {
  return await getLocalData('stats') || {
    totalBlocksCreated: 0,
    blockedAttempts: {},
    siteAttempts: {},
    streakStartDate: null,
    lastActiveDate: null
  }
}

export async function setStats(stats) {
  await setLocalData('stats', stats)
}

export async function getPendingUnblocks() {
  return await getLocalData('pendingUnblocks') || {}
}

export async function setPendingUnblocks(pending) {
  await setLocalData('pendingUnblocks', pending)
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export async function clearAllData() {
  await chrome.storage.sync.clear()
  await chrome.storage.local.clear()
}

export async function exportData() {
  const syncData = await chrome.storage.sync.get(null)
  const localData = await chrome.storage.local.get(null)
  
  return {
    sync: syncData,
    local: localData,
    exportedAt: new Date().toISOString()
  }
}

export async function importData(data) {
  if (data.sync) {
    await chrome.storage.sync.set(data.sync)
  }
  if (data.local) {
    await chrome.storage.local.set(data.local)
  }
}
