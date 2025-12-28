/**
 * Extension Integration Tests
 *
 * Integration tests that run against the test WebSocket server to verify
 * the full message flow between the extension and server including:
 * - Connection establishment
 * - Heartbeat handling
 * - Command sending and response receiving
 * - Error message reception
 * - Mock extension responses for testing server-side logic
 */

const WebSocket = require('ws');
const {
  TestWebSocketClient,
  DEFAULT_CONFIG,
  matchCommandResponse,
  matchSuccessResponse,
  matchErrorResponse,
  matchMessageType,
  matchHeartbeat,
  matchStatus,
  matchFields,
  wait,
  waitFor,
  withTimeout,
  retry,
  createMockResponse,
  createMockCommand,
  createHeartbeat,
  createStatusMessage,
  createErrorMessage,
  assertMessageReceived,
  assertMessageSent,
  assertSuccessResponse,
  assertErrorResponse
} = require('./test-helpers');

// Test server configuration
const TEST_PORT = 8766; // Use different port from production to avoid conflicts
const TEST_URL = `ws://localhost:${TEST_PORT}/browser`;

/**
 * Test WebSocket Server
 *
 * A minimal WebSocket server for integration testing.
 */
class TestServer {
  constructor(port = TEST_PORT) {
    this.port = port;
    this.wss = null;
    this.clients = new Set();
    this.receivedMessages = [];
    this.commandHandlers = new Map();
    this.autoRespond = true;
    this.responseDelay = 0;
  }

  /**
   * Start the test server
   * @returns {Promise<void>}
   */
  start() {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocket.Server({ port: this.port, path: '/browser' }, () => {
          resolve();
        });

        this.wss.on('error', (error) => {
          reject(error);
        });

        this.wss.on('connection', (ws, req) => {
          this.clients.add(ws);

          // Send initial connection confirmation
          ws.send(JSON.stringify({
            type: 'status',
            status: 'connected',
            message: 'Test server connected',
            timestamp: Date.now()
          }));

          ws.on('message', (data) => {
            try {
              const message = JSON.parse(data.toString());
              this.receivedMessages.push({
                data: message,
                timestamp: Date.now()
              });
              this._handleMessage(ws, message);
            } catch (e) {
              // Handle non-JSON messages
              this.receivedMessages.push({
                data: data.toString(),
                timestamp: Date.now(),
                raw: true
              });
            }
          });

          ws.on('close', () => {
            this.clients.delete(ws);
          });

          ws.on('error', () => {
            this.clients.delete(ws);
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the test server
   * @returns {Promise<void>}
   */
  stop() {
    return new Promise((resolve) => {
      if (!this.wss) {
        resolve();
        return;
      }

      // Close all client connections
      for (const client of this.clients) {
        try {
          client.close(1001, 'Server shutdown');
        } catch (e) {
          // Ignore close errors
        }
      }
      this.clients.clear();

      this.wss.close(() => {
        this.wss = null;
        resolve();
      });

      // Timeout fallback
      setTimeout(() => {
        this.wss = null;
        resolve();
      }, 2000);
    });
  }

  /**
   * Handle incoming messages
   * @private
   */
  _handleMessage(ws, message) {
    // Handle heartbeat silently
    if (message.type === 'heartbeat') {
      return;
    }

    // Handle status updates
    if (message.type === 'status') {
      return;
    }

    // Handle commands with responses
    if (message.command_id) {
      const handler = this.commandHandlers.get(message.type);

      if (handler) {
        const responseData = handler(message);
        this._sendResponse(ws, message.command_id, responseData);
      } else if (this.autoRespond) {
        // Default auto-response
        this._sendResponse(ws, message.command_id, {
          success: true,
          result: { mock: true, commandType: message.type }
        });
      }
    }
  }

  /**
   * Send response to client
   * @private
   */
  _sendResponse(ws, commandId, data) {
    const sendFn = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          command_id: commandId,
          success: data.success !== false,
          result: data.result || null,
          error: data.error || null,
          timestamp: Date.now()
        }));
      }
    };

    if (this.responseDelay > 0) {
      setTimeout(sendFn, this.responseDelay);
    } else {
      sendFn();
    }
  }

  /**
   * Register a command handler
   * @param {string} type - Command type
   * @param {Function} handler - Handler function (message) => { success, result, error }
   */
  onCommand(type, handler) {
    this.commandHandlers.set(type, handler);
    return this;
  }

  /**
   * Send a command to all connected clients
   * @param {Object} command - Command object
   */
  broadcast(command) {
    const data = JSON.stringify(command);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  /**
   * Send a command to first connected client
   * @param {Object} command - Command object
   * @returns {boolean}
   */
  sendToFirst(command) {
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(command));
        return true;
      }
    }
    return false;
  }

  /**
   * Send an error message
   * @param {string} error - Error message
   * @param {string} code - Optional error code
   */
  sendError(error, code = null) {
    this.broadcast(createErrorMessage(error, code));
  }

  /**
   * Get all received messages
   * @returns {Array}
   */
  getMessages() {
    return [...this.receivedMessages];
  }

  /**
   * Get messages matching a predicate
   * @param {Function} predicate - Filter function
   * @returns {Array}
   */
  getMatchingMessages(predicate) {
    return this.receivedMessages.filter(m => predicate(m.data));
  }

  /**
   * Clear received messages
   */
  clearMessages() {
    this.receivedMessages = [];
  }

  /**
   * Get connected client count
   * @returns {number}
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Wait for a client to connect
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<void>}
   */
  waitForClient(timeout = 5000) {
    return waitFor(
      () => this.clients.size > 0,
      { timeout, message: 'No client connected' }
    );
  }

  /**
   * Wait for a message matching predicate
   * @param {Function} predicate - Match function
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<Object>}
   */
  async waitForMessage(predicate, timeout = 5000) {
    const startTime = Date.now();
    const startLength = this.receivedMessages.length;

    // Check existing messages
    for (const msg of this.receivedMessages) {
      if (predicate(msg.data)) {
        return msg.data;
      }
    }

    // Poll for new messages
    while (Date.now() - startTime < timeout) {
      if (this.receivedMessages.length > startLength) {
        for (let i = startLength; i < this.receivedMessages.length; i++) {
          if (predicate(this.receivedMessages[i].data)) {
            return this.receivedMessages[i].data;
          }
        }
      }
      await wait(50);
    }

    throw new Error(`Timeout waiting for message (${timeout}ms)`);
  }
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Extension Integration Tests', () => {
  let server;
  let client;

  beforeAll(async () => {
    server = new TestServer(TEST_PORT);
    await server.start();
  });

  afterAll(async () => {
    if (client && client.isConnected) {
      await client.disconnect();
    }
    await server.stop();
  });

  beforeEach(() => {
    server.clearMessages();
    server.commandHandlers.clear();
    server.autoRespond = true;
    server.responseDelay = 0;
  });

  afterEach(async () => {
    if (client && client.isConnected) {
      await client.disconnect();
      client = null;
    }
  });

  // ==========================================================================
  // Connection Establishment Tests
  // ==========================================================================

  describe('Connection Establishment', () => {
    test('should connect to the test server successfully', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      expect(client.isConnected).toBe(true);
      expect(server.getClientCount()).toBe(1);
    });

    test('should receive connection confirmation from server', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      // Wait for the status message
      await wait(100);

      const messages = client.getMessages();
      const statusMessage = messages.find(m => m.data.type === 'status');

      expect(statusMessage).toBeDefined();
      expect(statusMessage.data.status).toBe('connected');
    });

    test('should handle connection timeout gracefully', async () => {
      client = new TestWebSocketClient('ws://localhost:9999/invalid', {
        connectionTimeout: 500
      });

      await expect(client.connect()).rejects.toThrow();
    });

    test('should allow reconnection after disconnect', async () => {
      client = new TestWebSocketClient(TEST_URL);

      // Connect
      await client.connect();
      expect(client.isConnected).toBe(true);

      // Disconnect
      await client.disconnect();
      expect(client.isConnected).toBe(false);

      // Wait a bit for server cleanup
      await wait(100);

      // Reconnect
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();
      expect(client.isConnected).toBe(true);
    });

    test('should support multiple simultaneous clients', async () => {
      const client1 = new TestWebSocketClient(TEST_URL);
      const client2 = new TestWebSocketClient(TEST_URL);

      await client1.connect();
      await client2.connect();

      expect(server.getClientCount()).toBe(2);

      await client1.disconnect();
      await client2.disconnect();
    });
  });

  // ==========================================================================
  // Heartbeat Handling Tests
  // ==========================================================================

  describe('Heartbeat Handling', () => {
    test('should send heartbeat message successfully', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      client.sendHeartbeat();

      await wait(50);

      const heartbeats = server.getMatchingMessages(matchHeartbeat());
      expect(heartbeats.length).toBe(1);
      expect(heartbeats[0].data.type).toBe('heartbeat');
      expect(heartbeats[0].data.timestamp).toBeDefined();
    });

    test('should send multiple heartbeats', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      // Send multiple heartbeats
      for (let i = 0; i < 3; i++) {
        client.sendHeartbeat();
        await wait(50);
      }

      const heartbeats = server.getMatchingMessages(matchHeartbeat());
      expect(heartbeats.length).toBe(3);
    });

    test('should include timestamp in heartbeat', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      const beforeSend = Date.now();
      client.sendHeartbeat();
      const afterSend = Date.now();

      await wait(50);

      const heartbeat = server.getMatchingMessages(matchHeartbeat())[0];
      expect(heartbeat.data.timestamp).toBeGreaterThanOrEqual(beforeSend);
      expect(heartbeat.data.timestamp).toBeLessThanOrEqual(afterSend);
    });

    test('server should not respond to heartbeat', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      // Clear initial messages
      client.clearMessages();

      client.sendHeartbeat();

      await wait(200);

      // Server should not send a response to heartbeat
      const messagesAfterHeartbeat = client.getMessages().filter(
        m => m.data.command_id && m.data.type !== 'status'
      );
      expect(messagesAfterHeartbeat.length).toBe(0);
    });
  });

  // ==========================================================================
  // Command Sending and Response Receiving Tests
  // ==========================================================================

  describe('Command Sending and Response Receiving', () => {
    test('should send command and receive response', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      server.onCommand('navigate', (msg) => ({
        success: true,
        result: { url: msg.params.url, navigated: true }
      }));

      const response = await client.sendCommand('navigate', {
        url: 'https://example.com'
      });

      expect(response.success).toBe(true);
      expect(response.result.url).toBe('https://example.com');
      expect(response.result.navigated).toBe(true);
    });

    test('should handle get_page_state command', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      server.onCommand('get_page_state', () => ({
        success: true,
        result: {
          url: 'https://example.com',
          title: 'Example Domain',
          readyState: 'complete'
        }
      }));

      const response = await client.sendCommand('get_page_state', {});

      expect(response.success).toBe(true);
      expect(response.result.url).toBe('https://example.com');
      expect(response.result.title).toBe('Example Domain');
    });

    test('should handle fill_form command', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      server.onCommand('fill_form', (msg) => ({
        success: true,
        result: {
          fieldsFilted: Object.keys(msg.params.fields).length,
          submitted: msg.params.submit || false
        }
      }));

      const response = await client.sendCommand('fill_form', {
        fields: {
          '#email': 'test@example.com',
          '#password': 'secret123'
        },
        submit: true
      });

      expect(response.success).toBe(true);
      expect(response.result.fieldsFilted).toBe(2);
      expect(response.result.submitted).toBe(true);
    });

    test('should handle click command', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      server.onCommand('click', (msg) => ({
        success: true,
        result: {
          selector: msg.params.selector,
          clicked: true
        }
      }));

      const response = await client.sendCommand('click', {
        selector: '#submit-button'
      });

      expect(response.success).toBe(true);
      expect(response.result.clicked).toBe(true);
    });

    test('should handle screenshot command', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      server.onCommand('screenshot', () => ({
        success: true,
        result: {
          format: 'png',
          data: 'base64encodeddata...',
          width: 1920,
          height: 1080
        }
      }));

      const response = await client.sendCommand('screenshot', {
        format: 'png'
      });

      expect(response.success).toBe(true);
      expect(response.result.format).toBe('png');
      expect(response.result.data).toBeDefined();
    });

    test('should handle execute_script command', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      server.onCommand('execute_script', (msg) => ({
        success: true,
        result: {
          returnValue: 'document.title result',
          script: msg.params.script
        }
      }));

      const response = await client.sendCommand('execute_script', {
        script: 'document.title'
      });

      expect(response.success).toBe(true);
      expect(response.result.returnValue).toBe('document.title result');
    });

    test('should handle command with delayed response', async () => {
      client = new TestWebSocketClient(TEST_URL, { messageTimeout: 5000 });
      await client.connect();

      server.responseDelay = 500;
      server.onCommand('slow_command', () => ({
        success: true,
        result: { delayed: true }
      }));

      const startTime = Date.now();
      const response = await client.sendCommand('slow_command', {});
      const elapsed = Date.now() - startTime;

      expect(response.success).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(400); // Allow some timing variance
    });

    test('should receive unique command_id in response', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      const response1 = await client.sendCommand('test1', {});
      const response2 = await client.sendCommand('test2', {});

      expect(response1.command_id).not.toBe(response2.command_id);
    });

    test('should handle multiple concurrent commands', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      server.responseDelay = 100;

      // Send multiple commands concurrently
      const promises = [
        client.sendCommand('cmd1', { id: 1 }),
        client.sendCommand('cmd2', { id: 2 }),
        client.sendCommand('cmd3', { id: 3 })
      ];

      const responses = await Promise.all(promises);

      expect(responses.length).toBe(3);
      responses.forEach(r => expect(r.success).toBe(true));
    });
  });

  // ==========================================================================
  // Error Message Reception Tests
  // ==========================================================================

  describe('Error Message Reception', () => {
    test('should receive error response for failed command', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      server.onCommand('failing_command', () => ({
        success: false,
        error: 'Command execution failed'
      }));

      const response = await client.sendCommand('failing_command', {});

      expect(response.success).toBe(false);
      expect(response.error).toBe('Command execution failed');
    });

    test('should handle element not found error', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      server.onCommand('click', (msg) => ({
        success: false,
        error: `Element not found: ${msg.params.selector}`
      }));

      const response = await client.sendCommand('click', {
        selector: '#nonexistent'
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Element not found');
      expect(response.error).toContain('#nonexistent');
    });

    test('should handle navigation error', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      server.onCommand('navigate', () => ({
        success: false,
        error: 'Navigation timeout'
      }));

      const response = await client.sendCommand('navigate', {
        url: 'https://slow-site.example.com'
      });

      expect(response.success).toBe(false);
      expect(response.error).toBe('Navigation timeout');
    });

    test('should handle script execution error', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      server.onCommand('execute_script', () => ({
        success: false,
        error: 'ReferenceError: undefinedVar is not defined'
      }));

      const response = await client.sendCommand('execute_script', {
        script: 'undefinedVar.method()'
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('ReferenceError');
    });

    test('should receive broadcast error message', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      // Clear initial messages
      client.clearMessages();

      // Server broadcasts an error
      server.sendError('Server-side error occurred', 'ERR_SERVER');

      await wait(100);

      const messages = client.getMessages();
      const errorMsg = messages.find(m => m.data.type === 'error');

      expect(errorMsg).toBeDefined();
      expect(errorMsg.data.error).toBe('Server-side error occurred');
      expect(errorMsg.data.code).toBe('ERR_SERVER');
    });

    test('should handle command timeout as error', async () => {
      client = new TestWebSocketClient(TEST_URL, { messageTimeout: 500 });
      await client.connect();

      // Disable auto-respond so command times out
      server.autoRespond = false;

      await expect(
        client.sendCommand('no_response_command', {})
      ).rejects.toThrow('timed out');
    });

    test('should include error details in response', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      server.onCommand('detailed_error', () => ({
        success: false,
        error: 'Validation failed',
        result: {
          field: 'email',
          reason: 'Invalid email format',
          value: 'not-an-email'
        }
      }));

      const response = await client.sendCommand('detailed_error', {
        email: 'not-an-email'
      });

      expect(response.success).toBe(false);
      expect(response.error).toBe('Validation failed');
      expect(response.result.field).toBe('email');
      expect(response.result.reason).toBe('Invalid email format');
    });
  });

  // ==========================================================================
  // Mock Extension Responses Tests
  // ==========================================================================

  describe('Mock Extension Responses', () => {
    test('should mock successful page state response', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      const mockPageState = {
        url: 'https://example.com/login',
        title: 'Login Page',
        forms: [
          {
            id: 'loginForm',
            fields: ['username', 'password']
          }
        ],
        inputs: 5,
        buttons: 2
      };

      server.onCommand('get_page_state', () => ({
        success: true,
        result: mockPageState
      }));

      const response = await client.sendCommand('get_page_state', {});

      expect(response.success).toBe(true);
      expect(response.result).toEqual(mockPageState);
    });

    test('should mock form fill with validation', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      server.onCommand('fill_form', (msg) => {
        const fields = msg.params.fields || {};
        const errors = [];

        // Validate email format
        if (fields['#email'] && !fields['#email'].includes('@')) {
          errors.push({ field: '#email', error: 'Invalid email format' });
        }

        // Validate password length
        if (fields['#password'] && fields['#password'].length < 8) {
          errors.push({ field: '#password', error: 'Password too short' });
        }

        if (errors.length > 0) {
          return {
            success: false,
            error: 'Validation failed',
            result: { validationErrors: errors }
          };
        }

        return {
          success: true,
          result: { filled: Object.keys(fields).length }
        };
      });

      // Test invalid data
      const invalidResponse = await client.sendCommand('fill_form', {
        fields: {
          '#email': 'invalid-email',
          '#password': 'short'
        }
      });

      expect(invalidResponse.success).toBe(false);
      expect(invalidResponse.result.validationErrors.length).toBe(2);

      // Test valid data
      const validResponse = await client.sendCommand('fill_form', {
        fields: {
          '#email': 'valid@example.com',
          '#password': 'longpassword123'
        }
      });

      expect(validResponse.success).toBe(true);
    });

    test('should mock network request capture', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      const mockNetworkLog = [
        {
          method: 'GET',
          url: 'https://api.example.com/data',
          status: 200,
          type: 'xhr',
          timing: { start: 100, end: 150 }
        },
        {
          method: 'POST',
          url: 'https://api.example.com/submit',
          status: 201,
          type: 'xhr',
          timing: { start: 200, end: 280 }
        }
      ];

      server.onCommand('get_network_log', () => ({
        success: true,
        result: { requests: mockNetworkLog }
      }));

      const response = await client.sendCommand('get_network_log', {});

      expect(response.success).toBe(true);
      expect(response.result.requests.length).toBe(2);
      expect(response.result.requests[0].url).toContain('api.example.com');
    });

    test('should mock cookie operations', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      const mockCookies = [
        { name: 'session', value: 'abc123', domain: 'example.com', httpOnly: true },
        { name: 'preference', value: 'dark', domain: 'example.com', httpOnly: false }
      ];

      server.onCommand('get_cookies', (msg) => ({
        success: true,
        result: {
          cookies: mockCookies.filter(c =>
            !msg.params.name || c.name === msg.params.name
          )
        }
      }));

      // Get all cookies
      const allResponse = await client.sendCommand('get_cookies', {});
      expect(allResponse.result.cookies.length).toBe(2);

      // Get specific cookie
      const sessionResponse = await client.sendCommand('get_cookies', {
        name: 'session'
      });
      expect(sessionResponse.result.cookies.length).toBe(1);
      expect(sessionResponse.result.cookies[0].name).toBe('session');
    });

    test('should mock screenshot with metadata', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      server.onCommand('screenshot', (msg) => ({
        success: true,
        result: {
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          format: msg.params.format || 'png',
          width: 1920,
          height: 1080,
          devicePixelRatio: 2,
          timestamp: Date.now()
        }
      }));

      const response = await client.sendCommand('screenshot', {
        format: 'png',
        quality: 100
      });

      expect(response.success).toBe(true);
      expect(response.result.data).toBeDefined();
      expect(response.result.width).toBe(1920);
      expect(response.result.height).toBe(1080);
    });

    test('should mock element interaction states', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      const elementStates = new Map();

      server.onCommand('click', (msg) => {
        const selector = msg.params.selector;
        elementStates.set(selector, { clicked: true, timestamp: Date.now() });
        return {
          success: true,
          result: { clicked: true, selector }
        };
      });

      server.onCommand('get_element_state', (msg) => {
        const state = elementStates.get(msg.params.selector);
        return {
          success: true,
          result: state || { exists: false }
        };
      });

      // Click an element
      await client.sendCommand('click', { selector: '#button' });

      // Check state
      const stateResponse = await client.sendCommand('get_element_state', {
        selector: '#button'
      });

      expect(stateResponse.result.clicked).toBe(true);
    });
  });

  // ==========================================================================
  // Status Updates Tests
  // ==========================================================================

  describe('Status Updates', () => {
    test('should send status update to server', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      client.sendStatus('ready', {
        capabilities: ['navigate', 'fill_form', 'click']
      });

      await wait(100);

      const statusMessages = server.getMatchingMessages(matchStatus());
      expect(statusMessages.length).toBeGreaterThan(0);

      const readyStatus = statusMessages.find(m => m.data.status === 'ready');
      expect(readyStatus).toBeDefined();
      expect(readyStatus.data.data.capabilities).toContain('navigate');
    });

    test('should handle status change notifications', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      // Clear initial messages
      client.clearMessages();

      // Server sends status update
      server.broadcast({
        type: 'status',
        status: 'busy',
        message: 'Processing command'
      });

      await wait(100);

      const messages = client.getMessages();
      const busyStatus = messages.find(m =>
        m.data.type === 'status' && m.data.status === 'busy'
      );

      expect(busyStatus).toBeDefined();
      expect(busyStatus.data.message).toBe('Processing command');
    });
  });

  // ==========================================================================
  // Message Matching Tests
  // ==========================================================================

  describe('Message Matching', () => {
    test('matchCommandResponse should match by command_id', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      const response = await client.sendCommand('test', {});
      const matcher = matchCommandResponse(response.command_id);

      expect(matcher(response)).toBe(true);
      expect(matcher({ command_id: 'other' })).toBe(false);
    });

    test('matchSuccessResponse should match successful responses', () => {
      const matcher = matchSuccessResponse();

      expect(matcher({ success: true })).toBe(true);
      expect(matcher({ success: false })).toBe(false);
      expect(matcher({})).toBe(false);
    });

    test('matchErrorResponse should match error responses', () => {
      const matcher = matchErrorResponse();

      expect(matcher({ success: false, error: 'Error' })).toBe(true);
      expect(matcher({ success: true })).toBe(false);
    });

    test('matchFields should do partial matching', () => {
      const matcher = matchFields({
        type: 'response',
        success: true
      });

      expect(matcher({
        type: 'response',
        success: true,
        result: { data: 'extra' }
      })).toBe(true);

      expect(matcher({
        type: 'response',
        success: false
      })).toBe(false);
    });
  });

  // ==========================================================================
  // Connection Resilience Tests
  // ==========================================================================

  describe('Connection Resilience', () => {
    test('should detect connection close', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      let closeCalled = false;
      client.on('close', () => {
        closeCalled = true;
      });

      await client.disconnect();

      expect(closeCalled).toBe(true);
      expect(client.isConnected).toBe(false);
    });

    test('should handle server-initiated close', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      let closeEvent = null;
      client.on('close', (event) => {
        closeEvent = event;
      });

      // Server closes connection
      for (const serverClient of server.clients) {
        serverClient.close(1001, 'Server shutdown');
      }

      await wait(200);

      expect(closeEvent).not.toBeNull();
      expect(client.isConnected).toBe(false);
    });

    test('should throw when sending on closed connection', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();
      await client.disconnect();

      expect(() => {
        client.send({ type: 'test' });
      }).toThrow('WebSocket is not connected');
    });
  });

  // ==========================================================================
  // Utility Function Tests
  // ==========================================================================

  describe('Utility Functions', () => {
    test('wait should delay execution', async () => {
      const start = Date.now();
      await wait(100);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(90);
    });

    test('waitFor should resolve when condition is met', async () => {
      let ready = false;
      setTimeout(() => { ready = true; }, 100);

      await waitFor(() => ready, { timeout: 500 });

      expect(ready).toBe(true);
    });

    test('waitFor should reject on timeout', async () => {
      await expect(
        waitFor(() => false, { timeout: 100 })
      ).rejects.toThrow('timeout');
    });

    test('withTimeout should resolve within timeout', async () => {
      const result = await withTimeout(
        async () => {
          await wait(50);
          return 'success';
        },
        200
      );

      expect(result).toBe('success');
    });

    test('withTimeout should reject after timeout', async () => {
      await expect(
        withTimeout(
          async () => {
            await wait(500);
            return 'too slow';
          },
          100
        )
      ).rejects.toThrow('timed out');
    });

    test('retry should succeed after failures', async () => {
      let attempts = 0;

      const result = await retry(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Not ready');
          }
          return 'success';
        },
        { maxAttempts: 5, initialDelay: 10 }
      );

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    test('retry should fail after max attempts', async () => {
      await expect(
        retry(
          async () => {
            throw new Error('Always fails');
          },
          { maxAttempts: 3, initialDelay: 10 }
        )
      ).rejects.toThrow('Always fails');
    });
  });

  // ==========================================================================
  // Message Creation Tests
  // ==========================================================================

  describe('Message Creation Helpers', () => {
    test('createMockResponse should create valid response', () => {
      const response = createMockResponse('cmd-1', true, { data: 'test' });

      expect(response.command_id).toBe('cmd-1');
      expect(response.success).toBe(true);
      expect(response.result.data).toBe('test');
      expect(response.timestamp).toBeDefined();
    });

    test('createMockCommand should create valid command', () => {
      const command = createMockCommand('navigate', { url: 'https://example.com' });

      expect(command.command_id).toBeDefined();
      expect(command.type).toBe('navigate');
      expect(command.params.url).toBe('https://example.com');
    });

    test('createHeartbeat should create valid heartbeat', () => {
      const heartbeat = createHeartbeat();

      expect(heartbeat.type).toBe('heartbeat');
      expect(heartbeat.timestamp).toBeDefined();
    });

    test('createStatusMessage should create valid status', () => {
      const status = createStatusMessage('ready', { version: '1.0' });

      expect(status.type).toBe('status');
      expect(status.status).toBe('ready');
      expect(status.data.version).toBe('1.0');
    });

    test('createErrorMessage should create valid error', () => {
      const error = createErrorMessage('Something went wrong', 'ERR_500');

      expect(error.type).toBe('error');
      expect(error.error).toBe('Something went wrong');
      expect(error.code).toBe('ERR_500');
    });
  });

  // ==========================================================================
  // Server Command Broadcasting Tests
  // ==========================================================================

  describe('Server Command Broadcasting', () => {
    test('server should broadcast command to client', async () => {
      client = new TestWebSocketClient(TEST_URL);
      await client.connect();

      // Clear initial messages
      client.clearMessages();

      const command = createMockCommand('navigate', { url: 'https://broadcast.example.com' });
      server.broadcast(command);

      await wait(100);

      const messages = client.getMessages();
      const navCommand = messages.find(m => m.data.type === 'navigate');

      expect(navCommand).toBeDefined();
      expect(navCommand.data.params.url).toBe('https://broadcast.example.com');
    });

    test('server should send to first client only', async () => {
      const client1 = new TestWebSocketClient(TEST_URL);
      const client2 = new TestWebSocketClient(TEST_URL);

      await client1.connect();
      await client2.connect();

      client1.clearMessages();
      client2.clearMessages();

      const command = createMockCommand('test', { exclusive: true });
      server.sendToFirst(command);

      await wait(100);

      // Only one client should receive the message
      const client1Messages = client1.getMessages().filter(m => m.data.type === 'test');
      const client2Messages = client2.getMessages().filter(m => m.data.type === 'test');

      expect(client1Messages.length + client2Messages.length).toBe(1);

      await client1.disconnect();
      await client2.disconnect();
    });
  });
});
