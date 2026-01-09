/**
 * Basset Hound - Workflow Error Handler
 *
 * Intelligent error handling with exponential backoff retry logic.
 * Handles different error types and determines retry strategies.
 *
 * @version 1.0.0
 * @date 2026-01-09
 */

/**
 * Error types that can be retried
 */
const RETRYABLE_ERROR_TYPES = [
  'TimeoutError',
  'NetworkError',
  'NavigationError',
  'ElementNotFoundError',
  'ClickInterceptedError',
  'DetachedElementError',
  'StaleElementError'
];

/**
 * Error types that should never be retried
 */
const NON_RETRYABLE_ERROR_TYPES = [
  'ValidationError',
  'ConfigurationError',
  'SecurityError',
  'QuotaExceededError',
  'PermissionError'
];

/**
 * Custom error classes for workflow execution
 */
class WorkflowError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'WorkflowError';
    this.details = details;
    this.timestamp = Date.now();
  }
}

class TimeoutError extends WorkflowError {
  constructor(message, details) {
    super(message, details);
    this.name = 'TimeoutError';
  }
}

class NavigationError extends WorkflowError {
  constructor(message, details) {
    super(message, details);
    this.name = 'NavigationError';
  }
}

class ElementNotFoundError extends WorkflowError {
  constructor(message, details) {
    super(message, details);
    this.name = 'ElementNotFoundError';
  }
}

class ValidationError extends WorkflowError {
  constructor(message, details) {
    super(message, details);
    this.name = 'ValidationError';
  }
}

class ConfigurationError extends WorkflowError {
  constructor(message, details) {
    super(message, details);
    this.name = 'ConfigurationError';
  }
}

/**
 * Workflow Error Handler
 *
 * Manages error handling, retry logic, and error logging during workflow execution.
 */
class WorkflowErrorHandler {
  constructor(config = {}) {
    this.config = {
      retryPolicy: {
        enabled: true,
        maxRetries: 3,
        retryDelay: 1000, // Initial retry delay in ms
        retryBackoff: 'exponential', // 'linear' or 'exponential'
        maxRetryDelay: 30000, // Maximum retry delay
        ...config.retryPolicy
      },
      logging: {
        enabled: true,
        logLevel: 'info', // 'debug', 'info', 'warn', 'error'
        maxLogSize: 1000, // Maximum number of log entries
        ...config.logging
      },
      ...config
    };

    this.errorLog = [];
    this.retryAttempts = new Map(); // Track retry attempts per step
  }

  /**
   * Handle an error during workflow execution
   *
   * @param {Error} error - The error that occurred
   * @param {Object} context - Execution context
   * @param {Object} step - The step that failed
   * @returns {Object} Error handling result
   */
  handleError(error, context, step = null) {
    // Log the error
    this.logError(error, context, step);

    // Determine if error is retryable
    const retryable = this.isRetryable(error, step);

    // Get retry attempt count
    const stepId = step?.id || 'unknown';
    const attemptCount = this.getRetryAttemptCount(stepId);

    // Record error in context
    if (context && context.errors) {
      context.errors.push({
        message: error.message,
        name: error.name,
        stepId: stepId,
        stepType: step?.type,
        stack: error.stack,
        timestamp: Date.now(),
        attemptCount,
        retryable
      });
    }

    return {
      error,
      retryable,
      attemptCount,
      shouldRetry: retryable && attemptCount < this.getMaxRetries(step),
      retryDelay: this.calculateRetryDelay(attemptCount)
    };
  }

  /**
   * Determine if an error should be retried
   *
   * @param {Error} error - The error to check
   * @param {Object} step - The step configuration
   * @returns {boolean} True if error is retryable
   */
  isRetryable(error, step) {
    // Check if retries are disabled globally
    if (!this.config.retryPolicy.enabled) {
      return false;
    }

    // Check if step explicitly disables retries
    if (step && step.retries === 0) {
      return false;
    }

    // Check if error type is explicitly non-retryable
    if (NON_RETRYABLE_ERROR_TYPES.includes(error.name)) {
      return false;
    }

    // Check if error type is in retryable list
    if (RETRYABLE_ERROR_TYPES.includes(error.name)) {
      return true;
    }

    // Check for specific error messages that indicate retryable issues
    const retryableMessages = [
      'timeout',
      'network',
      'connection',
      'not found',
      'element not visible',
      'element not interactable',
      'stale element'
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableMessages.some(msg => errorMessage.includes(msg));
  }

  /**
   * Calculate the delay before the next retry
   *
   * @param {number} attemptCount - Number of retry attempts so far
   * @returns {number} Delay in milliseconds
   */
  calculateRetryDelay(attemptCount) {
    const baseDelay = this.config.retryPolicy.retryDelay;
    const backoff = this.config.retryPolicy.retryBackoff;
    const maxDelay = this.config.retryPolicy.maxRetryDelay;

    let delay;

    if (backoff === 'exponential') {
      // Exponential backoff: delay = baseDelay * 2^attemptCount
      delay = baseDelay * Math.pow(2, attemptCount);
    } else if (backoff === 'linear') {
      // Linear backoff: delay = baseDelay * (attemptCount + 1)
      delay = baseDelay * (attemptCount + 1);
    } else {
      // Constant delay
      delay = baseDelay;
    }

    // Cap at maximum delay
    return Math.min(delay, maxDelay);
  }

  /**
   * Get the maximum number of retries for a step
   *
   * @param {Object} step - The step configuration
   * @returns {number} Maximum retry count
   */
  getMaxRetries(step) {
    // Step-level retry count overrides global config
    if (step && typeof step.retries === 'number') {
      return step.retries;
    }
    return this.config.retryPolicy.maxRetries;
  }

  /**
   * Get the current retry attempt count for a step
   *
   * @param {string} stepId - The step ID
   * @returns {number} Current attempt count
   */
  getRetryAttemptCount(stepId) {
    return this.retryAttempts.get(stepId) || 0;
  }

  /**
   * Increment the retry attempt count for a step
   *
   * @param {string} stepId - The step ID
   * @returns {number} New attempt count
   */
  incrementRetryAttempt(stepId) {
    const currentCount = this.getRetryAttemptCount(stepId);
    const newCount = currentCount + 1;
    this.retryAttempts.set(stepId, newCount);
    return newCount;
  }

  /**
   * Reset the retry attempt count for a step
   *
   * @param {string} stepId - The step ID
   */
  resetRetryAttempt(stepId) {
    this.retryAttempts.delete(stepId);
  }

  /**
   * Log an error
   *
   * @param {Error} error - The error to log
   * @param {Object} context - Execution context
   * @param {Object} step - The step that failed
   */
  logError(error, context, step) {
    if (!this.config.logging.enabled) {
      return;
    }

    const logEntry = {
      level: 'error',
      timestamp: Date.now(),
      executionId: context?.executionId,
      workflowId: context?.workflowId,
      stepId: step?.id,
      stepType: step?.type,
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      attemptCount: this.getRetryAttemptCount(step?.id)
    };

    // Add to internal log
    this.errorLog.push(logEntry);

    // Trim log if too large
    if (this.errorLog.length > this.config.logging.maxLogSize) {
      this.errorLog.shift();
    }

    // Also log to context if available
    if (context && context.logs) {
      context.logs.push(logEntry);
    }

    // Console log for debugging
    console.error(`[WorkflowErrorHandler] ${error.name}: ${error.message}`, {
      executionId: context?.executionId,
      stepId: step?.id,
      attemptCount: logEntry.attemptCount
    });
  }

  /**
   * Log a retry attempt
   *
   * @param {string} stepId - The step ID
   * @param {number} attemptCount - Current attempt count
   * @param {number} delay - Retry delay in ms
   * @param {Object} context - Execution context
   */
  logRetry(stepId, attemptCount, delay, context) {
    if (!this.config.logging.enabled) {
      return;
    }

    const logEntry = {
      level: 'warn',
      timestamp: Date.now(),
      executionId: context?.executionId,
      stepId,
      message: `Retrying step ${stepId} (attempt ${attemptCount}) after ${delay}ms`,
      attemptCount,
      delay
    };

    this.errorLog.push(logEntry);

    if (context && context.logs) {
      context.logs.push(logEntry);
    }

    console.warn(`[WorkflowErrorHandler] ${logEntry.message}`);
  }

  /**
   * Get all error logs
   *
   * @returns {Array} Array of log entries
   */
  getErrorLog() {
    return [...this.errorLog];
  }

  /**
   * Get error logs for a specific execution
   *
   * @param {string} executionId - The execution ID
   * @returns {Array} Filtered log entries
   */
  getErrorLogForExecution(executionId) {
    return this.errorLog.filter(entry => entry.executionId === executionId);
  }

  /**
   * Clear error logs
   */
  clearErrorLog() {
    this.errorLog = [];
  }

  /**
   * Clear retry attempts
   */
  clearRetryAttempts() {
    this.retryAttempts.clear();
  }

  /**
   * Get error statistics
   *
   * @returns {Object} Error statistics
   */
  getErrorStats() {
    const errorsByType = {};
    const errorsByStep = {};

    for (const entry of this.errorLog) {
      if (entry.level === 'error') {
        // Count by error type
        errorsByType[entry.errorName] = (errorsByType[entry.errorName] || 0) + 1;

        // Count by step
        if (entry.stepId) {
          errorsByStep[entry.stepId] = (errorsByStep[entry.stepId] || 0) + 1;
        }
      }
    }

    return {
      totalErrors: this.errorLog.filter(e => e.level === 'error').length,
      totalRetries: this.errorLog.filter(e => e.level === 'warn' && e.message?.includes('Retrying')).length,
      errorsByType,
      errorsByStep,
      mostCommonError: Object.keys(errorsByType).length > 0
        ? Object.entries(errorsByType).sort((a, b) => b[1] - a[1])[0][0]
        : null
    };
  }

  /**
   * Convert Chrome runtime error to WorkflowError
   *
   * @param {Error} error - The Chrome runtime error
   * @returns {WorkflowError} Converted error
   */
  static convertChromeError(error) {
    const message = error.message || 'Unknown Chrome error';

    // Navigation errors
    if (message.includes('navigation') || message.includes('NET::')) {
      return new NavigationError(message, { originalError: error });
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('Timeout')) {
      return new TimeoutError(message, { originalError: error });
    }

    // Element not found
    if (message.includes('not found') || message.includes('No node')) {
      return new ElementNotFoundError(message, { originalError: error });
    }

    // Generic workflow error
    return new WorkflowError(message, { originalError: error });
  }
}

// Export classes and handler
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    WorkflowErrorHandler,
    WorkflowError,
    TimeoutError,
    NavigationError,
    ElementNotFoundError,
    ValidationError,
    ConfigurationError,
    RETRYABLE_ERROR_TYPES,
    NON_RETRYABLE_ERROR_TYPES
  };
}
