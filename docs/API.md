# Basset Hound Browser Automation Extension - API Reference

This document provides a complete reference for all WebSocket commands and message formats.

## Table of Contents

- [Connection](#connection)
- [Message Format](#message-format)
- [Commands](#commands)
  - [navigate](#navigate)
  - [fill_form](#fill_form)
  - [click](#click)
  - [get_content](#get_content)
  - [screenshot](#screenshot)
  - [wait_for_element](#wait_for_element)
  - [get_page_state](#get_page_state)
  - [execute_script](#execute_script)
- [Response Format](#response-format)
- [Status Messages](#status-messages)
- [Error Codes](#error-codes)
- [Selector Strategies](#selector-strategies)

## Connection

### WebSocket Endpoint

```
ws://localhost:8765/browser
```

### Connection Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| URL | `ws://localhost:8765/browser` | WebSocket server endpoint |
| Reconnect Attempts | 10 | Maximum reconnection attempts |
| Initial Delay | 1000ms | Initial reconnection delay |
| Max Delay | 30000ms | Maximum reconnection delay |
| Heartbeat Interval | 30000ms | Heartbeat message frequency |
| Command Timeout | 30000ms | Default command timeout |

### Heartbeat Message

The extension sends periodic heartbeat messages to keep the connection alive:

```json
{
  "type": "heartbeat",
  "timestamp": 1703520000000
}
```

## Message Format

### Command Format (Server to Extension)

All commands from the server must follow this structure:

```json
{
  "command_id": "string (required, unique identifier)",
  "type": "string (required, command type)",
  "params": {
    // Command-specific parameters (optional)
  }
}
```

### Response Format (Extension to Server)

All responses from the extension follow this structure:

```json
{
  "command_id": "string (matches request)",
  "success": "boolean",
  "result": "any (command-specific result)",
  "error": "string | null",
  "timestamp": "number (Unix timestamp in ms)"
}
```

## Commands

### navigate

Navigate to a URL in the active tab.

#### Request

```json
{
  "command_id": "nav-001",
  "type": "navigate",
  "params": {
    "url": "https://example.com",
    "wait_for": "#content",
    "timeout": 30000
  }
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | string | Yes | - | URL to navigate to (must be valid URL format) |
| `wait_for` | string | No | null | CSS selector to wait for after navigation |
| `timeout` | number | No | 30000 | Timeout in milliseconds |

#### Response (Success)

```json
{
  "command_id": "nav-001",
  "success": true,
  "result": {
    "url": "https://example.com",
    "loaded": true,
    "tabId": 12345
  },
  "error": null,
  "timestamp": 1703520000000
}
```

#### Response (Error)

```json
{
  "command_id": "nav-001",
  "success": false,
  "result": null,
  "error": "Navigation timeout after 30000ms",
  "timestamp": 1703520000000
}
```

#### Notes

- If no active tab exists, a new tab will be created
- If `wait_for` is specified, the command waits for that element after page load
- URL must include protocol (http:// or https://)

---

### fill_form

Fill form fields with specified values.

#### Request

```json
{
  "command_id": "fill-001",
  "type": "fill_form",
  "params": {
    "fields": {
      "#username": "john_doe",
      "[name='email']": "john@example.com",
      "#password": "secret123",
      "#country": "US",
      "#terms": true
    },
    "submit": false
  }
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `fields` | object | Yes | - | Key-value pairs of selectors and values |
| `submit` | boolean | No | false | Submit the form after filling |

#### Field Value Types

| Input Type | Value Format | Example |
|------------|--------------|---------|
| Text/Email/Password | string | `"john@example.com"` |
| Select | string (option value) | `"US"` |
| Checkbox | boolean or string | `true`, `"true"`, `"1"` |
| Radio | boolean or string | `true`, `"true"`, `"1"` |
| Textarea | string | `"Multi-line\ntext"` |
| ContentEditable | string | `"Rich text content"` |

#### Response (Success)

```json
{
  "command_id": "fill-001",
  "success": true,
  "result": {
    "success": true,
    "filled": [
      { "selector": "#username", "success": true },
      { "selector": "[name='email']", "success": true },
      { "selector": "#password", "success": true },
      { "selector": "#country", "success": true },
      { "selector": "#terms", "success": true }
    ]
  },
  "error": null,
  "timestamp": 1703520000000
}
```

#### Response (Partial Failure)

```json
{
  "command_id": "fill-001",
  "success": true,
  "result": {
    "success": true,
    "filled": [
      { "selector": "#username", "success": true },
      { "selector": "#nonexistent", "success": false, "error": "Element not found" }
    ]
  },
  "error": null,
  "timestamp": 1703520000000
}
```

#### Notes

- Typing is simulated with 10ms delay between characters for reactive framework compatibility
- Input events are dispatched for each character
- Change events are dispatched after completion
- File inputs cannot be filled (security restriction)

---

### click

Click an element on the page.

#### Request

```json
{
  "command_id": "click-001",
  "type": "click",
  "params": {
    "selector": "#submit-button",
    "wait_after": 1000
  }
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `selector` | string | Yes | - | CSS selector for the element to click |
| `wait_after` | number | No | 0 | Milliseconds to wait after clicking |

#### Response (Success)

```json
{
  "command_id": "click-001",
  "success": true,
  "result": {
    "success": true,
    "clicked": "#submit-button"
  },
  "error": null,
  "timestamp": 1703520000000
}
```

#### Notes

- Element is scrolled into view before clicking
- Element is focused before clicking if possible
- Multiple selector strategies are tried (see [Selector Strategies](#selector-strategies))

---

### get_content

Extract text and HTML content from the page.

#### Request

```json
{
  "command_id": "content-001",
  "type": "get_content",
  "params": {
    "selector": ".results"
  }
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `selector` | string | No | "body" | CSS selector for content extraction |

#### Response (Success)

```json
{
  "command_id": "content-001",
  "success": true,
  "result": {
    "success": true,
    "content": "This is the text content of the results section...",
    "html": "<div class=\"results\"><p>This is the text content...</p></div>",
    "selector": ".results"
  },
  "error": null,
  "timestamp": 1703520000000
}
```

#### Notes

- `content` returns `innerText` (visible text only)
- `html` returns `innerHTML` (full HTML structure)

---

### screenshot

Capture a screenshot of the visible tab.

#### Request

```json
{
  "command_id": "ss-001",
  "type": "screenshot",
  "params": {
    "format": "png",
    "quality": 100
  }
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `format` | string | No | "png" | Image format: "png" or "jpeg" |
| `quality` | number | No | 100 | Image quality (1-100, JPEG only) |

#### Response (Success)

```json
{
  "command_id": "ss-001",
  "success": true,
  "result": {
    "screenshot": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "format": "png"
  },
  "error": null,
  "timestamp": 1703520000000
}
```

#### Notes

- Returns base64-encoded data URL
- Only captures visible viewport
- Cannot capture full page scrolled content

---

### wait_for_element

Wait for an element to appear on the page.

#### Request

```json
{
  "command_id": "wait-001",
  "type": "wait_for_element",
  "params": {
    "selector": ".dynamic-content",
    "timeout": 15000
  }
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `selector` | string | Yes | - | CSS selector to wait for |
| `timeout` | number | No | 10000 | Timeout in milliseconds |

#### Response (Element Found)

```json
{
  "command_id": "wait-001",
  "success": true,
  "result": {
    "success": true,
    "found": true,
    "selector": ".dynamic-content",
    "elementInfo": {
      "tagName": "div",
      "id": "content",
      "className": "dynamic-content loaded"
    }
  },
  "error": null,
  "timestamp": 1703520000000
}
```

#### Response (Timeout)

```json
{
  "command_id": "wait-001",
  "success": true,
  "result": {
    "success": true,
    "found": false,
    "selector": ".dynamic-content",
    "error": "Timeout waiting for element: .dynamic-content"
  },
  "error": null,
  "timestamp": 1703520000000
}
```

#### Notes

- Uses MutationObserver for efficient DOM watching
- Returns immediately if element already exists
- Watches for childList, subtree, and attribute changes

---

### get_page_state

Get comprehensive page state including forms, links, and buttons.

#### Request

```json
{
  "command_id": "state-001",
  "type": "get_page_state",
  "params": {}
}
```

#### Parameters

None required.

#### Response (Success)

```json
{
  "command_id": "state-001",
  "success": true,
  "result": {
    "success": true,
    "url": "https://example.com/login",
    "title": "Login - Example Site",
    "forms": [
      {
        "id": "loginForm",
        "name": "login",
        "action": "https://example.com/api/login",
        "method": "POST",
        "selector": "#loginForm",
        "fields": [
          {
            "selector": "#username",
            "type": "text",
            "name": "username",
            "id": "username",
            "label": "Username",
            "required": true,
            "disabled": false,
            "readonly": false,
            "placeholder": "Enter your username",
            "value": ""
          },
          {
            "selector": "#password",
            "type": "password",
            "name": "password",
            "id": "password",
            "label": "Password",
            "required": true,
            "disabled": false,
            "readonly": false,
            "value": "[hidden]"
          },
          {
            "selector": "#rememberMe",
            "type": "checkbox",
            "name": "remember",
            "id": "rememberMe",
            "label": "Remember me",
            "required": false,
            "disabled": false,
            "readonly": false,
            "checked": false
          }
        ]
      }
    ],
    "links": [
      {
        "text": "Forgot Password?",
        "href": "https://example.com/forgot-password",
        "selector": "a:nth-of-type(1)"
      },
      {
        "text": "Create Account",
        "href": "https://example.com/register",
        "selector": "a:nth-of-type(2)"
      }
    ],
    "buttons": [
      {
        "text": "Sign In",
        "type": "submit",
        "selector": "#loginForm > button",
        "disabled": false
      }
    ],
    "standaloneInputs": [],
    "meta": {
      "documentReady": "complete",
      "scrollHeight": 1200,
      "scrollWidth": 1920
    }
  },
  "error": null,
  "timestamp": 1703520000000
}
```

#### Notes

- Links are limited to first 100 to prevent massive responses
- Password values are masked as `[hidden]`
- Select fields include all options with selection state

---

### execute_script

Execute custom JavaScript in the page context.

#### Request

```json
{
  "command_id": "exec-001",
  "type": "execute_script",
  "params": {
    "script": "document.querySelectorAll('a').length"
  }
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `script` | string | Yes | - | JavaScript code to execute |

#### Response (Success)

```json
{
  "command_id": "exec-001",
  "success": true,
  "result": {
    "success": true,
    "result": 42
  },
  "error": null,
  "timestamp": 1703520000000
}
```

#### Response (Script Error)

```json
{
  "command_id": "exec-001",
  "success": false,
  "result": null,
  "error": "ReferenceError: undefinedVar is not defined",
  "timestamp": 1703520000000
}
```

#### Notes

- Scripts execute in the page's MAIN world (not isolated)
- Return value is the result of the last expression
- Complex objects may not serialize properly
- Use with caution - can modify page state

---

## Status Messages

The extension sends status messages to the server:

### Connection Status

```json
{
  "type": "status",
  "status": "connected",
  "data": {},
  "timestamp": 1703520000000
}
```

### Status Values

| Status | Description |
|--------|-------------|
| `connected` | Successfully connected to server |
| `disconnected` | Disconnected from server |
| `reconnecting` | Attempting to reconnect |
| `failed` | Max reconnection attempts reached |

---

## Error Codes

### Common Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `URL is required for navigate command` | Missing URL parameter | Provide valid URL |
| `Invalid URL format: {url}` | URL doesn't parse correctly | Use full URL with protocol |
| `Fields object is required and must not be empty` | Empty or missing fields | Provide at least one field |
| `Selector is required for click command` | Missing selector | Provide valid selector |
| `Script is required for execute_script command` | Missing script | Provide JavaScript code |
| `No active tab found` | No browser tab available | Open a tab first |
| `Element not found: {selector}` | Selector didn't match | Check selector syntax |
| `Navigation timeout after {x}ms` | Page didn't load in time | Increase timeout |
| `Timeout waiting for element: {selector}` | Element didn't appear | Check if element exists |
| `File inputs cannot be filled` | Security restriction | Use alternative approach |
| `Script execution failed: {error}` | JavaScript error | Fix script syntax |

---

## Selector Strategies

The extension tries multiple strategies to find elements:

### Priority Order

1. **Direct CSS Selector**: Tried first as-is
2. **ID Selector**: `#selector`
3. **Name Attribute**: `[name="selector"]`
4. **ID Attribute (escaped)**: `[id="selector"]`
5. **Test ID**: `[data-testid="selector"]`
6. **ARIA Label**: `[aria-label="selector"]`
7. **Placeholder (inputs)**: `input[placeholder*="selector"]`
8. **Text Content**: Searches buttons, links, and labels

### Examples

```javascript
// All these selectors can find an element:
"#username"           // ID selector
"username"            // Tries #username, [name="username"], etc.
"[name='email']"      // Attribute selector
"Submit"              // Finds button with text "Submit"
"Email Address"       // Finds input with label "Email Address"
```

### Generated Selectors

The extension generates unique selectors for elements:

1. Prefer ID if available: `#myElement`
2. Prefer name for form elements: `[name="field"]`
3. Use data-testid if available: `[data-testid="test-id"]`
4. Fall back to path-based: `form > div:nth-of-type(2) > input`

### CSS Escaping

Special characters in selectors are automatically escaped:

```javascript
// These are handled correctly:
"#user.name"         // Escaped to #user\.name
"[name='field[0]']"  // Escaped to [name="field\[0\]"]
```
