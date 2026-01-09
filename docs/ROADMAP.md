# Basset Hound Browser Automation Extension - Development Roadmap

> **Current Version:** v2.19.0 (January 9, 2026)
> **Status:** Production Certified - Phase 14 Complete + Forensics Modules
> **Previous Phases:** See [ROADMAP-ARCHIVE-V1.md](ROADMAP-ARCHIVE-V1.md) for Phases 1-13

---

## Quick Reference

### What's Built (Phases 1-13)
- ✅ Core browser automation (navigate, click, fill, screenshot)
- ✅ Network monitoring, request interception, HAR export
- ✅ OSINT pattern detection (15+ patterns: email, phone, crypto, IP, domains)
- ✅ Ingest panel UI with element picker
- ✅ Sock puppet integration with TOTP/2FA
- ✅ Evidence capture with chain of custody
- ✅ Annotation tools (highlight, redaction, text)
- ✅ Investigation context manager
- ✅ Smart form filling from entities
- ✅ Format validation (client-side pattern checks)
- ✅ MCP Server (76+ tools for AI agents)

**Note:** Phase 13 verification modules (blockchain/email/phone lookups) moved to basset-hound backend. See [PROJECT-SCOPE.md](PROJECT-SCOPE.md).

### Current Focus
**Phase 14 Complete:** Evidence session management for multi-page investigations
**Forensics Complete:** Page forensics + browser snapshot modules
**Next:** Integration handlers, workflow automation, advanced forensics

### Project Scope
This extension is a **browser automation API and MCP server**, NOT an OSINT analysis toolkit. We push Chrome extension limits for **browser forensics** (data extraction), while external data **verification** (blockchain lookups, DNS queries, breach checking) belongs in basset-hound backend. See [PROJECT-SCOPE.md](PROJECT-SCOPE.md) for details.

---

## Phase 14: Evidence Session Management - 📋 PLANNED

**Goal:** Enable multi-page evidence collection with session tracking.

### 14.1 Evidence Sessions

| Task | Status | Description |
|------|--------|-------------|
| Session creation | 📋 Planned | Start named evidence session with metadata |
| Cross-page linking | 📋 Planned | Link evidence items across multiple pages |
| Session timeline | 📋 Planned | Chronological view of all captures |
| Session export | 📋 Planned | Export entire session as evidence package |

### 14.2 Session UI

| Task | Status | Description |
|------|--------|-------------|
| Session panel | 📋 Planned | Floating panel showing active session |
| Quick capture | 📋 Planned | One-click capture to current session |
| Session browser | 📋 Planned | View/manage past sessions |
| Session search | 📋 Planned | Search across all evidence |

### 14.3 MCP Commands

```javascript
// Start evidence session
mcp.tool("start_evidence_session", { name: "Investigation Alpha", case_id: "2026-001" })

// Add to session
mcp.tool("capture_to_session", { session_id: "sess-123", annotation: "Subject profile" })

// Export session
mcp.tool("export_evidence_session", { session_id: "sess-123", format: "pdf" })
```

---

## Phase 15: DevTools Integration - 📋 PLANNED

**Goal:** Add OSINT ingestion tab to Chrome DevTools panel.

### 15.1 Ingest Tab

| Task | Status | Description |
|------|--------|-------------|
| DevTools panel tab | 📋 Planned | New "Ingest" tab in existing DevTools panel |
| Detected data list | 📋 Planned | Real-time OSINT detection results |
| Verification indicators | 📋 Planned | Visual status for each detected item |
| Batch operations | 📋 Planned | Select all, filter by type, bulk ingest |

### 15.2 History & Analytics

| Task | Status | Description |
|------|--------|-------------|
| Ingestion history | 📋 Planned | Track what was ingested and when |
| Detection stats | 📋 Planned | Charts showing detection patterns |
| Entity graph preview | 📋 Planned | Mini graph of related entities |

---

## Phase 16: Advanced Content Extraction - 📋 PLANNED

**Goal:** Extract OSINT data from complex content types.

### 16.1 Document Scanning

| Task | Status | Description |
|------|--------|-------------|
| PDF text extraction | 📋 Planned | Extract text from embedded PDFs |
| Image OCR | 📋 Planned | OCR for images containing text |
| Table extraction | 📋 Planned | Parse HTML/PDF tables to structured data |

### 16.2 Dynamic Content

| Task | Status | Description |
|------|--------|-------------|
| MutationObserver | 📋 Planned | Detect OSINT in AJAX-loaded content |
| Infinite scroll handling | 📋 Planned | Auto-scan as user scrolls |
| SPA navigation | 📋 Planned | Re-scan on client-side route changes |

---

## Phase 17: Workflow Automation - 📋 PLANNED

**Goal:** Enable investigators to define and run automated workflows.

### 17.1 Workflow Builder

| Task | Status | Description |
|------|--------|-------------|
| Workflow definition | 📋 Planned | JSON/YAML workflow definitions |
| Step sequencing | 📋 Planned | Navigate → Detect → Verify → Ingest pipelines |
| Conditional logic | 📋 Planned | If/else based on detection results |
| Loop support | 📋 Planned | Iterate over lists (search results, profiles) |

### 17.2 Preset Workflows

| Workflow | Description |
|----------|-------------|
| Social Media Sweep | Profile lookup across 10 platforms |
| Email Investigation | HIBP + Hunter + domain verification |
| Crypto Tracing | Address lookup + transaction history |
| Domain Recon | WHOIS + DNS + Wayback + subdomains |

---

## Phase 18: Collaboration Features - 📋 PLANNED

**Goal:** Enable team collaboration on investigations.

### 18.1 Shared Sessions

| Task | Status | Description |
|------|--------|-------------|
| Session sharing | 📋 Planned | Share evidence sessions with team |
| Real-time sync | 📋 Planned | Live updates across team members |
| Comments/notes | 📋 Planned | Add comments to evidence items |
| Assignment | 📋 Planned | Assign evidence review to team members |

### 18.2 Export/Import

| Task | Status | Description |
|------|--------|-------------|
| Case export | 📋 Planned | Export full investigation package |
| Evidence import | 📋 Planned | Import evidence from other tools |
| Report generation | 📋 Planned | Generate investigation reports |

---

## Technical Debt & Improvements

| Item | Priority | Description |
|------|----------|-------------|
| Test coverage | Medium | Add tests for Phase 11-13 features |
| Performance profiling | Medium | Optimize content script for large pages |
| Memory management | Medium | Handle long investigation sessions |
| Error recovery | Low | Improve error handling across modules |

---

## Dependencies

### Required
- **palletAI** running at `ws://localhost:8765/browser`
- **Chrome/Chromium** 88+ or **Firefox** 109+

### Optional
- **basset-hound** for entity storage and graph analysis
- **basset-hound-browser** for advanced automation (Electron)

---

## Quick Start for Development

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Watch mode for development
npm run dev:watch
```

---

## Contributing

When implementing features:
1. Create feature branch
2. Add tests in `tests/unit/` or `tests/e2e/`
3. Document findings in `docs/findings/`
4. Update this roadmap
5. Submit PR

---

*Last Updated: January 9, 2026*
*Version: v2.18.0*
*Archive: [ROADMAP-ARCHIVE-V1.md](ROADMAP-ARCHIVE-V1.md)*
