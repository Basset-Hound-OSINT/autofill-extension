# Integration Research Findings - Autofill Extension

**Date:** January 4, 2026
**Purpose:** Document integration strategies and enhancement requirements

---

## Overview

This document outlines research findings for enhancing the autofill-extension to integrate with the Basset Hound ecosystem for OSINT investigations.

---

## Current State Analysis

### Existing Capabilities (v2.15.0)

The autofill-extension is already a feature-rich browser automation tool with:

| Category | Features |
|----------|----------|
| **Data Pipeline** | Normalization, entity management, deduplication |
| **basset-hound Sync** | Entity sync with offline queue, conflict resolution |
| **Content Extraction** | Tables, links, images, structured data |
| **Form Automation** | Field detection, human-like typing, CAPTCHA detection |
| **OSINT Handlers** | HIBP, Shodan, Wayback, WHOIS, Hunter, Social Media |
| **MCP Server** | 76+ browser automation tools for AI agents |
| **DevTools Panel** | 6-tab professional UI |

### Key Files for Integration

```
utils/data-pipeline/
├── normalizer.js           # Data normalization (dates, names, addresses, phones, emails)
├── entity-manager.js       # Entity creation, relationships, export
├── basset-hound-sync.js    # Backend sync with offline queue
└── (new) provenance.js     # Data provenance tracking (TO BE CREATED)

utils/osint-handlers/
├── haveibeenpwned.js       # Email/password breach check
├── shodan.js               # IP/device search
├── wayback.js              # Historical snapshots
├── whois.js                # Domain/IP registration
├── hunter.js               # Email finder
├── social-media.js         # Profile lookup
└── (new) verifier.js       # Data verification (TO BE CREATED)
```

---

## Enhancement Requirements

### 1. Data Field Auto-Detection for Ingestion

**Current:** Form field detection exists for form filling
**Needed:** Detect data fields for OSINT ingestion

```javascript
// utils/data-pipeline/field-detector.js (TO BE CREATED)

const OSINT_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
  crypto_btc: /\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b/g,
  crypto_eth: /\b0x[a-fA-F0-9]{40}\b/g,
  ip_v4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  domain: /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/g,
  username: /@[a-zA-Z0-9_]{3,30}/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  cc_masked: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g
};

class OSINTFieldDetector {
  detectAll(text) {
    const findings = [];
    for (const [type, pattern] of Object.entries(OSINT_PATTERNS)) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        findings.push({
          type,
          value: match[0],
          position: match.index,
          context: text.slice(Math.max(0, match.index - 50), match.index + match[0].length + 50)
        });
      }
    }
    return findings;
  }

  highlightOnPage() {
    // Highlight detected fields with visual indicators
  }
}
```

### 2. "Ingest" Button Functionality

**Implementation:**

```javascript
// content.js additions

function createIngestButton(detectedData) {
  const button = document.createElement('button');
  button.id = 'basset-ingest-btn';
  button.innerHTML = `
    <img src="${chrome.runtime.getURL('icons/basset-16.png')}" />
    Ingest (${detectedData.length} items)
  `;
  button.onclick = () => showIngestPanel(detectedData);
  document.body.appendChild(button);
}

function showIngestPanel(detectedData) {
  // Modal showing detected data
  // Checkboxes to select what to ingest
  // Verification status for each item
  // "Ingest Selected" button
}

async function ingestSelectedData(selectedItems) {
  const provenance = {
    source_type: 'website',
    source_url: window.location.href,
    source_date: new Date().toISOString(),
    captured_by: 'autofill-extension'
  };

  for (const item of selectedItems) {
    // Verify first
    const verification = await verifyData(item.type, item.value);

    if (!verification.plausible && !item.forceIngest) {
      item.status = 'blocked';
      continue;
    }

    // Send to basset-hound
    await bassetHoundSync.createOrphan({
      identifier_type: mapToIdentifierType(item.type),
      identifier_value: item.value,
      metadata: {
        context: item.context,
        verification: verification
      },
      provenance
    });

    item.status = 'ingested';
  }
}
```

### 3. Data Verification Before Ingestion

**Client-side verification (in extension):**

```javascript
// utils/data-pipeline/verifier.js (TO BE CREATED)

import validator from 'validator';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import WAValidator from 'wallet-address-validator';

class DataVerifier {
  async verifyEmail(email) {
    return {
      plausible: validator.isEmail(email),
      format_valid: true,
      disposable: this.isDisposableEmail(email),
      // Note: MX check requires server-side
      needs_server_verification: true
    };
  }

  async verifyPhone(phone, countryHint = null) {
    try {
      const parsed = parsePhoneNumber(phone, countryHint);
      return {
        plausible: parsed.isPossible(),
        valid: parsed.isValid(),
        country: parsed.country,
        type: parsed.getType(),
        formatted: parsed.format('E.164')
      };
    } catch {
      return { plausible: false, valid: false };
    }
  }

  async verifyCrypto(address) {
    // Try multiple coin types
    const coins = ['BTC', 'ETH', 'LTC', 'XRP', 'DOGE'];
    for (const coin of coins) {
      if (WAValidator.validate(address, coin)) {
        return {
          plausible: true,
          coin,
          checksum_valid: true,
          // Note: Blockchain existence check requires server-side
          needs_server_verification: true
        };
      }
    }
    return { plausible: false };
  }

  isDisposableEmail(email) {
    const disposableDomains = [
      'tempmail.com', 'guerrillamail.com', '10minutemail.com',
      'mailinator.com', 'throwaway.email', 'temp-mail.org'
      // ... extend with full list
    ];
    const domain = email.split('@')[1]?.toLowerCase();
    return disposableDomains.some(d => domain?.endsWith(d));
  }
}
```

### 4. Manual Element Selection and Screenshot

**Element picker mode:**

```javascript
// content.js additions

class ElementPicker {
  constructor() {
    this.active = false;
    this.selectedElements = [];
  }

  enable() {
    this.active = true;
    document.body.style.cursor = 'crosshair';

    document.addEventListener('mouseover', this.highlightElement);
    document.addEventListener('click', this.selectElement);
    document.addEventListener('keydown', this.handleKeydown);
  }

  highlightElement = (e) => {
    if (!this.active) return;
    // Add highlight overlay
    const overlay = document.getElementById('basset-picker-overlay') ||
                    this.createOverlay();
    const rect = e.target.getBoundingClientRect();
    overlay.style.cssText = `
      position: fixed;
      top: ${rect.top}px;
      left: ${rect.left}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      background: rgba(0, 123, 255, 0.3);
      border: 2px solid #007bff;
      pointer-events: none;
      z-index: 999999;
    `;
  }

  selectElement = (e) => {
    if (!this.active) return;
    e.preventDefault();

    const element = e.target;
    this.selectedElements.push({
      tag: element.tagName,
      text: element.innerText,
      html: element.innerHTML,
      selector: this.generateSelector(element),
      rect: element.getBoundingClientRect()
    });

    // Visual feedback
    element.style.outline = '3px solid #28a745';
  }

  async captureScreenshot() {
    // Use chrome.tabs.captureVisibleTab
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'capture_screenshot' },
        (response) => resolve(response.dataUrl)
      );
    });
  }

  generateSelector(element) {
    // Generate unique CSS selector
    if (element.id) return `#${element.id}`;
    // ... fallback to path-based selector
  }
}
```

### 5. URL and Date Capture

**Automatic provenance capture:**

```javascript
// utils/data-pipeline/provenance.js (TO BE CREATED)

class ProvenanceCapture {
  capture() {
    return {
      source_type: 'website',
      source_url: window.location.href,
      source_date: new Date().toISOString(),
      captured_by: 'autofill-extension',
      page_title: document.title,
      page_domain: window.location.hostname,
      capture_timestamp: Date.now(),
      user_agent: navigator.userAgent,
      // Additional context
      meta: {
        canonical_url: this.getCanonicalUrl(),
        last_modified: this.getLastModified(),
        page_language: document.documentElement.lang
      }
    };
  }

  getCanonicalUrl() {
    const canonical = document.querySelector('link[rel="canonical"]');
    return canonical?.href || null;
  }

  getLastModified() {
    // Try to get page modification date
    const modified = document.querySelector('meta[property="article:modified_time"]');
    return modified?.content || null;
  }
}
```

---

## Integration with basset-hound

### Enhanced basset-hound-sync.js

```javascript
// utils/data-pipeline/basset-hound-sync.js enhancements

class BassetHoundSync {
  // ... existing code ...

  async createOrphanWithProvenance(data) {
    const payload = {
      identifier_type: data.identifier_type,
      identifier_value: data.identifier_value,
      metadata: data.metadata || {},
      provenance: data.provenance  // NEW: Include provenance
    };

    // Optionally verify before sending
    if (this.config.verifyBeforeSync) {
      const verification = await this.verifier.verify(
        data.identifier_type,
        data.identifier_value
      );

      if (!verification.plausible) {
        throw new Error(`Data not plausible: ${verification.reason}`);
      }

      payload.metadata.verification = verification;
    }

    return this.sendToBackend('POST', '/orphans', payload);
  }

  async createEntityWithSource(entityData, sourceUrl) {
    const provenance = {
      source_type: 'website',
      source_url: sourceUrl,
      source_date: new Date().toISOString(),
      captured_by: 'autofill-extension'
    };

    return this.sendToBackend('POST', '/entities', {
      ...entityData,
      provenance
    });
  }
}
```

---

## UI Enhancements

### DevTools Panel Additions

Add new tab: **"Ingest"**

```html
<!-- devtools-panel.html additions -->
<div id="tab-ingest" class="tab-content">
  <div class="section">
    <h3>Detected Data</h3>
    <div id="detected-data-list">
      <!-- Auto-populated with detected items -->
    </div>
  </div>

  <div class="section">
    <h3>Selected Elements</h3>
    <button id="enable-picker">Enable Element Picker</button>
    <div id="selected-elements-list"></div>
  </div>

  <div class="section">
    <h3>Verification Status</h3>
    <div id="verification-status"></div>
  </div>

  <div class="actions">
    <button id="verify-all">Verify All</button>
    <button id="ingest-selected" class="primary">Ingest Selected</button>
  </div>
</div>
```

### Popup UI Additions

```html
<!-- popup.html additions -->
<div class="quick-actions">
  <button id="quick-scan">Scan Page</button>
  <button id="quick-ingest">Quick Ingest</button>
  <button id="screenshot">Screenshot</button>
</div>

<div id="scan-results">
  <div class="result-count">
    <span id="email-count">0</span> emails,
    <span id="phone-count">0</span> phones,
    <span id="crypto-count">0</span> crypto
  </div>
</div>
```

---

## Dependencies to Add

```json
{
  "dependencies": {
    "libphonenumber-js": "^1.10.0",
    "wallet-address-validator": "^0.2.4",
    "validator": "^13.9.0"
  }
}
```

Note: For Chrome MV3 extensions, these need to be bundled (e.g., with webpack or rollup).

---

## New Files to Create

1. `utils/data-pipeline/field-detector.js` - OSINT field detection
2. `utils/data-pipeline/verifier.js` - Data verification
3. `utils/data-pipeline/provenance.js` - Provenance capture
4. `utils/ui/ingest-panel.js` - Ingest modal UI
5. `utils/ui/element-picker.js` - Element selection mode

---

## Integration Testing Checklist

- [ ] Field detection finds emails, phones, crypto on test pages
- [ ] Verification correctly validates/rejects test data
- [ ] Provenance captures full URL and timestamp
- [ ] basset-hound receives data with provenance
- [ ] Element picker captures selected elements
- [ ] Screenshot functionality works
- [ ] Offline queue handles disconnection
- [ ] MCP tools expose ingestion capabilities

---

## Security Considerations

1. **Data Privacy:** Selected data may contain PII - handle carefully
2. **Screenshot Consent:** Users should confirm before capturing
3. **Verification APIs:** Don't leak investigation targets
4. **Storage:** Sensitive data should be encrypted in offline queue

---

## Next Steps

See updated ROADMAP.md for implementation phases.
