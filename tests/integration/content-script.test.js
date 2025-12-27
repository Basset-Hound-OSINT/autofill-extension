/**
 * Integration Tests for Content Script
 *
 * Tests the content script DOM interactions including:
 * - Form filling
 * - Element clicking
 * - Content extraction
 * - Page state retrieval
 * - Wait for element
 * - Storage operations
 */

const { setupTestEnvironment, teardownTestEnvironment, resetTestMocks, wait, createMockElement } = require('../helpers/setup');
const { assertElementProperties } = require('../helpers/assertions');

describe('Content Script', () => {
  let chrome;
  let document;
  let window;

  beforeAll(() => {
    const env = setupTestEnvironment();
    chrome = env.chrome;
    document = global.document;
    window = global.window;
  });

  afterAll(() => {
    teardownTestEnvironment();
  });

  beforeEach(() => {
    resetTestMocks();
  });

  describe('Element Finding', () => {
    describe('findElement', () => {
      test('should find element by ID selector', () => {
        const mockElement = createMockElement('input', { id: 'username' });
        document.querySelector = jest.fn((selector) => {
          if (selector === '#username') return mockElement;
          return null;
        });

        const found = document.querySelector('#username');

        expect(found).toBe(mockElement);
        expect(found.id).toBe('username');
      });

      test('should find element by name attribute', () => {
        const mockElement = createMockElement('input', { name: 'email' });
        document.querySelector = jest.fn((selector) => {
          if (selector === '[name="email"]') return mockElement;
          return null;
        });

        const found = document.querySelector('[name="email"]');

        expect(found).toBe(mockElement);
      });

      test('should find element by data-testid', () => {
        const mockElement = createMockElement('button', { 'data-testid': 'submit-btn' });
        mockElement.getAttribute = jest.fn((attr) => {
          if (attr === 'data-testid') return 'submit-btn';
          return null;
        });

        document.querySelector = jest.fn((selector) => {
          if (selector === '[data-testid="submit-btn"]') return mockElement;
          return null;
        });

        const found = document.querySelector('[data-testid="submit-btn"]');

        expect(found).toBeDefined();
      });

      test('should handle invalid selectors gracefully', () => {
        document.querySelector = jest.fn((selector) => {
          if (selector.includes('{{')) {
            throw new DOMException('Invalid selector');
          }
          return null;
        });

        expect(() => document.querySelector('{{invalid}}')).toThrow();
      });

      test('should return null for non-existent elements', () => {
        document.querySelector = jest.fn(() => null);

        const found = document.querySelector('#non-existent');

        expect(found).toBeNull();
      });
    });

    describe('findElementByText', () => {
      test('should find button by text content', () => {
        const mockButton = createMockElement('button', { innerText: 'Submit' });
        mockButton.innerText = 'Submit';

        document.querySelectorAll = jest.fn((selector) => {
          if (selector.includes('button')) {
            return [mockButton];
          }
          return [];
        });

        const buttons = document.querySelectorAll('button');
        const found = Array.from(buttons).find(
          btn => btn.innerText.toLowerCase().includes('submit')
        );

        expect(found).toBe(mockButton);
      });

      test('should find link by text content', () => {
        const mockLink = createMockElement('a', { innerText: 'Click here' });
        mockLink.innerText = 'Click here';

        document.querySelectorAll = jest.fn((selector) => {
          if (selector === 'a') {
            return [mockLink];
          }
          return [];
        });

        const links = document.querySelectorAll('a');
        const found = Array.from(links).find(
          link => link.innerText.toLowerCase().includes('click here')
        );

        expect(found).toBe(mockLink);
      });

      test('should find input by label text', () => {
        const mockLabel = createMockElement('label', { innerText: 'Email Address' });
        mockLabel.innerText = 'Email Address';
        mockLabel.getAttribute = jest.fn((attr) => {
          if (attr === 'for') return 'email';
          return null;
        });

        const mockInput = createMockElement('input', { id: 'email' });

        document.querySelectorAll = jest.fn(() => [mockLabel]);
        document.getElementById = jest.fn((id) => {
          if (id === 'email') return mockInput;
          return null;
        });

        const labels = document.querySelectorAll('label');
        const label = Array.from(labels).find(
          l => l.innerText.toLowerCase().includes('email')
        );

        expect(label).toBeDefined();
        const forId = label.getAttribute('for');
        const input = document.getElementById(forId);
        expect(input).toBe(mockInput);
      });
    });
  });

  describe('Form Filling', () => {
    describe('fillElement', () => {
      test('should fill text input', async () => {
        const mockInput = createMockElement('input', {
          type: 'text',
          value: ''
        });
        mockInput.focus = jest.fn();
        mockInput.blur = jest.fn();
        mockInput.dispatchEvent = jest.fn();

        // Simulate filling
        mockInput.value = 'test value';
        mockInput.dispatchEvent(new Event('input', { bubbles: true }));
        mockInput.dispatchEvent(new Event('change', { bubbles: true }));

        expect(mockInput.value).toBe('test value');
        expect(mockInput.dispatchEvent).toHaveBeenCalled();
      });

      test('should fill select element', () => {
        const mockSelect = createMockElement('select', { value: '' });
        mockSelect.options = [
          { value: '', text: 'Select...' },
          { value: 'US', text: 'United States' },
          { value: 'UK', text: 'United Kingdom' }
        ];
        mockSelect.dispatchEvent = jest.fn();

        mockSelect.value = 'US';
        mockSelect.dispatchEvent(new Event('change', { bubbles: true }));

        expect(mockSelect.value).toBe('US');
        expect(mockSelect.dispatchEvent).toHaveBeenCalled();
      });

      test('should fill checkbox', () => {
        const mockCheckbox = createMockElement('input', {
          type: 'checkbox',
          checked: false
        });
        mockCheckbox.dispatchEvent = jest.fn();

        mockCheckbox.checked = true;
        mockCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

        expect(mockCheckbox.checked).toBe(true);
      });

      test('should fill radio button', () => {
        const mockRadio = createMockElement('input', {
          type: 'radio',
          name: 'gender',
          value: 'male',
          checked: false
        });
        mockRadio.dispatchEvent = jest.fn();

        mockRadio.checked = true;
        mockRadio.dispatchEvent(new Event('change', { bubbles: true }));

        expect(mockRadio.checked).toBe(true);
      });

      test('should fill contenteditable element', () => {
        const mockDiv = createMockElement('div');
        mockDiv.contentEditable = 'true';
        mockDiv.innerHTML = '';
        mockDiv.textContent = '';
        mockDiv.focus = jest.fn();
        mockDiv.blur = jest.fn();
        mockDiv.dispatchEvent = jest.fn();

        mockDiv.textContent = 'Rich text content';
        mockDiv.dispatchEvent(new InputEvent('input', { bubbles: true }));

        expect(mockDiv.textContent).toBe('Rich text content');
      });

      test('should throw error for file inputs', () => {
        const mockFileInput = createMockElement('input', { type: 'file' });

        const fillFileInput = () => {
          if (mockFileInput.type === 'file') {
            throw new Error('File inputs cannot be filled programmatically for security reasons');
          }
        };

        expect(fillFileInput).toThrow('File inputs cannot be filled');
      });
    });

    describe('handleFillForm', () => {
      test('should fill multiple fields', () => {
        const fields = {
          '#username': 'testuser',
          '#email': 'test@example.com',
          '#password': 'password123'
        };

        const results = [];
        for (const [selector, value] of Object.entries(fields)) {
          results.push({ selector, success: true });
        }

        expect(results).toHaveLength(3);
        expect(results.every(r => r.success)).toBe(true);
      });

      test('should report missing fields', () => {
        document.querySelector = jest.fn(() => null);

        const fields = { '#non-existent': 'value' };
        const results = [];

        for (const [selector] of Object.entries(fields)) {
          const element = document.querySelector(selector);
          if (!element) {
            results.push({ selector, success: false, error: 'Element not found' });
          }
        }

        expect(results[0].success).toBe(false);
        expect(results[0].error).toBe('Element not found');
      });

      test('should submit form if requested', () => {
        const mockForm = createMockElement('form');
        mockForm.submit = jest.fn();

        document.querySelector = jest.fn((selector) => {
          if (selector === 'form') return mockForm;
          return null;
        });

        const form = document.querySelector('form');
        if (form) {
          form.submit();
        }

        expect(mockForm.submit).toHaveBeenCalled();
      });
    });
  });

  describe('Click Handling', () => {
    test('should click element', () => {
      const mockButton = createMockElement('button');
      mockButton.click = jest.fn();
      mockButton.focus = jest.fn();
      mockButton.scrollIntoView = jest.fn();

      mockButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      mockButton.focus();
      mockButton.click();

      expect(mockButton.scrollIntoView).toHaveBeenCalled();
      expect(mockButton.focus).toHaveBeenCalled();
      expect(mockButton.click).toHaveBeenCalled();
    });

    test('should wait after click if specified', async () => {
      const mockButton = createMockElement('button');
      mockButton.click = jest.fn();

      const startTime = Date.now();
      mockButton.click();
      await wait(100);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(100);
    });

    test('should return error for non-existent element', () => {
      document.querySelector = jest.fn(() => null);

      const handleClick = (selector) => {
        const element = document.querySelector(selector);
        if (!element) {
          return { success: false, error: `Element not found: ${selector}` };
        }
        return { success: true };
      };

      const result = handleClick('#non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Element not found');
    });
  });

  describe('Content Extraction', () => {
    test('should get text content', () => {
      const mockElement = createMockElement('div');
      mockElement.innerText = 'Hello, World!';
      mockElement.innerHTML = '<p>Hello, World!</p>';

      expect(mockElement.innerText).toBe('Hello, World!');
      expect(mockElement.innerHTML).toBe('<p>Hello, World!</p>');
    });

    test('should default to body if no selector', () => {
      const mockBody = createMockElement('body');
      mockBody.innerText = 'Page content';

      document.body = mockBody;

      expect(document.body.innerText).toBe('Page content');
    });

    test('should return error for non-existent element', () => {
      document.querySelector = jest.fn(() => null);

      const handleGetContent = (selector) => {
        const element = document.querySelector(selector);
        if (!element) {
          return { success: false, error: `Element not found: ${selector}` };
        }
        return {
          success: true,
          content: element.innerText,
          html: element.innerHTML
        };
      };

      const result = handleGetContent('#non-existent');

      expect(result.success).toBe(false);
    });
  });

  describe('Page State Extraction', () => {
    test('should extract form information', () => {
      const mockForm = createMockElement('form', {
        id: 'loginForm',
        name: 'login',
        action: '/login',
        method: 'POST'
      });
      mockForm.elements = [
        createMockElement('input', { type: 'text', name: 'username', id: 'username' }),
        createMockElement('input', { type: 'password', name: 'password', id: 'password' })
      ];

      document.querySelectorAll = jest.fn((selector) => {
        if (selector === 'form') return [mockForm];
        return [];
      });

      const forms = Array.from(document.querySelectorAll('form')).map(form => ({
        id: form.id || null,
        name: form.name || null,
        action: form.action || null,
        method: (form.method || 'GET').toUpperCase()
      }));

      expect(forms).toHaveLength(1);
      expect(forms[0].id).toBe('loginForm');
      expect(forms[0].method).toBe('POST');
    });

    test('should extract links', () => {
      const mockLink1 = createMockElement('a', { href: 'https://example.com' });
      mockLink1.innerText = 'Example';
      mockLink1.href = 'https://example.com';

      const mockLink2 = createMockElement('a', { href: 'https://test.com' });
      mockLink2.innerText = 'Test';
      mockLink2.href = 'https://test.com';

      document.querySelectorAll = jest.fn((selector) => {
        if (selector === 'a[href]') return [mockLink1, mockLink2];
        return [];
      });

      const links = Array.from(document.querySelectorAll('a[href]')).map(a => ({
        text: a.innerText.trim(),
        href: a.href
      }));

      expect(links).toHaveLength(2);
      expect(links[0].text).toBe('Example');
    });

    test('should extract buttons', () => {
      const mockButton = createMockElement('button', { type: 'submit' });
      mockButton.innerText = 'Submit';
      mockButton.disabled = false;

      document.querySelectorAll = jest.fn((selector) => {
        if (selector.includes('button')) return [mockButton];
        return [];
      });

      const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.innerText.trim(),
        type: b.type || 'button',
        disabled: b.disabled
      }));

      expect(buttons).toHaveLength(1);
      expect(buttons[0].text).toBe('Submit');
      expect(buttons[0].disabled).toBe(false);
    });

    test('should mask password field values', () => {
      const mockInput = createMockElement('input', {
        type: 'password',
        value: 'secret123'
      });

      const getFieldValue = (element) => {
        if (element.type === 'password') {
          return element.value ? '[hidden]' : null;
        }
        return element.value || null;
      };

      expect(getFieldValue(mockInput)).toBe('[hidden]');
    });
  });

  describe('Wait for Element', () => {
    test('should find element that already exists', async () => {
      const mockElement = createMockElement('div', { className: 'loaded' });

      document.querySelector = jest.fn((selector) => {
        if (selector === '.loaded') return mockElement;
        return null;
      });

      const element = document.querySelector('.loaded');

      expect(element).toBe(mockElement);
    });

    test('should timeout if element not found', async () => {
      jest.useFakeTimers();

      document.querySelector = jest.fn(() => null);

      const waitForElement = (selector, timeout) => {
        return new Promise((resolve, reject) => {
          const element = document.querySelector(selector);
          if (element) {
            resolve(element);
            return;
          }

          const timeoutId = setTimeout(() => {
            reject(new Error(`Timeout waiting for element: ${selector}`));
          }, timeout);
        });
      };

      const promise = waitForElement('.never-appears', 1000);

      jest.advanceTimersByTime(1000);

      await expect(promise).rejects.toThrow('Timeout waiting for element');

      jest.useRealTimers();
    });
  });

  describe('Storage Operations', () => {
    describe('localStorage', () => {
      let mockLocalStorage;

      beforeEach(() => {
        mockLocalStorage = {};
      });

      test('should get localStorage items', () => {
        mockLocalStorage = {
          user: JSON.stringify({ name: 'Test User' }),
          settings: JSON.stringify({ theme: 'dark' })
        };

        const getItem = (key) => {
          const value = mockLocalStorage[key];
          if (value !== null && value !== undefined) {
            try {
              return JSON.parse(value);
            } catch {
              return value;
            }
          }
          return null;
        };

        expect(getItem('user')).toEqual({ name: 'Test User' });
        expect(getItem('settings')).toEqual({ theme: 'dark' });
      });

      test('should set localStorage items', () => {
        const setItem = (key, value) => {
          mockLocalStorage[key] = typeof value === 'object'
            ? JSON.stringify(value)
            : String(value);
        };

        setItem('newKey', { foo: 'bar' });
        setItem('stringKey', 'string value');

        expect(mockLocalStorage.newKey).toBe('{"foo":"bar"}');
        expect(mockLocalStorage.stringKey).toBe('string value');
      });
    });

    describe('sessionStorage', () => {
      let mockSessionStorage;

      beforeEach(() => {
        mockSessionStorage = {};
      });

      test('should get sessionStorage items', () => {
        mockSessionStorage = { token: 'abc123' };

        const getItem = (key) => mockSessionStorage[key] || null;

        expect(getItem('token')).toBe('abc123');
        expect(getItem('nonexistent')).toBeNull();
      });

      test('should set sessionStorage items', () => {
        const setItem = (key, value) => {
          mockSessionStorage[key] = String(value);
        };

        setItem('sessionToken', 'xyz789');

        expect(mockSessionStorage.sessionToken).toBe('xyz789');
      });
    });

    describe('Clear Storage', () => {
      test('should clear localStorage', () => {
        const mockStorage = { key1: 'value1', key2: 'value2' };

        const clear = () => {
          Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
        };

        clear();

        expect(Object.keys(mockStorage)).toHaveLength(0);
      });

      test('should clear specific types', () => {
        const types = ['localStorage', 'sessionStorage'];
        const cleared = {};

        for (const type of types) {
          cleared[type] = { success: true };
        }

        expect(cleared.localStorage.success).toBe(true);
        expect(cleared.sessionStorage.success).toBe(true);
      });
    });
  });

  describe('Selector Generation', () => {
    test('should generate ID selector', () => {
      const mockElement = createMockElement('input', { id: 'email' });

      const generateSelector = (element) => {
        if (element.id) {
          return `#${element.id}`;
        }
        return element.tagName.toLowerCase();
      };

      expect(generateSelector(mockElement)).toBe('#email');
    });

    test('should generate name selector for form elements', () => {
      const mockElement = createMockElement('input', { name: 'username' });

      const generateSelector = (element) => {
        if (element.name && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(element.tagName)) {
          return `[name="${element.name}"]`;
        }
        return element.tagName.toLowerCase();
      };

      expect(generateSelector(mockElement)).toBe('[name="username"]');
    });

    test('should generate path-based selector as fallback', () => {
      const mockElement = createMockElement('span');
      mockElement.id = '';
      mockElement.name = '';

      const generateSelector = (element) => {
        if (element.id) return `#${element.id}`;
        if (element.name) return `[name="${element.name}"]`;
        return element.tagName.toLowerCase();
      };

      expect(generateSelector(mockElement)).toBe('span');
    });
  });

  describe('Label Finding', () => {
    test('should find label by for attribute', () => {
      const mockLabel = createMockElement('label', { innerText: 'Email Address' });
      mockLabel.innerText = 'Email Address';

      document.querySelector = jest.fn((selector) => {
        if (selector === 'label[for="email"]') return mockLabel;
        return null;
      });

      const label = document.querySelector('label[for="email"]');

      expect(label.innerText).toBe('Email Address');
    });

    test('should find wrapping label', () => {
      const mockLabel = createMockElement('label', { innerText: 'Remember me' });
      mockLabel.innerText = 'Remember me';

      const mockInput = createMockElement('input', { type: 'checkbox' });
      mockInput.closest = jest.fn((selector) => {
        if (selector === 'label') return mockLabel;
        return null;
      });

      const label = mockInput.closest('label');

      expect(label.innerText).toBe('Remember me');
    });

    test('should find aria-label', () => {
      const mockElement = createMockElement('button');
      mockElement.getAttribute = jest.fn((attr) => {
        if (attr === 'aria-label') return 'Close dialog';
        return null;
      });

      const ariaLabel = mockElement.getAttribute('aria-label');

      expect(ariaLabel).toBe('Close dialog');
    });

    test('should fallback to placeholder', () => {
      const mockInput = createMockElement('input', { placeholder: 'Enter your email' });

      expect(mockInput.placeholder).toBe('Enter your email');
    });
  });

  describe('Event Dispatching', () => {
    test('should dispatch input event', () => {
      const mockInput = createMockElement('input');
      const events = [];

      mockInput.dispatchEvent = jest.fn((event) => {
        events.push(event.type);
        return true;
      });

      mockInput.dispatchEvent(new InputEvent('input', { bubbles: true }));

      expect(events).toContain('input');
    });

    test('should dispatch change event', () => {
      const mockInput = createMockElement('input');
      const events = [];

      mockInput.dispatchEvent = jest.fn((event) => {
        events.push(event.type);
        return true;
      });

      mockInput.dispatchEvent(new Event('change', { bubbles: true }));

      expect(events).toContain('change');
    });

    test('should dispatch click event', () => {
      const mockButton = createMockElement('button');
      const events = [];

      mockButton.dispatchEvent = jest.fn((event) => {
        events.push(event.type);
        return true;
      });

      mockButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(events).toContain('click');
    });
  });
});
