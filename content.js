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
// Form Detector, CAPTCHA Detector, and Template Mapper Initialization
// =============================================================================

// FormDetector, CaptchaDetector, and TemplateMapper are loaded via manifest.json content_scripts
let formDetector = null;
let captchaDetector = null;
let templateMapper = null;

// Rate limiter manager for bot detection evasion
// RateLimiterManager is loaded via manifest.json content_scripts
let contentRateLimiter = null;

// Initialize form utilities when available
function initFormUtilities() {
  if (typeof FormDetector !== 'undefined' && !formDetector) {
    formDetector = new FormDetector({ logger: contentLogger });
    contentLogger.debug('FormDetector initialized');
  }
  if (typeof CaptchaDetector !== 'undefined' && !captchaDetector) {
    captchaDetector = new CaptchaDetector({ logger: contentLogger });
    contentLogger.debug('CaptchaDetector initialized');
  }
  if (typeof TemplateMapper !== 'undefined' && !templateMapper) {
    templateMapper = new TemplateMapper();
    contentLogger.debug('TemplateMapper initialized');
  }
  if (typeof RateLimiterManager !== 'undefined' && !contentRateLimiter) {
    contentRateLimiter = new RateLimiterManager();
    contentLogger.debug('RateLimiterManager initialized');
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

    case 'get_file_inputs':
      return handleGetFileInputs(request.options);

    case 'upload_file':
      return handleFileUpload(request.selector, {
        fileName: request.fileName,
        fileContent: request.fileContent,
        mimeType: request.mimeType,
        files: request.files
      });

    case 'trigger_file_dialog':
      return handleTriggerFileDialog(request.selector);

    case 'navigate_multi_step':
      return handleNavigateMultiStep(request.formSelector, request.direction);

    case 'get_multi_step_info':
      return handleGetMultiStepInfo(request.formSelector);

    // Frame/iframe related commands
    case 'get_frames':
      return handleGetFrames(request.options);

    case 'get_frame_info':
      return handleGetFrameInfo();

    // CAPTCHA detection commands
    case 'detect_captcha':
      return handleDetectCaptcha(request.options);

    case 'get_captcha_state':
      return handleGetCaptchaState(request.selector);

    // Date picker commands
    case 'get_date_pickers':
      return handleDetectDatePickers();

    case 'get_date_picker_type':
      return handleGetDatePickerType(request.selector);

    case 'set_date':
      return handleSetDateValue(request.selector, request.date, request.format);

    case 'open_date_picker':
      return handleOpenDatePicker(request.selector);

    case 'select_calendar_date':
      return handleSelectCalendarDate(request.selector, request.date);

    // Shadow DOM commands
    case 'get_shadow_dom_info':
      return handleGetShadowDOMInfo();

    // Dynamic form handling commands
    case 'observe_form_changes':
      return handleObserveFormChanges(request.options);

    case 'wait_for_dynamic_field':
      return handleWaitForDynamicField(request.selector, request.timeout);

    case 'detect_ajax_loading':
      return handleDetectAjaxLoading();

    case 'wait_for_form_stable':
      return handleWaitForFormStable(request.timeout, request.stabilityThreshold);

    case 'get_dynamic_fields':
      return handleGetDynamicFields();

    case 'fill_dynamic_field':
      return handleFillDynamicField(request.selector, request.value, request.options);

    // Wizard/Multi-step form commands
    case 'detect_wizard':
      return handleDetectWizard();

    case 'get_wizard_state':
      return handleGetWizardState(request.formSelector);

    case 'wizard_next':
      return handleWizardNext(request.formSelector);

    case 'wizard_previous':
      return handleWizardPrevious(request.formSelector);

    case 'fill_wizard_step':
      return handleFillWizardStep(request.data, request.options);

    case 'is_last_step':
      return handleIsLastStep(request.formSelector);

    case 'get_submit_button':
      return handleGetSubmitButton(request.formSelector);

    case 'submit_wizard':
      return handleSubmitWizard(request.formSelector, request.options);

    // Multi-select handling commands
    case 'get_select_elements':
      return handleGetSelectElements(request.options);

    case 'get_select_options':
      return handleGetSelectOptions(request.selector);

    case 'set_select_value':
      return handleSetSelectValue(request.selector, request.value, request.options);

    case 'set_multi_select_values':
      return handleSetMultiSelectValues(request.selector, request.values, request.options);

    case 'clear_select_selection':
      return handleClearSelectSelection(request.selector);

    // User agent override commands
    case 'override_user_agent':
      return handleOverrideUserAgent(request.userAgent);

    case 'reset_user_agent':
      return handleResetUserAgent();

    // Rate limiting commands
    case 'set_rate_limit':
      return handleSetRateLimitConfig(request.actionType, request.config);

    case 'pause_rate_limiter':
      return handlePauseRateLimiter(request.actionType);

    case 'resume_rate_limiter':
      return handleResumeRateLimiter(request.actionType);

    case 'get_rate_limit_stats':
      return handleGetRateLimitStats(request.actionType);

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
    // Apply rate limiting for typing action
    if (contentRateLimiter) {
      await contentRateLimiter.wait('typing');
    } else {
      // Fall back to default delay if rate limiter not initialized
      await sleep(CONTENT_CONFIG.TYPING_DELAY);
    }

    element.value += char;

    // Dispatch input event for each character
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: char
    }));
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
    // Apply rate limiting for click action
    if (contentRateLimiter) {
      await contentRateLimiter.wait('click');
    }

    // Apply rate limiting for scroll action
    if (contentRateLimiter) {
      await contentRateLimiter.wait('scroll');
    }

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

    // Detect CAPTCHAs on the page
    let captchaInfo = null;
    if (captchaDetector) {
      try {
        captchaInfo = captchaDetector.getSummary();
      } catch (e) {
        contentLogger.warn('CAPTCHA detection failed', { error: e.message });
      }
    }

    return {
      success: true,
      url: window.location.href,
      title: document.title,
      forms,
      links,
      buttons,
      standaloneInputs,
      captcha: captchaInfo,
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
 * Supports both CSS selectors and XPath expressions
 * @param {string} selector - CSS selector or XPath expression
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<HTMLElement>} - Found element
 */
function waitForElement(selector, timeout = CONTENT_CONFIG.DEFAULT_WAIT_TIMEOUT) {
  return new Promise((resolve, reject) => {
    // Helper function to find element using appropriate strategy
    // Note: isXPathSelector and evaluateXPath are defined later in the file
    // but are hoisted, so they can be called here
    const findElementBySelector = (sel) => {
      // Check if it's an XPath selector
      if (isXPathSelector(sel)) {
        return evaluateXPath(sel);
      }
      // Otherwise use CSS querySelector
      try {
        return document.querySelector(sel);
      } catch (e) {
        return null;
      }
    };

    // Check if element already exists
    const existing = findElementBySelector(selector);
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
      const element = findElementBySelector(selector);
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

// =============================================================================
// Multi-Select Element Handling
// =============================================================================

/**
 * Find all select elements on the page (single and multiple)
 * Also detects enhanced select libraries like Select2, Chosen, etc.
 * @param {Object} options - Search options
 * @param {boolean} options.includeHidden - Include hidden elements (default: false)
 * @param {boolean} options.includeEnhanced - Include enhanced selects like Select2/Chosen (default: true)
 * @returns {Array} Array of select element info
 */
function findSelectElements(options = {}) {
  const { includeHidden = false, includeEnhanced = true } = options;
  const results = [];

  // Find all native select elements
  const selects = document.querySelectorAll('select');

  for (const select of selects) {
    // Skip hidden elements unless requested
    if (!includeHidden && !isElementVisible(select)) {
      continue;
    }

    const selectInfo = {
      selector: generateSelector(select),
      id: select.id || null,
      name: select.name || null,
      multiple: select.multiple,
      disabled: select.disabled,
      required: select.required,
      optionCount: select.options.length,
      selectedCount: select.selectedOptions.length,
      selectedValues: Array.from(select.selectedOptions).map(o => o.value),
      selectedTexts: Array.from(select.selectedOptions).map(o => o.text),
      isVisible: isElementVisible(select),
      enhancedType: null,
      label: findLabelForElement(select)
    };

    // Detect enhanced select libraries
    if (includeEnhanced) {
      selectInfo.enhancedType = detectEnhancedSelectType(select);
    }

    results.push(selectInfo);
  }

  // Also detect standalone enhanced selects (like Select2 that may hide the original)
  if (includeEnhanced) {
    // Select2 containers
    const select2Containers = document.querySelectorAll('.select2-container');
    for (const container of select2Containers) {
      // Check if we already have the associated select
      const associatedSelect = container.previousElementSibling;
      if (associatedSelect && associatedSelect.tagName === 'SELECT') {
        continue; // Already captured
      }

      // Get the data from the container
      const selection = container.querySelector('.select2-selection');
      if (selection && (includeHidden || isElementVisible(container))) {
        results.push({
          selector: generateSelector(container),
          id: container.id || null,
          name: null,
          multiple: container.classList.contains('select2-container--multiple'),
          disabled: container.classList.contains('select2-container--disabled'),
          required: false,
          optionCount: null, // Can't determine without opening
          selectedCount: null,
          selectedValues: [],
          selectedTexts: getSelect2SelectedTexts(container),
          isVisible: isElementVisible(container),
          enhancedType: 'select2',
          label: null
        });
      }
    }

    // Chosen containers
    const chosenContainers = document.querySelectorAll('.chosen-container');
    for (const container of chosenContainers) {
      const associatedSelect = container.previousElementSibling;
      if (associatedSelect && associatedSelect.tagName === 'SELECT') {
        continue; // Already captured
      }

      if (includeHidden || isElementVisible(container)) {
        results.push({
          selector: generateSelector(container),
          id: container.id || null,
          name: null,
          multiple: container.classList.contains('chosen-container-multi'),
          disabled: container.classList.contains('chosen-disabled'),
          required: false,
          optionCount: null,
          selectedCount: null,
          selectedValues: [],
          selectedTexts: getChosenSelectedTexts(container),
          isVisible: isElementVisible(container),
          enhancedType: 'chosen',
          label: null
        });
      }
    }
  }

  return results;
}

/**
 * Detect the type of enhanced select library used
 * @param {HTMLSelectElement} select - The select element
 * @returns {string|null} The enhanced type or null
 */
function detectEnhancedSelectType(select) {
  // Check for Select2
  if (select.classList.contains('select2-hidden-accessible') ||
      select.nextElementSibling?.classList.contains('select2-container') ||
      window.jQuery && window.jQuery(select).data('select2')) {
    return 'select2';
  }

  // Check for Chosen
  if (select.classList.contains('chosen-select') ||
      select.classList.contains('chzn-select') ||
      select.nextElementSibling?.classList.contains('chosen-container')) {
    return 'chosen';
  }

  // Check for Bootstrap Select
  if (select.classList.contains('selectpicker') ||
      select.parentElement?.classList.contains('bootstrap-select')) {
    return 'bootstrap-select';
  }

  // Check for Tom Select
  if (select.classList.contains('tomselected') ||
      select.nextElementSibling?.classList.contains('ts-wrapper')) {
    return 'tom-select';
  }

  // Check for Slim Select
  if (select.classList.contains('ss-main') ||
      select.nextElementSibling?.classList.contains('ss-main')) {
    return 'slim-select';
  }

  return null;
}

/**
 * Get selected texts from Select2 container
 * @param {HTMLElement} container - Select2 container
 * @returns {Array} Array of selected text values
 */
function getSelect2SelectedTexts(container) {
  const texts = [];

  // For multiple select
  const choices = container.querySelectorAll('.select2-selection__choice');
  for (const choice of choices) {
    const text = choice.textContent?.replace(/\u00d7/g, '').trim(); // Remove X button text
    if (text) texts.push(text);
  }

  // For single select
  if (texts.length === 0) {
    const rendered = container.querySelector('.select2-selection__rendered');
    if (rendered && rendered.textContent) {
      texts.push(rendered.textContent.trim());
    }
  }

  return texts;
}

/**
 * Get selected texts from Chosen container
 * @param {HTMLElement} container - Chosen container
 * @returns {Array} Array of selected text values
 */
function getChosenSelectedTexts(container) {
  const texts = [];

  // For multiple select
  const choices = container.querySelectorAll('.search-choice span');
  for (const choice of choices) {
    if (choice.textContent) texts.push(choice.textContent.trim());
  }

  // For single select
  if (texts.length === 0) {
    const single = container.querySelector('.chosen-single span');
    if (single && single.textContent) {
      texts.push(single.textContent.trim());
    }
  }

  return texts;
}

/**
 * Find label for an element
 * @param {HTMLElement} element - The element
 * @returns {string|null} Label text or null
 */
function findLabelForElement(element) {
  // Check for associated label via id
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) return label.textContent.trim();
  }

  // Check for parent label
  const parentLabel = element.closest('label');
  if (parentLabel) {
    return parentLabel.textContent.replace(element.textContent || '', '').trim();
  }

  // Check for aria-label
  if (element.getAttribute('aria-label')) {
    return element.getAttribute('aria-label');
  }

  // Check for aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelElement = document.getElementById(labelledBy);
    if (labelElement) return labelElement.textContent.trim();
  }

  return null;
}

/**
 * Check if element is visible
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} Whether the element is visible
 */
function isElementVisible(element) {
  if (!element) return false;

  const style = window.getComputedStyle(element);
  return style.display !== 'none' &&
         style.visibility !== 'hidden' &&
         style.opacity !== '0' &&
         element.offsetParent !== null;
}

/**
 * Handler for get_select_elements message
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Result with select elements
 */
async function handleGetSelectElements(options = {}) {
  contentLogger.info('Getting select elements', options);

  try {
    const selectElements = findSelectElements(options);

    return {
      success: true,
      count: selectElements.length,
      selects: selectElements
    };
  } catch (error) {
    contentLogger.error('Failed to get select elements', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all options for a select element
 * @param {string} selector - CSS selector for the select element
 * @returns {Array} Array of option info objects
 */
function getSelectOptions(selector) {
  const select = findElement(selector);

  if (!select) {
    return null;
  }

  // Handle native select
  if (select.tagName === 'SELECT') {
    return Array.from(select.options).map((option, index) => ({
      value: option.value,
      text: option.text,
      selected: option.selected,
      disabled: option.disabled,
      index: index,
      group: option.parentElement?.tagName === 'OPTGROUP'
        ? option.parentElement.label
        : null
    }));
  }

  // Handle Select2
  if (select.classList.contains('select2-container') ||
      select.nextElementSibling?.classList.contains('select2-container')) {
    return getSelect2Options(select);
  }

  // Handle Chosen
  if (select.classList.contains('chosen-container') ||
      select.nextElementSibling?.classList.contains('chosen-container')) {
    return getChosenOptions(select);
  }

  return null;
}

/**
 * Get options from Select2 enhanced select
 * @param {HTMLElement} element - Select2 element or container
 * @returns {Array} Array of option info
 */
function getSelect2Options(element) {
  // Try to find the original select
  let originalSelect = element;
  if (!element.tagName || element.tagName !== 'SELECT') {
    originalSelect = element.previousElementSibling;
  }

  if (originalSelect && originalSelect.tagName === 'SELECT') {
    return Array.from(originalSelect.options).map((option, index) => ({
      value: option.value,
      text: option.text,
      selected: option.selected,
      disabled: option.disabled,
      index: index,
      group: option.parentElement?.tagName === 'OPTGROUP'
        ? option.parentElement.label
        : null
    }));
  }

  // If we can't find the original, try to get from Select2 data
  if (window.jQuery && window.jQuery(originalSelect).data('select2')) {
    try {
      const data = window.jQuery(originalSelect).select2('data');
      return data.map((item, index) => ({
        value: item.id,
        text: item.text,
        selected: item.selected || false,
        disabled: item.disabled || false,
        index: index,
        group: null
      }));
    } catch (e) {
      contentLogger.debug('Failed to get Select2 data', e);
    }
  }

  return [];
}

/**
 * Get options from Chosen enhanced select
 * @param {HTMLElement} element - Chosen element or container
 * @returns {Array} Array of option info
 */
function getChosenOptions(element) {
  // Try to find the original select
  let originalSelect = element;
  if (!element.tagName || element.tagName !== 'SELECT') {
    originalSelect = element.previousElementSibling;
  }

  if (originalSelect && originalSelect.tagName === 'SELECT') {
    return Array.from(originalSelect.options).map((option, index) => ({
      value: option.value,
      text: option.text,
      selected: option.selected,
      disabled: option.disabled,
      index: index,
      group: option.parentElement?.tagName === 'OPTGROUP'
        ? option.parentElement.label
        : null
    }));
  }

  return [];
}

/**
 * Handler for get_select_options message
 * @param {string} selector - CSS selector for the select element
 * @returns {Promise<Object>} Result with options
 */
async function handleGetSelectOptions(selector) {
  contentLogger.info('Getting select options', { selector });

  try {
    if (!selector) {
      return { success: false, error: 'Selector is required' };
    }

    const options = getSelectOptions(selector);

    if (options === null) {
      return { success: false, error: 'Select element not found' };
    }

    return {
      success: true,
      count: options.length,
      options: options
    };
  } catch (error) {
    contentLogger.error('Failed to get select options', error);
    return { success: false, error: error.message };
  }
}

/**
 * Set value for a single select element
 * Supports native selects and enhanced libraries
 * @param {string} selector - CSS selector for the select element
 * @param {string|number} value - Value to select
 * @param {Object} options - Options
 * @param {boolean} options.byText - Select by text instead of value
 * @param {boolean} options.byIndex - Select by index
 * @param {boolean} options.humanLike - Use human-like interactions
 * @returns {Object} Result object
 */
async function setSelectValue(selector, value, options = {}) {
  const { byText = false, byIndex = false, humanLike = true } = options;

  const select = findElement(selector);
  if (!select) {
    return { success: false, error: 'Select element not found' };
  }

  // Detect enhanced type
  const enhancedType = detectEnhancedSelectType(select);

  // Handle enhanced select libraries
  if (enhancedType === 'select2') {
    return await setSelect2Value(select, value, { byText, byIndex });
  }
  if (enhancedType === 'chosen') {
    return await setChosenValue(select, value, { byText, byIndex });
  }

  // Handle native select
  if (select.tagName !== 'SELECT') {
    return { success: false, error: 'Element is not a select' };
  }

  // Scroll into view
  select.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(CONTENT_CONFIG.SCROLL_WAIT);

  // Focus the select
  select.focus();
  await sleep(CONTENT_CONFIG.FOCUS_DELAY);

  // Open dropdown for human-like behavior
  if (humanLike) {
    select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await sleep(CONTENT_CONFIG.DROPDOWN_WAIT);
  }

  // Find the option
  let option;
  if (byIndex) {
    const index = parseInt(value, 10);
    if (index >= 0 && index < select.options.length) {
      option = select.options[index];
    }
  } else if (byText) {
    option = Array.from(select.options).find(
      opt => opt.text.toLowerCase().includes(String(value).toLowerCase())
    );
  } else {
    option = Array.from(select.options).find(
      opt => opt.value === String(value)
    );
    // Fallback to partial match
    if (!option) {
      option = Array.from(select.options).find(
        opt => opt.value.includes(String(value)) || opt.text.includes(String(value))
      );
    }
  }

  if (!option) {
    return {
      success: false,
      error: 'Option not found',
      availableOptions: Array.from(select.options).map(o => ({
        value: o.value,
        text: o.text,
        index: o.index
      }))
    };
  }

  // Set the value
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
    selectedIndex: option.index
  };
}

/**
 * Set value for Select2 enhanced select
 * @param {HTMLSelectElement} select - The select element
 * @param {string|number} value - Value to select
 * @param {Object} options - Options
 * @returns {Object} Result object
 */
async function setSelect2Value(select, value, options = {}) {
  const { byText = false, byIndex = false } = options;

  try {
    let targetValue = value;

    // Find value by text or index if needed
    if (byText || byIndex) {
      const opts = Array.from(select.options);
      let option;
      if (byIndex) {
        option = opts[parseInt(value, 10)];
      } else {
        option = opts.find(o => o.text.toLowerCase().includes(String(value).toLowerCase()));
      }
      if (!option) {
        return { success: false, error: 'Option not found' };
      }
      targetValue = option.value;
    }

    // Use jQuery Select2 API if available
    if (window.jQuery && window.jQuery(select).data('select2')) {
      window.jQuery(select).val(targetValue).trigger('change');

      return {
        success: true,
        selectedValue: targetValue,
        enhancedType: 'select2'
      };
    }

    // Fallback to native approach
    select.value = targetValue;
    select.dispatchEvent(new Event('change', { bubbles: true }));

    return {
      success: true,
      selectedValue: targetValue,
      enhancedType: 'select2'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Set value for Chosen enhanced select
 * @param {HTMLSelectElement} select - The select element
 * @param {string|number} value - Value to select
 * @param {Object} options - Options
 * @returns {Object} Result object
 */
async function setChosenValue(select, value, options = {}) {
  const { byText = false, byIndex = false } = options;

  try {
    let targetValue = value;

    // Find value by text or index if needed
    if (byText || byIndex) {
      const opts = Array.from(select.options);
      let option;
      if (byIndex) {
        option = opts[parseInt(value, 10)];
      } else {
        option = opts.find(o => o.text.toLowerCase().includes(String(value).toLowerCase()));
      }
      if (!option) {
        return { success: false, error: 'Option not found' };
      }
      targetValue = option.value;
    }

    // Set the value
    select.value = targetValue;

    // Trigger Chosen update
    if (window.jQuery) {
      window.jQuery(select).trigger('chosen:updated');
    }
    select.dispatchEvent(new Event('change', { bubbles: true }));

    return {
      success: true,
      selectedValue: targetValue,
      enhancedType: 'chosen'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Handler for set_select_value message
 * @param {string} selector - CSS selector for the select element
 * @param {string|number} value - Value to select
 * @param {Object} options - Options
 * @returns {Promise<Object>} Result object
 */
async function handleSetSelectValue(selector, value, options = {}) {
  contentLogger.info('Setting select value', { selector, value, options });

  try {
    if (!selector) {
      return { success: false, error: 'Selector is required' };
    }

    const result = await setSelectValue(selector, value, options);
    return { ...result, selector };
  } catch (error) {
    contentLogger.error('Failed to set select value', error);
    return { success: false, error: error.message };
  }
}

/**
 * Set multiple values for a multi-select element
 * Supports Ctrl+click and Shift+click behavior simulation
 * @param {string} selector - CSS selector for the select element
 * @param {Array} values - Array of values to select
 * @param {Object} options - Options
 * @param {boolean} options.byText - Select by text instead of value
 * @param {boolean} options.byIndex - Select by indices
 * @param {boolean} options.additive - Add to existing selection (Ctrl+click behavior)
 * @param {boolean} options.range - Select range (Shift+click behavior, uses first two values)
 * @param {boolean} options.humanLike - Use human-like interactions
 * @returns {Object} Result object
 */
async function setMultiSelectValues(selector, values, options = {}) {
  const {
    byText = false,
    byIndex = false,
    additive = false,
    range = false,
    humanLike = true
  } = options;

  const select = findElement(selector);
  if (!select) {
    return { success: false, error: 'Select element not found' };
  }

  // Detect enhanced type
  const enhancedType = detectEnhancedSelectType(select);

  // Handle enhanced select libraries
  if (enhancedType === 'select2') {
    return await setSelect2MultiValues(select, values, { byText, byIndex, additive });
  }
  if (enhancedType === 'chosen') {
    return await setChosenMultiValues(select, values, { byText, byIndex, additive });
  }

  // Handle native select
  if (select.tagName !== 'SELECT') {
    return { success: false, error: 'Element is not a select' };
  }

  if (!select.multiple) {
    return { success: false, error: 'Select is not a multi-select. Use set_select_value instead.' };
  }

  // Scroll into view
  select.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(CONTENT_CONFIG.SCROLL_WAIT);

  // Focus the select
  select.focus();
  await sleep(CONTENT_CONFIG.FOCUS_DELAY);

  // Clear existing selections unless additive
  if (!additive) {
    for (const option of select.options) {
      option.selected = false;
    }
  }

  const selectedOptions = [];
  const notFoundValues = [];

  if (range && values.length >= 2) {
    // Range selection (Shift+click behavior)
    let startIndex, endIndex;

    if (byIndex) {
      startIndex = parseInt(values[0], 10);
      endIndex = parseInt(values[1], 10);
    } else {
      // Find indices by value or text
      const opts = Array.from(select.options);
      const findOption = (val) => {
        if (byText) {
          return opts.findIndex(o => o.text.toLowerCase().includes(String(val).toLowerCase()));
        }
        return opts.findIndex(o => o.value === String(val));
      };
      startIndex = findOption(values[0]);
      endIndex = findOption(values[1]);
    }

    if (startIndex === -1 || endIndex === -1) {
      return {
        success: false,
        error: 'Range start or end not found',
        startIndex,
        endIndex
      };
    }

    // Ensure start <= end
    if (startIndex > endIndex) {
      [startIndex, endIndex] = [endIndex, startIndex];
    }

    // Select the range
    for (let i = startIndex; i <= endIndex; i++) {
      select.options[i].selected = true;
      selectedOptions.push({
        value: select.options[i].value,
        text: select.options[i].text,
        index: i
      });
    }
  } else {
    // Individual selection (Ctrl+click behavior)
    for (const value of values) {
      let option;

      if (byIndex) {
        const index = parseInt(value, 10);
        if (index >= 0 && index < select.options.length) {
          option = select.options[index];
        }
      } else if (byText) {
        option = Array.from(select.options).find(
          opt => opt.text.toLowerCase().includes(String(value).toLowerCase())
        );
      } else {
        option = Array.from(select.options).find(
          opt => opt.value === String(value)
        );
        // Fallback to partial match
        if (!option) {
          option = Array.from(select.options).find(
            opt => opt.value.includes(String(value)) || opt.text.includes(String(value))
          );
        }
      }

      if (option) {
        option.selected = true;
        selectedOptions.push({
          value: option.value,
          text: option.text,
          index: option.index
        });
      } else {
        notFoundValues.push(value);
      }
    }
  }

  // Dispatch events
  select.dispatchEvent(new Event('change', { bubbles: true }));
  select.dispatchEvent(new Event('input', { bubbles: true }));

  if (humanLike) {
    await sleep(CONTENT_CONFIG.DROPDOWN_WAIT);
  }

  select.blur();

  return {
    success: notFoundValues.length === 0,
    selectedCount: selectedOptions.length,
    selectedOptions: selectedOptions,
    notFoundValues: notFoundValues.length > 0 ? notFoundValues : undefined,
    totalSelected: select.selectedOptions.length
  };
}

/**
 * Set multiple values for Select2 enhanced select
 * @param {HTMLSelectElement} select - The select element
 * @param {Array} values - Values to select
 * @param {Object} options - Options
 * @returns {Object} Result object
 */
async function setSelect2MultiValues(select, values, options = {}) {
  const { byText = false, byIndex = false, additive = false } = options;

  try {
    let targetValues = [];

    // Map values if needed
    const opts = Array.from(select.options);
    for (const value of values) {
      let targetValue;
      if (byIndex) {
        const option = opts[parseInt(value, 10)];
        targetValue = option?.value;
      } else if (byText) {
        const option = opts.find(o => o.text.toLowerCase().includes(String(value).toLowerCase()));
        targetValue = option?.value;
      } else {
        targetValue = value;
      }
      if (targetValue !== undefined) {
        targetValues.push(targetValue);
      }
    }

    // Get current values if additive
    if (additive && window.jQuery && window.jQuery(select).data('select2')) {
      const currentValues = window.jQuery(select).val() || [];
      targetValues = [...new Set([...currentValues, ...targetValues])];
    }

    // Use jQuery Select2 API if available
    if (window.jQuery && window.jQuery(select).data('select2')) {
      window.jQuery(select).val(targetValues).trigger('change');

      return {
        success: true,
        selectedValues: targetValues,
        selectedCount: targetValues.length,
        enhancedType: 'select2'
      };
    }

    // Fallback to native approach
    for (const option of select.options) {
      option.selected = targetValues.includes(option.value);
    }
    select.dispatchEvent(new Event('change', { bubbles: true }));

    return {
      success: true,
      selectedValues: targetValues,
      selectedCount: targetValues.length,
      enhancedType: 'select2'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Set multiple values for Chosen enhanced select
 * @param {HTMLSelectElement} select - The select element
 * @param {Array} values - Values to select
 * @param {Object} options - Options
 * @returns {Object} Result object
 */
async function setChosenMultiValues(select, values, options = {}) {
  const { byText = false, byIndex = false, additive = false } = options;

  try {
    let targetValues = [];

    // Map values if needed
    const opts = Array.from(select.options);
    for (const value of values) {
      let targetValue;
      if (byIndex) {
        const option = opts[parseInt(value, 10)];
        targetValue = option?.value;
      } else if (byText) {
        const option = opts.find(o => o.text.toLowerCase().includes(String(value).toLowerCase()));
        targetValue = option?.value;
      } else {
        targetValue = value;
      }
      if (targetValue !== undefined) {
        targetValues.push(targetValue);
      }
    }

    // Get current values if additive
    if (additive) {
      const currentValues = Array.from(select.selectedOptions).map(o => o.value);
      targetValues = [...new Set([...currentValues, ...targetValues])];
    }

    // Set values
    for (const option of select.options) {
      option.selected = targetValues.includes(option.value);
    }

    // Trigger Chosen update
    if (window.jQuery) {
      window.jQuery(select).trigger('chosen:updated');
    }
    select.dispatchEvent(new Event('change', { bubbles: true }));

    return {
      success: true,
      selectedValues: targetValues,
      selectedCount: targetValues.length,
      enhancedType: 'chosen'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Handler for set_multi_select_values message
 * @param {string} selector - CSS selector for the select element
 * @param {Array} values - Values to select
 * @param {Object} options - Options
 * @returns {Promise<Object>} Result object
 */
async function handleSetMultiSelectValues(selector, values, options = {}) {
  contentLogger.info('Setting multi-select values', { selector, values, options });

  try {
    if (!selector) {
      return { success: false, error: 'Selector is required' };
    }

    if (!Array.isArray(values)) {
      return { success: false, error: 'Values must be an array' };
    }

    const result = await setMultiSelectValues(selector, values, options);
    return { ...result, selector };
  } catch (error) {
    contentLogger.error('Failed to set multi-select values', error);
    return { success: false, error: error.message };
  }
}

/**
 * Clear all selections from a select element
 * @param {string} selector - CSS selector for the select element
 * @returns {Object} Result object
 */
async function clearSelectSelection(selector) {
  const select = findElement(selector);
  if (!select) {
    return { success: false, error: 'Select element not found' };
  }

  // Detect enhanced type
  const enhancedType = detectEnhancedSelectType(select);

  // Handle enhanced select libraries
  if (enhancedType === 'select2') {
    return await clearSelect2Selection(select);
  }
  if (enhancedType === 'chosen') {
    return await clearChosenSelection(select);
  }

  // Handle native select
  if (select.tagName !== 'SELECT') {
    return { success: false, error: 'Element is not a select' };
  }

  const previousCount = select.selectedOptions.length;

  // Clear selections
  if (select.multiple) {
    for (const option of select.options) {
      option.selected = false;
    }
  } else {
    // For single select, select the first option (usually placeholder) or set to empty
    if (select.options.length > 0) {
      select.selectedIndex = 0;
    }
  }

  // Dispatch events
  select.dispatchEvent(new Event('change', { bubbles: true }));
  select.dispatchEvent(new Event('input', { bubbles: true }));

  return {
    success: true,
    previousCount: previousCount,
    currentCount: select.selectedOptions.length,
    multiple: select.multiple
  };
}

/**
 * Clear Select2 selection
 * @param {HTMLSelectElement} select - The select element
 * @returns {Object} Result object
 */
async function clearSelect2Selection(select) {
  try {
    const previousValues = Array.from(select.selectedOptions).map(o => o.value);

    if (window.jQuery && window.jQuery(select).data('select2')) {
      if (select.multiple) {
        window.jQuery(select).val([]).trigger('change');
      } else {
        window.jQuery(select).val(null).trigger('change');
      }

      return {
        success: true,
        previousCount: previousValues.length,
        currentCount: 0,
        enhancedType: 'select2'
      };
    }

    // Fallback
    for (const option of select.options) {
      option.selected = false;
    }
    select.dispatchEvent(new Event('change', { bubbles: true }));

    return {
      success: true,
      previousCount: previousValues.length,
      currentCount: select.selectedOptions.length,
      enhancedType: 'select2'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Clear Chosen selection
 * @param {HTMLSelectElement} select - The select element
 * @returns {Object} Result object
 */
async function clearChosenSelection(select) {
  try {
    const previousCount = select.selectedOptions.length;

    for (const option of select.options) {
      option.selected = false;
    }

    if (window.jQuery) {
      window.jQuery(select).trigger('chosen:updated');
    }
    select.dispatchEvent(new Event('change', { bubbles: true }));

    return {
      success: true,
      previousCount: previousCount,
      currentCount: select.selectedOptions.length,
      enhancedType: 'chosen'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Handler for clear_select_selection message
 * @param {string} selector - CSS selector for the select element
 * @returns {Promise<Object>} Result object
 */
async function handleClearSelectSelection(selector) {
  contentLogger.info('Clearing select selection', { selector });

  try {
    if (!selector) {
      return { success: false, error: 'Selector is required' };
    }

    const result = await clearSelectSelection(selector);
    return { ...result, selector };
  } catch (error) {
    contentLogger.error('Failed to clear select selection', error);
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

// =============================================================================
// Date Picker Detection and Handling
// =============================================================================

/**
 * Date picker library types
 */
const DatePickerTypes = {
  NATIVE: 'native',
  NATIVE_DATETIME: 'native_datetime',
  JQUERY_UI: 'jquery_ui',
  BOOTSTRAP: 'bootstrap',
  FLATPICKR: 'flatpickr',
  MATERIAL_UI: 'material_ui',
  REACT_DATEPICKER: 'react_datepicker',
  PIKADAY: 'pikaday',
  AIR_DATEPICKER: 'air_datepicker',
  LITEPICKER: 'litepicker',
  UNKNOWN: 'unknown'
};

/**
 * Detect all date pickers on the page
 * @returns {Promise<Object>} - Detection results with all date pickers
 */
async function handleDetectDatePickers() {
  contentLogger.info('Detecting date pickers');

  try {
    const datePickers = [];

    // 1. Native HTML5 date inputs
    const nativeDateInputs = document.querySelectorAll('input[type="date"]');
    nativeDateInputs.forEach((input, index) => {
      datePickers.push({
        type: DatePickerTypes.NATIVE,
        selector: generateSelector(input),
        index,
        inputType: 'date',
        value: input.value || null,
        min: input.min || null,
        max: input.max || null,
        required: input.required,
        disabled: input.disabled,
        name: input.name || null,
        id: input.id || null,
        label: findLabel(input),
        isVisible: isElementVisible(input),
        boundingBox: getElementBoundingBox(input)
      });
    });

    // 2. Native datetime-local inputs
    const nativeDatetimeInputs = document.querySelectorAll('input[type="datetime-local"]');
    nativeDatetimeInputs.forEach((input, index) => {
      datePickers.push({
        type: DatePickerTypes.NATIVE_DATETIME,
        selector: generateSelector(input),
        index: nativeDateInputs.length + index,
        inputType: 'datetime-local',
        value: input.value || null,
        min: input.min || null,
        max: input.max || null,
        required: input.required,
        disabled: input.disabled,
        name: input.name || null,
        id: input.id || null,
        label: findLabel(input),
        isVisible: isElementVisible(input),
        boundingBox: getElementBoundingBox(input)
      });
    });

    // 3. jQuery UI datepicker
    const jqueryUIInputs = document.querySelectorAll('.hasDatepicker, [data-datepicker], input.datepicker');
    jqueryUIInputs.forEach((input) => {
      // Skip if already detected as native
      if (input.type === 'date' || input.type === 'datetime-local') return;

      datePickers.push({
        type: DatePickerTypes.JQUERY_UI,
        selector: generateSelector(input),
        inputType: input.type || 'text',
        value: input.value || null,
        required: input.required,
        disabled: input.disabled,
        name: input.name || null,
        id: input.id || null,
        label: findLabel(input),
        isVisible: isElementVisible(input),
        boundingBox: getElementBoundingBox(input),
        hasJQueryUI: typeof window.jQuery !== 'undefined' && typeof window.jQuery.fn.datepicker !== 'undefined'
      });
    });

    // Check for jQuery UI datepicker container
    const jqueryUIContainer = document.querySelector('#ui-datepicker-div, .ui-datepicker');
    if (jqueryUIContainer) {
      datePickers.forEach(dp => {
        if (dp.type === DatePickerTypes.JQUERY_UI) {
          dp.containerSelector = generateSelector(jqueryUIContainer);
          dp.isCalendarOpen = isElementVisible(jqueryUIContainer);
        }
      });
    }

    // 4. Bootstrap datepicker
    const bootstrapInputs = document.querySelectorAll(
      '[data-provide="datepicker"], [data-toggle="datepicker"], .bootstrap-datepicker, ' +
      '.input-group.date input, .datepicker-input'
    );
    bootstrapInputs.forEach((input) => {
      // Skip if already detected
      const existingSelector = generateSelector(input);
      if (datePickers.some(dp => dp.selector === existingSelector)) return;

      datePickers.push({
        type: DatePickerTypes.BOOTSTRAP,
        selector: existingSelector,
        inputType: input.type || 'text',
        value: input.value || null,
        required: input.required,
        disabled: input.disabled,
        name: input.name || null,
        id: input.id || null,
        label: findLabel(input),
        isVisible: isElementVisible(input),
        boundingBox: getElementBoundingBox(input),
        format: input.getAttribute('data-date-format') || null
      });
    });

    // 5. Flatpickr
    const flatpickrInputs = document.querySelectorAll('.flatpickr-input, [data-flatpickr]');
    flatpickrInputs.forEach((input) => {
      const existingSelector = generateSelector(input);
      if (datePickers.some(dp => dp.selector === existingSelector)) return;

      const flatpickrInstance = input._flatpickr;
      datePickers.push({
        type: DatePickerTypes.FLATPICKR,
        selector: existingSelector,
        inputType: input.type || 'text',
        value: input.value || null,
        required: input.required,
        disabled: input.disabled,
        name: input.name || null,
        id: input.id || null,
        label: findLabel(input),
        isVisible: isElementVisible(input),
        boundingBox: getElementBoundingBox(input),
        hasFlatpickrInstance: !!flatpickrInstance,
        config: flatpickrInstance ? {
          dateFormat: flatpickrInstance.config?.dateFormat,
          enableTime: flatpickrInstance.config?.enableTime,
          minDate: flatpickrInstance.config?.minDate,
          maxDate: flatpickrInstance.config?.maxDate
        } : null
      });
    });

    // Check for Flatpickr calendar
    const flatpickrCalendar = document.querySelector('.flatpickr-calendar');
    if (flatpickrCalendar) {
      datePickers.forEach(dp => {
        if (dp.type === DatePickerTypes.FLATPICKR) {
          dp.calendarSelector = generateSelector(flatpickrCalendar);
          dp.isCalendarOpen = flatpickrCalendar.classList.contains('open');
        }
      });
    }

    // 6. Material UI date pickers
    const materialInputs = document.querySelectorAll(
      '.MuiDatePicker-root input, [class*="MuiInputBase"][class*="date"] input, ' +
      '.MuiTextField-root[class*="date"] input, [class*="DatePicker"] input, ' +
      'input[class*="MuiInput"][aria-haspopup="dialog"]'
    );
    materialInputs.forEach((input) => {
      const existingSelector = generateSelector(input);
      if (datePickers.some(dp => dp.selector === existingSelector)) return;

      const container = input.closest('.MuiDatePicker-root, [class*="DatePicker"], .MuiTextField-root');
      datePickers.push({
        type: DatePickerTypes.MATERIAL_UI,
        selector: existingSelector,
        containerSelector: container ? generateSelector(container) : null,
        inputType: input.type || 'text',
        value: input.value || null,
        required: input.required || input.getAttribute('aria-required') === 'true',
        disabled: input.disabled,
        name: input.name || null,
        id: input.id || null,
        label: findLabel(input) || input.getAttribute('aria-label'),
        isVisible: isElementVisible(input),
        boundingBox: getElementBoundingBox(input)
      });
    });

    // 7. React-datepicker
    const reactDatepickerInputs = document.querySelectorAll(
      '.react-datepicker__input-container input, ' +
      '.react-datepicker-wrapper input, ' +
      '[class*="react-datepicker"] input'
    );
    reactDatepickerInputs.forEach((input) => {
      const existingSelector = generateSelector(input);
      if (datePickers.some(dp => dp.selector === existingSelector)) return;

      datePickers.push({
        type: DatePickerTypes.REACT_DATEPICKER,
        selector: existingSelector,
        inputType: input.type || 'text',
        value: input.value || null,
        required: input.required,
        disabled: input.disabled,
        name: input.name || null,
        id: input.id || null,
        label: findLabel(input),
        isVisible: isElementVisible(input),
        boundingBox: getElementBoundingBox(input)
      });
    });

    // Check for React-datepicker calendar
    const reactDatepickerCalendar = document.querySelector('.react-datepicker-popper, .react-datepicker');
    if (reactDatepickerCalendar) {
      datePickers.forEach(dp => {
        if (dp.type === DatePickerTypes.REACT_DATEPICKER) {
          dp.calendarSelector = generateSelector(reactDatepickerCalendar);
          dp.isCalendarOpen = isElementVisible(reactDatepickerCalendar);
        }
      });
    }

    // 8. Pikaday
    const pikadayInputs = document.querySelectorAll('.pika-single input, [data-pikaday]');
    pikadayInputs.forEach((input) => {
      const existingSelector = generateSelector(input);
      if (datePickers.some(dp => dp.selector === existingSelector)) return;

      datePickers.push({
        type: DatePickerTypes.PIKADAY,
        selector: existingSelector,
        inputType: input.type || 'text',
        value: input.value || null,
        required: input.required,
        disabled: input.disabled,
        name: input.name || null,
        id: input.id || null,
        label: findLabel(input),
        isVisible: isElementVisible(input),
        boundingBox: getElementBoundingBox(input)
      });
    });

    // 9. Air Datepicker
    const airDatepickerInputs = document.querySelectorAll(
      '.air-datepicker-input, [data-datepicker]:not(.hasDatepicker)'
    );
    airDatepickerInputs.forEach((input) => {
      const existingSelector = generateSelector(input);
      if (datePickers.some(dp => dp.selector === existingSelector)) return;

      datePickers.push({
        type: DatePickerTypes.AIR_DATEPICKER,
        selector: existingSelector,
        inputType: input.type || 'text',
        value: input.value || null,
        required: input.required,
        disabled: input.disabled,
        name: input.name || null,
        id: input.id || null,
        label: findLabel(input),
        isVisible: isElementVisible(input),
        boundingBox: getElementBoundingBox(input)
      });
    });

    // 10. Litepicker
    const litepickerInputs = document.querySelectorAll('[data-litepicker], .litepicker-input');
    litepickerInputs.forEach((input) => {
      const existingSelector = generateSelector(input);
      if (datePickers.some(dp => dp.selector === existingSelector)) return;

      datePickers.push({
        type: DatePickerTypes.LITEPICKER,
        selector: existingSelector,
        inputType: input.type || 'text',
        value: input.value || null,
        required: input.required,
        disabled: input.disabled,
        name: input.name || null,
        id: input.id || null,
        label: findLabel(input),
        isVisible: isElementVisible(input),
        boundingBox: getElementBoundingBox(input)
      });
    });

    // 11. Generic date inputs (text inputs that might be date fields)
    const potentialDateInputs = document.querySelectorAll(
      'input[name*="date" i], input[id*="date" i], ' +
      'input[placeholder*="date" i], input[placeholder*="mm/dd" i], ' +
      'input[placeholder*="dd/mm" i], input[placeholder*="yyyy" i], ' +
      'input[aria-label*="date" i]'
    );
    potentialDateInputs.forEach((input) => {
      // Skip already detected inputs
      const existingSelector = generateSelector(input);
      if (datePickers.some(dp => dp.selector === existingSelector)) return;
      // Skip non-text inputs
      if (input.type !== 'text' && input.type !== '') return;

      datePickers.push({
        type: DatePickerTypes.UNKNOWN,
        selector: existingSelector,
        inputType: input.type || 'text',
        value: input.value || null,
        required: input.required,
        disabled: input.disabled,
        name: input.name || null,
        id: input.id || null,
        label: findLabel(input),
        placeholder: input.placeholder || null,
        isVisible: isElementVisible(input),
        boundingBox: getElementBoundingBox(input),
        isPotentialDateField: true
      });
    });

    return {
      success: true,
      datePickers,
      count: datePickers.length,
      types: [...new Set(datePickers.map(dp => dp.type))],
      url: window.location.href,
      timestamp: Date.now()
    };
  } catch (error) {
    contentLogger.error('Failed to detect date pickers', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get the type of a date picker element
 * @param {string} selector - Element selector
 * @returns {Promise<Object>} - Date picker type information
 */
async function handleGetDatePickerType(selector) {
  contentLogger.info('Getting date picker type', { selector });

  try {
    const element = findElement(selector);

    if (!element) {
      return { success: false, error: 'Element not found' };
    }

    const result = {
      success: true,
      selector,
      type: DatePickerTypes.UNKNOWN,
      details: {}
    };

    // Check for native date input
    if (element.type === 'date') {
      result.type = DatePickerTypes.NATIVE;
      result.details = {
        min: element.min || null,
        max: element.max || null,
        step: element.step || null
      };
      return result;
    }

    if (element.type === 'datetime-local') {
      result.type = DatePickerTypes.NATIVE_DATETIME;
      result.details = {
        min: element.min || null,
        max: element.max || null,
        step: element.step || null
      };
      return result;
    }

    // Check for jQuery UI
    if (element.classList.contains('hasDatepicker') || element.getAttribute('data-datepicker')) {
      result.type = DatePickerTypes.JQUERY_UI;
      result.details = {
        hasJQueryUI: typeof window.jQuery !== 'undefined' && typeof window.jQuery.fn.datepicker !== 'undefined'
      };
      return result;
    }

    // Check for Bootstrap datepicker
    if (element.getAttribute('data-provide') === 'datepicker' ||
        element.getAttribute('data-toggle') === 'datepicker' ||
        element.closest('.input-group.date')) {
      result.type = DatePickerTypes.BOOTSTRAP;
      result.details = {
        format: element.getAttribute('data-date-format')
      };
      return result;
    }

    // Check for Flatpickr
    if (element.classList.contains('flatpickr-input') || element._flatpickr) {
      result.type = DatePickerTypes.FLATPICKR;
      const instance = element._flatpickr;
      result.details = instance ? {
        dateFormat: instance.config?.dateFormat,
        enableTime: instance.config?.enableTime
      } : {};
      return result;
    }

    // Check for Material UI
    if (element.closest('.MuiDatePicker-root, [class*="DatePicker"]')) {
      result.type = DatePickerTypes.MATERIAL_UI;
      return result;
    }

    // Check for React-datepicker
    if (element.closest('.react-datepicker__input-container, .react-datepicker-wrapper')) {
      result.type = DatePickerTypes.REACT_DATEPICKER;
      return result;
    }

    // Check for Pikaday
    if (element.closest('.pika-single') || element.getAttribute('data-pikaday')) {
      result.type = DatePickerTypes.PIKADAY;
      return result;
    }

    // Check for Air Datepicker
    if (element.classList.contains('air-datepicker-input')) {
      result.type = DatePickerTypes.AIR_DATEPICKER;
      return result;
    }

    // Check for Litepicker
    if (element.getAttribute('data-litepicker') || element.classList.contains('litepicker-input')) {
      result.type = DatePickerTypes.LITEPICKER;
      return result;
    }

    return result;
  } catch (error) {
    contentLogger.error('Failed to get date picker type', error);
    return { success: false, error: error.message };
  }
}

/**
 * Set a date value on a date picker with format conversion
 * @param {string} selector - Date picker selector
 * @param {string} dateString - Date string to set
 * @param {string} format - Target format for conversion
 * @returns {Promise<Object>} - Result
 */
async function handleSetDateValue(selector, dateString, format = 'YYYY-MM-DD') {
  contentLogger.info('Setting date value', { selector, dateString, format });

  try {
    const element = findElement(selector);

    if (!element) {
      return { success: false, error: 'Element not found' };
    }

    // Parse the input date
    const parsedDate = parseDateString(dateString);
    if (!parsedDate) {
      return { success: false, error: 'Invalid date string' };
    }

    // Scroll into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(CONTENT_CONFIG.SCROLL_WAIT);

    // Get the picker type
    const typeResult = await handleGetDatePickerType(selector);
    const pickerType = typeResult.type;

    // Format the date for the specific picker
    const formattedDate = formatDateStringForPicker(parsedDate, format);

    contentLogger.debug('Setting date', { pickerType, formattedDate });

    // Handle based on picker type
    switch (pickerType) {
      case DatePickerTypes.NATIVE:
      case DatePickerTypes.NATIVE_DATETIME:
        // Native inputs use YYYY-MM-DD format
        const nativeFormat = pickerType === DatePickerTypes.NATIVE_DATETIME
          ? formatDateStringForPicker(parsedDate, 'YYYY-MM-DDTHH:mm')
          : formatDateStringForPicker(parsedDate, 'YYYY-MM-DD');
        element.value = nativeFormat;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        break;

      case DatePickerTypes.JQUERY_UI:
        // Try to use jQuery UI API if available
        if (typeof window.jQuery !== 'undefined' && window.jQuery(element).datepicker) {
          window.jQuery(element).datepicker('setDate', parsedDate);
        } else {
          // Fallback to direct value setting
          element.value = formattedDate;
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
        break;

      case DatePickerTypes.FLATPICKR:
        // Use Flatpickr API if available
        if (element._flatpickr) {
          element._flatpickr.setDate(parsedDate, true);
        } else {
          element.value = formattedDate;
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
        break;

      case DatePickerTypes.MATERIAL_UI:
      case DatePickerTypes.REACT_DATEPICKER:
        // React-based pickers need to simulate user input
        element.focus();
        await sleep(CONTENT_CONFIG.FOCUS_DELAY);

        // Clear existing value
        element.value = '';
        element.dispatchEvent(new Event('input', { bubbles: true }));

        // Type the new value character by character
        for (const char of formattedDate) {
          element.value += char;
          element.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            inputType: 'insertText',
            data: char
          }));
          await sleep(getTypingDelay());
        }

        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
        break;

      default:
        // Generic handling - try direct value and events
        element.focus();
        await sleep(CONTENT_CONFIG.FOCUS_DELAY);
        element.value = formattedDate;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.blur();
    }

    return {
      success: true,
      selector,
      pickerType,
      dateSet: formattedDate,
      actualValue: element.value,
      timestamp: Date.now()
    };
  } catch (error) {
    contentLogger.error('Failed to set date value', error);
    return { success: false, error: error.message };
  }
}

/**
 * Open a date picker calendar
 * @param {string} selector - Date picker selector
 * @returns {Promise<Object>} - Result
 */
async function handleOpenDatePicker(selector) {
  contentLogger.info('Opening date picker', { selector });

  try {
    const element = findElement(selector);

    if (!element) {
      return { success: false, error: 'Element not found' };
    }

    // Scroll into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(CONTENT_CONFIG.SCROLL_WAIT);

    // Get the picker type
    const typeResult = await handleGetDatePickerType(selector);
    const pickerType = typeResult.type;

    contentLogger.debug('Opening date picker', { pickerType });

    switch (pickerType) {
      case DatePickerTypes.NATIVE:
      case DatePickerTypes.NATIVE_DATETIME:
        // Native date inputs open on click or focus
        element.focus();
        element.click();
        // Some browsers need showPicker() method
        if (typeof element.showPicker === 'function') {
          try {
            element.showPicker();
          } catch (e) {
            // showPicker may fail if not triggered by user gesture
            contentLogger.debug('showPicker failed, using click fallback');
          }
        }
        break;

      case DatePickerTypes.JQUERY_UI:
        // jQuery UI datepicker API
        if (typeof window.jQuery !== 'undefined' && window.jQuery(element).datepicker) {
          window.jQuery(element).datepicker('show');
        } else {
          element.focus();
          await simulateHumanClick(element);
        }
        break;

      case DatePickerTypes.FLATPICKR:
        // Flatpickr API
        if (element._flatpickr) {
          element._flatpickr.open();
        } else {
          element.focus();
          await simulateHumanClick(element);
        }
        break;

      case DatePickerTypes.BOOTSTRAP:
        // Bootstrap datepicker usually opens on focus/click
        element.focus();
        await simulateHumanClick(element);
        // Some Bootstrap datepickers have show method
        if (typeof window.jQuery !== 'undefined') {
          const $el = window.jQuery(element);
          if ($el.datepicker && typeof $el.datepicker === 'function') {
            $el.datepicker('show');
          }
        }
        break;

      case DatePickerTypes.MATERIAL_UI:
      case DatePickerTypes.REACT_DATEPICKER:
        // React-based pickers typically open on focus/click
        element.focus();
        await sleep(CONTENT_CONFIG.FOCUS_DELAY);
        await simulateHumanClick(element);

        // Also try clicking on the calendar icon if present
        const container = element.closest('[class*="DatePicker"], .react-datepicker-wrapper, .MuiTextField-root');
        if (container) {
          const calendarIcon = container.querySelector(
            'button, [class*="icon"], [class*="calendar"], svg'
          );
          if (calendarIcon) {
            await simulateHumanClick(calendarIcon);
          }
        }
        break;

      default:
        // Generic - focus and click
        element.focus();
        await sleep(CONTENT_CONFIG.FOCUS_DELAY);
        await simulateHumanClick(element);
    }

    await sleep(CONTENT_CONFIG.DATE_PICKER_WAIT);

    // Check if calendar is now visible
    const calendarVisible = checkCalendarVisible(pickerType);

    return {
      success: true,
      selector,
      pickerType,
      calendarVisible,
      timestamp: Date.now()
    };
  } catch (error) {
    contentLogger.error('Failed to open date picker', error);
    return { success: false, error: error.message };
  }
}

/**
 * Select a date from an open calendar by clicking
 * @param {string} selector - Date picker selector
 * @param {string} dateString - Date to select
 * @returns {Promise<Object>} - Result
 */
async function handleSelectCalendarDate(selector, dateString) {
  contentLogger.info('Selecting calendar date', { selector, dateString });

  try {
    const element = findElement(selector);

    if (!element) {
      return { success: false, error: 'Element not found' };
    }

    // Parse the target date
    const targetDate = parseDateString(dateString);
    if (!targetDate) {
      return { success: false, error: 'Invalid date string' };
    }

    const targetDay = targetDate.getDate();
    const targetMonth = targetDate.getMonth();
    const targetYear = targetDate.getFullYear();

    // Get the picker type
    const typeResult = await handleGetDatePickerType(selector);
    const pickerType = typeResult.type;

    contentLogger.debug('Selecting from calendar', { pickerType, targetDay, targetMonth, targetYear });

    // First, ensure the calendar is open
    await handleOpenDatePicker(selector);
    await sleep(CONTENT_CONFIG.DATE_PICKER_WAIT);

    // Navigate to the correct month/year if needed
    await navigateCalendarToDate(pickerType, targetMonth, targetYear);

    // Find and click the day cell
    const dayCell = findDayCell(pickerType, targetDay, targetMonth, targetYear);

    if (!dayCell) {
      return {
        success: false,
        error: 'Day cell not found in calendar',
        targetDate: dateString
      };
    }

    // Click the day
    await simulateHumanClick(dayCell);
    await sleep(CONTENT_CONFIG.DATE_PICKER_WAIT);

    return {
      success: true,
      selector,
      pickerType,
      dateSelected: dateString,
      actualValue: element.value,
      timestamp: Date.now()
    };
  } catch (error) {
    contentLogger.error('Failed to select calendar date', error);
    return { success: false, error: error.message };
  }
}

/**
 * Parse a date string into a Date object
 * Supports multiple formats
 * @param {string} dateString - Date string to parse
 * @returns {Date|null} - Parsed date or null
 */
function parseDateString(dateString) {
  if (!dateString) return null;

  // Try ISO format first (YYYY-MM-DD)
  let date = new Date(dateString);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // Try MM/DD/YYYY format
  const mdyMatch = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    date = new Date(parseInt(mdyMatch[3]), parseInt(mdyMatch[1]) - 1, parseInt(mdyMatch[2]));
    if (!isNaN(date.getTime())) return date;
  }

  // Try DD/MM/YYYY format
  const dmyMatch = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    date = new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
    if (!isNaN(date.getTime())) return date;
  }

  // Try YYYY/MM/DD format
  const ymdSlashMatch = dateString.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (ymdSlashMatch) {
    date = new Date(parseInt(ymdSlashMatch[1]), parseInt(ymdSlashMatch[2]) - 1, parseInt(ymdSlashMatch[3]));
    if (!isNaN(date.getTime())) return date;
  }

  // Try DD-MM-YYYY format
  const dmyDashMatch = dateString.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyDashMatch) {
    date = new Date(parseInt(dmyDashMatch[3]), parseInt(dmyDashMatch[2]) - 1, parseInt(dmyDashMatch[1]));
    if (!isNaN(date.getTime())) return date;
  }

  return null;
}

/**
 * Format a Date object to a string for date pickers
 * @param {Date} date - Date object
 * @param {string} format - Target format
 * @returns {string} - Formatted date string
 */
function formatDateStringForPicker(date, format) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  switch (format.toUpperCase()) {
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'YYYY/MM/DD':
      return `${year}/${month}/${day}`;
    case 'DD-MM-YYYY':
      return `${day}-${month}-${year}`;
    case 'MM-DD-YYYY':
      return `${month}-${day}-${year}`;
    case 'YYYY-MM-DDTHH:MM':
    case 'YYYY-MM-DDTHH:mm':
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    default:
      return `${year}-${month}-${day}`;
  }
}

/**
 * Check if calendar popup is visible
 * @param {string} pickerType - Type of date picker
 * @returns {boolean} - True if calendar is visible
 */
function checkCalendarVisible(pickerType) {
  let calendar;

  switch (pickerType) {
    case DatePickerTypes.JQUERY_UI:
      calendar = document.querySelector('#ui-datepicker-div, .ui-datepicker');
      break;
    case DatePickerTypes.FLATPICKR:
      calendar = document.querySelector('.flatpickr-calendar.open');
      break;
    case DatePickerTypes.BOOTSTRAP:
      calendar = document.querySelector('.datepicker.datepicker-dropdown, .bootstrap-datetimepicker-widget');
      break;
    case DatePickerTypes.REACT_DATEPICKER:
      calendar = document.querySelector('.react-datepicker-popper, .react-datepicker:not(.react-datepicker--closed)');
      break;
    case DatePickerTypes.MATERIAL_UI:
      calendar = document.querySelector('.MuiPickersPopper-root, .MuiDateCalendar-root, [role="dialog"][aria-label*="date" i]');
      break;
    case DatePickerTypes.PIKADAY:
      calendar = document.querySelector('.pika-single:not(.is-hidden)');
      break;
    case DatePickerTypes.AIR_DATEPICKER:
      calendar = document.querySelector('.air-datepicker.-active-');
      break;
    case DatePickerTypes.LITEPICKER:
      calendar = document.querySelector('.litepicker.is-shown');
      break;
    default:
      // Check for any visible calendar-like element
      calendar = document.querySelector(
        '.calendar:not([style*="display: none"]), ' +
        '[class*="calendar"]:not([style*="display: none"]), ' +
        '[role="dialog"][aria-modal="true"]'
      );
  }

  return calendar ? isElementVisible(calendar) : false;
}

/**
 * Navigate calendar to a specific month/year
 * @param {string} pickerType - Type of date picker
 * @param {number} targetMonth - Target month (0-11)
 * @param {number} targetYear - Target year
 */
async function navigateCalendarToDate(pickerType, targetMonth, targetYear) {
  const maxNavigations = 24; // Max 2 years of navigation
  let navigations = 0;

  while (navigations < maxNavigations) {
    const currentDate = getCurrentCalendarDate(pickerType);
    if (!currentDate) break;

    const currentMonth = currentDate.month;
    const currentYear = currentDate.year;

    if (currentMonth === targetMonth && currentYear === targetYear) {
      break; // We're at the right month
    }

    // Determine direction
    const targetDateValue = targetYear * 12 + targetMonth;
    const currentDateValue = currentYear * 12 + currentMonth;

    if (targetDateValue > currentDateValue) {
      await clickCalendarNavigation(pickerType, 'next');
    } else {
      await clickCalendarNavigation(pickerType, 'prev');
    }

    await sleep(CONTENT_CONFIG.DATE_PICKER_WAIT);
    navigations++;
  }
}

/**
 * Get current month/year displayed in calendar
 * @param {string} pickerType - Type of date picker
 * @returns {Object|null} - { month, year } or null
 */
function getCurrentCalendarDate(pickerType) {
  let headerText = '';
  let calendar;

  switch (pickerType) {
    case DatePickerTypes.JQUERY_UI:
      calendar = document.querySelector('#ui-datepicker-div, .ui-datepicker');
      if (calendar) {
        const month = calendar.querySelector('.ui-datepicker-month');
        const year = calendar.querySelector('.ui-datepicker-year');
        if (month && year) {
          return {
            month: getMonthFromText(month.textContent || month.value),
            year: parseInt(year.textContent || year.value)
          };
        }
      }
      break;

    case DatePickerTypes.FLATPICKR:
      calendar = document.querySelector('.flatpickr-calendar');
      if (calendar) {
        const monthEl = calendar.querySelector('.flatpickr-current-month .cur-month');
        const yearEl = calendar.querySelector('.flatpickr-current-month .numInput.cur-year');
        if (monthEl && yearEl) {
          return {
            month: getMonthFromText(monthEl.textContent),
            year: parseInt(yearEl.value)
          };
        }
      }
      break;

    case DatePickerTypes.REACT_DATEPICKER:
      calendar = document.querySelector('.react-datepicker');
      if (calendar) {
        headerText = calendar.querySelector('.react-datepicker__current-month')?.textContent || '';
      }
      break;

    case DatePickerTypes.MATERIAL_UI:
      calendar = document.querySelector('.MuiPickersCalendarHeader-label, .MuiDateCalendar-root');
      if (calendar) {
        headerText = calendar.textContent || '';
      }
      break;

    case DatePickerTypes.BOOTSTRAP:
      calendar = document.querySelector('.datepicker, .bootstrap-datetimepicker-widget');
      if (calendar) {
        headerText = calendar.querySelector('.datepicker-switch, .picker-switch')?.textContent || '';
      }
      break;

    default:
      // Generic calendar header detection
      const genericCalendar = document.querySelector('[class*="calendar"]');
      if (genericCalendar) {
        const header = genericCalendar.querySelector('[class*="header"], [class*="title"]');
        if (header) headerText = header.textContent;
      }
  }

  // Parse header text for month and year
  if (headerText) {
    const monthYearMatch = headerText.match(/(\w+)\s+(\d{4})/);
    if (monthYearMatch) {
      return {
        month: getMonthFromText(monthYearMatch[1]),
        year: parseInt(monthYearMatch[2])
      };
    }
  }

  return null;
}

/**
 * Convert month name to month index (0-11)
 * @param {string} monthText - Month name
 * @returns {number} - Month index
 */
function getMonthFromText(monthText) {
  const months = {
    'january': 0, 'jan': 0,
    'february': 1, 'feb': 1,
    'march': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'may': 4,
    'june': 5, 'jun': 5,
    'july': 6, 'jul': 6,
    'august': 7, 'aug': 7,
    'september': 8, 'sep': 8, 'sept': 8,
    'october': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'december': 11, 'dec': 11
  };

  const normalized = monthText.toLowerCase().trim();
  return months[normalized] !== undefined ? months[normalized] : 0;
}

/**
 * Click calendar navigation button
 * @param {string} pickerType - Type of date picker
 * @param {string} direction - 'next' or 'prev'
 */
async function clickCalendarNavigation(pickerType, direction) {
  let button;

  const nextSelectors = [
    '.ui-datepicker-next',
    '.flatpickr-next-month',
    '.react-datepicker__navigation--next',
    '.datepicker-next',
    '.next',
    '[class*="next"]',
    'button[aria-label*="next" i]',
    '[data-action="next"]'
  ];

  const prevSelectors = [
    '.ui-datepicker-prev',
    '.flatpickr-prev-month',
    '.react-datepicker__navigation--previous',
    '.datepicker-prev',
    '.prev',
    '[class*="prev"]',
    'button[aria-label*="prev" i]',
    '[data-action="prev"]'
  ];

  const selectors = direction === 'next' ? nextSelectors : prevSelectors;

  for (const selector of selectors) {
    button = document.querySelector(selector);
    if (button && isElementVisible(button)) {
      break;
    }
  }

  if (button) {
    await simulateHumanClick(button);
  }
}

/**
 * Find the day cell in calendar for a specific date
 * @param {string} pickerType - Type of date picker
 * @param {number} day - Day of month
 * @param {number} month - Month (0-11)
 * @param {number} year - Year
 * @returns {HTMLElement|null} - Day cell element or null
 */
function findDayCell(pickerType, day, month, year) {
  let dayCells = [];

  switch (pickerType) {
    case DatePickerTypes.JQUERY_UI:
      dayCells = document.querySelectorAll('#ui-datepicker-div td[data-handler="selectDay"]');
      break;

    case DatePickerTypes.FLATPICKR:
      dayCells = document.querySelectorAll('.flatpickr-day:not(.prevMonthDay):not(.nextMonthDay)');
      break;

    case DatePickerTypes.REACT_DATEPICKER:
      dayCells = document.querySelectorAll('.react-datepicker__day:not(.react-datepicker__day--outside-month)');
      break;

    case DatePickerTypes.MATERIAL_UI:
      dayCells = document.querySelectorAll('.MuiPickersDay-root:not(.MuiPickersDay-dayOutsideMonth), button[role="gridcell"]');
      break;

    case DatePickerTypes.BOOTSTRAP:
      dayCells = document.querySelectorAll('.datepicker .day:not(.old):not(.new), .datepicker td.day');
      break;

    default:
      // Generic day cell detection
      dayCells = document.querySelectorAll(
        '[class*="calendar"] [class*="day"]:not([class*="disabled"]), ' +
        '[role="gridcell"], td[data-day]'
      );
  }

  // Find the cell with matching day
  for (const cell of dayCells) {
    const cellText = cell.textContent.trim();
    const cellDay = parseInt(cellText);

    if (cellDay === day) {
      // Verify it's not from a different month (for calendars showing multiple months)
      const isCurrentMonth = !cell.classList.contains('prevMonthDay') &&
                            !cell.classList.contains('nextMonthDay') &&
                            !cell.classList.contains('old') &&
                            !cell.classList.contains('new') &&
                            !cell.classList.contains('outside-month') &&
                            !cell.getAttribute('aria-disabled');

      if (isCurrentMonth && isElementVisible(cell)) {
        return cell;
      }
    }
  }

  return null;
}

/**
 * Get bounding box of element for date picker detection
 * @param {HTMLElement} element - Element
 * @returns {Object|null} Bounding box
 */
function getElementBoundingBox(element) {
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

/**
 * Handle file upload using DataTransfer API
 * This allows setting file input values programmatically with base64 encoded file data
 * @param {string} selector - File input selector
 * @param {Object} fileInfo - File information including base64 content
 * @param {string|Array<Object>} fileInfo.files - Single file object or array of file objects
 *   Each file object: { fileName: string, fileContent: string (base64), mimeType: string }
 * @returns {Promise<Object>} - Result with upload status
 */
async function handleFileUpload(selector, fileInfo) {
  contentLogger.info('File upload requested', { selector, fileInfo });

  try {
    const fileInput = findElement(selector);

    if (!fileInput || fileInput.type !== 'file') {
      return { success: false, error: 'File input not found' };
    }

    // Get the input info for response
    const inputInfo = {
      selector: generateSelector(fileInput),
      accept: fileInput.accept || '*',
      multiple: fileInput.multiple,
      required: fileInput.required,
      name: fileInput.name
    };

    // If no file data provided, just return input info
    if (!fileInfo || (!fileInfo.files && !fileInfo.fileName)) {
      return {
        success: true,
        needsUserAction: true,
        message: 'No file data provided. Use upload_file command with file content.',
        inputInfo
      };
    }

    // Scroll into view
    fileInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(CONTENT_CONFIG.SCROLL_WAIT);

    // Normalize files to array format
    let filesToUpload = [];
    if (fileInfo.files && Array.isArray(fileInfo.files)) {
      filesToUpload = fileInfo.files;
    } else if (fileInfo.fileName && fileInfo.fileContent) {
      // Single file format
      filesToUpload = [{
        fileName: fileInfo.fileName,
        fileContent: fileInfo.fileContent,
        mimeType: fileInfo.mimeType || 'application/octet-stream'
      }];
    }

    if (filesToUpload.length === 0) {
      return { success: false, error: 'No valid file data provided' };
    }

    // Check multiple file support
    if (filesToUpload.length > 1 && !fileInput.multiple) {
      contentLogger.warn('Multiple files provided but input does not support multiple', {
        provided: filesToUpload.length
      });
      // Only use the first file
      filesToUpload = [filesToUpload[0]];
    }

    // Create File objects from base64 data
    const files = [];
    for (const fileData of filesToUpload) {
      try {
        const file = createFileFromBase64(
          fileData.fileContent,
          fileData.fileName,
          fileData.mimeType || 'application/octet-stream'
        );
        files.push(file);
      } catch (error) {
        contentLogger.error('Failed to create file from base64', {
          fileName: fileData.fileName,
          error: error.message
        });
        return {
          success: false,
          error: `Failed to decode file ${fileData.fileName}: ${error.message}`
        };
      }
    }

    // Use DataTransfer API to set the files
    const result = await setFileInputFiles(fileInput, files);

    if (result.success) {
      return {
        success: true,
        filesUploaded: files.map(f => ({
          name: f.name,
          size: f.size,
          type: f.type
        })),
        inputInfo
      };
    } else {
      return result;
    }
  } catch (error) {
    contentLogger.error('Failed to handle file upload', error);
    return { success: false, error: error.message };
  }
}

/**
 * Find all file input elements on the page
 * @param {Object} options - Search options
 * @param {boolean} options.searchShadowDOM - Whether to search shadow DOM (default: true)
 * @param {boolean} options.includeHidden - Whether to include hidden inputs (default: false)
 * @returns {Array<Object>} - Array of file input information
 */
function findFileInputs(options = {}) {
  const { searchShadowDOM = true, includeHidden = false } = options;

  contentLogger.info('Finding file inputs', { options });

  try {
    // Find all file inputs
    const inputs = searchShadowDOM
      ? querySelectorAllDeep('input[type="file"]')
      : Array.from(document.querySelectorAll('input[type="file"]'));

    const fileInputs = [];

    for (const input of inputs) {
      // Skip hidden inputs if option disabled
      if (!includeHidden && !isElementVisible(input)) {
        continue;
      }

      const inputInfo = {
        selector: generateSelector(input),
        id: input.id || null,
        name: input.name || null,
        accept: input.accept || '*',
        multiple: input.multiple,
        required: input.required,
        disabled: input.disabled,
        label: findLabel(input),
        isVisible: isElementVisible(input),
        hasFiles: input.files && input.files.length > 0,
        fileCount: input.files ? input.files.length : 0,
        // Include current files info if any
        currentFiles: input.files ? Array.from(input.files).map(f => ({
          name: f.name,
          size: f.size,
          type: f.type
        })) : []
      };

      // Try to find associated form
      const form = input.closest('form');
      if (form) {
        inputInfo.formSelector = generateSelector(form);
        inputInfo.formId = form.id || null;
      }

      fileInputs.push(inputInfo);
    }

    contentLogger.debug('Found file inputs', { count: fileInputs.length });
    return fileInputs;
  } catch (error) {
    contentLogger.error('Failed to find file inputs', error);
    return [];
  }
}

/**
 * Handle the get_file_inputs message action
 * @param {Object} options - Search options
 * @returns {Promise<Object>} - Result with file inputs list
 */
async function handleGetFileInputs(options = {}) {
  contentLogger.info('Getting file inputs', { options });

  try {
    const fileInputs = findFileInputs(options);

    return {
      success: true,
      fileInputs,
      count: fileInputs.length,
      url: window.location.href,
      timestamp: Date.now()
    };
  } catch (error) {
    contentLogger.error('Failed to get file inputs', error);
    return { success: false, error: error.message };
  }
}

/**
 * Set file input value using DataTransfer API
 * @param {HTMLInputElement} fileInput - The file input element
 * @param {File[]} files - Array of File objects to set
 * @returns {Promise<Object>} - Result of the operation
 */
async function setFileInputFiles(fileInput, files) {
  contentLogger.debug('Setting file input files', {
    inputSelector: generateSelector(fileInput),
    fileCount: files.length
  });

  try {
    // Create a DataTransfer object
    const dataTransfer = new DataTransfer();

    // Add each file to the DataTransfer
    for (const file of files) {
      dataTransfer.items.add(file);
    }

    // Set the files on the input
    fileInput.files = dataTransfer.files;

    // Dispatch events to notify frameworks of the change
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Verify files were set
    if (fileInput.files.length !== files.length) {
      return {
        success: false,
        error: 'Files were not properly set on input',
        expected: files.length,
        actual: fileInput.files.length
      };
    }

    contentLogger.info('Files set successfully', {
      count: files.length,
      names: files.map(f => f.name)
    });

    return {
      success: true,
      filesSet: files.length
    };
  } catch (error) {
    contentLogger.error('Failed to set file input files', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a File object from base64 encoded content
 * @param {string} base64Content - Base64 encoded file content
 * @param {string} fileName - Name for the file
 * @param {string} mimeType - MIME type of the file
 * @returns {File} - File object
 */
function createFileFromBase64(base64Content, fileName, mimeType = 'application/octet-stream') {
  // Remove data URL prefix if present
  let cleanBase64 = base64Content;
  if (base64Content.includes(',')) {
    cleanBase64 = base64Content.split(',')[1];
  }

  // Decode base64 to binary
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Create Blob and then File
  const blob = new Blob([bytes], { type: mimeType });
  const file = new File([blob], fileName, { type: mimeType, lastModified: Date.now() });

  return file;
}

/**
 * Handle trigger file dialog - clicks the file input to open browser file picker
 * @param {string} selector - File input selector
 * @returns {Promise<Object>} - Result of the operation
 */
async function handleTriggerFileDialog(selector) {
  contentLogger.info('Triggering file dialog', { selector });

  try {
    const fileInput = findElement(selector);

    if (!fileInput || fileInput.type !== 'file') {
      return { success: false, error: 'File input not found' };
    }

    // Scroll into view
    fileInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(CONTENT_CONFIG.SCROLL_WAIT);

    // Click the input to trigger the file dialog
    fileInput.click();

    return {
      success: true,
      message: 'File dialog triggered - awaiting user file selection',
      inputInfo: {
        selector: generateSelector(fileInput),
        accept: fileInput.accept || '*',
        multiple: fileInput.multiple
      }
    };
  } catch (error) {
    contentLogger.error('Failed to trigger file dialog', error);
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
  // Apply rate limiting for click action
  if (contentRateLimiter) {
    await contentRateLimiter.wait('click');
  }

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
// Shadow DOM Utilities
// =============================================================================

/**
 * Get all shadow roots from an element and its descendants
 * Note: Closed shadow roots cannot be accessed via JavaScript unless we have
 * a reference stored from when they were created. We can only traverse open shadow roots.
 * @param {Element|ShadowRoot|Document} root - Root element to search from
 * @returns {ShadowRoot[]} - Array of accessible shadow roots
 */
function getAllShadowRoots(root = document.body) {
  const shadowRoots = [];

  function traverse(node) {
    if (!node) return;

    // Check if this element has an open shadow root
    if (node.shadowRoot) {
      shadowRoots.push(node.shadowRoot);
      // Recursively search within the shadow root
      traverse(node.shadowRoot);
    }

    // Traverse child elements
    const children = node.children || node.childNodes;
    if (children) {
      for (const child of children) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          traverse(child);
        }
      }
    }

    // If this is a shadow root, also traverse its child elements
    if (node instanceof ShadowRoot) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(root);
  return shadowRoots;
}

/**
 * Query selector that searches through Shadow DOM (deep query)
 * @param {string} selector - CSS selector to search for
 * @param {Element|Document|ShadowRoot} root - Root to search from
 * @returns {Element|null} - Found element or null
 */
function querySelectorDeep(selector, root = document) {
  // First try in the regular DOM
  try {
    const element = root.querySelector(selector);
    if (element) return element;
  } catch (e) {
    // Invalid selector, will be handled by caller
  }

  // Get all shadow roots and search in each
  const searchRoot = root === document ? document.body : root;
  const shadowRoots = getAllShadowRoots(searchRoot);

  for (const shadowRoot of shadowRoots) {
    try {
      const element = shadowRoot.querySelector(selector);
      if (element) {
        contentLogger.debug('Found element in shadow DOM', { selector });
        return element;
      }
    } catch (e) {
      // Invalid selector for this context, continue
    }
  }

  return null;
}

/**
 * Query selector all that searches through Shadow DOM (deep query)
 * Returns all matching elements from both regular DOM and all shadow roots
 * @param {string} selector - CSS selector to search for
 * @param {Element|Document|ShadowRoot} root - Root to search from
 * @returns {Element[]} - Array of found elements
 */
function querySelectorAllDeep(selector, root = document) {
  const results = [];

  // First search in the regular DOM
  try {
    const elements = root.querySelectorAll(selector);
    results.push(...elements);
  } catch (e) {
    // Invalid selector, will be handled by caller
  }

  // Search in all shadow roots
  const searchRoot = root === document ? document.body : root;
  const shadowRoots = getAllShadowRoots(searchRoot);

  for (const shadowRoot of shadowRoots) {
    try {
      const elements = shadowRoot.querySelectorAll(selector);
      results.push(...elements);
    } catch (e) {
      // Invalid selector for this context, continue
    }
  }

  if (results.length > 0) {
    contentLogger.debug('querySelectorAllDeep found elements', {
      selector,
      count: results.length
    });
  }

  return results;
}

/**
 * Find an element by text content, searching through Shadow DOM
 * @param {string} text - Text to search for
 * @param {Element|Document|ShadowRoot} root - Root to search from
 * @returns {HTMLElement|null} - Found element or null
 */
function findElementByTextDeep(text, root = document) {
  const normalizedText = text.toLowerCase().trim();

  // Helper to search within a specific root (document or shadow root)
  function searchInRoot(searchRoot) {
    // Search buttons
    const buttons = searchRoot.querySelectorAll('button, input[type="submit"], input[type="button"]');
    for (const button of buttons) {
      const buttonText = (button.innerText || button.value || '').toLowerCase().trim();
      if (buttonText === normalizedText || buttonText.includes(normalizedText)) {
        return button;
      }
    }

    // Search links
    const links = searchRoot.querySelectorAll('a');
    for (const link of links) {
      const linkText = link.innerText.toLowerCase().trim();
      if (linkText === normalizedText || linkText.includes(normalizedText)) {
        return link;
      }
    }

    // Search labels (return associated input)
    const labels = searchRoot.querySelectorAll('label');
    for (const label of labels) {
      const labelText = label.innerText.toLowerCase().trim();
      if (labelText === normalizedText || labelText.includes(normalizedText)) {
        const forId = label.getAttribute('for');
        if (forId) {
          // Search for the input in the same root context
          const input = searchRoot.getElementById
            ? searchRoot.getElementById(forId)
            : searchRoot.querySelector(`#${CSS.escape(forId)}`);
          if (input) return input;
        }
        // Check for nested input inside the label
        const nestedInput = label.querySelector('input, textarea, select');
        if (nestedInput) return nestedInput;
      }
    }

    return null;
  }

  // Search in main document first
  const mainResult = searchInRoot(root);
  if (mainResult) return mainResult;

  // Search in all shadow roots
  const searchRoot = root === document ? document.body : root;
  const shadowRoots = getAllShadowRoots(searchRoot);

  for (const shadowRoot of shadowRoots) {
    const shadowResult = searchInRoot(shadowRoot);
    if (shadowResult) {
      contentLogger.debug('Found element by text in shadow DOM', { text });
      return shadowResult;
    }
  }

  return null;
}

/**
 * Check if an element is within a Shadow DOM
 * @param {Element} element - Element to check
 * @returns {boolean} - True if element is inside a shadow root
 */
function isInShadowDOM(element) {
  let node = element;
  while (node) {
    if (node instanceof ShadowRoot) {
      return true;
    }
    node = node.parentNode;
  }
  return false;
}

/**
 * Get the shadow host chain for an element (path through shadow boundaries)
 * Returns an array of shadow hosts from outermost to innermost
 * @param {Element} element - Element to get host chain for
 * @returns {Element[]} - Array of shadow host elements
 */
function getShadowHostChain(element) {
  const hosts = [];
  let node = element;

  while (node) {
    if (node instanceof ShadowRoot) {
      hosts.unshift(node.host);
      node = node.host;
    }
    node = node.parentNode;
  }

  return hosts;
}

/**
 * Get the composed path from document to an element, including shadow boundaries
 * @param {Element} element - Element to get path for
 * @returns {Array} - Array of nodes from document to element, including shadow boundaries
 */
function getElementPath(element) {
  const path = [];
  let node = element;

  while (node) {
    path.unshift(node);
    if (node instanceof ShadowRoot) {
      // Include shadow boundary marker
      node = node.host;
    } else {
      node = node.parentNode;
    }
  }

  return path;
}

/**
 * Generate a selector that works across shadow DOM boundaries
 * Uses >>> notation to indicate shadow root traversal (for documentation/parsing purposes)
 * @param {Element} element - Element to generate selector for
 * @returns {string} - CSS selector (may include >>> for shadow boundaries)
 */
function generateSelectorDeep(element) {
  if (!element) return '';

  // If not in shadow DOM, use regular selector generation
  if (!isInShadowDOM(element)) {
    return generateSelector(element);
  }

  // Build selector path through shadow boundaries
  const selectorParts = [];
  let current = element;
  let currentRoot = element.getRootNode();

  while (current && current !== document) {
    // Generate selector for current element within its root
    let selector = '';

    // Prefer ID for uniqueness
    if (current.id) {
      selector = `#${CSS.escape(current.id)}`;
    } else if (current.name && isFormElement(current)) {
      selector = `[name="${CSS.escape(current.name)}"]`;
    } else {
      // Build path-based selector within this shadow root
      selector = current.tagName.toLowerCase();
      const parent = current.parentElement || (currentRoot instanceof ShadowRoot ? currentRoot : null);
      if (parent && parent.children) {
        const siblings = Array.from(parent.children).filter(
          child => child.tagName === current.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }
    }

    selectorParts.unshift(selector);

    // Check if we're at a shadow root boundary
    if (currentRoot instanceof ShadowRoot) {
      // Add shadow boundary marker
      selectorParts.unshift('>>>');
      current = currentRoot.host;
      currentRoot = current.getRootNode();
    } else {
      current = current.parentElement;
    }

    // Stop at ID for uniqueness (IDs should be unique within their root)
    if (selector.startsWith('#')) {
      break;
    }
  }

  return selectorParts.join(' ');
}

/**
 * Find element using shadow path notation (selector >>> selector >>> selector)
 * The >>> separator indicates crossing into a shadow root boundary
 * @param {string} path - Path with >>> separators for shadow boundaries
 * @returns {HTMLElement|null} - Found element or null
 */
function findElementByShadowPath(path) {
  const parts = path.split('>>>').map(p => p.trim()).filter(p => p.length > 0);

  if (parts.length === 0) return null;

  let currentRoot = document;
  let currentElement = null;

  for (let i = 0; i < parts.length; i++) {
    const selector = parts[i];

    try {
      currentElement = currentRoot.querySelector(selector);
    } catch (e) {
      contentLogger.debug('Invalid selector in shadow path', { selector, error: e.message });
      return null;
    }

    if (!currentElement) {
      contentLogger.debug('Element not found in shadow path', { selector, partIndex: i });
      return null;
    }

    // If there are more parts, we need to enter the shadow root
    if (i < parts.length - 1) {
      if (!currentElement.shadowRoot) {
        contentLogger.debug('No shadow root found for element in path', { selector, partIndex: i });
        return null;
      }
      currentRoot = currentElement.shadowRoot;
    }
  }

  contentLogger.debug('Found element via shadow path', { path });
  return currentElement;
}

/**
 * Get information about shadow DOM on the page
 * Useful for debugging and understanding the page structure
 * @returns {Object} - Shadow DOM info including count and details
 */
function getShadowDOMInfo() {
  const shadowRoots = getAllShadowRoots(document.body);

  const info = {
    totalShadowRoots: shadowRoots.length,
    shadowHosts: shadowRoots.map(sr => ({
      hostTag: sr.host.tagName.toLowerCase(),
      hostId: sr.host.id || null,
      hostClass: sr.host.className || null,
      mode: sr.mode, // 'open' or 'closed' (we can only access open ones)
      childElementCount: sr.childElementCount
    }))
  };

  contentLogger.debug('Shadow DOM info', info);
  return info;
}

/**
 * Handle message to get shadow DOM information
 * @returns {Promise<Object>} - Shadow DOM information result
 */
async function handleGetShadowDOMInfo() {
  contentLogger.info('Getting Shadow DOM info');

  try {
    const info = getShadowDOMInfo();

    return {
      success: true,
      ...info,
      url: window.location.href,
      timestamp: Date.now()
    };
  } catch (error) {
    contentLogger.error('Failed to get Shadow DOM info', error);
    return { success: false, error: error.message };
  }
}

/**
 * Wait for element with MutationObserver, including Shadow DOM support
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in milliseconds
 * @param {Object} options - Options including searchShadowDOM
 * @returns {Promise<HTMLElement>} - Found element
 */
function waitForElementDeep(selector, timeout = CONTENT_CONFIG.DEFAULT_WAIT_TIMEOUT, options = {}) {
  const { searchShadowDOM = true } = options;

  return new Promise((resolve, reject) => {
    // Helper function to find element
    const findFn = searchShadowDOM ? querySelectorDeep : (sel) => document.querySelector(sel);

    // Check if element already exists
    const existing = findFn(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    // Set up timeout
    const timeoutId = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for element: ${selector}`));
    }, timeout);

    // Set up mutation observer on document body
    const observer = new MutationObserver((mutations, obs) => {
      const element = findFn(selector);
      if (element) {
        clearTimeout(timeoutId);
        obs.disconnect();
        resolve(element);
      }
    });

    // Start observing - observe the whole document for shadow DOM support
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });

    // Also observe any existing shadow roots
    if (searchShadowDOM) {
      const shadowRoots = getAllShadowRoots(document.body);
      for (const shadowRoot of shadowRoots) {
        try {
          observer.observe(shadowRoot, {
            childList: true,
            subtree: true,
            attributes: true
          });
        } catch (e) {
          // Some shadow roots may not be observable
        }
      }
    }
  });
}

// =============================================================================
// Element Finding Helpers
// =============================================================================

/**
 * Check if a selector is an XPath expression
 * XPath expressions typically start with /, //, or use xpath: prefix
 * @param {string} selector - Selector string to check
 * @returns {boolean} - True if selector appears to be XPath
 */
function isXPathSelector(selector) {
  if (!selector || typeof selector !== 'string') {
    return false;
  }
  const trimmed = selector.trim();
  // Detect XPath by common patterns:
  // - Starts with / (absolute XPath)
  // - Starts with // (relative XPath from anywhere)
  // - Starts with ./ or .// (relative to context)
  // - Starts with ( for grouped expressions like (//div)[1]
  // - Has explicit xpath: prefix
  return (
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('(') ||
    trimmed.toLowerCase().startsWith('xpath:')
  );
}

/**
 * Evaluate an XPath expression and return matching elements
 * @param {string} xpath - XPath expression to evaluate
 * @param {boolean} returnMultiple - If true, return all matches; if false, return first match
 * @param {Node} contextNode - Context node for evaluation (defaults to document)
 * @returns {HTMLElement|HTMLElement[]|null} - Found element(s) or null
 */
function evaluateXPath(xpath, returnMultiple = false, contextNode = document) {
  if (!xpath || typeof xpath !== 'string') {
    contentLogger.warn('Invalid XPath expression provided', { xpath });
    return returnMultiple ? [] : null;
  }

  // Remove xpath: prefix if present
  let cleanXPath = xpath.trim();
  if (cleanXPath.toLowerCase().startsWith('xpath:')) {
    cleanXPath = cleanXPath.substring(6).trim();
  }

  try {
    const resultType = returnMultiple
      ? XPathResult.ORDERED_NODE_SNAPSHOT_TYPE
      : XPathResult.FIRST_ORDERED_NODE_TYPE;

    const result = document.evaluate(
      cleanXPath,
      contextNode,
      null, // namespaceResolver - null for HTML documents
      resultType,
      null  // result - create new result object
    );

    if (returnMultiple) {
      // Return array of all matching elements
      const elements = [];
      for (let i = 0; i < result.snapshotLength; i++) {
        const node = result.snapshotItem(i);
        if (node && node.nodeType === Node.ELEMENT_NODE) {
          elements.push(node);
        }
      }
      contentLogger.debug('XPath evaluation returned multiple elements', {
        xpath: cleanXPath,
        count: elements.length
      });
      return elements;
    } else {
      // Return single element
      const node = result.singleNodeValue;
      if (node && node.nodeType === Node.ELEMENT_NODE) {
        contentLogger.debug('XPath evaluation found element', { xpath: cleanXPath });
        return node;
      }
      return null;
    }
  } catch (error) {
    contentLogger.error('XPath evaluation failed', {
      xpath: cleanXPath,
      error: error.message,
      errorType: error.name
    });
    return returnMultiple ? [] : null;
  }
}

/**
 * Find multiple elements using XPath
 * @param {string} xpath - XPath expression
 * @param {Node} contextNode - Context node for evaluation
 * @returns {HTMLElement[]} - Array of found elements
 */
function findElementsByXPath(xpath, contextNode = document) {
  return evaluateXPath(xpath, true, contextNode);
}

/**
 * Find multiple elements using a selector (CSS or XPath), with Shadow DOM support
 * @param {string} selector - Selector string (CSS or XPath)
 * @param {Object} options - Options for element finding
 * @param {boolean} options.searchShadowDOM - Whether to search shadow DOM (default: true)
 * @returns {HTMLElement[]} - Array of found elements
 */
function findElements(selector, options = {}) {
  const { searchShadowDOM = true } = options;

  if (!selector || typeof selector !== 'string') {
    return [];
  }

  const trimmedSelector = selector.trim();
  if (trimmedSelector.length === 0) {
    contentLogger.warn('Empty selector provided to findElements');
    return [];
  }

  // Check if selector is XPath
  if (isXPathSelector(trimmedSelector)) {
    contentLogger.debug('Using XPath for findElements', { selector: trimmedSelector });
    return findElementsByXPath(trimmedSelector);
  }

  // Use CSS querySelectorAll with shadow DOM support
  try {
    const elements = searchShadowDOM
      ? querySelectorAllDeep(trimmedSelector)
      : Array.from(document.querySelectorAll(trimmedSelector));
    contentLogger.debug('querySelectorAll found elements', {
      selector: trimmedSelector,
      count: elements.length,
      searchShadowDOM
    });
    return elements;
  } catch (e) {
    contentLogger.error('Invalid selector in findElements', {
      selector: trimmedSelector,
      error: e.message
    });
    return [];
  }
}

/**
 * Find an element using multiple strategies, including Shadow DOM traversal
 * @param {string} selector - Selector string (can be CSS, ID, name, XPath, shadow path, etc.)
 * @param {Object} options - Options for element finding
 * @param {boolean} options.searchShadowDOM - Whether to search shadow DOM (default: true)
 * @returns {HTMLElement|null} - Found element or null
 */
function findElement(selector, options = {}) {
  const { searchShadowDOM = true } = options;

  if (!selector || typeof selector !== 'string') {
    return null;
  }

  // Trim and validate selector - reject empty/whitespace-only selectors
  const trimmedSelector = selector.trim();
  if (trimmedSelector.length === 0) {
    contentLogger.warn('Empty selector provided');
    return null;
  }

  // Check for shadow path notation (>>> separator)
  if (trimmedSelector.includes('>>>')) {
    contentLogger.debug('Detected shadow path selector', { selector: trimmedSelector });
    const shadowPathResult = findElementByShadowPath(trimmedSelector);
    if (shadowPathResult) {
      return shadowPathResult;
    }
    // If shadow path failed, don't try other strategies
    contentLogger.warn('Shadow path selector did not match any elements', { selector: trimmedSelector });
    return null;
  }

  // Check if selector is XPath - try XPath first if detected
  if (isXPathSelector(trimmedSelector)) {
    contentLogger.debug('Detected XPath selector', { selector: trimmedSelector });
    const xpathResult = evaluateXPath(trimmedSelector);
    if (xpathResult) {
      contentLogger.debug('Found element via XPath', { selector: trimmedSelector });
      return xpathResult;
    }
    // If XPath evaluation failed but it looked like XPath, don't try CSS variations
    // (they would likely fail anyway since / is not valid CSS)
    contentLogger.warn('XPath selector did not match any elements', { selector: trimmedSelector });
    return null;
  }

  // Use deep query if shadow DOM search is enabled
  const queryFn = searchShadowDOM ? querySelectorDeep : (sel) => document.querySelector(sel);

  // Try exact CSS selector first (with shadow DOM support)
  try {
    const element = queryFn(trimmedSelector);
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

  // Try each variation with shadow DOM support
  for (const variation of variations) {
    try {
      const element = queryFn(variation);
      if (element) {
        contentLogger.debug('Found element using variation', { original: selector, matched: variation });
        return element;
      }
    } catch (e) {
      // Invalid selector, try next
    }
  }

  // Try finding by visible text for buttons and links (with shadow DOM support)
  const textElement = searchShadowDOM
    ? findElementByTextDeep(trimmedSelector)
    : findElementByText(trimmedSelector);
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
// Frame/Iframe Support
// =============================================================================

/**
 * Get information about the current frame context
 * This is called from within each frame to identify itself
 * @returns {Promise<Object>} - Frame context information
 */
async function handleGetFrameInfo() {
  contentLogger.info('Getting frame info');

  try {
    const frameInfo = {
      isTopFrame: window === window.top,
      isIframe: window !== window.top,
      url: window.location.href,
      origin: window.location.origin,
      name: window.name || null,
      title: document.title || null,
      readyState: document.readyState,
      // Try to determine frame index by checking parent
      frameIndex: getFrameIndex(),
      // Check if we can access parent (same-origin check)
      canAccessParent: canAccessParent(),
      // Document information
      hasDocument: !!document.body,
      documentHeight: document.documentElement?.scrollHeight || 0,
      documentWidth: document.documentElement?.scrollWidth || 0,
      // Form and interactive element counts
      formCount: document.querySelectorAll('form').length,
      inputCount: document.querySelectorAll('input, textarea, select').length,
      linkCount: document.querySelectorAll('a[href]').length,
      buttonCount: document.querySelectorAll('button, input[type="submit"], input[type="button"]').length
    };

    return {
      success: true,
      frameInfo
    };
  } catch (error) {
    contentLogger.error('Failed to get frame info', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all frames/iframes in the current document
 * Only called from the top-level frame
 * @param {Object} options - Options for frame enumeration
 * @returns {Promise<Object>} - List of frames with their information
 */
async function handleGetFrames(options = {}) {
  contentLogger.info('Getting frames', { options });

  const { includeSameOriginDetails = true, includeNestedFrames = true } = options;

  try {
    // Only enumerate frames from the top document
    if (window !== window.top) {
      return {
        success: true,
        isTopFrame: false,
        message: 'Frame enumeration should be called from top frame',
        frames: []
      };
    }

    const frames = [];
    const iframeElements = document.querySelectorAll('iframe, frame');

    for (let i = 0; i < iframeElements.length; i++) {
      const iframe = iframeElements[i];
      const frameData = extractFrameData(iframe, i, includeSameOriginDetails);
      frames.push(frameData);

      // Recursively get nested frames if enabled and accessible
      if (includeNestedFrames && frameData.accessible) {
        try {
          const nestedFrames = getNestedFrames(iframe.contentDocument, `${i}`, includeSameOriginDetails);
          frameData.nestedFrames = nestedFrames;
        } catch (e) {
          frameData.nestedFrames = [];
          frameData.nestedError = 'Cross-origin restriction';
        }
      }
    }

    return {
      success: true,
      isTopFrame: true,
      url: window.location.href,
      frameCount: frames.length,
      frames,
      timestamp: Date.now()
    };
  } catch (error) {
    contentLogger.error('Failed to get frames', error);
    return { success: false, error: error.message };
  }
}

/**
 * Extract data from a frame/iframe element
 * @param {HTMLIFrameElement|HTMLFrameElement} iframe - The frame element
 * @param {number} index - Frame index
 * @param {boolean} includeSameOriginDetails - Whether to include detailed info for same-origin frames
 * @returns {Object} - Frame data
 */
function extractFrameData(iframe, index, includeSameOriginDetails = true) {
  const frameData = {
    index,
    tagName: iframe.tagName.toLowerCase(),
    id: iframe.id || null,
    name: iframe.name || null,
    src: iframe.src || null,
    selector: generateSelector(iframe),
    // Dimensions
    width: iframe.width || iframe.offsetWidth || null,
    height: iframe.height || iframe.offsetHeight || null,
    // Visibility
    isVisible: isElementVisible(iframe),
    // Sandbox attributes
    sandbox: iframe.sandbox?.value || null,
    // Allow attributes (for permissions)
    allow: iframe.allow || null,
    // Loading state
    loading: iframe.loading || 'eager',
    // Accessibility check
    accessible: false,
    crossOrigin: true,
    error: null
  };

  // Try to access frame content (only works for same-origin)
  try {
    const frameWindow = iframe.contentWindow;
    const frameDocument = iframe.contentDocument;

    if (frameDocument && frameWindow) {
      frameData.accessible = true;
      frameData.crossOrigin = false;

      if (includeSameOriginDetails) {
        frameData.frameUrl = frameWindow.location.href;
        frameData.frameOrigin = frameWindow.location.origin;
        frameData.frameTitle = frameDocument.title || null;
        frameData.readyState = frameDocument.readyState;
        frameData.formCount = frameDocument.querySelectorAll('form').length;
        frameData.inputCount = frameDocument.querySelectorAll('input, textarea, select').length;
        frameData.hasContent = !!frameDocument.body && frameDocument.body.innerHTML.trim().length > 0;
      }
    }
  } catch (e) {
    // Cross-origin frame - cannot access content
    frameData.accessible = false;
    frameData.crossOrigin = true;
    frameData.error = 'Cross-origin frame - content not accessible';
  }

  return frameData;
}

/**
 * Get nested frames from a document
 * @param {Document} doc - The document to search in
 * @param {string} parentPath - Path of parent frame (e.g., "0" or "0.1")
 * @param {boolean} includeSameOriginDetails - Whether to include detailed info
 * @returns {Array} - Array of nested frame data
 */
function getNestedFrames(doc, parentPath, includeSameOriginDetails = true) {
  if (!doc) return [];

  const nestedFrames = [];
  const iframeElements = doc.querySelectorAll('iframe, frame');

  for (let i = 0; i < iframeElements.length; i++) {
    const iframe = iframeElements[i];
    const framePath = `${parentPath}.${i}`;
    const frameData = extractFrameData(iframe, i, includeSameOriginDetails);
    frameData.path = framePath;

    // Recursively get more nested frames
    if (frameData.accessible) {
      try {
        frameData.nestedFrames = getNestedFrames(
          iframe.contentDocument,
          framePath,
          includeSameOriginDetails
        );
      } catch (e) {
        frameData.nestedFrames = [];
      }
    }

    nestedFrames.push(frameData);
  }

  return nestedFrames;
}

/**
 * Get the index of the current frame within its parent
 * @returns {number|null} - Frame index or null if top frame
 */
function getFrameIndex() {
  if (window === window.top) {
    return null; // Top frame has no index
  }

  try {
    const parentWindow = window.parent;
    const frames = parentWindow.frames;

    for (let i = 0; i < frames.length; i++) {
      if (frames[i] === window) {
        return i;
      }
    }
  } catch (e) {
    // Cross-origin parent - cannot determine index
    return -1;
  }

  return null;
}

/**
 * Check if we can access the parent frame
 * @returns {boolean} - True if parent is accessible
 */
function canAccessParent() {
  if (window === window.top) {
    return true; // Top frame, no parent to access
  }

  try {
    // Try to access parent's location - will throw if cross-origin
    const parentOrigin = window.parent.location.origin;
    return parentOrigin === window.location.origin;
  } catch (e) {
    return false;
  }
}

/**
 * Check if an element is visible
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} - True if visible
 */
function isElementVisible(element) {
  if (!element) return false;

  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    parseFloat(style.opacity) > 0 &&
    rect.width > 0 &&
    rect.height > 0
  );
}

/**
 * Find a frame by various identifiers
 * @param {Object} frameTarget - Frame identification { index, name, selector, path }
 * @returns {HTMLIFrameElement|HTMLFrameElement|null} - Found frame element or null
 */
function findFrame(frameTarget) {
  if (!frameTarget) return null;

  const { index, name, selector, path } = frameTarget;

  // Find by selector
  if (selector) {
    const frame = document.querySelector(selector);
    if (frame && (frame.tagName === 'IFRAME' || frame.tagName === 'FRAME')) {
      return frame;
    }
  }

  // Find by name
  if (name) {
    const frame = document.querySelector(`iframe[name="${CSS.escape(name)}"], frame[name="${CSS.escape(name)}"]`);
    if (frame) return frame;
  }

  // Find by index
  if (typeof index === 'number') {
    const frames = document.querySelectorAll('iframe, frame');
    if (index >= 0 && index < frames.length) {
      return frames[index];
    }
  }

  // Find by path (e.g., "0.1.2" for nested frames)
  if (path) {
    return findFrameByPath(path);
  }

  return null;
}

/**
 * Find a frame by its path (e.g., "0.1.2")
 * @param {string} path - Dot-separated frame indices
 * @returns {HTMLIFrameElement|HTMLFrameElement|null} - Found frame or null
 */
function findFrameByPath(path) {
  const indices = path.split('.').map(Number);
  let currentDoc = document;

  for (let i = 0; i < indices.length; i++) {
    const frameIndex = indices[i];
    const frames = currentDoc.querySelectorAll('iframe, frame');

    if (frameIndex >= frames.length) {
      return null;
    }

    const frame = frames[frameIndex];

    // If this is the last index, return the frame element
    if (i === indices.length - 1) {
      return frame;
    }

    // Otherwise, try to access the frame's document for next iteration
    try {
      currentDoc = frame.contentDocument;
      if (!currentDoc) return null;
    } catch (e) {
      // Cross-origin frame
      return null;
    }
  }

  return null;
}

// =============================================================================
// CAPTCHA Detection Handlers
// =============================================================================

/**
 * Detect all CAPTCHAs on the page
 * @param {Object} options - Detection options
 * @returns {Promise<Object>} - CAPTCHA detection results
 */
async function handleDetectCaptcha(options = {}) {
  contentLogger.info('Detecting CAPTCHAs', { options });

  try {
    initFormUtilities();

    if (!captchaDetector) {
      return {
        success: false,
        error: 'CaptchaDetector not available'
      };
    }

    const summary = captchaDetector.getSummary();

    // If CAPTCHAs detected, notify backend
    if (summary.hasCaptcha && summary.anyUnsolved) {
      notifyCaptchaDetected(summary);
    }

    return {
      success: true,
      ...summary,
      url: window.location.href,
      timestamp: Date.now()
    };
  } catch (error) {
    contentLogger.error('CAPTCHA detection failed', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get the state of a specific CAPTCHA element
 * @param {string} selector - CAPTCHA element selector
 * @returns {Promise<Object>} - CAPTCHA state
 */
async function handleGetCaptchaState(selector) {
  contentLogger.info('Getting CAPTCHA state', { selector });

  try {
    initFormUtilities();

    if (!captchaDetector) {
      return {
        success: false,
        error: 'CaptchaDetector not available'
      };
    }

    const element = selector ? document.querySelector(selector) : null;
    const container = element || document.body;

    // Use the container detection method
    const captchaInfo = captchaDetector.detectInContainer(container);

    if (!captchaInfo) {
      return {
        success: true,
        found: false,
        message: 'No CAPTCHA found in specified container'
      };
    }

    return {
      success: true,
      found: true,
      captcha: captchaInfo,
      timestamp: Date.now()
    };
  } catch (error) {
    contentLogger.error('Failed to get CAPTCHA state', error);
    return { success: false, error: error.message };
  }
}

/**
 * Notify the backend when a CAPTCHA is detected
 * @param {Object} captchaSummary - Summary of detected CAPTCHAs
 */
function notifyCaptchaDetected(captchaSummary) {
  try {
    chrome.runtime.sendMessage({
      type: 'captcha_detected',
      url: window.location.href,
      captcha: captchaSummary,
      timestamp: Date.now()
    });
    contentLogger.debug('CAPTCHA detection notification sent', { count: captchaSummary.count });
  } catch (error) {
    // Extension context might be invalidated
    contentLogger.warn('Could not notify background of CAPTCHA detection', { error: error.message });
  }
}

/**
 * Watch for CAPTCHA state changes
 * This sets up a MutationObserver to detect when CAPTCHAs are solved or appear
 * @param {Object} options - Watch options
 * @returns {Object} - Watch result with stop function reference
 */
function watchCaptchaState(options = {}) {
  const { interval = 1000, onStateChange } = options;

  let lastState = null;
  let watcherId = null;

  const checkState = () => {
    if (!captchaDetector) return;

    try {
      const currentState = captchaDetector.getSummary();

      // Compare with last state
      if (lastState) {
        const stateChanged =
          lastState.hasCaptcha !== currentState.hasCaptcha ||
          lastState.anyUnsolved !== currentState.anyUnsolved ||
          lastState.count !== currentState.count;

        if (stateChanged) {
          contentLogger.debug('CAPTCHA state changed', {
            wasSolved: !lastState.anyUnsolved,
            nowSolved: !currentState.anyUnsolved
          });

          // Notify via callback if provided
          if (onStateChange) {
            onStateChange(currentState, lastState);
          }

          // Notify background script
          chrome.runtime.sendMessage({
            type: 'captcha_state_changed',
            url: window.location.href,
            previousState: lastState,
            currentState: currentState,
            timestamp: Date.now()
          }).catch(() => {
            // Ignore errors (context invalidated)
          });
        }
      }

      lastState = currentState;
    } catch (error) {
      contentLogger.warn('Error checking CAPTCHA state', { error: error.message });
    }
  };

  // Start watching
  watcherId = setInterval(checkState, interval);
  checkState(); // Check immediately

  return {
    stop: () => {
      if (watcherId) {
        clearInterval(watcherId);
        watcherId = null;
      }
    },
    getLastState: () => lastState
  };
}

// =============================================================================
// Dynamic Form Handling
// =============================================================================

// Track initial fields on page load for detecting dynamic additions
let initialFields = new Set();
let initialFieldsRecorded = false;
let formObserver = null;
let formObserverCallbacks = [];
let dynamicFieldsAdded = [];

/**
 * Record the initial form fields on the page
 * Used to track which fields appeared dynamically
 */
function recordInitialFields() {
  if (initialFieldsRecorded) return;

  const allFields = document.querySelectorAll('input, textarea, select');
  allFields.forEach(field => {
    const selector = generateSelector(field);
    initialFields.add(selector);
  });
  initialFieldsRecorded = true;
  contentLogger.debug('Initial fields recorded', { count: initialFields.size });
}

// Record initial fields when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', recordInitialFields);
} else {
  recordInitialFields();
}

/**
 * Observe form changes and call registered callbacks when new fields appear
 * Uses MutationObserver to detect DOM changes
 * @param {Function} callback - Callback function to call when fields change
 * @returns {Object} - Object with stop() method to remove the observer
 */
function observeFormChanges(callback) {
  contentLogger.info('Setting up form change observer');

  // Add callback to list
  if (callback && typeof callback === 'function') {
    formObserverCallbacks.push(callback);
  }

  // If observer already exists, just add the callback
  if (formObserver) {
    return {
      stop: () => {
        const index = formObserverCallbacks.indexOf(callback);
        if (index > -1) {
          formObserverCallbacks.splice(index, 1);
        }
        // Only disconnect if no more callbacks
        if (formObserverCallbacks.length === 0 && formObserver) {
          formObserver.disconnect();
          formObserver = null;
        }
      },
      isObserving: true
    };
  }

  // Create new observer
  formObserver = new MutationObserver((mutations) => {
    let newFieldsFound = false;
    const addedFields = [];

    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        // Check added nodes for form fields
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the node itself is a form field
            if (isFormFieldElement(node)) {
              const fieldInfo = extractDynamicFieldInfo(node);
              addedFields.push(fieldInfo);
              dynamicFieldsAdded.push(fieldInfo);
              newFieldsFound = true;
            }
            // Check for form fields within the added node
            const fields = node.querySelectorAll?.('input, textarea, select');
            if (fields) {
              fields.forEach(field => {
                const fieldInfo = extractDynamicFieldInfo(field);
                addedFields.push(fieldInfo);
                dynamicFieldsAdded.push(fieldInfo);
                newFieldsFound = true;
              });
            }
          }
        });
      } else if (mutation.type === 'attributes') {
        // Field visibility might have changed
        const target = mutation.target;
        if (isFormFieldElement(target)) {
          const style = window.getComputedStyle(target);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            const fieldInfo = extractDynamicFieldInfo(target);
            const wasInitiallyVisible = initialFields.has(fieldInfo.selector);
            if (!wasInitiallyVisible) {
              addedFields.push(fieldInfo);
              newFieldsFound = true;
            }
          }
        }
      }
    }

    if (newFieldsFound) {
      contentLogger.debug('New form fields detected', { count: addedFields.length });

      // Call all registered callbacks
      formObserverCallbacks.forEach(cb => {
        try {
          cb({
            type: 'fields_added',
            fields: addedFields,
            timestamp: Date.now()
          });
        } catch (e) {
          contentLogger.warn('Form observer callback error', { error: e.message });
        }
      });
    }
  });

  // Start observing
  formObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'hidden', 'disabled']
  });

  contentLogger.info('Form change observer started');

  return {
    stop: () => {
      const index = formObserverCallbacks.indexOf(callback);
      if (index > -1) {
        formObserverCallbacks.splice(index, 1);
      }
      if (formObserverCallbacks.length === 0 && formObserver) {
        formObserver.disconnect();
        formObserver = null;
        contentLogger.info('Form change observer stopped');
      }
    },
    isObserving: true
  };
}

/**
 * Check if an element is a form field
 * @param {Element} element - Element to check
 * @returns {boolean} - True if element is a form field
 */
function isFormFieldElement(element) {
  if (!element || !element.tagName) return false;
  const tagName = element.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

/**
 * Extract information about a dynamic form field
 * @param {Element} field - Form field element
 * @returns {Object} - Field information
 */
function extractDynamicFieldInfo(field) {
  return {
    selector: generateSelector(field),
    tagName: field.tagName.toLowerCase(),
    type: field.type || field.tagName.toLowerCase(),
    name: field.name || null,
    id: field.id || null,
    label: findLabel(field),
    placeholder: field.placeholder || null,
    required: field.required || false,
    disabled: field.disabled || false,
    isVisible: isElementVisible(field),
    value: field.type !== 'password' ? (field.value || null) : '[hidden]',
    timestamp: Date.now()
  };
}

/**
 * Wait for a specific field to appear dynamically
 * @param {string} selector - CSS selector, XPath, or other selector for the field
 * @param {number} timeout - Maximum time to wait in milliseconds
 * @returns {Promise<Object>} - Result with field info when found
 */
async function waitForDynamicField(selector, timeout = 10000) {
  contentLogger.info('Waiting for dynamic field', { selector, timeout });

  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    // Check if field already exists
    const existingField = findElement(selector);
    if (existingField && isElementVisible(existingField)) {
      const fieldInfo = extractDynamicFieldInfo(existingField);
      resolve({
        success: true,
        found: true,
        field: fieldInfo,
        waitTime: Date.now() - startTime
      });
      return;
    }

    // Set up timeout
    const timeoutId = setTimeout(() => {
      observer.disconnect();
      resolve({
        success: true,
        found: false,
        selector,
        waitTime: timeout,
        error: `Field not found within ${timeout}ms`
      });
    }, timeout);

    // Set up mutation observer
    const observer = new MutationObserver((mutations) => {
      const field = findElement(selector);
      if (field && isElementVisible(field)) {
        clearTimeout(timeoutId);
        observer.disconnect();

        const fieldInfo = extractDynamicFieldInfo(field);
        contentLogger.debug('Dynamic field found', { selector, waitTime: Date.now() - startTime });

        resolve({
          success: true,
          found: true,
          field: fieldInfo,
          waitTime: Date.now() - startTime
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden', 'disabled']
    });
  });
}

/**
 * Detect if the page/form is currently loading content
 * Looks for loading indicators like spinners, loading classes, overlays
 * @returns {Object} - Loading detection result
 */
function detectAjaxLoading() {
  contentLogger.debug('Detecting AJAX loading state');

  const loadingIndicators = [];

  // Common loading class patterns
  const loadingClassPatterns = [
    /loading/i,
    /spinner/i,
    /loader/i,
    /pending/i,
    /fetching/i,
    /processing/i,
    /ajax/i,
    /busy/i
  ];

  // Common loading element selectors
  const loadingSelectors = [
    '.loading',
    '.loader',
    '.spinner',
    '.loading-spinner',
    '.ajax-loader',
    '.loading-overlay',
    '[class*="loading"]',
    '[class*="spinner"]',
    '[class*="loader"]',
    '.sk-spinner',  // SpinKit
    '.lds-ring',    // loading.io
    '.fa-spinner',  // FontAwesome spinner
    '[role="progressbar"]',
    '[aria-busy="true"]',
    'progress:not([value="100"])'
  ];

  // Check for loading elements
  for (const selector of loadingSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (isElementVisible(el)) {
          loadingIndicators.push({
            type: 'element',
            selector: generateSelector(el),
            tagName: el.tagName.toLowerCase(),
            className: el.className
          });
        }
      });
    } catch (e) {
      // Invalid selector, continue
    }
  }

  // Check body/html for loading classes
  const rootElements = [document.body, document.documentElement];
  rootElements.forEach(el => {
    if (el) {
      const classes = el.className || '';
      for (const pattern of loadingClassPatterns) {
        if (pattern.test(classes)) {
          loadingIndicators.push({
            type: 'body_class',
            className: classes,
            pattern: pattern.toString()
          });
        }
      }
    }
  });

  // Check for disabled form elements (might indicate loading)
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    const disabledCount = form.querySelectorAll('input:disabled, button:disabled, select:disabled').length;
    const totalFields = form.querySelectorAll('input, button, select').length;

    if (totalFields > 0 && disabledCount === totalFields) {
      loadingIndicators.push({
        type: 'form_disabled',
        formSelector: generateSelector(form)
      });
    }
  });

  // Check for overlay elements covering forms
  const overlaySelectors = [
    '.overlay',
    '.modal-backdrop',
    '.loading-overlay',
    '[class*="overlay"]'
  ];

  for (const selector of overlaySelectors) {
    try {
      const overlays = document.querySelectorAll(selector);
      overlays.forEach(overlay => {
        if (isElementVisible(overlay)) {
          const style = window.getComputedStyle(overlay);
          // Check if it's actually covering content (has position and z-index)
          if (style.position === 'fixed' || style.position === 'absolute') {
            loadingIndicators.push({
              type: 'overlay',
              selector: generateSelector(overlay)
            });
          }
        }
      });
    } catch (e) {
      // Invalid selector, continue
    }
  }

  const isLoading = loadingIndicators.length > 0;

  contentLogger.debug('AJAX loading detection result', {
    isLoading,
    indicatorCount: loadingIndicators.length
  });

  return {
    isLoading,
    indicators: loadingIndicators,
    timestamp: Date.now()
  };
}

/**
 * Wait until the form stops changing (becomes stable)
 * Useful after triggering an action that causes AJAX loading
 * @param {number} timeout - Maximum time to wait in milliseconds
 * @param {number} stabilityThreshold - Time with no changes to consider stable (ms)
 * @returns {Promise<Object>} - Result indicating if form became stable
 */
async function waitForFormStable(timeout = 10000, stabilityThreshold = 500) {
  contentLogger.info('Waiting for form to stabilize', { timeout, stabilityThreshold });

  const startTime = Date.now();
  let lastChangeTime = Date.now();
  let lastFieldCount = document.querySelectorAll('input, textarea, select').length;
  let lastLoadingState = detectAjaxLoading().isLoading;

  return new Promise((resolve) => {
    let checkInterval = null;
    let timeoutId = null;

    const cleanup = () => {
      if (checkInterval) clearInterval(checkInterval);
      if (timeoutId) clearTimeout(timeoutId);
    };

    // Set up timeout
    timeoutId = setTimeout(() => {
      cleanup();
      resolve({
        success: true,
        stable: false,
        reason: 'timeout',
        waitTime: Date.now() - startTime,
        finalFieldCount: document.querySelectorAll('input, textarea, select').length
      });
    }, timeout);

    // Check for stability periodically
    checkInterval = setInterval(() => {
      const currentFieldCount = document.querySelectorAll('input, textarea, select').length;
      const currentLoadingState = detectAjaxLoading().isLoading;

      // Check if anything changed
      if (currentFieldCount !== lastFieldCount || currentLoadingState !== lastLoadingState) {
        lastChangeTime = Date.now();
        lastFieldCount = currentFieldCount;
        lastLoadingState = currentLoadingState;
      }

      // Check if stable for threshold duration
      const timeSinceLastChange = Date.now() - lastChangeTime;
      if (timeSinceLastChange >= stabilityThreshold && !currentLoadingState) {
        cleanup();
        contentLogger.debug('Form stabilized', {
          waitTime: Date.now() - startTime,
          fieldCount: currentFieldCount
        });

        resolve({
          success: true,
          stable: true,
          waitTime: Date.now() - startTime,
          fieldCount: currentFieldCount,
          stabilityDuration: timeSinceLastChange
        });
      }
    }, 100); // Check every 100ms
  });
}

/**
 * Get fields that appeared after the initial page load
 * @returns {Object} - Object containing list of dynamically added fields
 */
function getDynamicFields() {
  contentLogger.info('Getting dynamic fields');

  // Record initial fields if not done
  if (!initialFieldsRecorded) {
    recordInitialFields();
  }

  const allCurrentFields = document.querySelectorAll('input, textarea, select');
  const dynamicFields = [];

  allCurrentFields.forEach(field => {
    const selector = generateSelector(field);
    if (!initialFields.has(selector)) {
      dynamicFields.push(extractDynamicFieldInfo(field));
    }
  });

  // Also include fields tracked by observer
  const observedFields = dynamicFieldsAdded.filter(field => {
    // Check if field still exists
    try {
      const element = document.querySelector(field.selector);
      return element && isElementVisible(element);
    } catch (e) {
      return false;
    }
  });

  // Merge and deduplicate
  const allDynamicSelectors = new Set();
  const mergedFields = [];

  [...dynamicFields, ...observedFields].forEach(field => {
    if (!allDynamicSelectors.has(field.selector)) {
      allDynamicSelectors.add(field.selector);
      mergedFields.push(field);
    }
  });

  contentLogger.debug('Dynamic fields retrieved', { count: mergedFields.length });

  return {
    success: true,
    fields: mergedFields,
    count: mergedFields.length,
    initialFieldCount: initialFields.size,
    currentFieldCount: allCurrentFields.length,
    timestamp: Date.now()
  };
}

/**
 * Fill a dynamically loaded field with retry logic
 * Waits for the field to appear if not immediately available
 * @param {string} selector - Selector for the field
 * @param {*} value - Value to fill
 * @param {Object} options - Fill options
 * @returns {Promise<Object>} - Fill result
 */
async function fillDynamicField(selector, value, options = {}) {
  const {
    timeout = 10000,
    retryInterval = 500,
    humanLike = true
  } = options;

  contentLogger.info('Filling dynamic field', { selector, timeout });

  const startTime = Date.now();
  let lastError = null;

  while (Date.now() - startTime < timeout) {
    try {
      // Try to find the element
      const element = findElement(selector);

      if (element && isElementVisible(element) && !element.disabled) {
        // Field found and ready, fill it
        await fillElementAdvanced(element, value, { humanLike });

        contentLogger.debug('Dynamic field filled', {
          selector,
          waitTime: Date.now() - startTime
        });

        return {
          success: true,
          filled: true,
          selector,
          value: element.type !== 'password' ? value : '[hidden]',
          waitTime: Date.now() - startTime
        };
      }

      // Wait before retrying
      await sleep(retryInterval);
    } catch (error) {
      lastError = error;
      await sleep(retryInterval);
    }
  }

  // Timeout reached
  contentLogger.warn('Failed to fill dynamic field', {
    selector,
    timeout,
    error: lastError?.message
  });

  return {
    success: false,
    filled: false,
    selector,
    error: lastError?.message || `Field not found or not ready within ${timeout}ms`,
    waitTime: Date.now() - startTime
  };
}

/**
 * Handle message to observe form changes
 * @param {Object} options - Observer options
 * @returns {Promise<Object>} - Observer setup result
 */
async function handleObserveFormChanges(options = {}) {
  contentLogger.info('Setting up form change observation', { options });

  try {
    const observerResult = observeFormChanges((event) => {
      // Notify background script of form changes
      try {
        chrome.runtime.sendMessage({
          type: 'form_fields_changed',
          url: window.location.href,
          event: event,
          timestamp: Date.now()
        });
      } catch (e) {
        // Context might be invalidated
      }
    });

    return {
      success: true,
      observing: true,
      message: 'Form change observer started',
      initialFieldCount: initialFields.size,
      timestamp: Date.now()
    };
  } catch (error) {
    contentLogger.error('Failed to set up form observer', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle message to wait for a dynamic field
 * @param {string} selector - Field selector
 * @param {number} timeout - Wait timeout
 * @returns {Promise<Object>} - Wait result
 */
async function handleWaitForDynamicField(selector, timeout = 10000) {
  return waitForDynamicField(selector, timeout);
}

/**
 * Handle message to detect AJAX loading
 * @returns {Promise<Object>} - Loading detection result
 */
async function handleDetectAjaxLoading() {
  const result = detectAjaxLoading();
  return {
    success: true,
    ...result
  };
}

/**
 * Handle message to wait for form to stabilize
 * @param {number} timeout - Maximum wait time
 * @param {number} stabilityThreshold - Time with no changes to consider stable
 * @returns {Promise<Object>} - Stability result
 */
async function handleWaitForFormStable(timeout = 10000, stabilityThreshold = 500) {
  return waitForFormStable(timeout, stabilityThreshold);
}

/**
 * Handle message to get dynamic fields
 * @returns {Promise<Object>} - Dynamic fields result
 */
async function handleGetDynamicFields() {
  return getDynamicFields();
}

/**
 * Handle message to fill a dynamic field
 * @param {string} selector - Field selector
 * @param {*} value - Value to fill
 * @param {Object} options - Fill options
 * @returns {Promise<Object>} - Fill result
 */
async function handleFillDynamicField(selector, value, options = {}) {
  return fillDynamicField(selector, value, options);
}

// =============================================================================
// Wizard/Multi-Step Form Support
// =============================================================================

/**
 * Detect if the current page has a wizard/multi-step form
 * @returns {Object} Wizard detection result
 */
function detectFormWizard() {
  contentLogger.info('Detecting form wizard');

  const result = {
    isWizard: false,
    confidence: 0,
    indicators: {
      stepIndicators: [],
      progressBars: [],
      navigationButtons: [],
      hiddenFieldsets: [],
      stepContainers: []
    },
    forms: []
  };

  // Step indicator patterns (1, 2, 3... or Step 1, Step 2...)
  const stepIndicatorSelectors = [
    '.step-indicator', '.step-indicators', '.steps', '.wizard-steps',
    '.progress-steps', '.step-nav', '.step-navigation',
    '[class*="step-indicator"]', '[class*="wizard-step"]',
    '[class*="progress-step"]', '.stepper', '.stepper-indicator',
    'ol.steps', 'ul.steps', '.step-list', '.step-dots',
    '[role="tablist"]', '.nav-tabs.wizard', '.nav-pills.wizard'
  ];

  // Progress bar patterns
  const progressBarSelectors = [
    '.progress-bar', '.progress', '[role="progressbar"]',
    '[class*="progress-bar"]', '[class*="wizard-progress"]',
    '.step-progress', '.form-progress', '.completion-bar'
  ];

  // Navigation button patterns
  const navButtonPatterns = {
    next: /^(next|continue|proceed|forward|siguiente|weiter|suivant|avanti)$/i,
    prev: /^(prev(ious)?|back|go\s*back|anterior|zurück|précédent|indietro)$/i,
    submit: /^(submit|finish|complete|done|send|enviar|absenden|envoyer|invia)$/i
  };

  // Step container patterns
  const stepContainerSelectors = [
    '[data-step]', '[class*="step-content"]', '[class*="wizard-content"]',
    '[class*="wizard-page"]', '[class*="form-step"]', '[class*="step-panel"]',
    'fieldset.step', 'div.step', '.wizard-pane', '.step-pane',
    '[role="tabpanel"]'
  ];

  // Find step indicators
  for (const selector of stepIndicatorSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (isElementVisible(el)) {
          result.indicators.stepIndicators.push({
            selector: generateSelector(el),
            text: el.textContent.trim().substring(0, 100),
            childCount: el.children.length
          });
        }
      });
    } catch (e) {
      // Invalid selector, continue
    }
  }

  // Find progress bars
  for (const selector of progressBarSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (isElementVisible(el)) {
          const width = el.style.width || window.getComputedStyle(el).width;
          const ariaValue = el.getAttribute('aria-valuenow');
          result.indicators.progressBars.push({
            selector: generateSelector(el),
            width: width,
            percentage: ariaValue ? parseInt(ariaValue, 10) : null
          });
        }
      });
    } catch (e) {
      // Invalid selector, continue
    }
  }

  // Find navigation buttons
  const allButtons = document.querySelectorAll('button, [role="button"], input[type="button"], a.btn, a.button');
  allButtons.forEach(btn => {
    const text = (btn.textContent || btn.value || btn.getAttribute('aria-label') || '').trim();
    const className = (btn.className || '').toLowerCase();

    let type = null;
    if (navButtonPatterns.next.test(text) || className.includes('next') || className.includes('continue')) {
      type = 'next';
    } else if (navButtonPatterns.prev.test(text) || className.includes('prev') || className.includes('back')) {
      type = 'prev';
    } else if (navButtonPatterns.submit.test(text) || btn.type === 'submit') {
      type = 'submit';
    }

    if (type && isElementVisible(btn)) {
      result.indicators.navigationButtons.push({
        selector: generateSelector(btn),
        text: text.substring(0, 50),
        type: type,
        disabled: btn.disabled || btn.hasAttribute('disabled')
      });
    }
  });

  // Find step containers and fieldsets
  for (const selector of stepContainerSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const isVisible = isElementVisible(el);
        const stepAttr = el.getAttribute('data-step');
        result.indicators.stepContainers.push({
          selector: generateSelector(el),
          visible: isVisible,
          dataStep: stepAttr,
          fieldCount: el.querySelectorAll('input, textarea, select').length
        });
        if (!isVisible) {
          result.indicators.hiddenFieldsets.push({
            selector: generateSelector(el),
            dataStep: stepAttr,
            fieldCount: el.querySelectorAll('input, textarea, select').length
          });
        }
      });
    } catch (e) {
      // Invalid selector, continue
    }
  }

  // Also check for fieldsets that might be hidden
  const fieldsets = document.querySelectorAll('fieldset');
  fieldsets.forEach(fs => {
    const isVisible = isElementVisible(fs);
    const stepAttr = fs.getAttribute('data-step');
    const existingContainer = result.indicators.stepContainers.find(
      c => c.selector === generateSelector(fs)
    );
    if (!existingContainer) {
      result.indicators.stepContainers.push({
        selector: generateSelector(fs),
        visible: isVisible,
        dataStep: stepAttr,
        fieldCount: fs.querySelectorAll('input, textarea, select').length
      });
      if (!isVisible && fs.querySelectorAll('input, textarea, select').length > 0) {
        result.indicators.hiddenFieldsets.push({
          selector: generateSelector(fs),
          dataStep: stepAttr,
          fieldCount: fs.querySelectorAll('input, textarea, select').length
        });
      }
    }
  });

  // Analyze forms for wizard patterns
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    const formAnalysis = analyzeFormForWizard(form);
    if (formAnalysis.hasWizardPatterns) {
      result.forms.push(formAnalysis);
    }
  });

  // Calculate confidence score
  let confidence = 0;
  if (result.indicators.stepIndicators.length > 0) confidence += 30;
  if (result.indicators.progressBars.length > 0) confidence += 20;
  if (result.indicators.navigationButtons.filter(b => b.type === 'next').length > 0) confidence += 25;
  if (result.indicators.navigationButtons.filter(b => b.type === 'prev').length > 0) confidence += 15;
  if (result.indicators.hiddenFieldsets.length > 0) confidence += 20;
  if (result.indicators.stepContainers.length > 1) confidence += 15;

  result.confidence = Math.min(100, confidence);
  result.isWizard = confidence >= 40;

  contentLogger.debug('Wizard detection result', {
    isWizard: result.isWizard,
    confidence: result.confidence
  });

  return result;
}

/**
 * Analyze a specific form for wizard patterns
 * @param {HTMLFormElement} form - Form element to analyze
 * @returns {Object} Form wizard analysis
 */
function analyzeFormForWizard(form) {
  const analysis = {
    selector: generateSelector(form),
    hasWizardPatterns: false,
    stepCount: 0,
    currentStep: 0,
    steps: [],
    navigation: {
      nextButton: null,
      prevButton: null,
      submitButton: null
    }
  };

  // Find step-like containers within the form
  const stepSelectors = [
    '[data-step]', '.step', '.wizard-step', '.form-step',
    'fieldset', '.step-content', '.wizard-content', '.step-panel',
    '[role="tabpanel"]', '.tab-pane'
  ];

  const potentialSteps = [];
  for (const selector of stepSelectors) {
    try {
      const elements = form.querySelectorAll(selector);
      elements.forEach(el => {
        // Only count elements that contain form fields
        const fieldCount = el.querySelectorAll('input, textarea, select').length;
        if (fieldCount > 0) {
          potentialSteps.push({
            element: el,
            selector: generateSelector(el),
            visible: isElementVisible(el),
            dataStep: el.getAttribute('data-step'),
            fieldCount: fieldCount
          });
        }
      });
    } catch (e) {
      // Invalid selector
    }
  }

  // Deduplicate steps (an element might match multiple selectors)
  const uniqueSteps = [];
  const seenElements = new Set();
  for (const step of potentialSteps) {
    if (!seenElements.has(step.element)) {
      seenElements.add(step.element);
      uniqueSteps.push(step);
    }
  }

  // Determine if this looks like a wizard
  const visibleSteps = uniqueSteps.filter(s => s.visible);
  const hiddenSteps = uniqueSteps.filter(s => !s.visible);

  if (uniqueSteps.length > 1 && hiddenSteps.length > 0) {
    analysis.hasWizardPatterns = true;
    analysis.stepCount = uniqueSteps.length;

    // Find current step (first visible one, or step with active class)
    let currentStepIndex = 0;
    for (let i = 0; i < uniqueSteps.length; i++) {
      const step = uniqueSteps[i];
      if (step.visible || step.element.classList.contains('active') ||
          step.element.classList.contains('current')) {
        currentStepIndex = i;
        break;
      }
    }
    analysis.currentStep = currentStepIndex + 1; // 1-based

    analysis.steps = uniqueSteps.map((step, index) => ({
      stepNumber: index + 1,
      selector: step.selector,
      visible: step.visible,
      dataStep: step.dataStep,
      fieldCount: step.fieldCount,
      isCurrent: index === currentStepIndex
    }));
  }

  // Find navigation buttons within the form
  const buttons = form.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]');
  buttons.forEach(btn => {
    const text = (btn.textContent || btn.value || '').toLowerCase().trim();
    const className = (btn.className || '').toLowerCase();

    if (!analysis.navigation.nextButton &&
        (text.match(/^(next|continue|proceed|forward)/i) || className.includes('next') || className.includes('continue'))) {
      analysis.navigation.nextButton = {
        selector: generateSelector(btn),
        text: (btn.textContent || btn.value || '').trim(),
        disabled: btn.disabled
      };
    }
    if (!analysis.navigation.prevButton &&
        (text.match(/^(prev|back|previous)/i) || className.includes('prev') || className.includes('back'))) {
      analysis.navigation.prevButton = {
        selector: generateSelector(btn),
        text: (btn.textContent || btn.value || '').trim(),
        disabled: btn.disabled
      };
    }
    if (!analysis.navigation.submitButton &&
        (btn.type === 'submit' || text.match(/^(submit|finish|complete|done|send)/i))) {
      analysis.navigation.submitButton = {
        selector: generateSelector(btn),
        text: (btn.textContent || btn.value || '').trim(),
        disabled: btn.disabled
      };
    }
  });

  return analysis;
}

/**
 * Get the current wizard state (step info, visible fields, etc.)
 * @param {string} formSelector - Optional form selector
 * @returns {Object} Wizard state
 */
function getWizardState(formSelector = null) {
  contentLogger.info('Getting wizard state', { formSelector });

  const form = formSelector
    ? document.querySelector(formSelector)
    : document.querySelector('form');

  if (!form) {
    return {
      success: false,
      error: 'No form found'
    };
  }

  const wizardInfo = detectFormWizard();
  const formAnalysis = analyzeFormForWizard(form);

  // Find all visible form fields
  const visibleFields = [];
  const allFields = form.querySelectorAll('input, textarea, select');
  allFields.forEach(field => {
    if (isElementVisible(field) && field.type !== 'hidden') {
      visibleFields.push({
        selector: generateSelector(field),
        type: field.type || field.tagName.toLowerCase(),
        name: field.name || null,
        id: field.id || null,
        label: findLabel(field),
        value: field.type !== 'password' ? field.value : '[hidden]',
        required: field.required,
        disabled: field.disabled
      });
    }
  });

  // Determine current step number
  let currentStep = 1;
  let totalSteps = 1;

  if (formAnalysis.hasWizardPatterns) {
    currentStep = formAnalysis.currentStep;
    totalSteps = formAnalysis.stepCount;
  } else if (wizardInfo.indicators.stepContainers.length > 1) {
    totalSteps = wizardInfo.indicators.stepContainers.length;
    // Current step is based on the first visible container's position
    for (let i = 0; i < wizardInfo.indicators.stepContainers.length; i++) {
      if (wizardInfo.indicators.stepContainers[i].visible) {
        currentStep = i + 1;
        break;
      }
    }
  }

  // Detect step indicators with step numbers
  const stepIndicatorInfo = [];
  wizardInfo.indicators.stepIndicators.forEach(indicator => {
    const el = document.querySelector(indicator.selector);
    if (el) {
      // Find child elements that might indicate individual steps
      const stepElements = el.querySelectorAll('.step, [class*="step"], li, .dot');
      stepElements.forEach((stepEl, idx) => {
        const isActive = stepEl.classList.contains('active') ||
                        stepEl.classList.contains('current') ||
                        stepEl.getAttribute('aria-current') === 'step';
        const isComplete = stepEl.classList.contains('complete') ||
                          stepEl.classList.contains('done') ||
                          stepEl.classList.contains('completed');
        stepIndicatorInfo.push({
          stepNumber: idx + 1,
          text: stepEl.textContent.trim().substring(0, 50),
          isActive,
          isComplete
        });
        if (isActive) {
          currentStep = idx + 1;
        }
      });
      if (stepElements.length > 0) {
        totalSteps = Math.max(totalSteps, stepElements.length);
      }
    }
  });

  return {
    success: true,
    isWizard: wizardInfo.isWizard,
    currentStep,
    totalSteps,
    visibleFieldCount: visibleFields.length,
    visibleFields,
    stepIndicators: stepIndicatorInfo,
    progressBars: wizardInfo.indicators.progressBars,
    navigation: formAnalysis.navigation,
    formSelector: generateSelector(form)
  };
}

/**
 * Navigate to the next or previous wizard step
 * @param {string} direction - 'next' or 'prev'
 * @param {string} formSelector - Optional form selector
 * @returns {Promise<Object>} Navigation result
 */
async function navigateWizardStep(direction, formSelector = null) {
  contentLogger.info('Navigating wizard step', { direction, formSelector });

  const form = formSelector
    ? document.querySelector(formSelector)
    : document.querySelector('form');

  if (!form) {
    return { success: false, error: 'No form found' };
  }

  // Get current state before navigation
  const stateBefore = getWizardState(formSelector);

  // Find the appropriate navigation button
  let buttonToClick = null;
  const buttonPatterns = direction === 'next'
    ? ['next', 'continue', 'proceed', 'forward', 'siguiente', 'weiter', 'suivant']
    : ['prev', 'previous', 'back', 'anterior', 'zurück', 'précédent'];

  // Search within the form first
  const formButtons = form.querySelectorAll('button, [role="button"], input[type="button"], a.btn');
  for (const btn of formButtons) {
    if (!isElementVisible(btn) || btn.disabled) continue;

    const text = (btn.textContent || btn.value || btn.getAttribute('aria-label') || '').toLowerCase().trim();
    const className = (btn.className || '').toLowerCase();
    const dataAction = (btn.getAttribute('data-action') || '').toLowerCase();

    for (const pattern of buttonPatterns) {
      if (text.includes(pattern) || className.includes(pattern) || dataAction.includes(pattern)) {
        buttonToClick = btn;
        break;
      }
    }
    if (buttonToClick) break;
  }

  // If not found in form, search the page (some wizards have external nav)
  if (!buttonToClick) {
    const pageButtons = document.querySelectorAll('button, [role="button"], input[type="button"], a.btn');
    for (const btn of pageButtons) {
      if (!isElementVisible(btn) || btn.disabled) continue;
      if (form.contains(btn)) continue; // Already checked

      const text = (btn.textContent || btn.value || btn.getAttribute('aria-label') || '').toLowerCase().trim();
      const className = (btn.className || '').toLowerCase();

      for (const pattern of buttonPatterns) {
        if (text.includes(pattern) || className.includes(pattern)) {
          buttonToClick = btn;
          break;
        }
      }
      if (buttonToClick) break;
    }
  }

  if (!buttonToClick) {
    return {
      success: false,
      error: `No ${direction} button found`,
      currentState: stateBefore
    };
  }

  // Click the button
  try {
    buttonToClick.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(CONTENT_CONFIG.SCROLL_WAIT);

    await simulateHumanClick(buttonToClick);
    await sleep(CONTENT_CONFIG.MULTI_STEP_DELAY);

    // Get state after navigation
    const stateAfter = getWizardState(formSelector);

    return {
      success: true,
      direction,
      buttonClicked: generateSelector(buttonToClick),
      buttonText: (buttonToClick.textContent || buttonToClick.value || '').trim(),
      previousStep: stateBefore.currentStep,
      newStep: stateAfter.currentStep,
      totalSteps: stateAfter.totalSteps,
      currentState: stateAfter
    };
  } catch (error) {
    contentLogger.error('Failed to navigate wizard step', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fill only the visible fields in the current wizard step
 * @param {Object} data - Data to fill
 * @param {Object} options - Fill options
 * @returns {Promise<Object>} Fill result
 */
async function fillWizardStep(data, options = {}) {
  contentLogger.info('Filling wizard step', { options });

  const { humanLike = true, formSelector = null } = options;

  const form = formSelector
    ? document.querySelector(formSelector)
    : document.querySelector('form');

  if (!form) {
    return { success: false, error: 'No form found' };
  }

  // Get current wizard state to know which fields are visible
  const wizardState = getWizardState(formSelector);

  const results = [];
  const filledFields = [];

  // Only fill visible fields
  for (const visibleField of wizardState.visibleFields) {
    if (visibleField.disabled) continue;

    // Try to find matching data for this field
    let value = null;

    // Match by name, id, or fieldType from data
    if (data[visibleField.name]) {
      value = data[visibleField.name];
    } else if (data[visibleField.id]) {
      value = data[visibleField.id];
    } else if (visibleField.label) {
      // Try to match by label (case-insensitive)
      const labelLower = visibleField.label.toLowerCase();
      for (const [key, val] of Object.entries(data)) {
        if (key.toLowerCase() === labelLower || labelLower.includes(key.toLowerCase())) {
          value = val;
          break;
        }
      }
    }

    if (value !== null && value !== undefined) {
      try {
        const element = document.querySelector(visibleField.selector);
        if (element) {
          await fillElementAdvanced(element, value, { humanLike });
          results.push({ selector: visibleField.selector, success: true, name: visibleField.name });
          filledFields.push(visibleField.selector);
        }
      } catch (error) {
        results.push({ selector: visibleField.selector, success: false, error: error.message });
      }
    }
  }

  return {
    success: true,
    currentStep: wizardState.currentStep,
    totalSteps: wizardState.totalSteps,
    filledCount: filledFields.length,
    totalVisibleFields: wizardState.visibleFieldCount,
    results
  };
}

/**
 * Check if the current step is the last step of the wizard
 * @param {string} formSelector - Optional form selector
 * @returns {Object} Result indicating if on last step
 */
function isLastStep(formSelector = null) {
  const state = getWizardState(formSelector);

  if (!state.success) {
    return state;
  }

  // Check if current step equals total steps
  const isLast = state.currentStep >= state.totalSteps;

  // Additional checks: look for submit button visibility and next button absence
  let hasVisibleSubmit = false;
  let hasVisibleNext = false;

  if (state.navigation.submitButton) {
    const submitBtn = document.querySelector(state.navigation.submitButton.selector);
    if (submitBtn && isElementVisible(submitBtn) && !submitBtn.disabled) {
      hasVisibleSubmit = true;
    }
  }

  if (state.navigation.nextButton) {
    const nextBtn = document.querySelector(state.navigation.nextButton.selector);
    if (nextBtn && isElementVisible(nextBtn) && !nextBtn.disabled) {
      hasVisibleNext = true;
    }
  }

  // On last step, we typically have submit visible and no next button
  const indicatesLastStep = hasVisibleSubmit && !hasVisibleNext;

  return {
    success: true,
    isLastStep: isLast || indicatesLastStep,
    currentStep: state.currentStep,
    totalSteps: state.totalSteps,
    hasSubmitButton: hasVisibleSubmit,
    hasNextButton: hasVisibleNext
  };
}

/**
 * Find the final submit button for the wizard
 * @param {string} formSelector - Optional form selector
 * @returns {Object} Submit button info
 */
function getSubmitButton(formSelector = null) {
  const form = formSelector
    ? document.querySelector(formSelector)
    : document.querySelector('form');

  if (!form) {
    return { success: false, error: 'No form found' };
  }

  // Priority order for finding submit button
  const submitButtonSelectors = [
    'input[type="submit"]',
    'button[type="submit"]',
    'button:not([type])',  // Default button type is submit in forms
    '[class*="submit"]',
    '[class*="finish"]',
    '[class*="complete"]'
  ];

  const submitPatterns = /submit|finish|complete|done|send|place order|confirm|create|sign up|register/i;

  let submitButton = null;

  // First, try explicit submit buttons
  for (const selector of submitButtonSelectors.slice(0, 2)) {
    const btn = form.querySelector(selector);
    if (btn && isElementVisible(btn) && !btn.disabled) {
      submitButton = btn;
      break;
    }
  }

  // If not found, search for buttons with submit-like text
  if (!submitButton) {
    const buttons = form.querySelectorAll('button, [role="button"], input[type="button"]');
    for (const btn of buttons) {
      const text = (btn.textContent || btn.value || '').trim();
      const className = (btn.className || '').toLowerCase();

      if ((submitPatterns.test(text) || submitPatterns.test(className)) &&
          isElementVisible(btn) && !btn.disabled) {
        submitButton = btn;
        break;
      }
    }
  }

  if (!submitButton) {
    return {
      success: true,
      found: false,
      message: 'No submit button found'
    };
  }

  return {
    success: true,
    found: true,
    selector: generateSelector(submitButton),
    text: (submitButton.textContent || submitButton.value || '').trim(),
    type: submitButton.type || submitButton.tagName.toLowerCase(),
    disabled: submitButton.disabled
  };
}

/**
 * Handle detect_wizard message
 * @returns {Promise<Object>} Wizard detection result
 */
async function handleDetectWizard() {
  contentLogger.info('Handling detect wizard');

  try {
    const wizardInfo = detectFormWizard();
    return {
      success: true,
      ...wizardInfo,
      url: window.location.href,
      timestamp: Date.now()
    };
  } catch (error) {
    contentLogger.error('Failed to detect wizard', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get_wizard_state message
 * @param {string} formSelector - Optional form selector
 * @returns {Promise<Object>} Wizard state
 */
async function handleGetWizardState(formSelector = null) {
  contentLogger.info('Handling get wizard state');

  try {
    const state = getWizardState(formSelector);
    return {
      ...state,
      url: window.location.href,
      timestamp: Date.now()
    };
  } catch (error) {
    contentLogger.error('Failed to get wizard state', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle wizard_next message
 * @param {string} formSelector - Optional form selector
 * @returns {Promise<Object>} Navigation result
 */
async function handleWizardNext(formSelector = null) {
  contentLogger.info('Handling wizard next');
  return navigateWizardStep('next', formSelector);
}

/**
 * Handle wizard_previous message
 * @param {string} formSelector - Optional form selector
 * @returns {Promise<Object>} Navigation result
 */
async function handleWizardPrevious(formSelector = null) {
  contentLogger.info('Handling wizard previous');
  return navigateWizardStep('prev', formSelector);
}

/**
 * Handle fill_wizard_step message
 * @param {Object} data - Data to fill
 * @param {Object} options - Fill options
 * @returns {Promise<Object>} Fill result
 */
async function handleFillWizardStep(data, options = {}) {
  contentLogger.info('Handling fill wizard step');
  return fillWizardStep(data, options);
}

/**
 * Handle is_last_step message
 * @param {string} formSelector - Optional form selector
 * @returns {Promise<Object>} Result
 */
async function handleIsLastStep(formSelector = null) {
  contentLogger.info('Handling is last step');

  try {
    const result = isLastStep(formSelector);
    return {
      ...result,
      url: window.location.href,
      timestamp: Date.now()
    };
  } catch (error) {
    contentLogger.error('Failed to check if last step', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get_submit_button message
 * @param {string} formSelector - Optional form selector
 * @returns {Promise<Object>} Submit button info
 */
async function handleGetSubmitButton(formSelector = null) {
  contentLogger.info('Handling get submit button');

  try {
    const result = getSubmitButton(formSelector);
    return {
      ...result,
      url: window.location.href,
      timestamp: Date.now()
    };
  } catch (error) {
    contentLogger.error('Failed to get submit button', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle submit_wizard message - submit the wizard form
 * @param {string} formSelector - Optional form selector
 * @param {Object} options - Submit options
 * @returns {Promise<Object>} Submit result
 */
async function handleSubmitWizard(formSelector = null, options = {}) {
  contentLogger.info('Handling submit wizard');

  const { clickButton = true } = options;

  // First check if we're on the last step
  const lastStepCheck = isLastStep(formSelector);
  if (!lastStepCheck.success) {
    return lastStepCheck;
  }

  if (!lastStepCheck.isLastStep) {
    return {
      success: false,
      error: 'Not on the last step. Navigate to the final step before submitting.',
      currentStep: lastStepCheck.currentStep,
      totalSteps: lastStepCheck.totalSteps
    };
  }

  // Find and click the submit button
  const submitInfo = getSubmitButton(formSelector);
  if (!submitInfo.found) {
    // Try form.submit() as fallback
    const form = formSelector
      ? document.querySelector(formSelector)
      : document.querySelector('form');

    if (form) {
      try {
        form.submit();
        return {
          success: true,
          method: 'form.submit()',
          message: 'Form submitted programmatically'
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
    return submitInfo;
  }

  if (clickButton) {
    try {
      const submitBtn = document.querySelector(submitInfo.selector);
      if (!submitBtn) {
        return { success: false, error: 'Submit button not found' };
      }

      submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(CONTENT_CONFIG.SCROLL_WAIT);

      await simulateHumanClick(submitBtn);

      return {
        success: true,
        method: 'click',
        buttonSelector: submitInfo.selector,
        buttonText: submitInfo.text
      };
    } catch (error) {
      contentLogger.error('Failed to submit wizard', error);
      return { success: false, error: error.message };
    }
  }

  return submitInfo;
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
// User Agent Override
// =============================================================================

// Store for the original user agent
let originalUserAgent = null;
let currentOverriddenUserAgent = null;

/**
 * Override the navigator.userAgent property
 * This uses Object.defineProperty to make JavaScript code see the spoofed user agent
 * Note: This only affects JavaScript access, the HTTP header is modified by background.js
 * @param {string} userAgent - The user agent string to set
 * @returns {Promise<Object>} - Result of the override
 */
async function handleOverrideUserAgent(userAgent) {
  contentLogger.info('Overriding navigator.userAgent', {
    userAgent: userAgent?.substring(0, 50) + '...'
  });

  try {
    // Store the original user agent if not already stored
    if (!originalUserAgent) {
      originalUserAgent = navigator.userAgent;
    }

    // Store the current overridden value
    currentOverriddenUserAgent = userAgent;

    // Override navigator.userAgent using Object.defineProperty
    Object.defineProperty(navigator, 'userAgent', {
      get: function() {
        return userAgent;
      },
      configurable: true
    });

    // Also override navigator.appVersion if it contains browser info
    const appVersionOverride = userAgent.replace(/^Mozilla\//, '');
    Object.defineProperty(navigator, 'appVersion', {
      get: function() {
        return appVersionOverride;
      },
      configurable: true
    });

    // Override navigator.platform based on user agent
    let platformOverride = 'Win32';
    if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS')) {
      platformOverride = 'MacIntel';
    } else if (userAgent.includes('Linux')) {
      platformOverride = 'Linux x86_64';
    } else if (userAgent.includes('Windows')) {
      platformOverride = 'Win32';
    }

    Object.defineProperty(navigator, 'platform', {
      get: function() {
        return platformOverride;
      },
      configurable: true
    });

    // Override navigator.vendor based on browser
    let vendorOverride = '';
    if (userAgent.includes('Chrome') || userAgent.includes('Safari')) {
      vendorOverride = 'Google Inc.';
    } else if (userAgent.includes('Firefox')) {
      vendorOverride = '';
    } else if (userAgent.includes('Edg')) {
      vendorOverride = 'Google Inc.';
    }

    Object.defineProperty(navigator, 'vendor', {
      get: function() {
        return vendorOverride;
      },
      configurable: true
    });

    contentLogger.debug('Navigator properties overridden successfully', {
      userAgent: userAgent.substring(0, 50),
      platform: platformOverride,
      vendor: vendorOverride
    });

    return {
      success: true,
      message: 'User agent overridden successfully',
      userAgent: userAgent,
      platform: platformOverride,
      vendor: vendorOverride
    };
  } catch (error) {
    contentLogger.error('Failed to override user agent', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Reset navigator.userAgent to its original value
 * @returns {Promise<Object>} - Result of the reset
 */
async function handleResetUserAgent() {
  contentLogger.info('Resetting navigator.userAgent to original');

  try {
    if (originalUserAgent) {
      // Restore original user agent
      Object.defineProperty(navigator, 'userAgent', {
        get: function() {
          return originalUserAgent;
        },
        configurable: true
      });

      currentOverriddenUserAgent = null;

      contentLogger.debug('Navigator.userAgent reset to original', {
        originalUserAgent: originalUserAgent.substring(0, 50)
      });

      return {
        success: true,
        message: 'User agent reset to original',
        userAgent: originalUserAgent
      };
    } else {
      return {
        success: true,
        message: 'No override was active, nothing to reset',
        userAgent: navigator.userAgent
      };
    }
  } catch (error) {
    contentLogger.error('Failed to reset user agent', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get the current user agent state
 * @returns {Object} - Current user agent information
 */
function getUserAgentState() {
  return {
    current: navigator.userAgent,
    original: originalUserAgent,
    isOverridden: currentOverriddenUserAgent !== null,
    overriddenValue: currentOverriddenUserAgent
  };
}

// =============================================================================
// Rate Limiting Handlers
// =============================================================================

/**
 * Set rate limit configuration for a specific action type
 * @param {string} actionType - Action type (click, typing, navigation, scroll, default)
 * @param {Object} config - Rate limit configuration
 * @returns {Promise<Object>} - Result of the configuration update
 */
async function handleSetRateLimitConfig(actionType, config) {
  contentLogger.info('Setting rate limit config', { actionType, config });

  try {
    if (!contentRateLimiter) {
      // Initialize if not already done
      if (typeof RateLimiterManager !== 'undefined') {
        contentRateLimiter = new RateLimiterManager();
        contentLogger.debug('RateLimiterManager initialized on demand');
      } else {
        return {
          success: false,
          error: 'RateLimiterManager not available'
        };
      }
    }

    contentRateLimiter.setConfig(actionType, config);

    return {
      success: true,
      actionType,
      config: contentRateLimiter.getConfig(actionType)
    };
  } catch (error) {
    contentLogger.error('Failed to set rate limit config', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Pause rate limiter for specified action type or all action types
 * @param {string} actionType - Action type or 'all'
 * @returns {Promise<Object>} - Result of the pause operation
 */
async function handlePauseRateLimiter(actionType) {
  contentLogger.info('Pausing rate limiter', { actionType });

  try {
    if (!contentRateLimiter) {
      return {
        success: false,
        error: 'RateLimiterManager not initialized'
      };
    }

    if (actionType === 'all') {
      contentRateLimiter.pauseAll();
    } else {
      contentRateLimiter.getLimiter(actionType).pause();
    }

    return {
      success: true,
      paused: true,
      actionType
    };
  } catch (error) {
    contentLogger.error('Failed to pause rate limiter', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Resume rate limiter for specified action type or all action types
 * @param {string} actionType - Action type or 'all'
 * @returns {Promise<Object>} - Result of the resume operation
 */
async function handleResumeRateLimiter(actionType) {
  contentLogger.info('Resuming rate limiter', { actionType });

  try {
    if (!contentRateLimiter) {
      return {
        success: false,
        error: 'RateLimiterManager not initialized'
      };
    }

    if (actionType === 'all') {
      contentRateLimiter.resumeAll();
    } else {
      contentRateLimiter.getLimiter(actionType).resume();
    }

    return {
      success: true,
      paused: false,
      actionType
    };
  } catch (error) {
    contentLogger.error('Failed to resume rate limiter', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get rate limit statistics for specified action type or all action types
 * @param {string} actionType - Optional action type
 * @returns {Promise<Object>} - Rate limit statistics
 */
async function handleGetRateLimitStats(actionType) {
  contentLogger.info('Getting rate limit stats', { actionType });

  try {
    if (!contentRateLimiter) {
      return {
        success: false,
        error: 'RateLimiterManager not initialized'
      };
    }

    if (actionType) {
      return {
        success: true,
        actionType,
        stats: contentRateLimiter.getLimiter(actionType).getStats(),
        config: contentRateLimiter.getConfig(actionType)
      };
    } else {
      return {
        success: true,
        allStats: contentRateLimiter.getAllStats(),
        allConfigs: contentRateLimiter.getAllConfigs(),
        paused: contentRateLimiter.isPaused()
      };
    }
  } catch (error) {
    contentLogger.error('Failed to get rate limit stats', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Apply rate limiting before an action
 * Helper function for consistent rate limiting across handlers
 * @param {string} actionType - Action type to apply rate limiting for
 * @returns {Promise<Object>} - Rate limit wait result
 */
async function applyRateLimit(actionType) {
  if (contentRateLimiter) {
    return await contentRateLimiter.wait(actionType);
  }
  return { waited: false, reason: 'not_initialized' };
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
