/**
 * Basset Hound Browser Automation - Social Media OSINT Handler
 *
 * OSINT Tool Integration for social media profile lookups.
 * Checks username availability across multiple platforms.
 *
 * Features:
 * - Username search across multiple platforms
 * - Individual platform checks
 * - Rate limiting with delays between checks
 * - Formatted results for palletAI consumption
 *
 * No API key required - uses public profile URL checks.
 */

// =============================================================================
// Configuration
// =============================================================================

const SocialMediaConfig = {
  // Request timeout in milliseconds
  TIMEOUT: 10000,

  // Delay between platform checks to avoid rate limiting (ms)
  DELAY_BETWEEN_CHECKS: 500,

  // Maximum concurrent requests
  MAX_CONCURRENT: 3,

  // Retry configuration
  MAX_RETRIES: 2,
  RETRY_DELAY: 1000,

  // Supported platforms with their URL patterns
  // {username} will be replaced with the actual username
  PLATFORMS: {
    twitter: {
      name: 'Twitter/X',
      url: 'https://x.com/{username}',
      alternateUrls: ['https://twitter.com/{username}'],
      icon: 'twitter'
    },
    github: {
      name: 'GitHub',
      url: 'https://github.com/{username}',
      icon: 'github'
    },
    linkedin: {
      name: 'LinkedIn',
      url: 'https://linkedin.com/in/{username}',
      icon: 'linkedin'
    },
    instagram: {
      name: 'Instagram',
      url: 'https://instagram.com/{username}',
      icon: 'instagram'
    },
    facebook: {
      name: 'Facebook',
      url: 'https://facebook.com/{username}',
      icon: 'facebook'
    },
    reddit: {
      name: 'Reddit',
      url: 'https://reddit.com/user/{username}',
      icon: 'reddit'
    },
    tiktok: {
      name: 'TikTok',
      url: 'https://tiktok.com/@{username}',
      icon: 'tiktok'
    },
    youtube: {
      name: 'YouTube',
      url: 'https://youtube.com/@{username}',
      icon: 'youtube'
    },
    pinterest: {
      name: 'Pinterest',
      url: 'https://pinterest.com/{username}',
      icon: 'pinterest'
    },
    medium: {
      name: 'Medium',
      url: 'https://medium.com/@{username}',
      icon: 'medium'
    }
  }
};

// =============================================================================
// Rate Limiting State
// =============================================================================

let lastRequestTime = 0;

/**
 * Wait for rate limiting between requests
 * @returns {Promise<void>}
 */
async function waitForRateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  const waitTime = Math.max(0, SocialMediaConfig.DELAY_BETWEEN_CHECKS - elapsed);

  if (waitTime > 0) {
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Normalize username - remove @ prefix and trim whitespace
 * @param {string} username - Username to normalize
 * @returns {string} - Normalized username
 */
function normalizeUsername(username) {
  if (!username || typeof username !== 'string') {
    throw new Error('Username is required and must be a string');
  }

  // Remove @ prefix if present and trim
  let normalized = username.trim();
  if (normalized.startsWith('@')) {
    normalized = normalized.substring(1);
  }

  // Basic validation - alphanumeric with some special chars
  if (!/^[a-zA-Z0-9._-]+$/.test(normalized)) {
    throw new Error(`Invalid username format: ${username}. Username should contain only alphanumeric characters, dots, underscores, or hyphens.`);
  }

  if (normalized.length < 1 || normalized.length > 50) {
    throw new Error('Username must be between 1 and 50 characters');
  }

  return normalized;
}

/**
 * Construct profile URL for a platform
 * @param {string} platform - Platform key
 * @param {string} username - Username
 * @returns {string} - Profile URL
 */
function constructProfileUrl(platform, username) {
  const platformConfig = SocialMediaConfig.PLATFORMS[platform.toLowerCase()];
  if (!platformConfig) {
    throw new Error(`Unknown platform: ${platform}`);
  }

  return platformConfig.url.replace('{username}', username);
}

/**
 * Make a fetch request with timeout
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}) {
  const timeout = options.timeout || SocialMediaConfig.TIMEOUT;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      // Use HEAD request when possible to minimize data transfer
      method: options.method || 'HEAD',
      // Don't follow redirects to properly detect profile pages
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...options.headers
      }
    });

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check if a profile exists at a given URL
 * @param {string} url - Profile URL to check
 * @returns {Promise<Object>} - Check result
 */
async function checkProfileUrl(url) {
  await waitForRateLimit();

  for (let attempt = 1; attempt <= SocialMediaConfig.MAX_RETRIES; attempt++) {
    try {
      // First try HEAD request
      let response = await fetchWithTimeout(url, { method: 'HEAD' });

      // Some sites don't support HEAD, fall back to GET
      if (response.status === 405) {
        response = await fetchWithTimeout(url, { method: 'GET' });
      }

      // Handle different status codes
      const status = response.status;

      // 200 OK - profile exists
      if (status === 200) {
        return {
          exists: true,
          status: 'found',
          httpStatus: status,
          url: url
        };
      }

      // 301, 302, 307, 308 - Redirects
      // Could indicate the profile exists but redirects somewhere
      if ([301, 302, 307, 308].includes(status)) {
        const location = response.headers.get('location');
        // If redirecting to login or error page, profile likely doesn't exist
        if (location && (location.includes('login') || location.includes('error') || location.includes('404'))) {
          return {
            exists: false,
            status: 'not_found',
            httpStatus: status,
            url: url,
            redirectUrl: location
          };
        }
        // Otherwise, might exist
        return {
          exists: true,
          status: 'found',
          httpStatus: status,
          url: url,
          redirectUrl: location,
          note: 'Profile redirects to another URL'
        };
      }

      // 404 Not Found - profile doesn't exist
      if (status === 404) {
        return {
          exists: false,
          status: 'not_found',
          httpStatus: status,
          url: url
        };
      }

      // 403 Forbidden - might be blocked or private
      if (status === 403) {
        return {
          exists: null,
          status: 'blocked',
          httpStatus: status,
          url: url,
          note: 'Access forbidden - profile may be private or access blocked'
        };
      }

      // 429 Too Many Requests - rate limited
      if (status === 429) {
        if (attempt < SocialMediaConfig.MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, SocialMediaConfig.RETRY_DELAY * attempt));
          continue;
        }
        return {
          exists: null,
          status: 'rate_limited',
          httpStatus: status,
          url: url,
          note: 'Rate limited by platform'
        };
      }

      // Other status codes
      return {
        exists: null,
        status: 'unknown',
        httpStatus: status,
        url: url,
        note: `Unexpected HTTP status: ${status}`
      };

    } catch (error) {
      if (error.name === 'AbortError') {
        if (attempt < SocialMediaConfig.MAX_RETRIES) {
          continue;
        }
        return {
          exists: null,
          status: 'timeout',
          url: url,
          error: 'Request timed out'
        };
      }

      if (attempt < SocialMediaConfig.MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, SocialMediaConfig.RETRY_DELAY));
        continue;
      }

      return {
        exists: null,
        status: 'error',
        url: url,
        error: error.message
      };
    }
  }

  return {
    exists: null,
    status: 'error',
    url: url,
    error: 'Max retries exceeded'
  };
}

// =============================================================================
// Core API Functions
// =============================================================================

/**
 * Search for a username across all supported platforms
 * @param {string} username - Username to search for
 * @param {Object} options - Search options
 * @param {string[]} options.platforms - Specific platforms to check (optional, defaults to all)
 * @param {boolean} options.concurrent - Run checks concurrently (optional, default: false)
 * @returns {Promise<Object>} - Search results for all platforms
 */
async function searchUsername(username, options = {}) {
  const normalizedUsername = normalizeUsername(username);
  const { platforms = Object.keys(SocialMediaConfig.PLATFORMS), concurrent = false } = options;

  // Validate platforms
  const validPlatforms = platforms.filter(p => {
    const isValid = SocialMediaConfig.PLATFORMS.hasOwnProperty(p.toLowerCase());
    if (!isValid) {
      console.warn(`Unknown platform: ${p}, skipping`);
    }
    return isValid;
  });

  if (validPlatforms.length === 0) {
    throw new Error('No valid platforms specified');
  }

  const results = {
    username: normalizedUsername,
    searchedAt: new Date().toISOString(),
    platformsChecked: validPlatforms.length,
    platforms: {}
  };

  const checkPlatformResult = async (platform) => {
    const platformKey = platform.toLowerCase();
    const platformConfig = SocialMediaConfig.PLATFORMS[platformKey];
    const url = constructProfileUrl(platformKey, normalizedUsername);

    const checkResult = await checkProfileUrl(url);

    return {
      platform: platformKey,
      result: {
        name: platformConfig.name,
        url: url,
        ...checkResult
      }
    };
  };

  if (concurrent) {
    // Run checks concurrently with concurrency limit
    const batchSize = SocialMediaConfig.MAX_CONCURRENT;
    for (let i = 0; i < validPlatforms.length; i += batchSize) {
      const batch = validPlatforms.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(checkPlatformResult));
      batchResults.forEach(({ platform, result }) => {
        results.platforms[platform] = result;
      });
    }
  } else {
    // Run checks sequentially
    for (const platform of validPlatforms) {
      const { platform: platformKey, result } = await checkPlatformResult(platform);
      results.platforms[platformKey] = result;
    }
  }

  // Generate summary
  const found = Object.values(results.platforms).filter(p => p.exists === true).length;
  const notFound = Object.values(results.platforms).filter(p => p.exists === false).length;
  const unknown = Object.values(results.platforms).filter(p => p.exists === null).length;

  results.summary = {
    found,
    notFound,
    unknown,
    total: validPlatforms.length
  };

  return results;
}

/**
 * Check if a username exists on a specific platform
 * @param {string} platform - Platform to check (e.g., 'twitter', 'github')
 * @param {string} username - Username to check
 * @returns {Promise<Object>} - Check result for the specific platform
 */
async function checkPlatform(platform, username) {
  const normalizedUsername = normalizeUsername(username);
  const platformKey = platform.toLowerCase();

  if (!SocialMediaConfig.PLATFORMS.hasOwnProperty(platformKey)) {
    throw new Error(`Unknown platform: ${platform}. Use getSupportedPlatforms() to see available platforms.`);
  }

  const platformConfig = SocialMediaConfig.PLATFORMS[platformKey];
  const url = constructProfileUrl(platformKey, normalizedUsername);

  const checkResult = await checkProfileUrl(url);

  return {
    username: normalizedUsername,
    platform: platformKey,
    platformName: platformConfig.name,
    checkedAt: new Date().toISOString(),
    url: url,
    ...checkResult
  };
}

/**
 * Get list of supported platforms
 * @returns {Object} - Supported platforms with their details
 */
function getSupportedPlatforms() {
  const platforms = {};

  for (const [key, config] of Object.entries(SocialMediaConfig.PLATFORMS)) {
    platforms[key] = {
      name: config.name,
      urlPattern: config.url,
      icon: config.icon
    };
  }

  return {
    count: Object.keys(platforms).length,
    platforms
  };
}

// =============================================================================
// PalletAI Formatting
// =============================================================================

/**
 * Format social media results for palletAI consumption
 * @param {Object} data - Raw social media lookup result
 * @param {string} queryType - Type of query ('search', 'check', 'platforms')
 * @returns {Object} - Formatted result for palletAI
 */
function formatSocialResults(data, queryType = 'search') {
  const baseResult = {
    source: 'social_media',
    timestamp: new Date().toISOString(),
    queryType
  };

  switch (queryType) {
    case 'search':
      return formatSearchResults(data, baseResult);
    case 'check':
      return formatCheckResults(data, baseResult);
    case 'platforms':
      return formatPlatformsResults(data, baseResult);
    default:
      return {
        ...baseResult,
        success: true,
        data
      };
  }
}

/**
 * Format username search results
 * @private
 */
function formatSearchResults(data, baseResult) {
  const insights = [];

  // Generate insights based on results
  if (data.summary) {
    if (data.summary.found > 0) {
      const foundPlatforms = Object.entries(data.platforms)
        .filter(([_, p]) => p.exists === true)
        .map(([key, p]) => p.name);

      insights.push({
        type: 'found',
        severity: 'info',
        message: `Username "${data.username}" found on ${data.summary.found} platform(s): ${foundPlatforms.join(', ')}`
      });
    }

    if (data.summary.notFound > 0) {
      insights.push({
        type: 'not_found',
        severity: 'info',
        message: `Username not found on ${data.summary.notFound} platform(s)`
      });
    }

    if (data.summary.unknown > 0) {
      insights.push({
        type: 'unknown',
        severity: 'warning',
        message: `Unable to determine status on ${data.summary.unknown} platform(s) - may be rate limited or blocked`
      });
    }
  }

  // Build platform details
  const platformResults = {};
  for (const [key, platform] of Object.entries(data.platforms)) {
    platformResults[key] = {
      name: platform.name,
      url: platform.url,
      status: platform.status,
      exists: platform.exists,
      httpStatus: platform.httpStatus,
      note: platform.note || null
    };
  }

  return {
    ...baseResult,
    success: true,
    data: {
      username: data.username,
      searchedAt: data.searchedAt,
      summary: data.summary,
      platforms: platformResults
    },
    insights,
    recommendation: data.summary?.found > 0
      ? `Found ${data.summary.found} social media profile(s) for username "${data.username}". Consider investigating these profiles for additional OSINT data.`
      : `No social media profiles found for username "${data.username}". The username may not exist on these platforms or may use a different format.`
  };
}

/**
 * Format single platform check results
 * @private
 */
function formatCheckResults(data, baseResult) {
  const insights = [];

  if (data.exists === true) {
    insights.push({
      type: 'found',
      severity: 'info',
      message: `Profile found on ${data.platformName}`
    });
  } else if (data.exists === false) {
    insights.push({
      type: 'not_found',
      severity: 'info',
      message: `Profile not found on ${data.platformName}`
    });
  } else {
    insights.push({
      type: 'unknown',
      severity: 'warning',
      message: `Unable to determine if profile exists on ${data.platformName}: ${data.note || data.error || 'unknown reason'}`
    });
  }

  return {
    ...baseResult,
    success: true,
    data: {
      username: data.username,
      platform: data.platform,
      platformName: data.platformName,
      url: data.url,
      status: data.status,
      exists: data.exists,
      httpStatus: data.httpStatus,
      checkedAt: data.checkedAt,
      note: data.note || null
    },
    insights,
    recommendation: data.exists === true
      ? `Profile exists at ${data.url}. Visit the profile for more detailed information.`
      : data.exists === false
        ? `No profile found at ${data.url}. The username may not exist on ${data.platformName}.`
        : `Could not verify profile existence. ${data.note || 'Try again later.'}`
  };
}

/**
 * Format supported platforms results
 * @private
 */
function formatPlatformsResults(data, baseResult) {
  return {
    ...baseResult,
    success: true,
    data: {
      count: data.count,
      platforms: data.platforms
    },
    summary: `${data.count} social media platforms supported for username lookups`
  };
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in Chrome extension (globalThis)
if (typeof globalThis !== 'undefined') {
  globalThis.SocialMediaHandler = {
    searchUsername,
    checkPlatform,
    getSupportedPlatforms,
    formatSocialResults,
    // Expose config for customization
    config: SocialMediaConfig
  };
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    searchUsername,
    checkPlatform,
    getSupportedPlatforms,
    formatSocialResults,
    config: SocialMediaConfig
  };
}
