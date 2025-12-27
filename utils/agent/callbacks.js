/**
 * Basset Hound Browser Automation - Agent Callbacks
 *
 * Phase 6 palletAI Integration callbacks for:
 * - CAPTCHA assistance requests
 * - Approval workflow for sensitive actions
 * - Progress reporting for long operations
 * - Breakpoint management for debugging
 */

// =============================================================================
// Callback State Management
// =============================================================================

// Pending callback requests awaiting response
const pendingCallbacks = new Map();

// Breakpoint state management
const breakpoints = new Map();
let breakpointIdCounter = 0;

// Progress tracking for long operations
const progressTrackers = new Map();

// =============================================================================
// Callback Request Types
// =============================================================================

const CallbackType = {
  CAPTCHA_HELP: 'captcha_help',
  APPROVAL: 'approval',
  PROGRESS: 'progress',
  BREAKPOINT: 'breakpoint'
};

// Approval request action types
const ApprovalActionType = {
  FORM_SUBMIT: 'form_submit',
  PAYMENT: 'payment',
  DATA_EXPORT: 'data_export',
  ACCOUNT_ACTION: 'account_action',
  DELETE_ACTION: 'delete_action',
  NAVIGATION: 'navigation',
  SCRIPT_EXECUTION: 'script_execution',
  CREDENTIAL_USE: 'credential_use',
  CUSTOM: 'custom'
};

// Breakpoint states
const BreakpointState = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  RESUMED: 'resumed',
  CANCELLED: 'cancelled'
};

// =============================================================================
// CAPTCHA Help Request
// =============================================================================

/**
 * Request human assistance for CAPTCHA solving
 * Sends request to palletAI backend and waits for resolution
 * @param {Object} captchaInfo - CAPTCHA information from CaptchaDetector
 * @param {string} captchaInfo.type - CAPTCHA type (e.g., 'recaptcha_v2_checkbox')
 * @param {string} captchaInfo.provider - CAPTCHA provider (e.g., 'google', 'hcaptcha')
 * @param {string} captchaInfo.siteKey - Site key if available
 * @param {string} captchaInfo.state - Current state (unsolved, challenge_visible, etc.)
 * @param {Object} captchaInfo.boundingBox - Element position
 * @param {string} captchaInfo.selector - CSS selector for the CAPTCHA element
 * @param {Object} options - Request options
 * @param {number} options.timeout - Timeout in ms (default: 300000 - 5 minutes)
 * @param {boolean} options.includeScreenshot - Include page screenshot (default: true)
 * @param {string} options.priority - Request priority ('high', 'normal', 'low')
 * @returns {Promise<Object>} - Resolution result with success status and any solution
 */
async function requestCaptchaHelp(captchaInfo, options = {}) {
  const {
    timeout = 300000,  // 5 minutes default
    includeScreenshot = true,
    priority = 'normal'
  } = options;

  // Validate captcha info
  if (!captchaInfo || typeof captchaInfo !== 'object') {
    throw new Error('captchaInfo object is required');
  }

  if (!captchaInfo.type) {
    throw new Error('captchaInfo.type is required');
  }

  // Generate unique request ID
  const requestId = `captcha_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Build request payload
  const request = {
    id: requestId,
    type: CallbackType.CAPTCHA_HELP,
    captcha: {
      type: captchaInfo.type,
      provider: captchaInfo.provider || 'unknown',
      siteKey: captchaInfo.siteKey || null,
      state: captchaInfo.state || 'unknown',
      selector: captchaInfo.selector || null,
      boundingBox: captchaInfo.boundingBox || null,
      challengeVisible: captchaInfo.challengeVisible || false,
      visible: captchaInfo.visible !== false
    },
    options: {
      priority,
      includeScreenshot,
      timeout
    },
    timestamp: Date.now(),
    status: 'pending'
  };

  // Store pending request
  const callbackPromise = createCallbackPromise(requestId, timeout);
  pendingCallbacks.set(requestId, {
    ...request,
    resolve: callbackPromise.resolve,
    reject: callbackPromise.reject
  });

  // Return the request info and promise
  return {
    requestId,
    request,
    promise: callbackPromise.promise,

    // Helper to cancel the request
    cancel: () => cancelCallback(requestId, 'Cancelled by caller')
  };
}

/**
 * Resolve a pending CAPTCHA help request
 * Called when human assistance has been provided
 * @param {string} requestId - Request ID to resolve
 * @param {Object} result - Resolution result
 * @param {boolean} result.success - Whether CAPTCHA was solved
 * @param {string} result.token - CAPTCHA response token if solved
 * @param {string} result.message - Human-readable status message
 * @returns {boolean} - Whether resolution was successful
 */
function resolveCaptchaHelp(requestId, result) {
  const pending = pendingCallbacks.get(requestId);
  if (!pending || pending.type !== CallbackType.CAPTCHA_HELP) {
    return false;
  }

  pending.resolve({
    success: result.success || false,
    token: result.token || null,
    message: result.message || 'CAPTCHA resolved',
    resolvedAt: Date.now(),
    duration: Date.now() - pending.timestamp
  });

  pendingCallbacks.delete(requestId);
  return true;
}

// =============================================================================
// Approval Request
// =============================================================================

/**
 * Request approval for sensitive actions before execution
 * @param {string} action - Action type (see ApprovalActionType)
 * @param {Object} details - Action details for approval decision
 * @param {string} details.description - Human-readable description
 * @param {Object} details.data - Action-specific data
 * @param {string} details.risk - Risk level ('low', 'medium', 'high', 'critical')
 * @param {Object} options - Request options
 * @param {number} options.timeout - Timeout in ms (default: 60000 - 1 minute)
 * @param {boolean} options.autoApproveOnTimeout - Auto-approve if timeout (default: false)
 * @param {boolean} options.requireReason - Require reason for denial (default: false)
 * @returns {Promise<Object>} - Approval result with decision and reason
 */
async function requestApproval(action, details, options = {}) {
  const {
    timeout = 60000,  // 1 minute default
    autoApproveOnTimeout = false,
    requireReason = false
  } = options;

  // Validate action
  if (!action || typeof action !== 'string') {
    throw new Error('action string is required');
  }

  // Validate details
  if (!details || typeof details !== 'object') {
    throw new Error('details object is required');
  }

  // Generate unique request ID
  const requestId = `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Build request payload
  const request = {
    id: requestId,
    type: CallbackType.APPROVAL,
    action,
    details: {
      description: details.description || `Approval requested for: ${action}`,
      data: details.data || {},
      risk: details.risk || 'medium',
      context: details.context || null
    },
    options: {
      timeout,
      autoApproveOnTimeout,
      requireReason
    },
    timestamp: Date.now(),
    status: 'pending'
  };

  // Create promise for this callback
  const callbackPromise = createCallbackPromise(requestId, timeout, () => {
    // Timeout handler
    if (autoApproveOnTimeout) {
      return {
        approved: true,
        reason: 'Auto-approved due to timeout',
        decidedAt: Date.now(),
        autoApproved: true
      };
    }
    throw new Error(`Approval request timed out after ${timeout}ms`);
  });

  // Store pending request
  pendingCallbacks.set(requestId, {
    ...request,
    resolve: callbackPromise.resolve,
    reject: callbackPromise.reject
  });

  // Return request info and promise
  return {
    requestId,
    request,
    promise: callbackPromise.promise,

    // Helper to cancel the request
    cancel: () => cancelCallback(requestId, 'Approval request cancelled')
  };
}

/**
 * Resolve a pending approval request
 * @param {string} requestId - Request ID to resolve
 * @param {boolean} approved - Whether action is approved
 * @param {string} reason - Reason for decision (required for denials if requireReason)
 * @param {Object} metadata - Additional metadata about the decision
 * @returns {boolean} - Whether resolution was successful
 */
function resolveApproval(requestId, approved, reason = null, metadata = {}) {
  const pending = pendingCallbacks.get(requestId);
  if (!pending || pending.type !== CallbackType.APPROVAL) {
    return false;
  }

  // Check if reason is required for denial
  if (!approved && pending.options.requireReason && !reason) {
    pending.reject(new Error('Reason is required for denial'));
    pendingCallbacks.delete(requestId);
    return true;
  }

  pending.resolve({
    approved,
    reason: reason || (approved ? 'Approved' : 'Denied'),
    decidedAt: Date.now(),
    duration: Date.now() - pending.timestamp,
    decidedBy: metadata.decidedBy || 'human',
    metadata
  });

  pendingCallbacks.delete(requestId);
  return true;
}

// =============================================================================
// Progress Reporting
// =============================================================================

/**
 * Report progress on long-running operations
 * @param {string} taskId - Unique task identifier
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} message - Status message
 * @param {Object} metadata - Additional progress metadata
 * @param {number} metadata.total - Total items to process
 * @param {number} metadata.completed - Items completed so far
 * @param {number} metadata.eta - Estimated time to completion in ms
 * @param {string} metadata.phase - Current phase of operation
 * @returns {Object} - Progress report object
 */
function reportProgress(taskId, progress, message = '', metadata = {}) {
  // Validate inputs
  if (!taskId || typeof taskId !== 'string') {
    throw new Error('taskId string is required');
  }

  if (typeof progress !== 'number' || progress < 0 || progress > 100) {
    throw new Error('progress must be a number between 0 and 100');
  }

  // Get or create progress tracker
  let tracker = progressTrackers.get(taskId);
  if (!tracker) {
    tracker = {
      taskId,
      startedAt: Date.now(),
      updates: [],
      lastProgress: 0,
      status: 'running'
    };
    progressTrackers.set(taskId, tracker);
  }

  // Build progress update
  const update = {
    progress: Math.round(progress * 100) / 100,  // Round to 2 decimal places
    message,
    timestamp: Date.now(),
    metadata: {
      total: metadata.total || null,
      completed: metadata.completed || null,
      eta: metadata.eta || null,
      phase: metadata.phase || null,
      ...metadata
    }
  };

  // Track update
  tracker.updates.push(update);
  tracker.lastProgress = update.progress;
  tracker.lastMessage = message;
  tracker.lastUpdatedAt = update.timestamp;

  // Limit stored updates to last 100
  if (tracker.updates.length > 100) {
    tracker.updates = tracker.updates.slice(-100);
  }

  // Update status based on progress
  if (progress >= 100) {
    tracker.status = 'completed';
    tracker.completedAt = Date.now();
  }

  // Build progress report
  const report = {
    taskId,
    progress: update.progress,
    message,
    status: tracker.status,
    startedAt: tracker.startedAt,
    lastUpdatedAt: update.timestamp,
    duration: update.timestamp - tracker.startedAt,
    updateCount: tracker.updates.length,
    metadata: update.metadata
  };

  return report;
}

/**
 * Get progress tracker for a task
 * @param {string} taskId - Task identifier
 * @returns {Object|null} - Progress tracker or null if not found
 */
function getProgress(taskId) {
  const tracker = progressTrackers.get(taskId);
  if (!tracker) {
    return null;
  }

  return {
    taskId: tracker.taskId,
    status: tracker.status,
    progress: tracker.lastProgress,
    message: tracker.lastMessage,
    startedAt: tracker.startedAt,
    lastUpdatedAt: tracker.lastUpdatedAt,
    completedAt: tracker.completedAt || null,
    duration: (tracker.completedAt || Date.now()) - tracker.startedAt,
    updates: tracker.updates
  };
}

/**
 * Clear progress tracker for a task
 * @param {string} taskId - Task identifier
 * @returns {boolean} - Whether tracker was cleared
 */
function clearProgress(taskId) {
  return progressTrackers.delete(taskId);
}

/**
 * Clean up old progress trackers (older than 30 minutes)
 */
function cleanupProgressTrackers() {
  const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;

  for (const [taskId, tracker] of progressTrackers.entries()) {
    const lastUpdate = tracker.completedAt || tracker.lastUpdatedAt || tracker.startedAt;
    if (lastUpdate < thirtyMinutesAgo) {
      progressTrackers.delete(taskId);
    }
  }
}

// =============================================================================
// Breakpoint Management
// =============================================================================

/**
 * Set a breakpoint that pauses execution
 * @param {Object} condition - Breakpoint condition
 * @param {string} condition.type - Condition type ('always', 'onError', 'onCondition')
 * @param {string} condition.expression - Condition expression (for 'onCondition' type)
 * @param {string} condition.description - Human-readable description
 * @param {Object} options - Breakpoint options
 * @param {boolean} options.oneTime - Remove after first hit (default: false)
 * @param {number} options.timeout - Auto-resume after timeout in ms (0 = no auto-resume)
 * @returns {Object} - Breakpoint info with ID and promise
 */
function setBreakpoint(condition = {}, options = {}) {
  const {
    oneTime = false,
    timeout = 0
  } = options;

  // Generate breakpoint ID
  const breakpointId = `bp_${Date.now()}_${++breakpointIdCounter}`;

  // Build breakpoint
  const breakpoint = {
    id: breakpointId,
    condition: {
      type: condition.type || 'always',
      expression: condition.expression || null,
      description: condition.description || 'Breakpoint'
    },
    options: {
      oneTime,
      timeout
    },
    state: BreakpointState.ACTIVE,
    createdAt: Date.now(),
    hitCount: 0,
    pausedAt: null,
    resumedAt: null,
    resolve: null,
    reject: null
  };

  breakpoints.set(breakpointId, breakpoint);

  return {
    breakpointId,
    breakpoint: {
      id: breakpoint.id,
      condition: breakpoint.condition,
      options: breakpoint.options,
      state: breakpoint.state,
      createdAt: breakpoint.createdAt
    },

    // Pause execution at this breakpoint
    pause: () => pauseAtBreakpoint(breakpointId),

    // Remove the breakpoint
    remove: () => removeBreakpoint(breakpointId)
  };
}

/**
 * Pause execution at a breakpoint
 * @param {string} breakpointId - Breakpoint ID
 * @returns {Promise<Object>} - Resume result when breakpoint is resumed
 */
function pauseAtBreakpoint(breakpointId) {
  const breakpoint = breakpoints.get(breakpointId);
  if (!breakpoint) {
    return Promise.reject(new Error(`Breakpoint not found: ${breakpointId}`));
  }

  if (breakpoint.state !== BreakpointState.ACTIVE) {
    return Promise.reject(new Error(`Breakpoint is not active: ${breakpoint.state}`));
  }

  breakpoint.state = BreakpointState.PAUSED;
  breakpoint.pausedAt = Date.now();
  breakpoint.hitCount++;

  // Create promise for resume
  return new Promise((resolve, reject) => {
    breakpoint.resolve = resolve;
    breakpoint.reject = reject;

    // Set up auto-resume if timeout specified
    if (breakpoint.options.timeout > 0) {
      breakpoint.timeoutId = setTimeout(() => {
        resumeFromBreakpoint(breakpointId, {
          reason: 'timeout',
          autoResumed: true
        });
      }, breakpoint.options.timeout);
    }
  });
}

/**
 * Resume execution from a paused breakpoint
 * @param {string} breakpointId - Breakpoint ID
 * @param {Object} data - Data to pass to resumed execution
 * @param {string} data.reason - Reason for resuming
 * @param {Object} data.context - Additional context data
 * @returns {Object} - Resume result
 */
function resumeFromBreakpoint(breakpointId, data = {}) {
  const breakpoint = breakpoints.get(breakpointId);
  if (!breakpoint) {
    return {
      success: false,
      error: `Breakpoint not found: ${breakpointId}`
    };
  }

  if (breakpoint.state !== BreakpointState.PAUSED) {
    return {
      success: false,
      error: `Breakpoint is not paused: ${breakpoint.state}`
    };
  }

  // Clear auto-resume timeout if set
  if (breakpoint.timeoutId) {
    clearTimeout(breakpoint.timeoutId);
    breakpoint.timeoutId = null;
  }

  breakpoint.state = BreakpointState.RESUMED;
  breakpoint.resumedAt = Date.now();

  // Resolve the pause promise
  if (breakpoint.resolve) {
    breakpoint.resolve({
      breakpointId,
      pausedAt: breakpoint.pausedAt,
      resumedAt: breakpoint.resumedAt,
      pauseDuration: breakpoint.resumedAt - breakpoint.pausedAt,
      reason: data.reason || 'manual',
      context: data.context || null,
      autoResumed: data.autoResumed || false
    });
  }

  // Remove if one-time breakpoint
  if (breakpoint.options.oneTime) {
    breakpoints.delete(breakpointId);
  } else {
    // Reset to active for next use
    breakpoint.state = BreakpointState.ACTIVE;
    breakpoint.pausedAt = null;
    breakpoint.resumedAt = null;
    breakpoint.resolve = null;
    breakpoint.reject = null;
  }

  return {
    success: true,
    breakpointId,
    hitCount: breakpoint.hitCount,
    removed: breakpoint.options.oneTime
  };
}

/**
 * Remove a breakpoint
 * @param {string} breakpointId - Breakpoint ID to remove
 * @returns {boolean} - Whether breakpoint was removed
 */
function removeBreakpoint(breakpointId) {
  const breakpoint = breakpoints.get(breakpointId);
  if (!breakpoint) {
    return false;
  }

  // Clear any pending timeout
  if (breakpoint.timeoutId) {
    clearTimeout(breakpoint.timeoutId);
  }

  // Reject if paused (to unblock any waiting code)
  if (breakpoint.state === BreakpointState.PAUSED && breakpoint.reject) {
    breakpoint.reject(new Error('Breakpoint was removed'));
  }

  breakpoints.delete(breakpointId);
  return true;
}

/**
 * Get all breakpoints
 * @returns {Array<Object>} - Array of breakpoint info
 */
function getBreakpoints() {
  const result = [];
  for (const [id, bp] of breakpoints.entries()) {
    result.push({
      id,
      condition: bp.condition,
      options: bp.options,
      state: bp.state,
      createdAt: bp.createdAt,
      hitCount: bp.hitCount,
      pausedAt: bp.pausedAt
    });
  }
  return result;
}

/**
 * Clear all breakpoints
 * @returns {number} - Number of breakpoints cleared
 */
function clearBreakpoints() {
  const count = breakpoints.size;

  // Clean up each breakpoint properly
  for (const breakpointId of breakpoints.keys()) {
    removeBreakpoint(breakpointId);
  }

  return count;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a callback promise with timeout handling
 * @param {string} requestId - Request ID for tracking
 * @param {number} timeout - Timeout in milliseconds
 * @param {Function} onTimeout - Optional handler returning value on timeout
 * @returns {Object} - Object with promise, resolve, and reject
 */
function createCallbackPromise(requestId, timeout, onTimeout = null) {
  let resolveFunc, rejectFunc, timeoutId;

  const promise = new Promise((resolve, reject) => {
    resolveFunc = resolve;
    rejectFunc = reject;

    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        const pending = pendingCallbacks.get(requestId);
        if (pending) {
          pendingCallbacks.delete(requestId);
          if (onTimeout) {
            try {
              resolve(onTimeout());
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error(`Request timed out after ${timeout}ms`));
          }
        }
      }, timeout);
    }
  });

  // Wrap resolve to clear timeout
  const resolve = (value) => {
    if (timeoutId) clearTimeout(timeoutId);
    resolveFunc(value);
  };

  // Wrap reject to clear timeout
  const reject = (error) => {
    if (timeoutId) clearTimeout(timeoutId);
    rejectFunc(error);
  };

  return { promise, resolve, reject };
}

/**
 * Cancel a pending callback
 * @param {string} requestId - Request ID to cancel
 * @param {string} reason - Cancellation reason
 * @returns {boolean} - Whether cancellation was successful
 */
function cancelCallback(requestId, reason = 'Cancelled') {
  const pending = pendingCallbacks.get(requestId);
  if (!pending) {
    return false;
  }

  pending.reject(new Error(reason));
  pendingCallbacks.delete(requestId);
  return true;
}

/**
 * Get all pending callbacks
 * @returns {Array<Object>} - Array of pending callback info
 */
function getPendingCallbacks() {
  const result = [];
  for (const [id, callback] of pendingCallbacks.entries()) {
    result.push({
      id,
      type: callback.type,
      status: callback.status,
      timestamp: callback.timestamp,
      age: Date.now() - callback.timestamp
    });
  }
  return result;
}

/**
 * Clean up old pending callbacks (older than 1 hour)
 */
function cleanupPendingCallbacks() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;

  for (const [requestId, callback] of pendingCallbacks.entries()) {
    if (callback.timestamp < oneHourAgo) {
      cancelCallback(requestId, 'Expired after 1 hour');
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.AgentCallbacks = {
    // Types
    CallbackType,
    ApprovalActionType,
    BreakpointState,

    // CAPTCHA help
    requestCaptchaHelp,
    resolveCaptchaHelp,

    // Approval
    requestApproval,
    resolveApproval,

    // Progress
    reportProgress,
    getProgress,
    clearProgress,
    cleanupProgressTrackers,

    // Breakpoints
    setBreakpoint,
    pauseAtBreakpoint,
    resumeFromBreakpoint,
    removeBreakpoint,
    getBreakpoints,
    clearBreakpoints,

    // Utility
    getPendingCallbacks,
    cancelCallback,
    cleanupPendingCallbacks
  };
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CallbackType,
    ApprovalActionType,
    BreakpointState,
    requestCaptchaHelp,
    resolveCaptchaHelp,
    requestApproval,
    resolveApproval,
    reportProgress,
    getProgress,
    clearProgress,
    cleanupProgressTrackers,
    setBreakpoint,
    pauseAtBreakpoint,
    resumeFromBreakpoint,
    removeBreakpoint,
    getBreakpoints,
    clearBreakpoints,
    getPendingCallbacks,
    cancelCallback,
    cleanupPendingCallbacks
  };
}
