The test server is running on the remote at 192.168.0.7:8765.
How to Start Testing
Option 1: Test with the Remote Server (192.168.0.7)
Load the extension in Chrome on the remote machine:
Open Chrome on 192.168.0.7
Go to chrome://extensions/
Enable "Developer mode"
Click "Load unpacked" and select ~/Desktop/autofill-extension
The extension will auto-connect to ws://localhost:8765/browser
Watch the server logs:

ssh devel@192.168.0.7 'tail -f /tmp/test-server.log'
Option 2: Test Locally

# Start the test server locally
cd /home/devel/autofill-extension
npm run test:server

# Load extension in Chrome:
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked" 
# 4. Select /home/devel/autofill-extension folder
Option 3: Run Automated Tests

# Run all tests locally
npm test

# Run only integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
Manual Test Pages

# Serve test pages on port 8080
npm run test:manual

# Then open in browser:
# http://localhost:8080/form-test.html
# http://localhost:8080/navigation-test.html
# http://localhost:8080/storage-test.html
Current Status:
Remote test server running at ws://192.168.0.7:8765/browser
Extension synced to remote at ~/Desktop/autofill-extension
Ready for Chrome extension to connect
