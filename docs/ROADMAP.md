# Basset Hound Browser Automation Extension - Development Roadmap

## Overview

This roadmap tracks the development of the Basset Hound Browser Automation Extension, a Chrome MV3 extension enabling AI agents (via palletAI) to control browser actions for OSINT investigations, pentesting, and cybersecurity workflows.

---

## Current State (v2.1.0 - December 2024)

### Completed Features

- **WebSocket bi-directional communication** with palletAI backend
- **Manifest V3** compliance with service worker architecture
- **Core browser automation commands**:
  - Navigation (`navigate`, `go_back`, `go_forward`, `refresh`)
  - Form interaction (`fill_form`, `click`, `hover`, `select_option`)
  - Content extraction (`get_content`, `get_text`, `get_attribute`, `get_page_state`)
  - Screenshots (`screenshot`)
  - Wait utilities (`wait_for_element`, `wait_for_navigation`)
  - Cookie management (`get_cookies`, `set_cookie`, `clear_cookies`)
  - Tab management (`get_tabs`, `switch_tab`, `new_tab`, `close_tab`)
  - Script execution (`execute_script`, `scroll`)
  - File downloads (`download_file`)
- **Realistic typing simulation** to bypass bot detection
- **Element detection** with multiple selector strategies (CSS, XPath, text, aria)
- **Popup UI** with connection status and manual controls
- **Auto-reconnection** logic for WebSocket stability
- **Network monitoring** with HAR export
- **Request interception** with header modification and URL blocking
- **Shadow DOM support** with deep querying and traversal
- **iframe/frame support** with cross-frame messaging
- **CAPTCHA detection** for reCAPTCHA, hCaptcha, Cloudflare Turnstile, and more

### Extension Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension configuration (MV3) |
| `background.js` | Service worker, WebSocket management, command routing |
| `content.js` | DOM interaction, form filling, page state extraction, Shadow DOM, iframes |
| `popup.html` | UI for status display and settings |
| `popup.js` | Popup controller logic |
| `utils/logger.js` | Structured logging utility |
| `utils/network-monitor.js` | Network traffic monitoring |
| `utils/request-interceptor.js` | Request interception |
| `utils/form-detector.js` | Form field detection |
| `utils/captcha-detector.js` | CAPTCHA detection and state tracking |
| `utils/user-agent-rotator.js` | User-agent rotation for bot evasion |
| `utils/rate-limiter.js` | Rate limiting with action-specific presets |
| `utils/osint-handlers/haveibeenpwned.js` | HaveIBeenPwned API integration |
| `utils/osint-handlers/shodan.js` | Shodan IP/device search integration |
| `utils/osint-handlers/wayback.js` | Wayback Machine archive integration |
| `utils/osint-handlers/whois.js` | WHOIS domain/IP lookup integration |
| `utils/osint-handlers/hunter.js` | Hunter.io email finder/verifier integration |
| `utils/osint-handlers/social-media.js` | Social media profile lookup integration |
| `utils/security/input-validator.js` | Input validation and XSS sanitization |
| `utils/security/websocket-auth.js` | WebSocket authentication and encryption |
| `utils/security/privacy-controls.js` | Privacy management and local-only mode |
| `utils/knowledge-base/tool-parser.js` | YAML tool config parsing and presets |
| `utils/data-pipeline/normalizer.js` | Data normalization (dates, names, addresses, phones, emails) |
| `utils/data-pipeline/entity-manager.js` | Entity creation, relationships, export |
| `utils/agent/callbacks.js` | CAPTCHA help, approval workflows, breakpoints |
| `utils/agent/message-schema.js` | JSON Schema validation and versioning |
| `utils/agent/streaming.js` | Streaming responses for large data |
| `utils/security/audit-logger.js` | Audit logging with privacy-aware redaction |
| `utils/data-pipeline/basset-hound-sync.js` | Backend sync with offline queue |
| `utils/fingerprint-randomizer.js` | Browser fingerprint randomization |

---

## Phase 1: Core Foundation - COMPLETED

### 1.1 Extension Architecture

| Task | Status | Description |
|------|--------|-------------|
| Chrome MV3 Manifest | Done | Manifest V3 setup with service worker |
| WebSocket Client | Done | Background.js WebSocket connection |
| Content Script | Done | DOM interaction capabilities |
| Popup UI | Done | Connection status and controls |
| Structured Logging | Done | Logger utility with levels |

### 1.2 Core Commands

| Command | Status | Description |
|---------|--------|-------------|
| navigate | Done | URL navigation with wait options |
| fill_form | Done | Form field population |
| click | Done | Element clicking |
| get_content | Done | Content extraction |
| screenshot | Done | Tab capture |
| wait_for_element | Done | Element waiting |
| get_page_state | Done | Page analysis |
| execute_script | Done | Custom JS execution |

### 1.3 Connection Management

| Feature | Status | Description |
|---------|--------|-------------|
| Auto-reconnect | Done | Exponential backoff reconnection |
| Heartbeat | Done | Keep-alive mechanism |
| Task queue | Done | Command tracking |

---

## Phase 2: Enhanced Capabilities - COMPLETED

### 2.1 Cookie & Storage Management

| Task | Status | Description |
|------|--------|-------------|
| get_cookies | Done | Retrieve cookies for domain |
| set_cookies | Done | Set cookies programmatically |
| get_local_storage | Done | Read localStorage |
| set_local_storage | Done | Write localStorage |
| get_session_storage | Done | Read sessionStorage |
| set_session_storage | Done | Write sessionStorage |
| clear_storage | Done | Clear all storage types |

### 2.2 Network Monitoring

| Task | Status | Description |
|------|--------|-------------|
| Network Monitor | Done | Track all network requests |
| Request/Response Capture | Done | Headers, timing, status |
| HAR Export | Done | HTTP Archive format export |
| Network Stats | Done | Request statistics |

### 2.3 Request Interception

| Task | Status | Description |
|------|--------|-------------|
| Request Interceptor | Done | Rule-based interception |
| Header Modification | Done | Add/modify/remove headers |
| URL Blocking | Done | Block specific URLs |
| Response Mocking | Done | Return custom responses |

### 2.4 Form Automation

| Task | Status | Description |
|------|--------|-------------|
| Field Detection | Done | Auto-discover form fields |
| Human-like Typing | Done | Realistic typing simulation |
| Multi-strategy Finding | Done | CSS, ID, name, aria, text |

---

## Phase 3: Testing & Validation - COMPLETED

### 3.1 Unit Tests

| Task | Status | Description |
|------|--------|-------------|
| Background.js tests | Done | Test command handlers |
| Content.js tests | Done | Test DOM interactions |
| Logger tests | Done | Test logging utility |
| Network monitor tests | Done | Test network capture |
| Request interceptor tests | Done | Test request interception |

### 3.2 Integration Tests

| Task | Status | Description |
|------|--------|-------------|
| WebSocket connection | Done | Test connection lifecycle |
| Command execution | Done | End-to-end command tests |
| Content script integration | Done | Test content script interactions |
| Error handling | Done | Test failure scenarios (error-handling.test.js) |
| Multi-tab scenarios | Done | Test tab management (multi-tab.test.js) |

### 3.3 Manual Testing

| Task | Status | Description |
|------|--------|-------------|
| Test pages created | Done | HTML test pages for all scenarios |
| Test checklist created | Done | Comprehensive manual test checklist |
| Load extension | In Progress | Verify extension loads |
| Connect to backend | In Progress | Test WebSocket connection |
| Form filling | In Progress | Test various form types |
| Navigation | In Progress | Test URL navigation |

---

## Phase 4: Advanced Features - IN PROGRESS

### 4.1 Shadow DOM Support

| Task | Status | Description |
|------|--------|-------------|
| Shadow root detection | Done | Detect shadow DOM elements via `getAllShadowRoots()` |
| Shadow DOM traversal | Done | Navigate shadow trees with `querySelectorDeep()` |
| Shadow element interaction | Done | Click/fill shadow elements with deep selectors |
| Shadow path navigation | Done | Access elements via `findElementByShadowPath()` |

### 4.2 Frame Support

| Task | Status | Description |
|------|--------|-------------|
| iframe detection | Done | Detect embedded frames via `get_frames` command |
| Cross-frame messaging | Done | Communication with iframes via content script in all frames |
| Frame content access | Done | Read/write frame content via `execute_in_frame` command |
| Frame info retrieval | Done | Get frame details via `get_frame_info` command |

### 4.3 Enhanced Element Selection

| Task | Status | Description |
|------|--------|-------------|
| XPath support | Done | Select elements using XPath via `evaluateXPath()` |
| Multi-strategy finder | Done | CSS, XPath, text, aria combined in `findElements()` |
| Deep shadow querying | Done | Query elements inside shadow DOM |

### 4.4 Multi-Tab Management

| Task | Status | Description |
|------|--------|-------------|
| Tab creation | Done | Create new tabs (Phase 1) |
| Tab switching | Done | Switch between tabs (Phase 1) |
| Tab grouping | Done | Organize tabs in groups via `create_tab_group`, `add_to_group`, `remove_from_group`, `get_tab_groups` |
| Tab state tracking | Done | Track tab states via `get_tab_state`, `get_all_tab_states` with real-time event listeners |

### 4.5 Enhanced Form Handling

| Task | Status | Description |
|------|--------|-------------|
| CAPTCHA detection | Done | Detect reCAPTCHA, hCaptcha, Turnstile, FunCaptcha, Geetest |
| CAPTCHA state tracking | Done | Track unsolved/solved/expired/challenge_visible states |
| File upload | Done | Handle file inputs via DataTransfer API with base64 content |
| Multi-select | Done | Handle select elements via `get_select_elements`, `get_select_options`, `set_select_value`, `set_multi_select_values`, `clear_select_selection` (supports Select2, Chosen, Bootstrap Select, Tom Select, Slim Select) |
| Date pickers | Done | Handle date inputs via `get_date_pickers`, `set_date`, `open_date_picker`, `select_calendar_date` (supports native, jQuery UI, Bootstrap, Flatpickr, Material UI, React-datepicker, Pikaday, Air Datepicker, Litepicker) |
| Multi-step forms | Done | Support wizard forms via `detect_wizard`, `get_wizard_state`, `wizard_next`, `wizard_previous`, `fill_wizard_step`, `is_last_step`, `get_submit_button`, `submit_wizard` |
| Dynamic forms | Done | Handle AJAX-loaded fields via MutationObserver, wait for fields, detect loading |

### 4.6 Bot Detection Evasion

| Task | Status | Description |
|------|--------|-------------|
| Realistic typing | Done | Random delays and variance |
| Mouse movements | Done | Bezier curve paths |
| Scroll behavior | Done | Acceleration/deceleration |
| Browser fingerprint | Done | Randomize attributes via `enable_fingerprint_protection`, `disable_fingerprint_protection`, `get_fingerprint_status`, `regenerate_fingerprint` (Canvas, WebGL, Audio, Navigator, Screen) |
| User-agent rotation | Done | Rotate user agents via `set_user_agent`, `rotate_user_agent`, `get_user_agents`, `reset_user_agent` (25 realistic UA strings for Chrome, Firefox, Safari, Edge on Windows, Mac, Linux) |
| Rate limiting | Done | Configurable delays via `set_rate_limit`, `get_rate_limit`, `pause_actions`, `resume_actions` with presets for click, typing, navigation, scroll |

---

## Phase 5: OSINT Tool Integration - PLANNED

### 5.1 Knowledge Base Integration

| Task | Status | Description |
|------|--------|-------------|
| Parse tool_info YAML | Done | Extract osint-resources data via `parse_tool_config` with simple YAML parser |
| Auto-generate mappings | Done | Create field mappings via `get_field_mappings` with input/output mapping generation |
| Command presets | Done | Presets for common tools via `get_tool_preset`, `list_tool_presets` (Shodan, Censys, HIBP, Hunter.io, WHOIS, Wayback, VirusTotal, DNSDumpster, SecurityTrails, Social Media) |
| Tool chaining | Done | Output to input pipelines via `chain_tools` with workflow generation and execution plans |

### 5.2 Priority Tool Handlers

| Tool | Status | Description |
|------|--------|-------------|
| HaveIBeenPwned | Done | Email breach lookup via `hibp_check_email`, password check via `hibp_check_password`, breach details via `hibp_get_breach` (k-anonymity for passwords) |
| Hunter.io | Done | Email finder/verifier via `hunter_domain`, `hunter_find`, `hunter_verify`, `hunter_count` (requires API key) |
| Shodan | Done | IP/device search via `shodan_host`, `shodan_search`, `shodan_dns`, `shodan_myip` (requires API key) |
| Wayback Machine | Done | Historical snapshots via `wayback_check`, `wayback_snapshots`, `wayback_get`, `wayback_latest` (public API) |
| WHOIS | Done | Domain registration via `whois_domain`, `whois_ip` with RDAP fallback (public API) |
| Social Media | Done | Profile lookup via `social_search`, `social_check`, `social_platforms` (Twitter, GitHub, LinkedIn, Instagram, Facebook, Reddit, TikTok, YouTube, Pinterest, Medium) |

### 5.3 Data Pipeline

| Task | Status | Description |
|------|--------|-------------|
| basset-hound sync | Done | Entity sync with backend via `sync_entity`, `sync_entities`, `pull_entities`, `get_sync_status` with offline queue and conflict resolution |
| Data normalization | Done | Normalize dates, names, addresses, phones, emails via `normalize_data` command |
| Entity relationships | Done | Create from discoveries via `create_entity`, `link_entities`, `get_related` commands |
| Deduplication | Done | Remove duplicate findings via `deduplicate` with exact, fuzzy (Jaro-Winkler), and normalized matching |

---

## Phase 6: palletAI Integration - PLANNED

### 6.1 Agent Communication

| Task | Status | Description |
|------|--------|-------------|
| Message schema | Done | JSON Schema definition via `get_schema` with draft-07 schema for all message types |
| Command versioning | Done | Version negotiation via `negotiate_version` with compatibility checking |
| Batch commands | Done | Multiple commands via `batch_execute`, `queue_commands`, `get_queue_status`, `cancel_queue` with parallel/sequential execution |
| Streaming responses | Done | Large data handling via `start_stream`, `get_stream_chunk` with generators, chunking, pause/resume |

### 6.2 Agent Callbacks

| Task | Status | Description |
|------|--------|-------------|
| CAPTCHA handling | Done | Human-in-the-loop via `request_captcha_help` with timeout, priority, screenshot support |
| Approval workflows | Done | Sensitive action approval via `request_approval` for forms, payments, data exports |
| Progress reporting | Done | Long operation updates via `report_progress` with ETA and phase tracking |
| Breakpoints | Done | Pause functionality via `set_breakpoint`, `resume_breakpoint` with conditions and auto-resume |

---

## Phase 7: Security & Compliance - PLANNED

### 7.1 Security Hardening

| Task | Status | Description |
|------|--------|-------------|
| Input validation | Done | Validate all commands via `input-validator.js` with selector, URL, script pattern validation |
| Content sanitization | Done | Sanitize extracted data via `sanitizeInput()` with XSS prevention, type-safe handling |
| WSS enforcement | Done | Secure WebSocket option via `enable_wss` with automatic ws:// to wss:// upgrade |
| Authentication | Done | WebSocket auth via `set_ws_auth`, `rotate_auth_token` with token generation and validation |

### 7.2 Privacy Controls

| Task | Status | Description |
|------|--------|-------------|
| Clear browsing data | Done | On-demand clearing via `clear_browsing_data` for cookies, localStorage, history, cache |
| Incognito support | Done | Incognito mode via privacy-controls.js with `checkIncognitoStatus()` |
| Local-only mode | Done | No external connections via `set_local_only` restricting to localhost only |
| Audit logging | Done | Action logging via `get_audit_log`, `clear_audit_log`, `export_audit_log`, `set_audit_level` with privacy-aware redaction |

---

## Technical Debt

| Item | Priority | Description |
|------|----------|-------------|
| Error recovery | High | Improve error handling |
| Performance profiling | Medium | Optimize content script |
| Memory management | Medium | Handle long sessions |
| Code documentation | Low | Add JSDoc comments |

---

## Testing Infrastructure

### Remote Testing Server

- **Location**: `devel@192.168.0.7:~/Desktop/autofill-extension/`
- **Environment**: Ubuntu with Chrome and Xvfb
- **Node.js**: 20.x installed

### Test Files

| File | Purpose |
|------|---------|
| `tests/mock-ws-server.js` | Mock palletAI WebSocket server |
| `tests/extension-tester.js` | Puppeteer-based test framework |
| `tests/run-tests.js` | Main test runner |
| `tests/simple-test.js` | Simple extension load test |
| `tests/test-forms.html` | Comprehensive form test page |

### Running Tests

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# On remote Ubuntu server with Xvfb
xvfb-run --auto-servernum npm test

# With real display
DISPLAY=:1 npm test
```

---

## Architecture

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

### WebSocket Message Format

```json
{
  "type": "command_name",
  "data": {
    "param1": "value1"
  }
}
```

---

## Deployment Environments

### 1. Regular Chrome Browser

```
+--------------+    WebSocket    +--------------+
|   palletAI   | <-------------> |  Extension   |
|   (Backend)  |                 |  (in Chrome) |
+--------------+                 +--------------+

Benefits:
- Uses real browser profile
- Human-in-the-loop capability
- Maximum stealth (real fingerprint)
```

### 2. Electron Browser (basset-hound-browser)

```
+--------------+    WebSocket    +-------------------+
|   palletAI   | <-------------> | basset-hound-     |
|   (Backend)  |                 | browser           |
+--------------+                 |  +-- Extension    |
                                 +-------------------+

Benefits:
- Runs independently of user's Chrome
- Fully automated operation
- Can run headless
- Extension bundled in app
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-12 | Initial release with core features |
| 1.1.0 | 2024-12 | Added cookie/storage management |
| 1.2.0 | 2024-12 | Added network monitoring |
| 1.3.0 | 2024-12 | Added request interception |
| 1.4.0 | 2024-12-26 | Added test infrastructure |
| 2.0.0 | 2024-12 | Comprehensive rebuild with all features |
| 2.0.1 | 2024-12-27 | Added error handling and multi-tab integration tests |
| 2.1.0 | 2024-12-27 | Added Shadow DOM support, iframe support, XPath selection, CAPTCHA detection |
| 2.2.0 | 2024-12-27 | Added tab grouping (create, add, remove, list) and tab state tracking with real-time events |
| 2.3.0 | 2024-12-27 | Added multi-step/wizard form support with detection, navigation, filling, and submission |
| 2.4.0 | 2024-12-27 | Added date picker handling with support for native HTML5, jQuery UI, Bootstrap, Flatpickr, Material UI, React-datepicker, Pikaday, Air Datepicker, and Litepicker |
| 2.5.0 | 2024-12-27 | Added multi-select handling (Select2, Chosen, Bootstrap Select, Tom Select, Slim Select), user-agent rotation (25 UA strings), and rate limiting with action-specific presets |
| 2.6.0 | 2024-12-27 | Added OSINT tool handlers: HaveIBeenPwned (email/password breach check), Shodan (IP/device search), Wayback Machine (historical snapshots), WHOIS (domain/IP registration) |
| 2.7.0 | 2024-12-27 | Added Hunter.io email finder, Social Media profile lookup (10 platforms), batch command execution with queuing |
| 2.8.0 | 2024-12-27 | Added Phase 7 security: input validation, content sanitization, XSS prevention, selector/URL/script validation |
| 2.9.0 | 2024-12-27 | Added Phase 5.1 Knowledge Base: YAML parser, field mappings, tool presets (10 OSINT tools), tool chaining |
| 2.10.0 | 2024-12-27 | Added Phase 5.3 Data Pipeline: date/name/address/phone/email normalization, entity management, deduplication |
| 2.11.0 | 2024-12-27 | Added Phase 6 Agent: message schema, version negotiation, streaming responses, CAPTCHA help, approval workflows, breakpoints |
| 2.12.0 | 2024-12-27 | Added Phase 7 Security: WSS enforcement, WebSocket auth with encryption, privacy controls, local-only mode |
| 2.13.0 | 2024-12-27 | Added audit logging with privacy-aware redaction, basset-hound backend sync with offline queue and conflict resolution |
| 2.14.0 | 2024-12-27 | Added browser fingerprint randomization (Canvas, WebGL, Audio, Navigator, Screen) for authorized security testing |

---

## Success Metrics

- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing complete
- [ ] Documentation up to date
- [ ] No critical bugs

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

## Contributing

When implementing features:

1. Update command handlers in `background.js`
2. Add DOM interactions in `content.js`
3. Update CAPABILITIES list in `popup.js`
4. Add tests in `tests/`
5. Update this roadmap with completion status

---

*Last Updated: December 27, 2024*
