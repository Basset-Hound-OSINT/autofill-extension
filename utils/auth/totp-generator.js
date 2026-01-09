/**
 * Basset Hound Browser Automation - TOTP Generator
 * Phase 10 Security: TOTP Support for Sock Puppet Integration
 *
 * RFC 6238 compliant TOTP (Time-based One-Time Password) generator.
 * Uses Web Crypto API for HMAC computation (MV3 compatible).
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * TOTP Configuration defaults
 */
const TOTPConfig = {
  // Default time step in seconds (RFC 6238 recommends 30)
  defaultPeriod: 30,

  // Default code length (6 digits is standard)
  defaultDigits: 6,

  // Default algorithm
  defaultAlgorithm: 'SHA1',

  // Supported algorithms with their Web Crypto names
  algorithms: {
    'SHA1': 'SHA-1',
    'SHA256': 'SHA-256',
    'SHA512': 'SHA-512'
  },

  // Maximum code length
  maxDigits: 8,

  // Minimum code length
  minDigits: 6
};

// =============================================================================
// TOTP Generator Class
// =============================================================================

/**
 * TOTP Generator for sock puppet 2FA authentication
 */
class TOTPGenerator {
  /**
   * Create a new TOTPGenerator
   * @param {Object} options - Configuration options
   * @param {string} options.secret - Base32 encoded secret key
   * @param {number} options.period - Time step in seconds (default: 30)
   * @param {number} options.digits - OTP length (default: 6)
   * @param {string} options.algorithm - Hash algorithm (SHA1, SHA256, SHA512)
   * @param {Object} options.logger - Logger instance
   */
  constructor(options = {}) {
    this.config = {
      secret: options.secret || null,
      period: options.period || TOTPConfig.defaultPeriod,
      digits: options.digits || TOTPConfig.defaultDigits,
      algorithm: options.algorithm || TOTPConfig.defaultAlgorithm,
      logger: options.logger || null
    };

    // Validate configuration
    this._validateConfig();

    // Decoded secret key (cached)
    this._secretKey = null;
  }

  /**
   * Validate configuration
   * @private
   */
  _validateConfig() {
    // Validate digits
    if (this.config.digits < TOTPConfig.minDigits || this.config.digits > TOTPConfig.maxDigits) {
      throw new Error(`Digits must be between ${TOTPConfig.minDigits} and ${TOTPConfig.maxDigits}`);
    }

    // Validate algorithm
    if (!TOTPConfig.algorithms[this.config.algorithm]) {
      throw new Error(`Unsupported algorithm: ${this.config.algorithm}. Supported: ${Object.keys(TOTPConfig.algorithms).join(', ')}`);
    }

    // Validate period
    if (this.config.period < 1 || this.config.period > 300) {
      throw new Error('Period must be between 1 and 300 seconds');
    }
  }

  /**
   * Set or update the secret key
   * @param {string} secret - Base32 encoded secret
   */
  setSecret(secret) {
    this.config.secret = secret;
    this._secretKey = null; // Clear cached key
  }

  /**
   * Get the decoded secret key
   * @private
   * @returns {Promise<Uint8Array>} Decoded secret bytes
   */
  async _getSecretKey() {
    if (this._secretKey) {
      return this._secretKey;
    }

    if (!this.config.secret) {
      throw new Error('Secret key not set');
    }

    // Use global Base32 decoder
    if (typeof Base32 !== 'undefined' && Base32.decode) {
      this._secretKey = Base32.decode(this.config.secret);
    } else {
      // Fallback: inline Base32 decode
      this._secretKey = this._base32Decode(this.config.secret);
    }

    return this._secretKey;
  }

  /**
   * Fallback Base32 decode (if Base32 module not available)
   * @private
   * @param {string} encoded - Base32 encoded string
   * @returns {Uint8Array} Decoded bytes
   */
  _base32Decode(encoded) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const lookup = {};
    for (let i = 0; i < alphabet.length; i++) {
      lookup[alphabet[i]] = i;
      lookup[alphabet[i].toLowerCase()] = i;
    }

    // Remove whitespace and padding
    const cleaned = encoded.replace(/[\s=]/g, '').toUpperCase();

    if (cleaned.length === 0) {
      return new Uint8Array(0);
    }

    const outputLength = Math.floor((cleaned.length * 5) / 8);
    const result = new Uint8Array(outputLength);

    let buffer = 0;
    let bitsInBuffer = 0;
    let byteIndex = 0;

    for (let i = 0; i < cleaned.length; i++) {
      const value = lookup[cleaned[i]];
      if (value === undefined) continue;

      buffer = (buffer << 5) | value;
      bitsInBuffer += 5;

      while (bitsInBuffer >= 8 && byteIndex < outputLength) {
        bitsInBuffer -= 8;
        result[byteIndex++] = (buffer >> bitsInBuffer) & 0xff;
      }
    }

    return result;
  }

  /**
   * Get current time counter
   * @param {number} timestamp - Unix timestamp in milliseconds (default: now)
   * @returns {number} Time counter value
   */
  getTimeCounter(timestamp = Date.now()) {
    return Math.floor(timestamp / 1000 / this.config.period);
  }

  /**
   * Get seconds remaining in current period
   * @param {number} timestamp - Unix timestamp in milliseconds (default: now)
   * @returns {number} Seconds remaining
   */
  getSecondsRemaining(timestamp = Date.now()) {
    const secondsInPeriod = Math.floor(timestamp / 1000) % this.config.period;
    return this.config.period - secondsInPeriod;
  }

  /**
   * Generate HMAC using Web Crypto API
   * @private
   * @param {Uint8Array} key - Secret key
   * @param {Uint8Array} data - Data to hash
   * @returns {Promise<Uint8Array>} HMAC result
   */
  async _hmac(key, data) {
    const algorithm = TOTPConfig.algorithms[this.config.algorithm];

    // Import key for HMAC
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: algorithm },
      false,
      ['sign']
    );

    // Compute HMAC
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);

    return new Uint8Array(signature);
  }

  /**
   * Convert counter to 8-byte buffer (big-endian)
   * @private
   * @param {number} counter - Time counter value
   * @returns {Uint8Array} 8-byte buffer
   */
  _counterToBytes(counter) {
    const buffer = new Uint8Array(8);

    // Write as big-endian 64-bit integer
    for (let i = 7; i >= 0; i--) {
      buffer[i] = counter & 0xff;
      counter = Math.floor(counter / 256);
    }

    return buffer;
  }

  /**
   * Dynamic truncation (RFC 4226)
   * @private
   * @param {Uint8Array} hmacResult - HMAC result
   * @returns {number} Truncated code
   */
  _dynamicTruncate(hmacResult) {
    // Get offset from last nibble
    const offset = hmacResult[hmacResult.length - 1] & 0x0f;

    // Extract 4 bytes starting at offset
    const code =
      ((hmacResult[offset] & 0x7f) << 24) |
      ((hmacResult[offset + 1] & 0xff) << 16) |
      ((hmacResult[offset + 2] & 0xff) << 8) |
      (hmacResult[offset + 3] & 0xff);

    return code;
  }

  /**
   * Generate TOTP code for a specific counter
   * @param {number} counter - Time counter value
   * @returns {Promise<string>} TOTP code (zero-padded)
   */
  async generateForCounter(counter) {
    const key = await this._getSecretKey();
    const counterBytes = this._counterToBytes(counter);
    const hmacResult = await this._hmac(key, counterBytes);
    const truncated = this._dynamicTruncate(hmacResult);

    // Modulo to get desired number of digits
    const modulo = Math.pow(10, this.config.digits);
    const code = truncated % modulo;

    // Zero-pad to desired length
    return code.toString().padStart(this.config.digits, '0');
  }

  /**
   * Generate current TOTP code
   * @param {number} timestamp - Unix timestamp in milliseconds (default: now)
   * @returns {Promise<Object>} TOTP result with code and metadata
   */
  async generate(timestamp = Date.now()) {
    const counter = this.getTimeCounter(timestamp);
    const code = await this.generateForCounter(counter);
    const secondsRemaining = this.getSecondsRemaining(timestamp);

    return {
      code,
      counter,
      period: this.config.period,
      secondsRemaining,
      expiresAt: timestamp + (secondsRemaining * 1000),
      algorithm: this.config.algorithm,
      digits: this.config.digits
    };
  }

  /**
   * Generate multiple codes (current and adjacent windows)
   * @param {number} window - Number of windows to include before and after
   * @param {number} timestamp - Unix timestamp in milliseconds (default: now)
   * @returns {Promise<Object>} Multiple TOTP codes
   */
  async generateWithWindow(window = 1, timestamp = Date.now()) {
    const currentCounter = this.getTimeCounter(timestamp);
    const codes = [];

    for (let i = -window; i <= window; i++) {
      const counter = currentCounter + i;
      const code = await this.generateForCounter(counter);
      codes.push({
        code,
        counter,
        offset: i,
        isCurrent: i === 0
      });
    }

    return {
      codes,
      currentCode: codes.find(c => c.isCurrent).code,
      secondsRemaining: this.getSecondsRemaining(timestamp),
      window
    };
  }

  /**
   * Verify a TOTP code
   * @param {string} code - Code to verify
   * @param {number} window - Number of windows to check before and after
   * @param {number} timestamp - Unix timestamp in milliseconds (default: now)
   * @returns {Promise<Object>} Verification result
   */
  async verify(code, window = 1, timestamp = Date.now()) {
    const normalizedCode = code.toString().padStart(this.config.digits, '0');
    const windowResult = await this.generateWithWindow(window, timestamp);

    for (const entry of windowResult.codes) {
      if (entry.code === normalizedCode) {
        return {
          valid: true,
          code: normalizedCode,
          matchedCounter: entry.counter,
          offset: entry.offset,
          timestamp
        };
      }
    }

    return {
      valid: false,
      code: normalizedCode,
      timestamp,
      checkedCounters: windowResult.codes.map(c => c.counter)
    };
  }

  /**
   * Get configuration info (for display/debugging)
   * @returns {Object} Configuration details
   */
  getInfo() {
    return {
      period: this.config.period,
      digits: this.config.digits,
      algorithm: this.config.algorithm,
      hasSecret: !!this.config.secret,
      secretLength: this.config.secret ? this.config.secret.length : 0
    };
  }
}

// =============================================================================
// TOTP Manager (Multiple Secrets)
// =============================================================================

/**
 * TOTP Manager for handling multiple TOTP secrets
 * Used for sock puppet identity management
 */
class TOTPManager {
  /**
   * Create a new TOTPManager
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   */
  constructor(options = {}) {
    this.config = {
      logger: options.logger || null
    };

    // Map of identity ID to TOTP generator
    this.generators = new Map();

    // Statistics
    this.stats = {
      totalGenerations: 0,
      totalVerifications: 0,
      successfulVerifications: 0,
      failedVerifications: 0
    };
  }

  /**
   * Register a TOTP secret for an identity
   * @param {string} identityId - Identity/sock puppet ID
   * @param {Object} totpConfig - TOTP configuration
   * @param {string} totpConfig.secret - Base32 encoded secret
   * @param {number} totpConfig.period - Time period (default: 30)
   * @param {number} totpConfig.digits - Code length (default: 6)
   * @param {string} totpConfig.algorithm - Hash algorithm
   * @returns {Object} Registration result
   */
  register(identityId, totpConfig) {
    if (!identityId) {
      return { success: false, error: 'Identity ID required' };
    }

    if (!totpConfig?.secret) {
      return { success: false, error: 'Secret required' };
    }

    try {
      const generator = new TOTPGenerator({
        secret: totpConfig.secret,
        period: totpConfig.period,
        digits: totpConfig.digits,
        algorithm: totpConfig.algorithm,
        logger: this.config.logger
      });

      this.generators.set(identityId, generator);

      this._log('info', `Registered TOTP for identity: ${identityId}`);

      return {
        success: true,
        identityId,
        info: generator.getInfo()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Unregister a TOTP secret
   * @param {string} identityId - Identity ID
   * @returns {Object} Result
   */
  unregister(identityId) {
    const deleted = this.generators.delete(identityId);
    return {
      success: deleted,
      identityId
    };
  }

  /**
   * Check if identity has TOTP registered
   * @param {string} identityId - Identity ID
   * @returns {boolean} Whether TOTP is registered
   */
  has(identityId) {
    return this.generators.has(identityId);
  }

  /**
   * Generate TOTP code for an identity
   * @param {string} identityId - Identity ID
   * @param {number} timestamp - Unix timestamp (default: now)
   * @returns {Promise<Object>} TOTP result
   */
  async generate(identityId, timestamp = Date.now()) {
    const generator = this.generators.get(identityId);

    if (!generator) {
      return {
        success: false,
        error: `No TOTP registered for identity: ${identityId}`
      };
    }

    try {
      const result = await generator.generate(timestamp);
      this.stats.totalGenerations++;

      return {
        success: true,
        identityId,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        identityId,
        error: error.message
      };
    }
  }

  /**
   * Verify a TOTP code for an identity
   * @param {string} identityId - Identity ID
   * @param {string} code - Code to verify
   * @param {number} window - Verification window
   * @returns {Promise<Object>} Verification result
   */
  async verify(identityId, code, window = 1) {
    const generator = this.generators.get(identityId);

    if (!generator) {
      return {
        success: false,
        error: `No TOTP registered for identity: ${identityId}`
      };
    }

    try {
      const result = await generator.verify(code, window);
      this.stats.totalVerifications++;

      if (result.valid) {
        this.stats.successfulVerifications++;
      } else {
        this.stats.failedVerifications++;
      }

      return {
        success: true,
        identityId,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        identityId,
        error: error.message
      };
    }
  }

  /**
   * Generate codes for all registered identities
   * @param {number} timestamp - Unix timestamp (default: now)
   * @returns {Promise<Object>} All codes
   */
  async generateAll(timestamp = Date.now()) {
    const results = {};

    for (const [identityId, generator] of this.generators) {
      try {
        results[identityId] = await generator.generate(timestamp);
      } catch (error) {
        results[identityId] = { error: error.message };
      }
    }

    return {
      success: true,
      codes: results,
      count: this.generators.size,
      timestamp
    };
  }

  /**
   * Get list of registered identity IDs
   * @returns {Array<string>} Identity IDs
   */
  getRegisteredIdentities() {
    return Array.from(this.generators.keys());
  }

  /**
   * Get statistics
   * @returns {Object} Manager statistics
   */
  getStats() {
    return {
      ...this.stats,
      registeredCount: this.generators.size
    };
  }

  /**
   * Clear all registered secrets
   */
  clear() {
    this.generators.clear();
    this._log('info', 'Cleared all TOTP registrations');
  }

  /**
   * Log helper
   * @private
   */
  _log(level, message) {
    if (this.config.logger) {
      this.config.logger[level]?.(message);
    }
  }
}

// =============================================================================
// URI Parsing (otpauth:// format)
// =============================================================================

/**
 * Parse otpauth:// URI format
 * @param {string} uri - otpauth URI
 * @returns {Object} Parsed TOTP configuration
 */
function parseOTPAuthURI(uri) {
  const result = {
    valid: false,
    type: null,
    label: null,
    issuer: null,
    secret: null,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    errors: []
  };

  if (typeof uri !== 'string') {
    result.errors.push('URI must be a string');
    return result;
  }

  // Check protocol
  if (!uri.startsWith('otpauth://')) {
    result.errors.push('URI must start with otpauth://');
    return result;
  }

  try {
    const url = new URL(uri);

    // Get type (totp or hotp)
    result.type = url.host;
    if (result.type !== 'totp' && result.type !== 'hotp') {
      result.errors.push(`Invalid type: ${result.type}. Must be totp or hotp`);
    }

    // Get label (issuer:account or just account)
    result.label = decodeURIComponent(url.pathname.slice(1));

    // Parse parameters
    const params = url.searchParams;

    // Secret (required)
    result.secret = params.get('secret');
    if (!result.secret) {
      result.errors.push('Missing required parameter: secret');
    }

    // Issuer (optional)
    result.issuer = params.get('issuer') || null;

    // Algorithm (optional)
    const algorithm = params.get('algorithm');
    if (algorithm) {
      const upperAlgo = algorithm.toUpperCase();
      if (TOTPConfig.algorithms[upperAlgo]) {
        result.algorithm = upperAlgo;
      } else {
        result.errors.push(`Unsupported algorithm: ${algorithm}`);
      }
    }

    // Digits (optional)
    const digits = params.get('digits');
    if (digits) {
      const digitNum = parseInt(digits, 10);
      if (isNaN(digitNum) || digitNum < 6 || digitNum > 8) {
        result.errors.push(`Invalid digits: ${digits}. Must be 6-8`);
      } else {
        result.digits = digitNum;
      }
    }

    // Period (optional, TOTP only)
    const period = params.get('period');
    if (period) {
      const periodNum = parseInt(period, 10);
      if (isNaN(periodNum) || periodNum < 1) {
        result.errors.push(`Invalid period: ${period}`);
      } else {
        result.period = periodNum;
      }
    }

    result.valid = result.errors.length === 0;

  } catch (error) {
    result.errors.push(`Failed to parse URI: ${error.message}`);
  }

  return result;
}

/**
 * Generate otpauth:// URI from configuration
 * @param {Object} config - TOTP configuration
 * @returns {string} otpauth URI
 */
function generateOTPAuthURI(config) {
  const {
    secret,
    issuer = null,
    account = 'user',
    algorithm = 'SHA1',
    digits = 6,
    period = 30
  } = config;

  if (!secret) {
    throw new Error('Secret is required');
  }

  // Build label
  const label = issuer ? `${issuer}:${account}` : account;

  // Build URL
  const url = new URL(`otpauth://totp/${encodeURIComponent(label)}`);
  url.searchParams.set('secret', secret);

  if (issuer) {
    url.searchParams.set('issuer', issuer);
  }

  if (algorithm !== 'SHA1') {
    url.searchParams.set('algorithm', algorithm);
  }

  if (digits !== 6) {
    url.searchParams.set('digits', digits.toString());
  }

  if (period !== 30) {
    url.searchParams.set('period', period.toString());
  }

  return url.toString();
}

// =============================================================================
// Global Instance
// =============================================================================

/**
 * Global TOTP manager instance
 */
let totpManager = null;

/**
 * Get or create global TOTP manager
 * @param {Object} options - Configuration options
 * @returns {TOTPManager} Manager instance
 */
function getTOTPManager(options = {}) {
  if (!totpManager) {
    totpManager = new TOTPManager(options);
  }
  return totpManager;
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.TOTPGenerator = TOTPGenerator;
  globalThis.TOTPManager = TOTPManager;
  globalThis.getTOTPManager = getTOTPManager;
  globalThis.parseOTPAuthURI = parseOTPAuthURI;
  globalThis.generateOTPAuthURI = generateOTPAuthURI;
  globalThis.TOTPConfig = TOTPConfig;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TOTPGenerator,
    TOTPManager,
    getTOTPManager,
    parseOTPAuthURI,
    generateOTPAuthURI,
    TOTPConfig
  };
}
