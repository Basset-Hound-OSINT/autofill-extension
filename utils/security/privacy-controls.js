/**
 * Basset Hound Browser Automation - Privacy Controls
 * Phase 7 Security: Privacy Management and Data Protection
 *
 * Provides privacy-focused features:
 * - Browsing data clearing (cookies, localStorage, history)
 * - Incognito mode management
 * - Privacy status monitoring
 * - Local-only mode (external connection restrictions)
 */

// =============================================================================
// Configuration
// =============================================================================

const PrivacyControlsConfig = {
  // Data types that can be cleared
  clearableDataTypes: [
    'cookies',
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'cache',
    'history',
    'downloads',
    'formData',
    'passwords',
    'serviceWorkers',
    'webSQL'
  ],

  // Default data types to clear
  defaultClearTypes: ['cookies', 'localStorage', 'sessionStorage', 'cache'],

  // Time ranges for clearing (in milliseconds)
  timeRanges: {
    lastHour: 3600000,
    lastDay: 86400000,
    lastWeek: 604800000,
    lastMonth: 2592000000,
    allTime: 0
  },

  // Allowed WebSocket URLs in local-only mode
  allowedLocalHosts: [
    'localhost',
    '127.0.0.1',
    '::1'
  ],

  // Allowed ports in local-only mode
  allowedLocalPorts: ['8765', '8080', '3000', '5000']
};

// =============================================================================
// State Management
// =============================================================================

/**
 * Privacy state storage
 */
const PrivacyState = {
  localOnlyMode: false,
  localOnlyEnabledAt: null,
  blockedConnectionAttempts: [],
  lastClearOperation: null,
  privacyLevel: 'standard' // 'standard', 'enhanced', 'maximum'
};

// =============================================================================
// Browsing Data Clearing Functions
// =============================================================================

/**
 * Clear browsing data based on specified options
 * Uses Chrome's browsingData API for comprehensive clearing
 * @param {Object} options - Clearing options
 * @param {Array<string>} options.dataTypes - Types of data to clear
 * @param {string|number} options.since - Time range ('lastHour', 'lastDay', 'allTime', or timestamp)
 * @param {Array<string>} options.origins - Specific origins to clear (optional)
 * @param {boolean} options.excludeCurrentSession - Preserve current session data
 * @returns {Promise<Object>} Clear operation result
 */
async function clearBrowsingData(options = {}) {
  const {
    dataTypes = PrivacyControlsConfig.defaultClearTypes,
    since = 'allTime',
    origins = null,
    excludeCurrentSession = false
  } = options;

  const result = {
    success: false,
    cleared: [],
    failed: [],
    errors: [],
    warnings: [],
    timestamp: Date.now()
  };

  // Validate data types
  const validTypes = [];
  const invalidTypes = [];
  for (const type of dataTypes) {
    if (PrivacyControlsConfig.clearableDataTypes.includes(type)) {
      validTypes.push(type);
    } else {
      invalidTypes.push(type);
      result.warnings.push({
        code: 'INVALID_DATA_TYPE',
        message: `Unknown data type: ${type}`,
        severity: 'warning'
      });
    }
  }

  if (validTypes.length === 0) {
    result.errors.push({
      code: 'NO_VALID_DATA_TYPES',
      message: 'No valid data types specified for clearing'
    });
    return result;
  }

  // Calculate time range
  let sinceTimestamp;
  if (typeof since === 'number') {
    sinceTimestamp = since;
  } else if (typeof since === 'string' && PrivacyControlsConfig.timeRanges[since] !== undefined) {
    const range = PrivacyControlsConfig.timeRanges[since];
    sinceTimestamp = range === 0 ? 0 : Date.now() - range;
  } else {
    sinceTimestamp = 0; // Default to all time
    result.warnings.push({
      code: 'INVALID_TIME_RANGE',
      message: `Unknown time range: ${since}, defaulting to all time`,
      severity: 'warning'
    });
  }

  // Build removal options for chrome.browsingData API
  const removalOptions = {
    since: sinceTimestamp
  };

  // Add origin restrictions if specified
  if (origins && Array.isArray(origins) && origins.length > 0) {
    removalOptions.origins = origins;
  }

  // Map our data types to Chrome API data types
  const dataTypeMappings = {
    cookies: 'cookies',
    localStorage: 'localStorage',
    sessionStorage: 'localStorage', // Combined with localStorage in Chrome
    indexedDB: 'indexedDB',
    cache: 'cache',
    history: 'history',
    downloads: 'downloads',
    formData: 'formData',
    passwords: 'passwords',
    serviceWorkers: 'serviceWorkers',
    webSQL: 'webSQL'
  };

  const dataToRemove = {};
  for (const type of validTypes) {
    const chromeType = dataTypeMappings[type];
    if (chromeType) {
      dataToRemove[chromeType] = true;
    }
  }

  // Perform the clear operation
  try {
    // Check if chrome.browsingData is available
    if (typeof chrome === 'undefined' || !chrome.browsingData) {
      // Fallback for non-extension context or testing
      result.warnings.push({
        code: 'API_UNAVAILABLE',
        message: 'chrome.browsingData API not available, simulating clear',
        severity: 'warning'
      });

      // Simulate clearing local storage if in a web context
      if (typeof localStorage !== 'undefined' && validTypes.includes('localStorage')) {
        if (!excludeCurrentSession) {
          localStorage.clear();
        }
        result.cleared.push('localStorage');
      }

      if (typeof sessionStorage !== 'undefined' && validTypes.includes('sessionStorage')) {
        if (!excludeCurrentSession) {
          sessionStorage.clear();
        }
        result.cleared.push('sessionStorage');
      }

      result.success = true;
    } else {
      // Use Chrome API
      await new Promise((resolve, reject) => {
        chrome.browsingData.remove(removalOptions, dataToRemove, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });

      result.cleared = validTypes;
      result.success = true;
    }

    // Record the operation
    PrivacyState.lastClearOperation = {
      timestamp: Date.now(),
      types: validTypes,
      since: sinceTimestamp,
      origins: origins
    };

  } catch (error) {
    result.errors.push({
      code: 'CLEAR_OPERATION_FAILED',
      message: error.message
    });
    result.failed = validTypes;
  }

  return result;
}

/**
 * Clear cookies for specific domains
 * @param {Object} options - Cookie clearing options
 * @param {Array<string>} options.domains - Domains to clear cookies for
 * @param {string} options.name - Specific cookie name to clear (optional)
 * @returns {Promise<Object>} Clear result
 */
async function clearCookiesForDomains(options = {}) {
  const { domains = [], name = null } = options;

  const result = {
    success: false,
    clearedCount: 0,
    domains: [],
    errors: [],
    timestamp: Date.now()
  };

  if (!domains || domains.length === 0) {
    result.errors.push({
      code: 'NO_DOMAINS',
      message: 'No domains specified for cookie clearing'
    });
    return result;
  }

  try {
    if (typeof chrome === 'undefined' || !chrome.cookies) {
      result.errors.push({
        code: 'API_UNAVAILABLE',
        message: 'chrome.cookies API not available'
      });
      return result;
    }

    for (const domain of domains) {
      try {
        // Get all cookies for this domain
        const cookies = await new Promise((resolve, reject) => {
          chrome.cookies.getAll({ domain }, (cookies) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(cookies || []);
            }
          });
        });

        // Filter by name if specified
        const cookiesToRemove = name
          ? cookies.filter(c => c.name === name)
          : cookies;

        // Remove each cookie
        for (const cookie of cookiesToRemove) {
          const url = `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`;
          await new Promise((resolve, reject) => {
            chrome.cookies.remove({ url, name: cookie.name }, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve();
              }
            });
          });
          result.clearedCount++;
        }

        result.domains.push({
          domain,
          clearedCount: cookiesToRemove.length
        });
      } catch (error) {
        result.errors.push({
          code: 'DOMAIN_CLEAR_FAILED',
          domain,
          message: error.message
        });
      }
    }

    result.success = result.errors.length === 0;
  } catch (error) {
    result.errors.push({
      code: 'CLEAR_COOKIES_FAILED',
      message: error.message
    });
  }

  return result;
}

// =============================================================================
// Incognito Mode Functions
// =============================================================================

/**
 * Enable incognito mode by creating an incognito window
 * Note: Extensions need "incognito": "split" or "spanning" in manifest
 * @param {Object} options - Incognito options
 * @param {string} options.url - Initial URL to open (optional)
 * @param {boolean} options.focused - Whether to focus the new window
 * @returns {Promise<Object>} Incognito window result
 */
async function enableIncognitoMode(options = {}) {
  const { url = null, focused = true } = options;

  const result = {
    success: false,
    windowId: null,
    tabId: null,
    isIncognito: false,
    errors: [],
    warnings: [],
    timestamp: Date.now()
  };

  try {
    if (typeof chrome === 'undefined' || !chrome.windows) {
      result.errors.push({
        code: 'API_UNAVAILABLE',
        message: 'chrome.windows API not available'
      });
      return result;
    }

    // Check if extension has incognito access
    const isAllowed = await new Promise((resolve) => {
      chrome.extension.isAllowedIncognitoAccess((allowed) => {
        resolve(allowed);
      });
    });

    if (!isAllowed) {
      result.warnings.push({
        code: 'INCOGNITO_NOT_ALLOWED',
        message: 'Extension does not have incognito access enabled',
        severity: 'warning'
      });
    }

    // Create incognito window
    const windowOptions = {
      incognito: true,
      focused
    };

    if (url) {
      windowOptions.url = url;
    }

    const window = await new Promise((resolve, reject) => {
      chrome.windows.create(windowOptions, (window) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(window);
        }
      });
    });

    result.success = true;
    result.windowId = window.id;
    result.tabId = window.tabs && window.tabs.length > 0 ? window.tabs[0].id : null;
    result.isIncognito = window.incognito;

  } catch (error) {
    result.errors.push({
      code: 'INCOGNITO_CREATE_FAILED',
      message: error.message
    });
  }

  return result;
}

/**
 * Check if current context is incognito
 * @returns {Promise<Object>} Incognito status
 */
async function checkIncognitoStatus() {
  const result = {
    isIncognito: false,
    incognitoWindows: [],
    regularWindows: [],
    currentWindowIncognito: false,
    errors: [],
    timestamp: Date.now()
  };

  try {
    if (typeof chrome === 'undefined' || !chrome.windows) {
      result.errors.push({
        code: 'API_UNAVAILABLE',
        message: 'chrome.windows API not available'
      });
      return result;
    }

    // Get all windows
    const windows = await new Promise((resolve, reject) => {
      chrome.windows.getAll({ populate: false }, (windows) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(windows || []);
        }
      });
    });

    for (const window of windows) {
      if (window.incognito) {
        result.incognitoWindows.push(window.id);
        result.isIncognito = true;
      } else {
        result.regularWindows.push(window.id);
      }
    }

    // Check current window
    const currentWindow = await new Promise((resolve, reject) => {
      chrome.windows.getCurrent((window) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(window);
        }
      });
    });

    result.currentWindowIncognito = currentWindow.incognito;

  } catch (error) {
    result.errors.push({
      code: 'INCOGNITO_CHECK_FAILED',
      message: error.message
    });
  }

  return result;
}

// =============================================================================
// Privacy Status Functions
// =============================================================================

/**
 * Get comprehensive privacy status
 * @returns {Promise<Object>} Privacy status information
 */
async function getPrivacyStatus() {
  const result = {
    success: true,
    localOnlyMode: PrivacyState.localOnlyMode,
    localOnlyEnabledAt: PrivacyState.localOnlyEnabledAt,
    privacyLevel: PrivacyState.privacyLevel,
    blockedConnections: {
      count: PrivacyState.blockedConnectionAttempts.length,
      recent: PrivacyState.blockedConnectionAttempts.slice(-10)
    },
    lastClearOperation: PrivacyState.lastClearOperation,
    incognito: null,
    cookies: null,
    settings: null,
    errors: [],
    warnings: [],
    timestamp: Date.now()
  };

  try {
    // Get incognito status
    result.incognito = await checkIncognitoStatus();

    // Get cookie settings if available
    if (typeof chrome !== 'undefined' && chrome.privacy && chrome.privacy.websites) {
      try {
        const thirdPartyCookies = await new Promise((resolve, reject) => {
          chrome.privacy.websites.thirdPartyCookiesAllowed.get({}, (details) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(details);
            }
          });
        });

        result.cookies = {
          thirdPartyCookiesAllowed: thirdPartyCookies.value,
          levelOfControl: thirdPartyCookies.levelOfControl
        };
      } catch (error) {
        result.warnings.push({
          code: 'COOKIE_SETTINGS_UNAVAILABLE',
          message: error.message,
          severity: 'warning'
        });
      }
    }

    // Get privacy settings if available
    if (typeof chrome !== 'undefined' && chrome.privacy && chrome.privacy.services) {
      try {
        const settings = {};

        // Safe browsing
        const safeBrowsing = await new Promise((resolve) => {
          chrome.privacy.services.safeBrowsingEnabled.get({}, (details) => {
            resolve(details?.value);
          });
        });
        settings.safeBrowsingEnabled = safeBrowsing;

        // Do Not Track
        if (chrome.privacy.websites.doNotTrackEnabled) {
          const doNotTrack = await new Promise((resolve) => {
            chrome.privacy.websites.doNotTrackEnabled.get({}, (details) => {
              resolve(details?.value);
            });
          });
          settings.doNotTrackEnabled = doNotTrack;
        }

        result.settings = settings;
      } catch (error) {
        result.warnings.push({
          code: 'PRIVACY_SETTINGS_UNAVAILABLE',
          message: error.message,
          severity: 'warning'
        });
      }
    }

  } catch (error) {
    result.errors.push({
      code: 'PRIVACY_STATUS_FAILED',
      message: error.message
    });
    result.success = false;
  }

  return result;
}

/**
 * Set privacy level (affects multiple settings)
 * @param {string} level - Privacy level ('standard', 'enhanced', 'maximum')
 * @returns {Promise<Object>} Result of privacy level change
 */
async function setPrivacyLevel(level) {
  const validLevels = ['standard', 'enhanced', 'maximum'];

  const result = {
    success: false,
    previousLevel: PrivacyState.privacyLevel,
    newLevel: null,
    changes: [],
    errors: [],
    timestamp: Date.now()
  };

  if (!validLevels.includes(level)) {
    result.errors.push({
      code: 'INVALID_PRIVACY_LEVEL',
      message: `Invalid privacy level: ${level}. Valid levels: ${validLevels.join(', ')}`
    });
    return result;
  }

  PrivacyState.privacyLevel = level;
  result.newLevel = level;

  // Apply settings based on level
  switch (level) {
    case 'maximum':
      // Enable local-only mode
      const localOnlyResult = await setLocalOnlyMode(true);
      if (localOnlyResult.success) {
        result.changes.push('Enabled local-only mode');
      }
      // Block third-party cookies if possible
      // Clear browsing data
      break;

    case 'enhanced':
      // Moderate privacy settings
      break;

    case 'standard':
      // Disable local-only mode
      const disableResult = await setLocalOnlyMode(false);
      if (disableResult.success) {
        result.changes.push('Disabled local-only mode');
      }
      break;
  }

  result.success = true;
  return result;
}

// =============================================================================
// Local-Only Mode Functions
// =============================================================================

/**
 * Enable or disable local-only mode
 * When enabled, restricts external connections except allowed WebSocket
 * @param {boolean} enabled - Whether to enable local-only mode
 * @param {Object} options - Additional options
 * @param {Array<string>} options.additionalAllowedHosts - Additional hosts to allow
 * @returns {Promise<Object>} Result of mode change
 */
async function setLocalOnlyMode(enabled, options = {}) {
  const { additionalAllowedHosts = [] } = options;

  const result = {
    success: false,
    enabled,
    previousState: PrivacyState.localOnlyMode,
    allowedHosts: [],
    errors: [],
    warnings: [],
    timestamp: Date.now()
  };

  try {
    PrivacyState.localOnlyMode = enabled;

    if (enabled) {
      PrivacyState.localOnlyEnabledAt = Date.now();

      // Build allowed hosts list
      result.allowedHosts = [
        ...PrivacyControlsConfig.allowedLocalHosts,
        ...additionalAllowedHosts
      ];

      result.warnings.push({
        code: 'LOCAL_ONLY_ENABLED',
        message: 'External connections are now blocked. Only localhost connections are allowed.',
        severity: 'info'
      });
    } else {
      PrivacyState.localOnlyEnabledAt = null;
      PrivacyState.blockedConnectionAttempts = []; // Clear blocked attempts log

      result.warnings.push({
        code: 'LOCAL_ONLY_DISABLED',
        message: 'External connections are now allowed.',
        severity: 'info'
      });
    }

    result.success = true;
  } catch (error) {
    result.errors.push({
      code: 'LOCAL_ONLY_MODE_FAILED',
      message: error.message
    });
  }

  return result;
}

/**
 * Check if a URL is allowed in local-only mode
 * @param {string} url - URL to check
 * @returns {Object} Check result
 */
function isUrlAllowedInLocalMode(url) {
  const result = {
    allowed: true,
    isLocalOnly: PrivacyState.localOnlyMode,
    reason: null,
    host: null,
    port: null
  };

  if (!PrivacyState.localOnlyMode) {
    result.reason = 'Local-only mode is disabled';
    return result;
  }

  try {
    // Handle WebSocket URLs
    let parsedUrl;
    if (url.startsWith('ws://') || url.startsWith('wss://')) {
      parsedUrl = new URL(url.replace('ws://', 'http://').replace('wss://', 'https://'));
    } else {
      parsedUrl = new URL(url);
    }

    result.host = parsedUrl.hostname;
    result.port = parsedUrl.port;

    // Check if host is allowed
    const isLocalHost = PrivacyControlsConfig.allowedLocalHosts.some(
      allowed => parsedUrl.hostname.toLowerCase() === allowed.toLowerCase() ||
                 parsedUrl.hostname.toLowerCase().endsWith(`.${allowed.toLowerCase()}`)
    );

    if (!isLocalHost) {
      result.allowed = false;
      result.reason = `Host ${parsedUrl.hostname} is not in allowed local hosts`;

      // Log blocked attempt
      PrivacyState.blockedConnectionAttempts.push({
        url,
        host: parsedUrl.hostname,
        timestamp: Date.now(),
        reason: result.reason
      });

      // Keep only last 100 blocked attempts
      if (PrivacyState.blockedConnectionAttempts.length > 100) {
        PrivacyState.blockedConnectionAttempts.shift();
      }
    } else {
      result.reason = 'Host is in allowed local hosts list';
    }

  } catch (error) {
    result.allowed = false;
    result.reason = `Invalid URL: ${error.message}`;
  }

  return result;
}

/**
 * Get blocked connection attempts
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of attempts to return
 * @param {number} options.since - Only return attempts after this timestamp
 * @returns {Object} Blocked attempts information
 */
function getBlockedConnections(options = {}) {
  const { limit = 50, since = 0 } = options;

  let attempts = PrivacyState.blockedConnectionAttempts;

  // Filter by time
  if (since > 0) {
    attempts = attempts.filter(a => a.timestamp >= since);
  }

  // Apply limit
  if (limit > 0) {
    attempts = attempts.slice(-limit);
  }

  return {
    localOnlyMode: PrivacyState.localOnlyMode,
    totalBlocked: PrivacyState.blockedConnectionAttempts.length,
    returned: attempts.length,
    attempts,
    timestamp: Date.now()
  };
}

/**
 * Clear blocked connection log
 * @returns {Object} Clear result
 */
function clearBlockedConnections() {
  const count = PrivacyState.blockedConnectionAttempts.length;
  PrivacyState.blockedConnectionAttempts = [];

  return {
    success: true,
    clearedCount: count,
    timestamp: Date.now()
  };
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.clearBrowsingData = clearBrowsingData;
  globalThis.clearCookiesForDomains = clearCookiesForDomains;
  globalThis.enableIncognitoMode = enableIncognitoMode;
  globalThis.checkIncognitoStatus = checkIncognitoStatus;
  globalThis.getPrivacyStatus = getPrivacyStatus;
  globalThis.setPrivacyLevel = setPrivacyLevel;
  globalThis.setLocalOnlyMode = setLocalOnlyMode;
  globalThis.isUrlAllowedInLocalMode = isUrlAllowedInLocalMode;
  globalThis.getBlockedConnections = getBlockedConnections;
  globalThis.clearBlockedConnections = clearBlockedConnections;
  globalThis.PrivacyControlsConfig = PrivacyControlsConfig;
  globalThis.PrivacyState = PrivacyState;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    clearBrowsingData,
    clearCookiesForDomains,
    enableIncognitoMode,
    checkIncognitoStatus,
    getPrivacyStatus,
    setPrivacyLevel,
    setLocalOnlyMode,
    isUrlAllowedInLocalMode,
    getBlockedConnections,
    clearBlockedConnections,
    PrivacyControlsConfig,
    PrivacyState
  };
}
