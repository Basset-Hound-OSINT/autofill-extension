/**
 * Unit Tests for SockPuppetSelector UI Component
 * Phase 10.1: Sock Puppet Integration
 */

const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');

// Mock chrome API
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    lastError: null
  },
  storage: {
    local: {
      get: jest.fn((key, callback) => callback({})),
      set: jest.fn((data, callback) => callback && callback()),
      remove: jest.fn((key, callback) => callback && callback())
    }
  }
};

// Mock fetch API
global.fetch = jest.fn();

// Mock document and DOM methods
const mockShadowRoot = {
  appendChild: jest.fn(),
  querySelector: jest.fn(() => null),
  querySelectorAll: jest.fn(() => [])
};

const mockElement = {
  id: '',
  className: '',
  style: { cssText: '' },
  innerHTML: '',
  textContent: '',
  classList: {
    add: jest.fn(),
    remove: jest.fn()
  },
  addEventListener: jest.fn(),
  querySelector: jest.fn(() => null),
  querySelectorAll: jest.fn(() => []),
  remove: jest.fn(),
  attachShadow: jest.fn(() => mockShadowRoot),
  dataset: {}
};

global.document = {
  createElement: jest.fn(() => ({ ...mockElement })),
  body: {
    appendChild: jest.fn()
  }
};

// =============================================================================
// Import the module
// =============================================================================

describe('SockPuppetSelector', () => {
  let SockPuppetSelector;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Reset chrome.runtime.lastError
    global.chrome.runtime.lastError = null;

    // Load the module
    const module = require('../../utils/ui/sock-puppet-selector.js');
    SockPuppetSelector = module.SockPuppetSelector;
  });

  describe('Constructor', () => {
    it('should create instance with default options', () => {
      const selector = new SockPuppetSelector();

      expect(selector.config.apiBaseUrl).toBe('http://localhost:8000');
      expect(selector.config.showToggle).toBe(true);
      expect(selector.config.onSelect).toBeNull();
      expect(selector.config.onDeactivate).toBeNull();
      expect(selector.config.onError).toBeNull();
    });

    it('should create instance with custom options', () => {
      const onSelect = jest.fn();
      const onDeactivate = jest.fn();
      const onError = jest.fn();

      const selector = new SockPuppetSelector({
        apiBaseUrl: 'http://custom-api.example.com',
        showToggle: false,
        onSelect: onSelect,
        onDeactivate: onDeactivate,
        onError: onError
      });

      expect(selector.config.apiBaseUrl).toBe('http://custom-api.example.com');
      expect(selector.config.showToggle).toBe(false);
      expect(selector.config.onSelect).toBe(onSelect);
      expect(selector.config.onDeactivate).toBe(onDeactivate);
      expect(selector.config.onError).toBe(onError);
    });

    it('should initialize state correctly', () => {
      const selector = new SockPuppetSelector();

      expect(selector.state.isOpen).toBe(false);
      expect(selector.state.isLoading).toBe(false);
      expect(selector.state.sockPuppets).toEqual([]);
      expect(selector.state.activeIdentity).toBeNull();
      expect(selector.state.error).toBeNull();
      expect(selector.state.lastFetched).toBeNull();
    });
  });

  describe('_getInitials', () => {
    it('should return initials for single name', () => {
      const selector = new SockPuppetSelector();
      expect(selector._getInitials('John')).toBe('J');
    });

    it('should return initials for full name', () => {
      const selector = new SockPuppetSelector();
      expect(selector._getInitials('John Doe')).toBe('JD');
    });

    it('should return initials for name with middle name', () => {
      const selector = new SockPuppetSelector();
      expect(selector._getInitials('John Michael Doe')).toBe('JD');
    });

    it('should return ? for empty name', () => {
      const selector = new SockPuppetSelector();
      expect(selector._getInitials('')).toBe('?');
      expect(selector._getInitials(null)).toBe('?');
      expect(selector._getInitials(undefined)).toBe('?');
    });

    it('should handle names with extra whitespace', () => {
      const selector = new SockPuppetSelector();
      expect(selector._getInitials('  John   Doe  ')).toBe('JD');
    });

    it('should uppercase initials', () => {
      const selector = new SockPuppetSelector();
      expect(selector._getInitials('john doe')).toBe('JD');
    });
  });

  describe('_truncateText', () => {
    it('should not truncate short text', () => {
      const selector = new SockPuppetSelector();
      expect(selector._truncateText('Hello', 10)).toBe('Hello');
    });

    it('should truncate long text', () => {
      const selector = new SockPuppetSelector();
      expect(selector._truncateText('Hello World', 8)).toBe('Hello Wo...');
    });

    it('should handle empty text', () => {
      const selector = new SockPuppetSelector();
      expect(selector._truncateText('', 10)).toBe('');
      expect(selector._truncateText(null, 10)).toBeNull();
      expect(selector._truncateText(undefined, 10)).toBeUndefined();
    });

    it('should handle exact length', () => {
      const selector = new SockPuppetSelector();
      expect(selector._truncateText('Hello', 5)).toBe('Hello');
    });
  });

  describe('_escapeHtml', () => {
    it('should escape HTML entities', () => {
      const selector = new SockPuppetSelector();

      // Create a mock div element for testing
      const mockDiv = {
        textContent: '',
        innerHTML: ''
      };

      // Override createElement temporarily
      const originalCreate = document.createElement;
      document.createElement = jest.fn(() => {
        const div = { ...mockDiv };
        Object.defineProperty(div, 'textContent', {
          set: function(val) { this._text = val; this.innerHTML = val.replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); },
          get: function() { return this._text; }
        });
        return div;
      });

      const result = selector._escapeHtml('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');

      document.createElement = originalCreate;
    });

    it('should return empty string for empty input', () => {
      const selector = new SockPuppetSelector();
      expect(selector._escapeHtml('')).toBe('');
      expect(selector._escapeHtml(null)).toBe('');
      expect(selector._escapeHtml(undefined)).toBe('');
    });
  });

  describe('show/hide/toggle', () => {
    it('should show panel', () => {
      const selector = new SockPuppetSelector();
      selector.panel = {
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        }
      };

      selector.show();

      expect(selector.panel.classList.add).toHaveBeenCalledWith('visible');
      expect(selector.state.isOpen).toBe(true);
    });

    it('should hide panel', () => {
      const selector = new SockPuppetSelector();
      selector.panel = {
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        }
      };
      selector.state.isOpen = true;

      selector.hide();

      expect(selector.panel.classList.remove).toHaveBeenCalledWith('visible');
      expect(selector.state.isOpen).toBe(false);
    });

    it('should toggle panel', () => {
      const selector = new SockPuppetSelector();
      selector.panel = {
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        }
      };

      // Initially closed, should open
      selector.toggle();
      expect(selector.state.isOpen).toBe(true);

      // Now open, should close
      selector.toggle();
      expect(selector.state.isOpen).toBe(false);
    });
  });

  describe('getSockPuppets', () => {
    it('should return copy of sock puppets array', () => {
      const selector = new SockPuppetSelector();
      const puppets = [
        { id: '1', name: 'John Doe' },
        { id: '2', name: 'Jane Doe' }
      ];
      selector.state.sockPuppets = puppets;

      const result = selector.getSockPuppets();

      expect(result).toEqual(puppets);
      expect(result).not.toBe(puppets); // Should be a copy
    });

    it('should return empty array when no puppets', () => {
      const selector = new SockPuppetSelector();
      expect(selector.getSockPuppets()).toEqual([]);
    });
  });

  describe('getActiveIdentity', () => {
    it('should return null when no active identity', () => {
      const selector = new SockPuppetSelector();
      expect(selector.getActiveIdentity()).toBeNull();
    });

    it('should return active identity when set', () => {
      const selector = new SockPuppetSelector();
      const identity = { id: '1', name: 'John Doe' };
      selector.state.activeIdentity = identity;

      expect(selector.getActiveIdentity()).toBe(identity);
    });
  });

  describe('selectIdentity', () => {
    it('should return error when no puppet provided', async () => {
      const selector = new SockPuppetSelector();
      const result = await selector.selectIdentity(null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No puppet provided');
    });

    it('should set active identity', async () => {
      const onSelect = jest.fn();
      const selector = new SockPuppetSelector({ onSelect });
      selector._updatePanel = jest.fn();

      const puppet = { id: '1', name: 'John Doe' };
      const result = await selector.selectIdentity(puppet);

      expect(result.success).toBe(true);
      expect(result.identity).toBe(puppet);
      expect(selector.state.activeIdentity).toBe(puppet);
      expect(onSelect).toHaveBeenCalledWith(puppet);
    });
  });

  describe('deactivateIdentity', () => {
    it('should clear active identity', async () => {
      const onDeactivate = jest.fn();
      const selector = new SockPuppetSelector({ onDeactivate });
      selector._updatePanel = jest.fn();

      const previousIdentity = { id: '1', name: 'John Doe' };
      selector.state.activeIdentity = previousIdentity;

      const result = await selector.deactivateIdentity();

      expect(result.success).toBe(true);
      expect(selector.state.activeIdentity).toBeNull();
      expect(onDeactivate).toHaveBeenCalledWith(previousIdentity);
    });
  });

  describe('fetchSockPuppets', () => {
    it('should fetch sock puppets via message', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({
          success: true,
          data: [
            { id: '1', name: 'John Doe' },
            { id: '2', name: 'Jane Doe' }
          ]
        });
      });

      const selector = new SockPuppetSelector();
      selector._updatePanel = jest.fn();
      selector.panel = { querySelector: jest.fn(() => null) };

      const result = await selector.fetchSockPuppets();

      expect(result.length).toBe(2);
      expect(selector.state.sockPuppets.length).toBe(2);
      expect(selector.state.isLoading).toBe(false);
    });

    it('should handle fetch error', async () => {
      const onError = jest.fn();
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: false, error: 'API error' });
      });

      const selector = new SockPuppetSelector({ onError });
      selector._updatePanel = jest.fn();
      selector.panel = { querySelector: jest.fn(() => null) };

      await selector.fetchSockPuppets();

      expect(selector.state.error).toBe('API error');
      expect(onError).toHaveBeenCalled();
    });

    it('should fallback to direct fetch when message fails', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: false });
      });

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          sock_puppets: [{ id: '1', name: 'John Doe' }]
        })
      });

      const selector = new SockPuppetSelector();
      selector._updatePanel = jest.fn();
      selector.panel = { querySelector: jest.fn(() => null) };

      const result = await selector.fetchSockPuppets();

      expect(result.length).toBe(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/sock-puppets',
        expect.any(Object)
      );
    });
  });

  describe('_fetchDirect', () => {
    it('should fetch directly from API', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          sock_puppets: [
            { id: '1', name: 'John Doe' }
          ]
        })
      });

      const selector = new SockPuppetSelector();
      const result = await selector._fetchDirect();

      expect(result).toEqual([{ id: '1', name: 'John Doe' }]);
    });

    it('should handle data field instead of sock_puppets', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: '1', name: 'John Doe' }]
        })
      });

      const selector = new SockPuppetSelector();
      const result = await selector._fetchDirect();

      expect(result).toEqual([{ id: '1', name: 'John Doe' }]);
    });

    it('should throw error on non-ok response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const selector = new SockPuppetSelector();

      await expect(selector._fetchDirect()).rejects.toThrow('API error: 500 Internal Server Error');
    });
  });

  describe('_sendMessage', () => {
    it('should send message to background script', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: true, data: 'test' });
      });

      const selector = new SockPuppetSelector();
      const result = await selector._sendMessage({ type: 'test' });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { type: 'test' },
        expect.any(Function)
      );
      expect(result).toEqual({ success: true, data: 'test' });
    });

    it('should handle runtime error', async () => {
      chrome.runtime.lastError = { message: 'Connection error' };
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback(undefined);
      });

      const selector = new SockPuppetSelector();
      const result = await selector._sendMessage({ type: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection error');

      chrome.runtime.lastError = null;
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      const selector = new SockPuppetSelector();
      selector.shadowHost = { remove: jest.fn() };
      selector.shadowRoot = {};
      selector.panel = {};
      selector.toggleButton = {};

      selector.destroy();

      expect(selector.shadowHost).toBeNull();
      expect(selector.shadowRoot).toBeNull();
      expect(selector.panel).toBeNull();
      expect(selector.toggleButton).toBeNull();
    });

    it('should handle null shadowHost', () => {
      const selector = new SockPuppetSelector();
      selector.shadowHost = null;

      expect(() => selector.destroy()).not.toThrow();
    });
  });

  describe('HTML generation', () => {
    it('should generate active identity HTML with identity', () => {
      const selector = new SockPuppetSelector();
      selector.state.activeIdentity = {
        name: 'John Doe',
        backstory: 'A test identity for development purposes'
      };

      const html = selector._getActiveIdentityHTML();

      expect(html).toContain('John Doe');
      expect(html).toContain('JD'); // Initials
      expect(html).toContain('A test identity');
    });

    it('should generate active identity HTML without identity', () => {
      const selector = new SockPuppetSelector();
      selector.state.activeIdentity = null;

      const html = selector._getActiveIdentityHTML();

      expect(html).toContain('No identity selected');
    });

    it('should generate list content with loading state', () => {
      const selector = new SockPuppetSelector();
      selector.state.isLoading = true;

      const html = selector._getListContentHTML();

      expect(html).toContain('Loading identities');
      expect(html).toContain('basset-puppet-loading-spinner');
    });

    it('should generate list content with empty state', () => {
      const selector = new SockPuppetSelector();
      selector.state.isLoading = false;
      selector.state.sockPuppets = [];

      const html = selector._getListContentHTML();

      expect(html).toContain('No sock puppets configured');
    });

    it('should generate item HTML', () => {
      const selector = new SockPuppetSelector();
      const puppet = {
        id: 'test-123',
        name: 'John Doe',
        platforms: ['Twitter', 'Facebook'],
        status: 'active'
      };

      const html = selector._getItemHTML(puppet);

      expect(html).toContain('test-123');
      expect(html).toContain('John Doe');
      expect(html).toContain('JD');
      expect(html).toContain('Twitter, Facebook');
      expect(html).toContain('active');
    });

    it('should mark active item', () => {
      const selector = new SockPuppetSelector();
      const puppet = { id: 'test-123', name: 'John Doe' };
      selector.state.activeIdentity = { id: 'test-123' };

      const html = selector._getItemHTML(puppet);

      expect(html).toContain('basset-puppet-item active');
    });

    it('should generate error HTML', () => {
      const selector = new SockPuppetSelector();
      selector.state.error = 'Network error occurred';

      const html = selector._getErrorHTML();

      expect(html).toContain('Network error occurred');
      expect(html).toContain('basset-puppet-error-retry');
    });
  });

  describe('Storage operations', () => {
    it('should load active identity from storage', async () => {
      chrome.storage.local.get.mockImplementation((key, callback) => {
        callback({ activeSockPuppet: { id: '1', name: 'John Doe' } });
      });

      const selector = new SockPuppetSelector();
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(selector.state.activeIdentity).toEqual({ id: '1', name: 'John Doe' });
    });

    it('should save active identity to storage', async () => {
      const selector = new SockPuppetSelector();
      const puppet = { id: '1', name: 'John Doe' };

      await selector._saveActiveIdentity(puppet);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'storage_set',
          key: 'activeSockPuppet',
          value: puppet
        }),
        expect.any(Function)
      );
    });

    it('should clear active identity from storage', async () => {
      const selector = new SockPuppetSelector();

      await selector._clearActiveIdentity();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'storage_remove',
          key: 'activeSockPuppet'
        }),
        expect.any(Function)
      );
    });
  });

  describe('Logging', () => {
    it('should use custom logger when provided', () => {
      const customLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
      };

      const selector = new SockPuppetSelector({ logger: customLogger });
      selector._log('info', 'Test message', { data: 'test' });

      expect(customLogger.info).toHaveBeenCalledWith('Test message', { data: 'test' });
    });

    it('should use console when no custom logger', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

      const selector = new SockPuppetSelector();
      selector._log('info', 'Test message', { data: 'test' });

      expect(consoleSpy).toHaveBeenCalledWith('[SockPuppetSelector]', 'Test message', { data: 'test' });

      consoleSpy.mockRestore();
    });
  });
});
