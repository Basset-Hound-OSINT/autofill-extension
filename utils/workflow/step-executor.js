/**
 * Basset Hound - Workflow Step Executor
 *
 * Executes individual workflow steps of all 13 types:
 * - navigate, click, fill, extract, detect, wait, screenshot
 * - conditional, loop, parallel, script, verify, ingest
 *
 * @version 1.0.0
 * @date 2026-01-09
 */

/**
 * Step Executor
 *
 * Executes workflow steps by delegating to type-specific handlers.
 */
class StepExecutor {
  constructor(options = {}) {
    this.tabId = options.tabId || null;
    this.timeout = options.timeout || 30000;
  }

  /**
   * Execute a workflow step
   *
   * @param {Object} step - Step configuration
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Step execution result
   */
  async execute(step, context) {
    if (!step.enabled && step.enabled !== undefined) {
      context.log('debug', `Step ${step.id} is disabled, skipping`);
      return { success: true, skipped: true };
    }

    context.log('info', `Executing step: ${step.id} (${step.type})`, step.params);

    // Substitute variables in step params
    const params = context.substituteVariables(step.params || {});

    // Get timeout (step-level overrides default)
    const timeout = step.timeout || this.timeout;

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(
        this.executeStepByType(step.type, params, context, step),
        timeout,
        step.id
      );

      // Map outputs to context variables
      if (step.outputs && result) {
        for (const [outputName, resultKey] of Object.entries(step.outputs)) {
          const value = resultKey === 'result' ? result : result[resultKey];
          context.setVariable(outputName, value);
        }
      }

      return {
        success: true,
        stepId: step.id,
        stepType: step.type,
        result,
        timestamp: Date.now()
      };
    } catch (error) {
      context.log('error', `Step ${step.id} failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute step with timeout
   *
   * @param {Promise} promise - Step execution promise
   * @param {number} timeout - Timeout in ms
   * @param {string} stepId - Step ID for error reporting
   * @returns {Promise} Result or timeout error
   */
  async executeWithTimeout(promise, timeout, stepId) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Step ${stepId} timed out after ${timeout}ms`)),
          timeout
        )
      )
    ]);
  }

  /**
   * Route step execution to type-specific handler
   *
   * @param {string} type - Step type
   * @param {Object} params - Step parameters
   * @param {Object} context - Execution context
   * @param {Object} step - Full step configuration
   * @returns {Promise<*>} Step result
   */
  async executeStepByType(type, params, context, step) {
    switch (type) {
      case 'navigate':
        return this.executeNavigate(params, context);
      case 'click':
        return this.executeClick(params, context);
      case 'fill':
        return this.executeFill(params, context);
      case 'extract':
        return this.executeExtract(params, context);
      case 'detect':
        return this.executeDetect(params, context);
      case 'wait':
        return this.executeWait(params, context);
      case 'screenshot':
        return this.executeScreenshot(params, context);
      case 'conditional':
        return this.executeConditional(params, context, step);
      case 'loop':
        return this.executeLoop(params, context, step);
      case 'parallel':
        return this.executeParallel(params, context, step);
      case 'script':
        return this.executeScript(params, context);
      case 'verify':
        return this.executeVerify(params, context);
      case 'ingest':
        return this.executeIngest(params, context);
      default:
        throw new Error(`Unknown step type: ${type}`);
    }
  }

  // ============================================================================
  // STEP TYPE IMPLEMENTATIONS
  // ============================================================================

  /**
   * 1. Navigate Step
   *
   * Navigate to a URL and wait for page load.
   *
   * @param {Object} params - { url, waitFor?, waitUntil?, timeout? }
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} { finalUrl, loaded }
   */
  async executeNavigate(params, context) {
    const { url, waitFor, waitUntil } = params;

    if (!url) {
      throw new Error('Navigate step requires url parameter');
    }

    context.log('info', `Navigating to: ${url}`);

    // Get or create tab
    const tabId = await this.getOrCreateTab();

    // Update tab URL
    await chrome.tabs.update(tabId, { url });

    // Wait for page load
    await this.waitForPageLoad(tabId, waitUntil);

    // Wait for specific element if specified
    if (waitFor) {
      await this.sendToContent(tabId, {
        action: 'waitForElement',
        selector: waitFor,
        timeout: params.timeout || 10000
      });
    }

    // Get final URL (may have redirected)
    const tab = await chrome.tabs.get(tabId);

    return {
      finalUrl: tab.url,
      loaded: true
    };
  }

  /**
   * 2. Click Step
   *
   * Click an element on the page.
   *
   * @param {Object} params - { selector, waitAfter?, scrollIntoView? }
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} { clicked }
   */
  async executeClick(params, context) {
    const { selector, waitAfter, scrollIntoView } = params;

    if (!selector) {
      throw new Error('Click step requires selector parameter');
    }

    context.log('info', `Clicking element: ${selector}`);

    const tabId = await this.getCurrentTab();

    const result = await this.sendToContent(tabId, {
      action: 'clickElement',
      selector,
      scrollIntoView: scrollIntoView !== false
    });

    if (!result.success) {
      throw new Error(`Failed to click element: ${result.error}`);
    }

    // Wait after click if specified
    if (waitAfter) {
      await this.sleep(waitAfter);
    }

    return { clicked: true };
  }

  /**
   * 3. Fill Step
   *
   * Fill form fields.
   *
   * @param {Object} params - { fields, submit?, humanize? }
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} { filled }
   */
  async executeFill(params, context) {
    const { fields, submit, humanize } = params;

    if (!fields || typeof fields !== 'object') {
      throw new Error('Fill step requires fields parameter (object)');
    }

    context.log('info', `Filling ${Object.keys(fields).length} fields`);

    const tabId = await this.getCurrentTab();

    const result = await this.sendToContent(tabId, {
      action: 'fillFields',
      fields,
      submit: submit || false,
      humanize: humanize || false
    });

    if (!result.success) {
      throw new Error(`Failed to fill fields: ${result.error}`);
    }

    return { filled: true };
  }

  /**
   * 4. Extract Step
   *
   * Extract content from the page.
   *
   * @param {Object} params - { mode, selector?, selectors?, table? }
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Extracted data
   */
  async executeExtract(params, context) {
    const { mode, selector, selectors, table } = params;

    if (!mode) {
      throw new Error('Extract step requires mode parameter');
    }

    context.log('info', `Extracting data (mode: ${mode})`);

    const tabId = await this.getCurrentTab();

    const result = await this.sendToContent(tabId, {
      action: 'extractData',
      mode,
      selector,
      selectors,
      table
    });

    if (!result.success) {
      throw new Error(`Failed to extract data: ${result.error}`);
    }

    return result.data;
  }

  /**
   * 5. Detect Step
   *
   * Detect OSINT patterns on the page.
   *
   * @param {Object} params - { patterns, context?, highlight? }
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} { results }
   */
  async executeDetect(params, context) {
    const { patterns, context: includeContext, highlight } = params;

    if (!patterns || !Array.isArray(patterns)) {
      throw new Error('Detect step requires patterns parameter (array)');
    }

    context.log('info', `Detecting patterns: ${patterns.join(', ')}`);

    const tabId = await this.getCurrentTab();

    const result = await this.sendToContent(tabId, {
      action: 'detectPatterns',
      patterns,
      includeContext: includeContext || true,
      highlight: highlight || false
    });

    if (!result.success) {
      throw new Error(`Failed to detect patterns: ${result.error}`);
    }

    return { results: result.detected };
  }

  /**
   * 6. Wait Step
   *
   * Wait for a condition or time.
   *
   * @param {Object} params - { for, selector?, time?, condition?, timeout? }
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} { waited }
   */
  async executeWait(params, context) {
    const { for: waitType, selector, time, condition, timeout } = params;

    if (!waitType) {
      throw new Error('Wait step requires "for" parameter');
    }

    context.log('info', `Waiting for: ${waitType}`);

    switch (waitType) {
      case 'time':
        if (!time) {
          throw new Error('Wait step with for="time" requires time parameter');
        }
        await this.sleep(time);
        break;

      case 'element':
        if (!selector) {
          throw new Error('Wait step with for="element" requires selector parameter');
        }
        const tabId = await this.getCurrentTab();
        await this.sendToContent(tabId, {
          action: 'waitForElement',
          selector,
          timeout: timeout || 10000
        });
        break;

      case 'navigation':
        const currentTabId = await this.getCurrentTab();
        await this.waitForPageLoad(currentTabId);
        break;

      case 'condition':
        if (!condition) {
          throw new Error('Wait step with for="condition" requires condition parameter');
        }
        await this.waitForCondition(condition, context, timeout || 10000);
        break;

      default:
        throw new Error(`Unknown wait type: ${waitType}`);
    }

    return { waited: true };
  }

  /**
   * 7. Screenshot Step
   *
   * Capture a screenshot.
   *
   * @param {Object} params - { fullPage?, element?, format? }
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} { dataUrl }
   */
  async executeScreenshot(params, context) {
    const { fullPage, element, format } = params;

    context.log('info', 'Capturing screenshot');

    const tabId = await this.getCurrentTab();

    let dataUrl;

    if (element) {
      // Element screenshot via content script
      const result = await this.sendToContent(tabId, {
        action: 'captureElementScreenshot',
        selector: element
      });
      dataUrl = result.dataUrl;
    } else {
      // Tab screenshot via Chrome API
      dataUrl = await chrome.tabs.captureVisibleTab(null, {
        format: format || 'png'
      });
    }

    // Add to evidence
    context.addEvidence({
      type: 'screenshot',
      dataUrl,
      fullPage: fullPage || false,
      element: element || null,
      format: format || 'png'
    });

    return { dataUrl };
  }

  /**
   * 8. Conditional Step
   *
   * Execute steps based on a condition.
   *
   * @param {Object} params - { condition, then?, else? }
   * @param {Object} context - Execution context
   * @param {Object} step - Full step configuration
   * @returns {Promise<Object>} { conditionMet, result }
   */
  async executeConditional(params, context, step) {
    const { condition, then, else: elseSteps } = params;

    if (!condition) {
      throw new Error('Conditional step requires condition parameter');
    }

    context.log('info', `Evaluating condition: ${condition}`);

    // Evaluate condition
    const conditionMet = this.evaluateCondition(condition, context);

    context.log('info', `Condition result: ${conditionMet}`);

    // Execute appropriate branch
    const stepsToExecute = conditionMet ? then : elseSteps;

    if (stepsToExecute && Array.isArray(stepsToExecute)) {
      const results = [];
      for (const subStep of stepsToExecute) {
        const result = await this.execute(subStep, context);
        results.push(result);
      }
      return { conditionMet, results };
    }

    return { conditionMet };
  }

  /**
   * 9. Loop Step
   *
   * Execute steps for each item in an array.
   *
   * @param {Object} params - { items, variable, maxIterations?, steps }
   * @param {Object} context - Execution context
   * @param {Object} step - Full step configuration
   * @returns {Promise<Object>} { iterations, results }
   */
  async executeLoop(params, context, step) {
    const { items, variable, maxIterations, steps } = params;

    if (!items) {
      throw new Error('Loop step requires items parameter');
    }

    if (!variable) {
      throw new Error('Loop step requires variable parameter');
    }

    if (!steps || !Array.isArray(steps)) {
      throw new Error('Loop step requires steps parameter (array)');
    }

    // Get items array (may be variable reference)
    let itemsArray = items;
    if (typeof items === 'string' && items.startsWith('$')) {
      itemsArray = context.getVariable(items.substring(1));
    }

    if (!Array.isArray(itemsArray)) {
      throw new Error('Loop items must be an array');
    }

    const maxIter = maxIterations || 100;
    const iterations = Math.min(itemsArray.length, maxIter);

    context.log('info', `Starting loop: ${iterations} iterations`);

    const results = [];

    for (let i = 0; i < iterations; i++) {
      const item = itemsArray[i];

      // Set loop variable
      context.setVariable(variable, item);
      context.setVariable(`${variable}_index`, i);

      context.log('debug', `Loop iteration ${i + 1}/${iterations}`);

      // Execute loop steps
      const iterationResults = [];
      for (const loopStep of steps) {
        const result = await this.execute(loopStep, context);
        iterationResults.push(result);
      }

      results.push({
        iteration: i,
        item,
        results: iterationResults
      });
    }

    return { iterations, results };
  }

  /**
   * 10. Parallel Step
   *
   * Execute multiple steps in parallel.
   *
   * @param {Object} params - { steps, maxConcurrent? }
   * @param {Object} context - Execution context
   * @param {Object} step - Full step configuration
   * @returns {Promise<Object>} { results }
   */
  async executeParallel(params, context, step) {
    const { steps, maxConcurrent } = params;

    if (!steps || !Array.isArray(steps)) {
      throw new Error('Parallel step requires steps parameter (array)');
    }

    const maxConcurrentValue = maxConcurrent || 3;

    context.log('info', `Executing ${steps.length} steps in parallel (max ${maxConcurrentValue} concurrent)`);

    // Execute with concurrency limit
    const results = await this.executeWithConcurrencyLimit(
      steps,
      maxConcurrentValue,
      (parallelStep) => this.execute(parallelStep, context)
    );

    return { results };
  }

  /**
   * 11. Script Step
   *
   * Execute custom JavaScript.
   *
   * @param {Object} params - { code, timeout? }
   * @param {Object} context - Execution context
   * @returns {Promise<*>} Script result
   */
  async executeScript(params, context) {
    const { code, timeout } = params;

    if (!code) {
      throw new Error('Script step requires code parameter');
    }

    context.log('info', 'Executing script');

    try {
      // Create safe execution context
      const safeContext = {
        // Expose context variables (read-only)
        ...context.getAllVariables(),
        // Safe utilities
        console: {
          log: (...args) => context.log('info', args.join(' '))
        },
        Date,
        Math,
        JSON
      };

      // Execute code in sandboxed function
      const func = new Function(...Object.keys(safeContext), `return (${code});`);
      const result = func(...Object.values(safeContext));

      // Support async functions
      if (result instanceof Promise) {
        return await result;
      }

      return result;
    } catch (error) {
      throw new Error(`Script execution failed: ${error.message}`);
    }
  }

  /**
   * 12. Verify Step
   *
   * Verify data format (client-side validation).
   *
   * @param {Object} params - { type, value }
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} { valid, format }
   */
  async executeVerify(params, context) {
    const { type, value } = params;

    if (!type || !value) {
      throw new Error('Verify step requires type and value parameters');
    }

    context.log('info', `Verifying ${type}: ${value}`);

    // Get pattern from pattern detector
    const patterns = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      phone: /^[\d\s\-\+\(\)]+$/,
      crypto_btc: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
      crypto_eth: /^0x[a-fA-F0-9]{40}$/,
      ip: /^(\d{1,3}\.){3}\d{1,3}$/,
      url: /^https?:\/\/.+/
    };

    const pattern = patterns[type];

    if (!pattern) {
      throw new Error(`Unknown verification type: ${type}`);
    }

    const valid = pattern.test(value);

    return {
      valid,
      format: type
    };
  }

  /**
   * 13. Ingest Step
   *
   * Send data to basset-hound backend.
   *
   * @param {Object} params - { entityType, data, caseId? }
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} { entityId }
   */
  async executeIngest(params, context) {
    const { entityType, data, caseId } = params;

    if (!entityType || !data) {
      throw new Error('Ingest step requires entityType and data parameters');
    }

    context.log('info', `Ingesting ${entityType} data`);

    // Send to background script for ingestion
    const result = await chrome.runtime.sendMessage({
      action: 'ingestEntity',
      entityType,
      data,
      caseId: caseId || null
    });

    if (!result.success) {
      throw new Error(`Ingestion failed: ${result.error}`);
    }

    return {
      entityId: result.entityId
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get or create a tab for workflow execution
   *
   * @returns {Promise<number>} Tab ID
   */
  async getOrCreateTab() {
    if (this.tabId) {
      try {
        await chrome.tabs.get(this.tabId);
        return this.tabId;
      } catch (error) {
        // Tab doesn't exist, create new one
      }
    }

    const tab = await chrome.tabs.create({ active: false });
    this.tabId = tab.id;
    return tab.id;
  }

  /**
   * Get the current active tab
   *
   * @returns {Promise<number>} Tab ID
   */
  async getCurrentTab() {
    if (this.tabId) {
      return this.tabId;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error('No active tab found');
    }

    this.tabId = tab.id;
    return tab.id;
  }

  /**
   * Wait for page load
   *
   * @param {number} tabId - Tab ID
   * @param {string} waitUntil - Load state to wait for
   * @returns {Promise<void>}
   */
  async waitForPageLoad(tabId, waitUntil = 'load') {
    return new Promise((resolve) => {
      const listener = (changedTabId, changeInfo) => {
        if (changedTabId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);

      // Timeout after 30 seconds
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 30000);
    });
  }

  /**
   * Send message to content script
   *
   * @param {number} tabId - Tab ID
   * @param {Object} message - Message to send
   * @returns {Promise<Object>} Response from content script
   */
  async sendToContent(tabId, message) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      return response;
    } catch (error) {
      throw new Error(`Failed to communicate with content script: ${error.message}`);
    }
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
   * Wait for a condition to become true
   *
   * @param {string} condition - Condition expression
   * @param {Object} context - Execution context
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<void>}
   */
  async waitForCondition(condition, context, timeout) {
    const startTime = Date.now();
    const interval = 500; // Check every 500ms

    while (Date.now() - startTime < timeout) {
      if (this.evaluateCondition(condition, context)) {
        return;
      }
      await this.sleep(interval);
    }

    throw new Error(`Condition not met within ${timeout}ms: ${condition}`);
  }

  /**
   * Execute promises with concurrency limit
   *
   * @param {Array} items - Items to process
   * @param {number} limit - Concurrency limit
   * @param {Function} fn - Function to execute for each item
   * @returns {Promise<Array>} Results
   */
  async executeWithConcurrencyLimit(items, limit, fn) {
    const results = [];
    const executing = [];

    for (const item of items) {
      const promise = fn(item).then((result) => {
        executing.splice(executing.indexOf(promise), 1);
        return result;
      });

      results.push(promise);
      executing.push(promise);

      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }

    return Promise.all(results);
  }

  /**
   * Sleep for specified duration
   *
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StepExecutor };
}
