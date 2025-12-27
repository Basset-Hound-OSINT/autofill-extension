/**
 * Basset Hound Browser Automation - OSINT Tool Parser
 *
 * Knowledge Base Integration (Phase 5.1)
 * Provides parsing and configuration handling for OSINT tool YAML configurations.
 *
 * Features:
 * - Parse OSINT tool YAML configuration
 * - Auto-generate form field mappings from tool config
 * - Get command presets for common OSINT tools
 * - Chain tool outputs to inputs for workflow automation
 */

// =============================================================================
// Simple YAML Parser (No External Dependencies)
// =============================================================================

/**
 * Simple YAML parser for basic key-value and list structures
 * Handles nested objects, arrays, and basic types
 * @class SimpleYAMLParser
 */
class SimpleYAMLParser {
  /**
   * Parse YAML content into a JavaScript object
   * @param {string} content - YAML content string
   * @returns {Object} Parsed object
   * @throws {Error} If parsing fails
   */
  parse(content) {
    if (!content || typeof content !== 'string') {
      throw new Error('YAML content must be a non-empty string');
    }

    const lines = content.split('\n');
    return this._parseLines(lines, 0, 0).result;
  }

  /**
   * Parse lines starting from a given index with expected indentation
   * @private
   */
  _parseLines(lines, startIndex, baseIndent) {
    const result = {};
    let i = startIndex;
    let currentKey = null;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        i++;
        continue;
      }

      const indent = this._getIndent(line);

      // If we've dedented past our level, return
      if (indent < baseIndent && i > startIndex) {
        return { result, nextIndex: i };
      }

      // Check for list item
      if (trimmed.startsWith('- ')) {
        const listContent = trimmed.substring(2).trim();

        // If current key exists, add to array
        if (currentKey !== null) {
          if (!Array.isArray(result[currentKey])) {
            result[currentKey] = [];
          }

          // Check if list item is an object (has colon)
          if (listContent.includes(':')) {
            const listObj = this._parseInlineKeyValue(listContent);
            // Look ahead for nested properties
            const nextIndent = i + 1 < lines.length ? this._getIndent(lines[i + 1]) : 0;
            if (nextIndent > indent) {
              const nested = this._parseLines(lines, i + 1, nextIndent);
              Object.assign(listObj, nested.result);
              i = nested.nextIndex;
              result[currentKey].push(listObj);
              continue;
            }
            result[currentKey].push(listObj);
          } else {
            // Simple value
            result[currentKey].push(this._parseValue(listContent));
          }
          i++;
          continue;
        }
      }

      // Check for key-value pair
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex).trim();
        const valueStr = trimmed.substring(colonIndex + 1).trim();

        // Value on same line
        if (valueStr) {
          // Check if it's a list starting inline
          if (valueStr === '|' || valueStr === '>') {
            // Multi-line string - collect until dedent
            const multiLineResult = this._parseMultiLineString(lines, i + 1, indent + 2);
            result[key] = multiLineResult.text;
            i = multiLineResult.nextIndex;
            currentKey = null;
            continue;
          }

          result[key] = this._parseValue(valueStr);
          currentKey = null;
        } else {
          // Value on next lines (could be list or nested object)
          currentKey = key;

          // Look ahead to determine type
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            if (nextLine.startsWith('- ')) {
              result[key] = [];
            } else {
              // Nested object
              const nextIndent = this._getIndent(lines[i + 1]);
              if (nextIndent > indent) {
                const nested = this._parseLines(lines, i + 1, nextIndent);
                result[key] = nested.result;
                i = nested.nextIndex;
                currentKey = null;
                continue;
              }
            }
          }
        }
        i++;
        continue;
      }

      i++;
    }

    return { result, nextIndex: i };
  }

  /**
   * Parse an inline key-value pair
   * @private
   */
  _parseInlineKeyValue(str) {
    const result = {};
    const colonIndex = str.indexOf(':');
    if (colonIndex > 0) {
      const key = str.substring(0, colonIndex).trim();
      const value = str.substring(colonIndex + 1).trim();
      result[key] = this._parseValue(value);
    }
    return result;
  }

  /**
   * Parse multi-line string (| or > syntax)
   * @private
   */
  _parseMultiLineString(lines, startIndex, baseIndent) {
    const textLines = [];
    let i = startIndex;

    while (i < lines.length) {
      const line = lines[i];
      const indent = this._getIndent(line);

      if (line.trim() === '') {
        textLines.push('');
        i++;
        continue;
      }

      if (indent < baseIndent) {
        break;
      }

      textLines.push(line.substring(baseIndent));
      i++;
    }

    return { text: textLines.join('\n').trim(), nextIndex: i };
  }

  /**
   * Get indentation level of a line
   * @private
   */
  _getIndent(line) {
    let indent = 0;
    for (const char of line) {
      if (char === ' ') {
        indent++;
      } else if (char === '\t') {
        indent += 2;
      } else {
        break;
      }
    }
    return indent;
  }

  /**
   * Parse a value string into appropriate type
   * @private
   */
  _parseValue(str) {
    if (!str || str === '~' || str === 'null') {
      return null;
    }

    // Remove quotes
    if ((str.startsWith('"') && str.endsWith('"')) ||
        (str.startsWith("'") && str.endsWith("'"))) {
      return str.slice(1, -1);
    }

    // Boolean
    if (str === 'true' || str === 'True' || str === 'TRUE') {
      return true;
    }
    if (str === 'false' || str === 'False' || str === 'FALSE') {
      return false;
    }

    // Number
    if (/^-?\d+$/.test(str)) {
      return parseInt(str, 10);
    }
    if (/^-?\d+\.\d+$/.test(str)) {
      return parseFloat(str);
    }

    // Inline array [item1, item2]
    if (str.startsWith('[') && str.endsWith(']')) {
      const inner = str.slice(1, -1);
      if (!inner.trim()) {
        return [];
      }
      return inner.split(',').map(item => this._parseValue(item.trim()));
    }

    // Inline object {key: value}
    if (str.startsWith('{') && str.endsWith('}')) {
      const inner = str.slice(1, -1);
      if (!inner.trim()) {
        return {};
      }
      const result = {};
      const pairs = inner.split(',');
      for (const pair of pairs) {
        const colonIdx = pair.indexOf(':');
        if (colonIdx > 0) {
          const key = pair.substring(0, colonIdx).trim();
          const value = pair.substring(colonIdx + 1).trim();
          result[key] = this._parseValue(value);
        }
      }
      return result;
    }

    return str;
  }
}

// =============================================================================
// Tool Configuration Types
// =============================================================================

/**
 * Valid field types for tool configurations
 */
const FieldTypes = {
  TEXT: 'text',
  EMAIL: 'email',
  URL: 'url',
  IP: 'ip',
  DOMAIN: 'domain',
  USERNAME: 'username',
  PASSWORD: 'password',
  NUMBER: 'number',
  SELECT: 'select',
  CHECKBOX: 'checkbox',
  TEXTAREA: 'textarea',
  DATE: 'date',
  FILE: 'file',
  HIDDEN: 'hidden'
};

/**
 * Tool categories for organization
 */
const ToolCategories = {
  RECONNAISSANCE: 'reconnaissance',
  VULNERABILITY: 'vulnerability',
  NETWORK: 'network',
  SOCIAL: 'social',
  EMAIL: 'email',
  DNS: 'dns',
  WHOIS: 'whois',
  SEARCH: 'search',
  ARCHIVE: 'archive',
  GENERAL: 'general'
};

// =============================================================================
// Command Presets for Common OSINT Tools
// =============================================================================

const COMMAND_PRESETS = {
  shodan: {
    name: 'Shodan',
    category: ToolCategories.NETWORK,
    description: 'Search engine for internet-connected devices',
    baseUrl: 'https://www.shodan.io',
    commands: {
      host_lookup: {
        description: 'Look up IP address information',
        input_fields: [
          { name: 'ip_address', selector: '#search-input', type: FieldTypes.IP, required: true }
        ],
        output_fields: [
          { name: 'open_ports', selector: '.services-list', type: 'array' },
          { name: 'organization', selector: '.host-info .org', type: 'text' },
          { name: 'location', selector: '.host-info .location', type: 'text' }
        ],
        submit_selector: 'button[type="submit"]'
      },
      search: {
        description: 'Search for devices matching query',
        input_fields: [
          { name: 'query', selector: '#search-input', type: FieldTypes.TEXT, required: true }
        ],
        output_fields: [
          { name: 'results', selector: '.search-results', type: 'array' },
          { name: 'total_count', selector: '.result-count', type: 'number' }
        ],
        submit_selector: 'button[type="submit"]'
      }
    },
    api_config: {
      requires_key: true,
      key_param: 'key',
      base_endpoint: 'https://api.shodan.io'
    }
  },

  censys: {
    name: 'Censys',
    category: ToolCategories.NETWORK,
    description: 'Internet-wide scanning data search',
    baseUrl: 'https://search.censys.io',
    commands: {
      hosts_search: {
        description: 'Search hosts database',
        input_fields: [
          { name: 'query', selector: 'input[name="q"]', type: FieldTypes.TEXT, required: true }
        ],
        output_fields: [
          { name: 'hosts', selector: '.search-results .host-item', type: 'array' }
        ],
        submit_selector: 'button[type="submit"]'
      }
    },
    api_config: {
      requires_key: true,
      auth_type: 'basic'
    }
  },

  haveibeenpwned: {
    name: 'Have I Been Pwned',
    category: ToolCategories.EMAIL,
    description: 'Check if email has been in data breach',
    baseUrl: 'https://haveibeenpwned.com',
    commands: {
      check_email: {
        description: 'Check email address for breaches',
        input_fields: [
          { name: 'email', selector: '#Account', type: FieldTypes.EMAIL, required: true }
        ],
        output_fields: [
          { name: 'breaches', selector: '.pwnedSearchResult', type: 'array' },
          { name: 'breach_count', selector: '.pwnCount', type: 'number' }
        ],
        submit_selector: '#searchPwnage'
      }
    },
    api_config: {
      requires_key: true,
      key_header: 'hibp-api-key'
    }
  },

  hunter: {
    name: 'Hunter.io',
    category: ToolCategories.EMAIL,
    description: 'Find email addresses for a domain',
    baseUrl: 'https://hunter.io',
    commands: {
      domain_search: {
        description: 'Find all email addresses for a domain',
        input_fields: [
          { name: 'domain', selector: 'input[name="domain"]', type: FieldTypes.DOMAIN, required: true }
        ],
        output_fields: [
          { name: 'emails', selector: '.email-list .email-item', type: 'array' },
          { name: 'pattern', selector: '.pattern', type: 'text' }
        ],
        submit_selector: 'button[type="submit"]'
      },
      email_finder: {
        description: 'Find email for a specific person at a domain',
        input_fields: [
          { name: 'domain', selector: 'input[name="domain"]', type: FieldTypes.DOMAIN, required: true },
          { name: 'first_name', selector: 'input[name="first_name"]', type: FieldTypes.TEXT },
          { name: 'last_name', selector: 'input[name="last_name"]', type: FieldTypes.TEXT }
        ],
        output_fields: [
          { name: 'email', selector: '.result-email', type: 'text' },
          { name: 'confidence', selector: '.confidence-score', type: 'number' }
        ]
      }
    },
    api_config: {
      requires_key: true,
      key_param: 'api_key'
    }
  },

  whois: {
    name: 'WHOIS Lookup',
    category: ToolCategories.WHOIS,
    description: 'Domain registration information lookup',
    baseUrl: 'https://whois.domaintools.com',
    commands: {
      domain_lookup: {
        description: 'Get WHOIS information for domain',
        input_fields: [
          { name: 'domain', selector: '#search-input', type: FieldTypes.DOMAIN, required: true }
        ],
        output_fields: [
          { name: 'registrar', selector: '.registrar', type: 'text' },
          { name: 'creation_date', selector: '.created-date', type: 'date' },
          { name: 'expiration_date', selector: '.expiry-date', type: 'date' },
          { name: 'name_servers', selector: '.nameservers', type: 'array' }
        ]
      }
    }
  },

  wayback: {
    name: 'Wayback Machine',
    category: ToolCategories.ARCHIVE,
    description: 'Internet Archive historical snapshots',
    baseUrl: 'https://web.archive.org',
    commands: {
      availability: {
        description: 'Check if URL has archived snapshots',
        input_fields: [
          { name: 'url', selector: '#web-search-input', type: FieldTypes.URL, required: true }
        ],
        output_fields: [
          { name: 'available', selector: '.availability', type: 'checkbox' },
          { name: 'snapshots', selector: '.calendar-results', type: 'array' }
        ]
      },
      view_snapshot: {
        description: 'View specific date snapshot',
        input_fields: [
          { name: 'url', selector: '#web-search-input', type: FieldTypes.URL, required: true },
          { name: 'timestamp', selector: 'input[name="timestamp"]', type: FieldTypes.DATE }
        ],
        output_fields: [
          { name: 'snapshot_url', selector: '.snapshot-link', type: 'url' }
        ]
      }
    }
  },

  virustotal: {
    name: 'VirusTotal',
    category: ToolCategories.VULNERABILITY,
    description: 'File and URL malware analysis',
    baseUrl: 'https://www.virustotal.com',
    commands: {
      scan_url: {
        description: 'Scan URL for malware',
        input_fields: [
          { name: 'url', selector: 'input[name="url"]', type: FieldTypes.URL, required: true }
        ],
        output_fields: [
          { name: 'detection_ratio', selector: '.detection-ratio', type: 'text' },
          { name: 'scan_results', selector: '.scan-results', type: 'array' }
        ]
      },
      scan_hash: {
        description: 'Look up file hash',
        input_fields: [
          { name: 'hash', selector: 'input[name="search"]', type: FieldTypes.TEXT, required: true }
        ],
        output_fields: [
          { name: 'file_info', selector: '.file-details', type: 'object' },
          { name: 'detections', selector: '.detection-list', type: 'array' }
        ]
      }
    },
    api_config: {
      requires_key: true,
      key_header: 'x-apikey'
    }
  },

  dnsdumpster: {
    name: 'DNSDumpster',
    category: ToolCategories.DNS,
    description: 'DNS reconnaissance and research',
    baseUrl: 'https://dnsdumpster.com',
    commands: {
      domain_search: {
        description: 'Find DNS records for domain',
        input_fields: [
          { name: 'domain', selector: 'input[name="targetip"]', type: FieldTypes.DOMAIN, required: true }
        ],
        output_fields: [
          { name: 'dns_records', selector: '.table-dns', type: 'array' },
          { name: 'mx_records', selector: '.table-mx', type: 'array' },
          { name: 'txt_records', selector: '.table-txt', type: 'array' }
        ],
        submit_selector: 'button[type="submit"]'
      }
    }
  },

  securitytrails: {
    name: 'SecurityTrails',
    category: ToolCategories.DNS,
    description: 'DNS and domain intelligence',
    baseUrl: 'https://securitytrails.com',
    commands: {
      domain_lookup: {
        description: 'Get comprehensive domain data',
        input_fields: [
          { name: 'domain', selector: 'input[name="query"]', type: FieldTypes.DOMAIN, required: true }
        ],
        output_fields: [
          { name: 'subdomains', selector: '.subdomains-list', type: 'array' },
          { name: 'historical_dns', selector: '.dns-history', type: 'array' }
        ]
      }
    },
    api_config: {
      requires_key: true,
      key_header: 'APIKEY'
    }
  },

  social_analyzer: {
    name: 'Social Media Analyzer',
    category: ToolCategories.SOCIAL,
    description: 'Search for username across social platforms',
    baseUrl: null,
    commands: {
      username_search: {
        description: 'Find social media profiles by username',
        input_fields: [
          { name: 'username', selector: 'input[name="username"]', type: FieldTypes.USERNAME, required: true }
        ],
        output_fields: [
          { name: 'profiles', selector: '.profile-results', type: 'array' }
        ],
        platforms: ['twitter', 'facebook', 'instagram', 'linkedin', 'github', 'reddit']
      }
    }
  }
};

// =============================================================================
// Tool Parser Class
// =============================================================================

/**
 * OSINT Tool Parser for knowledge base integration
 * @class ToolParser
 */
class ToolParser {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.yamlParser = new SimpleYAMLParser();
    this.presets = COMMAND_PRESETS;
  }

  /**
   * Parse OSINT tool YAML configuration
   * @param {string} yamlContent - YAML configuration string
   * @returns {Object} Parsed tool configuration with validation
   */
  parseToolInfo(yamlContent) {
    if (!yamlContent || typeof yamlContent !== 'string') {
      return {
        success: false,
        error: 'YAML content is required and must be a string',
        config: null
      };
    }

    try {
      const config = this.yamlParser.parse(yamlContent);

      // Validate required fields
      const validation = this._validateToolConfig(config);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join('; '),
          warnings: validation.warnings,
          config: null
        };
      }

      // Normalize the configuration
      const normalizedConfig = this._normalizeToolConfig(config);

      return {
        success: true,
        config: normalizedConfig,
        warnings: validation.warnings,
        metadata: {
          toolName: normalizedConfig.tool_name,
          category: normalizedConfig.category || ToolCategories.GENERAL,
          inputFieldCount: normalizedConfig.input_fields?.length || 0,
          outputFieldCount: normalizedConfig.output_fields?.length || 0,
          hasApiConfig: !!normalizedConfig.api_config,
          parsedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `YAML parsing failed: ${error.message}`,
        config: null
      };
    }
  }

  /**
   * Validate tool configuration
   * @private
   */
  _validateToolConfig(config) {
    const errors = [];
    const warnings = [];

    // Required field: tool_name
    if (!config.tool_name) {
      errors.push('Missing required field: tool_name');
    }

    // Validate input_fields if present
    if (config.input_fields) {
      if (!Array.isArray(config.input_fields)) {
        errors.push('input_fields must be an array');
      } else {
        config.input_fields.forEach((field, index) => {
          if (!field.name) {
            errors.push(`input_fields[${index}]: missing required 'name' property`);
          }
          if (!field.selector && !field.api_param) {
            warnings.push(`input_fields[${index}]: no selector or api_param defined`);
          }
          if (field.type && !Object.values(FieldTypes).includes(field.type)) {
            warnings.push(`input_fields[${index}]: unknown type '${field.type}'`);
          }
        });
      }
    }

    // Validate output_fields if present
    if (config.output_fields) {
      if (!Array.isArray(config.output_fields)) {
        errors.push('output_fields must be an array');
      } else {
        config.output_fields.forEach((field, index) => {
          if (!field.name) {
            errors.push(`output_fields[${index}]: missing required 'name' property`);
          }
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Normalize tool configuration to standard format
   * @private
   */
  _normalizeToolConfig(config) {
    const normalized = {
      tool_name: config.tool_name,
      description: config.description || null,
      category: config.category || ToolCategories.GENERAL,
      base_url: config.base_url || config.baseUrl || null,
      input_fields: (config.input_fields || []).map(field => ({
        name: field.name,
        selector: field.selector || null,
        type: field.type || FieldTypes.TEXT,
        required: field.required || false,
        default_value: field.default_value || field.default || null,
        validation: field.validation || null,
        api_param: field.api_param || null,
        label: field.label || this._generateLabel(field.name)
      })),
      output_fields: (config.output_fields || []).map(field => ({
        name: field.name,
        selector: field.selector || null,
        type: field.type || 'text',
        transform: field.transform || null,
        multiple: field.multiple || false
      })),
      submit_selector: config.submit_selector || null,
      api_config: config.api_config || null,
      commands: config.commands || null
    };

    return normalized;
  }

  /**
   * Generate human-readable label from field name
   * @private
   */
  _generateLabel(name) {
    return name
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Auto-generate form field mappings from tool configuration
   * @param {Object} toolConfig - Parsed tool configuration
   * @returns {Object} Field mappings for form automation
   */
  generateFieldMappings(toolConfig) {
    if (!toolConfig) {
      return {
        success: false,
        error: 'Tool configuration is required',
        mappings: null
      };
    }

    const config = toolConfig.config || toolConfig;

    try {
      const mappings = {
        tool_name: config.tool_name,
        input_mappings: {},
        output_mappings: {},
        form_config: {
          submit_selector: config.submit_selector,
          base_url: config.base_url
        }
      };

      // Generate input field mappings
      if (config.input_fields && Array.isArray(config.input_fields)) {
        for (const field of config.input_fields) {
          mappings.input_mappings[field.name] = {
            selector: field.selector,
            type: field.type,
            required: field.required,
            label: field.label || this._generateLabel(field.name),
            validation: this._generateValidation(field),
            api_param: field.api_param,
            autofill_hint: this._generateAutofillHint(field)
          };
        }
      }

      // Generate output field mappings
      if (config.output_fields && Array.isArray(config.output_fields)) {
        for (const field of config.output_fields) {
          mappings.output_mappings[field.name] = {
            selector: field.selector,
            type: field.type,
            multiple: field.multiple,
            transform: field.transform,
            extract_method: this._determineExtractionMethod(field)
          };
        }
      }

      // Generate CSS selector map for quick access
      mappings.selector_map = this._generateSelectorMap(config);

      // Generate field dependency graph
      mappings.field_dependencies = this._generateFieldDependencies(config);

      return {
        success: true,
        mappings,
        metadata: {
          inputFieldCount: Object.keys(mappings.input_mappings).length,
          outputFieldCount: Object.keys(mappings.output_mappings).length,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to generate field mappings: ${error.message}`,
        mappings: null
      };
    }
  }

  /**
   * Generate validation rules for a field
   * @private
   */
  _generateValidation(field) {
    const validation = field.validation || {};

    // Add type-based validation
    switch (field.type) {
      case FieldTypes.EMAIL:
        validation.pattern = validation.pattern || '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$';
        validation.message = validation.message || 'Please enter a valid email address';
        break;
      case FieldTypes.IP:
        validation.pattern = validation.pattern || '^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$';
        validation.message = validation.message || 'Please enter a valid IP address';
        break;
      case FieldTypes.DOMAIN:
        validation.pattern = validation.pattern || '^(?=.{1,253}$)(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\\.)+[A-Za-z]{2,63}$';
        validation.message = validation.message || 'Please enter a valid domain name';
        break;
      case FieldTypes.URL:
        validation.pattern = validation.pattern || '^https?:\\/\\/.+';
        validation.message = validation.message || 'Please enter a valid URL';
        break;
      case FieldTypes.NUMBER:
        validation.type = 'number';
        break;
    }

    if (field.required) {
      validation.required = true;
    }

    return validation;
  }

  /**
   * Generate autofill hint for browser autocomplete
   * @private
   */
  _generateAutofillHint(field) {
    const hintMap = {
      [FieldTypes.EMAIL]: 'email',
      [FieldTypes.URL]: 'url',
      [FieldTypes.USERNAME]: 'username',
      [FieldTypes.PASSWORD]: 'current-password'
    };
    return hintMap[field.type] || 'off';
  }

  /**
   * Determine extraction method for output field
   * @private
   */
  _determineExtractionMethod(field) {
    if (field.type === 'array' || field.multiple) {
      return 'querySelectorAll';
    }
    if (field.type === 'object') {
      return 'parseStructured';
    }
    return 'querySelector';
  }

  /**
   * Generate selector map for quick access
   * @private
   */
  _generateSelectorMap(config) {
    const map = {};

    if (config.input_fields) {
      for (const field of config.input_fields) {
        if (field.selector) {
          map[field.name] = { selector: field.selector, direction: 'input' };
        }
      }
    }

    if (config.output_fields) {
      for (const field of config.output_fields) {
        if (field.selector) {
          map[field.name] = { selector: field.selector, direction: 'output' };
        }
      }
    }

    if (config.submit_selector) {
      map['_submit'] = { selector: config.submit_selector, direction: 'action' };
    }

    return map;
  }

  /**
   * Generate field dependency graph
   * @private
   */
  _generateFieldDependencies(config) {
    const dependencies = {};

    if (config.input_fields) {
      for (const field of config.input_fields) {
        if (field.depends_on) {
          dependencies[field.name] = Array.isArray(field.depends_on)
            ? field.depends_on
            : [field.depends_on];
        }
      }
    }

    return dependencies;
  }

  /**
   * Get command preset for a common OSINT tool
   * @param {string} toolName - Name of the tool (e.g., 'shodan', 'hunter')
   * @param {string} [commandName] - Specific command name (optional)
   * @returns {Object} Tool preset configuration
   */
  getCommandPreset(toolName, commandName = null) {
    if (!toolName || typeof toolName !== 'string') {
      return {
        success: false,
        error: 'Tool name is required',
        preset: null
      };
    }

    const normalizedName = toolName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const preset = this.presets[normalizedName];

    if (!preset) {
      // Try partial match
      const matchingKey = Object.keys(this.presets).find(key =>
        key.includes(normalizedName) || normalizedName.includes(key)
      );

      if (matchingKey) {
        return this._formatPresetResponse(this.presets[matchingKey], commandName);
      }

      return {
        success: false,
        error: `No preset found for tool: ${toolName}`,
        availableTools: Object.keys(this.presets),
        preset: null
      };
    }

    return this._formatPresetResponse(preset, commandName);
  }

  /**
   * Format preset response
   * @private
   */
  _formatPresetResponse(preset, commandName) {
    if (commandName && preset.commands) {
      const command = preset.commands[commandName];
      if (!command) {
        return {
          success: false,
          error: `Command '${commandName}' not found for tool`,
          availableCommands: Object.keys(preset.commands),
          preset: null
        };
      }

      return {
        success: true,
        preset: {
          tool_name: preset.name,
          category: preset.category,
          base_url: preset.baseUrl,
          command_name: commandName,
          ...command,
          api_config: preset.api_config
        }
      };
    }

    // Return full tool preset
    return {
      success: true,
      preset: {
        tool_name: preset.name,
        category: preset.category,
        description: preset.description,
        base_url: preset.baseUrl,
        commands: preset.commands,
        api_config: preset.api_config,
        available_commands: Object.keys(preset.commands || {})
      }
    };
  }

  /**
   * Get list of all available preset tools
   * @returns {Object} List of available tools with metadata
   */
  listPresets() {
    const tools = [];

    for (const [key, preset] of Object.entries(this.presets)) {
      tools.push({
        id: key,
        name: preset.name,
        category: preset.category,
        description: preset.description,
        commandCount: Object.keys(preset.commands || {}).length,
        requiresApiKey: preset.api_config?.requires_key || false
      });
    }

    return {
      success: true,
      tools,
      count: tools.length,
      categories: Object.values(ToolCategories)
    };
  }

  /**
   * Chain tool outputs to inputs for workflow automation
   * @param {Array} toolSequence - Array of tool steps with configurations
   * @param {Object} initialData - Initial data to start the chain
   * @returns {Object} Chained workflow configuration
   */
  chainTools(toolSequence, initialData = {}) {
    if (!toolSequence || !Array.isArray(toolSequence)) {
      return {
        success: false,
        error: 'Tool sequence must be an array',
        workflow: null
      };
    }

    if (toolSequence.length === 0) {
      return {
        success: false,
        error: 'Tool sequence cannot be empty',
        workflow: null
      };
    }

    try {
      const workflow = {
        id: this._generateWorkflowId(),
        steps: [],
        data_flow: {},
        initial_data: initialData,
        created_at: new Date().toISOString()
      };

      let previousOutputs = Object.keys(initialData);

      for (let i = 0; i < toolSequence.length; i++) {
        const step = toolSequence[i];
        const stepConfig = this._buildWorkflowStep(step, i, previousOutputs);

        if (!stepConfig.valid) {
          return {
            success: false,
            error: `Step ${i + 1}: ${stepConfig.error}`,
            workflow: null
          };
        }

        workflow.steps.push(stepConfig.step);

        // Track data flow
        if (stepConfig.step.input_mapping) {
          for (const [inputField, sourceRef] of Object.entries(stepConfig.step.input_mapping)) {
            workflow.data_flow[`step_${i}_${inputField}`] = sourceRef;
          }
        }

        // Update available outputs for next step
        if (stepConfig.step.output_fields) {
          previousOutputs = [
            ...previousOutputs,
            ...stepConfig.step.output_fields.map(f => `step_${i}.${f.name}`)
          ];
        }
      }

      // Generate execution plan
      workflow.execution_plan = this._generateExecutionPlan(workflow);

      return {
        success: true,
        workflow,
        metadata: {
          stepCount: workflow.steps.length,
          totalInputFields: workflow.steps.reduce((sum, s) => sum + (s.input_fields?.length || 0), 0),
          totalOutputFields: workflow.steps.reduce((sum, s) => sum + (s.output_fields?.length || 0), 0),
          estimatedDuration: this._estimateWorkflowDuration(workflow)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to chain tools: ${error.message}`,
        workflow: null
      };
    }
  }

  /**
   * Build a workflow step configuration
   * @private
   */
  _buildWorkflowStep(stepDef, index, availableData) {
    // Step can be a tool name string or full config object
    const step = typeof stepDef === 'string'
      ? { tool: stepDef }
      : stepDef;

    if (!step.tool) {
      return { valid: false, error: 'Each step must specify a tool' };
    }

    // Get preset if available
    const presetResult = this.getCommandPreset(step.tool, step.command);
    let baseConfig = {};

    if (presetResult.success) {
      baseConfig = presetResult.preset;
    } else if (!step.config) {
      return { valid: false, error: `Unknown tool '${step.tool}' and no config provided` };
    }

    // Merge with step-specific config
    const mergedConfig = {
      ...baseConfig,
      ...(step.config || {})
    };

    // Build input mapping
    const inputMapping = step.input_mapping || {};

    // Auto-map inputs from available data
    if (mergedConfig.input_fields && step.auto_map !== false) {
      for (const field of mergedConfig.input_fields) {
        if (!inputMapping[field.name]) {
          // Try to find matching data
          const matchingData = this._findMatchingData(field.name, availableData);
          if (matchingData) {
            inputMapping[field.name] = matchingData;
          }
        }
      }
    }

    // Validate required inputs
    if (mergedConfig.input_fields) {
      for (const field of mergedConfig.input_fields) {
        if (field.required && !inputMapping[field.name] && !step.skip_validation) {
          return {
            valid: false,
            error: `Required input '${field.name}' not mapped`
          };
        }
      }
    }

    return {
      valid: true,
      step: {
        index,
        tool_name: mergedConfig.tool_name || step.tool,
        command: step.command || null,
        input_fields: mergedConfig.input_fields || [],
        output_fields: mergedConfig.output_fields || [],
        input_mapping: inputMapping,
        selector_map: mergedConfig.selector_map || null,
        submit_selector: mergedConfig.submit_selector,
        wait_for: step.wait_for || mergedConfig.wait_for || null,
        timeout: step.timeout || 30000,
        on_error: step.on_error || 'stop',
        transform: step.transform || null
      }
    };
  }

  /**
   * Find matching data source for a field name
   * @private
   */
  _findMatchingData(fieldName, availableData) {
    // Direct match
    if (availableData.includes(fieldName)) {
      return fieldName;
    }

    // Common field name variations
    const variations = {
      'ip_address': ['ip', 'host_ip', 'target_ip'],
      'ip': ['ip_address', 'host_ip', 'target_ip'],
      'domain': ['hostname', 'target_domain', 'site'],
      'email': ['email_address', 'mail', 'target_email'],
      'url': ['target_url', 'website', 'site_url'],
      'query': ['search', 'search_query', 'q'],
      'username': ['user', 'user_name', 'handle']
    };

    const possibleMatches = variations[fieldName] || [];
    for (const variation of possibleMatches) {
      if (availableData.includes(variation)) {
        return variation;
      }
      // Check step outputs
      const stepMatch = availableData.find(d => d.endsWith(`.${variation}`));
      if (stepMatch) {
        return stepMatch;
      }
    }

    // Check step outputs for exact match
    const stepMatch = availableData.find(d => d.endsWith(`.${fieldName}`));
    return stepMatch || null;
  }

  /**
   * Generate execution plan for workflow
   * @private
   */
  _generateExecutionPlan(workflow) {
    const plan = [];

    for (const step of workflow.steps) {
      const actions = [];

      // Navigate if needed
      if (step.base_url) {
        actions.push({
          type: 'navigate',
          target: step.base_url
        });
      }

      // Fill input fields
      if (step.input_fields && step.input_fields.length > 0) {
        for (const field of step.input_fields) {
          if (field.selector && step.input_mapping[field.name]) {
            actions.push({
              type: 'fill_field',
              selector: field.selector,
              value_source: step.input_mapping[field.name]
            });
          }
        }
      }

      // Submit form
      if (step.submit_selector) {
        actions.push({
          type: 'click',
          selector: step.submit_selector
        });
      }

      // Wait for results
      if (step.wait_for) {
        actions.push({
          type: 'wait_for_element',
          selector: step.wait_for,
          timeout: step.timeout
        });
      }

      // Extract outputs
      if (step.output_fields && step.output_fields.length > 0) {
        for (const field of step.output_fields) {
          if (field.selector) {
            actions.push({
              type: 'extract',
              selector: field.selector,
              field_name: field.name,
              multiple: field.multiple || false
            });
          }
        }
      }

      plan.push({
        step_index: step.index,
        tool: step.tool_name,
        actions,
        on_error: step.on_error
      });
    }

    return plan;
  }

  /**
   * Estimate workflow duration
   * @private
   */
  _estimateWorkflowDuration(workflow) {
    let totalMs = 0;

    for (const step of workflow.steps) {
      // Base navigation time
      totalMs += 2000;

      // Time per input field
      totalMs += (step.input_fields?.length || 0) * 500;

      // Wait time
      totalMs += step.timeout || 5000;
    }

    return Math.ceil(totalMs / 1000) + ' seconds';
  }

  /**
   * Generate unique workflow ID
   * @private
   */
  _generateWorkflowId() {
    return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.ToolParser = ToolParser;
  globalThis.SimpleYAMLParser = SimpleYAMLParser;
  globalThis.FieldTypes = FieldTypes;
  globalThis.ToolCategories = ToolCategories;
  globalThis.COMMAND_PRESETS = COMMAND_PRESETS;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ToolParser,
    SimpleYAMLParser,
    FieldTypes,
    ToolCategories,
    COMMAND_PRESETS
  };
}
