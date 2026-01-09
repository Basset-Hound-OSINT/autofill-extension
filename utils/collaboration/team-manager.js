/**
 * Basset Hound Browser Automation - Team Manager
 * Phase 18.1: Collaboration Features (Team Management)
 *
 * Provides team management for investigations:
 * - Invite team members to investigations
 * - Team member list with roles
 * - Activity feed (who did what, when)
 * - Team notifications
 * - Remove team members
 *
 * @module team-manager
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * Team management configuration
 * @constant {Object}
 */
const TeamConfig = {
  // Team settings
  MAX_TEAM_SIZE: 50,
  MAX_ACTIVITY_FEED_SIZE: 1000,

  // Storage keys
  STORAGE_KEY_TEAMS: 'collaboration_teams',
  STORAGE_KEY_INVITES: 'collaboration_invites',
  STORAGE_KEY_ACTIVITY: 'collaboration_activity'
};

/**
 * Team member roles
 * @enum {string}
 */
const TeamRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  INVESTIGATOR: 'investigator',
  REVIEWER: 'reviewer',
  VIEWER: 'viewer'
};

/**
 * Invite status
 * @enum {string}
 */
const InviteStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled'
};

/**
 * Activity event types
 * @enum {string}
 */
const ActivityType = {
  MEMBER_JOINED: 'member_joined',
  MEMBER_LEFT: 'member_left',
  ROLE_CHANGED: 'role_changed',
  EVIDENCE_ADDED: 'evidence_added',
  COMMENT_ADDED: 'comment_added',
  ASSIGNMENT_CREATED: 'assignment_created',
  ASSIGNMENT_COMPLETED: 'assignment_completed',
  SESSION_UPDATED: 'session_updated',
  SESSION_SHARED: 'session_shared'
};

// =============================================================================
// TeamMember Class
// =============================================================================

/**
 * TeamMember - Represents a team member
 */
class TeamMember {
  /**
   * Create a TeamMember instance
   * @param {Object} options - Member options
   */
  constructor(options = {}) {
    this.userId = options.userId;
    this.userName = options.userName || 'Unknown User';
    this.userEmail = options.userEmail || null;
    this.role = options.role || TeamRole.VIEWER;
    this.joinedAt = options.joinedAt || Date.now();
    this.addedBy = options.addedBy || null;
    this.isActive = options.isActive !== false;
    this.lastActive = options.lastActive || Date.now();
  }

  /**
   * Update role
   * @param {string} newRole - New role
   * @returns {Object} Update result
   */
  updateRole(newRole) {
    if (!Object.values(TeamRole).includes(newRole)) {
      return {
        success: false,
        error: `Invalid role: ${newRole}`
      };
    }

    const oldRole = this.role;
    this.role = newRole;

    return {
      success: true,
      userId: this.userId,
      oldRole,
      newRole
    };
  }

  /**
   * Touch last active timestamp
   */
  touch() {
    this.lastActive = Date.now();
  }

  /**
   * Convert to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      userId: this.userId,
      userName: this.userName,
      userEmail: this.userEmail,
      role: this.role,
      joinedAt: this.joinedAt,
      joinedAtISO: new Date(this.joinedAt).toISOString(),
      addedBy: this.addedBy,
      isActive: this.isActive,
      lastActive: this.lastActive,
      lastActiveISO: new Date(this.lastActive).toISOString()
    };
  }

  /**
   * Create from JSON
   * @param {Object} data - JSON data
   * @returns {TeamMember} Member instance
   */
  static fromJSON(data) {
    return new TeamMember(data);
  }
}

// =============================================================================
// TeamInvite Class
// =============================================================================

/**
 * TeamInvite - Represents a team invitation
 */
class TeamInvite {
  /**
   * Create a TeamInvite instance
   * @param {Object} options - Invite options
   */
  constructor(options = {}) {
    this.id = options.id || this._generateInviteId();
    this.sessionId = options.sessionId;
    this.invitedEmail = options.invitedEmail;
    this.invitedBy = options.invitedBy;
    this.role = options.role || TeamRole.VIEWER;
    this.status = options.status || InviteStatus.PENDING;
    this.createdAt = options.createdAt || Date.now();
    this.expiresAt = options.expiresAt || (Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    this.acceptedAt = options.acceptedAt || null;
    this.declinedAt = options.declinedAt || null;
  }

  /**
   * Accept invite
   * @returns {Object} Accept result
   */
  accept() {
    if (this.status !== InviteStatus.PENDING) {
      return {
        success: false,
        error: 'Invite not pending'
      };
    }

    if (Date.now() > this.expiresAt) {
      this.status = InviteStatus.EXPIRED;
      return {
        success: false,
        error: 'Invite expired'
      };
    }

    this.status = InviteStatus.ACCEPTED;
    this.acceptedAt = Date.now();

    return {
      success: true,
      inviteId: this.id,
      status: this.status
    };
  }

  /**
   * Decline invite
   * @returns {Object} Decline result
   */
  decline() {
    if (this.status !== InviteStatus.PENDING) {
      return {
        success: false,
        error: 'Invite not pending'
      };
    }

    this.status = InviteStatus.DECLINED;
    this.declinedAt = Date.now();

    return {
      success: true,
      inviteId: this.id,
      status: this.status
    };
  }

  /**
   * Check if expired
   * @returns {boolean} Is expired
   */
  isExpired() {
    return Date.now() > this.expiresAt;
  }

  /**
   * Convert to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      sessionId: this.sessionId,
      invitedEmail: this.invitedEmail,
      invitedBy: this.invitedBy,
      role: this.role,
      status: this.status,
      createdAt: this.createdAt,
      createdAtISO: new Date(this.createdAt).toISOString(),
      expiresAt: this.expiresAt,
      expiresAtISO: new Date(this.expiresAt).toISOString(),
      isExpired: this.isExpired(),
      acceptedAt: this.acceptedAt,
      declinedAt: this.declinedAt
    };
  }

  /**
   * Create from JSON
   * @param {Object} data - JSON data
   * @returns {TeamInvite} Invite instance
   */
  static fromJSON(data) {
    return new TeamInvite(data);
  }

  /**
   * Generate unique invite ID
   * @private
   * @returns {string} Invite ID
   */
  _generateInviteId() {
    return `inv_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
  }
}

// =============================================================================
// ActivityEvent Class
// =============================================================================

/**
 * ActivityEvent - Represents a team activity event
 */
class ActivityEvent {
  /**
   * Create an ActivityEvent instance
   * @param {Object} options - Event options
   */
  constructor(options = {}) {
    this.id = options.id || this._generateEventId();
    this.sessionId = options.sessionId;
    this.type = options.type;
    this.userId = options.userId;
    this.userName = options.userName || 'Unknown User';
    this.timestamp = options.timestamp || Date.now();
    this.data = options.data || {};
  }

  /**
   * Convert to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      sessionId: this.sessionId,
      type: this.type,
      userId: this.userId,
      userName: this.userName,
      timestamp: this.timestamp,
      timestampISO: new Date(this.timestamp).toISOString(),
      data: this.data
    };
  }

  /**
   * Create from JSON
   * @param {Object} data - JSON data
   * @returns {ActivityEvent} Event instance
   */
  static fromJSON(data) {
    return new ActivityEvent(data);
  }

  /**
   * Generate unique event ID
   * @private
   * @returns {string} Event ID
   */
  _generateEventId() {
    return `evt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
  }
}

// =============================================================================
// TeamManager Class
// =============================================================================

/**
 * TeamManager - Manages team members and activity
 */
class TeamManager {
  /**
   * Create a TeamManager instance
   * @param {Object} options - Manager options
   */
  constructor(options = {}) {
    this.config = {
      logger: options.logger || null,
      onMemberAdded: options.onMemberAdded || null,
      onMemberRemoved: options.onMemberRemoved || null,
      onRoleChanged: options.onRoleChanged || null,
      onActivity: options.onActivity || null
    };

    this.teams = new Map(); // sessionId -> Set of TeamMember
    this.invites = new Map(); // inviteId -> TeamInvite
    this.activities = new Map(); // sessionId -> Array of ActivityEvent
  }

  // ===========================================================================
  // Team Member Management
  // ===========================================================================

  /**
   * Add team member
   * @param {string} sessionId - Session ID
   * @param {Object} memberData - Member data
   * @returns {Promise<Object>} Add result
   */
  async addMember(sessionId, memberData) {
    const { userId, userName, userEmail, role = TeamRole.VIEWER, addedBy = null } = memberData;

    // Validate
    if (!userId || !sessionId) {
      return {
        success: false,
        error: 'sessionId and userId are required',
        timestamp: Date.now()
      };
    }

    // Check if already a member
    const team = this.teams.get(sessionId) || new Set();
    for (const member of team) {
      if (member.userId === userId) {
        return {
          success: false,
          error: 'User already a team member',
          timestamp: Date.now()
        };
      }
    }

    // Check team size
    if (team.size >= TeamConfig.MAX_TEAM_SIZE) {
      return {
        success: false,
        error: `Maximum team size (${TeamConfig.MAX_TEAM_SIZE}) reached`,
        timestamp: Date.now()
      };
    }

    // Create member
    const member = new TeamMember({
      userId,
      userName,
      userEmail,
      role,
      addedBy
    });

    // Add to team
    team.add(member);
    this.teams.set(sessionId, team);

    // Persist
    await this._saveTeam(sessionId);

    // Record activity
    await this.recordActivity(sessionId, {
      type: ActivityType.MEMBER_JOINED,
      userId,
      userName,
      data: { role }
    });

    // Notify listeners
    if (this.config.onMemberAdded) {
      this.config.onMemberAdded({
        sessionId,
        member: member.toJSON()
      });
    }

    this._log('info', `Member added: ${userId} to session ${sessionId}`);

    return {
      success: true,
      sessionId,
      member: member.toJSON(),
      timestamp: Date.now()
    };
  }

  /**
   * Remove team member
   * @param {string} sessionId - Session ID
   * @param {string} userId - User ID to remove
   * @returns {Promise<Object>} Remove result
   */
  async removeMember(sessionId, userId) {
    const team = this.teams.get(sessionId);

    if (!team) {
      return {
        success: false,
        error: 'Team not found',
        timestamp: Date.now()
      };
    }

    let removedMember = null;
    for (const member of team) {
      if (member.userId === userId) {
        removedMember = member;
        team.delete(member);
        break;
      }
    }

    if (!removedMember) {
      return {
        success: false,
        error: 'User not found in team',
        timestamp: Date.now()
      };
    }

    // Persist
    await this._saveTeam(sessionId);

    // Record activity
    await this.recordActivity(sessionId, {
      type: ActivityType.MEMBER_LEFT,
      userId,
      userName: removedMember.userName,
      data: {}
    });

    // Notify listeners
    if (this.config.onMemberRemoved) {
      this.config.onMemberRemoved({
        sessionId,
        userId
      });
    }

    this._log('info', `Member removed: ${userId} from session ${sessionId}`);

    return {
      success: true,
      sessionId,
      userId,
      removed: true,
      timestamp: Date.now()
    };
  }

  /**
   * Update member role
   * @param {string} sessionId - Session ID
   * @param {string} userId - User ID
   * @param {string} newRole - New role
   * @returns {Promise<Object>} Update result
   */
  async updateMemberRole(sessionId, userId, newRole) {
    const team = this.teams.get(sessionId);

    if (!team) {
      return {
        success: false,
        error: 'Team not found',
        timestamp: Date.now()
      };
    }

    let member = null;
    for (const m of team) {
      if (m.userId === userId) {
        member = m;
        break;
      }
    }

    if (!member) {
      return {
        success: false,
        error: 'User not found in team',
        timestamp: Date.now()
      };
    }

    const result = member.updateRole(newRole);

    if (!result.success) {
      return {
        ...result,
        timestamp: Date.now()
      };
    }

    // Persist
    await this._saveTeam(sessionId);

    // Record activity
    await this.recordActivity(sessionId, {
      type: ActivityType.ROLE_CHANGED,
      userId,
      userName: member.userName,
      data: {
        oldRole: result.oldRole,
        newRole: result.newRole
      }
    });

    // Notify listeners
    if (this.config.onRoleChanged) {
      this.config.onRoleChanged({
        sessionId,
        userId,
        oldRole: result.oldRole,
        newRole: result.newRole
      });
    }

    this._log('info', `Role updated: ${userId} in session ${sessionId} to ${newRole}`);

    return {
      success: true,
      sessionId,
      userId,
      role: newRole,
      timestamp: Date.now()
    };
  }

  /**
   * Get team members
   * @param {string} sessionId - Session ID
   * @returns {Array} Team members
   */
  getTeamMembers(sessionId) {
    const team = this.teams.get(sessionId) || new Set();
    return Array.from(team).map(member => member.toJSON());
  }

  // ===========================================================================
  // Invite Management
  // ===========================================================================

  /**
   * Send invite
   * @param {string} sessionId - Session ID
   * @param {Object} inviteData - Invite data
   * @returns {Promise<Object>} Invite result
   */
  async sendInvite(sessionId, inviteData) {
    const { email, role = TeamRole.VIEWER, invitedBy = null } = inviteData;

    if (!email) {
      return {
        success: false,
        error: 'Email is required',
        timestamp: Date.now()
      };
    }

    // Create invite
    const invite = new TeamInvite({
      sessionId,
      invitedEmail: email,
      invitedBy,
      role
    });

    // Store invite
    this.invites.set(invite.id, invite);

    // Persist
    await this._saveInvite(invite);

    this._log('info', `Invite sent: ${invite.id} to ${email}`);

    return {
      success: true,
      inviteId: invite.id,
      invite: invite.toJSON(),
      timestamp: Date.now()
    };
  }

  /**
   * Accept invite
   * @param {string} inviteId - Invite ID
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Accept result
   */
  async acceptInvite(inviteId, userData) {
    const invite = this.invites.get(inviteId);

    if (!invite) {
      return {
        success: false,
        error: 'Invite not found',
        timestamp: Date.now()
      };
    }

    const result = invite.accept();

    if (!result.success) {
      return {
        ...result,
        timestamp: Date.now()
      };
    }

    // Add to team
    await this.addMember(invite.sessionId, {
      ...userData,
      role: invite.role,
      addedBy: invite.invitedBy
    });

    // Persist
    await this._saveInvite(invite);

    this._log('info', `Invite accepted: ${inviteId}`);

    return {
      success: true,
      inviteId,
      sessionId: invite.sessionId,
      timestamp: Date.now()
    };
  }

  // ===========================================================================
  // Activity Feed
  // ===========================================================================

  /**
   * Record activity
   * @param {string} sessionId - Session ID
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} Record result
   */
  async recordActivity(sessionId, eventData) {
    const event = new ActivityEvent({
      sessionId,
      ...eventData
    });

    // Get or create activity feed
    if (!this.activities.has(sessionId)) {
      this.activities.set(sessionId, []);
    }

    const feed = this.activities.get(sessionId);
    feed.push(event);

    // Limit feed size
    if (feed.length > TeamConfig.MAX_ACTIVITY_FEED_SIZE) {
      feed.shift();
    }

    // Persist (latest 100 only)
    await this._saveActivity(sessionId);

    // Notify listeners
    if (this.config.onActivity) {
      this.config.onActivity(event.toJSON());
    }

    return {
      success: true,
      eventId: event.id,
      timestamp: Date.now()
    };
  }

  /**
   * Get activity feed
   * @param {string} sessionId - Session ID
   * @param {Object} options - Query options
   * @returns {Array} Activity events
   */
  getActivityFeed(sessionId, options = {}) {
    const { limit = 50, offset = 0, type = null } = options;

    let feed = this.activities.get(sessionId) || [];

    // Filter by type if specified
    if (type) {
      feed = feed.filter(event => event.type === type);
    }

    // Sort by timestamp (newest first)
    feed.sort((a, b) => b.timestamp - a.timestamp);

    // Pagination
    feed = feed.slice(offset, offset + limit);

    return feed.map(event => event.toJSON());
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
   * Save team to storage
   * @private
   * @param {string} sessionId - Session ID
   */
  async _saveTeam(sessionId) {
    const storage = this._getStorage();
    const key = `${TeamConfig.STORAGE_KEY_TEAMS}_${sessionId}`;
    const team = this.teams.get(sessionId);

    if (team) {
      const members = Array.from(team).map(m => m.toJSON());
      try {
        await storage.set({ [key]: members });
      } catch (error) {
        this._log('error', `Failed to save team ${sessionId}: ${error.message}`);
      }
    }
  }

  /**
   * Save invite to storage
   * @private
   * @param {TeamInvite} invite - Invite to save
   */
  async _saveInvite(invite) {
    const storage = this._getStorage();
    const key = `${TeamConfig.STORAGE_KEY_INVITES}_${invite.id}`;

    try {
      await storage.set({ [key]: invite.toJSON() });
    } catch (error) {
      this._log('error', `Failed to save invite ${invite.id}: ${error.message}`);
    }
  }

  /**
   * Save activity feed to storage
   * @private
   * @param {string} sessionId - Session ID
   */
  async _saveActivity(sessionId) {
    const storage = this._getStorage();
    const key = `${TeamConfig.STORAGE_KEY_ACTIVITY}_${sessionId}`;
    const feed = this.activities.get(sessionId);

    if (feed) {
      // Only save latest 100 events
      const recentEvents = feed.slice(-100).map(e => e.toJSON());
      try {
        await storage.set({ [key]: recentEvents });
      } catch (error) {
        this._log('error', `Failed to save activity ${sessionId}: ${error.message}`);
      }
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
      console[level]('[TeamManager]', message);
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

if (typeof globalThis !== 'undefined') {
  globalThis.TeamConfig = TeamConfig;
  globalThis.TeamRole = TeamRole;
  globalThis.InviteStatus = InviteStatus;
  globalThis.ActivityType = ActivityType;
  globalThis.TeamMember = TeamMember;
  globalThis.TeamInvite = TeamInvite;
  globalThis.ActivityEvent = ActivityEvent;
  globalThis.TeamManager = TeamManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TeamConfig,
    TeamRole,
    InviteStatus,
    ActivityType,
    TeamMember,
    TeamInvite,
    ActivityEvent,
    TeamManager
  };
}
