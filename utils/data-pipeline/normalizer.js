/**
 * Basset Hound Browser Automation - Data Normalizer
 * Phase 5.3: Data Pipeline Implementation
 *
 * Provides comprehensive data normalization utilities for:
 * - Date normalization to ISO format
 * - Name parsing and normalization
 * - Address parsing and normalization
 * - Phone number normalization with country codes
 * - Email validation and normalization
 * - Entity deduplication
 */

// =============================================================================
// Date Normalization
// =============================================================================

/**
 * Common date format patterns for parsing
 */
const DatePatterns = {
  // ISO formats
  ISO: /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?(?:Z|([+-]\d{2}):?(\d{2}))?)?$/,

  // US formats
  US_SLASH: /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/,           // MM/DD/YYYY or M/D/YY
  US_DASH: /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/,              // MM-DD-YYYY

  // European formats
  EU_SLASH: /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/,           // DD/MM/YYYY
  EU_DASH: /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/,              // DD-MM-YYYY
  EU_DOT: /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/,             // DD.MM.YYYY

  // Long formats
  LONG_US: /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/,        // Month DD, YYYY
  LONG_EU: /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/,          // DD Month YYYY

  // Short formats
  YEAR_MONTH: /^(\d{4})-(\d{2})$/,                          // YYYY-MM
  MONTH_YEAR: /^(\d{1,2})\/(\d{4})$/,                       // MM/YYYY

  // Unix timestamp (seconds or milliseconds)
  TIMESTAMP: /^\d{10,13}$/
};

/**
 * Month name mappings
 */
const MonthNames = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12
};

/**
 * Normalize a date string to ISO format (YYYY-MM-DD or full ISO 8601)
 *
 * @param {string|number|Date} dateString - Date to normalize
 * @param {Object} options - Normalization options
 * @param {string} options.format - Input format hint: 'us', 'eu', 'iso', 'auto' (default: 'auto')
 * @param {boolean} options.includeTime - Include time in output (default: false)
 * @param {string} options.timezone - Timezone for output (default: 'UTC')
 * @returns {Object} Normalization result
 */
function normalizeDate(dateString, options = {}) {
  const {
    format = 'auto',
    includeTime = false,
    timezone = 'UTC'
  } = options;

  const result = {
    success: false,
    original: dateString,
    normalized: null,
    format: null,
    components: null,
    errors: [],
    warnings: []
  };

  // Handle null/undefined
  if (dateString === null || dateString === undefined || dateString === '') {
    result.errors.push({ code: 'EMPTY_INPUT', message: 'Date input is empty' });
    return result;
  }

  // Handle Date objects
  if (dateString instanceof Date) {
    if (isNaN(dateString.getTime())) {
      result.errors.push({ code: 'INVALID_DATE_OBJECT', message: 'Invalid Date object' });
      return result;
    }
    return formatDateResult(dateString, result, includeTime, 'Date object');
  }

  // Handle timestamps
  if (typeof dateString === 'number' || DatePatterns.TIMESTAMP.test(String(dateString))) {
    const timestamp = Number(dateString);
    // Determine if seconds or milliseconds
    const date = new Date(timestamp > 9999999999 ? timestamp : timestamp * 1000);
    if (isNaN(date.getTime())) {
      result.errors.push({ code: 'INVALID_TIMESTAMP', message: 'Invalid timestamp' });
      return result;
    }
    return formatDateResult(date, result, includeTime, 'timestamp');
  }

  // Convert to string and trim
  const input = String(dateString).trim();

  // Try ISO format first (always unambiguous)
  const isoMatch = input.match(DatePatterns.ISO);
  if (isoMatch) {
    const date = new Date(input);
    if (!isNaN(date.getTime())) {
      return formatDateResult(date, result, includeTime, 'ISO');
    }
  }

  // Try parsing based on format hint
  let parsedDate = null;
  let detectedFormat = null;

  if (format === 'us' || format === 'auto') {
    // Try US formats (MM/DD/YYYY)
    const usMatch = input.match(DatePatterns.US_SLASH) || input.match(DatePatterns.US_DASH);
    if (usMatch) {
      const [, month, day, year] = usMatch;
      parsedDate = tryCreateDate(year, month, day);
      if (parsedDate) {
        detectedFormat = 'US';
      }
    }
  }

  if (!parsedDate && (format === 'eu' || format === 'auto')) {
    // Try EU formats (DD/MM/YYYY, DD.MM.YYYY)
    const euMatch = input.match(DatePatterns.EU_DOT);
    if (euMatch) {
      const [, day, month, year] = euMatch;
      parsedDate = tryCreateDate(year, month, day);
      if (parsedDate) {
        detectedFormat = 'EU (dot)';
      }
    }

    // For slash/dash formats, EU interpretation if format is explicitly 'eu'
    if (!parsedDate && format === 'eu') {
      const euSlashMatch = input.match(DatePatterns.EU_SLASH) || input.match(DatePatterns.EU_DASH);
      if (euSlashMatch) {
        const [, day, month, year] = euSlashMatch;
        parsedDate = tryCreateDate(year, month, day);
        if (parsedDate) {
          detectedFormat = 'EU';
        }
      }
    }
  }

  // Try long format with month names
  if (!parsedDate) {
    const longUSMatch = input.match(DatePatterns.LONG_US);
    if (longUSMatch) {
      const [, monthName, day, year] = longUSMatch;
      const month = MonthNames[monthName.toLowerCase()];
      if (month) {
        parsedDate = tryCreateDate(year, month, day);
        if (parsedDate) {
          detectedFormat = 'Long US';
        }
      }
    }
  }

  if (!parsedDate) {
    const longEUMatch = input.match(DatePatterns.LONG_EU);
    if (longEUMatch) {
      const [, day, monthName, year] = longEUMatch;
      const month = MonthNames[monthName.toLowerCase()];
      if (month) {
        parsedDate = tryCreateDate(year, month, day);
        if (parsedDate) {
          detectedFormat = 'Long EU';
        }
      }
    }
  }

  // Try native Date parsing as fallback
  if (!parsedDate) {
    const nativeDate = new Date(input);
    if (!isNaN(nativeDate.getTime())) {
      parsedDate = nativeDate;
      detectedFormat = 'native';
      result.warnings.push({
        code: 'NATIVE_PARSE',
        message: 'Used native Date parsing - result may vary by browser'
      });
    }
  }

  if (parsedDate) {
    return formatDateResult(parsedDate, result, includeTime, detectedFormat);
  }

  result.errors.push({
    code: 'PARSE_FAILED',
    message: `Unable to parse date: ${input}`
  });
  return result;
}

/**
 * Helper to try creating a date from components
 * @private
 */
function tryCreateDate(year, month, day) {
  let y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);

  // Handle 2-digit years
  if (y < 100) {
    y = y > 50 ? 1900 + y : 2000 + y;
  }

  // Validate ranges
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return null;
  }

  const date = new Date(y, m - 1, d);

  // Verify the date is valid (handles things like Feb 30)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }

  return date;
}

/**
 * Format date result object
 * @private
 */
function formatDateResult(date, result, includeTime, detectedFormat) {
  result.success = true;
  result.format = detectedFormat;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  result.components = {
    year,
    month: date.getMonth() + 1,
    day: date.getDate(),
    dayOfWeek: date.getDay(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds()
  };

  if (includeTime) {
    result.normalized = date.toISOString();
  } else {
    result.normalized = `${year}-${month}-${day}`;
  }

  return result;
}

// =============================================================================
// Name Normalization
// =============================================================================

/**
 * Common name prefixes/titles
 */
const NamePrefixes = new Set([
  'mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'rev', 'fr', 'sr', 'jr',
  'sir', 'dame', 'lord', 'lady', 'hon', 'judge', 'senator', 'rep',
  'gen', 'col', 'maj', 'capt', 'lt', 'sgt', 'cpl', 'pvt'
]);

/**
 * Common name suffixes
 */
const NameSuffixes = new Set([
  'jr', 'sr', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii',
  'phd', 'md', 'dds', 'esq', 'cpa', 'rn', 'dvm',
  'jd', 'llb', 'ma', 'mba', 'msc', 'ba', 'bs', 'bsc'
]);

/**
 * Compound last name indicators
 */
const CompoundIndicators = new Set([
  'de', 'del', 'della', 'di', 'da', 'van', 'von', 'der', 'den',
  'le', 'la', 'du', 'des', 'el', 'al', 'ibn', 'bin', 'bint',
  'mac', 'mc', 'o\'', 'st', 'saint'
]);

/**
 * Parse and normalize a name
 *
 * @param {string} name - Full name to parse
 * @param {Object} options - Parsing options
 * @param {string} options.format - Expected format: 'first_last', 'last_first', 'auto' (default: 'auto')
 * @param {boolean} options.titleCase - Convert to title case (default: true)
 * @param {boolean} options.preserveCase - Keep original case for specific names (default: false)
 * @returns {Object} Parsed name result
 */
function normalizeName(name, options = {}) {
  const {
    format = 'auto',
    titleCase = true,
    preserveCase = false
  } = options;

  const result = {
    success: false,
    original: name,
    normalized: null,
    components: {
      prefix: null,
      firstName: null,
      middleName: null,
      lastName: null,
      suffix: null,
      nickname: null
    },
    formatted: {
      full: null,
      firstLast: null,
      lastFirst: null,
      formal: null,
      initials: null
    },
    errors: [],
    warnings: []
  };

  // Handle null/undefined
  if (!name || typeof name !== 'string') {
    result.errors.push({ code: 'INVALID_INPUT', message: 'Name must be a non-empty string' });
    return result;
  }

  // Clean and normalize whitespace
  let cleanName = name.trim().replace(/\s+/g, ' ');

  // Extract nickname in parentheses or quotes
  const nicknameMatch = cleanName.match(/[("']([^)"']+)[)"']/);
  if (nicknameMatch) {
    result.components.nickname = nicknameMatch[1].trim();
    cleanName = cleanName.replace(nicknameMatch[0], '').trim();
  }

  // Split into parts
  let parts = cleanName.split(/\s+/);

  // Check for "Last, First" format
  const hasComma = cleanName.includes(',');
  if (hasComma && (format === 'last_first' || format === 'auto')) {
    const commaParts = cleanName.split(',').map(p => p.trim());
    if (commaParts.length >= 2) {
      // Reorder: Last, First Middle -> First Middle Last
      parts = [...commaParts[1].split(/\s+/), ...commaParts[0].split(/\s+/)];
    }
  }

  // Extract prefix (title)
  if (parts.length > 1) {
    const firstPart = parts[0].toLowerCase().replace(/\.$/g, '');
    if (NamePrefixes.has(firstPart)) {
      result.components.prefix = formatNamePart(parts.shift(), titleCase);
    }
  }

  // Extract suffix
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1].toLowerCase().replace(/\.$/g, '');
    if (NameSuffixes.has(lastPart)) {
      result.components.suffix = parts.pop().toUpperCase().replace(/\.$/, '');
    }
  }

  // Handle remaining parts
  if (parts.length === 0) {
    result.errors.push({ code: 'NO_NAME_PARTS', message: 'No name parts found' });
    return result;
  }

  if (parts.length === 1) {
    // Single name - could be first or last
    result.components.firstName = formatNamePart(parts[0], titleCase);
    result.warnings.push({
      code: 'SINGLE_NAME',
      message: 'Only one name part found - treating as first name'
    });
  } else if (parts.length === 2) {
    result.components.firstName = formatNamePart(parts[0], titleCase);
    result.components.lastName = formatNamePart(parts[1], titleCase);
  } else {
    // Multiple parts - check for compound last names
    result.components.firstName = formatNamePart(parts[0], titleCase);

    // Check if second-to-last part is a compound indicator
    const potentialCompound = parts[parts.length - 2].toLowerCase();
    if (parts.length > 2 && CompoundIndicators.has(potentialCompound)) {
      result.components.lastName = formatNamePart(
        parts.slice(-2).join(' '),
        titleCase
      );
      result.components.middleName = formatNamePart(
        parts.slice(1, -2).join(' '),
        titleCase
      ) || null;
    } else {
      result.components.lastName = formatNamePart(parts[parts.length - 1], titleCase);
      result.components.middleName = formatNamePart(
        parts.slice(1, -1).join(' '),
        titleCase
      ) || null;
    }
  }

  // Build formatted versions
  const { prefix, firstName, middleName, lastName, suffix } = result.components;

  const fullParts = [prefix, firstName, middleName, lastName, suffix].filter(Boolean);
  result.formatted.full = fullParts.join(' ');

  result.formatted.firstLast = [firstName, lastName].filter(Boolean).join(' ');
  result.formatted.lastFirst = lastName && firstName ? `${lastName}, ${firstName}` : (lastName || firstName);

  result.formatted.formal = [
    prefix,
    firstName,
    middleName ? middleName.charAt(0) + '.' : null,
    lastName,
    suffix
  ].filter(Boolean).join(' ');

  result.formatted.initials = [
    firstName ? firstName.charAt(0) : null,
    middleName ? middleName.charAt(0) : null,
    lastName ? lastName.charAt(0) : null
  ].filter(Boolean).join('').toUpperCase();

  result.normalized = result.formatted.full;
  result.success = true;

  return result;
}

/**
 * Format a name part with proper casing
 * @private
 */
function formatNamePart(part, titleCase) {
  if (!part) return null;

  if (!titleCase) return part;

  // Handle hyphenated names
  if (part.includes('-')) {
    return part.split('-').map(p => formatNamePart(p, true)).join('-');
  }

  // Handle names starting with O' or Mc/Mac
  const lowerPart = part.toLowerCase();
  if (lowerPart.startsWith('o\'')) {
    return 'O\'' + part.charAt(2).toUpperCase() + part.slice(3).toLowerCase();
  }
  if (lowerPart.startsWith('mc') && part.length > 2) {
    return 'Mc' + part.charAt(2).toUpperCase() + part.slice(3).toLowerCase();
  }
  if (lowerPart.startsWith('mac') && part.length > 3) {
    return 'Mac' + part.charAt(3).toUpperCase() + part.slice(4).toLowerCase();
  }

  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

// =============================================================================
// Address Normalization
// =============================================================================

/**
 * US State abbreviations mapping
 */
const USStates = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC',
  'puerto rico': 'PR', 'guam': 'GU', 'virgin islands': 'VI'
};

/**
 * Common street type abbreviations
 */
const StreetTypes = {
  'avenue': 'Ave', 'ave': 'Ave',
  'boulevard': 'Blvd', 'blvd': 'Blvd',
  'circle': 'Cir', 'cir': 'Cir',
  'court': 'Ct', 'ct': 'Ct',
  'drive': 'Dr', 'dr': 'Dr',
  'expressway': 'Expy', 'expy': 'Expy',
  'freeway': 'Fwy', 'fwy': 'Fwy',
  'highway': 'Hwy', 'hwy': 'Hwy',
  'lane': 'Ln', 'ln': 'Ln',
  'parkway': 'Pkwy', 'pkwy': 'Pkwy',
  'place': 'Pl', 'pl': 'Pl',
  'road': 'Rd', 'rd': 'Rd',
  'street': 'St', 'st': 'St',
  'terrace': 'Ter', 'ter': 'Ter',
  'trail': 'Trl', 'trl': 'Trl',
  'way': 'Way'
};

/**
 * Direction abbreviations
 */
const Directions = {
  'north': 'N', 'n': 'N',
  'south': 'S', 's': 'S',
  'east': 'E', 'e': 'E',
  'west': 'W', 'w': 'W',
  'northeast': 'NE', 'ne': 'NE',
  'northwest': 'NW', 'nw': 'NW',
  'southeast': 'SE', 'se': 'SE',
  'southwest': 'SW', 'sw': 'SW'
};

/**
 * Unit type abbreviations
 */
const UnitTypes = {
  'apartment': 'Apt', 'apt': 'Apt',
  'suite': 'Ste', 'ste': 'Ste',
  'unit': 'Unit',
  'floor': 'Fl', 'fl': 'Fl',
  'room': 'Rm', 'rm': 'Rm',
  'building': 'Bldg', 'bldg': 'Bldg',
  'number': '#', 'no': '#', '#': '#'
};

/**
 * Parse and normalize an address
 *
 * @param {string|Object} address - Address string or object to normalize
 * @param {Object} options - Normalization options
 * @param {boolean} options.abbreviate - Use standard abbreviations (default: true)
 * @param {string} options.country - Country context for parsing (default: 'US')
 * @returns {Object} Normalized address result
 */
function normalizeAddress(address, options = {}) {
  const {
    abbreviate = true,
    country = 'US'
  } = options;

  const result = {
    success: false,
    original: address,
    normalized: null,
    components: {
      streetNumber: null,
      streetName: null,
      streetType: null,
      direction: null,
      unit: null,
      unitNumber: null,
      city: null,
      state: null,
      postalCode: null,
      country: null
    },
    formatted: {
      line1: null,
      line2: null,
      cityStateZip: null,
      full: null,
      oneLine: null
    },
    errors: [],
    warnings: []
  };

  // Handle null/undefined
  if (!address) {
    result.errors.push({ code: 'EMPTY_INPUT', message: 'Address input is empty' });
    return result;
  }

  // Handle object input
  if (typeof address === 'object' && !Array.isArray(address)) {
    return normalizeAddressObject(address, result, options);
  }

  // Handle string input
  if (typeof address !== 'string') {
    result.errors.push({ code: 'INVALID_INPUT', message: 'Address must be a string or object' });
    return result;
  }

  const cleanAddress = address.trim().replace(/\s+/g, ' ');

  // Try to parse the address
  const lines = cleanAddress.split(/[,\n]+/).map(l => l.trim()).filter(Boolean);

  if (lines.length === 0) {
    result.errors.push({ code: 'EMPTY_ADDRESS', message: 'No address content found' });
    return result;
  }

  // Parse first line (street address)
  const streetLine = lines[0];
  parseStreetAddress(streetLine, result.components, abbreviate);

  // Parse remaining lines
  if (lines.length >= 2) {
    // Check for unit on second line
    const secondLine = lines[1];
    const unitMatch = secondLine.match(/^(apt|suite|ste|unit|fl|floor|rm|room|bldg|#|no\.?)\s*#?\s*(\S+)/i);
    if (unitMatch) {
      result.components.unit = abbreviate ? (UnitTypes[unitMatch[1].toLowerCase()] || unitMatch[1]) : unitMatch[1];
      result.components.unitNumber = unitMatch[2];
      // City/State/Zip on third line
      if (lines.length >= 3) {
        parseCityStateZip(lines[2], result.components, abbreviate, country);
      }
    } else {
      // City/State/Zip on second line
      parseCityStateZip(secondLine, result.components, abbreviate, country);
    }
  }

  // Parse country if present
  if (lines.length >= 3 && !result.components.country) {
    const lastLine = lines[lines.length - 1].trim();
    if (!lastLine.match(/\d/) && lastLine.length < 30) {
      result.components.country = lastLine;
    }
  }

  // Build formatted output
  buildFormattedAddress(result);

  result.success = result.components.streetNumber !== null || result.components.streetName !== null;

  if (!result.success) {
    result.warnings.push({
      code: 'PARTIAL_PARSE',
      message: 'Could not fully parse address - some components may be missing'
    });
    result.success = true; // Still return what we have
  }

  result.normalized = result.formatted.full;
  return result;
}

/**
 * Normalize address from object format
 * @private
 */
function normalizeAddressObject(address, result, options) {
  const { abbreviate = true, country = 'US' } = options;

  // Map common field names
  const fieldMappings = {
    streetNumber: ['streetNumber', 'street_number', 'houseNumber', 'house_number', 'number'],
    streetName: ['streetName', 'street_name', 'street', 'address1', 'address_1', 'line1', 'addressLine1'],
    unit: ['unit', 'apt', 'apartment', 'suite', 'address2', 'address_2', 'line2', 'addressLine2'],
    city: ['city', 'locality', 'town', 'municipality'],
    state: ['state', 'province', 'region', 'administrativeArea', 'administrative_area'],
    postalCode: ['postalCode', 'postal_code', 'zipCode', 'zip_code', 'zip', 'postcode'],
    country: ['country', 'countryCode', 'country_code', 'nation']
  };

  for (const [component, fields] of Object.entries(fieldMappings)) {
    for (const field of fields) {
      if (address[field] !== undefined && address[field] !== null) {
        let value = String(address[field]).trim();

        // Apply abbreviations
        if (abbreviate) {
          if (component === 'state' && country === 'US') {
            const stateLower = value.toLowerCase();
            if (USStates[stateLower]) {
              value = USStates[stateLower];
            }
          }
        }

        result.components[component] = value;
        break;
      }
    }
  }

  // Parse unit number if combined
  if (result.components.unit && !result.components.unitNumber) {
    const unitMatch = result.components.unit.match(/^(.*?)\s*#?\s*(\d+\S*)$/);
    if (unitMatch) {
      result.components.unit = unitMatch[1] || 'Unit';
      result.components.unitNumber = unitMatch[2];
    }
  }

  buildFormattedAddress(result);
  result.success = true;
  result.normalized = result.formatted.full;

  return result;
}

/**
 * Parse street address line
 * @private
 */
function parseStreetAddress(line, components, abbreviate) {
  // Pattern: [number] [direction] [street name] [street type] [direction]
  const parts = line.split(/\s+/);

  if (parts.length === 0) return;

  // Extract street number
  if (/^\d+[a-zA-Z]?$/.test(parts[0]) || /^\d+-\d+$/.test(parts[0])) {
    components.streetNumber = parts.shift();
  }

  // Extract pre-direction
  if (parts.length > 0) {
    const dirLower = parts[0].toLowerCase().replace(/\.$/, '');
    if (Directions[dirLower]) {
      components.direction = abbreviate ? Directions[dirLower] : parts[0];
      parts.shift();
    }
  }

  // Extract street type and post-direction from end
  let streetParts = [...parts];

  // Check for post-direction at end
  if (streetParts.length > 0) {
    const lastPart = streetParts[streetParts.length - 1].toLowerCase().replace(/\.$/, '');
    if (Directions[lastPart]) {
      const dir = streetParts.pop();
      if (!components.direction) {
        components.direction = abbreviate ? Directions[lastPart] : dir;
      }
    }
  }

  // Check for street type
  if (streetParts.length > 0) {
    const lastPart = streetParts[streetParts.length - 1].toLowerCase().replace(/\.$/, '');
    if (StreetTypes[lastPart]) {
      components.streetType = abbreviate ? StreetTypes[lastPart] : streetParts.pop();
    }
  }

  // Extract unit if attached
  const lastPart = streetParts[streetParts.length - 1];
  if (lastPart) {
    const unitMatch = lastPart.match(/^(.*?)#(\S+)$/);
    if (unitMatch) {
      streetParts[streetParts.length - 1] = unitMatch[1];
      components.unit = '#';
      components.unitNumber = unitMatch[2];
    }
  }

  // Remaining parts are street name
  components.streetName = streetParts.filter(Boolean).join(' ');
}

/**
 * Parse city, state, zip line
 * @private
 */
function parseCityStateZip(line, components, abbreviate, country) {
  // Patterns for city, state, zip
  // "City, ST 12345" or "City ST 12345" or "City, State 12345"

  // US ZIP pattern (5 or 9 digits)
  const usZipMatch = line.match(/\b(\d{5})(?:-(\d{4}))?\s*$/);
  if (usZipMatch) {
    components.postalCode = usZipMatch[2] ? `${usZipMatch[1]}-${usZipMatch[2]}` : usZipMatch[1];
    line = line.replace(usZipMatch[0], '').trim();
  }

  // Canadian postal code pattern
  const caPostalMatch = line.match(/\b([A-Z]\d[A-Z]\s?\d[A-Z]\d)\s*$/i);
  if (caPostalMatch && !components.postalCode) {
    components.postalCode = caPostalMatch[1].toUpperCase().replace(/\s/, ' ');
    line = line.replace(caPostalMatch[0], '').trim();
  }

  // Split remaining by comma or last word
  const commaParts = line.split(',').map(p => p.trim()).filter(Boolean);

  if (commaParts.length >= 2) {
    components.city = commaParts[0];
    // State might have zip still attached
    components.state = commaParts[1].replace(/\s+\S+\s*$/, '').trim() || commaParts[1];
  } else {
    // Try to split by recognizable state
    const words = line.split(/\s+/);

    // Check last 1-2 words for state
    if (words.length >= 2) {
      const twoWordState = words.slice(-2).join(' ').toLowerCase();
      const oneWordState = words[words.length - 1].toUpperCase();

      if (USStates[twoWordState]) {
        components.state = abbreviate ? USStates[twoWordState] : words.slice(-2).join(' ');
        components.city = words.slice(0, -2).join(' ');
      } else if (Object.values(USStates).includes(oneWordState) || USStates[oneWordState.toLowerCase()]) {
        components.state = oneWordState;
        components.city = words.slice(0, -1).join(' ');
      } else {
        components.city = line;
      }
    } else {
      components.city = line;
    }
  }

  // Apply state abbreviation
  if (abbreviate && components.state && country === 'US') {
    const stateLower = components.state.toLowerCase();
    if (USStates[stateLower]) {
      components.state = USStates[stateLower];
    }
  }
}

/**
 * Build formatted address strings
 * @private
 */
function buildFormattedAddress(result) {
  const c = result.components;

  // Build line 1
  const line1Parts = [
    c.streetNumber,
    c.direction,
    c.streetName,
    c.streetType
  ].filter(Boolean);
  result.formatted.line1 = line1Parts.join(' ') || null;

  // Build line 2
  if (c.unit || c.unitNumber) {
    result.formatted.line2 = [c.unit, c.unitNumber].filter(Boolean).join(' ');
  }

  // Build city/state/zip
  const cityStateParts = [];
  if (c.city) cityStateParts.push(c.city);
  if (c.state) {
    if (cityStateParts.length > 0) {
      cityStateParts[cityStateParts.length - 1] += ',';
    }
    cityStateParts.push(c.state);
  }
  if (c.postalCode) cityStateParts.push(c.postalCode);
  result.formatted.cityStateZip = cityStateParts.join(' ') || null;

  // Build full address
  const fullParts = [
    result.formatted.line1,
    result.formatted.line2,
    result.formatted.cityStateZip,
    c.country
  ].filter(Boolean);
  result.formatted.full = fullParts.join(', ');

  // Build one-line
  result.formatted.oneLine = fullParts.join(', ');
}

// =============================================================================
// Phone Normalization
// =============================================================================

/**
 * Country code configurations
 */
const CountryCodes = {
  US: { code: '1', length: 10, format: '($1) $2-$3', pattern: /^1?(\d{3})(\d{3})(\d{4})$/ },
  CA: { code: '1', length: 10, format: '($1) $2-$3', pattern: /^1?(\d{3})(\d{3})(\d{4})$/ },
  UK: { code: '44', length: 10, format: '$1 $2 $3', pattern: /^44?(\d{4})(\d{3})(\d{3})$/ },
  GB: { code: '44', length: 10, format: '$1 $2 $3', pattern: /^44?(\d{4})(\d{3})(\d{3})$/ },
  DE: { code: '49', length: [10, 11, 12], format: '$1 $2', pattern: /^49?(\d{3,5})(\d+)$/ },
  FR: { code: '33', length: 9, format: '$1 $2 $3 $4 $5', pattern: /^33?(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/ },
  AU: { code: '61', length: 9, format: '$1 $2 $3', pattern: /^61?(\d{1})(\d{4})(\d{4})$/ },
  IN: { code: '91', length: 10, format: '$1-$2', pattern: /^91?(\d{5})(\d{5})$/ }
};

/**
 * Normalize a phone number
 *
 * @param {string} phone - Phone number to normalize
 * @param {Object} options - Normalization options
 * @param {string} options.countryCode - Default country code (default: 'US')
 * @param {string} options.format - Output format: 'e164', 'national', 'international' (default: 'e164')
 * @returns {Object} Normalized phone result
 */
function normalizePhone(phone, options = {}) {
  const {
    countryCode = 'US',
    format = 'e164'
  } = options;

  const result = {
    success: false,
    original: phone,
    normalized: null,
    components: {
      countryCode: null,
      areaCode: null,
      number: null,
      extension: null
    },
    formatted: {
      e164: null,
      national: null,
      international: null
    },
    valid: false,
    errors: [],
    warnings: []
  };

  // Handle null/undefined
  if (!phone || typeof phone !== 'string') {
    result.errors.push({ code: 'INVALID_INPUT', message: 'Phone must be a non-empty string' });
    return result;
  }

  // Clean the input - remove all non-digit characters except + at start and x for extension
  let cleanPhone = phone.trim();

  // Extract extension
  const extMatch = cleanPhone.match(/(?:ext|extension|x|#)\s*(\d+)/i);
  if (extMatch) {
    result.components.extension = extMatch[1];
    cleanPhone = cleanPhone.replace(extMatch[0], '');
  }

  // Remove all non-digits except leading +
  const hasPlus = cleanPhone.startsWith('+');
  const digits = cleanPhone.replace(/\D/g, '');

  if (digits.length === 0) {
    result.errors.push({ code: 'NO_DIGITS', message: 'No digits found in phone number' });
    return result;
  }

  // Determine country
  const countryConfig = CountryCodes[countryCode.toUpperCase()] || CountryCodes.US;
  let phoneDigits = digits;
  let detectedCountryCode = countryConfig.code;

  // Check if starts with country code
  if (hasPlus || digits.length > (Array.isArray(countryConfig.length) ? Math.max(...countryConfig.length) : countryConfig.length)) {
    // Try to detect country code
    for (const [cc, config] of Object.entries(CountryCodes)) {
      if (digits.startsWith(config.code)) {
        detectedCountryCode = config.code;
        phoneDigits = digits.slice(config.code.length);
        break;
      }
    }
  }

  result.components.countryCode = detectedCountryCode;

  // Validate length
  const expectedLength = Array.isArray(countryConfig.length) ? countryConfig.length : [countryConfig.length];
  if (!expectedLength.some(len => phoneDigits.length === len || phoneDigits.length === len + 1)) {
    result.warnings.push({
      code: 'UNEXPECTED_LENGTH',
      message: `Phone number length ${phoneDigits.length} differs from expected ${expectedLength.join(' or ')}`
    });
  }

  // Extract components based on pattern
  const fullNumber = detectedCountryCode + phoneDigits;
  const patternMatch = fullNumber.match(countryConfig.pattern);

  if (patternMatch) {
    if (patternMatch.length >= 3) {
      result.components.areaCode = patternMatch[1];
      result.components.number = patternMatch.slice(2).join('');
    }
  } else {
    // Generic extraction
    if (phoneDigits.length >= 10) {
      result.components.areaCode = phoneDigits.slice(0, 3);
      result.components.number = phoneDigits.slice(3);
    } else {
      result.components.number = phoneDigits;
    }
  }

  // Build formatted versions
  result.formatted.e164 = `+${detectedCountryCode}${phoneDigits}`;

  // National format (no country code)
  if (patternMatch) {
    result.formatted.national = countryConfig.format.replace(/\$(\d)/g, (_, n) => patternMatch[parseInt(n)] || '');
  } else {
    // Fallback formatting
    if (phoneDigits.length === 10) {
      result.formatted.national = `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}`;
    } else {
      result.formatted.national = phoneDigits;
    }
  }

  // International format
  result.formatted.international = `+${detectedCountryCode} ${result.formatted.national}`;

  // Add extension to formats
  if (result.components.extension) {
    result.formatted.e164 += `;ext=${result.components.extension}`;
    result.formatted.national += ` ext. ${result.components.extension}`;
    result.formatted.international += ` ext. ${result.components.extension}`;
  }

  // Select output format
  result.normalized = result.formatted[format] || result.formatted.e164;
  result.valid = phoneDigits.length >= 7 && phoneDigits.length <= 15;
  result.success = true;

  return result;
}

// =============================================================================
// Email Normalization
// =============================================================================

/**
 * Common email domain corrections
 */
const EmailDomainCorrections = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com'
};

/**
 * Plus addressing providers
 */
const PlusAddressingProviders = new Set([
  'gmail.com', 'googlemail.com',
  'outlook.com', 'hotmail.com', 'live.com',
  'fastmail.com', 'protonmail.com', 'proton.me'
]);

/**
 * Validate and normalize an email address
 *
 * @param {string} email - Email address to normalize
 * @param {Object} options - Normalization options
 * @param {boolean} options.lowercase - Convert to lowercase (default: true)
 * @param {boolean} options.removePlusAddressing - Remove + aliases (default: false)
 * @param {boolean} options.suggestCorrections - Suggest common typo fixes (default: true)
 * @returns {Object} Normalized email result
 */
function normalizeEmail(email, options = {}) {
  const {
    lowercase = true,
    removePlusAddressing = false,
    suggestCorrections = true
  } = options;

  const result = {
    success: false,
    original: email,
    normalized: null,
    components: {
      localPart: null,
      domain: null,
      tld: null,
      plusAddress: null
    },
    valid: false,
    formatted: {
      standard: null,
      canonical: null
    },
    suggestions: [],
    errors: [],
    warnings: []
  };

  // Handle null/undefined
  if (!email || typeof email !== 'string') {
    result.errors.push({ code: 'INVALID_INPUT', message: 'Email must be a non-empty string' });
    return result;
  }

  // Clean and trim
  let cleanEmail = email.trim();

  // Basic format check
  if (!cleanEmail.includes('@')) {
    result.errors.push({ code: 'NO_AT_SIGN', message: 'Email must contain @ symbol' });
    return result;
  }

  // Split into local and domain parts
  const atIndex = cleanEmail.lastIndexOf('@');
  let localPart = cleanEmail.slice(0, atIndex);
  let domain = cleanEmail.slice(atIndex + 1);

  // Validate parts exist
  if (!localPart) {
    result.errors.push({ code: 'EMPTY_LOCAL', message: 'Email local part is empty' });
    return result;
  }
  if (!domain) {
    result.errors.push({ code: 'EMPTY_DOMAIN', message: 'Email domain is empty' });
    return result;
  }

  // Apply lowercase
  if (lowercase) {
    localPart = localPart.toLowerCase();
    domain = domain.toLowerCase();
  }

  // Check for plus addressing
  const plusIndex = localPart.indexOf('+');
  if (plusIndex !== -1) {
    result.components.plusAddress = localPart.slice(plusIndex + 1);
    if (removePlusAddressing) {
      localPart = localPart.slice(0, plusIndex);
      result.warnings.push({
        code: 'PLUS_REMOVED',
        message: 'Plus addressing alias was removed'
      });
    }
  }

  // Domain corrections
  if (suggestCorrections && EmailDomainCorrections[domain]) {
    const corrected = EmailDomainCorrections[domain];
    result.suggestions.push({
      type: 'domain_typo',
      original: domain,
      suggested: corrected,
      confidence: 0.9
    });
    result.warnings.push({
      code: 'POSSIBLE_TYPO',
      message: `Domain '${domain}' may be a typo for '${corrected}'`
    });
  }

  // Extract TLD
  const domainParts = domain.split('.');
  if (domainParts.length < 2) {
    result.errors.push({ code: 'INVALID_DOMAIN', message: 'Domain must have at least one dot' });
    return result;
  }
  result.components.tld = domainParts[domainParts.length - 1];

  // Validate domain format
  const domainPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
  if (!domainPattern.test(domain)) {
    result.errors.push({ code: 'INVALID_DOMAIN_FORMAT', message: 'Domain format is invalid' });
  }

  // Validate local part (simplified)
  // RFC 5321 allows many characters, but we'll use a common subset
  const localPattern = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/i;
  if (!localPattern.test(localPart.replace(/\+.*$/, ''))) {
    result.warnings.push({
      code: 'UNUSUAL_LOCAL',
      message: 'Local part contains unusual characters'
    });
  }

  // Check for consecutive dots
  if (localPart.includes('..') || domain.includes('..')) {
    result.errors.push({ code: 'CONSECUTIVE_DOTS', message: 'Email cannot contain consecutive dots' });
  }

  // Set components
  result.components.localPart = localPart;
  result.components.domain = domain;

  // Build formatted versions
  result.formatted.standard = `${localPart}@${domain}`;

  // Canonical form (without plus addressing, periods in gmail)
  let canonicalLocal = localPart.replace(/\+.*$/, '');
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    canonicalLocal = canonicalLocal.replace(/\./g, '');
    domain = 'gmail.com';
  }
  result.formatted.canonical = `${canonicalLocal}@${domain}`;

  result.normalized = result.formatted.standard;
  result.valid = result.errors.length === 0;
  result.success = true;

  return result;
}

// =============================================================================
// Entity Deduplication
// =============================================================================

/**
 * Remove duplicate entities based on matching fields
 *
 * @param {Array} entities - Array of entity objects to deduplicate
 * @param {Object} options - Deduplication options
 * @param {Array<string>} options.matchFields - Fields to use for matching (required)
 * @param {string} options.strategy - Strategy: 'exact', 'fuzzy', 'normalized' (default: 'exact')
 * @param {number} options.threshold - Similarity threshold for fuzzy matching (0-1, default: 0.8)
 * @param {string} options.keepStrategy - Which duplicate to keep: 'first', 'last', 'merge' (default: 'first')
 * @returns {Object} Deduplication result
 */
function deduplicateEntities(entities, options = {}) {
  const {
    matchFields = [],
    strategy = 'exact',
    threshold = 0.8,
    keepStrategy = 'first'
  } = options;

  const result = {
    success: false,
    original: entities,
    deduplicated: [],
    duplicates: [],
    stats: {
      originalCount: 0,
      deduplicatedCount: 0,
      duplicatesRemoved: 0,
      groups: []
    },
    errors: [],
    warnings: []
  };

  // Validate input
  if (!Array.isArray(entities)) {
    result.errors.push({ code: 'INVALID_INPUT', message: 'Entities must be an array' });
    return result;
  }

  if (entities.length === 0) {
    result.success = true;
    result.deduplicated = [];
    return result;
  }

  if (!matchFields || matchFields.length === 0) {
    result.errors.push({ code: 'NO_MATCH_FIELDS', message: 'matchFields array is required' });
    return result;
  }

  result.stats.originalCount = entities.length;

  // Build index by match key
  const seen = new Map();
  const groups = [];

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    const matchKey = buildMatchKey(entity, matchFields, strategy);

    if (matchKey === null) {
      // Missing match fields - keep the entity but warn
      result.deduplicated.push(entity);
      result.warnings.push({
        code: 'MISSING_MATCH_FIELDS',
        index: i,
        message: `Entity at index ${i} is missing some match fields`
      });
      continue;
    }

    if (strategy === 'fuzzy') {
      // Fuzzy matching - compare against all seen keys
      let foundMatch = false;
      for (const [seenKey, seenData] of seen) {
        const similarity = calculateSimilarity(matchKey, seenKey);
        if (similarity >= threshold) {
          // Found a duplicate
          seenData.duplicates.push({ entity, index: i, similarity });
          foundMatch = true;
          break;
        }
      }
      if (!foundMatch) {
        seen.set(matchKey, {
          entity,
          index: i,
          duplicates: []
        });
      }
    } else {
      // Exact or normalized matching
      if (seen.has(matchKey)) {
        seen.get(matchKey).duplicates.push({ entity, index: i });
      } else {
        seen.set(matchKey, {
          entity,
          index: i,
          duplicates: []
        });
      }
    }
  }

  // Process results based on keep strategy
  for (const [key, data] of seen) {
    const group = {
      key,
      entities: [{ entity: data.entity, index: data.index }, ...data.duplicates]
    };
    groups.push(group);

    if (data.duplicates.length === 0) {
      result.deduplicated.push(data.entity);
    } else {
      // Has duplicates - apply keep strategy
      let kept;
      switch (keepStrategy) {
        case 'last':
          kept = data.duplicates[data.duplicates.length - 1].entity;
          result.duplicates.push(data.entity, ...data.duplicates.slice(0, -1).map(d => d.entity));
          break;
        case 'merge':
          kept = mergeEntities([data.entity, ...data.duplicates.map(d => d.entity)]);
          result.duplicates.push(...data.duplicates.map(d => d.entity));
          break;
        case 'first':
        default:
          kept = data.entity;
          result.duplicates.push(...data.duplicates.map(d => d.entity));
          break;
      }
      result.deduplicated.push(kept);
    }
  }

  result.stats.deduplicatedCount = result.deduplicated.length;
  result.stats.duplicatesRemoved = result.stats.originalCount - result.stats.deduplicatedCount;
  result.stats.groups = groups.filter(g => g.entities.length > 1).map(g => ({
    key: g.key,
    count: g.entities.length,
    indices: g.entities.map(e => e.index)
  }));

  result.success = true;
  return result;
}

/**
 * Build a match key from entity fields
 * @private
 */
function buildMatchKey(entity, matchFields, strategy) {
  const parts = [];

  for (const field of matchFields) {
    let value = getNestedValue(entity, field);

    if (value === undefined || value === null) {
      return null; // Missing field
    }

    value = String(value);

    if (strategy === 'normalized' || strategy === 'fuzzy') {
      // Normalize: lowercase, remove extra whitespace, remove punctuation
      value = value
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '');
    }

    parts.push(value);
  }

  return parts.join('|');
}

/**
 * Get nested value from object using dot notation
 * @private
 */
function getNestedValue(obj, path) {
  const parts = path.split('.');
  let value = obj;

  for (const part of parts) {
    if (value === null || value === undefined) {
      return undefined;
    }
    value = value[part];
  }

  return value;
}

/**
 * Calculate string similarity (Jaro-Winkler)
 * @private
 */
function calculateSimilarity(s1, s2) {
  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;

  const len1 = s1.length;
  const len2 = s2.length;

  // Calculate Jaro similarity
  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  // Jaro-Winkler boost for common prefix
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Merge multiple entities into one
 * @private
 */
function mergeEntities(entities) {
  if (entities.length === 0) return {};
  if (entities.length === 1) return entities[0];

  const merged = {};

  // Process all entities, later values overwrite if non-empty
  for (const entity of entities) {
    for (const [key, value] of Object.entries(entity)) {
      if (value !== null && value !== undefined && value !== '') {
        if (typeof value === 'object' && !Array.isArray(value)) {
          // Recursively merge objects
          merged[key] = { ...(merged[key] || {}), ...value };
        } else if (Array.isArray(value)) {
          // Concatenate arrays and deduplicate
          merged[key] = [...new Set([...(merged[key] || []), ...value])];
        } else {
          // Simple value - take the non-empty one
          if (!merged[key]) {
            merged[key] = value;
          }
        }
      }
    }
  }

  return merged;
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.normalizeDate = normalizeDate;
  globalThis.normalizeName = normalizeName;
  globalThis.normalizeAddress = normalizeAddress;
  globalThis.normalizePhone = normalizePhone;
  globalThis.normalizeEmail = normalizeEmail;
  globalThis.deduplicateEntities = deduplicateEntities;

  // Export constants for external use
  globalThis.DataNormalizerConstants = {
    MonthNames,
    NamePrefixes,
    NameSuffixes,
    USStates,
    StreetTypes,
    CountryCodes,
    EmailDomainCorrections
  };
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizeDate,
    normalizeName,
    normalizeAddress,
    normalizePhone,
    normalizeEmail,
    deduplicateEntities,
    DataNormalizerConstants: {
      MonthNames,
      NamePrefixes,
      NameSuffixes,
      USStates,
      StreetTypes,
      CountryCodes,
      EmailDomainCorrections
    }
  };
}
