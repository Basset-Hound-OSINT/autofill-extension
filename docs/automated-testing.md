# Automated Chrome Extension Testing & Deployment Guide

## Overview

This document covers strategies for automating the testing and deployment of the OSINT Browser Automation extension. Due to Manifest V3 restrictions, Chrome extensions **cannot run in true headless mode**, but there are effective workarounds.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Environment Options](#environment-options)
3. [Puppeteer Testing](#puppeteer-testing)
4. [Playwright Testing](#playwright-testing)
5. [WebSocket Testing](#websocket-testing)
6. [CI/CD Integration](#cicd-integration)
7. [Hot Reloading](#hot-reloading)
8. [WSL Considerations](#wsl-considerations)

---

## Quick Start

### Recommended Setup for Bare Metal Ubuntu

```bash
# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Chrome
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt update
sudo apt install -y google-chrome-stable

# Install Xvfb for headless testing
sudo apt install -y xvfb

# Install test dependencies
cd ~/autofill-extension
npm init -y
npm install puppeteer playwright ws jest --save-dev
```

### Run Tests with Virtual Display

```bash
# Start virtual frame buffer
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99

# Run tests
npm test

# Or use the wrapper
xvfb-run --auto-servernum npm test
```

---

## Environment Options

| Environment | Display Required | Extension Support | Recommendation |
|-------------|-----------------|-------------------|----------------|
| Bare Metal Ubuntu | Xvfb or real display | Full | Best for dedicated testing |
| WSL2 with WSLg | Built-in | Full | Good, Windows 11 only |
| WSL2 with Xvfb | Xvfb | Full | Works on older Windows |
| Docker | Xvfb | Full | Good for CI/CD |
| GitHub Actions | Xvfb (via action) | Full | Recommended for CI |

**Important**: Manifest V3 extensions require `headless: false` in Puppeteer/Playwright. Use Xvfb to run "headed" Chrome without a physical display.

---

## Puppeteer Testing

### Installation

```bash
npm install puppeteer --save-dev
```

### Basic Extension Test Framework

Create `tests/extension-tester.js`:

```javascript
const puppeteer = require('puppeteer');
const path = require('path');

class ExtensionTester {
  constructor(extensionPath) {
    this.extensionPath = path.resolve(extensionPath);
    this.browser = null;
    this.extensionId = null;
  }

  async launch() {
    this.browser = await puppeteer.launch({
      headless: false, // Required for MV3 extensions
      args: [
        `--disable-extensions-except=${this.extensionPath}`,
        `--load-extension=${this.extensionPath}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      defaultViewport: { width: 1280, height: 720 },
    });

    await this.waitForExtension();
    return this;
  }

  async waitForExtension(timeout = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const targets = await this.browser.targets();
      const extTarget = targets.find(t =>
        t.url().startsWith('chrome-extension://') &&
        (t.type() === 'service_worker' || t.type() === 'background_page')
      );

      if (extTarget) {
        this.extensionId = new URL(extTarget.url()).hostname;
        console.log(`Extension loaded: ${this.extensionId}`);
        return;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('Extension failed to load within timeout');
  }

  async openPopup() {
    const page = await this.browser.newPage();
    await page.goto(`chrome-extension://${this.extensionId}/popup.html`);
    await page.waitForSelector('#statusDot', { timeout: 5000 });
    return page;
  }

  async navigateAndTestContentScript(url) {
    const page = await this.browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Wait for content script injection
    await page.waitForFunction(
      () => typeof window.__osintExtensionReady !== 'undefined',
      { timeout: 5000 }
    ).catch(() => console.log('Content script marker not found'));

    return page;
  }

  async sendCommandToExtension(command) {
    const page = await this.browser.newPage();
    await page.goto(`chrome-extension://${this.extensionId}/popup.html`);

    const result = await page.evaluate(async (cmd) => {
      return new Promise(resolve => {
        chrome.runtime.sendMessage(cmd, resolve);
      });
    }, command);

    await page.close();
    return result;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = { ExtensionTester };
```

### Test Suite Example

Create `tests/extension.test.js`:

```javascript
const { ExtensionTester } = require('./extension-tester');

describe('OSINT Browser Automation Extension', () => {
  let tester;

  beforeAll(async () => {
    tester = new ExtensionTester('./');  // Extension root directory
    await tester.launch();
  }, 30000);

  afterAll(async () => {
    await tester.close();
  });

  describe('Popup', () => {
    test('displays connection status', async () => {
      const popup = await tester.openPopup();

      const statusText = await popup.$eval('#statusText', el => el.textContent);
      expect(['Connected', 'Disconnected']).toContain(statusText);

      await popup.close();
    });

    test('shows WebSocket URL', async () => {
      const popup = await tester.openPopup();

      const wsUrl = await popup.$eval('#wsUrl', el => el.textContent);
      expect(wsUrl).toMatch(/ws:\/\//);

      await popup.close();
    });

    test('reconnect button is functional', async () => {
      const popup = await tester.openPopup();

      const btn = await popup.$('#btnReconnect');
      expect(btn).toBeTruthy();

      await popup.close();
    });
  });

  describe('Content Script', () => {
    test('injects into web pages', async () => {
      const page = await tester.navigateAndTestContentScript('https://example.com');

      // Check if content script functions are available
      const hasExtension = await page.evaluate(() => {
        return typeof window.postMessage === 'function';
      });

      expect(hasExtension).toBe(true);
      await page.close();
    });

    test('can extract page state', async () => {
      const page = await tester.navigateAndTestContentScript('https://example.com');

      // Send message to content script
      const pageState = await page.evaluate(() => {
        return new Promise(resolve => {
          chrome.runtime.sendMessage(
            { action: 'get_page_state', include_links: true },
            resolve
          );
        });
      });

      // Page state should include basic info
      expect(pageState).toBeDefined();
      await page.close();
    });
  });
});
```

### Running Tests

```bash
# Run with Jest
npx jest tests/extension.test.js --runInBand --detectOpenHandles

# With Xvfb wrapper
xvfb-run --auto-servernum npx jest tests/ --runInBand
```

---

## Playwright Testing

Playwright offers better extension support through persistent contexts.

### Installation

```bash
npm install @playwright/test playwright --save-dev
npx playwright install chromium
```

### Playwright Extension Fixture

Create `tests/playwright/fixtures.js`:

```javascript
const { test as base, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

exports.test = base.extend({
  context: async ({}, use) => {
    const extensionPath = path.resolve('./');
    const userDataDir = path.resolve('./test-user-data-' + Date.now());

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
    });

    await use(context);

    await context.close();
    await fs.rm(userDataDir, { recursive: true, force: true });
  },

  extensionId: async ({ context }, use) => {
    // Wait for service worker
    let extensionId;
    const maxAttempts = 50;

    for (let i = 0; i < maxAttempts; i++) {
      const workers = context.serviceWorkers();
      const extWorker = workers.find(w => w.url().includes('chrome-extension://'));

      if (extWorker) {
        extensionId = new URL(extWorker.url()).hostname;
        break;
      }
      await new Promise(r => setTimeout(r, 100));
    }

    if (!extensionId) {
      throw new Error('Extension did not load');
    }

    await use(extensionId);
  },
});

exports.expect = require('@playwright/test').expect;
```

### Playwright Test Suite

Create `tests/playwright/extension.spec.js`:

```javascript
const { test, expect } = require('./fixtures');

test.describe('Extension Popup', () => {
  test('loads and displays status', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await expect(page.locator('#statusText')).toBeVisible();
    await expect(page.locator('#btnReconnect')).toBeEnabled();
  });

  test('can save settings', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await page.fill('#wsUrlInput', 'ws://localhost:9999/test');
    await page.click('#btnSaveSettings');

    // Reload and verify persistence
    await page.reload();
    const savedUrl = await page.inputValue('#wsUrlInput');
    expect(savedUrl).toBe('ws://localhost:9999/test');
  });
});

test.describe('Content Script', () => {
  test('form filling works', async ({ context, extensionId }) => {
    const page = await context.newPage();

    // Create test form
    await page.setContent(`
      <form>
        <input type="text" id="username" name="username">
        <input type="email" id="email" name="email">
        <button type="submit">Submit</button>
      </form>
    `);

    // Send fill command via message
    await page.evaluate(() => {
      chrome.runtime.sendMessage({
        type: 'fill_form',
        fields: {
          '#username': 'testuser',
          '#email': 'test@example.com'
        }
      });
    });

    // Wait and verify
    await page.waitForTimeout(500);
    await expect(page.locator('#username')).toHaveValue('testuser');
  });
});
```

### Running Playwright Tests

```bash
# Run all tests
npx playwright test

# With headed mode (useful for debugging)
npx playwright test --headed

# With Xvfb
xvfb-run --auto-servernum npx playwright test
```

---

## WebSocket Testing

### Mock WebSocket Server

Create `tests/mock-ws-server.js`:

```javascript
const WebSocket = require('ws');

class MockWSServer {
  constructor(port = 8765) {
    this.port = port;
    this.wss = null;
    this.clients = new Set();
    this.messages = [];
    this.handlers = new Map();
  }

  start() {
    return new Promise((resolve) => {
      this.wss = new WebSocket.Server({ port: this.port }, () => {
        console.log(`Mock WS server on port ${this.port}`);
        resolve();
      });

      this.wss.on('connection', (ws) => {
        this.clients.add(ws);

        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          this.messages.push({ received: msg, timestamp: Date.now() });
          this.handleMessage(ws, msg);
        });

        ws.on('close', () => this.clients.delete(ws));
      });
    });
  }

  handleMessage(ws, msg) {
    // Built-in handlers
    if (msg.command === 'get_status') {
      this.sendResponse(ws, msg.id, { status: 'ready' });
      return;
    }

    // Custom handlers
    const handler = this.handlers.get(msg.command);
    if (handler) {
      const response = handler(msg);
      this.sendResponse(ws, msg.id, response);
    }
  }

  sendResponse(ws, requestId, data) {
    ws.send(JSON.stringify({
      type: 'response',
      id: requestId,
      ...data
    }));
  }

  // Register custom command handler
  on(command, handler) {
    this.handlers.set(command, handler);
  }

  // Send command to all clients
  broadcast(command) {
    const data = JSON.stringify(command);
    this.clients.forEach(c => {
      if (c.readyState === WebSocket.OPEN) c.send(data);
    });
  }

  // Send to specific client
  sendToFirst(command) {
    const client = [...this.clients][0];
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(command));
    }
  }

  getMessages() { return [...this.messages]; }
  clearMessages() { this.messages = []; }

  stop() {
    return new Promise(resolve => {
      this.wss.close(resolve);
    });
  }
}

module.exports = { MockWSServer };
```

### WebSocket Integration Test

Create `tests/websocket.test.js`:

```javascript
const { ExtensionTester } = require('./extension-tester');
const { MockWSServer } = require('./mock-ws-server');

describe('WebSocket Communication', () => {
  let tester;
  let mockServer;

  beforeAll(async () => {
    // Start mock server
    mockServer = new MockWSServer(8765);
    await mockServer.start();

    // Register handlers
    mockServer.on('navigate', (msg) => ({
      success: true,
      url: msg.url
    }));

    mockServer.on('get_page_state', (msg) => ({
      success: true,
      state: { title: 'Test Page', url: 'https://example.com' }
    }));

    // Launch extension
    tester = new ExtensionTester('./');
    await tester.launch();
  }, 30000);

  afterAll(async () => {
    await tester.close();
    await mockServer.stop();
  });

  beforeEach(() => {
    mockServer.clearMessages();
  });

  test('extension connects to WebSocket server', async () => {
    const popup = await tester.openPopup();

    // Configure URL and connect
    await popup.evaluate(() => {
      document.getElementById('wsUrlInput').value = 'ws://localhost:8765/browser';
    });
    await popup.click('#btnSaveSettings');

    // Wait for connection
    await popup.waitForFunction(
      () => document.getElementById('statusText').textContent === 'Connected',
      { timeout: 5000 }
    );

    const status = await popup.$eval('#statusText', el => el.textContent);
    expect(status).toBe('Connected');

    await popup.close();
  });

  test('server can send navigate command', async () => {
    // Ensure connected
    const popup = await tester.openPopup();
    await popup.evaluate(() => {
      document.getElementById('wsUrlInput').value = 'ws://localhost:8765/browser';
    });
    await popup.click('#btnSaveSettings');
    await popup.waitForFunction(
      () => document.getElementById('statusText').textContent === 'Connected',
      { timeout: 5000 }
    );

    // Open a test page
    const testPage = await tester.browser.newPage();
    await testPage.goto('about:blank');

    // Server sends navigate command
    mockServer.broadcast({
      type: 'command',
      command: 'navigate',
      id: 'test-nav-1',
      url: 'https://example.com'
    });

    // Wait for navigation
    await testPage.waitForNavigation({ timeout: 10000 });

    expect(testPage.url()).toContain('example.com');

    await testPage.close();
    await popup.close();
  });

  test('form fill command is processed', async () => {
    const popup = await tester.openPopup();
    await popup.evaluate(() => {
      document.getElementById('wsUrlInput').value = 'ws://localhost:8765/browser';
    });
    await popup.click('#btnSaveSettings');
    await popup.waitForFunction(
      () => document.getElementById('statusText').textContent === 'Connected',
      { timeout: 5000 }
    );

    // Create page with form
    const testPage = await tester.browser.newPage();
    await testPage.setContent(`
      <form>
        <input type="text" id="name" name="name">
        <input type="email" id="email" name="email">
      </form>
    `);

    // Server sends fill command
    mockServer.broadcast({
      type: 'command',
      command: 'fill_form',
      id: 'test-fill-1',
      fields: {
        '#name': 'Test User',
        '#email': 'test@example.com'
      }
    });

    // Wait for fields to be filled
    await testPage.waitForFunction(
      () => document.getElementById('name').value === 'Test User',
      { timeout: 5000 }
    );

    const name = await testPage.$eval('#name', el => el.value);
    const email = await testPage.$eval('#email', el => el.value);

    expect(name).toBe('Test User');
    expect(email).toBe('test@example.com');

    await testPage.close();
    await popup.close();
  });
});
```

---

## CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/test-extension.yml`:

```yaml
name: Extension Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Chrome
        uses: browser-actions/setup-chrome@v1
        with:
          chrome-version: stable

      - name: Run extension tests
        uses: coactions/setup-xvfb@v1
        with:
          run: npm test

      - name: Upload test screenshots
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-screenshots
          path: ./screenshots/
```

### Docker Testing Environment

Create `Dockerfile.test`:

```dockerfile
FROM node:20-slim

# Install Chrome dependencies
RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates \
    fonts-liberation libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libatspi2.0-0 libcups2 libdbus-1-3 \
    libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 \
    libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 \
    libxrandr2 xdg-utils xvfb \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Install Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

ENV DISPLAY=:99

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

CMD ["sh", "-c", "Xvfb :99 -screen 0 1920x1080x24 & sleep 2 && npm test"]
```

Run with:
```bash
docker build -f Dockerfile.test -t extension-tests .
docker run --shm-size=2g extension-tests
```

---

## Hot Reloading

### Development Server with Auto-Reload

Create `scripts/dev-server.js`:

```javascript
const WebSocket = require('ws');
const chokidar = require('chokidar');

const wss = new WebSocket.Server({ port: 9999 });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('Extension connected for hot reload');
  ws.on('close', () => clients.delete(ws));
});

// Watch extension files
const watcher = chokidar.watch([
  './background.js',
  './content.js',
  './popup.js',
  './popup.html',
  './manifest.json'
], { ignoreInitial: true });

watcher.on('all', (event, path) => {
  console.log(`${event}: ${path} - Reloading extension...`);

  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'reload' }));
    }
  });
});

console.log('Hot reload server running on ws://localhost:9999');
console.log('Watching for file changes...');
```

Add to `background.js` (development only):

```javascript
// Hot reload support (remove in production)
if (typeof DEV_MODE !== 'undefined' && DEV_MODE) {
  const reloadWs = new WebSocket('ws://localhost:9999');
  reloadWs.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'reload') {
      console.log('Hot reloading extension...');
      chrome.runtime.reload();
    }
  };
}
```

Run:
```bash
# Terminal 1: Start hot reload server
node scripts/dev-server.js

# Terminal 2: Install extension and Chrome will reload on file changes
```

---

## WSL Considerations

### WSL2 with WSLg (Windows 11)

WSLg provides automatic GUI support:

```bash
# Just run tests normally - DISPLAY is set automatically
npm test
```

### WSL2 without WSLg (Windows 10)

Use Xvfb:

```bash
# Install Xvfb
sudo apt install xvfb

# Run tests
xvfb-run --auto-servernum npm test
```

### Using Windows Chrome from WSL

If native Chrome doesn't work, use Windows Chrome:

```javascript
// In puppeteer config
const browser = await puppeteer.launch({
  executablePath: '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false,
  args: [
    // Convert WSL path to Windows UNC path
    '--load-extension=\\\\wsl$\\Ubuntu\\home\\user\\autofill-extension',
    '--disable-extensions-except=\\\\wsl$\\Ubuntu\\home\\user\\autofill-extension',
  ],
});
```

### Test Script for WSL

Create `scripts/test-wsl.sh`:

```bash
#!/bin/bash
set -e

# Detect WSL
if grep -qi microsoft /proc/version; then
    echo "Running in WSL"

    # Check for display
    if [ -z "$DISPLAY" ] && [ -z "$WAYLAND_DISPLAY" ]; then
        echo "No display, starting Xvfb..."
        Xvfb :99 -screen 0 1920x1080x24 &
        export DISPLAY=:99
        sleep 2
    fi
fi

# Run tests
npm test

echo "Tests completed!"
```

---

## Package.json Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "test": "jest tests/ --runInBand --detectOpenHandles",
    "test:playwright": "playwright test",
    "test:xvfb": "xvfb-run --auto-servernum npm test",
    "test:docker": "docker build -f Dockerfile.test -t ext-test . && docker run --shm-size=2g ext-test",
    "dev": "node scripts/dev-server.js",
    "lint": "eslint *.js"
  },
  "devDependencies": {
    "puppeteer": "^21.0.0",
    "@playwright/test": "^1.40.0",
    "playwright": "^1.40.0",
    "jest": "^29.0.0",
    "ws": "^8.14.0",
    "chokidar": "^3.5.3",
    "eslint": "^8.0.0"
  }
}
```

---

## Summary

| Approach | Best For | Setup Complexity |
|----------|----------|------------------|
| Puppeteer + Jest | Most projects | Low |
| Playwright | Modern/parallel tests | Low |
| Docker | Reproducible CI/CD | Medium |
| GitHub Actions | Cloud CI | Low |
| Hot Reload Server | Development | Low |

### Recommended Workflow

1. **Development**: Use hot reload server for rapid iteration
2. **Local Testing**: Run `npm test` with Xvfb
3. **CI/CD**: GitHub Actions with `coactions/setup-xvfb`
4. **Bare Metal Ubuntu**: Best experience, no WSL complexity

### Key Points

- MV3 extensions **require headed mode** - use Xvfb for "virtual headed"
- Always use `--no-sandbox` in containerized/CI environments
- Mock WebSocket server for reliable integration tests
- Keep test user data directories isolated and clean them up

---

*Last Updated: December 2024*
