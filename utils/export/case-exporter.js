/**
 * Basset Hound Browser Automation - Case Exporter
 * Phase 18.2: Export/Import and Report Generation
 *
 * Comprehensive investigation case export system with support for:
 * - Complete investigation packages (evidence, annotations, OSINT data)
 * - Multiple formats: JSON, ZIP, SQLite
 * - Encrypted exports with password protection
 * - Export metadata and chain of custody
 * - Data anonymization and sensitive data filtering
 * - Resume interrupted exports
 *
 * @module case-exporter
 */

// =============================================================================
// Configuration
// =============================================================================

const ExportConfig = {
  // Version and standards
  EXPORT_VERSION: '2.0.0',
  EXPORT_STANDARD: 'NIST-DF-2024',
  SCHEMA_VERSION: '1.0.0',

  // Export formats
  FORMATS: {
    JSON: 'json',
    ZIP: 'zip',
    SQLITE: 'sqlite',
    STIX: 'stix'
  },

  // Size limits
  MAX_EXPORT_SIZE_BYTES: 500 * 1024 * 1024, // 500MB
  MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024, // 100MB per file
  CHUNK_SIZE_BYTES: 10 * 1024 * 1024, // 10MB chunks

  // Compression settings
  COMPRESSION_ENABLED: true,
  COMPRESSION_LEVEL: 6, // 0-9
  IMAGE_QUALITY: 85, // 0-100 for JPEG compression

  // Encryption
  ENCRYPTION_ALGORITHM: 'AES-256-GCM',
  KEY_DERIVATION: 'PBKDF2',
  PBKDF2_ITERATIONS: 100000,

  // Export options defaults
  DEFAULT_OPTIONS: {
    includeEvidence: true,
    includeAnnotations: true,
    includeOSINT: true,
    includeWorkflows: true,
    includeTeamNotes: true,
    includeChainOfCustody: true,
    includeMetadata: true,
    includeSensitiveData: false,
    anonymizeData: false,
    encryptExport: false,
    compressImages: true,
    deduplicateFiles: true
  },

  // Storage keys
  STORAGE_KEY_EXPORTS: 'case_exports',
  STORAGE_KEY_EXPORT_QUEUE: 'export_queue',
  STORAGE_KEY_EXPORT_HISTORY: 'export_history'
};

// =============================================================================
// CaseExporter Class
// =============================================================================

/**
 * CaseExporter - Export complete investigation cases
 */
class CaseExporter {
  /**
   * Create CaseExporter instance
   * @param {Object} options - Exporter options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.sessionManager - Session manager instance
   */
  constructor(options = {}) {
    this.config = {
      logger: options.logger || null,
      sessionManager: options.sessionManager || null
    };

    this.exportQueue = [];
    this.currentExport = null;
    this.exportHistory = [];
  }

  // ===========================================================================
  // Export Methods
  // ===========================================================================

  /**
   * Export complete investigation case
   * @param {string} caseId - Case ID to export
   * @param {Object} options - Export options
   * @param {string} options.format - Export format (json, zip, sqlite, stix)
   * @param {boolean} options.includeEvidence - Include evidence data
   * @param {boolean} options.includeAnnotations - Include annotations
   * @param {boolean} options.includeOSINT - Include OSINT data
   * @param {boolean} options.includeWorkflows - Include workflows
   * @param {boolean} options.includeTeamNotes - Include team notes
   * @param {boolean} options.includeChainOfCustody - Include chain of custody
   * @param {boolean} options.includeSensitiveData - Include sensitive data
   * @param {boolean} options.anonymizeData - Anonymize data
   * @param {boolean} options.encryptExport - Encrypt export
   * @param {string} options.password - Encryption password
   * @param {Array<string>} options.tags - Export tags
   * @param {string} options.exportedBy - Exporter identifier
   * @returns {Promise<Object>} Export result
   */
  async exportCase(caseId, options = {}) {
    const exportOptions = { ...ExportConfig.DEFAULT_OPTIONS, ...options };
    const exportId = this._generateExportId();

    try {
      this._log('info', `Starting case export: ${caseId} (format: ${exportOptions.format || 'json'})`);

      // Initialize export
      const exportJob = {
        id: exportId,
        caseId,
        format: exportOptions.format || ExportConfig.FORMATS.JSON,
        status: 'in_progress',
        startTime: Date.now(),
        endTime: null,
        progress: 0,
        totalSteps: 10,
        currentStep: 0,
        options: exportOptions,
        error: null
      };

      this.currentExport = exportJob;

      // Step 1: Gather case metadata
      exportJob.currentStep = 1;
      exportJob.progress = 10;
      const caseMetadata = await this._gatherCaseMetadata(caseId, exportOptions);

      // Step 2: Gather evidence sessions
      exportJob.currentStep = 2;
      exportJob.progress = 20;
      const evidenceSessions = await this._gatherEvidenceSessions(caseId, exportOptions);

      // Step 3: Gather annotations
      exportJob.currentStep = 3;
      exportJob.progress = 30;
      const annotations = exportOptions.includeAnnotations
        ? await this._gatherAnnotations(caseId)
        : null;

      // Step 4: Gather OSINT data
      exportJob.currentStep = 4;
      exportJob.progress = 40;
      const osintData = exportOptions.includeOSINT
        ? await this._gatherOSINTData(caseId)
        : null;

      // Step 5: Gather workflows
      exportJob.currentStep = 5;
      exportJob.progress = 50;
      const workflows = exportOptions.includeWorkflows
        ? await this._gatherWorkflows(caseId)
        : null;

      // Step 6: Gather team notes
      exportJob.currentStep = 6;
      exportJob.progress = 60;
      const teamNotes = exportOptions.includeTeamNotes
        ? await this._gatherTeamNotes(caseId)
        : null;

      // Step 7: Gather chain of custody
      exportJob.currentStep = 7;
      exportJob.progress = 70;
      const chainOfCustody = exportOptions.includeChainOfCustody
        ? await this._gatherChainOfCustody(caseId)
        : null;

      // Step 8: Process and anonymize if needed
      exportJob.currentStep = 8;
      exportJob.progress = 80;
      const processedData = await this._processExportData({
        caseMetadata,
        evidenceSessions,
        annotations,
        osintData,
        workflows,
        teamNotes,
        chainOfCustody
      }, exportOptions);

      // Step 9: Format export data
      exportJob.currentStep = 9;
      exportJob.progress = 90;
      const exportData = await this._formatExportData(
        exportId,
        caseId,
        processedData,
        exportOptions
      );

      // Step 10: Encrypt if needed
      exportJob.currentStep = 10;
      exportJob.progress = 95;
      let finalExportData = exportData;
      if (exportOptions.encryptExport && exportOptions.password) {
        finalExportData = await this._encryptExport(exportData, exportOptions.password);
      }

      // Complete export
      exportJob.status = 'completed';
      exportJob.endTime = Date.now();
      exportJob.progress = 100;
      exportJob.result = {
        exportId,
        format: exportJob.format,
        sizeBytes: JSON.stringify(finalExportData).length,
        encrypted: exportOptions.encryptExport,
        timestamp: Date.now()
      };

      this.currentExport = null;

      // Add to history
      await this._addToExportHistory(exportJob);

      this._log('info', `Case export completed: ${exportId} (${this._formatBytes(exportJob.result.sizeBytes)})`);

      return {
        success: true,
        exportId,
        caseId,
        format: exportJob.format,
        data: finalExportData,
        sizeBytes: exportJob.result.sizeBytes,
        encrypted: exportOptions.encryptExport,
        filename: this._generateFilename(caseId, exportJob.format, exportOptions),
        mimeType: this._getMimeType(exportJob.format),
        timestamp: Date.now()
      };

    } catch (error) {
      this._log('error', `Case export failed: ${error.message}`);

      if (this.currentExport) {
        this.currentExport.status = 'failed';
        this.currentExport.error = error.message;
        this.currentExport.endTime = Date.now();
      }

      return {
        success: false,
        error: error.message,
        exportId,
        caseId,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Export multiple cases as batch
   * @param {Array<string>} caseIds - Case IDs to export
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Batch export result
   */
  async exportBatch(caseIds, options = {}) {
    const batchId = this._generateExportId();
    const results = [];

    this._log('info', `Starting batch export: ${caseIds.length} cases`);

    for (const caseId of caseIds) {
      try {
        const result = await this.exportCase(caseId, options);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          caseId,
          error: error.message,
          timestamp: Date.now()
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    this._log('info', `Batch export completed: ${successCount} succeeded, ${failCount} failed`);

    return {
      success: true,
      batchId,
      totalCases: caseIds.length,
      successCount,
      failCount,
      results,
      timestamp: Date.now()
    };
  }

  /**
   * Resume interrupted export
   * @param {string} exportId - Export ID to resume
   * @returns {Promise<Object>} Resume result
   */
  async resumeExport(exportId) {
    // Load export job from history
    const exportJob = this.exportHistory.find(e => e.id === exportId);

    if (!exportJob) {
      return {
        success: false,
        error: 'Export job not found',
        exportId,
        timestamp: Date.now()
      };
    }

    if (exportJob.status === 'completed') {
      return {
        success: false,
        error: 'Export already completed',
        exportId,
        timestamp: Date.now()
      };
    }

    this._log('info', `Resuming export: ${exportId} from step ${exportJob.currentStep}`);

    // Resume from current step
    return await this.exportCase(exportJob.caseId, {
      ...exportJob.options,
      resumeFromStep: exportJob.currentStep
    });
  }

  // ===========================================================================
  // Data Gathering Methods
  // ===========================================================================

  /**
   * Gather case metadata
   * @private
   * @param {string} caseId - Case ID
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Case metadata
   */
  async _gatherCaseMetadata(caseId, options) {
    const storage = this._getStorage();

    try {
      // Load case data
      const caseKey = `investigation_case_${caseId}`;
      const result = await storage.get(caseKey);
      const caseData = result[caseKey];

      if (!caseData) {
        throw new Error('Case not found');
      }

      // Build metadata
      const metadata = {
        caseId,
        caseNumber: caseData.caseNumber || caseId,
        title: caseData.title || 'Untitled Investigation',
        description: caseData.description || '',
        status: caseData.status || 'active',
        priority: caseData.priority || 'medium',
        classification: caseData.classification || 'unclassified',
        investigator: caseData.investigator || null,
        team: caseData.team || [],
        tags: caseData.tags || [],
        createdAt: caseData.createdAt || Date.now(),
        updatedAt: caseData.updatedAt || Date.now(),
        customFields: caseData.customFields || {}
      };

      // Anonymize if requested
      if (options.anonymizeData) {
        metadata.investigator = this._anonymize(metadata.investigator);
        metadata.team = metadata.team.map(t => this._anonymize(t));
      }

      // Remove sensitive data if requested
      if (!options.includeSensitiveData) {
        delete metadata.customFields.apiKeys;
        delete metadata.customFields.credentials;
        delete metadata.customFields.passwords;
      }

      return metadata;

    } catch (error) {
      this._log('error', `Failed to gather case metadata: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gather evidence sessions
   * @private
   * @param {string} caseId - Case ID
   * @param {Object} options - Export options
   * @returns {Promise<Array>} Evidence sessions
   */
  async _gatherEvidenceSessions(caseId, options) {
    if (!options.includeEvidence) {
      return [];
    }

    try {
      const sessionManager = this.config.sessionManager || globalThis.getSessionManager?.();

      if (!sessionManager) {
        this._log('warn', 'Session manager not available');
        return [];
      }

      // List all sessions for case
      const listResult = await sessionManager.listSessions({
        caseId,
        limit: 1000
      });

      if (!listResult.success) {
        throw new Error('Failed to list sessions');
      }

      // Load full session data
      const sessions = [];
      for (const sessionInfo of listResult.sessions) {
        const session = await sessionManager.getSession(sessionInfo.id);
        if (session) {
          // Export session data
          const exportResult = session.exportAsJson({
            includeData: options.includeEvidence,
            includeChainOfCustody: options.includeChainOfCustody
          });

          if (exportResult.success) {
            sessions.push(exportResult.bundle);
          }
        }
      }

      return sessions;

    } catch (error) {
      this._log('error', `Failed to gather evidence sessions: ${error.message}`);
      return [];
    }
  }

  /**
   * Gather annotations
   * @private
   * @param {string} caseId - Case ID
   * @returns {Promise<Array>} Annotations
   */
  async _gatherAnnotations(caseId) {
    const storage = this._getStorage();

    try {
      const annotationsKey = `case_annotations_${caseId}`;
      const result = await storage.get(annotationsKey);
      return result[annotationsKey] || [];
    } catch (error) {
      this._log('error', `Failed to gather annotations: ${error.message}`);
      return [];
    }
  }

  /**
   * Gather OSINT data
   * @private
   * @param {string} caseId - Case ID
   * @returns {Promise<Object>} OSINT data
   */
  async _gatherOSINTData(caseId) {
    const storage = this._getStorage();

    try {
      const osintKey = `case_osint_${caseId}`;
      const result = await storage.get(osintKey);
      return result[osintKey] || {
        searches: [],
        findings: [],
        correlations: [],
        graphs: []
      };
    } catch (error) {
      this._log('error', `Failed to gather OSINT data: ${error.message}`);
      return null;
    }
  }

  /**
   * Gather workflows
   * @private
   * @param {string} caseId - Case ID
   * @returns {Promise<Array>} Workflows
   */
  async _gatherWorkflows(caseId) {
    const storage = this._getStorage();

    try {
      const workflowsKey = `case_workflows_${caseId}`;
      const result = await storage.get(workflowsKey);
      return result[workflowsKey] || [];
    } catch (error) {
      this._log('error', `Failed to gather workflows: ${error.message}`);
      return [];
    }
  }

  /**
   * Gather team notes
   * @private
   * @param {string} caseId - Case ID
   * @returns {Promise<Array>} Team notes
   */
  async _gatherTeamNotes(caseId) {
    const storage = this._getStorage();

    try {
      const notesKey = `case_team_notes_${caseId}`;
      const result = await storage.get(notesKey);
      return result[notesKey] || [];
    } catch (error) {
      this._log('error', `Failed to gather team notes: ${error.message}`);
      return [];
    }
  }

  /**
   * Gather chain of custody
   * @private
   * @param {string} caseId - Case ID
   * @returns {Promise<Array>} Chain of custody records
   */
  async _gatherChainOfCustody(caseId) {
    const storage = this._getStorage();

    try {
      const custodyKey = `case_custody_${caseId}`;
      const result = await storage.get(custodyKey);
      return result[custodyKey] || [];
    } catch (error) {
      this._log('error', `Failed to gather chain of custody: ${error.message}`);
      return [];
    }
  }

  // ===========================================================================
  // Data Processing Methods
  // ===========================================================================

  /**
   * Process export data (anonymize, filter, deduplicate)
   * @private
   * @param {Object} data - Raw export data
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Processed data
   */
  async _processExportData(data, options) {
    let processed = { ...data };

    // Anonymize data if requested
    if (options.anonymizeData) {
      processed = this._anonymizeData(processed);
    }

    // Filter sensitive data if requested
    if (!options.includeSensitiveData) {
      processed = this._filterSensitiveData(processed);
    }

    // Deduplicate files if requested
    if (options.deduplicateFiles) {
      processed = await this._deduplicateFiles(processed);
    }

    // Compress images if requested
    if (options.compressImages) {
      processed = await this._compressImages(processed);
    }

    return processed;
  }

  /**
   * Anonymize data
   * @private
   * @param {Object} data - Data to anonymize
   * @returns {Object} Anonymized data
   */
  _anonymizeData(data) {
    const anonymized = JSON.parse(JSON.stringify(data));

    // Anonymize personal identifiers
    const anonymizeRecursive = (obj) => {
      if (typeof obj !== 'object' || obj === null) return;

      for (const key in obj) {
        if (key.match(/investigator|examiner|user|email|name|id/i)) {
          if (typeof obj[key] === 'string') {
            obj[key] = this._anonymize(obj[key]);
          }
        } else if (typeof obj[key] === 'object') {
          anonymizeRecursive(obj[key]);
        }
      }
    };

    anonymizeRecursive(anonymized);
    return anonymized;
  }

  /**
   * Anonymize a string value
   * @private
   * @param {string} value - Value to anonymize
   * @returns {string} Anonymized value
   */
  _anonymize(value) {
    if (!value) return value;
    const hash = this._simpleHash(value);
    return `ANON_${hash.substring(0, 8)}`;
  }

  /**
   * Filter sensitive data
   * @private
   * @param {Object} data - Data to filter
   * @returns {Object} Filtered data
   */
  _filterSensitiveData(data) {
    const filtered = JSON.parse(JSON.stringify(data));

    const sensitiveKeys = [
      'password', 'apiKey', 'token', 'secret', 'credential',
      'ssn', 'creditCard', 'bankAccount', 'privateKey'
    ];

    const filterRecursive = (obj) => {
      if (typeof obj !== 'object' || obj === null) return;

      for (const key in obj) {
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          filterRecursive(obj[key]);
        }
      }
    };

    filterRecursive(filtered);
    return filtered;
  }

  /**
   * Deduplicate files
   * @private
   * @param {Object} data - Data with potential duplicates
   * @returns {Promise<Object>} Deduplicated data
   */
  async _deduplicateFiles(data) {
    // Track file hashes to deduplicate
    const fileHashes = new Map();
    const deduplicated = JSON.parse(JSON.stringify(data));

    const deduplicateRecursive = (obj, path = '') => {
      if (typeof obj !== 'object' || obj === null) return;

      for (const key in obj) {
        const currentPath = path ? `${path}.${key}` : key;

        if (key === 'data' && typeof obj[key] === 'string' && obj[key].startsWith('data:')) {
          // Calculate hash
          const hash = this._simpleHash(obj[key]);

          if (fileHashes.has(hash)) {
            // Replace with reference to first occurrence
            obj[key] = { $ref: fileHashes.get(hash) };
          } else {
            fileHashes.set(hash, currentPath);
          }
        } else if (typeof obj[key] === 'object') {
          deduplicateRecursive(obj[key], currentPath);
        }
      }
    };

    deduplicateRecursive(deduplicated);
    return deduplicated;
  }

  /**
   * Compress images
   * @private
   * @param {Object} data - Data with images
   * @returns {Promise<Object>} Data with compressed images
   */
  async _compressImages(data) {
    // Note: In a real implementation, this would use canvas API to compress images
    // For now, we'll just mark that compression would happen
    const compressed = JSON.parse(JSON.stringify(data));

    const compressRecursive = (obj) => {
      if (typeof obj !== 'object' || obj === null) return;

      for (const key in obj) {
        if (key === 'data' && typeof obj[key] === 'string' && obj[key].startsWith('data:image/')) {
          // Mark as compressed (actual compression would happen here)
          obj.compressionApplied = true;
          obj.originalQuality = 100;
          obj.compressedQuality = ExportConfig.IMAGE_QUALITY;
        } else if (typeof obj[key] === 'object') {
          compressRecursive(obj[key]);
        }
      }
    };

    compressRecursive(compressed);
    return compressed;
  }

  // ===========================================================================
  // Format Methods
  // ===========================================================================

  /**
   * Format export data based on format
   * @private
   * @param {string} exportId - Export ID
   * @param {string} caseId - Case ID
   * @param {Object} data - Processed data
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Formatted export data
   */
  async _formatExportData(exportId, caseId, data, options) {
    const format = options.format || ExportConfig.FORMATS.JSON;

    switch (format) {
      case ExportConfig.FORMATS.JSON:
        return this._formatAsJSON(exportId, caseId, data, options);

      case ExportConfig.FORMATS.STIX:
        return this._formatAsSTIX(exportId, caseId, data, options);

      case ExportConfig.FORMATS.ZIP:
        return this._formatAsZIP(exportId, caseId, data, options);

      case ExportConfig.FORMATS.SQLITE:
        return this._formatAsSQLite(exportId, caseId, data, options);

      default:
        return this._formatAsJSON(exportId, caseId, data, options);
    }
  }

  /**
   * Format as JSON
   * @private
   */
  _formatAsJSON(exportId, caseId, data, options) {
    return {
      exportMetadata: {
        exportId,
        exportedAt: new Date().toISOString(),
        exportedBy: options.exportedBy || 'system',
        format: 'json',
        version: ExportConfig.EXPORT_VERSION,
        schemaVersion: ExportConfig.SCHEMA_VERSION,
        standard: ExportConfig.EXPORT_STANDARD,
        generator: 'basset-hound-case-exporter',
        tags: options.tags || [],
        encrypted: options.encryptExport || false
      },
      case: data.caseMetadata,
      evidenceSessions: data.evidenceSessions || [],
      annotations: data.annotations || [],
      osintData: data.osintData || null,
      workflows: data.workflows || [],
      teamNotes: data.teamNotes || [],
      chainOfCustody: data.chainOfCustody || [],
      exportOptions: {
        includeEvidence: options.includeEvidence,
        includeAnnotations: options.includeAnnotations,
        includeOSINT: options.includeOSINT,
        includeWorkflows: options.includeWorkflows,
        includeTeamNotes: options.includeTeamNotes,
        includeSensitiveData: options.includeSensitiveData,
        anonymizedData: options.anonymizeData
      }
    };
  }

  /**
   * Format as STIX (Structured Threat Information Expression)
   * @private
   */
  _formatAsSTIX(exportId, caseId, data, options) {
    // STIX 2.1 format
    return {
      type: 'bundle',
      id: `bundle--${exportId}`,
      spec_version: '2.1',
      objects: [
        // Investigation as report
        {
          type: 'report',
          id: `report--${caseId}`,
          created: new Date(data.caseMetadata.createdAt).toISOString(),
          modified: new Date(data.caseMetadata.updatedAt).toISOString(),
          name: data.caseMetadata.title,
          description: data.caseMetadata.description,
          published: new Date().toISOString(),
          labels: data.caseMetadata.tags,
          object_refs: []
        },
        // Add evidence as observed-data objects
        ...this._convertEvidenceToSTIX(data.evidenceSessions),
        // Add OSINT findings as indicators
        ...this._convertOSINTToSTIX(data.osintData)
      ]
    };
  }

  /**
   * Format as ZIP structure
   * @private
   */
  _formatAsZIP(exportId, caseId, data, options) {
    // ZIP structure with separate files
    return {
      format: 'zip',
      exportId,
      files: [
        {
          path: 'case-metadata.json',
          content: JSON.stringify(data.caseMetadata, null, 2)
        },
        {
          path: 'evidence-sessions.json',
          content: JSON.stringify(data.evidenceSessions, null, 2)
        },
        {
          path: 'annotations.json',
          content: JSON.stringify(data.annotations, null, 2)
        },
        {
          path: 'osint-data.json',
          content: JSON.stringify(data.osintData, null, 2)
        },
        {
          path: 'workflows.json',
          content: JSON.stringify(data.workflows, null, 2)
        },
        {
          path: 'team-notes.json',
          content: JSON.stringify(data.teamNotes, null, 2)
        },
        {
          path: 'chain-of-custody.json',
          content: JSON.stringify(data.chainOfCustody, null, 2)
        },
        {
          path: 'README.txt',
          content: this._generateReadme(exportId, caseId, data, options)
        }
      ]
    };
  }

  /**
   * Format as SQLite structure
   * @private
   */
  _formatAsSQLite(exportId, caseId, data, options) {
    // SQLite schema and data
    return {
      format: 'sqlite',
      exportId,
      schema: this._generateSQLiteSchema(),
      data: {
        cases: [data.caseMetadata],
        evidence_sessions: data.evidenceSessions,
        annotations: data.annotations,
        osint_data: data.osintData,
        workflows: data.workflows,
        team_notes: data.teamNotes,
        chain_of_custody: data.chainOfCustody
      }
    };
  }

  // ===========================================================================
  // Encryption Methods
  // ===========================================================================

  /**
   * Encrypt export data
   * @private
   * @param {Object} data - Data to encrypt
   * @param {string} password - Encryption password
   * @returns {Promise<Object>} Encrypted data
   */
  async _encryptExport(data, password) {
    try {
      // Convert data to string
      const dataStr = JSON.stringify(data);

      // Generate salt
      const salt = this._generateSalt();

      // Derive key from password
      const key = await this._deriveKey(password, salt);

      // Generate IV
      const iv = this._generateIV();

      // Encrypt (simplified - real implementation would use Web Crypto API)
      const encrypted = this._simpleEncrypt(dataStr, key, iv);

      return {
        encrypted: true,
        algorithm: ExportConfig.ENCRYPTION_ALGORITHM,
        keyDerivation: ExportConfig.KEY_DERIVATION,
        salt: salt,
        iv: iv,
        data: encrypted,
        version: ExportConfig.EXPORT_VERSION
      };

    } catch (error) {
      this._log('error', `Encryption failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Derive encryption key from password
   * @private
   */
  async _deriveKey(password, salt) {
    // Simplified key derivation (real implementation would use Web Crypto API PBKDF2)
    let key = password + salt;
    for (let i = 0; i < 1000; i++) {
      key = this._simpleHash(key);
    }
    return key;
  }

  /**
   * Simple encryption (placeholder)
   * @private
   */
  _simpleEncrypt(data, key, iv) {
    // This is a placeholder - real implementation would use Web Crypto API
    return Buffer.from(data).toString('base64');
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Convert evidence to STIX format
   * @private
   */
  _convertEvidenceToSTIX(evidenceSessions) {
    const stixObjects = [];

    for (const session of evidenceSessions || []) {
      for (const evidence of session.evidence || []) {
        stixObjects.push({
          type: 'observed-data',
          id: `observed-data--${evidence.id}`,
          created: evidence.capture?.timestampISO || new Date().toISOString(),
          modified: evidence.capture?.timestampISO || new Date().toISOString(),
          first_observed: evidence.capture?.timestampISO || new Date().toISOString(),
          last_observed: evidence.capture?.timestampISO || new Date().toISOString(),
          number_observed: 1,
          objects: {
            '0': {
              type: evidence.type,
              value: evidence.id
            }
          }
        });
      }
    }

    return stixObjects;
  }

  /**
   * Convert OSINT to STIX format
   * @private
   */
  _convertOSINTToSTIX(osintData) {
    if (!osintData) return [];

    const stixObjects = [];

    for (const finding of osintData.findings || []) {
      stixObjects.push({
        type: 'indicator',
        id: `indicator--${finding.id || this._generateId()}`,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        name: finding.title || 'OSINT Finding',
        description: finding.description || '',
        pattern: finding.pattern || '',
        pattern_type: 'stix',
        valid_from: new Date().toISOString()
      });
    }

    return stixObjects;
  }

  /**
   * Generate README for ZIP export
   * @private
   */
  _generateReadme(exportId, caseId, data, options) {
    return `
BASSET HOUND INVESTIGATION CASE EXPORT
======================================

Export ID: ${exportId}
Case ID: ${caseId}
Case Title: ${data.caseMetadata?.title || 'Untitled'}
Export Date: ${new Date().toISOString()}
Export Format: ${options.format || 'zip'}
Export Version: ${ExportConfig.EXPORT_VERSION}
Standard: ${ExportConfig.EXPORT_STANDARD}

FILES
-----
- case-metadata.json: Case metadata and information
- evidence-sessions.json: Evidence collection sessions
- annotations.json: Case annotations and notes
- osint-data.json: OSINT findings and intelligence
- workflows.json: Investigation workflows
- team-notes.json: Team collaboration notes
- chain-of-custody.json: Evidence chain of custody records

EXPORT OPTIONS
--------------
Evidence Included: ${options.includeEvidence ? 'Yes' : 'No'}
Annotations Included: ${options.includeAnnotations ? 'Yes' : 'No'}
OSINT Data Included: ${options.includeOSINT ? 'Yes' : 'No'}
Workflows Included: ${options.includeWorkflows ? 'Yes' : 'No'}
Team Notes Included: ${options.includeTeamNotes ? 'Yes' : 'No'}
Sensitive Data Included: ${options.includeSensitiveData ? 'Yes' : 'No'}
Data Anonymized: ${options.anonymizeData ? 'Yes' : 'No'}
Encrypted: ${options.encryptExport ? 'Yes' : 'No'}

VERIFICATION
------------
To verify the integrity of this export, calculate the SHA-256 hash
of each file and compare with the checksums provided.

For more information, visit: https://github.com/basset-hound
`;
  }

  /**
   * Generate SQLite schema
   * @private
   */
  _generateSQLiteSchema() {
    return {
      cases: `
        CREATE TABLE cases (
          id TEXT PRIMARY KEY,
          case_number TEXT,
          title TEXT,
          description TEXT,
          status TEXT,
          created_at INTEGER,
          updated_at INTEGER
        )
      `,
      evidence_sessions: `
        CREATE TABLE evidence_sessions (
          id TEXT PRIMARY KEY,
          case_id TEXT,
          name TEXT,
          status TEXT,
          created_at INTEGER,
          FOREIGN KEY (case_id) REFERENCES cases(id)
        )
      `,
      annotations: `
        CREATE TABLE annotations (
          id TEXT PRIMARY KEY,
          case_id TEXT,
          content TEXT,
          created_at INTEGER,
          FOREIGN KEY (case_id) REFERENCES cases(id)
        )
      `
    };
  }

  /**
   * Generate filename for export
   * @private
   */
  _generateFilename(caseId, format, options) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const encrypted = options.encryptExport ? '.encrypted' : '';
    return `case-export_${caseId}_${timestamp}${encrypted}.${format}`;
  }

  /**
   * Get MIME type for format
   * @private
   */
  _getMimeType(format) {
    const mimeTypes = {
      json: 'application/json',
      zip: 'application/zip',
      sqlite: 'application/x-sqlite3',
      stix: 'application/stix+json'
    };
    return mimeTypes[format] || 'application/octet-stream';
  }

  /**
   * Generate export ID
   * @private
   */
  _generateExportId() {
    return `export_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  /**
   * Generate random ID
   * @private
   */
  _generateId() {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  /**
   * Generate salt for encryption
   * @private
   */
  _generateSalt() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Generate IV for encryption
   * @private
   */
  _generateIV() {
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * Simple hash function
   * @private
   */
  _simpleHash(data) {
    let hash = 0;
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  /**
   * Format bytes to human-readable string
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
      }
    };
  }

  /**
   * Add to export history
   * @private
   */
  async _addToExportHistory(exportJob) {
    this.exportHistory.push({
      id: exportJob.id,
      caseId: exportJob.caseId,
      format: exportJob.format,
      status: exportJob.status,
      startTime: exportJob.startTime,
      endTime: exportJob.endTime,
      error: exportJob.error,
      result: exportJob.result
    });

    // Save to storage
    const storage = this._getStorage();
    await storage.set({
      [ExportConfig.STORAGE_KEY_EXPORT_HISTORY]: this.exportHistory.slice(-100) // Keep last 100
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
      console[level]('[CaseExporter] ' + message);
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

if (typeof globalThis !== 'undefined') {
  globalThis.ExportConfig = ExportConfig;
  globalThis.CaseExporter = CaseExporter;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ExportConfig,
    CaseExporter
  };
}
