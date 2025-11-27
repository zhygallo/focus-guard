/**
 * FocusGuard - Messaging Utilities
 * Message passing wrapper with timeout and typed API helpers
 */

import { ACTIONS, DEFAULTS } from './constants.js'
import { ErrorCodes, FocusGuardError } from './errors.js'

/**
 * Send a message to the background script with timeout
 * @param {Object} message - Message object with action and data
 * @param {number} [timeout] - Timeout in milliseconds
 * @returns {Promise<Object>} - Response from background script
 */
export function sendMessage(message, timeout = DEFAULTS.MESSAGE_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new FocusGuardError(
        ErrorCodes.MESSAGE_TIMEOUT,
        'Request timed out. Please try again.'
      ))
    }, timeout)

    try {
      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeoutId)

        // Check for Chrome runtime errors
        if (chrome.runtime.lastError) {
          reject(new FocusGuardError(
            ErrorCodes.MESSAGE_FAILED,
            chrome.runtime.lastError.message
          ))
          return
        }

        // Return response or empty object
        resolve(response || {})
      })
    } catch (error) {
      clearTimeout(timeoutId)
      reject(new FocusGuardError(
        ErrorCodes.MESSAGE_FAILED,
        error.message
      ))
    }
  })
}

/**
 * Send message and handle errors gracefully
 * Returns error response instead of throwing
 * @param {Object} message - Message object
 * @returns {Promise<Object>} - Response (always resolves)
 */
export async function sendMessageSafe(message) {
  try {
    return await sendMessage(message)
  } catch (error) {
    if (error instanceof FocusGuardError) {
      return error.toResponse()
    }
    return {
      success: false,
      error: error.message,
      code: ErrorCodes.UNKNOWN_ERROR
    }
  }
}

/**
 * Typed API helpers for common operations
 * These provide better developer experience with named methods
 */
export const api = {
  // Block operations
  addBlock: (domain, minutes, reason) =>
    sendMessageSafe({ action: ACTIONS.ADD_BLOCK, domain, minutes, reason }),

  removeBlock: (domain) =>
    sendMessageSafe({ action: ACTIONS.REMOVE_BLOCK, domain }),

  getBlocks: () =>
    sendMessageSafe({ action: ACTIONS.GET_BLOCKS }),

  // Unblock operations
  requestUnblock: (domain) =>
    sendMessageSafe({ action: ACTIONS.REQUEST_UNBLOCK, domain }),

  cancelUnblock: (domain) =>
    sendMessageSafe({ action: ACTIONS.CANCEL_UNBLOCK, domain }),

  confirmUnblock: (domain) =>
    sendMessageSafe({ action: ACTIONS.CONFIRM_UNBLOCK, domain }),

  getPendingUnblocks: () =>
    sendMessageSafe({ action: ACTIONS.GET_PENDING_UNBLOCKS }),

  // Stats operations
  getStats: () =>
    sendMessageSafe({ action: ACTIONS.GET_STATS }),

  // Schedule operations
  addSchedule: (schedule) =>
    sendMessageSafe({ action: ACTIONS.ADD_SCHEDULE, schedule }),

  deleteSchedule: (id) =>
    sendMessageSafe({ action: ACTIONS.DELETE_SCHEDULE, id }),

  toggleSchedule: (id, enabled) =>
    sendMessageSafe({ action: ACTIONS.TOGGLE_SCHEDULE, id, enabled }),

  getSchedules: () =>
    sendMessageSafe({ action: ACTIONS.GET_SCHEDULES })
}

/**
 * Create message handler registry for background script
 * Maps action names to handler functions
 * @param {Object} handlers - Map of action -> handler function
 * @returns {Function} - Chrome message listener
 */
export function createMessageHandler(handlers) {
  return (message, sender, sendResponse) => {
    const handler = handlers[message.action]

    if (!handler) {
      sendResponse({
        success: false,
        error: 'Unknown action',
        code: ErrorCodes.UNKNOWN_ACTION
      })
      return false
    }

    // Execute handler and send response
    Promise.resolve()
      .then(() => handler(message, sender))
      .then(result => {
        sendResponse(result)
      })
      .catch(error => {
        console.error(`Error handling ${message.action}:`, error)

        if (error instanceof FocusGuardError) {
          sendResponse(error.toResponse())
        } else {
          sendResponse({
            success: false,
            error: error.message,
            code: ErrorCodes.UNKNOWN_ERROR
          })
        }
      })

    // Return true to indicate async response
    return true
  }
}
