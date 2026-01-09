/**
 * Page Forensics Module for Basset Hound Browser Automation
 *
 * Comprehensive browser forensics for web page investigation:
 * - DOM structure analysis with depth and element counts
 * - External resource tracking (scripts, styles, images, fonts)
 * - Script analysis with suspicious pattern detection
 * - Network forensics integration via NetworkMonitor
 * - Storage analysis (cookies, localStorage, sessionStorage, IndexedDB)
 * - Security headers extraction
 * - Performance metrics collection
 * - Evidence bundle generation with SHA-256 hashing
 *
 * IN SCOPE: Pure browser data extraction, no external API calls
 *
 * @module PageForensics
 * @version 1.0.0
 */

// =============================================================================
// Constants and Configuration
// =============================================================================

const FORENSICS_CONFIG = {
  MAX_DEPTH_SEARCH: 50,
  MAX_ELEMENT_CONTENT_LENGTH: 1000,
  MAX_INLINE_SCRIPT_CAPTURE: 10000,
  MAX_EVENT_LISTENERS_PER_TYPE: 100,
  SUSPICIOUS_PATTERNS: {
    OBFUSCATION_INDICATORS: [
      /\\x[0-9a-f]{2}/gi,           // Hex escape sequences
      /\\u[0-9a-f]{4}/gi,           // Unicode escapes
      /String\.fromCharCode/gi,     // Character code conversion
      /_0x[a-f0-9]+/gi,             // Common obfuscator variable pattern
      /\['\\x[0-9a-f]{2}'\]/gi      // Bracket notation with hex
    ],
    EVAL_INDICATORS: [
      /\beval\s*\(/gi,
      /Function\s*\(/gi,
      /setTimeout\s*\(\s*['"`]/gi,  // setTimeout with string
      /setInterval\s*\(\s*['"`]/gi  // setInterval with string
    ],
    BASE64_INDICATORS: [
      /atob\s*\(/gi,
      /btoa\s*\(/gi,
      /base64/gi
    ],
    CRYPTO_MINING: [
      /coinhive/gi,
      /crypto-loot/gi,
      /minero\.cc/gi,
      /CoinHive/gi
    ],
    FINGERPRINTING: [
      /canvas\.toDataURL/gi,
      /WebGLRenderingContext/gi,
      /AudioContext/gi,
      /getImageData/gi
    ]
  },
  PERFORMANCE_PAINT_TYPES: ['first-paint', 'first-contentful-paint'],
  THIRD_PARTY_DETECTION: {
    KNOWN_TRACKERS: [
      'google-analytics.com',
      'googletagmanager.com',
      'facebook.net',
      'doubleclick.net',
      'adnxs.com',
      'rubiconproject.com',
      'criteo.com'
    ]
  }
};

// =============================================================================
// PageForensics Class
// =============================================================================

/**
 * PageForensics - Comprehensive browser forensics for web page investigation
 *
 * @class
 * @example
 * const forensics = new PageForensics({
 *   networkMonitor: myNetworkMonitor,
 *   logger: myLogger
 * });
 * const bundle = await forensics.captureForensics({ includeScreenshot: true });
 */
class PageForensics {
  /**
   * Create a new PageForensics instance
   *
   * @param {Object} options - Configuration options
   * @param {Object} options.networkMonitor - NetworkMonitor instance for network forensics
   * @param {Object} options.logger - Logger instance for debug/error logging
   * @param {boolean} options.enableDetailedScripts - Capture full inline script content
   * @param {boolean} options.enableEventListeners - Count event listeners (performance impact)
   */
  constructor(options = {}) {
    this.networkMonitor = options.networkMonitor || null;
    this.logger = options.logger || null;
    this.config = {
      enableDetailedScripts: options.enableDetailedScripts !== false,
      enableEventListeners: options.enableEventListeners !== false,
      maxDepth: options.maxDepth || FORENSICS_CONFIG.MAX_DEPTH_SEARCH,
      captureScreenshots: options.captureScreenshots !== false
    };

    this.stats = {
      totalCaptures: 0,
      lastCaptureTime: null,
      lastCaptureUrl: null,
      averageCaptureTime: 0,
      captureTimeHistory: []
    };

    this._log('info', 'PageForensics initialized');
  }

  // ===========================================================================
  // 1. DOM Analysis
  // ===========================================================================

  /**
   * Analyze DOM structure and composition
   *
   * @returns {Object} DOM analysis including element counts, depth, forms, iframes
   *
   * @example
   * const domAnalysis = forensics.analyzeDOMStructure();
   * console.log('Total elements:', domAnalysis.totalElements);
   * console.log('Max depth:', domAnalysis.maxDepth);
   * console.log('Forms found:', domAnalysis.forms.length);
   */
  analyzeDOMStructure() {
    this._log('debug', 'Starting DOM structure analysis');

    const startTime = performance.now();
    const elementCounts = {};
    const hiddenElements = [];
    const forms = [];
    const iframes = [];
    const shadowRoots = [];
    let totalElements = 0;
    let maxDepth = 0;

    // Recursive DOM traversal
    const traverseDOM = (element, depth = 0) => {
      if (!element || depth > this.config.maxDepth) {
        return;
      }

      totalElements++;
      maxDepth = Math.max(maxDepth, depth);

      // Count element types
      const tagName = element.tagName ? element.tagName.toLowerCase() : 'text';
      elementCounts[tagName] = (elementCounts[tagName] || 0) + 1;

      // Check for hidden elements
      if (element.nodeType === Node.ELEMENT_NODE) {
        const computedStyle = window.getComputedStyle(element);
        if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
          hiddenElements.push({
            tag: tagName,
            id: element.id || null,
            className: element.className || null,
            display: computedStyle.display,
            visibility: computedStyle.visibility,
            selector: this._generateSelector(element)
          });
        }

        // Analyze forms
        if (tagName === 'form') {
          forms.push(this._analyzeForm(element));
        }

        // Analyze iframes
        if (tagName === 'iframe') {
          iframes.push(this._analyzeIframe(element));
        }

        // Check for shadow roots
        if (element.shadowRoot) {
          shadowRoots.push({
            host: tagName,
            hostId: element.id || null,
            mode: element.shadowRoot.mode,
            childNodes: element.shadowRoot.childNodes.length
          });
          // Traverse shadow DOM
          traverseDOM(element.shadowRoot, depth);
        }
      }

      // Traverse children
      if (element.childNodes) {
        for (const child of element.childNodes) {
          traverseDOM(child, depth + 1);
        }
      }
    };

    // Start traversal from document root
    traverseDOM(document.documentElement, 0);

    const analysisTime = performance.now() - startTime;

    this._log('debug', `DOM analysis complete: ${totalElements} elements in ${analysisTime.toFixed(2)}ms`);

    return {
      elementCounts,
      totalElements,
      maxDepth,
      hiddenElements: hiddenElements.slice(0, 100), // Limit to first 100
      hiddenElementCount: hiddenElements.length,
      forms,
      iframes,
      shadowRoots,
      analysisTime: Math.round(analysisTime),
      timestamp: Date.now()
    };
  }

  /**
   * Analyze a form element
   * @private
   * @param {HTMLFormElement} form - Form element to analyze
   * @returns {Object} Form analysis data
   */
  _analyzeForm(form) {
    const fields = [];
    const formElements = form.elements;

    for (let i = 0; i < formElements.length; i++) {
      const field = formElements[i];
      fields.push({
        type: field.type || 'unknown',
        name: field.name || null,
        id: field.id || null,
        required: field.required || false,
        autocomplete: field.autocomplete || null,
        value: field.type === 'password' ? '[REDACTED]' : (field.value ? '[HAS_VALUE]' : null)
      });
    }

    return {
      id: form.id || null,
      name: form.name || null,
      action: form.action || null,
      method: form.method || 'get',
      enctype: form.enctype || null,
      target: form.target || null,
      fieldCount: fields.length,
      fields,
      selector: this._generateSelector(form)
    };
  }

  /**
   * Analyze an iframe element
   * @private
   * @param {HTMLIFrameElement} iframe - Iframe element to analyze
   * @returns {Object} Iframe analysis data
   */
  _analyzeIframe(iframe) {
    return {
      src: iframe.src || null,
      srcdoc: iframe.srcdoc ? '[SRCDOC_PRESENT]' : null,
      sandbox: iframe.sandbox.value || null,
      allow: iframe.allow || null,
      width: iframe.width || null,
      height: iframe.height || null,
      id: iframe.id || null,
      name: iframe.name || null,
      loading: iframe.loading || null,
      referrerPolicy: iframe.referrerPolicy || null,
      selector: this._generateSelector(iframe)
    };
  }

  // ===========================================================================
  // 2. External Resources
  // ===========================================================================

  /**
   * Get all external resources loaded by the page
   *
   * @returns {Object} External resources categorized by type
   *
   * @example
   * const resources = forensics.getExternalResources();
   * console.log('Scripts:', resources.scripts.length);
   * console.log('Third-party domains:', resources.thirdPartyDomains);
   */
  getExternalResources() {
    this._log('debug', 'Analyzing external resources');

    const scripts = [];
    const stylesheets = [];
    const images = [];
    const fonts = [];
    const videos = [];
    const audios = [];
    const objects = [];
    const embeds = [];
    const links = [];

    const currentDomain = window.location.hostname;
    const thirdPartyDomains = new Set();

    // Extract scripts
    document.querySelectorAll('script[src]').forEach(script => {
      const src = script.src;
      scripts.push(src);
      const domain = this._extractDomain(src);
      if (domain && domain !== currentDomain) {
        thirdPartyDomains.add(domain);
      }
    });

    // Extract stylesheets
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      const href = link.href;
      stylesheets.push(href);
      const domain = this._extractDomain(href);
      if (domain && domain !== currentDomain) {
        thirdPartyDomains.add(domain);
      }
    });

    // Extract images
    document.querySelectorAll('img[src]').forEach(img => {
      const src = img.src;
      images.push(src);
      const domain = this._extractDomain(src);
      if (domain && domain !== currentDomain) {
        thirdPartyDomains.add(domain);
      }
    });

    // Extract fonts (from CSS)
    try {
      const fontFaces = document.fonts;
      fontFaces.forEach(font => {
        // FontFace objects don't expose source URLs directly in standard API
        // We can only get family names
      });
    } catch (e) {
      this._log('warn', 'Could not extract font information: ' + e.message);
    }

    // Extract fonts from link tags
    document.querySelectorAll('link[rel*="font"], link[href*="font"]').forEach(link => {
      const href = link.href;
      fonts.push(href);
      const domain = this._extractDomain(href);
      if (domain && domain !== currentDomain) {
        thirdPartyDomains.add(domain);
      }
    });

    // Extract videos
    document.querySelectorAll('video[src], video source[src]').forEach(video => {
      const src = video.src;
      if (src) {
        videos.push(src);
        const domain = this._extractDomain(src);
        if (domain && domain !== currentDomain) {
          thirdPartyDomains.add(domain);
        }
      }
    });

    // Extract audios
    document.querySelectorAll('audio[src], audio source[src]').forEach(audio => {
      const src = audio.src;
      if (src) {
        audios.push(src);
        const domain = this._extractDomain(src);
        if (domain && domain !== currentDomain) {
          thirdPartyDomains.add(domain);
        }
      }
    });

    // Extract objects and embeds
    document.querySelectorAll('object[data]').forEach(obj => {
      const data = obj.data;
      objects.push(data);
      const domain = this._extractDomain(data);
      if (domain && domain !== currentDomain) {
        thirdPartyDomains.add(domain);
      }
    });

    document.querySelectorAll('embed[src]').forEach(embed => {
      const src = embed.src;
      embeds.push(src);
      const domain = this._extractDomain(src);
      if (domain && domain !== currentDomain) {
        thirdPartyDomains.add(domain);
      }
    });

    // Extract other links
    document.querySelectorAll('link:not([rel="stylesheet"])').forEach(link => {
      if (link.href && !stylesheets.includes(link.href)) {
        links.push({
          rel: link.rel,
          href: link.href,
          type: link.type || null
        });
      }
    });

    return {
      scripts,
      scriptCount: scripts.length,
      stylesheets,
      stylesheetCount: stylesheets.length,
      images,
      imageCount: images.length,
      fonts,
      fontCount: fonts.length,
      videos,
      videoCount: videos.length,
      audios,
      audioCount: audios.length,
      objects,
      objectCount: objects.length,
      embeds,
      embedCount: embeds.length,
      links,
      linkCount: links.length,
      thirdPartyDomains: Array.from(thirdPartyDomains),
      thirdPartyCount: thirdPartyDomains.size,
      knownTrackers: this._identifyTrackers(Array.from(thirdPartyDomains)),
      timestamp: Date.now()
    };
  }

  /**
   * Extract domain from URL
   * @private
   * @param {string} url - URL to extract domain from
   * @returns {string|null} Domain or null
   */
  _extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      return null;
    }
  }

  /**
   * Identify known trackers from domain list
   * @private
   * @param {Array<string>} domains - List of domains
   * @returns {Array<string>} Known tracker domains
   */
  _identifyTrackers(domains) {
    const trackers = [];
    const knownTrackers = FORENSICS_CONFIG.THIRD_PARTY_DETECTION.KNOWN_TRACKERS;

    for (const domain of domains) {
      for (const tracker of knownTrackers) {
        if (domain.includes(tracker)) {
          trackers.push({
            domain,
            tracker,
            type: 'known_tracker'
          });
          break;
        }
      }
    }

    return trackers;
  }

  // ===========================================================================
  // 3. Script Analysis
  // ===========================================================================

  /**
   * Analyze all scripts on the page
   *
   * @returns {Object} Script analysis including inline/external scripts and suspicious patterns
   *
   * @example
   * const scriptAnalysis = forensics.analyzeScripts();
   * console.log('Inline scripts:', scriptAnalysis.inlineScripts.length);
   * console.log('Suspicious patterns:', scriptAnalysis.suspiciousPatterns);
   */
  analyzeScripts() {
    this._log('debug', 'Analyzing scripts');

    const inlineScripts = [];
    const externalScripts = [];
    const suspiciousPatterns = {
      obfuscated: false,
      eval: false,
      base64: false,
      cryptoMining: false,
      fingerprinting: false,
      details: []
    };
    const eventListeners = {};

    // Analyze inline scripts
    document.querySelectorAll('script:not([src])').forEach((script, index) => {
      const content = script.textContent || script.innerText || '';
      const truncatedContent = this.config.enableDetailedScripts
        ? content.substring(0, FORENSICS_CONFIG.MAX_INLINE_SCRIPT_CAPTURE)
        : '[CONTENT_TRUNCATED]';

      const scriptAnalysis = {
        index,
        length: content.length,
        location: script.parentElement ? script.parentElement.tagName.toLowerCase() : 'unknown',
        type: script.type || 'text/javascript',
        async: script.async || false,
        defer: script.defer || false,
        integrity: script.integrity || null,
        content: truncatedContent,
        suspicious: this._detectSuspiciousPatterns(content)
      };

      inlineScripts.push(scriptAnalysis);

      // Check for suspicious patterns
      if (scriptAnalysis.suspicious.hasIssues) {
        suspiciousPatterns.obfuscated = suspiciousPatterns.obfuscated || scriptAnalysis.suspicious.obfuscated;
        suspiciousPatterns.eval = suspiciousPatterns.eval || scriptAnalysis.suspicious.eval;
        suspiciousPatterns.base64 = suspiciousPatterns.base64 || scriptAnalysis.suspicious.base64;
        suspiciousPatterns.cryptoMining = suspiciousPatterns.cryptoMining || scriptAnalysis.suspicious.cryptoMining;
        suspiciousPatterns.fingerprinting = suspiciousPatterns.fingerprinting || scriptAnalysis.suspicious.fingerprinting;
        suspiciousPatterns.details.push({
          type: 'inline',
          index,
          issues: scriptAnalysis.suspicious
        });
      }
    });

    // Analyze external scripts
    document.querySelectorAll('script[src]').forEach((script, index) => {
      const scriptData = {
        index,
        src: script.src,
        async: script.async || false,
        defer: script.defer || false,
        type: script.type || 'text/javascript',
        integrity: script.integrity || null,
        crossOrigin: script.crossOrigin || null,
        referrerPolicy: script.referrerPolicy || null,
        noModule: script.noModule || false
      };

      externalScripts.push(scriptData);
    });

    // Count event listeners (if enabled)
    if (this.config.enableEventListeners) {
      this._countEventListeners(eventListeners);
    }

    return {
      inlineScripts,
      inlineScriptCount: inlineScripts.length,
      inlineScriptTotalSize: inlineScripts.reduce((sum, s) => sum + s.length, 0),
      externalScripts,
      externalScriptCount: externalScripts.length,
      suspiciousPatterns,
      eventListeners: this.config.enableEventListeners ? eventListeners : { disabled: true },
      timestamp: Date.now()
    };
  }

  /**
   * Detect suspicious patterns in script content
   * @private
   * @param {string} content - Script content
   * @returns {Object} Suspicious pattern detection results
   */
  _detectSuspiciousPatterns(content) {
    const patterns = FORENSICS_CONFIG.SUSPICIOUS_PATTERNS;
    const results = {
      hasIssues: false,
      obfuscated: false,
      eval: false,
      base64: false,
      cryptoMining: false,
      fingerprinting: false,
      details: []
    };

    // Check obfuscation
    for (const pattern of patterns.OBFUSCATION_INDICATORS) {
      if (pattern.test(content)) {
        results.obfuscated = true;
        results.hasIssues = true;
        results.details.push('Obfuscation detected');
        break;
      }
    }

    // Check eval usage
    for (const pattern of patterns.EVAL_INDICATORS) {
      if (pattern.test(content)) {
        results.eval = true;
        results.hasIssues = true;
        results.details.push('eval() or Function() detected');
        break;
      }
    }

    // Check base64
    for (const pattern of patterns.BASE64_INDICATORS) {
      if (pattern.test(content)) {
        results.base64 = true;
        results.hasIssues = true;
        results.details.push('Base64 encoding detected');
        break;
      }
    }

    // Check crypto mining
    for (const pattern of patterns.CRYPTO_MINING) {
      if (pattern.test(content)) {
        results.cryptoMining = true;
        results.hasIssues = true;
        results.details.push('Crypto mining indicators detected');
        break;
      }
    }

    // Check fingerprinting
    for (const pattern of patterns.FINGERPRINTING) {
      if (pattern.test(content)) {
        results.fingerprinting = true;
        results.hasIssues = true;
        results.details.push('Browser fingerprinting detected');
        break;
      }
    }

    return results;
  }

  /**
   * Count event listeners on the page
   * @private
   * @param {Object} eventListeners - Object to populate with event listener counts
   */
  _countEventListeners(eventListeners) {
    const commonEvents = [
      'click', 'dblclick', 'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout',
      'keydown', 'keyup', 'keypress',
      'focus', 'blur', 'change', 'input', 'submit',
      'load', 'unload', 'beforeunload',
      'scroll', 'resize',
      'touchstart', 'touchend', 'touchmove',
      'drag', 'drop', 'dragstart', 'dragend'
    ];

    // Note: Modern browsers don't expose a direct way to count event listeners
    // This is an approximation based on common patterns
    for (const eventType of commonEvents) {
      eventListeners[eventType] = 0;
    }

    // Try to detect jQuery event handlers if jQuery is present
    if (typeof jQuery !== 'undefined') {
      try {
        const jQueryEvents = jQuery._data(document, 'events');
        if (jQueryEvents) {
          for (const eventType in jQueryEvents) {
            eventListeners[eventType] = (eventListeners[eventType] || 0) + jQueryEvents[eventType].length;
          }
        }
      } catch (e) {
        this._log('debug', 'Could not extract jQuery events: ' + e.message);
      }
    }

    eventListeners._note = 'Event listener counts are approximations and may not be complete';
  }

  // ===========================================================================
  // 4. Network Forensics
  // ===========================================================================

  /**
   * Get network forensics data from NetworkMonitor
   *
   * @returns {Object} Network forensics including requests, cookies, redirects
   *
   * @example
   * const networkData = forensics.getNetworkForensics();
   * console.log('Total requests:', networkData.totalRequests);
   * console.log('Failed requests:', networkData.failedRequests.length);
   */
  getNetworkForensics() {
    this._log('debug', 'Gathering network forensics');

    if (!this.networkMonitor) {
      return {
        available: false,
        message: 'NetworkMonitor not configured',
        timestamp: Date.now()
      };
    }

    const requests = this.networkMonitor.getLog();
    const currentDomain = window.location.hostname;
    const thirdPartyRequests = [];
    const failedRequests = [];
    const redirects = [];
    const cookiesSet = [];
    let httpsCount = 0;

    for (const request of requests) {
      // Check if third-party
      const domain = this._extractDomain(request.url);
      if (domain && domain !== currentDomain) {
        thirdPartyRequests.push({
          url: request.url,
          domain,
          type: request.type,
          method: request.method
        });
      }

      // Check for HTTPS
      if (request.url.startsWith('https://')) {
        httpsCount++;
      }

      // Check for failures
      if (request.error) {
        failedRequests.push({
          url: request.url,
          error: request.error,
          method: request.method,
          type: request.type
        });
      }

      // Check for redirects
      if (request.redirects && request.redirects.length > 0) {
        redirects.push({
          url: request.url,
          redirectChain: request.redirects.map(r => r.url),
          redirectCount: request.redirects.length
        });
      }

      // Extract Set-Cookie headers
      if (request.responseHeaders && request.responseHeaders['set-cookie']) {
        const setCookie = request.responseHeaders['set-cookie'];
        cookiesSet.push({
          url: request.url,
          cookie: Array.isArray(setCookie) ? setCookie : [setCookie]
        });
      }
    }

    const httpsPercentage = requests.length > 0 ? (httpsCount / requests.length) : 0;

    return {
      available: true,
      totalRequests: requests.length,
      thirdPartyRequests,
      thirdPartyCount: thirdPartyRequests.length,
      failedRequests,
      failedCount: failedRequests.length,
      redirects,
      redirectCount: redirects.length,
      cookiesSet,
      cookieCount: cookiesSet.length,
      httpsCount,
      httpsPercentage: Math.round(httpsPercentage * 100) / 100,
      requestsByType: this._groupRequestsByType(requests),
      requestsByMethod: this._groupRequestsByMethod(requests),
      timestamp: Date.now()
    };
  }

  /**
   * Group requests by type
   * @private
   * @param {Array} requests - Request list
   * @returns {Object} Requests grouped by type
   */
  _groupRequestsByType(requests) {
    const grouped = {};
    for (const request of requests) {
      const type = request.type || 'unknown';
      grouped[type] = (grouped[type] || 0) + 1;
    }
    return grouped;
  }

  /**
   * Group requests by method
   * @private
   * @param {Array} requests - Request list
   * @returns {Object} Requests grouped by method
   */
  _groupRequestsByMethod(requests) {
    const grouped = {};
    for (const request of requests) {
      const method = request.method || 'UNKNOWN';
      grouped[method] = (grouped[method] || 0) + 1;
    }
    return grouped;
  }

  // ===========================================================================
  // 5. Storage Analysis
  // ===========================================================================

  /**
   * Analyze browser storage (cookies, localStorage, sessionStorage, IndexedDB)
   *
   * @returns {Promise<Object>} Storage analysis data
   *
   * @example
   * const storage = await forensics.analyzeStorage();
   * console.log('Cookies:', storage.cookies.total);
   * console.log('localStorage items:', storage.localStorage.itemCount);
   */
  async analyzeStorage() {
    this._log('debug', 'Analyzing storage');

    const cookies = this._analyzeCookies();
    const localStorage = this._analyzeLocalStorage();
    const sessionStorage = this._analyzeSessionStorage();
    const indexedDB = await this._analyzeIndexedDB();

    return {
      cookies,
      localStorage,
      sessionStorage,
      indexedDB,
      timestamp: Date.now()
    };
  }

  /**
   * Analyze cookies
   * @private
   * @returns {Object} Cookie analysis
   */
  _analyzeCookies() {
    const cookieString = document.cookie;
    const cookies = cookieString.split(';').map(c => c.trim()).filter(c => c.length > 0);
    const currentDomain = window.location.hostname;

    let httpOnlyCount = 0;
    let secureCount = 0;
    let firstPartyCount = 0;
    let thirdPartyCount = 0;

    const cookieDetails = cookies.map(cookie => {
      const [name, ...valueParts] = cookie.split('=');
      const value = valueParts.join('=');

      // Note: HttpOnly and Secure flags are not accessible via document.cookie
      // These would need to be detected from Set-Cookie headers via NetworkMonitor

      return {
        name: name.trim(),
        hasValue: value.length > 0,
        valueLength: value.length
      };
    });

    return {
      total: cookies.length,
      firstParty: firstPartyCount,
      thirdParty: thirdPartyCount,
      httpOnly: httpOnlyCount,
      secure: secureCount,
      cookies: cookieDetails,
      note: 'HttpOnly and Secure flags require network monitoring to detect accurately'
    };
  }

  /**
   * Analyze localStorage
   * @private
   * @returns {Object} localStorage analysis
   */
  _analyzeLocalStorage() {
    try {
      const keys = Object.keys(localStorage);
      let totalSize = 0;

      const items = keys.map(key => {
        const value = localStorage.getItem(key);
        const size = new Blob([value]).size;
        totalSize += size;
        return {
          key,
          size,
          valuePreview: value.substring(0, 50) + (value.length > 50 ? '...' : '')
        };
      });

      return {
        itemCount: keys.length,
        totalSize,
        keys,
        items: items.slice(0, 100) // Limit to first 100 items
      };
    } catch (e) {
      return {
        error: 'Could not access localStorage: ' + e.message,
        itemCount: 0
      };
    }
  }

  /**
   * Analyze sessionStorage
   * @private
   * @returns {Object} sessionStorage analysis
   */
  _analyzeSessionStorage() {
    try {
      const keys = Object.keys(sessionStorage);
      let totalSize = 0;

      const items = keys.map(key => {
        const value = sessionStorage.getItem(key);
        const size = new Blob([value]).size;
        totalSize += size;
        return {
          key,
          size,
          valuePreview: value.substring(0, 50) + (value.length > 50 ? '...' : '')
        };
      });

      return {
        itemCount: keys.length,
        totalSize,
        keys,
        items: items.slice(0, 100) // Limit to first 100 items
      };
    } catch (e) {
      return {
        error: 'Could not access sessionStorage: ' + e.message,
        itemCount: 0
      };
    }
  }

  /**
   * Analyze IndexedDB
   * @private
   * @returns {Promise<Object>} IndexedDB analysis
   */
  async _analyzeIndexedDB() {
    try {
      if (!window.indexedDB) {
        return {
          available: false,
          message: 'IndexedDB not available'
        };
      }

      const databases = await window.indexedDB.databases();
      const dbInfo = databases.map(db => ({
        name: db.name,
        version: db.version
      }));

      return {
        available: true,
        databases: dbInfo,
        databaseCount: databases.length
      };
    } catch (e) {
      return {
        available: false,
        error: 'Could not access IndexedDB: ' + e.message,
        databaseCount: 0
      };
    }
  }

  // ===========================================================================
  // 6. Security Headers
  // ===========================================================================

  /**
   * Get security headers from network responses
   *
   * @returns {Object} Security headers analysis
   *
   * @example
   * const security = forensics.getSecurityHeaders();
   * console.log('CSP:', security.contentSecurityPolicy);
   * console.log('HSTS:', security.strictTransportSecurity);
   */
  getSecurityHeaders() {
    this._log('debug', 'Analyzing security headers');

    if (!this.networkMonitor) {
      return {
        available: false,
        message: 'NetworkMonitor not configured for header analysis',
        timestamp: Date.now()
      };
    }

    const requests = this.networkMonitor.getLog();
    const currentUrl = window.location.href;

    // Find the main document request
    const mainRequest = requests.find(r => r.url === currentUrl && r.type === 'main_frame');

    if (!mainRequest || !mainRequest.responseHeaders) {
      return {
        available: false,
        message: 'Main document request not found or no headers available',
        timestamp: Date.now()
      };
    }

    const headers = mainRequest.responseHeaders;
    const mixedContent = this._detectMixedContent(requests);

    return {
      available: true,
      contentSecurityPolicy: headers['content-security-policy'] || null,
      strictTransportSecurity: headers['strict-transport-security'] || null,
      xFrameOptions: headers['x-frame-options'] || null,
      xContentTypeOptions: headers['x-content-type-options'] || null,
      xXssProtection: headers['x-xss-protection'] || null,
      referrerPolicy: headers['referrer-policy'] || null,
      permissionsPolicy: headers['permissions-policy'] || null,
      crossOriginOpenerPolicy: headers['cross-origin-opener-policy'] || null,
      crossOriginResourcePolicy: headers['cross-origin-resource-policy'] || null,
      crossOriginEmbedderPolicy: headers['cross-origin-embedder-policy'] || null,
      mixedContent: mixedContent.hasMixedContent,
      mixedContentDetails: mixedContent.details,
      timestamp: Date.now()
    };
  }

  /**
   * Detect mixed content (HTTP resources on HTTPS page)
   * @private
   * @param {Array} requests - Request list
   * @returns {Object} Mixed content detection results
   */
  _detectMixedContent(requests) {
    if (!window.location.protocol.startsWith('https')) {
      return {
        hasMixedContent: false,
        details: 'Page is not served over HTTPS'
      };
    }

    const mixedContentRequests = requests.filter(r =>
      r.url.startsWith('http://') && !r.url.startsWith('http://localhost')
    );

    return {
      hasMixedContent: mixedContentRequests.length > 0,
      count: mixedContentRequests.length,
      details: mixedContentRequests.map(r => ({
        url: r.url,
        type: r.type,
        method: r.method
      }))
    };
  }

  // ===========================================================================
  // 7. Performance Metrics
  // ===========================================================================

  /**
   * Get performance metrics from Navigation Timing and Resource Timing APIs
   *
   * @returns {Object} Performance metrics
   *
   * @example
   * const perf = forensics.getPerformanceMetrics();
   * console.log('Load time:', perf.loadComplete, 'ms');
   * console.log('First paint:', perf.firstPaint, 'ms');
   */
  getPerformanceMetrics() {
    this._log('debug', 'Gathering performance metrics');

    if (!window.performance) {
      return {
        available: false,
        message: 'Performance API not available',
        timestamp: Date.now()
      };
    }

    const timing = performance.timing;
    const navigation = performance.navigation;

    // Navigation Timing metrics
    const navigationStart = timing.navigationStart;
    const metrics = {
      available: true,
      navigationStart,

      // Page load timing
      domContentLoaded: timing.domContentLoadedEventEnd - navigationStart,
      loadComplete: timing.loadEventEnd - navigationStart,
      domInteractive: timing.domInteractive - navigationStart,
      domComplete: timing.domComplete - navigationStart,

      // Network timing
      dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
      tcpConnection: timing.connectEnd - timing.connectStart,
      serverResponse: timing.responseStart - timing.requestStart,
      pageDownload: timing.responseEnd - timing.responseStart,

      // Navigation type
      navigationType: this._getNavigationType(navigation.type),
      redirectCount: navigation.redirectCount,

      // Paint timing
      firstPaint: null,
      firstContentfulPaint: null,

      // Resource timing
      resources: {
        count: 0,
        totalSize: 0,
        byType: {}
      },

      timestamp: Date.now()
    };

    // Get paint timing
    try {
      const paintEntries = performance.getEntriesByType('paint');
      for (const entry of paintEntries) {
        if (entry.name === 'first-paint') {
          metrics.firstPaint = Math.round(entry.startTime);
        } else if (entry.name === 'first-contentful-paint') {
          metrics.firstContentfulPaint = Math.round(entry.startTime);
        }
      }
    } catch (e) {
      this._log('debug', 'Could not get paint timing: ' + e.message);
    }

    // Get resource timing
    try {
      const resourceEntries = performance.getEntriesByType('resource');
      metrics.resources.count = resourceEntries.length;

      const byType = {};
      let totalSize = 0;

      for (const resource of resourceEntries) {
        const type = this._getResourceType(resource.name);
        byType[type] = (byType[type] || 0) + 1;

        // Calculate size if available
        if (resource.transferSize) {
          totalSize += resource.transferSize;
        }
      }

      metrics.resources.byType = byType;
      metrics.resources.totalSize = totalSize;
    } catch (e) {
      this._log('debug', 'Could not get resource timing: ' + e.message);
    }

    return metrics;
  }

  /**
   * Get navigation type as string
   * @private
   * @param {number} type - Navigation type code
   * @returns {string} Navigation type description
   */
  _getNavigationType(type) {
    const types = {
      0: 'navigate',
      1: 'reload',
      2: 'back_forward',
      255: 'reserved'
    };
    return types[type] || 'unknown';
  }

  /**
   * Get resource type from URL
   * @private
   * @param {string} url - Resource URL
   * @returns {string} Resource type
   */
  _getResourceType(url) {
    const ext = url.split('.').pop().split('?')[0].toLowerCase();
    const typeMap = {
      'js': 'script',
      'css': 'stylesheet',
      'jpg': 'image',
      'jpeg': 'image',
      'png': 'image',
      'gif': 'image',
      'svg': 'image',
      'webp': 'image',
      'woff': 'font',
      'woff2': 'font',
      'ttf': 'font',
      'eot': 'font',
      'mp4': 'video',
      'webm': 'video',
      'mp3': 'audio',
      'wav': 'audio'
    };
    return typeMap[ext] || 'other';
  }

  // ===========================================================================
  // 8. Evidence Bundle
  // ===========================================================================

  /**
   * Capture comprehensive forensics bundle
   *
   * @param {Object} options - Capture options
   * @param {boolean} options.includeDOM - Include DOM analysis (default: true)
   * @param {boolean} options.includeResources - Include external resources (default: true)
   * @param {boolean} options.includeScripts - Include script analysis (default: true)
   * @param {boolean} options.includeNetwork - Include network forensics (default: true)
   * @param {boolean} options.includeStorage - Include storage analysis (default: true)
   * @param {boolean} options.includeSecurity - Include security headers (default: true)
   * @param {boolean} options.includePerformance - Include performance metrics (default: true)
   * @param {string} options.caseNumber - Case number for evidence bundle
   * @param {string} options.examinerID - Examiner ID for evidence bundle
   * @param {string} options.notes - Additional notes
   * @returns {Promise<Object>} Complete forensics bundle
   *
   * @example
   * const bundle = await forensics.captureForensics({
   *   caseNumber: 'CASE-2024-001',
   *   examinerID: 'EX-123',
   *   notes: 'Suspicious activity investigation'
   * });
   */
  async captureForensics(options = {}) {
    this._log('info', 'Capturing forensics bundle');

    const captureStart = performance.now();
    const timestamp = Date.now();

    const forensics = {
      metadata: {
        version: '1.0.0',
        timestamp,
        timestampISO: new Date(timestamp).toISOString(),
        captureTime: null, // Will be set at the end
        caseNumber: options.caseNumber || null,
        examinerID: options.examinerID || null,
        notes: options.notes || null
      },

      page: {
        url: window.location.href,
        title: document.title,
        domain: window.location.hostname,
        protocol: window.location.protocol,
        path: window.location.pathname,
        hash: window.location.hash || null,
        referrer: document.referrer || null,
        userAgent: navigator.userAgent,
        language: document.documentElement.lang || null,
        characterSet: document.characterSet,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY
        }
      },

      hash: null // Will be set at the end
    };

    // Capture each component based on options
    if (options.includeDOM !== false) {
      forensics.dom = this.analyzeDOMStructure();
    }

    if (options.includeResources !== false) {
      forensics.resources = this.getExternalResources();
    }

    if (options.includeScripts !== false) {
      forensics.scripts = this.analyzeScripts();
    }

    if (options.includeNetwork !== false) {
      forensics.network = this.getNetworkForensics();
    }

    if (options.includeStorage !== false) {
      forensics.storage = await this.analyzeStorage();
    }

    if (options.includeSecurity !== false) {
      forensics.security = this.getSecurityHeaders();
    }

    if (options.includePerformance !== false) {
      forensics.performance = this.getPerformanceMetrics();
    }

    // Calculate capture time
    const captureTime = performance.now() - captureStart;
    forensics.metadata.captureTime = Math.round(captureTime);

    // Generate hash of the bundle
    forensics.hash = await this.generateHash(forensics);

    // Update statistics
    this._updateStats(captureTime, forensics);

    this._log('info', `Forensics bundle captured in ${captureTime.toFixed(2)}ms`);

    return forensics;
  }

  /**
   * Generate SHA-256 hash of forensics data
   *
   * @param {Object} data - Data to hash
   * @returns {Promise<string>} SHA-256 hash
   *
   * @example
   * const hash = await forensics.generateHash(forensicsBundle);
   */
  async generateHash(data) {
    try {
      const jsonString = JSON.stringify(data);
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(jsonString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      this._log('error', 'Hash generation failed: ' + e.message);
      return 'hash_error_' + Date.now();
    }
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Generate CSS selector for an element
   * @private
   * @param {Element} element - DOM element
   * @returns {string} CSS selector
   */
  _generateSelector(element) {
    if (!element) return '';

    if (element.id) {
      return '#' + element.id;
    }

    const path = [];
    let current = element;
    let depth = 0;

    while (current && current !== document.body && depth < 10) {
      let selector = current.tagName.toLowerCase();

      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/)
          .filter(c => c && !c.includes('basset'))
          .slice(0, 2)
          .join('.');
        if (classes) {
          selector += '.' + classes;
        }
      }

      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          el => el.tagName === current.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += ':nth-child(' + index + ')';
        }
      }

      path.unshift(selector);
      current = parent;
      depth++;
    }

    return path.join(' > ');
  }

  /**
   * Update statistics
   * @private
   * @param {number} captureTime - Capture time in ms
   * @param {Object} forensics - Forensics bundle
   */
  _updateStats(captureTime, forensics) {
    this.stats.totalCaptures++;
    this.stats.lastCaptureTime = Date.now();
    this.stats.lastCaptureUrl = forensics.page.url;

    this.stats.captureTimeHistory.push(captureTime);
    if (this.stats.captureTimeHistory.length > 100) {
      this.stats.captureTimeHistory.shift();
    }

    const sum = this.stats.captureTimeHistory.reduce((a, b) => a + b, 0);
    this.stats.averageCaptureTime = Math.round(sum / this.stats.captureTimeHistory.length);
  }

  /**
   * Get statistics
   *
   * @returns {Object} Statistics
   *
   * @example
   * const stats = forensics.getStats();
   * console.log('Total captures:', stats.totalCaptures);
   * console.log('Average capture time:', stats.averageCaptureTime, 'ms');
   */
  getStats() {
    return {
      ...this.stats,
      timestamp: Date.now()
    };
  }

  /**
   * Reset statistics
   *
   * @returns {Object} Result
   */
  resetStats() {
    this.stats = {
      totalCaptures: 0,
      lastCaptureTime: null,
      lastCaptureUrl: null,
      averageCaptureTime: 0,
      captureTimeHistory: []
    };

    return {
      success: true,
      message: 'Statistics reset',
      timestamp: Date.now()
    };
  }

  /**
   * Log message
   * @private
   * @param {string} level - Log level
   * @param {string} message - Message
   */
  _log(level, message) {
    if (this.logger && this.logger[level]) {
      this.logger[level]('[PageForensics] ' + message);
    } else if (typeof console !== 'undefined' && console[level]) {
      console[level]('[PageForensics] ' + message);
    }
  }
}

// =============================================================================
// Global Instance Management
// =============================================================================

let pageForensicsInstance = null;

/**
 * Get or create PageForensics singleton instance
 *
 * @param {Object} options - Configuration options
 * @returns {PageForensics} PageForensics instance
 *
 * @example
 * const forensics = getPageForensics({ networkMonitor: myMonitor });
 * const bundle = await forensics.captureForensics();
 */
function getPageForensics(options = {}) {
  if (!pageForensicsInstance) {
    pageForensicsInstance = new PageForensics(options);
  }
  return pageForensicsInstance;
}

// =============================================================================
// MCP Command Handlers
// =============================================================================

/**
 * MCP command: Capture page forensics bundle
 *
 * @param {Object} options - Capture options
 * @returns {Promise<Object>} Forensics bundle
 */
async function mcpCapturePageForensics(options = {}) {
  const forensics = getPageForensics();
  return await forensics.captureForensics(options);
}

/**
 * MCP command: Get DOM structure
 *
 * @returns {Object} DOM structure analysis
 */
function mcpGetDOMStructure() {
  const forensics = getPageForensics();
  return forensics.analyzeDOMStructure();
}

/**
 * MCP command: Get script inventory
 *
 * @returns {Object} Script analysis
 */
function mcpGetScriptInventory() {
  const forensics = getPageForensics();
  return forensics.analyzeScripts();
}

/**
 * MCP command: Get external resources
 *
 * @returns {Object} External resources
 */
function mcpGetExternalResources() {
  const forensics = getPageForensics();
  return forensics.getExternalResources();
}

/**
 * MCP command: Get network forensics
 *
 * @returns {Object} Network forensics
 */
function mcpGetNetworkForensics() {
  const forensics = getPageForensics();
  return forensics.getNetworkForensics();
}

/**
 * MCP command: Analyze storage
 *
 * @returns {Promise<Object>} Storage analysis
 */
async function mcpAnalyzeStorage() {
  const forensics = getPageForensics();
  return await forensics.analyzeStorage();
}

/**
 * MCP command: Get security headers
 *
 * @returns {Object} Security headers
 */
function mcpGetSecurityHeaders() {
  const forensics = getPageForensics();
  return forensics.getSecurityHeaders();
}

/**
 * MCP command: Get performance metrics
 *
 * @returns {Object} Performance metrics
 */
function mcpGetPerformanceMetrics() {
  const forensics = getPageForensics();
  return forensics.getPerformanceMetrics();
}

// =============================================================================
// Exports
// =============================================================================

if (typeof globalThis !== 'undefined') {
  globalThis.PageForensics = PageForensics;
  globalThis.getPageForensics = getPageForensics;

  // MCP commands
  globalThis.mcpCapturePageForensics = mcpCapturePageForensics;
  globalThis.mcpGetDOMStructure = mcpGetDOMStructure;
  globalThis.mcpGetScriptInventory = mcpGetScriptInventory;
  globalThis.mcpGetExternalResources = mcpGetExternalResources;
  globalThis.mcpGetNetworkForensics = mcpGetNetworkForensics;
  globalThis.mcpAnalyzeStorage = mcpAnalyzeStorage;
  globalThis.mcpGetSecurityHeaders = mcpGetSecurityHeaders;
  globalThis.mcpGetPerformanceMetrics = mcpGetPerformanceMetrics;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PageForensics,
    getPageForensics,

    // MCP commands
    mcpCapturePageForensics,
    mcpGetDOMStructure,
    mcpGetScriptInventory,
    mcpGetExternalResources,
    mcpGetNetworkForensics,
    mcpAnalyzeStorage,
    mcpGetSecurityHeaders,
    mcpGetPerformanceMetrics
  };
}
