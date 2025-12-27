/**
 * Basset Hound Browser Automation - Popup Script
 *
 * Manages the extension popup UI:
 * - Connection status display
 * - Manual connect/disconnect controls
 * - Task queue display
 */

// =============================================================================
// DOM Elements
// =============================================================================

const elements = {
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  statusDetails: document.getElementById('statusDetails'),
  connectBtn: document.getElementById('connectBtn'),
  disconnectBtn: document.getElementById('disconnectBtn'),
  taskList: document.getElementById('taskList'),
  taskCount: document.getElementById('taskCount'),
  clearTasksBtn: document.getElementById('clearTasksBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  viewLogsLink: document.getElementById('viewLogsLink')
};

/**
 * Verify all required DOM elements are present
 * @returns {boolean} - True if all elements are found
 */
function verifyElements() {
  const requiredElements = ['statusDot', 'statusText', 'statusDetails', 'connectBtn',
                           'disconnectBtn', 'taskList', 'taskCount'];

  for (const elementName of requiredElements) {
    if (!elements[elementName]) {
      console.error(`Required element not found: ${elementName}`);
      return false;
    }
  }
  return true;
}

// =============================================================================
// State
// =============================================================================

let currentStatus = 'unknown';
let tasks = [];

// =============================================================================
// Status Display
// =============================================================================

/**
 * Update the connection status display
 * @param {string} status - Connection status
 * @param {Object} data - Additional status data
 */
function updateStatusDisplay(status, data = {}) {
  currentStatus = status;

  // Guard against missing elements
  if (!elements.statusDot || !elements.statusText || !elements.statusDetails) {
    console.error('Status display elements not found');
    return;
  }

  // Update status dot class
  elements.statusDot.className = 'status-dot ' + status;

  // Update status text
  const statusTexts = {
    connected: 'Connected',
    connecting: 'Connecting...',
    reconnecting: 'Reconnecting...',
    disconnected: 'Disconnected',
    failed: 'Connection Failed',
    unknown: 'Unknown'
  };
  elements.statusText.textContent = statusTexts[status] || status;

  // Update status details
  let details = '';
  switch (status) {
    case 'connected':
      details = 'Successfully connected to Basset Hound backend.';
      break;
    case 'connecting':
      details = 'Attempting to establish connection...';
      break;
    case 'reconnecting':
      details = `Reconnection attempt ${data.attempt || '?'}. Next retry in ${Math.round((data.delay || 0) / 1000)}s.`;
      break;
    case 'disconnected':
      details = 'Not connected to backend. Click Connect to establish connection.';
      break;
    case 'failed':
      details = 'Maximum reconnection attempts reached. Click Connect to try again.';
      break;
    default:
      details = 'Checking connection status...';
  }
  elements.statusDetails.textContent = details;

  // Update button states
  updateButtonStates(status);
}

/**
 * Update button enabled/disabled states based on connection status
 * @param {string} status - Connection status
 */
function updateButtonStates(status) {
  // Guard against missing elements
  if (!elements.connectBtn || !elements.disconnectBtn) {
    return;
  }

  switch (status) {
    case 'connected':
      elements.connectBtn.disabled = true;
      elements.disconnectBtn.disabled = false;
      break;
    case 'connecting':
    case 'reconnecting':
      elements.connectBtn.disabled = true;
      elements.disconnectBtn.disabled = false;
      break;
    case 'disconnected':
    case 'failed':
      elements.connectBtn.disabled = false;
      elements.disconnectBtn.disabled = true;
      break;
    default:
      elements.connectBtn.disabled = false;
      elements.disconnectBtn.disabled = false;
  }
}

// =============================================================================
// Task Display
// =============================================================================

/**
 * Update the task queue display
 * @param {Array} taskList - Array of task objects
 */
function updateTaskDisplay(taskList) {
  tasks = taskList || [];

  // Guard against missing elements
  if (!elements.taskCount || !elements.taskList) {
    return;
  }

  // Update task count
  const runningTasks = tasks.filter(t => t.status === 'running').length;
  elements.taskCount.textContent = runningTasks > 0
    ? `${runningTasks} running / ${tasks.length} total`
    : `${tasks.length} tasks`;

  // Build task list HTML
  if (tasks.length === 0) {
    elements.taskList.innerHTML = '<div class="no-tasks">No tasks in queue</div>';
    return;
  }

  // Sort tasks: running first, then by start time (newest first)
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.status === 'running' && b.status !== 'running') return -1;
    if (b.status === 'running' && a.status !== 'running') return 1;
    return (b.startTime || 0) - (a.startTime || 0);
  });

  elements.taskList.innerHTML = sortedTasks.map(task => {
    const icon = getStatusIcon(task.status);
    const time = formatTime(task.startTime);
    const duration = task.endTime
      ? ` (${((task.endTime - task.startTime) / 1000).toFixed(1)}s)`
      : '';

    return `
      <div class="task-item">
        <div class="task-status-icon ${task.status}">${icon}</div>
        <div class="task-info">
          <div class="task-type">${escapeHtml(task.type)}</div>
          <div class="task-time">${time}${duration}</div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Get status icon for task
 * @param {string} status - Task status
 * @returns {string} - Icon HTML
 */
function getStatusIcon(status) {
  switch (status) {
    case 'running':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
    case 'completed':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
    case 'failed':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    default:
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
  }
}

/**
 * Format timestamp for display
 * @param {number} timestamp - Timestamp in milliseconds
 * @returns {string} - Formatted time string
 */
function formatTime(timestamp) {
  if (!timestamp) return 'Unknown time';

  const date = new Date(timestamp);
  const now = new Date();

  // If today, show time only
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  // Otherwise show date and time
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// =============================================================================
// Communication with Background Script
// =============================================================================

/**
 * Get current status from background script
 */
function fetchStatus() {
  chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error getting status:', chrome.runtime.lastError);
      updateStatusDisplay('disconnected');
      return;
    }

    if (response) {
      updateStatusDisplay(response.connectionState || 'unknown');
    }
  });
}

/**
 * Get task list from background script
 */
function fetchTasks() {
  chrome.runtime.sendMessage({ type: 'get_tasks' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error getting tasks:', chrome.runtime.lastError);
      return;
    }

    if (response && response.tasks) {
      updateTaskDisplay(response.tasks);
    }
  });
}

/**
 * Request connection to WebSocket server
 */
function requestConnect() {
  updateStatusDisplay('connecting');

  chrome.runtime.sendMessage({ type: 'connect' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error requesting connect:', chrome.runtime.lastError);
      updateStatusDisplay('failed');
    }
  });
}

/**
 * Request disconnection from WebSocket server
 */
function requestDisconnect() {
  chrome.runtime.sendMessage({ type: 'disconnect' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error requesting disconnect:', chrome.runtime.lastError);
    }
    updateStatusDisplay('disconnected');
  });
}

/**
 * Clear task history
 */
function clearTasks() {
  chrome.runtime.sendMessage({ type: 'clear_tasks' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error clearing tasks:', chrome.runtime.lastError);
      return;
    }
    updateTaskDisplay([]);
  });
}

// =============================================================================
// Message Listener for Real-time Updates
// =============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'connection_status':
      updateStatusDisplay(message.status, message.data);
      break;

    case 'task_update':
      updateTaskDisplay(message.tasks);
      break;
  }
});

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize popup
 */
function init() {
  // Verify all required DOM elements are present
  if (!verifyElements()) {
    console.error('Popup initialization failed: missing required elements');
    return;
  }

  // Load initial status from storage
  chrome.storage.local.get(['connectionStatus', 'connectionData', 'taskQueue'], (result) => {
    if (result.connectionStatus) {
      updateStatusDisplay(result.connectionStatus, result.connectionData || {});
    }
    if (result.taskQueue) {
      updateTaskDisplay(result.taskQueue);
    }
  });

  // Fetch current status from background
  fetchStatus();
  fetchTasks();
}

// Attach event listeners only if elements exist
if (elements.connectBtn) {
  elements.connectBtn.addEventListener('click', () => {
    requestConnect();
  });
}

if (elements.disconnectBtn) {
  elements.disconnectBtn.addEventListener('click', () => {
    requestDisconnect();
  });
}

if (elements.clearTasksBtn) {
  elements.clearTasksBtn.addEventListener('click', () => {
    clearTasks();
  });
}

if (elements.refreshBtn) {
  elements.refreshBtn.addEventListener('click', () => {
    fetchStatus();
    fetchTasks();
  });
}

if (elements.viewLogsLink) {
  elements.viewLogsLink.addEventListener('click', (e) => {
    e.preventDefault();
    // Open extension's internal page or developer tools
    chrome.tabs.create({
      url: 'chrome://extensions/?id=' + chrome.runtime.id
    });
  });
}

// Run initialization
init();
