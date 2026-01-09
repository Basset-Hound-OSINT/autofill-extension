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
  ingestDetections: [],
  selectedIngestItems: new Set(),
  selectedIngestItem: null,
  lastIngestScan: null,
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
  clearConsoleBtn: document.getElementById('clearConsoleBtn'),

  // Ingest
  ingestFilter: document.getElementById('ingestFilter'),
  ingestTypeFilter: document.getElementById('ingestTypeFilter'),
  ingestCategoryFilter: document.getElementById('ingestCategoryFilter'),
  ingestValidationFilter: document.getElementById('ingestValidationFilter'),
  ingestList: document.getElementById('ingestList'),
  ingestDetail: document.getElementById('ingestDetail'),
  ingestBadge: document.getElementById('ingestBadge'),
  ingestTotalCount: document.getElementById('ingestTotalCount'),
  ingestSelectedCount: document.getElementById('ingestSelectedCount'),
  ingestVerifiedCount: document.getElementById('ingestVerifiedCount'),
  ingestLastScan: document.getElementById('ingestLastScan'),
  scanPageBtn: document.getElementById('scanPageBtn'),
  clearIngestBtn: document.getElementById('clearIngestBtn'),
  ingestSelectedBtn: document.getElementById('ingestSelectedBtn'),
  selectAllIngest: document.getElementById('selectAllIngest'),
  exportIngestBtn: document.getElementById('exportIngestBtn')
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
// Ingest Tab
// =============================================================================

/**
 * Scan the current page for OSINT patterns
 */
async function scanPageForOSINT() {
  addAuditLog('info', 'Starting page scan for OSINT data');
  elements.scanPageBtn.disabled = true;
  elements.scanPageBtn.textContent = 'Scanning...';

  try {
    // Get the inspected window's tabId
    const tabId = chrome.devtools.inspectedWindow.tabId;

    // Send message to content script to scan page
    chrome.tabs.sendMessage(tabId, { type: 'scan_osint_patterns' }, (response) => {
      if (chrome.runtime.lastError) {
        addConsoleEntry('error', `Scan failed: ${chrome.runtime.lastError.message}`);
        addAuditLog('error', `OSINT scan failed: ${chrome.runtime.lastError.message}`);
      } else if (response && response.detections) {
        // Process detections
        processDetections(response.detections);
        addAuditLog('info', `OSINT scan complete: ${response.detections.length} patterns detected`);
        addRecentActivity(`Scanned page: ${response.detections.length} patterns detected`);
      } else {
        addConsoleEntry('warn', 'No detections returned from scan');
        addAuditLog('warn', 'OSINT scan returned no data');
      }

      elements.scanPageBtn.disabled = false;
      elements.scanPageBtn.textContent = 'Scan Page';
    });
  } catch (error) {
    addConsoleEntry('error', `Scan error: ${error.message}`);
    addAuditLog('error', `OSINT scan error: ${error.message}`);
    elements.scanPageBtn.disabled = false;
    elements.scanPageBtn.textContent = 'Scan Page';
  }
}

/**
 * Process detections from scan
 * @param {Array} detections - Array of detected patterns
 */
function processDetections(detections) {
  // Add unique detections
  const existingValues = new Set(state.ingestDetections.map(d => `${d.type}:${d.value}`));

  for (const detection of detections) {
    const key = `${detection.type}:${detection.value}`;
    if (!existingValues.has(key)) {
      detection.id = generateId();
      detection.selected = false;
      state.ingestDetections.push(detection);
      existingValues.add(key);
    }
  }

  state.lastIngestScan = Date.now();

  // Update UI
  renderIngestList();
  updateIngestStats();
  updateIngestBadge();
}

/**
 * Render the ingest list
 */
function renderIngestList() {
  const filter = elements.ingestFilter.value.toLowerCase();
  const typeFilter = elements.ingestTypeFilter.value;
  const categoryFilter = elements.ingestCategoryFilter.value;
  const validationFilter = elements.ingestValidationFilter.value;

  // Filter detections
  const filteredDetections = state.ingestDetections.filter(d => {
    if (filter && !d.value.toLowerCase().includes(filter) && !d.name.toLowerCase().includes(filter)) {
      return false;
    }
    if (typeFilter && d.type !== typeFilter) return false;
    if (categoryFilter && d.category !== categoryFilter) return false;
    if (validationFilter === 'verified' && !d.verified) return false;
    if (validationFilter === 'unverified' && d.verified) return false;
    return true;
  });

  if (filteredDetections.length === 0) {
    elements.ingestList.innerHTML = '<div class="empty-state">No matching detections</div>';
    return;
  }

  // Group by category
  const groupedByCategory = {};
  for (const detection of filteredDetections) {
    const category = detection.category || 'other';
    if (!groupedByCategory[category]) {
      groupedByCategory[category] = [];
    }
    groupedByCategory[category].push(detection);
  }

  // Render grouped list
  let html = '';
  const categoryNames = {
    contact: 'Contact Information',
    crypto: 'Cryptocurrency',
    network: 'Network',
    social: 'Social Media',
    pii: 'Personal Information',
    location: 'Location',
    security: 'Security',
    other: 'Other'
  };

  for (const [category, detections] of Object.entries(groupedByCategory)) {
    html += `
      <div class="ingest-category">
        <div class="category-header">
          <h4>${categoryNames[category] || category}</h4>
          <span class="category-count">${detections.length}</span>
        </div>
        <div class="category-items">
    `;

    for (const detection of detections) {
      const isSelected = state.selectedIngestItems.has(detection.id);
      const verifiedClass = detection.verified ? 'verified' : '';
      const sensitiveClass = detection.sensitive ? 'sensitive' : '';

      html += `
        <div class="ingest-item ${verifiedClass} ${sensitiveClass}" data-id="${detection.id}">
          <div class="ingest-checkbox">
            <input type="checkbox" ${isSelected ? 'checked' : ''} data-id="${detection.id}">
          </div>
          <div class="ingest-icon" style="color: ${detection.color}">${detection.icon}</div>
          <div class="ingest-content">
            <div class="ingest-type">${escapeHtml(detection.name)}</div>
            <div class="ingest-value">${escapeHtml(detection.value)}</div>
            ${detection.context ? `<div class="ingest-context">${escapeHtml(truncateText(detection.context, 80))}</div>` : ''}
          </div>
          <div class="ingest-indicators">
            ${detection.verified ? '<span class="indicator verified" title="Format verified">✓</span>' : '<span class="indicator unverified" title="Not verified">?</span>'}
            ${detection.sensitive ? '<span class="indicator sensitive" title="Sensitive data">⚠</span>' : ''}
          </div>
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;
  }

  elements.ingestList.innerHTML = html;

  // Add click handlers
  elements.ingestList.querySelectorAll('.ingest-item').forEach(item => {
    // Item click (show details)
    item.addEventListener('click', (e) => {
      if (e.target.type === 'checkbox') return; // Skip if clicking checkbox

      const id = item.dataset.id;
      const detection = state.ingestDetections.find(d => d.id === id);
      if (detection) {
        showIngestDetail(detection);

        // Update selected state
        elements.ingestList.querySelectorAll('.ingest-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      }
    });

    // Checkbox change
    const checkbox = item.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      const id = checkbox.dataset.id;
      if (checkbox.checked) {
        state.selectedIngestItems.add(id);
      } else {
        state.selectedIngestItems.delete(id);
      }
      updateIngestStats();
    });
  });
}

/**
 * Show ingest item details
 * @param {Object} detection - Detection to show
 */
function showIngestDetail(detection) {
  state.selectedIngestItem = detection;

  let validationHtml = '';
  if (detection.validation) {
    const v = detection.validation;
    validationHtml = `
      <div class="detail-section">
        <h4>Validation</h4>
        <div class="validation-results">
          <div class="validation-status ${v.plausible ? 'valid' : 'invalid'}">
            ${v.plausible ? '✓ Plausible' : '✗ Invalid'}
          </div>
          ${v.checks ? Object.entries(v.checks).map(([key, value]) => `
            <div class="validation-check">
              <span class="check-name">${key}:</span>
              <span class="check-value ${value ? 'pass' : 'fail'}">${value ? '✓' : '✗'}</span>
            </div>
          `).join('') : ''}
          ${v.warnings && v.warnings.length > 0 ? `
            <div class="validation-warnings">
              ${v.warnings.map(w => `<div class="warning">⚠ ${escapeHtml(w.message)}</div>`).join('')}
            </div>
          ` : ''}
          ${v.errors && v.errors.length > 0 ? `
            <div class="validation-errors">
              ${v.errors.map(e => `<div class="error">✗ ${escapeHtml(e.message)}</div>`).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  const detailHtml = `
    <div class="detail-header">
      <div class="detail-icon" style="color: ${detection.color}">${detection.icon}</div>
      <div>
        <h3>${escapeHtml(detection.name)}</h3>
        <div class="detail-type">${escapeHtml(detection.type)}</div>
      </div>
    </div>

    <div class="detail-section">
      <h4>Value</h4>
      <div class="detail-value">${escapeHtml(detection.value)}</div>
      <button class="btn btn-sm copy-btn" data-value="${escapeHtml(detection.value)}">Copy</button>
    </div>

    ${detection.context ? `
      <div class="detail-section">
        <h4>Context</h4>
        <div class="detail-context">${escapeHtml(detection.context)}</div>
      </div>
    ` : ''}

    ${validationHtml}

    <div class="detail-section">
      <h4>Metadata</h4>
      <table class="detail-table">
        <tr><td>Category:</td><td>${escapeHtml(detection.category)}</td></tr>
        <tr><td>Priority:</td><td>${detection.priority}</td></tr>
        ${detection.sourceUrl ? `<tr><td>Source:</td><td class="text-truncate" title="${escapeHtml(detection.sourceUrl)}">${escapeHtml(detection.sourceUrl)}</td></tr>` : ''}
        ${detection.selector ? `<tr><td>Selector:</td><td class="text-mono">${escapeHtml(detection.selector)}</td></tr>` : ''}
        ${detection.attribute ? `<tr><td>Attribute:</td><td>${escapeHtml(detection.attribute)}</td></tr>` : ''}
        <tr><td>Detected:</td><td>${formatTime(detection.timestamp)}</td></tr>
        ${detection.sensitive ? '<tr><td>Sensitive:</td><td class="text-warning">Yes</td></tr>' : ''}
      </table>
    </div>

    <div class="detail-actions">
      <button class="btn btn-sm" id="highlightOnPageBtn">Highlight on Page</button>
      <button class="btn btn-sm btn-primary" id="ingestSingleBtn">Ingest to Backend</button>
    </div>
  `;

  elements.ingestDetail.innerHTML = detailHtml;

  // Add event handlers
  const copyBtn = elements.ingestDetail.querySelector('.copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(detection.value);
      addConsoleEntry('info', 'Value copied to clipboard');
    });
  }

  const highlightBtn = elements.ingestDetail.querySelector('#highlightOnPageBtn');
  if (highlightBtn) {
    highlightBtn.addEventListener('click', () => {
      highlightOnPage(detection);
    });
  }

  const ingestSingleBtn = elements.ingestDetail.querySelector('#ingestSingleBtn');
  if (ingestSingleBtn) {
    ingestSingleBtn.addEventListener('click', () => {
      ingestItems([detection]);
    });
  }
}

/**
 * Highlight detection on page
 * @param {Object} detection - Detection to highlight
 */
function highlightOnPage(detection) {
  if (!detection.selector) {
    addConsoleEntry('warn', 'No selector available for highlighting');
    return;
  }

  const tabId = chrome.devtools.inspectedWindow.tabId;
  chrome.tabs.sendMessage(tabId, {
    type: 'highlight_element',
    selector: detection.selector
  }, (response) => {
    if (chrome.runtime.lastError) {
      addConsoleEntry('error', `Highlight failed: ${chrome.runtime.lastError.message}`);
    } else {
      addConsoleEntry('info', 'Element highlighted on page');
    }
  });
}

/**
 * Update ingest statistics
 */
function updateIngestStats() {
  elements.ingestTotalCount.textContent = state.ingestDetections.length;
  elements.ingestSelectedCount.textContent = state.selectedIngestItems.size;

  const verifiedCount = state.ingestDetections.filter(d => d.verified).length;
  elements.ingestVerifiedCount.textContent = verifiedCount;

  if (state.lastIngestScan) {
    elements.ingestLastScan.textContent = formatTime(state.lastIngestScan);
  }
}

/**
 * Update ingest badge
 */
function updateIngestBadge() {
  elements.ingestBadge.textContent = state.ingestDetections.length;
}

/**
 * Ingest selected items to backend
 */
function ingestItems(items = null) {
  const toIngest = items || state.ingestDetections.filter(d => state.selectedIngestItems.has(d.id));

  if (toIngest.length === 0) {
    addConsoleEntry('warn', 'No items selected for ingestion');
    return;
  }

  addAuditLog('info', `Ingesting ${toIngest.length} items to backend`);

  // Send to backend via MCP
  chrome.runtime.sendMessage({
    type: 'ingest_osint_data',
    data: toIngest
  }, (response) => {
    if (chrome.runtime.lastError) {
      addConsoleEntry('error', `Ingest failed: ${chrome.runtime.lastError.message}`);
      addAuditLog('error', `OSINT ingest failed: ${chrome.runtime.lastError.message}`);
    } else {
      addConsoleEntry('info', `Successfully ingested ${toIngest.length} items`);
      addAuditLog('info', `Ingested ${toIngest.length} OSINT items to backend`);
      addRecentActivity(`Ingested ${toIngest.length} OSINT items`);

      // Clear selected items
      state.selectedIngestItems.clear();
      renderIngestList();
      updateIngestStats();
    }
  });
}

/**
 * Clear all ingest data
 */
function clearIngestData() {
  state.ingestDetections = [];
  state.selectedIngestItems.clear();
  state.selectedIngestItem = null;
  state.lastIngestScan = null;

  renderIngestList();
  updateIngestStats();
  updateIngestBadge();

  elements.ingestDetail.innerHTML = '<div class="empty-state">Select an item to view details</div>';
  elements.ingestList.innerHTML = '<div class="empty-state">Click "Scan Page" to detect OSINT data on the current page</div>';

  addAuditLog('info', 'Ingest data cleared');
}

/**
 * Export ingest data to JSON
 */
function exportIngestData() {
  const exportData = {
    timestamp: new Date().toISOString(),
    sourceUrl: chrome.devtools.inspectedWindow ? 'inspected-window' : 'unknown',
    totalDetections: state.ingestDetections.length,
    detections: state.ingestDetections
  };

  downloadJSON(exportData, `osint-detections-${Date.now()}.json`);
  addAuditLog('info', 'Ingest data exported to JSON');
}

/**
 * Truncate text to specified length
 */
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// Ingest event handlers
elements.scanPageBtn.addEventListener('click', () => {
  scanPageForOSINT();
});

elements.clearIngestBtn.addEventListener('click', () => {
  if (confirm('Clear all detected OSINT data?')) {
    clearIngestData();
  }
});

elements.ingestSelectedBtn.addEventListener('click', () => {
  ingestItems();
});

elements.selectAllIngest.addEventListener('change', (e) => {
  if (e.target.checked) {
    // Select all visible items
    state.ingestDetections.forEach(d => state.selectedIngestItems.add(d.id));
  } else {
    state.selectedIngestItems.clear();
  }
  renderIngestList();
  updateIngestStats();
});

elements.exportIngestBtn.addEventListener('click', () => {
  exportIngestData();
});

elements.ingestFilter.addEventListener('input', renderIngestList);
elements.ingestTypeFilter.addEventListener('change', renderIngestList);
elements.ingestCategoryFilter.addEventListener('change', renderIngestList);
elements.ingestValidationFilter.addEventListener('change', renderIngestList);

// =============================================================================
// Workflow Automation (Phase 17.2)
// =============================================================================

/**
 * Workflow state management
 */
const workflowState = {
  workflows: [],
  currentWorkflow: null,
  currentStep: null,
  execution: null,
  logs: [],
  schedules: [],
  activePanel: 'library'
};

/**
 * Initialize workflow UI
 */
function setupWorkflowUI() {
  // Load workflow UI helpers script
  const script = document.createElement('script');
  script.src = 'utils/workflow/workflow-ui-helpers.js';
  document.head.appendChild(script);

  // Setup workflow sub-navigation
  document.querySelectorAll('.workflow-subnav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.dataset.panel;
      switchWorkflowPanel(panel);
    });
  });

  // Setup library panel
  document.getElementById('workflowSearchInput')?.addEventListener('input', filterWorkflows);
  document.getElementById('workflowCategoryFilter')?.addEventListener('change', filterWorkflows);
  document.getElementById('newWorkflowBtn')?.addEventListener('click', createNewWorkflow);
  document.getElementById('importWorkflowBtn')?.addEventListener('click', importWorkflow);

  // Setup builder panel
  document.getElementById('saveWorkflowBtn')?.addEventListener('click', saveWorkflow);
  document.getElementById('exportWorkflowBtn')?.addEventListener('click', exportWorkflow);
  document.getElementById('executeWorkflowBtn')?.addEventListener('click', executeCurrentWorkflow);

  // Mode toggle
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      toggleBuilderMode(mode);
    });
  });

  // Step palette buttons
  document.querySelectorAll('.step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const stepType = btn.dataset.step;
      addWorkflowStep(stepType);
    });
  });

  // Code editor actions
  document.getElementById('formatCodeBtn')?.addEventListener('click', formatWorkflowJSON);
  document.getElementById('validateCodeBtn')?.addEventListener('click', validateWorkflowJSON);

  // Monitor panel controls
  document.getElementById('pauseExecutionBtn')?.addEventListener('click', pauseExecution);
  document.getElementById('resumeExecutionBtn')?.addEventListener('click', resumeExecution);
  document.getElementById('cancelExecutionBtn')?.addEventListener('click', cancelExecution);

  // Logs panel
  document.getElementById('logFilterInput')?.addEventListener('input', filterWorkflowLogs);
  document.getElementById('logLevelFilter')?.addEventListener('change', filterWorkflowLogs);
  document.getElementById('clearLogsBtn')?.addEventListener('click', clearWorkflowLogs);
  document.getElementById('exportLogsBtn')?.addEventListener('click', exportWorkflowLogs);

  // Schedule panel
  document.getElementById('newScheduleBtn')?.addEventListener('click', createNewSchedule);

  // Load saved workflows from storage
  loadWorkflows();
}

/**
 * Switch workflow panel
 */
function switchWorkflowPanel(panelName) {
  // Update navigation
  document.querySelectorAll('.workflow-subnav-btn').forEach(btn => {
    if (btn.dataset.panel === panelName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update panels
  document.querySelectorAll('.workflow-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  const panel = document.getElementById(`workflow-${panelName}-panel`);
  if (panel) {
    panel.classList.add('active');
  }

  workflowState.activePanel = panelName;
}

/**
 * Load workflows from storage
 */
async function loadWorkflows() {
  try {
    const result = await chrome.storage.local.get(['workflows']);
    workflowState.workflows = result.workflows || [];
    renderWorkflowLibrary();
    updateWorkflowBadge();
  } catch (error) {
    console.error('Failed to load workflows:', error);
    addAuditLog('error', `Failed to load workflows: ${error.message}`);
  }
}

/**
 * Render workflow library
 */
function renderWorkflowLibrary() {
  const grid = document.getElementById('workflowLibraryGrid');
  if (!grid) return;

  const searchTerm = document.getElementById('workflowSearchInput')?.value.toLowerCase() || '';
  const category = document.getElementById('workflowCategoryFilter')?.value || '';

  const filtered = workflowState.workflows.filter(wf => {
    if (searchTerm && !wf.name.toLowerCase().includes(searchTerm) &&
        !wf.description?.toLowerCase().includes(searchTerm)) {
      return false;
    }
    if (category && wf.category !== category) {
      return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state">No workflows found</div>';
    return;
  }

  // Use renderWorkflowCard from helpers if available
  if (typeof renderWorkflowCard === 'function') {
    grid.innerHTML = filtered.map(wf => renderWorkflowCard(wf)).join('');
  } else {
    // Fallback rendering
    grid.innerHTML = filtered.map(wf => `
      <div class="workflow-card" data-workflow-id="${wf.id}">
        <div class="workflow-card-header">
          <div class="workflow-card-title">${escapeHtml(wf.name)}</div>
          <span class="workflow-card-category">${wf.category || 'custom'}</span>
        </div>
        <div class="workflow-card-description">${escapeHtml(wf.description || '')}</div>
        <div class="workflow-card-meta">
          <span>${wf.steps?.length || 0} steps</span>
          <span>v${wf.version || '1.0.0'}</span>
        </div>
        <div class="workflow-card-actions">
          <button class="btn btn-sm workflow-edit-btn" data-workflow-id="${wf.id}">Edit</button>
          <button class="btn btn-sm btn-primary workflow-execute-btn" data-workflow-id="${wf.id}">Execute</button>
        </div>
      </div>
    `).join('');
  }

  // Add event listeners to cards
  grid.querySelectorAll('.workflow-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const workflowId = btn.dataset.workflowId;
      editWorkflow(workflowId);
    });
  });

  grid.querySelectorAll('.workflow-execute-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const workflowId = btn.dataset.workflowId;
      executeWorkflow(workflowId);
    });
  });
}

/**
 * Filter workflows
 */
function filterWorkflows() {
  renderWorkflowLibrary();
}

/**
 * Create new workflow
 */
function createNewWorkflow() {
  const newWorkflow = {
    id: generateUUID(),
    name: 'New Workflow',
    version: '1.0.0',
    description: '',
    category: 'custom',
    steps: [],
    variables: {},
    created: Date.now(),
    modified: Date.now()
  };

  workflowState.currentWorkflow = newWorkflow;
  workflowState.currentStep = null;

  // Switch to builder
  switchWorkflowPanel('builder');
  renderWorkflowBuilder();
}

/**
 * Edit workflow
 */
function editWorkflow(workflowId) {
  const workflow = workflowState.workflows.find(wf => wf.id === workflowId);
  if (!workflow) {
    addConsoleEntry('error', `Workflow ${workflowId} not found`);
    return;
  }

  workflowState.currentWorkflow = deepClone(workflow);
  workflowState.currentStep = null;

  switchWorkflowPanel('builder');
  renderWorkflowBuilder();
}

/**
 * Render workflow builder
 */
function renderWorkflowBuilder() {
  if (!workflowState.currentWorkflow) return;

  // Update workflow name input
  const nameInput = document.getElementById('workflowNameInput');
  if (nameInput) {
    nameInput.value = workflowState.currentWorkflow.name || '';
  }

  // Update code editor
  const codeEditor = document.getElementById('workflowCodeEditor');
  if (codeEditor) {
    codeEditor.value = JSON.stringify(workflowState.currentWorkflow, null, 2);
  }

  // Render steps list
  renderWorkflowStepsList();
}

/**
 * Render workflow steps list
 */
function renderWorkflowStepsList() {
  const stepsList = document.getElementById('workflowStepsList');
  if (!stepsList) return;

  const workflow = workflowState.currentWorkflow;
  if (!workflow || !workflow.steps || workflow.steps.length === 0) {
    stepsList.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
        <p>Add steps from the toolbar above to build your workflow</p>
      </div>
    `;
    return;
  }

  // Use renderWorkflowStepItem from helpers if available
  if (typeof renderWorkflowStepItem === 'function') {
    stepsList.innerHTML = workflow.steps.map((step, index) =>
      renderWorkflowStepItem(step, index)
    ).join('');
  } else {
    // Fallback rendering
    stepsList.innerHTML = workflow.steps.map((step, index) => `
      <div class="workflow-step-item" data-step-index="${index}">
        <div class="workflow-step-number">${index + 1}</div>
        <div class="workflow-step-content">
          <div class="workflow-step-type">${step.type}</div>
          <div class="workflow-step-label">${escapeHtml(step.label || step.type)}</div>
        </div>
        <div class="workflow-step-actions">
          <button class="workflow-step-action-btn step-delete" title="Delete">×</button>
        </div>
      </div>
    `).join('');
  }

  // Add event listeners
  stepsList.querySelectorAll('.workflow-step-item').forEach(item => {
    item.addEventListener('click', () => {
      const index = parseInt(item.dataset.stepIndex);
      selectWorkflowStep(index);
    });
  });

  stepsList.querySelectorAll('.step-delete').forEach((btn, index) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteWorkflowStep(index);
    });
  });

  stepsList.querySelectorAll('.step-move-up').forEach((btn, index) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      moveWorkflowStep(index, -1);
    });
  });

  stepsList.querySelectorAll('.step-move-down').forEach((btn, index) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      moveWorkflowStep(index, 1);
    });
  });
}

/**
 * Add workflow step
 */
function addWorkflowStep(stepType) {
  if (!workflowState.currentWorkflow) {
    createNewWorkflow();
  }

  const newStep = {
    id: generateId(),
    type: stepType,
    label: '',
    ...getDefaultStepConfig(stepType)
  };

  workflowState.currentWorkflow.steps.push(newStep);
  renderWorkflowStepsList();
  selectWorkflowStep(workflowState.currentWorkflow.steps.length - 1);
}

/**
 * Get default step configuration
 */
function getDefaultStepConfig(stepType) {
  const defaults = {
    navigate: { url: '', waitUntil: 'load' },
    click: { selector: '', waitForNavigation: false },
    fill: { selector: '', text: '', delay: 50 },
    extract: { selector: '', attribute: 'textContent', saveAs: '', multiple: false },
    detect: { detectEmail: true, detectPhone: true, detectCrypto: true, detectDomain: true, saveAs: 'detections' },
    wait: { waitType: 'time', duration: 1000, timeout: 30000 },
    screenshot: { fullPage: false, saveAs: 'screenshot' },
    condition: { condition: '', thenSteps: [], elseSteps: [] },
    loop: { items: '', itemVar: 'item', steps: [] }
  };

  return defaults[stepType] || {};
}

/**
 * Select workflow step
 */
function selectWorkflowStep(index) {
  const workflow = workflowState.currentWorkflow;
  if (!workflow || !workflow.steps[index]) return;

  workflowState.currentStep = index;

  // Update visual selection
  document.querySelectorAll('.workflow-step-item').forEach((item, i) => {
    if (i === index) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Render step configuration form
  renderStepConfiguration(workflow.steps[index]);
}

/**
 * Render step configuration
 */
function renderStepConfiguration(step) {
  const configPanel = document.getElementById('workflowStepConfig');
  if (!configPanel) return;

  // Use renderStepConfigForm from helpers if available
  if (typeof renderStepConfigForm === 'function') {
    configPanel.innerHTML = renderStepConfigForm(step);
  } else {
    // Fallback rendering
    configPanel.innerHTML = `
      <div class="step-config-header">
        <div class="step-config-title">${step.type}</div>
      </div>
      <div class="step-config-form">
        <div class="form-group">
          <label class="form-label">Step Label</label>
          <input type="text" class="form-input" name="label" value="${escapeHtml(step.label || '')}">
        </div>
      </div>
    `;
  }

  // Add event listeners to form inputs
  configPanel.querySelectorAll('input, select, textarea').forEach(input => {
    input.addEventListener('change', () => {
      updateStepConfiguration(input);
    });
  });
}

/**
 * Update step configuration
 */
function updateStepConfiguration(input) {
  const workflow = workflowState.currentWorkflow;
  const stepIndex = workflowState.currentStep;

  if (!workflow || stepIndex === null || !workflow.steps[stepIndex]) return;

  const step = workflow.steps[stepIndex];
  const name = input.name;
  let value = input.value;

  // Handle different input types
  if (input.type === 'checkbox') {
    value = input.checked;
  } else if (input.type === 'number') {
    value = parseFloat(value);
  }

  step[name] = value;

  // Update code editor if in code mode
  const codeEditor = document.getElementById('workflowCodeEditor');
  if (codeEditor) {
    codeEditor.value = JSON.stringify(workflow, null, 2);
  }

  // Re-render steps list to show updated details
  renderWorkflowStepsList();
}

/**
 * Delete workflow step
 */
function deleteWorkflowStep(index) {
  const workflow = workflowState.currentWorkflow;
  if (!workflow || !workflow.steps[index]) return;

  if (confirm(`Delete step ${index + 1}?`)) {
    workflow.steps.splice(index, 1);
    workflowState.currentStep = null;
    renderWorkflowStepsList();

    const configPanel = document.getElementById('workflowStepConfig');
    if (configPanel) {
      configPanel.innerHTML = '<div class="empty-state"><p>Select a step to configure</p></div>';
    }
  }
}

/**
 * Move workflow step
 */
function moveWorkflowStep(index, direction) {
  const workflow = workflowState.currentWorkflow;
  if (!workflow || !workflow.steps[index]) return;

  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= workflow.steps.length) return;

  // Swap steps
  const temp = workflow.steps[index];
  workflow.steps[index] = workflow.steps[newIndex];
  workflow.steps[newIndex] = temp;

  workflowState.currentStep = newIndex;
  renderWorkflowStepsList();
  selectWorkflowStep(newIndex);
}

/**
 * Toggle builder mode (visual/code)
 */
function toggleBuilderMode(mode) {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    if (btn.dataset.mode === mode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const visualEditor = document.getElementById('workflowBuilderVisual');
  const codeEditor = document.getElementById('workflowBuilderCode');

  if (mode === 'visual') {
    visualEditor.style.display = 'flex';
    codeEditor.style.display = 'none';
    renderWorkflowBuilder();
  } else {
    visualEditor.style.display = 'none';
    codeEditor.style.display = 'flex';
    const editor = document.getElementById('workflowCodeEditor');
    if (editor && workflowState.currentWorkflow) {
      editor.value = JSON.stringify(workflowState.currentWorkflow, null, 2);
    }
  }
}

/**
 * Format workflow JSON
 */
function formatWorkflowJSON() {
  const editor = document.getElementById('workflowCodeEditor');
  if (!editor) return;

  try {
    const workflow = JSON.parse(editor.value);
    editor.value = JSON.stringify(workflow, null, 2);
    addConsoleEntry('info', 'JSON formatted successfully');
  } catch (error) {
    addConsoleEntry('error', `Invalid JSON: ${error.message}`);
  }
}

/**
 * Validate workflow JSON
 */
function validateWorkflowJSON() {
  const editor = document.getElementById('workflowCodeEditor');
  if (!editor) return;

  try {
    const workflow = JSON.parse(editor.value);

    // Use validateWorkflow from helpers if available
    if (typeof validateWorkflow === 'function') {
      const result = validateWorkflow(workflow);
      if (result.valid) {
        addConsoleEntry('info', 'Workflow is valid');
      } else {
        addConsoleEntry('error', `Validation errors:\n${result.errors.join('\n')}`);
      }
    } else {
      addConsoleEntry('info', 'Workflow JSON is valid');
    }
  } catch (error) {
    addConsoleEntry('error', `Invalid JSON: ${error.message}`);
  }
}

/**
 * Save workflow
 */
async function saveWorkflow() {
  const nameInput = document.getElementById('workflowNameInput');
  if (nameInput) {
    workflowState.currentWorkflow.name = nameInput.value;
  }

  // Update from code editor if in code mode
  const codeEditor = document.getElementById('workflowCodeEditor');
  const visualEditor = document.getElementById('workflowBuilderVisual');

  if (codeEditor && codeEditor.style.display !== 'none') {
    try {
      workflowState.currentWorkflow = JSON.parse(codeEditor.value);
    } catch (error) {
      addConsoleEntry('error', `Cannot save: Invalid JSON - ${error.message}`);
      return;
    }
  }

  workflowState.currentWorkflow.modified = Date.now();

  // Find existing workflow or add new one
  const existingIndex = workflowState.workflows.findIndex(
    wf => wf.id === workflowState.currentWorkflow.id
  );

  if (existingIndex >= 0) {
    workflowState.workflows[existingIndex] = workflowState.currentWorkflow;
  } else {
    workflowState.workflows.push(workflowState.currentWorkflow);
  }

  // Save to storage
  try {
    await chrome.storage.local.set({ workflows: workflowState.workflows });
    addConsoleEntry('info', `Workflow "${workflowState.currentWorkflow.name}" saved`);
    addAuditLog('info', `Workflow saved: ${workflowState.currentWorkflow.name}`);
    renderWorkflowLibrary();
    updateWorkflowBadge();
  } catch (error) {
    addConsoleEntry('error', `Failed to save workflow: ${error.message}`);
  }
}

/**
 * Export workflow
 */
function exportWorkflow() {
  if (!workflowState.currentWorkflow) return;

  const json = JSON.stringify(workflowState.currentWorkflow, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `workflow-${workflowState.currentWorkflow.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  addConsoleEntry('info', 'Workflow exported');
}

/**
 * Import workflow
 */
function importWorkflow() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const workflow = JSON.parse(text);

      // Validate workflow
      if (typeof validateWorkflow === 'function') {
        const result = validateWorkflow(workflow);
        if (!result.valid) {
          addConsoleEntry('error', `Invalid workflow:\n${result.errors.join('\n')}`);
          return;
        }
      }

      // Generate new ID to avoid conflicts
      workflow.id = generateUUID();
      workflow.imported = Date.now();

      workflowState.workflows.push(workflow);
      await chrome.storage.local.set({ workflows: workflowState.workflows });

      addConsoleEntry('info', `Workflow "${workflow.name}" imported`);
      renderWorkflowLibrary();
      updateWorkflowBadge();
    } catch (error) {
      addConsoleEntry('error', `Failed to import workflow: ${error.message}`);
    }
  });
  input.click();
}

/**
 * Execute workflow
 */
function executeWorkflow(workflowId) {
  const workflow = workflowState.workflows.find(wf => wf.id === workflowId);
  if (!workflow) return;

  addConsoleEntry('info', `Executing workflow: ${workflow.name}`);
  addAuditLog('info', `Workflow execution started: ${workflow.name}`);

  // Switch to monitor panel
  switchWorkflowPanel('monitor');

  // TODO: Send workflow to execution engine
  // This will be implemented in Phase 17.3 (Execution Engine)

  addConsoleEntry('warn', 'Workflow execution engine not yet implemented (Phase 17.3)');
}

/**
 * Execute current workflow
 */
function executeCurrentWorkflow() {
  if (!workflowState.currentWorkflow) return;
  executeWorkflow(workflowState.currentWorkflow.id);
}

/**
 * Pause execution
 */
function pauseExecution() {
  addConsoleEntry('info', 'Workflow execution paused');
  // TODO: Implement pause logic in Phase 17.3
}

/**
 * Resume execution
 */
function resumeExecution() {
  addConsoleEntry('info', 'Workflow execution resumed');
  // TODO: Implement resume logic in Phase 17.3
}

/**
 * Cancel execution
 */
function cancelExecution() {
  if (confirm('Cancel workflow execution?')) {
    addConsoleEntry('info', 'Workflow execution cancelled');
    // TODO: Implement cancel logic in Phase 17.3
  }
}

/**
 * Filter workflow logs
 */
function filterWorkflowLogs() {
  // TODO: Implement log filtering
}

/**
 * Clear workflow logs
 */
function clearWorkflowLogs() {
  workflowState.logs = [];
  const logsContent = document.getElementById('workflowLogsContent');
  if (logsContent) {
    logsContent.innerHTML = '<div class="empty-state">No execution logs</div>';
  }
}

/**
 * Export workflow logs
 */
function exportWorkflowLogs() {
  if (workflowState.logs.length === 0) {
    addConsoleEntry('warn', 'No logs to export');
    return;
  }

  const json = JSON.stringify(workflowState.logs, null, 2);
  downloadJSON(workflowState.logs, `workflow-logs-${Date.now()}.json`);
  addConsoleEntry('info', 'Workflow logs exported');
}

/**
 * Create new schedule
 */
function createNewSchedule() {
  addConsoleEntry('info', 'Schedule creation not yet implemented');
  // TODO: Implement schedule creation modal
}

/**
 * Update workflow badge
 */
function updateWorkflowBadge() {
  const badge = document.getElementById('workflowBadge');
  if (badge) {
    badge.textContent = workflowState.workflows.length;
  }
}

// Helper function to generate UUID (if not already defined)
function generateUUID() {
  if (typeof window.generateUUID === 'function') {
    return window.generateUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Helper function to deep clone (if not already defined)
function deepClone(obj) {
  if (typeof window.deepClone === 'function') {
    return window.deepClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
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
  setupWorkflowUI();

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
