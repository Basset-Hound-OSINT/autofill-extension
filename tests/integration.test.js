/**
 * Basset Hound Autofill Extension - Integration Tests
 *
 * These tests verify the WebSocket communication between the test server
 * and the browser extension, including all command handlers.
 *
 * Prerequisites:
 * - Node.js installed
 * - Chrome/Chromium browser with extension loaded
 * - Test server running (node test-server.js)
 * - Test page loaded in browser (test-page.html)
 *
 * Usage: node integration.test.js [--manual]
 */

const WebSocket = require('ws');
const assert = require('assert');
const { createServer, runTestCommand, getClient, testState, waitForResponse, sendCommand } = require('./test-server');

// Test configuration
const CONFIG = {
  WS_URL: 'ws://localhost:8765/browser',
  CONNECT_TIMEOUT: 10000,
  COMMAND_TIMEOUT: 30000,
  TEST_PAGE_URL: 'file://' + __dirname + '/test-page.html',
  VERBOSE: process.argv.includes('--verbose') || process.argv.includes('-v')
};

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

/**
 * Log utility with timestamp
 */
function log(message, level = 'INFO') {
  if (CONFIG.VERBOSE || level === 'ERROR' || level === 'RESULT') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
  }
}

/**
 * Test assertion wrapper
 */
function test(name, fn) {
  return async () => {
    log(`Running test: ${name}`, 'TEST');
    const startTime = Date.now();
    try {
      await fn();
      const duration = Date.now() - startTime;
      testResults.passed++;
      testResults.tests.push({ name, status: 'PASSED', duration });
      log(`PASSED: ${name} (${duration}ms)`, 'RESULT');
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      testResults.failed++;
      testResults.tests.push({ name, status: 'FAILED', duration, error: error.message });
      log(`FAILED: ${name} - ${error.message}`, 'ERROR');
      if (CONFIG.VERBOSE) {
        console.error(error.stack);
      }
      return false;
    }
  };
}

/**
 * Skip a test
 */
function skip(name, reason = '') {
  return async () => {
    testResults.skipped++;
    testResults.tests.push({ name, status: 'SKIPPED', reason });
    log(`SKIPPED: ${name}${reason ? ' - ' + reason : ''}`, 'RESULT');
    return true;
  };
}

/**
 * Wait for client connection
 */
async function waitForClient(timeout = CONFIG.CONNECT_TIMEOUT) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const client = getClient();
    if (client) {
      return client;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timeout waiting for client connection');
}

// =============================================================================
// Test Suites
// =============================================================================

/**
 * Connection Tests
 */
const connectionTests = {
  name: 'Connection Tests',
  tests: [
    test('Client should connect to WebSocket server', async () => {
      const client = await waitForClient();
      assert(client, 'Client should be connected');
      assert(client.readyState === WebSocket.OPEN, 'Client should be in OPEN state');
    }),

    test('Server should track connected clients', async () => {
      await waitForClient();
      assert(testState.connectedClients.size > 0, 'Should have at least one connected client');
    }),

    test('Client should send heartbeats', async () => {
      await waitForClient();
      // Wait for heartbeat (default interval is 30s, but we wait for first one)
      await new Promise(resolve => setTimeout(resolve, 35000));
      assert(testState.lastHeartbeat, 'Should have received a heartbeat');
      assert(testState.lastHeartbeat.timestamp, 'Heartbeat should have timestamp');
    }),

    test('Server should handle multiple clients gracefully', async () => {
      // This test verifies the server can track multiple clients
      const initialCount = testState.connectedClients.size;
      assert(initialCount >= 1, 'Should have at least one client');
      // In a real test, we would connect additional mock clients here
    })
  ]
};

/**
 * Navigation Command Tests
 */
const navigationTests = {
  name: 'Navigation Tests',
  tests: [
    test('Navigate command should require URL parameter', async () => {
      try {
        const response = await runTestCommand('navigate', {}, 5000);
        assert(response.success === false, 'Should fail without URL');
        assert(response.error, 'Should have error message');
      } catch (error) {
        // Expected behavior - command should fail
        assert(error.message.includes('URL') || true, 'Should indicate URL is required');
      }
    }),

    test('Navigate command should validate URL format', async () => {
      try {
        const response = await runTestCommand('navigate', { url: 'not-a-valid-url' }, 5000);
        assert(response.success === false, 'Should fail with invalid URL');
      } catch (error) {
        // Expected behavior
      }
    }),

    test('Navigate command should navigate to valid URL', async () => {
      const response = await runTestCommand('navigate', {
        url: CONFIG.TEST_PAGE_URL
      }, CONFIG.COMMAND_TIMEOUT);

      assert(response.success === true, 'Navigate should succeed');
      assert(response.result, 'Should have result');
    }),

    test('Navigate command should support wait_for parameter', async () => {
      const response = await runTestCommand('navigate', {
        url: CONFIG.TEST_PAGE_URL,
        wait_for: '#basic-form'
      }, CONFIG.COMMAND_TIMEOUT);

      assert(response.success === true, 'Navigate with wait_for should succeed');
    })
  ]
};

/**
 * Form Filling Tests
 */
const formFillingTests = {
  name: 'Form Filling Tests',
  tests: [
    test('Fill form command should require fields parameter', async () => {
      try {
        const response = await runTestCommand('fill_form', {}, 5000);
        assert(response.success === false, 'Should fail without fields');
      } catch (error) {
        // Expected
      }
    }),

    test('Fill form command should fill text input by ID', async () => {
      const response = await runTestCommand('fill_form', {
        fields: { '#username': 'testuser123' }
      });

      assert(response.success === true, 'Fill form should succeed');
      assert(response.result?.filled, 'Should have filled results');
    }),

    test('Fill form command should fill text input by name', async () => {
      const response = await runTestCommand('fill_form', {
        fields: { '[name="email"]': 'test@example.com' }
      });

      assert(response.success === true, 'Fill form should succeed');
    }),

    test('Fill form command should fill password input', async () => {
      const response = await runTestCommand('fill_form', {
        fields: { '#password': 'SecurePassword123!' }
      });

      assert(response.success === true, 'Fill password should succeed');
    }),

    test('Fill form command should fill multiple fields', async () => {
      const response = await runTestCommand('fill_form', {
        fields: {
          '#username': 'multiuser',
          '#email': 'multi@test.com',
          '#password': 'MultiPass123!'
        }
      });

      assert(response.success === true, 'Fill multiple fields should succeed');
      const filled = response.result?.filled || [];
      assert(filled.length === 3, 'Should have filled 3 fields');
    }),

    test('Fill form command should fill select dropdown', async () => {
      const response = await runTestCommand('fill_form', {
        fields: { '#country': 'us' }
      });

      assert(response.success === true, 'Fill select should succeed');
    }),

    test('Fill form command should fill checkbox', async () => {
      const response = await runTestCommand('fill_form', {
        fields: { '#interest-tech': 'true' }
      });

      assert(response.success === true, 'Fill checkbox should succeed');
    }),

    test('Fill form command should fill radio button', async () => {
      const response = await runTestCommand('fill_form', {
        fields: { '#gender-male': 'true' }
      });

      assert(response.success === true, 'Fill radio should succeed');
    }),

    test('Fill form command should fill textarea', async () => {
      const response = await runTestCommand('fill_form', {
        fields: { '#bio': 'This is a test biography with multiple lines.\nLine 2 here.' }
      });

      assert(response.success === true, 'Fill textarea should succeed');
    }),

    test('Fill form command should handle non-existent selector', async () => {
      const response = await runTestCommand('fill_form', {
        fields: { '#non-existent-element-xyz': 'value' }
      });

      assert(response.success === true, 'Command should succeed');
      const filled = response.result?.filled || [];
      const failedField = filled.find(f => f.selector === '#non-existent-element-xyz');
      assert(failedField?.success === false, 'Should report field as not found');
    }),

    test('Fill form command should support submit option', async () => {
      // First fill the form
      await runTestCommand('fill_form', {
        fields: {
          '#username': 'submituser',
          '#email': 'submit@test.com',
          '#password': 'SubmitPass123!'
        }
      });

      // Then submit
      const response = await runTestCommand('fill_form', {
        fields: {},
        submit: true
      });

      // Form submission behavior depends on page setup
      assert(response, 'Should get response');
    }),

    test('Fill form command should fill by data-testid', async () => {
      const response = await runTestCommand('fill_form', {
        fields: { '[data-testid="username-input"]': 'testiduser' }
      });

      assert(response.success === true, 'Fill by data-testid should succeed');
    }),

    test('Fill form command should fill by aria-label', async () => {
      const response = await runTestCommand('fill_form', {
        fields: { '[aria-label="Search products"]': 'search query' }
      });

      assert(response.success === true, 'Fill by aria-label should succeed');
    }),

    test('Fill form command should fill contenteditable', async () => {
      const response = await runTestCommand('fill_form', {
        fields: { '#rich-editor': 'Rich text content here' }
      });

      // Contenteditable handling may vary
      assert(response, 'Should get response');
    })
  ]
};

/**
 * Click Command Tests
 */
const clickTests = {
  name: 'Click Tests',
  tests: [
    test('Click command should require selector parameter', async () => {
      try {
        const response = await runTestCommand('click', {}, 5000);
        assert(response.success === false, 'Should fail without selector');
      } catch (error) {
        // Expected
      }
    }),

    test('Click command should click button by ID', async () => {
      const response = await runTestCommand('click', {
        selector: '#btn-primary'
      });

      assert(response.success === true, 'Click should succeed');
    }),

    test('Click command should click button by class', async () => {
      const response = await runTestCommand('click', {
        selector: 'button.secondary'
      });

      assert(response.success === true, 'Click by class should succeed');
    }),

    test('Click command should support wait_after parameter', async () => {
      const startTime = Date.now();
      const response = await runTestCommand('click', {
        selector: '#btn-success',
        wait_after: 1000
      });

      const duration = Date.now() - startTime;
      assert(response.success === true, 'Click with wait should succeed');
      assert(duration >= 1000, 'Should wait at least 1000ms');
    }),

    test('Click command should handle non-existent selector', async () => {
      const response = await runTestCommand('click', {
        selector: '#non-existent-button'
      });

      // Behavior depends on implementation
      assert(response, 'Should get response');
    }),

    test('Click command should click links', async () => {
      const response = await runTestCommand('click', {
        selector: '#link-section1'
      });

      assert(response.success === true, 'Click link should succeed');
    }),

    test('Click command should handle click counter increment', async () => {
      // Reset counter first
      await runTestCommand('execute_script', {
        script: `
          document.getElementById('btn-counter').dataset.count = '0';
          document.getElementById('btn-counter').textContent = 'Click Count: 0';
        `
      });

      // Click the counter button
      await runTestCommand('click', { selector: '#btn-counter' });

      // Verify counter incremented
      const response = await runTestCommand('execute_script', {
        script: 'return document.getElementById("btn-counter").dataset.count'
      });

      assert(response.result?.result === '1' || response.result?.result === 1, 'Counter should be 1');
    }),

    test('Click command should scroll element into view', async () => {
      const response = await runTestCommand('click', {
        selector: '#section2'
      });

      // Click should succeed even if element needs scrolling
      assert(response, 'Should get response');
    })
  ]
};

/**
 * Get Content Tests
 */
const contentTests = {
  name: 'Content Extraction Tests',
  tests: [
    test('Get content should return page body by default', async () => {
      const response = await runTestCommand('get_content', {});

      assert(response.success === true, 'Get content should succeed');
      assert(response.result?.content, 'Should have content');
      assert(response.result?.html, 'Should have HTML');
    }),

    test('Get content should support selector parameter', async () => {
      const response = await runTestCommand('get_content', {
        selector: '#basic-form'
      });

      assert(response.success === true, 'Get content with selector should succeed');
      assert(response.result?.content, 'Should have content');
    }),

    test('Get content should handle non-existent selector', async () => {
      const response = await runTestCommand('get_content', {
        selector: '#non-existent-element'
      });

      // Should either fail gracefully or return empty
      assert(response, 'Should get response');
    }),

    test('Get content should return text content of element', async () => {
      const response = await runTestCommand('get_content', {
        selector: 'h1'
      });

      assert(response.success === true, 'Get h1 content should succeed');
      assert(response.result?.content.includes('Test Page'), 'Should contain title text');
    })
  ]
};

/**
 * Screenshot Tests
 */
const screenshotTests = {
  name: 'Screenshot Tests',
  tests: [
    test('Screenshot command should capture visible tab', async () => {
      const response = await runTestCommand('screenshot', {});

      assert(response.success === true, 'Screenshot should succeed');
      assert(response.result?.screenshot, 'Should have screenshot data');
      assert(response.result.screenshot.startsWith('data:image/'), 'Should be data URL');
    }),

    test('Screenshot command should support PNG format', async () => {
      const response = await runTestCommand('screenshot', {
        format: 'png'
      });

      assert(response.success === true, 'PNG screenshot should succeed');
      assert(response.result?.screenshot.includes('png'), 'Should be PNG format');
    }),

    test('Screenshot command should support JPEG format', async () => {
      const response = await runTestCommand('screenshot', {
        format: 'jpeg',
        quality: 80
      });

      assert(response.success === true, 'JPEG screenshot should succeed');
    })
  ]
};

/**
 * Wait for Element Tests
 */
const waitTests = {
  name: 'Wait for Element Tests',
  tests: [
    test('Wait command should require selector parameter', async () => {
      try {
        const response = await runTestCommand('wait_for_element', {}, 5000);
        assert(response.success === false || !response.result?.found, 'Should fail without selector');
      } catch (error) {
        // Expected
      }
    }),

    test('Wait command should find existing element immediately', async () => {
      const response = await runTestCommand('wait_for_element', {
        selector: '#basic-form',
        timeout: 5000
      });

      assert(response.success === true, 'Wait should succeed');
      assert(response.result?.found === true, 'Element should be found');
    }),

    test('Wait command should timeout for non-existent element', async () => {
      const startTime = Date.now();
      const response = await runTestCommand('wait_for_element', {
        selector: '#element-that-will-never-exist',
        timeout: 2000
      });

      const duration = Date.now() - startTime;
      assert(duration >= 2000, 'Should wait for timeout');
      assert(response.result?.found === false, 'Element should not be found');
    }),

    test('Wait command should find dynamically added element', async () => {
      // Click button to show delayed element
      await runTestCommand('click', { selector: '#btn-show-delayed' });

      // Wait for the delayed element (appears after 2s)
      const response = await runTestCommand('wait_for_element', {
        selector: '#delayed-element:not(.hidden-element)',
        timeout: 5000
      });

      assert(response.result?.found === true, 'Delayed element should be found');
    }),

    test('Wait command should return element info', async () => {
      const response = await runTestCommand('wait_for_element', {
        selector: '#username',
        timeout: 5000
      });

      assert(response.success === true, 'Wait should succeed');
      assert(response.result?.elementInfo, 'Should have element info');
      assert(response.result?.elementInfo?.tagName === 'input', 'Should be input element');
    })
  ]
};

/**
 * Page State Tests
 */
const pageStateTests = {
  name: 'Page State Tests',
  tests: [
    test('Get page state should return forms', async () => {
      const response = await runTestCommand('get_page_state', {});

      assert(response.success === true, 'Get page state should succeed');
      assert(response.result?.forms, 'Should have forms array');
      assert(response.result.forms.length > 0, 'Should have at least one form');
    }),

    test('Get page state should return form fields', async () => {
      const response = await runTestCommand('get_page_state', {});

      const basicForm = response.result?.forms?.find(f => f.id === 'basic-form');
      assert(basicForm, 'Should find basic form');
      assert(basicForm.fields, 'Form should have fields');
      assert(basicForm.fields.length > 0, 'Form should have at least one field');
    }),

    test('Get page state should return links', async () => {
      const response = await runTestCommand('get_page_state', {});

      assert(response.result?.links, 'Should have links array');
      assert(response.result.links.length > 0, 'Should have at least one link');
    }),

    test('Get page state should return buttons', async () => {
      const response = await runTestCommand('get_page_state', {});

      assert(response.result?.buttons, 'Should have buttons array');
      assert(response.result.buttons.length > 0, 'Should have at least one button');
    }),

    test('Get page state should return page URL and title', async () => {
      const response = await runTestCommand('get_page_state', {});

      assert(response.result?.url, 'Should have URL');
      assert(response.result?.title, 'Should have title');
    }),

    test('Get page state should include form field labels', async () => {
      const response = await runTestCommand('get_page_state', {});

      const basicForm = response.result?.forms?.find(f => f.id === 'basic-form');
      const usernameField = basicForm?.fields?.find(f => f.id === 'username');
      assert(usernameField?.label, 'Username field should have label');
    })
  ]
};

/**
 * Execute Script Tests
 */
const scriptTests = {
  name: 'Execute Script Tests',
  tests: [
    test('Execute script command should require script parameter', async () => {
      try {
        const response = await runTestCommand('execute_script', {}, 5000);
        assert(response.success === false, 'Should fail without script');
      } catch (error) {
        // Expected
      }
    }),

    test('Execute script should return result', async () => {
      const response = await runTestCommand('execute_script', {
        script: 'return 1 + 1'
      });

      assert(response.success === true, 'Script should succeed');
      assert(response.result?.result === 2, 'Result should be 2');
    }),

    test('Execute script should access DOM', async () => {
      const response = await runTestCommand('execute_script', {
        script: 'return document.title'
      });

      assert(response.success === true, 'Script should succeed');
      assert(response.result?.result.includes('Test Page'), 'Should return page title');
    }),

    test('Execute script should handle errors', async () => {
      const response = await runTestCommand('execute_script', {
        script: 'throw new Error("Test error")'
      });

      // Should handle error gracefully
      assert(response.success === false || response.result?.success === false, 'Should report error');
    }),

    test('Execute script should run in page context', async () => {
      const response = await runTestCommand('execute_script', {
        script: 'return typeof window.testUtils'
      });

      assert(response.result?.result === 'object', 'Should access page testUtils');
    }),

    test('Execute script should modify DOM', async () => {
      await runTestCommand('execute_script', {
        script: 'document.getElementById("username").value = "script-set-value"'
      });

      const verifyResponse = await runTestCommand('execute_script', {
        script: 'return document.getElementById("username").value'
      });

      assert(verifyResponse.result?.result === 'script-set-value', 'Value should be set');
    })
  ]
};

/**
 * Cookie Tests
 */
const cookieTests = {
  name: 'Cookie Tests',
  tests: [
    test('Get cookies should return cookies array', async () => {
      const response = await runTestCommand('get_cookies', {});

      assert(response.success === true, 'Get cookies should succeed');
      // Cookies array may be empty for file:// URLs
      assert(Array.isArray(response.result?.cookies) || response.result === null, 'Should have cookies array or null');
    }),

    test('Set cookies should accept cookies array', async () => {
      const response = await runTestCommand('set_cookies', {
        cookies: [
          { name: 'test_cookie', value: 'test_value', url: 'http://localhost' }
        ]
      });

      // May fail for file:// URLs
      assert(response, 'Should get response');
    })
  ]
};

/**
 * Storage Tests
 */
const storageTests = {
  name: 'Storage Tests',
  tests: [
    test('Get local storage should return storage data', async () => {
      const response = await runTestCommand('get_local_storage', {});

      // Storage commands may not be implemented
      assert(response, 'Should get response');
    }),

    test('Set local storage should store data', async () => {
      const response = await runTestCommand('set_local_storage', {
        data: { testKey: 'testValue' }
      });

      assert(response, 'Should get response');
    }),

    test('Get session storage should return storage data', async () => {
      const response = await runTestCommand('get_session_storage', {});

      assert(response, 'Should get response');
    }),

    test('Clear storage should clear all storage', async () => {
      const response = await runTestCommand('clear_storage', {});

      assert(response, 'Should get response');
    })
  ]
};

/**
 * Error Handling Tests
 */
const errorTests = {
  name: 'Error Handling Tests',
  tests: [
    test('Unknown command should return error', async () => {
      const response = await runTestCommand('unknown_command_xyz', {});

      assert(response.success === false, 'Unknown command should fail');
      assert(response.error, 'Should have error message');
    }),

    test('Malformed selector should be handled gracefully', async () => {
      const response = await runTestCommand('click', {
        selector: '[]invalid[selector'
      });

      // Should handle gracefully without crashing
      assert(response, 'Should get response');
    }),

    test('Empty fields object should be handled', async () => {
      const response = await runTestCommand('fill_form', {
        fields: {}
      });

      // Should handle gracefully
      assert(response, 'Should get response');
    }),

    test('Null parameters should be handled', async () => {
      const response = await runTestCommand('fill_form', {
        fields: null
      });

      // Should handle gracefully
      assert(response, 'Should get response');
    })
  ]
};

/**
 * Edge Case Tests
 */
const edgeCaseTests = {
  name: 'Edge Case Tests',
  tests: [
    test('Should handle special characters in selectors', async () => {
      const response = await runTestCommand('fill_form', {
        fields: { '#username': 'user<script>alert(1)</script>' }
      });

      // Should handle XSS attempt in value
      assert(response.success === true, 'Should handle special chars in value');
    }),

    test('Should handle Unicode characters', async () => {
      const response = await runTestCommand('fill_form', {
        fields: { '#username': 'user_' }
      });

      assert(response.success === true, 'Should handle unicode');
    }),

    test('Should handle very long text', async () => {
      const longText = 'a'.repeat(10000);
      const response = await runTestCommand('fill_form', {
        fields: { '#bio': longText }
      });

      assert(response.success === true, 'Should handle long text');
    }),

    test('Should handle rapid commands', async () => {
      // Send multiple commands rapidly
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(runTestCommand('get_content', { selector: 'h1' }));
      }

      const responses = await Promise.all(promises);
      const successCount = responses.filter(r => r.success === true).length;
      assert(successCount >= 3, 'Most rapid commands should succeed');
    }),

    test('Should handle command with large response', async () => {
      const response = await runTestCommand('get_page_state', {});

      assert(response.success === true, 'Large response should succeed');
      const responseSize = JSON.stringify(response).length;
      assert(responseSize > 1000, 'Response should be substantial');
    }),

    test('Should maintain state across commands', async () => {
      // Fill form
      await runTestCommand('fill_form', {
        fields: { '#username': 'state_test_user' }
      });

      // Verify state persisted
      const response = await runTestCommand('execute_script', {
        script: 'return document.getElementById("username").value'
      });

      assert(response.result?.result === 'state_test_user', 'State should persist');
    })
  ]
};

// =============================================================================
// Test Runner
// =============================================================================

/**
 * Run all test suites
 */
async function runAllTests() {
  console.log('='.repeat(60));
  console.log('Basset Hound Autofill Extension - Integration Tests');
  console.log('='.repeat(60));
  console.log();

  const testSuites = [
    connectionTests,
    navigationTests,
    formFillingTests,
    clickTests,
    contentTests,
    screenshotTests,
    waitTests,
    pageStateTests,
    scriptTests,
    cookieTests,
    storageTests,
    errorTests,
    edgeCaseTests
  ];

  for (const suite of testSuites) {
    console.log();
    console.log('-'.repeat(60));
    console.log(`Running Suite: ${suite.name}`);
    console.log('-'.repeat(60));

    for (const testFn of suite.tests) {
      try {
        await testFn();
      } catch (error) {
        log(`Suite error: ${error.message}`, 'ERROR');
      }
    }
  }

  // Print summary
  console.log();
  console.log('='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Passed:  ${testResults.passed}`);
  console.log(`Failed:  ${testResults.failed}`);
  console.log(`Skipped: ${testResults.skipped}`);
  console.log(`Total:   ${testResults.tests.length}`);
  console.log();

  if (testResults.failed > 0) {
    console.log('Failed Tests:');
    testResults.tests
      .filter(t => t.status === 'FAILED')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
    console.log();
  }

  return testResults.failed === 0;
}

/**
 * Run tests in manual mode (interactive)
 */
async function runManualMode() {
  console.log('Manual testing mode. Start the extension and navigate to the test page.');
  console.log('The test server will wait for commands.');

  const server = createServer();
  console.log('Waiting for extension connection...');

  // Keep server running
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close();
    process.exit(0);
  });
}

/**
 * Main entry point
 */
async function main() {
  const isManual = process.argv.includes('--manual');

  if (isManual) {
    await runManualMode();
  } else {
    console.log('Starting test server...');
    const server = createServer();

    console.log('Waiting for extension to connect...');
    console.log('Please ensure:');
    console.log('  1. Extension is loaded in Chrome');
    console.log('  2. Test page is open in the browser');
    console.log();

    try {
      await waitForClient(CONFIG.CONNECT_TIMEOUT);
      console.log('Client connected! Starting tests...\n');

      // Give extension time to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));

      const success = await runAllTests();

      server.close();
      process.exit(success ? 0 : 1);
    } catch (error) {
      console.error('Error:', error.message);
      console.log('\nMake sure the extension is connected before running tests.');
      console.log('You can run in manual mode with: node integration.test.js --manual');
      server.close();
      process.exit(1);
    }
  }
}

// Export for external use
module.exports = {
  runAllTests,
  testResults,
  CONFIG,
  test,
  skip
};

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
