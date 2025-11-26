/**
 * FocusGuard - Constants
 * Centralized constants for action names, alarm names, storage keys, and defaults
 */

// Message action names for popup <-> background communication
export const ACTIONS = Object.freeze({
  ADD_BLOCK: 'addBlock',
  REMOVE_BLOCK: 'removeBlock',
  GET_BLOCKS: 'getBlocks',
  REQUEST_UNBLOCK: 'requestUnblock',
  CANCEL_UNBLOCK: 'cancelUnblock',
  CONFIRM_UNBLOCK: 'confirmUnblock',
  GET_PENDING_UNBLOCKS: 'getPendingUnblocks',
  GET_STATS: 'getStats',
  ADD_SCHEDULE: 'addSchedule',
  DELETE_SCHEDULE: 'deleteSchedule',
  TOGGLE_SCHEDULE: 'toggleSchedule',
  GET_SCHEDULES: 'getSchedules'
})

// Chrome alarm names
export const ALARMS = Object.freeze({
  CHECK_SCHEDULES: 'checkSchedules',
  UNBLOCK_PREFIX: 'unblock_'
})

// Chrome storage keys
export const STORAGE_KEYS = Object.freeze({
  ACTIVE_BLOCKS: 'activeBlocks',
  SCHEDULES: 'schedules',
  SETTINGS: 'settings',
  STATS: 'stats',
  PENDING_UNBLOCKS: 'pendingUnblocks',
  DAILY_ATTEMPTS: 'dailyAttempts'
})

// Default values
export const DEFAULTS = Object.freeze({
  BLOCK_DURATION_MINUTES: 60,
  UNBLOCK_DELAY_BASE_MINUTES: 5,
  UNBLOCK_DELAY_MAX_MINUTES: 15,
  UNBLOCK_DELAY_ESCALATION_MINUTES: 5,
  MIN_BLOCK_MINUTES: 1,
  MAX_BLOCK_MINUTES: 480,
  SCHEDULE_CHECK_INTERVAL_MINUTES: 1,
  MESSAGE_TIMEOUT_MS: 5000,
  PENDING_UNBLOCK_GRACE_PERIOD_MS: 60 * 60 * 1000 // 1 hour
})

// Block reasons
export const BLOCK_REASONS = Object.freeze({
  MANUAL: 'manual',
  SCHEDULE: 'schedule'
})

// Default settings structure
export const DEFAULT_SETTINGS = Object.freeze({
  defaultBlockDuration: DEFAULTS.BLOCK_DURATION_MINUTES,
  unblockDelayBase: DEFAULTS.UNBLOCK_DELAY_BASE_MINUTES,
  unblockDelayEscalation: true,
  showMotivationalQuotes: true
})

// Default stats structure
export const DEFAULT_STATS = Object.freeze({
  totalBlocksCreated: 0,
  blockedAttempts: {},
  siteAttempts: {},
  streakStartDate: null,
  lastActiveDate: null
})
