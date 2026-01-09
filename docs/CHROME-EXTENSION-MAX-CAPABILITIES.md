# Chrome Extension Maximum Forensics Capabilities

**Version:** 1.0.0
**Last Updated:** 2026-01-09
**Target:** Chrome Manifest V3 Extensions
**Purpose:** Comprehensive documentation of browser forensics capabilities within Chrome extension constraints

---

## Table of Contents

1. [Chrome Extension Architecture](#1-chrome-extension-architecture)
2. [DOM & Page Analysis](#2-dom--page-analysis)
3. [Network Monitoring](#3-network-monitoring)
4. [Storage Forensics](#4-storage-forensics)
5. [Performance & Timing](#5-performance--timing)
6. [Security Headers & Policies](#6-security-headers--policies)
7. [Browser State](#7-browser-state)
8. [User Interactions](#8-user-interactions)
9. [Web APIs Usage Detection](#9-web-apis-usage-detection)
10. [Advanced Forensics](#10-advanced-forensics)
11. [Chrome Limitations](#11-what-we-cannot-do)
12. [Comparison Table](#12-comparison-table)
13. [Implementation Checklist](#13-implementation-checklist)

---

## 1. Chrome Extension Architecture

### 1.1 Manifest V3 Overview

Chrome extensions in Manifest V3 have three primary execution contexts:

#### Service Worker (Background)
- **Type:** Background service worker (replaces persistent background pages)
- **Lifecycle:** Event-driven, can be terminated when idle
- **Capabilities:**
  - Network request interception (webRequest API)
  - Cookie access across all domains
  - Tab management and control
  - Storage API access
  - WebSocket connections
  - declarativeNetRequest for request blocking/modification
- **Limitations:**
  - No DOM access (cannot read page content directly)
  - No window object
  - Can be terminated by Chrome when idle
  - Limited to Chrome Extension APIs

#### Content Scripts
- **Type:** JavaScript injected into web pages
- **Lifecycle:** Runs in isolated world with access to page DOM
- **Capabilities:**
  - Full DOM read/write access
  - Read computed styles
  - Access Shadow DOM
  - Inject inline scripts to access page context
  - Monitor DOM mutations
  - Intercept events
  - Read/write localStorage, sessionStorage, IndexedDB
- **Limitations:**
  - Isolated from page JavaScript (separate execution context)
  - Cannot access page's JavaScript variables directly
  - Limited Chrome API access (must message background)
  - CSP restrictions apply

#### DevTools Panel
- **Type:** Custom DevTools panel
- **Lifecycle:** Active when DevTools is open
- **Capabilities:**
  - Evaluate JavaScript in page context
  - Access chrome.devtools APIs
  - Network inspection
  - Timeline/performance data
  - Console access
  - Access to inspectedWindow
- **Limitations:**
  - Only available when DevTools is open
  - Cannot persist data when closed

### 1.2 Permissions Required

```json
{
  "permissions": [
    "activeTab",           // Access current tab
    "tabs",                // Tab management and URL access
    "tabGroups",           // Tab group management
    "scripting",           // Dynamic script injection
    "storage",             // chrome.storage API
    "notifications",       // Desktop notifications
    "cookies",             // Cookie access
    "webRequest",          // Network monitoring (READ ONLY in MV3)
    "webNavigation",       // Navigation events
    "declarativeNetRequest",              // Request blocking/modification
    "declarativeNetRequestWithHostAccess", // Host-specific rules
    "declarativeNetRequestFeedback",      // Rule matching feedback
    "downloads",           // File downloads
    "history",             // Browse history (limited)
    "bookmarks",           // Bookmark access
    "contextMenus",        // Right-click menus
    "clipboardWrite",      // Write to clipboard
    "clipboardRead",       // Read from clipboard (requires user gesture)
    "geolocation",         // Location API (requires user permission)
    "idle",                // Idle state detection
    "management",          // Extension management
    "pageCapture",         // Save complete pages as MHTML
    "power",               // Prevent system sleep
    "privacy",             // Privacy settings
    "processes",           // Process information
    "sessions",            // Recently closed tabs/windows
    "system.cpu",          // CPU information
    "system.display",      // Display information
    "system.memory",       // Memory information
    "system.storage",      // Storage information
    "topSites",            // Most visited sites
    "webNavigation",       // Navigation events
    "debugger"             // Chrome Debugger Protocol (very powerful)
  ],
  "host_permissions": [
    "<all_urls>"           // Access all websites
  ]
}
```

### 1.3 API Access Levels

| Context | DOM Access | Network APIs | Storage APIs | Tab APIs | System APIs |
|---------|-----------|--------------|--------------|----------|-------------|
| **Service Worker** | ❌ No | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **Content Script** | ✅ Full | ❌ Limited | ✅ Full | ❌ No | ❌ No |
| **DevTools** | ✅ Via eval | ✅ Via inspectedWindow | ✅ Full | ✅ Full | ✅ Full |

---

## 2. DOM & Page Analysis

### 2.1 Complete HTML Structure Extraction

**Capability:** Extract entire DOM tree including all elements, attributes, and text content.

#### What We Can Extract:
- ✅ Full document HTML (`document.documentElement.outerHTML`)
- ✅ Dynamic content loaded via JavaScript
- ✅ Hidden elements (`display: none`, `visibility: hidden`)
- ✅ Iframe content (if same-origin or with permissions)
- ✅ Shadow DOM content (open and closed)
- ✅ Custom elements and Web Components
- ✅ SVG content
- ✅ Canvas content (as data URL)
- ✅ All attributes including `data-*` attributes
- ✅ Element dimensions and positions
- ✅ Scroll positions
- ✅ Form field values (including passwords if not masked)

#### APIs:
```javascript
// Basic extraction
const html = document.documentElement.outerHTML;

// Shadow DOM extraction (even closed shadow roots via Chrome API)
function extractShadowDOM(element) {
  if (element.shadowRoot) {
    return {
      mode: 'open',
      html: element.shadowRoot.innerHTML,
      children: Array.from(element.shadowRoot.children).map(extractShadowDOM)
    };
  }

  // Closed shadow roots require Chrome internals
  // Can be accessed via chrome.debugger API
  return null;
}

// Deep clone with computed styles
function cloneWithStyles(element) {
  const clone = element.cloneNode(true);
  const computedStyle = window.getComputedStyle(element);
  // Copy all computed styles
  for (let prop of computedStyle) {
    clone.style[prop] = computedStyle[prop];
  }
  return clone;
}
```

**Implementation Status:**
- ✅ Implemented: `ContentExtractor.extractPageContent()`
- ✅ Implemented: Shadow DOM traversal
- ⚠️ Partial: Closed shadow roots (requires debugger API)

### 2.2 CSS Extraction

**Capability:** Extract all CSS including computed styles, inline styles, and external stylesheets.

#### What We Can Extract:
- ✅ All external stylesheets (`document.styleSheets`)
- ✅ Inline `<style>` tags
- ✅ Inline styles (`element.style`)
- ✅ Computed styles (`window.getComputedStyle()`)
- ✅ CSS custom properties (CSS variables)
- ✅ @import rules
- ✅ @media queries
- ✅ @keyframes animations
- ✅ CSS-in-JS styles
- ✅ Style inheritance chain

#### APIs:
```javascript
// Extract all stylesheets
function extractAllCSS() {
  const css = {
    external: [],
    inline: [],
    computed: {}
  };

  // External and inline stylesheets
  for (let sheet of document.styleSheets) {
    try {
      const rules = Array.from(sheet.cssRules || sheet.rules);
      css.external.push({
        href: sheet.href,
        rules: rules.map(r => r.cssText)
      });
    } catch (e) {
      // CORS blocked
      css.external.push({
        href: sheet.href,
        blocked: true,
        error: 'CORS'
      });
    }
  }

  // Inline style tags
  document.querySelectorAll('style').forEach(style => {
    css.inline.push(style.textContent);
  });

  // Computed styles for all elements
  document.querySelectorAll('*').forEach(el => {
    const computed = window.getComputedStyle(el);
    css.computed[generateSelector(el)] = {
      display: computed.display,
      visibility: computed.visibility,
      position: computed.position,
      // ... extract all relevant properties
    };
  });

  return css;
}
```

**Implementation Status:**
- ✅ Implemented: Basic CSS extraction in `ContentExtractor`
- ❌ Not implemented: Full computed style capture for all elements
- ❌ Not implemented: CSS rule matching analysis

### 2.3 JavaScript Analysis

**Capability:** Analyze JavaScript usage and detect scripts on the page.

#### What We Can Detect:
- ✅ All `<script>` tags (inline and external)
- ✅ Event handlers (onclick, onload, etc.)
- ✅ Inline JavaScript in attributes
- ✅ `javascript:` protocol URLs
- ✅ `eval()` usage detection
- ✅ Dynamic script injection
- ✅ Web Workers
- ✅ Service Workers registration
- ✅ JavaScript errors in console
- ⚠️ Obfuscated/minified code analysis (limited)

#### APIs:
```javascript
// Extract all scripts
function extractJavaScript() {
  const scripts = {
    inline: [],
    external: [],
    eventHandlers: [],
    dynamicScripts: []
  };

  // Script tags
  document.querySelectorAll('script').forEach(script => {
    if (script.src) {
      scripts.external.push({
        src: script.src,
        async: script.async,
        defer: script.defer,
        type: script.type,
        integrity: script.integrity,
        crossOrigin: script.crossOrigin
      });
    } else {
      scripts.inline.push({
        content: script.textContent,
        type: script.type,
        id: script.id
      });
    }
  });

  // Event handlers
  document.querySelectorAll('*').forEach(el => {
    for (let attr of el.attributes) {
      if (attr.name.startsWith('on')) {
        scripts.eventHandlers.push({
          element: generateSelector(el),
          event: attr.name,
          handler: attr.value
        });
      }
    }
  });

  return scripts;
}

// Monitor dynamic script injection
const scriptObserver = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.tagName === 'SCRIPT') {
        console.log('Dynamic script added:', node.src || 'inline');
      }
    });
  });
});

scriptObserver.observe(document, {
  childList: true,
  subtree: true
});
```

**Implementation Status:**
- ❌ Not implemented: Comprehensive JavaScript extraction
- ❌ Not implemented: Script analysis and fingerprinting
- ✅ Implemented: Basic script tag detection

### 2.4 Canvas & WebGL Content

**Capability:** Extract rendered canvas content and WebGL context information.

#### What We Can Extract:
- ✅ Canvas pixel data as PNG/JPEG (`canvas.toDataURL()`)
- ✅ Canvas dimensions
- ✅ 2D rendering context operations (via override)
- ✅ WebGL context information
- ✅ WebGL extensions
- ✅ WebGL parameters
- ✅ Shader source code
- ✅ Texture data
- ⚠️ Canvas fingerprinting techniques used

#### APIs:
```javascript
// Extract canvas content
function extractCanvas(canvas) {
  try {
    return {
      width: canvas.width,
      height: canvas.height,
      dataURL: canvas.toDataURL('image/png'),
      context2D: canvas.getContext('2d') !== null,
      contextWebGL: canvas.getContext('webgl') !== null,
      contextWebGL2: canvas.getContext('webgl2') !== null
    };
  } catch (e) {
    return { error: 'Canvas tainted by cross-origin data' };
  }
}

// Extract WebGL information
function extractWebGLInfo(canvas) {
  const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
  if (!gl) return null;

  return {
    vendor: gl.getParameter(gl.VENDOR),
    renderer: gl.getParameter(gl.RENDERER),
    version: gl.getParameter(gl.VERSION),
    shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
    extensions: gl.getSupportedExtensions(),
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxVertexAttributes: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
    maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS),
    maxFragmentUniforms: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
    maxVertexUniforms: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)
  };
}

// Extract all canvases on page
function extractAllCanvases() {
  return Array.from(document.querySelectorAll('canvas')).map(extractCanvas);
}
```

**Implementation Status:**
- ❌ Not implemented: Canvas content extraction
- ❌ Not implemented: WebGL context analysis
- ❌ Not implemented: Canvas fingerprinting detection

### 2.5 Media Elements

**Capability:** Extract information about video and audio elements.

#### What We Can Extract:
- ✅ Media element sources (`src`, `srcset`)
- ✅ Current playback state
- ✅ Current time and duration
- ✅ Volume and mute state
- ✅ Playback rate
- ✅ Network state
- ✅ Ready state
- ✅ Buffered ranges
- ✅ Text tracks (subtitles/captions)
- ✅ Video dimensions
- ✅ Audio/video codec information
- ✅ Media fragments (#t=start,end)

#### APIs:
```javascript
// Extract media element information
function extractMediaInfo(media) {
  return {
    tagName: media.tagName.toLowerCase(),
    src: media.src,
    currentSrc: media.currentSrc,
    duration: media.duration,
    currentTime: media.currentTime,
    paused: media.paused,
    ended: media.ended,
    volume: media.volume,
    muted: media.muted,
    playbackRate: media.playbackRate,
    networkState: media.networkState,
    readyState: media.readyState,
    buffered: Array.from({ length: media.buffered.length }, (_, i) => ({
      start: media.buffered.start(i),
      end: media.buffered.end(i)
    })),
    textTracks: Array.from(media.textTracks).map(track => ({
      kind: track.kind,
      label: track.label,
      language: track.language,
      mode: track.mode
    })),
    // Video-specific
    ...(media.tagName === 'VIDEO' ? {
      videoWidth: media.videoWidth,
      videoHeight: media.videoHeight,
      poster: media.poster
    } : {})
  };
}

// Extract all media elements
function extractAllMedia() {
  const media = {
    video: Array.from(document.querySelectorAll('video')).map(extractMediaInfo),
    audio: Array.from(document.querySelectorAll('audio')).map(extractMediaInfo)
  };
  return media;
}
```

**Implementation Status:**
- ❌ Not implemented: Media element extraction
- ❌ Not implemented: Media event monitoring

### 2.6 Web Components & Custom Elements

**Capability:** Analyze Web Components and custom elements.

#### What We Can Extract:
- ✅ Custom element registry (`customElements`)
- ✅ Custom element definitions
- ✅ Shadow DOM content
- ✅ Slot assignments
- ✅ Custom element lifecycle state
- ✅ Observed attributes
- ✅ Element callbacks

#### APIs:
```javascript
// Extract custom elements information
function extractCustomElements() {
  const customElements = [];

  // Get all custom elements on page
  document.querySelectorAll('*').forEach(el => {
    if (el.tagName.includes('-')) {
      customElements.push({
        tagName: el.tagName.toLowerCase(),
        shadowDOM: el.shadowRoot ? {
          mode: 'open',
          innerHTML: el.shadowRoot.innerHTML
        } : null,
        attributes: Array.from(el.attributes).map(attr => ({
          name: attr.name,
          value: attr.value
        })),
        properties: Object.getOwnPropertyNames(Object.getPrototypeOf(el))
      });
    }
  });

  return customElements;
}

// Monitor custom element registration
const originalDefine = customElements.define;
const registeredElements = [];

customElements.define = function(name, constructor, options) {
  registeredElements.push({
    name,
    constructor: constructor.name,
    options,
    timestamp: Date.now()
  });
  return originalDefine.call(this, name, constructor, options);
};
```

**Implementation Status:**
- ❌ Not implemented: Custom element registry inspection
- ✅ Implemented: Basic Web Component detection

---

## 3. Network Monitoring

### 3.1 chrome.webRequest API (Read-Only in MV3)

**Capability:** Monitor all network requests with detailed information.

#### Available Events:
- ✅ `onBeforeRequest` - Request initiated (URL, method, type, timing)
- ✅ `onBeforeSendHeaders` - Headers about to be sent
- ✅ `onSendHeaders` - Headers sent
- ✅ `onHeadersReceived` - Response headers received
- ✅ `onAuthRequired` - Authentication challenge
- ✅ `onBeforeRedirect` - Redirect detected
- ✅ `onResponseStarted` - Response started downloading
- ✅ `onCompleted` - Request completed successfully
- ✅ `onErrorOccurred` - Request failed

#### What We Can Capture:
- ✅ Full URL with query parameters
- ✅ HTTP method (GET, POST, PUT, DELETE, etc.)
- ✅ Request headers
- ✅ Response headers
- ✅ Status code and status text
- ✅ Response body size (not content in MV3)
- ✅ Request timing (start, end, duration)
- ✅ Redirect chain
- ✅ Tab ID and frame ID
- ✅ Request initiator
- ✅ Resource type (main_frame, sub_frame, stylesheet, script, image, font, object, xmlhttprequest, ping, csp_report, media, websocket, other)
- ✅ Request ID for correlation
- ⚠️ Request body (form data only, not raw bytes)
- ❌ Response body (removed in MV3)

#### APIs:
```javascript
// Comprehensive network monitoring
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    console.log('Request initiated:', {
      requestId: details.requestId,
      url: details.url,
      method: details.method,
      type: details.type,
      tabId: details.tabId,
      frameId: details.frameId,
      parentFrameId: details.parentFrameId,
      initiator: details.initiator,
      timeStamp: details.timeStamp,
      requestBody: details.requestBody // formData or raw (limited)
    });
  },
  { urls: ['<all_urls>'] },
  ['requestBody']
);

chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    console.log('Request headers:', {
      requestId: details.requestId,
      requestHeaders: details.requestHeaders
    });
  },
  { urls: ['<all_urls>'] },
  ['requestHeaders']
);

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    console.log('Response headers:', {
      requestId: details.requestId,
      statusCode: details.statusCode,
      statusLine: details.statusLine,
      responseHeaders: details.responseHeaders
    });
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    console.log('Request completed:', {
      requestId: details.requestId,
      statusCode: details.statusCode,
      timeStamp: details.timeStamp
    });
  },
  { urls: ['<all_urls>'] }
);
```

**Implementation Status:**
- ✅ Implemented: `NetworkMonitor` class with all events
- ✅ Implemented: HAR export format
- ✅ Implemented: Request/response correlation
- ✅ Implemented: Timing analysis

### 3.2 chrome.declarativeNetRequest

**Capability:** Block, redirect, or modify requests declaratively.

#### What We Can Do:
- ✅ Block requests by URL pattern
- ✅ Redirect requests
- ✅ Modify request headers
- ✅ Modify response headers
- ✅ Upgrade HTTP to HTTPS
- ✅ Remove headers
- ⚠️ Limited to 30,000 rules (static + dynamic)

#### APIs:
```javascript
// Add dynamic rules
chrome.declarativeNetRequest.updateDynamicRules({
  addRules: [{
    id: 1,
    priority: 1,
    action: { type: 'block' },
    condition: {
      urlFilter: 'tracker.example.com',
      resourceTypes: ['script', 'xmlhttprequest']
    }
  }],
  removeRuleIds: []
});

// Modify headers
chrome.declarativeNetRequest.updateDynamicRules({
  addRules: [{
    id: 2,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [
        { header: 'User-Agent', operation: 'set', value: 'CustomBot/1.0' }
      ]
    },
    condition: {
      urlFilter: '*',
      resourceTypes: ['main_frame']
    }
  }]
});
```

**Implementation Status:**
- ✅ Implemented: `RequestInterceptor` class
- ✅ Implemented: Dynamic rule management
- ❌ Not implemented: Header modification strategies

### 3.3 WebSocket Monitoring

**Capability:** Monitor WebSocket connections (limited).

#### What We Can Capture:
- ✅ WebSocket URL (via webRequest)
- ✅ Connection establishment
- ✅ Connection timing
- ✅ Headers during handshake
- ❌ Message content (not accessible in MV3)
- ❌ Message timing
- ⚠️ Can inject monitoring via content script

#### Content Script Injection:
```javascript
// Inject WebSocket monitoring
(function() {
  const originalWebSocket = window.WebSocket;

  window.WebSocket = function(url, protocols) {
    console.log('WebSocket created:', url);
    const ws = new originalWebSocket(url, protocols);

    // Monitor messages
    const originalSend = ws.send;
    ws.send = function(data) {
      console.log('WebSocket send:', data);
      return originalSend.apply(this, arguments);
    };

    ws.addEventListener('message', (event) => {
      console.log('WebSocket message:', event.data);
    });

    return ws;
  };
})();
```

**Implementation Status:**
- ✅ Implemented: WebSocket connection detection in `NetworkMonitor`
- ❌ Not implemented: Message content monitoring
- ❌ Not implemented: WebSocket state tracking

### 3.4 Fetch & XHR Tracking

**Capability:** Track fetch() and XMLHttpRequest calls.

#### What We Can Monitor:
- ✅ All fetch() calls (via content script override)
- ✅ All XMLHttpRequest calls (via content script override)
- ✅ Request URL, method, headers, body
- ✅ Response status, headers
- ⚠️ Response body (via content script clone)
- ✅ Timing information

#### Content Script Injection:
```javascript
// Fetch API monitoring
(function() {
  const originalFetch = window.fetch;

  window.fetch = function(...args) {
    const [url, options = {}] = args;
    console.log('fetch() called:', { url, options });

    return originalFetch.apply(this, args).then(response => {
      // Clone response to read body
      const clonedResponse = response.clone();

      clonedResponse.text().then(body => {
        console.log('fetch() response:', {
          url,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body
        });
      });

      return response;
    });
  };
})();

// XMLHttpRequest monitoring
(function() {
  const originalXHR = window.XMLHttpRequest;

  window.XMLHttpRequest = function() {
    const xhr = new originalXHR();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;

    let requestData = {};

    xhr.open = function(method, url, ...args) {
      requestData = { method, url };
      return originalOpen.apply(this, [method, url, ...args]);
    };

    xhr.send = function(body) {
      requestData.body = body;
      console.log('XHR request:', requestData);
      return originalSend.apply(this, arguments);
    };

    xhr.addEventListener('load', function() {
      console.log('XHR response:', {
        ...requestData,
        status: xhr.status,
        response: xhr.response
      });
    });

    return xhr;
  };
})();
```

**Implementation Status:**
- ❌ Not implemented: Fetch/XHR override injection
- ❌ Not implemented: Request/response body capture

### 3.5 HAR Export

**Capability:** Export network traffic in HTTP Archive (HAR) format.

#### What We Can Export:
- ✅ Complete request/response chain
- ✅ Timing information
- ✅ Headers
- ✅ Cookies
- ✅ Query parameters
- ✅ POST data
- ⚠️ Response content (limited in MV3)

#### APIs:
```javascript
// Generate HAR 1.2 format
function generateHAR(requests) {
  return {
    log: {
      version: '1.2',
      creator: {
        name: 'Basset Hound Extension',
        version: '1.0.0'
      },
      pages: [],
      entries: requests.map(req => ({
        startedDateTime: new Date(req.startTime).toISOString(),
        time: req.duration || 0,
        request: {
          method: req.method,
          url: req.url,
          httpVersion: 'HTTP/1.1',
          headers: formatHeaders(req.requestHeaders),
          queryString: parseQueryString(req.url),
          cookies: parseCookies(req.requestHeaders?.Cookie),
          headersSize: -1,
          bodySize: req.requestBodySize || -1,
          postData: req.requestBody ? {
            mimeType: req.requestHeaders?.['Content-Type'] || 'application/octet-stream',
            text: req.requestBody
          } : undefined
        },
        response: {
          status: req.statusCode || 0,
          statusText: req.statusLine || '',
          httpVersion: 'HTTP/1.1',
          headers: formatHeaders(req.responseHeaders),
          cookies: parseCookies(req.responseHeaders?.['Set-Cookie']),
          content: {
            size: req.responseSize || -1,
            compression: 0,
            mimeType: req.responseHeaders?.['Content-Type'] || 'application/octet-stream',
            text: req.responseBody || ''
          },
          redirectURL: req.redirectURL || '',
          headersSize: -1,
          bodySize: req.responseSize || -1
        },
        cache: {},
        timings: {
          blocked: 0,
          dns: -1,
          connect: -1,
          send: 0,
          wait: req.timing?.timeToFirstByte || 0,
          receive: req.timing?.downloadTime || 0,
          ssl: -1
        },
        serverIPAddress: '',
        connection: ''
      }))
    }
  };
}
```

**Implementation Status:**
- ✅ Implemented: HAR export in `NetworkExporter`
- ✅ Implemented: Full HAR 1.2 format compliance
- ⚠️ Partial: Response body capture (limited by MV3)

### 3.6 Resource Timing API

**Capability:** Detailed timing for all resources via Performance API.

#### What We Can Extract:
- ✅ DNS lookup time
- ✅ TCP connection time
- ✅ TLS negotiation time
- ✅ Time to first byte (TTFB)
- ✅ Download time
- ✅ Total request time
- ✅ Redirect time
- ✅ Transfer size
- ✅ Encoded body size
- ✅ Decoded body size

#### APIs:
```javascript
// Extract resource timing
function extractResourceTiming() {
  const resources = performance.getEntriesByType('resource');

  return resources.map(resource => ({
    name: resource.name,
    type: resource.initiatorType,
    duration: resource.duration,
    timing: {
      redirectStart: resource.redirectStart,
      redirectEnd: resource.redirectEnd,
      fetchStart: resource.fetchStart,
      domainLookupStart: resource.domainLookupStart,
      domainLookupEnd: resource.domainLookupEnd,
      connectStart: resource.connectStart,
      connectEnd: resource.connectEnd,
      secureConnectionStart: resource.secureConnectionStart,
      requestStart: resource.requestStart,
      responseStart: resource.responseStart,
      responseEnd: resource.responseEnd
    },
    size: {
      transferSize: resource.transferSize,
      encodedBodySize: resource.encodedBodySize,
      decodedBodySize: resource.decodedBodySize
    },
    protocol: resource.nextHopProtocol,
    // Derived metrics
    derived: {
      dnsTime: resource.domainLookupEnd - resource.domainLookupStart,
      tcpTime: resource.connectEnd - resource.connectStart,
      tlsTime: resource.secureConnectionStart > 0
        ? resource.connectEnd - resource.secureConnectionStart
        : 0,
      ttfb: resource.responseStart - resource.requestStart,
      downloadTime: resource.responseEnd - resource.responseStart,
      totalTime: resource.responseEnd - resource.fetchStart
    }
  }));
}
```

**Implementation Status:**
- ❌ Not implemented: Resource timing extraction
- ❌ Not implemented: Performance metrics aggregation

---

## 4. Storage Forensics

### 4.1 Cookies (Full Access)

**Capability:** Complete cookie access across all domains.

#### What We Can Access:
- ✅ All cookies for any domain (with host permissions)
- ✅ HttpOnly cookies
- ✅ Secure cookies
- ✅ SameSite attribute
- ✅ Cookie expiration
- ✅ Cookie path and domain
- ✅ Cookie creation time
- ✅ Session cookies vs persistent cookies

#### APIs:
```javascript
// Get all cookies for a URL
chrome.cookies.getAll({ url: 'https://example.com' }, (cookies) => {
  cookies.forEach(cookie => {
    console.log({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      session: cookie.session,
      expirationDate: cookie.expirationDate,
      storeId: cookie.storeId
    });
  });
});

// Get all cookies across all domains
chrome.cookies.getAll({}, (cookies) => {
  console.log(`Total cookies: ${cookies.length}`);

  // Group by domain
  const byDomain = {};
  cookies.forEach(cookie => {
    if (!byDomain[cookie.domain]) byDomain[cookie.domain] = [];
    byDomain[cookie.domain].push(cookie);
  });
});

// Monitor cookie changes
chrome.cookies.onChanged.addListener((changeInfo) => {
  console.log('Cookie changed:', {
    removed: changeInfo.removed,
    cookie: changeInfo.cookie,
    cause: changeInfo.cause
  });
});

// Set/modify cookies
chrome.cookies.set({
  url: 'https://example.com',
  name: 'session',
  value: 'abc123',
  secure: true,
  httpOnly: true,
  sameSite: 'lax'
});
```

**Implementation Status:**
- ✅ Implemented: Cookie access in background script
- ❌ Not implemented: Comprehensive cookie forensics
- ❌ Not implemented: Cookie tracking and lineage

### 4.2 localStorage (Per-Origin Access)

**Capability:** Full localStorage access for sites with host permissions.

#### What We Can Access:
- ✅ All localStorage keys and values (as content script)
- ✅ localStorage size
- ✅ Cross-origin localStorage (with host permissions)
- ✅ Real-time monitoring of changes

#### APIs:
```javascript
// Content script: Extract all localStorage
function extractLocalStorage() {
  const storage = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    storage[key] = localStorage.getItem(key);
  }
  return {
    origin: window.location.origin,
    itemCount: localStorage.length,
    data: storage,
    sizeEstimate: JSON.stringify(storage).length
  };
}

// Monitor localStorage changes
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
  console.log('localStorage.setItem:', { key, value });
  chrome.runtime.sendMessage({
    type: 'localStorage_change',
    action: 'set',
    key, value
  });
  return originalSetItem.apply(this, arguments);
};

const originalRemoveItem = localStorage.removeItem;
localStorage.removeItem = function(key) {
  console.log('localStorage.removeItem:', { key });
  chrome.runtime.sendMessage({
    type: 'localStorage_change',
    action: 'remove',
    key
  });
  return originalRemoveItem.apply(this, arguments);
};

// Listen for storage events (cross-tab changes)
window.addEventListener('storage', (event) => {
  console.log('Storage event:', {
    key: event.key,
    oldValue: event.oldValue,
    newValue: event.newValue,
    url: event.url
  });
});
```

**Implementation Status:**
- ✅ Implemented: Basic localStorage access in content script
- ❌ Not implemented: localStorage monitoring
- ❌ Not implemented: Cross-domain localStorage mapping

### 4.3 sessionStorage (Per-Origin Access)

**Capability:** Full sessionStorage access similar to localStorage.

#### What We Can Access:
- ✅ All sessionStorage keys and values
- ✅ Per-tab session data
- ✅ Real-time monitoring

#### APIs:
```javascript
// Extract sessionStorage (identical to localStorage)
function extractSessionStorage() {
  const storage = {};
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    storage[key] = sessionStorage.getItem(key);
  }
  return {
    origin: window.location.origin,
    itemCount: sessionStorage.length,
    data: storage
  };
}
```

**Implementation Status:**
- ✅ Implemented: Basic sessionStorage access
- ❌ Not implemented: Session tracking across tabs

### 4.4 IndexedDB (Full Access)

**Capability:** Complete IndexedDB access and enumeration.

#### What We Can Access:
- ✅ All databases
- ✅ All object stores
- ✅ All indices
- ✅ All data records
- ✅ Database structure
- ✅ Transaction history (via monitoring)

#### APIs:
```javascript
// Enumerate all IndexedDB databases
async function enumerateIndexedDB() {
  const databases = await indexedDB.databases();
  const dbData = [];

  for (const dbInfo of databases) {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbInfo.name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const objectStores = [];

    for (const storeName of db.objectStoreNames) {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);

      // Get all data
      const data = await new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
      });

      // Get store metadata
      objectStores.push({
        name: storeName,
        keyPath: store.keyPath,
        autoIncrement: store.autoIncrement,
        indexNames: Array.from(store.indexNames),
        recordCount: data.length,
        data: data
      });
    }

    dbData.push({
      name: db.name,
      version: db.version,
      objectStores: objectStores
    });

    db.close();
  }

  return dbData;
}

// Monitor IndexedDB operations
const originalOpen = indexedDB.open;
indexedDB.open = function(name, version) {
  console.log('IndexedDB.open:', { name, version });
  const request = originalOpen.apply(this, arguments);

  request.onsuccess = function() {
    console.log('IndexedDB opened:', name);
  };

  return request;
};
```

**Implementation Status:**
- ❌ Not implemented: IndexedDB enumeration
- ❌ Not implemented: IndexedDB monitoring
- ❌ Not implemented: IndexedDB data export

### 4.5 Cache API

**Capability:** Access Cache API storage used by Service Workers.

#### What We Can Access:
- ✅ All cache names
- ✅ All cached requests/responses
- ✅ Cache metadata
- ✅ Response headers and status

#### APIs:
```javascript
// Enumerate all caches
async function enumerateCacheStorage() {
  const cacheNames = await caches.keys();
  const cacheData = [];

  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();

    const entries = [];
    for (const request of requests) {
      const response = await cache.match(request);
      entries.push({
        url: request.url,
        method: request.method,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        type: response.type,
        redirected: response.redirected
      });
    }

    cacheData.push({
      name: cacheName,
      entryCount: entries.length,
      entries: entries
    });
  }

  return cacheData;
}
```

**Implementation Status:**
- ❌ Not implemented: Cache API enumeration
- ❌ Not implemented: Cache forensics

### 4.6 Service Worker Registration

**Capability:** Detect and analyze Service Worker registrations.

#### What We Can Access:
- ✅ All registered Service Workers
- ✅ Service Worker scope
- ✅ Service Worker state
- ✅ Service Worker update status
- ✅ Service Worker script URL

#### APIs:
```javascript
// Enumerate Service Worker registrations
async function enumerateServiceWorkers() {
  const registrations = await navigator.serviceWorker.getRegistrations();

  return registrations.map(reg => ({
    scope: reg.scope,
    updateViaCache: reg.updateViaCache,
    active: reg.active ? {
      scriptURL: reg.active.scriptURL,
      state: reg.active.state
    } : null,
    installing: reg.installing ? {
      scriptURL: reg.installing.scriptURL,
      state: reg.installing.state
    } : null,
    waiting: reg.waiting ? {
      scriptURL: reg.waiting.scriptURL,
      state: reg.waiting.state
    } : null
  }));
}
```

**Implementation Status:**
- ❌ Not implemented: Service Worker detection
- ❌ Not implemented: Service Worker analysis

### 4.7 chrome.storage API

**Capability:** Extension's own persistent storage.

#### What We Can Store:
- ✅ Up to 5MB in `chrome.storage.local` (unlimited with permission)
- ✅ Synced data in `chrome.storage.sync` (up to 100KB)
- ✅ Session data in `chrome.storage.session`
- ✅ Structured data (JSON serializable)

#### APIs:
```javascript
// Store extension data
chrome.storage.local.set({ key: 'value' });

// Get extension data
chrome.storage.local.get(['key'], (result) => {
  console.log(result.key);
});

// Get all stored data
chrome.storage.local.get(null, (items) => {
  console.log('All stored data:', items);
});

// Monitor storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  console.log('Storage changed:', changes, areaName);
});
```

**Implementation Status:**
- ✅ Implemented: Used throughout extension for state management

---

## 5. Performance & Timing

### 5.1 Navigation Timing API

**Capability:** Detailed timing for page navigation.

#### What We Can Measure:
- ✅ DNS lookup time
- ✅ TCP connection time
- ✅ TLS negotiation time
- ✅ Server response time
- ✅ DOM processing time
- ✅ Page load time
- ✅ Redirect time
- ✅ Cache hit/miss

#### APIs:
```javascript
// Extract navigation timing
function extractNavigationTiming() {
  const nav = performance.getEntriesByType('navigation')[0];

  return {
    // URL and type
    name: nav.name,
    type: nav.type,

    // Redirect timing
    redirectStart: nav.redirectStart,
    redirectEnd: nav.redirectEnd,
    redirectTime: nav.redirectEnd - nav.redirectStart,
    redirectCount: nav.redirectCount,

    // DNS timing
    domainLookupStart: nav.domainLookupStart,
    domainLookupEnd: nav.domainLookupEnd,
    dnsTime: nav.domainLookupEnd - nav.domainLookupStart,

    // Connection timing
    connectStart: nav.connectStart,
    connectEnd: nav.connectEnd,
    secureConnectionStart: nav.secureConnectionStart,
    connectionTime: nav.connectEnd - nav.connectStart,
    tlsTime: nav.secureConnectionStart > 0
      ? nav.connectEnd - nav.secureConnectionStart
      : 0,

    // Request/Response timing
    requestStart: nav.requestStart,
    responseStart: nav.responseStart,
    responseEnd: nav.responseEnd,
    ttfb: nav.responseStart - nav.requestStart,
    downloadTime: nav.responseEnd - nav.responseStart,

    // DOM timing
    domInteractive: nav.domInteractive,
    domContentLoadedEventStart: nav.domContentLoadedEventStart,
    domContentLoadedEventEnd: nav.domContentLoadedEventEnd,
    domComplete: nav.domComplete,
    domContentLoadedTime: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,

    // Load timing
    loadEventStart: nav.loadEventStart,
    loadEventEnd: nav.loadEventEnd,
    loadEventTime: nav.loadEventEnd - nav.loadEventStart,

    // Transfer size
    transferSize: nav.transferSize,
    encodedBodySize: nav.encodedBodySize,
    decodedBodySize: nav.decodedBodySize,

    // Protocol
    nextHopProtocol: nav.nextHopProtocol,

    // Derived metrics
    derived: {
      totalPageLoadTime: nav.loadEventEnd - nav.fetchStart,
      timeToInteractive: nav.domInteractive - nav.fetchStart,
      timeToContentLoaded: nav.domContentLoadedEventEnd - nav.fetchStart
    }
  };
}
```

**Implementation Status:**
- ❌ Not implemented: Navigation timing capture
- ❌ Not implemented: Performance metrics collection

### 5.2 Resource Timing API

**Capability:** Per-resource performance metrics (covered in Network Monitoring).

**Implementation Status:**
- ⚠️ Partial: Available but not fully implemented

### 5.3 User Timing API

**Capability:** Custom performance marks and measures.

#### What We Can Capture:
- ✅ Custom performance marks
- ✅ Performance measures between marks
- ✅ High-resolution timestamps

#### APIs:
```javascript
// Extract user timing
function extractUserTiming() {
  return {
    marks: performance.getEntriesByType('mark').map(mark => ({
      name: mark.name,
      startTime: mark.startTime,
      duration: mark.duration
    })),
    measures: performance.getEntriesByType('measure').map(measure => ({
      name: measure.name,
      startTime: measure.startTime,
      duration: measure.duration
    }))
  };
}
```

**Implementation Status:**
- ❌ Not implemented: User timing extraction

### 5.4 Long Tasks API

**Capability:** Detect long-running JavaScript tasks that block the main thread.

#### What We Can Detect:
- ✅ Tasks longer than 50ms
- ✅ Task start time and duration
- ✅ Attribution (which script caused the long task)

#### APIs:
```javascript
// Monitor long tasks
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log('Long task detected:', {
      name: entry.name,
      startTime: entry.startTime,
      duration: entry.duration,
      attribution: entry.attribution
    });
  }
});

observer.observe({ entryTypes: ['longtask'] });
```

**Implementation Status:**
- ❌ Not implemented: Long task monitoring

### 5.5 Layout Shift (CLS)

**Capability:** Measure visual stability using Cumulative Layout Shift.

#### What We Can Measure:
- ✅ Layout shift score
- ✅ Elements that shifted
- ✅ Shift timing

#### APIs:
```javascript
// Monitor layout shifts
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log('Layout shift:', {
      value: entry.value,
      hadRecentInput: entry.hadRecentInput,
      lastInputTime: entry.lastInputTime,
      sources: entry.sources
    });
  }
});

observer.observe({ type: 'layout-shift', buffered: true });
```

**Implementation Status:**
- ❌ Not implemented: CLS monitoring

### 5.6 Paint Timing

**Capability:** Measure First Paint (FP) and First Contentful Paint (FCP).

#### APIs:
```javascript
// Extract paint timing
function extractPaintTiming() {
  const paintEntries = performance.getEntriesByType('paint');
  return paintEntries.map(entry => ({
    name: entry.name, // 'first-paint' or 'first-contentful-paint'
    startTime: entry.startTime
  }));
}
```

**Implementation Status:**
- ❌ Not implemented: Paint timing extraction

### 5.7 Memory Usage

**Capability:** Estimate memory usage (very limited).

#### What We Can Access:
- ⚠️ `performance.memory` (non-standard, Chrome only)
- ⚠️ Heap size limit
- ⚠️ Used heap size
- ❌ No detailed memory breakdown

#### APIs:
```javascript
// Get memory info (Chrome-specific, non-standard)
if (performance.memory) {
  console.log({
    usedJSHeapSize: performance.memory.usedJSHeapSize,
    totalJSHeapSize: performance.memory.totalJSHeapSize,
    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
  });
}
```

**Implementation Status:**
- ❌ Not implemented: Memory monitoring

---

## 6. Security Headers & Policies

### 6.1 Content-Security-Policy (CSP)

**Capability:** Extract and analyze CSP headers.

#### What We Can Extract:
- ✅ CSP directives via response headers
- ✅ CSP violations via console
- ✅ Meta tag CSP
- ✅ Report-only policies

#### APIs:
```javascript
// Extract CSP from response headers
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    const cspHeaders = details.responseHeaders.filter(
      h => h.name.toLowerCase() === 'content-security-policy' ||
           h.name.toLowerCase() === 'content-security-policy-report-only'
    );

    cspHeaders.forEach(header => {
      console.log('CSP:', {
        url: details.url,
        type: header.name,
        policy: header.value
      });
    });
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// Monitor CSP violations (content script)
document.addEventListener('securitypolicyviolation', (event) => {
  console.log('CSP violation:', {
    blockedURI: event.blockedURI,
    violatedDirective: event.violatedDirective,
    effectiveDirective: event.effectiveDirective,
    originalPolicy: event.originalPolicy,
    documentURI: event.documentURI,
    sourceFile: event.sourceFile,
    lineNumber: event.lineNumber,
    columnNumber: event.columnNumber
  });
});

// Extract CSP from meta tags
function extractMetaCSP() {
  const metaTags = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
  return Array.from(metaTags).map(tag => tag.content);
}
```

**Implementation Status:**
- ❌ Not implemented: CSP extraction and analysis
- ❌ Not implemented: CSP violation monitoring

### 6.2 All Security Headers

**Capability:** Extract all security-related HTTP headers.

#### Headers We Can Capture:
- ✅ `Strict-Transport-Security` (HSTS)
- ✅ `X-Frame-Options`
- ✅ `X-Content-Type-Options`
- ✅ `X-XSS-Protection`
- ✅ `Referrer-Policy`
- ✅ `Permissions-Policy` (formerly Feature-Policy)
- ✅ `Cross-Origin-Embedder-Policy` (COEP)
- ✅ `Cross-Origin-Opener-Policy` (COOP)
- ✅ `Cross-Origin-Resource-Policy` (CORP)
- ✅ `Content-Security-Policy`
- ✅ `Access-Control-Allow-Origin` (CORS)
- ✅ All other custom headers

#### APIs:
```javascript
// Extract all security headers
function extractSecurityHeaders(responseHeaders) {
  const securityHeaders = {};
  const securityHeaderNames = [
    'strict-transport-security',
    'x-frame-options',
    'x-content-type-options',
    'x-xss-protection',
    'referrer-policy',
    'permissions-policy',
    'feature-policy',
    'cross-origin-embedder-policy',
    'cross-origin-opener-policy',
    'cross-origin-resource-policy',
    'content-security-policy',
    'content-security-policy-report-only',
    'access-control-allow-origin',
    'access-control-allow-credentials',
    'access-control-allow-methods',
    'access-control-allow-headers',
    'access-control-expose-headers',
    'access-control-max-age'
  ];

  responseHeaders.forEach(header => {
    const name = header.name.toLowerCase();
    if (securityHeaderNames.includes(name)) {
      securityHeaders[name] = header.value;
    }
  });

  return securityHeaders;
}

// Analyze security posture
function analyzeSecurityPosture(securityHeaders) {
  return {
    hasHSTS: !!securityHeaders['strict-transport-security'],
    hasCSP: !!securityHeaders['content-security-policy'],
    hasXFrameOptions: !!securityHeaders['x-frame-options'],
    hasNoSniff: !!securityHeaders['x-content-type-options'],
    hasCORS: !!securityHeaders['access-control-allow-origin'],
    hasCOEP: !!securityHeaders['cross-origin-embedder-policy'],
    hasCOOP: !!securityHeaders['cross-origin-opener-policy'],
    securityScore: calculateSecurityScore(securityHeaders)
  };
}
```

**Implementation Status:**
- ✅ Implemented: Header extraction in `NetworkMonitor`
- ❌ Not implemented: Security header analysis
- ❌ Not implemented: Security posture scoring

### 6.3 CORS Headers

**Capability:** Analyze Cross-Origin Resource Sharing configuration.

#### What We Can Analyze:
- ✅ CORS allow origin
- ✅ CORS allow credentials
- ✅ CORS allow methods
- ✅ CORS allow headers
- ✅ CORS preflight requests
- ✅ CORS errors

#### APIs:
```javascript
// Extract CORS configuration
function extractCORSConfig(responseHeaders) {
  return {
    allowOrigin: responseHeaders['access-control-allow-origin'],
    allowCredentials: responseHeaders['access-control-allow-credentials'] === 'true',
    allowMethods: responseHeaders['access-control-allow-methods']?.split(',').map(m => m.trim()),
    allowHeaders: responseHeaders['access-control-allow-headers']?.split(',').map(h => h.trim()),
    exposeHeaders: responseHeaders['access-control-expose-headers']?.split(',').map(h => h.trim()),
    maxAge: parseInt(responseHeaders['access-control-max-age']) || 0
  };
}
```

**Implementation Status:**
- ❌ Not implemented: CORS analysis

### 6.4 Certificate Information

**Capability:** Limited certificate information via chrome.webRequest.

#### What We Can Access:
- ⚠️ Protocol version (TLS 1.2, TLS 1.3)
- ❌ Certificate details (not accessible)
- ❌ Certificate chain (not accessible)
- ❌ Certificate expiration (not accessible)
- ⚠️ Can detect HTTPS vs HTTP

**Implementation Status:**
- ⚠️ Limited: Only protocol detection available

---

## 7. Browser State

### 7.1 Tab Information

**Capability:** Full access to tab metadata and control.

#### What We Can Access:
- ✅ Tab ID
- ✅ Window ID
- ✅ Tab index
- ✅ URL (with host permissions)
- ✅ Title
- ✅ Favicon URL
- ✅ Status (loading, complete)
- ✅ Active state
- ✅ Pinned state
- ✅ Audible state
- ✅ Muted state
- ✅ Width and height
- ✅ Zoom level
- ✅ Group ID
- ✅ Opener tab ID

#### APIs:
```javascript
// Get all tabs
chrome.tabs.query({}, (tabs) => {
  tabs.forEach(tab => {
    console.log({
      id: tab.id,
      windowId: tab.windowId,
      index: tab.index,
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl,
      status: tab.status,
      active: tab.active,
      pinned: tab.pinned,
      audible: tab.audible,
      mutedInfo: tab.mutedInfo,
      width: tab.width,
      height: tab.height,
      groupId: tab.groupId,
      openerTabId: tab.openerTabId
    });
  });
});

// Monitor tab events
chrome.tabs.onCreated.addListener((tab) => {
  console.log('Tab created:', tab);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  console.log('Tab updated:', tabId, changeInfo);
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log('Tab activated:', activeInfo);
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  console.log('Tab removed:', tabId, removeInfo);
});
```

**Implementation Status:**
- ✅ Implemented: Tab management throughout extension
- ✅ Implemented: Tab state tracking

### 7.2 Window Information

**Capability:** Full access to window metadata and control.

#### What We Can Access:
- ✅ Window ID
- ✅ Window type (normal, popup, panel, app, devtools)
- ✅ Window state (normal, minimized, maximized, fullscreen)
- ✅ Focused state
- ✅ Always on top
- ✅ Incognito mode
- ✅ Dimensions (width, height, top, left)
- ✅ Tabs in window

#### APIs:
```javascript
// Get all windows
chrome.windows.getAll({ populate: true }, (windows) => {
  windows.forEach(window => {
    console.log({
      id: window.id,
      type: window.type,
      state: window.state,
      focused: window.focused,
      alwaysOnTop: window.alwaysOnTop,
      incognito: window.incognito,
      width: window.width,
      height: window.height,
      top: window.top,
      left: window.left,
      tabs: window.tabs
    });
  });
});
```

**Implementation Status:**
- ✅ Implemented: Window management in extension

### 7.3 History

**Capability:** Very limited history access.

#### What We Can Access:
- ⚠️ `history.length` (number of entries in current tab's session)
- ❌ Cannot access URLs from history
- ❌ Cannot enumerate history
- ⚠️ chrome.history API (with permission) - can search but limited

#### APIs:
```javascript
// Very limited
console.log('History length:', history.length);

// With chrome.history permission
chrome.history.search({ text: '', maxResults: 100 }, (results) => {
  results.forEach(item => {
    console.log({
      url: item.url,
      title: item.title,
      lastVisitTime: item.lastVisitTime,
      visitCount: item.visitCount,
      typedCount: item.typedCount
    });
  });
});
```

**Implementation Status:**
- ❌ Not implemented: History access (not required for OSINT)

### 7.4 Extensions Installed

**Capability:** Very limited extension enumeration.

#### What We Can Access:
- ⚠️ Own extension info
- ❌ Other extensions (privacy restricted)
- ⚠️ chrome.management API (with permission) - can list but limited

**Implementation Status:**
- ❌ Not implemented: Not relevant for forensics

### 7.5 Browser Environment

**Capability:** Detect browser properties and capabilities.

#### What We Can Detect:
- ✅ User agent string
- ✅ Browser language
- ✅ Platform (OS)
- ✅ CPU architecture
- ✅ Device memory (limited)
- ✅ Hardware concurrency (CPU cores)
- ✅ Screen resolution
- ✅ Device pixel ratio
- ✅ Color depth
- ✅ Time zone
- ✅ Online/offline state
- ✅ Battery status (with permission)
- ✅ Network information (connection type)

#### APIs:
```javascript
// Extract browser environment
function extractBrowserEnvironment() {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: navigator.languages,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory,
    maxTouchPoints: navigator.maxTouchPoints,
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack,
    onLine: navigator.onLine,

    screen: {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      devicePixelRatio: window.devicePixelRatio
    },

    timezone: {
      offset: new Date().getTimezoneOffset(),
      name: Intl.DateTimeFormat().resolvedOptions().timeZone
    },

    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight
    }
  };
}
```

**Implementation Status:**
- ❌ Not implemented: Comprehensive environment profiling

---

## 8. User Interactions

### 8.1 Mouse Events (Trackable)

**Capability:** Monitor all mouse interactions on the page.

#### What We Can Track:
- ✅ Mouse movements (`mousemove`)
- ✅ Mouse clicks (`click`, `dblclick`, `contextmenu`)
- ✅ Mouse button state (`mousedown`, `mouseup`)
- ✅ Mouse enter/leave (`mouseenter`, `mouseleave`, `mouseover`, `mouseout`)
- ✅ Mouse position (X, Y coordinates)
- ✅ Scroll wheel (`wheel`)
- ✅ Drag and drop events

#### APIs:
```javascript
// Track mouse movements
document.addEventListener('mousemove', (event) => {
  console.log('Mouse move:', {
    x: event.clientX,
    y: event.clientY,
    pageX: event.pageX,
    pageY: event.pageY,
    target: event.target.tagName,
    timestamp: Date.now()
  });
});

// Track clicks
document.addEventListener('click', (event) => {
  console.log('Click:', {
    x: event.clientX,
    y: event.clientY,
    button: event.button, // 0=left, 1=middle, 2=right
    target: event.target,
    timestamp: Date.now()
  });
});

// Track scroll
window.addEventListener('scroll', (event) => {
  console.log('Scroll:', {
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    timestamp: Date.now()
  });
});
```

**Implementation Status:**
- ❌ Not implemented: Mouse tracking (privacy concerns)
- ⚠️ Could be implemented for forensics purposes

### 8.2 Keyboard Events (Limited)

**Capability:** Monitor keyboard events but NOT content.

#### What We Can Track:
- ✅ Key press events (`keydown`, `keyup`, `keypress`)
- ✅ Key codes
- ✅ Modifier keys (Ctrl, Alt, Shift, Meta)
- ❌ Cannot track key values in password fields (browser restriction)
- ⚠️ Can track key values in regular inputs (but ethically questionable)

#### APIs:
```javascript
// Track keyboard events (monitoring only, not keylogging)
document.addEventListener('keydown', (event) => {
  console.log('Key down:', {
    key: event.key,
    code: event.code,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    metaKey: event.metaKey,
    target: event.target.tagName,
    timestamp: Date.now()
  });
});
```

**Implementation Status:**
- ❌ Not implemented: Keyboard monitoring (ethical concerns)
- ✅ Implemented: Form interaction detection for automation

### 8.3 Focus Changes

**Capability:** Track element focus changes.

#### What We Can Track:
- ✅ Focus events (`focus`, `blur`)
- ✅ Focus target element
- ✅ Tab navigation
- ✅ Focus order

#### APIs:
```javascript
// Track focus changes
document.addEventListener('focus', (event) => {
  console.log('Focus:', {
    target: event.target,
    tagName: event.target.tagName,
    id: event.target.id,
    timestamp: Date.now()
  });
}, true); // Use capture phase

document.addEventListener('blur', (event) => {
  console.log('Blur:', {
    target: event.target,
    timestamp: Date.now()
  });
}, true);
```

**Implementation Status:**
- ❌ Not implemented: Focus tracking

### 8.4 Page Visibility

**Capability:** Track page visibility state.

#### What We Can Track:
- ✅ Visible/hidden state
- ✅ Visibility change events
- ✅ Document state

#### APIs:
```javascript
// Track page visibility
document.addEventListener('visibilitychange', () => {
  console.log('Visibility changed:', {
    hidden: document.hidden,
    visibilityState: document.visibilityState,
    timestamp: Date.now()
  });
});
```

**Implementation Status:**
- ❌ Not implemented: Visibility tracking

### 8.5 Page Lifecycle Events

**Capability:** Track page lifecycle states.

#### What We Can Track:
- ✅ Page load events (`DOMContentLoaded`, `load`)
- ✅ Before unload (`beforeunload`)
- ✅ Unload (`unload`)
- ✅ Page freeze/resume (`freeze`, `resume`)
- ✅ Page hide/show (`pagehide`, `pageshow`)

#### APIs:
```javascript
// Track page lifecycle
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded');
});

window.addEventListener('load', () => {
  console.log('Page Load Complete');
});

window.addEventListener('beforeunload', (event) => {
  console.log('Before Unload');
});

window.addEventListener('freeze', () => {
  console.log('Page Frozen');
});

window.addEventListener('resume', () => {
  console.log('Page Resumed');
});
```

**Implementation Status:**
- ✅ Implemented: Basic lifecycle monitoring

### 8.6 Clipboard Events

**Capability:** Limited clipboard access.

#### What We Can Do:
- ✅ Monitor copy/paste events
- ⚠️ Read clipboard (requires user permission)
- ✅ Write to clipboard
- ❌ Cannot read clipboard without user gesture

#### APIs:
```javascript
// Monitor clipboard events
document.addEventListener('copy', (event) => {
  console.log('Copy event:', {
    data: event.clipboardData.getData('text/plain'),
    timestamp: Date.now()
  });
});

document.addEventListener('paste', (event) => {
  console.log('Paste event:', {
    data: event.clipboardData.getData('text/plain'),
    timestamp: Date.now()
  });
});

// Read clipboard (requires user gesture)
async function readClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    console.log('Clipboard:', text);
  } catch (err) {
    console.error('Failed to read clipboard:', err);
  }
}
```

**Implementation Status:**
- ❌ Not implemented: Clipboard monitoring

---

## 9. Web APIs Usage Detection

### 9.1 API Detection

**Capability:** Detect which Web APIs a page is using.

#### APIs We Can Detect:
- ✅ Geolocation API
- ✅ Notifications API
- ✅ WebRTC API
- ✅ WebUSB API
- ✅ WebBluetooth API
- ✅ Web Share API
- ✅ Payment Request API
- ✅ Web Authentication API (WebAuthn)
- ✅ Media Devices API (Camera/Microphone)
- ✅ Screen Capture API
- ✅ Battery Status API
- ✅ Network Information API
- ✅ Vibration API
- ✅ Device Orientation API
- ✅ Ambient Light Sensor
- ✅ Web MIDI API
- ✅ Speech Recognition API
- ✅ Speech Synthesis API

#### Detection Method:
```javascript
// Detect API usage
function detectWebAPIs() {
  const apis = {
    geolocation: 'geolocation' in navigator,
    notifications: 'Notification' in window,
    webRTC: 'RTCPeerConnection' in window,
    webUSB: 'usb' in navigator,
    webBluetooth: 'bluetooth' in navigator,
    webShare: 'share' in navigator,
    paymentRequest: 'PaymentRequest' in window,
    webAuthn: 'credentials' in navigator && 'create' in navigator.credentials,
    mediaDevices: 'mediaDevices' in navigator,
    screenCapture: 'getDisplayMedia' in navigator.mediaDevices || false,
    battery: 'getBattery' in navigator,
    connection: 'connection' in navigator,
    vibration: 'vibrate' in navigator,
    deviceOrientation: 'DeviceOrientationEvent' in window,
    ambientLight: 'AmbientLightSensor' in window,
    webMIDI: 'requestMIDIAccess' in navigator,
    speechRecognition: 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,
    speechSynthesis: 'speechSynthesis' in window
  };

  return apis;
}

// Monitor API calls
const originalGeolocation = navigator.geolocation.getCurrentPosition;
navigator.geolocation.getCurrentPosition = function(...args) {
  console.log('Geolocation API called');
  return originalGeolocation.apply(this, args);
};
```

**Implementation Status:**
- ❌ Not implemented: API usage detection
- ❌ Not implemented: API call monitoring

### 9.2 Permission States

**Capability:** Query permission states for various APIs.

#### APIs:
```javascript
// Query permissions
async function checkPermissions() {
  const permissions = {};

  const permissionNames = [
    'geolocation',
    'notifications',
    'camera',
    'microphone',
    'midi',
    'persistent-storage'
  ];

  for (const name of permissionNames) {
    try {
      const result = await navigator.permissions.query({ name });
      permissions[name] = result.state; // 'granted', 'denied', 'prompt'
    } catch (e) {
      permissions[name] = 'unsupported';
    }
  }

  return permissions;
}
```

**Implementation Status:**
- ❌ Not implemented: Permission state querying

---

## 10. Advanced Forensics

### 10.1 Canvas Fingerprinting Detection

**Capability:** Detect and analyze canvas fingerprinting attempts.

#### What We Can Detect:
- ✅ Canvas elements being drawn to
- ✅ Canvas data extraction (`toDataURL`, `getImageData`)
- ✅ Text rendering on canvas (common fingerprinting technique)
- ✅ WebGL fingerprinting

#### Detection Method:
```javascript
// Detect canvas fingerprinting
const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
HTMLCanvasElement.prototype.toDataURL = function(...args) {
  console.log('Canvas toDataURL called (possible fingerprinting)', {
    width: this.width,
    height: this.height,
    timestamp: Date.now()
  });
  return originalToDataURL.apply(this, args);
};

const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
CanvasRenderingContext2D.prototype.getImageData = function(...args) {
  console.log('Canvas getImageData called (possible fingerprinting)');
  return originalGetImageData.apply(this, args);
};
```

**Implementation Status:**
- ❌ Not implemented: Canvas fingerprinting detection

### 10.2 WebGL Capabilities Fingerprinting

**Capability:** Extract complete WebGL capabilities for fingerprinting analysis.

#### What We Can Extract:
- ✅ GPU vendor and renderer
- ✅ WebGL version
- ✅ All supported extensions
- ✅ Maximum texture size
- ✅ Maximum render buffer size
- ✅ All WebGL parameters
- ✅ Shader compilation success

#### APIs:
```javascript
// Complete WebGL fingerprint
function getWebGLFingerprint() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

  if (!gl) return null;

  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

  return {
    vendor: gl.getParameter(gl.VENDOR),
    renderer: gl.getParameter(gl.RENDERER),
    unmaskedVendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : null,
    unmaskedRenderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null,
    version: gl.getParameter(gl.VERSION),
    shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
    extensions: gl.getSupportedExtensions(),
    parameters: {
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxCubeMapTextureSize: gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE),
      maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
      maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
      maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS),
      maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
      maxTextureImageUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
      maxVertexTextureImageUnits: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
      maxCombinedTextureImageUnits: gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS)
    }
  };
}
```

**Implementation Status:**
- ❌ Not implemented: WebGL fingerprinting

### 10.3 Audio Context Fingerprinting

**Capability:** Detect audio context fingerprinting.

#### What We Can Detect:
- ✅ AudioContext creation
- ✅ Audio processing
- ✅ Sample rate
- ✅ Audio destination
- ✅ Audio fingerprinting attempts

#### Detection:
```javascript
// Detect audio fingerprinting
const originalAudioContext = window.AudioContext || window.webkitAudioContext;
window.AudioContext = function(...args) {
  console.log('AudioContext created (possible fingerprinting)');
  return new originalAudioContext(...args);
};
```

**Implementation Status:**
- ❌ Not implemented: Audio fingerprinting detection

### 10.4 Font Enumeration

**Capability:** Detect available fonts (fingerprinting technique).

#### Methods:
- ✅ Check font availability via rendering
- ✅ Measure text width with different fonts
- ⚠️ Time-consuming operation

#### Detection:
```javascript
// Detect available fonts
function detectFonts(fontList) {
  const baseFonts = ['monospace', 'sans-serif', 'serif'];
  const testString = 'mmmmmmmmmmlli';
  const testSize = '72px';

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  const baseFontWidths = {};
  for (const baseFont of baseFonts) {
    context.font = testSize + ' ' + baseFont;
    baseFontWidths[baseFont] = context.measureText(testString).width;
  }

  const availableFonts = [];
  for (const font of fontList) {
    for (const baseFont of baseFonts) {
      context.font = testSize + ' ' + font + ', ' + baseFont;
      const width = context.measureText(testString).width;

      if (width !== baseFontWidths[baseFont]) {
        availableFonts.push(font);
        break;
      }
    }
  }

  return availableFonts;
}
```

**Implementation Status:**
- ❌ Not implemented: Font enumeration

### 10.5 Browser Feature Detection

**Capability:** Comprehensive feature detection for fingerprinting.

#### What We Can Detect:
- ✅ All JavaScript features
- ✅ DOM APIs
- ✅ CSS features
- ✅ Media codec support
- ✅ Image format support
- ✅ Plugin support

#### APIs:
```javascript
// Comprehensive feature detection
function detectBrowserFeatures() {
  return {
    // JavaScript features
    jsFeatures: {
      webAssembly: typeof WebAssembly !== 'undefined',
      sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
      bigInt: typeof BigInt !== 'undefined',
      proxy: typeof Proxy !== 'undefined',
      promise: typeof Promise !== 'undefined',
      modules: 'noModule' in document.createElement('script')
    },

    // Media codecs
    videoCodecs: {
      h264: document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E"'),
      h265: document.createElement('video').canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"'),
      vp8: document.createElement('video').canPlayType('video/webm; codecs="vp8"'),
      vp9: document.createElement('video').canPlayType('video/webm; codecs="vp9"'),
      av1: document.createElement('video').canPlayType('video/mp4; codecs="av01.0.05M.08"')
    },

    audioCodecs: {
      aac: document.createElement('audio').canPlayType('audio/mp4; codecs="mp4a.40.2"'),
      mp3: document.createElement('audio').canPlayType('audio/mpeg'),
      opus: document.createElement('audio').canPlayType('audio/ogg; codecs="opus"'),
      vorbis: document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"')
    },

    // Image formats
    imageFormats: {
      webp: document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0,
      avif: new Image().decode && document.createElement('canvas').toDataURL('image/avif').indexOf('data:image/avif') === 0
    }
  };
}
```

**Implementation Status:**
- ❌ Not implemented: Comprehensive feature detection

---

## 11. What We CANNOT Do (Chrome Limitations)

### 11.1 TLS/SSL Fingerprinting
- ❌ Cannot access TLS handshake details
- ❌ Cannot see cipher suites negotiated
- ❌ Cannot access certificate chain details
- ❌ Cannot perform JA3/JA3S fingerprinting
- ⚠️ Can only see protocol version (HTTP/1.1, HTTP/2, HTTP/3) via `nextHopProtocol`

### 11.2 Raw Network Packets
- ❌ Cannot access raw TCP/UDP packets
- ❌ Cannot see IP addresses (only DNS names)
- ❌ Cannot analyze packet timing at network layer
- ❌ Cannot perform packet-level analysis

### 11.3 System-Level Access
- ❌ Cannot make system calls
- ❌ Cannot access files outside browser sandbox
- ❌ Cannot access other processes
- ❌ Cannot access kernel information
- ❌ Cannot access hardware directly

### 11.4 Process Isolation Bypass
- ❌ Cannot break Chrome's process isolation
- ❌ Cannot access other tabs' content directly
- ❌ Cannot access other extensions' data
- ❌ Cannot escape the browser sandbox

### 11.5 Full Browser Profile
- ❌ Cannot enumerate all installed extensions
- ❌ Cannot access full browsing history without permission
- ❌ Cannot access bookmarks without permission
- ❌ Cannot access saved passwords

### 11.6 Response Body in MV3
- ❌ Cannot read response bodies in webRequest API (removed in MV3)
- ⚠️ Can only read via content script (same-origin)
- ⚠️ Can intercept via declarativeNetRequest but not read

### 11.7 Background Page Limitations
- ❌ No persistent background page (only service worker)
- ❌ Service worker can be terminated when idle
- ❌ Limited to Chrome Extension APIs only

---

## 12. Comparison Table

### Chrome Extension vs Electron (basset-hound-browser)

| Capability | Chrome Extension | Electron (basset-hound-browser) | Notes |
|-----------|------------------|----------------------------------|-------|
| **DOM Access** | ✅ Full (content script) | ✅ Full | Chrome: Isolated context<br>Electron: Full page context |
| **Network Monitoring** | ✅ webRequest API<br>⚠️ No response body | ✅ Full + Raw packets<br>✅ Response bodies | Electron has deeper access |
| **TLS/SSL Control** | ❌ No TLS details | ✅ Full certificate access<br>✅ TLS fingerprinting | Major advantage for Electron |
| **HTTP/2 & HTTP/3** | ✅ Protocol detection | ✅ Full control | Both support modern protocols |
| **WebSocket** | ✅ Connection detection<br>⚠️ No message content | ✅ Full message interception | Electron can read WS frames |
| **Request Blocking** | ✅ declarativeNetRequest | ✅ Full control | Both can block/modify |
| **Cookies** | ✅ Full access | ✅ Full access | Equal capability |
| **localStorage/sessionStorage** | ✅ Full access | ✅ Full access | Equal capability |
| **IndexedDB** | ✅ Full access | ✅ Full access | Equal capability |
| **DOM Extraction** | ✅ Full | ✅ Full | Equal capability |
| **Shadow DOM** | ✅ Open shadow roots<br>⚠️ Closed (via debugger) | ✅ Full access | Electron slightly easier |
| **Canvas/WebGL** | ✅ Content extraction | ✅ Content extraction | Equal capability |
| **Performance APIs** | ✅ Full access | ✅ Full access | Equal capability |
| **User Interaction Tracking** | ✅ Full | ✅ Full | Equal capability |
| **System Information** | ⚠️ Limited | ✅ Full Node.js access | Electron can access OS APIs |
| **File System** | ❌ Sandboxed | ✅ Full access | Electron has Node.js |
| **Process Control** | ❌ No | ✅ Yes | Electron can spawn processes |
| **Raw Packet Analysis** | ❌ No | ✅ Via pcap libraries | Electron can use native modules |
| **Certificate Details** | ❌ No | ✅ Full chain | Electron has full TLS access |
| **IP Addresses** | ❌ DNS names only | ✅ Full IP access | Chrome hides IPs |
| **Persistent Background** | ❌ Service worker only | ✅ Always running | Electron more reliable |
| **Memory Usage** | ✅ Lower | ⚠️ Higher | Chrome extension more lightweight |
| **Installation** | ✅ Easy (Chrome store) | ⚠️ Requires app install | Chrome extension easier |
| **Cross-Platform** | ✅ Any OS with Chrome | ✅ Any OS | Both cross-platform |
| **Automation** | ✅ WebSocket control | ✅ Direct API + WebSocket | Electron more flexible |

### Advantages of Chrome Extension:
1. ✅ **Easy deployment** - Install from Chrome store
2. ✅ **Low overhead** - Runs inside existing Chrome browser
3. ✅ **Automatic updates** - Via Chrome Web Store
4. ✅ **Wide compatibility** - Works on any Chrome browser
5. ✅ **Lower memory usage** - Shares browser process
6. ✅ **DevTools integration** - Built-in debugging

### Advantages of Electron (basset-hound-browser):
1. ✅ **TLS fingerprinting** - Full certificate and cipher access
2. ✅ **Raw packet capture** - Can use pcap libraries
3. ✅ **Full system access** - Node.js APIs available
4. ✅ **Response body access** - No MV3 restrictions
5. ✅ **Persistent background** - Always-on process
6. ✅ **Native modules** - Can use C++ addons
7. ✅ **Process control** - Spawn and control processes
8. ✅ **IP address access** - See real IPs not just DNS

---

## 13. Implementation Checklist

### 13.1 Core Forensics Features

| Feature | API | Permission | Status | Priority | Notes |
|---------|-----|-----------|--------|----------|-------|
| **Full HTML Extraction** | `document.outerHTML` | None | ✅ Implemented | High | ContentExtractor |
| **Shadow DOM Extraction** | `element.shadowRoot` | None | ✅ Implemented | High | Works for open shadows |
| **CSS Extraction** | `document.styleSheets` | None | ⚠️ Partial | Medium | Basic implementation |
| **Computed Styles** | `getComputedStyle()` | None | ⚠️ Partial | Medium | Limited to specific elements |
| **Network Monitoring** | `chrome.webRequest` | webRequest | ✅ Implemented | High | NetworkMonitor class |
| **HAR Export** | Custom | webRequest | ✅ Implemented | High | NetworkExporter class |
| **Cookie Forensics** | `chrome.cookies` | cookies | ✅ Implemented | High | Used in automation |
| **localStorage Extraction** | `localStorage` API | None | ✅ Implemented | High | Content script |
| **sessionStorage Extraction** | `sessionStorage` API | None | ✅ Implemented | High | Content script |
| **IndexedDB Enumeration** | `indexedDB.databases()` | None | ❌ Not implemented | Medium | Complex but doable |
| **Cache API Extraction** | `caches.keys()` | None | ❌ Not implemented | Low | Service worker caches |
| **Canvas Content** | `canvas.toDataURL()` | None | ❌ Not implemented | Medium | Image extraction |
| **WebGL Info** | `gl.getParameter()` | None | ❌ Not implemented | Medium | GPU fingerprinting |
| **Media Element Info** | HTMLMediaElement API | None | ❌ Not implemented | Low | Video/audio sources |
| **Web Component Analysis** | `customElements` | None | ❌ Not implemented | Low | Custom element registry |

### 13.2 Performance & Timing

| Feature | API | Permission | Status | Priority | Notes |
|---------|-----|-----------|--------|----------|-------|
| **Navigation Timing** | `performance.getEntriesByType()` | None | ❌ Not implemented | High | Core web vitals |
| **Resource Timing** | `performance.getEntriesByType('resource')` | None | ❌ Not implemented | High | Per-resource metrics |
| **User Timing** | `performance.mark()` | None | ❌ Not implemented | Low | Custom marks |
| **Long Tasks** | PerformanceObserver | None | ❌ Not implemented | Medium | Main thread blocking |
| **Layout Shift** | PerformanceObserver | None | ❌ Not implemented | Medium | CLS metric |
| **Paint Timing** | `performance.getEntriesByType('paint')` | None | ❌ Not implemented | Medium | FP/FCP metrics |

### 13.3 Security Analysis

| Feature | API | Permission | Status | Priority | Notes |
|---------|-----|-----------|--------|----------|-------|
| **CSP Extraction** | Response headers | webRequest | ❌ Not implemented | High | Critical security |
| **CSP Violation Monitoring** | securitypolicyviolation event | None | ❌ Not implemented | High | Detect policy issues |
| **Security Headers** | Response headers | webRequest | ⚠️ Partial | High | In NetworkMonitor |
| **CORS Analysis** | Response headers | webRequest | ❌ Not implemented | Medium | Cross-origin config |
| **Certificate Info** | chrome.webRequest | webRequest | ⚠️ Limited | Medium | Only protocol version |
| **HSTS Detection** | Response headers | webRequest | ⚠️ Partial | Medium | In headers |

### 13.4 Advanced Forensics

| Feature | API | Permission | Status | Priority | Notes |
|---------|-----|-----------|--------|----------|-------|
| **Canvas Fingerprint Detection** | Canvas API override | None | ❌ Not implemented | Medium | Detect fingerprinting |
| **WebGL Fingerprinting** | WebGL API | None | ❌ Not implemented | Medium | GPU fingerprinting |
| **Audio Fingerprint Detection** | AudioContext override | None | ❌ Not implemented | Low | Audio fingerprinting |
| **Font Enumeration** | Canvas text measurement | None | ❌ Not implemented | Low | Font fingerprinting |
| **Feature Detection** | Various API checks | None | ❌ Not implemented | Medium | Browser capabilities |
| **API Usage Detection** | API existence checks | None | ❌ Not implemented | Medium | Track API calls |
| **Permission States** | `navigator.permissions.query()` | None | ❌ Not implemented | Low | Permission status |

### 13.5 User Interaction (Ethical Considerations)

| Feature | API | Permission | Status | Priority | Notes |
|---------|-----|-----------|--------|----------|-------|
| **Mouse Tracking** | Mouse events | None | ❌ Not implemented | Low | Privacy concerns |
| **Keyboard Monitoring** | Keyboard events | None | ❌ Not implemented | Low | Ethical issues |
| **Focus Tracking** | Focus events | None | ❌ Not implemented | Low | Privacy concerns |
| **Scroll Tracking** | Scroll events | None | ❌ Not implemented | Low | User behavior |
| **Visibility Tracking** | visibilitychange | None | ❌ Not implemented | Low | Page visibility |
| **Lifecycle Events** | Page lifecycle | None | ⚠️ Partial | Medium | Basic events tracked |

### 13.6 Evidence Capture (Implemented in Phase 14)

| Feature | API | Permission | Status | Priority | Notes |
|---------|-----|-----------|--------|----------|-------|
| **Screenshot Capture** | `chrome.tabs.captureVisibleTab` | activeTab | ✅ Implemented | High | EvidenceCapture |
| **Page Content Capture** | DOM extraction | None | ✅ Implemented | High | EvidenceCapture |
| **Element Capture** | DOM element extraction | None | ✅ Implemented | High | EvidenceCapture |
| **SHA-256 Hashing** | crypto.subtle | None | ✅ Implemented | High | Integrity verification |
| **Chain of Custody** | Custom | None | ✅ Implemented | High | Forensic tracking |
| **Evidence Export** | JSON export | None | ✅ Implemented | High | NIST-DF format |
| **Annotation Tools** | Canvas drawing | None | ✅ Implemented | High | Evidence markup |

---

## Summary

### What We CAN Do (Strengths):
1. ✅ **Complete DOM access** - Read entire page structure including Shadow DOM
2. ✅ **Network monitoring** - Capture all requests with headers and timing
3. ✅ **Storage forensics** - Full access to cookies, localStorage, sessionStorage
4. ✅ **Performance analysis** - Navigation/Resource/User timing APIs
5. ✅ **Security header analysis** - CSP, CORS, HSTS detection
6. ✅ **Evidence capture** - Screenshots, page content with chain of custody
7. ✅ **Browser state** - Full tab/window management
8. ✅ **User interaction monitoring** - Mouse, keyboard, focus events
9. ✅ **API usage detection** - Detect which Web APIs are in use
10. ✅ **Advanced forensics** - Canvas/WebGL/Audio fingerprinting detection

### What We CANNOT Do (Limitations):
1. ❌ **TLS fingerprinting** - No access to certificate details or cipher suites
2. ❌ **Raw packet analysis** - Cannot access network packets
3. ❌ **Response body in MV3** - Removed from webRequest API
4. ❌ **System-level access** - No file system or process control
5. ❌ **IP address access** - Only DNS names available
6. ❌ **Full browser profile** - Limited extension/history enumeration

### Recommended Implementation Priority:
1. **High Priority** (Immediate):
   - ✅ Navigation Timing extraction
   - ✅ Resource Timing extraction
   - ✅ CSP header analysis
   - ✅ IndexedDB enumeration

2. **Medium Priority** (Next Phase):
   - Canvas/WebGL fingerprinting detection
   - API usage detection and monitoring
   - Comprehensive security header analysis
   - Cache API forensics

3. **Low Priority** (Future):
   - Font enumeration
   - Audio fingerprinting detection
   - User interaction tracking (with ethical considerations)

---

**Document Version:** 1.0.0
**Authors:** Basset Hound Development Team
**Last Updated:** 2026-01-09
