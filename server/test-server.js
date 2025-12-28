#!/usr/bin/env node
/**
 * Test WebSocket Server for Chrome Extension
 *
 * A development/testing server that connects to the browser automation extension.
 * Features:
 * - WebSocket server on port 8765 with /browser endpoint
 * - Colored console output with timestamps
 * - Heartbeat handling
 * - Extension error message display
 * - Interactive command-line interface
 *
 * Usage: node server/test-server.js
 */

const WebSocket = require('ws');
const http = require('http');
const readline = require('readline');

// Configuration
const PORT = 8765;
const ENDPOINT = '/browser';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

// Helper functions for colored output
function colorize(text, ...colorCodes) {
  return colorCodes.join('') + text + colors.reset;
}

function timestamp() {
  return colorize(`[${new Date().toISOString()}]`, colors.gray);
}

function log(message, color = colors.white) {
  console.log(`${timestamp()} ${colorize(message, color)}`);
}

function logSuccess(message) {
  console.log(`${timestamp()} ${colorize('[SUCCESS]', colors.green, colors.bright)} ${message}`);
}

function logError(message) {
  console.log(`${timestamp()} ${colorize('[ERROR]', colors.red, colors.bright)} ${message}`);
}

function logWarning(message) {
  console.log(`${timestamp()} ${colorize('[WARNING]', colors.yellow, colors.bright)} ${message}`);
}

function logInfo(message) {
  console.log(`${timestamp()} ${colorize('[INFO]', colors.blue, colors.bright)} ${message}`);
}

function logHeartbeat(message) {
  console.log(`${timestamp()} ${colorize('[HEARTBEAT]', colors.magenta)} ${message}`);
}

function logCommand(message) {
  console.log(`${timestamp()} ${colorize('[COMMAND]', colors.cyan, colors.bright)} ${message}`);
}

function prettyPrintJSON(obj, indent = 2) {
  const json = JSON.stringify(obj, null, indent);
  // Add some color highlighting to JSON
  return json
    .replace(/"([^"]+)":/g, colorize('"$1":', colors.cyan) + colors.reset)
    .replace(/: "([^"]+)"/g, ': ' + colorize('"$1"', colors.green))
    .replace(/: (\d+)/g, ': ' + colorize('$1', colors.yellow))
    .replace(/: (true|false)/g, ': ' + colorize('$1', colors.magenta))
    .replace(/: (null)/g, ': ' + colorize('$1', colors.gray));
}

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'running',
    websocket: `ws://localhost:${PORT}${ENDPOINT}`,
    clients: wss ? wss.clients.size : 0
  }));
});

// Create WebSocket server
const wss = new WebSocket.Server({ server, path: ENDPOINT });

// Track connected clients
let clientCounter = 0;
const clients = new Map();

// Command ID counter
let commandId = 0;

// Print banner
function printBanner() {
  console.log(colorize(`
  ╔════════════════════════════════════════════════════════════════╗
  ║                                                                ║
  ║   ${colorize('WebSocket Test Server', colors.cyan, colors.bright)}${colorize('                                  ║', colors.white)}
  ║   ${colorize('Chrome Extension Development Server', colors.gray)}${colorize('                      ║', colors.white)}
  ║                                                                ║
  ╠════════════════════════════════════════════════════════════════╣
  ║                                                                ║
  ║   WebSocket:  ${colorize(`ws://localhost:${PORT}${ENDPOINT}`, colors.green)}${colorize('                     ║', colors.white)}
  ║   HTTP:       ${colorize(`http://localhost:${PORT}`, colors.green)}${colorize('                            ║', colors.white)}
  ║                                                                ║
  ╚════════════════════════════════════════════════════════════════╝
`, colors.white));
}

function printHelp() {
  console.log(colorize('\n  Available Commands:', colors.bright));
  console.log(colorize('  ─────────────────────────────────────────────────────────────', colors.gray));
  console.log(`  ${colorize('navigate <url>', colors.cyan)}      Navigate to a URL`);
  console.log(`  ${colorize('get_page_state', colors.cyan)}      Get current page information`);
  console.log(`  ${colorize('detect_forms', colors.cyan)}        Find forms on the current page`);
  console.log(`  ${colorize('screenshot', colors.cyan)}          Take a screenshot of the current tab`);
  console.log(colorize('  ─────────────────────────────────────────────────────────────', colors.gray));
  console.log(`  ${colorize('tabs', colors.cyan)}                List all open tabs`);
  console.log(`  ${colorize('cookies', colors.cyan)}             Get cookies for current domain`);
  console.log(`  ${colorize('captcha', colors.cyan)}             Detect CAPTCHAs on the page`);
  console.log(`  ${colorize('click <selector>', colors.cyan)}    Click an element`);
  console.log(`  ${colorize('type <sel> <text>', colors.cyan)}   Type text into an element`);
  console.log(colorize('  ─────────────────────────────────────────────────────────────', colors.gray));
  console.log(`  ${colorize('raw <json>', colors.cyan)}          Send raw JSON command`);
  console.log(`  ${colorize('clients', colors.cyan)}             Show connected clients`);
  console.log(`  ${colorize('help', colors.cyan)}                Show this help message`);
  console.log(`  ${colorize('quit', colors.cyan)}                Exit the server`);
  console.log(colorize('  ─────────────────────────────────────────────────────────────\n', colors.gray));
}

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  clientCounter++;
  const clientId = clientCounter;
  const clientInfo = {
    id: clientId,
    ws: ws,
    ip: req.socket.remoteAddress,
    connectedAt: new Date(),
    lastHeartbeat: null,
    messageCount: 0
  };
  clients.set(clientId, clientInfo);

  logSuccess(`Client #${clientId} connected from ${clientInfo.ip}`);
  log(`Total clients: ${clients.size}`, colors.gray);

  // Send welcome message
  const welcomeMsg = {
    type: 'connected',
    message: 'Connected to Test WebSocket Server',
    clientId: clientId,
    timestamp: Date.now(),
    serverVersion: '1.0.0'
  };
  ws.send(JSON.stringify(welcomeMsg));

  // Handle incoming messages
  ws.on('message', (data) => {
    clientInfo.messageCount++;

    try {
      const message = JSON.parse(data.toString());
      handleMessage(clientId, message);
    } catch (e) {
      logWarning(`Client #${clientId} sent non-JSON message: ${data.toString().substring(0, 100)}`);
    }
  });

  // Handle disconnection
  ws.on('close', (code, reason) => {
    clients.delete(clientId);
    logWarning(`Client #${clientId} disconnected (code: ${code}, reason: ${reason || 'none'})`);
    log(`Total clients: ${clients.size}`, colors.gray);
  });

  // Handle errors
  ws.on('error', (error) => {
    logError(`Client #${clientId} error: ${error.message}`);
  });
});

// Handle incoming messages from extension
function handleMessage(clientId, message) {
  const { type } = message;

  switch (type) {
    case 'heartbeat':
    case 'ping':
      handleHeartbeat(clientId, message);
      break;

    case 'extension_error':
      handleExtensionError(clientId, message);
      break;

    case 'status':
      handleStatus(clientId, message);
      break;

    case 'response':
      handleResponse(clientId, message);
      break;

    case 'event':
      handleEvent(clientId, message);
      break;

    default:
      logInfo(`Client #${clientId} sent message (type: ${type || 'unknown'}):`);
      console.log(prettyPrintJSON(message));
  }
}

function handleHeartbeat(clientId, message) {
  const client = clients.get(clientId);
  if (client) {
    client.lastHeartbeat = new Date();
  }

  logHeartbeat(`Client #${clientId} - Responding to heartbeat`);

  // Send heartbeat response
  const response = {
    type: 'heartbeat_ack',
    timestamp: Date.now(),
    received: message.timestamp || null
  };

  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(response));
  }
}

function handleExtensionError(clientId, message) {
  console.log('');
  console.log(colorize('  ╔══════════════════════════════════════════════════════════════╗', colors.red));
  console.log(colorize('  ║  EXTENSION ERROR RECEIVED                                    ║', colors.red, colors.bright));
  console.log(colorize('  ╠══════════════════════════════════════════════════════════════╣', colors.red));
  console.log(colorize(`  ║  Client: #${clientId}`, colors.red));
  console.log(colorize(`  ║  Time:   ${new Date().toISOString()}`, colors.red));
  console.log(colorize('  ╠══════════════════════════════════════════════════════════════╣', colors.red));

  if (message.error) {
    console.log(colorize(`  ║  Error:   ${message.error}`, colors.red));
  }
  if (message.message) {
    console.log(colorize(`  ║  Message: ${message.message}`, colors.red));
  }
  if (message.stack) {
    console.log(colorize('  ║  Stack trace:', colors.red));
    message.stack.split('\n').forEach(line => {
      console.log(colorize(`  ║    ${line}`, colors.red, colors.dim));
    });
  }
  if (message.context) {
    console.log(colorize(`  ║  Context: ${JSON.stringify(message.context)}`, colors.red));
  }

  console.log(colorize('  ╚══════════════════════════════════════════════════════════════╝', colors.red));
  console.log('');
}

function handleStatus(clientId, message) {
  logInfo(`Client #${clientId} status update: ${colorize(message.status || 'unknown', colors.green)}`);
  if (message.details) {
    console.log(prettyPrintJSON(message.details));
  }
}

function handleResponse(clientId, message) {
  const { command_id, success, command, data, error } = message;

  if (success) {
    logSuccess(`Command ${command_id} (${command || 'unknown'}) completed successfully`);
  } else {
    logError(`Command ${command_id} (${command || 'unknown'}) failed: ${error || 'Unknown error'}`);
  }

  if (data) {
    console.log(colorize('  Response data:', colors.gray));
    // Truncate very long responses
    const jsonStr = JSON.stringify(data, null, 2);
    if (jsonStr.length > 2000) {
      console.log(prettyPrintJSON(data).substring(0, 2000) + '\n  ... (truncated)');
    } else {
      console.log(prettyPrintJSON(data));
    }
  }
}

function handleEvent(clientId, message) {
  logInfo(`Client #${clientId} event: ${colorize(message.event || 'unknown', colors.magenta)}`);
  if (message.data) {
    console.log(prettyPrintJSON(message.data));
  }
}

// Send command to all connected clients
function sendCommand(command) {
  if (clients.size === 0) {
    logWarning('No clients connected');
    return false;
  }

  const msgStr = JSON.stringify(command);
  let sent = 0;

  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msgStr);
      sent++;
    }
  });

  logCommand(`Sent to ${sent} client(s):`);
  console.log(prettyPrintJSON(command));
  return sent > 0;
}

// Generate next command ID
function nextCommandId() {
  commandId++;
  return `cmd_${commandId}_${Date.now()}`;
}

// Parse and execute command line input
function executeCommand(input) {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  let message = null;

  switch (cmd) {
    case 'navigate':
      const url = args.join(' ') || 'https://example.com';
      message = {
        command_id: nextCommandId(),
        type: 'navigate',
        params: { url }
      };
      break;

    case 'get_page_state':
    case 'state':
    case 'page':
      message = {
        command_id: nextCommandId(),
        type: 'get_page_state',
        params: {}
      };
      break;

    case 'detect_forms':
    case 'forms':
      message = {
        command_id: nextCommandId(),
        type: 'detect_forms',
        params: {}
      };
      break;

    case 'screenshot':
    case 'ss':
      message = {
        command_id: nextCommandId(),
        type: 'screenshot',
        params: {
          format: args[0] || 'png',
          quality: args[1] ? parseInt(args[1]) : 80
        }
      };
      break;

    case 'tabs':
      message = {
        command_id: nextCommandId(),
        type: 'get_tabs',
        params: {}
      };
      break;

    case 'cookies':
      message = {
        command_id: nextCommandId(),
        type: 'get_cookies',
        params: { domain: args[0] || null }
      };
      break;

    case 'captcha':
      message = {
        command_id: nextCommandId(),
        type: 'detect_captcha',
        params: {}
      };
      break;

    case 'click':
      if (!args[0]) {
        logError('Usage: click <selector>');
        return;
      }
      message = {
        command_id: nextCommandId(),
        type: 'click',
        params: { selector: args.join(' ') }
      };
      break;

    case 'type':
      if (args.length < 2) {
        logError('Usage: type <selector> <text>');
        return;
      }
      message = {
        command_id: nextCommandId(),
        type: 'type',
        params: {
          selector: args[0],
          text: args.slice(1).join(' ')
        }
      };
      break;

    case 'raw':
      try {
        const jsonStr = args.join(' ');
        message = JSON.parse(jsonStr);
        if (!message.command_id) {
          message.command_id = nextCommandId();
        }
      } catch (e) {
        logError(`Invalid JSON: ${e.message}`);
        return;
      }
      break;

    case 'clients':
      console.log(colorize('\n  Connected Clients:', colors.bright));
      console.log(colorize('  ─────────────────────────────────────────────────────────────', colors.gray));
      if (clients.size === 0) {
        console.log(colorize('  No clients connected', colors.yellow));
      } else {
        clients.forEach((client, id) => {
          const heartbeatAgo = client.lastHeartbeat
            ? `${Math.round((Date.now() - client.lastHeartbeat.getTime()) / 1000)}s ago`
            : 'never';
          console.log(`  ${colorize(`#${id}`, colors.cyan)} - ${client.ip} - Connected: ${client.connectedAt.toISOString()}`);
          console.log(`       Messages: ${client.messageCount}, Last heartbeat: ${heartbeatAgo}`);
        });
      }
      console.log(colorize('  ─────────────────────────────────────────────────────────────\n', colors.gray));
      return;

    case 'help':
    case '?':
      printHelp();
      return;

    case 'quit':
    case 'exit':
    case 'q':
      log('Shutting down server...', colors.yellow);
      shutdown();
      return;

    case '':
      return;

    default:
      logWarning(`Unknown command: ${cmd}. Type 'help' for available commands.`);
      return;
  }

  if (message) {
    sendCommand(message);
  }
}

// Setup readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', (input) => {
  executeCommand(input);
});

rl.on('close', () => {
  shutdown();
});

// Graceful shutdown
function shutdown() {
  log('Closing connections...', colors.yellow);

  // Close all client connections
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.close(1000, 'Server shutting down');
    }
  });

  wss.close(() => {
    server.close(() => {
      log('Server shut down gracefully', colors.green);
      process.exit(0);
    });
  });

  // Force exit after timeout
  setTimeout(() => {
    logWarning('Forcing shutdown...');
    process.exit(0);
  }, 3000);
}

// Handle process signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logError(`Uncaught exception: ${error.message}`);
  console.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  logError(`Unhandled rejection: ${reason}`);
});

// Start the server
server.listen(PORT, () => {
  printBanner();
  printHelp();
  logSuccess(`Server is running on port ${PORT}`);
  log('Waiting for extension to connect...', colors.gray);
  console.log('');
});
