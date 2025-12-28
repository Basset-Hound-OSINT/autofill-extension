# Development Tools

This directory contains development and debugging tools for the browser automation extension.

## Error Monitor

The `error-monitor.js` script connects to Chrome's remote debugging port and streams console errors and exceptions to your terminal in real-time. This is particularly useful for monitoring extension background service workers and content scripts.

### Prerequisites

Install the required dependency:

```bash
npm install chrome-remote-interface
```

### Launching Chrome with Remote Debugging

#### Windows

**Option 1: Command Line**

Close all Chrome windows first, then run:

```cmd
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

Or for Chrome installed in Program Files (x86):

```cmd
"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

**Option 2: Create a Shortcut**

1. Right-click on your desktop and select "New" > "Shortcut"
2. Enter the path: `"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222`
3. Name it "Chrome Debug"
4. Use this shortcut to launch Chrome with debugging enabled

**Option 3: PowerShell Script**

```powershell
# First, close all Chrome instances
Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force

# Wait a moment
Start-Sleep -Seconds 2

# Launch Chrome with remote debugging
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList "--remote-debugging-port=9222"
```

#### macOS

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

#### Linux

```bash
google-chrome --remote-debugging-port=9222
# or
chromium-browser --remote-debugging-port=9222
```

### Verifying Chrome is Ready

After launching Chrome with remote debugging, verify it's working by visiting:

```
http://localhost:9222/json
```

You should see a JSON array listing available debugging targets.

### Running the Error Monitor

**Basic Usage (Interactive)**

```bash
node tools/error-monitor.js
```

This will show a list of available targets (pages, service workers, etc.) and let you select one to monitor.

**Auto-connect to Extension**

```bash
node tools/error-monitor.js --auto
```

Automatically connects to the first extension service worker found.

**Monitor All Targets**

```bash
node tools/error-monitor.js --all
```

Monitors all available targets simultaneously.

**Custom Host/Port**

```bash
node tools/error-monitor.js --host localhost --port 9222
```

**Filter by Target Type**

```bash
node tools/error-monitor.js --filter service_worker
node tools/error-monitor.js --filter page
```

### Command Line Options

| Option | Short | Description |
|--------|-------|-------------|
| `--host` | `-h` | Chrome debugging host (default: localhost) |
| `--port` | `-p` | Chrome debugging port (default: 9222) |
| `--auto` | `-a` | Auto-connect to extension service worker |
| `--all` | | Monitor all available targets |
| `--filter` | `-f` | Filter by target type (page, service_worker, worker, other) |
| `--help` | | Show help message |

### SSH Tunnel for Remote Debugging

If Chrome is running on a remote machine (or a different WSL instance), you can use SSH tunneling for secure access.

**Scenario 1: Chrome on Remote Windows, Monitor from WSL/Linux**

On your local machine, create an SSH tunnel:

```bash
ssh -L 9222:localhost:9222 user@remote-machine
```

Then run the error monitor:

```bash
node tools/error-monitor.js --host localhost --port 9222
```

**Scenario 2: Chrome on Windows Host, Monitor from WSL**

Since WSL can access Windows localhost directly, you can usually connect directly:

```bash
node tools/error-monitor.js --host localhost --port 9222
```

If that doesn't work, try using the Windows host IP:

```bash
# Get Windows host IP (usually in /etc/resolv.conf)
WINDOWS_HOST=$(cat /etc/resolv.conf | grep nameserver | awk '{print $2}')
node tools/error-monitor.js --host $WINDOWS_HOST --port 9222
```

**Scenario 3: Remote Server with SSH Tunnel**

```bash
# Create tunnel (run in separate terminal or background)
ssh -N -L 9222:localhost:9222 user@remote-server &

# Connect via tunnel
node tools/error-monitor.js --host 127.0.0.1 --port 9222
```

### Output Format

The error monitor displays:

- **Timestamp**: When the event occurred
- **Level**: ERROR, WARN, INFO, LOG, DEBUG, or EXCEPTION
- **Target**: Which page/service worker generated the message
- **Message**: The actual log message or error
- **Source**: File and line number where the log originated
- **Stack Trace**: For errors and exceptions

Example output:

```
[14:32:15.123]  ERROR  [Extension Background] Failed to connect to WebSocket
         at chrome-extension://abc123.../background.js:156:12
Stack trace:
  0: connectWebSocket at chrome-extension://abc123.../background.js:156:12
  1: initialize at chrome-extension://abc123.../background.js:42:5

[14:32:16.456]  WARN   [Extension Background] Retrying connection in 5 seconds

[14:32:21.789]  INFO   [Extension Background] WebSocket connected successfully
```

### Auto-Reconnection

The monitor automatically attempts to reconnect if the connection drops (e.g., when the extension reloads). It will:

1. Wait 2 seconds after disconnection
2. Refresh the target list
3. Find a matching target by URL or type
4. Reconnect and resume monitoring

### Troubleshooting

**"ECONNREFUSED" Error**

Chrome is not running or remote debugging is not enabled. Make sure:
- Chrome is launched with `--remote-debugging-port=9222`
- No other Chrome instance was running before (close all Chrome windows first)
- The port is not blocked by a firewall

**"No targets available"**

Chrome is running but there are no debuggable targets. Try:
- Opening a new tab
- Loading your extension
- Refreshing the page

**Cannot connect to extension service worker**

Service workers may not appear immediately. Try:
- Opening the extension popup
- Triggering some extension activity
- Checking `chrome://extensions` and clicking "Inspect views: service worker"

**Connection keeps dropping**

This is normal when:
- The extension reloads (after code changes)
- Chrome restarts
- The service worker goes idle (Chrome may suspend it)

The monitor will automatically attempt to reconnect.

### Security Notes

- Remote debugging should only be enabled in development environments
- Never expose the debugging port to untrusted networks
- Use SSH tunnels for remote access
- Close Chrome and restart without the debugging flag when done developing
