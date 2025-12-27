/**
 * Network Monitor Utility for Basset Hound Chrome Extension
 *
 * Provides comprehensive network request monitoring using Chrome webRequest API:
 * - Capture all network requests and responses
 * - Track request/response headers
 * - Monitor request timing
 * - Filter by URL patterns, methods, and resource types
 * - Track redirects
 * - Detect failed requests
 */

/**
 * NetworkMonitor class for capturing and analyzing network traffic
 */
class NetworkMonitor {
  /**
   * Create a new NetworkMonitor instance
   * @param {Object} options - Monitor configuration
   * @param {Array<string>} options.urlPatterns - URL patterns to monitor (default: ['<all_urls>'])
   * @param {Array<string>} options.methods - HTTP methods to capture (default: all)
   * @param {Array<string>} options.types - Resource types to capture (default: all)
   * @param {number} options.maxLogSize - Maximum number of requests to store (default: 1000)
   * @param {boolean} options.captureHeaders - Whether to capture headers (default: true)
   * @param {boolean} options.captureBody - Whether to capture request bodies (default: false)
   */
  constructor(options = {}) {
    this.urlPatterns = options.urlPatterns || ['<all_urls>'];
    this.methods = options.methods || null; // null means all methods
    this.types = options.types || null; // null means all types
    this.maxLogSize = options.maxLogSize || 1000;
    this.captureHeaders = options.captureHeaders !== false;
    this.captureBody = options.captureBody || false;

    // Network log storage
    this.networkLog = [];
    this.requestMap = new Map(); // Track requests by requestId

    // Monitoring state
    this.isCapturing = false;
    this.listeners = {
      onBeforeRequest: null,
      onBeforeSendHeaders: null,
      onSendHeaders: null,
      onHeadersReceived: null,
      onBeforeRedirect: null,
      onResponseStarted: null,
      onCompleted: null,
      onErrorOccurred: null
    };

    // Statistics
    this.stats = {
      totalRequests: 0,
      completedRequests: 0,
      failedRequests: 0,
      redirectedRequests: 0,
      blockedRequests: 0,
      startTime: null,
      endTime: null
    };
  }

  /**
   * Start capturing network traffic
   * @returns {Object} - Status of capture start
   */
  startCapture() {
    if (this.isCapturing) {
      return { success: false, message: 'Already capturing network traffic' };
    }

    this.isCapturing = true;
    this.stats.startTime = Date.now();
    this.stats.endTime = null;

    // Reset statistics
    this.stats.totalRequests = 0;
    this.stats.completedRequests = 0;
    this.stats.failedRequests = 0;
    this.stats.redirectedRequests = 0;
    this.stats.blockedRequests = 0;

    const filter = { urls: this.urlPatterns };

    // Add type filter if specified
    if (this.types && this.types.length > 0) {
      filter.types = this.types;
    }

    // Bind and register all listeners
    this.listeners.onBeforeRequest = this._onBeforeRequest.bind(this);
    this.listeners.onSendHeaders = this._onSendHeaders.bind(this);
    this.listeners.onHeadersReceived = this._onHeadersReceived.bind(this);
    this.listeners.onBeforeRedirect = this._onBeforeRedirect.bind(this);
    this.listeners.onResponseStarted = this._onResponseStarted.bind(this);
    this.listeners.onCompleted = this._onCompleted.bind(this);
    this.listeners.onErrorOccurred = this._onErrorOccurred.bind(this);

    // Register listeners with appropriate extra info specs
    chrome.webRequest.onBeforeRequest.addListener(
      this.listeners.onBeforeRequest,
      filter,
      this.captureBody ? ['requestBody'] : []
    );

    chrome.webRequest.onSendHeaders.addListener(
      this.listeners.onSendHeaders,
      filter,
      this.captureHeaders ? ['requestHeaders'] : []
    );

    chrome.webRequest.onHeadersReceived.addListener(
      this.listeners.onHeadersReceived,
      filter,
      this.captureHeaders ? ['responseHeaders'] : []
    );

    chrome.webRequest.onBeforeRedirect.addListener(
      this.listeners.onBeforeRedirect,
      filter,
      this.captureHeaders ? ['responseHeaders'] : []
    );

    chrome.webRequest.onResponseStarted.addListener(
      this.listeners.onResponseStarted,
      filter,
      this.captureHeaders ? ['responseHeaders'] : []
    );

    chrome.webRequest.onCompleted.addListener(
      this.listeners.onCompleted,
      filter,
      this.captureHeaders ? ['responseHeaders'] : []
    );

    chrome.webRequest.onErrorOccurred.addListener(
      this.listeners.onErrorOccurred,
      filter
    );

    return {
      success: true,
      message: 'Network capture started',
      urlPatterns: this.urlPatterns,
      captureHeaders: this.captureHeaders,
      captureBody: this.captureBody
    };
  }

  /**
   * Stop capturing network traffic
   * @returns {Object} - Capture summary with statistics
   */
  stopCapture() {
    if (!this.isCapturing) {
      return { success: false, message: 'Not currently capturing' };
    }

    this.isCapturing = false;
    this.stats.endTime = Date.now();

    // Remove all listeners
    if (this.listeners.onBeforeRequest) {
      chrome.webRequest.onBeforeRequest.removeListener(this.listeners.onBeforeRequest);
    }
    if (this.listeners.onSendHeaders) {
      chrome.webRequest.onSendHeaders.removeListener(this.listeners.onSendHeaders);
    }
    if (this.listeners.onHeadersReceived) {
      chrome.webRequest.onHeadersReceived.removeListener(this.listeners.onHeadersReceived);
    }
    if (this.listeners.onBeforeRedirect) {
      chrome.webRequest.onBeforeRedirect.removeListener(this.listeners.onBeforeRedirect);
    }
    if (this.listeners.onResponseStarted) {
      chrome.webRequest.onResponseStarted.removeListener(this.listeners.onResponseStarted);
    }
    if (this.listeners.onCompleted) {
      chrome.webRequest.onCompleted.removeListener(this.listeners.onCompleted);
    }
    if (this.listeners.onErrorOccurred) {
      chrome.webRequest.onErrorOccurred.removeListener(this.listeners.onErrorOccurred);
    }

    // Clear listener references
    Object.keys(this.listeners).forEach(key => {
      this.listeners[key] = null;
    });

    return {
      success: true,
      message: 'Network capture stopped',
      stats: this.getStats(),
      requestCount: this.networkLog.length
    };
  }

  /**
   * Get current network log
   * @param {Object} options - Filter options
   * @param {string} options.urlPattern - Filter by URL pattern (regex)
   * @param {string} options.method - Filter by HTTP method
   * @param {string} options.type - Filter by resource type
   * @param {string} options.status - Filter by status ('completed', 'failed', 'redirected')
   * @param {number} options.limit - Maximum number of entries to return
   * @param {number} options.offset - Number of entries to skip
   * @returns {Array} - Filtered network log entries
   */
  getLog(options = {}) {
    let log = [...this.networkLog];

    // Apply URL pattern filter
    if (options.urlPattern) {
      const regex = new RegExp(options.urlPattern, 'i');
      log = log.filter(entry => regex.test(entry.url));
    }

    // Apply method filter
    if (options.method) {
      const method = options.method.toUpperCase();
      log = log.filter(entry => entry.method === method);
    }

    // Apply type filter
    if (options.type) {
      log = log.filter(entry => entry.type === options.type);
    }

    // Apply status filter
    if (options.status) {
      switch (options.status) {
        case 'completed':
          log = log.filter(entry => entry.completed && !entry.error);
          break;
        case 'failed':
          log = log.filter(entry => entry.error);
          break;
        case 'redirected':
          log = log.filter(entry => entry.redirects && entry.redirects.length > 0);
          break;
      }
    }

    // Apply offset
    if (options.offset && options.offset > 0) {
      log = log.slice(options.offset);
    }

    // Apply limit
    if (options.limit && options.limit > 0) {
      log = log.slice(0, options.limit);
    }

    return log;
  }

  /**
   * Clear the network log
   * @returns {Object} - Clear status
   */
  clearLog() {
    const count = this.networkLog.length;
    this.networkLog = [];
    this.requestMap.clear();

    return {
      success: true,
      message: `Cleared ${count} log entries`
    };
  }

  /**
   * Get capture statistics
   * @returns {Object} - Capture statistics
   */
  getStats() {
    const duration = this.stats.endTime
      ? this.stats.endTime - this.stats.startTime
      : (this.isCapturing ? Date.now() - this.stats.startTime : 0);

    return {
      isCapturing: this.isCapturing,
      totalRequests: this.stats.totalRequests,
      completedRequests: this.stats.completedRequests,
      failedRequests: this.stats.failedRequests,
      redirectedRequests: this.stats.redirectedRequests,
      blockedRequests: this.stats.blockedRequests,
      logSize: this.networkLog.length,
      startTime: this.stats.startTime,
      endTime: this.stats.endTime,
      durationMs: duration
    };
  }

  /**
   * Update monitor configuration
   * @param {Object} options - New configuration options
   * @returns {Object} - Updated configuration
   */
  updateConfig(options = {}) {
    if (options.urlPatterns) {
      this.urlPatterns = options.urlPatterns;
    }
    if (options.methods !== undefined) {
      this.methods = options.methods;
    }
    if (options.types !== undefined) {
      this.types = options.types;
    }
    if (options.maxLogSize !== undefined) {
      this.maxLogSize = options.maxLogSize;
    }
    if (options.captureHeaders !== undefined) {
      this.captureHeaders = options.captureHeaders;
    }
    if (options.captureBody !== undefined) {
      this.captureBody = options.captureBody;
    }

    // If currently capturing, restart to apply new config
    if (this.isCapturing) {
      this.stopCapture();
      this.startCapture();
    }

    return {
      urlPatterns: this.urlPatterns,
      methods: this.methods,
      types: this.types,
      maxLogSize: this.maxLogSize,
      captureHeaders: this.captureHeaders,
      captureBody: this.captureBody
    };
  }

  // ==========================================================================
  // Private Event Handlers
  // ==========================================================================

  /**
   * Handle request initiation
   * @private
   */
  _onBeforeRequest(details) {
    // Apply method filter
    if (this.methods && !this.methods.includes(details.method)) {
      return;
    }

    const entry = {
      requestId: details.requestId,
      url: details.url,
      method: details.method,
      type: details.type,
      tabId: details.tabId,
      frameId: details.frameId,
      parentFrameId: details.parentFrameId,
      initiator: details.initiator,
      timeStamp: details.timeStamp,
      startTime: Date.now(),
      requestHeaders: null,
      responseHeaders: null,
      statusCode: null,
      statusLine: null,
      redirects: [],
      completed: false,
      error: null,
      timing: {
        start: details.timeStamp,
        sendHeaders: null,
        headersReceived: null,
        responseStarted: null,
        completed: null
      }
    };

    // Capture request body if enabled
    if (this.captureBody && details.requestBody) {
      entry.requestBody = this._parseRequestBody(details.requestBody);
    }

    this.requestMap.set(details.requestId, entry);
    this.stats.totalRequests++;
  }

  /**
   * Handle request headers being sent
   * @private
   */
  _onSendHeaders(details) {
    const entry = this.requestMap.get(details.requestId);
    if (!entry) return;

    if (this.captureHeaders && details.requestHeaders) {
      entry.requestHeaders = this._headersToObject(details.requestHeaders);
    }
    entry.timing.sendHeaders = details.timeStamp;
  }

  /**
   * Handle response headers received
   * @private
   */
  _onHeadersReceived(details) {
    const entry = this.requestMap.get(details.requestId);
    if (!entry) return;

    if (this.captureHeaders && details.responseHeaders) {
      entry.responseHeaders = this._headersToObject(details.responseHeaders);
    }
    entry.statusCode = details.statusCode;
    entry.statusLine = details.statusLine;
    entry.timing.headersReceived = details.timeStamp;
  }

  /**
   * Handle redirect
   * @private
   */
  _onBeforeRedirect(details) {
    const entry = this.requestMap.get(details.requestId);
    if (!entry) return;

    entry.redirects.push({
      url: details.redirectUrl,
      statusCode: details.statusCode,
      timeStamp: details.timeStamp,
      responseHeaders: this.captureHeaders && details.responseHeaders
        ? this._headersToObject(details.responseHeaders)
        : null
    });
    this.stats.redirectedRequests++;
  }

  /**
   * Handle response started
   * @private
   */
  _onResponseStarted(details) {
    const entry = this.requestMap.get(details.requestId);
    if (!entry) return;

    entry.statusCode = details.statusCode;
    entry.statusLine = details.statusLine;
    entry.timing.responseStarted = details.timeStamp;

    if (this.captureHeaders && details.responseHeaders) {
      entry.responseHeaders = this._headersToObject(details.responseHeaders);
    }
  }

  /**
   * Handle request completion
   * @private
   */
  _onCompleted(details) {
    const entry = this.requestMap.get(details.requestId);
    if (!entry) return;

    entry.completed = true;
    entry.statusCode = details.statusCode;
    entry.timing.completed = details.timeStamp;
    entry.endTime = Date.now();
    entry.duration = entry.endTime - entry.startTime;

    // Calculate timing metrics
    entry.timing.totalMs = entry.timing.completed - entry.timing.start;
    if (entry.timing.sendHeaders) {
      entry.timing.timeToFirstByte = entry.timing.headersReceived
        ? entry.timing.headersReceived - entry.timing.sendHeaders
        : null;
    }

    // Move to log and remove from active map
    this._addToLog(entry);
    this.requestMap.delete(details.requestId);
    this.stats.completedRequests++;
  }

  /**
   * Handle request error
   * @private
   */
  _onErrorOccurred(details) {
    const entry = this.requestMap.get(details.requestId);
    if (!entry) return;

    entry.error = details.error;
    entry.completed = false;
    entry.endTime = Date.now();
    entry.duration = entry.endTime - entry.startTime;
    entry.timing.completed = details.timeStamp;

    // Move to log and remove from active map
    this._addToLog(entry);
    this.requestMap.delete(details.requestId);
    this.stats.failedRequests++;
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Add entry to log with size management
   * @private
   */
  _addToLog(entry) {
    this.networkLog.push(entry);

    // Trim log if exceeds max size
    while (this.networkLog.length > this.maxLogSize) {
      this.networkLog.shift();
    }
  }

  /**
   * Convert headers array to object
   * @private
   */
  _headersToObject(headers) {
    if (!headers) return null;

    const obj = {};
    for (const header of headers) {
      // Handle multiple values for same header
      if (obj[header.name]) {
        if (Array.isArray(obj[header.name])) {
          obj[header.name].push(header.value);
        } else {
          obj[header.name] = [obj[header.name], header.value];
        }
      } else {
        obj[header.name] = header.value;
      }
    }
    return obj;
  }

  /**
   * Parse request body data
   * @private
   */
  _parseRequestBody(requestBody) {
    if (!requestBody) return null;

    const parsed = {};

    if (requestBody.formData) {
      parsed.type = 'formData';
      parsed.data = requestBody.formData;
    } else if (requestBody.raw) {
      parsed.type = 'raw';
      // Convert raw bytes to string if possible
      try {
        const decoder = new TextDecoder('utf-8');
        parsed.data = requestBody.raw.map(part => {
          if (part.bytes) {
            return decoder.decode(part.bytes);
          }
          return part;
        });
      } catch (e) {
        parsed.data = '[Binary data]';
      }
    } else if (requestBody.error) {
      parsed.type = 'error';
      parsed.error = requestBody.error;
    }

    return parsed;
  }

  /**
   * Export network log as HAR format
   * @returns {Object} - HAR formatted log
   */
  exportAsHAR() {
    const entries = this.networkLog.map(entry => ({
      startedDateTime: new Date(entry.startTime).toISOString(),
      time: entry.duration || 0,
      request: {
        method: entry.method,
        url: entry.url,
        httpVersion: 'HTTP/1.1',
        headers: entry.requestHeaders
          ? Object.entries(entry.requestHeaders).map(([name, value]) => ({ name, value }))
          : [],
        queryString: this._parseQueryString(entry.url),
        bodySize: -1
      },
      response: {
        status: entry.statusCode || 0,
        statusText: entry.statusLine || '',
        httpVersion: 'HTTP/1.1',
        headers: entry.responseHeaders
          ? Object.entries(entry.responseHeaders).map(([name, value]) => ({ name, value }))
          : [],
        content: {
          size: -1,
          mimeType: entry.responseHeaders?.['content-type'] || 'unknown'
        },
        bodySize: -1
      },
      cache: {},
      timings: {
        send: entry.timing.sendHeaders
          ? entry.timing.sendHeaders - entry.timing.start
          : -1,
        wait: entry.timing.timeToFirstByte || -1,
        receive: entry.timing.completed && entry.timing.responseStarted
          ? entry.timing.completed - entry.timing.responseStarted
          : -1
      }
    }));

    return {
      log: {
        version: '1.2',
        creator: {
          name: 'Basset Hound Network Monitor',
          version: '1.0.0'
        },
        entries
      }
    };
  }

  /**
   * Parse query string from URL
   * @private
   */
  _parseQueryString(url) {
    try {
      const urlObj = new URL(url);
      const params = [];
      urlObj.searchParams.forEach((value, name) => {
        params.push({ name, value });
      });
      return params;
    } catch (e) {
      return [];
    }
  }
}

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.NetworkMonitor = NetworkMonitor;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NetworkMonitor };
}
