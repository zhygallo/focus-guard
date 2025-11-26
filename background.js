/**
 * FocusGuard - Background Service Worker
 * Core blocking logic and message handling
 */

// ============================================
// INITIALIZATION
// ============================================

chrome.runtime.onInstalled.addListener(async () => {
  console.log('FocusGuard installed')
  
  // Initialize storage with defaults
  const { activeBlocks } = await chrome.storage.sync.get('activeBlocks')
  if (!activeBlocks) {
    await chrome.storage.sync.set({ activeBlocks: {} })
  }
  
  const { schedules } = await chrome.storage.sync.get('schedules')
  if (!schedules) {
    await chrome.storage.sync.set({ schedules: [] })
  }
  
  const { settings } = await chrome.storage.sync.get('settings')
  if (!settings) {
    await chrome.storage.sync.set({
      settings: {
        defaultBlockDuration: 60,
        unblockDelayBase: 5,
        unblockDelayEscalation: true,
        showMotivationalQuotes: true
      }
    })
  }
  
  const { stats } = await chrome.storage.local.get('stats')
  if (!stats) {
    await chrome.storage.local.set({
      stats: {
        totalBlocksCreated: 0,
        blockedAttempts: {},
        siteAttempts: {},
        streakStartDate: null,
        lastActiveDate: null
      }
    })
  }
  
  const { pendingUnblocks } = await chrome.storage.local.get('pendingUnblocks')
  if (!pendingUnblocks) {
    await chrome.storage.local.set({ pendingUnblocks: {} })
  }
})

// ============================================
// TAB MONITORING
// ============================================

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, _tab) => {
  if (changeInfo.url) {
    await checkAndBlockUrl(tabId, changeInfo.url)
  }
})

chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.url) {
    await checkAndBlockUrl(tab.id, tab.url)
  }
})

// ============================================
// CORE BLOCKING LOGIC
// ============================================

async function checkAndBlockUrl(tabId, url) {
  const domain = extractDomain(url)
  if (!domain) return
  
  // Don't block extension pages or chrome:// URLs
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
    return
  }
  
  const isBlocked = await isDomainBlocked(domain)
  
  if (isBlocked) {
    // Record blocked attempt
    await recordBlockedAttempt(domain)
    
    // Redirect to block page
    const { activeBlocks } = await chrome.storage.sync.get('activeBlocks')
    const blockInfo = activeBlocks[domain]
    
    const blockedUrl = chrome.runtime.getURL('blocked/blocked.html') +
      `?domain=${encodeURIComponent(domain)}` +
      `&until=${blockInfo.until}`
    
    chrome.tabs.update(tabId, { url: blockedUrl })
  }
}

async function isDomainBlocked(domain) {
  const { activeBlocks = {} } = await chrome.storage.sync.get('activeBlocks')
  
  // Check if domain is in active blocks
  if (activeBlocks[domain]) {
    const blockInfo = activeBlocks[domain]
    
    // Check if block has expired
    if (Date.now() >= blockInfo.until) {
      // Remove expired block
      delete activeBlocks[domain]
      await chrome.storage.sync.set({ activeBlocks })
      return false
    }
    
    return true
  }
  
  // Check parent domain (e.g., www.youtube.com → youtube.com)
  const parentDomain = domain.replace(/^[^.]+\./, '')
  if (parentDomain !== domain && activeBlocks[parentDomain]) {
    const blockInfo = activeBlocks[parentDomain]
    if (Date.now() < blockInfo.until) {
      return true
    }
  }
  
  return false
}

function extractDomain(url) {
  try {
    const hostname = new URL(url).hostname
    return hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

// ============================================
// BLOCK MANAGEMENT
// ============================================

async function addBlock(domain, minutes, reason = 'manual') {
  const { activeBlocks = {} } = await chrome.storage.sync.get('activeBlocks')
  
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase()
  
  activeBlocks[cleanDomain] = {
    until: Date.now() + (minutes * 60 * 1000),
    blockedAt: Date.now(),
    reason: reason
  }
  
  await chrome.storage.sync.set({ activeBlocks })
  
  // Update stats
  const { stats } = await chrome.storage.local.get('stats')
  stats.totalBlocksCreated = (stats.totalBlocksCreated || 0) + 1
  await chrome.storage.local.set({ stats })
  
  // Close any open tabs with this domain
  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    if (tab.url) {
      const tabDomain = extractDomain(tab.url)
      if (tabDomain === cleanDomain || tabDomain === `www.${cleanDomain}`) {
        const blockedUrl = chrome.runtime.getURL('blocked/blocked.html') +
          `?domain=${encodeURIComponent(cleanDomain)}` +
          `&until=${activeBlocks[cleanDomain].until}`
        chrome.tabs.update(tab.id, { url: blockedUrl })
      }
    }
  }
  
  return { success: true }
}

async function removeBlock(domain) {
  const { activeBlocks = {} } = await chrome.storage.sync.get('activeBlocks')
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase()
  
  delete activeBlocks[cleanDomain]
  await chrome.storage.sync.set({ activeBlocks })
  
  // Also clear any pending unblock
  const { pendingUnblocks = {} } = await chrome.storage.local.get('pendingUnblocks')
  delete pendingUnblocks[cleanDomain]
  await chrome.storage.local.set({ pendingUnblocks })
  
  return { success: true }
}

async function getBlocks() {
  const { activeBlocks = {} } = await chrome.storage.sync.get('activeBlocks')
  
  // Clean up expired blocks while we're at it
  let hasExpired = false
  for (const [domain, info] of Object.entries(activeBlocks)) {
    if (Date.now() >= info.until) {
      delete activeBlocks[domain]
      hasExpired = true
    }
  }
  
  if (hasExpired) {
    await chrome.storage.sync.set({ activeBlocks })
  }
  
  return activeBlocks
}

// ============================================
// DELAYED UNBLOCK (ANTI-CHEAT)
// ============================================

async function requestUnblock(domain) {
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase()
  const { pendingUnblocks = {} } = await chrome.storage.local.get('pendingUnblocks')
  const { settings } = await chrome.storage.sync.get('settings')
  
  // Check if already pending
  if (pendingUnblocks[cleanDomain]) {
    const remaining = Math.ceil((pendingUnblocks[cleanDomain].unlocksAt - Date.now()) / 1000)
    if (remaining > 0) {
      return { success: false, error: 'already_pending', remainingTime: remaining }
    }
  }
  
  // Calculate delay based on attempt number
  const today = new Date().toDateString()
  const attemptKey = `${cleanDomain}_${today}`
  const { dailyAttempts = {} } = await chrome.storage.local.get('dailyAttempts')
  
  const attemptNumber = (dailyAttempts[attemptKey] || 0) + 1
  dailyAttempts[attemptKey] = attemptNumber
  await chrome.storage.local.set({ dailyAttempts })
  
  // Escalating delay: 5min → 10min → 15min
  let delayMinutes = settings.unblockDelayBase || 5
  if (settings.unblockDelayEscalation && attemptNumber > 1) {
    delayMinutes = Math.min(15, delayMinutes + (attemptNumber - 1) * 5)
  }
  
  const waitTimeSeconds = delayMinutes * 60
  
  pendingUnblocks[cleanDomain] = {
    requestedAt: Date.now(),
    unlocksAt: Date.now() + (waitTimeSeconds * 1000),
    attemptNumber: attemptNumber
  }
  
  await chrome.storage.local.set({ pendingUnblocks })
  
  // Set an alarm to notify when unblock is ready
  chrome.alarms.create(`unblock_${cleanDomain}`, {
    when: pendingUnblocks[cleanDomain].unlocksAt
  })
  
  return { success: true, waitTime: waitTimeSeconds }
}

async function cancelUnblock(domain) {
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase()
  const { pendingUnblocks = {} } = await chrome.storage.local.get('pendingUnblocks')
  
  delete pendingUnblocks[cleanDomain]
  await chrome.storage.local.set({ pendingUnblocks })
  
  // Cancel the alarm
  chrome.alarms.clear(`unblock_${cleanDomain}`)
  
  return { success: true }
}

async function confirmUnblock(domain) {
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase()
  const { pendingUnblocks = {} } = await chrome.storage.local.get('pendingUnblocks')
  
  // Check if delay has passed
  if (pendingUnblocks[cleanDomain]) {
    if (Date.now() < pendingUnblocks[cleanDomain].unlocksAt) {
      const remaining = Math.ceil((pendingUnblocks[cleanDomain].unlocksAt - Date.now()) / 1000)
      return { success: false, error: 'delay_not_complete', remainingTime: remaining }
    }
  }
  
  // Remove the block
  await removeBlock(cleanDomain)
  
  return { success: true }
}

async function getPendingUnblocks() {
  const { pendingUnblocks = {} } = await chrome.storage.local.get('pendingUnblocks')
  
  // Clean up expired pending unblocks
  let hasExpired = false
  for (const [domain, info] of Object.entries(pendingUnblocks)) {
    if (Date.now() >= info.unlocksAt + (60 * 60 * 1000)) { // Expired + 1 hour grace
      delete pendingUnblocks[domain]
      hasExpired = true
    }
  }
  
  if (hasExpired) {
    await chrome.storage.local.set({ pendingUnblocks })
  }
  
  return pendingUnblocks
}

// ============================================
// STATISTICS
// ============================================

async function recordBlockedAttempt(domain) {
  const { stats } = await chrome.storage.local.get('stats')
  
  const today = new Date().toISOString().split('T')[0]
  
  // Daily attempts
  stats.blockedAttempts = stats.blockedAttempts || {}
  stats.blockedAttempts[today] = (stats.blockedAttempts[today] || 0) + 1
  
  // Per-site attempts
  stats.siteAttempts = stats.siteAttempts || {}
  stats.siteAttempts[domain] = (stats.siteAttempts[domain] || 0) + 1
  
  // Update streak
  stats.lastActiveDate = today
  if (!stats.streakStartDate) {
    stats.streakStartDate = today
  }
  
  await chrome.storage.local.set({ stats })
}

async function getStats() {
  const { stats } = await chrome.storage.local.get('stats')
  return stats || {
    totalBlocksCreated: 0,
    blockedAttempts: {},
    siteAttempts: {},
    streakStartDate: null,
    lastActiveDate: null
  }
}

// ============================================
// SCHEDULES
// ============================================

async function addSchedule(schedule) {
  const { schedules = [] } = await chrome.storage.sync.get('schedules')
  
  const newSchedule = {
    id: `sch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    domains: schedule.domains || [],
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    days: schedule.days || [1, 2, 3, 4, 5], // Mon-Fri default
    enabled: true,
    createdAt: Date.now()
  }
  
  schedules.push(newSchedule)
  await chrome.storage.sync.set({ schedules })
  
  // Set up alarm to check schedules
  setupScheduleAlarms()
  
  return { success: true, id: newSchedule.id }
}

async function deleteSchedule(id) {
  const { schedules = [] } = await chrome.storage.sync.get('schedules')
  const filtered = schedules.filter(s => s.id !== id)
  await chrome.storage.sync.set({ schedules: filtered })
  return { success: true }
}

async function toggleSchedule(id, enabled) {
  const { schedules = [] } = await chrome.storage.sync.get('schedules')
  const schedule = schedules.find(s => s.id === id)
  if (schedule) {
    schedule.enabled = enabled
    await chrome.storage.sync.set({ schedules })
  }
  return { success: true }
}

async function getSchedules() {
  const { schedules = [] } = await chrome.storage.sync.get('schedules')
  return schedules
}

function setupScheduleAlarms() {
  // Check schedules every minute
  chrome.alarms.create('checkSchedules', { periodInMinutes: 1 })
}

async function checkSchedules() {
  const { schedules = [] } = await chrome.storage.sync.get('schedules')
  const now = new Date()
  const currentDay = now.getDay() // 0 = Sunday
  const currentTime = now.toTimeString().slice(0, 5) // "HH:MM"
  
  for (const schedule of schedules) {
    if (!schedule.enabled) continue
    if (!schedule.days.includes(currentDay)) continue
    
    const isInWindow = currentTime >= schedule.startTime && currentTime < schedule.endTime
    
    if (isInWindow) {
      // Activate blocks for scheduled domains
      for (const domain of schedule.domains) {
        const { activeBlocks = {} } = await chrome.storage.sync.get('activeBlocks')
        
        // Only add if not already blocked or if our block would extend it
        if (!activeBlocks[domain] || activeBlocks[domain].reason !== 'schedule') {
          // Calculate remaining time in schedule window
          const [endHour, endMin] = schedule.endTime.split(':').map(Number)
          const endDate = new Date(now)
          endDate.setHours(endHour, endMin, 0, 0)
          const remainingMinutes = Math.ceil((endDate - now) / 60000)
          
          if (remainingMinutes > 0) {
            await addBlock(domain, remainingMinutes, 'schedule')
          }
        }
      }
    }
  }
}

// ============================================
// ALARM HANDLERS
// ============================================

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkSchedules') {
    await checkSchedules()
  } else if (alarm.name.startsWith('unblock_')) {
    // Unblock delay completed - could notify user here
    const domain = alarm.name.replace('unblock_', '')
    console.log(`Unblock delay completed for ${domain}`)
  }
})

// Set up schedule checking on startup
setupScheduleAlarms()

// ============================================
// MESSAGE HANDLER
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    addBlock: () => addBlock(message.domain, message.minutes, message.reason),
    removeBlock: () => removeBlock(message.domain),
    getBlocks: () => getBlocks(),
    requestUnblock: () => requestUnblock(message.domain),
    cancelUnblock: () => cancelUnblock(message.domain),
    confirmUnblock: () => confirmUnblock(message.domain),
    getPendingUnblocks: () => getPendingUnblocks(),
    getStats: () => getStats(),
    addSchedule: () => addSchedule(message.schedule),
    deleteSchedule: () => deleteSchedule(message.id),
    toggleSchedule: () => toggleSchedule(message.id, message.enabled),
    getSchedules: () => getSchedules()
  }
  
  const handler = handlers[message.action]
  
  if (handler) {
    handler().then(sendResponse).catch(err => {
      console.error(`Error handling ${message.action}:`, err)
      sendResponse({ success: false, error: err.message })
    })
    return true // Async response
  }
  
  sendResponse({ success: false, error: 'Unknown action' })
  return false
})

console.log('FocusGuard background service worker loaded')
