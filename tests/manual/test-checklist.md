# Manual Testing Checklist

This document provides a comprehensive checklist for manual testing of the Basset Hound Browser Automation Extension.

## Pre-Testing Requirements

### Environment Setup

- [ ] Chrome browser installed (latest version recommended)
- [ ] Extension loaded in developer mode
- [ ] Backend WebSocket server running (if testing with backend)
- [ ] Test pages available (see `test-pages/` directory)
- [ ] DevTools open for extension (chrome://extensions > Service Worker)

### Extension Loading

1. Navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the extension directory
5. Verify extension appears in toolbar

---

## Test Categories

### 1. Extension Installation and Startup

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| EXT-001 | Load extension | Load unpacked extension | No errors, icon appears in toolbar | [ ] Pass [ ] Fail |
| EXT-002 | Manifest validation | Check chrome://extensions | Version, permissions displayed correctly | [ ] Pass [ ] Fail |
| EXT-003 | Service worker initialization | Open Service Worker DevTools | "Background service worker initialized" logged | [ ] Pass [ ] Fail |
| EXT-004 | Popup opens | Click extension icon | Popup displays with status | [ ] Pass [ ] Fail |

### 2. WebSocket Connection

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| WS-001 | Connect to server | Start server, click Connect | Status: Connected (green) | [ ] Pass [ ] Fail |
| WS-002 | Auto-connect on install | Fresh install with server running | Auto-connects within 5 seconds | [ ] Pass [ ] Fail |
| WS-003 | Disconnect manually | Click Disconnect button | Status: Disconnected, no reconnect attempts | [ ] Pass [ ] Fail |
| WS-004 | Reconnect on server restart | Stop then start server | Extension reconnects automatically | [ ] Pass [ ] Fail |
| WS-005 | Max reconnect attempts | Keep server off, wait | Status: Failed after 10 attempts | [ ] Pass [ ] Fail |
| WS-006 | Exponential backoff | Monitor reconnect delays | 1s, 2s, 4s, 8s, 16s, 30s (max) | [ ] Pass [ ] Fail |

### 3. Navigation Commands

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| NAV-001 | Navigate to URL | Send navigate command | Page loads, success response | [ ] Pass [ ] Fail |
| NAV-002 | Navigate with wait_for | Send navigate with selector | Wait until element appears | [ ] Pass [ ] Fail |
| NAV-003 | Invalid URL | Send invalid URL | Error response returned | [ ] Pass [ ] Fail |
| NAV-004 | Navigation timeout | Wait for non-existent element | Timeout error after specified time | [ ] Pass [ ] Fail |
| NAV-005 | Create new tab | Navigate when no active tab | New tab created with URL | [ ] Pass [ ] Fail |

### 4. Form Filling

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| FORM-001 | Fill text input | Send fill_form with text field | Field contains value | [ ] Pass [ ] Fail |
| FORM-002 | Fill email input | Send fill_form with email field | Valid email filled | [ ] Pass [ ] Fail |
| FORM-003 | Fill password input | Send fill_form with password field | Password filled (masked) | [ ] Pass [ ] Fail |
| FORM-004 | Fill select dropdown | Send fill_form with select | Option selected | [ ] Pass [ ] Fail |
| FORM-005 | Fill checkbox | Send fill_checkbox command | Checkbox checked/unchecked | [ ] Pass [ ] Fail |
| FORM-006 | Fill radio button | Send fill_radio command | Radio button selected | [ ] Pass [ ] Fail |
| FORM-007 | Fill date input | Send fill_date command | Date value set | [ ] Pass [ ] Fail |
| FORM-008 | Fill textarea | Send fill_form with textarea | Text content filled | [ ] Pass [ ] Fail |
| FORM-009 | Fill multiple fields | Send fill_form with multiple fields | All fields filled correctly | [ ] Pass [ ] Fail |
| FORM-010 | Submit form | Send fill_form with submit: true | Form submits | [ ] Pass [ ] Fail |
| FORM-011 | Non-existent field | Send fill_form with invalid selector | Error reported for that field | [ ] Pass [ ] Fail |
| FORM-012 | Human-like typing | Use humanLike: true option | Character-by-character typing visible | [ ] Pass [ ] Fail |

### 5. Click Commands

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| CLICK-001 | Click button | Send click command | Button clicked, action triggered | [ ] Pass [ ] Fail |
| CLICK-002 | Click link | Send click on anchor | Navigation occurs | [ ] Pass [ ] Fail |
| CLICK-003 | Click by text | Send click with text selector | Element found and clicked | [ ] Pass [ ] Fail |
| CLICK-004 | Click with wait | Send click with wait_after | Waits after clicking | [ ] Pass [ ] Fail |
| CLICK-005 | Click off-screen element | Click element below fold | Element scrolled into view then clicked | [ ] Pass [ ] Fail |
| CLICK-006 | Non-existent element | Click invalid selector | Error response | [ ] Pass [ ] Fail |

### 6. Content Extraction

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| GET-001 | Get body content | Send get_content (no selector) | Returns page text and HTML | [ ] Pass [ ] Fail |
| GET-002 | Get specific element | Send get_content with selector | Returns element content | [ ] Pass [ ] Fail |
| GET-003 | Get page state | Send get_page_state | Returns forms, links, buttons | [ ] Pass [ ] Fail |
| GET-004 | Page state with forms | Run on page with forms | Form fields extracted with details | [ ] Pass [ ] Fail |
| GET-005 | Password masking | Get page state with password field | Password value shows [hidden] | [ ] Pass [ ] Fail |

### 7. Screenshot Capture

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| SHOT-001 | Capture PNG | Send screenshot (PNG) | Base64 image returned | [ ] Pass [ ] Fail |
| SHOT-002 | Capture JPEG | Send screenshot (JPEG) | Base64 JPEG returned | [ ] Pass [ ] Fail |
| SHOT-003 | Quality setting | Screenshot with quality: 50 | Smaller file size | [ ] Pass [ ] Fail |
| SHOT-004 | Invalid format | Screenshot with format: gif | Error response | [ ] Pass [ ] Fail |

### 8. Wait For Element

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| WAIT-001 | Element exists | Wait for existing element | Immediate success | [ ] Pass [ ] Fail |
| WAIT-002 | Element appears | Wait for dynamic element | Success when element appears | [ ] Pass [ ] Fail |
| WAIT-003 | Timeout | Wait for non-existent, short timeout | Timeout error | [ ] Pass [ ] Fail |

### 9. Script Execution

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| EXEC-001 | Get document title | execute_script: "document.title" | Returns page title | [ ] Pass [ ] Fail |
| EXEC-002 | Modify DOM | execute_script to change element | DOM modified | [ ] Pass [ ] Fail |
| EXEC-003 | Return complex object | execute_script returning object | Object serialized correctly | [ ] Pass [ ] Fail |
| EXEC-004 | Script error | execute_script with syntax error | Error message returned | [ ] Pass [ ] Fail |

### 10. Cookie Management

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| COOK-001 | Get all cookies | Send get_cookies | List of cookies returned | [ ] Pass [ ] Fail |
| COOK-002 | Get cookies by domain | get_cookies with domain filter | Filtered cookies returned | [ ] Pass [ ] Fail |
| COOK-003 | Set cookie | Send set_cookies | Cookie created | [ ] Pass [ ] Fail |
| COOK-004 | Delete cookie | Clear storage with cookies type | Cookies removed | [ ] Pass [ ] Fail |

### 11. Storage Operations

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| STOR-001 | Get localStorage | Send get_local_storage | Storage items returned | [ ] Pass [ ] Fail |
| STOR-002 | Set localStorage | Send set_local_storage | Items stored | [ ] Pass [ ] Fail |
| STOR-003 | Get sessionStorage | Send get_session_storage | Session items returned | [ ] Pass [ ] Fail |
| STOR-004 | Set sessionStorage | Send set_session_storage | Items stored | [ ] Pass [ ] Fail |
| STOR-005 | Clear all storage | Send clear_storage | All storage cleared | [ ] Pass [ ] Fail |

### 12. Network Monitoring

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| NET-001 | Start capture | Send start_network_capture | Capture started | [ ] Pass [ ] Fail |
| NET-002 | Capture requests | Make network requests | Requests logged | [ ] Pass [ ] Fail |
| NET-003 | Stop capture | Send stop_network_capture | Capture stopped, log returned | [ ] Pass [ ] Fail |
| NET-004 | Filter by URL | Get log with URL filter | Filtered results | [ ] Pass [ ] Fail |
| NET-005 | Export HAR | Get log with exportHAR: true | Valid HAR format | [ ] Pass [ ] Fail |

### 13. Request Interception

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| INT-001 | Block URL | Add block rule | Matching requests blocked | [ ] Pass [ ] Fail |
| INT-002 | Modify headers | Add header rule | Headers modified | [ ] Pass [ ] Fail |
| INT-003 | Redirect URL | Add redirect rule | Requests redirected | [ ] Pass [ ] Fail |
| INT-004 | Remove rules | Remove interception rules | Rules removed | [ ] Pass [ ] Fail |

### 14. Multi-Step Forms

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| MULTI-001 | Detect multi-step | Send get_multi_step_info | Form structure detected | [ ] Pass [ ] Fail |
| MULTI-002 | Navigate next | Send navigate_multi_step (next) | Advances to next step | [ ] Pass [ ] Fail |
| MULTI-003 | Navigate prev | Send navigate_multi_step (prev) | Returns to previous step | [ ] Pass [ ] Fail |

### 15. Error Handling

| Test ID | Description | Steps | Expected Result | Status |
|---------|-------------|-------|-----------------|--------|
| ERR-001 | Missing command_id | Send command without command_id | Error logged, no response | [ ] Pass [ ] Fail |
| ERR-002 | Unknown command type | Send unknown command type | Error response with message | [ ] Pass [ ] Fail |
| ERR-003 | Missing parameters | Send command without required params | Descriptive error | [ ] Pass [ ] Fail |
| ERR-004 | Content script error | Cause error in content script | Error captured and returned | [ ] Pass [ ] Fail |

---

## Test Execution Record

### Test Run Information

- **Date**: _______________
- **Tester**: _______________
- **Chrome Version**: _______________
- **Extension Version**: _______________
- **Backend Version**: _______________
- **OS**: _______________

### Summary

| Category | Total Tests | Passed | Failed | Skipped |
|----------|-------------|--------|--------|---------|
| Extension Setup | 4 | | | |
| WebSocket | 6 | | | |
| Navigation | 5 | | | |
| Form Filling | 12 | | | |
| Click Commands | 6 | | | |
| Content Extraction | 5 | | | |
| Screenshot | 4 | | | |
| Wait For Element | 3 | | | |
| Script Execution | 4 | | | |
| Cookie Management | 4 | | | |
| Storage Operations | 5 | | | |
| Network Monitoring | 5 | | | |
| Request Interception | 4 | | | |
| Multi-Step Forms | 3 | | | |
| Error Handling | 4 | | | |
| **Total** | 74 | | | |

### Issues Found

| Issue # | Test ID | Description | Severity | Status |
|---------|---------|-------------|----------|--------|
| | | | | |
| | | | | |
| | | | | |

### Notes

_Additional observations, environment issues, or recommendations:_

---

## Appendix: Test Commands

### Example WebSocket Commands

```json
// Navigate
{
  "command_id": "test-nav-1",
  "type": "navigate",
  "params": { "url": "https://example.com" }
}

// Fill Form
{
  "command_id": "test-form-1",
  "type": "fill_form",
  "params": {
    "fields": {
      "#username": "testuser",
      "#password": "password123"
    },
    "submit": false
  }
}

// Click
{
  "command_id": "test-click-1",
  "type": "click",
  "params": { "selector": "#submit-btn" }
}

// Get Page State
{
  "command_id": "test-state-1",
  "type": "get_page_state",
  "params": {}
}

// Screenshot
{
  "command_id": "test-shot-1",
  "type": "screenshot",
  "params": { "format": "png", "quality": 100 }
}
```

### Quick Test Script

```bash
# Start test server
cd tests/manual/test-pages
python3 -m http.server 8080

# Connect with wscat
npm install -g wscat
wscat -c ws://localhost:8765/browser
```
