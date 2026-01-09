# Basset Hound Browser Automation Extension - Project Scope

> **Last Updated:** January 9, 2026
> **Purpose:** Define clear boundaries for what belongs in this extension vs backend services

---

## Core Mission

**autofill-extension** is a **browser automation API and MCP server** that enables AI agents (via palletAI) to control browser actions and collect information from web pages. It is **NOT an OSINT analysis toolkit**.

---

## In Scope ✅

### 1. Browser Automation
- Navigate to URLs
- Click elements, fill forms
- Scroll, hover, wait for elements
- Tab management, window control
- Screenshot capture

### 2. Content Extraction
- DOM content (text, HTML, attributes)
- Form field detection
- Network traffic monitoring (HAR export)
- Cookies, localStorage, sessionStorage
- Request/response headers

### 3. Data Pattern Detection
- **Detect** email addresses, phone numbers, crypto addresses, IPs, domains **on pages**
- Visual highlighting of detected data
- Context extraction (surrounding text)
- Send findings to backend via MCP

### 4. Evidence Collection (Forensics)
- Screenshot capture with provenance
- HTML/MHTML page archiving
- Network traffic recording
- Chain of custody tracking
- Evidence session management (multi-page)
- Annotation tools (highlight, redact, note)

### 5. Format Validation (Client-Side Only)
- Is this email-shaped? (regex pattern match)
- Is this phone number formatted correctly? (E.164 check)
- Is this a valid Bitcoin address format? (checksum validation)
- **NO external API calls** - just format checks

### 6. Data Transmission
- Send detected data to palletAI/basset-hound
- WebSocket communication
- MCP protocol tools for AI agents
- Batch data transmission
- Offline queue for failed sends

### 7. User Interface
- Popup for connection status
- DevTools panel for monitoring
- Ingest panel for data collection
- Session management UI

---

## Out of Scope ❌

### 1. OSINT Analysis
- **Blockchain verification** - Looking up addresses on blockchain explorers ❌
- **Email verification** - DNS lookups, MX records, SMTP probes ❌
- **Phone carrier lookup** - Numverify API, line type detection ❌
- **Domain analysis** - WHOIS, DNS records, age checks ❌
- **Breach checking** - HaveIBeenPwned lookups ❌
- **Social media profile verification** - Checking if accounts exist ❌

**Why?** These require external API calls, rate limiting, API keys, and analysis logic that belongs in basset-hound.

### 2. Data Storage & Analysis
- Entity graph storage ❌
- Relationship analysis ❌
- Cross-investigation correlation ❌
- Long-term data persistence ❌

**Why?** basset-hound handles entity storage and graph analysis.

### 3. Investigation Logic
- Case management ❌
- Team collaboration ❌
- Report generation ❌
- Evidence chain management (beyond capture) ❌

**Why?** palletAI orchestrates investigations, basset-hound stores case data.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Web Page                             │
│  (LinkedIn profile, social media, search results, etc.)      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│           autofill-extension (THIS PROJECT)                  │
│                                                              │
│  ✅ Navigate, click, fill, extract                          │
│  ✅ Detect patterns: "Found email: john@example.com"        │
│  ✅ Capture evidence: Screenshot + provenance                │
│  ✅ Monitor network: HAR export                              │
│  ✅ Format validate: "Email is well-formed"                  │
│  ✅ Send via MCP: { type: "email", value: "...", ... }      │
│                                                              │
│  ❌ NO blockchain lookups                                    │
│  ❌ NO DNS/WHOIS queries                                     │
│  ❌ NO breach checking                                       │
│  ❌ NO external OSINT APIs                                   │
└─────────────────────────────────────────────────────────────┘
                              ↓ WebSocket/MCP
┌─────────────────────────────────────────────────────────────┐
│                      palletAI                                │
│  (AI agent orchestration, investigation logic)               │
└─────────────────────────────────────────────────────────────┘
                              ↓ REST API
┌─────────────────────────────────────────────────────────────┐
│                    basset-hound                              │
│  (Entity storage, graph analysis, OSINT tool integration)    │
│                                                              │
│  ✅ Blockchain verification (Mempool.space, Etherscan)       │
│  ✅ Email verification (DNS, MX, deliverability)             │
│  ✅ Phone carrier lookup (Numverify, Twilio)                 │
│  ✅ Domain analysis (WHOIS, DNS, Wayback)                    │
│  ✅ HIBP breach checking                                     │
│  ✅ Social media verification                                │
│  ✅ Entity relationships                                     │
│  ✅ Cross-investigation correlation                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Examples

### ✅ IN SCOPE: Pattern Detection + Format Validation

```javascript
// Detect email on page
const email = "john@example.com";

// Format validation (client-side, no API call)
const isWellFormed = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Send to backend
chrome.runtime.sendMessage({
  type: 'osint_data_detected',
  data: {
    type: 'email',
    value: email,
    wellFormed: isWellFormed,
    source_url: window.location.href,
    context: "Found on LinkedIn profile page"
  }
});
```

### ❌ OUT OF SCOPE: Domain Verification

```javascript
// This belongs in basset-hound, NOT here
const domain = email.split('@')[1];
const mxRecords = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`); ❌
const hasValidMX = mxRecords.Answer.length > 0; ❌
```

### ✅ IN SCOPE: Network Forensics

```javascript
// Capture network traffic for forensic analysis
const harExport = await networkMonitor.exportHAR();

// Send to backend for storage
chrome.runtime.sendMessage({
  type: 'evidence_network_traffic',
  data: harExport
});
```

---

## Decision Framework

**Question:** Should feature X be in autofill-extension?

### Ask:
1. **Does it require browser DOM access?** → ✅ Yes, extension
2. **Does it make external API calls for analysis?** → ❌ No, backend
3. **Does it store/analyze data long-term?** → ❌ No, backend
4. **Does it help extract data FROM pages?** → ✅ Yes, extension
5. **Does it help present data TO AI agents?** → ✅ Yes, extension (MCP)

---

## Current Feature Audit

### Phase 8-10: OSINT Data Ingestion ✅ IN SCOPE
- ✅ Detect patterns on pages (email, phone, crypto)
- ✅ Visual highlighting
- ✅ Ingest panel UI
- ✅ Send to basset-hound

### Phase 11: Evidence Collection ✅ IN SCOPE
- ✅ Screenshot capture
- ✅ Annotation tools
- ✅ Chain of custody
- ✅ Evidence sessions (Phase 14)

### Phase 12: AI Agent Enhancements ⚠️ PARTIALLY OUT OF SCOPE
- ✅ Investigation context tracking
- ✅ Smart form filling
- ✅ MCP commands

### **Phase 13: Data Verification** ❌ **OUT OF SCOPE**
- ❌ Blockchain verification (Mempool.space API calls)
- ❌ Email domain verification (DNS lookups)
- ❌ Phone carrier lookup (Numverify API)
- **Status:** Move to basset-hound

---

## Recommended Actions

### 1. Keep (IN SCOPE)
- All browser automation (Phases 1-4)
- Network monitoring (Phase 2)
- OSINT pattern detection (Phase 8)
- Evidence capture (Phase 11)
- Evidence sessions (Phase 14)
- Form filling (Phase 12)

### 2. Remove from Extension (OUT OF SCOPE)
- **Phase 13 verification modules:**
  - `utils/verification/blockchain-verifier.js` → Move to basset-hound
  - `utils/verification/email-domain-verifier.js` → Move to basset-hound
  - `utils/verification/phone-verifier.js` → Move to basset-hound

### 3. Simplify (KEEP FORMAT CHECKS ONLY)
- Keep basic format validation in `utils/data-pipeline/verifier.js`
- Remove external API calls
- Focus on "is this well-formed?" not "does this exist?"

---

## Summary

**autofill-extension = Browser Automation API**
- Controls browser
- Extracts content
- Detects patterns
- Captures evidence
- Sends data via MCP

**basset-hound = OSINT Analysis Backend**
- Verifies data via external APIs
- Stores entities
- Analyzes relationships
- Performs deep OSINT

**Clean separation = Better architecture**

---

*Last Updated: January 9, 2026*
