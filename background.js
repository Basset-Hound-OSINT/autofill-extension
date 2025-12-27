/**
 * Basset Hound Browser Automation - Background Service Worker
 *
 * This service worker manages:
 * - WebSocket connection to the Basset Hound backend
 * - Command routing and execution
 * - Response handling back to the server
 * - Reconnection logic with exponential backoff
 */

// Import utility scripts
importScripts('utils/logger.js');
importScripts('utils/network-monitor.js');
importScripts('utils/request-interceptor.js');

// Initialize logger for background script
const logger = new Logger({
  component: 'Background',
  minLevel: LogLevel.DEBUG,
  enableConsole: true,
  enableStorage: true
});

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  WS_URL: 'ws://localhost:8765/browser',
  MAX_RECONNECT_ATTEMPTS: 10,
  INITIAL_RECONNECT_DELAY: 1000,  // 1 second
  MAX_RECONNECT_DELAY: 30000,     // 30 seconds
  COMMAND_TIMEOUT: 30000,         // 30 seconds default timeout
  HEARTBEAT_INTERVAL: 30000       // 30 seconds heartbeat
};

// =============================================================================
// State Management
// =============================================================================

let ws = null;
let reconnectAttempts = 0;
let reconnectTimeout = null;
let heartbeatInterval = null;
let connectionState = 'disconnected'; // disconnected, connecting, connected

// Task queue for tracking pending operations
const taskQueue = [];

// Network request capture state (legacy - kept for backwards compatibility)
let networkCaptureEnabled = false;
const capturedNetworkRequests = [];
const MAX_CAPTURED_REQUESTS = 1000;

// Advanced network monitoring instances
const networkMonitor = new NetworkMonitor({
  maxLogSize: 2000,
  captureHeaders: true,
  captureBody: false
});

const requestInterceptor = new RequestInterceptor({
  urlPatterns: ['<all_urls>']
});

// =============================================================================
// WebSocket Connection Management
// =============================================================================

/**
 * Connect to the WebSocket server
 */
function connectWebSocket() {
  // Prevent multiple connection attempts
  if (connectionState === 'connecting') {
    logger.warn('Connection already in progress, skipping');
    return;
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    logger.info('Already connected to WebSocket server');
    return;
  }

  connectionState = 'connecting';
  logger.info('Attempting to connect to WebSocket server', { url: CONFIG.WS_URL });

  try {
    ws = new WebSocket(CONFIG.WS_URL);

    ws.onopen = handleWebSocketOpen;
    ws.onclose = handleWebSocketClose;
    ws.onerror = handleWebSocketError;
    ws.onmessage = handleWebSocketMessage;
  } catch (error) {
    logger.error('Failed to create WebSocket connection', error);
    connectionState = 'disconnected';
    scheduleReconnect();
  }
}

/**
 * Handle WebSocket connection opened
 */
function handleWebSocketOpen() {
  logger.info('Connected to Basset Hound backend');
  connectionState = 'connected';
  reconnectAttempts = 0;

  // Clear any pending reconnect
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  // Start heartbeat
  startHeartbeat();

  // Notify popup of connection status
  broadcastConnectionStatus('connected');

  // Send initial status
  sendStatus('connected');
}

/**
 * Handle WebSocket connection closed
 */
function handleWebSocketClose(event) {
  logger.warn('WebSocket connection closed', {
    code: event.code,
    reason: event.reason,
    wasClean: event.wasClean
  });

  connectionState = 'disconnected';
  ws = null;

  // Stop heartbeat
  stopHeartbeat();

  // Notify popup
  broadcastConnectionStatus('disconnected');

  // Attempt reconnection
  scheduleReconnect();
}

/**
 * Handle WebSocket error
 * @param {Event} error - WebSocket error event
 */
function handleWebSocketError(error) {
  logger.error('WebSocket error occurred', {
    message: error.message || 'Unknown error',
    type: error.type
  });
}

/**
 * Handle incoming WebSocket message
 * @param {MessageEvent} event - WebSocket message event
 */
async function handleWebSocketMessage(event) {
  logger.debug('Received message from server', { dataLength: event.data.length });

  try {
    const command = JSON.parse(event.data);
    await processCommand(command);
  } catch (error) {
    logger.error('Failed to parse or process command', error);
  }
}

/**
 * Schedule a reconnection attempt with exponential backoff
 */
function scheduleReconnect() {
  if (reconnectAttempts >= CONFIG.MAX_RECONNECT_ATTEMPTS) {
    logger.error('Max reconnection attempts reached, giving up', {
      attempts: reconnectAttempts
    });
    broadcastConnectionStatus('failed');
    return;
  }

  // Calculate delay with exponential backoff
  const delay = Math.min(
    CONFIG.INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
    CONFIG.MAX_RECONNECT_DELAY
  );

  reconnectAttempts++;
  logger.info('Scheduling reconnection attempt', {
    attempt: reconnectAttempts,
    maxAttempts: CONFIG.MAX_RECONNECT_ATTEMPTS,
    delayMs: delay
  });

  broadcastConnectionStatus('reconnecting', { attempt: reconnectAttempts, delay });

  reconnectTimeout = setTimeout(() => {
    connectWebSocket();
  }, delay);
}

/**
 * Disconnect from WebSocket server
 */
function disconnectWebSocket() {
  logger.info('Disconnecting from WebSocket server');

  // Clear reconnect timeout
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  // Stop heartbeat
  stopHeartbeat();

  // Close WebSocket
  if (ws) {
    ws.close(1000, 'User requested disconnect');
    ws = null;
  }

  connectionState = 'disconnected';
  reconnectAttempts = CONFIG.MAX_RECONNECT_ATTEMPTS; // Prevent auto-reconnect
  broadcastConnectionStatus('disconnected');
}

/**
 * Start heartbeat to keep connection alive
 */
function startHeartbeat() {
  stopHeartbeat();
  heartbeatInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
      logger.debug('Heartbeat sent');
    }
  }, CONFIG.HEARTBEAT_INTERVAL);
}

/**
 * Stop heartbeat
 */
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// =============================================================================
// Command Handlers Registry
// =============================================================================

const commandHandlers = {
  navigate: handleNavigate,
  fill_form: handleFillForm,
  click: handleClick,
  get_content: handleGetContent,
  screenshot: handleScreenshot,
  wait_for_element: handleWaitForElement,
  get_page_state: handleGetPageState,
  execute_script: handleExecuteScript,
  get_cookies: handleGetCookies,
  set_cookies: handleSetCookies,
  get_local_storage: handleGetLocalStorage,
  set_local_storage: handleSetLocalStorage,
  get_session_storage: handleGetSessionStorage,
  set_session_storage: handleSetSessionStorage,
  clear_storage: handleClearStorage,
  get_network_requests: handleGetNetworkRequests,
  // Advanced network monitoring commands
  start_network_capture: handleStartNetworkCapture,
  stop_network_capture: handleStopNetworkCapture,
  get_network_log: handleGetNetworkLog,
  clear_network_log: handleClearNetworkLog,
  // Request interception commands
  add_request_rule: handleAddRequestRule,
  remove_request_rule: handleRemoveRequestRule,
  block_urls: handleBlockUrls,
  unblock_urls: handleUnblockUrls,
  get_interception_rules: handleGetInterceptionRules,
  clear_interception_rules: handleClearInterceptionRules,
  get_network_stats: handleGetNetworkStats,
  // Advanced form automation commands
  detect_forms: handleDetectForms,
  auto_fill_form: handleAutoFillForm,
  submit_form: handleSubmitForm,
  get_form_validation: handleGetFormValidation,
  // Advanced interaction commands
  fill_select: handleFillSelect,
  fill_checkbox: handleFillCheckbox,
  fill_radio: handleFillRadio,
  fill_date: handleFillDate,
  handle_file_upload: handleFileUpload,
  navigate_multi_step: handleNavigateMultiStep,
  get_multi_step_info: handleGetMultiStepInfo
};

// =============================================================================
// Command Processing
// =============================================================================

/**
 * Process an incoming command
 * @param {Object} command - Command object with command_id, type, and params
 */
async function processCommand(command) {
  const { command_id, type, params = {} } = command;

  logger.info('Processing command', { command_id, type, params });

  // Validate command structure
  if (!command_id) {
    logger.error('Command missing command_id');
    return;
  }

  if (!type) {
    sendResponse(command_id, false, null, 'Missing command type');
    return;
  }

  // Get handler for command type
  const handler = commandHandlers[type];
  if (!handler) {
    logger.warn('Unknown command type', { type });
    sendResponse(command_id, false, null, `Unknown command type: ${type}`);
    return;
  }

  // Add to task queue
  const task = { command_id, type, params, startTime: Date.now(), status: 'running' };
  taskQueue.push(task);
  broadcastTaskUpdate();

  try {
    const result = await handler(params);
    task.status = 'completed';
    logger.info('Command completed successfully', { command_id, type });
    sendResponse(command_id, true, result);
  } catch (error) {
    task.status = 'failed';
    task.error = error.message;
    logger.error('Command failed', { command_id, type, error: error.message });
    sendResponse(command_id, false, null, error.message);
  } finally {
    task.endTime = Date.now();
    broadcastTaskUpdate();

    // Remove completed tasks older than 5 minutes
    cleanupTaskQueue();
  }
}

/**
 * Send response back to server
 * @param {string} command_id - Command ID
 * @param {boolean} success - Whether command succeeded
 * @param {*} result - Command result
 * @param {string|null} error - Error message if failed
 */
function sendResponse(command_id, success, result, error = null) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    logger.error('Cannot send response, WebSocket not connected', { command_id });
    return;
  }

  const response = {
    command_id,
    success,
    result,
    error,
    timestamp: Date.now()
  };

  try {
    ws.send(JSON.stringify(response));
    logger.debug('Response sent', { command_id, success });
  } catch (err) {
    logger.error('Failed to send response', { command_id, error: err.message });
  }
}

/**
 * Send status update to server
 * @param {string} status - Status message
 * @param {Object} data - Additional data
 */
function sendStatus(status, data = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }

  try {
    ws.send(JSON.stringify({
      type: 'status',
      status,
      data,
      timestamp: Date.now()
    }));
  } catch (error) {
    logger.error('Failed to send status', error);
  }
}

// =============================================================================
// Command Handler Implementations
// =============================================================================

/**
 * Navigate to a URL
 * @param {Object} params - { url: string, wait_for?: string }
 */
async function handleNavigate(params) {
  const { url, wait_for, timeout = CONFIG.COMMAND_TIMEOUT } = params;

  // Validate URL
  if (!url) {
    throw new Error('URL is required for navigate command');
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL format: ${url}`);
  }

  logger.info('Navigating to URL', { url, wait_for });

  return new Promise((resolve, reject) => {
    let listener = null;
    let resolved = false;

    const cleanup = () => {
      if (listener) {
        chrome.tabs.onUpdated.removeListener(listener);
        listener = null;
      }
    };

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error(`Navigation timeout after ${timeout}ms`));
      }
    }, timeout);

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (resolved) return;

      if (chrome.runtime.lastError) {
        resolved = true;
        clearTimeout(timeoutId);
        cleanup();
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      let tabId = tabs[0]?.id;

      // If no active tab, create one
      if (!tabId) {
        try {
          const newTab = await chrome.tabs.create({ url, active: true });
          tabId = newTab.id;
        } catch (err) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            cleanup();
            reject(new Error(`Failed to create tab: ${err.message}`));
          }
          return;
        }
      } else {
        // Navigate existing tab
        try {
          await chrome.tabs.update(tabId, { url });
        } catch (err) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            cleanup();
            reject(new Error(`Failed to navigate: ${err.message}`));
          }
          return;
        }
      }

      // Wait for page load
      listener = function (updatedTabId, changeInfo) {
        if (resolved) return;

        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          cleanup();

          if (wait_for) {
            // Wait for specific element
            waitForElementInTab(tabId, wait_for, timeout)
              .then(() => {
                if (!resolved) {
                  resolved = true;
                  clearTimeout(timeoutId);
                  resolve({ url, loaded: true, tabId });
                }
              })
              .catch((err) => {
                if (!resolved) {
                  resolved = true;
                  clearTimeout(timeoutId);
                  reject(err);
                }
              });
          } else {
            resolved = true;
            clearTimeout(timeoutId);
            resolve({ url, loaded: true, tabId });
          }
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    });
  });
}

/**
 * Fill form fields
 * @param {Object} params - { fields: Object, submit?: boolean }
 */
async function handleFillForm(params) {
  const { fields, submit = false } = params;

  // Validate fields
  if (!fields || typeof fields !== 'object' || Object.keys(fields).length === 0) {
    throw new Error('Fields object is required and must not be empty');
  }

  logger.info('Filling form', { fieldCount: Object.keys(fields).length, submit });

  return sendMessageToActiveTab({
    action: 'fill_form',
    fields,
    submit
  });
}

/**
 * Click an element
 * @param {Object} params - { selector: string, wait_after?: number }
 */
async function handleClick(params) {
  const { selector, wait_after = 0 } = params;

  // Validate selector
  if (!selector || typeof selector !== 'string') {
    throw new Error('Selector is required for click command');
  }

  logger.info('Clicking element', { selector, wait_after });

  return sendMessageToActiveTab({
    action: 'click_element',
    selector,
    wait_after
  });
}

/**
 * Get content from page
 * @param {Object} params - { selector?: string }
 */
async function handleGetContent(params) {
  const { selector } = params;

  logger.info('Getting content', { selector: selector || 'body' });

  return sendMessageToActiveTab({
    action: 'get_content',
    selector
  });
}

/**
 * Capture screenshot of visible tab
 * @param {Object} params - { format?: string, quality?: number }
 */
async function handleScreenshot(params) {
  const { format = 'png', quality = 100 } = params;

  // Validate format
  const validFormats = ['png', 'jpeg'];
  if (!validFormats.includes(format)) {
    throw new Error(`Invalid screenshot format: ${format}. Valid formats: ${validFormats.join(', ')}`);
  }

  // Validate quality
  if (typeof quality !== 'number' || quality < 1 || quality > 100) {
    throw new Error('Quality must be a number between 1 and 100');
  }

  logger.info('Capturing screenshot', { format, quality });

  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.captureVisibleTab(
        null,
        { format, quality },
        (dataUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve({ screenshot: dataUrl, format });
        }
      );
    } catch (error) {
      reject(new Error(`Screenshot capture failed: ${error.message}`));
    }
  });
}

/**
 * Wait for an element to appear
 * @param {Object} params - { selector: string, timeout?: number }
 */
async function handleWaitForElement(params) {
  const { selector, timeout = 10000 } = params;

  // Validate selector
  if (!selector || typeof selector !== 'string') {
    throw new Error('Selector is required for wait_for_element command');
  }

  logger.info('Waiting for element', { selector, timeout });

  return sendMessageToActiveTab({
    action: 'wait_for_element',
    selector,
    timeout
  });
}

/**
 * Get current page state including forms, links, buttons
 * @param {Object} params - Optional parameters
 */
async function handleGetPageState(params = {}) {
  logger.info('Getting page state');

  return sendMessageToActiveTab({
    action: 'get_page_state'
  });
}

/**
 * Execute custom JavaScript in page context
 * @param {Object} params - { script: string }
 */
async function handleExecuteScript(params) {
  const { script } = params;

  // Validate script
  if (!script || typeof script !== 'string') {
    throw new Error('Script is required for execute_script command');
  }

  logger.info('Executing custom script', { scriptLength: script.length });

  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      const tabId = tabs[0]?.id;
      if (!tabId) {
        reject(new Error('No active tab found'));
        return;
      }

      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: (code) => {
            try {
              // Execute the script and return the result
              return { success: true, result: eval(code) };
            } catch (error) {
              return { success: false, error: error.message };
            }
          },
          args: [script],
          world: 'MAIN' // Execute in page context
        });

        const result = results[0]?.result;
        if (result && !result.success) {
          reject(new Error(result.error));
        } else {
          resolve(result);
        }
      } catch (error) {
        reject(new Error(`Script execution failed: ${error.message}`));
      }
    });
  });
}

// =============================================================================
// Cookie Command Handlers
// =============================================================================

/**
 * Get cookies for current domain or specified domain
 * @param {Object} params - { domain?: string, url?: string, name?: string }
 */
async function handleGetCookies(params = {}) {
  const { domain, url, name } = params;

  logger.info('Getting cookies', { domain, url, name });

  try {
    // Build query object
    const query = {};

    if (url) {
      // Validate URL format
      try {
        new URL(url);
        query.url = url;
      } catch {
        throw new Error(`Invalid URL format: ${url}`);
      }
    } else if (domain) {
      query.domain = domain;
    } else {
      // Get URL from active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.url) {
        throw new Error('No active tab with URL found');
      }
      query.url = activeTab.url;
    }

    if (name) {
      query.name = name;
    }

    const cookies = await chrome.cookies.getAll(query);

    return {
      cookies: cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expirationDate: cookie.expirationDate,
        hostOnly: cookie.hostOnly,
        session: cookie.session
      })),
      count: cookies.length,
      query
    };
  } catch (error) {
    throw new Error(`Failed to get cookies: ${error.message}`);
  }
}

/**
 * Set cookies
 * @param {Object} params - { cookies: Array<{name, value, url?, domain?, path?, secure?, httpOnly?, sameSite?, expirationDate?}> }
 */
async function handleSetCookies(params = {}) {
  const { cookies } = params;

  // Validate cookies array
  if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
    throw new Error('Cookies array is required and must not be empty');
  }

  logger.info('Setting cookies', { count: cookies.length });

  const results = [];

  for (const cookie of cookies) {
    try {
      // Validate required fields
      if (!cookie.name) {
        results.push({ success: false, error: 'Cookie name is required', cookie });
        continue;
      }

      // Build cookie object for Chrome API
      const cookieDetails = {
        name: cookie.name,
        value: cookie.value || ''
      };

      // URL is required by Chrome API - use url or construct from domain
      if (cookie.url) {
        try {
          new URL(cookie.url);
          cookieDetails.url = cookie.url;
        } catch {
          results.push({ success: false, error: `Invalid URL format: ${cookie.url}`, cookie });
          continue;
        }
      } else if (cookie.domain) {
        // Construct URL from domain
        const protocol = cookie.secure ? 'https' : 'http';
        const domainWithoutDot = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
        cookieDetails.url = `${protocol}://${domainWithoutDot}${cookie.path || '/'}`;
      } else {
        // Get URL from active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];
        if (!activeTab || !activeTab.url) {
          results.push({ success: false, error: 'No URL specified and no active tab', cookie });
          continue;
        }
        cookieDetails.url = activeTab.url;
      }

      // Optional fields
      if (cookie.domain !== undefined) cookieDetails.domain = cookie.domain;
      if (cookie.path !== undefined) cookieDetails.path = cookie.path;
      if (cookie.secure !== undefined) cookieDetails.secure = cookie.secure;
      if (cookie.httpOnly !== undefined) cookieDetails.httpOnly = cookie.httpOnly;
      if (cookie.sameSite !== undefined) cookieDetails.sameSite = cookie.sameSite;
      if (cookie.expirationDate !== undefined) cookieDetails.expirationDate = cookie.expirationDate;

      const setCookie = await chrome.cookies.set(cookieDetails);

      if (setCookie) {
        results.push({ success: true, name: cookie.name, domain: setCookie.domain });
      } else {
        results.push({ success: false, error: 'Cookie was not set (possibly blocked)', cookie });
      }
    } catch (error) {
      results.push({ success: false, error: error.message, cookie });
    }
  }

  const successCount = results.filter(r => r.success).length;
  return {
    success: successCount === cookies.length,
    results,
    successCount,
    totalCount: cookies.length
  };
}

// =============================================================================
// Storage Command Handlers (localStorage, sessionStorage)
// =============================================================================

/**
 * Get localStorage items from the active tab
 * @param {Object} params - { keys?: string[] } - If keys not specified, returns all items
 */
async function handleGetLocalStorage(params = {}) {
  const { keys } = params;

  logger.info('Getting localStorage', { keys: keys || 'all' });

  return sendMessageToActiveTab({
    action: 'get_local_storage',
    keys
  });
}

/**
 * Set localStorage items in the active tab
 * @param {Object} params - { items: Object } - Key-value pairs to set
 */
async function handleSetLocalStorage(params = {}) {
  const { items } = params;

  // Validate items
  if (!items || typeof items !== 'object' || Object.keys(items).length === 0) {
    throw new Error('Items object is required and must not be empty');
  }

  logger.info('Setting localStorage', { count: Object.keys(items).length });

  return sendMessageToActiveTab({
    action: 'set_local_storage',
    items
  });
}

/**
 * Get sessionStorage items from the active tab
 * @param {Object} params - { keys?: string[] } - If keys not specified, returns all items
 */
async function handleGetSessionStorage(params = {}) {
  const { keys } = params;

  logger.info('Getting sessionStorage', { keys: keys || 'all' });

  return sendMessageToActiveTab({
    action: 'get_session_storage',
    keys
  });
}

/**
 * Set sessionStorage items in the active tab
 * @param {Object} params - { items: Object } - Key-value pairs to set
 */
async function handleSetSessionStorage(params = {}) {
  const { items } = params;

  // Validate items
  if (!items || typeof items !== 'object' || Object.keys(items).length === 0) {
    throw new Error('Items object is required and must not be empty');
  }

  logger.info('Setting sessionStorage', { count: Object.keys(items).length });

  return sendMessageToActiveTab({
    action: 'set_session_storage',
    items
  });
}

/**
 * Clear all storage (cookies, localStorage, sessionStorage)
 * @param {Object} params - { types?: string[], domain?: string }
 *   types: Array of storage types to clear: 'cookies', 'localStorage', 'sessionStorage'
 *   If not specified, clears all types
 */
async function handleClearStorage(params = {}) {
  const { types, domain } = params;

  // Default to all types if not specified
  const storagesToClear = types || ['cookies', 'localStorage', 'sessionStorage'];

  logger.info('Clearing storage', { types: storagesToClear, domain });

  const results = {};

  // Clear cookies
  if (storagesToClear.includes('cookies')) {
    try {
      const query = {};

      if (domain) {
        query.domain = domain;
      } else {
        // Get domain from active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];
        if (activeTab && activeTab.url) {
          query.url = activeTab.url;
        }
      }

      const cookies = await chrome.cookies.getAll(query);
      let deletedCount = 0;

      for (const cookie of cookies) {
        try {
          const protocol = cookie.secure ? 'https' : 'http';
          const cookieUrl = `${protocol}://${cookie.domain}${cookie.path}`;
          await chrome.cookies.remove({ url: cookieUrl, name: cookie.name });
          deletedCount++;
        } catch (error) {
          logger.warn('Failed to delete cookie', { name: cookie.name, error: error.message });
        }
      }

      results.cookies = { success: true, deleted: deletedCount, total: cookies.length };
    } catch (error) {
      results.cookies = { success: false, error: error.message };
    }
  }

  // Clear localStorage and sessionStorage via content script
  if (storagesToClear.includes('localStorage') || storagesToClear.includes('sessionStorage')) {
    try {
      const storageResult = await sendMessageToActiveTab({
        action: 'clear_storage',
        types: storagesToClear.filter(t => t !== 'cookies')
      });
      if (storagesToClear.includes('localStorage')) {
        results.localStorage = storageResult.localStorage || { success: true };
      }
      if (storagesToClear.includes('sessionStorage')) {
        results.sessionStorage = storageResult.sessionStorage || { success: true };
      }
    } catch (error) {
      if (storagesToClear.includes('localStorage')) {
        results.localStorage = { success: false, error: error.message };
      }
      if (storagesToClear.includes('sessionStorage')) {
        results.sessionStorage = { success: false, error: error.message };
      }
    }
  }

  return {
    success: Object.values(results).every(r => r.success),
    results
  };
}

// =============================================================================
// Network Request Capture Handlers
// =============================================================================

/**
 * Network request listener for capturing requests
 * @param {Object} details - Request details from webRequest API
 */
function networkRequestListener(details) {
  if (!networkCaptureEnabled) return;

  const requestData = {
    id: details.requestId,
    url: details.url,
    method: details.method,
    type: details.type,
    tabId: details.tabId,
    frameId: details.frameId,
    timestamp: details.timeStamp,
    initiator: details.initiator || null,
    requestHeaders: details.requestHeaders || null
  };

  capturedNetworkRequests.push(requestData);

  // Limit the number of captured requests
  if (capturedNetworkRequests.length > MAX_CAPTURED_REQUESTS) {
    capturedNetworkRequests.shift();
  }

  logger.debug('Network request captured', { url: details.url, method: details.method });
}

/**
 * Network response listener for capturing response headers
 * @param {Object} details - Response details from webRequest API
 */
function networkResponseListener(details) {
  if (!networkCaptureEnabled) return;

  // Find the corresponding request and add response data
  const request = capturedNetworkRequests.find(r => r.id === details.requestId);
  if (request) {
    request.statusCode = details.statusCode;
    request.statusLine = details.statusLine;
    request.responseHeaders = details.responseHeaders || null;
    request.responseTimestamp = details.timeStamp;
  }
}

/**
 * Start or stop network request capture, or get captured requests
 * @param {Object} params - { action: 'start' | 'stop' | 'get' | 'clear', filter?: { urls?: string[], types?: string[] } }
 */
async function handleGetNetworkRequests(params = {}) {
  const { action = 'get', filter } = params;

  logger.info('Network requests command', { action, filter });

  switch (action) {
    case 'start': {
      if (networkCaptureEnabled) {
        return { success: true, message: 'Network capture already running', capturing: true };
      }

      // Set up filters
      const urlFilter = filter?.urls || ['<all_urls>'];
      const typeFilter = filter?.types || [
        'main_frame', 'sub_frame', 'stylesheet', 'script', 'image',
        'font', 'object', 'xmlhttprequest', 'ping', 'media', 'websocket', 'other'
      ];

      try {
        // Add request listener
        chrome.webRequest.onBeforeSendHeaders.addListener(
          networkRequestListener,
          { urls: urlFilter, types: typeFilter },
          ['requestHeaders']
        );

        // Add response listener
        chrome.webRequest.onHeadersReceived.addListener(
          networkResponseListener,
          { urls: urlFilter, types: typeFilter },
          ['responseHeaders']
        );

        networkCaptureEnabled = true;
        logger.info('Network capture started');

        return {
          success: true,
          message: 'Network capture started',
          capturing: true,
          filter: { urls: urlFilter, types: typeFilter }
        };
      } catch (error) {
        throw new Error(`Failed to start network capture: ${error.message}`);
      }
    }

    case 'stop': {
      if (!networkCaptureEnabled) {
        return { success: true, message: 'Network capture was not running', capturing: false };
      }

      try {
        chrome.webRequest.onBeforeSendHeaders.removeListener(networkRequestListener);
        chrome.webRequest.onHeadersReceived.removeListener(networkResponseListener);

        networkCaptureEnabled = false;
        logger.info('Network capture stopped');

        return {
          success: true,
          message: 'Network capture stopped',
          capturing: false,
          capturedCount: capturedNetworkRequests.length
        };
      } catch (error) {
        throw new Error(`Failed to stop network capture: ${error.message}`);
      }
    }

    case 'get': {
      // Apply filters if specified
      let requests = [...capturedNetworkRequests];

      if (filter) {
        if (filter.urls && filter.urls.length > 0) {
          requests = requests.filter(req =>
            filter.urls.some(pattern => {
              if (pattern === '<all_urls>') return true;
              // Simple pattern matching (supports * wildcard)
              const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
              return regex.test(req.url);
            })
          );
        }

        if (filter.types && filter.types.length > 0) {
          requests = requests.filter(req => filter.types.includes(req.type));
        }

        if (filter.methods && filter.methods.length > 0) {
          requests = requests.filter(req => filter.methods.includes(req.method));
        }

        if (filter.tabId !== undefined) {
          requests = requests.filter(req => req.tabId === filter.tabId);
        }
      }

      return {
        success: true,
        capturing: networkCaptureEnabled,
        requests,
        count: requests.length,
        totalCaptured: capturedNetworkRequests.length
      };
    }

    case 'clear': {
      const previousCount = capturedNetworkRequests.length;
      capturedNetworkRequests.length = 0;

      logger.info('Network capture buffer cleared');

      return {
        success: true,
        message: 'Captured requests cleared',
        previousCount,
        capturing: networkCaptureEnabled
      };
    }

    default:
      throw new Error(`Unknown network capture action: ${action}. Valid actions: start, stop, get, clear`);
  }
}

// =============================================================================
// Advanced Network Monitoring Command Handlers
// =============================================================================

/**
 * Start network capture using advanced NetworkMonitor
 * @param {Object} params - Capture configuration
 * @param {Array<string>} params.urlPatterns - URL patterns to monitor
 * @param {Array<string>} params.methods - HTTP methods to capture
 * @param {Array<string>} params.types - Resource types to capture
 * @param {boolean} params.captureHeaders - Whether to capture headers
 * @param {boolean} params.captureBody - Whether to capture request bodies
 */
async function handleStartNetworkCapture(params = {}) {
  logger.info('Starting advanced network capture', params);

  // Update monitor configuration if provided
  if (Object.keys(params).length > 0) {
    networkMonitor.updateConfig(params);
  }

  const result = networkMonitor.startCapture();

  if (result.success) {
    logger.info('Advanced network capture started');
  }

  return result;
}

/**
 * Stop network capture and return captured data
 * @param {Object} params - Options
 * @param {boolean} params.includeLog - Whether to include the full log (default: true)
 * @param {boolean} params.exportHAR - Whether to export as HAR format (default: false)
 */
async function handleStopNetworkCapture(params = {}) {
  const { includeLog = true, exportHAR = false } = params;

  logger.info('Stopping advanced network capture', { includeLog, exportHAR });

  const result = networkMonitor.stopCapture();

  if (result.success && includeLog) {
    result.log = networkMonitor.getLog();

    if (exportHAR) {
      result.har = networkMonitor.exportAsHAR();
    }
  }

  return result;
}

/**
 * Get current network log with optional filtering
 * @param {Object} params - Filter options
 * @param {string} params.urlPattern - Filter by URL pattern (regex)
 * @param {string} params.method - Filter by HTTP method
 * @param {string} params.type - Filter by resource type
 * @param {string} params.status - Filter by status ('completed', 'failed', 'redirected')
 * @param {number} params.limit - Maximum entries to return
 * @param {number} params.offset - Entries to skip
 * @param {boolean} params.exportHAR - Export as HAR format
 */
async function handleGetNetworkLog(params = {}) {
  const { exportHAR = false, ...filterOptions } = params;

  logger.info('Getting network log', filterOptions);

  const log = networkMonitor.getLog(filterOptions);
  const stats = networkMonitor.getStats();

  const result = {
    success: true,
    log,
    count: log.length,
    stats
  };

  if (exportHAR) {
    result.har = networkMonitor.exportAsHAR();
  }

  return result;
}

/**
 * Clear the network log
 */
async function handleClearNetworkLog() {
  logger.info('Clearing network log');
  return networkMonitor.clearLog();
}

/**
 * Get network monitoring and interception statistics
 */
async function handleGetNetworkStats() {
  logger.info('Getting network statistics');

  return {
    success: true,
    monitor: networkMonitor.getStats(),
    interceptor: requestInterceptor.getStats()
  };
}

// =============================================================================
// Request Interception Command Handlers
// =============================================================================

/**
 * Add a request interception rule
 * @param {Object} params - Rule configuration
 * @param {string} params.id - Unique rule identifier
 * @param {string} params.type - Rule type: 'header', 'block', 'mock', 'redirect'
 * @param {Object} params.config - Type-specific configuration
 */
async function handleAddRequestRule(params = {}) {
  const { id, type, config } = params;

  if (!id || !type) {
    throw new Error('Rule id and type are required');
  }

  logger.info('Adding request interception rule', { id, type });

  // Ensure interceptor is active
  if (!requestInterceptor.isActive) {
    requestInterceptor.activate();
  }

  const result = requestInterceptor.addRule({ id, type, config });

  if (!result.success) {
    throw new Error(result.message);
  }

  return result;
}

/**
 * Remove a request interception rule
 * @param {Object} params - Rule identifier
 * @param {string} params.id - Rule ID to remove
 * @param {string} params.type - Rule type (optional)
 */
async function handleRemoveRequestRule(params = {}) {
  const { id, type } = params;

  if (!id) {
    throw new Error('Rule id is required');
  }

  logger.info('Removing request interception rule', { id, type });

  const result = requestInterceptor.removeRule(id, type);

  if (!result.success) {
    throw new Error(result.message);
  }

  return result;
}

/**
 * Block specific URL patterns
 * @param {Object} params - Block configuration
 * @param {Array<string>} params.patterns - URL patterns to block
 */
async function handleBlockUrls(params = {}) {
  const { patterns } = params;

  if (!patterns || !Array.isArray(patterns) || patterns.length === 0) {
    throw new Error('Patterns array is required');
  }

  logger.info('Blocking URLs', { patternCount: patterns.length });

  // Ensure interceptor is active
  if (!requestInterceptor.isActive) {
    requestInterceptor.activate();
  }

  return requestInterceptor.blockUrls(patterns);
}

/**
 * Remove URL blocks
 * @param {Object} params - Unblock configuration
 * @param {Array<string>} params.ruleIds - Rule IDs to remove
 * @param {boolean} params.clearAll - Clear all block rules
 */
async function handleUnblockUrls(params = {}) {
  const { ruleIds, clearAll = false } = params;

  logger.info('Unblocking URLs', { ruleIds, clearAll });

  if (clearAll) {
    return requestInterceptor.clearBlockRules();
  }

  if (!ruleIds || !Array.isArray(ruleIds) || ruleIds.length === 0) {
    throw new Error('Rule IDs array is required (or set clearAll: true)');
  }

  return requestInterceptor.unblockUrls(ruleIds);
}

/**
 * Get all interception rules
 * @param {Object} params - Filter options
 * @param {string} params.type - Filter by rule type
 */
async function handleGetInterceptionRules(params = {}) {
  const { type } = params;

  logger.info('Getting interception rules', { type });

  if (type) {
    switch (type) {
      case 'header':
        return { success: true, rules: requestInterceptor.getHeaderRules() };
      case 'block':
        return { success: true, rules: requestInterceptor.getBlockRules() };
      case 'mock':
        return { success: true, rules: requestInterceptor.getMockRules() };
      case 'redirect':
        return { success: true, rules: requestInterceptor.getRedirectRules() };
      default:
        throw new Error(`Unknown rule type: ${type}`);
    }
  }

  return {
    success: true,
    rules: requestInterceptor.getAllRules(),
    stats: requestInterceptor.getStats()
  };
}

/**
 * Clear all interception rules
 * @param {Object} params - Clear options
 * @param {string} params.type - Clear only specific type (optional)
 */
async function handleClearInterceptionRules(params = {}) {
  const { type } = params;

  logger.info('Clearing interception rules', { type });

  if (type) {
    switch (type) {
      case 'header':
        const headerCount = requestInterceptor.headerRules.size;
        requestInterceptor.headerRules.clear();
        return { success: true, message: `Cleared ${headerCount} header rules` };
      case 'block':
        return requestInterceptor.clearBlockRules();
      case 'mock':
        const mockCount = requestInterceptor.mockRules.size;
        requestInterceptor.mockRules.clear();
        return { success: true, message: `Cleared ${mockCount} mock rules` };
      case 'redirect':
        const redirectCount = requestInterceptor.redirectRules.size;
        requestInterceptor.redirectRules.clear();
        return { success: true, message: `Cleared ${redirectCount} redirect rules` };
      default:
        throw new Error(`Unknown rule type: ${type}`);
    }
  }

  return requestInterceptor.clearAllRules();
}

// =============================================================================
// Advanced Form Automation Command Handlers
// =============================================================================

/**
 * Detect and analyze all forms on the current page
 * @param {Object} params - Detection options
 * @param {boolean} params.includeHidden - Include hidden forms
 */
async function handleDetectForms(params = {}) {
  logger.info('Detecting forms on page', params);

  return sendMessageToActiveTab({
    action: 'detect_forms',
    options: params
  });
}

/**
 * Auto-fill a form using template data
 * @param {Object} params - Auto-fill parameters
 * @param {string} params.formSelector - CSS selector for target form
 * @param {Object} params.data - Data to fill (field mappings or template data)
 * @param {Object} params.options - Fill options
 * @param {boolean} params.options.humanLike - Use human-like typing (default: true)
 * @param {boolean} params.options.skipHidden - Skip hidden fields (default: true)
 * @param {boolean} params.options.validateBefore - Validate before submit
 * @param {boolean} params.options.submitAfter - Submit after filling
 */
async function handleAutoFillForm(params = {}) {
  const { formSelector, data, options = {} } = params;

  logger.info('Auto-filling form', { formSelector, options });

  // Validate data
  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
    throw new Error('Data object is required for auto-fill');
  }

  return sendMessageToActiveTab({
    action: 'auto_fill_form',
    formSelector,
    data,
    options
  });
}

/**
 * Submit a form
 * @param {Object} params - Submit parameters
 * @param {string} params.formSelector - CSS selector for target form
 * @param {Object} params.options - Submit options
 * @param {boolean} params.options.clickSubmit - Click submit button vs form.submit()
 * @param {boolean} params.options.waitForNavigation - Wait for navigation
 */
async function handleSubmitForm(params = {}) {
  const { formSelector, options = {} } = params;

  logger.info('Submitting form', { formSelector, options });

  return sendMessageToActiveTab({
    action: 'submit_form',
    formSelector,
    options
  });
}

/**
 * Get form validation errors
 * @param {Object} params - Validation parameters
 * @param {string} params.formSelector - CSS selector for target form
 */
async function handleGetFormValidation(params = {}) {
  const { formSelector } = params;

  logger.info('Getting form validation', { formSelector });

  return sendMessageToActiveTab({
    action: 'get_form_validation',
    formSelector
  });
}

/**
 * Fill a select/dropdown element
 * @param {Object} params - Select parameters
 * @param {string} params.selector - CSS selector for select element
 * @param {string} params.value - Value to select
 * @param {Object} params.options - Options
 * @param {boolean} params.options.byText - Select by text instead of value
 */
async function handleFillSelect(params = {}) {
  const { selector, value, options = {} } = params;

  if (!selector) {
    throw new Error('Selector is required for fill_select');
  }

  logger.info('Filling select', { selector, value, options });

  return sendMessageToActiveTab({
    action: 'fill_select',
    selector,
    value,
    options
  });
}

/**
 * Fill a checkbox
 * @param {Object} params - Checkbox parameters
 * @param {string} params.selector - CSS selector for checkbox
 * @param {boolean} params.checked - Whether to check or uncheck
 */
async function handleFillCheckbox(params = {}) {
  const { selector, checked = true } = params;

  if (!selector) {
    throw new Error('Selector is required for fill_checkbox');
  }

  logger.info('Filling checkbox', { selector, checked });

  return sendMessageToActiveTab({
    action: 'fill_checkbox',
    selector,
    checked
  });
}

/**
 * Fill a radio button group
 * @param {Object} params - Radio parameters
 * @param {string} params.name - Radio button group name
 * @param {string} params.value - Value to select
 */
async function handleFillRadio(params = {}) {
  const { name, value } = params;

  if (!name) {
    throw new Error('Name is required for fill_radio');
  }
  if (value === undefined) {
    throw new Error('Value is required for fill_radio');
  }

  logger.info('Filling radio', { name, value });

  return sendMessageToActiveTab({
    action: 'fill_radio',
    name,
    value
  });
}

/**
 * Fill a date input
 * @param {Object} params - Date parameters
 * @param {string} params.selector - CSS selector for date input
 * @param {string} params.date - Date value (YYYY-MM-DD format)
 * @param {Object} params.options - Options
 */
async function handleFillDate(params = {}) {
  const { selector, date, options = {} } = params;

  if (!selector) {
    throw new Error('Selector is required for fill_date');
  }
  if (!date) {
    throw new Error('Date is required for fill_date');
  }

  logger.info('Filling date', { selector, date, options });

  return sendMessageToActiveTab({
    action: 'fill_date',
    selector,
    date,
    options
  });
}

/**
 * Handle file upload (provides information, cannot directly set files)
 * @param {Object} params - File upload parameters
 * @param {string} params.selector - CSS selector for file input
 * @param {Object} params.fileInfo - Information about files to upload
 */
async function handleFileUpload(params = {}) {
  const { selector, fileInfo } = params;

  if (!selector) {
    throw new Error('Selector is required for handle_file_upload');
  }

  logger.info('Handling file upload', { selector, fileInfo });

  return sendMessageToActiveTab({
    action: 'handle_file_upload',
    selector,
    fileInfo
  });
}

/**
 * Navigate multi-step form (next/prev)
 * @param {Object} params - Navigation parameters
 * @param {string} params.formSelector - CSS selector for form
 * @param {string} params.direction - 'next' or 'prev'
 */
async function handleNavigateMultiStep(params = {}) {
  const { formSelector, direction = 'next' } = params;

  if (!['next', 'prev'].includes(direction)) {
    throw new Error('Direction must be "next" or "prev"');
  }

  logger.info('Navigating multi-step form', { formSelector, direction });

  return sendMessageToActiveTab({
    action: 'navigate_multi_step',
    formSelector,
    direction
  });
}

/**
 * Get multi-step form information
 * @param {Object} params - Parameters
 * @param {string} params.formSelector - CSS selector for form
 */
async function handleGetMultiStepInfo(params = {}) {
  const { formSelector } = params;

  logger.info('Getting multi-step form info', { formSelector });

  return sendMessageToActiveTab({
    action: 'get_multi_step_info',
    formSelector
  });
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Send a message to the active tab's content script
 * @param {Object} message - Message to send
 * @returns {Promise<*>} - Response from content script
 */
function sendMessageToActiveTab(message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      const tabId = tabs[0]?.id;
      if (!tabId) {
        reject(new Error('No active tab found'));
        return;
      }

      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          // Content script might not be loaded, try injecting it
          injectContentScriptAndRetry(tabId, message)
            .then(resolve)
            .catch(reject);
        } else {
          resolve(response);
        }
      });
    });
  });
}

/**
 * Inject content script and retry message
 * @param {number} tabId - Tab ID
 * @param {Object} message - Message to send
 */
async function injectContentScriptAndRetry(tabId, message) {
  logger.info('Injecting content script into tab', { tabId });

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['utils/logger.js', 'content.js']
    });

    // Wait a bit for script to initialize
    await new Promise(resolve => setTimeout(resolve, 100));

    // Retry message
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  } catch (error) {
    throw new Error(`Failed to inject content script: ${error.message}`);
  }
}

/**
 * Wait for element in a specific tab
 * @param {number} tabId - Tab ID
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in ms
 */
function waitForElementInTab(tabId, selector, timeout) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, {
      action: 'wait_for_element',
      selector,
      timeout
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response && response.found) {
        resolve(response);
      } else {
        reject(new Error(`Element not found: ${selector}`));
      }
    });
  });
}

/**
 * Broadcast connection status to popup
 * @param {string} status - Connection status
 * @param {Object} data - Additional data
 */
function broadcastConnectionStatus(status, data = {}) {
  chrome.runtime.sendMessage({
    type: 'connection_status',
    status,
    data,
    timestamp: Date.now()
  }).catch(() => {
    // Popup might not be open, ignore errors
  });

  // Also store in local storage for popup to check
  chrome.storage.local.set({
    connectionStatus: status,
    connectionData: data,
    lastUpdated: Date.now()
  });
}

/**
 * Broadcast task queue update to popup
 */
function broadcastTaskUpdate() {
  const recentTasks = taskQueue.slice(-10); // Only send last 10 tasks

  chrome.runtime.sendMessage({
    type: 'task_update',
    tasks: recentTasks,
    timestamp: Date.now()
  }).catch(() => {
    // Popup might not be open, ignore errors
  });

  // Also store in local storage
  chrome.storage.local.set({
    taskQueue: recentTasks,
    lastUpdated: Date.now()
  });
}

/**
 * Clean up old tasks from queue
 */
function cleanupTaskQueue() {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

  while (taskQueue.length > 0 && taskQueue[0].endTime && taskQueue[0].endTime < fiveMinutesAgo) {
    taskQueue.shift();
  }

  // Keep max 50 tasks
  while (taskQueue.length > 50) {
    taskQueue.shift();
  }
}

// =============================================================================
// Message Handlers from Popup/Other Extension Parts
// =============================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  logger.debug('Received internal message', { type: request.type });

  switch (request.type) {
    case 'get_status':
      sendResponse({
        connectionState,
        reconnectAttempts,
        taskCount: taskQueue.length
      });
      return true;

    case 'connect':
      reconnectAttempts = 0; // Reset attempts for manual connect
      connectWebSocket();
      sendResponse({ status: 'connecting' });
      return true;

    case 'disconnect':
      disconnectWebSocket();
      sendResponse({ status: 'disconnected' });
      return true;

    case 'get_tasks':
      sendResponse({ tasks: taskQueue.slice(-20) });
      return true;

    case 'clear_tasks':
      taskQueue.length = 0;
      broadcastTaskUpdate();
      sendResponse({ status: 'cleared' });
      return true;
  }
});

// =============================================================================
// Extension Lifecycle Events
// =============================================================================

// Initialize on install
chrome.runtime.onInstalled.addListener((details) => {
  logger.info('Extension installed', { reason: details.reason });

  // Set default storage values
  chrome.storage.local.set({
    connectionStatus: 'disconnected',
    taskQueue: [],
    settings: {
      autoConnect: true,
      wsUrl: CONFIG.WS_URL
    }
  });

  // Auto-connect on install
  connectWebSocket();
});

// Reconnect on startup
chrome.runtime.onStartup.addListener(() => {
  logger.info('Extension started');

  // Check if auto-connect is enabled
  chrome.storage.local.get('settings', (result) => {
    if (result.settings?.autoConnect !== false) {
      connectWebSocket();
    }
  });
});

// Note: Service workers don't have beforeunload events like regular pages.
// The WebSocket connection will be closed automatically when the service worker stops.
// We handle reconnection in onStartup and when messages are received.

// Handle content script ready notifications
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'content_script_ready') {
    logger.debug('Content script ready', { url: request.url, tabId: sender.tab?.id });
    sendResponse({ acknowledged: true });
    return true;
  }
});

// Log that background script has loaded
logger.info('Background service worker initialized');

// Attempt initial connection
connectWebSocket();
