/**
 * Basset Hound Browser Automation - User Agent Rotator
 *
 * Provides user agent rotation capabilities for bot detection evasion:
 * - Realistic user agent strings for multiple browsers and OS combinations
 * - Random user agent selection
 * - OS-specific and browser-specific filtering
 * - User agent rotation management
 */

// =============================================================================
// User Agent Database - 2024 Realistic User Agents
// =============================================================================

/**
 * Collection of realistic user agent strings from 2024
 * Includes Chrome, Firefox, Safari, and Edge on Windows, Mac, and Linux
 */
const USER_AGENTS = [
  // Chrome on Windows
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    browser: 'chrome',
    os: 'windows',
    version: '122.0.0.0'
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    browser: 'chrome',
    os: 'windows',
    version: '121.0.0.0'
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    browser: 'chrome',
    os: 'windows',
    version: '120.0.0.0'
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    browser: 'chrome',
    os: 'windows',
    version: '122.0.0.0'
  },

  // Chrome on Mac
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    browser: 'chrome',
    os: 'mac',
    version: '122.0.0.0'
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    browser: 'chrome',
    os: 'mac',
    version: '121.0.0.0'
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    browser: 'chrome',
    os: 'mac',
    version: '122.0.0.0'
  },

  // Chrome on Linux
  {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    browser: 'chrome',
    os: 'linux',
    version: '122.0.0.0'
  },
  {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    browser: 'chrome',
    os: 'linux',
    version: '121.0.0.0'
  },

  // Firefox on Windows
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
    browser: 'firefox',
    os: 'windows',
    version: '123.0'
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    browser: 'firefox',
    os: 'windows',
    version: '122.0'
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    browser: 'firefox',
    os: 'windows',
    version: '121.0'
  },

  // Firefox on Mac
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0',
    browser: 'firefox',
    os: 'mac',
    version: '123.0'
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.3; rv:123.0) Gecko/20100101 Firefox/123.0',
    browser: 'firefox',
    os: 'mac',
    version: '123.0'
  },

  // Firefox on Linux
  {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0',
    browser: 'firefox',
    os: 'linux',
    version: '123.0'
  },
  {
    userAgent: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0',
    browser: 'firefox',
    os: 'linux',
    version: '122.0'
  },

  // Safari on Mac
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
    browser: 'safari',
    os: 'mac',
    version: '17.3'
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15',
    browser: 'safari',
    os: 'mac',
    version: '17.3.1'
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
    browser: 'safari',
    os: 'mac',
    version: '17.2.1'
  },

  // Edge on Windows
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.2365.66',
    browser: 'edge',
    os: 'windows',
    version: '122.0.2365.66'
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.2277.128',
    browser: 'edge',
    os: 'windows',
    version: '121.0.2277.128'
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.144',
    browser: 'edge',
    os: 'windows',
    version: '120.0.2210.144'
  },

  // Edge on Mac
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.2365.66',
    browser: 'edge',
    os: 'mac',
    version: '122.0.2365.66'
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.2365.66',
    browser: 'edge',
    os: 'mac',
    version: '122.0.2365.66'
  },

  // Edge on Linux
  {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.2365.66',
    browser: 'edge',
    os: 'linux',
    version: '122.0.2365.66'
  }
];

// =============================================================================
// User Agent Rotator Class
// =============================================================================

/**
 * UserAgentRotator class for managing user agent rotation
 */
class UserAgentRotator {
  /**
   * Create a new UserAgentRotator instance
   * @param {Object} options - Rotator configuration
   * @param {Object} options.logger - Optional logger instance
   */
  constructor(options = {}) {
    this.logger = options.logger || null;
    this.currentUserAgent = null;
    this.originalUserAgent = null;
    this.rotationHistory = [];
    this.maxHistorySize = 100;
    this.isActive = false;
    this.ruleId = null;
  }

  /**
   * Log a message if logger is available
   * @private
   */
  _log(level, message, data = {}) {
    if (this.logger && typeof this.logger[level] === 'function') {
      this.logger[level](message, data);
    }
  }

  /**
   * Get all available user agents
   * @returns {Array} Array of user agent objects
   */
  getAllUserAgents() {
    return USER_AGENTS.map(ua => ({
      userAgent: ua.userAgent,
      browser: ua.browser,
      os: ua.os,
      version: ua.version
    }));
  }

  /**
   * Get a random user agent
   * @returns {Object} Random user agent object
   */
  getRandomUserAgent() {
    const index = Math.floor(Math.random() * USER_AGENTS.length);
    const ua = USER_AGENTS[index];
    this._log('debug', 'Selected random user agent', { browser: ua.browser, os: ua.os });
    return {
      userAgent: ua.userAgent,
      browser: ua.browser,
      os: ua.os,
      version: ua.version
    };
  }

  /**
   * Get user agents filtered by OS
   * @param {string} os - Operating system ('windows', 'mac', 'linux')
   * @returns {Array} Filtered user agent objects
   */
  getUserAgentsByOS(os) {
    const normalizedOS = os.toLowerCase();
    const filtered = USER_AGENTS.filter(ua => ua.os === normalizedOS);

    if (filtered.length === 0) {
      this._log('warn', 'No user agents found for OS', { os });
      return [];
    }

    return filtered.map(ua => ({
      userAgent: ua.userAgent,
      browser: ua.browser,
      os: ua.os,
      version: ua.version
    }));
  }

  /**
   * Get a random user agent for a specific OS
   * @param {string} os - Operating system ('windows', 'mac', 'linux')
   * @returns {Object|null} Random user agent for the OS, or null if none found
   */
  getUserAgentByOS(os) {
    const agents = this.getUserAgentsByOS(os);
    if (agents.length === 0) {
      return null;
    }
    const index = Math.floor(Math.random() * agents.length);
    return agents[index];
  }

  /**
   * Get user agents filtered by browser
   * @param {string} browser - Browser name ('chrome', 'firefox', 'safari', 'edge')
   * @returns {Array} Filtered user agent objects
   */
  getUserAgentsByBrowser(browser) {
    const normalizedBrowser = browser.toLowerCase();
    const filtered = USER_AGENTS.filter(ua => ua.browser === normalizedBrowser);

    if (filtered.length === 0) {
      this._log('warn', 'No user agents found for browser', { browser });
      return [];
    }

    return filtered.map(ua => ({
      userAgent: ua.userAgent,
      browser: ua.browser,
      os: ua.os,
      version: ua.version
    }));
  }

  /**
   * Get a random user agent for a specific browser
   * @param {string} browser - Browser name ('chrome', 'firefox', 'safari', 'edge')
   * @returns {Object|null} Random user agent for the browser, or null if none found
   */
  getUserAgentByBrowser(browser) {
    const agents = this.getUserAgentsByBrowser(browser);
    if (agents.length === 0) {
      return null;
    }
    const index = Math.floor(Math.random() * agents.length);
    return agents[index];
  }

  /**
   * Get user agents filtered by both browser and OS
   * @param {string} browser - Browser name
   * @param {string} os - Operating system
   * @returns {Array} Filtered user agent objects
   */
  getUserAgentsByBrowserAndOS(browser, os) {
    const normalizedBrowser = browser.toLowerCase();
    const normalizedOS = os.toLowerCase();
    const filtered = USER_AGENTS.filter(
      ua => ua.browser === normalizedBrowser && ua.os === normalizedOS
    );

    return filtered.map(ua => ({
      userAgent: ua.userAgent,
      browser: ua.browser,
      os: ua.os,
      version: ua.version
    }));
  }

  /**
   * Set the current user agent using declarativeNetRequest
   * @param {string} userAgent - User agent string to set
   * @returns {Promise<Object>} Result of the operation
   */
  async setUserAgent(userAgent) {
    try {
      // Store original user agent on first set
      if (!this.originalUserAgent) {
        this.originalUserAgent = navigator.userAgent;
      }

      // Remove existing rule if present
      if (this.ruleId) {
        await this.removeUserAgentRule();
      }

      // Generate a unique rule ID
      this.ruleId = Math.floor(Math.random() * 1000000) + 1;

      // Create the declarativeNetRequest rule
      const rule = {
        id: this.ruleId,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            {
              header: 'User-Agent',
              operation: 'set',
              value: userAgent
            }
          ]
        },
        condition: {
          urlFilter: '*',
          resourceTypes: [
            'main_frame',
            'sub_frame',
            'stylesheet',
            'script',
            'image',
            'font',
            'object',
            'xmlhttprequest',
            'ping',
            'csp_report',
            'media',
            'websocket',
            'webtransport',
            'webbundle',
            'other'
          ]
        }
      };

      // Update dynamic rules
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [rule],
        removeRuleIds: []
      });

      this.currentUserAgent = userAgent;
      this.isActive = true;

      // Add to rotation history
      this._addToHistory(userAgent);

      this._log('info', 'User agent set successfully', { userAgent: userAgent.substring(0, 50) + '...' });

      return {
        success: true,
        message: 'User agent set successfully',
        userAgent: userAgent,
        ruleId: this.ruleId
      };
    } catch (error) {
      this._log('error', 'Failed to set user agent', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Remove the current user agent rule
   * @returns {Promise<Object>} Result of the operation
   */
  async removeUserAgentRule() {
    try {
      if (this.ruleId) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          addRules: [],
          removeRuleIds: [this.ruleId]
        });
        this._log('debug', 'User agent rule removed', { ruleId: this.ruleId });
      }

      this.ruleId = null;
      return { success: true };
    } catch (error) {
      this._log('error', 'Failed to remove user agent rule', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Rotate to a new random user agent
   * @param {Object} options - Rotation options
   * @param {string} options.browser - Optional browser filter
   * @param {string} options.os - Optional OS filter
   * @returns {Promise<Object>} Result with new user agent
   */
  async rotateUserAgent(options = {}) {
    let newAgent;

    if (options.browser && options.os) {
      const agents = this.getUserAgentsByBrowserAndOS(options.browser, options.os);
      if (agents.length === 0) {
        return {
          success: false,
          error: `No user agents found for browser '${options.browser}' and OS '${options.os}'`
        };
      }
      newAgent = agents[Math.floor(Math.random() * agents.length)];
    } else if (options.browser) {
      newAgent = this.getUserAgentByBrowser(options.browser);
      if (!newAgent) {
        return {
          success: false,
          error: `No user agents found for browser '${options.browser}'`
        };
      }
    } else if (options.os) {
      newAgent = this.getUserAgentByOS(options.os);
      if (!newAgent) {
        return {
          success: false,
          error: `No user agents found for OS '${options.os}'`
        };
      }
    } else {
      newAgent = this.getRandomUserAgent();
    }

    // Avoid setting the same user agent
    if (this.currentUserAgent === newAgent.userAgent) {
      // Try once more to get a different one
      const agents = options.browser
        ? this.getUserAgentsByBrowser(options.browser)
        : options.os
          ? this.getUserAgentsByOS(options.os)
          : this.getAllUserAgents();

      const different = agents.filter(a => a.userAgent !== this.currentUserAgent);
      if (different.length > 0) {
        newAgent = different[Math.floor(Math.random() * different.length)];
      }
    }

    const result = await this.setUserAgent(newAgent.userAgent);

    if (result.success) {
      return {
        success: true,
        message: 'User agent rotated successfully',
        userAgent: newAgent.userAgent,
        browser: newAgent.browser,
        os: newAgent.os,
        version: newAgent.version
      };
    }

    return result;
  }

  /**
   * Reset to the original user agent
   * @returns {Promise<Object>} Result of the operation
   */
  async resetUserAgent() {
    try {
      await this.removeUserAgentRule();

      this.currentUserAgent = null;
      this.isActive = false;

      this._log('info', 'User agent reset to original');

      return {
        success: true,
        message: 'User agent reset to original',
        originalUserAgent: this.originalUserAgent
      };
    } catch (error) {
      this._log('error', 'Failed to reset user agent', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current user agent state
   * @returns {Object} Current state
   */
  getState() {
    return {
      isActive: this.isActive,
      currentUserAgent: this.currentUserAgent,
      originalUserAgent: this.originalUserAgent,
      ruleId: this.ruleId,
      historyCount: this.rotationHistory.length
    };
  }

  /**
   * Get rotation history
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array} Rotation history
   */
  getHistory(limit = 10) {
    return this.rotationHistory.slice(-limit);
  }

  /**
   * Add to rotation history
   * @private
   */
  _addToHistory(userAgent) {
    this.rotationHistory.push({
      userAgent,
      timestamp: Date.now()
    });

    // Trim history if too large
    if (this.rotationHistory.length > this.maxHistorySize) {
      this.rotationHistory = this.rotationHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Clear rotation history
   * @returns {Object} Result
   */
  clearHistory() {
    const count = this.rotationHistory.length;
    this.rotationHistory = [];
    return {
      success: true,
      message: `Cleared ${count} history entries`
    };
  }

  /**
   * Get summary statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const browserCounts = {};
    const osCounts = {};

    USER_AGENTS.forEach(ua => {
      browserCounts[ua.browser] = (browserCounts[ua.browser] || 0) + 1;
      osCounts[ua.os] = (osCounts[ua.os] || 0) + 1;
    });

    return {
      totalUserAgents: USER_AGENTS.length,
      browserCounts,
      osCounts,
      isActive: this.isActive,
      rotationsPerformed: this.rotationHistory.length
    };
  }
}

// =============================================================================
// Standalone Helper Functions (for backward compatibility)
// =============================================================================

/**
 * Get a random user agent string
 * @returns {string} Random user agent string
 */
function getRandomUserAgent() {
  const index = Math.floor(Math.random() * USER_AGENTS.length);
  return USER_AGENTS[index].userAgent;
}

/**
 * Get a random user agent for a specific OS
 * @param {string} os - Operating system ('windows', 'mac', 'linux')
 * @returns {string|null} User agent string or null
 */
function getUserAgentByOS(os) {
  const normalizedOS = os.toLowerCase();
  const filtered = USER_AGENTS.filter(ua => ua.os === normalizedOS);
  if (filtered.length === 0) return null;
  const index = Math.floor(Math.random() * filtered.length);
  return filtered[index].userAgent;
}

/**
 * Get a random user agent for a specific browser
 * @param {string} browser - Browser name ('chrome', 'firefox', 'safari', 'edge')
 * @returns {string|null} User agent string or null
 */
function getUserAgentByBrowser(browser) {
  const normalizedBrowser = browser.toLowerCase();
  const filtered = USER_AGENTS.filter(ua => ua.browser === normalizedBrowser);
  if (filtered.length === 0) return null;
  const index = Math.floor(Math.random() * filtered.length);
  return filtered[index].userAgent;
}

/**
 * Rotate to a new random user agent (creates temporary instance)
 * @returns {Promise<Object>} Result with new user agent
 */
async function rotateUserAgent() {
  const rotator = new UserAgentRotator();
  return rotator.rotateUserAgent();
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.UserAgentRotator = UserAgentRotator;
  globalThis.USER_AGENTS = USER_AGENTS;
  globalThis.getRandomUserAgent = getRandomUserAgent;
  globalThis.getUserAgentByOS = getUserAgentByOS;
  globalThis.getUserAgentByBrowser = getUserAgentByBrowser;
  globalThis.rotateUserAgent = rotateUserAgent;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    UserAgentRotator,
    USER_AGENTS,
    getRandomUserAgent,
    getUserAgentByOS,
    getUserAgentByBrowser,
    rotateUserAgent
  };
}
