/**
 * Hunter.io OSINT Handler
 *
 * Provides integration with the Hunter.io API v2 for:
 * - Domain email search (find all emails for a domain)
 * - Email finder (find specific person's email)
 * - Email verification (check if email is valid/deliverable)
 * - Email count (get count of emails for a domain)
 *
 * API Documentation: https://hunter.io/api-documentation/v2
 *
 * Rate Limiting: Varies by plan (free: 25 requests/month, paid: higher limits)
 */

// =============================================================================
// Configuration
// =============================================================================

const HUNTER_CONFIG = {
  API_BASE_URL: 'https://api.hunter.io/v2',
  USER_AGENT: 'BassetHound-OSINT-Extension',
  RATE_LIMIT: {
    maxRequests: 10,      // Conservative limit per minute
    windowMs: 60000       // 1 minute
  }
};

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Custom error class for Hunter.io API errors
 */
class HunterError extends Error {
  constructor(message, statusCode = null, errorType = 'unknown') {
    super(message);
    this.name = 'HunterError';
    this.statusCode = statusCode;
    this.errorType = errorType;
  }
}

// =============================================================================
// Rate Limiter for Hunter.io API
// =============================================================================

/**
 * Simple rate limiter for Hunter.io API compliance
 */
class HunterRateLimiter {
  constructor() {
    this.requestTimestamps = [];
    this.maxRequests = HUNTER_CONFIG.RATE_LIMIT.maxRequests;
    this.windowMs = HUNTER_CONFIG.RATE_LIMIT.windowMs;
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
const hunterRateLimiter = new HunterRateLimiter();

// =============================================================================
// API Request Helper
// =============================================================================

/**
 * Make an authenticated request to the Hunter.io API
 * @param {string} endpoint - API endpoint path
 * @param {Object} options - Request options
 * @param {string} options.apiKey - Hunter.io API key (required)
 * @param {Object} options.params - Query parameters
 * @returns {Promise<Object>} - API response
 */
async function makeHunterRequest(endpoint, options = {}) {
  const { apiKey, params = {} } = options;

  if (!apiKey) {
    return {
      success: false,
      error: 'Hunter.io API key is required',
      errorCode: 'API_KEY_REQUIRED'
    };
  }

  // Wait for rate limit slot
  await hunterRateLimiter.waitForSlot();

  // Build URL with query parameters
  const url = new URL(`${HUNTER_CONFIG.API_BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', apiKey);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': HUNTER_CONFIG.USER_AGENT
      }
    });

    const responseData = await response.json();

    // Handle different response codes
    if (response.status === 200) {
      return { success: true, data: responseData.data, meta: responseData.meta };
    }

    if (response.status === 401) {
      return {
        success: false,
        error: 'Unauthorized: Invalid API key',
        errorCode: 'UNAUTHORIZED'
      };
    }

    if (response.status === 403) {
      return {
        success: false,
        error: 'Forbidden: Insufficient permissions or quota exceeded',
        errorCode: 'FORBIDDEN'
      };
    }

    if (response.status === 404) {
      return {
        success: true,
        data: null,
        notFound: true,
        error: responseData.errors?.[0]?.details || 'Resource not found'
      };
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      return {
        success: false,
        error: `Rate limit exceeded. Retry after ${retryAfter || 'some time'}`,
        errorCode: 'RATE_LIMITED',
        retryAfter: retryAfter ? parseInt(retryAfter, 10) : null
      };
    }

    if (response.status === 422) {
      const errorDetails = responseData.errors?.[0]?.details || 'Invalid parameters';
      return {
        success: false,
        error: `Validation error: ${errorDetails}`,
        errorCode: 'VALIDATION_ERROR'
      };
    }

    // Handle other errors from response body
    if (responseData.errors && responseData.errors.length > 0) {
      return {
        success: false,
        error: responseData.errors[0].details || 'Unknown API error',
        errorCode: 'API_ERROR',
        statusCode: response.status
      };
    }

    return {
      success: false,
      error: `Hunter.io API error: ${response.status} ${response.statusText}`,
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
// Validation Helpers
// =============================================================================

/**
 * Validate domain format
 * @param {string} domain - Domain to validate
 * @returns {boolean} - True if valid domain
 */
function isValidDomain(domain) {
  const domainPattern = /^(?=.{1,253}$)(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)+[A-Za-z]{2,63}$/;
  return domainPattern.test(domain);
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// =============================================================================
// Main Hunter.io Functions
// =============================================================================

/**
 * Search for all emails associated with a domain
 * Returns email addresses found for a given domain along with
 * sources, department, and confidence scores.
 *
 * @param {string} domain - Domain to search (e.g., "example.com")
 * @param {string} apiKey - Hunter.io API key
 * @param {Object} options - Search options
 * @param {number} options.limit - Maximum number of results (default: 10, max: 100)
 * @param {number} options.offset - Offset for pagination (default: 0)
 * @param {string} options.type - Email type filter ('personal' or 'generic')
 * @param {string} options.seniority - Seniority filter ('junior', 'senior', 'executive')
 * @param {string} options.department - Department filter
 * @returns {Promise<Object>} - Domain search results
 */
async function searchDomain(domain, apiKey, options = {}) {
  // Validate domain
  if (!domain || typeof domain !== 'string') {
    return {
      success: false,
      error: 'Domain is required',
      errorCode: 'INVALID_INPUT'
    };
  }

  // Clean domain (remove protocol if present)
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();

  if (!isValidDomain(cleanDomain)) {
    return {
      success: false,
      error: 'Invalid domain format',
      errorCode: 'INVALID_DOMAIN'
    };
  }

  const params = {
    domain: cleanDomain,
    limit: Math.min(options.limit || 10, 100),
    offset: options.offset || 0
  };

  if (options.type && ['personal', 'generic'].includes(options.type)) {
    params.type = options.type;
  }

  if (options.seniority) {
    params.seniority = options.seniority;
  }

  if (options.department) {
    params.department = options.department;
  }

  const result = await makeHunterRequest('/domain-search', { apiKey, params });

  if (!result.success) {
    return result;
  }

  const data = result.data || {};
  const emails = data.emails || [];

  return {
    success: true,
    domain: cleanDomain,
    organization: data.organization || null,
    emailCount: emails.length,
    totalAvailable: result.meta?.results || 0,
    pattern: data.pattern || null,
    emails: emails.map(email => ({
      email: email.value,
      type: email.type,
      confidence: email.confidence,
      firstName: email.first_name || null,
      lastName: email.last_name || null,
      position: email.position || null,
      seniority: email.seniority || null,
      department: email.department || null,
      linkedin: email.linkedin || null,
      twitter: email.twitter || null,
      phoneNumber: email.phone_number || null,
      sources: (email.sources || []).map(source => ({
        domain: source.domain,
        uri: source.uri,
        extractedOn: source.extracted_on,
        lastSeenOn: source.last_seen_on,
        stillOnPage: source.still_on_page
      })),
      verificationStatus: email.verification ? {
        status: email.verification.status,
        date: email.verification.date
      } : null
    })),
    meta: {
      limit: params.limit,
      offset: params.offset,
      hasMore: (params.offset + emails.length) < (result.meta?.results || 0)
    }
  };
}

/**
 * Find a specific person's email address at a domain
 * Uses first name, last name, and domain to find the most likely email.
 *
 * @param {string} domain - Domain to search (e.g., "example.com")
 * @param {string} firstName - Person's first name
 * @param {string} lastName - Person's last name
 * @param {string} apiKey - Hunter.io API key
 * @returns {Promise<Object>} - Email finder results
 */
async function findEmail(domain, firstName, lastName, apiKey) {
  // Validate inputs
  if (!domain || typeof domain !== 'string') {
    return {
      success: false,
      error: 'Domain is required',
      errorCode: 'INVALID_INPUT'
    };
  }

  if (!firstName || typeof firstName !== 'string') {
    return {
      success: false,
      error: 'First name is required',
      errorCode: 'INVALID_INPUT'
    };
  }

  if (!lastName || typeof lastName !== 'string') {
    return {
      success: false,
      error: 'Last name is required',
      errorCode: 'INVALID_INPUT'
    };
  }

  // Clean domain
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();

  if (!isValidDomain(cleanDomain)) {
    return {
      success: false,
      error: 'Invalid domain format',
      errorCode: 'INVALID_DOMAIN'
    };
  }

  const params = {
    domain: cleanDomain,
    first_name: firstName.trim(),
    last_name: lastName.trim()
  };

  const result = await makeHunterRequest('/email-finder', { apiKey, params });

  if (!result.success) {
    return result;
  }

  if (result.notFound || !result.data) {
    return {
      success: true,
      found: false,
      domain: cleanDomain,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: null,
      message: 'No email found for this person at the specified domain'
    };
  }

  const data = result.data;

  return {
    success: true,
    found: true,
    domain: cleanDomain,
    firstName: data.first_name || firstName.trim(),
    lastName: data.last_name || lastName.trim(),
    email: data.email,
    confidence: data.score || 0,
    position: data.position || null,
    linkedin: data.linkedin || null,
    twitter: data.twitter || null,
    phoneNumber: data.phone_number || null,
    company: data.company || null,
    sources: (data.sources || []).map(source => ({
      domain: source.domain,
      uri: source.uri,
      extractedOn: source.extracted_on,
      lastSeenOn: source.last_seen_on,
      stillOnPage: source.still_on_page
    })),
    verificationStatus: data.verification ? {
      status: data.verification.status,
      date: data.verification.date
    } : null
  };
}

/**
 * Verify if an email address is valid and deliverable
 * Checks email format, domain, SMTP response, and mailbox existence.
 *
 * @param {string} email - Email address to verify
 * @param {string} apiKey - Hunter.io API key
 * @returns {Promise<Object>} - Email verification results
 */
async function verifyEmail(email, apiKey) {
  // Validate email
  if (!email || typeof email !== 'string') {
    return {
      success: false,
      error: 'Email address is required',
      errorCode: 'INVALID_INPUT'
    };
  }

  if (!isValidEmail(email)) {
    return {
      success: false,
      error: 'Invalid email format',
      errorCode: 'INVALID_EMAIL'
    };
  }

  const params = { email: email.toLowerCase().trim() };

  const result = await makeHunterRequest('/email-verifier', { apiKey, params });

  if (!result.success) {
    return result;
  }

  const data = result.data || {};

  // Map verification status
  const statusMap = {
    valid: 'deliverable',
    invalid: 'undeliverable',
    accept_all: 'risky',
    webmail: 'deliverable',
    disposable: 'risky',
    unknown: 'unknown'
  };

  return {
    success: true,
    email: data.email || email,
    status: data.status || 'unknown',
    deliverability: statusMap[data.status] || 'unknown',
    result: data.result || null,
    score: data.score || 0,
    checks: {
      regexp: data.regexp ?? null,
      gibberish: data.gibberish ?? null,
      disposable: data.disposable ?? null,
      webmail: data.webmail ?? null,
      mxRecords: data.mx_records ?? null,
      smtpServer: data.smtp_server ?? null,
      smtpCheck: data.smtp_check ?? null,
      acceptAll: data.accept_all ?? null,
      block: data.block ?? null
    },
    sources: data.sources || [],
    message: getVerificationMessage(data.status, data.result)
  };
}

/**
 * Get human-readable verification message
 * @param {string} status - Verification status
 * @param {string} result - Verification result
 * @returns {string} - Human-readable message
 */
function getVerificationMessage(status, result) {
  switch (status) {
    case 'valid':
      return 'Email address is valid and deliverable';
    case 'invalid':
      return result === 'undeliverable'
        ? 'Email address exists but is not deliverable'
        : 'Email address is invalid';
    case 'accept_all':
      return 'Server accepts all emails - cannot verify specific address';
    case 'webmail':
      return 'Email is a webmail address (Gmail, Yahoo, etc.)';
    case 'disposable':
      return 'Email is from a disposable email provider';
    case 'unknown':
    default:
      return 'Unable to verify email address';
  }
}

/**
 * Get the count of email addresses for a domain
 * Returns count without consuming domain search credits.
 *
 * @param {string} domain - Domain to check (e.g., "example.com")
 * @param {string} apiKey - Hunter.io API key
 * @returns {Promise<Object>} - Email count results
 */
async function getEmailCount(domain, apiKey) {
  // Validate domain
  if (!domain || typeof domain !== 'string') {
    return {
      success: false,
      error: 'Domain is required',
      errorCode: 'INVALID_INPUT'
    };
  }

  // Clean domain
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();

  if (!isValidDomain(cleanDomain)) {
    return {
      success: false,
      error: 'Invalid domain format',
      errorCode: 'INVALID_DOMAIN'
    };
  }

  const params = { domain: cleanDomain };

  const result = await makeHunterRequest('/email-count', { apiKey, params });

  if (!result.success) {
    return result;
  }

  const data = result.data || {};

  return {
    success: true,
    domain: cleanDomain,
    totalEmails: data.total || 0,
    personalEmails: data.personal_emails || 0,
    genericEmails: data.generic_emails || 0,
    departmentBreakdown: data.department || {},
    seniorityBreakdown: data.seniority || {},
    message: data.total > 0
      ? `Found ${data.total} email address${data.total === 1 ? '' : 'es'} for ${cleanDomain}`
      : `No email addresses found for ${cleanDomain}`
  };
}

// =============================================================================
// PalletAI Result Formatters
// =============================================================================

/**
 * Format Hunter.io results for palletAI consumption
 * Provides consistent structure for AI processing
 *
 * @param {Object} data - Raw Hunter.io result
 * @param {string} type - Type of query ('domain_search', 'email_finder', 'email_verify', 'email_count')
 * @returns {Object} - Formatted result for palletAI
 */
function formatHunterResults(data, type = 'domain_search') {
  const baseResult = {
    source: 'hunter.io',
    timestamp: new Date().toISOString(),
    type,
    success: data.success,
    rateLimit: hunterRateLimiter.getStatus()
  };

  if (!data.success) {
    return {
      ...baseResult,
      error: {
        message: data.error,
        code: data.errorCode,
        retryAfter: data.retryAfter
      },
      data: null,
      insights: []
    };
  }

  switch (type) {
    case 'domain_search':
      return formatDomainSearchResult(data, baseResult);
    case 'email_finder':
      return formatEmailFinderResult(data, baseResult);
    case 'email_verify':
      return formatEmailVerifyResult(data, baseResult);
    case 'email_count':
      return formatEmailCountResult(data, baseResult);
    default:
      return {
        ...baseResult,
        data: data
      };
  }
}

/**
 * Format domain search result for palletAI
 * @private
 */
function formatDomainSearchResult(data, baseResult) {
  const insights = [];

  if (data.pattern) {
    insights.push({
      type: 'pattern',
      severity: 'info',
      message: `Email pattern detected: ${data.pattern}`
    });
  }

  if (data.emailCount > 0) {
    insights.push({
      type: 'emails_found',
      severity: 'info',
      message: `Found ${data.emailCount} email${data.emailCount === 1 ? '' : 's'} (${data.totalAvailable} total available)`
    });

    // Group by confidence
    const highConfidence = data.emails.filter(e => e.confidence >= 80).length;
    const mediumConfidence = data.emails.filter(e => e.confidence >= 50 && e.confidence < 80).length;
    const lowConfidence = data.emails.filter(e => e.confidence < 50).length;

    if (highConfidence > 0) {
      insights.push({
        type: 'confidence',
        severity: 'info',
        message: `${highConfidence} email${highConfidence === 1 ? '' : 's'} with high confidence (80%+)`
      });
    }
  }

  return {
    ...baseResult,
    target: data.domain,
    data: {
      domain: data.domain,
      organization: data.organization,
      pattern: data.pattern,
      emailCount: data.emailCount,
      totalAvailable: data.totalAvailable,
      emails: data.emails.map(email => ({
        email: email.email,
        type: email.type,
        confidence: email.confidence,
        name: email.firstName && email.lastName
          ? `${email.firstName} ${email.lastName}`
          : null,
        position: email.position,
        department: email.department,
        verified: email.verificationStatus?.status === 'valid'
      })),
      pagination: data.meta
    },
    summary: {
      domain: data.domain,
      organization: data.organization,
      totalEmails: data.totalAvailable,
      returnedEmails: data.emailCount,
      pattern: data.pattern
    },
    insights,
    recommendation: data.emailCount > 0
      ? `Found ${data.emailCount} email addresses. Consider verifying high-confidence emails before use.`
      : 'No emails found. Try a different domain or check for subdomains.'
  };
}

/**
 * Format email finder result for palletAI
 * @private
 */
function formatEmailFinderResult(data, baseResult) {
  const insights = [];

  if (data.found) {
    insights.push({
      type: 'email_found',
      severity: 'info',
      message: `Email found with ${data.confidence}% confidence`
    });

    if (data.confidence >= 80) {
      insights.push({
        type: 'high_confidence',
        severity: 'info',
        message: 'High confidence - email likely correct'
      });
    } else if (data.confidence < 50) {
      insights.push({
        type: 'low_confidence',
        severity: 'warning',
        message: 'Low confidence - consider verifying before use'
      });
    }

    if (data.verificationStatus) {
      insights.push({
        type: 'verification',
        severity: data.verificationStatus.status === 'valid' ? 'info' : 'warning',
        message: `Verification status: ${data.verificationStatus.status}`
      });
    }
  }

  return {
    ...baseResult,
    target: `${data.firstName} ${data.lastName} @ ${data.domain}`,
    data: {
      found: data.found,
      email: data.email,
      confidence: data.confidence,
      person: {
        firstName: data.firstName,
        lastName: data.lastName,
        position: data.position,
        company: data.company
      },
      socialProfiles: {
        linkedin: data.linkedin,
        twitter: data.twitter
      },
      phoneNumber: data.phoneNumber,
      sources: data.sources,
      verificationStatus: data.verificationStatus
    },
    summary: {
      found: data.found,
      email: data.email,
      confidence: data.confidence,
      verified: data.verificationStatus?.status === 'valid'
    },
    insights,
    recommendation: data.found
      ? data.confidence >= 80
        ? 'Email found with high confidence. Safe to use.'
        : 'Email found but confidence is low. Recommend verification before use.'
      : 'No email found. Try alternative name variations or check LinkedIn for company.'
  };
}

/**
 * Format email verification result for palletAI
 * @private
 */
function formatEmailVerifyResult(data, baseResult) {
  const insights = [];

  insights.push({
    type: 'status',
    severity: data.status === 'valid' ? 'info' : data.status === 'invalid' ? 'high' : 'warning',
    message: data.message
  });

  if (data.checks.disposable) {
    insights.push({
      type: 'disposable',
      severity: 'warning',
      message: 'Email is from a disposable email provider'
    });
  }

  if (data.checks.acceptAll) {
    insights.push({
      type: 'accept_all',
      severity: 'warning',
      message: 'Server accepts all emails - cannot guarantee this specific address exists'
    });
  }

  if (data.checks.block) {
    insights.push({
      type: 'blocked',
      severity: 'warning',
      message: 'Email address is blocked or blacklisted'
    });
  }

  return {
    ...baseResult,
    target: data.email,
    data: {
      email: data.email,
      status: data.status,
      deliverability: data.deliverability,
      score: data.score,
      checks: data.checks,
      sources: data.sources
    },
    summary: {
      email: data.email,
      status: data.status,
      deliverability: data.deliverability,
      score: data.score
    },
    insights,
    recommendation: getVerificationRecommendation(data)
  };
}

/**
 * Get verification recommendation
 * @private
 */
function getVerificationRecommendation(data) {
  switch (data.status) {
    case 'valid':
      return 'Email is valid and deliverable. Safe to send.';
    case 'invalid':
      return 'Email is invalid. Do not send - it will bounce.';
    case 'accept_all':
      return 'Server accepts all emails. Send with caution - cannot verify mailbox exists.';
    case 'webmail':
      return 'Valid webmail address. Safe to send.';
    case 'disposable':
      return 'Disposable email address. May be temporary - use with caution.';
    case 'unknown':
    default:
      return 'Unable to verify. Consider alternative verification methods.';
  }
}

/**
 * Format email count result for palletAI
 * @private
 */
function formatEmailCountResult(data, baseResult) {
  const insights = [];

  if (data.totalEmails > 0) {
    insights.push({
      type: 'count',
      severity: 'info',
      message: data.message
    });

    if (data.personalEmails > 0 || data.genericEmails > 0) {
      insights.push({
        type: 'breakdown',
        severity: 'info',
        message: `${data.personalEmails} personal, ${data.genericEmails} generic emails`
      });
    }

    // Add department insights if available
    const departments = Object.entries(data.departmentBreakdown || {});
    if (departments.length > 0) {
      const topDepts = departments
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([dept, count]) => `${dept}: ${count}`)
        .join(', ');
      insights.push({
        type: 'departments',
        severity: 'info',
        message: `Top departments: ${topDepts}`
      });
    }
  } else {
    insights.push({
      type: 'no_results',
      severity: 'warning',
      message: 'No emails found for this domain'
    });
  }

  return {
    ...baseResult,
    target: data.domain,
    data: {
      domain: data.domain,
      totalEmails: data.totalEmails,
      personalEmails: data.personalEmails,
      genericEmails: data.genericEmails,
      departmentBreakdown: data.departmentBreakdown,
      seniorityBreakdown: data.seniorityBreakdown
    },
    summary: {
      domain: data.domain,
      totalEmails: data.totalEmails,
      personalEmails: data.personalEmails,
      genericEmails: data.genericEmails
    },
    insights,
    recommendation: data.totalEmails > 0
      ? `${data.totalEmails} emails available. Use domain search to retrieve detailed information.`
      : 'No emails found. Domain may have limited online presence or use email protection.'
  };
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.HunterHandler = {
    searchDomain,
    findEmail,
    verifyEmail,
    getEmailCount,
    formatHunterResults,
    getRateLimitStatus: () => hunterRateLimiter.getStatus(),
    HunterError
  };
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    searchDomain,
    findEmail,
    verifyEmail,
    getEmailCount,
    formatHunterResults,
    getRateLimitStatus: () => hunterRateLimiter.getStatus(),
    HunterError
  };
}
