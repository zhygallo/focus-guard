/**
 * FocusGuard - Popup Script
 * Handles all popup UI interactions with memory leak fixes
 */

import { extractDomain, isBlockableUrl, cleanDomainInput } from '../lib/domain-utils.js'
import { formatDuration, formatTimeRemaining, getTodayKey } from '../lib/time-utils.js'
import { api } from '../lib/messaging.js'
import { getUserMessage } from '../lib/errors.js'

// ============================================
// STATE & CLEANUP
// ============================================

let currentDomain = null
let currentDomainBlocked = false

// Interval registry for cleanup
const intervals = []
let isInitialized = false

function registerInterval(id) {
  intervals.push(id)
}

function clearAllIntervals() {
  intervals.forEach(clearInterval)
  intervals.length = 0
}

// Clean up on popup close
window.addEventListener('unload', clearAllIntervals)

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  if (isInitialized) return
  isInitialized = true

  await initCurrentSite()
  await loadActiveBlocks()
  await loadStats()
  setupEventListeners()

  // Refresh data periodically - track for cleanup
  const refreshId = setInterval(loadActiveBlocks, 1000)
  registerInterval(refreshId)
})

// ============================================
// CURRENT SITE
// ============================================

async function initCurrentSite() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    if (tab?.url) {
      if (!isBlockableUrl(tab.url)) {
        document.getElementById('currentSite').textContent = 'Not a blockable page'
        return
      }

      currentDomain = extractDomain(tab.url)

      if (currentDomain) {
        const siteElement = document.getElementById('currentSite')
        siteElement.textContent = currentDomain

        // Check if currently blocked
        const response = await api.getBlocks()
        if (response.success !== false && response[currentDomain]) {
          currentDomainBlocked = true
          siteElement.classList.add('blocked')
          siteElement.textContent = `${currentDomain} (blocked)`
        }
      } else {
        document.getElementById('currentSite').textContent = 'Not a blockable page'
      }
    } else {
      document.getElementById('currentSite').textContent = 'No active tab'
    }
  } catch (error) {
    console.error('Error getting current site:', error)
    document.getElementById('currentSite').textContent = 'Unable to detect site'
  }
}

// ============================================
// BLOCK MANAGEMENT
// ============================================

async function blockCurrentSite(minutes) {
  if (!currentDomain) {
    showToast('Cannot block this page', 'error')
    return
  }

  if (currentDomainBlocked) {
    showToast('Site is already blocked', 'error')
    return
  }

  const response = await api.addBlock(currentDomain, minutes)

  if (response.success) {
    showToast(`Blocked ${currentDomain} for ${formatDuration(minutes)}`, 'success')
    currentDomainBlocked = true

    // Update UI
    const siteElement = document.getElementById('currentSite')
    siteElement.classList.add('blocked')
    siteElement.textContent = `${currentDomain} (blocked)`

    await loadActiveBlocks()
  } else {
    showToast(response.error || 'Failed to block site', 'error')
  }
}

async function blockCustomSite(domain, minutes) {
  if (!domain) {
    showToast('Please enter a domain', 'error')
    return
  }

  const cleanDomain = cleanDomainInput(domain)

  if (!cleanDomain || !cleanDomain.includes('.')) {
    showToast('Please enter a valid domain', 'error')
    return
  }

  const response = await api.addBlock(cleanDomain, minutes)

  if (response.success) {
    showToast(`Blocked ${cleanDomain} for ${formatDuration(minutes)}`, 'success')
    document.getElementById('customDomain').value = ''
    document.getElementById('customMinutes').value = ''
    await loadActiveBlocks()
  } else {
    showToast(response.error || 'Failed to block site', 'error')
  }
}

async function requestUnblock(domain) {
  const response = await api.requestUnblock(domain)

  if (response.success) {
    const minutes = Math.ceil(response.waitTime / 60)
    showToast(`Unblock requested. Wait ${minutes} minutes.`, 'success')
    await loadActiveBlocks()
  } else if (response.code === 'unblock_pending') {
    const remaining = Math.ceil(response.details?.remainingTime / 60) || 0
    showToast(`Already pending. ${remaining} min remaining.`, 'error')
  } else {
    showToast(response.error || 'Failed to request unblock', 'error')
  }
}

async function cancelUnblock(domain) {
  const response = await api.cancelUnblock(domain)

  if (response.success) {
    showToast('Unblock cancelled', 'success')
    await loadActiveBlocks()
  } else {
    showToast(response.error || 'Failed to cancel', 'error')
  }
}

async function confirmUnblock(domain) {
  const response = await api.confirmUnblock(domain)

  if (response.success) {
    showToast(`${domain} unblocked`, 'success')
    await loadActiveBlocks()

    // Check if we unblocked current site
    if (domain === currentDomain) {
      currentDomainBlocked = false
      const siteElement = document.getElementById('currentSite')
      siteElement.classList.remove('blocked')
      siteElement.textContent = currentDomain
    }
  } else if (response.code === 'unblock_delay_not_complete') {
    const remaining = Math.ceil(response.details?.remainingTime / 60) || 0
    showToast(`Wait ${remaining} more minutes`, 'error')
  } else {
    showToast(response.error || 'Failed to unblock', 'error')
  }
}

// ============================================
// LOAD & RENDER
// ============================================

async function loadActiveBlocks() {
  const [blocksResponse, pendingResponse] = await Promise.all([
    api.getBlocks(),
    api.getPendingUnblocks()
  ])

  const blocks = blocksResponse.success === false ? {} : blocksResponse
  const pendingUnblocks = pendingResponse.success === false ? {} : pendingResponse

  const listElement = document.getElementById('activeBlocksList')
  const countElement = document.getElementById('activeBlocksCount')

  const blockEntries = Object.entries(blocks)
  countElement.textContent = blockEntries.length

  if (blockEntries.length === 0) {
    listElement.innerHTML = '<div class="empty-state">No active blocks</div>'
    return
  }

  // Sort by time remaining (soonest first)
  blockEntries.sort((a, b) => a[1].until - b[1].until)

  listElement.innerHTML = blockEntries.map(([domain, info]) => {
    const remaining = Math.max(0, info.until - Date.now())
    const minutes = Math.ceil(remaining / 60000)
    const pending = pendingUnblocks[domain]

    let actionHtml

    if (pending) {
      const pendingRemaining = Math.max(0, pending.unlocksAt - Date.now())
      const pendingSeconds = Math.ceil(pendingRemaining / 1000)

      if (pendingRemaining > 0) {
        const mins = Math.floor(pendingSeconds / 60)
        const secs = pendingSeconds % 60
        actionHtml = `
          <span class="pending-badge">⏳ ${mins}:${secs.toString().padStart(2, '0')}</span>
          <button class="btn btn-danger" data-action="cancel" data-domain="${domain}">Cancel</button>
        `
      } else {
        actionHtml = `
          <button class="btn btn-primary" data-action="confirm" data-domain="${domain}" style="font-size: 12px; padding: 4px 10px;">Unblock Now</button>
        `
      }
    } else {
      actionHtml = `
        <button class="btn btn-danger" data-action="unblock" data-domain="${domain}">Unblock</button>
      `
    }

    return `
      <div class="block-item">
        <div class="block-info">
          <div class="block-domain">${domain}</div>
          <div class="block-time">${formatTimeRemaining(minutes)} left</div>
        </div>
        <div class="block-actions">
          ${actionHtml}
        </div>
      </div>
    `
  }).join('')

  // Add event listeners for action buttons (fresh listeners each render)
  listElement.querySelectorAll('button[data-action]').forEach(btn => {
    btn.onclick = async (e) => {
      const action = e.target.dataset.action
      const domain = e.target.dataset.domain

      if (action === 'unblock') {
        await requestUnblock(domain)
      } else if (action === 'cancel') {
        await cancelUnblock(domain)
      } else if (action === 'confirm') {
        await confirmUnblock(domain)
      }
    }
  })
}

async function loadStats() {
  const response = await api.getStats()

  if (response.success === false) {
    document.getElementById('todayBlocked').textContent = '0 blocks prevented'
    return
  }

  const today = getTodayKey()
  const todayCount = response.blockedAttempts?.[today] || 0

  document.getElementById('todayBlocked').textContent =
    `${todayCount} block${todayCount !== 1 ? 's' : ''} prevented`
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Duration buttons for current site
  document.querySelectorAll('.btn-duration[data-minutes]').forEach(btn => {
    btn.addEventListener('click', () => {
      const minutes = parseInt(btn.dataset.minutes, 10)
      blockCurrentSite(minutes)
    })
  })

  // Duration buttons for custom block
  document.querySelectorAll('.btn-duration[data-custom-minutes]').forEach(btn => {
    btn.addEventListener('click', () => {
      const minutes = parseInt(btn.dataset.customMinutes, 10)
      const domain = document.getElementById('customDomain').value.trim()
      blockCustomSite(domain, minutes)
    })
  })

  // Custom block button
  document.getElementById('addCustomBlock').addEventListener('click', () => {
    const domain = document.getElementById('customDomain').value.trim()
    const minutes = parseInt(document.getElementById('customMinutes').value, 10) || 60
    blockCustomSite(domain, minutes)
  })

  // Enter key on custom domain input
  document.getElementById('customDomain').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const domain = e.target.value.trim()
      const minutes = parseInt(document.getElementById('customMinutes').value, 10) || 60
      blockCustomSite(domain, minutes)
    }
  })

  // Toggle sections
  document.getElementById('toggleActiveBlocks').addEventListener('click', () => {
    toggleSection('activeBlocksContent', 'toggleActiveBlocks')
  })

  document.getElementById('toggleCustomBlock').addEventListener('click', () => {
    toggleSection('customBlockContent', 'toggleCustomBlock')
  })
}

function toggleSection(contentId, headerId) {
  const content = document.getElementById(contentId)
  const header = document.getElementById(headerId)
  const icon = header.querySelector('.toggle-icon')

  content.classList.toggle('collapsed')
  icon.textContent = content.classList.contains('collapsed') ? '▶' : '▼'
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
