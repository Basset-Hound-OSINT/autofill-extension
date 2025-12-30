# Getting Started with Basset Hound

Welcome to Basset Hound, a powerful Chrome extension for browser automation, web scraping, and OSINT operations. This guide will help you get up and running quickly.

## Table of Contents

- [What is Basset Hound?](#what-is-basset-hound)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Your First Automation](#your-first-automation)
- [Common Use Cases](#common-use-cases)
- [Next Steps](#next-steps)

## What is Basset Hound?

Basset Hound is a Chrome extension that enables browser automation through WebSocket communication. It allows you to:

- **Automate browsers** remotely via simple commands
- **Extract data** from websites (web scraping)
- **Fill forms** automatically with intelligent field detection
- **Monitor network** traffic and export HAR files
- **Perform SEO audits** with comprehensive analysis
- **Execute JavaScript** in page context
- **Capture screenshots** programmatically
- **Integrate with OSINT tools** (Shodan, HIBP, Wayback, etc.)

**Key Features:**
- WebSocket-based communication
- Python client library
- Comprehensive API
- Network monitoring and export
- DevTools panel integration
- Security controls
- Extensive documentation

## Quick Start

### 5-Minute Setup

1. **Clone/Download the extension:**
   ```bash
   cd /home/devel/autofill-extension
   ```

2. **Install dependencies:**
   ```bash
   npm install
   pip install websocket-client
   ```

3. **Load extension in Chrome:**
   - Open Chrome
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select `/home/devel/autofill-extension`

4. **Start the WebSocket server:**
   ```bash
   node server/ws-server.js
   ```

5. **Run your first automation:**
   ```bash
   python3 examples/python-client-example.py
   ```

That's it! You're now automating Chrome with Basset Hound.

## Installation

### Prerequisites

- **Node.js** 16.0.0 or higher
- **npm** (comes with Node.js)
- **Python** 3.7 or higher
- **Google Chrome** (latest version)

### Detailed Installation

#### 1. Install Node.js Dependencies

```bash
cd /home/devel/autofill-extension
npm install
```

This installs:
- Jest (testing framework)
- Puppeteer (for E2E tests)
- WebSocket server (ws package)
- Development tools

#### 2. Install Python Dependencies

```bash
pip install websocket-client
```

For development, you may also want:
```bash
pip install requests  # For API calls
pip install pandas    # For data analysis
```

#### 3. Load Extension in Chrome

**Step-by-step:**

1. Open Chrome
2. Click the Extensions icon (puzzle piece)
3. Click "Manage Extensions"
4. Or navigate directly to: `chrome://extensions/`

5. Enable "Developer mode":
   - Toggle switch in top-right corner

6. Click "Load unpacked":
   - Select directory: `/home/devel/autofill-extension`
   - Extension icon should appear in toolbar

7. Verify installation:
   - Extension should show "Basset Hound" with dog icon
   - Click icon to see popup with connection status

#### 4. Configure Extension (Optional)

Click the extension icon and configure:

- **WebSocket URL:** Default is `ws://localhost:8765/browser`
- **Auto-reconnect:** Enable for automatic reconnection
- **Network Monitoring:** Enable to track all requests
- **Privacy Controls:** Configure data collection preferences

## Basic Usage

### Starting the Server

The WebSocket server is the bridge between your Python scripts and the Chrome extension.

**Terminal 1 - Start Server:**
```bash
cd /home/devel/autofill-extension
node server/ws-server.js
```

You should see:
```
╔══════════════════════════════════════════════════════════════╗
║       Basset Hound WebSocket Test Server                     ║
║══════════════════════════════════════════════════════════════║
║  WebSocket: ws://localhost:8765/browser                      ║
║  HTTP:      http://localhost:8765                            ║
╚══════════════════════════════════════════════════════════════╝

✅ Server listening on port 8765
Waiting for extension to connect...
```

### Connecting the Extension

Once the server is running, the extension will automatically connect:

1. Click the Basset Hound extension icon
2. You should see "Connected" status
3. Server terminal will show: `Client #1 connected`

### Using Python Client

**Create a simple script:**

```python
#!/usr/bin/env python3
from websocket import WebSocketApp
import json

# Import the client
import sys
sys.path.insert(0, '/home/devel/autofill-extension/examples')
from python_client_example import BassetHoundClient

# Create client
client = BassetHoundClient()

try:
    # Connect
    client.connect()
    print("✓ Connected to browser")

    # Navigate to a website
    result = client.navigate("https://example.com")
    print(f"✓ Navigated to: {result['url']}")

    # Get page content
    content = client.get_content("h1")
    print(f"✓ Page heading: {content['content']}")

    # Take a screenshot
    screenshot = client.save_screenshot("/tmp/test.png")
    print(f"✓ Screenshot saved: {screenshot}")

finally:
    client.disconnect()
```

**Run it:**
```bash
python3 your_script.py
```

## Your First Automation

Let's create a complete automation that demonstrates key features.

### Example: Website Analysis Tool

```python
#!/usr/bin/env python3
"""
Simple website analyzer using Basset Hound
"""
import sys
sys.path.insert(0, '/home/devel/autofill-extension/examples')
from python_client_example import BassetHoundClient
import json

def analyze_website(url):
    """Analyze a website and return key metrics"""

    client = BassetHoundClient()

    try:
        # Connect to browser
        print(f"Analyzing: {url}")
        client.connect()

        # Navigate to website
        print("  → Navigating...")
        client.navigate(url, timeout=30)

        # Get page state
        print("  → Extracting data...")
        state = client.get_page_state()

        # Analyze
        analysis = {
            'url': state['url'],
            'title': state['title'],
            'forms': len(state.get('forms', [])),
            'links': len(state.get('links', [])),
            'buttons': len(state.get('buttons', []))
        }

        # Get meta tags
        meta = client.execute_script("""
            ({
                description: document.querySelector('meta[name="description"]')?.content || 'None',
                keywords: document.querySelector('meta[name="keywords"]')?.content || 'None'
            })
        """)
        analysis['meta'] = meta

        # Take screenshot
        print("  → Taking screenshot...")
        client.save_screenshot(f"/tmp/analysis_{int(time.time())}.png")

        # Print results
        print("\nAnalysis Results:")
        print("=" * 60)
        print(f"URL:         {analysis['url']}")
        print(f"Title:       {analysis['title']}")
        print(f"Forms:       {analysis['forms']}")
        print(f"Links:       {analysis['links']}")
        print(f"Buttons:     {analysis['buttons']}")
        print(f"Description: {analysis['meta']['description'][:60]}...")
        print("=" * 60)

        return analysis

    finally:
        client.disconnect()

if __name__ == "__main__":
    import time
    if len(sys.argv) > 1:
        url = sys.argv[1]
    else:
        url = "https://example.com"

    analyze_website(url)
```

**Run it:**
```bash
python3 website_analyzer.py https://github.com
```

## Common Use Cases

### 1. Web Scraping

Extract data from multiple pages:

```python
urls = [
    "https://example.com/page1",
    "https://example.com/page2",
    "https://example.com/page3"
]

data = []
for url in urls:
    client.navigate(url)
    content = client.get_content(".article")
    data.append({
        'url': url,
        'content': content['content']
    })

# Export to JSON
import json
with open('scraped_data.json', 'w') as f:
    json.dump(data, f, indent=2)
```

### 2. Form Automation

Fill and submit forms automatically:

```python
# Navigate to login page
client.navigate("https://example.com/login")

# Fill login form
client.fill_form({
    "#username": "myusername",
    "#password": "mypassword",
    "#remember": True
}, submit=True)

# Wait for redirect
time.sleep(2)

# Verify login
state = client.get_page_state()
print(f"Current page: {state['title']}")
```

### 3. SEO Analysis

Analyze SEO elements:

```python
client.navigate("https://example.com")

# Extract SEO data
seo_data = client.execute_script("""
    ({
        title: document.title,
        titleLength: document.title.length,
        description: document.querySelector('meta[name="description"]')?.content || '',
        h1Count: document.querySelectorAll('h1').length,
        imageCount: document.querySelectorAll('img').length,
        imagesWithoutAlt: document.querySelectorAll('img:not([alt])').length
    })
""")

print(f"Title: {seo_data['title']} ({seo_data['titleLength']} chars)")
print(f"H1 tags: {seo_data['h1Count']}")
print(f"Images: {seo_data['imageCount']}")
print(f"Missing alt text: {seo_data['imagesWithoutAlt']}")
```

### 4. Network Monitoring

Monitor and analyze network traffic:

```python
# Start monitoring
client._send_command("start_network_monitoring", {})

# Navigate
client.navigate("https://example.com")
time.sleep(5)

# Get network data
network = client._send_command("get_network_logs", {})

print(f"Requests: {len(network['requests'])}")

# Export HAR
har = client._send_command("export_network_har", {})
with open('/tmp/network.har', 'w') as f:
    json.dump(har['har'], f)
```

### 5. Screenshot Automation

Capture screenshots of multiple pages:

```python
urls = ["https://example.com", "https://github.com", "https://python.org"]

for idx, url in enumerate(urls):
    client.navigate(url)
    time.sleep(2)
    client.save_screenshot(f"/tmp/screenshot_{idx}.png")
    print(f"✓ Captured: {url}")
```

## Next Steps

### Learn More

1. **Read the Examples:**
   - Check `/examples` directory for complete, working examples
   - Start with `python-client-example.py` for all features
   - Try `web-scraping-example.py` for scraping workflows

2. **Explore the API:**
   - Read [API_REFERENCE.md](API_REFERENCE.md) for complete command reference
   - Review [API.md](API.md) for WebSocket protocol details

3. **Run the Tests:**
   ```bash
   npm test                    # Unit and integration tests
   npm run test:coverage       # With coverage report
   ```

4. **Use the DevTools Panel:**
   - Open Chrome DevTools (F12)
   - Click "Basset Hound" tab
   - Monitor real-time network activity
   - Export HAR files
   - Extract page content

### Advanced Topics

- **Network Monitoring:** See [NETWORK_EXPORT_GUIDE.md](NETWORK_EXPORT_GUIDE.md)
- **Content Extraction:** See [CONTENT_EXTRACTION_GUIDE.md](CONTENT_EXTRACTION_GUIDE.md)
- **Development:** See [DEVELOPMENT.md](DEVELOPMENT.md)
- **Testing:** See [TESTING.md](TESTING.md)

### Common Issues

#### Extension Not Connecting

**Problem:** Extension shows "Disconnected"

**Solutions:**
1. Ensure server is running: `node server/ws-server.js`
2. Check WebSocket URL in extension popup
3. Verify port 8765 is not blocked
4. Check browser console for errors (F12 → Console)

#### Commands Timing Out

**Problem:** Commands fail with timeout error

**Solutions:**
1. Increase timeout value in command
2. Wait for page to fully load before sending commands
3. Check if element selectors are correct
4. Verify page is accessible

#### Import Errors in Python

**Problem:** `ModuleNotFoundError: No module named 'websocket'`

**Solutions:**
```bash
pip install websocket-client
# or
pip3 install websocket-client
```

#### Extension Not Loading

**Problem:** Error when loading extension

**Solutions:**
1. Verify you selected correct directory
2. Check that `manifest.json` exists
3. Look for errors in `chrome://extensions/`
4. Try reloading extension

### Getting Help

- **Documentation:** `/docs` directory has comprehensive guides
- **Examples:** `/examples` directory has working code samples
- **Issues:** Check error messages in browser console
- **Logs:** Server shows all communication in terminal

### Best Practices

1. **Always disconnect:** Use try/finally to ensure cleanup
2. **Handle errors:** Wrap commands in try/except blocks
3. **Rate limit:** Add delays between requests
4. **Validate data:** Check responses before using
5. **Test selectors:** Verify selectors work before automation

## Quick Reference

### Python Client Methods

```python
# Connection
client.connect(timeout=10)
client.disconnect()

# Navigation
client.navigate(url, wait_for=selector, timeout=30)

# Form filling
client.fill_form(fields_dict, submit=False)
client.click(selector, wait_after=0)

# Content extraction
client.get_content(selector="body")
client.get_page_state()

# Screenshots
client.screenshot(format="png", quality=100)
client.save_screenshot(filename)

# JavaScript
client.execute_script(script)

# Utilities
client.wait_for_element(selector, timeout=10)
client.get_cookies(url=None)
client.detect_forms()
client.detect_captcha()
```

### Server Commands

Interactive commands in server terminal:

```
navigate <url>          - Navigate to URL
screenshot              - Take screenshot
state                   - Get page state
tabs                    - Get all tabs
forms                   - Detect forms
captcha                 - Detect CAPTCHAs
cookies                 - Get cookies
help                    - Show commands
quit                    - Exit server
```

## Welcome to Basset Hound!

You're now ready to start automating with Basset Hound. Check out the examples directory for more complex workflows and use cases.

Happy automating!
