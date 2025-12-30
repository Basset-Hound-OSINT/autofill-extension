# Network Export Guide

Comprehensive guide for using the Basset Hound network export and analysis features.

## Table of Contents

- [Overview](#overview)
- [Commands](#commands)
  - [export_network_har](#export_network_har)
  - [export_network_csv](#export_network_csv)
  - [save_network_log](#save_network_log)
  - [get_network_summary](#get_network_summary)
- [Use Cases](#use-cases)
- [Examples](#examples)
- [Integration](#integration)
- [Best Practices](#best-practices)

## Overview

The Network Export features allow you to capture, export, and analyze network traffic from web pages. This is useful for:

- Debugging API interactions
- Performance analysis
- Security auditing
- Data extraction from network requests
- Reverse engineering web applications
- Monitoring third-party integrations

All network export commands work with the existing network monitoring capabilities in the Basset Hound extension.

## Commands

### export_network_har

Export network logs in HAR (HTTP Archive) format, which is a standard format supported by most browser developer tools and network analysis tools.

**Command:**
```json
{
  "command_id": "cmd_123",
  "type": "export_network_har",
  "params": {
    "urlPattern": ".*api.*",
    "method": "POST",
    "type": "xhr",
    "includeContent": false
  }
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `urlPattern` | string | No | Regular expression to filter URLs |
| `method` | string | No | Filter by HTTP method (GET, POST, etc.) |
| `type` | string | No | Filter by resource type (xhr, script, image, etc.) |
| `includeContent` | boolean | No | Include response content (default: false) |

**Response:**
```json
{
  "success": true,
  "format": "HAR",
  "har": {
    "log": {
      "version": "1.2",
      "creator": {
        "name": "Basset Hound Network Exporter",
        "version": "1.0.0"
      },
      "entries": [
        {
          "startedDateTime": "2024-01-15T10:30:00.000Z",
          "time": 150,
          "request": {
            "method": "POST",
            "url": "https://api.example.com/users",
            "headers": [...]
          },
          "response": {
            "status": 200,
            "statusText": "OK",
            "headers": [...]
          }
        }
      ]
    }
  },
  "entryCount": 42,
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

### export_network_csv

Export network logs as CSV for easy analysis in spreadsheet applications or data analysis tools.

**Command:**
```json
{
  "command_id": "cmd_124",
  "type": "export_network_csv",
  "params": {
    "urlPattern": ".*example.com.*",
    "fields": ["method", "url", "statusCode", "duration", "type"]
  }
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `urlPattern` | string | No | Regular expression to filter URLs |
| `method` | string | No | Filter by HTTP method |
| `type` | string | No | Filter by resource type |
| `fields` | array | No | Fields to include in CSV (default: all) |

**Available Fields:**
- `method` - HTTP method (GET, POST, etc.)
- `url` - Full request URL
- `type` - Resource type (xhr, script, image, etc.)
- `statusCode` - HTTP status code
- `statusLine` - Full status line
- `duration` - Request duration in milliseconds
- `startTime` - Request start timestamp
- `endTime` - Request end timestamp
- `completed` - Whether request completed successfully
- `error` - Error message if request failed

**Response:**
```json
{
  "success": true,
  "format": "CSV",
  "csv": "method,url,statusCode,duration,type\nGET,https://example.com,200,150,xhr\n...",
  "rowCount": 42,
  "fields": ["method", "url", "statusCode", "duration", "type"],
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

### save_network_log

Save network logs to a downloadable file in HAR, CSV, or JSON format.

**Command:**
```json
{
  "command_id": "cmd_125",
  "type": "save_network_log",
  "params": {
    "format": "har",
    "filename": "network-capture-2024-01-15.har",
    "filterOptions": {
      "urlPattern": ".*api.*",
      "method": "POST"
    }
  }
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `format` | string | No | Export format: 'har', 'csv', or 'json' (default: 'json') |
| `filename` | string | No | Custom filename (auto-generated if not provided) |
| `filterOptions` | object | No | Filter options (same as export commands) |

**Response:**
```json
{
  "success": true,
  "filename": "network-capture-2024-01-15.har",
  "format": "har",
  "size": 45678,
  "downloadId": 123,
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

### get_network_summary

Get summary statistics and analysis of captured network traffic.

**Command:**
```json
{
  "command_id": "cmd_126",
  "type": "get_network_summary",
  "params": {
    "urlPattern": ".*",
    "groupBy": "type"
  }
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `urlPattern` | string | No | Regular expression to filter URLs |
| `groupBy` | string | No | Group statistics by: 'method', 'type', 'domain', or 'status' |

**Response:**
```json
{
  "success": true,
  "summary": {
    "overview": {
      "totalRequests": 156,
      "completedRequests": 150,
      "failedRequests": 6,
      "redirectedRequests": 12,
      "blockedRequests": 0,
      "logSize": 156,
      "isCapturing": true,
      "durationMs": 45000
    },
    "timing": {
      "averageDuration": 250.5,
      "minDuration": 45,
      "maxDuration": 1200,
      "totalDuration": 39078
    },
    "methods": {
      "GET": 120,
      "POST": 30,
      "PUT": 4,
      "DELETE": 2
    },
    "types": {
      "xhr": 45,
      "script": 30,
      "image": 50,
      "stylesheet": 20,
      "document": 11
    },
    "statusCodes": {
      "200": 140,
      "301": 8,
      "404": 4,
      "500": 2,
      "302": 2
    },
    "domains": {
      "example.com": 100,
      "cdn.example.com": 40,
      "api.example.com": 16
    },
    "errors": {
      "totalErrors": 6,
      "errorTypes": {
        "net::ERR_CONNECTION_REFUSED": {
          "count": 3,
          "examples": [...]
        },
        "net::ERR_TIMEOUT": {
          "count": 3,
          "examples": [...]
        }
      }
    }
  },
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

## Use Cases

### 1. API Debugging

Capture all API requests to analyze authentication, request/response formats, and error conditions:

```json
{
  "type": "export_network_har",
  "params": {
    "urlPattern": ".*api.*",
    "type": "xhr",
    "includeContent": true
  }
}
```

### 2. Performance Analysis

Export timing data to identify slow requests:

```json
{
  "type": "export_network_csv",
  "params": {
    "fields": ["url", "duration", "type", "statusCode"],
    "urlPattern": ".*"
  }
}
```

Then analyze the CSV to find requests with high duration values.

### 3. Security Auditing

Monitor third-party requests and identify potential data leaks:

```json
{
  "type": "get_network_summary",
  "params": {
    "groupBy": "domain"
  }
}
```

### 4. Reverse Engineering

Capture all network traffic while interacting with a web application:

```json
{
  "type": "save_network_log",
  "params": {
    "format": "har",
    "filename": "app-capture.har"
  }
}
```

Import the HAR file into tools like:
- Chrome DevTools
- Firefox Developer Tools
- Charles Proxy
- Fiddler
- Postman

### 5. Data Extraction

Extract data from AJAX requests:

```json
{
  "type": "export_network_har",
  "params": {
    "urlPattern": ".*\\/data\\/.*",
    "method": "GET",
    "includeContent": true
  }
}
```

## Examples

### Example 1: Monitoring API Calls

```python
# Start network monitoring
await client.send_command({
    "type": "start_network_capture",
    "params": {
        "urlPatterns": ["<all_urls>"]
    }
})

# Navigate to page and interact
await client.send_command({
    "type": "navigate",
    "params": {"url": "https://example.com/dashboard"}
})

# Wait for page to load and make API calls
await asyncio.sleep(3)

# Export as HAR
result = await client.send_command({
    "type": "export_network_har",
    "params": {
        "urlPattern": ".*api.*"
    }
})

# Save HAR file locally
with open("api-calls.har", "w") as f:
    json.dump(result["har"], f, indent=2)
```

### Example 2: Performance Analysis Workflow

```python
# Start capture
await client.send_command({"type": "start_network_capture"})

# Navigate to page
await client.send_command({
    "type": "navigate",
    "params": {"url": "https://example.com"}
})

# Wait for page to fully load
await asyncio.sleep(5)

# Get summary statistics
summary = await client.send_command({
    "type": "get_network_summary",
    "params": {"groupBy": "type"}
})

# Analyze timing
print(f"Average request duration: {summary['summary']['timing']['averageDuration']}ms")
print(f"Max request duration: {summary['summary']['timing']['maxDuration']}ms")

# Export slow requests as CSV
csv_result = await client.send_command({
    "type": "export_network_csv",
    "params": {
        "fields": ["url", "duration", "type"]
    }
})

# Filter and analyze slow requests
import csv
import io

reader = csv.DictReader(io.StringIO(csv_result["csv"]))
slow_requests = [row for row in reader if float(row["duration"]) > 1000]

for req in slow_requests:
    print(f"Slow request: {req['url']} ({req['duration']}ms)")
```

### Example 3: Automated Security Audit

```python
async def audit_third_party_requests(url):
    # Start network monitoring
    await client.send_command({"type": "start_network_capture"})

    # Navigate to target
    await client.send_command({
        "type": "navigate",
        "params": {"url": url}
    })

    # Wait for all requests
    await asyncio.sleep(5)

    # Get domain summary
    summary = await client.send_command({
        "type": "get_network_summary",
        "params": {"groupBy": "domain"}
    })

    # Identify third-party domains
    from urllib.parse import urlparse
    target_domain = urlparse(url).netloc

    third_party = {}
    for domain, count in summary["summary"]["domains"].items():
        if domain != target_domain:
            third_party[domain] = count

    # Generate report
    print(f"Third-party domains found: {len(third_party)}")
    for domain, count in sorted(third_party.items(), key=lambda x: x[1], reverse=True):
        print(f"  {domain}: {count} requests")

    # Save detailed HAR for manual review
    await client.send_command({
        "type": "save_network_log",
        "params": {
            "format": "har",
            "filename": f"audit-{target_domain}.har"
        }
    })

# Run audit
await audit_third_party_requests("https://example.com")
```

## Integration

### With Existing Network Monitoring

Network export commands work with the existing network monitoring system:

```python
# 1. Start monitoring
await client.send_command({"type": "start_network_capture"})

# 2. Perform actions
await client.send_command({"type": "navigate", "params": {"url": "..."}})

# 3. Export captured data
await client.send_command({"type": "export_network_har"})

# 4. Stop monitoring
await client.send_command({"type": "stop_network_capture"})
```

### Workflow Automation

Combine network export with other commands for complete automation:

```python
async def scrape_with_network_analysis(url):
    # Start monitoring
    await client.send_command({"type": "start_network_capture"})

    # Navigate and scrape
    await client.send_command({"type": "navigate", "params": {"url": url}})
    content = await client.send_command({"type": "get_content"})

    # Export network data
    network_summary = await client.send_command({"type": "get_network_summary"})

    # Combine results
    return {
        "content": content,
        "network_stats": network_summary["summary"]["overview"],
        "total_requests": network_summary["summary"]["overview"]["totalRequests"],
        "failed_requests": network_summary["summary"]["overview"]["failedRequests"]
    }
```

## Best Practices

### 1. Filter Early, Filter Often

Always use filters to reduce data volume:

```json
{
  "type": "export_network_har",
  "params": {
    "urlPattern": ".*api\\.example\\.com.*",
    "type": "xhr"
  }
}
```

### 2. Use CSV for Large Datasets

CSV is more efficient than HAR for large datasets:

```json
{
  "type": "export_network_csv",
  "params": {
    "fields": ["method", "url", "statusCode", "duration"]
  }
}
```

### 3. Regular Summary Checks

Monitor network activity with summaries before exporting full data:

```json
{
  "type": "get_network_summary",
  "params": {"groupBy": "type"}
}
```

### 4. Clear Logs Between Sessions

Prevent memory buildup:

```python
# Clear before starting new session
await client.send_command({"type": "clear_network_log"})
await client.send_command({"type": "start_network_capture"})
```

### 5. Combine with Request Interception

Modify requests while capturing:

```python
# Set up interception rules
await client.send_command({
    "type": "add_request_rule",
    "params": {
        "urlPattern": ".*",
        "action": "modify_headers",
        "headers": {"X-Custom": "value"}
    }
})

# Start capture
await client.send_command({"type": "start_network_capture"})

# All captured requests will show modified headers
```

### 6. Error Handling

Always check for errors in network export:

```python
result = await client.send_command({"type": "export_network_har"})

if not result.get("success"):
    print(f"Export failed: {result.get('error')}")
else:
    print(f"Exported {result['entryCount']} entries")
```

### 7. Resource Management

Be mindful of memory usage with large captures:

- Set `maxLogSize` when starting capture
- Use filters to reduce captured data
- Clear logs periodically
- Export and save data before it's evicted

### 8. Format Selection

Choose the right format for your use case:

- **HAR**: Industry standard, tool compatibility, detailed timing
- **CSV**: Data analysis, spreadsheets, simple parsing
- **JSON**: Custom processing, programmatic access

## Advanced Features

### Custom Field Selection (CSV)

Only export fields you need:

```json
{
  "type": "export_network_csv",
  "params": {
    "fields": ["url", "duration", "statusCode"],
    "urlPattern": ".*"
  }
}
```

### Grouped Statistics

Analyze traffic patterns:

```json
{
  "type": "get_network_summary",
  "params": {
    "groupBy": "status"
  }
}
```

Returns statistics grouped by HTTP status code.

### Time-Based Analysis

Track network activity over time:

```python
# Take snapshots at intervals
for i in range(5):
    await asyncio.sleep(10)
    summary = await client.send_command({"type": "get_network_summary"})
    print(f"Snapshot {i}: {summary['summary']['overview']['totalRequests']} requests")
```

## Troubleshooting

### No Data Captured

Ensure network monitoring is started:
```python
await client.send_command({"type": "start_network_capture"})
```

### Large File Sizes

Use filters and limit fields:
```json
{
  "type": "export_network_csv",
  "params": {
    "urlPattern": ".*api.*",
    "fields": ["url", "statusCode"]
  }
}
```

### Missing Headers

Ensure `captureHeaders` is enabled:
```python
await client.send_command({
    "type": "start_network_capture",
    "params": {"captureHeaders": true}
})
```

### Downloads Not Working

Ensure Chrome has download permissions in manifest.json:
```json
{
  "permissions": ["downloads"]
}
```

## Related Documentation

- [Network Monitoring Guide](./NETWORK_MONITORING_GUIDE.md)
- [Request Interception Guide](./REQUEST_INTERCEPTION_GUIDE.md)
- [Content Extraction Guide](./CONTENT_EXTRACTION_GUIDE.md)

## Support

For issues, questions, or feature requests, please refer to the main project documentation or submit an issue on the project repository.
