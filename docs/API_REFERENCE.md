# Basset Hound - Complete API Reference

This document provides a comprehensive reference for all Basset Hound commands, parameters, and responses.

## Table of Contents

- [Connection](#connection)
- [Core Commands](#core-commands)
- [Form Commands](#form-commands)
- [Content Commands](#content-commands)
- [Network Commands](#network-commands)
- [OSINT Commands](#osint-commands)
- [Security Commands](#security-commands)
- [DevTools Commands](#devtools-commands)
- [Python Client API](#python-client-api)

## Connection

### WebSocket Endpoint

```
ws://localhost:8765/browser
```

### Message Format

All commands follow this structure:

```json
{
  "command_id": "unique-id",
  "type": "command_type",
  "params": {
    "param1": "value1"
  }
}
```

### Response Format

```json
{
  "command_id": "unique-id",
  "success": true,
  "result": {},
  "error": null,
  "timestamp": 1234567890
}
```

## Core Commands

### navigate

Navigate to a URL.

**Request:**
```json
{
  "command_id": "nav-1",
  "type": "navigate",
  "params": {
    "url": "https://example.com",
    "wait_for": "h1",
    "timeout": 30000
  }
}
```

**Parameters:**
- `url` (string, required): Target URL
- `wait_for` (string, optional): CSS selector to wait for
- `timeout` (number, optional): Timeout in milliseconds (default: 30000)

**Response:**
```json
{
  "command_id": "nav-1",
  "success": true,
  "result": {
    "url": "https://example.com",
    "loaded": true,
    "tabId": 12345
  }
}
```

---

### execute_script

Execute JavaScript in page context.

**Request:**
```json
{
  "command_id": "exec-1",
  "type": "execute_script",
  "params": {
    "script": "document.title"
  }
}
```

**Parameters:**
- `script` (string, required): JavaScript code to execute

**Response:**
```json
{
  "command_id": "exec-1",
  "success": true,
  "result": {
    "result": "Example Domain"
  }
}
```

---

### screenshot

Capture a screenshot.

**Request:**
```json
{
  "command_id": "ss-1",
  "type": "screenshot",
  "params": {
    "format": "png",
    "quality": 100
  }
}
```

**Parameters:**
- `format` (string, optional): "png" or "jpeg" (default: "png")
- `quality` (number, optional): 1-100 for JPEG (default: 100)

**Response:**
```json
{
  "command_id": "ss-1",
  "success": true,
  "result": {
    "screenshot": "data:image/png;base64,iVBORw0KG...",
    "format": "png"
  }
}
```

---

### get_tabs

Get all browser tabs.

**Request:**
```json
{
  "command_id": "tabs-1",
  "type": "get_tabs",
  "params": {}
}
```

**Response:**
```json
{
  "command_id": "tabs-1",
  "success": true,
  "result": {
    "tabs": [
      {
        "id": 12345,
        "url": "https://example.com",
        "title": "Example Domain",
        "active": true
      }
    ]
  }
}
```

---

### wait_for_element

Wait for an element to appear.

**Request:**
```json
{
  "command_id": "wait-1",
  "type": "wait_for_element",
  "params": {
    "selector": ".dynamic-content",
    "timeout": 10000
  }
}
```

**Parameters:**
- `selector` (string, required): CSS selector
- `timeout` (number, optional): Timeout in milliseconds (default: 10000)

**Response:**
```json
{
  "command_id": "wait-1",
  "success": true,
  "result": {
    "found": true,
    "selector": ".dynamic-content",
    "elementInfo": {
      "tagName": "div",
      "id": "content",
      "className": "dynamic-content"
    }
  }
}
```

## Form Commands

### fill_form

Fill form fields.

**Request:**
```json
{
  "command_id": "fill-1",
  "type": "fill_form",
  "params": {
    "fields": {
      "#username": "john_doe",
      "#email": "john@example.com",
      "#terms": true
    },
    "submit": false
  }
}
```

**Parameters:**
- `fields` (object, required): Selector to value mapping
- `submit` (boolean, optional): Submit form after filling (default: false)

**Supported Field Types:**
- Text inputs: string value
- Checkboxes: boolean or "true"/"false"
- Radio buttons: boolean or "true"/"false"
- Select dropdowns: option value as string
- Textareas: string value

**Response:**
```json
{
  "command_id": "fill-1",
  "success": true,
  "result": {
    "success": true,
    "filled": [
      {"selector": "#username", "success": true},
      {"selector": "#email", "success": true},
      {"selector": "#terms", "success": true}
    ]
  }
}
```

---

### click

Click an element.

**Request:**
```json
{
  "command_id": "click-1",
  "type": "click",
  "params": {
    "selector": "#submit-btn",
    "wait_after": 1000
  }
}
```

**Parameters:**
- `selector` (string, required): CSS selector
- `wait_after` (number, optional): Milliseconds to wait after click

**Response:**
```json
{
  "command_id": "click-1",
  "success": true,
  "result": {
    "success": true,
    "clicked": "#submit-btn"
  }
}
```

---

### detect_forms

Detect all forms on the page.

**Request:**
```json
{
  "command_id": "forms-1",
  "type": "detect_forms",
  "params": {}
}
```

**Response:**
```json
{
  "command_id": "forms-1",
  "success": true,
  "result": {
    "forms": [
      {
        "id": "loginForm",
        "name": "login",
        "action": "/api/login",
        "method": "POST",
        "fields": [
          {
            "selector": "#username",
            "type": "text",
            "name": "username",
            "required": true,
            "label": "Username"
          }
        ]
      }
    ]
  }
}
```

## Content Commands

### get_content

Extract content from page.

**Request:**
```json
{
  "command_id": "content-1",
  "type": "get_content",
  "params": {
    "selector": "article"
  }
}
```

**Parameters:**
- `selector` (string, optional): CSS selector (default: "body")

**Response:**
```json
{
  "command_id": "content-1",
  "success": true,
  "result": {
    "content": "Text content...",
    "html": "<article>HTML content...</article>",
    "selector": "article"
  }
}
```

---

### get_page_state

Get comprehensive page state.

**Request:**
```json
{
  "command_id": "state-1",
  "type": "get_page_state",
  "params": {}
}
```

**Response:**
```json
{
  "command_id": "state-1",
  "success": true,
  "result": {
    "url": "https://example.com",
    "title": "Example Domain",
    "forms": [...],
    "links": [...],
    "buttons": [...],
    "standaloneInputs": [...],
    "meta": {
      "documentReady": "complete",
      "scrollHeight": 1200,
      "scrollWidth": 1920
    }
  }
}
```

---

### extract_structured_content

Extract structured content from page.

**Request:**
```json
{
  "command_id": "extract-1",
  "type": "extract_structured_content",
  "params": {
    "selectors": {
      "title": "h1",
      "author": ".author",
      "date": ".published-date",
      "content": "article"
    }
  }
}
```

**Response:**
```json
{
  "command_id": "extract-1",
  "success": true,
  "result": {
    "title": "Article Title",
    "author": "John Doe",
    "date": "2024-01-01",
    "content": "Article content..."
  }
}
```

## Network Commands

### start_network_monitoring

Start monitoring network requests.

**Request:**
```json
{
  "command_id": "net-start-1",
  "type": "start_network_monitoring",
  "params": {}
}
```

**Response:**
```json
{
  "command_id": "net-start-1",
  "success": true,
  "result": {
    "monitoring": true,
    "startTime": 1234567890
  }
}
```

---

### stop_network_monitoring

Stop monitoring and get collected data.

**Request:**
```json
{
  "command_id": "net-stop-1",
  "type": "stop_network_monitoring",
  "params": {}
}
```

**Response:**
```json
{
  "command_id": "net-stop-1",
  "success": true,
  "result": {
    "monitoring": false,
    "requests": [
      {
        "url": "https://example.com",
        "method": "GET",
        "statusCode": 200,
        "type": "document",
        "size": 1234,
        "duration": 456
      }
    ]
  }
}
```

---

### get_network_logs

Get current network logs without stopping monitoring.

**Request:**
```json
{
  "command_id": "net-logs-1",
  "type": "get_network_logs",
  "params": {}
}
```

**Response:**
```json
{
  "command_id": "net-logs-1",
  "success": true,
  "result": {
    "requests": [...],
    "requestCount": 42
  }
}
```

---

### export_network_har

Export network data as HAR format.

**Request:**
```json
{
  "command_id": "har-1",
  "type": "export_network_har",
  "params": {}
}
```

**Response:**
```json
{
  "command_id": "har-1",
  "success": true,
  "result": {
    "har": {
      "log": {
        "version": "1.2",
        "creator": {...},
        "entries": [...]
      }
    }
  }
}
```

## OSINT Commands

### shodan_host

Query Shodan for host information.

**Request:**
```json
{
  "command_id": "shodan-1",
  "type": "shodan_host",
  "params": {
    "ip": "8.8.8.8",
    "apiKey": "YOUR_API_KEY"
  }
}
```

**Parameters:**
- `ip` (string, required): IP address to query
- `apiKey` (string, required): Shodan API key

---

### hibp_check_email

Check email in Have I Been Pwned database.

**Request:**
```json
{
  "command_id": "hibp-1",
  "type": "hibp_check_email",
  "params": {
    "email": "test@example.com",
    "apiKey": "YOUR_API_KEY"
  }
}
```

**Parameters:**
- `email` (string, required): Email to check
- `apiKey` (string, required): HIBP API key

---

### wayback_check

Check Wayback Machine availability.

**Request:**
```json
{
  "command_id": "wayback-1",
  "type": "wayback_check",
  "params": {
    "url": "example.com"
  }
}
```

**Parameters:**
- `url` (string, required): URL to check

---

### whois_domain

Perform WHOIS lookup.

**Request:**
```json
{
  "command_id": "whois-1",
  "type": "whois_domain",
  "params": {
    "domain": "example.com"
  }
}
```

**Parameters:**
- `domain` (string, required): Domain to lookup

---

### social_search

Search for username across social media.

**Request:**
```json
{
  "command_id": "social-1",
  "type": "social_search",
  "params": {
    "username": "johndoe"
  }
}
```

**Parameters:**
- `username` (string, required): Username to search

## Security Commands

### get_cookies

Get cookies for current domain.

**Request:**
```json
{
  "command_id": "cookies-1",
  "type": "get_cookies",
  "params": {
    "url": "https://example.com"
  }
}
```

**Parameters:**
- `url` (string, optional): URL to get cookies for

**Response:**
```json
{
  "command_id": "cookies-1",
  "success": true,
  "result": {
    "cookies": [
      {
        "name": "session",
        "value": "abc123",
        "domain": ".example.com",
        "path": "/",
        "secure": true,
        "httpOnly": true
      }
    ]
  }
}
```

---

### detect_captcha

Detect CAPTCHAs on page.

**Request:**
```json
{
  "command_id": "captcha-1",
  "type": "detect_captcha",
  "params": {}
}
```

**Response:**
```json
{
  "command_id": "captcha-1",
  "success": true,
  "result": {
    "hasCaptcha": true,
    "captchaType": "recaptcha",
    "captchaCount": 1,
    "details": [...]
  }
}
```

## DevTools Commands

### extract_page_content

Extract content via DevTools (enhanced extraction).

**Request:**
```json
{
  "command_id": "devtools-extract-1",
  "type": "extract_page_content",
  "params": {
    "options": {
      "includeMetadata": true,
      "includeLinks": true,
      "includeImages": true
    }
  }
}
```

---

### export_network_data

Export network data via DevTools.

**Request:**
```json
{
  "command_id": "devtools-network-1",
  "type": "export_network_data",
  "params": {
    "format": "har"
  }
}
```

## Python Client API

### BassetHoundClient Class

```python
from python_client_example import BassetHoundClient

client = BassetHoundClient(url="ws://localhost:8765/browser")
```

### Methods

#### connect(timeout=10)
Connect to WebSocket server.

```python
client.connect(timeout=10)
```

#### disconnect()
Disconnect from server.

```python
client.disconnect()
```

#### navigate(url, wait_for=None, timeout=30)
Navigate to URL.

```python
result = client.navigate(
    "https://example.com",
    wait_for="h1",
    timeout=30
)
```

#### fill_form(fields, submit=False)
Fill form fields.

```python
result = client.fill_form({
    "#username": "john",
    "#password": "secret"
}, submit=True)
```

#### click(selector, wait_after=0)
Click an element.

```python
result = client.click("#submit-btn", wait_after=1000)
```

#### get_content(selector="body")
Extract content.

```python
content = client.get_content("article")
print(content['content'])
```

#### screenshot(format="png", quality=100)
Take screenshot.

```python
data_url = client.screenshot(format="png")
```

#### save_screenshot(filename, format="png")
Take and save screenshot.

```python
path = client.save_screenshot("/tmp/screenshot.png")
```

#### wait_for_element(selector, timeout=10)
Wait for element.

```python
result = client.wait_for_element(".dynamic", timeout=15)
```

#### get_page_state()
Get page state.

```python
state = client.get_page_state()
print(f"Forms: {len(state['forms'])}")
```

#### execute_script(script)
Execute JavaScript.

```python
title = client.execute_script("document.title")
```

#### get_cookies(url=None)
Get cookies.

```python
cookies = client.get_cookies()
```

#### detect_forms()
Detect forms.

```python
forms = client.detect_forms()
```

#### detect_captcha()
Detect CAPTCHAs.

```python
captcha = client.detect_captcha()
```

## Error Handling

### Error Response Format

```json
{
  "command_id": "cmd-1",
  "success": false,
  "result": null,
  "error": "Error message here",
  "timestamp": 1234567890
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Connection timeout" | Server not reachable | Check server is running |
| "Command timeout" | No response received | Increase timeout value |
| "Element not found" | Selector doesn't match | Verify selector is correct |
| "Navigation failed" | Page didn't load | Check URL accessibility |
| "Invalid parameters" | Missing/wrong params | Check parameter requirements |

### Python Exception Handling

```python
try:
    result = client.navigate(url)
except Exception as e:
    logger.error(f"Navigation failed: {e}")
    # Handle error
```

## Rate Limiting

Recommended delays between requests:

```python
import time

for url in urls:
    client.navigate(url)
    # Process page
    time.sleep(2)  # 2 second delay
```

## Best Practices

1. **Always disconnect:** Use try/finally blocks
2. **Validate inputs:** Check parameters before sending
3. **Handle errors:** Wrap commands in try/except
4. **Use timeouts:** Set appropriate timeout values
5. **Rate limit:** Add delays between requests
6. **Check responses:** Verify success before using result

## Examples

See `/examples` directory for complete working examples:
- `python-client-example.py` - All features
- `web-scraping-example.py` - Web scraping
- `seo-audit-example.py` - SEO analysis
- `network-analysis-example.py` - Network monitoring
- `form-automation-example.py` - Form automation

## Further Reading

- [Getting Started Guide](GETTING_STARTED.md)
- [Examples Documentation](EXAMPLES.md)
- [API Protocol Details](API.md)
- [Network Monitoring Guide](NETWORK_EXPORT_GUIDE.md)
