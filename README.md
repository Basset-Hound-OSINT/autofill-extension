# Basset Hound Browser Automation Extension

A Chrome extension that provides AI-powered browser automation for OSINT investigations. This extension connects to the Basset Hound backend via WebSocket for automated form filling, navigation, and data extraction.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Command Reference](#command-reference)
- [Documentation](#documentation)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

## Overview

The Basset Hound Browser Automation Extension acts as a bridge between the Basset Hound AI backend and the Chrome browser. It receives automation commands via WebSocket and executes them in the browser context, enabling:

- Automated web form interactions
- Intelligent element detection
- Content extraction and analysis
- Screenshot capture
- Custom script execution

This extension is designed for legitimate OSINT (Open Source Intelligence) investigations and research purposes.

## Features

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **WebSocket Communication** | Real-time bidirectional communication with backend |
| **Form Filling** | Automated form field population with human-like typing simulation |
| **Navigation Control** | Navigate to URLs and wait for specific elements |
| **Element Interaction** | Click buttons, links, and other interactive elements |
| **Content Extraction** | Extract text and HTML content from pages |
| **Page State Analysis** | Analyze forms, links, buttons, and inputs on any page |
| **Screenshot Capture** | Capture visible tab screenshots |
| **Script Execution** | Execute custom JavaScript in page context |
| **Structured Logging** | Comprehensive logging with levels and timestamps |

### Connection Management

- Automatic reconnection with exponential backoff
- Heartbeat mechanism to keep connection alive
- Connection status displayed in popup UI
- Manual connect/disconnect controls

### Intelligent Element Finding

The extension uses multiple strategies to find elements:
1. CSS selectors
2. ID attributes
3. Name attributes
4. Data-testid attributes
5. ARIA labels
6. Placeholder text matching
7. Visible text content matching

## Quick Start

1. **Load the Extension**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select this directory

2. **Start the Backend**
   ```bash
   cd ../basset-hound-backend
   python websocket_server.py
   ```

3. **Connect**
   - Click the extension icon
   - Click "Connect"
   - Status should show "Connected"

4. **Send Commands**
   - Commands are sent from the backend via WebSocket
   - See [Command Reference](#command-reference) below

## Installation

### Development Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd basset-hound/basset-hound-autofill-extension
   ```

2. Load in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top-right corner
   - Click "Load unpacked"
   - Select this directory

3. Verify installation:
   - Extension icon appears in toolbar
   - Click icon to open popup
   - Check for any errors in the extension card

### Production Installation

For production deployment:
1. Package the extension as a `.crx` file
2. Or publish to Chrome Web Store (requires developer account)

## Configuration

### WebSocket Connection

The extension connects to `ws://localhost:8765/browser` by default. To change this, edit `background.js`:

```javascript
const CONFIG = {
  WS_URL: 'ws://localhost:8765/browser',  // WebSocket endpoint
  MAX_RECONNECT_ATTEMPTS: 10,              // Max reconnection attempts
  INITIAL_RECONNECT_DELAY: 1000,           // Initial delay (1 second)
  MAX_RECONNECT_DELAY: 30000,              // Max delay (30 seconds)
  COMMAND_TIMEOUT: 30000,                  // Default command timeout
  HEARTBEAT_INTERVAL: 30000                // Heartbeat frequency
};
```

### Logging

Adjust log level in the logger initialization:

```javascript
const logger = new Logger({
  component: 'Background',
  minLevel: LogLevel.DEBUG,  // DEBUG, INFO, WARN, ERROR
  enableConsole: true,
  enableStorage: true        // Persist logs to storage
});
```

## Usage

### Popup Interface

The extension popup provides:
- **Connection Status**: Visual indicator (green = connected, red = disconnected)
- **Connect/Disconnect**: Manual connection controls
- **Task Queue**: View running and completed tasks
- **Refresh**: Update status manually
- **Clear History**: Remove completed tasks

### Automated Workflow

1. Backend sends command via WebSocket
2. Extension receives and validates command
3. Command is routed to appropriate handler
4. Handler executes action (navigation, form fill, etc.)
5. Response is sent back to backend

## Command Reference

### navigate

Navigate to a URL:
```json
{
  "command_id": "uuid",
  "type": "navigate",
  "params": {
    "url": "https://example.com",
    "wait_for": "#content",
    "timeout": 10000
  }
}
```

### fill_form

Fill form fields:
```json
{
  "command_id": "uuid",
  "type": "fill_form",
  "params": {
    "fields": {
      "#username": "john_doe",
      "[name='email']": "john@example.com",
      "#password": "secret123"
    },
    "submit": false
  }
}
```

### click

Click an element:
```json
{
  "command_id": "uuid",
  "type": "click",
  "params": {
    "selector": "#submit-button",
    "wait_after": 1000
  }
}
```

### get_content

Extract page content:
```json
{
  "command_id": "uuid",
  "type": "get_content",
  "params": {
    "selector": ".results"
  }
}
```

### screenshot

Capture screenshot:
```json
{
  "command_id": "uuid",
  "type": "screenshot",
  "params": {
    "format": "png",
    "quality": 100
  }
}
```

### wait_for_element

Wait for element to appear:
```json
{
  "command_id": "uuid",
  "type": "wait_for_element",
  "params": {
    "selector": ".dynamic-content",
    "timeout": 15000
  }
}
```

### get_page_state

Get comprehensive page state:
```json
{
  "command_id": "uuid",
  "type": "get_page_state",
  "params": {}
}
```

### execute_script

Execute custom JavaScript:
```json
{
  "command_id": "uuid",
  "type": "execute_script",
  "params": {
    "script": "document.querySelectorAll('a').length"
  }
}
```

### Response Format

All commands return:
```json
{
  "command_id": "uuid",
  "success": true,
  "result": { ... },
  "error": null,
  "timestamp": 1703520000000
}
```

## Documentation

Detailed documentation is available in the `docs/` folder:

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture and component details |
| [API.md](docs/API.md) | Complete API reference for all commands |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Development setup and workflow guide |
| [TESTING.md](docs/TESTING.md) | Testing procedures and test cases |
| [NETWORK-MONITORING.md](docs/NETWORK-MONITORING.md) | Network monitoring and HAR export guide |
| [ROADMAP.md](docs/ROADMAP.md) | Project roadmap and planned features |
| [automated-testing.md](docs/automated-testing.md) | Automated testing infrastructure |
| [chrome-extension-cross-communication.md](docs/chrome-extension-cross-communication.md) | Cross-extension communication patterns |

### Project Continuity

For developers continuing work on this project, a `TMP.md` file should be maintained in the project root to track:
- Current development focus and priorities
- In-progress features and their status
- Known issues being actively worked on
- Context for handoffs between development sessions

This file serves as a living document for project continuity and developer onboarding.

## Troubleshooting

### Extension Won't Connect

1. Verify backend server is running on port 8765
2. Check for firewall blocking localhost
3. Open service worker DevTools and check for errors
4. Try clicking "Disconnect" then "Connect"

### Commands Failing

1. Ensure content script is loaded (reload the page)
2. Check selector is correct for the target page
3. Look for errors in page's DevTools console
4. Verify element is visible and not disabled

### Service Worker Issues

1. Service workers sleep after 30 seconds of inactivity
2. Heartbeat keeps connection alive when connected
3. If connection drops, it will auto-reconnect

### Form Filling Not Working

1. Some sites use shadow DOM - not currently supported
2. React/Vue apps may need different events
3. Try increasing typing delay in content.js
4. Check if field is read-only or disabled

## Security

### Security Measures

1. **Localhost-Only Connection**: WebSocket only connects to localhost
2. **Command Validation**: All commands validated before execution
3. **Timeout Protection**: Operations have configurable timeouts
4. **Password Masking**: Passwords masked in page state responses
5. **Error Isolation**: Errors caught and logged, not propagated

### Permissions

| Permission | Usage |
|------------|-------|
| `activeTab` | Access current tab for automation |
| `tabs` | Query and update tab states |
| `scripting` | Inject content scripts |
| `storage` | Store extension state and logs |
| `notifications` | Display notifications (reserved) |
| `<all_urls>` | Content scripts on all pages |

### Best Practices

- Only use on sites you have permission to access
- Do not store sensitive credentials in commands
- Review scripts before using execute_script
- Monitor task queue for unexpected activity

## File Structure

```
basset-hound-autofill-extension/
├── manifest.json               # Chrome extension manifest (V3)
├── background.js               # Service worker (WebSocket, commands)
├── content.js                  # Content script (DOM interaction)
├── popup.html                  # Extension popup UI
├── popup.js                    # Popup script
├── package.json                # Node.js package configuration
├── FORM_AUTOMATION_API.md      # Form automation API documentation
├── data/
│   └── form-templates.js       # Form template definitions
├── utils/
│   ├── logger.js               # Structured logging utility
│   ├── form-detector.js        # Intelligent form detection
│   ├── network-monitor.js      # Network traffic monitoring
│   └── request-interceptor.js  # Request interception and modification
├── tests/
│   ├── README.md               # Test suite documentation
│   ├── integration.test.js     # Main integration tests
│   ├── test-server.js          # Test server for automation testing
│   ├── test-page.html          # Test page with various form types
│   ├── test-forms.html         # Additional form test cases
│   ├── helpers/
│   │   ├── assertions.js       # Custom test assertions
│   │   └── setup.js            # Test setup utilities
│   ├── integration/
│   │   ├── commands.test.js    # Command integration tests
│   │   ├── content-script.test.js  # Content script tests
│   │   └── websocket.test.js   # WebSocket communication tests
│   ├── unit/
│   │   ├── background.test.js  # Background script unit tests
│   │   ├── content.test.js     # Content script unit tests
│   │   ├── logger.test.js      # Logger utility tests
│   │   ├── network-monitor.test.js     # Network monitor tests
│   │   └── request-interceptor.test.js # Request interceptor tests
│   ├── mocks/
│   │   ├── chrome-api.mock.js  # Chrome API mocks
│   │   └── websocket.mock.js   # WebSocket mocks
│   └── manual/
│       ├── MANUAL_TESTS.md     # Manual testing procedures
│       ├── test-checklist.md   # Testing checklist
│       └── test-pages/         # Manual test HTML pages
├── icons/
│   ├── icon16.png/svg          # 16x16 icon
│   ├── icon32.png              # 32x32 icon
│   ├── icon48.png/svg          # 48x48 icon
│   └── icon128.png/svg         # 128x128 icon
├── docs/
│   ├── ARCHITECTURE.md         # Architecture documentation
│   ├── API.md                  # API reference
│   ├── DEVELOPMENT.md          # Development guide
│   ├── TESTING.md              # Testing guide
│   ├── NETWORK-MONITORING.md   # Network monitoring guide
│   ├── ROADMAP.md              # Project roadmap
│   ├── automated-testing.md    # Automated testing guide
│   └── chrome-extension-cross-communication.md  # Cross-extension patterns
├── flask_test_app/             # Flask app for testing
│   ├── app.py                  # Flask application
│   ├── configs/                # Test configurations
│   └── templates/              # HTML templates
└── README.md                   # This file
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (see [TESTING.md](docs/TESTING.md))
5. Submit a pull request

### Development Tips

- Keep DevTools open during development
- Test on multiple websites
- Handle edge cases gracefully
- Add logging for debugging
- Update documentation for new features

## License

Part of the Basset Hound OSINT toolkit.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.2.0 | Dec 2024 | Network monitoring with HAR export capability |
| 1.2.0 | Dec 2024 | Request interception and header modification |
| 1.2.0 | Dec 2024 | Form automation API with intelligent detection |
| 1.2.0 | Dec 2024 | Comprehensive test suite (unit, integration, manual) |
| 1.1.0 | Dec 2024 | Form templates and data directory structure |
| 1.1.0 | Dec 2024 | Enhanced utility modules (form-detector, network-monitor) |
| 1.0.0 | Initial | Initial release with core automation features |

### December 2024 Updates

**Network Monitoring (v1.2.0)**
- Full network traffic monitoring with filtering by type, domain, and status
- HAR (HTTP Archive) export for sharing captured network data
- Real-time request/response inspection
- See [NETWORK-MONITORING.md](docs/NETWORK-MONITORING.md) for details

**Request Interception (v1.2.0)**
- Intercept and modify HTTP requests before they are sent
- Add, modify, or remove request headers
- Block requests matching specific patterns
- Support for conditional request modification rules

**Form Automation API (v1.2.0)**
- Intelligent form field detection using multiple strategies
- Template-based form filling with reusable configurations
- Support for complex form types (multi-step, dynamic fields)
- See [FORM_AUTOMATION_API.md](FORM_AUTOMATION_API.md) for API documentation

**Test Suite (v1.2.0)**
- Unit tests for all core modules (background, content, utilities)
- Integration tests for WebSocket communication and commands
- Mock infrastructure for Chrome APIs and WebSocket
- Manual testing procedures and checklists
- See [tests/README.md](tests/README.md) for test documentation
