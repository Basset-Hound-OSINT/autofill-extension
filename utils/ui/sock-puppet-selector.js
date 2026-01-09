/**
 * Basset Hound Browser Automation - Sock Puppet Selector UI
 * Phase 10.1: Sock Puppet Integration
 *
 * Provides UI components for sock puppet identity management:
 * - View available sock puppets from basset-hound API
 * - Select active identity for operations
 * - Display identity details (name, backstory summary)
 * - Quick switch between identities
 * - Status indicator for currently active identity
 */

// =============================================================================
// Sock Puppet Selector Styles (Shadow DOM compatible)
// =============================================================================

const SOCK_PUPPET_SELECTOR_STYLES = `
  :host {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  * {
    box-sizing: border-box;
  }

  .basset-puppet-toggle {
    position: fixed;
    bottom: 80px;
    right: 20px;
    z-index: 999998;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: linear-gradient(135deg, #6b46c1 0%, #553c9a 100%);
    color: white;
    border: none;
    border-radius: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(107, 70, 193, 0.4);
    transition: all 0.3s ease;
  }

  .basset-puppet-toggle:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(107, 70, 193, 0.5);
  }

  .basset-puppet-toggle-icon { width: 18px; height: 18px; }

  .basset-puppet-toggle-indicator {
    width: 8px; height: 8px; border-radius: 50%;
    background: #4ade80; animation: pulse 2s infinite;
  }

  .basset-puppet-toggle-indicator.inactive { background: #888; animation: none; }

  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

  .basset-puppet-panel {
    position: fixed; bottom: 130px; right: 20px; z-index: 999999;
    width: 340px; max-height: 480px; background: #1e1e1e; color: #e0e0e0;
    border-radius: 12px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    display: flex; flex-direction: column; overflow: hidden;
    opacity: 0; visibility: hidden; transform: translateY(10px) scale(0.95);
    transition: all 0.25s ease;
  }

  .basset-puppet-panel.visible { opacity: 1; visibility: visible; transform: translateY(0) scale(1); }

  .basset-puppet-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; background: #252525; border-bottom: 1px solid #333;
  }

  .basset-puppet-header-title {
    display: flex; align-items: center; gap: 10px;
    font-size: 14px; font-weight: 600; color: #fff;
  }

  .basset-puppet-close {
    background: none; border: none; color: #888; font-size: 20px;
    cursor: pointer; padding: 4px; transition: color 0.2s;
  }

  .basset-puppet-close:hover { color: #fff; }

  .basset-puppet-active {
    padding: 14px 16px;
    background: linear-gradient(135deg, rgba(107, 70, 193, 0.15) 0%, rgba(85, 60, 154, 0.1) 100%);
    border-bottom: 1px solid #333;
  }

  .basset-puppet-active-label {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
    color: #888; margin-bottom: 8px;
  }

  .basset-puppet-active-info { display: flex; align-items: center; gap: 12px; }

  .basset-puppet-active-avatar {
    width: 44px; height: 44px; border-radius: 50%;
    background: linear-gradient(135deg, #6b46c1 0%, #553c9a 100%);
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 600; color: white; flex-shrink: 0;
  }

  .basset-puppet-active-details { flex: 1; min-width: 0; }

  .basset-puppet-active-name {
    font-size: 15px; font-weight: 600; color: #fff; margin-bottom: 2px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .basset-puppet-active-backstory {
    font-size: 12px; color: #888;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }

  .basset-puppet-no-active { font-size: 13px; color: #888; font-style: italic; }

  .basset-puppet-list { flex: 1; overflow-y: auto; padding: 8px 0; max-height: 280px; }

  .basset-puppet-list-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 16px; font-size: 11px; color: #888;
    text-transform: uppercase; letter-spacing: 0.5px;
  }

  .basset-puppet-refresh { background: none; border: none; color: #888; cursor: pointer; padding: 4px; transition: color 0.2s; }
  .basset-puppet-refresh:hover { color: #6b46c1; }
  .basset-puppet-refresh.loading svg { animation: spin 1s linear infinite; }

  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  .basset-puppet-item {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 16px; cursor: pointer; transition: background 0.2s;
    border-left: 3px solid transparent;
  }

  .basset-puppet-item:hover { background: #252525; }
  .basset-puppet-item.active { background: rgba(107, 70, 193, 0.1); border-left-color: #6b46c1; }

  .basset-puppet-item-avatar {
    width: 36px; height: 36px; border-radius: 50%; background: #333;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 600; color: #888; flex-shrink: 0;
  }

  .basset-puppet-item.active .basset-puppet-item-avatar {
    background: linear-gradient(135deg, #6b46c1 0%, #553c9a 100%); color: white;
  }

  .basset-puppet-item-details { flex: 1; min-width: 0; }

  .basset-puppet-item-name {
    font-size: 13px; font-weight: 500; color: #e0e0e0; margin-bottom: 2px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .basset-puppet-item-meta { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #666; }
  .basset-puppet-item-platform { background: #333; padding: 1px 6px; border-radius: 3px; }
  .basset-puppet-item-status { display: flex; align-items: center; gap: 4px; }
  .basset-puppet-item-status-dot { width: 6px; height: 6px; border-radius: 50%; }
  .basset-puppet-item-status-dot.active { background: #4ade80; }
  .basset-puppet-item-status-dot.inactive { background: #888; }
  .basset-puppet-item-status-dot.warning { background: #fbbf24; }

  .basset-puppet-loading {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 40px 20px; color: #888;
  }

  .basset-puppet-loading-spinner {
    width: 32px; height: 32px; border: 3px solid #333; border-top-color: #6b46c1;
    border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 12px;
  }

  .basset-puppet-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 40px 20px; text-align: center; color: #888;
  }

  .basset-puppet-empty-icon { font-size: 40px; margin-bottom: 12px; opacity: 0.5; }
  .basset-puppet-empty-text { font-size: 13px; margin-bottom: 16px; }
  .basset-puppet-empty-btn {
    background: #333; border: none; color: #e0e0e0; padding: 8px 16px;
    border-radius: 6px; font-size: 12px; cursor: pointer; transition: background 0.2s;
  }
  .basset-puppet-empty-btn:hover { background: #444; }

  .basset-puppet-error {
    display: flex; flex-direction: column; align-items: center;
    padding: 20px; text-align: center;
    background: rgba(239, 68, 68, 0.1); border-top: 1px solid rgba(239, 68, 68, 0.2);
  }
  .basset-puppet-error-text { font-size: 12px; color: #f87171; margin-bottom: 12px; }
  .basset-puppet-error-retry { background: #333; border: none; color: #e0e0e0; padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; }

  .basset-puppet-footer {
    padding: 12px 16px; background: #252525; border-top: 1px solid #333;
    display: flex; align-items: center; justify-content: space-between;
  }

  .basset-puppet-footer-info { font-size: 11px; color: #666; }
  .basset-puppet-deactivate {
    background: none; border: 1px solid #444; color: #888;
    padding: 6px 12px; border-radius: 6px; font-size: 11px;
    cursor: pointer; transition: all 0.2s;
  }
  .basset-puppet-deactivate:hover { border-color: #f87171; color: #f87171; }

  .basset-puppet-list::-webkit-scrollbar { width: 6px; }
  .basset-puppet-list::-webkit-scrollbar-track { background: transparent; }
  .basset-puppet-list::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
  .basset-puppet-list::-webkit-scrollbar-thumb:hover { background: #555; }
`;

class SockPuppetSelector {
  constructor(options) {
    options = options || {};
    this.config = {
      apiBaseUrl: options.apiBaseUrl || 'http://localhost:8000',
      showToggle: options.showToggle !== false,
      onSelect: options.onSelect || null,
      onDeactivate: options.onDeactivate || null,
      onError: options.onError || null,
      logger: options.logger || null
    };

    this.state = {
      isOpen: false,
      isLoading: false,
      sockPuppets: [],
      activeIdentity: null,
      error: null,
      lastFetched: null
    };

    this.shadowHost = null;
    this.shadowRoot = null;

    this._init();
  }

  async _init() {
    this._createShadowHost();
    await this._loadActiveIdentity();
    if (this.config.showToggle) this._renderToggleButton();
    this._renderPanel();
    await this.fetchSockPuppets();
  }

  _createShadowHost() {
    this.shadowHost = document.createElement('div');
    this.shadowHost.id = 'basset-sock-puppet-selector';
    this.shadowHost.style.cssText = 'all: initial; position: fixed; z-index: 999998;';
    document.body.appendChild(this.shadowHost);

    this.shadowRoot = this.shadowHost.attachShadow({ mode: 'open' });

    var styleEl = document.createElement('style');
    styleEl.textContent = SOCK_PUPPET_SELECTOR_STYLES;
    this.shadowRoot.appendChild(styleEl);
  }

  _renderToggleButton() {
    var self = this;
    var button = document.createElement('button');
    button.className = 'basset-puppet-toggle';
    var indicatorClass = this.state.activeIdentity ? '' : 'inactive';
    button.innerHTML = '<svg class="basset-puppet-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span class="basset-puppet-toggle-text">Identity</span><span class="basset-puppet-toggle-indicator ' + indicatorClass + '"></span>';
    button.addEventListener('click', function() { self.toggle(); });
    this.shadowRoot.appendChild(button);
    this.toggleButton = button;
  }

  _renderPanel() {
    var panel = document.createElement('div');
    panel.className = 'basset-puppet-panel';
    panel.innerHTML = this._getPanelHTML();
    this.shadowRoot.appendChild(panel);
    this.panel = panel;
    this._attachPanelEventListeners();
  }

  _getPanelHTML() {
    var errorHtml = this.state.error ? this._getErrorHTML() : '';
    var deactivateBtn = this.state.activeIdentity ? '<button class="basset-puppet-deactivate">Deactivate</button>' : '';
    var countWord = this.state.sockPuppets.length === 1 ? 'y' : 'ies';

    return '<div class="basset-puppet-header"><div class="basset-puppet-header-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Sock Puppet Identities</div><button class="basset-puppet-close">&times;</button></div><div class="basset-puppet-active">' + this._getActiveIdentityHTML() + '</div><div class="basset-puppet-list-header"><span>Available Identities</span><button class="basset-puppet-refresh" title="Refresh list"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></button></div><div class="basset-puppet-list">' + this._getListContentHTML() + '</div>' + errorHtml + '<div class="basset-puppet-footer"><span class="basset-puppet-footer-info">' + this.state.sockPuppets.length + ' identit' + countWord + ' available</span>' + deactivateBtn + '</div>';
  }

  _getActiveIdentityHTML() {
    var identity = this.state.activeIdentity;
    if (!identity) return '<div class="basset-puppet-active-label">Current Identity</div><div class="basset-puppet-no-active">No identity selected</div>';
    var initials = this._getInitials(identity.name || identity.display_name);
    var backstorySummary = this._truncateText(identity.backstory || identity.bio || '', 80);
    return '<div class="basset-puppet-active-label">Current Identity</div><div class="basset-puppet-active-info"><div class="basset-puppet-active-avatar">' + initials + '</div><div class="basset-puppet-active-details"><div class="basset-puppet-active-name">' + this._escapeHtml(identity.name || identity.display_name) + '</div><div class="basset-puppet-active-backstory">' + this._escapeHtml(backstorySummary) + '</div></div></div>';
  }

  _getListContentHTML() {
    var self = this;
    if (this.state.isLoading) return '<div class="basset-puppet-loading"><div class="basset-puppet-loading-spinner"></div><span>Loading identities...</span></div>';
    if (this.state.sockPuppets.length === 0) return '<div class="basset-puppet-empty"><div class="basset-puppet-empty-icon">&#128100;</div><div class="basset-puppet-empty-text">No sock puppets configured</div><button class="basset-puppet-empty-btn">Refresh</button></div>';
    return this.state.sockPuppets.map(function(puppet) { return self._getItemHTML(puppet); }).join('');
  }

  _getItemHTML(puppet) {
    var isActive = this.state.activeIdentity && this.state.activeIdentity.id === puppet.id;
    var initials = this._getInitials(puppet.name || puppet.display_name);
    var platforms = puppet.platforms ? puppet.platforms.slice(0, 2).join(', ') : '';
    var status = puppet.status || 'active';
    var activeClass = isActive ? 'active' : '';
    var platformHtml = platforms ? '<span class="basset-puppet-item-platform">' + this._escapeHtml(platforms) + '</span>' : '';
    return '<div class="basset-puppet-item ' + activeClass + '" data-id="' + puppet.id + '"><div class="basset-puppet-item-avatar">' + initials + '</div><div class="basset-puppet-item-details"><div class="basset-puppet-item-name">' + this._escapeHtml(puppet.name || puppet.display_name) + '</div><div class="basset-puppet-item-meta">' + platformHtml + '<span class="basset-puppet-item-status"><span class="basset-puppet-item-status-dot ' + status + '"></span>' + status + '</span></div></div></div>';
  }

  _getErrorHTML() {
    return '<div class="basset-puppet-error"><div class="basset-puppet-error-text">' + this._escapeHtml(this.state.error) + '</div><button class="basset-puppet-error-retry">Retry</button></div>';
  }

  _attachPanelEventListeners() {
    var self = this;
    var closeBtn = this.panel.querySelector('.basset-puppet-close');
    if (closeBtn) closeBtn.addEventListener('click', function() { self.hide(); });
    var refreshBtn = this.panel.querySelector('.basset-puppet-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', function() { self.fetchSockPuppets(); });
    var deactivateBtn = this.panel.querySelector('.basset-puppet-deactivate');
    if (deactivateBtn) deactivateBtn.addEventListener('click', function() { self.deactivateIdentity(); });
    var emptyBtn = this.panel.querySelector('.basset-puppet-empty-btn');
    if (emptyBtn) emptyBtn.addEventListener('click', function() { self.fetchSockPuppets(); });
    var retryBtn = this.panel.querySelector('.basset-puppet-error-retry');
    if (retryBtn) retryBtn.addEventListener('click', function() { self.fetchSockPuppets(); });
    var items = this.panel.querySelectorAll('.basset-puppet-item');
    items.forEach(function(item) {
      item.addEventListener('click', function() {
        var id = item.dataset.id;
        var puppet = self.state.sockPuppets.find(function(p) { return p.id === id; });
        if (puppet) self.selectIdentity(puppet);
      });
    });
  }

  _updatePanel() {
    if (!this.panel) return;
    var activeSection = this.panel.querySelector('.basset-puppet-active');
    if (activeSection) activeSection.innerHTML = this._getActiveIdentityHTML();
    var list = this.panel.querySelector('.basset-puppet-list');
    if (list) list.innerHTML = this._getListContentHTML();
    var footer = this.panel.querySelector('.basset-puppet-footer');
    if (footer) {
      var countWord = this.state.sockPuppets.length === 1 ? 'y' : 'ies';
      var deactivateBtn = this.state.activeIdentity ? '<button class="basset-puppet-deactivate">Deactivate</button>' : '';
      footer.innerHTML = '<span class="basset-puppet-footer-info">' + this.state.sockPuppets.length + ' identit' + countWord + ' available</span>' + deactivateBtn;
    }
    if (this.toggleButton) {
      var indicator = this.toggleButton.querySelector('.basset-puppet-toggle-indicator');
      if (indicator) indicator.className = 'basset-puppet-toggle-indicator ' + (this.state.activeIdentity ? '' : 'inactive');
    }
    this._attachPanelEventListeners();
  }

  show() { if (this.panel) { this.panel.classList.add('visible'); this.state.isOpen = true; } }
  hide() { if (this.panel) { this.panel.classList.remove('visible'); this.state.isOpen = false; } }
  toggle() { if (this.state.isOpen) this.hide(); else this.show(); }

  async fetchSockPuppets() {
    var self = this;
    this.state.isLoading = true;
    this.state.error = null;
    this._updatePanel();
    var refreshBtn = this.panel ? this.panel.querySelector('.basset-puppet-refresh') : null;
    if (refreshBtn) refreshBtn.classList.add('loading');
    try {
      var response = await this._sendMessage({ type: 'fetch_sock_puppets', apiBaseUrl: this.config.apiBaseUrl });
      if (response && response.success && response.data) {
        this.state.sockPuppets = response.data;
        this.state.lastFetched = Date.now();
      } else if (response && response.error) {
        throw new Error(response.error);
      } else {
        var result = await this._fetchDirect();
        this.state.sockPuppets = result;
        this.state.lastFetched = Date.now();
      }
    } catch (error) {
      this.state.error = error.message || 'Failed to fetch sock puppets';
      this._log('error', 'Failed to fetch sock puppets:', error);
      if (this.config.onError) this.config.onError(error);
    } finally {
      this.state.isLoading = false;
      if (refreshBtn) refreshBtn.classList.remove('loading');
      this._updatePanel();
    }
    return this.state.sockPuppets;
  }

  async _fetchDirect() {
    var response = await fetch(this.config.apiBaseUrl + '/api/v1/sock-puppets', { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    if (!response.ok) throw new Error('API error: ' + response.status + ' ' + response.statusText);
    var data = await response.json();
    return data.sock_puppets || data.data || data;
  }

  async selectIdentity(puppet) {
    if (!puppet) return { success: false, error: 'No puppet provided' };
    try {
      this.state.activeIdentity = puppet;
      await this._saveActiveIdentity(puppet);
      await this._sendMessage({ type: 'set_active_sock_puppet', puppet: puppet });
      this._updatePanel();
      if (this.config.onSelect) this.config.onSelect(puppet);
      this._log('info', 'Selected sock puppet identity:', puppet.name);
      return { success: true, identity: puppet };
    } catch (error) {
      this._log('error', 'Failed to select identity:', error);
      return { success: false, error: error.message };
    }
  }

  async deactivateIdentity() {
    try {
      var previousIdentity = this.state.activeIdentity;
      this.state.activeIdentity = null;
      await this._clearActiveIdentity();
      await this._sendMessage({ type: 'clear_active_sock_puppet' });
      this._updatePanel();
      if (this.config.onDeactivate) this.config.onDeactivate(previousIdentity);
      this._log('info', 'Deactivated sock puppet identity');
      return { success: true };
    } catch (error) {
      this._log('error', 'Failed to deactivate identity:', error);
      return { success: false, error: error.message };
    }
  }

  getActiveIdentity() { return this.state.activeIdentity; }
  getSockPuppets() { return this.state.sockPuppets.slice(); }
  destroy() { if (this.shadowHost) this.shadowHost.remove(); this.shadowHost = null; this.shadowRoot = null; this.panel = null; this.toggleButton = null; }

  async _loadActiveIdentity() {
    var self = this;
    try {
      var result = await this._sendMessage({ type: 'storage_get', key: 'activeSockPuppet' });
      if (result && result.success && result.data) this.state.activeIdentity = result.data;
      else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        var stored = await new Promise(function(resolve) { chrome.storage.local.get('activeSockPuppet', resolve); });
        if (stored.activeSockPuppet) self.state.activeIdentity = stored.activeSockPuppet;
      }
    } catch (error) { this._log('warn', 'Failed to load active identity from storage:', error); }
  }

  async _saveActiveIdentity(puppet) {
    try { await this._sendMessage({ type: 'storage_set', key: 'activeSockPuppet', value: puppet }); }
    catch (error) { if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) await new Promise(function(resolve) { chrome.storage.local.set({ activeSockPuppet: puppet }, resolve); }); }
  }

  async _clearActiveIdentity() {
    try { await this._sendMessage({ type: 'storage_remove', key: 'activeSockPuppet' }); }
    catch (error) { if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) await new Promise(function(resolve) { chrome.storage.local.remove('activeSockPuppet', resolve); }); }
  }

  _sendMessage(message) {
    return new Promise(function(resolve) {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(message, function(response) {
          if (chrome.runtime.lastError) resolve({ success: false, error: chrome.runtime.lastError.message });
          else resolve(response);
        });
      } else resolve({ success: false, error: 'Chrome runtime not available' });
    });
  }

  _getInitials(name) {
    if (!name) return '?';
    var parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  _truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '...';
  }

  _escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  _log(level, message, data) {
    if (this.config.logger && this.config.logger[level]) this.config.logger[level](message, data);
    else if (console[level]) console[level]('[SockPuppetSelector]', message, data);
  }
}

if (typeof globalThis !== 'undefined') globalThis.SockPuppetSelector = SockPuppetSelector;
if (typeof module !== 'undefined' && module.exports) module.exports = { SockPuppetSelector: SockPuppetSelector };
