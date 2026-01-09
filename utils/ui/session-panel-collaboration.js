/**
 * Basset Hound Browser Automation - Session Panel Collaboration UI
 * Phase 18.1: Collaboration UI Extensions for Session Panel
 *
 * Provides UI components for collaboration features:
 * - Team member display and presence indicators
 * - Comments interface with threading
 * - Assignments view and management
 * - Session sharing controls
 *
 * @module session-panel-collaboration
 */

// =============================================================================
// Collaboration State
// =============================================================================

const collaborationState = {
  teamMembers: [],
  activeUsers: [],
  comments: [],
  assignments: [],
  shareLinks: [],
  currentTab: 'team'
};

// =============================================================================
// Collaboration HTML Generators
// =============================================================================

/**
 * Get collaboration tabs HTML
 * @param {Object} panel - Panel instance
 * @returns {string} HTML string
 */
function getCollaborationHTML(panel) {
  if (!panel.state.activeSession) {
    return '<div class="collab-empty">No active session</div>';
  }

  return `
    <div class="collaboration-container">
      <div class="collaboration-tabs">
        <button class="collab-tab ${collaborationState.currentTab === 'team' ? 'active' : ''}" data-tab="team">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          Team
        </button>
        <button class="collab-tab ${collaborationState.currentTab === 'comments' ? 'active' : ''}" data-tab="comments">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Comments
        </button>
        <button class="collab-tab ${collaborationState.currentTab === 'assignments' ? 'active' : ''}" data-tab="assignments">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          Tasks
        </button>
        <button class="collab-tab ${collaborationState.currentTab === 'share' ? 'active' : ''}" data-tab="share">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          Share
        </button>
      </div>

      <div class="collaboration-content">
        ${getActiveTabContent()}
      </div>
    </div>
  `;
}

/**
 * Get active tab content
 * @returns {string} HTML string
 */
function getActiveTabContent() {
  switch (collaborationState.currentTab) {
    case 'team':
      return getTeamPanelHTML();
    case 'comments':
      return getCommentsPanelHTML();
    case 'assignments':
      return getAssignmentsPanelHTML();
    case 'share':
      return getSharePanelHTML();
    default:
      return '';
  }
}

/**
 * Get team panel HTML
 * @returns {string} HTML string
 */
function getTeamPanelHTML() {
  const activeCount = collaborationState.activeUsers.length;
  const totalCount = collaborationState.teamMembers.length;

  return `
    <div class="collab-panel-content">
      <div class="panel-header">
        <h3>Team Members</h3>
        <span class="team-count">${activeCount}/${totalCount} online</span>
      </div>

      ${collaborationState.activeUsers.length > 0 ? `
        <div class="presence-section">
          <h4>Currently Active</h4>
          ${collaborationState.activeUsers.map(user => `
            <div class="presence-indicator">
              <span class="presence-dot online"></span>
              <span class="presence-name">${escapeHtml(user.userName)}</span>
              <span class="presence-status">${escapeHtml(user.status)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="team-list-section">
        <h4>All Members</h4>
        ${collaborationState.teamMembers.length > 0 ? `
          <div class="team-list">
            ${collaborationState.teamMembers.map(member => `
              <div class="team-member">
                <div class="member-avatar">${member.userName.charAt(0).toUpperCase()}</div>
                <div class="member-info">
                  <span class="member-name">${escapeHtml(member.userName)}</span>
                  <span class="member-role">${member.role}</span>
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<p class="empty-state">No team members yet</p>'}
      </div>

      <button class="collab-primary-btn" data-action="invite-member">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="8.5" cy="7" r="4"/>
          <line x1="20" y1="8" x2="20" y2="14"/>
          <line x1="23" y1="11" x2="17" y2="11"/>
        </svg>
        Invite Member
      </button>
    </div>
  `;
}

/**
 * Get comments panel HTML
 * @returns {string} HTML string
 */
function getCommentsPanelHTML() {
  return `
    <div class="collab-panel-content">
      <div class="panel-header">
        <h3>Comments</h3>
        <span class="comment-count">${collaborationState.comments.length}</span>
      </div>

      <div class="comment-input-section">
        <textarea class="comment-textarea" placeholder="Add a comment... Use @username to mention" data-input="comment" rows="3"></textarea>
        <button class="collab-primary-btn" data-action="post-comment">Post Comment</button>
      </div>

      <div class="comments-list">
        ${collaborationState.comments.length > 0 ? `
          ${collaborationState.comments.map(comment => `
            <div class="comment-item" data-comment-id="${comment.id}">
              <div class="comment-avatar">${comment.authorName.charAt(0).toUpperCase()}</div>
              <div class="comment-body">
                <div class="comment-header">
                  <span class="comment-author">${escapeHtml(comment.authorName)}</span>
                  <span class="comment-time">${formatTimeAgo(comment.createdAt)}</span>
                </div>
                <div class="comment-content">${comment.contentHtml || escapeHtml(comment.content)}</div>
                <div class="comment-actions">
                  <button class="comment-action" data-action="reply-comment" data-id="${comment.id}">Reply</button>
                  <button class="comment-action" data-action="react-comment" data-id="${comment.id}">React</button>
                </div>
                ${comment.replies && comment.replies.length > 0 ? `
                  <div class="comment-replies">
                    ${comment.replies.map(reply => `
                      <div class="comment-reply">
                        <span class="reply-author">${escapeHtml(reply.authorName)}</span>
                        <span class="reply-content">${escapeHtml(reply.content)}</span>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        ` : '<p class="empty-state">No comments yet. Be the first to comment!</p>'}
      </div>
    </div>
  `;
}

/**
 * Get assignments panel HTML
 * @returns {string} HTML string
 */
function getAssignmentsPanelHTML() {
  const byStatus = {
    pending: collaborationState.assignments.filter(a => a.status === 'pending'),
    in_progress: collaborationState.assignments.filter(a => a.status === 'in_progress'),
    completed: collaborationState.assignments.filter(a => a.status === 'completed')
  };

  return `
    <div class="collab-panel-content">
      <div class="panel-header">
        <h3>Assignments</h3>
        <div class="assignment-stats">
          <span class="stat-badge pending">${byStatus.pending.length}</span>
          <span class="stat-badge in-progress">${byStatus.in_progress.length}</span>
          <span class="stat-badge completed">${byStatus.completed.length}</span>
        </div>
      </div>

      <div class="assignments-list">
        ${collaborationState.assignments.length > 0 ? `
          ${collaborationState.assignments.map(assignment => `
            <div class="assignment-card ${assignment.status} ${assignment.isOverdue ? 'overdue' : ''}" data-assignment-id="${assignment.id}">
              <div class="assignment-header">
                <span class="assignment-title">${escapeHtml(assignment.title)}</span>
                <span class="assignment-priority priority-${assignment.priority}">${assignment.priority}</span>
              </div>
              <div class="assignment-meta">
                <span class="assignment-assignee">👤 ${escapeHtml(assignment.assignedTo)}</span>
                <span class="assignment-due ${assignment.isOverdue ? 'overdue' : ''}">
                  📅 ${new Date(assignment.dueDate).toLocaleDateString()}
                </span>
              </div>
              ${assignment.description ? `
                <div class="assignment-description">${escapeHtml(assignment.description)}</div>
              ` : ''}
              <div class="assignment-footer">
                <button class="assignment-btn" data-action="view-assignment" data-id="${assignment.id}">
                  View Details
                </button>
                ${assignment.status === 'pending' ? `
                  <button class="assignment-btn primary" data-action="start-assignment" data-id="${assignment.id}">
                    Start
                  </button>
                ` : ''}
                ${assignment.status === 'in_progress' ? `
                  <button class="assignment-btn success" data-action="complete-assignment" data-id="${assignment.id}">
                    Complete
                  </button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        ` : '<p class="empty-state">No assignments yet</p>'}
      </div>

      <button class="collab-primary-btn" data-action="create-assignment">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Create Assignment
      </button>
    </div>
  `;
}

/**
 * Get share panel HTML
 * @returns {string} HTML string
 */
function getSharePanelHTML() {
  return `
    <div class="collab-panel-content">
      <div class="panel-header">
        <h3>Share Session</h3>
      </div>

      <div class="share-options">
        <div class="share-option" data-action="create-share-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          <div class="option-content">
            <h4>Generate Share Link</h4>
            <p>Create a link to share this session with others</p>
          </div>
        </div>

        <div class="share-option" data-action="export-encrypted">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <div class="option-content">
            <h4>Encrypted Export</h4>
            <p>Export session data with encryption</p>
          </div>
        </div>
      </div>

      ${collaborationState.shareLinks.length > 0 ? `
        <div class="active-shares">
          <h4>Active Share Links</h4>
          ${collaborationState.shareLinks.map(share => `
            <div class="share-link-card" data-share-id="${share.id}">
              <div class="share-code-display">
                <code>${share.shareCode}</code>
                <button class="copy-btn" data-action="copy-code" data-code="${share.shareCode}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              </div>
              <div class="share-meta">
                <span class="share-permission">${share.permission}</span>
                <span class="share-expires">Expires: ${new Date(share.expiresAt).toLocaleDateString()}</span>
                <span class="share-uses">${share.currentUses || 0} uses</span>
              </div>
              <button class="share-revoke-btn" data-action="revoke-share" data-share-id="${share.id}">
                Revoke
              </button>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (div) {
    div.textContent = text;
    return div.innerHTML;
  }
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format timestamp as "time ago"
 * @param {number} timestamp - Timestamp
 * @returns {string} Formatted string
 */
function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Initialize collaboration UI
 * @param {Object} panel - Panel instance
 * @returns {Promise} Initialization promise
 */
async function initializeCollaborationUI(panel) {
  console.log('[Collaboration UI] Initializing...');

  try {
    // Load collaboration data
    await Promise.all([
      loadTeamMembers(panel),
      loadComments(panel),
      loadAssignments(panel),
      loadShareLinks(panel)
    ]);

    // Setup event listeners
    setupCollaborationEventListeners(panel);

    console.log('[Collaboration UI] Initialized successfully');
    return { success: true };
  } catch (error) {
    console.error('[Collaboration UI] Initialization failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Load team members
 * @param {Object} panel - Panel instance
 * @returns {Promise} Load promise
 */
async function loadTeamMembers(panel) {
  if (!panel.state.activeSession) return;

  const response = await panel._sendMessage({
    type: 'get_team_members',
    sessionId: panel.state.activeSession.id
  });

  if (response && response.success) {
    collaborationState.teamMembers = response.members || [];
  }
}

/**
 * Load comments
 * @param {Object} panel - Panel instance
 * @returns {Promise} Load promise
 */
async function loadComments(panel) {
  if (!panel.state.activeSession) return;

  const response = await panel._sendMessage({
    type: 'get_comments',
    sessionId: panel.state.activeSession.id
  });

  if (response && response.success) {
    collaborationState.comments = response.comments || [];
  }
}

/**
 * Load assignments
 * @param {Object} panel - Panel instance
 * @returns {Promise} Load promise
 */
async function loadAssignments(panel) {
  if (!panel.state.activeSession) return;

  const response = await panel._sendMessage({
    type: 'get_assignments',
    sessionId: panel.state.activeSession.id
  });

  if (response && response.success) {
    collaborationState.assignments = response.assignments || [];
  }
}

/**
 * Load share links
 * @param {Object} panel - Panel instance
 * @returns {Promise} Load promise
 */
async function loadShareLinks(panel) {
  if (!panel.state.activeSession) return;

  const response = await panel._sendMessage({
    type: 'get_share_links',
    sessionId: panel.state.activeSession.id
  });

  if (response && response.success) {
    collaborationState.shareLinks = response.shares || [];
  }
}

/**
 * Setup collaboration event listeners
 * @param {Object} panel - Panel instance
 */
function setupCollaborationEventListeners(panel) {
  // Listen for tab switches
  document.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) {
      collaborationState.currentTab = tabBtn.dataset.tab;
      panel._updatePanel();
    }
  });

  // Listen for real-time updates
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (!message || !message.type) return;

      switch (message.type) {
        case 'collaboration_update':
          handleCollaborationUpdate(panel, message);
          break;
        case 'presence_update':
          handlePresenceUpdate(panel, message);
          break;
      }
    });
  }
}

/**
 * Handle collaboration update
 * @param {Object} panel - Panel instance
 * @param {Object} message - Update message
 */
function handleCollaborationUpdate(panel, message) {
  const { eventType } = message;

  switch (eventType) {
    case 'comment_added':
      loadComments(panel).then(() => panel._updatePanel());
      break;
    case 'assignment_created':
    case 'assignment_updated':
      loadAssignments(panel).then(() => panel._updatePanel());
      break;
    case 'member_joined':
    case 'member_left':
      loadTeamMembers(panel).then(() => panel._updatePanel());
      break;
    case 'share_created':
      loadShareLinks(panel).then(() => panel._updatePanel());
      break;
  }
}

/**
 * Handle presence update
 * @param {Object} panel - Panel instance
 * @param {Object} message - Presence message
 */
function handlePresenceUpdate(panel, message) {
  collaborationState.activeUsers = message.activeUsers || [];
  if (collaborationState.currentTab === 'team') {
    panel._updatePanel();
  }
}

// =============================================================================
// Exports
// =============================================================================

if (typeof globalThis !== 'undefined') {
  globalThis.collaborationState = collaborationState;
  globalThis.getCollaborationHTML = getCollaborationHTML;
  globalThis.initializeCollaborationUI = initializeCollaborationUI;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    collaborationState,
    getCollaborationHTML,
    initializeCollaborationUI
  };
}

console.log('[Collaboration UI] Module loaded');
