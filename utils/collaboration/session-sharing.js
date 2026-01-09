/**
 * Basset Hound Browser Automation - Session Sharing
 * Phase 18.1: Collaboration Features (Shared Sessions)
 *
 * Provides session sharing capabilities:
 * - Generate shareable session links/codes
 * - Permission levels (viewer, contributor, admin)
 * - Session access control
 * - Export session for sharing (encrypted)
 * - Session invitation management
 *
 * @module session-sharing
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * Session sharing configuration
 * @constant {Object}
 */
const SharingConfig = {
  // Share link settings
  SHARE_LINK_LENGTH: 16,
  SHARE_CODE_LENGTH: 8,
  SHARE_LINK_EXPIRY_HOURS: 168, // 7 days
  SHARE_CODE_EXPIRY_HOURS: 24,

  // Permission settings
  MAX_TEAM_MEMBERS: 50,
  DEFAULT_PERMISSION: 'viewer',

  // Storage keys
  STORAGE_KEY_SHARED_SESSIONS: 'collaboration_shared_sessions',
  STORAGE_KEY_SHARE_LINKS: 'collaboration_share_links',
  STORAGE_KEY_SHARE_INVITES: 'collaboration_share_invites'
};

/**
 * Permission levels for session access
 * @enum {string}
 */
const PermissionLevel = {
  VIEWER: 'viewer',       // Can view evidence, cannot edit
  CONTRIBUTOR: 'contributor', // Can add evidence, cannot manage team
  ADMIN: 'admin'          // Full control, can manage team and session
};

/**
 * Share link types
 * @enum {string}
 */
const ShareLinkType = {
  PERMANENT: 'permanent',
  TEMPORARY: 'temporary',
  ONE_TIME: 'one_time'
};

// =============================================================================
// SessionShare Class
// =============================================================================

/**
 * SessionShare - Represents a session sharing configuration
 */
class SessionShare {
  /**
   * Create a SessionShare instance
   * @param {Object} options - Share options
   */
  constructor(options = {}) {
    this.id = options.id || this._generateShareId();
    this.sessionId = options.sessionId;
    this.shareCode = options.shareCode || this._generateShareCode();
    this.shareLink = options.shareLink || this._generateShareLink();
    this.shareType = options.shareType || ShareLinkType.TEMPORARY;

    // Ownership
    this.createdBy = options.createdBy || null;
    this.createdAt = options.createdAt || Date.now();

    // Access control
    this.defaultPermission = options.defaultPermission || PermissionLevel.VIEWER;
    this.allowedUsers = options.allowedUsers || []; // Array of user IDs
    this.permissions = options.permissions || new Map(); // userId -> permission level

    // Expiry
    this.expiresAt = options.expiresAt || this._calculateExpiry();
    this.isActive = options.isActive !== false;
    this.maxUses = options.maxUses || null; // null = unlimited
    this.currentUses = options.currentUses || 0;

    // Security
    this.requiresPassword = options.requiresPassword || false;
    this.passwordHash = options.passwordHash || null;
    this.encrypted = options.encrypted || false;
    this.encryptionKey = options.encryptionKey || null;

    // Audit
    this.accessLog = options.accessLog || [];
    this.lastAccessedAt = options.lastAccessedAt || null;
    this.lastAccessedBy = options.lastAccessedBy || null;
  }

  // ===========================================================================
  // Access Control Methods
  // ===========================================================================

  /**
   * Check if user can access this share
   * @param {string} userId - User ID
   * @param {string} password - Optional password
   * @returns {Object} Access result
   */
  canAccess(userId, password = null) {
    // Check if active
    if (!this.isActive) {
      return {
        allowed: false,
        reason: 'Share link is deactivated'
      };
    }

    // Check expiry
    if (this.expiresAt && Date.now() > this.expiresAt) {
      return {
        allowed: false,
        reason: 'Share link has expired'
      };
    }

    // Check max uses
    if (this.maxUses && this.currentUses >= this.maxUses) {
      return {
        allowed: false,
        reason: 'Share link has reached maximum uses'
      };
    }

    // Check password if required
    if (this.requiresPassword) {
      if (!password) {
        return {
          allowed: false,
          reason: 'Password required',
          requiresPassword: true
        };
      }
      if (!this._verifyPassword(password)) {
        return {
          allowed: false,
          reason: 'Incorrect password'
        };
      }
    }

    // Check user allowlist (if specified)
    if (this.allowedUsers.length > 0 && !this.allowedUsers.includes(userId)) {
      return {
        allowed: false,
        reason: 'User not authorized for this share'
      };
    }

    return {
      allowed: true,
      permission: this.permissions.get(userId) || this.defaultPermission
    };
  }

  /**
   * Record access to this share
   * @param {string} userId - User ID
   * @param {Object} metadata - Access metadata
   */
  recordAccess(userId, metadata = {}) {
    this.currentUses++;
    this.lastAccessedAt = Date.now();
    this.lastAccessedBy = userId;

    this.accessLog.push({
      userId,
      timestamp: Date.now(),
      timestampISO: new Date().toISOString(),
      ...metadata
    });

    // Limit access log size
    if (this.accessLog.length > 1000) {
      this.accessLog = this.accessLog.slice(-1000);
    }

    // Deactivate one-time links
    if (this.shareType === ShareLinkType.ONE_TIME) {
      this.isActive = false;
    }
  }

  /**
   * Set permission for specific user
   * @param {string} userId - User ID
   * @param {string} permission - Permission level
   */
  setUserPermission(userId, permission) {
    if (!Object.values(PermissionLevel).includes(permission)) {
      throw new Error(`Invalid permission level: ${permission}`);
    }
    this.permissions.set(userId, permission);
  }

  /**
   * Get permission for specific user
   * @param {string} userId - User ID
   * @returns {string} Permission level
   */
  getUserPermission(userId) {
    return this.permissions.get(userId) || this.defaultPermission;
  }

  /**
   * Add user to allowed list
   * @param {string} userId - User ID
   */
  addAllowedUser(userId) {
    if (!this.allowedUsers.includes(userId)) {
      this.allowedUsers.push(userId);
    }
  }

  /**
   * Remove user from allowed list
   * @param {string} userId - User ID
   */
  removeAllowedUser(userId) {
    this.allowedUsers = this.allowedUsers.filter(id => id !== userId);
    this.permissions.delete(userId);
  }

  /**
   * Deactivate share link
   */
  deactivate() {
    this.isActive = false;
  }

  /**
   * Extend expiry time
   * @param {number} additionalHours - Hours to add
   */
  extendExpiry(additionalHours) {
    if (this.expiresAt) {
      this.expiresAt += additionalHours * 60 * 60 * 1000;
    }
  }

  // ===========================================================================
  // Security Methods
  // ===========================================================================

  /**
   * Set password for share
   * @param {string} password - Password to set
   */
  setPassword(password) {
    this.requiresPassword = true;
    this.passwordHash = this._hashPassword(password);
  }

  /**
   * Verify password
   * @private
   * @param {string} password - Password to verify
   * @returns {boolean} Password valid
   */
  _verifyPassword(password) {
    return this._hashPassword(password) === this.passwordHash;
  }

  /**
   * Simple password hashing (use proper crypto in production)
   * @private
   * @param {string} password - Password to hash
   * @returns {string} Hash
   */
  _hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'pwd_' + Math.abs(hash).toString(16).padStart(16, '0');
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  /**
   * Convert to JSON for storage
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      sessionId: this.sessionId,
      shareCode: this.shareCode,
      shareLink: this.shareLink,
      shareType: this.shareType,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      defaultPermission: this.defaultPermission,
      allowedUsers: this.allowedUsers,
      permissions: Array.from(this.permissions.entries()),
      expiresAt: this.expiresAt,
      isActive: this.isActive,
      maxUses: this.maxUses,
      currentUses: this.currentUses,
      requiresPassword: this.requiresPassword,
      passwordHash: this.passwordHash,
      encrypted: this.encrypted,
      encryptionKey: this.encryptionKey,
      accessLog: this.accessLog.slice(-100), // Only store last 100
      lastAccessedAt: this.lastAccessedAt,
      lastAccessedBy: this.lastAccessedBy
    };
  }

  /**
   * Create from JSON
   * @param {Object} data - JSON data
   * @returns {SessionShare} Share instance
   */
  static fromJSON(data) {
    const share = new SessionShare(data);
    if (data.permissions) {
      share.permissions = new Map(data.permissions);
    }
    return share;
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Generate unique share ID
   * @private
   * @returns {string} Share ID
   */
  _generateShareId() {
    return `share_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
  }

  /**
   * Generate share code (short, human-readable)
   * @private
   * @returns {string} Share code
   */
  _generateShareCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars
    let code = '';
    for (let i = 0; i < SharingConfig.SHARE_CODE_LENGTH; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Generate share link (long, unique)
   * @private
   * @returns {string} Share link token
   */
  _generateShareLink() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let link = '';
    for (let i = 0; i < SharingConfig.SHARE_LINK_LENGTH; i++) {
      link += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return link;
  }

  /**
   * Calculate expiry timestamp
   * @private
   * @returns {number} Expiry timestamp
   */
  _calculateExpiry() {
    if (this.shareType === ShareLinkType.PERMANENT) {
      return null;
    }
    const hours = this.shareType === ShareLinkType.ONE_TIME
      ? SharingConfig.SHARE_CODE_EXPIRY_HOURS
      : SharingConfig.SHARE_LINK_EXPIRY_HOURS;
    return Date.now() + (hours * 60 * 60 * 1000);
  }
}

// =============================================================================
// SessionSharingManager Class
// =============================================================================

/**
 * SessionSharingManager - Manages session sharing and access control
 */
class SessionSharingManager {
  /**
   * Create a SessionSharingManager instance
   * @param {Object} options - Manager options
   */
  constructor(options = {}) {
    this.config = {
      logger: options.logger || null
    };

    this.shares = new Map();
    this.shareLinkIndex = new Map(); // shareLink -> shareId
    this.shareCodeIndex = new Map(); // shareCode -> shareId
    this.sessionIndex = new Map(); // sessionId -> Set of shareIds
  }

  // ===========================================================================
  // Share Creation
  // ===========================================================================

  /**
   * Create a share link for a session
   * @param {string} sessionId - Session ID to share
   * @param {Object} options - Share options
   * @returns {Promise<Object>} Share result
   */
  async createShareLink(sessionId, options = {}) {
    const {
      shareType = ShareLinkType.TEMPORARY,
      permission = PermissionLevel.VIEWER,
      expiresInHours = null,
      maxUses = null,
      password = null,
      allowedUsers = [],
      createdBy = null
    } = options;

    // Create share
    const share = new SessionShare({
      sessionId,
      shareType,
      defaultPermission: permission,
      maxUses,
      allowedUsers,
      createdBy
    });

    // Set custom expiry if provided
    if (expiresInHours) {
      share.expiresAt = Date.now() + (expiresInHours * 60 * 60 * 1000);
    }

    // Set password if provided
    if (password) {
      share.setPassword(password);
    }

    // Store share
    this.shares.set(share.id, share);
    this.shareLinkIndex.set(share.shareLink, share.id);
    this.shareCodeIndex.set(share.shareCode, share.id);

    if (!this.sessionIndex.has(sessionId)) {
      this.sessionIndex.set(sessionId, new Set());
    }
    this.sessionIndex.get(sessionId).add(share.id);

    // Persist
    await this._saveShare(share);

    this._log('info', `Share link created: ${share.shareCode} for session ${sessionId}`);

    return {
      success: true,
      shareId: share.id,
      shareCode: share.shareCode,
      shareLink: share.shareLink,
      fullLink: this._buildFullShareUrl(share.shareLink),
      expiresAt: share.expiresAt,
      expiresAtISO: share.expiresAt ? new Date(share.expiresAt).toISOString() : null,
      permission: share.defaultPermission,
      timestamp: Date.now()
    };
  }

  /**
   * Validate and access a share
   * @param {string} shareLinkOrCode - Share link or code
   * @param {string} userId - User ID attempting access
   * @param {string} password - Optional password
   * @returns {Promise<Object>} Access result
   */
  async accessShare(shareLinkOrCode, userId, password = null) {
    // Find share
    const share = await this._findShare(shareLinkOrCode);

    if (!share) {
      return {
        success: false,
        error: 'Invalid share link or code',
        timestamp: Date.now()
      };
    }

    // Check access
    const accessCheck = share.canAccess(userId, password);

    if (!accessCheck.allowed) {
      this._log('warn', `Share access denied for user ${userId}: ${accessCheck.reason}`);
      return {
        success: false,
        error: accessCheck.reason,
        requiresPassword: accessCheck.requiresPassword,
        timestamp: Date.now()
      };
    }

    // Record access
    share.recordAccess(userId, {
      userAgent: navigator?.userAgent || null,
      method: shareLinkOrCode.length === SharingConfig.SHARE_CODE_LENGTH ? 'code' : 'link'
    });

    await this._saveShare(share);

    this._log('info', `Share accessed by user ${userId}: ${share.shareCode}`);

    return {
      success: true,
      shareId: share.id,
      sessionId: share.sessionId,
      permission: accessCheck.permission,
      expiresAt: share.expiresAt,
      timestamp: Date.now()
    };
  }

  /**
   * Revoke a share link
   * @param {string} shareId - Share ID to revoke
   * @returns {Promise<Object>} Revoke result
   */
  async revokeShare(shareId) {
    const share = this.shares.get(shareId);

    if (!share) {
      return {
        success: false,
        error: 'Share not found',
        timestamp: Date.now()
      };
    }

    share.deactivate();
    await this._saveShare(share);

    this._log('info', `Share revoked: ${share.shareCode}`);

    return {
      success: true,
      shareId,
      revoked: true,
      timestamp: Date.now()
    };
  }

  /**
   * List shares for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Shares list
   */
  async listSessionShares(sessionId) {
    const shareIds = this.sessionIndex.get(sessionId) || new Set();
    const shares = [];

    for (const shareId of shareIds) {
      const share = this.shares.get(shareId);
      if (share) {
        shares.push({
          id: share.id,
          shareCode: share.shareCode,
          shareLink: share.shareLink,
          fullLink: this._buildFullShareUrl(share.shareLink),
          shareType: share.shareType,
          permission: share.defaultPermission,
          isActive: share.isActive,
          expiresAt: share.expiresAt,
          expiresAtISO: share.expiresAt ? new Date(share.expiresAt).toISOString() : null,
          currentUses: share.currentUses,
          maxUses: share.maxUses,
          createdAt: share.createdAt,
          createdBy: share.createdBy
        });
      }
    }

    return {
      success: true,
      sessionId,
      shares,
      totalShares: shares.length,
      timestamp: Date.now()
    };
  }

  /**
   * Update share permissions
   * @param {string} shareId - Share ID
   * @param {string} userId - User ID
   * @param {string} permission - New permission level
   * @returns {Promise<Object>} Update result
   */
  async updateSharePermission(shareId, userId, permission) {
    const share = this.shares.get(shareId);

    if (!share) {
      return {
        success: false,
        error: 'Share not found',
        timestamp: Date.now()
      };
    }

    share.setUserPermission(userId, permission);
    await this._saveShare(share);

    return {
      success: true,
      shareId,
      userId,
      permission,
      timestamp: Date.now()
    };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Find share by link or code
   * @private
   * @param {string} linkOrCode - Share link or code
   * @returns {Promise<SessionShare|null>} Share or null
   */
  async _findShare(linkOrCode) {
    // Try as share link first
    let shareId = this.shareLinkIndex.get(linkOrCode);

    if (!shareId) {
      // Try as share code
      shareId = this.shareCodeIndex.get(linkOrCode.toUpperCase());
    }

    if (!shareId) {
      // Try loading from storage
      await this._loadAllShares();
      shareId = this.shareLinkIndex.get(linkOrCode) ||
                this.shareCodeIndex.get(linkOrCode.toUpperCase());
    }

    return shareId ? this.shares.get(shareId) : null;
  }

  /**
   * Build full share URL
   * @private
   * @param {string} shareLink - Share link token
   * @returns {string} Full URL
   */
  _buildFullShareUrl(shareLink) {
    // This would be configured based on deployment
    return `basset-hound://share/${shareLink}`;
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
   * Save share to storage
   * @private
   * @param {SessionShare} share - Share to save
   */
  async _saveShare(share) {
    const storage = this._getStorage();
    const key = `${SharingConfig.STORAGE_KEY_SHARE_LINKS}_${share.id}`;

    try {
      await storage.set({ [key]: share.toJSON() });
    } catch (error) {
      this._log('error', `Failed to save share ${share.id}: ${error.message}`);
    }
  }

  /**
   * Load all shares from storage
   * @private
   */
  async _loadAllShares() {
    const storage = this._getStorage();

    try {
      const allData = await storage.get(null);
      const prefix = SharingConfig.STORAGE_KEY_SHARE_LINKS + '_';

      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith(prefix) && !this.shares.has(value.id)) {
          const share = SessionShare.fromJSON(value);
          this.shares.set(share.id, share);
          this.shareLinkIndex.set(share.shareLink, share.id);
          this.shareCodeIndex.set(share.shareCode, share.id);

          if (!this.sessionIndex.has(share.sessionId)) {
            this.sessionIndex.set(share.sessionId, new Set());
          }
          this.sessionIndex.get(share.sessionId).add(share.id);
        }
      }
    } catch (error) {
      this._log('error', `Failed to load shares: ${error.message}`);
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
      console[level]('[SessionSharing]', message);
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

if (typeof globalThis !== 'undefined') {
  globalThis.SharingConfig = SharingConfig;
  globalThis.PermissionLevel = PermissionLevel;
  globalThis.ShareLinkType = ShareLinkType;
  globalThis.SessionShare = SessionShare;
  globalThis.SessionSharingManager = SessionSharingManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SharingConfig,
    PermissionLevel,
    ShareLinkType,
    SessionShare,
    SessionSharingManager
  };
}
