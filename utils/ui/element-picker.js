/**
 * Basset Hound Browser Automation - Element Picker
 * Phase 8.4: Element Picker for Manual Selection
 *
 * Provides visual element picker for manual OSINT data selection:
 * - Hover highlighting with tooltip
 * - Click to select mode
 * - Multi-element selection
 * - Text selection support
 * - Auto-detection of selected content
 */

// =============================================================================
// Element Picker Styles
// =============================================================================

/**
 * CSS styles for element picker
 */
const ELEMENT_PICKER_STYLES = `
  /* Highlight overlay */
  .basset-picker-highlight {
    position: fixed;
    pointer-events: none;
    z-index: 9999997;
    border: 2px solid #4a90d9;
    background: rgba(74, 144, 217, 0.1);
    transition: all 0.1s ease;
    border-radius: 2px;
  }

  /* Selected element indicator */
  .basset-picker-selected {
    position: fixed;
    pointer-events: none;
    z-index: 9999996;
    border: 2px solid #4ade80;
    background: rgba(74, 222, 128, 0.15);
    border-radius: 2px;
  }

  .basset-picker-selected::before {
    content: '✓';
    position: absolute;
    top: -12px;
    left: -2px;
    background: #4ade80;
    color: white;
    font-size: 10px;
    padding: 2px 4px;
    border-radius: 4px;
  }

  /* Tooltip */
  .basset-picker-tooltip {
    position: fixed;
    z-index: 9999998;
    background: #1e1e1e;
    color: #e0e0e0;
    padding: 8px 12px;
    border-radius: 6px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 12px;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    max-width: 300px;
    word-break: break-all;
  }

  .basset-picker-tooltip-tag {
    color: #4a90d9;
    font-family: 'SF Mono', Monaco, monospace;
    font-weight: 600;
  }

  .basset-picker-tooltip-text {
    color: #888;
    margin-top: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .basset-picker-tooltip-hint {
    color: #666;
    margin-top: 6px;
    font-size: 11px;
    border-top: 1px solid #333;
    padding-top: 6px;
  }

  /* Control bar */
  .basset-picker-controls {
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999999;
    display: flex;
    align-items: center;
    gap: 10px;
    background: #1e1e1e;
    padding: 10px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #e0e0e0;
  }

  .basset-picker-controls-title {
    font-weight: 600;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .basset-picker-controls-count {
    background: #333;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    color: #4a90d9;
  }

  .basset-picker-btn {
    background: #333;
    border: none;
    color: #e0e0e0;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .basset-picker-btn:hover {
    background: #444;
  }

  .basset-picker-btn-primary {
    background: linear-gradient(135deg, #4a90d9 0%, #357abd 100%);
    color: white;
    font-weight: 600;
  }

  .basset-picker-btn-primary:hover {
    opacity: 0.9;
  }

  .basset-picker-btn-danger {
    background: #4a2020;
    color: #f87171;
  }

  .basset-picker-btn-danger:hover {
    background: #5a2828;
  }

  /* Instructions overlay */
  .basset-picker-instructions {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999999;
    background: #1e1e1e;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    color: #888;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  }

  .basset-picker-instructions kbd {
    background: #333;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 11px;
    color: #e0e0e0;
  }

  /* Crosshair cursor */
  .basset-picker-active {
    cursor: crosshair !important;
  }

  .basset-picker-active * {
    cursor: crosshair !important;
  }
`;

// =============================================================================
// ElementPicker Class
// =============================================================================

/**
 * Element Picker for manual OSINT data selection
 */
class ElementPicker {
  /**
   * Create a new ElementPicker
   * @param {Object} options - Configuration options
   * @param {Object} options.fieldDetector - OSINTFieldDetector instance
   * @param {Object} options.verifier - DataVerifier instance
   * @param {Object} options.provenanceCapture - ProvenanceCapture instance
   * @param {Function} options.onSelect - Callback when elements are selected
   * @param {Function} options.onComplete - Callback when picking is complete
   * @param {boolean} options.multiSelect - Allow multiple selections (default: true)
   * @param {Object} options.logger - Logger instance
   */
  constructor(options = {}) {
    this.config = {
      fieldDetector: options.fieldDetector || null,
      verifier: options.verifier || null,
      provenanceCapture: options.provenanceCapture || null,
      onSelect: options.onSelect || null,
      onComplete: options.onComplete || null,
      multiSelect: options.multiSelect !== false,
      logger: options.logger || null
    };

    this.state = {
      isActive: false,
      hoveredElement: null,
      selectedElements: [],
      selectedData: []
    };

    this.elements = {
      highlight: null,
      tooltip: null,
      controls: null,
      instructions: null,
      selectedMarkers: []
    };

    this._boundHandlers = {
      onMouseMove: this._onMouseMove.bind(this),
      onMouseOver: this._onMouseOver.bind(this),
      onMouseOut: this._onMouseOut.bind(this),
      onClick: this._onClick.bind(this),
      onKeyDown: this._onKeyDown.bind(this),
      onTextSelect: this._onTextSelect.bind(this)
    };

    this._injectStyles();
  }

  /**
   * Start element picking mode
   */
  start() {
    if (this.state.isActive) return;

    this.state.isActive = true;
    this.state.selectedElements = [];
    this.state.selectedData = [];

    this._createUI();
    this._attachEventListeners();

    document.body.classList.add('basset-picker-active');
  }

  /**
   * Stop element picking mode
   */
  stop() {
    if (!this.state.isActive) return;

    this.state.isActive = false;
    this.state.hoveredElement = null;

    this._removeEventListeners();
    this._destroyUI();

    document.body.classList.remove('basset-picker-active');
  }

  /**
   * Get selected data
   * @returns {Array} Selected OSINT data
   */
  getSelectedData() {
    return [...this.state.selectedData];
  }

  /**
   * Complete selection and return data
   * @returns {Object} Selection result
   */
  complete() {
    const result = {
      success: true,
      selections: this.state.selectedData.map(data => ({
        ...data,
        provenance: this.config.provenanceCapture?.captureForElement(
          data.element,
          { captureMethod: 'element_picker' }
        )
      }))
    };

    this.stop();

    if (this.config.onComplete) {
      this.config.onComplete(result);
    }

    return result;
  }

  /**
   * Clear all selections
   */
  clearSelections() {
    this.state.selectedElements = [];
    this.state.selectedData = [];
    this._clearSelectedMarkers();
    this._updateControlsCount();
  }

  // ===========================================================================
  // Private Methods - UI Creation
  // ===========================================================================

  /**
   * Inject CSS styles
   * @private
   */
  _injectStyles() {
    if (document.getElementById('basset-picker-styles')) return;

    const style = document.createElement('style');
    style.id = 'basset-picker-styles';
    style.textContent = ELEMENT_PICKER_STYLES;
    document.head.appendChild(style);
  }

  /**
   * Create UI elements
   * @private
   */
  _createUI() {
    // Highlight overlay
    this.elements.highlight = document.createElement('div');
    this.elements.highlight.className = 'basset-picker-highlight';
    this.elements.highlight.style.display = 'none';
    document.body.appendChild(this.elements.highlight);

    // Tooltip
    this.elements.tooltip = document.createElement('div');
    this.elements.tooltip.className = 'basset-picker-tooltip';
    this.elements.tooltip.style.display = 'none';
    document.body.appendChild(this.elements.tooltip);

    // Control bar
    this.elements.controls = document.createElement('div');
    this.elements.controls.className = 'basset-picker-controls';
    this.elements.controls.innerHTML = `
      <span class="basset-picker-controls-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 2v4m0 16v-4M2 12h4m16 0h-4"/>
        </svg>
        Element Picker
        <span class="basset-picker-controls-count">0</span>
      </span>
      <button class="basset-picker-btn" data-action="clear">Clear</button>
      <button class="basset-picker-btn basset-picker-btn-primary" data-action="done">Done</button>
      <button class="basset-picker-btn basset-picker-btn-danger" data-action="cancel">Cancel</button>
    `;
    this.elements.controls.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action === 'clear') this.clearSelections();
      else if (action === 'done') this.complete();
      else if (action === 'cancel') this.stop();
    });
    document.body.appendChild(this.elements.controls);

    // Instructions
    this.elements.instructions = document.createElement('div');
    this.elements.instructions.className = 'basset-picker-instructions';
    this.elements.instructions.innerHTML = `
      <kbd>Click</kbd> to select element &nbsp;|&nbsp;
      <kbd>Shift+Click</kbd> to add to selection &nbsp;|&nbsp;
      <kbd>Esc</kbd> to cancel &nbsp;|&nbsp;
      <kbd>Enter</kbd> when done
    `;
    document.body.appendChild(this.elements.instructions);
  }

  /**
   * Destroy UI elements
   * @private
   */
  _destroyUI() {
    if (this.elements.highlight) {
      this.elements.highlight.remove();
      this.elements.highlight = null;
    }
    if (this.elements.tooltip) {
      this.elements.tooltip.remove();
      this.elements.tooltip = null;
    }
    if (this.elements.controls) {
      this.elements.controls.remove();
      this.elements.controls = null;
    }
    if (this.elements.instructions) {
      this.elements.instructions.remove();
      this.elements.instructions = null;
    }
    this._clearSelectedMarkers();
  }

  /**
   * Clear selected markers
   * @private
   */
  _clearSelectedMarkers() {
    for (const marker of this.elements.selectedMarkers) {
      marker.remove();
    }
    this.elements.selectedMarkers = [];
  }

  // ===========================================================================
  // Private Methods - Event Handling
  // ===========================================================================

  /**
   * Attach event listeners
   * @private
   */
  _attachEventListeners() {
    document.addEventListener('mousemove', this._boundHandlers.onMouseMove);
    document.addEventListener('mouseover', this._boundHandlers.onMouseOver);
    document.addEventListener('mouseout', this._boundHandlers.onMouseOut);
    document.addEventListener('click', this._boundHandlers.onClick, true);
    document.addEventListener('keydown', this._boundHandlers.onKeyDown);
    document.addEventListener('selectionchange', this._boundHandlers.onTextSelect);
  }

  /**
   * Remove event listeners
   * @private
   */
  _removeEventListeners() {
    document.removeEventListener('mousemove', this._boundHandlers.onMouseMove);
    document.removeEventListener('mouseover', this._boundHandlers.onMouseOver);
    document.removeEventListener('mouseout', this._boundHandlers.onMouseOut);
    document.removeEventListener('click', this._boundHandlers.onClick, true);
    document.removeEventListener('keydown', this._boundHandlers.onKeyDown);
    document.removeEventListener('selectionchange', this._boundHandlers.onTextSelect);
  }

  /**
   * Handle mouse move
   * @private
   */
  _onMouseMove(e) {
    if (!this.state.isActive) return;

    // Update tooltip position
    if (this.elements.tooltip && this.elements.tooltip.style.display !== 'none') {
      const x = e.clientX + 15;
      const y = e.clientY + 15;
      this.elements.tooltip.style.left = `${x}px`;
      this.elements.tooltip.style.top = `${y}px`;
    }
  }

  /**
   * Handle mouse over
   * @private
   */
  _onMouseOver(e) {
    if (!this.state.isActive) return;

    const target = e.target;

    // Ignore our own UI elements
    if (this._isPickerElement(target)) return;

    this.state.hoveredElement = target;
    this._showHighlight(target);
    this._showTooltip(target);
  }

  /**
   * Handle mouse out
   * @private
   */
  _onMouseOut(e) {
    if (!this.state.isActive) return;

    const target = e.target;

    if (target === this.state.hoveredElement) {
      this.state.hoveredElement = null;
      this._hideHighlight();
      this._hideTooltip();
    }
  }

  /**
   * Handle click
   * @private
   */
  _onClick(e) {
    if (!this.state.isActive) return;

    const target = e.target;

    // Ignore our own UI elements
    if (this._isPickerElement(target)) return;

    e.preventDefault();
    e.stopPropagation();

    // Single select mode - clear previous selections
    if (!this.config.multiSelect && !e.shiftKey) {
      this.clearSelections();
    }

    // Check if already selected
    const alreadySelected = this.state.selectedElements.includes(target);

    if (alreadySelected && e.shiftKey) {
      // Deselect
      const index = this.state.selectedElements.indexOf(target);
      this.state.selectedElements.splice(index, 1);
      this.state.selectedData.splice(index, 1);
      this._removeSelectedMarker(index);
    } else if (!alreadySelected) {
      // Select
      this._selectElement(target);
    }

    this._updateControlsCount();
  }

  /**
   * Handle keyboard events
   * @private
   */
  _onKeyDown(e) {
    if (!this.state.isActive) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      this.stop();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.complete();
    }
  }

  /**
   * Handle text selection
   * @private
   */
  _onTextSelect() {
    if (!this.state.isActive) return;

    const selection = window.getSelection();
    if (selection.isCollapsed || selection.toString().trim().length === 0) return;

    const text = selection.toString().trim();
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;

    // Auto-detect OSINT data in selection
    if (this.config.fieldDetector) {
      const findings = this.config.fieldDetector.detectAll(text);
      if (findings.length > 0) {
        this._showTooltipWithFindings(element, findings);
      }
    }
  }

  // ===========================================================================
  // Private Methods - Selection
  // ===========================================================================

  /**
   * Select an element
   * @private
   */
  _selectElement(element) {
    // Get element text content
    const text = element.innerText || element.textContent || '';

    // Detect OSINT data
    let findings = [];
    if (this.config.fieldDetector) {
      findings = this.config.fieldDetector.detectAll(text);
    }

    const selectionData = {
      element,
      text: text.trim().slice(0, 500),
      tagName: element.tagName,
      selector: this._generateSelector(element),
      findings,
      timestamp: Date.now()
    };

    this.state.selectedElements.push(element);
    this.state.selectedData.push(selectionData);

    // Add visual marker
    this._addSelectedMarker(element);

    // Notify callback
    if (this.config.onSelect) {
      this.config.onSelect(selectionData);
    }
  }

  /**
   * Add selected marker
   * @private
   */
  _addSelectedMarker(element) {
    const marker = document.createElement('div');
    marker.className = 'basset-picker-selected';

    const rect = element.getBoundingClientRect();
    marker.style.top = `${rect.top}px`;
    marker.style.left = `${rect.left}px`;
    marker.style.width = `${rect.width}px`;
    marker.style.height = `${rect.height}px`;

    document.body.appendChild(marker);
    this.elements.selectedMarkers.push(marker);
  }

  /**
   * Remove selected marker
   * @private
   */
  _removeSelectedMarker(index) {
    const marker = this.elements.selectedMarkers[index];
    if (marker) {
      marker.remove();
      this.elements.selectedMarkers.splice(index, 1);
    }
  }

  // ===========================================================================
  // Private Methods - UI Updates
  // ===========================================================================

  /**
   * Show highlight overlay
   * @private
   */
  _showHighlight(element) {
    if (!this.elements.highlight) return;

    const rect = element.getBoundingClientRect();
    this.elements.highlight.style.display = 'block';
    this.elements.highlight.style.top = `${rect.top}px`;
    this.elements.highlight.style.left = `${rect.left}px`;
    this.elements.highlight.style.width = `${rect.width}px`;
    this.elements.highlight.style.height = `${rect.height}px`;
  }

  /**
   * Hide highlight overlay
   * @private
   */
  _hideHighlight() {
    if (this.elements.highlight) {
      this.elements.highlight.style.display = 'none';
    }
  }

  /**
   * Show tooltip for element
   * @private
   */
  _showTooltip(element) {
    if (!this.elements.tooltip) return;

    const tagInfo = `<${element.tagName.toLowerCase()}${element.id ? ` id="${element.id}"` : ''}${element.className ? ` class="${element.className.split(' ').slice(0, 2).join(' ')}"` : ''}>`;
    const text = (element.innerText || element.textContent || '').trim().slice(0, 100);

    // Detect OSINT data
    let findingsHtml = '';
    if (this.config.fieldDetector) {
      const findings = this.config.fieldDetector.detectAll(text);
      if (findings.length > 0) {
        findingsHtml = `
          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #333;">
            <span style="color: #4ade80;">✓ Found ${findings.length} OSINT data</span>
          </div>
        `;
      }
    }

    this.elements.tooltip.innerHTML = `
      <div class="basset-picker-tooltip-tag">${this._escapeHtml(tagInfo)}</div>
      ${text ? `<div class="basset-picker-tooltip-text">${this._escapeHtml(text)}...</div>` : ''}
      ${findingsHtml}
      <div class="basset-picker-tooltip-hint">Click to select</div>
    `;
    this.elements.tooltip.style.display = 'block';
  }

  /**
   * Show tooltip with findings
   * @private
   */
  _showTooltipWithFindings(element, findings) {
    if (!this.elements.tooltip) return;

    const findingsHtml = findings.map(f => `
      <div style="margin-top: 4px;">
        <span style="color: #4a90d9;">${f.identifierType}</span>:
        <span style="color: #fff;">${this._escapeHtml(f.value)}</span>
      </div>
    `).join('');

    this.elements.tooltip.innerHTML = `
      <div style="color: #4ade80; font-weight: 600;">Detected OSINT Data</div>
      ${findingsHtml}
      <div class="basset-picker-tooltip-hint">Click to add selection</div>
    `;
    this.elements.tooltip.style.display = 'block';
  }

  /**
   * Hide tooltip
   * @private
   */
  _hideTooltip() {
    if (this.elements.tooltip) {
      this.elements.tooltip.style.display = 'none';
    }
  }

  /**
   * Update controls count
   * @private
   */
  _updateControlsCount() {
    if (!this.elements.controls) return;

    const countEl = this.elements.controls.querySelector('.basset-picker-controls-count');
    if (countEl) {
      countEl.textContent = this.state.selectedElements.length;
    }
  }

  // ===========================================================================
  // Private Methods - Helpers
  // ===========================================================================

  /**
   * Check if element is part of picker UI
   * @private
   */
  _isPickerElement(element) {
    return element.closest('.basset-picker-highlight') ||
           element.closest('.basset-picker-tooltip') ||
           element.closest('.basset-picker-controls') ||
           element.closest('.basset-picker-instructions') ||
           element.closest('.basset-picker-selected');
  }

  /**
   * Generate CSS selector for element
   * @private
   */
  _generateSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }

    const path = [];
    let current = element;

    while (current && current !== document.body && path.length < 8) {
      let selector = current.tagName.toLowerCase();

      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/)
          .filter(c => !c.startsWith('basset-'))
          .slice(0, 2)
          .join('.');
        if (classes) {
          selector += '.' + classes;
        }
      }

      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          el => el.tagName === current.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-child(${index})`;
        }
      }

      path.unshift(selector);
      current = parent;
    }

    return path.join(' > ');
  }

  /**
   * Escape HTML
   * @private
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.ElementPicker = ElementPicker;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ElementPicker
  };
}
