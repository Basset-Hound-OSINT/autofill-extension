/**
 * Basset Hound Browser Automation - Entity Form Filler
 * Phase 10.2: Smart Form Filling Module
 *
 * Enables intelligent form filling from basset-hound entities and sock puppet data:
 * - Entity-to-form field mapping with intelligent matching
 * - Form filling from entity data or sock puppet identities
 * - Support for credential fields (username, password)
 * - TOTP integration for 2FA fields
 * - Fill verification and reporting
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * Entity form filler configuration defaults
 */
const EntityFormFillerConfig = {
  // API settings
  apiBaseUrl: 'http://localhost:8000',

  // Typing simulation settings
  simulateTyping: true,
  typingDelay: 10,
  typingVariance: 5,

  // Fill behavior
  skipReadonly: true,
  skipDisabled: true,
  skipHidden: true,
  clearBeforeFill: true,

  // Verification
  verifyAfterFill: true,
  verificationDelay: 100,

  // Event dispatching
  dispatchEvents: true,

  // Timeout for async operations
  operationTimeout: 10000
};

// =============================================================================
// Field Mapping Definitions
// =============================================================================

/**
 * Entity field to form field mapping rules
 * Maps entity property names to common form field patterns
 */
const EntityFieldMappings = {
  // Person entity fields
  firstName: {
    formPatterns: [
      /^(first[_-]?name|fname|given[_-]?name|nombre)$/i,
      /first.*name/i,
      /given.*name/i
    ],
    autocomplete: ['given-name'],
    inputTypes: ['text'],
    priority: 10
  },
  lastName: {
    formPatterns: [
      /^(last[_-]?name|lname|surname|family[_-]?name|apellido)$/i,
      /last.*name/i,
      /family.*name/i,
      /surname/i
    ],
    autocomplete: ['family-name'],
    inputTypes: ['text'],
    priority: 10
  },
  middleName: {
    formPatterns: [
      /^(middle[_-]?name|mname|middle[_-]?initial)$/i,
      /middle.*name/i
    ],
    autocomplete: ['additional-name'],
    inputTypes: ['text'],
    priority: 5
  },
  fullName: {
    formPatterns: [
      /^(full[_-]?name|name|your[_-]?name|nombre[_-]?completo)$/i,
      /^name$/i
    ],
    autocomplete: ['name'],
    inputTypes: ['text'],
    priority: 8
  },
  email: {
    formPatterns: [
      /^(e?-?mail|email[_-]?address|correo)$/i,
      /e-?mail/i
    ],
    autocomplete: ['email'],
    inputTypes: ['email', 'text'],
    priority: 10
  },
  phone: {
    formPatterns: [
      /^(phone|tel(ephone)?|mobile|cell|numero|phone[_-]?number)$/i,
      /phone/i,
      /tel/i,
      /mobile/i
    ],
    autocomplete: ['tel', 'tel-national'],
    inputTypes: ['tel', 'text'],
    priority: 10
  },
  dateOfBirth: {
    formPatterns: [
      /^(birth|dob|date[_-]?of[_-]?birth|birthday|born|fecha[_-]?nacimiento)$/i,
      /birth/i,
      /dob/i
    ],
    autocomplete: ['bday'],
    inputTypes: ['date', 'text'],
    priority: 8
  },

  // Address fields
  address: {
    formPatterns: [
      /^(address|street|direccion|calle|address[_-]?line[_-]?1|line1)$/i,
      /street.*address/i,
      /address.*1/i
    ],
    autocomplete: ['street-address', 'address-line1'],
    inputTypes: ['text'],
    priority: 10
  },
  address2: {
    formPatterns: [
      /^(address[_-]?2|line2|apt|suite|unit|apartment)$/i,
      /address.*2/i,
      /apt/i,
      /suite/i
    ],
    autocomplete: ['address-line2'],
    inputTypes: ['text'],
    priority: 8
  },
  city: {
    formPatterns: [
      /^(city|town|ciudad|localidad)$/i,
      /city/i
    ],
    autocomplete: ['address-level2'],
    inputTypes: ['text'],
    priority: 10
  },
  state: {
    formPatterns: [
      /^(state|province|region|estado)$/i,
      /state/i,
      /province/i
    ],
    autocomplete: ['address-level1'],
    inputTypes: ['text', 'select'],
    priority: 10
  },
  zipCode: {
    formPatterns: [
      /^(zip|postal|post[_-]?code|codigo[_-]?postal|zip[_-]?code)$/i,
      /zip/i,
      /postal/i
    ],
    autocomplete: ['postal-code'],
    inputTypes: ['text'],
    priority: 10
  },
  country: {
    formPatterns: [
      /^(country|nation|pais)$/i,
      /country/i
    ],
    autocomplete: ['country', 'country-name'],
    inputTypes: ['text', 'select'],
    priority: 8
  },

  // Account/Credential fields (for sock puppets)
  username: {
    formPatterns: [
      /^(user(name)?|login|account|uid|user[_-]?id)$/i,
      /user.*name/i,
      /login/i
    ],
    autocomplete: ['username'],
    inputTypes: ['text', 'email'],
    priority: 10
  },
  password: {
    formPatterns: [
      /^(pass(word)?|pwd|secret|credential)$/i,
      /password/i
    ],
    autocomplete: ['current-password', 'new-password'],
    inputTypes: ['password'],
    priority: 10
  },

  // Organization fields
  company: {
    formPatterns: [
      /^(company|organization|business|empresa|org)$/i,
      /company/i,
      /organization/i
    ],
    autocomplete: ['organization'],
    inputTypes: ['text'],
    priority: 8
  },
  website: {
    formPatterns: [
      /^(website|url|web|sitio|homepage)$/i,
      /website/i,
      /url/i
    ],
    autocomplete: ['url'],
    inputTypes: ['url', 'text'],
    priority: 6
  },
  title: {
    formPatterns: [
      /^(title|job[_-]?title|position|role)$/i,
      /title/i,
      /position/i
    ],
    autocomplete: ['organization-title'],
    inputTypes: ['text'],
    priority: 6
  },

  // 2FA fields (for TOTP)
  totp: {
    formPatterns: [
      /^(totp|otp|2fa|mfa|verification[_-]?code|auth[_-]?code|code)$/i,
      /verification.*code/i,
      /auth.*code/i,
      /2fa/i,
      /otp/i
    ],
    autocomplete: ['one-time-code'],
    inputTypes: ['text', 'number', 'tel'],
    priority: 10
  }
};

/**
 * Common field name variations for normalization
 */
const FieldNameNormalizations = {
  // First name variations
  'firstname': 'firstName',
  'first_name': 'firstName',
  'first-name': 'firstName',
  'fname': 'firstName',
  'givenname': 'firstName',
  'given_name': 'firstName',

  // Last name variations
  'lastname': 'lastName',
  'last_name': 'lastName',
  'last-name': 'lastName',
  'lname': 'lastName',
  'surname': 'lastName',
  'familyname': 'lastName',
  'family_name': 'lastName',

  // Email variations
  'emailaddress': 'email',
  'email_address': 'email',
  'e-mail': 'email',
  'mail': 'email',

  // Phone variations
  'telephone': 'phone',
  'phonenumber': 'phone',
  'phone_number': 'phone',
  'mobile': 'phone',
  'cell': 'phone',

  // Address variations
  'streetaddress': 'address',
  'street_address': 'address',
  'address1': 'address',
  'addressline1': 'address',
  'line1': 'address',

  // Address 2 variations
  'addressline2': 'address2',
  'line2': 'address2',
  'apt': 'address2',
  'suite': 'address2',
  'unit': 'address2',

  // Zip code variations
  'postalcode': 'zipCode',
  'postal_code': 'zipCode',
  'postcode': 'zipCode',
  'zip': 'zipCode',

  // Username variations
  'userid': 'username',
  'user_id': 'username',
  'login': 'username',

  // Password variations
  'pwd': 'password',
  'pass': 'password'
};

// =============================================================================
// EntityFormFiller Class
// =============================================================================

/**
 * Entity Form Filler - Intelligent form filling from entity data
 */
class EntityFormFiller {
  /**
   * Create a new EntityFormFiller instance
   * @param {Object} options - Configuration options
   * @param {string} options.apiBaseUrl - Basset-hound API base URL
   * @param {boolean} options.simulateTyping - Simulate human typing
   * @param {number} options.typingDelay - Delay between keystrokes
   * @param {boolean} options.verifyAfterFill - Verify fills after completion
   * @param {Object} options.logger - Logger instance
   */
  constructor(options = {}) {
    this.config = {
      ...EntityFormFillerConfig,
      ...options
    };

    this.logger = options.logger || console;
    this.formDetector = null;
    this.totpManager = null;

    // Statistics
    this.stats = {
      totalFills: 0,
      successfulFills: 0,
      failedFills: 0,
      fieldsFilledTotal: 0,
      fieldsSkippedTotal: 0
    };

    // Initialize dependencies
    this._initDependencies();
  }

  /**
   * Initialize dependencies (FormDetector, TOTPManager)
   * @private
   */
  _initDependencies() {
    // Initialize FormDetector if available
    if (typeof FormDetector !== 'undefined') {
      this.formDetector = new FormDetector({ logger: this.logger });
    }

    // Initialize TOTP Manager if available
    if (typeof getTOTPManager === 'function') {
      this.totpManager = getTOTPManager({ logger: this.logger });
    }
  }

  // ===========================================================================
  // Main Fill Methods
  // ===========================================================================

  /**
   * Fill a form with entity data fetched from basset-hound by ID
   *
   * @param {string} entityId - Entity ID to fetch and fill from
   * @param {string} formSelector - CSS selector for the form (optional, auto-detects if not provided)
   * @param {Object} options - Fill options
   * @returns {Promise<Object>} Fill result
   */
  async fillFormWithEntity(entityId, formSelector = null, options = {}) {
    this._log('info', `Filling form with entity: ${entityId}`);

    const result = {
      success: false,
      entityId,
      formSelector,
      filled: [],
      skipped: [],
      errors: [],
      warnings: []
    };

    try {
      // Fetch entity data
      const entity = await this._fetchEntity(entityId);

      if (!entity) {
        result.errors.push({
          code: 'ENTITY_NOT_FOUND',
          message: `Entity with ID '${entityId}' not found`
        });
        return result;
      }

      // Extract entity data (flatten if needed)
      const entityData = this._extractEntityData(entity);

      // Fill form with extracted data
      const fillResult = await this.fillFormWithData(entityData, formSelector, options);

      return {
        ...fillResult,
        entityId,
        entityType: entity.type
      };

    } catch (error) {
      result.errors.push({
        code: 'FILL_ERROR',
        message: error.message
      });
      this._log('error', 'Error filling form with entity:', error);
      return result;
    }
  }

  /**
   * Fill a form with provided entity data
   *
   * @param {Object} entityData - Entity data object with properties to fill
   * @param {string} formSelector - CSS selector for the form (optional)
   * @param {Object} options - Fill options
   * @param {boolean} options.simulateTyping - Simulate human typing
   * @param {boolean} options.clearBeforeFill - Clear fields before filling
   * @param {boolean} options.verifyAfterFill - Verify fills after completion
   * @param {Array<string>} options.includeFields - Only fill these fields
   * @param {Array<string>} options.excludeFields - Skip these fields
   * @returns {Promise<Object>} Fill result
   */
  async fillFormWithData(entityData, formSelector = null, options = {}) {
    const fillOptions = {
      ...this.config,
      ...options
    };

    const result = {
      success: false,
      formSelector,
      filled: [],
      skipped: [],
      errors: [],
      warnings: [],
      mapping: null,
      verification: null
    };

    try {
      // Get form element
      const form = this._getFormElement(formSelector);
      if (!form) {
        result.errors.push({
          code: 'FORM_NOT_FOUND',
          message: formSelector
            ? `Form not found: ${formSelector}`
            : 'No form found on page'
        });
        return result;
      }

      result.formSelector = this._generateSelector(form);

      // Map entity data to form fields
      const mapping = this.mapEntityToForm(entityData, result.formSelector);
      result.mapping = mapping;

      if (mapping.mappings.length === 0) {
        result.warnings.push({
          code: 'NO_MAPPINGS',
          message: 'No entity fields could be mapped to form fields'
        });
        result.success = true;
        return result;
      }

      // Fill each mapped field
      for (const fieldMapping of mapping.mappings) {
        // Check include/exclude filters
        if (fillOptions.includeFields && !fillOptions.includeFields.includes(fieldMapping.entityField)) {
          result.skipped.push({
            entityField: fieldMapping.entityField,
            reason: 'not_in_include_list'
          });
          continue;
        }

        if (fillOptions.excludeFields && fillOptions.excludeFields.includes(fieldMapping.entityField)) {
          result.skipped.push({
            entityField: fieldMapping.entityField,
            reason: 'in_exclude_list'
          });
          continue;
        }

        // Fill the field
        const fillFieldResult = await this._fillField(
          fieldMapping.formField.selector,
          fieldMapping.value,
          fillOptions
        );

        if (fillFieldResult.success) {
          result.filled.push({
            entityField: fieldMapping.entityField,
            formField: fieldMapping.formField.selector,
            value: this._maskSensitiveValue(fieldMapping.entityField, fieldMapping.value),
            confidence: fieldMapping.confidence
          });
        } else {
          result.skipped.push({
            entityField: fieldMapping.entityField,
            formField: fieldMapping.formField.selector,
            reason: fillFieldResult.reason || 'fill_failed',
            error: fillFieldResult.error
          });
        }
      }

      // Verify fills if requested
      if (fillOptions.verifyAfterFill) {
        await this._sleep(fillOptions.verificationDelay);
        result.verification = await this._verifyFills(result.filled);
      }

      result.success = true;
      this.stats.totalFills++;
      this.stats.successfulFills++;
      this.stats.fieldsFilledTotal += result.filled.length;
      this.stats.fieldsSkippedTotal += result.skipped.length;

      this._log('info', `Form filled: ${result.filled.length} fields, ${result.skipped.length} skipped`);

    } catch (error) {
      result.errors.push({
        code: 'FILL_ERROR',
        message: error.message
      });
      this.stats.failedFills++;
      this._log('error', 'Error filling form:', error);
    }

    return result;
  }

  /**
   * Fill a form with sock puppet identity data
   *
   * @param {string} sockPuppetId - Sock puppet identity ID
   * @param {string} formSelector - CSS selector for the form (optional)
   * @param {Object} options - Fill options
   * @param {boolean} options.includeCredentials - Fill username/password fields
   * @param {boolean} options.generateTOTP - Generate and fill TOTP code if available
   * @returns {Promise<Object>} Fill result
   */
  async fillFormWithSockPuppet(sockPuppetId, formSelector = null, options = {}) {
    const {
      includeCredentials = true,
      generateTOTP = true,
      ...fillOptions
    } = options;

    this._log('info', `Filling form with sock puppet: ${sockPuppetId}`);

    const result = {
      success: false,
      sockPuppetId,
      formSelector,
      filled: [],
      skipped: [],
      errors: [],
      warnings: [],
      totpGenerated: false
    };

    try {
      // Fetch sock puppet data
      const sockPuppet = await this._fetchSockPuppet(sockPuppetId);

      if (!sockPuppet) {
        result.errors.push({
          code: 'SOCK_PUPPET_NOT_FOUND',
          message: `Sock puppet with ID '${sockPuppetId}' not found`
        });
        return result;
      }

      // Build entity data from sock puppet
      const entityData = this._buildSockPuppetEntityData(sockPuppet, includeCredentials);

      // Generate TOTP if requested and available
      if (generateTOTP && sockPuppet.totp_secret) {
        const totpResult = await this._generateTOTP(sockPuppetId, sockPuppet.totp_secret);
        if (totpResult.success) {
          entityData.totp = totpResult.code;
          result.totpGenerated = true;
        } else {
          result.warnings.push({
            code: 'TOTP_GENERATION_FAILED',
            message: totpResult.error
          });
        }
      }

      // Fill form with sock puppet data
      const fillResult = await this.fillFormWithData(entityData, formSelector, fillOptions);

      return {
        ...fillResult,
        sockPuppetId,
        sockPuppetName: sockPuppet.name || sockPuppet.display_name,
        totpGenerated: result.totpGenerated
      };

    } catch (error) {
      result.errors.push({
        code: 'FILL_ERROR',
        message: error.message
      });
      this._log('error', 'Error filling form with sock puppet:', error);
      return result;
    }
  }

  // ===========================================================================
  // Field Mapping
  // ===========================================================================

  /**
   * Map entity fields to form fields without filling
   * Previews the mapping that would be applied
   *
   * @param {Object} entityData - Entity data to map
   * @param {string} formSelector - CSS selector for the form (optional)
   * @returns {Object} Mapping result with field correspondences
   */
  mapEntityToForm(entityData, formSelector = null) {
    const result = {
      success: false,
      formSelector,
      mappings: [],
      unmappedEntityFields: [],
      unmappedFormFields: [],
      totalEntityFields: 0,
      totalFormFields: 0
    };

    try {
      // Get form element
      const form = this._getFormElement(formSelector);
      if (!form) {
        return {
          ...result,
          error: formSelector ? `Form not found: ${formSelector}` : 'No form found on page'
        };
      }

      result.formSelector = this._generateSelector(form);

      // Detect form fields
      const formFields = this._detectFormFields(form);
      result.totalFormFields = formFields.length;

      // Get entity fields
      const entityFields = this._normalizeEntityData(entityData);
      result.totalEntityFields = Object.keys(entityFields).length;

      // Track which form fields have been mapped
      const mappedFormFields = new Set();
      const mappedEntityFields = new Set();

      // For each entity field, find best matching form field
      for (const [entityField, value] of Object.entries(entityFields)) {
        if (value === null || value === undefined || value === '') continue;

        const matchResult = this._findBestFormFieldMatch(entityField, formFields, mappedFormFields);

        if (matchResult.match) {
          result.mappings.push({
            entityField,
            value,
            formField: matchResult.match,
            confidence: matchResult.confidence,
            matchedBy: matchResult.matchedBy
          });
          mappedFormFields.add(matchResult.match.selector);
          mappedEntityFields.add(entityField);
        }
      }

      // Collect unmapped fields
      for (const [entityField] of Object.entries(entityFields)) {
        if (!mappedEntityFields.has(entityField)) {
          result.unmappedEntityFields.push(entityField);
        }
      }

      for (const formField of formFields) {
        if (!mappedFormFields.has(formField.selector)) {
          result.unmappedFormFields.push({
            selector: formField.selector,
            name: formField.name,
            fieldType: formField.fieldType
          });
        }
      }

      // Sort mappings by confidence
      result.mappings.sort((a, b) => b.confidence - a.confidence);

      result.success = true;

    } catch (error) {
      result.error = error.message;
      this._log('error', 'Error mapping entity to form:', error);
    }

    return result;
  }

  /**
   * Find the best matching form field for an entity field
   * @private
   */
  _findBestFormFieldMatch(entityField, formFields, alreadyMapped) {
    const normalizedEntityField = this._normalizeFieldName(entityField);
    const mappingRules = EntityFieldMappings[normalizedEntityField];

    let bestMatch = null;
    let bestConfidence = 0;
    let matchedBy = null;

    for (const formField of formFields) {
      // Skip already mapped fields
      if (alreadyMapped.has(formField.selector)) continue;

      // Skip readonly/disabled if configured
      if (this.config.skipReadonly && formField.readOnly) continue;
      if (this.config.skipDisabled && formField.disabled) continue;
      if (this.config.skipHidden && !formField.isVisible) continue;

      let confidence = 0;
      let matchType = null;

      // Check autocomplete attribute (highest priority)
      if (mappingRules?.autocomplete && formField.autocomplete) {
        if (mappingRules.autocomplete.includes(formField.autocomplete)) {
          confidence = 100;
          matchType = 'autocomplete';
        }
      }

      // Check if form field type matches expected types
      if (mappingRules?.inputTypes && !mappingRules.inputTypes.includes(formField.inputType)) {
        confidence = Math.max(0, confidence - 20);
      }

      // Check patterns against field name
      if (confidence < 100 && mappingRules?.formPatterns) {
        const fieldIdentifiers = [
          formField.name,
          formField.id,
          formField.label,
          formField.placeholder
        ].filter(Boolean);

        for (const identifier of fieldIdentifiers) {
          for (const pattern of mappingRules.formPatterns) {
            if (pattern.test(identifier)) {
              const patternConfidence = 90;
              if (patternConfidence > confidence) {
                confidence = patternConfidence;
                matchType = 'pattern';
              }
              break;
            }
          }
        }
      }

      // Check exact name match
      if (confidence < 90) {
        const normalizedFieldName = this._normalizeFieldName(formField.name || '');
        if (normalizedFieldName === normalizedEntityField) {
          confidence = Math.max(confidence, 85);
          matchType = matchType || 'exact_name';
        }
      }

      // Check ID match
      if (confidence < 85) {
        const normalizedFieldId = this._normalizeFieldName(formField.id || '');
        if (normalizedFieldId === normalizedEntityField) {
          confidence = Math.max(confidence, 80);
          matchType = matchType || 'id';
        }
      }

      // Check label match
      if (confidence < 80 && formField.label) {
        const normalizedLabel = this._normalizeFieldName(formField.label);
        if (normalizedLabel === normalizedEntityField) {
          confidence = Math.max(confidence, 75);
          matchType = matchType || 'label';
        }
      }

      // Check placeholder match
      if (confidence < 75 && formField.placeholder) {
        const normalizedPlaceholder = this._normalizeFieldName(formField.placeholder);
        if (normalizedPlaceholder.includes(normalizedEntityField) ||
            normalizedEntityField.includes(normalizedPlaceholder)) {
          confidence = Math.max(confidence, 60);
          matchType = matchType || 'placeholder';
        }
      }

      // Update best match if this is better
      if (confidence > bestConfidence && confidence >= 50) {
        bestConfidence = confidence;
        bestMatch = formField;
        matchedBy = matchType;
      }
    }

    return {
      match: bestMatch,
      confidence: bestConfidence,
      matchedBy
    };
  }

  // ===========================================================================
  // Fill Verification
  // ===========================================================================

  /**
   * Verify that values were correctly applied to form fields
   * @private
   */
  async _verifyFills(filledFields) {
    const verification = {
      success: true,
      verified: [],
      failed: [],
      total: filledFields.length
    };

    for (const fill of filledFields) {
      try {
        const element = document.querySelector(fill.formField);
        if (!element) {
          verification.failed.push({
            formField: fill.formField,
            reason: 'element_not_found'
          });
          verification.success = false;
          continue;
        }

        const currentValue = this._getElementValue(element);
        const expectedValue = fill.value;

        // Compare values (handle masked values)
        const isMasked = expectedValue.includes('*');
        const matches = isMasked
          ? currentValue.length > 0
          : currentValue === expectedValue;

        if (matches) {
          verification.verified.push({
            formField: fill.formField,
            entityField: fill.entityField
          });
        } else {
          verification.failed.push({
            formField: fill.formField,
            entityField: fill.entityField,
            reason: 'value_mismatch',
            expected: isMasked ? '[masked]' : expectedValue,
            actual: isMasked ? '[masked]' : currentValue
          });
          verification.success = false;
        }
      } catch (error) {
        verification.failed.push({
          formField: fill.formField,
          reason: 'verification_error',
          error: error.message
        });
        verification.success = false;
      }
    }

    return verification;
  }

  // ===========================================================================
  // Address Splitting
  // ===========================================================================

  /**
   * Split a full address into components
   *
   * @param {string} fullAddress - Full address string
   * @returns {Object} Address components
   */
  splitAddress(fullAddress) {
    if (!fullAddress || typeof fullAddress !== 'string') {
      return {
        address: '',
        address2: '',
        city: '',
        state: '',
        zipCode: '',
        country: ''
      };
    }

    const result = {
      address: '',
      address2: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    };

    // Try to parse address using common patterns
    const parts = fullAddress.split(/[,\n]+/).map(p => p.trim()).filter(Boolean);

    if (parts.length === 0) {
      result.address = fullAddress;
      return result;
    }

    // Simple heuristic parsing
    if (parts.length >= 1) {
      // Check if first part has apt/suite/unit
      const aptMatch = parts[0].match(/(.+?)\s+(apt\.?|suite|unit|#)\s*(\S+)$/i);
      if (aptMatch) {
        result.address = aptMatch[1].trim();
        result.address2 = aptMatch[2] + ' ' + aptMatch[3];
      } else {
        result.address = parts[0];
      }
    }

    if (parts.length >= 2) {
      // Check for city, state zip pattern
      const cityStateZipMatch = parts[parts.length - 1].match(
        /^(.+?)[,\s]+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i
      );
      if (cityStateZipMatch) {
        result.city = cityStateZipMatch[1].trim();
        result.state = cityStateZipMatch[2].toUpperCase();
        result.zipCode = cityStateZipMatch[3];
      } else {
        // Try state zip only
        const stateZipMatch = parts[parts.length - 1].match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
        if (stateZipMatch) {
          result.state = stateZipMatch[1].toUpperCase();
          result.zipCode = stateZipMatch[2];
          if (parts.length >= 3) {
            result.city = parts[parts.length - 2];
          }
        } else {
          // Last part might be city
          result.city = parts[parts.length - 1];
        }
      }
    }

    // Check for country (common patterns)
    const countryPatterns = [
      /^(USA?|United States|US)$/i,
      /^(UK|United Kingdom|Great Britain|GB)$/i,
      /^(Canada|CA)$/i
    ];
    for (let i = parts.length - 1; i >= 0; i--) {
      for (const pattern of countryPatterns) {
        if (pattern.test(parts[i])) {
          result.country = parts[i];
          break;
        }
      }
      if (result.country) break;
    }

    return result;
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Get form element by selector or auto-detect
   * @private
   */
  _getFormElement(selector) {
    if (selector) {
      return document.querySelector(selector);
    }

    // Auto-detect: prefer visible forms with most fields
    const forms = document.querySelectorAll('form');
    let bestForm = null;
    let bestScore = 0;

    for (const form of forms) {
      let score = 0;

      // Check visibility
      const style = window.getComputedStyle(form);
      if (style.display === 'none' || style.visibility === 'hidden') {
        continue;
      }

      // Count input fields
      const inputs = form.querySelectorAll('input, textarea, select');
      score += inputs.length * 2;

      // Bonus for common form types
      const formText = (form.id + form.className + form.action).toLowerCase();
      if (/login|signin|register|signup|checkout|contact|profile/.test(formText)) {
        score += 10;
      }

      if (score > bestScore) {
        bestScore = score;
        bestForm = form;
      }
    }

    return bestForm;
  }

  /**
   * Detect form fields using FormDetector or fallback
   * @private
   */
  _detectFormFields(form) {
    // Use FormDetector if available
    if (this.formDetector) {
      try {
        const analysis = this.formDetector.analyzeForm(form);
        return analysis.fields || [];
      } catch (error) {
        this._log('warn', 'FormDetector failed, using fallback:', error);
      }
    }

    // Fallback: manual field detection
    const fields = [];
    const elements = form.querySelectorAll(
      'input:not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select'
    );

    for (const element of elements) {
      fields.push({
        selector: this._generateSelector(element),
        name: element.name || null,
        id: element.id || null,
        inputType: element.type?.toLowerCase() || element.tagName.toLowerCase(),
        label: this._findLabel(element),
        placeholder: element.placeholder || null,
        autocomplete: element.autocomplete || null,
        required: element.required,
        disabled: element.disabled,
        readOnly: element.readOnly,
        isVisible: this._isVisible(element),
        fieldType: this._classifyField(element)
      });
    }

    return fields;
  }

  /**
   * Fill a single form field
   * @private
   */
  async _fillField(selector, value, options) {
    const result = {
      success: false,
      reason: null,
      error: null
    };

    try {
      const element = document.querySelector(selector);

      if (!element) {
        result.reason = 'element_not_found';
        return result;
      }

      // Check field state
      if (options.skipReadonly && element.readOnly) {
        result.reason = 'readonly';
        return result;
      }
      if (options.skipDisabled && element.disabled) {
        result.reason = 'disabled';
        return result;
      }
      if (options.skipHidden && !this._isVisible(element)) {
        result.reason = 'hidden';
        return result;
      }

      // Get field type
      const tagName = element.tagName.toLowerCase();
      const inputType = element.type?.toLowerCase();

      // Handle different field types
      if (tagName === 'select') {
        await this._fillSelect(element, value, options);
      } else if (inputType === 'checkbox' || inputType === 'radio') {
        await this._fillCheckbox(element, value);
      } else {
        await this._fillTextInput(element, value, options);
      }

      result.success = true;

    } catch (error) {
      result.error = error.message;
      this._log('error', `Error filling field ${selector}:`, error);
    }

    return result;
  }

  /**
   * Fill a text input field
   * @private
   */
  async _fillTextInput(element, value, options) {
    // Focus the element
    element.focus();
    await this._sleep(30);

    // Clear if requested
    if (options.clearBeforeFill) {
      element.value = '';
      if (options.dispatchEvents) {
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    // Simulate typing or direct fill
    if (options.simulateTyping) {
      for (const char of String(value)) {
        element.value += char;
        if (options.dispatchEvents) {
          element.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            inputType: 'insertText',
            data: char
          }));
        }
        await this._sleep(options.typingDelay + Math.random() * options.typingVariance);
      }
    } else {
      element.value = value;
      if (options.dispatchEvents) {
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    // Dispatch change event
    if (options.dispatchEvents) {
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Blur
    element.blur();
  }

  /**
   * Fill a select element
   * @private
   */
  async _fillSelect(element, value, options) {
    // Try to find option by value or text
    let found = false;

    for (const option of element.options) {
      if (option.value === value || option.text.toLowerCase() === value.toLowerCase()) {
        element.value = option.value;
        found = true;
        break;
      }
    }

    // Try partial match if exact match not found
    if (!found) {
      const normalizedValue = value.toLowerCase();
      for (const option of element.options) {
        if (option.text.toLowerCase().includes(normalizedValue) ||
            normalizedValue.includes(option.text.toLowerCase())) {
          element.value = option.value;
          found = true;
          break;
        }
      }
    }

    if (options.dispatchEvents) {
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /**
   * Fill a checkbox or radio input
   * @private
   */
  async _fillCheckbox(element, value) {
    const shouldCheck = value === true || value === 'true' || value === '1' || value === 'on';

    if (element.checked !== shouldCheck) {
      element.checked = shouldCheck;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('click', { bubbles: true }));
    }
  }

  /**
   * Fetch entity from basset-hound API or local store
   * @private
   */
  async _fetchEntity(entityId) {
    // Try local entity manager first
    if (typeof getEntity === 'function') {
      const entity = getEntity(entityId);
      if (entity) return entity;
    }

    // Try API
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/api/v1/entities/${entityId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        return data.entity || data;
      }
    } catch (error) {
      this._log('warn', 'Failed to fetch entity from API:', error);
    }

    return null;
  }

  /**
   * Fetch sock puppet from basset-hound API
   * @private
   */
  async _fetchSockPuppet(sockPuppetId) {
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/api/v1/sock-puppets/${sockPuppetId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        return data.sock_puppet || data;
      }
    } catch (error) {
      this._log('warn', 'Failed to fetch sock puppet from API:', error);
    }

    return null;
  }

  /**
   * Extract flat entity data from entity object
   * @private
   */
  _extractEntityData(entity) {
    // Handle different entity structures
    if (entity.data) {
      return { ...entity.data };
    }
    return { ...entity };
  }

  /**
   * Build entity data object from sock puppet
   * @private
   */
  _buildSockPuppetEntityData(sockPuppet, includeCredentials) {
    const data = {};

    // Map common sock puppet fields
    const fieldMap = {
      // Identity fields
      'name': 'fullName',
      'display_name': 'fullName',
      'first_name': 'firstName',
      'last_name': 'lastName',
      'email': 'email',
      'phone': 'phone',
      'date_of_birth': 'dateOfBirth',

      // Address fields (may be nested)
      'address': 'address',
      'city': 'city',
      'state': 'state',
      'zip_code': 'zipCode',
      'country': 'country',

      // Organization fields
      'company': 'company',
      'organization': 'company',
      'website': 'website',
      'title': 'title',
      'job_title': 'title'
    };

    for (const [puppetField, entityField] of Object.entries(fieldMap)) {
      if (sockPuppet[puppetField]) {
        data[entityField] = sockPuppet[puppetField];
      }
    }

    // Handle nested address
    if (sockPuppet.address_data) {
      Object.assign(data, this._extractEntityData(sockPuppet.address_data));
    }

    // Include credentials if requested
    if (includeCredentials) {
      if (sockPuppet.username) data.username = sockPuppet.username;
      if (sockPuppet.password) data.password = sockPuppet.password;
      if (sockPuppet.credentials) {
        if (sockPuppet.credentials.username) data.username = sockPuppet.credentials.username;
        if (sockPuppet.credentials.password) data.password = sockPuppet.credentials.password;
      }
    }

    return data;
  }

  /**
   * Generate TOTP code for sock puppet
   * @private
   */
  async _generateTOTP(sockPuppetId, totpSecret) {
    try {
      // Use TOTP Manager if available
      if (this.totpManager) {
        // Register secret if not already registered
        if (!this.totpManager.has(sockPuppetId)) {
          const regResult = this.totpManager.register(sockPuppetId, { secret: totpSecret });
          if (!regResult.success) {
            return { success: false, error: regResult.error };
          }
        }

        return await this.totpManager.generate(sockPuppetId);
      }

      // Fallback: use TOTPGenerator directly if available
      if (typeof TOTPGenerator !== 'undefined') {
        const generator = new TOTPGenerator({ secret: totpSecret });
        const result = await generator.generate();
        return { success: true, code: result.code };
      }

      return { success: false, error: 'TOTP not available' };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Normalize entity data (flatten nested, normalize field names)
   * @private
   */
  _normalizeEntityData(data) {
    const normalized = {};

    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) continue;

      // Handle nested objects
      if (typeof value === 'object' && !Array.isArray(value)) {
        const nested = this._normalizeEntityData(value);
        Object.assign(normalized, nested);
      } else {
        const normalizedKey = this._normalizeFieldName(key);
        normalized[normalizedKey] = value;
      }
    }

    return normalized;
  }

  /**
   * Normalize a field name to standard form
   * @private
   */
  _normalizeFieldName(name) {
    if (!name) return '';

    // Convert to lowercase, remove special chars
    let normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Check if there's a known normalization
    if (FieldNameNormalizations[normalized]) {
      return FieldNameNormalizations[normalized];
    }

    return normalized;
  }

  /**
   * Generate CSS selector for element
   * @private
   */
  _generateSelector(element) {
    if (!element) return '';

    if (element.id) {
      return `#${CSS.escape(element.id)}`;
    }

    if (element.name && this._isFormElement(element)) {
      const selector = `[name="${CSS.escape(element.name)}"]`;
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }

    // Build path-based selector
    const path = [];
    let current = element;
    let depth = 0;

    while (current && current !== document.body && depth < 5) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        path.unshift(`#${CSS.escape(current.id)}`);
        break;
      }

      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          child => child.tagName === current.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }

      path.unshift(selector);
      current = parent;
      depth++;
    }

    return path.join(' > ');
  }

  /**
   * Find label for form element
   * @private
   */
  _findLabel(element) {
    // Check for label with 'for' attribute
    if (element.id) {
      const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (label) {
        return label.textContent.trim().replace(/[:\*]/g, '');
      }
    }

    // Check for wrapping label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll('input, textarea, select').forEach(el => el.remove());
      return clone.textContent.trim().replace(/[:\*]/g, '');
    }

    // Check aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    return null;
  }

  /**
   * Classify form field type
   * @private
   */
  _classifyField(element) {
    const name = (element.name || '').toLowerCase();
    const id = (element.id || '').toLowerCase();
    const inputType = element.type?.toLowerCase();
    const combined = `${name} ${id}`;

    // Check input type first
    if (inputType === 'email') return 'email';
    if (inputType === 'password') return 'password';
    if (inputType === 'tel') return 'phone';

    // Pattern matching
    for (const [fieldType, mapping] of Object.entries(EntityFieldMappings)) {
      for (const pattern of mapping.formPatterns) {
        if (pattern.test(combined)) {
          return fieldType;
        }
      }
    }

    return inputType || 'text';
  }

  /**
   * Check if element is form element
   * @private
   */
  _isFormElement(element) {
    return ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(element.tagName);
  }

  /**
   * Check if element is visible
   * @private
   */
  _isVisible(element) {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Get current value of element
   * @private
   */
  _getElementValue(element) {
    const tagName = element.tagName.toLowerCase();
    const inputType = element.type?.toLowerCase();

    if (tagName === 'select') {
      return element.value;
    }
    if (inputType === 'checkbox' || inputType === 'radio') {
      return element.checked;
    }
    return element.value;
  }

  /**
   * Mask sensitive values for logging
   * @private
   */
  _maskSensitiveValue(fieldName, value) {
    const sensitiveFields = ['password', 'pwd', 'secret', 'totp', 'otp', 'cvv', 'ssn'];
    const normalized = fieldName.toLowerCase();

    for (const sensitive of sensitiveFields) {
      if (normalized.includes(sensitive)) {
        return '*'.repeat(value.length);
      }
    }

    return value;
  }

  /**
   * Sleep utility
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Logging utility
   * @private
   */
  _log(level, message, ...args) {
    if (this.logger && typeof this.logger[level] === 'function') {
      this.logger[level]('[EntityFormFiller]', message, ...args);
    }
  }

  /**
   * Get fill statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalFills: 0,
      successfulFills: 0,
      failedFills: 0,
      fieldsFilledTotal: 0,
      fieldsSkippedTotal: 0
    };
  }
}

// =============================================================================
// MCP Command Handlers
// =============================================================================

/**
 * Handle fill_form_with_entity MCP command
 *
 * @param {Object} params - Command parameters
 * @param {string} params.entityId - Entity ID to fill from
 * @param {string} params.formSelector - CSS selector for form (optional)
 * @param {Object} params.options - Fill options
 * @returns {Promise<Object>} Fill result
 */
async function handleFillFormWithEntity(params) {
  const { entityId, formSelector, options = {} } = params;

  if (!entityId) {
    return {
      success: false,
      error: 'entityId is required'
    };
  }

  const filler = getEntityFormFiller(options);
  return await filler.fillFormWithEntity(entityId, formSelector, options);
}

/**
 * Handle fill_form_with_sock_puppet MCP command
 *
 * @param {Object} params - Command parameters
 * @param {string} params.sockPuppetId - Sock puppet ID to fill from
 * @param {string} params.formSelector - CSS selector for form (optional)
 * @param {Object} params.options - Fill options
 * @returns {Promise<Object>} Fill result
 */
async function handleFillFormWithSockPuppet(params) {
  const { sockPuppetId, formSelector, options = {} } = params;

  if (!sockPuppetId) {
    return {
      success: false,
      error: 'sockPuppetId is required'
    };
  }

  const filler = getEntityFormFiller(options);
  return await filler.fillFormWithSockPuppet(sockPuppetId, formSelector, options);
}

/**
 * Handle map_entity_to_form MCP command (preview mapping without filling)
 *
 * @param {Object} params - Command parameters
 * @param {Object} params.entityData - Entity data to map
 * @param {string} params.formSelector - CSS selector for form (optional)
 * @returns {Object} Mapping result
 */
function handleMapEntityToForm(params) {
  const { entityData, formSelector } = params;

  if (!entityData || typeof entityData !== 'object') {
    return {
      success: false,
      error: 'entityData object is required'
    };
  }

  const filler = getEntityFormFiller();
  return filler.mapEntityToForm(entityData, formSelector);
}

/**
 * Handle fill_form_with_data MCP command
 *
 * @param {Object} params - Command parameters
 * @param {Object} params.data - Data to fill
 * @param {string} params.formSelector - CSS selector for form (optional)
 * @param {Object} params.options - Fill options
 * @returns {Promise<Object>} Fill result
 */
async function handleFillFormWithData(params) {
  const { data, formSelector, options = {} } = params;

  if (!data || typeof data !== 'object') {
    return {
      success: false,
      error: 'data object is required'
    };
  }

  const filler = getEntityFormFiller(options);
  return await filler.fillFormWithData(data, formSelector, options);
}

// =============================================================================
// Global Instance
// =============================================================================

/**
 * Global EntityFormFiller instance
 */
let entityFormFiller = null;

/**
 * Get or create global EntityFormFiller instance
 *
 * @param {Object} options - Configuration options
 * @returns {EntityFormFiller} Form filler instance
 */
function getEntityFormFiller(options = {}) {
  if (!entityFormFiller) {
    entityFormFiller = new EntityFormFiller(options);
  }
  return entityFormFiller;
}

/**
 * Reset the global EntityFormFiller instance
 *
 * @returns {Object} Reset result
 */
function resetEntityFormFiller() {
  entityFormFiller = null;
  return { success: true, message: 'EntityFormFiller instance reset' };
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.EntityFormFiller = EntityFormFiller;
  globalThis.EntityFormFillerConfig = EntityFormFillerConfig;
  globalThis.EntityFieldMappings = EntityFieldMappings;
  globalThis.getEntityFormFiller = getEntityFormFiller;
  globalThis.resetEntityFormFiller = resetEntityFormFiller;

  // MCP command handlers
  globalThis.handleFillFormWithEntity = handleFillFormWithEntity;
  globalThis.handleFillFormWithSockPuppet = handleFillFormWithSockPuppet;
  globalThis.handleMapEntityToForm = handleMapEntityToForm;
  globalThis.handleFillFormWithData = handleFillFormWithData;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EntityFormFiller,
    EntityFormFillerConfig,
    EntityFieldMappings,
    FieldNameNormalizations,
    getEntityFormFiller,
    resetEntityFormFiller,
    handleFillFormWithEntity,
    handleFillFormWithSockPuppet,
    handleMapEntityToForm,
    handleFillFormWithData
  };
}
