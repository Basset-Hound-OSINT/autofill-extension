/**
 * Basset Hound Browser Automation - Evidence Importer
 * Phase 18.2: Export/Import and Report Generation
 *
 * Import evidence from external OSINT tools and formats:
 * - Maltego, Spiderfoot, Recon-ng compatibility
 * - CSV, JSON, XML, STIX format support
 * - Smart schema mapping
 * - Import validation and preview
 * - Conflict resolution (merge vs replace)
 * - Import history tracking
 *
 * @module evidence-importer
 */

// =============================================================================
// Configuration
// =============================================================================

const ImportConfig = {
  // Supported formats
  FORMATS: {
    JSON: 'json',
    CSV: 'csv',
    XML: 'xml',
    STIX: 'stix',
    MALTEGO: 'maltego',
    SPIDERFOOT: 'spiderfoot',
    RECON_NG: 'recon-ng'
  },

  // Import strategies
  STRATEGIES: {
    MERGE: 'merge',           // Merge with existing data
    REPLACE: 'replace',       // Replace existing data
    SKIP_EXISTING: 'skip',    // Skip if exists
    CREATE_NEW: 'create_new'  // Always create new entries
  },

  // Size limits
  MAX_IMPORT_SIZE_BYTES: 100 * 1024 * 1024, // 100MB
  MAX_RECORDS_PER_IMPORT: 10000,

  // Validation settings
  STRICT_VALIDATION: false,
  AUTO_FIX_ERRORS: true,

  // Storage keys
  STORAGE_KEY_IMPORTS: 'evidence_imports',
  STORAGE_KEY_IMPORT_HISTORY: 'import_history',
  STORAGE_KEY_IMPORT_MAPPINGS: 'import_mappings'
};

// =============================================================================
// Schema Mappings
// =============================================================================

/**
 * Schema mappings for external tools
 */
const SchemaMappings = {
  maltego: {
    entity: 'type',
    value: 'value',
    properties: 'metadata',
    label: 'label',
    weight: 'confidence'
  },
  spiderfoot: {
    module: 'source',
    type: 'type',
    data: 'value',
    source: 'sourceUrl',
    confidence: 'confidence'
  },
  'recon-ng': {
    module: 'source',
    host: 'host',
    ip_address: 'ip',
    latitude: 'geo.lat',
    longitude: 'geo.lng',
    country: 'geo.country'
  }
};

// =============================================================================
// EvidenceImporter Class
// =============================================================================

/**
 * EvidenceImporter - Import evidence from external tools
 */
class EvidenceImporter {
  /**
   * Create EvidenceImporter instance
   * @param {Object} options - Importer options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.sessionManager - Session manager instance
   */
  constructor(options = {}) {
    this.config = {
      logger: options.logger || null,
      sessionManager: options.sessionManager || null
    };

    this.importHistory = [];
    this.customMappings = new Map();
  }

  // ===========================================================================
  // Import Methods
  // ===========================================================================

  /**
   * Import evidence from file
   * @param {string|Object} data - File content or parsed data
   * @param {Object} options - Import options
   * @param {string} options.format - Import format (json, csv, xml, stix, maltego, spiderfoot, recon-ng)
   * @param {string} options.caseId - Target case ID
   * @param {string} options.sessionId - Target session ID
   * @param {string} options.strategy - Import strategy (merge, replace, skip, create_new)
   * @param {Object} options.mapping - Custom field mapping
   * @param {boolean} options.preview - Preview mode (don't save)
   * @param {boolean} options.validate - Validate before import
   * @returns {Promise<Object>} Import result
   */
  async importEvidence(data, options = {}) {
    const importId = this._generateImportId();

    try {
      this._log('info', `Starting import: ${importId} (format: ${options.format})`);

      // Parse data if needed
      const parsedData = typeof data === 'string'
        ? await this._parseData(data, options.format)
        : data;

      // Detect format if not specified
      const format = options.format || this._detectFormat(parsedData);

      // Validate size
      const dataSize = JSON.stringify(parsedData).length;
      if (dataSize > ImportConfig.MAX_IMPORT_SIZE_BYTES) {
        throw new Error(`Import size exceeds limit: ${this._formatBytes(dataSize)}`);
      }

      // Validate data
      if (options.validate !== false) {
        const validation = await this._validateImport(parsedData, format);
        if (!validation.valid) {
          if (ImportConfig.AUTO_FIX_ERRORS && validation.fixable) {
            parsedData = validation.fixed;
            this._log('info', `Auto-fixed ${validation.errors.length} validation errors`);
          } else {
            return {
              success: false,
              error: 'Validation failed',
              errors: validation.errors,
              importId,
              timestamp: Date.now()
            };
          }
        }
      }

      // Map data to our schema
      const mappedData = await this._mapData(parsedData, format, options.mapping);

      // Preview mode - return without saving
      if (options.preview) {
        return {
          success: true,
          preview: true,
          importId,
          format,
          recordCount: Array.isArray(mappedData) ? mappedData.length : 1,
          sampleRecords: Array.isArray(mappedData) ? mappedData.slice(0, 5) : [mappedData],
          mapping: this._getMapping(format, options.mapping),
          timestamp: Date.now()
        };
      }

      // Import data
      const importResult = await this._importMappedData(
        mappedData,
        options.caseId,
        options.sessionId,
        options.strategy || ImportConfig.STRATEGIES.MERGE
      );

      // Record in history
      await this._addToImportHistory({
        id: importId,
        format,
        caseId: options.caseId,
        sessionId: options.sessionId,
        strategy: options.strategy,
        recordCount: importResult.imported,
        timestamp: Date.now()
      });

      this._log('info', `Import completed: ${importResult.imported} records imported`);

      return {
        success: true,
        importId,
        format,
        recordCount: importResult.total,
        imported: importResult.imported,
        skipped: importResult.skipped,
        errors: importResult.errors,
        conflicts: importResult.conflicts,
        timestamp: Date.now()
      };

    } catch (error) {
      this._log('error', `Import failed: ${error.message}`);

      return {
        success: false,
        error: error.message,
        importId,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Import from Maltego
   * @param {Object} maltegoData - Maltego export data
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async importFromMaltego(maltegoData, options = {}) {
    return this.importEvidence(maltegoData, {
      ...options,
      format: ImportConfig.FORMATS.MALTEGO
    });
  }

  /**
   * Import from Spiderfoot
   * @param {Object} spiderfootData - Spiderfoot export data
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async importFromSpiderfoot(spiderfootData, options = {}) {
    return this.importEvidence(spiderfootData, {
      ...options,
      format: ImportConfig.FORMATS.SPIDERFOOT
    });
  }

  /**
   * Import from Recon-ng
   * @param {Object} reconData - Recon-ng export data
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async importFromReconNG(reconData, options = {}) {
    return this.importEvidence(reconData, {
      ...options,
      format: ImportConfig.FORMATS.RECON_NG
    });
  }

  /**
   * Import from STIX
   * @param {Object} stixData - STIX bundle
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async importFromSTIX(stixData, options = {}) {
    return this.importEvidence(stixData, {
      ...options,
      format: ImportConfig.FORMATS.STIX
    });
  }

  // ===========================================================================
  // Parsing Methods
  // ===========================================================================

  /**
   * Parse data based on format
   * @private
   * @param {string} data - Raw data string
   * @param {string} format - Data format
   * @returns {Promise<Object|Array>} Parsed data
   */
  async _parseData(data, format) {
    switch (format) {
      case ImportConfig.FORMATS.JSON:
      case ImportConfig.FORMATS.STIX:
      case ImportConfig.FORMATS.MALTEGO:
      case ImportConfig.FORMATS.SPIDERFOOT:
      case ImportConfig.FORMATS.RECON_NG:
        return JSON.parse(data);

      case ImportConfig.FORMATS.CSV:
        return this._parseCSV(data);

      case ImportConfig.FORMATS.XML:
        return this._parseXML(data);

      default:
        // Try JSON first
        try {
          return JSON.parse(data);
        } catch {
          throw new Error(`Unsupported format: ${format}`);
        }
    }
  }

  /**
   * Parse CSV data
   * @private
   */
  _parseCSV(csvData) {
    const lines = csvData.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV must have header and at least one data row');
    }

    const headers = this._parseCSVLine(lines[0]);
    const records = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this._parseCSVLine(lines[i]);
      const record = {};

      for (let j = 0; j < headers.length; j++) {
        record[headers[j]] = values[j] || null;
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

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
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
   * Parse XML data
   * @private
   */
  _parseXML(xmlData) {
    // Simple XML parser (in production, use DOMParser)
    try {
      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlData, 'text/xml');
        return this._xmlToJson(doc.documentElement);
      } else {
        throw new Error('XML parsing not available');
      }
    } catch (error) {
      throw new Error(`XML parsing failed: ${error.message}`);
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
  // Detection Methods
  // ===========================================================================

  /**
   * Detect data format
   * @private
   */
  _detectFormat(data) {
    // Check for STIX
    if (data.type === 'bundle' && data.spec_version) {
      return ImportConfig.FORMATS.STIX;
    }

    // Check for Maltego
    if (data.MaltegoMessage || data.entities) {
      return ImportConfig.FORMATS.MALTEGO;
    }

    // Check for Spiderfoot
    if (Array.isArray(data) && data[0]?.module && data[0]?.type) {
      return ImportConfig.FORMATS.SPIDERFOOT;
    }

    // Check for Recon-ng
    if (data.module || (Array.isArray(data) && data[0]?.host)) {
      return ImportConfig.FORMATS.RECON_NG;
    }

    // Default to JSON
    return ImportConfig.FORMATS.JSON;
  }

  // ===========================================================================
  // Validation Methods
  // ===========================================================================

  /**
   * Validate import data
   * @private
   */
  async _validateImport(data, format) {
    const errors = [];
    const warnings = [];

    // Check if data is array or object
    if (!data || (typeof data !== 'object')) {
      errors.push({ field: 'root', error: 'Data must be an object or array' });
    }

    // Check record count
    const recordCount = Array.isArray(data) ? data.length : 1;
    if (recordCount > ImportConfig.MAX_RECORDS_PER_IMPORT) {
      errors.push({
        field: 'recordCount',
        error: `Too many records: ${recordCount} (max: ${ImportConfig.MAX_RECORDS_PER_IMPORT})`
      });
    }

    // Format-specific validation
    switch (format) {
      case ImportConfig.FORMATS.STIX:
        this._validateSTIX(data, errors, warnings);
        break;

      case ImportConfig.FORMATS.MALTEGO:
        this._validateMaltego(data, errors, warnings);
        break;

      case ImportConfig.FORMATS.SPIDERFOOT:
        this._validateSpiderfoot(data, errors, warnings);
        break;

      case ImportConfig.FORMATS.RECON_NG:
        this._validateReconNG(data, errors, warnings);
        break;
    }

    // Try to fix errors if possible
    let fixed = null;
    if (errors.length > 0 && ImportConfig.AUTO_FIX_ERRORS) {
      fixed = this._tryFixErrors(data, errors);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fixable: fixed !== null,
      fixed
    };
  }

  /**
   * Validate STIX data
   * @private
   */
  _validateSTIX(data, errors, warnings) {
    if (data.type !== 'bundle') {
      errors.push({ field: 'type', error: 'STIX data must be a bundle' });
    }

    if (!data.objects || !Array.isArray(data.objects)) {
      errors.push({ field: 'objects', error: 'STIX bundle must have objects array' });
    }
  }

  /**
   * Validate Maltego data
   * @private
   */
  _validateMaltego(data, errors, warnings) {
    if (!data.entities && !data.MaltegoMessage) {
      warnings.push({ field: 'format', warning: 'Maltego format not clearly identified' });
    }
  }

  /**
   * Validate Spiderfoot data
   * @private
   */
  _validateSpiderfoot(data, errors, warnings) {
    if (!Array.isArray(data)) {
      errors.push({ field: 'root', error: 'Spiderfoot data must be an array' });
      return;
    }

    // Check first record has expected fields
    if (data.length > 0 && !data[0].module && !data[0].type) {
      warnings.push({ field: 'format', warning: 'Spiderfoot format not clearly identified' });
    }
  }

  /**
   * Validate Recon-ng data
   * @private
   */
  _validateReconNG(data, errors, warnings) {
    if (!Array.isArray(data)) {
      errors.push({ field: 'root', error: 'Recon-ng data must be an array' });
      return;
    }
  }

  /**
   * Try to fix validation errors
   * @private
   */
  _tryFixErrors(data, errors) {
    // Make a copy
    let fixed = JSON.parse(JSON.stringify(data));

    for (const error of errors) {
      // Fix missing required fields
      if (error.field && error.error.includes('required')) {
        // Add default value
        this._setNestedValue(fixed, error.field, null);
      }
    }

    return fixed;
  }

  // ===========================================================================
  // Mapping Methods
  // ===========================================================================

  /**
   * Map external data to our schema
   * @private
   */
  async _mapData(data, format, customMapping = null) {
    const mapping = customMapping || this._getMapping(format);

    if (!mapping) {
      // No mapping needed, return as-is
      return data;
    }

    // Map based on format
    switch (format) {
      case ImportConfig.FORMATS.MALTEGO:
        return this._mapMaltego(data, mapping);

      case ImportConfig.FORMATS.SPIDERFOOT:
        return this._mapSpiderfoot(data, mapping);

      case ImportConfig.FORMATS.RECON_NG:
        return this._mapReconNG(data, mapping);

      case ImportConfig.FORMATS.STIX:
        return this._mapSTIX(data, mapping);

      default:
        return this._mapGeneric(data, mapping);
    }
  }

  /**
   * Get mapping for format
   * @private
   */
  _getMapping(format, customMapping = null) {
    if (customMapping) {
      return customMapping;
    }

    return SchemaMappings[format] || null;
  }

  /**
   * Map Maltego data
   * @private
   */
  _mapMaltego(data, mapping) {
    const entities = data.entities || data.MaltegoMessage?.MaltegoTransformResponseMessage?.Entities?.Entity || [];

    return entities.map(entity => ({
      id: this._generateId(),
      type: this._mapField(entity, mapping.entity || 'Type', 'unknown'),
      value: this._mapField(entity, mapping.value || 'Value', ''),
      metadata: this._mapField(entity, mapping.properties || 'Properties', {}),
      label: this._mapField(entity, mapping.label || 'Label', ''),
      confidence: this._mapField(entity, mapping.weight || 'Weight', 0),
      source: 'maltego',
      importedAt: Date.now()
    }));
  }

  /**
   * Map Spiderfoot data
   * @private
   */
  _mapSpiderfoot(data, mapping) {
    return data.map(record => ({
      id: this._generateId(),
      source: this._mapField(record, mapping.module || 'module', 'unknown'),
      type: this._mapField(record, mapping.type || 'type', 'unknown'),
      value: this._mapField(record, mapping.data || 'data', ''),
      sourceUrl: this._mapField(record, mapping.source || 'source', ''),
      confidence: this._mapField(record, mapping.confidence || 'confidence', 0),
      metadata: record,
      importedAt: Date.now()
    }));
  }

  /**
   * Map Recon-ng data
   * @private
   */
  _mapReconNG(data, mapping) {
    return data.map(record => ({
      id: this._generateId(),
      source: this._mapField(record, mapping.module || 'module', 'recon-ng'),
      type: 'host',
      host: this._mapField(record, mapping.host || 'host', ''),
      ip: this._mapField(record, mapping.ip_address || 'ip_address', ''),
      geo: {
        lat: this._mapField(record, mapping.latitude || 'latitude', null),
        lng: this._mapField(record, mapping.longitude || 'longitude', null),
        country: this._mapField(record, mapping.country || 'country', '')
      },
      metadata: record,
      importedAt: Date.now()
    }));
  }

  /**
   * Map STIX data
   * @private
   */
  _mapSTIX(data, mapping) {
    const objects = data.objects || [];

    return objects.map(obj => ({
      id: obj.id || this._generateId(),
      type: obj.type || 'unknown',
      name: obj.name || '',
      description: obj.description || '',
      created: obj.created,
      modified: obj.modified,
      metadata: obj,
      source: 'stix',
      importedAt: Date.now()
    }));
  }

  /**
   * Map generic data
   * @private
   */
  _mapGeneric(data, mapping) {
    const records = Array.isArray(data) ? data : [data];

    return records.map(record => {
      const mapped = { id: this._generateId(), importedAt: Date.now() };

      for (const [target, source] of Object.entries(mapping)) {
        mapped[target] = this._mapField(record, source, null);
      }

      return mapped;
    });
  }

  /**
   * Map a field from source to target
   * @private
   */
  _mapField(record, field, defaultValue = null) {
    // Support nested fields with dot notation
    if (field.includes('.')) {
      return this._getNestedValue(record, field) || defaultValue;
    }

    return record[field] !== undefined ? record[field] : defaultValue;
  }

  /**
   * Get nested value
   * @private
   */
  _getNestedValue(obj, path) {
    const keys = path.split('.');
    let value = obj;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return null;
      }
    }

    return value;
  }

  /**
   * Set nested value
   * @private
   */
  _setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  // ===========================================================================
  // Import Data Methods
  // ===========================================================================

  /**
   * Import mapped data to case/session
   * @private
   */
  async _importMappedData(data, caseId, sessionId, strategy) {
    const records = Array.isArray(data) ? data : [data];

    const result = {
      total: records.length,
      imported: 0,
      skipped: 0,
      errors: [],
      conflicts: []
    };

    for (const record of records) {
      try {
        const importResult = await this._importRecord(record, caseId, sessionId, strategy);

        if (importResult.imported) {
          result.imported++;
        } else if (importResult.skipped) {
          result.skipped++;
        }

        if (importResult.conflict) {
          result.conflicts.push(importResult.conflict);
        }

      } catch (error) {
        result.errors.push({
          record: record.id,
          error: error.message
        });
      }
    }

    return result;
  }

  /**
   * Import single record
   * @private
   */
  async _importRecord(record, caseId, sessionId, strategy) {
    const storage = this._getStorage();

    // Check if record exists
    const existingKey = `imported_record_${record.id}`;
    const existingResult = await storage.get(existingKey);
    const existing = existingResult[existingKey];

    if (existing) {
      // Handle based on strategy
      switch (strategy) {
        case ImportConfig.STRATEGIES.SKIP_EXISTING:
          return { imported: false, skipped: true };

        case ImportConfig.STRATEGIES.REPLACE:
          // Delete existing and import new
          await storage.remove(existingKey);
          break;

        case ImportConfig.STRATEGIES.MERGE:
          // Merge with existing
          record = { ...existing, ...record, updatedAt: Date.now() };
          break;

        case ImportConfig.STRATEGIES.CREATE_NEW:
          // Create new with different ID
          record.id = this._generateId();
          break;
      }
    }

    // Save record
    await storage.set({ [existingKey]: record });

    // Add to case if specified
    if (caseId) {
      await this._addRecordToCase(record, caseId);
    }

    // Add to session if specified
    if (sessionId) {
      await this._addRecordToSession(record, sessionId);
    }

    return { imported: true, skipped: false };
  }

  /**
   * Add record to case
   * @private
   */
  async _addRecordToCase(record, caseId) {
    const storage = this._getStorage();
    const key = `case_imported_${caseId}`;

    const result = await storage.get(key);
    const imported = result[key] || [];

    imported.push({
      id: record.id,
      type: record.type,
      value: record.value,
      importedAt: record.importedAt
    });

    await storage.set({ [key]: imported });
  }

  /**
   * Add record to session
   * @private
   */
  async _addRecordToSession(record, sessionId) {
    // If session manager available, add to session
    const sessionManager = this.config.sessionManager || globalThis.getSessionManager?.();

    if (sessionManager) {
      await sessionManager.addEvidence(sessionId, {
        id: record.id,
        type: 'imported_evidence',
        data: record,
        captureTimestamp: Date.now(),
        capturedBy: 'importer',
        sizeBytes: JSON.stringify(record).length
      });
    }
  }

  // ===========================================================================
  // History Methods
  // ===========================================================================

  /**
   * Add to import history
   * @private
   */
  async _addToImportHistory(importJob) {
    this.importHistory.push(importJob);

    const storage = this._getStorage();
    await storage.set({
      [ImportConfig.STORAGE_KEY_IMPORT_HISTORY]: this.importHistory.slice(-100) // Keep last 100
    });
  }

  /**
   * Get import history
   * @returns {Promise<Array>} Import history
   */
  async getImportHistory() {
    const storage = this._getStorage();
    const result = await storage.get(ImportConfig.STORAGE_KEY_IMPORT_HISTORY);
    this.importHistory = result[ImportConfig.STORAGE_KEY_IMPORT_HISTORY] || [];
    return this.importHistory;
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Generate import ID
   * @private
   */
  _generateImportId() {
    return `import_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  /**
   * Generate record ID
   * @private
   */
  _generateId() {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  /**
   * Format bytes
   * @private
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
  }

  /**
   * Get storage API
   * @private
   */
  _getStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
    return this._getMockStorage();
  }

  /**
   * Get mock storage
   * @private
   */
  _getMockStorage() {
    if (!this._mockStore) {
      this._mockStore = {};
    }
    return {
      get: (keys) => {
        return new Promise((resolve) => {
          if (Array.isArray(keys)) {
            const result = {};
            keys.forEach(k => {
              if (this._mockStore[k] !== undefined) result[k] = this._mockStore[k];
            });
            resolve(result);
          } else if (typeof keys === 'string') {
            resolve({ [keys]: this._mockStore[keys] });
          } else {
            resolve({ ...this._mockStore });
          }
        });
      },
      set: (items) => {
        return new Promise((resolve) => {
          Object.assign(this._mockStore, items);
          resolve();
        });
      },
      remove: (keys) => {
        return new Promise((resolve) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          keyList.forEach(k => delete this._mockStore[k]);
          resolve();
        });
      }
    };
  }

  /**
   * Log message
   * @private
   */
  _log(level, message) {
    if (this.config.logger && this.config.logger[level]) {
      this.config.logger[level](message);
    } else if (typeof console !== 'undefined' && console[level]) {
      console[level]('[EvidenceImporter] ' + message);
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

if (typeof globalThis !== 'undefined') {
  globalThis.ImportConfig = ImportConfig;
  globalThis.SchemaMappings = SchemaMappings;
  globalThis.EvidenceImporter = EvidenceImporter;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ImportConfig,
    SchemaMappings,
    EvidenceImporter
  };
}
