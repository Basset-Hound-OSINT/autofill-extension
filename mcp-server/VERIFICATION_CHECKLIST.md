# MCP Server Installation Verification Checklist

Use this checklist to verify that the Basset Hound MCP Server is correctly installed and ready to use.

## Pre-Installation Checks

- [ ] Node.js version >= 16.0.0 (`node --version`)
- [ ] npm is available (`npm --version`)
- [ ] Chrome browser is installed
- [ ] Basset Hound extension is loaded in Chrome
- [ ] Extension shows no errors in chrome://extensions

## File Verification

- [ ] All 13 files are present in `/home/devel/autofill-extension/mcp-server/`
  - [ ] index.js
  - [ ] tools.js
  - [ ] test-server.js
  - [ ] package.json
  - [ ] README.md
  - [ ] QUICKSTART.md
  - [ ] INSTALLATION.md
  - [ ] examples.md
  - [ ] CHANGELOG.md
  - [ ] PROJECT_SUMMARY.md
  - [ ] FILES_CREATED.txt
  - [ ] claude_desktop_config.example.json
  - [ ] .gitignore

## Installation Steps

- [ ] Ran `npm install` successfully
- [ ] No errors during dependency installation
- [ ] `node_modules` directory exists (or ws is available in parent)
- [ ] `ws` package is installed and accessible

## Functionality Tests

- [ ] `npm test` passes all tests
- [ ] Server starts without errors (`npm start`)
- [ ] Server shows "Connected to Basset Hound extension" message
- [ ] Tools load successfully (76+ tools)
- [ ] Sample tool definitions are valid JSON Schema

## WebSocket Connection

- [ ] Extension background page shows "WebSocket server listening on port 8765"
- [ ] Can connect to ws://localhost:8765 with wscat or similar tool
- [ ] MCP server connects to extension automatically
- [ ] Connection survives page reloads

## Claude Desktop Integration (Optional)

- [ ] claude_desktop_config.json exists in correct location
- [ ] JSON syntax is valid (checked with validator)
- [ ] Absolute path to index.js is correct
- [ ] Claude Desktop has been fully restarted
- [ ] Tools icon appears in Claude Desktop
- [ ] "basset-hound" server appears in tools list
- [ ] Can see 76+ tools in basset-hound category

## Test Commands (Optional)

- [ ] Can navigate to a URL from Claude
- [ ] Can get page state
- [ ] Can fill a form
- [ ] Can take a screenshot
- [ ] Commands complete without timeout errors

## Documentation Review

- [ ] Read QUICKSTART.md
- [ ] Reviewed example commands in examples.md
- [ ] Know where to find help (README.md, troubleshooting sections)
- [ ] Understand configuration options

## Common Issues Resolved

- [ ] Firewall allows localhost connections
- [ ] Extension has permission to all_urls
- [ ] No conflicting processes on port 8765
- [ ] NODE_PATH includes current directory or parent node_modules
- [ ] Extension service worker is active (not stopped)

## Final Verification

- [ ] All above checks passed
- [ ] Server starts reliably
- [ ] Can execute at least one successful command
- [ ] Know how to restart if needed
- [ ] Know where to find logs and debug info

---

## Quick Verification Commands

Run these commands for quick verification:

```bash
# Check Node.js
node --version  # Should be >= 16.0.0

# Check installation
cd /home/devel/autofill-extension/mcp-server
npm list ws  # Should show ws@^8.18.0

# Check files
ls -la  # Should see all 13 files

# Run tests
npm test  # Should pass 3/3 tests

# Quick server test
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","clientInfo":{"name":"test","version":"1.0.0"}}}' | npm start
# Should return JSON response with serverInfo
```

## Troubleshooting Quick Reference

| Issue | Quick Fix |
|-------|-----------|
| npm install fails | `npm cache clean --force && npm install` |
| Server won't connect | Check extension is loaded and active |
| Tools not in Claude | Verify config path is absolute, restart Claude |
| Command timeouts | Increase COMMAND_TIMEOUT in env |
| Permission denied | `chmod +x index.js test-server.js` |

---

## Success Criteria

✅ The installation is successful if:

1. `npm test` passes (3/3 tests)
2. Server connects to extension (sees "Connected" message)
3. Tools load (76+ tools available)
4. At least one command works (e.g., navigate to example.com)

## Get Help

If any checks fail:
1. Review INSTALLATION.md for detailed steps
2. Check troubleshooting sections in README.md and QUICKSTART.md
3. Verify extension logs in Chrome DevTools
4. Check Node.js and npm versions
5. Ensure no firewall blocking localhost

---

**Checklist Version**: 1.0.0
**Last Updated**: 2025-12-29
