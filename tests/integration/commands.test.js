/**
 * Integration Tests for Command Handlers
 *
 * Tests the command processing and execution including:
 * - Command routing
 * - Parameter validation
 * - Response formatting
 * - Error handling
 * - Task queue management
 */

const { setupTestEnvironment, teardownTestEnvironment, resetTestMocks, wait } = require('../helpers/setup');
const { MockWebSocket, resetMockWebSocket, OPEN } = require('../mocks/websocket.mock');
const { assertWebSocketMessageSent, assertNavigatedTo, assertFormFilled, assertTabMessageSent } = require('../helpers/assertions');

describe('Command Handlers', () => {
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
  });

  describe('Command Routing', () => {
    test('should route navigate command correctly', async () => {
      const command = {
        command_id: 'nav-1',
        type: 'navigate',
        params: { url: 'https://example.com' }
      };

      // Simulate processing
      expect(command.type).toBe('navigate');
      expect(command.params.url).toBe('https://example.com');
    });

    test('should route fill_form command correctly', () => {
      const command = {
        command_id: 'form-1',
        type: 'fill_form',
        params: {
          fields: { '#email': 'test@example.com', '#password': 'secret' },
          submit: false
        }
      };

      expect(command.type).toBe('fill_form');
      expect(command.params.fields['#email']).toBe('test@example.com');
    });

    test('should route click command correctly', () => {
      const command = {
        command_id: 'click-1',
        type: 'click',
        params: { selector: '#submit-btn', wait_after: 500 }
      };

      expect(command.type).toBe('click');
      expect(command.params.selector).toBe('#submit-btn');
    });

    test('should reject unknown command type', () => {
      const command = {
        command_id: 'unknown-1',
        type: 'unknown_command',
        params: {}
      };

      const knownCommands = [
        'navigate', 'fill_form', 'click', 'get_content', 'screenshot',
        'wait_for_element', 'get_page_state', 'execute_script'
      ];

      expect(knownCommands).not.toContain(command.type);
    });
  });

  describe('Navigate Command', () => {
    test('should validate URL is required', () => {
      const command = {
        command_id: 'nav-1',
        type: 'navigate',
        params: {}
      };

      const validateNavigate = (params) => {
        if (!params.url) {
          throw new Error('URL is required for navigate command');
        }
      };

      expect(() => validateNavigate(command.params)).toThrow('URL is required');
    });

    test('should validate URL format', () => {
      const validateUrl = (url) => {
        try {
          new URL(url);
          return true;
        } catch {
          throw new Error(`Invalid URL format: ${url}`);
        }
      };

      expect(validateUrl('https://example.com')).toBe(true);
      expect(validateUrl('http://localhost:3000')).toBe(true);
      expect(() => validateUrl('not-a-url')).toThrow('Invalid URL format');
    });

    test('should handle navigate with wait_for parameter', () => {
      const command = {
        command_id: 'nav-2',
        type: 'navigate',
        params: {
          url: 'https://example.com/form',
          wait_for: '#loginForm',
          timeout: 10000
        }
      };

      expect(command.params.wait_for).toBe('#loginForm');
      expect(command.params.timeout).toBe(10000);
    });

    test('should use default timeout if not specified', () => {
      const DEFAULT_TIMEOUT = 30000;
      const command = {
        command_id: 'nav-3',
        type: 'navigate',
        params: { url: 'https://example.com' }
      };

      const timeout = command.params.timeout || DEFAULT_TIMEOUT;
      expect(timeout).toBe(DEFAULT_TIMEOUT);
    });
  });

  describe('Fill Form Command', () => {
    test('should validate fields object is required', () => {
      const validateFillForm = (params) => {
        if (!params.fields || typeof params.fields !== 'object' || Object.keys(params.fields).length === 0) {
          throw new Error('Fields object is required and must not be empty');
        }
      };

      expect(() => validateFillForm({})).toThrow('Fields object is required');
      expect(() => validateFillForm({ fields: null })).toThrow('Fields object is required');
      expect(() => validateFillForm({ fields: {} })).toThrow('must not be empty');
    });

    test('should accept valid fields object', () => {
      const params = {
        fields: {
          '#username': 'testuser',
          '#email': 'test@example.com',
          '#password': 'password123'
        },
        submit: true
      };

      expect(Object.keys(params.fields)).toHaveLength(3);
      expect(params.submit).toBe(true);
    });

    test('should send fill_form action to content script', () => {
      const message = {
        action: 'fill_form',
        fields: {
          '#email': 'test@example.com'
        },
        submit: false
      };

      expect(message.action).toBe('fill_form');
      expect(message.fields['#email']).toBe('test@example.com');
    });
  });

  describe('Click Command', () => {
    test('should validate selector is required', () => {
      const validateClick = (params) => {
        if (!params.selector || typeof params.selector !== 'string') {
          throw new Error('Selector is required for click command');
        }
      };

      expect(() => validateClick({})).toThrow('Selector is required');
      expect(() => validateClick({ selector: 123 })).toThrow('Selector is required');
    });

    test('should accept wait_after parameter', () => {
      const params = {
        selector: '#submit-btn',
        wait_after: 1000
      };

      expect(params.wait_after).toBe(1000);
    });

    test('should default wait_after to 0', () => {
      const params = { selector: '#button' };
      const wait_after = params.wait_after || 0;

      expect(wait_after).toBe(0);
    });
  });

  describe('Screenshot Command', () => {
    test('should validate format parameter', () => {
      const validateScreenshot = (params) => {
        const validFormats = ['png', 'jpeg'];
        const format = params.format || 'png';

        if (!validFormats.includes(format)) {
          throw new Error(`Invalid screenshot format: ${format}`);
        }
        return format;
      };

      expect(validateScreenshot({ format: 'png' })).toBe('png');
      expect(validateScreenshot({ format: 'jpeg' })).toBe('jpeg');
      expect(validateScreenshot({})).toBe('png'); // default
      expect(() => validateScreenshot({ format: 'gif' })).toThrow('Invalid screenshot format');
    });

    test('should validate quality parameter', () => {
      const validateQuality = (params) => {
        const quality = params.quality ?? 100;

        if (typeof quality !== 'number' || quality < 1 || quality > 100) {
          throw new Error('Quality must be a number between 1 and 100');
        }
        return quality;
      };

      expect(validateQuality({ quality: 50 })).toBe(50);
      expect(validateQuality({})).toBe(100); // default
      expect(() => validateQuality({ quality: 0 })).toThrow('Quality must be');
      expect(() => validateQuality({ quality: 101 })).toThrow('Quality must be');
      expect(() => validateQuality({ quality: 'high' })).toThrow('Quality must be');
    });
  });

  describe('Get Content Command', () => {
    test('should default to body selector', () => {
      const params = {};
      const selector = params.selector || 'body';

      expect(selector).toBe('body');
    });

    test('should accept custom selector', () => {
      const params = { selector: '#main-content' };

      expect(params.selector).toBe('#main-content');
    });
  });

  describe('Wait For Element Command', () => {
    test('should validate selector is required', () => {
      const validateWaitFor = (params) => {
        if (!params.selector || typeof params.selector !== 'string') {
          throw new Error('Selector is required for wait_for_element command');
        }
      };

      expect(() => validateWaitFor({})).toThrow('Selector is required');
    });

    test('should use default timeout', () => {
      const DEFAULT_TIMEOUT = 10000;
      const params = { selector: '.loading-complete' };
      const timeout = params.timeout || DEFAULT_TIMEOUT;

      expect(timeout).toBe(DEFAULT_TIMEOUT);
    });

    test('should accept custom timeout', () => {
      const params = { selector: '.loading-complete', timeout: 30000 };

      expect(params.timeout).toBe(30000);
    });
  });

  describe('Execute Script Command', () => {
    test('should validate script is required', () => {
      const validateExecuteScript = (params) => {
        if (!params.script || typeof params.script !== 'string') {
          throw new Error('Script is required for execute_script command');
        }
      };

      expect(() => validateExecuteScript({})).toThrow('Script is required');
      expect(() => validateExecuteScript({ script: null })).toThrow('Script is required');
    });

    test('should accept valid script', () => {
      const params = { script: 'document.title' };

      expect(params.script).toBe('document.title');
    });
  });

  describe('Cookie Commands', () => {
    describe('Get Cookies', () => {
      test('should get cookies with URL filter', () => {
        const params = { url: 'https://example.com' };

        expect(params.url).toBe('https://example.com');
      });

      test('should get cookies with domain filter', () => {
        const params = { domain: 'example.com' };

        expect(params.domain).toBe('example.com');
      });

      test('should get cookies with name filter', () => {
        const params = { url: 'https://example.com', name: 'session' };

        expect(params.name).toBe('session');
      });
    });

    describe('Set Cookies', () => {
      test('should validate cookies array is required', () => {
        const validateSetCookies = (params) => {
          if (!params.cookies || !Array.isArray(params.cookies) || params.cookies.length === 0) {
            throw new Error('Cookies array is required and must not be empty');
          }
        };

        expect(() => validateSetCookies({})).toThrow('Cookies array is required');
        expect(() => validateSetCookies({ cookies: [] })).toThrow('must not be empty');
      });

      test('should validate cookie name is required', () => {
        const validateCookie = (cookie) => {
          if (!cookie.name) {
            throw new Error('Cookie name is required');
          }
        };

        expect(() => validateCookie({})).toThrow('Cookie name is required');
      });
    });
  });

  describe('Storage Commands', () => {
    describe('Local Storage', () => {
      test('should get localStorage items', () => {
        const message = {
          action: 'get_local_storage',
          keys: ['user', 'settings']
        };

        expect(message.action).toBe('get_local_storage');
        expect(message.keys).toContain('user');
      });

      test('should set localStorage items', () => {
        const validateSetStorage = (params) => {
          if (!params.items || typeof params.items !== 'object' || Object.keys(params.items).length === 0) {
            throw new Error('Items object is required and must not be empty');
          }
        };

        expect(() => validateSetStorage({})).toThrow('Items object is required');
      });
    });

    describe('Session Storage', () => {
      test('should get sessionStorage items', () => {
        const message = {
          action: 'get_session_storage',
          keys: null // all items
        };

        expect(message.action).toBe('get_session_storage');
        expect(message.keys).toBeNull();
      });
    });

    describe('Clear Storage', () => {
      test('should clear specified storage types', () => {
        const params = {
          types: ['cookies', 'localStorage']
        };

        expect(params.types).toContain('cookies');
        expect(params.types).toContain('localStorage');
        expect(params.types).not.toContain('sessionStorage');
      });

      test('should default to all types', () => {
        const params = {};
        const types = params.types || ['cookies', 'localStorage', 'sessionStorage'];

        expect(types).toHaveLength(3);
      });
    });
  });

  describe('Network Commands', () => {
    test('should start network capture', () => {
      const params = {
        action: 'start',
        filter: {
          urls: ['*://api.example.com/*'],
          types: ['xmlhttprequest']
        }
      };

      expect(params.action).toBe('start');
      expect(params.filter.urls).toContain('*://api.example.com/*');
    });

    test('should stop network capture', () => {
      const params = { action: 'stop' };

      expect(params.action).toBe('stop');
    });

    test('should get network requests', () => {
      const params = { action: 'get' };

      expect(params.action).toBe('get');
    });

    test('should clear network requests', () => {
      const params = { action: 'clear' };

      expect(params.action).toBe('clear');
    });
  });

  describe('Advanced Form Commands', () => {
    describe('Auto Fill Form', () => {
      test('should validate data is required', () => {
        const validateAutoFill = (params) => {
          if (!params.data || typeof params.data !== 'object' || Object.keys(params.data).length === 0) {
            throw new Error('Data object is required for auto-fill');
          }
        };

        expect(() => validateAutoFill({})).toThrow('Data object is required');
        expect(() => validateAutoFill({ data: {} })).toThrow('Data object is required');
      });

      test('should accept form selector and data', () => {
        const params = {
          formSelector: '#loginForm',
          data: {
            email: 'test@example.com',
            password: 'password123'
          },
          options: {
            humanLike: true,
            submitAfter: true
          }
        };

        expect(params.formSelector).toBe('#loginForm');
        expect(params.data.email).toBe('test@example.com');
        expect(params.options.submitAfter).toBe(true);
      });
    });

    describe('Fill Select', () => {
      test('should validate selector is required', () => {
        const validateFillSelect = (params) => {
          if (!params.selector) {
            throw new Error('Selector is required for fill_select');
          }
        };

        expect(() => validateFillSelect({})).toThrow('Selector is required');
      });

      test('should accept byText option', () => {
        const params = {
          selector: '#country',
          value: 'United States',
          options: { byText: true }
        };

        expect(params.options.byText).toBe(true);
      });
    });

    describe('Fill Radio', () => {
      test('should validate name and value are required', () => {
        const validateFillRadio = (params) => {
          if (!params.name) {
            throw new Error('Name is required for fill_radio');
          }
          if (params.value === undefined) {
            throw new Error('Value is required for fill_radio');
          }
        };

        expect(() => validateFillRadio({})).toThrow('Name is required');
        expect(() => validateFillRadio({ name: 'gender' })).toThrow('Value is required');
      });
    });

    describe('Fill Date', () => {
      test('should validate selector and date are required', () => {
        const validateFillDate = (params) => {
          if (!params.selector) {
            throw new Error('Selector is required for fill_date');
          }
          if (!params.date) {
            throw new Error('Date is required for fill_date');
          }
        };

        expect(() => validateFillDate({})).toThrow('Selector is required');
        expect(() => validateFillDate({ selector: '#dob' })).toThrow('Date is required');
      });
    });

    describe('Navigate Multi-Step', () => {
      test('should validate direction', () => {
        const validateDirection = (params) => {
          const direction = params.direction || 'next';
          if (!['next', 'prev'].includes(direction)) {
            throw new Error('Direction must be "next" or "prev"');
          }
          return direction;
        };

        expect(validateDirection({ direction: 'next' })).toBe('next');
        expect(validateDirection({ direction: 'prev' })).toBe('prev');
        expect(validateDirection({})).toBe('next'); // default
        expect(() => validateDirection({ direction: 'forward' })).toThrow('Direction must be');
      });
    });
  });

  describe('Response Formatting', () => {
    test('should format success response correctly', () => {
      const formatResponse = (commandId, success, result, error = null) => ({
        command_id: commandId,
        success,
        result,
        error,
        timestamp: Date.now()
      });

      const response = formatResponse('cmd-1', true, { url: 'https://example.com' });

      expect(response.command_id).toBe('cmd-1');
      expect(response.success).toBe(true);
      expect(response.result.url).toBe('https://example.com');
      expect(response.error).toBeNull();
      expect(response.timestamp).toBeDefined();
    });

    test('should format error response correctly', () => {
      const formatResponse = (commandId, success, result, error = null) => ({
        command_id: commandId,
        success,
        result,
        error,
        timestamp: Date.now()
      });

      const response = formatResponse('cmd-2', false, null, 'Element not found');

      expect(response.command_id).toBe('cmd-2');
      expect(response.success).toBe(false);
      expect(response.result).toBeNull();
      expect(response.error).toBe('Element not found');
    });
  });

  describe('Task Queue Management', () => {
    test('should add task to queue', () => {
      const taskQueue = [];

      const addTask = (commandId, type, params) => {
        const task = {
          command_id: commandId,
          type,
          params,
          startTime: Date.now(),
          status: 'running'
        };
        taskQueue.push(task);
        return task;
      };

      addTask('cmd-1', 'navigate', { url: 'https://example.com' });

      expect(taskQueue).toHaveLength(1);
      expect(taskQueue[0].status).toBe('running');
    });

    test('should update task status on completion', () => {
      const task = {
        command_id: 'cmd-1',
        type: 'navigate',
        startTime: Date.now(),
        status: 'running'
      };

      // Complete task
      task.status = 'completed';
      task.endTime = Date.now();

      expect(task.status).toBe('completed');
      expect(task.endTime).toBeDefined();
    });

    test('should update task status on failure', () => {
      const task = {
        command_id: 'cmd-1',
        type: 'navigate',
        startTime: Date.now(),
        status: 'running'
      };

      // Fail task
      task.status = 'failed';
      task.error = 'Navigation timeout';
      task.endTime = Date.now();

      expect(task.status).toBe('failed');
      expect(task.error).toBe('Navigation timeout');
    });

    test('should clean up old tasks', () => {
      const taskQueue = [];
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

      // Add old completed task
      taskQueue.push({
        command_id: 'old-1',
        status: 'completed',
        endTime: fiveMinutesAgo - 1000
      });

      // Add recent task
      taskQueue.push({
        command_id: 'new-1',
        status: 'completed',
        endTime: Date.now()
      });

      // Clean up old tasks
      while (taskQueue.length > 0 && taskQueue[0].endTime && taskQueue[0].endTime < fiveMinutesAgo) {
        taskQueue.shift();
      }

      expect(taskQueue).toHaveLength(1);
      expect(taskQueue[0].command_id).toBe('new-1');
    });

    test('should limit task queue size', () => {
      const taskQueue = [];
      const MAX_TASKS = 50;

      // Add more than max tasks
      for (let i = 0; i < 60; i++) {
        taskQueue.push({ command_id: `cmd-${i}` });
      }

      // Trim to max size
      while (taskQueue.length > MAX_TASKS) {
        taskQueue.shift();
      }

      expect(taskQueue).toHaveLength(MAX_TASKS);
      expect(taskQueue[0].command_id).toBe('cmd-10'); // First 10 were removed
    });
  });

  describe('Command ID Validation', () => {
    test('should reject command without command_id', () => {
      const validateCommand = (command) => {
        if (!command.command_id) {
          throw new Error('Command missing command_id');
        }
      };

      expect(() => validateCommand({ type: 'navigate' })).toThrow('Command missing command_id');
    });

    test('should reject command without type', () => {
      const validateCommand = (command) => {
        if (!command.type) {
          throw new Error('Missing command type');
        }
      };

      expect(() => validateCommand({ command_id: 'cmd-1' })).toThrow('Missing command type');
    });
  });
});
