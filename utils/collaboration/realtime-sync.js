/**
 * Basset Hound Browser Automation - Real-Time Sync
 * Phase 18.1: Collaboration Features (Real-Time Synchronization)
 *
 * Provides real-time session synchronization:
 * - WebSocket connection to basset-hound backend
 * - Live updates when team members add evidence
 * - Conflict resolution for concurrent edits
 * - Presence indicators (who's viewing/editing)
 * - Automatic sync on reconnection
 * - Offline support with sync queue
 *
 * @module realtime-sync
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * Real-time sync configuration
 * @constant {Object}
 */
const SyncConfig = {
  // WebSocket settings
  WS_RECONNECT_DELAY_MIN: 1000,
  WS_RECONNECT_DELAY_MAX: 30000,
  WS_RECONNECT_BACKOFF: 1.5,
  WS_PING_INTERVAL: 30000,
  WS_PONG_TIMEOUT: 10000,

  // Sync settings
  SYNC_BATCH_SIZE: 50,
  SYNC_BATCH_DELAY: 500,
  SYNC_RETRY_ATTEMPTS: 3,
  OFFLINE_QUEUE_MAX: 1000,

  // Presence settings
  PRESENCE_UPDATE_INTERVAL: 30000,
  PRESENCE_TIMEOUT: 60000,

  // Storage keys
  STORAGE_KEY_SYNC_QUEUE: 'collaboration_sync_queue',
  STORAGE_KEY_SYNC_STATE: 'collaboration_sync_state'
};

/**
 * Sync event types
 * @enum {string}
 */
const SyncEventType = {
  EVIDENCE_ADDED: 'evidence_added',
  EVIDENCE_UPDATED: 'evidence_updated',
  EVIDENCE_REMOVED: 'evidence_removed',
  COMMENT_ADDED: 'comment_added',
  COMMENT_UPDATED: 'comment_updated',
  COMMENT_REMOVED: 'comment_removed',
  ASSIGNMENT_CREATED: 'assignment_created',
  ASSIGNMENT_UPDATED: 'assignment_updated',
  SESSION_UPDATED: 'session_updated',
  MEMBER_JOINED: 'member_joined',
  MEMBER_LEFT: 'member_left'
};

/**
 * Connection states
 * @enum {string}
 */
const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error'
};

// =============================================================================
// SyncOperation Class
// =============================================================================

/**
 * SyncOperation - Represents a sync operation to be sent/received
 */
class SyncOperation {
  /**
   * Create a SyncOperation instance
   * @param {Object} options - Operation options
   */
  constructor(options = {}) {
    this.id = options.id || this._generateOperationId();
    this.sessionId = options.sessionId;
    this.eventType = options.eventType;
    this.data = options.data || {};
    this.userId = options.userId || null;
    this.timestamp = options.timestamp || Date.now();
    this.version = options.version || 1;

    // Sync metadata
    this.synced = options.synced || false;
    this.retryCount = options.retryCount || 0;
    this.lastAttempt = options.lastAttempt || null;
    this.error = options.error || null;
  }

  /**
   * Convert to JSON for transmission
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      sessionId: this.sessionId,
      eventType: this.eventType,
      data: this.data,
      userId: this.userId,
      timestamp: this.timestamp,
      version: this.version
    };
  }

  /**
   * Create from JSON
   * @param {Object} data - JSON data
   * @returns {SyncOperation} Operation instance
   */
  static fromJSON(data) {
    return new SyncOperation(data);
  }

  /**
   * Generate unique operation ID
   * @private
   * @returns {string} Operation ID
   */
  _generateOperationId() {
    return `op_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
  }
}

// =============================================================================
// PresenceInfo Class
// =============================================================================

/**
 * PresenceInfo - Tracks user presence in a session
 */
class PresenceInfo {
  /**
   * Create a PresenceInfo instance
   * @param {Object} options - Presence options
   */
  constructor(options = {}) {
    this.userId = options.userId;
    this.userName = options.userName || 'Unknown User';
    this.sessionId = options.sessionId;
    this.status = options.status || 'viewing';
    this.lastSeen = options.lastSeen || Date.now();
    this.currentPage = options.currentPage || null;
    this.currentEvidence = options.currentEvidence || null;
  }

  /**
   * Check if presence is still active
   * @returns {boolean} Is active
   */
  isActive() {
    return Date.now() - this.lastSeen < SyncConfig.PRESENCE_TIMEOUT;
  }

  /**
   * Update last seen timestamp
   */
  touch() {
    this.lastSeen = Date.now();
  }

  /**
   * Convert to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      userId: this.userId,
      userName: this.userName,
      sessionId: this.sessionId,
      status: this.status,
      lastSeen: this.lastSeen,
      currentPage: this.currentPage,
      currentEvidence: this.currentEvidence,
      isActive: this.isActive()
    };
  }
}

// =============================================================================
// RealtimeSyncManager Class
// =============================================================================

/**
 * RealtimeSyncManager - Manages real-time session synchronization
 */
class RealtimeSyncManager {
  /**
   * Create a RealtimeSyncManager instance
   * @param {Object} options - Manager options
   */
  constructor(options = {}) {
    this.config = {
      wsUrl: options.wsUrl || null,
      authToken: options.authToken || null,
      logger: options.logger || null,
      onSync: options.onSync || null,
      onPresenceUpdate: options.onPresenceUpdate || null,
      onConnectionChange: options.onConnectionChange || null
    };

    // Connection state
    this.ws = null;
    this.connectionState = ConnectionState.DISCONNECTED;
    this.reconnectDelay = SyncConfig.WS_RECONNECT_DELAY_MIN;
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.pongTimer = null;

    // Sync state
    this.syncQueue = [];
    this.pendingOperations = new Map(); // operationId -> SyncOperation
    this.lastSyncTimestamp = null;

    // Presence tracking
    this.localPresence = null;
    this.remotePresence = new Map(); // userId -> PresenceInfo
    this.presenceTimer = null;

    // Session tracking
    this.activeSessions = new Set();
    this.sessionVersions = new Map(); // sessionId -> version

    // Event handlers
    this._eventHandlers = {
      onOpen: this._onWebSocketOpen.bind(this),
      onMessage: this._onWebSocketMessage.bind(this),
      onClose: this._onWebSocketClose.bind(this),
      onError: this._onWebSocketError.bind(this)
    };
  }

  // ===========================================================================
  // Connection Management
  // ===========================================================================

  /**
   * Connect to sync server
   * @param {string} wsUrl - WebSocket URL (optional, uses config)
   * @returns {Promise<Object>} Connection result
   */
  async connect(wsUrl = null) {
    if (this.connectionState === ConnectionState.CONNECTED) {
      return {
        success: true,
        message: 'Already connected',
        timestamp: Date.now()
      };
    }

    const url = wsUrl || this.config.wsUrl;
    if (!url) {
      return {
        success: false,
        error: 'WebSocket URL not configured',
        timestamp: Date.now()
      };
    }

    this._setConnectionState(ConnectionState.CONNECTING);

    try {
      // Create WebSocket connection
      this.ws = new WebSocket(url);

      // Attach event handlers
      this.ws.addEventListener('open', this._eventHandlers.onOpen);
      this.ws.addEventListener('message', this._eventHandlers.onMessage);
      this.ws.addEventListener('close', this._eventHandlers.onClose);
      this.ws.addEventListener('error', this._eventHandlers.onError);

      // Wait for connection
      await this._waitForConnection();

      // Load offline queue
      await this._loadSyncQueue();

      // Start ping/pong
      this._startPingPong();

      // Start presence updates
      this._startPresenceUpdates();

      this._log('info', 'Connected to sync server');

      return {
        success: true,
        connected: true,
        timestamp: Date.now()
      };
    } catch (error) {
      this._log('error', `Connection failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Disconnect from sync server
   * @returns {Promise<Object>} Disconnect result
   */
  async disconnect() {
    this._stopReconnect();
    this._stopPingPong();
    this._stopPresenceUpdates();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this._setConnectionState(ConnectionState.DISCONNECTED);

    this._log('info', 'Disconnected from sync server');

    return {
      success: true,
      disconnected: true,
      timestamp: Date.now()
    };
  }

  /**
   * Check if connected
   * @returns {boolean} Is connected
   */
  isConnected() {
    return this.connectionState === ConnectionState.CONNECTED &&
           this.ws &&
           this.ws.readyState === WebSocket.OPEN;
  }

  // ===========================================================================
  // Session Subscription
  // ===========================================================================

  /**
   * Subscribe to session updates
   * @param {string} sessionId - Session ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Subscribe result
   */
  async subscribeToSession(sessionId, userId) {
    if (!this.isConnected()) {
      return {
        success: false,
        error: 'Not connected to sync server',
        timestamp: Date.now()
      };
    }

    this.activeSessions.add(sessionId);

    // Send subscribe message
    await this._sendMessage({
      type: 'subscribe',
      sessionId,
      userId,
      timestamp: Date.now()
    });

    // Initialize presence
    this.localPresence = new PresenceInfo({
      userId,
      sessionId,
      status: 'viewing'
    });

    await this._broadcastPresence();

    this._log('info', `Subscribed to session ${sessionId}`);

    return {
      success: true,
      sessionId,
      subscribed: true,
      timestamp: Date.now()
    };
  }

  /**
   * Unsubscribe from session updates
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Unsubscribe result
   */
  async unsubscribeFromSession(sessionId) {
    if (!this.isConnected()) {
      return {
        success: false,
        error: 'Not connected',
        timestamp: Date.now()
      };
    }

    this.activeSessions.delete(sessionId);

    // Send unsubscribe message
    await this._sendMessage({
      type: 'unsubscribe',
      sessionId,
      timestamp: Date.now()
    });

    // Clear presence
    if (this.localPresence && this.localPresence.sessionId === sessionId) {
      this.localPresence = null;
    }

    this._log('info', `Unsubscribed from session ${sessionId}`);

    return {
      success: true,
      sessionId,
      unsubscribed: true,
      timestamp: Date.now()
    };
  }

  // ===========================================================================
  // Sync Operations
  // ===========================================================================

  /**
   * Queue sync operation
   * @param {string} sessionId - Session ID
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   * @returns {Promise<Object>} Queue result
   */
  async queueOperation(sessionId, eventType, data) {
    const operation = new SyncOperation({
      sessionId,
      eventType,
      data,
      userId: this.localPresence?.userId || null,
      timestamp: Date.now()
    });

    // Add to queue
    this.syncQueue.push(operation);

    // Limit queue size
    if (this.syncQueue.length > SyncConfig.OFFLINE_QUEUE_MAX) {
      this.syncQueue.shift();
    }

    // Persist queue
    await this._saveSyncQueue();

    // Try to sync immediately if connected
    if (this.isConnected()) {
      await this._processSyncQueue();
    }

    return {
      success: true,
      operationId: operation.id,
      queued: true,
      timestamp: Date.now()
    };
  }

  /**
   * Process sync queue
   * @private
   */
  async _processSyncQueue() {
    if (!this.isConnected() || this.syncQueue.length === 0) {
      return;
    }

    // Take batch from queue
    const batch = this.syncQueue.splice(0, SyncConfig.SYNC_BATCH_SIZE);

    for (const operation of batch) {
      try {
        operation.lastAttempt = Date.now();
        this.pendingOperations.set(operation.id, operation);

        await this._sendMessage({
          type: 'sync',
          operation: operation.toJSON()
        });
      } catch (error) {
        operation.error = error.message;
        operation.retryCount++;

        // Re-queue if under retry limit
        if (operation.retryCount < SyncConfig.SYNC_RETRY_ATTEMPTS) {
          this.syncQueue.push(operation);
        } else {
          this._log('error', `Operation failed after ${operation.retryCount} attempts: ${operation.id}`);
        }
      }
    }

    await this._saveSyncQueue();

    // Schedule next batch if queue not empty
    if (this.syncQueue.length > 0) {
      setTimeout(() => this._processSyncQueue(), SyncConfig.SYNC_BATCH_DELAY);
    }
  }

  /**
   * Handle incoming sync operation
   * @private
   * @param {Object} message - Sync message
   */
  _handleSyncOperation(message) {
    const operation = SyncOperation.fromJSON(message.operation);

    // Update session version
    if (operation.version) {
      this.sessionVersions.set(operation.sessionId, operation.version);
    }

    // Don't process our own operations
    if (operation.userId === this.localPresence?.userId) {
      // Mark as synced
      if (this.pendingOperations.has(operation.id)) {
        this.pendingOperations.delete(operation.id);
      }
      return;
    }

    // Notify listeners
    if (this.config.onSync) {
      this.config.onSync({
        eventType: operation.eventType,
        sessionId: operation.sessionId,
        data: operation.data,
        userId: operation.userId,
        timestamp: operation.timestamp
      });
    }

    this._log('debug', `Received sync: ${operation.eventType} for session ${operation.sessionId}`);
  }

  // ===========================================================================
  // Presence Management
  // ===========================================================================

  /**
   * Update local presence
   * @param {Object} presenceData - Presence data
   * @returns {Promise<Object>} Update result
   */
  async updatePresence(presenceData = {}) {
    if (!this.localPresence) {
      return {
        success: false,
        error: 'Not subscribed to a session',
        timestamp: Date.now()
      };
    }

    // Update local presence
    Object.assign(this.localPresence, presenceData);
    this.localPresence.touch();

    // Broadcast to other users
    await this._broadcastPresence();

    return {
      success: true,
      timestamp: Date.now()
    };
  }

  /**
   * Get active users in session
   * @param {string} sessionId - Session ID
   * @returns {Array} Active users
   */
  getActiveUsers(sessionId) {
    const users = [];

    // Add local presence
    if (this.localPresence && this.localPresence.sessionId === sessionId && this.localPresence.isActive()) {
      users.push(this.localPresence.toJSON());
    }

    // Add remote presence
    for (const presence of this.remotePresence.values()) {
      if (presence.sessionId === sessionId && presence.isActive()) {
        users.push(presence.toJSON());
      }
    }

    return users;
  }

  /**
   * Broadcast local presence
   * @private
   */
  async _broadcastPresence() {
    if (!this.isConnected() || !this.localPresence) {
      return;
    }

    await this._sendMessage({
      type: 'presence',
      presence: this.localPresence.toJSON()
    });
  }

  /**
   * Handle incoming presence update
   * @private
   * @param {Object} message - Presence message
   */
  _handlePresenceUpdate(message) {
    const presenceData = message.presence;
    const userId = presenceData.userId;

    if (userId === this.localPresence?.userId) {
      return; // Ignore our own presence
    }

    // Update or create presence
    let presence = this.remotePresence.get(userId);
    if (!presence) {
      presence = new PresenceInfo(presenceData);
      this.remotePresence.set(userId, presence);
    } else {
      Object.assign(presence, presenceData);
    }

    // Notify listeners
    if (this.config.onPresenceUpdate) {
      this.config.onPresenceUpdate({
        userId,
        presence: presence.toJSON(),
        activeUsers: this.getActiveUsers(presence.sessionId)
      });
    }
  }

  /**
   * Start presence update timer
   * @private
   */
  _startPresenceUpdates() {
    this._stopPresenceUpdates();

    this.presenceTimer = setInterval(() => {
      // Broadcast our presence
      if (this.localPresence) {
        this.localPresence.touch();
        this._broadcastPresence();
      }

      // Clean up stale presence
      for (const [userId, presence] of this.remotePresence.entries()) {
        if (!presence.isActive()) {
          this.remotePresence.delete(userId);
        }
      }
    }, SyncConfig.PRESENCE_UPDATE_INTERVAL);
  }

  /**
   * Stop presence update timer
   * @private
   */
  _stopPresenceUpdates() {
    if (this.presenceTimer) {
      clearInterval(this.presenceTimer);
      this.presenceTimer = null;
    }
  }

  // ===========================================================================
  // WebSocket Event Handlers
  // ===========================================================================

  /**
   * Handle WebSocket open
   * @private
   */
  _onWebSocketOpen() {
    this._setConnectionState(ConnectionState.CONNECTED);
    this.reconnectDelay = SyncConfig.WS_RECONNECT_DELAY_MIN;

    // Authenticate if token provided
    if (this.config.authToken) {
      this._sendMessage({
        type: 'auth',
        token: this.config.authToken
      });
    }

    // Process offline queue
    this._processSyncQueue();

    this._log('info', 'WebSocket connection opened');
  }

  /**
   * Handle WebSocket message
   * @private
   * @param {MessageEvent} event - Message event
   */
  _onWebSocketMessage(event) {
    try {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'sync':
          this._handleSyncOperation(message);
          break;

        case 'presence':
          this._handlePresenceUpdate(message);
          break;

        case 'pong':
          this._handlePong();
          break;

        case 'error':
          this._log('error', `Server error: ${message.error}`);
          break;

        default:
          this._log('warn', `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this._log('error', `Failed to process message: ${error.message}`);
    }
  }

  /**
   * Handle WebSocket close
   * @private
   * @param {CloseEvent} event - Close event
   */
  _onWebSocketClose(event) {
    this._log('warn', `WebSocket closed: ${event.code} ${event.reason}`);

    this._setConnectionState(ConnectionState.DISCONNECTED);
    this._stopPingPong();

    // Attempt reconnection if not intentional close
    if (event.code !== 1000) {
      this._scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket error
   * @private
   * @param {Event} event - Error event
   */
  _onWebSocketError(event) {
    this._log('error', 'WebSocket error occurred');
    this._setConnectionState(ConnectionState.ERROR);
  }

  // ===========================================================================
  // Connection Utilities
  // ===========================================================================

  /**
   * Wait for connection to establish
   * @private
   * @returns {Promise} Connection promise
   */
  _waitForConnection() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      const checkState = () => {
        if (this.ws.readyState === WebSocket.OPEN) {
          clearTimeout(timeout);
          resolve();
        } else if (this.ws.readyState === WebSocket.CLOSED) {
          clearTimeout(timeout);
          reject(new Error('Connection failed'));
        } else {
          setTimeout(checkState, 100);
        }
      };

      checkState();
    });
  }

  /**
   * Send message to server
   * @private
   * @param {Object} message - Message to send
   */
  async _sendMessage(message) {
    if (!this.isConnected()) {
      throw new Error('Not connected');
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Set connection state
   * @private
   * @param {string} state - Connection state
   */
  _setConnectionState(state) {
    if (this.connectionState === state) return;

    this.connectionState = state;

    if (this.config.onConnectionChange) {
      this.config.onConnectionChange({
        state,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Schedule reconnection
   * @private
   */
  _scheduleReconnect() {
    this._stopReconnect();

    this._setConnectionState(ConnectionState.RECONNECTING);

    this._log('info', `Reconnecting in ${this.reconnectDelay}ms...`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
      this.reconnectDelay = Math.min(
        this.reconnectDelay * SyncConfig.WS_RECONNECT_BACKOFF,
        SyncConfig.WS_RECONNECT_DELAY_MAX
      );
    }, this.reconnectDelay);
  }

  /**
   * Stop reconnection timer
   * @private
   */
  _stopReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Start ping/pong keepalive
   * @private
   */
  _startPingPong() {
    this._stopPingPong();

    this.pingTimer = setInterval(() => {
      if (this.isConnected()) {
        this._sendMessage({ type: 'ping' });

        // Set pong timeout
        this.pongTimer = setTimeout(() => {
          this._log('warn', 'Pong timeout - connection may be dead');
          this.ws.close();
        }, SyncConfig.WS_PONG_TIMEOUT);
      }
    }, SyncConfig.WS_PING_INTERVAL);
  }

  /**
   * Stop ping/pong keepalive
   * @private
   */
  _stopPingPong() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  /**
   * Handle pong response
   * @private
   */
  _handlePong() {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  // ===========================================================================
  // Storage Methods
  // ===========================================================================

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
          } else {
            resolve({ [keys]: this._mockStore[keys] });
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
   * Save sync queue to storage
   * @private
   */
  async _saveSyncQueue() {
    const storage = this._getStorage();
    try {
      await storage.set({
        [SyncConfig.STORAGE_KEY_SYNC_QUEUE]: this.syncQueue.map(op => op.toJSON())
      });
    } catch (error) {
      this._log('error', `Failed to save sync queue: ${error.message}`);
    }
  }

  /**
   * Load sync queue from storage
   * @private
   */
  async _loadSyncQueue() {
    const storage = this._getStorage();
    try {
      const result = await storage.get(SyncConfig.STORAGE_KEY_SYNC_QUEUE);
      const queueData = result[SyncConfig.STORAGE_KEY_SYNC_QUEUE];

      if (queueData && Array.isArray(queueData)) {
        this.syncQueue = queueData.map(op => SyncOperation.fromJSON(op));
        this._log('info', `Loaded ${this.syncQueue.length} queued operations`);
      }
    } catch (error) {
      this._log('error', `Failed to load sync queue: ${error.message}`);
    }
  }

  /**
   * Log message
   * @private
   * @param {string} level - Log level
   * @param {string} message - Log message
   */
  _log(level, message) {
    if (this.config.logger && this.config.logger[level]) {
      this.config.logger[level](message);
    } else if (console[level]) {
      console[level]('[RealtimeSync]', message);
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

if (typeof globalThis !== 'undefined') {
  globalThis.SyncConfig = SyncConfig;
  globalThis.SyncEventType = SyncEventType;
  globalThis.ConnectionState = ConnectionState;
  globalThis.SyncOperation = SyncOperation;
  globalThis.PresenceInfo = PresenceInfo;
  globalThis.RealtimeSyncManager = RealtimeSyncManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SyncConfig,
    SyncEventType,
    ConnectionState,
    SyncOperation,
    PresenceInfo,
    RealtimeSyncManager
  };
}
