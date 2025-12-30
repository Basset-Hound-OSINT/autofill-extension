# Basset Hound MCP Server - Installation Guide

Complete installation and deployment guide for the Basset Hound MCP Server.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation Methods](#installation-methods)
3. [Configuration](#configuration)
4. [Verification](#verification)
5. [Integration with Claude Desktop](#integration-with-claude-desktop)
6. [Troubleshooting](#troubleshooting)
7. [Uninstallation](#uninstallation)

---

## Prerequisites

### Required Software

1. **Node.js** (version 16.0.0 or higher)
   ```bash
   # Check your Node.js version
   node --version

   # If not installed or outdated:
   # Ubuntu/Debian:
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # macOS (with Homebrew):
   brew install node

   # Windows:
   # Download from https://nodejs.org/
   ```

2. **Google Chrome** (latest version)
   ```bash
   # Check Chrome version
   google-chrome --version  # Linux
   # or open chrome://version in Chrome
   ```

3. **Basset Hound Chrome Extension**
   - Must be installed and loaded in Chrome
   - Extension directory: `/home/devel/autofill-extension`

### Optional Software

1. **MCP Inspector** (for debugging)
   ```bash
   npm install -g @modelcontextprotocol/inspector
   ```

2. **Claude Desktop** (for AI agent integration)
   - Download from https://claude.ai/download

---

## Installation Methods

### Method 1: NPM Install (Recommended)

```bash
# Navigate to MCP server directory
cd /home/devel/autofill-extension/mcp-server

# Install dependencies
npm install

# Verify installation
npm test
```

Expected output:
```
=== Basset Hound MCP Server Test Suite ===

Starting MCP server...
✓ Server is ready

Running tests...

Testing: Initialize
  ✓ PASSED

Testing: List Tools
  ✓ PASSED
    Found 80+ tools

Testing: Invalid Method
  ✓ PASSED

=== Test Summary ===
Passed: 3/3
```

### Method 2: Manual Setup

If you prefer manual setup:

```bash
cd /home/devel/autofill-extension/mcp-server

# Install ws package manually
npm install ws@^8.18.0

# Make scripts executable
chmod +x index.js
chmod +x test-server.js

# Test the server
node index.js
```

### Method 3: Global Installation

To make the server available system-wide:

```bash
cd /home/devel/autofill-extension/mcp-server

# Install dependencies
npm install

# Link globally
npm link

# Now you can run from anywhere:
basset-hound-mcp
```

---

## Configuration

### Step 1: Chrome Extension Setup

1. **Load the extension in Chrome:**
   ```bash
   # Open Chrome and navigate to:
   chrome://extensions

   # Enable "Developer mode" (toggle in top-right)
   # Click "Load unpacked"
   # Select: /home/devel/autofill-extension
   ```

2. **Verify extension is loaded:**
   - Look for "Basset Hound Browser Automation" in the extensions list
   - Extension should be enabled (toggle is blue)
   - No errors should be displayed

3. **Check WebSocket server:**
   ```bash
   # Click "service worker" or "background page" link
   # In the console, look for:
   # "WebSocket server listening on port 8765"
   ```

### Step 2: MCP Server Configuration

The server uses environment variables for configuration:

```bash
# Create a .env file (optional)
cat > .env << EOF
WS_URL=ws://localhost:8765
DEBUG=false
COMMAND_TIMEOUT=30000
RECONNECT_DELAY=5000
MAX_RECONNECT_ATTEMPTS=10
EOF
```

Or use command-line:

```bash
# Run with custom config
WS_URL=ws://localhost:9000 DEBUG=true node index.js
```

### Step 3: Test Connection

```bash
# Quick test
npm run test:quick

# Full test suite
npm test

# Development mode (with debug logging)
npm run dev
```

---

## Verification

### Verify Server is Working

1. **Start the server:**
   ```bash
   cd /home/devel/autofill-extension/mcp-server
   npm start
   ```

2. **Expected output:**
   ```
   [INFO] 2025-12-29T... Basset Hound MCP Server starting...
   [INFO] 2025-12-29T... Configuration: {
     WS_URL: 'ws://localhost:8765',
     COMMAND_TIMEOUT: 30000,
     DEBUG: false
   }
   [INFO] 2025-12-29T... Connecting to Basset Hound extension at ws://localhost:8765
   [INFO] 2025-12-29T... Connected to Basset Hound extension
   [INFO] 2025-12-29T... MCP Server ready and listening for requests
   ```

3. **Test MCP protocol:**
   ```bash
   # In another terminal
   echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","clientInfo":{"name":"test","version":"1.0.0"}}}' | npm run start
   ```

   Expected response (JSON):
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "result": {
       "protocolVersion": "2024-11-05",
       "capabilities": { "tools": { "listChanged": false } },
       "serverInfo": { "name": "basset-hound-mcp", "version": "1.0.0" }
     }
   }
   ```

### Verify WebSocket Connection

```bash
# Install wscat if not already installed
npm install -g wscat

# Test WebSocket connection
wscat -c ws://localhost:8765

# You should connect successfully
# Try sending a command:
{"command_id":"test_1","type":"get_page_state","params":{}}
```

---

## Integration with Claude Desktop

### Step 1: Locate Claude Config File

Find your Claude Desktop configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```bash
# macOS
nano ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Linux
nano ~/.config/Claude/claude_desktop_config.json
```

### Step 2: Add MCP Server Configuration

Create or edit the file:

```json
{
  "mcpServers": {
    "basset-hound": {
      "command": "node",
      "args": ["/home/devel/autofill-extension/mcp-server/index.js"]
    }
  }
}
```

**Important Notes:**
- Use the **absolute path** to `index.js`
- Replace `/home/devel` with your actual home directory if different
- Ensure the JSON is valid (use a JSON validator if needed)

### Step 3: Advanced Configuration

For custom settings:

```json
{
  "mcpServers": {
    "basset-hound": {
      "command": "node",
      "args": ["/home/devel/autofill-extension/mcp-server/index.js"],
      "env": {
        "WS_URL": "ws://localhost:8765",
        "DEBUG": "false",
        "COMMAND_TIMEOUT": "60000"
      }
    }
  }
}
```

### Step 4: Restart Claude Desktop

1. Quit Claude completely (don't just close the window)
2. Start Claude Desktop again
3. Open a new conversation

### Step 5: Verify in Claude

1. Look for the tools/hammer icon in the message input area
2. Click it to see available MCP servers
3. You should see "basset-hound" with 80+ tools
4. Try a test command:
   ```
   Use the basset-hound navigate tool to go to example.com
   ```

---

## Troubleshooting

### Issue: npm install fails

**Error:** Cannot find module 'ws'

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install

# If still failing, install ws directly
npm install ws@8.18.0 --save
```

### Issue: Server won't start

**Error:** "ECONNREFUSED" or "Cannot connect to extension"

**Solutions:**

1. **Check Chrome extension is loaded:**
   ```bash
   # In Chrome: chrome://extensions
   # Verify "Basset Hound Browser Automation" is enabled
   ```

2. **Check WebSocket port:**
   ```bash
   # Click "service worker" in extension
   # Look for WebSocket server port in console
   # Update WS_URL if different from 8765
   ```

3. **Check firewall:**
   ```bash
   # On Linux:
   sudo ufw allow from 127.0.0.1

   # Test with telnet:
   telnet localhost 8765
   ```

### Issue: Claude doesn't show tools

**Solutions:**

1. **Verify config file exists:**
   ```bash
   # macOS
   ls -la ~/Library/Application\ Support/Claude/claude_desktop_config.json

   # Linux
   ls -la ~/.config/Claude/claude_desktop_config.json
   ```

2. **Validate JSON syntax:**
   ```bash
   # Use Python to validate
   python3 -m json.tool < claude_desktop_config.json

   # Or use online validator
   # Copy/paste config to https://jsonlint.com/
   ```

3. **Check absolute path:**
   ```bash
   # Verify file exists at specified path
   ls -la /home/devel/autofill-extension/mcp-server/index.js

   # Update path if needed
   pwd  # in mcp-server directory
   ```

4. **Check Claude logs:**
   ```bash
   # macOS
   tail -f ~/Library/Logs/Claude/mcp*.log

   # Linux
   tail -f ~/.config/Claude/logs/mcp*.log

   # Look for error messages
   ```

5. **Restart Claude completely:**
   - Quit (not just close)
   - Kill any background processes
   - Start fresh

### Issue: Commands timeout

**Solutions:**

1. **Increase timeout:**
   ```json
   {
     "mcpServers": {
       "basset-hound": {
         "command": "node",
         "args": ["/home/devel/autofill-extension/mcp-server/index.js"],
         "env": {
           "COMMAND_TIMEOUT": "60000"
         }
       }
     }
   }
   ```

2. **Check page is loaded:**
   - Use `wait_for_element` before interacting
   - Ensure Chrome is not frozen
   - Check extension background page for errors

### Issue: Permission denied

**Error:** "EACCES: permission denied"

**Solution:**
```bash
# Make scripts executable
chmod +x /home/devel/autofill-extension/mcp-server/index.js
chmod +x /home/devel/autofill-extension/mcp-server/test-server.js

# Or run with node explicitly
node /home/devel/autofill-extension/mcp-server/index.js
```

---

## Uninstallation

### Remove MCP Server

```bash
# If globally linked:
npm unlink basset-hound-mcp

# Remove from Claude config
# Edit claude_desktop_config.json and remove "basset-hound" entry

# Remove server files (optional)
rm -rf /home/devel/autofill-extension/mcp-server

# Or keep the code and just remove node_modules:
rm -rf /home/devel/autofill-extension/mcp-server/node_modules
```

### Remove from Claude Desktop

Edit `claude_desktop_config.json` and remove the `basset-hound` entry:

```json
{
  "mcpServers": {}
}
```

Then restart Claude Desktop.

---

## Post-Installation

### Next Steps

1. **Read documentation:**
   - See `README.md` for detailed usage
   - See `QUICKSTART.md` for quick start guide
   - See `examples.md` for usage examples

2. **Try examples:**
   ```
   # In Claude Desktop:
   Navigate to example.com and tell me what you see
   ```

3. **Explore tools:**
   ```
   # In Claude Desktop:
   List all available basset-hound tools
   ```

4. **Join community:**
   - Check extension GitHub repository
   - Report issues or suggest features

### Monitoring

Check server health:

```bash
# Enable debug logging
DEBUG=true npm start

# Monitor Claude logs
tail -f ~/Library/Logs/Claude/mcp*.log  # macOS
tail -f ~/.config/Claude/logs/mcp*.log  # Linux
```

### Updates

To update the MCP server:

```bash
cd /home/devel/autofill-extension/mcp-server

# Pull latest changes (if in git repo)
git pull

# Update dependencies
npm install

# Test
npm test

# Restart Claude Desktop to pick up changes
```

---

## Support

- **Documentation**: See `/home/devel/autofill-extension/docs/`
- **Extension Docs**: See `QUICK_REFERENCE.md`
- **MCP Protocol**: https://modelcontextprotocol.io
- **Issues**: Check extension GitHub repository

---

**Installation Guide Version**: 1.0.0
**Last Updated**: 2025-12-29
**Tested On**: Ubuntu 22.04, macOS 14, Windows 11
