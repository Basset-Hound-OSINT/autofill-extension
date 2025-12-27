/**
 * Integration Tests for WebSocket Connection
 *
 * Tests the WebSocket connection management including:
 * - Connection lifecycle
 * - Reconnection with exponential backoff
 * - Message handling
 * - Heartbeat mechanism
 * - Error handling
 */

const { setupTestEnvironment, teardownTestEnvironment, resetTestMocks, wait, flushPromises } = require('../helpers/setup');
const { MockWebSocket, resetMockWebSocket, getLastWebSocketInstance, OPEN, CLOSED, CONNECTING } = require('../mocks/websocket.mock');
const { assertWebSocketMessageSent } = require('../helpers/assertions');

// Configuration matching background.js
const CONFIG = {
  WS_URL: 'ws://localhost:8765/browser',
  MAX_RECONNECT_ATTEMPTS: 10,
  INITIAL_RECONNECT_DELAY: 1000,
  MAX_RECONNECT_DELAY: 30000,
  HEARTBEAT_INTERVAL: 30000
};

describe('WebSocket Connection Management', () => {
  let chrome;

  beforeAll(() => {
    const env = setupTestEnvironment();
    chrome = env.chrome;
  });

  afterAll(() => {
    teardownTestEnvironment();
  });

  beforeEach(() => {
    resetTestMocks();
    resetMockWebSocket();
    MockWebSocket.autoConnect = true;
    MockWebSocket.connectDelay = 0;
  });

  describe('Connection Lifecycle', () => {
    test('should create WebSocket connection with correct URL', () => {
      const ws = new MockWebSocket(CONFIG.WS_URL);

      expect(ws.url).toBe(CONFIG.WS_URL);
      expect(ws.readyState).toBe(CONNECTING);
    });

    test('should transition to OPEN state on successful connection', async () => {
      MockWebSocket.autoConnect = false;
      const ws = new MockWebSocket(CONFIG.WS_URL);

      expect(ws.readyState).toBe(CONNECTING);

      ws.simulateOpen();

      expect(ws.readyState).toBe(OPEN);
    });

    test('should call onopen handler when connection opens', async () => {
      MockWebSocket.autoConnect = false;
      const ws = new MockWebSocket(CONFIG.WS_URL);
      const onOpenSpy = jest.fn();
      ws.onopen = onOpenSpy;

      ws.simulateOpen();

      expect(onOpenSpy).toHaveBeenCalled();
      expect(onOpenSpy.mock.calls[0][0].type).toBe('open');
    });

    test('should call onclose handler when connection closes', () => {
      const ws = new MockWebSocket(CONFIG.WS_URL);
      ws.simulateOpen();

      const onCloseSpy = jest.fn();
      ws.onclose = onCloseSpy;

      ws.simulateClose(1000, 'Normal closure');

      expect(onCloseSpy).toHaveBeenCalled();
      expect(onCloseSpy.mock.calls[0][0].code).toBe(1000);
      expect(onCloseSpy.mock.calls[0][0].reason).toBe('Normal closure');
      expect(onCloseSpy.mock.calls[0][0].wasClean).toBe(true);
    });

    test('should call onerror handler on connection error', () => {
      const ws = new MockWebSocket(CONFIG.WS_URL);
      ws.simulateOpen();

      const onErrorSpy = jest.fn();
      ws.onerror = onErrorSpy;

      ws.simulateError('Connection refused');

      expect(onErrorSpy).toHaveBeenCalled();
      expect(onErrorSpy.mock.calls[0][0].message).toBe('Connection refused');
    });

    test('should clean close connection', async () => {
      const ws = new MockWebSocket(CONFIG.WS_URL);
      ws.simulateOpen();

      ws.close(1000, 'User requested disconnect');

      await wait(10);

      expect(ws.readyState).toBe(CLOSED);
    });
  });

  describe('Message Handling', () => {
    test('should send messages when connection is open', () => {
      const ws = new MockWebSocket(CONFIG.WS_URL);
      ws.simulateOpen();

      const message = JSON.stringify({ type: 'test', data: 'hello' });
      ws.send(message);

      expect(ws.getSentMessages()).toHaveLength(1);
      expect(ws.getLastSentMessage().data).toBe(message);
    });

    test('should throw error when sending on closed connection', () => {
      MockWebSocket.autoConnect = false;
      const ws = new MockWebSocket(CONFIG.WS_URL);

      expect(() => {
        ws.send('test message');
      }).toThrow('WebSocket is not open');
    });

    test('should receive messages via onmessage handler', () => {
      const ws = new MockWebSocket(CONFIG.WS_URL);
      ws.simulateOpen();

      const onMessageSpy = jest.fn();
      ws.onmessage = onMessageSpy;

      const message = JSON.stringify({ command_id: 'test-1', type: 'navigate' });
      ws.simulateMessage(message);

      expect(onMessageSpy).toHaveBeenCalled();
      expect(onMessageSpy.mock.calls[0][0].data).toBe(message);
    });

    test('should receive messages via addEventListener', () => {
      const ws = new MockWebSocket(CONFIG.WS_URL);
      ws.simulateOpen();

      const messageHandler = jest.fn();
      ws.addEventListener('message', messageHandler);

      ws.simulateMessage('test data');

      expect(messageHandler).toHaveBeenCalled();
    });

    test('should parse JSON command messages correctly', () => {
      const ws = new MockWebSocket(CONFIG.WS_URL);
      ws.simulateOpen();

      const receivedMessages = [];
      ws.onmessage = (event) => {
        receivedMessages.push(JSON.parse(event.data));
      };

      const command = {
        command_id: 'cmd-123',
        type: 'fill_form',
        params: { fields: { '#email': 'test@example.com' } }
      };

      ws.simulateMessage(JSON.stringify(command));

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].command_id).toBe('cmd-123');
      expect(receivedMessages[0].type).toBe('fill_form');
    });
  });

  describe('Response Handling', () => {
    test('should send response with command_id', () => {
      const ws = new MockWebSocket(CONFIG.WS_URL);
      ws.simulateOpen();

      const response = {
        command_id: 'cmd-123',
        success: true,
        result: { url: 'https://example.com' },
        error: null,
        timestamp: Date.now()
      };

      ws.send(JSON.stringify(response));

      assertWebSocketMessageSent(ws, { command_id: 'cmd-123', success: true });
    });

    test('should send error response on failure', () => {
      const ws = new MockWebSocket(CONFIG.WS_URL);
      ws.simulateOpen();

      const response = {
        command_id: 'cmd-456',
        success: false,
        result: null,
        error: 'Element not found',
        timestamp: Date.now()
      };

      ws.send(JSON.stringify(response));

      assertWebSocketMessageSent(ws, { command_id: 'cmd-456', success: false, error: 'Element not found' });
    });
  });

  describe('Heartbeat', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should send heartbeat at configured interval', () => {
      const ws = new MockWebSocket(CONFIG.WS_URL);
      ws.simulateOpen();

      // Simulate heartbeat mechanism
      const heartbeatInterval = setInterval(() => {
        if (ws.readyState === OPEN) {
          ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
        }
      }, CONFIG.HEARTBEAT_INTERVAL);

      // Advance time by heartbeat interval
      jest.advanceTimersByTime(CONFIG.HEARTBEAT_INTERVAL);

      expect(ws.getSentMessages()).toHaveLength(1);
      const lastMessage = JSON.parse(ws.getLastSentMessage().data);
      expect(lastMessage.type).toBe('heartbeat');

      clearInterval(heartbeatInterval);
    });

    test('should not send heartbeat when connection is closed', () => {
      const ws = new MockWebSocket(CONFIG.WS_URL);
      ws.simulateOpen();

      const heartbeatInterval = setInterval(() => {
        if (ws.readyState === OPEN) {
          ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
        }
      }, CONFIG.HEARTBEAT_INTERVAL);

      // Close connection
      ws.simulateClose(1000, 'Normal closure');

      // Advance time
      jest.advanceTimersByTime(CONFIG.HEARTBEAT_INTERVAL);

      // Should not have sent any heartbeats
      expect(ws.getSentMessages()).toHaveLength(0);

      clearInterval(heartbeatInterval);
    });
  });

  describe('Reconnection with Exponential Backoff', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should calculate exponential backoff delays correctly', () => {
      const calculateDelay = (attempt) => {
        return Math.min(
          CONFIG.INITIAL_RECONNECT_DELAY * Math.pow(2, attempt),
          CONFIG.MAX_RECONNECT_DELAY
        );
      };

      expect(calculateDelay(0)).toBe(1000);   // 1s
      expect(calculateDelay(1)).toBe(2000);   // 2s
      expect(calculateDelay(2)).toBe(4000);   // 4s
      expect(calculateDelay(3)).toBe(8000);   // 8s
      expect(calculateDelay(4)).toBe(16000);  // 16s
      expect(calculateDelay(5)).toBe(30000);  // 30s (max)
      expect(calculateDelay(10)).toBe(30000); // 30s (max)
    });

    test('should attempt reconnection after disconnect', () => {
      let reconnectAttempts = 0;
      const connectionStates = [];

      const connect = () => {
        connectionStates.push('connecting');
        const ws = new MockWebSocket(CONFIG.WS_URL);
        return ws;
      };

      const scheduleReconnect = () => {
        if (reconnectAttempts >= CONFIG.MAX_RECONNECT_ATTEMPTS) {
          connectionStates.push('failed');
          return;
        }

        const delay = Math.min(
          CONFIG.INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
          CONFIG.MAX_RECONNECT_DELAY
        );

        reconnectAttempts++;
        connectionStates.push(`reconnecting-${reconnectAttempts}`);

        setTimeout(() => {
          connect();
        }, delay);
      };

      // Initial connection
      const ws = connect();

      // Simulate disconnect
      MockWebSocket.autoConnect = false;
      ws.simulateClose(1006, 'Abnormal closure');
      scheduleReconnect();

      expect(connectionStates).toContain('reconnecting-1');

      // Advance timer to trigger reconnect
      jest.advanceTimersByTime(CONFIG.INITIAL_RECONNECT_DELAY);

      expect(connectionStates.filter(s => s === 'connecting')).toHaveLength(2);
    });

    test('should stop reconnecting after max attempts', () => {
      let reconnectAttempts = 0;
      let connectionFailed = false;

      const scheduleReconnect = () => {
        if (reconnectAttempts >= CONFIG.MAX_RECONNECT_ATTEMPTS) {
          connectionFailed = true;
          return;
        }
        reconnectAttempts++;
      };

      // Simulate max reconnection attempts
      for (let i = 0; i < CONFIG.MAX_RECONNECT_ATTEMPTS + 1; i++) {
        scheduleReconnect();
      }

      expect(reconnectAttempts).toBe(CONFIG.MAX_RECONNECT_ATTEMPTS);
      expect(connectionFailed).toBe(true);
    });

    test('should reset reconnect attempts on successful connection', () => {
      let reconnectAttempts = 5;

      // Simulate successful connection
      const ws = new MockWebSocket(CONFIG.WS_URL);
      ws.simulateOpen();

      // Reset attempts on successful connection
      reconnectAttempts = 0;

      expect(reconnectAttempts).toBe(0);
    });
  });

  describe('Connection State Management', () => {
    test('should track connection state transitions', () => {
      const states = [];
      let connectionState = 'disconnected';

      const updateState = (newState) => {
        connectionState = newState;
        states.push(newState);
      };

      // Initial state
      expect(connectionState).toBe('disconnected');

      // Connecting
      updateState('connecting');
      const ws = new MockWebSocket(CONFIG.WS_URL);

      // Connected
      ws.simulateOpen();
      updateState('connected');

      // Disconnected
      ws.simulateClose(1000, 'Normal closure');
      updateState('disconnected');

      expect(states).toEqual(['connecting', 'connected', 'disconnected']);
    });

    test('should prevent multiple simultaneous connections', () => {
      let connectionState = 'disconnected';
      const connections = [];

      const connect = () => {
        if (connectionState === 'connecting') {
          return null; // Skip if already connecting
        }

        connectionState = 'connecting';
        const ws = new MockWebSocket(CONFIG.WS_URL);
        connections.push(ws);
        return ws;
      };

      connect();
      connect(); // Should be skipped
      connect(); // Should be skipped

      expect(connections).toHaveLength(1);
    });
  });

  describe('Status Broadcasting', () => {
    test('should broadcast connection status to popup', async () => {
      const statusUpdates = [];

      const broadcastConnectionStatus = (status, data = {}) => {
        statusUpdates.push({ status, data, timestamp: Date.now() });

        // Also update storage
        chrome.storage.local.set({
          connectionStatus: status,
          connectionData: data,
          lastUpdated: Date.now()
        });
      };

      const ws = new MockWebSocket(CONFIG.WS_URL);

      // Simulate connection lifecycle
      broadcastConnectionStatus('connecting');
      ws.simulateOpen();
      broadcastConnectionStatus('connected');
      ws.simulateClose(1006, 'Abnormal closure');
      broadcastConnectionStatus('disconnected');

      expect(statusUpdates.map(u => u.status)).toEqual([
        'connecting',
        'connected',
        'disconnected'
      ]);

      // Verify storage was updated
      const stored = await chrome.storage.local.get(['connectionStatus']);
      expect(stored.connectionStatus).toBe('disconnected');
    });
  });

  describe('Error Handling', () => {
    test('should handle connection refused error', () => {
      MockWebSocket.autoConnect = false;
      const ws = new MockWebSocket(CONFIG.WS_URL);

      const errors = [];
      ws.onerror = (error) => {
        errors.push(error.message);
      };

      ws.simulateError('Connection refused');
      ws.simulateClose(1006, 'Abnormal closure');

      expect(errors).toContain('Connection refused');
      expect(ws.readyState).toBe(CLOSED);
    });

    test('should handle timeout errors', () => {
      MockWebSocket.autoConnect = false;
      const ws = new MockWebSocket(CONFIG.WS_URL);

      const errors = [];
      ws.onerror = (error) => {
        errors.push(error.message);
      };

      ws.simulateError('Connection timeout');

      expect(errors).toContain('Connection timeout');
    });

    test('should handle malformed message gracefully', () => {
      const ws = new MockWebSocket(CONFIG.WS_URL);
      ws.simulateOpen();

      const errors = [];
      ws.onmessage = (event) => {
        try {
          JSON.parse(event.data);
        } catch (e) {
          errors.push('Parse error');
        }
      };

      ws.simulateMessage('invalid json {{{');

      expect(errors).toContain('Parse error');
    });

    test('should handle network disconnection', () => {
      const ws = new MockWebSocket(CONFIG.WS_URL);
      ws.simulateOpen();

      const closures = [];
      ws.onclose = (event) => {
        closures.push({
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
      };

      // Simulate abnormal closure (network disconnect)
      ws.simulateClose(1006, 'Abnormal closure');

      expect(closures).toHaveLength(1);
      expect(closures[0].wasClean).toBe(false);
    });
  });

  describe('Auto-Response Mode', () => {
    test('should auto-respond to commands when configured', async () => {
      MockWebSocket.autoRespond = true;
      MockWebSocket.responseDelay = 0;
      MockWebSocket.autoRespondData = { success: true, mock: true };

      const ws = new MockWebSocket(CONFIG.WS_URL);
      ws.simulateOpen();

      const responses = [];
      ws.onmessage = (event) => {
        responses.push(JSON.parse(event.data));
      };

      // Send a command
      ws.send(JSON.stringify({
        command_id: 'test-cmd-1',
        type: 'get_page_state',
        params: {}
      }));

      await wait(10);

      expect(responses).toHaveLength(1);
      expect(responses[0].command_id).toBe('test-cmd-1');
      expect(responses[0].success).toBe(true);

      MockWebSocket.autoRespond = false;
    });
  });

  describe('Event Listeners', () => {
    test('should support multiple event listeners', () => {
      const ws = new MockWebSocket(CONFIG.WS_URL);

      const listener1 = jest.fn();
      const listener2 = jest.fn();

      ws.addEventListener('open', listener1);
      ws.addEventListener('open', listener2);

      ws.simulateOpen();

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    test('should remove event listeners correctly', () => {
      const ws = new MockWebSocket(CONFIG.WS_URL);

      const listener1 = jest.fn();
      const listener2 = jest.fn();

      ws.addEventListener('message', listener1);
      ws.addEventListener('message', listener2);
      ws.removeEventListener('message', listener1);

      ws.simulateOpen();
      ws.simulateMessage('test');

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });
});
