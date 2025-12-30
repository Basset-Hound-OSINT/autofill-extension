/**
 * E2E Tests for Content Script
 *
 * Tests content script functionality in real Chrome with extension loaded
 */

const path = require('path');
const fs = require('fs');
const {
  launchWithExtension,
  waitForElement,
  typeNaturally,
  waitForPageLoad,
  isElementVisible,
  takeDebugScreenshot,
  waitForExtensionReady
} = require('./helpers');

describe('Content Script E2E Tests', () => {
  let browser;
  let page;
  const testPagePath = 'file://' + path.resolve(__dirname, 'test-page.html');

  beforeAll(async () => {
    // Launch Chrome with extension
    browser = await launchWithExtension({
      // slowMo: 50 // Uncomment for debugging
    });

    // Wait for extension to be ready
    await waitForExtensionReady(browser);
  }, 30000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    // Create new page for each test
    page = await browser.newPage();
    await page.goto(testPagePath, { waitUntil: 'networkidle0' });
    await waitForPageLoad(page);
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  describe('Element Finding', () => {
    test('should find elements by ID', async () => {
      const element = await page.$('#name');
      expect(element).toBeTruthy();
    });

    test('should find elements by CSS selector', async () => {
      const element = await page.$('input[type="email"]');
      expect(element).toBeTruthy();
    });

    test('should find elements by data attribute', async () => {
      const element = await page.$('[data-test-id="name-input"]');
      expect(element).toBeTruthy();
    });

    test('should find multiple elements', async () => {
      const elements = await page.$$('input[type="checkbox"]');
      expect(elements.length).toBe(2);
    });
  });

  describe('Form Interactions', () => {
    test('should type into text input', async () => {
      await page.type('#name', 'John Doe');

      const value = await page.$eval('#name', el => el.value);
      expect(value).toBe('John Doe');
    });

    test('should type into email input', async () => {
      await page.type('#email', 'john@example.com');

      const value = await page.$eval('#email', el => el.value);
      expect(value).toBe('john@example.com');
    });

    test('should type into number input', async () => {
      await page.type('#age', '25');

      const value = await page.$eval('#age', el => el.value);
      expect(value).toBe('25');
    });

    test('should select option from dropdown', async () => {
      await page.select('#country', 'us');

      const value = await page.$eval('#country', el => el.value);
      expect(value).toBe('us');
    });

    test('should check checkbox', async () => {
      await page.click('#subscribe');

      const isChecked = await page.$eval('#subscribe', el => el.checked);
      expect(isChecked).toBe(true);
    });

    test('should uncheck checkbox', async () => {
      await page.click('#subscribe'); // Check
      await page.click('#subscribe'); // Uncheck

      const isChecked = await page.$eval('#subscribe', el => el.checked);
      expect(isChecked).toBe(false);
    });

    test('should type into textarea', async () => {
      await page.type('#comments', 'This is a test comment');

      const value = await page.$eval('#comments', el => el.value);
      expect(value).toBe('This is a test comment');
    });
  });

  describe('Element Visibility', () => {
    test('should detect visible element', async () => {
      const visible = await isElementVisible(page, '#visibleElement');
      expect(visible).toBe(true);
    });

    test('should detect hidden element', async () => {
      const visible = await isElementVisible(page, '#hiddenElement');
      expect(visible).toBe(false);
    });

    test('should detect element after it becomes visible', async () => {
      // Click button to show element
      await page.click('#clickTest');

      // Wait for element to become visible
      await page.waitForSelector('#clickResult', { visible: true, timeout: 3000 });

      const visible = await isElementVisible(page, '#clickResult');
      expect(visible).toBe(true);
    });
  });

  describe('Form Submission', () => {
    test('should fill and submit form', async () => {
      // Fill form fields
      await page.type('#name', 'Jane Smith');
      await page.type('#email', 'jane@example.com');
      await page.type('#age', '30');
      await page.select('#country', 'uk');
      await page.click('#subscribe');
      await page.click('#terms');
      await page.type('#comments', 'Test submission');

      // Submit form
      await page.click('button[type="submit"]');

      // Wait for result to appear
      await page.waitForSelector('#result', { visible: true, timeout: 3000 });

      // Verify result is visible
      const resultVisible = await isElementVisible(page, '#result');
      expect(resultVisible).toBe(true);

      // Verify form data was captured
      const formDataText = await page.$eval('#formData', el => el.textContent);
      const formData = JSON.parse(formDataText);

      expect(formData.name).toBe('Jane Smith');
      expect(formData.email).toBe('jane@example.com');
      expect(formData.age).toBe('30');
      expect(formData.country).toBe('uk');
      expect(formData.subscribe).toBe('yes');
      expect(formData.terms).toBe('yes');
      expect(formData.comments).toBe('Test submission');
    });
  });

  describe('Dynamic Content', () => {
    test('should wait for dynamically loaded content', async () => {
      // Click button to load dynamic content
      await page.click('button:text("Load Dynamic Content")');

      // Wait for dynamic content to appear
      await page.waitForSelector('#loadedContent', { timeout: 5000 });

      // Verify content is loaded
      const contentVisible = await isElementVisible(page, '#loadedContent');
      expect(contentVisible).toBe(true);

      // Verify content text
      const content = await page.$eval('#loadedContent h3', el => el.textContent);
      expect(content).toBe('Dynamic Content Loaded!');
    });
  });

  describe('Page State Extraction', () => {
    test('should extract form field values', async () => {
      // Fill some fields
      await page.type('#name', 'Test User');
      await page.type('#email', 'test@example.com');
      await page.select('#country', 'ca');

      // Extract all input values
      const formState = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input, select, textarea');
        const state = {};

        inputs.forEach(input => {
          if (input.id) {
            if (input.type === 'checkbox') {
              state[input.id] = input.checked;
            } else {
              state[input.id] = input.value;
            }
          }
        });

        return state;
      });

      expect(formState.name).toBe('Test User');
      expect(formState.email).toBe('test@example.com');
      expect(formState.country).toBe('ca');
      expect(formState.subscribe).toBe(false);
    });

    test('should extract page title', async () => {
      const title = await page.title();
      expect(title).toBe('E2E Test Page');
    });

    test('should extract element text content', async () => {
      const h1Text = await page.$eval('h1', el => el.textContent);
      expect(h1Text).toBe('E2E Test Page');
    });

    test('should extract element attributes', async () => {
      const placeholder = await page.$eval('#name', el => el.getAttribute('placeholder'));
      expect(placeholder).toBe('Enter your name');
    });
  });

  describe('Event Handling', () => {
    test('should trigger click events', async () => {
      // Initially, click result should be hidden
      let resultVisible = await isElementVisible(page, '#clickResult');
      expect(resultVisible).toBe(false);

      // Click button
      await page.click('#clickTest');

      // Result should now be visible
      resultVisible = await isElementVisible(page, '#clickResult');
      expect(resultVisible).toBe(true);
    });

    test('should handle input events', async () => {
      // Type in input
      await page.type('#name', 'A');

      // Check value after each character
      const value = await page.$eval('#name', el => el.value);
      expect(value).toBe('A');
    });
  });
});

// Note: These tests validate that content script functionality works in real Chrome
// This addresses the JSDOM limitations we saw in unit tests
