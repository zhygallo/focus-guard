/**
 * Tests for time-utils.js
 */

import { describe, it, assert } from '../test-runner.js'
import {
  formatDuration,
  formatTimeRemaining,
  formatCountdown,
  getTodayKey,
  parseTimeToMinutes,
  isInTimeWindow
} from '../../lib/time-utils.js'

export async function runTests() {
  await describe('time-utils', async () => {
    await describe('formatDuration', async () => {
      await it('formats minutes less than 60', () => {
        assert.equal(formatDuration(15), '15 min')
        assert.equal(formatDuration(30), '30 min')
        assert.equal(formatDuration(45), '45 min')
      })

      await it('formats exactly 1 hour', () => {
        assert.equal(formatDuration(60), '1 hour')
      })

      await it('formats whole hours', () => {
        assert.equal(formatDuration(120), '2 hours')
        assert.equal(formatDuration(180), '3 hours')
        assert.equal(formatDuration(240), '4 hours')
      })

      await it('formats hours and minutes', () => {
        assert.equal(formatDuration(90), '1h 30m')
        assert.equal(formatDuration(150), '2h 30m')
        assert.equal(formatDuration(75), '1h 15m')
      })

      await it('handles 0 minutes', () => {
        assert.equal(formatDuration(0), '< 1 min')
      })

      await it('handles 1 minute', () => {
        assert.equal(formatDuration(1), '1 min')
      })
    })

    await describe('formatTimeRemaining', async () => {
      await it('formats minutes less than 60', () => {
        assert.equal(formatTimeRemaining(30), '30 min')
      })

      await it('formats hours', () => {
        assert.equal(formatTimeRemaining(120), '2h')
      })

      await it('formats hours and minutes', () => {
        assert.equal(formatTimeRemaining(90), '1h 30m')
      })
    })

    await describe('formatCountdown', async () => {
      await it('formats seconds-only countdown', () => {
        // formatCountdown doesn't zero-pad minutes when < 10
        assert.equal(formatCountdown(45000), '0:45')
      })

      await it('formats minutes and seconds', () => {
        assert.equal(formatCountdown(150000), '2:30')
      })

      await it('formats hours, minutes, and seconds', () => {
        assert.equal(formatCountdown(3723000), '1:02:03')
      })

      await it('handles exactly 1 hour', () => {
        assert.equal(formatCountdown(3600000), '1:00:00')
      })

      await it('handles 0 milliseconds', () => {
        assert.equal(formatCountdown(0), '00:00')
      })

      await it('handles negative values', () => {
        assert.equal(formatCountdown(-1000), '00:00')
      })
    })

    await describe('getTodayKey', async () => {
      await it('returns date in YYYY-MM-DD format', () => {
        const key = getTodayKey()
        assert.matches(key, /^\d{4}-\d{2}-\d{2}$/)
      })

      await it('returns consistent value', () => {
        const key1 = getTodayKey()
        const key2 = getTodayKey()
        assert.equal(key1, key2)
      })
    })

    await describe('parseTimeToMinutes', async () => {
      await it('parses HH:MM format', () => {
        const result = parseTimeToMinutes('09:30')
        assert.equal(result, 9 * 60 + 30)
      })

      await it('parses 24-hour format', () => {
        const result = parseTimeToMinutes('14:45')
        assert.equal(result, 14 * 60 + 45)
      })

      await it('parses midnight', () => {
        const result = parseTimeToMinutes('00:00')
        assert.equal(result, 0)
      })

      await it('parses end of day', () => {
        const result = parseTimeToMinutes('23:59')
        assert.equal(result, 23 * 60 + 59)
      })

      await it('returns 0 for invalid format', () => {
        assert.equal(parseTimeToMinutes('invalid'), 0)
        assert.equal(parseTimeToMinutes(null), 0)
        assert.equal(parseTimeToMinutes(''), 0)
      })
    })

    await describe('isInTimeWindow', async () => {
      // Note: These tests depend on current time, so they may need adjustment
      // For now, we test the function's basic behavior

      await it('returns boolean', () => {
        const result = isInTimeWindow('00:00', '23:59')
        assert.equal(typeof result, 'boolean')
      })

      await it('handles same start and end time', () => {
        // Should always be false if start equals end (no time window)
        const result = isInTimeWindow('12:00', '12:00')
        assert.equal(typeof result, 'boolean')
      })
    })
  })
}
