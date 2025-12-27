/**
 * Custom Assertions for Chrome Extension Testing
 *
 * This module provides custom assertion functions for testing
 * Chrome extension functionality.
 */

/**
 * Assert that a Chrome message was sent
 * @param {Object} chrome - Chrome mock object
 * @param {Object} expectedMessage - Expected message object (partial match)
 */
const assertMessageSent = (chrome, expectedMessage) => {
  const calls = chrome.runtime.sendMessage.mock.calls;

  const found = calls.some(call => {
    const message = call[0];
    return objectContains(message, expectedMessage);
  });

  if (!found) {
    throw new Error(
      `Expected message not found.\n` +
      `Expected: ${JSON.stringify(expectedMessage, null, 2)}\n` +
      `Actual calls: ${JSON.stringify(calls, null, 2)}`
    );
  }
};

/**
 * Assert that a tab message was sent
 * @param {Object} chrome - Chrome mock object
 * @param {number} tabId - Expected tab ID
 * @param {Object} expectedMessage - Expected message object (partial match)
 */
const assertTabMessageSent = (chrome, tabId, expectedMessage) => {
  const calls = chrome.tabs.sendMessage.mock.calls;

  const found = calls.some(call => {
    const [callTabId, message] = call;
    return callTabId === tabId && objectContains(message, expectedMessage);
  });

  if (!found) {
    throw new Error(
      `Expected tab message not found.\n` +
      `Expected tabId: ${tabId}\n` +
      `Expected message: ${JSON.stringify(expectedMessage, null, 2)}\n` +
      `Actual calls: ${JSON.stringify(calls, null, 2)}`
    );
  }
};

/**
 * Assert that storage was set with specific values
 * @param {Object} chrome - Chrome mock object
 * @param {string} area - Storage area ('local' or 'sync')
 * @param {Object} expectedData - Expected data (partial match)
 */
const assertStorageSet = (chrome, area, expectedData) => {
  const storage = chrome.storage[area];
  const calls = storage.set.mock.calls;

  const found = calls.some(call => {
    const data = call[0];
    return objectContains(data, expectedData);
  });

  if (!found) {
    throw new Error(
      `Expected storage.${area}.set not called with expected data.\n` +
      `Expected: ${JSON.stringify(expectedData, null, 2)}\n` +
      `Actual calls: ${JSON.stringify(calls, null, 2)}`
    );
  }
};

/**
 * Assert that a cookie was set
 * @param {Object} chrome - Chrome mock object
 * @param {Object} expectedCookie - Expected cookie properties (partial match)
 */
const assertCookieSet = (chrome, expectedCookie) => {
  const calls = chrome.cookies.set.mock.calls;

  const found = calls.some(call => {
    const cookie = call[0];
    return objectContains(cookie, expectedCookie);
  });

  if (!found) {
    throw new Error(
      `Expected cookie not set.\n` +
      `Expected: ${JSON.stringify(expectedCookie, null, 2)}\n` +
      `Actual calls: ${JSON.stringify(calls, null, 2)}`
    );
  }
};

/**
 * Assert that a script was executed
 * @param {Object} chrome - Chrome mock object
 * @param {number} tabId - Expected tab ID
 * @param {Object} expectedInjection - Expected injection properties (partial match)
 */
const assertScriptExecuted = (chrome, tabId, expectedInjection = {}) => {
  const calls = chrome.scripting.executeScript.mock.calls;

  const found = calls.some(call => {
    const injection = call[0];
    if (injection.target && injection.target.tabId !== tabId) {
      return false;
    }
    return objectContains(injection, expectedInjection);
  });

  if (!found) {
    throw new Error(
      `Expected script execution not found.\n` +
      `Expected tabId: ${tabId}\n` +
      `Expected injection: ${JSON.stringify(expectedInjection, null, 2)}\n` +
      `Actual calls: ${JSON.stringify(calls, null, 2)}`
    );
  }
};

/**
 * Assert that a WebSocket message was sent
 * @param {MockWebSocket} ws - Mock WebSocket instance
 * @param {Object|string} expectedMessage - Expected message (object for JSON, string for raw)
 */
const assertWebSocketMessageSent = (ws, expectedMessage) => {
  const messages = ws.getSentMessages();

  const found = messages.some(msg => {
    if (typeof expectedMessage === 'object') {
      try {
        const parsed = JSON.parse(msg.data);
        return objectContains(parsed, expectedMessage);
      } catch {
        return false;
      }
    }
    return msg.data === expectedMessage;
  });

  if (!found) {
    throw new Error(
      `Expected WebSocket message not sent.\n` +
      `Expected: ${JSON.stringify(expectedMessage, null, 2)}\n` +
      `Actual messages: ${JSON.stringify(messages.map(m => m.data), null, 2)}`
    );
  }
};

/**
 * Assert that a WebSocket message was sent with specific command ID
 * @param {MockWebSocket} ws - Mock WebSocket instance
 * @param {string} commandId - Expected command ID
 * @param {Object} expectedFields - Additional expected fields
 */
const assertCommandSent = (ws, commandId, expectedFields = {}) => {
  const messages = ws.getSentMessages();

  const found = messages.some(msg => {
    try {
      const parsed = JSON.parse(msg.data);
      if (parsed.command_id !== commandId) {
        return false;
      }
      return objectContains(parsed, expectedFields);
    } catch {
      return false;
    }
  });

  if (!found) {
    throw new Error(
      `Expected command with ID '${commandId}' not sent.\n` +
      `Expected fields: ${JSON.stringify(expectedFields, null, 2)}\n` +
      `Actual messages: ${JSON.stringify(messages.map(m => m.data), null, 2)}`
    );
  }
};

/**
 * Assert that a response was sent for a command
 * @param {MockWebSocket} ws - Mock WebSocket instance
 * @param {string} commandId - Command ID
 * @param {boolean} success - Expected success status
 * @param {Object} expectedResult - Expected result (partial match, optional)
 */
const assertResponseSent = (ws, commandId, success, expectedResult = null) => {
  const messages = ws.getSentMessages();

  const found = messages.some(msg => {
    try {
      const parsed = JSON.parse(msg.data);
      if (parsed.command_id !== commandId) {
        return false;
      }
      if (parsed.success !== success) {
        return false;
      }
      if (expectedResult !== null) {
        return objectContains(parsed.result, expectedResult);
      }
      return true;
    } catch {
      return false;
    }
  });

  if (!found) {
    throw new Error(
      `Expected response for command '${commandId}' not sent.\n` +
      `Expected success: ${success}\n` +
      `Expected result: ${JSON.stringify(expectedResult, null, 2)}\n` +
      `Actual messages: ${JSON.stringify(messages.map(m => m.data), null, 2)}`
    );
  }
};

/**
 * Assert that a listener was registered
 * @param {Object} chrome - Chrome mock object
 * @param {string} eventPath - Event path (e.g., 'webRequest.onBeforeRequest')
 */
const assertListenerRegistered = (chrome, eventPath) => {
  const parts = eventPath.split('.');
  let current = chrome;
  for (const part of parts) {
    current = current[part];
    if (!current) {
      throw new Error(`Event path '${eventPath}' not found`);
    }
  }

  if (!current.addListener.mock.calls.length) {
    throw new Error(`No listener registered for '${eventPath}'`);
  }
};

/**
 * Assert that a listener was removed
 * @param {Object} chrome - Chrome mock object
 * @param {string} eventPath - Event path (e.g., 'webRequest.onBeforeRequest')
 */
const assertListenerRemoved = (chrome, eventPath) => {
  const parts = eventPath.split('.');
  let current = chrome;
  for (const part of parts) {
    current = current[part];
    if (!current) {
      throw new Error(`Event path '${eventPath}' not found`);
    }
  }

  if (!current.removeListener.mock.calls.length) {
    throw new Error(`No listener removed for '${eventPath}'`);
  }
};

/**
 * Assert that a URL was navigated to
 * @param {Object} chrome - Chrome mock object
 * @param {string} url - Expected URL
 * @param {Object} options - Additional options (tabId, etc.)
 */
const assertNavigatedTo = (chrome, url, options = {}) => {
  const tabCalls = chrome.tabs.update.mock.calls;
  const createCalls = chrome.tabs.create.mock.calls;

  const foundInUpdate = tabCalls.some(call => {
    const [tabId, props] = call;
    if (options.tabId !== undefined && tabId !== options.tabId) {
      return false;
    }
    return props.url === url;
  });

  const foundInCreate = createCalls.some(call => {
    const props = call[0];
    return props.url === url;
  });

  if (!foundInUpdate && !foundInCreate) {
    throw new Error(
      `Expected navigation to '${url}' not found.\n` +
      `tabs.update calls: ${JSON.stringify(tabCalls, null, 2)}\n` +
      `tabs.create calls: ${JSON.stringify(createCalls, null, 2)}`
    );
  }
};

/**
 * Assert that an element matches expected properties
 * @param {Object} element - DOM element (or mock)
 * @param {Object} expectedProps - Expected properties
 */
const assertElementProperties = (element, expectedProps) => {
  const mismatches = [];

  for (const [key, expectedValue] of Object.entries(expectedProps)) {
    const actualValue = element[key];
    if (actualValue !== expectedValue) {
      mismatches.push({
        property: key,
        expected: expectedValue,
        actual: actualValue
      });
    }
  }

  if (mismatches.length > 0) {
    throw new Error(
      `Element property mismatches:\n${mismatches
        .map(m => `  ${m.property}: expected ${JSON.stringify(m.expected)}, got ${JSON.stringify(m.actual)}`)
        .join('\n')}`
    );
  }
};

/**
 * Assert that a form was filled correctly
 * @param {Object} chrome - Chrome mock object
 * @param {Object} expectedFields - Expected field values
 */
const assertFormFilled = (chrome, expectedFields) => {
  const calls = chrome.tabs.sendMessage.mock.calls;

  const found = calls.some(call => {
    const message = call[1];
    if (message.action !== 'fill_form') {
      return false;
    }
    return objectContains(message.fields, expectedFields);
  });

  if (!found) {
    throw new Error(
      `Expected form fill not found.\n` +
      `Expected fields: ${JSON.stringify(expectedFields, null, 2)}\n` +
      `Actual calls: ${JSON.stringify(
        calls.filter(c => c[1].action === 'fill_form'),
        null, 2
      )}`
    );
  }
};

/**
 * Assert that logs contain a specific message
 * @param {Array} logs - Array of log entries
 * @param {string} level - Log level to check
 * @param {string|RegExp} message - Message to find
 */
const assertLogContains = (logs, level, message) => {
  const found = logs.some(log => {
    if (log.level !== level) {
      return false;
    }
    if (message instanceof RegExp) {
      return message.test(log.message);
    }
    return log.message.includes(message);
  });

  if (!found) {
    throw new Error(
      `Expected log not found.\n` +
      `Level: ${level}\n` +
      `Message: ${message}\n` +
      `Actual logs: ${JSON.stringify(logs.filter(l => l.level === level), null, 2)}`
    );
  }
};

/**
 * Assert that no errors were logged
 * @param {Array} logs - Array of log entries
 */
const assertNoErrors = (logs) => {
  const errors = logs.filter(log => log.level === 'ERROR');

  if (errors.length > 0) {
    throw new Error(
      `Unexpected errors logged:\n${JSON.stringify(errors, null, 2)}`
    );
  }
};

/**
 * Assert that a network request was captured
 * @param {Object} monitor - Network monitor instance
 * @param {Object} expectedRequest - Expected request properties (partial match)
 */
const assertRequestCaptured = (monitor, expectedRequest) => {
  const log = monitor.getLog();

  const found = log.some(entry => objectContains(entry, expectedRequest));

  if (!found) {
    throw new Error(
      `Expected network request not captured.\n` +
      `Expected: ${JSON.stringify(expectedRequest, null, 2)}\n` +
      `Captured requests: ${JSON.stringify(log, null, 2)}`
    );
  }
};

/**
 * Assert that a request was blocked
 * @param {Object} interceptor - Request interceptor instance
 * @param {string} urlPattern - URL pattern to check
 */
const assertRequestBlocked = (interceptor, urlPattern) => {
  const rules = interceptor.getBlockRules();
  const regex = new RegExp(urlPattern);

  const found = rules.some(rule => {
    return regex.test(rule.urlPattern) || rule.urlPattern.includes(urlPattern);
  });

  if (!found) {
    throw new Error(
      `Expected block rule for '${urlPattern}' not found.\n` +
      `Current rules: ${JSON.stringify(rules, null, 2)}`
    );
  }
};

/**
 * Assert function was called with specific arguments
 * @param {Function} mockFn - Jest mock function
 * @param {Array} expectedArgs - Expected arguments (supports partial match for objects)
 */
const assertCalledWith = (mockFn, expectedArgs) => {
  const found = mockFn.mock.calls.some(call => {
    if (call.length !== expectedArgs.length) {
      return false;
    }
    return expectedArgs.every((expected, index) => {
      const actual = call[index];
      if (typeof expected === 'object' && expected !== null) {
        return objectContains(actual, expected);
      }
      return actual === expected;
    });
  });

  if (!found) {
    throw new Error(
      `Function not called with expected arguments.\n` +
      `Expected: ${JSON.stringify(expectedArgs, null, 2)}\n` +
      `Actual calls: ${JSON.stringify(mockFn.mock.calls, null, 2)}`
    );
  }
};

/**
 * Assert that two objects have the same structure (deep equality)
 * @param {Object} actual - Actual object
 * @param {Object} expected - Expected object
 */
const assertDeepEqual = (actual, expected) => {
  const compare = (a, b, path = '') => {
    if (a === b) return;

    if (typeof a !== typeof b) {
      throw new Error(
        `Type mismatch at '${path}':\n` +
        `Expected type: ${typeof b}\n` +
        `Actual type: ${typeof a}`
      );
    }

    if (typeof a !== 'object' || a === null || b === null) {
      if (a !== b) {
        throw new Error(
          `Value mismatch at '${path}':\n` +
          `Expected: ${JSON.stringify(b)}\n` +
          `Actual: ${JSON.stringify(a)}`
        );
      }
      return;
    }

    if (Array.isArray(a) !== Array.isArray(b)) {
      throw new Error(
        `Array/Object mismatch at '${path}':\n` +
        `Expected: ${Array.isArray(b) ? 'Array' : 'Object'}\n` +
        `Actual: ${Array.isArray(a) ? 'Array' : 'Object'}`
      );
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    for (const key of keysB) {
      if (!keysA.includes(key)) {
        throw new Error(`Missing key '${key}' at '${path}'`);
      }
      compare(a[key], b[key], path ? `${path}.${key}` : key);
    }
  };

  compare(actual, expected);
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if an object contains all properties of another object (partial match)
 * @param {Object} actual - Actual object
 * @param {Object} expected - Expected object (subset)
 * @returns {boolean} - True if actual contains all properties of expected
 */
const objectContains = (actual, expected) => {
  if (actual === expected) return true;
  if (actual === null || expected === null) return actual === expected;
  if (typeof actual !== 'object' || typeof expected !== 'object') {
    return actual === expected;
  }

  for (const key of Object.keys(expected)) {
    if (!(key in actual)) return false;
    if (!objectContains(actual[key], expected[key])) return false;
  }

  return true;
};

// Export all assertions
module.exports = {
  assertMessageSent,
  assertTabMessageSent,
  assertStorageSet,
  assertCookieSet,
  assertScriptExecuted,
  assertWebSocketMessageSent,
  assertCommandSent,
  assertResponseSent,
  assertListenerRegistered,
  assertListenerRemoved,
  assertNavigatedTo,
  assertElementProperties,
  assertFormFilled,
  assertLogContains,
  assertNoErrors,
  assertRequestCaptured,
  assertRequestBlocked,
  assertCalledWith,
  assertDeepEqual,
  objectContains
};
