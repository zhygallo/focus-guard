/**
 * Tests for validation.js
 */

import { describe, it, assert } from '../test-runner.js'
import {
  validateDomain,
  validateDuration,
  validateSchedule
} from '../../lib/validation.js'
import { ErrorCodes } from '../../lib/errors.js'

export async function runTests() {
  await describe('validation', async () => {
    await describe('validateDomain', async () => {
      await it('accepts valid domain', () => {
        const result = validateDomain('example.com')
        assert.equal(result.valid, true)
        assert.equal(result.value, 'example.com')
      })

      await it('accepts domain with subdomain', () => {
        const result = validateDomain('sub.example.com')
        assert.equal(result.valid, true)
        assert.equal(result.value, 'sub.example.com')
      })

      await it('cleans domain from URL', () => {
        const result = validateDomain('https://example.com/path')
        assert.equal(result.valid, true)
        assert.equal(result.value, 'example.com')
      })

      await it('removes www prefix', () => {
        const result = validateDomain('www.example.com')
        assert.equal(result.valid, true)
        assert.equal(result.value, 'example.com')
      })

      await it('rejects empty string', () => {
        const result = validateDomain('')
        assert.equal(result.valid, false)
        assert.equal(result.errors[0].code, ErrorCodes.INVALID_DOMAIN)
      })

      await it('rejects null', () => {
        const result = validateDomain(null)
        assert.equal(result.valid, false)
        assert.equal(result.errors[0].code, ErrorCodes.INVALID_DOMAIN)
      })

      await it('rejects domain without TLD', () => {
        const result = validateDomain('example')
        assert.equal(result.valid, false)
        assert.equal(result.errors[0].code, ErrorCodes.INVALID_DOMAIN)
      })

      await it('rejects invalid characters', () => {
        const result = validateDomain('exam ple.com')
        assert.equal(result.valid, false)
      })
    })

    await describe('validateDuration', async () => {
      await it('accepts valid duration', () => {
        const result = validateDuration(60)
        assert.equal(result.valid, true)
        assert.equal(result.value, 60)
      })

      await it('accepts minimum duration (1 minute)', () => {
        const result = validateDuration(1)
        assert.equal(result.valid, true)
        assert.equal(result.value, 1)
      })

      await it('accepts maximum duration (480 minutes)', () => {
        const result = validateDuration(480)
        assert.equal(result.valid, true)
        assert.equal(result.value, 480)
      })

      await it('coerces string to number', () => {
        const result = validateDuration('60')
        assert.equal(result.valid, true)
        assert.equal(result.value, 60)
      })

      await it('rejects zero duration', () => {
        const result = validateDuration(0)
        assert.equal(result.valid, false)
        assert.equal(result.errors[0].code, ErrorCodes.DURATION_TOO_SHORT)
      })

      await it('rejects negative duration', () => {
        const result = validateDuration(-10)
        assert.equal(result.valid, false)
        assert.equal(result.errors[0].code, ErrorCodes.DURATION_TOO_SHORT)
      })

      await it('rejects duration over 480 minutes', () => {
        const result = validateDuration(481)
        assert.equal(result.valid, false)
        assert.equal(result.errors[0].code, ErrorCodes.DURATION_TOO_LONG)
      })

      await it('rejects non-numeric string', () => {
        const result = validateDuration('abc')
        assert.equal(result.valid, false)
        assert.equal(result.errors[0].code, ErrorCodes.INVALID_DURATION)
      })

      await it('rejects null', () => {
        const result = validateDuration(null)
        assert.equal(result.valid, false)
        assert.equal(result.errors[0].code, ErrorCodes.INVALID_DURATION)
      })
    })

    await describe('validateSchedule', async () => {
      await it('accepts valid schedule', () => {
        const schedule = {
          domains: ['example.com'],
          startTime: '09:00',
          endTime: '17:00',
          days: [1, 2, 3, 4, 5],
          enabled: true
        }
        const result = validateSchedule(schedule)
        assert.equal(result.valid, true)
        assert.isNotNull(result.value)
        assert.deepEqual(result.value.domains, ['example.com'])
      })

      await it('validates domains in schedule', () => {
        const schedule = {
          domains: ['example.com'],
          startTime: '09:00',
          endTime: '17:00',
          days: [1],
          enabled: true
        }
        const result = validateSchedule(schedule)
        assert.equal(result.valid, true)
        assert.deepEqual(result.value.domains, ['example.com'])
      })

      await it('preserves existing properties', () => {
        const schedule = {
          id: 'existing-id',
          domains: ['example.com'],
          startTime: '09:00',
          endTime: '17:00',
          days: [1],
          enabled: true
        }
        const result = validateSchedule(schedule)
        assert.equal(result.valid, true)
        assert.equal(result.value.id, 'existing-id')
      })

      await it('rejects empty domains array', () => {
        const schedule = {
          domains: [],
          startTime: '09:00',
          endTime: '17:00',
          days: [1],
          enabled: true
        }
        const result = validateSchedule(schedule)
        assert.equal(result.valid, false)
        assert.equal(result.errors[0].code, ErrorCodes.SCHEDULE_NO_DOMAINS)
      })

      await it('rejects empty days array', () => {
        const schedule = {
          domains: ['example.com'],
          startTime: '09:00',
          endTime: '17:00',
          days: [],
          enabled: true
        }
        const result = validateSchedule(schedule)
        assert.equal(result.valid, false)
        assert.equal(result.errors[0].code, ErrorCodes.SCHEDULE_NO_DAYS)
      })

      await it('rejects invalid start time', () => {
        const schedule = {
          domains: ['example.com'],
          startTime: 'invalid',
          endTime: '17:00',
          days: [1],
          enabled: true
        }
        const result = validateSchedule(schedule)
        assert.equal(result.valid, false)
        assert.equal(result.errors[0].code, ErrorCodes.SCHEDULE_INVALID_TIME)
      })

      await it('rejects invalid end time', () => {
        const schedule = {
          domains: ['example.com'],
          startTime: '09:00',
          endTime: 'invalid',
          days: [1],
          enabled: true
        }
        const result = validateSchedule(schedule)
        assert.equal(result.valid, false)
        assert.equal(result.errors[0].code, ErrorCodes.SCHEDULE_INVALID_TIME)
      })

      await it('validates domains within schedule', () => {
        const schedule = {
          domains: ['example.com', 'invalid'],
          startTime: '09:00',
          endTime: '17:00',
          days: [1],
          enabled: true
        }
        const result = validateSchedule(schedule)
        assert.equal(result.valid, false)
        assert.equal(result.errors[0].code, ErrorCodes.INVALID_DOMAIN)
      })
    })
  })
}
