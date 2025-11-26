/**
 * Tests for storage.js
 */

import { describe, it, assert } from '../test-runner.js'
import { resetMocks, getSyncStorage, getLocalStorage, setSyncStorage, setLocalStorage } from '../mocks/chrome.js'
import {
  withLock,
  getSyncData,
  setSyncData,
  updateSyncData,
  getLocalData,
  setLocalData,
  updateLocalData,
  getActiveBlocks,
  setActiveBlocks,
  updateActiveBlocks,
  getSchedules,
  setSchedules,
  getSettings,
  updateSettings,
  getStats,
  updateStats,
  getPendingUnblocks,
  updatePendingUnblocks
} from '../../lib/storage.js'

export async function runTests() {
  await describe('storage', async () => {
    // Reset mocks before each test suite
    await describe('withLock', async () => {
      await it('executes function with lock', async () => {
        resetMocks()
        let executed = false
        await withLock('test', async () => {
          executed = true
        })
        assert.equal(executed, true)
      })

      await it('returns function result', async () => {
        resetMocks()
        const result = await withLock('test', async () => 'result')
        assert.equal(result, 'result')
      })

      await it('prevents concurrent modifications to same key', async () => {
        resetMocks()
        const order = []

        // Start two concurrent operations
        const op1 = withLock('test', async () => {
          order.push('op1-start')
          await new Promise(r => setTimeout(r, 50))
          order.push('op1-end')
          return 'op1'
        })

        const op2 = withLock('test', async () => {
          order.push('op2-start')
          await new Promise(r => setTimeout(r, 10))
          order.push('op2-end')
          return 'op2'
        })

        await Promise.all([op1, op2])

        // op1 should complete before op2 starts
        assert.equal(order.indexOf('op1-end') < order.indexOf('op2-start'), true)
      })

      await it('allows concurrent access to different keys', async () => {
        resetMocks()
        const order = []

        const op1 = withLock('key1', async () => {
          order.push('op1-start')
          await new Promise(r => setTimeout(r, 50))
          order.push('op1-end')
        })

        const op2 = withLock('key2', async () => {
          order.push('op2-start')
          await new Promise(r => setTimeout(r, 10))
          order.push('op2-end')
        })

        await Promise.all([op1, op2])

        // op2 should complete before op1 (different keys, can run concurrently)
        assert.equal(order.indexOf('op2-end') < order.indexOf('op1-end'), true)
      })
    })

    await describe('sync storage', async () => {
      await it('gets undefined for missing key', async () => {
        resetMocks()
        const value = await getSyncData('nonexistent')
        assert.equal(value, undefined)
      })

      await it('sets and gets value', async () => {
        resetMocks()
        await setSyncData('test', { foo: 'bar' })
        const value = await getSyncData('test')
        assert.deepEqual(value, { foo: 'bar' })
      })

      await it('updates value atomically', async () => {
        resetMocks()
        await setSyncData('counter', 0)
        await updateSyncData('counter', (current) => current + 1, 0)
        const value = await getSyncData('counter')
        assert.equal(value, 1)
      })

      await it('uses default value in update if key missing', async () => {
        resetMocks()
        await updateSyncData('newkey', (current) => current + 1, 10)
        const value = await getSyncData('newkey')
        assert.equal(value, 11)
      })
    })

    await describe('local storage', async () => {
      await it('gets undefined for missing key', async () => {
        resetMocks()
        const value = await getLocalData('nonexistent')
        assert.equal(value, undefined)
      })

      await it('sets and gets value', async () => {
        resetMocks()
        await setLocalData('test', { foo: 'bar' })
        const value = await getLocalData('test')
        assert.deepEqual(value, { foo: 'bar' })
      })

      await it('updates value atomically', async () => {
        resetMocks()
        await setLocalData('counter', 0)
        await updateLocalData('counter', (current) => current + 1, 0)
        const value = await getLocalData('counter')
        assert.equal(value, 1)
      })
    })

    await describe('active blocks', async () => {
      await it('returns empty object when no blocks', async () => {
        resetMocks()
        const blocks = await getActiveBlocks()
        assert.deepEqual(blocks, {})
      })

      await it('sets and gets blocks', async () => {
        resetMocks()
        const block = { until: Date.now() + 60000, blockedAt: Date.now(), reason: 'manual' }
        await setActiveBlocks({ 'example.com': block })
        const blocks = await getActiveBlocks()
        assert.deepEqual(blocks['example.com'], block)
      })

      await it('updates blocks atomically', async () => {
        resetMocks()
        await updateActiveBlocks(blocks => {
          blocks['example.com'] = { until: 123, blockedAt: 100, reason: 'manual' }
          return blocks
        })
        const blocks = await getActiveBlocks()
        assert.equal(blocks['example.com'].until, 123)
      })
    })

    await describe('schedules', async () => {
      await it('returns empty array when no schedules', async () => {
        resetMocks()
        const schedules = await getSchedules()
        assert.deepEqual(schedules, [])
      })

      await it('sets and gets schedules', async () => {
        resetMocks()
        const schedule = { id: '1', domains: ['example.com'], startTime: '09:00', endTime: '17:00' }
        await setSchedules([schedule])
        const schedules = await getSchedules()
        assert.deepEqual(schedules[0], schedule)
      })
    })

    await describe('settings', async () => {
      await it('returns default settings when not set', async () => {
        resetMocks()
        const settings = await getSettings()
        assert.ok(settings.defaultBlockDuration)
        assert.ok(settings.unblockDelayBase)
      })

      await it('merges with defaults', async () => {
        resetMocks()
        setSyncStorage({ settings: { customSetting: true } })
        const settings = await getSettings()
        assert.equal(settings.customSetting, true)
        assert.ok(settings.defaultBlockDuration) // Default still present
      })

      await it('updates settings', async () => {
        resetMocks()
        await updateSettings(settings => {
          settings.defaultBlockDuration = 120
          return settings
        })
        const settings = await getSettings()
        assert.equal(settings.defaultBlockDuration, 120)
      })
    })

    await describe('stats', async () => {
      await it('returns default stats when not set', async () => {
        resetMocks()
        const stats = await getStats()
        assert.equal(stats.totalBlocksCreated, 0)
        assert.deepEqual(stats.blockedAttempts, {})
      })

      await it('updates stats', async () => {
        resetMocks()
        await updateStats(stats => {
          stats.totalBlocksCreated = 5
          return stats
        })
        const stats = await getStats()
        assert.equal(stats.totalBlocksCreated, 5)
      })
    })

    await describe('pending unblocks', async () => {
      await it('returns empty object when no pending', async () => {
        resetMocks()
        const pending = await getPendingUnblocks()
        assert.deepEqual(pending, {})
      })

      await it('updates pending unblocks', async () => {
        resetMocks()
        await updatePendingUnblocks(pending => {
          pending['example.com'] = { requestedAt: Date.now(), unlocksAt: Date.now() + 300000 }
          return pending
        })
        const pending = await getPendingUnblocks()
        assert.ok(pending['example.com'])
      })
    })
  })
}
