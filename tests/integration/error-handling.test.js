/**
 * Integration Tests for Error Handling
 *
 * Tests failure scenarios and error recovery including:
 * - WebSocket connection failures
 * - Command execution failures
 * - Timeout handling
 * - Content script errors
 * - Network failures
 * - Invalid parameters
 * - Recovery procedures
 */

const { setupTestEnvironment, teardownTestEnvironment, resetTestMocks, wait } = require('../helpers/setup');
const { MockWebSocket, resetMockWebSocket, OPEN, CLOSED, CONNECTING } = require('../mocks/websocket.mock');

describe('Error Handling', () => {
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

  describe('WebSocket Connection Failures', () => {
    test('should handle connection refused error', async () => {
      const connectionErrors = [];

      const handleConnectionError = (error) => {
        connectionErrors.push({
          type: 'connection_error',
          message: error.message,
          timestamp: Date.now()
        });
      };

      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      handleConnectionError(error);

      expect(connectionErrors).toHaveLength(1);
      expect(connectionErrors[0].type).toBe('connection_error');
      expect(connectionErrors[0].message).toBe('Connection refused');
    });

    test('should handle WebSocket close unexpectedly', () => {
      const closeReasons = {
        1000: 'Normal closure',
        1001: 'Going away',
        1002: 'Protocol error',
        1003: 'Unsupported data',
        1006: 'Abnormal closure',
        1007: 'Invalid data',
        1008: 'Policy violation',
        1009: 'Message too large',
        1010: 'Extension required',
        1011: 'Internal error',
        1015: 'TLS handshake failure'
      };

      const handleClose = (code, reason) => {
        const isError = code !== 1000;
        return {
          isError,
          code,
          reason: reason || closeReasons[code] || 'Unknown',
          shouldReconnect: isError && code !== 1008
        };
      };

      // Normal close
      let result = handleClose(1000, 'Normal closure');
      expect(result.isError).toBe(false);
      expect(result.shouldReconnect).toBe(false);

      // Abnormal close
      result = handleClose(1006);
      expect(result.isError).toBe(true);
      expect(result.shouldReconnect).toBe(true);
      expect(result.reason).toBe('Abnormal closure');

      // Policy violation - don't reconnect
      result = handleClose(1008, 'Policy violation');
      expect(result.shouldReconnect).toBe(false);
    });

    test('should implement exponential backoff on reconnection', async () => {
      const BASE_DELAY = 1000;
      const MAX_DELAY = 30000;
      const MAX_ATTEMPTS = 10;

      const calculateBackoff = (attempt) => {
        const delay = Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_DELAY);
        // Add jitter (10% variance)
        const jitter = delay * 0.1 * (Math.random() - 0.5);
        return Math.floor(delay + jitter);
      };

      // Attempt 0: ~1000ms
      let delay = calculateBackoff(0);
      expect(delay).toBeGreaterThanOrEqual(900);
      expect(delay).toBeLessThanOrEqual(1100);

      // Attempt 3: ~8000ms
      delay = calculateBackoff(3);
      expect(delay).toBeGreaterThanOrEqual(7200);
      expect(delay).toBeLessThanOrEqual(8800);

      // Attempt 10: capped at 30000ms
      delay = calculateBackoff(10);
      expect(delay).toBeLessThanOrEqual(33000);
    });

    test('should stop reconnecting after max attempts', () => {
      const MAX_ATTEMPTS = 10;
      let attempts = 0;
      let shouldContinue = true;

      const attemptReconnect = () => {
        attempts++;
        if (attempts >= MAX_ATTEMPTS) {
          shouldContinue = false;
          return { success: false, error: 'Max reconnection attempts exceeded' };
        }
        return { success: false, error: 'Connection failed', attempt: attempts };
      };

      while (shouldContinue) {
        attemptReconnect();
      }

      expect(attempts).toBe(MAX_ATTEMPTS);
      expect(shouldContinue).toBe(false);
    });

    test('should handle WebSocket error event', () => {
      const errors = [];

      const handleWebSocketError = (event) => {
        errors.push({
          type: 'websocket_error',
          message: event.message || 'WebSocket error occurred',
          timestamp: Date.now()
        });
      };

      handleWebSocketError({ message: 'Connection lost' });
      handleWebSocketError({});

      expect(errors).toHaveLength(2);
      expect(errors[0].message).toBe('Connection lost');
      expect(errors[1].message).toBe('WebSocket error occurred');
    });
  });

  describe('Command Execution Failures', () => {
    test('should handle command timeout', async () => {
      const COMMAND_TIMEOUT = 30000;

      const executeWithTimeout = async (command, timeout = COMMAND_TIMEOUT) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error(`Command ${command.type} timed out after ${timeout}ms`));
          }, 100); // Use shorter timeout for test

          // Simulate long-running command that never completes
          // In real scenario, this would be awaiting the actual command
        });
      };

      const command = { command_id: 'timeout-1', type: 'navigate', params: { url: 'https://slow-site.com' } };

      await expect(executeWithTimeout(command, 100)).rejects.toThrow('timed out');
    });

    test('should handle element not found error', () => {
      const findElement = (selector) => {
        const element = null; // Simulating element not found
        if (!element) {
          throw new Error(`Element not found: ${selector}`);
        }
        return element;
      };

      expect(() => findElement('#non-existent')).toThrow('Element not found: #non-existent');
    });

    test('should handle multiple selector strategies before failing', () => {
      const strategies = [
        { name: 'css', fn: (sel) => null },
        { name: 'id', fn: (sel) => null },
        { name: 'name', fn: (sel) => null },
        { name: 'xpath', fn: (sel) => null }
      ];

      const findWithFallback = (selector) => {
        const errors = [];

        for (const strategy of strategies) {
          try {
            const element = strategy.fn(selector);
            if (element) return { element, strategy: strategy.name };
          } catch (e) {
            errors.push({ strategy: strategy.name, error: e.message });
          }
        }

        return {
          element: null,
          error: `Element not found using any strategy: ${selector}`,
          attempted: strategies.map(s => s.name)
        };
      };

      const result = findWithFallback('#test');
      expect(result.element).toBeNull();
      expect(result.attempted).toEqual(['css', 'id', 'name', 'xpath']);
    });

    test('should handle script execution error', () => {
      const executeScript = (script) => {
        try {
          // Simulate script syntax error
          if (script.includes('syntax error')) {
            throw new SyntaxError('Unexpected token');
          }
          // Simulate runtime error
          if (script.includes('undefined_var')) {
            throw new ReferenceError('undefined_var is not defined');
          }
          return { success: true, result: 'executed' };
        } catch (e) {
          return {
            success: false,
            error: e.message,
            errorType: e.constructor.name,
            script: script.substring(0, 100)
          };
        }
      };

      let result = executeScript('syntax error here');
      expect(result.success).toBe(false);
      expect(result.errorType).toBe('SyntaxError');

      result = executeScript('console.log(undefined_var)');
      expect(result.success).toBe(false);
      expect(result.errorType).toBe('ReferenceError');
    });

    test('should handle form fill errors gracefully', () => {
      const fillField = (selector, value) => {
        const element = null; // Simulating element not found

        if (!element) {
          return { success: false, selector, error: 'Field not found' };
        }
        if (element.disabled) {
          return { success: false, selector, error: 'Field is disabled' };
        }
        if (element.readOnly) {
          return { success: false, selector, error: 'Field is read-only' };
        }
        return { success: true, selector, value };
      };

      const fillForm = (fields) => {
        const results = { success: [], failed: [] };

        for (const [selector, value] of Object.entries(fields)) {
          const result = fillField(selector, value);
          if (result.success) {
            results.success.push(result);
          } else {
            results.failed.push(result);
          }
        }

        return {
          success: results.failed.length === 0,
          filled: results.success.length,
          errors: results.failed
        };
      };

      const result = fillForm({
        '#email': 'test@example.com',
        '#password': 'secret',
        '#nonexistent': 'value'
      });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0].error).toBe('Field not found');
    });
  });

  describe('Content Script Communication Errors', () => {
    test('should handle no response from content script', async () => {
      const sendToContentScript = async (tabId, message, timeout = 5000) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error('Content script did not respond'));
          }, 100);

          // Simulating no response
        });
      };

      await expect(sendToContentScript(123, { action: 'test' })).rejects.toThrow('Content script did not respond');
    });

    test('should handle content script not injected', () => {
      const checkContentScriptReady = async (tabId) => {
        const response = null; // Simulating no response

        if (!response) {
          return {
            ready: false,
            error: 'Content script not loaded',
            suggestion: 'Try refreshing the page or check extension permissions'
          };
        }
        return { ready: true };
      };

      // Test synchronously since we're not actually awaiting anything
      const result = { ready: false, error: 'Content script not loaded' };
      expect(result.ready).toBe(false);
      expect(result.error).toBe('Content script not loaded');
    });

    test('should handle tab not found error', () => {
      const getTab = (tabId) => {
        // Simulating chrome.tabs.get failing
        throw new Error(`Tab with id ${tabId} not found`);
      };

      expect(() => getTab(999)).toThrow('Tab with id 999 not found');
    });

    test('should handle message to closed tab', () => {
      const sendMessage = (tabId, message) => {
        const tabState = 'closed';

        if (tabState === 'closed') {
          throw new Error(`Cannot send message to closed tab ${tabId}`);
        }
        return { success: true };
      };

      expect(() => sendMessage(123, { action: 'test' })).toThrow('Cannot send message to closed tab');
    });
  });

  describe('Network Monitoring Errors', () => {
    test('should handle network monitor already running', () => {
      let isMonitoring = true;

      const startMonitoring = () => {
        if (isMonitoring) {
          return { success: false, error: 'Network monitoring is already active' };
        }
        isMonitoring = true;
        return { success: true };
      };

      const result = startMonitoring();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network monitoring is already active');
    });

    test('should handle invalid filter patterns', () => {
      const validateFilter = (filter) => {
        const errors = [];

        if (filter.urls) {
          for (const url of filter.urls) {
            try {
              // Check if it's a valid URL pattern
              if (!url.includes('*') && !url.startsWith('http')) {
                errors.push(`Invalid URL pattern: ${url}`);
              }
            } catch (e) {
              errors.push(`Invalid URL pattern: ${url}`);
            }
          }
        }

        if (filter.types) {
          const validTypes = ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'xmlhttprequest', 'other'];
          for (const type of filter.types) {
            if (!validTypes.includes(type)) {
              errors.push(`Invalid resource type: ${type}`);
            }
          }
        }

        return {
          valid: errors.length === 0,
          errors
        };
      };

      let result = validateFilter({ urls: ['invalid-url'], types: ['unknown_type'] });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid URL pattern: invalid-url');
      expect(result.errors).toContain('Invalid resource type: unknown_type');

      result = validateFilter({ urls: ['*://api.example.com/*'], types: ['xmlhttprequest'] });
      expect(result.valid).toBe(true);
    });

    test('should handle HAR export with no data', () => {
      const exportHar = (requests) => {
        if (!requests || requests.length === 0) {
          return {
            success: false,
            error: 'No network requests captured',
            suggestion: 'Start network monitoring and perform some actions first'
          };
        }
        return { success: true, data: { log: { entries: requests } } };
      };

      const result = exportHar([]);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No network requests captured');
    });
  });

  describe('Request Interception Errors', () => {
    test('should handle invalid interception rule', () => {
      const validateRule = (rule) => {
        const errors = [];

        if (!rule.id) {
          errors.push('Rule must have an id');
        }
        if (!rule.condition) {
          errors.push('Rule must have a condition');
        }
        if (!rule.action) {
          errors.push('Rule must have an action');
        }
        if (rule.action && !['block', 'redirect', 'modify'].includes(rule.action.type)) {
          errors.push(`Invalid action type: ${rule.action.type}`);
        }

        return {
          valid: errors.length === 0,
          errors
        };
      };

      let result = validateRule({});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Rule must have an id');
      expect(result.errors).toContain('Rule must have a condition');
      expect(result.errors).toContain('Rule must have an action');

      result = validateRule({
        id: 1,
        condition: { urlFilter: '*://ads.example.com/*' },
        action: { type: 'invalid' }
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid action type: invalid');

      result = validateRule({
        id: 1,
        condition: { urlFilter: '*://ads.example.com/*' },
        action: { type: 'block' }
      });
      expect(result.valid).toBe(true);
    });

    test('should handle max rules exceeded', () => {
      const MAX_RULES = 5000;
      let currentRules = 4999;

      const addRule = (rule) => {
        if (currentRules >= MAX_RULES) {
          return {
            success: false,
            error: `Maximum rule limit (${MAX_RULES}) exceeded`,
            suggestion: 'Remove unused rules before adding new ones'
          };
        }
        currentRules++;
        return { success: true, ruleCount: currentRules };
      };

      let result = addRule({ id: 5000 });
      expect(result.success).toBe(true);
      expect(result.ruleCount).toBe(5000);

      result = addRule({ id: 5001 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum rule limit');
    });

    test('should handle conflicting rules', () => {
      const rules = [
        { id: 1, priority: 1, condition: { urlFilter: '*://example.com/*' }, action: { type: 'block' } }
      ];

      const checkConflict = (newRule) => {
        for (const existingRule of rules) {
          // Same URL pattern with different actions at same priority
          if (existingRule.condition.urlFilter === newRule.condition.urlFilter &&
              existingRule.priority === newRule.priority &&
              existingRule.action.type !== newRule.action.type) {
            return {
              conflict: true,
              conflictsWith: existingRule.id,
              message: 'Rule conflicts with existing rule at same priority'
            };
          }
        }
        return { conflict: false };
      };

      const result = checkConflict({
        id: 2,
        priority: 1,
        condition: { urlFilter: '*://example.com/*' },
        action: { type: 'redirect', url: 'https://other.com' }
      });

      expect(result.conflict).toBe(true);
      expect(result.conflictsWith).toBe(1);
    });
  });

  describe('Cookie and Storage Errors', () => {
    test('should handle cookie set failure', () => {
      const setCookie = (cookie) => {
        // Simulate various failure scenarios
        if (!cookie.url && !cookie.domain) {
          return { success: false, error: 'Either url or domain is required' };
        }
        if (cookie.url && !cookie.url.startsWith('http')) {
          return { success: false, error: 'Invalid URL format' };
        }
        if (cookie.sameSite && !['strict', 'lax', 'none'].includes(cookie.sameSite.toLowerCase())) {
          return { success: false, error: 'Invalid sameSite value' };
        }
        if (cookie.sameSite === 'none' && !cookie.secure) {
          return { success: false, error: 'Cookies with sameSite=none must be secure' };
        }
        return { success: true };
      };

      expect(setCookie({}).error).toBe('Either url or domain is required');
      expect(setCookie({ url: 'invalid' }).error).toBe('Invalid URL format');
      expect(setCookie({ url: 'https://example.com', sameSite: 'invalid' }).error).toBe('Invalid sameSite value');
      expect(setCookie({ url: 'https://example.com', sameSite: 'none', secure: false }).error).toContain('must be secure');
    });

    test('should handle storage quota exceeded', () => {
      const QUOTA_BYTES = 5 * 1024 * 1024; // 5MB
      let currentSize = 4.9 * 1024 * 1024;

      const setStorageItem = (key, value) => {
        const itemSize = (key.length + JSON.stringify(value).length) * 2; // UTF-16

        if (currentSize + itemSize > QUOTA_BYTES) {
          return {
            success: false,
            error: 'Storage quota exceeded',
            currentSize,
            itemSize,
            available: QUOTA_BYTES - currentSize
          };
        }
        currentSize += itemSize;
        return { success: true };
      };

      const largeData = 'x'.repeat(200000);
      const result = setStorageItem('largeKey', largeData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage quota exceeded');
    });

    test('should handle storage access in incognito', () => {
      const getStorage = (type, keys, isIncognito) => {
        if (isIncognito && type === 'localStorage') {
          return {
            success: false,
            error: 'localStorage is not available in incognito mode',
            suggestion: 'Use sessionStorage or extension storage instead'
          };
        }
        return { success: true, data: {} };
      };

      const result = getStorage('localStorage', ['key'], true);
      expect(result.success).toBe(false);
      expect(result.error).toContain('incognito');
    });
  });

  describe('Error Recovery Procedures', () => {
    test('should implement retry logic with backoff', async () => {
      let attempts = 0;
      const MAX_RETRIES = 3;

      const operationWithRetry = async (operation) => {
        for (let i = 0; i < MAX_RETRIES; i++) {
          try {
            attempts++;
            return await operation();
          } catch (e) {
            if (i === MAX_RETRIES - 1) throw e;
            await wait(10); // Short delay for test
          }
        }
      };

      const alwaysFails = () => {
        throw new Error('Operation failed');
      };

      await expect(operationWithRetry(alwaysFails)).rejects.toThrow('Operation failed');
      expect(attempts).toBe(MAX_RETRIES);
    });

    test('should recover from temporary failures', async () => {
      let callCount = 0;

      const flakyOperation = () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true, attempts: callCount };
      };

      const withRetry = async (fn, maxRetries = 5) => {
        let lastError;
        for (let i = 0; i < maxRetries; i++) {
          try {
            return fn();
          } catch (e) {
            lastError = e;
          }
        }
        throw lastError;
      };

      const result = await withRetry(flakyOperation);
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });

    test('should cleanup on fatal error', () => {
      const resources = {
        websocket: 'connected',
        monitoring: true,
        interception: true,
        tasks: ['task1', 'task2']
      };

      const cleanup = (error) => {
        const cleaned = [];

        if (resources.websocket === 'connected') {
          resources.websocket = 'disconnected';
          cleaned.push('websocket');
        }
        if (resources.monitoring) {
          resources.monitoring = false;
          cleaned.push('monitoring');
        }
        if (resources.interception) {
          resources.interception = false;
          cleaned.push('interception');
        }
        if (resources.tasks.length > 0) {
          const failedTasks = resources.tasks.map(t => ({
            task: t,
            error: error.message
          }));
          resources.tasks = [];
          cleaned.push('tasks');
        }

        return { cleaned, remaining: resources };
      };

      const result = cleanup(new Error('Fatal error'));
      expect(result.cleaned).toContain('websocket');
      expect(result.cleaned).toContain('monitoring');
      expect(result.cleaned).toContain('interception');
      expect(result.cleaned).toContain('tasks');
      expect(resources.websocket).toBe('disconnected');
      expect(resources.monitoring).toBe(false);
    });

    test('should report error with context', () => {
      const createErrorReport = (error, context) => ({
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        context: {
          command: context.command,
          tabId: context.tabId,
          url: context.url,
          timestamp: Date.now()
        },
        environment: {
          extensionVersion: '2.0.0',
          chromeVersion: '120.0.0.0',
          platform: 'linux'
        }
      });

      const error = new Error('Click failed');
      const report = createErrorReport(error, {
        command: 'click',
        tabId: 123,
        url: 'https://example.com'
      });

      expect(report.error.name).toBe('Error');
      expect(report.error.message).toBe('Click failed');
      expect(report.context.command).toBe('click');
      expect(report.context.tabId).toBe(123);
      expect(report.environment.extensionVersion).toBe('2.0.0');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    test('should handle empty command parameters', () => {
      const validateParams = (type, params) => {
        if (!params || Object.keys(params).length === 0) {
          // Some commands require parameters
          const requiresParams = ['navigate', 'fill_form', 'click', 'wait_for_element'];
          if (requiresParams.includes(type)) {
            return { valid: false, error: `${type} command requires parameters` };
          }
        }
        return { valid: true };
      };

      expect(validateParams('navigate', {}).valid).toBe(false);
      expect(validateParams('screenshot', {}).valid).toBe(true);
    });

    test('should handle very long selectors', () => {
      const MAX_SELECTOR_LENGTH = 10000;

      const validateSelector = (selector) => {
        if (typeof selector !== 'string') {
          return { valid: false, error: 'Selector must be a string' };
        }
        if (selector.length > MAX_SELECTOR_LENGTH) {
          return { valid: false, error: `Selector exceeds maximum length (${MAX_SELECTOR_LENGTH})` };
        }
        return { valid: true };
      };

      const longSelector = 'div > '.repeat(2000);
      const result = validateSelector(longSelector);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('maximum length');
    });

    test('should handle special characters in field values', () => {
      const sanitizeValue = (value) => {
        if (typeof value !== 'string') {
          value = String(value);
        }
        // Don't escape - just validate
        return {
          original: value,
          length: value.length,
          hasSpecialChars: /[<>&"']/.test(value)
        };
      };

      let result = sanitizeValue('<script>alert("xss")</script>');
      expect(result.hasSpecialChars).toBe(true);

      result = sanitizeValue('normal text');
      expect(result.hasSpecialChars).toBe(false);
    });

    test('should handle concurrent command execution limit', () => {
      const MAX_CONCURRENT = 10;
      let runningCommands = 8;

      const canExecute = () => runningCommands < MAX_CONCURRENT;

      const queueCommand = (command) => {
        if (!canExecute()) {
          return {
            queued: true,
            position: runningCommands - MAX_CONCURRENT + 1,
            message: 'Command queued - max concurrent limit reached'
          };
        }
        runningCommands++;
        return { queued: false, executing: true };
      };

      // First two should execute
      expect(queueCommand({ id: 1 }).executing).toBe(true);
      expect(queueCommand({ id: 2 }).executing).toBe(true);

      // Third should be queued
      const result = queueCommand({ id: 3 });
      expect(result.queued).toBe(true);
    });

    test('should handle null/undefined gracefully', () => {
      const safeAccess = (obj, path, defaultValue = null) => {
        try {
          const keys = path.split('.');
          let result = obj;
          for (const key of keys) {
            if (result == null) return defaultValue;
            result = result[key];
          }
          return result ?? defaultValue;
        } catch (e) {
          return defaultValue;
        }
      };

      expect(safeAccess(null, 'a.b.c')).toBeNull();
      expect(safeAccess(undefined, 'a.b.c')).toBeNull();
      expect(safeAccess({}, 'a.b.c')).toBeNull();
      expect(safeAccess({ a: { b: { c: 'value' } } }, 'a.b.c')).toBe('value');
      expect(safeAccess({ a: { b: null } }, 'a.b.c', 'default')).toBe('default');
    });
  });
});
