#!/usr/bin/env node

/**
 * FocusGuard - Test Runner Entry Point
 * Runs all tests and reports results
 */

// Import chrome mock first (installs global chrome object)
import './mocks/chrome.js'

import { printResults } from './test-runner.js'

// Import test modules
import { runTests as runDomainUtilsTests } from './lib/domain-utils.test.js'
import { runTests as runTimeUtilsTests } from './lib/time-utils.test.js'
import { runTests as runValidationTests } from './lib/validation.test.js'
import { runTests as runErrorsTests } from './lib/errors.test.js'
import { runTests as runStorageTests } from './lib/storage.test.js'

async function runAllTests() {
  console.log('🧪 FocusGuard Test Suite')
  console.log('='.repeat(50))

  // Run all test modules
  await runDomainUtilsTests()
  await runTimeUtilsTests()
  await runValidationTests()
  await runErrorsTests()
  await runStorageTests()

  // Print final results
  printResults()
}

runAllTests().catch(error => {
  console.error('Test runner error:', error)
  process.exit(1)
})
