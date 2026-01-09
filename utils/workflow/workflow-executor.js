/**
 * Basset Hound - Workflow Executor
 *
 * Main orchestrator for workflow execution.
 * Coordinates ExecutionContext, StepExecutor, and ErrorHandler.
 *
 * @version 1.0.0
 * @date 2026-01-09
 */

// Import dependencies (will be loaded via importScripts in background.js)
// const { ExecutionContext, ExecutionStatus } = require('./execution-context.js');
// const { StepExecutor } = require('./step-executor.js');
// const { WorkflowErrorHandler } = require('./error-handler.js');

/**
 * Workflow Executor
 *
 * Orchestrates the execution of workflows, managing state, steps, and errors.
 */
class WorkflowExecutor {
  constructor(options = {}) {
    this.errorHandler = new WorkflowErrorHandler(options.errorConfig);
    this.activeExecutions = new Map(); // Track active executions
    this.executionQueue = []; // Queue for scheduled executions
  }

  /**
   * Execute a workflow
   *
   * @param {Object} workflow - Workflow definition
   * @param {Object} inputs - Input parameters
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async execute(workflow, inputs = {}, options = {}) {
    // Validate workflow
    this.validateWorkflow(workflow);

    // Create execution context
    const context = new ExecutionContext({
      workflowId: workflow.id,
      workflow,
      variables: {
        ...workflow.variables,
        ...inputs,
        executionStartTime: Date.now()
      },
      config: workflow.config || {}
    });

    // Register execution
    this.activeExecutions.set(context.executionId, context);

    try {
      // Start execution
      context.start();

      // Save initial state
      await context.saveState();

      // Count total steps
      context.totalSteps = this.countSteps(workflow.steps);

      // Create step executor
      const stepExecutor = new StepExecutor({
        tabId: options.tabId,
        timeout: workflow.config?.timeout || 30000
      });

      // Execute steps
      await this.executeSteps(workflow.steps, context, stepExecutor);

      // Complete execution
      const outputs = this.extractOutputs(workflow, context);
      context.complete(outputs);

      // Save final state
      await context.saveState();

      // Return results
      return {
        success: true,
        executionId: context.executionId,
        outputs,
        evidence: context.evidence,
        duration: context.getDuration(),
        summary: context.getSummary()
      };
    } catch (error) {
      // Handle execution failure
      context.fail(error);
      await context.saveState();

      return {
        success: false,
        executionId: context.executionId,
        error: error.message,
        logs: context.logs,
        summary: context.getSummary()
      };
    } finally {
      // Cleanup
      this.activeExecutions.delete(context.executionId);
      context.cleanup();
    }
  }

  /**
   * Execute workflow steps sequentially
   *
   * @param {Array} steps - Workflow steps
   * @param {Object} context - Execution context
   * @param {Object} stepExecutor - Step executor instance
   * @returns {Promise<void>}
   */
  async executeSteps(steps, context, stepExecutor) {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      context.currentStepIndex = i;

      // Check if execution is paused or cancelled
      if (context.status === ExecutionStatus.PAUSED) {
        await context.saveState();
        await this.waitForResume(context);
      }

      if (context.status === ExecutionStatus.CANCELLED) {
        throw new Error('Workflow execution cancelled by user');
      }

      // Check global timeout
      if (this.isTimedOut(context)) {
        throw new Error(`Workflow execution timed out after ${context.config.timeout}ms`);
      }

      // Check step condition
      if (step.condition && !this.evaluateCondition(step.condition, context)) {
        context.log('debug', `Step ${step.id} skipped (condition not met)`);
        continue;
      }

      // Execute step with retry logic
      await this.executeStepWithRetry(step, context, stepExecutor);
    }
  }

  /**
   * Execute a single step with retry logic
   *
   * @param {Object} step - Step definition
   * @param {Object} context - Execution context
   * @param {Object} stepExecutor - Step executor instance
   * @returns {Promise<void>}
   */
  async executeStepWithRetry(step, context, stepExecutor) {
    const stepId = step.id;
    const maxRetries = this.errorHandler.getMaxRetries(step);
    let lastError = null;

    // Reset retry count for this step
    this.errorHandler.resetRetryAttempt(stepId);

    while (true) {
      const attemptCount = this.errorHandler.getRetryAttemptCount(stepId);

      try {
        // Execute the step
        const result = await stepExecutor.execute(step, context);

        // Record success
        context.recordStepResult(stepId, result);

        // Execute onSuccess steps
        if (step.onSuccess && step.onSuccess.length > 0) {
          await this.executeSteps(step.onSuccess, context, stepExecutor);
        }

        // Save state after successful step
        await context.saveState();

        return;
      } catch (error) {
        lastError = error;

        // Increment retry attempt
        this.errorHandler.incrementRetryAttempt(stepId);

        // Handle error
        const errorResult = this.errorHandler.handleError(error, context, step);

        // Check if should retry
        if (errorResult.shouldRetry && attemptCount < maxRetries) {
          // Log retry
          this.errorHandler.logRetry(
            stepId,
            attemptCount + 1,
            errorResult.retryDelay,
            context
          );

          // Wait before retrying
          await this.sleep(errorResult.retryDelay);

          // Continue to next retry attempt
          continue;
        } else {
          // Max retries exceeded or non-retryable error
          context.log('error', `Step ${stepId} failed after ${attemptCount} attempts`);

          // Execute onError steps
          if (step.onError && step.onError.length > 0) {
            try {
              await this.executeSteps(step.onError, context, stepExecutor);
            } catch (onErrorFailure) {
              context.log('error', `onError handler failed: ${onErrorFailure.message}`);
            }
          }

          // Check continueOnError flags
          const continueOnError =
            step.continueOnError ||
            context.config.execution?.continueOnError ||
            false;

          if (!continueOnError) {
            // Stop workflow execution
            throw error;
          } else {
            // Continue to next step
            context.log('warn', `Continuing workflow despite error in step ${stepId}`);
            return;
          }
        }
      }
    }
  }

  /**
   * Pause a running workflow
   *
   * @param {string} executionId - Execution ID
   * @returns {Promise<boolean>} Success
   */
  async pauseWorkflow(executionId) {
    const context = this.activeExecutions.get(executionId);

    if (!context) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    if (context.status !== ExecutionStatus.RUNNING) {
      throw new Error(`Execution is not running: ${executionId}`);
    }

    context.pause();
    await context.saveState();

    return true;
  }

  /**
   * Resume a paused workflow
   *
   * @param {string} executionId - Execution ID
   * @returns {Promise<boolean>} Success
   */
  async resumeWorkflow(executionId) {
    // Try to get active execution
    let context = this.activeExecutions.get(executionId);

    // If not active, load from storage
    if (!context) {
      context = await ExecutionContext.loadState(executionId);
      this.activeExecutions.set(executionId, context);
    }

    if (context.status !== ExecutionStatus.PAUSED) {
      throw new Error(`Execution is not paused: ${executionId}`);
    }

    context.resume();
    await context.saveState();

    // Continue execution (would need to be implemented)
    // For now, just change status

    return true;
  }

  /**
   * Cancel a running workflow
   *
   * @param {string} executionId - Execution ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<boolean>} Success
   */
  async cancelWorkflow(executionId, reason = 'User cancelled') {
    const context = this.activeExecutions.get(executionId);

    if (!context) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    context.cancel(reason);
    await context.saveState();

    return true;
  }

  /**
   * Get workflow execution status
   *
   * @param {string} executionId - Execution ID
   * @returns {Promise<Object>} Status information
   */
  async getWorkflowStatus(executionId) {
    // Check active executions first
    let context = this.activeExecutions.get(executionId);

    // If not active, load from storage
    if (!context) {
      try {
        context = await ExecutionContext.loadState(executionId);
      } catch (error) {
        throw new Error(`Execution not found: ${executionId}`);
      }
    }

    return context.getSummary();
  }

  /**
   * List all executions
   *
   * @param {Object} filter - Filter options
   * @returns {Promise<Array>} List of executions
   */
  async listExecutions(filter = {}) {
    const executions = await ExecutionContext.listExecutions();

    // Apply filters
    let filtered = executions;

    if (filter.status) {
      filtered = filtered.filter((e) => e.status === filter.status);
    }

    if (filter.workflowId) {
      filtered = filtered.filter((e) => e.workflowId === filter.workflowId);
    }

    if (filter.limit) {
      filtered = filtered.slice(0, filter.limit);
    }

    return filtered;
  }

  /**
   * Validate workflow definition
   *
   * @param {Object} workflow - Workflow to validate
   * @throws {Error} If workflow is invalid
   */
  validateWorkflow(workflow) {
    if (!workflow) {
      throw new Error('Workflow is required');
    }

    if (!workflow.id) {
      throw new Error('Workflow must have an id');
    }

    if (!workflow.name) {
      throw new Error('Workflow must have a name');
    }

    if (!workflow.steps || !Array.isArray(workflow.steps)) {
      throw new Error('Workflow must have steps array');
    }

    if (workflow.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    // Validate each step
    for (const step of workflow.steps) {
      this.validateStep(step);
    }
  }

  /**
   * Validate a single step
   *
   * @param {Object} step - Step to validate
   * @throws {Error} If step is invalid
   */
  validateStep(step) {
    if (!step.id) {
      throw new Error('Step must have an id');
    }

    if (!step.type) {
      throw new Error(`Step ${step.id} must have a type`);
    }

    const validTypes = [
      'navigate',
      'click',
      'fill',
      'extract',
      'detect',
      'wait',
      'screenshot',
      'conditional',
      'loop',
      'parallel',
      'script',
      'verify',
      'ingest'
    ];

    if (!validTypes.includes(step.type)) {
      throw new Error(`Invalid step type: ${step.type}`);
    }

    // Type-specific validation
    if (step.type === 'navigate' && !step.params?.url) {
      throw new Error(`Navigate step ${step.id} requires url parameter`);
    }

    if (step.type === 'click' && !step.params?.selector) {
      throw new Error(`Click step ${step.id} requires selector parameter`);
    }

    if (step.type === 'fill' && !step.params?.fields) {
      throw new Error(`Fill step ${step.id} requires fields parameter`);
    }

    if (step.type === 'conditional' && !step.params?.condition) {
      throw new Error(`Conditional step ${step.id} requires condition parameter`);
    }

    if (step.type === 'loop') {
      if (!step.params?.items) {
        throw new Error(`Loop step ${step.id} requires items parameter`);
      }
      if (!step.params?.variable) {
        throw new Error(`Loop step ${step.id} requires variable parameter`);
      }
      if (!step.params?.steps) {
        throw new Error(`Loop step ${step.id} requires steps parameter`);
      }
    }
  }

  /**
   * Count total steps (including nested steps)
   *
   * @param {Array} steps - Steps array
   * @returns {number} Total step count
   */
  countSteps(steps) {
    let count = 0;

    for (const step of steps) {
      count++;

      // Count nested steps
      if (step.onSuccess) {
        count += this.countSteps(step.onSuccess);
      }

      if (step.onError) {
        count += this.countSteps(step.onError);
      }

      if (step.params?.steps) {
        count += this.countSteps(step.params.steps);
      }

      if (step.params?.then) {
        count += this.countSteps(step.params.then);
      }

      if (step.params?.else) {
        count += this.countSteps(step.params.else);
      }
    }

    return count;
  }

  /**
   * Extract workflow outputs from context
   *
   * @param {Object} workflow - Workflow definition
   * @param {Object} context - Execution context
   * @returns {Object} Output values
   */
  extractOutputs(workflow, context) {
    if (!workflow.outputs || !Array.isArray(workflow.outputs)) {
      return {};
    }

    const outputs = {};

    for (const output of workflow.outputs) {
      const value = context.getVariable(output.name);
      if (value !== undefined) {
        outputs[output.name] = value;
      }
    }

    return outputs;
  }

  /**
   * Evaluate a condition expression
   *
   * @param {string} condition - Condition expression
   * @param {Object} context - Execution context
   * @returns {boolean} Condition result
   */
  evaluateCondition(condition, context) {
    try {
      const variables = context.getAllVariables();
      const func = new Function(...Object.keys(variables), `return (${condition});`);
      return Boolean(func(...Object.values(variables)));
    } catch (error) {
      console.error('Failed to evaluate condition:', error);
      return false;
    }
  }

  /**
   * Check if execution has timed out
   *
   * @param {Object} context - Execution context
   * @returns {boolean} True if timed out
   */
  isTimedOut(context) {
    if (!context.config.timeout) {
      return false;
    }

    const elapsed = Date.now() - context.startTime;
    return elapsed > context.config.timeout;
  }

  /**
   * Wait for workflow to be resumed
   *
   * @param {Object} context - Execution context
   * @returns {Promise<void>}
   */
  async waitForResume(context) {
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        // Reload context from storage to check if resumed
        const reloadedContext = await ExecutionContext.loadState(context.executionId);

        if (reloadedContext.status === ExecutionStatus.RUNNING) {
          clearInterval(checkInterval);
          context.status = ExecutionStatus.RUNNING;
          resolve();
        } else if (reloadedContext.status === ExecutionStatus.CANCELLED) {
          clearInterval(checkInterval);
          context.status = ExecutionStatus.CANCELLED;
          resolve();
        }
      }, 1000);
    });
  }

  /**
   * Sleep for specified duration
   *
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get error statistics for an execution
   *
   * @param {string} executionId - Execution ID
   * @returns {Promise<Object>} Error statistics
   */
  async getErrorStats(executionId) {
    return this.errorHandler.getErrorStats();
  }

  /**
   * Clean up old execution states
   *
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {Promise<number>} Number of deleted executions
   */
  async cleanupOldExecutions(maxAge) {
    return ExecutionContext.cleanupOldExecutions(maxAge);
  }

  /**
   * Get active execution count
   *
   * @returns {number} Number of active executions
   */
  getActiveExecutionCount() {
    return this.activeExecutions.size;
  }

  /**
   * Get all active execution IDs
   *
   * @returns {Array<string>} Array of execution IDs
   */
  getActiveExecutionIds() {
    return Array.from(this.activeExecutions.keys());
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WorkflowExecutor };
}
