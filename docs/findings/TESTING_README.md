# Testing Documentation - Quick Start

Welcome! This guide helps you get the Basset Hound extension test suite up and running.

## 🚀 Quick Start (5 minutes)

### Step 1: Upgrade Node.js (Required)

Your current Node.js version (v12.22.9) is too old. Run the automated setup:

```bash
cd /home/devel/autofill-extension
./setup-testing.sh
```

This script will:
- ✅ Check your Node.js version
- ✅ Offer to install Node.js v18 LTS via nvm
- ✅ Install all dependencies
- ✅ Run the test suite
- ✅ Provide next steps

### Step 2: Run Tests

After upgrading Node.js, run tests with:

```bash
./quick-test.sh
```

Or run specific test suites:

```bash
npm test                 # All tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:coverage    # With coverage report
```

### Step 3: Load Extension in Chrome

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select `/home/devel/autofill-extension`

### Step 4: Start Test Servers

Terminal 1 - WebSocket server:
```bash
npm run test:server
```

Terminal 2 - Test pages:
```bash
npm run test:manual
```

Then open http://localhost:8080/ in Chrome

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| **TESTING_README.md** | This file - quick start guide |
| **LOCAL_TESTING_GUIDE.md** | Comprehensive testing guide |
| **TEST_ANALYSIS_REPORT.md** | Detailed test analysis and findings |
| **setup-testing.sh** | Automated setup script |
| **quick-test.sh** | Quick test runner |

---

## 📊 Test Suite Overview

### Automated Tests (130+ test cases)

**Unit Tests** (50+ tests)
- Background service worker
- Content scripts
- Logger
- Network monitor
- Request interceptor

**Integration Tests** (60+ tests)
- WebSocket connection
- Command execution
- Multi-tab handling
- Error handling
- Full integration

### Manual Tests (8 test pages)
- Form autofill
- Navigation
- Storage operations
- Login/registration
- Multi-step forms
- Dynamic content

---

## 🔧 Test Commands

```bash
# Quick testing
./quick-test.sh              # Quick test run
./setup-testing.sh           # Full setup wizard

# Automated tests
npm test                     # Run all tests
npm run test:unit            # Unit tests only
npm run test:integration     # Integration tests only
npm run test:watch           # Watch mode
npm run test:coverage        # With coverage

# Test servers
npm run test:server          # WebSocket server (port 8765)
npm run test:manual          # HTTP server (port 8080)

# Code quality
npm run lint                 # Run linter
npm run format               # Format code
```

---

## ⚠️ Current Status

### Blocking Issue: Node.js Version

**Problem**: Node.js v12.22.9 is too old
**Required**: v14.15.0 or higher
**Recommended**: v18 LTS

**Solution**: Run `./setup-testing.sh`

---

## ✅ What Gets Tested

### Command Handlers
✓ Navigate to URLs
✓ Fill forms
✓ Click elements
✓ Take screenshots
✓ Wait for elements
✓ Execute scripts
✓ Cookie management
✓ Storage operations
✓ Network capture
✓ Request interception

### WebSocket Features
✓ Connection lifecycle
✓ Reconnection with exponential backoff
✓ Heartbeat mechanism
✓ Message handling
✓ Error recovery

### Browser Integration
✓ Multi-tab coordination
✓ Extension API usage
✓ Content script injection
✓ Background worker communication

---

## 🎯 Coverage Goals

Target: **60%** for all metrics

- Branches: 60%+
- Functions: 60%+
- Lines: 60%+
- Statements: 60%+

View coverage report:
```bash
npm run test:coverage
# Open coverage/lcov-report/index.html in browser
```

---

## 🐛 Troubleshooting

### Tests won't run
```bash
# Check Node version
node -v  # Should be v14.15.0+

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### WebSocket server won't start
```bash
# Check if port is in use
lsof -i :8765

# Kill process if needed
kill -9 <PID>
```

### Extension won't load
1. Check `chrome://extensions/` shows the extension
2. Click "Service worker" to see console
3. Look for connection errors
4. Ensure test server is running

### Test pages won't load
```bash
# Check if port 8080 is in use
lsof -i :8080

# Use different port
python3 -m http.server 8888 -d tests/manual/test-pages
```

---

## 📈 Recommended Improvements

### High Priority
1. ⭐⭐⭐ Upgrade Node.js to v18 LTS
2. ⭐⭐ Add E2E tests with Puppeteer
3. ⭐⭐ Set up CI/CD pipeline

### Medium Priority
4. ⭐ Improve test coverage to 80%+
5. ⭐ Add performance benchmarks
6. ⭐ Security testing (XSS, injection)

### Low Priority
7. Visual regression testing
8. Cross-browser testing
9. Load testing

See [TEST_ANALYSIS_REPORT.md](TEST_ANALYSIS_REPORT.md) for details.

---

## 💡 Quick Tips

**For Development**:
```bash
npm run test:watch  # Auto-run tests on file changes
```

**For Debugging**:
```bash
npm run test:unit -- --verbose  # Detailed output
```

**For CI/CD**:
```bash
npm run test:coverage -- --ci  # CI-friendly output
```

**For Manual Testing**:
1. Load extension in Chrome
2. Start test server: `npm run test:server`
3. Start HTTP server: `npm run test:manual`
4. Open http://localhost:8080/
5. Open DevTools console to see logs

---

## 🔗 Resources

- [Jest Documentation](https://jestjs.io/)
- [Chrome Extension Testing](https://developer.chrome.com/docs/extensions/mv3/tut_debugging/)
- [WebSocket Testing](https://github.com/websockets/ws)
- [Node.js Downloads](https://nodejs.org/)
- [NVM (Node Version Manager)](https://github.com/nvm-sh/nvm)

---

## 📞 Next Steps

1. **Run Setup**: `./setup-testing.sh`
2. **Run Tests**: `./quick-test.sh`
3. **Read Analysis**: Open [TEST_ANALYSIS_REPORT.md](TEST_ANALYSIS_REPORT.md)
4. **Start Testing**: Load extension and test manually

**Questions?** See [LOCAL_TESTING_GUIDE.md](LOCAL_TESTING_GUIDE.md) for comprehensive documentation.

---

**Last Updated**: 2025-12-28
**Test Suite Version**: 1.0.0
**Node.js Required**: v14.15.0+
**Node.js Recommended**: v18 LTS
