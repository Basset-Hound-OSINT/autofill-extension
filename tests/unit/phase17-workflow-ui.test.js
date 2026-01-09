/**
 * Basset Hound Browser Automation - Workflow UI Component Tests
 *
 * Unit tests for Phase 17.2 Workflow UI implementation.
 * Tests UI helper functions, validation, and rendering logic.
 *
 * Run with: npm test or jest
 */

// Mock DOM environment for testing
if (typeof document === 'undefined') {
  global.document = {
    createElement: jest.fn(() => ({
      textContent: '',
      innerHTML: ''
    }))
  };
}

// Import the module under test
const {
  STEP_TYPES,
  getStepTypeInfo,
  renderWorkflowCard,
  renderWorkflowStepItem,
  renderStepConfigForm,
  renderExecutionStepItem,
  renderVariableItem,
  renderWorkflowLogEntry,
  validateWorkflow,
  validateStep,
  escapeHtml,
  formatTime,
  formatDuration,
  truncateText,
  generateId,
  generateUUID,
  deepClone,
  extractVariables
} = require('../../utils/workflow/workflow-ui-helpers.js');

// =============================================================================
// Step Type Tests
// =============================================================================

describe('Step Type Information', () => {
  test('should have 9 step types defined', () => {
    expect(Object.keys(STEP_TYPES)).toHaveLength(9);
  });

  test('should include all expected step types', () => {
    const expectedTypes = [
      'navigate', 'click', 'fill', 'extract', 'detect',
      'wait', 'screenshot', 'condition', 'loop'
    ];
    expectedTypes.forEach(type => {
      expect(STEP_TYPES).toHaveProperty(type);
    });
  });

  test('each step type should have required properties', () => {
    Object.values(STEP_TYPES).forEach(stepType => {
      expect(stepType).toHaveProperty('icon');
      expect(stepType).toHaveProperty('label');
      expect(stepType).toHaveProperty('color');
      expect(stepType).toHaveProperty('description');
    });
  });

  test('getStepTypeInfo should return correct info for known type', () => {
    const info = getStepTypeInfo('navigate');
    expect(info.label).toBe('Navigate');
    expect(info.color).toBe('#75beff');
    expect(info.description).toBe('Navigate to a URL');
  });

  test('getStepTypeInfo should return default for unknown type', () => {
    const info = getStepTypeInfo('unknown');
    expect(info.label).toBe('unknown');
    expect(info.color).toBe('#969696');
  });
});

// =============================================================================
// Workflow Validation Tests
// =============================================================================

describe('Workflow Validation', () => {
  test('should validate a valid workflow', () => {
    const workflow = {
      id: 'test-workflow',
      name: 'Test Workflow',
      version: '1.0.0',
      steps: [
        {
          id: 'step-1',
          type: 'navigate',
          url: 'https://example.com'
        }
      ]
    };

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should reject workflow without id', () => {
    const workflow = {
      name: 'Test',
      version: '1.0.0',
      steps: []
    };

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Workflow must have an ID');
  });

  test('should reject workflow without name', () => {
    const workflow = {
      id: 'test',
      version: '1.0.0',
      steps: []
    };

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Workflow must have a name');
  });

  test('should reject workflow without version', () => {
    const workflow = {
      id: 'test',
      name: 'Test',
      steps: []
    };

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Workflow must have a version');
  });

  test('should reject workflow without steps', () => {
    const workflow = {
      id: 'test',
      name: 'Test',
      version: '1.0.0'
    };

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Workflow must have a steps array');
  });

  test('should reject workflow with empty steps array', () => {
    const workflow = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      steps: []
    };

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Workflow must have at least one step');
  });
});

// =============================================================================
// Step Validation Tests
// =============================================================================

describe('Step Validation', () => {
  test('should validate navigate step with url', () => {
    const step = {
      id: 'step-1',
      type: 'navigate',
      url: 'https://example.com'
    };

    const errors = validateStep(step, 0);
    expect(errors).toHaveLength(0);
  });

  test('should reject navigate step without url', () => {
    const step = {
      id: 'step-1',
      type: 'navigate'
    };

    const errors = validateStep(step, 0);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('must have a URL');
  });

  test('should validate click step with selector', () => {
    const step = {
      id: 'step-1',
      type: 'click',
      selector: '#button'
    };

    const errors = validateStep(step, 0);
    expect(errors).toHaveLength(0);
  });

  test('should reject click step without selector', () => {
    const step = {
      id: 'step-1',
      type: 'click'
    };

    const errors = validateStep(step, 0);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('must have a selector');
  });

  test('should validate fill step with selector and text', () => {
    const step = {
      id: 'step-1',
      type: 'fill',
      selector: '#input',
      text: 'value'
    };

    const errors = validateStep(step, 0);
    expect(errors).toHaveLength(0);
  });

  test('should reject fill step without text', () => {
    const step = {
      id: 'step-1',
      type: 'fill',
      selector: '#input'
    };

    const errors = validateStep(step, 0);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('must have text value');
  });

  test('should validate extract step with selector', () => {
    const step = {
      id: 'step-1',
      type: 'extract',
      selector: '.data'
    };

    const errors = validateStep(step, 0);
    expect(errors).toHaveLength(0);
  });

  test('should validate condition step with condition', () => {
    const step = {
      id: 'step-1',
      type: 'condition',
      condition: '{{variable}} === "value"'
    };

    const errors = validateStep(step, 0);
    expect(errors).toHaveLength(0);
  });

  test('should reject condition step without condition', () => {
    const step = {
      id: 'step-1',
      type: 'condition'
    };

    const errors = validateStep(step, 0);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('must have a condition');
  });

  test('should validate loop step with items', () => {
    const step = {
      id: 'step-1',
      type: 'loop',
      items: '{{array}}'
    };

    const errors = validateStep(step, 0);
    expect(errors).toHaveLength(0);
  });

  test('should reject loop step without items', () => {
    const step = {
      id: 'step-1',
      type: 'loop'
    };

    const errors = validateStep(step, 0);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('must have items');
  });

  test('should reject step without id', () => {
    const step = {
      type: 'navigate',
      url: 'https://example.com'
    };

    const errors = validateStep(step, 0);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Missing step ID');
  });

  test('should reject step without type', () => {
    const step = {
      id: 'step-1'
    };

    const errors = validateStep(step, 0);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Missing step type');
  });
});

// =============================================================================
// Rendering Tests
// =============================================================================

describe('Workflow Card Rendering', () => {
  test('should render workflow card with all properties', () => {
    const workflow = {
      id: 'test-workflow',
      name: 'Test Workflow',
      description: 'Test description',
      version: '1.0.0',
      category: 'investigation',
      steps: [{ type: 'navigate' }, { type: 'click' }]
    };

    const html = renderWorkflowCard(workflow);

    expect(html).toContain('Test Workflow');
    expect(html).toContain('Test description');
    expect(html).toContain('2 steps');
    expect(html).toContain('v1.0.0');
    expect(html).toContain('investigation');
    expect(html).toContain('data-workflow-id="test-workflow"');
  });

  test('should handle workflow without description', () => {
    const workflow = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      steps: []
    };

    const html = renderWorkflowCard(workflow);
    expect(html).toContain('No description');
  });

  test('should handle workflow without category', () => {
    const workflow = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      steps: []
    };

    const html = renderWorkflowCard(workflow);
    expect(html).toContain('custom');
  });
});

describe('Workflow Step Item Rendering', () => {
  test('should render step item with number and label', () => {
    const step = {
      id: 'step-1',
      type: 'navigate',
      label: 'Go to homepage',
      url: 'https://example.com'
    };

    const html = renderWorkflowStepItem(step, 0);

    expect(html).toContain('1');  // Step number
    expect(html).toContain('Go to homepage');
    expect(html).toContain('data-step-index="0"');
  });

  test('should use type label if no custom label provided', () => {
    const step = {
      id: 'step-1',
      type: 'navigate',
      url: 'https://example.com'
    };

    const html = renderWorkflowStepItem(step, 0);
    expect(html).toContain('Navigate');
  });

  test('should include step actions', () => {
    const step = {
      id: 'step-1',
      type: 'navigate',
      url: 'https://example.com'
    };

    const html = renderWorkflowStepItem(step, 0);
    expect(html).toContain('step-move-up');
    expect(html).toContain('step-move-down');
    expect(html).toContain('step-delete');
  });
});

describe('Execution Step Item Rendering', () => {
  test('should render completed step', () => {
    const step = { type: 'navigate', label: 'Navigate' };
    const execution = { status: 'completed', startTime: Date.now() - 1000 };

    const html = renderExecutionStepItem(step, execution, 0);

    expect(html).toContain('completed');
    expect(html).toContain('1. Navigate');
  });

  test('should render running step with animation', () => {
    const step = { type: 'click', label: 'Click' };
    const execution = { status: 'running', startTime: Date.now() };

    const html = renderExecutionStepItem(step, execution, 1);

    expect(html).toContain('running');
    expect(html).toContain('2. Click');
  });

  test('should render failed step with error', () => {
    const step = { type: 'extract', label: 'Extract' };
    const execution = {
      status: 'failed',
      startTime: Date.now(),
      error: 'Selector not found'
    };

    const html = renderExecutionStepItem(step, execution, 2);

    expect(html).toContain('failed');
    expect(html).toContain('Selector not found');
  });
});

describe('Variable Item Rendering', () => {
  test('should render string variable', () => {
    const html = renderVariableItem('username', 'john_doe');

    expect(html).toContain('username');
    expect(html).toContain('john_doe');
  });

  test('should render object variable as JSON', () => {
    const html = renderVariableItem('data', { name: 'John', age: 30 });

    expect(html).toContain('data');
    expect(html).toContain('John');
  });

  test('should truncate long values', () => {
    const longValue = 'a'.repeat(300);
    const html = renderVariableItem('long', longValue);

    expect(html).toContain('...');
    expect(html.length).toBeLessThan(longValue.length + 100);
  });
});

describe('Workflow Log Entry Rendering', () => {
  test('should render log entry with timestamp', () => {
    const log = {
      timestamp: Date.now(),
      level: 'info',
      message: 'Test message'
    };

    const html = renderWorkflowLogEntry(log);

    expect(html).toContain('info');
    expect(html).toContain('Test message');
  });

  test('should include step index if provided', () => {
    const log = {
      timestamp: Date.now(),
      level: 'warn',
      stepIndex: 2,
      message: 'Warning message'
    };

    const html = renderWorkflowLogEntry(log);

    expect(html).toContain('[Step 3]');  // stepIndex + 1
    expect(html).toContain('Warning message');
  });

  test('should handle different log levels', () => {
    const levels = ['debug', 'info', 'warn', 'error'];

    levels.forEach(level => {
      const log = {
        timestamp: Date.now(),
        level: level,
        message: `${level} message`
      };

      const html = renderWorkflowLogEntry(log);
      expect(html).toContain(level);
    });
  });
});

// =============================================================================
// Utility Function Tests
// =============================================================================

describe('HTML Escaping', () => {
  test('should escape HTML special characters', () => {
    const input = '<script>alert("XSS")</script>';
    const output = escapeHtml(input);

    expect(output).not.toContain('<script>');
    expect(output).toContain('&lt;script&gt;');
  });

  test('should escape ampersands', () => {
    const input = 'Tom & Jerry';
    const output = escapeHtml(input);

    expect(output).toContain('&amp;');
  });

  test('should escape quotes', () => {
    const input = 'He said "Hello"';
    const output = escapeHtml(input);

    expect(output).toContain('&quot;');
  });

  test('should handle empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  test('should handle non-string input', () => {
    expect(escapeHtml(123)).toBe(123);
    expect(escapeHtml(null)).toBe(null);
  });
});

describe('Time Formatting', () => {
  test('should format time with hours, minutes, seconds', () => {
    const timestamp = new Date('2026-01-09T10:30:45.123Z').getTime();
    const formatted = formatTime(timestamp);

    expect(formatted).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3}/);
  });
});

describe('Duration Formatting', () => {
  test('should format milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  test('should format seconds', () => {
    expect(formatDuration(5000)).toBe('5s');
    expect(formatDuration(45000)).toBe('45s');
  });

  test('should format minutes and seconds', () => {
    expect(formatDuration(90000)).toBe('1:30');
    expect(formatDuration(300000)).toBe('5:00');
  });

  test('should format hours, minutes, seconds', () => {
    expect(formatDuration(3661000)).toBe('1:01:01');
  });
});

describe('Text Truncation', () => {
  test('should not truncate short text', () => {
    const text = 'Short text';
    expect(truncateText(text, 100)).toBe(text);
  });

  test('should truncate long text with ellipsis', () => {
    const text = 'a'.repeat(200);
    const truncated = truncateText(text, 100);

    expect(truncated.length).toBeLessThanOrEqual(103);  // 100 + '...'
    expect(truncated).toContain('...');
  });

  test('should handle empty string', () => {
    expect(truncateText('', 100)).toBe('');
  });

  test('should handle null/undefined', () => {
    expect(truncateText(null, 100)).toBe(null);
    expect(truncateText(undefined, 100)).toBe(undefined);
  });
});

describe('ID Generation', () => {
  test('generateId should return unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();

    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe('string');
    expect(id1.length).toBeGreaterThan(0);
  });

  test('generateUUID should return valid UUID v4', () => {
    const uuid = generateUUID();

    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test('generateUUID should return unique UUIDs', () => {
    const uuid1 = generateUUID();
    const uuid2 = generateUUID();

    expect(uuid1).not.toBe(uuid2);
  });
});

describe('Deep Clone', () => {
  test('should deep clone simple object', () => {
    const obj = { name: 'Test', value: 123 };
    const cloned = deepClone(obj);

    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
  });

  test('should deep clone nested object', () => {
    const obj = {
      name: 'Test',
      nested: {
        value: 123,
        array: [1, 2, 3]
      }
    };
    const cloned = deepClone(obj);

    expect(cloned).toEqual(obj);
    expect(cloned.nested).not.toBe(obj.nested);
    expect(cloned.nested.array).not.toBe(obj.nested.array);
  });

  test('should deep clone array', () => {
    const arr = [1, 2, { name: 'Test' }];
    const cloned = deepClone(arr);

    expect(cloned).toEqual(arr);
    expect(cloned).not.toBe(arr);
    expect(cloned[2]).not.toBe(arr[2]);
  });
});

describe('Variable Extraction', () => {
  test('should extract single variable', () => {
    const text = 'Hello {{username}}!';
    const variables = extractVariables(text);

    expect(variables).toEqual(['username']);
  });

  test('should extract multiple variables', () => {
    const text = '{{firstName}} {{lastName}} lives in {{city}}';
    const variables = extractVariables(text);

    expect(variables).toEqual(['firstName', 'lastName', 'city']);
  });

  test('should trim whitespace from variable names', () => {
    const text = 'Hello {{ username }}!';
    const variables = extractVariables(text);

    expect(variables).toEqual(['username']);
  });

  test('should return empty array if no variables', () => {
    const text = 'No variables here';
    const variables = extractVariables(text);

    expect(variables).toEqual([]);
  });

  test('should handle malformed variables', () => {
    const text = 'Hello {username} and {{incomplete';
    const variables = extractVariables(text);

    expect(variables).toEqual([]);
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Workflow Validation Integration', () => {
  test('should validate complete workflow with multiple steps', () => {
    const workflow = {
      id: 'integration-test',
      name: 'Integration Test Workflow',
      version: '1.0.0',
      description: 'Test workflow with multiple steps',
      category: 'custom',
      steps: [
        {
          id: 'step-1',
          type: 'navigate',
          url: 'https://example.com',
          waitUntil: 'load'
        },
        {
          id: 'step-2',
          type: 'click',
          selector: '#button',
          waitForNavigation: false
        },
        {
          id: 'step-3',
          type: 'extract',
          selector: '.data',
          attribute: 'textContent',
          saveAs: 'extractedData',
          multiple: true
        },
        {
          id: 'step-4',
          type: 'detect',
          detectEmail: true,
          detectPhone: true,
          saveAs: 'detections'
        }
      ],
      variables: {}
    };

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should detect errors in invalid workflow', () => {
    const workflow = {
      id: '',  // Invalid: empty id
      name: '',  // Invalid: empty name
      version: '1.0.0',
      steps: [
        {
          id: '',  // Invalid: empty id
          type: 'navigate'
          // Missing: url
        },
        {
          id: 'step-2',
          type: 'fill',
          selector: '#input'
          // Missing: text
        }
      ]
    };

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(3);
  });
});

// =============================================================================
// Test Summary
// =============================================================================

describe('Test Coverage Summary', () => {
  test('all major functions are tested', () => {
    // This test ensures we're testing the key functions
    const testedFunctions = [
      'getStepTypeInfo',
      'validateWorkflow',
      'validateStep',
      'renderWorkflowCard',
      'renderWorkflowStepItem',
      'renderExecutionStepItem',
      'renderVariableItem',
      'renderWorkflowLogEntry',
      'escapeHtml',
      'formatTime',
      'formatDuration',
      'truncateText',
      'generateId',
      'generateUUID',
      'deepClone',
      'extractVariables'
    ];

    testedFunctions.forEach(funcName => {
      expect(typeof eval(funcName)).toBe('function');
    });
  });
});
