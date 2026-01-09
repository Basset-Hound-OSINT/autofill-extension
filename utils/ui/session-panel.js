/**
 * Basset Hound Browser Automation - Session Panel UI
 * Evidence Session Management Panel
 *
 * Provides a floating UI panel for evidence session management:
 * - View active session info (name, case ID, duration)
 * - Quick evidence capture controls
 * - Mini evidence list with thumbnails
 * - Session controls (pause, resume, export, close)
 * - Keyboard shortcuts for rapid evidence collection
 * - Real-time updates via chrome.runtime messaging
 */

// =============================================================================
// Constants and Configuration
// =============================================================================

/**
 * Z-index hierarchy for session panel components
 * @constant
 */
const SESSION_PANEL_Z_INDEX = {
  PANEL: 9999995,
  DROPDOWN: 9999996,
  TOOLTIP: 9999997,
  NOTIFICATION: 9999998
};

/**
 * Session status types
 * @constant
 */
const SessionStatus = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  CLOSED: 'closed'
};

/**
 * Default panel configuration
 * @constant
 */
const DEFAULT_CONFIG = {
  position: 'bottom-right',
  minWidth: 280,
  maxWidth: 380,
  storageKey: 'basset_session_panel_state'
};

// =============================================================================
// Session Panel Styles (Shadow DOM compatible)
// =============================================================================

const SESSION_PANEL_STYLES = `
  :host {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  * {
    box-sizing: border-box;
  }

  /* Main Panel Container */
  .session-panel {
    position: fixed;
    z-index: ${SESSION_PANEL_Z_INDEX.PANEL};
    width: 320px;
    min-width: ${DEFAULT_CONFIG.minWidth}px;
    max-width: ${DEFAULT_CONFIG.maxWidth}px;
    background: #1e1e1e;
    color: #e0e0e0;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    opacity: 0;
    visibility: hidden;
    transform: translateY(10px) scale(0.95);
    transition: all 0.25s ease;
    user-select: none;
  }

  .session-panel.visible {
    opacity: 1;
    visibility: visible;
    transform: translateY(0) scale(1);
  }

  .session-panel.minimized {
    width: auto;
    min-width: auto;
  }

  .session-panel.minimized .session-panel-body,
  .session-panel.minimized .session-panel-footer {
    display: none;
  }

  .session-panel.dragging {
    cursor: grabbing;
    transition: none;
  }

  /* Panel Header */
  .session-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: #252525;
    border-bottom: 1px solid #333;
    cursor: grab;
  }

  .session-panel-header:active {
    cursor: grabbing;
  }

  .session-panel-header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .session-panel-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
  }

  .session-panel-title svg {
    width: 16px;
    height: 16px;
    color: #4a90d9;
  }

  .session-panel-status {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 10px;
    background: rgba(74, 222, 128, 0.15);
    color: #4ade80;
  }

  .session-panel-status.paused {
    background: rgba(251, 191, 36, 0.15);
    color: #fbbf24;
  }

  .session-panel-status.closed {
    background: rgba(136, 136, 136, 0.15);
    color: #888;
  }

  .session-panel-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    animation: pulse 2s infinite;
  }

  .session-panel-status.paused .session-panel-status-dot {
    animation: none;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .session-panel-header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .session-panel-header-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: #888;
    cursor: pointer;
    transition: all 0.2s;
  }

  .session-panel-header-btn:hover {
    background: #333;
    color: #fff;
  }

  .session-panel-header-btn svg {
    width: 14px;
    height: 14px;
  }

  /* Session Info Section */
  .session-panel-info {
    padding: 12px 14px;
    background: linear-gradient(135deg, rgba(74, 144, 217, 0.1) 0%, rgba(53, 122, 189, 0.05) 100%);
    border-bottom: 1px solid #333;
  }

  .session-panel-info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .session-panel-info-row:last-child {
    margin-bottom: 0;
  }

  .session-panel-info-label {
    font-size: 11px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .session-panel-info-value {
    font-size: 12px;
    color: #e0e0e0;
    font-family: 'SF Mono', Monaco, monospace;
  }

  .session-panel-info-value.session-name {
    font-weight: 600;
    color: #fff;
    font-family: inherit;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Session Switcher Dropdown */
  .session-switcher {
    position: relative;
  }

  .session-switcher-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: #333;
    border: none;
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .session-switcher-btn:hover {
    background: #444;
  }

  .session-switcher-btn svg {
    width: 12px;
    height: 12px;
    transition: transform 0.2s;
  }

  .session-switcher.open .session-switcher-btn svg {
    transform: rotate(180deg);
  }

  .session-switcher-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: ${SESSION_PANEL_Z_INDEX.DROPDOWN};
    min-width: 200px;
    max-height: 200px;
    overflow-y: auto;
    background: #2a2a2a;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    opacity: 0;
    visibility: hidden;
    transform: translateY(-4px);
    transition: all 0.2s;
  }

  .session-switcher.open .session-switcher-dropdown {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }

  .session-switcher-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border: none;
    background: none;
    color: #e0e0e0;
    font-size: 12px;
    text-align: left;
    width: 100%;
    cursor: pointer;
    transition: background 0.2s;
  }

  .session-switcher-item:hover {
    background: #333;
  }

  .session-switcher-item.active {
    background: rgba(74, 144, 217, 0.15);
    color: #4a90d9;
  }

  .session-switcher-item-icon {
    width: 14px;
    height: 14px;
  }

  /* Quick Capture Bar */
  .session-panel-capture {
    padding: 12px 14px;
    border-bottom: 1px solid #333;
  }

  .session-panel-capture-row {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
  }

  .session-panel-capture-row:last-child {
    margin-bottom: 0;
  }

  .session-panel-capture-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    flex: 1;
    padding: 10px 12px;
    background: #333;
    border: none;
    border-radius: 8px;
    color: #e0e0e0;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .session-panel-capture-btn:hover {
    background: #444;
    color: #fff;
  }

  .session-panel-capture-btn.primary {
    background: linear-gradient(135deg, #4a90d9 0%, #357abd 100%);
    color: #fff;
  }

  .session-panel-capture-btn.primary:hover {
    opacity: 0.9;
  }

  .session-panel-capture-btn svg {
    width: 16px;
    height: 16px;
  }

  .session-panel-capture-input {
    flex: 1;
    padding: 10px 12px;
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 8px;
    color: #e0e0e0;
    font-size: 12px;
    outline: none;
    transition: border-color 0.2s;
  }

  .session-panel-capture-input:focus {
    border-color: #4a90d9;
  }

  .session-panel-capture-input::placeholder {
    color: #666;
  }

  /* Evidence List Mini */
  .session-panel-evidence {
    padding: 8px 14px 12px;
    border-bottom: 1px solid #333;
  }

  .session-panel-evidence-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .session-panel-evidence-title {
    font-size: 11px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .session-panel-evidence-count {
    font-size: 11px;
    color: #4a90d9;
    font-weight: 600;
  }

  .session-panel-evidence-list {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: thin;
    scrollbar-color: #444 transparent;
  }

  .session-panel-evidence-list::-webkit-scrollbar {
    height: 4px;
  }

  .session-panel-evidence-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .session-panel-evidence-list::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 2px;
  }

  .session-panel-evidence-item {
    position: relative;
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border-radius: 6px;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .session-panel-evidence-item:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .session-panel-evidence-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .session-panel-evidence-item-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #333;
    color: #666;
    font-size: 18px;
  }

  .session-panel-evidence-item-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    padding: 1px 4px;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 3px;
    font-size: 9px;
    color: #fff;
  }

  .session-panel-evidence-empty {
    text-align: center;
    padding: 16px 0;
    color: #666;
    font-size: 12px;
    font-style: italic;
  }

  .session-panel-evidence-view-all {
    background: none;
    border: none;
    color: #4a90d9;
    font-size: 11px;
    cursor: pointer;
    text-decoration: underline;
    transition: color 0.2s;
  }

  .session-panel-evidence-view-all:hover {
    color: #6ba8e5;
  }

  /* Session Controls Footer */
  .session-panel-footer {
    padding: 12px 14px;
    background: #252525;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .session-panel-footer-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .session-panel-footer-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .session-panel-control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 8px 12px;
    background: #333;
    border: none;
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .session-panel-control-btn:hover {
    background: #444;
    color: #fff;
  }

  .session-panel-control-btn.danger {
    color: #f87171;
  }

  .session-panel-control-btn.danger:hover {
    background: rgba(248, 113, 113, 0.15);
  }

  .session-panel-control-btn.warning {
    color: #fbbf24;
  }

  .session-panel-control-btn.warning:hover {
    background: rgba(251, 191, 36, 0.15);
  }

  .session-panel-control-btn svg {
    width: 14px;
    height: 14px;
  }

  /* Export Dropdown */
  .export-dropdown {
    position: relative;
  }

  .export-dropdown-menu {
    position: absolute;
    bottom: calc(100% + 4px);
    right: 0;
    z-index: ${SESSION_PANEL_Z_INDEX.DROPDOWN};
    min-width: 140px;
    background: #2a2a2a;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    opacity: 0;
    visibility: hidden;
    transform: translateY(4px);
    transition: all 0.2s;
  }

  .export-dropdown.open .export-dropdown-menu {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }

  .export-dropdown-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: none;
    border: none;
    color: #e0e0e0;
    font-size: 12px;
    text-align: left;
    width: 100%;
    cursor: pointer;
    transition: background 0.2s;
  }

  .export-dropdown-item:hover {
    background: #333;
  }

  .export-dropdown-item svg {
    width: 14px;
    height: 14px;
    color: #888;
  }

  /* No Active Session State */
  .session-panel-no-session {
    padding: 32px 20px;
    text-align: center;
  }

  .session-panel-no-session-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto 16px;
    color: #444;
  }

  .session-panel-no-session-text {
    font-size: 13px;
    color: #888;
    margin-bottom: 16px;
  }

  .session-panel-new-session-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 20px;
    background: linear-gradient(135deg, #4a90d9 0%, #357abd 100%);
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .session-panel-new-session-btn:hover {
    opacity: 0.9;
  }

  .session-panel-new-session-btn svg {
    width: 16px;
    height: 16px;
  }

  /* Notifications */
  .session-panel-notification {
    position: absolute;
    top: -60px;
    left: 50%;
    transform: translateX(-50%);
    z-index: ${SESSION_PANEL_Z_INDEX.NOTIFICATION};
    padding: 10px 16px;
    background: #333;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    font-size: 12px;
    color: #e0e0e0;
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease;
  }

  .session-panel-notification.visible {
    opacity: 1;
    visibility: visible;
  }

  .session-panel-notification.success {
    background: #1d3d2a;
    color: #4ade80;
  }

  .session-panel-notification.error {
    background: #3d2020;
    color: #f87171;
  }

  /* Keyboard Shortcut Hints */
  .shortcut-hint {
    font-size: 10px;
    color: #666;
    padding: 2px 5px;
    background: #2a2a2a;
    border-radius: 3px;
    margin-left: 6px;
    font-family: 'SF Mono', Monaco, monospace;
  }

  /* Panel Body */
  .session-panel-body {
    flex: 1;
    overflow: hidden;
  }

  /* Scrollbar styling */
  .session-panel ::-webkit-scrollbar {
    width: 6px;
  }

  .session-panel ::-webkit-scrollbar-track {
    background: transparent;
  }

  .session-panel ::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 3px;
  }

  .session-panel ::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
`;

// =============================================================================
// SessionPanel Class
// =============================================================================

/**
 * SessionPanel - Floating evidence session management panel
 * Provides quick access to evidence capture and session controls
 */
class SessionPanel {
  /**
   * Create a SessionPanel instance
   * @param {Object} options - Configuration options
   * @param {string} options.position - Panel position ('bottom-right', 'bottom-left', 'top-right', 'top-left')
   * @param {Object} options.sessionManager - SessionManager instance reference
   * @param {Object} options.logger - Logger instance
   * @param {Function} options.onCapture - Callback when capture is triggered
   * @param {Function} options.onSessionChange - Callback when session changes
   * @param {Function} options.onExport - Callback when export is triggered
   */
  constructor(options = {}) {
    this.config = {
      position: options.position || DEFAULT_CONFIG.position,
      sessionManager: options.sessionManager || null,
      logger: options.logger || null,
      onCapture: options.onCapture || null,
      onSessionChange: options.onSessionChange || null,
      onExport: options.onExport || null
    };

    /**
     * Panel state
     */
    this.state = {
      isVisible: false,
      isMinimized: false,
      isDragging: false,
      position: { x: 0, y: 0 },
      activeSession: null,
      sessions: [],
      evidenceItems: [],
      sessionStatus: SessionStatus.CLOSED,
      sessionDuration: 0,
      sessionSwitcherOpen: false,
      exportDropdownOpen: false
    };

    /**
     * DOM references
     */
    this.elements = {
      host: null,
      shadowRoot: null,
      panel: null,
      notification: null
    };

    /**
     * Timer references
     */
    this._durationTimer = null;
    this._notificationTimer = null;

    /**
     * Drag state
     */
    this._dragState = {
      startX: 0,
      startY: 0,
      startPosX: 0,
      startPosY: 0
    };

    /**
     * Bound event handlers
     */
    this._boundHandlers = {
      onKeyDown: this._onKeyDown.bind(this),
      onMouseMove: this._onMouseMove.bind(this),
      onMouseUp: this._onMouseUp.bind(this),
      onMessageReceived: this._onMessageReceived.bind(this)
    };

    this._init();
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * Initialize the panel
   * @private
   */
  async _init() {
    this._createShadowHost();
    this._renderPanel();
    this._attachEventListeners();
    await this._loadState();
    await this._loadActiveSession();
    this._startDurationTimer();
  }

  /**
   * Create shadow DOM host element
   * @private
   */
  _createShadowHost() {
    this.elements.host = document.createElement('div');
    this.elements.host.id = 'basset-session-panel';
    this.elements.host.style.cssText = 'all: initial; position: fixed; z-index: ' + SESSION_PANEL_Z_INDEX.PANEL + ';';
    document.body.appendChild(this.elements.host);

    this.elements.shadowRoot = this.elements.host.attachShadow({ mode: 'closed' });

    const styleEl = document.createElement('style');
    styleEl.textContent = SESSION_PANEL_STYLES;
    this.elements.shadowRoot.appendChild(styleEl);
  }

  /**
   * Render the panel
   * @private
   */
  _renderPanel() {
    const panel = document.createElement('div');
    panel.className = 'session-panel';
    panel.innerHTML = this._getPanelHTML();

    this._setInitialPosition(panel);

    this.elements.shadowRoot.appendChild(panel);
    this.elements.panel = panel;

    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'session-panel-notification';
    this.elements.panel.appendChild(notification);
    this.elements.notification = notification;

    this._attachPanelEventListeners();
  }

  /**
   * Get panel HTML content
   * @private
   * @returns {string} HTML string
   */
  _getPanelHTML() {
    if (!this.state.activeSession) {
      return this._getNoSessionHTML();
    }
    return this._getActiveSessionHTML();
  }

  /**
   * Get HTML for no active session state
   * @private
   * @returns {string} HTML string
   */
  _getNoSessionHTML() {
    return `
      <div class="session-panel-header">
        <div class="session-panel-header-left">
          <div class="session-panel-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10,9 9,9 8,9"/>
            </svg>
            Evidence Session
          </div>
        </div>
        <div class="session-panel-header-actions">
          <button class="session-panel-header-btn" data-action="minimize" title="Minimize">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <button class="session-panel-header-btn" data-action="close" title="Close panel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="session-panel-body">
        <div class="session-panel-no-session">
          <svg class="session-panel-no-session-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          <div class="session-panel-no-session-text">No active evidence session</div>
          <button class="session-panel-new-session-btn" data-action="new-session">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Start New Session
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Get HTML for active session state
   * @private
   * @returns {string} HTML string
   */
  _getActiveSessionHTML() {
    const session = this.state.activeSession;
    const statusClass = this.state.sessionStatus === SessionStatus.PAUSED ? 'paused' : '';
    const duration = this._formatDuration(this.state.sessionDuration);
    const evidenceCount = this.state.evidenceItems.length;

    return `
      <div class="session-panel-header">
        <div class="session-panel-header-left">
          <div class="session-panel-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            Evidence Session
          </div>
          <div class="session-panel-status ${statusClass}">
            <span class="session-panel-status-dot"></span>
            ${this.state.sessionStatus === SessionStatus.PAUSED ? 'Paused' : 'Active'}
          </div>
        </div>
        <div class="session-panel-header-actions">
          <button class="session-panel-header-btn" data-action="minimize" title="Minimize">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <button class="session-panel-header-btn" data-action="close" title="Close panel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="session-panel-body">
        <div class="session-panel-info">
          <div class="session-panel-info-row">
            <span class="session-panel-info-label">Session</span>
            <span class="session-panel-info-value session-name" title="${this._escapeHtml(session.name || 'Unnamed Session')}">
              ${this._escapeHtml(session.name || 'Unnamed Session')}
            </span>
          </div>
          <div class="session-panel-info-row">
            <span class="session-panel-info-label">Case ID</span>
            <div class="session-switcher ${this.state.sessionSwitcherOpen ? 'open' : ''}">
              <button class="session-switcher-btn" data-action="toggle-switcher">
                ${this._escapeHtml(session.caseId || 'N/A')}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6,9 12,15 18,9"/>
                </svg>
              </button>
              <div class="session-switcher-dropdown">
                ${this._getSessionSwitcherItems()}
              </div>
            </div>
          </div>
          <div class="session-panel-info-row">
            <span class="session-panel-info-label">Duration</span>
            <span class="session-panel-info-value" data-duration>${duration}</span>
          </div>
          <div class="session-panel-info-row">
            <span class="session-panel-info-label">Evidence</span>
            <span class="session-panel-info-value">${evidenceCount} item${evidenceCount !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div class="session-panel-capture">
          <div class="session-panel-capture-row">
            <button class="session-panel-capture-btn primary" data-action="screenshot" title="Alt+C">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21,15 16,10 5,21"/>
              </svg>
              Screenshot
            </button>
            <button class="session-panel-capture-btn" data-action="element-capture" title="Capture Element">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 3a2 2 0 0 0-2 2"/>
                <path d="M19 3a2 2 0 0 1 2 2"/>
                <path d="M21 19a2 2 0 0 1-2 2"/>
                <path d="M5 21a2 2 0 0 1-2-2"/>
                <path d="M9 3h1"/>
                <path d="M14 3h1"/>
                <path d="M9 21h1"/>
                <path d="M14 21h1"/>
                <path d="M3 9v1"/>
                <path d="M3 14v1"/>
                <path d="M21 9v1"/>
                <path d="M21 14v1"/>
              </svg>
              Element
            </button>
          </div>
          <div class="session-panel-capture-row">
            <input type="text" class="session-panel-capture-input"
                   placeholder="Quick note..."
                   data-input="note">
            <button class="session-panel-capture-btn" data-action="add-note" title="Alt+N">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              Add
            </button>
          </div>
        </div>

        <div class="session-panel-evidence">
          <div class="session-panel-evidence-header">
            <span class="session-panel-evidence-title">Recent Evidence</span>
            <span class="session-panel-evidence-count">${evidenceCount} total</span>
          </div>
          ${this._getEvidenceListHTML()}
          ${evidenceCount > 5 ? '<button class="session-panel-evidence-view-all" data-action="view-all">View all evidence</button>' : ''}
        </div>
      </div>

      <div class="session-panel-footer">
        <div class="session-panel-footer-left">
          <button class="session-panel-control-btn ${this.state.sessionStatus === SessionStatus.PAUSED ? 'warning' : ''}"
                  data-action="toggle-pause"
                  title="${this.state.sessionStatus === SessionStatus.PAUSED ? 'Resume session' : 'Pause session'}">
            ${this.state.sessionStatus === SessionStatus.PAUSED ? `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5,3 19,12 5,21 5,3"/>
              </svg>
              Resume
            ` : `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
              </svg>
              Pause
            `}
          </button>
          <button class="session-panel-control-btn danger" data-action="close-session" title="Close session">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
            </svg>
            Close
          </button>
        </div>
        <div class="session-panel-footer-right">
          <div class="export-dropdown ${this.state.exportDropdownOpen ? 'open' : ''}">
            <button class="session-panel-control-btn" data-action="toggle-export" title="Export session (Alt+E)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export
            </button>
            <div class="export-dropdown-menu">
              <button class="export-dropdown-item" data-action="export-json">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                </svg>
                Export as JSON
              </button>
              <button class="export-dropdown-item" data-action="export-pdf">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                PDF Structure
              </button>
            </div>
          </div>
          <button class="session-panel-control-btn" data-action="new-session" title="New session">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Get evidence list HTML
   * @private
   * @returns {string} HTML string
   */
  _getEvidenceListHTML() {
    if (this.state.evidenceItems.length === 0) {
      return '<div class="session-panel-evidence-empty">No evidence captured yet</div>';
    }

    const recentItems = this.state.evidenceItems.slice(-5).reverse();
    const itemsHtml = recentItems.map((item, idx) => {
      const thumbnail = item.thumbnail || null;
      const type = item.type || 'screenshot';
      const typeAbbrev = type === 'screenshot' ? 'SS' : type === 'note' ? 'N' : 'E';

      return `
        <div class="session-panel-evidence-item" data-evidence-id="${item.id}" title="${this._escapeHtml(item.description || 'Evidence ' + (idx + 1))}">
          ${thumbnail
            ? `<img src="${thumbnail}" alt="Evidence thumbnail">`
            : `<div class="session-panel-evidence-item-placeholder">${typeAbbrev}</div>`
          }
          <span class="session-panel-evidence-item-badge">${typeAbbrev}</span>
        </div>
      `;
    }).join('');

    return `<div class="session-panel-evidence-list">${itemsHtml}</div>`;
  }

  /**
   * Get session switcher items HTML
   * @private
   * @returns {string} HTML string
   */
  _getSessionSwitcherItems() {
    if (this.state.sessions.length === 0) {
      return '<button class="session-switcher-item">No other sessions</button>';
    }

    return this.state.sessions.map(session => {
      const isActive = this.state.activeSession && this.state.activeSession.id === session.id;
      return `
        <button class="session-switcher-item ${isActive ? 'active' : ''}" data-session-id="${session.id}">
          <svg class="session-switcher-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
          </svg>
          ${this._escapeHtml(session.name || session.caseId || 'Session')}
        </button>
      `;
    }).join('');
  }

  // ===========================================================================
  // Event Handling
  // ===========================================================================

  /**
   * Attach global event listeners
   * @private
   */
  _attachEventListeners() {
    document.addEventListener('keydown', this._boundHandlers.onKeyDown);
    document.addEventListener('mousemove', this._boundHandlers.onMouseMove);
    document.addEventListener('mouseup', this._boundHandlers.onMouseUp);

    // Listen for chrome runtime messages
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(this._boundHandlers.onMessageReceived);
    }
  }

  /**
   * Attach panel-specific event listeners
   * @private
   */
  _attachPanelEventListeners() {
    if (!this.elements.panel) return;

    const self = this;

    // Header drag
    const header = this.elements.panel.querySelector('.session-panel-header');
    if (header) {
      header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.session-panel-header-btn')) return;
        self._startDrag(e);
      });
    }

    // Button actions
    this.elements.panel.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        self._handleAction(btn.dataset.action);
      });
    });

    // Session switcher items
    this.elements.panel.querySelectorAll('[data-session-id]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        self._switchSession(item.dataset.sessionId);
      });
    });

    // Evidence item clicks
    this.elements.panel.querySelectorAll('[data-evidence-id]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        self._viewEvidence(item.dataset.evidenceId);
      });
    });

    // Note input enter key
    const noteInput = this.elements.panel.querySelector('[data-input="note"]');
    if (noteInput) {
      noteInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          self._addNote(noteInput.value);
          noteInput.value = '';
        }
      });
    }

    // Close dropdowns on outside click
    document.addEventListener('click', () => {
      if (self.state.sessionSwitcherOpen) {
        self.state.sessionSwitcherOpen = false;
        self._updatePanel();
      }
      if (self.state.exportDropdownOpen) {
        self.state.exportDropdownOpen = false;
        self._updatePanel();
      }
    });
  }

  /**
   * Handle keyboard events
   * @private
   * @param {KeyboardEvent} e - Keyboard event
   */
  _onKeyDown(e) {
    // Alt+S: Toggle panel visibility
    if (e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      this.toggle();
    }

    // Only handle shortcuts when panel is visible
    if (!this.state.isVisible) return;

    // Alt+C: Quick capture
    if (e.altKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      this._captureScreenshot();
    }

    // Alt+N: Add note (focus input)
    if (e.altKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      const noteInput = this.elements.panel.querySelector('[data-input="note"]');
      if (noteInput) noteInput.focus();
    }

    // Alt+E: Export
    if (e.altKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      this._handleAction('toggle-export');
    }
  }

  /**
   * Handle mouse move for dragging
   * @private
   * @param {MouseEvent} e - Mouse event
   */
  _onMouseMove(e) {
    if (!this.state.isDragging) return;

    const deltaX = e.clientX - this._dragState.startX;
    const deltaY = e.clientY - this._dragState.startY;

    const newX = this._dragState.startPosX + deltaX;
    const newY = this._dragState.startPosY + deltaY;

    // Keep panel within viewport
    const maxX = window.innerWidth - this.elements.panel.offsetWidth - 20;
    const maxY = window.innerHeight - this.elements.panel.offsetHeight - 20;

    this.state.position.x = Math.max(20, Math.min(newX, maxX));
    this.state.position.y = Math.max(20, Math.min(newY, maxY));

    this.elements.panel.style.left = this.state.position.x + 'px';
    this.elements.panel.style.top = this.state.position.y + 'px';
    this.elements.panel.style.right = 'auto';
    this.elements.panel.style.bottom = 'auto';
  }

  /**
   * Handle mouse up for dragging
   * @private
   */
  _onMouseUp() {
    if (this.state.isDragging) {
      this.state.isDragging = false;
      this.elements.panel.classList.remove('dragging');
      this._saveState();
    }
  }

  /**
   * Start drag operation
   * @private
   * @param {MouseEvent} e - Mouse event
   */
  _startDrag(e) {
    this.state.isDragging = true;
    this.elements.panel.classList.add('dragging');

    const rect = this.elements.panel.getBoundingClientRect();
    this._dragState = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: rect.left,
      startPosY: rect.top
    };
  }

  /**
   * Handle chrome runtime messages
   * @private
   * @param {Object} message - Message object
   */
  _onMessageReceived(message) {
    if (!message || !message.type) return;

    switch (message.type) {
      case 'session_updated':
        this._loadActiveSession();
        break;
      case 'evidence_added':
        this._addEvidenceItem(message.evidence);
        break;
      case 'session_closed':
        this.state.activeSession = null;
        this.state.sessionStatus = SessionStatus.CLOSED;
        this._updatePanel();
        break;
    }
  }

  /**
   * Handle action button clicks
   * @private
   * @param {string} action - Action name
   */
  _handleAction(action) {
    switch (action) {
      case 'minimize':
        this._toggleMinimize();
        break;
      case 'close':
        this.hide();
        break;
      case 'new-session':
        this._createNewSession();
        break;
      case 'screenshot':
        this._captureScreenshot();
        break;
      case 'element-capture':
        this._startElementCapture();
        break;
      case 'add-note':
        const noteInput = this.elements.panel.querySelector('[data-input="note"]');
        if (noteInput && noteInput.value.trim()) {
          this._addNote(noteInput.value);
          noteInput.value = '';
        }
        break;
      case 'toggle-pause':
        this._togglePause();
        break;
      case 'close-session':
        this._closeSession();
        break;
      case 'toggle-export':
        this.state.exportDropdownOpen = !this.state.exportDropdownOpen;
        this.state.sessionSwitcherOpen = false;
        this._updatePanel();
        break;
      case 'export-json':
        this._exportSession('json');
        this.state.exportDropdownOpen = false;
        this._updatePanel();
        break;
      case 'export-pdf':
        this._exportSession('pdf');
        this.state.exportDropdownOpen = false;
        this._updatePanel();
        break;
      case 'toggle-switcher':
        this.state.sessionSwitcherOpen = !this.state.sessionSwitcherOpen;
        this.state.exportDropdownOpen = false;
        this._updatePanel();
        break;
      case 'view-all':
        this._viewAllEvidence();
        break;
    }
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Show the panel
   */
  show() {
    this.state.isVisible = true;
    this.elements.panel.classList.add('visible');
    this._saveState();
  }

  /**
   * Hide the panel
   */
  hide() {
    this.state.isVisible = false;
    this.elements.panel.classList.remove('visible');
    this._saveState();
  }

  /**
   * Toggle panel visibility
   */
  toggle() {
    if (this.state.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Update panel with new session data
   * @param {Object} session - Session data
   */
  setSession(session) {
    this.state.activeSession = session;
    this.state.sessionStatus = session ? SessionStatus.ACTIVE : SessionStatus.CLOSED;
    this.state.sessionDuration = 0;
    this._updatePanel();
    this._startDurationTimer();
  }

  /**
   * Add evidence item to the list
   * @param {Object} evidence - Evidence item
   */
  addEvidence(evidence) {
    this._addEvidenceItem(evidence);
  }

  /**
   * Show a notification
   * @param {string} message - Notification message
   * @param {string} type - Notification type ('success', 'error', or default)
   */
  showNotification(message, type = '') {
    this._showNotification(message, type);
  }

  /**
   * Destroy the panel and clean up
   */
  destroy() {
    // Remove event listeners
    document.removeEventListener('keydown', this._boundHandlers.onKeyDown);
    document.removeEventListener('mousemove', this._boundHandlers.onMouseMove);
    document.removeEventListener('mouseup', this._boundHandlers.onMouseUp);

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.removeListener(this._boundHandlers.onMessageReceived);
    }

    // Clear timers
    if (this._durationTimer) {
      clearInterval(this._durationTimer);
    }
    if (this._notificationTimer) {
      clearTimeout(this._notificationTimer);
    }

    // Remove DOM
    if (this.elements.host && this.elements.host.parentNode) {
      this.elements.host.parentNode.removeChild(this.elements.host);
    }

    this.elements = {
      host: null,
      shadowRoot: null,
      panel: null,
      notification: null
    };
  }

  // ===========================================================================
  // Private Methods - Session Operations
  // ===========================================================================

  /**
   * Load active session from session manager
   * @private
   */
  async _loadActiveSession() {
    try {
      const response = await this._sendMessage({ type: 'get_active_session' });
      if (response && response.success && response.session) {
        this.state.activeSession = response.session;
        this.state.sessionStatus = response.session.isPaused ? SessionStatus.PAUSED : SessionStatus.ACTIVE;
        this.state.evidenceItems = response.session.evidence || [];
        this.state.sessionDuration = response.session.duration || 0;
      }

      // Load available sessions
      const sessionsResponse = await this._sendMessage({ type: 'get_sessions' });
      if (sessionsResponse && sessionsResponse.success) {
        this.state.sessions = sessionsResponse.sessions || [];
      }
    } catch (error) {
      this._log('error', 'Failed to load active session:', error);
    }

    this._updatePanel();
  }

  /**
   * Create a new session
   * @private
   */
  async _createNewSession() {
    try {
      const response = await this._sendMessage({
        type: 'create_session',
        data: {
          name: 'Session ' + new Date().toISOString().slice(0, 19).replace('T', ' '),
          caseId: 'CASE-' + Date.now().toString(36).toUpperCase()
        }
      });

      if (response && response.success) {
        this.state.activeSession = response.session;
        this.state.sessionStatus = SessionStatus.ACTIVE;
        this.state.evidenceItems = [];
        this.state.sessionDuration = 0;
        this._updatePanel();
        this._startDurationTimer();
        this._showNotification('New session created', 'success');

        if (this.config.onSessionChange) {
          this.config.onSessionChange(response.session);
        }
      }
    } catch (error) {
      this._log('error', 'Failed to create session:', error);
      this._showNotification('Failed to create session', 'error');
    }
  }

  /**
   * Toggle session pause state
   * @private
   */
  async _togglePause() {
    if (!this.state.activeSession) return;

    const newStatus = this.state.sessionStatus === SessionStatus.PAUSED
      ? SessionStatus.ACTIVE
      : SessionStatus.PAUSED;

    try {
      await this._sendMessage({
        type: 'update_session',
        sessionId: this.state.activeSession.id,
        data: { isPaused: newStatus === SessionStatus.PAUSED }
      });

      this.state.sessionStatus = newStatus;
      this._updatePanel();
      this._showNotification(
        newStatus === SessionStatus.PAUSED ? 'Session paused' : 'Session resumed',
        'success'
      );
    } catch (error) {
      this._log('error', 'Failed to toggle pause:', error);
    }
  }

  /**
   * Close the current session
   * @private
   */
  async _closeSession() {
    if (!this.state.activeSession) return;

    try {
      await this._sendMessage({
        type: 'close_session',
        sessionId: this.state.activeSession.id
      });

      this.state.activeSession = null;
      this.state.sessionStatus = SessionStatus.CLOSED;
      this.state.evidenceItems = [];
      this._updatePanel();
      this._showNotification('Session closed', 'success');

      if (this.config.onSessionChange) {
        this.config.onSessionChange(null);
      }
    } catch (error) {
      this._log('error', 'Failed to close session:', error);
      this._showNotification('Failed to close session', 'error');
    }
  }

  /**
   * Switch to a different session
   * @private
   * @param {string} sessionId - Session ID to switch to
   */
  async _switchSession(sessionId) {
    try {
      const response = await this._sendMessage({
        type: 'switch_session',
        sessionId: sessionId
      });

      if (response && response.success) {
        this.state.activeSession = response.session;
        this.state.sessionStatus = response.session.isPaused ? SessionStatus.PAUSED : SessionStatus.ACTIVE;
        this.state.evidenceItems = response.session.evidence || [];
        this.state.sessionSwitcherOpen = false;
        this._updatePanel();
        this._showNotification('Switched to session', 'success');

        if (this.config.onSessionChange) {
          this.config.onSessionChange(response.session);
        }
      }
    } catch (error) {
      this._log('error', 'Failed to switch session:', error);
    }
  }

  /**
   * Export session data
   * @private
   * @param {string} format - Export format ('json' or 'pdf')
   */
  async _exportSession(format) {
    if (!this.state.activeSession) return;

    try {
      await this._sendMessage({
        type: 'export_session',
        sessionId: this.state.activeSession.id,
        format: format
      });

      this._showNotification(`Exporting as ${format.toUpperCase()}...`, 'success');

      if (this.config.onExport) {
        this.config.onExport(this.state.activeSession, format);
      }
    } catch (error) {
      this._log('error', 'Failed to export session:', error);
      this._showNotification('Export failed', 'error');
    }
  }

  // ===========================================================================
  // Private Methods - Evidence Operations
  // ===========================================================================

  /**
   * Capture screenshot
   * @private
   */
  async _captureScreenshot() {
    if (!this.state.activeSession || this.state.sessionStatus === SessionStatus.PAUSED) {
      this._showNotification('Cannot capture - session paused or inactive', 'error');
      return;
    }

    try {
      this._showNotification('Capturing screenshot...');

      const response = await this._sendMessage({
        type: 'capture_screenshot',
        sessionId: this.state.activeSession.id
      });

      if (response && response.success) {
        this._addEvidenceItem(response.evidence);
        this._showNotification('Screenshot captured', 'success');

        if (this.config.onCapture) {
          this.config.onCapture(response.evidence);
        }
      }
    } catch (error) {
      this._log('error', 'Failed to capture screenshot:', error);
      this._showNotification('Capture failed', 'error');
    }
  }

  /**
   * Start element capture mode
   * @private
   */
  async _startElementCapture() {
    if (!this.state.activeSession || this.state.sessionStatus === SessionStatus.PAUSED) {
      this._showNotification('Cannot capture - session paused or inactive', 'error');
      return;
    }

    try {
      await this._sendMessage({
        type: 'start_element_picker',
        sessionId: this.state.activeSession.id
      });

      this._showNotification('Click on an element to capture');
    } catch (error) {
      this._log('error', 'Failed to start element capture:', error);
    }
  }

  /**
   * Add a note to the session
   * @private
   * @param {string} noteText - Note text
   */
  async _addNote(noteText) {
    if (!this.state.activeSession || !noteText.trim()) return;

    try {
      const response = await this._sendMessage({
        type: 'add_note',
        sessionId: this.state.activeSession.id,
        note: noteText.trim()
      });

      if (response && response.success) {
        this._addEvidenceItem({
          id: response.noteId || Date.now().toString(),
          type: 'note',
          description: noteText.trim(),
          timestamp: new Date().toISOString()
        });
        this._showNotification('Note added', 'success');
      }
    } catch (error) {
      this._log('error', 'Failed to add note:', error);
      this._showNotification('Failed to add note', 'error');
    }
  }

  /**
   * Add evidence item to the list
   * @private
   * @param {Object} evidence - Evidence item
   */
  _addEvidenceItem(evidence) {
    if (!evidence) return;
    this.state.evidenceItems.push(evidence);
    this._updatePanel();
  }

  /**
   * View evidence details
   * @private
   * @param {string} evidenceId - Evidence ID
   */
  _viewEvidence(evidenceId) {
    this._sendMessage({
      type: 'view_evidence',
      evidenceId: evidenceId
    });
  }

  /**
   * View all evidence in full browser
   * @private
   */
  _viewAllEvidence() {
    this._sendMessage({
      type: 'open_evidence_browser',
      sessionId: this.state.activeSession ? this.state.activeSession.id : null
    });
  }

  // ===========================================================================
  // Private Methods - UI Updates
  // ===========================================================================

  /**
   * Update panel content
   * @private
   */
  _updatePanel() {
    if (!this.elements.panel) return;
    this.elements.panel.innerHTML = this._getPanelHTML();

    // Re-add notification element
    const notification = document.createElement('div');
    notification.className = 'session-panel-notification';
    this.elements.panel.appendChild(notification);
    this.elements.notification = notification;

    this._attachPanelEventListeners();
  }

  /**
   * Toggle minimize state
   * @private
   */
  _toggleMinimize() {
    this.state.isMinimized = !this.state.isMinimized;
    this.elements.panel.classList.toggle('minimized', this.state.isMinimized);
    this._saveState();
  }

  /**
   * Set initial panel position
   * @private
   * @param {HTMLElement} panel - Panel element
   */
  _setInitialPosition(panel) {
    const positions = {
      'bottom-right': { bottom: '20px', right: '20px' },
      'bottom-left': { bottom: '20px', left: '20px' },
      'top-right': { top: '20px', right: '20px' },
      'top-left': { top: '20px', left: '20px' }
    };

    const pos = positions[this.config.position] || positions['bottom-right'];

    if (this.state.position.x && this.state.position.y) {
      panel.style.left = this.state.position.x + 'px';
      panel.style.top = this.state.position.y + 'px';
    } else {
      Object.assign(panel.style, pos);
    }
  }

  /**
   * Show notification message
   * @private
   * @param {string} message - Message text
   * @param {string} type - Notification type
   */
  _showNotification(message, type = '') {
    if (!this.elements.notification) return;

    // Clear existing timer
    if (this._notificationTimer) {
      clearTimeout(this._notificationTimer);
    }

    this.elements.notification.textContent = message;
    this.elements.notification.className = 'session-panel-notification visible ' + type;

    this._notificationTimer = setTimeout(() => {
      this.elements.notification.classList.remove('visible');
    }, 3000);
  }

  // ===========================================================================
  // Private Methods - Utilities
  // ===========================================================================

  /**
   * Start duration timer
   * @private
   */
  _startDurationTimer() {
    if (this._durationTimer) {
      clearInterval(this._durationTimer);
    }

    this._durationTimer = setInterval(() => {
      if (this.state.activeSession && this.state.sessionStatus === SessionStatus.ACTIVE) {
        this.state.sessionDuration++;
        const durationEl = this.elements.panel.querySelector('[data-duration]');
        if (durationEl) {
          durationEl.textContent = this._formatDuration(this.state.sessionDuration);
        }
      }
    }, 1000);
  }

  /**
   * Format duration in seconds to HH:MM:SS
   * @private
   * @param {number} seconds - Duration in seconds
   * @returns {string} Formatted duration
   */
  _formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
  }

  /**
   * Send message to chrome runtime
   * @private
   * @param {Object} message - Message object
   * @returns {Promise} Response promise
   */
  _sendMessage(message) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(response);
          }
        });
      } else {
        resolve({ success: false, error: 'Chrome runtime not available' });
      }
    });
  }

  /**
   * Load saved state from storage
   * @private
   */
  async _loadState() {
    try {
      const result = await this._sendMessage({
        type: 'storage_get',
        key: DEFAULT_CONFIG.storageKey
      });

      if (result && result.success && result.data) {
        const savedState = result.data;
        if (savedState.position) {
          this.state.position = savedState.position;
        }
        if (savedState.isMinimized !== undefined) {
          this.state.isMinimized = savedState.isMinimized;
        }
        if (savedState.isVisible !== undefined) {
          this.state.isVisible = savedState.isVisible;
        }
      }
    } catch (error) {
      this._log('warn', 'Failed to load state:', error);
    }

    // Apply loaded state
    if (this.state.isVisible) {
      this.elements.panel.classList.add('visible');
    }
    if (this.state.isMinimized) {
      this.elements.panel.classList.add('minimized');
    }
    this._setInitialPosition(this.elements.panel);
  }

  /**
   * Save state to storage
   * @private
   */
  async _saveState() {
    try {
      await this._sendMessage({
        type: 'storage_set',
        key: DEFAULT_CONFIG.storageKey,
        value: {
          position: this.state.position,
          isMinimized: this.state.isMinimized,
          isVisible: this.state.isVisible
        }
      });
    } catch (error) {
      this._log('warn', 'Failed to save state:', error);
    }
  }

  /**
   * Escape HTML special characters
   * @private
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Log message
   * @private
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {*} data - Additional data
   */
  _log(level, message, data) {
    if (this.config.logger && this.config.logger[level]) {
      this.config.logger[level](message, data);
    } else if (console[level]) {
      console[level]('[SessionPanel]', message, data);
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a SessionPanel instance
 * @param {Object} options - Configuration options
 * @returns {SessionPanel} New instance
 */
function createSessionPanel(options = {}) {
  return new SessionPanel(options);
}

// =============================================================================
// Global Instance
// =============================================================================

let sessionPanelInstance = null;

/**
 * Get or create the global SessionPanel instance
 * @param {Object} options - Configuration options
 * @returns {SessionPanel} Global instance
 */
function getSessionPanel(options = {}) {
  if (!sessionPanelInstance) {
    sessionPanelInstance = new SessionPanel(options);
  }
  return sessionPanelInstance;
}

// =============================================================================
// Exports
// =============================================================================

if (typeof globalThis !== 'undefined') {
  globalThis.SessionStatus = SessionStatus;
  globalThis.SessionPanel = SessionPanel;
  globalThis.createSessionPanel = createSessionPanel;
  globalThis.getSessionPanel = getSessionPanel;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SessionStatus,
    SessionPanel,
    createSessionPanel,
    getSessionPanel
  };
}
