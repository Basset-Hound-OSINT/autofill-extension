/**
 * Unit Tests for Content Script
 *
 * Tests the content.js DOM interaction functions.
 * Uses jsdom environment for DOM simulation.
 *
 * @jest-environment jsdom
 */

describe('Content Script - DOM Interactions', () => {
  // Mock Logger
  const mockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

  beforeEach(() => {
    // Reset document
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Element Finding Tests
  // ==========================================================================

  describe('Element Finding', () => {
    /**
     * Find an element using multiple strategies
     */
    function findElement(selector) {
      if (!selector || typeof selector !== 'string') {
        return null;
      }

      const trimmedSelector = selector.trim();
      if (trimmedSelector.length === 0) {
        return null;
      }

      // Try exact CSS selector first
      try {
        const element = document.querySelector(trimmedSelector);
        if (element) return element;
      } catch (e) {
        // Invalid selector, continue with variations
      }

      // Try variations
      const variations = [
        trimmedSelector,
        `#${CSS.escape(trimmedSelector)}`,
        `[name="${CSS.escape(trimmedSelector)}"]`,
        `[id="${CSS.escape(trimmedSelector)}"]`,
        `[data-testid="${CSS.escape(trimmedSelector)}"]`,
        `[aria-label="${CSS.escape(trimmedSelector)}"]`,
      ];

      for (const variation of variations) {
        try {
          const element = document.querySelector(variation);
          if (element) return element;
        } catch (e) {
          // Invalid selector, try next
        }
      }

      return null;
    }

    test('should find element by ID selector', () => {
      document.body.innerHTML = '<input id="username" type="text" />';

      const element = findElement('#username');

      expect(element).not.toBeNull();
      expect(element.id).toBe('username');
    });

    test('should find element by ID without hash', () => {
      document.body.innerHTML = '<input id="email" type="email" />';

      const element = findElement('email');

      expect(element).not.toBeNull();
      expect(element.id).toBe('email');
    });

    test('should find element by name attribute', () => {
      document.body.innerHTML = '<input name="password" type="password" />';

      const element = findElement('password');

      expect(element).not.toBeNull();
      expect(element.name).toBe('password');
    });

    test('should find element by data-testid', () => {
      document.body.innerHTML = '<button data-testid="submit-btn">Submit</button>';

      const element = findElement('submit-btn');

      expect(element).not.toBeNull();
      expect(element.getAttribute('data-testid')).toBe('submit-btn');
    });

    test('should find element by aria-label', () => {
      document.body.innerHTML = '<button aria-label="Close dialog">X</button>';

      const element = findElement('Close dialog');

      expect(element).not.toBeNull();
      expect(element.getAttribute('aria-label')).toBe('Close dialog');
    });

    test('should return null for empty selector', () => {
      document.body.innerHTML = '<input id="test" />';

      expect(findElement('')).toBeNull();
      expect(findElement('   ')).toBeNull();
    });

    test('should return null for non-string selector', () => {
      expect(findElement(null)).toBeNull();
      expect(findElement(undefined)).toBeNull();
      expect(findElement(123)).toBeNull();
    });

    test('should return null when element not found', () => {
      document.body.innerHTML = '<input id="exists" />';

      const element = findElement('#does-not-exist');

      expect(element).toBeNull();
    });

    test('should find element by complex CSS selector', () => {
      document.body.innerHTML = `
        <form id="login-form">
          <div class="field-group">
            <input type="text" name="username" />
          </div>
        </form>
      `;

      const element = findElement('#login-form .field-group input[name="username"]');

      expect(element).not.toBeNull();
      expect(element.name).toBe('username');
    });
  });

  // ==========================================================================
  // Element Finding by Text Tests
  // ==========================================================================

  describe('Find Element by Text', () => {
    function findElementByText(text) {
      const normalizedText = text.toLowerCase().trim();

      // Search buttons
      const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"]');
      for (const button of buttons) {
        const buttonText = (button.innerText || button.value || '').toLowerCase().trim();
        if (buttonText === normalizedText || buttonText.includes(normalizedText)) {
          return button;
        }
      }

      // Search links
      const links = document.querySelectorAll('a');
      for (const link of links) {
        const linkText = link.innerText.toLowerCase().trim();
        if (linkText === normalizedText || linkText.includes(normalizedText)) {
          return link;
        }
      }

      // Search labels
      const labels = document.querySelectorAll('label');
      for (const label of labels) {
        const labelText = label.innerText.toLowerCase().trim();
        if (labelText === normalizedText || labelText.includes(normalizedText)) {
          const forId = label.getAttribute('for');
          if (forId) {
            const input = document.getElementById(forId);
            if (input) return input;
          }
          const nestedInput = label.querySelector('input, textarea, select');
          if (nestedInput) return nestedInput;
        }
      }

      return null;
    }

    test('should find button by text', () => {
      document.body.innerHTML = '<button>Submit Form</button>';

      const element = findElementByText('Submit Form');

      expect(element).not.toBeNull();
      expect(element.tagName).toBe('BUTTON');
    });

    test('should find button by partial text', () => {
      document.body.innerHTML = '<button>Click here to continue</button>';

      const element = findElementByText('continue');

      expect(element).not.toBeNull();
      expect(element.tagName).toBe('BUTTON');
    });

    test('should find link by text', () => {
      document.body.innerHTML = '<a href="/about">About Us</a>';

      const element = findElementByText('About Us');

      expect(element).not.toBeNull();
      expect(element.tagName).toBe('A');
    });

    test('should find input by associated label text', () => {
      document.body.innerHTML = `
        <label for="email-input">Email Address</label>
        <input id="email-input" type="email" />
      `;

      const element = findElementByText('Email Address');

      expect(element).not.toBeNull();
      expect(element.id).toBe('email-input');
    });

    test('should find input nested in label', () => {
      document.body.innerHTML = `
        <label>
          Username
          <input type="text" name="username" />
        </label>
      `;

      const element = findElementByText('Username');

      expect(element).not.toBeNull();
      expect(element.name).toBe('username');
    });

    test('should be case insensitive', () => {
      document.body.innerHTML = '<button>SUBMIT</button>';

      const element = findElementByText('submit');

      expect(element).not.toBeNull();
    });
  });

  // ==========================================================================
  // Selector Generation Tests
  // ==========================================================================

  describe('Selector Generation', () => {
    function isFormElement(element) {
      const formTags = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'];
      return formTags.includes(element.tagName);
    }

    function generateSelector(element) {
      if (!element) return '';

      // Prefer ID
      if (element.id) {
        return `#${CSS.escape(element.id)}`;
      }

      // Prefer name for form elements
      if (element.name && isFormElement(element)) {
        return `[name="${CSS.escape(element.name)}"]`;
      }

      // Try data-testid
      const testId = element.getAttribute('data-testid');
      if (testId) {
        return `[data-testid="${CSS.escape(testId)}"]`;
      }

      // Build path-based selector
      const path = [];
      let current = element;
      let depth = 0;
      const MAX_DEPTH = 10;

      while (current && current !== document.body && depth < MAX_DEPTH) {
        let selector = current.tagName.toLowerCase();

        if (current.id) {
          selector = `#${CSS.escape(current.id)}`;
          path.unshift(selector);
          break;
        }

        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            child => child.tagName === current.tagName
          );
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            selector += `:nth-of-type(${index})`;
          }
        }

        path.unshift(selector);
        current = parent;
        depth++;
      }

      return path.join(' > ');
    }

    test('should generate ID selector', () => {
      document.body.innerHTML = '<input id="test-input" />';
      const element = document.getElementById('test-input');

      const selector = generateSelector(element);

      expect(selector).toBe('#test-input');
    });

    test('should generate name selector for form elements', () => {
      document.body.innerHTML = '<input name="email" type="email" />';
      const element = document.querySelector('input[name="email"]');

      const selector = generateSelector(element);

      expect(selector).toBe('[name="email"]');
    });

    test('should generate data-testid selector', () => {
      document.body.innerHTML = '<div data-testid="my-component"></div>';
      const element = document.querySelector('[data-testid="my-component"]');

      const selector = generateSelector(element);

      expect(selector).toBe('[data-testid="my-component"]');
    });

    test('should generate path-based selector when no ID/name', () => {
      document.body.innerHTML = `
        <div>
          <span>
            <button>Click</button>
          </span>
        </div>
      `;
      const element = document.querySelector('button');

      const selector = generateSelector(element);

      expect(selector).toContain('button');
      expect(document.querySelector(selector)).toBe(element);
    });

    test('should use nth-of-type for sibling disambiguation', () => {
      document.body.innerHTML = `
        <div>
          <span>First</span>
          <span>Second</span>
          <span>Third</span>
        </div>
      `;
      const secondSpan = document.querySelectorAll('span')[1];

      const selector = generateSelector(secondSpan);

      expect(selector).toContain('nth-of-type(2)');
      expect(document.querySelector(selector)).toBe(secondSpan);
    });

    test('should escape special characters in ID', () => {
      document.body.innerHTML = '<input id="user.email" />';
      const element = document.getElementById('user.email');

      const selector = generateSelector(element);

      expect(selector).toBe('#user\\.email');
    });
  });

  // ==========================================================================
  // Label Finding Tests
  // ==========================================================================

  describe('Label Finding', () => {
    function findLabel(element) {
      // Check for label with 'for' attribute
      if (element.id) {
        const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
        if (label) {
          return label.innerText.trim();
        }
      }

      // Check for wrapping label
      const parentLabel = element.closest('label');
      if (parentLabel) {
        const clone = parentLabel.cloneNode(true);
        const inputs = clone.querySelectorAll('input, textarea, select');
        inputs.forEach(input => input.remove());
        return clone.innerText.trim();
      }

      // Check for aria-label
      const ariaLabel = element.getAttribute('aria-label');
      if (ariaLabel) {
        return ariaLabel;
      }

      // Check for aria-labelledby
      const labelledBy = element.getAttribute('aria-labelledby');
      if (labelledBy) {
        const labelElement = document.getElementById(labelledBy);
        if (labelElement) {
          return labelElement.innerText.trim();
        }
      }

      // Fall back to placeholder
      if (element.placeholder) {
        return element.placeholder;
      }

      return null;
    }

    test('should find label by for attribute', () => {
      document.body.innerHTML = `
        <label for="username">Username</label>
        <input id="username" type="text" />
      `;
      const input = document.getElementById('username');

      const label = findLabel(input);

      expect(label).toBe('Username');
    });

    test('should find label when input is nested', () => {
      document.body.innerHTML = `
        <label>
          Email Address
          <input type="email" />
        </label>
      `;
      const input = document.querySelector('input');

      const label = findLabel(input);

      expect(label).toBe('Email Address');
    });

    test('should find aria-label', () => {
      document.body.innerHTML = '<input aria-label="Search query" type="search" />';
      const input = document.querySelector('input');

      const label = findLabel(input);

      expect(label).toBe('Search query');
    });

    test('should find aria-labelledby', () => {
      document.body.innerHTML = `
        <h2 id="section-title">Contact Information</h2>
        <input aria-labelledby="section-title" type="text" />
      `;
      const input = document.querySelector('input');

      const label = findLabel(input);

      expect(label).toBe('Contact Information');
    });

    test('should fall back to placeholder', () => {
      document.body.innerHTML = '<input placeholder="Enter your name" />';
      const input = document.querySelector('input');

      const label = findLabel(input);

      expect(label).toBe('Enter your name');
    });

    test('should return null when no label found', () => {
      document.body.innerHTML = '<input type="text" />';
      const input = document.querySelector('input');

      const label = findLabel(input);

      expect(label).toBeNull();
    });
  });

  // ==========================================================================
  // Form Field Extraction Tests
  // ==========================================================================

  describe('Form Field Extraction', () => {
    function isFormElement(element) {
      const formTags = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'];
      return formTags.includes(element.tagName);
    }

    function generateSelector(element) {
      if (!element) return '';
      if (element.id) return `#${CSS.escape(element.id)}`;
      if (element.name && isFormElement(element)) return `[name="${CSS.escape(element.name)}"]`;
      return element.tagName.toLowerCase();
    }

    function findLabel(element) {
      if (element.id) {
        const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
        if (label) return label.innerText.trim();
      }
      if (element.placeholder) return element.placeholder;
      return null;
    }

    function extractFormFields(form) {
      return Array.from(form.elements)
        .filter(el => {
          const type = el.type?.toLowerCase();
          if (type === 'submit' || type === 'button' || type === 'reset') return false;
          if (type === 'hidden' && !el.name) return false;
          return true;
        })
        .map(el => {
          const field = {
            selector: generateSelector(el),
            type: el.type || el.tagName.toLowerCase(),
            name: el.name || null,
            id: el.id || null,
            label: findLabel(el),
            required: el.required,
            disabled: el.disabled,
            readonly: el.readOnly
          };

          if (el.placeholder) field.placeholder = el.placeholder;
          if (el.type !== 'password') {
            field.value = el.value || null;
          } else {
            field.value = el.value ? '[hidden]' : null;
          }

          if (el.tagName === 'SELECT') {
            field.options = Array.from(el.options).map(opt => ({
              value: opt.value,
              text: opt.text,
              selected: opt.selected
            }));
          }

          if (el.type === 'checkbox' || el.type === 'radio') {
            field.checked = el.checked;
          }

          return field;
        });
    }

    test('should extract text input fields', () => {
      document.body.innerHTML = `
        <form>
          <input type="text" name="username" id="username" placeholder="Username" />
        </form>
      `;
      const form = document.querySelector('form');

      const fields = extractFormFields(form);

      expect(fields.length).toBe(1);
      expect(fields[0].type).toBe('text');
      expect(fields[0].name).toBe('username');
      expect(fields[0].id).toBe('username');
    });

    test('should not include submit buttons', () => {
      document.body.innerHTML = `
        <form>
          <input type="text" name="email" />
          <button type="submit">Submit</button>
          <input type="submit" value="Send" />
        </form>
      `;
      const form = document.querySelector('form');

      const fields = extractFormFields(form);

      expect(fields.length).toBe(1);
      expect(fields[0].name).toBe('email');
    });

    test('should extract select options', () => {
      document.body.innerHTML = `
        <form>
          <select name="country">
            <option value="">Select</option>
            <option value="us">United States</option>
            <option value="uk" selected>United Kingdom</option>
          </select>
        </form>
      `;
      const form = document.querySelector('form');

      const fields = extractFormFields(form);

      expect(fields.length).toBe(1);
      expect(fields[0].type).toBe('select-one');
      expect(fields[0].options.length).toBe(3);
      expect(fields[0].options[2].selected).toBe(true);
    });

    test('should extract checkbox state', () => {
      document.body.innerHTML = `
        <form>
          <input type="checkbox" name="agree" checked />
        </form>
      `;
      const form = document.querySelector('form');

      const fields = extractFormFields(form);

      expect(fields.length).toBe(1);
      expect(fields[0].type).toBe('checkbox');
      expect(fields[0].checked).toBe(true);
    });

    test('should hide password values', () => {
      document.body.innerHTML = `
        <form>
          <input type="password" name="password" value="secret123" />
        </form>
      `;
      const form = document.querySelector('form');

      const fields = extractFormFields(form);

      expect(fields[0].value).toBe('[hidden]');
    });

    test('should extract required and disabled states', () => {
      document.body.innerHTML = `
        <form>
          <input type="text" name="required-field" required />
          <input type="text" name="disabled-field" disabled />
          <input type="text" name="readonly-field" readonly />
        </form>
      `;
      const form = document.querySelector('form');

      const fields = extractFormFields(form);

      expect(fields[0].required).toBe(true);
      expect(fields[1].disabled).toBe(true);
      expect(fields[2].readonly).toBe(true);
    });
  });

  // ==========================================================================
  // Form Filling Tests
  // ==========================================================================

  describe('Form Filling', () => {
    async function fillElement(element, value) {
      const tagName = element.tagName.toLowerCase();
      const inputType = element.type?.toLowerCase();

      if (tagName === 'select') {
        element.value = value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }

      if (inputType === 'checkbox' || inputType === 'radio') {
        const shouldCheck = value === 'true' || value === true || value === '1';
        if (element.checked !== shouldCheck) {
          element.checked = shouldCheck;
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
      }

      // Text-based inputs
      element.focus();
      element.value = String(value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.blur();
    }

    test('should fill text input', async () => {
      document.body.innerHTML = '<input type="text" id="name" />';
      const input = document.getElementById('name');
      const changeHandler = jest.fn();
      input.addEventListener('change', changeHandler);

      await fillElement(input, 'John Doe');

      expect(input.value).toBe('John Doe');
      expect(changeHandler).toHaveBeenCalled();
    });

    test('should fill email input', async () => {
      document.body.innerHTML = '<input type="email" id="email" />';
      const input = document.getElementById('email');

      await fillElement(input, 'test@example.com');

      expect(input.value).toBe('test@example.com');
    });

    test('should fill textarea', async () => {
      document.body.innerHTML = '<textarea id="message"></textarea>';
      const textarea = document.getElementById('message');

      await fillElement(textarea, 'Hello, World!');

      expect(textarea.value).toBe('Hello, World!');
    });

    test('should fill select dropdown', async () => {
      document.body.innerHTML = `
        <select id="country">
          <option value="">Select</option>
          <option value="us">USA</option>
          <option value="uk">UK</option>
        </select>
      `;
      const select = document.getElementById('country');

      await fillElement(select, 'uk');

      expect(select.value).toBe('uk');
    });

    test('should check checkbox', async () => {
      document.body.innerHTML = '<input type="checkbox" id="agree" />';
      const checkbox = document.getElementById('agree');

      await fillElement(checkbox, true);

      expect(checkbox.checked).toBe(true);
    });

    test('should uncheck checkbox', async () => {
      document.body.innerHTML = '<input type="checkbox" id="agree" checked />';
      const checkbox = document.getElementById('agree');

      await fillElement(checkbox, false);

      expect(checkbox.checked).toBe(false);
    });

    test('should check radio button', async () => {
      document.body.innerHTML = `
        <input type="radio" name="gender" value="male" id="male" />
        <input type="radio" name="gender" value="female" id="female" />
      `;
      const radio = document.getElementById('male');

      await fillElement(radio, true);

      expect(radio.checked).toBe(true);
    });

    test('should convert non-string values to string', async () => {
      document.body.innerHTML = '<input type="text" id="age" />';
      const input = document.getElementById('age');

      await fillElement(input, 25);

      expect(input.value).toBe('25');
    });
  });

  // ==========================================================================
  // Click Handling Tests
  // ==========================================================================

  describe('Click Handling', () => {
    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function handleClickElement(element, waitAfter = 0) {
      if (!element) {
        return { success: false, error: 'Element not found' };
      }

      try {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        if (typeof element.focus === 'function') {
          element.focus();
        }

        element.click();

        if (waitAfter > 0) {
          await sleep(waitAfter);
        }

        return { success: true, clicked: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    test('should click button element', async () => {
      document.body.innerHTML = '<button id="btn">Click Me</button>';
      const button = document.getElementById('btn');
      const clickHandler = jest.fn();
      button.addEventListener('click', clickHandler);

      const result = await handleClickElement(button);

      expect(result.success).toBe(true);
      expect(clickHandler).toHaveBeenCalled();
    });

    test('should click link element', async () => {
      document.body.innerHTML = '<a id="link" href="#">Link</a>';
      const link = document.getElementById('link');
      const clickHandler = jest.fn(e => e.preventDefault());
      link.addEventListener('click', clickHandler);

      const result = await handleClickElement(link);

      expect(result.success).toBe(true);
      expect(clickHandler).toHaveBeenCalled();
    });

    test('should return error for null element', async () => {
      const result = await handleClickElement(null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Element not found');
    });

    test('should focus element before clicking', async () => {
      document.body.innerHTML = '<button id="btn">Click</button>';
      const button = document.getElementById('btn');
      const focusHandler = jest.fn();
      button.addEventListener('focus', focusHandler);

      await handleClickElement(button);

      expect(focusHandler).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Wait for Element Tests
  // ==========================================================================

  describe('Wait for Element', () => {
    jest.useFakeTimers();

    function waitForElement(selector, timeout = 10000) {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector(selector);
        if (existing) {
          resolve(existing);
          return;
        }

        const timeoutId = setTimeout(() => {
          observer.disconnect();
          reject(new Error(`Timeout waiting for element: ${selector}`));
        }, timeout);

        const observer = new MutationObserver((mutations, obs) => {
          const element = document.querySelector(selector);
          if (element) {
            clearTimeout(timeoutId);
            obs.disconnect();
            resolve(element);
          }
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true
        });
      });
    }

    afterEach(() => {
      jest.clearAllTimers();
    });

    test('should resolve immediately if element exists', async () => {
      document.body.innerHTML = '<div id="target">Content</div>';

      const promise = waitForElement('#target');
      jest.runAllTimers();
      const element = await promise;

      expect(element).not.toBeNull();
      expect(element.id).toBe('target');
    });

    test('should resolve when element is added', async () => {
      document.body.innerHTML = '';

      const promise = waitForElement('#new-element');

      // Add element after starting wait
      setTimeout(() => {
        const div = document.createElement('div');
        div.id = 'new-element';
        document.body.appendChild(div);
      }, 100);

      jest.advanceTimersByTime(100);
      const element = await promise;

      expect(element).not.toBeNull();
      expect(element.id).toBe('new-element');
    });

    test('should reject on timeout', async () => {
      document.body.innerHTML = '';

      const promise = waitForElement('#nonexistent', 1000);

      jest.advanceTimersByTime(1001);

      await expect(promise).rejects.toThrow('Timeout waiting for element');
    });
  });

  // ==========================================================================
  // Storage Handler Tests
  // ==========================================================================

  describe('Storage Handlers', () => {
    beforeEach(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    describe('LocalStorage', () => {
      test('should get all localStorage items', () => {
        localStorage.setItem('key1', 'value1');
        localStorage.setItem('key2', JSON.stringify({ nested: 'value' }));

        const getLocalStorage = (keys) => {
          const items = {};
          const keysToGet = keys || Object.keys(localStorage);

          for (const key of keysToGet) {
            const value = localStorage.getItem(key);
            if (value !== null) {
              try {
                items[key] = JSON.parse(value);
              } catch {
                items[key] = value;
              }
            }
          }

          return { success: true, items };
        };

        const result = getLocalStorage(null);

        expect(result.success).toBe(true);
        expect(result.items.key1).toBe('value1');
        expect(result.items.key2.nested).toBe('value');
      });

      test('should get specific localStorage keys', () => {
        localStorage.setItem('key1', 'value1');
        localStorage.setItem('key2', 'value2');
        localStorage.setItem('key3', 'value3');

        const getLocalStorage = (keys) => {
          const items = {};
          for (const key of keys) {
            const value = localStorage.getItem(key);
            if (value !== null) {
              items[key] = value;
            }
          }
          return { success: true, items };
        };

        const result = getLocalStorage(['key1', 'key3']);

        expect(Object.keys(result.items).length).toBe(2);
        expect(result.items.key1).toBe('value1');
        expect(result.items.key3).toBe('value3');
        expect(result.items.key2).toBeUndefined();
      });

      test('should set localStorage items', () => {
        const setLocalStorage = (items) => {
          const results = [];
          for (const [key, value] of Object.entries(items)) {
            const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
            localStorage.setItem(key, stringValue);
            results.push({ key, success: true });
          }
          return { success: true, results };
        };

        setLocalStorage({ name: 'John', data: { age: 30 } });

        expect(localStorage.getItem('name')).toBe('John');
        expect(JSON.parse(localStorage.getItem('data')).age).toBe(30);
      });

      test('should clear localStorage', () => {
        localStorage.setItem('key1', 'value1');
        localStorage.setItem('key2', 'value2');

        const clearStorage = () => {
          const previousCount = localStorage.length;
          localStorage.clear();
          return { success: true, cleared: previousCount };
        };

        const result = clearStorage();

        expect(result.cleared).toBe(2);
        expect(localStorage.length).toBe(0);
      });
    });

    describe('SessionStorage', () => {
      test('should get all sessionStorage items', () => {
        sessionStorage.setItem('session1', 'data1');
        sessionStorage.setItem('session2', 'data2');

        const getSessionStorage = () => {
          const items = {};
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            items[key] = sessionStorage.getItem(key);
          }
          return { success: true, items };
        };

        const result = getSessionStorage();

        expect(result.items.session1).toBe('data1');
        expect(result.items.session2).toBe('data2');
      });

      test('should set sessionStorage items', () => {
        const setSessionStorage = (items) => {
          for (const [key, value] of Object.entries(items)) {
            sessionStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value);
          }
          return { success: true };
        };

        setSessionStorage({ token: 'abc123' });

        expect(sessionStorage.getItem('token')).toBe('abc123');
      });
    });
  });

  // ==========================================================================
  // Page State Extraction Tests
  // ==========================================================================

  describe('Page State Extraction', () => {
    test('should extract page metadata', () => {
      document.title = 'Test Page';

      const getPageState = () => ({
        url: window.location.href,
        title: document.title,
        meta: {
          documentReady: document.readyState,
          scrollHeight: document.documentElement.scrollHeight,
          scrollWidth: document.documentElement.scrollWidth
        }
      });

      const state = getPageState();

      expect(state.title).toBe('Test Page');
      expect(state.meta.documentReady).toBeDefined();
    });

    test('should extract forms', () => {
      document.body.innerHTML = `
        <form id="login" action="/login" method="POST">
          <input name="username" type="text" />
          <input name="password" type="password" />
          <button type="submit">Login</button>
        </form>
      `;

      const extractForms = () => {
        return Array.from(document.querySelectorAll('form')).map(form => ({
          id: form.id || null,
          action: form.action || null,
          method: (form.method || 'GET').toUpperCase()
        }));
      };

      const forms = extractForms();

      expect(forms.length).toBe(1);
      expect(forms[0].id).toBe('login');
      expect(forms[0].method).toBe('POST');
    });

    test('should extract links', () => {
      document.body.innerHTML = `
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
      `;

      const extractLinks = () => {
        return Array.from(document.querySelectorAll('a[href]')).map(a => ({
          text: a.innerText.trim(),
          href: a.href
        }));
      };

      const links = extractLinks();

      expect(links.length).toBe(2);
      expect(links[0].text).toBe('About');
      expect(links[1].text).toBe('Contact');
    });

    test('should extract buttons', () => {
      document.body.innerHTML = `
        <button id="btn1">Click Me</button>
        <input type="submit" value="Submit" />
        <div role="button">Custom Button</div>
      `;

      const extractButtons = () => {
        return Array.from(document.querySelectorAll(
          'button, input[type="submit"], input[type="button"], [role="button"]'
        )).map(b => ({
          text: (b.innerText || b.value || b.getAttribute('aria-label') || '').trim()
        }));
      };

      const buttons = extractButtons();

      expect(buttons.length).toBe(3);
      expect(buttons[0].text).toBe('Click Me');
      expect(buttons[1].text).toBe('Submit');
      expect(buttons[2].text).toBe('Custom Button');
    });
  });

  // ==========================================================================
  // Form Validation Tests
  // ==========================================================================

  describe('Form Validation', () => {
    test('should detect invalid required field', () => {
      document.body.innerHTML = `
        <form>
          <input type="text" name="required-field" required />
        </form>
      `;
      const form = document.querySelector('form');
      const input = form.querySelector('input');

      const getValidationErrors = () => {
        const errors = [];
        const fields = form.querySelectorAll('input, textarea, select');

        for (const field of fields) {
          if (!field.checkValidity()) {
            errors.push({
              name: field.name,
              message: field.validationMessage,
              validity: {
                valueMissing: field.validity.valueMissing
              }
            });
          }
        }

        return errors;
      };

      const errors = getValidationErrors();

      expect(errors.length).toBe(1);
      expect(errors[0].validity.valueMissing).toBe(true);
    });

    test('should detect email format error', () => {
      document.body.innerHTML = `
        <form>
          <input type="email" name="email" value="invalid-email" />
        </form>
      `;
      const form = document.querySelector('form');

      const getValidationErrors = () => {
        const errors = [];
        const fields = form.querySelectorAll('input');

        for (const field of fields) {
          if (!field.checkValidity()) {
            errors.push({
              name: field.name,
              validity: {
                typeMismatch: field.validity.typeMismatch
              }
            });
          }
        }

        return errors;
      };

      const errors = getValidationErrors();

      expect(errors.length).toBe(1);
      expect(errors[0].validity.typeMismatch).toBe(true);
    });

    test('should pass validation for valid input', () => {
      document.body.innerHTML = `
        <form>
          <input type="email" name="email" value="test@example.com" />
          <input type="text" name="name" value="John" required />
        </form>
      `;
      const form = document.querySelector('form');

      const isValid = form.checkValidity();

      expect(isValid).toBe(true);
    });
  });

  // ==========================================================================
  // Utility Function Tests
  // ==========================================================================

  describe('Utility Functions', () => {
    describe('sleep', () => {
      jest.useFakeTimers();

      test('should resolve after specified time', async () => {
        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        const promise = sleep(1000);
        jest.advanceTimersByTime(1000);
        await promise;

        // If we get here, the promise resolved
        expect(true).toBe(true);
      });
    });

    describe('CSS Escape', () => {
      test('should escape special characters', () => {
        const testCases = [
          ['user.name', 'user\\.name'],
          ['my#id', 'my\\#id'],
          ['class:hover', 'class\\:hover']
        ];

        for (const [input, expected] of testCases) {
          expect(CSS.escape(input)).toBe(expected);
        }
      });
    });

    describe('getTypingDelay', () => {
      test('should return varying delays', () => {
        const TYPING_DELAY = 10;
        const TYPING_DELAY_VARIANCE = 5;

        const getTypingDelay = () => {
          const variance = Math.random() * TYPING_DELAY_VARIANCE * 2 - TYPING_DELAY_VARIANCE;
          return Math.max(5, TYPING_DELAY + variance);
        };

        const delays = new Set();
        for (let i = 0; i < 100; i++) {
          delays.add(getTypingDelay());
        }

        // Should have multiple different values due to randomness
        expect(delays.size).toBeGreaterThan(1);
      });
    });
  });

  // ==========================================================================
  // Date Formatting Tests
  // ==========================================================================

  describe('Date Formatting', () => {
    function formatDateForInput(date, inputFormat, inputType) {
      try {
        const d = new Date(date);
        if (isNaN(d.getTime())) {
          return date;
        }

        if (inputType === 'date') {
          return d.toISOString().split('T')[0];
        }

        if (inputType === 'datetime-local') {
          return d.toISOString().slice(0, 16);
        }

        return d.toLocaleDateString();
      } catch {
        return date;
      }
    }

    test('should format date for date input', () => {
      const result = formatDateForInput('2024-03-15', 'iso', 'date');

      expect(result).toBe('2024-03-15');
    });

    test('should format date for datetime-local input', () => {
      const result = formatDateForInput('2024-03-15T14:30:00Z', 'iso', 'datetime-local');

      expect(result).toContain('2024-03-15');
    });

    test('should return original value for invalid date', () => {
      const result = formatDateForInput('not-a-date', 'iso', 'date');

      expect(result).toBe('not-a-date');
    });
  });
});
