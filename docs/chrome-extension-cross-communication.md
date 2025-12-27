# Chrome Extension Cross-Extension Communication Guide

## Overview

Chrome extensions can communicate with each other through several official APIs and creative workarounds. This document covers Manifest V3 (MV3) compatible methods, security restrictions, and practical patterns.

---

## 1. Chrome Extension APIs for Cross-Extension Communication

### 1.1 Direct Extension-to-Extension Messaging

Chrome provides built-in APIs for extensions to communicate with each other.

#### `chrome.runtime.sendMessage()` with Extension ID

Extensions can send one-time messages to other extensions by specifying the target extension's ID.

**Sending Extension (sender.js - service worker or content script):**
```javascript
// Send a message to another extension
const TARGET_EXTENSION_ID = 'abcdefghijklmnopqrstuvwxyz123456';

chrome.runtime.sendMessage(
  TARGET_EXTENSION_ID,
  { type: 'GET_DATA', payload: { url: window.location.href } },
  (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error:', chrome.runtime.lastError.message);
      return;
    }
    console.log('Response from other extension:', response);
  }
);
```

**Receiving Extension (background.js / service worker):**
```javascript
// Listen for messages from external extensions
chrome.runtime.onMessageExternal.addListener(
  (message, sender, sendResponse) => {
    // Verify the sender extension ID for security
    const ALLOWED_EXTENSIONS = [
      'zyxwvutsrqponmlkjihgfedcba654321'
    ];

    if (!ALLOWED_EXTENSIONS.includes(sender.id)) {
      console.warn('Rejected message from unknown extension:', sender.id);
      sendResponse({ error: 'Unauthorized' });
      return;
    }

    // Handle the message
    if (message.type === 'GET_DATA') {
      // Process and respond
      sendResponse({
        success: true,
        data: { /* your data */ }
      });
    }

    // Return true to indicate async response
    return true;
  }
);
```

#### `chrome.runtime.connect()` for Long-Lived Connections

For ongoing communication, use port-based connections:

**Sender Extension:**
```javascript
const TARGET_EXTENSION_ID = 'abcdefghijklmnopqrstuvwxyz123456';

const port = chrome.runtime.connect(TARGET_EXTENSION_ID, { name: 'data-channel' });

port.onMessage.addListener((msg) => {
  console.log('Received:', msg);
});

port.onDisconnect.addListener(() => {
  console.log('Port disconnected');
  if (chrome.runtime.lastError) {
    console.error('Disconnect error:', chrome.runtime.lastError.message);
  }
});

// Send messages through the port
port.postMessage({ type: 'SUBSCRIBE', topic: 'page-analysis' });
```

**Receiver Extension:**
```javascript
chrome.runtime.onConnectExternal.addListener((port) => {
  console.log('External connection from:', port.sender.id);

  port.onMessage.addListener((msg) => {
    if (msg.type === 'SUBSCRIBE') {
      // Handle subscription
      port.postMessage({ type: 'SUBSCRIBED', topic: msg.topic });
    }
  });

  port.onDisconnect.addListener(() => {
    console.log('Port disconnected');
  });
});
```

### 1.2 The `externally_connectable` Manifest Key

For an extension to receive messages from other extensions or web pages, it must declare `externally_connectable` in its manifest.

**manifest.json (Receiving Extension):**
```json
{
  "manifest_version": 3,
  "name": "Receiving Extension",
  "version": "1.0",
  "externally_connectable": {
    "ids": [
      "abcdefghijklmnopqrstuvwxyz123456",
      "zyxwvutsrqponmlkjihgfedcba654321"
    ],
    "matches": [
      "https://*.example.com/*"
    ],
    "accepts_tls_channel_id": false
  }
}
```

**Key Points:**
- `ids`: Array of extension IDs allowed to connect. Use `["*"]` to allow all extensions (not recommended for security).
- `matches`: URL patterns for web pages allowed to connect (for web-to-extension messaging).
- If `externally_connectable` is not declared, only extensions with the same origin can connect.

### 1.3 Permissions Required

**For the SENDING extension:**
- No special permissions required to send messages to other extensions.
- The target extension ID must be known.

**For the RECEIVING extension:**
- Must declare `externally_connectable` in manifest.
- Must have a service worker listening for `onMessageExternal` or `onConnectExternal`.

---

## 2. Security Restrictions

### 2.1 What Chrome Prevents

| Action | Allowed? | Notes |
|--------|----------|-------|
| Send messages to extensions declaring your ID in `externally_connectable` | Yes | Requires target extension cooperation |
| Send messages to extensions NOT declaring your ID | No | Messages silently fail or error |
| Access another extension's storage | No | Each extension has isolated storage |
| Read another extension's DOM (popup/options) | No | Extensions run in isolated contexts |
| Inject content scripts into extension pages | No | `chrome-extension://` URLs are protected |
| Access another extension's background/service worker | No | Completely isolated |
| Share cookies between extensions | No | Each extension has isolated cookie jar |
| Access another extension's local files | No | File system is sandboxed |

### 2.2 Extension Page Isolation

**Extension pages (popup, options, sidepanel) are protected:**
```javascript
// This will FAIL - you cannot inject into extension pages
chrome.scripting.executeScript({
  target: { tabId: extensionTabId },
  files: ['inject.js']
});
// Error: Cannot access a chrome-extension:// URL
```

**You CANNOT:**
- Use content scripts on `chrome-extension://` URLs
- Access the DOM of another extension's popup
- Read another extension's options page data
- Inspect or modify another extension's internal state

### 2.3 Storage Isolation

Each extension has completely isolated storage:

```javascript
// Extension A
chrome.storage.local.set({ key: 'value-from-A' });

// Extension B - CANNOT see Extension A's data
chrome.storage.local.get('key', (result) => {
  console.log(result.key); // undefined
});
```

### 2.4 Same-Origin Policy for Extensions

- Each extension has its own origin: `chrome-extension://<extension-id>`
- Extensions cannot make cross-origin requests to other extensions' resources
- `web_accessible_resources` can expose specific files, but not grant full access

---

## 3. Workarounds and Patterns

### 3.1 Content Scripts on Web Pages as Intermediary

Extensions can communicate through a shared web page by both injecting content scripts.

**Pattern: Shared DOM Element Communication**

```javascript
// Extension A - Content Script
const channel = document.createElement('div');
channel.id = '__ext_comm_channel__';
channel.style.display = 'none';
document.body.appendChild(channel);

// Send message
channel.setAttribute('data-message', JSON.stringify({
  from: 'extension-a',
  type: 'REQUEST',
  payload: { query: 'technologies' }
}));
channel.dispatchEvent(new CustomEvent('ext-message'));

// Listen for response
channel.addEventListener('ext-response', () => {
  const response = JSON.parse(channel.getAttribute('data-response'));
  console.log('Got response:', response);
});
```

```javascript
// Extension B - Content Script
const channel = document.getElementById('__ext_comm_channel__');
if (channel) {
  channel.addEventListener('ext-message', () => {
    const message = JSON.parse(channel.getAttribute('data-message'));

    if (message.type === 'REQUEST') {
      // Process and respond
      channel.setAttribute('data-response', JSON.stringify({
        from: 'extension-b',
        technologies: ['React', 'Node.js']
      }));
      channel.dispatchEvent(new CustomEvent('ext-response'));
    }
  });
}
```

**Pattern: Window PostMessage**

```javascript
// Extension A - Content Script
window.postMessage({
  source: 'my-extension-a',
  type: 'REQUEST',
  payload: {}
}, '*');

window.addEventListener('message', (event) => {
  if (event.data.source === 'extension-b-response') {
    console.log('Response:', event.data);
  }
});
```

```javascript
// Extension B - Content Script
window.addEventListener('message', (event) => {
  if (event.data.source === 'my-extension-a') {
    // Respond
    window.postMessage({
      source: 'extension-b-response',
      data: { /* response data */ }
    }, '*');
  }
});
```

**Limitations:**
- Only works on pages where both extensions have content scripts
- Relies on matching URL patterns
- Page scripts can also see/intercept these messages
- Not secure for sensitive data

### 3.2 External WebSocket/HTTP Server

Extensions can communicate through an external server.

**Service Worker (both extensions):**
```javascript
// Connect to shared WebSocket server
const ws = new WebSocket('wss://your-server.com/extension-bridge');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'REGISTER',
    extensionId: chrome.runtime.id
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.targetExtension === chrome.runtime.id) {
    // Handle message from another extension
    handleExternalMessage(message);
  }
};

function sendToExtension(targetId, data) {
  ws.send(JSON.stringify({
    type: 'RELAY',
    targetExtension: targetId,
    sourceExtension: chrome.runtime.id,
    payload: data
  }));
}
```

**Server (Node.js example):**
```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const extensions = new Map();

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    const message = JSON.parse(data);

    if (message.type === 'REGISTER') {
      extensions.set(message.extensionId, ws);
    } else if (message.type === 'RELAY') {
      const target = extensions.get(message.targetExtension);
      if (target) {
        target.send(JSON.stringify(message));
      }
    }
  });
});
```

**Advantages:**
- Works across all tabs and windows
- Doesn't require cooperation from target extension
- Can bridge with non-extension applications

**Disadvantages:**
- Requires external infrastructure
- Latency
- Security considerations (authentication needed)

### 3.3 Shared Web Domain Storage

Extensions with content scripts on the same domain can share data via the page's localStorage.

```javascript
// Extension A - Content script on example.com
localStorage.setItem('__shared_ext_data__', JSON.stringify({
  timestamp: Date.now(),
  data: { technologies: ['React'] }
}));
```

```javascript
// Extension B - Content script on example.com
const shared = JSON.parse(localStorage.getItem('__shared_ext_data__') || '{}');
console.log('Shared data:', shared);
```

**Limitations:**
- Only works on pages both extensions run on
- Page scripts and other extensions can access this data
- Not secure for sensitive information
- Can be cleared by user or page

### 3.4 Native Messaging Bridge

Both extensions can communicate with the same native application.

**manifest.json:**
```json
{
  "permissions": ["nativeMessaging"],
  "externally_connectable": {
    "ids": ["*"]
  }
}
```

**Service Worker:**
```javascript
const port = chrome.runtime.connectNative('com.example.bridge');

port.onMessage.addListener((message) => {
  if (message.from !== chrome.runtime.id) {
    // Message from another extension via native bridge
    handleBridgedMessage(message);
  }
});

port.postMessage({
  from: chrome.runtime.id,
  to: 'target-extension-id',
  payload: { /* data */ }
});
```

**Native Host (Python example):**
```python
import json
import struct
import sys

def read_message():
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None
    length = struct.unpack('I', raw_length)[0]
    message = sys.stdin.buffer.read(length).decode('utf-8')
    return json.loads(message)

def send_message(message):
    encoded = json.dumps(message).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('I', len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()

# Message routing
connections = {}  # Track extension connections

while True:
    message = read_message()
    if message:
        # Route to target extension
        target = message.get('to')
        if target in connections:
            send_message(message)
```

---

## 4. Practical Examples

### 4.1 Interacting with Wappalyzer/BuiltWith-style Extensions

#### What's POSSIBLE:

**1. If they support `externally_connectable` (rare):**
```javascript
// Check if Wappalyzer allows external messaging
const WAPPALYZER_ID = 'gppongmhjkpfnbhagpmjfkondmcpowia';

chrome.runtime.sendMessage(
  WAPPALYZER_ID,
  { action: 'getTechnologies' },
  (response) => {
    if (chrome.runtime.lastError) {
      // Wappalyzer doesn't accept external messages
      console.log('Wappalyzer does not support external messaging');
    } else {
      console.log('Technologies:', response);
    }
  }
);
```

**2. Reading their web_accessible_resources:**
```javascript
// Some extensions expose data files
fetch(`chrome-extension://${WAPPALYZER_ID}/technologies.json`)
  .then(r => r.json())
  .then(data => console.log('Tech definitions:', data))
  .catch(e => console.log('Resource not accessible'));
```

**3. Scraping their badge/popup (DOESN'T WORK):**
```javascript
// This CANNOT work - extension pages are protected
// You cannot access chrome-extension:// URLs from other extensions
```

#### What's FEASIBLE with Workarounds:

**1. Content Script Communication (if both run on same page):**
```javascript
// Your extension's content script
// Detect Wappalyzer's content script modifications

// Wappalyzer may add data attributes or elements
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.target.id?.includes('wappalyzer')) {
      // Found Wappalyzer-related DOM changes
      console.log('Wappalyzer data detected');
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true
});
```

**2. Reading the Same Page Data:**

Instead of relying on Wappalyzer, implement similar detection:

```javascript
// Detect technologies yourself
function detectTechnologies() {
  const technologies = [];

  // Check meta tags
  const generator = document.querySelector('meta[name="generator"]');
  if (generator) {
    technologies.push({ name: generator.content, category: 'CMS' });
  }

  // Check for common libraries
  if (window.React) technologies.push({ name: 'React', category: 'Framework' });
  if (window.Vue) technologies.push({ name: 'Vue.js', category: 'Framework' });
  if (window.angular) technologies.push({ name: 'Angular', category: 'Framework' });
  if (window.jQuery) technologies.push({ name: 'jQuery', category: 'Library' });

  // Check scripts
  document.querySelectorAll('script[src]').forEach(script => {
    const src = script.src.toLowerCase();
    if (src.includes('gtag') || src.includes('google-analytics')) {
      technologies.push({ name: 'Google Analytics', category: 'Analytics' });
    }
    if (src.includes('hotjar')) {
      technologies.push({ name: 'Hotjar', category: 'Analytics' });
    }
  });

  return technologies;
}
```

**3. Shared Server Approach:**
```javascript
// Both your extension and a hypothetical cooperating extension
// send data to a shared API

// Your extension
async function shareDetectedData(url, data) {
  await fetch('https://your-api.com/extension-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      extensionId: chrome.runtime.id,
      url: url,
      data: data
    })
  });
}

// Query for data from other extensions
async function getSharedData(url) {
  const response = await fetch(`https://your-api.com/extension-data?url=${encodeURIComponent(url)}`);
  return response.json();
}
```

### 4.2 Creating a Cooperative Extension Ecosystem

If you control multiple extensions, here's a complete setup:

**Extension A (Data Provider) - manifest.json:**
```json
{
  "manifest_version": 3,
  "name": "Data Provider Extension",
  "version": "1.0",
  "permissions": ["storage"],
  "background": {
    "service_worker": "background.js"
  },
  "externally_connectable": {
    "ids": [
      "your-consumer-extension-id-here"
    ]
  }
}
```

**Extension A - background.js:**
```javascript
// Store detected data
const pageData = new Map();

// Listen for requests from approved extensions
chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    console.log('Request from:', sender.id);

    switch (request.action) {
      case 'getPageData':
        const data = pageData.get(request.url);
        sendResponse({ success: true, data: data || null });
        break;

      case 'getAllData':
        sendResponse({
          success: true,
          data: Object.fromEntries(pageData)
        });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }

    return true; // Keep channel open for async response
  }
);

// Collect data from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PAGE_DATA') {
    pageData.set(sender.tab.url, message.data);
    sendResponse({ stored: true });
  }
  return true;
});
```

**Extension B (Data Consumer) - manifest.json:**
```json
{
  "manifest_version": 3,
  "name": "Data Consumer Extension",
  "version": "1.0",
  "permissions": ["activeTab"],
  "background": {
    "service_worker": "background.js"
  }
}
```

**Extension B - background.js:**
```javascript
const PROVIDER_EXTENSION_ID = 'provider-extension-id-here';

async function getDataFromProvider(url) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      PROVIDER_EXTENSION_ID,
      { action: 'getPageData', url: url },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      }
    );
  });
}

// Use in popup or elsewhere
chrome.action.onClicked.addListener(async (tab) => {
  try {
    const data = await getDataFromProvider(tab.url);
    console.log('Data from provider:', data);
  } catch (error) {
    console.error('Failed to get data:', error);
  }
});
```

---

## 5. Summary: Feasibility Matrix

| Method | Requires Cooperation | Works with Any Extension | Security | Complexity |
|--------|---------------------|-------------------------|----------|------------|
| `runtime.sendMessage` with ID | Yes (externally_connectable) | No | High | Low |
| `runtime.connect` with ID | Yes (externally_connectable) | No | High | Low |
| Content script DOM sharing | No | Partial (same pages) | Low | Medium |
| Window.postMessage | No | Partial (same pages) | Low | Low |
| External WebSocket server | No | Yes | Medium | High |
| Shared domain localStorage | No | Partial (same pages) | Low | Low |
| Native messaging bridge | Yes (same native app) | No | High | High |
| web_accessible_resources | No | Partial (if exposed) | Medium | Low |

---

## 6. Best Practices

### Security Recommendations

1. **Always verify sender ID:**
```javascript
chrome.runtime.onMessageExternal.addListener((msg, sender, respond) => {
  const ALLOWED = ['known-extension-id'];
  if (!ALLOWED.includes(sender.id)) {
    respond({ error: 'Unauthorized' });
    return;
  }
  // Process message...
});
```

2. **Use specific extension IDs, not wildcards:**
```json
{
  "externally_connectable": {
    "ids": ["specific-id-1", "specific-id-2"]
  }
}
```

3. **Validate message structure:**
```javascript
function validateMessage(message) {
  return message
    && typeof message.action === 'string'
    && ['getData', 'setData'].includes(message.action);
}
```

4. **Don't expose sensitive data through web_accessible_resources**

### Performance Recommendations

1. Use one-time messages (`sendMessage`) for simple request/response
2. Use port connections (`connect`) for streaming or frequent communication
3. Implement message queuing for high-frequency scenarios
4. Add timeouts for external communication

---

## 7. References

- Chrome Extensions Messaging Documentation: https://developer.chrome.com/docs/extensions/mv3/messaging/
- Runtime API Reference: https://developer.chrome.com/docs/extensions/reference/api/runtime
- externally_connectable: https://developer.chrome.com/docs/extensions/mv3/manifest/externally_connectable/
- Native Messaging: https://developer.chrome.com/docs/extensions/mv3/nativeMessaging/
- Content Scripts: https://developer.chrome.com/docs/extensions/mv3/content_scripts/

---

*Document created: December 2024*
*Manifest Version: 3 (MV3)*
