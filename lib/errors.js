/**
 * FocusGuard - Error Handling
 * Custom error types and user-friendly messages
 */

// Error codes for programmatic handling
export const ErrorCodes = Object.freeze({
  // Validation errors
  INVALID_DOMAIN: 'invalid_domain',
  INVALID_DURATION: 'invalid_duration',
  DURATION_TOO_SHORT: 'duration_too_short',
  DURATION_TOO_LONG: 'duration_too_long',
  INVALID_SCHEDULE: 'invalid_schedule',
  SCHEDULE_NO_DAYS: 'schedule_no_days',
  SCHEDULE_INVALID_TIME: 'schedule_invalid_time',
  SCHEDULE_NO_DOMAINS: 'schedule_no_domains',

  // Block errors
  BLOCK_NOT_FOUND: 'block_not_found',
  ALREADY_BLOCKED: 'already_blocked',
  NOT_BLOCKABLE: 'not_blockable',

  // Unblock errors
  UNBLOCK_PENDING: 'unblock_pending',
  UNBLOCK_DELAY_NOT_COMPLETE: 'unblock_delay_not_complete',
  NO_PENDING_UNBLOCK: 'no_pending_unblock',

  // Storage errors
  STORAGE_READ_FAILED: 'storage_read_failed',
  STORAGE_WRITE_FAILED: 'storage_write_failed',
  STORAGE_LOCK_TIMEOUT: 'storage_lock_timeout',

  // Communication errors
  MESSAGE_TIMEOUT: 'message_timeout',
  MESSAGE_FAILED: 'message_failed',
  UNKNOWN_ACTION: 'unknown_action',

  // General errors
  UNKNOWN_ERROR: 'unknown_error'
})

// User-friendly messages for each error code
export const UserMessages = Object.freeze({
  [ErrorCodes.INVALID_DOMAIN]: 'Please enter a valid domain (e.g., youtube.com)',
  [ErrorCodes.INVALID_DURATION]: 'Duration must be a number',
  [ErrorCodes.DURATION_TOO_SHORT]: 'Duration must be at least 1 minute',
  [ErrorCodes.DURATION_TOO_LONG]: 'Duration cannot exceed 8 hours (480 minutes)',
  [ErrorCodes.INVALID_SCHEDULE]: 'Invalid schedule configuration',
  [ErrorCodes.SCHEDULE_NO_DAYS]: 'Please select at least one day',
  [ErrorCodes.SCHEDULE_INVALID_TIME]: 'Invalid time format (use HH:MM)',
  [ErrorCodes.SCHEDULE_NO_DOMAINS]: 'Please add at least one domain to block',

  [ErrorCodes.BLOCK_NOT_FOUND]: 'This block no longer exists',
  [ErrorCodes.ALREADY_BLOCKED]: 'This site is already blocked',
  [ErrorCodes.NOT_BLOCKABLE]: 'This page cannot be blocked',

  [ErrorCodes.UNBLOCK_PENDING]: 'Unblock already in progress',
  [ErrorCodes.UNBLOCK_DELAY_NOT_COMPLETE]: 'Please wait for the delay to complete',
  [ErrorCodes.NO_PENDING_UNBLOCK]: 'No unblock request in progress',

  [ErrorCodes.STORAGE_READ_FAILED]: 'Failed to load data. Please try again.',
  [ErrorCodes.STORAGE_WRITE_FAILED]: 'Failed to save. Please try again.',
  [ErrorCodes.STORAGE_LOCK_TIMEOUT]: 'Operation timed out. Please try again.',

  [ErrorCodes.MESSAGE_TIMEOUT]: 'Request timed out. Please try again.',
  [ErrorCodes.MESSAGE_FAILED]: 'Communication error. Please try again.',
  [ErrorCodes.UNKNOWN_ACTION]: 'Unknown action requested',

  [ErrorCodes.UNKNOWN_ERROR]: 'Something went wrong. Please try again.'
})

/**
 * Custom error class for FocusGuard errors
 */
export class FocusGuardError extends Error {
  /**
   * @param {string} code - Error code from ErrorCodes
   * @param {string} [message] - Optional custom message (defaults to UserMessages)
   * @param {object} [details] - Optional additional details
   */
  constructor(code, message, details = {}) {
    super(message || UserMessages[code] || UserMessages[ErrorCodes.UNKNOWN_ERROR])
    this.name = 'FocusGuardError'
    this.code = code
    this.details = details
  }

  /**
   * Convert to plain object for serialization
   * @returns {object}
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details
    }
  }

  /**
   * Create response object for message passing
   * @returns {object}
   */
  toResponse() {
    return {
      success: false,
      error: this.message,
      code: this.code,
      details: this.details
    }
  }
}

/**
 * Get user-friendly message for an error code
 * @param {string} code - Error code
 * @returns {string} - User-friendly message
 */
export function getUserMessage(code) {
  return UserMessages[code] || UserMessages[ErrorCodes.UNKNOWN_ERROR]
}

/**
 * Create a success response object
 * @param {object} [data] - Optional data to include
 * @returns {object}
 */
export function successResponse(data = {}) {
  return {
    success: true,
    ...data
  }
}

/**
 * Create an error response object
 * @param {string} code - Error code
 * @param {object} [details] - Optional details
 * @returns {object}
 */
export function errorResponse(code, details = {}) {
  return {
    success: false,
    error: getUserMessage(code),
    code,
    ...details
  }
}

/**
 * Wrap an async function with error handling
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Wrapped function that catches errors
 */
export function withErrorHandling(fn) {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (error) {
      if (error instanceof FocusGuardError) {
        return error.toResponse()
      }

      console.error('Unexpected error:', error)
      return errorResponse(ErrorCodes.UNKNOWN_ERROR, {
        originalError: error.message
      })
    }
  }
}
