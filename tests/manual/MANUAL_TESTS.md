# Manual Testing Guide

This document provides step-by-step instructions for manually testing the Basset Hound Browser Automation extension.

## Prerequisites

1. Chrome or Chromium-based browser (Edge, Brave, etc.)
2. Node.js installed for running the test WebSocket server
3. Extension loaded in developer mode

## Loading the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `basset-hound-autofill-extension` folder
5. Verify the extension appears with the Basset Hound icon

## Test Categories

### 1. WebSocket Connection Tests

#### 1.1 Initial Connection
**Steps:**
1. Start the WebSocket server: `npm run test:server`
2. Load/reload the extension
3. Click the extension popup icon

**Expected:**
- Connection status shows "Connected"
- Server console shows connection message
- No errors in extension console (right-click popup > Inspect)

#### 1.2 Reconnection After Server Restart
**Steps:**
1. Ensure extension is connected
2. Stop the WebSocket server (Ctrl+C)
3. Wait 5 seconds
4. Restart the server

**Expected:**
- Popup shows "Reconnecting..." status
- Extension reconnects automatically
- Connection restored within 30 seconds

#### 1.3 Exponential Backoff
**Steps:**
1. Stop WebSocket server
2. Reload extension
3. Monitor extension background console

**Expected:**
- First retry after ~1 second
- Second retry after ~2 seconds
- Third retry after ~4 seconds
- Delays cap at 30 seconds

#### 1.4 Manual Connect/Disconnect
**Steps:**
1. Click popup, use disconnect button
2. Verify status shows "Disconnected"
3. Click connect button

**Expected:**
- Manual disconnect stops reconnection attempts
- Manual connect initiates new connection

### 2. Navigation Tests

#### 2.1 Basic Navigation
**WebSocket Command:**
```json
{
  "command_id": "nav-1",
  "type": "navigate",
  "params": {
    "url": "https://example.com"
  }
}
```

**Expected:**
- Tab navigates to specified URL
- Response includes `{"success": true}`

#### 2.2 Navigation with Wait
**WebSocket Command:**
```json
{
  "command_id": "nav-2",
  "type": "navigate",
  "params": {
    "url": "http://localhost:8080/form-test.html",
    "wait_for": "#login-form"
  }
}
```

**Expected:**
- Navigation completes
- Response includes `{"success": true}` only after element appears

#### 2.3 Invalid URL Handling
**WebSocket Command:**
```json
{
  "command_id": "nav-3",
  "type": "navigate",
  "params": {
    "url": "not-a-valid-url"
  }
}
```

**Expected:**
- Response includes `{"success": false}`
- Error message indicates invalid URL format

### 3. Form Filling Tests

#### 3.1 Basic Form Fill
**Setup:** Navigate to test page at `http://localhost:8080/form-test.html`

**WebSocket Command:**
```json
{
  "command_id": "fill-1",
  "type": "fill_form",
  "params": {
    "fields": {
      "#username": "testuser",
      "#email": "test@example.com",
      "#password": "password123"
    }
  }
}
```

**Expected:**
- All fields are filled with correct values
- Input events are triggered (reactive frameworks respond)
- Response shows all fields filled successfully

#### 3.2 Select Dropdown Fill
**WebSocket Command:**
```json
{
  "command_id": "fill-2",
  "type": "fill_select",
  "params": {
    "selector": "#country",
    "value": "us"
  }
}
```

**Expected:**
- Dropdown value changes to "us"
- Change event is triggered

#### 3.3 Checkbox Fill
**WebSocket Command:**
```json
{
  "command_id": "fill-3",
  "type": "fill_checkbox",
  "params": {
    "selector": "#agree",
    "checked": true
  }
}
```

**Expected:**
- Checkbox becomes checked
- Change event is triggered

#### 3.4 Radio Button Fill
**WebSocket Command:**
```json
{
  "command_id": "fill-4",
  "type": "fill_radio",
  "params": {
    "name": "gender",
    "value": "other"
  }
}
```

**Expected:**
- Correct radio button is selected
- Other radios in group become unselected

#### 3.5 Date Input Fill
**WebSocket Command:**
```json
{
  "command_id": "fill-5",
  "type": "fill_date",
  "params": {
    "selector": "#birthdate",
    "date": "1990-01-15"
  }
}
```

**Expected:**
- Date input shows formatted date
- Value is stored correctly

### 4. Click Tests

#### 4.1 Button Click
**WebSocket Command:**
```json
{
  "command_id": "click-1",
  "type": "click",
  "params": {
    "selector": "#submit-btn"
  }
}
```

**Expected:**
- Button click event fires
- Associated action occurs (form submit, etc.)

#### 4.2 Click with Wait
**WebSocket Command:**
```json
{
  "command_id": "click-2",
  "type": "click",
  "params": {
    "selector": "#load-more",
    "wait_after": 1000
  }
}
```

**Expected:**
- Click occurs
- Command waits 1 second before responding

#### 4.3 Click by Text
**WebSocket Command:**
```json
{
  "command_id": "click-3",
  "type": "click",
  "params": {
    "selector": "Submit Form"
  }
}
```

**Expected:**
- Button with matching text is clicked

### 5. Content Extraction Tests

#### 5.1 Get Page Content
**WebSocket Command:**
```json
{
  "command_id": "content-1",
  "type": "get_content",
  "params": {}
}
```

**Expected:**
- Response includes full page text content
- Response includes HTML content

#### 5.2 Get Specific Element Content
**WebSocket Command:**
```json
{
  "command_id": "content-2",
  "type": "get_content",
  "params": {
    "selector": "#result-container"
  }
}
```

**Expected:**
- Response includes only content from specified element

#### 5.3 Get Page State
**WebSocket Command:**
```json
{
  "command_id": "state-1",
  "type": "get_page_state",
  "params": {}
}
```

**Expected:**
- Response includes:
  - All forms with their fields
  - Links on the page
  - Buttons
  - Page metadata (title, URL)

### 6. Storage Tests

#### 6.1 Get Cookies
**WebSocket Command:**
```json
{
  "command_id": "cookie-1",
  "type": "get_cookies",
  "params": {}
}
```

**Expected:**
- Response includes all cookies for current domain
- Cookie attributes are included (name, value, domain, etc.)

#### 6.2 Set Cookies
**WebSocket Command:**
```json
{
  "command_id": "cookie-2",
  "type": "set_cookies",
  "params": {
    "cookies": [
      {
        "name": "test_cookie",
        "value": "test_value",
        "url": "http://localhost:8080"
      }
    ]
  }
}
```

**Expected:**
- Cookie is created
- Can be verified in DevTools > Application > Cookies

#### 6.3 Get LocalStorage
**Setup:** Navigate to test page and add some localStorage

**WebSocket Command:**
```json
{
  "command_id": "ls-1",
  "type": "get_local_storage",
  "params": {}
}
```

**Expected:**
- All localStorage items are returned
- JSON values are parsed

#### 6.4 Set LocalStorage
**WebSocket Command:**
```json
{
  "command_id": "ls-2",
  "type": "set_local_storage",
  "params": {
    "items": {
      "user_prefs": {"theme": "dark"},
      "session_id": "abc123"
    }
  }
}
```

**Expected:**
- Items are stored in localStorage
- Objects are stringified correctly

#### 6.5 Clear Storage
**WebSocket Command:**
```json
{
  "command_id": "clear-1",
  "type": "clear_storage",
  "params": {
    "types": ["localStorage", "sessionStorage", "cookies"]
  }
}
```

**Expected:**
- All specified storage types are cleared
- Response shows count of cleared items

### 7. Network Monitoring Tests

#### 7.1 Start Network Capture
**WebSocket Command:**
```json
{
  "command_id": "net-1",
  "type": "start_network_capture",
  "params": {}
}
```

**Expected:**
- Network capture begins
- Response confirms capture started

#### 7.2 Get Network Log
**Steps:**
1. Start network capture
2. Navigate to a page / trigger XHR requests
3. Get network log

**WebSocket Command:**
```json
{
  "command_id": "net-2",
  "type": "get_network_log",
  "params": {}
}
```

**Expected:**
- All captured requests are returned
- Request details include URL, method, headers, timing

#### 7.3 Stop Network Capture
**WebSocket Command:**
```json
{
  "command_id": "net-3",
  "type": "stop_network_capture",
  "params": {
    "exportHAR": true
  }
}
```

**Expected:**
- Capture stops
- HAR export is included if requested

### 8. Request Interception Tests

#### 8.1 Block URLs
**WebSocket Command:**
```json
{
  "command_id": "block-1",
  "type": "block_urls",
  "params": {
    "patterns": ["*analytics*", "*tracking*"]
  }
}
```

**Expected:**
- Matching requests are blocked
- Blocked requests return network error

#### 8.2 Unblock URLs
**WebSocket Command:**
```json
{
  "command_id": "unblock-1",
  "type": "unblock_urls",
  "params": {
    "clearAll": true
  }
}
```

**Expected:**
- All block rules are removed
- Requests proceed normally

### 9. Screenshot Tests

#### 9.1 Capture PNG Screenshot
**WebSocket Command:**
```json
{
  "command_id": "ss-1",
  "type": "screenshot",
  "params": {
    "format": "png"
  }
}
```

**Expected:**
- Response includes base64 encoded PNG
- Image represents current visible tab

#### 9.2 Capture JPEG with Quality
**WebSocket Command:**
```json
{
  "command_id": "ss-2",
  "type": "screenshot",
  "params": {
    "format": "jpeg",
    "quality": 70
  }
}
```

**Expected:**
- Response includes base64 encoded JPEG
- File size is smaller than PNG

### 10. Script Execution Tests

#### 10.1 Execute Simple Script
**WebSocket Command:**
```json
{
  "command_id": "script-1",
  "type": "execute_script",
  "params": {
    "script": "return document.title"
  }
}
```

**Expected:**
- Script executes in page context
- Result is returned

#### 10.2 Execute DOM Manipulation
**WebSocket Command:**
```json
{
  "command_id": "script-2",
  "type": "execute_script",
  "params": {
    "script": "document.body.style.backgroundColor = 'red'; return 'done'"
  }
}
```

**Expected:**
- Page background changes
- Script result is returned

### 11. Wait for Element Tests

#### 11.1 Wait for Existing Element
**WebSocket Command:**
```json
{
  "command_id": "wait-1",
  "type": "wait_for_element",
  "params": {
    "selector": "body"
  }
}
```

**Expected:**
- Response returns immediately
- `found: true` in response

#### 11.2 Wait for Dynamic Element
**Steps:**
1. Navigate to page that loads content dynamically
2. Send wait command before content appears

**WebSocket Command:**
```json
{
  "command_id": "wait-2",
  "type": "wait_for_element",
  "params": {
    "selector": "#dynamic-content",
    "timeout": 10000
  }
}
```

**Expected:**
- Command waits until element appears
- Response returns when found or timeout

### 12. Error Handling Tests

#### 12.1 Missing Required Parameter
**WebSocket Command:**
```json
{
  "command_id": "err-1",
  "type": "navigate",
  "params": {}
}
```

**Expected:**
- Response includes `{"success": false}`
- Error message indicates missing URL

#### 12.2 Invalid Selector
**WebSocket Command:**
```json
{
  "command_id": "err-2",
  "type": "click",
  "params": {
    "selector": "::invalid::selector::"
  }
}
```

**Expected:**
- Response includes `{"success": false}`
- Error message is descriptive

#### 12.3 Element Not Found
**WebSocket Command:**
```json
{
  "command_id": "err-3",
  "type": "click",
  "params": {
    "selector": "#element-that-does-not-exist"
  }
}
```

**Expected:**
- Response includes element not found error

## Test Result Recording

For each test, record:

| Test ID | Test Name | Result | Notes |
|---------|-----------|--------|-------|
| 1.1 | Initial Connection | PASS/FAIL | |
| 1.2 | Reconnection | PASS/FAIL | |
| ... | ... | ... | ... |

## Common Issues

### Extension Not Connecting
1. Verify WebSocket server is running on port 8765
2. Check browser console for connection errors
3. Verify no firewall blocking the port

### Form Filling Not Working
1. Check if page uses Shadow DOM (not supported)
2. Verify selectors are correct
3. Check content script is injected (view in DevTools > Sources)

### Commands Timing Out
1. Increase timeout in command params
2. Check network connectivity
3. Verify page has finished loading

## Reporting Bugs

When reporting issues, include:
1. Extension version
2. Browser version
3. Command that failed (full JSON)
4. Error message from response
5. Console errors (background + content scripts)
6. Screenshots if applicable
