/**
 * Network Exporter Utility for Basset Hound Chrome Extension
 *
 * Provides comprehensive network export capabilities:
 * - Export network logs as HAR (HTTP Archive) format
 * - Export network logs as CSV for analysis
 * - Save network logs to downloadable files
 * - Generate network summary statistics
 * - Filter and analyze network traffic patterns
 */

/**
 * NetworkExporter class for exporting network logs in various formats
 */
class NetworkExporter {
  /**
   * Create a new NetworkExporter instance
   * @param {Object} networkMonitor - NetworkMonitor instance to export from
   */
  constructor(networkMonitor) {
    this.networkMonitor = networkMonitor;
  }

  /**
   * Export network log as HAR (HTTP Archive) format
   * @param {Object} options - Export options
   * @param {string} options.urlPattern - Filter by URL pattern (regex)
   * @param {string} options.method - Filter by HTTP method
   * @param {string} options.type - Filter by resource type
   * @param {boolean} options.includeContent - Include response content (default: false)
   * @returns {Object} - HAR formatted network log
   */
  exportAsHAR(options = {}) {
    try {
      const log = this.networkMonitor.getLog({
        urlPattern: options.urlPattern,
        method: options.method,
        type: options.type
      });

      const entries = log.map(entry => this._convertToHAREntry(entry, options.includeContent));

      const har = {
        log: {
          version: '1.2',
          creator: {
            name: 'Basset Hound Network Exporter',
            version: '1.0.0',
            comment: 'Chrome Extension Network Monitor'
          },
          browser: {
            name: 'Chrome',
            version: navigator.userAgent
          },
          pages: [],
          entries: entries,
          comment: `Exported at ${new Date().toISOString()}`
        }
      };

      return {
        success: true,
        format: 'HAR',
        har: har,
        entryCount: entries.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        format: 'HAR'
      };
    }
  }

  /**
   * Export network log as CSV format
   * @param {Object} options - Export options
   * @param {string} options.urlPattern - Filter by URL pattern (regex)
   * @param {string} options.method - Filter by HTTP method
   * @param {string} options.type - Filter by resource type
   * @param {Array<string>} options.fields - Fields to include in CSV
   * @returns {Object} - CSV formatted network log
   */
  exportAsCSV(options = {}) {
    try {
      const log = this.networkMonitor.getLog({
        urlPattern: options.urlPattern,
        method: options.method,
        type: options.type
      });

      // Default fields to include
      const fields = options.fields || [
        'method',
        'url',
        'type',
        'statusCode',
        'statusLine',
        'duration',
        'startTime',
        'endTime',
        'completed',
        'error'
      ];

      // Create CSV header
      const header = fields.join(',');

      // Create CSV rows
      const rows = log.map(entry => {
        return fields.map(field => {
          const value = this._getFieldValue(entry, field);
          // Escape CSV values
          return this._escapeCSV(value);
        }).join(',');
      });

      const csv = [header, ...rows].join('\n');

      return {
        success: true,
        format: 'CSV',
        csv: csv,
        rowCount: rows.length,
        fields: fields,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        format: 'CSV'
      };
    }
  }

  /**
   * Save network log to file
   * @param {Object} options - Save options
   * @param {string} options.format - Export format ('har', 'csv', 'json')
   * @param {string} options.filename - Filename (auto-generated if not provided)
   * @param {Object} options.filterOptions - Filter options to pass to export functions
   * @returns {Promise<Object>} - Save result with download info
   */
  async saveNetworkLog(options = {}) {
    try {
      const format = (options.format || 'json').toLowerCase();
      let content, mimeType, extension;

      // Generate content based on format
      switch (format) {
        case 'har': {
          const result = this.exportAsHAR(options.filterOptions || {});
          if (!result.success) {
            throw new Error(result.error);
          }
          content = JSON.stringify(result.har, null, 2);
          mimeType = 'application/json';
          extension = 'har';
          break;
        }

        case 'csv': {
          const result = this.exportAsCSV(options.filterOptions || {});
          if (!result.success) {
            throw new Error(result.error);
          }
          content = result.csv;
          mimeType = 'text/csv';
          extension = 'csv';
          break;
        }

        case 'json': {
          const log = this.networkMonitor.getLog(options.filterOptions || {});
          content = JSON.stringify(log, null, 2);
          mimeType = 'application/json';
          extension = 'json';
          break;
        }

        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      // Generate filename if not provided
      const filename = options.filename ||
        `network-log-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;

      // Create blob and download URL
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);

      // Trigger download
      const downloadId = await this._downloadFile(url, filename);

      return {
        success: true,
        filename: filename,
        format: format,
        size: content.length,
        downloadId: downloadId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get network summary statistics
   * @param {Object} options - Summary options
   * @param {string} options.urlPattern - Filter by URL pattern
   * @param {string} options.groupBy - Group statistics by field ('method', 'type', 'domain', 'status')
   * @returns {Object} - Network summary statistics
   */
  getNetworkSummary(options = {}) {
    try {
      const log = this.networkMonitor.getLog({
        urlPattern: options.urlPattern
      });

      const stats = this.networkMonitor.getStats();

      // Calculate detailed statistics
      const summary = {
        overview: {
          totalRequests: stats.totalRequests,
          completedRequests: stats.completedRequests,
          failedRequests: stats.failedRequests,
          redirectedRequests: stats.redirectedRequests,
          blockedRequests: stats.blockedRequests,
          logSize: stats.logSize,
          isCapturing: stats.isCapturing,
          durationMs: stats.durationMs
        },
        timing: {
          averageDuration: this._calculateAverage(log, 'duration'),
          minDuration: this._calculateMin(log, 'duration'),
          maxDuration: this._calculateMax(log, 'duration'),
          totalDuration: this._calculateSum(log, 'duration')
        },
        methods: this._groupByField(log, 'method'),
        types: this._groupByField(log, 'type'),
        statusCodes: this._groupByField(log, 'statusCode'),
        domains: this._groupByDomain(log),
        errors: this._analyzeErrors(log),
        timestamp: new Date().toISOString()
      };

      // Add grouped statistics if requested
      if (options.groupBy) {
        summary.groupedStats = this._getGroupedStats(log, options.groupBy);
      }

      return {
        success: true,
        summary: summary
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze network performance
   * @param {Object} options - Analysis options
   * @returns {Object} - Performance analysis
   */
  analyzePerformance(options = {}) {
    try {
      const log = this.networkMonitor.getLog(options);

      const analysis = {
        slowRequests: log
          .filter(entry => entry.duration && entry.duration > 1000)
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 10)
          .map(entry => ({
            url: entry.url,
            method: entry.method,
            duration: entry.duration,
            type: entry.type
          })),
        largeRequests: log
          .filter(entry => entry.responseHeaders)
          .map(entry => ({
            url: entry.url,
            size: this._getResponseSize(entry),
            type: entry.type
          }))
          .sort((a, b) => b.size - a.size)
          .slice(0, 10),
        failedRequests: log
          .filter(entry => entry.error || (entry.statusCode && entry.statusCode >= 400))
          .map(entry => ({
            url: entry.url,
            method: entry.method,
            statusCode: entry.statusCode,
            error: entry.error
          })),
        redirectChains: log
          .filter(entry => entry.redirects && entry.redirects.length > 0)
          .map(entry => ({
            originalUrl: entry.url,
            redirectCount: entry.redirects.length,
            finalUrl: entry.redirects[entry.redirects.length - 1]?.url
          })),
        timestamp: new Date().toISOString()
      };

      return {
        success: true,
        analysis: analysis
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Convert network log entry to HAR entry format
   * @private
   */
  _convertToHAREntry(entry, includeContent = false) {
    const harEntry = {
      startedDateTime: new Date(entry.startTime).toISOString(),
      time: entry.duration || 0,
      request: {
        method: entry.method,
        url: entry.url,
        httpVersion: 'HTTP/1.1',
        headers: this._convertHeadersToHAR(entry.requestHeaders),
        queryString: this._parseQueryString(entry.url),
        cookies: [],
        headersSize: -1,
        bodySize: -1
      },
      response: {
        status: entry.statusCode || 0,
        statusText: entry.statusLine || '',
        httpVersion: 'HTTP/1.1',
        headers: this._convertHeadersToHAR(entry.responseHeaders),
        cookies: [],
        content: {
          size: -1,
          mimeType: entry.responseHeaders?.['content-type'] || 'unknown',
          text: includeContent ? '' : undefined
        },
        redirectURL: entry.redirects && entry.redirects.length > 0
          ? entry.redirects[entry.redirects.length - 1].url
          : '',
        headersSize: -1,
        bodySize: -1
      },
      cache: {},
      timings: {
        blocked: -1,
        dns: -1,
        connect: -1,
        send: entry.timing.sendHeaders
          ? entry.timing.sendHeaders - entry.timing.start
          : -1,
        wait: entry.timing.timeToFirstByte || -1,
        receive: entry.timing.completed && entry.timing.responseStarted
          ? entry.timing.completed - entry.timing.responseStarted
          : -1,
        ssl: -1
      },
      serverIPAddress: '',
      connection: ''
    };

    // Add error information if present
    if (entry.error) {
      harEntry._error = entry.error;
    }

    return harEntry;
  }

  /**
   * Convert headers object to HAR format
   * @private
   */
  _convertHeadersToHAR(headers) {
    if (!headers) return [];

    return Object.entries(headers).map(([name, value]) => ({
      name,
      value: Array.isArray(value) ? value.join(', ') : String(value)
    }));
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

  /**
   * Get field value from entry with nested property support
   * @private
   */
  _getFieldValue(entry, field) {
    if (!entry) return '';

    // Handle nested properties
    const parts = field.split('.');
    let value = entry;
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) break;
    }

    // Convert to string
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Escape CSV value
   * @private
   */
  _escapeCSV(value) {
    const str = String(value);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Download file using Chrome downloads API
   * @private
   */
  _downloadFile(url, filename) {
    return new Promise((resolve, reject) => {
      chrome.downloads.download(
        {
          url: url,
          filename: filename,
          saveAs: true
        },
        downloadId => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(downloadId);
          }
        }
      );
    });
  }

  /**
   * Calculate average of a numeric field
   * @private
   */
  _calculateAverage(log, field) {
    const values = log
      .map(entry => entry[field])
      .filter(val => typeof val === 'number' && !isNaN(val));

    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate minimum of a numeric field
   * @private
   */
  _calculateMin(log, field) {
    const values = log
      .map(entry => entry[field])
      .filter(val => typeof val === 'number' && !isNaN(val));

    if (values.length === 0) return 0;
    return Math.min(...values);
  }

  /**
   * Calculate maximum of a numeric field
   * @private
   */
  _calculateMax(log, field) {
    const values = log
      .map(entry => entry[field])
      .filter(val => typeof val === 'number' && !isNaN(val));

    if (values.length === 0) return 0;
    return Math.max(...values);
  }

  /**
   * Calculate sum of a numeric field
   * @private
   */
  _calculateSum(log, field) {
    return log
      .map(entry => entry[field])
      .filter(val => typeof val === 'number' && !isNaN(val))
      .reduce((sum, val) => sum + val, 0);
  }

  /**
   * Group log entries by field
   * @private
   */
  _groupByField(log, field) {
    const groups = {};
    for (const entry of log) {
      const key = entry[field] || 'unknown';
      groups[key] = (groups[key] || 0) + 1;
    }
    return groups;
  }

  /**
   * Group log entries by domain
   * @private
   */
  _groupByDomain(log) {
    const domains = {};
    for (const entry of log) {
      try {
        const url = new URL(entry.url);
        const domain = url.hostname;
        domains[domain] = (domains[domain] || 0) + 1;
      } catch (e) {
        domains['invalid'] = (domains['invalid'] || 0) + 1;
      }
    }
    return domains;
  }

  /**
   * Analyze error patterns
   * @private
   */
  _analyzeErrors(log) {
    const errors = log.filter(entry => entry.error);
    const errorTypes = {};

    for (const entry of errors) {
      const errorType = entry.error || 'unknown';
      if (!errorTypes[errorType]) {
        errorTypes[errorType] = {
          count: 0,
          examples: []
        };
      }
      errorTypes[errorType].count++;
      if (errorTypes[errorType].examples.length < 3) {
        errorTypes[errorType].examples.push({
          url: entry.url,
          method: entry.method,
          time: entry.startTime
        });
      }
    }

    return {
      totalErrors: errors.length,
      errorTypes: errorTypes
    };
  }

  /**
   * Get grouped statistics
   * @private
   */
  _getGroupedStats(log, groupBy) {
    const groups = {};

    for (const entry of log) {
      let key;
      switch (groupBy) {
        case 'method':
          key = entry.method || 'unknown';
          break;
        case 'type':
          key = entry.type || 'unknown';
          break;
        case 'domain':
          try {
            key = new URL(entry.url).hostname;
          } catch (e) {
            key = 'invalid';
          }
          break;
        case 'status':
          key = entry.statusCode ? String(entry.statusCode) : 'unknown';
          break;
        default:
          key = 'unknown';
      }

      if (!groups[key]) {
        groups[key] = {
          count: 0,
          totalDuration: 0,
          avgDuration: 0,
          errors: 0,
          completed: 0
        };
      }

      groups[key].count++;
      if (entry.duration) {
        groups[key].totalDuration += entry.duration;
      }
      if (entry.error) {
        groups[key].errors++;
      }
      if (entry.completed) {
        groups[key].completed++;
      }
    }

    // Calculate averages
    for (const key in groups) {
      groups[key].avgDuration = groups[key].totalDuration / groups[key].count;
    }

    return groups;
  }

  /**
   * Get response size from headers
   * @private
   */
  _getResponseSize(entry) {
    if (!entry.responseHeaders) return 0;
    const contentLength = entry.responseHeaders['content-length'];
    return contentLength ? parseInt(contentLength, 10) : 0;
  }
}

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.NetworkExporter = NetworkExporter;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NetworkExporter };
}
