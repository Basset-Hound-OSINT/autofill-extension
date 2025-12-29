# Local Testing Guide for Basset Hound Extension

## Current Issue: Node.js Version Incompatibility

### Problem
Your current Node.js version (v12.22.9) is too old to run the test suite. Jest 29 requires Node.js v14.15.0 or higher.

### Solution: Upgrade Node.js

#### Option 1: Using Node Version Manager (nvm) - RECOMMENDED

1. Install nvm (if not already installed):
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

2. Close and reopen your terminal, or run:
```bash
source ~/.bashrc
```

3. Install Node.js v18 LTS (recommended):
```bash
nvm install 18
nvm use 18
nvm alias default 18
```

4. Verify installation:
```bash
node -v  # Should show v18.x.x
npm -v   # Should show v9.x.x or higher
```

#### Option 2: Using Ubuntu Package Manager

```bash
# Remove old Node.js
sudo apt remove nodejs npm

# Install Node.js 18.x from NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node -v
npm -v
```

## Running Automated Tests

Once Node.js is upgraded, navigate to your project directory and run:

### 1. Install Dependencies (if not already done)
```bash
cd /home/devel/autofill-extension
npm install
```

### 2. Run All Tests
```bash
# Run all automated tests
npm test

# Run with coverage report
npm run test:coverage

# Run tests in watch mode (re-runs on file changes)
npm run test:watch
```

### 3. Run Specific Test Suites
```bash
# Run only unit tests (fast, no browser required)
npm run test:unit

# Run only integration tests (slower, includes WebSocket tests)
npm run test:integration

# Run legacy integration tests
npm run test:legacy
```

### 4. Start Test Server for Manual Testing
```bash
# Start WebSocket test server (localhost:8765)
npm run test:server

# In another terminal, serve manual test pages (localhost:8080)
npm run test:manual
```

## Test Structure Overview

### Automated Tests
- **Unit Tests** (`tests/unit/`): 5 test files with 100+ test cases
  - `background.test.js` - Background service worker logic
  - `content.test.js` - Content script functionality
  - `logger.test.js` - Logging system
  - `network-monitor.test.js` - Network monitoring
  - `request-interceptor.test.js` - Request interception

- **Integration Tests** (`tests/integration/`): 6 test files
  - `websocket.test.js` - WebSocket connection management
  - `commands.test.js` - Command execution flow
  - `content-script.test.js` - Content script integration
  - `multi-tab.test.js` - Multi-tab handling
  - `error-handling.test.js` - Error scenarios
  - `extension-integration.test.js` - Full extension integration

### Manual Tests
- **Test Pages** (`tests/manual/test-pages/`):
  - `form-test.html` - Form autofill testing
  - `navigation-test.html` - Navigation commands
  - `storage-test.html` - LocalStorage/SessionStorage
  - `login-form.html` - Login form scenarios
  - `registration-form.html` - Registration forms
  - `multi-step-form.html` - Multi-step workflows
  - `dynamic-content.html` - Dynamic content loading

## Testing Workflow

### Step 1: Automated Testing
```bash
# Run all tests to verify core functionality
npm test

# Check test coverage
npm run test:coverage
```

### Step 2: Load Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select `/home/devel/autofill-extension` folder
5. Extension icon should appear in toolbar

### Step 3: Start Test Server
```bash
# Terminal 1: Start WebSocket server
npm run test:server

# Terminal 2: Serve manual test pages
npm run test:manual
```

### Step 4: Manual Testing
1. Open Chrome DevTools (F12)
2. Go to the "Console" tab to see extension logs
3. Navigate to `http://localhost:8080/`
4. Click through the test pages
5. Open DevTools Console to send commands manually:

```javascript
// Example: Test WebSocket connection
// The extension auto-connects to ws://localhost:8765/browser

// Check connection status in background worker
// Go to chrome://extensions/ -> Service Worker -> inspect
```

### Step 5: Testing with WebSocket Commands

You can send commands via the test server or manually through the console:

```javascript
// In the test server terminal, or using a WebSocket client
{
  "command_id": "test-001",
  "type": "navigate",
  "params": {
    "url": "http://localhost:8080/form-test.html"
  }
}

{
  "command_id": "test-002",
  "type": "fill_form",
  "params": {
    "fields": {
      "#username": "testuser",
      "#email": "test@example.com"
    }
  }
}

{
  "command_id": "test-003",
  "type": "screenshot",
  "params": {
    "format": "png",
    "quality": 100
  }
}
```

## Expected Test Results

Once Node.js is upgraded, you should see:

### Unit Tests
- ~50+ unit tests passing
- Tests cover all command handlers
- WebSocket connection lifecycle
- Error handling scenarios

### Integration Tests
- ~30+ integration tests passing
- WebSocket reconnection logic
- Command execution flow
- Multi-tab coordination
- Network monitoring
- Request interception

### Coverage Report
The test suite aims for 60%+ coverage on:
- Branches
- Functions
- Lines
- Statements

## Troubleshooting

### Issue: Tests still failing after Node upgrade
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: WebSocket server won't start
```bash
# Check if port 8765 is in use
lsof -i :8765
# Kill the process if needed
kill -9 <PID>
```

### Issue: Extension not connecting to WebSocket
1. Check extension is loaded: `chrome://extensions/`
2. Inspect service worker: Click "Service worker" link
3. Check console for connection errors
4. Verify test server is running on port 8765

### Issue: Manual test pages won't load
```bash
# Check if port 8080 is in use
lsof -i :8080
# Use different port
python3 -m http.server 8888 -d tests/manual/test-pages
```

## Next Steps After Testing

### Improvements Identified

Based on the test analysis, here are recommended improvements:

1. **Node.js Version**: Update to v18 LTS (required)

2. **Test Coverage Gaps**:
   - Add tests for edge cases in form autofill
   - Test WebSocket reconnection under network failures
   - Add performance benchmarks for command execution

3. **Manual Test Automation**:
   - Consider adding Puppeteer/Playwright for E2E tests
   - Automate manual test cases for CI/CD

4. **Documentation**:
   - Add JSDoc comments to all functions
   - Document WebSocket command protocol
   - Create troubleshooting guide

5. **Code Quality**:
   - Add ESLint rules and fix linting issues
   - Add Prettier for code formatting
   - Consider TypeScript migration

6. **Security**:
   - Review content security policy
   - Audit external dependencies
   - Add input validation tests

## Test Commands Quick Reference

```bash
# Setup
npm install                      # Install dependencies
node -v                          # Check Node version

# Automated Tests
npm test                         # Run all tests
npm run test:unit                # Unit tests only
npm run test:integration         # Integration tests only
npm run test:coverage            # With coverage report
npm run test:watch               # Watch mode

# Servers
npm run test:server              # WebSocket server (port 8765)
npm run test:manual              # HTTP server (port 8080)

# Code Quality
npm run lint                     # Run ESLint
npm run format                   # Run Prettier
```

## Resources

- Jest Documentation: https://jestjs.io/
- Chrome Extension Testing: https://developer.chrome.com/docs/extensions/mv3/tut_debugging/
- WebSocket Testing: https://github.com/websockets/ws
- Node.js: https://nodejs.org/
