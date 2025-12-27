# Network Monitoring and Request Interception

This document describes the network monitoring and request interception capabilities of the Basset Hound Browser Automation Extension.

## Table of Contents

- [Overview](#overview)
- [Network Monitoring](#network-monitoring)
  - [start_network_capture](#start_network_capture)
  - [stop_network_capture](#stop_network_capture)
  - [get_network_log](#get_network_log)
  - [clear_network_log](#clear_network_log)
  - [get_network_stats](#get_network_stats)
- [Request Interception](#request-interception)
  - [add_request_rule](#add_request_rule)
  - [remove_request_rule](#remove_request_rule)
  - [block_urls](#block_urls)
  - [unblock_urls](#unblock_urls)
  - [get_interception_rules](#get_interception_rules)
  - [clear_interception_rules](#clear_interception_rules)
- [Rule Types](#rule-types)
  - [Header Rules](#header-rules)
  - [Block Rules](#block-rules)
  - [Mock Rules](#mock-rules)
  - [Redirect Rules](#redirect-rules)
- [HAR Export](#har-export)
- [Legacy Commands](#legacy-commands)

## Overview

The extension provides two main network-related utilities:

1. **NetworkMonitor** - Captures and logs all network requests with detailed timing, headers, and status information.

2. **RequestInterceptor** - Intercepts requests to modify headers, block URLs, mock responses, or redirect traffic.

Both utilities use Chrome's `webRequest` API and require the `webRequest` and `webRequestBlocking` permissions.

## Network Monitoring

Network monitoring allows you to capture all HTTP/HTTPS traffic from the browser, including request/response headers, timing information, and error details.

### start_network_capture

Begin capturing network traffic.

#### Request

```json
{
  "command_id": "net-001",
  "type": "start_network_capture",
  "params": {
    "urlPatterns": ["<all_urls>"],
    "methods": ["GET", "POST", "PUT", "DELETE"],
    "types": ["xmlhttprequest", "script", "image"],
    "captureHeaders": true,
    "captureBody": false
  }
}
```

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| urlPatterns | string[] | `["<all_urls>"]` | URL patterns to monitor |
| methods | string[] | all | HTTP methods to capture |
| types | string[] | all | Resource types to capture |
| captureHeaders | boolean | true | Whether to capture request/response headers |
| captureBody | boolean | false | Whether to capture request bodies |

#### Resource Types

Available resource types: `main_frame`, `sub_frame`, `stylesheet`, `script`, `image`, `font`, `object`, `xmlhttprequest`, `ping`, `media`, `websocket`, `other`

#### Response

```json
{
  "command_id": "net-001",
  "success": true,
  "result": {
    "success": true,
    "message": "Network capture started",
    "urlPatterns": ["<all_urls>"],
    "captureHeaders": true,
    "captureBody": false
  }
}
```

### stop_network_capture

Stop capturing network traffic and optionally return captured data.

#### Request

```json
{
  "command_id": "net-002",
  "type": "stop_network_capture",
  "params": {
    "includeLog": true,
    "exportHAR": false
  }
}
```

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| includeLog | boolean | true | Include full network log in response |
| exportHAR | boolean | false | Export log in HAR format |

#### Response

```json
{
  "command_id": "net-002",
  "success": true,
  "result": {
    "success": true,
    "message": "Network capture stopped",
    "stats": {
      "isCapturing": false,
      "totalRequests": 45,
      "completedRequests": 43,
      "failedRequests": 2,
      "redirectedRequests": 5,
      "blockedRequests": 0,
      "logSize": 45,
      "durationMs": 12500
    },
    "requestCount": 45,
    "log": [/* captured requests */]
  }
}
```

### get_network_log

Get current network log with optional filtering.

#### Request

```json
{
  "command_id": "net-003",
  "type": "get_network_log",
  "params": {
    "urlPattern": "api\\.example\\.com",
    "method": "POST",
    "type": "xmlhttprequest",
    "status": "completed",
    "limit": 100,
    "offset": 0,
    "exportHAR": false
  }
}
```

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| urlPattern | string | - | Filter by URL pattern (regex) |
| method | string | - | Filter by HTTP method |
| type | string | - | Filter by resource type |
| status | string | - | Filter by status: `completed`, `failed`, `redirected` |
| limit | number | - | Maximum entries to return |
| offset | number | 0 | Entries to skip |
| exportHAR | boolean | false | Include HAR format export |

#### Response

```json
{
  "command_id": "net-003",
  "success": true,
  "result": {
    "success": true,
    "log": [
      {
        "requestId": "12345",
        "url": "https://api.example.com/data",
        "method": "POST",
        "type": "xmlhttprequest",
        "tabId": 1,
        "frameId": 0,
        "initiator": "https://example.com",
        "timeStamp": 1703520000000,
        "startTime": 1703520000000,
        "requestHeaders": {
          "Content-Type": "application/json",
          "Authorization": "Bearer ..."
        },
        "responseHeaders": {
          "Content-Type": "application/json",
          "X-Request-Id": "abc123"
        },
        "statusCode": 200,
        "statusLine": "HTTP/1.1 200 OK",
        "redirects": [],
        "completed": true,
        "error": null,
        "duration": 250,
        "timing": {
          "start": 1703520000000,
          "sendHeaders": 1703520000050,
          "headersReceived": 1703520000200,
          "responseStarted": 1703520000220,
          "completed": 1703520000250,
          "totalMs": 250,
          "timeToFirstByte": 150
        }
      }
    ],
    "count": 1,
    "stats": {
      "isCapturing": true,
      "totalRequests": 45
    }
  }
}
```

### clear_network_log

Clear the network log buffer.

#### Request

```json
{
  "command_id": "net-004",
  "type": "clear_network_log",
  "params": {}
}
```

#### Response

```json
{
  "command_id": "net-004",
  "success": true,
  "result": {
    "success": true,
    "message": "Cleared 45 log entries"
  }
}
```

### get_network_stats

Get network monitoring and interception statistics.

#### Request

```json
{
  "command_id": "net-005",
  "type": "get_network_stats",
  "params": {}
}
```

#### Response

```json
{
  "command_id": "net-005",
  "success": true,
  "result": {
    "success": true,
    "monitor": {
      "isCapturing": true,
      "totalRequests": 150,
      "completedRequests": 145,
      "failedRequests": 3,
      "redirectedRequests": 12,
      "blockedRequests": 2,
      "logSize": 150,
      "startTime": 1703520000000,
      "endTime": null,
      "durationMs": 60000
    },
    "interceptor": {
      "isActive": true,
      "interceptedRequests": 150,
      "blockedRequests": 2,
      "modifiedRequests": 10,
      "mockedRequests": 0,
      "redirectedRequests": 5,
      "ruleCounts": {
        "headerRules": 2,
        "blockRules": 3,
        "mockRules": 0,
        "redirectRules": 1
      }
    }
  }
}
```

## Request Interception

Request interception allows you to modify, block, or redirect network requests in real-time.

### add_request_rule

Add a request interception rule.

#### Request

```json
{
  "command_id": "rule-001",
  "type": "add_request_rule",
  "params": {
    "id": "block-analytics",
    "type": "block",
    "config": {
      "urlPattern": "google-analytics\\.com"
    }
  }
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | yes | Unique rule identifier |
| type | string | yes | Rule type: `header`, `block`, `mock`, `redirect` |
| config | object | yes | Type-specific configuration |

See [Rule Types](#rule-types) for detailed configuration options.

#### Response

```json
{
  "command_id": "rule-001",
  "success": true,
  "result": {
    "success": true,
    "message": "Block rule 'block-analytics' added",
    "rule": {
      "id": "block-analytics",
      "urlPattern": "google-analytics\\.com"
    }
  }
}
```

### remove_request_rule

Remove a request interception rule.

#### Request

```json
{
  "command_id": "rule-002",
  "type": "remove_request_rule",
  "params": {
    "id": "block-analytics",
    "type": "block"
  }
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | yes | Rule identifier to remove |
| type | string | no | Rule type (searches all if not specified) |

#### Response

```json
{
  "command_id": "rule-002",
  "success": true,
  "result": {
    "success": true,
    "message": "Block rule 'block-analytics' removed"
  }
}
```

### block_urls

Convenience command to block multiple URL patterns.

#### Request

```json
{
  "command_id": "block-001",
  "type": "block_urls",
  "params": {
    "patterns": [
      "google-analytics\\.com",
      "facebook\\.com/tr",
      "doubleclick\\.net"
    ]
  }
}
```

#### Response

```json
{
  "command_id": "block-001",
  "success": true,
  "result": {
    "success": true,
    "message": "Added 3 block rules",
    "ruleIds": [
      "block_1703520000000_a1b2c3d4e",
      "block_1703520000001_f5g6h7i8j",
      "block_1703520000002_k9l0m1n2o"
    ]
  }
}
```

### unblock_urls

Remove URL blocks.

#### Request

```json
{
  "command_id": "unblock-001",
  "type": "unblock_urls",
  "params": {
    "ruleIds": ["block_1703520000000_a1b2c3d4e"],
    "clearAll": false
  }
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| ruleIds | string[] | * | Rule IDs to remove |
| clearAll | boolean | * | Clear all block rules |

*Either `ruleIds` or `clearAll: true` is required.

#### Response

```json
{
  "command_id": "unblock-001",
  "success": true,
  "result": {
    "success": true,
    "message": "Removed 1 block rules",
    "removedCount": 1
  }
}
```

### get_interception_rules

Get all interception rules.

#### Request

```json
{
  "command_id": "rules-001",
  "type": "get_interception_rules",
  "params": {
    "type": "block"
  }
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type | string | no | Filter by rule type: `header`, `block`, `mock`, `redirect` |

#### Response

```json
{
  "command_id": "rules-001",
  "success": true,
  "result": {
    "success": true,
    "rules": [
      {
        "id": "block-analytics",
        "urlPattern": "google-analytics\\.com",
        "method": null,
        "resourceType": null,
        "enabled": true,
        "blockedCount": 15,
        "createdAt": 1703520000000
      }
    ]
  }
}
```

### clear_interception_rules

Clear all interception rules.

#### Request

```json
{
  "command_id": "clear-001",
  "type": "clear_interception_rules",
  "params": {
    "type": "block"
  }
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type | string | no | Clear only specific type (clears all if not specified) |

#### Response

```json
{
  "command_id": "clear-001",
  "success": true,
  "result": {
    "success": true,
    "message": "Cleared 3 block rules"
  }
}
```

## Rule Types

### Header Rules

Modify request headers before they are sent.

#### Configuration

```json
{
  "id": "add-custom-header",
  "type": "header",
  "config": {
    "urlPattern": "api\\.example\\.com",
    "method": "POST",
    "addHeaders": {
      "X-Custom-Header": "custom-value",
      "X-Request-Source": "basset-hound"
    },
    "removeHeaders": ["X-Unwanted-Header"],
    "modifyHeaders": {
      "User-Agent": {
        "value": "CustomBot/1.0"
      }
    }
  }
}
```

| Config Option | Type | Description |
|---------------|------|-------------|
| urlPattern | string | URL pattern to match (supports * wildcard or regex) |
| method | string | HTTP method to match (optional) |
| addHeaders | object | Headers to add (key-value pairs) |
| removeHeaders | string[] | Headers to remove |
| modifyHeaders | object | Headers to modify |

### Block Rules

Block requests matching the pattern.

#### Configuration

```json
{
  "id": "block-ads",
  "type": "block",
  "config": {
    "urlPattern": "ads\\.example\\.com",
    "method": "GET",
    "resourceType": "script"
  }
}
```

| Config Option | Type | Description |
|---------------|------|-------------|
| urlPattern | string | URL pattern to block |
| method | string | HTTP method to match (optional) |
| resourceType | string | Resource type to match (optional) |

### Mock Rules

Return mock responses for matching requests.

#### Configuration

```json
{
  "id": "mock-api",
  "type": "mock",
  "config": {
    "urlPattern": "api\\.example\\.com/test",
    "method": "GET",
    "response": {
      "status": 200,
      "headers": {
        "Content-Type": "application/json"
      },
      "body": {
        "success": true,
        "data": "mocked"
      }
    }
  }
}
```

| Config Option | Type | Description |
|---------------|------|-------------|
| urlPattern | string | URL pattern to mock |
| method | string | HTTP method to match (optional) |
| response.status | number | HTTP status code (default: 200) |
| response.headers | object | Response headers |
| response.body | any | Response body (objects are JSON stringified) |

Note: Mock responses have limitations in Manifest V3. Consider using a proxy server for complex mocking scenarios.

### Redirect Rules

Redirect requests to a different URL.

#### Configuration

```json
{
  "id": "redirect-api",
  "type": "redirect",
  "config": {
    "urlPattern": "api\\.production\\.com",
    "redirectUrl": "https://api.staging.com/",
    "method": "GET"
  }
}
```

| Config Option | Type | Description |
|---------------|------|-------------|
| urlPattern | string | URL pattern to match |
| redirectUrl | string | URL to redirect to |
| method | string | HTTP method to match (optional) |

## HAR Export

The network log can be exported in HAR (HTTP Archive) format for analysis in tools like Chrome DevTools or HAR analyzers.

#### Request

```json
{
  "command_id": "har-001",
  "type": "stop_network_capture",
  "params": {
    "includeLog": true,
    "exportHAR": true
  }
}
```

#### HAR Format Response

```json
{
  "har": {
    "log": {
      "version": "1.2",
      "creator": {
        "name": "Basset Hound Network Monitor",
        "version": "1.0.0"
      },
      "entries": [
        {
          "startedDateTime": "2024-01-01T12:00:00.000Z",
          "time": 250,
          "request": {
            "method": "GET",
            "url": "https://example.com/api",
            "httpVersion": "HTTP/1.1",
            "headers": [...],
            "queryString": [...],
            "bodySize": -1
          },
          "response": {
            "status": 200,
            "statusText": "HTTP/1.1 200 OK",
            "httpVersion": "HTTP/1.1",
            "headers": [...],
            "content": {
              "size": -1,
              "mimeType": "application/json"
            },
            "bodySize": -1
          },
          "cache": {},
          "timings": {
            "send": 50,
            "wait": 150,
            "receive": 30
          }
        }
      ]
    }
  }
}
```

## Legacy Commands

The original `get_network_requests` command is still available for backwards compatibility.

### get_network_requests (Legacy)

#### Request

```json
{
  "command_id": "legacy-001",
  "type": "get_network_requests",
  "params": {
    "action": "start",
    "filter": {
      "urls": ["<all_urls>"],
      "types": ["xmlhttprequest"]
    }
  }
}
```

#### Actions

| Action | Description |
|--------|-------------|
| start | Start capturing network requests |
| stop | Stop capturing network requests |
| get | Get captured requests with optional filters |
| clear | Clear captured requests buffer |

For new implementations, use the advanced commands (`start_network_capture`, `stop_network_capture`, etc.) for more features and better performance.

## Permissions Required

The following permissions are required in `manifest.json`:

```json
{
  "permissions": [
    "webRequest",
    "webRequestBlocking"
  ],
  "host_permissions": [
    "<all_urls>"
  ]
}
```

## Best Practices

1. **Start capture before navigation** - Begin network capture before navigating to ensure you capture all requests.

2. **Use URL patterns wisely** - Specific patterns reduce overhead and log noise.

3. **Clear logs periodically** - Large logs consume memory. Clear after analysis.

4. **Export HAR for analysis** - HAR format is compatible with many network analysis tools.

5. **Disable capture when not needed** - Network monitoring has performance overhead.

6. **Use block rules sparingly** - Blocking critical resources can break page functionality.

7. **Test rules in isolation** - Verify each rule works as expected before combining.
