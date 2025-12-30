#!/usr/bin/env node

/**
 * Test script for Basset Hound MCP Server
 *
 * This script tests the MCP server by sending various JSON-RPC requests
 * and verifying the responses.
 */

const { spawn } = require('child_process');
const readline = require('readline');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

// Test cases
const tests = [
  {
    name: 'Initialize',
    request: {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      },
    },
    validate: (response) => {
      return (
        response.result &&
        response.result.protocolVersion === '2024-11-05' &&
        response.result.serverInfo &&
        response.result.serverInfo.name === 'basset-hound-mcp'
      );
    },
  },
  {
    name: 'List Tools',
    request: {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    },
    validate: (response) => {
      return (
        response.result &&
        response.result.tools &&
        Array.isArray(response.result.tools) &&
        response.result.tools.length > 70 // Should have 80+ tools
      );
    },
  },
  {
    name: 'Invalid Method',
    request: {
      jsonrpc: '2.0',
      id: 3,
      method: 'invalid/method',
      params: {},
    },
    validate: (response) => {
      return response.error && response.error.code === -32601; // Method not found
    },
  },
];

async function runTests() {
  log(colors.cyan, '\n=== Basset Hound MCP Server Test Suite ===\n');

  // Start the server
  log(colors.blue, 'Starting MCP server...');
  const server = spawn('node', ['index.js'], {
    cwd: __dirname,
    env: { ...process.env, DEBUG: 'false' },
  });

  let serverReady = false;
  let testsPassed = 0;
  let testsFailed = 0;

  // Create readline interface for server output
  const rl = readline.createInterface({
    input: server.stdout,
    crlfDelay: Infinity,
  });

  // Listen for server ready
  server.stderr.on('data', (data) => {
    const output = data.toString();
    if (output.includes('MCP Server ready')) {
      serverReady = true;
      log(colors.green, '✓ Server is ready\n');
      runTestSequence();
    }
    if (output.includes('ERROR')) {
      log(colors.red, 'Server error:', output);
    }
  });

  let responseBuffer = '';
  rl.on('line', (line) => {
    if (line.trim()) {
      responseBuffer = line;
    }
  });

  // Run test sequence
  async function runTestSequence() {
    log(colors.cyan, 'Running tests...\n');

    for (const test of tests) {
      try {
        log(colors.blue, `Testing: ${test.name}`);

        // Send request
        server.stdin.write(JSON.stringify(test.request) + '\n');

        // Wait for response
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (!responseBuffer) {
          throw new Error('No response received');
        }

        const response = JSON.parse(responseBuffer);
        responseBuffer = ''; // Clear buffer

        // Validate response
        if (test.validate(response)) {
          log(colors.green, `  ✓ PASSED`);
          testsPassed++;

          // Show some details for successful tests
          if (test.name === 'List Tools') {
            log(colors.cyan, `    Found ${response.result.tools.length} tools`);
          }
        } else {
          log(colors.red, `  ✗ FAILED: Validation failed`);
          log(colors.yellow, '    Response:', JSON.stringify(response, null, 2));
          testsFailed++;
        }
      } catch (error) {
        log(colors.red, `  ✗ FAILED: ${error.message}`);
        testsFailed++;
      }

      console.log(''); // Blank line
    }

    // Print summary
    log(colors.cyan, '\n=== Test Summary ===');
    log(colors.green, `Passed: ${testsPassed}/${tests.length}`);
    if (testsFailed > 0) {
      log(colors.red, `Failed: ${testsFailed}/${tests.length}`);
    }

    // Test WebSocket connection (informational only)
    log(colors.cyan, '\n=== WebSocket Connection Test ===');
    log(
      colors.yellow,
      'Note: WebSocket connection test requires Chrome extension to be running'
    );

    try {
      const WebSocket = require('ws');
      const ws = new WebSocket('ws://localhost:8765');

      ws.on('open', () => {
        log(colors.green, '✓ Successfully connected to Chrome extension');
        ws.close();
        cleanup(testsFailed === 0 ? 0 : 1);
      });

      ws.on('error', (error) => {
        log(
          colors.yellow,
          '⚠ Could not connect to Chrome extension:',
          error.message
        );
        log(
          colors.yellow,
          '  This is expected if the extension is not running'
        );
        cleanup(testsFailed === 0 ? 0 : 1);
      });

      // Timeout after 3 seconds
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          log(
            colors.yellow,
            '⚠ WebSocket connection timeout (extension may not be running)'
          );
          ws.terminate();
          cleanup(testsFailed === 0 ? 0 : 1);
        }
      }, 3000);
    } catch (error) {
      log(colors.yellow, '⚠ WebSocket test skipped:', error.message);
      cleanup(testsFailed === 0 ? 0 : 1);
    }
  }

  function cleanup(exitCode) {
    log(colors.cyan, '\nCleaning up...');
    server.kill();
    setTimeout(() => {
      process.exit(exitCode);
    }, 500);
  }

  // Handle timeout
  setTimeout(() => {
    if (!serverReady) {
      log(colors.red, '\n✗ Server failed to start within timeout');
      cleanup(1);
    }
  }, 10000);

  // Handle errors
  server.on('error', (error) => {
    log(colors.red, 'Failed to start server:', error.message);
    process.exit(1);
  });
}

// Run the tests
runTests().catch((error) => {
  log(colors.red, 'Test execution failed:', error.message);
  process.exit(1);
});
