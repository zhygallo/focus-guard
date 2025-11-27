/**
 * Tests for errors.js
 */

import { describe, it, assert } from '../test-runner.js'
import {
  ErrorCodes,
  UserMessages,
  FocusGuardError,
  getUserMessage,
  successResponse,
  errorResponse,
  withErrorHandling
} from '../../lib/errors.js'

export async function runTests() {
  await describe('errors', async () => {
    await describe('ErrorCodes', async () => {
      await it('has validation error codes', () => {
        assert.ok(ErrorCodes.INVALID_DOMAIN)
        assert.ok(ErrorCodes.INVALID_DURATION)
        assert.ok(ErrorCodes.DURATION_TOO_SHORT)
        assert.ok(ErrorCodes.DURATION_TOO_LONG)
      })

      await it('has block error codes', () => {
        assert.ok(ErrorCodes.BLOCK_NOT_FOUND)
        assert.ok(ErrorCodes.ALREADY_BLOCKED)
        assert.ok(ErrorCodes.NOT_BLOCKABLE)
      })

      await it('has unblock error codes', () => {
        assert.ok(ErrorCodes.UNBLOCK_PENDING)
        assert.ok(ErrorCodes.UNBLOCK_DELAY_NOT_COMPLETE)
        assert.ok(ErrorCodes.NO_PENDING_UNBLOCK)
      })

      await it('has storage error codes', () => {
        assert.ok(ErrorCodes.STORAGE_READ_FAILED)
        assert.ok(ErrorCodes.STORAGE_WRITE_FAILED)
        assert.ok(ErrorCodes.STORAGE_LOCK_TIMEOUT)
      })
    })

    await describe('UserMessages', async () => {
      await it('has message for each error code', () => {
        Object.values(ErrorCodes).forEach(code => {
          assert.ok(UserMessages[code], `Missing message for ${code}`)
        })
      })

      await it('messages are user-friendly strings', () => {
        Object.values(UserMessages).forEach(message => {
          assert.equal(typeof message, 'string')
          assert.ok(message.length > 0)
        })
      })
    })

    await describe('FocusGuardError', async () => {
      await it('creates error with code and default message', () => {
        const error = new FocusGuardError(ErrorCodes.INVALID_DOMAIN)
        assert.equal(error.code, ErrorCodes.INVALID_DOMAIN)
        assert.equal(error.message, UserMessages[ErrorCodes.INVALID_DOMAIN])
        assert.instanceOf(error, Error)
      })

      await it('creates error with custom message', () => {
        const error = new FocusGuardError(ErrorCodes.INVALID_DOMAIN, 'Custom message')
        assert.equal(error.code, ErrorCodes.INVALID_DOMAIN)
        assert.equal(error.message, 'Custom message')
      })

      await it('creates error with details', () => {
        const error = new FocusGuardError(ErrorCodes.INVALID_DOMAIN, null, { field: 'domain' })
        assert.deepEqual(error.details, { field: 'domain' })
      })

      await it('converts to JSON', () => {
        const error = new FocusGuardError(ErrorCodes.INVALID_DOMAIN, 'Test', { foo: 'bar' })
        const json = error.toJSON()
        assert.equal(json.name, 'FocusGuardError')
        assert.equal(json.code, ErrorCodes.INVALID_DOMAIN)
        assert.equal(json.message, 'Test')
        assert.deepEqual(json.details, { foo: 'bar' })
      })

      await it('converts to response', () => {
        const error = new FocusGuardError(ErrorCodes.INVALID_DOMAIN, 'Test', { foo: 'bar' })
        const response = error.toResponse()
        assert.equal(response.success, false)
        assert.equal(response.error, 'Test')
        assert.equal(response.code, ErrorCodes.INVALID_DOMAIN)
        assert.deepEqual(response.details, { foo: 'bar' })
      })
    })

    await describe('getUserMessage', async () => {
      await it('returns message for valid code', () => {
        const message = getUserMessage(ErrorCodes.INVALID_DOMAIN)
        assert.equal(message, UserMessages[ErrorCodes.INVALID_DOMAIN])
      })

      await it('returns unknown error message for invalid code', () => {
        const message = getUserMessage('invalid_code')
        assert.equal(message, UserMessages[ErrorCodes.UNKNOWN_ERROR])
      })
    })

    await describe('successResponse', async () => {
      await it('creates response with success true', () => {
        const response = successResponse()
        assert.equal(response.success, true)
      })

      await it('merges additional data', () => {
        const response = successResponse({ domain: 'example.com', id: 123 })
        assert.equal(response.success, true)
        assert.equal(response.domain, 'example.com')
        assert.equal(response.id, 123)
      })
    })

    await describe('errorResponse', async () => {
      await it('creates response with success false', () => {
        const response = errorResponse(ErrorCodes.INVALID_DOMAIN)
        assert.equal(response.success, false)
        assert.equal(response.code, ErrorCodes.INVALID_DOMAIN)
        assert.equal(response.error, UserMessages[ErrorCodes.INVALID_DOMAIN])
      })

      await it('includes additional details', () => {
        const response = errorResponse(ErrorCodes.INVALID_DOMAIN, { field: 'domain' })
        assert.equal(response.field, 'domain')
      })
    })

    await describe('withErrorHandling', async () => {
      await it('returns result on success', async () => {
        const fn = async () => ({ success: true, data: 'test' })
        const wrapped = withErrorHandling(fn)
        const result = await wrapped()
        assert.deepEqual(result, { success: true, data: 'test' })
      })

      await it('converts FocusGuardError to response', async () => {
        const fn = async () => {
          throw new FocusGuardError(ErrorCodes.INVALID_DOMAIN)
        }
        const wrapped = withErrorHandling(fn)
        const result = await wrapped()
        assert.equal(result.success, false)
        assert.equal(result.code, ErrorCodes.INVALID_DOMAIN)
      })

      await it('converts unknown error to response', async () => {
        // Temporarily suppress console.error for this test
        const originalError = console.error
        console.error = () => {}

        const fn = async () => {
          throw new Error('Something went wrong')
        }
        const wrapped = withErrorHandling(fn)
        const result = await wrapped()

        console.error = originalError
        assert.equal(result.success, false)
        assert.equal(result.code, ErrorCodes.UNKNOWN_ERROR)
      })

      await it('passes arguments to wrapped function', async () => {
        const fn = async (a, b) => ({ success: true, sum: a + b })
        const wrapped = withErrorHandling(fn)
        const result = await wrapped(2, 3)
        assert.equal(result.sum, 5)
      })
    })
  })
}
