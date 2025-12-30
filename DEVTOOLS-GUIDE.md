# Basset Hound DevTools Panel Guide

## Overview

The Basset Hound DevTools Panel provides a professional, Chrome DevTools-integrated interface for browser automation. It replaces and extends the functionality of the popup with a more powerful, developer-focused interface.

## Accessing the DevTools Panel

1. **Load the Extension**: Ensure the Basset Hound extension is loaded in Chrome
2. **Open Chrome DevTools**: Right-click on any page and select "Inspect" or press `F12` / `Cmd+Option+I`
3. **Navigate to Basset Hound Tab**: Look for the "Basset Hound" tab in the DevTools toolbar
   - It appears alongside Elements, Console, Network, etc.
   - Click the tab to open the Basset Hound panel

## Panel Features

### 1. Overview Tab

The Overview tab provides a high-level system status dashboard.

**Features:**
- **Connection Status**: Real-time WebSocket connection state
- **Network Request Count**: Total captured network requests
- **Active Tasks**: Number of currently running tasks
- **Uptime**: Extension session duration
- **Connection Details**: WebSocket URL, state, reconnection attempts
- **Recent Activity**: Last 20 system events

**Actions:**
- Export current status to JSON

### 2. Network Monitor Tab

Advanced network request monitoring and inspection.

**Features:**
- **Request Table**: All HTTP/HTTPS requests with status, method, URL, time, and size
- **Real-time Capture**: Automatically captures requests from the inspected page
- **Filtering**: Filter by URL, HTTP method, or status code
- **Detailed Inspection**: Click any request to view:
  - General information (URL, method, status, timing, size)
  - Response headers
  - Request headers
  - Response body (when available)

**Actions:**
- Clear captured requests
- Export to HAR (HTTP Archive) format for analysis

**Filters:**
- **URL Filter**: Free-text search across URLs
- **Method Filter**: GET, POST, PUT, DELETE, PATCH
- **Status Filter**: 2xx, 3xx, 4xx, 5xx

### 3. Commands Tab

Manual command execution interface with templates.

**Features:**
- **Command Input**: JSON-based command editor with syntax highlighting
- **Command Templates**: Pre-built templates for common operations:
  - **Navigate**: Navigate to a URL
  - **Click Element**: Click on a page element
  - **Type Text**: Type text into input fields
  - **Extract Data**: Extract data from page elements
  - **Screenshot**: Capture screenshots
  - **Wait**: Wait for elements or timeouts
- **Command History**: View all executed commands with timestamps and results
- **JSON Formatter**: Auto-format command JSON

**Actions:**
- Execute custom commands
- Format JSON
- Clear command history

**Example Commands:**

```json
// Navigate to a URL
{
  "type": "navigate",
  "url": "https://example.com"
}

// Click an element
{
  "type": "click",
  "selector": "#submit-button",
  "wait_for_navigation": true
}

// Type text
{
  "type": "type",
  "selector": "input[name='username']",
  "text": "john.doe@example.com",
  "delay": 100
}

// Extract data
{
  "type": "extract",
  "selector": ".user-profile h1",
  "attribute": "textContent"
}

// Take screenshot
{
  "type": "screenshot",
  "fullPage": true
}

// Wait for element
{
  "type": "wait",
  "selector": ".loading-spinner",
  "timeout": 5000
}
```

### 4. Tasks Tab

Task queue monitoring and management.

**Features:**
- **Task List**: All tasks with status, type, and timing information
- **Status Indicators**: Visual icons for running, completed, failed, and pending tasks
- **Duration Tracking**: Elapsed time for each task
- **Auto-sorting**: Running tasks appear first

**Task Status:**
- **Running**: Currently executing (spinning icon)
- **Completed**: Successfully finished (checkmark)
- **Failed**: Error occurred (X icon)
- **Pending**: Queued for execution (circle)

**Actions:**
- Clear completed tasks

### 5. Audit Log Tab

Comprehensive system activity logging.

**Features:**
- **Log Levels**: Debug, Info, Warning, Error
- **Timestamps**: Precise timing for each log entry
- **Filtering**: Filter by text or log level
- **Monospace Display**: Easy-to-read log format

**Log Levels:**
- **DEBUG**: Detailed debugging information
- **INFO**: General informational messages
- **WARN**: Warning messages
- **ERROR**: Error messages

**Actions:**
- Clear audit log
- Export to JSON

### 6. Console Tab

JavaScript execution console for the inspected page.

**Features:**
- **Code Execution**: Run JavaScript in the context of the inspected page
- **Console Output**: View execution results and errors
- **Error Highlighting**: Visual distinction for errors and warnings
- **Command History**: Scroll through previous commands

**Actions:**
- Execute JavaScript code
- Clear console output
- Press Enter to execute (Shift+Enter for multi-line)

## Connection Management

### Manual Connection

Use the header buttons to control the WebSocket connection:

- **Connect Button**: Initiate connection to backend (ws://localhost:8765/browser)
- **Disconnect Button**: Close the connection
- **Refresh Button**: Reload all data from the background script

### Connection Status Indicators

The status badge in the header shows the current connection state:

- **Connected** (Green): Active WebSocket connection
- **Connecting** (Yellow, pulsing): Attempting to connect
- **Disconnected** (Gray): Not connected
- **Error** (Red): Connection failed

## Keyboard Shortcuts

- **Enter**: Execute console command
- **Shift+Enter**: New line in console input
- **Cmd/Ctrl+F**: Focus filter inputs (when applicable)

## Data Export

### Status Export
Exports current system status including:
- Connection state
- Network request count
- Task count
- Uptime
- Timestamp

### Network HAR Export
Exports network requests in HAR (HTTP Archive) format, compatible with:
- Chrome DevTools
- Firefox Developer Tools
- HAR analyzers (e.g., HTTP Archive Viewer)

### Audit Log Export
Exports all audit logs with timestamps and levels in JSON format.

## Best Practices

### Network Monitoring
1. Clear network requests periodically to avoid memory buildup
2. Use filters to focus on specific request types
3. Export to HAR for offline analysis

### Command Execution
1. Use templates as starting points
2. Format JSON before execution to catch syntax errors
3. Review command history to reuse successful commands

### Task Management
1. Monitor running tasks in real-time
2. Clear completed tasks to reduce clutter
3. Check task details for troubleshooting

### Audit Logging
1. Use log levels to filter noise
2. Export logs for debugging sessions
3. Monitor for errors and warnings

## Troubleshooting

### DevTools Panel Not Appearing

1. Reload the extension
2. Reload the inspected page
3. Close and reopen Chrome DevTools
4. Check that `devtools.html` is registered in manifest.json

### Connection Issues

1. Verify WebSocket server is running (default: ws://localhost:8765/browser)
2. Check browser console for errors
3. Review audit log for connection errors
4. Try manual reconnection using the Connect button

### Network Requests Not Captured

1. Ensure you're on the Network tab when requests occur
2. Reload the page to capture initial requests
3. Check that the extension has proper permissions
4. Review background script console for errors

### Commands Not Executing

1. Verify JSON syntax (use Format JSON button)
2. Check command history for error messages
3. Ensure connection is active
4. Review audit log for execution errors

## Performance Considerations

### Memory Management

The panel automatically limits stored data:
- Network requests: 500 maximum
- Audit logs: 1,000 maximum
- Console entries: 500 maximum
- Command history: 100 maximum

Older entries are automatically removed when limits are reached.

### Refresh Interval

The panel updates every 1 second when the Overview tab is active. Other tabs update on-demand to conserve resources.

## Integration with Existing Popup

The DevTools panel complements the existing popup.html:

- **Popup**: Quick status check, basic controls
- **DevTools Panel**: Advanced monitoring, debugging, command execution

Both interfaces communicate with the same background script and share state.

## Technical Details

### Architecture

```
devtools.html (Entry Point)
    ↓
devtools.js (Panel Creation)
    ↓
devtools-panel.html (UI Structure)
    ↓
devtools-panel.js (Logic & State Management)
devtools-panel.css (Dark Theme Styling)
```

### Message Flow

```
DevTools Panel → Runtime Messages → Background Script
                                          ↓
                                    WebSocket Server
                                          ↓
                                    Content Scripts
```

### Data Storage

- Network requests: In-memory (panel state)
- Audit logs: In-memory (panel state)
- Tasks: Synced from background script
- Connection status: Synced from background script

## Advanced Features

### Custom Command Templates

Add your own command templates by modifying `COMMAND_TEMPLATES` in `devtools-panel.js`:

```javascript
const COMMAND_TEMPLATES = {
  myCustomCommand: {
    type: 'custom',
    data: 'example'
  }
};
```

### Network Request Filtering

Advanced filtering can be performed programmatically:

```javascript
// In devtools-panel.js
const filteredRequests = state.networkRequests.filter(req => {
  // Custom filter logic
  return req.url.includes('api') && req.status === 200;
});
```

### Custom Audit Logging

Add custom audit logs from other parts of the extension:

```javascript
chrome.runtime.sendMessage({
  type: 'extension_log',
  level: 'info',
  message: 'Custom log message'
});
```

## Future Enhancements

Potential future features:
- Request/response body editing and replay
- WebSocket message inspection
- Performance profiling
- Visual request timeline
- Cookie management
- Local storage inspection
- Service worker debugging

## Support

For issues or questions:
1. Check the audit log for error messages
2. Review the browser console for extension errors
3. Export status/logs for debugging
4. Check the background script console

## Version History

- **v1.0.0**: Initial DevTools panel implementation
  - Overview, Network, Commands, Tasks, Audit, Console tabs
  - Dark theme matching Chrome DevTools
  - Real-time monitoring and command execution
  - HAR export and JSON data export
