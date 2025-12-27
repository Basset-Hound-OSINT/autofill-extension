/**
 * Basset Hound Browser Automation - Entity Manager
 * Phase 5.3: Data Pipeline Implementation
 *
 * Provides entity management capabilities for:
 * - Entity creation with type validation
 * - Entity relationship management (linking)
 * - Related entity retrieval
 * - Export in multiple formats (JSON, CSV)
 * - Entity storage and persistence
 */

// =============================================================================
// Entity Type Definitions
// =============================================================================

/**
 * Supported entity types and their schemas
 */
const EntityTypes = {
  PERSON: 'person',
  ORGANIZATION: 'organization',
  ADDRESS: 'address',
  CONTACT: 'contact',
  ACCOUNT: 'account',
  DOCUMENT: 'document',
  EVENT: 'event',
  CUSTOM: 'custom'
};

/**
 * Relationship types between entities
 */
const RelationshipTypes = {
  // Person relationships
  EMPLOYEE_OF: 'employee_of',
  OWNER_OF: 'owner_of',
  MEMBER_OF: 'member_of',
  CONTACT_FOR: 'contact_for',

  // Address relationships
  LOCATED_AT: 'located_at',
  MAILING_ADDRESS: 'mailing_address',
  BILLING_ADDRESS: 'billing_address',
  SHIPPING_ADDRESS: 'shipping_address',

  // General relationships
  RELATED_TO: 'related_to',
  PARENT_OF: 'parent_of',
  CHILD_OF: 'child_of',
  ASSOCIATED_WITH: 'associated_with',
  DERIVED_FROM: 'derived_from',

  // Document relationships
  CREATED_BY: 'created_by',
  SIGNED_BY: 'signed_by',
  REFERENCES: 'references'
};

/**
 * Entity schema definitions for validation
 */
const EntitySchemas = {
  [EntityTypes.PERSON]: {
    required: [],
    optional: ['firstName', 'lastName', 'middleName', 'fullName', 'email', 'phone', 'dateOfBirth', 'gender', 'title', 'prefix', 'suffix'],
    computed: ['displayName']
  },
  [EntityTypes.ORGANIZATION]: {
    required: [],
    optional: ['name', 'legalName', 'tradeName', 'type', 'industry', 'website', 'email', 'phone', 'taxId', 'registrationNumber'],
    computed: ['displayName']
  },
  [EntityTypes.ADDRESS]: {
    required: [],
    optional: ['line1', 'line2', 'city', 'state', 'postalCode', 'country', 'type', 'latitude', 'longitude'],
    computed: ['formatted']
  },
  [EntityTypes.CONTACT]: {
    required: [],
    optional: ['type', 'value', 'label', 'primary', 'verified'],
    computed: []
  },
  [EntityTypes.ACCOUNT]: {
    required: [],
    optional: ['type', 'provider', 'username', 'email', 'url', 'status', 'createdAt', 'lastLogin'],
    computed: []
  },
  [EntityTypes.DOCUMENT]: {
    required: [],
    optional: ['type', 'title', 'number', 'issuer', 'issuedDate', 'expiryDate', 'status', 'url', 'content'],
    computed: []
  },
  [EntityTypes.EVENT]: {
    required: [],
    optional: ['type', 'title', 'description', 'startDate', 'endDate', 'location', 'status', 'participants'],
    computed: []
  },
  [EntityTypes.CUSTOM]: {
    required: [],
    optional: [],
    computed: []
  }
};

// =============================================================================
// Entity Storage
// =============================================================================

/**
 * In-memory entity storage
 * In production, this would be backed by chrome.storage or IndexedDB
 */
class EntityStore {
  constructor() {
    this.entities = new Map();
    this.relationships = new Map();
    this.indices = {
      byType: new Map(),
      byField: new Map()
    };
    this.idCounter = 0;
  }

  /**
   * Generate a unique entity ID
   * @returns {string} Unique ID
   */
  generateId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const counter = (++this.idCounter).toString(36);
    return `ent_${timestamp}${random}${counter}`;
  }

  /**
   * Store an entity
   * @param {Object} entity - Entity to store
   */
  set(entity) {
    this.entities.set(entity.id, entity);

    // Update type index
    if (!this.indices.byType.has(entity.type)) {
      this.indices.byType.set(entity.type, new Set());
    }
    this.indices.byType.get(entity.type).add(entity.id);
  }

  /**
   * Get an entity by ID
   * @param {string} id - Entity ID
   * @returns {Object|null} Entity or null
   */
  get(id) {
    return this.entities.get(id) || null;
  }

  /**
   * Delete an entity
   * @param {string} id - Entity ID
   * @returns {boolean} True if deleted
   */
  delete(id) {
    const entity = this.entities.get(id);
    if (!entity) return false;

    // Remove from type index
    const typeSet = this.indices.byType.get(entity.type);
    if (typeSet) {
      typeSet.delete(id);
    }

    // Remove relationships
    this.relationships.delete(id);
    for (const [, rels] of this.relationships) {
      for (let i = rels.length - 1; i >= 0; i--) {
        if (rels[i].targetId === id) {
          rels.splice(i, 1);
        }
      }
    }

    return this.entities.delete(id);
  }

  /**
   * Get all entities of a type
   * @param {string} type - Entity type
   * @returns {Array} Entities of that type
   */
  getByType(type) {
    const ids = this.indices.byType.get(type);
    if (!ids) return [];
    return Array.from(ids).map(id => this.entities.get(id)).filter(Boolean);
  }

  /**
   * Get all entities
   * @returns {Array} All entities
   */
  getAll() {
    return Array.from(this.entities.values());
  }

  /**
   * Add a relationship
   * @param {string} sourceId - Source entity ID
   * @param {string} targetId - Target entity ID
   * @param {string} type - Relationship type
   * @param {Object} metadata - Additional metadata
   */
  addRelationship(sourceId, targetId, type, metadata = {}) {
    if (!this.relationships.has(sourceId)) {
      this.relationships.set(sourceId, []);
    }

    // Check for duplicate
    const existing = this.relationships.get(sourceId).find(
      r => r.targetId === targetId && r.type === type
    );
    if (existing) {
      // Update metadata
      Object.assign(existing.metadata, metadata);
      return existing;
    }

    const relationship = {
      id: `rel_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`,
      sourceId,
      targetId,
      type,
      metadata,
      createdAt: new Date().toISOString()
    };

    this.relationships.get(sourceId).push(relationship);
    return relationship;
  }

  /**
   * Get relationships for an entity
   * @param {string} entityId - Entity ID
   * @param {Object} options - Filter options
   * @returns {Array} Relationships
   */
  getRelationships(entityId, options = {}) {
    const { type, direction = 'outgoing' } = options;
    let results = [];

    if (direction === 'outgoing' || direction === 'both') {
      const outgoing = this.relationships.get(entityId) || [];
      results = results.concat(
        type ? outgoing.filter(r => r.type === type) : outgoing
      );
    }

    if (direction === 'incoming' || direction === 'both') {
      for (const [sourceId, rels] of this.relationships) {
        for (const rel of rels) {
          if (rel.targetId === entityId) {
            if (!type || rel.type === type) {
              results.push({ ...rel, direction: 'incoming', sourceId });
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Remove a relationship
   * @param {string} sourceId - Source entity ID
   * @param {string} targetId - Target entity ID
   * @param {string} type - Relationship type (optional)
   * @returns {boolean} True if removed
   */
  removeRelationship(sourceId, targetId, type = null) {
    const rels = this.relationships.get(sourceId);
    if (!rels) return false;

    const initialLength = rels.length;
    const filtered = rels.filter(r => {
      if (r.targetId !== targetId) return true;
      if (type && r.type !== type) return true;
      return false;
    });

    this.relationships.set(sourceId, filtered);
    return filtered.length < initialLength;
  }

  /**
   * Clear all data
   */
  clear() {
    this.entities.clear();
    this.relationships.clear();
    this.indices.byType.clear();
    this.indices.byField.clear();
    this.idCounter = 0;
  }

  /**
   * Get statistics
   * @returns {Object} Store statistics
   */
  getStats() {
    const relationshipCount = Array.from(this.relationships.values())
      .reduce((sum, rels) => sum + rels.length, 0);

    const typeBreakdown = {};
    for (const [type, ids] of this.indices.byType) {
      typeBreakdown[type] = ids.size;
    }

    return {
      entityCount: this.entities.size,
      relationshipCount,
      typeBreakdown
    };
  }
}

// Global entity store instance
const entityStore = new EntityStore();

// =============================================================================
// Entity Manager Functions
// =============================================================================

/**
 * Create a new entity
 *
 * @param {string} type - Entity type (person, organization, address, etc.)
 * @param {Object} data - Entity data
 * @param {Object} options - Creation options
 * @param {boolean} options.validate - Validate against schema (default: true)
 * @param {boolean} options.normalize - Apply normalization (default: true)
 * @param {Object} options.metadata - Additional metadata
 * @returns {Object} Created entity result
 */
function createEntity(type, data, options = {}) {
  const {
    validate = true,
    normalize = true,
    metadata = {}
  } = options;

  const result = {
    success: false,
    entity: null,
    errors: [],
    warnings: []
  };

  // Validate type
  const normalizedType = type?.toLowerCase();
  if (!normalizedType || !Object.values(EntityTypes).includes(normalizedType)) {
    result.errors.push({
      code: 'INVALID_TYPE',
      message: `Invalid entity type: ${type}. Valid types: ${Object.values(EntityTypes).join(', ')}`
    });
    return result;
  }

  // Validate data
  if (!data || typeof data !== 'object') {
    result.errors.push({
      code: 'INVALID_DATA',
      message: 'Entity data must be a non-null object'
    });
    return result;
  }

  // Get schema for type
  const schema = EntitySchemas[normalizedType];

  // Validate required fields
  if (validate && schema.required) {
    for (const field of schema.required) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        result.errors.push({
          code: 'MISSING_REQUIRED',
          field,
          message: `Required field '${field}' is missing`
        });
      }
    }
  }

  if (result.errors.length > 0) {
    return result;
  }

  // Normalize data if requested
  let entityData = { ...data };
  if (normalize) {
    entityData = normalizeEntityData(normalizedType, entityData, result.warnings);
  }

  // Filter to allowed fields
  const allowedFields = [...(schema.required || []), ...(schema.optional || [])];
  if (normalizedType !== EntityTypes.CUSTOM && allowedFields.length > 0) {
    const filteredData = {};
    for (const field of allowedFields) {
      if (entityData[field] !== undefined) {
        filteredData[field] = entityData[field];
      }
    }
    // Also keep any custom fields prefixed with '_'
    for (const [key, value] of Object.entries(entityData)) {
      if (key.startsWith('_')) {
        filteredData[key] = value;
      }
    }
    entityData = filteredData;
  }

  // Compute derived fields
  entityData = computeDerivedFields(normalizedType, entityData);

  // Create entity object
  const entity = {
    id: entityStore.generateId(),
    type: normalizedType,
    data: entityData,
    metadata: {
      ...metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    }
  };

  // Store entity
  entityStore.set(entity);

  result.success = true;
  result.entity = entity;

  return result;
}

/**
 * Normalize entity data based on type
 * @private
 */
function normalizeEntityData(type, data, warnings) {
  const normalized = { ...data };

  // Use data-pipeline normalizers if available
  if (type === EntityTypes.PERSON) {
    // Normalize name if full name provided
    if (data.fullName && typeof globalThis.normalizeName === 'function') {
      const nameResult = globalThis.normalizeName(data.fullName);
      if (nameResult.success) {
        normalized.firstName = normalized.firstName || nameResult.components.firstName;
        normalized.lastName = normalized.lastName || nameResult.components.lastName;
        normalized.middleName = normalized.middleName || nameResult.components.middleName;
        normalized.prefix = normalized.prefix || nameResult.components.prefix;
        normalized.suffix = normalized.suffix || nameResult.components.suffix;
      }
    }

    // Normalize email
    if (data.email && typeof globalThis.normalizeEmail === 'function') {
      const emailResult = globalThis.normalizeEmail(data.email);
      if (emailResult.success) {
        normalized.email = emailResult.normalized;
        if (emailResult.warnings.length > 0) {
          warnings.push(...emailResult.warnings);
        }
      }
    }

    // Normalize phone
    if (data.phone && typeof globalThis.normalizePhone === 'function') {
      const phoneResult = globalThis.normalizePhone(data.phone);
      if (phoneResult.success) {
        normalized.phone = phoneResult.normalized;
      }
    }

    // Normalize date of birth
    if (data.dateOfBirth && typeof globalThis.normalizeDate === 'function') {
      const dateResult = globalThis.normalizeDate(data.dateOfBirth);
      if (dateResult.success) {
        normalized.dateOfBirth = dateResult.normalized;
      }
    }
  }

  if (type === EntityTypes.ORGANIZATION) {
    if (data.email && typeof globalThis.normalizeEmail === 'function') {
      const emailResult = globalThis.normalizeEmail(data.email);
      if (emailResult.success) {
        normalized.email = emailResult.normalized;
      }
    }

    if (data.phone && typeof globalThis.normalizePhone === 'function') {
      const phoneResult = globalThis.normalizePhone(data.phone);
      if (phoneResult.success) {
        normalized.phone = phoneResult.normalized;
      }
    }
  }

  if (type === EntityTypes.ADDRESS) {
    if (typeof globalThis.normalizeAddress === 'function') {
      const addrData = {
        streetNumber: data.streetNumber,
        streetName: data.streetName || data.line1,
        unit: data.unit || data.line2,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country
      };
      const addrResult = globalThis.normalizeAddress(addrData);
      if (addrResult.success) {
        normalized.line1 = addrResult.formatted.line1 || normalized.line1;
        normalized.line2 = addrResult.formatted.line2 || normalized.line2;
        normalized.city = addrResult.components.city || normalized.city;
        normalized.state = addrResult.components.state || normalized.state;
        normalized.postalCode = addrResult.components.postalCode || normalized.postalCode;
        normalized.formatted = addrResult.formatted.full;
      }
    }
  }

  if (type === EntityTypes.CONTACT) {
    if (data.type === 'email' && data.value && typeof globalThis.normalizeEmail === 'function') {
      const emailResult = globalThis.normalizeEmail(data.value);
      if (emailResult.success) {
        normalized.value = emailResult.normalized;
      }
    }
    if (data.type === 'phone' && data.value && typeof globalThis.normalizePhone === 'function') {
      const phoneResult = globalThis.normalizePhone(data.value);
      if (phoneResult.success) {
        normalized.value = phoneResult.normalized;
      }
    }
  }

  return normalized;
}

/**
 * Compute derived fields for an entity
 * @private
 */
function computeDerivedFields(type, data) {
  const computed = { ...data };

  if (type === EntityTypes.PERSON) {
    // Compute display name
    const nameParts = [data.firstName, data.middleName, data.lastName].filter(Boolean);
    computed.displayName = nameParts.length > 0 ? nameParts.join(' ') : data.fullName || 'Unknown';
  }

  if (type === EntityTypes.ORGANIZATION) {
    computed.displayName = data.name || data.legalName || data.tradeName || 'Unknown Organization';
  }

  if (type === EntityTypes.ADDRESS) {
    if (!computed.formatted) {
      const parts = [data.line1, data.line2, data.city, data.state, data.postalCode, data.country].filter(Boolean);
      computed.formatted = parts.join(', ');
    }
  }

  return computed;
}

/**
 * Link two entities with a relationship
 *
 * @param {string|Object} entity1 - First entity or entity ID
 * @param {string|Object} entity2 - Second entity or entity ID
 * @param {string} relationshipType - Type of relationship
 * @param {Object} options - Linking options
 * @param {boolean} options.bidirectional - Create inverse relationship (default: false)
 * @param {Object} options.metadata - Relationship metadata
 * @returns {Object} Link result
 */
function linkEntities(entity1, entity2, relationshipType, options = {}) {
  const {
    bidirectional = false,
    metadata = {}
  } = options;

  const result = {
    success: false,
    relationships: [],
    errors: [],
    warnings: []
  };

  // Resolve entity IDs
  const id1 = typeof entity1 === 'string' ? entity1 : entity1?.id;
  const id2 = typeof entity2 === 'string' ? entity2 : entity2?.id;

  // Validate entities exist
  if (!id1) {
    result.errors.push({ code: 'INVALID_ENTITY1', message: 'First entity is invalid or missing' });
  } else if (!entityStore.get(id1)) {
    result.errors.push({ code: 'NOT_FOUND', message: `Entity with ID '${id1}' not found` });
  }

  if (!id2) {
    result.errors.push({ code: 'INVALID_ENTITY2', message: 'Second entity is invalid or missing' });
  } else if (!entityStore.get(id2)) {
    result.errors.push({ code: 'NOT_FOUND', message: `Entity with ID '${id2}' not found` });
  }

  // Validate relationship type
  const normalizedRelType = relationshipType?.toLowerCase().replace(/-/g, '_');
  if (!normalizedRelType) {
    result.errors.push({ code: 'INVALID_RELATIONSHIP', message: 'Relationship type is required' });
  } else if (!Object.values(RelationshipTypes).includes(normalizedRelType)) {
    result.warnings.push({
      code: 'UNKNOWN_RELATIONSHIP',
      message: `Relationship type '${relationshipType}' is not a standard type. Using as custom.`
    });
  }

  if (result.errors.length > 0) {
    return result;
  }

  // Prevent self-linking
  if (id1 === id2) {
    result.errors.push({ code: 'SELF_LINK', message: 'Cannot link an entity to itself' });
    return result;
  }

  // Create primary relationship
  const relationship = entityStore.addRelationship(id1, id2, normalizedRelType, metadata);
  result.relationships.push(relationship);

  // Create inverse relationship if bidirectional
  if (bidirectional) {
    const inverseType = getInverseRelationType(normalizedRelType);
    const inverseRelationship = entityStore.addRelationship(id2, id1, inverseType, metadata);
    result.relationships.push(inverseRelationship);
  }

  result.success = true;
  return result;
}

/**
 * Get the inverse relationship type
 * @private
 */
function getInverseRelationType(type) {
  const inverses = {
    [RelationshipTypes.EMPLOYEE_OF]: 'employer_of',
    [RelationshipTypes.OWNER_OF]: 'owned_by',
    [RelationshipTypes.MEMBER_OF]: 'has_member',
    [RelationshipTypes.PARENT_OF]: RelationshipTypes.CHILD_OF,
    [RelationshipTypes.CHILD_OF]: RelationshipTypes.PARENT_OF,
    [RelationshipTypes.CREATED_BY]: 'created',
    [RelationshipTypes.SIGNED_BY]: 'signed'
  };

  return inverses[type] || type;
}

/**
 * Get all entities related to a given entity
 *
 * @param {string} entityId - Entity ID to find relations for
 * @param {Object} options - Query options
 * @param {string} options.relationshipType - Filter by relationship type
 * @param {string} options.entityType - Filter related entities by type
 * @param {string} options.direction - 'outgoing', 'incoming', or 'both' (default: 'both')
 * @param {number} options.depth - How many levels of relations to traverse (default: 1)
 * @returns {Object} Related entities result
 */
function getRelatedEntities(entityId, options = {}) {
  const {
    relationshipType = null,
    entityType = null,
    direction = 'both',
    depth = 1
  } = options;

  const result = {
    success: false,
    entity: null,
    related: [],
    relationships: [],
    errors: [],
    warnings: []
  };

  // Validate entity exists
  const entity = entityStore.get(entityId);
  if (!entity) {
    result.errors.push({ code: 'NOT_FOUND', message: `Entity with ID '${entityId}' not found` });
    return result;
  }

  result.entity = entity;

  // Track visited to avoid cycles
  const visited = new Set([entityId]);
  const toVisit = [{ id: entityId, currentDepth: 0 }];

  while (toVisit.length > 0) {
    const { id: currentId, currentDepth } = toVisit.shift();

    if (currentDepth >= depth) continue;

    // Get relationships
    const relationships = entityStore.getRelationships(currentId, {
      type: relationshipType,
      direction
    });

    for (const rel of relationships) {
      const relatedId = rel.direction === 'incoming' ? rel.sourceId : rel.targetId;

      if (visited.has(relatedId)) continue;
      visited.add(relatedId);

      const relatedEntity = entityStore.get(relatedId);
      if (!relatedEntity) continue;

      // Apply entity type filter
      if (entityType && relatedEntity.type !== entityType) continue;

      result.related.push({
        entity: relatedEntity,
        relationship: rel,
        depth: currentDepth + 1
      });

      result.relationships.push(rel);

      // Queue for next depth if needed
      if (currentDepth + 1 < depth) {
        toVisit.push({ id: relatedId, currentDepth: currentDepth + 1 });
      }
    }
  }

  result.success = true;
  return result;
}

/**
 * Export entities in specified format
 *
 * @param {string} format - Export format: 'json' or 'csv'
 * @param {Object} options - Export options
 * @param {Array<string>} options.entityIds - Specific entity IDs to export (default: all)
 * @param {string} options.entityType - Filter by entity type
 * @param {boolean} options.includeRelationships - Include relationships in export (default: true)
 * @param {Array<string>} options.fields - Specific fields to include (for CSV)
 * @param {boolean} options.flatten - Flatten nested data for CSV (default: true)
 * @returns {Object} Export result with data
 */
function exportEntities(format, options = {}) {
  const {
    entityIds = null,
    entityType = null,
    includeRelationships = true,
    fields = null,
    flatten = true
  } = options;

  const result = {
    success: false,
    format,
    data: null,
    metadata: {
      exportedAt: new Date().toISOString(),
      entityCount: 0,
      relationshipCount: 0
    },
    errors: [],
    warnings: []
  };

  const normalizedFormat = format?.toLowerCase();
  if (!['json', 'csv'].includes(normalizedFormat)) {
    result.errors.push({
      code: 'INVALID_FORMAT',
      message: `Invalid export format: ${format}. Valid formats: json, csv`
    });
    return result;
  }

  // Get entities to export
  let entities;
  if (entityIds && Array.isArray(entityIds)) {
    entities = entityIds
      .map(id => entityStore.get(id))
      .filter(Boolean);
  } else if (entityType) {
    entities = entityStore.getByType(entityType);
  } else {
    entities = entityStore.getAll();
  }

  result.metadata.entityCount = entities.length;

  // Get relationships if requested
  let relationships = [];
  if (includeRelationships) {
    const entityIdSet = new Set(entities.map(e => e.id));
    for (const entity of entities) {
      const rels = entityStore.getRelationships(entity.id, { direction: 'outgoing' });
      for (const rel of rels) {
        if (entityIdSet.has(rel.targetId)) {
          relationships.push(rel);
        }
      }
    }
    result.metadata.relationshipCount = relationships.length;
  }

  // Export based on format
  if (normalizedFormat === 'json') {
    result.data = exportToJSON(entities, relationships, includeRelationships);
  } else if (normalizedFormat === 'csv') {
    result.data = exportToCSV(entities, fields, flatten);
    if (includeRelationships && relationships.length > 0) {
      result.relationshipsCSV = exportRelationshipsToCSV(relationships);
    }
  }

  result.success = true;
  return result;
}

/**
 * Export entities to JSON format
 * @private
 */
function exportToJSON(entities, relationships, includeRelationships) {
  const exportData = {
    entities: entities.map(e => ({
      id: e.id,
      type: e.type,
      ...e.data,
      _metadata: e.metadata
    })),
    metadata: {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      entityCount: entities.length
    }
  };

  if (includeRelationships) {
    exportData.relationships = relationships;
    exportData.metadata.relationshipCount = relationships.length;
  }

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export entities to CSV format
 * @private
 */
function exportToCSV(entities, fields, flatten) {
  if (entities.length === 0) {
    return '';
  }

  // Determine columns
  let columns;
  if (fields && Array.isArray(fields)) {
    columns = ['id', 'type', ...fields];
  } else {
    // Auto-detect columns from all entities
    const columnSet = new Set(['id', 'type']);
    for (const entity of entities) {
      for (const key of Object.keys(entity.data)) {
        if (!key.startsWith('_')) {
          columnSet.add(key);
        }
      }
    }
    columns = Array.from(columnSet);
  }

  // Build CSV rows
  const rows = [columns.join(',')];

  for (const entity of entities) {
    const row = columns.map(col => {
      let value;
      if (col === 'id') {
        value = entity.id;
      } else if (col === 'type') {
        value = entity.type;
      } else {
        value = entity.data[col];
      }

      // Handle complex values
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'object') {
        if (flatten) {
          value = JSON.stringify(value);
        } else {
          return '';
        }
      }

      // Escape CSV value
      value = String(value);
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        value = '"' + value.replace(/"/g, '""') + '"';
      }
      return value;
    });

    rows.push(row.join(','));
  }

  return rows.join('\n');
}

/**
 * Export relationships to CSV format
 * @private
 */
function exportRelationshipsToCSV(relationships) {
  const columns = ['id', 'sourceId', 'targetId', 'type', 'createdAt'];
  const rows = [columns.join(',')];

  for (const rel of relationships) {
    const row = [
      rel.id,
      rel.sourceId,
      rel.targetId,
      rel.type,
      rel.createdAt
    ].map(v => {
      if (v === null || v === undefined) return '';
      const str = String(v);
      if (str.includes(',') || str.includes('"')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    });
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

/**
 * Get an entity by ID
 *
 * @param {string} entityId - Entity ID
 * @returns {Object} Entity or null
 */
function getEntity(entityId) {
  return entityStore.get(entityId);
}

/**
 * Update an entity
 *
 * @param {string} entityId - Entity ID
 * @param {Object} data - Data to update
 * @param {Object} options - Update options
 * @returns {Object} Update result
 */
function updateEntity(entityId, data, options = {}) {
  const { normalize = true, merge = true } = options;

  const result = {
    success: false,
    entity: null,
    errors: [],
    warnings: []
  };

  const entity = entityStore.get(entityId);
  if (!entity) {
    result.errors.push({ code: 'NOT_FOUND', message: `Entity with ID '${entityId}' not found` });
    return result;
  }

  // Normalize new data if requested
  let newData = data;
  if (normalize) {
    newData = normalizeEntityData(entity.type, data, result.warnings);
  }

  // Merge or replace
  if (merge) {
    entity.data = { ...entity.data, ...newData };
  } else {
    entity.data = newData;
  }

  // Recompute derived fields
  entity.data = computeDerivedFields(entity.type, entity.data);

  // Update metadata
  entity.metadata.updatedAt = new Date().toISOString();
  entity.metadata.version = (entity.metadata.version || 0) + 1;

  entityStore.set(entity);

  result.success = true;
  result.entity = entity;
  return result;
}

/**
 * Delete an entity
 *
 * @param {string} entityId - Entity ID
 * @returns {Object} Delete result
 */
function deleteEntity(entityId) {
  const result = {
    success: false,
    deleted: false,
    errors: []
  };

  const deleted = entityStore.delete(entityId);
  if (!deleted) {
    result.errors.push({ code: 'NOT_FOUND', message: `Entity with ID '${entityId}' not found` });
    return result;
  }

  result.success = true;
  result.deleted = true;
  return result;
}

/**
 * Query entities
 *
 * @param {Object} query - Query parameters
 * @param {string} query.type - Entity type filter
 * @param {Object} query.where - Field conditions
 * @param {number} query.limit - Max results
 * @param {number} query.offset - Skip results
 * @returns {Object} Query result
 */
function queryEntities(query = {}) {
  const { type, where = {}, limit = 100, offset = 0 } = query;

  let entities = type ? entityStore.getByType(type) : entityStore.getAll();

  // Apply where conditions
  if (Object.keys(where).length > 0) {
    entities = entities.filter(entity => {
      for (const [field, condition] of Object.entries(where)) {
        const value = entity.data[field];

        if (typeof condition === 'object' && condition !== null) {
          // Complex condition
          if (condition.$eq !== undefined && value !== condition.$eq) return false;
          if (condition.$ne !== undefined && value === condition.$ne) return false;
          if (condition.$gt !== undefined && !(value > condition.$gt)) return false;
          if (condition.$gte !== undefined && !(value >= condition.$gte)) return false;
          if (condition.$lt !== undefined && !(value < condition.$lt)) return false;
          if (condition.$lte !== undefined && !(value <= condition.$lte)) return false;
          if (condition.$in !== undefined && !condition.$in.includes(value)) return false;
          if (condition.$contains !== undefined && !String(value).includes(condition.$contains)) return false;
          if (condition.$regex !== undefined) {
            const regex = new RegExp(condition.$regex, condition.$flags || 'i');
            if (!regex.test(String(value))) return false;
          }
        } else {
          // Simple equality
          if (value !== condition) return false;
        }
      }
      return true;
    });
  }

  const total = entities.length;

  // Apply pagination
  entities = entities.slice(offset, offset + limit);

  return {
    success: true,
    entities,
    total,
    limit,
    offset,
    hasMore: offset + entities.length < total
  };
}

/**
 * Get entity store statistics
 * @returns {Object} Statistics
 */
function getEntityStats() {
  return entityStore.getStats();
}

/**
 * Clear all entities
 * @returns {Object} Clear result
 */
function clearEntities() {
  entityStore.clear();
  return {
    success: true,
    message: 'All entities cleared'
  };
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.EntityTypes = EntityTypes;
  globalThis.RelationshipTypes = RelationshipTypes;
  globalThis.createEntity = createEntity;
  globalThis.linkEntities = linkEntities;
  globalThis.getRelatedEntities = getRelatedEntities;
  globalThis.exportEntities = exportEntities;
  globalThis.getEntity = getEntity;
  globalThis.updateEntity = updateEntity;
  globalThis.deleteEntity = deleteEntity;
  globalThis.queryEntities = queryEntities;
  globalThis.getEntityStats = getEntityStats;
  globalThis.clearEntities = clearEntities;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EntityTypes,
    RelationshipTypes,
    createEntity,
    linkEntities,
    getRelatedEntities,
    exportEntities,
    getEntity,
    updateEntity,
    deleteEntity,
    queryEntities,
    getEntityStats,
    clearEntities
  };
}
