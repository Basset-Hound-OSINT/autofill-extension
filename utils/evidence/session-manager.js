/**
 * Basset Hound Browser Automation - Evidence Session Manager
 * Phase 11.2: Multi-Page Evidence Collection Sessions
 *
 * Provides comprehensive evidence session management for investigators:
 * - Create and manage multi-page evidence collection sessions
 * - Session lifecycle: active, paused, closed, exported
 * - Evidence linking across pages via source URLs
 * - Cross-reference related evidence items
 * - Timeline view data generation
 * - Chrome storage persistence with auto-save
 * - Export capabilities (JSON bundle, PDF structure)
 * - Integration with EvidenceCapture and ChainOfCustody
 * - MCP command handlers for AI agent integration
 *
 * @module session-manager
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * Session manager configuration options
 * @constant {Object}
 */
const SessionConfig = {
  // Storage keys
  STORAGE_KEY_SESSIONS: 'evidence_sessions',
  STORAGE_KEY_ACTIVE_SESSION: 'evidence_active_session',
  STORAGE_KEY_SESSION_INDEX: 'evidence_session_index',

  // Limits
  MAX_SESSIONS: 100,
  MAX_EVIDENCE_PER_SESSION: 1000,
  DEFAULT_SIZE_LIMIT_BYTES: 50 * 1024 * 1024, // 50MB default
  MAX_SIZE_LIMIT_BYTES: 200 * 1024 * 1024, // 200MB max

  // Cleanup settings
  AUTO_CLEANUP_ENABLED: true,
  CLOSED_SESSION_RETENTION_DAYS: 90,
  AUTO_SAVE_INTERVAL_MS: 30000, // 30 seconds

  // Export settings
  EXPORT_VERSION: '1.0.0',
  EXPORT_STANDARD: 'NIST-DF'
};

/**
 * Session status values
 * @enum {string}
 */
const SessionStatus = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  CLOSED: 'closed',
  EXPORTED: 'exported'
};

/**
 * Evidence link types for cross-referencing
 * @enum {string}
 */
const EvidenceLinkType = {
  SAME_PAGE: 'same_page',           // Evidence from same page
  SAME_DOMAIN: 'same_domain',       // Evidence from same domain
  NAVIGATION: 'navigation',          // Evidence linked by navigation
  REFERENCE: 'reference',            // Manually linked reference
  TEMPORAL: 'temporal',              // Temporally related (captured together)
  CONTENT: 'content',                // Content-based relationship
  USER_DEFINED: 'user_defined'       // User-defined relationship
};

// =============================================================================
// EvidenceSession Class
// =============================================================================

/**
 * EvidenceSession - Represents a multi-page evidence collection session
 */
class EvidenceSession {
  /**
   * Create an EvidenceSession instance
   * @param {Object} options - Session options
   * @param {string} options.id - Session UUID (auto-generated if not provided)
   * @param {string} options.name - Human-readable session name
   * @param {string} options.caseId - Associated case ID
   * @param {Object} options.metadata - Session metadata
   * @param {number} options.sizeLimitBytes - Max session size in bytes
   */
  constructor(options = {}) {
    this.id = options.id || this._generateSessionId();
    this.name = options.name || `Session ${this.id.substring(0, 8)}`;
    this.caseId = options.caseId || null;
    this.status = options.status || SessionStatus.ACTIVE;

    // Timestamps
    this.createdAt = options.createdAt || Date.now();
    this.modifiedAt = options.modifiedAt || Date.now();
    this.closedAt = options.closedAt || null;
    this.exportedAt = options.exportedAt || null;

    // Metadata
    this.metadata = {
      investigator: options.metadata?.investigator || null,
      description: options.metadata?.description || '',
      tags: options.metadata?.tags || [],
      classification: options.metadata?.classification || 'unclassified',
      customFields: options.metadata?.customFields || {},
      ...options.metadata
    };

    // Evidence items
    this.evidenceItems = options.evidenceItems || [];
    this.evidenceIndex = new Map(); // id -> index in evidenceItems

    // Cross-references
    this.crossReferences = options.crossReferences || [];
    this.urlIndex = new Map(); // url -> array of evidence IDs
    this.domainIndex = new Map(); // domain -> array of evidence IDs

    // Session limits
    this.sizeLimitBytes = options.sizeLimitBytes || SessionConfig.DEFAULT_SIZE_LIMIT_BYTES;
    this.currentSizeBytes = options.currentSizeBytes || 0;

    // Chain of custody for session-level events
    this.custodyRecords = options.custodyRecords || [];

    // Statistics
    this.statistics = options.statistics || {
      totalEvidence: 0,
      byType: {},
      byDomain: {},
      crossReferenceCount: 0,
      pagesCaptured: 0,
      lastCaptureTime: null
    };

    // Rebuild indices if loading existing session
    if (options.evidenceItems && options.evidenceItems.length > 0) {
      this._rebuildIndices();
    }
  }

  // ===========================================================================
  // Evidence Management Methods
  // ===========================================================================

  /**
   * Add evidence item to session
   * @param {Object} evidenceItem - Evidence item to add
   * @param {Object} options - Add options
   * @param {boolean} options.autoCrossReference - Auto-create cross-references
   * @returns {Object} Result with evidence index
   */
  addEvidence(evidenceItem, options = {}) {
    const { autoCrossReference = true } = options;

    if (!evidenceItem || !evidenceItem.id) {
      return {
        success: false,
        error: 'Evidence item with id is required',
        timestamp: Date.now()
      };
    }

    // Check if already exists
    if (this.evidenceIndex.has(evidenceItem.id)) {
      return {
        success: false,
        error: 'Evidence already exists in session',
        evidenceId: evidenceItem.id,
        timestamp: Date.now()
      };
    }

    // Check session limits
    if (this.evidenceItems.length >= SessionConfig.MAX_EVIDENCE_PER_SESSION) {
      return {
        success: false,
        error: `Maximum evidence per session (${SessionConfig.MAX_EVIDENCE_PER_SESSION}) reached`,
        timestamp: Date.now()
      };
    }

    // Check size limit
    const itemSize = evidenceItem.sizeBytes || 0;
    if (this.currentSizeBytes + itemSize > this.sizeLimitBytes) {
      return {
        success: false,
        error: `Session size limit (${this._formatBytes(this.sizeLimitBytes)}) would be exceeded`,
        currentSize: this.currentSizeBytes,
        itemSize,
        timestamp: Date.now()
      };
    }

    // Prepare session evidence entry
    const sessionEntry = {
      ...evidenceItem,
      sessionId: this.id,
      addedAt: Date.now(),
      sequenceNumber: this.evidenceItems.length + 1,
      crossReferenceIds: []
    };

    // Add to items array
    const index = this.evidenceItems.length;
    this.evidenceItems.push(sessionEntry);
    this.evidenceIndex.set(evidenceItem.id, index);

    // Update indices
    this._indexEvidence(sessionEntry);

    // Update size tracking
    this.currentSizeBytes += itemSize;

    // Update statistics
    this._updateStatistics(sessionEntry);

    // Auto-create cross-references if enabled
    if (autoCrossReference) {
      this._autoCreateCrossReferences(sessionEntry);
    }

    // Update modified timestamp
    this.modifiedAt = Date.now();

    // Record custody event
    this._recordCustodyEvent('evidence_added', {
      evidenceId: evidenceItem.id,
      evidenceType: evidenceItem.type,
      notes: 'Evidence added to session'
    });

    return {
      success: true,
      evidenceId: evidenceItem.id,
      sequenceNumber: sessionEntry.sequenceNumber,
      index,
      sessionId: this.id,
      currentSize: this.currentSizeBytes,
      timestamp: Date.now()
    };
  }

  /**
   * Remove evidence item from session
   * @param {string} evidenceId - Evidence ID to remove
   * @returns {Object} Result
   */
  removeEvidence(evidenceId) {
    if (!this.evidenceIndex.has(evidenceId)) {
      return {
        success: false,
        error: 'Evidence not found in session',
        evidenceId,
        timestamp: Date.now()
      };
    }

    const index = this.evidenceIndex.get(evidenceId);
    const evidence = this.evidenceItems[index];

    // Remove from array (mark as removed, keep indices)
    this.evidenceItems[index] = null;
    this.evidenceIndex.delete(evidenceId);

    // Update size tracking
    this.currentSizeBytes -= evidence.sizeBytes || 0;

    // Remove from URL index
    if (evidence.page?.url) {
      const urlEntries = this.urlIndex.get(evidence.page.url) || [];
      const updatedEntries = urlEntries.filter(id => id !== evidenceId);
      if (updatedEntries.length > 0) {
        this.urlIndex.set(evidence.page.url, updatedEntries);
      } else {
        this.urlIndex.delete(evidence.page.url);
      }
    }

    // Remove from domain index
    if (evidence.page?.domain) {
      const domainEntries = this.domainIndex.get(evidence.page.domain) || [];
      const updatedEntries = domainEntries.filter(id => id !== evidenceId);
      if (updatedEntries.length > 0) {
        this.domainIndex.set(evidence.page.domain, updatedEntries);
      } else {
        this.domainIndex.delete(evidence.page.domain);
      }
    }

    // Remove cross-references involving this evidence
    this.crossReferences = this.crossReferences.filter(
      ref => ref.sourceId !== evidenceId && ref.targetId !== evidenceId
    );

    // Update modified timestamp
    this.modifiedAt = Date.now();

    // Record custody event
    this._recordCustodyEvent('evidence_removed', {
      evidenceId,
      evidenceType: evidence.type,
      notes: 'Evidence removed from session'
    });

    return {
      success: true,
      evidenceId,
      removed: true,
      timestamp: Date.now()
    };
  }

  /**
   * Get evidence item by ID
   * @param {string} evidenceId - Evidence ID
   * @returns {Object|null} Evidence item or null
   */
  getEvidence(evidenceId) {
    if (!this.evidenceIndex.has(evidenceId)) {
      return null;
    }
    const index = this.evidenceIndex.get(evidenceId);
    return this.evidenceItems[index];
  }

  /**
   * Get all evidence items with filters
   * @param {Object} options - Filter options
   * @param {string} options.type - Filter by evidence type
   * @param {string} options.url - Filter by source URL
   * @param {string} options.domain - Filter by domain
   * @param {number} options.since - Filter by timestamp (after)
   * @param {number} options.until - Filter by timestamp (before)
   * @param {number} options.limit - Max items to return
   * @param {number} options.offset - Items to skip
   * @returns {Object} Filtered evidence items with pagination
   */
  listEvidence(options = {}) {
    const {
      type = null,
      url = null,
      domain = null,
      since = 0,
      until = Date.now(),
      limit = 100,
      offset = 0
    } = options;

    let items = this.evidenceItems.filter(item => item !== null);

    // Apply filters
    if (type) {
      items = items.filter(e => e.type === type);
    }
    if (url) {
      items = items.filter(e => e.page?.url === url);
    }
    if (domain) {
      items = items.filter(e => e.page?.domain === domain);
    }
    items = items.filter(e => {
      const timestamp = e.captureTimestamp || e.addedAt;
      return timestamp >= since && timestamp <= until;
    });

    // Sort by sequence number
    items.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    // Pagination
    const totalCount = items.length;
    items = items.slice(offset, offset + limit);

    return {
      success: true,
      items,
      pagination: {
        total: totalCount,
        offset,
        limit,
        returned: items.length
      },
      timestamp: Date.now()
    };
  }

  // ===========================================================================
  // Cross-Reference Methods
  // ===========================================================================

  /**
   * Create cross-reference between evidence items
   * @param {string} sourceId - Source evidence ID
   * @param {string} targetId - Target evidence ID
   * @param {string} linkType - Link type from EvidenceLinkType
   * @param {Object} metadata - Link metadata
   * @returns {Object} Result
   */
  createCrossReference(sourceId, targetId, linkType = EvidenceLinkType.REFERENCE, metadata = {}) {
    if (!this.evidenceIndex.has(sourceId)) {
      return {
        success: false,
        error: 'Source evidence not found',
        sourceId,
        timestamp: Date.now()
      };
    }

    if (!this.evidenceIndex.has(targetId)) {
      return {
        success: false,
        error: 'Target evidence not found',
        targetId,
        timestamp: Date.now()
      };
    }

    if (sourceId === targetId) {
      return {
        success: false,
        error: 'Cannot cross-reference evidence with itself',
        timestamp: Date.now()
      };
    }

    // Check if reference already exists
    const existing = this.crossReferences.find(
      ref => ref.sourceId === sourceId && ref.targetId === targetId
    );

    if (existing) {
      // Update existing reference
      existing.linkType = linkType;
      existing.metadata = { ...existing.metadata, ...metadata };
      existing.updatedAt = Date.now();

      return {
        success: true,
        referenceId: existing.id,
        updated: true,
        timestamp: Date.now()
      };
    }

    // Create new reference
    const reference = {
      id: this._generateReferenceId(),
      sourceId,
      targetId,
      linkType,
      metadata,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.crossReferences.push(reference);

    // Update evidence items with cross-reference IDs
    const sourceEvidence = this.getEvidence(sourceId);
    const targetEvidence = this.getEvidence(targetId);

    if (sourceEvidence) {
      if (!sourceEvidence.crossReferenceIds) sourceEvidence.crossReferenceIds = [];
      sourceEvidence.crossReferenceIds.push(targetId);
    }

    if (targetEvidence) {
      if (!targetEvidence.crossReferenceIds) targetEvidence.crossReferenceIds = [];
      targetEvidence.crossReferenceIds.push(sourceId);
    }

    // Update statistics
    this.statistics.crossReferenceCount = this.crossReferences.length;
    this.modifiedAt = Date.now();

    return {
      success: true,
      referenceId: reference.id,
      sourceId,
      targetId,
      linkType,
      timestamp: Date.now()
    };
  }

  /**
   * Get cross-references for evidence item
   * @param {string} evidenceId - Evidence ID
   * @returns {Object} Cross-references
   */
  getCrossReferences(evidenceId) {
    const asSource = this.crossReferences.filter(ref => ref.sourceId === evidenceId);
    const asTarget = this.crossReferences.filter(ref => ref.targetId === evidenceId);

    return {
      success: true,
      evidenceId,
      outgoing: asSource,
      incoming: asTarget,
      total: asSource.length + asTarget.length,
      timestamp: Date.now()
    };
  }

  /**
   * Get evidence by source URL
   * @param {string} url - Source URL
   * @returns {Array} Evidence items from URL
   */
  getEvidenceByUrl(url) {
    const evidenceIds = this.urlIndex.get(url) || [];
    return evidenceIds.map(id => this.getEvidence(id)).filter(e => e !== null);
  }

  /**
   * Get evidence by domain
   * @param {string} domain - Domain
   * @returns {Array} Evidence items from domain
   */
  getEvidenceByDomain(domain) {
    const evidenceIds = this.domainIndex.get(domain) || [];
    return evidenceIds.map(id => this.getEvidence(id)).filter(e => e !== null);
  }

  // ===========================================================================
  // Timeline Methods
  // ===========================================================================

  /**
   * Generate timeline view data
   * @param {Object} options - Timeline options
   * @param {number} options.granularity - Time granularity in ms (default: 60000 for 1 minute)
   * @returns {Object} Timeline data
   */
  generateTimeline(options = {}) {
    const { granularity = 60000 } = options;

    const items = this.evidenceItems.filter(e => e !== null);

    if (items.length === 0) {
      return {
        success: true,
        timeline: [],
        summary: {
          startTime: null,
          endTime: null,
          duration: 0,
          totalEvents: 0
        },
        timestamp: Date.now()
      };
    }

    // Sort by capture time
    items.sort((a, b) => {
      const timeA = a.captureTimestamp || a.addedAt;
      const timeB = b.captureTimestamp || b.addedAt;
      return timeA - timeB;
    });

    const startTime = items[0].captureTimestamp || items[0].addedAt;
    const endTime = items[items.length - 1].captureTimestamp || items[items.length - 1].addedAt;

    // Group by time buckets
    const buckets = new Map();

    for (const item of items) {
      const timestamp = item.captureTimestamp || item.addedAt;
      const bucketKey = Math.floor(timestamp / granularity) * granularity;

      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, {
          timestamp: bucketKey,
          timestampISO: new Date(bucketKey).toISOString(),
          events: []
        });
      }

      buckets.get(bucketKey).events.push({
        evidenceId: item.id,
        type: item.type,
        url: item.page?.url || null,
        domain: item.page?.domain || null,
        captureTime: timestamp,
        sequenceNumber: item.sequenceNumber
      });
    }

    // Convert to sorted array
    const timeline = Array.from(buckets.values()).sort((a, b) => a.timestamp - b.timestamp);

    // Add event counts per bucket
    for (const bucket of timeline) {
      bucket.eventCount = bucket.events.length;
      bucket.types = [...new Set(bucket.events.map(e => e.type))];
      bucket.domains = [...new Set(bucket.events.map(e => e.domain).filter(Boolean))];
    }

    return {
      success: true,
      timeline,
      summary: {
        startTime,
        startTimeISO: new Date(startTime).toISOString(),
        endTime,
        endTimeISO: new Date(endTime).toISOString(),
        durationMs: endTime - startTime,
        durationHuman: this._formatDuration(endTime - startTime),
        totalEvents: items.length,
        bucketCount: timeline.length,
        granularityMs: granularity
      },
      timestamp: Date.now()
    };
  }

  // ===========================================================================
  // Session Lifecycle Methods
  // ===========================================================================

  /**
   * Pause session (prevents new evidence from being added)
   * @returns {Object} Result
   */
  pause() {
    if (this.status !== SessionStatus.ACTIVE) {
      return {
        success: false,
        error: `Cannot pause session with status: ${this.status}`,
        timestamp: Date.now()
      };
    }

    this.status = SessionStatus.PAUSED;
    this.modifiedAt = Date.now();

    this._recordCustodyEvent('session_paused', {
      notes: 'Session paused'
    });

    return {
      success: true,
      sessionId: this.id,
      status: this.status,
      timestamp: Date.now()
    };
  }

  /**
   * Resume paused session
   * @returns {Object} Result
   */
  resume() {
    if (this.status !== SessionStatus.PAUSED) {
      return {
        success: false,
        error: `Cannot resume session with status: ${this.status}`,
        timestamp: Date.now()
      };
    }

    this.status = SessionStatus.ACTIVE;
    this.modifiedAt = Date.now();

    this._recordCustodyEvent('session_resumed', {
      notes: 'Session resumed'
    });

    return {
      success: true,
      sessionId: this.id,
      status: this.status,
      timestamp: Date.now()
    };
  }

  /**
   * Close session (finalizes session, no more changes allowed)
   * @param {Object} options - Close options
   * @param {string} options.summary - Session summary
   * @param {Object} options.conclusions - Session conclusions
   * @returns {Object} Result
   */
  close(options = {}) {
    if (this.status === SessionStatus.CLOSED || this.status === SessionStatus.EXPORTED) {
      return {
        success: false,
        error: `Session already ${this.status}`,
        timestamp: Date.now()
      };
    }

    this.status = SessionStatus.CLOSED;
    this.closedAt = Date.now();
    this.modifiedAt = Date.now();

    if (options.summary) {
      this.metadata.summary = options.summary;
    }
    if (options.conclusions) {
      this.metadata.conclusions = options.conclusions;
    }

    this._recordCustodyEvent('session_closed', {
      notes: 'Session closed',
      summary: options.summary || null
    });

    return {
      success: true,
      sessionId: this.id,
      status: this.status,
      closedAt: this.closedAt,
      statistics: this.statistics,
      timestamp: Date.now()
    };
  }

  // ===========================================================================
  // Export Methods
  // ===========================================================================

  /**
   * Export session as JSON bundle
   * @param {Object} options - Export options
   * @param {boolean} options.includeData - Include evidence data (default: true)
   * @param {boolean} options.includeChainOfCustody - Include custody records (default: true)
   * @returns {Object} Export bundle
   */
  exportAsJson(options = {}) {
    const {
      includeData = true,
      includeChainOfCustody = true
    } = options;

    const items = this.evidenceItems.filter(e => e !== null);

    const exportBundle = {
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: this.metadata.investigator,
        format: 'json',
        version: SessionConfig.EXPORT_VERSION,
        standard: SessionConfig.EXPORT_STANDARD,
        generator: 'basset-hound-session-manager'
      },
      session: {
        id: this.id,
        name: this.name,
        caseId: this.caseId,
        status: this.status,
        metadata: this.metadata,
        createdAt: new Date(this.createdAt).toISOString(),
        modifiedAt: new Date(this.modifiedAt).toISOString(),
        closedAt: this.closedAt ? new Date(this.closedAt).toISOString() : null,
        statistics: this.statistics,
        sizeBytes: this.currentSizeBytes
      },
      evidence: items.map(item => ({
        id: item.id,
        type: item.type,
        status: item.status,
        sequenceNumber: item.sequenceNumber,
        case: {
          caseNumber: item.caseNumber,
          exhibitNumber: item.exhibitNumber,
          examinerID: item.examinerID
        },
        capture: {
          timestamp: item.captureTimestamp,
          timestampISO: item.captureISO,
          capturedBy: item.capturedBy,
          method: item.captureMethod
        },
        data: includeData ? item.data : '[DATA_EXCLUDED]',
        format: item.format,
        sizeBytes: item.sizeBytes,
        integrity: item.integrity,
        pageContext: item.page,
        crossReferences: item.crossReferenceIds,
        notes: item.notes
      })),
      crossReferences: this.crossReferences,
      chainOfCustody: includeChainOfCustody ? this.custodyRecords : '[CUSTODY_EXCLUDED]'
    };

    // Calculate export hash
    const exportHash = this._simpleHash(JSON.stringify(exportBundle));

    // Update session status
    this.status = SessionStatus.EXPORTED;
    this.exportedAt = Date.now();

    this._recordCustodyEvent('session_exported', {
      format: 'json',
      includeData,
      evidenceCount: items.length,
      exportHash
    });

    return {
      success: true,
      sessionId: this.id,
      bundle: exportBundle,
      exportHash,
      mimeType: 'application/json',
      filename: `session_${this.id}_${Date.now()}.json`,
      timestamp: Date.now()
    };
  }

  /**
   * Generate PDF report structure (for future implementation)
   * @param {Object} options - Report options
   * @returns {Object} PDF report structure
   */
  generatePdfReportStructure(options = {}) {
    const items = this.evidenceItems.filter(e => e !== null);
    const timeline = this.generateTimeline();

    const reportStructure = {
      title: `Evidence Session Report: ${this.name}`,
      generatedAt: new Date().toISOString(),
      sections: [
        {
          title: 'Session Overview',
          content: {
            sessionId: this.id,
            name: this.name,
            caseId: this.caseId,
            investigator: this.metadata.investigator,
            description: this.metadata.description,
            classification: this.metadata.classification,
            status: this.status,
            createdAt: new Date(this.createdAt).toISOString(),
            closedAt: this.closedAt ? new Date(this.closedAt).toISOString() : 'Active'
          }
        },
        {
          title: 'Evidence Summary',
          content: {
            totalEvidence: this.statistics.totalEvidence,
            evidenceByType: this.statistics.byType,
            evidenceByDomain: this.statistics.byDomain,
            crossReferences: this.statistics.crossReferenceCount,
            totalSize: this._formatBytes(this.currentSizeBytes)
          }
        },
        {
          title: 'Evidence Timeline',
          content: {
            ...timeline.summary,
            buckets: timeline.timeline?.slice(0, 50) // Limit for report
          }
        },
        {
          title: 'Evidence Items',
          items: items.map(item => ({
            id: item.id,
            type: item.type,
            exhibitNumber: item.exhibitNumber,
            captureTime: item.captureISO,
            url: item.page?.url,
            hash: item.integrity?.hash,
            notes: item.notes
          }))
        },
        {
          title: 'Cross-References',
          content: this.crossReferences.map(ref => ({
            source: ref.sourceId,
            target: ref.targetId,
            type: ref.linkType,
            createdAt: new Date(ref.createdAt).toISOString()
          }))
        },
        {
          title: 'Chain of Custody',
          records: this.custodyRecords.map(r => ({
            action: r.action,
            timestamp: r.timestampISO,
            userID: r.userID,
            notes: r.notes
          }))
        }
      ],
      metadata: {
        generatorVersion: SessionConfig.EXPORT_VERSION,
        standard: SessionConfig.EXPORT_STANDARD
      }
    };

    return {
      success: true,
      sessionId: this.id,
      reportStructure,
      pageCount: this._estimatePdfPages(reportStructure),
      timestamp: Date.now()
    };
  }

  // ===========================================================================
  // Serialization Methods
  // ===========================================================================

  /**
   * Serialize session to plain object for storage
   * @returns {Object} Serialized session
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      caseId: this.caseId,
      status: this.status,
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt,
      closedAt: this.closedAt,
      exportedAt: this.exportedAt,
      metadata: this.metadata,
      evidenceItems: this.evidenceItems.filter(e => e !== null),
      crossReferences: this.crossReferences,
      sizeLimitBytes: this.sizeLimitBytes,
      currentSizeBytes: this.currentSizeBytes,
      custodyRecords: this.custodyRecords,
      statistics: this.statistics
    };
  }

  /**
   * Create session from serialized data
   * @param {Object} data - Serialized session data
   * @returns {EvidenceSession} Restored session
   */
  static fromJSON(data) {
    return new EvidenceSession(data);
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Generate unique session ID
   * @private
   * @returns {string} Session ID
   */
  _generateSessionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `ses_${timestamp}_${random}`;
  }

  /**
   * Generate unique reference ID
   * @private
   * @returns {string} Reference ID
   */
  _generateReferenceId() {
    return `ref_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  }

  /**
   * Index evidence item for quick lookups
   * @private
   * @param {Object} evidence - Evidence item
   */
  _indexEvidence(evidence) {
    // Index by URL
    if (evidence.page?.url) {
      if (!this.urlIndex.has(evidence.page.url)) {
        this.urlIndex.set(evidence.page.url, []);
      }
      this.urlIndex.get(evidence.page.url).push(evidence.id);
    }

    // Index by domain
    if (evidence.page?.domain) {
      if (!this.domainIndex.has(evidence.page.domain)) {
        this.domainIndex.set(evidence.page.domain, []);
      }
      this.domainIndex.get(evidence.page.domain).push(evidence.id);
    }
  }

  /**
   * Rebuild indices from evidence items
   * @private
   */
  _rebuildIndices() {
    this.evidenceIndex.clear();
    this.urlIndex.clear();
    this.domainIndex.clear();

    for (let i = 0; i < this.evidenceItems.length; i++) {
      const item = this.evidenceItems[i];
      if (item !== null) {
        this.evidenceIndex.set(item.id, i);
        this._indexEvidence(item);
      }
    }
  }

  /**
   * Auto-create cross-references based on URL/domain
   * @private
   * @param {Object} evidence - New evidence item
   */
  _autoCreateCrossReferences(evidence) {
    // Cross-reference with same URL evidence
    if (evidence.page?.url) {
      const sameUrlIds = this.urlIndex.get(evidence.page.url) || [];
      for (const id of sameUrlIds) {
        if (id !== evidence.id) {
          this.createCrossReference(evidence.id, id, EvidenceLinkType.SAME_PAGE, {
            autoCreated: true,
            reason: 'same_url'
          });
        }
      }
    }

    // Cross-reference with same domain evidence (within time window)
    if (evidence.page?.domain) {
      const sameDomainIds = this.domainIndex.get(evidence.page.domain) || [];
      const captureTime = evidence.captureTimestamp || evidence.addedAt;
      const timeWindow = 5 * 60 * 1000; // 5 minutes

      for (const id of sameDomainIds) {
        if (id !== evidence.id) {
          const other = this.getEvidence(id);
          if (other) {
            const otherTime = other.captureTimestamp || other.addedAt;
            if (Math.abs(captureTime - otherTime) <= timeWindow) {
              this.createCrossReference(evidence.id, id, EvidenceLinkType.TEMPORAL, {
                autoCreated: true,
                reason: 'same_domain_temporal',
                timeDifferenceMs: Math.abs(captureTime - otherTime)
              });
            }
          }
        }
      }
    }
  }

  /**
   * Update session statistics
   * @private
   * @param {Object} evidence - Evidence item
   */
  _updateStatistics(evidence) {
    this.statistics.totalEvidence = this.evidenceItems.filter(e => e !== null).length;
    this.statistics.byType[evidence.type] = (this.statistics.byType[evidence.type] || 0) + 1;

    if (evidence.page?.domain) {
      this.statistics.byDomain[evidence.page.domain] = (this.statistics.byDomain[evidence.page.domain] || 0) + 1;
    }

    // Track unique pages
    this.statistics.pagesCaptured = this.urlIndex.size;
    this.statistics.lastCaptureTime = evidence.captureTimestamp || evidence.addedAt;
  }

  /**
   * Record session-level custody event
   * @private
   * @param {string} action - Custody action
   * @param {Object} details - Event details
   */
  _recordCustodyEvent(action, details = {}) {
    const event = {
      timestamp: Date.now(),
      timestampISO: new Date().toISOString(),
      action,
      userID: this.metadata.investigator || null,
      notes: details.notes || null,
      details: { ...details }
    };
    delete event.details.notes;

    this.custodyRecords.push(event);
  }

  /**
   * Format bytes to human-readable string
   * @private
   * @param {number} bytes - Bytes
   * @returns {string} Formatted string
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
  }

  /**
   * Format duration to human-readable string
   * @private
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted duration
   */
  _formatDuration(ms) {
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
   * Simple hash for export verification
   * @private
   * @param {string} data - Data to hash
   * @returns {string} Hash string
   */
  _simpleHash(data) {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'hash_' + Math.abs(hash).toString(16).padStart(16, '0');
  }

  /**
   * Estimate PDF page count
   * @private
   * @param {Object} structure - Report structure
   * @returns {number} Estimated pages
   */
  _estimatePdfPages(structure) {
    let pages = 1; // Cover page
    pages += Math.ceil(structure.sections.length / 2); // Sections
    if (structure.sections[3]?.items) {
      pages += Math.ceil(structure.sections[3].items.length / 10); // Evidence items
    }
    return pages;
  }
}

// =============================================================================
// SessionManager Class
// =============================================================================

/**
 * SessionManager - Manages evidence sessions with persistence
 */
class SessionManager {
  /**
   * Create a SessionManager instance
   * @param {Object} options - Manager options
   * @param {Object} options.logger - Logger instance
   * @param {boolean} options.autoSave - Enable auto-save (default: true)
   * @param {boolean} options.autoCleanup - Enable auto-cleanup (default: true)
   */
  constructor(options = {}) {
    this.config = {
      logger: options.logger || null,
      autoSave: options.autoSave !== false,
      autoCleanup: options.autoCleanup !== false
    };

    this.sessions = new Map();
    this.activeSessionId = null;
    this.autoSaveTimer = null;

    // Statistics
    this.stats = {
      totalSessions: 0,
      activeSessions: 0,
      totalEvidence: 0,
      totalSizeBytes: 0,
      lastSessionCreated: null
    };

    // Initialize
    this._initialize();
  }

  // ===========================================================================
  // Session Lifecycle Methods
  // ===========================================================================

  /**
   * Create a new evidence session
   * @param {string} name - Session name
   * @param {Object} metadata - Session metadata
   * @param {string} metadata.caseId - Associated case ID
   * @param {string} metadata.investigator - Investigator ID/name
   * @param {string} metadata.description - Session description
   * @param {Array<string>} metadata.tags - Session tags
   * @param {number} metadata.sizeLimitBytes - Session size limit
   * @returns {Promise<Object>} Created session result
   */
  async createSession(name, metadata = {}) {
    // Check session limit
    const activeSessions = Array.from(this.sessions.values())
      .filter(s => s.status === SessionStatus.ACTIVE || s.status === SessionStatus.PAUSED);

    if (activeSessions.length >= SessionConfig.MAX_SESSIONS) {
      return {
        success: false,
        error: `Maximum sessions (${SessionConfig.MAX_SESSIONS}) reached`,
        timestamp: Date.now()
      };
    }

    // Create new session
    const session = new EvidenceSession({
      name,
      caseId: metadata.caseId,
      metadata: {
        investigator: metadata.investigator,
        description: metadata.description,
        tags: metadata.tags,
        classification: metadata.classification,
        customFields: metadata.customFields
      },
      sizeLimitBytes: metadata.sizeLimitBytes
    });

    // Store session
    this.sessions.set(session.id, session);

    // Set as active session
    this.activeSessionId = session.id;

    // Update stats
    this.stats.totalSessions++;
    this.stats.activeSessions = activeSessions.length + 1;
    this.stats.lastSessionCreated = Date.now();

    // Save to storage
    await this._saveSession(session);
    await this._saveActiveSessionId();

    this._log('info', `Session created: ${session.id} (${name})`);

    return {
      success: true,
      sessionId: session.id,
      name: session.name,
      caseId: session.caseId,
      status: session.status,
      timestamp: Date.now()
    };
  }

  /**
   * Get the currently active session
   * @returns {Promise<EvidenceSession|null>} Active session or null
   */
  async getActiveSession() {
    if (!this.activeSessionId) {
      await this._loadActiveSessionId();
    }

    if (!this.activeSessionId) {
      return null;
    }

    // Load session if not in memory
    if (!this.sessions.has(this.activeSessionId)) {
      await this._loadSession(this.activeSessionId);
    }

    return this.sessions.get(this.activeSessionId) || null;
  }

  /**
   * Set the active session
   * @param {string} sessionId - Session ID to set as active
   * @returns {Promise<Object>} Result
   */
  async setActiveSession(sessionId) {
    if (!sessionId) {
      return {
        success: false,
        error: 'Session ID is required',
        timestamp: Date.now()
      };
    }

    // Load session if not in memory
    if (!this.sessions.has(sessionId)) {
      await this._loadSession(sessionId);
    }

    const session = this.sessions.get(sessionId);

    if (!session) {
      return {
        success: false,
        error: 'Session not found',
        sessionId,
        timestamp: Date.now()
      };
    }

    if (session.status === SessionStatus.CLOSED || session.status === SessionStatus.EXPORTED) {
      return {
        success: false,
        error: `Cannot set closed/exported session as active`,
        sessionId,
        status: session.status,
        timestamp: Date.now()
      };
    }

    const previousId = this.activeSessionId;
    this.activeSessionId = sessionId;

    await this._saveActiveSessionId();

    this._log('info', `Active session changed: ${previousId} -> ${sessionId}`);

    return {
      success: true,
      sessionId,
      previousSessionId: previousId,
      session: {
        id: session.id,
        name: session.name,
        status: session.status,
        evidenceCount: session.statistics.totalEvidence
      },
      timestamp: Date.now()
    };
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<EvidenceSession|null>} Session or null
   */
  async getSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      await this._loadSession(sessionId);
    }
    return this.sessions.get(sessionId) || null;
  }

  /**
   * List all sessions with optional filters
   * @param {Object} filters - Filter options
   * @param {string} filters.status - Filter by status
   * @param {string} filters.caseId - Filter by case ID
   * @param {string} filters.investigator - Filter by investigator
   * @param {number} filters.since - Filter by creation time (after)
   * @param {number} filters.until - Filter by creation time (before)
   * @param {number} filters.limit - Max sessions to return
   * @param {number} filters.offset - Sessions to skip
   * @returns {Promise<Object>} Sessions list with pagination
   */
  async listSessions(filters = {}) {
    // Load all session IDs
    await this._loadSessionIndex();

    const {
      status = null,
      caseId = null,
      investigator = null,
      since = 0,
      until = Date.now(),
      limit = 50,
      offset = 0
    } = filters;

    // Load sessions that match filters
    let sessions = [];
    for (const [id, session] of this.sessions) {
      // Apply filters
      if (status && session.status !== status) continue;
      if (caseId && session.caseId !== caseId) continue;
      if (investigator && session.metadata.investigator !== investigator) continue;
      if (session.createdAt < since || session.createdAt > until) continue;

      sessions.push({
        id: session.id,
        name: session.name,
        caseId: session.caseId,
        status: session.status,
        investigator: session.metadata.investigator,
        evidenceCount: session.statistics.totalEvidence,
        sizeBytes: session.currentSizeBytes,
        createdAt: session.createdAt,
        modifiedAt: session.modifiedAt,
        isActive: session.id === this.activeSessionId
      });
    }

    // Sort by creation date (newest first)
    sessions.sort((a, b) => b.createdAt - a.createdAt);

    // Pagination
    const totalCount = sessions.length;
    sessions = sessions.slice(offset, offset + limit);

    return {
      success: true,
      sessions,
      pagination: {
        total: totalCount,
        offset,
        limit,
        returned: sessions.length
      },
      activeSessionId: this.activeSessionId,
      timestamp: Date.now()
    };
  }

  /**
   * Close a session
   * @param {string} sessionId - Session ID to close
   * @param {Object} options - Close options
   * @returns {Promise<Object>} Close result
   */
  async closeSession(sessionId, options = {}) {
    const session = await this.getSession(sessionId);

    if (!session) {
      return {
        success: false,
        error: 'Session not found',
        sessionId,
        timestamp: Date.now()
      };
    }

    const result = session.close(options);

    if (result.success) {
      // Clear active session if this was active
      if (this.activeSessionId === sessionId) {
        this.activeSessionId = null;
        await this._saveActiveSessionId();
      }

      // Save session
      await this._saveSession(session);

      // Update stats
      this.stats.activeSessions = Array.from(this.sessions.values())
        .filter(s => s.status === SessionStatus.ACTIVE || s.status === SessionStatus.PAUSED).length;

      this._log('info', `Session closed: ${sessionId}`);
    }

    return result;
  }

  /**
   * Delete a session
   * @param {string} sessionId - Session ID to delete
   * @returns {Promise<Object>} Delete result
   */
  async deleteSession(sessionId) {
    const session = await this.getSession(sessionId);

    if (!session) {
      return {
        success: false,
        error: 'Session not found',
        sessionId,
        timestamp: Date.now()
      };
    }

    // Only allow deleting closed/exported sessions
    if (session.status === SessionStatus.ACTIVE || session.status === SessionStatus.PAUSED) {
      return {
        success: false,
        error: 'Cannot delete active/paused session. Close it first.',
        sessionId,
        status: session.status,
        timestamp: Date.now()
      };
    }

    // Remove from memory
    this.sessions.delete(sessionId);

    // Remove from storage
    await this._deleteSession(sessionId);

    // Update stats
    this.stats.totalSessions--;

    this._log('info', `Session deleted: ${sessionId}`);

    return {
      success: true,
      sessionId,
      deleted: true,
      timestamp: Date.now()
    };
  }

  // ===========================================================================
  // Evidence Methods
  // ===========================================================================

  /**
   * Add evidence to a session
   * @param {string} sessionId - Session ID (null for active session)
   * @param {Object} evidenceItem - Evidence item to add
   * @returns {Promise<Object>} Add result
   */
  async addEvidence(sessionId, evidenceItem) {
    const targetSessionId = sessionId || this.activeSessionId;

    if (!targetSessionId) {
      return {
        success: false,
        error: 'No session specified and no active session',
        timestamp: Date.now()
      };
    }

    const session = await this.getSession(targetSessionId);

    if (!session) {
      return {
        success: false,
        error: 'Session not found',
        sessionId: targetSessionId,
        timestamp: Date.now()
      };
    }

    if (session.status !== SessionStatus.ACTIVE) {
      return {
        success: false,
        error: `Cannot add evidence to session with status: ${session.status}`,
        sessionId: targetSessionId,
        timestamp: Date.now()
      };
    }

    const result = session.addEvidence(evidenceItem);

    if (result.success) {
      // Save session
      await this._saveSession(session);

      // Update global stats
      this.stats.totalEvidence++;
      this.stats.totalSizeBytes += evidenceItem.sizeBytes || 0;
    }

    return result;
  }

  /**
   * Get evidence from a session
   * @param {string} sessionId - Session ID
   * @param {string} evidenceId - Evidence ID
   * @returns {Promise<Object>} Evidence item
   */
  async getEvidence(sessionId, evidenceId) {
    const session = await this.getSession(sessionId);

    if (!session) {
      return {
        success: false,
        error: 'Session not found',
        sessionId,
        timestamp: Date.now()
      };
    }

    const evidence = session.getEvidence(evidenceId);

    if (!evidence) {
      return {
        success: false,
        error: 'Evidence not found',
        evidenceId,
        timestamp: Date.now()
      };
    }

    return {
      success: true,
      evidence,
      timestamp: Date.now()
    };
  }

  // ===========================================================================
  // Export Methods
  // ===========================================================================

  /**
   * Export a session
   * @param {string} sessionId - Session ID to export
   * @param {Object} options - Export options
   * @param {string} options.format - Export format ('json' or 'pdf')
   * @param {boolean} options.includeData - Include evidence data
   * @returns {Promise<Object>} Export result
   */
  async exportSession(sessionId, options = {}) {
    const { format = 'json', includeData = true } = options;

    const session = await this.getSession(sessionId);

    if (!session) {
      return {
        success: false,
        error: 'Session not found',
        sessionId,
        timestamp: Date.now()
      };
    }

    let result;
    if (format === 'pdf') {
      result = session.generatePdfReportStructure(options);
    } else {
      result = session.exportAsJson({ includeData, ...options });
    }

    if (result.success) {
      // Save session with updated status
      await this._saveSession(session);
    }

    return result;
  }

  // ===========================================================================
  // Cleanup Methods
  // ===========================================================================

  /**
   * Cleanup old closed sessions
   * @param {Object} options - Cleanup options
   * @param {number} options.olderThanDays - Delete sessions older than days
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupOldSessions(options = {}) {
    const { olderThanDays = SessionConfig.CLOSED_SESSION_RETENTION_DAYS } = options;

    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    const deleted = [];

    for (const [id, session] of this.sessions) {
      if ((session.status === SessionStatus.CLOSED || session.status === SessionStatus.EXPORTED) &&
          session.closedAt && session.closedAt < cutoffTime) {
        await this.deleteSession(id);
        deleted.push(id);
      }
    }

    this._log('info', `Cleaned up ${deleted.length} old sessions`);

    return {
      success: true,
      deletedCount: deleted.length,
      deletedSessionIds: deleted,
      timestamp: Date.now()
    };
  }

  // ===========================================================================
  // Statistics Methods
  // ===========================================================================

  /**
   * Get manager statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    return {
      success: true,
      stats: {
        ...this.stats,
        sessionsInMemory: this.sessions.size,
        activeSessionId: this.activeSessionId
      },
      timestamp: Date.now()
    };
  }

  // ===========================================================================
  // Integration Methods
  // ===========================================================================

  /**
   * Integrate with EvidenceCapture - auto-add captured evidence
   * @param {Object} evidenceCapture - EvidenceCapture instance
   */
  integrateWithEvidenceCapture(evidenceCapture) {
    if (!evidenceCapture) return;

    // Store original capture method
    const originalCaptureScreenshot = evidenceCapture.captureScreenshot.bind(evidenceCapture);
    const originalCapturePageContent = evidenceCapture.capturePageContent.bind(evidenceCapture);
    const originalCaptureElement = evidenceCapture.captureElement.bind(evidenceCapture);

    // Wrap capture methods to auto-add to session
    const self = this;

    evidenceCapture.captureScreenshot = async function(options = {}) {
      const result = await originalCaptureScreenshot(options);
      if (result.success && self.activeSessionId) {
        const evidence = evidenceCapture.evidenceItems.get(result.evidenceId);
        if (evidence) {
          await self.addEvidence(self.activeSessionId, evidence);
        }
      }
      return result;
    };

    evidenceCapture.capturePageContent = async function(options = {}) {
      const result = await originalCapturePageContent(options);
      if (result.success && self.activeSessionId) {
        const evidence = evidenceCapture.evidenceItems.get(result.evidenceId);
        if (evidence) {
          await self.addEvidence(self.activeSessionId, evidence);
        }
      }
      return result;
    };

    evidenceCapture.captureElement = async function(elementOrSelector, options = {}) {
      const result = await originalCaptureElement(elementOrSelector, options);
      if (result.success && self.activeSessionId) {
        const evidence = evidenceCapture.evidenceItems.get(result.evidenceId);
        if (evidence) {
          await self.addEvidence(self.activeSessionId, evidence);
        }
      }
      return result;
    };

    this._log('info', 'Integrated with EvidenceCapture');
  }

  /**
   * Link session to investigation context
   * @param {string} sessionId - Session ID
   * @param {string} investigationId - Investigation ID
   * @returns {Promise<Object>} Link result
   */
  async linkToInvestigation(sessionId, investigationId) {
    const session = await this.getSession(sessionId);

    if (!session) {
      return {
        success: false,
        error: 'Session not found',
        sessionId,
        timestamp: Date.now()
      };
    }

    session.metadata.investigationId = investigationId;
    session.modifiedAt = Date.now();

    await this._saveSession(session);

    return {
      success: true,
      sessionId,
      investigationId,
      timestamp: Date.now()
    };
  }

  // ===========================================================================
  // Private Storage Methods
  // ===========================================================================

  /**
   * Initialize manager
   * @private
   */
  async _initialize() {
    await this._loadActiveSessionId();
    await this._loadSessionIndex();

    if (this.config.autoSave) {
      this._startAutoSave();
    }

    if (this.config.autoCleanup) {
      // Run cleanup on initialization
      setTimeout(() => this.cleanupOldSessions(), 5000);
    }

    this._log('info', 'SessionManager initialized');
  }

  /**
   * Get storage API
   * @private
   * @returns {Object} Storage API
   */
  _getStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
    return this._getMockStorage();
  }

  /**
   * Mock storage for non-extension environments
   * @private
   * @returns {Object} Mock storage
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
   * Save session to storage
   * @private
   * @param {EvidenceSession} session - Session to save
   */
  async _saveSession(session) {
    const storage = this._getStorage();
    const key = `${SessionConfig.STORAGE_KEY_SESSIONS}_${session.id}`;

    try {
      await storage.set({ [key]: session.toJSON() });
      await this._updateSessionIndex(session.id);
    } catch (error) {
      this._log('error', `Failed to save session ${session.id}: ${error.message}`);
    }
  }

  /**
   * Load session from storage
   * @private
   * @param {string} sessionId - Session ID to load
   */
  async _loadSession(sessionId) {
    const storage = this._getStorage();
    const key = `${SessionConfig.STORAGE_KEY_SESSIONS}_${sessionId}`;

    try {
      const result = await storage.get(key);
      const data = result[key];

      if (data) {
        const session = EvidenceSession.fromJSON(data);
        this.sessions.set(sessionId, session);
        return session;
      }
    } catch (error) {
      this._log('error', `Failed to load session ${sessionId}: ${error.message}`);
    }
    return null;
  }

  /**
   * Delete session from storage
   * @private
   * @param {string} sessionId - Session ID to delete
   */
  async _deleteSession(sessionId) {
    const storage = this._getStorage();
    const key = `${SessionConfig.STORAGE_KEY_SESSIONS}_${sessionId}`;

    try {
      await storage.remove(key);
      await this._removeFromSessionIndex(sessionId);
    } catch (error) {
      this._log('error', `Failed to delete session ${sessionId}: ${error.message}`);
    }
  }

  /**
   * Save active session ID
   * @private
   */
  async _saveActiveSessionId() {
    const storage = this._getStorage();
    try {
      await storage.set({ [SessionConfig.STORAGE_KEY_ACTIVE_SESSION]: this.activeSessionId });
    } catch (error) {
      this._log('error', `Failed to save active session ID: ${error.message}`);
    }
  }

  /**
   * Load active session ID
   * @private
   */
  async _loadActiveSessionId() {
    const storage = this._getStorage();
    try {
      const result = await storage.get(SessionConfig.STORAGE_KEY_ACTIVE_SESSION);
      this.activeSessionId = result[SessionConfig.STORAGE_KEY_ACTIVE_SESSION] || null;
    } catch (error) {
      this._log('error', `Failed to load active session ID: ${error.message}`);
    }
  }

  /**
   * Load session index
   * @private
   */
  async _loadSessionIndex() {
    const storage = this._getStorage();
    try {
      const result = await storage.get(SessionConfig.STORAGE_KEY_SESSION_INDEX);
      const index = result[SessionConfig.STORAGE_KEY_SESSION_INDEX] || [];

      for (const sessionId of index) {
        if (!this.sessions.has(sessionId)) {
          await this._loadSession(sessionId);
        }
      }
    } catch (error) {
      this._log('error', `Failed to load session index: ${error.message}`);
    }
  }

  /**
   * Update session index
   * @private
   * @param {string} sessionId - Session ID to add
   */
  async _updateSessionIndex(sessionId) {
    const storage = this._getStorage();
    try {
      const result = await storage.get(SessionConfig.STORAGE_KEY_SESSION_INDEX);
      const index = result[SessionConfig.STORAGE_KEY_SESSION_INDEX] || [];

      if (!index.includes(sessionId)) {
        index.push(sessionId);
        await storage.set({ [SessionConfig.STORAGE_KEY_SESSION_INDEX]: index });
      }
    } catch (error) {
      this._log('error', `Failed to update session index: ${error.message}`);
    }
  }

  /**
   * Remove from session index
   * @private
   * @param {string} sessionId - Session ID to remove
   */
  async _removeFromSessionIndex(sessionId) {
    const storage = this._getStorage();
    try {
      const result = await storage.get(SessionConfig.STORAGE_KEY_SESSION_INDEX);
      const index = result[SessionConfig.STORAGE_KEY_SESSION_INDEX] || [];

      const newIndex = index.filter(id => id !== sessionId);
      await storage.set({ [SessionConfig.STORAGE_KEY_SESSION_INDEX]: newIndex });
    } catch (error) {
      this._log('error', `Failed to remove from session index: ${error.message}`);
    }
  }

  /**
   * Start auto-save timer
   * @private
   */
  _startAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(async () => {
      for (const session of this.sessions.values()) {
        if (session.status === SessionStatus.ACTIVE || session.status === SessionStatus.PAUSED) {
          await this._saveSession(session);
        }
      }
    }, SessionConfig.AUTO_SAVE_INTERVAL_MS);
  }

  /**
   * Log a message
   * @private
   * @param {string} level - Log level
   * @param {string} message - Log message
   */
  _log(level, message) {
    if (this.config.logger && this.config.logger[level]) {
      this.config.logger[level](message);
    } else if (typeof console !== 'undefined' && console[level]) {
      console[level]('[SessionManager] ' + message);
    }
  }
}

// =============================================================================
// MCP Command Handlers
// =============================================================================

/**
 * Singleton session manager instance
 * @type {SessionManager|null}
 */
let sessionManagerInstance = null;

/**
 * Get or create session manager instance
 * @param {Object} options - Manager options
 * @returns {SessionManager} Manager instance
 */
function getSessionManager(options = {}) {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager(options);
  }
  return sessionManagerInstance;
}

/**
 * MCP Command: Start evidence session
 * @param {Object} params - Command parameters
 * @param {string} params.name - Session name
 * @param {string} params.case_id - Case ID
 * @param {string} params.investigator - Investigator ID
 * @param {string} params.description - Session description
 * @param {Array<string>} params.tags - Session tags
 * @returns {Promise<Object>} Command result
 */
async function mcpStartEvidenceSession(params) {
  const manager = getSessionManager();

  const result = await manager.createSession(params.name || 'New Evidence Session', {
    caseId: params.case_id,
    investigator: params.investigator,
    description: params.description,
    tags: params.tags,
    classification: params.classification,
    sizeLimitBytes: params.size_limit_bytes
  });

  return {
    ...result,
    command: 'start_evidence_session'
  };
}

/**
 * MCP Command: Get evidence session
 * @param {Object} params - Command parameters
 * @param {string} params.session_id - Session ID (optional, gets active if not provided)
 * @returns {Promise<Object>} Command result
 */
async function mcpGetEvidenceSession(params = {}) {
  const manager = getSessionManager();

  let session;
  if (params.session_id) {
    session = await manager.getSession(params.session_id);
  } else {
    session = await manager.getActiveSession();
  }

  if (!session) {
    return {
      success: false,
      error: params.session_id ? 'Session not found' : 'No active session',
      command: 'get_evidence_session',
      timestamp: Date.now()
    };
  }

  return {
    success: true,
    command: 'get_evidence_session',
    session: {
      id: session.id,
      name: session.name,
      caseId: session.caseId,
      status: session.status,
      metadata: session.metadata,
      statistics: session.statistics,
      createdAt: session.createdAt,
      modifiedAt: session.modifiedAt,
      sizeBytes: session.currentSizeBytes
    },
    isActive: session.id === manager.activeSessionId,
    timestamp: Date.now()
  };
}

/**
 * MCP Command: Add to evidence session
 * @param {Object} params - Command parameters
 * @param {string} params.session_id - Session ID (optional, uses active)
 * @param {Object} params.evidence - Evidence item to add
 * @returns {Promise<Object>} Command result
 */
async function mcpAddToSession(params) {
  const manager = getSessionManager();

  if (!params.evidence) {
    return {
      success: false,
      error: 'evidence parameter is required',
      command: 'add_to_session',
      timestamp: Date.now()
    };
  }

  const result = await manager.addEvidence(params.session_id, params.evidence);

  return {
    ...result,
    command: 'add_to_session'
  };
}

/**
 * MCP Command: Close evidence session
 * @param {Object} params - Command parameters
 * @param {string} params.session_id - Session ID to close
 * @param {boolean} params.export - Whether to export on close
 * @param {string} params.summary - Session summary
 * @returns {Promise<Object>} Command result
 */
async function mcpCloseEvidenceSession(params) {
  const manager = getSessionManager();

  if (!params.session_id) {
    return {
      success: false,
      error: 'session_id is required',
      command: 'close_evidence_session',
      timestamp: Date.now()
    };
  }

  const closeResult = await manager.closeSession(params.session_id, {
    summary: params.summary,
    conclusions: params.conclusions
  });

  let exportResult = null;
  if (params.export && closeResult.success) {
    exportResult = await manager.exportSession(params.session_id, {
      format: params.export_format || 'json',
      includeData: params.include_data !== false
    });
  }

  return {
    ...closeResult,
    command: 'close_evidence_session',
    export: exportResult
  };
}

/**
 * MCP Command: List evidence sessions
 * @param {Object} params - Command parameters
 * @param {string} params.status - Filter by status
 * @param {string} params.case_id - Filter by case ID
 * @param {number} params.limit - Max sessions to return
 * @param {number} params.offset - Sessions to skip
 * @returns {Promise<Object>} Command result
 */
async function mcpListEvidenceSessions(params = {}) {
  const manager = getSessionManager();

  const result = await manager.listSessions({
    status: params.status,
    caseId: params.case_id,
    investigator: params.investigator,
    since: params.since,
    until: params.until,
    limit: params.limit,
    offset: params.offset
  });

  return {
    ...result,
    command: 'list_evidence_sessions'
  };
}

/**
 * MCP Command: Export evidence session
 * @param {Object} params - Command parameters
 * @param {string} params.session_id - Session ID to export
 * @param {string} params.format - Export format ('json' or 'pdf')
 * @param {boolean} params.include_data - Include evidence data
 * @returns {Promise<Object>} Command result
 */
async function mcpExportEvidenceSession(params) {
  const manager = getSessionManager();

  if (!params.session_id) {
    return {
      success: false,
      error: 'session_id is required',
      command: 'export_evidence_session',
      timestamp: Date.now()
    };
  }

  const result = await manager.exportSession(params.session_id, {
    format: params.format || 'json',
    includeData: params.include_data !== false,
    includeChainOfCustody: params.include_custody !== false
  });

  return {
    ...result,
    command: 'export_evidence_session'
  };
}

/**
 * MCP command registry for session management
 * @type {Object}
 */
const SessionCommands = {
  start_evidence_session: mcpStartEvidenceSession,
  get_evidence_session: mcpGetEvidenceSession,
  add_to_session: mcpAddToSession,
  close_evidence_session: mcpCloseEvidenceSession,
  list_evidence_sessions: mcpListEvidenceSessions,
  export_evidence_session: mcpExportEvidenceSession
};

/**
 * Execute an MCP-style session command
 * @param {string} command - Command name
 * @param {Object} params - Command parameters
 * @returns {Promise<Object>} Command result
 */
async function executeSessionCommand(command, params = {}) {
  const handler = SessionCommands[command];

  if (!handler) {
    return {
      success: false,
      error: `Unknown command: ${command}`,
      available_commands: Object.keys(SessionCommands),
      timestamp: Date.now()
    };
  }

  try {
    return await handler(params);
  } catch (error) {
    return {
      success: false,
      error: error.message,
      command,
      timestamp: Date.now()
    };
  }
}

// =============================================================================
// Exports
// =============================================================================

if (typeof globalThis !== 'undefined') {
  // Configuration and enums
  globalThis.SessionConfig = SessionConfig;
  globalThis.SessionStatus = SessionStatus;
  globalThis.EvidenceLinkType = EvidenceLinkType;

  // Classes
  globalThis.EvidenceSession = EvidenceSession;
  globalThis.SessionManager = SessionManager;

  // Factory function
  globalThis.getSessionManager = getSessionManager;

  // MCP commands
  globalThis.SessionCommands = SessionCommands;
  globalThis.executeSessionCommand = executeSessionCommand;
  globalThis.mcpStartEvidenceSession = mcpStartEvidenceSession;
  globalThis.mcpGetEvidenceSession = mcpGetEvidenceSession;
  globalThis.mcpAddToSession = mcpAddToSession;
  globalThis.mcpCloseEvidenceSession = mcpCloseEvidenceSession;
  globalThis.mcpListEvidenceSessions = mcpListEvidenceSessions;
  globalThis.mcpExportEvidenceSession = mcpExportEvidenceSession;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Configuration and enums
    SessionConfig,
    SessionStatus,
    EvidenceLinkType,

    // Classes
    EvidenceSession,
    SessionManager,

    // Factory function
    getSessionManager,

    // MCP commands
    SessionCommands,
    executeSessionCommand,
    mcpStartEvidenceSession,
    mcpGetEvidenceSession,
    mcpAddToSession,
    mcpCloseEvidenceSession,
    mcpListEvidenceSessions,
    mcpExportEvidenceSession
  };
}

// =============================================================================
// Collaboration Integration (Phase 18.1)
// =============================================================================

/**
 * Collaboration managers integration
 * @type {Object}
 */
let collaborationManagers = {
  sharing: null,
  sync: null,
  comments: null,
  assignments: null,
  team: null
};

/**
 * Initialize collaboration features for a session
 * @param {string} sessionId - Session ID
 * @param {Object} options - Collaboration options
 * @returns {Promise<Object>} Initialization result
 */
async function initializeCollaboration(sessionId, options = {}) {
  const {
    enableSharing = true,
    enableSync = true,
    enableComments = true,
    enableAssignments = true,
    enableTeam = true,
    wsUrl = null,
    userId = null
  } = options;

  const results = {
    success: true,
    sessionId,
    features: {},
    errors: []
  };

  try {
    // Initialize sharing
    if (enableSharing && typeof SessionSharingManager !== 'undefined') {
      if (!collaborationManagers.sharing) {
        collaborationManagers.sharing = new SessionSharingManager();
      }
      results.features.sharing = true;
    }

    // Initialize real-time sync
    if (enableSync && typeof RealtimeSyncManager !== 'undefined' && wsUrl) {
      if (!collaborationManagers.sync) {
        collaborationManagers.sync = new RealtimeSyncManager({
          wsUrl,
          onSync: (syncData) => {
            // Forward sync events to session manager
            handleSyncEvent(syncData);
          },
          onPresenceUpdate: (presenceData) => {
            // Handle presence updates
            handlePresenceUpdate(presenceData);
          }
        });
      }

      // Connect to sync server
      const connectResult = await collaborationManagers.sync.connect();
      if (connectResult.success) {
        // Subscribe to session
        await collaborationManagers.sync.subscribeToSession(sessionId, userId);
        results.features.sync = true;
      } else {
        results.errors.push(`Sync connection failed: ${connectResult.error}`);
      }
    }

    // Initialize comments
    if (enableComments && typeof CommentManager !== 'undefined') {
      if (!collaborationManagers.comments) {
        collaborationManagers.comments = new CommentManager({
          onCommentAdded: (comment) => {
            // Sync comment to other users
            if (collaborationManagers.sync && collaborationManagers.sync.isConnected()) {
              collaborationManagers.sync.queueOperation(
                sessionId,
                'comment_added',
                comment
              );
            }
          }
        });
      }
      results.features.comments = true;
    }

    // Initialize assignments
    if (enableAssignments && typeof AssignmentManager !== 'undefined') {
      if (!collaborationManagers.assignments) {
        collaborationManagers.assignments = new AssignmentManager({
          onAssignmentCreated: (assignment) => {
            // Sync assignment to other users
            if (collaborationManagers.sync && collaborationManagers.sync.isConnected()) {
              collaborationManagers.sync.queueOperation(
                sessionId,
                'assignment_created',
                assignment
              );
            }
          }
        });
      }
      results.features.assignments = true;
    }

    // Initialize team management
    if (enableTeam && typeof TeamManager !== 'undefined') {
      if (!collaborationManagers.team) {
        collaborationManagers.team = new TeamManager({
          onMemberAdded: (data) => {
            // Sync team changes
            if (collaborationManagers.sync && collaborationManagers.sync.isConnected()) {
              collaborationManagers.sync.queueOperation(
                sessionId,
                'member_joined',
                data
              );
            }
          },
          onActivity: (activity) => {
            // Record activity in session
            recordSessionActivity(sessionId, activity);
          }
        });
      }
      results.features.team = true;
    }

    console.log('[SessionManager] Collaboration features initialized:', results.features);
  } catch (error) {
    results.success = false;
    results.errors.push(error.message);
    console.error('[SessionManager] Collaboration initialization error:', error);
  }

  return results;
}

/**
 * Handle sync event from real-time sync
 * @param {Object} syncData - Sync event data
 */
function handleSyncEvent(syncData) {
  const { eventType, sessionId, data, userId } = syncData;

  console.log(`[SessionManager] Sync event: ${eventType} for session ${sessionId}`);

  // Forward to appropriate manager
  switch (eventType) {
    case 'evidence_added':
      // Update session with new evidence
      break;
    case 'comment_added':
      if (collaborationManagers.comments) {
        // Comment already synced via manager
      }
      break;
    case 'assignment_created':
      if (collaborationManagers.assignments) {
        // Assignment already synced via manager
      }
      break;
    case 'member_joined':
    case 'member_left':
      if (collaborationManagers.team) {
        // Team change already handled
      }
      break;
  }
}

/**
 * Handle presence update
 * @param {Object} presenceData - Presence data
 */
function handlePresenceUpdate(presenceData) {
  console.log('[SessionManager] Presence update:', presenceData);
  // Could trigger UI updates here
}

/**
 * Record session activity
 * @param {string} sessionId - Session ID
 * @param {Object} activity - Activity data
 */
function recordSessionActivity(sessionId, activity) {
  if (collaborationManagers.team) {
    collaborationManagers.team.recordActivity(sessionId, activity);
  }
}

/**
 * Get collaboration managers
 * @returns {Object} Collaboration managers
 */
function getCollaborationManagers() {
  return collaborationManagers;
}

/**
 * MCP Command: Share session
 * @param {Object} params - Command parameters
 * @returns {Promise<Object>} Command result
 */
async function mcpShareSession(params) {
  const {
    session_id,
    share_type = 'temporary',
    permission = 'viewer',
    password = null,
    expires_in_hours = null
  } = params;

  if (!session_id) {
    return {
      success: false,
      error: 'session_id is required',
      command: 'share_session',
      timestamp: Date.now()
    };
  }

  if (!collaborationManagers.sharing) {
    return {
      success: false,
      error: 'Sharing not initialized',
      command: 'share_session',
      timestamp: Date.now()
    };
  }

  const result = await collaborationManagers.sharing.createShareLink(session_id, {
    shareType: share_type,
    permission,
    password,
    expiresInHours: expires_in_hours
  });

  return {
    ...result,
    command: 'share_session'
  };
}

/**
 * MCP Command: Add comment
 * @param {Object} params - Command parameters
 * @returns {Promise<Object>} Command result
 */
async function mcpAddComment(params) {
  const {
    session_id,
    evidence_id = null,
    parent_id = null,
    content,
    author_id,
    author_name
  } = params;

  if (!session_id || !content) {
    return {
      success: false,
      error: 'session_id and content are required',
      command: 'add_comment',
      timestamp: Date.now()
    };
  }

  if (!collaborationManagers.comments) {
    return {
      success: false,
      error: 'Comments not initialized',
      command: 'add_comment',
      timestamp: Date.now()
    };
  }

  const result = await collaborationManagers.comments.addComment(session_id, content, {
    evidenceId: evidence_id,
    parentId: parent_id,
    authorId: author_id,
    authorName: author_name
  });

  return {
    ...result,
    command: 'add_comment'
  };
}

/**
 * MCP Command: Assign evidence
 * @param {Object} params - Command parameters
 * @returns {Promise<Object>} Command result
 */
async function mcpAssignEvidence(params) {
  const {
    session_id,
    evidence_id,
    assigned_to,
    assigned_by,
    title,
    description,
    priority = 'medium',
    due_date = null
  } = params;

  if (!session_id || !evidence_id || !assigned_to) {
    return {
      success: false,
      error: 'session_id, evidence_id, and assigned_to are required',
      command: 'assign_evidence',
      timestamp: Date.now()
    };
  }

  if (!collaborationManagers.assignments) {
    return {
      success: false,
      error: 'Assignments not initialized',
      command: 'assign_evidence',
      timestamp: Date.now()
    };
  }

  const result = await collaborationManagers.assignments.createAssignment({
    sessionId: session_id,
    evidenceId: evidence_id,
    assignedTo: assigned_to,
    assignedBy: assigned_by,
    title,
    description,
    priority,
    dueDate: due_date
  });

  return {
    ...result,
    command: 'assign_evidence'
  };
}

/**
 * MCP Command: Invite team member
 * @param {Object} params - Command parameters
 * @returns {Promise<Object>} Command result
 */
async function mcpInviteTeamMember(params) {
  const {
    session_id,
    email,
    role = 'viewer',
    invited_by
  } = params;

  if (!session_id || !email) {
    return {
      success: false,
      error: 'session_id and email are required',
      command: 'invite_team_member',
      timestamp: Date.now()
    };
  }

  if (!collaborationManagers.team) {
    return {
      success: false,
      error: 'Team management not initialized',
      command: 'invite_team_member',
      timestamp: Date.now()
    };
  }

  const result = await collaborationManagers.team.sendInvite(session_id, {
    email,
    role,
    invitedBy: invited_by
  });

  return {
    ...result,
    command: 'invite_team_member'
  };
}

// Add collaboration commands to SessionCommands
SessionCommands.share_session = mcpShareSession;
SessionCommands.add_comment = mcpAddComment;
SessionCommands.assign_evidence = mcpAssignEvidence;
SessionCommands.invite_team_member = mcpInviteTeamMember;

// Export collaboration functions
if (typeof globalThis !== 'undefined') {
  globalThis.initializeCollaboration = initializeCollaboration;
  globalThis.getCollaborationManagers = getCollaborationManagers;
  globalThis.mcpShareSession = mcpShareSession;
  globalThis.mcpAddComment = mcpAddComment;
  globalThis.mcpAssignEvidence = mcpAssignEvidence;
  globalThis.mcpInviteTeamMember = mcpInviteTeamMember;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports.initializeCollaboration = initializeCollaboration;
  module.exports.getCollaborationManagers = getCollaborationManagers;
  module.exports.mcpShareSession = mcpShareSession;
  module.exports.mcpAddComment = mcpAddComment;
  module.exports.mcpAssignEvidence = mcpAssignEvidence;
  module.exports.mcpInviteTeamMember = mcpInviteTeamMember;
}

console.log('[SessionManager] Collaboration integration loaded');
