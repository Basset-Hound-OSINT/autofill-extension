/**
 * Basset Hound Browser Automation - Shodan OSINT Handler
 *
 * Shodan IP/device search integration for OSINT investigations.
 * Provides access to Shodan's search engine for internet-connected devices.
 *
 * Features:
 * - IP address information lookup
 * - Device/service search queries
 * - DNS hostname resolution
 * - Caller IP information
 * - Formatted results for palletAI consumption
 */

// =============================================================================
// Constants
// =============================================================================

const SHODAN_API_BASE = 'https://api.shodan.io';

// Shodan API rate limits (requests per second)
const RATE_LIMITS = {
  search: 1,      // 1 request per second for search
  host: 1,        // 1 request per second for host lookups
  dns: 1,         // 1 request per second for DNS
  info: 10        // 10 requests per second for account info
};

// HTTP status codes for error handling
const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500
};

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Custom error class for Shodan API errors
 */
class ShodanError extends Error {
  constructor(message, statusCode = null, errorType = 'unknown') {
    super(message);
    this.name = 'ShodanError';
    this.statusCode = statusCode;
    this.errorType = errorType;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Make an API request to Shodan
 * @param {string} endpoint - API endpoint path
 * @param {string} apiKey - Shodan API key
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - API response data
 */
async function shodanRequest(endpoint, apiKey, params = {}) {
  if (!apiKey) {
    throw new ShodanError('API key is required', null, 'missing_api_key');
  }

  // Build URL with query parameters
  const url = new URL(`${SHODAN_API_BASE}${endpoint}`);
  url.searchParams.set('key', apiKey);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    // Handle HTTP errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;

      switch (response.status) {
        case HTTP_STATUS.UNAUTHORIZED:
          throw new ShodanError('Invalid API key', response.status, 'invalid_api_key');
        case HTTP_STATUS.PAYMENT_REQUIRED:
          throw new ShodanError('Upgrade required - this feature requires a paid plan', response.status, 'upgrade_required');
        case HTTP_STATUS.FORBIDDEN:
          throw new ShodanError('Access denied - insufficient permissions', response.status, 'access_denied');
        case HTTP_STATUS.NOT_FOUND:
          throw new ShodanError('Resource not found', response.status, 'not_found');
        case HTTP_STATUS.TOO_MANY_REQUESTS:
          throw new ShodanError('Rate limit exceeded - please wait before making more requests', response.status, 'rate_limit');
        default:
          throw new ShodanError(errorMessage, response.status, 'api_error');
      }
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ShodanError) {
      throw error;
    }

    // Network or parsing errors
    throw new ShodanError(
      `Request failed: ${error.message}`,
      null,
      'network_error'
    );
  }
}

/**
 * Validate IP address format
 * @param {string} ip - IP address to validate
 * @returns {boolean} - True if valid IPv4 or IPv6
 */
function isValidIP(ip) {
  // IPv4 pattern
  const ipv4Pattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  // Simple IPv6 pattern (not comprehensive but catches most cases)
  const ipv6Pattern = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}$|^(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}$|^(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}$|^:(?::[0-9a-fA-F]{1,4}){1,7}$|^::$/;

  return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
}

/**
 * Validate hostname format
 * @param {string} hostname - Hostname to validate
 * @returns {boolean} - True if valid hostname
 */
function isValidHostname(hostname) {
  const hostnamePattern = /^(?=.{1,253}$)(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)+[A-Za-z]{2,63}$/;
  return hostnamePattern.test(hostname);
}

// =============================================================================
// Main API Functions
// =============================================================================

/**
 * Get information about an IP address from Shodan
 * Returns all available information about the IP including open ports,
 * running services, and banners.
 *
 * @param {string} ip - IP address to look up
 * @param {string} apiKey - Shodan API key
 * @param {Object} options - Additional options
 * @param {boolean} options.history - Include historical banners (default: false)
 * @param {boolean} options.minify - Minimize response size (default: false)
 * @returns {Promise<Object>} - Host information
 */
async function searchHost(ip, apiKey, options = {}) {
  // Validate IP address
  if (!ip) {
    throw new ShodanError('IP address is required', null, 'missing_ip');
  }

  if (!isValidIP(ip)) {
    throw new ShodanError(`Invalid IP address format: ${ip}`, null, 'invalid_ip');
  }

  const params = {};
  if (options.history) {
    params.history = 'true';
  }
  if (options.minify) {
    params.minify = 'true';
  }

  const data = await shodanRequest(`/shodan/host/${encodeURIComponent(ip)}`, apiKey, params);

  return {
    success: true,
    ip: data.ip_str || ip,
    data: data,
    summary: {
      ip: data.ip_str || ip,
      organization: data.org || null,
      asn: data.asn || null,
      isp: data.isp || null,
      country: data.country_name || null,
      countryCode: data.country_code || null,
      city: data.city || null,
      region: data.region_code || null,
      postalCode: data.postal_code || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      hostnames: data.hostnames || [],
      domains: data.domains || [],
      openPorts: data.ports || [],
      vulns: data.vulns || [],
      tags: data.tags || [],
      lastUpdate: data.last_update || null,
      serviceCount: (data.data || []).length
    }
  };
}

/**
 * Search Shodan for devices matching a query
 * Uses Shodan's search syntax for filtering results.
 *
 * @param {string} query - Shodan search query
 * @param {string} apiKey - Shodan API key
 * @param {Object} options - Search options
 * @param {number} options.page - Page number (default: 1)
 * @param {string} options.facets - Comma-separated list of facets
 * @param {boolean} options.minify - Minimize response size (default: false)
 * @returns {Promise<Object>} - Search results
 */
async function searchQuery(query, apiKey, options = {}) {
  if (!query) {
    throw new ShodanError('Search query is required', null, 'missing_query');
  }

  const params = {
    query: query
  };

  if (options.page && options.page > 0) {
    params.page = options.page;
  }
  if (options.facets) {
    params.facets = options.facets;
  }
  if (options.minify) {
    params.minify = 'true';
  }

  const data = await shodanRequest('/shodan/host/search', apiKey, params);

  return {
    success: true,
    query: query,
    data: data,
    summary: {
      total: data.total || 0,
      resultCount: (data.matches || []).length,
      facets: data.facets || {},
      matches: (data.matches || []).map(match => ({
        ip: match.ip_str,
        port: match.port,
        transport: match.transport || 'tcp',
        product: match.product || null,
        version: match.version || null,
        org: match.org || null,
        asn: match.asn || null,
        isp: match.isp || null,
        country: match.location?.country_name || null,
        countryCode: match.location?.country_code || null,
        city: match.location?.city || null,
        hostnames: match.hostnames || [],
        domains: match.domains || [],
        timestamp: match.timestamp || null,
        vulns: match.vulns || []
      }))
    }
  };
}

/**
 * Resolve hostnames to IP addresses using Shodan's DNS resolver
 *
 * @param {string|string[]} hostnames - Hostname(s) to resolve
 * @param {string} apiKey - Shodan API key
 * @returns {Promise<Object>} - DNS resolution results
 */
async function getDnsResolve(hostnames, apiKey) {
  if (!hostnames) {
    throw new ShodanError('Hostnames are required', null, 'missing_hostnames');
  }

  // Normalize to array
  const hostnameList = Array.isArray(hostnames) ? hostnames : [hostnames];

  if (hostnameList.length === 0) {
    throw new ShodanError('At least one hostname is required', null, 'empty_hostnames');
  }

  // Validate hostnames
  const invalidHostnames = hostnameList.filter(h => !isValidHostname(h));
  if (invalidHostnames.length > 0) {
    throw new ShodanError(
      `Invalid hostname format: ${invalidHostnames.join(', ')}`,
      null,
      'invalid_hostname'
    );
  }

  const params = {
    hostnames: hostnameList.join(',')
  };

  const data = await shodanRequest('/dns/resolve', apiKey, params);

  // Transform response to structured format
  const results = [];
  for (const [hostname, ip] of Object.entries(data || {})) {
    results.push({
      hostname: hostname,
      ip: ip,
      resolved: ip !== null
    });
  }

  return {
    success: true,
    data: data,
    summary: {
      totalQueried: hostnameList.length,
      resolved: results.filter(r => r.resolved).length,
      unresolved: results.filter(r => !r.resolved).length,
      results: results
    }
  };
}

/**
 * Get the caller's IP address and associated information
 *
 * @param {string} apiKey - Shodan API key
 * @returns {Promise<Object>} - Caller IP information
 */
async function getMyIP(apiKey) {
  const data = await shodanRequest('/tools/myip', apiKey);

  // The /tools/myip endpoint returns just the IP as a string
  const ip = typeof data === 'string' ? data : data.ip || data;

  return {
    success: true,
    ip: ip,
    data: { ip: ip },
    summary: {
      ip: ip,
      message: 'This is the public IP address of the caller'
    }
  };
}

// =============================================================================
// Result Formatting for palletAI
// =============================================================================

/**
 * Format Shodan results for palletAI consumption
 * Provides a standardized response format suitable for AI processing.
 *
 * @param {Object} data - Raw Shodan API response data
 * @param {string} queryType - Type of query (host, search, dns, myip)
 * @returns {Object} - Formatted result for palletAI
 */
function formatShodanResults(data, queryType = 'unknown') {
  const timestamp = new Date().toISOString();

  const baseResult = {
    source: 'shodan',
    queryType: queryType,
    timestamp: timestamp,
    success: data?.success ?? true
  };

  // Handle error responses
  if (data?.error || !data?.success) {
    return {
      ...baseResult,
      success: false,
      error: {
        message: data?.error || data?.message || 'Unknown error',
        type: data?.errorType || 'unknown',
        statusCode: data?.statusCode || null
      },
      data: null,
      summary: null,
      insights: []
    };
  }

  // Format based on query type
  switch (queryType) {
    case 'host':
      return formatHostResult(data, baseResult);
    case 'search':
      return formatSearchResult(data, baseResult);
    case 'dns':
      return formatDnsResult(data, baseResult);
    case 'myip':
      return formatMyIPResult(data, baseResult);
    default:
      return {
        ...baseResult,
        data: data.data || data,
        summary: data.summary || null,
        insights: []
      };
  }
}

/**
 * Format host lookup result for palletAI
 * @private
 */
function formatHostResult(data, baseResult) {
  const summary = data.summary || {};
  const rawData = data.data || {};

  // Generate insights from the data
  const insights = [];

  if (summary.openPorts && summary.openPorts.length > 0) {
    insights.push({
      type: 'ports',
      severity: 'info',
      message: `${summary.openPorts.length} open port(s) detected: ${summary.openPorts.slice(0, 10).join(', ')}${summary.openPorts.length > 10 ? '...' : ''}`
    });
  }

  if (summary.vulns && summary.vulns.length > 0) {
    insights.push({
      type: 'vulnerabilities',
      severity: 'high',
      message: `${summary.vulns.length} known vulnerability(s) associated with this host`,
      details: summary.vulns.slice(0, 5)
    });
  }

  if (summary.hostnames && summary.hostnames.length > 0) {
    insights.push({
      type: 'hostnames',
      severity: 'info',
      message: `${summary.hostnames.length} hostname(s) associated: ${summary.hostnames.slice(0, 5).join(', ')}`
    });
  }

  // Extract service information
  const services = (rawData.data || []).map(service => ({
    port: service.port,
    transport: service.transport || 'tcp',
    product: service.product || null,
    version: service.version || null,
    banner: service.data ? service.data.substring(0, 200) : null,
    module: service._shodan?.module || null
  }));

  return {
    ...baseResult,
    queryType: 'host',
    target: summary.ip,
    data: {
      ip: summary.ip,
      organization: summary.organization,
      asn: summary.asn,
      isp: summary.isp,
      location: {
        country: summary.country,
        countryCode: summary.countryCode,
        city: summary.city,
        region: summary.region,
        postalCode: summary.postalCode,
        coordinates: summary.latitude && summary.longitude
          ? { lat: summary.latitude, lon: summary.longitude }
          : null
      },
      hostnames: summary.hostnames,
      domains: summary.domains,
      openPorts: summary.openPorts,
      services: services,
      vulnerabilities: summary.vulns,
      tags: summary.tags,
      lastUpdate: summary.lastUpdate
    },
    summary: {
      ip: summary.ip,
      org: summary.organization,
      location: summary.city ? `${summary.city}, ${summary.country}` : summary.country,
      portCount: summary.openPorts?.length || 0,
      serviceCount: summary.serviceCount || 0,
      vulnCount: summary.vulns?.length || 0
    },
    insights: insights
  };
}

/**
 * Format search result for palletAI
 * @private
 */
function formatSearchResult(data, baseResult) {
  const summary = data.summary || {};

  const insights = [];

  if (summary.total > 0) {
    insights.push({
      type: 'results',
      severity: 'info',
      message: `Found ${summary.total.toLocaleString()} matching device(s)`
    });
  }

  // Analyze facets if available
  if (summary.facets) {
    for (const [facetName, facetData] of Object.entries(summary.facets)) {
      if (Array.isArray(facetData) && facetData.length > 0) {
        const topValues = facetData.slice(0, 3).map(f => `${f.value} (${f.count})`).join(', ');
        insights.push({
          type: 'facet',
          severity: 'info',
          message: `Top ${facetName}: ${topValues}`
        });
      }
    }
  }

  return {
    ...baseResult,
    queryType: 'search',
    query: data.query,
    data: {
      total: summary.total,
      matches: summary.matches || [],
      facets: summary.facets
    },
    summary: {
      query: data.query,
      totalResults: summary.total,
      returnedResults: summary.resultCount,
      facets: Object.keys(summary.facets || {})
    },
    insights: insights
  };
}

/**
 * Format DNS resolution result for palletAI
 * @private
 */
function formatDnsResult(data, baseResult) {
  const summary = data.summary || {};

  const insights = [];

  if (summary.resolved > 0) {
    insights.push({
      type: 'resolution',
      severity: 'info',
      message: `Successfully resolved ${summary.resolved} of ${summary.totalQueried} hostname(s)`
    });
  }

  if (summary.unresolved > 0) {
    const unresolvedNames = (summary.results || [])
      .filter(r => !r.resolved)
      .map(r => r.hostname);
    insights.push({
      type: 'unresolved',
      severity: 'warning',
      message: `Could not resolve: ${unresolvedNames.join(', ')}`
    });
  }

  return {
    ...baseResult,
    queryType: 'dns',
    data: {
      resolutions: summary.results || [],
      totalQueried: summary.totalQueried,
      resolved: summary.resolved,
      unresolved: summary.unresolved
    },
    summary: {
      totalQueried: summary.totalQueried,
      resolved: summary.resolved,
      unresolved: summary.unresolved
    },
    insights: insights
  };
}

/**
 * Format My IP result for palletAI
 * @private
 */
function formatMyIPResult(data, baseResult) {
  return {
    ...baseResult,
    queryType: 'myip',
    data: {
      ip: data.ip
    },
    summary: {
      ip: data.ip
    },
    insights: [{
      type: 'info',
      severity: 'info',
      message: `Your public IP address is ${data.ip}`
    }]
  };
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.ShodanHandler = {
    searchHost,
    searchQuery,
    getDnsResolve,
    getMyIP,
    formatShodanResults,
    ShodanError,
    RATE_LIMITS
  };
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    searchHost,
    searchQuery,
    getDnsResolve,
    getMyIP,
    formatShodanResults,
    ShodanError,
    RATE_LIMITS
  };
}
