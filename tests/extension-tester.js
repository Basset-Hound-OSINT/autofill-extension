/**
 * Extension Tester - Puppeteer-based Chrome Extension Test Framework
 *
 * Provides utilities for testing Chrome extensions with Manifest V3.
 * Requires headed mode (uses Xvfb for virtual display in CI).
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

class ExtensionTester {
  constructor(extensionPath, options = {}) {
    this.extensionPath = path.resolve(extensionPath);
    this.options = {
      headless: false, // MV3 extensions require headed mode
      slowMo: options.slowMo || 0,
      timeout: options.timeout || 30000,
      viewport: options.viewport || { width: 1280, height: 720 },
      ...options
    };
    this.browser = null;
    this.extensionId = null;
  }

  async launch() {
    console.log(`[ExtensionTester] Launching Chrome with extension from: ${this.extensionPath}`);

    // Verify extension exists
    const manifestPath = path.join(this.extensionPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Extension manifest not found at: ${manifestPath}`);
    }

    const launchArgs = [
      `--disable-extensions-except=${this.extensionPath}`,
      `--load-extension=${this.extensionPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--no-first-run',
      '--disable-infobars',
      '--window-size=1280,720',
    ];

    // Add any custom args
    if (this.options.extraArgs) {
      launchArgs.push(...this.options.extraArgs);
    }

    try {
      this.browser = await puppeteer.launch({
        headless: false, // MUST be false for MV3 extensions
        args: launchArgs,
        defaultViewport: this.options.viewport,
        slowMo: this.options.slowMo,
        executablePath: this.options.executablePath || process.env.CHROME_PATH,
        timeout: this.options.timeout,
      });

      console.log('[ExtensionTester] Browser launched, waiting for extension...');
      await this.waitForExtension();
      console.log(`[ExtensionTester] Extension loaded with ID: ${this.extensionId}`);

      return this;
    } catch (error) {
      console.error('[ExtensionTester] Launch failed:', error.message);
      throw error;
    }
  }

  async waitForExtension(timeout = 15000) {
    const startTime = Date.now();
    let lastTargets = [];

    while (Date.now() - startTime < timeout) {
      try {
        const targets = await this.browser.targets();
        lastTargets = targets.map(t => ({ type: t.type(), url: t.url() }));

        // Look for extension service worker
        const extTarget = targets.find(t =>
          t.url().startsWith('chrome-extension://') &&
          (t.type() === 'service_worker' || t.type() === 'background_page')
        );

        if (extTarget) {
          this.extensionId = new URL(extTarget.url()).hostname;
          return;
        }

        // Also check for the extension page target
        const extPageTarget = targets.find(t =>
          t.url().startsWith('chrome-extension://') &&
          t.type() === 'page'
        );

        if (extPageTarget && !this.extensionId) {
          this.extensionId = new URL(extPageTarget.url()).hostname;
        }
      } catch (error) {
        console.warn('[ExtensionTester] Error checking targets:', error.message);
      }

      await new Promise(r => setTimeout(r, 200));
    }

    console.error('[ExtensionTester] Available targets:', JSON.stringify(lastTargets, null, 2));
    throw new Error('Extension failed to load within timeout');
  }

  async openPopup() {
    if (!this.extensionId) {
      throw new Error('Extension not loaded. Call launch() first.');
    }

    const page = await this.browser.newPage();
    const popupUrl = `chrome-extension://${this.extensionId}/popup.html`;

    console.log(`[ExtensionTester] Opening popup: ${popupUrl}`);
    await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });

    // Wait for popup to initialize
    await page.waitForSelector('body', { timeout: 5000 });

    return page;
  }

  async navigateAndTestContentScript(url, waitForContentScript = true) {
    const page = await this.browser.newPage();

    console.log(`[ExtensionTester] Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: this.options.timeout });

    if (waitForContentScript) {
      // Wait for content script to inject (check for a marker)
      try {
        await page.waitForFunction(
          () => typeof window.__osintExtensionReady !== 'undefined',
          { timeout: 5000 }
        );
        console.log('[ExtensionTester] Content script detected');
      } catch (error) {
        console.log('[ExtensionTester] Content script marker not found (may still be working)');
      }
    }

    return page;
  }

  async sendCommandToExtension(command) {
    const page = await this.browser.newPage();
    await page.goto(`chrome-extension://${this.extensionId}/popup.html`);

    const result = await page.evaluate(async (cmd) => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Command timeout'));
        }, 10000);

        chrome.runtime.sendMessage(cmd, (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
    }, command);

    await page.close();
    return result;
  }

  async getExtensionStatus() {
    return await this.sendCommandToExtension({ type: 'get_status' });
  }

  async waitForConnection(timeout = 10000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const status = await this.getExtensionStatus();
        if (status && status.connected) {
          return status;
        }
      } catch (error) {
        // Ignore errors while waiting
      }
      await new Promise(r => setTimeout(r, 500));
    }

    throw new Error('Extension did not connect within timeout');
  }

  async close() {
    if (this.browser) {
      console.log('[ExtensionTester] Closing browser');
      await this.browser.close();
      this.browser = null;
      this.extensionId = null;
    }
  }

  // Utility methods
  getExtensionId() {
    return this.extensionId;
  }

  getBrowser() {
    return this.browser;
  }
}

// Export for use in tests
module.exports = { ExtensionTester };
