/**
 * Basset Hound Browser Automation - Assignment System
 * Phase 18.1: Collaboration Features (Evidence Assignments)
 *
 * Provides assignment functionality for evidence review:
 * - Assign evidence review to team members
 * - Assignment status tracking (pending, in progress, completed)
 * - Assignment notifications
 * - Due dates for assignments
 * - Assignment history and audit trail
 *
 * @module assignments
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * Assignments configuration
 * @constant {Object}
 */
const AssignmentsConfig = {
  // Assignment settings
  MAX_ASSIGNEES_PER_ITEM: 10,
  DEFAULT_DUE_DAYS: 7,

  // Storage keys
  STORAGE_KEY_ASSIGNMENTS: 'collaboration_assignments',
  STORAGE_KEY_ASSIGNMENT_INDEX: 'collaboration_assignment_index'
};

/**
 * Assignment status
 * @enum {string}
 */
const AssignmentStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  OVERDUE: 'overdue'
};

/**
 * Assignment priority
 * @enum {string}
 */
const AssignmentPriority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
};

// =============================================================================
// Assignment Class
// =============================================================================

/**
 * Assignment - Represents an evidence review assignment
 */
class Assignment {
  /**
   * Create an Assignment instance
   * @param {Object} options - Assignment options
   */
  constructor(options = {}) {
    this.id = options.id || this._generateAssignmentId();
    this.sessionId = options.sessionId;
    this.evidenceId = options.evidenceId;
    this.assignedTo = options.assignedTo; // User ID
    this.assignedBy = options.assignedBy; // User ID
    this.assignedAt = options.assignedAt || Date.now();

    // Assignment details
    this.title = options.title || 'Evidence Review';
    this.description = options.description || '';
    this.priority = options.priority || AssignmentPriority.MEDIUM;
    this.status = options.status || AssignmentStatus.PENDING;

    // Timing
    this.dueDate = options.dueDate || this._calculateDefaultDueDate();
    this.startedAt = options.startedAt || null;
    this.completedAt = options.completedAt || null;
    this.cancelledAt = options.cancelledAt || null;

    // Results
    this.notes = options.notes || '';
    this.findings = options.findings || [];
    this.attachments = options.attachments || [];

    // History
    this.statusHistory = options.statusHistory || [];
    this._recordStatusChange(this.status, 'Assignment created');
  }

  // ===========================================================================
  // Status Management
  // ===========================================================================

  /**
   * Update assignment status
   * @param {string} newStatus - New status
   * @param {string} notes - Status change notes
   * @returns {Object} Update result
   */
  updateStatus(newStatus, notes = '') {
    if (!Object.values(AssignmentStatus).includes(newStatus)) {
      return {
        success: false,
        error: `Invalid status: ${newStatus}`
      };
    }

    const oldStatus = this.status;
    this.status = newStatus;

    // Update timestamps based on status
    switch (newStatus) {
      case AssignmentStatus.IN_PROGRESS:
        if (!this.startedAt) {
          this.startedAt = Date.now();
        }
        break;
      case AssignmentStatus.COMPLETED:
        this.completedAt = Date.now();
        break;
      case AssignmentStatus.CANCELLED:
        this.cancelledAt = Date.now();
        break;
    }

    this._recordStatusChange(newStatus, notes || `Status changed from ${oldStatus} to ${newStatus}`);

    return {
      success: true,
      assignmentId: this.id,
      oldStatus,
      newStatus,
      timestamp: Date.now()
    };
  }

  /**
   * Start assignment
   * @returns {Object} Start result
   */
  start() {
    if (this.status !== AssignmentStatus.PENDING) {
      return {
        success: false,
        error: 'Assignment already started or completed'
      };
    }

    return this.updateStatus(AssignmentStatus.IN_PROGRESS, 'Assignment started');
  }

  /**
   * Complete assignment
   * @param {Object} completion - Completion data
   * @returns {Object} Complete result
   */
  complete(completion = {}) {
    if (this.status === AssignmentStatus.COMPLETED) {
      return {
        success: false,
        error: 'Assignment already completed'
      };
    }

    if (this.status === AssignmentStatus.CANCELLED) {
      return {
        success: false,
        error: 'Cannot complete cancelled assignment'
      };
    }

    // Record completion data
    if (completion.notes) {
      this.notes = completion.notes;
    }
    if (completion.findings) {
      this.findings = completion.findings;
    }
    if (completion.attachments) {
      this.attachments = completion.attachments;
    }

    return this.updateStatus(AssignmentStatus.COMPLETED, 'Assignment completed');
  }

  /**
   * Cancel assignment
   * @param {string} reason - Cancellation reason
   * @returns {Object} Cancel result
   */
  cancel(reason = '') {
    if (this.status === AssignmentStatus.COMPLETED) {
      return {
        success: false,
        error: 'Cannot cancel completed assignment'
      };
    }

    if (this.status === AssignmentStatus.CANCELLED) {
      return {
        success: false,
        error: 'Assignment already cancelled'
      };
    }

    return this.updateStatus(AssignmentStatus.CANCELLED, reason || 'Assignment cancelled');
  }

  /**
   * Check if assignment is overdue
   * @returns {boolean} Is overdue
   */
  isOverdue() {
    if (this.status === AssignmentStatus.COMPLETED || this.status === AssignmentStatus.CANCELLED) {
      return false;
    }
    return Date.now() > this.dueDate;
  }

  /**
   * Get time until due
   * @returns {number} Milliseconds until due (negative if overdue)
   */
  getTimeUntilDue() {
    return this.dueDate - Date.now();
  }

  /**
   * Get duration
   * @returns {number|null} Duration in milliseconds, or null if not completed
   */
  getDuration() {
    if (!this.startedAt) return null;
    const endTime = this.completedAt || Date.now();
    return endTime - this.startedAt;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Record status change in history
   * @private
   * @param {string} status - New status
   * @param {string} notes - Change notes
   */
  _recordStatusChange(status, notes) {
    this.statusHistory.push({
      status,
      notes,
      timestamp: Date.now(),
      timestampISO: new Date().toISOString()
    });

    // Limit history size
    if (this.statusHistory.length > 100) {
      this.statusHistory = this.statusHistory.slice(-100);
    }
  }

  /**
   * Calculate default due date
   * @private
   * @returns {number} Due date timestamp
   */
  _calculateDefaultDueDate() {
    return Date.now() + (AssignmentsConfig.DEFAULT_DUE_DAYS * 24 * 60 * 60 * 1000);
  }

  /**
   * Generate unique assignment ID
   * @private
   * @returns {string} Assignment ID
   */
  _generateAssignmentId() {
    return `asg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  /**
   * Convert to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      sessionId: this.sessionId,
      evidenceId: this.evidenceId,
      assignedTo: this.assignedTo,
      assignedBy: this.assignedBy,
      assignedAt: this.assignedAt,
      assignedAtISO: new Date(this.assignedAt).toISOString(),
      title: this.title,
      description: this.description,
      priority: this.priority,
      status: this.status,
      dueDate: this.dueDate,
      dueDateISO: new Date(this.dueDate).toISOString(),
      isOverdue: this.isOverdue(),
      timeUntilDue: this.getTimeUntilDue(),
      startedAt: this.startedAt,
      startedAtISO: this.startedAt ? new Date(this.startedAt).toISOString() : null,
      completedAt: this.completedAt,
      completedAtISO: this.completedAt ? new Date(this.completedAt).toISOString() : null,
      cancelledAt: this.cancelledAt,
      duration: this.getDuration(),
      notes: this.notes,
      findings: this.findings,
      attachments: this.attachments,
      statusHistory: this.statusHistory
    };
  }

  /**
   * Create from JSON
   * @param {Object} data - JSON data
   * @returns {Assignment} Assignment instance
   */
  static fromJSON(data) {
    return new Assignment(data);
  }
}

// =============================================================================
// AssignmentManager Class
// =============================================================================

/**
 * AssignmentManager - Manages evidence review assignments
 */
class AssignmentManager {
  /**
   * Create an AssignmentManager instance
   * @param {Object} options - Manager options
   */
  constructor(options = {}) {
    this.config = {
      logger: options.logger || null,
      onAssignmentCreated: options.onAssignmentCreated || null,
      onAssignmentUpdated: options.onAssignmentUpdated || null,
      onAssignmentCompleted: options.onAssignmentCompleted || null
    };

    this.assignments = new Map();
    this.sessionIndex = new Map(); // sessionId -> Set of assignment IDs
    this.evidenceIndex = new Map(); // evidenceId -> Set of assignment IDs
    this.userIndex = new Map(); // userId -> Set of assignment IDs (assigned to)
  }

  // ===========================================================================
  // Assignment Management
  // ===========================================================================

  /**
   * Create an assignment
   * @param {Object} assignmentData - Assignment data
   * @returns {Promise<Object>} Create result
   */
  async createAssignment(assignmentData) {
    const {
      sessionId,
      evidenceId,
      assignedTo,
      assignedBy,
      title,
      description,
      priority = AssignmentPriority.MEDIUM,
      dueDate = null
    } = assignmentData;

    // Validate required fields
    if (!sessionId || !evidenceId || !assignedTo) {
      return {
        success: false,
        error: 'sessionId, evidenceId, and assignedTo are required',
        timestamp: Date.now()
      };
    }

    // Check existing assignments for this evidence
    const existingAssignments = this.getEvidenceAssignments(evidenceId);
    const activeAssignment = existingAssignments.find(
      a => a.assignedTo === assignedTo &&
           (a.status === AssignmentStatus.PENDING || a.status === AssignmentStatus.IN_PROGRESS)
    );

    if (activeAssignment) {
      return {
        success: false,
        error: 'User already has an active assignment for this evidence',
        existingAssignmentId: activeAssignment.id,
        timestamp: Date.now()
      };
    }

    // Create assignment
    const assignment = new Assignment({
      sessionId,
      evidenceId,
      assignedTo,
      assignedBy,
      title,
      description,
      priority,
      dueDate
    });

    // Store assignment
    this.assignments.set(assignment.id, assignment);

    // Update indices
    if (!this.sessionIndex.has(sessionId)) {
      this.sessionIndex.set(sessionId, new Set());
    }
    this.sessionIndex.get(sessionId).add(assignment.id);

    if (!this.evidenceIndex.has(evidenceId)) {
      this.evidenceIndex.set(evidenceId, new Set());
    }
    this.evidenceIndex.get(evidenceId).add(assignment.id);

    if (!this.userIndex.has(assignedTo)) {
      this.userIndex.set(assignedTo, new Set());
    }
    this.userIndex.get(assignedTo).add(assignment.id);

    // Persist
    await this._saveAssignment(assignment);

    // Notify listeners
    if (this.config.onAssignmentCreated) {
      this.config.onAssignmentCreated(assignment.toJSON());
    }

    this._log('info', `Assignment created: ${assignment.id}`);

    return {
      success: true,
      assignmentId: assignment.id,
      assignment: assignment.toJSON(),
      timestamp: Date.now()
    };
  }

  /**
   * Update assignment status
   * @param {string} assignmentId - Assignment ID
   * @param {string} status - New status
   * @param {Object} data - Additional update data
   * @returns {Promise<Object>} Update result
   */
  async updateAssignmentStatus(assignmentId, status, data = {}) {
    const assignment = this.assignments.get(assignmentId);

    if (!assignment) {
      return {
        success: false,
        error: 'Assignment not found',
        timestamp: Date.now()
      };
    }

    let result;
    switch (status) {
      case AssignmentStatus.IN_PROGRESS:
        result = assignment.start();
        break;
      case AssignmentStatus.COMPLETED:
        result = assignment.complete(data);
        break;
      case AssignmentStatus.CANCELLED:
        result = assignment.cancel(data.reason);
        break;
      default:
        result = assignment.updateStatus(status, data.notes);
    }

    if (!result.success) {
      return {
        ...result,
        timestamp: Date.now()
      };
    }

    // Persist
    await this._saveAssignment(assignment);

    // Notify listeners
    if (this.config.onAssignmentUpdated) {
      this.config.onAssignmentUpdated(assignment.toJSON());
    }

    if (status === AssignmentStatus.COMPLETED && this.config.onAssignmentCompleted) {
      this.config.onAssignmentCompleted(assignment.toJSON());
    }

    this._log('info', `Assignment ${assignmentId} status updated to ${status}`);

    return {
      success: true,
      assignmentId,
      assignment: assignment.toJSON(),
      timestamp: Date.now()
    };
  }

  /**
   * Get assignments for user
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Array} User assignments
   */
  getUserAssignments(userId, filters = {}) {
    const { status = null, includeOverdue = true } = filters;

    const assignmentIds = this.userIndex.get(userId) || new Set();
    const assignments = [];

    for (const assignmentId of assignmentIds) {
      const assignment = this.assignments.get(assignmentId);
      if (assignment) {
        // Apply status filter
        if (status && assignment.status !== status) {
          continue;
        }

        // Check if overdue
        if (assignment.isOverdue() && !includeOverdue) {
          continue;
        }

        assignments.push(assignment.toJSON());
      }
    }

    // Sort by due date (soonest first)
    assignments.sort((a, b) => a.dueDate - b.dueDate);

    return assignments;
  }

  /**
   * Get assignments for evidence
   * @param {string} evidenceId - Evidence ID
   * @returns {Array} Evidence assignments
   */
  getEvidenceAssignments(evidenceId) {
    const assignmentIds = this.evidenceIndex.get(evidenceId) || new Set();
    const assignments = [];

    for (const assignmentId of assignmentIds) {
      const assignment = this.assignments.get(assignmentId);
      if (assignment) {
        assignments.push(assignment.toJSON());
      }
    }

    // Sort by creation date (newest first)
    assignments.sort((a, b) => b.assignedAt - a.assignedAt);

    return assignments;
  }

  /**
   * Get assignments for session
   * @param {string} sessionId - Session ID
   * @param {Object} filters - Filter options
   * @returns {Array} Session assignments
   */
  getSessionAssignments(sessionId, filters = {}) {
    const { status = null, priority = null } = filters;

    const assignmentIds = this.sessionIndex.get(sessionId) || new Set();
    const assignments = [];

    for (const assignmentId of assignmentIds) {
      const assignment = this.assignments.get(assignmentId);
      if (assignment) {
        // Apply filters
        if (status && assignment.status !== status) {
          continue;
        }
        if (priority && assignment.priority !== priority) {
          continue;
        }

        assignments.push(assignment.toJSON());
      }
    }

    return assignments;
  }

  /**
   * Get overdue assignments
   * @param {string} sessionId - Session ID (optional)
   * @returns {Array} Overdue assignments
   */
  getOverdueAssignments(sessionId = null) {
    const assignments = [];

    for (const assignment of this.assignments.values()) {
      if (sessionId && assignment.sessionId !== sessionId) {
        continue;
      }

      if (assignment.isOverdue()) {
        assignments.push(assignment.toJSON());
      }
    }

    // Sort by how overdue (most overdue first)
    assignments.sort((a, b) => a.dueDate - b.dueDate);

    return assignments;
  }

  /**
   * Get assignment statistics for session
   * @param {string} sessionId - Session ID
   * @returns {Object} Assignment statistics
   */
  getSessionStatistics(sessionId) {
    const assignments = this.getSessionAssignments(sessionId);

    const stats = {
      total: assignments.length,
      byStatus: {},
      byPriority: {},
      overdue: 0,
      avgCompletionTime: 0
    };

    let totalCompletionTime = 0;
    let completedCount = 0;

    for (const assignment of assignments) {
      // Count by status
      stats.byStatus[assignment.status] = (stats.byStatus[assignment.status] || 0) + 1;

      // Count by priority
      stats.byPriority[assignment.priority] = (stats.byPriority[assignment.priority] || 0) + 1;

      // Count overdue
      if (assignment.isOverdue) {
        stats.overdue++;
      }

      // Calculate avg completion time
      if (assignment.status === AssignmentStatus.COMPLETED && assignment.duration) {
        totalCompletionTime += assignment.duration;
        completedCount++;
      }
    }

    if (completedCount > 0) {
      stats.avgCompletionTime = totalCompletionTime / completedCount;
    }

    return stats;
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
   * Save assignment to storage
   * @private
   * @param {Assignment} assignment - Assignment to save
   */
  async _saveAssignment(assignment) {
    const storage = this._getStorage();
    const key = `${AssignmentsConfig.STORAGE_KEY_ASSIGNMENTS}_${assignment.id}`;

    try {
      await storage.set({ [key]: assignment.toJSON() });
    } catch (error) {
      this._log('error', `Failed to save assignment ${assignment.id}: ${error.message}`);
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
      console[level]('[AssignmentManager]', message);
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

if (typeof globalThis !== 'undefined') {
  globalThis.AssignmentsConfig = AssignmentsConfig;
  globalThis.AssignmentStatus = AssignmentStatus;
  globalThis.AssignmentPriority = AssignmentPriority;
  globalThis.Assignment = Assignment;
  globalThis.AssignmentManager = AssignmentManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AssignmentsConfig,
    AssignmentStatus,
    AssignmentPriority,
    Assignment,
    AssignmentManager
  };
}
