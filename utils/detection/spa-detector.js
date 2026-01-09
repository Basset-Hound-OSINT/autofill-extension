/**
 * Basset Hound Browser Automation - SPA Navigation Detector
 * Phase 16.2: Dynamic Content Detection
 *
 * Detects client-side route changes in Single Page Applications (SPAs).
 * Supports React, Vue, Angular, and other frameworks.
 *
 * Features:
 * - Detection of pushState/replaceState navigation
 * - Hash-based routing detection
 * - Framework-specific navigation hooks
 * - Re-scan on route changes
 * - Clear old detections when page "changes"
 * - Detection history tracking across routes
 *
 * @module utils/detection/spa-detector
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * SPA detector configuration
 */
const SPA_CONFIG = {
  // Detection settings
  DETECT_PUSHSTATE: true,           // Detect history.pushState
  DETECT_REPLACESTATE: true,        // Detect history.replaceState
  DETECT_POPSTATE: true,            // Detect back/forward navigation
  DETECT_HASHCHANGE: true,          // Detect hash-based routing

  // Scanning settings
  SCAN_DELAY: 500,                  // ms to wait before scanning after navigation
  RESCAN_DELAY: 2000,               // ms before allowing same-route rescan

  // Route change detection
  URL_CHANGE_THRESHOLD: 0.3,        // How much of URL must change (0-1)
  IGNORE_QUERY_PARAMS: false,       // Ignore query parameter changes
  IGNORE_HASH: false,               // Ignore hash changes

  // Framework detection
  DETECT_FRAMEWORKS: true,          // Auto-detect SPA frameworks
  FRAMEWORKS: {
    react: {
      selectors: ['[data-reactroot]', '[data-reactid]', '#root', '#app'],
      events: ['routechange', 'locationchange']
    },
    vue: {
      selectors: ['[data-v-]', '[data-vue-ssr]', '#app'],
      events: ['route:changed', 'router:navigated']
    },
    angular: {
      selectors: ['[ng-app]', '[ng-version]', 'app-root'],
      events: ['$locationChangeSuccess', 'NavigationEnd']
    },
    svelte: {
      selectors: ['[data-svelte]'],
      events: ['routeLoaded']
    },
    nextjs: {
      selectors: ['#__next'],
      events: ['routeChangeComplete']
    }
  },

  // History management
  MAX_HISTORY_SIZE: 100,            // Maximum route history to keep
  CLEAR_ON_NAVIGATION: false,       // Clear detections on route change

  // Performance
  DEBOUNCE_DELAY: 300,              // Debounce rapid route changes
  MAX_SCAN_TIME: 100                // Maximum time per scan
};

// =============================================================================
// SPADetector Class
// =============================================================================

/**
 * Detects and tracks SPA navigation for OSINT scanning
 */
class SPADetector {
  /**
   * Create a new SPA detector
   * @param {Object} options - Configuration options
   * @param {Function} options.onRouteChange - Callback for route changes
   * @param {Function} options.onStatusChange - Callback for status changes
   * @param {Object} options.config - Override default configuration
   */
  constructor(options = {}) {
    this.onRouteChange = options.onRouteChange || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.config = { ...SPA_CONFIG, ...(options.config || {}) };

    // State
    this.isActive = false;
    this.isPaused = false;
    this.currentRoute = null;
    this.previousRoute = null;

    // Framework detection
    this.detectedFramework = null;
    this.frameworkRoot = null;

    // History
    this.routeHistory = [];
    this.detectionHistory = new Map(); // Map<route, detections>

    // Original functions (for patching)
    this.originalPushState = null;
    this.originalReplaceState = null;

    // Timers
    this.debounceTimer = null;
    this.scanTimer = null;

    // Statistics
    this.stats = {
      totalNavigations: 0,
      scansTriggered: 0,
      frameworkDetected: null,
      lastNavigationTime: null,
      routesVisited: 0
    };

    // Bind methods
    this.handlePopState = this.handlePopState.bind(this);
    this.handleHashChange = this.handleHashChange.bind(this);
    this.handleRouteChange = this.handleRouteChange.bind(this);
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Start SPA navigation detection
   */
  start() {
    if (this.isActive) {
      console.warn('[SPADetector] Already active');
      return;
    }

    this.isActive = true;
    this.isPaused = false;

    // Detect framework
    if (this.config.DETECT_FRAMEWORKS) {
      this.detectFramework();
    }

    // Patch history methods
    this.patchHistoryMethods();

    // Add event listeners
    if (this.config.DETECT_POPSTATE) {
      window.addEventListener('popstate', this.handlePopState);
    }

    if (this.config.DETECT_HASHCHANGE) {
      window.addEventListener('hashchange', this.handleHashChange);
    }

    // Add framework-specific listeners
    this.addFrameworkListeners();

    // Record initial route
    this.currentRoute = this.getCurrentRoute();
    this.addToHistory(this.currentRoute);

    this.updateStatus('active', 'SPA navigation detection started');
    console.log('[SPADetector] Started', {
      framework: this.detectedFramework,
      route: this.currentRoute
    });
  }

  /**
   * Stop SPA navigation detection
   */
  stop() {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;

    // Restore original history methods
    this.unpatchHistoryMethods();

    // Remove event listeners
    window.removeEventListener('popstate', this.handlePopState);
    window.removeEventListener('hashchange', this.handleHashChange);

    // Remove framework-specific listeners
    this.removeFrameworkListeners();

    // Clear timers
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }

    this.updateStatus('stopped', 'SPA navigation detection stopped');
    console.log('[SPADetector] Stopped');
  }

  /**
   * Pause navigation detection
   */
  pause() {
    if (!this.isActive || this.isPaused) {
      return;
    }

    this.isPaused = true;
    this.updateStatus('paused', 'SPA navigation detection paused');
    console.log('[SPADetector] Paused');
  }

  /**
   * Resume navigation detection
   */
  resume() {
    if (!this.isActive || !this.isPaused) {
      return;
    }

    this.isPaused = false;
    this.updateStatus('active', 'SPA navigation detection resumed');
    console.log('[SPADetector] Resumed');
  }

  /**
   * Get route history
   * @returns {Array<Object>} Route history
   */
  getHistory() {
    return [...this.routeHistory];
  }

  /**
   * Get detections for a specific route
   * @param {string} route - Route path
   * @returns {Array<Object>} Detections for route
   */
  getDetectionsForRoute(route) {
    return this.detectionHistory.get(route) || [];
  }

  /**
   * Clear detection history
   */
  clearHistory() {
    this.routeHistory = [];
    this.detectionHistory.clear();
    console.log('[SPADetector] History cleared');
  }

  /**
   * Get statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this.stats,
      currentRoute: this.currentRoute,
      previousRoute: this.previousRoute,
      historySize: this.routeHistory.length,
      framework: this.detectedFramework
    };
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration values
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('[SPADetector] Configuration updated', newConfig);
  }

  // ===========================================================================
  // Framework Detection
  // ===========================================================================

  /**
   * Detect which SPA framework is being used
   */
  detectFramework() {
    for (const [name, framework] of Object.entries(this.config.FRAMEWORKS)) {
      for (const selector of framework.selectors) {
        const element = document.querySelector(selector);
        if (element) {
          this.detectedFramework = name;
          this.frameworkRoot = element;
          this.stats.frameworkDetected = name;

          console.log(`[SPADetector] Detected framework: ${name}`);
          return;
        }
      }
    }

    console.log('[SPADetector] No specific framework detected');
  }

  /**
   * Add framework-specific event listeners
   */
  addFrameworkListeners() {
    if (!this.detectedFramework) {
      return;
    }

    const framework = this.config.FRAMEWORKS[this.detectedFramework];

    // Add framework-specific event listeners
    for (const eventName of framework.events) {
      window.addEventListener(eventName, this.handleRouteChange);
    }

    // Special handling for Angular
    if (this.detectedFramework === 'angular') {
      this.addAngularListeners();
    }

    // Special handling for React Router
    if (this.detectedFramework === 'react') {
      this.addReactRouterListeners();
    }

    console.log(`[SPADetector] Added ${framework.events.length} framework listeners`);
  }

  /**
   * Remove framework-specific event listeners
   */
  removeFrameworkListeners() {
    if (!this.detectedFramework) {
      return;
    }

    const framework = this.config.FRAMEWORKS[this.detectedFramework];

    for (const eventName of framework.events) {
      window.removeEventListener(eventName, this.handleRouteChange);
    }
  }

  /**
   * Add Angular-specific listeners
   */
  addAngularListeners() {
    // Angular uses Zone.js, so we need to listen for zone tasks
    if (window.Zone) {
      const originalOnInvokeTask = window.Zone.current.onInvokeTask;

      window.Zone.current.onInvokeTask = (delegate, current, target, task, applyThis, applyArgs) => {
        if (task.source === 'XMLHttpRequest.send' || task.source === 'fetch') {
          // Navigation might be happening
          this.debounceRouteChange();
        }

        return originalOnInvokeTask ? originalOnInvokeTask.call(this, delegate, current, target, task, applyThis, applyArgs) : delegate.invokeTask(target, task, applyThis, applyArgs);
      };
    }
  }

  /**
   * Add React Router listeners
   */
  addReactRouterListeners() {
    // Watch for React Router events by observing the root element
    if (this.frameworkRoot) {
      const observer = new MutationObserver(() => {
        this.debounceRouteChange();
      });

      observer.observe(this.frameworkRoot, {
        childList: true,
        subtree: false
      });
    }
  }

  // ===========================================================================
  // History API Patching
  // ===========================================================================

  /**
   * Patch history.pushState and history.replaceState
   */
  patchHistoryMethods() {
    if (this.originalPushState) {
      return; // Already patched
    }

    // Save original functions
    this.originalPushState = history.pushState.bind(history);
    this.originalReplaceState = history.replaceState.bind(history);

    // Patch pushState
    if (this.config.DETECT_PUSHSTATE) {
      history.pushState = (state, title, url) => {
        const result = this.originalPushState(state, title, url);
        this.handleHistoryChange('pushState', url);
        return result;
      };
    }

    // Patch replaceState
    if (this.config.DETECT_REPLACESTATE) {
      history.replaceState = (state, title, url) => {
        const result = this.originalReplaceState(state, title, url);
        this.handleHistoryChange('replaceState', url);
        return result;
      };
    }

    console.log('[SPADetector] History methods patched');
  }

  /**
   * Restore original history methods
   */
  unpatchHistoryMethods() {
    if (!this.originalPushState) {
      return; // Not patched
    }

    history.pushState = this.originalPushState;
    history.replaceState = this.originalReplaceState;

    this.originalPushState = null;
    this.originalReplaceState = null;

    console.log('[SPADetector] History methods restored');
  }

  // ===========================================================================
  // Event Handlers
  // ===========================================================================

  /**
   * Handle popstate event (back/forward navigation)
   * @param {PopStateEvent} event - Popstate event
   */
  handlePopState(event) {
    if (!this.isActive || this.isPaused) {
      return;
    }

    console.log('[SPADetector] popstate event');
    this.handleRouteChange('popstate');
  }

  /**
   * Handle hashchange event
   * @param {HashChangeEvent} event - Hashchange event
   */
  handleHashChange(event) {
    if (!this.isActive || this.isPaused) {
      return;
    }

    console.log('[SPADetector] hashchange event');
    this.handleRouteChange('hashchange');
  }

  /**
   * Handle history API change
   * @param {string} method - Method name (pushState/replaceState)
   * @param {string} url - New URL
   */
  handleHistoryChange(method, url) {
    if (!this.isActive || this.isPaused) {
      return;
    }

    console.log(`[SPADetector] ${method}:`, url);
    this.handleRouteChange(method);
  }

  /**
   * Handle route change
   * @param {string} source - Change source
   */
  handleRouteChange(source) {
    if (!this.isActive || this.isPaused) {
      return;
    }

    // Debounce rapid changes
    this.debounceRouteChange(source);
  }

  /**
   * Debounce route change handling
   * @param {string} source - Change source
   */
  debounceRouteChange(source = 'unknown') {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processRouteChange(source);
    }, this.config.DEBOUNCE_DELAY);
  }

  /**
   * Process a route change
   * @param {string} source - Change source
   */
  processRouteChange(source) {
    const newRoute = this.getCurrentRoute();

    // Check if route actually changed
    if (!this.isSignificantRouteChange(this.currentRoute, newRoute)) {
      return;
    }

    console.log('[SPADetector] Route changed:', {
      from: this.currentRoute,
      to: newRoute,
      source
    });

    // Update state
    this.previousRoute = this.currentRoute;
    this.currentRoute = newRoute;

    // Update statistics
    this.stats.totalNavigations++;
    this.stats.lastNavigationTime = new Date().toISOString();

    // Add to history
    this.addToHistory(newRoute);

    // Clear old detections if configured
    if (this.config.CLEAR_ON_NAVIGATION) {
      this.detectionHistory.delete(this.previousRoute);
    }

    // Notify callback
    this.onRouteChange({
      previousRoute: this.previousRoute,
      currentRoute: this.currentRoute,
      source,
      timestamp: new Date().toISOString()
    });

    // Schedule scan
    this.scheduleScan();

    // Update status
    this.updateStatus('navigated', `Navigated to ${newRoute.path}`);
  }

  // ===========================================================================
  // Route Management
  // ===========================================================================

  /**
   * Get current route information
   * @returns {Object} Route object
   */
  getCurrentRoute() {
    const url = new URL(window.location.href);

    return {
      href: url.href,
      origin: url.origin,
      pathname: url.pathname,
      path: url.pathname,
      search: url.search,
      hash: url.hash,
      params: Object.fromEntries(url.searchParams),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check if route change is significant
   * @param {Object} oldRoute - Old route
   * @param {Object} newRoute - New route
   * @returns {boolean} True if significant
   */
  isSignificantRouteChange(oldRoute, newRoute) {
    if (!oldRoute) {
      return true; // First route
    }

    // Compare pathnames
    if (oldRoute.pathname !== newRoute.pathname) {
      return true;
    }

    // Check query params
    if (!this.config.IGNORE_QUERY_PARAMS && oldRoute.search !== newRoute.search) {
      return true;
    }

    // Check hash
    if (!this.config.IGNORE_HASH && oldRoute.hash !== newRoute.hash) {
      return true;
    }

    // Calculate URL similarity
    const similarity = this.calculateURLSimilarity(oldRoute.href, newRoute.href);

    return similarity < (1 - this.config.URL_CHANGE_THRESHOLD);
  }

  /**
   * Calculate similarity between two URLs
   * @param {string} url1 - First URL
   * @param {string} url2 - Second URL
   * @returns {number} Similarity score (0-1)
   */
  calculateURLSimilarity(url1, url2) {
    if (url1 === url2) return 1;

    const len1 = url1.length;
    const len2 = url2.length;
    const maxLen = Math.max(len1, len2);

    let matches = 0;
    for (let i = 0; i < Math.min(len1, len2); i++) {
      if (url1[i] === url2[i]) {
        matches++;
      }
    }

    return matches / maxLen;
  }

  /**
   * Add route to history
   * @param {Object} route - Route object
   */
  addToHistory(route) {
    this.routeHistory.push({
      ...route,
      visitedAt: new Date().toISOString()
    });

    // Trim history if too large
    if (this.routeHistory.length > this.config.MAX_HISTORY_SIZE) {
      this.routeHistory.shift();
    }

    this.stats.routesVisited = new Set(this.routeHistory.map(r => r.path)).size;
  }

  /**
   * Store detections for current route
   * @param {Array<Object>} detections - Detections to store
   */
  storeDetections(detections) {
    if (!this.currentRoute) {
      return;
    }

    const routeKey = this.currentRoute.path;
    const existing = this.detectionHistory.get(routeKey) || [];

    this.detectionHistory.set(routeKey, [...existing, ...detections]);
  }

  // ===========================================================================
  // Scanning
  // ===========================================================================

  /**
   * Schedule a scan after navigation
   */
  scheduleScan() {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
    }

    this.scanTimer = setTimeout(() => {
      this.triggerScan();
    }, this.config.SCAN_DELAY);
  }

  /**
   * Trigger a content scan
   */
  triggerScan() {
    if (!this.isActive || this.isPaused) {
      return;
    }

    this.stats.scansTriggered++;

    this.updateStatus('scanning', `Scanning route: ${this.currentRoute.path}`);

    // Note: Actual scanning is done by the callback
    // This just notifies that a scan should happen
    console.log('[SPADetector] Scan triggered for route:', this.currentRoute.path);
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
  window.SPADetector = SPADetector;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SPADetector, SPA_CONFIG };
}
