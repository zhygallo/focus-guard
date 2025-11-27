/**
 * FocusGuard - Storage Utilities
 * Storage abstraction with locking mechanism to prevent race conditions
 */

import { STORAGE_KEYS, DEFAULT_SETTINGS, DEFAULT_STATS } from './constants.js'
import { ErrorCodes, FocusGuardError } from './errors.js'

// ============================================
// LOCKING MECHANISM
// ============================================

const locks = new Map()
const LOCK_TIMEOUT_MS = 5000

/**
 * Execute a function with exclusive lock on a key
 * Prevents concurrent modifications to the same storage key
 * @param {string} key - Storage key to lock
 * @param {Function} fn - Async function to execute
 * @returns {Promise<*>} - Result of the function
 */
export async function withLock(key, fn) {
  const startTime = Date.now()

  // Wait for existing lock to release
  while (locks.get(key)) {
    if (Date.now() - startTime > LOCK_TIMEOUT_MS) {
      throw new FocusGuardError(
        ErrorCodes.STORAGE_LOCK_TIMEOUT,
        `Lock timeout on ${key}`
      )
    }
    await new Promise(resolve => setTimeout(resolve, 10))
  }

  // Acquire lock
  locks.set(key, true)

  try {
    return await fn()
  } finally {
    // Release lock
    locks.delete(key)
  }
}

// ============================================
// SYNC STORAGE (synced across devices)
// ============================================

/**
 * Get value from sync storage
 * @param {string} key - Storage key
 * @returns {Promise<*>}
 */
export async function getSyncData(key) {
  try {
    const result = await chrome.storage.sync.get(key)
    return result[key]
  } catch (error) {
    throw new FocusGuardError(
      ErrorCodes.STORAGE_READ_FAILED,
      `Failed to read ${key}: ${error.message}`
    )
  }
}

/**
 * Set value in sync storage
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 */
export async function setSyncData(key, value) {
  try {
    await chrome.storage.sync.set({ [key]: value })
  } catch (error) {
    throw new FocusGuardError(
      ErrorCodes.STORAGE_WRITE_FAILED,
      `Failed to write ${key}: ${error.message}`
    )
  }
}

/**
 * Atomically update sync storage with locking
 * @param {string} key - Storage key
 * @param {Function} updateFn - Function that receives current value and returns updated value
 * @param {*} defaultValue - Default value if key doesn't exist
 * @returns {Promise<*>} - Updated value
 */
export async function updateSyncData(key, updateFn, defaultValue = null) {
  return withLock(key, async () => {
    const current = await getSyncData(key) ?? defaultValue
    const updated = updateFn(current)
    await setSyncData(key, updated)
    return updated
  })
}

// ============================================
// LOCAL STORAGE (device only)
// ============================================

/**
 * Get value from local storage
 * @param {string} key - Storage key
 * @returns {Promise<*>}
 */
export async function getLocalData(key) {
  try {
    const result = await chrome.storage.local.get(key)
    return result[key]
  } catch (error) {
    throw new FocusGuardError(
      ErrorCodes.STORAGE_READ_FAILED,
      `Failed to read ${key}: ${error.message}`
    )
  }
}

/**
 * Set value in local storage
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 */
export async function setLocalData(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value })
  } catch (error) {
    throw new FocusGuardError(
      ErrorCodes.STORAGE_WRITE_FAILED,
      `Failed to write ${key}: ${error.message}`
    )
  }
}

/**
 * Atomically update local storage with locking
 * @param {string} key - Storage key
 * @param {Function} updateFn - Function that receives current value and returns updated value
 * @param {*} defaultValue - Default value if key doesn't exist
 * @returns {Promise<*>} - Updated value
 */
export async function updateLocalData(key, updateFn, defaultValue = null) {
  return withLock(key, async () => {
    const current = await getLocalData(key) ?? defaultValue
    const updated = updateFn(current)
    await setLocalData(key, updated)
    return updated
  })
}

// ============================================
// TYPED STORAGE OPERATIONS
// ============================================

// Active Blocks

export async function getActiveBlocks() {
  return await getSyncData(STORAGE_KEYS.ACTIVE_BLOCKS) || {}
}

export async function setActiveBlocks(blocks) {
  await setSyncData(STORAGE_KEYS.ACTIVE_BLOCKS, blocks)
}

export async function updateActiveBlocks(updateFn) {
  return updateSyncData(STORAGE_KEYS.ACTIVE_BLOCKS, updateFn, {})
}

// Schedules

export async function getSchedules() {
  return await getSyncData(STORAGE_KEYS.SCHEDULES) || []
}

export async function setSchedules(schedules) {
  await setSyncData(STORAGE_KEYS.SCHEDULES, schedules)
}

export async function updateSchedules(updateFn) {
  return updateSyncData(STORAGE_KEYS.SCHEDULES, updateFn, [])
}

// Settings

export async function getSettings() {
  const settings = await getSyncData(STORAGE_KEYS.SETTINGS)
  return { ...DEFAULT_SETTINGS, ...settings }
}

export async function setSettings(settings) {
  await setSyncData(STORAGE_KEYS.SETTINGS, settings)
}

export async function updateSettings(updateFn) {
  return updateSyncData(STORAGE_KEYS.SETTINGS, (current) => {
    return updateFn({ ...DEFAULT_SETTINGS, ...current })
  }, DEFAULT_SETTINGS)
}

// Stats

export async function getStats() {
  const stats = await getLocalData(STORAGE_KEYS.STATS)
  return { ...DEFAULT_STATS, ...stats }
}

export async function setStats(stats) {
  await setLocalData(STORAGE_KEYS.STATS, stats)
}

export async function updateStats(updateFn) {
  return updateLocalData(STORAGE_KEYS.STATS, (current) => {
    return updateFn({ ...DEFAULT_STATS, ...current })
  }, DEFAULT_STATS)
}

// Pending Unblocks

export async function getPendingUnblocks() {
  return await getLocalData(STORAGE_KEYS.PENDING_UNBLOCKS) || {}
}

export async function setPendingUnblocks(pending) {
  await setLocalData(STORAGE_KEYS.PENDING_UNBLOCKS, pending)
}

export async function updatePendingUnblocks(updateFn) {
  return updateLocalData(STORAGE_KEYS.PENDING_UNBLOCKS, updateFn, {})
}

// Daily Attempts (for unblock escalation)

export async function getDailyAttempts() {
  return await getLocalData(STORAGE_KEYS.DAILY_ATTEMPTS) || {}
}

export async function setDailyAttempts(attempts) {
  await setLocalData(STORAGE_KEYS.DAILY_ATTEMPTS, attempts)
}

export async function updateDailyAttempts(updateFn) {
  return updateLocalData(STORAGE_KEYS.DAILY_ATTEMPTS, updateFn, {})
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Clear all extension data
 */
export async function clearAllData() {
  try {
    await chrome.storage.sync.clear()
    await chrome.storage.local.clear()
  } catch (error) {
    throw new FocusGuardError(
      ErrorCodes.STORAGE_WRITE_FAILED,
      `Failed to clear data: ${error.message}`
    )
  }
}

/**
 * Export all data for backup
 * @returns {Promise<Object>}
 */
export async function exportData() {
  try {
    const syncData = await chrome.storage.sync.get(null)
    const localData = await chrome.storage.local.get(null)

    return {
      sync: syncData,
      local: localData,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    }
  } catch (error) {
    throw new FocusGuardError(
      ErrorCodes.STORAGE_READ_FAILED,
      `Failed to export data: ${error.message}`
    )
  }
}

/**
 * Import data from backup
 * @param {Object} data - Exported data object
 */
export async function importData(data) {
  try {
    if (data.sync) {
      await chrome.storage.sync.set(data.sync)
    }
    if (data.local) {
      await chrome.storage.local.set(data.local)
    }
  } catch (error) {
    throw new FocusGuardError(
      ErrorCodes.STORAGE_WRITE_FAILED,
      `Failed to import data: ${error.message}`
    )
  }
}

/**
 * Initialize storage with default values (called on extension install)
 */
export async function initializeStorage() {
  const activeBlocks = await getSyncData(STORAGE_KEYS.ACTIVE_BLOCKS)
  if (!activeBlocks) {
    await setSyncData(STORAGE_KEYS.ACTIVE_BLOCKS, {})
  }

  const schedules = await getSyncData(STORAGE_KEYS.SCHEDULES)
  if (!schedules) {
    await setSyncData(STORAGE_KEYS.SCHEDULES, [])
  }

  const settings = await getSyncData(STORAGE_KEYS.SETTINGS)
  if (!settings) {
    await setSyncData(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS)
  }

  const stats = await getLocalData(STORAGE_KEYS.STATS)
  if (!stats) {
    await setLocalData(STORAGE_KEYS.STATS, DEFAULT_STATS)
  }

  const pendingUnblocks = await getLocalData(STORAGE_KEYS.PENDING_UNBLOCKS)
  if (!pendingUnblocks) {
    await setLocalData(STORAGE_KEYS.PENDING_UNBLOCKS, {})
  }
}
