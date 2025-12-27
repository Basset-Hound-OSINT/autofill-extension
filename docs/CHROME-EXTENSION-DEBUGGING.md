# Chrome Extension Debugging Guide for Linux

This guide covers practical debugging techniques for Chrome extensions in a Linux environment.

## Table of Contents

1. [Local Debugging Methods](#local-debugging-methods)
2. [Remote Debugging](#remote-debugging)
3. [Log Files in Linux](#log-files-in-linux)
4. [Command Line Flags for Debugging](#command-line-flags-for-debugging)
5. [Common Extension Errors](#common-extension-errors)
6. [Monitoring the Basset Hound Extension](#monitoring-the-basset-hound-extension)

---

## Local Debugging Methods

### Enabling Developer Mode

1. Open Chrome and navigate to `chrome://extensions`
2. Toggle **Developer mode** in the top-right corner
3. Click **Load unpacked** to load your extension from a local directory
4. Note the extension ID assigned (you will need this for debugging)

### Inspecting the Service Worker (MV3)

For Manifest V3 extensions, the background script runs as a service worker:

1. Go to `chrome://extensions`
2. Find your extension and look for **Inspect views: service worker**
3. Click the link to open DevTools for the service worker
4. The Console tab shows `console.log()` output from the service worker

**Note:** If the service worker is inactive, you may need to trigger it (e.g., by clicking the extension icon or reloading).

### Console.log Output Locations

Different extension components log to different places:

| Component | How to Access Console |
|-----------|----------------------|
| Service Worker | `chrome://extensions` > Inspect views: service worker |
| Popup | Right-click popup > Inspect |
| Content Scripts | Page DevTools (F12) > Console (filtered by extension context) |
| Options Page | Right-click options page > Inspect |

**Content Script Tip:** In the page's DevTools Console, use the context dropdown (usually shows "top") to select your extension's context and see its logs.

### Using Chrome DevTools for Extensions

Open DevTools for any extension component and you have access to:

- **Console**: View logs, errors, and execute JavaScript
- **Sources**: Set breakpoints in your extension code
- **Network**: Monitor requests made by the extension
- **Application**: Inspect storage (localStorage, chrome.storage, IndexedDB)

To debug content scripts:
1. Open DevTools on the page where content script runs (F12)
2. Go to Sources > Content scripts (in left sidebar)
3. Find your extension and set breakpoints

---

## Remote Debugging

### Starting Chrome with Remote Debugging

Launch Chrome with the remote debugging port enabled:

```bash
google-chrome --remote-debugging-port=9222
```

Or for Chrome Beta/Dev/Canary:

```bash
google-chrome-beta --remote-debugging-port=9222
google-chrome-unstable --remote-debugging-port=9222
```

With additional useful flags:

```bash
google-chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-debug-profile \
  --no-first-run
```

### Connecting from Another Machine

1. On the remote machine (where Chrome is running), start Chrome with:

```bash
google-chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0
```

**Security Warning:** Binding to 0.0.0.0 exposes the debugging port to the network. Use SSH tunneling instead for security.

2. On your local machine, open Chrome and navigate to:

```
http://REMOTE_IP:9222
```

Or use `chrome://inspect` and configure the remote target.

### Using chrome://inspect for Remote Debugging

1. Open `chrome://inspect` in your local Chrome
2. Click **Configure...** next to "Discover network targets"
3. Add `REMOTE_IP:9222` (or `localhost:9222` if using SSH tunnel)
4. Remote tabs and extensions appear under "Remote Target"
5. Click **inspect** to open DevTools

### SSH Port Forwarding (Recommended for Security)

Instead of exposing port 9222 to the network, use SSH tunneling:

```bash
# On your local machine, create an SSH tunnel
ssh -L 9222:localhost:9222 user@remote-server
```

Then on the remote server, start Chrome:

```bash
google-chrome --remote-debugging-port=9222
```

Now on your local machine, access `http://localhost:9222` or use `chrome://inspect` with `localhost:9222`.

---

## Log Files in Linux

### Chrome User Data Directory Structure

Chrome stores user data in `~/.config/google-chrome/`:

```
~/.config/google-chrome/
├── Default/                    # Default profile
│   ├── Extensions/            # Installed extensions
│   │   └── <extension-id>/    # Each extension by ID
│   │       └── <version>/     # Version-specific files
│   ├── Local Storage/         # localStorage data
│   ├── IndexedDB/            # IndexedDB databases
│   └── Preferences           # Profile preferences (JSON)
├── chrome_debug.log          # Debug log (when enabled)
├── Local State               # Browser-wide state
└── Crash Reports/            # Crash dumps
```

For Chromium:

```
~/.config/chromium/
```

### Enabling chrome_debug.log

Start Chrome with logging enabled:

```bash
google-chrome --enable-logging --v=1
```

The log file is created at:

```
~/.config/google-chrome/chrome_debug.log
```

To watch logs in real-time:

```bash
tail -f ~/.config/google-chrome/chrome_debug.log
```

Filter for extension-related messages:

```bash
tail -f ~/.config/google-chrome/chrome_debug.log | grep -i extension
```

### Log Verbosity Levels

- `--v=0`: Default (minimal logging)
- `--v=1`: Verbose (recommended for debugging)
- `--v=2`: Very verbose
- `--vmodule=extensions=2`: Verbose logging for specific modules

Example for extension-focused logging:

```bash
google-chrome --enable-logging --vmodule=extensions=2,content_script=2
```

### Extension-Specific Logs

Extensions do not have separate log files. All extension logs go to:

1. The DevTools Console for that component
2. `chrome_debug.log` when logging is enabled

To log from your extension to a file, you can use the downloads API or native messaging to write to disk.

### Crash Reports Location

Chrome crash reports are stored in:

```
~/.config/google-chrome/Crash Reports/
├── completed/     # Uploaded crash reports
├── pending/       # Pending upload
└── new/          # Fresh crash dumps
```

View crash reports at `chrome://crashes`.

---

## Command Line Flags for Debugging

### Essential Debugging Flags

```bash
# Enable logging with verbosity level 1
google-chrome --enable-logging --v=1

# Remote debugging on port 9222
google-chrome --remote-debugging-port=9222

# Load an unpacked extension
google-chrome --load-extension=/path/to/extension

# Load only specific extension(s), disabling all others
google-chrome --disable-extensions-except=/path/to/extension --load-extension=/path/to/extension
```

### Complete Debugging Launch Command

```bash
google-chrome \
  --enable-logging \
  --v=1 \
  --remote-debugging-port=9222 \
  --load-extension=/home/devel/autofill-extension \
  --disable-extensions-except=/home/devel/autofill-extension \
  --user-data-dir=/tmp/chrome-extension-debug \
  --no-first-run \
  --auto-open-devtools-for-tabs
```

### Flag Reference

| Flag | Purpose |
|------|---------|
| `--enable-logging` | Enable logging to chrome_debug.log |
| `--v=1` | Set verbosity level (0-2) |
| `--remote-debugging-port=9222` | Enable remote debugging protocol |
| `--load-extension=/path` | Load unpacked extension at startup |
| `--disable-extensions-except=/path` | Disable all extensions except specified |
| `--user-data-dir=/path` | Use separate profile directory |
| `--no-first-run` | Skip first-run dialogs |
| `--auto-open-devtools-for-tabs` | Auto-open DevTools for each tab |
| `--disable-web-security` | Disable same-origin policy (dangerous) |
| `--allow-file-access-from-files` | Allow file:// access (for testing) |

### Creating a Debug Script

Create a reusable debug script:

```bash
#!/bin/bash
# debug-extension.sh

EXTENSION_PATH="${1:-/home/devel/autofill-extension}"
DEBUG_PROFILE="/tmp/chrome-ext-debug-$$"

google-chrome \
  --enable-logging \
  --v=1 \
  --remote-debugging-port=9222 \
  --load-extension="$EXTENSION_PATH" \
  --disable-extensions-except="$EXTENSION_PATH" \
  --user-data-dir="$DEBUG_PROFILE" \
  --no-first-run

# Cleanup on exit
rm -rf "$DEBUG_PROFILE"
```

Make it executable:

```bash
chmod +x debug-extension.sh
./debug-extension.sh /path/to/your/extension
```

---

## Common Extension Errors

### importScripts Failures in MV3

**Error:** `Uncaught (in promise) Error: Failed to load script`

**Causes:**
- File path is incorrect or file does not exist
- Syntax error in the imported script
- Trying to import from external URLs (not allowed in MV3)

**Solutions:**

1. Verify file exists and path is correct:
```javascript
// In service worker
importScripts('utils/helper.js');  // Relative to service worker location
```

2. Check for syntax errors in the imported file:
```bash
# Use Node.js to check syntax
node --check utils/helper.js
```

3. All scripts must be bundled with the extension (no external imports)

4. Check for circular dependencies between imported scripts

**Debug Tip:** Add console.log at the start of each imported file to trace loading order.

### Duplicate Declarations in Service Worker Scope

**Error:** `Identifier 'X' has already been declared`

**Causes:**
- Multiple `importScripts()` loading the same file
- Variable declared in multiple imported files
- Re-importing a script that was already imported

**Solutions:**

1. Use a module pattern to prevent duplicate declarations:
```javascript
// utils/helper.js
if (typeof window.helperLoaded === 'undefined') {
  window.helperLoaded = true;

  // Your code here
  function myHelper() { ... }
}
```

2. Track loaded scripts:
```javascript
// service-worker.js
const loadedScripts = new Set();

function safeImport(script) {
  if (!loadedScripts.has(script)) {
    loadedScripts.add(script);
    importScripts(script);
  }
}
```

3. Consider using ES modules if your extension supports it (requires `"type": "module"` in manifest).

### Content Script Injection Errors

**Error:** `Cannot access contents of the page. Extension manifest must request permission to access the respective host.`

**Solutions:**

1. Check manifest.json permissions:
```json
{
  "permissions": ["activeTab", "scripting"],
  "host_permissions": ["<all_urls>"]
}
```

2. For specific sites only:
```json
{
  "host_permissions": [
    "https://example.com/*",
    "https://*.example.org/*"
  ]
}
```

**Error:** `Cannot access a chrome:// URL`

Chrome internal pages (chrome://, chrome-extension://, etc.) cannot be accessed by content scripts. This is by design.

**Error:** `Content script not injecting`

Debug steps:
1. Check `content_scripts` in manifest.json matches the URL pattern
2. Verify the `matches` pattern is correct
3. Check `run_at` timing (document_start, document_end, document_idle)
4. Look for errors in the page's DevTools Console

```json
{
  "content_scripts": [{
    "matches": ["https://*/*", "http://*/*"],
    "js": ["content.js"],
    "run_at": "document_end"
  }]
}
```

### CSP (Content Security Policy) Violations

**Error:** `Refused to execute inline script because it violates the following Content Security Policy directive`

**Common Causes:**

1. **Inline scripts in HTML files:**
```html
<!-- This will fail -->
<button onclick="doSomething()">Click</button>

<!-- Do this instead -->
<button id="myButton">Click</button>
<script src="popup.js"></script>
```

2. **eval() or new Function():**
```javascript
// This will fail
eval('console.log("test")');

// This will also fail
new Function('return 1 + 1')();
```

3. **Inline styles with certain properties:**
Some CSS properties may be restricted.

**MV3 CSP Requirements:**

Manifest V3 enforces a strict CSP. You cannot relax it for remote code:

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

**Solutions:**

1. Move all JavaScript to external files
2. Use event listeners instead of inline handlers:
```javascript
// popup.js
document.getElementById('myButton').addEventListener('click', doSomething);
```

3. Avoid eval() and use safer alternatives:
```javascript
// Instead of eval for JSON
const data = JSON.parse(jsonString);
```

### Service Worker Lifecycle Issues

**Error:** Service worker becomes inactive and loses state

**Cause:** MV3 service workers are ephemeral and can be terminated when idle.

**Solutions:**

1. Use `chrome.storage` instead of global variables:
```javascript
// Instead of:
let myState = {};

// Use:
chrome.storage.local.get('myState', (result) => {
  const myState = result.myState || {};
});
```

2. Use alarms to keep the service worker alive (if necessary):
```javascript
chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // Minimal work to stay alive
  }
});
```

3. Properly handle service worker startup:
```javascript
chrome.runtime.onStartup.addListener(() => {
  // Initialize state from storage
});

chrome.runtime.onInstalled.addListener(() => {
  // Set up initial state
});
```

---

## Monitoring the Basset Hound Extension

This section documents specific techniques for monitoring and debugging the Basset Hound autofill extension.

### Extension ID Discovery

Extension IDs change when an extension is reinstalled, so you need to discover the current ID dynamically.

**Finding the current extension ID:**

```bash
ls -la ~/.config/google-chrome/Default/Local\ Extension\ Settings/
```

**Finding the most recently active extension by modification time:**

```bash
ls -lt ~/.config/google-chrome/Default/Local\ Extension\ Settings/
```

The most recently modified directory is likely the extension you are actively debugging.

### Reading Extension Logs

The extension stores structured JSON logs in LevelDB format within its settings directory.

**Log location:**

```
~/.config/google-chrome/Default/Local Extension Settings/[EXTENSION_ID]/
```

**Command to read logs:**

```bash
strings ~/.config/google-chrome/Default/Local\ Extension\ Settings/[ID]/*.log
```

This extracts readable strings from the LevelDB log files, which include the extension's structured JSON log entries.

### WebSocket Server Monitoring

The Basset Hound extension communicates with a local WebSocket server for autofill data.

**Server location:**

```
~/Desktop/autofill-extension/server/ws-server.js
```

**Start the server:**

```bash
cd ~/Desktop/autofill-extension/server && node ws-server.js
```

**Monitor connections:**

```bash
tail -f ~/Desktop/autofill-extension/server/ws-server.log
```

The server log shows when clients connect and what messages they send, which is useful for debugging communication issues.

### Real-time Monitoring Commands

```bash
# Find current extension ID (most recently modified)
for dir in ~/.config/google-chrome/Default/Local\ Extension\ Settings/*/; do
  if [ -f "${dir}000003.log" ]; then
    mtime=$(stat -c %Y "${dir}000003.log" 2>/dev/null)
    echo "$mtime $dir"
  fi
done | sort -rn | head -1

# Watch extension logs in real-time
watch -n 5 'strings ~/.config/google-chrome/Default/Local\ Extension\ Settings/[ID]/*.log | tail -20'

# Monitor WebSocket server
tail -f ~/Desktop/autofill-extension/server/ws-server.log
```

Replace `[ID]` with the actual extension ID discovered using the first command.

### Remote Monitoring via SSH

All the monitoring commands above can be run remotely via SSH, which is useful for monitoring extensions on headless or remote systems.

**Example remote commands:**

```bash
# Read extension logs remotely
ssh user@host "strings ~/.config/google-chrome/Default/Local\ Extension\ Settings/[ID]/*.log"

# Monitor WebSocket server remotely
ssh user@host "tail -f ~/Desktop/autofill-extension/server/ws-server.log"

# Find extension ID remotely
ssh user@host "ls -lt ~/.config/google-chrome/Default/Local\ Extension\ Settings/"
```

For persistent monitoring, consider using `ssh -t` with `tmux` or `screen` to maintain the session.

---

## Quick Reference

### Debug Checklist

1. [ ] Enable Developer mode in `chrome://extensions`
2. [ ] Load extension unpacked
3. [ ] Open service worker DevTools
4. [ ] Check Console for errors
5. [ ] Verify manifest.json permissions
6. [ ] Test in fresh profile with `--user-data-dir`
7. [ ] Enable logging with `--enable-logging --v=1`
8. [ ] Check `chrome_debug.log` for additional errors

### Useful Chrome URLs

| URL | Purpose |
|-----|---------|
| `chrome://extensions` | Manage extensions, enable Developer mode |
| `chrome://inspect` | Inspect remote targets and service workers |
| `chrome://crashes` | View crash reports |
| `chrome://net-internals` | Network debugging |
| `chrome://serviceworker-internals` | Service worker details |
| `chrome://process-internals` | Process and frame information |

### Log Monitoring Commands

```bash
# Watch chrome debug log
tail -f ~/.config/google-chrome/chrome_debug.log

# Filter for errors
tail -f ~/.config/google-chrome/chrome_debug.log | grep -i error

# Filter for extension messages
tail -f ~/.config/google-chrome/chrome_debug.log | grep -i extension

# Watch with timestamps
tail -f ~/.config/google-chrome/chrome_debug.log | ts '[%Y-%m-%d %H:%M:%S]'
```
