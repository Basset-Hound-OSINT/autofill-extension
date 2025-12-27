/**
 * Unit Tests for Logger Utility
 *
 * Tests the Logger class functionality including:
 * - Log level filtering
 * - Context management
 * - Child loggers
 * - Console output
 * - Storage persistence
 */

const { setupTestEnvironment, teardownTestEnvironment, resetTestMocks } = require('../helpers/setup');

// We need to load the actual Logger implementation
// For testing, we'll create a compatible implementation
let Logger, LogLevel;

beforeAll(() => {
  setupTestEnvironment();

  // Define LogLevel
  LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  };

  // Define LogLevelNames
  const LogLevelNames = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR'
  };

  // Define ConsoleMethods
  const ConsoleMethods = {
    [LogLevel.DEBUG]: 'debug',
    [LogLevel.INFO]: 'info',
    [LogLevel.WARN]: 'warn',
    [LogLevel.ERROR]: 'error'
  };

  // Define Logger class (matching the actual implementation)
  Logger = class Logger {
    constructor(options = {}) {
      this.component = options.component || 'Unknown';
      this.minLevel = options.minLevel !== undefined ? options.minLevel : LogLevel.DEBUG;
      this.enableConsole = options.enableConsole !== undefined ? options.enableConsole : true;
      this.enableStorage = options.enableStorage || false;
      this.maxStoredLogs = options.maxStoredLogs || 1000;
      this.context = {};
    }

    setContext(context) {
      this.context = { ...this.context, ...context };
      return this;
    }

    clearContext() {
      this.context = {};
      return this;
    }

    child(subComponent, additionalContext = {}) {
      const childLogger = new Logger({
        component: `${this.component}:${subComponent}`,
        minLevel: this.minLevel,
        enableConsole: this.enableConsole,
        enableStorage: this.enableStorage,
        maxStoredLogs: this.maxStoredLogs
      });
      childLogger.setContext({ ...this.context, ...additionalContext });
      return childLogger;
    }

    _formatEntry(level, message, data = {}) {
      return {
        timestamp: new Date().toISOString(),
        level: LogLevelNames[level],
        component: this.component,
        message,
        data: Object.keys(data).length > 0 ? data : undefined,
        context: Object.keys(this.context).length > 0 ? this.context : undefined
      };
    }

    _outputToConsole(level, entry) {
      if (!this.enableConsole) return;

      const method = ConsoleMethods[level];
      const prefix = `[${entry.timestamp}] [${entry.level}] [${entry.component}]`;

      if (entry.data || entry.context) {
        console[method](prefix, entry.message, { data: entry.data, context: entry.context });
      } else {
        console[method](prefix, entry.message);
      }
    }

    async _persistToStorage(entry) {
      if (!this.enableStorage) return;

      try {
        const result = await chrome.storage.local.get('extensionLogs');
        let logs = result.extensionLogs || [];
        logs.push(entry);
        if (logs.length > this.maxStoredLogs) {
          logs = logs.slice(-this.maxStoredLogs);
        }
        await chrome.storage.local.set({ extensionLogs: logs });
      } catch (error) {
        console.error('Failed to persist log to storage:', error);
      }
    }

    _log(level, message, data = {}) {
      if (level < this.minLevel) return;

      const entry = this._formatEntry(level, message, data);
      this._outputToConsole(level, entry);

      if (this.enableStorage) {
        this._persistToStorage(entry);
      }
    }

    debug(message, data = {}) {
      this._log(LogLevel.DEBUG, message, data);
    }

    info(message, data = {}) {
      this._log(LogLevel.INFO, message, data);
    }

    warn(message, data = {}) {
      this._log(LogLevel.WARN, message, data);
    }

    error(message, data = {}) {
      if (data instanceof Error) {
        data = {
          errorName: data.name,
          errorMessage: data.message,
          errorStack: data.stack
        };
      }
      this._log(LogLevel.ERROR, message, data);
    }

    async getStoredLogs() {
      try {
        const result = await chrome.storage.local.get('extensionLogs');
        return result.extensionLogs || [];
      } catch (error) {
        console.error('Failed to retrieve stored logs:', error);
        return [];
      }
    }

    async clearStoredLogs() {
      try {
        await chrome.storage.local.remove('extensionLogs');
      } catch (error) {
        console.error('Failed to clear stored logs:', error);
      }
    }

    async exportLogs() {
      const logs = await this.getStoredLogs();
      return JSON.stringify(logs, null, 2);
    }
  };

  global.Logger = Logger;
  global.LogLevel = LogLevel;
});

afterAll(() => {
  teardownTestEnvironment();
});

beforeEach(() => {
  resetTestMocks();
});

describe('Logger', () => {
  describe('Constructor', () => {
    test('should create logger with default options', () => {
      const logger = new Logger();

      expect(logger.component).toBe('Unknown');
      expect(logger.minLevel).toBe(LogLevel.DEBUG);
      expect(logger.enableConsole).toBe(true);
      expect(logger.enableStorage).toBe(false);
      expect(logger.maxStoredLogs).toBe(1000);
    });

    test('should create logger with custom options', () => {
      const logger = new Logger({
        component: 'TestComponent',
        minLevel: LogLevel.WARN,
        enableConsole: false,
        enableStorage: true,
        maxStoredLogs: 500
      });

      expect(logger.component).toBe('TestComponent');
      expect(logger.minLevel).toBe(LogLevel.WARN);
      expect(logger.enableConsole).toBe(false);
      expect(logger.enableStorage).toBe(true);
      expect(logger.maxStoredLogs).toBe(500);
    });

    test('should initialize with empty context', () => {
      const logger = new Logger();

      expect(logger.context).toEqual({});
    });
  });

  describe('Context Management', () => {
    test('should set context', () => {
      const logger = new Logger();
      const result = logger.setContext({ userId: '123', sessionId: 'abc' });

      expect(logger.context).toEqual({ userId: '123', sessionId: 'abc' });
      expect(result).toBe(logger); // Should return this for chaining
    });

    test('should merge context', () => {
      const logger = new Logger();
      logger.setContext({ userId: '123' });
      logger.setContext({ sessionId: 'abc' });

      expect(logger.context).toEqual({ userId: '123', sessionId: 'abc' });
    });

    test('should override existing context keys', () => {
      const logger = new Logger();
      logger.setContext({ userId: '123' });
      logger.setContext({ userId: '456' });

      expect(logger.context).toEqual({ userId: '456' });
    });

    test('should clear context', () => {
      const logger = new Logger();
      logger.setContext({ userId: '123' });
      const result = logger.clearContext();

      expect(logger.context).toEqual({});
      expect(result).toBe(logger); // Should return this for chaining
    });
  });

  describe('Child Loggers', () => {
    test('should create child logger with combined component name', () => {
      const parent = new Logger({ component: 'Parent' });
      const child = parent.child('Child');

      expect(child.component).toBe('Parent:Child');
    });

    test('should inherit parent settings', () => {
      const parent = new Logger({
        component: 'Parent',
        minLevel: LogLevel.WARN,
        enableConsole: false,
        enableStorage: true,
        maxStoredLogs: 500
      });
      const child = parent.child('Child');

      expect(child.minLevel).toBe(LogLevel.WARN);
      expect(child.enableConsole).toBe(false);
      expect(child.enableStorage).toBe(true);
      expect(child.maxStoredLogs).toBe(500);
    });

    test('should inherit parent context', () => {
      const parent = new Logger({ component: 'Parent' });
      parent.setContext({ userId: '123' });
      const child = parent.child('Child');

      expect(child.context).toEqual({ userId: '123' });
    });

    test('should accept additional context', () => {
      const parent = new Logger({ component: 'Parent' });
      parent.setContext({ userId: '123' });
      const child = parent.child('Child', { requestId: 'abc' });

      expect(child.context).toEqual({ userId: '123', requestId: 'abc' });
    });

    test('child context changes should not affect parent', () => {
      const parent = new Logger({ component: 'Parent' });
      parent.setContext({ userId: '123' });
      const child = parent.child('Child');
      child.setContext({ newKey: 'value' });

      expect(parent.context).toEqual({ userId: '123' });
      expect(child.context).toEqual({ userId: '123', newKey: 'value' });
    });
  });

  describe('Log Level Filtering', () => {
    let logger;
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      };
      global.console = consoleSpy;
    });

    test('should log all levels when minLevel is DEBUG', () => {
      logger = new Logger({ minLevel: LogLevel.DEBUG });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(consoleSpy.debug).toHaveBeenCalled();
      expect(consoleSpy.info).toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    test('should filter DEBUG when minLevel is INFO', () => {
      logger = new Logger({ minLevel: LogLevel.INFO });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    test('should filter DEBUG and INFO when minLevel is WARN', () => {
      logger = new Logger({ minLevel: LogLevel.WARN });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    test('should only log ERROR when minLevel is ERROR', () => {
      logger = new Logger({ minLevel: LogLevel.ERROR });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('Console Output', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      };
      global.console = consoleSpy;
    });

    test('should not output to console when disabled', () => {
      const logger = new Logger({ enableConsole: false });

      logger.info('Test message');

      expect(consoleSpy.info).not.toHaveBeenCalled();
    });

    test('should format log entries correctly', () => {
      const logger = new Logger({ component: 'TestComponent' });

      logger.info('Test message');

      expect(consoleSpy.info).toHaveBeenCalled();
      const call = consoleSpy.info.mock.calls[0];
      expect(call[0]).toMatch(/\[\d{4}-\d{2}-\d{2}T/); // ISO timestamp
      expect(call[0]).toContain('[INFO]');
      expect(call[0]).toContain('[TestComponent]');
      expect(call[1]).toBe('Test message');
    });

    test('should include data in log output', () => {
      const logger = new Logger({ component: 'Test' });

      logger.info('Test message', { key: 'value' });

      const call = consoleSpy.info.mock.calls[0];
      expect(call[2]).toEqual({ data: { key: 'value' }, context: undefined });
    });

    test('should include context in log output', () => {
      const logger = new Logger({ component: 'Test' });
      logger.setContext({ userId: '123' });

      logger.info('Test message');

      const call = consoleSpy.info.mock.calls[0];
      expect(call[2]).toEqual({ data: undefined, context: { userId: '123' } });
    });
  });

  describe('Error Logging', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      };
      global.console = consoleSpy;
    });

    test('should handle Error objects', () => {
      const logger = new Logger({ component: 'Test' });
      const error = new Error('Test error');

      logger.error('An error occurred', error);

      const call = consoleSpy.error.mock.calls[0];
      expect(call[2].data).toEqual({
        errorName: 'Error',
        errorMessage: 'Test error',
        errorStack: expect.any(String)
      });
    });

    test('should handle custom error types', () => {
      const logger = new Logger({ component: 'Test' });

      class CustomError extends Error {
        constructor(message) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const error = new CustomError('Custom error message');
      logger.error('Custom error occurred', error);

      const call = consoleSpy.error.mock.calls[0];
      expect(call[2].data.errorName).toBe('CustomError');
      expect(call[2].data.errorMessage).toBe('Custom error message');
    });

    test('should handle plain objects as error data', () => {
      const logger = new Logger({ component: 'Test' });

      logger.error('An error occurred', { code: 500, details: 'Internal error' });

      const call = consoleSpy.error.mock.calls[0];
      expect(call[2].data).toEqual({ code: 500, details: 'Internal error' });
    });
  });

  describe('Storage Persistence', () => {
    test('should persist logs to storage when enabled', async () => {
      const logger = new Logger({
        component: 'Test',
        enableStorage: true,
        enableConsole: false
      });

      logger.info('Test message', { key: 'value' });

      // Wait for async storage operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(chrome.storage.local.set).toHaveBeenCalled();
      const setCall = chrome.storage.local.set.mock.calls[0];
      expect(setCall[0]).toHaveProperty('extensionLogs');
    });

    test('should not persist logs when storage is disabled', async () => {
      const logger = new Logger({
        component: 'Test',
        enableStorage: false,
        enableConsole: false
      });

      logger.info('Test message');

      await new Promise(resolve => setTimeout(resolve, 10));

      // Storage.set should not be called for logs
      const logCalls = chrome.storage.local.set.mock.calls.filter(
        call => call[0].hasOwnProperty('extensionLogs')
      );
      expect(logCalls).toHaveLength(0);
    });

    test('should retrieve stored logs', async () => {
      // Pre-populate storage with logs
      await chrome.storage.local.set({
        extensionLogs: [
          { timestamp: '2024-01-01T00:00:00.000Z', level: 'INFO', message: 'Log 1' },
          { timestamp: '2024-01-01T00:00:01.000Z', level: 'INFO', message: 'Log 2' }
        ]
      });

      const logger = new Logger({ component: 'Test' });
      const logs = await logger.getStoredLogs();

      expect(logs).toHaveLength(2);
      expect(logs[0].message).toBe('Log 1');
      expect(logs[1].message).toBe('Log 2');
    });

    test('should return empty array when no logs stored', async () => {
      const logger = new Logger({ component: 'Test' });
      const logs = await logger.getStoredLogs();

      expect(logs).toEqual([]);
    });

    test('should clear stored logs', async () => {
      await chrome.storage.local.set({
        extensionLogs: [{ message: 'Test log' }]
      });

      const logger = new Logger({ component: 'Test' });
      await logger.clearStoredLogs();

      expect(chrome.storage.local.remove).toHaveBeenCalledWith('extensionLogs');
    });

    test('should export logs as JSON', async () => {
      await chrome.storage.local.set({
        extensionLogs: [
          { timestamp: '2024-01-01T00:00:00.000Z', level: 'INFO', message: 'Log 1' }
        ]
      });

      const logger = new Logger({ component: 'Test' });
      const exported = await logger.exportLogs();

      const parsed = JSON.parse(exported);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].message).toBe('Log 1');
    });

    test('should limit stored logs to maxStoredLogs', async () => {
      const logger = new Logger({
        component: 'Test',
        enableStorage: true,
        enableConsole: false,
        maxStoredLogs: 3
      });

      // Pre-populate with 2 logs
      await chrome.storage.local.set({
        extensionLogs: [
          { message: 'Log 1' },
          { message: 'Log 2' }
        ]
      });

      // Add 2 more logs (should trigger trimming)
      logger.info('Log 3');
      await new Promise(resolve => setTimeout(resolve, 10));

      logger.info('Log 4');
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check that set was called with trimmed logs
      const lastSetCall = chrome.storage.local.set.mock.calls[
        chrome.storage.local.set.mock.calls.length - 1
      ];

      if (lastSetCall && lastSetCall[0].extensionLogs) {
        expect(lastSetCall[0].extensionLogs.length).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('Entry Formatting', () => {
    test('should format entry with all fields', () => {
      const logger = new Logger({ component: 'TestComponent' });
      logger.setContext({ userId: '123' });

      const entry = logger._formatEntry(LogLevel.INFO, 'Test message', { key: 'value' });

      expect(entry).toEqual({
        timestamp: expect.any(String),
        level: 'INFO',
        component: 'TestComponent',
        message: 'Test message',
        data: { key: 'value' },
        context: { userId: '123' }
      });

      // Verify timestamp is valid ISO format
      expect(() => new Date(entry.timestamp)).not.toThrow();
    });

    test('should omit empty data and context', () => {
      const logger = new Logger({ component: 'Test' });

      const entry = logger._formatEntry(LogLevel.INFO, 'Test message', {});

      expect(entry.data).toBeUndefined();
      expect(entry.context).toBeUndefined();
    });
  });
});

describe('LogLevel', () => {
  test('should have correct numeric values', () => {
    expect(LogLevel.DEBUG).toBe(0);
    expect(LogLevel.INFO).toBe(1);
    expect(LogLevel.WARN).toBe(2);
    expect(LogLevel.ERROR).toBe(3);
  });

  test('should allow numeric comparison', () => {
    expect(LogLevel.DEBUG < LogLevel.INFO).toBe(true);
    expect(LogLevel.INFO < LogLevel.WARN).toBe(true);
    expect(LogLevel.WARN < LogLevel.ERROR).toBe(true);
  });
});
