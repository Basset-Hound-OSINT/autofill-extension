/**
 * Basset Hound Browser Automation - Investigation Context Manager
 *
 * Provides investigation context management for AI agent commands:
 * - Investigation context storage with Chrome storage API
 * - Context-aware command wrappers
 * - Auto-entity linking for OSINT data
 * - Investigation lifecycle management
 * - Integration with basset-hound sync
 *
 * @module investigation-context
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * Investigation context configuration options
 * @constant {Object}
 */
const InvestigationConfig = {
  // Storage keys
  STORAGE_KEY_ACTIVE: 'investigation_active',
  STORAGE_KEY_CONTEXTS: 'investigation_contexts',
  STORAGE_KEY_ENTITY_LINKS: 'investigation_entity_links',
  STORAGE_KEY_HISTORY: 'investigation_history',

  // Limits
  MAX_CONCURRENT_INVESTIGATIONS: 10,
  MAX_ENTITY_LINKS_PER_INVESTIGATION: 10000,
  MAX_HISTORY_ENTRIES: 100,
  CONTEXT_EXPIRY_DAYS: 90,

  // Auto-linking settings
  AUTO_LINK_ENABLED: true,
  AUTO_TAG_FINDINGS: true
};

/**
 * Investigation status values
 * @enum {string}
 */
const InvestigationStatus = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ARCHIVED: 'archived'
};

/**
 * Entity relationship types for investigations
 * @enum {string}
 */
const EntityRelationType = {
  TARGET: 'target',           // Primary investigation target
  RELATED: 'related',         // Related entity discovered during investigation
  DISCOVERED: 'discovered',   // Entity discovered from OSINT data
  LINKED: 'linked',           // Manually linked entity
  ALIAS: 'alias',             // Alternative identity/alias
  ASSOCIATED: 'associated',   // Associated person/organization
  COMMUNICATION: 'communication', // Communication partner
  FINANCIAL: 'financial',     // Financial relationship
  LOCATION: 'location'        // Location-based relationship
};

// =============================================================================
// Investigation Context Storage
// =============================================================================

/**
 * In-memory cache for investigation contexts
 * @type {Map<string, Object>}
 */
const contextCache = new Map();

/**
 * Current active investigation ID
 * @type {string|null}
 */
let activeInvestigationId = null;

/**
 * Entity link index for quick lookups
 * @type {Map<string, Set<string>>}
 */
const entityToInvestigations = new Map();

/**
 * Get Chrome storage API (falls back to mock for testing)
 * @returns {Object} Storage API
 * @private
 */
function _getStorage() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return chrome.storage.local;
  }
  // Mock storage for testing environments
  return _getMockStorage();
}

/**
 * Create mock storage for testing
 * @returns {Object} Mock storage API
 * @private
 */
function _getMockStorage() {
  const store = {};
  return {
    get: (keys) => {
      return new Promise((resolve) => {
        if (Array.isArray(keys)) {
          const result = {};
          keys.forEach(k => {
            if (store[k] !== undefined) result[k] = store[k];
          });
          resolve(result);
        } else if (typeof keys === 'string') {
          resolve({ [keys]: store[keys] });
        } else {
          resolve({ ...store });
        }
      });
    },
    set: (items) => {
      return new Promise((resolve) => {
        Object.assign(store, items);
        resolve();
      });
    },
    remove: (keys) => {
      return new Promise((resolve) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        keyList.forEach(k => delete store[k]);
        resolve();
      });
    }
  };
}

/**
 * Load investigation context from storage
 * @param {string} investigationId - Investigation ID
 * @returns {Promise<Object|null>} Investigation context or null
 */
async function loadInvestigationContext(investigationId) {
  // Check cache first
  if (contextCache.has(investigationId)) {
    return contextCache.get(investigationId);
  }

  const storage = _getStorage();
  const key = `${InvestigationConfig.STORAGE_KEY_CONTEXTS}_${investigationId}`;

  try {
    const result = await storage.get(key);
    const context = result[key] || null;

    if (context) {
      contextCache.set(investigationId, context);
    }

    return context;
  } catch (error) {
    console.error('[InvestigationContext] Load error:', error);
    return null;
  }
}

/**
 * Save investigation context to storage
 * @param {string} investigationId - Investigation ID
 * @param {Object} context - Investigation context
 * @returns {Promise<boolean>} Success status
 */
async function saveInvestigationContext(investigationId, context) {
  const storage = _getStorage();
  const key = `${InvestigationConfig.STORAGE_KEY_CONTEXTS}_${investigationId}`;

  try {
    // Update timestamp
    context.updatedAt = Date.now();

    await storage.set({ [key]: context });
    contextCache.set(investigationId, context);

    return true;
  } catch (error) {
    console.error('[InvestigationContext] Save error:', error);
    return false;
  }
}

/**
 * Load all investigation IDs from storage
 * @returns {Promise<Array<string>>} Array of investigation IDs
 */
async function loadInvestigationIds() {
  const storage = _getStorage();

  try {
    const result = await storage.get(InvestigationConfig.STORAGE_KEY_CONTEXTS);
    const ids = result[InvestigationConfig.STORAGE_KEY_CONTEXTS] || [];
    return ids;
  } catch (error) {
    console.error('[InvestigationContext] Load IDs error:', error);
    return [];
  }
}

/**
 * Save investigation IDs list to storage
 * @param {Array<string>} ids - Array of investigation IDs
 * @returns {Promise<boolean>} Success status
 */
async function saveInvestigationIds(ids) {
  const storage = _getStorage();

  try {
    await storage.set({ [InvestigationConfig.STORAGE_KEY_CONTEXTS]: ids });
    return true;
  } catch (error) {
    console.error('[InvestigationContext] Save IDs error:', error);
    return false;
  }
}

// =============================================================================
// Investigation Lifecycle
// =============================================================================

/**
 * Start a new investigation
 * @param {string} investigationId - Unique investigation identifier
 * @param {Object} metadata - Investigation metadata
 * @param {string} metadata.name - Human-readable investigation name
 * @param {string} metadata.description - Investigation description
 * @param {Array<string>} metadata.targetEntityIds - Initial target entity IDs
 * @param {string} metadata.caseNumber - External case number reference
 * @param {string} metadata.classification - Security classification
 * @param {Object} metadata.customFields - Custom metadata fields
 * @returns {Promise<Object>} Investigation start result
 */
async function startInvestigation(investigationId, metadata = {}) {
  if (!investigationId || typeof investigationId !== 'string') {
    return {
      success: false,
      error: 'Investigation ID is required'
    };
  }

  // Check if investigation already exists
  const existing = await loadInvestigationContext(investigationId);
  if (existing) {
    return {
      success: false,
      error: 'Investigation already exists',
      investigationId
    };
  }

  // Check max concurrent investigations
  const existingIds = await loadInvestigationIds();
  if (existingIds.length >= InvestigationConfig.MAX_CONCURRENT_INVESTIGATIONS) {
    return {
      success: false,
      error: `Maximum concurrent investigations (${InvestigationConfig.MAX_CONCURRENT_INVESTIGATIONS}) reached`
    };
  }

  // Create investigation context
  const context = {
    id: investigationId,
    status: InvestigationStatus.ACTIVE,
    metadata: {
      name: metadata.name || `Investigation ${investigationId}`,
      description: metadata.description || '',
      caseNumber: metadata.caseNumber || null,
      classification: metadata.classification || 'unclassified',
      customFields: metadata.customFields || {},
      tags: metadata.tags || []
    },
    targetEntityIds: metadata.targetEntityIds || [],
    linkedEntities: [],
    entityRelationships: {},
    findings: [],
    statistics: {
      entitiesDiscovered: 0,
      entitiesLinked: 0,
      dataPointsCollected: 0,
      syncOperations: 0
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    startedAt: Date.now(),
    endedAt: null
  };

  // Save context
  const saved = await saveInvestigationContext(investigationId, context);
  if (!saved) {
    return {
      success: false,
      error: 'Failed to save investigation context'
    };
  }

  // Update investigation IDs list
  existingIds.push(investigationId);
  await saveInvestigationIds(existingIds);

  // Set as active investigation
  activeInvestigationId = investigationId;
  await _getStorage().set({ [InvestigationConfig.STORAGE_KEY_ACTIVE]: investigationId });

  // Index target entities
  for (const entityId of context.targetEntityIds) {
    _indexEntityToInvestigation(entityId, investigationId);
  }

  // Log to history
  await _logToHistory({
    action: 'start',
    investigationId,
    timestamp: Date.now(),
    metadata: { name: context.metadata.name }
  });

  return {
    success: true,
    investigationId,
    context: _sanitizeContextForResponse(context)
  };
}

/**
 * Switch to a different active investigation
 * @param {string} investigationId - Investigation ID to switch to
 * @returns {Promise<Object>} Switch result
 */
async function switchInvestigation(investigationId) {
  if (!investigationId || typeof investigationId !== 'string') {
    return {
      success: false,
      error: 'Investigation ID is required'
    };
  }

  // Load the investigation context
  const context = await loadInvestigationContext(investigationId);
  if (!context) {
    return {
      success: false,
      error: 'Investigation not found',
      investigationId
    };
  }

  // Check if investigation is active
  if (context.status !== InvestigationStatus.ACTIVE &&
      context.status !== InvestigationStatus.PAUSED) {
    return {
      success: false,
      error: `Cannot switch to investigation with status: ${context.status}`,
      investigationId
    };
  }

  // Store previous active investigation ID
  const previousId = activeInvestigationId;

  // Set new active investigation
  activeInvestigationId = investigationId;
  await _getStorage().set({ [InvestigationConfig.STORAGE_KEY_ACTIVE]: investigationId });

  // Log to history
  await _logToHistory({
    action: 'switch',
    investigationId,
    previousInvestigationId: previousId,
    timestamp: Date.now()
  });

  return {
    success: true,
    investigationId,
    previousInvestigationId: previousId,
    context: _sanitizeContextForResponse(context)
  };
}

/**
 * End an investigation
 * @param {string} investigationId - Investigation ID to end
 * @param {Object} options - End options
 * @param {string} options.status - Final status (completed or archived)
 * @param {string} options.summary - Investigation summary
 * @param {Object} options.conclusions - Investigation conclusions
 * @returns {Promise<Object>} End result with summary
 */
async function endInvestigation(investigationId, options = {}) {
  if (!investigationId || typeof investigationId !== 'string') {
    return {
      success: false,
      error: 'Investigation ID is required'
    };
  }

  // Load the investigation context
  const context = await loadInvestigationContext(investigationId);
  if (!context) {
    return {
      success: false,
      error: 'Investigation not found',
      investigationId
    };
  }

  // Update status
  const finalStatus = options.status === InvestigationStatus.ARCHIVED
    ? InvestigationStatus.ARCHIVED
    : InvestigationStatus.COMPLETED;

  context.status = finalStatus;
  context.endedAt = Date.now();
  context.metadata.summary = options.summary || null;
  context.metadata.conclusions = options.conclusions || null;

  // Calculate final statistics
  const duration = context.endedAt - context.startedAt;
  context.statistics.durationMs = duration;
  context.statistics.durationHuman = _formatDuration(duration);

  // Save updated context
  await saveInvestigationContext(investigationId, context);

  // Clear from active if this was active
  if (activeInvestigationId === investigationId) {
    activeInvestigationId = null;
    await _getStorage().remove(InvestigationConfig.STORAGE_KEY_ACTIVE);
  }

  // Log to history
  await _logToHistory({
    action: 'end',
    investigationId,
    status: finalStatus,
    timestamp: Date.now(),
    statistics: context.statistics
  });

  // Generate summary
  const summary = {
    investigationId,
    name: context.metadata.name,
    status: finalStatus,
    duration: context.statistics.durationHuman,
    startedAt: new Date(context.startedAt).toISOString(),
    endedAt: new Date(context.endedAt).toISOString(),
    statistics: context.statistics,
    targetEntityCount: context.targetEntityIds.length,
    linkedEntityCount: context.linkedEntities.length,
    findingsCount: context.findings.length
  };

  return {
    success: true,
    investigationId,
    summary
  };
}

/**
 * Get current active investigation context
 * @returns {Promise<Object|null>} Current investigation context or null
 */
async function getCurrentInvestigation() {
  // Load active investigation ID from storage if not in memory
  if (!activeInvestigationId) {
    const storage = _getStorage();
    const result = await storage.get(InvestigationConfig.STORAGE_KEY_ACTIVE);
    activeInvestigationId = result[InvestigationConfig.STORAGE_KEY_ACTIVE] || null;
  }

  if (!activeInvestigationId) {
    return null;
  }

  const context = await loadInvestigationContext(activeInvestigationId);
  return context ? _sanitizeContextForResponse(context) : null;
}

/**
 * Get all investigations
 * @param {Object} options - Filter options
 * @param {string} options.status - Filter by status
 * @param {boolean} options.includeArchived - Include archived investigations
 * @returns {Promise<Array<Object>>} Array of investigation summaries
 */
async function getAllInvestigations(options = {}) {
  const { status = null, includeArchived = false } = options;
  const ids = await loadInvestigationIds();
  const investigations = [];

  for (const id of ids) {
    const context = await loadInvestigationContext(id);
    if (!context) continue;

    // Apply filters
    if (status && context.status !== status) continue;
    if (!includeArchived && context.status === InvestigationStatus.ARCHIVED) continue;

    investigations.push({
      id: context.id,
      name: context.metadata.name,
      status: context.status,
      targetEntityCount: context.targetEntityIds.length,
      linkedEntityCount: context.linkedEntities.length,
      createdAt: context.createdAt,
      updatedAt: context.updatedAt,
      isActive: context.id === activeInvestigationId
    });
  }

  return investigations;
}

// =============================================================================
// Context-Aware Command Wrappers
// =============================================================================

/**
 * Wrap a command with investigation context
 * Automatically includes investigation_id and related context in all operations
 * @param {string} command - Command name
 * @param {Object} data - Command data
 * @param {Object} options - Wrapper options
 * @param {string} options.investigationId - Override investigation ID
 * @param {boolean} options.trackEntities - Auto-track entity references
 * @param {boolean} options.addProvenance - Add provenance data
 * @returns {Promise<Object>} Wrapped command data with context
 */
async function withInvestigationContext(command, data = {}, options = {}) {
  const {
    investigationId = null,
    trackEntities = true,
    addProvenance = true
  } = options;

  // Get active investigation if not specified
  const effectiveInvestigationId = investigationId || activeInvestigationId;

  if (!effectiveInvestigationId) {
    // No active investigation - return data with null context marker
    return {
      command,
      data,
      context: {
        investigation_id: null,
        has_context: false
      }
    };
  }

  // Load investigation context
  const context = await loadInvestigationContext(effectiveInvestigationId);
  if (!context) {
    return {
      command,
      data,
      context: {
        investigation_id: effectiveInvestigationId,
        has_context: false,
        error: 'Investigation context not found'
      }
    };
  }

  // Build context-enriched data
  const enrichedData = {
    ...data,
    investigation_id: effectiveInvestigationId,
    investigation_context: {
      id: context.id,
      name: context.metadata.name,
      case_number: context.metadata.caseNumber,
      classification: context.metadata.classification,
      target_entity_ids: context.targetEntityIds,
      tags: context.metadata.tags
    }
  };

  // Add provenance data if requested
  if (addProvenance) {
    enrichedData.provenance = {
      source: 'autofill-extension',
      investigation_id: effectiveInvestigationId,
      command,
      timestamp: Date.now(),
      captured_by: 'investigation-context-wrapper'
    };
  }

  // Track entity references if requested
  if (trackEntities && data) {
    const entityRefs = _extractEntityReferences(data);
    if (entityRefs.length > 0) {
      enrichedData._tracked_entities = entityRefs;

      // Auto-link discovered entities
      if (InvestigationConfig.AUTO_LINK_ENABLED) {
        for (const entityRef of entityRefs) {
          await linkEntityToInvestigation(
            effectiveInvestigationId,
            entityRef.id,
            EntityRelationType.DISCOVERED,
            { source: command, auto_linked: true }
          );
        }
      }
    }
  }

  // Update investigation statistics
  context.statistics.syncOperations++;
  await saveInvestigationContext(effectiveInvestigationId, context);

  return {
    command,
    data: enrichedData,
    context: {
      investigation_id: effectiveInvestigationId,
      has_context: true,
      target_count: context.targetEntityIds.length,
      linked_count: context.linkedEntities.length
    }
  };
}

/**
 * Create a context-aware sync function wrapper
 * @param {Function} syncFunction - Original sync function
 * @returns {Function} Wrapped sync function
 */
function createContextAwareSyncWrapper(syncFunction) {
  return async function contextAwareSync(entity, options = {}) {
    // Get investigation context
    const context = await getCurrentInvestigation();

    if (!context) {
      // No active investigation - call original function
      return syncFunction(entity, options);
    }

    // Enrich entity with investigation context
    const enrichedEntity = {
      ...entity,
      metadata: {
        ...entity.metadata,
        investigation_id: context.id,
        investigation_name: context.metadata?.name,
        linked_at: Date.now()
      }
    };

    // Enrich options with investigation provenance
    const enrichedOptions = {
      ...options,
      provenance: {
        ...options.provenance,
        investigation_id: context.id,
        investigation_name: context.metadata?.name
      }
    };

    // Call original sync function
    const result = await syncFunction(enrichedEntity, enrichedOptions);

    // Auto-link entity to investigation if sync succeeded
    if (result.success && entity.id) {
      await linkEntityToInvestigation(
        context.id,
        entity.id,
        EntityRelationType.DISCOVERED,
        { sync_result: result, auto_linked: true }
      );
    }

    return result;
  };
}

// =============================================================================
// Auto-Entity Linking
// =============================================================================

/**
 * Link an entity to an investigation
 * @param {string} investigationId - Investigation ID
 * @param {string} entityId - Entity ID to link
 * @param {string} relationType - Relationship type (see EntityRelationType)
 * @param {Object} metadata - Link metadata
 * @returns {Promise<Object>} Link result
 */
async function linkEntityToInvestigation(investigationId, entityId, relationType = EntityRelationType.RELATED, metadata = {}) {
  if (!investigationId || !entityId) {
    return {
      success: false,
      error: 'Investigation ID and Entity ID are required'
    };
  }

  // Load investigation context
  const context = await loadInvestigationContext(investigationId);
  if (!context) {
    return {
      success: false,
      error: 'Investigation not found',
      investigationId
    };
  }

  // Check if entity is already linked
  const existingLink = context.linkedEntities.find(e => e.entityId === entityId);
  if (existingLink) {
    // Update existing link metadata
    existingLink.relationType = relationType;
    existingLink.metadata = { ...existingLink.metadata, ...metadata };
    existingLink.updatedAt = Date.now();
  } else {
    // Check max entity links
    if (context.linkedEntities.length >= InvestigationConfig.MAX_ENTITY_LINKS_PER_INVESTIGATION) {
      return {
        success: false,
        error: `Maximum entity links (${InvestigationConfig.MAX_ENTITY_LINKS_PER_INVESTIGATION}) reached`
      };
    }

    // Add new link
    context.linkedEntities.push({
      entityId,
      relationType,
      metadata,
      linkedAt: Date.now(),
      updatedAt: Date.now()
    });

    context.statistics.entitiesLinked++;
  }

  // Update entity relationships map
  if (!context.entityRelationships[entityId]) {
    context.entityRelationships[entityId] = [];
  }
  context.entityRelationships[entityId].push({
    type: relationType,
    linkedAt: Date.now(),
    metadata
  });

  // Save context
  await saveInvestigationContext(investigationId, context);

  // Update entity-to-investigation index
  _indexEntityToInvestigation(entityId, investigationId);

  return {
    success: true,
    investigationId,
    entityId,
    relationType,
    totalLinkedEntities: context.linkedEntities.length
  };
}

/**
 * Unlink an entity from an investigation
 * @param {string} investigationId - Investigation ID
 * @param {string} entityId - Entity ID to unlink
 * @returns {Promise<Object>} Unlink result
 */
async function unlinkEntityFromInvestigation(investigationId, entityId) {
  if (!investigationId || !entityId) {
    return {
      success: false,
      error: 'Investigation ID and Entity ID are required'
    };
  }

  // Load investigation context
  const context = await loadInvestigationContext(investigationId);
  if (!context) {
    return {
      success: false,
      error: 'Investigation not found'
    };
  }

  // Remove from linked entities
  const index = context.linkedEntities.findIndex(e => e.entityId === entityId);
  if (index === -1) {
    return {
      success: false,
      error: 'Entity is not linked to this investigation'
    };
  }

  context.linkedEntities.splice(index, 1);

  // Remove from relationships
  delete context.entityRelationships[entityId];

  // Save context
  await saveInvestigationContext(investigationId, context);

  // Update index
  _removeEntityFromInvestigationIndex(entityId, investigationId);

  return {
    success: true,
    investigationId,
    entityId,
    totalLinkedEntities: context.linkedEntities.length
  };
}

/**
 * Get all entities linked to an investigation
 * @param {string} investigationId - Investigation ID
 * @param {Object} options - Filter options
 * @param {string} options.relationType - Filter by relationship type
 * @returns {Promise<Array<Object>>} Linked entities
 */
async function getLinkedEntities(investigationId, options = {}) {
  const { relationType = null } = options;

  const context = await loadInvestigationContext(investigationId);
  if (!context) {
    return [];
  }

  let entities = context.linkedEntities;

  if (relationType) {
    entities = entities.filter(e => e.relationType === relationType);
  }

  return entities;
}

/**
 * Get all investigations linked to an entity
 * @param {string} entityId - Entity ID
 * @returns {Promise<Array<Object>>} Investigation summaries
 */
async function getInvestigationsForEntity(entityId) {
  const investigationIds = entityToInvestigations.get(entityId);
  if (!investigationIds || investigationIds.size === 0) {
    return [];
  }

  const investigations = [];
  for (const id of investigationIds) {
    const context = await loadInvestigationContext(id);
    if (context) {
      const link = context.linkedEntities.find(e => e.entityId === entityId);
      investigations.push({
        id: context.id,
        name: context.metadata.name,
        status: context.status,
        relationType: link?.relationType,
        linkedAt: link?.linkedAt
      });
    }
  }

  return investigations;
}

/**
 * Auto-link OSINT data to current investigation
 * @param {Object} osintData - OSINT data object
 * @param {Object} options - Linking options
 * @returns {Promise<Object>} Linking result
 */
async function autoLinkOsintData(osintData, options = {}) {
  const currentContext = await getCurrentInvestigation();
  if (!currentContext) {
    return {
      success: false,
      linked: 0,
      error: 'No active investigation'
    };
  }

  const investigationId = currentContext.id;
  const results = {
    success: true,
    linked: 0,
    entities: [],
    findings: []
  };

  // Extract entities from OSINT data
  const extractedEntities = _extractEntitiesFromOsint(osintData);

  for (const entity of extractedEntities) {
    const linkResult = await linkEntityToInvestigation(
      investigationId,
      entity.id,
      entity.relationType || EntityRelationType.DISCOVERED,
      {
        source: osintData.source || 'osint',
        confidence: entity.confidence || 0.5,
        extractedFrom: osintData.type || 'unknown',
        auto_linked: true,
        ...options.metadata
      }
    );

    if (linkResult.success) {
      results.linked++;
      results.entities.push({
        id: entity.id,
        type: entity.type,
        relationType: entity.relationType
      });
    }
  }

  // Record as finding if configured
  if (InvestigationConfig.AUTO_TAG_FINDINGS && extractedEntities.length > 0) {
    const finding = await addFinding(investigationId, {
      type: 'osint_data_linked',
      source: osintData.source,
      entityCount: results.linked,
      timestamp: Date.now()
    });
    results.findings.push(finding);
  }

  return results;
}

/**
 * Add a finding to an investigation
 * @param {string} investigationId - Investigation ID
 * @param {Object} finding - Finding data
 * @returns {Promise<Object>} Finding record
 */
async function addFinding(investigationId, finding) {
  const context = await loadInvestigationContext(investigationId);
  if (!context) {
    return { success: false, error: 'Investigation not found' };
  }

  const findingRecord = {
    id: `finding_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    ...finding,
    createdAt: Date.now(),
    investigationId
  };

  // Tag with investigation context
  if (InvestigationConfig.AUTO_TAG_FINDINGS) {
    findingRecord.tags = [
      ...(finding.tags || []),
      `investigation:${investigationId}`,
      `case:${context.metadata.caseNumber || 'unassigned'}`
    ];
  }

  context.findings.push(findingRecord);
  context.statistics.dataPointsCollected++;

  await saveInvestigationContext(investigationId, context);

  return {
    success: true,
    finding: findingRecord
  };
}

// =============================================================================
// MCP-Style Commands
// =============================================================================

/**
 * MCP-style command: Set investigation context
 * @param {Object} params - Command parameters
 * @param {string} params.investigation_id - Investigation ID to set
 * @param {Object} params.metadata - Optional metadata for new investigation
 * @returns {Promise<Object>} Command result
 */
async function mcpSetInvestigationContext(params) {
  const { investigation_id, metadata = {} } = params;

  if (!investigation_id) {
    return {
      success: false,
      error: 'investigation_id is required',
      command: 'set_investigation_context'
    };
  }

  // Check if investigation exists
  const existing = await loadInvestigationContext(investigation_id);

  if (existing) {
    // Switch to existing investigation
    const result = await switchInvestigation(investigation_id);
    return {
      ...result,
      command: 'set_investigation_context',
      action: 'switched'
    };
  } else {
    // Start new investigation
    const result = await startInvestigation(investigation_id, metadata);
    return {
      ...result,
      command: 'set_investigation_context',
      action: 'created'
    };
  }
}

/**
 * MCP-style command: Get investigation context
 * @param {Object} params - Command parameters
 * @param {string} params.investigation_id - Optional specific investigation ID
 * @returns {Promise<Object>} Command result
 */
async function mcpGetInvestigationContext(params = {}) {
  const { investigation_id = null } = params;

  if (investigation_id) {
    // Get specific investigation
    const context = await loadInvestigationContext(investigation_id);
    return {
      success: !!context,
      command: 'get_investigation_context',
      context: context ? _sanitizeContextForResponse(context) : null,
      is_active: context?.id === activeInvestigationId,
      error: context ? null : 'Investigation not found'
    };
  } else {
    // Get current active investigation
    const context = await getCurrentInvestigation();
    return {
      success: true,
      command: 'get_investigation_context',
      context,
      has_active_investigation: !!context
    };
  }
}

/**
 * MCP-style command: Link entity to investigation
 * @param {Object} params - Command parameters
 * @param {string} params.investigation_id - Investigation ID (optional, uses active)
 * @param {string} params.entity_id - Entity ID to link
 * @param {string} params.relation_type - Relationship type
 * @param {Object} params.metadata - Link metadata
 * @returns {Promise<Object>} Command result
 */
async function mcpLinkEntityToInvestigation(params) {
  const {
    investigation_id = null,
    entity_id,
    relation_type = EntityRelationType.RELATED,
    metadata = {}
  } = params;

  if (!entity_id) {
    return {
      success: false,
      error: 'entity_id is required',
      command: 'link_entity_to_investigation'
    };
  }

  // Use active investigation if not specified
  const effectiveInvestigationId = investigation_id || activeInvestigationId;

  if (!effectiveInvestigationId) {
    return {
      success: false,
      error: 'No investigation specified and no active investigation',
      command: 'link_entity_to_investigation'
    };
  }

  const result = await linkEntityToInvestigation(
    effectiveInvestigationId,
    entity_id,
    relation_type,
    metadata
  );

  return {
    ...result,
    command: 'link_entity_to_investigation'
  };
}

/**
 * MCP command registry for investigation context
 * @type {Object}
 */
const InvestigationCommands = {
  set_investigation_context: mcpSetInvestigationContext,
  get_investigation_context: mcpGetInvestigationContext,
  link_entity_to_investigation: mcpLinkEntityToInvestigation
};

/**
 * Execute an MCP-style investigation command
 * @param {string} command - Command name
 * @param {Object} params - Command parameters
 * @returns {Promise<Object>} Command result
 */
async function executeInvestigationCommand(command, params = {}) {
  const handler = InvestigationCommands[command];

  if (!handler) {
    return {
      success: false,
      error: `Unknown command: ${command}`,
      available_commands: Object.keys(InvestigationCommands)
    };
  }

  try {
    const result = await handler(params);
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
      command
    };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Index an entity to an investigation for quick lookups
 * @param {string} entityId - Entity ID
 * @param {string} investigationId - Investigation ID
 * @private
 */
function _indexEntityToInvestigation(entityId, investigationId) {
  if (!entityToInvestigations.has(entityId)) {
    entityToInvestigations.set(entityId, new Set());
  }
  entityToInvestigations.get(entityId).add(investigationId);
}

/**
 * Remove an entity from the investigation index
 * @param {string} entityId - Entity ID
 * @param {string} investigationId - Investigation ID
 * @private
 */
function _removeEntityFromInvestigationIndex(entityId, investigationId) {
  const investigations = entityToInvestigations.get(entityId);
  if (investigations) {
    investigations.delete(investigationId);
    if (investigations.size === 0) {
      entityToInvestigations.delete(entityId);
    }
  }
}

/**
 * Extract entity references from data object
 * @param {Object} data - Data object to scan
 * @returns {Array<Object>} Array of entity references
 * @private
 */
function _extractEntityReferences(data) {
  const refs = [];

  if (!data || typeof data !== 'object') {
    return refs;
  }

  // Look for common entity ID patterns
  const entityIdPatterns = ['entity_id', 'entityId', 'id', 'target_id', 'subject_id'];

  function scan(obj, path = '') {
    if (!obj || typeof obj !== 'object') return;

    for (const key of Object.keys(obj)) {
      const value = obj[key];
      const currentPath = path ? `${path}.${key}` : key;

      if (entityIdPatterns.includes(key) && typeof value === 'string') {
        refs.push({
          id: value,
          path: currentPath,
          type: key
        });
      } else if (Array.isArray(value)) {
        value.forEach((item, i) => {
          if (typeof item === 'object') {
            scan(item, `${currentPath}[${i}]`);
          }
        });
      } else if (typeof value === 'object') {
        scan(value, currentPath);
      }
    }
  }

  scan(data);
  return refs;
}

/**
 * Extract entities from OSINT data
 * @param {Object} osintData - OSINT data object
 * @returns {Array<Object>} Extracted entities
 * @private
 */
function _extractEntitiesFromOsint(osintData) {
  const entities = [];

  if (!osintData) return entities;

  // Check for explicit entities array
  if (Array.isArray(osintData.entities)) {
    for (const e of osintData.entities) {
      if (e.id) {
        entities.push({
          id: e.id,
          type: e.type || 'unknown',
          relationType: _inferRelationType(e),
          confidence: e.confidence || 0.5
        });
      }
    }
  }

  // Check for person data
  if (osintData.person && osintData.person.id) {
    entities.push({
      id: osintData.person.id,
      type: 'person',
      relationType: EntityRelationType.DISCOVERED,
      confidence: 0.7
    });
  }

  // Check for organization data
  if (osintData.organization && osintData.organization.id) {
    entities.push({
      id: osintData.organization.id,
      type: 'organization',
      relationType: EntityRelationType.ASSOCIATED,
      confidence: 0.6
    });
  }

  // Check for email addresses
  if (osintData.emails && Array.isArray(osintData.emails)) {
    for (const email of osintData.emails) {
      const emailId = typeof email === 'string' ? email : email.address;
      if (emailId) {
        entities.push({
          id: `email:${emailId}`,
          type: 'email',
          relationType: EntityRelationType.COMMUNICATION,
          confidence: 0.8
        });
      }
    }
  }

  // Check for phone numbers
  if (osintData.phones && Array.isArray(osintData.phones)) {
    for (const phone of osintData.phones) {
      const phoneId = typeof phone === 'string' ? phone : phone.number;
      if (phoneId) {
        entities.push({
          id: `phone:${phoneId}`,
          type: 'phone',
          relationType: EntityRelationType.COMMUNICATION,
          confidence: 0.8
        });
      }
    }
  }

  return entities;
}

/**
 * Infer relationship type from entity data
 * @param {Object} entity - Entity data
 * @returns {string} Relationship type
 * @private
 */
function _inferRelationType(entity) {
  if (entity.relationType) return entity.relationType;
  if (entity.isTarget) return EntityRelationType.TARGET;

  switch (entity.type) {
    case 'person':
    case 'individual':
      return EntityRelationType.RELATED;
    case 'organization':
    case 'company':
      return EntityRelationType.ASSOCIATED;
    case 'email':
    case 'phone':
      return EntityRelationType.COMMUNICATION;
    case 'address':
    case 'location':
      return EntityRelationType.LOCATION;
    case 'account':
    case 'alias':
      return EntityRelationType.ALIAS;
    case 'transaction':
    case 'payment':
      return EntityRelationType.FINANCIAL;
    default:
      return EntityRelationType.DISCOVERED;
  }
}

/**
 * Sanitize context for response (remove internal fields)
 * @param {Object} context - Investigation context
 * @returns {Object} Sanitized context
 * @private
 */
function _sanitizeContextForResponse(context) {
  return {
    id: context.id,
    status: context.status,
    metadata: context.metadata,
    targetEntityIds: context.targetEntityIds,
    linkedEntityCount: context.linkedEntities?.length || 0,
    findingsCount: context.findings?.length || 0,
    statistics: context.statistics,
    createdAt: context.createdAt,
    updatedAt: context.updatedAt,
    startedAt: context.startedAt,
    endedAt: context.endedAt
  };
}

/**
 * Format duration in human-readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 * @private
 */
function _formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Log action to investigation history
 * @param {Object} entry - History entry
 * @private
 */
async function _logToHistory(entry) {
  const storage = _getStorage();

  try {
    const result = await storage.get(InvestigationConfig.STORAGE_KEY_HISTORY);
    const history = result[InvestigationConfig.STORAGE_KEY_HISTORY] || [];

    history.unshift(entry);

    // Trim to max entries
    if (history.length > InvestigationConfig.MAX_HISTORY_ENTRIES) {
      history.length = InvestigationConfig.MAX_HISTORY_ENTRIES;
    }

    await storage.set({ [InvestigationConfig.STORAGE_KEY_HISTORY]: history });
  } catch (error) {
    console.error('[InvestigationContext] History log error:', error);
  }
}

/**
 * Initialize investigation context from storage on load
 * @returns {Promise<void>}
 */
async function initializeInvestigationContext() {
  const storage = _getStorage();

  try {
    // Load active investigation ID
    const result = await storage.get(InvestigationConfig.STORAGE_KEY_ACTIVE);
    activeInvestigationId = result[InvestigationConfig.STORAGE_KEY_ACTIVE] || null;

    // Rebuild entity-to-investigation index
    const ids = await loadInvestigationIds();
    for (const id of ids) {
      const context = await loadInvestigationContext(id);
      if (context) {
        // Index target entities
        for (const entityId of context.targetEntityIds || []) {
          _indexEntityToInvestigation(entityId, id);
        }
        // Index linked entities
        for (const link of context.linkedEntities || []) {
          _indexEntityToInvestigation(link.entityId, id);
        }
      }
    }

    console.log('[InvestigationContext] Initialized with', ids.length, 'investigations');
  } catch (error) {
    console.error('[InvestigationContext] Initialization error:', error);
  }
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.InvestigationContext = {
    // Configuration
    InvestigationConfig,
    InvestigationStatus,
    EntityRelationType,

    // Lifecycle
    startInvestigation,
    switchInvestigation,
    endInvestigation,
    getCurrentInvestigation,
    getAllInvestigations,

    // Context wrappers
    withInvestigationContext,
    createContextAwareSyncWrapper,

    // Entity linking
    linkEntityToInvestigation,
    unlinkEntityFromInvestigation,
    getLinkedEntities,
    getInvestigationsForEntity,
    autoLinkOsintData,

    // Findings
    addFinding,

    // MCP commands
    mcpSetInvestigationContext,
    mcpGetInvestigationContext,
    mcpLinkEntityToInvestigation,
    executeInvestigationCommand,
    InvestigationCommands,

    // Storage
    loadInvestigationContext,
    saveInvestigationContext,

    // Initialization
    initializeInvestigationContext
  };
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    InvestigationConfig,
    InvestigationStatus,
    EntityRelationType,
    startInvestigation,
    switchInvestigation,
    endInvestigation,
    getCurrentInvestigation,
    getAllInvestigations,
    withInvestigationContext,
    createContextAwareSyncWrapper,
    linkEntityToInvestigation,
    unlinkEntityFromInvestigation,
    getLinkedEntities,
    getInvestigationsForEntity,
    autoLinkOsintData,
    addFinding,
    mcpSetInvestigationContext,
    mcpGetInvestigationContext,
    mcpLinkEntityToInvestigation,
    executeInvestigationCommand,
    InvestigationCommands,
    loadInvestigationContext,
    saveInvestigationContext,
    initializeInvestigationContext
  };
}
