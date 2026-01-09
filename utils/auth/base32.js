/**
 * Basset Hound Browser Automation - Base32 Encoder/Decoder
 * Phase 10 Security: TOTP Support for Sock Puppet Integration
 *
 * RFC 4648 compliant Base32 encoding/decoding for TOTP secrets.
 * Pure JavaScript implementation compatible with MV3.
 */

// =============================================================================
// Configuration
// =============================================================================

const Base32Config = {
  // Standard Base32 alphabet (RFC 4648)
  alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',

  // Padding character
  padding: '=',

  // Bits per character
  bitsPerChar: 5,

  // Bits per byte
  bitsPerByte: 8
};

// =============================================================================
// Lookup Tables
// =============================================================================

/**
 * Generate decode lookup table from alphabet
 * @private
 * @returns {Object} Character to value mapping
 */
function generateDecodeLookup() {
  const lookup = {};
  for (let i = 0; i < Base32Config.alphabet.length; i++) {
    lookup[Base32Config.alphabet[i]] = i;
    // Also support lowercase
    lookup[Base32Config.alphabet[i].toLowerCase()] = i;
  }
  return lookup;
}

const DecodeLookup = generateDecodeLookup();

// =============================================================================
// Base32 Encoding
// =============================================================================

/**
 * Encode a Uint8Array to Base32 string
 * @param {Uint8Array} bytes - Bytes to encode
 * @param {Object} options - Encoding options
 * @param {boolean} options.padding - Whether to include padding (default: true)
 * @returns {string} Base32 encoded string
 */
function encode(bytes, options = {}) {
  const { padding = true } = options;

  if (!(bytes instanceof Uint8Array)) {
    throw new Error('Input must be a Uint8Array');
  }

  if (bytes.length === 0) {
    return '';
  }

  let result = '';
  let buffer = 0;
  let bitsInBuffer = 0;

  for (let i = 0; i < bytes.length; i++) {
    // Add byte to buffer
    buffer = (buffer << Base32Config.bitsPerByte) | bytes[i];
    bitsInBuffer += Base32Config.bitsPerByte;

    // Extract 5-bit chunks
    while (bitsInBuffer >= Base32Config.bitsPerChar) {
      bitsInBuffer -= Base32Config.bitsPerChar;
      const index = (buffer >> bitsInBuffer) & 0x1f;
      result += Base32Config.alphabet[index];
    }
  }

  // Handle remaining bits
  if (bitsInBuffer > 0) {
    const index = (buffer << (Base32Config.bitsPerChar - bitsInBuffer)) & 0x1f;
    result += Base32Config.alphabet[index];
  }

  // Add padding if required
  if (padding) {
    const paddingLength = (8 - (result.length % 8)) % 8;
    result += Base32Config.padding.repeat(paddingLength);
  }

  return result;
}

/**
 * Encode a string to Base32
 * @param {string} str - String to encode (UTF-8)
 * @returns {string} Base32 encoded string
 */
function encodeString(str) {
  if (typeof str !== 'string') {
    throw new Error('Input must be a string');
  }

  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  return encode(bytes);
}

/**
 * Encode a hex string to Base32
 * @param {string} hex - Hex string to encode
 * @returns {string} Base32 encoded string
 */
function encodeHex(hex) {
  if (typeof hex !== 'string') {
    throw new Error('Input must be a string');
  }

  // Remove any spaces or hyphens
  hex = hex.replace(/[\s-]/g, '');

  if (!/^[a-fA-F0-9]*$/.test(hex)) {
    throw new Error('Invalid hex string');
  }

  if (hex.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }

  return encode(bytes);
}

// =============================================================================
// Base32 Decoding
// =============================================================================

/**
 * Decode a Base32 string to Uint8Array
 * @param {string} encoded - Base32 encoded string
 * @param {Object} options - Decoding options
 * @param {boolean} options.strict - Strict validation mode (default: false)
 * @returns {Uint8Array} Decoded bytes
 */
function decode(encoded, options = {}) {
  const { strict = false } = options;

  if (typeof encoded !== 'string') {
    throw new Error('Input must be a string');
  }

  // Remove whitespace and padding
  let cleaned = encoded.replace(/[\s=]/g, '').toUpperCase();

  if (cleaned.length === 0) {
    return new Uint8Array(0);
  }

  // Validate characters
  for (let i = 0; i < cleaned.length; i++) {
    if (!(cleaned[i] in DecodeLookup)) {
      if (strict) {
        throw new Error(`Invalid Base32 character at position ${i}: ${cleaned[i]}`);
      }
      // In non-strict mode, skip invalid characters
      cleaned = cleaned.slice(0, i) + cleaned.slice(i + 1);
      i--;
    }
  }

  // Calculate output length
  const outputLength = Math.floor((cleaned.length * Base32Config.bitsPerChar) / Base32Config.bitsPerByte);
  const result = new Uint8Array(outputLength);

  let buffer = 0;
  let bitsInBuffer = 0;
  let byteIndex = 0;

  for (let i = 0; i < cleaned.length; i++) {
    const value = DecodeLookup[cleaned[i]];

    // Add 5 bits to buffer
    buffer = (buffer << Base32Config.bitsPerChar) | value;
    bitsInBuffer += Base32Config.bitsPerChar;

    // Extract bytes
    while (bitsInBuffer >= Base32Config.bitsPerByte && byteIndex < outputLength) {
      bitsInBuffer -= Base32Config.bitsPerByte;
      result[byteIndex++] = (buffer >> bitsInBuffer) & 0xff;
    }
  }

  return result;
}

/**
 * Decode a Base32 string to a regular string (UTF-8)
 * @param {string} encoded - Base32 encoded string
 * @returns {string} Decoded string
 */
function decodeString(encoded) {
  const bytes = decode(encoded);
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

/**
 * Decode a Base32 string to hex
 * @param {string} encoded - Base32 encoded string
 * @returns {string} Hex string
 */
function decodeToHex(encoded) {
  const bytes = decode(encoded);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate a Base32 encoded string
 * @param {string} encoded - String to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.requirePadding - Require proper padding (default: false)
 * @returns {Object} Validation result
 */
function validate(encoded, options = {}) {
  const { requirePadding = false } = options;

  const result = {
    valid: false,
    errors: [],
    warnings: [],
    normalized: null,
    byteLength: 0
  };

  if (typeof encoded !== 'string') {
    result.errors.push({
      code: 'INVALID_TYPE',
      message: 'Input must be a string'
    });
    return result;
  }

  if (encoded.length === 0) {
    result.valid = true;
    result.normalized = '';
    return result;
  }

  // Remove whitespace for analysis
  const withoutWhitespace = encoded.replace(/\s/g, '');

  // Check for padding
  const paddingMatch = withoutWhitespace.match(/=+$/);
  const withoutPadding = withoutWhitespace.replace(/=+$/, '');

  // Validate characters (before padding)
  const invalidChars = [];
  for (let i = 0; i < withoutPadding.length; i++) {
    const char = withoutPadding[i].toUpperCase();
    if (!(char in DecodeLookup)) {
      invalidChars.push({ position: i, character: withoutPadding[i] });
    }
  }

  if (invalidChars.length > 0) {
    result.errors.push({
      code: 'INVALID_CHARACTERS',
      message: `Invalid Base32 characters found`,
      characters: invalidChars
    });
  }

  // Validate padding if required
  if (requirePadding) {
    const expectedPaddingLength = (8 - (withoutPadding.length % 8)) % 8;
    const actualPaddingLength = paddingMatch ? paddingMatch[0].length : 0;

    if (actualPaddingLength !== expectedPaddingLength) {
      result.errors.push({
        code: 'INVALID_PADDING',
        message: `Expected ${expectedPaddingLength} padding characters, found ${actualPaddingLength}`
      });
    }
  }

  // Check for lowercase (warning only)
  if (withoutPadding !== withoutPadding.toUpperCase()) {
    result.warnings.push({
      code: 'LOWERCASE_CHARACTERS',
      message: 'Base32 should use uppercase letters'
    });
  }

  if (result.errors.length === 0) {
    result.valid = true;
    result.normalized = withoutPadding.toUpperCase();
    result.byteLength = Math.floor((withoutPadding.length * Base32Config.bitsPerChar) / Base32Config.bitsPerByte);
  }

  return result;
}

/**
 * Normalize a Base32 string (uppercase, no padding, no whitespace)
 * @param {string} encoded - Base32 string to normalize
 * @returns {string} Normalized Base32 string
 */
function normalize(encoded) {
  if (typeof encoded !== 'string') {
    throw new Error('Input must be a string');
  }

  return encoded
    .replace(/\s/g, '')    // Remove whitespace
    .replace(/=+$/, '')    // Remove padding
    .toUpperCase();        // Uppercase
}

// =============================================================================
// TOTP-Specific Helpers
// =============================================================================

/**
 * Check if a string looks like a TOTP secret
 * @param {string} secret - Potential TOTP secret
 * @returns {Object} Analysis result
 */
function analyzeTOTPSecret(secret) {
  const result = {
    isValid: false,
    format: null,
    normalized: null,
    keyLength: 0,
    warnings: [],
    errors: []
  };

  if (typeof secret !== 'string') {
    result.errors.push('Secret must be a string');
    return result;
  }

  // Normalize the input
  const normalized = normalize(secret);

  if (normalized.length === 0) {
    result.errors.push('Secret cannot be empty');
    return result;
  }

  // Validate as Base32
  const validation = validate(normalized);

  if (!validation.valid) {
    result.errors = validation.errors.map(e => e.message);
    return result;
  }

  result.normalized = normalized;
  result.format = 'base32';
  result.keyLength = validation.byteLength;

  // Check key length recommendations
  if (result.keyLength < 10) {
    result.warnings.push('Secret key is shorter than recommended (10+ bytes for HMAC-SHA1)');
  }

  if (result.keyLength < 20 && result.keyLength >= 10) {
    result.warnings.push('Consider using a 20+ byte key for better security');
  }

  // RFC 4226 recommends minimum 128 bits (16 bytes) for shared secret
  if (result.keyLength < 16) {
    result.warnings.push('RFC 4226 recommends at least 128-bit (16 byte) secrets');
  }

  result.isValid = true;

  return result;
}

/**
 * Generate a random TOTP secret
 * @param {Object} options - Generation options
 * @param {number} options.length - Secret length in bytes (default: 20 for SHA1)
 * @returns {Object} Generated secret info
 */
function generateSecret(options = {}) {
  const { length = 20 } = options;

  // Generate random bytes
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  // Encode to Base32
  const base32 = encode(bytes, { padding: false });

  return {
    secret: base32,
    bytes: length,
    bits: length * 8,
    algorithm: length >= 64 ? 'SHA512' : length >= 32 ? 'SHA256' : 'SHA1',
    generatedAt: Date.now()
  };
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.Base32 = {
    encode,
    encodeString,
    encodeHex,
    decode,
    decodeString,
    decodeToHex,
    validate,
    normalize,
    analyzeTOTPSecret,
    generateSecret,
    Config: Base32Config
  };
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    encode,
    encodeString,
    encodeHex,
    decode,
    decodeString,
    decodeToHex,
    validate,
    normalize,
    analyzeTOTPSecret,
    generateSecret,
    Config: Base32Config
  };
}
