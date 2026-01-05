/**
 * Basset Hound Browser Automation - OSINT Field Detector
 * Phase 8.1: Auto-Detection for OSINT Data
 *
 * Provides automatic detection of OSINT-relevant data on web pages:
 * - Email addresses
 * - Phone numbers
 * - Cryptocurrency addresses (Bitcoin, Ethereum, Litecoin, etc.)
 * - IP addresses (v4 and v6)
 * - Domain names
 * - Usernames/handles
 * - SSN patterns
 * - Credit card patterns (masked)
 * - MAC addresses
 * - IMEI numbers
 */

// =============================================================================
// OSINT Pattern Definitions
// =============================================================================

/**
 * Comprehensive OSINT pattern library with confidence scores
 */
const OSINTPatterns = {
  // Email patterns
  email: {
    pattern: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
    confidence: 0.95,
    validate: (match) => {
      // Additional validation
      const parts = match.split('@');
      if (parts.length !== 2) return false;
      if (parts[0].length < 1 || parts[1].length < 4) return false;
      if (!parts[1].includes('.')) return false;
      return true;
    }
  },

  // Phone number patterns (international formats)
  phone: {
    pattern: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
    confidence: 0.85,
    validate: (match) => {
      const digits = match.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 15;
    }
  },

  phone_intl: {
    pattern: /\+[1-9]\d{1,14}\b/g,
    confidence: 0.90,
    validate: (match) => {
      const digits = match.replace(/\D/g, '');
      return digits.length >= 7 && digits.length <= 15;
    }
  },

  // Cryptocurrency addresses
  crypto_btc: {
    pattern: /\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b/g,
    confidence: 0.95,
    type: 'Bitcoin',
    validate: (match) => {
      // Basic validation for Bitcoin addresses
      if (match.startsWith('bc1')) return match.length >= 42 && match.length <= 62;
      if (match.startsWith('1') || match.startsWith('3')) return match.length >= 26 && match.length <= 35;
      return false;
    }
  },

  crypto_eth: {
    pattern: /\b0x[a-fA-F0-9]{40}\b/g,
    confidence: 0.95,
    type: 'Ethereum',
    validate: (match) => match.length === 42
  },

  crypto_ltc: {
    pattern: /\b[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}\b/g,
    confidence: 0.85,
    type: 'Litecoin',
    validate: (match) => match.length >= 27 && match.length <= 34
  },

  crypto_xrp: {
    pattern: /\br[0-9a-zA-Z]{24,34}\b/g,
    confidence: 0.80,
    type: 'Ripple',
    validate: (match) => match.length >= 25 && match.length <= 35
  },

  crypto_doge: {
    pattern: /\bD[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}\b/g,
    confidence: 0.85,
    type: 'Dogecoin',
    validate: () => true
  },

  crypto_bch: {
    pattern: /\b(bitcoincash:)?[qp][a-z0-9]{41}\b/gi,
    confidence: 0.85,
    type: 'Bitcoin Cash',
    validate: () => true
  },

  crypto_sol: {
    pattern: /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g,
    confidence: 0.70,
    type: 'Solana',
    validate: (match) => match.length >= 32 && match.length <= 44
  },

  // IP addresses
  ip_v4: {
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    confidence: 0.95,
    validate: (match) => {
      const parts = match.split('.');
      return parts.every(p => {
        const num = parseInt(p, 10);
        return num >= 0 && num <= 255;
      });
    }
  },

  ip_v6: {
    pattern: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
    confidence: 0.90,
    validate: () => true
  },

  ip_v6_compressed: {
    pattern: /\b(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}|:(?::[0-9a-fA-F]{1,4}){1,7}|::(?:ffff(?::0{1,4})?:)?(?:(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9])\.){3}(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9])\b/g,
    confidence: 0.85,
    validate: () => true
  },

  // Domain names
  domain: {
    pattern: /\b(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/g,
    confidence: 0.85,
    validate: (match) => {
      const cleaned = match.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
      return cleaned.length >= 4 && cleaned.includes('.');
    }
  },

  // Social media usernames
  username_twitter: {
    pattern: /@[a-zA-Z0-9_]{1,15}\b/g,
    confidence: 0.75,
    platform: 'twitter',
    validate: (match) => {
      const name = match.replace('@', '');
      return name.length >= 1 && name.length <= 15;
    }
  },

  username_instagram: {
    pattern: /@[a-zA-Z0-9_.]{1,30}\b/g,
    confidence: 0.70,
    platform: 'instagram',
    validate: (match) => {
      const name = match.replace('@', '');
      return name.length >= 1 && name.length <= 30;
    }
  },

  // US Social Security Number (masked pattern for detection, not capture)
  ssn: {
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    confidence: 0.80,
    sensitive: true,
    validate: (match) => {
      const digits = match.replace(/\D/g, '');
      if (digits.length !== 9) return false;
      // Invalid SSNs
      if (digits.startsWith('000') || digits.startsWith('666')) return false;
      if (digits.substring(0, 3) === '900' && parseInt(digits.substring(0, 3)) <= 999) return false;
      return true;
    }
  },

  // Credit card patterns (masked detection)
  credit_card: {
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g,
    confidence: 0.90,
    sensitive: true,
    validate: (match) => {
      // Luhn algorithm check
      const digits = match.replace(/\D/g, '');
      let sum = 0;
      let isEven = false;
      for (let i = digits.length - 1; i >= 0; i--) {
        let digit = parseInt(digits[i], 10);
        if (isEven) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        sum += digit;
        isEven = !isEven;
      }
      return sum % 10 === 0;
    }
  },

  // MAC address
  mac_address: {
    pattern: /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g,
    confidence: 0.95,
    validate: () => true
  },

  // IMEI number
  imei: {
    pattern: /\b\d{15}\b/g,
    confidence: 0.60,
    validate: (match) => {
      // Luhn check for IMEI
      if (match.length !== 15) return false;
      let sum = 0;
      for (let i = 0; i < 14; i++) {
        let digit = parseInt(match[i], 10);
        if (i % 2 === 1) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        sum += digit;
      }
      const checkDigit = (10 - (sum % 10)) % 10;
      return checkDigit === parseInt(match[14], 10);
    }
  },

  // URL patterns
  url: {
    pattern: /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
    confidence: 0.95,
    validate: () => true
  },

  // Bitcoin transaction hash
  btc_txid: {
    pattern: /\b[a-fA-F0-9]{64}\b/g,
    confidence: 0.70,
    type: 'Bitcoin TXID',
    validate: (match) => match.length === 64
  }
};

// =============================================================================
// Identifier Type Mapping
// =============================================================================

/**
 * Map pattern types to basset-hound identifier types
 */
const IdentifierTypeMapping = {
  email: 'EMAIL',
  phone: 'PHONE',
  phone_intl: 'PHONE',
  crypto_btc: 'CRYPTO_ADDRESS',
  crypto_eth: 'CRYPTO_ADDRESS',
  crypto_ltc: 'CRYPTO_ADDRESS',
  crypto_xrp: 'CRYPTO_ADDRESS',
  crypto_doge: 'CRYPTO_ADDRESS',
  crypto_bch: 'CRYPTO_ADDRESS',
  crypto_sol: 'CRYPTO_ADDRESS',
  ip_v4: 'IP_ADDRESS',
  ip_v6: 'IP_ADDRESS',
  ip_v6_compressed: 'IP_ADDRESS',
  domain: 'DOMAIN',
  username_twitter: 'USERNAME',
  username_instagram: 'USERNAME',
  ssn: 'SSN',
  credit_card: 'ACCOUNT_NUMBER',
  mac_address: 'MAC_ADDRESS',
  imei: 'IMEI',
  url: 'URL',
  btc_txid: 'CRYPTO_ADDRESS'
};

// =============================================================================
// OSINTFieldDetector Class
// =============================================================================

/**
 * OSINT Field Detector
 * Automatically detects OSINT-relevant data on web pages
 */
class OSINTFieldDetector {
  /**
   * Create a new OSINTFieldDetector
   * @param {Object} options - Configuration options
   * @param {number} options.contextLength - Characters of context to capture (default: 50)
   * @param {boolean} options.highlightEnabled - Enable visual highlighting (default: false)
   * @param {Array<string>} options.enabledTypes - Types to detect (default: all)
   * @param {boolean} options.excludeSensitive - Exclude sensitive data types (default: false)
   * @param {Object} options.logger - Logger instance
   */
  constructor(options = {}) {
    this.config = {
      contextLength: options.contextLength || 50,
      highlightEnabled: options.highlightEnabled || false,
      enabledTypes: options.enabledTypes || Object.keys(OSINTPatterns),
      excludeSensitive: options.excludeSensitive || false,
      logger: options.logger || null
    };

    this.findings = [];
    this.highlights = [];
    this.stats = {
      totalScans: 0,
      totalFindings: 0,
      findingsByType: {}
    };
  }

  /**
   * Detect all OSINT data in provided text
   * @param {string} text - Text to scan
   * @param {Object} options - Detection options
   * @returns {Array<Object>} Array of findings
   */
  detectAll(text, options = {}) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    this.stats.totalScans++;
    const findings = [];
    const seenValues = new Set();

    // Get enabled pattern types
    const enabledTypes = options.types || this.config.enabledTypes;

    for (const [patternType, patternConfig] of Object.entries(OSINTPatterns)) {
      // Skip if not enabled
      if (!enabledTypes.includes(patternType)) continue;

      // Skip sensitive types if configured
      if (this.config.excludeSensitive && patternConfig.sensitive) continue;

      // Find all matches
      const pattern = new RegExp(patternConfig.pattern.source, patternConfig.pattern.flags);
      let match;

      while ((match = pattern.exec(text)) !== null) {
        const value = match[0];

        // Skip duplicates
        if (seenValues.has(value)) continue;

        // Validate match
        if (patternConfig.validate && !patternConfig.validate(value)) continue;

        seenValues.add(value);

        // Extract context
        const contextStart = Math.max(0, match.index - this.config.contextLength);
        const contextEnd = Math.min(text.length, match.index + value.length + this.config.contextLength);
        const context = text.slice(contextStart, contextEnd);

        const finding = {
          type: patternType,
          identifierType: IdentifierTypeMapping[patternType] || 'OTHER',
          value,
          confidence: patternConfig.confidence,
          position: match.index,
          length: value.length,
          context: context.trim(),
          metadata: {}
        };

        // Add type-specific metadata
        if (patternConfig.type) {
          finding.metadata.subtype = patternConfig.type;
        }
        if (patternConfig.platform) {
          finding.metadata.platform = patternConfig.platform;
        }
        if (patternConfig.sensitive) {
          finding.metadata.sensitive = true;
        }

        findings.push(finding);
      }
    }

    // Update stats
    this.stats.totalFindings += findings.length;
    for (const finding of findings) {
      this.stats.findingsByType[finding.type] = (this.stats.findingsByType[finding.type] || 0) + 1;
    }

    this.findings = findings;
    return findings;
  }

  /**
   * Detect OSINT data on the current page
   * @param {Object} options - Detection options
   * @returns {Array<Object>} Array of findings
   */
  detectOnPage(options = {}) {
    const text = document.body?.innerText || '';
    const findings = this.detectAll(text, options);

    // Enhance findings with element information
    for (const finding of findings) {
      const element = this._findElementContaining(finding.value);
      if (element) {
        finding.element = {
          tagName: element.tagName,
          id: element.id || null,
          className: element.className || null,
          selector: this._generateSelector(element)
        };
      }
    }

    return findings;
  }

  /**
   * Highlight detected findings on the page
   * @param {Array<Object>} findings - Findings to highlight (default: use last detection)
   * @param {Object} options - Highlight options
   * @returns {Object} Highlight result
   */
  highlightOnPage(findings = null, options = {}) {
    const {
      color = 'rgba(255, 193, 7, 0.3)',
      borderColor = '#ffc107',
      className = 'basset-osint-highlight'
    } = options;

    // Clear existing highlights
    this.clearHighlights();

    const findingsToHighlight = findings || this.findings;
    const highlighted = [];

    for (const finding of findingsToHighlight) {
      const element = finding.element?.selector
        ? document.querySelector(finding.element.selector)
        : this._findElementContaining(finding.value);

      if (element) {
        // Create highlight overlay
        const overlay = document.createElement('div');
        overlay.className = className;
        overlay.dataset.osintType = finding.type;
        overlay.dataset.osintValue = finding.value;

        const rect = element.getBoundingClientRect();
        overlay.style.cssText = `
          position: fixed;
          top: ${rect.top}px;
          left: ${rect.left}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
          background: ${color};
          border: 2px solid ${borderColor};
          pointer-events: none;
          z-index: 999998;
          transition: opacity 0.2s;
        `;

        document.body.appendChild(overlay);
        this.highlights.push(overlay);
        highlighted.push(finding);
      }
    }

    return {
      success: true,
      highlightedCount: highlighted.length,
      totalFindings: findingsToHighlight.length
    };
  }

  /**
   * Clear all highlights from the page
   */
  clearHighlights() {
    for (const highlight of this.highlights) {
      highlight.remove();
    }
    this.highlights = [];
  }

  /**
   * Get findings grouped by type
   * @param {Array<Object>} findings - Findings to group (default: use last detection)
   * @returns {Object} Findings grouped by type
   */
  getGroupedFindings(findings = null) {
    const toGroup = findings || this.findings;
    const grouped = {};

    for (const finding of toGroup) {
      if (!grouped[finding.identifierType]) {
        grouped[finding.identifierType] = [];
      }
      grouped[finding.identifierType].push(finding);
    }

    return grouped;
  }

  /**
   * Get summary statistics for findings
   * @param {Array<Object>} findings - Findings to summarize (default: use last detection)
   * @returns {Object} Summary statistics
   */
  getSummary(findings = null) {
    const toSummarize = findings || this.findings;
    const byType = {};
    const byIdentifierType = {};

    for (const finding of toSummarize) {
      byType[finding.type] = (byType[finding.type] || 0) + 1;
      byIdentifierType[finding.identifierType] = (byIdentifierType[finding.identifierType] || 0) + 1;
    }

    return {
      total: toSummarize.length,
      byType,
      byIdentifierType,
      hasSensitive: toSummarize.some(f => f.metadata?.sensitive),
      highConfidence: toSummarize.filter(f => f.confidence >= 0.9).length,
      mediumConfidence: toSummarize.filter(f => f.confidence >= 0.7 && f.confidence < 0.9).length,
      lowConfidence: toSummarize.filter(f => f.confidence < 0.7).length
    };
  }

  /**
   * Get overall detection statistics
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
      totalScans: 0,
      totalFindings: 0,
      findingsByType: {}
    };
  }

  /**
   * Add a custom pattern
   * @param {string} name - Pattern name
   * @param {Object} config - Pattern configuration
   */
  addPattern(name, config) {
    if (!config.pattern || !(config.pattern instanceof RegExp)) {
      throw new Error('Pattern must be a RegExp');
    }

    OSINTPatterns[name] = {
      pattern: config.pattern,
      confidence: config.confidence || 0.5,
      validate: config.validate || (() => true),
      ...config
    };

    if (!IdentifierTypeMapping[name]) {
      IdentifierTypeMapping[name] = config.identifierType || 'OTHER';
    }

    if (!this.config.enabledTypes.includes(name)) {
      this.config.enabledTypes.push(name);
    }
  }

  /**
   * Remove a custom pattern
   * @param {string} name - Pattern name
   */
  removePattern(name) {
    delete OSINTPatterns[name];
    delete IdentifierTypeMapping[name];
    this.config.enabledTypes = this.config.enabledTypes.filter(t => t !== name);
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Find the DOM element containing a specific text value
   * @private
   */
  _findElementContaining(value) {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (node.textContent.includes(value)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    const node = walker.nextNode();
    return node?.parentElement || null;
  }

  /**
   * Generate a unique CSS selector for an element
   * @private
   */
  _generateSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }

    const path = [];
    let current = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).slice(0, 2).join('.');
        if (classes) {
          selector += '.' + classes;
        }
      }

      // Add nth-child if needed for uniqueness
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          el => el.tagName === current.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-child(${index})`;
        }
      }

      path.unshift(selector);
      current = parent;
    }

    return path.join(' > ');
  }
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.OSINTPatterns = OSINTPatterns;
  globalThis.IdentifierTypeMapping = IdentifierTypeMapping;
  globalThis.OSINTFieldDetector = OSINTFieldDetector;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    OSINTPatterns,
    IdentifierTypeMapping,
    OSINTFieldDetector
  };
}
