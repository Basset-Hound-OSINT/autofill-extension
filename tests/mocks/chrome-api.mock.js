/**
 * Mock Chrome Extension APIs for testing
 *
 * This module provides comprehensive mocks for Chrome extension APIs
 * to allow testing without a browser environment.
 */

// Store for mock data
const mockStorage = {
  local: {},
  sync: {},
  session: {}
};

const mockCookies = [];
const mockTabs = [
  { id: 1, url: 'https://example.com', active: true, title: 'Example' }
];
const mockListeners = {
  'tabs.onUpdated': [],
  'runtime.onMessage': [],
  'runtime.onInstalled': [],
  'runtime.onStartup': [],
  'webRequest.onBeforeRequest': [],
  'webRequest.onBeforeSendHeaders': [],
  'webRequest.onSendHeaders': [],
  'webRequest.onHeadersReceived': [],
  'webRequest.onBeforeRedirect': [],
  'webRequest.onResponseStarted': [],
  'webRequest.onCompleted': [],
  'webRequest.onErrorOccurred': []
};

/**
 * Create a mock Chrome runtime API
 */
const createRuntimeMock = () => ({
  lastError: null,
  id: 'mock-extension-id',

  sendMessage: jest.fn((message, callback) => {
    if (callback) {
      setTimeout(() => callback({ success: true }), 0);
    }
    return Promise.resolve({ success: true });
  }),

  onMessage: {
    addListener: jest.fn((callback) => {
      mockListeners['runtime.onMessage'].push(callback);
    }),
    removeListener: jest.fn((callback) => {
      const index = mockListeners['runtime.onMessage'].indexOf(callback);
      if (index > -1) {
        mockListeners['runtime.onMessage'].splice(index, 1);
      }
    }),
    hasListener: jest.fn((callback) => {
      return mockListeners['runtime.onMessage'].includes(callback);
    })
  },

  onInstalled: {
    addListener: jest.fn((callback) => {
      mockListeners['runtime.onInstalled'].push(callback);
    }),
    removeListener: jest.fn((callback) => {
      const index = mockListeners['runtime.onInstalled'].indexOf(callback);
      if (index > -1) {
        mockListeners['runtime.onInstalled'].splice(index, 1);
      }
    })
  },

  onStartup: {
    addListener: jest.fn((callback) => {
      mockListeners['runtime.onStartup'].push(callback);
    }),
    removeListener: jest.fn()
  },

  getManifest: jest.fn(() => ({
    name: 'Basset Hound Autofill Extension',
    version: '1.0.0',
    manifest_version: 3
  })),

  getURL: jest.fn((path) => `chrome-extension://mock-extension-id/${path}`)
});

/**
 * Create a mock Chrome storage API
 */
const createStorageMock = () => ({
  local: {
    get: jest.fn((keys, callback) => {
      const result = {};
      if (typeof keys === 'string') {
        keys = [keys];
      } else if (keys === null || keys === undefined) {
        Object.assign(result, mockStorage.local);
        if (callback) callback(result);
        return Promise.resolve(result);
      }

      for (const key of keys) {
        if (mockStorage.local.hasOwnProperty(key)) {
          result[key] = mockStorage.local[key];
        }
      }

      if (callback) {
        setTimeout(() => callback(result), 0);
      }
      return Promise.resolve(result);
    }),

    set: jest.fn((items, callback) => {
      Object.assign(mockStorage.local, items);
      if (callback) {
        setTimeout(() => callback(), 0);
      }
      return Promise.resolve();
    }),

    remove: jest.fn((keys, callback) => {
      if (typeof keys === 'string') {
        keys = [keys];
      }
      for (const key of keys) {
        delete mockStorage.local[key];
      }
      if (callback) {
        setTimeout(() => callback(), 0);
      }
      return Promise.resolve();
    }),

    clear: jest.fn((callback) => {
      Object.keys(mockStorage.local).forEach(key => {
        delete mockStorage.local[key];
      });
      if (callback) {
        setTimeout(() => callback(), 0);
      }
      return Promise.resolve();
    })
  },

  sync: {
    get: jest.fn((keys, callback) => {
      const result = {};
      if (typeof keys === 'string') {
        keys = [keys];
      }
      for (const key of (keys || Object.keys(mockStorage.sync))) {
        if (mockStorage.sync.hasOwnProperty(key)) {
          result[key] = mockStorage.sync[key];
        }
      }
      if (callback) {
        setTimeout(() => callback(result), 0);
      }
      return Promise.resolve(result);
    }),

    set: jest.fn((items, callback) => {
      Object.assign(mockStorage.sync, items);
      if (callback) {
        setTimeout(() => callback(), 0);
      }
      return Promise.resolve();
    }),

    remove: jest.fn((keys, callback) => {
      if (typeof keys === 'string') {
        keys = [keys];
      }
      for (const key of keys) {
        delete mockStorage.sync[key];
      }
      if (callback) {
        setTimeout(() => callback(), 0);
      }
      return Promise.resolve();
    }),

    clear: jest.fn((callback) => {
      Object.keys(mockStorage.sync).forEach(key => {
        delete mockStorage.sync[key];
      });
      if (callback) {
        setTimeout(() => callback(), 0);
      }
      return Promise.resolve();
    })
  }
});

/**
 * Create a mock Chrome tabs API
 */
const createTabsMock = () => ({
  query: jest.fn((queryInfo, callback) => {
    let results = [...mockTabs];

    if (queryInfo.active !== undefined) {
      results = results.filter(tab => tab.active === queryInfo.active);
    }
    if (queryInfo.currentWindow !== undefined) {
      // For testing, assume all tabs are in current window
    }
    if (queryInfo.url !== undefined) {
      results = results.filter(tab => tab.url.includes(queryInfo.url));
    }

    if (callback) {
      setTimeout(() => callback(results), 0);
    }
    return Promise.resolve(results);
  }),

  create: jest.fn((createProperties, callback) => {
    const newTab = {
      id: mockTabs.length + 1,
      url: createProperties.url || 'about:blank',
      active: createProperties.active !== false,
      title: 'New Tab'
    };
    mockTabs.push(newTab);

    if (callback) {
      setTimeout(() => callback(newTab), 0);
    }
    return Promise.resolve(newTab);
  }),

  update: jest.fn((tabId, updateProperties, callback) => {
    const tab = mockTabs.find(t => t.id === tabId);
    if (tab) {
      Object.assign(tab, updateProperties);
    }

    if (callback) {
      setTimeout(() => callback(tab), 0);
    }
    return Promise.resolve(tab);
  }),

  remove: jest.fn((tabIds, callback) => {
    if (!Array.isArray(tabIds)) {
      tabIds = [tabIds];
    }
    for (const id of tabIds) {
      const index = mockTabs.findIndex(t => t.id === id);
      if (index > -1) {
        mockTabs.splice(index, 1);
      }
    }

    if (callback) {
      setTimeout(() => callback(), 0);
    }
    return Promise.resolve();
  }),

  sendMessage: jest.fn((tabId, message, callback) => {
    const response = { success: true, tabId, message };
    if (callback) {
      setTimeout(() => callback(response), 0);
    }
    return Promise.resolve(response);
  }),

  captureVisibleTab: jest.fn((windowId, options, callback) => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    if (typeof windowId === 'function') {
      callback = windowId;
    } else if (typeof options === 'function') {
      callback = options;
    }

    if (callback) {
      setTimeout(() => callback(dataUrl), 0);
    }
    return Promise.resolve(dataUrl);
  }),

  onUpdated: {
    addListener: jest.fn((callback) => {
      mockListeners['tabs.onUpdated'].push(callback);
    }),
    removeListener: jest.fn((callback) => {
      const index = mockListeners['tabs.onUpdated'].indexOf(callback);
      if (index > -1) {
        mockListeners['tabs.onUpdated'].splice(index, 1);
      }
    }),
    hasListener: jest.fn((callback) => {
      return mockListeners['tabs.onUpdated'].includes(callback);
    })
  }
});

/**
 * Create a mock Chrome cookies API
 */
const createCookiesMock = () => ({
  getAll: jest.fn((details, callback) => {
    let results = [...mockCookies];

    if (details.url) {
      const url = new URL(details.url);
      results = results.filter(c => c.domain.includes(url.hostname) || url.hostname.includes(c.domain.replace(/^\./, '')));
    }
    if (details.domain) {
      results = results.filter(c => c.domain === details.domain || c.domain === '.' + details.domain);
    }
    if (details.name) {
      results = results.filter(c => c.name === details.name);
    }

    if (callback) {
      setTimeout(() => callback(results), 0);
    }
    return Promise.resolve(results);
  }),

  get: jest.fn((details, callback) => {
    const cookie = mockCookies.find(c =>
      c.name === details.name &&
      (c.url === details.url || c.domain === details.domain)
    );

    if (callback) {
      setTimeout(() => callback(cookie || null), 0);
    }
    return Promise.resolve(cookie || null);
  }),

  set: jest.fn((details, callback) => {
    const cookie = {
      name: details.name,
      value: details.value || '',
      domain: details.domain || new URL(details.url).hostname,
      path: details.path || '/',
      secure: details.secure || false,
      httpOnly: details.httpOnly || false,
      sameSite: details.sameSite || 'lax',
      expirationDate: details.expirationDate,
      hostOnly: !details.domain,
      session: !details.expirationDate
    };

    // Remove existing cookie with same name and domain
    const existingIndex = mockCookies.findIndex(c =>
      c.name === cookie.name && c.domain === cookie.domain
    );
    if (existingIndex > -1) {
      mockCookies.splice(existingIndex, 1);
    }

    mockCookies.push(cookie);

    if (callback) {
      setTimeout(() => callback(cookie), 0);
    }
    return Promise.resolve(cookie);
  }),

  remove: jest.fn((details, callback) => {
    const index = mockCookies.findIndex(c =>
      c.name === details.name &&
      (details.url ? c.domain.includes(new URL(details.url).hostname) : true)
    );

    let removed = null;
    if (index > -1) {
      removed = mockCookies.splice(index, 1)[0];
    }

    if (callback) {
      setTimeout(() => callback(removed ? { url: details.url, name: details.name } : null), 0);
    }
    return Promise.resolve(removed ? { url: details.url, name: details.name } : null);
  })
});

/**
 * Create a mock Chrome scripting API
 */
const createScriptingMock = () => ({
  executeScript: jest.fn((injection, callback) => {
    const results = [{
      result: { success: true, result: 'mock script result' },
      frameId: 0
    }];

    if (callback) {
      setTimeout(() => callback(results), 0);
    }
    return Promise.resolve(results);
  }),

  insertCSS: jest.fn((injection, callback) => {
    if (callback) {
      setTimeout(() => callback(), 0);
    }
    return Promise.resolve();
  }),

  removeCSS: jest.fn((injection, callback) => {
    if (callback) {
      setTimeout(() => callback(), 0);
    }
    return Promise.resolve();
  })
});

/**
 * Create a mock Chrome webRequest API
 */
const createWebRequestMock = () => ({
  onBeforeRequest: {
    addListener: jest.fn((callback, filter, extraInfoSpec) => {
      mockListeners['webRequest.onBeforeRequest'].push({ callback, filter, extraInfoSpec });
    }),
    removeListener: jest.fn((callback) => {
      const index = mockListeners['webRequest.onBeforeRequest'].findIndex(l => l.callback === callback);
      if (index > -1) {
        mockListeners['webRequest.onBeforeRequest'].splice(index, 1);
      }
    }),
    hasListener: jest.fn((callback) => {
      return mockListeners['webRequest.onBeforeRequest'].some(l => l.callback === callback);
    })
  },

  onBeforeSendHeaders: {
    addListener: jest.fn((callback, filter, extraInfoSpec) => {
      mockListeners['webRequest.onBeforeSendHeaders'].push({ callback, filter, extraInfoSpec });
    }),
    removeListener: jest.fn((callback) => {
      const index = mockListeners['webRequest.onBeforeSendHeaders'].findIndex(l => l.callback === callback);
      if (index > -1) {
        mockListeners['webRequest.onBeforeSendHeaders'].splice(index, 1);
      }
    }),
    hasListener: jest.fn((callback) => {
      return mockListeners['webRequest.onBeforeSendHeaders'].some(l => l.callback === callback);
    })
  },

  onSendHeaders: {
    addListener: jest.fn((callback, filter, extraInfoSpec) => {
      mockListeners['webRequest.onSendHeaders'].push({ callback, filter, extraInfoSpec });
    }),
    removeListener: jest.fn((callback) => {
      const index = mockListeners['webRequest.onSendHeaders'].findIndex(l => l.callback === callback);
      if (index > -1) {
        mockListeners['webRequest.onSendHeaders'].splice(index, 1);
      }
    }),
    hasListener: jest.fn()
  },

  onHeadersReceived: {
    addListener: jest.fn((callback, filter, extraInfoSpec) => {
      mockListeners['webRequest.onHeadersReceived'].push({ callback, filter, extraInfoSpec });
    }),
    removeListener: jest.fn((callback) => {
      const index = mockListeners['webRequest.onHeadersReceived'].findIndex(l => l.callback === callback);
      if (index > -1) {
        mockListeners['webRequest.onHeadersReceived'].splice(index, 1);
      }
    }),
    hasListener: jest.fn()
  },

  onBeforeRedirect: {
    addListener: jest.fn((callback, filter, extraInfoSpec) => {
      mockListeners['webRequest.onBeforeRedirect'].push({ callback, filter, extraInfoSpec });
    }),
    removeListener: jest.fn((callback) => {
      const index = mockListeners['webRequest.onBeforeRedirect'].findIndex(l => l.callback === callback);
      if (index > -1) {
        mockListeners['webRequest.onBeforeRedirect'].splice(index, 1);
      }
    }),
    hasListener: jest.fn()
  },

  onResponseStarted: {
    addListener: jest.fn((callback, filter, extraInfoSpec) => {
      mockListeners['webRequest.onResponseStarted'].push({ callback, filter, extraInfoSpec });
    }),
    removeListener: jest.fn((callback) => {
      const index = mockListeners['webRequest.onResponseStarted'].findIndex(l => l.callback === callback);
      if (index > -1) {
        mockListeners['webRequest.onResponseStarted'].splice(index, 1);
      }
    }),
    hasListener: jest.fn()
  },

  onCompleted: {
    addListener: jest.fn((callback, filter, extraInfoSpec) => {
      mockListeners['webRequest.onCompleted'].push({ callback, filter, extraInfoSpec });
    }),
    removeListener: jest.fn((callback) => {
      const index = mockListeners['webRequest.onCompleted'].findIndex(l => l.callback === callback);
      if (index > -1) {
        mockListeners['webRequest.onCompleted'].splice(index, 1);
      }
    }),
    hasListener: jest.fn()
  },

  onErrorOccurred: {
    addListener: jest.fn((callback, filter) => {
      mockListeners['webRequest.onErrorOccurred'].push({ callback, filter });
    }),
    removeListener: jest.fn((callback) => {
      const index = mockListeners['webRequest.onErrorOccurred'].findIndex(l => l.callback === callback);
      if (index > -1) {
        mockListeners['webRequest.onErrorOccurred'].splice(index, 1);
      }
    }),
    hasListener: jest.fn()
  }
});

/**
 * Create the complete Chrome mock object
 */
const createChromeMock = () => ({
  runtime: createRuntimeMock(),
  storage: createStorageMock(),
  tabs: createTabsMock(),
  cookies: createCookiesMock(),
  scripting: createScriptingMock(),
  webRequest: createWebRequestMock()
});

/**
 * Reset all mock data to initial state
 */
const resetMocks = () => {
  // Clear storage
  Object.keys(mockStorage.local).forEach(key => delete mockStorage.local[key]);
  Object.keys(mockStorage.sync).forEach(key => delete mockStorage.sync[key]);
  Object.keys(mockStorage.session).forEach(key => delete mockStorage.session[key]);

  // Clear cookies
  mockCookies.length = 0;

  // Reset tabs to default
  mockTabs.length = 0;
  mockTabs.push({ id: 1, url: 'https://example.com', active: true, title: 'Example' });

  // Clear listeners
  Object.keys(mockListeners).forEach(key => {
    mockListeners[key].length = 0;
  });
};

/**
 * Simulate triggering a listener event
 */
const triggerListener = (eventName, ...args) => {
  const listeners = mockListeners[eventName] || [];
  for (const listener of listeners) {
    if (typeof listener === 'function') {
      listener(...args);
    } else if (listener.callback) {
      listener.callback(...args);
    }
  }
};

/**
 * Add a mock cookie
 */
const addMockCookie = (cookie) => {
  mockCookies.push({
    name: cookie.name,
    value: cookie.value || '',
    domain: cookie.domain || '.example.com',
    path: cookie.path || '/',
    secure: cookie.secure || false,
    httpOnly: cookie.httpOnly || false,
    sameSite: cookie.sameSite || 'lax',
    expirationDate: cookie.expirationDate,
    hostOnly: cookie.hostOnly || false,
    session: !cookie.expirationDate
  });
};

/**
 * Add a mock tab
 */
const addMockTab = (tab) => {
  const newTab = {
    id: tab.id || mockTabs.length + 1,
    url: tab.url || 'about:blank',
    active: tab.active !== undefined ? tab.active : false,
    title: tab.title || 'New Tab'
  };
  mockTabs.push(newTab);
  return newTab;
};

/**
 * Set mock storage data
 */
const setMockStorageData = (area, data) => {
  if (mockStorage[area]) {
    Object.assign(mockStorage[area], data);
  }
};

/**
 * Get mock storage data
 */
const getMockStorageData = (area) => {
  return { ...mockStorage[area] };
};

/**
 * Setup Chrome mock in global scope
 */
const setupChromeMock = () => {
  global.chrome = createChromeMock();
  return global.chrome;
};

// Export all utilities
module.exports = {
  createChromeMock,
  createRuntimeMock,
  createStorageMock,
  createTabsMock,
  createCookiesMock,
  createScriptingMock,
  createWebRequestMock,
  resetMocks,
  triggerListener,
  addMockCookie,
  addMockTab,
  setMockStorageData,
  getMockStorageData,
  setupChromeMock,
  mockStorage,
  mockCookies,
  mockTabs,
  mockListeners
};
