/**
 * FocusGuard - Chrome API Mock
 * Provides mock implementations of Chrome extension APIs for testing
 */

// In-memory storage for sync and local
const syncStorage = {}
const localStorage = {}
const alarms = new Map()

/**
 * Reset all mocked storage (call between tests)
 */
export function resetMocks() {
  Object.keys(syncStorage).forEach(key => delete syncStorage[key])
  Object.keys(localStorage).forEach(key => delete localStorage[key])
  alarms.clear()
}

/**
 * Get current state of sync storage (for test assertions)
 */
export function getSyncStorage() {
  return { ...syncStorage }
}

/**
 * Get current state of local storage (for test assertions)
 */
export function getLocalStorage() {
  return { ...localStorage }
}

/**
 * Set initial sync storage state (for test setup)
 */
export function setSyncStorage(data) {
  Object.assign(syncStorage, data)
}

/**
 * Set initial local storage state (for test setup)
 */
export function setLocalStorage(data) {
  Object.assign(localStorage, data)
}

/**
 * Get all alarms (for test assertions)
 */
export function getAlarms() {
  return new Map(alarms)
}

// Mock chrome.storage.sync
const mockStorageSync = {
  get: (keys) => {
    return new Promise((resolve) => {
      if (keys === null) {
        resolve({ ...syncStorage })
      } else if (typeof keys === 'string') {
        resolve({ [keys]: syncStorage[keys] })
      } else if (Array.isArray(keys)) {
        const result = {}
        keys.forEach(key => {
          if (key in syncStorage) {
            result[key] = syncStorage[key]
          }
        })
        resolve(result)
      } else {
        resolve({})
      }
    })
  },
  set: (data) => {
    return new Promise((resolve) => {
      Object.assign(syncStorage, data)
      resolve()
    })
  },
  clear: () => {
    return new Promise((resolve) => {
      Object.keys(syncStorage).forEach(key => delete syncStorage[key])
      resolve()
    })
  }
}

// Mock chrome.storage.local
const mockStorageLocal = {
  get: (keys) => {
    return new Promise((resolve) => {
      if (keys === null) {
        resolve({ ...localStorage })
      } else if (typeof keys === 'string') {
        resolve({ [keys]: localStorage[keys] })
      } else if (Array.isArray(keys)) {
        const result = {}
        keys.forEach(key => {
          if (key in localStorage) {
            result[key] = localStorage[key]
          }
        })
        resolve(result)
      } else {
        resolve({})
      }
    })
  },
  set: (data) => {
    return new Promise((resolve) => {
      Object.assign(localStorage, data)
      resolve()
    })
  },
  clear: () => {
    return new Promise((resolve) => {
      Object.keys(localStorage).forEach(key => delete localStorage[key])
      resolve()
    })
  }
}

// Mock chrome.alarms
const mockAlarms = {
  create: (name, options) => {
    alarms.set(name, { name, ...options })
  },
  clear: (name) => {
    return new Promise((resolve) => {
      alarms.delete(name)
      resolve(true)
    })
  },
  get: (name) => {
    return new Promise((resolve) => {
      resolve(alarms.get(name) || null)
    })
  },
  getAll: () => {
    return new Promise((resolve) => {
      resolve(Array.from(alarms.values()))
    })
  }
}

// Mock chrome.runtime
const mockRuntime = {
  getURL: (path) => `chrome-extension://mock-id/${path}`,
  lastError: null
}

// Mock chrome.tabs
const mockTabs = {
  query: () => Promise.resolve([]),
  update: () => Promise.resolve()
}

// Full chrome mock object
export const chrome = {
  storage: {
    sync: mockStorageSync,
    local: mockStorageLocal
  },
  alarms: mockAlarms,
  runtime: mockRuntime,
  tabs: mockTabs
}

// Install globally for modules that access chrome directly
globalThis.chrome = chrome
