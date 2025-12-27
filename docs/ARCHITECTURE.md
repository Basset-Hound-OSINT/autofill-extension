# Basset Hound Browser Automation Extension - Architecture

This document provides a comprehensive overview of the extension's architecture, components, and data flow.

## Table of Contents

- [Overview](#overview)
- [Architecture Diagram](#architecture-diagram)
- [Component Details](#component-details)
- [Data Flow](#data-flow)
- [State Management](#state-management)
- [Security Model](#security-model)
- [Extension Lifecycle](#extension-lifecycle)

## Overview

The Basset Hound Browser Automation Extension is a Chrome Manifest V3 extension that enables remote browser automation through WebSocket communication. It follows a client-server architecture where:

- **Server**: Basset Hound backend (external Python application)
- **Client**: This Chrome extension

The extension acts as a bridge between the AI-powered backend and the browser, executing commands and returning results.

## Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                              Basset Hound Backend                                  |
|                         (WebSocket Server on port 8765)                           |
+-----------------------------------------------------------------------------------+
                                        |
                                        | WebSocket (ws://localhost:8765/browser)
                                        | JSON Commands & Responses
                                        |
+-----------------------------------------------------------------------------------+
|                           Chrome Extension (Manifest V3)                          |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                         Background Service Worker                            |  |
|  |                           (background.js)                                   |  |
|  |                                                                             |  |
|  |  +------------------+  +------------------+  +-------------------+          |  |
|  |  | WebSocket Client |  | Command Router   |  | Response Handler  |          |  |
|  |  | - Connection     |  | - Validate       |  | - Format response |          |  |
|  |  | - Reconnection   |  | - Dispatch       |  | - Send to server  |          |  |
|  |  | - Heartbeat      |  | - Timeout        |  | - Error handling  |          |  |
|  |  +------------------+  +------------------+  +-------------------+          |  |
|  |                                                                             |  |
|  |  +------------------+  +------------------+  +-------------------+          |  |
|  |  | Command Handlers |  | Tab Manager      |  | Task Queue        |          |  |
|  |  | - navigate       |  | - Query tabs     |  | - Track tasks     |          |  |
|  |  | - screenshot     |  | - Create tabs    |  | - Cleanup old     |          |  |
|  |  | - execute_script |  | - Send messages  |  | - Broadcast       |          |  |
|  |  +------------------+  +------------------+  +-------------------+          |  |
|  +-----------------------------------------------------------------------------+  |
|                                        |                                          |
|                                        | Chrome Runtime Messages                  |
|                                        |                                          |
|  +-----------------------------------------------------------------------------+  |
|  |                            Content Script                                    |  |
|  |                            (content.js)                                     |  |
|  |                                                                             |  |
|  |  +------------------+  +------------------+  +-------------------+          |  |
|  |  | Form Filler      |  | Element Finder   |  | Content Extractor |          |  |
|  |  | - Text inputs    |  | - CSS selectors  |  | - Text content    |          |  |
|  |  | - Selects        |  | - ID/Name attrs  |  | - HTML content    |          |  |
|  |  | - Checkboxes     |  | - Text matching  |  | - Page state      |          |  |
|  |  +------------------+  +------------------+  +-------------------+          |  |
|  |                                                                             |  |
|  |  +------------------+  +------------------+  +-------------------+          |  |
|  |  | Click Handler    |  | Wait Handler     |  | Selector Generator|          |  |
|  |  | - Scroll to view |  | - MutationObserv |  | - Generate unique |          |  |
|  |  | - Focus & click  |  | - Timeout        |  | - CSS selectors   |          |  |
|  |  +------------------+  +------------------+  +-------------------+          |  |
|  +-----------------------------------------------------------------------------+  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                              Popup UI                                        |  |
|  |                        (popup.html + popup.js)                              |  |
|  |                                                                             |  |
|  |  +------------------+  +------------------+  +-------------------+          |  |
|  |  | Status Display   |  | Control Buttons  |  | Task Queue View   |          |  |
|  |  | - Connection     |  | - Connect        |  | - Running tasks   |          |  |
|  |  | - Reconnecting   |  | - Disconnect     |  | - Task history    |          |  |
|  |  +------------------+  +------------------+  +-------------------+          |  |
|  +-----------------------------------------------------------------------------+  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                           Utilities                                          |  |
|  |                        (utils/logger.js)                                    |  |
|  |                                                                             |  |
|  |  - Structured logging with levels (DEBUG, INFO, WARN, ERROR)                |  |
|  |  - Context/component tracking                                               |  |
|  |  - Optional storage persistence                                             |  |
|  |  - Timestamp formatting                                                     |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
                                        |
                                        | DOM Manipulation
                                        |
+-----------------------------------------------------------------------------------+
|                              Web Page (Any URL)                                   |
|                                                                                   |
|  - Forms, buttons, links, inputs                                                 |
|  - Dynamic content                                                               |
|  - Single Page Applications                                                       |
+-----------------------------------------------------------------------------------+
```

## Component Details

### 1. Background Service Worker (background.js)

The background service worker is the central hub of the extension. It manages:

#### WebSocket Connection
- Establishes and maintains connection to `ws://localhost:8765/browser`
- Implements exponential backoff reconnection (1s to 30s delay)
- Sends heartbeat every 30 seconds to keep connection alive
- Maximum 10 reconnection attempts before giving up

#### Command Processing
- Receives JSON commands from the WebSocket server
- Validates command structure (requires `command_id` and `type`)
- Routes commands to appropriate handlers
- Sends responses back to server

#### Command Handlers
| Handler | Function | Description |
|---------|----------|-------------|
| `handleNavigate` | Navigate to URL | Opens URL in active tab, optionally waits for element |
| `handleFillForm` | Fill form fields | Delegates to content script |
| `handleClick` | Click element | Delegates to content script |
| `handleGetContent` | Extract content | Delegates to content script |
| `handleScreenshot` | Capture screenshot | Uses Chrome's captureVisibleTab API |
| `handleWaitForElement` | Wait for element | Delegates to content script |
| `handleGetPageState` | Get page state | Delegates to content script |
| `handleExecuteScript` | Run JavaScript | Uses chrome.scripting.executeScript |

#### Tab Management
- Queries active tabs
- Creates new tabs when needed
- Injects content scripts when not loaded
- Listens for tab update events

### 2. Content Script (content.js)

The content script runs in the context of web pages and provides DOM interaction:

#### Message Handling
- Listens for messages from background script
- Routes to appropriate handler function
- Returns responses asynchronously

#### Form Filling (`handleFillForm`)
- Supports multiple input types (text, select, checkbox, radio)
- Simulates human-like typing with delays
- Dispatches proper events for reactive frameworks
- Optional form submission

#### Element Interaction (`handleClickElement`)
- Scrolls element into view before clicking
- Focuses element if possible
- Optionally waits after click

#### Content Extraction (`handleGetContent`, `handleGetPageState`)
- Extracts text and HTML from elements
- Analyzes forms with all fields and options
- Catalogs links, buttons, and standalone inputs
- Generates unique CSS selectors

#### Element Finding (`findElement`)
Multiple selector strategies:
1. Direct CSS selector
2. By ID (`#id`)
3. By name attribute (`[name="..."]`)
4. By data-testid attribute
5. By aria-label attribute
6. By placeholder text
7. By visible text content

### 3. Popup UI (popup.html, popup.js)

The popup provides user interface for manual control:

#### Status Display
- Shows connection status with colored indicator
- Displays status details and reconnection progress
- Updates in real-time via message listeners

#### Controls
- Connect/Disconnect buttons
- Refresh status button
- Clear task history button

#### Task Queue View
- Shows running and completed tasks
- Displays task type, status, and duration
- Scrollable list with maximum 10 visible tasks

### 4. Logger Utility (utils/logger.js)

Structured logging utility:

#### Log Levels
- `DEBUG` (0): Detailed debugging information
- `INFO` (1): General operational information
- `WARN` (2): Warning conditions
- `ERROR` (3): Error conditions

#### Features
- Component-based logging
- Context tracking across log entries
- Optional storage persistence
- Child logger creation for sub-components

## Data Flow

### Command Execution Flow

```
1. Backend sends command via WebSocket
   ↓
2. Background script receives message
   ↓
3. Command validated and parsed
   ↓
4. Handler function invoked
   ↓
5. For DOM operations: Message sent to content script
   ↓
6. Content script executes action
   ↓
7. Response returned to background script
   ↓
8. Response sent back to backend via WebSocket
```

### State Synchronization Flow

```
1. State changes in background script
   ↓
2. Broadcast message sent via chrome.runtime.sendMessage
   ↓
3. Popup receives message (if open)
   ↓
4. State also saved to chrome.storage.local
   ↓
5. Popup can read stored state on open
```

## State Management

### Background Script State

| Variable | Type | Description |
|----------|------|-------------|
| `ws` | WebSocket | Active WebSocket connection |
| `reconnectAttempts` | number | Current reconnection attempt count |
| `reconnectTimeout` | number | ID of pending reconnect setTimeout |
| `heartbeatInterval` | number | ID of heartbeat setInterval |
| `connectionState` | string | Current connection state |
| `taskQueue` | Array | Queue of pending/completed tasks |

### Storage State (chrome.storage.local)

| Key | Type | Description |
|-----|------|-------------|
| `connectionStatus` | string | Last known connection status |
| `connectionData` | Object | Additional connection data |
| `taskQueue` | Array | Recent task history |
| `lastUpdated` | number | Timestamp of last update |
| `settings` | Object | User settings (autoConnect, wsUrl) |
| `extensionLogs` | Array | Persisted log entries |

## Security Model

### Permission Requirements

| Permission | Usage |
|------------|-------|
| `activeTab` | Access current tab for automation |
| `tabs` | Query and update tab states |
| `scripting` | Inject content scripts |
| `storage` | Store extension state |
| `notifications` | Display notifications (reserved) |
| `<all_urls>` | Access any URL for content scripts |

### Security Measures

1. **Localhost-Only WebSocket**: Only connects to `localhost:8765`
2. **Command Validation**: All commands validated before execution
3. **Timeout Protection**: Operations have configurable timeouts
4. **Password Masking**: Passwords masked in page state responses
5. **Error Isolation**: Errors are caught and logged, not propagated

## Extension Lifecycle

### Installation

1. `chrome.runtime.onInstalled` fires
2. Default storage values set
3. Auto-connect to WebSocket server

### Startup

1. `chrome.runtime.onStartup` fires
2. Check `autoConnect` setting
3. Connect to WebSocket if enabled

### Suspension

1. `beforeunload` event on service worker
2. Clean close of WebSocket connection
3. Service worker goes to sleep

### Wakeup

1. Message received or event triggered
2. Service worker wakes up
3. WebSocket reconnection initiated if needed
