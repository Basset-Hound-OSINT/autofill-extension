/**
 * Test Setup and Teardown Utilities
 *
 * This module provides setup and teardown functions for tests,
 * including global mocks, environment configuration, and test utilities.
 */

const { setupChromeMock, resetMocks } = require('../mocks/chrome-api.mock');
const { setupWebSocketMock, resetMockWebSocket, restoreWebSocket } = require('../mocks/websocket.mock');

// Store original globals
let originalGlobals = {};

/**
 * Setup the test environment before all tests
 * Call this in beforeAll() or at the top of your test file
 */
const setupTestEnvironment = () => {
  // Store original globals
  originalGlobals = {
    WebSocket: global.WebSocket,
    chrome: global.chrome,
    console: { ...console }
  };

  // Setup Chrome mock
  setupChromeMock();

  // Setup WebSocket mock
  setupWebSocketMock();

  // Setup global Logger mock if not already present
  if (typeof global.Logger === 'undefined') {
    global.Logger = createMockLogger();
    global.LogLevel = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3
    };
  }

  // Mock console methods to prevent noise in tests
  if (process.env.SUPPRESS_CONSOLE !== 'false') {
    global.console = {
      ...console,
      debug: jest.fn(),
      log: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
  }

  // Setup DOM globals if not present (for content script tests)
  if (typeof global.document === 'undefined') {
    setupBasicDOMMock();
  }

  // Setup CSS.escape if not present
  if (typeof global.CSS === 'undefined') {
    global.CSS = {
      escape: (str) => str.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1')
    };
  }

  // Setup URL if not present
  if (typeof global.URL === 'undefined') {
    global.URL = URL;
  }

  // Setup TextDecoder if not present
  if (typeof global.TextDecoder === 'undefined') {
    const { TextDecoder } = require('util');
    global.TextDecoder = TextDecoder;
  }

  return {
    chrome: global.chrome,
    WebSocket: global.WebSocket
  };
};

/**
 * Teardown the test environment after all tests
 * Call this in afterAll()
 */
const teardownTestEnvironment = () => {
  // Restore original globals
  if (originalGlobals.WebSocket) {
    global.WebSocket = originalGlobals.WebSocket;
  }
  if (originalGlobals.chrome) {
    global.chrome = originalGlobals.chrome;
  }
  if (originalGlobals.console) {
    global.console = originalGlobals.console;
  }

  // Restore WebSocket
  restoreWebSocket();

  // Clear originalGlobals
  originalGlobals = {};
};

/**
 * Reset mocks before each test
 * Call this in beforeEach()
 */
const resetTestMocks = () => {
  // Reset Chrome mocks
  resetMocks();

  // Reset WebSocket mocks
  resetMockWebSocket();

  // Clear all jest mocks
  if (typeof jest !== 'undefined') {
    jest.clearAllMocks();
  }
};

/**
 * Create a mock Logger class for testing
 */
const createMockLogger = () => {
  class MockLogger {
    constructor(options = {}) {
      this.component = options.component || 'Test';
      this.minLevel = options.minLevel !== undefined ? options.minLevel : 0;
      this.enableConsole = options.enableConsole !== undefined ? options.enableConsole : false;
      this.enableStorage = options.enableStorage || false;
      this.context = {};
      this.logs = [];
    }

    setContext(context) {
      this.context = { ...this.context, ...context };
      return this;
    }

    clearContext() {
      this.context = {};
      return this;
    }

    child(subComponent, additionalContext = {}) {
      const childLogger = new MockLogger({
        component: `${this.component}:${subComponent}`,
        minLevel: this.minLevel,
        enableConsole: this.enableConsole,
        enableStorage: this.enableStorage
      });
      childLogger.setContext({ ...this.context, ...additionalContext });
      return childLogger;
    }

    _log(level, message, data = {}) {
      this.logs.push({
        level,
        message,
        data,
        context: { ...this.context },
        timestamp: new Date().toISOString()
      });
    }

    debug(message, data = {}) {
      this._log('DEBUG', message, data);
    }

    info(message, data = {}) {
      this._log('INFO', message, data);
    }

    warn(message, data = {}) {
      this._log('WARN', message, data);
    }

    error(message, data = {}) {
      if (data instanceof Error) {
        data = {
          errorName: data.name,
          errorMessage: data.message,
          errorStack: data.stack
        };
      }
      this._log('ERROR', message, data);
    }

    getLogs() {
      return [...this.logs];
    }

    clearLogs() {
      this.logs = [];
    }

    async getStoredLogs() {
      return [];
    }

    async clearStoredLogs() {}

    async exportLogs() {
      return JSON.stringify(this.logs, null, 2);
    }
  }

  return MockLogger;
};

/**
 * Setup basic DOM mock for content script testing
 */
const setupBasicDOMMock = () => {
  // Mock document
  global.document = {
    body: createMockElement('body'),
    documentElement: createMockElement('html'),
    readyState: 'complete',
    title: 'Test Page',

    querySelector: jest.fn((selector) => null),
    querySelectorAll: jest.fn((selector) => []),
    getElementById: jest.fn((id) => null),
    getElementsByClassName: jest.fn((className) => []),
    getElementsByTagName: jest.fn((tagName) => []),
    createElement: jest.fn((tagName) => createMockElement(tagName)),
    createTextNode: jest.fn((text) => ({ textContent: text, nodeType: 3 })),
    createEvent: jest.fn((type) => new MockEvent(type))
  };

  // Mock window
  global.window = {
    location: {
      href: 'https://example.com/test',
      hostname: 'example.com',
      pathname: '/test',
      search: '',
      hash: '',
      protocol: 'https:'
    },
    getComputedStyle: jest.fn((element) => ({
      display: 'block',
      visibility: 'visible',
      opacity: '1'
    })),
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  };

  // Mock events
  global.Event = MockEvent;
  global.MouseEvent = MockMouseEvent;
  global.KeyboardEvent = MockKeyboardEvent;
  global.InputEvent = MockInputEvent;
  global.MutationObserver = MockMutationObserver;
};

/**
 * Create a mock DOM element
 */
const createMockElement = (tagName, attributes = {}) => {
  const element = {
    tagName: tagName.toUpperCase(),
    nodeName: tagName.toUpperCase(),
    nodeType: 1,
    id: attributes.id || '',
    className: attributes.className || '',
    name: attributes.name || '',
    type: attributes.type || '',
    value: attributes.value || '',
    textContent: attributes.textContent || '',
    innerHTML: attributes.innerHTML || '',
    innerText: attributes.innerText || '',
    placeholder: attributes.placeholder || '',
    checked: attributes.checked || false,
    disabled: attributes.disabled || false,
    readOnly: attributes.readOnly || false,
    required: attributes.required || false,
    style: {},
    dataset: {},
    children: [],
    childNodes: [],
    parentElement: null,
    parentNode: null,
    nextElementSibling: null,
    previousElementSibling: null,
    attributes: [],
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      toggle: jest.fn(),
      contains: jest.fn(() => false)
    },
    options: [],

    getAttribute: jest.fn((name) => attributes[name] || null),
    setAttribute: jest.fn((name, value) => { attributes[name] = value; }),
    removeAttribute: jest.fn((name) => { delete attributes[name]; }),
    hasAttribute: jest.fn((name) => name in attributes),

    querySelector: jest.fn((selector) => null),
    querySelectorAll: jest.fn((selector) => []),
    getElementsByTagName: jest.fn((tagName) => []),
    getElementsByClassName: jest.fn((className) => []),

    closest: jest.fn((selector) => null),
    matches: jest.fn((selector) => false),
    contains: jest.fn((node) => false),

    appendChild: jest.fn((child) => {
      element.children.push(child);
      child.parentElement = element;
      child.parentNode = element;
      return child;
    }),
    removeChild: jest.fn((child) => {
      const index = element.children.indexOf(child);
      if (index > -1) {
        element.children.splice(index, 1);
      }
      return child;
    }),
    insertBefore: jest.fn((newNode, referenceNode) => {
      const index = element.children.indexOf(referenceNode);
      if (index > -1) {
        element.children.splice(index, 0, newNode);
      } else {
        element.children.push(newNode);
      }
      newNode.parentElement = element;
      return newNode;
    }),
    cloneNode: jest.fn((deep) => createMockElement(tagName, { ...attributes })),

    focus: jest.fn(),
    blur: jest.fn(),
    click: jest.fn(),
    submit: jest.fn(),
    reset: jest.fn(),

    scrollIntoView: jest.fn(),
    getBoundingClientRect: jest.fn(() => ({
      top: 0, left: 0, bottom: 100, right: 100,
      width: 100, height: 100, x: 0, y: 0
    })),

    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(() => true),

    checkValidity: jest.fn(() => true),
    reportValidity: jest.fn(() => true),
    setCustomValidity: jest.fn(),
    validity: {
      valid: true,
      valueMissing: false,
      typeMismatch: false,
      patternMismatch: false,
      tooLong: false,
      tooShort: false,
      rangeUnderflow: false,
      rangeOverflow: false,
      stepMismatch: false,
      badInput: false,
      customError: false
    },
    validationMessage: ''
  };

  // Handle form elements
  if (tagName.toLowerCase() === 'form') {
    element.elements = [];
    element.method = 'GET';
    element.action = '';
  }

  // Handle select elements
  if (tagName.toLowerCase() === 'select') {
    element.selectedIndex = -1;
    element.options = [];
  }

  return element;
};

/**
 * Mock Event class
 */
class MockEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = options.bubbles || false;
    this.cancelable = options.cancelable || false;
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
    this.timeStamp = Date.now();
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {}
  stopImmediatePropagation() {}
}

/**
 * Mock MouseEvent class
 */
class MockMouseEvent extends MockEvent {
  constructor(type, options = {}) {
    super(type, options);
    this.clientX = options.clientX || 0;
    this.clientY = options.clientY || 0;
    this.button = options.button || 0;
    this.buttons = options.buttons || 0;
  }
}

/**
 * Mock KeyboardEvent class
 */
class MockKeyboardEvent extends MockEvent {
  constructor(type, options = {}) {
    super(type, options);
    this.key = options.key || '';
    this.code = options.code || '';
    this.ctrlKey = options.ctrlKey || false;
    this.shiftKey = options.shiftKey || false;
    this.altKey = options.altKey || false;
    this.metaKey = options.metaKey || false;
  }
}

/**
 * Mock InputEvent class
 */
class MockInputEvent extends MockEvent {
  constructor(type, options = {}) {
    super(type, options);
    this.data = options.data || null;
    this.inputType = options.inputType || 'insertText';
  }
}

/**
 * Mock MutationObserver class
 */
class MockMutationObserver {
  constructor(callback) {
    this.callback = callback;
    this.observing = false;
    this.target = null;
    this.options = null;
  }

  observe(target, options) {
    this.observing = true;
    this.target = target;
    this.options = options;
  }

  disconnect() {
    this.observing = false;
    this.target = null;
    this.options = null;
  }

  takeRecords() {
    return [];
  }

  // Test helper to trigger mutations
  trigger(mutations) {
    if (this.callback) {
      this.callback(mutations, this);
    }
  }
}

/**
 * Wait for a specified time (useful for async tests)
 * @param {number} ms - Milliseconds to wait
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wait for a condition to be true
 * @param {Function} condition - Function that returns boolean
 * @param {number} timeout - Maximum time to wait
 * @param {number} interval - Check interval
 */
const waitFor = async (condition, timeout = 5000, interval = 50) => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await wait(interval);
  }
  throw new Error('waitFor timeout');
};

/**
 * Flush all pending promises and timers
 */
const flushPromises = () => new Promise(resolve => setImmediate(resolve));

/**
 * Run all timers and flush promises
 */
const runAllTimersAndFlush = async () => {
  if (typeof jest !== 'undefined' && jest.runAllTimers) {
    jest.runAllTimers();
  }
  await flushPromises();
};

// Export all utilities
module.exports = {
  setupTestEnvironment,
  teardownTestEnvironment,
  resetTestMocks,
  createMockLogger,
  setupBasicDOMMock,
  createMockElement,
  MockEvent,
  MockMouseEvent,
  MockKeyboardEvent,
  MockInputEvent,
  MockMutationObserver,
  wait,
  waitFor,
  flushPromises,
  runAllTimersAndFlush
};
