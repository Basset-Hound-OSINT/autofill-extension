#!/usr/bin/env node

/**
 * Simple Extension Load Test
 *
 * Minimal test to verify extension loads correctly in Chrome.
 * Useful for debugging Puppeteer/Chrome configuration issues.
 *
 * Usage:
 *   node simple-test.js
 *   xvfb-run --auto-servernum node simple-test.js
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const EXTENSION_PATH = path.resolve(__dirname, '..');
const TIMEOUT = 30000;

async function simpleTest() {
  console.log('='.repeat(50));
  console.log('Simple Extension Load Test');
  console.log('='.repeat(50));
  console.log();

  // Environment info
  console.log('[Info] Environment:');
  console.log(`  Node version: ${process.version}`);
  console.log(`  Extension path: ${EXTENSION_PATH}`);
  console.log(`  DISPLAY: ${process.env.DISPLAY || 'not set'}`);
  console.log(`  Chrome path: ${process.env.CHROME_PATH || 'default'}`);
  console.log();

  // Verify extension
  const manifestPath = path.join(EXTENSION_PATH, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('[Error] manifest.json not found!');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log('[Info] Extension:');
  console.log(`  Name: ${manifest.name}`);
  console.log(`  Version: ${manifest.version}`);
  console.log(`  Manifest Version: ${manifest.manifest_version}`);
  console.log();

  let browser = null;

  try {
    console.log('[Step 1] Launching Chrome...');

    const args = [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--no-first-run',
      '--disable-background-networking',
    ];

    console.log('[Debug] Launch args:', args.slice(0, 3).join(' '), '...');

    browser = await puppeteer.launch({
      headless: false, // Required for MV3 extensions
      args: args,
      timeout: TIMEOUT,
      executablePath: process.env.CHROME_PATH || undefined,
    });

    console.log('[Step 1] Chrome launched successfully');
    console.log();

    console.log('[Step 2] Waiting for extension to load...');

    let extensionId = null;
    const startTime = Date.now();

    while (Date.now() - startTime < TIMEOUT) {
      const targets = await browser.targets();

      // Debug: show all targets
      if (Date.now() - startTime < 2000) {
        console.log('[Debug] Available targets:');
        targets.forEach(t => {
          console.log(`  - ${t.type()}: ${t.url().substring(0, 60)}`);
        });
      }

      // Look for extension
      const extTarget = targets.find(t =>
        t.url().startsWith('chrome-extension://') &&
        (t.type() === 'service_worker' || t.type() === 'background_page')
      );

      if (extTarget) {
        extensionId = new URL(extTarget.url()).hostname;
        break;
      }

      await new Promise(r => setTimeout(r, 500));
    }

    if (!extensionId) {
      throw new Error('Extension service worker not found within timeout');
    }

    console.log(`[Step 2] Extension loaded with ID: ${extensionId}`);
    console.log();

    console.log('[Step 3] Opening extension popup...');

    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });

    const popupTitle = await page.title();
    const bodyContent = await page.evaluate(() => document.body.innerHTML.length);

    console.log(`[Step 3] Popup loaded (title: "${popupTitle}", content: ${bodyContent} chars)`);
    await page.close();
    console.log();

    console.log('[Step 4] Testing extension messaging...');

    const testPage = await browser.newPage();
    await testPage.goto(`chrome-extension://${extensionId}/popup.html`);

    const status = await testPage.evaluate(() => {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ error: 'timeout' });
        }, 5000);

        try {
          chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
            clearTimeout(timeout);
            resolve(response || { error: 'no response' });
          });
        } catch (e) {
          clearTimeout(timeout);
          resolve({ error: e.message });
        }
      });
    });

    await testPage.close();

    if (status.error) {
      console.log(`[Step 4] Messaging issue: ${status.error}`);
    } else {
      console.log('[Step 4] Extension messaging works!');
      console.log(`  Connected: ${status.connected}`);
      console.log(`  Automation: ${status.automationEnabled}`);
    }
    console.log();

    console.log('[Step 5] Testing page navigation...');

    const navPage = await browser.newPage();
    await navPage.goto('https://example.com', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    const navUrl = navPage.url();
    const navTitle = await navPage.title();
    await navPage.close();

    console.log(`[Step 5] Navigation successful`);
    console.log(`  URL: ${navUrl}`);
    console.log(`  Title: ${navTitle}`);
    console.log();

    // Success!
    console.log('='.repeat(50));
    console.log('TEST PASSED - Extension loads and works correctly!');
    console.log('='.repeat(50));

  } catch (error) {
    console.error();
    console.error('[ERROR]', error.message);
    console.error();

    if (error.message.includes('timeout')) {
      console.error('Possible causes:');
      console.error('  1. Chrome not installed or wrong path');
      console.error('  2. DISPLAY not set (need Xvfb)');
      console.error('  3. Extension has errors preventing load');
      console.error('  4. Sandbox issues (try --no-sandbox)');
    }

    console.error();
    console.log('='.repeat(50));
    console.log('TEST FAILED');
    console.log('='.repeat(50));

    process.exit(1);

  } finally {
    if (browser) {
      console.log();
      console.log('[Cleanup] Closing browser...');
      await browser.close();
    }
  }
}

// Run
simpleTest();
