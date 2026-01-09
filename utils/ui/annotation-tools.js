/**
 * Basset Hound Browser Automation - Evidence Annotation Tools
 * Phase 11.2: Evidence Annotation for Law Enforcement
 *
 * Provides comprehensive annotation tools for evidence screenshots:
 * - SVG-based annotation layer that overlays screenshots
 * - Highlight tool - semi-transparent colored rectangles
 * - Redaction tool - solid black rectangles for PII protection
 * - Text annotation tool - configurable text labels
 * - Selection/edit mode - modify existing annotations
 * - Floating toolbar UI for tool selection
 * - Integration with ChainOfCustody for audit trail
 * - Export as baked-in PNG or separate metadata JSON
 * - NIST-DF format compliance for forensic use
 */

// =============================================================================
// Annotation Types and Constants
// =============================================================================

/**
 * Available annotation tool types
 * @constant
 */
const AnnotationToolType = {
  SELECT: 'select',
  HIGHLIGHT: 'highlight',
  REDACTION: 'redaction',
  TEXT: 'text',
  ARROW: 'arrow',
  RECTANGLE: 'rectangle'
};

/**
 * Annotation element types for metadata
 * @constant
 */
const AnnotationType = {
  HIGHLIGHT: 'highlight',
  REDACTION: 'redaction',
  TEXT: 'text',
  ARROW: 'arrow',
  RECTANGLE: 'rectangle'
};

/**
 * Predefined highlight colors
 * @constant
 */
const HighlightColors = {
  YELLOW: { name: 'Yellow', fill: 'rgba(255, 235, 59, 0.4)', stroke: '#fbc02d' },
  GREEN: { name: 'Green', fill: 'rgba(76, 175, 80, 0.4)', stroke: '#388e3c' },
  BLUE: { name: 'Blue', fill: 'rgba(33, 150, 243, 0.4)', stroke: '#1976d2' },
  PINK: { name: 'Pink', fill: 'rgba(233, 30, 99, 0.4)', stroke: '#c2185b' },
  ORANGE: { name: 'Orange', fill: 'rgba(255, 152, 0, 0.4)', stroke: '#f57c00' },
  PURPLE: { name: 'Purple', fill: 'rgba(156, 39, 176, 0.4)', stroke: '#7b1fa2' }
};

/**
 * Default text annotation styles
 * @constant
 */
const TextStyles = {
  LABEL: { fontSize: 14, fontFamily: 'Arial, sans-serif', fill: '#ffffff', background: '#1e1e1e', padding: 4 },
  CALLOUT: { fontSize: 16, fontFamily: 'Arial, sans-serif', fill: '#ff0000', background: 'transparent', padding: 0 },
  NOTE: { fontSize: 12, fontFamily: 'Arial, sans-serif', fill: '#333333', background: '#fffde7', padding: 6 }
};

/**
 * Z-index hierarchy for annotation components
 * @constant
 */
const ANNOTATION_Z_INDEX = {
  OVERLAY: 9999990,
  SVG_LAYER: 9999991,
  TOOLBAR: 9999995,
  MODAL: 9999998,
  TOOLTIP: 9999999
};

// =============================================================================
// CSS Styles for Annotation Tools
// =============================================================================

/**
 * CSS styles for annotation tools UI components
 * @constant
 */
const ANNOTATION_TOOLS_STYLES = `
  /* Shadow DOM host styles */
  :host {
    all: initial;
    display: block;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  /* Main overlay container */
  .basset-annotation-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: ${ANNOTATION_Z_INDEX.OVERLAY};
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s ease, visibility 0.3s ease;
  }

  .basset-annotation-overlay.visible {
    opacity: 1;
    visibility: visible;
  }

  /* Canvas container */
  .basset-annotation-canvas-container {
    position: relative;
    max-width: 95vw;
    max-height: 85vh;
    overflow: auto;
    border-radius: 8px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  /* Screenshot image */
  .basset-annotation-image {
    display: block;
    max-width: 100%;
    user-select: none;
    -webkit-user-drag: none;
  }

  /* SVG annotation layer */
  .basset-annotation-svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: ${ANNOTATION_Z_INDEX.SVG_LAYER};
    cursor: crosshair;
  }

  .basset-annotation-svg.tool-select {
    cursor: default;
  }

  .basset-annotation-svg.tool-text {
    cursor: text;
  }

  /* Annotation elements */
  .basset-annotation-element {
    cursor: move;
  }

  .basset-annotation-element.selected {
    stroke-dasharray: 5, 3;
    animation: basset-annotation-dash 0.5s linear infinite;
  }

  @keyframes basset-annotation-dash {
    to {
      stroke-dashoffset: -8;
    }
  }

  /* Resize handles */
  .basset-annotation-handle {
    fill: #ffffff;
    stroke: #4a90d9;
    stroke-width: 2;
    cursor: nwse-resize;
  }

  .basset-annotation-handle.handle-nw { cursor: nwse-resize; }
  .basset-annotation-handle.handle-ne { cursor: nesw-resize; }
  .basset-annotation-handle.handle-sw { cursor: nesw-resize; }
  .basset-annotation-handle.handle-se { cursor: nwse-resize; }

  /* Floating toolbar */
  .basset-annotation-toolbar {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: ${ANNOTATION_Z_INDEX.TOOLBAR};
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: #1e1e1e;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    color: #e0e0e0;
  }

  .basset-annotation-toolbar-section {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .basset-annotation-toolbar-divider {
    width: 1px;
    height: 24px;
    background: #444;
    margin: 0 8px;
  }

  .basset-annotation-tool-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: #333;
    border: none;
    border-radius: 6px;
    color: #e0e0e0;
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 0;
  }

  .basset-annotation-tool-btn:hover {
    background: #444;
    color: #fff;
  }

  .basset-annotation-tool-btn.active {
    background: #4a90d9;
    color: #fff;
  }

  .basset-annotation-tool-btn svg {
    width: 20px;
    height: 20px;
  }

  .basset-annotation-tool-btn[title]::after {
    content: attr(title);
    position: absolute;
    bottom: -30px;
    left: 50%;
    transform: translateX(-50%);
    background: #000;
    color: #fff;
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 4px;
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    transition: all 0.2s;
    pointer-events: none;
  }

  .basset-annotation-tool-btn:hover[title]::after {
    opacity: 1;
    visibility: visible;
  }

  /* Color picker */
  .basset-annotation-color-picker {
    display: flex;
    gap: 4px;
  }

  .basset-annotation-color-btn {
    width: 24px;
    height: 24px;
    border: 2px solid transparent;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s;
  }

  .basset-annotation-color-btn:hover {
    transform: scale(1.1);
  }

  .basset-annotation-color-btn.active {
    border-color: #fff;
    box-shadow: 0 0 0 2px #4a90d9;
  }

  /* Action buttons */
  .basset-annotation-action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: #333;
    border: none;
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .basset-annotation-action-btn:hover {
    background: #444;
  }

  .basset-annotation-action-btn.primary {
    background: linear-gradient(135deg, #4a90d9 0%, #357abd 100%);
    color: #fff;
  }

  .basset-annotation-action-btn.primary:hover {
    opacity: 0.9;
  }

  .basset-annotation-action-btn.danger {
    background: #4a2020;
    color: #f87171;
  }

  .basset-annotation-action-btn.danger:hover {
    background: #5a2828;
  }

  .basset-annotation-action-btn svg {
    width: 16px;
    height: 16px;
  }

  /* Bottom toolbar */
  .basset-annotation-bottom-bar {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: ${ANNOTATION_Z_INDEX.TOOLBAR};
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background: #1e1e1e;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    color: #888;
    font-size: 13px;
  }

  .basset-annotation-status {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .basset-annotation-status-count {
    color: #4a90d9;
    font-weight: 600;
  }

  /* Text input modal */
  .basset-annotation-text-modal {
    position: fixed;
    z-index: ${ANNOTATION_Z_INDEX.MODAL};
    background: #1e1e1e;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    min-width: 250px;
  }

  .basset-annotation-text-modal input {
    width: 100%;
    padding: 10px 12px;
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 14px;
    outline: none;
    margin-bottom: 12px;
  }

  .basset-annotation-text-modal input:focus {
    border-color: #4a90d9;
  }

  .basset-annotation-text-modal-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  /* Keyboard shortcuts hint */
  .basset-annotation-shortcuts {
    position: fixed;
    bottom: 70px;
    right: 20px;
    z-index: ${ANNOTATION_Z_INDEX.TOOLBAR};
    background: #1e1e1e;
    border-radius: 8px;
    padding: 12px 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    font-size: 12px;
    color: #888;
    opacity: 0.8;
  }

  .basset-annotation-shortcuts kbd {
    display: inline-block;
    padding: 2px 6px;
    background: #333;
    border-radius: 4px;
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 11px;
    color: #e0e0e0;
    margin-right: 4px;
  }

  .basset-annotation-shortcuts-row {
    margin-bottom: 6px;
  }

  .basset-annotation-shortcuts-row:last-child {
    margin-bottom: 0;
  }
`;

// =============================================================================
// AnnotationTools Class
// =============================================================================

/**
 * AnnotationTools - Evidence annotation system for forensic screenshots
 * Provides comprehensive annotation capabilities with chain of custody integration
 */
class AnnotationTools {
  /**
   * Create an AnnotationTools instance
   * @param {Object} options - Configuration options
   * @param {string} options.examinerID - ID of the examiner performing annotations
   * @param {string} options.caseNumber - Case number for evidence tracking
   * @param {Object} options.chainOfCustody - ChainOfCustody instance for audit trail
   * @param {Object} options.logger - Logger instance for debugging
   * @param {Function} options.onSave - Callback when annotations are saved
   * @param {Function} options.onClose - Callback when annotation tool is closed
   */
  constructor(options = {}) {
    this.config = {
      examinerID: options.examinerID || null,
      caseNumber: options.caseNumber || null,
      chainOfCustody: options.chainOfCustody || null,
      logger: options.logger || null,
      onSave: options.onSave || null,
      onClose: options.onClose || null
    };

    /**
     * Current state of the annotation tool
     */
    this.state = {
      isOpen: false,
      currentTool: AnnotationToolType.HIGHLIGHT,
      currentColor: 'YELLOW',
      textStyle: 'LABEL',
      annotations: [],
      selectedAnnotationId: null,
      isDrawing: false,
      drawStartPoint: null,
      originalImageData: null,
      imageWidth: 0,
      imageHeight: 0,
      evidenceId: null,
      originalHash: null
    };

    /**
     * DOM element references
     */
    this.elements = {
      host: null,
      shadowRoot: null,
      overlay: null,
      canvasContainer: null,
      image: null,
      svg: null,
      toolbar: null,
      bottomBar: null,
      textModal: null,
      shortcuts: null
    };

    /**
     * Event handler bindings
     */
    this._boundHandlers = {
      onMouseDown: this._onMouseDown.bind(this),
      onMouseMove: this._onMouseMove.bind(this),
      onMouseUp: this._onMouseUp.bind(this),
      onKeyDown: this._onKeyDown.bind(this),
      onToolSelect: this._onToolSelect.bind(this),
      onColorSelect: this._onColorSelect.bind(this),
      onAnnotationClick: this._onAnnotationClick.bind(this)
    };

    /**
     * Statistics for the current session
     */
    this.stats = {
      annotationsCreated: 0,
      annotationsDeleted: 0,
      annotationsModified: 0,
      sessionStartTime: null
    };

    /**
     * Annotation ID counter
     */
    this._annotationIdCounter = 0;
  }

  // ===========================================================================
  // Public Methods - Core Functionality
  // ===========================================================================

  /**
   * Open the annotation tool with a screenshot
   * @param {string} imageData - Base64 encoded image data (data URL)
   * @param {Object} options - Additional options
   * @param {string} options.evidenceId - Evidence ID for tracking
   * @param {string} options.originalHash - Original hash of the image
   * @param {Array} options.existingAnnotations - Pre-existing annotations to load
   * @returns {Object} Result object
   */
  open(imageData, options = {}) {
    if (this.state.isOpen) {
      this._log('warn', 'Annotation tool already open');
      return { success: false, error: 'Already open', timestamp: Date.now() };
    }

    if (!imageData) {
      this._log('error', 'No image data provided');
      return { success: false, error: 'No image data', timestamp: Date.now() };
    }

    try {
      // Store state
      this.state.originalImageData = imageData;
      this.state.evidenceId = options.evidenceId || this._generateId('evd');
      this.state.originalHash = options.originalHash || null;
      this.state.annotations = options.existingAnnotations || [];
      this.stats.sessionStartTime = Date.now();

      // Create the UI
      this._createUI();
      this._attachEventListeners();
      this._loadImage(imageData);

      // Load existing annotations
      if (options.existingAnnotations && options.existingAnnotations.length > 0) {
        this._renderAnnotations();
      }

      // Show overlay
      this.elements.overlay.classList.add('visible');
      this.state.isOpen = true;

      // Record custody event
      this._recordCustodyEvent('annotation_session_started', {
        notes: 'Annotation tool opened for evidence: ' + this.state.evidenceId
      });

      this._log('info', 'Annotation tool opened for evidence: ' + this.state.evidenceId);

      return {
        success: true,
        evidenceId: this.state.evidenceId,
        timestamp: Date.now()
      };
    } catch (error) {
      this._log('error', 'Failed to open annotation tool: ' + error.message);
      return { success: false, error: error.message, timestamp: Date.now() };
    }
  }

  /**
   * Close the annotation tool
   * @param {boolean} saveFirst - Whether to save before closing
   * @returns {Object} Result object
   */
  close(saveFirst = false) {
    if (!this.state.isOpen) {
      return { success: false, error: 'Not open', timestamp: Date.now() };
    }

    if (saveFirst && this.state.annotations.length > 0) {
      this.save();
    }

    // Record custody event
    this._recordCustodyEvent('annotation_session_ended', {
      notes: 'Annotation tool closed. Created: ' + this.stats.annotationsCreated +
             ', Modified: ' + this.stats.annotationsModified +
             ', Deleted: ' + this.stats.annotationsDeleted
    });

    this._detachEventListeners();
    this._destroyUI();

    // Reset state
    this.state.isOpen = false;
    this.state.annotations = [];
    this.state.selectedAnnotationId = null;
    this.state.originalImageData = null;

    // Call close callback
    if (this.config.onClose) {
      this.config.onClose();
    }

    this._log('info', 'Annotation tool closed');

    return { success: true, timestamp: Date.now() };
  }

  /**
   * Save annotations and export data
   * @param {Object} options - Save options
   * @returns {Object} Result with annotation data and optionally baked image
   */
  async save(options = {}) {
    const {
      bakeAnnotations = false,
      includeMetadata = true,
      format = 'png'
    } = options;

    if (!this.state.isOpen || this.state.annotations.length === 0) {
      return {
        success: false,
        error: this.state.isOpen ? 'No annotations to save' : 'Not open',
        timestamp: Date.now()
      };
    }

    try {
      const result = {
        success: true,
        evidenceId: this.state.evidenceId,
        annotationCount: this.state.annotations.length,
        timestamp: Date.now()
      };

      // Generate annotation metadata
      if (includeMetadata) {
        result.metadata = this._generateMetadata();
      }

      // Bake annotations into image if requested
      if (bakeAnnotations) {
        result.bakedImage = await this._bakeAnnotationsToImage(format);
        result.bakedImageHash = await this._generateHash(result.bakedImage);
      }

      // Record custody event
      this._recordCustodyEvent('annotated', {
        notes: 'Annotations saved. Count: ' + this.state.annotations.length,
        hashBefore: this.state.originalHash,
        hashAfter: result.bakedImageHash || this.state.originalHash
      });

      // Call save callback
      if (this.config.onSave) {
        this.config.onSave(result);
      }

      this._log('info', 'Annotations saved: ' + this.state.annotations.length);

      return result;
    } catch (error) {
      this._log('error', 'Failed to save annotations: ' + error.message);
      return { success: false, error: error.message, timestamp: Date.now() };
    }
  }

  /**
   * Export annotations to NIST-DF format
   * @returns {Object} NIST-DF formatted annotation data
   */
  exportNISTFormat() {
    return {
      success: true,
      data: {
        'NIST-DF': {
          version: '1.0',
          annotationMetadata: {
            evidenceId: this.state.evidenceId,
            caseNumber: this.config.caseNumber,
            examinerID: this.config.examinerID,
            createdAt: new Date().toISOString(),
            tool: 'Basset Hound Evidence Annotation Tools',
            toolVersion: '1.0.0'
          },
          originalEvidence: {
            hash: {
              algorithm: 'SHA-256',
              value: this.state.originalHash
            },
            dimensions: {
              width: this.state.imageWidth,
              height: this.state.imageHeight
            }
          },
          annotations: this.state.annotations.map((ann, idx) => ({
            sequenceNumber: idx + 1,
            id: ann.id,
            type: ann.type,
            createdAt: ann.createdAt,
            createdBy: ann.createdBy,
            geometry: {
              x: ann.x,
              y: ann.y,
              width: ann.width,
              height: ann.height
            },
            properties: {
              color: ann.color || null,
              text: ann.text || null,
              style: ann.style || null
            },
            purpose: ann.notes || this._getAnnotationPurpose(ann.type)
          })),
          summary: {
            totalAnnotations: this.state.annotations.length,
            byType: this._getAnnotationsByType(),
            redactionCount: this.state.annotations.filter(a => a.type === AnnotationType.REDACTION).length
          }
        }
      },
      mimeType: 'application/json',
      filename: 'nist_df_annotations_' + this.state.evidenceId + '_' + Date.now() + '.json',
      timestamp: Date.now()
    };
  }

  /**
   * Get all current annotations
   * @returns {Array} Current annotations array
   */
  getAnnotations() {
    return [...this.state.annotations];
  }

  /**
   * Clear all annotations
   * @returns {Object} Result object
   */
  clearAnnotations() {
    const count = this.state.annotations.length;
    this.state.annotations = [];
    this.state.selectedAnnotationId = null;
    this.stats.annotationsDeleted += count;

    if (this.elements.svg) {
      this._clearSVG();
    }

    this._updateStatus();

    this._recordCustodyEvent('annotations_cleared', {
      notes: 'All annotations cleared. Count removed: ' + count
    });

    return { success: true, cleared: count, timestamp: Date.now() };
  }

  /**
   * Delete a specific annotation
   * @param {string} annotationId - ID of annotation to delete
   * @returns {Object} Result object
   */
  deleteAnnotation(annotationId) {
    const index = this.state.annotations.findIndex(a => a.id === annotationId);
    if (index === -1) {
      return { success: false, error: 'Annotation not found', timestamp: Date.now() };
    }

    const annotation = this.state.annotations[index];
    this.state.annotations.splice(index, 1);
    this.stats.annotationsDeleted++;

    if (this.state.selectedAnnotationId === annotationId) {
      this.state.selectedAnnotationId = null;
    }

    this._renderAnnotations();
    this._updateStatus();

    this._recordCustodyEvent('annotation_deleted', {
      notes: 'Annotation deleted: ' + annotation.type + ' at (' + annotation.x + ', ' + annotation.y + ')'
    });

    return { success: true, deletedId: annotationId, timestamp: Date.now() };
  }

  /**
   * Set the current tool
   * @param {string} toolType - Tool type from AnnotationToolType
   * @returns {Object} Result object
   */
  setTool(toolType) {
    if (!Object.values(AnnotationToolType).includes(toolType)) {
      return { success: false, error: 'Invalid tool type', timestamp: Date.now() };
    }

    this.state.currentTool = toolType;
    this._updateToolbarSelection();
    this._updateCursor();

    return { success: true, tool: toolType, timestamp: Date.now() };
  }

  /**
   * Set the current highlight color
   * @param {string} colorKey - Color key from HighlightColors
   * @returns {Object} Result object
   */
  setColor(colorKey) {
    if (!HighlightColors[colorKey]) {
      return { success: false, error: 'Invalid color', timestamp: Date.now() };
    }

    this.state.currentColor = colorKey;
    this._updateColorSelection();

    return { success: true, color: colorKey, timestamp: Date.now() };
  }

  /**
   * Undo the last annotation
   * @returns {Object} Result object
   */
  undo() {
    if (this.state.annotations.length === 0) {
      return { success: false, error: 'Nothing to undo', timestamp: Date.now() };
    }

    const removed = this.state.annotations.pop();
    this.stats.annotationsDeleted++;
    this._renderAnnotations();
    this._updateStatus();

    return { success: true, undoneId: removed.id, timestamp: Date.now() };
  }

  // ===========================================================================
  // Private Methods - UI Creation
  // ===========================================================================

  /**
   * Create the annotation UI using Shadow DOM
   * @private
   */
  _createUI() {
    // Create host element
    this.elements.host = document.createElement('div');
    this.elements.host.id = 'basset-annotation-tools';

    // Create shadow root for isolation
    this.elements.shadowRoot = this.elements.host.attachShadow({ mode: 'closed' });

    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.textContent = ANNOTATION_TOOLS_STYLES;
    this.elements.shadowRoot.appendChild(styleEl);

    // Create overlay
    this.elements.overlay = document.createElement('div');
    this.elements.overlay.className = 'basset-annotation-overlay';

    // Create canvas container
    this.elements.canvasContainer = document.createElement('div');
    this.elements.canvasContainer.className = 'basset-annotation-canvas-container';

    // Create image element
    this.elements.image = document.createElement('img');
    this.elements.image.className = 'basset-annotation-image';

    // Create SVG layer
    this.elements.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.elements.svg.setAttribute('class', 'basset-annotation-svg');

    // Assemble canvas
    this.elements.canvasContainer.appendChild(this.elements.image);
    this.elements.canvasContainer.appendChild(this.elements.svg);
    this.elements.overlay.appendChild(this.elements.canvasContainer);

    // Create toolbar
    this._createToolbar();

    // Create bottom status bar
    this._createBottomBar();

    // Create keyboard shortcuts hint
    this._createShortcutsHint();

    // Add to shadow root
    this.elements.shadowRoot.appendChild(this.elements.overlay);
    this.elements.shadowRoot.appendChild(this.elements.toolbar);
    this.elements.shadowRoot.appendChild(this.elements.bottomBar);
    this.elements.shadowRoot.appendChild(this.elements.shortcuts);

    // Add to document
    document.body.appendChild(this.elements.host);
  }

  /**
   * Create the floating toolbar
   * @private
   */
  _createToolbar() {
    this.elements.toolbar = document.createElement('div');
    this.elements.toolbar.className = 'basset-annotation-toolbar';
    this.elements.toolbar.innerHTML = `
      <div class="basset-annotation-toolbar-section">
        <button class="basset-annotation-tool-btn ${this.state.currentTool === AnnotationToolType.SELECT ? 'active' : ''}"
                data-tool="${AnnotationToolType.SELECT}" title="Select (V)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
            <path d="M13 13l6 6"/>
          </svg>
        </button>
        <button class="basset-annotation-tool-btn ${this.state.currentTool === AnnotationToolType.HIGHLIGHT ? 'active' : ''}"
                data-tool="${AnnotationToolType.HIGHLIGHT}" title="Highlight (H)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="5" width="18" height="14" rx="2"/>
          </svg>
        </button>
        <button class="basset-annotation-tool-btn ${this.state.currentTool === AnnotationToolType.REDACTION ? 'active' : ''}"
                data-tool="${AnnotationToolType.REDACTION}" title="Redact (R)">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="5" width="18" height="14" rx="2"/>
          </svg>
        </button>
        <button class="basset-annotation-tool-btn ${this.state.currentTool === AnnotationToolType.TEXT ? 'active' : ''}"
                data-tool="${AnnotationToolType.TEXT}" title="Text (T)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 7V4h16v3"/>
            <path d="M9 20h6"/>
            <path d="M12 4v16"/>
          </svg>
        </button>
      </div>

      <div class="basset-annotation-toolbar-divider"></div>

      <div class="basset-annotation-toolbar-section basset-annotation-color-picker">
        ${Object.entries(HighlightColors).map(([key, color]) => `
          <button class="basset-annotation-color-btn ${this.state.currentColor === key ? 'active' : ''}"
                  data-color="${key}"
                  style="background: ${color.stroke};"
                  title="${color.name}">
          </button>
        `).join('')}
      </div>

      <div class="basset-annotation-toolbar-divider"></div>

      <div class="basset-annotation-toolbar-section">
        <button class="basset-annotation-action-btn" data-action="undo" title="Undo (Ctrl+Z)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 7v6h6"/>
            <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
          </svg>
          Undo
        </button>
        <button class="basset-annotation-action-btn danger" data-action="clear" title="Clear All">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18"/>
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
          Clear
        </button>
      </div>

      <div class="basset-annotation-toolbar-divider"></div>

      <div class="basset-annotation-toolbar-section">
        <button class="basset-annotation-action-btn primary" data-action="save">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
            <polyline points="17,21 17,13 7,13 7,21"/>
            <polyline points="7,3 7,8 15,8"/>
          </svg>
          Save
        </button>
        <button class="basset-annotation-action-btn" data-action="export">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7,10 12,15 17,10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export
        </button>
        <button class="basset-annotation-action-btn" data-action="close" title="Close (Esc)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Close
        </button>
      </div>
    `;

    // Add toolbar event listeners
    this.elements.toolbar.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => this.setTool(btn.dataset.tool));
    });

    this.elements.toolbar.querySelectorAll('[data-color]').forEach(btn => {
      btn.addEventListener('click', () => this.setColor(btn.dataset.color));
    });

    this.elements.toolbar.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => this._handleAction(btn.dataset.action));
    });
  }

  /**
   * Create the bottom status bar
   * @private
   */
  _createBottomBar() {
    this.elements.bottomBar = document.createElement('div');
    this.elements.bottomBar.className = 'basset-annotation-bottom-bar';
    this.elements.bottomBar.innerHTML = `
      <div class="basset-annotation-status">
        <span>Annotations:</span>
        <span class="basset-annotation-status-count">0</span>
      </div>
      <div class="basset-annotation-toolbar-divider"></div>
      <div class="basset-annotation-status">
        <span>Evidence ID:</span>
        <span style="color: #4a90d9; font-family: monospace;">${this.state.evidenceId || 'N/A'}</span>
      </div>
      <div class="basset-annotation-toolbar-divider"></div>
      <div class="basset-annotation-status">
        <span>Examiner:</span>
        <span style="color: #4ade80;">${this.config.examinerID || 'Unknown'}</span>
      </div>
    `;
  }

  /**
   * Create keyboard shortcuts hint panel
   * @private
   */
  _createShortcutsHint() {
    this.elements.shortcuts = document.createElement('div');
    this.elements.shortcuts.className = 'basset-annotation-shortcuts';
    this.elements.shortcuts.innerHTML = `
      <div class="basset-annotation-shortcuts-row"><kbd>V</kbd> Select</div>
      <div class="basset-annotation-shortcuts-row"><kbd>H</kbd> Highlight</div>
      <div class="basset-annotation-shortcuts-row"><kbd>R</kbd> Redact</div>
      <div class="basset-annotation-shortcuts-row"><kbd>T</kbd> Text</div>
      <div class="basset-annotation-shortcuts-row"><kbd>Del</kbd> Delete selected</div>
      <div class="basset-annotation-shortcuts-row"><kbd>Ctrl+Z</kbd> Undo</div>
      <div class="basset-annotation-shortcuts-row"><kbd>Esc</kbd> Close</div>
    `;
  }

  /**
   * Destroy the UI
   * @private
   */
  _destroyUI() {
    if (this.elements.host && this.elements.host.parentNode) {
      this.elements.host.parentNode.removeChild(this.elements.host);
    }
    this.elements = {
      host: null,
      shadowRoot: null,
      overlay: null,
      canvasContainer: null,
      image: null,
      svg: null,
      toolbar: null,
      bottomBar: null,
      textModal: null,
      shortcuts: null
    };
  }

  // ===========================================================================
  // Private Methods - Event Handling
  // ===========================================================================

  /**
   * Attach event listeners
   * @private
   */
  _attachEventListeners() {
    if (this.elements.svg) {
      this.elements.svg.addEventListener('mousedown', this._boundHandlers.onMouseDown);
      this.elements.svg.addEventListener('mousemove', this._boundHandlers.onMouseMove);
      this.elements.svg.addEventListener('mouseup', this._boundHandlers.onMouseUp);
      this.elements.svg.addEventListener('mouseleave', this._boundHandlers.onMouseUp);
    }
    document.addEventListener('keydown', this._boundHandlers.onKeyDown);
  }

  /**
   * Detach event listeners
   * @private
   */
  _detachEventListeners() {
    if (this.elements.svg) {
      this.elements.svg.removeEventListener('mousedown', this._boundHandlers.onMouseDown);
      this.elements.svg.removeEventListener('mousemove', this._boundHandlers.onMouseMove);
      this.elements.svg.removeEventListener('mouseup', this._boundHandlers.onMouseUp);
      this.elements.svg.removeEventListener('mouseleave', this._boundHandlers.onMouseUp);
    }
    document.removeEventListener('keydown', this._boundHandlers.onKeyDown);
  }

  /**
   * Handle mouse down event
   * @private
   * @param {MouseEvent} e - Mouse event
   */
  _onMouseDown(e) {
    if (e.button !== 0) return; // Only left click

    const point = this._getMousePosition(e);

    // Check if clicking on existing annotation in select mode
    if (this.state.currentTool === AnnotationToolType.SELECT) {
      const clicked = this._getAnnotationAtPoint(point.x, point.y);
      if (clicked) {
        this._selectAnnotation(clicked.id);
        return;
      }
      this._deselectAnnotation();
      return;
    }

    // Start drawing for other tools
    if (this.state.currentTool === AnnotationToolType.TEXT) {
      this._showTextModal(point.x, point.y);
      return;
    }

    this.state.isDrawing = true;
    this.state.drawStartPoint = point;

    // Create preview element
    this._createPreviewElement(point);
  }

  /**
   * Handle mouse move event
   * @private
   * @param {MouseEvent} e - Mouse event
   */
  _onMouseMove(e) {
    if (!this.state.isDrawing || !this.state.drawStartPoint) return;

    const currentPoint = this._getMousePosition(e);
    this._updatePreviewElement(currentPoint);
  }

  /**
   * Handle mouse up event
   * @private
   * @param {MouseEvent} e - Mouse event
   */
  _onMouseUp(e) {
    if (!this.state.isDrawing) return;

    const endPoint = this._getMousePosition(e);
    this.state.isDrawing = false;

    // Calculate rectangle dimensions
    const rect = this._calculateRect(this.state.drawStartPoint, endPoint);

    // Only create annotation if it has meaningful size
    if (rect.width > 5 && rect.height > 5) {
      this._createAnnotation(rect);
    }

    // Remove preview
    this._removePreviewElement();
    this.state.drawStartPoint = null;
  }

  /**
   * Handle keyboard events
   * @private
   * @param {KeyboardEvent} e - Keyboard event
   */
  _onKeyDown(e) {
    if (!this.state.isOpen) return;

    // Tool shortcuts
    if (!e.ctrlKey && !e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'v':
          e.preventDefault();
          this.setTool(AnnotationToolType.SELECT);
          break;
        case 'h':
          e.preventDefault();
          this.setTool(AnnotationToolType.HIGHLIGHT);
          break;
        case 'r':
          e.preventDefault();
          this.setTool(AnnotationToolType.REDACTION);
          break;
        case 't':
          e.preventDefault();
          this.setTool(AnnotationToolType.TEXT);
          break;
        case 'delete':
        case 'backspace':
          e.preventDefault();
          if (this.state.selectedAnnotationId) {
            this.deleteAnnotation(this.state.selectedAnnotationId);
          }
          break;
        case 'escape':
          e.preventDefault();
          this.close();
          break;
      }
    }

    // Ctrl shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'z':
          e.preventDefault();
          this.undo();
          break;
        case 's':
          e.preventDefault();
          this.save({ bakeAnnotations: true });
          break;
      }
    }
  }

  /**
   * Handle tool selection
   * @private
   * @param {string} tool - Selected tool
   */
  _onToolSelect(tool) {
    this.setTool(tool);
  }

  /**
   * Handle color selection
   * @private
   * @param {string} color - Selected color key
   */
  _onColorSelect(color) {
    this.setColor(color);
  }

  /**
   * Handle annotation click
   * @private
   * @param {string} annotationId - Clicked annotation ID
   */
  _onAnnotationClick(annotationId) {
    if (this.state.currentTool === AnnotationToolType.SELECT) {
      this._selectAnnotation(annotationId);
    }
  }

  /**
   * Handle toolbar action
   * @private
   * @param {string} action - Action name
   */
  async _handleAction(action) {
    switch (action) {
      case 'undo':
        this.undo();
        break;
      case 'clear':
        if (this.state.annotations.length > 0) {
          this.clearAnnotations();
        }
        break;
      case 'save':
        await this.save({ bakeAnnotations: true, includeMetadata: true });
        break;
      case 'export':
        this._exportAnnotations();
        break;
      case 'close':
        this.close();
        break;
    }
  }

  // ===========================================================================
  // Private Methods - Drawing and Annotations
  // ===========================================================================

  /**
   * Load image into the canvas
   * @private
   * @param {string} imageData - Base64 image data
   */
  _loadImage(imageData) {
    return new Promise((resolve, reject) => {
      this.elements.image.onload = () => {
        this.state.imageWidth = this.elements.image.naturalWidth;
        this.state.imageHeight = this.elements.image.naturalHeight;

        // Set SVG viewBox
        this.elements.svg.setAttribute('viewBox', `0 0 ${this.state.imageWidth} ${this.state.imageHeight}`);
        this.elements.svg.style.width = this.elements.image.offsetWidth + 'px';
        this.elements.svg.style.height = this.elements.image.offsetHeight + 'px';

        resolve();
      };
      this.elements.image.onerror = reject;
      this.elements.image.src = imageData;
    });
  }

  /**
   * Get mouse position relative to SVG
   * @private
   * @param {MouseEvent} e - Mouse event
   * @returns {Object} Point with x, y coordinates
   */
  _getMousePosition(e) {
    const svgRect = this.elements.svg.getBoundingClientRect();
    const scaleX = this.state.imageWidth / svgRect.width;
    const scaleY = this.state.imageHeight / svgRect.height;

    return {
      x: (e.clientX - svgRect.left) * scaleX,
      y: (e.clientY - svgRect.top) * scaleY
    };
  }

  /**
   * Calculate rectangle from two points
   * @private
   * @param {Object} start - Start point
   * @param {Object} end - End point
   * @returns {Object} Rectangle with x, y, width, height
   */
  _calculateRect(start, end) {
    return {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y)
    };
  }

  /**
   * Create preview element while drawing
   * @private
   * @param {Object} point - Starting point
   */
  _createPreviewElement(point) {
    const preview = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    preview.setAttribute('id', 'annotation-preview');
    preview.setAttribute('x', point.x);
    preview.setAttribute('y', point.y);
    preview.setAttribute('width', 0);
    preview.setAttribute('height', 0);

    if (this.state.currentTool === AnnotationToolType.HIGHLIGHT) {
      const color = HighlightColors[this.state.currentColor];
      preview.setAttribute('fill', color.fill);
      preview.setAttribute('stroke', color.stroke);
      preview.setAttribute('stroke-width', '2');
    } else if (this.state.currentTool === AnnotationToolType.REDACTION) {
      preview.setAttribute('fill', '#000000');
      preview.setAttribute('stroke', '#333333');
      preview.setAttribute('stroke-width', '1');
    }

    preview.setAttribute('stroke-dasharray', '5,5');
    this.elements.svg.appendChild(preview);
  }

  /**
   * Update preview element during drawing
   * @private
   * @param {Object} currentPoint - Current mouse position
   */
  _updatePreviewElement(currentPoint) {
    const preview = this.elements.svg.getElementById('annotation-preview');
    if (!preview) return;

    const rect = this._calculateRect(this.state.drawStartPoint, currentPoint);
    preview.setAttribute('x', rect.x);
    preview.setAttribute('y', rect.y);
    preview.setAttribute('width', rect.width);
    preview.setAttribute('height', rect.height);
  }

  /**
   * Remove preview element
   * @private
   */
  _removePreviewElement() {
    const preview = this.elements.svg.getElementById('annotation-preview');
    if (preview) {
      preview.remove();
    }
  }

  /**
   * Create an annotation
   * @private
   * @param {Object} rect - Rectangle dimensions
   * @param {string} text - Optional text for text annotations
   */
  _createAnnotation(rect, text = null) {
    const annotation = {
      id: this._generateId('ann'),
      type: this._getCurrentAnnotationType(),
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      color: this.state.currentTool === AnnotationToolType.HIGHLIGHT ? this.state.currentColor : null,
      text: text,
      style: this.state.currentTool === AnnotationToolType.TEXT ? this.state.textStyle : null,
      createdAt: new Date().toISOString(),
      createdBy: this.config.examinerID,
      notes: null
    };

    this.state.annotations.push(annotation);
    this.stats.annotationsCreated++;
    this._renderAnnotations();
    this._updateStatus();

    this._recordCustodyEvent('annotation_created', {
      notes: 'Annotation created: ' + annotation.type + ' at (' + annotation.x + ', ' + annotation.y + ')'
    });

    return annotation;
  }

  /**
   * Get current annotation type based on selected tool
   * @private
   * @returns {string} Annotation type
   */
  _getCurrentAnnotationType() {
    switch (this.state.currentTool) {
      case AnnotationToolType.HIGHLIGHT:
        return AnnotationType.HIGHLIGHT;
      case AnnotationToolType.REDACTION:
        return AnnotationType.REDACTION;
      case AnnotationToolType.TEXT:
        return AnnotationType.TEXT;
      default:
        return AnnotationType.RECTANGLE;
    }
  }

  /**
   * Render all annotations to SVG
   * @private
   */
  _renderAnnotations() {
    this._clearSVG();

    for (const annotation of this.state.annotations) {
      const element = this._createAnnotationElement(annotation);
      if (element) {
        this.elements.svg.appendChild(element);
      }
    }
  }

  /**
   * Create SVG element for an annotation
   * @private
   * @param {Object} annotation - Annotation data
   * @returns {SVGElement} SVG element
   */
  _createAnnotationElement(annotation) {
    const isSelected = annotation.id === this.state.selectedAnnotationId;

    if (annotation.type === AnnotationType.TEXT) {
      return this._createTextAnnotationElement(annotation, isSelected);
    }

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('data-id', annotation.id);
    rect.setAttribute('class', 'basset-annotation-element' + (isSelected ? ' selected' : ''));
    rect.setAttribute('x', annotation.x);
    rect.setAttribute('y', annotation.y);
    rect.setAttribute('width', annotation.width);
    rect.setAttribute('height', annotation.height);

    if (annotation.type === AnnotationType.HIGHLIGHT) {
      const color = HighlightColors[annotation.color] || HighlightColors.YELLOW;
      rect.setAttribute('fill', color.fill);
      rect.setAttribute('stroke', color.stroke);
      rect.setAttribute('stroke-width', isSelected ? '3' : '2');
    } else if (annotation.type === AnnotationType.REDACTION) {
      rect.setAttribute('fill', '#000000');
      rect.setAttribute('stroke', isSelected ? '#ff0000' : '#000000');
      rect.setAttribute('stroke-width', isSelected ? '2' : '0');
    }

    // Add click handler
    rect.addEventListener('click', (e) => {
      e.stopPropagation();
      this._onAnnotationClick(annotation.id);
    });

    return rect;
  }

  /**
   * Create text annotation SVG element
   * @private
   * @param {Object} annotation - Annotation data
   * @param {boolean} isSelected - Whether annotation is selected
   * @returns {SVGElement} SVG group element
   */
  _createTextAnnotationElement(annotation, isSelected) {
    const style = TextStyles[annotation.style] || TextStyles.LABEL;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('data-id', annotation.id);
    group.setAttribute('class', 'basset-annotation-element' + (isSelected ? ' selected' : ''));

    // Background rectangle
    if (style.background !== 'transparent') {
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('x', annotation.x - style.padding);
      bg.setAttribute('y', annotation.y - style.fontSize - style.padding);
      bg.setAttribute('rx', '4');
      bg.setAttribute('ry', '4');
      bg.setAttribute('fill', style.background);
      bg.setAttribute('stroke', isSelected ? '#4a90d9' : 'transparent');
      bg.setAttribute('stroke-width', '2');
      group.appendChild(bg);
    }

    // Text element
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', annotation.x);
    text.setAttribute('y', annotation.y);
    text.setAttribute('fill', style.fill);
    text.setAttribute('font-size', style.fontSize);
    text.setAttribute('font-family', style.fontFamily);
    text.textContent = annotation.text || '';
    group.appendChild(text);

    // Update background size after measuring text
    setTimeout(() => {
      if (style.background !== 'transparent') {
        const bbox = text.getBBox();
        const bg = group.querySelector('rect');
        if (bg) {
          bg.setAttribute('width', bbox.width + style.padding * 2);
          bg.setAttribute('height', bbox.height + style.padding * 2);
        }
      }
    }, 0);

    // Add click handler
    group.addEventListener('click', (e) => {
      e.stopPropagation();
      this._onAnnotationClick(annotation.id);
    });

    return group;
  }

  /**
   * Clear all elements from SVG
   * @private
   */
  _clearSVG() {
    while (this.elements.svg.firstChild) {
      this.elements.svg.removeChild(this.elements.svg.firstChild);
    }
  }

  /**
   * Select an annotation
   * @private
   * @param {string} annotationId - Annotation ID to select
   */
  _selectAnnotation(annotationId) {
    this.state.selectedAnnotationId = annotationId;
    this._renderAnnotations();
  }

  /**
   * Deselect current annotation
   * @private
   */
  _deselectAnnotation() {
    this.state.selectedAnnotationId = null;
    this._renderAnnotations();
  }

  /**
   * Get annotation at a specific point
   * @private
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Object|null} Annotation at point or null
   */
  _getAnnotationAtPoint(x, y) {
    // Check in reverse order (top elements first)
    for (let i = this.state.annotations.length - 1; i >= 0; i--) {
      const ann = this.state.annotations[i];
      if (x >= ann.x && x <= ann.x + ann.width &&
          y >= ann.y && y <= ann.y + ann.height) {
        return ann;
      }
    }
    return null;
  }

  /**
   * Show text input modal
   * @private
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  _showTextModal(x, y) {
    // Remove existing modal
    if (this.elements.textModal) {
      this.elements.textModal.remove();
    }

    const modal = document.createElement('div');
    modal.className = 'basset-annotation-text-modal';

    // Position modal near click point
    const svgRect = this.elements.svg.getBoundingClientRect();
    const scaleX = svgRect.width / this.state.imageWidth;
    const scaleY = svgRect.height / this.state.imageHeight;

    modal.style.left = (svgRect.left + x * scaleX) + 'px';
    modal.style.top = (svgRect.top + y * scaleY) + 'px';

    modal.innerHTML = `
      <input type="text" placeholder="Enter annotation text..." autofocus>
      <div class="basset-annotation-text-modal-actions">
        <button class="basset-annotation-action-btn" data-action="cancel">Cancel</button>
        <button class="basset-annotation-action-btn primary" data-action="add">Add</button>
      </div>
    `;

    const input = modal.querySelector('input');
    const addBtn = modal.querySelector('[data-action="add"]');
    const cancelBtn = modal.querySelector('[data-action="cancel"]');

    const addText = () => {
      const text = input.value.trim();
      if (text) {
        this._createAnnotation({ x, y, width: 100, height: 30 }, text);
      }
      modal.remove();
      this.elements.textModal = null;
    };

    const cancel = () => {
      modal.remove();
      this.elements.textModal = null;
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addText();
      if (e.key === 'Escape') cancel();
    });

    addBtn.addEventListener('click', addText);
    cancelBtn.addEventListener('click', cancel);

    this.elements.shadowRoot.appendChild(modal);
    this.elements.textModal = modal;
    input.focus();
  }

  // ===========================================================================
  // Private Methods - UI Updates
  // ===========================================================================

  /**
   * Update toolbar tool selection
   * @private
   */
  _updateToolbarSelection() {
    if (!this.elements.toolbar) return;

    this.elements.toolbar.querySelectorAll('[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === this.state.currentTool);
    });
  }

  /**
   * Update toolbar color selection
   * @private
   */
  _updateColorSelection() {
    if (!this.elements.toolbar) return;

    this.elements.toolbar.querySelectorAll('[data-color]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color === this.state.currentColor);
    });
  }

  /**
   * Update cursor based on current tool
   * @private
   */
  _updateCursor() {
    if (!this.elements.svg) return;

    this.elements.svg.classList.remove('tool-select', 'tool-text');

    if (this.state.currentTool === AnnotationToolType.SELECT) {
      this.elements.svg.classList.add('tool-select');
    } else if (this.state.currentTool === AnnotationToolType.TEXT) {
      this.elements.svg.classList.add('tool-text');
    }
  }

  /**
   * Update status bar
   * @private
   */
  _updateStatus() {
    if (!this.elements.bottomBar) return;

    const countEl = this.elements.bottomBar.querySelector('.basset-annotation-status-count');
    if (countEl) {
      countEl.textContent = this.state.annotations.length;
    }
  }

  // ===========================================================================
  // Private Methods - Export and Integration
  // ===========================================================================

  /**
   * Bake annotations into the image
   * @private
   * @param {string} format - Output format ('png' or 'jpeg')
   * @returns {Promise<string>} Base64 encoded image with annotations
   */
  async _bakeAnnotationsToImage(format = 'png') {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = this.state.imageWidth;
      canvas.height = this.state.imageHeight;
      const ctx = canvas.getContext('2d');

      // Draw original image
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);

        // Draw annotations
        for (const annotation of this.state.annotations) {
          this._drawAnnotationToCanvas(ctx, annotation);
        }

        // Export
        const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
        const quality = format === 'jpeg' ? 0.92 : undefined;
        resolve(canvas.toDataURL(mimeType, quality));
      };
      img.onerror = reject;
      img.src = this.state.originalImageData;
    });
  }

  /**
   * Draw annotation to canvas context
   * @private
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} annotation - Annotation data
   */
  _drawAnnotationToCanvas(ctx, annotation) {
    ctx.save();

    if (annotation.type === AnnotationType.HIGHLIGHT) {
      const color = HighlightColors[annotation.color] || HighlightColors.YELLOW;
      ctx.fillStyle = color.fill;
      ctx.strokeStyle = color.stroke;
      ctx.lineWidth = 2;
      ctx.fillRect(annotation.x, annotation.y, annotation.width, annotation.height);
      ctx.strokeRect(annotation.x, annotation.y, annotation.width, annotation.height);
    } else if (annotation.type === AnnotationType.REDACTION) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(annotation.x, annotation.y, annotation.width, annotation.height);
    } else if (annotation.type === AnnotationType.TEXT) {
      const style = TextStyles[annotation.style] || TextStyles.LABEL;

      // Draw background
      if (style.background !== 'transparent') {
        ctx.fillStyle = style.background;
        const textMetrics = ctx.measureText(annotation.text || '');
        ctx.fillRect(
          annotation.x - style.padding,
          annotation.y - style.fontSize - style.padding,
          textMetrics.width + style.padding * 2,
          style.fontSize + style.padding * 2
        );
      }

      // Draw text
      ctx.fillStyle = style.fill;
      ctx.font = style.fontSize + 'px ' + style.fontFamily;
      ctx.fillText(annotation.text || '', annotation.x, annotation.y);
    }

    ctx.restore();
  }

  /**
   * Generate annotation metadata
   * @private
   * @returns {Object} Metadata object
   */
  _generateMetadata() {
    return {
      version: '1.0.0',
      standard: 'NIST-DF',
      evidenceId: this.state.evidenceId,
      caseNumber: this.config.caseNumber,
      examinerID: this.config.examinerID,
      createdAt: new Date().toISOString(),
      originalImage: {
        width: this.state.imageWidth,
        height: this.state.imageHeight,
        hash: this.state.originalHash
      },
      annotations: this.state.annotations.map(ann => ({
        id: ann.id,
        type: ann.type,
        geometry: {
          x: ann.x,
          y: ann.y,
          width: ann.width,
          height: ann.height
        },
        properties: {
          color: ann.color,
          text: ann.text,
          style: ann.style
        },
        createdAt: ann.createdAt,
        createdBy: ann.createdBy,
        notes: ann.notes
      })),
      summary: {
        totalAnnotations: this.state.annotations.length,
        byType: this._getAnnotationsByType(),
        redactionCount: this.state.annotations.filter(a => a.type === AnnotationType.REDACTION).length
      },
      sessionStats: {
        created: this.stats.annotationsCreated,
        modified: this.stats.annotationsModified,
        deleted: this.stats.annotationsDeleted,
        sessionDuration: Date.now() - this.stats.sessionStartTime
      }
    };
  }

  /**
   * Export annotations to file
   * @private
   */
  async _exportAnnotations() {
    const result = await this.save({ bakeAnnotations: true, includeMetadata: true });

    if (!result.success) {
      this._log('error', 'Export failed: ' + result.error);
      return;
    }

    // Create download for metadata
    const metadataBlob = new Blob([JSON.stringify(result.metadata, null, 2)], { type: 'application/json' });
    const metadataUrl = URL.createObjectURL(metadataBlob);
    const metadataLink = document.createElement('a');
    metadataLink.href = metadataUrl;
    metadataLink.download = 'annotations_' + this.state.evidenceId + '_metadata.json';
    metadataLink.click();
    URL.revokeObjectURL(metadataUrl);

    // Create download for baked image
    if (result.bakedImage) {
      const imageLink = document.createElement('a');
      imageLink.href = result.bakedImage;
      imageLink.download = 'annotations_' + this.state.evidenceId + '_annotated.png';
      imageLink.click();
    }

    this._log('info', 'Annotations exported');
  }

  /**
   * Get annotations grouped by type
   * @private
   * @returns {Object} Count by type
   */
  _getAnnotationsByType() {
    const byType = {};
    for (const ann of this.state.annotations) {
      byType[ann.type] = (byType[ann.type] || 0) + 1;
    }
    return byType;
  }

  /**
   * Get default purpose description for annotation type
   * @private
   * @param {string} type - Annotation type
   * @returns {string} Purpose description
   */
  _getAnnotationPurpose(type) {
    switch (type) {
      case AnnotationType.HIGHLIGHT:
        return 'Highlight area of interest for review';
      case AnnotationType.REDACTION:
        return 'Redact sensitive or personally identifiable information';
      case AnnotationType.TEXT:
        return 'Add explanatory text or label';
      default:
        return 'Mark area for reference';
    }
  }

  // ===========================================================================
  // Private Methods - Chain of Custody Integration
  // ===========================================================================

  /**
   * Record an event in the chain of custody
   * @private
   * @param {string} action - Action type
   * @param {Object} details - Action details
   */
  _recordCustodyEvent(action, details = {}) {
    if (!this.config.chainOfCustody) return;

    try {
      this.config.chainOfCustody.recordAccess(action, {
        userID: this.config.examinerID,
        notes: details.notes,
        hashBefore: details.hashBefore || this.state.originalHash,
        hashAfter: details.hashAfter || this.state.originalHash,
        additionalData: {
          evidenceId: this.state.evidenceId,
          annotationCount: this.state.annotations.length
        }
      });
    } catch (error) {
      this._log('warn', 'Failed to record custody event: ' + error.message);
    }
  }

  // ===========================================================================
  // Private Methods - Utilities
  // ===========================================================================

  /**
   * Generate a unique ID
   * @private
   * @param {string} prefix - ID prefix
   * @returns {string} Generated ID
   */
  _generateId(prefix) {
    this._annotationIdCounter++;
    return prefix + '_' + Date.now().toString(36) + '_' + this._annotationIdCounter.toString(36);
  }

  /**
   * Generate SHA-256 hash of data
   * @private
   * @param {string} data - Data to hash
   * @returns {Promise<string>} Hex hash string
   */
  async _generateHash(data) {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback simple hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'fallback_' + Math.abs(hash).toString(16).padStart(16, '0');
  }

  /**
   * Log a message
   * @private
   * @param {string} level - Log level
   * @param {string} message - Log message
   */
  _log(level, message) {
    if (this.config.logger && this.config.logger[level]) {
      this.config.logger[level](message);
    } else if (typeof console !== 'undefined' && console[level]) {
      console[level]('[AnnotationTools] ' + message);
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an AnnotationTools instance
 * @param {Object} options - Configuration options
 * @returns {AnnotationTools} New instance
 */
function createAnnotationTools(options = {}) {
  return new AnnotationTools(options);
}

// =============================================================================
// Global Instance
// =============================================================================

let annotationToolsInstance = null;

/**
 * Get or create the global AnnotationTools instance
 * @param {Object} options - Configuration options
 * @returns {AnnotationTools} Global instance
 */
function getAnnotationTools(options = {}) {
  if (!annotationToolsInstance) {
    annotationToolsInstance = new AnnotationTools(options);
  }
  return annotationToolsInstance;
}

// =============================================================================
// Exports
// =============================================================================

if (typeof globalThis !== 'undefined') {
  globalThis.AnnotationToolType = AnnotationToolType;
  globalThis.AnnotationType = AnnotationType;
  globalThis.HighlightColors = HighlightColors;
  globalThis.TextStyles = TextStyles;
  globalThis.AnnotationTools = AnnotationTools;
  globalThis.createAnnotationTools = createAnnotationTools;
  globalThis.getAnnotationTools = getAnnotationTools;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AnnotationToolType,
    AnnotationType,
    HighlightColors,
    TextStyles,
    AnnotationTools,
    createAnnotationTools,
    getAnnotationTools
  };
}
