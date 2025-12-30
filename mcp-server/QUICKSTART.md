# Basset Hound MCP Server - Quick Start Guide

Get the MCP server running with Claude in under 5 minutes.

## Prerequisites

1. **Chrome with Basset Hound Extension**
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `/home/devel/autofill-extension`
   - Extension should show as loaded and active

2. **Node.js** (version 16+)
   ```bash
   node --version  # Should be 16.0.0 or higher
   ```

3. **Claude Desktop App** (for AI agent integration)

## Installation

### Step 1: Install Dependencies

```bash
cd /home/devel/autofill-extension/mcp-server
npm install
```

This installs the `ws` (WebSocket) package needed for communication with the extension.

### Step 2: Test the Server

```bash
# Test basic functionality
npm test

# Or run manually
node index.js
```

You should see:
```
[INFO] 2025-12-29T... Basset Hound MCP Server starting...
[INFO] 2025-12-29T... Connecting to Basset Hound extension at ws://localhost:8765
[INFO] 2025-12-29T... Connected to Basset Hound extension
[INFO] 2025-12-29T... MCP Server ready and listening for requests
```

If you see connection errors, make sure the Chrome extension is loaded and active.

### Step 3: Configure Claude Desktop

1. **Locate your Claude config file:**
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Edit the config file** (create it if it doesn't exist):

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

**Important**: Use the full absolute path to `index.js` on your system.

3. **Restart Claude Desktop** completely:
   - Quit Claude (not just close the window)
   - Start Claude again

### Step 4: Verify in Claude

1. Open a new conversation in Claude Desktop

2. Look for the tools icon (hammer/wrench icon) in the input area

3. You should see "basset-hound" in the list of available tools

4. Click to expand and see 80+ browser automation tools

## First Commands

### Test 1: Navigate to a Website

In Claude Desktop, try:

```
Navigate to example.com and tell me what you see
```

Claude should:
1. Use the `navigate` tool to go to example.com
2. Use `get_page_state` to extract page information
3. Tell you about the page content

### Test 2: Fill a Form

```
Go to https://httpbin.org/forms/post and fill out the form with:
- Customer name: John Doe
- Telephone: 555-1234
- Email: john@example.com
- Pizza size: Large
```

Claude should:
1. Navigate to the URL
2. Detect the form using `detect_forms`
3. Fill it using `auto_fill_form` or individual field commands
4. Report success

### Test 3: Take a Screenshot

```
Navigate to google.com and take a screenshot
```

Claude should:
1. Navigate to Google
2. Use the `screenshot` tool
3. Return the screenshot as base64 (which Claude can view)

## Configuration Options

### Custom WebSocket Port

If your extension uses a different port:

```json
{
  "mcpServers": {
    "basset-hound": {
      "command": "node",
      "args": ["/home/devel/autofill-extension/mcp-server/index.js"],
      "env": {
        "WS_URL": "ws://localhost:9000"
      }
    }
  }
}
```

### Enable Debug Logging

To see detailed logs for troubleshooting:

```json
{
  "mcpServers": {
    "basset-hound": {
      "command": "node",
      "args": ["/home/devel/autofill-extension/mcp-server/index.js"],
      "env": {
        "DEBUG": "true"
      }
    }
  }
}
```

Check Claude's logs to see debug output:
- **macOS**: `~/Library/Logs/Claude/mcp*.log`
- **Linux**: `~/.config/Claude/logs/mcp*.log`

### Increase Command Timeout

For slow websites or complex operations:

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

This sets a 60-second timeout instead of the default 30 seconds.

## Troubleshooting

### Issue: "WebSocket not connected" errors

**Solution:**
1. Check Chrome extension is loaded:
   ```bash
   # In Chrome, go to chrome://extensions
   # Look for "Basset Hound Browser Automation"
   # It should be enabled and show no errors
   ```

2. Check extension background page:
   ```bash
   # In chrome://extensions
   # Click "service worker" link under Basset Hound
   # Look for WebSocket server logs
   ```

3. Verify WebSocket server is running in extension:
   - The extension automatically starts a WebSocket server on port 8765
   - You should see "WebSocket server listening on port 8765" in the background page console

### Issue: Tools not showing in Claude

**Solution:**
1. Verify config file path is correct:
   ```bash
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. Check JSON syntax is valid:
   ```bash
   # Use an online JSON validator or:
   python3 -m json.tool < claude_desktop_config.json
   ```

3. Make sure you used absolute paths:
   - ✅ Good: `/home/devel/autofill-extension/mcp-server/index.js`
   - ❌ Bad: `./mcp-server/index.js`
   - ❌ Bad: `~/autofill-extension/mcp-server/index.js`

4. Completely restart Claude (quit, not just close)

### Issue: Commands timeout

**Solution:**
1. Increase timeout in config (see above)

2. Check page is loaded:
   ```
   # Ask Claude to:
   Navigate to the URL first, then wait 5 seconds, then try the command
   ```

3. Use `wait_for_element` before interacting:
   ```
   # Instead of clicking immediately, wait for the element:
   Wait for the login button to appear, then click it
   ```

### Issue: Extension validation errors

**Solution:**
The extension validates all commands for security. Common issues:

1. **Invalid URL**: Must start with `http://` or `https://`
   - ✅ Good: `https://example.com`
   - ❌ Bad: `example.com`

2. **Invalid selector**: Must be a valid CSS selector
   - ✅ Good: `#login-btn`, `.submit-button`, `button[type="submit"]`
   - ❌ Bad: `the login button`, `//button[@id='login']` (XPath)

3. **Type mismatch**: Parameters must match expected type
   - ✅ Good: `{ tabId: 123 }` (number)
   - ❌ Bad: `{ tabId: "123" }` (string)

### Issue: Can't connect to localhost

**Solution:**

If you see "ECONNREFUSED" or similar:

1. Check if extension is running:
   ```bash
   # Test WebSocket connection manually
   npm install -g wscat
   wscat -c ws://localhost:8765
   # Should connect successfully
   ```

2. Try different port:
   - Extension might be on a different port
   - Check extension settings/background page console
   - Update `WS_URL` in config

3. Check firewall:
   ```bash
   # On Linux, check if localhost is blocked
   sudo ufw status
   # Allow localhost if needed
   ```

## Advanced Usage

### Running Multiple Instances

You can run multiple MCP servers for different extensions:

```json
{
  "mcpServers": {
    "basset-hound-1": {
      "command": "node",
      "args": ["/home/devel/autofill-extension/mcp-server/index.js"],
      "env": {
        "WS_URL": "ws://localhost:8765"
      }
    },
    "basset-hound-2": {
      "command": "node",
      "args": ["/home/devel/autofill-extension/mcp-server/index.js"],
      "env": {
        "WS_URL": "ws://localhost:8766"
      }
    }
  }
}
```

Make sure each extension instance uses a different port.

### Development Mode

For development with auto-restart on file changes:

```bash
npm run dev
```

This uses `DEBUG=true` and shows all protocol messages.

### Testing with MCP Inspector

Install and use the MCP Inspector for debugging:

```bash
# Install inspector globally
npm install -g @modelcontextprotocol/inspector

# Run with inspector UI
npm run inspect
```

This opens a web interface where you can:
- See all available tools
- Test individual tool calls
- View request/response messages
- Debug protocol issues

### Manual Testing

Test the MCP server without Claude:

```bash
# Send initialize request
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","clientInfo":{"name":"test","version":"1.0.0"}}}' | node index.js

# List tools
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | node index.js

# Call a tool
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_page_state","arguments":{}}}' | node index.js
```

## Next Steps

Once you have the basic setup working:

1. **Explore all tools**: See `tools.js` for the complete list of 80+ commands

2. **Read the full README**: `/home/devel/autofill-extension/mcp-server/README.md`

3. **Check extension docs**: `/home/devel/autofill-extension/docs/QUICK_REFERENCE.md`

4. **Try complex workflows**:
   - Multi-step forms
   - Network monitoring
   - CAPTCHA detection
   - Batch operations

5. **Report issues**: If you find bugs, check the extension's GitHub repository

## Example Prompts for Claude

Here are some ready-to-use prompts to try:

### Web Scraping
```
Navigate to news.ycombinator.com and extract the titles of the top 10 stories
```

### Form Testing
```
Go to this demo form: https://www.w3schools.com/html/html_forms.asp
Fill it out with test data and submit it
```

### Network Analysis
```
Start monitoring network requests, then navigate to github.com
Show me all the API calls that were made
```

### Multi-Step Process
```
1. Go to example.com
2. Take a screenshot
3. Get all links on the page
4. Click the first link
5. Tell me what the new page is about
```

### Automation
```
Navigate to httpbin.org/forms/post
Fill out the entire form automatically
Submit it and show me the response
```

## Success Checklist

- [ ] Chrome extension is loaded and shows no errors
- [ ] `npm install` completed successfully
- [ ] Server starts without errors (`node index.js`)
- [ ] Claude config file is in the right location
- [ ] Claude config has correct absolute path to `index.js`
- [ ] Claude Desktop was completely restarted
- [ ] Tools icon appears in Claude Desktop
- [ ] "basset-hound" shows in available tools list
- [ ] Test command works (e.g., navigate to example.com)

If all boxes are checked, you're ready to use browser automation with Claude!

## Getting Help

- **Extension Documentation**: `/home/devel/autofill-extension/docs/`
- **MCP Protocol Docs**: https://modelcontextprotocol.io
- **WebSocket Issues**: Check Chrome extension background page console
- **Claude Issues**: Check Claude Desktop logs

---

**Quick Start Version**: 1.0.0
**Last Updated**: 2025-12-29
**Status**: Production Ready
