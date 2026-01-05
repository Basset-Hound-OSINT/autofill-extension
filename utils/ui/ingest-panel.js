/**
 * Basset Hound Browser Automation - Ingest Panel UI
 * Phase 8.2: "Ingest" Button Functionality
 *
 * Provides UI components for OSINT data ingestion:
 * - Floating ingest button with detection count
 * - Ingest panel modal for reviewing and selecting items
 * - Verification status display
 * - Batch ingestion with progress
 */

// =============================================================================
// Ingest Panel Styles
// =============================================================================

/**
 * CSS styles for ingest panel components
 */
const INGEST_PANEL_STYLES = `
  /* Floating Ingest Button */
  .basset-ingest-btn {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 999999;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #4a90d9 0%, #357abd 100%);
    color: white;
    border: none;
    border-radius: 24px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(74, 144, 217, 0.4);
    transition: all 0.3s ease;
  }

  .basset-ingest-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(74, 144, 217, 0.5);
  }

  .basset-ingest-btn:active {
    transform: translateY(0);
  }

  .basset-ingest-btn-icon {
    width: 20px;
    height: 20px;
  }

  .basset-ingest-btn-count {
    background: rgba(255, 255, 255, 0.2);
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
  }

  .basset-ingest-btn.minimized {
    padding: 10px;
    border-radius: 50%;
    width: 48px;
    height: 48px;
    justify-content: center;
  }

  .basset-ingest-btn.minimized .basset-ingest-btn-text,
  .basset-ingest-btn.minimized .basset-ingest-btn-count {
    display: none;
  }

  /* Modal Overlay */
  .basset-ingest-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999999;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease;
  }

  .basset-ingest-overlay.visible {
    opacity: 1;
    visibility: visible;
  }

  /* Modal Panel */
  .basset-ingest-panel {
    background: #1e1e1e;
    color: #e0e0e0;
    border-radius: 12px;
    width: 90%;
    max-width: 700px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    transform: scale(0.95);
    transition: transform 0.3s ease;
  }

  .basset-ingest-overlay.visible .basset-ingest-panel {
    transform: scale(1);
  }

  /* Panel Header */
  .basset-ingest-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #333;
  }

  .basset-ingest-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #fff;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .basset-ingest-close {
    background: none;
    border: none;
    color: #888;
    font-size: 24px;
    cursor: pointer;
    padding: 4px;
    line-height: 1;
    transition: color 0.2s;
  }

  .basset-ingest-close:hover {
    color: #fff;
  }

  /* Summary Bar */
  .basset-ingest-summary {
    display: flex;
    gap: 12px;
    padding: 12px 20px;
    background: #252525;
    border-bottom: 1px solid #333;
    flex-wrap: wrap;
  }

  .basset-ingest-summary-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    background: #333;
    border-radius: 16px;
    font-size: 13px;
  }

  .basset-ingest-summary-count {
    color: #4a90d9;
    font-weight: 600;
  }

  /* Item List */
  .basset-ingest-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  .basset-ingest-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 20px;
    border-bottom: 1px solid #2a2a2a;
    transition: background 0.2s;
  }

  .basset-ingest-item:hover {
    background: #252525;
  }

  .basset-ingest-item-checkbox {
    margin-top: 4px;
  }

  .basset-ingest-item-checkbox input {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .basset-ingest-item-content {
    flex: 1;
    min-width: 0;
  }

  .basset-ingest-item-value {
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 14px;
    word-break: break-all;
    color: #fff;
    margin-bottom: 4px;
  }

  .basset-ingest-item-meta {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 12px;
    color: #888;
  }

  .basset-ingest-item-type {
    background: #333;
    padding: 2px 8px;
    border-radius: 4px;
    text-transform: uppercase;
    font-size: 10px;
    font-weight: 600;
  }

  .basset-ingest-item-type.email { background: #2e5a3b; color: #7fdb98; }
  .basset-ingest-item-type.phone { background: #4a3a5a; color: #c792ea; }
  .basset-ingest-item-type.crypto { background: #5a4a2e; color: #ffcb6b; }
  .basset-ingest-item-type.ip { background: #2e4a5a; color: #82aaff; }
  .basset-ingest-item-type.domain { background: #5a2e3a; color: #f07178; }

  /* Verification Status */
  .basset-ingest-item-status {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
  }

  .basset-ingest-item-status.verified { background: #1d3d2a; color: #4ade80; }
  .basset-ingest-item-status.warning { background: #3d3520; color: #fbbf24; }
  .basset-ingest-item-status.error { background: #3d2020; color: #f87171; }
  .basset-ingest-item-status.pending { background: #333; color: #888; }

  /* Footer Actions */
  .basset-ingest-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-top: 1px solid #333;
    background: #252525;
    border-radius: 0 0 12px 12px;
  }

  .basset-ingest-footer-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .basset-ingest-select-all {
    background: none;
    border: 1px solid #444;
    color: #888;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .basset-ingest-select-all:hover {
    border-color: #666;
    color: #fff;
  }

  .basset-ingest-selected-count {
    color: #888;
    font-size: 13px;
  }

  .basset-ingest-footer-right {
    display: flex;
    gap: 10px;
  }

  .basset-ingest-btn-secondary {
    background: #333;
    border: none;
    color: #888;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .basset-ingest-btn-secondary:hover {
    background: #444;
    color: #fff;
  }

  .basset-ingest-btn-primary {
    background: linear-gradient(135deg, #4a90d9 0%, #357abd 100%);
    border: none;
    color: white;
    padding: 10px 24px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .basset-ingest-btn-primary:hover {
    opacity: 0.9;
  }

  .basset-ingest-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Progress Bar */
  .basset-ingest-progress {
    display: none;
    padding: 16px 20px;
    border-top: 1px solid #333;
    background: #252525;
  }

  .basset-ingest-progress.active {
    display: block;
  }

  .basset-ingest-progress-bar {
    height: 4px;
    background: #333;
    border-radius: 2px;
    overflow: hidden;
  }

  .basset-ingest-progress-fill {
    height: 100%;
    background: linear-gradient(135deg, #4a90d9 0%, #357abd 100%);
    width: 0%;
    transition: width 0.3s ease;
  }

  .basset-ingest-progress-text {
    margin-top: 8px;
    font-size: 12px;
    color: #888;
    text-align: center;
  }

  /* Empty State */
  .basset-ingest-empty {
    padding: 40px 20px;
    text-align: center;
    color: #888;
  }

  .basset-ingest-empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  /* Context Preview */
  .basset-ingest-item-context {
    font-size: 11px;
    color: #666;
    font-style: italic;
    margin-top: 4px;
    max-width: 400px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

// =============================================================================
// IngestPanel Class
// =============================================================================

/**
 * Ingest Panel UI Component
 * Provides a floating button and modal for OSINT data ingestion
 */
class IngestPanel {
  /**
   * Create a new IngestPanel
   * @param {Object} options - Configuration options
   * @param {Object} options.fieldDetector - OSINTFieldDetector instance
   * @param {Object} options.verifier - DataVerifier instance
   * @param {Object} options.provenanceCapture - ProvenanceCapture instance
   * @param {Object} options.bassetSync - BassetHoundSync instance
   * @param {Object} options.logger - Logger instance
   * @param {boolean} options.showButton - Show floating button (default: true)
   * @param {Function} options.onIngest - Callback when items are ingested
   */
  constructor(options = {}) {
    this.config = {
      fieldDetector: options.fieldDetector || null,
      verifier: options.verifier || null,
      provenanceCapture: options.provenanceCapture || null,
      bassetSync: options.bassetSync || null,
      logger: options.logger || null,
      showButton: options.showButton !== false,
      onIngest: options.onIngest || null
    };

    this.state = {
      isOpen: false,
      findings: [],
      selectedIds: new Set(),
      verificationResults: new Map(),
      isIngesting: false,
      ingestProgress: 0
    };

    this.elements = {
      button: null,
      overlay: null,
      panel: null
    };

    this._injectStyles();

    if (this.config.showButton) {
      this._createButton();
    }
  }

  /**
   * Scan page and show findings
   * @param {Object} options - Scan options
   * @returns {Array} Findings
   */
  async scan(options = {}) {
    if (!this.config.fieldDetector) {
      console.warn('IngestPanel: No field detector configured');
      return [];
    }

    // Detect OSINT data on page
    const findings = this.config.fieldDetector.detectOnPage(options);
    this.state.findings = findings;

    // Reset verification results
    this.state.verificationResults.clear();

    // Verify each finding
    if (this.config.verifier) {
      for (const finding of findings) {
        const result = await this.config.verifier.verify(
          finding.identifierType,
          finding.value
        );
        this.state.verificationResults.set(finding.value, result);
      }
    }

    // Update button count
    this._updateButtonCount();

    return findings;
  }

  /**
   * Show the ingest panel
   */
  show() {
    if (!this.elements.overlay) {
      this._createPanel();
    }

    this._renderFindings();
    this.elements.overlay.classList.add('visible');
    this.state.isOpen = true;
    document.body.style.overflow = 'hidden';
  }

  /**
   * Hide the ingest panel
   */
  hide() {
    if (this.elements.overlay) {
      this.elements.overlay.classList.remove('visible');
    }
    this.state.isOpen = false;
    document.body.style.overflow = '';
  }

  /**
   * Toggle panel visibility
   */
  toggle() {
    if (this.state.isOpen) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Ingest selected items
   * @returns {Promise<Object>} Ingestion result
   */
  async ingestSelected() {
    if (this.state.selectedIds.size === 0) {
      return { success: false, error: 'No items selected' };
    }

    this.state.isIngesting = true;
    this._updateProgress(0);

    const selectedFindings = this.state.findings.filter(f =>
      this.state.selectedIds.has(f.value)
    );

    const results = {
      success: true,
      ingested: [],
      failed: [],
      total: selectedFindings.length
    };

    const provenance = this.config.provenanceCapture?.capture() || {
      source_url: window.location.href,
      source_date: new Date().toISOString(),
      captured_by: 'autofill-extension'
    };

    for (let i = 0; i < selectedFindings.length; i++) {
      const finding = selectedFindings[i];
      const verification = this.state.verificationResults.get(finding.value);

      try {
        // Check if verification passed
        if (verification && !verification.plausible) {
          results.failed.push({
            value: finding.value,
            error: 'Verification failed'
          });
          continue;
        }

        // Send to basset-hound if available
        if (this.config.bassetSync) {
          // Create orphan data with provenance
          const syncResult = await this._sendToBassetHound(finding, provenance, verification);
          if (syncResult.success) {
            results.ingested.push(finding);
          } else {
            results.failed.push({
              value: finding.value,
              error: syncResult.error || 'Sync failed'
            });
          }
        } else {
          // Store locally or call callback
          results.ingested.push(finding);
        }
      } catch (error) {
        results.failed.push({
          value: finding.value,
          error: error.message
        });
      }

      // Update progress
      this._updateProgress(((i + 1) / selectedFindings.length) * 100);
    }

    this.state.isIngesting = false;

    // Call onIngest callback
    if (this.config.onIngest) {
      this.config.onIngest(results);
    }

    // Remove ingested items from list
    this.state.findings = this.state.findings.filter(f =>
      !results.ingested.find(i => i.value === f.value)
    );
    this.state.selectedIds.clear();

    // Re-render
    this._renderFindings();
    this._updateButtonCount();

    // Hide panel if all items ingested
    if (this.state.findings.length === 0) {
      setTimeout(() => this.hide(), 1500);
    }

    return results;
  }

  /**
   * Destroy the panel and clean up
   */
  destroy() {
    if (this.elements.button) {
      this.elements.button.remove();
    }
    if (this.elements.overlay) {
      this.elements.overlay.remove();
    }

    // Remove styles
    const styleEl = document.getElementById('basset-ingest-styles');
    if (styleEl) styleEl.remove();
  }

  // ===========================================================================
  // Private Methods - UI Creation
  // ===========================================================================

  /**
   * Inject CSS styles
   * @private
   */
  _injectStyles() {
    if (document.getElementById('basset-ingest-styles')) return;

    const style = document.createElement('style');
    style.id = 'basset-ingest-styles';
    style.textContent = INGEST_PANEL_STYLES;
    document.head.appendChild(style);
  }

  /**
   * Create floating button
   * @private
   */
  _createButton() {
    const button = document.createElement('button');
    button.className = 'basset-ingest-btn';
    button.innerHTML = `
      <svg class="basset-ingest-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span class="basset-ingest-btn-text">Ingest</span>
      <span class="basset-ingest-btn-count">0</span>
    `;

    button.addEventListener('click', () => {
      if (this.state.findings.length === 0) {
        this.scan().then(() => this.show());
      } else {
        this.toggle();
      }
    });

    document.body.appendChild(button);
    this.elements.button = button;
  }

  /**
   * Create modal panel
   * @private
   */
  _createPanel() {
    const overlay = document.createElement('div');
    overlay.className = 'basset-ingest-overlay';

    const panel = document.createElement('div');
    panel.className = 'basset-ingest-panel';
    panel.innerHTML = `
      <div class="basset-ingest-header">
        <h2>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          OSINT Data Ingestion
        </h2>
        <button class="basset-ingest-close">&times;</button>
      </div>
      <div class="basset-ingest-summary"></div>
      <div class="basset-ingest-list"></div>
      <div class="basset-ingest-progress">
        <div class="basset-ingest-progress-bar">
          <div class="basset-ingest-progress-fill"></div>
        </div>
        <div class="basset-ingest-progress-text">Ingesting...</div>
      </div>
      <div class="basset-ingest-footer">
        <div class="basset-ingest-footer-left">
          <button class="basset-ingest-select-all">Select All</button>
          <span class="basset-ingest-selected-count">0 selected</span>
        </div>
        <div class="basset-ingest-footer-right">
          <button class="basset-ingest-btn-secondary basset-ingest-rescan">Rescan</button>
          <button class="basset-ingest-btn-primary basset-ingest-submit" disabled>
            Ingest Selected
          </button>
        </div>
      </div>
    `;

    overlay.appendChild(panel);

    // Event handlers
    overlay.querySelector('.basset-ingest-close').addEventListener('click', () => this.hide());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.hide();
    });

    overlay.querySelector('.basset-ingest-select-all').addEventListener('click', () => {
      this._toggleSelectAll();
    });

    overlay.querySelector('.basset-ingest-rescan').addEventListener('click', () => {
      this.scan().then(() => this._renderFindings());
    });

    overlay.querySelector('.basset-ingest-submit').addEventListener('click', () => {
      this.ingestSelected();
    });

    document.body.appendChild(overlay);
    this.elements.overlay = overlay;
    this.elements.panel = panel;
  }

  // ===========================================================================
  // Private Methods - Rendering
  // ===========================================================================

  /**
   * Render findings in the list
   * @private
   */
  _renderFindings() {
    if (!this.elements.panel) return;

    const list = this.elements.panel.querySelector('.basset-ingest-list');
    const summary = this.elements.panel.querySelector('.basset-ingest-summary');

    if (this.state.findings.length === 0) {
      list.innerHTML = `
        <div class="basset-ingest-empty">
          <div class="basset-ingest-empty-icon">🔍</div>
          <p>No OSINT data detected on this page.</p>
          <p>Try scanning a different page with emails, phone numbers, or crypto addresses.</p>
        </div>
      `;
      summary.innerHTML = '';
      return;
    }

    // Render summary
    const grouped = this.config.fieldDetector?.getGroupedFindings(this.state.findings) || {};
    summary.innerHTML = Object.entries(grouped).map(([type, items]) => `
      <div class="basset-ingest-summary-item">
        <span class="basset-ingest-summary-count">${items.length}</span>
        <span>${type}</span>
      </div>
    `).join('');

    // Render items
    list.innerHTML = this.state.findings.map(finding => {
      const verification = this.state.verificationResults.get(finding.value);
      const isSelected = this.state.selectedIds.has(finding.value);
      const statusClass = this._getStatusClass(verification);
      const statusText = this._getStatusText(verification);

      return `
        <div class="basset-ingest-item" data-value="${this._escapeHtml(finding.value)}">
          <div class="basset-ingest-item-checkbox">
            <input type="checkbox" ${isSelected ? 'checked' : ''}>
          </div>
          <div class="basset-ingest-item-content">
            <div class="basset-ingest-item-value">${this._escapeHtml(finding.value)}</div>
            <div class="basset-ingest-item-meta">
              <span class="basset-ingest-item-type ${finding.type}">${finding.identifierType}</span>
              <span class="basset-ingest-item-status ${statusClass}">${statusText}</span>
              <span>Confidence: ${Math.round(finding.confidence * 100)}%</span>
            </div>
            ${finding.context ? `<div class="basset-ingest-item-context">${this._escapeHtml(finding.context)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Add checkbox event listeners
    list.querySelectorAll('.basset-ingest-item').forEach(item => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      const value = item.dataset.value;

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          this.state.selectedIds.add(value);
        } else {
          this.state.selectedIds.delete(value);
        }
        this._updateSelectedCount();
      });

      // Click on row to toggle
      item.addEventListener('click', (e) => {
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event('change'));
        }
      });
    });

    this._updateSelectedCount();
  }

  /**
   * Update selected count display
   * @private
   */
  _updateSelectedCount() {
    if (!this.elements.panel) return;

    const countEl = this.elements.panel.querySelector('.basset-ingest-selected-count');
    const submitBtn = this.elements.panel.querySelector('.basset-ingest-submit');

    countEl.textContent = `${this.state.selectedIds.size} selected`;
    submitBtn.disabled = this.state.selectedIds.size === 0;
  }

  /**
   * Update button count
   * @private
   */
  _updateButtonCount() {
    if (!this.elements.button) return;

    const countEl = this.elements.button.querySelector('.basset-ingest-btn-count');
    countEl.textContent = this.state.findings.length;

    // Hide button if no findings
    this.elements.button.style.display = this.state.findings.length > 0 ? 'flex' : 'none';
  }

  /**
   * Update progress bar
   * @private
   */
  _updateProgress(percent) {
    if (!this.elements.panel) return;

    const progressEl = this.elements.panel.querySelector('.basset-ingest-progress');
    const fillEl = progressEl.querySelector('.basset-ingest-progress-fill');
    const textEl = progressEl.querySelector('.basset-ingest-progress-text');

    if (this.state.isIngesting) {
      progressEl.classList.add('active');
      fillEl.style.width = `${percent}%`;
      textEl.textContent = percent >= 100 ? 'Complete!' : `Ingesting... ${Math.round(percent)}%`;
    } else {
      progressEl.classList.remove('active');
    }
  }

  /**
   * Toggle select all
   * @private
   */
  _toggleSelectAll() {
    const allSelected = this.state.selectedIds.size === this.state.findings.length;

    if (allSelected) {
      this.state.selectedIds.clear();
    } else {
      this.state.findings.forEach(f => this.state.selectedIds.add(f.value));
    }

    this._renderFindings();
  }

  // ===========================================================================
  // Private Methods - Helpers
  // ===========================================================================

  /**
   * Get verification status class
   * @private
   */
  _getStatusClass(verification) {
    if (!verification) return 'pending';
    if (verification.plausible && verification.valid) return 'verified';
    if (verification.plausible && !verification.valid) return 'warning';
    if (verification.errors?.length > 0) return 'error';
    return 'pending';
  }

  /**
   * Get verification status text
   * @private
   */
  _getStatusText(verification) {
    if (!verification) return '⏳ Pending';
    if (verification.plausible && verification.valid) return '✓ Verified';
    if (verification.plausible && !verification.valid) return '⚠ Warning';
    if (verification.errors?.length > 0) return '✗ Invalid';
    return '⏳ Pending';
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

  /**
   * Send finding to basset-hound
   * @private
   */
  async _sendToBassetHound(finding, provenance, verification) {
    // This would call the actual basset-hound sync
    // For now, we'll simulate a successful ingestion
    if (this.config.bassetSync?.syncEntity) {
      return await this.config.bassetSync.syncEntity({
        id: `orphan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'orphan',
        data: {
          identifier_type: finding.identifierType,
          identifier_value: finding.value,
          metadata: {
            context: finding.context,
            confidence: finding.confidence,
            verification: verification
          },
          provenance: provenance
        }
      });
    }

    // Fallback: simulate success
    return { success: true };
  }
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.IngestPanel = IngestPanel;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    IngestPanel
  };
}
