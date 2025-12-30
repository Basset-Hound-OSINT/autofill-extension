/**
 * E2E Test Helpers for Puppeteer
 *
 * Utilities for loading Chrome extension in Puppeteer tests
 */

const puppeteer = require('puppeteer');
const path = require('path');

/**
 * Launch Chrome with extension loaded
 * @param {Object} options - Launch options
 * @returns {Promise<Browser>} Puppeteer browser instance
 */
async function launchWithExtension(options = {}) {
  const extensionPath = path.resolve(__dirname, '../..');

  const browser = await puppeteer.launch({
    headless: false, // Extensions require headed mode
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security', // For testing purposes
      ...( options.args || [])
    ],
    ...options
  });

  return browser;
}

/**
 * Wait for element to be visible
 * @param {Page} page - Puppeteer page
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in ms
 */
async function waitForElement(page, selector, timeout = 5000) {
  await page.waitForSelector(selector, { visible: true, timeout });
}

/**
 * Type text naturally with random delays
 * @param {Page} page - Puppeteer page
 * @param {string} selector - CSS selector
 * @param {string} text - Text to type
 */
async function typeNaturally(page, selector, text) {
  await page.focus(selector);
  for (const char of text) {
    await page.keyboard.type(char);
    await page.waitForTimeout(50 + Math.random() * 100); // 50-150ms delay
  }
}

/**
 * Wait for page to be fully loaded
 * @param {Page} page - Puppeteer page
 */
async function waitForPageLoad(page) {
  await page.waitForFunction(() => document.readyState === 'complete');
  await page.waitForTimeout(500); // Additional buffer
}

/**
 * Get all iframes on page
 * @param {Page} page - Puppeteer page
 * @returns {Promise<Array>} Array of frame objects
 */
async function getIframes(page) {
  const frames = page.frames();
  return frames.filter(frame => frame.parentFrame());
}

/**
 * Check if element is visible
 * @param {Page} page - Puppeteer page
 * @param {string} selector - CSS selector
 * @returns {Promise<boolean>}
 */
async function isElementVisible(page, selector) {
  try {
    const element = await page.$(selector);
    if (!element) return false;

    const isVisible = await page.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' &&
             style.visibility !== 'hidden' &&
             style.opacity !== '0';
    }, element);

    return isVisible;
  } catch (error) {
    return false;
  }
}

/**
 * Take a screenshot for debugging
 * @param {Page} page - Puppeteer page
 * @param {string} name - Screenshot name
 */
async function takeDebugScreenshot(page, name) {
  const screenshotPath = path.join(__dirname, `../../coverage/screenshots/${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot saved: ${screenshotPath}`);
}

/**
 * Get extension background page
 * @param {Browser} browser - Puppeteer browser
 * @returns {Promise<Target>} Background page target
 */
async function getExtensionBackgroundPage(browser) {
  const targets = await browser.targets();
  const extensionTarget = targets.find(
    target => target.type() === 'service_worker' ||
              (target.type() === 'background_page' && target.url().includes('chrome-extension://'))
  );

  if (!extensionTarget) {
    throw new Error('Extension background page not found');
  }

  return extensionTarget;
}

/**
 * Get extension ID
 * @param {Browser} browser - Puppeteer browser
 * @returns {Promise<string>} Extension ID
 */
async function getExtensionId(browser) {
  const backgroundTarget = await getExtensionBackgroundPage(browser);
  const url = backgroundTarget.url();
  const match = url.match(/chrome-extension:\/\/([a-z]+)/);
  return match ? match[1] : null;
}

/**
 * Wait for extension to be ready
 * @param {Browser} browser - Puppeteer browser
 * @param {number} timeout - Timeout in ms
 */
async function waitForExtensionReady(browser, timeout = 10000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const backgroundTarget = await getExtensionBackgroundPage(browser);
      if (backgroundTarget) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for initialization
        return true;
      }
    } catch (error) {
      // Keep trying
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error('Extension did not become ready within timeout');
}

module.exports = {
  launchWithExtension,
  waitForElement,
  typeNaturally,
  waitForPageLoad,
  getIframes,
  isElementVisible,
  takeDebugScreenshot,
  getExtensionBackgroundPage,
  getExtensionId,
  waitForExtensionReady
};
