/**
 * FocusGuard - Block Page Script
 * Handles the blocked site display and unblock flow with memory leak fixes
 */

import { formatCountdown } from '../lib/time-utils.js'
import { api } from '../lib/messaging.js'

// ============================================
// STATE & CLEANUP
// ============================================

let blockedDomain = null
let blockUntil = null
let pendingUnblock = null

// Interval registry for cleanup
const intervals = []

function registerInterval(id) {
  intervals.push(id)
  return id
}

function clearAllIntervals() {
  intervals.forEach(clearInterval)
  intervals.length = 0
}

// Clean up on page unload
window.addEventListener('unload', clearAllIntervals)

// ============================================
// QUOTES (loaded from JSON)
// ============================================

let quotes = []

async function loadQuotes() {
  try {
    const response = await fetch(chrome.runtime.getURL('data/quotes.json'))
    quotes = await response.json()
  } catch (error) {
    // Fallback quotes if JSON fails to load
    quotes = [
      { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
      { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
      { text: "Where focus goes, energy flows.", author: "Tony Robbins" }
    ]
  }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  await loadQuotes()
  parseUrlParams()
  displayQuote()
  setupEventListeners()
  startTimers()
  await checkPendingUnblock()
})

function parseUrlParams() {
  const params = new URLSearchParams(window.location.search)
  blockedDomain = params.get('domain')
  const untilParam = params.get('until')
  blockUntil = untilParam ? parseInt(untilParam, 10) : null

  if (blockedDomain) {
    document.getElementById('blockedDomain').textContent = blockedDomain
    document.title = `${blockedDomain} Blocked - FocusGuard`
  }
}

function displayQuote() {
  if (quotes.length === 0) return

  const quote = quotes[Math.floor(Math.random() * quotes.length)]
  const textEl = document.querySelector('.quote-text')
  const authorEl = document.querySelector('.quote-author')

  if (textEl) textEl.textContent = `"${quote.text}"`
  if (authorEl) authorEl.textContent = `— ${quote.author}`
}

// ============================================
// TIMERS
// ============================================

function startTimers() {
  updateBlockTimer()
  registerInterval(setInterval(updateBlockTimer, 1000))
}

function updateBlockTimer() {
  if (!blockUntil) return

  const remaining = blockUntil - Date.now()

  if (remaining <= 0) {
    // Block expired - redirect to the site
    clearAllIntervals()
    document.getElementById('timer').textContent = '00:00'

    // Wait a moment then redirect
    setTimeout(() => {
      if (blockedDomain) {
        window.location.href = `https://${blockedDomain}`
      }
    }, 1000)
    return
  }

  document.getElementById('timer').textContent = formatCountdown(remaining)
}

// ============================================
// PENDING UNBLOCK
// ============================================

async function checkPendingUnblock() {
  if (!blockedDomain) return

  const response = await api.getPendingUnblocks()

  if (response.success === false) return

  if (response[blockedDomain]) {
    pendingUnblock = response[blockedDomain]
    showPendingSection()
    startPendingTimer()
  }
}

function showPendingSection() {
  const actions = document.querySelector('.actions')
  const pending = document.getElementById('pendingSection')

  if (actions) actions.classList.add('hidden')
  if (pending) pending.classList.remove('hidden')
}

function hidePendingSection() {
  const actions = document.querySelector('.actions')
  const pending = document.getElementById('pendingSection')

  if (actions) actions.classList.remove('hidden')
  if (pending) pending.classList.add('hidden')

  pendingUnblock = null
}

function startPendingTimer() {
  updatePendingTimer()
  registerInterval(setInterval(updatePendingTimer, 1000))
}

function updatePendingTimer() {
  if (!pendingUnblock) return

  const remaining = pendingUnblock.unlocksAt - Date.now()

  if (remaining <= 0) {
    // Delay complete - show unblock button
    const timerEl = document.getElementById('pendingTimer')
    const messageEl = document.querySelector('.pending-message span:last-child')
    const iconEl = document.querySelector('.pending-icon')
    const cancelBtn = document.getElementById('cancelUnblock')
    const confirmBtn = document.getElementById('confirmUnblock')

    if (timerEl) timerEl.textContent = 'Ready!'
    if (messageEl) messageEl.textContent = 'You can now unblock this site.'
    if (iconEl) {
      iconEl.textContent = '✓'
      iconEl.style.animation = 'none'
    }
    if (cancelBtn) cancelBtn.classList.add('hidden')
    if (confirmBtn) confirmBtn.classList.remove('hidden')
    return
  }

  const timerEl = document.getElementById('pendingTimer')
  if (timerEl) {
    timerEl.textContent = formatCountdown(remaining)
  }
}

// ============================================
// EVENT HANDLERS
// ============================================

function setupEventListeners() {
  // Close tab
  const closeBtn = document.getElementById('closeTab')
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      window.close()
    })
  }

  // Request unblock
  const requestBtn = document.getElementById('requestUnblock')
  if (requestBtn) {
    requestBtn.addEventListener('click', handleRequestUnblock)
  }

  // Cancel unblock
  const cancelBtn = document.getElementById('cancelUnblock')
  if (cancelBtn) {
    cancelBtn.addEventListener('click', handleCancelUnblock)
  }

  // Confirm unblock
  const confirmBtn = document.getElementById('confirmUnblock')
  if (confirmBtn) {
    confirmBtn.addEventListener('click', handleConfirmUnblock)
  }
}

async function handleRequestUnblock() {
  if (!blockedDomain) return

  const response = await api.requestUnblock(blockedDomain)

  if (response.success) {
    pendingUnblock = {
      unlocksAt: Date.now() + (response.waitTime * 1000)
    }
    showPendingSection()
    startPendingTimer()
  } else if (response.code === 'unblock_pending' && response.details?.remainingTime) {
    // Already pending - show the section with remaining time
    pendingUnblock = {
      unlocksAt: Date.now() + (response.details.remainingTime * 1000)
    }
    showPendingSection()
    startPendingTimer()
  } else {
    showToast(response.error || 'Failed to request unblock', 'error')
  }
}

async function handleCancelUnblock() {
  if (!blockedDomain) return

  const response = await api.cancelUnblock(blockedDomain)
  if (response.success) {
    hidePendingSection()
  } else {
    showToast(response.error || 'Failed to cancel', 'error')
  }
}

async function handleConfirmUnblock() {
  if (!blockedDomain) return

  const response = await api.confirmUnblock(blockedDomain)

  if (response.success) {
    // Redirect to the site
    window.location.href = `https://${blockedDomain}`
  } else if (response.code === 'unblock_delay_not_complete') {
    const remaining = Math.ceil((response.details?.remainingTime || 0) / 60)
    showToast(`Wait ${remaining} more minute${remaining !== 1 ? 's' : ''}`, 'error')
  } else {
    showToast(response.error || 'Failed to unblock', 'error')
  }
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast')
  toast.textContent = message
  toast.className = `toast ${type} show`

  setTimeout(() => {
    toast.classList.remove('show')
  }, 3000)
}
