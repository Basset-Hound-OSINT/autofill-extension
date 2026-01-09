/**
 * Basset Hound Browser Automation - Chain of Custody Module
 * Phase 11.1: Evidence Bundling for Law Enforcement
 *
 * Provides comprehensive chain of custody tracking:
 * - Track every access to evidence (view, modify, export, share)
 * - Record timestamp, user ID, action, IP address
 * - Record hash before and after any modification
 * - Support notes for each entry
 * - Export to audit-friendly format
 */

// =============================================================================
// Chain of Custody Action Types
// =============================================================================

const CustodyAction = {
  CAPTURED: 'captured',
  VIEWED: 'viewed',
  MODIFIED: 'modified',
  EXPORTED: 'exported',
  SHARED: 'shared',
  TRANSFERRED: 'transferred',
  VERIFIED: 'verified',
  SEALED: 'sealed',
  UNSEALED: 'unsealed',
  ARCHIVED: 'archived',
  RESTORED: 'restored',
  DELETED: 'deleted',
  ANNOTATED: 'annotated',
  REDACTED: 'redacted',
  DUPLICATED: 'duplicated'
};

// =============================================================================
// ChainOfCustody Class
// =============================================================================

/**
 * ChainOfCustody - Comprehensive chain of custody tracking for digital evidence
 * Tracks every access and modification to evidence with full audit trail
 */
class ChainOfCustody {
  /**
   * Create a ChainOfCustody instance
   * @param {Object} options - Configuration options
   * @param {string} options.evidenceId - ID of the evidence being tracked
   * @param {string} options.initialHash - Initial hash of the evidence
   * @param {string} options.createdBy - User ID who created the evidence
   * @param {Object} options.logger - Logger instance
   * @param {boolean} options.autoTimestamp - Auto-add timestamps (default: true)
   */
  constructor(options = {}) {
    this.config = {
      evidenceId: options.evidenceId || null,
      initialHash: options.initialHash || null,
      createdBy: options.createdBy || null,
      logger: options.logger || null,
      autoTimestamp: options.autoTimestamp !== false
    };

    // Chain of custody records
    this.records = [];

    // Metadata
    this.metadata = {
      createdAt: Date.now(),
      lastModifiedAt: null,
      totalRecords: 0,
      hashHistory: []
    };

    // Initialize with creation record if we have initial data
    if (this.config.evidenceId && this.config.initialHash) {
      this._addInitialRecord();
    }
  }

  // ===========================================================================
  // Record Management Methods
  // ===========================================================================

  /**
   * Record an access or action on the evidence
   * @param {string} action - Action type from CustodyAction
   * @param {Object} details - Action details
   * @param {string} details.userID - User performing the action
   * @param {string} details.notes - Notes about the action
   * @param {string} details.hashBefore - Hash before the action
   * @param {string} details.hashAfter - Hash after the action
   * @param {string} details.ipAddress - IP address of the user
   * @param {Object} details.additionalData - Any additional data to record
   * @returns {Object} Result with record index
   */
  recordAccess(action, details = {}) {
    const {
      userID = null,
      notes = null,
      hashBefore = this._getCurrentHash(),
      hashAfter = null,
      ipAddress = null,
      additionalData = null
    } = details;

    // Validate action
    if (!Object.values(CustodyAction).includes(action)) {
      this._log('warn', 'Unknown custody action: ' + action);
    }

    const record = {
      index: this.records.length,
      timestamp: Date.now(),
      timestampISO: new Date().toISOString(),
      action,
      userID,
      notes,
      hashBefore,
      hashAfter: hashAfter || hashBefore,
      ipAddress,
      additionalData,
      evidenceId: this.config.evidenceId
    };

    this.records.push(record);
    this.metadata.totalRecords++;
    this.metadata.lastModifiedAt = record.timestamp;

    // Track hash changes
    if (hashAfter && hashAfter !== hashBefore) {
      this.metadata.hashHistory.push({
        timestamp: record.timestamp,
        oldHash: hashBefore,
        newHash: hashAfter,
        action,
        recordIndex: record.index
      });
    }

    this._log('info', 'Custody record added: ' + action + ' by ' + userID);

    return {
      success: true,
      recordIndex: record.index,
      record,
      timestamp: Date.now()
    };
  }

  /**
   * Record a view access
   * @param {string} userID - User viewing the evidence
   * @param {Object} options - Additional options
   * @returns {Object} Result
   */
  recordView(userID, options = {}) {
    return this.recordAccess(CustodyAction.VIEWED, {
      userID,
      notes: options.notes || 'Evidence viewed',
      ipAddress: options.ipAddress,
      additionalData: options.additionalData
    });
  }

  /**
   * Record a modification
   * @param {string} userID - User modifying the evidence
   * @param {string} hashBefore - Hash before modification
   * @param {string} hashAfter - Hash after modification
   * @param {Object} options - Additional options
   * @returns {Object} Result
   */
  recordModification(userID, hashBefore, hashAfter, options = {}) {
    return this.recordAccess(CustodyAction.MODIFIED, {
      userID,
      hashBefore,
      hashAfter,
      notes: options.notes || 'Evidence modified',
      ipAddress: options.ipAddress,
      additionalData: options.additionalData
    });
  }

  /**
   * Record an export
   * @param {string} userID - User exporting the evidence
   * @param {Object} options - Export options
   * @returns {Object} Result
   */
  recordExport(userID, options = {}) {
    return this.recordAccess(CustodyAction.EXPORTED, {
      userID,
      notes: options.notes || 'Evidence exported',
      ipAddress: options.ipAddress,
      additionalData: {
        format: options.format || 'json',
        destination: options.destination,
        includeData: options.includeData !== false,
        ...options.additionalData
      }
    });
  }

  /**
   * Record a share action
   * @param {string} userID - User sharing the evidence
   * @param {string} recipientID - Recipient of the share
   * @param {Object} options - Share options
   * @returns {Object} Result
   */
  recordShare(userID, recipientID, options = {}) {
    return this.recordAccess(CustodyAction.SHARED, {
      userID,
      notes: options.notes || 'Evidence shared with ' + recipientID,
      ipAddress: options.ipAddress,
      additionalData: {
        recipientID,
        permissions: options.permissions || ['view'],
        expiresAt: options.expiresAt,
        ...options.additionalData
      }
    });
  }

  /**
   * Record a transfer of custody
   * @param {string} fromUserID - User transferring custody
   * @param {string} toUserID - User receiving custody
   * @param {Object} options - Transfer options
   * @returns {Object} Result
   */
  recordTransfer(fromUserID, toUserID, options = {}) {
    return this.recordAccess(CustodyAction.TRANSFERRED, {
      userID: fromUserID,
      notes: options.notes || 'Custody transferred to ' + toUserID,
      ipAddress: options.ipAddress,
      additionalData: {
        fromUserID,
        toUserID,
        reason: options.reason,
        ...options.additionalData
      }
    });
  }

  /**
   * Record verification of evidence
   * @param {string} userID - User verifying
   * @param {boolean} isValid - Whether verification passed
   * @param {string} currentHash - Current hash of evidence
   * @param {Object} options - Verification options
   * @returns {Object} Result
   */
  recordVerification(userID, isValid, currentHash, options = {}) {
    return this.recordAccess(CustodyAction.VERIFIED, {
      userID,
      hashBefore: this._getCurrentHash(),
      hashAfter: currentHash,
      notes: options.notes || (isValid ? 'Integrity verified successfully' : 'VERIFICATION FAILED - Integrity compromised'),
      ipAddress: options.ipAddress,
      additionalData: {
        isValid,
        expectedHash: this._getCurrentHash(),
        actualHash: currentHash,
        ...options.additionalData
      }
    });
  }

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * Get all custody records
   * @param {Object} options - Filter options
   * @returns {Object} Records with pagination
   */
  getRecords(options = {}) {
    const {
      action = null,
      userID = null,
      since = 0,
      until = Date.now(),
      limit = 100,
      offset = 0
    } = options;

    let filtered = [...this.records];

    // Apply filters
    if (action) {
      filtered = filtered.filter(r => r.action === action);
    }
    if (userID) {
      filtered = filtered.filter(r => r.userID === userID);
    }
    filtered = filtered.filter(r => r.timestamp >= since && r.timestamp <= until);

    // Sort by timestamp (newest first by default)
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    // Pagination
    const totalCount = filtered.length;
    filtered = filtered.slice(offset, offset + limit);

    return {
      success: true,
      records: filtered,
      pagination: {
        total: totalCount,
        offset,
        limit,
        returned: filtered.length
      },
      timestamp: Date.now()
    };
  }

  /**
   * Get the latest record
   * @returns {Object} Latest record or null
   */
  getLatestRecord() {
    if (this.records.length === 0) {
      return { success: false, error: 'No records found', timestamp: Date.now() };
    }
    return {
      success: true,
      record: this.records[this.records.length - 1],
      timestamp: Date.now()
    };
  }

  /**
   * Get record by index
   * @param {number} index - Record index
   * @returns {Object} Record or error
   */
  getRecordByIndex(index) {
    if (index < 0 || index >= this.records.length) {
      return { success: false, error: 'Record not found', index, timestamp: Date.now() };
    }
    return {
      success: true,
      record: this.records[index],
      timestamp: Date.now()
    };
  }

  /**
   * Get records by action type
   * @param {string} action - Action type
   * @returns {Object} Matching records
   */
  getRecordsByAction(action) {
    return this.getRecords({ action });
  }

  /**
   * Get records by user
   * @param {string} userID - User ID
   * @returns {Object} Matching records
   */
  getRecordsByUser(userID) {
    return this.getRecords({ userID });
  }

  /**
   * Get hash history
   * @returns {Object} Hash change history
   */
  getHashHistory() {
    return {
      success: true,
      history: [...this.metadata.hashHistory],
      currentHash: this._getCurrentHash(),
      totalChanges: this.metadata.hashHistory.length,
      timestamp: Date.now()
    };
  }

  /**
   * Check if evidence has been modified
   * @param {string} originalHash - Original hash to compare
   * @returns {Object} Modification status
   */
  hasBeenModified(originalHash) {
    const currentHash = this._getCurrentHash();
    const modified = currentHash !== originalHash;

    return {
      success: true,
      modified,
      originalHash,
      currentHash,
      modificationCount: this.metadata.hashHistory.length,
      modifications: modified ? this.metadata.hashHistory : [],
      timestamp: Date.now()
    };
  }

  // ===========================================================================
  // Export Methods
  // ===========================================================================

  /**
   * Export chain of custody to audit-friendly format
   * @param {Object} options - Export options
   * @returns {Object} Exported data
   */
  exportAuditLog(options = {}) {
    const {
      format = 'json',
      includeMetadata = true,
      includeHashHistory = true
    } = options;

    const exportData = {
      exportInfo: {
        exportedAt: new Date().toISOString(),
        format,
        version: '1.0.0',
        standard: 'NIST-DF',
        generator: 'autofill-extension'
      },
      evidence: {
        evidenceId: this.config.evidenceId,
        initialHash: this.config.initialHash,
        currentHash: this._getCurrentHash(),
        createdBy: this.config.createdBy
      },
      chainOfCustody: this.records.map(r => ({
        index: r.index,
        timestamp: r.timestampISO,
        action: r.action,
        userID: r.userID,
        notes: r.notes,
        hashBefore: r.hashBefore,
        hashAfter: r.hashAfter,
        ipAddress: r.ipAddress
      })),
      summary: {
        totalRecords: this.records.length,
        firstRecord: this.records[0] ? this.records[0].timestampISO : null,
        lastRecord: this.records.length > 0 ? this.records[this.records.length - 1].timestampISO : null,
        uniqueUsers: [...new Set(this.records.map(r => r.userID).filter(Boolean))],
        actionCounts: this._getActionCounts()
      }
    };

    if (includeMetadata) {
      exportData.metadata = {
        createdAt: new Date(this.metadata.createdAt).toISOString(),
        lastModifiedAt: this.metadata.lastModifiedAt ? new Date(this.metadata.lastModifiedAt).toISOString() : null,
        totalRecords: this.metadata.totalRecords
      };
    }

    if (includeHashHistory) {
      exportData.hashHistory = this.metadata.hashHistory.map(h => ({
        timestamp: new Date(h.timestamp).toISOString(),
        oldHash: h.oldHash,
        newHash: h.newHash,
        action: h.action,
        recordIndex: h.recordIndex
      }));
    }

    // Format as CSV if requested
    if (format === 'csv') {
      return {
        success: true,
        data: this._toCSV(exportData.chainOfCustody),
        mimeType: 'text/csv',
        filename: 'chain_of_custody_' + this.config.evidenceId + '_' + Date.now() + '.csv',
        timestamp: Date.now()
      };
    }

    return {
      success: true,
      data: exportData,
      mimeType: 'application/json',
      filename: 'chain_of_custody_' + this.config.evidenceId + '_' + Date.now() + '.json',
      timestamp: Date.now()
    };
  }

  /**
   * Export to NIST Digital Forensics format
   * @returns {Object} NIST-DF formatted export
   */
  exportNISTFormat() {
    return {
      success: true,
      data: {
        'NIST-DF': {
          version: '1.0',
          evidenceItem: {
            id: this.config.evidenceId,
            originalHash: {
              algorithm: 'SHA-256',
              value: this.config.initialHash
            },
            currentHash: {
              algorithm: 'SHA-256',
              value: this._getCurrentHash()
            }
          },
          custodyChain: this.records.map(r => ({
            sequenceNumber: r.index + 1,
            dateTime: r.timestampISO,
            actionType: r.action,
            custodian: {
              id: r.userID,
              ipAddress: r.ipAddress
            },
            integrity: {
              hashBefore: r.hashBefore,
              hashAfter: r.hashAfter,
              verified: r.hashBefore === r.hashAfter || r.action === CustodyAction.CAPTURED
            },
            notes: r.notes
          })),
          integrityReport: {
            totalCustodyEvents: this.records.length,
            hashChanges: this.metadata.hashHistory.length,
            integrityMaintained: this._checkIntegrity()
          }
        }
      },
      mimeType: 'application/json',
      filename: 'nist_df_custody_' + this.config.evidenceId + '_' + Date.now() + '.json',
      timestamp: Date.now()
    };
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Get metadata about the chain
   * @returns {Object} Chain metadata
   */
  getMetadata() {
    return {
      success: true,
      metadata: {
        ...this.metadata,
        evidenceId: this.config.evidenceId,
        initialHash: this.config.initialHash,
        currentHash: this._getCurrentHash(),
        createdBy: this.config.createdBy,
        recordCount: this.records.length
      },
      timestamp: Date.now()
    };
  }

  /**
   * Validate the chain integrity
   * @returns {Object} Validation result
   */
  validateChain() {
    const issues = [];

    // Check for gaps in indices
    for (let i = 0; i < this.records.length; i++) {
      if (this.records[i].index !== i) {
        issues.push({
          type: 'INDEX_GAP',
          message: 'Record index gap at position ' + i,
          expectedIndex: i,
          actualIndex: this.records[i].index
        });
      }
    }

    // Check for timestamp ordering
    for (let i = 1; i < this.records.length; i++) {
      if (this.records[i].timestamp < this.records[i - 1].timestamp) {
        issues.push({
          type: 'TIMESTAMP_ORDER',
          message: 'Timestamp order violation at record ' + i,
          recordIndex: i
        });
      }
    }

    // Check hash continuity
    for (let i = 1; i < this.records.length; i++) {
      const prevHash = this.records[i - 1].hashAfter;
      const currHash = this.records[i].hashBefore;
      if (prevHash && currHash && prevHash !== currHash) {
        issues.push({
          type: 'HASH_DISCONTINUITY',
          message: 'Hash discontinuity at record ' + i,
          recordIndex: i,
          expectedHash: prevHash,
          actualHash: currHash
        });
      }
    }

    return {
      success: true,
      valid: issues.length === 0,
      issues,
      recordCount: this.records.length,
      timestamp: Date.now()
    };
  }

  /**
   * Get a summary of the chain
   * @returns {Object} Chain summary
   */
  getSummary() {
    return {
      success: true,
      summary: {
        evidenceId: this.config.evidenceId,
        totalRecords: this.records.length,
        createdAt: new Date(this.metadata.createdAt).toISOString(),
        lastActivity: this.metadata.lastModifiedAt ? new Date(this.metadata.lastModifiedAt).toISOString() : null,
        uniqueUsers: [...new Set(this.records.map(r => r.userID).filter(Boolean))],
        actionCounts: this._getActionCounts(),
        hashChanges: this.metadata.hashHistory.length,
        integrityMaintained: this._checkIntegrity(),
        initialHash: this.config.initialHash,
        currentHash: this._getCurrentHash()
      },
      timestamp: Date.now()
    };
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Add initial creation record
   * @private
   */
  _addInitialRecord() {
    this.records.push({
      index: 0,
      timestamp: this.metadata.createdAt,
      timestampISO: new Date(this.metadata.createdAt).toISOString(),
      action: CustodyAction.CAPTURED,
      userID: this.config.createdBy,
      notes: 'Evidence captured and chain of custody initialized',
      hashBefore: null,
      hashAfter: this.config.initialHash,
      ipAddress: null,
      additionalData: null,
      evidenceId: this.config.evidenceId
    });
    this.metadata.totalRecords = 1;
  }

  /**
   * Get current hash (from latest record)
   * @private
   * @returns {string} Current hash
   */
  _getCurrentHash() {
    if (this.records.length === 0) {
      return this.config.initialHash;
    }
    return this.records[this.records.length - 1].hashAfter || this.config.initialHash;
  }

  /**
   * Get action counts
   * @private
   * @returns {Object} Action count map
   */
  _getActionCounts() {
    const counts = {};
    for (const record of this.records) {
      counts[record.action] = (counts[record.action] || 0) + 1;
    }
    return counts;
  }

  /**
   * Check if integrity has been maintained
   * @private
   * @returns {boolean} True if integrity maintained
   */
  _checkIntegrity() {
    // Check if any modifications changed the hash unexpectedly
    for (const change of this.metadata.hashHistory) {
      if (change.action !== CustodyAction.MODIFIED && change.action !== CustodyAction.ANNOTATED && change.action !== CustodyAction.REDACTED) {
        return false;
      }
    }
    return true;
  }

  /**
   * Convert records to CSV format
   * @private
   * @param {Array} records - Records to convert
   * @returns {string} CSV string
   */
  _toCSV(records) {
    const headers = ['Index', 'Timestamp', 'Action', 'User ID', 'Notes', 'Hash Before', 'Hash After', 'IP Address'];
    const rows = [headers.join(',')];

    for (const record of records) {
      const row = [
        record.index,
        '"' + record.timestamp + '"',
        record.action,
        '"' + (record.userID || '') + '"',
        '"' + (record.notes || '').replace(/"/g, '""') + '"',
        record.hashBefore || '',
        record.hashAfter || '',
        record.ipAddress || ''
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
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
      console[level]('[ChainOfCustody] ' + message);
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new ChainOfCustody instance for evidence
 * @param {string} evidenceId - Evidence ID
 * @param {string} initialHash - Initial hash of evidence
 * @param {string} createdBy - User creating the evidence
 * @param {Object} options - Additional options
 * @returns {ChainOfCustody} New instance
 */
function createChainOfCustody(evidenceId, initialHash, createdBy, options = {}) {
  return new ChainOfCustody({
    evidenceId,
    initialHash,
    createdBy,
    ...options
  });
}

// =============================================================================
// Exports
// =============================================================================

if (typeof globalThis !== 'undefined') {
  globalThis.CustodyAction = CustodyAction;
  globalThis.ChainOfCustody = ChainOfCustody;
  globalThis.createChainOfCustody = createChainOfCustody;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CustodyAction, ChainOfCustody, createChainOfCustody };
}
