/**
 * Basset Hound Browser Automation - WebSocket Authentication
 * Phase 7 Security: WebSocket Authentication and Message Encryption
 *
 * Provides secure WebSocket communication:
 * - Token-based authentication for connections
 * - Message encryption/decryption (XOR-based for simplicity)
 * - Secure WSS connection creation
 * - Token rotation support
 */

// =============================================================================
// Configuration
// =============================================================================

const WebSocketAuthConfig = {
  // Token settings
  tokenLength: 32,
  tokenExpiry: 3600000, // 1 hour in milliseconds
  tokenRefreshThreshold: 300000, // 5 minutes before expiry

  // Encryption settings
  defaultKeyLength: 16,

  // Connection settings
  handshakeTimeout: 10000, // 10 seconds
  maxAuthAttempts: 3
};

// =============================================================================
// Token Storage
// =============================================================================

/**
 * In-memory token storage with expiration tracking
 */
const TokenStore = {
  currentToken: null,
  tokenExpiry: null,
  tokenCreatedAt: null,
  authAttempts: 0,
  lastAuthAttempt: null
};

// =============================================================================
// Authentication Token Functions
// =============================================================================

/**
 * Generate a cryptographically secure authentication token
 * Uses crypto.getRandomValues for secure random generation
 * @param {Object} options - Token generation options
 * @param {number} options.length - Token length in bytes (default: 32)
 * @param {number} options.expiry - Token expiry in milliseconds (default: 1 hour)
 * @returns {Object} Token object with token string, expiry, and metadata
 */
function generateAuthToken(options = {}) {
  const {
    length = WebSocketAuthConfig.tokenLength,
    expiry = WebSocketAuthConfig.tokenExpiry
  } = options;

  // Generate random bytes
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);

  // Convert to hex string for easy transport
  const token = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const now = Date.now();
  const tokenExpiry = now + expiry;

  // Store token
  TokenStore.currentToken = token;
  TokenStore.tokenExpiry = tokenExpiry;
  TokenStore.tokenCreatedAt = now;

  return {
    token,
    expiresAt: tokenExpiry,
    createdAt: now,
    length: token.length,
    expiresIn: expiry
  };
}

/**
 * Validate an incoming authentication token
 * Checks token format, expiry, and matches against stored token
 * @param {string} token - Token to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.checkExpiry - Whether to check token expiry (default: true)
 * @param {boolean} options.matchStored - Whether to match against stored token (default: true)
 * @returns {Object} Validation result with valid flag and details
 */
function validateAuthToken(token, options = {}) {
  const {
    checkExpiry = true,
    matchStored = true
  } = options;

  const result = {
    valid: false,
    errors: [],
    warnings: [],
    token: null,
    metadata: {}
  };

  // Type check
  if (typeof token !== 'string') {
    result.errors.push({
      code: 'INVALID_TOKEN_TYPE',
      message: 'Token must be a string',
      received: typeof token
    });
    return result;
  }

  // Empty check
  if (!token || token.trim() === '') {
    result.errors.push({
      code: 'EMPTY_TOKEN',
      message: 'Token cannot be empty'
    });
    return result;
  }

  // Format check (should be hex string)
  if (!/^[a-fA-F0-9]+$/.test(token)) {
    result.errors.push({
      code: 'INVALID_TOKEN_FORMAT',
      message: 'Token must be a valid hex string'
    });
    return result;
  }

  // Length check
  const expectedLength = WebSocketAuthConfig.tokenLength * 2; // Hex is 2 chars per byte
  if (token.length !== expectedLength) {
    result.warnings.push({
      code: 'TOKEN_LENGTH_MISMATCH',
      message: `Token length ${token.length} differs from expected ${expectedLength}`,
      severity: 'warning'
    });
  }

  // Match against stored token
  if (matchStored) {
    if (!TokenStore.currentToken) {
      result.errors.push({
        code: 'NO_STORED_TOKEN',
        message: 'No token has been generated for comparison'
      });
      return result;
    }

    if (token !== TokenStore.currentToken) {
      result.errors.push({
        code: 'TOKEN_MISMATCH',
        message: 'Token does not match the current active token'
      });
      // Track failed auth attempts
      TokenStore.authAttempts++;
      TokenStore.lastAuthAttempt = Date.now();

      result.metadata.authAttempts = TokenStore.authAttempts;

      // Check if too many attempts
      if (TokenStore.authAttempts >= WebSocketAuthConfig.maxAuthAttempts) {
        result.errors.push({
          code: 'MAX_AUTH_ATTEMPTS_EXCEEDED',
          message: `Maximum authentication attempts (${WebSocketAuthConfig.maxAuthAttempts}) exceeded`
        });
      }
      return result;
    }
  }

  // Expiry check
  if (checkExpiry && TokenStore.tokenExpiry) {
    const now = Date.now();

    if (now > TokenStore.tokenExpiry) {
      result.errors.push({
        code: 'TOKEN_EXPIRED',
        message: 'Token has expired',
        expiredAt: TokenStore.tokenExpiry,
        expiredAgo: now - TokenStore.tokenExpiry
      });
      return result;
    }

    // Warn if token is about to expire
    const timeUntilExpiry = TokenStore.tokenExpiry - now;
    if (timeUntilExpiry < WebSocketAuthConfig.tokenRefreshThreshold) {
      result.warnings.push({
        code: 'TOKEN_EXPIRING_SOON',
        message: 'Token will expire soon, consider refreshing',
        expiresIn: timeUntilExpiry,
        severity: 'warning'
      });
    }
  }

  // Token is valid
  result.valid = true;
  result.token = token;
  result.metadata = {
    createdAt: TokenStore.tokenCreatedAt,
    expiresAt: TokenStore.tokenExpiry,
    timeUntilExpiry: TokenStore.tokenExpiry ? TokenStore.tokenExpiry - Date.now() : null
  };

  // Reset auth attempts on successful validation
  TokenStore.authAttempts = 0;

  return result;
}

/**
 * Rotate the authentication token (generate a new one and invalidate the old)
 * @param {Object} options - Rotation options
 * @returns {Object} New token information
 */
function rotateAuthToken(options = {}) {
  const previousToken = TokenStore.currentToken;
  const previousExpiry = TokenStore.tokenExpiry;

  // Generate new token
  const newToken = generateAuthToken(options);

  return {
    ...newToken,
    rotated: true,
    previousTokenLength: previousToken ? previousToken.length : 0,
    previousExpiryWas: previousExpiry
  };
}

/**
 * Get current token status without revealing the token itself
 * @returns {Object} Token status information
 */
function getTokenStatus() {
  const now = Date.now();
  const hasToken = TokenStore.currentToken !== null;
  const isExpired = hasToken && TokenStore.tokenExpiry && now > TokenStore.tokenExpiry;
  const timeUntilExpiry = hasToken && TokenStore.tokenExpiry ? TokenStore.tokenExpiry - now : null;

  return {
    hasToken,
    isExpired,
    expiresAt: TokenStore.tokenExpiry,
    timeUntilExpiry,
    createdAt: TokenStore.tokenCreatedAt,
    authAttempts: TokenStore.authAttempts,
    lastAuthAttempt: TokenStore.lastAuthAttempt,
    needsRefresh: timeUntilExpiry !== null && timeUntilExpiry < WebSocketAuthConfig.tokenRefreshThreshold
  };
}

/**
 * Clear the current token (for logout/disconnect scenarios)
 */
function clearAuthToken() {
  const hadToken = TokenStore.currentToken !== null;

  TokenStore.currentToken = null;
  TokenStore.tokenExpiry = null;
  TokenStore.tokenCreatedAt = null;
  TokenStore.authAttempts = 0;
  TokenStore.lastAuthAttempt = null;

  return {
    cleared: hadToken,
    timestamp: Date.now()
  };
}

// =============================================================================
// Message Encryption/Decryption (XOR-based)
// =============================================================================

/**
 * Encrypt a message using XOR encryption
 * Note: XOR is a simple symmetric encryption - not suitable for production security
 * but provides basic obfuscation for the WebSocket channel
 * @param {string} message - Message to encrypt
 * @param {string} key - Encryption key (hex string or regular string)
 * @returns {Object} Encrypted message result
 */
function encryptMessage(message, key) {
  // Validate inputs
  if (typeof message !== 'string') {
    throw new Error('Message must be a string');
  }
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('Key must be a non-empty string');
  }

  // Convert key to bytes (if hex, decode it; otherwise use UTF-8)
  const keyBytes = isHexString(key)
    ? hexToBytes(key)
    : stringToBytes(key);

  // Convert message to bytes
  const messageBytes = stringToBytes(message);

  // XOR encrypt
  const encryptedBytes = new Uint8Array(messageBytes.length);
  for (let i = 0; i < messageBytes.length; i++) {
    encryptedBytes[i] = messageBytes[i] ^ keyBytes[i % keyBytes.length];
  }

  // Convert to base64 for safe transport
  const encryptedBase64 = bytesToBase64(encryptedBytes);

  return {
    encrypted: encryptedBase64,
    originalLength: message.length,
    encryptedLength: encryptedBase64.length,
    algorithm: 'xor',
    timestamp: Date.now()
  };
}

/**
 * Decrypt a message using XOR decryption
 * @param {string} encryptedMessage - Base64 encoded encrypted message
 * @param {string} key - Decryption key (same as encryption key)
 * @returns {Object} Decrypted message result
 */
function decryptMessage(encryptedMessage, key) {
  // Validate inputs
  if (typeof encryptedMessage !== 'string') {
    throw new Error('Encrypted message must be a string');
  }
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('Key must be a non-empty string');
  }

  // Convert key to bytes
  const keyBytes = isHexString(key)
    ? hexToBytes(key)
    : stringToBytes(key);

  // Decode base64 to bytes
  let encryptedBytes;
  try {
    encryptedBytes = base64ToBytes(encryptedMessage);
  } catch (error) {
    throw new Error(`Invalid base64 encoded message: ${error.message}`);
  }

  // XOR decrypt (XOR is symmetric, same operation as encrypt)
  const decryptedBytes = new Uint8Array(encryptedBytes.length);
  for (let i = 0; i < encryptedBytes.length; i++) {
    decryptedBytes[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
  }

  // Convert back to string
  const decrypted = bytesToString(decryptedBytes);

  return {
    decrypted,
    originalLength: decrypted.length,
    algorithm: 'xor',
    timestamp: Date.now()
  };
}

/**
 * Generate an encryption key
 * @param {Object} options - Key generation options
 * @param {number} options.length - Key length in bytes (default: 16)
 * @returns {Object} Generated key information
 */
function generateEncryptionKey(options = {}) {
  const { length = WebSocketAuthConfig.defaultKeyLength } = options;

  const keyBytes = new Uint8Array(length);
  crypto.getRandomValues(keyBytes);

  const keyHex = Array.from(keyBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    key: keyHex,
    length: keyHex.length,
    bytes: length,
    algorithm: 'xor',
    generatedAt: Date.now()
  };
}

// =============================================================================
// Secure WebSocket Connection
// =============================================================================

/**
 * Create a secure WebSocket connection with authentication
 * @param {string} url - WebSocket URL (ws:// or wss://)
 * @param {Object} options - Connection options
 * @param {string} options.authToken - Authentication token
 * @param {boolean} options.requireWSS - Require WSS protocol (default: true for non-localhost)
 * @param {number} options.handshakeTimeout - Handshake timeout in ms
 * @param {Function} options.onAuthenticated - Callback when authenticated
 * @param {Function} options.onAuthFailed - Callback when auth fails
 * @param {string} options.encryptionKey - Key for message encryption
 * @returns {Promise<Object>} Connection result with WebSocket instance
 */
async function createSecureConnection(url, options = {}) {
  const {
    authToken = null,
    requireWSS = !isLocalhost(url),
    handshakeTimeout = WebSocketAuthConfig.handshakeTimeout,
    onAuthenticated = null,
    onAuthFailed = null,
    encryptionKey = null
  } = options;

  // Validate URL
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (error) {
    throw new Error(`Invalid WebSocket URL: ${error.message}`);
  }

  // Check protocol
  const isWSS = parsedUrl.protocol === 'wss:';
  const isWS = parsedUrl.protocol === 'ws:';

  if (!isWSS && !isWS) {
    throw new Error(`Invalid WebSocket protocol: ${parsedUrl.protocol}. Expected ws: or wss:`);
  }

  // Enforce WSS for non-localhost connections
  if (requireWSS && !isWSS && !isLocalhost(url)) {
    throw new Error('WSS (secure WebSocket) is required for non-localhost connections');
  }

  // Create connection wrapper
  const connectionInfo = {
    url,
    protocol: parsedUrl.protocol,
    isSecure: isWSS,
    authenticated: false,
    encryptionEnabled: encryptionKey !== null,
    encryptionKey: encryptionKey,
    createdAt: Date.now()
  };

  return new Promise((resolve, reject) => {
    let ws;
    let handshakeTimer;
    let resolved = false;

    try {
      ws = new WebSocket(url);
    } catch (error) {
      reject(new Error(`Failed to create WebSocket: ${error.message}`));
      return;
    }

    // Set up handshake timeout
    handshakeTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close(4001, 'Handshake timeout');
        reject(new Error(`Authentication handshake timed out after ${handshakeTimeout}ms`));
      }
    }, handshakeTimeout);

    ws.onopen = () => {
      // Send authentication message if token provided
      if (authToken) {
        const authMessage = {
          type: 'auth',
          token: authToken,
          timestamp: Date.now(),
          clientInfo: {
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
            protocol: parsedUrl.protocol
          }
        };

        // Encrypt auth message if encryption enabled
        let messageToSend;
        if (encryptionKey) {
          const encrypted = encryptMessage(JSON.stringify(authMessage), encryptionKey);
          messageToSend = JSON.stringify({
            type: 'encrypted',
            payload: encrypted.encrypted
          });
        } else {
          messageToSend = JSON.stringify(authMessage);
        }

        ws.send(messageToSend);
      } else {
        // No auth required, connection is ready
        clearTimeout(handshakeTimer);
        if (!resolved) {
          resolved = true;
          connectionInfo.authenticated = false;
          connectionInfo.ws = ws;
          resolve(connectionInfo);
        }
      }
    };

    ws.onmessage = (event) => {
      if (resolved) return;

      try {
        let message;

        // Decrypt if encryption enabled
        if (encryptionKey && typeof event.data === 'string') {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === 'encrypted' && parsed.payload) {
              const decrypted = decryptMessage(parsed.payload, encryptionKey);
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

        // Handle auth response
        if (message.type === 'auth_response') {
          clearTimeout(handshakeTimer);
          resolved = true;

          if (message.success) {
            connectionInfo.authenticated = true;
            connectionInfo.authInfo = message;
            connectionInfo.ws = ws;

            if (onAuthenticated) {
              onAuthenticated(connectionInfo);
            }

            resolve(connectionInfo);
          } else {
            connectionInfo.authenticated = false;
            connectionInfo.authError = message.error || 'Authentication failed';

            if (onAuthFailed) {
              onAuthFailed(connectionInfo);
            }

            ws.close(4002, 'Authentication failed');
            reject(new Error(connectionInfo.authError));
          }
        }
      } catch (error) {
        // Non-auth message during handshake, ignore
      }
    };

    ws.onerror = (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(handshakeTimer);
        reject(new Error(`WebSocket error: ${error.message || 'Connection failed'}`));
      }
    };

    ws.onclose = (event) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(handshakeTimer);
        reject(new Error(`WebSocket closed during handshake: ${event.code} ${event.reason}`));
      }
    };
  });
}

/**
 * Upgrade a ws:// URL to wss://
 * @param {string} url - WebSocket URL
 * @returns {string} WSS URL
 */
function upgradeToWSS(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'ws:') {
      parsed.protocol = 'wss:';
      // Also update default port if applicable
      if (parsed.port === '80') {
        parsed.port = '443';
      }
    }
    return parsed.toString();
  } catch (error) {
    throw new Error(`Invalid URL for WSS upgrade: ${error.message}`);
  }
}

/**
 * Get WebSocket connection status information
 * @param {WebSocket} ws - WebSocket instance
 * @returns {Object} Connection status
 */
function getConnectionStatus(ws) {
  const states = {
    0: 'CONNECTING',
    1: 'OPEN',
    2: 'CLOSING',
    3: 'CLOSED'
  };

  return {
    readyState: ws ? ws.readyState : null,
    stateName: ws ? states[ws.readyState] || 'UNKNOWN' : 'NO_CONNECTION',
    url: ws ? ws.url : null,
    protocol: ws ? ws.protocol : null,
    bufferedAmount: ws ? ws.bufferedAmount : null,
    extensions: ws ? ws.extensions : null
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if a string is a valid hex string
 * @private
 * @param {string} str - String to check
 * @returns {boolean} True if valid hex
 */
function isHexString(str) {
  return typeof str === 'string' && /^[a-fA-F0-9]+$/.test(str) && str.length % 2 === 0;
}

/**
 * Convert hex string to bytes
 * @private
 * @param {string} hex - Hex string
 * @returns {Uint8Array} Bytes
 */
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Convert string to bytes (UTF-8)
 * @private
 * @param {string} str - String to convert
 * @returns {Uint8Array} Bytes
 */
function stringToBytes(str) {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

/**
 * Convert bytes to string (UTF-8)
 * @private
 * @param {Uint8Array} bytes - Bytes to convert
 * @returns {string} String
 */
function bytesToString(bytes) {
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

/**
 * Convert bytes to base64
 * @private
 * @param {Uint8Array} bytes - Bytes to convert
 * @returns {string} Base64 string
 */
function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 to bytes
 * @private
 * @param {string} base64 - Base64 string
 * @returns {Uint8Array} Bytes
 */
function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Check if URL is localhost
 * @private
 * @param {string} url - URL to check
 * @returns {boolean} True if localhost
 */
function isLocalhost(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return hostname === 'localhost' ||
           hostname === '127.0.0.1' ||
           hostname === '::1' ||
           hostname.endsWith('.localhost');
  } catch {
    return false;
  }
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.generateAuthToken = generateAuthToken;
  globalThis.validateAuthToken = validateAuthToken;
  globalThis.rotateAuthToken = rotateAuthToken;
  globalThis.getTokenStatus = getTokenStatus;
  globalThis.clearAuthToken = clearAuthToken;
  globalThis.encryptMessage = encryptMessage;
  globalThis.decryptMessage = decryptMessage;
  globalThis.generateEncryptionKey = generateEncryptionKey;
  globalThis.createSecureConnection = createSecureConnection;
  globalThis.upgradeToWSS = upgradeToWSS;
  globalThis.getConnectionStatus = getConnectionStatus;
  globalThis.WebSocketAuthConfig = WebSocketAuthConfig;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateAuthToken,
    validateAuthToken,
    rotateAuthToken,
    getTokenStatus,
    clearAuthToken,
    encryptMessage,
    decryptMessage,
    generateEncryptionKey,
    createSecureConnection,
    upgradeToWSS,
    getConnectionStatus,
    WebSocketAuthConfig
  };
}
