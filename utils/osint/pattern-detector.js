/**
 * Basset Hound Browser Automation - OSINT Pattern Detector
 * Phase 15.1: DevTools Ingest Tab - Pattern Detection
 *
 * Detects OSINT patterns in page content:
 * - Email addresses
 * - Phone numbers
 * - Cryptocurrency addresses (Bitcoin, Ethereum, Litecoin, XRP)
 * - IP addresses (IPv4, IPv6)
 * - Domain names
 * - URLs
 * - Usernames/handles
 * - Social media profiles
 * - Credit cards (masked detection only)
 * - Coordinates (lat/long)
 * - API keys (generic pattern)
 * - Wallet addresses
 *
 * NOTE: This module does PATTERN DETECTION ONLY.
 * External verification belongs in basset-hound backend.
 * See docs/PROJECT-SCOPE.md for scope boundaries.
 */

// =============================================================================
// Pattern Definitions
// =============================================================================

/**
 * OSINT data patterns for detection
 */
const OSINT_PATTERNS = {
  // Email addresses
  email: {
    name: 'Email Address',
    pattern: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
    icon: '📧',
    color: '#3794ff',
    category: 'contact',
    priority: 1
  },

  // Phone numbers (international formats)
  phone: {
    name: 'Phone Number',
    pattern: /\b(?:\+?(\d{1,3}))?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    icon: '📞',
    color: '#73c991',
    category: 'contact',
    priority: 2
  },

  // Bitcoin addresses
  bitcoin: {
    name: 'Bitcoin Address',
    pattern: /\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b/g,
    icon: '₿',
    color: '#f7931a',
    category: 'crypto',
    priority: 3
  },

  // Ethereum addresses
  ethereum: {
    name: 'Ethereum Address',
    pattern: /\b0x[a-fA-F0-9]{40}\b/g,
    icon: 'Ξ',
    color: '#627eea',
    category: 'crypto',
    priority: 4
  },

  // Litecoin addresses
  litecoin: {
    name: 'Litecoin Address',
    pattern: /\b[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}\b/g,
    icon: 'Ł',
    color: '#345d9d',
    category: 'crypto',
    priority: 5
  },

  // XRP addresses
  ripple: {
    name: 'XRP Address',
    pattern: /\br[0-9a-zA-Z]{24,34}\b/g,
    icon: 'Ʀ',
    color: '#23292f',
    category: 'crypto',
    priority: 6
  },

  // IPv4 addresses
  ipv4: {
    name: 'IPv4 Address',
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    icon: '🌐',
    color: '#75beff',
    category: 'network',
    priority: 7
  },

  // IPv6 addresses (simplified)
  ipv6: {
    name: 'IPv6 Address',
    pattern: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
    icon: '🌐',
    color: '#75beff',
    category: 'network',
    priority: 8
  },

  // Domain names
  domain: {
    name: 'Domain Name',
    pattern: /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/g,
    icon: '🌍',
    color: '#9cdcfe',
    category: 'network',
    priority: 9
  },

  // URLs
  url: {
    name: 'URL',
    pattern: /\bhttps?:\/\/[^\s<>"{}|\\^`\[\]]+/g,
    icon: '🔗',
    color: '#4ec9b0',
    category: 'network',
    priority: 10
  },

  // Twitter/X handles
  twitter: {
    name: 'Twitter/X Handle',
    pattern: /\B@[a-zA-Z0-9_]{1,15}\b/g,
    icon: '🐦',
    color: '#1da1f2',
    category: 'social',
    priority: 11
  },

  // Instagram handles
  instagram: {
    name: 'Instagram Handle',
    pattern: /\B@[a-zA-Z0-9_.]{1,30}\b/g,
    icon: '📷',
    color: '#e4405f',
    category: 'social',
    priority: 12
  },

  // GitHub usernames
  github: {
    name: 'GitHub Username',
    pattern: /\bgithub\.com\/([a-zA-Z0-9-]+)/g,
    icon: '🐙',
    color: '#333',
    category: 'social',
    priority: 13
  },

  // Credit card numbers (partial detection for PII warning)
  creditCard: {
    name: 'Credit Card',
    pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    icon: '💳',
    color: '#f48771',
    category: 'pii',
    priority: 14,
    sensitive: true
  },

  // Coordinates (latitude/longitude)
  coordinates: {
    name: 'Coordinates',
    pattern: /\b-?\d{1,3}\.\d+,\s*-?\d{1,3}\.\d+\b/g,
    icon: '📍',
    color: '#ce9178',
    category: 'location',
    priority: 15
  },

  // Generic API keys (simple pattern)
  apiKey: {
    name: 'Possible API Key',
    pattern: /\b[A-Za-z0-9_-]{32,}\b/g,
    icon: '🔑',
    color: '#f14c4c',
    category: 'security',
    priority: 16,
    sensitive: true
  }
};

// =============================================================================
// PatternDetector Class
// =============================================================================

/**
 * Detects OSINT patterns in text content
 */
class PatternDetector {
  /**
   * Create a new PatternDetector
   * @param {Object} options - Configuration options
   * @param {Object} options.verifier - DataVerifier instance for format validation
   * @param {Object} options.logger - Logger instance
   * @param {boolean} options.detectSensitive - Detect sensitive patterns (API keys, credit cards)
   */
  constructor(options = {}) {
    this.config = {
      verifier: options.verifier || null,
      logger: options.logger || null,
      detectSensitive: options.detectSensitive || false,
      maxContextLength: options.maxContextLength || 100,
      enabledPatterns: options.enabledPatterns || Object.keys(OSINT_PATTERNS)
    };

    this.stats = {
      totalDetections: 0,
      byType: {},
      lastDetection: null
    };
  }

  /**
   * Detect all OSINT patterns in text
   * @param {string} text - Text to analyze
   * @param {Object} options - Detection options
   * @returns {Array} Array of detected patterns
   */
  detectAll(text, options = {}) {
    const {
      includeContext = true,
      sourceUrl = null,
      sourcePage = null
    } = options;

    if (!text || typeof text !== 'string') {
      return [];
    }

    const results = [];
    const seen = new Set(); // Prevent duplicates

    // Detect each pattern type
    for (const [type, config] of Object.entries(OSINT_PATTERNS)) {
      // Skip if pattern not enabled
      if (!this.config.enabledPatterns.includes(type)) {
        continue;
      }

      // Skip sensitive patterns if not enabled
      if (config.sensitive && !this.config.detectSensitive) {
        continue;
      }

      const matches = this.detectPattern(text, type, config, {
        includeContext,
        sourceUrl,
        sourcePage
      });

      // Add unique matches
      for (const match of matches) {
        const key = `${type}:${match.value}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(match);
          this.stats.totalDetections++;
          this.stats.byType[type] = (this.stats.byType[type] || 0) + 1;
        }
      }
    }

    this.stats.lastDetection = Date.now();

    // Sort by priority
    results.sort((a, b) => a.priority - b.priority);

    return results;
  }

  /**
   * Detect a specific pattern type
   * @param {string} text - Text to analyze
   * @param {string} type - Pattern type
   * @param {Object} config - Pattern configuration
   * @param {Object} options - Detection options
   * @returns {Array} Array of matches
   */
  detectPattern(text, type, config, options = {}) {
    const matches = [];
    const pattern = new RegExp(config.pattern.source, config.pattern.flags);
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const value = match[1] || match[0]; // Use capture group if available
      const index = match.index;

      // Extract context
      let context = null;
      if (options.includeContext) {
        const start = Math.max(0, index - this.config.maxContextLength);
        const end = Math.min(text.length, index + value.length + this.config.maxContextLength);
        context = text.slice(start, end);
      }

      matches.push({
        type,
        value,
        name: config.name,
        icon: config.icon,
        color: config.color,
        category: config.category,
        priority: config.priority,
        sensitive: config.sensitive || false,
        index,
        context,
        sourceUrl: options.sourceUrl,
        sourcePage: options.sourcePage,
        timestamp: Date.now(),
        verified: false,
        validation: null
      });
    }

    return matches;
  }

  /**
   * Detect patterns in DOM elements
   * @param {Document|Element} root - Root element to scan
   * @param {Object} options - Detection options
   * @returns {Array} Array of detected patterns
   */
  detectInDOM(root = document, options = {}) {
    const {
      includeHidden = false,
      includeAttributes = true,
      selector = 'body'
    } = options;

    const results = [];
    const rootElement = typeof root === 'string' ? document.querySelector(root) : root;

    if (!rootElement) {
      return results;
    }

    // Get all text nodes
    const walker = document.createTreeWalker(
      rootElement,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip script and style tags
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          const tagName = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript'].includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }

          // Skip hidden elements if not included
          if (!includeHidden) {
            const style = window.getComputedStyle(parent);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return NodeFilter.FILTER_REJECT;
            }
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    // Collect text from nodes
    const textContent = [];
    const nodeMap = new Map();
    let currentNode;

    while ((currentNode = walker.nextNode())) {
      const text = currentNode.textContent.trim();
      if (text.length > 0) {
        const startIndex = textContent.join(' ').length;
        textContent.push(text);
        nodeMap.set(startIndex, currentNode.parentElement);
      }
    }

    const fullText = textContent.join(' ');

    // Detect patterns
    const detections = this.detectAll(fullText, {
      ...options,
      sourceUrl: window.location.href,
      sourcePage: document.title
    });

    // Map detections back to DOM elements
    for (const detection of detections) {
      // Find the element containing this detection
      let element = null;
      let minDistance = Infinity;

      for (const [startIndex, node] of nodeMap.entries()) {
        const distance = Math.abs(detection.index - startIndex);
        if (distance < minDistance) {
          minDistance = distance;
          element = node;
        }
      }

      detection.element = element;
      detection.selector = element ? this._getElementSelector(element) : null;
      results.push(detection);
    }

    // Also check attributes if enabled
    if (includeAttributes) {
      const attributePatterns = this.detectInAttributes(rootElement, options);
      results.push(...attributePatterns);
    }

    return results;
  }

  /**
   * Detect patterns in element attributes
   * @param {Element} root - Root element
   * @param {Object} options - Detection options
   * @returns {Array} Array of detected patterns
   */
  detectInAttributes(root, options = {}) {
    const results = [];
    const attributesToCheck = [
      'href', 'src', 'data-email', 'data-phone', 'data-url',
      'content', 'value', 'placeholder', 'title', 'alt'
    ];

    const elements = root.querySelectorAll('*');

    for (const element of elements) {
      for (const attr of attributesToCheck) {
        const value = element.getAttribute(attr);
        if (value) {
          const detections = this.detectAll(value, {
            ...options,
            sourceUrl: window.location.href,
            sourcePage: document.title
          });

          for (const detection of detections) {
            detection.element = element;
            detection.selector = this._getElementSelector(element);
            detection.attribute = attr;
            results.push(detection);
          }
        }
      }
    }

    return results;
  }

  /**
   * Validate detected patterns
   * @param {Array} detections - Array of detections to validate
   * @returns {Promise<Array>} Array of detections with validation results
   */
  async validateDetections(detections) {
    if (!this.config.verifier) {
      return detections;
    }

    for (const detection of detections) {
      try {
        // Map pattern type to verifier type
        const verifierType = this._mapToVerifierType(detection.type);
        if (verifierType) {
          const validation = await this.config.verifier.verify(verifierType, detection.value);
          detection.validation = validation;
          detection.verified = validation.plausible || false;
        }
      } catch (error) {
        if (this.config.logger) {
          this.config.logger.error('Validation error', { detection, error });
        }
      }
    }

    return detections;
  }

  /**
   * Get detection statistics
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
      totalDetections: 0,
      byType: {},
      lastDetection: null
    };
  }

  /**
   * Enable/disable pattern types
   * @param {Array<string>} patterns - Pattern types to enable
   */
  setEnabledPatterns(patterns) {
    this.config.enabledPatterns = patterns;
  }

  /**
   * Get available pattern types
   * @returns {Array} Array of pattern configurations
   */
  getPatternTypes() {
    return Object.entries(OSINT_PATTERNS).map(([type, config]) => ({
      type,
      name: config.name,
      icon: config.icon,
      color: config.color,
      category: config.category,
      sensitive: config.sensitive || false
    }));
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Get CSS selector for element
   * @private
   */
  _getElementSelector(element) {
    if (!element) return null;

    // Try ID first
    if (element.id) {
      return `#${element.id}`;
    }

    // Try unique class combination
    if (element.className) {
      const classes = Array.from(element.classList).join('.');
      if (classes) {
        return `${element.tagName.toLowerCase()}.${classes}`;
      }
    }

    // Fallback to tag name with position
    const parent = element.parentElement;
    if (!parent) {
      return element.tagName.toLowerCase();
    }

    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(element);
    return `${element.tagName.toLowerCase()}:nth-child(${index + 1})`;
  }

  /**
   * Map pattern type to verifier type
   * @private
   */
  _mapToVerifierType(patternType) {
    const mapping = {
      email: 'email',
      phone: 'phone',
      bitcoin: 'crypto',
      ethereum: 'crypto',
      litecoin: 'crypto',
      ripple: 'crypto',
      ipv4: 'ip',
      ipv6: 'ip',
      domain: 'domain',
      url: 'url',
      twitter: 'username',
      instagram: 'username',
      github: 'username'
    };

    return mapping[patternType] || null;
  }
}

// =============================================================================
// Exports
// =============================================================================

if (typeof globalThis !== 'undefined') {
  globalThis.PatternDetector = PatternDetector;
  globalThis.OSINT_PATTERNS = OSINT_PATTERNS;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PatternDetector,
    OSINT_PATTERNS
  };
}
