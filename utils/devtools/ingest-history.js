/**
 * Basset Hound Browser Automation - Ingest History Tracker
 * Phase 15.2: History & Analytics Features
 *
 * Tracks ingestion history with persistence to Chrome storage.
 * Records all ingested OSINT items with metadata for later analysis.
 *
 * Features:
 * - Store ingestion events with full context
 * - Filter history by date, type, page, status
 * - Export history to JSON/CSV formats
 * - Manage storage quota (50MB limit)
 * - Clean/purge old history
 * - Search and pagination
 *
 * Storage Structure:
 * chrome.storage.local['ingest_history'] = {
 *   version: '1.0',
 *   items: [...],
 *   stats: { ... },
 *   lastUpdated: timestamp
 * }
 */

// =============================================================================
// Constants & Configuration
// =============================================================================

const HISTORY_CONFIG = {
  STORAGE_KEY: 'ingest_history',
  STATS_KEY: 'ingest_stats',
  MAX_ITEMS: 10000,              // Maximum history items to store
  MAX_AGE_DAYS: 90,              // Auto-delete items older than 90 days
  STORAGE_QUOTA_MB: 45,          // Use max 45MB (Chrome allows ~50MB)
  VERSION: '1.0',
  BATCH_SIZE: 100,               // Items per batch for processing
  EXPORT_CHUNK_SIZE: 500         // Items per chunk when exporting
};

/**
 * Ingestion event types
 */
const IngestEventType = {
  MANUAL: 'manual',              // User manually ingested
  AUTO: 'auto',                  // Auto-detected and ingested
  BATCH: 'batch',                // Part of batch operation
  VERIFIED: 'verified',          // After verification
  IMPORTED: 'imported'           // Imported from external source
};

/**
 * Ingestion status
 */
const IngestStatus = {
  SUCCESS: 'success',            // Successfully ingested
  FAILED: 'failed',              // Failed to ingest
  PENDING: 'pending',            // Queued for ingestion
  SKIPPED: 'skipped',            // Skipped (duplicate, invalid, etc.)
  VERIFIED: 'verified'           // Successfully verified
};

// =============================================================================
// IngestHistory Class
// =============================================================================

/**
 * Manages ingestion history with persistence and analytics
 */
class IngestHistory {
  constructor() {
    this.items = [];
    this.stats = this._initStats();
    this.version = HISTORY_CONFIG.VERSION;
    this.lastUpdated = null;
    this.loaded = false;
    this.storageWarning = false;

    // Event listeners for changes
    this.listeners = [];

    // Initialize
    this._init();
  }

  /**
   * Initialize history by loading from storage
   */
  async _init() {
    try {
      await this.load();
      this.loaded = true;

      // Clean old items on startup
      await this.cleanOldItems();

      // Check storage usage
      await this._checkStorageQuota();
    } catch (error) {
      console.error('[IngestHistory] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize stats object
   */
  _initStats() {
    return {
      totalIngested: 0,
      totalSuccess: 0,
      totalFailed: 0,
      totalSkipped: 0,
      byType: {},              // Count by pattern type
      byPage: {},              // Count by page URL
      byDate: {},              // Count by date (YYYY-MM-DD)
      byStatus: {
        success: 0,
        failed: 0,
        pending: 0,
        skipped: 0,
        verified: 0
      },
      firstIngestion: null,
      lastIngestion: null
    };
  }

  /**
   * Add ingestion event to history
   */
  async addItem(item) {
    try {
      const historyItem = {
        id: this._generateId(),
        timestamp: Date.now(),
        type: item.type || 'unknown',
        value: item.value,
        status: item.status || IngestStatus.SUCCESS,
        eventType: item.eventType || IngestEventType.MANUAL,

        // Page context
        pageUrl: item.pageUrl || window.location?.href,
        pageTitle: item.pageTitle || document?.title,
        pageId: item.pageId || null,

        // Detection metadata
        confidence: item.confidence || null,
        pattern: item.pattern || null,
        selector: item.selector || null,
        elementText: item.elementText || null,

        // Verification data
        verified: item.verified || false,
        verificationResult: item.verificationResult || null,
        verificationTimestamp: item.verificationTimestamp || null,

        // Session context
        sessionId: item.sessionId || null,
        caseId: item.caseId || null,
        investigator: item.investigator || null,

        // Tags and notes
        tags: item.tags || [],
        notes: item.notes || null,

        // Error info (if failed)
        error: item.error || null,
        errorMessage: item.errorMessage || null
      };

      // Add to items array
      this.items.unshift(historyItem); // Most recent first

      // Enforce max items limit
      if (this.items.length > HISTORY_CONFIG.MAX_ITEMS) {
        this.items = this.items.slice(0, HISTORY_CONFIG.MAX_ITEMS);
      }

      // Update stats
      this._updateStats(historyItem);

      // Save to storage
      await this.save();

      // Notify listeners
      this._notifyListeners('added', historyItem);

      return historyItem;
    } catch (error) {
      console.error('[IngestHistory] Failed to add item:', error);
      throw error;
    }
  }

  /**
   * Add multiple items in batch
   */
  async addBatch(items) {
    const results = [];

    for (const item of items) {
      try {
        const historyItem = await this.addItem({
          ...item,
          eventType: IngestEventType.BATCH
        });
        results.push(historyItem);
      } catch (error) {
        console.error('[IngestHistory] Failed to add batch item:', error);
        results.push({ error: error.message, item });
      }
    }

    return results;
  }

  /**
   * Update stats after adding item
   */
  _updateStats(item) {
    // Total counts
    this.stats.totalIngested++;

    // Status counts
    if (item.status === IngestStatus.SUCCESS) this.stats.totalSuccess++;
    if (item.status === IngestStatus.FAILED) this.stats.totalFailed++;
    if (item.status === IngestStatus.SKIPPED) this.stats.totalSkipped++;

    this.stats.byStatus[item.status] = (this.stats.byStatus[item.status] || 0) + 1;

    // By type
    this.stats.byType[item.type] = (this.stats.byType[item.type] || 0) + 1;

    // By page
    if (item.pageUrl) {
      this.stats.byPage[item.pageUrl] = (this.stats.byPage[item.pageUrl] || 0) + 1;
    }

    // By date
    const date = new Date(item.timestamp).toISOString().split('T')[0];
    this.stats.byDate[date] = (this.stats.byDate[date] || 0) + 1;

    // First/last ingestion
    if (!this.stats.firstIngestion) {
      this.stats.firstIngestion = item.timestamp;
    }
    this.stats.lastIngestion = item.timestamp;

    this.lastUpdated = Date.now();
  }

  /**
   * Get history items with filters and pagination
   */
  getItems(options = {}) {
    let filtered = [...this.items];

    // Filter by type
    if (options.type) {
      filtered = filtered.filter(item => item.type === options.type);
    }

    // Filter by status
    if (options.status) {
      filtered = filtered.filter(item => item.status === options.status);
    }

    // Filter by page URL (exact or contains)
    if (options.pageUrl) {
      if (options.exactPage) {
        filtered = filtered.filter(item => item.pageUrl === options.pageUrl);
      } else {
        filtered = filtered.filter(item =>
          item.pageUrl && item.pageUrl.includes(options.pageUrl)
        );
      }
    }

    // Filter by date range
    if (options.startDate) {
      const startTime = new Date(options.startDate).getTime();
      filtered = filtered.filter(item => item.timestamp >= startTime);
    }
    if (options.endDate) {
      const endTime = new Date(options.endDate).getTime();
      filtered = filtered.filter(item => item.timestamp <= endTime);
    }

    // Filter by session
    if (options.sessionId) {
      filtered = filtered.filter(item => item.sessionId === options.sessionId);
    }

    // Filter by case
    if (options.caseId) {
      filtered = filtered.filter(item => item.caseId === options.caseId);
    }

    // Filter by verified status
    if (options.verified !== undefined) {
      filtered = filtered.filter(item => item.verified === options.verified);
    }

    // Search by value or notes
    if (options.search) {
      const search = options.search.toLowerCase();
      filtered = filtered.filter(item =>
        (item.value && item.value.toLowerCase().includes(search)) ||
        (item.notes && item.notes.toLowerCase().includes(search)) ||
        (item.pageTitle && item.pageTitle.toLowerCase().includes(search))
      );
    }

    // Sort
    if (options.sortBy) {
      filtered.sort((a, b) => {
        const aVal = a[options.sortBy];
        const bVal = b[options.sortBy];
        const direction = options.sortDesc ? -1 : 1;

        if (aVal < bVal) return -1 * direction;
        if (aVal > bVal) return 1 * direction;
        return 0;
      });
    }

    // Pagination
    const total = filtered.length;
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    const paginated = filtered.slice(offset, offset + limit);

    return {
      items: paginated,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    };
  }

  /**
   * Get single item by ID
   */
  getItem(id) {
    return this.items.find(item => item.id === id);
  }

  /**
   * Update existing item
   */
  async updateItem(id, updates) {
    const index = this.items.findIndex(item => item.id === id);

    if (index === -1) {
      throw new Error(`Item ${id} not found`);
    }

    const oldItem = this.items[index];
    this.items[index] = {
      ...oldItem,
      ...updates,
      id: oldItem.id, // Don't allow ID change
      timestamp: oldItem.timestamp, // Don't allow timestamp change
      updatedAt: Date.now()
    };

    await this.save();
    this._notifyListeners('updated', this.items[index]);

    return this.items[index];
  }

  /**
   * Delete item by ID
   */
  async deleteItem(id) {
    const index = this.items.findIndex(item => item.id === id);

    if (index === -1) {
      throw new Error(`Item ${id} not found`);
    }

    const deleted = this.items.splice(index, 1)[0];

    // Recalculate stats
    this.stats = this._recalculateStats();

    await this.save();
    this._notifyListeners('deleted', deleted);

    return deleted;
  }

  /**
   * Delete multiple items by filter
   */
  async deleteItems(filter) {
    const toDelete = this.getItems(filter).items;
    const ids = toDelete.map(item => item.id);

    for (const id of ids) {
      await this.deleteItem(id);
    }

    return toDelete.length;
  }

  /**
   * Clear all history
   */
  async clearAll() {
    const count = this.items.length;
    this.items = [];
    this.stats = this._initStats();
    this.lastUpdated = Date.now();

    await this.save();
    this._notifyListeners('cleared', { count });

    return count;
  }

  /**
   * Clean old items (older than MAX_AGE_DAYS)
   */
  async cleanOldItems() {
    const cutoffTime = Date.now() - (HISTORY_CONFIG.MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

    const beforeCount = this.items.length;
    this.items = this.items.filter(item => item.timestamp >= cutoffTime);
    const afterCount = this.items.length;
    const removed = beforeCount - afterCount;

    if (removed > 0) {
      this.stats = this._recalculateStats();
      await this.save();
      console.log(`[IngestHistory] Cleaned ${removed} old items`);
    }

    return removed;
  }

  /**
   * Recalculate stats from scratch
   */
  _recalculateStats() {
    const stats = this._initStats();

    for (const item of this.items) {
      stats.totalIngested++;

      if (item.status === IngestStatus.SUCCESS) stats.totalSuccess++;
      if (item.status === IngestStatus.FAILED) stats.totalFailed++;
      if (item.status === IngestStatus.SKIPPED) stats.totalSkipped++;

      stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1;
      stats.byType[item.type] = (stats.byType[item.type] || 0) + 1;

      if (item.pageUrl) {
        stats.byPage[item.pageUrl] = (stats.byPage[item.pageUrl] || 0) + 1;
      }

      const date = new Date(item.timestamp).toISOString().split('T')[0];
      stats.byDate[date] = (stats.byDate[date] || 0) + 1;

      if (!stats.firstIngestion || item.timestamp < stats.firstIngestion) {
        stats.firstIngestion = item.timestamp;
      }
      if (!stats.lastIngestion || item.timestamp > stats.lastIngestion) {
        stats.lastIngestion = item.timestamp;
      }
    }

    return stats;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      itemCount: this.items.length,
      storageUsed: this._estimateStorageSize(),
      storageWarning: this.storageWarning
    };
  }

  /**
   * Export history to JSON
   */
  exportJSON(filter = {}) {
    const items = this.getItems(filter).items;

    return {
      version: this.version,
      exportDate: new Date().toISOString(),
      itemCount: items.length,
      filter,
      stats: this.getStats(),
      items
    };
  }

  /**
   * Export history to CSV
   */
  exportCSV(filter = {}) {
    const items = this.getItems(filter).items;

    if (items.length === 0) {
      return 'No items to export';
    }

    // CSV headers
    const headers = [
      'ID', 'Timestamp', 'Date', 'Type', 'Value', 'Status', 'Event Type',
      'Page URL', 'Page Title', 'Confidence', 'Verified', 'Session ID',
      'Case ID', 'Tags', 'Notes', 'Error'
    ];

    // CSV rows
    const rows = items.map(item => [
      item.id,
      item.timestamp,
      new Date(item.timestamp).toISOString(),
      item.type,
      `"${(item.value || '').replace(/"/g, '""')}"`, // Escape quotes
      item.status,
      item.eventType,
      `"${(item.pageUrl || '').replace(/"/g, '""')}"`,
      `"${(item.pageTitle || '').replace(/"/g, '""')}"`,
      item.confidence || '',
      item.verified ? 'Yes' : 'No',
      item.sessionId || '',
      item.caseId || '',
      `"${(item.tags || []).join(', ')}"`,
      `"${(item.notes || '').replace(/"/g, '""')}"`,
      `"${(item.errorMessage || '').replace(/"/g, '""')}"`
    ]);

    // Combine
    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    return csv;
  }

  /**
   * Import history from JSON
   */
  async importJSON(data) {
    if (!data || !data.items) {
      throw new Error('Invalid import data');
    }

    const imported = [];

    for (const item of data.items) {
      try {
        const historyItem = await this.addItem({
          ...item,
          eventType: IngestEventType.IMPORTED
        });
        imported.push(historyItem);
      } catch (error) {
        console.error('[IngestHistory] Failed to import item:', error);
      }
    }

    return {
      total: data.items.length,
      imported: imported.length,
      failed: data.items.length - imported.length
    };
  }

  /**
   * Save to Chrome storage
   */
  async save() {
    try {
      const data = {
        version: this.version,
        items: this.items,
        stats: this.stats,
        lastUpdated: Date.now()
      };

      await chrome.storage.local.set({
        [HISTORY_CONFIG.STORAGE_KEY]: data
      });

      await this._checkStorageQuota();
    } catch (error) {
      console.error('[IngestHistory] Failed to save:', error);
      throw error;
    }
  }

  /**
   * Load from Chrome storage
   */
  async load() {
    try {
      const result = await chrome.storage.local.get(HISTORY_CONFIG.STORAGE_KEY);
      const data = result[HISTORY_CONFIG.STORAGE_KEY];

      if (data) {
        this.version = data.version || HISTORY_CONFIG.VERSION;
        this.items = data.items || [];
        this.stats = data.stats || this._initStats();
        this.lastUpdated = data.lastUpdated;
      } else {
        // Initialize with empty data
        this.items = [];
        this.stats = this._initStats();
        this.lastUpdated = null;
      }
    } catch (error) {
      console.error('[IngestHistory] Failed to load:', error);
      throw error;
    }
  }

  /**
   * Check storage quota and set warning if needed
   */
  async _checkStorageQuota() {
    try {
      const bytesInUse = await chrome.storage.local.getBytesInUse(HISTORY_CONFIG.STORAGE_KEY);
      const mbInUse = bytesInUse / (1024 * 1024);

      this.storageWarning = mbInUse > HISTORY_CONFIG.STORAGE_QUOTA_MB;

      if (this.storageWarning) {
        console.warn(`[IngestHistory] Storage quota warning: ${mbInUse.toFixed(2)}MB used`);
      }
    } catch (error) {
      console.error('[IngestHistory] Failed to check storage quota:', error);
    }
  }

  /**
   * Estimate storage size in bytes
   */
  _estimateStorageSize() {
    try {
      const json = JSON.stringify({
        items: this.items,
        stats: this.stats
      });
      return json.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Generate unique ID
   */
  _generateId() {
    return `ih_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add change listener
   */
  addListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * Remove change listener
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  /**
   * Notify listeners of changes
   */
  _notifyListeners(event, data) {
    for (const listener of this.listeners) {
      try {
        listener(event, data);
      } catch (error) {
        console.error('[IngestHistory] Listener error:', error);
      }
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    IngestHistory,
    IngestEventType,
    IngestStatus,
    HISTORY_CONFIG
  };
}
