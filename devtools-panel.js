/**
 * Basset Hound Browser Automation - DevTools Panel Logic
 *
 * Manages the DevTools panel UI and communication with the background script.
 * Provides network monitoring, command execution, task tracking, and audit logging.
 */

// =============================================================================
// Constants & Configuration
// =============================================================================

const REFRESH_INTERVAL = 1000; // 1 second
const MAX_NETWORK_REQUESTS = 500;
const MAX_AUDIT_LOGS = 1000;
const MAX_CONSOLE_ENTRIES = 500;
const MAX_COMMAND_HISTORY = 100;

// Command templates
const COMMAND_TEMPLATES = {
  navigate: {
    type: 'navigate',
    url: 'https://example.com'
  },
  click: {
    type: 'click',
    selector: '#element-id',
    wait_for_navigation: true
  },
  type: {
    type: 'type',
    selector: 'input[name="username"]',
    text: 'example text',
    delay: 100
  },
  extract: {
    type: 'extract',
    selector: '.data-element',
    attribute: 'textContent'
  },
  screenshot: {
    type: 'screenshot',
    fullPage: false
  },
  wait: {
    type: 'wait',
    selector: '.loading-spinner',
    timeout: 5000
  }
};

// =============================================================================
// State Management
// =============================================================================

const state = {
  connectionStatus: 'disconnected',
  networkRequests: [],
  tasks: [],
  auditLogs: [],
  consoleEntries: [],
  commandHistory: [],
  selectedNetworkRequest: null,
  startTime: Date.now(),
  lastUpdate: null,
  activeTab: 'overview'
};

// =============================================================================
// DOM Elements
// =============================================================================

const elements = {
  // Header
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  connectBtn: document.getElementById('connectBtn'),
  disconnectBtn: document.getElementById('disconnectBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  refreshBtn: document.getElementById('refreshBtn'),

  // Navigation
  navTabs: document.querySelectorAll('.nav-tab'),
  tabContents: document.querySelectorAll('.tab-content'),
  networkBadge: document.getElementById('networkBadge'),
  taskBadge: document.getElementById('taskBadge'),

  // Overview
  overviewStatus: document.getElementById('overviewStatus'),
  overviewNetworkCount: document.getElementById('overviewNetworkCount'),
  overviewTaskCount: document.getElementById('overviewTaskCount'),
  overviewUptime: document.getElementById('overviewUptime'),
  wsUrl: document.getElementById('wsUrl'),
  wsState: document.getElementById('wsState'),
  reconnectAttempts: document.getElementById('reconnectAttempts'),
  lastMessage: document.getElementById('lastMessage'),
  recentActivity: document.getElementById('recentActivity'),
  exportStatusBtn: document.getElementById('exportStatusBtn'),

  // Network
  networkFilter: document.getElementById('networkFilter'),
  networkMethodFilter: document.getElementById('networkMethodFilter'),
  networkStatusFilter: document.getElementById('networkStatusFilter'),
  networkTableBody: document.getElementById('networkTableBody'),
  networkDetail: document.getElementById('networkDetail'),
  clearNetworkBtn: document.getElementById('clearNetworkBtn'),
  exportNetworkBtn: document.getElementById('exportNetworkBtn'),

  // Commands
  commandInput: document.getElementById('commandInput'),
  executeCommandBtn: document.getElementById('executeCommandBtn'),
  formatCommandBtn: document.getElementById('formatCommandBtn'),
  commandHistory: document.getElementById('commandHistory'),
  clearCommandsBtn: document.getElementById('clearCommandsBtn'),
  templateBtns: document.querySelectorAll('.template-btn'),

  // Tasks
  taskList: document.getElementById('taskList'),
  clearTasksBtn: document.getElementById('clearTasksBtn'),

  // Audit
  auditFilter: document.getElementById('auditFilter'),
  auditLevelFilter: document.getElementById('auditLevelFilter'),
  auditLog: document.getElementById('auditLog'),
  clearAuditBtn: document.getElementById('clearAuditBtn'),
  exportAuditBtn: document.getElementById('exportAuditBtn'),

  // Console
  consoleOutput: document.getElementById('consoleOutput'),
  consoleInput: document.getElementById('consoleInput'),
  executeConsoleBtn: document.getElementById('executeConsoleBtn'),
  clearConsoleBtn: document.getElementById('clearConsoleBtn')
};

// =============================================================================
// Tab Navigation
// =============================================================================

function setupTabNavigation() {
  elements.navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchTab(tabName);
    });
  });
}

function switchTab(tabName) {
  // Update active nav tab
  elements.navTabs.forEach(tab => {
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Update active content
  elements.tabContents.forEach(content => {
    if (content.id === `${tabName}-tab`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });

  state.activeTab = tabName;
  addAuditLog('info', `Switched to ${tabName} tab`);
}

// =============================================================================
// Connection Management
// =============================================================================

function updateConnectionStatus(status, data = {}) {
  state.connectionStatus = status;
  state.lastUpdate = Date.now();

  // Update status indicator
  elements.statusDot.className = 'status-dot ' + status;

  const statusTexts = {
    connected: 'Connected',
    connecting: 'Connecting...',
    disconnected: 'Disconnected',
    error: 'Error'
  };

  elements.statusText.textContent = statusTexts[status] || status;
  elements.overviewStatus.textContent = statusTexts[status] || status;

  // Update buttons
  if (status === 'connected') {
    elements.connectBtn.disabled = true;
    elements.disconnectBtn.disabled = false;
  } else {
    elements.connectBtn.disabled = false;
    elements.disconnectBtn.disabled = status === 'connecting';
  }

  // Update connection details
  if (data.url) {
    elements.wsUrl.textContent = data.url;
  }
  elements.wsState.textContent = status;
  if (data.reconnectAttempts !== undefined) {
    elements.reconnectAttempts.textContent = data.reconnectAttempts;
  }

  addRecentActivity(`Connection status: ${statusTexts[status] || status}`);
  addAuditLog('info', `Connection status changed to: ${status}`);
}

elements.connectBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'connect' });
  updateConnectionStatus('connecting');
  addAuditLog('info', 'Manual connection requested');
});

elements.disconnectBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'disconnect' });
  updateConnectionStatus('disconnected');
  addAuditLog('info', 'Manual disconnection requested');
});

elements.refreshBtn.addEventListener('click', () => {
  fetchAllData();
  addAuditLog('info', 'Manual refresh triggered');
});

// =============================================================================
// Overview Tab
// =============================================================================

function updateOverviewMetrics() {
  // Network count
  elements.overviewNetworkCount.textContent = state.networkRequests.length;

  // Task count
  const activeTasks = state.tasks.filter(t => t.status === 'running').length;
  elements.overviewTaskCount.textContent = activeTasks;

  // Uptime
  const uptime = Date.now() - state.startTime;
  elements.overviewUptime.textContent = formatDuration(uptime);
}

function addRecentActivity(message) {
  const activity = {
    timestamp: Date.now(),
    message: message
  };

  const activityHtml = `
    <div class="activity-item">
      <div class="activity-time">${formatTime(activity.timestamp)}</div>
      <div class="activity-message">${escapeHtml(activity.message)}</div>
    </div>
  `;

  // Keep only last 20 activities
  const activities = elements.recentActivity.querySelectorAll('.activity-item');
  if (activities.length >= 20) {
    activities[activities.length - 1].remove();
  }

  elements.recentActivity.insertAdjacentHTML('afterbegin', activityHtml);

  // Remove empty state
  const emptyState = elements.recentActivity.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }
}

elements.exportStatusBtn.addEventListener('click', () => {
  const statusData = {
    connectionStatus: state.connectionStatus,
    networkRequestCount: state.networkRequests.length,
    taskCount: state.tasks.length,
    uptime: Date.now() - state.startTime,
    timestamp: new Date().toISOString()
  };

  downloadJSON(statusData, 'basset-hound-status.json');
  addAuditLog('info', 'Status exported to JSON');
});

// =============================================================================
// Network Tab
// =============================================================================

function addNetworkRequest(request) {
  // Add to state
  state.networkRequests.unshift(request);

  // Limit stored requests
  if (state.networkRequests.length > MAX_NETWORK_REQUESTS) {
    state.networkRequests.pop();
  }

  // Update UI
  renderNetworkTable();
  updateNetworkBadge();
  addRecentActivity(`Network request: ${request.method} ${request.url}`);
}

function renderNetworkTable() {
  const filter = elements.networkFilter.value.toLowerCase();
  const methodFilter = elements.networkMethodFilter.value;
  const statusFilter = elements.networkStatusFilter.value;

  const filteredRequests = state.networkRequests.filter(req => {
    if (filter && !req.url.toLowerCase().includes(filter)) return false;
    if (methodFilter && req.method !== methodFilter) return false;
    if (statusFilter && !req.status.toString().startsWith(statusFilter)) return false;
    return true;
  });

  if (filteredRequests.length === 0) {
    elements.networkTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="5">
          <div class="empty-state">No matching requests</div>
        </td>
      </tr>
    `;
    return;
  }

  elements.networkTableBody.innerHTML = filteredRequests.map(req => {
    const statusClass = getStatusClass(req.status);
    return `
      <tr data-request-id="${req.id}">
        <td><span class="status-badge-cell ${statusClass}">${req.status}</span></td>
        <td><span class="method-badge">${escapeHtml(req.method)}</span></td>
        <td class="text-truncate" title="${escapeHtml(req.url)}">${escapeHtml(req.url)}</td>
        <td>${req.time ? req.time.toFixed(2) + 'ms' : '--'}</td>
        <td>${formatBytes(req.size)}</td>
      </tr>
    `;
  }).join('');

  // Add click handlers
  elements.networkTableBody.querySelectorAll('tr[data-request-id]').forEach(row => {
    row.addEventListener('click', () => {
      const requestId = row.dataset.requestId;
      const request = state.networkRequests.find(r => r.id === requestId);
      if (request) {
        showNetworkDetail(request);

        // Update selected state
        elements.networkTableBody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
      }
    });
  });
}

function showNetworkDetail(request) {
  state.selectedNetworkRequest = request;

  const detailHtml = `
    <div class="detail-section">
      <h4>General</h4>
      <table class="detail-table">
        <tr><td>URL:</td><td>${escapeHtml(request.url)}</td></tr>
        <tr><td>Method:</td><td>${escapeHtml(request.method)}</td></tr>
        <tr><td>Status:</td><td>${request.status} ${escapeHtml(request.statusText || '')}</td></tr>
        <tr><td>Time:</td><td>${request.time ? request.time.toFixed(2) + 'ms' : '--'}</td></tr>
        <tr><td>Size:</td><td>${formatBytes(request.size)}</td></tr>
      </table>
    </div>

    ${request.headers ? `
      <div class="detail-section">
        <h4>Response Headers</h4>
        <div class="detail-code">${formatHeaders(request.headers)}</div>
      </div>
    ` : ''}

    ${request.requestHeaders ? `
      <div class="detail-section">
        <h4>Request Headers</h4>
        <div class="detail-code">${formatHeaders(request.requestHeaders)}</div>
      </div>
    ` : ''}

    ${request.body ? `
      <div class="detail-section">
        <h4>Response Body</h4>
        <div class="detail-code">${escapeHtml(formatBody(request.body))}</div>
      </div>
    ` : ''}
  `;

  elements.networkDetail.innerHTML = detailHtml;
}

function updateNetworkBadge() {
  elements.networkBadge.textContent = state.networkRequests.length;
}

function getStatusClass(status) {
  const firstDigit = Math.floor(status / 100);
  return `status-${firstDigit}xx`;
}

elements.networkFilter.addEventListener('input', renderNetworkTable);
elements.networkMethodFilter.addEventListener('change', renderNetworkTable);
elements.networkStatusFilter.addEventListener('change', renderNetworkTable);

elements.clearNetworkBtn.addEventListener('click', () => {
  state.networkRequests = [];
  renderNetworkTable();
  updateNetworkBadge();
  elements.networkDetail.innerHTML = '<div class="empty-state">Select a request to view details</div>';
  addAuditLog('info', 'Network requests cleared');
});

elements.exportNetworkBtn.addEventListener('click', () => {
  const har = generateHAR(state.networkRequests);
  downloadJSON(har, 'basset-hound-network.har');
  addAuditLog('info', 'Network requests exported to HAR');
});

// =============================================================================
// Commands Tab
// =============================================================================

function setupCommandTemplates() {
  elements.templateBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const templateName = btn.dataset.template;
      const template = COMMAND_TEMPLATES[templateName];
      if (template) {
        elements.commandInput.value = JSON.stringify(template, null, 2);
        addAuditLog('info', `Loaded ${templateName} command template`);
      }
    });
  });
}

elements.executeCommandBtn.addEventListener('click', () => {
  const commandText = elements.commandInput.value.trim();

  if (!commandText) {
    addConsoleEntry('error', 'Command input is empty');
    return;
  }

  try {
    const command = JSON.parse(commandText);
    executeCommand(command);
  } catch (error) {
    addConsoleEntry('error', `Invalid JSON: ${error.message}`);
    addAuditLog('error', `Command parse error: ${error.message}`);
  }
});

elements.formatCommandBtn.addEventListener('click', () => {
  const commandText = elements.commandInput.value.trim();

  if (!commandText) return;

  try {
    const command = JSON.parse(commandText);
    elements.commandInput.value = JSON.stringify(command, null, 2);
    addConsoleEntry('info', 'JSON formatted successfully');
  } catch (error) {
    addConsoleEntry('error', `Invalid JSON: ${error.message}`);
  }
});

function executeCommand(command) {
  const commandEntry = {
    id: generateId(),
    command: command,
    timestamp: Date.now(),
    status: 'pending'
  };

  // Add to history
  state.commandHistory.unshift(commandEntry);
  if (state.commandHistory.length > MAX_COMMAND_HISTORY) {
    state.commandHistory.pop();
  }

  // Send to background
  chrome.runtime.sendMessage(
    { type: 'execute_command', command: command },
    (response) => {
      if (chrome.runtime.lastError) {
        commandEntry.status = 'error';
        commandEntry.error = chrome.runtime.lastError.message;
        addConsoleEntry('error', `Command failed: ${chrome.runtime.lastError.message}`);
      } else {
        commandEntry.status = 'success';
        commandEntry.response = response;
        addConsoleEntry('info', `Command executed: ${command.type}`);
      }

      renderCommandHistory();
      addAuditLog('info', `Command executed: ${command.type}`);
    }
  );

  renderCommandHistory();
  addRecentActivity(`Command executed: ${command.type}`);
}

function renderCommandHistory() {
  if (state.commandHistory.length === 0) {
    elements.commandHistory.innerHTML = '<div class="empty-state">No commands executed yet</div>';
    return;
  }

  elements.commandHistory.innerHTML = state.commandHistory.map(entry => `
    <div class="history-item">
      <div class="history-header">
        <div class="history-time">${formatTime(entry.timestamp)}</div>
        <div class="history-status ${entry.status}">${entry.status}</div>
      </div>
      <div class="history-command">${escapeHtml(JSON.stringify(entry.command, null, 2))}</div>
      ${entry.error ? `<div class="history-error text-error">${escapeHtml(entry.error)}</div>` : ''}
    </div>
  `).join('');
}

elements.clearCommandsBtn.addEventListener('click', () => {
  state.commandHistory = [];
  renderCommandHistory();
  addAuditLog('info', 'Command history cleared');
});

// =============================================================================
// Tasks Tab
// =============================================================================

function updateTasks(tasks) {
  state.tasks = tasks || [];
  renderTaskList();
  updateTaskBadge();
}

function renderTaskList() {
  if (state.tasks.length === 0) {
    elements.taskList.innerHTML = '<div class="empty-state">No tasks in queue</div>';
    return;
  }

  // Sort tasks: running first, then by start time
  const sortedTasks = [...state.tasks].sort((a, b) => {
    if (a.status === 'running' && b.status !== 'running') return -1;
    if (b.status === 'running' && a.status !== 'running') return 1;
    return (b.startTime || 0) - (a.startTime || 0);
  });

  elements.taskList.innerHTML = sortedTasks.map(task => {
    const icon = getTaskIcon(task.status);
    const duration = task.endTime
      ? formatDuration(task.endTime - task.startTime)
      : formatDuration(Date.now() - task.startTime);

    return `
      <div class="task-item">
        <div class="task-status-icon ${task.status}">${icon}</div>
        <div class="task-content">
          <div class="task-type">${escapeHtml(task.type)}</div>
          <div class="task-details">${escapeHtml(JSON.stringify(task.data || {}))}</div>
          <div class="task-time">
            Started: ${formatTime(task.startTime)} | Duration: ${duration}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function getTaskIcon(status) {
  const icons = {
    running: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    completed: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    failed: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    pending: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>'
  };
  return icons[status] || icons.pending;
}

function updateTaskBadge() {
  const runningTasks = state.tasks.filter(t => t.status === 'running').length;
  elements.taskBadge.textContent = runningTasks;
}

elements.clearTasksBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'clear_tasks' });
  state.tasks = [];
  renderTaskList();
  updateTaskBadge();
  addAuditLog('info', 'Tasks cleared');
});

// =============================================================================
// Audit Log Tab
// =============================================================================

function addAuditLog(level, message) {
  const log = {
    timestamp: Date.now(),
    level: level,
    message: message
  };

  state.auditLogs.unshift(log);

  if (state.auditLogs.length > MAX_AUDIT_LOGS) {
    state.auditLogs.pop();
  }

  renderAuditLog();
}

function renderAuditLog() {
  const filter = elements.auditFilter.value.toLowerCase();
  const levelFilter = elements.auditLevelFilter.value;

  const filteredLogs = state.auditLogs.filter(log => {
    if (filter && !log.message.toLowerCase().includes(filter)) return false;
    if (levelFilter && log.level !== levelFilter) return false;
    return true;
  });

  if (filteredLogs.length === 0) {
    elements.auditLog.innerHTML = '<div class="empty-state">No audit logs</div>';
    return;
  }

  elements.auditLog.innerHTML = filteredLogs.map(log => `
    <div class="log-entry">
      <div class="log-time">${formatTime(log.timestamp)}</div>
      <div class="log-level ${log.level}">[${log.level.toUpperCase()}]</div>
      <div class="log-message">${escapeHtml(log.message)}</div>
    </div>
  `).join('');
}

elements.auditFilter.addEventListener('input', renderAuditLog);
elements.auditLevelFilter.addEventListener('change', renderAuditLog);

elements.clearAuditBtn.addEventListener('click', () => {
  state.auditLogs = [];
  renderAuditLog();
});

elements.exportAuditBtn.addEventListener('click', () => {
  downloadJSON(state.auditLogs, 'basset-hound-audit.json');
  addAuditLog('info', 'Audit log exported');
});

// =============================================================================
// Console Tab
// =============================================================================

function addConsoleEntry(type, message) {
  const entry = {
    timestamp: Date.now(),
    type: type,
    message: message
  };

  state.consoleEntries.unshift(entry);

  if (state.consoleEntries.length > MAX_CONSOLE_ENTRIES) {
    state.consoleEntries.pop();
  }

  renderConsole();
}

function renderConsole() {
  if (state.consoleEntries.length === 0) {
    elements.consoleOutput.innerHTML = '<div class="empty-state">No console messages</div>';
    return;
  }

  elements.consoleOutput.innerHTML = state.consoleEntries.map(entry => `
    <div class="console-entry ${entry.type}">
      <div class="console-prompt">${getConsolePrompt(entry.type)}</div>
      <div class="console-message">${escapeHtml(entry.message)}</div>
    </div>
  `).join('');
}

function getConsolePrompt(type) {
  const prompts = {
    log: '&gt;',
    info: 'ℹ',
    warn: '⚠',
    error: '✖'
  };
  return prompts[type] || '&gt;';
}

elements.executeConsoleBtn.addEventListener('click', () => {
  const code = elements.consoleInput.value.trim();

  if (!code) return;

  addConsoleEntry('log', `> ${code}`);

  try {
    // Execute in the context of the inspected page
    chrome.devtools.inspectedWindow.eval(code, (result, error) => {
      if (error) {
        addConsoleEntry('error', error.value || error.description);
      } else {
        addConsoleEntry('log', JSON.stringify(result, null, 2));
      }
    });
  } catch (error) {
    addConsoleEntry('error', error.message);
  }

  elements.consoleInput.value = '';
});

elements.consoleInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    elements.executeConsoleBtn.click();
  }
});

elements.clearConsoleBtn.addEventListener('click', () => {
  state.consoleEntries = [];
  renderConsole();
});

// =============================================================================
// Message Handling
// =============================================================================

function setupMessageListeners() {
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'connection_status':
        updateConnectionStatus(message.status, message.data);
        break;

      case 'task_update':
        updateTasks(message.tasks);
        break;

      case 'devtools_network_request':
        if (message.request) {
          addNetworkRequest({
            id: generateId(),
            ...message.request,
            timestamp: Date.now()
          });
        }
        break;

      case 'devtools_navigation':
        addRecentActivity(`Navigated to: ${message.url}`);
        addAuditLog('info', `Navigation: ${message.url}`);
        break;

      case 'extension_log':
        if (message.level && message.message) {
          addAuditLog(message.level, message.message);
        }
        break;
    }
  });
}

// =============================================================================
// Data Fetching
// =============================================================================

function fetchAllData() {
  // Get current status
  chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
    if (response && !chrome.runtime.lastError) {
      updateConnectionStatus(response.connectionState || 'disconnected', {
        url: response.url,
        reconnectAttempts: response.reconnectAttempts
      });
    }
  });

  // Get tasks
  chrome.runtime.sendMessage({ type: 'get_tasks' }, (response) => {
    if (response && response.tasks && !chrome.runtime.lastError) {
      updateTasks(response.tasks);
    }
  });

  // Get network monitor data
  chrome.runtime.sendMessage({ type: 'get_network_data' }, (response) => {
    if (response && response.requests && !chrome.runtime.lastError) {
      response.requests.forEach(req => {
        if (!state.networkRequests.find(r => r.id === req.id)) {
          addNetworkRequest(req);
        }
      });
    }
  });

  updateOverviewMetrics();
}

// =============================================================================
// Utility Functions
// =============================================================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  });
}

function formatDuration(ms) {
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

function formatBytes(bytes) {
  if (bytes === undefined || bytes === null) return '--';
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatHeaders(headers) {
  if (typeof headers === 'object') {
    return Object.entries(headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  }
  return headers;
}

function formatBody(body) {
  if (typeof body === 'object') {
    return JSON.stringify(body, null, 2);
  }
  return body;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function generateHAR(requests) {
  return {
    log: {
      version: '1.2',
      creator: {
        name: 'Basset Hound DevTools',
        version: '1.0.0'
      },
      entries: requests.map(req => ({
        startedDateTime: new Date(req.timestamp).toISOString(),
        time: req.time || 0,
        request: {
          method: req.method,
          url: req.url,
          headers: req.requestHeaders || [],
          queryString: [],
          cookies: [],
          headersSize: -1,
          bodySize: -1
        },
        response: {
          status: req.status,
          statusText: req.statusText || '',
          headers: req.headers || [],
          cookies: [],
          content: {
            size: req.size || 0,
            mimeType: req.mimeType || 'text/html'
          },
          redirectURL: '',
          headersSize: -1,
          bodySize: req.size || -1
        },
        cache: {},
        timings: {
          send: 0,
          wait: req.time || 0,
          receive: 0
        }
      }))
    }
  };
}

// =============================================================================
// Panel Lifecycle
// =============================================================================

window.onPanelShown = function() {
  addAuditLog('info', 'DevTools panel opened');
  fetchAllData();
};

// =============================================================================
// Initialization
// =============================================================================

function init() {
  console.log('[Basset Hound DevTools Panel] Initializing...');

  // Setup event listeners
  setupTabNavigation();
  setupCommandTemplates();
  setupMessageListeners();

  // Initial data fetch
  fetchAllData();

  // Setup refresh interval
  setInterval(() => {
    if (state.activeTab === 'overview') {
      updateOverviewMetrics();
    }
  }, REFRESH_INTERVAL);

  // Initial log
  addAuditLog('info', 'Basset Hound DevTools Panel initialized');
  addConsoleEntry('info', 'DevTools Panel ready');

  console.log('[Basset Hound DevTools Panel] Initialization complete');
}

// Start the panel
init();
