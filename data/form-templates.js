/**
 * Basset Hound Browser Automation - Form Templates
 *
 * Common form field mappings and templates for auto-fill functionality.
 * Provides:
 * - Standard field mappings for common form types
 * - Template data structures for auto-fill
 * - Field value generators for dynamic data
 * - Mapping utilities for field matching
 */

// =============================================================================
// Template Field Mappings
// =============================================================================

/**
 * Maps form field types to common names/selectors
 * Used to match detected fields to template data
 */
const FieldMappings = {
  // Authentication fields
  username: [
    'username', 'user', 'login', 'userid', 'user_id', 'user_name',
    'account', 'uid', 'uname', 'loginname', 'user-name'
  ],
  email: [
    'email', 'e-mail', 'mail', 'emailaddress', 'email_address',
    'user_email', 'usermail', 'correo'
  ],
  password: [
    'password', 'pass', 'pwd', 'passwd', 'secret', 'user_password',
    'userpass', 'login_password'
  ],
  confirmPassword: [
    'confirm_password', 'confirmpassword', 'password_confirm',
    'password2', 'pass2', 'repassword', 're_password', 'verify_password',
    'password_confirmation', 'repeat_password'
  ],

  // Personal information
  firstName: [
    'firstname', 'first_name', 'fname', 'given_name', 'givenname',
    'first', 'nombre'
  ],
  lastName: [
    'lastname', 'last_name', 'lname', 'surname', 'family_name',
    'familyname', 'last', 'apellido'
  ],
  fullName: [
    'name', 'fullname', 'full_name', 'your_name', 'yourname',
    'displayname', 'display_name', 'nombre_completo'
  ],
  phone: [
    'phone', 'telephone', 'tel', 'mobile', 'cell', 'phone_number',
    'phonenumber', 'cellphone', 'telefono', 'numero'
  ],
  dateOfBirth: [
    'dob', 'birthdate', 'birth_date', 'birthday', 'date_of_birth',
    'dateofbirth', 'bday', 'fecha_nacimiento'
  ],
  gender: [
    'gender', 'sex', 'genero'
  ],
  age: [
    'age', 'edad'
  ],

  // Address fields
  address: [
    'address', 'street', 'street_address', 'streetaddress',
    'address1', 'address_1', 'line1', 'direccion', 'calle'
  ],
  address2: [
    'address2', 'address_2', 'line2', 'apt', 'apartment', 'suite',
    'unit', 'building'
  ],
  city: [
    'city', 'town', 'locality', 'ciudad', 'localidad'
  ],
  state: [
    'state', 'province', 'region', 'estado', 'provincia'
  ],
  zipCode: [
    'zip', 'zipcode', 'zip_code', 'postal', 'postalcode', 'postal_code',
    'postcode', 'codigo_postal'
  ],
  country: [
    'country', 'nation', 'pais'
  ],

  // Payment fields
  cardNumber: [
    'cardnumber', 'card_number', 'ccnumber', 'cc_number', 'creditcard',
    'credit_card', 'card', 'numero_tarjeta'
  ],
  cardName: [
    'cardname', 'card_name', 'nameoncard', 'name_on_card', 'cardholder',
    'card_holder', 'ccname'
  ],
  expiry: [
    'expiry', 'expiration', 'exp', 'exp_date', 'expdate', 'expires',
    'card_expiry', 'vencimiento'
  ],
  expiryMonth: [
    'exp_month', 'expmonth', 'expirymonth', 'expiry_month', 'cc_exp_month',
    'card_month'
  ],
  expiryYear: [
    'exp_year', 'expyear', 'expiryyear', 'expiry_year', 'cc_exp_year',
    'card_year'
  ],
  cvv: [
    'cvv', 'cvc', 'cvv2', 'csc', 'security_code', 'securitycode',
    'card_code', 'verification'
  ],

  // Contact/Business fields
  company: [
    'company', 'organization', 'business', 'org', 'company_name',
    'companyname', 'empresa', 'organizacion'
  ],
  jobTitle: [
    'jobtitle', 'job_title', 'title', 'position', 'role', 'cargo', 'puesto'
  ],
  website: [
    'website', 'url', 'web', 'homepage', 'site', 'sitio_web'
  ],
  subject: [
    'subject', 'topic', 'regarding', 'asunto', 'tema'
  ],
  message: [
    'message', 'comment', 'comments', 'feedback', 'inquiry', 'body',
    'content', 'text', 'description', 'details', 'msg', 'mensaje'
  ],

  // Search
  search: [
    'search', 'query', 'q', 'keyword', 'keywords', 'term', 'terms',
    'buscar', 'busqueda'
  ],

  // Account/Profile
  bio: [
    'bio', 'biography', 'about', 'about_me', 'description', 'profile',
    'summary'
  ],
  socialMedia: [
    'twitter', 'facebook', 'linkedin', 'instagram', 'github', 'social'
  ]
};

// =============================================================================
// Form Type Templates
// =============================================================================

/**
 * Pre-defined templates for common form types
 * Each template defines which fields are expected and their priority
 */
const FormTemplates = {
  login: {
    name: 'Login Form',
    description: 'Standard login/signin form',
    fields: {
      username: { priority: 1, alternatives: ['email'] },
      password: { priority: 1 },
      rememberMe: { priority: 2, optional: true }
    }
  },

  registration: {
    name: 'Registration Form',
    description: 'Account creation/signup form',
    fields: {
      email: { priority: 1 },
      username: { priority: 2, optional: true },
      password: { priority: 1 },
      confirmPassword: { priority: 1, optional: true },
      firstName: { priority: 2 },
      lastName: { priority: 2 },
      phone: { priority: 3, optional: true },
      dateOfBirth: { priority: 3, optional: true },
      terms: { priority: 1 }
    }
  },

  contact: {
    name: 'Contact Form',
    description: 'Contact/inquiry form',
    fields: {
      fullName: { priority: 1, alternatives: ['firstName'] },
      email: { priority: 1 },
      phone: { priority: 2, optional: true },
      company: { priority: 3, optional: true },
      subject: { priority: 2 },
      message: { priority: 1 }
    }
  },

  payment: {
    name: 'Payment Form',
    description: 'Credit card payment form',
    fields: {
      cardNumber: { priority: 1 },
      cardName: { priority: 1 },
      expiry: { priority: 1, alternatives: ['expiryMonth'] },
      expiryMonth: { priority: 1, optional: true },
      expiryYear: { priority: 1, optional: true },
      cvv: { priority: 1 }
    }
  },

  checkout: {
    name: 'Checkout Form',
    description: 'E-commerce checkout form',
    fields: {
      email: { priority: 1 },
      firstName: { priority: 1 },
      lastName: { priority: 1 },
      address: { priority: 1 },
      address2: { priority: 2, optional: true },
      city: { priority: 1 },
      state: { priority: 1 },
      zipCode: { priority: 1 },
      country: { priority: 1 },
      phone: { priority: 2 },
      cardNumber: { priority: 1 },
      cardName: { priority: 1 },
      expiry: { priority: 1 },
      cvv: { priority: 1 }
    }
  },

  address: {
    name: 'Address Form',
    description: 'Shipping/billing address form',
    fields: {
      firstName: { priority: 1 },
      lastName: { priority: 1 },
      address: { priority: 1 },
      address2: { priority: 2, optional: true },
      city: { priority: 1 },
      state: { priority: 1 },
      zipCode: { priority: 1 },
      country: { priority: 1 },
      phone: { priority: 2, optional: true }
    }
  },

  newsletter: {
    name: 'Newsletter Form',
    description: 'Email subscription form',
    fields: {
      email: { priority: 1 },
      firstName: { priority: 2, optional: true },
      lastName: { priority: 2, optional: true }
    }
  },

  profile: {
    name: 'Profile Form',
    description: 'User profile/settings form',
    fields: {
      firstName: { priority: 1 },
      lastName: { priority: 1 },
      email: { priority: 1 },
      phone: { priority: 2, optional: true },
      dateOfBirth: { priority: 3, optional: true },
      gender: { priority: 3, optional: true },
      bio: { priority: 3, optional: true },
      website: { priority: 3, optional: true }
    }
  },

  search: {
    name: 'Search Form',
    description: 'Search/query form',
    fields: {
      search: { priority: 1 }
    }
  },

  passwordReset: {
    name: 'Password Reset Form',
    description: 'Forgot password/reset form',
    fields: {
      email: { priority: 1 }
    }
  }
};

// =============================================================================
// Sample Data Templates
// =============================================================================

/**
 * Sample data for testing/demo purposes
 * Can be customized with actual user data
 */
const SampleData = {
  personal: {
    firstName: 'John',
    lastName: 'Doe',
    fullName: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1-555-123-4567',
    dateOfBirth: '1990-01-15',
    gender: 'male',
    age: '34'
  },

  address: {
    address: '123 Main Street',
    address2: 'Apt 4B',
    city: 'New York',
    state: 'NY',
    zipCode: '10001',
    country: 'United States'
  },

  business: {
    company: 'Acme Corporation',
    jobTitle: 'Software Engineer',
    website: 'https://example.com'
  },

  payment: {
    cardNumber: '4111111111111111',
    cardName: 'John Doe',
    expiry: '12/2028',
    expiryMonth: '12',
    expiryYear: '2028',
    cvv: '123'
  },

  account: {
    username: 'johndoe123',
    password: 'SecureP@ss123!',
    confirmPassword: 'SecureP@ss123!'
  },

  contact: {
    subject: 'General Inquiry',
    message: 'Hello, I would like to learn more about your services.'
  }
};

// =============================================================================
// Field Value Generators
// =============================================================================

/**
 * Generators for dynamic field values
 */
const FieldGenerators = {
  /**
   * Generate a random string
   * @param {number} length - String length
   * @param {string} charset - Character set to use
   * @returns {string} Random string
   */
  randomString(length = 10, charset = 'alphanumeric') {
    const charsets = {
      alpha: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
      numeric: '0123456789',
      alphanumeric: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      special: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    };
    const chars = charsets[charset] || charset;
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  /**
   * Generate a random email
   * @param {string} domain - Email domain
   * @returns {string} Random email
   */
  randomEmail(domain = 'example.com') {
    const username = this.randomString(8, 'alpha').toLowerCase();
    return `${username}@${domain}`;
  },

  /**
   * Generate a random phone number
   * @param {string} format - Phone format
   * @returns {string} Random phone number
   */
  randomPhone(format = 'us') {
    const formats = {
      us: `+1-${this.randomDigits(3)}-${this.randomDigits(3)}-${this.randomDigits(4)}`,
      international: `+${this.randomDigits(2)}-${this.randomDigits(10)}`,
      simple: this.randomDigits(10)
    };
    return formats[format] || formats.simple;
  },

  /**
   * Generate random digits
   * @param {number} count - Number of digits
   * @returns {string} Random digits
   */
  randomDigits(count) {
    let result = '';
    for (let i = 0; i < count; i++) {
      result += Math.floor(Math.random() * 10);
    }
    return result;
  },

  /**
   * Generate a random date
   * @param {number} minYear - Minimum year
   * @param {number} maxYear - Maximum year
   * @returns {string} Random date in YYYY-MM-DD format
   */
  randomDate(minYear = 1950, maxYear = 2005) {
    const year = minYear + Math.floor(Math.random() * (maxYear - minYear));
    const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
    const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Generate a secure password
   * @param {number} length - Password length
   * @returns {string} Secure password
   */
  securePassword(length = 16) {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const special = '!@#$%^&*';

    // Ensure at least one of each type
    let password = '';
    password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
    password += special.charAt(Math.floor(Math.random() * special.length));

    // Fill the rest
    const allChars = lowercase + uppercase + numbers + special;
    for (let i = password.length; i < length; i++) {
      password += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }

    // Shuffle
    return password.split('').sort(() => Math.random() - 0.5).join('');
  },

  /**
   * Generate a test credit card number (Luhn-valid test numbers)
   * @param {string} type - Card type
   * @returns {string} Test card number
   */
  testCardNumber(type = 'visa') {
    const testCards = {
      visa: '4111111111111111',
      mastercard: '5555555555554444',
      amex: '378282246310005',
      discover: '6011111111111117'
    };
    return testCards[type] || testCards.visa;
  },

  /**
   * Generate a future expiry date
   * @returns {Object} Month and year
   */
  futureExpiry() {
    const now = new Date();
    const futureYear = now.getFullYear() + 2 + Math.floor(Math.random() * 3);
    const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
    return {
      month,
      year: String(futureYear),
      formatted: `${month}/${futureYear}`
    };
  }
};

// =============================================================================
// Template Mapper Class
// =============================================================================

/**
 * Maps detected form fields to template data
 */
class TemplateMapper {
  constructor(options = {}) {
    this.fieldMappings = options.fieldMappings || FieldMappings;
    this.fuzzyMatch = options.fuzzyMatch !== false;
    this.caseSensitive = options.caseSensitive || false;
  }

  /**
   * Map detected fields to template values
   * @param {Array} fields - Detected form fields
   * @param {Object} templateData - Template data to use
   * @returns {Object} Field-to-value mappings
   */
  mapFieldsToValues(fields, templateData) {
    const mappings = {};

    for (const field of fields) {
      const value = this.findValueForField(field, templateData);
      if (value !== null && value !== undefined) {
        mappings[field.selector] = value;
      }
    }

    return mappings;
  }

  /**
   * Find the appropriate value for a field
   * @param {Object} field - Field object from FormDetector
   * @param {Object} data - Template data
   * @returns {*} Value for the field
   */
  findValueForField(field, data) {
    // First try by detected fieldType
    if (field.fieldType && data[field.fieldType] !== undefined) {
      return data[field.fieldType];
    }

    // Try to find matching field type from field attributes
    const fieldType = this.identifyFieldType(field);
    if (fieldType && data[fieldType] !== undefined) {
      return data[fieldType];
    }

    // Try nested data (e.g., personal.email)
    for (const [category, categoryData] of Object.entries(data)) {
      if (typeof categoryData === 'object' && categoryData !== null) {
        if (fieldType && categoryData[fieldType] !== undefined) {
          return categoryData[fieldType];
        }

        // Try field name/id in category
        if (field.name && categoryData[field.name] !== undefined) {
          return categoryData[field.name];
        }
        if (field.id && categoryData[field.id] !== undefined) {
          return categoryData[field.id];
        }
      }
    }

    return null;
  }

  /**
   * Identify field type from field attributes
   * @param {Object} field - Field object
   * @returns {string|null} Identified field type
   */
  identifyFieldType(field) {
    const searchTerms = [
      field.name,
      field.id,
      field.label,
      field.placeholder,
      field.autocomplete
    ].filter(Boolean).map(s => this.caseSensitive ? s : s.toLowerCase());

    for (const [fieldType, aliases] of Object.entries(this.fieldMappings)) {
      for (const alias of aliases) {
        const normalizedAlias = this.caseSensitive ? alias : alias.toLowerCase();

        for (const term of searchTerms) {
          // Exact match
          if (term === normalizedAlias) {
            return fieldType;
          }

          // Fuzzy match
          if (this.fuzzyMatch) {
            if (term.includes(normalizedAlias) || normalizedAlias.includes(term)) {
              return fieldType;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Create auto-fill data from multiple data sources
   * @param {string} formType - Detected form type
   * @param {Object} userData - User-provided data
   * @param {Object} defaultData - Default/sample data
   * @returns {Object} Combined data for auto-fill
   */
  createAutoFillData(formType, userData = {}, defaultData = SampleData) {
    const template = FormTemplates[formType];
    if (!template) {
      return { ...this.flattenData(defaultData), ...userData };
    }

    const result = {};
    const flatDefault = this.flattenData(defaultData);

    // Add fields based on template priority
    for (const [fieldName, config] of Object.entries(template.fields)) {
      // Check user data first
      if (userData[fieldName] !== undefined) {
        result[fieldName] = userData[fieldName];
        continue;
      }

      // Check default data
      if (flatDefault[fieldName] !== undefined) {
        result[fieldName] = flatDefault[fieldName];
        continue;
      }

      // Check alternatives
      if (config.alternatives) {
        for (const alt of config.alternatives) {
          if (userData[alt] !== undefined) {
            result[fieldName] = userData[alt];
            break;
          }
          if (flatDefault[alt] !== undefined) {
            result[fieldName] = flatDefault[alt];
            break;
          }
        }
      }
    }

    // Add any additional user data not in template
    for (const [key, value] of Object.entries(userData)) {
      if (result[key] === undefined) {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Flatten nested data object
   * @param {Object} data - Nested data object
   * @returns {Object} Flattened object
   */
  flattenData(data) {
    const result = {};

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(result, value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Get recommended template for form type
   * @param {string} formType - Form type from FormDetector
   * @returns {Object|null} Form template
   */
  getTemplate(formType) {
    // Map FormTypes to template names
    const typeMap = {
      'login': 'login',
      'registration': 'registration',
      'contact': 'contact',
      'payment': 'payment',
      'checkout': 'checkout',
      'address': 'address',
      'shipping': 'address',
      'billing': 'address',
      'newsletter': 'newsletter',
      'profile': 'profile',
      'search': 'search',
      'password_reset': 'passwordReset'
    };

    const templateName = typeMap[formType] || formType;
    return FormTemplates[templateName] || null;
  }

  /**
   * Suggest fields that need user input
   * @param {Array} fields - Form fields
   * @param {Object} availableData - Available data
   * @returns {Array} Fields that need user input
   */
  suggestMissingFields(fields, availableData) {
    const flatData = this.flattenData(availableData);
    const missing = [];

    for (const field of fields) {
      if (field.required && !field.disabled && !field.readOnly) {
        const value = this.findValueForField(field, flatData);
        if (value === null || value === undefined) {
          missing.push({
            selector: field.selector,
            fieldType: field.fieldType,
            label: field.label,
            inputType: field.inputType
          });
        }
      }
    }

    return missing;
  }
}

// =============================================================================
// Export
// =============================================================================

if (typeof globalThis !== 'undefined') {
  globalThis.FieldMappings = FieldMappings;
  globalThis.FormTemplates = FormTemplates;
  globalThis.SampleData = SampleData;
  globalThis.FieldGenerators = FieldGenerators;
  globalThis.TemplateMapper = TemplateMapper;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FieldMappings,
    FormTemplates,
    SampleData,
    FieldGenerators,
    TemplateMapper
  };
}
