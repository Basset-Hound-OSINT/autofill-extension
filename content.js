/**
 * Basset Hound Browser Automation - Content Script
 *
 * This content script runs in the context of web pages and provides:
 * - DOM interaction functions (fill forms, click elements, get content)
 * - Element finding with multiple strategies
 * - Page state extraction
 * - Wait for element functionality
 */

// Initialize logger for content script
// Logger is injected via manifest.json content_scripts before this file
const contentLogger = new Logger({
  component: 'Content',
  minLevel: LogLevel.DEBUG,
  enableConsole: true,
  enableStorage: false // Don't persist from content scripts
});

// =============================================================================
// Configuration
// =============================================================================

const CONTENT_CONFIG = {
  DEFAULT_WAIT_TIMEOUT: 10000,  // 10 seconds
  TYPING_DELAY: 10,             // ms between keystrokes for simulated typing
  TYPING_DELAY_VARIANCE: 5,     // Random variance in typing delay
  SCROLL_WAIT: 300,             // ms to wait after scrolling
  MAX_SELECTOR_DEPTH: 10,       // Max depth for selector generation
  CLICK_DELAY: 50,              // Delay before click events
  FOCUS_DELAY: 30,              // Delay after focus
  MULTI_STEP_DELAY: 500,        // Delay between form steps
  DATE_PICKER_WAIT: 200,        // Wait for date pickers to open
  DROPDOWN_WAIT: 150            // Wait for dropdowns to open
};

// =============================================================================
// Form Detector and Template Mapper Initialization
// =============================================================================

// FormDetector and TemplateMapper are loaded via manifest.json content_scripts
let formDetector = null;
let templateMapper = null;

// Initialize form utilities when available
function initFormUtilities() {
  if (typeof FormDetector !== 'undefined' && !formDetector) {
    formDetector = new FormDetector({ logger: contentLogger });
    contentLogger.debug('FormDetector initialized');
  }
  if (typeof TemplateMapper !== 'undefined' && !templateMapper) {
    templateMapper = new TemplateMapper();
    contentLogger.debug('TemplateMapper initialized');
  }
}

// =============================================================================
// Message Listener
// =============================================================================

/**
 * Listen for messages from background script
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  contentLogger.debug('Received message from background', { action: request.action });

  // Handle the request asynchronously
  handleMessage(request)
    .then(response => {
      contentLogger.debug('Sending response', { action: request.action, success: response?.success });
      sendResponse(response);
    })
    .catch(error => {
      contentLogger.error('Error handling message', { action: request.action, error: error.message });
      sendResponse({ success: false, error: error.message });
    });

  // Return true to indicate we'll send a response asynchronously
  return true;
});

/**
 * Route messages to appropriate handlers
 * @param {Object} request - Message request object
 * @returns {Promise<Object>} - Response object
 */
async function handleMessage(request) {
  // Initialize form utilities on first message
  initFormUtilities();

  switch (request.action) {
    case 'fill_form':
      return handleFillForm(request.fields, request.submit);

    case 'click_element':
      return handleClickElement(request.selector, request.wait_after);

    case 'get_content':
      return handleGetContent(request.selector);

    case 'get_page_state':
      return handleGetPageState();

    case 'wait_for_element':
      return handleWaitForElement(request.selector, request.timeout);

    case 'get_local_storage':
      return handleGetLocalStorage(request.keys);

    case 'set_local_storage':
      return handleSetLocalStorage(request.items);

    case 'get_session_storage':
      return handleGetSessionStorage(request.keys);

    case 'set_session_storage':
      return handleSetSessionStorage(request.items);

    case 'clear_storage':
      return handleClearStorage(request.types);

    // Advanced form automation commands
    case 'detect_forms':
      return handleDetectForms(request.options);

    case 'auto_fill_form':
      return handleAutoFillForm(request.formSelector, request.data, request.options);

    case 'submit_form':
      return handleSubmitForm(request.formSelector, request.options);

    case 'get_form_validation':
      return handleGetFormValidation(request.formSelector);

    // Advanced interaction commands
    case 'fill_select':
      return handleFillSelect(request.selector, request.value, request.options);

    case 'fill_checkbox':
      return handleFillCheckbox(request.selector, request.checked);

    case 'fill_radio':
      return handleFillRadio(request.name, request.value);

    case 'fill_date':
      return handleFillDate(request.selector, request.date, request.options);

    case 'handle_file_upload':
      return handleFileUpload(request.selector, request.fileInfo);

    case 'navigate_multi_step':
      return handleNavigateMultiStep(request.formSelector, request.direction);

    case 'get_multi_step_info':
      return handleGetMultiStepInfo(request.formSelector);

    default:
      throw new Error(`Unknown action: ${request.action}`);
  }
}

// =============================================================================
// Form Filling
// =============================================================================

/**
 * Fill form fields with provided values
 * @param {Object} fields - Object mapping selectors to values
 * @param {boolean} submit - Whether to submit the form after filling
 * @returns {Promise<Object>} - Results of form filling
 */
async function handleFillForm(fields, submit = false) {
  contentLogger.info('Filling form', { fieldCount: Object.keys(fields).length, submit });

  const results = [];

  for (const [selector, value] of Object.entries(fields)) {
    try {
      const element = findElement(selector);

      if (!element) {
        contentLogger.warn('Element not found for selector', { selector });
        results.push({ selector, success: false, error: 'Element not found' });
        continue;
      }

      // Fill based on element type
      await fillElement(element, value);

      contentLogger.debug('Field filled successfully', { selector });
      results.push({ selector, success: true });
    } catch (error) {
      contentLogger.error('Failed to fill field', { selector, error: error.message });
      results.push({ selector, success: false, error: error.message });
    }
  }

  // Submit form if requested
  if (submit) {
    try {
      const form = document.querySelector('form');
      if (form) {
        contentLogger.info('Submitting form');
        form.submit();
      } else {
        contentLogger.warn('No form found to submit');
      }
    } catch (error) {
      contentLogger.error('Failed to submit form', error);
    }
  }

  return { success: true, filled: results };
}

/**
 * Fill a single element with a value
 * @param {HTMLElement} element - Element to fill
 * @param {*} value - Value to set
 */
async function fillElement(element, value) {
  const tagName = element.tagName.toLowerCase();
  const inputType = element.type?.toLowerCase();

  // Handle SELECT elements
  if (tagName === 'select') {
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  // Handle checkbox and radio inputs
  if (inputType === 'checkbox' || inputType === 'radio') {
    const shouldCheck = value === 'true' || value === true || value === '1';
    if (element.checked !== shouldCheck) {
      element.checked = shouldCheck;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('click', { bubbles: true }));
    }
    return;
  }

  // Handle file inputs (limited support)
  if (inputType === 'file') {
    throw new Error('File inputs cannot be filled programmatically for security reasons');
  }

  // Handle contenteditable elements
  if (element.contentEditable === 'true') {
    element.focus();
    element.innerHTML = '';
    element.textContent = value;
    element.dispatchEvent(new InputEvent('input', { bubbles: true }));
    element.blur();
    return;
  }

  // Handle text-based inputs (text, email, password, textarea, etc.)
  element.focus();

  // Clear existing value
  element.value = '';
  element.dispatchEvent(new Event('input', { bubbles: true }));

  // Simulate typing for better compatibility with reactive frameworks
  for (const char of String(value)) {
    element.value += char;

    // Dispatch input event for each character
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: char
    }));

    // Small delay for realistic typing
    await sleep(CONTENT_CONFIG.TYPING_DELAY);
  }

  // Dispatch final change event
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.blur();
}

// =============================================================================
// Click Handling
// =============================================================================

/**
 * Click an element on the page
 * @param {string} selector - CSS selector for the element
 * @param {number} waitAfter - Milliseconds to wait after clicking
 * @returns {Promise<Object>} - Click result
 */
async function handleClickElement(selector, waitAfter = 0) {
  contentLogger.info('Clicking element', { selector, waitAfter });

  // Validate selector
  if (!selector || typeof selector !== 'string') {
    throw new Error('Valid selector is required');
  }

  const element = findElement(selector);

  if (!element) {
    return { success: false, error: `Element not found: ${selector}` };
  }

  try {
    // Scroll element into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(CONTENT_CONFIG.SCROLL_WAIT);

    // Focus the element if possible
    if (typeof element.focus === 'function') {
      element.focus();
    }

    // Perform the click
    element.click();

    contentLogger.debug('Element clicked', { selector });

    // Wait after click if specified
    if (waitAfter > 0) {
      await sleep(waitAfter);
    }

    return { success: true, clicked: selector };
  } catch (error) {
    contentLogger.error('Click failed', { selector, error: error.message });
    return { success: false, error: error.message };
  }
}

// =============================================================================
// Content Extraction
// =============================================================================

/**
 * Get content from the page
 * @param {string} selector - Optional CSS selector (defaults to body)
 * @returns {Promise<Object>} - Content extraction result
 */
async function handleGetContent(selector) {
  contentLogger.info('Getting content', { selector: selector || 'body' });

  try {
    const element = selector ? document.querySelector(selector) : document.body;

    if (!element) {
      return { success: false, error: `Element not found: ${selector}` };
    }

    return {
      success: true,
      content: element.innerText,
      html: element.innerHTML,
      selector: selector || 'body'
    };
  } catch (error) {
    contentLogger.error('Failed to get content', { selector, error: error.message });
    return { success: false, error: error.message };
  }
}

// =============================================================================
// Page State Extraction
// =============================================================================

/**
 * Get comprehensive page state including forms, links, and buttons
 * @returns {Promise<Object>} - Page state object
 */
async function handleGetPageState() {
  contentLogger.info('Getting page state');

  try {
    // Extract forms with their fields
    const forms = Array.from(document.querySelectorAll('form')).map(form => {
      return {
        id: form.id || null,
        name: form.name || null,
        action: form.action || null,
        method: (form.method || 'GET').toUpperCase(),
        selector: generateSelector(form),
        fields: extractFormFields(form)
      };
    });

    // Extract links (limit to prevent massive responses)
    const links = Array.from(document.querySelectorAll('a[href]'))
      .slice(0, 100)
      .map(a => ({
        text: a.innerText.trim().substring(0, 100),
        href: a.href,
        selector: generateSelector(a)
      }))
      .filter(link => link.text.length > 0);

    // Extract buttons
    const buttons = Array.from(document.querySelectorAll(
      'button, input[type="submit"], input[type="button"], [role="button"]'
    )).map(b => ({
      text: (b.innerText || b.value || b.getAttribute('aria-label') || '').trim().substring(0, 100),
      type: b.type || 'button',
      selector: generateSelector(b),
      disabled: b.disabled
    }));

    // Extract input fields not in forms
    const standaloneInputs = Array.from(document.querySelectorAll(
      'input:not(form input), textarea:not(form textarea), select:not(form select)'
    )).map(el => ({
      selector: generateSelector(el),
      type: el.type || el.tagName.toLowerCase(),
      name: el.name || null,
      id: el.id || null,
      label: findLabel(el),
      placeholder: el.placeholder || null,
      required: el.required
    }));

    return {
      success: true,
      url: window.location.href,
      title: document.title,
      forms,
      links,
      buttons,
      standaloneInputs,
      meta: {
        documentReady: document.readyState,
        scrollHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth
      }
    };
  } catch (error) {
    contentLogger.error('Failed to get page state', error);
    return { success: false, error: error.message };
  }
}

/**
 * Extract fields from a form
 * @param {HTMLFormElement} form - Form element
 * @returns {Array} - Array of field objects
 */
function extractFormFields(form) {
  return Array.from(form.elements)
    .filter(el => {
      // Filter out submit buttons and hidden fields without names
      const type = el.type?.toLowerCase();
      if (type === 'submit' || type === 'button' || type === 'reset') return false;
      if (type === 'hidden' && !el.name) return false;
      return true;
    })
    .map(el => {
      const field = {
        selector: generateSelector(el),
        type: el.type || el.tagName.toLowerCase(),
        name: el.name || null,
        id: el.id || null,
        label: findLabel(el),
        required: el.required,
        disabled: el.disabled,
        readonly: el.readOnly
      };

      // Add placeholder for text inputs
      if (el.placeholder) {
        field.placeholder = el.placeholder;
      }

      // Don't expose password values
      if (el.type !== 'password') {
        field.value = el.value || null;
      } else {
        field.value = el.value ? '[hidden]' : null;
      }

      // Add options for select elements
      if (el.tagName === 'SELECT') {
        field.options = Array.from(el.options).map(opt => ({
          value: opt.value,
          text: opt.text,
          selected: opt.selected
        }));
      }

      // Add checked state for checkboxes/radios
      if (el.type === 'checkbox' || el.type === 'radio') {
        field.checked = el.checked;
      }

      return field;
    });
}

// =============================================================================
// Wait for Element
// =============================================================================

/**
 * Wait for an element to appear on the page
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Object>} - Result object
 */
async function handleWaitForElement(selector, timeout = CONTENT_CONFIG.DEFAULT_WAIT_TIMEOUT) {
  contentLogger.info('Waiting for element', { selector, timeout });

  // Validate selector
  if (!selector || typeof selector !== 'string') {
    throw new Error('Valid selector is required');
  }

  try {
    const element = await waitForElement(selector, timeout);
    return {
      success: true,
      found: true,
      selector,
      elementInfo: {
        tagName: element.tagName.toLowerCase(),
        id: element.id || null,
        className: element.className || null
      }
    };
  } catch (error) {
    contentLogger.warn('Element not found within timeout', { selector, timeout });
    return {
      success: true,
      found: false,
      selector,
      error: error.message
    };
  }
}

/**
 * Wait for element with MutationObserver
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<HTMLElement>} - Found element
 */
function waitForElement(selector, timeout = CONTENT_CONFIG.DEFAULT_WAIT_TIMEOUT) {
  return new Promise((resolve, reject) => {
    // Check if element already exists
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    // Set up timeout
    const timeoutId = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for element: ${selector}`));
    }, timeout);

    // Set up mutation observer
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        clearTimeout(timeoutId);
        obs.disconnect();
        resolve(element);
      }
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });
  });
}

// =============================================================================
// Storage Handlers (localStorage, sessionStorage)
// =============================================================================

/**
 * Get localStorage items
 * @param {string[]|null} keys - Specific keys to get, or null for all
 * @returns {Promise<Object>} - Storage items
 */
async function handleGetLocalStorage(keys) {
  contentLogger.info('Getting localStorage', { keys: keys || 'all' });

  try {
    const items = {};
    const keysToGet = keys || Object.keys(localStorage);

    for (const key of keysToGet) {
      const value = localStorage.getItem(key);
      if (value !== null) {
        // Try to parse JSON values
        try {
          items[key] = JSON.parse(value);
        } catch {
          items[key] = value;
        }
      }
    }

    return {
      success: true,
      items,
      count: Object.keys(items).length,
      totalKeys: localStorage.length
    };
  } catch (error) {
    contentLogger.error('Failed to get localStorage', error);
    return { success: false, error: error.message };
  }
}

/**
 * Set localStorage items
 * @param {Object} items - Key-value pairs to set
 * @returns {Promise<Object>} - Result of setting items
 */
async function handleSetLocalStorage(items) {
  contentLogger.info('Setting localStorage', { count: Object.keys(items).length });

  const results = [];

  for (const [key, value] of Object.entries(items)) {
    try {
      // Convert objects to JSON strings
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      localStorage.setItem(key, stringValue);
      results.push({ key, success: true });
    } catch (error) {
      contentLogger.error('Failed to set localStorage item', { key, error: error.message });
      results.push({ key, success: false, error: error.message });
    }
  }

  const successCount = results.filter(r => r.success).length;
  return {
    success: successCount === results.length,
    results,
    successCount,
    totalCount: results.length
  };
}

/**
 * Get sessionStorage items
 * @param {string[]|null} keys - Specific keys to get, or null for all
 * @returns {Promise<Object>} - Storage items
 */
async function handleGetSessionStorage(keys) {
  contentLogger.info('Getting sessionStorage', { keys: keys || 'all' });

  try {
    const items = {};
    const keysToGet = keys || Object.keys(sessionStorage);

    for (const key of keysToGet) {
      const value = sessionStorage.getItem(key);
      if (value !== null) {
        // Try to parse JSON values
        try {
          items[key] = JSON.parse(value);
        } catch {
          items[key] = value;
        }
      }
    }

    return {
      success: true,
      items,
      count: Object.keys(items).length,
      totalKeys: sessionStorage.length
    };
  } catch (error) {
    contentLogger.error('Failed to get sessionStorage', error);
    return { success: false, error: error.message };
  }
}

/**
 * Set sessionStorage items
 * @param {Object} items - Key-value pairs to set
 * @returns {Promise<Object>} - Result of setting items
 */
async function handleSetSessionStorage(items) {
  contentLogger.info('Setting sessionStorage', { count: Object.keys(items).length });

  const results = [];

  for (const [key, value] of Object.entries(items)) {
    try {
      // Convert objects to JSON strings
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      sessionStorage.setItem(key, stringValue);
      results.push({ key, success: true });
    } catch (error) {
      contentLogger.error('Failed to set sessionStorage item', { key, error: error.message });
      results.push({ key, success: false, error: error.message });
    }
  }

  const successCount = results.filter(r => r.success).length;
  return {
    success: successCount === results.length,
    results,
    successCount,
    totalCount: results.length
  };
}

/**
 * Clear storage (localStorage and/or sessionStorage)
 * @param {string[]} types - Types to clear: 'localStorage', 'sessionStorage'
 * @returns {Promise<Object>} - Result of clearing storage
 */
async function handleClearStorage(types) {
  contentLogger.info('Clearing storage', { types });

  const results = {};

  if (types.includes('localStorage')) {
    try {
      const previousCount = localStorage.length;
      localStorage.clear();
      results.localStorage = { success: true, cleared: previousCount };
      contentLogger.info('localStorage cleared', { previousCount });
    } catch (error) {
      contentLogger.error('Failed to clear localStorage', error);
      results.localStorage = { success: false, error: error.message };
    }
  }

  if (types.includes('sessionStorage')) {
    try {
      const previousCount = sessionStorage.length;
      sessionStorage.clear();
      results.sessionStorage = { success: true, cleared: previousCount };
      contentLogger.info('sessionStorage cleared', { previousCount });
    } catch (error) {
      contentLogger.error('Failed to clear sessionStorage', error);
      results.sessionStorage = { success: false, error: error.message };
    }
  }

  return {
    success: Object.values(results).every(r => r.success),
    ...results
  };
}

// =============================================================================
// Advanced Form Detection
// =============================================================================

/**
 * Detect and analyze all forms on the page
 * @param {Object} options - Detection options
 * @returns {Promise<Object>} - Detected forms with analysis
 */
async function handleDetectForms(options = {}) {
  contentLogger.info('Detecting forms on page', { options });

  try {
    initFormUtilities();

    if (!formDetector) {
      // Fallback if FormDetector not loaded
      return handleGetPageState();
    }

    const forms = formDetector.detectForms();

    return {
      success: true,
      forms,
      formCount: forms.length,
      url: window.location.href,
      timestamp: Date.now()
    };
  } catch (error) {
    contentLogger.error('Failed to detect forms', error);
    return { success: false, error: error.message };
  }
}

/**
 * Auto-fill a form using template data
 * @param {string} formSelector - Form selector (optional, uses first form if not provided)
 * @param {Object} data - Data to fill in the form
 * @param {Object} options - Fill options
 * @returns {Promise<Object>} - Fill results
 */
async function handleAutoFillForm(formSelector, data, options = {}) {
  contentLogger.info('Auto-filling form', { formSelector, options });

  const {
    humanLike = true,
    skipHidden = true,
    validateBefore = false,
    submitAfter = false
  } = options;

  try {
    initFormUtilities();

    // Find the form
    const form = formSelector
      ? document.querySelector(formSelector)
      : document.querySelector('form');

    if (!form) {
      return { success: false, error: 'No form found' };
    }

    // Detect form fields
    let fields;
    if (formDetector) {
      const formAnalysis = formDetector.analyzeForm(form, 0);
      fields = formAnalysis.fields;
    } else {
      fields = extractFormFields(form);
    }

    // Map data to fields
    let fieldMappings;
    if (templateMapper && data) {
      fieldMappings = templateMapper.mapFieldsToValues(fields, data);
    } else {
      // Direct selector-to-value mapping
      fieldMappings = data || {};
    }

    const results = [];
    const filledFields = [];

    // Fill each field
    for (const field of fields) {
      // Skip hidden fields if option enabled
      if (skipHidden && !field.isVisible && field.inputType !== 'hidden') {
        continue;
      }

      // Skip disabled or readonly fields
      if (field.disabled || field.readOnly) {
        continue;
      }

      const value = fieldMappings[field.selector] ||
                    fieldMappings[field.name] ||
                    fieldMappings[field.id] ||
                    fieldMappings[field.fieldType];

      if (value !== undefined && value !== null) {
        try {
          const element = document.querySelector(field.selector);
          if (element) {
            await fillElementAdvanced(element, value, { humanLike });
            results.push({ selector: field.selector, success: true, fieldType: field.fieldType });
            filledFields.push(field.selector);
          }
        } catch (error) {
          results.push({ selector: field.selector, success: false, error: error.message });
        }
      }
    }

    // Validate if requested
    let validationErrors = [];
    if (validateBefore) {
      const validation = await handleGetFormValidation(formSelector);
      validationErrors = validation.errors || [];
    }

    // Submit if requested and no validation errors
    if (submitAfter && validationErrors.length === 0) {
      await sleep(CONTENT_CONFIG.MULTI_STEP_DELAY);
      await handleSubmitForm(formSelector, options);
    }

    return {
      success: true,
      filled: results,
      filledCount: filledFields.length,
      totalFields: fields.length,
      validationErrors,
      formSelector: generateSelector(form)
    };
  } catch (error) {
    contentLogger.error('Failed to auto-fill form', error);
    return { success: false, error: error.message };
  }
}

/**
 * Submit a form
 * @param {string} formSelector - Form selector
 * @param {Object} options - Submit options
 * @returns {Promise<Object>} - Submit result
 */
async function handleSubmitForm(formSelector, options = {}) {
  contentLogger.info('Submitting form', { formSelector, options });

  const {
    clickSubmit = true,
    waitForNavigation = false,
    timeout = 5000
  } = options;

  try {
    const form = formSelector
      ? document.querySelector(formSelector)
      : document.querySelector('form');

    if (!form) {
      return { success: false, error: 'No form found' };
    }

    if (clickSubmit) {
      // Try to find and click submit button
      const submitBtn = form.querySelector(
        'input[type="submit"], button[type="submit"], button:not([type])'
      );

      if (submitBtn) {
        // Scroll into view and click
        submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(CONTENT_CONFIG.SCROLL_WAIT);

        // Simulate human-like click
        await simulateHumanClick(submitBtn);

        return {
          success: true,
          method: 'click',
          buttonSelector: generateSelector(submitBtn)
        };
      }
    }

    // Fallback to form.submit()
    form.submit();

    return {
      success: true,
      method: 'submit'
    };
  } catch (error) {
    contentLogger.error('Failed to submit form', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get form validation errors
 * @param {string} formSelector - Form selector
 * @returns {Promise<Object>} - Validation errors
 */
async function handleGetFormValidation(formSelector) {
  contentLogger.info('Getting form validation', { formSelector });

  try {
    const form = formSelector
      ? document.querySelector(formSelector)
      : document.querySelector('form');

    if (!form) {
      return { success: false, error: 'No form found' };
    }

    const errors = [];
    const fields = form.querySelectorAll('input, textarea, select');

    for (const field of fields) {
      // Check HTML5 validation
      if (!field.checkValidity()) {
        errors.push({
          selector: generateSelector(field),
          name: field.name,
          message: field.validationMessage,
          validity: {
            valueMissing: field.validity.valueMissing,
            typeMismatch: field.validity.typeMismatch,
            patternMismatch: field.validity.patternMismatch,
            tooLong: field.validity.tooLong,
            tooShort: field.validity.tooShort,
            rangeUnderflow: field.validity.rangeUnderflow,
            rangeOverflow: field.validity.rangeOverflow,
            stepMismatch: field.validity.stepMismatch,
            badInput: field.validity.badInput,
            customError: field.validity.customError
          }
        });
      }

      // Check for visible error messages near field
      const errorMessage = findFieldErrorMessage(field);
      if (errorMessage && !errors.find(e => e.selector === generateSelector(field))) {
        errors.push({
          selector: generateSelector(field),
          name: field.name,
          message: errorMessage,
          source: 'visible_error'
        });
      }
    }

    // Check for form-level error messages
    const formErrors = findFormErrorMessages(form);

    return {
      success: true,
      isValid: errors.length === 0 && formErrors.length === 0,
      errors,
      formErrors,
      formSelector: generateSelector(form)
    };
  } catch (error) {
    contentLogger.error('Failed to get form validation', error);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// Advanced Interaction Handlers
// =============================================================================

/**
 * Handle select/dropdown filling with human-like interaction
 * @param {string} selector - Select element selector
 * @param {string|Object} value - Value to select (can be value or text)
 * @param {Object} options - Options
 * @returns {Promise<Object>} - Result
 */
async function handleFillSelect(selector, value, options = {}) {
  contentLogger.info('Filling select', { selector, value, options });

  const { byText = false, humanLike = true } = options;

  try {
    const select = findElement(selector);

    if (!select || select.tagName !== 'SELECT') {
      return { success: false, error: 'Select element not found' };
    }

    // Scroll into view
    select.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(CONTENT_CONFIG.SCROLL_WAIT);

    // Focus the select
    select.focus();
    await sleep(CONTENT_CONFIG.FOCUS_DELAY);

    // Dispatch mousedown to potentially open native dropdown
    if (humanLike) {
      select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await sleep(CONTENT_CONFIG.DROPDOWN_WAIT);
    }

    // Find the option
    let option;
    if (byText) {
      option = Array.from(select.options).find(
        opt => opt.text.toLowerCase().includes(String(value).toLowerCase())
      );
    } else {
      option = Array.from(select.options).find(
        opt => opt.value === String(value)
      );
    }

    if (!option) {
      // Try partial match
      option = Array.from(select.options).find(
        opt => opt.value.includes(String(value)) || opt.text.includes(String(value))
      );
    }

    if (!option) {
      return {
        success: false,
        error: 'Option not found',
        availableOptions: Array.from(select.options).map(o => ({ value: o.value, text: o.text }))
      };
    }

    // Select the option
    select.value = option.value;

    // Dispatch events
    select.dispatchEvent(new Event('change', { bubbles: true }));
    select.dispatchEvent(new Event('input', { bubbles: true }));

    if (humanLike) {
      select.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    }

    select.blur();

    return {
      success: true,
      selectedValue: option.value,
      selectedText: option.text,
      selector
    };
  } catch (error) {
    contentLogger.error('Failed to fill select', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle checkbox filling
 * @param {string} selector - Checkbox selector
 * @param {boolean} checked - Whether to check or uncheck
 * @returns {Promise<Object>} - Result
 */
async function handleFillCheckbox(selector, checked = true) {
  contentLogger.info('Filling checkbox', { selector, checked });

  try {
    const checkbox = findElement(selector);

    if (!checkbox || checkbox.type !== 'checkbox') {
      return { success: false, error: 'Checkbox not found' };
    }

    // Scroll into view
    checkbox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(CONTENT_CONFIG.SCROLL_WAIT);

    const shouldCheck = checked === true || checked === 'true' || checked === '1';

    if (checkbox.checked !== shouldCheck) {
      // Focus first
      checkbox.focus();
      await sleep(CONTENT_CONFIG.FOCUS_DELAY);

      // Click to toggle
      await simulateHumanClick(checkbox);

      // Ensure state is correct
      if (checkbox.checked !== shouldCheck) {
        checkbox.checked = shouldCheck;
      }

      // Dispatch events
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      checkbox.dispatchEvent(new Event('input', { bubbles: true }));
    }

    return {
      success: true,
      checked: checkbox.checked,
      selector
    };
  } catch (error) {
    contentLogger.error('Failed to fill checkbox', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle radio button filling
 * @param {string} name - Radio button group name
 * @param {string} value - Value to select
 * @returns {Promise<Object>} - Result
 */
async function handleFillRadio(name, value) {
  contentLogger.info('Filling radio', { name, value });

  try {
    // Find all radios in the group
    const radios = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`);

    if (radios.length === 0) {
      return { success: false, error: 'Radio group not found' };
    }

    // Find the radio with matching value
    let targetRadio = Array.from(radios).find(r => r.value === String(value));

    if (!targetRadio) {
      // Try finding by label text
      for (const radio of radios) {
        const label = findLabel(radio);
        if (label && label.toLowerCase().includes(String(value).toLowerCase())) {
          targetRadio = radio;
          break;
        }
      }
    }

    if (!targetRadio) {
      return {
        success: false,
        error: 'Radio option not found',
        availableOptions: Array.from(radios).map(r => ({
          value: r.value,
          label: findLabel(r),
          checked: r.checked
        }))
      };
    }

    // Scroll into view
    targetRadio.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(CONTENT_CONFIG.SCROLL_WAIT);

    // Focus and click
    targetRadio.focus();
    await sleep(CONTENT_CONFIG.FOCUS_DELAY);

    await simulateHumanClick(targetRadio);

    // Ensure it's checked
    if (!targetRadio.checked) {
      targetRadio.checked = true;
    }

    // Dispatch events
    targetRadio.dispatchEvent(new Event('change', { bubbles: true }));
    targetRadio.dispatchEvent(new Event('input', { bubbles: true }));

    return {
      success: true,
      selectedValue: targetRadio.value,
      selector: generateSelector(targetRadio)
    };
  } catch (error) {
    contentLogger.error('Failed to fill radio', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle date picker filling
 * @param {string} selector - Date input selector
 * @param {string} date - Date value (YYYY-MM-DD or other format)
 * @param {Object} options - Options for date handling
 * @returns {Promise<Object>} - Result
 */
async function handleFillDate(selector, date, options = {}) {
  contentLogger.info('Filling date', { selector, date, options });

  const { format = 'iso', openPicker = true } = options;

  try {
    const dateInput = findElement(selector);

    if (!dateInput) {
      return { success: false, error: 'Date input not found' };
    }

    // Scroll into view
    dateInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(CONTENT_CONFIG.SCROLL_WAIT);

    // Parse and format date
    let dateValue = date;
    if (format !== 'iso') {
      dateValue = formatDateForInput(date, format, dateInput.type);
    }

    // Focus the input
    dateInput.focus();
    await sleep(CONTENT_CONFIG.FOCUS_DELAY);

    // For native date inputs
    if (dateInput.type === 'date' || dateInput.type === 'datetime-local') {
      dateInput.value = dateValue;
      dateInput.dispatchEvent(new Event('input', { bubbles: true }));
      dateInput.dispatchEvent(new Event('change', { bubbles: true }));

      return {
        success: true,
        value: dateInput.value,
        selector
      };
    }

    // For custom date pickers, try clicking to open
    if (openPicker) {
      await simulateHumanClick(dateInput);
      await sleep(CONTENT_CONFIG.DATE_PICKER_WAIT);
    }

    // Type the date value
    await fillElementAdvanced(dateInput, dateValue, { humanLike: true });

    return {
      success: true,
      value: dateInput.value,
      selector
    };
  } catch (error) {
    contentLogger.error('Failed to fill date', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle file upload (limited - provides info for user action)
 * @param {string} selector - File input selector
 * @param {Object} fileInfo - Information about files to upload
 * @returns {Promise<Object>} - Result with instructions
 */
async function handleFileUpload(selector, fileInfo) {
  contentLogger.info('File upload requested', { selector, fileInfo });

  try {
    const fileInput = findElement(selector);

    if (!fileInput || fileInput.type !== 'file') {
      return { success: false, error: 'File input not found' };
    }

    // Note: For security reasons, file inputs cannot be programmatically filled
    // We can only provide information and trigger a click

    const inputInfo = {
      selector: generateSelector(fileInput),
      accept: fileInput.accept || '*',
      multiple: fileInput.multiple,
      required: fileInput.required,
      name: fileInput.name
    };

    // Scroll into view
    fileInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(CONTENT_CONFIG.SCROLL_WAIT);

    return {
      success: true,
      needsUserAction: true,
      message: 'File inputs require user interaction for security. Click the input to select files.',
      inputInfo,
      requestedFiles: fileInfo
    };
  } catch (error) {
    contentLogger.error('Failed to handle file upload', error);
    return { success: false, error: error.message };
  }
}

/**
 * Navigate multi-step form (next/prev)
 * @param {string} formSelector - Form selector
 * @param {string} direction - 'next' or 'prev'
 * @returns {Promise<Object>} - Result
 */
async function handleNavigateMultiStep(formSelector, direction = 'next') {
  contentLogger.info('Navigating multi-step form', { formSelector, direction });

  try {
    const form = formSelector
      ? document.querySelector(formSelector)
      : document.querySelector('form');

    if (!form) {
      return { success: false, error: 'Form not found' };
    }

    // Find navigation buttons
    const buttonPatterns = direction === 'next'
      ? ['next', 'continue', 'forward', 'proceed', 'siguiente']
      : ['prev', 'previous', 'back', 'anterior'];

    let navButton = null;

    // Search for buttons with matching text/class
    const buttons = form.querySelectorAll('button, [role="button"], input[type="button"]');
    for (const btn of buttons) {
      const text = (btn.innerText || btn.value || '').toLowerCase();
      const className = (btn.className || '').toLowerCase();

      for (const pattern of buttonPatterns) {
        if (text.includes(pattern) || className.includes(pattern)) {
          navButton = btn;
          break;
        }
      }
      if (navButton) break;
    }

    if (!navButton) {
      return {
        success: false,
        error: `No ${direction} button found`,
        availableButtons: Array.from(buttons).map(b => ({
          selector: generateSelector(b),
          text: (b.innerText || b.value || '').trim()
        }))
      };
    }

    // Click the button
    navButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(CONTENT_CONFIG.SCROLL_WAIT);

    await simulateHumanClick(navButton);
    await sleep(CONTENT_CONFIG.MULTI_STEP_DELAY);

    return {
      success: true,
      direction,
      buttonClicked: generateSelector(navButton)
    };
  } catch (error) {
    contentLogger.error('Failed to navigate multi-step form', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get multi-step form information
 * @param {string} formSelector - Form selector
 * @returns {Promise<Object>} - Multi-step info
 */
async function handleGetMultiStepInfo(formSelector) {
  contentLogger.info('Getting multi-step form info', { formSelector });

  try {
    const form = formSelector
      ? document.querySelector(formSelector)
      : document.querySelector('form');

    if (!form) {
      return { success: false, error: 'Form not found' };
    }

    initFormUtilities();

    if (formDetector) {
      const analysis = formDetector.analyzeForm(form, 0);
      return {
        success: true,
        multiStep: analysis.multiStep,
        formSelector: analysis.selector
      };
    }

    // Basic multi-step detection fallback
    const steps = form.querySelectorAll('[class*="step"], [data-step], fieldset');
    const visibleSteps = Array.from(steps).filter(s => {
      const style = window.getComputedStyle(s);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });

    return {
      success: true,
      multiStep: {
        isMultiStep: steps.length > 1,
        totalSteps: steps.length,
        visibleSteps: visibleSteps.length
      },
      formSelector: generateSelector(form)
    };
  } catch (error) {
    contentLogger.error('Failed to get multi-step info', error);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// Advanced Fill Helpers
// =============================================================================

/**
 * Fill an element with advanced human-like behavior
 * @param {HTMLElement} element - Element to fill
 * @param {*} value - Value to set
 * @param {Object} options - Fill options
 */
async function fillElementAdvanced(element, value, options = {}) {
  const { humanLike = true } = options;
  const tagName = element.tagName.toLowerCase();
  const inputType = element.type?.toLowerCase();

  // Handle SELECT elements
  if (tagName === 'select') {
    return handleFillSelect(generateSelector(element), value, { humanLike });
  }

  // Handle checkbox and radio inputs
  if (inputType === 'checkbox') {
    return handleFillCheckbox(generateSelector(element), value);
  }

  if (inputType === 'radio') {
    return handleFillRadio(element.name, value);
  }

  // Handle date inputs
  if (inputType === 'date' || inputType === 'datetime-local') {
    return handleFillDate(generateSelector(element), value);
  }

  // Handle file inputs
  if (inputType === 'file') {
    return handleFileUpload(generateSelector(element), value);
  }

  // Handle contenteditable elements
  if (element.contentEditable === 'true') {
    element.focus();
    await sleep(CONTENT_CONFIG.FOCUS_DELAY);
    element.innerHTML = '';

    if (humanLike) {
      for (const char of String(value)) {
        element.textContent += char;
        element.dispatchEvent(new InputEvent('input', { bubbles: true }));
        await sleep(getTypingDelay());
      }
    } else {
      element.textContent = value;
      element.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }

    element.blur();
    return;
  }

  // Handle text-based inputs
  element.focus();
  await sleep(CONTENT_CONFIG.FOCUS_DELAY);

  // Clear existing value
  element.value = '';
  element.dispatchEvent(new Event('input', { bubbles: true }));

  if (humanLike) {
    // Simulate typing with variable delays
    for (const char of String(value)) {
      element.value += char;

      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: char
      }));

      // Dispatch keydown/keypress/keyup for better compatibility
      const keyEvent = { key: char, code: `Key${char.toUpperCase()}`, bubbles: true };
      element.dispatchEvent(new KeyboardEvent('keydown', keyEvent));
      element.dispatchEvent(new KeyboardEvent('keypress', keyEvent));
      element.dispatchEvent(new KeyboardEvent('keyup', keyEvent));

      await sleep(getTypingDelay());
    }
  } else {
    element.value = String(value);
    element.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }

  // Dispatch final change event
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.blur();
}

/**
 * Simulate a human-like click with mouse events
 * @param {HTMLElement} element - Element to click
 */
async function simulateHumanClick(element) {
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  const mouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y
  };

  // Dispatch mouse events in order
  element.dispatchEvent(new MouseEvent('mouseenter', mouseEventInit));
  await sleep(CONTENT_CONFIG.CLICK_DELAY);

  element.dispatchEvent(new MouseEvent('mouseover', mouseEventInit));
  element.dispatchEvent(new MouseEvent('mousedown', { ...mouseEventInit, button: 0 }));
  await sleep(CONTENT_CONFIG.CLICK_DELAY);

  element.dispatchEvent(new MouseEvent('mouseup', { ...mouseEventInit, button: 0 }));
  element.dispatchEvent(new MouseEvent('click', { ...mouseEventInit, button: 0 }));

  // Also call native click for form elements
  if (typeof element.click === 'function') {
    element.click();
  }
}

/**
 * Get a randomized typing delay
 * @returns {number} Delay in ms
 */
function getTypingDelay() {
  const variance = Math.random() * CONTENT_CONFIG.TYPING_DELAY_VARIANCE * 2 - CONTENT_CONFIG.TYPING_DELAY_VARIANCE;
  return Math.max(5, CONTENT_CONFIG.TYPING_DELAY + variance);
}

/**
 * Format date for different input types
 * @param {string} date - Date string
 * @param {string} inputFormat - Input format hint
 * @param {string} inputType - HTML input type
 * @returns {string} Formatted date
 */
function formatDateForInput(date, inputFormat, inputType) {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return date; // Return as-is if invalid
    }

    if (inputType === 'date') {
      return d.toISOString().split('T')[0];
    }

    if (inputType === 'datetime-local') {
      return d.toISOString().slice(0, 16);
    }

    // For text inputs, use locale format
    return d.toLocaleDateString();
  } catch {
    return date;
  }
}

/**
 * Find error message associated with a field
 * @param {HTMLElement} field - Field element
 * @returns {string|null} Error message
 */
function findFieldErrorMessage(field) {
  // Check aria-describedby for error
  const describedBy = field.getAttribute('aria-describedby');
  if (describedBy) {
    const errorEl = document.getElementById(describedBy);
    if (errorEl && errorEl.textContent.trim()) {
      return errorEl.textContent.trim();
    }
  }

  // Check for sibling error elements
  const errorSelectors = [
    '.error', '.error-message', '.field-error', '.invalid-feedback',
    '[class*="error"]', '[class*="invalid"]', '[role="alert"]'
  ];

  // Check next sibling
  let sibling = field.nextElementSibling;
  for (let i = 0; i < 3 && sibling; i++) {
    for (const selector of errorSelectors) {
      if (sibling.matches(selector) && sibling.textContent.trim()) {
        return sibling.textContent.trim();
      }
    }
    sibling = sibling.nextElementSibling;
  }

  // Check parent for error message
  const parent = field.closest('.form-group, .field, .input-wrapper, [class*="field"]');
  if (parent) {
    const errorEl = parent.querySelector(errorSelectors.join(', '));
    if (errorEl && errorEl.textContent.trim()) {
      return errorEl.textContent.trim();
    }
  }

  return null;
}

/**
 * Find form-level error messages
 * @param {HTMLFormElement} form - Form element
 * @returns {Array} Error messages
 */
function findFormErrorMessages(form) {
  const errors = [];

  const errorSelectors = [
    '.form-error', '.form-errors', '.alert-error', '.alert-danger',
    '[class*="form-error"]', '[role="alert"]', '.error-summary'
  ];

  const errorElements = form.querySelectorAll(errorSelectors.join(', '));
  for (const el of errorElements) {
    const text = el.textContent.trim();
    if (text && !errors.includes(text)) {
      errors.push(text);
    }
  }

  return errors;
}

// =============================================================================
// Element Finding Helpers
// =============================================================================

/**
 * Find an element using multiple strategies
 * @param {string} selector - Selector string (can be CSS, ID, name, etc.)
 * @returns {HTMLElement|null} - Found element or null
 */
function findElement(selector) {
  if (!selector || typeof selector !== 'string') {
    return null;
  }

  // Trim and validate selector - reject empty/whitespace-only selectors
  const trimmedSelector = selector.trim();
  if (trimmedSelector.length === 0) {
    contentLogger.warn('Empty selector provided');
    return null;
  }

  // Try exact CSS selector first
  try {
    const element = document.querySelector(trimmedSelector);
    if (element) return element;
  } catch (e) {
    // Invalid selector, continue with variations
    contentLogger.debug('Invalid CSS selector, trying variations', { selector: trimmedSelector });
  }

  // Try variations using trimmed selector
  const variations = [
    trimmedSelector,                              // Original
    `#${CSS.escape(trimmedSelector)}`,            // As ID
    `[name="${CSS.escape(trimmedSelector)}"]`,    // By name attribute
    `[id="${CSS.escape(trimmedSelector)}"]`,      // By id attribute (escaped)
    `[data-testid="${CSS.escape(trimmedSelector)}"]`, // By test ID
    `[aria-label="${CSS.escape(trimmedSelector)}"]`,  // By aria-label
  ];

  // Try placeholder variations for inputs
  variations.push(
    `input[placeholder*="${CSS.escape(trimmedSelector)}"]`,
    `textarea[placeholder*="${CSS.escape(trimmedSelector)}"]`
  );

  // Try text content for buttons/links
  for (const variation of variations) {
    try {
      const element = document.querySelector(variation);
      if (element) {
        contentLogger.debug('Found element using variation', { original: selector, matched: variation });
        return element;
      }
    } catch (e) {
      // Invalid selector, try next
    }
  }

  // Try finding by visible text for buttons and links
  const textElement = findElementByText(trimmedSelector);
  if (textElement) {
    contentLogger.debug('Found element by text content', { selector: trimmedSelector });
    return textElement;
  }

  return null;
}

/**
 * Find element by visible text content
 * @param {string} text - Text to search for
 * @returns {HTMLElement|null} - Found element or null
 */
function findElementByText(text) {
  const normalizedText = text.toLowerCase().trim();

  // Search buttons
  const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"]');
  for (const button of buttons) {
    const buttonText = (button.innerText || button.value || '').toLowerCase().trim();
    if (buttonText === normalizedText || buttonText.includes(normalizedText)) {
      return button;
    }
  }

  // Search links
  const links = document.querySelectorAll('a');
  for (const link of links) {
    const linkText = link.innerText.toLowerCase().trim();
    if (linkText === normalizedText || linkText.includes(normalizedText)) {
      return link;
    }
  }

  // Search labels (return associated input)
  const labels = document.querySelectorAll('label');
  for (const label of labels) {
    const labelText = label.innerText.toLowerCase().trim();
    if (labelText === normalizedText || labelText.includes(normalizedText)) {
      const forId = label.getAttribute('for');
      if (forId) {
        const input = document.getElementById(forId);
        if (input) return input;
      }
      // Check for nested input
      const nestedInput = label.querySelector('input, textarea, select');
      if (nestedInput) return nestedInput;
    }
  }

  return null;
}

// =============================================================================
// Selector Generation
// =============================================================================

/**
 * Generate a unique CSS selector for an element
 * @param {HTMLElement} element - Element to generate selector for
 * @returns {string} - CSS selector
 */
function generateSelector(element) {
  if (!element) return '';

  // Prefer ID
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  // Prefer name for form elements
  if (element.name && isFormElement(element)) {
    return `[name="${CSS.escape(element.name)}"]`;
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

  while (current && current !== document.body && depth < CONTENT_CONFIG.MAX_SELECTOR_DEPTH) {
    let selector = current.tagName.toLowerCase();

    // Add ID if available
    if (current.id) {
      selector = `#${CSS.escape(current.id)}`;
      path.unshift(selector);
      break; // ID is unique, stop here
    }

    // Add nth-child for uniqueness if needed
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
 * Check if element is a form element
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} - True if form element
 */
function isFormElement(element) {
  const formTags = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'];
  return formTags.includes(element.tagName);
}

// =============================================================================
// Label Finding
// =============================================================================

/**
 * Find the label associated with an element
 * @param {HTMLElement} element - Element to find label for
 * @returns {string|null} - Label text or null
 */
function findLabel(element) {
  // Check for label with 'for' attribute
  if (element.id) {
    const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
    if (label) {
      return label.innerText.trim();
    }
  }

  // Check for wrapping label
  const parentLabel = element.closest('label');
  if (parentLabel) {
    // Get label text, excluding the input's value
    const clone = parentLabel.cloneNode(true);
    const inputs = clone.querySelectorAll('input, textarea, select');
    inputs.forEach(input => input.remove());
    return clone.innerText.trim();
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
      return labelElement.innerText.trim();
    }
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

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Escape CSS special characters in a string
 * Note: CSS.escape is used where available, this is a fallback
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeCSSString(str) {
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(str);
  }
  // Fallback escape
  return str.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

// =============================================================================
// Initialization
// =============================================================================

// Log that content script has loaded
contentLogger.info('Content script initialized', {
  url: window.location.href,
  readyState: document.readyState
});

// Notify background script that content script is ready
try {
  chrome.runtime.sendMessage({
    type: 'content_script_ready',
    url: window.location.href,
    timestamp: Date.now()
  });
} catch (error) {
  // Extension context might be invalidated, ignore
  contentLogger.debug('Could not notify background of ready state');
}
