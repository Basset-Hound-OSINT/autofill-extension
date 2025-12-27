/**
 * Basset Hound Browser Automation - Rate Limiter
 *
 * Configurable rate limiting utility for bot detection evasion that provides:
 * - Human-like delay patterns with randomization
 * - Burst limiting to prevent rapid action sequences
 * - Action-specific delay profiles (click, type, navigate, scroll)
 * - Statistics tracking for monitoring
 * - Pause/resume functionality
 */

// =============================================================================
// Default Configuration
// =============================================================================

const RateLimitDefaults = {
  // Click delay: 100-300ms between clicks
  click: {
    minDelay: 100,
    maxDelay: 300,
    burstLimit: 10,
    burstPeriod: 5000  // 10 clicks per 5 seconds max
  },
  // Typing delay: 50-150ms between characters
  typing: {
    minDelay: 50,
    maxDelay: 150,
    burstLimit: 100,
    burstPeriod: 10000  // 100 chars per 10 seconds max
  },
  // Navigation delay: 500-2000ms between navigations
  navigation: {
    minDelay: 500,
    maxDelay: 2000,
    burstLimit: 5,
    burstPeriod: 30000  // 5 navigations per 30 seconds max
  },
  // Scroll delay: 100-500ms between scroll actions
  scroll: {
    minDelay: 100,
    maxDelay: 500,
    burstLimit: 20,
    burstPeriod: 5000  // 20 scrolls per 5 seconds max
  },
  // Default/generic delay
  default: {
    minDelay: 50,
    maxDelay: 200,
    burstLimit: 50,
    burstPeriod: 10000
  }
};

// =============================================================================
// RateLimiter Class
// =============================================================================

/**
 * RateLimiter class for human-like action timing
 */
class RateLimiter {
  /**
   * Create a new RateLimiter instance
   * @param {Object} options - Rate limiter configuration
   * @param {number} options.minDelay - Minimum delay in milliseconds (default: 50)
   * @param {number} options.maxDelay - Maximum delay in milliseconds (default: 200)
   * @param {number} options.burstLimit - Maximum actions per burst period (default: 50)
   * @param {number} options.burstPeriod - Burst period in milliseconds (default: 10000)
   * @param {string} options.actionType - Type of action for preset configuration
   * @param {boolean} options.enabled - Whether rate limiting is enabled (default: true)
   */
  constructor(options = {}) {
    // Apply preset if actionType is specified
    const preset = options.actionType && RateLimitDefaults[options.actionType]
      ? RateLimitDefaults[options.actionType]
      : RateLimitDefaults.default;

    this.minDelay = options.minDelay !== undefined ? options.minDelay : preset.minDelay;
    this.maxDelay = options.maxDelay !== undefined ? options.maxDelay : preset.maxDelay;
    this.burstLimit = options.burstLimit !== undefined ? options.burstLimit : preset.burstLimit;
    this.burstPeriod = options.burstPeriod !== undefined ? options.burstPeriod : preset.burstPeriod;
    this.enabled = options.enabled !== undefined ? options.enabled : true;

    // State
    this.paused = false;
    this.actionTimestamps = [];
    this.lastActionTime = 0;

    // Statistics
    this.stats = {
      totalActions: 0,
      totalWaitTime: 0,
      burstLimitHits: 0,
      averageDelay: 0,
      startTime: Date.now()
    };
  }

  /**
   * Wait for appropriate delay before next action
   * Returns immediately if rate limiting is disabled or paused
   * @returns {Promise<Object>} - Wait result with timing info
   */
  async wait() {
    if (!this.enabled) {
      return { waited: false, delay: 0, reason: 'disabled' };
    }

    if (this.paused) {
      // Wait until unpaused
      await this._waitUntilUnpaused();
      return { waited: true, delay: 0, reason: 'paused' };
    }

    // Calculate and apply burst limit
    const burstWaitTime = this._checkBurstLimit();
    if (burstWaitTime > 0) {
      this.stats.burstLimitHits++;
      await this._sleep(burstWaitTime);
    }

    // Calculate random delay within range
    const delay = this._getRandomDelay();

    // Calculate time since last action
    const now = Date.now();
    const timeSinceLastAction = now - this.lastActionTime;

    // If we've already waited long enough naturally, no additional delay needed
    let actualDelay = 0;
    if (timeSinceLastAction < delay) {
      actualDelay = delay - timeSinceLastAction;
      await this._sleep(actualDelay);
    }

    // Record action
    this._recordAction();

    return {
      waited: true,
      delay: actualDelay,
      calculatedDelay: delay,
      burstWaitTime,
      reason: 'rate_limited'
    };
  }

  /**
   * Set delay range in milliseconds
   * @param {number} min - Minimum delay
   * @param {number} max - Maximum delay
   * @returns {RateLimiter} - Returns this for chaining
   */
  setDelay(min, max) {
    if (typeof min !== 'number' || min < 0) {
      throw new Error('Minimum delay must be a non-negative number');
    }
    if (typeof max !== 'number' || max < min) {
      throw new Error('Maximum delay must be a number greater than or equal to minimum delay');
    }

    this.minDelay = min;
    this.maxDelay = max;
    return this;
  }

  /**
   * Set burst limit configuration
   * @param {number} count - Maximum actions per period
   * @param {number} period - Period in milliseconds
   * @returns {RateLimiter} - Returns this for chaining
   */
  setBurstLimit(count, period) {
    if (typeof count !== 'number' || count < 1) {
      throw new Error('Burst count must be a positive number');
    }
    if (typeof period !== 'number' || period < 1) {
      throw new Error('Burst period must be a positive number');
    }

    this.burstLimit = count;
    this.burstPeriod = period;
    return this;
  }

  /**
   * Reset rate limiter state
   * @returns {RateLimiter} - Returns this for chaining
   */
  reset() {
    this.actionTimestamps = [];
    this.lastActionTime = 0;
    this.paused = false;
    this.stats = {
      totalActions: 0,
      totalWaitTime: 0,
      burstLimitHits: 0,
      averageDelay: 0,
      startTime: Date.now()
    };
    return this;
  }

  /**
   * Get rate limiting statistics
   * @returns {Object} - Statistics object
   */
  getStats() {
    const now = Date.now();
    const runningTime = now - this.stats.startTime;

    return {
      totalActions: this.stats.totalActions,
      totalWaitTime: this.stats.totalWaitTime,
      burstLimitHits: this.stats.burstLimitHits,
      averageDelay: this.stats.totalActions > 0
        ? Math.round(this.stats.totalWaitTime / this.stats.totalActions)
        : 0,
      actionsPerSecond: runningTime > 0
        ? (this.stats.totalActions / (runningTime / 1000)).toFixed(2)
        : 0,
      runningTimeMs: runningTime,
      enabled: this.enabled,
      paused: this.paused,
      config: {
        minDelay: this.minDelay,
        maxDelay: this.maxDelay,
        burstLimit: this.burstLimit,
        burstPeriod: this.burstPeriod
      }
    };
  }

  /**
   * Pause rate limiting (actions will wait until resumed)
   * @returns {RateLimiter} - Returns this for chaining
   */
  pause() {
    this.paused = true;
    return this;
  }

  /**
   * Resume rate limiting
   * @returns {RateLimiter} - Returns this for chaining
   */
  resume() {
    this.paused = false;
    return this;
  }

  /**
   * Enable rate limiting
   * @returns {RateLimiter} - Returns this for chaining
   */
  enable() {
    this.enabled = true;
    return this;
  }

  /**
   * Disable rate limiting
   * @returns {RateLimiter} - Returns this for chaining
   */
  disable() {
    this.enabled = false;
    return this;
  }

  /**
   * Check if currently paused
   * @returns {boolean} - Paused state
   */
  isPaused() {
    return this.paused;
  }

  /**
   * Check if rate limiting is enabled
   * @returns {boolean} - Enabled state
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Apply a preset configuration for an action type
   * @param {string} actionType - Action type (click, typing, navigation, scroll)
   * @returns {RateLimiter} - Returns this for chaining
   */
  applyPreset(actionType) {
    const preset = RateLimitDefaults[actionType] || RateLimitDefaults.default;
    this.minDelay = preset.minDelay;
    this.maxDelay = preset.maxDelay;
    this.burstLimit = preset.burstLimit;
    this.burstPeriod = preset.burstPeriod;
    return this;
  }

  /**
   * Get current configuration
   * @returns {Object} - Current configuration
   */
  getConfig() {
    return {
      minDelay: this.minDelay,
      maxDelay: this.maxDelay,
      burstLimit: this.burstLimit,
      burstPeriod: this.burstPeriod,
      enabled: this.enabled,
      paused: this.paused
    };
  }

  /**
   * Set configuration from object
   * @param {Object} config - Configuration object
   * @returns {RateLimiter} - Returns this for chaining
   */
  setConfig(config) {
    if (config.minDelay !== undefined && config.maxDelay !== undefined) {
      this.setDelay(config.minDelay, config.maxDelay);
    }
    if (config.burstLimit !== undefined && config.burstPeriod !== undefined) {
      this.setBurstLimit(config.burstLimit, config.burstPeriod);
    }
    if (config.enabled !== undefined) {
      this.enabled = config.enabled;
    }
    if (config.paused !== undefined) {
      this.paused = config.paused;
    }
    return this;
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  /**
   * Get random delay between min and max
   * @private
   * @returns {number} - Random delay in milliseconds
   */
  _getRandomDelay() {
    return Math.floor(
      Math.random() * (this.maxDelay - this.minDelay + 1) + this.minDelay
    );
  }

  /**
   * Check burst limit and return wait time if exceeded
   * @private
   * @returns {number} - Wait time in milliseconds, 0 if not exceeded
   */
  _checkBurstLimit() {
    const now = Date.now();
    const periodStart = now - this.burstPeriod;

    // Remove timestamps older than burst period
    this.actionTimestamps = this.actionTimestamps.filter(
      ts => ts > periodStart
    );

    // If at burst limit, calculate wait time
    if (this.actionTimestamps.length >= this.burstLimit) {
      const oldestInPeriod = this.actionTimestamps[0];
      const waitUntil = oldestInPeriod + this.burstPeriod;
      return Math.max(0, waitUntil - now + 1);
    }

    return 0;
  }

  /**
   * Record an action for burst tracking
   * @private
   */
  _recordAction() {
    const now = Date.now();
    this.actionTimestamps.push(now);
    this.stats.totalActions++;

    if (this.lastActionTime > 0) {
      const delay = now - this.lastActionTime;
      this.stats.totalWaitTime += delay;
    }

    this.lastActionTime = now;
  }

  /**
   * Sleep for specified milliseconds
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wait until rate limiter is unpaused
   * @private
   * @returns {Promise<void>}
   */
  async _waitUntilUnpaused() {
    while (this.paused) {
      await this._sleep(100);
    }
  }
}

// =============================================================================
// RateLimiterManager Class
// =============================================================================

/**
 * Manager class for handling multiple rate limiters for different action types
 */
class RateLimiterManager {
  constructor() {
    this.limiters = new Map();
    this.globalPaused = false;

    // Initialize default limiters for each action type
    for (const [actionType, config] of Object.entries(RateLimitDefaults)) {
      this.limiters.set(actionType, new RateLimiter({
        ...config,
        actionType
      }));
    }
  }

  /**
   * Get rate limiter for specific action type
   * @param {string} actionType - Action type
   * @returns {RateLimiter} - Rate limiter instance
   */
  getLimiter(actionType) {
    if (!this.limiters.has(actionType)) {
      // Create new limiter with default config if not exists
      this.limiters.set(actionType, new RateLimiter({ actionType }));
    }
    return this.limiters.get(actionType);
  }

  /**
   * Wait for appropriate delay for action type
   * @param {string} actionType - Action type
   * @returns {Promise<Object>} - Wait result
   */
  async wait(actionType = 'default') {
    if (this.globalPaused) {
      await this._waitUntilUnpaused();
    }
    return this.getLimiter(actionType).wait();
  }

  /**
   * Set configuration for specific action type
   * @param {string} actionType - Action type
   * @param {Object} config - Configuration
   * @returns {RateLimiterManager} - Returns this for chaining
   */
  setConfig(actionType, config) {
    this.getLimiter(actionType).setConfig(config);
    return this;
  }

  /**
   * Get configuration for specific action type
   * @param {string} actionType - Action type
   * @returns {Object} - Configuration
   */
  getConfig(actionType) {
    return this.getLimiter(actionType).getConfig();
  }

  /**
   * Get all configurations
   * @returns {Object} - All configurations by action type
   */
  getAllConfigs() {
    const configs = {};
    for (const [actionType, limiter] of this.limiters) {
      configs[actionType] = limiter.getConfig();
    }
    return configs;
  }

  /**
   * Get statistics for all action types
   * @returns {Object} - Statistics by action type
   */
  getAllStats() {
    const stats = {};
    for (const [actionType, limiter] of this.limiters) {
      stats[actionType] = limiter.getStats();
    }
    stats.globalPaused = this.globalPaused;
    return stats;
  }

  /**
   * Pause all rate limiters
   * @returns {RateLimiterManager} - Returns this for chaining
   */
  pauseAll() {
    this.globalPaused = true;
    for (const limiter of this.limiters.values()) {
      limiter.pause();
    }
    return this;
  }

  /**
   * Resume all rate limiters
   * @returns {RateLimiterManager} - Returns this for chaining
   */
  resumeAll() {
    this.globalPaused = false;
    for (const limiter of this.limiters.values()) {
      limiter.resume();
    }
    return this;
  }

  /**
   * Reset all rate limiters
   * @returns {RateLimiterManager} - Returns this for chaining
   */
  resetAll() {
    for (const limiter of this.limiters.values()) {
      limiter.reset();
    }
    return this;
  }

  /**
   * Enable all rate limiters
   * @returns {RateLimiterManager} - Returns this for chaining
   */
  enableAll() {
    for (const limiter of this.limiters.values()) {
      limiter.enable();
    }
    return this;
  }

  /**
   * Disable all rate limiters
   * @returns {RateLimiterManager} - Returns this for chaining
   */
  disableAll() {
    for (const limiter of this.limiters.values()) {
      limiter.disable();
    }
    return this;
  }

  /**
   * Check if globally paused
   * @returns {boolean} - Paused state
   */
  isPaused() {
    return this.globalPaused;
  }

  /**
   * Wait until globally unpaused
   * @private
   * @returns {Promise<void>}
   */
  async _waitUntilUnpaused() {
    while (this.globalPaused) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.RateLimiter = RateLimiter;
  globalThis.RateLimiterManager = RateLimiterManager;
  globalThis.RateLimitDefaults = RateLimitDefaults;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RateLimiter, RateLimiterManager, RateLimitDefaults };
}
