/**
 * Basset Hound Browser Automation - Phone Number Verifier
 * Comprehensive phone number validation and carrier lookup module
 *
 * Features:
 * - Client-side E.164 validation and formatting
 * - Country-specific validation patterns
 * - Number type detection (mobile/landline/VoIP)
 * - Optional carrier lookup via Numverify API
 * - Confidence scoring for format validity
 * - Caching for API results
 */

// =============================================================================
// Country Configuration Database
// =============================================================================

/**
 * Comprehensive country phone number configurations
 * Based on ITU-T E.164 recommendations and national numbering plans
 */
const COUNTRY_CONFIGS = {
  // North America - NANP (North American Numbering Plan)
  US: {
    countryCode: '1',
    name: 'United States',
    nationalLength: [10],
    trunkPrefix: '1',
    patterns: {
      mobile: /^[2-9]\d{2}[2-9]\d{6}$/,
      landline: /^[2-9]\d{2}[2-9]\d{6}$/,
      tollFree: /^8(00|33|44|55|66|77|88)\d{7}$/,
      premium: /^900\d{7}$/
    },
    formatTemplates: {
      national: '($1) $2-$3',
      international: '+1 $1-$2-$3'
    },
    parsePattern: /^(\d{3})(\d{3})(\d{4})$/,
    areaCodeRanges: {
      // Sample of valid area codes - not exhaustive
      valid: ['201', '202', '203', '205', '206', '207', '208', '209', '210',
              '212', '213', '214', '215', '216', '217', '218', '219', '220',
              '223', '224', '225', '228', '229', '231', '234', '239', '240',
              '248', '251', '252', '253', '254', '256', '260', '262', '267',
              '269', '270', '272', '276', '281', '301', '302', '303', '304',
              '305', '307', '308', '309', '310', '312', '313', '314', '315',
              '316', '317', '318', '319', '320', '321', '323', '325', '330',
              '331', '332', '334', '336', '337', '339', '340', '346', '347',
              '351', '352', '360', '361', '364', '380', '385', '386', '401',
              '402', '404', '405', '406', '407', '408', '409', '410', '412',
              '413', '414', '415', '417', '419', '423', '424', '425', '430',
              '432', '434', '435', '440', '442', '443', '445', '458', '463',
              '469', '470', '475', '478', '479', '480', '484', '501', '502',
              '503', '504', '505', '507', '508', '509', '510', '512', '513',
              '515', '516', '517', '518', '520', '530', '531', '534', '539',
              '540', '541', '551', '559', '561', '562', '563', '564', '567',
              '570', '571', '573', '574', '575', '580', '585', '586', '601',
              '602', '603', '605', '606', '607', '608', '609', '610', '612',
              '614', '615', '616', '617', '618', '619', '620', '623', '626',
              '628', '629', '630', '631', '636', '641', '646', '650', '651',
              '657', '660', '661', '662', '667', '669', '678', '680', '681',
              '682', '701', '702', '703', '704', '706', '707', '708', '712',
              '713', '714', '715', '716', '717', '718', '719', '720', '724',
              '725', '726', '727', '731', '732', '734', '737', '740', '743',
              '747', '754', '757', '760', '762', '763', '765', '769', '770',
              '772', '773', '774', '775', '779', '781', '785', '786', '801',
              '802', '803', '804', '805', '806', '808', '810', '812', '813',
              '814', '815', '816', '817', '818', '828', '830', '831', '832',
              '843', '845', '847', '848', '850', '854', '856', '857', '858',
              '859', '860', '862', '863', '864', '865', '870', '872', '878',
              '901', '903', '904', '906', '907', '908', '909', '910', '912',
              '913', '914', '915', '916', '917', '918', '919', '920', '925',
              '928', '929', '930', '931', '934', '936', '937', '938', '940',
              '941', '947', '949', '951', '952', '954', '956', '959', '970',
              '971', '972', '973', '978', '979', '980', '984', '985', '989']
    }
  },

  CA: {
    countryCode: '1',
    name: 'Canada',
    nationalLength: [10],
    trunkPrefix: '1',
    patterns: {
      mobile: /^[2-9]\d{2}[2-9]\d{6}$/,
      landline: /^[2-9]\d{2}[2-9]\d{6}$/
    },
    formatTemplates: {
      national: '($1) $2-$3',
      international: '+1 $1-$2-$3'
    },
    parsePattern: /^(\d{3})(\d{3})(\d{4})$/,
    areaCodeRanges: {
      valid: ['204', '226', '236', '249', '250', '289', '306', '343', '365',
              '367', '403', '416', '418', '431', '437', '438', '450', '506',
              '514', '519', '548', '579', '581', '587', '604', '613', '639',
              '647', '672', '705', '709', '778', '780', '782', '807', '819',
              '825', '867', '873', '902', '905']
    }
  },

  // United Kingdom
  UK: {
    countryCode: '44',
    name: 'United Kingdom',
    nationalLength: [10, 11],
    trunkPrefix: '0',
    patterns: {
      mobile: /^7[0-9]{9}$/,
      landline: /^[1-3][0-9]{8,9}$/,
      freephone: /^80[0-9]{7,8}$/,
      premium: /^9[0-9]{8,9}$/
    },
    formatTemplates: {
      national: '0$1 $2 $3',
      international: '+44 $1 $2 $3'
    },
    parsePattern: /^(\d{2,4})(\d{3})(\d{3,4})$/
  },

  GB: {
    // Alias for UK
    countryCode: '44',
    name: 'United Kingdom',
    nationalLength: [10, 11],
    trunkPrefix: '0',
    patterns: {
      mobile: /^7[0-9]{9}$/,
      landline: /^[1-3][0-9]{8,9}$/
    },
    formatTemplates: {
      national: '0$1 $2 $3',
      international: '+44 $1 $2 $3'
    },
    parsePattern: /^(\d{2,4})(\d{3})(\d{3,4})$/
  },

  // Germany
  DE: {
    countryCode: '49',
    name: 'Germany',
    nationalLength: [10, 11, 12],
    trunkPrefix: '0',
    patterns: {
      mobile: /^1[5-7][0-9]{8,10}$/,
      landline: /^[2-9][0-9]{7,11}$/
    },
    formatTemplates: {
      national: '0$1 $2',
      international: '+49 $1 $2'
    },
    parsePattern: /^(\d{3,5})(\d{5,9})$/
  },

  // France
  FR: {
    countryCode: '33',
    name: 'France',
    nationalLength: [9],
    trunkPrefix: '0',
    patterns: {
      mobile: /^[67][0-9]{8}$/,
      landline: /^[1-5][0-9]{8}$/,
      freephone: /^80[0-9]{7}$/
    },
    formatTemplates: {
      national: '0$1 $2 $3 $4 $5',
      international: '+33 $1 $2 $3 $4 $5'
    },
    parsePattern: /^(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/
  },

  // Australia
  AU: {
    countryCode: '61',
    name: 'Australia',
    nationalLength: [9],
    trunkPrefix: '0',
    patterns: {
      mobile: /^4[0-9]{8}$/,
      landline: /^[2378][0-9]{8}$/,
      freephone: /^180[0-9]{6}$/
    },
    formatTemplates: {
      national: '0$1 $2 $3',
      international: '+61 $1 $2 $3'
    },
    parsePattern: /^(\d)(\d{4})(\d{4})$/
  },

  // India
  IN: {
    countryCode: '91',
    name: 'India',
    nationalLength: [10],
    trunkPrefix: '0',
    patterns: {
      mobile: /^[6-9][0-9]{9}$/,
      landline: /^[1-5][0-9]{9}$/
    },
    formatTemplates: {
      national: '$1 $2',
      international: '+91 $1 $2'
    },
    parsePattern: /^(\d{5})(\d{5})$/
  },

  // China
  CN: {
    countryCode: '86',
    name: 'China',
    nationalLength: [11],
    trunkPrefix: '0',
    patterns: {
      mobile: /^1[3-9][0-9]{9}$/,
      landline: /^[2-9][0-9]{9,10}$/
    },
    formatTemplates: {
      national: '$1 $2 $3',
      international: '+86 $1 $2 $3'
    },
    parsePattern: /^(\d{3})(\d{4})(\d{4})$/
  },

  // Japan
  JP: {
    countryCode: '81',
    name: 'Japan',
    nationalLength: [10, 11],
    trunkPrefix: '0',
    patterns: {
      mobile: /^[789]0[0-9]{8}$/,
      landline: /^[1-9][0-9]{8,9}$/
    },
    formatTemplates: {
      national: '0$1-$2-$3',
      international: '+81 $1-$2-$3'
    },
    parsePattern: /^(\d{2,4})(\d{2,4})(\d{4})$/
  },

  // Brazil
  BR: {
    countryCode: '55',
    name: 'Brazil',
    nationalLength: [10, 11],
    trunkPrefix: '0',
    patterns: {
      mobile: /^[1-9][1-9]9[0-9]{8}$/,
      landline: /^[1-9][1-9][2-5][0-9]{7}$/
    },
    formatTemplates: {
      national: '($1) $2-$3',
      international: '+55 $1 $2-$3'
    },
    parsePattern: /^(\d{2})(\d{4,5})(\d{4})$/
  },

  // Mexico
  MX: {
    countryCode: '52',
    name: 'Mexico',
    nationalLength: [10],
    trunkPrefix: '01',
    patterns: {
      mobile: /^[1-9][0-9]{9}$/,
      landline: /^[1-9][0-9]{9}$/
    },
    formatTemplates: {
      national: '($1) $2-$3',
      international: '+52 $1 $2 $3'
    },
    parsePattern: /^(\d{2,3})(\d{3})(\d{4})$/
  },

  // Spain
  ES: {
    countryCode: '34',
    name: 'Spain',
    nationalLength: [9],
    trunkPrefix: null,
    patterns: {
      mobile: /^[67][0-9]{8}$/,
      landline: /^[89][0-9]{8}$/
    },
    formatTemplates: {
      national: '$1 $2 $3',
      international: '+34 $1 $2 $3'
    },
    parsePattern: /^(\d{3})(\d{3})(\d{3})$/
  },

  // Italy
  IT: {
    countryCode: '39',
    name: 'Italy',
    nationalLength: [9, 10, 11],
    trunkPrefix: '0',
    patterns: {
      mobile: /^3[0-9]{8,9}$/,
      landline: /^0[0-9]{8,10}$/
    },
    formatTemplates: {
      national: '$1 $2 $3',
      international: '+39 $1 $2 $3'
    },
    parsePattern: /^(\d{2,4})(\d{3,4})(\d{3,4})$/
  },

  // Netherlands
  NL: {
    countryCode: '31',
    name: 'Netherlands',
    nationalLength: [9],
    trunkPrefix: '0',
    patterns: {
      mobile: /^6[0-9]{8}$/,
      landline: /^[1-5][0-9]{8}$/
    },
    formatTemplates: {
      national: '0$1 $2 $3',
      international: '+31 $1 $2 $3'
    },
    parsePattern: /^(\d{2})(\d{3})(\d{4})$/
  },

  // Russia
  RU: {
    countryCode: '7',
    name: 'Russia',
    nationalLength: [10],
    trunkPrefix: '8',
    patterns: {
      mobile: /^9[0-9]{9}$/,
      landline: /^[3-8][0-9]{9}$/
    },
    formatTemplates: {
      national: '8 ($1) $2-$3-$4',
      international: '+7 $1 $2-$3-$4'
    },
    parsePattern: /^(\d{3})(\d{3})(\d{2})(\d{2})$/
  },

  // South Korea
  KR: {
    countryCode: '82',
    name: 'South Korea',
    nationalLength: [9, 10],
    trunkPrefix: '0',
    patterns: {
      mobile: /^1[0-9]{9}$/,
      landline: /^[2-6][0-9]{7,8}$/
    },
    formatTemplates: {
      national: '0$1-$2-$3',
      international: '+82 $1-$2-$3'
    },
    parsePattern: /^(\d{2,3})(\d{3,4})(\d{4})$/
  },

  // Singapore
  SG: {
    countryCode: '65',
    name: 'Singapore',
    nationalLength: [8],
    trunkPrefix: null,
    patterns: {
      mobile: /^[89][0-9]{7}$/,
      landline: /^6[0-9]{7}$/
    },
    formatTemplates: {
      national: '$1 $2',
      international: '+65 $1 $2'
    },
    parsePattern: /^(\d{4})(\d{4})$/
  },

  // South Africa
  ZA: {
    countryCode: '27',
    name: 'South Africa',
    nationalLength: [9],
    trunkPrefix: '0',
    patterns: {
      mobile: /^[67-8][0-9]{8}$/,
      landline: /^[1-5][0-9]{8}$/
    },
    formatTemplates: {
      national: '0$1 $2 $3',
      international: '+27 $1 $2 $3'
    },
    parsePattern: /^(\d{2})(\d{3})(\d{4})$/
  }
};

/**
 * Country code to ISO mapping for reverse lookup
 */
const COUNTRY_CODE_MAP = new Map();
for (const [iso, config] of Object.entries(COUNTRY_CONFIGS)) {
  if (!COUNTRY_CODE_MAP.has(config.countryCode)) {
    COUNTRY_CODE_MAP.set(config.countryCode, []);
  }
  COUNTRY_CODE_MAP.get(config.countryCode).push(iso);
}

// =============================================================================
// PhoneVerifier Class
// =============================================================================

/**
 * Phone Number Verifier
 * Provides comprehensive phone validation, formatting, and optional carrier lookup
 */
class PhoneVerifier {
  /**
   * Create a new PhoneVerifier instance
   * @param {Object} options - Configuration options
   * @param {string} options.defaultCountry - Default country code (ISO 3166-1 alpha-2), default: 'US'
   * @param {Object} options.logger - Logger instance for debug output
   * @param {boolean} options.strictMode - Enable strict validation mode, default: false
   * @param {number} options.cacheTTL - Cache TTL in milliseconds for API results, default: 3600000 (1 hour)
   * @param {number} options.maxCacheSize - Maximum cache entries, default: 1000
   */
  constructor(options = {}) {
    this.defaultCountry = options.defaultCountry || 'US';
    this.logger = options.logger || null;
    this.strictMode = options.strictMode || false;
    this.cacheTTL = options.cacheTTL || 3600000;
    this.maxCacheSize = options.maxCacheSize || 1000;

    // Initialize carrier lookup cache
    this.carrierCache = new Map();

    // Statistics tracking
    this.stats = {
      totalValidations: 0,
      validNumbers: 0,
      invalidNumbers: 0,
      carrierLookups: 0,
      cacheHits: 0,
      byCountry: {}
    };

    this._log('debug', 'PhoneVerifier initialized', { defaultCountry: this.defaultCountry });
  }

  // ===========================================================================
  // Public API - Validation
  // ===========================================================================

  /**
   * Validate a phone number
   * @param {string} phone - Phone number to validate
   * @param {Object} options - Validation options
   * @param {string} options.defaultCountry - Override default country for this validation
   * @returns {Object} Validation result with plausible, valid, and checks properties
   */
  validate(phone, options = {}) {
    const defaultCountry = options.defaultCountry || this.defaultCountry;

    this.stats.totalValidations++;

    const result = {
      plausible: false,
      valid: false,
      input: phone,
      checks: {
        hasDigits: false,
        validLength: false,
        validFormat: false,
        validCountryCode: false,
        validAreaCode: null,
        validNumberType: null
      },
      parsed: null,
      formatted: null,
      country: null,
      countryCode: null,
      type: null,
      confidence: 0,
      errors: [],
      warnings: []
    };

    // Input validation
    if (!phone || typeof phone !== 'string') {
      result.errors.push({ code: 'INVALID_INPUT', message: 'Phone must be a non-empty string' });
      this.stats.invalidNumbers++;
      return result;
    }

    // Parse the phone number
    const parsed = this.parsePhoneNumber(phone, defaultCountry);

    if (!parsed.success) {
      result.errors = parsed.errors;
      this.stats.invalidNumbers++;
      return result;
    }

    result.parsed = parsed;
    result.checks.hasDigits = true;
    result.country = parsed.country;
    result.countryCode = parsed.countryCode;

    // Get country configuration
    const countryConfig = COUNTRY_CONFIGS[parsed.country];
    if (!countryConfig) {
      result.warnings.push({
        code: 'UNKNOWN_COUNTRY',
        message: `No specific validation rules for country: ${parsed.country}`
      });
      // Still proceed with basic validation
      result.checks.validLength = parsed.nationalNumber.length >= 7 && parsed.nationalNumber.length <= 15;
      result.plausible = result.checks.validLength;
      result.confidence = result.plausible ? 0.5 : 0;
      return result;
    }

    result.checks.validCountryCode = true;

    // Length validation
    const expectedLengths = countryConfig.nationalLength;
    result.checks.validLength = expectedLengths.includes(parsed.nationalNumber.length);

    if (!result.checks.validLength) {
      result.errors.push({
        code: 'INVALID_LENGTH',
        message: `Expected length ${expectedLengths.join(' or ')}, got ${parsed.nationalNumber.length}`
      });
    }

    // Area code validation (US/CA specific)
    if ((parsed.country === 'US' || parsed.country === 'CA') && countryConfig.areaCodeRanges) {
      const areaCode = parsed.nationalNumber.slice(0, 3);
      result.checks.validAreaCode = countryConfig.areaCodeRanges.valid.includes(areaCode);

      if (!result.checks.validAreaCode) {
        result.warnings.push({
          code: 'UNKNOWN_AREA_CODE',
          message: `Area code ${areaCode} is not in the known valid list`
        });
      }
    }

    // Number type detection
    const typeResult = this.detectNumberType(parsed.nationalNumber, parsed.country);
    result.type = typeResult.type;
    result.checks.validNumberType = typeResult.type !== null;

    if (typeResult.type) {
      result.checks.validFormat = true;
    } else {
      result.warnings.push({
        code: 'UNKNOWN_TYPE',
        message: 'Could not determine number type (mobile/landline)'
      });
    }

    // Format the number
    result.formatted = this.formatE164(phone, defaultCountry);

    // Calculate plausibility and validity
    result.plausible = result.checks.hasDigits && result.checks.validLength;
    result.valid = result.plausible && result.checks.validCountryCode;

    // Calculate confidence score
    result.confidence = this._calculateConfidence(result);

    // Update stats
    if (result.valid) {
      this.stats.validNumbers++;
    } else {
      this.stats.invalidNumbers++;
    }

    const country = result.country;
    this.stats.byCountry[country] = this.stats.byCountry[country] || { valid: 0, invalid: 0 };
    this.stats.byCountry[country][result.valid ? 'valid' : 'invalid']++;

    this._log('debug', 'Phone validation completed', {
      input: phone,
      valid: result.valid,
      country: result.country,
      confidence: result.confidence
    });

    return result;
  }

  /**
   * Quick validation check - returns boolean only
   * @param {string} phone - Phone number to validate
   * @param {string} defaultCountry - Default country code
   * @returns {boolean} True if the number appears valid
   */
  isValid(phone, defaultCountry = null) {
    const result = this.validate(phone, { defaultCountry: defaultCountry || this.defaultCountry });
    return result.valid;
  }

  /**
   * Check if a phone number is plausible (could be valid, but not fully verified)
   * @param {string} phone - Phone number to check
   * @param {string} defaultCountry - Default country code
   * @returns {boolean} True if the number is plausible
   */
  isPlausible(phone, defaultCountry = null) {
    const result = this.validate(phone, { defaultCountry: defaultCountry || this.defaultCountry });
    return result.plausible;
  }

  // ===========================================================================
  // Public API - Parsing and Formatting
  // ===========================================================================

  /**
   * Parse a phone number into its components
   * @param {string} phone - Phone number to parse
   * @param {string} defaultCountry - Default country code (ISO 3166-1 alpha-2)
   * @returns {Object} Parsed phone number with country, countryCode, nationalNumber, etc.
   */
  parsePhoneNumber(phone, defaultCountry = null) {
    const country = defaultCountry || this.defaultCountry;

    const result = {
      success: false,
      input: phone,
      country: null,
      countryCode: null,
      nationalNumber: null,
      extension: null,
      raw: {
        digitsOnly: null,
        hasLeadingPlus: false,
        originalFormat: null
      },
      errors: [],
      warnings: []
    };

    if (!phone || typeof phone !== 'string') {
      result.errors.push({ code: 'INVALID_INPUT', message: 'Phone must be a non-empty string' });
      return result;
    }

    let cleanPhone = phone.trim();

    // Check for leading plus
    result.raw.hasLeadingPlus = cleanPhone.startsWith('+');

    // Extract extension if present
    const extMatch = cleanPhone.match(/(?:ext\.?|extension|x|#)\s*(\d+)\s*$/i);
    if (extMatch) {
      result.extension = extMatch[1];
      cleanPhone = cleanPhone.replace(extMatch[0], '').trim();
    }

    // Extract digits only
    const digits = cleanPhone.replace(/\D/g, '');
    result.raw.digitsOnly = digits;

    if (digits.length === 0) {
      result.errors.push({ code: 'NO_DIGITS', message: 'No digits found in phone number' });
      return result;
    }

    if (digits.length < 7) {
      result.errors.push({ code: 'TOO_SHORT', message: 'Phone number is too short (minimum 7 digits)' });
      return result;
    }

    if (digits.length > 15) {
      result.errors.push({ code: 'TOO_LONG', message: 'Phone number exceeds E.164 maximum of 15 digits' });
      return result;
    }

    // Try to detect country code
    let detectedCountry = null;
    let detectedCode = null;
    let nationalNumber = digits;

    if (result.raw.hasLeadingPlus || digits.length > 10) {
      // Number likely includes country code - try to detect
      const detection = this._detectCountryCode(digits);
      if (detection.found) {
        detectedCountry = detection.country;
        detectedCode = detection.countryCode;
        nationalNumber = detection.nationalNumber;
      }
    }

    // If no country detected and we have a default, use it
    if (!detectedCountry && country) {
      const countryConfig = COUNTRY_CONFIGS[country];
      if (countryConfig) {
        detectedCountry = country;
        detectedCode = countryConfig.countryCode;

        // If the number starts with the country code, strip it
        if (digits.startsWith(countryConfig.countryCode)) {
          nationalNumber = digits.slice(countryConfig.countryCode.length);
        }

        // Strip trunk prefix if present
        if (countryConfig.trunkPrefix && nationalNumber.startsWith(countryConfig.trunkPrefix)) {
          nationalNumber = nationalNumber.slice(countryConfig.trunkPrefix.length);
        }
      }
    }

    // For NANP numbers (US/CA), handle 11-digit format (1 + 10 digits)
    if ((detectedCountry === 'US' || detectedCountry === 'CA') && nationalNumber.length === 11 && nationalNumber.startsWith('1')) {
      nationalNumber = nationalNumber.slice(1);
    }

    result.success = true;
    result.country = detectedCountry || country;
    result.countryCode = detectedCode || (COUNTRY_CONFIGS[country]?.countryCode) || null;
    result.nationalNumber = nationalNumber;

    // Determine original format type
    result.raw.originalFormat = this._detectOriginalFormat(phone);

    return result;
  }

  /**
   * Format a phone number to E.164 format
   * @param {string} phone - Phone number to format
   * @param {string} defaultCountry - Default country code
   * @returns {string|null} E.164 formatted number (e.g., +12025551234) or null if invalid
   */
  formatE164(phone, defaultCountry = null) {
    const parsed = this.parsePhoneNumber(phone, defaultCountry || this.defaultCountry);

    if (!parsed.success || !parsed.countryCode || !parsed.nationalNumber) {
      return null;
    }

    let e164 = `+${parsed.countryCode}${parsed.nationalNumber}`;

    // Add extension if present (using RFC 3966 format)
    if (parsed.extension) {
      e164 += `;ext=${parsed.extension}`;
    }

    return e164;
  }

  /**
   * Format a phone number for display in national format
   * @param {string} phone - Phone number to format
   * @param {string} defaultCountry - Default country code
   * @returns {string|null} National formatted number or null if invalid
   */
  formatNational(phone, defaultCountry = null) {
    const parsed = this.parsePhoneNumber(phone, defaultCountry || this.defaultCountry);

    if (!parsed.success) {
      return null;
    }

    const countryConfig = COUNTRY_CONFIGS[parsed.country];
    if (!countryConfig || !countryConfig.formatTemplates?.national || !countryConfig.parsePattern) {
      // Fallback: return digits with basic formatting
      return parsed.nationalNumber;
    }

    const match = parsed.nationalNumber.match(countryConfig.parsePattern);
    if (!match) {
      return parsed.nationalNumber;
    }

    // Apply format template
    let formatted = countryConfig.formatTemplates.national;
    for (let i = 1; i < match.length; i++) {
      formatted = formatted.replace(`$${i}`, match[i] || '');
    }

    // Add extension if present
    if (parsed.extension) {
      formatted += ` ext. ${parsed.extension}`;
    }

    return formatted;
  }

  /**
   * Format a phone number for display in international format
   * @param {string} phone - Phone number to format
   * @param {string} defaultCountry - Default country code
   * @returns {string|null} International formatted number or null if invalid
   */
  formatInternational(phone, defaultCountry = null) {
    const parsed = this.parsePhoneNumber(phone, defaultCountry || this.defaultCountry);

    if (!parsed.success || !parsed.countryCode) {
      return null;
    }

    const countryConfig = COUNTRY_CONFIGS[parsed.country];
    if (!countryConfig || !countryConfig.formatTemplates?.international || !countryConfig.parsePattern) {
      // Fallback: basic international format
      return `+${parsed.countryCode} ${parsed.nationalNumber}`;
    }

    const match = parsed.nationalNumber.match(countryConfig.parsePattern);
    if (!match) {
      return `+${parsed.countryCode} ${parsed.nationalNumber}`;
    }

    // Apply format template
    let formatted = countryConfig.formatTemplates.international;
    for (let i = 1; i < match.length; i++) {
      formatted = formatted.replace(`$${i}`, match[i] || '');
    }

    // Add extension if present
    if (parsed.extension) {
      formatted += ` ext. ${parsed.extension}`;
    }

    return formatted;
  }

  // ===========================================================================
  // Public API - Number Type Detection
  // ===========================================================================

  /**
   * Detect the type of phone number (mobile, landline, etc.)
   * @param {string} nationalNumber - National number (without country code)
   * @param {string} country - Country code (ISO 3166-1 alpha-2)
   * @returns {Object} Detection result with type and confidence
   */
  detectNumberType(nationalNumber, country) {
    const result = {
      type: null,
      possibleTypes: [],
      confidence: 0
    };

    const countryConfig = COUNTRY_CONFIGS[country];
    if (!countryConfig || !countryConfig.patterns) {
      return result;
    }

    // Test against each pattern type
    for (const [type, pattern] of Object.entries(countryConfig.patterns)) {
      if (pattern.test(nationalNumber)) {
        result.possibleTypes.push(type);
      }
    }

    if (result.possibleTypes.length === 1) {
      result.type = result.possibleTypes[0];
      result.confidence = 0.9;
    } else if (result.possibleTypes.length > 1) {
      // Multiple matches - prefer mobile over landline
      if (result.possibleTypes.includes('mobile')) {
        result.type = 'mobile';
      } else {
        result.type = result.possibleTypes[0];
      }
      result.confidence = 0.7;
    }

    return result;
  }

  /**
   * Check if a number appears to be a mobile number
   * @param {string} phone - Phone number to check
   * @param {string} defaultCountry - Default country code
   * @returns {boolean} True if the number appears to be mobile
   */
  isMobile(phone, defaultCountry = null) {
    const parsed = this.parsePhoneNumber(phone, defaultCountry || this.defaultCountry);
    if (!parsed.success) return false;

    const typeResult = this.detectNumberType(parsed.nationalNumber, parsed.country);
    return typeResult.type === 'mobile';
  }

  /**
   * Check if a number appears to be a landline
   * @param {string} phone - Phone number to check
   * @param {string} defaultCountry - Default country code
   * @returns {boolean} True if the number appears to be a landline
   */
  isLandline(phone, defaultCountry = null) {
    const parsed = this.parsePhoneNumber(phone, defaultCountry || this.defaultCountry);
    if (!parsed.success) return false;

    const typeResult = this.detectNumberType(parsed.nationalNumber, parsed.country);
    return typeResult.type === 'landline';
  }

  // ===========================================================================
  // Public API - Carrier Lookup (API-based)
  // ===========================================================================

  /**
   * Get carrier information for a phone number using Numverify API
   * @param {string} phone - Phone number in E.164 format
   * @param {string} apiKey - Numverify API key
   * @param {Object} options - Lookup options
   * @param {boolean} options.useCache - Use cached results if available (default: true)
   * @param {boolean} options.forceRefresh - Force API call even if cached (default: false)
   * @returns {Promise<Object>} Carrier information
   */
  async getCarrierInfo(phone, apiKey, options = {}) {
    const { useCache = true, forceRefresh = false } = options;

    const result = {
      success: false,
      phone: phone,
      carrier: null,
      lineType: null,
      countryCode: null,
      countryName: null,
      location: null,
      valid: false,
      fromCache: false,
      errors: [],
      raw: null
    };

    if (!apiKey) {
      result.errors.push({ code: 'NO_API_KEY', message: 'Numverify API key is required' });
      return result;
    }

    // Format to E.164 if not already
    let e164Phone = phone;
    if (!phone.startsWith('+')) {
      e164Phone = this.formatE164(phone, this.defaultCountry);
      if (!e164Phone) {
        result.errors.push({ code: 'INVALID_PHONE', message: 'Could not format phone to E.164' });
        return result;
      }
    }

    // Remove the + for the API
    const apiPhone = e164Phone.replace(/^\+/, '').replace(/;ext=.*$/, '');

    // Check cache
    if (useCache && !forceRefresh) {
      const cached = this._getFromCache(apiPhone);
      if (cached) {
        this.stats.cacheHits++;
        this._log('debug', 'Carrier info retrieved from cache', { phone: apiPhone });
        return { ...cached, fromCache: true };
      }
    }

    this.stats.carrierLookups++;

    try {
      // Numverify API endpoint
      const url = `https://apilayer.net/api/validate?access_key=${apiKey}&number=${apiPhone}&format=1`;

      const response = await fetch(url);

      if (!response.ok) {
        result.errors.push({
          code: 'API_ERROR',
          message: `API request failed with status ${response.status}`
        });
        return result;
      }

      const data = await response.json();
      result.raw = data;

      if (data.error) {
        result.errors.push({
          code: data.error.code || 'API_ERROR',
          message: data.error.info || 'Unknown API error'
        });
        return result;
      }

      result.success = true;
      result.valid = data.valid === true;
      result.carrier = data.carrier || null;
      result.lineType = data.line_type || null;
      result.countryCode = data.country_code || null;
      result.countryName = data.country_name || null;
      result.location = data.location || null;

      // Cache the result
      if (useCache) {
        this._addToCache(apiPhone, result);
      }

      this._log('debug', 'Carrier lookup completed', {
        phone: apiPhone,
        carrier: result.carrier,
        lineType: result.lineType
      });

    } catch (error) {
      result.errors.push({
        code: 'FETCH_ERROR',
        message: error.message || 'Network error during carrier lookup'
      });
      this._log('error', 'Carrier lookup failed', { phone: apiPhone, error: error.message });
    }

    return result;
  }

  /**
   * Batch carrier lookup for multiple phone numbers
   * @param {string[]} phones - Array of phone numbers
   * @param {string} apiKey - Numverify API key
   * @param {Object} options - Lookup options
   * @param {number} options.concurrency - Max concurrent requests (default: 3)
   * @param {number} options.delayMs - Delay between requests in ms (default: 100)
   * @returns {Promise<Object[]>} Array of carrier information results
   */
  async batchCarrierLookup(phones, apiKey, options = {}) {
    const { concurrency = 3, delayMs = 100 } = options;

    const results = [];
    const queue = [...phones];

    const processItem = async () => {
      while (queue.length > 0) {
        const phone = queue.shift();
        const result = await this.getCarrierInfo(phone, apiKey, options);
        results.push({ phone, ...result });

        if (delayMs > 0 && queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    };

    // Process with limited concurrency
    const workers = [];
    for (let i = 0; i < Math.min(concurrency, phones.length); i++) {
      workers.push(processItem());
    }

    await Promise.all(workers);

    return results;
  }

  // ===========================================================================
  // Public API - Utilities
  // ===========================================================================

  /**
   * Get the country for a phone number
   * @param {string} phone - Phone number
   * @param {string} defaultCountry - Default country code
   * @returns {string|null} Country code (ISO 3166-1 alpha-2) or null
   */
  getCountry(phone, defaultCountry = null) {
    const parsed = this.parsePhoneNumber(phone, defaultCountry || this.defaultCountry);
    return parsed.success ? parsed.country : null;
  }

  /**
   * Get list of supported countries
   * @returns {Object[]} Array of supported country objects
   */
  getSupportedCountries() {
    return Object.entries(COUNTRY_CONFIGS).map(([code, config]) => ({
      code,
      name: config.name,
      countryCode: config.countryCode,
      nationalLength: config.nationalLength
    }));
  }

  /**
   * Get example phone number for a country
   * @param {string} country - Country code (ISO 3166-1 alpha-2)
   * @returns {Object|null} Example numbers for the country
   */
  getExampleNumber(country) {
    const examples = {
      US: { mobile: '+1 (555) 123-4567', landline: '+1 (555) 123-4567' },
      CA: { mobile: '+1 (416) 555-1234', landline: '+1 (416) 555-1234' },
      UK: { mobile: '+44 7911 123456', landline: '+44 20 7946 0958' },
      GB: { mobile: '+44 7911 123456', landline: '+44 20 7946 0958' },
      DE: { mobile: '+49 151 12345678', landline: '+49 30 12345678' },
      FR: { mobile: '+33 6 12 34 56 78', landline: '+33 1 23 45 67 89' },
      AU: { mobile: '+61 4 1234 5678', landline: '+61 2 1234 5678' },
      IN: { mobile: '+91 98765 43210', landline: '+91 11 2345 6789' },
      CN: { mobile: '+86 139 1234 5678', landline: '+86 10 1234 5678' },
      JP: { mobile: '+81 90-1234-5678', landline: '+81 3-1234-5678' }
    };

    return examples[country] || null;
  }

  /**
   * Get verification statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset verification statistics
   */
  resetStats() {
    this.stats = {
      totalValidations: 0,
      validNumbers: 0,
      invalidNumbers: 0,
      carrierLookups: 0,
      cacheHits: 0,
      byCountry: {}
    };
  }

  /**
   * Clear the carrier lookup cache
   */
  clearCache() {
    this.carrierCache.clear();
    this._log('debug', 'Carrier cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.carrierCache.size,
      maxSize: this.maxCacheSize,
      ttl: this.cacheTTL
    };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Detect country code from digits
   * @private
   */
  _detectCountryCode(digits) {
    const result = {
      found: false,
      country: null,
      countryCode: null,
      nationalNumber: digits
    };

    // Try matching country codes (longest to shortest)
    // Country codes are 1-3 digits
    for (let len = 3; len >= 1; len--) {
      const potentialCode = digits.slice(0, len);
      const countries = COUNTRY_CODE_MAP.get(potentialCode);

      if (countries && countries.length > 0) {
        result.found = true;
        result.country = countries[0]; // Use first match
        result.countryCode = potentialCode;
        result.nationalNumber = digits.slice(len);

        // For NANP (country code 1), we need to verify the area code
        // to distinguish between US and CA
        if (potentialCode === '1' && result.nationalNumber.length >= 3) {
          const areaCode = result.nationalNumber.slice(0, 3);
          const usConfig = COUNTRY_CONFIGS.US;
          const caConfig = COUNTRY_CONFIGS.CA;

          if (caConfig.areaCodeRanges?.valid.includes(areaCode)) {
            result.country = 'CA';
          } else if (usConfig.areaCodeRanges?.valid.includes(areaCode)) {
            result.country = 'US';
          }
        }

        break;
      }
    }

    return result;
  }

  /**
   * Detect original format of phone number
   * @private
   */
  _detectOriginalFormat(phone) {
    if (phone.startsWith('+')) return 'international';
    if (phone.match(/^\(\d{3}\)/)) return 'national_parentheses';
    if (phone.match(/^\d{3}-\d{3}-\d{4}$/)) return 'national_dashes';
    if (phone.match(/^\d{3}\.\d{3}\.\d{4}$/)) return 'national_dots';
    if (phone.match(/^\d{10,}$/)) return 'digits_only';
    return 'unknown';
  }

  /**
   * Calculate confidence score for validation result
   * @private
   */
  _calculateConfidence(result) {
    let score = 0;
    let factors = 0;

    // Base score for having digits
    if (result.checks.hasDigits) {
      score += 0.2;
      factors++;
    }

    // Valid length
    if (result.checks.validLength) {
      score += 0.25;
      factors++;
    }

    // Valid country code
    if (result.checks.validCountryCode) {
      score += 0.2;
      factors++;
    }

    // Valid area code (if checked)
    if (result.checks.validAreaCode === true) {
      score += 0.15;
      factors++;
    } else if (result.checks.validAreaCode === false) {
      score -= 0.1;
    }

    // Valid number type detected
    if (result.checks.validNumberType) {
      score += 0.2;
      factors++;
    }

    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get item from carrier cache
   * @private
   */
  _getFromCache(key) {
    const cached = this.carrierCache.get(key);
    if (!cached) return null;

    // Check TTL
    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.carrierCache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Add item to carrier cache
   * @private
   */
  _addToCache(key, data) {
    // Enforce max cache size
    if (this.carrierCache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.carrierCache.keys().next().value;
      this.carrierCache.delete(firstKey);
    }

    this.carrierCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Internal logging method
   * @private
   */
  _log(level, message, data = {}) {
    if (this.logger && typeof this.logger[level] === 'function') {
      this.logger[level](message, data);
    }
  }
}

// =============================================================================
// Integration Helper for DataVerifier
// =============================================================================

/**
 * Enhanced phone verification function for integration with DataVerifier
 * @param {string} phone - Phone number to verify
 * @param {Object} options - Verification options
 * @returns {Object} Verification result compatible with DataVerifier
 */
function enhancedVerifyPhone(phone, options = {}) {
  const verifier = new PhoneVerifier({
    defaultCountry: options.countryHint || options.defaultCountry || 'US'
  });

  const validation = verifier.validate(phone, options);

  // Transform to DataVerifier result format
  return {
    plausible: validation.plausible,
    valid: validation.valid,
    checks: {
      hasDigits: validation.checks.hasDigits,
      validLength: validation.checks.validLength,
      possibleCountry: validation.country
    },
    normalized: validation.formatted,
    formatted: verifier.formatNational(phone, options.defaultCountry),
    country: validation.country,
    type: validation.type,
    confidence: validation.confidence,
    errors: validation.errors,
    warnings: validation.warnings,
    needsServerVerification: validation.confidence < 0.8
  };
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.PhoneVerifier = PhoneVerifier;
  globalThis.enhancedVerifyPhone = enhancedVerifyPhone;
  globalThis.PHONE_COUNTRY_CONFIGS = COUNTRY_CONFIGS;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PhoneVerifier,
    enhancedVerifyPhone,
    COUNTRY_CONFIGS
  };
}
