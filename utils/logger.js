/**
 * Structured Logging Utility for Basset Hound Chrome Extension
 *
 * Provides consistent logging with:
 * - Log levels (DEBUG, INFO, WARN, ERROR)
 * - Timestamps in ISO format
 * - Context/component tracking
 * - Optional storage persistence
 */

// Log levels with numeric values for comparison
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// Log level names for display
const LogLevelNames = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR'
};

// Console methods mapping
const ConsoleMethods = {
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.INFO]: 'info',
  [LogLevel.WARN]: 'warn',
  [LogLevel.ERROR]: 'error'
};

/**
 * Logger class for structured logging
 */
class Logger {
  /**
   * Create a new Logger instance
   * @param {Object} options - Logger configuration
   * @param {string} options.component - Component name for context tracking
   * @param {number} options.minLevel - Minimum log level to output (default: DEBUG)
   * @param {boolean} options.enableConsole - Whether to output to console (default: true)
   * @param {boolean} options.enableStorage - Whether to persist logs to storage (default: false)
   * @param {number} options.maxStoredLogs - Maximum number of logs to store (default: 1000)
   */
  constructor(options = {}) {
    this.component = options.component || 'Unknown';
    this.minLevel = options.minLevel !== undefined ? options.minLevel : LogLevel.DEBUG;
    this.enableConsole = options.enableConsole !== undefined ? options.enableConsole : true;
    this.enableStorage = options.enableStorage || false;
    this.maxStoredLogs = options.maxStoredLogs || 1000;
    this.context = {};
  }

  /**
   * Set additional context that will be included in all log entries
   * @param {Object} context - Key-value pairs to include in logs
   * @returns {Logger} - Returns this for chaining
   */
  setContext(context) {
    this.context = { ...this.context, ...context };
    return this;
  }

  /**
   * Clear all context
   * @returns {Logger} - Returns this for chaining
   */
  clearContext() {
    this.context = {};
    return this;
  }

  /**
   * Create a child logger with additional context
   * @param {string} subComponent - Sub-component name
   * @param {Object} additionalContext - Additional context for the child logger
   * @returns {Logger} - New logger instance
   */
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

  /**
   * Format a log entry
   * @param {number} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data to include
   * @returns {Object} - Formatted log entry
   */
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

  /**
   * Output a log entry to console
   * @param {number} level - Log level
   * @param {Object} entry - Log entry
   */
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

  /**
   * Persist a log entry to storage
   * @param {Object} entry - Log entry
   */
  async _persistToStorage(entry) {
    if (!this.enableStorage) return;

    try {
      // Get existing logs from storage
      const result = await chrome.storage.local.get('extensionLogs');
      let logs = result.extensionLogs || [];

      // Add new entry
      logs.push(entry);

      // Trim if exceeds max
      if (logs.length > this.maxStoredLogs) {
        logs = logs.slice(-this.maxStoredLogs);
      }

      // Save back to storage
      await chrome.storage.local.set({ extensionLogs: logs });
    } catch (error) {
      // Silently fail storage operations to avoid log loops
      console.error('Failed to persist log to storage:', error);
    }
  }

  /**
   * Internal log method
   * @param {number} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  _log(level, message, data = {}) {
    // Check if level meets minimum threshold
    if (level < this.minLevel) return;

    const entry = this._formatEntry(level, message, data);

    // Output to console
    this._outputToConsole(level, entry);

    // Persist to storage if enabled
    if (this.enableStorage) {
      this._persistToStorage(entry);
    }
  }

  /**
   * Log a debug message
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  debug(message, data = {}) {
    this._log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log an info message
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  info(message, data = {}) {
    this._log(LogLevel.INFO, message, data);
  }

  /**
   * Log a warning message
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  warn(message, data = {}) {
    this._log(LogLevel.WARN, message, data);
  }

  /**
   * Log an error message
   * @param {string} message - Log message
   * @param {Object|Error} data - Additional data or Error object
   */
  error(message, data = {}) {
    // Handle Error objects specially
    if (data instanceof Error) {
      data = {
        errorName: data.name,
        errorMessage: data.message,
        errorStack: data.stack
      };
    }
    this._log(LogLevel.ERROR, message, data);
  }

  /**
   * Get all stored logs (if storage persistence is enabled)
   * @returns {Promise<Array>} - Array of log entries
   */
  async getStoredLogs() {
    try {
      const result = await chrome.storage.local.get('extensionLogs');
      return result.extensionLogs || [];
    } catch (error) {
      console.error('Failed to retrieve stored logs:', error);
      return [];
    }
  }

  /**
   * Clear all stored logs
   * @returns {Promise<void>}
   */
  async clearStoredLogs() {
    try {
      await chrome.storage.local.remove('extensionLogs');
    } catch (error) {
      console.error('Failed to clear stored logs:', error);
    }
  }

  /**
   * Export logs as JSON string
   * @returns {Promise<string>} - JSON string of all logs
   */
  async exportLogs() {
    const logs = await this.getStoredLogs();
    return JSON.stringify(logs, null, 2);
  }
}

// Export for use in other modules
// In Chrome extensions, we'll attach to globalThis for module-less scripts
if (typeof globalThis !== 'undefined') {
  globalThis.Logger = Logger;
  globalThis.LogLevel = LogLevel;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Logger, LogLevel };
}
