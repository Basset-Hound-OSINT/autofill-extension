# Basset Hound Workflow Examples

This directory contains example workflows for the Basset Hound Browser Automation Extension workflow automation system.

## Overview

Workflows are JSON files that define automated browser automation sequences for OSINT investigations. Each workflow can:

- Navigate to URLs
- Fill forms and click elements
- Extract content and detect OSINT patterns
- Capture evidence (screenshots, metadata)
- Loop through data and handle conditions
- Send results to basset-hound backend

## Available Workflows

### 1. Social Media Sweep (`social-media-sweep.json`)

**Purpose:** Check if a username exists across 10+ social media platforms.

**Inputs:**
- `username` (string, required): Username to search

**Platforms Checked:**
- Twitter
- GitHub
- Reddit
- LinkedIn
- Instagram
- Facebook
- TikTok
- Pinterest
- Tumblr
- Medium

**Outputs:**
- Array of found profiles with extracted data
- Total count of profiles found
- Evidence items (screenshots)

**Use Case:** Username enumeration and profile discovery across multiple social media platforms.

---

### 2. Email Investigation (`email-investigation.json`)

**Purpose:** Comprehensive email investigation across multiple sources.

**Inputs:**
- `email` (string, required): Email address to investigate
- `maxSearchResults` (number, optional): Max Google results to analyze (default: 10)

**Steps:**
1. Check HaveIBeenPwned for data breaches
2. Search Google for email mentions
3. Visit each search result and detect email context
4. Extract and analyze mentions
5. Generate comprehensive report

**Outputs:**
- Breach data from HIBP
- Search results with email mentions
- Evidence items for each page
- Investigation report

**Use Case:** Email OSINT investigation and breach checking.

---

### 3. Domain Reconnaissance (`domain-recon.json`)

**Purpose:** Gather comprehensive information about a domain.

**Inputs:**
- `domain` (string, required): Domain name to investigate

**Parallel Checks:**
1. WHOIS lookup (who.is)
2. Wayback Machine snapshots (web.archive.org)
3. DNS records (mxtoolbox.com)
4. Subdomain enumeration (crt.sh)

**Outputs:**
- WHOIS registration data
- Wayback snapshot dates
- DNS records (A, MX, TXT, etc.)
- Discovered subdomains
- Evidence for each check

**Use Case:** Domain OSINT reconnaissance and infrastructure mapping.

---

### 4. Profile Extraction (`profile-extraction.json`)

**Purpose:** Extract all profiles from LinkedIn or similar search results.

**Inputs:**
- `searchUrl` (string, required): URL of search results page
- `profileLinkSelector` (string, required): CSS selector for profile links
- `maxProfiles` (number, optional): Max profiles to extract (default: 20)
- `handlePagination` (boolean, optional): Navigate to next page (default: false)

**Steps:**
1. Navigate to search results
2. Extract all profile links
3. Loop through each profile:
   - Navigate to profile
   - Extract structured data (name, title, location, bio)
   - Detect OSINT patterns
   - Capture screenshot
4. Handle pagination if enabled
5. Generate extraction report

**Outputs:**
- Array of extracted profiles
- Total profiles extracted
- Evidence for each profile

**Use Case:** Bulk profile extraction from search results for data collection.

---

### 5. Multi-Page Evidence Collection (`multi-page-evidence.json`)

**Purpose:** Collect evidence from multiple pages in a forensic session.

**Inputs:**
- `caseId` (string, required): Case identifier
- `urls` (array, required): URLs to collect evidence from
- `investigator` (string, optional): Investigator name
- `sessionName` (string, optional): Evidence session name

**Steps:**
1. Start evidence session
2. Loop through each URL:
   - Navigate to page
   - Capture full-page screenshot
   - Extract page metadata
   - Detect OSINT patterns
   - Extract all links
   - Add to evidence session
3. Close and export evidence session
4. Generate chain of custody report

**Outputs:**
- Evidence session ID
- Total evidence items collected
- Export file path

**Use Case:** Forensic evidence collection across multiple pages with chain of custody.

---

## Workflow Schema

All workflows follow the JSON schema defined in `/docs/architecture/WORKFLOW-AUTOMATION-DESIGN.md`.

### Required Fields

```json
{
  "id": "unique-uuid",
  "name": "Workflow Name",
  "version": "1.0.0",
  "steps": [...]
}
```

### Step Types

- `navigate` - Navigate to URL
- `click` - Click element
- `fill` - Fill form fields
- `extract` - Extract content
- `detect` - Detect OSINT patterns
- `wait` - Wait for condition
- `screenshot` - Capture screenshot
- `conditional` - If/else branching
- `loop` - Iterate over array
- `parallel` - Run steps concurrently
- `script` - Execute JavaScript
- `verify` - Verify data format
- `ingest` - Send to basset-hound

## Using Workflows

### Option 1: Via UI (Workflow Builder)

1. Open extension popup
2. Click "Workflows" tab
3. Click "Import" and select workflow JSON
4. Click "Run" and provide inputs
5. Monitor execution progress
6. View results and evidence

### Option 2: Via MCP Command (AI Agents)

```python
# Execute workflow from palletAI
result = await browser.send_command({
    "type": "execute_workflow",
    "params": {
        "workflowId": "social-media-sweep",
        "inputs": {
            "username": "johndoe"
        }
    }
})

# Monitor execution
execution_id = result["executionId"]
status = await browser.send_command({
    "type": "get_workflow_status",
    "params": {
        "executionId": execution_id
    }
})
```

### Option 3: Via JavaScript (Content Script)

```javascript
// Execute workflow from content script
const result = await chrome.runtime.sendMessage({
  action: 'execute_workflow',
  workflowId: 'email-investigation',
  inputs: {
    email: 'test@example.com'
  }
});

console.log('Execution ID:', result.executionId);
```

## Creating Custom Workflows

### Step 1: Copy Template

Start with an existing workflow and modify it:

```bash
cp social-media-sweep.json my-custom-workflow.json
```

### Step 2: Update Metadata

```json
{
  "id": "generate-new-uuid",
  "name": "My Custom Workflow",
  "description": "What this workflow does",
  "author": "Your Name",
  "tags": ["custom", "osint"],
  "category": "general"
}
```

### Step 3: Define Inputs

```json
{
  "inputs": [
    {
      "name": "target",
      "type": "string",
      "label": "Target Name",
      "required": true
    }
  ]
}
```

### Step 4: Add Steps

```json
{
  "steps": [
    {
      "id": "step-1",
      "name": "Navigate to Target",
      "type": "navigate",
      "params": {
        "url": "https://example.com/search?q=${target}"
      }
    },
    {
      "id": "step-2",
      "name": "Extract Results",
      "type": "extract",
      "params": {
        "mode": "structured",
        "selectors": {
          "results": ".result"
        }
      }
    }
  ]
}
```

### Step 5: Test Workflow

1. Import workflow in UI
2. Run with test inputs
3. Check execution logs for errors
4. Iterate until working

## Best Practices

### 1. Error Handling

Always set `continueOnError: true` for non-critical steps:

```json
{
  "id": "optional-step",
  "type": "extract",
  "continueOnError": true,
  "params": {...}
}
```

### 2. Rate Limiting

Add delays between requests to avoid rate limiting:

```json
{
  "id": "rate-limit-delay",
  "type": "wait",
  "params": {
    "for": "time",
    "time": 2000
  }
}
```

### 3. Evidence Capture

Enable screenshot capture for important steps:

```json
{
  "id": "capture-evidence",
  "type": "screenshot",
  "params": {
    "fullPage": true,
    "format": "png"
  },
  "outputs": {
    "screenshot": "dataUrl"
  }
}
```

### 4. Variable Usage

Use variables for data passing between steps:

```json
{
  "id": "extract-data",
  "type": "extract",
  "outputs": {
    "extractedData": "result"
  }
},
{
  "id": "use-data",
  "type": "script",
  "params": {
    "code": "console.log(extractedData);"
  }
}
```

### 5. Conditional Logic

Use conditionals to handle different scenarios:

```json
{
  "id": "check-result",
  "type": "conditional",
  "params": {
    "condition": "extractedData !== null",
    "then": [
      { "id": "success-step", "type": "ingest", "params": {...} }
    ],
    "else": [
      { "id": "failure-step", "type": "script", "params": {...} }
    ]
  }
}
```

## Workflow Configuration

### Global Settings

```json
{
  "config": {
    "timeout": 600000,
    "retryPolicy": {
      "enabled": true,
      "maxRetries": 3,
      "retryDelay": 2000,
      "retryBackoff": "exponential"
    },
    "evidence": {
      "captureScreenshots": true,
      "captureDOM": false,
      "captureNetwork": false
    },
    "execution": {
      "mode": "sequential",
      "maxParallel": 3,
      "continueOnError": true
    }
  }
}
```

### Step-Level Overrides

```json
{
  "id": "important-step",
  "type": "navigate",
  "timeout": 30000,
  "retries": 5,
  "continueOnError": false,
  "params": {...}
}
```

## Troubleshooting

### Common Issues

**1. Workflow Fails to Load**
- Check JSON syntax (use JSONLint.com)
- Verify schema compliance
- Check required fields

**2. Step Timeout Errors**
- Increase step timeout
- Check network connectivity
- Verify selector accuracy

**3. Element Not Found**
- Test selectors in browser DevTools
- Add wait step before interaction
- Use multiple selector strategies

**4. Rate Limiting**
- Add longer delays between requests
- Reduce parallel execution
- Use stealth mode

### Debug Mode

Enable debug mode for detailed logging:

```json
{
  "config": {
    "debug": true,
    "logLevel": "DEBUG"
  }
}
```

## Contributing Workflows

To contribute a workflow to the preset library:

1. Create workflow JSON following schema
2. Test thoroughly with various inputs
3. Add comprehensive documentation
4. Submit pull request with:
   - Workflow JSON file
   - README entry
   - Example inputs/outputs
   - Test results

## License

These example workflows are provided as-is for educational and investigative purposes. Ensure compliance with:

- Website terms of service
- Local laws and regulations
- Ethical OSINT guidelines
- Data protection requirements

## Support

For help with workflows:
- Read: `/docs/architecture/WORKFLOW-AUTOMATION-DESIGN.md`
- Check: Execution logs in workflow monitor
- Report: Issues on GitHub
- Ask: Community forum

---

**Last Updated:** January 9, 2026
**Version:** 1.0.0
**Total Workflows:** 5
