/**
 * Basset Hound - Workflow Execution Context
 *
 * Manages workflow execution state, variables, and results with Chrome storage persistence.
 * Tracks progress, handles variable substitution, and maintains execution history.
 *
 * @version 1.0.0
 * @date 2026-01-09
 */

/**
 * Execution status enum
 */
const ExecutionStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * Workflow Execution Context
 *
 * Encapsulates the runtime state of a workflow execution.
 */
class ExecutionContext {
  constructor(options = {}) {
    this.workflowId = options.workflowId || null;
    this.executionId = options.executionId || this.generateExecutionId();
    this.workflow = options.workflow || null;
    this.status = ExecutionStatus.PENDING;

    // Variable storage
    this.variables = new Map(Object.entries(options.variables || {}));

    // Step results
    this.stepResults = new Map();

    // Evidence collected during execution
    this.evidence = [];

    // Execution logs
    this.logs = [];

    // Errors encountered
    this.errors = [];

    // Timing information
    this.startTime = null;
    this.endTime = null;
    this.pauseTime = null;
    this.resumeTime = null;

    // Progress tracking
    this.currentStepIndex = 0;
    this.totalSteps = 0;

    // Configuration
    this.config = options.config || {};

    // Storage key prefix
    this.STORAGE_KEY_PREFIX = 'workflow_execution_';

    // Listeners for state changes
    this.listeners = new Map();
  }

  /**
   * Generate a unique execution ID
   *
   * @returns {string} Execution ID
   */
  generateExecutionId() {
    return 'exec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Start the execution
   */
  start() {
    this.status = ExecutionStatus.RUNNING;
    this.startTime = Date.now();
    this.log('info', 'Workflow execution started', {
      workflowId: this.workflowId,
      executionId: this.executionId
    });
    this.emitEvent('statusChange', { status: this.status });
  }

  /**
   * Pause the execution
   */
  pause() {
    this.status = ExecutionStatus.PAUSED;
    this.pauseTime = Date.now();
    this.log('info', 'Workflow execution paused', {
      executionId: this.executionId
    });
    this.emitEvent('statusChange', { status: this.status });
  }

  /**
   * Resume the execution
   */
  resume() {
    this.status = ExecutionStatus.RUNNING;
    this.resumeTime = Date.now();
    this.log('info', 'Workflow execution resumed', {
      executionId: this.executionId
    });
    this.emitEvent('statusChange', { status: this.status });
  }

  /**
   * Complete the execution
   *
   * @param {Object} result - Final execution result
   */
  complete(result = {}) {
    this.status = ExecutionStatus.COMPLETED;
    this.endTime = Date.now();
    this.log('info', 'Workflow execution completed', {
      executionId: this.executionId,
      duration: this.getDuration(),
      result
    });
    this.emitEvent('statusChange', { status: this.status, result });
  }

  /**
   * Fail the execution
   *
   * @param {Error} error - Error that caused failure
   */
  fail(error) {
    this.status = ExecutionStatus.FAILED;
    this.endTime = Date.now();
    this.log('error', 'Workflow execution failed', {
      executionId: this.executionId,
      error: error.message,
      stack: error.stack
    });
    this.emitEvent('statusChange', { status: this.status, error });
  }

  /**
   * Cancel the execution
   *
   * @param {string} reason - Cancellation reason
   */
  cancel(reason = 'User cancelled') {
    this.status = ExecutionStatus.CANCELLED;
    this.endTime = Date.now();
    this.log('warn', 'Workflow execution cancelled', {
      executionId: this.executionId,
      reason
    });
    this.emitEvent('statusChange', { status: this.status, reason });
  }

  /**
   * Set a variable in the context
   *
   * @param {string} name - Variable name
   * @param {*} value - Variable value
   */
  setVariable(name, value) {
    this.variables.set(name, value);
    this.log('debug', `Variable set: ${name}`, { value });
    this.emitEvent('variableChange', { name, value });
  }

  /**
   * Get a variable from the context
   *
   * @param {string} name - Variable name
   * @param {*} defaultValue - Default value if not found
   * @returns {*} Variable value
   */
  getVariable(name, defaultValue = undefined) {
    return this.variables.has(name) ? this.variables.get(name) : defaultValue;
  }

  /**
   * Check if a variable exists
   *
   * @param {string} name - Variable name
   * @returns {boolean} True if variable exists
   */
  hasVariable(name) {
    return this.variables.has(name);
  }

  /**
   * Delete a variable
   *
   * @param {string} name - Variable name
   */
  deleteVariable(name) {
    this.variables.delete(name);
  }

  /**
   * Get all variables
   *
   * @returns {Object} Variables as object
   */
  getAllVariables() {
    return Object.fromEntries(this.variables);
  }

  /**
   * Substitute variables in a string or object
   *
   * @param {*} value - Value with variable references (e.g., "${username}")
   * @returns {*} Value with substituted variables
   */
  substituteVariables(value) {
    if (typeof value === 'string') {
      // Replace ${variableName} with actual value
      return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
        // Support nested property access (e.g., ${user.name})
        const parts = varName.split('.');
        let result = this.getVariable(parts[0]);

        for (let i = 1; i < parts.length && result !== undefined; i++) {
          result = result?.[parts[i]];
        }

        return result !== undefined ? String(result) : match;
      });
    } else if (Array.isArray(value)) {
      // Recursively substitute in arrays
      return value.map(item => this.substituteVariables(item));
    } else if (value !== null && typeof value === 'object') {
      // Recursively substitute in objects
      const result = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.substituteVariables(val);
      }
      return result;
    }

    return value;
  }

  /**
   * Record a step result
   *
   * @param {string} stepId - Step ID
   * @param {Object} result - Step execution result
   */
  recordStepResult(stepId, result) {
    this.stepResults.set(stepId, {
      ...result,
      timestamp: Date.now()
    });

    // Store output variables
    if (result.outputs) {
      for (const [name, value] of Object.entries(result.outputs)) {
        this.setVariable(name, value);
      }
    }

    this.log('debug', `Step completed: ${stepId}`, { result });
    this.emitEvent('stepComplete', { stepId, result });
  }

  /**
   * Get a step result
   *
   * @param {string} stepId - Step ID
   * @returns {Object|null} Step result
   */
  getStepResult(stepId) {
    return this.stepResults.get(stepId) || null;
  }

  /**
   * Add evidence item
   *
   * @param {Object} evidenceItem - Evidence data
   */
  addEvidence(evidenceItem) {
    this.evidence.push({
      ...evidenceItem,
      timestamp: Date.now(),
      executionId: this.executionId
    });
    this.log('debug', 'Evidence captured', { type: evidenceItem.type });
    this.emitEvent('evidenceAdded', { evidence: evidenceItem });
  }

  /**
   * Log a message
   *
   * @param {string} level - Log level (debug, info, warn, error)
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  log(level, message, data = {}) {
    const logEntry = {
      level,
      message,
      timestamp: Date.now(),
      executionId: this.executionId,
      ...data
    };

    this.logs.push(logEntry);

    // Console output
    const consoleMethod = console[level] || console.log;
    consoleMethod(`[ExecutionContext] ${message}`, data);
  }

  /**
   * Get execution duration in milliseconds
   *
   * @returns {number} Duration
   */
  getDuration() {
    if (!this.startTime) return 0;
    const endTime = this.endTime || Date.now();
    return endTime - this.startTime;
  }

  /**
   * Get execution progress percentage
   *
   * @returns {number} Progress (0-100)
   */
  getProgress() {
    if (this.totalSteps === 0) return 0;
    return Math.round((this.stepResults.size / this.totalSteps) * 100);
  }

  /**
   * Save execution state to Chrome storage
   *
   * @returns {Promise<void>}
   */
  async saveState() {
    const key = this.STORAGE_KEY_PREFIX + this.executionId;

    const state = {
      workflowId: this.workflowId,
      executionId: this.executionId,
      status: this.status,
      variables: Object.fromEntries(this.variables),
      stepResults: Object.fromEntries(this.stepResults),
      evidence: this.evidence,
      logs: this.logs.slice(-100), // Keep last 100 logs
      errors: this.errors,
      startTime: this.startTime,
      endTime: this.endTime,
      pauseTime: this.pauseTime,
      resumeTime: this.resumeTime,
      currentStepIndex: this.currentStepIndex,
      totalSteps: this.totalSteps,
      savedAt: Date.now()
    };

    try {
      await chrome.storage.local.set({ [key]: state });
      this.log('debug', 'Execution state saved to storage');
    } catch (error) {
      console.error('[ExecutionContext] Failed to save state:', error);
      throw error;
    }
  }

  /**
   * Load execution state from Chrome storage
   *
   * @param {string} executionId - Execution ID to load
   * @returns {Promise<ExecutionContext>}
   */
  static async loadState(executionId) {
    const key = 'workflow_execution_' + executionId;

    try {
      const result = await chrome.storage.local.get(key);

      if (!result[key]) {
        throw new Error(`Execution state not found: ${executionId}`);
      }

      const state = result[key];

      // Recreate context from saved state
      const context = new ExecutionContext({
        workflowId: state.workflowId,
        executionId: state.executionId,
        variables: state.variables,
        config: state.config
      });

      context.status = state.status;
      context.variables = new Map(Object.entries(state.variables || {}));
      context.stepResults = new Map(Object.entries(state.stepResults || {}));
      context.evidence = state.evidence || [];
      context.logs = state.logs || [];
      context.errors = state.errors || [];
      context.startTime = state.startTime;
      context.endTime = state.endTime;
      context.pauseTime = state.pauseTime;
      context.resumeTime = state.resumeTime;
      context.currentStepIndex = state.currentStepIndex || 0;
      context.totalSteps = state.totalSteps || 0;

      context.log('info', 'Execution state loaded from storage');

      return context;
    } catch (error) {
      console.error('[ExecutionContext] Failed to load state:', error);
      throw error;
    }
  }

  /**
   * Delete execution state from Chrome storage
   *
   * @returns {Promise<void>}
   */
  async deleteState() {
    const key = this.STORAGE_KEY_PREFIX + this.executionId;

    try {
      await chrome.storage.local.remove(key);
      this.log('debug', 'Execution state deleted from storage');
    } catch (error) {
      console.error('[ExecutionContext] Failed to delete state:', error);
      throw error;
    }
  }

  /**
   * List all execution states in storage
   *
   * @returns {Promise<Array>} Array of execution summaries
   */
  static async listExecutions() {
    try {
      const allData = await chrome.storage.local.get(null);
      const executions = [];

      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith('workflow_execution_')) {
          executions.push({
            executionId: value.executionId,
            workflowId: value.workflowId,
            status: value.status,
            startTime: value.startTime,
            endTime: value.endTime,
            duration: value.endTime ? value.endTime - value.startTime : Date.now() - value.startTime,
            progress: value.totalSteps > 0 ? Math.round((Object.keys(value.stepResults || {}).length / value.totalSteps) * 100) : 0,
            savedAt: value.savedAt
          });
        }
      }

      return executions.sort((a, b) => b.startTime - a.startTime);
    } catch (error) {
      console.error('[ExecutionContext] Failed to list executions:', error);
      return [];
    }
  }

  /**
   * Clean up old executions from storage
   *
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {Promise<number>} Number of deleted executions
   */
  static async cleanupOldExecutions(maxAge = 30 * 24 * 60 * 60 * 1000) {
    try {
      const allData = await chrome.storage.local.get(null);
      const now = Date.now();
      let deletedCount = 0;

      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith('workflow_execution_')) {
          const age = now - (value.savedAt || value.startTime || 0);
          if (age > maxAge) {
            await chrome.storage.local.remove(key);
            deletedCount++;
          }
        }
      }

      console.log(`[ExecutionContext] Cleaned up ${deletedCount} old executions`);
      return deletedCount;
    } catch (error) {
      console.error('[ExecutionContext] Failed to cleanup old executions:', error);
      return 0;
    }
  }

  /**
   * Register an event listener
   *
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Unregister an event listener
   *
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Emit an event
   *
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emitEvent(event, data) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    for (const callback of callbacks) {
      try {
        callback(data);
      } catch (error) {
        console.error(`[ExecutionContext] Error in event listener for ${event}:`, error);
      }
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.listeners.clear();
    this.log('debug', 'Execution context cleaned up');
  }

  /**
   * Get execution summary
   *
   * @returns {Object} Summary data
   */
  getSummary() {
    return {
      executionId: this.executionId,
      workflowId: this.workflowId,
      status: this.status,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.getDuration(),
      progress: this.getProgress(),
      totalSteps: this.totalSteps,
      completedSteps: this.stepResults.size,
      evidenceCount: this.evidence.length,
      errorCount: this.errors.length,
      logCount: this.logs.length
    };
  }

  /**
   * Export execution data
   *
   * @returns {Object} Complete execution data
   */
  export() {
    return {
      executionId: this.executionId,
      workflowId: this.workflowId,
      status: this.status,
      variables: Object.fromEntries(this.variables),
      stepResults: Object.fromEntries(this.stepResults),
      evidence: this.evidence,
      logs: this.logs,
      errors: this.errors,
      timing: {
        startTime: this.startTime,
        endTime: this.endTime,
        pauseTime: this.pauseTime,
        resumeTime: this.resumeTime,
        duration: this.getDuration()
      },
      progress: {
        currentStepIndex: this.currentStepIndex,
        totalSteps: this.totalSteps,
        percentage: this.getProgress()
      }
    };
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ExecutionContext,
    ExecutionStatus
  };
}
