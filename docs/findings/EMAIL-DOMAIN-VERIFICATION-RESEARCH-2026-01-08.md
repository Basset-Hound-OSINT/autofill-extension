# Email and Domain Verification Techniques for OSINT

**Research Date:** 2026-01-08
**Purpose:** Comprehensive analysis of email and domain verification APIs and techniques for Chrome MV3 extension integration

---

## Table of Contents

1. [DNS-Based Verification](#1-dns-based-verification)
2. [Email Verification Services](#2-email-verification-services)
3. [Domain Reputation APIs](#3-domain-reputation-apis)
4. [Browser-Compatible Approaches](#4-browser-compatible-approaches)
5. [Privacy Considerations](#5-privacy-considerations)
6. [Implementation Examples](#6-implementation-examples)

---

## 1. DNS-Based Verification

### 1.1 DNS over HTTPS (DoH) APIs

DNS over HTTPS allows browser-based DNS lookups without server-side proxies. These are CORS-friendly and work directly in Chrome extensions.

#### Google Public DNS API

**Endpoint:** `https://dns.google/resolve`

```javascript
// MX Record Lookup
async function lookupMXRecords(domain) {
  const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.Status === 0 && data.Answer) {
    return data.Answer.map(record => ({
      priority: parseInt(record.data.split(' ')[0]),
      exchange: record.data.split(' ')[1].replace(/\.$/, ''),
      ttl: record.TTL
    })).sort((a, b) => a.priority - b.priority);
  }

  return [];
}

// Check if domain can receive email
async function canReceiveEmail(domain) {
  const mxRecords = await lookupMXRecords(domain);
  return mxRecords.length > 0;
}
```

#### Cloudflare DNS API

**Endpoint:** `https://cloudflare-dns.com/dns-query`

```javascript
// Alternative DoH provider
async function cloudflareDoHLookup(domain, type = 'MX') {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/dns-json'
    }
  });

  return await response.json();
}
```

### 1.2 SPF, DKIM, DMARC Record Checking

These email authentication records are stored as TXT records in DNS.

```javascript
// SPF Record Lookup
async function lookupSPF(domain) {
  const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=TXT`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.Status === 0 && data.Answer) {
    const spfRecords = data.Answer
      .filter(record => record.data.includes('v=spf1'))
      .map(record => record.data.replace(/"/g, ''));

    return {
      exists: spfRecords.length > 0,
      records: spfRecords,
      analysis: analyzeSPF(spfRecords[0])
    };
  }

  return { exists: false, records: [], analysis: null };
}

// DMARC Record Lookup
async function lookupDMARC(domain) {
  const dmarcDomain = `_dmarc.${domain}`;
  const url = `https://dns.google/resolve?name=${encodeURIComponent(dmarcDomain)}&type=TXT`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.Status === 0 && data.Answer) {
    const dmarcRecords = data.Answer
      .filter(record => record.data.includes('v=DMARC1'))
      .map(record => record.data.replace(/"/g, ''));

    return {
      exists: dmarcRecords.length > 0,
      records: dmarcRecords,
      policy: parseDMARCPolicy(dmarcRecords[0])
    };
  }

  return { exists: false, records: [], policy: null };
}

// DKIM Record Lookup (requires knowing the selector)
async function lookupDKIM(domain, selector = 'default') {
  const dkimDomain = `${selector}._domainkey.${domain}`;
  const url = `https://dns.google/resolve?name=${encodeURIComponent(dkimDomain)}&type=TXT`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.Status === 0 && data.Answer) {
    return {
      exists: true,
      selector: selector,
      records: data.Answer.map(r => r.data.replace(/"/g, ''))
    };
  }

  return { exists: false, selector: selector, records: [] };
}

// Common DKIM selectors to try
const COMMON_DKIM_SELECTORS = [
  'default', 'google', 'selector1', 'selector2', 'k1', 's1', 's2',
  'mail', 'email', 'dkim', 'smtp', 'mx', 'key1', 'key2'
];

// Helper: Parse SPF Record
function analyzeSPF(spfRecord) {
  if (!spfRecord) return null;

  return {
    mechanisms: {
      include: (spfRecord.match(/include:([^\s]+)/g) || []).map(m => m.replace('include:', '')),
      ip4: (spfRecord.match(/ip4:([^\s]+)/g) || []).map(m => m.replace('ip4:', '')),
      ip6: (spfRecord.match(/ip6:([^\s]+)/g) || []).map(m => m.replace('ip6:', '')),
      a: spfRecord.includes(' a ') || spfRecord.includes(' a:'),
      mx: spfRecord.includes(' mx ') || spfRecord.includes(' mx:')
    },
    all: spfRecord.match(/[-~?+]all$/)?.[0] || null,
    strictness: spfRecord.includes('-all') ? 'strict' :
                spfRecord.includes('~all') ? 'soft' :
                spfRecord.includes('?all') ? 'neutral' : 'permissive'
  };
}

// Helper: Parse DMARC Policy
function parseDMARCPolicy(dmarcRecord) {
  if (!dmarcRecord) return null;

  const policy = {};
  const parts = dmarcRecord.split(';').map(p => p.trim());

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key && value) {
      policy[key.trim()] = value.trim();
    }
  }

  return {
    policy: policy.p || 'none',
    subdomainPolicy: policy.sp || policy.p || 'none',
    percentage: parseInt(policy.pct) || 100,
    reportUri: policy.rua || null,
    forensicUri: policy.ruf || null,
    alignment: {
      dkim: policy.adkim || 'r',
      spf: policy.aspf || 'r'
    }
  };
}
```

### 1.3 DNS Response Codes

| Status Code | Meaning |
|-------------|---------|
| 0 | NOERROR - Query successful |
| 2 | SERVFAIL - Server failure |
| 3 | NXDOMAIN - Domain does not exist |
| 5 | REFUSED - Query refused |

---

## 2. Email Verification Services

### 2.1 Hunter.io API (Already Integrated)

**Current Integration:** `/utils/osint-handlers/hunter.js`

**Endpoints:**
- Domain Search: `GET https://api.hunter.io/v2/domain-search`
- Email Finder: `GET https://api.hunter.io/v2/email-finder`
- Email Verifier: `GET https://api.hunter.io/v2/email-verifier`
- Email Count: `GET https://api.hunter.io/v2/email-count`

**Verification Checks Performed:**
1. Email format validation (regex)
2. Domain existence check
3. MX records verification
4. SMTP server connection
5. Mailbox existence check (when possible)
6. Catch-all detection
7. Disposable email detection

**Rate Limits:**
- Free: 25 requests/month
- Paid: Varies by plan (up to 50,000/month)

### 2.2 NeverBounce API

**Documentation:** https://developers.neverbounce.com/

**Single Email Verification:**
```javascript
async function verifyWithNeverBounce(email, apiKey) {
  const url = `https://api.neverbounce.com/v4/single/check`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      key: apiKey,
      email: email,
      address_info: 1,
      credits_info: 1
    })
  });

  const data = await response.json();

  return {
    success: data.status === 'success',
    result: data.result, // valid, invalid, disposable, catchall, unknown
    email: data.email,
    flags: data.flags || [],
    suggestedCorrection: data.suggested_correction,
    creditsInfo: data.credits_info
  };
}
```

**Result Codes:**
| Code | Result | Meaning |
|------|--------|---------|
| 0 | valid | Email exists and is deliverable |
| 1 | invalid | Email does not exist |
| 2 | disposable | Temporary/throwaway email |
| 3 | catchall | Domain accepts all emails |
| 4 | unknown | Could not be verified |

**Rate Limits:**
- No explicit limit on API calls
- Credits consumed per verification (varies by plan)

### 2.3 ZeroBounce API

**Documentation:** https://www.zerobounce.net/docs/email-validation-api-quickstart

**Endpoints:**
- Default: `https://api.zerobounce.net/v2/validate`
- US Region: `https://api-us.zerobounce.net/v2/validate`
- EU Region: `https://api-eu.zerobounce.net/v2/validate`

```javascript
async function verifyWithZeroBounce(email, apiKey, options = {}) {
  const params = new URLSearchParams({
    api_key: apiKey,
    email: email,
    ip_address: options.ipAddress || '',
    timeout: options.timeout || 30 // 3-60 seconds
  });

  const response = await fetch(`https://api.zerobounce.net/v2/validate?${params}`);
  const data = await response.json();

  return {
    success: !data.error,
    email: data.address,
    status: data.status, // valid, invalid, catch-all, unknown, spamtrap, abuse, do_not_mail
    subStatus: data.sub_status,
    domain: data.domain,
    account: data.account,
    freeEmail: data.free_email,
    mxFound: data.mx_found,
    mxRecord: data.mx_record,
    smtpProvider: data.smtp_provider,
    firstName: data.firstname,
    lastName: data.lastname,
    gender: data.gender,
    createdAt: data.processed_at
  };
}
```

**Status Values:**
| Status | Description |
|--------|-------------|
| valid | Deliverable email |
| invalid | Undeliverable email |
| catch-all | Server accepts all |
| unknown | Temporary issue |
| spamtrap | Known spam trap |
| abuse | Known complainer |
| do_not_mail | Role-based or invalid |

**Sub-Status Values:** `alternate`, `antispam_system`, `greylisted`, `mail_server_temporary_error`, `forcible_disconnect`, `mail_server_did_not_respond`, `timeout_exceeded`, `failed_smtp_connection`, `mailbox_quota_exceeded`, `exception_occurred`, `possible_typo`, `no_dns_entries`, `role_based`, `leading_period_removed`, `disposable`, `toxic`

**Rate Limits:**
- 80,000 requests per 10 seconds maximum
- Exceeding triggers 1-minute block
- Response time: 1-30 seconds average

### 2.4 Verification Methods Comparison

| Feature | Hunter.io | NeverBounce | ZeroBounce |
|---------|-----------|-------------|------------|
| Format check | Yes | Yes | Yes |
| MX lookup | Yes | Yes | Yes |
| SMTP check | Yes | Yes | Yes |
| Disposable detection | Yes | Yes | Yes |
| Catch-all detection | Yes | Yes | Yes |
| Typo correction | No | Yes | Yes |
| Spam trap detection | No | No | Yes |
| Activity scoring | No | No | Optional |
| Free tier | 25/month | Trial | Trial |
| Response time | 1-5s | 1-3s | 1-30s |

---

## 3. Domain Reputation APIs

### 3.1 Google Safe Browsing API

**Documentation:** https://developers.google.com/safe-browsing/v4/lookup-api

**Endpoint:** `POST https://safebrowsing.googleapis.com/v4/threatMatches:find?key=API_KEY`

**Usage Restrictions:** Non-commercial use only. For commercial use, see Web Risk API.

```javascript
async function checkSafeBrowsing(urls, apiKey) {
  const endpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`;

  const body = {
    client: {
      clientId: 'basset-hound-osint',
      clientVersion: '1.0.0'
    },
    threatInfo: {
      threatTypes: [
        'MALWARE',
        'SOCIAL_ENGINEERING',
        'UNWANTED_SOFTWARE',
        'POTENTIALLY_HARMFUL_APPLICATION'
      ],
      platformTypes: ['ANY_PLATFORM'],
      threatEntryTypes: ['URL'],
      threatEntries: urls.map(url => ({ url }))
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  // Empty object = no threats found
  if (!data.matches || data.matches.length === 0) {
    return {
      safe: true,
      threats: []
    };
  }

  return {
    safe: false,
    threats: data.matches.map(match => ({
      url: match.threat.url,
      threatType: match.threatType,
      platformType: match.platformType,
      cacheDuration: match.cacheDuration
    }))
  };
}
```

**Threat Types:**
- `MALWARE` - Malicious software
- `SOCIAL_ENGINEERING` - Phishing/deceptive sites
- `UNWANTED_SOFTWARE` - Unwanted software distribution
- `POTENTIALLY_HARMFUL_APPLICATION` - PHA distribution

**Rate Limits:**
- 10,000 requests per day (free tier)
- Up to 500 URLs per request

### 3.2 VirusTotal API

**Documentation:** https://docs.virustotal.com/reference/domain-info

**Endpoint:** `GET https://www.virustotal.com/api/v3/domains/{domain}`

```javascript
async function checkVirusTotal(domain, apiKey) {
  const url = `https://www.virustotal.com/api/v3/domains/${encodeURIComponent(domain)}`;

  const response = await fetch(url, {
    headers: {
      'x-apikey': apiKey
    }
  });

  if (response.status === 404) {
    return { found: false, domain };
  }

  const data = await response.json();
  const attributes = data.data?.attributes || {};

  return {
    found: true,
    domain: domain,
    reputation: attributes.reputation,
    lastAnalysisStats: attributes.last_analysis_stats,
    categories: attributes.categories,
    creationDate: attributes.creation_date,
    lastModificationDate: attributes.last_modification_date,
    lastDnsRecords: attributes.last_dns_records,
    whois: attributes.whois,
    registrar: attributes.registrar,
    totalVotes: attributes.total_votes,
    tags: attributes.tags || [],
    lastAnalysisResults: Object.entries(attributes.last_analysis_results || {})
      .filter(([_, result]) => result.category === 'malicious')
      .map(([engine, result]) => ({
        engine,
        result: result.result,
        category: result.category
      }))
  };
}
```

**Rate Limits (Free API):**
- 4 requests per minute
- 500 requests per day
- 15,500 requests per month

### 3.3 Domain Age / WHOIS APIs

#### IP2WHOIS API

**Documentation:** https://www.ip2whois.com/developers-api

**Endpoint:** `GET https://api.ip2whois.com/v2`

```javascript
async function getDomainAge(domain, apiKey) {
  const params = new URLSearchParams({
    key: apiKey,
    domain: domain,
    format: 'json'
  });

  const response = await fetch(`https://api.ip2whois.com/v2?${params}`);
  const data = await response.json();

  if (data.error) {
    return { success: false, error: data.error.error_message };
  }

  return {
    success: true,
    domain: data.domain,
    domainId: data.domain_id,
    status: data.status,
    createDate: data.create_date,
    updateDate: data.update_date,
    expireDate: data.expire_date,
    domainAge: data.domain_age, // Age in days
    whoisServer: data.whois_server,
    registrar: {
      name: data.registrar?.name,
      url: data.registrar?.url,
      ianaId: data.registrar?.iana_id
    },
    registrant: {
      name: data.registrant?.name,
      organization: data.registrant?.organization,
      country: data.registrant?.country
    },
    nameservers: data.nameservers || [],
    isDomainOld: data.domain_age > 365 // More than 1 year old
  };
}
```

**Rate Limits:**
- Free: 500 queries per month
- Paid: Varies by plan

#### Domain Age Risk Assessment

```javascript
function assessDomainRisk(domainData) {
  const risks = [];
  const domainAgeInDays = domainData.domainAge || 0;

  // Age-based risk
  if (domainAgeInDays < 30) {
    risks.push({
      type: 'very_new_domain',
      severity: 'high',
      message: 'Domain is less than 30 days old'
    });
  } else if (domainAgeInDays < 90) {
    risks.push({
      type: 'new_domain',
      severity: 'medium',
      message: 'Domain is less than 90 days old'
    });
  } else if (domainAgeInDays < 365) {
    risks.push({
      type: 'recent_domain',
      severity: 'low',
      message: 'Domain is less than 1 year old'
    });
  }

  // Expiration risk
  if (domainData.expireDate) {
    const expireDate = new Date(domainData.expireDate);
    const daysUntilExpiry = (expireDate - new Date()) / (1000 * 60 * 60 * 24);

    if (daysUntilExpiry < 30) {
      risks.push({
        type: 'expiring_soon',
        severity: 'high',
        message: 'Domain expires within 30 days'
      });
    }
  }

  // Privacy protection (might indicate suspicious activity)
  if (domainData.registrant?.name?.toLowerCase().includes('privacy') ||
      domainData.registrant?.organization?.toLowerCase().includes('proxy')) {
    risks.push({
      type: 'privacy_protected',
      severity: 'info',
      message: 'Domain uses privacy protection service'
    });
  }

  return {
    riskScore: calculateRiskScore(risks),
    risks: risks,
    trustworthy: risks.filter(r => r.severity === 'high').length === 0
  };
}

function calculateRiskScore(risks) {
  const severityScores = { high: 30, medium: 15, low: 5, info: 0 };
  const totalPossible = 100;
  const riskPoints = risks.reduce((sum, r) => sum + severityScores[r.severity], 0);
  return Math.max(0, totalPossible - riskPoints);
}
```

---

## 4. Browser-Compatible Approaches

### 4.1 Chrome MV3 Extension Capabilities

**What Works in Chrome Extensions:**

1. **Service Worker Requests**
   - Can make requests to any domain with proper `host_permissions`
   - Not subject to CORS for origins in permissions
   - Must handle fetch errors gracefully (service worker may be terminated)

2. **DNS over HTTPS**
   - Google DNS and Cloudflare DNS are CORS-friendly
   - No special permissions needed for DoH lookups

3. **Content Script Limitations**
   - Subject to CORS restrictions
   - Must relay requests through service worker

**Manifest.json Configuration:**

```json
{
  "manifest_version": 3,
  "name": "Email Domain Verifier",
  "version": "1.0.0",
  "permissions": [
    "storage"
  ],
  "host_permissions": [
    "https://dns.google/*",
    "https://cloudflare-dns.com/*",
    "https://api.hunter.io/*",
    "https://api.neverbounce.com/*",
    "https://api.zerobounce.net/*",
    "https://api-us.zerobounce.net/*",
    "https://api-eu.zerobounce.net/*",
    "https://safebrowsing.googleapis.com/*",
    "https://www.virustotal.com/*",
    "https://api.ip2whois.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  }
}
```

### 4.2 CORS-Friendly APIs

| API | CORS Support | Auth Method |
|-----|--------------|-------------|
| Google DNS (DoH) | Yes (public) | None required |
| Cloudflare DNS (DoH) | Yes (public) | None required |
| Hunter.io | Yes | API key in URL |
| NeverBounce | Yes | API key in body |
| ZeroBounce | Yes | API key in URL |
| Google Safe Browsing | Yes | API key in URL |
| VirusTotal | Yes | API key in header |
| IP2WHOIS | Yes | API key in URL |

### 4.3 Rate Limits Summary

| Service | Free Tier | Notes |
|---------|-----------|-------|
| Google DNS | Unlimited | Public service |
| Cloudflare DNS | Unlimited | Public service |
| Hunter.io | 25/month | Per account |
| NeverBounce | Trial credits | Pay per verification |
| ZeroBounce | Trial credits | 80k/10s max |
| Safe Browsing | 10k/day | Non-commercial |
| VirusTotal | 4/min, 500/day | Premium available |
| IP2WHOIS | 500/month | Per account |

### 4.4 Service Worker Implementation Pattern

```javascript
// background.js - Service Worker

class EmailDomainVerifier {
  constructor() {
    this.apiKeys = {};
    this.cache = new Map();
    this.rateLimiters = new Map();
  }

  async initialize() {
    // Load API keys from storage
    const result = await chrome.storage.local.get(['apiKeys']);
    this.apiKeys = result.apiKeys || {};
  }

  async verifyEmail(email) {
    const cacheKey = `email:${email}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const domain = email.split('@')[1];

    // Run checks in parallel where possible
    const [
      dnsCheck,
      spfCheck,
      dmarcCheck,
      domainAge,
      reputation
    ] = await Promise.allSettled([
      this.checkDNS(domain),
      this.checkSPF(domain),
      this.checkDMARC(domain),
      this.checkDomainAge(domain),
      this.checkReputation(domain)
    ]);

    const result = {
      email,
      domain,
      checks: {
        dns: dnsCheck.status === 'fulfilled' ? dnsCheck.value : null,
        spf: spfCheck.status === 'fulfilled' ? spfCheck.value : null,
        dmarc: dmarcCheck.status === 'fulfilled' ? dmarcCheck.value : null,
        domainAge: domainAge.status === 'fulfilled' ? domainAge.value : null,
        reputation: reputation.status === 'fulfilled' ? reputation.value : null
      },
      timestamp: Date.now()
    };

    // Cache for 5 minutes
    this.cache.set(cacheKey, result);
    setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);

    return result;
  }

  async checkDNS(domain) {
    const mxRecords = await this.doHLookup(domain, 'MX');
    return {
      canReceiveEmail: mxRecords.length > 0,
      mxRecords
    };
  }

  async checkSPF(domain) {
    const txtRecords = await this.doHLookup(domain, 'TXT');
    const spfRecord = txtRecords.find(r => r.includes('v=spf1'));
    return {
      exists: !!spfRecord,
      record: spfRecord || null
    };
  }

  async checkDMARC(domain) {
    const dmarcDomain = `_dmarc.${domain}`;
    const txtRecords = await this.doHLookup(dmarcDomain, 'TXT');
    const dmarcRecord = txtRecords.find(r => r.includes('v=DMARC1'));
    return {
      exists: !!dmarcRecord,
      record: dmarcRecord || null
    };
  }

  async doHLookup(domain, type) {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.Status === 0 && data.Answer) {
      return data.Answer.map(r => r.data.replace(/"/g, ''));
    }
    return [];
  }

  async checkDomainAge(domain) {
    if (!this.apiKeys.ip2whois) return null;

    const params = new URLSearchParams({
      key: this.apiKeys.ip2whois,
      domain: domain,
      format: 'json'
    });

    const response = await fetch(`https://api.ip2whois.com/v2?${params}`);
    const data = await response.json();

    return {
      createDate: data.create_date,
      domainAge: data.domain_age,
      registrar: data.registrar?.name
    };
  }

  async checkReputation(domain) {
    const results = {};

    // VirusTotal check
    if (this.apiKeys.virustotal) {
      try {
        const vtResponse = await fetch(
          `https://www.virustotal.com/api/v3/domains/${domain}`,
          { headers: { 'x-apikey': this.apiKeys.virustotal } }
        );
        const vtData = await vtResponse.json();
        results.virustotal = {
          reputation: vtData.data?.attributes?.reputation,
          stats: vtData.data?.attributes?.last_analysis_stats
        };
      } catch (e) {
        results.virustotal = { error: e.message };
      }
    }

    return results;
  }
}

// Initialize and set up message listener
const verifier = new EmailDomainVerifier();
verifier.initialize();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'VERIFY_EMAIL') {
    verifier.verifyEmail(request.email)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // Keep channel open for async response
  }
});
```

---

## 5. Privacy Considerations

### 5.1 When is Verification Appropriate?

**Appropriate Use Cases:**

1. **User-Initiated Verification**
   - User explicitly requests email/domain check
   - Form submission validation (with disclosure)
   - Contact information verification

2. **Business Intelligence**
   - Verifying business partner domains
   - Due diligence on companies
   - Lead qualification (with consent)

3. **Security Assessment**
   - Checking links in suspicious emails
   - Validating sender authenticity
   - Phishing detection

**Inappropriate Use Cases:**

1. **Mass Surveillance**
   - Tracking individuals without consent
   - Building profiles without disclosure

2. **Unsolicited Contact Lists**
   - Scraping emails for spam
   - Building marketing lists without opt-in

3. **Personal Harassment**
   - Stalking or harassment activities
   - Doxxing attempts

### 5.2 Information Exposed During Verification

| Verification Method | Data Sent to Third Party |
|---------------------|--------------------------|
| DNS (DoH) | Domain name only |
| Hunter.io | Full email address |
| NeverBounce | Full email address |
| ZeroBounce | Full email address, IP (optional) |
| Safe Browsing | Full URL |
| VirusTotal | Domain name |
| IP2WHOIS | Domain name |

### 5.3 Data Handling Best Practices

```javascript
// Privacy-conscious verification implementation
class PrivacyAwareVerifier {
  constructor(options = {}) {
    this.options = {
      requireUserConsent: true,
      cacheResults: true,
      cacheDuration: 24 * 60 * 60 * 1000, // 24 hours
      logVerifications: false,
      ...options
    };
  }

  async verify(email, { userConsent = false } = {}) {
    // Check user consent requirement
    if (this.options.requireUserConsent && !userConsent) {
      return {
        error: 'USER_CONSENT_REQUIRED',
        message: 'User must consent to email verification'
      };
    }

    // Start with local-only checks
    const localChecks = this.performLocalChecks(email);

    // Only perform remote checks if necessary and consented
    if (localChecks.needsRemoteVerification && userConsent) {
      const remoteChecks = await this.performRemoteChecks(email);
      return { ...localChecks, ...remoteChecks };
    }

    return localChecks;
  }

  performLocalChecks(email) {
    return {
      formatValid: this.isValidFormat(email),
      disposable: this.isDisposable(email),
      commonDomain: this.isCommonProvider(email),
      needsRemoteVerification: true
    };
  }

  isValidFormat(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isDisposable(email) {
    const domain = email.split('@')[1]?.toLowerCase();
    return DISPOSABLE_DOMAINS.has(domain);
  }

  isCommonProvider(email) {
    const domain = email.split('@')[1]?.toLowerCase();
    const commonProviders = new Set([
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
      'icloud.com', 'aol.com', 'protonmail.com'
    ]);
    return commonProviders.has(domain);
  }
}
```

### 5.4 User Consent UI Example

```javascript
// Consent dialog for verification
function showVerificationConsent(email) {
  return new Promise((resolve) => {
    const dialog = document.createElement('div');
    dialog.className = 'verification-consent-dialog';
    dialog.innerHTML = `
      <div class="consent-content">
        <h3>Email Verification</h3>
        <p>To verify <strong>${email}</strong>, we need to:</p>
        <ul>
          <li>Check DNS records for the domain</li>
          <li>Verify MX (mail server) configuration</li>
          <li>Optionally, use third-party verification services</li>
        </ul>
        <p class="privacy-note">
          <strong>Privacy:</strong> The email address will be sent to verification
          services. No personal data will be stored beyond the verification result.
        </p>
        <div class="consent-actions">
          <button class="consent-deny">Cancel</button>
          <button class="consent-allow">Verify Email</button>
        </div>
      </div>
    `;

    dialog.querySelector('.consent-allow').onclick = () => {
      dialog.remove();
      resolve(true);
    };

    dialog.querySelector('.consent-deny').onclick = () => {
      dialog.remove();
      resolve(false);
    };

    document.body.appendChild(dialog);
  });
}
```

---

## 6. Implementation Examples

### 6.1 Complete Email Verification Flow

```javascript
/**
 * Comprehensive Email Verification Module
 * For use in Chrome MV3 Extension
 */
class ComprehensiveEmailVerifier {
  constructor(config = {}) {
    this.config = {
      hunterApiKey: config.hunterApiKey || null,
      zeroBounceApiKey: config.zeroBounceApiKey || null,
      virusTotalApiKey: config.virusTotalApiKey || null,
      ip2WhoisApiKey: config.ip2WhoisApiKey || null,
      safeBrowsingApiKey: config.safeBrowsingApiKey || null,
      useLocalChecksOnly: config.useLocalChecksOnly || false,
      ...config
    };

    this.cache = new Map();
  }

  /**
   * Full verification pipeline
   */
  async verify(email) {
    const startTime = Date.now();
    const domain = email.split('@')[1];

    // Phase 1: Local validation (instant)
    const localValidation = this.localValidation(email);
    if (!localValidation.valid) {
      return this.buildResult(email, 'invalid', {
        phase: 'local',
        ...localValidation
      });
    }

    // Phase 2: DNS checks (fast, no API key needed)
    const dnsResults = await this.dnsChecks(domain);

    // Phase 3: Domain intelligence (requires API keys)
    const domainIntel = await this.domainIntelligence(domain);

    // Phase 4: Email verification (requires API keys)
    const emailVerification = this.config.useLocalChecksOnly
      ? null
      : await this.emailVerification(email);

    // Combine all results
    return this.buildResult(email, this.determineStatus({
      localValidation,
      dnsResults,
      domainIntel,
      emailVerification
    }), {
      local: localValidation,
      dns: dnsResults,
      domainIntelligence: domainIntel,
      emailVerification,
      duration: Date.now() - startTime
    });
  }

  localValidation(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const domain = email.split('@')[1]?.toLowerCase();

    return {
      valid: emailRegex.test(email),
      format: emailRegex.test(email) ? 'valid' : 'invalid',
      disposable: this.isDisposable(domain),
      freemail: this.isFreemail(domain),
      roleBased: this.isRoleBased(email.split('@')[0])
    };
  }

  async dnsChecks(domain) {
    const [mx, spf, dmarc] = await Promise.allSettled([
      this.lookupMX(domain),
      this.lookupSPF(domain),
      this.lookupDMARC(domain)
    ]);

    return {
      mx: mx.status === 'fulfilled' ? mx.value : { error: mx.reason?.message },
      spf: spf.status === 'fulfilled' ? spf.value : { error: spf.reason?.message },
      dmarc: dmarc.status === 'fulfilled' ? dmarc.value : { error: dmarc.reason?.message }
    };
  }

  async domainIntelligence(domain) {
    const results = {};

    // Domain age
    if (this.config.ip2WhoisApiKey) {
      try {
        const params = new URLSearchParams({
          key: this.config.ip2WhoisApiKey,
          domain: domain,
          format: 'json'
        });
        const response = await fetch(`https://api.ip2whois.com/v2?${params}`);
        const data = await response.json();
        results.whois = {
          createDate: data.create_date,
          domainAge: data.domain_age,
          registrar: data.registrar?.name,
          expiryDate: data.expire_date
        };
      } catch (e) {
        results.whois = { error: e.message };
      }
    }

    // Reputation
    if (this.config.virusTotalApiKey) {
      try {
        const response = await fetch(
          `https://www.virustotal.com/api/v3/domains/${domain}`,
          { headers: { 'x-apikey': this.config.virusTotalApiKey } }
        );
        const data = await response.json();
        results.reputation = {
          score: data.data?.attributes?.reputation,
          stats: data.data?.attributes?.last_analysis_stats,
          categories: data.data?.attributes?.categories
        };
      } catch (e) {
        results.reputation = { error: e.message };
      }
    }

    // Safe Browsing
    if (this.config.safeBrowsingApiKey) {
      try {
        const url = `https://${domain}`;
        const response = await fetch(
          `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${this.config.safeBrowsingApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client: { clientId: 'basset-hound', clientVersion: '1.0' },
              threatInfo: {
                threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING'],
                platformTypes: ['ANY_PLATFORM'],
                threatEntryTypes: ['URL'],
                threatEntries: [{ url }]
              }
            })
          }
        );
        const data = await response.json();
        results.safeBrowsing = {
          safe: !data.matches || data.matches.length === 0,
          threats: data.matches || []
        };
      } catch (e) {
        results.safeBrowsing = { error: e.message };
      }
    }

    return results;
  }

  async emailVerification(email) {
    // Try Hunter.io first (if available)
    if (this.config.hunterApiKey) {
      try {
        const params = new URLSearchParams({
          email: email,
          api_key: this.config.hunterApiKey
        });
        const response = await fetch(`https://api.hunter.io/v2/email-verifier?${params}`);
        const data = await response.json();

        if (data.data) {
          return {
            service: 'hunter',
            status: data.data.status,
            score: data.data.score,
            checks: {
              regexp: data.data.regexp,
              gibberish: data.data.gibberish,
              disposable: data.data.disposable,
              webmail: data.data.webmail,
              mxRecords: data.data.mx_records,
              smtpServer: data.data.smtp_server,
              smtpCheck: data.data.smtp_check,
              acceptAll: data.data.accept_all
            }
          };
        }
      } catch (e) {
        // Fall through to try next service
      }
    }

    // Try ZeroBounce as fallback
    if (this.config.zeroBounceApiKey) {
      try {
        const params = new URLSearchParams({
          api_key: this.config.zeroBounceApiKey,
          email: email
        });
        const response = await fetch(`https://api.zerobounce.net/v2/validate?${params}`);
        const data = await response.json();

        return {
          service: 'zerobounce',
          status: data.status,
          subStatus: data.sub_status,
          freeEmail: data.free_email,
          mxFound: data.mx_found,
          mxRecord: data.mx_record
        };
      } catch (e) {
        return { error: e.message };
      }
    }

    return null;
  }

  async lookupMX(domain) {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.Status === 0 && data.Answer) {
      return {
        exists: true,
        records: data.Answer.map(r => ({
          priority: parseInt(r.data.split(' ')[0]),
          exchange: r.data.split(' ')[1]?.replace(/\.$/, '')
        })).sort((a, b) => a.priority - b.priority)
      };
    }

    return { exists: false, records: [] };
  }

  async lookupSPF(domain) {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=TXT`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.Status === 0 && data.Answer) {
      const spf = data.Answer.find(r => r.data.includes('v=spf1'));
      return {
        exists: !!spf,
        record: spf?.data?.replace(/"/g, '') || null
      };
    }

    return { exists: false, record: null };
  }

  async lookupDMARC(domain) {
    const url = `https://dns.google/resolve?name=_dmarc.${encodeURIComponent(domain)}&type=TXT`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.Status === 0 && data.Answer) {
      const dmarc = data.Answer.find(r => r.data.includes('v=DMARC1'));
      return {
        exists: !!dmarc,
        record: dmarc?.data?.replace(/"/g, '') || null
      };
    }

    return { exists: false, record: null };
  }

  isDisposable(domain) {
    const disposableDomains = new Set([
      'tempmail.com', '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
      'throwaway.email', 'yopmail.com', 'maildrop.cc', 'temp-mail.org'
    ]);
    return disposableDomains.has(domain);
  }

  isFreemail(domain) {
    const freemailDomains = new Set([
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
      'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com'
    ]);
    return freemailDomains.has(domain);
  }

  isRoleBased(localPart) {
    const roleAddresses = new Set([
      'admin', 'administrator', 'webmaster', 'postmaster', 'hostmaster',
      'info', 'support', 'sales', 'contact', 'help', 'abuse', 'noreply',
      'no-reply', 'billing', 'feedback', 'marketing', 'team', 'hello'
    ]);
    return roleAddresses.has(localPart.toLowerCase());
  }

  determineStatus(results) {
    // Invalid format
    if (!results.localValidation.valid) return 'invalid';

    // Disposable email
    if (results.localValidation.disposable) return 'disposable';

    // No MX records
    if (!results.dnsResults.mx?.exists) return 'no_mx';

    // Malicious domain
    if (results.domainIntel?.safeBrowsing?.safe === false) return 'malicious';

    // Poor reputation
    if (results.domainIntel?.reputation?.score < -5) return 'poor_reputation';

    // Email verification result
    if (results.emailVerification) {
      const status = results.emailVerification.status;
      if (status === 'valid') return 'valid';
      if (status === 'invalid') return 'invalid';
      if (status === 'catch-all' || status === 'accept_all') return 'risky';
    }

    // Default: plausible but unverified
    return 'plausible';
  }

  buildResult(email, status, details) {
    const domain = email.split('@')[1];

    return {
      email,
      domain,
      status,
      statusDescription: this.getStatusDescription(status),
      deliverable: ['valid', 'plausible'].includes(status),
      risky: ['risky', 'disposable', 'poor_reputation'].includes(status),
      details,
      timestamp: new Date().toISOString()
    };
  }

  getStatusDescription(status) {
    const descriptions = {
      valid: 'Email is valid and deliverable',
      invalid: 'Email is invalid or undeliverable',
      plausible: 'Email format is valid but not verified',
      disposable: 'Email is from a disposable provider',
      no_mx: 'Domain cannot receive email (no MX records)',
      risky: 'Email exists but delivery is uncertain',
      malicious: 'Domain is flagged as malicious',
      poor_reputation: 'Domain has poor reputation'
    };
    return descriptions[status] || 'Unknown status';
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ComprehensiveEmailVerifier };
}

if (typeof globalThis !== 'undefined') {
  globalThis.ComprehensiveEmailVerifier = ComprehensiveEmailVerifier;
}
```

### 6.2 Usage Example

```javascript
// Initialize verifier with API keys
const verifier = new ComprehensiveEmailVerifier({
  hunterApiKey: 'your-hunter-api-key',
  zeroBounceApiKey: 'your-zerobounce-api-key',
  virusTotalApiKey: 'your-virustotal-api-key',
  ip2WhoisApiKey: 'your-ip2whois-api-key',
  safeBrowsingApiKey: 'your-safebrowsing-api-key'
});

// Verify an email
const result = await verifier.verify('john.doe@example.com');

console.log(result);
// {
//   email: 'john.doe@example.com',
//   domain: 'example.com',
//   status: 'valid',
//   statusDescription: 'Email is valid and deliverable',
//   deliverable: true,
//   risky: false,
//   details: {
//     local: { valid: true, format: 'valid', disposable: false, ... },
//     dns: { mx: { exists: true, records: [...] }, spf: {...}, dmarc: {...} },
//     domainIntelligence: { whois: {...}, reputation: {...}, safeBrowsing: {...} },
//     emailVerification: { service: 'hunter', status: 'valid', score: 95, ... },
//     duration: 1234
//   },
//   timestamp: '2026-01-08T12:00:00.000Z'
// }
```

---

## References

- [Google DNS over HTTPS](https://developers.google.com/speed/public-dns/docs/doh)
- [Cloudflare DNS over HTTPS](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/)
- [Hunter.io API Documentation](https://hunter.io/api-documentation/v2)
- [NeverBounce API Documentation](https://developers.neverbounce.com/)
- [ZeroBounce API Documentation](https://www.zerobounce.net/docs/email-validation-api-quickstart)
- [Google Safe Browsing API](https://developers.google.com/safe-browsing/v4/lookup-api)
- [VirusTotal API Documentation](https://docs.virustotal.com/reference/overview)
- [IP2WHOIS API Documentation](https://www.ip2whois.com/developers-api)
- [Chrome Extension MV3 Network Requests](https://developer.chrome.com/docs/extensions/mv3/network-requests/)
