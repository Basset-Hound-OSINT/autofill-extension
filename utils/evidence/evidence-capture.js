/**
 * Basset Hound Browser Automation - Evidence Capture Module
 * Phase 11.1: Evidence Bundling for Law Enforcement
 *
 * Provides comprehensive evidence capture functionality:
 * - Screenshot capture with full provenance metadata
 * - SHA-256 hash generation for integrity verification
 * - Chain of custody initialization on capture
 * - Case number, exhibit number, examiner ID support
 * - JSON export compatible with law enforcement standards
 */

// =============================================================================
// Evidence Status Types
// =============================================================================

const EvidenceStatus = {
  CAPTURED: 'captured',
  VERIFIED: 'verified',
  SEALED: 'sealed',
  EXPORTED: 'exported',
  TRANSFERRED: 'transferred',
  ARCHIVED: 'archived'
};

const EvidenceType = {
  SCREENSHOT: 'screenshot',
  PAGE_CONTENT: 'page_content',
  NETWORK_DATA: 'network_data',
  FORM_DATA: 'form_data',
  COOKIE_DATA: 'cookie_data',
  STORAGE_DATA: 'storage_data',
  ELEMENT_DATA: 'element_data',
  VIDEO: 'video',
  AUDIO: 'audio'
};

const CaptureQuality = {
  LOW: { format: 'jpeg', quality: 60 },
  MEDIUM: { format: 'jpeg', quality: 85 },
  HIGH: { format: 'png', quality: 100 },
  LOSSLESS: { format: 'png', quality: 100 }
};

// =============================================================================
// EvidenceCapture Class
// =============================================================================

class EvidenceCapture {
  constructor(options = {}) {
    this.config = {
      examinerID: options.examinerID || null,
      caseNumber: options.caseNumber || null,
      logger: options.logger || null,
      autoInitCustody: options.autoInitCustody !== false,
      defaultQuality: options.defaultQuality || 'HIGH',
      capturedBy: options.capturedBy || 'autofill-extension'
    };

    this.evidenceItems = new Map();
    this.stats = {
      totalCaptures: 0,
      byType: {},
      totalSizeBytes: 0,
      lastCaptureTime: null
    };
    this._exhibitCounter = 0;
  }

  // ===========================================================================
  // Core Capture Methods
  // ===========================================================================

  async captureScreenshot(options = {}) {
    const {
      caseNumber = this.config.caseNumber,
      exhibitNumber = this._generateExhibitNumber(),
      examinerID = this.config.examinerID,
      notes = null,
      quality = this.config.defaultQuality,
      selector = null
    } = options;

    const captureTime = Date.now();
    const qualitySettings = CaptureQuality[quality] || CaptureQuality.HIGH;
    const evidenceId = this._generateEvidenceId();

    try {
      const screenshotData = await this._captureVisibleTab(qualitySettings);
      if (!screenshotData) throw new Error('Failed to capture screenshot');

      const hash = await this._generateSHA256Hash(screenshotData);
      const pageMetadata = this._capturePageMetadata();

      const evidence = {
        id: evidenceId,
        type: EvidenceType.SCREENSHOT,
        status: EvidenceStatus.CAPTURED,
        caseNumber,
        exhibitNumber,
        examinerID,
        captureTimestamp: captureTime,
        captureISO: new Date(captureTime).toISOString(),
        capturedBy: this.config.capturedBy,
        captureMethod: selector ? 'element_capture' : 'visible_tab',
        data: screenshotData,
        format: qualitySettings.format,
        quality: qualitySettings.quality,
        sizeBytes: this._calculateDataSize(screenshotData),
        integrity: { algorithm: 'SHA-256', hash: hash, verifiedAt: captureTime },
        page: pageMetadata,
        notes: notes,
        chainOfCustody: this.config.autoInitCustody ? [{
          timestamp: captureTime,
          timestampISO: new Date(captureTime).toISOString(),
          action: 'captured',
          userID: examinerID,
          notes: 'Evidence initially captured',
          hashBefore: null,
          hashAfter: hash
        }] : []
      };

      this.evidenceItems.set(evidenceId, evidence);
      this._updateStats(evidence);
      this._log('info', 'Screenshot captured: ' + evidenceId);

      return { success: true, evidence: this._getEvidenceSummary(evidence), evidenceId, hash, timestamp: Date.now() };
    } catch (error) {
      this._log('error', 'Screenshot capture failed: ' + error.message);
      return { success: false, error: error.message, evidenceId, timestamp: Date.now() };
    }
  }

  async capturePageContent(options = {}) {
    const {
      caseNumber = this.config.caseNumber,
      exhibitNumber = this._generateExhibitNumber(),
      examinerID = this.config.examinerID,
      notes = null,
      selector = null
    } = options;

    const captureTime = Date.now();
    const evidenceId = this._generateEvidenceId();

    try {
      let content;
      if (selector) {
        const element = document.querySelector(selector);
        if (!element) throw new Error('Element not found: ' + selector);
        content = element.outerHTML;
      } else {
        content = document.documentElement.outerHTML;
      }

      const hash = await this._generateSHA256Hash(content);
      const pageMetadata = this._capturePageMetadata();

      const evidence = {
        id: evidenceId,
        type: EvidenceType.PAGE_CONTENT,
        status: EvidenceStatus.CAPTURED,
        caseNumber,
        exhibitNumber,
        examinerID,
        captureTimestamp: captureTime,
        captureISO: new Date(captureTime).toISOString(),
        capturedBy: this.config.capturedBy,
        captureMethod: selector ? 'element_capture' : 'full_page',
        data: content,
        format: 'html',
        sizeBytes: this._calculateDataSize(content),
        selector: selector || null,
        integrity: { algorithm: 'SHA-256', hash: hash, verifiedAt: captureTime },
        page: pageMetadata,
        notes: notes,
        chainOfCustody: this.config.autoInitCustody ? [{
          timestamp: captureTime,
          timestampISO: new Date(captureTime).toISOString(),
          action: 'captured',
          userID: examinerID,
          notes: 'Page content captured',
          hashBefore: null,
          hashAfter: hash
        }] : []
      };

      this.evidenceItems.set(evidenceId, evidence);
      this._updateStats(evidence);
      this._log('info', 'Page content captured: ' + evidenceId);

      return { success: true, evidence: this._getEvidenceSummary(evidence), evidenceId, hash, timestamp: Date.now() };
    } catch (error) {
      this._log('error', 'Page content capture failed: ' + error.message);
      return { success: false, error: error.message, evidenceId, timestamp: Date.now() };
    }
  }

  async captureElement(elementOrSelector, options = {}) {
    const {
      caseNumber = this.config.caseNumber,
      exhibitNumber = this._generateExhibitNumber(),
      examinerID = this.config.examinerID,
      notes = null
    } = options;

    const captureTime = Date.now();
    const evidenceId = this._generateEvidenceId();

    try {
      const element = typeof elementOrSelector === 'string'
        ? document.querySelector(elementOrSelector)
        : elementOrSelector;

      if (!element) throw new Error('Element not found');

      const elementData = {
        tagName: element.tagName.toLowerCase(),
        id: element.id || null,
        className: element.className || null,
        outerHTML: element.outerHTML,
        innerText: element.innerText || null,
        attributes: this._getElementAttributes(element),
        selector: this._generateSelector(element),
        xpath: this._generateXPath(element),
        rect: this._getElementRect(element),
        computedStyles: this._getComputedStyles(element)
      };

      const serializedData = JSON.stringify(elementData);
      const hash = await this._generateSHA256Hash(serializedData);
      const pageMetadata = this._capturePageMetadata();

      const evidence = {
        id: evidenceId,
        type: EvidenceType.ELEMENT_DATA,
        status: EvidenceStatus.CAPTURED,
        caseNumber,
        exhibitNumber,
        examinerID,
        captureTimestamp: captureTime,
        captureISO: new Date(captureTime).toISOString(),
        capturedBy: this.config.capturedBy,
        captureMethod: 'element_extraction',
        data: elementData,
        format: 'json',
        sizeBytes: this._calculateDataSize(serializedData),
        integrity: { algorithm: 'SHA-256', hash: hash, verifiedAt: captureTime },
        page: pageMetadata,
        notes: notes,
        chainOfCustody: this.config.autoInitCustody ? [{
          timestamp: captureTime,
          timestampISO: new Date(captureTime).toISOString(),
          action: 'captured',
          userID: examinerID,
          notes: 'Element data captured',
          hashBefore: null,
          hashAfter: hash
        }] : []
      };

      this.evidenceItems.set(evidenceId, evidence);
      this._updateStats(evidence);
      this._log('info', 'Element captured: ' + evidenceId);

      return { success: true, evidence: this._getEvidenceSummary(evidence), evidenceId, hash, timestamp: Date.now() };
    } catch (error) {
      this._log('error', 'Element capture failed: ' + error.message);
      return { success: false, error: error.message, evidenceId, timestamp: Date.now() };
    }
  }

  // ===========================================================================
  // Evidence Management Methods
  // ===========================================================================

  getEvidence(evidenceId, includeData = false) {
    const evidence = this.evidenceItems.get(evidenceId);
    if (!evidence) return { success: false, error: 'Evidence not found', evidenceId, timestamp: Date.now() };
    if (this.config.autoInitCustody) this._recordCustodyEvent(evidenceId, 'viewed', { notes: 'Evidence accessed' });
    return { success: true, evidence: includeData ? evidence : this._getEvidenceSummary(evidence), timestamp: Date.now() };
  }

  listEvidence(options = {}) {
    const { caseNumber = null, type = null, status = null, since = 0, until = Date.now(), limit = 100, offset = 0 } = options;
    let items = Array.from(this.evidenceItems.values());
    if (caseNumber) items = items.filter(e => e.caseNumber === caseNumber);
    if (type) items = items.filter(e => e.type === type);
    if (status) items = items.filter(e => e.status === status);
    items = items.filter(e => e.captureTimestamp >= since && e.captureTimestamp <= until);
    items.sort((a, b) => b.captureTimestamp - a.captureTimestamp);
    const totalCount = items.length;
    items = items.slice(offset, offset + limit);
    return { success: true, items: items.map(e => this._getEvidenceSummary(e)), pagination: { total: totalCount, offset, limit, returned: items.length }, timestamp: Date.now() };
  }

  async verifyEvidence(evidenceId) {
    const evidence = this.evidenceItems.get(evidenceId);
    if (!evidence) return { success: false, error: 'Evidence not found', evidenceId, timestamp: Date.now() };
    try {
      const dataToHash = typeof evidence.data === 'string' ? evidence.data : JSON.stringify(evidence.data);
      const currentHash = await this._generateSHA256Hash(dataToHash);
      const isIntact = currentHash === evidence.integrity.hash;
      if (isIntact) { evidence.status = EvidenceStatus.VERIFIED; evidence.integrity.verifiedAt = Date.now(); }
      this._recordCustodyEvent(evidenceId, 'verified', { notes: isIntact ? 'Integrity verified' : 'INTEGRITY VIOLATION DETECTED', hashBefore: evidence.integrity.hash, hashAfter: currentHash });
      return { success: true, evidenceId, isIntact, originalHash: evidence.integrity.hash, currentHash, verifiedAt: Date.now(), timestamp: Date.now() };
    } catch (error) { return { success: false, error: error.message, evidenceId, timestamp: Date.now() }; }
  }

  async exportEvidence(evidenceId, options = {}) {
    const includeData = options.includeData !== false;
    const format = options.format || 'json';
    const evidence = this.evidenceItems.get(evidenceId);
    if (!evidence) return { success: false, error: 'Evidence not found', evidenceId, timestamp: Date.now() };
    const exportBundle = {
      exportMetadata: { exportedAt: new Date().toISOString(), exportedBy: this.config.examinerID, format, version: '1.0.0', standard: 'NIST-DF' },
      evidence: {
        id: evidence.id, type: evidence.type, status: evidence.status,
        case: { caseNumber: evidence.caseNumber, exhibitNumber: evidence.exhibitNumber, examinerID: evidence.examinerID },
        capture: { timestamp: evidence.captureTimestamp, timestampISO: evidence.captureISO, capturedBy: evidence.capturedBy, method: evidence.captureMethod },
        data: includeData ? evidence.data : '[DATA_EXCLUDED]',
        format: evidence.format, sizeBytes: evidence.sizeBytes,
        integrity: evidence.integrity, pageContext: evidence.page, notes: evidence.notes
      },
      chainOfCustody: evidence.chainOfCustody
    };
    evidence.status = EvidenceStatus.EXPORTED;
    this._recordCustodyEvent(evidenceId, 'exported', { notes: 'Exported in ' + format + ' format', includeData });
    const exportHash = await this._generateSHA256Hash(JSON.stringify(exportBundle));
    return { success: true, evidenceId, export: exportBundle, exportHash, mimeType: 'application/json', filename: 'evidence_' + evidenceId + '_' + Date.now() + '.json', timestamp: Date.now() };
  }

  async exportCaseBundle(evidenceIds, options = {}) {
    const caseNumber = options.caseNumber || this.config.caseNumber;
    const includeData = options.includeData !== false;
    const exports = []; const errors = [];
    for (const evidenceId of evidenceIds) {
      const result = await this.exportEvidence(evidenceId, { includeData });
      if (result.success) exports.push(result.export);
      else errors.push({ evidenceId, error: result.error });
    }
    const caseBundle = {
      caseMetadata: { caseNumber, exportedAt: new Date().toISOString(), exportedBy: this.config.examinerID, evidenceCount: exports.length, version: '1.0.0' },
      evidence: exports, errors: errors.length > 0 ? errors : undefined
    };
    const bundleHash = await this._generateSHA256Hash(JSON.stringify(caseBundle));
    return { success: true, caseNumber, evidenceCount: exports.length, errorCount: errors.length, bundle: caseBundle, bundleHash, mimeType: 'application/json', filename: 'case_' + (caseNumber || 'bundle') + '_' + Date.now() + '.json', timestamp: Date.now() };
  }

  // ===========================================================================
  // Annotation Methods
  // ===========================================================================

  /**
   * Open annotation tools for a captured screenshot
   * Opens the AnnotationTools UI overlay on a captured screenshot evidence item,
   * allowing the examiner to add highlights, redactions, and text annotations.
   *
   * @param {string} evidenceId - ID of the screenshot evidence to annotate
   * @param {Object} options - Annotation options
   * @param {Array} options.existingAnnotations - Pre-existing annotations to load
   * @param {Function} options.onSave - Callback when annotations are saved
   * @param {Function} options.onClose - Callback when annotation tool is closed
   * @returns {Promise<Object>} Result object with annotation session info
   *
   * @example
   * const capture = new EvidenceCapture({ examinerID: 'EX001' });
   * const result = await capture.captureScreenshot();
   * if (result.success) {
   *   const annotateResult = await capture.annotate(result.evidenceId, {
   *     onSave: (data) => console.log('Annotations saved:', data)
   *   });
   * }
   */
  async annotate(evidenceId, options = {}) {
    const evidence = this.evidenceItems.get(evidenceId);

    if (!evidence) {
      return {
        success: false,
        error: 'Evidence not found',
        evidenceId,
        timestamp: Date.now()
      };
    }

    // Only screenshots can be annotated
    if (evidence.type !== EvidenceType.SCREENSHOT) {
      return {
        success: false,
        error: 'Only screenshot evidence can be annotated. Evidence type: ' + evidence.type,
        evidenceId,
        timestamp: Date.now()
      };
    }

    // Verify image data exists
    if (!evidence.data) {
      return {
        success: false,
        error: 'Evidence data not available',
        evidenceId,
        timestamp: Date.now()
      };
    }

    try {
      // Get or create AnnotationTools instance
      const annotationTools = this._getAnnotationTools(options);

      // Record custody event for annotation session start
      this._recordCustodyEvent(evidenceId, 'annotation_started', {
        notes: 'Annotation session initiated by examiner: ' + this.config.examinerID
      });

      // Create a promise that resolves when annotation is complete
      return new Promise((resolve) => {
        const handleSave = async (saveResult) => {
          if (saveResult.success) {
            // Store annotations in evidence
            evidence.annotations = saveResult.metadata ? saveResult.metadata.annotations : [];

            // If annotations were baked into image, update the evidence
            if (saveResult.bakedImage) {
              // Store original image if not already stored
              if (!evidence.originalData) {
                evidence.originalData = evidence.data;
                evidence.originalHash = evidence.integrity.hash;
              }

              // Update evidence with annotated image
              evidence.annotatedData = saveResult.bakedImage;
              evidence.annotatedHash = saveResult.bakedImageHash;
              evidence.annotatedAt = new Date().toISOString();
              evidence.annotatedBy = this.config.examinerID;
            }

            // Record custody event for annotation
            this._recordCustodyEvent(evidenceId, 'annotated', {
              notes: 'Annotations applied: ' + (evidence.annotations ? evidence.annotations.length : 0) + ' annotations',
              hashBefore: evidence.originalHash || evidence.integrity.hash,
              hashAfter: saveResult.bakedImageHash || evidence.integrity.hash
            });

            this._log('info', 'Evidence annotated: ' + evidenceId + ' with ' +
              (evidence.annotations ? evidence.annotations.length : 0) + ' annotations');
          }

          // Call user's onSave callback if provided
          if (options.onSave) {
            options.onSave(saveResult);
          }
        };

        const handleClose = () => {
          // Record custody event for session end
          this._recordCustodyEvent(evidenceId, 'annotation_ended', {
            notes: 'Annotation session ended'
          });

          // Call user's onClose callback if provided
          if (options.onClose) {
            options.onClose();
          }

          resolve({
            success: true,
            evidenceId,
            annotationCount: evidence.annotations ? evidence.annotations.length : 0,
            hasAnnotatedImage: !!evidence.annotatedData,
            timestamp: Date.now()
          });
        };

        // Configure annotation tools with callbacks
        annotationTools.config.onSave = handleSave;
        annotationTools.config.onClose = handleClose;
        annotationTools.config.examinerID = this.config.examinerID;
        annotationTools.config.caseNumber = this.config.caseNumber;

        // Create ChainOfCustody adapter for annotation tools
        if (this.config.autoInitCustody) {
          annotationTools.config.chainOfCustody = {
            recordAccess: (action, details) => {
              return this._recordCustodyEvent(evidenceId, action, details);
            }
          };
        }

        // Open annotation tools with the screenshot
        const openResult = annotationTools.open(evidence.data, {
          evidenceId: evidenceId,
          originalHash: evidence.integrity.hash,
          existingAnnotations: options.existingAnnotations || evidence.annotations || []
        });

        if (!openResult.success) {
          resolve({
            success: false,
            error: openResult.error || 'Failed to open annotation tools',
            evidenceId,
            timestamp: Date.now()
          });
        }
      });
    } catch (error) {
      this._log('error', 'Failed to open annotation tools: ' + error.message);
      return {
        success: false,
        error: error.message,
        evidenceId,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get annotations for an evidence item
   * @param {string} evidenceId - Evidence ID
   * @returns {Object} Result with annotations array
   */
  getAnnotations(evidenceId) {
    const evidence = this.evidenceItems.get(evidenceId);
    if (!evidence) {
      return { success: false, error: 'Evidence not found', evidenceId, timestamp: Date.now() };
    }

    return {
      success: true,
      evidenceId,
      annotations: evidence.annotations || [],
      annotationCount: evidence.annotations ? evidence.annotations.length : 0,
      hasAnnotatedImage: !!evidence.annotatedData,
      annotatedAt: evidence.annotatedAt || null,
      annotatedBy: evidence.annotatedBy || null,
      timestamp: Date.now()
    };
  }

  /**
   * Get the annotated image data for an evidence item
   * @param {string} evidenceId - Evidence ID
   * @param {Object} options - Options
   * @param {boolean} options.preferAnnotated - Return annotated version if available (default: true)
   * @returns {Object} Result with image data
   */
  getEvidenceImage(evidenceId, options = {}) {
    const { preferAnnotated = true } = options;
    const evidence = this.evidenceItems.get(evidenceId);

    if (!evidence) {
      return { success: false, error: 'Evidence not found', evidenceId, timestamp: Date.now() };
    }

    if (evidence.type !== EvidenceType.SCREENSHOT) {
      return { success: false, error: 'Not a screenshot evidence', evidenceId, timestamp: Date.now() };
    }

    const useAnnotated = preferAnnotated && evidence.annotatedData;

    return {
      success: true,
      evidenceId,
      imageData: useAnnotated ? evidence.annotatedData : evidence.data,
      isAnnotated: useAnnotated,
      hash: useAnnotated ? evidence.annotatedHash : evidence.integrity.hash,
      originalHash: evidence.originalHash || evidence.integrity.hash,
      timestamp: Date.now()
    };
  }

  /**
   * Export evidence with annotations in NIST-DF format
   * @param {string} evidenceId - Evidence ID
   * @param {Object} options - Export options
   * @param {boolean} options.includeAnnotatedImage - Include baked image (default: true)
   * @param {boolean} options.includeOriginalImage - Include original image (default: true)
   * @returns {Object} NIST-DF formatted export bundle
   */
  async exportAnnotatedEvidence(evidenceId, options = {}) {
    const { includeAnnotatedImage = true, includeOriginalImage = true } = options;
    const evidence = this.evidenceItems.get(evidenceId);

    if (!evidence) {
      return { success: false, error: 'Evidence not found', evidenceId, timestamp: Date.now() };
    }

    const exportBundle = {
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: this.config.examinerID,
        format: 'json',
        version: '1.0.0',
        standard: 'NIST-DF'
      },
      evidence: {
        id: evidence.id,
        type: evidence.type,
        status: evidence.status,
        case: {
          caseNumber: evidence.caseNumber,
          exhibitNumber: evidence.exhibitNumber,
          examinerID: evidence.examinerID
        },
        capture: {
          timestamp: evidence.captureTimestamp,
          timestampISO: evidence.captureISO,
          capturedBy: evidence.capturedBy,
          method: evidence.captureMethod
        },
        originalImage: includeOriginalImage ? {
          data: evidence.originalData || evidence.data,
          hash: evidence.originalHash || evidence.integrity.hash,
          format: evidence.format,
          sizeBytes: evidence.sizeBytes
        } : '[ORIGINAL_IMAGE_EXCLUDED]',
        annotatedImage: evidence.annotatedData && includeAnnotatedImage ? {
          data: evidence.annotatedData,
          hash: evidence.annotatedHash,
          annotatedAt: evidence.annotatedAt,
          annotatedBy: evidence.annotatedBy
        } : null,
        annotations: {
          count: evidence.annotations ? evidence.annotations.length : 0,
          items: evidence.annotations || [],
          metadata: evidence.annotations ? {
            byType: this._groupAnnotationsByType(evidence.annotations),
            redactionCount: evidence.annotations.filter(a => a.type === 'redaction').length
          } : null
        },
        integrity: evidence.integrity,
        pageContext: evidence.page,
        notes: evidence.notes
      },
      chainOfCustody: evidence.chainOfCustody
    };

    // Update status and record custody event
    evidence.status = EvidenceStatus.EXPORTED;
    this._recordCustodyEvent(evidenceId, 'exported', {
      notes: 'Annotated evidence exported in NIST-DF format',
      includeAnnotatedImage,
      includeOriginalImage
    });

    const exportHash = await this._generateSHA256Hash(JSON.stringify(exportBundle));

    return {
      success: true,
      evidenceId,
      export: exportBundle,
      exportHash,
      mimeType: 'application/json',
      filename: 'annotated_evidence_' + evidenceId + '_' + Date.now() + '.json',
      timestamp: Date.now()
    };
  }

  /**
   * Get or create AnnotationTools instance
   * @private
   * @param {Object} options - Options
   * @returns {Object} AnnotationTools instance
   */
  _getAnnotationTools(options = {}) {
    // Try to get global instance or create new one
    if (typeof globalThis !== 'undefined' && globalThis.getAnnotationTools) {
      return globalThis.getAnnotationTools({
        examinerID: this.config.examinerID,
        caseNumber: this.config.caseNumber,
        logger: this.config.logger,
        ...options
      });
    }

    // Try to require the module in Node.js environment
    if (typeof require !== 'undefined') {
      try {
        const { getAnnotationTools } = require('../ui/annotation-tools.js');
        return getAnnotationTools({
          examinerID: this.config.examinerID,
          caseNumber: this.config.caseNumber,
          logger: this.config.logger,
          ...options
        });
      } catch (e) {
        this._log('warn', 'Could not load annotation tools module: ' + e.message);
      }
    }

    throw new Error('AnnotationTools not available. Ensure annotation-tools.js is loaded.');
  }

  /**
   * Group annotations by type
   * @private
   * @param {Array} annotations - Annotations array
   * @returns {Object} Counts by type
   */
  _groupAnnotationsByType(annotations) {
    const byType = {};
    for (const ann of annotations) {
      byType[ann.type] = (byType[ann.type] || 0) + 1;
    }
    return byType;
  }

  // ===========================================================================
  // Configuration Methods
  // ===========================================================================

  setCaseNumber(caseNumber) { const p = this.config.caseNumber; this.config.caseNumber = caseNumber; return { success: true, previousCaseNumber: p, newCaseNumber: caseNumber, timestamp: Date.now() }; }
  setExaminerID(examinerID) { const p = this.config.examinerID; this.config.examinerID = examinerID; return { success: true, previousExaminerID: p, newExaminerID: examinerID, timestamp: Date.now() }; }
  getConfig() { return { success: true, config: { ...this.config }, timestamp: Date.now() }; }
  getStats() { return { success: true, stats: { ...this.stats }, evidenceCount: this.evidenceItems.size, timestamp: Date.now() }; }

  // ===========================================================================
  // Chain of Custody Methods
  // ===========================================================================

  recordCustodyEvent(evidenceId, action, details = {}) { return this._recordCustodyEvent(evidenceId, action, details); }
  getChainOfCustody(evidenceId) {
    const evidence = this.evidenceItems.get(evidenceId);
    if (!evidence) return { success: false, error: 'Evidence not found', evidenceId, timestamp: Date.now() };
    return { success: true, evidenceId, chainOfCustody: evidence.chainOfCustody, recordCount: evidence.chainOfCustody.length, timestamp: Date.now() };
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  async _captureVisibleTab(qualitySettings) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.captureVisibleTab) {
        chrome.tabs.captureVisibleTab(null, { format: qualitySettings.format, quality: qualitySettings.quality }, (dataUrl) => {
          if (chrome.runtime.lastError) { resolve(null); return; }
          resolve(dataUrl);
        });
      } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'capture_screenshot', format: qualitySettings.format, quality: qualitySettings.quality }, (response) => {
          if (chrome.runtime.lastError) { resolve(null); return; }
          resolve(response && response.dataUrl ? response.dataUrl : null);
        });
      } else { resolve(null); }
    });
  }

  async _generateSHA256Hash(data) {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else if (typeof require !== 'undefined') {
      try { const c = require('crypto'); return c.createHash('sha256').update(data).digest('hex'); }
      catch (e) { return this._simpleHash(data); }
    } else { return this._simpleHash(data); }
  }

  _simpleHash(data) {
    let hash = 0;
    for (let i = 0; i < data.length; i++) { const char = data.charCodeAt(i); hash = ((hash << 5) - hash) + char; hash = hash & hash; }
    return 'fallback_' + Math.abs(hash).toString(16).padStart(16, '0');
  }

  _capturePageMetadata() {
    if (typeof window === 'undefined') return { url: 'unknown', title: 'unknown', domain: 'unknown' };
    return {
      url: window.location.href, title: document.title, domain: window.location.hostname,
      path: window.location.pathname, hash: window.location.hash || null, protocol: window.location.protocol,
      userAgent: navigator ? navigator.userAgent : null, language: document.documentElement ? document.documentElement.lang : null,
      viewport: { width: window.innerWidth, height: window.innerHeight, scrollX: window.scrollX, scrollY: window.scrollY },
      documentInfo: { contentType: document.contentType || null, characterSet: document.characterSet || null, lastModified: document.lastModified || null }
    };
  }

  _getElementAttributes(element) { const attrs = {}; for (const attr of element.attributes) { attrs[attr.name] = attr.value; } return attrs; }

  _generateSelector(element) {
    if (element.id) return '#' + element.id;
    const path = []; let current = element;
    while (current && current !== document.body && path.length < 10) {
      let selector = current.tagName.toLowerCase();
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c && !c.includes('basset')).slice(0, 2).join('.');
        if (classes) selector += '.' + classes;
      }
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(el => el.tagName === current.tagName);
        if (siblings.length > 1) selector += ':nth-child(' + (siblings.indexOf(current) + 1) + ')';
      }
      path.unshift(selector); current = parent;
    }
    return path.join(' > ');
  }

  _generateXPath(element) {
    if (element.id) return '//*[@id="' + element.id + '"]';
    const parts = []; let current = element;
    while (current && current.nodeType === 1 && parts.length < 10) {
      let index = 1; let sibling = current.previousElementSibling;
      while (sibling) { if (sibling.tagName === current.tagName) index++; sibling = sibling.previousElementSibling; }
      parts.unshift(current.tagName.toLowerCase() + '[' + index + ']'); current = current.parentElement;
    }
    return '//' + parts.join('/');
  }

  _getElementRect(element) {
    const rect = element.getBoundingClientRect();
    return { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height), bottom: Math.round(rect.bottom), right: Math.round(rect.right) };
  }

  _getComputedStyles(element) {
    if (typeof window === 'undefined' || !window.getComputedStyle) return {};
    const styles = window.getComputedStyle(element);
    return { display: styles.display, visibility: styles.visibility, position: styles.position, backgroundColor: styles.backgroundColor, color: styles.color, fontSize: styles.fontSize, fontFamily: styles.fontFamily };
  }

  _generateEvidenceId() { return 'evd_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8); }
  _generateExhibitNumber() { this._exhibitCounter++; return 'EXH-' + String(this._exhibitCounter).padStart(4, '0'); }
  _calculateDataSize(data) { if (typeof Blob !== 'undefined') return new Blob([data]).size; return Buffer.byteLength(data, 'utf8'); }

  _getEvidenceSummary(evidence) {
    return {
      id: evidence.id, type: evidence.type, status: evidence.status, caseNumber: evidence.caseNumber,
      exhibitNumber: evidence.exhibitNumber, examinerID: evidence.examinerID,
      captureTimestamp: evidence.captureTimestamp, captureISO: evidence.captureISO, format: evidence.format,
      sizeBytes: evidence.sizeBytes, hash: evidence.integrity.hash, custodyRecords: evidence.chainOfCustody.length,
      notes: evidence.notes, pageUrl: evidence.page ? evidence.page.url : null
    };
  }

  _recordCustodyEvent(evidenceId, action, details = {}) {
    const evidence = this.evidenceItems.get(evidenceId);
    if (!evidence) return { success: false, error: 'Evidence not found', evidenceId, timestamp: Date.now() };
    const event = {
      timestamp: Date.now(), timestampISO: new Date().toISOString(), action,
      userID: details.userID || this.config.examinerID, notes: details.notes || null,
      hashBefore: details.hashBefore || evidence.integrity.hash,
      hashAfter: details.hashAfter || evidence.integrity.hash,
      ipAddress: details.ipAddress || null
    };
    evidence.chainOfCustody.push(event);
    return { success: true, evidenceId, eventIndex: evidence.chainOfCustody.length - 1, timestamp: Date.now() };
  }

  _updateStats(evidence) {
    this.stats.totalCaptures++;
    this.stats.byType[evidence.type] = (this.stats.byType[evidence.type] || 0) + 1;
    this.stats.totalSizeBytes += evidence.sizeBytes || 0;
    this.stats.lastCaptureTime = evidence.captureTimestamp;
  }

  _log(level, message) {
    if (this.config.logger && this.config.logger[level]) this.config.logger[level](message);
    else if (typeof console !== 'undefined' && console[level]) console[level]('[EvidenceCapture] ' + message);
  }
}

// =============================================================================
// Global Instance
// =============================================================================

let evidenceCapture = null;
function getEvidenceCapture(options = {}) { if (!evidenceCapture) evidenceCapture = new EvidenceCapture(options); return evidenceCapture; }

// =============================================================================
// Exports
// =============================================================================

if (typeof globalThis !== 'undefined') {
  globalThis.EvidenceStatus = EvidenceStatus;
  globalThis.EvidenceType = EvidenceType;
  globalThis.CaptureQuality = CaptureQuality;
  globalThis.EvidenceCapture = EvidenceCapture;
  globalThis.getEvidenceCapture = getEvidenceCapture;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EvidenceStatus, EvidenceType, CaptureQuality, EvidenceCapture, getEvidenceCapture };
}
