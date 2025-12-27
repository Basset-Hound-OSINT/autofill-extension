/**
 * Unit Tests for Network Monitor Utility
 *
 * Tests the NetworkMonitor class functionality including:
 * - Network capture start/stop
 * - Request tracking
 * - Log filtering
 * - Statistics
 * - HAR export
 */

const { setupTestEnvironment, teardownTestEnvironment, resetTestMocks } = require('../helpers/setup');
const { triggerListener } = require('../mocks/chrome-api.mock');

let NetworkMonitor;

beforeAll(() => {
  setupTestEnvironment();

  // Define NetworkMonitor class (matching the actual implementation)
  NetworkMonitor = class NetworkMonitor {
    constructor(options = {}) {
      this.urlPatterns = options.urlPatterns || ['<all_urls>'];
      this.methods = options.methods || null;
      this.types = options.types || null;
      this.maxLogSize = options.maxLogSize || 1000;
      this.captureHeaders = options.captureHeaders !== false;
      this.captureBody = options.captureBody || false;

      this.networkLog = [];
      this.requestMap = new Map();

      this.isCapturing = false;
      this.listeners = {
        onBeforeRequest: null,
        onSendHeaders: null,
        onHeadersReceived: null,
        onBeforeRedirect: null,
        onResponseStarted: null,
        onCompleted: null,
        onErrorOccurred: null
      };

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

    startCapture() {
      if (this.isCapturing) {
        return { success: false, message: 'Already capturing network traffic' };
      }

      this.isCapturing = true;
      this.stats.startTime = Date.now();
      this.stats.endTime = null;

      this.stats.totalRequests = 0;
      this.stats.completedRequests = 0;
      this.stats.failedRequests = 0;
      this.stats.redirectedRequests = 0;
      this.stats.blockedRequests = 0;

      const filter = { urls: this.urlPatterns };

      if (this.types && this.types.length > 0) {
        filter.types = this.types;
      }

      this.listeners.onBeforeRequest = this._onBeforeRequest.bind(this);
      this.listeners.onSendHeaders = this._onSendHeaders.bind(this);
      this.listeners.onHeadersReceived = this._onHeadersReceived.bind(this);
      this.listeners.onBeforeRedirect = this._onBeforeRedirect.bind(this);
      this.listeners.onResponseStarted = this._onResponseStarted.bind(this);
      this.listeners.onCompleted = this._onCompleted.bind(this);
      this.listeners.onErrorOccurred = this._onErrorOccurred.bind(this);

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

    stopCapture() {
      if (!this.isCapturing) {
        return { success: false, message: 'Not currently capturing' };
      }

      this.isCapturing = false;
      this.stats.endTime = Date.now();

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

    getLog(options = {}) {
      let log = [...this.networkLog];

      if (options.urlPattern) {
        const regex = new RegExp(options.urlPattern, 'i');
        log = log.filter(entry => regex.test(entry.url));
      }

      if (options.method) {
        const method = options.method.toUpperCase();
        log = log.filter(entry => entry.method === method);
      }

      if (options.type) {
        log = log.filter(entry => entry.type === options.type);
      }

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

      if (options.offset && options.offset > 0) {
        log = log.slice(options.offset);
      }

      if (options.limit && options.limit > 0) {
        log = log.slice(0, options.limit);
      }

      return log;
    }

    clearLog() {
      const count = this.networkLog.length;
      this.networkLog = [];
      this.requestMap.clear();

      return {
        success: true,
        message: `Cleared ${count} log entries`
      };
    }

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

    _onBeforeRequest(details) {
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

      if (this.captureBody && details.requestBody) {
        entry.requestBody = this._parseRequestBody(details.requestBody);
      }

      this.requestMap.set(details.requestId, entry);
      this.stats.totalRequests++;
    }

    _onSendHeaders(details) {
      const entry = this.requestMap.get(details.requestId);
      if (!entry) return;

      if (this.captureHeaders && details.requestHeaders) {
        entry.requestHeaders = this._headersToObject(details.requestHeaders);
      }
      entry.timing.sendHeaders = details.timeStamp;
    }

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

    _onCompleted(details) {
      const entry = this.requestMap.get(details.requestId);
      if (!entry) return;

      entry.completed = true;
      entry.statusCode = details.statusCode;
      entry.timing.completed = details.timeStamp;
      entry.endTime = Date.now();
      entry.duration = entry.endTime - entry.startTime;

      entry.timing.totalMs = entry.timing.completed - entry.timing.start;
      if (entry.timing.sendHeaders) {
        entry.timing.timeToFirstByte = entry.timing.headersReceived
          ? entry.timing.headersReceived - entry.timing.sendHeaders
          : null;
      }

      this._addToLog(entry);
      this.requestMap.delete(details.requestId);
      this.stats.completedRequests++;
    }

    _onErrorOccurred(details) {
      const entry = this.requestMap.get(details.requestId);
      if (!entry) return;

      entry.error = details.error;
      entry.completed = false;
      entry.endTime = Date.now();
      entry.duration = entry.endTime - entry.startTime;
      entry.timing.completed = details.timeStamp;

      this._addToLog(entry);
      this.requestMap.delete(details.requestId);
      this.stats.failedRequests++;
    }

    _addToLog(entry) {
      this.networkLog.push(entry);

      while (this.networkLog.length > this.maxLogSize) {
        this.networkLog.shift();
      }
    }

    _headersToObject(headers) {
      if (!headers) return null;

      const obj = {};
      for (const header of headers) {
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

    _parseRequestBody(requestBody) {
      if (!requestBody) return null;

      const parsed = {};

      if (requestBody.formData) {
        parsed.type = 'formData';
        parsed.data = requestBody.formData;
      } else if (requestBody.raw) {
        parsed.type = 'raw';
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
  };

  global.NetworkMonitor = NetworkMonitor;
});

afterAll(() => {
  teardownTestEnvironment();
});

beforeEach(() => {
  resetTestMocks();
});

describe('NetworkMonitor', () => {
  describe('Constructor', () => {
    test('should create monitor with default options', () => {
      const monitor = new NetworkMonitor();

      expect(monitor.urlPatterns).toEqual(['<all_urls>']);
      expect(monitor.methods).toBeNull();
      expect(monitor.types).toBeNull();
      expect(monitor.maxLogSize).toBe(1000);
      expect(monitor.captureHeaders).toBe(true);
      expect(monitor.captureBody).toBe(false);
      expect(monitor.isCapturing).toBe(false);
    });

    test('should create monitor with custom options', () => {
      const monitor = new NetworkMonitor({
        urlPatterns: ['*://api.example.com/*'],
        methods: ['GET', 'POST'],
        types: ['xmlhttprequest'],
        maxLogSize: 500,
        captureHeaders: false,
        captureBody: true
      });

      expect(monitor.urlPatterns).toEqual(['*://api.example.com/*']);
      expect(monitor.methods).toEqual(['GET', 'POST']);
      expect(monitor.types).toEqual(['xmlhttprequest']);
      expect(monitor.maxLogSize).toBe(500);
      expect(monitor.captureHeaders).toBe(false);
      expect(monitor.captureBody).toBe(true);
    });

    test('should initialize with empty log and stats', () => {
      const monitor = new NetworkMonitor();

      expect(monitor.networkLog).toEqual([]);
      expect(monitor.requestMap.size).toBe(0);
      expect(monitor.stats.totalRequests).toBe(0);
    });
  });

  describe('Start Capture', () => {
    test('should start network capture successfully', () => {
      const monitor = new NetworkMonitor();

      const result = monitor.startCapture();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Network capture started');
      expect(monitor.isCapturing).toBe(true);
    });

    test('should register all listeners', () => {
      const monitor = new NetworkMonitor();

      monitor.startCapture();

      expect(chrome.webRequest.onBeforeRequest.addListener).toHaveBeenCalled();
      expect(chrome.webRequest.onSendHeaders.addListener).toHaveBeenCalled();
      expect(chrome.webRequest.onHeadersReceived.addListener).toHaveBeenCalled();
      expect(chrome.webRequest.onBeforeRedirect.addListener).toHaveBeenCalled();
      expect(chrome.webRequest.onResponseStarted.addListener).toHaveBeenCalled();
      expect(chrome.webRequest.onCompleted.addListener).toHaveBeenCalled();
      expect(chrome.webRequest.onErrorOccurred.addListener).toHaveBeenCalled();
    });

    test('should fail if already capturing', () => {
      const monitor = new NetworkMonitor();

      monitor.startCapture();
      const result = monitor.startCapture();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Already capturing network traffic');
    });

    test('should reset statistics on start', () => {
      const monitor = new NetworkMonitor();

      // Simulate some stats
      monitor.stats.totalRequests = 10;
      monitor.stats.completedRequests = 8;

      monitor.startCapture();

      expect(monitor.stats.totalRequests).toBe(0);
      expect(monitor.stats.completedRequests).toBe(0);
      expect(monitor.stats.startTime).not.toBeNull();
    });

    test('should use configured URL patterns', () => {
      const monitor = new NetworkMonitor({
        urlPatterns: ['*://api.example.com/*']
      });

      monitor.startCapture();

      const call = chrome.webRequest.onBeforeRequest.addListener.mock.calls[0];
      expect(call[1].urls).toEqual(['*://api.example.com/*']);
    });

    test('should include type filter when specified', () => {
      const monitor = new NetworkMonitor({
        types: ['xmlhttprequest', 'script']
      });

      monitor.startCapture();

      const call = chrome.webRequest.onBeforeRequest.addListener.mock.calls[0];
      expect(call[1].types).toEqual(['xmlhttprequest', 'script']);
    });
  });

  describe('Stop Capture', () => {
    test('should stop network capture successfully', () => {
      const monitor = new NetworkMonitor();

      monitor.startCapture();
      const result = monitor.stopCapture();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Network capture stopped');
      expect(monitor.isCapturing).toBe(false);
    });

    test('should remove all listeners', () => {
      const monitor = new NetworkMonitor();

      monitor.startCapture();
      monitor.stopCapture();

      expect(chrome.webRequest.onBeforeRequest.removeListener).toHaveBeenCalled();
      expect(chrome.webRequest.onSendHeaders.removeListener).toHaveBeenCalled();
      expect(chrome.webRequest.onHeadersReceived.removeListener).toHaveBeenCalled();
      expect(chrome.webRequest.onBeforeRedirect.removeListener).toHaveBeenCalled();
      expect(chrome.webRequest.onResponseStarted.removeListener).toHaveBeenCalled();
      expect(chrome.webRequest.onCompleted.removeListener).toHaveBeenCalled();
      expect(chrome.webRequest.onErrorOccurred.removeListener).toHaveBeenCalled();
    });

    test('should fail if not capturing', () => {
      const monitor = new NetworkMonitor();

      const result = monitor.stopCapture();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Not currently capturing');
    });

    test('should return stats and request count', () => {
      const monitor = new NetworkMonitor();

      monitor.startCapture();
      const result = monitor.stopCapture();

      expect(result.stats).toBeDefined();
      expect(result.requestCount).toBeDefined();
    });

    test('should set end time', () => {
      const monitor = new NetworkMonitor();

      monitor.startCapture();
      monitor.stopCapture();

      expect(monitor.stats.endTime).not.toBeNull();
    });
  });

  describe('Request Tracking', () => {
    let monitor;

    beforeEach(() => {
      monitor = new NetworkMonitor();
      monitor.startCapture();
    });

    afterEach(() => {
      if (monitor.isCapturing) {
        monitor.stopCapture();
      }
    });

    test('should track request on onBeforeRequest', () => {
      const details = {
        requestId: 'req-1',
        url: 'https://api.example.com/data',
        method: 'GET',
        type: 'xmlhttprequest',
        tabId: 1,
        frameId: 0,
        timeStamp: Date.now()
      };

      monitor._onBeforeRequest(details);

      expect(monitor.requestMap.has('req-1')).toBe(true);
      expect(monitor.stats.totalRequests).toBe(1);
    });

    test('should filter by method', () => {
      monitor.stopCapture();
      monitor = new NetworkMonitor({ methods: ['POST'] });
      monitor.startCapture();

      const getRequest = {
        requestId: 'req-1',
        url: 'https://example.com',
        method: 'GET',
        type: 'main_frame',
        tabId: 1,
        frameId: 0,
        timeStamp: Date.now()
      };

      const postRequest = {
        requestId: 'req-2',
        url: 'https://example.com',
        method: 'POST',
        type: 'main_frame',
        tabId: 1,
        frameId: 0,
        timeStamp: Date.now()
      };

      monitor._onBeforeRequest(getRequest);
      monitor._onBeforeRequest(postRequest);

      expect(monitor.requestMap.has('req-1')).toBe(false);
      expect(monitor.requestMap.has('req-2')).toBe(true);
    });

    test('should add headers on onSendHeaders', () => {
      const beforeDetails = {
        requestId: 'req-1',
        url: 'https://example.com',
        method: 'GET',
        type: 'main_frame',
        tabId: 1,
        frameId: 0,
        timeStamp: Date.now()
      };

      const sendDetails = {
        requestId: 'req-1',
        requestHeaders: [
          { name: 'Accept', value: 'application/json' },
          { name: 'User-Agent', value: 'Test Browser' }
        ],
        timeStamp: Date.now()
      };

      monitor._onBeforeRequest(beforeDetails);
      monitor._onSendHeaders(sendDetails);

      const entry = monitor.requestMap.get('req-1');
      expect(entry.requestHeaders).toEqual({
        'Accept': 'application/json',
        'User-Agent': 'Test Browser'
      });
    });

    test('should add response headers on onHeadersReceived', () => {
      const beforeDetails = {
        requestId: 'req-1',
        url: 'https://example.com',
        method: 'GET',
        type: 'main_frame',
        tabId: 1,
        frameId: 0,
        timeStamp: Date.now()
      };

      const headersDetails = {
        requestId: 'req-1',
        statusCode: 200,
        statusLine: 'HTTP/1.1 200 OK',
        responseHeaders: [
          { name: 'Content-Type', value: 'application/json' }
        ],
        timeStamp: Date.now()
      };

      monitor._onBeforeRequest(beforeDetails);
      monitor._onHeadersReceived(headersDetails);

      const entry = monitor.requestMap.get('req-1');
      expect(entry.statusCode).toBe(200);
      expect(entry.responseHeaders).toEqual({
        'Content-Type': 'application/json'
      });
    });

    test('should track redirects', () => {
      const beforeDetails = {
        requestId: 'req-1',
        url: 'https://example.com/old',
        method: 'GET',
        type: 'main_frame',
        tabId: 1,
        frameId: 0,
        timeStamp: Date.now()
      };

      const redirectDetails = {
        requestId: 'req-1',
        redirectUrl: 'https://example.com/new',
        statusCode: 301,
        timeStamp: Date.now()
      };

      monitor._onBeforeRequest(beforeDetails);
      monitor._onBeforeRedirect(redirectDetails);

      const entry = monitor.requestMap.get('req-1');
      expect(entry.redirects).toHaveLength(1);
      expect(entry.redirects[0].url).toBe('https://example.com/new');
      expect(monitor.stats.redirectedRequests).toBe(1);
    });

    test('should complete request and add to log', () => {
      const beforeDetails = {
        requestId: 'req-1',
        url: 'https://example.com',
        method: 'GET',
        type: 'main_frame',
        tabId: 1,
        frameId: 0,
        timeStamp: Date.now()
      };

      const completedDetails = {
        requestId: 'req-1',
        statusCode: 200,
        timeStamp: Date.now() + 100
      };

      monitor._onBeforeRequest(beforeDetails);
      monitor._onCompleted(completedDetails);

      expect(monitor.requestMap.has('req-1')).toBe(false);
      expect(monitor.networkLog).toHaveLength(1);
      expect(monitor.networkLog[0].completed).toBe(true);
      expect(monitor.stats.completedRequests).toBe(1);
    });

    test('should track errors', () => {
      const beforeDetails = {
        requestId: 'req-1',
        url: 'https://example.com',
        method: 'GET',
        type: 'main_frame',
        tabId: 1,
        frameId: 0,
        timeStamp: Date.now()
      };

      const errorDetails = {
        requestId: 'req-1',
        error: 'net::ERR_CONNECTION_REFUSED',
        timeStamp: Date.now() + 100
      };

      monitor._onBeforeRequest(beforeDetails);
      monitor._onErrorOccurred(errorDetails);

      expect(monitor.networkLog).toHaveLength(1);
      expect(monitor.networkLog[0].error).toBe('net::ERR_CONNECTION_REFUSED');
      expect(monitor.networkLog[0].completed).toBe(false);
      expect(monitor.stats.failedRequests).toBe(1);
    });
  });

  describe('Log Filtering', () => {
    let monitor;

    beforeEach(() => {
      monitor = new NetworkMonitor();

      // Add some test entries directly
      monitor.networkLog = [
        { url: 'https://api.example.com/users', method: 'GET', type: 'xmlhttprequest', completed: true, error: null, redirects: [] },
        { url: 'https://api.example.com/posts', method: 'POST', type: 'xmlhttprequest', completed: true, error: null, redirects: [] },
        { url: 'https://cdn.example.com/image.png', method: 'GET', type: 'image', completed: true, error: null, redirects: [] },
        { url: 'https://api.example.com/error', method: 'GET', type: 'xmlhttprequest', completed: false, error: 'Network error', redirects: [] },
        { url: 'https://example.com/redirect', method: 'GET', type: 'main_frame', completed: true, error: null, redirects: [{ url: 'https://example.com/new' }] }
      ];
    });

    test('should filter by URL pattern', () => {
      const log = monitor.getLog({ urlPattern: 'api\\.example\\.com' });

      expect(log).toHaveLength(3);
      expect(log.every(e => e.url.includes('api.example.com'))).toBe(true);
    });

    test('should filter by method', () => {
      const log = monitor.getLog({ method: 'POST' });

      expect(log).toHaveLength(1);
      expect(log[0].method).toBe('POST');
    });

    test('should filter by type', () => {
      const log = monitor.getLog({ type: 'image' });

      expect(log).toHaveLength(1);
      expect(log[0].type).toBe('image');
    });

    test('should filter by completed status', () => {
      const log = monitor.getLog({ status: 'completed' });

      expect(log).toHaveLength(4);
      expect(log.every(e => e.completed && !e.error)).toBe(true);
    });

    test('should filter by failed status', () => {
      const log = monitor.getLog({ status: 'failed' });

      expect(log).toHaveLength(1);
      expect(log[0].error).toBe('Network error');
    });

    test('should filter by redirected status', () => {
      const log = monitor.getLog({ status: 'redirected' });

      expect(log).toHaveLength(1);
      expect(log[0].redirects.length).toBeGreaterThan(0);
    });

    test('should apply offset', () => {
      const log = monitor.getLog({ offset: 2 });

      expect(log).toHaveLength(3);
      expect(log[0].url).toBe('https://cdn.example.com/image.png');
    });

    test('should apply limit', () => {
      const log = monitor.getLog({ limit: 2 });

      expect(log).toHaveLength(2);
    });

    test('should combine filters', () => {
      const log = monitor.getLog({
        urlPattern: 'api\\.example\\.com',
        method: 'GET'
      });

      expect(log).toHaveLength(2);
    });
  });

  describe('Statistics', () => {
    test('should return accurate stats while capturing', () => {
      const monitor = new NetworkMonitor();

      monitor.startCapture();
      const stats = monitor.getStats();

      expect(stats.isCapturing).toBe(true);
      expect(stats.totalRequests).toBe(0);
      expect(stats.startTime).not.toBeNull();
      expect(stats.endTime).toBeNull();
      expect(stats.durationMs).toBeGreaterThanOrEqual(0);
    });

    test('should return accurate stats after stopping', () => {
      const monitor = new NetworkMonitor();

      monitor.startCapture();

      // Simulate a request
      monitor._onBeforeRequest({
        requestId: 'req-1',
        url: 'https://example.com',
        method: 'GET',
        type: 'main_frame',
        tabId: 1,
        frameId: 0,
        timeStamp: Date.now()
      });

      monitor._onCompleted({
        requestId: 'req-1',
        statusCode: 200,
        timeStamp: Date.now() + 100
      });

      monitor.stopCapture();

      const stats = monitor.getStats();

      expect(stats.isCapturing).toBe(false);
      expect(stats.totalRequests).toBe(1);
      expect(stats.completedRequests).toBe(1);
      expect(stats.logSize).toBe(1);
      expect(stats.endTime).not.toBeNull();
    });
  });

  describe('Log Management', () => {
    test('should clear log', () => {
      const monitor = new NetworkMonitor();

      monitor.networkLog = [{ url: 'test' }, { url: 'test2' }];
      monitor.requestMap.set('req-1', { url: 'pending' });

      const result = monitor.clearLog();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Cleared 2 log entries');
      expect(monitor.networkLog).toHaveLength(0);
      expect(monitor.requestMap.size).toBe(0);
    });

    test('should respect maxLogSize', () => {
      const monitor = new NetworkMonitor({ maxLogSize: 3 });

      for (let i = 0; i < 5; i++) {
        monitor._addToLog({ url: `request-${i}` });
      }

      expect(monitor.networkLog).toHaveLength(3);
      expect(monitor.networkLog[0].url).toBe('request-2');
      expect(monitor.networkLog[2].url).toBe('request-4');
    });
  });

  describe('Configuration Update', () => {
    test('should update configuration', () => {
      const monitor = new NetworkMonitor();

      const config = monitor.updateConfig({
        urlPatterns: ['*://new.example.com/*'],
        maxLogSize: 500
      });

      expect(config.urlPatterns).toEqual(['*://new.example.com/*']);
      expect(config.maxLogSize).toBe(500);
    });

    test('should restart capture if already capturing', () => {
      const monitor = new NetworkMonitor();

      monitor.startCapture();

      const initialListenerCount = chrome.webRequest.onBeforeRequest.addListener.mock.calls.length;

      monitor.updateConfig({ urlPatterns: ['*://new.example.com/*'] });

      // Should have removed and re-added listeners
      expect(chrome.webRequest.onBeforeRequest.removeListener).toHaveBeenCalled();
      expect(chrome.webRequest.onBeforeRequest.addListener.mock.calls.length).toBeGreaterThan(initialListenerCount);
    });
  });

  describe('Headers Conversion', () => {
    test('should convert headers array to object', () => {
      const monitor = new NetworkMonitor();

      const headers = [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Accept', value: 'text/html' }
      ];

      const result = monitor._headersToObject(headers);

      expect(result).toEqual({
        'Content-Type': 'application/json',
        'Accept': 'text/html'
      });
    });

    test('should handle duplicate headers', () => {
      const monitor = new NetworkMonitor();

      const headers = [
        { name: 'Set-Cookie', value: 'cookie1=value1' },
        { name: 'Set-Cookie', value: 'cookie2=value2' }
      ];

      const result = monitor._headersToObject(headers);

      expect(result['Set-Cookie']).toEqual(['cookie1=value1', 'cookie2=value2']);
    });

    test('should handle null headers', () => {
      const monitor = new NetworkMonitor();

      const result = monitor._headersToObject(null);

      expect(result).toBeNull();
    });
  });

  describe('HAR Export', () => {
    test('should export empty log as valid HAR', () => {
      const monitor = new NetworkMonitor();

      const har = monitor.exportAsHAR();

      expect(har.log).toBeDefined();
      expect(har.log.version).toBe('1.2');
      expect(har.log.creator.name).toBe('Basset Hound Network Monitor');
      expect(har.log.entries).toEqual([]);
    });

    test('should export requests in HAR format', () => {
      const monitor = new NetworkMonitor();

      monitor.networkLog = [{
        startTime: Date.now(),
        duration: 100,
        method: 'GET',
        url: 'https://example.com/api?foo=bar',
        statusCode: 200,
        statusLine: 'HTTP/1.1 200 OK',
        requestHeaders: { 'Accept': 'application/json' },
        responseHeaders: { 'Content-Type': 'application/json' },
        timing: {
          start: 1000,
          sendHeaders: 1010,
          headersReceived: 1050,
          responseStarted: 1060,
          completed: 1100,
          timeToFirstByte: 40
        }
      }];

      const har = monitor.exportAsHAR();

      expect(har.log.entries).toHaveLength(1);

      const entry = har.log.entries[0];
      expect(entry.request.method).toBe('GET');
      expect(entry.request.url).toBe('https://example.com/api?foo=bar');
      expect(entry.response.status).toBe(200);
      expect(entry.request.queryString).toEqual([{ name: 'foo', value: 'bar' }]);
    });
  });

  describe('Request Body Parsing', () => {
    test('should parse form data', () => {
      const monitor = new NetworkMonitor();

      const requestBody = {
        formData: {
          username: ['test'],
          password: ['secret']
        }
      };

      const result = monitor._parseRequestBody(requestBody);

      expect(result.type).toBe('formData');
      expect(result.data).toEqual(requestBody.formData);
    });

    test('should handle null request body', () => {
      const monitor = new NetworkMonitor();

      const result = monitor._parseRequestBody(null);

      expect(result).toBeNull();
    });

    test('should handle request body error', () => {
      const monitor = new NetworkMonitor();

      const requestBody = {
        error: 'Request body too large'
      };

      const result = monitor._parseRequestBody(requestBody);

      expect(result.type).toBe('error');
      expect(result.error).toBe('Request body too large');
    });
  });
});
