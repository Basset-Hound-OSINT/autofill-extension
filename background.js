/**
 * Basset Hound Browser Automation - Background Service Worker
 *
 * This service worker manages:
 * - WebSocket connection to the Basset Hound backend
 * - Command routing and execution
 * - Response handling back to the server
 * - Reconnection logic with exponential backoff
 */

// Debug: Track service worker initialization
console.log('[Basset Hound] Service worker starting...');

// Import utility scripts with error tracking
try {
  console.log('[Basset Hound] Importing logger.js...');
  importScripts('utils/logger.js');
  console.log('[Basset Hound] logger.js loaded successfully');
} catch (e) {
  console.error('[Basset Hound] Failed to load logger.js:', e.message);
}

try {
  console.log('[Basset Hound] Importing network-monitor.js...');
  importScripts('utils/network-monitor.js');
  console.log('[Basset Hound] network-monitor.js loaded successfully');
} catch (e) {
  console.error('[Basset Hound] Failed to load network-monitor.js:', e.message);
}

try {
  console.log('[Basset Hound] Importing network-exporter.js...');
  importScripts('utils/network-exporter.js');
  console.log('[Basset Hound] network-exporter.js loaded successfully');
} catch (e) {
  console.error('[Basset Hound] Failed to load network-exporter.js:', e.message);
}

try {
  console.log('[Basset Hound] Importing request-interceptor.js...');
  importScripts('utils/request-interceptor.js');
  console.log('[Basset Hound] request-interceptor.js loaded successfully');
} catch (e) {
  console.error('[Basset Hound] Failed to load request-interceptor.js:', e.message);
}

try {
  console.log('[Basset Hound] Importing user-agent-rotator.js...');
  importScripts('utils/user-agent-rotator.js');
  console.log('[Basset Hound] user-agent-rotator.js loaded successfully');
} catch (e) {
  console.error('[Basset Hound] Failed to load user-agent-rotator.js:', e.message);
}

try {
  console.log('[Basset Hound] Importing rate-limiter.js...');
  importScripts('utils/rate-limiter.js');
  console.log('[Basset Hound] rate-limiter.js loaded successfully');
} catch (e) {
  console.error('[Basset Hound] Failed to load rate-limiter.js:', e.message);
}

try {
  console.log('[Basset Hound] Importing OSINT handlers...');
  importScripts('utils/osint-handlers/shodan.js');
  importScripts('utils/osint-handlers/haveibeenpwned.js');
  importScripts('utils/osint-handlers/whois.js');
  importScripts('utils/osint-handlers/wayback.js');
  importScripts('utils/osint-handlers/hunter.js');
  importScripts('utils/osint-handlers/social-media.js');
  console.log('[Basset Hound] OSINT handlers loaded successfully');
} catch (e) {
  console.error('[Basset Hound] Failed to load OSINT handlers:', e.message);
}

try {
  console.log('[Basset Hound] Importing security modules...');
  importScripts('utils/security/input-validator.js');
  importScripts('utils/security/websocket-auth.js');
  importScripts('utils/security/privacy-controls.js');
  importScripts('utils/security/audit-logger.js');
  console.log('[Basset Hound] Security modules loaded successfully');
} catch (e) {
  console.error('[Basset Hound] Failed to load security modules:', e.message);
}

try {
  console.log('[Basset Hound] Importing knowledge-base...');
  importScripts('utils/knowledge-base/tool-parser.js');
  console.log('[Basset Hound] Knowledge-base loaded successfully');
} catch (e) {
  console.error('[Basset Hound] Failed to load knowledge-base:', e.message);
}

try {
  console.log('[Basset Hound] Importing data-pipeline...');
  importScripts('utils/data-pipeline/normalizer.js');
  importScripts('utils/data-pipeline/entity-manager.js');
  importScripts('utils/data-pipeline/basset-hound-sync.js');
  console.log('[Basset Hound] Data-pipeline loaded successfully');
} catch (e) {
  console.error('[Basset Hound] Failed to load data-pipeline:', e.message);
}

try {
  console.log('[Basset Hound] Importing Phase 8 OSINT data ingestion modules...');
  importScripts('utils/data-pipeline/field-detector.js');
  importScripts('utils/data-pipeline/verifier.js');
  importScripts('utils/data-pipeline/provenance.js');
  importScripts('utils/ui/ingest-panel.js');
  importScripts('utils/ui/element-picker.js');
  console.log('[Basset Hound] Phase 8 OSINT modules loaded successfully');
} catch (e) {
  console.error('[Basset Hound] Failed to load Phase 8 OSINT modules:', e.message);
}

try {
  console.log('[Basset Hound] Importing agent modules...');
  importScripts('utils/agent/callbacks.js');
  importScripts('utils/agent/message-schema.js');
  importScripts('utils/agent/streaming.js');
  console.log('[Basset Hound] Agent modules loaded successfully');
} catch (e) {
  console.error('[Basset Hound] Failed to load agent modules:', e.message);
}

try {
  console.log('[Basset Hound] Importing Phase 14 evidence modules...');
  importScripts('utils/evidence/chain-of-custody.js');
  importScripts('utils/evidence/evidence-capture.js');
  importScripts('utils/evidence/session-manager.js');
  console.log('[Basset Hound] Phase 14 evidence modules loaded successfully');
} catch (e) {
  console.error('[Basset Hound] Failed to load Phase 14 evidence modules:', e.message);
}

try {
  console.log('[Basset Hound] Importing Phase 16 document scanning modules...');
  importScripts('utils/extraction/pdf-extractor.js');
  importScripts('utils/extraction/image-ocr.js');
  importScripts('utils/extraction/table-parser.js');
  console.log('[Basset Hound] Phase 16 document scanning modules loaded successfully');
} catch (e) {
  console.error('[Basset Hound] Failed to load Phase 16 document scanning modules:', e.message);
}

try {
  console.log('[Basset Hound] Importing Phase 17 workflow automation modules...');
  importScripts('utils/workflow/error-handler.js');
  importScripts('utils/workflow/execution-context.js');
  importScripts('utils/workflow/step-executor.js');
  importScripts('utils/workflow/workflow-executor.js');
  importScripts('utils/workflow/workflow-manager.js');
  console.log('[Basset Hound] Phase 17 workflow automation modules loaded successfully');
} catch (e) {
  console.error('[Basset Hound] Failed to load Phase 17 workflow automation modules:', e.message);
}

console.log('[Basset Hound] All imports completed, initializing...');

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
  WSS_URL: 'wss://localhost:8765/browser',  // Secure WebSocket URL
  USE_WSS: false,                           // Whether to prefer WSS connections
  MAX_RECONNECT_ATTEMPTS: 10,
  INITIAL_RECONNECT_DELAY: 1000,  // 1 second
  MAX_RECONNECT_DELAY: 30000,     // 30 seconds
  COMMAND_TIMEOUT: 30000,         // 30 seconds default timeout
  HEARTBEAT_INTERVAL: 30000,      // 30 seconds heartbeat
  // Phase 7 Security: WebSocket authentication settings
  WS_AUTH_ENABLED: false,         // Whether to require auth on connections
  WS_ENCRYPTION_ENABLED: false,   // Whether to encrypt WebSocket messages
  WS_AUTH_TIMEOUT: 10000          // Auth handshake timeout
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

// Tab state tracking storage
const tabStates = new Map();

// Network request capture state (legacy - kept for backwards compatibility)
let networkCaptureEnabled = false;
const capturedNetworkRequests = [];
const MAX_CAPTURED_REQUESTS = 1000;

// Command queue state for batch execution
const commandQueues = new Map();
let queueIdCounter = 0;

// Advanced network monitoring instances
const networkMonitor = new NetworkMonitor({
  maxLogSize: 2000,
  captureHeaders: true,
  captureBody: false
});

// Network exporter instance
const networkExporter = new NetworkExporter(networkMonitor);

const requestInterceptor = new RequestInterceptor({
  urlPatterns: ['<all_urls>']
});

// User agent rotator instance for bot detection evasion
const userAgentRotator = new UserAgentRotator({
  logger: logger.child('UserAgentRotator')
});

// Rate limiter manager for bot detection evasion
const rateLimiterManager = new RateLimiterManager();

// Phase 7 Security: WebSocket authentication state
let wsAuthToken = null;
let wsEncryptionKey = null;
let wsAuthenticated = false;
let wsSecureConnection = null;

// =============================================================================
// Global Error Handling with WebSocket Forwarding
// =============================================================================

// Queue for errors that occur before WebSocket is connected
const pendingErrorQueue = [];
const MAX_PENDING_ERRORS = 50;

/**
 * Send an error message via WebSocket
 * @param {Object} errorData - The error data to send
 */
function sendErrorToBackend(errorData) {
  const errorMessage = {
    type: 'extension_error',
    source: 'background',
    data: errorData
  };

  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(errorMessage));
      logger.debug('Error forwarded to backend', { message: errorData.message });
    } catch (err) {
      logger.error('Failed to send error to backend', { error: err.message });
    }
  } else {
    // Queue error for later if WebSocket not connected
    if (pendingErrorQueue.length < MAX_PENDING_ERRORS) {
      pendingErrorQueue.push(errorMessage);
      logger.debug('Error queued for later sending', { message: errorData.message, queueSize: pendingErrorQueue.length });
    } else {
      logger.warn('Pending error queue full, error dropped', { message: errorData.message });
    }
  }
}

/**
 * Flush queued errors when WebSocket connects
 */
function flushPendingErrors() {
  if (pendingErrorQueue.length === 0) return;

  logger.info('Flushing pending errors', { count: pendingErrorQueue.length });

  while (pendingErrorQueue.length > 0) {
    const errorMessage = pendingErrorQueue.shift();
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(errorMessage));
      } catch (err) {
        logger.error('Failed to flush queued error', { error: err.message });
        break;
      }
    } else {
      // Put it back if connection lost during flush
      pendingErrorQueue.unshift(errorMessage);
      break;
    }
  }
}

// Global error handler for uncaught errors
self.addEventListener('error', (event) => {
  const errorData = {
    message: event.message || 'Unknown error',
    filename: event.filename || 'unknown',
    lineno: event.lineno || 0,
    colno: event.colno || 0,
    stack: event.error?.stack || '',
    timestamp: new Date().toISOString()
  };

  logger.error('Uncaught error', errorData);
  sendErrorToBackend(errorData);
});

// Global handler for unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const errorData = {
    message: reason?.message || String(reason) || 'Unhandled promise rejection',
    filename: reason?.fileName || 'unknown',
    lineno: reason?.lineNumber || 0,
    colno: reason?.columnNumber || 0,
    stack: reason?.stack || '',
    timestamp: new Date().toISOString()
  };

  logger.error('Unhandled promise rejection', errorData);
  sendErrorToBackend(errorData);
});

// =============================================================================
// WebSocket Connection Management
// =============================================================================

/**
 * Connect to the WebSocket server
 * Phase 7 Security: Supports WSS and authentication handshake
 * @param {Object} options - Connection options
 * @param {boolean} options.useWSS - Force WSS connection
 * @param {boolean} options.withAuth - Enable authentication
 */
function connectWebSocket(options = {}) {
  const {
    useWSS = CONFIG.USE_WSS,
    withAuth = CONFIG.WS_AUTH_ENABLED
  } = options;

  // Prevent multiple connection attempts
  if (connectionState === 'connecting') {
    logger.warn('Connection already in progress, skipping');
    return;
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    logger.info('Already connected to WebSocket server');
    return;
  }

  // Check local-only mode before connecting
  const wsUrl = useWSS ? CONFIG.WSS_URL : CONFIG.WS_URL;
  if (typeof isUrlAllowedInLocalMode === 'function') {
    const allowCheck = isUrlAllowedInLocalMode(wsUrl);
    if (!allowCheck.allowed) {
      logger.error('WebSocket connection blocked by local-only mode', {
        url: wsUrl,
        reason: allowCheck.reason
      });
      broadcastConnectionStatus('blocked', { reason: allowCheck.reason });
      return;
    }
  }

  connectionState = 'connecting';
  wsAuthenticated = false;
  logger.info('Attempting to connect to WebSocket server', {
    url: wsUrl,
    useWSS,
    withAuth,
    encryptionEnabled: CONFIG.WS_ENCRYPTION_ENABLED
  });

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => handleWebSocketOpen(withAuth);
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
 * Phase 7 Security: Performs authentication handshake if enabled
 * @param {boolean} withAuth - Whether to perform authentication
 */
function handleWebSocketOpen(withAuth = false) {
  logger.info('WebSocket connection opened', { withAuth });

  // Clear any pending reconnect
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (withAuth) {
    // Perform authentication handshake
    performAuthHandshake()
      .then(() => {
        logger.info('Authentication successful');
        wsAuthenticated = true;
        finalizeConnection();
      })
      .catch((error) => {
        logger.error('Authentication failed', { error: error.message });
        wsAuthenticated = false;
        ws.close(4002, 'Authentication failed');
        broadcastConnectionStatus('auth_failed', { error: error.message });
      });
  } else {
    // No auth required, finalize connection
    wsAuthenticated = false; // Mark as not authenticated (auth not used)
    finalizeConnection();
  }
}

/**
 * Finalize the WebSocket connection after optional auth
 */
function finalizeConnection() {
  logger.info('Connected to Basset Hound backend');
  connectionState = 'connected';
  reconnectAttempts = 0;

  // Start heartbeat
  startHeartbeat();

  // Flush any errors that occurred before WebSocket was connected
  flushPendingErrors();

  // Phase 7.2: Log WebSocket connection
  if (typeof auditLogger !== 'undefined') {
    auditLogger.logWebSocket('connected', {
      url: CONFIG.USE_WSS ? CONFIG.WSS_URL : CONFIG.WS_URL,
      authenticated: wsAuthenticated,
      encryptionEnabled: CONFIG.WS_ENCRYPTION_ENABLED
    });
  }

  // Notify popup of connection status
  broadcastConnectionStatus('connected', {
    authenticated: wsAuthenticated,
    encryptionEnabled: CONFIG.WS_ENCRYPTION_ENABLED
  });

  // Send initial status
  sendStatus('connected', {
    authenticated: wsAuthenticated,
    encryptionEnabled: CONFIG.WS_ENCRYPTION_ENABLED
  });
}

/**
 * Perform authentication handshake with the server
 * Phase 7 Security: Sends auth token and waits for confirmation
 * @returns {Promise<Object>} Authentication result
 */
async function performAuthHandshake() {
  return new Promise((resolve, reject) => {
    // Generate new auth token if needed
    if (!wsAuthToken) {
      const tokenInfo = generateAuthToken();
      wsAuthToken = tokenInfo.token;
      logger.debug('Generated new auth token', { expiresIn: tokenInfo.expiresIn });
    }

    // Generate encryption key if encryption is enabled
    if (CONFIG.WS_ENCRYPTION_ENABLED && !wsEncryptionKey) {
      const keyInfo = generateEncryptionKey();
      wsEncryptionKey = keyInfo.key;
      logger.debug('Generated new encryption key');
    }

    // Set timeout for auth response
    const authTimeout = setTimeout(() => {
      reject(new Error('Authentication timeout'));
    }, CONFIG.WS_AUTH_TIMEOUT);

    // Store original message handler
    const originalHandler = ws.onmessage;

    // Temporary handler for auth response
    ws.onmessage = (event) => {
      try {
        let message;

        // Decrypt if encryption is enabled
        if (CONFIG.WS_ENCRYPTION_ENABLED && wsEncryptionKey) {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === 'encrypted' && parsed.payload) {
              const decrypted = decryptMessage(parsed.payload, wsEncryptionKey);
              message = JSON.parse(decrypted.decrypted);
            } else {
              message = parsed;
            }
          } catch {
            message = JSON.parse(event.data);
          }
        } else {
          message = JSON.parse(event.data);
        }

        if (message.type === 'auth_response') {
          clearTimeout(authTimeout);
          ws.onmessage = originalHandler; // Restore original handler

          if (message.success) {
            resolve(message);
          } else {
            reject(new Error(message.error || 'Authentication rejected'));
          }
        }
      } catch (error) {
        // Not an auth message, ignore during handshake
      }
    };

    // Send auth request
    const authMessage = {
      type: 'auth',
      token: wsAuthToken,
      timestamp: Date.now(),
      capabilities: {
        encryption: CONFIG.WS_ENCRYPTION_ENABLED,
        encryptionKey: CONFIG.WS_ENCRYPTION_ENABLED ? wsEncryptionKey : undefined
      }
    };

    try {
      ws.send(JSON.stringify(authMessage));
      logger.debug('Auth request sent');
    } catch (error) {
      clearTimeout(authTimeout);
      ws.onmessage = originalHandler;
      reject(new Error(`Failed to send auth request: ${error.message}`));
    }
  });
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

  // Phase 7.2: Log WebSocket disconnection
  if (typeof auditLogger !== 'undefined') {
    auditLogger.logWebSocket('disconnected', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean
    });
  }

  connectionState = 'disconnected';
  ws = null;
  wsAuthenticated = false;

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
  // WebSocket error events don't contain detailed error info for security reasons
  // Extract what information we can from the event and connection state
  const errorDetails = {
    eventType: error.type || 'error',
    timestamp: error.timeStamp || Date.now(),
    isTrusted: error.isTrusted,
    // WebSocket connection state if available
    wsReadyState: ws ? ws.readyState : null,
    wsReadyStateText: ws ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][ws.readyState] : null,
    wsUrl: ws ? ws.url : null,
    // Connection context
    connectionState: connectionState,
    reconnectAttempts: reconnectAttempts
  };

  logger.error('WebSocket error occurred', errorDetails);

  // Phase 7.2: Log WebSocket error
  if (typeof auditLogger !== 'undefined') {
    auditLogger.logError('websocket_error', error.message || 'Unknown error', {
      type: error.type
    });
  }
}

/**
 * Handle incoming WebSocket message
 * Phase 7 Security: Supports message decryption when encryption is enabled
 * @param {MessageEvent} event - WebSocket message event
 */
async function handleWebSocketMessage(event) {
  logger.debug('Received message from server', { dataLength: event.data.length });

  try {
    let command;

    // Decrypt message if encryption is enabled
    if (CONFIG.WS_ENCRYPTION_ENABLED && wsEncryptionKey) {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'encrypted' && parsed.payload) {
          const decrypted = decryptMessage(parsed.payload, wsEncryptionKey);
          command = JSON.parse(decrypted.decrypted);
          logger.debug('Message decrypted successfully');
        } else {
          command = parsed;
        }
      } catch (decryptError) {
        logger.warn('Failed to decrypt message, treating as plain', { error: decryptError.message });
        command = JSON.parse(event.data);
      }
    } else {
      command = JSON.parse(event.data);
    }

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
  get_page_source: handleGetPageSource,
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
  get_multi_step_info: handleGetMultiStepInfo,
  // Frame/iframe commands
  get_frames: handleGetFrames,
  get_frame_info: handleGetFrameInfo,
  execute_in_frame: handleExecuteInFrame,
  // CAPTCHA detection commands
  detect_captcha: handleDetectCaptcha,
  get_captcha_state: handleGetCaptchaState,
  // Date picker commands
  get_date_pickers: handleGetDatePickers,
  set_date: handleSetDate,
  open_date_picker: handleOpenDatePicker,
  select_calendar_date: handleSelectCalendarDate,
  // Tab grouping commands
  create_tab_group: handleCreateTabGroup,
  add_to_group: handleAddToGroup,
  remove_from_group: handleRemoveFromGroup,
  get_tab_groups: handleGetTabGroups,
  // Tab state tracking commands
  get_tab_state: handleGetTabState,
  get_all_tab_states: handleGetAllTabStates,
  // File upload commands
  get_file_inputs: handleGetFileInputs,
  upload_file: handleUploadFile,
  trigger_file_dialog: handleTriggerFileDialog,
  // Dynamic form handling commands
  wait_for_field: handleWaitForField,
  wait_for_form_stable: handleWaitForFormStable,
  observe_form_changes: handleObserveFormChanges,
  fill_dynamic_field: handleFillDynamicField,
  get_dynamic_fields: handleGetDynamicFields,
  detect_ajax_loading: handleDetectAjaxLoading,
  // Wizard/Multi-step form commands
  detect_wizard: handleDetectWizard,
  get_wizard_state: handleGetWizardState,
  wizard_next: handleWizardNext,
  wizard_previous: handleWizardPrevious,
  fill_wizard_step: handleFillWizardStep,
  is_last_step: handleIsLastStep,
  get_submit_button: handleGetSubmitButton,
  submit_wizard: handleSubmitWizard,
  // User agent rotation commands
  set_user_agent: handleSetUserAgent,
  rotate_user_agent: handleRotateUserAgent,
  get_user_agents: handleGetUserAgents,
  reset_user_agent: handleResetUserAgent,
  // Rate limiting commands
  set_rate_limit: handleSetRateLimit,
  get_rate_limit: handleGetRateLimit,
  pause_actions: handlePauseActions,
  resume_actions: handleResumeActions,
  // Multi-select handling commands
  get_select_elements: handleGetSelectElements,
  get_select_options: handleGetSelectOptions,
  set_select_value: handleSetSelectValue,
  set_multi_select_values: handleSetMultiSelectValues,
  clear_select_selection: handleClearSelectSelection,
  // OSINT Tool Integration - Shodan
  shodan_host: handleShodanHost,
  shodan_search: handleShodanSearch,
  shodan_dns: handleShodanDns,
  shodan_myip: handleShodanMyIP,
  // OSINT Tool Integration - HaveIBeenPwned
  hibp_check_email: handleHIBPCheckEmail,
  hibp_check_password: handleHIBPCheckPassword,
  hibp_get_breach: handleHIBPGetBreach,
  // OSINT Tool Integration - Wayback Machine
  wayback_check: handleWaybackCheck,
  wayback_snapshots: handleWaybackSnapshots,
  wayback_get: handleWaybackGet,
  wayback_latest: handleWaybackLatest,
  // OSINT Tool Integration - WHOIS
  whois_domain: handleWhoisDomain,
  whois_ip: handleWhoisIP,
  // OSINT Tool Integration - Hunter.io
  hunter_domain: handleHunterDomain,
  hunter_find: handleHunterFind,
  hunter_verify: handleHunterVerify,
  hunter_count: handleHunterCount,
  // OSINT Tool Integration - Social Media
  social_search: handleSocialSearch,
  social_check: handleSocialCheck,
  social_platforms: handleSocialPlatforms,
  // Batch command execution
  batch_execute: handleBatchCommands,
  queue_commands: handleCommandQueue,
  get_queue_status: handleGetQueueStatus,
  cancel_queue: handleCancelQueue,
  // Security validation commands
  get_validation_rules: handleGetValidationRules,
  // Knowledge Base Integration - Tool Parser (Phase 5.1)
  parse_tool_config: handleParseToolConfig,
  get_field_mappings: handleGetFieldMappings,
  get_tool_preset: handleGetToolPreset,
  chain_tools: handleChainTools,
  list_tool_presets: handleListToolPresets,
  // Phase 7 Security: WebSocket authentication commands
  set_ws_auth: handleSetWsAuth,
  get_ws_status: handleGetWsStatus,
  enable_wss: handleEnableWss,
  rotate_auth_token: handleRotateAuthToken,
  // Phase 7 Security: Privacy control commands
  clear_browsing_data: handleClearBrowsingData,
  get_privacy_status: handleGetPrivacyStatus,
  set_local_only: handleSetLocalOnly,
  // Phase 7.2 Security: Audit logging commands
  get_audit_log: handleGetAuditLog,
  clear_audit_log: handleClearAuditLog,
  export_audit_log: handleExportAuditLog,
  set_audit_level: handleSetAuditLevel,
  // Phase 5.3 Data Pipeline - Normalization and Entity Management
  normalize_data: handleNormalizeData,
  create_entity: handleCreateEntity,
  link_entities: handleLinkEntities,
  get_related: handleGetRelated,
  export_entities: handleExportEntities,
  deduplicate: handleDeduplicate,
  get_entity: handleGetEntity,
  update_entity: handleUpdateEntity,
  delete_entity: handleDeleteEntity,
  query_entities: handleQueryEntities,
  get_entity_stats: handleGetEntityStats,
  clear_entities: handleClearEntities,
  // Phase 5.3 Data Pipeline - Basset Hound Backend Sync
  sync_connect: handleSyncConnect,
  sync_disconnect: handleSyncDisconnect,
  sync_entity: handleSyncEntity,
  sync_entities: handleSyncEntities,
  pull_entities: handlePullEntities,
  subscribe_entity_updates: handleSubscribeEntityUpdates,
  unsubscribe_entity_updates: handleUnsubscribeEntityUpdates,
  get_sync_status: handleGetSyncStatus,
  set_sync_interval: handleSetSyncInterval,
  enable_auto_sync: handleEnableAutoSync,
  get_offline_queue: handleGetOfflineQueue,
  clear_offline_queue: handleClearOfflineQueue,
  // Phase 6 palletAI Integration - Agent Callbacks
  request_captcha_help: handleRequestCaptchaHelp,
  request_approval: handleRequestApproval,
  report_progress: handleReportProgress,
  set_breakpoint: handleSetBreakpoint,
  resume_breakpoint: handleResumeBreakpoint,
  // Phase 6 palletAI Integration - Message Schema
  get_schema: handleGetSchema,
  negotiate_version: handleNegotiateVersion,
  // Phase 6 palletAI Integration - Streaming
  start_stream: handleStartStream,
  get_stream_chunk: handleGetStreamChunk,
  // Phase 4.6 Bot Detection Evasion - Fingerprint Randomization
  enable_fingerprint_protection: handleEnableFingerprintProtection,
  disable_fingerprint_protection: handleDisableFingerprintProtection,
  get_fingerprint_status: handleGetFingerprintStatus,
  regenerate_fingerprint: handleRegenerateFingerprint,
  // Network Export Commands
  export_network_har: handleExportNetworkHAR,
  export_network_csv: handleExportNetworkCSV,
  save_network_log: handleSaveNetworkLog,
  get_network_summary: handleGetNetworkSummary,
  // Phase 8 OSINT Data Ingestion Commands
  detect_osint: handleDetectOsint,
  verify_data: handleVerifyData,
  capture_provenance: handleCaptureProvenance,
  start_element_picker: handleStartElementPicker,
  ingest_data: handleIngestData,
  // Phase 14 Evidence Session Management Commands
  start_evidence_session: handleStartEvidenceSession,
  get_evidence_session: handleGetEvidenceSession,
  add_to_session: handleAddToSession,
  close_evidence_session: handleCloseEvidenceSession,
  list_evidence_sessions: handleListEvidenceSessions,
  export_evidence_session: handleExportEvidenceSession,
  toggle_session_panel: handleToggleSessionPanel,
  capture_page_forensics: handleCapturePageForensics,
  capture_browser_snapshot: handleCaptureBrowserSnapshot,
  // Phase 16 Document Scanning Commands (PDF, OCR, Tables)
  extract_pdf_text: handleExtractPdfText,
  extract_image_text: handleExtractImageText,
  extract_tables: handleExtractTables,
  detect_pdfs: handleDetectPdfs,
  detect_text_images: handleDetectTextImages,
  search_in_pdf: handleSearchInPdf,
  export_extraction: handleExportExtraction,
  // Phase 17 Workflow Automation Commands
  create_workflow: handleCreateWorkflow,
  get_workflow: handleGetWorkflow,
  update_workflow: handleUpdateWorkflow,
  delete_workflow: handleDeleteWorkflow,
  list_workflows: handleListWorkflows,
  execute_workflow: handleExecuteWorkflow,
  pause_workflow: handlePauseWorkflow,
  resume_workflow: handleResumeWorkflow,
  cancel_workflow: handleCancelWorkflow,
  get_workflow_status: handleGetWorkflowStatus,
  list_executions: handleListExecutions
};

// =============================================================================
// Command Processing
// =============================================================================

/**
 * Process an incoming command with security validation
 * @param {Object} command - Command object with command_id, type, and params
 */
async function processCommand(command) {
  // Phase 7 Security: Validate command structure using input validator
  let validationResult;
  try {
    validationResult = validateCommand(command);
  } catch (validationError) {
    if (validationError instanceof ValidationError) {
      logger.error('Command validation failed', {
        error: validationError.message,
        code: validationError.code,
        field: validationError.field
      });
      // Try to send response if command_id exists
      if (command && command.command_id) {
        sendResponse(command.command_id, false, null, validationError.message);
      }
      return;
    }
    throw validationError;
  }

  // Check for validation errors
  if (!validationResult.valid) {
    const errorMessages = validationResult.fatalErrors.map(e => e.message).join('; ');
    logger.error('Command validation failed', {
      errors: validationResult.fatalErrors,
      warnings: validationResult.warnings
    });
    if (command && command.command_id) {
      sendResponse(command.command_id, false, null, `Validation failed: ${errorMessages}`);
    }
    return;
  }

  // Log warnings but continue
  if (validationResult.warnings.length > 0) {
    logger.warn('Command validation warnings', { warnings: validationResult.warnings });
  }

  // Use sanitized command values
  const { command_id, type, params } = validationResult.sanitized;

  logger.info('Processing command', { command_id, type, params });

  // Get handler for command type
  const handler = commandHandlers[type];
  if (!handler) {
    logger.warn('Unknown command type', { type });
    sendResponse(command_id, false, null, `Unknown command type: ${type}`);
    return;
  }

  // Phase 7 Security: Apply additional validation based on command type
  try {
    await validateCommandParams(type, params);
  } catch (paramError) {
    logger.error('Command parameter validation failed', {
      command_id,
      type,
      error: paramError.message
    });
    sendResponse(command_id, false, null, paramError.message);
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

    // Phase 7.2: Log successful command execution
    if (typeof auditLogger !== 'undefined') {
      auditLogger.logCommand(type, params, true, null);
    }

    sendResponse(command_id, true, result);
  } catch (error) {
    task.status = 'failed';
    task.error = error.message;
    logger.error('Command failed', { command_id, type, error: error.message });

    // Phase 7.2: Log failed command execution
    if (typeof auditLogger !== 'undefined') {
      auditLogger.logCommand(type, params, false, error.message);
    }

    sendResponse(command_id, false, null, error.message);
  } finally {
    task.endTime = Date.now();
    broadcastTaskUpdate();

    // Remove completed tasks older than 5 minutes
    cleanupTaskQueue();
  }
}

/**
 * Phase 7 Security: Validate command parameters based on command type
 * @param {string} type - Command type
 * @param {Object} params - Command parameters
 */
async function validateCommandParams(type, params) {
  switch (type) {
    case 'navigate':
      if (params.url) {
        const urlResult = validateURL(params.url);
        if (!urlResult.valid) {
          throw new ValidationError(`Invalid URL: ${urlResult.errors[0]?.message || 'Unknown error'}`);
        }
        // Log warnings for URL
        if (urlResult.warnings.length > 0) {
          logger.warn('URL validation warnings', { warnings: urlResult.warnings });
        }
      }
      break;

    case 'click':
    case 'wait_for_element':
    case 'get_content':
      if (params.selector) {
        const selectorResult = validateSelector(params.selector);
        if (!selectorResult.valid) {
          throw new ValidationError(`Invalid selector: ${selectorResult.errors[0]?.message || 'Unknown error'}`);
        }
      }
      break;

    case 'get_page_source':
      // No validation needed - optional parameters only
      break;

    case 'execute_script':
      if (params.script) {
        const scriptResult = validateScript(params.script, { strict: true });
        if (!scriptResult.valid) {
          const dangerousPatterns = scriptResult.detectedPatterns
            .filter(p => p.severity !== 'warning')
            .map(p => p.pattern);
          throw new ValidationError(
            `Script contains dangerous patterns: ${dangerousPatterns.join(', ')}`
          );
        }
        // Log script validation warnings
        if (scriptResult.warnings.length > 0) {
          logger.warn('Script validation warnings', {
            warnings: scriptResult.warnings,
            detectedPatterns: scriptResult.detectedPatterns.filter(p => p.severity === 'warning')
          });
        }
      }
      break;

    case 'fill_form':
    case 'auto_fill_form':
      // Sanitize field values for XSS
      if (params.fields && typeof params.fields === 'object') {
        for (const [key, value] of Object.entries(params.fields)) {
          if (typeof value === 'string') {
            const sanitized = sanitizeInput(value, 'string', { removeXSS: true });
            if (sanitized.modified) {
              logger.warn('Field value was sanitized', { field: key, changes: sanitized.changes });
              params.fields[key] = sanitized.sanitized;
            }
          }
        }
      }
      // Validate selectors if present
      if (params.selector) {
        const selectorResult = validateSelector(params.selector);
        if (!selectorResult.valid) {
          throw new ValidationError(`Invalid form selector: ${selectorResult.errors[0]?.message || 'Unknown error'}`);
        }
      }
      break;

    case 'block_urls':
    case 'unblock_urls':
      // Validate URL patterns
      if (params.urls && Array.isArray(params.urls)) {
        for (const url of params.urls) {
          // Allow wildcard patterns but validate base structure
          if (typeof url === 'string' && !url.includes('*')) {
            try {
              validateURL(url);
            } catch (e) {
              // Allow patterns that aren't full URLs
              if (!url.match(/^[\w\-.*]+$/)) {
                throw new ValidationError(`Invalid URL pattern: ${url}`);
              }
            }
          }
        }
      }
      break;

    case 'set_cookies':
      // Validate cookie data
      if (params.cookies && Array.isArray(params.cookies)) {
        for (const cookie of params.cookies) {
          if (cookie.value) {
            const sanitized = sanitizeInput(cookie.value, 'string', { removeXSS: true });
            if (sanitized.modified) {
              logger.warn('Cookie value was sanitized', { name: cookie.name });
              cookie.value = sanitized.sanitized;
            }
          }
        }
      }
      break;

    case 'execute_in_frame':
      // Validate both selector and script
      if (params.frameSelector) {
        const selectorResult = validateSelector(params.frameSelector);
        if (!selectorResult.valid) {
          throw new ValidationError(`Invalid frame selector: ${selectorResult.errors[0]?.message || 'Unknown error'}`);
        }
      }
      if (params.script) {
        const scriptResult = validateScript(params.script, { strict: true });
        if (!scriptResult.valid) {
          throw new ValidationError('Script contains dangerous patterns');
        }
      }
      break;

    // Commands that don't need special validation pass through
    default:
      // No additional validation needed
      break;
  }
}

/**
 * Send response back to server
 * Phase 7 Security: Supports message encryption when enabled
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
    // Encrypt response if encryption is enabled
    if (CONFIG.WS_ENCRYPTION_ENABLED && wsEncryptionKey) {
      const encrypted = encryptMessage(JSON.stringify(response), wsEncryptionKey);
      ws.send(JSON.stringify({
        type: 'encrypted',
        payload: encrypted.encrypted
      }));
    } else {
      ws.send(JSON.stringify(response));
    }
    logger.debug('Response sent', { command_id, success, encrypted: CONFIG.WS_ENCRYPTION_ENABLED });
  } catch (err) {
    logger.error('Failed to send response', { command_id, error: err.message });
  }
}

/**
 * Send status update to server
 * Phase 7 Security: Supports message encryption when enabled
 * @param {string} status - Status message
 * @param {Object} data - Additional data
 */
function sendStatus(status, data = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }

  const statusMessage = {
    type: 'status',
    status,
    data,
    timestamp: Date.now()
  };

  try {
    // Encrypt status if encryption is enabled
    if (CONFIG.WS_ENCRYPTION_ENABLED && wsEncryptionKey) {
      const encrypted = encryptMessage(JSON.stringify(statusMessage), wsEncryptionKey);
      ws.send(JSON.stringify({
        type: 'encrypted',
        payload: encrypted.encrypted
      }));
    } else {
      ws.send(JSON.stringify(statusMessage));
    }
  } catch (error) {
    logger.error('Failed to send status', error);
  }
}

// =============================================================================
// Command Handler Implementations
// =============================================================================

/**
 * Get current validation rules and configuration
 * Phase 7 Security: Provides transparency about validation rules
 * @param {Object} params - Optional parameters (currently unused)
 * @returns {Object} Validation rules and configuration
 */
async function handleGetValidationRules(params = {}) {
  logger.info('Getting validation rules');

  try {
    const rules = getValidationRules();

    return {
      success: true,
      rules: {
        ...rules,
        // Add additional runtime information
        commandHandlerCount: Object.keys(commandHandlers).length,
        registeredCommands: Object.keys(commandHandlers),
        securityFeatures: {
          commandValidation: true,
          selectorInjectionPrevention: true,
          urlValidation: true,
          scriptPatternDetection: true,
          xssSanitization: true,
          inputTypeSanitization: true
        }
      },
      timestamp: Date.now()
    };
  } catch (error) {
    throw new Error(`Failed to get validation rules: ${error.message}`);
  }
}

// =============================================================================
// Phase 7 Security: WebSocket Authentication Command Handlers
// =============================================================================

/**
 * Set WebSocket authentication settings
 * @param {Object} params - Authentication settings
 * @param {boolean} params.enabled - Enable/disable authentication
 * @param {boolean} params.encryption - Enable/disable message encryption
 * @param {string} params.token - Custom auth token (optional, auto-generated if not provided)
 * @returns {Promise<Object>} Updated auth settings
 */
async function handleSetWsAuth(params = {}) {
  const {
    enabled = true,
    encryption = false,
    token = null
  } = params;

  logger.info('Setting WebSocket authentication', { enabled, encryption });

  // Phase 7.2: Log authentication attempt
  if (typeof auditLogger !== 'undefined') {
    auditLogger.logAuthAttempt('websocket_auth_config', true, { enabled, encryption });
  }

  try {
    // Update config
    CONFIG.WS_AUTH_ENABLED = enabled;
    CONFIG.WS_ENCRYPTION_ENABLED = encryption;

    // Handle token
    if (enabled) {
      if (token) {
        // Validate provided token
        if (typeof token !== 'string' || token.length < 16) {
          throw new Error('Token must be a string with at least 16 characters');
        }
        wsAuthToken = token;
      } else if (!wsAuthToken) {
        // Generate new token if none exists
        const tokenInfo = generateAuthToken();
        wsAuthToken = tokenInfo.token;
      }
    }

    // Handle encryption key
    if (encryption && !wsEncryptionKey) {
      const keyInfo = generateEncryptionKey();
      wsEncryptionKey = keyInfo.key;
    }

    // If connected, need to reconnect with new settings
    const needsReconnect = ws && ws.readyState === WebSocket.OPEN;

    return {
      success: true,
      authEnabled: CONFIG.WS_AUTH_ENABLED,
      encryptionEnabled: CONFIG.WS_ENCRYPTION_ENABLED,
      hasToken: wsAuthToken !== null,
      hasEncryptionKey: wsEncryptionKey !== null,
      needsReconnect,
      message: needsReconnect
        ? 'Settings updated. Reconnect to apply new authentication settings.'
        : 'Settings updated.',
      timestamp: Date.now()
    };
  } catch (error) {
    throw new Error(`Failed to set WebSocket auth: ${error.message}`);
  }
}

/**
 * Get WebSocket connection and authentication status
 * @param {Object} params - Optional parameters
 * @returns {Promise<Object>} WebSocket status information
 */
async function handleGetWsStatus(params = {}) {
  logger.info('Getting WebSocket status');

  try {
    const tokenStatus = typeof getTokenStatus === 'function' ? getTokenStatus() : null;

    return {
      success: true,
      connection: {
        state: connectionState,
        url: CONFIG.USE_WSS ? CONFIG.WSS_URL : CONFIG.WS_URL,
        useWSS: CONFIG.USE_WSS,
        readyState: ws ? ws.readyState : null,
        readyStateName: ws ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][ws.readyState] : 'NO_CONNECTION'
      },
      authentication: {
        enabled: CONFIG.WS_AUTH_ENABLED,
        authenticated: wsAuthenticated,
        tokenStatus
      },
      encryption: {
        enabled: CONFIG.WS_ENCRYPTION_ENABLED,
        hasKey: wsEncryptionKey !== null
      },
      reconnection: {
        attempts: reconnectAttempts,
        maxAttempts: CONFIG.MAX_RECONNECT_ATTEMPTS
      },
      timestamp: Date.now()
    };
  } catch (error) {
    throw new Error(`Failed to get WebSocket status: ${error.message}`);
  }
}

/**
 * Enable or disable WSS (secure WebSocket) connections
 * @param {Object} params - WSS settings
 * @param {boolean} params.enabled - Enable/disable WSS
 * @param {string} params.url - Custom WSS URL (optional)
 * @param {boolean} params.reconnect - Whether to reconnect with new settings
 * @returns {Promise<Object>} Updated WSS settings
 */
async function handleEnableWss(params = {}) {
  const {
    enabled = true,
    url = null,
    reconnect = false
  } = params;

  logger.info('Setting WSS mode', { enabled, url, reconnect });

  try {
    CONFIG.USE_WSS = enabled;

    if (url) {
      // Validate URL
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'wss:') {
          throw new Error('URL must use wss:// protocol');
        }
        CONFIG.WSS_URL = url;
      } catch (urlError) {
        throw new Error(`Invalid WSS URL: ${urlError.message}`);
      }
    }

    // Reconnect if requested and currently connected
    if (reconnect && ws && ws.readyState === WebSocket.OPEN) {
      logger.info('Reconnecting with new WSS settings');
      disconnectWebSocket();
      // Brief delay before reconnecting
      setTimeout(() => {
        reconnectAttempts = 0;
        connectWebSocket({ useWSS: enabled });
      }, 500);
    }

    return {
      success: true,
      wssEnabled: CONFIG.USE_WSS,
      wssUrl: CONFIG.WSS_URL,
      wsUrl: CONFIG.WS_URL,
      activeUrl: CONFIG.USE_WSS ? CONFIG.WSS_URL : CONFIG.WS_URL,
      reconnecting: reconnect && ws !== null,
      timestamp: Date.now()
    };
  } catch (error) {
    throw new Error(`Failed to enable WSS: ${error.message}`);
  }
}

/**
 * Rotate the authentication token
 * @param {Object} params - Rotation options
 * @param {boolean} params.reconnect - Whether to reconnect with new token
 * @returns {Promise<Object>} New token information
 */
async function handleRotateAuthToken(params = {}) {
  const { reconnect = false } = params;

  logger.info('Rotating authentication token', { reconnect });

  try {
    // Rotate the token
    const tokenInfo = rotateAuthToken();
    wsAuthToken = tokenInfo.token;

    // Also rotate encryption key if encryption is enabled
    let keyRotated = false;
    if (CONFIG.WS_ENCRYPTION_ENABLED) {
      const keyInfo = generateEncryptionKey();
      wsEncryptionKey = keyInfo.key;
      keyRotated = true;
    }

    // Reconnect if requested and currently connected
    if (reconnect && ws && ws.readyState === WebSocket.OPEN) {
      logger.info('Reconnecting with new auth token');
      wsAuthenticated = false;
      disconnectWebSocket();
      setTimeout(() => {
        reconnectAttempts = 0;
        connectWebSocket({ withAuth: CONFIG.WS_AUTH_ENABLED });
      }, 500);
    }

    return {
      success: true,
      tokenRotated: true,
      tokenExpiresAt: tokenInfo.expiresAt,
      tokenExpiresIn: tokenInfo.expiresIn,
      keyRotated,
      reconnecting: reconnect,
      message: reconnect
        ? 'Token rotated and reconnecting with new credentials.'
        : 'Token rotated. Reconnect to use new token.',
      timestamp: Date.now()
    };
  } catch (error) {
    throw new Error(`Failed to rotate auth token: ${error.message}`);
  }
}

// =============================================================================
// Phase 7 Security: Privacy Control Command Handlers
// =============================================================================

/**
 * Clear browsing data
 * @param {Object} params - Clearing options
 * @param {Array<string>} params.dataTypes - Types of data to clear
 * @param {string} params.since - Time range ('lastHour', 'lastDay', 'allTime')
 * @param {Array<string>} params.origins - Specific origins to clear (optional)
 * @returns {Promise<Object>} Clear operation result
 */
async function handleClearBrowsingData(params = {}) {
  logger.info('Clearing browsing data', params);

  try {
    const result = await clearBrowsingData(params);
    return {
      ...result,
      command: 'clear_browsing_data'
    };
  } catch (error) {
    throw new Error(`Failed to clear browsing data: ${error.message}`);
  }
}

/**
 * Get current privacy status
 * @param {Object} params - Optional parameters
 * @returns {Promise<Object>} Privacy status information
 */
async function handleGetPrivacyStatus(params = {}) {
  logger.info('Getting privacy status');

  try {
    const status = await getPrivacyStatus();
    return {
      ...status,
      command: 'get_privacy_status'
    };
  } catch (error) {
    throw new Error(`Failed to get privacy status: ${error.message}`);
  }
}

/**
 * Set local-only mode (restrict external connections)
 * @param {Object} params - Local-only mode settings
 * @param {boolean} params.enabled - Enable/disable local-only mode
 * @param {Array<string>} params.additionalAllowedHosts - Additional hosts to allow
 * @returns {Promise<Object>} Updated local-only mode status
 */
async function handleSetLocalOnly(params = {}) {
  const { enabled = true, additionalAllowedHosts = [] } = params;

  logger.info('Setting local-only mode', { enabled, additionalAllowedHosts });

  try {
    const result = await setLocalOnlyMode(enabled, { additionalAllowedHosts });

    // If enabling and currently connected to non-local WebSocket, warn user
    if (enabled && ws && ws.readyState === WebSocket.OPEN) {
      const currentUrl = CONFIG.USE_WSS ? CONFIG.WSS_URL : CONFIG.WS_URL;
      const checkResult = isUrlAllowedInLocalMode(currentUrl);
      if (!checkResult.allowed) {
        result.warnings.push({
          code: 'CURRENT_CONNECTION_BLOCKED',
          message: 'Current WebSocket connection may be blocked. Consider reconnecting.',
          severity: 'warning'
        });
      }
    }

    return {
      ...result,
      command: 'set_local_only'
    };
  } catch (error) {
    throw new Error(`Failed to set local-only mode: ${error.message}`);
  }
}

// =============================================================================
// Phase 7.2 Security: Audit Logging Command Handlers
// =============================================================================

/**
 * Get audit logs with filtering options
 * @param {Object} params - Filtering options
 * @param {number} params.since - Only return logs after this timestamp
 * @param {number} params.until - Only return logs before this timestamp
 * @param {string} params.action - Filter by action type
 * @param {string|Array<string>} params.level - Filter by log level(s)
 * @param {number} params.limit - Maximum number of logs to return
 * @param {number} params.offset - Number of logs to skip
 * @param {string} params.sortOrder - 'asc' or 'desc'
 * @returns {Promise<Object>} Filtered audit logs
 */
async function handleGetAuditLog(params = {}) {
  logger.info('Getting audit log', params);

  try {
    const result = auditLogger.getAuditLog(params);
    return {
      ...result,
      command: 'get_audit_log'
    };
  } catch (error) {
    throw new Error(`Failed to get audit log: ${error.message}`);
  }
}

/**
 * Clear old audit logs
 * @param {Object} params - Clear options
 * @param {number|string} params.olderThan - Timestamp or duration string ('1h', '1d', '7d', '30d')
 * @returns {Promise<Object>} Clear result
 */
async function handleClearAuditLog(params = {}) {
  const { olderThan = 0 } = params;

  logger.info('Clearing audit log', { olderThan });

  try {
    const result = auditLogger.clearAuditLog(olderThan);
    return {
      ...result,
      command: 'clear_audit_log'
    };
  } catch (error) {
    throw new Error(`Failed to clear audit log: ${error.message}`);
  }
}

/**
 * Export audit logs in specified format
 * @param {Object} params - Export options
 * @param {string} params.format - 'json' or 'csv'
 * @param {number} params.since - Only export logs after this timestamp
 * @param {number} params.until - Only export logs before this timestamp
 * @param {string} params.action - Filter by action type
 * @param {string|Array<string>} params.level - Filter by log level(s)
 * @returns {Promise<Object>} Export result with data
 */
async function handleExportAuditLog(params = {}) {
  const { format = 'json', ...filterOptions } = params;

  logger.info('Exporting audit log', { format, filterOptions });

  try {
    const result = auditLogger.exportAuditLog(format, filterOptions);
    return {
      ...result,
      command: 'export_audit_log'
    };
  } catch (error) {
    throw new Error(`Failed to export audit log: ${error.message}`);
  }
}

/**
 * Set minimum audit log level
 * @param {Object} params - Level settings
 * @param {string} params.level - Minimum level to log ('debug', 'info', 'warning', 'error', 'critical')
 * @returns {Promise<Object>} Updated configuration
 */
async function handleSetAuditLevel(params = {}) {
  const { level } = params;

  if (!level) {
    throw new Error('Level is required for set_audit_level');
  }

  logger.info('Setting audit log level', { level });

  try {
    const result = auditLogger.setLogLevel(level);

    if (!result.success) {
      throw new Error(result.error);
    }

    return {
      ...result,
      command: 'set_audit_level'
    };
  } catch (error) {
    throw new Error(`Failed to set audit level: ${error.message}`);
  }
}

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

  // Phase 7.2: Log navigation event
  if (typeof auditLogger !== 'undefined') {
    auditLogger.logNavigation(url, { wait_for, timeout });
  }

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

  // Phase 7.2: Log form fill event
  if (typeof auditLogger !== 'undefined') {
    auditLogger.logFormFill({ fieldNames: Object.keys(fields) }, Object.keys(fields).length, submit);
  }

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

  // Phase 7.2: Log data extraction event
  if (typeof auditLogger !== 'undefined') {
    auditLogger.logDataExtraction('content', { selector: selector || 'body' });
  }

  return sendMessageToActiveTab({
    action: 'get_content',
    selector
  });
}

/**
 * Get full page source HTML
 * @param {Object} params - { includeDoctype?: boolean, minified?: boolean }
 */
async function handleGetPageSource(params) {
  const { includeDoctype = true, minified = false } = params;

  logger.info('Getting page source', { includeDoctype, minified });

  // Phase 7.2: Log data extraction event
  if (typeof auditLogger !== 'undefined') {
    auditLogger.logDataExtraction('page_source', { includeDoctype, minified });
  }

  return sendMessageToActiveTab({
    action: 'get_page_source',
    params: { includeDoctype, minified }
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
// Frame/Iframe Command Handlers
// =============================================================================

/**
 * Get all frames/iframes on the current page
 * @param {Object} params - Options for frame enumeration
 * @param {boolean} params.includeSameOriginDetails - Include detailed info for same-origin frames
 * @param {boolean} params.includeNestedFrames - Include nested frames recursively
 */
async function handleGetFrames(params = {}) {
  logger.info('Getting frames', params);

  return sendMessageToActiveTab({
    action: 'get_frames',
    options: params
  });
}

/**
 * Get information about the current frame context
 * If frameId is provided, gets info from that specific frame
 * @param {Object} params - Parameters
 * @param {number} params.frameId - Optional specific frame ID to query
 */
async function handleGetFrameInfo(params = {}) {
  const { frameId } = params;

  logger.info('Getting frame info', { frameId });

  if (frameId !== undefined) {
    // Query specific frame
    return sendMessageToFrame(frameId, {
      action: 'get_frame_info'
    });
  }

  // Get info from main frame
  return sendMessageToActiveTab({
    action: 'get_frame_info'
  });
}

/**
 * Execute a command within a specific frame
 * This allows targeting any supported command to a specific iframe
 * @param {Object} params - Parameters
 * @param {Object} params.frameTarget - Frame identification { index, name, selector, path, frameId }
 * @param {string} params.command - Command to execute (e.g., 'fill_form', 'click', etc.)
 * @param {Object} params.commandParams - Parameters for the command
 */
async function handleExecuteInFrame(params = {}) {
  const { frameTarget, command, commandParams = {} } = params;

  if (!frameTarget) {
    throw new Error('frameTarget is required to specify which frame to execute in');
  }

  if (!command) {
    throw new Error('command is required');
  }

  logger.info('Executing command in frame', { frameTarget, command });

  // If frameId is provided directly, use it
  if (frameTarget.frameId !== undefined) {
    return sendMessageToFrame(frameTarget.frameId, {
      action: command,
      ...commandParams
    });
  }

  // Otherwise, we need to get the frameId first by querying the main frame
  // and then send the message to the appropriate frame
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
        // Get all frames in the tab
        const frames = await chrome.webNavigation.getAllFrames({ tabId });

        if (!frames || frames.length === 0) {
          reject(new Error('No frames found in tab'));
          return;
        }

        // Find the target frame
        let targetFrameId = null;

        // By index
        if (typeof frameTarget.index === 'number') {
          // Filter out main frame (frameId 0) when using index
          const childFrames = frames.filter(f => f.parentFrameId !== -1);
          if (frameTarget.index >= 0 && frameTarget.index < childFrames.length) {
            targetFrameId = childFrames[frameTarget.index].frameId;
          }
        }

        // By name or URL pattern
        if (targetFrameId === null && frameTarget.name) {
          // We need to query each frame for its name
          for (const frame of frames) {
            if (frame.frameId === 0) continue; // Skip main frame

            try {
              const result = await sendMessageToFrame(frame.frameId, {
                action: 'get_frame_info'
              });
              if (result?.frameInfo?.name === frameTarget.name) {
                targetFrameId = frame.frameId;
                break;
              }
            } catch (e) {
              // Frame might not have content script, continue
            }
          }
        }

        // By URL pattern
        if (targetFrameId === null && frameTarget.urlPattern) {
          const pattern = new RegExp(frameTarget.urlPattern);
          const matchedFrame = frames.find(f =>
            f.frameId !== 0 && pattern.test(f.url)
          );
          if (matchedFrame) {
            targetFrameId = matchedFrame.frameId;
          }
        }

        if (targetFrameId === null) {
          reject(new Error(`Frame not found matching target: ${JSON.stringify(frameTarget)}`));
          return;
        }

        // Execute the command in the target frame
        const result = await sendMessageToFrame(targetFrameId, {
          action: command,
          ...commandParams
        });

        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Send a message to a specific frame by frameId
 * @param {number} frameId - Frame ID (from webNavigation API)
 * @param {Object} message - Message to send
 * @returns {Promise<*>} - Response from content script
 */
function sendMessageToFrame(frameId, message) {
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
        // Send message to specific frame
        chrome.tabs.sendMessage(
          tabId,
          message,
          { frameId },
          (response) => {
            if (chrome.runtime.lastError) {
              // Try to inject content script into this frame and retry
              injectContentScriptIntoFrame(tabId, frameId, message)
                .then(resolve)
                .catch(reject);
            } else {
              resolve(response);
            }
          }
        );
      } catch (error) {
        reject(new Error(`Failed to send message to frame ${frameId}: ${error.message}`));
      }
    });
  });
}

/**
 * Inject content script into a specific frame and retry the message
 * @param {number} tabId - Tab ID
 * @param {number} frameId - Frame ID
 * @param {Object} message - Message to send after injection
 */
async function injectContentScriptIntoFrame(tabId, frameId, message) {
  logger.info('Injecting content script into frame', { tabId, frameId });

  try {
    // Inject scripts into the specific frame
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      files: ['utils/logger.js', 'utils/captcha-detector.js', 'utils/form-detector.js', 'data/form-templates.js', 'content.js']
    });

    // Wait for script to initialize
    await new Promise(resolve => setTimeout(resolve, 100));

    // Retry message
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tabId,
        message,
        { frameId },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });
  } catch (error) {
    throw new Error(`Failed to inject content script into frame: ${error.message}`);
  }
}

/**
 * Get all frame IDs in the current tab
 * Useful for debugging and understanding page structure
 * @returns {Promise<Array>} - Array of frame info from webNavigation API
 */
async function getAllFrameIds() {
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
        const frames = await chrome.webNavigation.getAllFrames({ tabId });
        resolve(frames);
      } catch (error) {
        reject(error);
      }
    });
  });
}

// =============================================================================
// CAPTCHA Detection Command Handlers
// =============================================================================

/**
 * Detect CAPTCHAs on the current page
 * @param {Object} params - Detection options
 * @returns {Promise<Object>} - CAPTCHA detection results
 */
async function handleDetectCaptcha(params = {}) {
  logger.info('Detecting CAPTCHAs', params);

  return sendMessageToActiveTab({
    action: 'detect_captcha',
    options: params
  });
}

/**
 * Get the state of a specific CAPTCHA element
 * @param {Object} params - { selector: string }
 * @returns {Promise<Object>} - CAPTCHA state
 */
async function handleGetCaptchaState(params = {}) {
  const { selector } = params;
  logger.info('Getting CAPTCHA state', { selector });

  return sendMessageToActiveTab({
    action: 'get_captcha_state',
    selector
  });
}

// =============================================================================
// Date Picker Command Handlers
// =============================================================================

/**
 * Get all date pickers on the page
 * Detects native HTML5 date inputs, jQuery UI, Bootstrap, Flatpickr, Material UI, React-datepicker, etc.
 * @param {Object} params - Optional parameters (reserved for future use)
 * @returns {Promise<Object>} - List of detected date pickers with their types and properties
 */
async function handleGetDatePickers(params = {}) {
  logger.info('Getting date pickers from page');

  return sendMessageToActiveTab({
    action: 'get_date_pickers'
  });
}

/**
 * Set a date value on a date picker
 * Handles different date picker libraries and formats
 * @param {Object} params - Date setting parameters
 * @param {string} params.selector - Date picker selector
 * @param {string} params.date - Date string to set (e.g., '2024-01-15', '01/15/2024')
 * @param {string} params.format - Target format (e.g., 'YYYY-MM-DD', 'MM/DD/YYYY')
 * @returns {Promise<Object>} - Result with actual value set
 */
async function handleSetDate(params = {}) {
  const { selector, date, format = 'YYYY-MM-DD' } = params;

  // Validate required parameters
  if (!selector) {
    throw new Error('Selector is required for set_date command');
  }
  if (!date) {
    throw new Error('Date value is required for set_date command');
  }

  logger.info('Setting date value', { selector, date, format });

  return sendMessageToActiveTab({
    action: 'set_date',
    selector,
    date,
    format
  });
}

/**
 * Open a date picker calendar
 * Handles different date picker libraries
 * @param {Object} params - Parameters
 * @param {string} params.selector - Date picker selector
 * @returns {Promise<Object>} - Result indicating if calendar was opened
 */
async function handleOpenDatePicker(params = {}) {
  const { selector } = params;

  // Validate required parameters
  if (!selector) {
    throw new Error('Selector is required for open_date_picker command');
  }

  logger.info('Opening date picker', { selector });

  return sendMessageToActiveTab({
    action: 'open_date_picker',
    selector
  });
}

/**
 * Select a date from an open calendar by clicking
 * Navigates to the correct month/year and clicks the day
 * @param {Object} params - Parameters
 * @param {string} params.selector - Date picker selector
 * @param {string} params.date - Date to select (e.g., '2024-01-15')
 * @returns {Promise<Object>} - Result with selected date
 */
async function handleSelectCalendarDate(params = {}) {
  const { selector, date } = params;

  // Validate required parameters
  if (!selector) {
    throw new Error('Selector is required for select_calendar_date command');
  }
  if (!date) {
    throw new Error('Date value is required for select_calendar_date command');
  }

  logger.info('Selecting calendar date', { selector, date });

  return sendMessageToActiveTab({
    action: 'select_calendar_date',
    selector,
    date
  });
}

// =============================================================================
// Tab Grouping Command Handlers
// =============================================================================

/**
 * Create a new tab group
 * @param {Object} params - Group creation options
 * @param {Array<number>} params.tabIds - Tab IDs to include in the group
 * @param {string} params.title - Group title (optional)
 * @param {string} params.color - Group color: grey, blue, red, yellow, green, pink, purple, cyan, orange (optional)
 * @param {boolean} params.collapsed - Whether the group should be collapsed (optional)
 * @returns {Promise<Object>} - Created group info
 */
async function handleCreateTabGroup(params = {}) {
  const { tabIds, title, color, collapsed = false } = params;

  logger.info('Creating tab group', { tabIds, title, color, collapsed });

  // Validate tabIds
  if (!tabIds || !Array.isArray(tabIds) || tabIds.length === 0) {
    throw new Error('tabIds array is required and must not be empty');
  }

  // Validate color if provided
  const validColors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
  if (color && !validColors.includes(color)) {
    throw new Error(`Invalid color: ${color}. Valid colors: ${validColors.join(', ')}`);
  }

  try {
    // Create the group with the specified tabs
    const groupId = await chrome.tabs.group({ tabIds });

    // Update group properties if provided
    const updateProperties = {};
    if (title !== undefined) updateProperties.title = title;
    if (color !== undefined) updateProperties.color = color;
    if (collapsed !== undefined) updateProperties.collapsed = collapsed;

    if (Object.keys(updateProperties).length > 0) {
      await chrome.tabGroups.update(groupId, updateProperties);
    }

    // Get the updated group info
    const group = await chrome.tabGroups.get(groupId);

    return {
      success: true,
      groupId,
      title: group.title,
      color: group.color,
      collapsed: group.collapsed,
      windowId: group.windowId,
      tabCount: tabIds.length
    };
  } catch (error) {
    throw new Error(`Failed to create tab group: ${error.message}`);
  }
}

/**
 * Add tabs to an existing group
 * @param {Object} params - Add to group options
 * @param {number} params.groupId - ID of the group to add tabs to
 * @param {Array<number>} params.tabIds - Tab IDs to add to the group
 * @returns {Promise<Object>} - Updated group info
 */
async function handleAddToGroup(params = {}) {
  const { groupId, tabIds } = params;

  logger.info('Adding tabs to group', { groupId, tabIds });

  // Validate groupId
  if (groupId === undefined || groupId === null) {
    throw new Error('groupId is required');
  }

  // Validate tabIds
  if (!tabIds || !Array.isArray(tabIds) || tabIds.length === 0) {
    throw new Error('tabIds array is required and must not be empty');
  }

  try {
    // Add tabs to the existing group
    await chrome.tabs.group({ tabIds, groupId });

    // Get updated group info
    const group = await chrome.tabGroups.get(groupId);

    // Get all tabs in this group
    const tabs = await chrome.tabs.query({ groupId });

    return {
      success: true,
      groupId,
      title: group.title,
      color: group.color,
      collapsed: group.collapsed,
      tabCount: tabs.length,
      addedCount: tabIds.length
    };
  } catch (error) {
    throw new Error(`Failed to add tabs to group: ${error.message}`);
  }
}

/**
 * Remove tabs from their group (ungroup them)
 * @param {Object} params - Remove from group options
 * @param {Array<number>} params.tabIds - Tab IDs to remove from their groups
 * @returns {Promise<Object>} - Result info
 */
async function handleRemoveFromGroup(params = {}) {
  const { tabIds } = params;

  logger.info('Removing tabs from group', { tabIds });

  // Validate tabIds
  if (!tabIds || !Array.isArray(tabIds) || tabIds.length === 0) {
    throw new Error('tabIds array is required and must not be empty');
  }

  try {
    // Get current group info for each tab before ungrouping
    const tabsInfo = await Promise.all(
      tabIds.map(async (tabId) => {
        try {
          const tab = await chrome.tabs.get(tabId);
          return { tabId, previousGroupId: tab.groupId };
        } catch (e) {
          return { tabId, error: e.message };
        }
      })
    );

    // Ungroup the tabs
    await chrome.tabs.ungroup(tabIds);

    return {
      success: true,
      ungroupedCount: tabIds.length,
      tabs: tabsInfo
    };
  } catch (error) {
    throw new Error(`Failed to remove tabs from group: ${error.message}`);
  }
}

/**
 * Get all tab groups in current or specified window
 * @param {Object} params - Query options
 * @param {number} params.windowId - Window ID to query (optional, defaults to current window)
 * @param {boolean} params.includeTabs - Whether to include tab details for each group
 * @returns {Promise<Object>} - List of tab groups
 */
async function handleGetTabGroups(params = {}) {
  const { windowId, includeTabs = false } = params;

  logger.info('Getting tab groups', { windowId, includeTabs });

  try {
    // Build query
    const query = {};
    if (windowId !== undefined) {
      query.windowId = windowId;
    } else {
      // Get current window
      const currentWindow = await chrome.windows.getCurrent();
      query.windowId = currentWindow.id;
    }

    // Get all groups in the window
    const groups = await chrome.tabGroups.query(query);

    // Format the response
    const groupsInfo = await Promise.all(
      groups.map(async (group) => {
        const info = {
          id: group.id,
          title: group.title,
          color: group.color,
          collapsed: group.collapsed,
          windowId: group.windowId
        };

        if (includeTabs) {
          const tabs = await chrome.tabs.query({ groupId: group.id });
          info.tabs = tabs.map(tab => ({
            id: tab.id,
            title: tab.title,
            url: tab.url,
            index: tab.index,
            active: tab.active
          }));
          info.tabCount = tabs.length;
        }

        return info;
      })
    );

    return {
      success: true,
      groups: groupsInfo,
      count: groupsInfo.length,
      windowId: query.windowId
    };
  } catch (error) {
    throw new Error(`Failed to get tab groups: ${error.message}`);
  }
}

// =============================================================================
// Tab State Tracking Command Handlers
// =============================================================================

/**
 * Update tab state in storage
 * @param {number} tabId - Tab ID
 * @param {Object} updates - State updates to apply
 */
function updateTabState(tabId, updates) {
  const existingState = tabStates.get(tabId) || {};
  const newState = {
    ...existingState,
    ...updates,
    lastUpdated: Date.now()
  };
  tabStates.set(tabId, newState);

  // Notify via WebSocket if connected
  if (ws && ws.readyState === WebSocket.OPEN) {
    sendWebSocketMessage({
      type: 'tab_state_changed',
      tabId,
      state: newState,
      timestamp: Date.now()
    });
  }
}

/**
 * Send a message through WebSocket
 * @param {Object} message - Message to send
 */
function sendWebSocketMessage(message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error('Failed to send WebSocket message', error);
    }
  }
}

/**
 * Get the state of a specific tab
 * @param {Object} params - Query options
 * @param {number} params.tabId - Tab ID to query (optional, defaults to active tab)
 * @returns {Promise<Object>} - Tab state information
 */
async function handleGetTabState(params = {}) {
  const { tabId } = params;

  logger.info('Getting tab state', { tabId });

  try {
    let targetTabId = tabId;

    // If no tabId provided, get active tab
    if (targetTabId === undefined) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        throw new Error('No active tab found');
      }
      targetTabId = tabs[0].id;
    }

    // Get current tab info from Chrome API
    const tab = await chrome.tabs.get(targetTabId);

    // Get stored state
    const storedState = tabStates.get(targetTabId) || {};

    // Build comprehensive state
    const state = {
      tabId: targetTabId,
      // Chrome tab properties
      title: tab.title,
      url: tab.url,
      status: tab.status, // 'loading' or 'complete'
      favIconUrl: tab.favIconUrl,
      active: tab.active,
      pinned: tab.pinned,
      audible: tab.audible,
      mutedInfo: tab.mutedInfo,
      windowId: tab.windowId,
      index: tab.index,
      groupId: tab.groupId,
      discarded: tab.discarded,
      autoDiscardable: tab.autoDiscardable,
      // Stored state
      ...storedState,
      // Metadata
      queriedAt: Date.now()
    };

    return {
      success: true,
      state
    };
  } catch (error) {
    throw new Error(`Failed to get tab state: ${error.message}`);
  }
}

/**
 * Get states of all tabs in current or specified window
 * @param {Object} params - Query options
 * @param {number} params.windowId - Window ID to query (optional, defaults to current window)
 * @param {boolean} params.includeDiscarded - Include discarded tabs (optional, defaults to true)
 * @returns {Promise<Object>} - All tab states
 */
async function handleGetAllTabStates(params = {}) {
  const { windowId, includeDiscarded = true } = params;

  logger.info('Getting all tab states', { windowId, includeDiscarded });

  try {
    // Build query
    const query = {};
    if (windowId !== undefined) {
      query.windowId = windowId;
    } else {
      // Get current window
      const currentWindow = await chrome.windows.getCurrent();
      query.windowId = currentWindow.id;
    }

    // Get all tabs
    let tabs = await chrome.tabs.query(query);

    // Filter discarded tabs if requested
    if (!includeDiscarded) {
      tabs = tabs.filter(tab => !tab.discarded);
    }

    // Build states for all tabs
    const states = tabs.map(tab => {
      const storedState = tabStates.get(tab.id) || {};
      return {
        tabId: tab.id,
        title: tab.title,
        url: tab.url,
        status: tab.status,
        favIconUrl: tab.favIconUrl,
        active: tab.active,
        pinned: tab.pinned,
        audible: tab.audible,
        mutedInfo: tab.mutedInfo,
        index: tab.index,
        groupId: tab.groupId,
        discarded: tab.discarded,
        ...storedState
      };
    });

    // Summary statistics
    const summary = {
      total: states.length,
      loading: states.filter(s => s.status === 'loading').length,
      complete: states.filter(s => s.status === 'complete').length,
      discarded: states.filter(s => s.discarded).length,
      grouped: states.filter(s => s.groupId !== -1 && s.groupId !== undefined).length,
      pinned: states.filter(s => s.pinned).length
    };

    return {
      success: true,
      states,
      summary,
      windowId: query.windowId,
      queriedAt: Date.now()
    };
  } catch (error) {
    throw new Error(`Failed to get all tab states: ${error.message}`);
  }
}

// =============================================================================
// File Upload Command Handlers
// =============================================================================

/**
 * Get all file input elements on the current page
 * @param {Object} params - Options for finding file inputs
 * @param {boolean} params.searchShadowDOM - Whether to search shadow DOM (default: true)
 * @param {boolean} params.includeHidden - Whether to include hidden inputs (default: false)
 * @returns {Promise<Object>} - List of file inputs with their information
 */
async function handleGetFileInputs(params = {}) {
  logger.info('Getting file inputs', params);

  return sendMessageToActiveTab({
    action: 'get_file_inputs',
    options: params
  });
}

/**
 * Upload file(s) to a file input element
 * @param {Object} params - Upload parameters
 * @param {string} params.selector - CSS selector for the file input
 * @param {string} params.fileName - Name for a single file
 * @param {string} params.fileContent - Base64 encoded content for a single file
 * @param {string} params.mimeType - MIME type for a single file (default: 'application/octet-stream')
 * @param {Array<Object>} params.files - Array of file objects for multiple files
 *   Each file object: { fileName: string, fileContent: string (base64), mimeType: string }
 * @returns {Promise<Object>} - Result of the upload operation
 */
async function handleUploadFile(params = {}) {
  const { selector, fileName, fileContent, mimeType, files } = params;

  // Validate selector
  if (!selector || typeof selector !== 'string') {
    throw new Error('Selector is required for upload_file command');
  }

  // Validate file data
  if (!files && !fileContent) {
    throw new Error('Either files array or fileContent is required');
  }

  if (fileContent && !fileName) {
    throw new Error('fileName is required when using fileContent');
  }

  logger.info('Uploading file(s)', {
    selector,
    singleFile: !!fileName,
    multipleFiles: files ? files.length : 0
  });

  return sendMessageToActiveTab({
    action: 'upload_file',
    selector,
    fileName,
    fileContent,
    mimeType: mimeType || 'application/octet-stream',
    files
  });
}

/**
 * Trigger the file dialog for a file input (for manual selection)
 * @param {Object} params - Parameters
 * @param {string} params.selector - CSS selector for the file input
 * @returns {Promise<Object>} - Result of the operation
 */
async function handleTriggerFileDialog(params = {}) {
  const { selector } = params;

  // Validate selector
  if (!selector || typeof selector !== 'string') {
    throw new Error('Selector is required for trigger_file_dialog command');
  }

  logger.info('Triggering file dialog', { selector });

  return sendMessageToActiveTab({
    action: 'trigger_file_dialog',
    selector
  });
}

// =============================================================================
// Dynamic Form Handling Command Handlers
// =============================================================================

/**
 * Wait for a specific field to appear on the page
 * Useful for fields that load via AJAX or appear conditionally
 * @param {Object} params - Wait parameters
 * @param {string} params.selector - CSS selector, XPath, or other selector for the field
 * @param {number} params.timeout - Maximum time to wait in milliseconds (default: 10000)
 * @returns {Promise<Object>} - Result with field info when found
 */
async function handleWaitForField(params = {}) {
  const { selector, timeout = 10000 } = params;

  // Validate selector
  if (!selector || typeof selector !== 'string') {
    throw new Error('Selector is required for wait_for_field command');
  }

  logger.info('Waiting for dynamic field', { selector, timeout });

  return sendMessageToActiveTab({
    action: 'wait_for_dynamic_field',
    selector,
    timeout
  });
}

/**
 * Wait until the form stops changing (becomes stable)
 * Useful after triggering an action that causes AJAX loading
 * @param {Object} params - Wait parameters
 * @param {number} params.timeout - Maximum time to wait in milliseconds (default: 10000)
 * @param {number} params.stabilityThreshold - Time with no changes to consider stable in ms (default: 500)
 * @returns {Promise<Object>} - Result indicating if form became stable
 */
async function handleWaitForFormStable(params = {}) {
  const { timeout = 10000, stabilityThreshold = 500 } = params;

  logger.info('Waiting for form to stabilize', { timeout, stabilityThreshold });

  return sendMessageToActiveTab({
    action: 'wait_for_form_stable',
    timeout,
    stabilityThreshold
  });
}

/**
 * Start observing form changes on the page
 * Sets up a MutationObserver to detect when new form fields appear
 * @param {Object} params - Observer options
 * @returns {Promise<Object>} - Observer setup result
 */
async function handleObserveFormChanges(params = {}) {
  logger.info('Setting up form change observer', params);

  return sendMessageToActiveTab({
    action: 'observe_form_changes',
    options: params
  });
}

/**
 * Fill a dynamically loaded field with retry logic
 * Waits for the field to appear if not immediately available
 * @param {Object} params - Fill parameters
 * @param {string} params.selector - Selector for the field
 * @param {*} params.value - Value to fill
 * @param {number} params.timeout - Maximum time to wait for field (default: 10000)
 * @param {number} params.retryInterval - Time between retries in ms (default: 500)
 * @param {boolean} params.humanLike - Use human-like typing (default: true)
 * @returns {Promise<Object>} - Fill result
 */
async function handleFillDynamicField(params = {}) {
  const { selector, value, timeout = 10000, retryInterval = 500, humanLike = true } = params;

  // Validate selector
  if (!selector || typeof selector !== 'string') {
    throw new Error('Selector is required for fill_dynamic_field command');
  }

  // Validate value
  if (value === undefined) {
    throw new Error('Value is required for fill_dynamic_field command');
  }

  logger.info('Filling dynamic field', { selector, timeout, retryInterval, humanLike });

  return sendMessageToActiveTab({
    action: 'fill_dynamic_field',
    selector,
    value,
    options: {
      timeout,
      retryInterval,
      humanLike
    }
  });
}

/**
 * Get fields that appeared after the initial page load
 * @param {Object} params - Options (reserved for future use)
 * @returns {Promise<Object>} - Object containing list of dynamically added fields
 */
async function handleGetDynamicFields(params = {}) {
  logger.info('Getting dynamic fields');

  return sendMessageToActiveTab({
    action: 'get_dynamic_fields'
  });
}

/**
 * Detect if the page/form is currently loading content
 * Looks for loading indicators like spinners, loading classes, overlays
 * @param {Object} params - Options (reserved for future use)
 * @returns {Promise<Object>} - Loading detection result
 */
async function handleDetectAjaxLoading(params = {}) {
  logger.info('Detecting AJAX loading state');

  return sendMessageToActiveTab({
    action: 'detect_ajax_loading'
  });
}

// =============================================================================
// Wizard/Multi-Step Form Handlers
// =============================================================================

/**
 * Detect if the page has a wizard/multi-step form
 * Looks for step indicators, progress bars, next/prev buttons, hidden fieldsets
 * @param {Object} params - Options (reserved for future use)
 * @returns {Promise<Object>} - Wizard detection result
 */
async function handleDetectWizard(params = {}) {
  logger.info('Detecting wizard form');

  return sendMessageToActiveTab({
    action: 'detect_wizard'
  });
}

/**
 * Get the current wizard state including step info and visible fields
 * @param {Object} params - { formSelector?: string }
 * @returns {Promise<Object>} - Wizard state object
 */
async function handleGetWizardState(params = {}) {
  const { formSelector } = params;
  logger.info('Getting wizard state', { formSelector });

  return sendMessageToActiveTab({
    action: 'get_wizard_state',
    formSelector
  });
}

/**
 * Navigate to the next step in a wizard form
 * @param {Object} params - { formSelector?: string }
 * @returns {Promise<Object>} - Navigation result
 */
async function handleWizardNext(params = {}) {
  const { formSelector } = params;
  logger.info('Navigating wizard to next step', { formSelector });

  return sendMessageToActiveTab({
    action: 'wizard_next',
    formSelector
  });
}

/**
 * Navigate to the previous step in a wizard form
 * @param {Object} params - { formSelector?: string }
 * @returns {Promise<Object>} - Navigation result
 */
async function handleWizardPrevious(params = {}) {
  const { formSelector } = params;
  logger.info('Navigating wizard to previous step', { formSelector });

  return sendMessageToActiveTab({
    action: 'wizard_previous',
    formSelector
  });
}

/**
 * Fill only the visible fields in the current wizard step
 * @param {Object} params - { data: Object, options?: { humanLike?: boolean, formSelector?: string } }
 * @returns {Promise<Object>} - Fill result
 */
async function handleFillWizardStep(params = {}) {
  const { data, options = {} } = params;
  logger.info('Filling wizard step', { fieldCount: Object.keys(data || {}).length });

  return sendMessageToActiveTab({
    action: 'fill_wizard_step',
    data,
    options
  });
}

/**
 * Check if the current step is the last step of the wizard
 * @param {Object} params - { formSelector?: string }
 * @returns {Promise<Object>} - Result indicating if on last step
 */
async function handleIsLastStep(params = {}) {
  const { formSelector } = params;
  logger.info('Checking if last wizard step', { formSelector });

  return sendMessageToActiveTab({
    action: 'is_last_step',
    formSelector
  });
}

/**
 * Find the final submit button for the wizard
 * @param {Object} params - { formSelector?: string }
 * @returns {Promise<Object>} - Submit button info
 */
async function handleGetSubmitButton(params = {}) {
  const { formSelector } = params;
  logger.info('Getting wizard submit button', { formSelector });

  return sendMessageToActiveTab({
    action: 'get_submit_button',
    formSelector
  });
}

/**
 * Submit the wizard form (only works on the final step)
 * @param {Object} params - { formSelector?: string, options?: { clickButton?: boolean } }
 * @returns {Promise<Object>} - Submit result
 */
async function handleSubmitWizard(params = {}) {
  const { formSelector, options = {} } = params;
  logger.info('Submitting wizard form', { formSelector, options });

  return sendMessageToActiveTab({
    action: 'submit_wizard',
    formSelector,
    options
  });
}

// =============================================================================
// User Agent Rotation Handlers
// =============================================================================

/**
 * Set a specific user agent
 * @param {Object} params - User agent parameters
 * @param {string} params.user_agent - User agent string to set
 * @param {string} params.browser - Optional browser filter to pick random UA
 * @param {string} params.os - Optional OS filter to pick random UA
 * @param {boolean} params.notify_content - Whether to notify content script to override navigator.userAgent
 * @returns {Promise<Object>} - Result of setting user agent
 */
async function handleSetUserAgent(params = {}) {
  const { user_agent, browser, os, notify_content = true } = params;

  logger.info('Setting user agent', { user_agent: user_agent?.substring(0, 50), browser, os });

  let userAgentToSet;

  if (user_agent) {
    // Use the provided user agent string directly
    userAgentToSet = user_agent;
  } else if (browser && os) {
    // Get a random user agent for the specified browser and OS
    const agents = userAgentRotator.getUserAgentsByBrowserAndOS(browser, os);
    if (agents.length === 0) {
      throw new Error(`No user agents found for browser '${browser}' and OS '${os}'`);
    }
    userAgentToSet = agents[Math.floor(Math.random() * agents.length)].userAgent;
  } else if (browser) {
    // Get a random user agent for the specified browser
    const agent = userAgentRotator.getUserAgentByBrowser(browser);
    if (!agent) {
      throw new Error(`No user agents found for browser '${browser}'`);
    }
    userAgentToSet = agent.userAgent;
  } else if (os) {
    // Get a random user agent for the specified OS
    const agent = userAgentRotator.getUserAgentByOS(os);
    if (!agent) {
      throw new Error(`No user agents found for OS '${os}'`);
    }
    userAgentToSet = agent.userAgent;
  } else {
    throw new Error('Either user_agent, browser, or os parameter is required');
  }

  // Set the user agent using declarativeNetRequest
  const result = await userAgentRotator.setUserAgent(userAgentToSet);

  if (!result.success) {
    throw new Error(result.error || 'Failed to set user agent');
  }

  // Optionally notify content scripts to override navigator.userAgent
  if (notify_content) {
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              action: 'override_user_agent',
              userAgent: userAgentToSet
            });
          } catch (e) {
            // Ignore errors for tabs without content scripts
          }
        }
      }
    } catch (e) {
      logger.warn('Failed to notify some content scripts about user agent change', { error: e.message });
    }
  }

  return {
    success: true,
    message: 'User agent set successfully',
    userAgent: userAgentToSet,
    state: userAgentRotator.getState()
  };
}

/**
 * Rotate to a new random user agent
 * @param {Object} params - Rotation parameters
 * @param {string} params.browser - Optional browser filter
 * @param {string} params.os - Optional OS filter
 * @param {boolean} params.notify_content - Whether to notify content script
 * @returns {Promise<Object>} - Result of rotation
 */
async function handleRotateUserAgent(params = {}) {
  const { browser, os, notify_content = true } = params;

  logger.info('Rotating user agent', { browser, os });

  const result = await userAgentRotator.rotateUserAgent({ browser, os });

  if (!result.success) {
    throw new Error(result.error || 'Failed to rotate user agent');
  }

  // Optionally notify content scripts to override navigator.userAgent
  if (notify_content) {
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              action: 'override_user_agent',
              userAgent: result.userAgent
            });
          } catch (e) {
            // Ignore errors for tabs without content scripts
          }
        }
      }
    } catch (e) {
      logger.warn('Failed to notify some content scripts about user agent change', { error: e.message });
    }
  }

  return {
    success: true,
    message: 'User agent rotated successfully',
    userAgent: result.userAgent,
    browser: result.browser,
    os: result.os,
    version: result.version,
    state: userAgentRotator.getState()
  };
}

/**
 * Get available user agents
 * @param {Object} params - Filter parameters
 * @param {string} params.browser - Optional browser filter
 * @param {string} params.os - Optional OS filter
 * @param {boolean} params.include_stats - Include statistics
 * @returns {Promise<Object>} - Available user agents and current state
 */
async function handleGetUserAgents(params = {}) {
  const { browser, os, include_stats = false } = params;

  logger.info('Getting available user agents', { browser, os });

  let userAgents;

  if (browser && os) {
    userAgents = userAgentRotator.getUserAgentsByBrowserAndOS(browser, os);
  } else if (browser) {
    userAgents = userAgentRotator.getUserAgentsByBrowser(browser);
  } else if (os) {
    userAgents = userAgentRotator.getUserAgentsByOS(os);
  } else {
    userAgents = userAgentRotator.getAllUserAgents();
  }

  const response = {
    success: true,
    userAgents,
    count: userAgents.length,
    state: userAgentRotator.getState()
  };

  if (include_stats) {
    response.stats = userAgentRotator.getStats();
  }

  return response;
}

/**
 * Reset user agent to the original browser user agent
 * @param {Object} params - Reset parameters
 * @param {boolean} params.notify_content - Whether to notify content script
 * @returns {Promise<Object>} - Result of reset
 */
async function handleResetUserAgent(params = {}) {
  const { notify_content = true } = params;

  logger.info('Resetting user agent to original');

  const result = await userAgentRotator.resetUserAgent();

  if (!result.success) {
    throw new Error(result.error || 'Failed to reset user agent');
  }

  // Optionally notify content scripts to reset navigator.userAgent
  if (notify_content) {
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              action: 'reset_user_agent'
            });
          } catch (e) {
            // Ignore errors for tabs without content scripts
          }
        }
      }
    } catch (e) {
      logger.warn('Failed to notify some content scripts about user agent reset', { error: e.message });
    }
  }

  return {
    success: true,
    message: 'User agent reset to original',
    originalUserAgent: result.originalUserAgent,
    state: userAgentRotator.getState()
  };
}

// =============================================================================
// Multi-Select Element Handlers
// =============================================================================

/**
 * Get all select elements on the page (single and multiple)
 * Also detects enhanced select libraries like Select2, Chosen, etc.
 * @param {Object} params - Search options
 * @param {boolean} params.includeHidden - Include hidden elements (default: false)
 * @param {boolean} params.includeEnhanced - Include enhanced selects like Select2/Chosen (default: true)
 * @returns {Promise<Object>} - List of select elements with their properties
 */
async function handleGetSelectElements(params = {}) {
  logger.info('Getting select elements', params);

  return sendMessageToActiveTab({
    action: 'get_select_elements',
    options: params
  });
}

/**
 * Get all options for a select element
 * @param {Object} params - Parameters
 * @param {string} params.selector - CSS selector for the select element
 * @returns {Promise<Object>} - List of options with their properties
 */
async function handleGetSelectOptions(params = {}) {
  const { selector } = params;

  if (!selector) {
    throw new Error('Selector is required for get_select_options');
  }

  logger.info('Getting select options', { selector });

  return sendMessageToActiveTab({
    action: 'get_select_options',
    selector
  });
}

/**
 * Set value for a single select element
 * Supports native selects and enhanced libraries (Select2, Chosen, etc.)
 * @param {Object} params - Parameters
 * @param {string} params.selector - CSS selector for the select element
 * @param {string|number} params.value - Value to select
 * @param {Object} params.options - Options
 * @param {boolean} params.options.byText - Select by text instead of value
 * @param {boolean} params.options.byIndex - Select by index
 * @param {boolean} params.options.humanLike - Use human-like interactions
 * @returns {Promise<Object>} - Result with selected value
 */
async function handleSetSelectValue(params = {}) {
  const { selector, value, options = {} } = params;

  if (!selector) {
    throw new Error('Selector is required for set_select_value');
  }

  if (value === undefined) {
    throw new Error('Value is required for set_select_value');
  }

  logger.info('Setting select value', { selector, value, options });

  return sendMessageToActiveTab({
    action: 'set_select_value',
    selector,
    value,
    options
  });
}

/**
 * Set multiple values for a multi-select element
 * Supports Ctrl+click and Shift+click behavior simulation
 * @param {Object} params - Parameters
 * @param {string} params.selector - CSS selector for the select element
 * @param {Array} params.values - Array of values to select
 * @param {Object} params.options - Options
 * @param {boolean} params.options.byText - Select by text instead of value
 * @param {boolean} params.options.byIndex - Select by indices
 * @param {boolean} params.options.additive - Add to existing selection (Ctrl+click behavior)
 * @param {boolean} params.options.range - Select range (Shift+click behavior, uses first two values)
 * @param {boolean} params.options.humanLike - Use human-like interactions
 * @returns {Promise<Object>} - Result with selected values
 */
async function handleSetMultiSelectValues(params = {}) {
  const { selector, values, options = {} } = params;

  if (!selector) {
    throw new Error('Selector is required for set_multi_select_values');
  }

  if (!values || !Array.isArray(values)) {
    throw new Error('Values array is required for set_multi_select_values');
  }

  logger.info('Setting multi-select values', { selector, valueCount: values.length, options });

  return sendMessageToActiveTab({
    action: 'set_multi_select_values',
    selector,
    values,
    options
  });
}

/**
 * Clear all selections from a select element
 * @param {Object} params - Parameters
 * @param {string} params.selector - CSS selector for the select element
 * @returns {Promise<Object>} - Result with cleared count
 */
async function handleClearSelectSelection(params = {}) {
  const { selector } = params;

  if (!selector) {
    throw new Error('Selector is required for clear_select_selection');
  }

  logger.info('Clearing select selection', { selector });

  return sendMessageToActiveTab({
    action: 'clear_select_selection',
    selector
  });
}

// =============================================================================
// Rate Limiting Command Handlers
// =============================================================================

/**
 * Set rate limiting configuration
 * @param {Object} params - Rate limit parameters
 * @param {string} params.action_type - Action type (click, typing, navigation, scroll, default)
 * @param {number} params.min_delay - Minimum delay in milliseconds
 * @param {number} params.max_delay - Maximum delay in milliseconds
 * @param {number} params.burst_limit - Maximum actions per burst period
 * @param {number} params.burst_period - Burst period in milliseconds
 * @param {boolean} params.enabled - Whether rate limiting is enabled
 * @returns {Promise<Object>} - Updated configuration
 */
async function handleSetRateLimit(params = {}) {
  const {
    action_type = 'default',
    min_delay,
    max_delay,
    burst_limit,
    burst_period,
    enabled
  } = params;

  logger.info('Setting rate limit configuration', { action_type, min_delay, max_delay, burst_limit, burst_period, enabled });

  const config = {};

  if (min_delay !== undefined && max_delay !== undefined) {
    config.minDelay = min_delay;
    config.maxDelay = max_delay;
  }

  if (burst_limit !== undefined && burst_period !== undefined) {
    config.burstLimit = burst_limit;
    config.burstPeriod = burst_period;
  }

  if (enabled !== undefined) {
    config.enabled = enabled;
  }

  try {
    rateLimiterManager.setConfig(action_type, config);

    // Notify content scripts of rate limit changes
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'set_rate_limit',
            actionType: action_type,
            config: rateLimiterManager.getConfig(action_type)
          });
        } catch (e) {
          // Ignore errors for tabs without content scripts
        }
      }
    }

    return {
      success: true,
      actionType: action_type,
      config: rateLimiterManager.getConfig(action_type),
      allConfigs: rateLimiterManager.getAllConfigs()
    };
  } catch (error) {
    throw new Error(`Failed to set rate limit: ${error.message}`);
  }
}

/**
 * Get rate limiting configuration and statistics
 * @param {Object} params - Query parameters
 * @param {string} params.action_type - Optional action type to get specific config
 * @param {boolean} params.include_stats - Include statistics (default: true)
 * @returns {Promise<Object>} - Rate limit configuration and stats
 */
async function handleGetRateLimit(params = {}) {
  const { action_type, include_stats = true } = params;

  logger.info('Getting rate limit configuration', { action_type });

  const response = {
    success: true,
    paused: rateLimiterManager.isPaused()
  };

  if (action_type) {
    response.config = rateLimiterManager.getConfig(action_type);
    if (include_stats) {
      response.stats = rateLimiterManager.getLimiter(action_type).getStats();
    }
  } else {
    response.allConfigs = rateLimiterManager.getAllConfigs();
    if (include_stats) {
      response.allStats = rateLimiterManager.getAllStats();
    }
  }

  return response;
}

/**
 * Pause all actions (rate limiters will block until resumed)
 * @param {Object} params - Pause parameters
 * @param {string} params.action_type - Optional specific action type to pause
 * @returns {Promise<Object>} - Pause result
 */
async function handlePauseActions(params = {}) {
  const { action_type } = params;

  logger.info('Pausing actions', { action_type: action_type || 'all' });

  if (action_type) {
    rateLimiterManager.getLimiter(action_type).pause();
  } else {
    rateLimiterManager.pauseAll();
  }

  // Notify content scripts
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'pause_rate_limiter',
          actionType: action_type || 'all'
        });
      } catch (e) {
        // Ignore errors for tabs without content scripts
      }
    }
  }

  return {
    success: true,
    paused: true,
    actionType: action_type || 'all',
    message: action_type ? `Paused ${action_type} actions` : 'Paused all actions'
  };
}

/**
 * Resume paused actions
 * @param {Object} params - Resume parameters
 * @param {string} params.action_type - Optional specific action type to resume
 * @returns {Promise<Object>} - Resume result
 */
async function handleResumeActions(params = {}) {
  const { action_type } = params;

  logger.info('Resuming actions', { action_type: action_type || 'all' });

  if (action_type) {
    rateLimiterManager.getLimiter(action_type).resume();
  } else {
    rateLimiterManager.resumeAll();
  }

  // Notify content scripts
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'resume_rate_limiter',
          actionType: action_type || 'all'
        });
      } catch (e) {
        // Ignore errors for tabs without content scripts
      }
    }
  }

  return {
    success: true,
    paused: false,
    actionType: action_type || 'all',
    message: action_type ? `Resumed ${action_type} actions` : 'Resumed all actions'
  };
}

// =============================================================================
// OSINT Tool Integration - Shodan Command Handlers
// =============================================================================

/**
 * Look up information about an IP address using Shodan
 * @param {Object} params - Parameters
 * @param {string} params.ip - IP address to look up
 * @param {string} params.apiKey - Shodan API key
 * @param {boolean} params.history - Include historical banners (optional)
 * @param {boolean} params.minify - Minimize response size (optional)
 * @param {boolean} params.format - Format results for palletAI (optional, default: true)
 * @returns {Promise<Object>} - Host information
 */
async function handleShodanHost(params = {}) {
  const { ip, apiKey, history = false, minify = false, format = true } = params;

  if (!ip) {
    throw new Error('IP address is required for shodan_host');
  }

  if (!apiKey) {
    throw new Error('API key is required for shodan_host');
  }

  logger.info('Shodan host lookup', { ip, history, minify });

  try {
    const result = await ShodanHandler.searchHost(ip, apiKey, { history, minify });

    if (format) {
      return ShodanHandler.formatShodanResults(result, 'host');
    }

    return result;
  } catch (error) {
    if (error.name === 'ShodanError') {
      throw new Error(`Shodan API error: ${error.message} (${error.errorType})`);
    }
    throw error;
  }
}

/**
 * Search Shodan for devices matching a query
 * @param {Object} params - Parameters
 * @param {string} params.query - Shodan search query
 * @param {string} params.apiKey - Shodan API key
 * @param {number} params.page - Page number (optional, default: 1)
 * @param {string} params.facets - Comma-separated list of facets (optional)
 * @param {boolean} params.minify - Minimize response size (optional)
 * @param {boolean} params.format - Format results for palletAI (optional, default: true)
 * @returns {Promise<Object>} - Search results
 */
async function handleShodanSearch(params = {}) {
  const { query, apiKey, page = 1, facets, minify = false, format = true } = params;

  if (!query) {
    throw new Error('Search query is required for shodan_search');
  }

  if (!apiKey) {
    throw new Error('API key is required for shodan_search');
  }

  logger.info('Shodan search', { query, page, facets, minify });

  try {
    const result = await ShodanHandler.searchQuery(query, apiKey, { page, facets, minify });

    if (format) {
      return ShodanHandler.formatShodanResults(result, 'search');
    }

    return result;
  } catch (error) {
    if (error.name === 'ShodanError') {
      throw new Error(`Shodan API error: ${error.message} (${error.errorType})`);
    }
    throw error;
  }
}

/**
 * Resolve hostnames to IP addresses using Shodan's DNS resolver
 * @param {Object} params - Parameters
 * @param {string|string[]} params.hostnames - Hostname(s) to resolve
 * @param {string} params.apiKey - Shodan API key
 * @param {boolean} params.format - Format results for palletAI (optional, default: true)
 * @returns {Promise<Object>} - DNS resolution results
 */
async function handleShodanDns(params = {}) {
  const { hostnames, apiKey, format = true } = params;

  if (!hostnames) {
    throw new Error('Hostnames are required for shodan_dns');
  }

  if (!apiKey) {
    throw new Error('API key is required for shodan_dns');
  }

  logger.info('Shodan DNS resolve', {
    hostnameCount: Array.isArray(hostnames) ? hostnames.length : 1
  });

  try {
    const result = await ShodanHandler.getDnsResolve(hostnames, apiKey);

    if (format) {
      return ShodanHandler.formatShodanResults(result, 'dns');
    }

    return result;
  } catch (error) {
    if (error.name === 'ShodanError') {
      throw new Error(`Shodan API error: ${error.message} (${error.errorType})`);
    }
    throw error;
  }
}

/**
 * Get the caller's public IP address using Shodan
 * @param {Object} params - Parameters
 * @param {string} params.apiKey - Shodan API key
 * @param {boolean} params.format - Format results for palletAI (optional, default: true)
 * @returns {Promise<Object>} - Caller IP information
 */
async function handleShodanMyIP(params = {}) {
  const { apiKey, format = true } = params;

  if (!apiKey) {
    throw new Error('API key is required for shodan_myip');
  }

  logger.info('Shodan my IP lookup');

  try {
    const result = await ShodanHandler.getMyIP(apiKey);

    if (format) {
      return ShodanHandler.formatShodanResults(result, 'myip');
    }

    return result;
  } catch (error) {
    if (error.name === 'ShodanError') {
      throw new Error(`Shodan API error: ${error.message} (${error.errorType})`);
    }
    throw error;
  }
}

// =============================================================================
// OSINT Tool Integration - HaveIBeenPwned Command Handlers
// =============================================================================

/**
 * Check if an email address appears in known data breaches
 * @param {Object} params - Parameters
 * @param {string} params.email - Email address to check
 * @param {string} params.apiKey - HIBP API key (required for email lookups)
 * @param {boolean} params.truncateResponse - Truncate breach data (optional, default: true)
 * @param {boolean} params.includeUnverified - Include unverified breaches (optional, default: false)
 * @param {boolean} params.format - Format results for palletAI (optional, default: true)
 * @returns {Promise<Object>} - Breach results
 */
async function handleHIBPCheckEmail(params = {}) {
  const {
    email,
    apiKey,
    truncateResponse = true,
    includeUnverified = false,
    format = true
  } = params;

  if (!email) {
    throw new Error('Email address is required for hibp_check_email');
  }

  if (!apiKey) {
    throw new Error('API key is required for hibp_check_email. Get one at https://haveibeenpwned.com/API/Key');
  }

  logger.info('HIBP email breach check', { email: email.replace(/(.{2}).*(@.*)/, '$1***$2') });

  try {
    const result = await HIBPHandler.checkEmailBreach(email, {
      apiKey,
      truncateResponse,
      includeUnverified
    });

    if (!result.success) {
      throw new Error(result.error || 'Email breach check failed');
    }

    if (format) {
      return HIBPHandler.formatBreachResults(result, 'email');
    }

    return result;
  } catch (error) {
    logger.error('HIBP email check failed', { error: error.message });
    throw error;
  }
}

/**
 * Check if a password has been exposed in known data breaches
 * Uses k-anonymity - only first 5 chars of SHA-1 hash are sent to API
 * No API key required
 * @param {Object} params - Parameters
 * @param {string} params.password - Password to check
 * @param {boolean} params.format - Format results for palletAI (optional, default: true)
 * @returns {Promise<Object>} - Password breach results
 */
async function handleHIBPCheckPassword(params = {}) {
  const { password, format = true } = params;

  if (!password) {
    throw new Error('Password is required for hibp_check_password');
  }

  logger.info('HIBP password breach check');

  try {
    const result = await HIBPHandler.checkPasswordBreach(password);

    if (!result.success) {
      throw new Error(result.error || 'Password breach check failed');
    }

    if (format) {
      return HIBPHandler.formatBreachResults(result, 'password');
    }

    return result;
  } catch (error) {
    logger.error('HIBP password check failed', { error: error.message });
    throw error;
  }
}

/**
 * Get detailed information about a specific breach
 * No API key required
 * @param {Object} params - Parameters
 * @param {string} params.breachName - Name of the breach (e.g., "LinkedIn", "Adobe")
 * @param {boolean} params.format - Format results for palletAI (optional, default: true)
 * @returns {Promise<Object>} - Breach details
 */
async function handleHIBPGetBreach(params = {}) {
  const { breachName, format = true } = params;

  if (!breachName) {
    throw new Error('Breach name is required for hibp_get_breach');
  }

  logger.info('HIBP breach details lookup', { breachName });

  try {
    const result = await HIBPHandler.getBreachDetails(breachName);

    if (!result.success) {
      throw new Error(result.error || 'Breach lookup failed');
    }

    if (format) {
      return HIBPHandler.formatBreachResults(result, 'breach_details');
    }

    return result;
  } catch (error) {
    logger.error('HIBP breach lookup failed', { error: error.message, breachName });
    throw error;
  }
}

// =============================================================================
// OSINT Tool Integration - Wayback Machine Command Handlers
// =============================================================================

/**
 * Check if a URL is available in the Wayback Machine
 * @param {Object} params - Parameters
 * @param {string} params.url - URL to check for archived snapshots
 * @param {boolean} params.format - Format results for palletAI (optional, default: true)
 * @returns {Promise<Object>} - Availability result
 */
async function handleWaybackCheck(params = {}) {
  const { url, format = true } = params;

  if (!url) {
    throw new Error('URL is required for wayback_check');
  }

  logger.info('Wayback Machine availability check', { url });

  try {
    const result = await WaybackHandler.checkAvailability(url);

    if (format) {
      return WaybackHandler.formatWaybackResults(result, 'wayback_check');
    }

    return result;
  } catch (error) {
    throw new Error(`Wayback Machine error: ${error.message}`);
  }
}

/**
 * Get list of snapshots for a URL within a date range
 * @param {Object} params - Parameters
 * @param {string} params.url - URL to search for snapshots
 * @param {string|Date} params.from - Start date (optional)
 * @param {string|Date} params.to - End date (optional)
 * @param {number} params.limit - Maximum number of results (optional)
 * @param {string} params.filter - Filter expression e.g., 'statuscode:200' (optional)
 * @param {string} params.matchType - Match type: exact, prefix, host, domain (optional)
 * @param {boolean} params.format - Format results for palletAI (optional, default: true)
 * @returns {Promise<Object>} - List of snapshots
 */
async function handleWaybackSnapshots(params = {}) {
  const { url, from, to, limit, filter, matchType, format = true } = params;

  if (!url) {
    throw new Error('URL is required for wayback_snapshots');
  }

  logger.info('Wayback Machine snapshot list', { url, from, to, limit, filter, matchType });

  try {
    const options = {};
    if (limit !== undefined) options.limit = limit;
    if (filter !== undefined) options.filter = filter;
    if (matchType !== undefined) options.matchType = matchType;

    const result = await WaybackHandler.getSnapshots(url, from, to, options);

    if (format) {
      return WaybackHandler.formatWaybackResults(result, 'wayback_snapshots');
    }

    return result;
  } catch (error) {
    throw new Error(`Wayback Machine error: ${error.message}`);
  }
}

/**
 * Get a specific snapshot by timestamp
 * @param {Object} params - Parameters
 * @param {string} params.url - URL to retrieve
 * @param {string|Date} params.timestamp - Specific timestamp to retrieve
 * @param {boolean} params.exactMatch - Require exact timestamp match (optional, default: false)
 * @param {boolean} params.format - Format results for palletAI (optional, default: true)
 * @returns {Promise<Object>} - Snapshot details with archive URLs
 */
async function handleWaybackGet(params = {}) {
  const { url, timestamp, exactMatch = false, format = true } = params;

  if (!url) {
    throw new Error('URL is required for wayback_get');
  }

  if (!timestamp) {
    throw new Error('Timestamp is required for wayback_get');
  }

  logger.info('Wayback Machine get snapshot', { url, timestamp, exactMatch });

  try {
    const result = await WaybackHandler.getSnapshot(url, timestamp, { exactMatch });

    if (format) {
      return WaybackHandler.formatWaybackResults(result, 'wayback_get');
    }

    return result;
  } catch (error) {
    throw new Error(`Wayback Machine error: ${error.message}`);
  }
}

/**
 * Get the most recent snapshot for a URL
 * @param {Object} params - Parameters
 * @param {string} params.url - URL to retrieve
 * @param {boolean} params.format - Format results for palletAI (optional, default: true)
 * @returns {Promise<Object>} - Latest snapshot details with archive URLs
 */
async function handleWaybackLatest(params = {}) {
  const { url, format = true } = params;

  if (!url) {
    throw new Error('URL is required for wayback_latest');
  }

  logger.info('Wayback Machine latest snapshot', { url });

  try {
    const result = await WaybackHandler.getLatestSnapshot(url);

    if (format) {
      return WaybackHandler.formatWaybackResults(result, 'wayback_latest');
    }

    return result;
  } catch (error) {
    throw new Error(`Wayback Machine error: ${error.message}`);
  }
}

// =============================================================================
// OSINT Tool Integration - WHOIS Command Handlers
// =============================================================================

/**
 * Look up WHOIS data for a domain
 * Uses public WHOIS APIs (no API key required)
 * @param {Object} params - Parameters
 * @param {string} params.domain - Domain name to look up
 * @param {boolean} params.useCache - Whether to use cached results (optional, default: true)
 * @param {boolean} params.rawOnly - Return only raw WHOIS data (optional, default: false)
 * @param {string} params.format - Output format: 'full', 'summary', 'minimal' (optional, default: 'full')
 * @param {boolean} params.includeRaw - Include raw WHOIS data in formatted output (optional, default: false)
 * @returns {Promise<Object>} - Structured WHOIS data
 */
async function handleWhoisDomain(params = {}) {
  const { domain, useCache = true, rawOnly = false, format = 'full', includeRaw = false } = params;

  if (!domain) {
    throw new Error('Domain is required for whois_domain');
  }

  logger.info('WHOIS domain lookup', { domain, useCache, rawOnly });

  try {
    const result = await WhoisHandler.lookupDomain(domain, { useCache, rawOnly });

    if (rawOnly) {
      return result;
    }

    // Format results for palletAI consumption
    return WhoisHandler.formatWhoisResults(result, { format, includeRaw });
  } catch (error) {
    logger.error('WHOIS domain lookup failed', { error: error.message, domain });
    throw new Error(`WHOIS lookup failed for ${domain}: ${error.message}`);
  }
}

/**
 * Look up WHOIS data for an IP address
 * Uses public IP WHOIS APIs (no API key required)
 * @param {Object} params - Parameters
 * @param {string} params.ip - IP address to look up (IPv4 or IPv6)
 * @param {boolean} params.useCache - Whether to use cached results (optional, default: true)
 * @param {string} params.format - Output format: 'full', 'summary', 'minimal' (optional, default: 'full')
 * @returns {Promise<Object>} - Structured IP WHOIS data including geolocation and ASN info
 */
async function handleWhoisIP(params = {}) {
  const { ip, useCache = true, format = 'full' } = params;

  if (!ip) {
    throw new Error('IP address is required for whois_ip');
  }

  logger.info('WHOIS IP lookup', { ip, useCache });

  try {
    const result = await WhoisHandler.lookupIP(ip, { useCache });

    // Format results for palletAI consumption
    return WhoisHandler.formatWhoisResults(result, { format });
  } catch (error) {
    logger.error('WHOIS IP lookup failed', { error: error.message, ip });
    throw new Error(`WHOIS lookup failed for ${ip}: ${error.message}`);
  }
}

// =============================================================================
// OSINT Tool Integration - Hunter.io Command Handlers
// =============================================================================

/**
 * Search for all emails associated with a domain using Hunter.io
 * @param {Object} params - Parameters
 * @param {string} params.domain - Domain to search (e.g., "example.com")
 * @param {string} params.apiKey - Hunter.io API key (required)
 * @param {number} params.limit - Maximum number of results (optional, default: 10, max: 100)
 * @param {number} params.offset - Offset for pagination (optional, default: 0)
 * @param {string} params.type - Email type filter ('personal' or 'generic') (optional)
 * @param {string} params.seniority - Seniority filter (optional)
 * @param {string} params.department - Department filter (optional)
 * @param {boolean} params.format - Format results for palletAI (optional, default: true)
 * @returns {Promise<Object>} - Domain search results with emails
 */
async function handleHunterDomain(params = {}) {
  const {
    domain,
    apiKey,
    limit = 10,
    offset = 0,
    type,
    seniority,
    department,
    format = true
  } = params;

  if (!domain) {
    throw new Error('Domain is required for hunter_domain');
  }

  if (!apiKey) {
    throw new Error('API key is required for hunter_domain. Get one at https://hunter.io');
  }

  logger.info('Hunter.io domain search', { domain, limit, offset });

  try {
    const result = await HunterHandler.searchDomain(domain, apiKey, {
      limit,
      offset,
      type,
      seniority,
      department
    });

    if (!result.success) {
      throw new Error(result.error || 'Domain search failed');
    }

    if (format) {
      return HunterHandler.formatHunterResults(result, 'domain_search');
    }

    return result;
  } catch (error) {
    logger.error('Hunter.io domain search failed', { error: error.message, domain });
    throw error;
  }
}

/**
 * Find a specific person's email address at a domain using Hunter.io
 * @param {Object} params - Parameters
 * @param {string} params.domain - Domain to search (e.g., "example.com")
 * @param {string} params.firstName - Person's first name
 * @param {string} params.lastName - Person's last name
 * @param {string} params.apiKey - Hunter.io API key (required)
 * @param {boolean} params.format - Format results for palletAI (optional, default: true)
 * @returns {Promise<Object>} - Email finder results
 */
async function handleHunterFind(params = {}) {
  const { domain, firstName, lastName, apiKey, format = true } = params;

  if (!domain) {
    throw new Error('Domain is required for hunter_find');
  }

  if (!firstName) {
    throw new Error('First name is required for hunter_find');
  }

  if (!lastName) {
    throw new Error('Last name is required for hunter_find');
  }

  if (!apiKey) {
    throw new Error('API key is required for hunter_find. Get one at https://hunter.io');
  }

  logger.info('Hunter.io email finder', {
    domain,
    name: `${firstName} ${lastName}`
  });

  try {
    const result = await HunterHandler.findEmail(domain, firstName, lastName, apiKey);

    if (!result.success) {
      throw new Error(result.error || 'Email finder failed');
    }

    if (format) {
      return HunterHandler.formatHunterResults(result, 'email_finder');
    }

    return result;
  } catch (error) {
    logger.error('Hunter.io email finder failed', { error: error.message, domain });
    throw error;
  }
}

/**
 * Verify if an email address is valid and deliverable using Hunter.io
 * @param {Object} params - Parameters
 * @param {string} params.email - Email address to verify
 * @param {string} params.apiKey - Hunter.io API key (required)
 * @param {boolean} params.format - Format results for palletAI (optional, default: true)
 * @returns {Promise<Object>} - Email verification results
 */
async function handleHunterVerify(params = {}) {
  const { email, apiKey, format = true } = params;

  if (!email) {
    throw new Error('Email address is required for hunter_verify');
  }

  if (!apiKey) {
    throw new Error('API key is required for hunter_verify. Get one at https://hunter.io');
  }

  // Mask email for logging
  const maskedEmail = email.replace(/(.{2}).*(@.*)/, '$1***$2');
  logger.info('Hunter.io email verification', { email: maskedEmail });

  try {
    const result = await HunterHandler.verifyEmail(email, apiKey);

    if (!result.success) {
      throw new Error(result.error || 'Email verification failed');
    }

    if (format) {
      return HunterHandler.formatHunterResults(result, 'email_verify');
    }

    return result;
  } catch (error) {
    logger.error('Hunter.io email verification failed', { error: error.message });
    throw error;
  }
}

/**
 * Get the count of email addresses for a domain using Hunter.io
 * This is a lightweight call that doesn't consume domain search credits.
 * @param {Object} params - Parameters
 * @param {string} params.domain - Domain to check (e.g., "example.com")
 * @param {string} params.apiKey - Hunter.io API key (required)
 * @param {boolean} params.format - Format results for palletAI (optional, default: true)
 * @returns {Promise<Object>} - Email count results
 */
async function handleHunterCount(params = {}) {
  const { domain, apiKey, format = true } = params;

  if (!domain) {
    throw new Error('Domain is required for hunter_count');
  }

  if (!apiKey) {
    throw new Error('API key is required for hunter_count. Get one at https://hunter.io');
  }

  logger.info('Hunter.io email count', { domain });

  try {
    const result = await HunterHandler.getEmailCount(domain, apiKey);

    if (!result.success) {
      throw new Error(result.error || 'Email count failed');
    }

    if (format) {
      return HunterHandler.formatHunterResults(result, 'email_count');
    }

    return result;
  } catch (error) {
    logger.error('Hunter.io email count failed', { error: error.message, domain });
    throw error;
  }
}

// =============================================================================
// OSINT Tool Integration - Social Media Command Handlers
// =============================================================================

/**
 * Search for a username across all supported social media platforms
 * No API key required - uses public profile URL checks
 * @param {Object} params - Parameters
 * @param {string} params.username - Username to search for
 * @param {string[]} params.platforms - Specific platforms to check (optional, defaults to all)
 * @param {boolean} params.concurrent - Run checks concurrently (optional, default: false)
 * @param {boolean} params.format - Format results for palletAI (optional, default: true)
 * @returns {Promise<Object>} - Search results for all platforms
 */
async function handleSocialSearch(params = {}) {
  const { username, platforms, concurrent = false, format = true } = params;

  if (!username) {
    throw new Error('Username is required for social_search');
  }

  logger.info('Social media username search', {
    username: username.length > 20 ? username.substring(0, 20) + '...' : username,
    platforms: platforms ? platforms.length : 'all',
    concurrent
  });

  try {
    const options = { concurrent };
    if (platforms && Array.isArray(platforms) && platforms.length > 0) {
      options.platforms = platforms;
    }

    const result = await SocialMediaHandler.searchUsername(username, options);

    if (format) {
      return SocialMediaHandler.formatSocialResults(result, 'search');
    }

    return result;
  } catch (error) {
    logger.error('Social media search failed', { error: error.message, username });
    throw new Error(`Social media search failed: ${error.message}`);
  }
}

/**
 * Check if a username exists on a specific social media platform
 * No API key required - uses public profile URL check
 * @param {Object} params - Parameters
 * @param {string} params.platform - Platform to check (e.g., 'twitter', 'github')
 * @param {string} params.username - Username to check
 * @param {boolean} params.format - Format results for palletAI (optional, default: true)
 * @returns {Promise<Object>} - Check result for the specific platform
 */
async function handleSocialCheck(params = {}) {
  const { platform, username, format = true } = params;

  if (!platform) {
    throw new Error('Platform is required for social_check');
  }

  if (!username) {
    throw new Error('Username is required for social_check');
  }

  logger.info('Social media platform check', { platform, username });

  try {
    const result = await SocialMediaHandler.checkPlatform(platform, username);

    if (format) {
      return SocialMediaHandler.formatSocialResults(result, 'check');
    }

    return result;
  } catch (error) {
    logger.error('Social media check failed', { error: error.message, platform, username });
    throw new Error(`Social media check failed: ${error.message}`);
  }
}

/**
 * Get list of supported social media platforms
 * @param {Object} params - Parameters
 * @param {boolean} params.format - Format results for palletAI (optional, default: true)
 * @returns {Promise<Object>} - Supported platforms with their details
 */
async function handleSocialPlatforms(params = {}) {
  const { format = true } = params;

  logger.info('Getting supported social media platforms');

  try {
    const result = SocialMediaHandler.getSupportedPlatforms();

    if (format) {
      return SocialMediaHandler.formatSocialResults(result, 'platforms');
    }

    return result;
  } catch (error) {
    logger.error('Failed to get social media platforms', { error: error.message });
    throw new Error(`Failed to get social media platforms: ${error.message}`);
  }
}

// =============================================================================
// Batch Command Execution Handlers
// =============================================================================

/**
 * Execute multiple commands in batch
 * @param {Object} params - Batch execution parameters
 * @param {Array<{type: string, params: Object}>} params.commands - Array of commands to execute
 * @param {boolean} params.sequential - If true, run commands in order; if false, run in parallel (default: false)
 * @param {boolean} params.stopOnError - If true, stop on first error in sequential mode (default: false)
 * @param {number} params.timeout - Timeout for individual commands in ms (default: CONFIG.COMMAND_TIMEOUT)
 * @returns {Promise<Object>} - Array of results with status for each command
 */
async function handleBatchCommands(params = {}) {
  const {
    commands,
    sequential = false,
    stopOnError = false,
    timeout = CONFIG.COMMAND_TIMEOUT
  } = params;

  // Validate commands array
  if (!commands || !Array.isArray(commands) || commands.length === 0) {
    throw new Error('Commands array is required and must not be empty');
  }

  logger.info('Executing batch commands', {
    commandCount: commands.length,
    sequential,
    stopOnError,
    timeout
  });

  const results = [];
  const startTime = Date.now();

  /**
   * Execute a single command with timeout
   * @param {Object} cmd - Command object with type and params
   * @param {number} index - Command index
   * @returns {Promise<Object>} - Result object with status
   */
  const executeCommand = async (cmd, index) => {
    const cmdStartTime = Date.now();

    // Validate command structure
    if (!cmd || !cmd.type) {
      return {
        index,
        type: cmd?.type || 'unknown',
        success: false,
        error: 'Invalid command structure: type is required',
        duration: 0
      };
    }

    const handler = commandHandlers[cmd.type];
    if (!handler) {
      return {
        index,
        type: cmd.type,
        success: false,
        error: `Unknown command type: ${cmd.type}`,
        duration: 0
      };
    }

    try {
      // Execute with timeout
      const result = await Promise.race([
        handler(cmd.params || {}),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Command timeout after ${timeout}ms`)), timeout)
        )
      ]);

      return {
        index,
        type: cmd.type,
        success: true,
        result,
        duration: Date.now() - cmdStartTime
      };
    } catch (error) {
      return {
        index,
        type: cmd.type,
        success: false,
        error: error.message,
        duration: Date.now() - cmdStartTime
      };
    }
  };

  if (sequential) {
    // Execute commands sequentially
    for (let i = 0; i < commands.length; i++) {
      const result = await executeCommand(commands[i], i);
      results.push(result);

      // Stop on error if configured
      if (stopOnError && !result.success) {
        logger.warn('Batch execution stopped due to error', {
          index: i,
          error: result.error
        });
        // Mark remaining commands as skipped
        for (let j = i + 1; j < commands.length; j++) {
          results.push({
            index: j,
            type: commands[j]?.type || 'unknown',
            success: false,
            error: 'Skipped due to previous error',
            skipped: true,
            duration: 0
          });
        }
        break;
      }
    }
  } else {
    // Execute commands in parallel
    const promises = commands.map((cmd, index) => executeCommand(cmd, index));
    const parallelResults = await Promise.all(promises);
    results.push(...parallelResults);
  }

  const totalDuration = Date.now() - startTime;
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success && !r.skipped).length;
  const skippedCount = results.filter(r => r.skipped).length;

  logger.info('Batch execution completed', {
    total: commands.length,
    success: successCount,
    failed: failureCount,
    skipped: skippedCount,
    duration: totalDuration
  });

  return {
    success: failureCount === 0 && skippedCount === 0,
    results,
    summary: {
      total: commands.length,
      successful: successCount,
      failed: failureCount,
      skipped: skippedCount,
      duration: totalDuration,
      sequential,
      stoppedOnError: stopOnError && skippedCount > 0
    }
  };
}

/**
 * Queue commands for asynchronous execution
 * @param {Object} params - Queue parameters
 * @param {Array<{type: string, params: Object}>} params.commands - Array of commands to queue
 * @param {number} params.delay - Optional delay between commands in ms (default: 0)
 * @param {number} params.timeout - Timeout for individual commands in ms (default: CONFIG.COMMAND_TIMEOUT)
 * @param {boolean} params.stopOnError - If true, stop on first error (default: false)
 * @returns {Promise<Object>} - Queue ID for tracking
 */
async function handleCommandQueue(params = {}) {
  const {
    commands,
    delay = 0,
    timeout = CONFIG.COMMAND_TIMEOUT,
    stopOnError = false
  } = params;

  // Validate commands array
  if (!commands || !Array.isArray(commands) || commands.length === 0) {
    throw new Error('Commands array is required and must not be empty');
  }

  // Generate unique queue ID
  const queueId = `queue_${Date.now()}_${++queueIdCounter}`;

  logger.info('Creating command queue', {
    queueId,
    commandCount: commands.length,
    delay,
    timeout,
    stopOnError
  });

  // Initialize queue state
  const queueState = {
    id: queueId,
    status: 'running',
    commands: commands.map((cmd, index) => ({
      index,
      type: cmd?.type || 'unknown',
      params: cmd?.params || {},
      status: 'pending',
      result: null,
      error: null,
      startTime: null,
      endTime: null
    })),
    currentIndex: 0,
    startTime: Date.now(),
    endTime: null,
    cancelled: false,
    delay,
    timeout,
    stopOnError
  };

  commandQueues.set(queueId, queueState);

  // Start processing queue asynchronously
  processQueue(queueId).catch(error => {
    logger.error('Queue processing error', { queueId, error: error.message });
  });

  return {
    success: true,
    queueId,
    commandCount: commands.length,
    message: 'Queue created and processing started'
  };
}

/**
 * Process a command queue
 * @param {string} queueId - Queue ID to process
 */
async function processQueue(queueId) {
  const queue = commandQueues.get(queueId);
  if (!queue) {
    logger.error('Queue not found for processing', { queueId });
    return;
  }

  for (let i = 0; i < queue.commands.length; i++) {
    // Check if cancelled
    if (queue.cancelled) {
      // Mark remaining commands as cancelled
      for (let j = i; j < queue.commands.length; j++) {
        if (queue.commands[j].status === 'pending') {
          queue.commands[j].status = 'cancelled';
          queue.commands[j].error = 'Queue was cancelled';
        }
      }
      break;
    }

    const cmd = queue.commands[i];
    queue.currentIndex = i;
    cmd.status = 'running';
    cmd.startTime = Date.now();

    const handler = commandHandlers[cmd.type];
    if (!handler) {
      cmd.status = 'failed';
      cmd.error = `Unknown command type: ${cmd.type}`;
      cmd.endTime = Date.now();

      if (queue.stopOnError) {
        markRemainingAsCancelled(queue, i + 1);
        break;
      }
      continue;
    }

    try {
      // Execute with timeout
      const result = await Promise.race([
        handler(cmd.params),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Command timeout after ${queue.timeout}ms`)), queue.timeout)
        )
      ]);

      cmd.status = 'completed';
      cmd.result = result;
      cmd.endTime = Date.now();
    } catch (error) {
      cmd.status = 'failed';
      cmd.error = error.message;
      cmd.endTime = Date.now();

      if (queue.stopOnError) {
        markRemainingAsCancelled(queue, i + 1);
        break;
      }
    }

    // Apply delay between commands (except for the last one)
    if (queue.delay > 0 && i < queue.commands.length - 1 && !queue.cancelled) {
      await new Promise(resolve => setTimeout(resolve, queue.delay));
    }
  }

  // Mark queue as completed
  queue.status = queue.cancelled ? 'cancelled' : 'completed';
  queue.endTime = Date.now();
  queue.currentIndex = queue.commands.length;

  logger.info('Queue processing finished', {
    queueId,
    status: queue.status,
    duration: queue.endTime - queue.startTime
  });

  // Notify via WebSocket if connected
  if (ws && ws.readyState === WebSocket.OPEN) {
    sendWebSocketMessage({
      type: 'queue_completed',
      queueId,
      status: queue.status,
      summary: getQueueSummary(queue),
      timestamp: Date.now()
    });
  }
}

/**
 * Mark remaining commands in queue as cancelled
 * @param {Object} queue - Queue state object
 * @param {number} startIndex - Index to start marking from
 */
function markRemainingAsCancelled(queue, startIndex) {
  for (let j = startIndex; j < queue.commands.length; j++) {
    if (queue.commands[j].status === 'pending') {
      queue.commands[j].status = 'skipped';
      queue.commands[j].error = 'Skipped due to previous error';
    }
  }
}

/**
 * Get summary statistics for a queue
 * @param {Object} queue - Queue state object
 * @returns {Object} - Summary statistics
 */
function getQueueSummary(queue) {
  const completed = queue.commands.filter(c => c.status === 'completed').length;
  const failed = queue.commands.filter(c => c.status === 'failed').length;
  const pending = queue.commands.filter(c => c.status === 'pending').length;
  const running = queue.commands.filter(c => c.status === 'running').length;
  const cancelled = queue.commands.filter(c => c.status === 'cancelled').length;
  const skipped = queue.commands.filter(c => c.status === 'skipped').length;

  return {
    total: queue.commands.length,
    completed,
    failed,
    pending,
    running,
    cancelled,
    skipped,
    duration: queue.endTime ? queue.endTime - queue.startTime : Date.now() - queue.startTime,
    progress: ((completed + failed + cancelled + skipped) / queue.commands.length * 100).toFixed(1) + '%'
  };
}

/**
 * Get status of a queued command execution
 * @param {Object} params - Status request parameters
 * @param {string} params.queueId - Queue ID from handleCommandQueue
 * @param {boolean} params.includeResults - Include full results for completed commands (default: false)
 * @returns {Promise<Object>} - Queue status and completed results
 */
async function handleGetQueueStatus(params = {}) {
  const { queueId, includeResults = false } = params;

  if (!queueId) {
    throw new Error('Queue ID is required');
  }

  const queue = commandQueues.get(queueId);
  if (!queue) {
    throw new Error(`Queue not found: ${queueId}`);
  }

  logger.info('Getting queue status', { queueId });

  const response = {
    success: true,
    queueId,
    status: queue.status,
    currentIndex: queue.currentIndex,
    summary: getQueueSummary(queue),
    startTime: queue.startTime,
    endTime: queue.endTime
  };

  if (includeResults) {
    response.commands = queue.commands.map(cmd => ({
      index: cmd.index,
      type: cmd.type,
      status: cmd.status,
      result: cmd.status === 'completed' ? cmd.result : undefined,
      error: cmd.error,
      duration: cmd.endTime && cmd.startTime ? cmd.endTime - cmd.startTime : null
    }));
  } else {
    // Only include basic status without full results
    response.commands = queue.commands.map(cmd => ({
      index: cmd.index,
      type: cmd.type,
      status: cmd.status,
      error: cmd.error,
      duration: cmd.endTime && cmd.startTime ? cmd.endTime - cmd.startTime : null
    }));
  }

  return response;
}

/**
 * Cancel a running command queue
 * @param {Object} params - Cancel request parameters
 * @param {string} params.queueId - Queue ID to cancel
 * @returns {Promise<Object>} - Cancellation status
 */
async function handleCancelQueue(params = {}) {
  const { queueId } = params;

  if (!queueId) {
    throw new Error('Queue ID is required');
  }

  const queue = commandQueues.get(queueId);
  if (!queue) {
    throw new Error(`Queue not found: ${queueId}`);
  }

  logger.info('Cancelling queue', { queueId, currentStatus: queue.status });

  if (queue.status === 'completed') {
    return {
      success: false,
      queueId,
      message: 'Queue has already completed',
      status: queue.status,
      summary: getQueueSummary(queue)
    };
  }

  if (queue.status === 'cancelled') {
    return {
      success: false,
      queueId,
      message: 'Queue was already cancelled',
      status: queue.status,
      summary: getQueueSummary(queue)
    };
  }

  // Set cancelled flag - the processQueue function will handle cleanup
  queue.cancelled = true;

  return {
    success: true,
    queueId,
    message: 'Queue cancellation requested',
    status: 'cancelling',
    summary: getQueueSummary(queue)
  };
}

/**
 * Clean up old command queues (call periodically)
 * Removes queues older than 30 minutes
 */
function cleanupCommandQueues() {
  const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;

  for (const [queueId, queue] of commandQueues.entries()) {
    if (queue.endTime && queue.endTime < thirtyMinutesAgo) {
      commandQueues.delete(queueId);
      logger.debug('Cleaned up old queue', { queueId });
    }
  }
}

// Clean up command queues periodically (every 10 minutes)
setInterval(cleanupCommandQueues, 10 * 60 * 1000);

// =============================================================================
// Phase 6 palletAI Integration - Agent Callback Command Handlers
// =============================================================================

/**
 * Request human help for CAPTCHA solving
 * @param {Object} params - CAPTCHA help parameters
 * @param {Object} params.captchaInfo - CAPTCHA information from detector
 * @param {number} params.timeout - Timeout in ms (default: 300000)
 * @param {boolean} params.includeScreenshot - Include screenshot (default: true)
 * @param {string} params.priority - Priority level ('high', 'normal', 'low')
 * @returns {Promise<Object>} - Help request info with requestId
 */
async function handleRequestCaptchaHelp(params = {}) {
  const { captchaInfo, timeout, includeScreenshot, priority } = params;

  if (!captchaInfo) {
    throw new Error('captchaInfo is required for request_captcha_help');
  }

  logger.info('Requesting CAPTCHA help', {
    type: captchaInfo.type,
    provider: captchaInfo.provider,
    priority
  });

  try {
    const result = await AgentCallbacks.requestCaptchaHelp(captchaInfo, {
      timeout,
      includeScreenshot,
      priority
    });

    // Send request to backend via WebSocket
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendWebSocketMessage({
        type: MessageSchema.MessageType.CAPTCHA_HELP_REQUEST,
        request_id: result.requestId,
        captcha: result.request.captcha,
        options: result.request.options,
        timestamp: Date.now()
      });
    }

    return {
      success: true,
      requestId: result.requestId,
      status: 'pending',
      message: 'CAPTCHA help request submitted'
    };
  } catch (error) {
    logger.error('CAPTCHA help request failed', { error: error.message });
    throw error;
  }
}

/**
 * Request approval for sensitive actions
 * @param {Object} params - Approval request parameters
 * @param {string} params.action - Action type requiring approval
 * @param {Object} params.details - Action details
 * @param {number} params.timeout - Timeout in ms (default: 60000)
 * @param {boolean} params.autoApproveOnTimeout - Auto-approve on timeout (default: false)
 * @returns {Promise<Object>} - Approval request info with requestId
 */
async function handleRequestApproval(params = {}) {
  const { action, details, timeout, autoApproveOnTimeout } = params;

  if (!action) {
    throw new Error('action is required for request_approval');
  }

  if (!details) {
    throw new Error('details is required for request_approval');
  }

  logger.info('Requesting approval', {
    action,
    risk: details.risk || 'medium'
  });

  try {
    const result = await AgentCallbacks.requestApproval(action, details, {
      timeout,
      autoApproveOnTimeout
    });

    // Send request to backend via WebSocket
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendWebSocketMessage({
        type: MessageSchema.MessageType.APPROVAL_REQUEST,
        request_id: result.requestId,
        action,
        details: result.request.details,
        options: result.request.options,
        timestamp: Date.now()
      });
    }

    return {
      success: true,
      requestId: result.requestId,
      status: 'pending',
      message: 'Approval request submitted'
    };
  } catch (error) {
    logger.error('Approval request failed', { error: error.message });
    throw error;
  }
}

/**
 * Report progress on long-running operations
 * @param {Object} params - Progress parameters
 * @param {string} params.taskId - Task identifier
 * @param {number} params.progress - Progress percentage (0-100)
 * @param {string} params.message - Status message
 * @param {Object} params.metadata - Additional metadata
 * @returns {Promise<Object>} - Progress report
 */
async function handleReportProgress(params = {}) {
  const { taskId, progress, message, metadata } = params;

  if (!taskId) {
    throw new Error('taskId is required for report_progress');
  }

  if (typeof progress !== 'number') {
    throw new Error('progress must be a number for report_progress');
  }

  logger.debug('Reporting progress', { taskId, progress });

  try {
    const report = AgentCallbacks.reportProgress(taskId, progress, message, metadata);

    // Send progress to backend via WebSocket
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendWebSocketMessage({
        type: MessageSchema.MessageType.PROGRESS_UPDATE,
        task_id: taskId,
        progress: report.progress,
        message: report.message,
        status: report.status,
        metadata: report.metadata,
        timestamp: Date.now()
      });
    }

    return {
      success: true,
      ...report
    };
  } catch (error) {
    logger.error('Progress report failed', { error: error.message });
    throw error;
  }
}

/**
 * Set a breakpoint that pauses execution
 * @param {Object} params - Breakpoint parameters
 * @param {Object} params.condition - Breakpoint condition
 * @param {boolean} params.oneTime - Remove after first hit (default: false)
 * @param {number} params.timeout - Auto-resume timeout in ms (0 = no auto-resume)
 * @returns {Promise<Object>} - Breakpoint info
 */
async function handleSetBreakpoint(params = {}) {
  const { condition, oneTime, timeout } = params;

  logger.info('Setting breakpoint', {
    type: condition?.type || 'always',
    oneTime: !!oneTime
  });

  try {
    const result = AgentCallbacks.setBreakpoint(condition, { oneTime, timeout });

    // Notify backend about new breakpoint
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendWebSocketMessage({
        type: 'breakpoint_set',
        breakpoint_id: result.breakpointId,
        condition: result.breakpoint.condition,
        options: result.breakpoint.options,
        timestamp: Date.now()
      });
    }

    return {
      success: true,
      breakpointId: result.breakpointId,
      breakpoint: result.breakpoint
    };
  } catch (error) {
    logger.error('Set breakpoint failed', { error: error.message });
    throw error;
  }
}

/**
 * Resume execution from a paused breakpoint
 * @param {Object} params - Resume parameters
 * @param {string} params.breakpointId - Breakpoint ID to resume
 * @param {string} params.reason - Reason for resuming
 * @param {Object} params.context - Additional context data
 * @returns {Promise<Object>} - Resume result
 */
async function handleResumeBreakpoint(params = {}) {
  const { breakpointId, reason, context } = params;

  if (!breakpointId) {
    throw new Error('breakpointId is required for resume_breakpoint');
  }

  logger.info('Resuming breakpoint', { breakpointId, reason });

  try {
    const result = AgentCallbacks.resumeFromBreakpoint(breakpointId, { reason, context });

    if (!result.success) {
      throw new Error(result.error);
    }

    // Notify backend about resume
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendWebSocketMessage({
        type: MessageSchema.MessageType.BREAKPOINT_RESUME,
        breakpoint_id: breakpointId,
        reason: reason || 'manual',
        timestamp: Date.now()
      });
    }

    return result;
  } catch (error) {
    logger.error('Resume breakpoint failed', { error: error.message });
    throw error;
  }
}

// =============================================================================
// Phase 6 palletAI Integration - Message Schema Command Handlers
// =============================================================================

/**
 * Get the message schema and version info
 * @param {Object} params - Optional parameters
 * @param {boolean} params.includeFullSchema - Include full JSON Schema (default: false)
 * @returns {Promise<Object>} - Schema version info
 */
async function handleGetSchema(params = {}) {
  const { includeFullSchema = false } = params;

  logger.info('Getting message schema', { includeFullSchema });

  try {
    const versionInfo = MessageSchema.getSchemaVersion();

    const result = {
      success: true,
      version: versionInfo.version,
      minCompatibleVersion: versionInfo.minCompatible,
      messageTypes: Object.values(MessageSchema.MessageType),
      timestamp: versionInfo.timestamp
    };

    if (includeFullSchema) {
      result.schema = MessageSchema.getSchema();
    }

    return result;
  } catch (error) {
    logger.error('Get schema failed', { error: error.message });
    throw error;
  }
}

/**
 * Negotiate schema version with client
 * @param {Object} params - Negotiation parameters
 * @param {string} params.clientVersion - Client's schema version
 * @param {Array<string>} params.supportedVersions - Client's supported versions
 * @param {Array<string>} params.capabilities - Client's capabilities
 * @returns {Promise<Object>} - Negotiation result
 */
async function handleNegotiateVersion(params = {}) {
  const { clientVersion, supportedVersions, capabilities } = params;

  if (!clientVersion) {
    throw new Error('clientVersion is required for negotiate_version');
  }

  logger.info('Negotiating version', { clientVersion });

  try {
    const result = MessageSchema.negotiateVersion(
      clientVersion,
      supportedVersions || [],
      capabilities || []
    );

    // Send negotiation response
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendWebSocketMessage({
        type: MessageSchema.MessageType.VERSION_RESPONSE,
        server_version: result.serverVersion,
        negotiated_version: result.negotiatedVersion,
        compatible: result.compatible,
        capabilities: result.capabilities,
        warnings: result.warnings,
        timestamp: Date.now()
      });
    }

    return {
      success: true,
      ...result
    };
  } catch (error) {
    logger.error('Version negotiation failed', { error: error.message });
    throw error;
  }
}

// =============================================================================
// Phase 6 palletAI Integration - Streaming Command Handlers
// =============================================================================

/**
 * Start a streaming response
 * @param {Object} params - Stream parameters
 * @param {*} params.data - Data to stream (can be large object, string, etc.)
 * @param {number} params.chunkSize - Size of each chunk (default: 64KB)
 * @param {string} params.contentType - Content type
 * @returns {Promise<Object>} - Stream info with ID
 */
async function handleStartStream(params = {}) {
  const { data, chunkSize, contentType } = params;

  if (data === undefined) {
    throw new Error('data is required for start_stream');
  }

  logger.info('Starting stream', {
    hasData: data !== undefined,
    chunkSize,
    contentType
  });

  try {
    // Use handleLargeResponse for data chunking
    const chunkedResponse = StreamingHandler.handleLargeResponse(data, chunkSize, {
      contentType
    });

    // Create a stream from the chunked response
    const stream = chunkedResponse.toStream();
    await stream.start();

    // Send stream start message
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendWebSocketMessage({
        type: MessageSchema.MessageType.STREAM_START,
        stream_id: stream.streamId,
        totalChunks: chunkedResponse.totalChunks,
        totalSize: chunkedResponse.totalSize,
        contentType: chunkedResponse.contentType,
        encoding: chunkedResponse.encoding,
        timestamp: Date.now()
      });
    }

    return {
      success: true,
      streamId: stream.streamId,
      totalChunks: chunkedResponse.totalChunks,
      totalSize: chunkedResponse.totalSize,
      contentType: chunkedResponse.contentType,
      encoding: chunkedResponse.encoding
    };
  } catch (error) {
    logger.error('Start stream failed', { error: error.message });
    throw error;
  }
}

/**
 * Get the next chunk from a stream
 * @param {Object} params - Chunk request parameters
 * @param {string} params.streamId - Stream ID
 * @returns {Promise<Object>} - Chunk data or completion signal
 */
async function handleGetStreamChunk(params = {}) {
  const { streamId } = params;

  if (!streamId) {
    throw new Error('streamId is required for get_stream_chunk');
  }

  logger.debug('Getting stream chunk', { streamId });

  try {
    const stream = StreamingHandler.getStream(streamId);
    if (!stream) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    // Get the internal stream object for iteration
    const activeStreams = StreamingHandler.getActiveStreams();
    const streamInfo = activeStreams.find(s => s.id === streamId);

    if (!streamInfo) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    if (streamInfo.state === 'completed') {
      // Send stream end message
      if (ws && ws.readyState === WebSocket.OPEN) {
        sendWebSocketMessage({
          type: MessageSchema.MessageType.STREAM_END,
          stream_id: streamId,
          success: true,
          totalChunks: streamInfo.sentChunks,
          totalSize: streamInfo.totalSize,
          timestamp: Date.now()
        });
      }

      return {
        success: true,
        streamId,
        done: true,
        totalChunks: streamInfo.sentChunks,
        totalSize: streamInfo.totalSize
      };
    }

    // This requires accessing internals - simplified for command response
    return {
      success: true,
      streamId,
      state: streamInfo.state,
      sentChunks: streamInfo.sentChunks,
      message: 'Use stream iterator for chunk retrieval'
    };
  } catch (error) {
    // Send error in stream end message
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendWebSocketMessage({
        type: MessageSchema.MessageType.STREAM_END,
        stream_id: streamId,
        success: false,
        error: error.message,
        timestamp: Date.now()
      });
    }

    logger.error('Get stream chunk failed', { error: error.message });
    throw error;
  }
}

// Clean up agent resources periodically (every 15 minutes)
setInterval(() => {
  try {
    AgentCallbacks.cleanupPendingCallbacks();
    AgentCallbacks.cleanupProgressTrackers();
    StreamingHandler.cleanupStreams();
    logger.debug('Agent resources cleaned up');
  } catch (error) {
    logger.error('Agent resource cleanup failed', { error: error.message });
  }
}, 15 * 60 * 1000);

// =============================================================================
// Tab Event Listeners for State Tracking
// =============================================================================

// Listen for tab creation
chrome.tabs.onCreated.addListener((tab) => {
  logger.debug('Tab created', { tabId: tab.id, url: tab.url });
  updateTabState(tab.id, {
    createdAt: Date.now(),
    status: tab.status || 'loading',
    url: tab.url,
    title: tab.title
  });
});

// Listen for tab updates (loading, complete, URL change, etc.)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  logger.debug('Tab updated', { tabId, changeInfo });

  const updates = {};

  if (changeInfo.status) {
    updates.status = changeInfo.status;
    if (changeInfo.status === 'loading') {
      updates.loadingStartedAt = Date.now();
    } else if (changeInfo.status === 'complete') {
      updates.loadingCompletedAt = Date.now();
    }
  }

  if (changeInfo.url) {
    updates.url = changeInfo.url;
    updates.urlChangedAt = Date.now();
  }

  if (changeInfo.title) {
    updates.title = changeInfo.title;
  }

  if (changeInfo.favIconUrl) {
    updates.favIconUrl = changeInfo.favIconUrl;
  }

  if (Object.keys(updates).length > 0) {
    updateTabState(tabId, updates);
  }
});

// Listen for tab activation (switching tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
  logger.debug('Tab activated', { tabId: activeInfo.tabId, windowId: activeInfo.windowId });
  updateTabState(activeInfo.tabId, {
    lastActivatedAt: Date.now()
  });
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  logger.debug('Tab removed', { tabId, windowId: removeInfo.windowId, isWindowClosing: removeInfo.isWindowClosing });
  // Clean up state for removed tab
  tabStates.delete(tabId);
});

// Listen for tab group changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.groupId !== undefined) {
    logger.debug('Tab group changed', { tabId, groupId: changeInfo.groupId });
    updateTabState(tabId, {
      groupId: changeInfo.groupId,
      groupChangedAt: Date.now()
    });
  }
});

// Listen for tab group updates (title, color, collapsed state)
chrome.tabGroups.onUpdated.addListener((group) => {
  logger.debug('Tab group updated', {
    groupId: group.id,
    title: group.title,
    color: group.color,
    collapsed: group.collapsed
  });

  // Notify via WebSocket
  if (ws && ws.readyState === WebSocket.OPEN) {
    sendWebSocketMessage({
      type: 'tab_group_updated',
      group: {
        id: group.id,
        title: group.title,
        color: group.color,
        collapsed: group.collapsed,
        windowId: group.windowId
      },
      timestamp: Date.now()
    });
  }
});

// Listen for tab group creation
chrome.tabGroups.onCreated.addListener((group) => {
  logger.debug('Tab group created', {
    groupId: group.id,
    title: group.title,
    color: group.color
  });

  if (ws && ws.readyState === WebSocket.OPEN) {
    sendWebSocketMessage({
      type: 'tab_group_created',
      group: {
        id: group.id,
        title: group.title,
        color: group.color,
        collapsed: group.collapsed,
        windowId: group.windowId
      },
      timestamp: Date.now()
    });
  }
});

// Listen for tab group removal
chrome.tabGroups.onRemoved.addListener((group) => {
  logger.debug('Tab group removed', { groupId: group.id });

  if (ws && ws.readyState === WebSocket.OPEN) {
    sendWebSocketMessage({
      type: 'tab_group_removed',
      groupId: group.id,
      timestamp: Date.now()
    });
  }
});

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
      files: ['utils/logger.js', 'utils/captcha-detector.js', 'utils/form-detector.js', 'data/form-templates.js', 'content.js']
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

// Handle content script notifications (ready, CAPTCHA, errors, etc.)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  switch (request.type) {
    case 'content_script_error':
      // Forward content script errors to backend via WebSocket
      logger.error('Content script error', {
        url: request.data?.url,
        tabId,
        message: request.data?.message,
        filename: request.data?.filename,
        lineno: request.data?.lineno
      });

      // Forward to backend using the same error forwarding mechanism
      sendErrorToBackend({
        message: request.data?.message || 'Unknown content script error',
        filename: request.data?.filename || 'content.js',
        lineno: request.data?.lineno || 0,
        colno: request.data?.colno || 0,
        stack: request.data?.stack || '',
        timestamp: request.data?.timestamp || new Date().toISOString(),
        source: 'content',
        pageUrl: request.data?.url
      });

      sendResponse({ acknowledged: true });
      return true;

    case 'content_script_ready':
      logger.debug('Content script ready', { url: request.url, tabId });
      sendResponse({ acknowledged: true });
      return true;

    case 'captcha_detected':
      logger.info('CAPTCHA detected on page', {
        url: request.url,
        tabId,
        captchaTypes: request.captcha?.types,
        count: request.captcha?.count
      });

      // Send CAPTCHA notification to backend via WebSocket
      if (ws && ws.readyState === WebSocket.OPEN) {
        sendWebSocketMessage({
          type: 'captcha_detected',
          tabId,
          url: request.url,
          captcha: request.captcha,
          timestamp: request.timestamp
        });
      }

      // Store CAPTCHA state for this tab
      if (tabId) {
        tabStates.set(tabId, {
          ...tabStates.get(tabId),
          captcha: request.captcha,
          captchaDetectedAt: request.timestamp
        });
      }

      sendResponse({ acknowledged: true });
      return true;

    case 'captcha_state_changed':
      logger.info('CAPTCHA state changed', {
        url: request.url,
        tabId,
        previouslySolved: !request.previousState?.anyUnsolved,
        nowSolved: !request.currentState?.anyUnsolved
      });

      // Notify backend of state change
      if (ws && ws.readyState === WebSocket.OPEN) {
        sendWebSocketMessage({
          type: 'captcha_state_changed',
          tabId,
          url: request.url,
          previousState: request.previousState,
          currentState: request.currentState,
          timestamp: request.timestamp
        });
      }

      // Update stored state
      if (tabId) {
        tabStates.set(tabId, {
          ...tabStates.get(tabId),
          captcha: request.currentState,
          captchaStateChangedAt: request.timestamp
        });
      }

      sendResponse({ acknowledged: true });
      return true;
  }
});

// =============================================================================
// Knowledge Base Integration - Tool Parser Command Handlers (Phase 5.1)
// =============================================================================

// Tool parser instance
const toolParser = new ToolParser({ logger: logger.child ? logger.child('ToolParser') : logger });

/**
 * Parse OSINT tool YAML configuration
 * @param {Object} params - { yaml_content: string }
 * @returns {Object} Parsed tool configuration
 */
async function handleParseToolConfig(params = {}) {
  const { yaml_content, yamlContent, content } = params;
  const yamlData = yaml_content || yamlContent || content;

  if (!yamlData) {
    throw new Error('YAML content is required (yaml_content, yamlContent, or content parameter)');
  }

  logger.info('Parsing tool configuration', { contentLength: yamlData.length });

  try {
    const result = toolParser.parseToolInfo(yamlData);

    if (!result.success) {
      throw new Error(result.error);
    }

    return {
      success: true,
      config: result.config,
      metadata: result.metadata,
      warnings: result.warnings || []
    };
  } catch (error) {
    throw new Error(`Failed to parse tool configuration: ${error.message}`);
  }
}

/**
 * Generate field mappings from tool configuration
 * @param {Object} params - { config: Object } or { yaml_content: string }
 * @returns {Object} Field mappings for form automation
 */
async function handleGetFieldMappings(params = {}) {
  const { config, yaml_content, yamlContent, content } = params;

  let toolConfig = config;

  // If YAML content provided, parse it first
  if (!toolConfig && (yaml_content || yamlContent || content)) {
    const yamlData = yaml_content || yamlContent || content;
    const parseResult = toolParser.parseToolInfo(yamlData);
    if (!parseResult.success) {
      throw new Error(`Failed to parse YAML: ${parseResult.error}`);
    }
    toolConfig = parseResult.config;
  }

  if (!toolConfig) {
    throw new Error('Tool configuration is required (config or yaml_content parameter)');
  }

  logger.info('Generating field mappings', { toolName: toolConfig.tool_name || 'unknown' });

  try {
    const result = toolParser.generateFieldMappings(toolConfig);

    if (!result.success) {
      throw new Error(result.error);
    }

    return {
      success: true,
      mappings: result.mappings,
      metadata: result.metadata
    };
  } catch (error) {
    throw new Error(`Failed to generate field mappings: ${error.message}`);
  }
}

/**
 * Get command preset for a common OSINT tool
 * @param {Object} params - { tool_name: string, command?: string }
 * @returns {Object} Tool preset configuration
 */
async function handleGetToolPreset(params = {}) {
  const { tool_name, toolName, tool, command, command_name } = params;
  const name = tool_name || toolName || tool;
  const cmd = command || command_name;

  if (!name) {
    throw new Error('Tool name is required (tool_name, toolName, or tool parameter)');
  }

  logger.info('Getting tool preset', { tool: name, command: cmd || 'all' });

  try {
    const result = toolParser.getCommandPreset(name, cmd);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        availableTools: result.availableTools,
        availableCommands: result.availableCommands
      };
    }

    return {
      success: true,
      preset: result.preset
    };
  } catch (error) {
    throw new Error(`Failed to get tool preset: ${error.message}`);
  }
}

/**
 * Chain tool outputs to inputs for workflow automation
 * @param {Object} params - { tool_sequence: Array, initial_data?: Object }
 * @returns {Object} Chained workflow configuration
 */
async function handleChainTools(params = {}) {
  const { tool_sequence, toolSequence, sequence, steps, initial_data, initialData } = params;
  const tools = tool_sequence || toolSequence || sequence || steps;
  const initData = initial_data || initialData || {};

  if (!tools || !Array.isArray(tools)) {
    throw new Error('Tool sequence is required and must be an array (tool_sequence, toolSequence, sequence, or steps parameter)');
  }

  logger.info('Chaining tools', { stepCount: tools.length, hasInitialData: Object.keys(initData).length > 0 });

  try {
    const result = toolParser.chainTools(tools, initData);

    if (!result.success) {
      throw new Error(result.error);
    }

    return {
      success: true,
      workflow: result.workflow,
      metadata: result.metadata
    };
  } catch (error) {
    throw new Error(`Failed to chain tools: ${error.message}`);
  }
}

/**
 * List all available tool presets
 * @param {Object} params - Optional parameters (category filter, etc.)
 * @returns {Object} List of available tool presets
 */
async function handleListToolPresets(params = {}) {
  const { category } = params;

  logger.info('Listing tool presets', { category: category || 'all' });

  try {
    const result = toolParser.listPresets();

    let tools = result.tools;

    // Filter by category if specified
    if (category) {
      tools = tools.filter(t => t.category === category);
    }

    return {
      success: true,
      tools,
      count: tools.length,
      categories: result.categories
    };
  } catch (error) {
    throw new Error(`Failed to list tool presets: ${error.message}`);
  }
}

// =============================================================================
// Phase 5.3 Data Pipeline Command Handlers
// =============================================================================

/**
 * Normalize data based on type
 * @param {Object} params - { type: 'date'|'name'|'address'|'phone'|'email', data: any, options?: Object }
 * @returns {Object} Normalization result
 */
async function handleNormalizeData(params) {
  const { type, data, options = {} } = params;

  logger.info('Normalizing data', { type, dataLength: JSON.stringify(data).length });

  if (!type) {
    throw new Error('Normalization type is required');
  }

  if (data === undefined || data === null) {
    throw new Error('Data to normalize is required');
  }

  const normalizedType = type.toLowerCase();

  try {
    let result;
    switch (normalizedType) {
      case 'date':
        result = normalizeDate(data, options);
        break;
      case 'name':
        result = normalizeName(data, options);
        break;
      case 'address':
        result = normalizeAddress(data, options);
        break;
      case 'phone':
        result = normalizePhone(data, options);
        break;
      case 'email':
        result = normalizeEmail(data, options);
        break;
      default:
        throw new Error(`Unknown normalization type: ${type}. Valid types: date, name, address, phone, email`);
    }

    return {
      success: result.success,
      type: normalizedType,
      original: data,
      normalized: result.normalized,
      components: result.components,
      formatted: result.formatted,
      errors: result.errors,
      warnings: result.warnings
    };
  } catch (error) {
    throw new Error(`Normalization failed: ${error.message}`);
  }
}

/**
 * Create a new entity
 * @param {Object} params - { type: string, data: Object, options?: Object }
 * @returns {Object} Created entity
 */
async function handleCreateEntity(params) {
  const { type, data, options = {} } = params;

  logger.info('Creating entity', { type, fieldCount: Object.keys(data || {}).length });

  if (!type) {
    throw new Error('Entity type is required');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Entity data must be a non-null object');
  }

  try {
    const result = createEntity(type, data, options);

    if (!result.success) {
      throw new Error(result.errors.map(e => e.message).join('; '));
    }

    return {
      success: true,
      entity: result.entity,
      warnings: result.warnings
    };
  } catch (error) {
    throw new Error(`Failed to create entity: ${error.message}`);
  }
}

/**
 * Link two entities together
 * @param {Object} params - { entity1: string, entity2: string, relationshipType: string, options?: Object }
 * @returns {Object} Link result
 */
async function handleLinkEntities(params) {
  const { entity1, entity2, relationshipType, options = {} } = params;

  logger.info('Linking entities', { entity1, entity2, relationshipType });

  if (!entity1 || !entity2) {
    throw new Error('Both entity1 and entity2 IDs are required');
  }

  if (!relationshipType) {
    throw new Error('Relationship type is required');
  }

  try {
    const result = linkEntities(entity1, entity2, relationshipType, options);

    if (!result.success) {
      throw new Error(result.errors.map(e => e.message).join('; '));
    }

    return {
      success: true,
      relationships: result.relationships,
      warnings: result.warnings
    };
  } catch (error) {
    throw new Error(`Failed to link entities: ${error.message}`);
  }
}

/**
 * Get entities related to a given entity
 * @param {Object} params - { entityId: string, options?: Object }
 * @returns {Object} Related entities
 */
async function handleGetRelated(params) {
  const { entityId, options = {} } = params;

  logger.info('Getting related entities', { entityId, options });

  if (!entityId) {
    throw new Error('Entity ID is required');
  }

  try {
    const result = getRelatedEntities(entityId, options);

    if (!result.success) {
      throw new Error(result.errors.map(e => e.message).join('; '));
    }

    return {
      success: true,
      entity: result.entity,
      related: result.related,
      relationships: result.relationships,
      count: result.related.length
    };
  } catch (error) {
    throw new Error(`Failed to get related entities: ${error.message}`);
  }
}

/**
 * Export entities in specified format
 * @param {Object} params - { format: 'json'|'csv', options?: Object }
 * @returns {Object} Export result with data
 */
async function handleExportEntities(params) {
  const { format, options = {} } = params;

  logger.info('Exporting entities', { format, options });

  if (!format) {
    throw new Error('Export format is required (json or csv)');
  }

  try {
    const result = exportEntities(format, options);

    if (!result.success) {
      throw new Error(result.errors.map(e => e.message).join('; '));
    }

    return {
      success: true,
      format: result.format,
      data: result.data,
      relationshipsCSV: result.relationshipsCSV,
      metadata: result.metadata
    };
  } catch (error) {
    throw new Error(`Failed to export entities: ${error.message}`);
  }
}

/**
 * Deduplicate entities based on matching fields
 * @param {Object} params - { entities: Array, options: Object }
 * @returns {Object} Deduplication result
 */
async function handleDeduplicate(params) {
  const { entities, options = {} } = params;

  logger.info('Deduplicating entities', { count: entities?.length, options });

  if (!entities || !Array.isArray(entities)) {
    throw new Error('Entities must be an array');
  }

  if (!options.matchFields || !Array.isArray(options.matchFields) || options.matchFields.length === 0) {
    throw new Error('matchFields array is required in options');
  }

  try {
    const result = deduplicateEntities(entities, options);

    if (!result.success) {
      throw new Error(result.errors.map(e => e.message).join('; '));
    }

    return {
      success: true,
      deduplicated: result.deduplicated,
      duplicates: result.duplicates,
      stats: result.stats,
      warnings: result.warnings
    };
  } catch (error) {
    throw new Error(`Failed to deduplicate entities: ${error.message}`);
  }
}

/**
 * Get an entity by ID
 * @param {Object} params - { entityId: string }
 * @returns {Object} Entity
 */
async function handleGetEntity(params) {
  const { entityId } = params;

  logger.info('Getting entity', { entityId });

  if (!entityId) {
    throw new Error('Entity ID is required');
  }

  try {
    const entity = getEntity(entityId);

    if (!entity) {
      throw new Error(`Entity with ID '${entityId}' not found`);
    }

    return {
      success: true,
      entity
    };
  } catch (error) {
    throw new Error(`Failed to get entity: ${error.message}`);
  }
}

/**
 * Update an entity
 * @param {Object} params - { entityId: string, data: Object, options?: Object }
 * @returns {Object} Updated entity
 */
async function handleUpdateEntity(params) {
  const { entityId, data, options = {} } = params;

  logger.info('Updating entity', { entityId, fieldCount: Object.keys(data || {}).length });

  if (!entityId) {
    throw new Error('Entity ID is required');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Update data must be a non-null object');
  }

  try {
    const result = updateEntity(entityId, data, options);

    if (!result.success) {
      throw new Error(result.errors.map(e => e.message).join('; '));
    }

    return {
      success: true,
      entity: result.entity,
      warnings: result.warnings
    };
  } catch (error) {
    throw new Error(`Failed to update entity: ${error.message}`);
  }
}

/**
 * Delete an entity
 * @param {Object} params - { entityId: string }
 * @returns {Object} Delete result
 */
async function handleDeleteEntity(params) {
  const { entityId } = params;

  logger.info('Deleting entity', { entityId });

  if (!entityId) {
    throw new Error('Entity ID is required');
  }

  try {
    const result = deleteEntity(entityId);

    if (!result.success) {
      throw new Error(result.errors.map(e => e.message).join('; '));
    }

    return {
      success: true,
      deleted: result.deleted
    };
  } catch (error) {
    throw new Error(`Failed to delete entity: ${error.message}`);
  }
}

/**
 * Query entities
 * @param {Object} params - { query: Object }
 * @returns {Object} Query results
 */
async function handleQueryEntities(params) {
  const { query = {} } = params;

  logger.info('Querying entities', { query });

  try {
    const result = queryEntities(query);

    return {
      success: true,
      entities: result.entities,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore
    };
  } catch (error) {
    throw new Error(`Failed to query entities: ${error.message}`);
  }
}

/**
 * Get entity store statistics
 * @param {Object} params - Optional parameters
 * @returns {Object} Statistics
 */
async function handleGetEntityStats(params = {}) {
  logger.info('Getting entity statistics');

  try {
    const stats = getEntityStats();

    return {
      success: true,
      stats
    };
  } catch (error) {
    throw new Error(`Failed to get entity stats: ${error.message}`);
  }
}

/**
 * Clear all entities
 * @param {Object} params - Optional parameters (confirm: boolean)
 * @returns {Object} Clear result
 */
async function handleClearEntities(params = {}) {
  const { confirm = false } = params;

  logger.info('Clearing all entities', { confirm });

  if (!confirm) {
    throw new Error('Confirmation required: set confirm: true to clear all entities');
  }

  try {
    const result = clearEntities();

    return {
      success: true,
      message: result.message
    };
  } catch (error) {
    throw new Error(`Failed to clear entities: ${error.message}`);
  }
}

// =============================================================================
// Phase 5.3 Data Pipeline - Basset Hound Backend Sync Command Handlers
// =============================================================================

/**
 * Connect to basset-hound backend for syncing
 * @param {Object} params - { url: string, options?: Object }
 * @returns {Object} Connection result
 */
async function handleSyncConnect(params) {
  const { url, options = {} } = params;

  logger.info('Connecting to basset-hound sync backend', { url });

  if (!url) {
    throw new Error('WebSocket URL is required');
  }

  try {
    const sync = getBassetHoundSync(options);
    const result = await sync.connect(url);

    if (result.success) {
      // Enable entity sync hooks if auto-sync is requested
      if (options.enableHooks) {
        enableEntitySyncHooks();
      }
    }

    return {
      success: result.success,
      message: result.message,
      status: result.status,
      error: result.error
    };
  } catch (error) {
    throw new Error(`Failed to connect to sync backend: ${error.message}`);
  }
}

/**
 * Disconnect from basset-hound backend
 * @param {Object} params - Optional parameters
 * @returns {Object} Disconnect result
 */
async function handleSyncDisconnect(params = {}) {
  logger.info('Disconnecting from basset-hound sync backend');

  try {
    const sync = getBassetHoundSync();
    const result = sync.disconnect();

    return {
      success: result.success,
      message: result.message,
      offlineQueueSize: result.offlineQueueSize
    };
  } catch (error) {
    throw new Error(`Failed to disconnect from sync backend: ${error.message}`);
  }
}

/**
 * Sync a single entity to backend
 * @param {Object} params - { entity: Object, options?: Object }
 * @returns {Object} Sync result
 */
async function handleSyncEntity(params) {
  const { entity, entityId, options = {} } = params;

  // Allow syncing by entityId (fetch from store) or direct entity
  let entityToSync = entity;
  if (!entityToSync && entityId) {
    entityToSync = getEntity(entityId);
    if (!entityToSync) {
      throw new Error(`Entity with ID '${entityId}' not found`);
    }
  }

  if (!entityToSync) {
    throw new Error('Entity or entityId is required');
  }

  logger.info('Syncing entity to backend', { entityId: entityToSync.id, type: entityToSync.type });

  try {
    const sync = getBassetHoundSync();
    const result = await sync.syncEntity(entityToSync, options);

    return {
      success: result.success,
      queued: result.queued,
      error: result.error,
      resolution: result.resolution
    };
  } catch (error) {
    throw new Error(`Failed to sync entity: ${error.message}`);
  }
}

/**
 * Batch sync multiple entities to backend
 * @param {Object} params - { entities?: Array, entityIds?: Array, options?: Object }
 * @returns {Object} Batch sync result
 */
async function handleSyncEntities(params) {
  const { entities, entityIds, options = {} } = params;

  // Resolve entities from IDs if needed
  let entitiesToSync = entities;
  if (!entitiesToSync && entityIds && Array.isArray(entityIds)) {
    entitiesToSync = entityIds.map(id => getEntity(id)).filter(Boolean);
  }

  if (!entitiesToSync || !Array.isArray(entitiesToSync) || entitiesToSync.length === 0) {
    throw new Error('Entities array or entityIds array is required');
  }

  logger.info('Batch syncing entities to backend', { count: entitiesToSync.length });

  try {
    const sync = getBassetHoundSync();
    const result = await sync.syncEntities(entitiesToSync, options);

    return {
      success: result.success,
      queued: result.queued,
      queuedCount: result.queuedCount,
      syncedCount: result.syncedCount,
      conflictCount: result.conflictCount,
      errorCount: result.errorCount,
      duration: result.duration,
      error: result.error
    };
  } catch (error) {
    throw new Error(`Failed to batch sync entities: ${error.message}`);
  }
}

/**
 * Pull entities from backend
 * @param {Object} params - { query?: Object }
 * @returns {Object} Pull result with entities
 */
async function handlePullEntities(params = {}) {
  const { query = {} } = params;

  logger.info('Pulling entities from backend', { query });

  try {
    const sync = getBassetHoundSync();
    const result = await sync.pullEntities(query);

    // Store pulled entities locally if successful
    if (result.success && result.entities && result.entities.length > 0) {
      let storedCount = 0;
      for (const entity of result.entities) {
        // Check if entity exists locally
        const existing = getEntity(entity.id);
        if (existing) {
          // Update existing entity
          const updateResult = updateEntity(entity.id, entity.data, { merge: true });
          if (updateResult.success) storedCount++;
        } else {
          // Create new entity
          const createResult = createEntity(entity.type, entity.data, {
            metadata: entity.metadata
          });
          if (createResult.success) storedCount++;
        }
      }
      result.storedCount = storedCount;
    }

    return {
      success: result.success,
      entities: result.entities,
      total: result.total,
      hasMore: result.hasMore,
      storedCount: result.storedCount,
      serverTimestamp: result.serverTimestamp,
      error: result.error
    };
  } catch (error) {
    throw new Error(`Failed to pull entities from backend: ${error.message}`);
  }
}

/**
 * Subscribe to entity update events from backend
 * @param {Object} params - { entityTypes: Array<string> }
 * @returns {Object} Subscription result
 */
async function handleSubscribeEntityUpdates(params) {
  const { entityTypes } = params;

  if (!entityTypes || !Array.isArray(entityTypes) || entityTypes.length === 0) {
    throw new Error('entityTypes array is required');
  }

  logger.info('Subscribing to entity updates', { entityTypes });

  try {
    const sync = getBassetHoundSync();
    const result = await sync.subscribeToUpdates(entityTypes);

    return {
      success: result.success,
      queued: result.queued,
      subscribedTypes: result.subscribedTypes,
      serverConfirmed: result.serverConfirmed,
      error: result.error
    };
  } catch (error) {
    throw new Error(`Failed to subscribe to entity updates: ${error.message}`);
  }
}

/**
 * Unsubscribe from entity update events
 * @param {Object} params - { entityTypes: Array<string> }
 * @returns {Object} Unsubscription result
 */
async function handleUnsubscribeEntityUpdates(params) {
  const { entityTypes } = params;

  if (!entityTypes || !Array.isArray(entityTypes)) {
    throw new Error('entityTypes array is required');
  }

  logger.info('Unsubscribing from entity updates', { entityTypes });

  try {
    const sync = getBassetHoundSync();
    const result = await sync.unsubscribeFromUpdates(entityTypes);

    return {
      success: result.success,
      subscribedTypes: result.subscribedTypes,
      error: result.error
    };
  } catch (error) {
    throw new Error(`Failed to unsubscribe from entity updates: ${error.message}`);
  }
}

/**
 * Get current sync status
 * @param {Object} params - Optional parameters
 * @returns {Object} Sync status information
 */
async function handleGetSyncStatus(params = {}) {
  logger.info('Getting sync status');

  try {
    const sync = getBassetHoundSync();
    const status = sync.getSyncStatus();

    return {
      success: true,
      ...status
    };
  } catch (error) {
    throw new Error(`Failed to get sync status: ${error.message}`);
  }
}

/**
 * Set auto-sync interval
 * @param {Object} params - { interval: number (ms) }
 * @returns {Object} Configuration result
 */
async function handleSetSyncInterval(params) {
  const { interval } = params;

  if (typeof interval !== 'number' || interval < 1000) {
    throw new Error('Interval must be a number of at least 1000ms');
  }

  logger.info('Setting sync interval', { interval });

  try {
    const sync = getBassetHoundSync();
    const result = sync.setSyncInterval(interval);

    return {
      success: result.success,
      syncInterval: result.syncInterval,
      autoSyncEnabled: result.autoSyncEnabled,
      error: result.error
    };
  } catch (error) {
    throw new Error(`Failed to set sync interval: ${error.message}`);
  }
}

/**
 * Enable or disable automatic syncing
 * @param {Object} params - { enabled: boolean }
 * @returns {Object} Configuration result
 */
async function handleEnableAutoSync(params) {
  const { enabled } = params;

  if (typeof enabled !== 'boolean') {
    throw new Error('enabled parameter must be a boolean');
  }

  logger.info('Configuring auto-sync', { enabled });

  try {
    const sync = getBassetHoundSync();
    const result = sync.enableAutoSync(enabled);

    // Enable entity hooks when auto-sync is enabled
    if (enabled) {
      enableEntitySyncHooks();
    }

    return {
      success: result.success,
      autoSyncEnabled: result.autoSyncEnabled,
      syncInterval: result.syncInterval
    };
  } catch (error) {
    throw new Error(`Failed to configure auto-sync: ${error.message}`);
  }
}

/**
 * Get offline queue contents
 * @param {Object} params - Optional parameters
 * @returns {Object} Offline queue
 */
async function handleGetOfflineQueue(params = {}) {
  logger.info('Getting offline queue');

  try {
    const sync = getBassetHoundSync();
    const queue = sync.getOfflineQueue();

    return {
      success: true,
      queue,
      count: queue.length
    };
  } catch (error) {
    throw new Error(`Failed to get offline queue: ${error.message}`);
  }
}

/**
 * Clear offline queue
 * @param {Object} params - Optional parameters (confirm: boolean)
 * @returns {Object} Clear result
 */
async function handleClearOfflineQueue(params = {}) {
  const { confirm = false } = params;

  logger.info('Clearing offline queue', { confirm });

  if (!confirm) {
    throw new Error('Confirmation required: set confirm: true to clear the offline queue');
  }

  try {
    const sync = getBassetHoundSync();
    const result = sync.clearOfflineQueue();

    return {
      success: result.success,
      clearedCount: result.clearedCount
    };
  } catch (error) {
    throw new Error(`Failed to clear offline queue: ${error.message}`);
  }
}

// =============================================================================
// Phase 4.6 Bot Detection Evasion - Fingerprint Randomization Handlers
// =============================================================================

/**
 * Enable fingerprint protection
 * @param {Object} params - Protection options
 * @returns {Object} Protection status
 */
async function handleEnableFingerprintProtection(params = {}) {
  const { options = {} } = params;

  logger.info('Enabling fingerprint protection', { options });

  try {
    // Send message to content script to apply protection
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      throw new Error('No active tab found');
    }

    const response = await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'enable_fingerprint_protection',
      options
    });

    // Log to audit
    if (typeof auditLogger !== 'undefined') {
      auditLogger.log('fingerprint_protection_enabled', { options }, 'info');
    }

    return response || { success: true, enabled: true };
  } catch (error) {
    throw new Error(`Failed to enable fingerprint protection: ${error.message}`);
  }
}

/**
 * Disable fingerprint protection
 * @returns {Object} Protection status
 */
async function handleDisableFingerprintProtection() {
  logger.info('Disabling fingerprint protection');

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      throw new Error('No active tab found');
    }

    const response = await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'disable_fingerprint_protection'
    });

    // Log to audit
    if (typeof auditLogger !== 'undefined') {
      auditLogger.log('fingerprint_protection_disabled', {}, 'info');
    }

    return response || { success: true, enabled: false };
  } catch (error) {
    throw new Error(`Failed to disable fingerprint protection: ${error.message}`);
  }
}

/**
 * Get fingerprint protection status
 * @returns {Object} Current status
 */
async function handleGetFingerprintStatus() {
  logger.debug('Getting fingerprint status');

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      throw new Error('No active tab found');
    }

    const response = await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'get_fingerprint_status'
    });

    return response || { enabled: false, protections: {} };
  } catch (error) {
    throw new Error(`Failed to get fingerprint status: ${error.message}`);
  }
}

/**
 * Regenerate fingerprint profiles
 * @returns {Object} New profiles
 */
async function handleRegenerateFingerprint() {
  logger.info('Regenerating fingerprint profiles');

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      throw new Error('No active tab found');
    }

    const response = await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'regenerate_fingerprint'
    });

    // Log to audit
    if (typeof auditLogger !== 'undefined') {
      auditLogger.log('fingerprint_regenerated', {}, 'info');
    }

    return response || { success: true };
  } catch (error) {
    throw new Error(`Failed to regenerate fingerprint: ${error.message}`);
  }
}

// =============================================================================
// Network Export Command Handlers
// =============================================================================

/**
 * Export network log as HAR format
 * @param {Object} params - Export parameters
 * @param {string} params.urlPattern - Filter by URL pattern (regex)
 * @param {string} params.method - Filter by HTTP method
 * @param {string} params.type - Filter by resource type
 * @param {boolean} params.includeContent - Include response content
 * @returns {Object} - HAR formatted network log
 */
async function handleExportNetworkHAR(params = {}) {
  logger.info('Exporting network log as HAR', params);

  try {
    const result = networkExporter.exportAsHAR({
      urlPattern: params.urlPattern,
      method: params.method,
      type: params.type,
      includeContent: params.includeContent || false
    });

    // Log to audit
    if (typeof auditLogger !== 'undefined') {
      auditLogger.log('network_har_exported', {
        entryCount: result.entryCount,
        filters: params
      }, 'info');
    }

    return result;
  } catch (error) {
    logger.error('Failed to export network HAR', { error: error.message });
    throw new Error(`Failed to export network HAR: ${error.message}`);
  }
}

/**
 * Export network log as CSV format
 * @param {Object} params - Export parameters
 * @param {string} params.urlPattern - Filter by URL pattern (regex)
 * @param {string} params.method - Filter by HTTP method
 * @param {string} params.type - Filter by resource type
 * @param {Array<string>} params.fields - Fields to include in CSV
 * @returns {Object} - CSV formatted network log
 */
async function handleExportNetworkCSV(params = {}) {
  logger.info('Exporting network log as CSV', params);

  try {
    const result = networkExporter.exportAsCSV({
      urlPattern: params.urlPattern,
      method: params.method,
      type: params.type,
      fields: params.fields
    });

    // Log to audit
    if (typeof auditLogger !== 'undefined') {
      auditLogger.log('network_csv_exported', {
        rowCount: result.rowCount,
        fields: result.fields
      }, 'info');
    }

    return result;
  } catch (error) {
    logger.error('Failed to export network CSV', { error: error.message });
    throw new Error(`Failed to export network CSV: ${error.message}`);
  }
}

/**
 * Save network log to file
 * @param {Object} params - Save parameters
 * @param {string} params.format - Export format ('har', 'csv', 'json')
 * @param {string} params.filename - Filename (auto-generated if not provided)
 * @param {Object} params.filterOptions - Filter options for export
 * @returns {Promise<Object>} - Save result with download info
 */
async function handleSaveNetworkLog(params = {}) {
  logger.info('Saving network log to file', params);

  try {
    const result = await networkExporter.saveNetworkLog({
      format: params.format || 'json',
      filename: params.filename,
      filterOptions: params.filterOptions || {}
    });

    // Log to audit
    if (typeof auditLogger !== 'undefined') {
      auditLogger.log('network_log_saved', {
        filename: result.filename,
        format: result.format,
        size: result.size
      }, 'info');
    }

    return result;
  } catch (error) {
    logger.error('Failed to save network log', { error: error.message });
    throw new Error(`Failed to save network log: ${error.message}`);
  }
}

/**
 * Get network summary statistics
 * @param {Object} params - Summary parameters
 * @param {string} params.urlPattern - Filter by URL pattern
 * @param {string} params.groupBy - Group statistics by field ('method', 'type', 'domain', 'status')
 * @returns {Object} - Network summary statistics
 */
async function handleGetNetworkSummary(params = {}) {
  logger.info('Getting network summary', params);

  try {
    const result = networkExporter.getNetworkSummary({
      urlPattern: params.urlPattern,
      groupBy: params.groupBy
    });

    // Log to audit
    if (typeof auditLogger !== 'undefined') {
      auditLogger.log('network_summary_retrieved', {
        totalRequests: result.summary?.overview?.totalRequests
      }, 'info');
    }

    return result;
  } catch (error) {
    logger.error('Failed to get network summary', { error: error.message });
    throw new Error(`Failed to get network summary: ${error.message}`);
  }
}

// =============================================================================
// Phase 8 OSINT Data Ingestion Command Handlers
// =============================================================================

/**
 * Detect OSINT data on the current page
 * @param {Object} params - Detection parameters
 * @param {Array<string>} params.types - Types to detect (e.g., 'email', 'phone', 'crypto_btc')
 * @param {boolean} params.excludeSensitive - Exclude sensitive data types (default: false)
 * @param {number} params.contextLength - Characters of context to capture (default: 50)
 * @param {boolean} params.highlight - Whether to highlight findings on the page (default: false)
 * @returns {Promise<Object>} - Detection result with findings
 */
async function handleDetectOsint(params = {}) {
  logger.info('Detecting OSINT data on page', params);

  try {
    // Send message to content script to perform detection
    const result = await sendMessageToActiveTab({
      action: 'detect_osint',
      types: params.types,
      excludeSensitive: params.excludeSensitive || false,
      contextLength: params.contextLength || 50,
      highlight: params.highlight || false
    });

    // Log to audit
    if (typeof auditLogger !== 'undefined') {
      auditLogger.log('osint_detection_performed', {
        findingsCount: result?.findings?.length || 0,
        types: params.types
      }, 'info');
    }

    return {
      success: true,
      command: 'detect_osint',
      findings: result?.findings || [],
      summary: result?.summary || {},
      stats: result?.stats || {}
    };
  } catch (error) {
    logger.error('Failed to detect OSINT data', { error: error.message });
    throw new Error(`Failed to detect OSINT data: ${error.message}`);
  }
}

/**
 * Verify a piece of data (email, phone, crypto address, etc.)
 * @param {Object} params - Verification parameters
 * @param {string} params.type - Data type ('email', 'phone', 'crypto', 'ip', 'domain', 'url', 'username')
 * @param {string} params.value - Value to verify
 * @param {Object} params.options - Type-specific verification options
 * @returns {Promise<Object>} - Verification result
 */
async function handleVerifyData(params = {}) {
  const { type, value, options = {} } = params;

  logger.info('Verifying data', { type, valueLength: value?.length });

  if (!type) {
    throw new Error('Data type is required for verification');
  }

  if (!value) {
    throw new Error('Value is required for verification');
  }

  try {
    // Use the DataVerifier class if available
    if (typeof DataVerifier !== 'undefined') {
      const verifier = new DataVerifier({
        logger: logger.child('DataVerifier'),
        strictMode: options.strictMode || false
      });

      const result = await verifier.verify(type, value, options);

      // Log to audit
      if (typeof auditLogger !== 'undefined') {
        auditLogger.log('data_verification_performed', {
          type,
          plausible: result.plausible,
          valid: result.valid
        }, 'info');
      }

      return {
        success: true,
        command: 'verify_data',
        type,
        value,
        ...result
      };
    }

    // Fallback: send to content script
    const result = await sendMessageToActiveTab({
      action: 'verify_data',
      type,
      value,
      options
    });

    return {
      success: true,
      command: 'verify_data',
      ...result
    };
  } catch (error) {
    logger.error('Failed to verify data', { error: error.message, type });
    throw new Error(`Failed to verify data: ${error.message}`);
  }
}

/**
 * Capture provenance for the current page
 * @param {Object} params - Capture parameters
 * @param {string} params.sourceType - Override detected source type
 * @param {string} params.captureMethod - Capture method identifier
 * @param {boolean} params.includeViewport - Include viewport information (default: true)
 * @param {boolean} params.includeUserAgent - Include user agent (default: true)
 * @param {string} params.selector - Optional element selector for element-specific provenance
 * @param {Object} params.additionalMeta - Additional metadata to include
 * @returns {Promise<Object>} - Provenance data
 */
async function handleCaptureProvenance(params = {}) {
  logger.info('Capturing provenance', params);

  try {
    // Send message to content script to capture provenance
    const result = await sendMessageToActiveTab({
      action: 'capture_provenance',
      sourceType: params.sourceType,
      captureMethod: params.captureMethod || 'background_command',
      includeViewport: params.includeViewport !== false,
      includeUserAgent: params.includeUserAgent !== false,
      selector: params.selector,
      additionalMeta: params.additionalMeta || {}
    });

    // Log to audit
    if (typeof auditLogger !== 'undefined') {
      auditLogger.log('provenance_captured', {
        sourceType: result?.provenance?.source_type,
        sourceUrl: result?.provenance?.source_url
      }, 'info');
    }

    return {
      success: true,
      command: 'capture_provenance',
      provenance: result?.provenance || {}
    };
  } catch (error) {
    logger.error('Failed to capture provenance', { error: error.message });
    throw new Error(`Failed to capture provenance: ${error.message}`);
  }
}

/**
 * Start element picker mode for manual OSINT data selection
 * @param {Object} params - Picker parameters
 * @param {boolean} params.multiSelect - Allow multiple selections (default: true)
 * @param {boolean} params.autoDetect - Auto-detect OSINT data in selected elements (default: true)
 * @returns {Promise<Object>} - Picker started result (actual selections come via callback/message)
 */
async function handleStartElementPicker(params = {}) {
  logger.info('Starting element picker', params);

  try {
    // Send message to content script to start element picker
    const result = await sendMessageToActiveTab({
      action: 'start_element_picker',
      multiSelect: params.multiSelect !== false,
      autoDetect: params.autoDetect !== false
    });

    // Log to audit
    if (typeof auditLogger !== 'undefined') {
      auditLogger.log('element_picker_started', {
        multiSelect: params.multiSelect !== false
      }, 'info');
    }

    return {
      success: true,
      command: 'start_element_picker',
      started: result?.started || true,
      message: 'Element picker mode activated. Click on elements to select OSINT data.'
    };
  } catch (error) {
    logger.error('Failed to start element picker', { error: error.message });
    throw new Error(`Failed to start element picker: ${error.message}`);
  }
}

/**
 * Ingest selected OSINT data to basset-hound backend
 * @param {Object} params - Ingestion parameters
 * @param {Array<Object>} params.items - Items to ingest (each with type, value, metadata)
 * @param {Object} params.provenance - Provenance data for all items (or per-item in items)
 * @param {boolean} params.verify - Verify items before ingestion (default: true)
 * @param {boolean} params.skipDuplicates - Skip items that already exist (default: true)
 * @returns {Promise<Object>} - Ingestion result
 */
async function handleIngestData(params = {}) {
  const { items, provenance, verify = true, skipDuplicates = true } = params;

  logger.info('Ingesting OSINT data', { itemCount: items?.length });

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('Items array is required and must not be empty');
  }

  try {
    const results = {
      success: true,
      command: 'ingest_data',
      ingested: [],
      failed: [],
      skipped: [],
      total: items.length
    };

    // Get verifier instance if verification is enabled
    let verifier = null;
    if (verify && typeof DataVerifier !== 'undefined') {
      verifier = new DataVerifier({
        logger: logger.child('DataVerifier')
      });
    }

    // Get basset-hound sync instance
    const sync = typeof getBassetHoundSync !== 'undefined' ? getBassetHoundSync() : null;

    for (const item of items) {
      try {
        // Validate item structure
        if (!item.type || !item.value) {
          results.failed.push({
            item,
            error: 'Item must have type and value'
          });
          continue;
        }

        // Verify if enabled
        if (verifier) {
          const verifyResult = await verifier.verify(item.type, item.value);
          if (!verifyResult.plausible) {
            results.failed.push({
              item,
              error: 'Verification failed',
              verificationResult: verifyResult
            });
            continue;
          }
          item.verification = verifyResult;
        }

        // Create entity for ingestion
        const entityData = {
          id: `orphan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'orphan',
          data: {
            identifier_type: item.type,
            identifier_value: item.value,
            metadata: item.metadata || {},
            provenance: item.provenance || provenance || {}
          }
        };

        // Sync to basset-hound if available
        if (sync && sync.isConnected()) {
          const syncResult = await sync.syncEntity(entityData);
          if (syncResult.success) {
            results.ingested.push({
              item,
              entityId: entityData.id,
              synced: true
            });
          } else if (syncResult.queued) {
            results.ingested.push({
              item,
              entityId: entityData.id,
              synced: false,
              queued: true
            });
          } else {
            results.failed.push({
              item,
              error: syncResult.error || 'Sync failed'
            });
          }
        } else {
          // Store locally using entity manager
          if (typeof createEntity !== 'undefined') {
            const createResult = createEntity('orphan', entityData.data);
            if (createResult.success) {
              results.ingested.push({
                item,
                entityId: createResult.entity.id,
                synced: false,
                storedLocally: true
              });
            } else {
              results.failed.push({
                item,
                error: createResult.errors?.map(e => e.message).join('; ') || 'Create failed'
              });
            }
          } else {
            // No storage available, mark as ingested but not persisted
            results.ingested.push({
              item,
              entityId: entityData.id,
              synced: false,
              storedLocally: false,
              warning: 'No storage backend available'
            });
          }
        }
      } catch (itemError) {
        results.failed.push({
          item,
          error: itemError.message
        });
      }
    }

    // Log to audit
    if (typeof auditLogger !== 'undefined') {
      auditLogger.log('osint_data_ingested', {
        total: results.total,
        ingested: results.ingested.length,
        failed: results.failed.length,
        skipped: results.skipped.length
      }, 'info');
    }

    results.success = results.failed.length === 0;

    return results;
  } catch (error) {
    logger.error('Failed to ingest OSINT data', { error: error.message });
    throw new Error(`Failed to ingest OSINT data: ${error.message}`);
  }
}

// =============================================================================
// Phase 14 Evidence Session Management Command Handlers
// =============================================================================

/**
 * Start a new evidence session
 * Phase 14: Multi-page evidence collection with chain of custody
 * @param {Object} params - Session parameters
 * @param {string} params.name - Session name
 * @param {string} params.caseId - Case ID
 * @param {string} params.investigator - Investigator ID/name
 * @param {string} params.description - Session description
 * @param {Array<string>} params.tags - Session tags
 * @param {string} params.classification - Data classification level
 * @param {number} params.sizeLimitBytes - Session size limit
 * @returns {Promise<Object>} Created session result
 */
async function handleStartEvidenceSession(params = {}) {
  const {
    name = 'New Evidence Session',
    caseId = null,
    investigator = null,
    description = '',
    tags = [],
    classification = 'unclassified',
    sizeLimitBytes = null
  } = params;

  logger.info('Starting evidence session', { name, caseId, investigator });

  try {
    // Get session manager instance
    const sessionManager = typeof getSessionManager !== 'undefined' ? getSessionManager() : null;

    if (!sessionManager) {
      throw new Error('SessionManager not available. Ensure Phase 14 evidence modules are loaded.');
    }

    // Create session with metadata
    const result = await sessionManager.createSession(name, {
      caseId,
      investigator,
      description,
      tags,
      classification,
      sizeLimitBytes
    });

    // Log to audit
    if (typeof auditLogger !== 'undefined') {
      auditLogger.log('evidence_session_started', {
        sessionId: result.sessionId,
        name,
        caseId,
        investigator
      }, 'info');
    }

    return {
      success: result.success,
      command: 'start_evidence_session',
      session: {
        id: result.sessionId,
        name: result.name,
        caseId: result.caseId,
        status: result.status,
        createdAt: result.timestamp
      },
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('Failed to start evidence session', { error: error.message });
    throw new Error(`Failed to start evidence session: ${error.message}`);
  }
}

/**
 * Get evidence session details
 * Phase 14: Retrieve session information
 * @param {Object} params - Query parameters
 * @param {string} params.sessionId - Session ID (optional, gets active if not provided)
 * @returns {Promise<Object>} Session details
 */
async function handleGetEvidenceSession(params = {}) {
  const { sessionId = null } = params;

  logger.info('Getting evidence session', { sessionId });

  try {
    // Get session manager instance
    const sessionManager = typeof getSessionManager !== 'undefined' ? getSessionManager() : null;

    if (!sessionManager) {
      throw new Error('SessionManager not available. Ensure Phase 14 evidence modules are loaded.');
    }

    let session;
    if (sessionId) {
      session = await sessionManager.getSession(sessionId);
    } else {
      session = await sessionManager.getActiveSession();
    }

    if (!session) {
      return {
        success: false,
        command: 'get_evidence_session',
        error: sessionId ? 'Session not found' : 'No active session',
        timestamp: Date.now()
      };
    }

    return {
      success: true,
      command: 'get_evidence_session',
      session: {
        id: session.id,
        name: session.name,
        caseId: session.caseId,
        status: session.status,
        metadata: session.metadata,
        statistics: session.statistics,
        createdAt: session.createdAt,
        modifiedAt: session.modifiedAt,
        closedAt: session.closedAt,
        sizeBytes: session.currentSizeBytes,
        evidenceCount: session.statistics.totalEvidence
      },
      isActive: session.id === sessionManager.activeSessionId,
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('Failed to get evidence session', { error: error.message });
    throw new Error(`Failed to get evidence session: ${error.message}`);
  }
}

/**
 * Add evidence to session
 * Phase 14: Add evidence item to active or specified session
 * @param {Object} params - Add parameters
 * @param {string} params.sessionId - Session ID (optional, uses active session)
 * @param {Object} params.evidence - Evidence item to add
 * @returns {Promise<Object>} Add result
 */
async function handleAddToSession(params = {}) {
  const { sessionId = null, evidence = null } = params;

  logger.info('Adding evidence to session', { sessionId, evidenceType: evidence?.type });

  if (!evidence) {
    throw new Error('evidence parameter is required');
  }

  try {
    // Get session manager instance
    const sessionManager = typeof getSessionManager !== 'undefined' ? getSessionManager() : null;

    if (!sessionManager) {
      throw new Error('SessionManager not available. Ensure Phase 14 evidence modules are loaded.');
    }

    // Add evidence to session
    const result = await sessionManager.addEvidence(sessionId, evidence);

    // Log to audit
    if (typeof auditLogger !== 'undefined' && result.success) {
      auditLogger.log('evidence_added_to_session', {
        sessionId: result.sessionId || sessionId,
        evidenceId: result.evidenceId,
        evidenceType: evidence.type,
        sequenceNumber: result.sequenceNumber
      }, 'info');
    }

    return {
      success: result.success,
      command: 'add_to_session',
      evidenceId: result.evidenceId,
      sessionId: result.sessionId,
      sequenceNumber: result.sequenceNumber,
      currentSize: result.currentSize,
      error: result.error || null,
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('Failed to add evidence to session', { error: error.message });
    throw new Error(`Failed to add evidence to session: ${error.message}`);
  }
}

/**
 * Close evidence session
 * Phase 14: Finalize and optionally export session
 * @param {Object} params - Close parameters
 * @param {string} params.sessionId - Session ID to close
 * @param {string} params.summary - Session summary
 * @param {Object} params.conclusions - Session conclusions
 * @param {boolean} params.export - Whether to export on close
 * @param {string} params.exportFormat - Export format ('json' or 'pdf')
 * @param {boolean} params.includeData - Include evidence data in export
 * @returns {Promise<Object>} Close result with optional export
 */
async function handleCloseEvidenceSession(params = {}) {
  const {
    sessionId = null,
    summary = null,
    conclusions = null,
    export: shouldExport = false,
    exportFormat = 'json',
    includeData = true
  } = params;

  logger.info('Closing evidence session', { sessionId, export: shouldExport });

  if (!sessionId) {
    throw new Error('sessionId is required');
  }

  try {
    // Get session manager instance
    const sessionManager = typeof getSessionManager !== 'undefined' ? getSessionManager() : null;

    if (!sessionManager) {
      throw new Error('SessionManager not available. Ensure Phase 14 evidence modules are loaded.');
    }

    // Close the session
    const closeResult = await sessionManager.closeSession(sessionId, {
      summary,
      conclusions
    });

    if (!closeResult.success) {
      return {
        success: false,
        command: 'close_evidence_session',
        error: closeResult.error,
        timestamp: Date.now()
      };
    }

    // Export if requested
    let exportResult = null;
    if (shouldExport) {
      exportResult = await sessionManager.exportSession(sessionId, {
        format: exportFormat,
        includeData
      });
    }

    // Log to audit
    if (typeof auditLogger !== 'undefined') {
      auditLogger.log('evidence_session_closed', {
        sessionId,
        exported: shouldExport,
        evidenceCount: closeResult.statistics?.totalEvidence
      }, 'info');
    }

    return {
      success: true,
      command: 'close_evidence_session',
      sessionId: closeResult.sessionId,
      status: closeResult.status,
      closedAt: closeResult.closedAt,
      statistics: closeResult.statistics,
      export: exportResult ? {
        success: exportResult.success,
        format: exportFormat,
        filename: exportResult.filename,
        exportHash: exportResult.exportHash,
        error: exportResult.error || null
      } : null,
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('Failed to close evidence session', { error: error.message });
    throw new Error(`Failed to close evidence session: ${error.message}`);
  }
}

/**
 * List evidence sessions
 * Phase 14: Query and list sessions with filters
 * @param {Object} params - Filter parameters
 * @param {string} params.status - Filter by status ('active', 'paused', 'closed', 'exported')
 * @param {string} params.caseId - Filter by case ID
 * @param {string} params.investigator - Filter by investigator
 * @param {number} params.since - Filter by creation time (after timestamp)
 * @param {number} params.until - Filter by creation time (before timestamp)
 * @param {number} params.limit - Max sessions to return
 * @param {number} params.offset - Sessions to skip (pagination)
 * @returns {Promise<Object>} Sessions list with pagination
 */
async function handleListEvidenceSessions(params = {}) {
  const {
    status = null,
    caseId = null,
    investigator = null,
    since = 0,
    until = Date.now(),
    limit = 50,
    offset = 0
  } = params;

  logger.info('Listing evidence sessions', { status, caseId, limit, offset });

  try {
    // Get session manager instance
    const sessionManager = typeof getSessionManager !== 'undefined' ? getSessionManager() : null;

    if (!sessionManager) {
      throw new Error('SessionManager not available. Ensure Phase 14 evidence modules are loaded.');
    }

    // List sessions with filters
    const result = await sessionManager.listSessions({
      status,
      caseId,
      investigator,
      since,
      until,
      limit,
      offset
    });

    return {
      success: result.success,
      command: 'list_evidence_sessions',
      sessions: result.sessions,
      pagination: result.pagination,
      activeSessionId: result.activeSessionId,
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('Failed to list evidence sessions', { error: error.message });
    throw new Error(`Failed to list evidence sessions: ${error.message}`);
  }
}

/**
 * Export evidence session
 * Phase 14: Export session to JSON or PDF format
 * @param {Object} params - Export parameters
 * @param {string} params.sessionId - Session ID to export
 * @param {string} params.format - Export format ('json' or 'pdf')
 * @param {boolean} params.includeData - Include evidence data
 * @param {boolean} params.includeCustody - Include chain of custody records
 * @returns {Promise<Object>} Export result with bundle
 */
async function handleExportEvidenceSession(params = {}) {
  const {
    sessionId = null,
    format = 'json',
    includeData = true,
    includeCustody = true
  } = params;

  logger.info('Exporting evidence session', { sessionId, format });

  if (!sessionId) {
    throw new Error('sessionId is required');
  }

  try {
    // Get session manager instance
    const sessionManager = typeof getSessionManager !== 'undefined' ? getSessionManager() : null;

    if (!sessionManager) {
      throw new Error('SessionManager not available. Ensure Phase 14 evidence modules are loaded.');
    }

    // Export session
    const result = await sessionManager.exportSession(sessionId, {
      format,
      includeData,
      includeChainOfCustody: includeCustody
    });

    if (!result.success) {
      return {
        success: false,
        command: 'export_evidence_session',
        error: result.error,
        timestamp: Date.now()
      };
    }

    // Log to audit
    if (typeof auditLogger !== 'undefined') {
      auditLogger.log('evidence_session_exported', {
        sessionId,
        format,
        exportHash: result.exportHash
      }, 'info');
    }

    return {
      success: true,
      command: 'export_evidence_session',
      sessionId: result.sessionId,
      format,
      bundle: result.bundle || result.reportStructure,
      exportHash: result.exportHash,
      filename: result.filename,
      mimeType: result.mimeType,
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('Failed to export evidence session', { error: error.message });
    throw new Error(`Failed to export evidence session: ${error.message}`);
  }
}

/**
 * Toggle session panel in content script
 * Phase 14: Show/hide session management panel overlay
 * @param {Object} params - Toggle parameters (currently unused)
 * @returns {Promise<Object>} Toggle result
 */
async function handleToggleSessionPanel(params = {}) {
  logger.info('Toggling session panel');

  try {
    // Send message to active tab's content script
    const result = await sendMessageToActiveTab({
      action: 'toggle_session_panel',
      params: {}
    });

    return {
      success: true,
      command: 'toggle_session_panel',
      panelState: result?.panelState || 'unknown',
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('Failed to toggle session panel', { error: error.message });
    // Don't throw - panel might not be implemented yet
    return {
      success: false,
      command: 'toggle_session_panel',
      error: error.message,
      note: 'Session panel may not be implemented in content script yet',
      timestamp: Date.now()
    };
  }
}

/**
 * Capture page forensics data
 * Phase 14: Capture detailed forensic data from current page
 * @param {Object} params - Capture parameters
 * @param {boolean} params.includeDOM - Include DOM snapshot
 * @param {boolean} params.includeStorage - Include local/session storage
 * @param {boolean} params.includeNetwork - Include network activity
 * @param {boolean} params.includeCookies - Include cookies
 * @returns {Promise<Object>} Forensics data
 */
async function handleCapturePageForensics(params = {}) {
  const {
    includeDOM = true,
    includeStorage = true,
    includeNetwork = true,
    includeCookies = true
  } = params;

  logger.info('Capturing page forensics', { includeDOM, includeStorage, includeNetwork, includeCookies });

  try {
    // Send message to active tab's content script to capture page-level forensics
    const result = await sendMessageToActiveTab({
      action: 'capture_page_forensics',
      params: {
        includeDOM,
        includeStorage,
        includeNetwork,
        includeCookies
      }
    });

    // Log to audit
    if (typeof auditLogger !== 'undefined') {
      auditLogger.log('page_forensics_captured', {
        url: result?.url,
        dataTypes: { includeDOM, includeStorage, includeNetwork, includeCookies }
      }, 'info');
    }

    return {
      success: true,
      command: 'capture_page_forensics',
      forensics: result,
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('Failed to capture page forensics', { error: error.message });
    // Don't throw - forensics module might not be implemented yet
    return {
      success: false,
      command: 'capture_page_forensics',
      error: error.message,
      note: 'Page forensics capture may not be implemented in content script yet',
      timestamp: Date.now()
    };
  }
}

/**
 * Capture browser snapshot
 * Phase 14: Capture browser-level snapshot (tabs, extensions, etc.)
 * @param {Object} params - Capture parameters
 * @param {boolean} params.includeTabs - Include all open tabs
 * @param {boolean} params.includeExtensions - Include extension info
 * @param {boolean} params.includeBookmarks - Include bookmarks
 * @param {boolean} params.includeHistory - Include recent history
 * @returns {Promise<Object>} Browser snapshot data
 */
async function handleCaptureBrowserSnapshot(params = {}) {
  const {
    includeTabs = true,
    includeExtensions = false,
    includeBookmarks = false,
    includeHistory = false
  } = params;

  logger.info('Capturing browser snapshot', { includeTabs, includeExtensions, includeBookmarks, includeHistory });

  try {
    const snapshot = {
      captureTime: Date.now(),
      captureTimeISO: new Date().toISOString(),
      browser: 'chrome',
      tabs: [],
      extensions: [],
      bookmarks: null,
      history: null
    };

    // Capture tabs if requested
    if (includeTabs) {
      const tabs = await chrome.tabs.query({});
      snapshot.tabs = tabs.map(tab => ({
        id: tab.id,
        url: tab.url,
        title: tab.title,
        active: tab.active,
        windowId: tab.windowId,
        index: tab.index,
        pinned: tab.pinned,
        status: tab.status
      }));
    }

    // Capture extensions if requested (requires management permission)
    if (includeExtensions) {
      try {
        if (chrome.management && chrome.management.getAll) {
          const extensions = await chrome.management.getAll();
          snapshot.extensions = extensions.map(ext => ({
            id: ext.id,
            name: ext.name,
            version: ext.version,
            enabled: ext.enabled,
            type: ext.type
          }));
        }
      } catch (e) {
        logger.warn('Could not capture extensions', { error: e.message });
        snapshot.extensions = { error: 'Permission denied or not available' };
      }
    }

    // Capture bookmarks if requested (requires bookmarks permission)
    if (includeBookmarks) {
      try {
        if (chrome.bookmarks && chrome.bookmarks.getTree) {
          const bookmarkTree = await chrome.bookmarks.getTree();
          snapshot.bookmarks = bookmarkTree;
        }
      } catch (e) {
        logger.warn('Could not capture bookmarks', { error: e.message });
        snapshot.bookmarks = { error: 'Permission denied or not available' };
      }
    }

    // Capture history if requested (requires history permission)
    if (includeHistory) {
      try {
        if (chrome.history && chrome.history.search) {
          const historyItems = await chrome.history.search({
            text: '',
            maxResults: 100,
            startTime: Date.now() - (24 * 60 * 60 * 1000) // Last 24 hours
          });
          snapshot.history = historyItems.map(item => ({
            id: item.id,
            url: item.url,
            title: item.title,
            lastVisitTime: item.lastVisitTime,
            visitCount: item.visitCount
          }));
        }
      } catch (e) {
        logger.warn('Could not capture history', { error: e.message });
        snapshot.history = { error: 'Permission denied or not available' };
      }
    }

    // Log to audit
    if (typeof auditLogger !== 'undefined') {
      auditLogger.log('browser_snapshot_captured', {
        tabCount: snapshot.tabs.length,
        includeExtensions,
        includeBookmarks,
        includeHistory
      }, 'info');
    }

    return {
      success: true,
      command: 'capture_browser_snapshot',
      snapshot,
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('Failed to capture browser snapshot', { error: error.message });
    throw new Error(`Failed to capture browser snapshot: ${error.message}`);
  }
}

// =============================================================================
// Phase 16: Document Scanning Command Handlers (PDF, OCR, Tables)
// =============================================================================

/**
 * Extract text from PDF document
 * @param {Object} params - Command parameters
 * @param {string} params.url - URL of PDF to extract
 * @param {number} params.maxPages - Maximum pages to extract
 * @returns {Promise<Object>} - Extraction results
 */
async function handleExtractPdfText(params = {}) {
  const { url, maxPages, tabId } = params;
  const targetTabId = tabId || (await getActiveTab()).id;

  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: async (extractUrl, options) => {
        // Initialize PDF extractor if not already loaded
        if (typeof PDFExtractor === 'undefined') {
          throw new Error('PDFExtractor not loaded');
        }

        const extractor = new PDFExtractor();
        await extractor.initialize();

        if (extractUrl) {
          // Extract from specific URL
          return await extractor.extractTextFromURL(extractUrl, options);
        } else {
          // Extract from all PDFs on page
          return await extractor.extractFromPage(options);
        }
      },
      args: [url || null, { maxPages: maxPages || 50 }]
    });

    return {
      success: true,
      command: 'extract_pdf_text',
      result: result[0].result
    };
  } catch (error) {
    logger.error('Failed to extract PDF text', { error: error.message });
    throw new Error(`Failed to extract PDF text: ${error.message}`);
  }
}

/**
 * Extract text from images using OCR
 * @param {Object} params - Command parameters
 * @param {string} params.imageUrl - URL of specific image to process
 * @param {number} params.maxImages - Maximum images to process
 * @param {string} params.language - OCR language (default: 'eng')
 * @returns {Promise<Object>} - OCR results
 */
async function handleExtractImageText(params = {}) {
  const { imageUrl, maxImages, language, threshold, tabId } = params;
  const targetTabId = tabId || (await getActiveTab()).id;

  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: async (imgUrl, options) => {
        // Initialize ImageOCR if not already loaded
        if (typeof ImageOCR === 'undefined') {
          throw new Error('ImageOCR not loaded');
        }

        const ocr = new ImageOCR();
        await ocr.initialize();

        if (imgUrl) {
          // Process specific image
          return await ocr.extractText(imgUrl, options);
        } else {
          // Process all detected text images on page
          return await ocr.extractFromPage(options);
        }
      },
      args: [
        imageUrl || null,
        {
          maxImages: maxImages || 10,
          language: language || 'eng',
          threshold: threshold || 0.3
        }
      ]
    });

    return {
      success: true,
      command: 'extract_image_text',
      result: result[0].result
    };
  } catch (error) {
    logger.error('Failed to extract image text', { error: error.message });
    throw new Error(`Failed to extract image text: ${error.message}`);
  }
}

/**
 * Extract and parse tables from page
 * @param {Object} params - Command parameters
 * @param {string} params.selector - CSS selector for specific table
 * @param {number} params.maxTables - Maximum tables to extract
 * @param {number} params.minRows - Minimum rows required
 * @param {boolean} params.analyzeOSINT - Whether to analyze for OSINT data
 * @returns {Promise<Object>} - Parsed table data
 */
async function handleExtractTables(params = {}) {
  const { selector, maxTables, minRows, analyzeOSINT, tabId } = params;
  const targetTabId = tabId || (await getActiveTab()).id;

  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: (tableSelector, options) => {
        // Initialize TableParser if not already loaded
        if (typeof TableParser === 'undefined') {
          throw new Error('TableParser not loaded');
        }

        const parser = new TableParser();

        if (tableSelector) {
          // Parse specific table
          const table = document.querySelector(tableSelector);
          if (!table) {
            throw new Error(`Table not found: ${tableSelector}`);
          }
          return parser.parseHTMLTable(table, options);
        } else {
          // Parse all tables on page
          return parser.parsePageTables(options);
        }
      },
      args: [
        selector || null,
        {
          maxTables: maxTables || Infinity,
          minRows: minRows || 0,
          analyzeOSINT: analyzeOSINT !== false,
          detectTypes: true
        }
      ]
    });

    return {
      success: true,
      command: 'extract_tables',
      result: result[0].result
    };
  } catch (error) {
    logger.error('Failed to extract tables', { error: error.message });
    throw new Error(`Failed to extract tables: ${error.message}`);
  }
}

/**
 * Detect embedded PDFs on page
 * @param {Object} params - Command parameters
 * @returns {Promise<Object>} - Detected PDFs
 */
async function handleDetectPdfs(params = {}) {
  const { tabId } = params;
  const targetTabId = tabId || (await getActiveTab()).id;

  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: () => {
        if (typeof PDFExtractor === 'undefined') {
          throw new Error('PDFExtractor not loaded');
        }

        const extractor = new PDFExtractor();
        const detected = extractor.detectEmbeddedPDFs();

        return {
          success: true,
          pdfs: detected,
          count: detected.length
        };
      }
    });

    return {
      success: true,
      command: 'detect_pdfs',
      result: result[0].result
    };
  } catch (error) {
    logger.error('Failed to detect PDFs', { error: error.message });
    throw new Error(`Failed to detect PDFs: ${error.message}`);
  }
}

/**
 * Detect images likely to contain text
 * @param {Object} params - Command parameters
 * @param {number} params.threshold - Text likelihood threshold
 * @returns {Promise<Object>} - Detected text images
 */
async function handleDetectTextImages(params = {}) {
  const { threshold, tabId } = params;
  const targetTabId = tabId || (await getActiveTab()).id;

  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: (minThreshold) => {
        if (typeof ImageOCR === 'undefined') {
          throw new Error('ImageOCR not loaded');
        }

        const ocr = new ImageOCR();
        const detected = ocr.detectTextImages({ threshold: minThreshold });

        return {
          success: true,
          images: detected,
          count: detected.length
        };
      },
      args: [threshold || 0.3]
    });

    return {
      success: true,
      command: 'detect_text_images',
      result: result[0].result
    };
  } catch (error) {
    logger.error('Failed to detect text images', { error: error.message });
    throw new Error(`Failed to detect text images: ${error.message}`);
  }
}

/**
 * Search for text in PDF
 * @param {Object} params - Command parameters
 * @param {string} params.url - PDF URL
 * @param {string} params.searchText - Text to search for
 * @param {boolean} params.caseSensitive - Case sensitive search
 * @returns {Promise<Object>} - Search results
 */
async function handleSearchInPdf(params = {}) {
  const { url, searchText, caseSensitive, tabId } = params;

  if (!url || !searchText) {
    throw new Error('URL and searchText parameters are required');
  }

  const targetTabId = tabId || (await getActiveTab()).id;

  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: async (pdfUrl, search, options) => {
        if (typeof PDFExtractor === 'undefined') {
          throw new Error('PDFExtractor not loaded');
        }

        const extractor = new PDFExtractor();
        await extractor.initialize();

        return await extractor.searchInPDF(pdfUrl, search, options);
      },
      args: [url, searchText, { caseSensitive: caseSensitive || false }]
    });

    return {
      success: true,
      command: 'search_in_pdf',
      result: result[0].result
    };
  } catch (error) {
    logger.error('Failed to search in PDF', { error: error.message });
    throw new Error(`Failed to search in PDF: ${error.message}`);
  }
}

/**
 * Export extraction results to various formats
 * @param {Object} params - Command parameters
 * @param {Object} params.data - Extraction data to export
 * @param {string} params.format - Export format (json, csv, txt, etc.)
 * @param {string} params.type - Extraction type (pdf, ocr, table)
 * @returns {Promise<Object>} - Export results
 */
async function handleExportExtraction(params = {}) {
  const { data, format, type } = params;

  if (!data) {
    throw new Error('Data parameter is required');
  }

  try {
    let exported;
    const exportFormat = format || 'json';

    // Export based on extraction type
    switch (type) {
      case 'pdf':
        if (typeof PDFExtractor !== 'undefined') {
          const extractor = new PDFExtractor();
          exported = extractor.exportResults(data, exportFormat);
        } else {
          exported = JSON.stringify(data, null, 2);
        }
        break;

      case 'ocr':
        if (typeof ImageOCR !== 'undefined') {
          const ocr = new ImageOCR();
          exported = ocr.exportResults(data, exportFormat);
        } else {
          exported = JSON.stringify(data, null, 2);
        }
        break;

      case 'table':
        if (typeof TableParser !== 'undefined') {
          const parser = new TableParser();
          exported = parser.exportTable(data, exportFormat);
        } else {
          exported = JSON.stringify(data, null, 2);
        }
        break;

      default:
        exported = JSON.stringify(data, null, 2);
    }

    return {
      success: true,
      command: 'export_extraction',
      format: exportFormat,
      type: type,
      data: exported
    };
  } catch (error) {
    logger.error('Failed to export extraction', { error: error.message });
    throw new Error(`Failed to export extraction: ${error.message}`);
  }
}

// =============================================================================
// Phase 17: Workflow Automation Command Handlers
// =============================================================================

// Initialize workflow system
let workflowManager = null;
let workflowExecutor = null;

try {
  workflowManager = new WorkflowManager();
  workflowExecutor = new WorkflowExecutor();
  logger.info('Workflow automation system initialized');
} catch (error) {
  logger.error('Failed to initialize workflow system', { error: error.message });
}

/**
 * Create a new workflow
 * @param {Object} params - Workflow definition
 * @returns {Promise<Object>} Created workflow
 */
async function handleCreateWorkflow(params = {}) {
  logger.info('Creating workflow', { name: params.name });

  if (!workflowManager) {
    throw new Error('WorkflowManager not available');
  }

  try {
    const workflow = await workflowManager.createWorkflow(params);

    if (typeof auditLogger !== 'undefined') {
      auditLogger.log('workflow_created', {
        workflowId: workflow.id,
        name: workflow.name,
        category: workflow.category
      }, 'info');
    }

    return {
      success: true,
      command: 'create_workflow',
      workflow: {
        id: workflow.id,
        name: workflow.name,
        version: workflow.version,
        createdAt: workflow.createdAt
      },
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('Failed to create workflow', { error: error.message });
    throw new Error(`Failed to create workflow: ${error.message}`);
  }
}

/**
 * Get a workflow by ID
 * @param {Object} params - { workflowId }
 * @returns {Promise<Object>} Workflow definition
 */
async function handleGetWorkflow(params = {}) {
  const { workflowId } = params;

  if (!workflowId) {
    throw new Error('workflowId parameter is required');
  }

  logger.info('Getting workflow', { workflowId });

  if (!workflowManager) {
    throw new Error('WorkflowManager not available');
  }

  try {
    const workflow = await workflowManager.getWorkflow(workflowId);

    if (!workflow) {
      return {
        success: false,
        command: 'get_workflow',
        error: 'Workflow not found',
        timestamp: Date.now()
      };
    }

    return {
      success: true,
      command: 'get_workflow',
      workflow,
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('Failed to get workflow', { error: error.message });
    throw new Error(`Failed to get workflow: ${error.message}`);
  }
}

/**
 * Update an existing workflow
 * @param {Object} params - { workflowId, ...updates }
 * @returns {Promise<Object>} Updated workflow
 */
async function handleUpdateWorkflow(params = {}) {
  const { workflowId, ...updates } = params;

  if (!workflowId) {
    throw new Error('workflowId parameter is required');
  }

  logger.info('Updating workflow', { workflowId });

  if (!workflowManager) {
    throw new Error('WorkflowManager not available');
  }

  try {
    const workflow = await workflowManager.updateWorkflow(workflowId, updates);

    if (typeof auditLogger !== 'undefined') {
      auditLogger.log('workflow_updated', {
        workflowId: workflow.id,
        name: workflow.name
      }, 'info');
    }

    return {
      success: true,
      command: 'update_workflow',
      workflow: {
        id: workflow.id,
        name: workflow.name,
        version: workflow.version,
        updatedAt: workflow.updatedAt
      },
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('Failed to update workflow', { error: error.message });
    throw new Error(`Failed to update workflow: ${error.message}`);
  }
}

/**
 * Delete a workflow
 * @param {Object} params - { workflowId }
 * @returns {Promise<Object>} Deletion result
 */
async function handleDeleteWorkflow(params = {}) {
  const { workflowId } = params;

  if (!workflowId) {
    throw new Error('workflowId parameter is required');
  }

  logger.info('Deleting workflow', { workflowId });

  if (!workflowManager) {
    throw new Error('WorkflowManager not available');
  }

  try {
    await workflowManager.deleteWorkflow(workflowId);

    if (typeof auditLogger !== 'undefined') {
      auditLogger.log('workflow_deleted', { workflowId }, 'info');
    }

    return {
      success: true,
      command: 'delete_workflow',
      workflowId,
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('Failed to delete workflow', { error: error.message });
    throw new Error(`Failed to delete workflow: ${error.message}`);
  }
}

/**
 * List all workflows
 * @param {Object} params - Filter and sort options
 * @returns {Promise<Object>} List of workflows
 */
async function handleListWorkflows(params = {}) {
  logger.info('Listing workflows', params);

  if (!workflowManager) {
    throw new Error('WorkflowManager not available');
  }

  try {
    const workflows = await workflowManager.listWorkflows(params);

    return {
      success: true,
      command: 'list_workflows',
      workflows: workflows.map(w => ({
        id: w.id,
        name: w.name,
        description: w.description,
        category: w.category,
        tags: w.tags,
        version: w.version,
        stepCount: w.steps?.length || 0,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt
      })),
      count: workflows.length,
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('Failed to list workflows', { error: error.message });
    throw new Error(`Failed to list workflows: ${error.message}`);
  }
}

/**
 * Execute a workflow
 * @param {Object} params - { workflowId, inputs, tabId }
 * @returns {Promise<Object>} Execution result
 */
async function handleExecuteWorkflow(params = {}) {
  const { workflowId, inputs = {}, tabId } = params;

  if (!workflowId) {
    throw new Error('workflowId parameter is required');
  }

  logger.info('Executing workflow', { workflowId, inputs });

  if (!workflowManager || !workflowExecutor) {
    throw new Error('Workflow system not available');
  }

  try {
    // Get workflow definition
    const workflow = await workflowManager.getWorkflow(workflowId);

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Execute workflow
    const result = await workflowExecutor.execute(workflow, inputs, { tabId });

    if (typeof auditLogger !== 'undefined') {
      auditLogger.log('workflow_executed', {
        workflowId: workflow.id,
        executionId: result.executionId,
        success: result.success
      }, result.success ? 'info' : 'error');
    }

    return {
      success: result.success,
      command: 'execute_workflow',
      executionId: result.executionId,
      outputs: result.outputs || {},
      evidence: result.evidence || [],
      duration: result.duration,
      error: result.error || null,
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('Failed to execute workflow', { error: error.message });
    throw new Error(`Failed to execute workflow: ${error.message}`);
  }
}

/**
 * Pause a running workflow
 * @param {Object} params - { executionId }
 * @returns {Promise<Object>} Pause result
 */
async function handlePauseWorkflow(params = {}) {
  const { executionId } = params;

  if (!executionId) {
    throw new Error('executionId parameter is required');
  }

  logger.info('Pausing workflow', { executionId });

  if (!workflowExecutor) {
    throw new Error('WorkflowExecutor not available');
  }

  try {
    await workflowExecutor.pauseWorkflow(executionId);

    return {
      success: true,
      command: 'pause_workflow',
      executionId,
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('Failed to pause workflow', { error: error.message });
    throw new Error(`Failed to pause workflow: ${error.message}`);
  }
}

/**
 * Resume a paused workflow
 * @param {Object} params - { executionId }
 * @returns {Promise<Object>} Resume result
 */
async function handleResumeWorkflow(params = {}) {
  const { executionId } = params;

  if (!executionId) {
    throw new Error('executionId parameter is required');
  }

  logger.info('Resuming workflow', { executionId });

  if (!workflowExecutor) {
    throw new Error('WorkflowExecutor not available');
  }

  try {
    await workflowExecutor.resumeWorkflow(executionId);

    return {
      success: true,
      command: 'resume_workflow',
      executionId,
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('Failed to resume workflow', { error: error.message });
    throw new Error(`Failed to resume workflow: ${error.message}`);
  }
}

/**
 * Cancel a running workflow
 * @param {Object} params - { executionId, reason }
 * @returns {Promise<Object>} Cancel result
 */
async function handleCancelWorkflow(params = {}) {
  const { executionId, reason } = params;

  if (!executionId) {
    throw new Error('executionId parameter is required');
  }

  logger.info('Cancelling workflow', { executionId, reason });

  if (!workflowExecutor) {
    throw new Error('WorkflowExecutor not available');
  }

  try {
    await workflowExecutor.cancelWorkflow(executionId, reason);

    if (typeof auditLogger !== 'undefined') {
      auditLogger.log('workflow_cancelled', {
        executionId,
        reason: reason || 'User cancelled'
      }, 'warn');
    }

    return {
      success: true,
      command: 'cancel_workflow',
      executionId,
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('Failed to cancel workflow', { error: error.message });
    throw new Error(`Failed to cancel workflow: ${error.message}`);
  }
}

/**
 * Get workflow execution status
 * @param {Object} params - { executionId }
 * @returns {Promise<Object>} Execution status
 */
async function handleGetWorkflowStatus(params = {}) {
  const { executionId } = params;

  if (!executionId) {
    throw new Error('executionId parameter is required');
  }

  logger.info('Getting workflow status', { executionId });

  if (!workflowExecutor) {
    throw new Error('WorkflowExecutor not available');
  }

  try {
    const status = await workflowExecutor.getWorkflowStatus(executionId);

    return {
      success: true,
      command: 'get_workflow_status',
      status,
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('Failed to get workflow status', { error: error.message });
    throw new Error(`Failed to get workflow status: ${error.message}`);
  }
}

/**
 * List workflow executions
 * @param {Object} params - Filter options
 * @returns {Promise<Object>} List of executions
 */
async function handleListExecutions(params = {}) {
  logger.info('Listing workflow executions', params);

  if (!workflowExecutor) {
    throw new Error('WorkflowExecutor not available');
  }

  try {
    const executions = await workflowExecutor.listExecutions(params);

    return {
      success: true,
      command: 'list_executions',
      executions,
      count: executions.length,
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('Failed to list executions', { error: error.message });
    throw new Error(`Failed to list executions: ${error.message}`);
  }
}

// =============================================================================
// Initialization
// =============================================================================

// Log that background script has loaded
logger.info('Background service worker initialized');

// Attempt initial connection
connectWebSocket();

// =============================================================================
// Collaboration Command Handlers (Phase 18.1)
// =============================================================================

/**
 * Handle collaboration-related commands
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  // Collaboration commands
  if (message.type.startsWith('collab_') || message.type === 'get_team_members' || 
      message.type === 'get_comments' || message.type === 'get_assignments' || 
      message.type === 'get_share_links') {
    
    handleCollaborationCommand(message).then(sendResponse);
    return true; // Keep channel open for async response
  }
});

/**
 * Handle collaboration command
 * @param {Object} message - Command message
 * @returns {Promise<Object>} Command result
 */
async function handleCollaborationCommand(message) {
  const { type } = message;

  try {
    switch (type) {
      case 'collab_init':
        return await initializeCollaboration(message.sessionId, message.options || {});

      case 'get_team_members':
        return await getTeamMembers(message.sessionId);

      case 'collab_invite_member':
        return await inviteTeamMember(message.sessionId, message.email, message.role);

      case 'get_comments':
        return await getSessionComments(message.sessionId);

      case 'collab_add_comment':
        return await addComment(message.sessionId, message.content, message.options);

      case 'get_assignments':
        return await getSessionAssignments(message.sessionId);

      case 'collab_create_assignment':
        return await createAssignment(message.assignmentData);

      case 'get_share_links':
        return await getShareLinks(message.sessionId);

      case 'collab_create_share_link':
        return await createShareLink(message.sessionId, message.options);

      default:
        return {
          success: false,
          error: 'Unknown collaboration command: ' + type
        };
    }
  } catch (error) {
    console.error('[Background] Collaboration command error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

console.log('[Background] Collaboration command handlers loaded');
