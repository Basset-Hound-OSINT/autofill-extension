# Automated Development Workflow Guide

## Overview

This guide explains the automated development workflow for the Basset Hound extension, eliminating the need for manual extension reloading in Chrome.

---

## Quick Start

### Development Mode (File Watching)

Start the file watcher to get notified of changes:

```bash
npm run dev:watch
```

This command:
- Watches all `.js`, `.html`, and `.css` files
- Ignores `node_modules/`, `tests/`, and `coverage/`
- Displays a notification when files change
- **You still need to manually reload the extension in Chrome** (for now)

### Test Development (Auto-Run Tests)

Run tests automatically when files change:

```bash
npm run dev:test:watch
```

This command:
- Runs Jest in watch mode
- Automatically re-runs tests when files change
- Shows only failed tests by default (press `a` to show all)
- Interactive test runner with filtering options

---

## Development Workflows

### Workflow 1: Unit/Integration Test Development

**Best for**: Writing or fixing unit and integration tests

**Steps**:
1. Open two terminal windows
2. Terminal 1: `npm run dev:test:watch`
3. Terminal 2: Your code editor
4. Make changes to code or tests
5. Tests run automatically
6. Fix issues until all tests pass

**Benefits**:
- Immediate feedback
- No manual test running
- Focus on failing tests
- Fast iteration cycle

### Workflow 2: E2E Test Development

**Best for**: Writing or fixing E2E tests that run in real Chrome

**Steps**:
1. Write E2E test in `tests/e2e/`
2. Run: `npm run test:e2e:verbose`
3. Browser opens, test runs
4. Iterate and re-run

**Note**: E2E tests don't have watch mode yet (browser would stay open)

### Workflow 3: Extension Development

**Best for**: Developing extension features

**Steps**:
1. Terminal 1: `npm run dev:watch`
2. Terminal 2: Your code editor
3. Make changes to extension code
4. See notification: "🔄 Files changed - Reload extension in Chrome"
5. In Chrome:
   - Go to `chrome://extensions`
   - Click reload button on Basset Hound extension
6. Test changes in browser

**Future Enhancement**: Auto-reload will be added to eliminate step 5

---

## File Watching Details

### What is Watched

The `dev:watch` command monitors:
- All `.js` files (extension code)
- All `.html` files (popup, test pages)
- All `.css` files (styles)

### What is Ignored

- `node_modules/` - Dependencies
- `tests/` - Test files (use `dev:test:watch` for tests)
- `coverage/` - Test coverage reports

### Customizing Watch Patterns

Edit `package.json` scripts to change what's watched:

```json
"dev:watch": "chokidar 'PATTERN' --ignore 'IGNORE' -c 'COMMAND'"
```

Examples:
```bash
# Watch only JavaScript files
chokidar '**/*.js' --ignore 'node_modules/**'

# Watch specific directory
chokidar 'utils/**/*.js' -c 'npm test'

# Run specific command on change
chokidar '**/*.js' -c 'npm run lint && npm test'
```

---

## Testing Workflows

### Run All Tests

```bash
# Run all unit and integration tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm run test:unit
npm run test:integration
```

### Run E2E Tests

```bash
# Run all E2E tests (opens Chrome)
npm run test:e2e

# Run with verbose output
npm run test:e2e:verbose

# Run specific E2E test
npx jest tests/e2e/content-script.e2e.test.js --testTimeout=30000
```

### Watch Mode (Auto-Run)

```bash
# Watch mode for unit/integration tests
npm run dev:test:watch

# In watch mode, press:
# - 'a' to run all tests
# - 'f' to run only failed tests
# - 'p' to filter by filename pattern
# - 't' to filter by test name pattern
# - 'q' to quit
```

---

## Extension Reload (Current Process)

### Manual Reload

1. Make code changes
2. In Chrome, navigate to `chrome://extensions`
3. Find "Basset Hound" extension
4. Click the reload icon (🔄)
5. Test your changes

### Why Manual Reload is Needed

Chrome extensions need to be explicitly reloaded when code changes because:
- Extension runs in isolated context
- Chrome caches extension files
- Service worker needs restart

---

## Future: Automatic Extension Reload

### Planned Implementation

#### Option 1: Chrome Extension Reloader (Recommended)

**Install**:
```bash
npm install --save-dev chrome-extension-reloader
```

**Setup**:
Add to `background.js` (development only):
```javascript
if (process.env.NODE_ENV === 'development') {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.management.getSelf((extensionInfo) => {
      if (extensionInfo.installType === 'development') {
        // Enable live reload
        const ws = new WebSocket('ws://localhost:9090');
        ws.onmessage = () => chrome.runtime.reload();
      }
    });
  });
}
```

**Updated script**:
```json
"dev:watch": "webpack-watch & chrome-extension-reloader"
```

**Benefits**:
- Automatic reload on file changes
- No manual intervention needed
- Development-only feature

#### Option 2: web-ext (Firefox & Chrome)

**Install**:
```bash
npm install --save-dev web-ext
```

**Usage**:
```bash
web-ext run --source-dir . --target chromium --chromium-binary /usr/bin/chromium
```

**Benefits**:
- Auto-reload built-in
- Works with Firefox and Chrome
- Additional development tools

---

## Best Practices

### 1. Test-Driven Development (TDD)

**Process**:
1. Write failing test
2. Run `npm run dev:test:watch`
3. Write minimal code to pass test
4. Refactor
5. Repeat

**Benefits**:
- Higher code quality
- Better test coverage
- Faster debugging
- Clear requirements

### 2. Continuous Testing

**Always run tests before**:
- Committing code
- Creating pull requests
- Deploying to production

**Commands**:
```bash
# Quick verification
npm test

# Full verification
npm test && npm run test:e2e

# With coverage
npm run test:coverage
```

### 3. Incremental Development

**Process**:
1. Make small, focused changes
2. Test immediately
3. Commit working code
4. Repeat

**Benefits**:
- Easier debugging
- Clear git history
- Reduced merge conflicts
- Faster iterations

---

## Troubleshooting

### File Watcher Not Detecting Changes

**Symptoms**: `dev:watch` doesn't show notifications when files change

**Solutions**:
1. Check file path is not ignored
2. Increase system file watch limit (Linux):
   ```bash
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```
3. Restart the watch command

### Tests Not Auto-Running

**Symptoms**: Changes don't trigger test re-runs

**Solutions**:
1. Verify `dev:test:watch` is running
2. Check file is matched by Jest config
3. Press `a` in Jest watch mode to force run
4. Check console for errors

### Extension Not Loading in E2E Tests

**Symptoms**: E2E tests fail with "Extension not found"

**Solutions**:
1. Verify `manifest.json` is valid
2. Check extension path in helpers.js
3. Ensure Puppeteer is installed
4. Update Chrome/Chromium

### Chrome Extension Not Reloading

**Symptoms**: Changes don't appear in browser

**Solutions**:
1. Verify you clicked reload in `chrome://extensions`
2. Check for extension errors (red badge)
3. Try removing and re-adding extension
4. Clear Chrome cache
5. Restart Chrome

---

## Performance Tips

### Faster Test Execution

**Skip E2E tests during development**:
```bash
# Unit/integration only (fast)
npm test

# E2E only (slow)
npm run test:e2e
```

**Use test filtering**:
```bash
# Run only specific test file
npm test -- path/to/test.js

# Run tests matching pattern
npm test -- --testNamePattern="should handle errors"
```

### Reduce File Watching Overhead

**Watch specific directories**:
```json
"dev:watch": "chokidar 'utils/**/*.js' ..."
```

**Increase debounce delay**:
```json
"dev:watch": "chokidar ... --debounce 1000 ..."  // Wait 1s before triggering
```

---

## IDE Integration

### VSCode

**Recommended Extensions**:
- Jest (orta.vscode-jest) - Auto-run tests
- ESLint (dbaeumer.vscode-eslint) - Linting
- Prettier (esbenp.prettier-vscode) - Formatting

**Settings** (`.vscode/settings.json`):
```json
{
  "jest.autoRun": "watch",
  "jest.showCoverageOnLoad": true,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

### Chrome DevTools

**Debugging Extension**:
1. Open `chrome://extensions`
2. Find Basset Hound
3. Click "service worker" link (for background.js)
4. Or click "Inspect views: popup.html" (for popup)

**Setting Breakpoints**:
1. Open DevTools for background or popup
2. Navigate to Sources tab
3. Find your file
4. Click line number to set breakpoint

---

## Environment Variables

### Development vs Production

**Set environment**:
```bash
# Development
NODE_ENV=development npm test

# Production
NODE_ENV=production npm run build
```

**Use in code**:
```javascript
if (process.env.NODE_ENV === 'development') {
  // Development-only code
  console.log('Debug info');
}
```

---

## Summary

### Current Workflow

✅ **Implemented**:
- File watching (`npm run dev:watch`)
- Auto-run tests (`npm run dev:test:watch`)
- E2E testing framework (`npm run test:e2e`)

⏳ **Manual Step Required**:
- Extension reload in Chrome (for now)

### Commands Reference

```bash
# Development
npm run dev:watch                # Watch files for changes
npm run dev:test:watch           # Auto-run tests

# Testing
npm test                         # Run all unit/integration tests
npm run test:e2e                 # Run E2E tests (opens Chrome)
npm run test:coverage            # Run with coverage report

# Specific tests
npm run test:unit                # Unit tests only
npm run test:integration         # Integration tests only
npm run test:e2e:verbose         # E2E with verbose output
```

### Next Steps

1. ✅ Use file watching during development
2. ✅ Write E2E tests for critical features
3. ⏳ Implement automatic extension reload (future)
4. ⏳ Add CI/CD automation (planned, not requested)

---

**Document Created**: 2025-12-29
**Status**: ✅ Active
**Maintained By**: Basset Hound Team
