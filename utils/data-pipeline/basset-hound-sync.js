/**
 * Basset Hound Browser Automation - Backend Sync
 * Phase 5.3: Data Pipeline Implementation
 *
 * Provides synchronization capabilities with the basset-hound backend:
 * - WebSocket-based real-time sync
 * - Batch entity synchronization
 * - Conflict resolution with timestamp-based strategy
 * - Offline queue for deferred sync
 * - Auto-sync with configurable intervals
 * - Entity update subscriptions
 */

// =============================================================================
// Sync Status Constants
// =============================================================================

/**
 * Sync status states
 */
const SyncStatus = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  SYNCING: 'syncing',
  ERROR: 'error',
  OFFLINE: 'offline'
};

/**
 * Sync operation types
 */
const SyncOperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  PULL: 'pull'
};

/**
 * Conflict resolution strategies
 */
const ConflictStrategy = {
  SERVER_WINS: 'server_wins',
  CLIENT_WINS: 'client_wins',
  LATEST_WINS: 'latest_wins',
  MANUAL: 'manual'
};

// =============================================================================
// BassetHoundSync Class
// =============================================================================

/**
 * Basset Hound Backend Sync Manager
 * Handles synchronization of entities with the basset-hound backend
 */
class BassetHoundSync {
  constructor(options = {}) {
    /**
     * Configuration options
     */
    this.config = {
      // Connection settings
      url: options.url || null,
      reconnectAttempts: options.reconnectAttempts || 5,
      reconnectDelay: options.reconnectDelay || 2000,
      connectionTimeout: options.connectionTimeout || 10000,

      // Sync settings
      batchSize: options.batchSize || 50,
      syncInterval: options.syncInterval || 30000, // 30 seconds default
      autoSyncEnabled: options.autoSyncEnabled || false,

      // Conflict resolution
      conflictStrategy: options.conflictStrategy || ConflictStrategy.LATEST_WINS,

      // Callbacks
      onStatusChange: options.onStatusChange || null,
      onSyncComplete: options.onSyncComplete || null,
      onConflict: options.onConflict || null,
      onError: options.onError || null
    };

    /**
     * Internal state
     */
    this.ws = null;
    this.status = SyncStatus.DISCONNECTED;
    this.lastSyncTime = null;
    this.lastError = null;
    this.reconnectCount = 0;
    this.reconnectTimeout = null;
    this.autoSyncInterval = null;
    this.pendingRequests = new Map();
    this.requestIdCounter = 0;

    /**
     * Offline queue for storing changes when disconnected
     */
    this.offlineQueue = [];

    /**
     * Entity update subscriptions
     */
    this.subscriptions = new Set();

    /**
     * Sync statistics
     */
    this.stats = {
      totalSynced: 0,
      totalPulled: 0,
      totalConflicts: 0,
      totalErrors: 0,
      lastSyncDuration: 0
    };
  }

  // ===========================================================================
  // Connection Management
  // ===========================================================================

  /**
   * Connect to basset-hound backend
   * @param {string} url - WebSocket URL to connect to
   * @returns {Promise<Object>} Connection result
   */
  async connect(url) {
    const connectUrl = url || this.config.url;

    if (!connectUrl) {
      return {
        success: false,
        error: 'WebSocket URL is required'
      };
    }

    // Store URL for reconnection
    this.config.url = connectUrl;

    // Check if already connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return {
        success: true,
        message: 'Already connected',
        status: this.status
      };
    }

    // Update status
    this._setStatus(SyncStatus.CONNECTING);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (this.ws) {
          this.ws.close();
        }
        this._setStatus(SyncStatus.ERROR);
        this.lastError = 'Connection timeout';
        resolve({
          success: false,
          error: 'Connection timeout'
        });
      }, this.config.connectionTimeout);

      try {
        this.ws = new WebSocket(connectUrl);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this._setStatus(SyncStatus.CONNECTED);
          this.reconnectCount = 0;
          this.lastError = null;

          // Send identification message
          this._sendMessage({
            type: 'sync_init',
            clientId: this._getClientId(),
            capabilities: {
              batchSync: true,
              subscriptions: true,
              conflictResolution: this.config.conflictStrategy
            },
            timestamp: Date.now()
          });

          // Process offline queue if any
          this._processOfflineQueue();

          // Resubscribe to entity types
          if (this.subscriptions.size > 0) {
            this._sendSubscriptions();
          }

          resolve({
            success: true,
            message: 'Connected successfully',
            status: this.status
          });
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          this._handleDisconnect(event);
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          this._handleError(error);
        };

        this.ws.onmessage = (event) => {
          this._handleMessage(event);
        };

      } catch (error) {
        clearTimeout(timeout);
        this._setStatus(SyncStatus.ERROR);
        this.lastError = error.message;
        resolve({
          success: false,
          error: error.message
        });
      }
    });
  }

  /**
   * Disconnect from backend
   * @returns {Object} Disconnect result
   */
  disconnect() {
    // Stop auto-sync
    this.enableAutoSync(false);

    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this._setStatus(SyncStatus.DISCONNECTED);
    this.reconnectCount = this.config.reconnectAttempts; // Prevent auto-reconnect

    return {
      success: true,
      message: 'Disconnected',
      offlineQueueSize: this.offlineQueue.length
    };
  }

  /**
   * Check if connected
   * @returns {boolean} True if connected
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  // ===========================================================================
  // Entity Sync Operations
  // ===========================================================================

  /**
   * Sync a single entity to backend
   * @param {Object} entity - Entity to sync
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} Sync result
   */
  async syncEntity(entity, options = {}) {
    const {
      operation = SyncOperationType.UPDATE,
      force = false
    } = options;

    if (!entity || !entity.id) {
      return {
        success: false,
        error: 'Entity with valid ID is required'
      };
    }

    // If offline, queue the change
    if (!this.isConnected()) {
      return this._queueOfflineChange({
        type: 'sync_entity',
        entity,
        operation,
        force,
        timestamp: Date.now()
      });
    }

    this._setStatus(SyncStatus.SYNCING);

    try {
      const result = await this._sendRequest({
        type: 'sync_entity',
        operation,
        entity: this._prepareEntityForSync(entity),
        force,
        clientTimestamp: Date.now()
      });

      this._setStatus(SyncStatus.CONNECTED);

      if (result.success) {
        this.stats.totalSynced++;
        this.lastSyncTime = Date.now();

        // Handle conflicts
        if (result.conflict) {
          return this._handleConflict(entity, result.serverEntity, operation);
        }
      }

      return result;

    } catch (error) {
      this._setStatus(SyncStatus.ERROR);
      this.lastError = error.message;
      this.stats.totalErrors++;

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Batch sync multiple entities
   * @param {Array<Object>} entities - Entities to sync
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} Batch sync result
   */
  async syncEntities(entities, options = {}) {
    const {
      operation = SyncOperationType.UPDATE,
      force = false,
      continueOnError = true
    } = options;

    if (!Array.isArray(entities) || entities.length === 0) {
      return {
        success: false,
        error: 'Entities array is required'
      };
    }

    // Filter valid entities
    const validEntities = entities.filter(e => e && e.id);
    if (validEntities.length === 0) {
      return {
        success: false,
        error: 'No valid entities to sync'
      };
    }

    // If offline, queue all changes
    if (!this.isConnected()) {
      const queueResults = validEntities.map(entity =>
        this._queueOfflineChange({
          type: 'sync_entity',
          entity,
          operation,
          force,
          timestamp: Date.now()
        })
      );

      return {
        success: true,
        queued: true,
        queuedCount: queueResults.length,
        message: 'Changes queued for later sync'
      };
    }

    this._setStatus(SyncStatus.SYNCING);
    const startTime = Date.now();

    try {
      // Split into batches
      const batches = this._splitIntoBatches(validEntities, this.config.batchSize);
      const results = {
        success: true,
        synced: [],
        conflicts: [],
        errors: []
      };

      for (const batch of batches) {
        const batchResult = await this._sendRequest({
          type: 'sync_entities_batch',
          operation,
          entities: batch.map(e => this._prepareEntityForSync(e)),
          force,
          clientTimestamp: Date.now()
        });

        if (batchResult.success) {
          // Process batch results
          if (batchResult.synced) {
            results.synced.push(...batchResult.synced);
          }
          if (batchResult.conflicts) {
            results.conflicts.push(...batchResult.conflicts);
          }
          if (batchResult.errors) {
            results.errors.push(...batchResult.errors);
          }
        } else if (!continueOnError) {
          throw new Error(batchResult.error || 'Batch sync failed');
        } else {
          results.errors.push({
            batch: batch.map(e => e.id),
            error: batchResult.error
          });
        }
      }

      // Update stats
      this.stats.totalSynced += results.synced.length;
      this.stats.totalConflicts += results.conflicts.length;
      this.stats.totalErrors += results.errors.length;
      this.stats.lastSyncDuration = Date.now() - startTime;
      this.lastSyncTime = Date.now();

      // Handle conflicts
      for (const conflict of results.conflicts) {
        await this._handleConflict(
          validEntities.find(e => e.id === conflict.entityId),
          conflict.serverEntity,
          operation
        );
      }

      this._setStatus(SyncStatus.CONNECTED);

      return {
        success: results.errors.length === 0 || continueOnError,
        syncedCount: results.synced.length,
        conflictCount: results.conflicts.length,
        errorCount: results.errors.length,
        duration: this.stats.lastSyncDuration,
        synced: results.synced,
        conflicts: results.conflicts,
        errors: results.errors
      };

    } catch (error) {
      this._setStatus(SyncStatus.ERROR);
      this.lastError = error.message;
      this.stats.totalErrors++;

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Pull entities from backend
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Pull result with entities
   */
  async pullEntities(query = {}) {
    const {
      entityTypes = null,
      since = null,
      limit = 100,
      offset = 0
    } = query;

    if (!this.isConnected()) {
      return {
        success: false,
        error: 'Not connected to backend',
        offline: true
      };
    }

    this._setStatus(SyncStatus.SYNCING);

    try {
      const result = await this._sendRequest({
        type: 'pull_entities',
        entityTypes,
        since: since || this.lastSyncTime,
        limit,
        offset,
        clientTimestamp: Date.now()
      });

      this._setStatus(SyncStatus.CONNECTED);

      if (result.success) {
        this.stats.totalPulled += result.entities?.length || 0;
        this.lastSyncTime = Date.now();

        return {
          success: true,
          entities: result.entities || [],
          total: result.total || 0,
          hasMore: result.hasMore || false,
          serverTimestamp: result.serverTimestamp
        };
      }

      return result;

    } catch (error) {
      this._setStatus(SyncStatus.ERROR);
      this.lastError = error.message;
      this.stats.totalErrors++;

      return {
        success: false,
        error: error.message
      };
    }
  }

  // ===========================================================================
  // Subscription Management
  // ===========================================================================

  /**
   * Subscribe to entity update events
   * @param {Array<string>} entityTypes - Entity types to subscribe to
   * @returns {Promise<Object>} Subscription result
   */
  async subscribeToUpdates(entityTypes) {
    if (!Array.isArray(entityTypes) || entityTypes.length === 0) {
      return {
        success: false,
        error: 'Entity types array is required'
      };
    }

    // Store subscriptions for reconnection
    entityTypes.forEach(type => this.subscriptions.add(type));

    if (!this.isConnected()) {
      return {
        success: true,
        queued: true,
        message: 'Subscriptions will be activated on connect',
        subscribedTypes: Array.from(this.subscriptions)
      };
    }

    try {
      const result = await this._sendRequest({
        type: 'subscribe_updates',
        entityTypes: Array.from(this.subscriptions),
        timestamp: Date.now()
      });

      return {
        success: result.success,
        subscribedTypes: Array.from(this.subscriptions),
        serverConfirmed: result.confirmed || []
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Unsubscribe from entity updates
   * @param {Array<string>} entityTypes - Entity types to unsubscribe from
   * @returns {Promise<Object>} Unsubscription result
   */
  async unsubscribeFromUpdates(entityTypes) {
    if (!Array.isArray(entityTypes)) {
      return {
        success: false,
        error: 'Entity types array is required'
      };
    }

    // Remove from stored subscriptions
    entityTypes.forEach(type => this.subscriptions.delete(type));

    if (!this.isConnected()) {
      return {
        success: true,
        message: 'Subscriptions updated locally',
        subscribedTypes: Array.from(this.subscriptions)
      };
    }

    try {
      const result = await this._sendRequest({
        type: 'unsubscribe_updates',
        entityTypes,
        timestamp: Date.now()
      });

      return {
        success: result.success,
        subscribedTypes: Array.from(this.subscriptions)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ===========================================================================
  // Sync Status and Configuration
  // ===========================================================================

  /**
   * Get last successful sync timestamp
   * @returns {number|null} Timestamp or null if never synced
   */
  getLastSyncTime() {
    return this.lastSyncTime;
  }

  /**
   * Get current sync status
   * @returns {Object} Sync status information
   */
  getSyncStatus() {
    return {
      status: this.status,
      connected: this.isConnected(),
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError,
      offlineQueueSize: this.offlineQueue.length,
      pendingRequestCount: this.pendingRequests.size,
      subscriptions: Array.from(this.subscriptions),
      autoSyncEnabled: this.config.autoSyncEnabled,
      syncInterval: this.config.syncInterval,
      stats: { ...this.stats }
    };
  }

  /**
   * Set auto-sync interval
   * @param {number} ms - Interval in milliseconds
   * @returns {Object} Configuration result
   */
  setSyncInterval(ms) {
    if (typeof ms !== 'number' || ms < 1000) {
      return {
        success: false,
        error: 'Interval must be at least 1000ms'
      };
    }

    const wasEnabled = this.config.autoSyncEnabled;
    this.config.syncInterval = ms;

    // Restart auto-sync if it was enabled
    if (wasEnabled) {
      this.enableAutoSync(false);
      this.enableAutoSync(true);
    }

    return {
      success: true,
      syncInterval: this.config.syncInterval,
      autoSyncEnabled: this.config.autoSyncEnabled
    };
  }

  /**
   * Enable or disable automatic syncing
   * @param {boolean} enabled - Whether to enable auto-sync
   * @returns {Object} Configuration result
   */
  enableAutoSync(enabled) {
    this.config.autoSyncEnabled = Boolean(enabled);

    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }

    if (enabled && this.config.syncInterval > 0) {
      this.autoSyncInterval = setInterval(() => {
        this._performAutoSync();
      }, this.config.syncInterval);
    }

    return {
      success: true,
      autoSyncEnabled: this.config.autoSyncEnabled,
      syncInterval: this.config.syncInterval
    };
  }

  /**
   * Set conflict resolution strategy
   * @param {string} strategy - Conflict strategy
   * @returns {Object} Configuration result
   */
  setConflictStrategy(strategy) {
    if (!Object.values(ConflictStrategy).includes(strategy)) {
      return {
        success: false,
        error: `Invalid strategy. Valid: ${Object.values(ConflictStrategy).join(', ')}`
      };
    }

    this.config.conflictStrategy = strategy;

    return {
      success: true,
      conflictStrategy: this.config.conflictStrategy
    };
  }

  /**
   * Get offline queue
   * @returns {Array} Queued changes
   */
  getOfflineQueue() {
    return [...this.offlineQueue];
  }

  /**
   * Clear offline queue
   * @returns {Object} Clear result
   */
  clearOfflineQueue() {
    const count = this.offlineQueue.length;
    this.offlineQueue = [];

    return {
      success: true,
      clearedCount: count
    };
  }

  // ===========================================================================
  // Private Methods - Connection Handling
  // ===========================================================================

  /**
   * Handle WebSocket disconnection
   * @private
   */
  _handleDisconnect(event) {
    this.ws = null;

    // Reject all pending requests
    for (const [requestId, pending] of this.pendingRequests) {
      pending.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();

    // Check if we should reconnect
    if (this.reconnectCount < this.config.reconnectAttempts) {
      this._setStatus(SyncStatus.OFFLINE);
      this._scheduleReconnect();
    } else {
      this._setStatus(SyncStatus.DISCONNECTED);
    }
  }

  /**
   * Handle WebSocket error
   * @private
   */
  _handleError(error) {
    this.lastError = error.message || 'WebSocket error';
    this.stats.totalErrors++;

    if (this.config.onError) {
      this.config.onError(error);
    }
  }

  /**
   * Handle incoming WebSocket message
   * @private
   */
  _handleMessage(event) {
    try {
      const message = JSON.parse(event.data);

      // Check if this is a response to a pending request
      if (message.requestId && this.pendingRequests.has(message.requestId)) {
        const pending = this.pendingRequests.get(message.requestId);
        this.pendingRequests.delete(message.requestId);
        pending.resolve(message);
        return;
      }

      // Handle server-initiated messages
      switch (message.type) {
        case 'entity_update':
          this._handleEntityUpdate(message);
          break;
        case 'sync_request':
          this._handleSyncRequest(message);
          break;
        case 'heartbeat':
          this._sendMessage({ type: 'heartbeat_ack', timestamp: Date.now() });
          break;
        default:
          // Unknown message type, log it
          break;
      }
    } catch (error) {
      // Failed to parse message
    }
  }

  /**
   * Handle entity update from server
   * @private
   */
  _handleEntityUpdate(message) {
    const { entityType, entity, operation } = message;

    // Check if we're subscribed to this type
    if (!this.subscriptions.has(entityType) && !this.subscriptions.has('*')) {
      return;
    }

    // Apply update to local entity store if available
    if (typeof globalThis.updateEntity === 'function' && operation === 'update') {
      globalThis.updateEntity(entity.id, entity.data, { merge: true });
    } else if (typeof globalThis.createEntity === 'function' && operation === 'create') {
      globalThis.createEntity(entity.type, entity.data, { metadata: entity.metadata });
    } else if (typeof globalThis.deleteEntity === 'function' && operation === 'delete') {
      globalThis.deleteEntity(entity.id);
    }
  }

  /**
   * Handle sync request from server
   * @private
   */
  _handleSyncRequest(message) {
    const { entityTypes, since } = message;

    // Gather entities to sync
    if (typeof globalThis.queryEntities === 'function') {
      const result = globalThis.queryEntities({
        type: entityTypes?.[0],
        where: since ? { 'metadata.updatedAt': { $gt: since } } : {}
      });

      if (result.success && result.entities.length > 0) {
        this.syncEntities(result.entities);
      }
    }
  }

  /**
   * Schedule reconnection attempt
   * @private
   */
  _scheduleReconnect() {
    if (this.reconnectTimeout) {
      return;
    }

    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectCount);
    this.reconnectCount++;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect(this.config.url);
    }, delay);
  }

  // ===========================================================================
  // Private Methods - Messaging
  // ===========================================================================

  /**
   * Send a message through WebSocket
   * @private
   */
  _sendMessage(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected');
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send a request and wait for response
   * @private
   */
  _sendRequest(message, timeout = 30000) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'));
        return;
      }

      const requestId = `req_${Date.now()}_${++this.requestIdCounter}`;
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, timeout);

      this.pendingRequests.set(requestId, {
        resolve: (response) => {
          clearTimeout(timeoutId);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      try {
        this._sendMessage({
          ...message,
          requestId
        });
      } catch (error) {
        this.pendingRequests.delete(requestId);
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Send current subscriptions to server
   * @private
   */
  _sendSubscriptions() {
    if (this.subscriptions.size > 0) {
      this._sendRequest({
        type: 'subscribe_updates',
        entityTypes: Array.from(this.subscriptions),
        timestamp: Date.now()
      }).catch(() => {
        // Subscription failed, will retry on next connect
      });
    }
  }

  // ===========================================================================
  // Private Methods - Data Processing
  // ===========================================================================

  /**
   * Prepare entity for sync (strip unnecessary data)
   * @private
   */
  _prepareEntityForSync(entity) {
    return {
      id: entity.id,
      type: entity.type,
      data: entity.data,
      metadata: {
        createdAt: entity.metadata?.createdAt,
        updatedAt: entity.metadata?.updatedAt,
        version: entity.metadata?.version
      }
    };
  }

  /**
   * Split entities into batches
   * @private
   */
  _splitIntoBatches(entities, batchSize) {
    const batches = [];
    for (let i = 0; i < entities.length; i += batchSize) {
      batches.push(entities.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Handle conflict between local and server entity
   * @private
   */
  async _handleConflict(localEntity, serverEntity, operation) {
    this.stats.totalConflicts++;

    // Notify via callback if configured
    if (this.config.onConflict) {
      const resolution = this.config.onConflict(localEntity, serverEntity, operation);
      if (resolution) {
        return resolution;
      }
    }

    // Apply conflict resolution strategy
    switch (this.config.conflictStrategy) {
      case ConflictStrategy.SERVER_WINS:
        // Update local with server version
        if (typeof globalThis.updateEntity === 'function') {
          globalThis.updateEntity(localEntity.id, serverEntity.data, { merge: false });
        }
        return {
          success: true,
          resolution: 'server_wins',
          entity: serverEntity
        };

      case ConflictStrategy.CLIENT_WINS:
        // Force sync local version
        return this.syncEntity(localEntity, { force: true });

      case ConflictStrategy.LATEST_WINS:
      default:
        // Compare timestamps
        const localTime = new Date(localEntity.metadata?.updatedAt || 0).getTime();
        const serverTime = new Date(serverEntity.metadata?.updatedAt || 0).getTime();

        if (serverTime > localTime) {
          if (typeof globalThis.updateEntity === 'function') {
            globalThis.updateEntity(localEntity.id, serverEntity.data, { merge: false });
          }
          return {
            success: true,
            resolution: 'server_newer',
            entity: serverEntity
          };
        } else {
          return this.syncEntity(localEntity, { force: true });
        }
    }
  }

  // ===========================================================================
  // Private Methods - Offline Queue
  // ===========================================================================

  /**
   * Queue a change for later sync when offline
   * @private
   */
  _queueOfflineChange(change) {
    this.offlineQueue.push({
      ...change,
      queuedAt: Date.now()
    });

    return {
      success: true,
      queued: true,
      queuePosition: this.offlineQueue.length,
      message: 'Change queued for sync when online'
    };
  }

  /**
   * Process queued offline changes
   * @private
   */
  async _processOfflineQueue() {
    if (this.offlineQueue.length === 0) {
      return;
    }

    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    // Group by type for batch processing
    const entityChanges = queue.filter(c => c.type === 'sync_entity');

    if (entityChanges.length > 0) {
      const entities = entityChanges.map(c => c.entity);
      await this.syncEntities(entities, { continueOnError: true });
    }
  }

  // ===========================================================================
  // Private Methods - Auto Sync
  // ===========================================================================

  /**
   * Perform automatic sync
   * @private
   */
  async _performAutoSync() {
    if (!this.isConnected()) {
      return;
    }

    // Pull latest changes from server
    await this.pullEntities({
      since: this.lastSyncTime
    });

    // Notify completion
    if (this.config.onSyncComplete) {
      this.config.onSyncComplete({
        type: 'auto',
        timestamp: Date.now(),
        stats: this.stats
      });
    }
  }

  // ===========================================================================
  // Private Methods - Utilities
  // ===========================================================================

  /**
   * Set sync status and notify
   * @private
   */
  _setStatus(status) {
    const previousStatus = this.status;
    this.status = status;

    if (previousStatus !== status && this.config.onStatusChange) {
      this.config.onStatusChange(status, previousStatus);
    }
  }

  /**
   * Get or generate client ID
   * @private
   */
  _getClientId() {
    if (!this._clientId) {
      this._clientId = `client_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    }
    return this._clientId;
  }
}

// =============================================================================
// Global Sync Instance
// =============================================================================

/**
 * Global BassetHoundSync instance
 */
let bassetHoundSync = null;

/**
 * Get or create the global sync instance
 * @param {Object} options - Configuration options
 * @returns {BassetHoundSync} Sync instance
 */
function getBassetHoundSync(options = {}) {
  if (!bassetHoundSync) {
    bassetHoundSync = new BassetHoundSync(options);
  }
  return bassetHoundSync;
}

/**
 * Reset the global sync instance
 * @returns {Object} Reset result
 */
function resetBassetHoundSync() {
  if (bassetHoundSync) {
    bassetHoundSync.disconnect();
    bassetHoundSync = null;
  }
  return { success: true, message: 'Sync instance reset' };
}

// =============================================================================
// Entity Manager Integration
// =============================================================================

/**
 * Hook into entity creation for automatic syncing
 * Call this to enable auto-sync on entity changes
 */
function enableEntitySyncHooks() {
  const sync = getBassetHoundSync();

  // Store original functions
  const originalCreateEntity = globalThis.createEntity;
  const originalUpdateEntity = globalThis.updateEntity;
  const originalDeleteEntity = globalThis.deleteEntity;

  // Wrap createEntity
  if (originalCreateEntity) {
    globalThis.createEntity = function(type, data, options = {}) {
      const result = originalCreateEntity(type, data, options);

      if (result.success && result.entity && sync.config.autoSyncEnabled) {
        sync.syncEntity(result.entity, { operation: SyncOperationType.CREATE })
          .catch(() => {
            // Sync failed, already queued if offline
          });
      }

      return result;
    };
  }

  // Wrap updateEntity
  if (originalUpdateEntity) {
    globalThis.updateEntity = function(entityId, data, options = {}) {
      const result = originalUpdateEntity(entityId, data, options);

      if (result.success && result.entity && sync.config.autoSyncEnabled) {
        sync.syncEntity(result.entity, { operation: SyncOperationType.UPDATE })
          .catch(() => {
            // Sync failed, already queued if offline
          });
      }

      return result;
    };
  }

  // Wrap deleteEntity
  if (originalDeleteEntity) {
    globalThis.deleteEntity = function(entityId) {
      const result = originalDeleteEntity(entityId);

      if (result.success && sync.config.autoSyncEnabled) {
        sync.syncEntity({ id: entityId }, { operation: SyncOperationType.DELETE })
          .catch(() => {
            // Sync failed, already queued if offline
          });
      }

      return result;
    };
  }

  return { success: true, message: 'Entity sync hooks enabled' };
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.SyncStatus = SyncStatus;
  globalThis.SyncOperationType = SyncOperationType;
  globalThis.ConflictStrategy = ConflictStrategy;
  globalThis.BassetHoundSync = BassetHoundSync;
  globalThis.getBassetHoundSync = getBassetHoundSync;
  globalThis.resetBassetHoundSync = resetBassetHoundSync;
  globalThis.enableEntitySyncHooks = enableEntitySyncHooks;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SyncStatus,
    SyncOperationType,
    ConflictStrategy,
    BassetHoundSync,
    getBassetHoundSync,
    resetBassetHoundSync,
    enableEntitySyncHooks
  };
}
