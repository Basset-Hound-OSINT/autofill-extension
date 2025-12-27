# Basset Hound Browser Automation Extension - Testing Guide

This document covers testing procedures, test cases, and quality assurance practices.

## Table of Contents

- [Testing Overview](#testing-overview)
- [Running Tests](#running-tests)
- [Test Coverage Requirements](#test-coverage-requirements)
- [Test Suite Structure](#test-suite-structure)
- [Manual Testing](#manual-testing)
- [Test Cases](#test-cases)
- [WebSocket Testing](#websocket-testing)
- [Integration Testing](#integration-testing)
- [Performance Testing](#performance-testing)
- [Security Testing](#security-testing)
- [Test Environment Setup](#test-environment-setup)

## Testing Overview

### Testing Levels

1. **Unit Testing**: Individual function testing with Jest (automated)
2. **Integration Testing**: Component interaction testing with Jest (automated)
3. **End-to-End Testing**: Full workflow testing with backend
4. **Manual Testing**: UI and interaction testing

### Testing Tools

- **Jest**: Primary testing framework for unit and integration tests
- **Chrome API Mocks**: Custom mocks for Chrome extension APIs
- **WebSocket Mocks**: Mock WebSocket for connection testing
- Chrome DevTools (primary debugging tool)
- WebSocket testing tools (wscat, Postman)
- Simple HTTP server for test pages
- Browser console for content script testing

## Running Tests

### Prerequisites

Ensure you have Node.js 16+ installed and run:

```bash
npm install
```

### Available Test Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all unit tests |
| `npm run test:all` | Run all unit and integration tests |
| `npm run test:unit` | Run only unit tests |
| `npm run test:integration` | Run only integration tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:manual` | Start server for manual test pages |

### Quick Start

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run specific test file
npx jest tests/unit/logger.test.js

# Run tests matching a pattern
npx jest --testNamePattern="Logger"
```

### Viewing Coverage Reports

After running `npm run test:coverage`, open the HTML report:

```bash
open coverage/lcov-report/index.html
```

## Test Coverage Requirements

The project enforces minimum coverage thresholds:

| Metric | Minimum |
|--------|---------|
| Branches | 60% |
| Functions | 60% |
| Lines | 60% |
| Statements | 60% |

Tests will fail if coverage falls below these thresholds.

## Test Suite Structure

```
tests/
├── mocks/                    # Mock implementations
│   ├── chrome-api.mock.js    # Chrome extension API mocks
│   └── websocket.mock.js     # WebSocket mocks
├── helpers/                  # Test utilities
│   ├── setup.js              # Jest setup and global mocks
│   └── assertions.js         # Custom assertion functions
├── unit/                     # Unit tests
│   ├── logger.test.js        # Logger utility tests
│   ├── network-monitor.test.js   # Network monitoring tests
│   └── request-interceptor.test.js # Request interception tests
├── integration/              # Integration tests
│   ├── websocket.test.js     # WebSocket connection tests
│   ├── commands.test.js      # Command handling tests
│   └── content-script.test.js # Content script DOM tests
└── manual/                   # Manual testing resources
    ├── test-checklist.md     # Manual testing checklist
    └── test-pages/           # HTML test pages
        ├── login-form.html
        ├── registration-form.html
        ├── dynamic-content.html
        └── multi-step-form.html
```

### Unit Tests

Unit tests focus on individual modules in isolation:

- **logger.test.js**: Tests log levels, context management, child loggers, and storage persistence
- **network-monitor.test.js**: Tests request capture, filtering, HAR export, and statistics
- **background.test.js**: Tests WebSocket connection management, command handlers, reconnection logic, response formatting, and task queue management
- **content.test.js**: Tests element finding, selector generation, label finding, form filling, click handling, wait for element, storage operations, and DOM utilities

### Integration Tests

Integration tests verify component interactions:

- **websocket.test.js**: Tests connection lifecycle, heartbeat, reconnection with backoff
- **commands.test.js**: Tests command routing, parameter validation, response formatting
- **content-script.test.js**: Tests element finding, form filling, click handling, DOM operations

### Writing New Tests

Use the provided mocks and helpers:

```javascript
const { createChromeMock, setupChromeMock } = require('../mocks/chrome-api.mock');
const { MockWebSocket } = require('../mocks/websocket.mock');
const { assertMessageSent, assertFormFilled } = require('../helpers/assertions');

describe('MyFeature', () => {
  beforeEach(() => {
    setupChromeMock();
  });

  test('should do something', () => {
    // Arrange
    const mockSocket = new MockWebSocket('ws://localhost:8765');

    // Act
    // ... perform actions

    // Assert
    assertMessageSent({ type: 'expected_message' });
  });
});
```

### Custom Assertions

The `assertions.js` helper provides extension-specific assertions:

```javascript
// Check if a Chrome runtime message was sent
assertMessageSent({ type: 'command', action: 'navigate' });

// Check if a tab received a message
assertTabMessageSent(123, { type: 'fill_form' });

// Check if storage was updated
assertStorageSet('local', 'key', expectedValue);

// Check if form was filled correctly
assertFormFilled('#form', { '#username': 'testuser' });

// Check if WebSocket message was sent
assertWebSocketMessageSent(socket, { command_id: 'test-1' });
```

## Manual Testing Procedures

### Starting Manual Test Pages

```bash
# Start the test page server
npm run test:manual

# Opens at http://localhost:8080
```

### Available Test Pages

| Page | URL | Purpose |
|------|-----|---------|
| Index | `/index.html` | Test page index with links to all test pages |
| Form Test | `/form-test.html` | Comprehensive form testing with login, registration, address forms |
| Navigation Test | `/navigation-test.html` | Click handling, modals, tabs, accordions, dropdowns |
| Storage Test | `/storage-test.html` | Cookie, localStorage, sessionStorage testing |

The test pages are located in `tests/manual/test-pages/` and include:

- **form-test.html**: Login form, registration form with all input types (text, email, date, phone, select, checkbox, radio, textarea), address form, file upload, number/range inputs, hidden fields, and dynamic form loading
- **navigation-test.html**: Navigation links, click counter, various clickable elements (by ID, data-testid, aria-label, role="button"), button states, modal dialogs, tab navigation, accordions, dropdown menus, breadcrumbs, async content loading
- **storage-test.html**: Cookie management, localStorage operations, sessionStorage operations, complex JSON storage, bulk operations, and cross-tab storage events

### Manual Testing Checklist

See `tests/manual/test-checklist.md` for a comprehensive checklist with 74 test cases covering:

- Extension installation and startup
- WebSocket connection
- Navigation commands
- Form filling
- Click commands
- Content extraction
- Screenshot capture
- Wait for element
- Script execution
- Cookie management
- Storage operations
- Network monitoring
- Request interception
- Multi-step forms
- Error handling

## Manual Testing

### Pre-Testing Checklist

- [ ] Extension loaded in Chrome
- [ ] Developer mode enabled
- [ ] Service worker DevTools open
- [ ] Backend server running (if needed)
- [ ] Test pages prepared

### Basic Functionality Tests

#### 1. Extension Loading

| Step | Expected Result |
|------|-----------------|
| Load extension | No errors in extensions page |
| Check manifest | Version displayed correctly |
| Check icons | All icons visible |
| Open popup | Popup opens without errors |

#### 2. Popup UI Tests

| Step | Expected Result |
|------|-----------------|
| Open popup | Shows "Disconnected" status |
| Click Connect | Status changes to "Connecting..." |
| After connection | Status shows "Connected" (green dot) |
| Click Disconnect | Status shows "Disconnected" |
| Click Refresh | Status updates |
| Click Clear History | Task list empties |

#### 3. WebSocket Connection Tests

| Step | Expected Result |
|------|-----------------|
| Start without server | Reconnection attempts logged |
| Start server | Auto-connects within delay |
| Stop server | Detects disconnect, starts reconnecting |
| Max attempts reached | Shows "Failed" status |
| Click Connect after failed | Resets attempts, tries again |

## Test Cases

### TC-001: Navigate Command

**Purpose**: Verify navigation to URLs works correctly

**Prerequisites**:
- Extension connected to backend
- Active tab available

**Test Steps**:

1. Send navigate command:
```json
{
  "command_id": "tc001-1",
  "type": "navigate",
  "params": {
    "url": "https://example.com"
  }
}
```

2. Verify response:
```json
{
  "command_id": "tc001-1",
  "success": true,
  "result": {
    "url": "https://example.com",
    "loaded": true,
    "tabId": "<number>"
  }
}
```

3. Verify tab shows example.com

**Edge Cases**:
- Invalid URL format (should return error)
- No active tab (should create new tab)
- Navigation with wait_for element
- Navigation timeout

---

### TC-002: Form Filling

**Purpose**: Verify form fields can be filled correctly

**Prerequisites**:
- Navigate to a page with a form
- Extension connected

**Test Steps**:

1. Navigate to test form page
2. Send fill_form command:
```json
{
  "command_id": "tc002-1",
  "type": "fill_form",
  "params": {
    "fields": {
      "#username": "testuser",
      "#email": "test@example.com",
      "#password": "password123"
    },
    "submit": false
  }
}
```

3. Verify each field contains correct value
4. Verify response shows all fields filled successfully

**Edge Cases**:
- Non-existent selector (should report in results)
- Disabled field (should skip)
- Select dropdown
- Checkbox/radio buttons
- Contenteditable element

---

### TC-003: Click Command

**Purpose**: Verify element clicking works

**Prerequisites**:
- Page with clickable elements
- Extension connected

**Test Steps**:

1. Navigate to page with button
2. Send click command:
```json
{
  "command_id": "tc003-1",
  "type": "click",
  "params": {
    "selector": "#submit-button",
    "wait_after": 500
  }
}
```

3. Verify button was clicked (visual change, form submission, etc.)
4. Verify response indicates success

**Edge Cases**:
- Button not visible (should scroll into view)
- Button by text content ("Submit")
- Link clicking
- Element not found

---

### TC-004: Get Content

**Purpose**: Verify content extraction

**Test Steps**:

1. Navigate to content-rich page
2. Send get_content command:
```json
{
  "command_id": "tc004-1",
  "type": "get_content",
  "params": {
    "selector": "body"
  }
}
```

3. Verify response contains:
   - Text content
   - HTML content
   - Selector used

**Edge Cases**:
- Specific selector
- No selector (defaults to body)
- Non-existent selector

---

### TC-005: Screenshot Capture

**Purpose**: Verify screenshot functionality

**Test Steps**:

1. Navigate to any page
2. Send screenshot command:
```json
{
  "command_id": "tc005-1",
  "type": "screenshot",
  "params": {
    "format": "png",
    "quality": 100
  }
}
```

3. Verify response contains base64 data URL
4. Verify image can be decoded

**Edge Cases**:
- JPEG format with quality setting
- Page with restricted content (may fail)

---

### TC-006: Wait for Element

**Purpose**: Verify element waiting functionality

**Test Steps**:

1. Navigate to page with dynamic content
2. Send wait_for_element command before element appears:
```json
{
  "command_id": "tc006-1",
  "type": "wait_for_element",
  "params": {
    "selector": ".dynamic-content",
    "timeout": 10000
  }
}
```

3. Trigger the element to appear
4. Verify response indicates element found

**Edge Cases**:
- Element already exists (immediate return)
- Element never appears (timeout)
- Short timeout

---

### TC-007: Get Page State

**Purpose**: Verify comprehensive page state extraction

**Test Steps**:

1. Navigate to page with forms, links, buttons
2. Send get_page_state command:
```json
{
  "command_id": "tc007-1",
  "type": "get_page_state",
  "params": {}
}
```

3. Verify response contains:
   - Current URL and title
   - Forms with all fields
   - Links (up to 100)
   - Buttons
   - Standalone inputs
   - Meta information

**Edge Cases**:
- Page with no forms
- Page with many links (should limit to 100)
- Password fields (should be masked)

---

### TC-008: Execute Script

**Purpose**: Verify custom script execution

**Test Steps**:

1. Navigate to any page
2. Send execute_script command:
```json
{
  "command_id": "tc008-1",
  "type": "execute_script",
  "params": {
    "script": "document.title"
  }
}
```

3. Verify response contains page title

**Edge Cases**:
- Script with syntax error
- Script that throws error
- Script that modifies DOM
- Script that returns complex object

---

### TC-009: Selector Strategies

**Purpose**: Verify all selector finding strategies work

**Test Page Setup**:
```html
<form>
  <input id="byId" type="text">
  <input name="byName" type="text">
  <input data-testid="byTestId" type="text">
  <input aria-label="By Aria Label" type="text">
  <input placeholder="By Placeholder" type="text">
  <label for="byLabel">By Label</label>
  <input id="byLabel" type="text">
  <button>Click Me</button>
</form>
```

**Test Steps**:

Test each selector strategy:

| Strategy | Selector to Use | Expected Element |
|----------|-----------------|------------------|
| ID | `#byId` | First input |
| ID (short) | `byId` | First input |
| Name | `[name="byName"]` | Second input |
| Name (short) | `byName` | Second input |
| Test ID | `[data-testid="byTestId"]` | Third input |
| Test ID (short) | `byTestId` | Third input |
| Aria Label | `By Aria Label` | Fourth input |
| Placeholder | `By Placeholder` | Fifth input |
| Label | `By Label` | Sixth input |
| Text | `Click Me` | Button |

---

### TC-010: Reconnection Logic

**Purpose**: Verify reconnection with exponential backoff

**Test Steps**:

1. Start extension without backend server
2. Observe console logs for reconnection attempts
3. Verify delays follow pattern: 1s, 2s, 4s, 8s, 16s, 30s (max)
4. After 10 attempts, verify status shows "Failed"
5. Start backend server
6. Click "Connect" in popup
7. Verify connection established

---

### TC-011: Task Queue Management

**Purpose**: Verify task tracking and cleanup

**Test Steps**:

1. Connect to backend
2. Send multiple commands rapidly
3. Open popup and verify:
   - Running tasks shown
   - Completed tasks shown with duration
   - Failed tasks shown with error
4. Wait 5+ minutes
5. Verify old completed tasks are cleaned up
6. Verify max 50 tasks retained

---

### TC-012: Error Handling

**Purpose**: Verify all error conditions are handled gracefully

**Test Cases**:

| Scenario | Expected Behavior |
|----------|-------------------|
| Invalid command_id (missing) | Log error, no response |
| Invalid command type | Return error response |
| Missing required parameter | Return error response |
| Content script not loaded | Inject and retry |
| WebSocket disconnect during command | Error logged, reconnect attempted |
| Command timeout | Return timeout error |
| DOM element not found | Return error in result |
| Script execution error | Return error message |

## WebSocket Testing

### Using wscat

Install wscat:
```bash
npm install -g wscat
```

Connect to server (pretend to be extension):
```bash
wscat -c ws://localhost:8765/browser
```

Send test commands:
```json
{"command_id":"test-1","type":"get_page_state","params":{}}
```

### Using Python

```python
import asyncio
import websockets
import json

async def test_extension():
    uri = "ws://localhost:8765/browser"
    async with websockets.connect(uri) as websocket:
        # Send command
        command = {
            "command_id": "test-1",
            "type": "get_page_state",
            "params": {}
        }
        await websocket.send(json.dumps(command))

        # Receive response
        response = await websocket.recv()
        print(json.loads(response))

asyncio.run(test_extension())
```

### Mock WebSocket Server

For testing without the real backend:

```python
import asyncio
import websockets
import json

async def echo(websocket, path):
    async for message in websocket:
        data = json.loads(message)
        print(f"Received: {data}")

        # Echo back as success response
        response = {
            "command_id": data.get("command_id"),
            "success": True,
            "result": {"echo": data},
            "error": None,
            "timestamp": 1234567890
        }
        await websocket.send(json.dumps(response))

async def main():
    async with websockets.serve(echo, "localhost", 8765):
        await asyncio.Future()  # Run forever

asyncio.run(main())
```

## Integration Testing

### Full Workflow Test

**Scenario**: Automate login form

1. Start backend server
2. Load extension
3. Send commands in sequence:

```python
commands = [
    {
        "command_id": "login-1",
        "type": "navigate",
        "params": {"url": "https://example.com/login"}
    },
    {
        "command_id": "login-2",
        "type": "wait_for_element",
        "params": {"selector": "#loginForm"}
    },
    {
        "command_id": "login-3",
        "type": "fill_form",
        "params": {
            "fields": {
                "#username": "testuser",
                "#password": "testpass"
            }
        }
    },
    {
        "command_id": "login-4",
        "type": "click",
        "params": {"selector": "#submitBtn", "wait_after": 2000}
    },
    {
        "command_id": "login-5",
        "type": "get_page_state",
        "params": {}
    }
]
```

4. Verify each command succeeds
5. Verify final state shows logged-in page

## Performance Testing

### Metrics to Monitor

- Command execution time
- WebSocket message latency
- Memory usage over time
- Task queue size

### Load Testing

```python
import asyncio
import websockets
import json
import time

async def load_test(num_commands=100):
    uri = "ws://localhost:8765/browser"
    async with websockets.connect(uri) as websocket:
        start = time.time()

        for i in range(num_commands):
            command = {
                "command_id": f"load-{i}",
                "type": "get_page_state",
                "params": {}
            }
            await websocket.send(json.dumps(command))
            response = await websocket.recv()

        duration = time.time() - start
        print(f"{num_commands} commands in {duration:.2f}s")
        print(f"Average: {duration/num_commands*1000:.2f}ms per command")

asyncio.run(load_test())
```

## Security Testing

### Input Validation Tests

| Test | Input | Expected |
|------|-------|----------|
| SQL Injection in selector | `'; DROP TABLE--` | Safely escaped |
| XSS in selector | `<script>alert(1)</script>` | Safely escaped |
| Path traversal | `../../../etc/passwd` | No file access |
| Command injection | `$(rm -rf /)` | Treated as literal |

### Permission Tests

| Test | Expected |
|------|----------|
| Access chrome:// URLs | Should fail |
| Access file:// URLs | Should fail (unless permitted) |
| Access extension pages | Should fail |
| Cross-origin requests | Blocked by CORS |

### WebSocket Security

| Test | Expected |
|------|----------|
| Connect from external origin | Should fail (localhost only) |
| Invalid JSON message | Logged, no crash |
| Oversized message | Handled gracefully |
| Rapid reconnection attempts | Rate limited by backoff |

## Test Environment Setup

### Local Test Page Server

```python
# test_server.py
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

os.chdir('test-pages')
server = HTTPServer(('localhost', 8080), SimpleHTTPRequestHandler)
print("Test server running at http://localhost:8080")
server.serve_forever()
```

### Sample Test Pages

Create `test-pages/form.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Test Form</title>
</head>
<body>
    <h1>Test Form</h1>
    <form id="testForm">
        <div>
            <label for="username">Username:</label>
            <input type="text" id="username" name="username" required>
        </div>
        <div>
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" required>
        </div>
        <div>
            <label for="password">Password:</label>
            <input type="password" id="password" name="password" required>
        </div>
        <div>
            <label for="country">Country:</label>
            <select id="country" name="country">
                <option value="">Select...</option>
                <option value="US">United States</option>
                <option value="UK">United Kingdom</option>
                <option value="CA">Canada</option>
            </select>
        </div>
        <div>
            <label>
                <input type="checkbox" id="terms" name="terms">
                Accept Terms
            </label>
        </div>
        <button type="submit" id="submitBtn">Submit</button>
    </form>

    <script>
        document.getElementById('testForm').onsubmit = function(e) {
            e.preventDefault();
            alert('Form submitted!');
        };
    </script>
</body>
</html>
```

Create `test-pages/dynamic.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Dynamic Content Test</title>
</head>
<body>
    <h1>Dynamic Content Test</h1>
    <button id="loadContent" onclick="loadContent()">Load Content</button>
    <div id="container"></div>

    <script>
        function loadContent() {
            setTimeout(() => {
                document.getElementById('container').innerHTML =
                    '<div class="dynamic-content">Loaded dynamically!</div>';
            }, 2000);
        }
    </script>
</body>
</html>
```

### Test Checklist Template

```markdown
## Test Run: [Date]

### Environment
- Chrome Version: ___
- Extension Version: ___
- Backend Version: ___
- OS: ___

### Test Results

| Test ID | Test Name | Status | Notes |
|---------|-----------|--------|-------|
| TC-001 | Navigate | [ ] Pass [ ] Fail | |
| TC-002 | Form Filling | [ ] Pass [ ] Fail | |
| TC-003 | Click | [ ] Pass [ ] Fail | |
| TC-004 | Get Content | [ ] Pass [ ] Fail | |
| TC-005 | Screenshot | [ ] Pass [ ] Fail | |
| TC-006 | Wait Element | [ ] Pass [ ] Fail | |
| TC-007 | Page State | [ ] Pass [ ] Fail | |
| TC-008 | Execute Script | [ ] Pass [ ] Fail | |
| TC-009 | Selectors | [ ] Pass [ ] Fail | |
| TC-010 | Reconnection | [ ] Pass [ ] Fail | |
| TC-011 | Task Queue | [ ] Pass [ ] Fail | |
| TC-012 | Error Handling | [ ] Pass [ ] Fail | |

### Issues Found
1.

### Notes

```
