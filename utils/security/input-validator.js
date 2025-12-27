/**
 * Basset Hound Browser Automation - Input Validator
 * Phase 7 Security: Input Validation and Sanitization
 *
 * Provides comprehensive input validation and sanitization for:
 * - Command structure validation
 * - CSS/XPath selector injection prevention
 * - URL validation and sanitization
 * - Script content validation for dangerous patterns
 * - XSS prevention through input sanitization
 */

// =============================================================================
// Validation Rules Configuration
// =============================================================================

const ValidationRules = {
  // Valid command types (populated dynamically from command handlers)
  validCommandTypes: new Set([
    'navigate', 'fill_form', 'click', 'get_content', 'screenshot',
    'wait_for_element', 'get_page_state', 'execute_script',
    'get_cookies', 'set_cookies', 'get_local_storage', 'set_local_storage',
    'get_session_storage', 'set_session_storage', 'clear_storage',
    'get_network_requests', 'start_network_capture', 'stop_network_capture',
    'get_network_log', 'clear_network_log', 'add_request_rule',
    'remove_request_rule', 'block_urls', 'unblock_urls',
    'get_interception_rules', 'clear_interception_rules', 'get_network_stats',
    'detect_forms', 'auto_fill_form', 'submit_form', 'get_form_validation',
    'fill_select', 'fill_checkbox', 'fill_radio', 'fill_date',
    'handle_file_upload', 'navigate_multi_step', 'get_multi_step_info',
    'get_frames', 'get_frame_info', 'execute_in_frame',
    'detect_captcha', 'get_captcha_state',
    'get_date_pickers', 'set_date', 'open_date_picker', 'select_calendar_date',
    'create_tab_group', 'add_to_group', 'remove_from_group', 'get_tab_groups',
    'get_tab_state', 'get_all_tab_states',
    'get_file_inputs', 'upload_file', 'trigger_file_dialog',
    'wait_for_field', 'wait_for_form_stable', 'observe_form_changes',
    'fill_dynamic_field', 'get_dynamic_fields', 'detect_ajax_loading',
    'detect_wizard', 'get_wizard_state', 'wizard_next', 'wizard_previous',
    'fill_wizard_step', 'is_last_step', 'get_submit_button', 'submit_wizard',
    'set_user_agent', 'rotate_user_agent', 'get_user_agents', 'reset_user_agent',
    'set_rate_limit', 'get_rate_limit', 'pause_actions', 'resume_actions',
    'get_select_elements', 'get_select_options', 'set_select_value',
    'set_multi_select_values', 'clear_select_selection',
    'shodan_host', 'shodan_search', 'shodan_dns', 'shodan_myip',
    'hibp_check_email', 'hibp_check_password', 'hibp_get_breach',
    'wayback_check', 'wayback_snapshots', 'wayback_get', 'wayback_latest',
    'whois_domain', 'whois_ip',
    'get_validation_rules',
    // Phase 7 Security: WebSocket authentication commands
    'set_ws_auth', 'get_ws_status', 'enable_wss', 'rotate_auth_token',
    // Phase 7 Security: Privacy control commands
    'clear_browsing_data', 'get_privacy_status', 'set_local_only',
    // Phase 7.2 Security: Audit logging commands
    'get_audit_log', 'clear_audit_log', 'export_audit_log', 'set_audit_level',
    // Phase 5.3 Data Pipeline: Normalization and Entity Management
    'normalize_data', 'create_entity', 'link_entities', 'get_related',
    'export_entities', 'deduplicate', 'get_entity', 'update_entity',
    'delete_entity', 'query_entities', 'get_entity_stats', 'clear_entities'
  ]),

  // Dangerous patterns for selector injection
  selectorInjectionPatterns: [
    /<script[\s>]/i,
    /javascript:/i,
    /on\w+\s*=/i,                    // Event handlers like onclick=
    /expression\s*\(/i,              // CSS expression()
    /url\s*\(\s*["']?javascript:/i,  // url(javascript:
    /-moz-binding/i,                 // Firefox CSS binding
    /@import/i,                      // CSS import
    /behavior\s*:/i,                 // IE behavior
    /vbscript:/i,                    // VBScript protocol
    /data:\s*text\/html/i,           // Data URI with HTML
    /\\u0000/i,                      // Null byte injection
    /\x00/,                          // Raw null byte
  ],

  // Dangerous patterns for script validation
  dangerousScriptPatterns: [
    {
      pattern: /\beval\s*\(/gi,
      name: 'eval',
      description: 'eval() function - executes arbitrary code'
    },
    {
      pattern: /\bnew\s+Function\s*\(/gi,
      name: 'Function constructor',
      description: 'Function constructor - creates functions from strings'
    },
    {
      pattern: /\bsetTimeout\s*\(\s*["'`]/gi,
      name: 'setTimeout with string',
      description: 'setTimeout with string argument - implicit eval'
    },
    {
      pattern: /\bsetInterval\s*\(\s*["'`]/gi,
      name: 'setInterval with string',
      description: 'setInterval with string argument - implicit eval'
    },
    {
      pattern: /document\s*\.\s*write\s*\(/gi,
      name: 'document.write',
      description: 'document.write() - can overwrite entire page'
    },
    {
      pattern: /document\s*\.\s*writeln\s*\(/gi,
      name: 'document.writeln',
      description: 'document.writeln() - can overwrite entire page'
    },
    {
      pattern: /\.innerHTML\s*=/gi,
      name: 'innerHTML assignment',
      description: 'innerHTML assignment - XSS vulnerability'
    },
    {
      pattern: /\.outerHTML\s*=/gi,
      name: 'outerHTML assignment',
      description: 'outerHTML assignment - XSS vulnerability'
    },
    {
      pattern: /\.insertAdjacentHTML\s*\(/gi,
      name: 'insertAdjacentHTML',
      description: 'insertAdjacentHTML() - XSS vulnerability'
    },
    {
      pattern: /\bimport\s*\(/gi,
      name: 'dynamic import',
      description: 'Dynamic import() - can load arbitrary modules'
    },
    {
      pattern: /chrome\s*\.\s*runtime\s*\.\s*sendNativeMessage/gi,
      name: 'native messaging',
      description: 'Native messaging - external communication'
    },
    {
      pattern: /window\s*\.\s*open\s*\(/gi,
      name: 'window.open',
      description: 'window.open() - popup/redirect risk',
      severity: 'warning'  // Lower severity, context-dependent
    },
    {
      pattern: /location\s*\.\s*href\s*=/gi,
      name: 'location redirect',
      description: 'location.href assignment - redirect risk',
      severity: 'warning'
    },
    {
      pattern: /location\s*\.\s*replace\s*\(/gi,
      name: 'location.replace',
      description: 'location.replace() - redirect risk',
      severity: 'warning'
    },
    {
      pattern: /fetch\s*\(\s*["'`](?!https?:\/\/localhost)/gi,
      name: 'external fetch',
      description: 'fetch() to external URL',
      severity: 'warning'
    },
    {
      pattern: /XMLHttpRequest/gi,
      name: 'XMLHttpRequest',
      description: 'XMLHttpRequest - network request',
      severity: 'warning'
    },
    {
      pattern: /WebSocket/gi,
      name: 'WebSocket',
      description: 'WebSocket - persistent connection',
      severity: 'warning'
    }
  ],

  // XSS patterns for input sanitization
  xssPatterns: [
    { pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, replacement: '' },
    { pattern: /<iframe\b[^>]*>/gi, replacement: '' },
    { pattern: /<object\b[^>]*>/gi, replacement: '' },
    { pattern: /<embed\b[^>]*>/gi, replacement: '' },
    { pattern: /<link\b[^>]*>/gi, replacement: '' },
    { pattern: /<meta\b[^>]*>/gi, replacement: '' },
    { pattern: /<base\b[^>]*>/gi, replacement: '' },
    { pattern: /javascript:/gi, replacement: '' },
    { pattern: /vbscript:/gi, replacement: '' },
    { pattern: /data:\s*text\/html/gi, replacement: '' },
    { pattern: /on\w+\s*=\s*["'][^"']*["']/gi, replacement: '' },
    { pattern: /on\w+\s*=\s*[^\s>]+/gi, replacement: '' }
  ],

  // Allowed URL protocols
  allowedURLProtocols: ['http:', 'https:'],

  // Maximum lengths for various inputs
  maxLengths: {
    commandType: 100,
    selector: 5000,
    url: 8192,
    script: 1000000,  // 1MB
    stringInput: 100000
  }
};

// =============================================================================
// ValidationError Class
// =============================================================================

/**
 * Custom error class for validation failures
 * Provides structured error reporting with details about the validation failure
 */
class ValidationError extends Error {
  /**
   * Create a ValidationError
   * @param {string} message - Error message
   * @param {Object} details - Additional error details
   * @param {string} details.field - Field that failed validation
   * @param {string} details.rule - Validation rule that was violated
   * @param {*} details.value - The invalid value (may be sanitized)
   * @param {string} details.expected - Expected value or format
   * @param {string} details.code - Error code for programmatic handling
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.field = details.field || null;
    this.rule = details.rule || null;
    this.value = details.value !== undefined ? this._sanitizeForError(details.value) : null;
    this.expected = details.expected || null;
    this.code = details.code || 'VALIDATION_ERROR';
    this.timestamp = Date.now();

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }

  /**
   * Sanitize sensitive values for error messages
   * @private
   * @param {*} value - Value to sanitize
   * @returns {*} Sanitized value
   */
  _sanitizeForError(value) {
    if (typeof value === 'string') {
      // Truncate long strings
      if (value.length > 100) {
        return value.substring(0, 100) + '... [truncated]';
      }
      return value;
    }
    if (typeof value === 'object' && value !== null) {
      return '[Object]';
    }
    return value;
  }

  /**
   * Convert error to JSON-serializable object
   * @returns {Object} Error details object
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      field: this.field,
      rule: this.rule,
      value: this.value,
      expected: this.expected,
      code: this.code,
      timestamp: this.timestamp
    };
  }
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate command structure
 * @param {Object} command - Command object to validate
 * @returns {Object} Validation result { valid: boolean, errors: Array, sanitized: Object }
 */
function validateCommand(command) {
  const errors = [];
  const sanitized = {};

  // Check if command is an object
  if (!command || typeof command !== 'object') {
    throw new ValidationError('Command must be a non-null object', {
      field: 'command',
      rule: 'type',
      value: typeof command,
      expected: 'object',
      code: 'INVALID_COMMAND_TYPE'
    });
  }

  // Validate command_id
  if (!command.command_id) {
    errors.push({
      field: 'command_id',
      rule: 'required',
      message: 'command_id is required'
    });
  } else if (typeof command.command_id !== 'string') {
    errors.push({
      field: 'command_id',
      rule: 'type',
      message: 'command_id must be a string',
      value: typeof command.command_id
    });
  } else {
    // Sanitize command_id - only allow alphanumeric, hyphens, underscores
    sanitized.command_id = command.command_id.replace(/[^a-zA-Z0-9\-_]/g, '');
    if (sanitized.command_id !== command.command_id) {
      errors.push({
        field: 'command_id',
        rule: 'format',
        message: 'command_id contains invalid characters',
        severity: 'warning'
      });
    }
  }

  // Validate type
  if (!command.type) {
    errors.push({
      field: 'type',
      rule: 'required',
      message: 'Command type is required'
    });
  } else if (typeof command.type !== 'string') {
    errors.push({
      field: 'type',
      rule: 'type',
      message: 'Command type must be a string',
      value: typeof command.type
    });
  } else if (command.type.length > ValidationRules.maxLengths.commandType) {
    errors.push({
      field: 'type',
      rule: 'maxLength',
      message: `Command type exceeds maximum length of ${ValidationRules.maxLengths.commandType}`,
      value: command.type.length
    });
  } else {
    // Check if type is in allowed list
    sanitized.type = command.type.toLowerCase().trim();
    if (!ValidationRules.validCommandTypes.has(sanitized.type)) {
      errors.push({
        field: 'type',
        rule: 'allowedValue',
        message: `Unknown command type: ${sanitized.type}`,
        value: sanitized.type
      });
    }
  }

  // Validate params
  if (command.params !== undefined) {
    if (typeof command.params !== 'object' || command.params === null) {
      errors.push({
        field: 'params',
        rule: 'type',
        message: 'params must be an object',
        value: typeof command.params
      });
    } else {
      sanitized.params = command.params;
    }
  } else {
    sanitized.params = {};
  }

  // Check for fatal errors (those that prevent command execution)
  const fatalErrors = errors.filter(e => e.severity !== 'warning');

  return {
    valid: fatalErrors.length === 0,
    errors,
    fatalErrors,
    warnings: errors.filter(e => e.severity === 'warning'),
    sanitized: fatalErrors.length === 0 ? sanitized : null
  };
}

/**
 * Validate CSS/XPath selector for injection attacks
 * @param {string} selector - Selector to validate
 * @returns {Object} Validation result { valid: boolean, errors: Array, sanitized: string }
 */
function validateSelector(selector) {
  const errors = [];

  // Type check
  if (typeof selector !== 'string') {
    throw new ValidationError('Selector must be a string', {
      field: 'selector',
      rule: 'type',
      value: typeof selector,
      expected: 'string',
      code: 'INVALID_SELECTOR_TYPE'
    });
  }

  // Length check
  if (selector.length > ValidationRules.maxLengths.selector) {
    throw new ValidationError(`Selector exceeds maximum length of ${ValidationRules.maxLengths.selector}`, {
      field: 'selector',
      rule: 'maxLength',
      value: selector.length,
      expected: `<= ${ValidationRules.maxLengths.selector}`,
      code: 'SELECTOR_TOO_LONG'
    });
  }

  // Empty check
  if (!selector.trim()) {
    throw new ValidationError('Selector cannot be empty', {
      field: 'selector',
      rule: 'required',
      code: 'EMPTY_SELECTOR'
    });
  }

  // Check for injection patterns
  for (const pattern of ValidationRules.selectorInjectionPatterns) {
    if (pattern.test(selector)) {
      errors.push({
        field: 'selector',
        rule: 'injection',
        message: 'Selector contains potentially dangerous pattern',
        pattern: pattern.toString()
      });
    }
  }

  // Check for null bytes
  if (selector.includes('\x00') || selector.includes('\u0000')) {
    errors.push({
      field: 'selector',
      rule: 'nullByte',
      message: 'Selector contains null byte'
    });
  }

  // Sanitize: remove potentially dangerous characters while preserving valid selectors
  let sanitized = selector
    .replace(/\x00|\u0000/g, '')  // Remove null bytes
    .trim();

  // Validate that the selector is syntactically valid (basic check)
  // This doesn't execute the selector, just checks basic structure
  const isValidCSS = isValidCSSSelector(sanitized);
  const isValidXPath = isValidXPathSelector(sanitized);

  if (!isValidCSS && !isValidXPath) {
    errors.push({
      field: 'selector',
      rule: 'syntax',
      message: 'Selector does not appear to be valid CSS or XPath',
      severity: 'warning'
    });
  }

  const fatalErrors = errors.filter(e => e.severity !== 'warning');

  return {
    valid: fatalErrors.length === 0,
    errors,
    warnings: errors.filter(e => e.severity === 'warning'),
    sanitized: fatalErrors.length === 0 ? sanitized : null,
    selectorType: isValidCSS ? 'css' : (isValidXPath ? 'xpath' : 'unknown')
  };
}

/**
 * Check if selector looks like valid CSS
 * @private
 * @param {string} selector - Selector to check
 * @returns {boolean} True if appears to be valid CSS selector
 */
function isValidCSSSelector(selector) {
  // XPath selectors start with / or //
  if (selector.startsWith('/')) {
    return false;
  }

  // Try to create a test to validate CSS selector syntax
  try {
    // This is a basic structural check
    // Valid CSS selectors typically start with: element, #id, .class, [attr], :pseudo, *
    const cssPattern = /^[\w\-\[\]#.:*,\s\(\)>+~"'=^$|]+$/;
    return cssPattern.test(selector);
  } catch {
    return false;
  }
}

/**
 * Check if selector looks like valid XPath
 * @private
 * @param {string} selector - Selector to check
 * @returns {boolean} True if appears to be valid XPath selector
 */
function isValidXPathSelector(selector) {
  // XPath selectors typically start with / or //
  if (!selector.startsWith('/') && !selector.startsWith('(')) {
    return false;
  }

  // Basic XPath structure check
  const xpathPattern = /^[\w\-\[\]\/\.\@\(\):*,\s"'=><|!]+$/;
  return xpathPattern.test(selector);
}

/**
 * Validate and sanitize URL
 * @param {string} url - URL to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.allowData - Allow data: URLs (default: false)
 * @param {boolean} options.allowBlob - Allow blob: URLs (default: false)
 * @param {Array<string>} options.allowedProtocols - Allowed protocols (default: http, https)
 * @returns {Object} Validation result { valid: boolean, errors: Array, sanitized: string, parsed: URL }
 */
function validateURL(url, options = {}) {
  const {
    allowData = false,
    allowBlob = false,
    allowedProtocols = ValidationRules.allowedURLProtocols
  } = options;

  const errors = [];

  // Type check
  if (typeof url !== 'string') {
    throw new ValidationError('URL must be a string', {
      field: 'url',
      rule: 'type',
      value: typeof url,
      expected: 'string',
      code: 'INVALID_URL_TYPE'
    });
  }

  // Length check
  if (url.length > ValidationRules.maxLengths.url) {
    throw new ValidationError(`URL exceeds maximum length of ${ValidationRules.maxLengths.url}`, {
      field: 'url',
      rule: 'maxLength',
      value: url.length,
      expected: `<= ${ValidationRules.maxLengths.url}`,
      code: 'URL_TOO_LONG'
    });
  }

  // Empty check
  if (!url.trim()) {
    throw new ValidationError('URL cannot be empty', {
      field: 'url',
      rule: 'required',
      code: 'EMPTY_URL'
    });
  }

  // Sanitize: trim whitespace, remove null bytes
  let sanitized = url
    .trim()
    .replace(/\x00|\u0000/g, '')
    .replace(/[\r\n\t]/g, '');  // Remove control characters

  // Parse URL
  let parsed;
  try {
    parsed = new URL(sanitized);
  } catch (error) {
    throw new ValidationError(`Invalid URL format: ${error.message}`, {
      field: 'url',
      rule: 'format',
      value: sanitized,
      expected: 'valid URL',
      code: 'INVALID_URL_FORMAT'
    });
  }

  // Build allowed protocols list
  const protocols = [...allowedProtocols];
  if (allowData) protocols.push('data:');
  if (allowBlob) protocols.push('blob:');

  // Protocol check
  if (!protocols.includes(parsed.protocol)) {
    throw new ValidationError(`URL protocol not allowed: ${parsed.protocol}`, {
      field: 'url',
      rule: 'protocol',
      value: parsed.protocol,
      expected: protocols.join(', '),
      code: 'INVALID_URL_PROTOCOL'
    });
  }

  // Check for javascript: in URL parts (can be hidden in path/query)
  const urlLower = sanitized.toLowerCase();
  if (urlLower.includes('javascript:') || urlLower.includes('vbscript:')) {
    throw new ValidationError('URL contains script protocol', {
      field: 'url',
      rule: 'scriptProtocol',
      code: 'SCRIPT_IN_URL'
    });
  }

  // Check for data:text/html which could contain scripts
  if (urlLower.includes('data:text/html') && !allowData) {
    throw new ValidationError('Data URLs with HTML content not allowed', {
      field: 'url',
      rule: 'dataHtml',
      code: 'DATA_HTML_URL'
    });
  }

  // Warn about unusual ports
  const standardPorts = { 'http:': '80', 'https:': '443' };
  if (parsed.port && parsed.port !== standardPorts[parsed.protocol]) {
    errors.push({
      field: 'url',
      rule: 'port',
      message: `URL uses non-standard port: ${parsed.port}`,
      severity: 'warning'
    });
  }

  // Warn about IP addresses instead of hostnames
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipPattern.test(parsed.hostname)) {
    errors.push({
      field: 'url',
      rule: 'ipAddress',
      message: 'URL uses IP address instead of hostname',
      severity: 'warning'
    });
  }

  // Warn about localhost/internal addresses in production
  const internalPatterns = [
    /^localhost$/i,
    /^127\.\d+\.\d+\.\d+$/,
    /^10\.\d+\.\d+\.\d+$/,
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
    /^192\.168\.\d+\.\d+$/,
    /^0\.0\.0\.0$/,
    /^::1$/,
    /\.local$/i
  ];

  for (const pattern of internalPatterns) {
    if (pattern.test(parsed.hostname)) {
      errors.push({
        field: 'url',
        rule: 'internalAddress',
        message: `URL points to internal/local address: ${parsed.hostname}`,
        severity: 'info'
      });
      break;
    }
  }

  return {
    valid: true,
    errors,
    warnings: errors.filter(e => e.severity === 'warning'),
    info: errors.filter(e => e.severity === 'info'),
    sanitized,
    parsed: {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
      origin: parsed.origin,
      href: parsed.href
    }
  };
}

/**
 * Validate script content for dangerous patterns
 * @param {string} script - Script content to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.strict - Enable strict mode (default: true)
 * @param {boolean} options.allowWarnings - Allow scripts with warnings (default: true)
 * @param {Array<string>} options.ignorePatterns - Pattern names to ignore
 * @returns {Object} Validation result with detected patterns
 */
function validateScript(script, options = {}) {
  const {
    strict = true,
    allowWarnings = true,
    ignorePatterns = []
  } = options;

  const errors = [];
  const warnings = [];
  const detectedPatterns = [];

  // Type check
  if (typeof script !== 'string') {
    throw new ValidationError('Script must be a string', {
      field: 'script',
      rule: 'type',
      value: typeof script,
      expected: 'string',
      code: 'INVALID_SCRIPT_TYPE'
    });
  }

  // Length check
  if (script.length > ValidationRules.maxLengths.script) {
    throw new ValidationError(`Script exceeds maximum length of ${ValidationRules.maxLengths.script}`, {
      field: 'script',
      rule: 'maxLength',
      value: script.length,
      expected: `<= ${ValidationRules.maxLengths.script}`,
      code: 'SCRIPT_TOO_LONG'
    });
  }

  // Empty check
  if (!script.trim()) {
    throw new ValidationError('Script cannot be empty', {
      field: 'script',
      rule: 'required',
      code: 'EMPTY_SCRIPT'
    });
  }

  // Check for dangerous patterns
  for (const patternDef of ValidationRules.dangerousScriptPatterns) {
    // Skip ignored patterns
    if (ignorePatterns.includes(patternDef.name)) {
      continue;
    }

    // Reset regex lastIndex for global patterns
    patternDef.pattern.lastIndex = 0;

    const matches = script.match(patternDef.pattern);
    if (matches) {
      const detail = {
        pattern: patternDef.name,
        description: patternDef.description,
        matchCount: matches.length,
        severity: patternDef.severity || 'error'
      };

      detectedPatterns.push(detail);

      if (patternDef.severity === 'warning') {
        warnings.push({
          field: 'script',
          rule: 'dangerousPattern',
          message: `Script contains potentially risky pattern: ${patternDef.name}`,
          detail
        });
      } else {
        errors.push({
          field: 'script',
          rule: 'dangerousPattern',
          message: `Script contains dangerous pattern: ${patternDef.name}`,
          detail
        });
      }
    }
  }

  // Check for obfuscation patterns (in strict mode)
  if (strict) {
    // Check for excessive encoding
    const encodedCount = (script.match(/\\x[0-9a-f]{2}|\\u[0-9a-f]{4}|%[0-9a-f]{2}/gi) || []).length;
    if (encodedCount > 20) {
      warnings.push({
        field: 'script',
        rule: 'obfuscation',
        message: 'Script contains extensive character encoding (possible obfuscation)',
        count: encodedCount
      });
    }

    // Check for very long lines (possible obfuscation)
    const lines = script.split('\n');
    const longLines = lines.filter(line => line.length > 1000).length;
    if (longLines > 0) {
      warnings.push({
        field: 'script',
        rule: 'obfuscation',
        message: `Script contains ${longLines} very long line(s) (possible obfuscation)`
      });
    }

    // Check for base64 encoded content
    const base64Pattern = /["'`][A-Za-z0-9+/]{50,}={0,2}["'`]/g;
    const base64Matches = script.match(base64Pattern);
    if (base64Matches && base64Matches.length > 0) {
      warnings.push({
        field: 'script',
        rule: 'base64',
        message: `Script contains ${base64Matches.length} potential base64 encoded string(s)`,
        severity: 'warning'
      });
    }
  }

  // Determine overall validity
  const isValid = errors.length === 0 && (allowWarnings || warnings.length === 0);

  return {
    valid: isValid,
    errors,
    warnings,
    detectedPatterns,
    stats: {
      length: script.length,
      lines: script.split('\n').length,
      dangerousPatterns: errors.length,
      warningPatterns: warnings.length
    }
  };
}

/**
 * Sanitize input based on expected type
 * @param {*} input - Input to sanitize
 * @param {string} type - Expected type: 'string', 'number', 'boolean', 'html', 'json', 'identifier'
 * @param {Object} options - Sanitization options
 * @returns {Object} Sanitization result { valid: boolean, sanitized: *, original: *, changes: Array }
 */
function sanitizeInput(input, type, options = {}) {
  const changes = [];

  if (input === null || input === undefined) {
    return {
      valid: true,
      sanitized: input,
      original: input,
      changes: []
    };
  }

  switch (type) {
    case 'string':
      return sanitizeString(input, options, changes);

    case 'number':
      return sanitizeNumber(input, options, changes);

    case 'boolean':
      return sanitizeBoolean(input, options, changes);

    case 'html':
      return sanitizeHTML(input, options, changes);

    case 'json':
      return sanitizeJSON(input, options, changes);

    case 'identifier':
      return sanitizeIdentifier(input, options, changes);

    default:
      throw new ValidationError(`Unknown sanitization type: ${type}`, {
        field: 'type',
        rule: 'allowedValue',
        value: type,
        expected: 'string, number, boolean, html, json, identifier',
        code: 'INVALID_SANITIZATION_TYPE'
      });
  }
}

/**
 * Sanitize string input
 * @private
 */
function sanitizeString(input, options, changes) {
  const {
    maxLength = ValidationRules.maxLengths.stringInput,
    removeXSS = true,
    removeControlChars = true,
    trim = true
  } = options;

  let sanitized = String(input);
  const original = sanitized;

  // Trim whitespace
  if (trim) {
    const trimmed = sanitized.trim();
    if (trimmed !== sanitized) {
      changes.push({ type: 'trim', before: sanitized.length, after: trimmed.length });
      sanitized = trimmed;
    }
  }

  // Remove control characters (except newlines and tabs)
  if (removeControlChars) {
    const cleaned = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    if (cleaned !== sanitized) {
      changes.push({ type: 'controlChars', removed: sanitized.length - cleaned.length });
      sanitized = cleaned;
    }
  }

  // Remove XSS patterns
  if (removeXSS) {
    for (const { pattern, replacement } of ValidationRules.xssPatterns) {
      const cleaned = sanitized.replace(pattern, replacement);
      if (cleaned !== sanitized) {
        changes.push({ type: 'xss', pattern: pattern.toString() });
        sanitized = cleaned;
      }
    }
  }

  // Truncate if too long
  if (sanitized.length > maxLength) {
    changes.push({ type: 'truncate', before: sanitized.length, after: maxLength });
    sanitized = sanitized.substring(0, maxLength);
  }

  return {
    valid: true,
    sanitized,
    original,
    changes,
    modified: changes.length > 0
  };
}

/**
 * Sanitize number input
 * @private
 */
function sanitizeNumber(input, options, changes) {
  const {
    min = -Infinity,
    max = Infinity,
    integer = false,
    defaultValue = 0
  } = options;

  const original = input;
  let sanitized;

  // Parse to number
  if (typeof input === 'string') {
    sanitized = parseFloat(input);
    if (isNaN(sanitized)) {
      changes.push({ type: 'parse', error: 'Not a valid number' });
      sanitized = defaultValue;
    }
  } else if (typeof input === 'number') {
    sanitized = input;
  } else {
    sanitized = defaultValue;
    changes.push({ type: 'type', originalType: typeof input });
  }

  // Check for NaN/Infinity
  if (!isFinite(sanitized)) {
    changes.push({ type: 'finite', value: sanitized });
    sanitized = defaultValue;
  }

  // Apply integer constraint
  if (integer) {
    const intValue = Math.trunc(sanitized);
    if (intValue !== sanitized) {
      changes.push({ type: 'integer', before: sanitized, after: intValue });
      sanitized = intValue;
    }
  }

  // Apply range constraints
  if (sanitized < min) {
    changes.push({ type: 'min', before: sanitized, after: min });
    sanitized = min;
  }
  if (sanitized > max) {
    changes.push({ type: 'max', before: sanitized, after: max });
    sanitized = max;
  }

  return {
    valid: true,
    sanitized,
    original,
    changes,
    modified: changes.length > 0
  };
}

/**
 * Sanitize boolean input
 * @private
 */
function sanitizeBoolean(input, options, changes) {
  const { defaultValue = false } = options;
  const original = input;

  let sanitized;
  if (typeof input === 'boolean') {
    sanitized = input;
  } else if (typeof input === 'string') {
    const lower = input.toLowerCase().trim();
    if (['true', '1', 'yes', 'on'].includes(lower)) {
      sanitized = true;
    } else if (['false', '0', 'no', 'off'].includes(lower)) {
      sanitized = false;
    } else {
      sanitized = defaultValue;
      changes.push({ type: 'parse', originalValue: input });
    }
  } else if (typeof input === 'number') {
    sanitized = input !== 0;
  } else {
    sanitized = defaultValue;
    changes.push({ type: 'type', originalType: typeof input });
  }

  return {
    valid: true,
    sanitized,
    original,
    changes,
    modified: original !== sanitized
  };
}

/**
 * Sanitize HTML input (remove dangerous elements/attributes)
 * @private
 */
function sanitizeHTML(input, options, changes) {
  const {
    allowedTags = ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'span', 'div'],
    allowedAttributes = ['href', 'class', 'id', 'title'],
    maxLength = ValidationRules.maxLengths.stringInput
  } = options;

  let sanitized = String(input);
  const original = sanitized;

  // Apply XSS patterns first
  for (const { pattern, replacement } of ValidationRules.xssPatterns) {
    const cleaned = sanitized.replace(pattern, replacement);
    if (cleaned !== sanitized) {
      changes.push({ type: 'xss', pattern: pattern.toString() });
      sanitized = cleaned;
    }
  }

  // Remove disallowed tags (keep content)
  const tagPattern = /<\/?(\w+)([^>]*)>/gi;
  sanitized = sanitized.replace(tagPattern, (match, tagName, attributes) => {
    const lowerTag = tagName.toLowerCase();
    if (!allowedTags.includes(lowerTag)) {
      changes.push({ type: 'disallowedTag', tag: lowerTag });
      return '';
    }

    // Filter attributes
    if (attributes) {
      const attrPattern = /(\w+)\s*=\s*["']([^"']*)["']/gi;
      const filteredAttrs = [];
      let attrMatch;
      while ((attrMatch = attrPattern.exec(attributes)) !== null) {
        const attrName = attrMatch[1].toLowerCase();
        const attrValue = attrMatch[2];

        if (allowedAttributes.includes(attrName)) {
          // Special check for href - no javascript:
          if (attrName === 'href' && attrValue.toLowerCase().includes('javascript:')) {
            changes.push({ type: 'javascriptHref' });
            continue;
          }
          filteredAttrs.push(`${attrName}="${attrValue}"`);
        } else {
          changes.push({ type: 'disallowedAttr', attr: attrName });
        }
      }
      return `<${match.startsWith('</') ? '/' : ''}${lowerTag}${filteredAttrs.length ? ' ' + filteredAttrs.join(' ') : ''}>`;
    }

    return match;
  });

  // Truncate if needed
  if (sanitized.length > maxLength) {
    changes.push({ type: 'truncate', before: sanitized.length, after: maxLength });
    sanitized = sanitized.substring(0, maxLength);
  }

  return {
    valid: true,
    sanitized,
    original,
    changes,
    modified: changes.length > 0
  };
}

/**
 * Sanitize JSON input
 * @private
 */
function sanitizeJSON(input, options, changes) {
  const { maxDepth = 10, maxSize = 100000 } = options;
  const original = input;
  let sanitized;

  // Parse if string
  if (typeof input === 'string') {
    if (input.length > maxSize) {
      changes.push({ type: 'truncate', size: input.length });
      throw new ValidationError('JSON string too large', {
        field: 'json',
        rule: 'maxSize',
        value: input.length,
        code: 'JSON_TOO_LARGE'
      });
    }

    try {
      sanitized = JSON.parse(input);
    } catch (error) {
      throw new ValidationError(`Invalid JSON: ${error.message}`, {
        field: 'json',
        rule: 'parse',
        code: 'INVALID_JSON'
      });
    }
  } else {
    sanitized = input;
  }

  // Deep sanitize object
  sanitized = sanitizeJSONValue(sanitized, 0, maxDepth, changes);

  return {
    valid: true,
    sanitized,
    original,
    changes,
    modified: changes.length > 0
  };
}

/**
 * Recursively sanitize JSON value
 * @private
 */
function sanitizeJSONValue(value, depth, maxDepth, changes) {
  if (depth > maxDepth) {
    changes.push({ type: 'maxDepth', depth });
    return null;
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    // Sanitize strings within JSON
    const result = sanitizeString(value, { removeXSS: true }, []);
    if (result.modified) {
      changes.push({ type: 'stringValue', path: `depth:${depth}` });
    }
    return result.sanitized;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeJSONValue(item, depth + 1, maxDepth, changes));
  }

  if (typeof value === 'object') {
    const sanitized = {};
    for (const [key, val] of Object.entries(value)) {
      // Sanitize key
      const sanitizedKey = key.replace(/[<>'"&]/g, '');
      if (sanitizedKey !== key) {
        changes.push({ type: 'objectKey', original: key });
      }
      sanitized[sanitizedKey] = sanitizeJSONValue(val, depth + 1, maxDepth, changes);
    }
    return sanitized;
  }

  // Unknown type - convert to null
  changes.push({ type: 'unknownType', originalType: typeof value });
  return null;
}

/**
 * Sanitize identifier (variable name, field name, etc.)
 * @private
 */
function sanitizeIdentifier(input, options, changes) {
  const {
    maxLength = 128,
    allowDots = false,
    allowHyphens = true
  } = options;

  const original = String(input);
  let sanitized = original;

  // Remove invalid characters for identifiers
  const validChars = allowDots
    ? (allowHyphens ? /[^a-zA-Z0-9_.\-]/g : /[^a-zA-Z0-9_.]/g)
    : (allowHyphens ? /[^a-zA-Z0-9_\-]/g : /[^a-zA-Z0-9_]/g);

  sanitized = sanitized.replace(validChars, '');
  if (sanitized !== original) {
    changes.push({ type: 'invalidChars', removed: original.length - sanitized.length });
  }

  // Ensure doesn't start with number
  if (/^\d/.test(sanitized)) {
    sanitized = '_' + sanitized;
    changes.push({ type: 'leadingNumber' });
  }

  // Truncate
  if (sanitized.length > maxLength) {
    changes.push({ type: 'truncate', before: sanitized.length, after: maxLength });
    sanitized = sanitized.substring(0, maxLength);
  }

  // Ensure not empty
  if (!sanitized) {
    sanitized = '_unnamed';
    changes.push({ type: 'empty' });
  }

  return {
    valid: true,
    sanitized,
    original,
    changes,
    modified: changes.length > 0
  };
}

/**
 * Get current validation rules (for debugging/configuration)
 * @returns {Object} Current validation rules
 */
function getValidationRules() {
  return {
    validCommandTypes: Array.from(ValidationRules.validCommandTypes),
    maxLengths: { ...ValidationRules.maxLengths },
    allowedURLProtocols: [...ValidationRules.allowedURLProtocols],
    dangerousPatternCount: ValidationRules.dangerousScriptPatterns.length,
    selectorPatternCount: ValidationRules.selectorInjectionPatterns.length,
    xssPatternCount: ValidationRules.xssPatterns.length,
    dangerousPatterns: ValidationRules.dangerousScriptPatterns.map(p => ({
      name: p.name,
      description: p.description,
      severity: p.severity || 'error'
    }))
  };
}

/**
 * Add a custom command type to valid commands
 * @param {string} commandType - Command type to add
 */
function addValidCommandType(commandType) {
  if (typeof commandType === 'string' && commandType.trim()) {
    ValidationRules.validCommandTypes.add(commandType.toLowerCase().trim());
  }
}

/**
 * Remove a command type from valid commands
 * @param {string} commandType - Command type to remove
 */
function removeValidCommandType(commandType) {
  ValidationRules.validCommandTypes.delete(commandType.toLowerCase().trim());
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.ValidationError = ValidationError;
  globalThis.validateCommand = validateCommand;
  globalThis.validateSelector = validateSelector;
  globalThis.validateURL = validateURL;
  globalThis.validateScript = validateScript;
  globalThis.sanitizeInput = sanitizeInput;
  globalThis.getValidationRules = getValidationRules;
  globalThis.addValidCommandType = addValidCommandType;
  globalThis.removeValidCommandType = removeValidCommandType;
  globalThis.ValidationRules = ValidationRules;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ValidationError,
    validateCommand,
    validateSelector,
    validateURL,
    validateScript,
    sanitizeInput,
    getValidationRules,
    addValidCommandType,
    removeValidCommandType,
    ValidationRules
  };
}
