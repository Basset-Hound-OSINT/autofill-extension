/**
 * Test Helpers for Integration Tests
 *
 * Provides WebSocket client utilities, message matchers, and timeout utilities
 * for testing the Chrome extension against a real or mock WebSocket server.
 */

const WebSocket = require('ws');

// Default configuration
const DEFAULT_CONFIG = {
  WS_URL: 'ws://localhost:8765/browser',
  CONNECTION_TIMEOUT: 5000,
  MESSAGE_TIMEOUT: 10000,
  HEARTBEAT_INTERVAL: 30000
};

/**
 * WebSocket Test Client
 *
 * A wrapper around WebSocket for use in tests with built-in
 * message queuing, promise-based APIs, and test utilities.
 */
class TestWebSocketClient {
  /**
   * Create a new test WebSocket client
   * @param {string} url - WebSocket URL
   * @param {Object} options - Configuration options
   */
  constructor(url = DEFAULT_CONFIG.WS_URL, options = {}) {
    this.url = url;
    this.options = {
      connectionTimeout: options.connectionTimeout || DEFAULT_CONFIG.CONNECTION_TIMEOUT,
      messageTimeout: options.messageTimeout || DEFAULT_CONFIG.MESSAGE_TIMEOUT,
      autoReconnect: options.autoReconnect || false,
      ...options
    };

    this.ws = null;
    this.isConnected = false;
    this.messageQueue = [];
    this.sentMessages = [];
    this.pendingResponses = new Map();
    this.eventHandlers = {
      open: [],
      close: [],
      error: [],
      message: []
    };
    this.commandIdCounter = 1;
  }

  /**
   * Connect to the WebSocket server
   * @returns {Promise<void>}
   */
  connect() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout after ${this.options.connectionTimeout}ms`));
      }, this.options.connectionTimeout);

      try {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
          clearTimeout(timeout);
          this.isConnected = true;
          this._triggerEvent('open', { type: 'open' });
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.messageQueue.push({
              data: message,
              timestamp: Date.now()
            });

            // Check for pending response
            if (message.command_id && this.pendingResponses.has(message.command_id)) {
              const { resolve: pendingResolve } = this.pendingResponses.get(message.command_id);
              this.pendingResponses.delete(message.command_id);
              pendingResolve(message);
            }

            this._triggerEvent('message', { type: 'message', data: message });
          } catch (e) {
            // Handle non-JSON messages
            this.messageQueue.push({
              data: data.toString(),
              timestamp: Date.now(),
              raw: true
            });
          }
        });

        this.ws.on('close', (code, reason) => {
          this.isConnected = false;
          this._triggerEvent('close', {
            type: 'close',
            code,
            reason: reason.toString(),
            wasClean: code === 1000
          });
        });

        this.ws.on('error', (error) => {
          clearTimeout(timeout);
          this._triggerEvent('error', { type: 'error', error });
          if (!this.isConnected) {
            reject(error);
          }
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   * @param {number} code - Close code
   * @param {string} reason - Close reason
   * @returns {Promise<void>}
   */
  disconnect(code = 1000, reason = 'Test completed') {
    return new Promise((resolve) => {
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }

      this.ws.once('close', () => {
        this.isConnected = false;
        resolve();
      });

      this.ws.close(code, reason);

      // Timeout fallback
      setTimeout(() => {
        this.isConnected = false;
        resolve();
      }, 1000);
    });
  }

  /**
   * Send a raw message
   * @param {Object|string} message - Message to send
   */
  send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const data = typeof message === 'string' ? message : JSON.stringify(message);
    this.ws.send(data);
    this.sentMessages.push({
      data: typeof message === 'string' ? message : { ...message },
      timestamp: Date.now()
    });
  }

  /**
   * Send a command and wait for response
   * @param {string} type - Command type
   * @param {Object} params - Command parameters
   * @param {number} timeout - Response timeout
   * @returns {Promise<Object>}
   */
  sendCommand(type, params = {}, timeout = this.options.messageTimeout) {
    return new Promise((resolve, reject) => {
      const commandId = `test-cmd-${this.commandIdCounter++}-${Date.now()}`;

      const command = {
        command_id: commandId,
        type,
        params
      };

      const timeoutId = setTimeout(() => {
        this.pendingResponses.delete(commandId);
        reject(new Error(`Command ${type} (${commandId}) timed out after ${timeout}ms`));
      }, timeout);

      this.pendingResponses.set(commandId, {
        resolve: (response) => {
          clearTimeout(timeoutId);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      try {
        this.send(command);
      } catch (error) {
        clearTimeout(timeoutId);
        this.pendingResponses.delete(commandId);
        reject(error);
      }
    });
  }

  /**
   * Send a heartbeat message
   */
  sendHeartbeat() {
    this.send({
      type: 'heartbeat',
      timestamp: Date.now()
    });
  }

  /**
   * Send a status update message
   * @param {string} status - Status value
   * @param {Object} data - Additional data
   */
  sendStatus(status, data = {}) {
    this.send({
      type: 'status',
      status,
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Wait for a message matching a predicate
   * @param {Function} predicate - Function that returns true for matching message
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<Object>}
   */
  waitForMessage(predicate, timeout = this.options.messageTimeout) {
    return new Promise((resolve, reject) => {
      // Check existing messages first
      const existing = this.messageQueue.find(m => predicate(m.data));
      if (existing) {
        resolve(existing.data);
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for message after ${timeout}ms`));
      }, timeout);

      const handler = (event) => {
        if (predicate(event.data)) {
          clearTimeout(timeoutId);
          this.off('message', handler);
          resolve(event.data);
        }
      };

      this.on('message', handler);
    });
  }

  /**
   * Wait for a specific message type
   * @param {string} type - Message type
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<Object>}
   */
  waitForMessageType(type, timeout = this.options.messageTimeout) {
    return this.waitForMessage(msg => msg.type === type, timeout);
  }

  /**
   * Wait for a command response
   * @param {string} commandId - Command ID
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<Object>}
   */
  waitForResponse(commandId, timeout = this.options.messageTimeout) {
    return this.waitForMessage(msg => msg.command_id === commandId, timeout);
  }

  /**
   * Get all received messages
   * @returns {Array}
   */
  getMessages() {
    return [...this.messageQueue];
  }

  /**
   * Get all sent messages
   * @returns {Array}
   */
  getSentMessages() {
    return [...this.sentMessages];
  }

  /**
   * Clear message queue
   */
  clearMessages() {
    this.messageQueue = [];
  }

  /**
   * Clear sent messages
   */
  clearSentMessages() {
    this.sentMessages = [];
  }

  /**
   * Add event handler
   * @param {string} event - Event type
   * @param {Function} handler - Handler function
   */
  on(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].push(handler);
    }
  }

  /**
   * Remove event handler
   * @param {string} event - Event type
   * @param {Function} handler - Handler function
   */
  off(event, handler) {
    if (this.eventHandlers[event]) {
      const index = this.eventHandlers[event].indexOf(handler);
      if (index > -1) {
        this.eventHandlers[event].splice(index, 1);
      }
    }
  }

  /**
   * Trigger event handlers
   * @private
   */
  _triggerEvent(event, data) {
    if (this.eventHandlers[event]) {
      for (const handler of this.eventHandlers[event]) {
        try {
          handler(data);
        } catch (e) {
          console.error(`Error in ${event} handler:`, e);
        }
      }
    }
  }
}

// ============================================================================
// Message Matchers
// ============================================================================

/**
 * Create a matcher for command responses
 * @param {string} commandId - Command ID to match
 * @returns {Function}
 */
const matchCommandResponse = (commandId) => {
  return (message) => message && message.command_id === commandId;
};

/**
 * Create a matcher for successful responses
 * @param {string} commandId - Optional command ID
 * @returns {Function}
 */
const matchSuccessResponse = (commandId = null) => {
  return (message) => {
    if (!message || message.success !== true) return false;
    if (commandId && message.command_id !== commandId) return false;
    return true;
  };
};

/**
 * Create a matcher for error responses
 * @param {string} commandId - Optional command ID
 * @returns {Function}
 */
const matchErrorResponse = (commandId = null) => {
  return (message) => {
    if (!message || message.success !== false) return false;
    if (commandId && message.command_id !== commandId) return false;
    return true;
  };
};

/**
 * Create a matcher for message type
 * @param {string} type - Message type to match
 * @returns {Function}
 */
const matchMessageType = (type) => {
  return (message) => message && message.type === type;
};

/**
 * Create a matcher for heartbeat messages
 * @returns {Function}
 */
const matchHeartbeat = () => matchMessageType('heartbeat');

/**
 * Create a matcher for status messages
 * @param {string} status - Optional status value to match
 * @returns {Function}
 */
const matchStatus = (status = null) => {
  return (message) => {
    if (!message || message.type !== 'status') return false;
    if (status && message.status !== status) return false;
    return true;
  };
};

/**
 * Create a matcher for messages containing specific fields
 * @param {Object} fields - Fields to match (partial match)
 * @returns {Function}
 */
const matchFields = (fields) => {
  return (message) => {
    if (!message) return false;
    for (const [key, value] of Object.entries(fields)) {
      if (typeof value === 'object' && value !== null) {
        if (!objectContains(message[key], value)) return false;
      } else if (message[key] !== value) {
        return false;
      }
    }
    return true;
  };
};

/**
 * Check if an object contains all properties of another (partial match)
 * @param {Object} actual - Object to check
 * @param {Object} expected - Expected properties
 * @returns {boolean}
 */
const objectContains = (actual, expected) => {
  if (actual === expected) return true;
  if (actual == null || expected == null) return actual === expected;
  if (typeof actual !== 'object' || typeof expected !== 'object') {
    return actual === expected;
  }
  for (const key of Object.keys(expected)) {
    if (!(key in actual)) return false;
    if (!objectContains(actual[key], expected[key])) return false;
  }
  return true;
};

// ============================================================================
// Timeout Utilities
// ============================================================================

/**
 * Wait for a specified duration
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wait for a condition to be true
 * @param {Function} condition - Function that returns boolean or Promise<boolean>
 * @param {Object} options - Options
 * @returns {Promise<boolean>}
 */
const waitFor = async (condition, options = {}) => {
  const {
    timeout = 5000,
    interval = 50,
    message = 'Condition not met within timeout'
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const result = await condition();
      if (result) return true;
    } catch (e) {
      // Condition threw an error, continue waiting
    }
    await wait(interval);
  }

  throw new Error(`${message} (timeout: ${timeout}ms)`);
};

/**
 * Run a function with timeout
 * @param {Function} fn - Async function to run
 * @param {number} timeout - Timeout in ms
 * @param {string} message - Error message on timeout
 * @returns {Promise<*>}
 */
const withTimeout = (fn, timeout, message = 'Operation timed out') => {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${message} (${timeout}ms)`)), timeout)
    )
  ]);
};

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise<*>}
 */
const retry = async (fn, options = {}) => {
  const {
    maxAttempts = 3,
    initialDelay = 100,
    maxDelay = 5000,
    factor = 2,
    onRetry = null
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      if (onRetry) {
        onRetry(error, attempt);
      }

      await wait(delay);
      delay = Math.min(delay * factor, maxDelay);
    }
  }

  throw lastError;
};

// ============================================================================
// Test Server Utilities
// ============================================================================

/**
 * Create a mock extension response
 * @param {string} commandId - Command ID
 * @param {boolean} success - Success status
 * @param {*} result - Result data
 * @param {string|null} error - Error message
 * @returns {Object}
 */
const createMockResponse = (commandId, success, result = null, error = null) => ({
  command_id: commandId,
  success,
  result,
  error,
  timestamp: Date.now()
});

/**
 * Create a mock command
 * @param {string} type - Command type
 * @param {Object} params - Command parameters
 * @param {string} commandId - Optional command ID
 * @returns {Object}
 */
const createMockCommand = (type, params = {}, commandId = null) => ({
  command_id: commandId || `mock-cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  type,
  params
});

/**
 * Create a mock heartbeat message
 * @returns {Object}
 */
const createHeartbeat = () => ({
  type: 'heartbeat',
  timestamp: Date.now()
});

/**
 * Create a mock status message
 * @param {string} status - Status value
 * @param {Object} data - Additional data
 * @returns {Object}
 */
const createStatusMessage = (status, data = {}) => ({
  type: 'status',
  status,
  data,
  timestamp: Date.now()
});

/**
 * Create a mock error message
 * @param {string} errorMessage - Error message
 * @param {string} errorCode - Optional error code
 * @returns {Object}
 */
const createErrorMessage = (errorMessage, errorCode = null) => ({
  type: 'error',
  error: errorMessage,
  code: errorCode,
  timestamp: Date.now()
});

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that a message was received
 * @param {TestWebSocketClient} client - Test client
 * @param {Function} predicate - Match function
 * @param {string} description - Description for error message
 */
const assertMessageReceived = (client, predicate, description = 'Expected message') => {
  const messages = client.getMessages();
  const found = messages.some(m => predicate(m.data));
  if (!found) {
    throw new Error(
      `${description} not found.\n` +
      `Received messages: ${JSON.stringify(messages.map(m => m.data), null, 2)}`
    );
  }
};

/**
 * Assert that a message was sent
 * @param {TestWebSocketClient} client - Test client
 * @param {Function} predicate - Match function
 * @param {string} description - Description for error message
 */
const assertMessageSent = (client, predicate, description = 'Expected message') => {
  const messages = client.getSentMessages();
  const found = messages.some(m => predicate(typeof m.data === 'string' ? JSON.parse(m.data) : m.data));
  if (!found) {
    throw new Error(
      `${description} not sent.\n` +
      `Sent messages: ${JSON.stringify(messages.map(m => m.data), null, 2)}`
    );
  }
};

/**
 * Assert that a response was successful
 * @param {Object} response - Response object
 * @param {string} description - Description for error message
 */
const assertSuccessResponse = (response, description = 'Response') => {
  if (!response || response.success !== true) {
    throw new Error(
      `${description} should be successful.\n` +
      `Actual: ${JSON.stringify(response, null, 2)}`
    );
  }
};

/**
 * Assert that a response was an error
 * @param {Object} response - Response object
 * @param {string} expectedError - Optional expected error message
 * @param {string} description - Description for error message
 */
const assertErrorResponse = (response, expectedError = null, description = 'Response') => {
  if (!response || response.success !== false) {
    throw new Error(
      `${description} should be an error.\n` +
      `Actual: ${JSON.stringify(response, null, 2)}`
    );
  }
  if (expectedError && !response.error?.includes(expectedError)) {
    throw new Error(
      `${description} should contain error "${expectedError}".\n` +
      `Actual error: ${response.error}`
    );
  }
};

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Client
  TestWebSocketClient,
  DEFAULT_CONFIG,

  // Message Matchers
  matchCommandResponse,
  matchSuccessResponse,
  matchErrorResponse,
  matchMessageType,
  matchHeartbeat,
  matchStatus,
  matchFields,
  objectContains,

  // Timeout Utilities
  wait,
  waitFor,
  withTimeout,
  retry,

  // Mock Creators
  createMockResponse,
  createMockCommand,
  createHeartbeat,
  createStatusMessage,
  createErrorMessage,

  // Assertion Helpers
  assertMessageReceived,
  assertMessageSent,
  assertSuccessResponse,
  assertErrorResponse
};
