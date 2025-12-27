/**
 * Basset Hound Browser Automation - Form Detector
 *
 * Intelligent form detection and analysis utility that provides:
 * - Form type detection (login, registration, search, contact, payment, etc.)
 * - Field extraction with types, labels, and validation rules
 * - CAPTCHA detection and type identification
 * - Multi-step form detection
 * - Form structure analysis
 */

// =============================================================================
// Form Type Definitions
// =============================================================================

const FormTypes = {
  LOGIN: 'login',
  REGISTRATION: 'registration',
  SEARCH: 'search',
  CONTACT: 'contact',
  PAYMENT: 'payment',
  CHECKOUT: 'checkout',
  NEWSLETTER: 'newsletter',
  PASSWORD_RESET: 'password_reset',
  PROFILE: 'profile',
  ADDRESS: 'address',
  SHIPPING: 'shipping',
  BILLING: 'billing',
  SURVEY: 'survey',
  FEEDBACK: 'feedback',
  COMMENT: 'comment',
  UPLOAD: 'upload',
  UNKNOWN: 'unknown'
};

// =============================================================================
// CAPTCHA Type Definitions
// =============================================================================

const CaptchaTypes = {
  RECAPTCHA_V2: 'recaptcha_v2',
  RECAPTCHA_V3: 'recaptcha_v3',
  HCAPTCHA: 'hcaptcha',
  CLOUDFLARE_TURNSTILE: 'cloudflare_turnstile',
  FUNCAPTCHA: 'funcaptcha',
  IMAGE_CAPTCHA: 'image_captcha',
  TEXT_CAPTCHA: 'text_captcha',
  MATH_CAPTCHA: 'math_captcha',
  UNKNOWN: 'unknown'
};

// =============================================================================
// Field Patterns for Detection
// =============================================================================

const FieldPatterns = {
  // Login/Authentication
  username: /user(name)?|login|account|uid|user_?id/i,
  password: /pass(word)?|pwd|secret|credential/i,
  email: /e?-?mail|correo/i,
  rememberMe: /remember|keep.*(logged|signed)|stay.*(logged|signed)/i,

  // Registration
  firstName: /first.?name|fname|given.?name|nombre/i,
  lastName: /last.?name|lname|surname|family.?name|apellido/i,
  fullName: /full.?name|name|your.?name|nombre.?completo/i,
  confirmPassword: /confirm.?pass|pass.?confirm|verify.?pass|re.?enter.?pass|repeat.?pass/i,
  phone: /phone|tel(ephone)?|mobile|cell|numero/i,
  dateOfBirth: /birth|dob|born|birthday|fecha.?nacimiento/i,
  gender: /gender|sex|genero/i,

  // Address
  address: /address|street|direccion|calle/i,
  address2: /address.?2|apt|suite|unit|apartment/i,
  city: /city|town|ciudad|localidad/i,
  state: /state|province|region|estado/i,
  zipCode: /zip|postal|post.?code|codigo.?postal/i,
  country: /country|nation|pais/i,

  // Payment
  cardNumber: /card.?num|cc.?num|credit.?card|numero.?tarjeta/i,
  cardName: /card.?name|name.?on.?card|cardholder/i,
  expiry: /expir|exp.?date|valid.?until|vencimiento/i,
  expiryMonth: /exp.?month|card.?month/i,
  expiryYear: /exp.?year|card.?year/i,
  cvv: /cvv|cvc|security.?code|csv|cvn/i,

  // Contact
  subject: /subject|asunto|topic|regarding/i,
  message: /message|comment|feedback|inquiry|msg|mensaje/i,
  company: /company|organization|business|empresa/i,
  website: /website|url|web|sitio/i,

  // Search
  search: /search|query|q|buscar|find|keyword/i,

  // Misc
  captcha: /captcha|verify|human|robot/i,
  terms: /terms|agree|accept|consent|tos|privacy/i,
  subscribe: /subscribe|newsletter|mailing|updates/i
};

// =============================================================================
// Form Type Detection Keywords
// =============================================================================

const FormTypeKeywords = {
  [FormTypes.LOGIN]: {
    formKeywords: /log.?in|sign.?in|auth|inicio.?sesion/i,
    requiredFields: ['password'],
    optionalFields: ['username', 'email', 'rememberMe'],
    maxFields: 5
  },
  [FormTypes.REGISTRATION]: {
    formKeywords: /sign.?up|register|create.?account|join|registro/i,
    requiredFields: ['password'],
    optionalFields: ['email', 'username', 'firstName', 'lastName', 'confirmPassword', 'phone'],
    minFields: 3
  },
  [FormTypes.PASSWORD_RESET]: {
    formKeywords: /reset|forgot|recover|password/i,
    requiredFields: ['email'],
    maxFields: 3
  },
  [FormTypes.SEARCH]: {
    formKeywords: /search|find|buscar/i,
    requiredFields: ['search'],
    maxFields: 3
  },
  [FormTypes.CONTACT]: {
    formKeywords: /contact|reach|support|help|contacto/i,
    requiredFields: ['message'],
    optionalFields: ['email', 'fullName', 'subject', 'phone']
  },
  [FormTypes.PAYMENT]: {
    formKeywords: /payment|pay|card|credit|tarjeta/i,
    requiredFields: ['cardNumber'],
    optionalFields: ['cardName', 'expiry', 'cvv']
  },
  [FormTypes.CHECKOUT]: {
    formKeywords: /checkout|order|comprar|purchase/i,
    requiredFields: [],
    optionalFields: ['address', 'city', 'zipCode', 'cardNumber']
  },
  [FormTypes.NEWSLETTER]: {
    formKeywords: /newsletter|subscribe|mailing|updates/i,
    requiredFields: ['email'],
    maxFields: 3
  },
  [FormTypes.ADDRESS]: {
    formKeywords: /address|shipping|delivery|direccion/i,
    requiredFields: ['address'],
    optionalFields: ['city', 'state', 'zipCode', 'country']
  },
  [FormTypes.PROFILE]: {
    formKeywords: /profile|account|settings|perfil/i,
    requiredFields: [],
    optionalFields: ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth']
  }
};

// =============================================================================
// FormDetector Class
// =============================================================================

class FormDetector {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.includeHidden = options.includeHidden || false;
    this.maxDepth = options.maxDepth || 5;
  }

  /**
   * Detect and analyze all forms on the page
   * @returns {Array} Array of analyzed form objects
   */
  detectForms() {
    const forms = document.querySelectorAll('form');
    const analyzedForms = [];

    forms.forEach((form, index) => {
      try {
        const analysis = this.analyzeForm(form, index);
        analyzedForms.push(analysis);
      } catch (error) {
        this.logger.error?.(`Error analyzing form ${index}:`, error) ||
          console.error(`Error analyzing form ${index}:`, error);
      }
    });

    // Also detect form-like structures without <form> tag
    const implicitForms = this.detectImplicitForms();
    analyzedForms.push(...implicitForms);

    return analyzedForms;
  }

  /**
   * Analyze a single form element
   * @param {HTMLFormElement} form - Form element to analyze
   * @param {number} index - Form index on page
   * @returns {Object} Form analysis object
   */
  analyzeForm(form, index = 0) {
    const fields = this.extractFields(form);
    const formType = this.detectFormType(form, fields);
    const captcha = this.detectCaptcha(form);
    const validation = this.extractValidationRules(fields);
    const multiStep = this.detectMultiStepForm(form);

    return {
      index,
      selector: this.generateFormSelector(form),
      type: formType,
      confidence: this.calculateTypeConfidence(formType, fields),
      attributes: {
        id: form.id || null,
        name: form.name || null,
        action: form.action || null,
        method: (form.method || 'GET').toUpperCase(),
        enctype: form.enctype || null,
        target: form.target || null,
        autocomplete: form.autocomplete || null,
        novalidate: form.noValidate
      },
      fields,
      fieldCount: fields.length,
      captcha,
      validation,
      multiStep,
      submitButton: this.findSubmitButton(form),
      isVisible: this.isElementVisible(form),
      boundingBox: this.getBoundingBox(form)
    };
  }

  /**
   * Extract all fields from a form
   * @param {HTMLFormElement|HTMLElement} container - Container element
   * @returns {Array} Array of field objects
   */
  extractFields(container) {
    const elements = container.querySelectorAll(
      'input, textarea, select, [contenteditable="true"]'
    );

    const fields = [];

    elements.forEach(element => {
      const field = this.analyzeField(element);
      if (field && (this.includeHidden || field.inputType !== 'hidden')) {
        fields.push(field);
      }
    });

    return fields;
  }

  /**
   * Analyze a single form field
   * @param {HTMLElement} element - Field element
   * @returns {Object|null} Field analysis object
   */
  analyzeField(element) {
    const tagName = element.tagName.toLowerCase();
    const inputType = element.type?.toLowerCase() || tagName;

    // Skip submit/reset/button types
    if (['submit', 'reset', 'button', 'image'].includes(inputType)) {
      return null;
    }

    const field = {
      selector: this.generateFieldSelector(element),
      tagName,
      inputType,
      name: element.name || null,
      id: element.id || null,
      label: this.findFieldLabel(element),
      placeholder: element.placeholder || null,

      // Field classification
      fieldType: this.classifyField(element),

      // Current state
      value: inputType !== 'password' ? (element.value || null) : '[hidden]',
      checked: ['checkbox', 'radio'].includes(inputType) ? element.checked : undefined,

      // Validation
      required: element.required || element.hasAttribute('aria-required'),
      disabled: element.disabled,
      readOnly: element.readOnly,
      pattern: element.pattern || null,
      minLength: element.minLength > 0 ? element.minLength : null,
      maxLength: element.maxLength > 0 && element.maxLength < 524288 ? element.maxLength : null,
      min: element.min || null,
      max: element.max || null,
      step: element.step || null,

      // ARIA attributes
      ariaLabel: element.getAttribute('aria-label'),
      ariaDescribedBy: element.getAttribute('aria-describedby'),
      ariaInvalid: element.getAttribute('aria-invalid'),

      // Visibility
      isVisible: this.isElementVisible(element),
      boundingBox: this.getBoundingBox(element),
      tabIndex: element.tabIndex
    };

    // Add options for select elements
    if (tagName === 'select') {
      field.options = this.extractSelectOptions(element);
      field.multiple = element.multiple;
      field.selectedIndex = element.selectedIndex;
    }

    // Add autocomplete hint
    if (element.autocomplete && element.autocomplete !== 'off') {
      field.autocomplete = element.autocomplete;
    }

    // Add data attributes that might be useful
    field.dataAttributes = this.extractDataAttributes(element);

    return field;
  }

  /**
   * Classify a field based on its attributes
   * @param {HTMLElement} element - Field element
   * @returns {string} Field classification
   */
  classifyField(element) {
    const name = (element.name || '').toLowerCase();
    const id = (element.id || '').toLowerCase();
    const placeholder = (element.placeholder || '').toLowerCase();
    const label = this.findFieldLabel(element)?.toLowerCase() || '';
    const autocomplete = (element.autocomplete || '').toLowerCase();
    const inputType = element.type?.toLowerCase();

    // Combine all text for pattern matching
    const combined = `${name} ${id} ${placeholder} ${label} ${autocomplete}`;

    // Check input type first
    if (inputType === 'email') return 'email';
    if (inputType === 'password') return 'password';
    if (inputType === 'tel') return 'phone';
    if (inputType === 'url') return 'website';
    if (inputType === 'date' || inputType === 'datetime-local') return 'date';
    if (inputType === 'number') return 'number';
    if (inputType === 'file') return 'file';
    if (inputType === 'color') return 'color';
    if (inputType === 'range') return 'range';

    // Check autocomplete hints
    if (autocomplete) {
      const autocompleteMap = {
        'username': 'username',
        'current-password': 'password',
        'new-password': 'password',
        'email': 'email',
        'tel': 'phone',
        'given-name': 'firstName',
        'family-name': 'lastName',
        'name': 'fullName',
        'street-address': 'address',
        'address-line1': 'address',
        'address-line2': 'address2',
        'address-level2': 'city',
        'address-level1': 'state',
        'postal-code': 'zipCode',
        'country': 'country',
        'cc-number': 'cardNumber',
        'cc-name': 'cardName',
        'cc-exp': 'expiry',
        'cc-csc': 'cvv',
        'organization': 'company',
        'bday': 'dateOfBirth'
      };
      if (autocompleteMap[autocomplete]) {
        return autocompleteMap[autocomplete];
      }
    }

    // Pattern matching
    for (const [fieldType, pattern] of Object.entries(FieldPatterns)) {
      if (pattern.test(combined)) {
        return fieldType;
      }
    }

    // Fallback to input type
    return inputType || 'text';
  }

  /**
   * Detect the type of form
   * @param {HTMLFormElement} form - Form element
   * @param {Array} fields - Extracted fields
   * @returns {string} Form type
   */
  detectFormType(form, fields) {
    const formText = this.getFormTextContent(form).toLowerCase();
    const formId = (form.id || '').toLowerCase();
    const formName = (form.name || '').toLowerCase();
    const formClass = (form.className || '').toLowerCase();
    const formAction = (form.action || '').toLowerCase();

    const combinedFormText = `${formText} ${formId} ${formName} ${formClass} ${formAction}`;

    // Get field types
    const fieldTypes = fields.map(f => f.fieldType);
    const hasPassword = fieldTypes.includes('password');
    const hasEmail = fieldTypes.includes('email');
    const hasCardNumber = fieldTypes.includes('cardNumber');
    const hasAddress = fieldTypes.includes('address');
    const hasMessage = fieldTypes.includes('message');
    const hasSearch = fieldTypes.includes('search');
    const hasConfirmPassword = fieldTypes.includes('confirmPassword');

    // Score each form type
    const scores = {};

    for (const [formType, config] of Object.entries(FormTypeKeywords)) {
      let score = 0;

      // Check keywords in form text
      if (config.formKeywords.test(combinedFormText)) {
        score += 3;
      }

      // Check required fields
      const requiredFound = config.requiredFields?.filter(f =>
        fieldTypes.includes(f)
      ).length || 0;
      score += requiredFound * 2;

      // Check optional fields
      const optionalFound = config.optionalFields?.filter(f =>
        fieldTypes.includes(f)
      ).length || 0;
      score += optionalFound * 0.5;

      // Check field count constraints
      if (config.maxFields && fields.length > config.maxFields) {
        score -= 1;
      }
      if (config.minFields && fields.length < config.minFields) {
        score -= 1;
      }

      scores[formType] = score;
    }

    // Apply specific heuristics

    // Login vs Registration
    if (hasPassword && !hasConfirmPassword && fields.length <= 4) {
      scores[FormTypes.LOGIN] += 2;
    }
    if (hasPassword && hasConfirmPassword) {
      scores[FormTypes.REGISTRATION] += 3;
    }

    // Payment forms
    if (hasCardNumber) {
      scores[FormTypes.PAYMENT] += 3;
    }

    // Contact forms
    if (hasMessage && !hasPassword) {
      scores[FormTypes.CONTACT] += 2;
    }

    // Search forms
    if (hasSearch && fields.length <= 2) {
      scores[FormTypes.SEARCH] += 3;
    }

    // Address forms
    if (hasAddress && !hasCardNumber) {
      scores[FormTypes.ADDRESS] += 2;
    }

    // Find highest scoring type
    let maxScore = 0;
    let detectedType = FormTypes.UNKNOWN;

    for (const [formType, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedType = formType;
      }
    }

    return detectedType;
  }

  /**
   * Calculate confidence score for form type detection
   * @param {string} formType - Detected form type
   * @param {Array} fields - Form fields
   * @returns {number} Confidence score 0-100
   */
  calculateTypeConfidence(formType, fields) {
    if (formType === FormTypes.UNKNOWN) return 0;

    const config = FormTypeKeywords[formType];
    if (!config) return 50;

    const fieldTypes = fields.map(f => f.fieldType);

    // Calculate based on required field matches
    const requiredMatches = config.requiredFields?.filter(f =>
      fieldTypes.includes(f)
    ).length || 0;
    const requiredTotal = config.requiredFields?.length || 0;

    let confidence = requiredTotal > 0
      ? (requiredMatches / requiredTotal) * 60
      : 40;

    // Bonus for optional field matches
    const optionalMatches = config.optionalFields?.filter(f =>
      fieldTypes.includes(f)
    ).length || 0;
    const optionalTotal = config.optionalFields?.length || 1;
    confidence += (optionalMatches / optionalTotal) * 20;

    // Bonus for field count in range
    if (!config.maxFields || fields.length <= config.maxFields) {
      confidence += 10;
    }
    if (!config.minFields || fields.length >= config.minFields) {
      confidence += 10;
    }

    return Math.min(100, Math.round(confidence));
  }

  /**
   * Detect CAPTCHA presence and type
   * @param {HTMLElement} container - Container to search in
   * @returns {Object|null} CAPTCHA detection result
   */
  detectCaptcha(container) {
    // Check for reCAPTCHA v2
    const recaptchaV2 = container.querySelector('.g-recaptcha, [data-sitekey]');
    if (recaptchaV2) {
      return {
        type: CaptchaTypes.RECAPTCHA_V2,
        siteKey: recaptchaV2.getAttribute('data-sitekey'),
        selector: this.generateFieldSelector(recaptchaV2),
        visible: this.isElementVisible(recaptchaV2)
      };
    }

    // Check for reCAPTCHA v3 (usually invisible)
    const recaptchaV3Script = document.querySelector('script[src*="recaptcha/api.js?render="]');
    if (recaptchaV3Script) {
      const src = recaptchaV3Script.src;
      const siteKey = src.match(/render=([^&]+)/)?.[1];
      return {
        type: CaptchaTypes.RECAPTCHA_V3,
        siteKey,
        visible: false
      };
    }

    // Check for hCaptcha
    const hcaptcha = container.querySelector('.h-captcha, [data-hcaptcha-sitekey]');
    if (hcaptcha) {
      return {
        type: CaptchaTypes.HCAPTCHA,
        siteKey: hcaptcha.getAttribute('data-sitekey') ||
                 hcaptcha.getAttribute('data-hcaptcha-sitekey'),
        selector: this.generateFieldSelector(hcaptcha),
        visible: this.isElementVisible(hcaptcha)
      };
    }

    // Check for Cloudflare Turnstile
    const turnstile = container.querySelector('.cf-turnstile, [data-turnstile-sitekey]');
    if (turnstile) {
      return {
        type: CaptchaTypes.CLOUDFLARE_TURNSTILE,
        siteKey: turnstile.getAttribute('data-sitekey'),
        selector: this.generateFieldSelector(turnstile),
        visible: this.isElementVisible(turnstile)
      };
    }

    // Check for FunCaptcha/Arkose
    const funcaptcha = container.querySelector('#funcaptcha, [data-pkey]');
    if (funcaptcha) {
      return {
        type: CaptchaTypes.FUNCAPTCHA,
        publicKey: funcaptcha.getAttribute('data-pkey'),
        selector: this.generateFieldSelector(funcaptcha),
        visible: this.isElementVisible(funcaptcha)
      };
    }

    // Check for generic image CAPTCHA
    const captchaImage = container.querySelector(
      'img[src*="captcha"], img[alt*="captcha"], img[id*="captcha"], img[class*="captcha"]'
    );
    if (captchaImage) {
      const captchaInput = container.querySelector(
        'input[name*="captcha"], input[id*="captcha"]'
      );
      return {
        type: CaptchaTypes.IMAGE_CAPTCHA,
        imageSelector: this.generateFieldSelector(captchaImage),
        inputSelector: captchaInput ? this.generateFieldSelector(captchaInput) : null,
        imageSrc: captchaImage.src,
        visible: this.isElementVisible(captchaImage)
      };
    }

    // Check for text-based CAPTCHA
    const captchaText = container.querySelector(
      '[class*="captcha"], [id*="captcha"]'
    );
    if (captchaText && captchaText.textContent.match(/captcha|verify|human/i)) {
      return {
        type: CaptchaTypes.TEXT_CAPTCHA,
        selector: this.generateFieldSelector(captchaText),
        visible: this.isElementVisible(captchaText)
      };
    }

    return null;
  }

  /**
   * Detect multi-step form structure
   * @param {HTMLFormElement} form - Form element
   * @returns {Object|null} Multi-step form info
   */
  detectMultiStepForm(form) {
    // Look for step indicators
    const stepIndicators = form.querySelectorAll(
      '[class*="step"], [class*="wizard"], [data-step], [class*="progress"]'
    );

    // Look for hidden sections that could be steps
    const sections = form.querySelectorAll(
      'fieldset, [class*="section"], [class*="panel"], [class*="page"]'
    );

    const hiddenSections = Array.from(sections).filter(s =>
      !this.isElementVisible(s) ||
      s.style.display === 'none' ||
      s.classList.contains('hidden')
    );

    // Look for next/prev buttons
    const navButtons = form.querySelectorAll(
      'button[class*="next"], button[class*="prev"], ' +
      'button[class*="continue"], button[class*="back"], ' +
      '[class*="step-nav"]'
    );

    const isMultiStep = stepIndicators.length > 0 ||
                        hiddenSections.length > 0 ||
                        navButtons.length > 1;

    if (!isMultiStep) return null;

    // Count visible vs hidden sections
    const visibleSections = Array.from(sections).filter(s => this.isElementVisible(s));

    return {
      isMultiStep: true,
      totalSteps: Math.max(sections.length, stepIndicators.length, 1),
      currentStep: visibleSections.length > 0 ? 1 : 0,
      hasStepIndicators: stepIndicators.length > 0,
      hasNavigationButtons: navButtons.length > 0,
      sections: Array.from(sections).map(s => ({
        selector: this.generateFieldSelector(s),
        visible: this.isElementVisible(s),
        fieldCount: s.querySelectorAll('input, textarea, select').length
      })),
      navigationButtons: Array.from(navButtons).map(b => ({
        selector: this.generateFieldSelector(b),
        text: b.textContent.trim(),
        type: b.className.includes('next') || b.className.includes('continue')
          ? 'next'
          : b.className.includes('prev') || b.className.includes('back')
          ? 'prev'
          : 'unknown'
      }))
    };
  }

  /**
   * Extract validation rules from fields
   * @param {Array} fields - Form fields
   * @returns {Object} Validation rules summary
   */
  extractValidationRules(fields) {
    const rules = {
      requiredFields: [],
      patterns: [],
      lengths: [],
      ranges: []
    };

    fields.forEach(field => {
      if (field.required) {
        rules.requiredFields.push({
          selector: field.selector,
          fieldType: field.fieldType,
          label: field.label
        });
      }

      if (field.pattern) {
        rules.patterns.push({
          selector: field.selector,
          pattern: field.pattern,
          fieldType: field.fieldType
        });
      }

      if (field.minLength || field.maxLength) {
        rules.lengths.push({
          selector: field.selector,
          minLength: field.minLength,
          maxLength: field.maxLength,
          fieldType: field.fieldType
        });
      }

      if (field.min || field.max) {
        rules.ranges.push({
          selector: field.selector,
          min: field.min,
          max: field.max,
          fieldType: field.fieldType
        });
      }
    });

    return rules;
  }

  /**
   * Find the submit button for a form
   * @param {HTMLFormElement} form - Form element
   * @returns {Object|null} Submit button info
   */
  findSubmitButton(form) {
    // Try explicit submit buttons first
    const submitInputs = form.querySelectorAll(
      'input[type="submit"], button[type="submit"]'
    );
    if (submitInputs.length > 0) {
      const btn = submitInputs[0];
      return {
        selector: this.generateFieldSelector(btn),
        text: btn.value || btn.textContent.trim(),
        type: 'submit',
        disabled: btn.disabled
      };
    }

    // Try buttons without explicit type (default is submit in forms)
    const buttons = form.querySelectorAll('button:not([type])');
    for (const btn of buttons) {
      const text = btn.textContent.toLowerCase();
      if (text.match(/submit|send|go|search|sign|log|register|create|continue/)) {
        return {
          selector: this.generateFieldSelector(btn),
          text: btn.textContent.trim(),
          type: 'implicit_submit',
          disabled: btn.disabled
        };
      }
    }

    // Look for any button that looks like a submit
    const allButtons = form.querySelectorAll('button, [role="button"]');
    for (const btn of allButtons) {
      const text = btn.textContent.toLowerCase();
      if (text.match(/submit|send|go|search|sign|log|register|create|continue|next/)) {
        return {
          selector: this.generateFieldSelector(btn),
          text: btn.textContent.trim(),
          type: 'button',
          disabled: btn.disabled
        };
      }
    }

    return null;
  }

  /**
   * Detect form-like structures without <form> tag
   * @returns {Array} Array of implicit form objects
   */
  detectImplicitForms() {
    const implicitForms = [];

    // Look for common form containers
    const containers = document.querySelectorAll(
      '[class*="form"]:not(form), [id*="form"]:not(form), ' +
      '[class*="login"]:not(form), [class*="signin"]:not(form), ' +
      '[class*="signup"]:not(form), [class*="register"]:not(form), ' +
      '[class*="search"]:not(form), [class*="contact"]:not(form)'
    );

    containers.forEach((container, index) => {
      // Check if container has form-like content
      const inputs = container.querySelectorAll('input, textarea, select');
      const hasInputs = inputs.length >= 1;

      // Make sure it's not inside a form
      const isInsideForm = container.closest('form');

      if (hasInputs && !isInsideForm) {
        const fields = this.extractFields(container);
        if (fields.length >= 1) {
          const formType = this.detectFormType(container, fields);

          implicitForms.push({
            index: `implicit-${index}`,
            selector: this.generateFieldSelector(container),
            type: formType,
            confidence: this.calculateTypeConfidence(formType, fields) * 0.8, // Lower confidence for implicit
            isImplicit: true,
            attributes: {
              id: container.id || null,
              className: container.className || null
            },
            fields,
            fieldCount: fields.length,
            captcha: this.detectCaptcha(container),
            validation: this.extractValidationRules(fields),
            multiStep: null,
            submitButton: this.findSubmitButton(container),
            isVisible: this.isElementVisible(container),
            boundingBox: this.getBoundingBox(container)
          });
        }
      }
    });

    return implicitForms;
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  /**
   * Find the label for a field
   * @param {HTMLElement} element - Field element
   * @returns {string|null} Label text
   */
  findFieldLabel(element) {
    // Check for label with 'for' attribute
    if (element.id) {
      const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (label) {
        return this.cleanLabelText(label.textContent);
      }
    }

    // Check for wrapping label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll('input, textarea, select').forEach(el => el.remove());
      return this.cleanLabelText(clone.textContent);
    }

    // Check for aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      return ariaLabel;
    }

    // Check for aria-labelledby
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelElement = document.getElementById(labelledBy);
      if (labelElement) {
        return this.cleanLabelText(labelElement.textContent);
      }
    }

    // Check for preceding label-like element
    const prevSibling = element.previousElementSibling;
    if (prevSibling && (prevSibling.tagName === 'LABEL' ||
        prevSibling.className.includes('label'))) {
      return this.cleanLabelText(prevSibling.textContent);
    }

    // Fall back to placeholder
    if (element.placeholder) {
      return element.placeholder;
    }

    // Fall back to title
    if (element.title) {
      return element.title;
    }

    return null;
  }

  /**
   * Clean label text
   * @param {string} text - Raw label text
   * @returns {string} Cleaned text
   */
  cleanLabelText(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[:\*]/g, '')
      .trim();
  }

  /**
   * Extract options from a select element
   * @param {HTMLSelectElement} select - Select element
   * @returns {Array} Array of option objects
   */
  extractSelectOptions(select) {
    return Array.from(select.options).map(opt => ({
      value: opt.value,
      text: opt.text,
      selected: opt.selected,
      disabled: opt.disabled
    }));
  }

  /**
   * Extract data attributes from an element
   * @param {HTMLElement} element - Element
   * @returns {Object} Data attributes
   */
  extractDataAttributes(element) {
    const dataAttrs = {};
    Array.from(element.attributes)
      .filter(attr => attr.name.startsWith('data-'))
      .forEach(attr => {
        dataAttrs[attr.name] = attr.value;
      });
    return Object.keys(dataAttrs).length > 0 ? dataAttrs : null;
  }

  /**
   * Get text content from form (excluding inputs)
   * @param {HTMLElement} form - Form element
   * @returns {string} Text content
   */
  getFormTextContent(form) {
    const clone = form.cloneNode(true);
    clone.querySelectorAll('input, textarea, select, script, style').forEach(el => el.remove());
    return clone.textContent || '';
  }

  /**
   * Generate a CSS selector for an element
   * @param {HTMLElement} element - Element
   * @returns {string} CSS selector
   */
  generateFieldSelector(element) {
    if (!element) return '';

    // Prefer ID
    if (element.id) {
      return `#${CSS.escape(element.id)}`;
    }

    // Prefer name for form elements
    if (element.name && this.isFormElement(element)) {
      const selector = `[name="${CSS.escape(element.name)}"]`;
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }

    // Try data-testid
    const testId = element.getAttribute('data-testid');
    if (testId) {
      return `[data-testid="${CSS.escape(testId)}"]`;
    }

    // Build path-based selector
    const path = [];
    let current = element;
    let depth = 0;

    while (current && current !== document.body && depth < this.maxDepth) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector = `#${CSS.escape(current.id)}`;
        path.unshift(selector);
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
   * Generate a selector specifically for forms
   * @param {HTMLFormElement} form - Form element
   * @returns {string} CSS selector
   */
  generateFormSelector(form) {
    if (form.id) {
      return `#${CSS.escape(form.id)}`;
    }
    if (form.name) {
      const selector = `form[name="${CSS.escape(form.name)}"]`;
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }

    // Use index
    const forms = document.querySelectorAll('form');
    const index = Array.from(forms).indexOf(form);
    if (index >= 0) {
      return `form:nth-of-type(${index + 1})`;
    }

    return this.generateFieldSelector(form);
  }

  /**
   * Check if element is a form element
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} True if form element
   */
  isFormElement(element) {
    return ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(element.tagName);
  }

  /**
   * Check if element is visible
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} True if visible
   */
  isElementVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);

    if (style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0') {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Get bounding box of element
   * @param {HTMLElement} element - Element
   * @returns {Object|null} Bounding box
   */
  getBoundingBox(element) {
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      bottom: Math.round(rect.bottom),
      right: Math.round(rect.right)
    };
  }
}

// =============================================================================
// Export
// =============================================================================

if (typeof globalThis !== 'undefined') {
  globalThis.FormDetector = FormDetector;
  globalThis.FormTypes = FormTypes;
  globalThis.CaptchaTypes = CaptchaTypes;
  globalThis.FieldPatterns = FieldPatterns;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FormDetector, FormTypes, CaptchaTypes, FieldPatterns };
}
