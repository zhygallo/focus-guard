/**
 * FocusGuard - Input Validation
 * Validation functions for domains, durations, and schedules
 */

import { DEFAULTS } from './constants.js'
import { extractDomain, isBlockableUrl } from './domain-utils.js'
import { ErrorCodes } from './errors.js'

/**
 * Validation result object
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {Array<{code: string, message: string}>} errors - List of errors
 * @property {*} [value] - Cleaned/normalized value if valid
 */

/**
 * Validate domain input
 * @param {string} domain - Domain to validate
 * @returns {ValidationResult}
 */
export function validateDomain(domain) {
  const errors = []

  if (!domain || typeof domain !== 'string') {
    errors.push({
      code: ErrorCodes.INVALID_DOMAIN,
      message: 'Domain is required'
    })
    return { valid: false, errors }
  }

  const cleaned = extractDomain(domain)

  if (!cleaned) {
    errors.push({
      code: ErrorCodes.INVALID_DOMAIN,
      message: 'Invalid domain format'
    })
    return { valid: false, errors }
  }

  if (cleaned.length < 3) {
    errors.push({
      code: ErrorCodes.INVALID_DOMAIN,
      message: 'Domain is too short'
    })
    return { valid: false, errors }
  }

  if (!cleaned.includes('.')) {
    errors.push({
      code: ErrorCodes.INVALID_DOMAIN,
      message: 'Domain must include a TLD (e.g., .com)'
    })
    return { valid: false, errors }
  }

  // Check for obviously invalid patterns
  const invalidPatterns = [
    /^\./, // starts with dot
    /\.$/, // ends with dot
    /\.\./, // consecutive dots
    /\s/, // whitespace
    /[<>'"&]/ // dangerous characters
  ]

  for (const pattern of invalidPatterns) {
    if (pattern.test(cleaned)) {
      errors.push({
        code: ErrorCodes.INVALID_DOMAIN,
        message: 'Domain contains invalid characters'
      })
      return { valid: false, errors }
    }
  }

  return { valid: true, errors: [], value: cleaned }
}

/**
 * Validate URL for blocking
 * @param {string} url - URL to validate
 * @returns {ValidationResult}
 */
export function validateBlockableUrl(url) {
  const errors = []

  if (!url || typeof url !== 'string') {
    errors.push({
      code: ErrorCodes.NOT_BLOCKABLE,
      message: 'Invalid URL'
    })
    return { valid: false, errors }
  }

  if (!isBlockableUrl(url)) {
    errors.push({
      code: ErrorCodes.NOT_BLOCKABLE,
      message: 'This page cannot be blocked'
    })
    return { valid: false, errors }
  }

  const domain = extractDomain(url)
  if (!domain) {
    errors.push({
      code: ErrorCodes.INVALID_DOMAIN,
      message: 'Cannot extract domain from URL'
    })
    return { valid: false, errors }
  }

  return { valid: true, errors: [], value: domain }
}

/**
 * Validate block duration
 * @param {number|string} minutes - Duration in minutes
 * @returns {ValidationResult}
 */
export function validateDuration(minutes) {
  const errors = []

  const parsed = parseInt(minutes, 10)

  if (!Number.isFinite(parsed)) {
    errors.push({
      code: ErrorCodes.INVALID_DURATION,
      message: 'Duration must be a number'
    })
    return { valid: false, errors }
  }

  if (parsed < DEFAULTS.MIN_BLOCK_MINUTES) {
    errors.push({
      code: ErrorCodes.DURATION_TOO_SHORT,
      message: `Duration must be at least ${DEFAULTS.MIN_BLOCK_MINUTES} minute`
    })
    return { valid: false, errors }
  }

  if (parsed > DEFAULTS.MAX_BLOCK_MINUTES) {
    errors.push({
      code: ErrorCodes.DURATION_TOO_LONG,
      message: `Duration cannot exceed ${DEFAULTS.MAX_BLOCK_MINUTES} minutes (8 hours)`
    })
    return { valid: false, errors }
  }

  return { valid: true, errors: [], value: parsed }
}

/**
 * Validate time string (HH:MM format)
 * @param {string} timeStr - Time string
 * @returns {ValidationResult}
 */
export function validateTimeFormat(timeStr) {
  const errors = []

  if (!timeStr || typeof timeStr !== 'string') {
    errors.push({
      code: ErrorCodes.SCHEDULE_INVALID_TIME,
      message: 'Time is required'
    })
    return { valid: false, errors }
  }

  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/
  if (!timeRegex.test(timeStr)) {
    errors.push({
      code: ErrorCodes.SCHEDULE_INVALID_TIME,
      message: 'Time must be in HH:MM format (e.g., 09:00)'
    })
    return { valid: false, errors }
  }

  return { valid: true, errors: [], value: timeStr }
}

/**
 * Validate schedule configuration
 * @param {Object} schedule - Schedule object
 * @param {string[]} schedule.domains - Domains to block
 * @param {string} schedule.startTime - Start time (HH:MM)
 * @param {string} schedule.endTime - End time (HH:MM)
 * @param {number[]} schedule.days - Days of week (0-6)
 * @returns {ValidationResult}
 */
export function validateSchedule(schedule) {
  const errors = []

  if (!schedule || typeof schedule !== 'object') {
    errors.push({
      code: ErrorCodes.INVALID_SCHEDULE,
      message: 'Schedule configuration is required'
    })
    return { valid: false, errors }
  }

  // Validate domains
  if (!Array.isArray(schedule.domains) || schedule.domains.length === 0) {
    errors.push({
      code: ErrorCodes.SCHEDULE_NO_DOMAINS,
      message: 'At least one domain is required'
    })
  } else {
    // Validate each domain
    const validDomains = []
    for (const domain of schedule.domains) {
      const result = validateDomain(domain)
      if (result.valid) {
        validDomains.push(result.value)
      } else {
        errors.push(...result.errors)
      }
    }
    schedule.domains = validDomains
  }

  // Validate start time
  const startResult = validateTimeFormat(schedule.startTime)
  if (!startResult.valid) {
    errors.push({
      code: ErrorCodes.SCHEDULE_INVALID_TIME,
      message: 'Invalid start time'
    })
  }

  // Validate end time
  const endResult = validateTimeFormat(schedule.endTime)
  if (!endResult.valid) {
    errors.push({
      code: ErrorCodes.SCHEDULE_INVALID_TIME,
      message: 'Invalid end time'
    })
  }

  // Validate time order (start should be before end)
  if (startResult.valid && endResult.valid) {
    const startMinutes = timeToMinutes(schedule.startTime)
    const endMinutes = timeToMinutes(schedule.endTime)
    if (startMinutes >= endMinutes) {
      errors.push({
        code: ErrorCodes.SCHEDULE_INVALID_TIME,
        message: 'End time must be after start time'
      })
    }
  }

  // Validate days
  if (!Array.isArray(schedule.days) || schedule.days.length === 0) {
    errors.push({
      code: ErrorCodes.SCHEDULE_NO_DAYS,
      message: 'At least one day must be selected'
    })
  } else {
    const validDays = schedule.days.filter(day =>
      Number.isInteger(day) && day >= 0 && day <= 6
    )
    if (validDays.length === 0) {
      errors.push({
        code: ErrorCodes.SCHEDULE_NO_DAYS,
        message: 'Invalid day selection'
      })
    }
    schedule.days = validDays
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return { valid: true, errors: [], value: schedule }
}

/**
 * Helper: Convert time string to minutes since midnight
 * @param {string} timeStr - Time in HH:MM format
 * @returns {number}
 */
function timeToMinutes(timeStr) {
  const [hours, mins] = timeStr.split(':').map(Number)
  return hours * 60 + mins
}

/**
 * Validate that a value is a non-empty string
 * @param {*} value - Value to check
 * @param {string} fieldName - Field name for error message
 * @returns {ValidationResult}
 */
export function validateRequiredString(value, fieldName) {
  const errors = []

  if (!value || typeof value !== 'string' || value.trim() === '') {
    errors.push({
      code: ErrorCodes.UNKNOWN_ERROR,
      message: `${fieldName} is required`
    })
    return { valid: false, errors }
  }

  return { valid: true, errors: [], value: value.trim() }
}
