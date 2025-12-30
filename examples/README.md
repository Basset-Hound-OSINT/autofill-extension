# Basset Hound - Usage Examples

This directory contains comprehensive examples demonstrating how to use the Basset Hound browser automation extension for various tasks.

## Overview

All examples use Python with the WebSocket client to communicate with the Chrome extension. Each example demonstrates best practices, error handling, and real-world usage patterns.

## Prerequisites

### 1. Install Dependencies

```bash
pip install websocket-client
```

### 2. Install and Load Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `/home/devel/autofill-extension` directory

### 3. Start WebSocket Server

```bash
cd /home/devel/autofill-extension
node server/ws-server.js
```

The server will start on `ws://localhost:8765/browser`.

## Examples

### 1. Python Client Example

**File:** `python-client-example.py`

Complete Python client demonstrating all features:
- Connection management
- Navigation
- Form filling
- Content extraction
- Screenshots
- JavaScript execution
- Cookie management
- Form and CAPTCHA detection

**Usage:**
```bash
python3 examples/python-client-example.py
```

**Features Demonstrated:**
- WebSocket connection with auto-reconnect
- All command types
- Error handling
- Response processing
- Screenshot capture and saving

---

### 2. Web Scraping Example

**File:** `web-scraping-example.py`

Advanced web scraping workflow:
- Multi-page scraping
- Content extraction
- Metadata collection
- Pagination handling
- Data export (CSV/JSON)
- Rate limiting

**Usage:**
```bash
python3 examples/web-scraping-example.py
```

**Features Demonstrated:**
- Single page scraping
- Multi-page scraping with rate limits
- Pagination following
- Open Graph metadata extraction
- Link analysis
- CSV and JSON export
- Screenshot collection
- Error tracking

**Example Output:**
```
Scraping Summary
================
Total URLs: 5
Successful: 5
Failed: 0
```

---

### 3. SEO Audit Example

**File:** `seo-audit-example.py`

Comprehensive SEO analysis:
- Meta tag validation
- Header structure analysis
- Image alt text checking
- Link analysis
- Performance metrics
- Structured data detection

**Usage:**
```bash
python3 examples/seo-audit-example.py https://example.com
```

**Features Demonstrated:**
- Meta tag analysis (title, description, OG tags)
- Header hierarchy validation (H1-H6)
- Image optimization checks
- Internal/external link analysis
- Performance metrics collection
- JSON-LD structured data detection
- SEO scoring system
- Detailed recommendations

**Example Output:**
```
SEO AUDIT REPORT
================
URL: https://example.com
Overall Score: 85.5/100

1. META TAGS (Score: 90.0/100)
  Title: Example Domain (14 chars)
  Description: Example domain... (150 chars)

2. HEADERS (Score: 80.0/100)
  H1: 1
  H2: 3
  H3: 5
```

---

### 4. Network Analysis Example

**File:** `network-analysis-example.py`

Network monitoring and analysis:
- Request/response tracking
- HAR file export
- Performance analysis
- Third-party request detection
- API endpoint discovery

**Usage:**
```bash
python3 examples/network-analysis-example.py https://example.com 15
```

Arguments:
- `url`: URL to analyze
- `duration`: Monitoring duration in seconds (default: 10)

**Features Demonstrated:**
- Network request monitoring
- Request categorization (by type, status, domain)
- Failed request detection
- Slow request identification
- Third-party tracking
- API endpoint detection
- HAR file export
- Performance metrics
- Resource size analysis

**Example Output:**
```
NETWORK ANALYSIS REPORT
========================
Total Requests: 45
Total Size: 2.3 MB
Unique Domains: 8
Failed Requests: 2
Slow Requests (>1s): 3
Third-Party Requests: 15
```

---

### 5. Form Automation Example

**File:** `form-automation-example.py`

Advanced form automation:
- Intelligent form detection
- Multi-step form workflows
- Dynamic field handling
- Form validation
- Error recovery

**Usage:**
```bash
python3 examples/form-automation-example.py
```

**Features Demonstrated:**
- Automatic form structure analysis
- Intelligent field matching (by name, label, placeholder)
- Required vs optional field detection
- Multi-step form workflows
- Dynamic field handling
- Form submission validation
- Select/dropdown handling
- Error detection and recovery

**Form Analysis Output:**
```
Form analyzed: 7 fields (3 required)
Field Types:
  text: 3
  email: 1
  select: 2
  checkbox: 1
```

---

## Common Patterns

### Basic Connection Pattern

```python
from python_client_example import BassetHoundClient

client = BassetHoundClient("ws://localhost:8765/browser")
try:
    client.connect()
    # Your automation code here
finally:
    client.disconnect()
```

### Error Handling Pattern

```python
try:
    result = client.navigate(url, timeout=30)
    logger.info(f"Success: {result}")
except Exception as e:
    logger.error(f"Failed: {e}")
    # Handle error
```

### Rate Limiting Pattern

```python
for url in urls:
    scrape_page(url)
    time.sleep(2)  # Rate limit: 2 seconds between requests
```

### Data Export Pattern

```python
# JSON export
with open('output.json', 'w') as f:
    json.dump(data, f, indent=2)

# CSV export
import csv
with open('output.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=data[0].keys())
    writer.writeheader()
    writer.writerows(data)
```

## Best Practices

### 1. Connection Management

- Always use try/finally to ensure disconnection
- Implement connection timeout handling
- Handle reconnection logic for long-running tasks

### 2. Rate Limiting

- Add delays between requests to avoid overwhelming servers
- Respect robots.txt and rate limits
- Use exponential backoff for retries

### 3. Error Handling

- Wrap all operations in try/except blocks
- Log errors for debugging
- Implement graceful degradation
- Track failed operations for retry

### 4. Data Validation

- Validate all extracted data
- Handle missing or malformed data
- Sanitize user inputs
- Check response status codes

### 5. Resource Management

- Clean up screenshots and temporary files
- Limit screenshot collection for large-scale scraping
- Export data incrementally for large datasets
- Monitor memory usage

### 6. Performance

- Use appropriate timeouts
- Batch operations when possible
- Minimize unnecessary screenshots
- Optimize selector strategies

## Troubleshooting

### Connection Issues

**Problem:** "Connection timeout"

**Solutions:**
- Ensure WebSocket server is running
- Check firewall settings
- Verify extension is loaded in Chrome
- Check server URL and port

### Navigation Issues

**Problem:** "Navigation timeout"

**Solutions:**
- Increase timeout value
- Check internet connection
- Verify URL is accessible
- Wait for specific elements instead of fixed delays

### Form Filling Issues

**Problem:** "Element not found"

**Solutions:**
- Wait for page to fully load
- Use more specific selectors
- Check if element is in iframe
- Verify element is visible and enabled

### Data Extraction Issues

**Problem:** "No content extracted"

**Solutions:**
- Try different selectors
- Wait for dynamic content to load
- Check if content is in shadow DOM
- Verify JavaScript has executed

## Output Files

All examples save output to `/tmp/`:

- Screenshots: `/tmp/scrape_*.png`, `/tmp/seo_audit_*.png`
- JSON reports: `/tmp/scraped_data.json`, `/tmp/seo_audit_*.json`
- CSV exports: `/tmp/scraped_data.csv`
- HAR files: `/tmp/network_*.har`
- Network reports: `/tmp/network_analysis_*.json`

## Additional Resources

- [API Reference](../docs/API_REFERENCE.md) - Complete API documentation
- [Getting Started](../docs/GETTING_STARTED.md) - Beginner's guide
- [Examples Guide](../docs/EXAMPLES.md) - Detailed examples documentation
- [Main README](../docs/README.md) - Project overview

## Contributing

When adding new examples:

1. Follow the existing code structure
2. Include comprehensive error handling
3. Add detailed comments
4. Provide usage instructions
5. Include expected output examples
6. Update this README

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or contributions:
- GitHub Issues: [Report issues]
- Documentation: `/docs` directory
- Examples: This directory
