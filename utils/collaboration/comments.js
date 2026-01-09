/**
 * Basset Hound Browser Automation - Comments System
 * Phase 18.1: Collaboration Features (Comments and Notes)
 *
 * Provides commenting functionality for evidence items:
 * - Add comments to evidence items
 * - Reply to comments (threaded discussions)
 * - @mention team members
 * - Comment timestamps and author tracking
 * - Edit/delete own comments
 * - Comment notifications
 *
 * @module comments
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * Comments configuration
 * @constant {Object}
 */
const CommentsConfig = {
  // Comment settings
  MAX_COMMENT_LENGTH: 5000,
  MAX_THREAD_DEPTH: 5,
  MAX_MENTIONS_PER_COMMENT: 10,

  // Storage keys
  STORAGE_KEY_COMMENTS: 'collaboration_comments',
  STORAGE_KEY_COMMENT_INDEX: 'collaboration_comment_index'
};

/**
 * Comment types
 * @enum {string}
 */
const CommentType = {
  COMMENT: 'comment',
  REPLY: 'reply',
  NOTE: 'note',
  SYSTEM: 'system'
};

// =============================================================================
// Comment Class
// =============================================================================

/**
 * Comment - Represents a comment on evidence or session
 */
class Comment {
  /**
   * Create a Comment instance
   * @param {Object} options - Comment options
   */
  constructor(options = {}) {
    this.id = options.id || this._generateCommentId();
    this.sessionId = options.sessionId;
    this.evidenceId = options.evidenceId || null;
    this.parentId = options.parentId || null; // For threaded replies
    this.type = options.type || CommentType.COMMENT;

    // Content
    this.content = options.content || '';
    this.contentHtml = options.contentHtml || null; // Processed HTML with mentions

    // Author
    this.authorId = options.authorId;
    this.authorName = options.authorName || 'Unknown User';

    // Timestamps
    this.createdAt = options.createdAt || Date.now();
    this.updatedAt = options.updatedAt || null;
    this.deletedAt = options.deletedAt || null;

    // Metadata
    this.mentions = options.mentions || []; // Array of mentioned user IDs
    this.attachments = options.attachments || []; // Array of attachment URLs
    this.reactions = options.reactions || {}; // emoji -> [userIds]

    // Thread info
    this.replies = options.replies || []; // Array of reply IDs
    this.replyCount = options.replyCount || 0;

    // Status
    this.isEdited = options.isEdited || false;
    this.isDeleted = options.isDeleted || false;
    this.isPinned = options.isPinned || false;
  }

  // ===========================================================================
  // Content Management
  // ===========================================================================

  /**
   * Update comment content
   * @param {string} newContent - New content
   * @returns {Object} Update result
   */
  updateContent(newContent) {
    if (this.isDeleted) {
      return {
        success: false,
        error: 'Cannot edit deleted comment'
      };
    }

    if (newContent.length > CommentsConfig.MAX_COMMENT_LENGTH) {
      return {
        success: false,
        error: `Comment exceeds maximum length of ${CommentsConfig.MAX_COMMENT_LENGTH} characters`
      };
    }

    this.content = newContent;
    this.contentHtml = this._processContent(newContent);
    this.mentions = this._extractMentions(newContent);
    this.updatedAt = Date.now();
    this.isEdited = true;

    return {
      success: true,
      commentId: this.id,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Mark comment as deleted
   * @returns {Object} Delete result
   */
  markDeleted() {
    this.isDeleted = true;
    this.deletedAt = Date.now();
    this.content = '[Deleted]';
    this.contentHtml = '<em>[Deleted]</em>';

    return {
      success: true,
      commentId: this.id,
      deletedAt: this.deletedAt
    };
  }

  /**
   * Add reaction to comment
   * @param {string} emoji - Reaction emoji
   * @param {string} userId - User ID adding reaction
   * @returns {Object} Reaction result
   */
  addReaction(emoji, userId) {
    if (!this.reactions[emoji]) {
      this.reactions[emoji] = [];
    }

    if (!this.reactions[emoji].includes(userId)) {
      this.reactions[emoji].push(userId);
    }

    return {
      success: true,
      commentId: this.id,
      emoji,
      count: this.reactions[emoji].length
    };
  }

  /**
   * Remove reaction from comment
   * @param {string} emoji - Reaction emoji
   * @param {string} userId - User ID removing reaction
   * @returns {Object} Reaction result
   */
  removeReaction(emoji, userId) {
    if (this.reactions[emoji]) {
      this.reactions[emoji] = this.reactions[emoji].filter(id => id !== userId);

      if (this.reactions[emoji].length === 0) {
        delete this.reactions[emoji];
      }
    }

    return {
      success: true,
      commentId: this.id,
      emoji,
      count: this.reactions[emoji]?.length || 0
    };
  }

  /**
   * Pin/unpin comment
   * @param {boolean} pinned - Pin state
   */
  setPinned(pinned) {
    this.isPinned = pinned;
  }

  /**
   * Add reply to comment
   * @param {string} replyId - Reply comment ID
   */
  addReply(replyId) {
    if (!this.replies.includes(replyId)) {
      this.replies.push(replyId);
      this.replyCount = this.replies.length;
    }
  }

  // ===========================================================================
  // Content Processing
  // ===========================================================================

  /**
   * Process comment content (convert mentions, links, etc.)
   * @private
   * @param {string} content - Raw content
   * @returns {string} Processed HTML
   */
  _processContent(content) {
    let html = this._escapeHtml(content);

    // Convert @mentions to links
    html = html.replace(/@(\w+)/g, '<span class="mention" data-user="$1">@$1</span>');

    // Convert URLs to links
    html = html.replace(
      /https?:\/\/[^\s]+/g,
      '<a href="$&" target="_blank" rel="noopener noreferrer">$&</a>'
    );

    // Convert line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  /**
   * Extract mentions from content
   * @private
   * @param {string} content - Comment content
   * @returns {Array} Array of mentioned user IDs
   */
  _extractMentions(content) {
    const mentions = [];
    const mentionRegex = /@(\w+)/g;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
      if (mentions.length >= CommentsConfig.MAX_MENTIONS_PER_COMMENT) {
        break;
      }
    }

    return [...new Set(mentions)]; // Remove duplicates
  }

  /**
   * Escape HTML special characters
   * @private
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  _escapeHtml(text) {
    const div = typeof document !== 'undefined' ? document.createElement('div') : null;
    if (div) {
      div.textContent = text;
      return div.innerHTML;
    }
    // Fallback for non-browser environments
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
      parentId: this.parentId,
      type: this.type,
      content: this.content,
      contentHtml: this.contentHtml,
      authorId: this.authorId,
      authorName: this.authorName,
      createdAt: this.createdAt,
      createdAtISO: new Date(this.createdAt).toISOString(),
      updatedAt: this.updatedAt,
      updatedAtISO: this.updatedAt ? new Date(this.updatedAt).toISOString() : null,
      deletedAt: this.deletedAt,
      mentions: this.mentions,
      attachments: this.attachments,
      reactions: this.reactions,
      replies: this.replies,
      replyCount: this.replyCount,
      isEdited: this.isEdited,
      isDeleted: this.isDeleted,
      isPinned: this.isPinned
    };
  }

  /**
   * Create from JSON
   * @param {Object} data - JSON data
   * @returns {Comment} Comment instance
   */
  static fromJSON(data) {
    return new Comment(data);
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Generate unique comment ID
   * @private
   * @returns {string} Comment ID
   */
  _generateCommentId() {
    return `cmt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
  }
}

// =============================================================================
// CommentManager Class
// =============================================================================

/**
 * CommentManager - Manages comments and threaded discussions
 */
class CommentManager {
  /**
   * Create a CommentManager instance
   * @param {Object} options - Manager options
   */
  constructor(options = {}) {
    this.config = {
      logger: options.logger || null,
      onCommentAdded: options.onCommentAdded || null,
      onCommentUpdated: options.onCommentUpdated || null,
      onMention: options.onMention || null
    };

    this.comments = new Map();
    this.sessionIndex = new Map(); // sessionId -> Set of comment IDs
    this.evidenceIndex = new Map(); // evidenceId -> Set of comment IDs
    this.threadIndex = new Map(); // parentId -> Set of reply IDs
  }

  // ===========================================================================
  // Comment Management
  // ===========================================================================

  /**
   * Add a comment
   * @param {string} sessionId - Session ID
   * @param {string} content - Comment content
   * @param {Object} options - Comment options
   * @returns {Promise<Object>} Add result
   */
  async addComment(sessionId, content, options = {}) {
    const {
      evidenceId = null,
      parentId = null,
      authorId = null,
      authorName = null,
      type = CommentType.COMMENT
    } = options;

    // Validate content
    if (!content || content.trim().length === 0) {
      return {
        success: false,
        error: 'Comment content is required',
        timestamp: Date.now()
      };
    }

    if (content.length > CommentsConfig.MAX_COMMENT_LENGTH) {
      return {
        success: false,
        error: `Comment exceeds maximum length of ${CommentsConfig.MAX_COMMENT_LENGTH} characters`,
        timestamp: Date.now()
      };
    }

    // Check thread depth if replying
    if (parentId) {
      const depth = await this._getThreadDepth(parentId);
      if (depth >= CommentsConfig.MAX_THREAD_DEPTH) {
        return {
          success: false,
          error: `Maximum thread depth (${CommentsConfig.MAX_THREAD_DEPTH}) reached`,
          timestamp: Date.now()
        };
      }
    }

    // Create comment
    const comment = new Comment({
      sessionId,
      evidenceId,
      parentId,
      content,
      authorId,
      authorName,
      type
    });

    // Process content
    comment.contentHtml = comment._processContent(content);
    comment.mentions = comment._extractMentions(content);

    // Store comment
    this.comments.set(comment.id, comment);

    // Update indices
    if (!this.sessionIndex.has(sessionId)) {
      this.sessionIndex.set(sessionId, new Set());
    }
    this.sessionIndex.get(sessionId).add(comment.id);

    if (evidenceId) {
      if (!this.evidenceIndex.has(evidenceId)) {
        this.evidenceIndex.set(evidenceId, new Set());
      }
      this.evidenceIndex.get(evidenceId).add(comment.id);
    }

    if (parentId) {
      if (!this.threadIndex.has(parentId)) {
        this.threadIndex.set(parentId, new Set());
      }
      this.threadIndex.get(parentId).add(comment.id);

      // Update parent with reply
      const parent = this.comments.get(parentId);
      if (parent) {
        parent.addReply(comment.id);
        await this._saveComment(parent);
      }
    }

    // Persist
    await this._saveComment(comment);

    // Notify listeners
    if (this.config.onCommentAdded) {
      this.config.onCommentAdded(comment.toJSON());
    }

    // Handle mentions
    if (comment.mentions.length > 0 && this.config.onMention) {
      for (const mentionedUser of comment.mentions) {
        this.config.onMention({
          commentId: comment.id,
          mentionedUserId: mentionedUser,
          authorId: comment.authorId,
          sessionId,
          evidenceId,
          content: comment.content
        });
      }
    }

    this._log('info', `Comment added: ${comment.id}`);

    return {
      success: true,
      commentId: comment.id,
      comment: comment.toJSON(),
      timestamp: Date.now()
    };
  }

  /**
   * Update a comment
   * @param {string} commentId - Comment ID
   * @param {string} newContent - New content
   * @param {string} userId - User ID making the update
   * @returns {Promise<Object>} Update result
   */
  async updateComment(commentId, newContent, userId) {
    const comment = this.comments.get(commentId);

    if (!comment) {
      return {
        success: false,
        error: 'Comment not found',
        timestamp: Date.now()
      };
    }

    // Check permission (only author can edit)
    if (comment.authorId !== userId) {
      return {
        success: false,
        error: 'Not authorized to edit this comment',
        timestamp: Date.now()
      };
    }

    // Update content
    const result = comment.updateContent(newContent);

    if (!result.success) {
      return {
        ...result,
        timestamp: Date.now()
      };
    }

    // Persist
    await this._saveComment(comment);

    // Notify listeners
    if (this.config.onCommentUpdated) {
      this.config.onCommentUpdated(comment.toJSON());
    }

    // Handle new mentions
    if (comment.mentions.length > 0 && this.config.onMention) {
      for (const mentionedUser of comment.mentions) {
        this.config.onMention({
          commentId: comment.id,
          mentionedUserId: mentionedUser,
          authorId: comment.authorId,
          sessionId: comment.sessionId,
          evidenceId: comment.evidenceId,
          content: comment.content
        });
      }
    }

    this._log('info', `Comment updated: ${commentId}`);

    return {
      success: true,
      commentId,
      comment: comment.toJSON(),
      timestamp: Date.now()
    };
  }

  /**
   * Delete a comment
   * @param {string} commentId - Comment ID
   * @param {string} userId - User ID making the deletion
   * @returns {Promise<Object>} Delete result
   */
  async deleteComment(commentId, userId) {
    const comment = this.comments.get(commentId);

    if (!comment) {
      return {
        success: false,
        error: 'Comment not found',
        timestamp: Date.now()
      };
    }

    // Check permission (only author can delete)
    if (comment.authorId !== userId) {
      return {
        success: false,
        error: 'Not authorized to delete this comment',
        timestamp: Date.now()
      };
    }

    // Mark as deleted (soft delete)
    comment.markDeleted();

    // Persist
    await this._saveComment(comment);

    // Notify listeners
    if (this.config.onCommentUpdated) {
      this.config.onCommentUpdated(comment.toJSON());
    }

    this._log('info', `Comment deleted: ${commentId}`);

    return {
      success: true,
      commentId,
      deleted: true,
      timestamp: Date.now()
    };
  }

  /**
   * Add reaction to comment
   * @param {string} commentId - Comment ID
   * @param {string} emoji - Reaction emoji
   * @param {string} userId - User ID adding reaction
   * @returns {Promise<Object>} Reaction result
   */
  async addReaction(commentId, emoji, userId) {
    const comment = this.comments.get(commentId);

    if (!comment) {
      return {
        success: false,
        error: 'Comment not found',
        timestamp: Date.now()
      };
    }

    const result = comment.addReaction(emoji, userId);
    await this._saveComment(comment);

    return {
      ...result,
      timestamp: Date.now()
    };
  }

  /**
   * Remove reaction from comment
   * @param {string} commentId - Comment ID
   * @param {string} emoji - Reaction emoji
   * @param {string} userId - User ID removing reaction
   * @returns {Promise<Object>} Reaction result
   */
  async removeReaction(commentId, emoji, userId) {
    const comment = this.comments.get(commentId);

    if (!comment) {
      return {
        success: false,
        error: 'Comment not found',
        timestamp: Date.now()
      };
    }

    const result = comment.removeReaction(emoji, userId);
    await this._saveComment(comment);

    return {
      ...result,
      timestamp: Date.now()
    };
  }

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * Get comments for evidence
   * @param {string} evidenceId - Evidence ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Comments list
   */
  async getEvidenceComments(evidenceId, options = {}) {
    const { includeReplies = true, sortBy = 'createdAt', sortOrder = 'asc' } = options;

    const commentIds = this.evidenceIndex.get(evidenceId) || new Set();
    let comments = [];

    for (const commentId of commentIds) {
      const comment = this.comments.get(commentId);
      if (comment && !comment.parentId) { // Top-level comments only
        comments.push(comment.toJSON());
      }
    }

    // Sort comments
    comments.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Include replies if requested
    if (includeReplies) {
      for (const comment of comments) {
        comment.replies = await this._getCommentThread(comment.id);
      }
    }

    return {
      success: true,
      evidenceId,
      comments,
      totalComments: comments.length,
      timestamp: Date.now()
    };
  }

  /**
   * Get comments for session
   * @param {string} sessionId - Session ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Comments list
   */
  async getSessionComments(sessionId, options = {}) {
    const { limit = 100, offset = 0 } = options;

    const commentIds = this.sessionIndex.get(sessionId) || new Set();
    let comments = [];

    for (const commentId of commentIds) {
      const comment = this.comments.get(commentId);
      if (comment && !comment.isDeleted) {
        comments.push(comment.toJSON());
      }
    }

    // Sort by creation time (newest first)
    comments.sort((a, b) => b.createdAt - a.createdAt);

    // Pagination
    const totalCount = comments.length;
    comments = comments.slice(offset, offset + limit);

    return {
      success: true,
      sessionId,
      comments,
      pagination: {
        total: totalCount,
        offset,
        limit,
        returned: comments.length
      },
      timestamp: Date.now()
    };
  }

  /**
   * Get comment thread (all replies)
   * @private
   * @param {string} commentId - Parent comment ID
   * @returns {Promise<Array>} Thread of comments
   */
  async _getCommentThread(commentId) {
    const thread = [];
    const replyIds = this.threadIndex.get(commentId) || new Set();

    for (const replyId of replyIds) {
      const reply = this.comments.get(replyId);
      if (reply) {
        const replyData = reply.toJSON();
        // Recursively get nested replies
        replyData.replies = await this._getCommentThread(replyId);
        thread.push(replyData);
      }
    }

    // Sort by creation time
    thread.sort((a, b) => a.createdAt - b.createdAt);

    return thread;
  }

  /**
   * Get thread depth
   * @private
   * @param {string} commentId - Comment ID
   * @returns {Promise<number>} Thread depth
   */
  async _getThreadDepth(commentId) {
    let depth = 0;
    let currentId = commentId;

    while (currentId) {
      const comment = this.comments.get(currentId);
      if (!comment) break;

      depth++;
      currentId = comment.parentId;

      if (depth > CommentsConfig.MAX_THREAD_DEPTH) {
        break;
      }
    }

    return depth;
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
   * Save comment to storage
   * @private
   * @param {Comment} comment - Comment to save
   */
  async _saveComment(comment) {
    const storage = this._getStorage();
    const key = `${CommentsConfig.STORAGE_KEY_COMMENTS}_${comment.id}`;

    try {
      await storage.set({ [key]: comment.toJSON() });
    } catch (error) {
      this._log('error', `Failed to save comment ${comment.id}: ${error.message}`);
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
      console[level]('[CommentManager]', message);
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

if (typeof globalThis !== 'undefined') {
  globalThis.CommentsConfig = CommentsConfig;
  globalThis.CommentType = CommentType;
  globalThis.Comment = Comment;
  globalThis.CommentManager = CommentManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CommentsConfig,
    CommentType,
    Comment,
    CommentManager
  };
}
