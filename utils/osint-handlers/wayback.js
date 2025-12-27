/**
 * Basset Hound Browser Automation - Wayback Machine Handler
 *
 * OSINT Tool Integration for Internet Archive's Wayback Machine API.
 * Provides historical website snapshot lookup and retrieval capabilities.
 *
 * APIs Used:
 * - Availability API: https://archive.org/wayback/available?url=...
 * - CDX API: https://web.archive.org/cdx/search/cdx?url=...
 *
 * No API key required - uses public endpoints.
 */

// =============================================================================
// Configuration
// =============================================================================

const WaybackConfig = {
  // API endpoints
  AVAILABILITY_API: 'https://archive.org/wayback/available',
  CDX_API: 'https://web.archive.org/cdx/search/cdx',
  ARCHIVE_BASE: 'https://web.archive.org/web',

  // Rate limiting - Wayback Machine recommends polite crawling
  MIN_REQUEST_INTERVAL: 1000,  // 1 second between requests
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,  // 2 seconds

  // Request timeout
  TIMEOUT: 30000,  // 30 seconds

  // CDX API default parameters
  CDX_DEFAULTS: {
    output: 'json',
    fl: 'timestamp,original,mimetype,statuscode,digest,length',
    collapse: 'timestamp:8'  // Collapse to one per day by default
  }
};

// =============================================================================
// Rate Limiting State
// =============================================================================

let lastRequestTime = 0;

/**
 * Wait for rate limiting
 * @returns {Promise<void>}
 */
async function waitForRateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  const waitTime = Math.max(0, WaybackConfig.MIN_REQUEST_INTERVAL - elapsed);

  if (waitTime > 0) {
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format a timestamp for Wayback Machine API (YYYYMMDDHHmmss)
 * @param {Date|string|number} date - Date to format
 * @returns {string} - Formatted timestamp
 */
function formatTimestamp(date) {
  if (!date) return '';

  const d = new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }

  const pad = (n) => n.toString().padStart(2, '0');

  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
}

/**
 * Parse a Wayback Machine timestamp (YYYYMMDDHHmmss) to Date
 * @param {string} timestamp - Wayback timestamp
 * @returns {Date} - Parsed date
 */
function parseTimestamp(timestamp) {
  if (!timestamp || timestamp.length < 8) {
    return null;
  }

  const year = parseInt(timestamp.substring(0, 4), 10);
  const month = parseInt(timestamp.substring(4, 6), 10) - 1;
  const day = parseInt(timestamp.substring(6, 8), 10);
  const hour = parseInt(timestamp.substring(8, 10) || '0', 10);
  const minute = parseInt(timestamp.substring(10, 12) || '0', 10);
  const second = parseInt(timestamp.substring(12, 14) || '0', 10);

  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

/**
 * Construct archive.org URL for a snapshot
 * @param {string} url - Original URL
 * @param {string} timestamp - Wayback timestamp
 * @param {Object} options - Options
 * @param {boolean} options.raw - Return raw content without Wayback toolbar
 * @returns {string} - Archive URL
 */
function constructArchiveUrl(url, timestamp, options = {}) {
  const modifier = options.raw ? 'id_' : '';
  return `${WaybackConfig.ARCHIVE_BASE}/${timestamp}${modifier}/${url}`;
}

/**
 * Normalize URL for Wayback Machine lookup
 * @param {string} url - URL to normalize
 * @returns {string} - Normalized URL
 */
function normalizeUrl(url) {
  // Remove protocol if present (Wayback API handles both)
  let normalized = url.trim();

  // Ensure URL has some content
  if (!normalized) {
    throw new Error('URL cannot be empty');
  }

  return normalized;
}

/**
 * Make a fetch request with timeout and retry logic
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options = {}) {
  const timeout = options.timeout || WaybackConfig.TIMEOUT;
  const maxRetries = options.maxRetries || WaybackConfig.MAX_RETRIES;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await waitForRateLimit();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Handle rate limiting (429) or server errors (5xx)
      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        if (attempt < maxRetries) {
          const delay = WaybackConfig.RETRY_DELAY * attempt;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }

      if (attempt < maxRetries) {
        const delay = WaybackConfig.RETRY_DELAY * attempt;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Failed after ${maxRetries} retry attempts`);
}

// =============================================================================
// Core API Functions
// =============================================================================

/**
 * Check if a URL is available in the Wayback Machine
 * @param {string} url - URL to check
 * @returns {Promise<Object>} - Availability result
 */
async function checkAvailability(url) {
  const normalizedUrl = normalizeUrl(url);
  const apiUrl = `${WaybackConfig.AVAILABILITY_API}?url=${encodeURIComponent(normalizedUrl)}`;

  const response = await fetchWithRetry(apiUrl);

  if (!response.ok) {
    throw new Error(`Availability check failed: HTTP ${response.status}`);
  }

  const data = await response.json();

  // Parse response
  const snapshot = data.archived_snapshots?.closest;

  if (!snapshot) {
    return {
      available: false,
      url: normalizedUrl,
      message: 'No archived snapshots found for this URL'
    };
  }

  return {
    available: snapshot.available === true,
    url: normalizedUrl,
    timestamp: snapshot.timestamp,
    archiveUrl: snapshot.url,
    status: snapshot.status,
    captureDate: parseTimestamp(snapshot.timestamp)?.toISOString()
  };
}

/**
 * Get list of snapshots for a URL within a date range
 * @param {string} url - URL to search
 * @param {Date|string|number} from - Start date (optional)
 * @param {Date|string|number} to - End date (optional)
 * @param {Object} options - Additional options
 * @param {number} options.limit - Maximum number of results
 * @param {string} options.filter - Filter expression (e.g., 'statuscode:200')
 * @param {string} options.collapse - Collapse parameter (default: 'timestamp:8' for daily)
 * @param {string} options.matchType - Match type: 'exact', 'prefix', 'host', 'domain'
 * @returns {Promise<Object>} - Snapshots result
 */
async function getSnapshots(url, from = null, to = null, options = {}) {
  const normalizedUrl = normalizeUrl(url);

  // Build query parameters
  const params = new URLSearchParams({
    url: normalizedUrl,
    output: WaybackConfig.CDX_DEFAULTS.output,
    fl: WaybackConfig.CDX_DEFAULTS.fl
  });

  // Add date range if specified
  if (from) {
    params.append('from', formatTimestamp(from));
  }
  if (to) {
    params.append('to', formatTimestamp(to));
  }

  // Add optional parameters
  if (options.limit) {
    params.append('limit', options.limit.toString());
  }
  if (options.filter) {
    params.append('filter', options.filter);
  }
  if (options.collapse !== false) {
    params.append('collapse', options.collapse || WaybackConfig.CDX_DEFAULTS.collapse);
  }
  if (options.matchType) {
    params.append('matchType', options.matchType);
  }

  const apiUrl = `${WaybackConfig.CDX_API}?${params.toString()}`;
  const response = await fetchWithRetry(apiUrl);

  if (!response.ok) {
    throw new Error(`CDX API request failed: HTTP ${response.status}`);
  }

  const data = await response.json();

  // CDX returns array of arrays, first row is headers if output=json
  if (!Array.isArray(data) || data.length === 0) {
    return {
      url: normalizedUrl,
      from: from ? new Date(from).toISOString() : null,
      to: to ? new Date(to).toISOString() : null,
      count: 0,
      snapshots: []
    };
  }

  // Parse CDX response - first row may be headers
  const headers = data[0];
  const isHeaderRow = headers.includes('timestamp') || headers.includes('original');
  const dataRows = isHeaderRow ? data.slice(1) : data;

  // Map field indices based on requested fields
  const fields = WaybackConfig.CDX_DEFAULTS.fl.split(',');
  const fieldIndices = {};
  fields.forEach((field, index) => {
    fieldIndices[field] = index;
  });

  // Parse snapshots
  const snapshots = dataRows.map(row => {
    const timestamp = row[fieldIndices.timestamp];
    const original = row[fieldIndices.original];
    const mimetype = row[fieldIndices.mimetype];
    const statuscode = row[fieldIndices.statuscode];
    const digest = row[fieldIndices.digest];
    const length = row[fieldIndices.length];

    return {
      timestamp,
      date: parseTimestamp(timestamp)?.toISOString(),
      url: original,
      archiveUrl: constructArchiveUrl(original, timestamp),
      archiveUrlRaw: constructArchiveUrl(original, timestamp, { raw: true }),
      mimetype,
      statusCode: parseInt(statuscode, 10) || null,
      digest,
      length: parseInt(length, 10) || null
    };
  });

  return {
    url: normalizedUrl,
    from: from ? new Date(from).toISOString() : null,
    to: to ? new Date(to).toISOString() : null,
    count: snapshots.length,
    snapshots
  };
}

/**
 * Get a specific snapshot by timestamp
 * @param {string} url - URL to retrieve
 * @param {string|Date|number} timestamp - Specific timestamp to retrieve
 * @param {Object} options - Options
 * @param {boolean} options.exactMatch - Require exact timestamp match
 * @returns {Promise<Object>} - Snapshot result
 */
async function getSnapshot(url, timestamp, options = {}) {
  const normalizedUrl = normalizeUrl(url);
  const formattedTimestamp = formatTimestamp(timestamp);

  // Use CDX API to find the exact snapshot
  const params = new URLSearchParams({
    url: normalizedUrl,
    output: 'json',
    fl: WaybackConfig.CDX_DEFAULTS.fl,
    limit: '1'
  });

  // For exact match, search around the specified timestamp
  if (options.exactMatch) {
    params.append('from', formattedTimestamp);
    params.append('to', formattedTimestamp);
  } else {
    // Find closest snapshot to the timestamp
    params.append('closest', formattedTimestamp);
    params.append('sort', 'closest');
  }

  const apiUrl = `${WaybackConfig.CDX_API}?${params.toString()}`;
  const response = await fetchWithRetry(apiUrl);

  if (!response.ok) {
    throw new Error(`Snapshot retrieval failed: HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data) || data.length < 2) {
    return {
      found: false,
      url: normalizedUrl,
      requestedTimestamp: formattedTimestamp,
      message: 'No snapshot found for the specified timestamp'
    };
  }

  // Skip header row
  const row = data[1];
  const fields = WaybackConfig.CDX_DEFAULTS.fl.split(',');
  const fieldIndices = {};
  fields.forEach((field, index) => {
    fieldIndices[field] = index;
  });

  const snapshotTimestamp = row[fieldIndices.timestamp];
  const original = row[fieldIndices.original];
  const mimetype = row[fieldIndices.mimetype];
  const statuscode = row[fieldIndices.statuscode];
  const digest = row[fieldIndices.digest];
  const length = row[fieldIndices.length];

  return {
    found: true,
    url: normalizedUrl,
    requestedTimestamp: formattedTimestamp,
    timestamp: snapshotTimestamp,
    date: parseTimestamp(snapshotTimestamp)?.toISOString(),
    archiveUrl: constructArchiveUrl(original, snapshotTimestamp),
    archiveUrlRaw: constructArchiveUrl(original, snapshotTimestamp, { raw: true }),
    mimetype,
    statusCode: parseInt(statuscode, 10) || null,
    digest,
    length: parseInt(length, 10) || null
  };
}

/**
 * Get the most recent snapshot for a URL
 * @param {string} url - URL to retrieve
 * @returns {Promise<Object>} - Latest snapshot result
 */
async function getLatestSnapshot(url) {
  const normalizedUrl = normalizeUrl(url);

  // Use CDX API with limit=1 and reverse sort to get latest
  const params = new URLSearchParams({
    url: normalizedUrl,
    output: 'json',
    fl: WaybackConfig.CDX_DEFAULTS.fl,
    limit: '1',
    sort: 'reverse'  // Most recent first
  });

  // Only get successful responses
  params.append('filter', 'statuscode:200');

  const apiUrl = `${WaybackConfig.CDX_API}?${params.toString()}`;
  const response = await fetchWithRetry(apiUrl);

  if (!response.ok) {
    throw new Error(`Latest snapshot retrieval failed: HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data) || data.length < 2) {
    // Try again without status filter
    return getLatestSnapshotFallback(normalizedUrl);
  }

  // Skip header row
  const row = data[1];
  const fields = WaybackConfig.CDX_DEFAULTS.fl.split(',');
  const fieldIndices = {};
  fields.forEach((field, index) => {
    fieldIndices[field] = index;
  });

  const timestamp = row[fieldIndices.timestamp];
  const original = row[fieldIndices.original];
  const mimetype = row[fieldIndices.mimetype];
  const statuscode = row[fieldIndices.statuscode];
  const digest = row[fieldIndices.digest];
  const length = row[fieldIndices.length];

  return {
    found: true,
    url: normalizedUrl,
    timestamp,
    date: parseTimestamp(timestamp)?.toISOString(),
    archiveUrl: constructArchiveUrl(original, timestamp),
    archiveUrlRaw: constructArchiveUrl(original, timestamp, { raw: true }),
    mimetype,
    statusCode: parseInt(statuscode, 10) || null,
    digest,
    length: parseInt(length, 10) || null,
    isLatest: true
  };
}

/**
 * Fallback for getting latest snapshot without status filter
 * @param {string} url - Normalized URL
 * @returns {Promise<Object>}
 */
async function getLatestSnapshotFallback(url) {
  const params = new URLSearchParams({
    url: url,
    output: 'json',
    fl: WaybackConfig.CDX_DEFAULTS.fl,
    limit: '1',
    sort: 'reverse'
  });

  const apiUrl = `${WaybackConfig.CDX_API}?${params.toString()}`;
  const response = await fetchWithRetry(apiUrl);

  if (!response.ok) {
    throw new Error(`Latest snapshot fallback failed: HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data) || data.length < 2) {
    return {
      found: false,
      url: url,
      message: 'No snapshots found for this URL'
    };
  }

  const row = data[1];
  const fields = WaybackConfig.CDX_DEFAULTS.fl.split(',');
  const fieldIndices = {};
  fields.forEach((field, index) => {
    fieldIndices[field] = index;
  });

  const timestamp = row[fieldIndices.timestamp];
  const original = row[fieldIndices.original];
  const mimetype = row[fieldIndices.mimetype];
  const statuscode = row[fieldIndices.statuscode];
  const digest = row[fieldIndices.digest];
  const length = row[fieldIndices.length];

  return {
    found: true,
    url: url,
    timestamp,
    date: parseTimestamp(timestamp)?.toISOString(),
    archiveUrl: constructArchiveUrl(original, timestamp),
    archiveUrlRaw: constructArchiveUrl(original, timestamp, { raw: true }),
    mimetype,
    statusCode: parseInt(statuscode, 10) || null,
    digest,
    length: parseInt(length, 10) || null,
    isLatest: true
  };
}

// =============================================================================
// PalletAI Formatting
// =============================================================================

/**
 * Format Wayback results for palletAI consumption
 * Standardizes the output format for integration with the OSINT backend
 * @param {Object} data - Raw Wayback API result
 * @param {string} commandType - The command type for context
 * @returns {Object} - Formatted result for palletAI
 */
function formatWaybackResults(data, commandType = 'wayback') {
  const baseResult = {
    source: 'wayback_machine',
    api: 'archive.org',
    timestamp: new Date().toISOString(),
    command: commandType
  };

  // Handle availability check results
  if (data.available !== undefined) {
    return {
      ...baseResult,
      type: 'availability',
      success: true,
      data: {
        available: data.available,
        url: data.url,
        snapshot: data.available ? {
          timestamp: data.timestamp,
          captureDate: data.captureDate,
          archiveUrl: data.archiveUrl,
          httpStatus: data.status
        } : null,
        message: data.message || (data.available ? 'URL is archived' : 'URL not found in archive')
      }
    };
  }

  // Handle snapshot list results
  if (data.snapshots !== undefined) {
    return {
      ...baseResult,
      type: 'snapshot_list',
      success: true,
      data: {
        url: data.url,
        dateRange: {
          from: data.from,
          to: data.to
        },
        totalSnapshots: data.count,
        snapshots: data.snapshots.map(snap => ({
          timestamp: snap.timestamp,
          date: snap.date,
          archiveUrl: snap.archiveUrl,
          rawUrl: snap.archiveUrlRaw,
          mimeType: snap.mimetype,
          httpStatus: snap.statusCode,
          contentLength: snap.length,
          contentDigest: snap.digest
        }))
      }
    };
  }

  // Handle single snapshot results
  if (data.found !== undefined) {
    return {
      ...baseResult,
      type: 'snapshot',
      success: data.found,
      data: data.found ? {
        url: data.url,
        requestedTimestamp: data.requestedTimestamp,
        snapshot: {
          timestamp: data.timestamp,
          date: data.date,
          archiveUrl: data.archiveUrl,
          rawUrl: data.archiveUrlRaw,
          mimeType: data.mimetype,
          httpStatus: data.statusCode,
          contentLength: data.length,
          contentDigest: data.digest,
          isLatest: data.isLatest || false
        }
      } : {
        url: data.url,
        requestedTimestamp: data.requestedTimestamp,
        message: data.message
      }
    };
  }

  // Fallback for unknown data structure
  return {
    ...baseResult,
    type: 'raw',
    success: true,
    data: data
  };
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in Chrome extension (globalThis)
if (typeof globalThis !== 'undefined') {
  globalThis.WaybackHandler = {
    checkAvailability,
    getSnapshots,
    getSnapshot,
    getLatestSnapshot,
    formatWaybackResults,
    // Expose utilities for advanced usage
    utils: {
      formatTimestamp,
      parseTimestamp,
      constructArchiveUrl,
      normalizeUrl
    },
    // Expose config for customization
    config: WaybackConfig
  };
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    checkAvailability,
    getSnapshots,
    getSnapshot,
    getLatestSnapshot,
    formatWaybackResults,
    utils: {
      formatTimestamp,
      parseTimestamp,
      constructArchiveUrl,
      normalizeUrl
    },
    config: WaybackConfig
  };
}
