# Quick Reference: Network Export & Content Extraction

## Network Export Commands

### Export as HAR
```json
{
  "type": "export_network_har",
  "params": {
    "urlPattern": ".*api.*",
    "method": "POST",
    "includeContent": false
  }
}
```

### Export as CSV
```json
{
  "type": "export_network_csv",
  "params": {
    "fields": ["method", "url", "statusCode", "duration"]
  }
}
```

### Save to File
```json
{
  "type": "save_network_log",
  "params": {
    "format": "har",
    "filename": "capture.har"
  }
}
```

### Get Summary
```json
{
  "type": "get_network_summary",
  "params": {
    "groupBy": "type"
  }
}
```

## Content Extraction Commands

### Extract Tables
```json
{
  "type": "extract_tables",
  "params": {
    "parseNumbers": true,
    "minRows": 1
  }
}
```

### Extract Links
```json
{
  "type": "extract_links",
  "params": {
    "includeExternal": true,
    "maxLinks": 100
  }
}
```

### Extract Images
```json
{
  "type": "extract_images",
  "params": {
    "includeDimensions": true
  }
}
```

### Extract Structured Data
```json
{
  "type": "extract_structured_data",
  "params": {
    "includeJsonLd": true
  }
}
```

### Extract Metadata
```json
{
  "type": "extract_metadata",
  "params": {
    "includeOpenGraph": true,
    "includeTwitter": true
  }
}
```

### Extract Text
```json
{
  "type": "extract_text_content",
  "params": {
    "selector": "article",
    "excludeSelectors": ["nav", "footer"]
  }
}
```

### Download Resources
```json
{
  "type": "download_resources",
  "params": {
    "types": ["images"],
    "maxResources": 20
  }
}
```

## Common Patterns

### Complete Page Analysis
```python
# Start monitoring
await client.send_command({"type": "start_network_capture"})

# Navigate
await client.send_command({"type": "navigate", "params": {"url": url}})

# Extract all content
tables = await client.send_command({"type": "extract_tables"})
links = await client.send_command({"type": "extract_links"})
metadata = await client.send_command({"type": "extract_metadata"})

# Get network summary
network = await client.send_command({"type": "get_network_summary"})
```

### Data Mining Workflow
```python
# Extract structured data
data = await client.send_command({"type": "extract_structured_data"})

# Extract tables
tables = await client.send_command({
    "type": "extract_tables",
    "params": {"parseNumbers": True}
})

# Save results
import json
with open("data.json", "w") as f:
    json.dump({"structured": data, "tables": tables}, f)
```

### SEO Audit
```python
# Extract metadata
meta = await client.send_command({"type": "extract_metadata"})

# Extract links
links = await client.send_command({"type": "extract_links"})

# Check issues
issues = []
if not meta["metadata"]["standard"].get("description"):
    issues.append("Missing description")
if not meta["metadata"]["openGraph"].get("image"):
    issues.append("Missing OG image")
```

## Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

## Common Parameters

### Filtering
- `urlPattern`: Regex pattern for URLs
- `selector`: CSS selector for elements
- `method`: HTTP method (GET, POST, etc.)
- `type`: Resource type (xhr, script, image, etc.)

### Limits
- `maxTables`: Maximum tables to extract
- `maxLinks`: Maximum links to extract
- `maxImages`: Maximum images to extract
- `maxResources`: Maximum resources to download
- `maxLength`: Maximum text length

### Options
- `includeHeaders`: Include table headers
- `parseNumbers`: Parse numeric values
- `includeDimensions`: Include image dimensions
- `preserveWhitespace`: Preserve text whitespace
- `includeHidden`: Include hidden elements

## Tips

1. **Always use filters** to reduce data volume
2. **Set limits** to prevent memory issues
3. **Validate data** before processing
4. **Check success** flag in responses
5. **Use specific selectors** for better performance
6. **Clear logs** between sessions
7. **Combine commands** for complex workflows

## See Also

- [Network Export Guide](NETWORK_EXPORT_GUIDE.md) - Complete documentation
- [Content Extraction Guide](CONTENT_EXTRACTION_GUIDE.md) - Complete documentation
- [Feature Summary](FEATURE_SUMMARY.md) - Overview of all features
