# Basset Hound DevTools - Quick Start Guide

## 30-Second Setup

1. **Reload Extension**
   ```
   chrome://extensions/ → Find "Basset Hound" → Click reload icon
   ```

2. **Open DevTools**
   ```
   F12 or Right-click → Inspect
   ```

3. **Find Basset Hound Tab**
   ```
   Look for "Basset Hound" tab next to Elements, Console, etc.
   ```

4. **Connect**
   ```
   Click the "Connect" button in the header
   ```

## 5-Minute Quick Tour

### 1. Overview Tab (30 seconds)
- Check connection status (green = connected)
- View network request count
- See active tasks
- Monitor uptime

### 2. Network Tab (1 minute)
- Reload the page to capture requests
- Click any request to see details
- View headers, status, timing
- Export to HAR if needed

### 3. Commands Tab (1 minute)
- Click "Navigate" template
- Change URL to any website
- Click "Execute"
- Watch command in history below

### 4. Tasks Tab (30 seconds)
- See running tasks (spinning icon)
- View completed tasks (checkmark)
- Check task duration
- Clear completed tasks

### 5. Audit Log Tab (1 minute)
- View system activity
- Filter by log level
- Search for specific events
- Export logs if needed

### 6. Console Tab (1 minute)
- Type: `document.title`
- Press Enter
- See result from inspected page
- Try: `console.log("Hello DevTools")`

## Common Tasks

### Execute a Navigation Command
```json
{
  "type": "navigate",
  "url": "https://example.com"
}
```
1. Go to Commands tab
2. Click "Navigate" template
3. Change URL
4. Click "Execute"

### Click an Element
```json
{
  "type": "click",
  "selector": "#submit-button"
}
```
1. Commands tab → "Click Element" template
2. Update selector
3. Execute

### Monitor Network Traffic
1. Network tab
2. Reload page (F5)
3. Click any request
4. View details on right side

### Export Network Data
1. Network tab
2. Click "Export HAR"
3. Save .har file
4. Open in Chrome DevTools or HAR viewer

### Check Connection Status
- Look at header badge (● Connected)
- Green dot = good
- Yellow dot = connecting
- Red dot = error
- Gray dot = disconnected

### View Logs
1. Audit Log tab
2. Filter by level (Info, Warn, Error)
3. Search for specific text
4. Export to JSON if needed

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| F12 | Open/Close DevTools |
| Ctrl/Cmd + F | Focus filter (in tabs with filters) |
| Enter | Execute console command |
| Shift + Enter | New line in console |

## Status Indicators

### Connection Dot Colors
- 🟢 Green = Connected
- 🟡 Yellow = Connecting (pulsing)
- 🔴 Red = Error
- ⚪ Gray = Disconnected

### Task Icons
- ⟳ Spinning = Running
- ✓ Checkmark = Completed
- ✗ X = Failed
- ○ Circle = Pending

### Network Status
- 🟢 2xx = Success
- 🔵 3xx = Redirect
- 🟠 4xx = Client Error
- 🔴 5xx = Server Error

## Command Templates

### Navigate
```json
{"type": "navigate", "url": "https://example.com"}
```

### Click
```json
{"type": "click", "selector": "#button-id"}
```

### Type Text
```json
{"type": "type", "selector": "input", "text": "hello"}
```

### Extract Data
```json
{"type": "extract", "selector": ".title", "attribute": "textContent"}
```

### Screenshot
```json
{"type": "screenshot", "fullPage": true}
```

### Wait
```json
{"type": "wait", "selector": ".loading", "timeout": 5000}
```

## Troubleshooting

### Panel Not Showing
1. Reload extension
2. Close/reopen DevTools
3. Refresh page

### Can't Connect
1. Check backend is running: `ws://localhost:8765/browser`
2. Click "Connect" button
3. Check Audit Log for errors

### No Network Requests
1. Reload page after opening Network tab
2. Check extension permissions
3. Try different website

### Commands Not Working
1. Check connection status
2. Verify JSON syntax (use "Format JSON")
3. Check Audit Log for errors

## Pro Tips

1. **Keep DevTools Open**: Network requests only captured when panel is open
2. **Use Templates**: Start with templates and modify them
3. **Export Data**: Save HAR files for offline analysis
4. **Filter Logs**: Use filters to reduce noise
5. **Monitor Tasks**: Watch Tasks tab during automation
6. **Check Audit Log**: First place to look for errors
7. **Clear Data**: Clear network/logs periodically for performance

## File Locations

All DevTools files are in: `/home/devel/autofill-extension/`

- `devtools.html` - Entry point
- `devtools.js` - Panel registration
- `devtools-panel.html` - UI structure
- `devtools-panel.css` - Styling
- `devtools-panel.js` - Logic

## Documentation

- **DEVTOOLS-GUIDE.md** - Comprehensive guide (12 KB)
- **DEVTOOLS-INSTALLATION.md** - Installation & troubleshooting (8 KB)
- **DEVTOOLS-SUMMARY.txt** - Visual diagrams (17 KB)
- **DEVTOOLS-QUICKSTART.md** - This file

## Support

Need help?
1. Check Audit Log tab
2. Review browser console (F12 → Console)
3. Export status/logs for debugging
4. Read full guide: DEVTOOLS-GUIDE.md

## Next Steps

After quick start:
1. Read DEVTOOLS-GUIDE.md for detailed features
2. Try all 6 tabs to understand capabilities
3. Experiment with command templates
4. Export network data to HAR
5. Monitor real automation tasks

---

**Ready to go!** Open DevTools (F12) and click the "Basset Hound" tab.
