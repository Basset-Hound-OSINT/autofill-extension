# Basset Hound Autofill Extension - Test Suite

This directory contains comprehensive tests for the Basset Hound browser automation extension, including unit tests, integration tests, and manual testing resources.

## Overview

The test suite provides:
- **Unit Tests** - Jest-based tests for isolated component testing
- **Integration Tests** - WebSocket-based end-to-end testing
- **Manual Test Pages** - HTML pages for interactive testing
- **Mock Utilities** - Mock implementations for Chrome APIs and WebSocket

## Directory Structure

```
tests/
├── unit/                    # Jest unit tests
│   ├── background.test.js   # Background script tests
│   ├── content.test.js      # Content script tests
│   ├── logger.test.js       # Logger utility tests
│   └── network-monitor.test.js
├── manual/                  # Manual testing resources
│   ├── MANUAL_TESTS.md      # Manual testing guide
│   └── test-pages/          # Test HTML pages
│       ├── index.html       # Test page index
│       ├── form-test.html   # Form filling tests
│       ├── navigation-test.html
│       └── storage-test.html
├── mocks/                   # Mock implementations
│   ├── chrome-api.mock.js   # Chrome extension API mocks
│   └── websocket.mock.js    # WebSocket mock
├── helpers/                 # Test utilities
│   ├── setup.js             # Jest setup
│   └── assertions.js        # Custom assertions
├── integration.test.js      # Legacy integration tests
├── test-server.js           # WebSocket test server
└── test-page.html           # Legacy test page
```

## Prerequisites

- Node.js v16 or higher
- Chrome or Chromium-based browser
- npm or yarn

## Installation

```bash
# Navigate to extension directory
cd basset-hound-autofill-extension

# Install all dependencies including test dependencies
npm install
```

## Running Tests

### Unit Tests (Jest)

```bash
# Run all unit tests
npm test

# Run specific test file
npm run test:unit

# Run tests in watch mode (development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Integration Tests (Legacy WebSocket-based)

```bash
# Run integration tests
npm run test:legacy

# Run with verbose output
npm run test:legacy:verbose

# Run in manual/interactive mode
npm run test:legacy:manual
```

### Manual Test Server

```bash
# Serve manual test pages on http://localhost:8080
npm run test:manual

# Then open http://localhost:8080 in your browser
```

### WebSocket Test Server

```bash
# Start the WebSocket test server on port 8765
npm run test:server
```

## Test Categories

### Unit Tests

#### Background Script Tests (`unit/background.test.js`)

Tests for the background service worker command handlers:

- **Configuration Tests**
  - Default configuration values

- **WebSocket Connection Management**
  - Connection establishment
  - State transitions (CONNECTING, OPEN, CLOSED)
  - Connection close handling
  - Error handling
  - Message sending/receiving

- **Reconnection with Exponential Backoff**
  - Delay calculation
  - Max attempts enforcement

- **Command Handlers**
  - `navigate` - URL validation and navigation
  - `fill_form` - Form field filling
  - `click` - Element clicking
  - `screenshot` - Format and quality validation
  - `wait_for_element` - Element waiting
  - `execute_script` - Script execution
  - `get_cookies` / `set_cookies` - Cookie management
  - `get_local_storage` / `set_local_storage` - Storage operations
  - `get_session_storage` / `set_session_storage`
  - `clear_storage`
  - Network capture commands
  - Request interception commands
  - Advanced form automation commands

- **Command Processing**
  - Command ID validation
  - Command type validation
  - Handler routing
  - Error handling

- **Response Handling**
  - Success response formatting
  - Error response formatting

- **Task Queue Management**
  - Task addition
  - Task completion/failure
  - Cleanup of old tasks
  - Queue size limiting

#### Content Script Tests (`unit/content.test.js`)

Tests for DOM interaction functions (uses jsdom environment):

- **Element Finding**
  - ID selector matching
  - Name attribute lookup
  - data-testid lookup
  - aria-label support
  - Complex CSS selectors
  - Empty/invalid selector handling

- **Find Element by Text**
  - Button text matching
  - Link text matching
  - Label-associated input finding
  - Case-insensitive matching

- **Selector Generation**
  - ID-based selectors
  - Name-based selectors for form elements
  - data-testid selectors
  - Path-based selectors
  - nth-of-type disambiguation
  - Special character escaping

- **Label Finding**
  - Label by `for` attribute
  - Nested label elements
  - aria-label
  - aria-labelledby
  - Placeholder fallback

- **Form Field Extraction**
  - Text input extraction
  - Submit button exclusion
  - Select options extraction
  - Checkbox state extraction
  - Password value hiding
  - Required/disabled state

- **Form Filling**
  - Text input filling
  - Email input filling
  - Textarea filling
  - Select dropdown selection
  - Checkbox checking/unchecking
  - Radio button selection
  - Event dispatching

- **Click Handling**
  - Button clicking
  - Link clicking
  - Error handling for null elements
  - Focus before click

- **Wait for Element**
  - Immediate resolution for existing elements
  - MutationObserver-based waiting
  - Timeout handling

- **Storage Operations**
  - LocalStorage get/set/clear
  - SessionStorage get/set
  - JSON parsing

- **Page State Extraction**
  - Page metadata
  - Form extraction
  - Link extraction
  - Button extraction

- **Form Validation**
  - Required field validation
  - Email format validation
  - Validity API usage

- **Utility Functions**
  - sleep function
  - CSS escaping
  - Typing delay calculation

- **Date Formatting**
  - ISO date formatting
  - Date input formatting
  - Invalid date handling

### Manual Tests

See `manual/MANUAL_TESTS.md` for detailed step-by-step testing instructions covering:

1. WebSocket Connection Tests
2. Navigation Tests
3. Form Filling Tests
4. Click Tests
5. Content Extraction Tests
6. Storage Tests (Cookies, LocalStorage, SessionStorage)
7. Network Monitoring Tests
8. Request Interception Tests
9. Screenshot Tests
10. Script Execution Tests
11. Wait for Element Tests
12. Error Handling Tests

### Test Pages

Interactive HTML pages in `manual/test-pages/`:

1. **Form Test Page** (`form-test.html`)
   - Login form with username/email/password
   - Registration form with all input types
   - Address form with select dropdowns
   - Search box (standalone input)
   - File upload elements
   - Number and range inputs
   - Hidden fields
   - Dynamic form loading
   - Real-time event logging

2. **Navigation Test Page** (`navigation-test.html`)
   - Navigation links
   - Click counter
   - Various clickable elements (div, data-testid, aria-label, role="button")
   - Button states (normal, disabled, toggle)
   - Modal dialogs
   - Tab navigation
   - Accordions
   - Dropdown menus
   - Breadcrumb navigation
   - Async content loading
   - Status indicator toggles

3. **Storage Test Page** (`storage-test.html`)
   - Cookie management (add, view, clear)
   - LocalStorage operations
   - SessionStorage operations
   - Pre-set test data
   - Complex JSON storage
   - Bulk operations
   - Cross-tab storage events

## Test Configuration

### Jest Configuration

Located in `package.json`:

```json
{
  "jest": {
    "testEnvironment": "node",
    "testMatch": [
      "**/tests/unit/**/*.test.js"
    ],
    "setupFilesAfterEnv": [
      "<rootDir>/tests/helpers/setup.js"
    ],
    "verbose": true,
    "testTimeout": 10000,
    "coverageThreshold": {
      "global": {
        "branches": 60,
        "functions": 60,
        "lines": 60,
        "statements": 60
      }
    }
  }
}
```

### Integration Test Configuration

Edit `integration.test.js`:

```javascript
const CONFIG = {
  WS_URL: 'ws://localhost:8765/browser',
  CONNECT_TIMEOUT: 10000,
  COMMAND_TIMEOUT: 30000,
  TEST_PAGE_URL: 'file://...',
  VERBOSE: false
};
```

## Writing Tests

### Unit Test Example

```javascript
describe('Feature Name', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should do something', async () => {
    // Arrange
    const input = { key: 'value' };

    // Act
    const result = await functionUnderTest(input);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  test('should handle errors', async () => {
    await expect(functionUnderTest(null))
      .rejects.toThrow('Error message');
  });
});
```

### Integration Test Example

```javascript
test('My integration test', async () => {
  const response = await runTestCommand('navigate', {
    url: 'https://example.com'
  });

  assert(response.success === true, 'Navigation should succeed');
  assert(response.result?.url, 'Should return URL');
});
```

## Mock Utilities

### Chrome API Mock (`mocks/chrome-api.mock.js`)

```javascript
const { setupTestEnvironment } = require('./helpers/setup');

// Sets up global.chrome with mock implementations
setupTestEnvironment();

// Access mock data
chrome.storage.local._data;
chrome.tabs._tabs;
```

### WebSocket Mock (`mocks/websocket.mock.js`)

```javascript
const { MockWebSocket, getLastInstance } = require('./mocks/websocket.mock');

const ws = new MockWebSocket('ws://localhost:8765');
ws.simulateOpen();
ws.simulateMessage({ type: 'test' });

const messages = ws.getSentMessages();
```

## Test Coverage

Run coverage report:

```bash
npm run test:coverage
```

Coverage reports are generated in the `coverage/` directory in multiple formats (text, lcov, html).

## Interactive Commands (Test Server)

When running in manual mode or using the standalone server:

| Command | Description |
|---------|-------------|
| `navigate <url>` | Navigate to URL |
| `click <selector>` | Click element |
| `fill <selector> <value>` | Fill form field |
| `content [selector]` | Get page content |
| `screenshot` | Capture screenshot |
| `state` | Get page state |
| `wait <selector>` | Wait for element |
| `script <code>` | Execute JavaScript |
| `clients` | List connected clients |
| `history` | Show command history |
| `quit` | Exit server |

## Debugging

### Jest Debugging

```bash
# Run specific test file
npm test -- tests/unit/background.test.js

# Run tests matching pattern
npm test -- -t "WebSocket"

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Common Issues

1. **"chrome is not defined"**
   - Ensure `setupTestEnvironment()` is called in beforeAll()

2. **Tests timing out**
   - Increase timeout in Jest config
   - Check for unresolved promises
   - Use `jest.useFakeTimers()` for timer-based tests

3. **Element not found in jsdom tests**
   - Ensure document.body.innerHTML is set before tests
   - Check selector syntax

4. **WebSocket connection failed**
   - Ensure test server is running
   - Check port 8765 availability

## Continuous Integration

Example GitHub Actions workflow:

```yaml
name: Extension Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run unit tests
        run: npm test

      - name: Run coverage
        run: npm run test:coverage
```

## Contributing

1. Add tests for new features
2. Maintain test coverage above thresholds
3. Follow existing test patterns
4. Update this README for significant changes
5. Ensure all tests pass before submitting PRs
