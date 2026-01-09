/**
 * Basset Hound Browser Automation - Enhanced Backend Sync
 * Phase 9: Enhanced basset-hound Sync
 *
 * Extends the base BassetHoundSync with:
 * - Provenance tracking on sync operations
 * - Client-side verification before sync
 * - Confidence scoring for synced data
 * - Entity creation with source URL tracking
 * - Server-side verification requests
 * - Investigation context integration (Phase 10)
 */

// =============================================================================
// Enhanced Sync Options
// =============================================================================

/**
 * Enhanced sync configuration options
 */
const EnhancedSyncOptions = {
  // Provenance settings
  includeProvenance: true,
  provenanceSource: 'autofill-extension',

  // Verification settings
  verifyBeforeSync: true,
  requireVerification: false,
  requestServerVerification: false,
  serverVerifyTimeout: 10000,

  // Confidence settings
  minConfidenceThreshold: 0.0,
  prioritizeByConfidence: true,

  // Investigation context settings (Phase 10)
  investigationContextEnabled: true,
  autoLinkToInvestigation: true,
  includeInvestigationProvenance: true
};

/**
 * Verification status values
 */
const VerificationStatus = {
  NOT_VERIFIED: 'not_verified',
  CLIENT_VERIFIED: 'client_verified',
  SERVER_VERIFIED: 'server_verified',
  VERIFICATION_PENDING: 'verification_pending',
  VERIFICATION_FAILED: 'verification_failed'
};

// =============================================================================
// EnhancedBassetHoundSync Class
// =============================================================================

/**
 * Enhanced Basset Hound Sync Manager
 * Wraps BassetHoundSync with additional provenance, verification, and confidence features
 */
class EnhancedBassetHoundSync {
  /**
   * Create enhanced sync manager
   * @param {Object} options - Configuration options
   * @param {BassetHoundSync} options.baseSync - Base sync instance
   * @param {Object} options.enhancedConfig - Enhanced sync configuration
   * @param {Object} options.logger - Logger instance
   */
  constructor(options = {}) {
    // Get or create base sync instance
    this._baseSync = options.baseSync || this._createBaseSync(options);

    // Enhanced configuration
    this.enhancedConfig = {
      ...EnhancedSyncOptions,
      ...options.enhancedConfig
    };

    // Logger
    this.logger = options.logger || null;

    // Enhanced statistics
    this.enhancedStats = {
      totalWithProvenance: 0,
      totalVerified: 0,
      totalVerificationFailed: 0,
      totalServerVerifications: 0,
      averageConfidence: 0,
      confidenceScoresSum: 0,
      byVerificationStatus: {}
    };

    // Pending server verifications
    this.pendingServerVerifications = new Map();

    // Investigation context reference (Phase 10)
    this._investigationContext = null;
  }

  // ===========================================================================
  // Investigation Context Integration (Phase 10)
  // ===========================================================================

  /**
   * Get investigation context manager
   * @returns {Object|null} Investigation context manager
   * @private
   */
  _getInvestigationContext() {
    if (this._investigationContext) {
      return this._investigationContext;
    }

    // Check for global InvestigationContext
    if (typeof InvestigationContext !== 'undefined') {
      this._investigationContext = InvestigationContext;
      return this._investigationContext;
    }

    // Check for globalThis
    if (typeof globalThis !== 'undefined' && globalThis.InvestigationContext) {
      this._investigationContext = globalThis.InvestigationContext;
      return this._investigationContext;
    }

    return null;
  }

  /**
   * Get current investigation context data
   * @returns {Promise<Object|null>} Current investigation context or null
   * @private
   */
  async _getCurrentInvestigationData() {
    const investigationCtx = this._getInvestigationContext();
    if (!investigationCtx || !this.enhancedConfig.investigationContextEnabled) {
      return null;
    }

    try {
      const context = await investigationCtx.getCurrentInvestigation();
      return context;
    } catch (error) {
      this._log('warn', 'Failed to get investigation context', error);
      return null;
    }
  }

  /**
   * Link entity to current investigation
   * @param {string} entityId - Entity ID to link
   * @param {string} relationType - Relationship type
   * @param {Object} metadata - Link metadata
   * @returns {Promise<Object>} Link result
   * @private
   */
  async _linkEntityToInvestigation(entityId, relationType = 'discovered', metadata = {}) {
    const investigationCtx = this._getInvestigationContext();
    if (!investigationCtx || !this.enhancedConfig.autoLinkToInvestigation) {
      return { success: false, reason: 'Investigation context not available or disabled' };
    }

    try {
      const context = await investigationCtx.getCurrentInvestigation();
      if (!context) {
        return { success: false, reason: 'No active investigation' };
      }

      const result = await investigationCtx.linkEntityToInvestigation(
        context.id,
        entityId,
        relationType,
        {
          ...metadata,
          linkedBy: 'enhanced-basset-hound-sync',
          linkedAt: Date.now()
        }
      );

      return result;
    } catch (error) {
      this._log('warn', 'Failed to link entity to investigation', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enrich provenance data with investigation context
   * @param {Object} provenance - Existing provenance data
   * @returns {Promise<Object>} Enriched provenance data
   * @private
   */
  async _enrichProvenanceWithInvestigation(provenance) {
    if (!this.enhancedConfig.includeInvestigationProvenance) {
      return provenance;
    }

    const context = await this._getCurrentInvestigationData();
    if (!context) {
      return provenance;
    }

    return {
      ...provenance,
      investigation_id: context.id,
      investigation_name: context.metadata?.name,
      investigation_case_number: context.metadata?.caseNumber,
      investigation_classification: context.metadata?.classification,
      investigation_tags: context.metadata?.tags || []
    };
  }

  /**
   * Create base sync instance if not provided
   * @private
   */
  _createBaseSync(options) {
    // Check if BassetHoundSync is available globally
    if (typeof BassetHoundSync !== 'undefined') {
      return new BassetHoundSync({
        url: options.url,
        reconnectAttempts: options.reconnectAttempts,
        reconnectDelay: options.reconnectDelay,
        batchSize: options.batchSize,
        syncInterval: options.syncInterval,
        autoSyncEnabled: options.autoSyncEnabled,
        conflictStrategy: options.conflictStrategy,
        onStatusChange: options.onStatusChange,
        onSyncComplete: options.onSyncComplete,
        onConflict: options.onConflict,
        onError: options.onError
      });
    }

    // Return mock if not available
    this._log('warn', 'BassetHoundSync not available, using mock');
    return this._createMockBaseSync();
  }

  /**
   * Create mock base sync for testing
   * @private
   */
  _createMockBaseSync() {
    return {
      connect: async () => ({ success: true }),
      disconnect: () => {},
      isConnected: () => false,
      syncEntity: async (entity) => ({ success: true, entity }),
      syncEntities: async (entities) => ({ success: true, entities, synced: entities.length }),
      pullEntities: async () => ({ success: true, entities: [] }),
      subscribeToUpdates: async () => ({ success: true }),
      enableAutoSync: () => ({ success: true }),
      getSyncStatus: () => ({ status: 'disconnected' }),
      stats: { totalSynced: 0 }
    };
  }

  // ===========================================================================
  // Connection Methods (Delegated)
  // ===========================================================================

  /**
   * Connect to backend
   * @param {string} url - WebSocket URL
   * @returns {Promise<Object>} Connection result
   */
  async connect(url) {
    return this._baseSync.connect(url);
  }

  /**
   * Disconnect from backend
   */
  disconnect() {
    this._baseSync.disconnect();
  }

  /**
   * Check if connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this._baseSync.isConnected?.() || false;
  }

  // ===========================================================================
  // Enhanced Sync Methods
  // ===========================================================================

  /**
   * Get provenance capture instance
   * @private
   */
  _getProvenanceCapture() {
    if (typeof ProvenanceCapture !== 'undefined') {
      return new ProvenanceCapture();
    }
    return null;
  }

  /**
   * Get verifier instance
   * @private
   */
  _getVerifier() {
    if (typeof DataVerifier !== 'undefined') {
      return new DataVerifier();
    }
    return null;
  }

  /**
   * Sync entity with provenance tracking
   * @param {Object} entity - Entity to sync
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} Sync result
   */
  async syncEntityWithProvenance(entity, options = {}) {
    const {
      captureProvenance = true,
      provenance = null,
      identifierType = null,
      identifierValue = null,
      confidence = null,
      sourceUrl = null,
      ...baseOptions
    } = options;

    // Prepare enhanced entity
    const enhancedEntity = await this._prepareEnhancedEntity(entity, {
      provenance,
      captureProvenance,
      identifierType,
      identifierValue,
      confidence,
      sourceUrl
    });

    // Verify if configured
    if (this.enhancedConfig.verifyBeforeSync) {
      const verificationResult = await this._verifyEntityData(enhancedEntity, {
        identifierType,
        identifierValue
      });

      enhancedEntity.metadata = enhancedEntity.metadata || {};
      enhancedEntity.metadata.verificationStatus = verificationResult.status;
      enhancedEntity.metadata.clientVerified = verificationResult.passed;

      if (!verificationResult.passed) {
        this.enhancedStats.totalVerificationFailed++;

        if (this.enhancedConfig.requireVerification) {
          return {
            success: false,
            error: 'Verification failed',
            verification: verificationResult
          };
        }
      } else {
        this.enhancedStats.totalVerified++;
      }
    }

    // Sync with base
    const syncResult = await this._baseSync.syncEntity(enhancedEntity, baseOptions);

    // Update stats
    if (syncResult.success && enhancedEntity.provenance) {
      this.enhancedStats.totalWithProvenance++;
    }

    if (confidence !== null && confidence !== undefined) {
      this.enhancedStats.confidenceScoresSum += confidence;
      const totalWithConfidence = this.enhancedStats.totalWithProvenance || 1;
      this.enhancedStats.averageConfidence = this.enhancedStats.confidenceScoresSum / totalWithConfidence;
    }

    // Auto-link entity to investigation (Phase 10)
    let investigationLinkResult = null;
    if (syncResult.success && enhancedEntity.id && this.enhancedConfig.autoLinkToInvestigation) {
      investigationLinkResult = await this._linkEntityToInvestigation(
        enhancedEntity.id,
        'discovered',
        {
          entityType: enhancedEntity.type,
          confidence,
          syncedAt: Date.now()
        }
      );
    }

    return {
      ...syncResult,
      provenance: enhancedEntity.provenance,
      verificationStatus: enhancedEntity.metadata?.verificationStatus,
      investigationLinked: investigationLinkResult?.success || false,
      investigationId: enhancedEntity.metadata?.investigation?.id || null
    };
  }

  /**
   * Sync multiple entities with shared provenance
   * @param {Array<Object>} entities - Entities to sync
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} Batch sync result
   */
  async syncEntitiesWithProvenance(entities, options = {}) {
    const {
      captureProvenance = true,
      sharedProvenance = null,
      verifyAll = this.enhancedConfig.verifyBeforeSync,
      prioritizeByConfidence = this.enhancedConfig.prioritizeByConfidence,
      ...baseOptions
    } = options;

    if (!Array.isArray(entities) || entities.length === 0) {
      return {
        success: false,
        error: 'Entities array is required'
      };
    }

    // Capture shared provenance if requested
    let provenance = sharedProvenance;
    if (!provenance && captureProvenance && this.enhancedConfig.includeProvenance) {
      const capture = this._getProvenanceCapture();
      if (capture) {
        provenance = capture.capture();
      }
    }

    // Prepare all entities
    const preparedEntities = await Promise.all(
      entities.map(entity => this._prepareEnhancedEntity(entity, {
        provenance,
        captureProvenance: false,
        confidence: entity.confidence,
        identifierType: entity.identifierType,
        identifierValue: entity.identifierValue,
        sourceUrl: entity.sourceUrl
      }))
    );

    // Verify all if configured
    if (verifyAll) {
      const verificationResults = await Promise.all(
        preparedEntities.map(async (entity, index) => {
          const originalEntity = entities[index];
          return this._verifyEntityData(entity, {
            identifierType: originalEntity.identifierType,
            identifierValue: originalEntity.identifierValue
          });
        })
      );

      // Apply verification results
      preparedEntities.forEach((entity, index) => {
        const verification = verificationResults[index];
        entity.metadata = entity.metadata || {};
        entity.metadata.verificationStatus = verification.status;
        entity.metadata.clientVerified = verification.passed;

        if (verification.passed) {
          this.enhancedStats.totalVerified++;
        } else {
          this.enhancedStats.totalVerificationFailed++;
        }
      });

      // Filter out failed verifications if required
      if (this.enhancedConfig.requireVerification) {
        const filteredEntities = preparedEntities.filter(
          (_, index) => verificationResults[index].passed
        );

        if (filteredEntities.length === 0) {
          return {
            success: false,
            error: 'All entities failed verification',
            verificationResults
          };
        }
      }
    }

    // Sort by confidence if configured
    let sortedEntities = preparedEntities;
    if (prioritizeByConfidence) {
      sortedEntities = [...preparedEntities].sort((a, b) => {
        const confA = a.metadata?.confidence ?? 0;
        const confB = b.metadata?.confidence ?? 0;
        return confB - confA;
      });
    }

    // Sync with base
    const syncResult = await this._baseSync.syncEntities(sortedEntities, baseOptions);

    // Update stats
    if (syncResult.success) {
      this.enhancedStats.totalWithProvenance += sortedEntities.filter(e => e.provenance).length;
    }

    return {
      ...syncResult,
      entitiesWithProvenance: sortedEntities.filter(e => e.provenance).length,
      sharedProvenance: provenance
    };
  }

  // ===========================================================================
  // Verification Methods
  // ===========================================================================

  /**
   * Verify entity data before sync
   * @param {Object} entity - Entity to verify
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Verification result
   */
  async _verifyEntityData(entity, options = {}) {
    const { identifierType, identifierValue } = options;

    const result = {
      passed: true,
      status: VerificationStatus.NOT_VERIFIED,
      checks: [],
      errors: [],
      warnings: []
    };

    const verifier = this._getVerifier();
    if (!verifier) {
      result.warnings.push({ code: 'NO_VERIFIER', message: 'DataVerifier not available' });
      return result;
    }

    // Verify based on identifier type
    if (identifierType && identifierValue) {
      try {
        const verification = await verifier.verify(identifierType, identifierValue);

        result.checks.push({
          type: identifierType,
          value: identifierValue,
          result: verification
        });

        if (!verification.plausible) {
          result.passed = false;
          result.errors.push(...(verification.errors || []));
        }

        if (verification.warnings) {
          result.warnings.push(...verification.warnings);
        }
      } catch (error) {
        result.warnings.push({
          code: 'VERIFICATION_ERROR',
          message: error.message
        });
      }
    }

    // Verify entity data fields
    const entityData = entity.data || {};

    // Check email if present
    if (entityData.email && verifier.verifyEmail) {
      try {
        const emailVerification = await verifier.verifyEmail(entityData.email);
        result.checks.push({
          type: 'email',
          value: entityData.email,
          result: emailVerification
        });

        if (!emailVerification.plausible) {
          result.passed = false;
          result.errors.push(...(emailVerification.errors || []));
        }
      } catch (error) {
        result.warnings.push({
          code: 'EMAIL_VERIFICATION_ERROR',
          message: error.message
        });
      }
    }

    // Check phone if present
    if (entityData.phone && verifier.verifyPhone) {
      try {
        const phoneVerification = await verifier.verifyPhone(entityData.phone);
        result.checks.push({
          type: 'phone',
          value: entityData.phone,
          result: phoneVerification
        });

        if (!phoneVerification.plausible) {
          result.passed = false;
          result.errors.push(...(phoneVerification.errors || []));
        }
      } catch (error) {
        result.warnings.push({
          code: 'PHONE_VERIFICATION_ERROR',
          message: error.message
        });
      }
    }

    result.status = result.passed
      ? VerificationStatus.CLIENT_VERIFIED
      : VerificationStatus.VERIFICATION_FAILED;

    return result;
  }

  /**
   * Verify entity and sync if passed
   * @param {Object} entity - Entity to verify and sync
   * @param {Object} options - Options
   * @returns {Promise<Object>} Result
   */
  async verifyAndSync(entity, options = {}) {
    const { identifierType, identifierValue, ...syncOptions } = options;

    // Verify first
    const verificationResult = await this._verifyEntityData(entity, {
      identifierType,
      identifierValue
    });

    if (!verificationResult.passed) {
      return {
        success: false,
        synced: false,
        verification: verificationResult,
        error: 'Verification failed'
      };
    }

    // Add verification metadata
    entity.metadata = entity.metadata || {};
    entity.metadata.verificationStatus = verificationResult.status;
    entity.metadata.verifiedAt = new Date().toISOString();
    entity.metadata.verificationChecks = verificationResult.checks.length;

    // Sync
    const syncResult = await this.syncEntityWithProvenance(entity, {
      ...syncOptions,
      identifierType,
      identifierValue
    });

    return {
      ...syncResult,
      verification: verificationResult,
      synced: syncResult.success
    };
  }

  // ===========================================================================
  // Entity Creation with Source Tracking
  // ===========================================================================

  /**
   * Create and sync entity with full source tracking
   * @param {string} type - Entity type
   * @param {Object} data - Entity data
   * @param {Object} options - Creation options
   * @returns {Promise<Object>} Created entity result
   */
  async createEntityWithSource(type, data, options = {}) {
    const {
      sourceUrl = null,
      sourceTitle = null,
      sourceDate = null,
      captureProvenance = true,
      autoSync = true,
      identifierType = null,
      identifierValue = null,
      confidence = null,
      ...entityOptions
    } = options;

    // Capture provenance
    let provenance = null;
    if (captureProvenance && this.enhancedConfig.includeProvenance) {
      const capture = this._getProvenanceCapture();
      if (capture) {
        provenance = capture.getForIngestion?.({
          identifierType,
          identifierValue,
          confidence
        }) || capture.capture();
      }
    }

    // Build source tracking metadata
    const sourceTracking = {
      sourceUrl: sourceUrl || provenance?.source_url || null,
      sourceTitle: sourceTitle || provenance?.source_title || null,
      sourceDate: sourceDate || provenance?.source_date || new Date().toISOString(),
      sourceType: provenance?.source_type || 'unknown',
      capturedBy: provenance?.captured_by || 'autofill-extension',
      captureMethod: provenance?.capture_method || 'manual'
    };

    // Create entity object
    const entity = {
      id: this._generateEntityId(),
      type,
      data,
      metadata: {
        ...entityOptions.metadata,
        source: sourceTracking,
        identifierType,
        identifierValue,
        confidence,
        createdAt: new Date().toISOString()
      },
      provenance
    };

    // Auto-sync if configured
    if (autoSync && this.isConnected()) {
      const syncResult = await this.syncEntityWithProvenance(entity, {
        provenance,
        captureProvenance: false,
        identifierType,
        identifierValue,
        confidence,
        sourceUrl: sourceTracking.sourceUrl
      });

      return {
        success: true,
        entity,
        synced: syncResult.success,
        syncResult
      };
    }

    return {
      success: true,
      entity,
      synced: false
    };
  }

  // ===========================================================================
  // Confidence Scoring Methods
  // ===========================================================================

  /**
   * Sync entity with confidence score
   * @param {Object} entity - Entity to sync
   * @param {number} confidence - Confidence score (0-1)
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} Sync result
   */
  async syncWithConfidence(entity, confidence, options = {}) {
    // Validate confidence score
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      return {
        success: false,
        error: 'Confidence must be a number between 0 and 1'
      };
    }

    // Check against threshold
    if (confidence < this.enhancedConfig.minConfidenceThreshold) {
      return {
        success: false,
        error: `Confidence ${confidence} below threshold ${this.enhancedConfig.minConfidenceThreshold}`,
        skipped: true
      };
    }

    // Add confidence to entity metadata
    entity.metadata = entity.metadata || {};
    entity.metadata.confidence = confidence;
    entity.metadata.confidenceLevel = this._getConfidenceLevel(confidence);

    return this.syncEntityWithProvenance(entity, {
      ...options,
      confidence
    });
  }

  /**
   * Get confidence level label
   * @private
   */
  _getConfidenceLevel(confidence) {
    if (confidence >= 0.9) return 'high';
    if (confidence >= 0.7) return 'medium';
    if (confidence >= 0.5) return 'low';
    return 'very_low';
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Prepare enhanced entity with provenance and metadata
   * @private
   */
  async _prepareEnhancedEntity(entity, options) {
    const {
      provenance,
      captureProvenance,
      identifierType,
      identifierValue,
      confidence,
      sourceUrl
    } = options;

    // Clone entity
    const enhanced = JSON.parse(JSON.stringify(entity));

    // Ensure metadata exists
    enhanced.metadata = enhanced.metadata || {};

    // Add provenance
    if (provenance) {
      enhanced.provenance = provenance;
    } else if (captureProvenance && this.enhancedConfig.includeProvenance) {
      const capture = this._getProvenanceCapture();
      if (capture) {
        enhanced.provenance = capture.getForIngestion?.({
          identifierType,
          identifierValue,
          confidence
        }) || capture.capture();
      }
    }

    // Enrich provenance with investigation context (Phase 10)
    if (enhanced.provenance) {
      enhanced.provenance = await this._enrichProvenanceWithInvestigation(enhanced.provenance);
    }

    // Add investigation context to metadata (Phase 10)
    const investigationData = await this._getCurrentInvestigationData();
    if (investigationData) {
      enhanced.metadata.investigation = {
        id: investigationData.id,
        name: investigationData.metadata?.name,
        caseNumber: investigationData.metadata?.caseNumber,
        linkedAt: Date.now()
      };
    }

    // Add source tracking
    if (sourceUrl) {
      enhanced.metadata.source = enhanced.metadata.source || {};
      enhanced.metadata.source.url = sourceUrl;
    }

    // Add confidence
    if (confidence !== null && confidence !== undefined) {
      enhanced.metadata.confidence = confidence;
      enhanced.metadata.confidenceLevel = this._getConfidenceLevel(confidence);
    }

    // Add identifier info
    if (identifierType) {
      enhanced.metadata.identifierType = identifierType;
    }
    if (identifierValue) {
      enhanced.metadata.identifierValue = identifierValue;
    }

    // Add sync timestamp
    enhanced.metadata.enhancedSyncTimestamp = Date.now();

    return enhanced;
  }

  /**
   * Generate unique entity ID
   * @private
   */
  _generateEntityId() {
    return `ent_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Log message
   * @private
   */
  _log(level, message, data) {
    if (this.logger && this.logger[level]) {
      this.logger[level](message, data);
    } else if (console[level]) {
      console[level]('[EnhancedBassetHoundSync]', message, data);
    }
  }

  // ===========================================================================
  // Status and Configuration
  // ===========================================================================

  /**
   * Get enhanced sync status
   * @returns {Promise<Object>} Enhanced status information
   */
  async getEnhancedStatus() {
    const baseStatus = this._baseSync.getSyncStatus?.() || {};

    // Get investigation context status (Phase 10)
    const investigationData = await this._getCurrentInvestigationData();

    return {
      ...baseStatus,
      enhanced: {
        config: { ...this.enhancedConfig },
        stats: { ...this.enhancedStats },
        pendingServerVerifications: this.pendingServerVerifications.size
      },
      investigation: investigationData ? {
        active: true,
        id: investigationData.id,
        name: investigationData.metadata?.name,
        caseNumber: investigationData.metadata?.caseNumber,
        linkedEntityCount: investigationData.linkedEntityCount || 0
      } : {
        active: false
      }
    };
  }

  /**
   * Update enhanced configuration
   * @param {Object} config - Configuration updates
   * @returns {Object} Updated configuration
   */
  updateEnhancedConfig(config) {
    Object.assign(this.enhancedConfig, config);
    return { ...this.enhancedConfig };
  }

  /**
   * Get enhanced statistics
   * @returns {Object} Enhanced statistics
   */
  getEnhancedStats() {
    return {
      base: this._baseSync.stats || {},
      enhanced: { ...this.enhancedStats }
    };
  }

  /**
   * Reset enhanced statistics
   */
  resetEnhancedStats() {
    this.enhancedStats = {
      totalWithProvenance: 0,
      totalVerified: 0,
      totalVerificationFailed: 0,
      totalServerVerifications: 0,
      averageConfidence: 0,
      confidenceScoresSum: 0,
      byVerificationStatus: {}
    };
  }

  // ===========================================================================
  // Delegate Base Methods
  // ===========================================================================

  /**
   * Pull entities from backend
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Pull result
   */
  async pullEntities(query = {}) {
    return this._baseSync.pullEntities?.(query) || { success: false, error: 'Not available' };
  }

  /**
   * Subscribe to entity updates
   * @param {Array<string>} entityTypes - Entity types to subscribe to
   * @returns {Promise<Object>} Subscription result
   */
  async subscribeToUpdates(entityTypes) {
    return this._baseSync.subscribeToUpdates?.(entityTypes) || { success: false, error: 'Not available' };
  }

  /**
   * Enable or disable auto-sync
   * @param {boolean} enabled - Whether to enable
   * @returns {Object} Configuration result
   */
  enableAutoSync(enabled) {
    return this._baseSync.enableAutoSync?.(enabled) || { success: false, error: 'Not available' };
  }

  /**
   * Get base sync status
   * @returns {Object} Base sync status
   */
  getSyncStatus() {
    return this._baseSync.getSyncStatus?.() || { status: 'unknown' };
  }

  // ===========================================================================
  // Investigation-Aware Sync Methods (Phase 10)
  // ===========================================================================

  /**
   * Sync entity with explicit investigation context
   * @param {Object} entity - Entity to sync
   * @param {string} investigationId - Investigation ID to link to
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} Sync result
   */
  async syncEntityToInvestigation(entity, investigationId, options = {}) {
    const investigationCtx = this._getInvestigationContext();

    if (!investigationCtx) {
      // Fall back to regular sync if no investigation context
      return this.syncEntityWithProvenance(entity, options);
    }

    // Get investigation context
    const context = await investigationCtx.loadInvestigationContext(investigationId);
    if (!context) {
      return {
        success: false,
        error: 'Investigation not found',
        investigationId
      };
    }

    // Add investigation to options provenance
    const enrichedOptions = {
      ...options,
      provenance: {
        ...options.provenance,
        investigation_id: investigationId,
        investigation_name: context.metadata?.name,
        investigation_case_number: context.metadata?.caseNumber
      }
    };

    // Sync with provenance
    const syncResult = await this.syncEntityWithProvenance(entity, enrichedOptions);

    // Explicitly link to investigation
    if (syncResult.success && entity.id) {
      const linkResult = await investigationCtx.linkEntityToInvestigation(
        investigationId,
        entity.id,
        options.relationType || 'discovered',
        {
          entityType: entity.type,
          syncedAt: Date.now(),
          ...options.linkMetadata
        }
      );

      syncResult.investigationLinked = linkResult.success;
      syncResult.investigationId = investigationId;
    }

    return syncResult;
  }

  /**
   * Create investigation-aware sync wrapper
   * Returns a sync function that automatically includes investigation context
   * @returns {Function} Investigation-aware sync function
   */
  createInvestigationAwareSyncFunction() {
    const self = this;

    return async function investigationAwareSync(entity, options = {}) {
      const investigationCtx = self._getInvestigationContext();

      if (investigationCtx && self.enhancedConfig.investigationContextEnabled) {
        // Use withInvestigationContext wrapper
        const wrapped = await investigationCtx.withInvestigationContext(
          'sync_entity',
          { entity, options }
        );

        if (wrapped.context.has_context) {
          // Merge investigation context into options
          options = {
            ...options,
            provenance: {
              ...options.provenance,
              investigation_id: wrapped.context.investigation_id
            }
          };
        }
      }

      return self.syncEntityWithProvenance(entity, options);
    };
  }

  /**
   * Set investigation context manager reference
   * @param {Object} investigationContext - Investigation context manager instance
   */
  setInvestigationContext(investigationContext) {
    this._investigationContext = investigationContext;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Global enhanced sync instance
 */
let enhancedBassetHoundSync = null;

/**
 * Get or create enhanced sync instance
 * @param {Object} options - Configuration options
 * @returns {EnhancedBassetHoundSync} Enhanced sync instance
 */
function getEnhancedBassetHoundSync(options = {}) {
  if (!enhancedBassetHoundSync) {
    enhancedBassetHoundSync = new EnhancedBassetHoundSync(options);
  }
  return enhancedBassetHoundSync;
}

/**
 * Reset the enhanced sync instance
 * @returns {Object} Reset result
 */
function resetEnhancedBassetHoundSync() {
  if (enhancedBassetHoundSync) {
    enhancedBassetHoundSync.disconnect();
    enhancedBassetHoundSync = null;
  }
  return { success: true, message: 'Enhanced sync instance reset' };
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.EnhancedSyncOptions = EnhancedSyncOptions;
  globalThis.VerificationStatus = VerificationStatus;
  globalThis.EnhancedBassetHoundSync = EnhancedBassetHoundSync;
  globalThis.getEnhancedBassetHoundSync = getEnhancedBassetHoundSync;
  globalThis.resetEnhancedBassetHoundSync = resetEnhancedBassetHoundSync;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EnhancedSyncOptions,
    VerificationStatus,
    EnhancedBassetHoundSync,
    getEnhancedBassetHoundSync,
    resetEnhancedBassetHoundSync
  };
}
