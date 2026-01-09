# basset-hound Integration Requirements for autofill-extension

**Date:** 2026-01-08
**Source:** basset-hound Phase 41 Research
**Status:** Integration Planning

---

## Overview

This document outlines integration requirements between autofill-extension and basset-hound MCP server. It was generated during basset-hound Phase 41 development to bridge the gap between repositories.

**Key Principle:** basset-hound provides MCP tools for data storage and retrieval. autofill-extension consumes these tools for form filling and OSINT data ingestion.

---

## 1. Available basset-hound MCP Tools

### Entity Tools (Existing - 99 tools total)

| Tool | Description |
|------|-------------|
| `get_entity` | Get entity by ID |
| `query_entities` | Query entities with filters |
| `create_entity` | Create new entity |
| `update_entity` | Update entity fields |
| `get_entity_graph` | Get relationship graph |

### Verification Tools (Existing)

| Tool | Description |
|------|-------------|
| `verify_email` | Validate email format, check disposable |
| `verify_phone` | Validate phone, detect carrier |
| `verify_crypto` | Detect cryptocurrency addresses |
| `verify_domain` | Validate domain, check DNS |
| `batch_verify` | Batch verification (up to 100) |

### Orphan Data Tools (Existing)

| Tool | Description |
|------|-------------|
| `create_orphan` | Store unlinked identifier |
| `create_orphan_batch` | Batch create orphans |
| `link_orphan` | Link orphan to entity |
| `list_orphans` | List orphan data |

### Sock Puppet Tools (Existing)

| Tool | Description |
|------|-------------|
| `get_sock_puppet` | Get puppet identity |
| `list_sock_puppets` | List all puppets |
| `add_platform_account` | Add platform account |
| `record_puppet_activity` | Log puppet activity |

### New Browser Integration Tools (Phase 41 - Coming Soon)

| Tool | Description |
|------|-------------|
| `get_autofill_data` | Entity data formatted for forms |
| `suggest_form_mapping` | Map form fields to entity paths |
| `get_sock_puppet_profile` | Identity for browser use |
| `capture_evidence` | Store browser-captured evidence |
| `register_browser_session` | Track browser sessions |

---

## 2. Integration Tasks for autofill-extension

### HIGH PRIORITY

#### Task 1: Formalize basset-hound MCP Client

**Current State:** `utils/data-pipeline/basset-hound-sync.js` exists but uses REST API

**Required Changes:**
```javascript
// Create: mcp-server/basset-hound-client.js
class BassetHoundMCPClient {
    constructor(baseUrl = 'http://localhost:8000') {
        this.baseUrl = baseUrl;
        this.mcp_endpoint = `${baseUrl}/mcp`;
    }

    async executeTool(toolName, params) {
        // Execute via MCP protocol
        const response = await fetch(`${this.mcp_endpoint}/execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({
                tool: toolName,
                parameters: params
            })
        });
        return response.json();
    }

    // Convenience methods
    async getAutofillData(entityId) {
        return this.executeTool('get_autofill_data', {
            project_id: this.projectId,
            entity_id: entityId
        });
    }

    async getSockPuppetProfile(puppetId, platform) {
        return this.executeTool('get_sock_puppet_profile', {
            project_id: this.projectId,
            puppet_id: puppetId,
            platform: platform
        });
    }
}
```

**Add to Roadmap:** Phase 14 - basset-hound MCP Client Formalization

#### Task 2: Update entity-form-filler.js to Use MCP

**Current State:** Direct REST API calls

**Required Changes:**
- Import BassetHoundMCPClient
- Replace REST calls with MCP tool calls
- Use `get_autofill_data` for form filling
- Use `suggest_form_mapping` for field detection

**Add to Roadmap:** Phase 14

#### Task 3: Implement OSINT Data Ingestion via MCP

**Current State:** Field detection exists, ingestion partial

**Required Changes:**
```javascript
// In utils/data-pipeline/field-detector.js

async function ingestDetectedData(detectedFields, url) {
    const bhClient = new BassetHoundMCPClient();

    // 1. Verify each identifier
    const verified = await Promise.all(
        detectedFields.map(async (field) => {
            const result = await bhClient.executeTool('verify_identifier', {
                identifier: field.value,
                identifier_type: field.type
            });
            return { ...field, verification: result };
        })
    );

    // 2. Create orphan batch for valid data
    const validData = verified.filter(f => f.verification.is_valid);
    if (validData.length > 0) {
        await bhClient.executeTool('create_orphan_batch', {
            project_id: currentProjectId,
            orphans: validData.map(f => ({
                identifier_type: f.type,
                identifier_value: f.value,
                source_url: url,
                confidence: f.confidence
            }))
        });
    }

    return verified;
}
```

**Add to Roadmap:** Phase 14

### MEDIUM PRIORITY

#### Task 4: Bidirectional Entity Sync

**Current State:** Extension syncs TO basset-hound only

**Required Changes:**
- Subscribe to basset-hound entity updates
- Implement WebSocket listener for entity changes
- Update local cache when entities change
- Highlight found entities on page in real-time

**Add to Roadmap:** Phase 15

#### Task 5: Error Code Standardization

**Current State:** Extension has own error codes

**Required Changes:**
- Map basset-hound error codes to extension error handling
- Implement consistent error display
- Add retry logic based on error type

**Add to Roadmap:** Phase 16

---

## 3. Authentication Pattern

basset-hound will support:
- Bearer token authentication
- Extension-specific headers

**Required Headers:**
```javascript
{
    'Authorization': 'Bearer <token>',
    'Content-Type': 'application/json',
    'X-Extension-Version': chrome.runtime.getManifest().version,
    'X-Browser-Session-ID': sessionId
}
```

---

## 4. Data Format Standards

### Form Field Format (from extension to basset-hound)

```json
{
    "form_fields": [
        {
            "id": "email_input",
            "name": "email",
            "type": "email",
            "label": "Email Address",
            "placeholder": "Enter your email",
            "aria_label": null
        }
    ]
}
```

### Entity Autofill Format (from basset-hound to extension)

```json
{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "company": "Acme Inc",
    "address": {
        "street": "123 Main St",
        "city": "Seattle",
        "country": "US"
    }
}
```

### Sock Puppet Profile Format

```json
{
    "alias_name": "Cover Identity",
    "backstory": "IT Consultant from Seattle...",
    "birth_date": "1985-03-15",
    "nationality": "US",
    "occupation": "IT Consultant",
    "platform_accounts": [
        {
            "platform": "linkedin",
            "username": "cover.identity",
            "email": "cover@protonmail.com",
            "credential_vault_ref": "keepass://sock_puppets/cover",
            "account_status": "active"
        }
    ]
}
```

---

## 5. Testing Integration

### Manual Testing Steps

1. Start basset-hound MCP server: `python -m basset_mcp.server`
2. Load extension in Chrome
3. Navigate to a form page
4. Test autofill with entity from basset-hound
5. Test OSINT detection and ingestion

### Automated Tests

Add to `tests/integration/basset-hound-mcp.test.js`:
```javascript
describe('basset-hound MCP Integration', () => {
    it('should get autofill data for entity', async () => {
        const client = new BassetHoundMCPClient();
        const result = await client.getAutofillData('test-entity-id');
        expect(result.firstName).toBeDefined();
    });

    it('should suggest form mappings', async () => {
        const client = new BassetHoundMCPClient();
        const fields = [{ id: 'email', type: 'email' }];
        const result = await client.executeTool('suggest_form_mapping', {
            project_id: 'test',
            entity_id: 'entity-1',
            form_fields: fields
        });
        expect(result.mappings.length).toBeGreaterThan(0);
    });
});
```

---

## 6. Roadmap Updates Required

Add these phases to `/docs/ROADMAP.md`:

### Phase 14: basset-hound MCP Client Formalization

**Goal:** Replace REST API calls with proper MCP protocol

**Tasks:**
- [ ] Create `mcp-server/basset-hound-client.js`
- [ ] Update `utils/form/entity-form-filler.js` to use MCP client
- [ ] Update `utils/data-pipeline/basset-hound-sync.js` to use MCP client
- [ ] Implement authentication flow
- [ ] Add connection health checking

### Phase 15: Bidirectional Entity Sync

**Goal:** Real-time sync between extension and basset-hound

**Tasks:**
- [ ] Implement WebSocket subscription to basset-hound
- [ ] Add entity change listener
- [ ] Update local cache on changes
- [ ] Highlight found entities on page
- [ ] Add sync status indicator

### Phase 16: Error Standardization

**Goal:** Consistent error handling with basset-hound

**Tasks:**
- [ ] Map basset-hound error codes
- [ ] Implement error display component
- [ ] Add retry logic for transient errors
- [ ] Add error telemetry

---

## 7. References

- **basset-hound MCP Server:** `/home/devel/basset-hound/basset_mcp/`
- **basset-hound Integration Doc:** `/home/devel/basset-hound/docs/findings/INTEGRATION-BROWSER-APIS-2026-01-08.md`
- **MCP Protocol Spec:** https://spec.modelcontextprotocol.io/

---

## Summary

The autofill-extension already has most functionality needed for basset-hound integration. The main work is:

1. **Formalize MCP client** (replace REST with MCP protocol)
2. **Use new autofill tools** (get_autofill_data, suggest_form_mapping)
3. **Implement bidirectional sync** (currently one-way)
4. **Standardize error handling** (align with basset-hound errors)

The extension's 78 MCP tools for browser automation remain unchanged - they serve palletai and other AI agents. basset-hound integration adds data storage capabilities without changing browser automation.
