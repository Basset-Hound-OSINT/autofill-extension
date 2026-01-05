/**
 * Basset Hound Browser Automation - Provenance Capture
 * Phase 8.5: Data Provenance Capture
 *
 * Provides automatic capture of data provenance for OSINT ingestion:
 * - URL and canonical URL detection
 * - Page metadata extraction
 * - Timestamp capture
 * - User agent and client information
 * - Evidence bundling with screenshots
 */

// =============================================================================
// Source Type Definitions
// =============================================================================

/**
 * Data source types
 */
const SourceType = {
  WEBSITE: 'website',
  API: 'api',
  MANUAL: 'manual',
  DATA_BREACH: 'data_breach',
  SOCIAL_MEDIA: 'social_media',
  SEARCH_ENGINE: 'search_engine',
  PASTE_SITE: 'paste_site',
  FORUM: 'forum',
  DARK_WEB: 'dark_web',
  FILE: 'file',
  UNKNOWN: 'unknown'
};

/**
 * Capture method types
 */
const CaptureMethod = {
  AUTO_DETECTED: 'auto_detected',
  USER_SELECTED: 'user_selected',
  ELEMENT_PICKER: 'element_picker',
  FULL_PAGE_SCAN: 'full_page_scan',
  TARGETED_EXTRACTION: 'targeted_extraction',
  API_RESPONSE: 'api_response',
  MANUAL_INPUT: 'manual_input'
};

// =============================================================================
// ProvenanceCapture Class
// =============================================================================

/**
 * Provenance Capture
 * Automatically captures data provenance for OSINT data
 */
class ProvenanceCapture {
  /**
   * Create a new ProvenanceCapture instance
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {boolean} options.captureUserAgent - Include user agent (default: true)
   * @param {boolean} options.captureViewport - Include viewport info (default: true)
   */
  constructor(options = {}) {
    this.config = {
      logger: options.logger || null,
      captureUserAgent: options.captureUserAgent !== false,
      captureViewport: options.captureViewport !== false,
      capturedBy: options.capturedBy || 'autofill-extension'
    };

    this.stats = {
      totalCaptures: 0,
      bySourceType: {}
    };
  }

  /**
   * Capture full provenance for current page
   * @param {Object} options - Capture options
   * @returns {Object} Provenance data
   */
  capture(options = {}) {
    const {
      sourceType = null,
      captureMethod = CaptureMethod.FULL_PAGE_SCAN,
      additionalMeta = {}
    } = options;

    this.stats.totalCaptures++;

    const provenance = {
      // Core provenance
      source_type: sourceType || this._detectSourceType(),
      source_url: window.location.href,
      source_date: new Date().toISOString(),
      captured_by: this.config.capturedBy,
      capture_method: captureMethod,
      capture_timestamp: Date.now(),

      // Page information
      page_title: document.title,
      page_domain: window.location.hostname,
      page_path: window.location.pathname,
      page_hash: window.location.hash || null,

      // Enhanced metadata
      meta: {
        canonical_url: this._getCanonicalUrl(),
        last_modified: this._getLastModified(),
        page_language: document.documentElement.lang || null,
        content_type: document.contentType || null,
        charset: document.characterSet || null,
        og_title: this._getMetaContent('og:title'),
        og_description: this._getMetaContent('og:description'),
        og_image: this._getMetaContent('og:image'),
        og_url: this._getMetaContent('og:url'),
        twitter_title: this._getMetaContent('twitter:title'),
        author: this._getAuthor(),
        publisher: this._getMetaContent('og:site_name'),
        published_date: this._getPublishedDate(),
        modified_date: this._getModifiedDate(),
        ...additionalMeta
      }
    };

    // Add user agent if configured
    if (this.config.captureUserAgent) {
      provenance.user_agent = navigator.userAgent;
    }

    // Add viewport info if configured
    if (this.config.captureViewport) {
      provenance.viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        devicePixelRatio: window.devicePixelRatio
      };
    }

    // Update stats
    this.stats.bySourceType[provenance.source_type] =
      (this.stats.bySourceType[provenance.source_type] || 0) + 1;

    return provenance;
  }

  /**
   * Capture provenance for a specific element
   * @param {HTMLElement} element - Element to capture provenance for
   * @param {Object} options - Capture options
   * @returns {Object} Provenance with element context
   */
  captureForElement(element, options = {}) {
    const baseProvenance = this.capture({
      ...options,
      captureMethod: options.captureMethod || CaptureMethod.ELEMENT_PICKER
    });

    // Add element-specific information
    baseProvenance.element = {
      tag: element.tagName.toLowerCase(),
      id: element.id || null,
      className: element.className || null,
      selector: this._generateSelector(element),
      xpath: this._generateXPath(element),
      text: element.innerText?.slice(0, 500) || null,
      href: element.href || null,
      src: element.src || null,
      rect: this._getElementRect(element),
      computedStyles: {
        display: window.getComputedStyle(element).display,
        visibility: window.getComputedStyle(element).visibility
      }
    };

    // Add parent context
    if (element.parentElement) {
      baseProvenance.element.parentSelector = this._generateSelector(element.parentElement);
    }

    return baseProvenance;
  }

  /**
   * Capture minimal provenance (for batch operations)
   * @returns {Object} Minimal provenance data
   */
  captureMinimal() {
    return {
      source_url: window.location.href,
      source_date: new Date().toISOString(),
      captured_by: this.config.capturedBy,
      page_title: document.title,
      page_domain: window.location.hostname
    };
  }

  /**
   * Create evidence bundle with screenshot
   * @param {Object} options - Bundle options
   * @returns {Promise<Object>} Evidence bundle
   */
  async createEvidenceBundle(options = {}) {
    const {
      selector = null,
      includeScreenshot = true,
      includeHtml = true,
      includeFullPage = false
    } = options;

    const bundle = {
      id: this._generateBundleId(),
      created_at: new Date().toISOString(),
      provenance: this.capture(options),
      evidence: {}
    };

    // Add HTML content
    if (includeHtml) {
      if (selector) {
        const element = document.querySelector(selector);
        if (element) {
          bundle.evidence.html = element.outerHTML;
          bundle.evidence.text = element.innerText;
        }
      } else if (includeFullPage) {
        bundle.evidence.html = document.documentElement.outerHTML;
      }
    }

    // Request screenshot from background script
    if (includeScreenshot) {
      try {
        const screenshot = await this._requestScreenshot(selector);
        if (screenshot) {
          bundle.evidence.screenshot = screenshot;
          bundle.evidence.screenshot_timestamp = Date.now();
        }
      } catch {
        bundle.evidence.screenshot_error = 'Failed to capture screenshot';
      }
    }

    // Add DOM snapshot for element
    if (selector) {
      const element = document.querySelector(selector);
      if (element) {
        bundle.evidence.element_provenance = this.captureForElement(element, options);
      }
    }

    return bundle;
  }

  /**
   * Get provenance for data ingestion (basset-hound compatible format)
   * @param {Object} options - Options
   * @returns {Object} Provenance in basset-hound format
   */
  getForIngestion(options = {}) {
    const {
      identifierType = null,
      identifierValue = null,
      context = null,
      confidence = null
    } = options;

    const provenance = this.capture(options);

    return {
      source_type: provenance.source_type,
      source_url: provenance.meta.canonical_url || provenance.source_url,
      source_title: provenance.page_title,
      source_date: provenance.source_date,
      captured_by: provenance.captured_by,
      capture_method: provenance.capture_method,
      metadata: {
        page_domain: provenance.page_domain,
        page_language: provenance.meta.page_language,
        author: provenance.meta.author,
        published_date: provenance.meta.published_date,
        context: context,
        confidence: confidence,
        identifier_type: identifierType,
        identifier_value: identifierValue
      }
    };
  }

  /**
   * Get statistics
   * @returns {Object} Capture statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalCaptures: 0,
      bySourceType: {}
    };
  }

  // ===========================================================================
  // Private Methods - Source Detection
  // ===========================================================================

  /**
   * Detect source type based on URL and page content
   * @private
   */
  _detectSourceType() {
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    // Social media platforms
    const socialPlatforms = [
      'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'linkedin.com',
      'tiktok.com', 'youtube.com', 'reddit.com', 'pinterest.com', 'tumblr.com'
    ];
    if (socialPlatforms.some(p => hostname.includes(p))) {
      return SourceType.SOCIAL_MEDIA;
    }

    // Search engines
    const searchEngines = ['google.com', 'bing.com', 'duckduckgo.com', 'yahoo.com', 'baidu.com'];
    if (searchEngines.some(p => hostname.includes(p)) && (pathname.includes('/search') || window.location.search.includes('q='))) {
      return SourceType.SEARCH_ENGINE;
    }

    // Paste sites
    const pasteSites = ['pastebin.com', 'ghostbin.com', 'paste.mozilla.org', 'hastebin.com'];
    if (pasteSites.some(p => hostname.includes(p))) {
      return SourceType.PASTE_SITE;
    }

    // Forums
    const forumIndicators = ['forum', 'board', 'community', 'discuss'];
    if (forumIndicators.some(f => hostname.includes(f) || pathname.includes(f))) {
      return SourceType.FORUM;
    }

    // API responses (typically JSON pages)
    if (document.contentType === 'application/json' || pathname.includes('/api/')) {
      return SourceType.API;
    }

    // Dark web (.onion)
    if (hostname.endsWith('.onion')) {
      return SourceType.DARK_WEB;
    }

    // Default to website
    return SourceType.WEBSITE;
  }

  // ===========================================================================
  // Private Methods - Metadata Extraction
  // ===========================================================================

  /**
   * Get canonical URL
   * @private
   */
  _getCanonicalUrl() {
    const canonical = document.querySelector('link[rel="canonical"]');
    return canonical?.href || null;
  }

  /**
   * Get last modified date
   * @private
   */
  _getLastModified() {
    // Try document.lastModified first
    const docLastModified = document.lastModified;
    if (docLastModified && docLastModified !== 'unknown') {
      return docLastModified;
    }

    // Try meta tags
    return this._getMetaContent('last-modified') || null;
  }

  /**
   * Get meta tag content by name or property
   * @private
   */
  _getMetaContent(nameOrProperty) {
    // Try property first
    let meta = document.querySelector(`meta[property="${nameOrProperty}"]`);
    if (meta) return meta.content;

    // Try name
    meta = document.querySelector(`meta[name="${nameOrProperty}"]`);
    if (meta) return meta.content;

    // Try itemprop
    meta = document.querySelector(`meta[itemprop="${nameOrProperty}"]`);
    if (meta) return meta.content;

    return null;
  }

  /**
   * Get author information
   * @private
   */
  _getAuthor() {
    return this._getMetaContent('author') ||
           this._getMetaContent('article:author') ||
           this._getMetaContent('dc.creator') ||
           null;
  }

  /**
   * Get published date
   * @private
   */
  _getPublishedDate() {
    return this._getMetaContent('article:published_time') ||
           this._getMetaContent('datePublished') ||
           this._getMetaContent('date') ||
           this._getMetaContent('DC.date.issued') ||
           null;
  }

  /**
   * Get modified date
   * @private
   */
  _getModifiedDate() {
    return this._getMetaContent('article:modified_time') ||
           this._getMetaContent('dateModified') ||
           null;
  }

  // ===========================================================================
  // Private Methods - Element Handling
  // ===========================================================================

  /**
   * Generate CSS selector for element
   * @private
   */
  _generateSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }

    const path = [];
    let current = element;

    while (current && current !== document.body && path.length < 10) {
      let selector = current.tagName.toLowerCase();

      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/)
          .filter(c => !c.includes('basset'))
          .slice(0, 2)
          .join('.');
        if (classes) {
          selector += '.' + classes;
        }
      }

      // Add nth-child for uniqueness
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

  /**
   * Generate XPath for element
   * @private
   */
  _generateXPath(element) {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }

    const parts = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 10) {
      let index = 1;
      let sibling = current.previousElementSibling;

      while (sibling) {
        if (sibling.tagName === current.tagName) {
          index++;
        }
        sibling = sibling.previousElementSibling;
      }

      const tagName = current.tagName.toLowerCase();
      parts.unshift(`${tagName}[${index}]`);
      current = current.parentElement;
    }

    return '//' + parts.join('/');
  }

  /**
   * Get element bounding rect
   * @private
   */
  _getElementRect(element) {
    const rect = element.getBoundingClientRect();
    return {
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      bottom: Math.round(rect.bottom),
      right: Math.round(rect.right)
    };
  }

  // ===========================================================================
  // Private Methods - Utilities
  // ===========================================================================

  /**
   * Generate unique bundle ID
   * @private
   */
  _generateBundleId() {
    return `bnd_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Request screenshot from background script
   * @private
   */
  async _requestScreenshot(selector = null) {
    return new Promise((resolve) => {
      if (!chrome.runtime || !chrome.runtime.sendMessage) {
        resolve(null);
        return;
      }

      chrome.runtime.sendMessage(
        { type: 'capture_screenshot', selector },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(response?.dataUrl || null);
        }
      );
    });
  }
}

// =============================================================================
// Global Instance
// =============================================================================

/**
 * Global ProvenanceCapture instance
 */
let provenanceCapture = null;

/**
 * Get or create global provenance capture instance
 * @param {Object} options - Configuration options
 * @returns {ProvenanceCapture} Instance
 */
function getProvenanceCapture(options = {}) {
  if (!provenanceCapture) {
    provenanceCapture = new ProvenanceCapture(options);
  }
  return provenanceCapture;
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.SourceType = SourceType;
  globalThis.CaptureMethod = CaptureMethod;
  globalThis.ProvenanceCapture = ProvenanceCapture;
  globalThis.getProvenanceCapture = getProvenanceCapture;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SourceType,
    CaptureMethod,
    ProvenanceCapture,
    getProvenanceCapture
  };
}
