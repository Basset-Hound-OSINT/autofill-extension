/**
 * Request Interceptor Utility for Basset Hound Chrome Extension
 *
 * Provides request interception and modification capabilities:
 * - Modify request headers
 * - Block specific requests by URL patterns
 * - Mock responses for testing
 * - Add custom headers to requests
 * - Redirect requests
 */

/**
 * RequestInterceptor class for intercepting and modifying network requests
 */
class RequestInterceptor {
  /**
   * Create a new RequestInterceptor instance
   * @param {Object} options - Interceptor configuration
   * @param {Array<string>} options.urlPatterns - URL patterns to intercept (default: ['<all_urls>'])
   */
  constructor(options = {}) {
    this.urlPatterns = options.urlPatterns || ['<all_urls>'];

    // Rule storage
    this.headerRules = new Map(); // Rules for modifying headers
    this.blockRules = new Map();  // Rules for blocking requests
    this.mockRules = new Map();   // Rules for mocking responses
    this.redirectRules = new Map(); // Rules for redirecting requests

    // Listener state
    this.isActive = false;
    this.listeners = {
      onBeforeRequest: null,
      onBeforeSendHeaders: null
    };

    // Statistics
    this.stats = {
      interceptedRequests: 0,
      blockedRequests: 0,
      modifiedRequests: 0,
      mockedRequests: 0,
      redirectedRequests: 0
    };
  }

  /**
   * Activate the interceptor
   * @returns {Object} - Activation status
   */
  activate() {
    if (this.isActive) {
      return { success: false, message: 'Interceptor already active' };
    }

    this.isActive = true;

    const filter = { urls: this.urlPatterns };

    // Bind and register listeners
    this.listeners.onBeforeRequest = this._onBeforeRequest.bind(this);
    this.listeners.onBeforeSendHeaders = this._onBeforeSendHeaders.bind(this);

    // Register onBeforeRequest for blocking and redirects
    // Note: 'blocking' is required for synchronous modification in MV2
    // In MV3, we use declarativeNetRequest for blocking, but webRequest for monitoring
    chrome.webRequest.onBeforeRequest.addListener(
      this.listeners.onBeforeRequest,
      filter,
      ['blocking']
    );

    // Register onBeforeSendHeaders for header modification
    chrome.webRequest.onBeforeSendHeaders.addListener(
      this.listeners.onBeforeSendHeaders,
      filter,
      ['blocking', 'requestHeaders']
    );

    return {
      success: true,
      message: 'Request interceptor activated',
      urlPatterns: this.urlPatterns
    };
  }

  /**
   * Deactivate the interceptor
   * @returns {Object} - Deactivation status
   */
  deactivate() {
    if (!this.isActive) {
      return { success: false, message: 'Interceptor not active' };
    }

    this.isActive = false;

    // Remove listeners
    if (this.listeners.onBeforeRequest) {
      chrome.webRequest.onBeforeRequest.removeListener(this.listeners.onBeforeRequest);
      this.listeners.onBeforeRequest = null;
    }
    if (this.listeners.onBeforeSendHeaders) {
      chrome.webRequest.onBeforeSendHeaders.removeListener(this.listeners.onBeforeSendHeaders);
      this.listeners.onBeforeSendHeaders = null;
    }

    return {
      success: true,
      message: 'Request interceptor deactivated',
      stats: this.getStats()
    };
  }

  // ==========================================================================
  // Rule Management - Header Modification
  // ==========================================================================

  /**
   * Add a rule to modify request headers
   * @param {string} ruleId - Unique rule identifier
   * @param {Object} rule - Rule configuration
   * @param {string|RegExp} rule.urlPattern - URL pattern to match
   * @param {Object} rule.addHeaders - Headers to add
   * @param {Array<string>} rule.removeHeaders - Headers to remove
   * @param {Object} rule.modifyHeaders - Headers to modify (key: { value, operation })
   * @param {string} rule.method - HTTP method to match (optional)
   * @returns {Object} - Rule add status
   */
  addHeaderRule(ruleId, rule) {
    if (!ruleId || !rule) {
      return { success: false, message: 'Rule ID and rule configuration required' };
    }

    const headerRule = {
      id: ruleId,
      urlPattern: rule.urlPattern instanceof RegExp
        ? rule.urlPattern
        : new RegExp(this._patternToRegex(rule.urlPattern)),
      addHeaders: rule.addHeaders || {},
      removeHeaders: rule.removeHeaders || [],
      modifyHeaders: rule.modifyHeaders || {},
      method: rule.method ? rule.method.toUpperCase() : null,
      enabled: true,
      createdAt: Date.now()
    };

    this.headerRules.set(ruleId, headerRule);

    return {
      success: true,
      message: `Header rule '${ruleId}' added`,
      rule: { id: ruleId, ...rule }
    };
  }

  /**
   * Remove a header modification rule
   * @param {string} ruleId - Rule identifier to remove
   * @returns {Object} - Rule removal status
   */
  removeHeaderRule(ruleId) {
    if (!this.headerRules.has(ruleId)) {
      return { success: false, message: `Rule '${ruleId}' not found` };
    }

    this.headerRules.delete(ruleId);
    return { success: true, message: `Header rule '${ruleId}' removed` };
  }

  /**
   * Get all header modification rules
   * @returns {Array} - List of header rules
   */
  getHeaderRules() {
    return Array.from(this.headerRules.values()).map(rule => ({
      id: rule.id,
      urlPattern: rule.urlPattern.source,
      addHeaders: rule.addHeaders,
      removeHeaders: rule.removeHeaders,
      modifyHeaders: rule.modifyHeaders,
      method: rule.method,
      enabled: rule.enabled,
      createdAt: rule.createdAt
    }));
  }

  // ==========================================================================
  // Rule Management - URL Blocking
  // ==========================================================================

  /**
   * Add a rule to block requests
   * @param {string} ruleId - Unique rule identifier
   * @param {Object} rule - Rule configuration
   * @param {string|RegExp} rule.urlPattern - URL pattern to block
   * @param {string} rule.method - HTTP method to match (optional)
   * @param {string} rule.resourceType - Resource type to match (optional)
   * @returns {Object} - Rule add status
   */
  addBlockRule(ruleId, rule) {
    if (!ruleId || !rule || !rule.urlPattern) {
      return { success: false, message: 'Rule ID and URL pattern required' };
    }

    const blockRule = {
      id: ruleId,
      urlPattern: rule.urlPattern instanceof RegExp
        ? rule.urlPattern
        : new RegExp(this._patternToRegex(rule.urlPattern)),
      method: rule.method ? rule.method.toUpperCase() : null,
      resourceType: rule.resourceType || null,
      enabled: true,
      createdAt: Date.now(),
      blockedCount: 0
    };

    this.blockRules.set(ruleId, blockRule);

    return {
      success: true,
      message: `Block rule '${ruleId}' added`,
      rule: { id: ruleId, urlPattern: rule.urlPattern }
    };
  }

  /**
   * Remove a block rule
   * @param {string} ruleId - Rule identifier to remove
   * @returns {Object} - Rule removal status
   */
  removeBlockRule(ruleId) {
    if (!this.blockRules.has(ruleId)) {
      return { success: false, message: `Block rule '${ruleId}' not found` };
    }

    this.blockRules.delete(ruleId);
    return { success: true, message: `Block rule '${ruleId}' removed` };
  }

  /**
   * Block URLs matching patterns (convenience method)
   * @param {Array<string>} patterns - URL patterns to block
   * @returns {Object} - Block status with rule IDs
   */
  blockUrls(patterns) {
    if (!patterns || !Array.isArray(patterns)) {
      return { success: false, message: 'Patterns array required' };
    }

    const ruleIds = [];
    for (const pattern of patterns) {
      const ruleId = `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.addBlockRule(ruleId, { urlPattern: pattern });
      ruleIds.push(ruleId);
    }

    return {
      success: true,
      message: `Added ${ruleIds.length} block rules`,
      ruleIds
    };
  }

  /**
   * Unblock URLs by removing block rules
   * @param {Array<string>} ruleIds - Rule IDs to remove
   * @returns {Object} - Unblock status
   */
  unblockUrls(ruleIds) {
    if (!ruleIds || !Array.isArray(ruleIds)) {
      return { success: false, message: 'Rule IDs array required' };
    }

    let removed = 0;
    for (const ruleId of ruleIds) {
      if (this.blockRules.has(ruleId)) {
        this.blockRules.delete(ruleId);
        removed++;
      }
    }

    return {
      success: true,
      message: `Removed ${removed} block rules`,
      removedCount: removed
    };
  }

  /**
   * Clear all block rules
   * @returns {Object} - Clear status
   */
  clearBlockRules() {
    const count = this.blockRules.size;
    this.blockRules.clear();
    return { success: true, message: `Cleared ${count} block rules` };
  }

  /**
   * Get all block rules
   * @returns {Array} - List of block rules
   */
  getBlockRules() {
    return Array.from(this.blockRules.values()).map(rule => ({
      id: rule.id,
      urlPattern: rule.urlPattern.source,
      method: rule.method,
      resourceType: rule.resourceType,
      enabled: rule.enabled,
      blockedCount: rule.blockedCount,
      createdAt: rule.createdAt
    }));
  }

  // ==========================================================================
  // Rule Management - Response Mocking
  // ==========================================================================

  /**
   * Add a rule to mock responses
   * @param {string} ruleId - Unique rule identifier
   * @param {Object} rule - Rule configuration
   * @param {string|RegExp} rule.urlPattern - URL pattern to mock
   * @param {Object} rule.response - Mock response configuration
   * @param {number} rule.response.status - HTTP status code
   * @param {Object} rule.response.headers - Response headers
   * @param {string|Object} rule.response.body - Response body
   * @returns {Object} - Rule add status
   */
  addMockRule(ruleId, rule) {
    if (!ruleId || !rule || !rule.urlPattern || !rule.response) {
      return { success: false, message: 'Rule ID, URL pattern, and response required' };
    }

    const mockRule = {
      id: ruleId,
      urlPattern: rule.urlPattern instanceof RegExp
        ? rule.urlPattern
        : new RegExp(this._patternToRegex(rule.urlPattern)),
      response: {
        status: rule.response.status || 200,
        headers: rule.response.headers || {},
        body: typeof rule.response.body === 'object'
          ? JSON.stringify(rule.response.body)
          : rule.response.body || ''
      },
      method: rule.method ? rule.method.toUpperCase() : null,
      enabled: true,
      createdAt: Date.now(),
      mockedCount: 0
    };

    this.mockRules.set(ruleId, mockRule);

    return {
      success: true,
      message: `Mock rule '${ruleId}' added`,
      rule: { id: ruleId, urlPattern: rule.urlPattern }
    };
  }

  /**
   * Remove a mock rule
   * @param {string} ruleId - Rule identifier to remove
   * @returns {Object} - Rule removal status
   */
  removeMockRule(ruleId) {
    if (!this.mockRules.has(ruleId)) {
      return { success: false, message: `Mock rule '${ruleId}' not found` };
    }

    this.mockRules.delete(ruleId);
    return { success: true, message: `Mock rule '${ruleId}' removed` };
  }

  /**
   * Get all mock rules
   * @returns {Array} - List of mock rules
   */
  getMockRules() {
    return Array.from(this.mockRules.values()).map(rule => ({
      id: rule.id,
      urlPattern: rule.urlPattern.source,
      response: rule.response,
      method: rule.method,
      enabled: rule.enabled,
      mockedCount: rule.mockedCount,
      createdAt: rule.createdAt
    }));
  }

  // ==========================================================================
  // Rule Management - Redirects
  // ==========================================================================

  /**
   * Add a rule to redirect requests
   * @param {string} ruleId - Unique rule identifier
   * @param {Object} rule - Rule configuration
   * @param {string|RegExp} rule.urlPattern - URL pattern to match
   * @param {string} rule.redirectUrl - URL to redirect to
   * @returns {Object} - Rule add status
   */
  addRedirectRule(ruleId, rule) {
    if (!ruleId || !rule || !rule.urlPattern || !rule.redirectUrl) {
      return { success: false, message: 'Rule ID, URL pattern, and redirect URL required' };
    }

    const redirectRule = {
      id: ruleId,
      urlPattern: rule.urlPattern instanceof RegExp
        ? rule.urlPattern
        : new RegExp(this._patternToRegex(rule.urlPattern)),
      redirectUrl: rule.redirectUrl,
      method: rule.method ? rule.method.toUpperCase() : null,
      enabled: true,
      createdAt: Date.now(),
      redirectedCount: 0
    };

    this.redirectRules.set(ruleId, redirectRule);

    return {
      success: true,
      message: `Redirect rule '${ruleId}' added`,
      rule: { id: ruleId, urlPattern: rule.urlPattern, redirectUrl: rule.redirectUrl }
    };
  }

  /**
   * Remove a redirect rule
   * @param {string} ruleId - Rule identifier to remove
   * @returns {Object} - Rule removal status
   */
  removeRedirectRule(ruleId) {
    if (!this.redirectRules.has(ruleId)) {
      return { success: false, message: `Redirect rule '${ruleId}' not found` };
    }

    this.redirectRules.delete(ruleId);
    return { success: true, message: `Redirect rule '${ruleId}' removed` };
  }

  /**
   * Get all redirect rules
   * @returns {Array} - List of redirect rules
   */
  getRedirectRules() {
    return Array.from(this.redirectRules.values()).map(rule => ({
      id: rule.id,
      urlPattern: rule.urlPattern.source,
      redirectUrl: rule.redirectUrl,
      method: rule.method,
      enabled: rule.enabled,
      redirectedCount: rule.redirectedCount,
      createdAt: rule.createdAt
    }));
  }

  // ==========================================================================
  // Generic Rule Management
  // ==========================================================================

  /**
   * Add a request interception rule (generic method)
   * @param {Object} rule - Rule configuration
   * @param {string} rule.id - Unique rule identifier
   * @param {string} rule.type - Rule type ('header', 'block', 'mock', 'redirect')
   * @param {Object} rule.config - Type-specific configuration
   * @returns {Object} - Rule add status
   */
  addRule(rule) {
    if (!rule || !rule.id || !rule.type) {
      return { success: false, message: 'Rule ID and type required' };
    }

    switch (rule.type) {
      case 'header':
        return this.addHeaderRule(rule.id, rule.config);
      case 'block':
        return this.addBlockRule(rule.id, rule.config);
      case 'mock':
        return this.addMockRule(rule.id, rule.config);
      case 'redirect':
        return this.addRedirectRule(rule.id, rule.config);
      default:
        return { success: false, message: `Unknown rule type: ${rule.type}` };
    }
  }

  /**
   * Remove a request interception rule (generic method)
   * @param {string} ruleId - Rule identifier
   * @param {string} type - Rule type (optional, searches all if not specified)
   * @returns {Object} - Rule removal status
   */
  removeRule(ruleId, type = null) {
    if (type) {
      switch (type) {
        case 'header':
          return this.removeHeaderRule(ruleId);
        case 'block':
          return this.removeBlockRule(ruleId);
        case 'mock':
          return this.removeMockRule(ruleId);
        case 'redirect':
          return this.removeRedirectRule(ruleId);
        default:
          return { success: false, message: `Unknown rule type: ${type}` };
      }
    }

    // Search all rule types
    if (this.headerRules.has(ruleId)) {
      return this.removeHeaderRule(ruleId);
    }
    if (this.blockRules.has(ruleId)) {
      return this.removeBlockRule(ruleId);
    }
    if (this.mockRules.has(ruleId)) {
      return this.removeMockRule(ruleId);
    }
    if (this.redirectRules.has(ruleId)) {
      return this.removeRedirectRule(ruleId);
    }

    return { success: false, message: `Rule '${ruleId}' not found in any category` };
  }

  /**
   * Get all rules of all types
   * @returns {Object} - All rules by type
   */
  getAllRules() {
    return {
      headerRules: this.getHeaderRules(),
      blockRules: this.getBlockRules(),
      mockRules: this.getMockRules(),
      redirectRules: this.getRedirectRules()
    };
  }

  /**
   * Clear all rules
   * @returns {Object} - Clear status
   */
  clearAllRules() {
    const counts = {
      headerRules: this.headerRules.size,
      blockRules: this.blockRules.size,
      mockRules: this.mockRules.size,
      redirectRules: this.redirectRules.size
    };

    this.headerRules.clear();
    this.blockRules.clear();
    this.mockRules.clear();
    this.redirectRules.clear();

    return {
      success: true,
      message: 'All rules cleared',
      cleared: counts
    };
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get interceptor statistics
   * @returns {Object} - Statistics
   */
  getStats() {
    return {
      isActive: this.isActive,
      interceptedRequests: this.stats.interceptedRequests,
      blockedRequests: this.stats.blockedRequests,
      modifiedRequests: this.stats.modifiedRequests,
      mockedRequests: this.stats.mockedRequests,
      redirectedRequests: this.stats.redirectedRequests,
      ruleCounts: {
        headerRules: this.headerRules.size,
        blockRules: this.blockRules.size,
        mockRules: this.mockRules.size,
        redirectRules: this.redirectRules.size
      }
    };
  }

  /**
   * Reset statistics
   * @returns {Object} - Reset confirmation
   */
  resetStats() {
    this.stats = {
      interceptedRequests: 0,
      blockedRequests: 0,
      modifiedRequests: 0,
      mockedRequests: 0,
      redirectedRequests: 0
    };
    return { success: true, message: 'Statistics reset' };
  }

  // ==========================================================================
  // Private Event Handlers
  // ==========================================================================

  /**
   * Handle request before it's sent (for blocking, mocking, redirecting)
   * @private
   */
  _onBeforeRequest(details) {
    this.stats.interceptedRequests++;

    // Check block rules first
    for (const rule of this.blockRules.values()) {
      if (!rule.enabled) continue;
      if (rule.method && rule.method !== details.method) continue;
      if (rule.resourceType && rule.resourceType !== details.type) continue;
      if (rule.urlPattern.test(details.url)) {
        rule.blockedCount++;
        this.stats.blockedRequests++;
        return { cancel: true };
      }
    }

    // Check redirect rules
    for (const rule of this.redirectRules.values()) {
      if (!rule.enabled) continue;
      if (rule.method && rule.method !== details.method) continue;
      if (rule.urlPattern.test(details.url)) {
        rule.redirectedCount++;
        this.stats.redirectedRequests++;
        return { redirectUrl: rule.redirectUrl };
      }
    }

    // Note: Mock responses require more complex handling with data URLs
    // or using service worker's FetchEvent, which is beyond webRequest API

    return {};
  }

  /**
   * Handle request headers modification
   * @private
   */
  _onBeforeSendHeaders(details) {
    let headers = details.requestHeaders;
    let modified = false;

    for (const rule of this.headerRules.values()) {
      if (!rule.enabled) continue;
      if (rule.method && rule.method !== details.method) continue;
      if (!rule.urlPattern.test(details.url)) continue;

      // Remove headers
      if (rule.removeHeaders && rule.removeHeaders.length > 0) {
        const removeSet = new Set(rule.removeHeaders.map(h => h.toLowerCase()));
        headers = headers.filter(h => !removeSet.has(h.name.toLowerCase()));
        modified = true;
      }

      // Modify existing headers
      if (rule.modifyHeaders && Object.keys(rule.modifyHeaders).length > 0) {
        for (const header of headers) {
          const modifyConfig = rule.modifyHeaders[header.name];
          if (modifyConfig) {
            header.value = modifyConfig.value;
            modified = true;
          }
        }
      }

      // Add new headers
      if (rule.addHeaders && Object.keys(rule.addHeaders).length > 0) {
        for (const [name, value] of Object.entries(rule.addHeaders)) {
          // Check if header already exists
          const existing = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
          if (existing) {
            existing.value = value;
          } else {
            headers.push({ name, value });
          }
        }
        modified = true;
      }
    }

    if (modified) {
      this.stats.modifiedRequests++;
      return { requestHeaders: headers };
    }

    return {};
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Convert glob-like pattern to regex
   * @private
   */
  _patternToRegex(pattern) {
    if (!pattern) return '.*';

    // Escape special regex characters except * and ?
    let regex = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    return regex;
  }
}

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.RequestInterceptor = RequestInterceptor;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RequestInterceptor };
}
