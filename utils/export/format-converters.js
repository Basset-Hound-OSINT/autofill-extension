/**
 * Basset Hound Browser Automation - Format Converters
 * Phase 18.2: Export/Import and Report Generation
 *
 * Convert between different data formats:
 * - JSON ↔ CSV ↔ XML ↔ STIX
 * - Data sanitization and validation
 * - Schema migration for old exports
 * - Batch conversion support
 *
 * @module format-converters
 */

// =============================================================================
// Configuration
// =============================================================================

const ConverterConfig = {
  // Supported formats
  FORMATS: ['json', 'csv', 'xml', 'stix'],

  // Conversion options
  CSV_DELIMITER: ',',
  CSV_QUOTE: '"',
  CSV_NEWLINE: '\n',
  CSV_FLATTEN_NESTED: true,

  XML_ROOT_TAG: 'data',
  XML_ITEM_TAG: 'item',
  XML_INDENT: 2,

  // Schema versions
  CURRENT_SCHEMA_VERSION: '2.0.0',
  SUPPORTED_VERSIONS: ['1.0.0', '1.5.0', '2.0.0']
};

// =============================================================================
// FormatConverter Class
// =============================================================================

/**
 * FormatConverter - Convert between data formats
 */
class FormatConverter {
  constructor(options = {}) {
    this.config = {
      logger: options.logger || null
    };
  }

  // ===========================================================================
  // Main Conversion Methods
  // ===========================================================================

  /**
   * Convert data from one format to another
   * @param {string|Object} data - Input data
   * @param {string} fromFormat - Source format
   * @param {string} toFormat - Target format
   * @param {Object} options - Conversion options
   * @returns {Promise<Object>} Conversion result
   */
  async convert(data, fromFormat, toFormat, options = {}) {
    try {
      this._log('info', `Converting from ${fromFormat} to ${toFormat}`);

      // Parse input data if needed
      let parsedData = data;
      if (typeof data === 'string') {
        parsedData = await this._parseFormat(data, fromFormat);
      }

      // Validate input
      const validation = this._validateData(parsedData, fromFormat);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.errors,
          timestamp: Date.now()
        };
      }

      // Sanitize data
      if (options.sanitize !== false) {
        parsedData = this._sanitizeData(parsedData);
      }

      // Convert to target format
      const converted = await this._convertToFormat(parsedData, toFormat, options);

      this._log('info', `Conversion completed: ${fromFormat} → ${toFormat}`);

      return {
        success: true,
        fromFormat,
        toFormat,
        data: converted,
        timestamp: Date.now()
      };

    } catch (error) {
      this._log('error', `Conversion failed: ${error.message}`);

      return {
        success: false,
        error: error.message,
        fromFormat,
        toFormat,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Batch convert multiple data items
   * @param {Array} items - Items to convert
   * @param {string} fromFormat - Source format
   * @param {string} toFormat - Target format
   * @param {Object} options - Conversion options
   * @returns {Promise<Object>} Batch conversion result
   */
  async batchConvert(items, fromFormat, toFormat, options = {}) {
    const results = [];

    for (const item of items) {
      const result = await this.convert(item, fromFormat, toFormat, options);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return {
      success: true,
      total: items.length,
      successCount,
      failCount,
      results,
      timestamp: Date.now()
    };
  }

  // ===========================================================================
  // Parsing Methods
  // ===========================================================================

  /**
   * Parse data based on format
   * @private
   */
  async _parseFormat(data, format) {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.parse(data);

      case 'csv':
        return this._parseCSV(data);

      case 'xml':
        return this._parseXML(data);

      case 'stix':
        return JSON.parse(data); // STIX is JSON-based

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Parse CSV data
   * @private
   */
  _parseCSV(csvData) {
    const lines = csvData.split(ConverterConfig.CSV_NEWLINE).filter(line => line.trim());

    if (lines.length < 2) {
      throw new Error('CSV must have header and at least one data row');
    }

    const headers = this._parseCSVLine(lines[0]);
    const records = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this._parseCSVLine(lines[i]);
      const record = {};

      for (let j = 0; j < headers.length; j++) {
        record[headers[j]] = this._parseCSVValue(values[j]);
      }

      records.push(record);
    }

    return records;
  }

  /**
   * Parse CSV line
   * @private
   */
  _parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === ConverterConfig.CSV_QUOTE) {
        inQuotes = !inQuotes;
      } else if (char === ConverterConfig.CSV_DELIMITER && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Parse CSV value (detect type)
   * @private
   */
  _parseCSVValue(value) {
    if (!value || value === '') return null;

    // Try number
    if (!isNaN(value)) {
      return parseFloat(value);
    }

    // Try boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Try JSON
    if ((value.startsWith('{') && value.endsWith('}')) ||
        (value.startsWith('[') && value.endsWith(']'))) {
      try {
        return JSON.parse(value);
      } catch {
        // Not JSON, return as string
      }
    }

    return value;
  }

  /**
   * Parse XML data
   * @private
   */
  _parseXML(xmlData) {
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlData, 'text/xml');
      return this._xmlToJson(doc.documentElement);
    } else {
      throw new Error('XML parsing not available in this environment');
    }
  }

  /**
   * Convert XML to JSON
   * @private
   */
  _xmlToJson(xml) {
    const obj = {};

    // Attributes
    if (xml.attributes && xml.attributes.length > 0) {
      obj['@attributes'] = {};
      for (let i = 0; i < xml.attributes.length; i++) {
        const attr = xml.attributes[i];
        obj['@attributes'][attr.nodeName] = attr.nodeValue;
      }
    }

    // Children
    if (xml.hasChildNodes()) {
      for (let i = 0; i < xml.childNodes.length; i++) {
        const child = xml.childNodes[i];

        if (child.nodeType === 1) { // Element
          const nodeName = child.nodeName;

          if (!obj[nodeName]) {
            obj[nodeName] = this._xmlToJson(child);
          } else {
            if (!Array.isArray(obj[nodeName])) {
              obj[nodeName] = [obj[nodeName]];
            }
            obj[nodeName].push(this._xmlToJson(child));
          }
        } else if (child.nodeType === 3) { // Text
          const text = child.nodeValue.trim();
          if (text) {
            obj['#text'] = text;
          }
        }
      }
    }

    return obj;
  }

  // ===========================================================================
  // Conversion Methods
  // ===========================================================================

  /**
   * Convert data to target format
   * @private
   */
  async _convertToFormat(data, format, options) {
    switch (format.toLowerCase()) {
      case 'json':
        return this._convertToJSON(data, options);

      case 'csv':
        return this._convertToCSV(data, options);

      case 'xml':
        return this._convertToXML(data, options);

      case 'stix':
        return this._convertToSTIX(data, options);

      default:
        throw new Error(`Unsupported target format: ${format}`);
    }
  }

  /**
   * Convert to JSON
   * @private
   */
  _convertToJSON(data, options) {
    return JSON.stringify(data, null, options.pretty ? 2 : 0);
  }

  /**
   * Convert to CSV
   * @private
   */
  _convertToCSV(data, options) {
    const records = Array.isArray(data) ? data : [data];

    if (records.length === 0) {
      return '';
    }

    // Flatten nested objects if needed
    const flatRecords = ConverterConfig.CSV_FLATTEN_NESTED
      ? records.map(r => this._flattenObject(r))
      : records;

    // Get all unique headers
    const headers = new Set();
    flatRecords.forEach(record => {
      Object.keys(record).forEach(key => headers.add(key));
    });

    const headerArray = Array.from(headers);

    // Build CSV
    let csv = headerArray.map(h => this._escapeCSVValue(h)).join(ConverterConfig.CSV_DELIMITER);
    csv += ConverterConfig.CSV_NEWLINE;

    for (const record of flatRecords) {
      const values = headerArray.map(header => {
        const value = record[header];
        return this._escapeCSVValue(this._stringifyValue(value));
      });
      csv += values.join(ConverterConfig.CSV_DELIMITER);
      csv += ConverterConfig.CSV_NEWLINE;
    }

    return csv;
  }

  /**
   * Flatten nested object
   * @private
   */
  _flattenObject(obj, prefix = '') {
    const flattened = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, this._flattenObject(value, newKey));
      } else {
        flattened[newKey] = value;
      }
    }

    return flattened;
  }

  /**
   * Escape CSV value
   * @private
   */
  _escapeCSVValue(value) {
    const str = String(value);

    if (str.includes(ConverterConfig.CSV_DELIMITER) ||
        str.includes(ConverterConfig.CSV_QUOTE) ||
        str.includes(ConverterConfig.CSV_NEWLINE)) {
      return ConverterConfig.CSV_QUOTE +
             str.replace(new RegExp(ConverterConfig.CSV_QUOTE, 'g'),
                        ConverterConfig.CSV_QUOTE + ConverterConfig.CSV_QUOTE) +
             ConverterConfig.CSV_QUOTE;
    }

    return str;
  }

  /**
   * Stringify value for CSV
   * @private
   */
  _stringifyValue(value) {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  /**
   * Convert to XML
   * @private
   */
  _convertToXML(data, options) {
    const records = Array.isArray(data) ? data : [data];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<${ConverterConfig.XML_ROOT_TAG}>\n`;

    for (const record of records) {
      xml += this._objectToXML(record, ConverterConfig.XML_ITEM_TAG, 1);
    }

    xml += `</${ConverterConfig.XML_ROOT_TAG}>`;

    return xml;
  }

  /**
   * Convert object to XML
   * @private
   */
  _objectToXML(obj, tagName, indent = 0) {
    const indentStr = ' '.repeat(indent * ConverterConfig.XML_INDENT);
    let xml = `${indentStr}<${tagName}>\n`;

    for (const [key, value] of Object.entries(obj)) {
      const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '_');

      if (value === null || value === undefined) {
        xml += `${indentStr}  <${safeKey}/>\n`;
      } else if (Array.isArray(value)) {
        for (const item of value) {
          xml += this._objectToXML({ item }, safeKey, indent + 1);
        }
      } else if (typeof value === 'object') {
        xml += this._objectToXML(value, safeKey, indent + 1);
      } else {
        xml += `${indentStr}  <${safeKey}>${this._escapeXML(String(value))}</${safeKey}>\n`;
      }
    }

    xml += `${indentStr}</${tagName}>\n`;
    return xml;
  }

  /**
   * Escape XML special characters
   * @private
   */
  _escapeXML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Convert to STIX 2.1 format
   * @private
   */
  _convertToSTIX(data, options) {
    const records = Array.isArray(data) ? data : [data];

    const bundle = {
      type: 'bundle',
      id: `bundle--${this._generateUUID()}`,
      spec_version: '2.1',
      objects: []
    };

    for (const record of records) {
      // Convert record to STIX object
      const stixObject = this._recordToSTIX(record);
      if (stixObject) {
        bundle.objects.push(stixObject);
      }
    }

    return JSON.stringify(bundle, null, 2);
  }

  /**
   * Convert record to STIX object
   * @private
   */
  _recordToSTIX(record) {
    // Determine STIX type based on record
    const stixType = this._determineSTIXType(record);

    const stixObject = {
      type: stixType,
      id: `${stixType}--${this._generateUUID()}`,
      created: new Date().toISOString(),
      modified: new Date().toISOString()
    };

    // Map common fields
    if (record.name) stixObject.name = record.name;
    if (record.description) stixObject.description = record.description;
    if (record.value) stixObject.value = record.value;

    // Add custom properties
    stixObject.x_custom_properties = { ...record };

    return stixObject;
  }

  /**
   * Determine STIX type
   * @private
   */
  _determineSTIXType(record) {
    if (record.type) {
      // Map common types to STIX types
      const typeMap = {
        'ip': 'ipv4-addr',
        'domain': 'domain-name',
        'url': 'url',
        'email': 'email-addr',
        'file': 'file',
        'indicator': 'indicator',
        'threat': 'threat-actor'
      };

      return typeMap[record.type.toLowerCase()] || 'observed-data';
    }

    return 'observed-data';
  }

  // ===========================================================================
  // Schema Migration Methods
  // ===========================================================================

  /**
   * Migrate data schema to current version
   * @param {Object} data - Data to migrate
   * @param {string} fromVersion - Source schema version
   * @returns {Object} Migrated data
   */
  async migrateSchema(data, fromVersion) {
    if (!ConverterConfig.SUPPORTED_VERSIONS.includes(fromVersion)) {
      throw new Error(`Unsupported schema version: ${fromVersion}`);
    }

    if (fromVersion === ConverterConfig.CURRENT_SCHEMA_VERSION) {
      return data;
    }

    this._log('info', `Migrating schema from ${fromVersion} to ${ConverterConfig.CURRENT_SCHEMA_VERSION}`);

    let migrated = { ...data };

    // Apply migrations in sequence
    if (fromVersion === '1.0.0') {
      migrated = this._migrateFrom1_0_to_1_5(migrated);
      migrated = this._migrateFrom1_5_to_2_0(migrated);
    } else if (fromVersion === '1.5.0') {
      migrated = this._migrateFrom1_5_to_2_0(migrated);
    }

    // Update version
    migrated.schemaVersion = ConverterConfig.CURRENT_SCHEMA_VERSION;

    return migrated;
  }

  /**
   * Migrate from schema 1.0 to 1.5
   * @private
   */
  _migrateFrom1_0_to_1_5(data) {
    const migrated = { ...data };

    // Add new fields introduced in 1.5
    if (migrated.exportMetadata) {
      migrated.exportMetadata.schemaVersion = '1.5.0';
      migrated.exportMetadata.standard = migrated.exportMetadata.standard || 'NIST-DF';
    }

    return migrated;
  }

  /**
   * Migrate from schema 1.5 to 2.0
   * @private
   */
  _migrateFrom1_5_to_2_0(data) {
    const migrated = { ...data };

    // Update metadata structure
    if (migrated.exportMetadata) {
      migrated.exportMetadata.schemaVersion = '2.0.0';
      migrated.exportMetadata.standard = 'NIST-DF-2024';

      // Restructure evidence format
      if (migrated.evidence && Array.isArray(migrated.evidence)) {
        migrated.evidence = migrated.evidence.map(e => ({
          ...e,
          integrity: e.integrity || { algorithm: 'SHA-256', hash: e.hash },
          metadata: e.metadata || {}
        }));
      }
    }

    return migrated;
  }

  // ===========================================================================
  // Validation and Sanitization
  // ===========================================================================

  /**
   * Validate data
   * @private
   */
  _validateData(data, format) {
    const errors = [];

    if (!data) {
      errors.push({ field: 'root', error: 'Data is required' });
    }

    // Format-specific validation
    if (format === 'stix') {
      if (data.type !== 'bundle') {
        errors.push({ field: 'type', error: 'STIX data must be a bundle' });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize data
   * @private
   */
  _sanitizeData(data) {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized = Array.isArray(data) ? [] : {};

    for (const [key, value] of Object.entries(data)) {
      // Remove potentially dangerous fields
      if (key.startsWith('__') || key.startsWith('$')) {
        continue;
      }

      // Recursively sanitize nested objects
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this._sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Generate UUID
   * @private
   */
  _generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Log message
   * @private
   */
  _log(level, message) {
    if (this.config.logger && this.config.logger[level]) {
      this.config.logger[level](message);
    } else if (typeof console !== 'undefined' && console[level]) {
      console[level]('[FormatConverter] ' + message);
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

if (typeof globalThis !== 'undefined') {
  globalThis.ConverterConfig = ConverterConfig;
  globalThis.FormatConverter = FormatConverter;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ConverterConfig,
    FormatConverter
  };
}
