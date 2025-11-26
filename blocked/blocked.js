/**
 * FocusGuard - Block Page Script
 * Handles the blocked site display and unblock flow
 */

// ============================================
// STATE
// ============================================

let blockedDomain = null
let blockUntil = null
let pendingUnblock = null
let timerInterval = null
let pendingInterval = null

// ============================================
// QUOTES
// ============================================

const quotes = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "It's not that I'm so smart, it's just that I stay with problems longer.", author: "Albert Einstein" },
  { text: "The successful warrior is the average man, with laser-like focus.", author: "Bruce Lee" },
  { text: "Concentrate all your thoughts upon the work at hand.", author: "Alexander Graham Bell" },
  { text: "Where focus goes, energy flows.", author: "Tony Robbins" },
  { text: "The main thing is to keep the main thing the main thing.", author: "Stephen Covey" },
  { text: "You can't depend on your eyes when your imagination is out of focus.", author: "Mark Twain" },
  { text: "Lack of direction, not lack of time, is the problem.", author: "Zig Ziglar" },
  { text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { text: "Your focus determines your reality.", author: "George Lucas" },
  { text: "Simplicity boils down to two steps: Identify the essential. Eliminate the rest.", author: "Leo Babauta" },
  { text: "Until we can manage time, we can manage nothing else.", author: "Peter Drucker" }
]

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  parseUrlParams()
  displayQuote()
  setupEventListeners()
  startTimers()
  checkPendingUnblock()
})

function parseUrlParams() {
  const params = new URLSearchParams(window.location.search)
  blockedDomain = params.get('domain')
  blockUntil = parseInt(params.get('until'))
  
  if (blockedDomain) {
    document.getElementById('blockedDomain').textContent = blockedDomain
  }
  
  // Update page title
  document.title = `${blockedDomain} Blocked - FocusGuard`
}

function displayQuote() {
  const quote = quotes[Math.floor(Math.random() * quotes.length)]
  document.querySelector('.quote-text').textContent = `"${quote.text}"`
  document.querySelector('.quote-author').textContent = `— ${quote.author}`
}

// ============================================
// TIMERS
// ============================================

function startTimers() {
  updateBlockTimer()
  timerInterval = setInterval(updateBlockTimer, 1000)
}

function updateBlockTimer() {
  if (!blockUntil) return
  
  const now = Date.now()
  const remaining = blockUntil - now
  
  if (remaining <= 0) {
    // Block expired - redirect to the site
    clearInterval(timerInterval)
    document.getElementById('timer').textContent = '00:00'
    
    // Wait a moment then redirect
    setTimeout(() => {
      window.location.href = `https://${blockedDomain}`
    }, 1000)
    return
  }
  
  // Format remaining time
  const hours = Math.floor(remaining / 3600000)
  const minutes = Math.floor((remaining % 3600000) / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)
  
  let timeString
  if (hours > 0) {
    timeString = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  } else {
    timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
  
  document.getElementById('timer').textContent = timeString
}

// ============================================
// PENDING UNBLOCK
// ============================================

async function checkPendingUnblock() {
  const pending = await sendMessage({ action: 'getPendingUnblocks' })
  
  if (pending[blockedDomain]) {
    pendingUnblock = pending[blockedDomain]
    showPendingSection()
    startPendingTimer()
  }
}

function showPendingSection() {
  document.querySelector('.actions').classList.add('hidden')
  document.getElementById('pendingSection').classList.remove('hidden')
}

function hidePendingSection() {
  document.querySelector('.actions').classList.remove('hidden')
  document.getElementById('pendingSection').classList.add('hidden')
  
  if (pendingInterval) {
    clearInterval(pendingInterval)
    pendingInterval = null
  }
}

function startPendingTimer() {
  updatePendingTimer()
  pendingInterval = setInterval(updatePendingTimer, 1000)
}

function updatePendingTimer() {
  if (!pendingUnblock) return
  
  const now = Date.now()
  const remaining = pendingUnblock.unlocksAt - now
  
  if (remaining <= 0) {
    // Delay complete - show unblock button
    clearInterval(pendingInterval)
    document.getElementById('pendingTimer').textContent = 'Ready!'
    document.querySelector('.pending-message span:last-child').textContent = 'You can now unblock this site.'
    document.querySelector('.pending-icon').textContent = '✓'
    document.querySelector('.pending-icon').style.animation = 'none'
    
    document.getElementById('cancelUnblock').classList.add('hidden')
    document.getElementById('confirmUnblock').classList.remove('hidden')
    return
  }
  
  // Format remaining time
  const minutes = Math.floor(remaining / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)
  
  document.getElementById('pendingTimer').textContent = 
    `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// ============================================
// EVENT HANDLERS
// ============================================

function setupEventListeners() {
  // Close tab
  document.getElementById('closeTab').addEventListener('click', () => {
    window.close()
  })
  
  // Request unblock
  document.getElementById('requestUnblock').addEventListener('click', async () => {
    const response = await sendMessage({
      action: 'requestUnblock',
      domain: blockedDomain
    })
    
    if (response.success) {
      pendingUnblock = {
        unlocksAt: Date.now() + (response.waitTime * 1000)
      }
      showPendingSection()
      startPendingTimer()
    } else if (response.error === 'already_pending') {
      // Already pending - show the section
      pendingUnblock = {
        unlocksAt: Date.now() + (response.remainingTime * 1000)
      }
      showPendingSection()
      startPendingTimer()
    }
  })
  
  // Cancel unblock
  document.getElementById('cancelUnblock').addEventListener('click', async () => {
    await sendMessage({
      action: 'cancelUnblock',
      domain: blockedDomain
    })
    
    pendingUnblock = null
    hidePendingSection()
  })
  
  // Confirm unblock
  document.getElementById('confirmUnblock').addEventListener('click', async () => {
    const response = await sendMessage({
      action: 'confirmUnblock',
      domain: blockedDomain
    })
    
    if (response.success) {
      // Redirect to the site
      window.location.href = `https://${blockedDomain}`
    }
  })
}

// ============================================
// UTILITIES
// ============================================

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response || {})
    })
  })
}
