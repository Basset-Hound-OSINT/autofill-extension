# Basset Hound Browser Automation Extension - Development Guide

This guide covers setup, development workflow, and best practices for working with the extension.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Setup](#project-setup)
- [Development Workflow](#development-workflow)
- [Code Structure](#code-structure)
- [Debugging](#debugging)
- [Common Tasks](#common-tasks)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- **Google Chrome** (version 88 or higher for Manifest V3 support)
- **Text Editor/IDE** (VS Code recommended)
- **Git** for version control
- **Python 3.8+** (for running the Basset Hound backend)

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "nickmillerdev.chrome-extension-manifest-json-support"
  ]
}
```

## Project Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd basset-hound/basset-hound-autofill-extension
```

### 2. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `basset-hound-autofill-extension` directory
5. Note the extension ID (you'll need this for debugging)

### 3. Verify Installation

After loading, you should see:
- Extension icon in the toolbar
- Extension listed on the extensions page
- No errors in the extension card

### 4. Start the Backend Server

The extension requires the Basset Hound backend WebSocket server:

```bash
# Navigate to backend directory
cd ../basset-hound-backend

# Start the WebSocket server
python websocket_server.py
```

The server should start on `ws://localhost:8765/browser`.

## Development Workflow

### File Watching

Chrome doesn't automatically reload extensions when files change. Use one of these approaches:

#### Manual Reload

1. Make changes to files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. If changing content scripts, also reload the target page

#### Using Extension Reloader

Install an extension reloader or use this bookmarklet:

```javascript
javascript:chrome.runtime.reload()
```

### Making Changes

#### Background Script Changes (background.js)

1. Edit the file
2. Click refresh on `chrome://extensions/`
3. If WebSocket was connected, it will reconnect automatically

#### Content Script Changes (content.js)

1. Edit the file
2. Click refresh on `chrome://extensions/`
3. Reload any pages where you want the updated script

#### Popup Changes (popup.html, popup.js)

1. Edit the files
2. Click refresh on `chrome://extensions/`
3. Close and reopen the popup

#### Manifest Changes (manifest.json)

1. Edit the file
2. The extension will automatically reload (or show an error)
3. If there's an error, fix it and reload manually

### Hot Tips

- Keep DevTools open for the service worker during development
- Use `console.log` liberally, then clean up before committing
- Test on multiple websites to catch edge cases

## Code Structure

### Directory Layout

```
basset-hound-autofill-extension/
├── manifest.json           # Extension configuration
├── background.js           # Service worker (WebSocket, command handling)
├── content.js              # DOM interaction (runs in page context)
├── popup.html              # Popup UI structure
├── popup.js                # Popup behavior
├── utils/
│   └── logger.js           # Structured logging utility
├── icons/
│   ├── icon16.svg
│   ├── icon48.svg
│   └── icon128.svg
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DEVELOPMENT.md
│   └── TESTING.md
└── README.md
```

### Key Files

#### manifest.json

Chrome extension configuration following Manifest V3 specification:

```json
{
  "manifest_version": 3,
  "name": "Basset Hound Browser Automation",
  "version": "1.0.0",
  "permissions": ["activeTab", "tabs", "scripting", "storage"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["utils/logger.js", "content.js"],
    "run_at": "document_idle"
  }]
}
```

#### background.js

Service worker responsibilities:
- WebSocket connection management
- Command routing and execution
- Tab management
- Response handling

Key sections:
- Configuration (lines 1-35)
- WebSocket management (lines 50-240)
- Command handlers (lines 240-620)
- Helper functions (lines 620-770)
- Message listeners (lines 770-820)
- Lifecycle events (lines 820-860)

#### content.js

Content script responsibilities:
- Form filling with realistic typing
- Element clicking and scrolling
- Content extraction
- Page state analysis
- Element finding with multiple strategies

Key sections:
- Message listener (lines 30-80)
- Form filling (lines 85-205)
- Click handling (lines 210-260)
- Content extraction (lines 260-365)
- Wait for element (lines 420-500)
- Element finding (lines 505-610)
- Selector generation (lines 610-680)

## Debugging

### Service Worker (Background Script)

1. Go to `chrome://extensions/`
2. Find the extension
3. Click "service worker" link
4. DevTools opens for the background script

**Useful console commands:**
```javascript
// Check connection state
connectionState

// View task queue
taskQueue

// Manually send test command
handleNavigate({ url: 'https://example.com' })
```

### Content Script

1. Open the target web page
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to the Console tab
4. Select the extension's content script context from the dropdown

**Useful console commands:**
```javascript
// Test element finding
findElement('#username')

// Get page state
handleGetPageState()

// Test form filling
handleFillForm({ '#email': 'test@example.com' }, false)
```

### Popup

1. Click the extension icon to open popup
2. Right-click the popup and select "Inspect"
3. DevTools opens for the popup

### Network Tab

For WebSocket debugging:
1. Open DevTools for the service worker
2. Go to Network tab
3. Filter by "WS"
4. Click on the WebSocket connection to see messages

### Logging

The extension uses structured logging. Enable verbose logging:

```javascript
// In background.js or content.js
logger.minLevel = LogLevel.DEBUG;
```

Log format:
```
[2024-01-01T12:00:00.000Z] [INFO] [Background] Message here
```

## Common Tasks

### Adding a New Command

1. **Define the handler** in `background.js`:

```javascript
async function handleNewCommand(params) {
  const { requiredParam, optionalParam = 'default' } = params;

  if (!requiredParam) {
    throw new Error('requiredParam is required');
  }

  logger.info('Executing new command', { requiredParam });

  // If it needs DOM access:
  return sendMessageToActiveTab({
    action: 'new_action',
    param: requiredParam
  });

  // If it's background-only:
  return { success: true, data: 'result' };
}
```

2. **Register the handler**:

```javascript
const commandHandlers = {
  // ... existing handlers
  new_command: handleNewCommand
};
```

3. **If using content script**, add handler in `content.js`:

```javascript
async function handleMessage(request) {
  switch (request.action) {
    // ... existing cases
    case 'new_action':
      return handleNewAction(request.param);
  }
}

async function handleNewAction(param) {
  // DOM manipulation here
  return { success: true, result: 'done' };
}
```

4. **Document** in `docs/API.md`

### Modifying Selector Finding

Edit `findElement()` in `content.js`:

```javascript
function findElement(selector) {
  // Add new strategy
  const variations = [
    // ... existing variations
    `[data-custom="${CSS.escape(selector)}"]`  // New strategy
  ];

  // ... rest of function
}
```

### Changing WebSocket Configuration

Edit `CONFIG` in `background.js`:

```javascript
const CONFIG = {
  WS_URL: 'ws://localhost:8765/browser',
  MAX_RECONNECT_ATTEMPTS: 10,
  INITIAL_RECONNECT_DELAY: 1000,
  MAX_RECONNECT_DELAY: 30000,
  COMMAND_TIMEOUT: 30000,
  HEARTBEAT_INTERVAL: 30000
};
```

### Adding Storage Persistence

```javascript
// Save data
await chrome.storage.local.set({ key: value });

// Read data
const result = await chrome.storage.local.get('key');
const value = result.key;

// Listen for changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.key) {
    console.log('Key changed:', changes.key.oldValue, '->', changes.key.newValue);
  }
});
```

## Best Practices

### Error Handling

Always wrap async operations in try-catch:

```javascript
async function doSomething() {
  try {
    const result = await riskyOperation();
    return { success: true, result };
  } catch (error) {
    logger.error('Operation failed', error);
    return { success: false, error: error.message };
  }
}
```

### Logging

Use appropriate log levels:
- `DEBUG`: Detailed info for troubleshooting
- `INFO`: General operational information
- `WARN`: Warning conditions that might need attention
- `ERROR`: Error conditions that need investigation

Include context in logs:
```javascript
logger.info('Processing command', { command_id, type, params });
```

### Chrome API Error Handling

Always check for `chrome.runtime.lastError`:

```javascript
chrome.tabs.sendMessage(tabId, message, (response) => {
  if (chrome.runtime.lastError) {
    // Handle error
    console.error(chrome.runtime.lastError.message);
    return;
  }
  // Process response
});
```

### Selector Safety

Always escape user input in selectors:

```javascript
const safeSelector = CSS.escape(userInput);
document.querySelector(`[data-id="${safeSelector}"]`);
```

### Event Dispatching

Dispatch proper events for form compatibility:

```javascript
element.value = 'new value';
element.dispatchEvent(new Event('input', { bubbles: true }));
element.dispatchEvent(new Event('change', { bubbles: true }));
```

## Troubleshooting

### Extension Won't Load

**Symptoms**: Error when loading unpacked extension

**Solutions**:
1. Check `manifest.json` for syntax errors
2. Ensure all files referenced in manifest exist
3. Check file permissions
4. Look for errors in Chrome's extension page

### WebSocket Won't Connect

**Symptoms**: Status stays "Connecting..." or "Disconnected"

**Solutions**:
1. Ensure backend server is running on port 8765
2. Check for firewall blocking localhost connections
3. Verify WebSocket URL is correct
4. Check service worker console for errors

### Content Script Not Working

**Symptoms**: Commands fail with "Cannot send message" or element not found

**Solutions**:
1. Check if content script is injected (look in page's DevTools Sources)
2. Reload the page after extension reload
3. Check for errors in content script console
4. Verify selector is correct for the page

### Form Filling Not Working

**Symptoms**: Fields aren't being filled or events aren't triggering

**Solutions**:
1. Check if element is visible and not disabled
2. Try different selector strategies
3. Check if site uses shadow DOM
4. Look for React/Vue state management issues
5. Try increasing typing delay

### Service Worker Dying

**Symptoms**: Connection lost, tasks not completing

**Solutions**:
1. Service workers automatically sleep after 30 seconds of inactivity
2. Heartbeat keeps connection alive - ensure it's running
3. Long-running tasks should use `chrome.alarms` for persistence
4. Check for unhandled promise rejections

### Memory Issues

**Symptoms**: Extension becomes slow, Chrome uses high memory

**Solutions**:
1. Check task queue isn't growing unbounded
2. Ensure logs are being cleaned up
3. Look for event listener leaks
4. Check for retained references to large objects
