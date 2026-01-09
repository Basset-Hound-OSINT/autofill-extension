# OSINT Platform Vision: autofill-extension Integration

**Date:** 2026-01-08
**Reference:** See `/home/devel/basset-hound/docs/findings/VISION-RESEARCH-2026-01-08.md` for comprehensive research

---

## Executive Summary

This document outlines the strategic integration of autofill-extension into the basset-hound OSINT investigation platform. The extension serves as the **browser data detection and form interaction layer**.

---

## Project Scope

### Core Mission
- Detect OSINT-relevant data on web pages (identifiers, entities, relationships)
- Identify form fields and their semantic types
- Enable user selection and labeling of detected data
- Capture screenshots and element context for evidence
- Send data to basset-hound with full provenance metadata

### NOT in Scope
- Entity storage and relationship management (handled by basset-hound)
- Headless browser automation (handled by basset-hound-browser)
- AI agent logic and decision making (handled by palletai)

---

## Integration Points

### With basset-hound (Entity Storage)
| Integration | Method | Purpose |
|-------------|--------|---------|
| Data ingestion | REST API + WebSocket | Send detected/selected data with provenance |
| Entity lookup | REST API | Fetch entity data for form autofill |
| Orphan creation | REST API | Create orphan identifiers from detected data |

### With palletai (AI Agents)
| Integration | Method | Purpose |
|-------------|--------|---------|
| Field detection | MCP Server | AI agent requests page field analysis |
| OSINT extraction | MCP Server | AI agent requests detected OSINT data |
| Evidence capture | MCP Server | AI agent triggers screenshot with metadata |

### With basset-hound-browser (Automation)
| Integration | Method | Purpose |
|-------------|--------|---------|
| Coordination | Message passing | Synchronize when both are active on same page |
| Profile awareness | Shared state | Know which sock puppet profile is active |

---

## Key Capabilities for OSINT

### 1. Sock Puppet Form Filling (Roadmap Phase 10)
- Load sock puppet entity from basset-hound
- Auto-fill registration/login forms with identity data
- Support platform-specific field mappings
- Maintain OPSEC by using correct credentials per profile

### 2. Evidence Collection (Roadmap Phase 11)
- Capture full-page screenshots with metadata
- Record element bounding boxes for forensic reference
- Generate file hashes for integrity verification
- Maintain chain of custody documentation

### 3. AI Agent Integration (Roadmap Phase 12)
- MCP server exposes extension capabilities to palletai agents
- `detect_fields()` - Returns form field analysis
- `get_page_osint_data()` - Returns detected OSINT identifiers
- `capture_evidence()` - Returns screenshot + metadata package

---

## Data Flow Example

```
┌─────────────────┐
│  User browses   │
│  target website │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│ autofill-ext    │────▶│ OSINT Detection  │
│ detects data    │     │ (emails, phones, │
└────────┬────────┘     │  usernames, etc) │
         │              └──────────────────┘
         ▼
┌─────────────────┐
│ User selects    │
│ + labels data   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│ Send to         │────▶│ basset-hound     │
│ basset-hound    │     │ creates entity/  │
└─────────────────┘     │ orphan with      │
                        │ provenance       │
                        └──────────────────┘
```

---

## MCP Server Tools (To Implement)

| Tool | Description | Parameters |
|------|-------------|------------|
| `detect_fields` | Analyze current page forms | `page_url` |
| `get_page_osint_data` | Get detected OSINT identifiers | `page_url` |
| `capture_evidence` | Screenshot with metadata | `page_url`, `selector?` |
| `ingest_selection` | User-selected data to entity | `entity_id`, `data` |
| `fill_form` | Fill form with provided data | `fields` |
| `fill_with_entity` | Fill form from basset-hound entity | `entity_id` |

---

## Security Considerations

1. **Credential Handling**
   - Never store credentials locally
   - Always fetch from basset-hound with authentication
   - Clear form data after submission

2. **Evidence Integrity**
   - Hash all screenshots immediately
   - Include capture timestamp and URL
   - Document any user modifications

3. **Profile Isolation**
   - Respect browser profile boundaries
   - Don't leak data between sock puppet sessions
   - Clear extension state on profile switch

---

## Related Documents

- Full vision research: `/home/devel/basset-hound/docs/findings/VISION-RESEARCH-2026-01-08.md`
- basset-hound roadmap: `/home/devel/basset-hound/docs/ROADMAP.md`
- autofill-extension roadmap: `/home/devel/autofill-extension/docs/ROADMAP.md`
