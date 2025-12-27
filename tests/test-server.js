/**
 * Basset Hound Autofill Extension - WebSocket Test Server
 *
 * A simple WebSocket server for testing the browser extension's
 * communication capabilities and command handling.
 *
 * Usage: node test-server.js [port]
 * Default port: 8765
 */

const WebSocket = require('ws');

// Configuration
const PORT = process.argv[2] ? parseInt(process.argv[2]) : 8765;
const PATH = '/browser';

// Test state tracking
const testState = {
  connectedClients: new Map(),
  commandHistory: [],
  responseHistory: [],
  lastHeartbeat: null,
  testMode: null
};

// Command ID counter
let commandIdCounter = 1;

/**
 * Generate a unique command ID
 */
function generateCommandId() {
  return `cmd-${Date.now()}-${commandIdCounter++}`;
}

/**
 * Create the WebSocket server
 */
function createServer() {
  const server = new WebSocket.Server({
    port: PORT,
    path: PATH
  });

  console.log(`[Test Server] Starting on ws://localhost:${PORT}${PATH}`);

  server.on('connection', (ws, req) => {
    const clientId = `client-${Date.now()}`;
    testState.connectedClients.set(ws, {
      id: clientId,
      connectedAt: new Date(),
      address: req.socket.remoteAddress,
      messageCount: 0
    });

    console.log(`[Test Server] Client connected: ${clientId} from ${req.socket.remoteAddress}`);

    // Send initial status
    ws.send(JSON.stringify({
      type: 'status',
      status: 'connected',
      clientId,
      timestamp: Date.now()
    }));

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(ws, message);
      } catch (error) {
        console.error(`[Test Server] Failed to parse message:`, error);
        ws.send(JSON.stringify({
          success: false,
          error: 'Invalid JSON message'
        }));
      }
    });

    ws.on('close', (code, reason) => {
      const clientInfo = testState.connectedClients.get(ws);
      console.log(`[Test Server] Client disconnected: ${clientInfo?.id} (code: ${code})`);
      testState.connectedClients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error(`[Test Server] Client error:`, error);
    });
  });

  server.on('error', (error) => {
    console.error(`[Test Server] Server error:`, error);
  });

  return server;
}

/**
 * Handle incoming messages from clients
 */
function handleMessage(ws, message) {
  const clientInfo = testState.connectedClients.get(ws);
  if (clientInfo) {
    clientInfo.messageCount++;
  }

  console.log(`[Test Server] Received:`, JSON.stringify(message, null, 2));

  // Handle heartbeat
  if (message.type === 'heartbeat') {
    testState.lastHeartbeat = {
      timestamp: message.timestamp,
      receivedAt: Date.now()
    };
    console.log(`[Test Server] Heartbeat received`);
    return;
  }

  // Handle status updates
  if (message.type === 'status') {
    console.log(`[Test Server] Status update: ${message.status}`);
    return;
  }

  // Handle command responses
  if (message.command_id) {
    testState.responseHistory.push({
      ...message,
      receivedAt: Date.now()
    });
    console.log(`[Test Server] Response for ${message.command_id}: success=${message.success}`);
    return;
  }

  // Unknown message type
  console.log(`[Test Server] Unknown message type:`, message);
}

/**
 * Send a command to all connected clients
 */
function broadcastCommand(type, params = {}) {
  const command = {
    command_id: generateCommandId(),
    type,
    params
  };

  testState.commandHistory.push({
    ...command,
    sentAt: Date.now()
  });

  const data = JSON.stringify(command);
  testState.connectedClients.forEach((clientInfo, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
      console.log(`[Test Server] Sent command ${command.command_id} to ${clientInfo.id}`);
    }
  });

  return command.command_id;
}

/**
 * Send a command to a specific client
 */
function sendCommand(ws, type, params = {}) {
  if (ws.readyState !== WebSocket.OPEN) {
    console.error('[Test Server] Cannot send command, client not connected');
    return null;
  }

  const command = {
    command_id: generateCommandId(),
    type,
    params
  };

  testState.commandHistory.push({
    ...command,
    sentAt: Date.now()
  });

  ws.send(JSON.stringify(command));
  console.log(`[Test Server] Sent command: ${type} (${command.command_id})`);
  return command.command_id;
}

/**
 * Get a connected client (first one if multiple)
 */
function getClient() {
  for (const [ws, info] of testState.connectedClients) {
    if (ws.readyState === WebSocket.OPEN) {
      return ws;
    }
  }
  return null;
}

/**
 * Wait for a response to a specific command
 */
function waitForResponse(commandId, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkResponse = () => {
      const response = testState.responseHistory.find(r => r.command_id === commandId);
      if (response) {
        resolve(response);
        return;
      }

      if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout waiting for response to ${commandId}`));
        return;
      }

      setTimeout(checkResponse, 100);
    };

    checkResponse();
  });
}

/**
 * Run a test command and wait for response
 */
async function runTestCommand(type, params = {}, timeout = 30000) {
  const client = getClient();
  if (!client) {
    throw new Error('No connected client');
  }

  const commandId = sendCommand(client, type, params);
  return waitForResponse(commandId, timeout);
}

/**
 * Interactive command line interface for manual testing
 */
function startCLI() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n[Test Server] Interactive mode. Commands:');
  console.log('  navigate <url>          - Navigate to URL');
  console.log('  click <selector>        - Click element');
  console.log('  fill <selector> <value> - Fill form field');
  console.log('  content [selector]      - Get page content');
  console.log('  screenshot              - Capture screenshot');
  console.log('  state                   - Get page state');
  console.log('  wait <selector>         - Wait for element');
  console.log('  script <code>           - Execute JavaScript');
  console.log('  clients                 - List connected clients');
  console.log('  history                 - Show command history');
  console.log('  quit                    - Exit server\n');

  const prompt = () => {
    rl.question('> ', async (input) => {
      const parts = input.trim().split(' ');
      const cmd = parts[0].toLowerCase();

      try {
        switch (cmd) {
          case 'navigate':
            if (parts[1]) {
              const response = await runTestCommand('navigate', { url: parts[1] });
              console.log('Response:', JSON.stringify(response, null, 2));
            } else {
              console.log('Usage: navigate <url>');
            }
            break;

          case 'click':
            if (parts[1]) {
              const response = await runTestCommand('click', { selector: parts.slice(1).join(' ') });
              console.log('Response:', JSON.stringify(response, null, 2));
            } else {
              console.log('Usage: click <selector>');
            }
            break;

          case 'fill':
            if (parts[1] && parts[2]) {
              const response = await runTestCommand('fill_form', {
                fields: { [parts[1]]: parts.slice(2).join(' ') }
              });
              console.log('Response:', JSON.stringify(response, null, 2));
            } else {
              console.log('Usage: fill <selector> <value>');
            }
            break;

          case 'content':
            const contentResponse = await runTestCommand('get_content', {
              selector: parts[1] || undefined
            });
            console.log('Response:', JSON.stringify(contentResponse, null, 2));
            break;

          case 'screenshot':
            const ssResponse = await runTestCommand('screenshot', {});
            console.log('Response: screenshot captured, length:', ssResponse.result?.screenshot?.length);
            break;

          case 'state':
            const stateResponse = await runTestCommand('get_page_state', {});
            console.log('Response:', JSON.stringify(stateResponse, null, 2));
            break;

          case 'wait':
            if (parts[1]) {
              const waitResponse = await runTestCommand('wait_for_element', {
                selector: parts.slice(1).join(' '),
                timeout: 10000
              });
              console.log('Response:', JSON.stringify(waitResponse, null, 2));
            } else {
              console.log('Usage: wait <selector>');
            }
            break;

          case 'script':
            if (parts[1]) {
              const scriptResponse = await runTestCommand('execute_script', {
                script: parts.slice(1).join(' ')
              });
              console.log('Response:', JSON.stringify(scriptResponse, null, 2));
            } else {
              console.log('Usage: script <code>');
            }
            break;

          case 'clients':
            console.log('Connected clients:');
            testState.connectedClients.forEach((info, ws) => {
              console.log(`  - ${info.id}: messages=${info.messageCount}, connected=${info.connectedAt}`);
            });
            break;

          case 'history':
            console.log('Command history:');
            testState.commandHistory.slice(-10).forEach(cmd => {
              console.log(`  ${cmd.command_id}: ${cmd.type} at ${new Date(cmd.sentAt).toISOString()}`);
            });
            break;

          case 'quit':
          case 'exit':
            console.log('Shutting down server...');
            process.exit(0);
            break;

          default:
            if (cmd) {
              console.log(`Unknown command: ${cmd}`);
            }
        }
      } catch (error) {
        console.error('Error:', error.message);
      }

      prompt();
    });
  };

  prompt();
}

// Export for programmatic use
module.exports = {
  createServer,
  broadcastCommand,
  sendCommand,
  getClient,
  waitForResponse,
  runTestCommand,
  testState,
  generateCommandId
};

// Start server if run directly
if (require.main === module) {
  const server = createServer();

  server.on('listening', () => {
    console.log(`[Test Server] Listening on ws://localhost:${PORT}${PATH}`);
    console.log('[Test Server] Waiting for extension to connect...');

    // Start CLI after a short delay
    setTimeout(() => {
      if (process.stdin.isTTY) {
        startCLI();
      }
    }, 1000);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[Test Server] Shutting down...');
    server.close();
    process.exit(0);
  });
}
