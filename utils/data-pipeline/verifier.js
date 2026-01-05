/**
 * Basset Hound Browser Automation - Data Verifier
 * Phase 8.3: Data Verification Before Ingestion
 *
 * Provides client-side verification capabilities for OSINT data:
 * - Email format and domain validation
 * - Phone number parsing and validation
 * - Cryptocurrency address checksum validation
 * - IP address validation
 * - Domain format validation
 * - Disposable email detection
 */

// =============================================================================
// Disposable Email Domains
// =============================================================================

/**
 * Known disposable email domain list
 */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  // Common disposable email providers
  'tempmail.com', 'temp-mail.org', '10minutemail.com', 'guerrillamail.com',
  'mailinator.com', 'throwaway.email', 'fakeinbox.com', 'tempinbox.com',
  'getnada.com', 'mohmal.com', 'sharklasers.com', 'discard.email',
  'yopmail.com', 'trashmail.com', 'mailnesia.com', 'tempail.com',
  'emailondeck.com', 'dropmail.me', 'temporary-mail.net', 'mintemail.com',
  'bouncr.com', 'maildrop.cc', 'tempmailaddress.com', 'throwawaymail.com',
  'disposableemailaddresses.com', 'anonymousemail.me', 'spamgourmet.com',
  'getairmail.com', 'guerrillamailblock.com', 'tempr.email', 'spambox.us',
  'mailcatch.com', 'tempsky.com', 'trashemail.de', 'wegwerfemail.de',
  'emailtemporanea.com', 'fakemailgenerator.com', 'mybx.site'
]);

// =============================================================================
// Validation Patterns
// =============================================================================

/**
 * Validation patterns and rules
 */
const ValidationPatterns = {
  // Email local part: RFC 5321 simplified
  emailLocal: /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.-]+$/,

  // Email domain: simplified DNS label rules
  emailDomain: /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/,

  // Top-level domains (common)
  validTLDs: new Set([
    'com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'io', 'co', 'me',
    'info', 'biz', 'name', 'mobi', 'pro', 'aero', 'coop', 'museum',
    'uk', 'de', 'fr', 'es', 'it', 'nl', 'be', 'ch', 'at', 'au', 'ca',
    'jp', 'cn', 'kr', 'in', 'ru', 'br', 'mx', 'za', 'nz', 'se', 'no',
    'dk', 'fi', 'pl', 'pt', 'ie', 'gr', 'cz', 'hu', 'ro', 'bg', 'sk',
    'hr', 'si', 'rs', 'ua', 'by', 'kz', 'tr', 'il', 'ae', 'sa', 'eg',
    'ng', 'ke', 'gh', 'tz', 'ug', 'rw', 'et', 'ma', 'dz', 'tn', 'ly'
  ]),

  // IPv4 octet range
  ipv4Octet: /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
};

// =============================================================================
// DataVerifier Class
// =============================================================================

/**
 * Data Verifier
 * Provides client-side validation for OSINT data before ingestion
 */
class DataVerifier {
  /**
   * Create a new DataVerifier
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {boolean} options.strictMode - Enable strict validation (default: false)
   */
  constructor(options = {}) {
    this.config = {
      logger: options.logger || null,
      strictMode: options.strictMode || false
    };

    this.stats = {
      totalVerifications: 0,
      passed: 0,
      failed: 0,
      byType: {}
    };
  }

  /**
   * Verify data based on its type
   * @param {string} type - Data type (email, phone, crypto, etc.)
   * @param {string} value - Value to verify
   * @param {Object} options - Verification options
   * @returns {Object} Verification result
   */
  async verify(type, value, options = {}) {
    this.stats.totalVerifications++;

    if (!type || !value) {
      return this._createResult(false, 'INVALID_INPUT', 'Type and value are required');
    }

    const normalizedType = type.toLowerCase().replace(/_/g, '');
    let result;

    switch (normalizedType) {
      case 'email':
        result = await this.verifyEmail(value, options);
        break;
      case 'phone':
        result = await this.verifyPhone(value, options);
        break;
      case 'cryptoaddress':
      case 'crypto':
        result = await this.verifyCrypto(value, options);
        break;
      case 'ipaddress':
      case 'ip':
        result = await this.verifyIP(value, options);
        break;
      case 'domain':
        result = await this.verifyDomain(value, options);
        break;
      case 'url':
        result = await this.verifyURL(value, options);
        break;
      case 'username':
        result = await this.verifyUsername(value, options);
        break;
      default:
        result = this._createResult(true, 'UNKNOWN_TYPE', 'Type not validated, assuming valid');
        result.warnings = [{ code: 'NO_VALIDATOR', message: `No specific validator for type: ${type}` }];
    }

    // Update stats
    if (result.plausible) {
      this.stats.passed++;
    } else {
      this.stats.failed++;
    }
    this.stats.byType[type] = this.stats.byType[type] || { passed: 0, failed: 0 };
    this.stats.byType[type][result.plausible ? 'passed' : 'failed']++;

    return result;
  }

  /**
   * Verify an email address
   * @param {string} email - Email to verify
   * @param {Object} options - Verification options
   * @returns {Object} Verification result
   */
  async verifyEmail(email, options = {}) {
    const result = {
      plausible: false,
      valid: false,
      checks: {
        formatValid: false,
        domainValid: false,
        disposable: false,
        hasValidTLD: false
      },
      normalized: null,
      suggestions: [],
      errors: [],
      warnings: [],
      needsServerVerification: true
    };

    if (!email || typeof email !== 'string') {
      result.errors.push({ code: 'INVALID_INPUT', message: 'Email must be a non-empty string' });
      return result;
    }

    const trimmed = email.trim().toLowerCase();

    // Check for @ symbol
    if (!trimmed.includes('@')) {
      result.errors.push({ code: 'NO_AT_SYMBOL', message: 'Email must contain @ symbol' });
      return result;
    }

    const atIndex = trimmed.lastIndexOf('@');
    const localPart = trimmed.slice(0, atIndex);
    const domain = trimmed.slice(atIndex + 1);

    // Validate local part
    if (!localPart || localPart.length > 64) {
      result.errors.push({ code: 'INVALID_LOCAL', message: 'Local part is empty or too long' });
      return result;
    }

    // Check for consecutive dots
    if (localPart.includes('..') || localPart.startsWith('.') || localPart.endsWith('.')) {
      result.errors.push({ code: 'INVALID_DOTS', message: 'Invalid dot placement in local part' });
      return result;
    }

    result.checks.formatValid = true;

    // Validate domain
    if (!domain || domain.length > 255) {
      result.errors.push({ code: 'INVALID_DOMAIN', message: 'Domain is empty or too long' });
      return result;
    }

    const domainParts = domain.split('.');
    if (domainParts.length < 2) {
      result.errors.push({ code: 'NO_TLD', message: 'Domain must have at least one dot' });
      return result;
    }

    // Check TLD
    const tld = domainParts[domainParts.length - 1];
    result.checks.hasValidTLD = tld.length >= 2;

    // Validate domain format
    result.checks.domainValid = ValidationPatterns.emailDomain.test(domain);

    // Check for disposable email
    result.checks.disposable = this.isDisposableEmail(trimmed);
    if (result.checks.disposable) {
      result.warnings.push({ code: 'DISPOSABLE', message: 'This appears to be a disposable email address' });
    }

    // Check for common typos
    const commonTypos = {
      'gmial.com': 'gmail.com',
      'gmal.com': 'gmail.com',
      'gamil.com': 'gmail.com',
      'gmali.com': 'gmail.com',
      'gmaill.com': 'gmail.com',
      'hotmal.com': 'hotmail.com',
      'hotmai.com': 'hotmail.com',
      'outloo.com': 'outlook.com',
      'outlok.com': 'outlook.com',
      'yaho.com': 'yahoo.com',
      'yahooo.com': 'yahoo.com'
    };

    if (commonTypos[domain]) {
      result.suggestions.push({
        type: 'typo_correction',
        original: domain,
        suggested: commonTypos[domain],
        confidence: 0.9
      });
      result.warnings.push({
        code: 'POSSIBLE_TYPO',
        message: `Domain '${domain}' may be a typo for '${commonTypos[domain]}'`
      });
    }

    // Set final results
    result.normalized = trimmed;
    result.plausible = result.checks.formatValid && result.checks.domainValid && result.checks.hasValidTLD;
    result.valid = result.plausible && !result.checks.disposable;

    return result;
  }

  /**
   * Verify a phone number
   * @param {string} phone - Phone number to verify
   * @param {Object} options - Verification options
   * @returns {Object} Verification result
   */
  async verifyPhone(phone, options = {}) {
    const { countryHint = null } = options;

    const result = {
      plausible: false,
      valid: false,
      checks: {
        hasDigits: false,
        validLength: false,
        possibleCountry: null
      },
      normalized: null,
      formatted: null,
      country: null,
      type: null,
      errors: [],
      warnings: [],
      needsServerVerification: true
    };

    if (!phone || typeof phone !== 'string') {
      result.errors.push({ code: 'INVALID_INPUT', message: 'Phone must be a non-empty string' });
      return result;
    }

    // Extract digits
    const digits = phone.replace(/\D/g, '');
    result.checks.hasDigits = digits.length > 0;

    if (digits.length < 7) {
      result.errors.push({ code: 'TOO_SHORT', message: 'Phone number is too short' });
      return result;
    }

    if (digits.length > 15) {
      result.errors.push({ code: 'TOO_LONG', message: 'Phone number is too long' });
      return result;
    }

    result.checks.validLength = true;

    // Try to detect country
    const countryPatterns = [
      { code: 'US', prefix: '1', length: [10, 11], format: (d) => `+1 (${d.slice(-10, -7)}) ${d.slice(-7, -4)}-${d.slice(-4)}` },
      { code: 'UK', prefix: '44', length: [11, 12], format: (d) => `+44 ${d.slice(-10)}` },
      { code: 'DE', prefix: '49', length: [11, 12, 13], format: (d) => `+49 ${d.slice(-11)}` },
      { code: 'FR', prefix: '33', length: [11], format: (d) => `+33 ${d.slice(-9)}` },
      { code: 'AU', prefix: '61', length: [11], format: (d) => `+61 ${d.slice(-9)}` },
      { code: 'IN', prefix: '91', length: [12], format: (d) => `+91 ${d.slice(-10)}` },
      { code: 'CN', prefix: '86', length: [13], format: (d) => `+86 ${d.slice(-11)}` }
    ];

    // Check if starts with country code
    for (const country of countryPatterns) {
      if (digits.startsWith(country.prefix) && country.length.includes(digits.length)) {
        result.checks.possibleCountry = country.code;
        result.country = country.code;
        result.formatted = country.format(digits);
        break;
      }
    }

    // Default to US format if 10 digits
    if (!result.country && digits.length === 10) {
      result.checks.possibleCountry = countryHint || 'US';
      result.country = countryHint || 'US';
      result.formatted = `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    // Build E.164 format
    if (result.country) {
      const countryInfo = countryPatterns.find(c => c.code === result.country);
      if (countryInfo) {
        result.normalized = `+${digits.startsWith(countryInfo.prefix) ? digits : countryInfo.prefix + digits.slice(-10)}`;
      }
    } else {
      result.normalized = `+${digits}`;
    }

    result.plausible = result.checks.validLength;
    result.valid = result.plausible && result.country !== null;

    return result;
  }

  /**
   * Verify a cryptocurrency address
   * @param {string} address - Crypto address to verify
   * @param {Object} options - Verification options
   * @returns {Object} Verification result
   */
  async verifyCrypto(address, options = {}) {
    const { coinHint = null } = options;

    const result = {
      plausible: false,
      valid: false,
      checks: {
        formatValid: false,
        checksumValid: null,
        lengthValid: false
      },
      coin: null,
      network: null,
      explorer: null,
      errors: [],
      warnings: [],
      needsServerVerification: true
    };

    if (!address || typeof address !== 'string') {
      result.errors.push({ code: 'INVALID_INPUT', message: 'Address must be a non-empty string' });
      return result;
    }

    const trimmed = address.trim();

    // Bitcoin patterns
    if (trimmed.match(/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/)) {
      result.coin = 'Bitcoin';
      result.checks.formatValid = true;

      if (trimmed.startsWith('bc1')) {
        // Bech32 address
        result.network = 'mainnet';
        result.checks.lengthValid = trimmed.length >= 42 && trimmed.length <= 62;
        result.checks.checksumValid = this._verifyBech32Checksum(trimmed);
      } else {
        // Legacy address
        result.network = trimmed.startsWith('3') ? 'mainnet (P2SH)' : 'mainnet (P2PKH)';
        result.checks.lengthValid = trimmed.length >= 26 && trimmed.length <= 35;
        result.checks.checksumValid = this._verifyBase58Checksum(trimmed);
      }

      result.explorer = `https://blockstream.info/address/${trimmed}`;
    }

    // Ethereum pattern
    else if (trimmed.match(/^0x[a-fA-F0-9]{40}$/)) {
      result.coin = 'Ethereum';
      result.checks.formatValid = true;
      result.checks.lengthValid = trimmed.length === 42;
      result.network = 'mainnet';

      // EIP-55 checksum validation
      result.checks.checksumValid = this._verifyEthereumChecksum(trimmed);

      result.explorer = `https://etherscan.io/address/${trimmed}`;
    }

    // Litecoin pattern
    else if (trimmed.match(/^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/)) {
      result.coin = 'Litecoin';
      result.checks.formatValid = true;
      result.checks.lengthValid = trimmed.length >= 26 && trimmed.length <= 34;
      result.network = 'mainnet';
      result.explorer = `https://blockchair.com/litecoin/address/${trimmed}`;
    }

    // XRP pattern
    else if (trimmed.match(/^r[0-9a-zA-Z]{24,34}$/)) {
      result.coin = 'Ripple';
      result.checks.formatValid = true;
      result.checks.lengthValid = trimmed.length >= 25 && trimmed.length <= 35;
      result.explorer = `https://xrpscan.com/account/${trimmed}`;
    }

    // Unknown format
    else {
      result.errors.push({ code: 'UNKNOWN_FORMAT', message: 'Unrecognized cryptocurrency address format' });
      return result;
    }

    result.plausible = result.checks.formatValid && result.checks.lengthValid;
    result.valid = result.plausible && (result.checks.checksumValid === true || result.checks.checksumValid === null);

    return result;
  }

  /**
   * Verify an IP address
   * @param {string} ip - IP address to verify
   * @param {Object} options - Verification options
   * @returns {Object} Verification result
   */
  async verifyIP(ip, options = {}) {
    const result = {
      plausible: false,
      valid: false,
      checks: {
        formatValid: false,
        isPrivate: false,
        isReserved: false,
        isLoopback: false
      },
      version: null,
      normalized: null,
      errors: [],
      warnings: [],
      needsServerVerification: false
    };

    if (!ip || typeof ip !== 'string') {
      result.errors.push({ code: 'INVALID_INPUT', message: 'IP must be a non-empty string' });
      return result;
    }

    const trimmed = ip.trim();

    // IPv4 validation
    if (trimmed.match(/^(\d{1,3}\.){3}\d{1,3}$/)) {
      const octets = trimmed.split('.');
      const validOctets = octets.every(o => {
        const num = parseInt(o, 10);
        return num >= 0 && num <= 255;
      });

      if (validOctets) {
        result.version = 4;
        result.checks.formatValid = true;
        result.normalized = octets.map(o => parseInt(o, 10)).join('.');

        const first = parseInt(octets[0], 10);
        const second = parseInt(octets[1], 10);

        // Check private ranges
        result.checks.isPrivate =
          first === 10 ||
          (first === 172 && second >= 16 && second <= 31) ||
          (first === 192 && second === 168);

        // Check loopback
        result.checks.isLoopback = first === 127;

        // Check reserved ranges
        result.checks.isReserved =
          first === 0 ||
          first >= 224 ||
          (first === 169 && second === 254);

        if (result.checks.isPrivate) {
          result.warnings.push({ code: 'PRIVATE_IP', message: 'This is a private IP address' });
        }
        if (result.checks.isLoopback) {
          result.warnings.push({ code: 'LOOPBACK', message: 'This is a loopback address' });
        }
      }
    }

    // IPv6 validation (simplified)
    else if (trimmed.includes(':')) {
      // Basic IPv6 check
      const parts = trimmed.split(':');
      if (parts.length >= 2 && parts.length <= 8) {
        result.version = 6;
        result.checks.formatValid = true;
        result.normalized = trimmed.toLowerCase();

        // Check loopback
        result.checks.isLoopback = trimmed === '::1';
      }
    }

    if (!result.checks.formatValid) {
      result.errors.push({ code: 'INVALID_FORMAT', message: 'Invalid IP address format' });
    }

    result.plausible = result.checks.formatValid;
    result.valid = result.plausible && !result.checks.isReserved;

    return result;
  }

  /**
   * Verify a domain name
   * @param {string} domain - Domain to verify
   * @param {Object} options - Verification options
   * @returns {Object} Verification result
   */
  async verifyDomain(domain, options = {}) {
    const result = {
      plausible: false,
      valid: false,
      checks: {
        formatValid: false,
        hasValidTLD: false,
        validLength: false
      },
      tld: null,
      normalized: null,
      errors: [],
      warnings: [],
      needsServerVerification: true
    };

    if (!domain || typeof domain !== 'string') {
      result.errors.push({ code: 'INVALID_INPUT', message: 'Domain must be a non-empty string' });
      return result;
    }

    // Remove protocol and path
    let cleaned = domain.trim().toLowerCase();
    cleaned = cleaned.replace(/^https?:\/\//i, '');
    cleaned = cleaned.replace(/^www\./i, '');
    cleaned = cleaned.split('/')[0];
    cleaned = cleaned.split('?')[0];

    if (cleaned.length > 253) {
      result.errors.push({ code: 'TOO_LONG', message: 'Domain is too long' });
      return result;
    }

    result.checks.validLength = cleaned.length >= 3;

    const parts = cleaned.split('.');
    if (parts.length < 2) {
      result.errors.push({ code: 'NO_TLD', message: 'Domain must have at least one dot' });
      return result;
    }

    result.tld = parts[parts.length - 1];
    result.checks.hasValidTLD = result.tld.length >= 2;

    // Validate domain format
    const isValid = parts.every(part => {
      if (part.length === 0 || part.length > 63) return false;
      if (part.startsWith('-') || part.endsWith('-')) return false;
      return /^[a-z0-9-]+$/.test(part);
    });

    result.checks.formatValid = isValid;
    result.normalized = cleaned;

    result.plausible = result.checks.formatValid && result.checks.hasValidTLD && result.checks.validLength;
    result.valid = result.plausible;

    return result;
  }

  /**
   * Verify a URL
   * @param {string} url - URL to verify
   * @param {Object} options - Verification options
   * @returns {Object} Verification result
   */
  async verifyURL(url, options = {}) {
    const result = {
      plausible: false,
      valid: false,
      checks: {
        hasProtocol: false,
        hasDomain: false,
        validFormat: false
      },
      protocol: null,
      domain: null,
      path: null,
      errors: [],
      warnings: [],
      needsServerVerification: false
    };

    if (!url || typeof url !== 'string') {
      result.errors.push({ code: 'INVALID_INPUT', message: 'URL must be a non-empty string' });
      return result;
    }

    try {
      const parsed = new URL(url);
      result.checks.hasProtocol = ['http:', 'https:'].includes(parsed.protocol);
      result.checks.hasDomain = parsed.hostname.length > 0;
      result.checks.validFormat = true;
      result.protocol = parsed.protocol;
      result.domain = parsed.hostname;
      result.path = parsed.pathname;

      if (!result.checks.hasProtocol) {
        result.warnings.push({ code: 'UNUSUAL_PROTOCOL', message: `Unusual protocol: ${parsed.protocol}` });
      }
    } catch {
      result.errors.push({ code: 'INVALID_URL', message: 'Invalid URL format' });
      return result;
    }

    result.plausible = result.checks.validFormat && result.checks.hasDomain;
    result.valid = result.plausible && result.checks.hasProtocol;

    return result;
  }

  /**
   * Verify a username/handle
   * @param {string} username - Username to verify
   * @param {Object} options - Verification options
   * @returns {Object} Verification result
   */
  async verifyUsername(username, options = {}) {
    const { platform = null } = options;

    const result = {
      plausible: false,
      valid: false,
      checks: {
        formatValid: false,
        validLength: false
      },
      normalized: null,
      platform: platform,
      errors: [],
      warnings: [],
      needsServerVerification: true
    };

    if (!username || typeof username !== 'string') {
      result.errors.push({ code: 'INVALID_INPUT', message: 'Username must be a non-empty string' });
      return result;
    }

    let cleaned = username.trim();
    if (cleaned.startsWith('@')) {
      cleaned = cleaned.slice(1);
    }

    // Platform-specific validation
    const platformRules = {
      twitter: { minLength: 1, maxLength: 15, pattern: /^[a-zA-Z0-9_]+$/ },
      instagram: { minLength: 1, maxLength: 30, pattern: /^[a-zA-Z0-9_.]+$/ },
      github: { minLength: 1, maxLength: 39, pattern: /^[a-zA-Z0-9-]+$/ },
      default: { minLength: 1, maxLength: 50, pattern: /^[a-zA-Z0-9_.-]+$/ }
    };

    const rules = platformRules[platform] || platformRules.default;

    result.checks.validLength = cleaned.length >= rules.minLength && cleaned.length <= rules.maxLength;
    result.checks.formatValid = rules.pattern.test(cleaned);
    result.normalized = cleaned;

    result.plausible = result.checks.formatValid && result.checks.validLength;
    result.valid = result.plausible;

    return result;
  }

  /**
   * Check if email is from a disposable domain
   * @param {string} email - Email to check
   * @returns {boolean} True if disposable
   */
  isDisposableEmail(email) {
    const domain = email.split('@')[1]?.toLowerCase();
    return DISPOSABLE_EMAIL_DOMAINS.has(domain);
  }

  /**
   * Get verification statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalVerifications: 0,
      passed: 0,
      failed: 0,
      byType: {}
    };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Create a standard result object
   * @private
   */
  _createResult(plausible, code, message) {
    return {
      plausible,
      valid: plausible,
      checks: {},
      errors: plausible ? [] : [{ code, message }],
      warnings: [],
      needsServerVerification: false
    };
  }

  /**
   * Verify Bech32 checksum (simplified)
   * @private
   */
  _verifyBech32Checksum(address) {
    // Simplified validation - full implementation requires bech32 library
    const validChars = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    const data = address.toLowerCase().slice(4);
    return data.split('').every(c => validChars.includes(c));
  }

  /**
   * Verify Base58Check checksum (simplified)
   * @private
   */
  _verifyBase58Checksum(address) {
    // Simplified validation - full implementation requires crypto libraries
    const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    return address.split('').every(c => base58Chars.includes(c));
  }

  /**
   * Verify Ethereum EIP-55 checksum (simplified)
   * @private
   */
  _verifyEthereumChecksum(address) {
    // Simplified - full implementation requires keccak256
    // Returns null to indicate we can't verify without crypto library
    return null;
  }
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.DataVerifier = DataVerifier;
  globalThis.DISPOSABLE_EMAIL_DOMAINS = DISPOSABLE_EMAIL_DOMAINS;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DataVerifier,
    DISPOSABLE_EMAIL_DOMAINS
  };
}
