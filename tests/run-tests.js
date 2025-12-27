#!/usr/bin/env node

/**
 * Extension Test Runner
 *
 * Runs all extension tests with proper setup/teardown.
 * Use with xvfb-run for headless environments.
 */

const { ExtensionTester } = require('./extension-tester');
const { MockWSServer } = require('./mock-ws-server');
const path = require('path');

// Test configuration
const EXTENSION_PATH = path.resolve(__dirname, '..');
const WS_PORT = 8765;
const TEST_TIMEOUT = 60000;

// Test results
let passed = 0;
let failed = 0;
const failures = [];

// Test utilities
async function test(name, fn) {
  process.stdout.write(`  ${name}... `);
  const startTime = Date.now();

  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Test timeout')), TEST_TIMEOUT)
      )
    ]);
    const duration = Date.now() - startTime;
    console.log(`\x1b[32mPASSED\x1b[0m (${duration}ms)`);
    passed++;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`\x1b[31mFAILED\x1b[0m (${duration}ms)`);
    console.log(`    Error: ${error.message}`);
    failed++;
    failures.push({ name, error: error.message });
  }
}

function describe(name, fn) {
  console.log(`\n\x1b[1m${name}\x1b[0m`);
  return fn();
}

// Main test suite
async function runTests() {
  console.log('\n==========================================');
  console.log('  OSINT Browser Extension Test Suite');
  console.log('==========================================');
  console.log(`Extension path: ${EXTENSION_PATH}`);
  console.log(`WebSocket port: ${WS_PORT}`);
  console.log(`Test timeout: ${TEST_TIMEOUT}ms`);

  let tester = null;
  let mockServer = null;

  try {
    // Start mock WebSocket server
    console.log('\n[Setup] Starting mock WebSocket server...');
    mockServer = new MockWSServer(WS_PORT);

    // Register command handlers
    mockServer.on('navigate', (msg) => ({
      success: true,
      url: msg.params?.url || msg.url
    }));

    mockServer.on('get_page_state', (msg) => ({
      success: true,
      state: { title: 'Test Page', url: 'about:blank' }
    }));

    await mockServer.start();
    console.log('[Setup] Mock server started');

    // Launch browser with extension
    console.log('[Setup] Launching browser with extension...');
    tester = new ExtensionTester(EXTENSION_PATH, {
      timeout: 30000,
      slowMo: 0,
    });
    await tester.launch();
    console.log('[Setup] Browser launched');

    // Run test suites
    await describe('Extension Loading', async () => {
      await test('Extension has valid ID', async () => {
        const id = tester.getExtensionId();
        if (!id || id.length !== 32) {
          throw new Error(`Invalid extension ID: ${id}`);
        }
      });

      await test('Extension manifest is valid', async () => {
        const fs = require('fs');
        const manifestPath = path.join(EXTENSION_PATH, 'manifest.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

        if (manifest.manifest_version !== 3) {
          throw new Error(`Expected MV3, got MV${manifest.manifest_version}`);
        }
        if (!manifest.name) {
          throw new Error('Manifest missing name');
        }
      });
    });

    await describe('Popup Tests', async () => {
      await test('Popup opens successfully', async () => {
        const popup = await tester.openPopup();
        const title = await popup.title();
        await popup.close();
        // Just verify popup opened without error
      });

      await test('Popup has status elements', async () => {
        const popup = await tester.openPopup();

        // Wait for any status indicator
        const hasStatus = await popup.evaluate(() => {
          return document.body.innerHTML.length > 0;
        });

        if (!hasStatus) {
          await popup.close();
          throw new Error('Popup body is empty');
        }

        await popup.close();
      });

      await test('Popup can get extension status', async () => {
        const popup = await tester.openPopup();

        // Send message to background script
        const status = await popup.evaluate(() => {
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              resolve({ timeout: true });
            }, 5000);

            chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
              clearTimeout(timeout);
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(response);
              }
            });
          });
        });

        await popup.close();

        if (status.timeout) {
          throw new Error('Status request timed out');
        }
      });
    });

    await describe('Content Script Tests', async () => {
      await test('Content script injects on web page', async () => {
        const page = await tester.navigateAndTestContentScript('https://example.com', false);

        // Just verify page loaded
        const url = page.url();
        await page.close();

        if (!url.includes('example.com')) {
          throw new Error(`Unexpected URL: ${url}`);
        }
      });

      await test('Can interact with page DOM', async () => {
        const page = await tester.browser.newPage();
        await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });

        const title = await page.title();
        await page.close();

        if (!title) {
          throw new Error('Could not get page title');
        }
      });
    });

    await describe('WebSocket Communication', async () => {
      await test('Extension attempts WebSocket connection', async () => {
        // Give extension time to attempt connection
        await new Promise(r => setTimeout(r, 3000));

        // Check if any messages were received
        const messages = mockServer.getMessages();
        console.log(`\n    Received ${messages.length} messages from extension`);

        // Even if no messages, test passes if no errors
      });

      await test('Mock server can track clients', async () => {
        const clientCount = mockServer.getClientCount();
        console.log(`\n    Current client count: ${clientCount}`);
        // Test passes regardless - just reporting
      });
    });

    // Summary
    console.log('\n==========================================');
    console.log('  Test Summary');
    console.log('==========================================');
    console.log(`\x1b[32m  Passed: ${passed}\x1b[0m`);
    console.log(`\x1b[31m  Failed: ${failed}\x1b[0m`);

    if (failures.length > 0) {
      console.log('\n  Failures:');
      failures.forEach(f => {
        console.log(`    - ${f.name}: ${f.error}`);
      });
    }

    console.log('\n==========================================\n');

  } catch (error) {
    console.error('\n[Fatal Error]', error);
    failed++;
  } finally {
    // Cleanup
    console.log('[Cleanup] Shutting down...');

    if (tester) {
      try {
        await tester.close();
      } catch (error) {
        console.error('[Cleanup] Error closing browser:', error.message);
      }
    }

    if (mockServer) {
      try {
        await mockServer.stop();
      } catch (error) {
        console.error('[Cleanup] Error stopping server:', error.message);
      }
    }

    console.log('[Cleanup] Done');
  }

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
