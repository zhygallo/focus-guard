/**
 * FocusGuard - Popup Script
 * Handles all popup UI interactions
 */

// ============================================
// STATE
// ============================================

let currentDomain = null
let currentDomainBlocked = false

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  await initCurrentSite()
  await loadActiveBlocks()
  await loadStats()
  setupEventListeners()
  
  // Refresh data periodically
  setInterval(loadActiveBlocks, 1000)
})

// ============================================
// CURRENT SITE
// ============================================

async function initCurrentSite() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    
    if (tab?.url) {
      currentDomain = extractDomain(tab.url)
      
      if (currentDomain) {
        const siteElement = document.getElementById('currentSite')
        siteElement.textContent = currentDomain
        
        // Check if currently blocked
        const blocks = await sendMessage({ action: 'getBlocks' })
        if (blocks[currentDomain]) {
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

function extractDomain(url) {
  try {
    // Don't allow blocking of extension pages or chrome:// URLs
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
      return null
    }
    const hostname = new URL(url).hostname
    return hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
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
  
  const response = await sendMessage({
    action: 'addBlock',
    domain: currentDomain,
    minutes: minutes
  })
  
  if (response.success) {
    showToast(`Blocked ${currentDomain} for ${formatDuration(minutes)}`, 'success')
    currentDomainBlocked = true
    
    // Update UI
    const siteElement = document.getElementById('currentSite')
    siteElement.classList.add('blocked')
    siteElement.textContent = `${currentDomain} (blocked)`
    
    await loadActiveBlocks()
  } else {
    showToast('Failed to block site', 'error')
  }
}

async function blockCustomSite(domain, minutes) {
  if (!domain) {
    showToast('Please enter a domain', 'error')
    return
  }
  
  // Basic domain validation
  const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].toLowerCase()
  
  if (!cleanDomain || !cleanDomain.includes('.')) {
    showToast('Please enter a valid domain', 'error')
    return
  }
  
  const response = await sendMessage({
    action: 'addBlock',
    domain: cleanDomain,
    minutes: minutes
  })
  
  if (response.success) {
    showToast(`Blocked ${cleanDomain} for ${formatDuration(minutes)}`, 'success')
    document.getElementById('customDomain').value = ''
    document.getElementById('customMinutes').value = ''
    await loadActiveBlocks()
  } else {
    showToast('Failed to block site', 'error')
  }
}

async function requestUnblock(domain) {
  const response = await sendMessage({
    action: 'requestUnblock',
    domain: domain
  })
  
  if (response.success) {
    const minutes = Math.ceil(response.waitTime / 60)
    showToast(`Unblock requested. Wait ${minutes} minutes.`, 'success')
    await loadActiveBlocks()
  } else if (response.error === 'already_pending') {
    const remaining = Math.ceil(response.remainingTime / 60)
    showToast(`Already pending. ${remaining} min remaining.`, 'error')
  } else {
    showToast('Failed to request unblock', 'error')
  }
}

async function cancelUnblock(domain) {
  const response = await sendMessage({
    action: 'cancelUnblock',
    domain: domain
  })
  
  if (response.success) {
    showToast('Unblock cancelled', 'success')
    await loadActiveBlocks()
  }
}

async function confirmUnblock(domain) {
  const response = await sendMessage({
    action: 'confirmUnblock',
    domain: domain
  })
  
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
  } else if (response.error === 'delay_not_complete') {
    const remaining = Math.ceil(response.remainingTime / 60)
    showToast(`Wait ${remaining} more minutes`, 'error')
  } else {
    showToast('Failed to unblock', 'error')
  }
}

// ============================================
// LOAD & RENDER
// ============================================

async function loadActiveBlocks() {
  const blocks = await sendMessage({ action: 'getBlocks' })
  const pendingUnblocks = await sendMessage({ action: 'getPendingUnblocks' })
  
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
      const pendingMinutes = Math.ceil(pendingRemaining / 60000)
      const pendingSeconds = Math.ceil(pendingRemaining / 1000) % 60
      
      if (pendingRemaining > 0) {
        actionHtml = `
          <span class="pending-badge">⏳ ${pendingMinutes}:${pendingSeconds.toString().padStart(2, '0')}</span>
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
  
  // Add event listeners for action buttons
  listElement.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const action = e.target.dataset.action
      const domain = e.target.dataset.domain
      
      if (action === 'unblock') {
        await requestUnblock(domain)
      } else if (action === 'cancel') {
        await cancelUnblock(domain)
      } else if (action === 'confirm') {
        await confirmUnblock(domain)
      }
    })
  })
}

async function loadStats() {
  const stats = await sendMessage({ action: 'getStats' })
  
  const today = new Date().toISOString().split('T')[0]
  const todayCount = stats.blockedAttempts?.[today] || 0
  
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
      const minutes = parseInt(btn.dataset.minutes)
      blockCurrentSite(minutes)
    })
  })
  
  // Duration buttons for custom block
  document.querySelectorAll('.btn-duration[data-custom-minutes]').forEach(btn => {
    btn.addEventListener('click', () => {
      const minutes = parseInt(btn.dataset.customMinutes)
      const domain = document.getElementById('customDomain').value.trim()
      blockCustomSite(domain, minutes)
    })
  })
  
  // Custom block button
  document.getElementById('addCustomBlock').addEventListener('click', () => {
    const domain = document.getElementById('customDomain').value.trim()
    const minutes = parseInt(document.getElementById('customMinutes').value) || 60
    blockCustomSite(domain, minutes)
  })
  
  // Enter key on custom domain input
  document.getElementById('customDomain').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const domain = e.target.value.trim()
      const minutes = parseInt(document.getElementById('customMinutes').value) || 60
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
// UTILITIES
// ============================================

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response || {})
    })
  })
}

function formatDuration(minutes) {
  if (minutes < 60) {
    return `${minutes} min`
  } else if (minutes === 60) {
    return '1 hour'
  } else if (minutes < 480) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hours`
  } else {
    return '8 hours'
  }
}

function formatTimeRemaining(minutes) {
  if (minutes < 1) {
    return '< 1 min'
  } else if (minutes < 60) {
    return `${minutes} min`
  } else {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast')
  toast.textContent = message
  toast.className = `toast ${type} show`
  
  setTimeout(() => {
    toast.classList.remove('show')
  }, 3000)
}
