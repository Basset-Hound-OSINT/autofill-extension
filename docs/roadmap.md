# OSINT Browser Automation Extension - Roadmap

## Overview

This roadmap outlines the development plan for the OSINT Browser Automation extension, enabling AI agents (via palletAI) to control browser actions for OSINT investigations, pentesting, and cybersecurity workflows.

---

## Current State (v2.0.0)

The extension has been rebuilt from scratch with:

### Completed Features
- [x] **WebSocket bi-directional communication** with palletAI backend
- [x] **Manifest V3** compliance with service worker architecture
- [x] **Core browser automation commands**:
  - Navigation (`navigate`, `go_back`, `go_forward`, `refresh`)
  - Form interaction (`fill_form`, `click`, `hover`, `select_option`)
  - Content extraction (`get_content`, `get_text`, `get_attribute`, `get_page_state`)
  - Screenshots (`screenshot`)
  - Wait utilities (`wait_for_element`, `wait_for_navigation`)
  - Cookie management (`get_cookies`, `set_cookie`, `clear_cookies`)
  - Tab management (`get_tabs`, `switch_tab`, `new_tab`, `close_tab`)
  - Script execution (`execute_script`, `scroll`)
  - File downloads (`download_file`)
- [x] **Realistic typing simulation** to bypass bot detection
- [x] **Element detection** with multiple selector strategies
- [x] **Popup UI** with connection status and manual controls
- [x] **Auto-reconnection** logic for WebSocket stability

### Extension Files
| File | Purpose |
|------|---------|
| `manifest.json` | Extension configuration (MV3) |
| `background.js` | Service worker, WebSocket management, command routing |
| `content.js` | DOM interaction, form filling, page state extraction |
| `popup.html` | UI for status display and settings |
| `popup.js` | Popup controller logic |

---

## Phase 1: Stability & Testing

**Priority: High**

### 1.1 Error Handling Improvements
- [ ] Add comprehensive error codes for all failure scenarios
- [ ] Implement retry logic for transient failures
- [ ] Add timeout handling for long-running operations
- [ ] Create error recovery procedures

### 1.2 Testing Infrastructure
- [x] Create test page with all form types (text, select, checkbox, radio, file, etc.) - `tests/test-forms.html`
- [x] Build automated test suite for all commands - `tests/run-tests.js`
- [x] Add integration tests with mock WebSocket server - `tests/mock-ws-server.js`
- [ ] Test across Chrome, Firefox (via browser_specific_settings), Edge

### 1.3 Logging & Debugging
- [ ] Add structured logging with log levels
- [ ] Create debug mode with verbose output
- [ ] Add performance timing metrics
- [ ] Implement command history/replay for debugging

---

## Phase 2: Enhanced Browser Control

**Priority: High**

### 2.1 Advanced Form Handling
- [ ] Support multi-step forms (wizards)
- [ ] Handle dynamic forms (AJAX-loaded fields)
- [ ] Support file upload fields
- [ ] Handle CAPTCHAs (detection + notification to human operator)
- [ ] Support form validation bypass (when needed)
- [ ] Handle date/time pickers with various implementations

### 2.2 Navigation Improvements
- [ ] History state management
- [ ] Handle redirects gracefully
- [ ] Support authentication popups (HTTP Basic Auth)
- [ ] Handle new window/popup spawning
- [ ] Frame/iframe navigation support
- [ ] Handle browser dialogs (alert, confirm, prompt)

### 2.3 Content Extraction
- [ ] Table data extraction to structured format
- [ ] Extract metadata (og tags, schema.org, etc.)
- [ ] PDF content extraction from embedded viewers
- [ ] Extract data from infinite scroll pages
- [ ] Shadow DOM content access
- [ ] Canvas/image OCR integration hook

### 2.4 Network Interception
- [ ] Monitor XHR/Fetch requests
- [ ] Capture API responses
- [ ] Modify request headers
- [ ] Block specific requests (ads, trackers)
- [ ] Export HAR files

---

## Phase 3: OSINT Tool Integration

**Priority: High**

### 3.1 osint-resources Knowledge Base
- [ ] Parse `tool_info` YAML blocks from osint-resources
- [ ] Auto-generate form field mappings from YAML
- [ ] Create command presets for common OSINT tools
- [ ] Support tool chaining (output of one -> input of another)

### 3.2 Tool-Specific Handlers
Priority tools to support:
- [ ] **HaveIBeenPwned** - Email breach lookup
- [ ] **Hunter.io** - Email finder/verifier
- [ ] **Shodan** - IP/device search
- [ ] **BuiltWith/Wappalyzer** - Technology detection (implement own detection)
- [ ] **Wayback Machine** - Historical snapshots
- [ ] **Social Media** - Profile lookup across platforms
- [ ] **WHOIS** - Domain registration data
- [ ] **DNSDumpster** - DNS reconnaissance

### 3.3 Data Pipeline
- [ ] Send extracted data to basset-hound entities
- [ ] Support data normalization (dates, names, addresses)
- [ ] Entity relationship creation from discovered data
- [ ] Deduplication of findings

---

## Phase 4: Bot Detection Evasion

**Priority: Medium-High**

### 4.1 Human-like Behavior
- [x] Realistic typing speed with variance (completed)
- [x] Random mouse movements before clicks (Bezier curve paths)
- [x] Scroll behavior patterns (acceleration/deceleration)
- [x] Tab focus/blur simulation
- [x] Reading time delays based on content length
- [x] Natural cursor movement paths (Bezier curves with overshoot correction)

### 4.2 Browser Fingerprint
- [ ] Randomize non-essential fingerprint attributes
- [ ] Support user-agent rotation
- [ ] Timezone/locale consistency
- [ ] WebGL/Canvas fingerprint awareness
- [ ] Detect and report fingerprinting attempts

### 4.3 Rate Limiting
- [ ] Configurable request delays
- [ ] Domain-specific rate limiting
- [ ] Backoff on 429/rate limit responses
- [ ] Queue management for bulk operations

---

## Phase 5: Advanced Features

**Priority: Medium**

### 5.1 Multi-Tab Orchestration
- [ ] Parallel operations across tabs
- [ ] Tab grouping by investigation
- [ ] Cross-tab data sharing
- [ ] Tab lifecycle management

### 5.2 Session Management
- [ ] Save/restore browser sessions
- [ ] Cookie export/import
- [ ] Login session persistence
- [ ] Multi-account switching

### 5.3 Recording & Playback
- [ ] Record user actions as command sequences
- [ ] Export to replayable scripts
- [ ] Edit recorded sequences
- [ ] Share investigation workflows

### 5.4 Proxy Support
- [ ] Configure per-request proxies
- [ ] Proxy rotation
- [ ] SOCKS5 support
- [ ] Tor integration

---

## Phase 6: palletAI Integration

**Priority: High**

### 6.1 Agent Communication Protocol
- [ ] Define formal message schema (JSON Schema)
- [ ] Implement command versioning
- [ ] Add capability negotiation
- [ ] Support batch commands
- [ ] Add streaming responses for large data

### 6.2 Agent Callbacks
- [ ] Human-in-the-loop for CAPTCHAs
- [ ] Approval workflows for sensitive actions
- [ ] Progress reporting for long operations
- [ ] Breakpoint/pause functionality

### 6.3 Context Awareness
- [ ] Report current page context to agent
- [ ] Detect login states
- [ ] Track investigation progress
- [ ] Share detected technologies

---

## Phase 7: Security & Compliance

**Priority: High**

### 7.1 Security Hardening
- [ ] Input validation for all commands
- [ ] Sanitize extracted content
- [ ] Secure WebSocket (WSS) enforcement option
- [ ] Authentication for WebSocket connections
- [ ] Rate limiting on command execution

### 7.2 Privacy Controls
- [ ] Clear browsing data on command
- [ ] Incognito mode support
- [ ] Local-only mode (no external connections)
- [ ] Audit logging of all actions

### 7.3 Access Control
- [ ] Whitelist/blacklist domains
- [ ] Command permission levels
- [ ] User confirmation for destructive actions

---

## Phase 8: Cross-Extension Communication

**Priority: Low**

Based on research documented in `chrome-extension-cross-communication.md`:

### 8.1 Cooperative Extensions
- [ ] Define `externally_connectable` manifest
- [ ] Create extension communication protocol
- [ ] Support data sharing between owned extensions

### 8.2 Workarounds for Third-Party
- [ ] Implement own technology detection (vs Wappalyzer)
- [ ] Content script DOM observation
- [ ] Shared server bridge pattern

---

## Technical Debt & Maintenance

### Ongoing
- [ ] Keep dependencies updated
- [ ] Monitor Chrome API deprecations
- [ ] Maintain Firefox compatibility
- [ ] Performance optimization
- [ ] Memory leak prevention in long-running tabs

### Documentation
- [ ] API reference for all commands
- [ ] Integration guide for palletAI
- [ ] Troubleshooting guide
- [ ] Example investigation workflows

---

## Version Milestones

| Version | Focus | Key Features |
|---------|-------|--------------|
| 2.0.0 | Foundation | WebSocket, core commands, popup UI (CURRENT) |
| 2.1.0 | Stability | Testing, error handling, logging |
| 2.2.0 | Forms | Advanced form handling, file uploads, CAPTCHAs |
| 2.3.0 | Content | Enhanced extraction, network interception |
| 3.0.0 | OSINT | Tool integration, basset-hound pipeline |
| 3.1.0 | Evasion | Human-like behavior, fingerprint management |
| 3.2.0 | Multi-tab | Parallel operations, session management |
| 4.0.0 | Enterprise | Security hardening, audit logging, access control |

---

## Dependencies

### Required
- **palletAI** running at `ws://localhost:8765/browser`
- **Chrome/Chromium** 88+ or **Firefox** 109+

### Optional
- **basset-hound** for entity storage
- **osint-resources** for tool metadata
- **basset-hound-browser** for Electron container

---

## Relationship with basset-hound-browser

This extension can run in two environments:

### 1. Regular Chrome Browser
```
┌──────────────┐    WebSocket    ┌──────────────┐
│   palletAI   │ ◄─────────────► │  Extension   │
│   (Backend)  │                 │  (in Chrome) │
└──────────────┘                 └──────────────┘

Benefits:
- Uses real browser profile
- Human-in-the-loop capability
- Maximum stealth (real fingerprint)
```

### 2. Electron Browser (basset-hound-browser)
```
┌──────────────┐    WebSocket    ┌───────────────────┐
│   palletAI   │ ◄─────────────► │ basset-hound-     │
│   (Backend)  │                 │ browser           │
└──────────────┘                 │  └── Extension    │
                                 └───────────────────┘

Benefits:
- Runs independently of user's Chrome
- Fully automated operation
- Can run headless
- Extension bundled in app
```

The extension is linked as a git submodule in basset-hound-browser:
```
basset-hound-browser/
└── extensions/
    └── autofill/  → this repository
```

---

## Testing Infrastructure

### Remote Testing Server
- Location: `devel@192.168.0.7:~/Desktop/autofill-extension/`
- Environment: Ubuntu with Chrome and Xvfb
- Node.js 20.x installed

### Test Files
| File | Purpose |
|------|---------|
| `tests/mock-ws-server.js` | Mock palletAI WebSocket server |
| `tests/extension-tester.js` | Puppeteer-based test framework |
| `tests/run-tests.js` | Main test runner |
| `tests/simple-test.js` | Simple extension load test |
| `tests/test-forms.html` | Comprehensive form test page (15 sections) |

### Running Tests
```bash
# On remote Ubuntu server
cd ~/Desktop/autofill-extension
xvfb-run --auto-servernum npm test

# With real display
DISPLAY=:1 npm test
```

---

## Contributing

When implementing features:

1. Update command handlers in `background.js`
2. Add DOM interactions in `content.js`
3. Update CAPABILITIES list in `popup.js`
4. Add tests in `tests/` (to be created)
5. Update this roadmap with completion status

---

*Last Updated: December 2024*
