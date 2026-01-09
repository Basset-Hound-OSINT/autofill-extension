/**
 * Basset Hound Browser Automation - Infinite Scroll Detector
 * Phase 16.2: Dynamic Content Detection
 *
 * Detects and handles infinite scroll patterns for automatic OSINT scanning.
 * Uses IntersectionObserver to detect when new content loads.
 *
 * Features:
 * - Automatic detection of infinite scroll patterns
 * - Scroll position tracking to avoid re-scanning
 * - "Scanning..." visual indicator
 * - Pause/resume functionality
 * - Configurable scroll sensitivity
 *
 * @module utils/detection/scroll-detector
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * Scroll detector configuration
 */
const SCROLL_CONFIG = {
  // Intersection observer settings
  ROOT_MARGIN: '200px',             // Start detecting 200px before bottom
  THRESHOLD: 0.1,                   // Trigger when 10% visible

  // Scroll tracking
  SCROLL_DEBOUNCE: 300,             // ms to wait after scrolling
  MIN_SCROLL_DISTANCE: 100,         // Minimum scroll distance to track

  // Scanning settings
  SCAN_DELAY: 500,                  // ms to wait before scanning new content
  RESCAN_DELAY: 2000,               // ms before allowing rescan of same area

  // Content detection
  MIN_NEW_ELEMENTS: 3,              // Minimum new elements to trigger scan
  CONTENT_SELECTORS: [              // Selectors for content containers
    '[class*="feed"]',
    '[class*="list"]',
    '[class*="items"]',
    '[class*="results"]',
    '[class*="cards"]',
    '[class*="posts"]',
    'article',
    '[role="article"]',
    '[role="listitem"]'
  ],

  // Infinite scroll patterns
  SENTINEL_SELECTORS: [             // Elements that indicate more content
    '[class*="loading"]',
    '[class*="spinner"]',
    '[class*="loader"]',
    '.load-more',
    '[data-loading]',
    '[aria-busy="true"]'
  ],

  // Performance
  MAX_TRACKED_ELEMENTS: 1000,       // Maximum elements to track
  CLEANUP_INTERVAL: 60000,          // Cleanup interval (1 minute)

  // Visual indicator
  SHOW_INDICATOR: true,             // Show scanning indicator
  INDICATOR_DURATION: 2000,         // How long to show indicator
  INDICATOR_POSITION: 'bottom-right' // Position of indicator
};

// =============================================================================
// ScrollDetector Class
// =============================================================================

/**
 * Detects infinite scroll and triggers scanning of new content
 */
class ScrollDetector {
  /**
   * Create a new scroll detector
   * @param {Object} options - Configuration options
   * @param {Function} options.onNewContent - Callback for new content detected
   * @param {Function} options.onStatusChange - Callback for status changes
   * @param {Object} options.config - Override default configuration
   */
  constructor(options = {}) {
    this.onNewContent = options.onNewContent || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.config = { ...SCROLL_CONFIG, ...(options.config || {}) };

    // State
    this.isActive = false;
    this.isPaused = false;
    this.isScanning = false;

    // Observers
    this.intersectionObserver = null;
    this.resizeObserver = null;

    // Tracking
    this.trackedElements = new Set();
    this.scannedElements = new Map(); // Map<Element, timestamp>
    this.lastScrollY = 0;
    this.scrollDirection = 'down';

    // Sentinels (elements that trigger loading)
    this.sentinels = new Set();

    // Timers
    this.scrollTimer = null;
    this.scanTimer = null;
    this.cleanupTimer = null;

    // Visual indicator
    this.indicator = null;
    this.indicatorTimer = null;

    // Statistics
    this.stats = {
      totalScrolls: 0,
      contentLoaded: 0,
      elementsScanned: 0,
      scrollDistance: 0,
      lastScrollTime: null
    };

    // Bind methods
    this.handleScroll = this.handleScroll.bind(this);
    this.handleIntersection = this.handleIntersection.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.cleanup = this.cleanup.bind(this);
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Start scroll detection
   */
  start() {
    if (this.isActive) {
      console.warn('[ScrollDetector] Already active');
      return;
    }

    this.isActive = true;
    this.isPaused = false;

    // Create intersection observer
    this.createIntersectionObserver();

    // Create resize observer
    this.createResizeObserver();

    // Listen for scroll events
    window.addEventListener('scroll', this.handleScroll, { passive: true });

    // Find initial content and sentinels
    this.findContentElements();
    this.findSentinels();

    // Start cleanup timer
    this.cleanupTimer = setInterval(this.cleanup, this.config.CLEANUP_INTERVAL);

    // Create visual indicator if enabled
    if (this.config.SHOW_INDICATOR) {
      this.createIndicator();
    }

    this.updateStatus('active', 'Scroll detection started');
    console.log('[ScrollDetector] Started');
  }

  /**
   * Stop scroll detection
   */
  stop() {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;

    // Disconnect observers
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Remove event listeners
    window.removeEventListener('scroll', this.handleScroll);

    // Clear timers
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
      this.scrollTimer = null;
    }

    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Remove indicator
    this.removeIndicator();

    // Clear tracking
    this.trackedElements.clear();
    this.scannedElements.clear();
    this.sentinels.clear();

    this.updateStatus('stopped', 'Scroll detection stopped');
    console.log('[ScrollDetector] Stopped');
  }

  /**
   * Pause scroll detection
   */
  pause() {
    if (!this.isActive || this.isPaused) {
      return;
    }

    this.isPaused = true;
    this.updateStatus('paused', 'Scroll detection paused');
    console.log('[ScrollDetector] Paused');
  }

  /**
   * Resume scroll detection
   */
  resume() {
    if (!this.isActive || !this.isPaused) {
      return;
    }

    this.isPaused = false;
    this.updateStatus('active', 'Scroll detection resumed');
    console.log('[ScrollDetector] Resumed');
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

    // Recreate observers if needed
    if (this.isActive) {
      this.stop();
      this.start();
    }

    console.log('[ScrollDetector] Configuration updated', newConfig);
  }

  // ===========================================================================
  // Observer Setup
  // ===========================================================================

  /**
   * Create intersection observer for detecting new content
   */
  createIntersectionObserver() {
    const options = {
      root: null, // viewport
      rootMargin: this.config.ROOT_MARGIN,
      threshold: this.config.THRESHOLD
    };

    this.intersectionObserver = new IntersectionObserver(
      this.handleIntersection,
      options
    );
  }

  /**
   * Create resize observer for detecting content size changes
   */
  createResizeObserver() {
    if (!('ResizeObserver' in window)) {
      return; // Not supported
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      if (this.isPaused) return;

      for (const entry of entries) {
        // Check if element grew significantly
        const element = entry.target;
        if (this.trackedElements.has(element)) {
          this.handleContentChange(element, 'resize');
        }
      }
    });
  }

  // ===========================================================================
  // Content Detection
  // ===========================================================================

  /**
   * Find content elements to track
   */
  findContentElements() {
    const selector = this.config.CONTENT_SELECTORS.join(', ');
    const elements = document.querySelectorAll(selector);

    for (const element of elements) {
      this.trackElement(element);
    }

    console.log(`[ScrollDetector] Tracking ${this.trackedElements.size} content elements`);
  }

  /**
   * Find sentinel elements that indicate loading
   */
  findSentinels() {
    const selector = this.config.SENTINEL_SELECTORS.join(', ');
    const elements = document.querySelectorAll(selector);

    for (const element of elements) {
      this.observeSentinel(element);
    }

    console.log(`[ScrollDetector] Found ${this.sentinels.size} sentinel elements`);
  }

  /**
   * Track an element for scroll detection
   * @param {Element} element - Element to track
   */
  trackElement(element) {
    if (this.trackedElements.has(element)) {
      return; // Already tracking
    }

    if (this.trackedElements.size >= this.config.MAX_TRACKED_ELEMENTS) {
      console.warn('[ScrollDetector] Max tracked elements reached');
      return;
    }

    this.trackedElements.add(element);

    // Observe with intersection observer
    if (this.intersectionObserver) {
      this.intersectionObserver.observe(element);
    }

    // Observe with resize observer
    if (this.resizeObserver) {
      this.resizeObserver.observe(element);
    }
  }

  /**
   * Observe a sentinel element
   * @param {Element} element - Sentinel element
   */
  observeSentinel(element) {
    if (this.sentinels.has(element)) {
      return; // Already observing
    }

    this.sentinels.add(element);

    // Observe with intersection observer
    if (this.intersectionObserver) {
      this.intersectionObserver.observe(element);
    }

    console.log('[ScrollDetector] Observing sentinel element');
  }

  // ===========================================================================
  // Event Handlers
  // ===========================================================================

  /**
   * Handle scroll events
   */
  handleScroll() {
    if (!this.isActive || this.isPaused) {
      return;
    }

    const currentScrollY = window.scrollY;
    const scrollDistance = Math.abs(currentScrollY - this.lastScrollY);

    // Update scroll direction
    if (scrollDistance >= this.config.MIN_SCROLL_DISTANCE) {
      this.scrollDirection = currentScrollY > this.lastScrollY ? 'down' : 'up';
      this.stats.scrollDistance += scrollDistance;
      this.stats.totalScrolls++;
      this.stats.lastScrollTime = new Date().toISOString();
    }

    this.lastScrollY = currentScrollY;

    // Debounce scroll processing
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
    }

    this.scrollTimer = setTimeout(() => {
      this.processScroll();
    }, this.config.SCROLL_DEBOUNCE);
  }

  /**
   * Handle intersection observer events
   * @param {IntersectionObserverEntry[]} entries - Intersection entries
   */
  handleIntersection(entries) {
    if (!this.isActive || this.isPaused) {
      return;
    }

    for (const entry of entries) {
      if (entry.isIntersecting) {
        const element = entry.target;

        // Check if this is a sentinel
        if (this.sentinels.has(element)) {
          this.handleSentinelVisible(element);
        }
        // Check if this is a content element
        else if (this.trackedElements.has(element)) {
          this.handleContentVisible(element);
        }
      }
    }
  }

  /**
   * Handle resize observer events
   */
  handleResize() {
    if (!this.isActive || this.isPaused) {
      return;
    }

    // Look for new content elements
    this.findContentElements();
    this.findSentinels();
  }

  /**
   * Handle sentinel element becoming visible
   * @param {Element} element - Sentinel element
   */
  handleSentinelVisible(element) {
    console.log('[ScrollDetector] Sentinel visible - content loading');

    // Show indicator
    this.showIndicator('Loading more content...');

    // Schedule scan after delay
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
    }

    this.scanTimer = setTimeout(() => {
      this.scanForNewContent();
    }, this.config.SCAN_DELAY);
  }

  /**
   * Handle content element becoming visible
   * @param {Element} element - Content element
   */
  handleContentVisible(element) {
    // Check if we've scanned this recently
    const now = Date.now();
    const lastScan = this.scannedElements.get(element);

    if (lastScan && (now - lastScan) < this.config.RESCAN_DELAY) {
      return; // Too soon to rescan
    }

    // Mark as scanned
    this.scannedElements.set(element, now);

    // Trigger content scan
    this.handleContentChange(element, 'visible');
  }

  /**
   * Handle content change
   * @param {Element} element - Changed element
   * @param {string} reason - Change reason
   */
  handleContentChange(element, reason) {
    if (this.isScanning) {
      return; // Already scanning
    }

    this.isScanning = true;
    this.showIndicator(`Scanning ${reason} content...`);

    // Notify callback
    this.onNewContent({
      element,
      reason,
      timestamp: new Date().toISOString()
    });

    this.stats.contentLoaded++;
    this.stats.elementsScanned++;

    // Reset scanning flag
    setTimeout(() => {
      this.isScanning = false;
    }, 500);
  }

  // ===========================================================================
  // Content Scanning
  // ===========================================================================

  /**
   * Process scroll event and look for new content
   */
  processScroll() {
    // Look for new content elements
    const newElements = this.detectNewElements();

    if (newElements.length >= this.config.MIN_NEW_ELEMENTS) {
      console.log(`[ScrollDetector] Detected ${newElements.length} new elements`);

      // Track new elements
      for (const element of newElements) {
        this.trackElement(element);
      }

      // Trigger scan
      this.scanForNewContent();
    }

    // Update sentinels
    this.findSentinels();
  }

  /**
   * Detect new elements in the DOM
   * @returns {Element[]} New elements
   */
  detectNewElements() {
    const selector = this.config.CONTENT_SELECTORS.join(', ');
    const allElements = document.querySelectorAll(selector);
    const newElements = [];

    for (const element of allElements) {
      if (!this.trackedElements.has(element)) {
        newElements.push(element);
      }
    }

    return newElements;
  }

  /**
   * Scan for new content
   */
  scanForNewContent() {
    if (this.isPaused || this.isScanning) {
      return;
    }

    const newElements = this.detectNewElements();

    if (newElements.length === 0) {
      return;
    }

    this.isScanning = true;
    this.showIndicator(`Scanning ${newElements.length} new elements...`);

    // Notify callback
    this.onNewContent({
      elements: newElements,
      count: newElements.length,
      scrollY: window.scrollY,
      timestamp: new Date().toISOString()
    });

    this.stats.contentLoaded++;
    this.stats.elementsScanned += newElements.length;

    // Track new elements
    for (const element of newElements) {
      this.trackElement(element);
    }

    // Reset scanning flag
    setTimeout(() => {
      this.isScanning = false;
    }, 500);
  }

  // ===========================================================================
  // Visual Indicator
  // ===========================================================================

  /**
   * Create visual indicator element
   */
  createIndicator() {
    if (this.indicator) {
      return; // Already exists
    }

    this.indicator = document.createElement('div');
    this.indicator.id = 'basset-scroll-indicator';
    this.indicator.style.cssText = `
      position: fixed;
      ${this.config.INDICATOR_POSITION.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
      ${this.config.INDICATOR_POSITION.includes('right') ? 'right: 20px;' : 'left: 20px;'}
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 10px;
    `;

    // Add spinner
    const spinner = document.createElement('div');
    spinner.style.cssText = `
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    `;

    this.indicator.appendChild(spinner);

    // Add text container
    const text = document.createElement('span');
    text.id = 'basset-scroll-indicator-text';
    this.indicator.appendChild(text);

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(this.indicator);
  }

  /**
   * Show scanning indicator
   * @param {string} message - Message to display
   */
  showIndicator(message) {
    if (!this.config.SHOW_INDICATOR || !this.indicator) {
      return;
    }

    // Update text
    const textElement = this.indicator.querySelector('#basset-scroll-indicator-text');
    if (textElement) {
      textElement.textContent = message;
    }

    // Show indicator
    this.indicator.style.opacity = '1';

    // Auto-hide after duration
    if (this.indicatorTimer) {
      clearTimeout(this.indicatorTimer);
    }

    this.indicatorTimer = setTimeout(() => {
      this.hideIndicator();
    }, this.config.INDICATOR_DURATION);
  }

  /**
   * Hide scanning indicator
   */
  hideIndicator() {
    if (this.indicator) {
      this.indicator.style.opacity = '0';
    }
  }

  /**
   * Remove indicator element
   */
  removeIndicator() {
    if (this.indicator) {
      this.indicator.remove();
      this.indicator = null;
    }

    if (this.indicatorTimer) {
      clearTimeout(this.indicatorTimer);
      this.indicatorTimer = null;
    }
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Cleanup old tracked elements
   */
  cleanup() {
    const now = Date.now();
    const elementsToRemove = [];

    // Remove elements that are no longer in the DOM
    for (const element of this.trackedElements) {
      if (!document.contains(element)) {
        elementsToRemove.push(element);
      }
    }

    for (const element of elementsToRemove) {
      this.trackedElements.delete(element);
      this.scannedElements.delete(element);

      if (this.intersectionObserver) {
        this.intersectionObserver.unobserve(element);
      }

      if (this.resizeObserver) {
        this.resizeObserver.unobserve(element);
      }
    }

    // Remove old scan timestamps
    for (const [element, timestamp] of this.scannedElements) {
      if (now - timestamp > this.config.RESCAN_DELAY * 10) {
        this.scannedElements.delete(element);
      }
    }

    if (elementsToRemove.length > 0) {
      console.log(`[ScrollDetector] Cleaned up ${elementsToRemove.length} elements`);
    }
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
  window.ScrollDetector = ScrollDetector;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ScrollDetector, SCROLL_CONFIG };
}
