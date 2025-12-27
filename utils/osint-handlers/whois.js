/**
 * Basset Hound Browser Automation - WHOIS Lookup Handler
 *
 * OSINT tool integration for domain and IP WHOIS lookups.
 * Provides:
 * - Domain WHOIS lookups
 * - IP address WHOIS lookups
 * - Structured parsing of WHOIS data
 * - Date extraction (registration, expiry, updated)
 * - Contact extraction (registrant, admin, tech)
 * - palletAI-formatted responses
 */

// =============================================================================
// Configuration
// =============================================================================

const WHOIS_CONFIG = {
  // Public WHOIS API endpoints (no API key required)
  DOMAIN_API: 'https://whois.freeaitools.xyz/',
  IP_API: 'https://ipwhois.app/json/',

  // Alternative/fallback APIs
  FALLBACK_DOMAIN_API: 'https://www.whoisxmlapi.com/whoisserver/WhoisService',

  // Request timeout in milliseconds
  TIMEOUT: 30000,

  // Retry configuration
  MAX_RETRIES: 2,
  RETRY_DELAY: 1000,

  // Cache duration in milliseconds (5 minutes)
  CACHE_DURATION: 300000
};

// Simple in-memory cache for WHOIS results
const whoisCache = new Map();

// =============================================================================
// Domain WHOIS Lookup
// =============================================================================

/**
 * Look up WHOIS data for a domain
 * @param {string} domain - Domain name to look up
 * @param {Object} options - Lookup options
 * @param {boolean} options.useCache - Whether to use cached results (default: true)
 * @param {boolean} options.rawOnly - Return only raw WHOIS data (default: false)
 * @returns {Promise<Object>} - Structured WHOIS data
 */
async function lookupDomain(domain, options = {}) {
  const { useCache = true, rawOnly = false } = options;

  // Validate domain format
  if (!domain || typeof domain !== 'string') {
    throw new Error('Domain is required and must be a string');
  }

  // Clean and validate domain
  const cleanDomain = cleanDomainInput(domain);
  if (!isValidWhoisDomain(cleanDomain)) {
    throw new Error(`Invalid domain format: ${domain}`);
  }

  // Check cache
  const cacheKey = `domain:${cleanDomain}`;
  if (useCache && whoisCache.has(cacheKey)) {
    const cached = whoisCache.get(cacheKey);
    if (Date.now() - cached.timestamp < WHOIS_CONFIG.CACHE_DURATION) {
      return { ...cached.data, cached: true };
    }
    whoisCache.delete(cacheKey);
  }

  // Try primary API
  let rawWhois = null;
  let error = null;

  try {
    rawWhois = await fetchDomainWhois(cleanDomain);
  } catch (err) {
    error = err;
    // Try fallback API
    try {
      rawWhois = await fetchDomainWhoisFallback(cleanDomain);
    } catch (fallbackErr) {
      throw new Error(`WHOIS lookup failed: ${error.message}. Fallback also failed: ${fallbackErr.message}`);
    }
  }

  if (!rawWhois) {
    throw new Error(`No WHOIS data found for domain: ${cleanDomain}`);
  }

  // Return raw if requested
  if (rawOnly) {
    return { domain: cleanDomain, raw: rawWhois, timestamp: Date.now() };
  }

  // Parse and structure the data
  const parsedData = parseWhoisData(rawWhois, 'domain');
  const dates = extractDates(parsedData);
  const contacts = extractContacts(parsedData);

  const result = {
    domain: cleanDomain,
    registrar: parsedData.registrar || null,
    status: parsedData.status || [],
    dates,
    contacts,
    nameservers: parsedData.nameservers || [],
    dnssec: parsedData.dnssec || null,
    raw: rawWhois,
    privacyProtected: isPrivacyProtected(parsedData),
    timestamp: Date.now()
  };

  // Cache the result
  whoisCache.set(cacheKey, { data: result, timestamp: Date.now() });

  return result;
}

/**
 * Fetch domain WHOIS from primary API
 * @param {string} domain - Domain to look up
 * @returns {Promise<Object>} - Raw WHOIS response
 */
async function fetchDomainWhois(domain) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WHOIS_CONFIG.TIMEOUT);

  try {
    const response = await fetch(`${WHOIS_CONFIG.DOMAIN_API}?domain=${encodeURIComponent(domain)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch domain WHOIS from fallback API (RDAP-based)
 * @param {string} domain - Domain to look up
 * @returns {Promise<Object>} - Raw WHOIS response
 */
async function fetchDomainWhoisFallback(domain) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WHOIS_CONFIG.TIMEOUT);

  try {
    // Use RDAP (Registration Data Access Protocol) - the modern replacement for WHOIS
    const tld = domain.split('.').pop().toLowerCase();
    const rdapUrl = await getRdapUrl(tld, domain);

    if (!rdapUrl) {
      throw new Error(`No RDAP server found for TLD: ${tld}`);
    }

    const response = await fetch(rdapUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/rdap+json, application/json'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`RDAP API returned status ${response.status}`);
    }

    const data = await response.json();
    return normalizeRdapResponse(data);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Get RDAP URL for a TLD
 * @param {string} tld - Top-level domain
 * @param {string} domain - Full domain name
 * @returns {Promise<string|null>} - RDAP URL or null
 */
async function getRdapUrl(tld, domain) {
  // IANA RDAP bootstrap file
  const bootstrapUrl = 'https://data.iana.org/rdap/dns.json';

  try {
    const response = await fetch(bootstrapUrl);
    if (!response.ok) {
      // Fallback to known RDAP servers
      return getKnownRdapServer(tld, domain);
    }

    const bootstrap = await response.json();

    // Find the RDAP server for this TLD
    for (const [tlds, servers] of bootstrap.services) {
      if (tlds.includes(tld)) {
        return `${servers[0]}domain/${domain}`;
      }
    }

    return getKnownRdapServer(tld, domain);
  } catch {
    return getKnownRdapServer(tld, domain);
  }
}

/**
 * Get known RDAP server for common TLDs
 * @param {string} tld - Top-level domain
 * @param {string} domain - Full domain name
 * @returns {string|null} - RDAP URL or null
 */
function getKnownRdapServer(tld, domain) {
  const knownServers = {
    'com': 'https://rdap.verisign.com/com/v1/domain/',
    'net': 'https://rdap.verisign.com/net/v1/domain/',
    'org': 'https://rdap.publicinterestregistry.org/rdap/domain/',
    'info': 'https://rdap.afilias.net/rdap/info/domain/',
    'io': 'https://rdap.nic.io/domain/',
    'co': 'https://rdap.nic.co/domain/',
    'me': 'https://rdap.nic.me/domain/',
    'us': 'https://rdap.nic.us/domain/',
    'uk': 'https://rdap.nominet.uk/uk/domain/',
    'de': 'https://rdap.denic.de/domain/',
    'eu': 'https://rdap.eurid.eu/domain/',
    'nl': 'https://rdap.sidn.nl/domain/',
    'au': 'https://rdap.auda.org.au/domain/',
    'ca': 'https://rdap.ca.fury.ca/rdap/domain/'
  };

  if (knownServers[tld]) {
    return `${knownServers[tld]}${domain}`;
  }

  return null;
}

/**
 * Normalize RDAP response to common format
 * @param {Object} rdapData - RDAP response
 * @returns {Object} - Normalized data
 */
function normalizeRdapResponse(rdapData) {
  const normalized = {
    _source: 'rdap',
    domain: rdapData.ldhName || rdapData.unicodeName,
    status: rdapData.status || [],
    events: {},
    entities: [],
    nameservers: []
  };

  // Extract events (dates)
  if (rdapData.events) {
    for (const event of rdapData.events) {
      normalized.events[event.eventAction] = event.eventDate;
    }
  }

  // Extract entities (contacts)
  if (rdapData.entities) {
    for (const entity of rdapData.entities) {
      const contact = {
        roles: entity.roles || [],
        handle: entity.handle
      };

      if (entity.vcardArray && entity.vcardArray[1]) {
        const vcard = entity.vcardArray[1];
        for (const field of vcard) {
          const [type, meta, valueType, value] = field;
          if (type === 'fn') contact.name = value;
          if (type === 'org') contact.organization = Array.isArray(value) ? value[0] : value;
          if (type === 'email') contact.email = value;
          if (type === 'tel') contact.phone = value;
          if (type === 'adr') {
            contact.address = Array.isArray(value) ? value.filter(v => v).join(', ') : value;
          }
        }
      }

      normalized.entities.push(contact);
    }
  }

  // Extract nameservers
  if (rdapData.nameservers) {
    normalized.nameservers = rdapData.nameservers.map(ns => ns.ldhName || ns.unicodeName);
  }

  // Extract registrar from entities
  const registrarEntity = normalized.entities.find(e => e.roles && e.roles.includes('registrar'));
  if (registrarEntity) {
    normalized.registrar = registrarEntity.name || registrarEntity.organization;
  }

  return normalized;
}

// =============================================================================
// IP WHOIS Lookup
// =============================================================================

/**
 * Look up WHOIS data for an IP address
 * @param {string} ip - IP address to look up
 * @param {Object} options - Lookup options
 * @param {boolean} options.useCache - Whether to use cached results (default: true)
 * @returns {Promise<Object>} - Structured IP WHOIS data
 */
async function lookupIP(ip, options = {}) {
  const { useCache = true } = options;

  // Validate IP format
  if (!ip || typeof ip !== 'string') {
    throw new Error('IP address is required and must be a string');
  }

  const cleanIP = ip.trim();
  if (!isValidWhoisIP(cleanIP)) {
    throw new Error(`Invalid IP address format: ${ip}`);
  }

  // Check cache
  const cacheKey = `ip:${cleanIP}`;
  if (useCache && whoisCache.has(cacheKey)) {
    const cached = whoisCache.get(cacheKey);
    if (Date.now() - cached.timestamp < WHOIS_CONFIG.CACHE_DURATION) {
      return { ...cached.data, cached: true };
    }
    whoisCache.delete(cacheKey);
  }

  // Fetch IP WHOIS data
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WHOIS_CONFIG.TIMEOUT);

  try {
    const response = await fetch(`${WHOIS_CONFIG.IP_API}${encodeURIComponent(cleanIP)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`IP WHOIS API returned status ${response.status}`);
    }

    const data = await response.json();

    if (!data.success && data.message) {
      throw new Error(data.message);
    }

    const result = {
      ip: cleanIP,
      type: data.type || 'unknown',
      continent: data.continent || null,
      country: {
        code: data.country_code || null,
        name: data.country || null
      },
      region: data.region || null,
      city: data.city || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      asn: {
        number: data.asn || null,
        name: data.org || data.isp || null,
        route: data.asn_route || null
      },
      isp: data.isp || null,
      organization: data.org || null,
      timezone: data.timezone || null,
      isProxy: data.proxy || false,
      isHosting: data.hosting || false,
      timestamp: Date.now()
    };

    // Cache the result
    whoisCache.set(cacheKey, { data: result, timestamp: Date.now() });

    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// WHOIS Data Parsing
// =============================================================================

/**
 * Parse raw WHOIS data into structured format
 * @param {Object|string} rawWhois - Raw WHOIS data
 * @param {string} type - Type of lookup ('domain' or 'ip')
 * @returns {Object} - Parsed and structured WHOIS data
 */
function parseWhoisData(rawWhois, type = 'domain') {
  if (!rawWhois) {
    return {};
  }

  // Handle RDAP format
  if (rawWhois._source === 'rdap') {
    return parseRdapData(rawWhois);
  }

  // Handle string WHOIS data
  if (typeof rawWhois === 'string') {
    return parseTextWhois(rawWhois);
  }

  // Handle JSON WHOIS data (from API)
  return parseJsonWhois(rawWhois, type);
}

/**
 * Parse RDAP-formatted data
 * @param {Object} rdapData - RDAP response data
 * @returns {Object} - Parsed data
 */
function parseRdapData(rdapData) {
  const parsed = {
    domain: rdapData.domain,
    registrar: rdapData.registrar,
    status: rdapData.status,
    nameservers: rdapData.nameservers,
    dates: {
      created: rdapData.events?.registration || rdapData.events?.created,
      updated: rdapData.events?.['last changed'] || rdapData.events?.updated,
      expires: rdapData.events?.expiration || rdapData.events?.expires
    },
    contacts: {}
  };

  // Map entities to contacts by role
  if (rdapData.entities) {
    for (const entity of rdapData.entities) {
      if (entity.roles) {
        for (const role of entity.roles) {
          if (['registrant', 'administrative', 'technical', 'billing'].includes(role)) {
            parsed.contacts[role] = {
              name: entity.name,
              organization: entity.organization,
              email: entity.email,
              phone: entity.phone,
              address: entity.address
            };
          }
        }
      }
    }
  }

  return parsed;
}

/**
 * Parse text-based WHOIS response
 * @param {string} text - Raw WHOIS text
 * @returns {Object} - Parsed data
 */
function parseTextWhois(text) {
  const lines = text.split('\n');
  const parsed = {
    status: [],
    nameservers: [],
    dates: {},
    contacts: {
      registrant: {},
      admin: {},
      tech: {}
    }
  };

  let currentSection = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('%') || trimmed.startsWith('#')) {
      continue;
    }

    // Check for section headers
    if (/registrant/i.test(trimmed)) {
      currentSection = 'registrant';
    } else if (/admin|administrative/i.test(trimmed)) {
      currentSection = 'admin';
    } else if (/tech|technical/i.test(trimmed)) {
      currentSection = 'tech';
    }

    // Parse key-value pairs
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      const key = trimmed.substring(0, colonIndex).trim().toLowerCase();
      const value = trimmed.substring(colonIndex + 1).trim();

      if (!value) continue;

      // Map common fields
      if (/registrar(?!\s*abuse)/i.test(key)) {
        parsed.registrar = value;
      } else if (/domain.?status/i.test(key)) {
        parsed.status.push(value.split(' ')[0]); // Remove ICANN link
      } else if (/name.?server/i.test(key)) {
        parsed.nameservers.push(value.toLowerCase());
      } else if (/creat|registr.*date/i.test(key)) {
        parsed.dates.created = value;
      } else if (/updat|modif/i.test(key)) {
        parsed.dates.updated = value;
      } else if (/expir|expiry/i.test(key)) {
        parsed.dates.expires = value;
      } else if (/dnssec/i.test(key)) {
        parsed.dnssec = value;
      } else if (currentSection) {
        // Add to current contact section
        if (/name/i.test(key)) {
          parsed.contacts[currentSection].name = value;
        } else if (/org|organization/i.test(key)) {
          parsed.contacts[currentSection].organization = value;
        } else if (/email/i.test(key)) {
          parsed.contacts[currentSection].email = value;
        } else if (/phone|tel/i.test(key)) {
          parsed.contacts[currentSection].phone = value;
        } else if (/street|address/i.test(key)) {
          parsed.contacts[currentSection].address =
            (parsed.contacts[currentSection].address || '') + ' ' + value;
        } else if (/city/i.test(key)) {
          parsed.contacts[currentSection].city = value;
        } else if (/state|province/i.test(key)) {
          parsed.contacts[currentSection].state = value;
        } else if (/postal|zip/i.test(key)) {
          parsed.contacts[currentSection].postalCode = value;
        } else if (/country/i.test(key)) {
          parsed.contacts[currentSection].country = value;
        }
      }
    }
  }

  return parsed;
}

/**
 * Parse JSON WHOIS response from API
 * @param {Object} json - JSON WHOIS data
 * @param {string} type - Type of lookup
 * @returns {Object} - Parsed data
 */
function parseJsonWhois(json, type) {
  // Handle various API response formats
  const parsed = {
    domain: json.domain || json.domainName || json.name,
    registrar: json.registrar || json.registrarName ||
               (json.registrar_info && json.registrar_info.name),
    status: normalizeStatus(json.status || json.domainStatus || json.domain_status),
    nameservers: normalizeNameservers(json.nameservers || json.name_servers || json.ns),
    dates: {
      created: json.created || json.creationDate || json.creation_date ||
               json.registrationDate || json.registered,
      updated: json.updated || json.updatedDate || json.update_date ||
               json.lastUpdated || json.modified,
      expires: json.expires || json.expirationDate || json.expiration_date ||
               json.expiryDate || json.expiry
    },
    contacts: {},
    dnssec: json.dnssec || json.DNSSEC
  };

  // Extract contacts from various API formats
  const contactTypes = ['registrant', 'admin', 'administrative', 'tech', 'technical', 'billing'];

  for (const contactType of contactTypes) {
    const normalizedType = contactType.replace('istrative', '').replace('nical', '');
    const contactData = json[contactType] || json[`${contactType}Contact`] ||
                       json[`${contactType}_contact`];

    if (contactData) {
      parsed.contacts[normalizedType] = {
        name: contactData.name || contactData.Name,
        organization: contactData.organization || contactData.org || contactData.Organization,
        email: contactData.email || contactData.Email,
        phone: contactData.phone || contactData.telephone || contactData.Phone,
        address: contactData.address || contactData.street,
        city: contactData.city || contactData.City,
        state: contactData.state || contactData.province || contactData.State,
        postalCode: contactData.postalCode || contactData.postal_code || contactData.zip,
        country: contactData.country || contactData.countryCode || contactData.Country
      };
    }
  }

  return parsed;
}

/**
 * Normalize domain status to array
 * @param {string|Array} status - Status value(s)
 * @returns {Array<string>} - Normalized status array
 */
function normalizeStatus(status) {
  if (!status) return [];
  if (Array.isArray(status)) return status;
  if (typeof status === 'string') {
    return status.split(/[,;]/).map(s => s.trim().split(' ')[0]);
  }
  return [];
}

/**
 * Normalize nameservers to array
 * @param {string|Array} nameservers - Nameserver value(s)
 * @returns {Array<string>} - Normalized nameserver array
 */
function normalizeNameservers(nameservers) {
  if (!nameservers) return [];
  if (Array.isArray(nameservers)) {
    return nameservers.map(ns => typeof ns === 'string' ? ns.toLowerCase() : ns.host?.toLowerCase());
  }
  if (typeof nameservers === 'string') {
    return nameservers.split(/[,;]/).map(s => s.trim().toLowerCase());
  }
  return [];
}

// =============================================================================
// Date Extraction
// =============================================================================

/**
 * Extract registration, expiry, and update dates from WHOIS data
 * @param {Object} data - Parsed WHOIS data
 * @returns {Object} - Extracted dates with ISO format
 */
function extractDates(data) {
  const dates = data.dates || {};

  const result = {
    created: null,
    updated: null,
    expires: null,
    createdTimestamp: null,
    updatedTimestamp: null,
    expiresTimestamp: null,
    expiresInDays: null
  };

  // Parse and normalize each date
  if (dates.created) {
    const parsed = parseDate(dates.created);
    if (parsed) {
      result.created = parsed.toISOString();
      result.createdTimestamp = parsed.getTime();
    }
  }

  if (dates.updated) {
    const parsed = parseDate(dates.updated);
    if (parsed) {
      result.updated = parsed.toISOString();
      result.updatedTimestamp = parsed.getTime();
    }
  }

  if (dates.expires) {
    const parsed = parseDate(dates.expires);
    if (parsed) {
      result.expires = parsed.toISOString();
      result.expiresTimestamp = parsed.getTime();

      // Calculate days until expiry
      const now = new Date();
      const diffTime = parsed.getTime() - now.getTime();
      result.expiresInDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
  }

  return result;
}

/**
 * Parse various date formats to Date object
 * @param {string|number} dateStr - Date string or timestamp
 * @returns {Date|null} - Parsed Date or null
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  // Handle timestamps
  if (typeof dateStr === 'number') {
    return new Date(dateStr);
  }

  // Try standard Date parsing
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // Try common WHOIS date formats
  const formats = [
    // 2024-01-15T00:00:00Z (ISO)
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/,
    // 2024-01-15 00:00:00 (SQL style)
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/,
    // 15-Jan-2024 (common WHOIS format)
    /^(\d{1,2})-([A-Za-z]{3})-(\d{4})/,
    // 2024/01/15 (slash format)
    /^(\d{4})\/(\d{2})\/(\d{2})/,
    // 15/01/2024 (European format)
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})/
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  return null;
}

// =============================================================================
// Contact Extraction
// =============================================================================

/**
 * Extract registrant, admin, and tech contacts from WHOIS data
 * @param {Object} data - Parsed WHOIS data
 * @returns {Object} - Extracted contacts
 */
function extractContacts(data) {
  const contacts = data.contacts || {};

  const result = {
    registrant: normalizeContact(contacts.registrant),
    admin: normalizeContact(contacts.admin || contacts.administrative),
    tech: normalizeContact(contacts.tech || contacts.technical),
    billing: normalizeContact(contacts.billing)
  };

  // Mark if all contacts appear to be privacy-protected
  result.allPrivacyProtected = Object.values(result)
    .filter(c => c !== null)
    .every(c => c.privacyProtected);

  return result;
}

/**
 * Normalize and clean contact data
 * @param {Object} contact - Raw contact data
 * @returns {Object|null} - Normalized contact or null
 */
function normalizeContact(contact) {
  if (!contact || Object.keys(contact).length === 0) {
    return null;
  }

  const normalized = {
    name: cleanContactField(contact.name),
    organization: cleanContactField(contact.organization || contact.org),
    email: cleanContactField(contact.email),
    phone: cleanContactField(contact.phone),
    address: buildFullAddress(contact),
    privacyProtected: false
  };

  // Check for privacy protection indicators
  const privacyIndicators = [
    'privacy', 'redacted', 'whoisguard', 'domains by proxy',
    'contact privacy', 'private', 'withheld', 'data protected',
    'identity protect', 'perfect privacy', 'anonymize'
  ];

  const allValues = Object.values(normalized).filter(v => typeof v === 'string').join(' ').toLowerCase();
  normalized.privacyProtected = privacyIndicators.some(indicator => allValues.includes(indicator));

  // Check if contact is essentially empty (only has privacy protected markers)
  const hasRealData = normalized.name || normalized.organization ||
                     (normalized.email && !normalized.privacyProtected);

  if (!hasRealData) {
    normalized.privacyProtected = true;
  }

  return normalized;
}

/**
 * Clean a contact field value
 * @param {string} value - Field value
 * @returns {string|null} - Cleaned value or null
 */
function cleanContactField(value) {
  if (!value || typeof value !== 'string') return null;

  const cleaned = value.trim();

  // Check for "not disclosed" type values
  const emptyIndicators = ['not disclosed', 'n/a', 'none', 'null', '-', 'redacted'];
  if (emptyIndicators.some(indicator => cleaned.toLowerCase() === indicator)) {
    return null;
  }

  return cleaned || null;
}

/**
 * Build full address from contact fields
 * @param {Object} contact - Contact data
 * @returns {string|null} - Full address or null
 */
function buildFullAddress(contact) {
  const parts = [
    contact.address || contact.street,
    contact.city,
    contact.state,
    contact.postalCode,
    contact.country
  ].filter(p => p && typeof p === 'string');

  return parts.length > 0 ? parts.join(', ') : null;
}

// =============================================================================
// Privacy Protection Detection
// =============================================================================

/**
 * Check if domain has privacy protection enabled
 * @param {Object} data - Parsed WHOIS data
 * @returns {boolean} - True if privacy protected
 */
function isPrivacyProtected(data) {
  const contacts = data.contacts || {};

  // Check registrant specifically
  const registrant = contacts.registrant || {};
  const registrantValues = Object.values(registrant).filter(v => typeof v === 'string').join(' ').toLowerCase();

  const privacyIndicators = [
    'privacy', 'redacted', 'whoisguard', 'domains by proxy',
    'contact privacy', 'private', 'withheld', 'data protected',
    'identity protect', 'perfect privacy', 'anonymize', 'proxy',
    'protection', 'domain protection', 'whois privacy'
  ];

  if (privacyIndicators.some(indicator => registrantValues.includes(indicator))) {
    return true;
  }

  // Check registrar name for privacy services
  const registrar = (data.registrar || '').toLowerCase();
  if (privacyIndicators.some(indicator => registrar.includes(indicator))) {
    return true;
  }

  return false;
}

// =============================================================================
// Result Formatting for palletAI
// =============================================================================

/**
 * Format WHOIS results for palletAI consumption
 * @param {Object} data - WHOIS data (domain or IP)
 * @param {Object} options - Formatting options
 * @param {boolean} options.includeRaw - Include raw WHOIS data (default: false)
 * @param {string} options.format - Output format: 'full', 'summary', 'minimal' (default: 'full')
 * @returns {Object} - palletAI-formatted response
 */
function formatWhoisResults(data, options = {}) {
  const { includeRaw = false, format = 'full' } = options;

  // Determine if this is domain or IP data
  const isDomain = 'domain' in data && !('asn' in data);

  if (isDomain) {
    return formatDomainResults(data, { includeRaw, format });
  } else {
    return formatIPResults(data, { includeRaw, format });
  }
}

/**
 * Format domain WHOIS results for palletAI
 * @param {Object} data - Domain WHOIS data
 * @param {Object} options - Formatting options
 * @returns {Object} - Formatted response
 */
function formatDomainResults(data, options) {
  const { includeRaw, format } = options;

  const result = {
    success: true,
    type: 'domain_whois',
    query: data.domain,
    timestamp: data.timestamp || Date.now(),
    cached: data.cached || false,

    // Core information
    data: {
      domain: data.domain,
      registrar: data.registrar,
      status: data.status,
      privacyProtected: data.privacyProtected
    }
  };

  // Add dates
  if (data.dates) {
    result.data.dates = {
      created: data.dates.created,
      updated: data.dates.updated,
      expires: data.dates.expires,
      expiresInDays: data.dates.expiresInDays
    };
  }

  // Add nameservers
  if (data.nameservers && data.nameservers.length > 0) {
    result.data.nameservers = data.nameservers;
  }

  // Add contacts based on format level
  if (format !== 'minimal') {
    if (data.contacts) {
      result.data.contacts = {};

      for (const [type, contact] of Object.entries(data.contacts)) {
        if (contact) {
          if (format === 'summary') {
            // Summary: only include non-null, non-privacy fields
            result.data.contacts[type] = {
              name: contact.name,
              organization: contact.organization,
              email: contact.email,
              privacyProtected: contact.privacyProtected
            };
          } else {
            // Full: include everything
            result.data.contacts[type] = contact;
          }
        }
      }
    }
  }

  // Add DNSSEC info
  if (data.dnssec) {
    result.data.dnssec = data.dnssec;
  }

  // Include raw data if requested
  if (includeRaw && data.raw) {
    result.raw = data.raw;
  }

  // Add summary for quick consumption
  result.summary = generateDomainSummary(data);

  return result;
}

/**
 * Format IP WHOIS results for palletAI
 * @param {Object} data - IP WHOIS data
 * @param {Object} options - Formatting options
 * @returns {Object} - Formatted response
 */
function formatIPResults(data, options) {
  const { format } = options;

  const result = {
    success: true,
    type: 'ip_whois',
    query: data.ip,
    timestamp: data.timestamp || Date.now(),
    cached: data.cached || false,

    data: {
      ip: data.ip,
      type: data.type
    }
  };

  // Add location data
  result.data.location = {
    continent: data.continent,
    country: data.country,
    region: data.region,
    city: data.city,
    coordinates: data.latitude && data.longitude ? {
      latitude: data.latitude,
      longitude: data.longitude
    } : null,
    timezone: data.timezone
  };

  // Add network data
  result.data.network = {
    asn: data.asn,
    isp: data.isp,
    organization: data.organization
  };

  // Add risk indicators
  result.data.risk = {
    isProxy: data.isProxy,
    isHosting: data.isHosting
  };

  // Add summary
  result.summary = generateIPSummary(data);

  return result;
}

/**
 * Generate human-readable summary for domain WHOIS
 * @param {Object} data - Domain WHOIS data
 * @returns {string} - Summary text
 */
function generateDomainSummary(data) {
  const parts = [`Domain: ${data.domain}`];

  if (data.registrar) {
    parts.push(`Registrar: ${data.registrar}`);
  }

  if (data.dates) {
    if (data.dates.created) {
      parts.push(`Registered: ${new Date(data.dates.created).toLocaleDateString()}`);
    }
    if (data.dates.expires) {
      const expiryDate = new Date(data.dates.expires).toLocaleDateString();
      const daysText = data.dates.expiresInDays !== null
        ? ` (${data.dates.expiresInDays} days)`
        : '';
      parts.push(`Expires: ${expiryDate}${daysText}`);
    }
  }

  if (data.privacyProtected) {
    parts.push('Privacy Protection: Enabled');
  }

  if (data.nameservers && data.nameservers.length > 0) {
    parts.push(`Nameservers: ${data.nameservers.slice(0, 2).join(', ')}${data.nameservers.length > 2 ? '...' : ''}`);
  }

  return parts.join(' | ');
}

/**
 * Generate human-readable summary for IP WHOIS
 * @param {Object} data - IP WHOIS data
 * @returns {string} - Summary text
 */
function generateIPSummary(data) {
  const parts = [`IP: ${data.ip}`];

  if (data.country?.name) {
    const location = [data.city, data.region, data.country.name].filter(Boolean).join(', ');
    parts.push(`Location: ${location}`);
  }

  if (data.organization || data.isp) {
    parts.push(`Org: ${data.organization || data.isp}`);
  }

  if (data.asn?.number) {
    parts.push(`ASN: ${data.asn.number}`);
  }

  const risks = [];
  if (data.isProxy) risks.push('Proxy');
  if (data.isHosting) risks.push('Hosting');
  if (risks.length > 0) {
    parts.push(`Flags: ${risks.join(', ')}`);
  }

  return parts.join(' | ');
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Clean domain input (remove protocol, path, etc.)
 * @param {string} domain - Domain input
 * @returns {string} - Cleaned domain
 */
function cleanDomainInput(domain) {
  let cleaned = domain.trim().toLowerCase();

  // Remove protocol
  cleaned = cleaned.replace(/^https?:\/\//, '');

  // Remove www prefix
  cleaned = cleaned.replace(/^www\./, '');

  // Remove path and query
  cleaned = cleaned.split('/')[0].split('?')[0].split('#')[0];

  // Remove port
  cleaned = cleaned.split(':')[0];

  return cleaned;
}

/**
 * Validate domain format for WHOIS lookups
 * @param {string} domain - Domain to validate
 * @returns {boolean} - True if valid
 */
function isValidWhoisDomain(domain) {
  // Basic domain validation regex
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  return domainRegex.test(domain);
}

/**
 * Validate IP address format (IPv4 or IPv6) for WHOIS lookups
 * @param {string} ip - IP address to validate
 * @returns {boolean} - True if valid
 */
function isValidWhoisIP(ip) {
  // IPv4 regex
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  // Simplified IPv6 regex
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}$|^(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}$|^(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}$|^:(?::[0-9a-fA-F]{1,4}){1,7}$|^::$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Clear WHOIS cache
 * @param {string} type - Type to clear: 'domain', 'ip', or 'all'
 */
function clearCache(type = 'all') {
  if (type === 'all') {
    whoisCache.clear();
    return;
  }

  for (const [key] of whoisCache) {
    if (key.startsWith(`${type}:`)) {
      whoisCache.delete(key);
    }
  }
}

/**
 * Get cache statistics
 * @returns {Object} - Cache stats
 */
function getCacheStats() {
  let domainCount = 0;
  let ipCount = 0;

  for (const [key] of whoisCache) {
    if (key.startsWith('domain:')) domainCount++;
    if (key.startsWith('ip:')) ipCount++;
  }

  return {
    totalEntries: whoisCache.size,
    domainEntries: domainCount,
    ipEntries: ipCount,
    cacheDuration: WHOIS_CONFIG.CACHE_DURATION
  };
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in background script
if (typeof globalThis !== 'undefined') {
  globalThis.WhoisHandler = {
    lookupDomain,
    lookupIP,
    parseWhoisData,
    extractDates,
    extractContacts,
    formatWhoisResults,
    clearCache,
    getCacheStats,
    isValidWhoisDomain,
    isValidWhoisIP
  };
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    lookupDomain,
    lookupIP,
    parseWhoisData,
    extractDates,
    extractContacts,
    formatWhoisResults,
    clearCache,
    getCacheStats,
    isValidWhoisDomain,
    isValidWhoisIP
  };
}
