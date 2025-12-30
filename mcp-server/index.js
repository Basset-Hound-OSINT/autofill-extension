#!/usr/bin/env node

/**
 * Basset Hound MCP Server
 *
 * Model Context Protocol (MCP) server for the Basset Hound browser automation extension.
 * This server connects to the Chrome extension via WebSocket and exposes all browser
 * automation commands as MCP tools, allowing AI agents like Claude to control the browser.
 *
 * @author Basset Hound Team
 * @license MIT
 */

const WebSocket = require('ws');
const { getTools } = require('./tools');

// Configuration
const CONFIG = {
  WS_URL: process.env.WS_URL || 'ws://localhost:8765',
  RECONNECT_DELAY: parseInt(process.env.RECONNECT_DELAY) || 5000,
  MAX_RECONNECT_ATTEMPTS: parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 10,
  COMMAND_TIMEOUT: parseInt(process.env.COMMAND_TIMEOUT) || 30000,
  DEBUG: process.env.DEBUG === 'true',
};

// Server state
let ws = null;
let reconnectAttempts = 0;
let reconnectTimeout = null;
let pendingCommands = new Map(); // command_id -> { resolve, reject, timeout }
let commandIdCounter = 0;

/**
 * Logger utility
 */
const logger = {
  debug: (...args) => {
    if (CONFIG.DEBUG) {
      console.error('[DEBUG]', new Date().toISOString(), ...args);
    }
  },
  info: (...args) => console.error('[INFO]', new Date().toISOString(), ...args),
  warn: (...args) => console.error('[WARN]', new Date().toISOString(), ...args),
  error: (...args) => console.error('[ERROR]', new Date().toISOString(), ...args),
};

/**
 * Connect to the Chrome extension WebSocket server
 */
function connectWebSocket() {
  logger.info('Connecting to Basset Hound extension at', CONFIG.WS_URL);

  try {
    ws = new WebSocket(CONFIG.WS_URL);

    ws.on('open', () => {
      logger.info('Connected to Basset Hound extension');
      reconnectAttempts = 0;

      // Clear any pending reconnect timeout
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(message);
      } catch (error) {
        logger.error('Failed to parse WebSocket message:', error.message);
      }
    });

    ws.on('close', (code, reason) => {
      logger.warn('WebSocket connection closed:', code, reason.toString());
      ws = null;
      scheduleReconnect();
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error.message);
    });

  } catch (error) {
    logger.error('Failed to create WebSocket connection:', error.message);
    scheduleReconnect();
  }
}

/**
 * Schedule a reconnection attempt with exponential backoff
 */
function scheduleReconnect() {
  if (reconnectAttempts >= CONFIG.MAX_RECONNECT_ATTEMPTS) {
    logger.error('Max reconnection attempts reached, giving up');
    process.exit(1);
  }

  const delay = Math.min(
    CONFIG.RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
    60000 // Max 60 seconds
  );

  reconnectAttempts++;
  logger.info(`Scheduling reconnection attempt ${reconnectAttempts}/${CONFIG.MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);

  reconnectTimeout = setTimeout(() => {
    connectWebSocket();
  }, delay);
}

/**
 * Handle incoming WebSocket messages
 */
function handleMessage(message) {
  logger.debug('Received message:', JSON.stringify(message));

  // Handle heartbeat responses
  if (message.type === 'heartbeat_response') {
    return;
  }

  // Handle command responses
  if (message.command_id && pendingCommands.has(message.command_id)) {
    const pending = pendingCommands.get(message.command_id);
    clearTimeout(pending.timeout);
    pendingCommands.delete(message.command_id);

    if (message.success) {
      pending.resolve(message.result);
    } else {
      pending.reject(new Error(message.error || 'Command failed'));
    }
  }

  // Handle notifications (captcha_detected, tab_state_changed, etc.)
  if (message.type && !message.command_id) {
    logger.info('Notification:', message.type, JSON.stringify(message));
  }
}

/**
 * Send a command to the Chrome extension and wait for response
 * @param {string} type - Command type
 * @param {object} params - Command parameters
 * @returns {Promise<any>} Command result
 */
function sendCommand(type, params = {}) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error('WebSocket not connected'));
      return;
    }

    const command_id = `mcp_${++commandIdCounter}_${Date.now()}`;
    const command = {
      command_id,
      type,
      params,
    };

    // Set up timeout
    const timeout = setTimeout(() => {
      if (pendingCommands.has(command_id)) {
        pendingCommands.delete(command_id);
        reject(new Error(`Command timeout after ${CONFIG.COMMAND_TIMEOUT}ms`));
      }
    }, CONFIG.COMMAND_TIMEOUT);

    // Store pending command
    pendingCommands.set(command_id, { resolve, reject, timeout });

    // Send command
    try {
      ws.send(JSON.stringify(command));
      logger.debug('Sent command:', JSON.stringify(command));
    } catch (error) {
      clearTimeout(timeout);
      pendingCommands.delete(command_id);
      reject(new Error(`Failed to send command: ${error.message}`));
    }
  });
}

/**
 * MCP Protocol Handler
 *
 * Implements the Model Context Protocol specification for communication
 * with AI agents like Claude.
 */

// Read from stdin and write to stdout (MCP stdio transport)
let inputBuffer = '';

process.stdin.on('data', (chunk) => {
  inputBuffer += chunk.toString();

  // Process complete lines
  const lines = inputBuffer.split('\n');
  inputBuffer = lines.pop(); // Keep incomplete line in buffer

  for (const line of lines) {
    if (line.trim()) {
      handleMcpRequest(line.trim());
    }
  }
});

/**
 * Handle MCP protocol requests
 */
async function handleMcpRequest(line) {
  try {
    const request = JSON.parse(line);
    logger.debug('MCP Request:', JSON.stringify(request));

    let response = {
      jsonrpc: '2.0',
      id: request.id,
    };

    try {
      switch (request.method) {
        case 'initialize':
          response.result = await handleInitialize(request.params);
          break;

        case 'tools/list':
          response.result = await handleToolsList();
          break;

        case 'tools/call':
          response.result = await handleToolCall(request.params);
          break;

        case 'notifications/initialized':
          // Client has initialized, no response needed
          return;

        default:
          response.error = {
            code: -32601,
            message: `Method not found: ${request.method}`,
          };
      }
    } catch (error) {
      logger.error('Error handling MCP request:', error);
      response.error = {
        code: -32603,
        message: error.message,
        data: {
          stack: error.stack,
        },
      };
    }

    sendMcpResponse(response);
  } catch (error) {
    logger.error('Failed to parse MCP request:', error.message);
  }
}

/**
 * Send MCP response to stdout
 */
function sendMcpResponse(response) {
  const line = JSON.stringify(response);
  logger.debug('MCP Response:', line);
  process.stdout.write(line + '\n');
}

/**
 * Handle MCP initialize request
 */
async function handleInitialize(params) {
  logger.info('MCP client initializing:', params?.clientInfo);

  return {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {
        listChanged: false,
      },
    },
    serverInfo: {
      name: 'basset-hound-mcp',
      version: '1.0.0',
    },
  };
}

/**
 * Handle tools/list request
 */
async function handleToolsList() {
  const tools = getTools();
  logger.debug(`Returning ${tools.length} tools`);

  return {
    tools: tools,
  };
}

/**
 * Handle tools/call request
 */
async function handleToolCall(params) {
  const { name, arguments: args } = params;

  logger.info(`Calling tool: ${name}`);
  logger.debug('Tool arguments:', JSON.stringify(args));

  try {
    // Execute the browser command
    const result = await sendCommand(name, args);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    logger.error(`Tool call failed: ${name}`, error.message);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            success: false,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Graceful shutdown
 */
function shutdown() {
  logger.info('Shutting down MCP server');

  // Clear pending commands
  for (const [command_id, pending] of pendingCommands.entries()) {
    clearTimeout(pending.timeout);
    pending.reject(new Error('Server shutting down'));
  }
  pendingCommands.clear();

  // Clear reconnect timeout
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }

  // Close WebSocket
  if (ws) {
    ws.close(1000, 'Server shutdown');
  }

  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the server
logger.info('Basset Hound MCP Server starting...');
logger.info('Configuration:', {
  WS_URL: CONFIG.WS_URL,
  COMMAND_TIMEOUT: CONFIG.COMMAND_TIMEOUT,
  DEBUG: CONFIG.DEBUG,
});

connectWebSocket();

// Send server ready notification
logger.info('MCP Server ready and listening for requests');
