/**
 * Mock WebSocket for testing
 *
 * This module provides a mock WebSocket implementation for testing
 * WebSocket-based functionality without an actual server.
 */

// WebSocket ready states
const CONNECTING = 0;
const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

/**
 * Mock WebSocket class
 */
class MockWebSocket {
  static CONNECTING = CONNECTING;
  static OPEN = OPEN;
  static CLOSING = CLOSING;
  static CLOSED = CLOSED;

  constructor(url, protocols) {
    this.url = url;
    this.protocols = protocols;
    this.readyState = CONNECTING;
    this.bufferedAmount = 0;
    this.extensions = '';
    this.protocol = '';
    this.binaryType = 'blob';

    // Event handlers
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;

    // Internal tracking
    this._sentMessages = [];
    this._eventListeners = {
      open: [],
      close: [],
      error: [],
      message: []
    };

    // Auto-connect simulation (can be disabled via MockWebSocket.autoConnect)
    if (MockWebSocket.autoConnect) {
      setTimeout(() => this.simulateOpen(), MockWebSocket.connectDelay);
    }
  }

  /**
   * Send a message through the WebSocket
   * @param {string|ArrayBuffer|Blob} data - Data to send
   */
  send(data) {
    if (this.readyState !== OPEN) {
      throw new Error('WebSocket is not open: readyState = ' + this.readyState);
    }

    this._sentMessages.push({
      data,
      timestamp: Date.now()
    });

    // Trigger send callback if configured
    if (MockWebSocket.onSend) {
      MockWebSocket.onSend(data, this);
    }

    // Auto-respond if configured
    if (MockWebSocket.autoRespond && typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (parsed.command_id) {
          setTimeout(() => {
            this.simulateMessage(JSON.stringify({
              command_id: parsed.command_id,
              success: true,
              result: MockWebSocket.autoRespondData || { mock: true },
              error: null,
              timestamp: Date.now()
            }));
          }, MockWebSocket.responseDelay);
        }
      } catch (e) {
        // Not JSON, ignore
      }
    }
  }

  /**
   * Close the WebSocket connection
   * @param {number} code - Close code
   * @param {string} reason - Close reason
   */
  close(code = 1000, reason = '') {
    if (this.readyState === CLOSING || this.readyState === CLOSED) {
      return;
    }

    this.readyState = CLOSING;

    setTimeout(() => {
      this.readyState = CLOSED;
      this._triggerEvent('close', {
        code,
        reason,
        wasClean: code === 1000
      });
    }, 0);
  }

  /**
   * Add an event listener
   * @param {string} type - Event type
   * @param {Function} listener - Event listener
   */
  addEventListener(type, listener) {
    if (this._eventListeners[type]) {
      this._eventListeners[type].push(listener);
    }
  }

  /**
   * Remove an event listener
   * @param {string} type - Event type
   * @param {Function} listener - Event listener
   */
  removeEventListener(type, listener) {
    if (this._eventListeners[type]) {
      const index = this._eventListeners[type].indexOf(listener);
      if (index > -1) {
        this._eventListeners[type].splice(index, 1);
      }
    }
  }

  /**
   * Trigger an event
   * @private
   */
  _triggerEvent(type, eventData = {}) {
    const event = {
      type,
      target: this,
      currentTarget: this,
      ...eventData
    };

    // Call on* handler
    const handler = this['on' + type];
    if (typeof handler === 'function') {
      handler.call(this, event);
    }

    // Call addEventListener handlers
    const listeners = this._eventListeners[type] || [];
    for (const listener of listeners) {
      listener.call(this, event);
    }
  }

  // =========================================================================
  // Test simulation methods
  // =========================================================================

  /**
   * Simulate the connection opening
   */
  simulateOpen() {
    if (this.readyState !== CONNECTING) {
      return;
    }
    this.readyState = OPEN;
    this._triggerEvent('open');
  }

  /**
   * Simulate receiving a message
   * @param {string|ArrayBuffer} data - Message data
   */
  simulateMessage(data) {
    if (this.readyState !== OPEN) {
      return;
    }
    this._triggerEvent('message', { data });
  }

  /**
   * Simulate an error
   * @param {Error|string} error - Error object or message
   */
  simulateError(error) {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    this._triggerEvent('error', {
      message: errorObj.message,
      error: errorObj
    });
  }

  /**
   * Simulate connection close
   * @param {number} code - Close code
   * @param {string} reason - Close reason
   */
  simulateClose(code = 1000, reason = '') {
    this.readyState = CLOSED;
    this._triggerEvent('close', {
      code,
      reason,
      wasClean: code === 1000
    });
  }

  /**
   * Get all messages sent through this WebSocket
   * @returns {Array} - Array of sent message objects
   */
  getSentMessages() {
    return [...this._sentMessages];
  }

  /**
   * Get the last message sent
   * @returns {Object|null} - Last sent message or null
   */
  getLastSentMessage() {
    return this._sentMessages.length > 0
      ? this._sentMessages[this._sentMessages.length - 1]
      : null;
  }

  /**
   * Clear sent messages
   */
  clearSentMessages() {
    this._sentMessages = [];
  }
}

// Static configuration properties
MockWebSocket.autoConnect = true;
MockWebSocket.connectDelay = 0;
MockWebSocket.autoRespond = false;
MockWebSocket.responseDelay = 0;
MockWebSocket.autoRespondData = null;
MockWebSocket.onSend = null;

// Store for tracking all created instances
MockWebSocket.instances = [];

// Store original WebSocket if exists
let originalWebSocket = null;

/**
 * Create a new MockWebSocket with tracking
 */
const createTrackedMockWebSocket = (...args) => {
  const ws = new MockWebSocket(...args);
  MockWebSocket.instances.push(ws);
  return ws;
};

/**
 * Reset all MockWebSocket state
 */
const resetMockWebSocket = () => {
  MockWebSocket.autoConnect = true;
  MockWebSocket.connectDelay = 0;
  MockWebSocket.autoRespond = false;
  MockWebSocket.responseDelay = 0;
  MockWebSocket.autoRespondData = null;
  MockWebSocket.onSend = null;
  MockWebSocket.instances = [];
};

/**
 * Setup MockWebSocket in global scope
 */
const setupWebSocketMock = () => {
  if (typeof global !== 'undefined') {
    originalWebSocket = global.WebSocket;
    global.WebSocket = MockWebSocket;
  }
  return MockWebSocket;
};

/**
 * Restore original WebSocket
 */
const restoreWebSocket = () => {
  if (typeof global !== 'undefined' && originalWebSocket) {
    global.WebSocket = originalWebSocket;
    originalWebSocket = null;
  }
};

/**
 * Get the last created WebSocket instance
 * @returns {MockWebSocket|null}
 */
const getLastWebSocketInstance = () => {
  return MockWebSocket.instances.length > 0
    ? MockWebSocket.instances[MockWebSocket.instances.length - 1]
    : null;
};

/**
 * Get all WebSocket instances
 * @returns {MockWebSocket[]}
 */
const getAllWebSocketInstances = () => {
  return [...MockWebSocket.instances];
};

/**
 * Create a mock WebSocket server for testing
 */
class MockWebSocketServer {
  constructor(options = {}) {
    this.port = options.port || 8765;
    this.path = options.path || '/browser';
    this.clients = [];
    this.messageHandlers = [];
    this._isRunning = false;
  }

  /**
   * Start the mock server
   */
  start() {
    this._isRunning = true;
    MockWebSocket.autoConnect = true;

    // Override send to capture messages
    const server = this;
    MockWebSocket.onSend = (data, ws) => {
      for (const handler of server.messageHandlers) {
        handler(data, ws);
      }
    };

    return this;
  }

  /**
   * Stop the mock server
   */
  stop() {
    this._isRunning = false;
    MockWebSocket.autoConnect = false;
    MockWebSocket.onSend = null;

    // Close all client connections
    for (const client of this.clients) {
      client.simulateClose(1001, 'Server shutdown');
    }
    this.clients = [];
  }

  /**
   * Add a message handler
   * @param {Function} handler - Handler function (data, ws) => void
   */
  onMessage(handler) {
    this.messageHandlers.push(handler);
    return this;
  }

  /**
   * Broadcast a message to all clients
   * @param {string} message - Message to broadcast
   */
  broadcast(message) {
    for (const client of MockWebSocket.instances) {
      if (client.readyState === OPEN) {
        client.simulateMessage(message);
      }
    }
  }

  /**
   * Send a command to a specific client
   * @param {MockWebSocket} client - Client WebSocket
   * @param {Object} command - Command object
   */
  sendCommand(client, command) {
    if (client.readyState === OPEN) {
      client.simulateMessage(JSON.stringify(command));
    }
  }

  /**
   * Check if server is running
   */
  isRunning() {
    return this._isRunning;
  }
}

/**
 * Create a pre-configured mock server for testing
 */
const createMockServer = (options = {}) => {
  return new MockWebSocketServer(options);
};

// Export everything
module.exports = {
  MockWebSocket,
  MockWebSocketServer,
  createMockServer,
  createTrackedMockWebSocket,
  resetMockWebSocket,
  setupWebSocketMock,
  restoreWebSocket,
  getLastWebSocketInstance,
  getAllWebSocketInstances,
  CONNECTING,
  OPEN,
  CLOSING,
  CLOSED
};
