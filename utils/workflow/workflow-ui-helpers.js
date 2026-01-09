/**
 * Basset Hound Browser Automation - Workflow UI Helpers
 *
 * Utility functions for workflow UI components in the DevTools panel.
 * Handles workflow rendering, validation, and data formatting.
 *
 * @module utils/workflow/workflow-ui-helpers
 */

// =============================================================================
// Step Type Definitions & Icons
// =============================================================================

/**
 * Step type icons and metadata
 */
const STEP_TYPES = {
  navigate: {
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 16 16 12 12 8"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>`,
    label: 'Navigate',
    color: '#75beff',
    description: 'Navigate to a URL'
  },
  click: {
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>`,
    label: 'Click',
    color: '#73c991',
    description: 'Click an element'
  },
  fill: {
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M17 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10z"/>
      <line x1="9" y1="9" x2="15" y2="9"/>
      <line x1="9" y1="13" x2="15" y2="13"/>
    </svg>`,
    label: 'Fill',
    color: '#9cdcfe',
    description: 'Fill a form field'
  },
  extract: {
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>`,
    label: 'Extract',
    color: '#f7931a',
    description: 'Extract data from page'
  },
  detect: {
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.35-4.35"/>
    </svg>`,
    label: 'Detect',
    color: '#627eea',
    description: 'Detect OSINT patterns'
  },
  wait: {
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>`,
    label: 'Wait',
    color: '#cca700',
    description: 'Wait for element or time'
  },
  screenshot: {
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>`,
    label: 'Screenshot',
    color: '#ce9178',
    description: 'Take a screenshot'
  },
  condition: {
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M5 12h14"/>
      <path d="M12 5l7 7-7 7"/>
    </svg>`,
    label: 'If/Else',
    color: '#dcdcaa',
    description: 'Conditional logic'
  },
  loop: {
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
    </svg>`,
    label: 'Loop',
    color: '#c586c0',
    description: 'Loop over items'
  }
};

/**
 * Get step type metadata
 * @param {string} type - Step type
 * @returns {Object} Step metadata
 */
function getStepTypeInfo(type) {
  return STEP_TYPES[type] || {
    icon: '<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/></svg>',
    label: type,
    color: '#969696',
    description: 'Unknown step type'
  };
}

// =============================================================================
// Workflow Rendering
// =============================================================================

/**
 * Render a workflow card for the library
 * @param {Object} workflow - Workflow definition
 * @returns {string} HTML string
 */
function renderWorkflowCard(workflow) {
  const stepCount = workflow.steps?.length || 0;
  const category = workflow.category || 'custom';

  return `
    <div class="workflow-card" data-workflow-id="${workflow.id}">
      <div class="workflow-card-header">
        <div>
          <div class="workflow-card-title">${escapeHtml(workflow.name)}</div>
        </div>
        <span class="workflow-card-category">${escapeHtml(category)}</span>
      </div>
      <div class="workflow-card-description">
        ${escapeHtml(workflow.description || 'No description')}
      </div>
      <div class="workflow-card-meta">
        <div class="workflow-card-steps">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          </svg>
          <span>${stepCount} steps</span>
        </div>
        <div class="workflow-card-version">v${workflow.version || '1.0.0'}</div>
      </div>
      <div class="workflow-card-actions">
        <button class="btn btn-sm workflow-edit-btn" data-workflow-id="${workflow.id}">Edit</button>
        <button class="btn btn-sm btn-primary workflow-execute-btn" data-workflow-id="${workflow.id}">Execute</button>
      </div>
    </div>
  `;
}

/**
 * Render a workflow step item for the builder
 * @param {Object} step - Step definition
 * @param {number} index - Step index
 * @returns {string} HTML string
 */
function renderWorkflowStepItem(step, index) {
  const stepInfo = getStepTypeInfo(step.type);
  const label = step.label || step.name || stepInfo.label;
  const details = getStepDetailsText(step);

  return `
    <div class="workflow-step-item" data-step-index="${index}" data-step-id="${step.id}">
      <div class="workflow-step-number">${index + 1}</div>
      <div class="workflow-step-icon" style="color: ${stepInfo.color}">
        ${stepInfo.icon}
      </div>
      <div class="workflow-step-content">
        <div class="workflow-step-type">${stepInfo.label}</div>
        <div class="workflow-step-label">${escapeHtml(label)}</div>
        ${details ? `<div class="workflow-step-details">${escapeHtml(details)}</div>` : ''}
      </div>
      <div class="workflow-step-actions">
        <button class="workflow-step-action-btn step-move-up" title="Move up">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </button>
        <button class="workflow-step-action-btn step-move-down" title="Move down">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <button class="workflow-step-action-btn step-delete" title="Delete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Get step details text for display
 * @param {Object} step - Step definition
 * @returns {string} Details text
 */
function getStepDetailsText(step) {
  switch (step.type) {
    case 'navigate':
      return step.url ? `URL: ${step.url}` : '';
    case 'click':
    case 'fill':
      return step.selector ? `Selector: ${step.selector}` : '';
    case 'extract':
      return step.selector ? `Extract: ${step.selector}` : '';
    case 'detect':
      return 'Detect OSINT patterns';
    case 'wait':
      return step.selector ? `Wait for: ${step.selector}` : `Wait: ${step.duration || 1000}ms`;
    case 'screenshot':
      return step.fullPage ? 'Full page screenshot' : 'Viewport screenshot';
    case 'condition':
      return step.condition ? `If: ${step.condition}` : 'Conditional';
    case 'loop':
      return step.items ? `Loop: ${step.items}` : 'Loop';
    default:
      return '';
  }
}

/**
 * Render step configuration form
 * @param {Object} step - Step definition
 * @returns {string} HTML string
 */
function renderStepConfigForm(step) {
  const stepInfo = getStepTypeInfo(step.type);

  let formHtml = `
    <div class="step-config-header">
      <div class="step-config-icon" style="color: ${stepInfo.color}">${stepInfo.icon}</div>
      <div class="step-config-title">${stepInfo.label}</div>
    </div>
    <div class="step-config-form">
      <div class="form-group">
        <label class="form-label">Step Label</label>
        <input type="text" class="form-input" name="label" value="${escapeHtml(step.label || '')}" placeholder="Custom label (optional)">
        <span class="form-help">Optional: Give this step a descriptive name</span>
      </div>
  `;

  // Add type-specific fields
  switch (step.type) {
    case 'navigate':
      formHtml += `
        <div class="form-group">
          <label class="form-label">
            URL <span class="form-label-required">*</span>
          </label>
          <input type="text" class="form-input" name="url" value="${escapeHtml(step.url || '')}" placeholder="https://example.com" required>
          <span class="form-help">The URL to navigate to</span>
        </div>
        <div class="form-group">
          <label class="form-label">Wait Until</label>
          <select class="form-select" name="waitUntil">
            <option value="load" ${step.waitUntil === 'load' ? 'selected' : ''}>Page Load</option>
            <option value="domcontentloaded" ${step.waitUntil === 'domcontentloaded' ? 'selected' : ''}>DOM Ready</option>
            <option value="networkidle" ${step.waitUntil === 'networkidle' ? 'selected' : ''}>Network Idle</option>
          </select>
        </div>
      `;
      break;

    case 'click':
      formHtml += `
        <div class="form-group">
          <label class="form-label">
            CSS Selector <span class="form-label-required">*</span>
          </label>
          <input type="text" class="form-input" name="selector" value="${escapeHtml(step.selector || '')}" placeholder="#submit-btn" required>
          <span class="form-help">CSS selector of element to click</span>
        </div>
        <div class="form-group">
          <div class="form-checkbox-wrapper">
            <input type="checkbox" class="form-checkbox" name="waitForNavigation" ${step.waitForNavigation ? 'checked' : ''}>
            <label class="form-label">Wait for navigation</label>
          </div>
        </div>
      `;
      break;

    case 'fill':
      formHtml += `
        <div class="form-group">
          <label class="form-label">
            CSS Selector <span class="form-label-required">*</span>
          </label>
          <input type="text" class="form-input" name="selector" value="${escapeHtml(step.selector || '')}" placeholder="input[name='username']" required>
        </div>
        <div class="form-group">
          <label class="form-label">
            Text Value <span class="form-label-required">*</span>
          </label>
          <input type="text" class="form-input" name="text" value="${escapeHtml(step.text || '')}" placeholder="Text to type" required>
          <span class="form-help">Use {{variableName}} for variables</span>
        </div>
        <div class="form-group">
          <label class="form-label">Typing Delay (ms)</label>
          <input type="number" class="form-input" name="delay" value="${step.delay || 50}" min="0" max="1000">
        </div>
      `;
      break;

    case 'extract':
      formHtml += `
        <div class="form-group">
          <label class="form-label">
            CSS Selector <span class="form-label-required">*</span>
          </label>
          <input type="text" class="form-input" name="selector" value="${escapeHtml(step.selector || '')}" placeholder=".data-row" required>
        </div>
        <div class="form-group">
          <label class="form-label">Extract Attribute</label>
          <input type="text" class="form-input" name="attribute" value="${escapeHtml(step.attribute || 'textContent')}" placeholder="textContent">
          <span class="form-help">Leave empty for textContent</span>
        </div>
        <div class="form-group">
          <label class="form-label">Save to Variable</label>
          <input type="text" class="form-input" name="saveAs" value="${escapeHtml(step.saveAs || '')}" placeholder="extractedData">
        </div>
        <div class="form-group">
          <div class="form-checkbox-wrapper">
            <input type="checkbox" class="form-checkbox" name="multiple" ${step.multiple ? 'checked' : ''}>
            <label class="form-label">Extract multiple elements</label>
          </div>
        </div>
      `;
      break;

    case 'detect':
      formHtml += `
        <div class="form-group">
          <label class="form-label">Pattern Types</label>
          <div class="form-checkbox-wrapper">
            <input type="checkbox" class="form-checkbox" name="detectEmail" ${step.detectEmail !== false ? 'checked' : ''}>
            <label class="form-label">Email</label>
          </div>
          <div class="form-checkbox-wrapper">
            <input type="checkbox" class="form-checkbox" name="detectPhone" ${step.detectPhone !== false ? 'checked' : ''}>
            <label class="form-label">Phone</label>
          </div>
          <div class="form-checkbox-wrapper">
            <input type="checkbox" class="form-checkbox" name="detectCrypto" ${step.detectCrypto !== false ? 'checked' : ''}>
            <label class="form-label">Cryptocurrency</label>
          </div>
          <div class="form-checkbox-wrapper">
            <input type="checkbox" class="form-checkbox" name="detectDomain" ${step.detectDomain !== false ? 'checked' : ''}>
            <label class="form-label">Domain</label>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Save to Variable</label>
          <input type="text" class="form-input" name="saveAs" value="${escapeHtml(step.saveAs || 'detections')}" placeholder="detections">
        </div>
      `;
      break;

    case 'wait':
      formHtml += `
        <div class="form-group">
          <label class="form-label">Wait Type</label>
          <select class="form-select" name="waitType">
            <option value="time" ${step.waitType === 'time' || !step.waitType ? 'selected' : ''}>Time Duration</option>
            <option value="selector" ${step.waitType === 'selector' ? 'selected' : ''}>Element Selector</option>
          </select>
        </div>
        <div class="form-group" id="waitDurationGroup" ${step.waitType === 'selector' ? 'style="display:none"' : ''}>
          <label class="form-label">Duration (ms)</label>
          <input type="number" class="form-input" name="duration" value="${step.duration || 1000}" min="100" max="60000">
        </div>
        <div class="form-group" id="waitSelectorGroup" ${step.waitType === 'selector' ? '' : 'style="display:none"'}>
          <label class="form-label">CSS Selector</label>
          <input type="text" class="form-input" name="selector" value="${escapeHtml(step.selector || '')}" placeholder=".loading-complete">
        </div>
        <div class="form-group">
          <label class="form-label">Timeout (ms)</label>
          <input type="number" class="form-input" name="timeout" value="${step.timeout || 30000}" min="1000" max="120000">
        </div>
      `;
      break;

    case 'screenshot':
      formHtml += `
        <div class="form-group">
          <div class="form-checkbox-wrapper">
            <input type="checkbox" class="form-checkbox" name="fullPage" ${step.fullPage ? 'checked' : ''}>
            <label class="form-label">Full page screenshot</label>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Save to Variable</label>
          <input type="text" class="form-input" name="saveAs" value="${escapeHtml(step.saveAs || 'screenshot')}" placeholder="screenshot">
        </div>
      `;
      break;

    case 'condition':
      formHtml += `
        <div class="form-group">
          <label class="form-label">
            Condition <span class="form-label-required">*</span>
          </label>
          <textarea class="form-textarea" name="condition" required>${escapeHtml(step.condition || '')}</textarea>
          <span class="form-help">JavaScript expression, e.g., {{username}} === 'admin'</span>
        </div>
      `;
      break;

    case 'loop':
      formHtml += `
        <div class="form-group">
          <label class="form-label">
            Items <span class="form-label-required">*</span>
          </label>
          <input type="text" class="form-input" name="items" value="${escapeHtml(step.items || '')}" placeholder="{{arrayVariable}}" required>
          <span class="form-help">Variable containing array to loop over</span>
        </div>
        <div class="form-group">
          <label class="form-label">Item Variable Name</label>
          <input type="text" class="form-input" name="itemVar" value="${escapeHtml(step.itemVar || 'item')}" placeholder="item">
        </div>
      `;
      break;
  }

  formHtml += `
    </div>
  `;

  return formHtml;
}

// =============================================================================
// Execution Rendering
// =============================================================================

/**
 * Render execution step item for monitor
 * @param {Object} step - Step definition
 * @param {Object} execution - Execution state
 * @param {number} index - Step index
 * @returns {string} HTML string
 */
function renderExecutionStepItem(step, execution, index) {
  const stepInfo = getStepTypeInfo(step.type);
  const status = execution.status || 'pending';
  const label = step.label || step.name || stepInfo.label;

  let statusIcon = '';
  switch (status) {
    case 'running':
      statusIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
      break;
    case 'completed':
      statusIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
      break;
    case 'failed':
      statusIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      break;
    default:
      statusIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
  }

  const timeText = execution.startTime ? formatDuration(Date.now() - execution.startTime) : '--';
  const errorHtml = execution.error ? `<div class="execution-step-error">${escapeHtml(execution.error)}</div>` : '';

  return `
    <div class="execution-step-item ${status}">
      <div class="execution-step-status-icon ${status}">
        ${statusIcon}
      </div>
      <div class="execution-step-info">
        <div class="execution-step-name">${index + 1}. ${escapeHtml(label)}</div>
        <div class="execution-step-time">${timeText}</div>
        ${errorHtml}
      </div>
    </div>
  `;
}

/**
 * Render variable item for monitor
 * @param {string} name - Variable name
 * @param {*} value - Variable value
 * @returns {string} HTML string
 */
function renderVariableItem(name, value) {
  const valueStr = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
  return `
    <div class="variable-item">
      <div class="variable-name">${escapeHtml(name)}</div>
      <div class="variable-value">${escapeHtml(truncateText(valueStr, 200))}</div>
    </div>
  `;
}

/**
 * Render workflow log entry
 * @param {Object} log - Log entry
 * @returns {string} HTML string
 */
function renderWorkflowLogEntry(log) {
  const timeStr = formatTime(log.timestamp);
  const stepText = log.stepIndex !== undefined ? `[Step ${log.stepIndex + 1}]` : '';

  return `
    <div class="workflow-log-entry">
      <div class="workflow-log-time">${timeStr}</div>
      <div class="workflow-log-level ${log.level}">[${log.level.toUpperCase()}]</div>
      ${stepText ? `<div class="workflow-log-step">${stepText}</div>` : ''}
      <div class="workflow-log-message">${escapeHtml(log.message)}</div>
    </div>
  `;
}

// =============================================================================
// Workflow Validation
// =============================================================================

/**
 * Validate workflow definition
 * @param {Object} workflow - Workflow to validate
 * @returns {Object} Validation result with {valid: boolean, errors: string[]}
 */
function validateWorkflow(workflow) {
  const errors = [];

  if (!workflow.id) {
    errors.push('Workflow must have an ID');
  }

  if (!workflow.name || workflow.name.trim() === '') {
    errors.push('Workflow must have a name');
  }

  if (!workflow.version) {
    errors.push('Workflow must have a version');
  }

  if (!workflow.steps || !Array.isArray(workflow.steps)) {
    errors.push('Workflow must have a steps array');
  } else if (workflow.steps.length === 0) {
    errors.push('Workflow must have at least one step');
  } else {
    // Validate each step
    workflow.steps.forEach((step, index) => {
      const stepErrors = validateStep(step, index);
      errors.push(...stepErrors);
    });
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Validate individual step
 * @param {Object} step - Step to validate
 * @param {number} index - Step index
 * @returns {string[]} Array of error messages
 */
function validateStep(step, index) {
  const errors = [];
  const prefix = `Step ${index + 1}:`;

  if (!step.type) {
    errors.push(`${prefix} Missing step type`);
    return errors;
  }

  if (!step.id) {
    errors.push(`${prefix} Missing step ID`);
  }

  // Type-specific validation
  switch (step.type) {
    case 'navigate':
      if (!step.url) {
        errors.push(`${prefix} Navigate step must have a URL`);
      }
      break;

    case 'click':
    case 'fill':
      if (!step.selector) {
        errors.push(`${prefix} ${step.type} step must have a selector`);
      }
      if (step.type === 'fill' && !step.text) {
        errors.push(`${prefix} Fill step must have text value`);
      }
      break;

    case 'extract':
      if (!step.selector) {
        errors.push(`${prefix} Extract step must have a selector`);
      }
      break;

    case 'condition':
      if (!step.condition) {
        errors.push(`${prefix} Condition step must have a condition`);
      }
      break;

    case 'loop':
      if (!step.items) {
        errors.push(`${prefix} Loop step must have items`);
      }
      break;
  }

  return errors;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format timestamp to readable time
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted time string
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  });
}

/**
 * Format duration in milliseconds to readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  } else if (minutes > 0) {
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Truncate text to maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Generate unique ID for workflow or step
 * @returns {string} Unique ID
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate UUID v4
 * @returns {string} UUID
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Deep clone an object
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Extract variables from text (e.g., {{username}})
 * @param {string} text - Text to parse
 * @returns {string[]} Array of variable names
 */
function extractVariables(text) {
  const regex = /\{\{([^}]+)\}\}/g;
  const variables = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    variables.push(match[1].trim());
  }

  return variables;
}

// =============================================================================
// Exports
// =============================================================================

// Export functions for use in DevTools panel
if (typeof module !== 'undefined' && module.exports) {
  // Node.js / CommonJS
  module.exports = {
    STEP_TYPES,
    getStepTypeInfo,
    renderWorkflowCard,
    renderWorkflowStepItem,
    renderStepConfigForm,
    renderExecutionStepItem,
    renderVariableItem,
    renderWorkflowLogEntry,
    validateWorkflow,
    validateStep,
    escapeHtml,
    formatTime,
    formatDuration,
    truncateText,
    generateId,
    generateUUID,
    deepClone,
    extractVariables
  };
}
