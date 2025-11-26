/**
 * Tests for domain-utils.js
 */

import { describe, it, assert } from '../test-runner.js'
import {
  extractDomain,
  isBlockableUrl,
  domainMatches,
  cleanDomainInput
} from '../../lib/domain-utils.js'

export async function runTests() {
  await describe('domain-utils', async () => {
    await describe('extractDomain', async () => {
      await it('extracts domain from simple URL', () => {
        assert.equal(extractDomain('https://example.com'), 'example.com')
      })

      await it('extracts domain from URL with path', () => {
        assert.equal(extractDomain('https://example.com/path/to/page'), 'example.com')
      })

      await it('extracts domain from URL with query params', () => {
        assert.equal(extractDomain('https://example.com?foo=bar'), 'example.com')
      })

      await it('removes www prefix', () => {
        assert.equal(extractDomain('https://www.example.com'), 'example.com')
      })

      await it('handles http URLs', () => {
        assert.equal(extractDomain('http://example.com'), 'example.com')
      })

      await it('handles subdomain', () => {
        assert.equal(extractDomain('https://sub.example.com'), 'sub.example.com')
      })

      await it('handles non-URL input as domain', () => {
        // The function treats invalid URLs as potential bare domains
        assert.equal(extractDomain('not-a-url'), 'not-a-url')
      })

      await it('returns null for empty string', () => {
        assert.equal(extractDomain(''), null)
      })

      await it('returns null for null input', () => {
        assert.equal(extractDomain(null), null)
      })

      await it('extracts from domain-only input', () => {
        assert.equal(extractDomain('example.com'), 'example.com')
      })
    })

    await describe('isBlockableUrl', async () => {
      await it('returns true for https URL', () => {
        assert.equal(isBlockableUrl('https://example.com'), true)
      })

      await it('returns true for http URL', () => {
        assert.equal(isBlockableUrl('http://example.com'), true)
      })

      await it('returns false for chrome:// URL', () => {
        assert.equal(isBlockableUrl('chrome://extensions'), false)
      })

      await it('returns false for chrome-extension:// URL', () => {
        assert.equal(isBlockableUrl('chrome-extension://abc123'), false)
      })

      await it('returns false for about: URL', () => {
        assert.equal(isBlockableUrl('about:blank'), false)
      })

      await it('returns false for file:// URL', () => {
        assert.equal(isBlockableUrl('file:///path/to/file'), false)
      })

      await it('returns false for empty string', () => {
        assert.equal(isBlockableUrl(''), false)
      })

      await it('returns false for null', () => {
        assert.equal(isBlockableUrl(null), false)
      })
    })

    await describe('domainMatches', async () => {
      await it('returns true for exact match', () => {
        assert.equal(domainMatches('example.com', 'example.com'), true)
      })

      await it('returns true for subdomain matching parent', () => {
        assert.equal(domainMatches('sub.example.com', 'example.com'), true)
      })

      await it('returns true for nested subdomain matching parent', () => {
        assert.equal(domainMatches('deep.sub.example.com', 'example.com'), true)
      })

      await it('returns false for different domains', () => {
        assert.equal(domainMatches('example.com', 'other.com'), false)
      })

      await it('returns false when parent is subdomain of child', () => {
        assert.equal(domainMatches('example.com', 'sub.example.com'), false)
      })

      await it('returns false for partial string match', () => {
        assert.equal(domainMatches('notexample.com', 'example.com'), false)
      })

      await it('handles www subdomain', () => {
        assert.equal(domainMatches('www.example.com', 'example.com'), true)
      })
    })

    await describe('cleanDomainInput', async () => {
      await it('returns domain as-is for clean input', () => {
        assert.equal(cleanDomainInput('example.com'), 'example.com')
      })

      await it('extracts domain from full URL', () => {
        assert.equal(cleanDomainInput('https://example.com/path'), 'example.com')
      })

      await it('trims whitespace', () => {
        assert.equal(cleanDomainInput('  example.com  '), 'example.com')
      })

      await it('converts to lowercase', () => {
        assert.equal(cleanDomainInput('EXAMPLE.COM'), 'example.com')
      })

      await it('removes www prefix', () => {
        assert.equal(cleanDomainInput('www.example.com'), 'example.com')
      })

      await it('handles URL with protocol', () => {
        assert.equal(cleanDomainInput('http://www.example.com'), 'example.com')
      })

      await it('returns empty string for empty input', () => {
        // cleanDomainInput returns empty string for empty/invalid input
        assert.equal(cleanDomainInput(''), '')
      })

      await it('returns empty string for whitespace only', () => {
        assert.equal(cleanDomainInput('   '), '')
      })

      await it('returns empty string for null input', () => {
        assert.equal(cleanDomainInput(null), '')
      })
    })
  })
}
