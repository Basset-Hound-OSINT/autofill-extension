# Basset Hound - Examples Documentation

Complete guide to all examples with detailed explanations and use cases.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Running Examples](#running-examples)
- [Example Details](#example-details)
- [Custom Examples](#custom-examples)
- [Troubleshooting](#troubleshooting)

## Overview

The `/examples` directory contains production-ready Python scripts demonstrating real-world usage of Basset Hound for various automation tasks.

**What's Included:**
- Complete Python client library
- Web scraping workflows
- SEO audit automation
- Network traffic analysis
- Form automation patterns
- Error handling examples
- Data export utilities

## Prerequisites

### System Requirements

- Python 3.7+
- Node.js 16.0.0+
- Google Chrome (latest)
- Basset Hound extension loaded

### Python Dependencies

```bash
pip install websocket-client
```

### Server Setup

```bash
# Terminal 1: Start WebSocket server
cd /home/devel/autofill-extension
node server/ws-server.js
```

## Running Examples

### Quick Start

```bash
# Navigate to examples directory
cd /home/devel/autofill-extension/examples

# Run basic client example
python3 python-client-example.py

# Run web scraping example
python3 web-scraping-example.py

# Run SEO audit (with URL argument)
python3 seo-audit-example.py https://example.com

# Run network analysis (with URL and duration)
python3 network-analysis-example.py https://example.com 15

# Run form automation
python3 form-automation-example.py
```

## Example Details

### 1. Python Client Example

**File:** `python-client-example.py`

**Purpose:** Comprehensive demonstration of all client features

**What It Does:**
1. Connects to WebSocket server
2. Navigates to example.com
3. Extracts page state (forms, links, buttons)
4. Gets page content
5. Takes screenshot
6. Executes JavaScript
7. Retrieves cookies
8. Detects forms and CAPTCHAs

**Output:**
```
==========================================
Basset Hound Client - Feature Demonstration
==========================================

1. Navigation Test
------------------------------------------
Navigated to: https://example.com
Tab ID: 12345

2. Page State Extraction
------------------------------------------
Title: Example Domain
URL: https://example.com
Forms found: 0
Links found: 1
Buttons found: 0

...

All tests completed successfully!
```

**Key Code Sections:**

```python
# Connection management
client = BassetHoundClient()
try:
    client.connect()
    # Automation code
finally:
    client.disconnect()

# Navigation with waiting
result = client.navigate(
    "https://example.com",
    wait_for="h1",
    timeout=30
)

# Screenshot saving
filename = client.save_screenshot("/tmp/test.png")
```

**Customization:**
- Modify URL for different target
- Add custom commands
- Adjust timeouts
- Export data in different formats

---

### 2. Web Scraping Example

**File:** `web-scraping-example.py`

**Purpose:** Multi-page web scraping with data export

**Features:**
- Single page scraping
- Multi-page batch processing
- Pagination handling
- Metadata extraction
- CSV/JSON export
- Rate limiting
- Error tracking

**What It Does:**

```python
# Single page
result = scraper.scrape_article("https://example.com")

# Multiple pages
urls = ["url1", "url2", "url3"]
results = scraper.scrape_list(urls, delay=2.0)

# With pagination
results = scraper.scrape_with_pagination(
    start_url="https://example.com/page1",
    next_selector=".next-page",
    max_pages=10
)

# Export data
scraper.export_to_json("/tmp/data.json")
scraper.export_to_csv("/tmp/data.csv")
```

**Output Files:**
- `/tmp/scraped_data.json` - Full JSON export with metadata
- `/tmp/scraped_data.csv` - CSV format for analysis
- `/tmp/scrape_*.png` - Screenshots of each page

**Extracted Data:**
```json
{
  "url": "https://example.com",
  "title": "Page Title",
  "content_length": 5000,
  "content_preview": "First 500 chars...",
  "description": "Meta description",
  "keywords": "keyword1, keyword2",
  "author": "John Doe",
  "og_title": "OG title",
  "link_count": 42,
  "external_link_count": 15,
  "screenshot": "/tmp/scrape_123.png",
  "scraped_at": "2024-01-01T12:00:00",
  "success": true
}
```

**Rate Limiting:**
```python
# Configurable delay between requests
results = scraper.scrape_list(urls, delay=2.0)  # 2 seconds
```

**Error Handling:**
```python
# Errors are tracked separately
if not result['success']:
    scraper.errors.append({
        'url': url,
        'error': str(e),
        'timestamp': datetime.now().isoformat()
    })
```

---

### 3. SEO Audit Example

**File:** `seo-audit-example.py`

**Purpose:** Comprehensive SEO analysis and scoring

**Usage:**
```bash
python3 seo-audit-example.py https://example.com
```

**Audit Components:**

1. **Meta Tags Analysis**
   - Title length validation
   - Description optimization
   - Open Graph tags
   - Twitter Cards
   - Canonical URL
   - Viewport tag

2. **Header Structure**
   - H1-H6 hierarchy
   - Multiple H1 detection
   - Header text analysis

3. **Image Optimization**
   - Alt text checking
   - Lazy loading detection
   - Image count analysis

4. **Link Analysis**
   - Internal vs external links
   - Broken link detection
   - Security checks (noopener)
   - Accessibility validation

5. **Performance Metrics**
   - Load time
   - Resource count
   - Page size
   - Script optimization

6. **Structured Data**
   - JSON-LD detection
   - Schema.org validation

**Output:**
```
SEO AUDIT REPORT
================
URL: https://example.com
Overall Score: 85.5/100

1. META TAGS (Score: 90.0/100)
  Title: Example Domain (14 chars)
  Recommendations:
    - Title is too short. Recommended: 50-60 chars

2. HEADERS (Score: 80.0/100)
  H1: 1
  H2: 3

3. IMAGES (Score: 75.0/100)
  Total Images: 10
  Without Alt Text: 2
  Issues:
    - 2 images missing alt text

4. LINKS (Score: 95.0/100)
  Total: 45
  Internal: 30
  External: 15

5. PERFORMANCE (Score: 85.0/100)
  Load Time: 2.5s
  Resources: 35
  Page Size: 1.5MB

6. STRUCTURED DATA (Score: 100.0/100)
  JSON-LD Found: true
  Types: Article, Organization
```

**Scoring System:**
- Meta Tags: 100 points (deductions for issues)
- Headers: 100 points (H1 errors: -20, warnings: -5)
- Images: 100 points (missing alt: -5 per image)
- Links: 100 points (security issues: -15)
- Performance: 100 points (recommendations: -10 each)
- Structured Data: 100 points (50 if missing)

**Export:**
```json
{
  "url": "https://example.com",
  "audited_at": "2024-01-01T12:00:00",
  "overall_score": 85.5,
  "meta_tags": {...},
  "headers": {...},
  "images": {...},
  "links": {...},
  "performance": {...},
  "structured_data": {...},
  "screenshot": "/tmp/seo_audit_123.png"
}
```

---

### 4. Network Analysis Example

**File:** `network-analysis-example.py`

**Purpose:** Network traffic monitoring and analysis

**Usage:**
```bash
python3 network-analysis-example.py https://example.com 15
```

Arguments:
- URL to analyze
- Monitoring duration in seconds (default: 10)

**What It Does:**

1. **Starts Network Monitoring**
   ```python
   analyzer.start_monitoring()
   ```

2. **Navigates and Monitors**
   ```python
   client.navigate(url)
   time.sleep(duration)  # Monitor period
   ```

3. **Collects Network Data**
   ```python
   network_data = analyzer.stop_monitoring()
   ```

4. **Analyzes Requests**
   - By type (document, script, image, etc.)
   - By status code (200, 404, 500, etc.)
   - By domain (first-party vs third-party)
   - Failed requests (4xx, 5xx)
   - Slow requests (> 1 second)

5. **Detects API Endpoints**
   - URLs containing /api/, /v1/, /graphql
   - JSON response types
   - REST endpoints

6. **Exports HAR File**
   ```python
   har_file = analyzer.export_har("/tmp/network.har")
   ```

**Output:**
```
NETWORK ANALYSIS REPORT
========================
Total Requests: 45
Total Size: 2.3 MB
Unique Domains: 8
Failed Requests: 2
Slow Requests (>1s): 3
Third-Party Requests: 15

REQUESTS BY TYPE
----------------
document: 1
script: 12
stylesheet: 5
image: 20
xhr: 7

TOP DOMAINS
-----------
example.com: 30 requests
cdn.example.com: 10 requests
analytics.google.com: 5 requests

API ENDPOINTS DETECTED
----------------------
[GET] https://example.com/api/users
[POST] https://example.com/api/login
[GET] https://example.com/api/data
```

**Analysis Details:**

```python
{
  'summary': {
    'total_requests': 45,
    'total_size_mb': 2.3,
    'unique_domains': 8,
    'failed_requests': 2,
    'slow_requests': 3,
    'third_party_requests': 15
  },
  'by_type': {
    'document': 1,
    'script': 12,
    'stylesheet': 5,
    'image': 20,
    'xhr': 7
  },
  'failed_requests': [
    {
      'url': 'https://example.com/missing.js',
      'status': 404,
      'type': 'script'
    }
  ],
  'slow_requests': [
    {
      'url': 'https://api.example.com/data',
      'duration': 2500,
      'type': 'xhr'
    }
  ]
}
```

**HAR Export:**
- Full HTTP Archive format
- Compatible with Chrome DevTools
- Importable into performance tools
- Contains request/response details

---

### 5. Form Automation Example

**File:** `form-automation-example.py`

**Purpose:** Intelligent form filling and automation

**Features:**

1. **Form Analysis**
   ```python
   analysis = automator.analyze_form()
   # Returns: fields, types, requirements
   ```

2. **Intelligent Field Matching**
   ```python
   # Matches by name, label, or placeholder
   automator.fill_form_intelligently({
       'email': 'john@example.com',    # Matches [name="email"]
       'Email Address': 'john@...',    # Matches by label
       'Enter your name': 'John Doe'   # Matches by placeholder
   })
   ```

3. **Multi-Step Forms**
   ```python
   steps = [
       {
           'fields': {'firstName': 'John', 'lastName': 'Doe'},
           'next_button': '#nextStep1',
           'wait_after': 2
       },
       {
           'fields': {'address': '123 Main St'},
           'next_button': '#nextStep2',
           'wait_after': 2
       }
   ]
   results = automator.fill_multi_step_form(steps)
   ```

4. **Dynamic Field Handling**
   ```python
   # Wait for fields that appear dynamically
   automator.handle_dynamic_fields(
       trigger_selector='#accountType',
       wait_for_selector='#companyName',
       timeout=5
   )
   ```

5. **Form Validation**
   ```python
   validation = automator.validate_form_submission()
   # Checks for success/error messages
   ```

**Form Analysis Output:**
```python
{
  'form_id': 'loginForm',
  'form_name': 'login',
  'action': '/api/login',
  'method': 'POST',
  'field_count': 5,
  'required_fields': [
    {
      'selector': '#username',
      'name': 'username',
      'type': 'text',
      'label': 'Username',
      'required': True
    }
  ],
  'optional_fields': [...],
  'field_types': {
    'text': 3,
    'password': 1,
    'checkbox': 1
  }
}
```

**Examples Included:**

1. **Simple Form (httpbin.org)**
   ```python
   example_simple_form()
   # Fills customer feedback form
   ```

2. **Multi-Step Form (conceptual)**
   ```python
   example_multi_step_form()
   # Shows pattern for multi-page forms
   ```

3. **Dynamic Form (conceptual)**
   ```python
   example_dynamic_form()
   # Shows conditional field handling
   ```

## Custom Examples

### Creating Your Own

**Template:**

```python
#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from python_client_example import BassetHoundClient
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    client = BassetHoundClient()

    try:
        # Connect
        client.connect()
        logger.info("Connected successfully")

        # Your automation logic here
        client.navigate("https://example.com")

        # Process and export data
        state = client.get_page_state()
        logger.info(f"Page: {state['title']}")

    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)

    finally:
        client.disconnect()

if __name__ == "__main__":
    main()
```

### Common Patterns

**Pattern 1: Batch Processing**
```python
urls = ["url1", "url2", "url3"]
results = []

for url in urls:
    try:
        client.navigate(url)
        data = extract_data()
        results.append(data)
        time.sleep(2)  # Rate limit
    except Exception as e:
        logger.error(f"Failed: {url} - {e}")
```

**Pattern 2: Data Pipeline**
```python
def scrape_and_process(url):
    # Scrape
    client.navigate(url)
    raw_data = client.get_content()

    # Process
    processed = process_data(raw_data)

    # Validate
    if validate(processed):
        # Export
        save_to_database(processed)

    return processed
```

**Pattern 3: Error Recovery**
```python
max_retries = 3
for attempt in range(max_retries):
    try:
        result = client.navigate(url)
        break
    except Exception as e:
        if attempt < max_retries - 1:
            logger.warning(f"Retry {attempt + 1}/{max_retries}")
            time.sleep(5 * (attempt + 1))  # Exponential backoff
        else:
            logger.error("All retries failed")
            raise
```

## Troubleshooting

### Common Issues

**1. Import Errors**
```
ModuleNotFoundError: No module named 'websocket'
```
Solution:
```bash
pip install websocket-client
```

**2. Connection Failed**
```
WebSocketException: Connection timeout
```
Solutions:
- Ensure server is running: `node server/ws-server.js`
- Check extension is loaded in Chrome
- Verify port 8765 is not blocked

**3. Command Timeout**
```
Exception: Command timeout after 30s
```
Solutions:
- Increase timeout parameter
- Check if page is loading
- Verify internet connection

**4. Element Not Found**
```
Exception: Element not found: #selector
```
Solutions:
- Wait for page to fully load
- Check selector syntax
- Use wait_for_element
- Verify element exists

### Debugging Tips

**Enable Verbose Logging:**
```python
logging.basicConfig(
    level=logging.DEBUG,  # Changed from INFO
    format='%(asctime)s - %(levelname)s - %(message)s'
)
```

**Test Selectors:**
```python
# Test if element exists
result = client.execute_script("""
    !!document.querySelector('#mySelector')
""")
print(f"Element exists: {result}")
```

**Monitor Server Output:**
```bash
# Server shows all commands and responses
node server/ws-server.js
```

**Check Extension Console:**
1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Look for Basset Hound messages

## Best Practices

1. **Always Clean Up**
   ```python
   try:
       # Automation code
   finally:
       client.disconnect()
   ```

2. **Handle Errors**
   ```python
   try:
       result = client.navigate(url)
   except Exception as e:
       logger.error(f"Failed: {e}")
       # Recovery logic
   ```

3. **Rate Limit**
   ```python
   for url in urls:
       process(url)
       time.sleep(2)  # Respect servers
   ```

4. **Validate Data**
   ```python
   if result.get('success'):
       data = result['result']
       # Use data
   else:
       logger.error("Command failed")
   ```

5. **Export Incrementally**
   ```python
   # For large datasets
   for batch in batches:
       process_batch(batch)
       export_batch(batch)  # Don't wait until end
   ```

## Further Reading

- [API Reference](API_REFERENCE.md) - Complete API documentation
- [Getting Started](GETTING_STARTED.md) - Beginner's guide
- [Main README](README.md) - Project overview
- [Testing Guide](TESTING.md) - Running tests

## Contributing Examples

To add new examples:

1. Create well-commented Python file
2. Follow existing code structure
3. Include error handling
4. Add docstrings
5. Provide usage instructions
6. Update examples/README.md
7. Add to this documentation

## Support

For help with examples:
- Check error messages
- Review server logs
- Inspect browser console
- Verify selectors
- Test with simple cases first
