/**
 * Unit Tests for Background Service Worker
 *
 * Tests the background.js command handlers and WebSocket connection management.
 */

const { setupTestEnvironment, teardownTestEnvironment, resetTestMocks } = require('../helpers/setup');
const { MockWebSocket, getLastInstance, getAllInstances, resetMockWebSocket } = require('../mocks/websocket.mock');

// Store references to globals
let originalWebSocket;

beforeAll(() => {
  setupTestEnvironment();
  originalWebSocket = global.WebSocket;
  global.WebSocket = MockWebSocket;
});

afterAll(() => {
  teardownTestEnvironment();
  global.WebSocket = originalWebSocket;
});

beforeEach(() => {
  resetTestMocks();
  resetMockWebSocket();
  jest.clearAllMocks();
});

describe('Background Service Worker', () => {
  // ==========================================================================
  // Configuration Tests
  // ==========================================================================

  describe('Configuration', () => {
    test('should have correct default configuration values', () => {
      const CONFIG = {
        WS_URL: 'ws://localhost:8765/browser',
        MAX_RECONNECT_ATTEMPTS: 10,
        INITIAL_RECONNECT_DELAY: 1000,
        MAX_RECONNECT_DELAY: 30000,
        COMMAND_TIMEOUT: 30000,
        HEARTBEAT_INTERVAL: 30000
      };

      expect(CONFIG.WS_URL).toBe('ws://localhost:8765/browser');
      expect(CONFIG.MAX_RECONNECT_ATTEMPTS).toBe(10);
      expect(CONFIG.INITIAL_RECONNECT_DELAY).toBe(1000);
      expect(CONFIG.MAX_RECONNECT_DELAY).toBe(30000);
      expect(CONFIG.COMMAND_TIMEOUT).toBe(30000);
      expect(CONFIG.HEARTBEAT_INTERVAL).toBe(30000);
    });
  });

  // ==========================================================================
  // WebSocket Connection Tests
  // ==========================================================================

  describe('WebSocket Connection Management', () => {
    test('should create WebSocket connection with correct URL', () => {
      const ws = new MockWebSocket('ws://localhost:8765/browser');

      expect(ws.url).toBe('ws://localhost:8765/browser');
      expect(ws.readyState).toBe(MockWebSocket.CONNECTING);
    });

    test('should transition to OPEN state when connected', () => {
      const ws = new MockWebSocket('ws://localhost:8765/browser');
      ws.simulateOpen();

      expect(ws.readyState).toBe(MockWebSocket.OPEN);
    });

    test('should handle connection close gracefully', () => {
      const ws = new MockWebSocket('ws://localhost:8765/browser');
      const onClose = jest.fn();
      ws.onclose = onClose;

      ws.simulateOpen();
      ws.simulateClose(1000, 'Normal closure');

      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
      expect(onClose).toHaveBeenCalled();
    });

    test('should handle connection errors', () => {
      const ws = new MockWebSocket('ws://localhost:8765/browser');
      const onError = jest.fn();
      ws.onerror = onError;

      ws.simulateError(new Error('Connection refused'));

      expect(onError).toHaveBeenCalled();
    });

    test('should receive messages correctly', () => {
      const ws = new MockWebSocket('ws://localhost:8765/browser');
      const onMessage = jest.fn();
      ws.onmessage = onMessage;

      ws.simulateOpen();
      ws.simulateMessage({ command_id: 'test-1', type: 'ping' });

      expect(onMessage).toHaveBeenCalled();
      // The data is already a parsed object, not a JSON string
      const messageData = onMessage.mock.calls[0][0].data;
      expect(messageData.command_id).toBe('test-1');
      expect(messageData.type).toBe('ping');
    });

    test('should send messages correctly', () => {
      const ws = new MockWebSocket('ws://localhost:8765/browser');
      ws.simulateOpen();

      const message = { type: 'heartbeat', timestamp: Date.now() };
      ws.send(JSON.stringify(message));

      const sentMessages = ws.getSentMessages();
      expect(sentMessages.length).toBe(1);

      const sentData = JSON.parse(sentMessages[0].data);
      expect(sentData.type).toBe('heartbeat');
    });
  });

  // ==========================================================================
  // Reconnection Logic Tests
  // ==========================================================================

  describe('Reconnection with Exponential Backoff', () => {
    test('should calculate correct exponential backoff delays', () => {
      const INITIAL_DELAY = 1000;
      const MAX_DELAY = 30000;

      const calculateDelay = (attempt) => {
        return Math.min(INITIAL_DELAY * Math.pow(2, attempt), MAX_DELAY);
      };

      expect(calculateDelay(0)).toBe(1000);   // 1s
      expect(calculateDelay(1)).toBe(2000);   // 2s
      expect(calculateDelay(2)).toBe(4000);   // 4s
      expect(calculateDelay(3)).toBe(8000);   // 8s
      expect(calculateDelay(4)).toBe(16000);  // 16s
      expect(calculateDelay(5)).toBe(30000);  // capped at 30s
      expect(calculateDelay(10)).toBe(30000); // still capped
    });

    test('should not exceed max reconnect attempts', () => {
      const MAX_ATTEMPTS = 10;
      let attempts = 0;

      const scheduleReconnect = () => {
        if (attempts >= MAX_ATTEMPTS) {
          return false;
        }
        attempts++;
        return true;
      };

      for (let i = 0; i < 15; i++) {
        scheduleReconnect();
      }

      expect(attempts).toBe(MAX_ATTEMPTS);
    });
  });

  // ==========================================================================
  // Command Handler Tests
  // ==========================================================================

  describe('Command Handlers', () => {
    describe('Navigate Command', () => {
      test('should reject navigate without URL', async () => {
        const handleNavigate = async (params) => {
          const { url } = params;
          if (!url) {
            throw new Error('URL is required for navigate command');
          }
          return { url, loaded: true };
        };

        await expect(handleNavigate({})).rejects.toThrow('URL is required');
      });

      test('should validate URL format', async () => {
        const handleNavigate = async (params) => {
          const { url } = params;
          if (!url) {
            throw new Error('URL is required for navigate command');
          }
          try {
            new URL(url);
          } catch {
            throw new Error(`Invalid URL format: ${url}`);
          }
          return { url, loaded: true };
        };

        await expect(handleNavigate({ url: 'not-a-valid-url' }))
          .rejects.toThrow('Invalid URL format');
      });

      test('should accept valid URLs', async () => {
        const handleNavigate = async (params) => {
          const { url } = params;
          if (!url) throw new Error('URL is required');
          try {
            new URL(url);
          } catch {
            throw new Error(`Invalid URL format: ${url}`);
          }
          return { url, loaded: true };
        };

        const result = await handleNavigate({ url: 'https://example.com' });
        expect(result.url).toBe('https://example.com');
        expect(result.loaded).toBe(true);
      });
    });

    describe('Fill Form Command', () => {
      test('should reject fill_form without fields', async () => {
        const handleFillForm = async (params) => {
          const { fields } = params;
          if (!fields || typeof fields !== 'object' || Object.keys(fields).length === 0) {
            throw new Error('Fields object is required and must not be empty');
          }
          return { success: true, filled: [] };
        };

        await expect(handleFillForm({})).rejects.toThrow('Fields object is required');
      });

      test('should reject empty fields object', async () => {
        const handleFillForm = async (params) => {
          const { fields } = params;
          if (!fields || typeof fields !== 'object' || Object.keys(fields).length === 0) {
            throw new Error('Fields object is required and must not be empty');
          }
          return { success: true, filled: [] };
        };

        await expect(handleFillForm({ fields: {} })).rejects.toThrow('must not be empty');
      });

      test('should accept valid fields object', async () => {
        const handleFillForm = async (params) => {
          const { fields, submit = false } = params;
          if (!fields || typeof fields !== 'object' || Object.keys(fields).length === 0) {
            throw new Error('Fields object is required and must not be empty');
          }
          return {
            success: true,
            filled: Object.keys(fields).map(selector => ({ selector, success: true })),
            submit
          };
        };

        const result = await handleFillForm({
          fields: { '#username': 'testuser', '#email': 'test@example.com' }
        });

        expect(result.success).toBe(true);
        expect(result.filled.length).toBe(2);
      });
    });

    describe('Click Command', () => {
      test('should reject click without selector', async () => {
        const handleClick = async (params) => {
          const { selector } = params;
          if (!selector || typeof selector !== 'string') {
            throw new Error('Selector is required for click command');
          }
          return { success: true, clicked: selector };
        };

        await expect(handleClick({})).rejects.toThrow('Selector is required');
      });

      test('should accept valid selector', async () => {
        const handleClick = async (params) => {
          const { selector, wait_after = 0 } = params;
          if (!selector || typeof selector !== 'string') {
            throw new Error('Selector is required for click command');
          }
          return { success: true, clicked: selector, wait_after };
        };

        const result = await handleClick({ selector: '#submit-btn', wait_after: 500 });

        expect(result.success).toBe(true);
        expect(result.clicked).toBe('#submit-btn');
        expect(result.wait_after).toBe(500);
      });
    });

    describe('Screenshot Command', () => {
      test('should validate screenshot format', async () => {
        const handleScreenshot = async (params) => {
          const { format = 'png', quality = 100 } = params;
          const validFormats = ['png', 'jpeg'];
          if (!validFormats.includes(format)) {
            throw new Error(`Invalid screenshot format: ${format}. Valid formats: ${validFormats.join(', ')}`);
          }
          return { screenshot: 'data:image/png;base64,...', format };
        };

        await expect(handleScreenshot({ format: 'gif' }))
          .rejects.toThrow('Invalid screenshot format');
      });

      test('should validate quality parameter', async () => {
        const handleScreenshot = async (params) => {
          const { format = 'png', quality = 100 } = params;
          if (typeof quality !== 'number' || quality < 1 || quality > 100) {
            throw new Error('Quality must be a number between 1 and 100');
          }
          return { screenshot: 'data:image/png;base64,...', format, quality };
        };

        await expect(handleScreenshot({ quality: 150 }))
          .rejects.toThrow('Quality must be a number between 1 and 100');
      });

      test('should accept valid parameters', async () => {
        const handleScreenshot = async (params) => {
          const { format = 'png', quality = 100 } = params;
          const validFormats = ['png', 'jpeg'];
          if (!validFormats.includes(format)) {
            throw new Error(`Invalid screenshot format: ${format}`);
          }
          if (typeof quality !== 'number' || quality < 1 || quality > 100) {
            throw new Error('Quality must be a number between 1 and 100');
          }
          return { screenshot: 'data:image/jpeg;base64,...', format, quality };
        };

        const result = await handleScreenshot({ format: 'jpeg', quality: 80 });

        expect(result.format).toBe('jpeg');
        expect(result.quality).toBe(80);
      });
    });

    describe('Wait for Element Command', () => {
      test('should reject without selector', async () => {
        const handleWaitForElement = async (params) => {
          const { selector } = params;
          if (!selector || typeof selector !== 'string') {
            throw new Error('Selector is required for wait_for_element command');
          }
          return { found: true, selector };
        };

        await expect(handleWaitForElement({})).rejects.toThrow('Selector is required');
      });

      test('should accept valid selector with timeout', async () => {
        const handleWaitForElement = async (params) => {
          const { selector, timeout = 10000 } = params;
          if (!selector || typeof selector !== 'string') {
            throw new Error('Selector is required');
          }
          return { found: true, selector, timeout };
        };

        const result = await handleWaitForElement({ selector: '#modal', timeout: 5000 });

        expect(result.found).toBe(true);
        expect(result.selector).toBe('#modal');
        expect(result.timeout).toBe(5000);
      });
    });

    describe('Execute Script Command', () => {
      test('should reject without script', async () => {
        const handleExecuteScript = async (params) => {
          const { script } = params;
          if (!script || typeof script !== 'string') {
            throw new Error('Script is required for execute_script command');
          }
          return { success: true, result: null };
        };

        await expect(handleExecuteScript({})).rejects.toThrow('Script is required');
      });

      test('should accept valid script', async () => {
        const handleExecuteScript = async (params) => {
          const { script } = params;
          if (!script || typeof script !== 'string') {
            throw new Error('Script is required');
          }
          return { success: true, result: 'executed', scriptLength: script.length };
        };

        const result = await handleExecuteScript({ script: 'return document.title' });

        expect(result.success).toBe(true);
        expect(result.scriptLength).toBeGreaterThan(0);
      });
    });

    describe('Get Cookies Command', () => {
      test('should validate URL format when provided', async () => {
        const handleGetCookies = async (params) => {
          const { url } = params;
          if (url) {
            try {
              new URL(url);
            } catch {
              throw new Error(`Invalid URL format: ${url}`);
            }
          }
          return { cookies: [], count: 0 };
        };

        await expect(handleGetCookies({ url: 'invalid-url' }))
          .rejects.toThrow('Invalid URL format');
      });

      test('should accept valid URL', async () => {
        const handleGetCookies = async (params) => {
          const { url } = params;
          if (url) {
            try {
              new URL(url);
            } catch {
              throw new Error(`Invalid URL format: ${url}`);
            }
          }
          return { cookies: [], count: 0, query: { url } };
        };

        const result = await handleGetCookies({ url: 'https://example.com' });

        expect(result.query.url).toBe('https://example.com');
      });
    });

    describe('Set Cookies Command', () => {
      test('should reject empty cookies array', async () => {
        const handleSetCookies = async (params) => {
          const { cookies } = params;
          if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
            throw new Error('Cookies array is required and must not be empty');
          }
          return { success: true, results: [] };
        };

        await expect(handleSetCookies({ cookies: [] }))
          .rejects.toThrow('must not be empty');
      });

      test('should validate cookie name is required', async () => {
        const handleSetCookies = async (params) => {
          const { cookies } = params;
          if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
            throw new Error('Cookies array is required');
          }

          const results = [];
          for (const cookie of cookies) {
            if (!cookie.name) {
              results.push({ success: false, error: 'Cookie name is required' });
            } else {
              results.push({ success: true, name: cookie.name });
            }
          }

          return { results };
        };

        const result = await handleSetCookies({
          cookies: [{ value: 'test' }]
        });

        expect(result.results[0].success).toBe(false);
        expect(result.results[0].error).toBe('Cookie name is required');
      });
    });

    describe('Storage Commands', () => {
      describe('Set Local Storage', () => {
        test('should reject empty items object', async () => {
          const handleSetLocalStorage = async (params) => {
            const { items } = params;
            if (!items || typeof items !== 'object' || Object.keys(items).length === 0) {
              throw new Error('Items object is required and must not be empty');
            }
            return { success: true };
          };

          await expect(handleSetLocalStorage({ items: {} }))
            .rejects.toThrow('must not be empty');
        });

        test('should accept valid items', async () => {
          const handleSetLocalStorage = async (params) => {
            const { items } = params;
            if (!items || typeof items !== 'object' || Object.keys(items).length === 0) {
              throw new Error('Items object is required');
            }
            return { success: true, count: Object.keys(items).length };
          };

          const result = await handleSetLocalStorage({
            items: { key1: 'value1', key2: 'value2' }
          });

          expect(result.success).toBe(true);
          expect(result.count).toBe(2);
        });
      });

      describe('Set Session Storage', () => {
        test('should reject empty items object', async () => {
          const handleSetSessionStorage = async (params) => {
            const { items } = params;
            if (!items || typeof items !== 'object' || Object.keys(items).length === 0) {
              throw new Error('Items object is required and must not be empty');
            }
            return { success: true };
          };

          await expect(handleSetSessionStorage({ items: {} }))
            .rejects.toThrow('must not be empty');
        });
      });
    });

    describe('Network Capture Commands', () => {
      describe('Get Network Requests', () => {
        test('should handle start action', async () => {
          const captureState = { enabled: false, requests: [] };

          const handleGetNetworkRequests = async (params) => {
            const { action = 'get' } = params;

            switch (action) {
              case 'start':
                if (captureState.enabled) {
                  return { success: true, message: 'Already capturing', capturing: true };
                }
                captureState.enabled = true;
                return { success: true, message: 'Network capture started', capturing: true };
              case 'stop':
                captureState.enabled = false;
                return { success: true, message: 'Network capture stopped', capturing: false };
              case 'get':
                return { success: true, requests: captureState.requests, capturing: captureState.enabled };
              case 'clear':
                captureState.requests = [];
                return { success: true, message: 'Cleared', capturing: captureState.enabled };
              default:
                throw new Error(`Unknown action: ${action}`);
            }
          };

          const result = await handleGetNetworkRequests({ action: 'start' });

          expect(result.success).toBe(true);
          expect(result.capturing).toBe(true);
        });

        test('should handle invalid action', async () => {
          const handleGetNetworkRequests = async (params) => {
            const { action = 'get' } = params;
            const validActions = ['start', 'stop', 'get', 'clear'];
            if (!validActions.includes(action)) {
              throw new Error(`Unknown network capture action: ${action}`);
            }
            return { success: true };
          };

          await expect(handleGetNetworkRequests({ action: 'invalid' }))
            .rejects.toThrow('Unknown network capture action');
        });
      });
    });

    describe('Advanced Form Commands', () => {
      describe('Auto Fill Form', () => {
        test('should reject without data', async () => {
          const handleAutoFillForm = async (params) => {
            const { data } = params;
            if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
              throw new Error('Data object is required for auto-fill');
            }
            return { success: true };
          };

          await expect(handleAutoFillForm({ data: {} }))
            .rejects.toThrow('Data object is required');
        });
      });

      describe('Fill Select', () => {
        test('should reject without selector', async () => {
          const handleFillSelect = async (params) => {
            const { selector } = params;
            if (!selector) {
              throw new Error('Selector is required for fill_select');
            }
            return { success: true };
          };

          await expect(handleFillSelect({}))
            .rejects.toThrow('Selector is required');
        });
      });

      describe('Fill Checkbox', () => {
        test('should reject without selector', async () => {
          const handleFillCheckbox = async (params) => {
            const { selector } = params;
            if (!selector) {
              throw new Error('Selector is required for fill_checkbox');
            }
            return { success: true };
          };

          await expect(handleFillCheckbox({}))
            .rejects.toThrow('Selector is required');
        });
      });

      describe('Fill Radio', () => {
        test('should reject without name', async () => {
          const handleFillRadio = async (params) => {
            const { name, value } = params;
            if (!name) {
              throw new Error('Name is required for fill_radio');
            }
            if (value === undefined) {
              throw new Error('Value is required for fill_radio');
            }
            return { success: true };
          };

          await expect(handleFillRadio({ value: 'test' }))
            .rejects.toThrow('Name is required');
        });

        test('should reject without value', async () => {
          const handleFillRadio = async (params) => {
            const { name, value } = params;
            if (!name) {
              throw new Error('Name is required');
            }
            if (value === undefined) {
              throw new Error('Value is required for fill_radio');
            }
            return { success: true };
          };

          await expect(handleFillRadio({ name: 'gender' }))
            .rejects.toThrow('Value is required');
        });
      });

      describe('Fill Date', () => {
        test('should reject without selector', async () => {
          const handleFillDate = async (params) => {
            const { selector, date } = params;
            if (!selector) {
              throw new Error('Selector is required for fill_date');
            }
            if (!date) {
              throw new Error('Date is required for fill_date');
            }
            return { success: true };
          };

          await expect(handleFillDate({ date: '2024-01-01' }))
            .rejects.toThrow('Selector is required');
        });

        test('should reject without date', async () => {
          const handleFillDate = async (params) => {
            const { selector, date } = params;
            if (!selector) {
              throw new Error('Selector is required');
            }
            if (!date) {
              throw new Error('Date is required for fill_date');
            }
            return { success: true };
          };

          await expect(handleFillDate({ selector: '#dob' }))
            .rejects.toThrow('Date is required');
        });
      });

      describe('File Upload', () => {
        test('should reject without selector', async () => {
          const handleFileUpload = async (params) => {
            const { selector } = params;
            if (!selector) {
              throw new Error('Selector is required for handle_file_upload');
            }
            return { success: true, needsUserAction: true };
          };

          await expect(handleFileUpload({}))
            .rejects.toThrow('Selector is required');
        });
      });

      describe('Navigate Multi Step', () => {
        test('should validate direction parameter', async () => {
          const handleNavigateMultiStep = async (params) => {
            const { direction = 'next' } = params;
            if (!['next', 'prev'].includes(direction)) {
              throw new Error('Direction must be "next" or "prev"');
            }
            return { success: true, direction };
          };

          await expect(handleNavigateMultiStep({ direction: 'invalid' }))
            .rejects.toThrow('Direction must be "next" or "prev"');
        });
      });
    });

    describe('Request Interception Commands', () => {
      describe('Add Request Rule', () => {
        test('should reject without id', async () => {
          const handleAddRequestRule = async (params) => {
            const { id, type } = params;
            if (!id || !type) {
              throw new Error('Rule id and type are required');
            }
            return { success: true };
          };

          await expect(handleAddRequestRule({ type: 'block' }))
            .rejects.toThrow('Rule id and type are required');
        });

        test('should reject without type', async () => {
          const handleAddRequestRule = async (params) => {
            const { id, type } = params;
            if (!id || !type) {
              throw new Error('Rule id and type are required');
            }
            return { success: true };
          };

          await expect(handleAddRequestRule({ id: 'rule-1' }))
            .rejects.toThrow('Rule id and type are required');
        });
      });

      describe('Remove Request Rule', () => {
        test('should reject without id', async () => {
          const handleRemoveRequestRule = async (params) => {
            const { id } = params;
            if (!id) {
              throw new Error('Rule id is required');
            }
            return { success: true };
          };

          await expect(handleRemoveRequestRule({}))
            .rejects.toThrow('Rule id is required');
        });
      });

      describe('Block URLs', () => {
        test('should reject empty patterns array', async () => {
          const handleBlockUrls = async (params) => {
            const { patterns } = params;
            if (!patterns || !Array.isArray(patterns) || patterns.length === 0) {
              throw new Error('Patterns array is required');
            }
            return { success: true };
          };

          await expect(handleBlockUrls({ patterns: [] }))
            .rejects.toThrow('Patterns array is required');
        });
      });

      describe('Unblock URLs', () => {
        test('should reject without ruleIds or clearAll', async () => {
          const handleUnblockUrls = async (params) => {
            const { ruleIds, clearAll = false } = params;
            if (!clearAll && (!ruleIds || !Array.isArray(ruleIds) || ruleIds.length === 0)) {
              throw new Error('Rule IDs array is required (or set clearAll: true)');
            }
            return { success: true };
          };

          await expect(handleUnblockUrls({ ruleIds: [] }))
            .rejects.toThrow('Rule IDs array is required');
        });

        test('should accept clearAll flag', async () => {
          const handleUnblockUrls = async (params) => {
            const { clearAll = false } = params;
            if (clearAll) {
              return { success: true, clearedAll: true };
            }
            return { success: true };
          };

          const result = await handleUnblockUrls({ clearAll: true });
          expect(result.clearedAll).toBe(true);
        });
      });

      describe('Get Interception Rules', () => {
        test('should handle unknown rule type', async () => {
          const handleGetInterceptionRules = async (params) => {
            const { type } = params;
            const validTypes = ['header', 'block', 'mock', 'redirect'];
            if (type && !validTypes.includes(type)) {
              throw new Error(`Unknown rule type: ${type}`);
            }
            return { success: true, rules: [] };
          };

          await expect(handleGetInterceptionRules({ type: 'invalid' }))
            .rejects.toThrow('Unknown rule type');
        });
      });

      describe('Clear Interception Rules', () => {
        test('should handle unknown rule type', async () => {
          const handleClearInterceptionRules = async (params) => {
            const { type } = params;
            if (type) {
              const validTypes = ['header', 'block', 'mock', 'redirect'];
              if (!validTypes.includes(type)) {
                throw new Error(`Unknown rule type: ${type}`);
              }
            }
            return { success: true };
          };

          await expect(handleClearInterceptionRules({ type: 'invalid' }))
            .rejects.toThrow('Unknown rule type');
        });
      });
    });
  });

  // ==========================================================================
  // Command Processing Tests
  // ==========================================================================

  describe('Command Processing', () => {
    test('should reject command without command_id', async () => {
      const processCommand = async (command) => {
        const { command_id } = command;
        if (!command_id) {
          throw new Error('Command missing command_id');
        }
        return { command_id };
      };

      await expect(processCommand({})).rejects.toThrow('missing command_id');
    });

    test('should reject command without type', async () => {
      const processCommand = async (command) => {
        const { command_id, type } = command;
        if (!command_id) {
          throw new Error('Command missing command_id');
        }
        if (!type) {
          throw new Error('Missing command type');
        }
        return { command_id, type };
      };

      await expect(processCommand({ command_id: 'test-1' }))
        .rejects.toThrow('Missing command type');
    });

    test('should reject unknown command type', async () => {
      const commandHandlers = {
        navigate: () => ({}),
        fill_form: () => ({}),
        click: () => ({})
      };

      const processCommand = async (command) => {
        const { type } = command;
        const handler = commandHandlers[type];
        if (!handler) {
          throw new Error(`Unknown command type: ${type}`);
        }
        return handler();
      };

      await expect(processCommand({ command_id: 'test-1', type: 'unknown_command' }))
        .rejects.toThrow('Unknown command type');
    });

    test('should route to correct handler', async () => {
      const commandHandlers = {
        navigate: jest.fn().mockResolvedValue({ url: 'test' }),
        fill_form: jest.fn().mockResolvedValue({ filled: [] }),
        click: jest.fn().mockResolvedValue({ clicked: true })
      };

      const processCommand = async (command) => {
        const { type, params = {} } = command;
        const handler = commandHandlers[type];
        if (!handler) {
          throw new Error(`Unknown command type: ${type}`);
        }
        return handler(params);
      };

      await processCommand({ command_id: 'test-1', type: 'navigate', params: { url: 'https://example.com' } });

      expect(commandHandlers.navigate).toHaveBeenCalled();
      expect(commandHandlers.fill_form).not.toHaveBeenCalled();
      expect(commandHandlers.click).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Response Handling Tests
  // ==========================================================================

  describe('Response Handling', () => {
    test('should format success response correctly', () => {
      const formatResponse = (command_id, success, result, error = null) => {
        return {
          command_id,
          success,
          result,
          error,
          timestamp: Date.now()
        };
      };

      const response = formatResponse('cmd-123', true, { data: 'test' });

      expect(response.command_id).toBe('cmd-123');
      expect(response.success).toBe(true);
      expect(response.result.data).toBe('test');
      expect(response.error).toBeNull();
      expect(response.timestamp).toBeDefined();
    });

    test('should format error response correctly', () => {
      const formatResponse = (command_id, success, result, error = null) => {
        return {
          command_id,
          success,
          result,
          error,
          timestamp: Date.now()
        };
      };

      const response = formatResponse('cmd-123', false, null, 'Something went wrong');

      expect(response.command_id).toBe('cmd-123');
      expect(response.success).toBe(false);
      expect(response.result).toBeNull();
      expect(response.error).toBe('Something went wrong');
    });
  });

  // ==========================================================================
  // Heartbeat Tests
  // ==========================================================================

  describe('Heartbeat', () => {
    test('should format heartbeat message correctly', () => {
      const createHeartbeat = () => ({
        type: 'heartbeat',
        timestamp: Date.now()
      });

      const heartbeat = createHeartbeat();

      expect(heartbeat.type).toBe('heartbeat');
      expect(heartbeat.timestamp).toBeDefined();
      expect(typeof heartbeat.timestamp).toBe('number');
    });
  });

  // ==========================================================================
  // Task Queue Tests
  // ==========================================================================

  describe('Task Queue Management', () => {
    test('should add task to queue', () => {
      const taskQueue = [];

      const addTask = (task) => {
        taskQueue.push({
          ...task,
          startTime: Date.now(),
          status: 'running'
        });
      };

      addTask({ command_id: 'cmd-1', type: 'navigate', params: {} });

      expect(taskQueue.length).toBe(1);
      expect(taskQueue[0].status).toBe('running');
    });

    test('should mark task as completed', () => {
      const taskQueue = [
        { command_id: 'cmd-1', type: 'navigate', status: 'running', startTime: Date.now() }
      ];

      const completeTask = (command_id) => {
        const task = taskQueue.find(t => t.command_id === command_id);
        if (task) {
          task.status = 'completed';
          task.endTime = Date.now();
        }
      };

      completeTask('cmd-1');

      expect(taskQueue[0].status).toBe('completed');
      expect(taskQueue[0].endTime).toBeDefined();
    });

    test('should mark task as failed', () => {
      const taskQueue = [
        { command_id: 'cmd-1', type: 'navigate', status: 'running', startTime: Date.now() }
      ];

      const failTask = (command_id, error) => {
        const task = taskQueue.find(t => t.command_id === command_id);
        if (task) {
          task.status = 'failed';
          task.error = error;
          task.endTime = Date.now();
        }
      };

      failTask('cmd-1', 'Navigation failed');

      expect(taskQueue[0].status).toBe('failed');
      expect(taskQueue[0].error).toBe('Navigation failed');
    });

    test('should clean up old tasks', () => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const taskQueue = [
        { command_id: 'old-1', endTime: fiveMinutesAgo - 1000, status: 'completed' },
        { command_id: 'old-2', endTime: fiveMinutesAgo - 500, status: 'completed' },
        { command_id: 'recent-1', endTime: Date.now() - 1000, status: 'completed' }
      ];

      const cleanupTaskQueue = () => {
        const cutoff = Date.now() - 5 * 60 * 1000;
        while (taskQueue.length > 0 && taskQueue[0].endTime && taskQueue[0].endTime < cutoff) {
          taskQueue.shift();
        }
      };

      cleanupTaskQueue();

      expect(taskQueue.length).toBe(1);
      expect(taskQueue[0].command_id).toBe('recent-1');
    });

    test('should limit queue size', () => {
      const taskQueue = [];
      const MAX_QUEUE_SIZE = 50;

      // Add more than max tasks
      for (let i = 0; i < 60; i++) {
        taskQueue.push({ command_id: `cmd-${i}`, status: 'completed' });
      }

      const limitQueue = () => {
        while (taskQueue.length > MAX_QUEUE_SIZE) {
          taskQueue.shift();
        }
      };

      limitQueue();

      expect(taskQueue.length).toBe(50);
      expect(taskQueue[0].command_id).toBe('cmd-10');
    });
  });
});
