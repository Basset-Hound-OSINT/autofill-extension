/**
 * Basset Hound Browser Automation - Browser State Snapshot Module
 * Phase 14+: Forensic Evidence Collection
 *
 * Captures complete browser state at a moment in time for forensic evidence.
 * Provides comprehensive snapshots of:
 * - Page state (HTML, viewport, focus, selection)
 * - Storage state (cookies, localStorage, sessionStorage, IndexedDB)
 * - Network state (online status, service workers, websockets)
 * - Form state (all forms and field values)
 * - Navigation state (URL, history, referrer)
 * - Performance state (memory, timing, resources)
 *
 * Includes snapshot comparison and integrity verification with SHA-256 hashing.
 */

// =============================================================================
// Constants and Types
// =============================================================================

const SnapshotType = {
  FULL: 'full',
  PAGE_ONLY: 'page_only',
  STORAGE_ONLY: 'storage_only',
  NETWORK_ONLY: 'network_only',
  MINIMAL: 'minimal'
};

const SnapshotFormat = {
  JSON: 'json',
  JSON_PRETTY: 'json_pretty',
  COMPRESSED: 'compressed'
};

// =============================================================================
// BrowserSnapshot Class
// =============================================================================

class BrowserSnapshot {
  constructor(options = {}) {
    this.config = {
      logger: options.logger || null,
      examinerID: options.examinerID || null,
      caseNumber: options.caseNumber || null,
      includePasswords: options.includePasswords === true, // Default false for security
      maxResourceEntries: options.maxResourceEntries || 100,
      maxHistoryDepth: options.maxHistoryDepth || 50,
      capturedBy: options.capturedBy || 'autofill-extension'
    };

    this.snapshots = new Map();
    this.stats = {
      totalSnapshots: 0,
      lastSnapshotTime: null,
      averageSnapshotSize: 0
    };
  }

  // ===========================================================================
  // 1. Page State Snapshot
  // ===========================================================================

  /**
   * Capture complete page state including HTML, viewport, scroll, focus
   * @returns {Object} Page state snapshot
   */
  capturePageState() {
    try {
      // Get DOCTYPE declaration
      let doctype = '';
      if (document.doctype) {
        doctype = `<!DOCTYPE ${document.doctype.name}`;
        if (document.doctype.publicId) {
          doctype += ` PUBLIC "${document.doctype.publicId}"`;
        }
        if (document.doctype.systemId) {
          doctype += ` "${document.doctype.systemId}"`;
        }
        doctype += '>';
      }

      // Get focused element details
      let focusedElement = null;
      if (document.activeElement && document.activeElement !== document.body) {
        focusedElement = {
          tagName: document.activeElement.tagName,
          id: document.activeElement.id || null,
          name: document.activeElement.name || null,
          type: document.activeElement.type || null,
          className: document.activeElement.className || null,
          selector: this._generateSelector(document.activeElement),
          xpath: this._generateXPath(document.activeElement),
          value: this._shouldCaptureValue(document.activeElement)
            ? document.activeElement.value
            : '[REDACTED]'
        };
      }

      // Get text selection
      const selection = window.getSelection();
      const selectedText = selection ? selection.toString() : '';
      let selectionRange = null;
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        selectionRange = {
          text: selectedText,
          startOffset: range.startOffset,
          endOffset: range.endOffset,
          commonAncestor: range.commonAncestorContainer.nodeName
        };
      }

      return {
        html: document.documentElement.outerHTML,
        doctype: doctype,
        url: window.location.href,
        title: document.title,
        readyState: document.readyState,
        scrollPosition: {
          x: window.scrollX || window.pageXOffset,
          y: window.scrollY || window.pageYOffset
        },
        scrollSize: {
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight
        },
        viewportSize: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        zoom: window.devicePixelRatio || 1,
        orientation: this._getOrientation(),
        selectedText: selectedText,
        selection: selectionRange,
        focusedElement: focusedElement,
        visibilityState: document.visibilityState,
        hasFocus: document.hasFocus(),
        characterSet: document.characterSet || document.charset,
        contentType: document.contentType,
        lastModified: document.lastModified,
        bodyClasses: document.body ? document.body.className : null,
        htmlClasses: document.documentElement ? document.documentElement.className : null,
        lang: document.documentElement ? document.documentElement.lang : null
      };
    } catch (error) {
      this._log('error', 'Failed to capture page state: ' + error.message);
      return { error: error.message };
    }
  }

  // ===========================================================================
  // 2. Storage State Snapshot
  // ===========================================================================

  /**
   * Capture all storage state including cookies, localStorage, sessionStorage, IndexedDB
   * @returns {Promise<Object>} Storage state snapshot
   */
  async captureStorageState() {
    try {
      // Capture cookies
      const cookies = this._parseCookies();

      // Capture localStorage
      const localStorage = {};
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            localStorage[key] = window.localStorage.getItem(key);
          }
        }
      } catch (e) {
        this._log('warn', 'localStorage access denied: ' + e.message);
      }

      // Capture sessionStorage
      const sessionStorage = {};
      try {
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key) {
            sessionStorage[key] = window.sessionStorage.getItem(key);
          }
        }
      } catch (e) {
        this._log('warn', 'sessionStorage access denied: ' + e.message);
      }

      // Capture IndexedDB info
      const indexedDB = await this._getIndexedDBInfo();

      return {
        cookies: {
          count: cookies.length,
          items: cookies
        },
        localStorage: {
          count: Object.keys(localStorage).length,
          items: localStorage,
          sizeBytes: this._calculateStorageSize(localStorage)
        },
        sessionStorage: {
          count: Object.keys(sessionStorage).length,
          items: sessionStorage,
          sizeBytes: this._calculateStorageSize(sessionStorage)
        },
        indexedDB: indexedDB,
        totalStorageEstimate: await this._getStorageEstimate()
      };
    } catch (error) {
      this._log('error', 'Failed to capture storage state: ' + error.message);
      return { error: error.message };
    }
  }

  // ===========================================================================
  // 3. Network State Snapshot
  // ===========================================================================

  /**
   * Capture network state including online status, service workers, connections
   * @returns {Promise<Object>} Network state snapshot
   */
  async captureNetworkState() {
    try {
      const networkState = {
        online: navigator.onLine,
        connectionType: this._getConnectionType(),
        effectiveType: this._getEffectiveConnectionType(),
        downlink: this._getDownlink(),
        rtt: this._getRTT(),
        saveData: this._getSaveData()
      };

      // Service worker info
      const serviceWorkers = await this._getServiceWorkerInfo();

      // Cache API info
      const cacheAPIs = await this._getCacheInfo();

      // WebSocket info (can only detect, not inspect)
      const websockets = this._getWebSocketInfo();

      // Pending fetch/XHR info (limited detection)
      const pendingRequests = this._getPendingFetches();

      return {
        connection: networkState,
        serviceWorkers: serviceWorkers,
        cacheAPIs: cacheAPIs,
        websockets: websockets,
        pendingRequests: pendingRequests,
        protocol: window.location.protocol,
        port: window.location.port || (window.location.protocol === 'https:' ? '443' : '80')
      };
    } catch (error) {
      this._log('error', 'Failed to capture network state: ' + error.message);
      return { error: error.message };
    }
  }

  // ===========================================================================
  // 4. Form State Snapshot
  // ===========================================================================

  /**
   * Capture all forms and their field values on the page
   * @returns {Object} Form state snapshot
   */
  captureFormState() {
    try {
      const forms = [];
      const formElements = document.querySelectorAll('form');

      formElements.forEach((form, formIndex) => {
        const fields = [];
        const formFields = form.querySelectorAll('input, textarea, select');

        formFields.forEach((field, fieldIndex) => {
          // Determine if we should capture the value
          const shouldCapture = this._shouldCaptureValue(field);
          let value = shouldCapture ? this._getFieldValue(field) : '[REDACTED]';

          // For select elements, capture selected options
          let selectedOptions = null;
          if (field.tagName === 'SELECT') {
            selectedOptions = Array.from(field.selectedOptions).map(opt => ({
              value: opt.value,
              text: opt.text,
              index: opt.index
            }));
          }

          fields.push({
            index: fieldIndex,
            name: field.name || null,
            id: field.id || null,
            type: field.type || field.tagName.toLowerCase(),
            tagName: field.tagName,
            value: value,
            checked: field.checked || null,
            selected: field.selected || null,
            selectedOptions: selectedOptions,
            disabled: field.disabled,
            readonly: field.readOnly || false,
            required: field.required || false,
            placeholder: field.placeholder || null,
            maxLength: field.maxLength !== -1 ? field.maxLength : null,
            pattern: field.pattern || null,
            autocomplete: field.autocomplete || null,
            selector: this._generateSelector(field),
            xpath: this._generateXPath(field),
            label: this._findLabel(field),
            validationMessage: field.validationMessage || null,
            validity: field.validity ? {
              valid: field.validity.valid,
              valueMissing: field.validity.valueMissing,
              typeMismatch: field.validity.typeMismatch,
              patternMismatch: field.validity.patternMismatch
            } : null
          });
        });

        forms.push({
          index: formIndex,
          id: form.id || null,
          name: form.name || null,
          action: form.action || null,
          method: form.method ? form.method.toUpperCase() : 'GET',
          enctype: form.enctype || null,
          target: form.target || null,
          noValidate: form.noValidate || false,
          selector: this._generateSelector(form),
          xpath: this._generateXPath(form),
          fieldCount: fields.length,
          fields: fields,
          isValid: form.checkValidity ? form.checkValidity() : null
        });
      });

      // Capture standalone inputs (not in forms)
      const standaloneInputs = [];
      const allInputs = document.querySelectorAll('input, textarea, select');
      allInputs.forEach(input => {
        if (!input.form) {
          const shouldCapture = this._shouldCaptureValue(input);
          standaloneInputs.push({
            name: input.name || null,
            id: input.id || null,
            type: input.type || input.tagName.toLowerCase(),
            value: shouldCapture ? this._getFieldValue(input) : '[REDACTED]',
            selector: this._generateSelector(input),
            xpath: this._generateXPath(input)
          });
        }
      });

      return {
        formCount: forms.length,
        forms: forms,
        standaloneInputCount: standaloneInputs.length,
        standaloneInputs: standaloneInputs,
        totalFieldCount: forms.reduce((sum, f) => sum + f.fieldCount, 0) + standaloneInputs.length
      };
    } catch (error) {
      this._log('error', 'Failed to capture form state: ' + error.message);
      return { error: error.message };
    }
  }

  // ===========================================================================
  // 5. Navigation State Snapshot
  // ===========================================================================

  /**
   * Capture navigation state including URL, history, referrer
   * @returns {Object} Navigation state snapshot
   */
  captureNavigationState() {
    try {
      // Parse URL components
      const url = new URL(window.location.href);

      // Extract query parameters
      const queryParams = {};
      url.searchParams.forEach((value, key) => {
        queryParams[key] = value;
      });

      return {
        url: window.location.href,
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        port: window.location.port,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        origin: window.location.origin,
        host: window.location.host,
        href: window.location.href,
        queryParams: queryParams,
        referrer: document.referrer || null,
        historyLength: window.history.length,
        canGoBack: window.history.length > 1,
        canGoForward: false, // Cannot determine from browser API
        baseURI: document.baseURI,
        documentURI: document.documentURI,
        // Navigation timing
        navigationType: this._getNavigationType(),
        redirectCount: this._getRedirectCount()
      };
    } catch (error) {
      this._log('error', 'Failed to capture navigation state: ' + error.message);
      return { error: error.message };
    }
  }

  // ===========================================================================
  // 6. Performance State Snapshot
  // ===========================================================================

  /**
   * Capture performance metrics including memory, timing, resources
   * @returns {Object} Performance state snapshot
   */
  capturePerformanceState() {
    try {
      // Memory information (Chrome only)
      let memory = null;
      if (performance.memory) {
        memory = {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
          usedJSHeapSizeMB: (performance.memory.usedJSHeapSize / 1048576).toFixed(2),
          totalJSHeapSizeMB: (performance.memory.totalJSHeapSize / 1048576).toFixed(2),
          percentUsed: ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(2)
        };
      }

      // Navigation timing
      const timing = performance.timing;
      const navigation = {
        navigationStart: timing.navigationStart,
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        loadComplete: timing.loadEventEnd - timing.navigationStart,
        domInteractive: timing.domInteractive - timing.navigationStart,
        domComplete: timing.domComplete - timing.navigationStart,
        requestStart: timing.requestStart - timing.navigationStart,
        responseStart: timing.responseStart - timing.navigationStart,
        responseEnd: timing.responseEnd - timing.navigationStart,
        domLoading: timing.domLoading - timing.navigationStart,
        // Calculated metrics
        timeToFirstByte: timing.responseStart - timing.requestStart,
        domParseTime: timing.domInteractive - timing.responseEnd,
        domReadyTime: timing.domContentLoadedEventEnd - timing.navigationStart,
        fullLoadTime: timing.loadEventEnd - timing.navigationStart,
        connectTime: timing.connectEnd - timing.connectStart,
        dnsTime: timing.domainLookupEnd - timing.domainLookupStart
      };

      // Resource timing (limited to prevent huge arrays)
      const resources = performance.getEntriesByType('resource')
        .slice(0, this.config.maxResourceEntries)
        .map(r => ({
          name: r.name,
          initiatorType: r.initiatorType,
          duration: Math.round(r.duration * 100) / 100,
          startTime: Math.round(r.startTime * 100) / 100,
          transferSize: r.transferSize || 0,
          encodedBodySize: r.encodedBodySize || 0,
          decodedBodySize: r.decodedBodySize || 0,
          protocol: r.nextHopProtocol || null
        }));

      // Paint timing
      const paintEntries = performance.getEntriesByType('paint').map(p => ({
        name: p.name,
        startTime: Math.round(p.startTime * 100) / 100
      }));

      // Calculate resource statistics
      const resourceStats = this._calculateResourceStats(resources);

      // Get current time
      const now = performance.now();

      return {
        memory: memory,
        navigation: navigation,
        paint: paintEntries,
        resources: {
          count: resources.length,
          totalCount: performance.getEntriesByType('resource').length,
          items: resources,
          stats: resourceStats
        },
        currentTime: now,
        timeOrigin: performance.timeOrigin || null
      };
    } catch (error) {
      this._log('error', 'Failed to capture performance state: ' + error.message);
      return { error: error.message };
    }
  }

  // ===========================================================================
  // 7. Complete Snapshot
  // ===========================================================================

  /**
   * Capture complete browser snapshot with all state components
   * @param {Object} options - Snapshot options
   * @param {string} options.type - Snapshot type (full, page_only, etc.)
   * @param {string} options.notes - Optional notes about this snapshot
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<Object>} Complete snapshot
   */
  async captureSnapshot(options = {}) {
    const {
      type = SnapshotType.FULL,
      notes = null,
      metadata = {}
    } = options;

    const snapshotId = this._generateSnapshotId();
    const timestamp = Date.now();
    const timestampISO = new Date(timestamp).toISOString();

    this._log('info', 'Capturing snapshot: ' + snapshotId + ' (type: ' + type + ')');

    try {
      // Build snapshot based on type
      const snapshot = {
        id: snapshotId,
        timestamp: timestamp,
        timestampISO: timestampISO,
        type: type,
        capturedBy: this.config.capturedBy,
        examinerID: this.config.examinerID,
        caseNumber: this.config.caseNumber,
        notes: notes,
        metadata: metadata
      };

      // Capture different components based on type
      if (type === SnapshotType.FULL) {
        snapshot.page = this.capturePageState();
        snapshot.storage = await this.captureStorageState();
        snapshot.network = await this.captureNetworkState();
        snapshot.forms = this.captureFormState();
        snapshot.navigation = this.captureNavigationState();
        snapshot.performance = this.capturePerformanceState();
      } else if (type === SnapshotType.PAGE_ONLY) {
        snapshot.page = this.capturePageState();
        snapshot.navigation = this.captureNavigationState();
      } else if (type === SnapshotType.STORAGE_ONLY) {
        snapshot.storage = await this.captureStorageState();
      } else if (type === SnapshotType.NETWORK_ONLY) {
        snapshot.network = await this.captureNetworkState();
      } else if (type === SnapshotType.MINIMAL) {
        snapshot.page = {
          url: window.location.href,
          title: document.title,
          readyState: document.readyState
        };
        snapshot.navigation = this.captureNavigationState();
      }

      // Generate integrity hash
      const snapshotData = JSON.stringify(snapshot);
      snapshot.integrity = {
        algorithm: 'SHA-256',
        hash: await this._generateHash(snapshotData),
        sizeBytes: new Blob([snapshotData]).size
      };

      // Store snapshot
      this.snapshots.set(snapshotId, snapshot);
      this._updateStats(snapshot);

      this._log('info', 'Snapshot captured: ' + snapshotId + ' (' + snapshot.integrity.sizeBytes + ' bytes)');

      return {
        success: true,
        snapshotId: snapshotId,
        timestamp: timestamp,
        type: type,
        hash: snapshot.integrity.hash,
        sizeBytes: snapshot.integrity.sizeBytes
      };
    } catch (error) {
      this._log('error', 'Failed to capture snapshot: ' + error.message);
      return {
        success: false,
        error: error.message,
        snapshotId: snapshotId,
        timestamp: timestamp
      };
    }
  }

  // ===========================================================================
  // 8. Snapshot Comparison
  // ===========================================================================

  /**
   * Compare two snapshots and identify differences
   * @param {string} snapshotId1 - First snapshot ID
   * @param {string} snapshotId2 - Second snapshot ID
   * @returns {Object} Comparison result
   */
  compareSnapshots(snapshotId1, snapshotId2) {
    const snapshot1 = this.snapshots.get(snapshotId1);
    const snapshot2 = this.snapshots.get(snapshotId2);

    if (!snapshot1) {
      return { success: false, error: 'Snapshot 1 not found: ' + snapshotId1 };
    }
    if (!snapshot2) {
      return { success: false, error: 'Snapshot 2 not found: ' + snapshotId2 };
    }

    this._log('info', 'Comparing snapshots: ' + snapshotId1 + ' vs ' + snapshotId2);

    try {
      const comparison = {
        snapshot1: {
          id: snapshotId1,
          timestamp: snapshot1.timestamp,
          timestampISO: snapshot1.timestampISO
        },
        snapshot2: {
          id: snapshotId2,
          timestamp: snapshot2.timestamp,
          timestampISO: snapshot2.timestampISO
        },
        timeDelta: snapshot2.timestamp - snapshot1.timestamp,
        timeDeltaFormatted: this._formatDuration(snapshot2.timestamp - snapshot1.timestamp)
      };

      // Compare page state
      if (snapshot1.page && snapshot2.page) {
        comparison.pageChanges = {
          htmlChanged: snapshot1.page.html !== snapshot2.page.html,
          urlChanged: snapshot1.page.url !== snapshot2.page.url,
          titleChanged: snapshot1.page.title !== snapshot2.page.title,
          scrollChanged:
            snapshot1.page.scrollPosition.x !== snapshot2.page.scrollPosition.x ||
            snapshot1.page.scrollPosition.y !== snapshot2.page.scrollPosition.y,
          focusChanged: JSON.stringify(snapshot1.page.focusedElement) !== JSON.stringify(snapshot2.page.focusedElement),
          selectionChanged: snapshot1.page.selectedText !== snapshot2.page.selectedText,
          visibilityChanged: snapshot1.page.visibilityState !== snapshot2.page.visibilityState,
          scrollDelta: {
            x: snapshot2.page.scrollPosition.x - snapshot1.page.scrollPosition.x,
            y: snapshot2.page.scrollPosition.y - snapshot1.page.scrollPosition.y
          }
        };
      }

      // Compare storage state
      if (snapshot1.storage && snapshot2.storage) {
        comparison.storageChanges = this._diffStorage(snapshot1.storage, snapshot2.storage);
      }

      // Compare form state
      if (snapshot1.forms && snapshot2.forms) {
        comparison.formChanges = this._diffForms(snapshot1.forms, snapshot2.forms);
      }

      // Compare network state
      if (snapshot1.network && snapshot2.network) {
        comparison.networkChanges = this._diffNetwork(snapshot1.network, snapshot2.network);
      }

      // Compare navigation state
      if (snapshot1.navigation && snapshot2.navigation) {
        comparison.navigationChanges = {
          urlChanged: snapshot1.navigation.url !== snapshot2.navigation.url,
          hashChanged: snapshot1.navigation.hash !== snapshot2.navigation.hash,
          searchChanged: snapshot1.navigation.search !== snapshot2.navigation.search,
          historyLengthChanged: snapshot1.navigation.historyLength !== snapshot2.navigation.historyLength,
          historyLengthDelta: snapshot2.navigation.historyLength - snapshot1.navigation.historyLength
        };
      }

      // Compare performance state
      if (snapshot1.performance && snapshot2.performance) {
        comparison.performanceChanges = this._diffPerformance(snapshot1.performance, snapshot2.performance);
      }

      // Calculate overall change summary
      comparison.summary = this._summarizeChanges(comparison);

      return {
        success: true,
        comparison: comparison,
        timestamp: Date.now()
      };
    } catch (error) {
      this._log('error', 'Failed to compare snapshots: ' + error.message);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  // ===========================================================================
  // 9. Snapshot Export
  // ===========================================================================

  /**
   * Export snapshot to specified format
   * @param {string} snapshotId - Snapshot ID to export
   * @param {Object} options - Export options
   * @param {string} options.format - Export format (json, json_pretty, compressed)
   * @param {boolean} options.includeMetadata - Include export metadata
   * @returns {Object} Export result with data
   */
  exportSnapshot(snapshotId, options = {}) {
    const {
      format = SnapshotFormat.JSON_PRETTY,
      includeMetadata = true
    } = options;

    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      return {
        success: false,
        error: 'Snapshot not found: ' + snapshotId,
        timestamp: Date.now()
      };
    }

    this._log('info', 'Exporting snapshot: ' + snapshotId + ' (format: ' + format + ')');

    try {
      let exportData = snapshot;

      // Add export metadata if requested
      if (includeMetadata) {
        exportData = {
          exportMetadata: {
            exportedAt: new Date().toISOString(),
            exportedBy: this.config.examinerID,
            format: format,
            version: '1.0.0',
            tool: 'browser-snapshot',
            standard: 'NIST-DF'
          },
          snapshot: snapshot
        };
      }

      // Format the export
      let formattedData;
      let mimeType;
      let fileExtension;

      if (format === SnapshotFormat.JSON) {
        formattedData = JSON.stringify(exportData);
        mimeType = 'application/json';
        fileExtension = 'json';
      } else if (format === SnapshotFormat.JSON_PRETTY) {
        formattedData = JSON.stringify(exportData, null, 2);
        mimeType = 'application/json';
        fileExtension = 'json';
      } else if (format === SnapshotFormat.COMPRESSED) {
        // For compressed, we still output JSON but indicate it should be compressed
        formattedData = JSON.stringify(exportData);
        mimeType = 'application/gzip';
        fileExtension = 'json.gz';
      } else {
        throw new Error('Unsupported format: ' + format);
      }

      const filename = 'snapshot_' + snapshotId + '_' + Date.now() + '.' + fileExtension;

      return {
        success: true,
        snapshotId: snapshotId,
        format: format,
        data: formattedData,
        mimeType: mimeType,
        filename: filename,
        sizeBytes: new Blob([formattedData]).size,
        timestamp: Date.now()
      };
    } catch (error) {
      this._log('error', 'Failed to export snapshot: ' + error.message);
      return {
        success: false,
        error: error.message,
        snapshotId: snapshotId,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Export comparison result
   * @param {string} snapshotId1 - First snapshot ID
   * @param {string} snapshotId2 - Second snapshot ID
   * @param {Object} options - Export options
   * @returns {Object} Export result
   */
  exportComparison(snapshotId1, snapshotId2, options = {}) {
    const comparison = this.compareSnapshots(snapshotId1, snapshotId2);
    if (!comparison.success) {
      return comparison;
    }

    const {
      format = SnapshotFormat.JSON_PRETTY
    } = options;

    try {
      const exportData = {
        exportMetadata: {
          exportedAt: new Date().toISOString(),
          exportedBy: this.config.examinerID,
          format: format,
          version: '1.0.0',
          tool: 'browser-snapshot',
          type: 'comparison'
        },
        comparison: comparison.comparison
      };

      let formattedData;
      if (format === SnapshotFormat.JSON_PRETTY) {
        formattedData = JSON.stringify(exportData, null, 2);
      } else {
        formattedData = JSON.stringify(exportData);
      }

      const filename = 'comparison_' + snapshotId1 + '_vs_' + snapshotId2 + '_' + Date.now() + '.json';

      return {
        success: true,
        format: format,
        data: formattedData,
        mimeType: 'application/json',
        filename: filename,
        sizeBytes: new Blob([formattedData]).size,
        timestamp: Date.now()
      };
    } catch (error) {
      this._log('error', 'Failed to export comparison: ' + error.message);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  // ===========================================================================
  // Snapshot Management
  // ===========================================================================

  /**
   * Get a snapshot by ID
   * @param {string} snapshotId - Snapshot ID
   * @returns {Object} Result with snapshot data
   */
  getSnapshot(snapshotId) {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      return {
        success: false,
        error: 'Snapshot not found: ' + snapshotId,
        timestamp: Date.now()
      };
    }

    return {
      success: true,
      snapshot: snapshot,
      timestamp: Date.now()
    };
  }

  /**
   * List all snapshots
   * @param {Object} options - List options
   * @returns {Object} List of snapshots
   */
  listSnapshots(options = {}) {
    const {
      limit = 100,
      offset = 0,
      type = null
    } = options;

    let snapshots = Array.from(this.snapshots.values());

    // Filter by type if specified
    if (type) {
      snapshots = snapshots.filter(s => s.type === type);
    }

    // Sort by timestamp (newest first)
    snapshots.sort((a, b) => b.timestamp - a.timestamp);

    const totalCount = snapshots.length;
    const paginatedSnapshots = snapshots.slice(offset, offset + limit);

    return {
      success: true,
      snapshots: paginatedSnapshots.map(s => ({
        id: s.id,
        timestamp: s.timestamp,
        timestampISO: s.timestampISO,
        type: s.type,
        hash: s.integrity ? s.integrity.hash : null,
        sizeBytes: s.integrity ? s.integrity.sizeBytes : null,
        notes: s.notes
      })),
      pagination: {
        total: totalCount,
        offset: offset,
        limit: limit,
        returned: paginatedSnapshots.length
      },
      timestamp: Date.now()
    };
  }

  /**
   * Delete a snapshot
   * @param {string} snapshotId - Snapshot ID to delete
   * @returns {Object} Result
   */
  deleteSnapshot(snapshotId) {
    if (!this.snapshots.has(snapshotId)) {
      return {
        success: false,
        error: 'Snapshot not found: ' + snapshotId,
        timestamp: Date.now()
      };
    }

    this.snapshots.delete(snapshotId);
    this._log('info', 'Snapshot deleted: ' + snapshotId);

    return {
      success: true,
      snapshotId: snapshotId,
      timestamp: Date.now()
    };
  }

  /**
   * Clear all snapshots
   * @returns {Object} Result
   */
  clearSnapshots() {
    const count = this.snapshots.size;
    this.snapshots.clear();
    this._log('info', 'All snapshots cleared: ' + count);

    return {
      success: true,
      deletedCount: count,
      timestamp: Date.now()
    };
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      success: true,
      stats: {
        ...this.stats,
        currentSnapshotCount: this.snapshots.size
      },
      timestamp: Date.now()
    };
  }

  // ===========================================================================
  // Private Helper Methods - Storage
  // ===========================================================================

  _parseCookies() {
    const cookies = [];
    if (document.cookie) {
      const cookieStrings = document.cookie.split(';');
      for (const cookieString of cookieStrings) {
        const parts = cookieString.split('=');
        const name = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        if (name) {
          cookies.push({ name, value });
        }
      }
    }
    return cookies;
  }

  async _getIndexedDBInfo() {
    try {
      if (!window.indexedDB) {
        return { available: false };
      }

      const databases = await window.indexedDB.databases();
      return {
        available: true,
        databaseCount: databases ? databases.length : 0,
        databases: databases ? databases.map(db => ({
          name: db.name,
          version: db.version
        })) : []
      };
    } catch (error) {
      return {
        available: true,
        error: error.message
      };
    }
  }

  async _getStorageEstimate() {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        return {
          usage: estimate.usage,
          quota: estimate.quota,
          usageMB: (estimate.usage / 1048576).toFixed(2),
          quotaMB: (estimate.quota / 1048576).toFixed(2),
          percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(2)
        };
      }
      return null;
    } catch (error) {
      return { error: error.message };
    }
  }

  _calculateStorageSize(storage) {
    try {
      return new Blob([JSON.stringify(storage)]).size;
    } catch (error) {
      return 0;
    }
  }

  // ===========================================================================
  // Private Helper Methods - Network
  // ===========================================================================

  _getConnectionType() {
    if (navigator.connection || navigator.mozConnection || navigator.webkitConnection) {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      return conn.type || conn.effectiveType || 'unknown';
    }
    return 'unknown';
  }

  _getEffectiveConnectionType() {
    if (navigator.connection || navigator.mozConnection || navigator.webkitConnection) {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      return conn.effectiveType || 'unknown';
    }
    return 'unknown';
  }

  _getDownlink() {
    if (navigator.connection || navigator.mozConnection || navigator.webkitConnection) {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      return conn.downlink || null;
    }
    return null;
  }

  _getRTT() {
    if (navigator.connection || navigator.mozConnection || navigator.webkitConnection) {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      return conn.rtt || null;
    }
    return null;
  }

  _getSaveData() {
    if (navigator.connection || navigator.mozConnection || navigator.webkitConnection) {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      return conn.saveData || false;
    }
    return false;
  }

  async _getServiceWorkerInfo() {
    try {
      if (!navigator.serviceWorker) {
        return { available: false };
      }

      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        return { available: true, registered: false };
      }

      return {
        available: true,
        registered: true,
        scope: registration.scope,
        state: registration.active ? registration.active.state : null,
        scriptURL: registration.active ? registration.active.scriptURL : null
      };
    } catch (error) {
      return { available: true, error: error.message };
    }
  }

  async _getCacheInfo() {
    try {
      if (!window.caches) {
        return { available: false };
      }

      const cacheNames = await window.caches.keys();
      return {
        available: true,
        cacheCount: cacheNames.length,
        cacheNames: cacheNames
      };
    } catch (error) {
      return { available: true, error: error.message };
    }
  }

  _getWebSocketInfo() {
    // Cannot directly inspect WebSocket connections, but can detect if WebSocket is available
    return {
      available: typeof WebSocket !== 'undefined',
      // Note: Cannot enumerate active connections due to browser security
      note: 'Active WebSocket connections cannot be enumerated for security reasons'
    };
  }

  _getPendingFetches() {
    // Cannot directly inspect pending fetch/XHR requests
    return {
      note: 'Pending fetch/XHR requests cannot be enumerated directly',
      // Could potentially use PerformanceObserver if configured ahead of time
      available: false
    };
  }

  // ===========================================================================
  // Private Helper Methods - Form/Field
  // ===========================================================================

  _shouldCaptureValue(field) {
    if (this.config.includePasswords) {
      return true;
    }

    const type = (field.type || '').toLowerCase();
    const name = (field.name || '').toLowerCase();
    const id = (field.id || '').toLowerCase();

    // Redact password fields
    if (type === 'password') {
      return false;
    }

    // Redact fields with sensitive names
    const sensitivePatterns = ['password', 'passwd', 'pwd', 'secret', 'token', 'api-key', 'apikey'];
    for (const pattern of sensitivePatterns) {
      if (name.includes(pattern) || id.includes(pattern)) {
        return false;
      }
    }

    return true;
  }

  _getFieldValue(field) {
    if (field.type === 'checkbox' || field.type === 'radio') {
      return field.checked;
    }
    return field.value || '';
  }

  _findLabel(field) {
    // Try to find associated label
    if (field.labels && field.labels.length > 0) {
      return field.labels[0].innerText.trim();
    }

    // Try to find label by for attribute
    if (field.id) {
      const label = document.querySelector('label[for="' + field.id + '"]');
      if (label) {
        return label.innerText.trim();
      }
    }

    // Try to find parent label
    let parent = field.parentElement;
    while (parent && parent !== document.body) {
      if (parent.tagName === 'LABEL') {
        return parent.innerText.trim();
      }
      parent = parent.parentElement;
    }

    return null;
  }

  // ===========================================================================
  // Private Helper Methods - Navigation/Performance
  // ===========================================================================

  _getOrientation() {
    if (window.screen && window.screen.orientation) {
      return {
        type: window.screen.orientation.type,
        angle: window.screen.orientation.angle
      };
    }
    return null;
  }

  _getNavigationType() {
    if (performance.navigation) {
      const types = ['navigate', 'reload', 'back_forward', 'prerender'];
      return types[performance.navigation.type] || 'unknown';
    }
    return 'unknown';
  }

  _getRedirectCount() {
    if (performance.navigation) {
      return performance.navigation.redirectCount || 0;
    }
    return 0;
  }

  _calculateResourceStats(resources) {
    if (!resources || resources.length === 0) {
      return null;
    }

    const byType = {};
    let totalDuration = 0;
    let totalSize = 0;

    for (const resource of resources) {
      // Count by type
      byType[resource.initiatorType] = (byType[resource.initiatorType] || 0) + 1;

      // Sum metrics
      totalDuration += resource.duration;
      totalSize += resource.transferSize;
    }

    return {
      byType: byType,
      totalDuration: Math.round(totalDuration * 100) / 100,
      averageDuration: Math.round((totalDuration / resources.length) * 100) / 100,
      totalSize: totalSize,
      totalSizeMB: (totalSize / 1048576).toFixed(2)
    };
  }

  // ===========================================================================
  // Private Helper Methods - Comparison/Diff
  // ===========================================================================

  _diffStorage(storage1, storage2) {
    const changes = {
      cookiesChanged: false,
      localStorageChanged: false,
      sessionStorageChanged: false,
      indexedDBChanged: false,
      details: {}
    };

    // Compare cookies
    if (storage1.cookies && storage2.cookies) {
      const cookies1 = JSON.stringify(storage1.cookies.items);
      const cookies2 = JSON.stringify(storage2.cookies.items);
      changes.cookiesChanged = cookies1 !== cookies2;
      changes.details.cookieCountDelta = storage2.cookies.count - storage1.cookies.count;
    }

    // Compare localStorage
    if (storage1.localStorage && storage2.localStorage) {
      const ls1 = JSON.stringify(storage1.localStorage.items);
      const ls2 = JSON.stringify(storage2.localStorage.items);
      changes.localStorageChanged = ls1 !== ls2;
      changes.details.localStorageCountDelta = storage2.localStorage.count - storage1.localStorage.count;
      changes.details.localStorageSizeDelta = storage2.localStorage.sizeBytes - storage1.localStorage.sizeBytes;
    }

    // Compare sessionStorage
    if (storage1.sessionStorage && storage2.sessionStorage) {
      const ss1 = JSON.stringify(storage1.sessionStorage.items);
      const ss2 = JSON.stringify(storage2.sessionStorage.items);
      changes.sessionStorageChanged = ss1 !== ss2;
      changes.details.sessionStorageCountDelta = storage2.sessionStorage.count - storage1.sessionStorage.count;
      changes.details.sessionStorageSizeDelta = storage2.sessionStorage.sizeBytes - storage1.sessionStorage.sizeBytes;
    }

    // Compare IndexedDB
    if (storage1.indexedDB && storage2.indexedDB) {
      changes.indexedDBChanged = JSON.stringify(storage1.indexedDB) !== JSON.stringify(storage2.indexedDB);
      if (storage1.indexedDB.databaseCount !== undefined && storage2.indexedDB.databaseCount !== undefined) {
        changes.details.indexedDBCountDelta = storage2.indexedDB.databaseCount - storage1.indexedDB.databaseCount;
      }
    }

    return changes;
  }

  _diffForms(forms1, forms2) {
    const changes = {
      formCountChanged: forms1.formCount !== forms2.formCount,
      formCountDelta: forms2.formCount - forms1.formCount,
      fieldCountChanged: forms1.totalFieldCount !== forms2.totalFieldCount,
      fieldCountDelta: forms2.totalFieldCount - forms1.totalFieldCount,
      formsAdded: [],
      formsRemoved: [],
      formsModified: []
    };

    // Create maps for comparison
    const forms1Map = new Map();
    const forms2Map = new Map();

    forms1.forms.forEach(form => {
      const key = form.id || form.name || 'form_' + form.index;
      forms1Map.set(key, form);
    });

    forms2.forms.forEach(form => {
      const key = form.id || form.name || 'form_' + form.index;
      forms2Map.set(key, form);
    });

    // Find added forms
    for (const [key, form] of forms2Map) {
      if (!forms1Map.has(key)) {
        changes.formsAdded.push(key);
      }
    }

    // Find removed forms
    for (const [key, form] of forms1Map) {
      if (!forms2Map.has(key)) {
        changes.formsRemoved.push(key);
      }
    }

    // Find modified forms
    for (const [key, form1] of forms1Map) {
      if (forms2Map.has(key)) {
        const form2 = forms2Map.get(key);
        if (JSON.stringify(form1.fields) !== JSON.stringify(form2.fields)) {
          changes.formsModified.push(key);
        }
      }
    }

    return changes;
  }

  _diffNetwork(network1, network2) {
    const changes = {
      onlineStatusChanged: network1.connection.online !== network2.connection.online,
      connectionTypeChanged: network1.connection.connectionType !== network2.connection.connectionType,
      serviceWorkerChanged: JSON.stringify(network1.serviceWorkers) !== JSON.stringify(network2.serviceWorkers),
      cacheChanged: JSON.stringify(network1.cacheAPIs) !== JSON.stringify(network2.cacheAPIs),
      details: {
        onlineStatus: {
          before: network1.connection.online,
          after: network2.connection.online
        },
        connectionType: {
          before: network1.connection.connectionType,
          after: network2.connection.connectionType
        }
      }
    };

    return changes;
  }

  _diffPerformance(perf1, perf2) {
    const changes = {
      memoryChanged: false,
      resourcesChanged: false,
      details: {}
    };

    // Compare memory
    if (perf1.memory && perf2.memory) {
      changes.memoryChanged = perf1.memory.usedJSHeapSize !== perf2.memory.usedJSHeapSize;
      changes.details.memoryDelta = perf2.memory.usedJSHeapSize - perf1.memory.usedJSHeapSize;
      changes.details.memoryDeltaMB = ((perf2.memory.usedJSHeapSize - perf1.memory.usedJSHeapSize) / 1048576).toFixed(2);
    }

    // Compare resource counts
    if (perf1.resources && perf2.resources) {
      changes.resourcesChanged = perf1.resources.totalCount !== perf2.resources.totalCount;
      changes.details.resourceCountDelta = perf2.resources.totalCount - perf1.resources.totalCount;
    }

    return changes;
  }

  _summarizeChanges(comparison) {
    const summary = {
      hasChanges: false,
      changeCount: 0,
      categories: []
    };

    // Check page changes
    if (comparison.pageChanges) {
      const pageChangeCount = Object.values(comparison.pageChanges).filter(v => v === true).length;
      if (pageChangeCount > 0) {
        summary.hasChanges = true;
        summary.changeCount += pageChangeCount;
        summary.categories.push('page');
      }
    }

    // Check storage changes
    if (comparison.storageChanges) {
      const storageChanged = comparison.storageChanges.cookiesChanged ||
                            comparison.storageChanges.localStorageChanged ||
                            comparison.storageChanges.sessionStorageChanged ||
                            comparison.storageChanges.indexedDBChanged;
      if (storageChanged) {
        summary.hasChanges = true;
        summary.changeCount++;
        summary.categories.push('storage');
      }
    }

    // Check form changes
    if (comparison.formChanges) {
      const formChanged = comparison.formChanges.formCountChanged ||
                         comparison.formChanges.fieldCountChanged ||
                         comparison.formChanges.formsModified.length > 0;
      if (formChanged) {
        summary.hasChanges = true;
        summary.changeCount++;
        summary.categories.push('forms');
      }
    }

    // Check network changes
    if (comparison.networkChanges) {
      const networkChanged = comparison.networkChanges.onlineStatusChanged ||
                            comparison.networkChanges.connectionTypeChanged ||
                            comparison.networkChanges.serviceWorkerChanged;
      if (networkChanged) {
        summary.hasChanges = true;
        summary.changeCount++;
        summary.categories.push('network');
      }
    }

    // Check navigation changes
    if (comparison.navigationChanges) {
      const navChanged = comparison.navigationChanges.urlChanged ||
                        comparison.navigationChanges.hashChanged ||
                        comparison.navigationChanges.searchChanged;
      if (navChanged) {
        summary.hasChanges = true;
        summary.changeCount++;
        summary.categories.push('navigation');
      }
    }

    // Check performance changes
    if (comparison.performanceChanges) {
      const perfChanged = comparison.performanceChanges.memoryChanged ||
                         comparison.performanceChanges.resourcesChanged;
      if (perfChanged) {
        summary.hasChanges = true;
        summary.changeCount++;
        summary.categories.push('performance');
      }
    }

    return summary;
  }

  // ===========================================================================
  // Private Helper Methods - Utilities
  // ===========================================================================

  async _generateHash(data) {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else if (typeof require !== 'undefined') {
      try {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(data).digest('hex');
      } catch (e) {
        return this._simpleHash(data);
      }
    } else {
      return this._simpleHash(data);
    }
  }

  _simpleHash(data) {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'fallback_' + Math.abs(hash).toString(16).padStart(16, '0');
  }

  _generateSnapshotId() {
    return 'snap_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
  }

  _generateSelector(element) {
    if (element.id) {
      return '#' + element.id;
    }

    const path = [];
    let current = element;

    while (current && current !== document.body && path.length < 10) {
      let selector = current.tagName.toLowerCase();

      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c).slice(0, 2).join('.');
        if (classes) {
          selector += '.' + classes;
        }
      }

      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(el => el.tagName === current.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += ':nth-child(' + index + ')';
        }
      }

      path.unshift(selector);
      current = parent;
    }

    return path.join(' > ');
  }

  _generateXPath(element) {
    if (element.id) {
      return '//*[@id="' + element.id + '"]';
    }

    const parts = [];
    let current = element;

    while (current && current.nodeType === 1 && parts.length < 10) {
      let index = 1;
      let sibling = current.previousElementSibling;

      while (sibling) {
        if (sibling.tagName === current.tagName) {
          index++;
        }
        sibling = sibling.previousElementSibling;
      }

      parts.unshift(current.tagName.toLowerCase() + '[' + index + ']');
      current = current.parentElement;
    }

    return '//' + parts.join('/');
  }

  _formatDuration(ms) {
    if (ms < 1000) {
      return ms + 'ms';
    } else if (ms < 60000) {
      return (ms / 1000).toFixed(2) + 's';
    } else if (ms < 3600000) {
      return (ms / 60000).toFixed(2) + 'min';
    } else {
      return (ms / 3600000).toFixed(2) + 'h';
    }
  }

  _updateStats(snapshot) {
    this.stats.totalSnapshots++;
    this.stats.lastSnapshotTime = snapshot.timestamp;

    if (snapshot.integrity && snapshot.integrity.sizeBytes) {
      const currentAvg = this.stats.averageSnapshotSize || 0;
      const currentCount = this.stats.totalSnapshots - 1;
      this.stats.averageSnapshotSize =
        (currentAvg * currentCount + snapshot.integrity.sizeBytes) / this.stats.totalSnapshots;
    }
  }

  _log(level, message) {
    if (this.config.logger && this.config.logger[level]) {
      this.config.logger[level](message);
    } else if (typeof console !== 'undefined' && console[level]) {
      console[level]('[BrowserSnapshot] ' + message);
    }
  }
}

// =============================================================================
// Global Instance
// =============================================================================

let browserSnapshot = null;

/**
 * Get or create global BrowserSnapshot instance
 * @param {Object} options - Configuration options
 * @returns {BrowserSnapshot} Global instance
 */
function getBrowserSnapshot(options = {}) {
  if (!browserSnapshot) {
    browserSnapshot = new BrowserSnapshot(options);
  }
  return browserSnapshot;
}

// =============================================================================
// Exports
// =============================================================================

if (typeof globalThis !== 'undefined') {
  globalThis.SnapshotType = SnapshotType;
  globalThis.SnapshotFormat = SnapshotFormat;
  globalThis.BrowserSnapshot = BrowserSnapshot;
  globalThis.getBrowserSnapshot = getBrowserSnapshot;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SnapshotType,
    SnapshotFormat,
    BrowserSnapshot,
    getBrowserSnapshot
  };
}
