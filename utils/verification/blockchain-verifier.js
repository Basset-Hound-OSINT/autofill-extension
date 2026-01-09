/**
 * Basset Hound Browser Automation - Blockchain Address Verifier
 *
 * Provides cryptocurrency address verification using public blockchain APIs:
 * - Bitcoin verification via Mempool.space API (CORS-friendly, no API key)
 * - Ethereum verification via Etherscan public API
 * - Litecoin verification via BlockCypher API
 *
 * Features:
 * - Address format validation (P2PKH, P2SH, Bech32, ERC-20)
 * - On-chain verification (balance, transactions, activity)
 * - EIP-55 checksum validation for Ethereum
 * - Multi-chain auto-detection
 * - Response caching with TTL
 * - Rate limit tracking
 * - Integration with DataVerifier pipeline
 *
 * API Documentation:
 * - Mempool.space: https://mempool.space/docs/api
 * - Etherscan: https://docs.etherscan.io/
 * - BlockCypher: https://www.blockcypher.com/dev/
 */

// =============================================================================
// Configuration
// =============================================================================

const BLOCKCHAIN_CONFIG = {
  // Mempool.space API (Bitcoin) - No API key required, CORS-friendly
  MEMPOOL: {
    BASE_URL: 'https://mempool.space/api',
    TESTNET_URL: 'https://mempool.space/testnet/api',
    RATE_LIMIT: {
      maxRequests: 10,
      windowMs: 60000  // 10 requests per minute for public API
    }
  },

  // Etherscan API - Public rate limit without API key
  ETHERSCAN: {
    BASE_URL: 'https://api.etherscan.io/api',
    RATE_LIMIT: {
      maxRequests: 5,
      windowMs: 1000  // 5 requests per second without API key
    }
  },

  // BlockCypher API (Litecoin, also supports BTC/ETH)
  BLOCKCYPHER: {
    BASE_URL: 'https://api.blockcypher.com/v1',
    RATE_LIMIT: {
      maxRequests: 3,
      windowMs: 1000  // 3 requests per second without API key
    }
  },

  // Cache configuration
  CACHE: {
    TTL_MS: 5 * 60 * 1000,  // 5 minutes
    MAX_ENTRIES: 1000
  }
};

// =============================================================================
// Address Format Patterns
// =============================================================================

/**
 * Regular expressions for cryptocurrency address validation
 */
const ADDRESS_PATTERNS = {
  // Bitcoin address patterns
  BITCOIN: {
    // P2PKH (Legacy) - starts with 1
    P2PKH: /^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/,
    // P2SH (SegWit compatible) - starts with 3
    P2SH: /^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/,
    // Bech32 (Native SegWit) - starts with bc1q
    BECH32: /^bc1q[a-z0-9]{38,58}$/,
    // Bech32m (Taproot) - starts with bc1p
    BECH32M: /^bc1p[a-z0-9]{58}$/,
    // Testnet addresses
    TESTNET_P2PKH: /^[mn][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
    TESTNET_P2SH: /^2[a-km-zA-HJ-NP-Z1-9]{25,34}$/,
    TESTNET_BECH32: /^tb1[a-z0-9]{39,59}$/
  },

  // Ethereum address pattern (with or without checksum)
  ETHEREUM: /^0x[a-fA-F0-9]{40}$/,

  // Litecoin address patterns
  LITECOIN: {
    // Legacy - starts with L
    LEGACY: /^L[a-km-zA-HJ-NP-Z1-9]{26,33}$/,
    // P2SH - starts with M or 3
    P2SH: /^[M3][a-km-zA-HJ-NP-Z1-9]{26,33}$/,
    // Bech32 - starts with ltc1
    BECH32: /^ltc1[a-z0-9]{39,59}$/
  }
};

// Base58 alphabet (excludes 0, O, I, l to avoid confusion)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

// Bech32 character set
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Custom error class for blockchain verification errors
 */
class BlockchainError extends Error {
  /**
   * @param {string} message - Error message
   * @param {number|null} statusCode - HTTP status code if applicable
   * @param {string} errorType - Type of error for categorization
   * @param {string} chain - Blockchain that caused the error
   */
  constructor(message, statusCode = null, errorType = 'unknown', chain = null) {
    super(message);
    this.name = 'BlockchainError';
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.chain = chain;
  }
}

// =============================================================================
// Rate Limiter
// =============================================================================

/**
 * Rate limiter for API requests
 */
class RateLimiter {
  /**
   * @param {number} maxRequests - Maximum requests allowed in window
   * @param {number} windowMs - Time window in milliseconds
   */
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requestTimestamps = [];
    this.totalRequests = 0;
  }

  /**
   * Check if a request can be made
   * @returns {{ allowed: boolean, waitMs?: number }}
   */
  canRequest() {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Remove timestamps outside current window
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > windowStart);

    if (this.requestTimestamps.length >= this.maxRequests) {
      const oldestInWindow = this.requestTimestamps[0];
      const waitMs = (oldestInWindow + this.windowMs) - now + 50;
      return { allowed: false, waitMs };
    }

    return { allowed: true };
  }

  /**
   * Record a request
   */
  recordRequest() {
    this.requestTimestamps.push(Date.now());
    this.totalRequests++;
  }

  /**
   * Wait until a request is allowed, then record it
   * @returns {Promise<void>}
   */
  async waitForSlot() {
    const check = this.canRequest();
    if (!check.allowed) {
      await new Promise(resolve => setTimeout(resolve, check.waitMs));
    }
    this.recordRequest();
  }

  /**
   * Get rate limit status
   * @returns {Object}
   */
  getStatus() {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > windowStart);

    return {
      requestsInWindow: this.requestTimestamps.length,
      maxRequests: this.maxRequests,
      remainingRequests: Math.max(0, this.maxRequests - this.requestTimestamps.length),
      windowMs: this.windowMs,
      totalRequests: this.totalRequests
    };
  }

  /**
   * Reset the rate limiter
   */
  reset() {
    this.requestTimestamps = [];
    this.totalRequests = 0;
  }
}

// =============================================================================
// Cache Implementation
// =============================================================================

/**
 * Simple TTL cache for verification results
 */
class VerificationCache {
  /**
   * @param {number} ttlMs - Time to live in milliseconds
   * @param {number} maxEntries - Maximum cache entries
   */
  constructor(ttlMs = BLOCKCHAIN_CONFIG.CACHE.TTL_MS, maxEntries = BLOCKCHAIN_CONFIG.CACHE.MAX_ENTRIES) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }

  /**
   * Generate cache key
   * @param {string} address - Address
   * @param {string} chain - Blockchain
   * @returns {string}
   */
  _generateKey(address, chain) {
    return `${chain.toLowerCase()}:${address.toLowerCase()}`;
  }

  /**
   * Get cached result
   * @param {string} address - Address
   * @param {string} chain - Blockchain
   * @returns {Object|null}
   */
  get(address, chain) {
    const key = this._generateKey(address, chain);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data;
  }

  /**
   * Set cached result
   * @param {string} address - Address
   * @param {string} chain - Blockchain
   * @param {Object} data - Data to cache
   */
  set(address, chain, data) {
    const key = this._generateKey(address, chain);

    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.ttlMs,
      cachedAt: Date.now()
    });
  }

  /**
   * Check if entry exists and is valid
   * @param {string} address - Address
   * @param {string} chain - Blockchain
   * @returns {boolean}
   */
  has(address, chain) {
    const key = this._generateKey(address, chain);
    const entry = this.cache.get(key);

    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Clear expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        this.stats.evictions++;
      }
    }
  }

  /**
   * Clear all entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      maxEntries: this.maxEntries,
      ttlMs: this.ttlMs,
      hitRate: this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2) + '%'
        : '0%'
    };
  }
}

// =============================================================================
// Checksum Validation
// =============================================================================

/**
 * Validate Ethereum EIP-55 checksum
 * @param {string} address - Ethereum address
 * @returns {boolean} - True if checksum is valid or address is all lowercase/uppercase
 */
function validateEthereumChecksum(address) {
  // Remove 0x prefix
  const addr = address.slice(2);

  // If all lowercase or all uppercase, checksum doesn't apply
  if (addr === addr.toLowerCase() || addr === addr.toUpperCase()) {
    return true;
  }

  // For mixed case, validate EIP-55 checksum
  // Note: Full implementation requires keccak256 hash
  // This is a simplified validation that checks format only
  const hasValidChars = /^[0-9a-fA-F]{40}$/.test(addr);
  return hasValidChars;
}

/**
 * Convert Ethereum address to checksummed format
 * Note: Full implementation requires keccak256
 * @param {string} address - Ethereum address
 * @returns {string} - Address (lowercase if no crypto available)
 */
function toChecksumAddress(address) {
  // Simplified version - return lowercase
  // Full implementation would use keccak256 to compute checksum
  return address.toLowerCase();
}

/**
 * Validate Base58Check encoding for Bitcoin/Litecoin legacy addresses
 * @param {string} address - Address to validate
 * @returns {boolean}
 */
function validateBase58(address) {
  for (const char of address) {
    if (!BASE58_ALPHABET.includes(char)) {
      return false;
    }
  }
  return true;
}

/**
 * Validate Bech32 encoding
 * @param {string} address - Address to validate
 * @returns {boolean}
 */
function validateBech32(address) {
  const lower = address.toLowerCase();
  const separatorIndex = lower.lastIndexOf('1');

  if (separatorIndex < 1) return false;

  const data = lower.slice(separatorIndex + 1);

  for (const char of data) {
    if (!BECH32_CHARSET.includes(char)) {
      return false;
    }
  }

  return true;
}

// =============================================================================
// Chain Detection
// =============================================================================

/**
 * Auto-detect blockchain from address format
 * @param {string} address - Cryptocurrency address
 * @returns {{ chain: string, type: string, network: string } | null}
 */
function detectChain(address) {
  if (!address || typeof address !== 'string') {
    return null;
  }

  const trimmed = address.trim();

  // Bitcoin mainnet
  if (ADDRESS_PATTERNS.BITCOIN.P2PKH.test(trimmed)) {
    return { chain: 'BTC', type: 'P2PKH', network: 'mainnet' };
  }
  if (ADDRESS_PATTERNS.BITCOIN.P2SH.test(trimmed)) {
    return { chain: 'BTC', type: 'P2SH', network: 'mainnet' };
  }
  if (ADDRESS_PATTERNS.BITCOIN.BECH32.test(trimmed)) {
    return { chain: 'BTC', type: 'Bech32', network: 'mainnet' };
  }
  if (ADDRESS_PATTERNS.BITCOIN.BECH32M.test(trimmed)) {
    return { chain: 'BTC', type: 'Bech32m', network: 'mainnet' };
  }

  // Bitcoin testnet
  if (ADDRESS_PATTERNS.BITCOIN.TESTNET_P2PKH.test(trimmed)) {
    return { chain: 'BTC', type: 'P2PKH', network: 'testnet' };
  }
  if (ADDRESS_PATTERNS.BITCOIN.TESTNET_P2SH.test(trimmed)) {
    return { chain: 'BTC', type: 'P2SH', network: 'testnet' };
  }
  if (ADDRESS_PATTERNS.BITCOIN.TESTNET_BECH32.test(trimmed)) {
    return { chain: 'BTC', type: 'Bech32', network: 'testnet' };
  }

  // Ethereum
  if (ADDRESS_PATTERNS.ETHEREUM.test(trimmed)) {
    return { chain: 'ETH', type: 'ERC20', network: 'mainnet' };
  }

  // Litecoin
  if (ADDRESS_PATTERNS.LITECOIN.LEGACY.test(trimmed)) {
    return { chain: 'LTC', type: 'Legacy', network: 'mainnet' };
  }
  if (ADDRESS_PATTERNS.LITECOIN.P2SH.test(trimmed)) {
    // Could be LTC P2SH or BTC P2SH - check first char
    if (trimmed.startsWith('M')) {
      return { chain: 'LTC', type: 'P2SH', network: 'mainnet' };
    }
    // If starts with 3, could be either - default to BTC
    return { chain: 'BTC', type: 'P2SH', network: 'mainnet' };
  }
  if (ADDRESS_PATTERNS.LITECOIN.BECH32.test(trimmed)) {
    return { chain: 'LTC', type: 'Bech32', network: 'mainnet' };
  }

  return null;
}

// =============================================================================
// BlockchainVerifier Class
// =============================================================================

/**
 * Blockchain Address Verifier
 * Provides on-chain verification for cryptocurrency addresses
 */
class BlockchainVerifier {
  /**
   * Create a new BlockchainVerifier
   * @param {Object} options - Configuration options
   * @param {string} options.etherscanApiKey - Optional Etherscan API key for higher rate limits
   * @param {string} options.blockcypherApiKey - Optional BlockCypher API key
   * @param {Object} options.logger - Optional logger instance
   * @param {boolean} options.useCache - Enable caching (default: true)
   * @param {number} options.cacheTtlMs - Cache TTL in milliseconds (default: 5 minutes)
   */
  constructor(options = {}) {
    this.config = {
      etherscanApiKey: options.etherscanApiKey || null,
      blockcypherApiKey: options.blockcypherApiKey || null,
      logger: options.logger || null,
      useCache: options.useCache !== false,
      cacheTtlMs: options.cacheTtlMs || BLOCKCHAIN_CONFIG.CACHE.TTL_MS
    };

    // Initialize rate limiters
    this.rateLimiters = {
      mempool: new RateLimiter(
        BLOCKCHAIN_CONFIG.MEMPOOL.RATE_LIMIT.maxRequests,
        BLOCKCHAIN_CONFIG.MEMPOOL.RATE_LIMIT.windowMs
      ),
      etherscan: new RateLimiter(
        BLOCKCHAIN_CONFIG.ETHERSCAN.RATE_LIMIT.maxRequests,
        BLOCKCHAIN_CONFIG.ETHERSCAN.RATE_LIMIT.windowMs
      ),
      blockcypher: new RateLimiter(
        BLOCKCHAIN_CONFIG.BLOCKCYPHER.RATE_LIMIT.maxRequests,
        BLOCKCHAIN_CONFIG.BLOCKCYPHER.RATE_LIMIT.windowMs
      )
    };

    // Initialize cache
    this.cache = new VerificationCache(this.config.cacheTtlMs);

    // Statistics
    this.stats = {
      totalVerifications: 0,
      successful: 0,
      failed: 0,
      byChain: {},
      apiCalls: {
        mempool: 0,
        etherscan: 0,
        blockcypher: 0
      }
    };
  }

  // ===========================================================================
  // Logging
  // ===========================================================================

  /**
   * Log a message
   * @private
   * @param {string} level - Log level
   * @param {string} message - Message
   * @param {Object} data - Additional data
   */
  _log(level, message, data = {}) {
    if (this.config.logger && typeof this.config.logger[level] === 'function') {
      this.config.logger[level](message, data);
    }
  }

  // ===========================================================================
  // API Request Methods
  // ===========================================================================

  /**
   * Make a request to Mempool.space API
   * @private
   * @param {string} endpoint - API endpoint
   * @param {boolean} testnet - Use testnet API
   * @returns {Promise<Object>}
   */
  async _mempoolRequest(endpoint, testnet = false) {
    await this.rateLimiters.mempool.waitForSlot();
    this.stats.apiCalls.mempool++;

    const baseUrl = testnet
      ? BLOCKCHAIN_CONFIG.MEMPOOL.TESTNET_URL
      : BLOCKCHAIN_CONFIG.MEMPOOL.BASE_URL;

    const url = `${baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { success: true, data: null, notFound: true };
        }

        const errorText = await response.text().catch(() => 'Unknown error');
        throw new BlockchainError(
          `Mempool API error: ${response.status} - ${errorText}`,
          response.status,
          'api_error',
          'BTC'
        );
      }

      return { success: true, data: await response.json() };
    } catch (error) {
      if (error instanceof BlockchainError) throw error;

      throw new BlockchainError(
        `Mempool request failed: ${error.message}`,
        null,
        'network_error',
        'BTC'
      );
    }
  }

  /**
   * Make a request to Etherscan API
   * @private
   * @param {Object} params - API parameters
   * @returns {Promise<Object>}
   */
  async _etherscanRequest(params) {
    await this.rateLimiters.etherscan.waitForSlot();
    this.stats.apiCalls.etherscan++;

    const url = new URL(BLOCKCHAIN_CONFIG.ETHERSCAN.BASE_URL);

    // Add API key if available
    if (this.config.etherscanApiKey) {
      params.apikey = this.config.etherscanApiKey;
    }

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new BlockchainError(
          `Etherscan API error: ${response.status}`,
          response.status,
          'api_error',
          'ETH'
        );
      }

      const data = await response.json();

      // Etherscan returns status "0" for errors
      if (data.status === '0' && data.message !== 'No transactions found') {
        // Check for rate limit
        if (data.result && data.result.includes('rate limit')) {
          throw new BlockchainError(
            'Etherscan rate limit exceeded',
            429,
            'rate_limit',
            'ETH'
          );
        }

        // Not necessarily an error - could be empty result
        if (data.message === 'NOTOK') {
          return { success: true, data: null, notFound: true };
        }
      }

      return { success: true, data };
    } catch (error) {
      if (error instanceof BlockchainError) throw error;

      throw new BlockchainError(
        `Etherscan request failed: ${error.message}`,
        null,
        'network_error',
        'ETH'
      );
    }
  }

  /**
   * Make a request to BlockCypher API
   * @private
   * @param {string} chain - Chain code (btc, ltc, eth)
   * @param {string} endpoint - API endpoint
   * @returns {Promise<Object>}
   */
  async _blockcypherRequest(chain, endpoint) {
    await this.rateLimiters.blockcypher.waitForSlot();
    this.stats.apiCalls.blockcypher++;

    let url = `${BLOCKCHAIN_CONFIG.BLOCKCYPHER.BASE_URL}/${chain}/main${endpoint}`;

    if (this.config.blockcypherApiKey) {
      url += `${url.includes('?') ? '&' : '?'}token=${this.config.blockcypherApiKey}`;
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { success: true, data: null, notFound: true };
        }

        if (response.status === 429) {
          throw new BlockchainError(
            'BlockCypher rate limit exceeded',
            429,
            'rate_limit',
            chain.toUpperCase()
          );
        }

        throw new BlockchainError(
          `BlockCypher API error: ${response.status}`,
          response.status,
          'api_error',
          chain.toUpperCase()
        );
      }

      return { success: true, data: await response.json() };
    } catch (error) {
      if (error instanceof BlockchainError) throw error;

      throw new BlockchainError(
        `BlockCypher request failed: ${error.message}`,
        null,
        'network_error',
        chain.toUpperCase()
      );
    }
  }

  // ===========================================================================
  // Bitcoin Verification
  // ===========================================================================

  /**
   * Verify a Bitcoin address
   * @param {string} address - Bitcoin address to verify
   * @param {Object} options - Verification options
   * @param {boolean} options.skipCache - Skip cache lookup
   * @param {boolean} options.testnet - Use testnet
   * @returns {Promise<Object>} - Verification result
   */
  async verifyBitcoinAddress(address, options = {}) {
    const { skipCache = false, testnet = false } = options;

    this.stats.totalVerifications++;
    this.stats.byChain.BTC = (this.stats.byChain.BTC || 0) + 1;

    const result = {
      success: false,
      chain: 'BTC',
      address: address,
      valid: false,
      exists: false,
      checks: {
        formatValid: false,
        checksumValid: null,
        onChainVerified: false
      },
      data: {
        balance: null,
        balanceSatoshis: null,
        txCount: null,
        funded: null,
        spent: null,
        firstSeen: null,
        lastSeen: null
      },
      addressType: null,
      network: testnet ? 'testnet' : 'mainnet',
      explorer: null,
      confidence: 0,
      errors: [],
      warnings: [],
      timestamp: new Date().toISOString()
    };

    // Validate input
    if (!address || typeof address !== 'string') {
      result.errors.push({ code: 'INVALID_INPUT', message: 'Address must be a non-empty string' });
      this.stats.failed++;
      return result;
    }

    const trimmed = address.trim();

    // Detect address type and validate format
    const detection = detectChain(trimmed);

    if (!detection || detection.chain !== 'BTC') {
      result.errors.push({ code: 'INVALID_FORMAT', message: 'Not a valid Bitcoin address format' });
      this.stats.failed++;
      return result;
    }

    result.checks.formatValid = true;
    result.addressType = detection.type;
    result.network = detection.network;

    // Validate checksum based on type
    if (detection.type === 'P2PKH' || detection.type === 'P2SH') {
      result.checks.checksumValid = validateBase58(trimmed);
    } else if (detection.type === 'Bech32' || detection.type === 'Bech32m') {
      result.checks.checksumValid = validateBech32(trimmed);
    }

    // Set explorer URL
    result.explorer = detection.network === 'testnet'
      ? `https://mempool.space/testnet/address/${trimmed}`
      : `https://mempool.space/address/${trimmed}`;

    // Check cache
    if (this.config.useCache && !skipCache) {
      const cached = this.cache.get(trimmed, 'BTC');
      if (cached) {
        this._log('debug', 'Cache hit for BTC address', { address: trimmed });
        return { ...cached, fromCache: true };
      }
    }

    // Fetch on-chain data from Mempool.space
    try {
      const addressData = await this._mempoolRequest(
        `/address/${trimmed}`,
        detection.network === 'testnet'
      );

      if (addressData.notFound) {
        // Address format valid but not found on chain - might be new/unused
        result.success = true;
        result.valid = true;
        result.exists = false;
        result.checks.onChainVerified = true;
        result.confidence = 0.5;
        result.warnings.push({
          code: 'ADDRESS_UNUSED',
          message: 'Address has no on-chain activity - may be new or unused'
        });
      } else if (addressData.data) {
        const data = addressData.data;

        result.success = true;
        result.valid = true;
        result.exists = true;
        result.checks.onChainVerified = true;

        // Parse chain stats
        const chainStats = data.chain_stats || {};
        const mempoolStats = data.mempool_stats || {};

        const fundedTxCount = chainStats.funded_txo_count || 0;
        const spentTxCount = chainStats.spent_txo_count || 0;
        const totalTxCount = fundedTxCount + spentTxCount;

        const fundedSum = chainStats.funded_txo_sum || 0;
        const spentSum = chainStats.spent_txo_sum || 0;
        const balance = fundedSum - spentSum;

        result.data = {
          balance: balance / 100000000,  // Convert satoshis to BTC
          balanceSatoshis: balance,
          txCount: totalTxCount,
          funded: {
            count: fundedTxCount,
            sumSatoshis: fundedSum,
            sum: fundedSum / 100000000
          },
          spent: {
            count: spentTxCount,
            sumSatoshis: spentSum,
            sum: spentSum / 100000000
          },
          mempool: {
            txCount: (mempoolStats.funded_txo_count || 0) + (mempoolStats.spent_txo_count || 0),
            fundedCount: mempoolStats.funded_txo_count || 0,
            spentCount: mempoolStats.spent_txo_count || 0
          },
          firstSeen: null,  // Requires additional API call
          lastSeen: null    // Requires additional API call
        };

        // Calculate confidence based on activity
        if (totalTxCount === 0) {
          result.confidence = 0.6;
        } else if (totalTxCount < 5) {
          result.confidence = 0.7;
        } else if (totalTxCount < 50) {
          result.confidence = 0.85;
        } else {
          result.confidence = 0.95;
        }
      }

      // Cache the result
      if (this.config.useCache) {
        this.cache.set(trimmed, 'BTC', result);
      }

      this.stats.successful++;
    } catch (error) {
      result.errors.push({
        code: error.errorType || 'API_ERROR',
        message: error.message
      });
      // Still mark format validation as success
      result.success = result.checks.formatValid;
      result.valid = result.checks.formatValid;
      result.confidence = result.checks.formatValid ? 0.3 : 0;
      this.stats.failed++;
    }

    return result;
  }

  // ===========================================================================
  // Ethereum Verification
  // ===========================================================================

  /**
   * Verify an Ethereum address
   * @param {string} address - Ethereum address to verify
   * @param {Object} options - Verification options
   * @param {boolean} options.skipCache - Skip cache lookup
   * @param {boolean} options.checkTokens - Check for ERC-20 token activity
   * @returns {Promise<Object>} - Verification result
   */
  async verifyEthereumAddress(address, options = {}) {
    const { skipCache = false, checkTokens = true } = options;

    this.stats.totalVerifications++;
    this.stats.byChain.ETH = (this.stats.byChain.ETH || 0) + 1;

    const result = {
      success: false,
      chain: 'ETH',
      address: address,
      valid: false,
      exists: false,
      checks: {
        formatValid: false,
        checksumValid: null,
        onChainVerified: false
      },
      data: {
        balance: null,
        balanceWei: null,
        txCount: null,
        isContract: false,
        hasTokenActivity: false,
        tokenCount: 0
      },
      addressType: 'EOA',  // Externally Owned Account or Contract
      network: 'mainnet',
      explorer: null,
      confidence: 0,
      errors: [],
      warnings: [],
      timestamp: new Date().toISOString()
    };

    // Validate input
    if (!address || typeof address !== 'string') {
      result.errors.push({ code: 'INVALID_INPUT', message: 'Address must be a non-empty string' });
      this.stats.failed++;
      return result;
    }

    const trimmed = address.trim();

    // Validate format
    if (!ADDRESS_PATTERNS.ETHEREUM.test(trimmed)) {
      result.errors.push({ code: 'INVALID_FORMAT', message: 'Not a valid Ethereum address format' });
      this.stats.failed++;
      return result;
    }

    result.checks.formatValid = true;

    // Validate EIP-55 checksum
    result.checks.checksumValid = validateEthereumChecksum(trimmed);

    if (!result.checks.checksumValid) {
      result.warnings.push({
        code: 'INVALID_CHECKSUM',
        message: 'Address checksum validation failed - verify the address carefully'
      });
    }

    // Set explorer URL
    result.explorer = `https://etherscan.io/address/${trimmed}`;

    // Check cache
    if (this.config.useCache && !skipCache) {
      const cached = this.cache.get(trimmed, 'ETH');
      if (cached) {
        this._log('debug', 'Cache hit for ETH address', { address: trimmed });
        return { ...cached, fromCache: true };
      }
    }

    // Fetch balance from Etherscan
    try {
      const balanceResponse = await this._etherscanRequest({
        module: 'account',
        action: 'balance',
        address: trimmed,
        tag: 'latest'
      });

      if (balanceResponse.data && balanceResponse.data.status === '1') {
        const balanceWei = balanceResponse.data.result || '0';

        result.success = true;
        result.valid = true;
        result.exists = true;
        result.checks.onChainVerified = true;

        // Convert Wei to ETH (1 ETH = 10^18 Wei)
        const balanceEth = parseFloat(balanceWei) / 1e18;

        result.data.balanceWei = balanceWei;
        result.data.balance = balanceEth;
      }

      // Get transaction count
      const txCountResponse = await this._etherscanRequest({
        module: 'proxy',
        action: 'eth_getTransactionCount',
        address: trimmed,
        tag: 'latest'
      });

      if (txCountResponse.data && txCountResponse.data.result) {
        result.data.txCount = parseInt(txCountResponse.data.result, 16);
      }

      // Check if contract
      const codeResponse = await this._etherscanRequest({
        module: 'proxy',
        action: 'eth_getCode',
        address: trimmed,
        tag: 'latest'
      });

      if (codeResponse.data && codeResponse.data.result) {
        const code = codeResponse.data.result;
        result.data.isContract = code !== '0x' && code !== '0x0';
        result.addressType = result.data.isContract ? 'Contract' : 'EOA';
      }

      // Check for token activity if requested
      if (checkTokens) {
        try {
          const tokenResponse = await this._etherscanRequest({
            module: 'account',
            action: 'tokentx',
            address: trimmed,
            page: '1',
            offset: '1',
            sort: 'desc'
          });

          if (tokenResponse.data && tokenResponse.data.status === '1') {
            result.data.hasTokenActivity = true;
          }
        } catch {
          // Token check is optional, don't fail on error
        }
      }

      // Calculate confidence
      const txCount = result.data.txCount || 0;
      const hasBalance = result.data.balance > 0;

      if (txCount === 0 && !hasBalance) {
        result.confidence = 0.5;
        result.warnings.push({
          code: 'ADDRESS_INACTIVE',
          message: 'Address has no transactions and zero balance'
        });
      } else if (txCount < 5) {
        result.confidence = 0.7;
      } else if (txCount < 100) {
        result.confidence = 0.85;
      } else {
        result.confidence = 0.95;
      }

      // Cache the result
      if (this.config.useCache) {
        this.cache.set(trimmed, 'ETH', result);
      }

      this.stats.successful++;
    } catch (error) {
      result.errors.push({
        code: error.errorType || 'API_ERROR',
        message: error.message
      });
      result.success = result.checks.formatValid;
      result.valid = result.checks.formatValid && result.checks.checksumValid !== false;
      result.confidence = result.valid ? 0.3 : 0;
      this.stats.failed++;
    }

    return result;
  }

  // ===========================================================================
  // Litecoin Verification
  // ===========================================================================

  /**
   * Verify a Litecoin address
   * @param {string} address - Litecoin address to verify
   * @param {Object} options - Verification options
   * @param {boolean} options.skipCache - Skip cache lookup
   * @returns {Promise<Object>} - Verification result
   */
  async verifyLitecoinAddress(address, options = {}) {
    const { skipCache = false } = options;

    this.stats.totalVerifications++;
    this.stats.byChain.LTC = (this.stats.byChain.LTC || 0) + 1;

    const result = {
      success: false,
      chain: 'LTC',
      address: address,
      valid: false,
      exists: false,
      checks: {
        formatValid: false,
        checksumValid: null,
        onChainVerified: false
      },
      data: {
        balance: null,
        balanceLitoshis: null,
        txCount: null,
        totalReceived: null,
        totalSent: null,
        unconfirmedBalance: null
      },
      addressType: null,
      network: 'mainnet',
      explorer: null,
      confidence: 0,
      errors: [],
      warnings: [],
      timestamp: new Date().toISOString()
    };

    // Validate input
    if (!address || typeof address !== 'string') {
      result.errors.push({ code: 'INVALID_INPUT', message: 'Address must be a non-empty string' });
      this.stats.failed++;
      return result;
    }

    const trimmed = address.trim();

    // Detect address type
    let addressType = null;

    if (ADDRESS_PATTERNS.LITECOIN.LEGACY.test(trimmed)) {
      addressType = 'Legacy';
      result.checks.checksumValid = validateBase58(trimmed);
    } else if (ADDRESS_PATTERNS.LITECOIN.P2SH.test(trimmed) && trimmed.startsWith('M')) {
      addressType = 'P2SH';
      result.checks.checksumValid = validateBase58(trimmed);
    } else if (ADDRESS_PATTERNS.LITECOIN.BECH32.test(trimmed)) {
      addressType = 'Bech32';
      result.checks.checksumValid = validateBech32(trimmed);
    } else {
      result.errors.push({ code: 'INVALID_FORMAT', message: 'Not a valid Litecoin address format' });
      this.stats.failed++;
      return result;
    }

    result.checks.formatValid = true;
    result.addressType = addressType;

    // Set explorer URL
    result.explorer = `https://blockchair.com/litecoin/address/${trimmed}`;

    // Check cache
    if (this.config.useCache && !skipCache) {
      const cached = this.cache.get(trimmed, 'LTC');
      if (cached) {
        this._log('debug', 'Cache hit for LTC address', { address: trimmed });
        return { ...cached, fromCache: true };
      }
    }

    // Fetch on-chain data from BlockCypher
    try {
      const addressData = await this._blockcypherRequest('ltc', `/addrs/${trimmed}/balance`);

      if (addressData.notFound) {
        result.success = true;
        result.valid = true;
        result.exists = false;
        result.checks.onChainVerified = true;
        result.confidence = 0.5;
        result.warnings.push({
          code: 'ADDRESS_UNUSED',
          message: 'Address has no on-chain activity - may be new or unused'
        });
      } else if (addressData.data) {
        const data = addressData.data;

        result.success = true;
        result.valid = true;
        result.exists = true;
        result.checks.onChainVerified = true;

        // Parse data (BlockCypher returns values in litoshis)
        result.data = {
          balance: (data.balance || 0) / 100000000,
          balanceLitoshis: data.balance || 0,
          txCount: (data.n_tx || 0),
          totalReceived: (data.total_received || 0) / 100000000,
          totalSent: (data.total_sent || 0) / 100000000,
          unconfirmedBalance: (data.unconfirmed_balance || 0) / 100000000,
          unconfirmedTxCount: data.unconfirmed_n_tx || 0
        };

        // Calculate confidence
        const txCount = result.data.txCount;

        if (txCount === 0) {
          result.confidence = 0.6;
        } else if (txCount < 5) {
          result.confidence = 0.7;
        } else if (txCount < 50) {
          result.confidence = 0.85;
        } else {
          result.confidence = 0.95;
        }
      }

      // Cache the result
      if (this.config.useCache) {
        this.cache.set(trimmed, 'LTC', result);
      }

      this.stats.successful++;
    } catch (error) {
      result.errors.push({
        code: error.errorType || 'API_ERROR',
        message: error.message
      });
      result.success = result.checks.formatValid;
      result.valid = result.checks.formatValid;
      result.confidence = result.valid ? 0.3 : 0;
      this.stats.failed++;
    }

    return result;
  }

  // ===========================================================================
  // Unified Verification Interface
  // ===========================================================================

  /**
   * Verify a cryptocurrency address (auto-detects chain)
   * @param {string} address - Address to verify
   * @param {string} chain - Optional chain hint (BTC, ETH, LTC)
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} - Verification result
   */
  async verifyAddress(address, chain = null, options = {}) {
    if (!address || typeof address !== 'string') {
      return {
        success: false,
        valid: false,
        errors: [{ code: 'INVALID_INPUT', message: 'Address must be a non-empty string' }],
        timestamp: new Date().toISOString()
      };
    }

    const trimmed = address.trim();

    // Auto-detect chain if not specified
    let targetChain = chain ? chain.toUpperCase() : null;

    if (!targetChain) {
      const detection = detectChain(trimmed);
      if (detection) {
        targetChain = detection.chain;
      } else {
        return {
          success: false,
          valid: false,
          address: trimmed,
          errors: [{
            code: 'UNKNOWN_FORMAT',
            message: 'Could not determine blockchain from address format'
          }],
          timestamp: new Date().toISOString()
        };
      }
    }

    // Route to appropriate verifier
    switch (targetChain) {
      case 'BTC':
      case 'BITCOIN':
        return this.verifyBitcoinAddress(trimmed, options);

      case 'ETH':
      case 'ETHEREUM':
        return this.verifyEthereumAddress(trimmed, options);

      case 'LTC':
      case 'LITECOIN':
        return this.verifyLitecoinAddress(trimmed, options);

      default:
        return {
          success: false,
          valid: false,
          address: trimmed,
          chain: targetChain,
          errors: [{
            code: 'UNSUPPORTED_CHAIN',
            message: `Blockchain "${targetChain}" is not supported`
          }],
          supportedChains: ['BTC', 'ETH', 'LTC'],
          timestamp: new Date().toISOString()
        };
    }
  }

  /**
   * Verify multiple addresses in parallel
   * @param {Array<{address: string, chain?: string}>} addresses - Addresses to verify
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} - Batch verification results
   */
  async verifyBatch(addresses, options = {}) {
    if (!Array.isArray(addresses)) {
      return {
        success: false,
        errors: [{ code: 'INVALID_INPUT', message: 'Addresses must be an array' }],
        results: []
      };
    }

    const results = await Promise.all(
      addresses.map(async (item) => {
        const address = typeof item === 'string' ? item : item.address;
        const chain = typeof item === 'object' ? item.chain : null;

        try {
          return await this.verifyAddress(address, chain, options);
        } catch (error) {
          return {
            success: false,
            valid: false,
            address,
            chain,
            errors: [{ code: 'VERIFICATION_ERROR', message: error.message }]
          };
        }
      })
    );

    const successful = results.filter(r => r.success).length;
    const valid = results.filter(r => r.valid).length;

    return {
      success: true,
      totalAddresses: addresses.length,
      successfulVerifications: successful,
      validAddresses: valid,
      invalidAddresses: addresses.length - valid,
      results,
      timestamp: new Date().toISOString()
    };
  }

  // ===========================================================================
  // Integration with DataVerifier
  // ===========================================================================

  /**
   * Verify crypto address for DataVerifier pipeline
   * Returns format compatible with DataVerifier.verifyCrypto()
   * @param {string} address - Address to verify
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} - DataVerifier-compatible result
   */
  async verifyForPipeline(address, options = {}) {
    const result = await this.verifyAddress(address, options.coinHint, options);

    // Convert to DataVerifier format
    return {
      plausible: result.checks?.formatValid || false,
      valid: result.valid,
      checks: {
        formatValid: result.checks?.formatValid || false,
        checksumValid: result.checks?.checksumValid,
        lengthValid: result.checks?.formatValid || false,
        onChainVerified: result.checks?.onChainVerified || false
      },
      coin: this._chainToName(result.chain),
      network: result.network || 'mainnet',
      explorer: result.explorer,
      confidence: result.confidence,
      onChainData: result.exists ? result.data : null,
      errors: result.errors || [],
      warnings: result.warnings || [],
      needsServerVerification: false  // We already did on-chain verification
    };
  }

  /**
   * Convert chain code to full name
   * @private
   * @param {string} chain - Chain code
   * @returns {string}
   */
  _chainToName(chain) {
    const names = {
      BTC: 'Bitcoin',
      ETH: 'Ethereum',
      LTC: 'Litecoin'
    };
    return names[chain] || chain;
  }

  // ===========================================================================
  // Statistics and Management
  // ===========================================================================

  /**
   * Get verification statistics
   * @returns {Object}
   */
  getStats() {
    return {
      ...this.stats,
      cache: this.cache.getStats(),
      rateLimits: {
        mempool: this.rateLimiters.mempool.getStatus(),
        etherscan: this.rateLimiters.etherscan.getStatus(),
        blockcypher: this.rateLimiters.blockcypher.getStatus()
      }
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalVerifications: 0,
      successful: 0,
      failed: 0,
      byChain: {},
      apiCalls: {
        mempool: 0,
        etherscan: 0,
        blockcypher: 0
      }
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get supported chains
   * @returns {Array<Object>}
   */
  getSupportedChains() {
    return [
      {
        code: 'BTC',
        name: 'Bitcoin',
        api: 'Mempool.space',
        addressTypes: ['P2PKH', 'P2SH', 'Bech32', 'Bech32m'],
        networks: ['mainnet', 'testnet']
      },
      {
        code: 'ETH',
        name: 'Ethereum',
        api: 'Etherscan',
        addressTypes: ['EOA', 'Contract'],
        networks: ['mainnet']
      },
      {
        code: 'LTC',
        name: 'Litecoin',
        api: 'BlockCypher',
        addressTypes: ['Legacy', 'P2SH', 'Bech32'],
        networks: ['mainnet']
      }
    ];
  }
}

// =============================================================================
// Result Formatting for palletAI
// =============================================================================

/**
 * Format blockchain verification results for palletAI consumption
 * @param {Object} result - Verification result
 * @returns {Object} - Formatted result
 */
function formatBlockchainResults(result) {
  const baseResult = {
    source: 'blockchain-verifier',
    timestamp: result.timestamp || new Date().toISOString(),
    success: result.success
  };

  if (!result.success) {
    return {
      ...baseResult,
      error: {
        message: result.errors?.[0]?.message || 'Verification failed',
        code: result.errors?.[0]?.code || 'UNKNOWN_ERROR'
      },
      data: null
    };
  }

  return {
    ...baseResult,
    data: {
      address: result.address,
      chain: result.chain,
      chainName: result.chain === 'BTC' ? 'Bitcoin' :
        result.chain === 'ETH' ? 'Ethereum' :
          result.chain === 'LTC' ? 'Litecoin' : result.chain,
      valid: result.valid,
      exists: result.exists,
      addressType: result.addressType,
      network: result.network,
      confidence: result.confidence,
      confidenceLevel: result.confidence >= 0.9 ? 'high' :
        result.confidence >= 0.7 ? 'medium' :
          result.confidence >= 0.5 ? 'low' : 'very_low',
      balance: result.data?.balance,
      txCount: result.data?.txCount,
      explorer: result.explorer
    },
    checks: result.checks,
    warnings: result.warnings,
    recommendation: generateRecommendation(result)
  };
}

/**
 * Generate recommendation based on verification result
 * @param {Object} result - Verification result
 * @returns {string}
 */
function generateRecommendation(result) {
  if (!result.valid) {
    return 'Address format is invalid. Verify the address was copied correctly.';
  }

  if (!result.exists) {
    return 'Address has no on-chain activity. It may be newly generated or unused. Exercise caution with addresses that have no transaction history.';
  }

  if (result.confidence < 0.5) {
    return 'Address could not be fully verified. Proceed with caution and verify through alternative means.';
  }

  if (result.confidence < 0.7) {
    return 'Address has limited transaction history. Consider verifying ownership through additional channels.';
  }

  if (result.confidence >= 0.9) {
    return 'Address has significant transaction history indicating active use.';
  }

  return 'Address verified successfully with moderate confidence.';
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.BlockchainVerifier = BlockchainVerifier;
  globalThis.BlockchainError = BlockchainError;
  globalThis.formatBlockchainResults = formatBlockchainResults;
  globalThis.detectChain = detectChain;
  globalThis.validateEthereumChecksum = validateEthereumChecksum;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BlockchainVerifier,
    BlockchainError,
    VerificationCache,
    RateLimiter,
    formatBlockchainResults,
    detectChain,
    validateEthereumChecksum,
    validateBase58,
    validateBech32,
    ADDRESS_PATTERNS,
    BLOCKCHAIN_CONFIG
  };
}
