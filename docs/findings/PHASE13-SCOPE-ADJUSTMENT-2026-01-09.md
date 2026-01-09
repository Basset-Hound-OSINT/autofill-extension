# Phase 13 Scope Adjustment - Moving Verification to Backend

> **Date:** January 9, 2026
> **Issue:** Phase 13 verification modules perform OSINT analysis, which is out of scope
> **Resolution:** Move verification logic to basset-hound backend

---

## Problem

Phase 13 implemented data verification modules that make external API calls for analysis:
- `utils/verification/blockchain-verifier.js` (~1,645 lines)
- `utils/verification/email-domain-verifier.js` (~2,141 lines)
- `utils/verification/phone-verifier.js` (~1,355 lines)

**Total:** ~5,141 lines performing OSINT analysis in the browser extension.

### Why This Is Out of Scope

**autofill-extension** is a browser automation API, not an OSINT analysis toolkit:
- ❌ Makes external API calls (Mempool.space, Etherscan, Google DNS, Numverify)
- ❌ Performs data analysis (blockchain lookups, DNS queries, carrier detection)
- ❌ Requires API keys and rate limiting
- ❌ Duplicates functionality that belongs in basset-hound

---

## Correct Architecture

```
┌───────────────────────────────────────────────────────────┐
│                    Web Page                                │
└───────────────────────────────────────────────────────────┘
                        ↓
┌───────────────────────────────────────────────────────────┐
│              autofill-extension                            │
│  ✅ Detect: "found crypto address: 1A1z..."               │
│  ✅ Format check: "valid Bitcoin format"                  │
│  ✅ Send via MCP: { type: "crypto", value: "..." }        │
│  ❌ NO blockchain API lookups                             │
└───────────────────────────────────────────────────────────┘
                        ↓ WebSocket/MCP
┌───────────────────────────────────────────────────────────┐
│                    palletAI                                │
│  (orchestration)                                           │
└───────────────────────────────────────────────────────────┘
                        ↓ REST API
┌───────────────────────────────────────────────────────────┐
│                 basset-hound                               │
│  ✅ Blockchain verification (Mempool.space, Etherscan)    │
│  ✅ Email verification (DNS, MX, deliverability)          │
│  ✅ Phone carrier lookup (Numverify)                      │
└───────────────────────────────────────────────────────────┘
```

---

## Resolution

### 1. Keep in autofill-extension ✅

**File:** `utils/data-pipeline/verifier.js` (~812 lines)

**Purpose:** Client-side format validation only

**Keep these functions:**
- `isEmailWellFormed(email)` - Regex pattern check
- `isPhoneNumberWellFormed(phone)` - E.164 format check
- `isBitcoinAddressWellFormed(address)` - Checksum validation
- `isEthereumAddressWellFormed(address)` - EIP-55 checksum
- `isIPv4WellFormed(ip)` - Format validation
- `isDomainWellFormed(domain)` - Pattern check

**Remove:** All external API calls, leave only format validation.

### 2. Move to basset-hound ❌

**Move these files to basset-hound backend:**

#### `blockchain-verifier.js` (~1,645 lines)
- Mempool.space API for Bitcoin
- Etherscan API for Ethereum
- BlockCypher API for Litecoin
- Balance and transaction lookups
- → Becomes `basset-hound/src/verification/blockchain.py`

#### `email-domain-verifier.js` (~2,141 lines)
- DNS over HTTPS (Google DNS)
- MX/SPF/DMARC record checking
- Disposable email detection
- Typo correction
- → Becomes `basset-hound/src/verification/email.py`

#### `phone-verifier.js` (~1,355 lines)
- Numverify API integration
- Carrier lookup
- Line type detection (mobile/landline)
- → Becomes `basset-hound/src/verification/phone.py`

### 3. Update MCP Commands

**Remove from autofill-extension MCP:**
- `verify_blockchain_address`
- `verify_email_domain`
- `verify_phone_number`

**Add to basset-hound API:**
- `POST /api/v1/verification/blockchain`
- `POST /api/v1/verification/email`
- `POST /api/v1/verification/phone`

---

## Migration Steps

### Step 1: Identify Dependencies

Check what code depends on Phase 13 verifiers:

```bash
grep -r "blockchain-verifier\|email-domain-verifier\|phone-verifier" utils/ background.js content.js
```

### Step 2: Update verifier.js

Keep only format validation, remove API calls:

```javascript
// ✅ KEEP - Format validation
function isEmailWellFormed(email) {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
}

// ❌ REMOVE - External API call
async function verifyEmailDomain(email) {
  const domain = email.split('@')[1];
  const response = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
  // ...
}
```

### Step 3: Port to basset-hound

Create Python equivalents in basset-hound:

```python
# basset-hound/src/verification/blockchain.py
class BlockchainVerifier:
    async def verify_bitcoin_address(self, address: str):
        # Use Mempool.space API
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://mempool.space/api/address/{address}"
            )
            return response.json()
```

### Step 4: Update basset-hound API

Add verification endpoints:

```python
# basset-hound/src/api/routes/verification.py
@router.post("/verification/blockchain")
async def verify_blockchain(data: BlockchainVerifyRequest):
    verifier = BlockchainVerifier()
    result = await verifier.verify_address(data.address, data.chain)
    return result
```

### Step 5: Update Extension

Remove verification modules, keep detection:

```javascript
// ✅ KEEP - Detect crypto addresses on page
const address = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";

// ✅ KEEP - Format validation
const isWellFormed = isBitcoinAddressWellFormed(address);

// ✅ KEEP - Send to backend
chrome.runtime.sendMessage({
  type: 'osint_data_detected',
  data: {
    type: 'crypto_address',
    value: address,
    wellFormed: isWellFormed,
    chain: 'bitcoin'
  }
});

// ❌ REMOVE - Blockchain API lookup
// const verified = await BlockchainVerifier.verifyBitcoin(address);
```

### Step 6: Update Tests

Move verification tests to basset-hound:
- `tests/unit/phase13-verification.test.js` → `basset-hound/tests/test_verification.py`

---

## Impact Analysis

### Files to Remove
- ❌ `utils/verification/blockchain-verifier.js` (~1,645 lines)
- ❌ `utils/verification/email-domain-verifier.js` (~2,141 lines)
- ❌ `utils/verification/phone-verifier.js` (~1,355 lines)
- **Total:** ~5,141 lines removed

### Files to Update
- ✅ `utils/data-pipeline/verifier.js` - Simplify to format checks only
- ✅ `background.js` - Remove verification command handlers
- ✅ `docs/ROADMAP-ARCHIVE-V1.md` - Note Phase 13 moved to backend
- ✅ `tests/unit/phase11-13-features.test.js` - Remove verification tests

### Files to Create in basset-hound
- ✅ `basset-hound/src/verification/blockchain.py`
- ✅ `basset-hound/src/verification/email.py`
- ✅ `basset-hound/src/verification/phone.py`
- ✅ `basset-hound/src/api/routes/verification.py`
- ✅ `basset-hound/tests/test_verification.py`

---

## Benefits of This Change

### 1. Cleaner Architecture
- Extension focuses on browser automation
- Backend handles OSINT analysis
- Clear separation of concerns

### 2. Better Performance
- No external API calls from browser
- Rate limiting handled on backend
- API keys managed centrally

### 3. Easier Maintenance
- Verification logic in one place (basset-hound)
- Can update verification methods without extension updates
- Backend can cache results efficiently

### 4. More Scalable
- Backend can handle concurrent verification requests
- Can add new verification methods without touching extension
- Easier to add new data sources

---

## Timeline

### Immediate (Today)
- ✅ Document scope boundaries (this file)
- ✅ Update PROJECT-SCOPE.md
- ✅ Update ROADMAP.md with scope note

### Short Term (Next Session)
- Update `verifier.js` to remove API calls
- Remove Phase 13 verification modules
- Update tests
- Update documentation

### Medium Term (Coordinate with basset-hound)
- Port verification logic to basset-hound backend
- Add API endpoints
- Update palletAI to use backend verification
- Integration testing

---

## Example: Before and After

### Before (Out of Scope) ❌

```javascript
// In autofill-extension
const email = "john@example.com";
const verifier = new EmailDomainVerifier();
const result = await verifier.verify(email);
// Makes DNS lookup to Google DNS
// Checks MX records
// Checks disposable email database
// Returns full verification result
```

### After (In Scope) ✅

```javascript
// In autofill-extension
const email = "john@example.com";
const isWellFormed = isEmailWellFormed(email);
chrome.runtime.sendMessage({
  type: 'osint_data_detected',
  data: { type: 'email', value: email, wellFormed: isWellFormed }
});
```

```python
# In basset-hound backend
@router.post("/verification/email")
async def verify_email(email: str):
    verifier = EmailVerifier()

    # DNS lookup
    mx_records = await verifier.check_mx_records(email)

    # Disposable check
    is_disposable = await verifier.check_disposable(email)

    # Deliverability
    is_deliverable = await verifier.check_smtp(email)

    return {
        "email": email,
        "mx_valid": mx_records is not None,
        "is_disposable": is_disposable,
        "is_deliverable": is_deliverable
    }
```

---

## Conclusion

Phase 13 verification modules were implemented with OSINT analysis functionality that belongs in basset-hound backend. By moving this logic to the backend, we:

1. ✅ Keep extension focused on browser automation
2. ✅ Improve architecture and separation of concerns
3. ✅ Enable better scaling and maintenance
4. ✅ Align with project scope boundaries

The extension remains a powerful browser automation API that detects data patterns and sends findings to the backend for analysis.

---

*Last Updated: January 9, 2026*
*Status: Scope clarified, migration plan defined*
*Next: Update codebase to remove out-of-scope features*
