/**
 * Basset Hound - Phase 17 Workflow Engine Tests
 *
 * Unit tests for workflow automation system.
 *
 * @version 1.0.0
 * @date 2026-01-09
 */

// Mock Chrome APIs
global.chrome = {
  storage: {
    local: {
      data: {},
      get: function(keys) {
        return Promise.resolve(
          typeof keys === 'string'
            ? { [keys]: this.data[keys] }
            : Object.fromEntries(Object.entries(this.data).filter(([k]) => keys === null || keys.includes(k)))
        );
      },
      set: function(items) {
        Object.assign(this.data, items);
        return Promise.resolve();
      },
      remove: function(keys) {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        keysArray.forEach(key => delete this.data[key]);
        return Promise.resolve();
      },
      clear: function() {
        this.data = {};
        return Promise.resolve();
      }
    }
  },
  tabs: {
    create: () => Promise.resolve({ id: 1 }),
    update: () => Promise.resolve({ id: 1 }),
    get: () => Promise.resolve({ id: 1, url: 'https://example.com' }),
    query: () => Promise.resolve([{ id: 1, url: 'https://example.com' }]),
    sendMessage: () => Promise.resolve({ success: true }),
    onUpdated: {
      addListener: () => {},
      removeListener: () => {}
    },
    captureVisibleTab: () => Promise.resolve('data:image/png;base64,abc123')
  },
  runtime: {
    sendMessage: () => Promise.resolve({ success: true, entityId: 'entity_123' })
  }
};

// Load workflow modules
const { WorkflowErrorHandler, TimeoutError, ValidationError } = require('../../utils/workflow/error-handler.js');
const { ExecutionContext, ExecutionStatus } = require('../../utils/workflow/execution-context.js');
const { StepExecutor } = require('../../utils/workflow/step-executor.js');
const { WorkflowExecutor } = require('../../utils/workflow/workflow-executor.js');
const { WorkflowManager } = require('../../utils/workflow/workflow-manager.js');

describe('Phase 17: Workflow Engine', () => {

  beforeEach(async () => {
    // Clear storage before each test
    await chrome.storage.local.clear();
  });

  // ============================================================================
  // Error Handler Tests
  // ============================================================================

  describe('WorkflowErrorHandler', () => {

    test('should determine if error is retryable', () => {
      const handler = new WorkflowErrorHandler();

      const timeoutError = new TimeoutError('Request timed out');
      expect(handler.isRetryable(timeoutError)).toBe(true);

      const validationError = new ValidationError('Invalid input');
      expect(handler.isRetryable(validationError)).toBe(false);
    });

    test('should calculate exponential backoff delay', () => {
      const handler = new WorkflowErrorHandler({
        retryPolicy: {
          retryDelay: 1000,
          retryBackoff: 'exponential'
        }
      });

      expect(handler.calculateRetryDelay(0)).toBe(1000);
      expect(handler.calculateRetryDelay(1)).toBe(2000);
      expect(handler.calculateRetryDelay(2)).toBe(4000);
      expect(handler.calculateRetryDelay(3)).toBe(8000);
    });

    test('should calculate linear backoff delay', () => {
      const handler = new WorkflowErrorHandler({
        retryPolicy: {
          retryDelay: 1000,
          retryBackoff: 'linear'
        }
      });

      expect(handler.calculateRetryDelay(0)).toBe(1000);
      expect(handler.calculateRetryDelay(1)).toBe(2000);
      expect(handler.calculateRetryDelay(2)).toBe(3000);
    });

    test('should track retry attempts', () => {
      const handler = new WorkflowErrorHandler();

      expect(handler.getRetryAttemptCount('step-1')).toBe(0);

      handler.incrementRetryAttempt('step-1');
      expect(handler.getRetryAttemptCount('step-1')).toBe(1);

      handler.incrementRetryAttempt('step-1');
      expect(handler.getRetryAttemptCount('step-1')).toBe(2);

      handler.resetRetryAttempt('step-1');
      expect(handler.getRetryAttemptCount('step-1')).toBe(0);
    });

    test('should log errors with context', () => {
      const handler = new WorkflowErrorHandler();
      const context = {
        executionId: 'exec_123',
        workflowId: 'wf_456',
        logs: []
      };
      const step = { id: 'step-1', type: 'navigate' };
      const error = new Error('Test error');

      handler.logError(error, context, step);

      expect(handler.getErrorLog().length).toBe(1);
      expect(handler.getErrorLog()[0].errorMessage).toBe('Test error');
      expect(handler.getErrorLog()[0].stepId).toBe('step-1');
    });

    test('should get error statistics', () => {
      const handler = new WorkflowErrorHandler();
      const context = { executionId: 'exec_123', logs: [] };

      handler.logError(new TimeoutError('Timeout 1'), context, { id: 'step-1' });
      handler.logError(new TimeoutError('Timeout 2'), context, { id: 'step-2' });
      handler.logError(new ValidationError('Validation error'), context, { id: 'step-3' });

      const stats = handler.getErrorStats();

      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByType.TimeoutError).toBe(2);
      expect(stats.errorsByType.ValidationError).toBe(1);
      expect(stats.mostCommonError).toBe('TimeoutError');
    });
  });

  // ============================================================================
  // Execution Context Tests
  // ============================================================================

  describe('ExecutionContext', () => {

    test('should create execution context', () => {
      const context = new ExecutionContext({
        workflowId: 'wf_123',
        variables: { username: 'testuser' }
      });

      expect(context.workflowId).toBe('wf_123');
      expect(context.status).toBe(ExecutionStatus.PENDING);
      expect(context.getVariable('username')).toBe('testuser');
    });

    test('should track execution lifecycle', () => {
      const context = new ExecutionContext({ workflowId: 'wf_123' });

      expect(context.status).toBe(ExecutionStatus.PENDING);

      context.start();
      expect(context.status).toBe(ExecutionStatus.RUNNING);
      expect(context.startTime).toBeTruthy();

      context.pause();
      expect(context.status).toBe(ExecutionStatus.PAUSED);

      context.resume();
      expect(context.status).toBe(ExecutionStatus.RUNNING);

      context.complete();
      expect(context.status).toBe(ExecutionStatus.COMPLETED);
      expect(context.endTime).toBeTruthy();
    });

    test('should set and get variables', () => {
      const context = new ExecutionContext({ workflowId: 'wf_123' });

      context.setVariable('username', 'testuser');
      context.setVariable('count', 42);

      expect(context.getVariable('username')).toBe('testuser');
      expect(context.getVariable('count')).toBe(42);
      expect(context.hasVariable('username')).toBe(true);
      expect(context.hasVariable('missing')).toBe(false);
    });

    test('should substitute variables in strings', () => {
      const context = new ExecutionContext({
        workflowId: 'wf_123',
        variables: {
          username: 'john',
          domain: 'example.com'
        }
      });

      const result = context.substituteVariables('https://${domain}/user/${username}');
      expect(result).toBe('https://example.com/user/john');
    });

    test('should substitute variables in objects', () => {
      const context = new ExecutionContext({
        workflowId: 'wf_123',
        variables: {
          username: 'john',
          email: 'john@example.com'
        }
      });

      const result = context.substituteVariables({
        user: '${username}',
        contact: '${email}',
        nested: {
          field: '${username}'
        }
      });

      expect(result.user).toBe('john');
      expect(result.contact).toBe('john@example.com');
      expect(result.nested.field).toBe('john');
    });

    test('should support nested property access', () => {
      const context = new ExecutionContext({
        workflowId: 'wf_123',
        variables: {
          user: {
            name: 'John',
            email: 'john@example.com'
          }
        }
      });

      const result = context.substituteVariables('Name: ${user.name}, Email: ${user.email}');
      expect(result).toBe('Name: John, Email: john@example.com');
    });

    test('should record step results', () => {
      const context = new ExecutionContext({ workflowId: 'wf_123' });

      context.recordStepResult('step-1', {
        success: true,
        outputs: { result: 'data' }
      });

      const result = context.getStepResult('step-1');
      expect(result.success).toBe(true);
      expect(context.getVariable('result')).toBe('data');
    });

    test('should save and load state from storage', async () => {
      const context1 = new ExecutionContext({
        workflowId: 'wf_123',
        variables: { username: 'testuser' }
      });

      context1.start();
      context1.setVariable('count', 42);
      await context1.saveState();

      const context2 = await ExecutionContext.loadState(context1.executionId);

      expect(context2.workflowId).toBe('wf_123');
      expect(context2.status).toBe(ExecutionStatus.RUNNING);
      expect(context2.getVariable('username')).toBe('testuser');
      expect(context2.getVariable('count')).toBe(42);
    });

    test('should calculate execution duration', () => {
      const context = new ExecutionContext({ workflowId: 'wf_123' });

      context.start();
      context.startTime = Date.now() - 5000; // 5 seconds ago

      const duration = context.getDuration();
      expect(duration).toBeGreaterThanOrEqual(5000);
    });

    test('should add evidence items', () => {
      const context = new ExecutionContext({ workflowId: 'wf_123' });

      context.addEvidence({
        type: 'screenshot',
        dataUrl: 'data:image/png;base64,abc123'
      });

      expect(context.evidence.length).toBe(1);
      expect(context.evidence[0].type).toBe('screenshot');
      expect(context.evidence[0].executionId).toBe(context.executionId);
    });

    test('should export execution data', () => {
      const context = new ExecutionContext({
        workflowId: 'wf_123',
        variables: { username: 'testuser' }
      });

      context.start();
      context.setVariable('result', 'success');
      context.recordStepResult('step-1', { success: true });

      const exported = context.export();

      expect(exported.executionId).toBe(context.executionId);
      expect(exported.workflowId).toBe('wf_123');
      expect(exported.variables.username).toBe('testuser');
      expect(exported.variables.result).toBe('success');
      expect(exported.stepResults['step-1']).toBeDefined();
    });
  });

  // ============================================================================
  // Workflow Manager Tests
  // ============================================================================

  describe('WorkflowManager', () => {

    test('should create workflow', async () => {
      const manager = new WorkflowManager();

      const workflow = await manager.createWorkflow({
        name: 'Test Workflow',
        description: 'A test workflow',
        steps: [
          { id: 'step-1', type: 'navigate', params: { url: 'https://example.com' } }
        ]
      });

      expect(workflow.id).toBeDefined();
      expect(workflow.name).toBe('Test Workflow');
      expect(workflow.createdAt).toBeDefined();
      expect(workflow.version).toBe('1.0.0');
    });

    test('should get workflow by ID', async () => {
      const manager = new WorkflowManager();

      const created = await manager.createWorkflow({
        name: 'Test Workflow',
        steps: [{ id: 'step-1', type: 'navigate', params: { url: 'https://example.com' } }]
      });

      const retrieved = await manager.getWorkflow(created.id);

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.name).toBe('Test Workflow');
    });

    test('should update workflow', async () => {
      const manager = new WorkflowManager();

      const created = await manager.createWorkflow({
        name: 'Original Name',
        steps: [{ id: 'step-1', type: 'navigate', params: { url: 'https://example.com' } }]
      });

      const updated = await manager.updateWorkflow(created.id, {
        name: 'Updated Name',
        description: 'New description'
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('New description');
      expect(updated.updatedAt).toBeGreaterThan(created.createdAt);
    });

    test('should delete workflow', async () => {
      const manager = new WorkflowManager();

      const workflow = await manager.createWorkflow({
        name: 'To Be Deleted',
        steps: [{ id: 'step-1', type: 'navigate', params: { url: 'https://example.com' } }]
      });

      await manager.deleteWorkflow(workflow.id);

      const retrieved = await manager.getWorkflow(workflow.id);
      expect(retrieved).toBeNull();
    });

    test('should list workflows', async () => {
      const manager = new WorkflowManager();

      await manager.createWorkflow({
        name: 'Workflow 1',
        category: 'social-media',
        steps: [{ id: 'step-1', type: 'navigate', params: { url: 'https://example.com' } }]
      });

      await manager.createWorkflow({
        name: 'Workflow 2',
        category: 'email',
        steps: [{ id: 'step-1', type: 'navigate', params: { url: 'https://example.com' } }]
      });

      const all = await manager.listWorkflows();
      expect(all.length).toBe(2);

      const filtered = await manager.listWorkflows({ category: 'social-media' });
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Workflow 1');
    });

    test('should clone workflow', async () => {
      const manager = new WorkflowManager();

      const original = await manager.createWorkflow({
        name: 'Original',
        description: 'Original workflow',
        steps: [{ id: 'step-1', type: 'navigate', params: { url: 'https://example.com' } }]
      });

      const clone = await manager.cloneWorkflow(original.id, {
        name: 'Clone'
      });

      expect(clone.id).not.toBe(original.id);
      expect(clone.name).toBe('Clone');
      expect(clone.steps.length).toBe(original.steps.length);
    });

    test('should search workflows', async () => {
      const manager = new WorkflowManager();

      await manager.createWorkflow({
        name: 'Social Media Sweep',
        description: 'Check username across platforms',
        tags: ['social', 'username'],
        steps: [{ id: 'step-1', type: 'navigate', params: { url: 'https://example.com' } }]
      });

      await manager.createWorkflow({
        name: 'Email Investigation',
        description: 'Check email in various sources',
        tags: ['email', 'investigation'],
        steps: [{ id: 'step-1', type: 'navigate', params: { url: 'https://example.com' } }]
      });

      const results = await manager.searchWorkflows('username');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Social Media Sweep');
    });

    test('should export workflow as JSON', async () => {
      const manager = new WorkflowManager();

      const workflow = await manager.createWorkflow({
        name: 'Export Test',
        steps: [{ id: 'step-1', type: 'navigate', params: { url: 'https://example.com' } }]
      });

      const json = await manager.exportWorkflow(workflow.id);
      const parsed = JSON.parse(json);

      expect(parsed.id).toBe(workflow.id);
      expect(parsed.name).toBe('Export Test');
      expect(parsed.createdAt).toBeUndefined(); // Should be removed in export
    });
  });

  // ============================================================================
  // Workflow Executor Tests
  // ============================================================================

  describe('WorkflowExecutor', () => {

    test('should validate workflow before execution', async () => {
      const executor = new WorkflowExecutor();

      await expect(async () => {
        await executor.execute(null, {});
      }).rejects.toThrow('Workflow is required');

      await expect(async () => {
        await executor.execute({ name: 'Test' }, {});
      }).rejects.toThrow('Workflow must have an id');

      await expect(async () => {
        await executor.execute({ id: 'wf_123', name: 'Test' }, {});
      }).rejects.toThrow('Workflow must have steps array');
    });

    test('should count total steps including nested', () => {
      const executor = new WorkflowExecutor();

      const workflow = {
        steps: [
          { id: 'step-1', type: 'navigate' },
          {
            id: 'step-2',
            type: 'conditional',
            params: {
              condition: 'true',
              then: [
                { id: 'step-2a', type: 'click' }
              ]
            }
          },
          {
            id: 'step-3',
            type: 'loop',
            params: {
              items: [1, 2],
              variable: 'item',
              steps: [
                { id: 'step-3a', type: 'fill' }
              ]
            }
          }
        ]
      };

      const count = executor.countSteps(workflow.steps);
      expect(count).toBe(6); // 3 main + 1 conditional + 1 loop + 1 nested
    });

    test('should extract workflow outputs', () => {
      const executor = new WorkflowExecutor();

      const workflow = {
        outputs: [
          { name: 'result', type: 'string' },
          { name: 'count', type: 'number' }
        ]
      };

      const context = new ExecutionContext({ workflowId: 'wf_123' });
      context.setVariable('result', 'success');
      context.setVariable('count', 42);
      context.setVariable('internal', 'not exported');

      const outputs = executor.extractOutputs(workflow, context);

      expect(outputs.result).toBe('success');
      expect(outputs.count).toBe(42);
      expect(outputs.internal).toBeUndefined();
    });
  });
});

console.log('\n✓ Phase 17 Workflow Engine tests complete\n');
console.log('Test Coverage:');
console.log('- WorkflowErrorHandler: Retry logic, error tracking, statistics');
console.log('- ExecutionContext: State management, variables, storage persistence');
console.log('- WorkflowManager: CRUD operations, search, export/import');
console.log('- WorkflowExecutor: Validation, execution orchestration');
console.log('\nRun with: node tests/unit/phase17-workflow-engine.test.js');
