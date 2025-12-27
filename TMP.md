# Basset Hound Autofill Extension - Project Continuity File

> **Purpose**: This file serves as a "session resume" document for future Claude Code conversations working on this project. Read this first when starting a new development session.

---

## 1. Project Overview

**Basset Hound Autofill Extension** is a Chrome MV3 extension for browser automation via WebSocket. It enables remote control of browser actions including form filling, navigation, content extraction, cookie/storage management, and network monitoring.

The extension is designed to work as part of the larger Basset Hound OSINT toolkit, providing browser automation capabilities that integrate with the main backend system.

---

## 2. Current State (December 2024)

### Completed Features

- **Core Functionality**
  - WebSocket client for backend communication
  - Form filling and form detection
  - Page navigation
  - Content extraction (text, HTML, screenshots)

- **Enhanced Features**
  - Cookie management (get, set, delete, list)
  - Storage management (localStorage, sessionStorage)
  - Network monitoring (request/response tracking)
  - Request interception (block, modify, redirect)

- **Testing Infrastructure**
  - Jest unit tests for all modules
  - Integration tests for end-to-end flows
  - Manual test pages for browser testing

- **Documentation**
  - Comprehensive README
  - API documentation
  - Development roadmap

---

## 3. Key Files

### Core Extension Files
- `background.js` - Service worker with WebSocket client and command handlers
- `content.js` - DOM interaction and form automation
- `manifest.json` - Chrome MV3 manifest configuration
- `popup.html` / `popup.js` - Extension popup UI

### Utility Modules (`utils/`)
- `logger.js` - Logging utility with configurable levels
- `networkMonitor.js` - Network request/response monitoring
- `requestInterceptor.js` - Request blocking, modification, redirection
- `formDetector.js` - Form field detection and analysis

### Tests (`tests/`)
- `unit/` - Jest unit tests for individual modules
- `integration/` - End-to-end integration tests
- `manual/` - HTML test pages for browser testing

### Documentation (`docs/`)
- `ROADMAP.md` - Development phases and task status
- `API.md` - WebSocket command API reference

---

## 4. Architecture Notes

### Chrome MV3 Architecture
- Uses **service worker** (not persistent background page)
- Service worker may be terminated when idle; handles reconnection
- Content script injected on all pages (`<all_urls>`) for DOM access

### Communication Flow
```
Backend Server (ws://localhost:8765/browser)
    |
    | WebSocket
    v
background.js (Service Worker)
    |
    | chrome.runtime messaging
    v
content.js (Content Script in each tab)
    |
    | DOM APIs
    v
Web Page
```

### Key Design Decisions
- WebSocket URL: `ws://localhost:8765/browser`
- All commands are JSON messages with `type` and `data` fields
- Responses include `success` boolean and `data` or `error` fields
- Network monitoring uses `chrome.webRequest` API
- Request interception uses declarative net request where possible

---

## 5. Next Steps / TODOs

### Phase 3: Testing Validation (Current)
- [ ] Complete integration test coverage
- [ ] Validate all manual test scenarios
- [ ] Performance testing under load

### Phase 4: Advanced Features
- [ ] Shadow DOM support for modern web components
- [ ] Frame and iframe support
- [ ] Multi-tab management and coordination
- [ ] Enhanced element selection (XPath, advanced CSS)

### Phase 5: Backend Integration
- [ ] Integration with main basset-hound project
- [ ] Coordination with Python backend
- [ ] Profile data extraction workflows
- [ ] OSINT automation pipelines

---

## 6. How to Resume Development

### Getting Oriented
1. Read `docs/ROADMAP.md` for current task status and priorities
2. Review recent git commits for context on latest changes
3. Check this file for architecture overview

### Development Setup
```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Manual Testing
1. Open `chrome://extensions` in Chrome
2. Enable "Developer mode"
3. Click "Load unpacked" and select this extension directory
4. Open the extension popup to verify connection status
5. Check the service worker console for logs

### Full Integration Testing
1. Start the WebSocket backend server (from basset-hound project)
2. Load the extension in Chrome
3. Extension will auto-connect to `ws://localhost:8765/browser`
4. Send commands via the backend to test functionality

### Debugging Tips
- Service worker logs: `chrome://extensions` -> "Inspect views: service worker"
- Content script logs: Browser DevTools console on any page
- Network monitoring: DevTools Network tab
- Extension storage: DevTools -> Application -> Extension Storage

---

## 7. Common Commands Reference

### WebSocket Message Format
```json
{
  "type": "command_name",
  "data": {
    "param1": "value1"
  }
}
```

### Key Commands
- `navigate` - Navigate to URL
- `fillForm` - Fill form fields
- `extractContent` - Get page content
- `click` - Click element
- `getCookies` / `setCookie` - Cookie management
- `getStorage` / `setStorage` - Storage management
- `startNetworkMonitoring` - Begin capturing network requests

---

*Last Updated: December 2024*
