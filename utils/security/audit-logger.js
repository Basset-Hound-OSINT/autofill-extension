/**
 * Basset Hound Browser Automation - Audit Logger
 * Phase 7.2 Privacy Controls: Audit Logging System
 *
 * Provides comprehensive audit logging for security and compliance:
 * - Command execution logging
 * - WebSocket connection events
 * - Navigation tracking
 * - Form interactions
 * - Data extraction events
 * - Authentication attempts
 * - Error logging
 */

// =============================================================================
// Configuration
// =============================================================================

const AuditLoggerConfig = {
  // Log levels in order of severity
  logLevels: {
    debug: 0,
    info: 1,
    warning: 2,
    error: 3,
    critical: 4
  },

  // Action types that can be logged
  actionTypes: [
    'command_executed',
    'websocket_connected',
    'websocket_disconnected',
    'navigation',
    'form_filled',
    'data_extracted',
    'auth_attempt',
    'error',
    'security_violation',
    'privacy_action',
    'storage_access',
    'network_request'
  ],

  // Default settings
  defaults: {
    minLogLevel: 'info',
    maxLogEntries: 10000,
    persistenceEnabled: true,
    storageKey: 'audit_log',
    autoCleanupDays: 30
  },

  // Fields to redact from logs for privacy
  sensitiveFields: [
    'password',
    'token',
    'apiKey',
    'api_key',
    'secret',
    'auth',
    'credential',
    'ssn',
    'credit_card',
    'creditCard'
  ]
};

// =============================================================================
// AuditLogger Class
// =============================================================================

/**
 * AuditLogger - Comprehensive audit logging for the browser automation extension
 * Tracks all significant actions for security monitoring and compliance
 */
class AuditLogger {
  /**
   * Create an AuditLogger instance
   * @param {Object} options - Configuration options
   * @param {string} options.minLogLevel - Minimum log level to record
   * @param {number} options.maxLogEntries - Maximum entries to keep in memory
   * @param {boolean} options.persistenceEnabled - Enable chrome.storage persistence
   * @param {string} options.storageKey - Storage key for persisted logs
   */
  constructor(options = {}) {
    this.minLogLevel = options.minLogLevel || AuditLoggerConfig.defaults.minLogLevel;
    this.maxLogEntries = options.maxLogEntries || AuditLoggerConfig.defaults.maxLogEntries;
    this.persistenceEnabled = options.persistenceEnabled !== undefined
      ? options.persistenceEnabled
      : AuditLoggerConfig.defaults.persistenceEnabled;
    this.storageKey = options.storageKey || AuditLoggerConfig.defaults.storageKey;

    // In-memory log storage
    this.logs = [];

    // Statistics tracking
    this.stats = {
      totalLogged: 0,
      byLevel: { debug: 0, info: 0, warning: 0, error: 0, critical: 0 },
      byAction: {},
      sessionStart: Date.now(),
      lastLogTime: null
    };

    // Load persisted logs on initialization
    if (this.persistenceEnabled) {
      this._loadPersistedLogs();
    }
  }

  // ===========================================================================
  // Core Logging Methods
  // ===========================================================================

  /**
   * Log an action with timestamp and level
   * @param {string} action - Action type from actionTypes list
   * @param {Object} details - Details about the action
   * @param {string} level - Log level (debug, info, warning, error, critical)
   * @returns {Object} The created log entry
   */
  log(action, details = {}, level = 'info') {
    // Validate action type
    if (!AuditLoggerConfig.actionTypes.includes(action)) {
      console.warn(`AuditLogger: Unknown action type: ${action}`);
    }

    // Validate and normalize level
    const normalizedLevel = this._normalizeLevel(level);

    // Check if this level should be logged
    if (!this._shouldLog(normalizedLevel)) {
      return null;
    }

    // Create log entry
    const entry = {
      id: this._generateLogId(),
      timestamp: Date.now(),
      isoTimestamp: new Date().toISOString(),
      action,
      level: normalizedLevel,
      details: this._sanitizeDetails(details),
      sessionId: this._getSessionId(),
      source: 'extension'
    };

    // Add to in-memory logs
    this.logs.push(entry);

    // Update statistics
    this._updateStats(entry);

    // Trim if exceeds max entries
    this._trimLogs();

    // Persist if enabled
    if (this.persistenceEnabled) {
      this._persistLogs();
    }

    return entry;
  }

  /**
   * Log a command execution
   * @param {string} commandType - Type of command executed
   * @param {Object} params - Command parameters (sanitized)
   * @param {boolean} success - Whether command succeeded
   * @param {string} error - Error message if failed
   * @returns {Object} Log entry
   */
  logCommand(commandType, params = {}, success = true, error = null) {
    return this.log('command_executed', {
      commandType,
      params: this._sanitizeDetails(params),
      success,
      error,
      executedAt: Date.now()
    }, success ? 'info' : 'error');
  }

  /**
   * Log a WebSocket connection event
   * @param {string} eventType - 'connected' or 'disconnected'
   * @param {Object} details - Connection details
   * @returns {Object} Log entry
   */
  logWebSocket(eventType, details = {}) {
    const action = eventType === 'connected'
      ? 'websocket_connected'
      : 'websocket_disconnected';

    return this.log(action, {
      eventType,
      ...details,
      connectionTime: Date.now()
    }, 'info');
  }

  /**
   * Log a navigation event
   * @param {string} url - URL navigated to
   * @param {Object} details - Navigation details
   * @returns {Object} Log entry
   */
  logNavigation(url, details = {}) {
    return this.log('navigation', {
      url: this._sanitizeUrl(url),
      ...details,
      navigatedAt: Date.now()
    }, 'info');
  }

  /**
   * Log a form fill event
   * @param {Object} formInfo - Form information
   * @param {number} fieldCount - Number of fields filled
   * @param {boolean} submitted - Whether form was submitted
   * @returns {Object} Log entry
   */
  logFormFill(formInfo = {}, fieldCount = 0, submitted = false) {
    return this.log('form_filled', {
      formInfo: this._sanitizeDetails(formInfo),
      fieldCount,
      submitted,
      filledAt: Date.now()
    }, 'info');
  }

  /**
   * Log a data extraction event
   * @param {string} extractionType - Type of extraction (content, cookies, storage, etc.)
   * @param {Object} details - Extraction details
   * @returns {Object} Log entry
   */
  logDataExtraction(extractionType, details = {}) {
    return this.log('data_extracted', {
      extractionType,
      ...this._sanitizeDetails(details),
      extractedAt: Date.now()
    }, 'info');
  }

  /**
   * Log an authentication attempt
   * @param {string} authType - Type of authentication
   * @param {boolean} success - Whether auth succeeded
   * @param {Object} details - Auth details (sanitized)
   * @returns {Object} Log entry
   */
  logAuthAttempt(authType, success, details = {}) {
    return this.log('auth_attempt', {
      authType,
      success,
      ...this._sanitizeDetails(details),
      attemptedAt: Date.now()
    }, success ? 'info' : 'warning');
  }

  /**
   * Log an error
   * @param {string} errorType - Type of error
   * @param {string} message - Error message
   * @param {Object} details - Error details
   * @returns {Object} Log entry
   */
  logError(errorType, message, details = {}) {
    return this.log('error', {
      errorType,
      message,
      ...this._sanitizeDetails(details),
      occurredAt: Date.now()
    }, 'error');
  }

  /**
   * Log a security violation
   * @param {string} violationType - Type of violation
   * @param {Object} details - Violation details
   * @returns {Object} Log entry
   */
  logSecurityViolation(violationType, details = {}) {
    return this.log('security_violation', {
      violationType,
      ...this._sanitizeDetails(details),
      detectedAt: Date.now()
    }, 'critical');
  }

  // ===========================================================================
  // Log Retrieval Methods
  // ===========================================================================

  /**
   * Get audit logs with filtering options
   * @param {Object} options - Filtering options
   * @param {number} options.since - Only return logs after this timestamp
   * @param {number} options.until - Only return logs before this timestamp
   * @param {string} options.action - Filter by action type
   * @param {string|Array<string>} options.level - Filter by log level(s)
   * @param {number} options.limit - Maximum number of logs to return
   * @param {number} options.offset - Number of logs to skip
   * @param {string} options.sortOrder - 'asc' or 'desc' (default: 'desc')
   * @returns {Object} Filtered logs with metadata
   */
  getAuditLog(options = {}) {
    const {
      since = 0,
      until = Date.now(),
      action = null,
      level = null,
      limit = 100,
      offset = 0,
      sortOrder = 'desc'
    } = options;

    let filteredLogs = [...this.logs];

    // Filter by timestamp range
    filteredLogs = filteredLogs.filter(log =>
      log.timestamp >= since && log.timestamp <= until
    );

    // Filter by action type
    if (action) {
      filteredLogs = filteredLogs.filter(log => log.action === action);
    }

    // Filter by level(s)
    if (level) {
      const levels = Array.isArray(level) ? level : [level];
      filteredLogs = filteredLogs.filter(log => levels.includes(log.level));
    }

    // Sort
    filteredLogs.sort((a, b) => {
      return sortOrder === 'desc'
        ? b.timestamp - a.timestamp
        : a.timestamp - b.timestamp;
    });

    // Get total count before pagination
    const totalCount = filteredLogs.length;

    // Apply pagination
    filteredLogs = filteredLogs.slice(offset, offset + limit);

    return {
      success: true,
      logs: filteredLogs,
      pagination: {
        total: totalCount,
        offset,
        limit,
        returned: filteredLogs.length,
        hasMore: offset + filteredLogs.length < totalCount
      },
      filters: {
        since,
        until,
        action,
        level,
        sortOrder
      },
      timestamp: Date.now()
    };
  }

  /**
   * Get logs by specific action type
   * @param {string} action - Action type
   * @param {Object} options - Additional filter options
   * @returns {Object} Filtered logs
   */
  getLogsByAction(action, options = {}) {
    return this.getAuditLog({ ...options, action });
  }

  /**
   * Get logs by level
   * @param {string|Array<string>} level - Log level(s)
   * @param {Object} options - Additional filter options
   * @returns {Object} Filtered logs
   */
  getLogsByLevel(level, options = {}) {
    return this.getAuditLog({ ...options, level });
  }

  /**
   * Get recent logs
   * @param {number} count - Number of logs to return
   * @returns {Object} Recent logs
   */
  getRecentLogs(count = 50) {
    return this.getAuditLog({ limit: count, sortOrder: 'desc' });
  }

  /**
   * Get error logs
   * @param {Object} options - Filter options
   * @returns {Object} Error logs
   */
  getErrorLogs(options = {}) {
    return this.getAuditLog({ ...options, level: ['error', 'critical'] });
  }

  // ===========================================================================
  // Log Management Methods
  // ===========================================================================

  /**
   * Clear old audit logs
   * @param {number|string} olderThan - Timestamp or duration string ('1h', '1d', '7d', '30d')
   * @returns {Object} Clear result
   */
  clearAuditLog(olderThan = 0) {
    let cutoffTimestamp;

    if (typeof olderThan === 'string') {
      cutoffTimestamp = this._parseDuration(olderThan);
    } else if (typeof olderThan === 'number') {
      cutoffTimestamp = olderThan;
    } else {
      cutoffTimestamp = 0;
    }

    const originalCount = this.logs.length;

    if (cutoffTimestamp === 0) {
      // Clear all logs
      this.logs = [];
    } else {
      // Clear logs older than cutoff
      this.logs = this.logs.filter(log => log.timestamp >= cutoffTimestamp);
    }

    const clearedCount = originalCount - this.logs.length;

    // Persist changes
    if (this.persistenceEnabled) {
      this._persistLogs();
    }

    // Log the clear action itself
    this.log('privacy_action', {
      action: 'clear_audit_log',
      cutoffTimestamp,
      clearedCount,
      remainingCount: this.logs.length
    }, 'info');

    return {
      success: true,
      clearedCount,
      remainingCount: this.logs.length,
      cutoffTimestamp,
      timestamp: Date.now()
    };
  }

  /**
   * Export audit logs in specified format
   * @param {string} format - 'json' or 'csv'
   * @param {Object} options - Export options (same as getAuditLog)
   * @returns {Object} Export result with data
   */
  exportAuditLog(format = 'json', options = {}) {
    const result = this.getAuditLog({ ...options, limit: Infinity });
    const logs = result.logs;

    let exportedData;
    let mimeType;
    let filename;

    if (format === 'csv') {
      exportedData = this._logsToCSV(logs);
      mimeType = 'text/csv';
      filename = `audit_log_${Date.now()}.csv`;
    } else {
      exportedData = JSON.stringify(logs, null, 2);
      mimeType = 'application/json';
      filename = `audit_log_${Date.now()}.json`;
    }

    return {
      success: true,
      format,
      data: exportedData,
      mimeType,
      filename,
      logCount: logs.length,
      exportedAt: Date.now(),
      timestamp: Date.now()
    };
  }

  // ===========================================================================
  // Configuration Methods
  // ===========================================================================

  /**
   * Set the minimum log level
   * @param {string} level - Minimum level to log
   * @returns {Object} Updated configuration
   */
  setLogLevel(level) {
    const normalizedLevel = this._normalizeLevel(level);

    if (!AuditLoggerConfig.logLevels.hasOwnProperty(normalizedLevel)) {
      return {
        success: false,
        error: `Invalid log level: ${level}`,
        validLevels: Object.keys(AuditLoggerConfig.logLevels),
        timestamp: Date.now()
      };
    }

    const previousLevel = this.minLogLevel;
    this.minLogLevel = normalizedLevel;

    this.log('privacy_action', {
      action: 'set_log_level',
      previousLevel,
      newLevel: normalizedLevel
    }, 'info');

    return {
      success: true,
      previousLevel,
      newLevel: normalizedLevel,
      timestamp: Date.now()
    };
  }

  /**
   * Enable or disable chrome.storage persistence
   * @param {boolean} enabled - Whether to enable persistence
   * @returns {Object} Updated configuration
   */
  enablePersistence(enabled) {
    const previousState = this.persistenceEnabled;
    this.persistenceEnabled = enabled;

    if (enabled && !previousState) {
      // Persist current logs when enabling
      this._persistLogs();
    }

    this.log('privacy_action', {
      action: 'set_persistence',
      previousState,
      newState: enabled
    }, 'info');

    return {
      success: true,
      previousState,
      enabled,
      timestamp: Date.now()
    };
  }

  /**
   * Get current audit logger statistics
   * @returns {Object} Logger statistics
   */
  getStats() {
    return {
      success: true,
      stats: {
        ...this.stats,
        currentLogCount: this.logs.length,
        maxLogEntries: this.maxLogEntries,
        minLogLevel: this.minLogLevel,
        persistenceEnabled: this.persistenceEnabled,
        memoryUsageEstimate: this._estimateMemoryUsage()
      },
      timestamp: Date.now()
    };
  }

  /**
   * Get available action types
   * @returns {Array<string>} Action types
   */
  getActionTypes() {
    return [...AuditLoggerConfig.actionTypes];
  }

  /**
   * Get available log levels
   * @returns {Object} Log levels with their numeric values
   */
  getLogLevels() {
    return { ...AuditLoggerConfig.logLevels };
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Generate a unique log ID
   * @private
   * @returns {string} Unique log ID
   */
  _generateLogId() {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get or create session ID
   * @private
   * @returns {string} Session ID
   */
  _getSessionId() {
    if (!this._sessionId) {
      this._sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }
    return this._sessionId;
  }

  /**
   * Normalize log level string
   * @private
   * @param {string} level - Level string
   * @returns {string} Normalized level
   */
  _normalizeLevel(level) {
    const normalized = String(level).toLowerCase().trim();
    return AuditLoggerConfig.logLevels.hasOwnProperty(normalized)
      ? normalized
      : 'info';
  }

  /**
   * Check if a level should be logged based on minimum level
   * @private
   * @param {string} level - Level to check
   * @returns {boolean} Whether to log
   */
  _shouldLog(level) {
    const levelValue = AuditLoggerConfig.logLevels[level] || 0;
    const minValue = AuditLoggerConfig.logLevels[this.minLogLevel] || 0;
    return levelValue >= minValue;
  }

  /**
   * Sanitize details object to remove sensitive information
   * @private
   * @param {Object} details - Details to sanitize
   * @returns {Object} Sanitized details
   */
  _sanitizeDetails(details) {
    if (!details || typeof details !== 'object') {
      return details;
    }

    const sanitized = {};

    for (const [key, value] of Object.entries(details)) {
      // Check if this is a sensitive field
      const isSensitive = AuditLoggerConfig.sensitiveFields.some(
        field => key.toLowerCase().includes(field.toLowerCase())
      );

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this._sanitizeDetails(value);
      } else if (typeof value === 'string' && value.length > 1000) {
        sanitized[key] = value.substring(0, 1000) + '... [truncated]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize URL to remove sensitive query parameters
   * @private
   * @param {string} url - URL to sanitize
   * @returns {string} Sanitized URL
   */
  _sanitizeUrl(url) {
    try {
      const parsed = new URL(url);
      const sensitiveParams = ['token', 'key', 'password', 'secret', 'auth'];

      for (const param of sensitiveParams) {
        if (parsed.searchParams.has(param)) {
          parsed.searchParams.set(param, '[REDACTED]');
        }
      }

      return parsed.toString();
    } catch {
      return url;
    }
  }

  /**
   * Update statistics after logging
   * @private
   * @param {Object} entry - Log entry
   */
  _updateStats(entry) {
    this.stats.totalLogged++;
    this.stats.lastLogTime = entry.timestamp;

    if (this.stats.byLevel[entry.level] !== undefined) {
      this.stats.byLevel[entry.level]++;
    }

    if (!this.stats.byAction[entry.action]) {
      this.stats.byAction[entry.action] = 0;
    }
    this.stats.byAction[entry.action]++;
  }

  /**
   * Trim logs to max entries
   * @private
   */
  _trimLogs() {
    while (this.logs.length > this.maxLogEntries) {
      this.logs.shift();
    }
  }

  /**
   * Parse duration string to timestamp
   * @private
   * @param {string} duration - Duration string (e.g., '1h', '1d', '7d')
   * @returns {number} Cutoff timestamp
   */
  _parseDuration(duration) {
    const match = duration.match(/^(\d+)([hdwm])$/i);
    if (!match) {
      return 0;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    const multipliers = {
      h: 3600000,      // hour in ms
      d: 86400000,     // day in ms
      w: 604800000,    // week in ms
      m: 2592000000    // month (30 days) in ms
    };

    return Date.now() - (value * multipliers[unit]);
  }

  /**
   * Convert logs to CSV format
   * @private
   * @param {Array} logs - Logs to convert
   * @returns {string} CSV string
   */
  _logsToCSV(logs) {
    if (logs.length === 0) {
      return 'id,timestamp,isoTimestamp,action,level,details,sessionId,source\n';
    }

    const headers = ['id', 'timestamp', 'isoTimestamp', 'action', 'level', 'details', 'sessionId', 'source'];
    const rows = [headers.join(',')];

    for (const log of logs) {
      const row = headers.map(header => {
        let value = log[header];
        if (header === 'details') {
          value = JSON.stringify(value);
        }
        // Escape CSV values
        if (typeof value === 'string') {
          value = `"${value.replace(/"/g, '""')}"`;
        }
        return value !== undefined ? value : '';
      });
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Estimate memory usage of logs
   * @private
   * @returns {string} Estimated memory usage
   */
  _estimateMemoryUsage() {
    try {
      const size = JSON.stringify(this.logs).length;
      if (size < 1024) {
        return `${size} bytes`;
      } else if (size < 1048576) {
        return `${(size / 1024).toFixed(2)} KB`;
      } else {
        return `${(size / 1048576).toFixed(2)} MB`;
      }
    } catch {
      return 'unknown';
    }
  }

  /**
   * Load persisted logs from chrome.storage
   * @private
   */
  async _loadPersistedLogs() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await new Promise((resolve) => {
          chrome.storage.local.get(this.storageKey, resolve);
        });

        if (result[this.storageKey] && Array.isArray(result[this.storageKey])) {
          this.logs = result[this.storageKey];
          // Update stats based on loaded logs
          for (const log of this.logs) {
            this._updateStats(log);
          }
        }
      }
    } catch (error) {
      console.warn('AuditLogger: Failed to load persisted logs:', error.message);
    }
  }

  /**
   * Persist logs to chrome.storage
   * @private
   */
  async _persistLogs() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ [this.storageKey]: this.logs }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
      }
    } catch (error) {
      console.warn('AuditLogger: Failed to persist logs:', error.message);
    }
  }
}

// =============================================================================
// Global Audit Logger Instance
// =============================================================================

/**
 * Singleton audit logger instance for extension-wide use
 */
const auditLogger = new AuditLogger({
  minLogLevel: 'info',
  maxLogEntries: 10000,
  persistenceEnabled: true
});

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.AuditLogger = AuditLogger;
  globalThis.auditLogger = auditLogger;
  globalThis.AuditLoggerConfig = AuditLoggerConfig;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AuditLogger,
    auditLogger,
    AuditLoggerConfig
  };
}
