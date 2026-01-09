/**
 * Unit Tests for Phase 18.1: Collaboration Features
 * Tests for session sharing, real-time sync, comments, assignments, and team management
 */

const assert = require('assert');

// Mock chrome storage
global.chrome = {
  storage: {
    local: {
      data: {},
      get: function(keys) {
        return new Promise((resolve) => {
          if (Array.isArray(keys)) {
            const result = {};
            keys.forEach(k => {
              if (this.data[k] !== undefined) result[k] = this.data[k];
            });
            resolve(result);
          } else {
            resolve({ [keys]: this.data[keys] });
          }
        });
      },
      set: function(items) {
        return new Promise((resolve) => {
          Object.assign(this.data, items);
          resolve();
        });
      },
      clear: function() {
        this.data = {};
        return Promise.resolve();
      }
    }
  }
};

// Import modules
require('../../utils/collaboration/session-sharing.js');
require('../../utils/collaboration/comments.js');
require('../../utils/collaboration/assignments.js');
require('../../utils/collaboration/team-manager.js');

describe('Phase 18.1: Collaboration Features', function() {

  // =============================================================================
  // Session Sharing Tests
  // =============================================================================

  describe('SessionSharingManager', function() {
    let sharingManager;
    const TEST_SESSION_ID = 'test_session_123';
    const TEST_USER_ID = 'user_001';

    beforeEach(async function() {
      sharingManager = new SessionSharingManager();
      await chrome.storage.local.clear();
    });

    it('should create a share link', async function() {
      const result = await sharingManager.createShareLink(TEST_SESSION_ID, {
        permission: PermissionLevel.VIEWER,
        shareType: ShareLinkType.TEMPORARY
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.shareCode);
      assert.ok(result.shareLink);
      assert.strictEqual(result.shareCode.length, 8);
    });

    it('should validate share access with password', async function() {
      const password = 'test123';
      const createResult = await sharingManager.createShareLink(TEST_SESSION_ID, {
        password,
        permission: PermissionLevel.CONTRIBUTOR
      });

      assert.strictEqual(createResult.success, true);

      // Access with correct password
      const accessResult = await sharingManager.accessShare(
        createResult.shareCode,
        TEST_USER_ID,
        password
      );

      assert.strictEqual(accessResult.success, true);
      assert.strictEqual(accessResult.permission, PermissionLevel.CONTRIBUTOR);
    });

    it('should deny access with incorrect password', async function() {
      const createResult = await sharingManager.createShareLink(TEST_SESSION_ID, {
        password: 'correct',
        permission: PermissionLevel.CONTRIBUTOR
      });

      const accessResult = await sharingManager.accessShare(
        createResult.shareCode,
        TEST_USER_ID,
        'wrong'
      );

      assert.strictEqual(accessResult.success, false);
    });

    it('should revoke share link', async function() {
      const createResult = await sharingManager.createShareLink(TEST_SESSION_ID);
      assert.strictEqual(createResult.success, true);

      const revokeResult = await sharingManager.revokeShare(createResult.shareId);
      assert.strictEqual(revokeResult.success, true);

      // Try to access revoked share
      const accessResult = await sharingManager.accessShare(
        createResult.shareCode,
        TEST_USER_ID
      );
      assert.strictEqual(accessResult.success, false);
    });

    it('should list session shares', async function() {
      await sharingManager.createShareLink(TEST_SESSION_ID);
      await sharingManager.createShareLink(TEST_SESSION_ID);

      const listResult = await sharingManager.listSessionShares(TEST_SESSION_ID);
      assert.strictEqual(listResult.success, true);
      assert.strictEqual(listResult.shares.length, 2);
    });
  });

  // =============================================================================
  // Comments Tests
  // =============================================================================

  describe('CommentManager', function() {
    let commentManager;
    const TEST_SESSION_ID = 'test_session_123';
    const TEST_EVIDENCE_ID = 'evidence_001';
    const TEST_USER_ID = 'user_001';

    beforeEach(async function() {
      commentManager = new CommentManager();
      await chrome.storage.local.clear();
    });

    it('should add a comment', async function() {
      const result = await commentManager.addComment(
        TEST_SESSION_ID,
        'This is a test comment',
        {
          evidenceId: TEST_EVIDENCE_ID,
          authorId: TEST_USER_ID,
          authorName: 'Test User'
        }
      );

      assert.strictEqual(result.success, true);
      assert.ok(result.commentId);
      assert.ok(result.comment);
    });

    it('should extract mentions from comment', async function() {
      const result = await commentManager.addComment(
        TEST_SESSION_ID,
        'Hey @alice and @bob, check this out!',
        {
          authorId: TEST_USER_ID,
          authorName: 'Test User'
        }
      );

      assert.strictEqual(result.success, true);
      assert.ok(result.comment.mentions.includes('alice'));
      assert.ok(result.comment.mentions.includes('bob'));
    });

    it('should add a reply to comment', async function() {
      const parentResult = await commentManager.addComment(
        TEST_SESSION_ID,
        'Parent comment',
        { authorId: TEST_USER_ID, authorName: 'User' }
      );

      const replyResult = await commentManager.addComment(
        TEST_SESSION_ID,
        'Reply to parent',
        {
          parentId: parentResult.commentId,
          authorId: 'user_002',
          authorName: 'User 2'
        }
      );

      assert.strictEqual(replyResult.success, true);
      assert.strictEqual(replyResult.comment.parentId, parentResult.commentId);
    });

    it('should update comment', async function() {
      const createResult = await commentManager.addComment(
        TEST_SESSION_ID,
        'Original content',
        { authorId: TEST_USER_ID, authorName: 'User' }
      );

      const updateResult = await commentManager.updateComment(
        createResult.commentId,
        'Updated content',
        TEST_USER_ID
      );

      assert.strictEqual(updateResult.success, true);
      assert.strictEqual(updateResult.comment.content, 'Updated content');
      assert.strictEqual(updateResult.comment.isEdited, true);
    });

    it('should add and remove reactions', async function() {
      const createResult = await commentManager.addComment(
        TEST_SESSION_ID,
        'React to this',
        { authorId: TEST_USER_ID, authorName: 'User' }
      );

      // Add reaction
      const addResult = await commentManager.addReaction(
        createResult.commentId,
        '👍',
        'user_002'
      );

      assert.strictEqual(addResult.success, true);
      assert.strictEqual(addResult.count, 1);

      // Remove reaction
      const removeResult = await commentManager.removeReaction(
        createResult.commentId,
        '👍',
        'user_002'
      );

      assert.strictEqual(removeResult.success, true);
      assert.strictEqual(removeResult.count, 0);
    });

    it('should get evidence comments', async function() {
      await commentManager.addComment(TEST_SESSION_ID, 'Comment 1', {
        evidenceId: TEST_EVIDENCE_ID,
        authorId: TEST_USER_ID,
        authorName: 'User'
      });

      await commentManager.addComment(TEST_SESSION_ID, 'Comment 2', {
        evidenceId: TEST_EVIDENCE_ID,
        authorId: TEST_USER_ID,
        authorName: 'User'
      });

      const result = await commentManager.getEvidenceComments(TEST_EVIDENCE_ID);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.comments.length, 2);
    });
  });

  // =============================================================================
  // Assignments Tests
  // =============================================================================

  describe('AssignmentManager', function() {
    let assignmentManager;
    const TEST_SESSION_ID = 'test_session_123';
    const TEST_EVIDENCE_ID = 'evidence_001';

    beforeEach(async function() {
      assignmentManager = new AssignmentManager();
      await chrome.storage.local.clear();
    });

    it('should create an assignment', async function() {
      const result = await assignmentManager.createAssignment({
        sessionId: TEST_SESSION_ID,
        evidenceId: TEST_EVIDENCE_ID,
        assignedTo: 'user_002',
        assignedBy: 'user_001',
        title: 'Review evidence',
        priority: AssignmentPriority.HIGH
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.assignmentId);
      assert.strictEqual(result.assignment.status, AssignmentStatus.PENDING);
    });

    it('should start an assignment', async function() {
      const createResult = await assignmentManager.createAssignment({
        sessionId: TEST_SESSION_ID,
        evidenceId: TEST_EVIDENCE_ID,
        assignedTo: 'user_002',
        assignedBy: 'user_001'
      });

      const startResult = await assignmentManager.updateAssignmentStatus(
        createResult.assignmentId,
        AssignmentStatus.IN_PROGRESS
      );

      assert.strictEqual(startResult.success, true);
      assert.strictEqual(startResult.assignment.status, AssignmentStatus.IN_PROGRESS);
      assert.ok(startResult.assignment.startedAt);
    });

    it('should complete an assignment', async function() {
      const createResult = await assignmentManager.createAssignment({
        sessionId: TEST_SESSION_ID,
        evidenceId: TEST_EVIDENCE_ID,
        assignedTo: 'user_002',
        assignedBy: 'user_001'
      });

      // Start first
      await assignmentManager.updateAssignmentStatus(
        createResult.assignmentId,
        AssignmentStatus.IN_PROGRESS
      );

      // Complete
      const completeResult = await assignmentManager.updateAssignmentStatus(
        createResult.assignmentId,
        AssignmentStatus.COMPLETED,
        {
          notes: 'Review completed',
          findings: ['Finding 1', 'Finding 2']
        }
      );

      assert.strictEqual(completeResult.success, true);
      assert.strictEqual(completeResult.assignment.status, AssignmentStatus.COMPLETED);
      assert.ok(completeResult.assignment.completedAt);
    });

    it('should get user assignments', function() {
      // Synchronous test with mock data
      assignmentManager.assignments.set('asg_1', {
        id: 'asg_1',
        assignedTo: 'user_002',
        status: AssignmentStatus.PENDING,
        dueDate: Date.now() + 86400000,
        isOverdue: function() { return false; },
        toJSON: function() { return { ...this, assignedAt: Date.now() }; }
      });

      const assignments = assignmentManager.getUserAssignments('user_002');
      assert.strictEqual(assignments.length, 1);
    });

    it('should detect overdue assignments', async function() {
      const pastDate = Date.now() - 86400000; // Yesterday

      const result = await assignmentManager.createAssignment({
        sessionId: TEST_SESSION_ID,
        evidenceId: TEST_EVIDENCE_ID,
        assignedTo: 'user_002',
        assignedBy: 'user_001',
        dueDate: pastDate
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.assignment.isOverdue, true);
    });
  });

  // =============================================================================
  // Team Management Tests
  // =============================================================================

  describe('TeamManager', function() {
    let teamManager;
    const TEST_SESSION_ID = 'test_session_123';

    beforeEach(async function() {
      teamManager = new TeamManager();
      await chrome.storage.local.clear();
    });

    it('should add team member', async function() {
      const result = await teamManager.addMember(TEST_SESSION_ID, {
        userId: 'user_002',
        userName: 'Test User',
        userEmail: 'test@example.com',
        role: TeamRole.INVESTIGATOR
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.member);
      assert.strictEqual(result.member.role, TeamRole.INVESTIGATOR);
    });

    it('should prevent duplicate team members', async function() {
      await teamManager.addMember(TEST_SESSION_ID, {
        userId: 'user_002',
        userName: 'Test User'
      });

      const result = await teamManager.addMember(TEST_SESSION_ID, {
        userId: 'user_002',
        userName: 'Test User'
      });

      assert.strictEqual(result.success, false);
    });

    it('should update member role', async function() {
      await teamManager.addMember(TEST_SESSION_ID, {
        userId: 'user_002',
        userName: 'Test User',
        role: TeamRole.VIEWER
      });

      const result = await teamManager.updateMemberRole(
        TEST_SESSION_ID,
        'user_002',
        TeamRole.ADMIN
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.role, TeamRole.ADMIN);
    });

    it('should remove team member', async function() {
      await teamManager.addMember(TEST_SESSION_ID, {
        userId: 'user_002',
        userName: 'Test User'
      });

      const result = await teamManager.removeMember(TEST_SESSION_ID, 'user_002');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.removed, true);
    });

    it('should send and accept invite', async function() {
      const sendResult = await teamManager.sendInvite(TEST_SESSION_ID, {
        email: 'newuser@example.com',
        role: TeamRole.INVESTIGATOR,
        invitedBy: 'user_001'
      });

      assert.strictEqual(sendResult.success, true);
      assert.ok(sendResult.inviteId);

      const acceptResult = await teamManager.acceptInvite(sendResult.inviteId, {
        userId: 'user_003',
        userName: 'New User',
        userEmail: 'newuser@example.com'
      });

      assert.strictEqual(acceptResult.success, true);
    });

    it('should record activity', async function() {
      const result = await teamManager.recordActivity(TEST_SESSION_ID, {
        type: ActivityType.EVIDENCE_ADDED,
        userId: 'user_001',
        userName: 'Test User',
        data: { evidenceId: 'ev_001' }
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.eventId);
    });

    it('should get activity feed', async function() {
      await teamManager.recordActivity(TEST_SESSION_ID, {
        type: ActivityType.EVIDENCE_ADDED,
        userId: 'user_001',
        userName: 'User 1'
      });

      await teamManager.recordActivity(TEST_SESSION_ID, {
        type: ActivityType.COMMENT_ADDED,
        userId: 'user_002',
        userName: 'User 2'
      });

      const feed = teamManager.getActivityFeed(TEST_SESSION_ID);
      assert.strictEqual(feed.length, 2);
    });

    it('should get team members list', function() {
      // Synchronous test
      const team = new Set();
      team.add(new TeamMember({
        userId: 'user_001',
        userName: 'User 1',
        role: TeamRole.OWNER
      }));
      team.add(new TeamMember({
        userId: 'user_002',
        userName: 'User 2',
        role: TeamRole.INVESTIGATOR
      }));

      teamManager.teams.set(TEST_SESSION_ID, team);

      const members = teamManager.getTeamMembers(TEST_SESSION_ID);
      assert.strictEqual(members.length, 2);
    });
  });

  // =============================================================================
  // Integration Tests
  // =============================================================================

  describe('Integration Tests', function() {
    let sharingManager, commentManager, assignmentManager, teamManager;
    const TEST_SESSION_ID = 'integration_session_001';

    beforeEach(async function() {
      sharingManager = new SessionSharingManager();
      commentManager = new CommentManager();
      assignmentManager = new AssignmentManager();
      teamManager = new TeamManager();
      await chrome.storage.local.clear();
    });

    it('should support full collaboration workflow', async function() {
      // 1. Create team
      await teamManager.addMember(TEST_SESSION_ID, {
        userId: 'user_001',
        userName: 'Owner',
        role: TeamRole.OWNER
      });

      await teamManager.addMember(TEST_SESSION_ID, {
        userId: 'user_002',
        userName: 'Investigator',
        role: TeamRole.INVESTIGATOR
      });

      // 2. Create share link
      const shareResult = await sharingManager.createShareLink(TEST_SESSION_ID, {
        permission: PermissionLevel.CONTRIBUTOR
      });
      assert.strictEqual(shareResult.success, true);

      // 3. Add comments
      const commentResult = await commentManager.addComment(
        TEST_SESSION_ID,
        '@user_002 please review this evidence',
        {
          evidenceId: 'evidence_001',
          authorId: 'user_001',
          authorName: 'Owner'
        }
      );
      assert.strictEqual(commentResult.success, true);

      // 4. Create assignment
      const assignmentResult = await assignmentManager.createAssignment({
        sessionId: TEST_SESSION_ID,
        evidenceId: 'evidence_001',
        assignedTo: 'user_002',
        assignedBy: 'user_001',
        title: 'Review flagged evidence',
        priority: AssignmentPriority.HIGH
      });
      assert.strictEqual(assignmentResult.success, true);

      // 5. Record activity
      await teamManager.recordActivity(TEST_SESSION_ID, {
        type: ActivityType.ASSIGNMENT_CREATED,
        userId: 'user_001',
        userName: 'Owner',
        data: { assignmentId: assignmentResult.assignmentId }
      });

      // Verify state
      const members = teamManager.getTeamMembers(TEST_SESSION_ID);
      assert.strictEqual(members.length, 2);

      const shares = await sharingManager.listSessionShares(TEST_SESSION_ID);
      assert.strictEqual(shares.shares.length, 1);

      const activities = teamManager.getActivityFeed(TEST_SESSION_ID);
      assert.ok(activities.length > 0);
    });
  });
});

// Run tests if executed directly
if (require.main === module) {
  console.log('Running Phase 18.1 Collaboration Tests...\n');
  // Tests would run with mocha or similar test runner
}

console.log('[Tests] Phase 18.1 Collaboration tests loaded');
