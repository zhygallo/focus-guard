/**
 * FocusGuard - Domain Utilities
 * Functions for domain extraction, validation, and matching
 */

/**
 * Extract clean domain from URL or domain string
 * @param {string} url - URL or domain to extract from
 * @returns {string|null} - Cleaned domain or null if invalid
 */
export function extractDomain(url) {
  if (!url || typeof url !== 'string') return null

  try {
    let urlToParse = url.trim()

    // If no protocol, add https:// for URL parsing
    if (!urlToParse.includes('://')) {
      urlToParse = 'https://' + urlToParse
    }

    const hostname = new URL(urlToParse).hostname

    // Remove www. prefix and lowercase
    return hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

/**
 * Check if a URL can be blocked (not a browser internal page)
 * @param {string} url - URL to check
 * @returns {boolean} - True if URL can be blocked
 */
export function isBlockableUrl(url) {
  if (!url || typeof url !== 'string') return false

  const unblockablePrefixes = [
    'chrome://',
    'chrome-extension://',
    'about:',
    'edge://',
    'moz-extension://',
    'file://',
    'data:',
    'javascript:',
    'blob:'
  ]

  const lowerUrl = url.toLowerCase()
  return !unblockablePrefixes.some(prefix => lowerUrl.startsWith(prefix))
}

/**
 * Check if a domain matches or is a subdomain of another
 * @param {string} childDomain - Domain to check (e.g., 'videos.youtube.com')
 * @param {string} parentDomain - Parent domain to match against (e.g., 'youtube.com')
 * @returns {boolean} - True if child matches or is subdomain of parent
 */
export function domainMatches(childDomain, parentDomain) {
  if (!childDomain || !parentDomain) return false

  const child = childDomain.toLowerCase()
  const parent = parentDomain.toLowerCase()

  // Exact match
  if (child === parent) return true

  // Subdomain match (child ends with .parent)
  return child.endsWith('.' + parent)
}

/**
 * Clean domain string by removing protocol, www, and path
 * @param {string} input - Raw domain input from user
 * @returns {string} - Cleaned domain
 */
export function cleanDomainInput(input) {
  if (!input || typeof input !== 'string') return ''

  return input
    .trim()
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .split('/')[0]
    .split('?')[0]
    .split('#')[0]
}
