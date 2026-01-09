/**
 * Basset Hound Browser Automation - Dynamic Content Mutation Detector
 * Phase 16.2: Dynamic Content Detection
 *
 * Detects OSINT patterns in dynamically loaded content using MutationObserver.
 * Handles:
 * - AJAX-loaded content
 * - DOM mutations (new elements, modified text)
 * - Shadow DOM mutations
 * - Debounced scanning to avoid excessive processing
 * - Incremental scanning (only new/changed content)
 *
 * @module utils/detection/mutation-detector
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * Mutation detector configuration
 */
const MUTATION_CONFIG = {
  // Debounce settings
  DEBOUNCE_DELAY: 500,              // ms to wait before scanning after mutations
  MAX_DEBOUNCE_DELAY: 2000,         // Maximum time to wait before forcing scan

  // Scanning settings
  MIN_TEXT_LENGTH: 3,               // Minimum text length to scan
  MAX_MUTATIONS_PER_SCAN: 100,      // Maximum mutations to process at once
  SCAN_THROTTLE: 1000,              // Minimum time between scans

  // Performance settings
  USE_IDLE_CALLBACK: true,          // Use requestIdleCallback for scanning
  IDLE_TIMEOUT: 2000,               // Max time to wait for idle
  MAX_SCAN_TIME: 100,               // Max time per scan (ms)

  // Shadow DOM settings
  OBSERVE_SHADOW_DOM: true,         // Monitor shadow DOM changes
  SHADOW_DOM_DEPTH: 5,              // Maximum shadow DOM depth

  // Cache settings
  CACHE_DURATION: 5 * 60 * 1000,    // 5 minutes
  MAX_CACHE_SIZE: 1000,             // Maximum cached elements

  // Mutation observer settings
  OBSERVE_ATTRIBUTES: true,         // Watch attribute changes
  OBSERVE_CHILD_LIST: true,         // Watch child additions/removals
  OBSERVE_SUBTREE: true,            // Watch entire subtree
  OBSERVE_CHARACTER_DATA: true,     // Watch text content changes

  // Attribute filter
  WATCHED_ATTRIBUTES: [
    'data-content',
    'data-text',
    'aria-label',
    'title',
    'alt',
    'placeholder',
    'value'
  ]
};

// =============================================================================
// MutationDetector Class
// =============================================================================

/**
 * Detects and tracks DOM mutations for OSINT pattern scanning
 */
class MutationDetector {
  /**
   * Create a new mutation detector
   * @param {Object} options - Configuration options
   * @param {Function} options.onDetection - Callback for new detections
   * @param {Function} options.onStatusChange - Callback for status changes
   * @param {Object} options.patterns - OSINT patterns to detect
   * @param {Object} options.config - Override default configuration
   */
  constructor(options = {}) {
    this.onDetection = options.onDetection || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.patterns = options.patterns || {};
    this.config = { ...MUTATION_CONFIG, ...(options.config || {}) };

    // State
    this.isActive = false;
    this.isPaused = false;
    this.isScanning = false;

    // Observers
    this.observers = new Map(); // Map<Element, MutationObserver>
    this.shadowObservers = new Set(); // Set of shadow root observers

    // Mutation tracking
    this.pendingMutations = [];
    this.debounceTimer = null;
    this.lastScanTime = 0;
    this.scanCount = 0;

    // Caching
    this.scannedElements = new Map(); // Map<Element, timestamp>
    this.scannedText = new Map(); // Map<text hash, timestamp>

    // Statistics
    this.stats = {
      totalMutations: 0,
      scannedMutations: 0,
      detectedPatterns: 0,
      skippedMutations: 0,
      shadowRootsFound: 0,
      scanDuration: 0,
      lastScanTime: null
    };

    // Bind methods
    this.handleMutations = this.handleMutations.bind(this);
    this.processPendingMutations = this.processPendingMutations.bind(this);
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Start observing mutations
   * @param {Element} rootElement - Root element to observe (default: document.body)
   */
  start(rootElement = document.body) {
    if (this.isActive) {
      console.warn('[MutationDetector] Already active');
      return;
    }

    this.isActive = true;
    this.isPaused = false;

    // Create main observer
    this.createObserver(rootElement);

    // Observe existing shadow DOMs
    if (this.config.OBSERVE_SHADOW_DOM) {
      this.observeExistingShadowDOMs(rootElement);
    }

    this.updateStatus('active', 'Mutation detection started');
    console.log('[MutationDetector] Started observing', rootElement);
  }

  /**
   * Stop observing mutations
   */
  stop() {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;

    // Disconnect all observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.shadowObservers.clear();

    // Clear pending work
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingMutations = [];

    this.updateStatus('stopped', 'Mutation detection stopped');
    console.log('[MutationDetector] Stopped');
  }

  /**
   * Pause mutation detection
   */
  pause() {
    if (!this.isActive || this.isPaused) {
      return;
    }

    this.isPaused = true;

    // Clear pending work
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingMutations = [];

    this.updateStatus('paused', 'Mutation detection paused');
    console.log('[MutationDetector] Paused');
  }

  /**
   * Resume mutation detection
   */
  resume() {
    if (!this.isActive || !this.isPaused) {
      return;
    }

    this.isPaused = false;
    this.updateStatus('active', 'Mutation detection resumed');
    console.log('[MutationDetector] Resumed');
  }

  /**
   * Force immediate scan of pending mutations
   */
  forceScan() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.processPendingMutations();
  }

  /**
   * Clear cache and reset state
   */
  clearCache() {
    this.scannedElements.clear();
    this.scannedText.clear();
    console.log('[MutationDetector] Cache cleared');
  }

  /**
   * Get statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration values
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('[MutationDetector] Configuration updated', newConfig);
  }

  // ===========================================================================
  // Observer Management
  // ===========================================================================

  /**
   * Create and start a mutation observer for an element
   * @param {Element} element - Element to observe
   */
  createObserver(element) {
    if (this.observers.has(element)) {
      return; // Already observing
    }

    const observer = new MutationObserver(this.handleMutations);

    const observerConfig = {
      childList: this.config.OBSERVE_CHILD_LIST,
      subtree: this.config.OBSERVE_SUBTREE,
      characterData: this.config.OBSERVE_CHARACTER_DATA,
      characterDataOldValue: true,
      attributes: this.config.OBSERVE_ATTRIBUTES,
      attributeOldValue: true,
      attributeFilter: this.config.WATCHED_ATTRIBUTES
    };

    observer.observe(element, observerConfig);
    this.observers.set(element, observer);
  }

  /**
   * Find and observe existing shadow DOMs
   * @param {Element} rootElement - Root element to search
   * @param {number} depth - Current recursion depth
   */
  observeExistingShadowDOMs(rootElement, depth = 0) {
    if (depth > this.config.SHADOW_DOM_DEPTH) {
      return;
    }

    // Check if this element has a shadow root
    if (rootElement.shadowRoot) {
      this.observeShadowRoot(rootElement.shadowRoot);
      this.stats.shadowRootsFound++;
    }

    // Recursively check children
    const children = rootElement.children || [];
    for (const child of children) {
      this.observeExistingShadowDOMs(child, depth + 1);
    }
  }

  /**
   * Observe a shadow root
   * @param {ShadowRoot} shadowRoot - Shadow root to observe
   */
  observeShadowRoot(shadowRoot) {
    if (this.shadowObservers.has(shadowRoot)) {
      return; // Already observing
    }

    const observer = new MutationObserver(this.handleMutations);

    const observerConfig = {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: true,
      attributes: this.config.OBSERVE_ATTRIBUTES,
      attributeOldValue: true,
      attributeFilter: this.config.WATCHED_ATTRIBUTES
    };

    observer.observe(shadowRoot, observerConfig);
    this.shadowObservers.add(shadowRoot);

    console.log('[MutationDetector] Observing shadow root');
  }

  // ===========================================================================
  // Mutation Handling
  // ===========================================================================

  /**
   * Handle mutation events from MutationObserver
   * @param {MutationRecord[]} mutations - Array of mutation records
   */
  handleMutations(mutations) {
    if (!this.isActive || this.isPaused) {
      return;
    }

    this.stats.totalMutations += mutations.length;

    // Filter and collect relevant mutations
    for (const mutation of mutations) {
      if (this.isRelevantMutation(mutation)) {
        this.pendingMutations.push(mutation);

        // Check for new shadow roots
        if (this.config.OBSERVE_SHADOW_DOM && mutation.type === 'childList') {
          this.checkForNewShadowRoots(mutation.addedNodes);
        }
      } else {
        this.stats.skippedMutations++;
      }
    }

    // Debounce scanning
    this.debounceScan();
  }

  /**
   * Check if a mutation is relevant for scanning
   * @param {MutationRecord} mutation - Mutation record
   * @returns {boolean} True if relevant
   */
  isRelevantMutation(mutation) {
    // Skip mutations in script/style elements
    const target = mutation.target;
    if (target.nodeType === Node.ELEMENT_NODE) {
      const tagName = target.tagName?.toLowerCase();
      if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') {
        return false;
      }
    }

    // Skip mutations with no visible changes
    if (mutation.type === 'characterData') {
      const newText = mutation.target.textContent || '';
      const oldText = mutation.oldValue || '';

      if (newText === oldText || newText.length < this.config.MIN_TEXT_LENGTH) {
        return false;
      }
    }

    // Skip attribute changes that don't contain text
    if (mutation.type === 'attributes') {
      const element = mutation.target;
      const attrValue = element.getAttribute(mutation.attributeName);

      if (!attrValue || attrValue.length < this.config.MIN_TEXT_LENGTH) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check added nodes for new shadow roots
   * @param {NodeList} nodes - Added nodes
   */
  checkForNewShadowRoots(nodes) {
    for (const node of nodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Check this element
        if (node.shadowRoot) {
          this.observeShadowRoot(node.shadowRoot);
          this.stats.shadowRootsFound++;
        }

        // Check descendants
        const descendants = node.querySelectorAll('*');
        for (const descendant of descendants) {
          if (descendant.shadowRoot) {
            this.observeShadowRoot(descendant.shadowRoot);
            this.stats.shadowRootsFound++;
          }
        }
      }
    }
  }

  // ===========================================================================
  // Scanning & Detection
  // ===========================================================================

  /**
   * Debounce the scanning process
   */
  debounceScan() {
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Check if we've exceeded max debounce delay
    const timeSinceLastScan = Date.now() - this.lastScanTime;
    const shouldForce = timeSinceLastScan > this.config.MAX_DEBOUNCE_DELAY;

    // Schedule scan
    const delay = shouldForce ? 0 : this.config.DEBOUNCE_DELAY;

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.processPendingMutations();
    }, delay);
  }

  /**
   * Process pending mutations and scan for patterns
   */
  processPendingMutations() {
    if (!this.isActive || this.isPaused || this.isScanning) {
      return;
    }

    // Check throttle
    const now = Date.now();
    const timeSinceLastScan = now - this.lastScanTime;
    if (timeSinceLastScan < this.config.SCAN_THROTTLE) {
      // Reschedule
      this.debounceScan();
      return;
    }

    // Get mutations to process
    const mutations = this.pendingMutations.splice(0, this.config.MAX_MUTATIONS_PER_SCAN);

    if (mutations.length === 0) {
      return;
    }

    this.isScanning = true;
    this.updateStatus('scanning', `Scanning ${mutations.length} mutations...`);

    const scanStart = performance.now();

    // Use idle callback if available
    if (this.config.USE_IDLE_CALLBACK && 'requestIdleCallback' in window) {
      requestIdleCallback((deadline) => {
        this.scanMutations(mutations, deadline);
        this.finalizeScan(scanStart);
      }, { timeout: this.config.IDLE_TIMEOUT });
    } else {
      this.scanMutations(mutations);
      this.finalizeScan(scanStart);
    }
  }

  /**
   * Scan mutations for OSINT patterns
   * @param {MutationRecord[]} mutations - Mutations to scan
   * @param {IdleDeadline} [deadline] - Idle deadline if using requestIdleCallback
   */
  scanMutations(mutations, deadline = null) {
    const detections = [];
    const scanStart = performance.now();

    for (const mutation of mutations) {
      // Check time budget
      if (deadline && deadline.timeRemaining() < 1) {
        console.log('[MutationDetector] Out of idle time, deferring remaining mutations');
        this.pendingMutations.unshift(...mutations.slice(mutations.indexOf(mutation)));
        break;
      }

      // Check max scan time
      if (performance.now() - scanStart > this.config.MAX_SCAN_TIME) {
        console.log('[MutationDetector] Max scan time exceeded, deferring remaining mutations');
        this.pendingMutations.unshift(...mutations.slice(mutations.indexOf(mutation)));
        break;
      }

      // Extract content to scan
      const content = this.extractContentFromMutation(mutation);

      if (content.length === 0) {
        continue;
      }

      // Scan content for patterns
      for (const item of content) {
        // Check cache
        if (this.isContentCached(item)) {
          continue;
        }

        const found = this.scanContent(item.text, item.element, item.source);
        detections.push(...found);

        // Update cache
        this.cacheContent(item);
      }

      this.stats.scannedMutations++;
    }

    // Report detections
    if (detections.length > 0) {
      this.stats.detectedPatterns += detections.length;
      this.onDetection({
        detections,
        source: 'mutation',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Extract scannable content from a mutation
   * @param {MutationRecord} mutation - Mutation record
   * @returns {Array<{text: string, element: Element, source: string}>} Content items
   */
  extractContentFromMutation(mutation) {
    const content = [];

    switch (mutation.type) {
      case 'characterData':
        // Text node changed
        const textNode = mutation.target;
        const parentElement = textNode.parentElement;

        if (parentElement) {
          content.push({
            text: textNode.textContent || '',
            element: parentElement,
            source: 'text-node'
          });
        }
        break;

      case 'childList':
        // Nodes added/removed
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Extract text from element and descendants
            const text = this.extractTextFromElement(node);
            if (text.length >= this.config.MIN_TEXT_LENGTH) {
              content.push({
                text,
                element: node,
                source: 'added-element'
              });
            }
          } else if (node.nodeType === Node.TEXT_NODE) {
            // Text node added
            const text = node.textContent || '';
            const parentElement = node.parentElement;

            if (text.length >= this.config.MIN_TEXT_LENGTH && parentElement) {
              content.push({
                text,
                element: parentElement,
                source: 'added-text-node'
              });
            }
          }
        }
        break;

      case 'attributes':
        // Attribute changed
        const element = mutation.target;
        const attrName = mutation.attributeName;
        const attrValue = element.getAttribute(attrName);

        if (attrValue && attrValue.length >= this.config.MIN_TEXT_LENGTH) {
          content.push({
            text: attrValue,
            element: element,
            source: `attribute-${attrName}`
          });
        }
        break;
    }

    return content;
  }

  /**
   * Extract text content from an element and its descendants
   * @param {Element} element - Element to extract from
   * @returns {string} Extracted text
   */
  extractTextFromElement(element) {
    // Get visible text content
    const text = element.innerText || element.textContent || '';

    // Also check data attributes
    const dataAttrs = [];
    for (const attr of this.config.WATCHED_ATTRIBUTES) {
      const value = element.getAttribute(attr);
      if (value) {
        dataAttrs.push(value);
      }
    }

    return [text, ...dataAttrs].join(' ').trim();
  }

  /**
   * Scan content for OSINT patterns
   * @param {string} text - Text to scan
   * @param {Element} element - Source element
   * @param {string} source - Source type
   * @returns {Array<Object>} Detected patterns
   */
  scanContent(text, element, source) {
    const detections = [];

    // Scan each pattern
    for (const [patternName, pattern] of Object.entries(this.patterns)) {
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
      let match;

      while ((match = regex.exec(text)) !== null) {
        const matchedText = match[0];

        // Validate match
        if (pattern.validate && !pattern.validate(matchedText)) {
          continue;
        }

        detections.push({
          type: patternName,
          value: matchedText,
          confidence: pattern.confidence || 0.5,
          element: element,
          source: source,
          context: this.getContext(text, match.index, matchedText.length),
          timestamp: Date.now()
        });
      }
    }

    return detections;
  }

  /**
   * Get context around a match
   * @param {string} text - Full text
   * @param {number} index - Match index
   * @param {number} length - Match length
   * @returns {string} Context string
   */
  getContext(text, index, length, contextLength = 50) {
    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + length + contextLength);

    let context = text.substring(start, end);

    if (start > 0) {
      context = '...' + context;
    }
    if (end < text.length) {
      context = context + '...';
    }

    return context;
  }

  /**
   * Finalize scan and update stats
   * @param {number} scanStart - Scan start time
   */
  finalizeScan(scanStart) {
    const scanDuration = performance.now() - scanStart;

    this.isScanning = false;
    this.lastScanTime = Date.now();
    this.scanCount++;

    this.stats.scanDuration += scanDuration;
    this.stats.lastScanTime = new Date().toISOString();

    // Update status
    const status = this.pendingMutations.length > 0 ? 'active' : 'idle';
    const message = this.pendingMutations.length > 0
      ? `Scan complete. ${this.pendingMutations.length} mutations pending...`
      : 'Scan complete. Idle.';

    this.updateStatus(status, message);

    // If there are more pending mutations, schedule next scan
    if (this.pendingMutations.length > 0) {
      this.debounceScan();
    }
  }

  // ===========================================================================
  // Caching
  // ===========================================================================

  /**
   * Check if content has been recently scanned
   * @param {Object} item - Content item
   * @returns {boolean} True if cached
   */
  isContentCached(item) {
    const now = Date.now();

    // Check element cache
    if (this.scannedElements.has(item.element)) {
      const timestamp = this.scannedElements.get(item.element);
      if (now - timestamp < this.config.CACHE_DURATION) {
        return true;
      }
    }

    // Check text cache
    const textHash = this.hashText(item.text);
    if (this.scannedText.has(textHash)) {
      const timestamp = this.scannedText.get(textHash);
      if (now - timestamp < this.config.CACHE_DURATION) {
        return true;
      }
    }

    return false;
  }

  /**
   * Cache content item
   * @param {Object} item - Content item
   */
  cacheContent(item) {
    const now = Date.now();

    // Cache element
    this.scannedElements.set(item.element, now);

    // Cache text
    const textHash = this.hashText(item.text);
    this.scannedText.set(textHash, now);

    // Cleanup old cache entries
    this.cleanupCache();
  }

  /**
   * Cleanup old cache entries
   */
  cleanupCache() {
    const now = Date.now();

    // Cleanup element cache
    if (this.scannedElements.size > this.config.MAX_CACHE_SIZE) {
      const toDelete = [];
      for (const [element, timestamp] of this.scannedElements) {
        if (now - timestamp > this.config.CACHE_DURATION) {
          toDelete.push(element);
        }
      }
      toDelete.forEach(element => this.scannedElements.delete(element));
    }

    // Cleanup text cache
    if (this.scannedText.size > this.config.MAX_CACHE_SIZE) {
      const toDelete = [];
      for (const [hash, timestamp] of this.scannedText) {
        if (now - timestamp > this.config.CACHE_DURATION) {
          toDelete.push(hash);
        }
      }
      toDelete.forEach(hash => this.scannedText.delete(hash));
    }
  }

  /**
   * Simple text hash function
   * @param {string} text - Text to hash
   * @returns {number} Hash value
   */
  hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Update status and notify listeners
   * @param {string} status - Status value
   * @param {string} message - Status message
   */
  updateStatus(status, message) {
    this.onStatusChange({
      status,
      message,
      stats: this.getStats(),
      timestamp: new Date().toISOString()
    });
  }
}

// =============================================================================
// Export
// =============================================================================

// Make available globally for content script
if (typeof window !== 'undefined') {
  window.MutationDetector = MutationDetector;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MutationDetector, MUTATION_CONFIG };
}
