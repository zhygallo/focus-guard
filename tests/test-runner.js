/**
 * FocusGuard - Simple Test Runner
 * Minimal test framework for ES modules without dependencies
 */

// Test results
const results = {
  passed: 0,
  failed: 0,
  errors: []
}

// Current test context
let currentSuite = ''
let currentTest = ''

/**
 * Define a test suite
 * @param {string} name - Suite name
 * @param {Function} fn - Suite function containing tests
 */
export async function describe(name, fn) {
  currentSuite = name
  console.log(`\n📦 ${name}`)
  await fn()
}

/**
 * Define a test
 * @param {string} name - Test name
 * @param {Function} fn - Test function (can be async)
 */
export async function it(name, fn) {
  currentTest = name
  try {
    await fn()
    results.passed++
    console.log(`  ✅ ${name}`)
  } catch (error) {
    results.failed++
    console.log(`  ❌ ${name}`)
    console.log(`     Error: ${error.message}`)
    results.errors.push({
      suite: currentSuite,
      test: name,
      error: error.message,
      stack: error.stack
    })
  }
}

/**
 * Assertion helpers
 */
export const assert = {
  /**
   * Assert that a value is truthy
   */
  ok(value, message = 'Expected value to be truthy') {
    if (!value) {
      throw new Error(message)
    }
  },

  /**
   * Assert strict equality
   */
  equal(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    }
  },

  /**
   * Assert deep equality for objects/arrays
   */
  deepEqual(actual, expected, message) {
    const actualStr = JSON.stringify(actual, null, 2)
    const expectedStr = JSON.stringify(expected, null, 2)
    if (actualStr !== expectedStr) {
      throw new Error(message || `Deep equality failed:\nExpected: ${expectedStr}\nActual: ${actualStr}`)
    }
  },

  /**
   * Assert that a value is null or undefined
   */
  isNull(value, message = 'Expected value to be null or undefined') {
    if (value !== null && value !== undefined) {
      throw new Error(message)
    }
  },

  /**
   * Assert that a value is not null or undefined
   */
  isNotNull(value, message = 'Expected value to not be null or undefined') {
    if (value === null || value === undefined) {
      throw new Error(message)
    }
  },

  /**
   * Assert that a function throws an error
   */
  async throws(fn, expectedMessage) {
    let threw = false
    let error
    try {
      await fn()
    } catch (e) {
      threw = true
      error = e
    }
    if (!threw) {
      throw new Error('Expected function to throw')
    }
    if (expectedMessage && !error.message.includes(expectedMessage)) {
      throw new Error(`Expected error message to include "${expectedMessage}", got "${error.message}"`)
    }
  },

  /**
   * Assert that a value is an instance of a class
   */
  instanceOf(value, constructor, message) {
    if (!(value instanceof constructor)) {
      throw new Error(message || `Expected instance of ${constructor.name}`)
    }
  },

  /**
   * Assert that an array includes a value
   */
  includes(array, value, message) {
    if (!array.includes(value)) {
      throw new Error(message || `Expected array to include ${JSON.stringify(value)}`)
    }
  },

  /**
   * Assert that a string matches a pattern
   */
  matches(value, pattern, message) {
    if (!pattern.test(value)) {
      throw new Error(message || `Expected "${value}" to match ${pattern}`)
    }
  },

  /**
   * Assert that two numbers are close (for floating point)
   */
  closeTo(actual, expected, delta = 0.001, message) {
    if (Math.abs(actual - expected) > delta) {
      throw new Error(message || `Expected ${actual} to be close to ${expected} (delta: ${delta})`)
    }
  }
}

/**
 * Print final test results
 */
export function printResults() {
  console.log('\n' + '='.repeat(50))
  console.log(`📊 Test Results: ${results.passed} passed, ${results.failed} failed`)

  if (results.failed > 0) {
    console.log('\n❌ Failed tests:')
    results.errors.forEach(({ suite, test, error }) => {
      console.log(`   ${suite} > ${test}`)
      console.log(`   ${error}\n`)
    })
  }

  console.log('='.repeat(50))

  // Exit with error code if tests failed
  if (results.failed > 0) {
    process.exit(1)
  }
}

/**
 * Reset results (for running multiple test files)
 */
export function resetResults() {
  results.passed = 0
  results.failed = 0
  results.errors = []
}
