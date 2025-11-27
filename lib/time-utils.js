/**
 * FocusGuard - Time Utilities
 * Functions for time formatting and date operations
 */

/**
 * Format duration in minutes to human-readable string
 * @param {number} minutes - Duration in minutes
 * @returns {string} - Formatted string (e.g., "1 hour", "2h 30m")
 */
export function formatDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes < 1) {
    return '< 1 min'
  }

  if (minutes < 60) {
    return `${Math.round(minutes)} min`
  }

  if (minutes === 60) {
    return '1 hour'
  }

  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)

  if (mins === 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`
  }

  return `${hours}h ${mins}m`
}

/**
 * Format remaining time for countdown display
 * @param {number} remainingMs - Remaining time in milliseconds
 * @returns {string} - Formatted countdown (e.g., "1:23:45" or "23:45")
 */
export function formatCountdown(remainingMs) {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return '00:00'
  }

  const totalSeconds = Math.ceil(remainingMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const pad = n => n.toString().padStart(2, '0')

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`
  }

  return `${minutes}:${pad(seconds)}`
}

/**
 * Format time remaining in human-readable form
 * @param {number} minutes - Minutes remaining
 * @returns {string} - Formatted string (e.g., "47 min", "2h 15m")
 */
export function formatTimeRemaining(minutes) {
  if (!Number.isFinite(minutes) || minutes < 1) {
    return '< 1 min'
  }

  if (minutes < 60) {
    return `${Math.ceil(minutes)} min`
  }

  const hours = Math.floor(minutes / 60)
  const mins = Math.ceil(minutes % 60)

  if (mins === 0) {
    return `${hours}h`
  }

  return `${hours}h ${mins}m`
}

/**
 * Get today's date as YYYY-MM-DD string
 * @returns {string} - Date string
 */
export function getTodayKey() {
  return new Date().toISOString().split('T')[0]
}

/**
 * Get current time as HH:MM string
 * @returns {string} - Time string
 */
export function getCurrentTime() {
  return new Date().toTimeString().slice(0, 5)
}

/**
 * Get current day of week (0 = Sunday, 6 = Saturday)
 * @returns {number} - Day of week
 */
export function getCurrentDay() {
  return new Date().getDay()
}

/**
 * Parse time string (HH:MM) to minutes since midnight
 * @param {string} timeStr - Time string in HH:MM format
 * @returns {number} - Minutes since midnight
 */
export function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0

  const [hours, mins] = timeStr.split(':').map(Number)

  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return 0

  return hours * 60 + mins
}

/**
 * Check if current time is within a time window
 * @param {string} startTime - Start time (HH:MM)
 * @param {string} endTime - End time (HH:MM)
 * @returns {boolean} - True if current time is in window
 */
export function isInTimeWindow(startTime, endTime) {
  const current = parseTimeToMinutes(getCurrentTime())
  const start = parseTimeToMinutes(startTime)
  const end = parseTimeToMinutes(endTime)

  return current >= start && current < end
}

/**
 * Calculate minutes remaining until end time
 * @param {string} endTime - End time (HH:MM)
 * @returns {number} - Minutes remaining (0 if past end time)
 */
export function minutesUntilEndTime(endTime) {
  const current = parseTimeToMinutes(getCurrentTime())
  const end = parseTimeToMinutes(endTime)

  const remaining = end - current
  return remaining > 0 ? remaining : 0
}
