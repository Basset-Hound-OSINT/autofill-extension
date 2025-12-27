/**
 * HaveIBeenPwned (HIBP) OSINT Handler
 *
 * Provides integration with the HaveIBeenPwned API v3 for:
 * - Email breach checking (requires API key)
 * - Password breach checking (k-anonymity, no API key required)
 * - Breach details lookup
 *
 * API Documentation: https://haveibeenpwned.com/API/v3
 *
 * Rate Limiting: 100 requests per minute (enforced by API)
 */

// =============================================================================
// Configuration
// =============================================================================

const HIBP_CONFIG = {
  API_BASE_URL: 'https://haveibeenpwned.com/api/v3',
  PASSWORD_API_URL: 'https://api.pwnedpasswords.com',
  USER_AGENT: 'BassetHound-OSINT-Extension',
  RATE_LIMIT: {
    maxRequests: 100,
    windowMs: 60000  // 1 minute
  }
};

// =============================================================================
// Rate Limiter for HIBP API
// =============================================================================

/**
 * Simple rate limiter for HIBP API compliance
 */
class HIBPRateLimiter {
  constructor() {
    this.requestTimestamps = [];
    this.maxRequests = HIBP_CONFIG.RATE_LIMIT.maxRequests;
    this.windowMs = HIBP_CONFIG.RATE_LIMIT.windowMs;
  }

  /**
   * Check if a request can be made within rate limits
   * @returns {Object} - { allowed: boolean, waitMs?: number }
   */
  canRequest() {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Remove timestamps outside the current window
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > windowStart);

    if (this.requestTimestamps.length >= this.maxRequests) {
      const oldestInWindow = this.requestTimestamps[0];
      const waitMs = (oldestInWindow + this.windowMs) - now + 100; // Add 100ms buffer
      return { allowed: false, waitMs };
    }

    return { allowed: true };
  }

  /**
   * Record a request timestamp
   */
  recordRequest() {
    this.requestTimestamps.push(Date.now());
  }

  /**
   * Wait until a request is allowed
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
   * Get current rate limit status
   * @returns {Object} - Rate limit status
   */
  getStatus() {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > windowStart);

    return {
      requestsInWindow: this.requestTimestamps.length,
      maxRequests: this.maxRequests,
      remainingRequests: Math.max(0, this.maxRequests - this.requestTimestamps.length),
      windowResetMs: this.requestTimestamps.length > 0
        ? (this.requestTimestamps[0] + this.windowMs) - now
        : 0
    };
  }
}

// Global rate limiter instance
const hibpRateLimiter = new HIBPRateLimiter();

// =============================================================================
// SHA-1 Hashing for Password Checking
// =============================================================================

/**
 * Compute SHA-1 hash of a string
 * @param {string} message - String to hash
 * @returns {Promise<string>} - Uppercase hex SHA-1 hash
 */
async function sha1Hash(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.toUpperCase();
}

// =============================================================================
// API Request Helper
// =============================================================================

/**
 * Make an authenticated request to the HIBP API
 * @param {string} endpoint - API endpoint path
 * @param {Object} options - Request options
 * @param {string} options.apiKey - HIBP API key (required for email endpoints)
 * @param {boolean} options.isPasswordApi - Whether this is a password API request
 * @returns {Promise<Object>} - API response
 */
async function makeHIBPRequest(endpoint, options = {}) {
  const { apiKey, isPasswordApi = false } = options;

  // Wait for rate limit slot
  await hibpRateLimiter.waitForSlot();

  const baseUrl = isPasswordApi
    ? HIBP_CONFIG.PASSWORD_API_URL
    : HIBP_CONFIG.API_BASE_URL;

  const url = `${baseUrl}${endpoint}`;

  const headers = {
    'User-Agent': HIBP_CONFIG.USER_AGENT
  };

  // API key required for email breach lookups
  if (!isPasswordApi && apiKey) {
    headers['hibp-api-key'] = apiKey;
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    // Handle different response codes
    if (response.status === 200) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return { success: true, data: await response.json() };
      }
      return { success: true, data: await response.text() };
    }

    if (response.status === 404) {
      // Not found - email not in breaches or breach doesn't exist
      return { success: true, data: null, notFound: true };
    }

    if (response.status === 401) {
      return {
        success: false,
        error: 'Unauthorized: Invalid or missing API key',
        errorCode: 'UNAUTHORIZED'
      };
    }

    if (response.status === 403) {
      return {
        success: false,
        error: 'Forbidden: API key required for this endpoint',
        errorCode: 'FORBIDDEN'
      };
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      return {
        success: false,
        error: `Rate limit exceeded. Retry after ${retryAfter || 'unknown'} seconds`,
        errorCode: 'RATE_LIMITED',
        retryAfter: retryAfter ? parseInt(retryAfter, 10) : null
      };
    }

    if (response.status === 503) {
      return {
        success: false,
        error: 'HIBP service temporarily unavailable',
        errorCode: 'SERVICE_UNAVAILABLE'
      };
    }

    return {
      success: false,
      error: `HIBP API error: ${response.status} ${response.statusText}`,
      errorCode: 'API_ERROR',
      statusCode: response.status
    };
  } catch (error) {
    return {
      success: false,
      error: `Network error: ${error.message}`,
      errorCode: 'NETWORK_ERROR'
    };
  }
}

// =============================================================================
// Main HIBP Functions
// =============================================================================

/**
 * Check if an email address appears in known data breaches
 * Requires a valid HIBP API key
 *
 * @param {string} email - Email address to check
 * @param {Object} options - Options
 * @param {string} options.apiKey - HIBP API key (required)
 * @param {boolean} options.truncateResponse - Truncate breach data (default: true)
 * @param {boolean} options.includeUnverified - Include unverified breaches (default: false)
 * @returns {Promise<Object>} - Breach results
 */
async function checkEmailBreach(email, options = {}) {
  const { apiKey, truncateResponse = true, includeUnverified = false } = options;

  // Validate email
  if (!email || typeof email !== 'string') {
    return {
      success: false,
      error: 'Email address is required',
      errorCode: 'INVALID_INPUT'
    };
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      success: false,
      error: 'Invalid email format',
      errorCode: 'INVALID_EMAIL'
    };
  }

  // API key is required for breach lookups
  if (!apiKey) {
    return {
      success: false,
      error: 'HIBP API key is required for email breach lookups',
      errorCode: 'API_KEY_REQUIRED'
    };
  }

  // Build query parameters
  const params = new URLSearchParams();
  if (truncateResponse) {
    params.append('truncateResponse', 'true');
  }
  if (includeUnverified) {
    params.append('includeUnverified', 'true');
  }

  const endpoint = `/breachedaccount/${encodeURIComponent(email)}?${params.toString()}`;

  const result = await makeHIBPRequest(endpoint, { apiKey });

  if (!result.success) {
    return result;
  }

  if (result.notFound) {
    return {
      success: true,
      breached: false,
      email,
      breachCount: 0,
      breaches: [],
      message: 'Email not found in any known data breaches'
    };
  }

  const breaches = result.data || [];

  return {
    success: true,
    breached: true,
    email,
    breachCount: breaches.length,
    breaches: breaches,
    message: `Email found in ${breaches.length} data breach${breaches.length === 1 ? '' : 'es'}`
  };
}

/**
 * Check if a password has been exposed in known data breaches
 * Uses k-anonymity model - only first 5 chars of SHA-1 hash are sent
 * No API key required
 *
 * @param {string} password - Password to check
 * @returns {Promise<Object>} - Password breach results
 */
async function checkPasswordBreach(password) {
  // Validate password
  if (!password || typeof password !== 'string') {
    return {
      success: false,
      error: 'Password is required',
      errorCode: 'INVALID_INPUT'
    };
  }

  try {
    // Compute SHA-1 hash
    const hash = await sha1Hash(password);

    // Split into prefix (first 5 chars) and suffix (rest)
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    // Request all hashes with the same prefix (k-anonymity)
    const endpoint = `/range/${prefix}`;
    const result = await makeHIBPRequest(endpoint, { isPasswordApi: true });

    if (!result.success) {
      return result;
    }

    // Parse the response - format is "SUFFIX:COUNT\r\n"
    const lines = result.data.split('\r\n').filter(line => line.length > 0);
    let exposureCount = 0;
    let found = false;

    for (const line of lines) {
      const [hashSuffix, count] = line.split(':');
      if (hashSuffix.toUpperCase() === suffix) {
        found = true;
        exposureCount = parseInt(count, 10);
        break;
      }
    }

    return {
      success: true,
      breached: found,
      exposureCount,
      message: found
        ? `Password has been exposed ${exposureCount.toLocaleString()} time${exposureCount === 1 ? '' : 's'} in data breaches`
        : 'Password not found in known data breaches',
      // Security note: We don't return any hash information
      secure: !found
    };
  } catch (error) {
    return {
      success: false,
      error: `Password check failed: ${error.message}`,
      errorCode: 'HASH_ERROR'
    };
  }
}

/**
 * Get detailed information about a specific breach
 * No API key required for breach metadata
 *
 * @param {string} breachName - Name of the breach (e.g., "LinkedIn", "Adobe")
 * @returns {Promise<Object>} - Breach details
 */
async function getBreachDetails(breachName) {
  // Validate breach name
  if (!breachName || typeof breachName !== 'string') {
    return {
      success: false,
      error: 'Breach name is required',
      errorCode: 'INVALID_INPUT'
    };
  }

  const endpoint = `/breach/${encodeURIComponent(breachName)}`;
  const result = await makeHIBPRequest(endpoint, {});

  if (!result.success) {
    return result;
  }

  if (result.notFound) {
    return {
      success: false,
      error: `Breach "${breachName}" not found`,
      errorCode: 'BREACH_NOT_FOUND'
    };
  }

  const breach = result.data;

  return {
    success: true,
    breach: {
      name: breach.Name,
      title: breach.Title,
      domain: breach.Domain,
      breachDate: breach.BreachDate,
      addedDate: breach.AddedDate,
      modifiedDate: breach.ModifiedDate,
      pwnCount: breach.PwnCount,
      description: breach.Description,
      dataClasses: breach.DataClasses,
      isVerified: breach.IsVerified,
      isFabricated: breach.IsFabricated,
      isSensitive: breach.IsSensitive,
      isRetired: breach.IsRetired,
      isSpamList: breach.IsSpamList,
      isMalware: breach.IsMalware,
      logoPath: breach.LogoPath
    }
  };
}

/**
 * Get list of all breaches in the HIBP database
 * No API key required
 *
 * @param {Object} options - Options
 * @param {string} options.domain - Filter by domain
 * @returns {Promise<Object>} - List of all breaches
 */
async function getAllBreaches(options = {}) {
  const { domain } = options;

  let endpoint = '/breaches';
  if (domain) {
    endpoint += `?domain=${encodeURIComponent(domain)}`;
  }

  const result = await makeHIBPRequest(endpoint, {});

  if (!result.success) {
    return result;
  }

  const breaches = result.data || [];

  return {
    success: true,
    count: breaches.length,
    breaches: breaches.map(breach => ({
      name: breach.Name,
      title: breach.Title,
      domain: breach.Domain,
      breachDate: breach.BreachDate,
      pwnCount: breach.PwnCount,
      dataClasses: breach.DataClasses,
      isVerified: breach.IsVerified
    }))
  };
}

// =============================================================================
// PalletAI Result Formatters
// =============================================================================

/**
 * Format breach results for palletAI consumption
 * Provides consistent structure for AI processing
 *
 * @param {Object} data - Raw breach check result
 * @param {string} type - Type of check ('email', 'password', 'breach_details', 'all_breaches')
 * @returns {Object} - Formatted result for palletAI
 */
function formatBreachResults(data, type = 'email') {
  const baseResult = {
    source: 'haveibeenpwned',
    timestamp: new Date().toISOString(),
    type,
    success: data.success,
    rateLimit: hibpRateLimiter.getStatus()
  };

  if (!data.success) {
    return {
      ...baseResult,
      error: {
        message: data.error,
        code: data.errorCode,
        retryAfter: data.retryAfter
      },
      data: null
    };
  }

  switch (type) {
    case 'email':
      return {
        ...baseResult,
        data: {
          email: data.email,
          status: data.breached ? 'breached' : 'clean',
          breachCount: data.breachCount,
          breaches: data.breaches?.map(breach => ({
            name: breach.Name || breach.name,
            title: breach.Title || breach.title,
            domain: breach.Domain || breach.domain,
            breachDate: breach.BreachDate || breach.breachDate,
            dataClasses: breach.DataClasses || breach.dataClasses
          })) || [],
          summary: data.message
        },
        recommendation: data.breached
          ? 'Email found in data breaches. Recommend password changes for affected accounts and enabling 2FA where available.'
          : 'Email not found in known data breaches.'
      };

    case 'password':
      return {
        ...baseResult,
        data: {
          status: data.breached ? 'exposed' : 'safe',
          exposureCount: data.exposureCount || 0,
          summary: data.message
        },
        recommendation: data.breached
          ? `Password has been exposed ${(data.exposureCount || 0).toLocaleString()} times. Strongly recommend using a different password.`
          : 'Password not found in known breaches. However, continue to use unique passwords for each account.'
      };

    case 'breach_details':
      return {
        ...baseResult,
        data: data.breach ? {
          name: data.breach.name,
          title: data.breach.title,
          domain: data.breach.domain,
          breachDate: data.breach.breachDate,
          recordCount: data.breach.pwnCount,
          description: data.breach.description,
          compromisedData: data.breach.dataClasses,
          verificationStatus: {
            isVerified: data.breach.isVerified,
            isFabricated: data.breach.isFabricated,
            isSensitive: data.breach.isSensitive,
            isRetired: data.breach.isRetired,
            isSpamList: data.breach.isSpamList,
            isMalware: data.breach.isMalware
          }
        } : null,
        recommendation: data.breach
          ? `Breach occurred on ${data.breach.breachDate}. ${(data.breach.pwnCount || 0).toLocaleString()} records affected.`
          : 'Breach not found.'
      };

    case 'all_breaches':
      return {
        ...baseResult,
        data: {
          totalBreaches: data.count,
          breaches: data.breaches
        }
      };

    default:
      return {
        ...baseResult,
        data: data
      };
  }
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.HIBPHandler = {
    checkEmailBreach,
    checkPasswordBreach,
    getBreachDetails,
    getAllBreaches,
    formatBreachResults,
    getRateLimitStatus: () => hibpRateLimiter.getStatus()
  };
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    checkEmailBreach,
    checkPasswordBreach,
    getBreachDetails,
    getAllBreaches,
    formatBreachResults,
    getRateLimitStatus: () => hibpRateLimiter.getStatus()
  };
}
