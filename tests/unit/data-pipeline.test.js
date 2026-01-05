/**
 * Unit Tests for Data Pipeline Modules
 * Phase 8: OSINT Data Ingestion Features
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock chrome API
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    lastError: null
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

// Mock window and document
const mockDocument = {
  title: 'Test Page',
  body: {
    innerText: 'Sample page content with test@example.com and 555-123-4567'
  },
  documentElement: {
    lang: 'en'
  },
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(() => []),
  createElement: jest.fn(() => ({
    className: '',
    style: {},
    innerHTML: '',
    appendChild: jest.fn(),
    remove: jest.fn()
  })),
  head: {
    appendChild: jest.fn()
  },
  contentType: 'text/html',
  characterSet: 'UTF-8',
  lastModified: new Date().toISOString(),
  createTreeWalker: jest.fn()
};

const mockWindow = {
  location: {
    href: 'https://example.com/test',
    hostname: 'example.com',
    pathname: '/test',
    hash: '',
    search: ''
  },
  innerWidth: 1920,
  innerHeight: 1080,
  scrollX: 0,
  scrollY: 0,
  devicePixelRatio: 1,
  getComputedStyle: jest.fn(() => ({
    display: 'block',
    visibility: 'visible'
  })),
  getSelection: jest.fn(() => ({
    isCollapsed: true,
    toString: () => ''
  }))
};

global.document = mockDocument;
global.window = mockWindow;
global.navigator = {
  userAgent: 'Mozilla/5.0 Test'
};
global.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };
global.NodeFilter = { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_SKIP: 2 };
global.WebSocket = jest.fn();

// =============================================================================
// OSINTFieldDetector Tests
// =============================================================================

describe('OSINTFieldDetector', () => {
  let OSINTFieldDetector, OSINTPatterns, IdentifierTypeMapping;

  beforeEach(() => {
    // Load the module
    jest.resetModules();
    const fieldDetector = require('../../utils/data-pipeline/field-detector.js');
    OSINTFieldDetector = fieldDetector.OSINTFieldDetector;
    OSINTPatterns = fieldDetector.OSINTPatterns;
    IdentifierTypeMapping = fieldDetector.IdentifierTypeMapping;
  });

  describe('Pattern Detection', () => {
    it('should detect email addresses', () => {
      const detector = new OSINTFieldDetector();
      const text = 'Contact us at test@example.com or support@company.org';
      const findings = detector.detectAll(text);

      const emails = findings.filter(f => f.type === 'email');
      expect(emails.length).toBe(2);
      expect(emails[0].value).toBe('test@example.com');
      expect(emails[1].value).toBe('support@company.org');
    });

    it('should detect US phone numbers', () => {
      const detector = new OSINTFieldDetector();
      const text = 'Call us at (555) 123-4567 or 1-800-555-0123';
      const findings = detector.detectAll(text);

      const phones = findings.filter(f => f.type === 'phone');
      expect(phones.length).toBeGreaterThan(0);
    });

    it('should detect international phone numbers', () => {
      const detector = new OSINTFieldDetector();
      const text = 'International: +44 20 7946 0958 or +1-555-123-4567';
      const findings = detector.detectAll(text);

      const phones = findings.filter(f => f.type === 'phone_intl' || f.type === 'phone');
      expect(phones.length).toBeGreaterThan(0);
    });

    it('should detect Bitcoin addresses', () => {
      const detector = new OSINTFieldDetector();
      const text = 'Send BTC to 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa or bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
      const findings = detector.detectAll(text);

      const btc = findings.filter(f => f.type === 'crypto_btc');
      expect(btc.length).toBeGreaterThan(0);
      expect(btc[0].metadata.subtype).toBe('Bitcoin');
    });

    it('should detect Ethereum addresses', () => {
      const detector = new OSINTFieldDetector();
      const text = 'ETH address: 0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
      const findings = detector.detectAll(text);

      const eth = findings.filter(f => f.type === 'crypto_eth');
      expect(eth.length).toBe(1);
      expect(eth[0].value).toBe('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
      expect(eth[0].metadata.subtype).toBe('Ethereum');
    });

    it('should detect IPv4 addresses', () => {
      const detector = new OSINTFieldDetector();
      const text = 'Server IP: 192.168.1.1 and 8.8.8.8';
      const findings = detector.detectAll(text);

      const ips = findings.filter(f => f.type === 'ip_v4');
      expect(ips.length).toBe(2);
    });

    it('should detect domain names', () => {
      const detector = new OSINTFieldDetector();
      const text = 'Visit https://example.com or www.test.org for more info';
      const findings = detector.detectAll(text);

      const domains = findings.filter(f => f.type === 'domain');
      expect(domains.length).toBeGreaterThan(0);
    });

    it('should detect Twitter usernames', () => {
      const detector = new OSINTFieldDetector();
      const text = 'Follow @example_user and @test123 on Twitter';
      const findings = detector.detectAll(text);

      const twitter = findings.filter(f => f.type === 'username_twitter');
      expect(twitter.length).toBeGreaterThan(0);
    });

    it('should detect MAC addresses', () => {
      const detector = new OSINTFieldDetector();
      const text = 'MAC: 00:1A:2B:3C:4D:5E and 00-1A-2B-3C-4D-5F';
      const findings = detector.detectAll(text);

      const macs = findings.filter(f => f.type === 'mac_address');
      expect(macs.length).toBe(2);
    });
  });

  describe('Identifier Type Mapping', () => {
    it('should map pattern types to identifier types', () => {
      expect(IdentifierTypeMapping.email).toBe('EMAIL');
      expect(IdentifierTypeMapping.phone).toBe('PHONE');
      expect(IdentifierTypeMapping.crypto_btc).toBe('CRYPTO_ADDRESS');
      expect(IdentifierTypeMapping.ip_v4).toBe('IP_ADDRESS');
      expect(IdentifierTypeMapping.domain).toBe('DOMAIN');
    });
  });

  describe('Configuration', () => {
    it('should respect enabled types filter', () => {
      const detector = new OSINTFieldDetector({
        enabledTypes: ['email']
      });
      const text = 'Email: test@example.com Phone: 555-123-4567';
      const findings = detector.detectAll(text);

      expect(findings.every(f => f.type === 'email')).toBe(true);
    });

    it('should exclude sensitive types when configured', () => {
      const detector = new OSINTFieldDetector({
        excludeSensitive: true
      });
      const text = 'SSN: 123-45-6789 Email: test@example.com';
      const findings = detector.detectAll(text);

      const sensitive = findings.filter(f => f.metadata?.sensitive);
      expect(sensitive.length).toBe(0);
    });
  });

  describe('Context Extraction', () => {
    it('should capture surrounding context', () => {
      const detector = new OSINTFieldDetector({
        contextLength: 20
      });
      const text = 'Please contact us at test@example.com for support';
      const findings = detector.detectAll(text);

      expect(findings[0].context).toBeDefined();
      expect(findings[0].context.length).toBeLessThanOrEqual(text.length);
    });
  });

  describe('Statistics', () => {
    it('should track detection statistics', () => {
      const detector = new OSINTFieldDetector();

      detector.detectAll('test@example.com');
      detector.detectAll('another@test.com');

      const stats = detector.getStats();
      expect(stats.totalScans).toBe(2);
      expect(stats.totalFindings).toBeGreaterThan(0);
    });

    it('should reset statistics', () => {
      const detector = new OSINTFieldDetector();

      detector.detectAll('test@example.com');
      detector.resetStats();

      const stats = detector.getStats();
      expect(stats.totalScans).toBe(0);
      expect(stats.totalFindings).toBe(0);
    });
  });

  describe('Custom Patterns', () => {
    it('should add custom patterns', () => {
      const detector = new OSINTFieldDetector();

      detector.addPattern('custom_id', {
        pattern: /CUST-\d{6}/g,
        confidence: 0.9,
        identifierType: 'CUSTOM'
      });

      const findings = detector.detectAll('Order ID: CUST-123456');
      const custom = findings.filter(f => f.type === 'custom_id');
      expect(custom.length).toBe(1);
    });

    it('should remove custom patterns', () => {
      const detector = new OSINTFieldDetector();

      detector.addPattern('custom_id', {
        pattern: /CUST-\d{6}/g,
        confidence: 0.9
      });
      detector.removePattern('custom_id');

      const findings = detector.detectAll('Order ID: CUST-123456');
      const custom = findings.filter(f => f.type === 'custom_id');
      expect(custom.length).toBe(0);
    });
  });
});

// =============================================================================
// DataVerifier Tests
// =============================================================================

describe('DataVerifier', () => {
  let DataVerifier;

  beforeEach(() => {
    jest.resetModules();
    const verifier = require('../../utils/data-pipeline/verifier.js');
    DataVerifier = verifier.DataVerifier;
  });

  describe('Email Verification', () => {
    it('should verify valid email addresses', async () => {
      const verifier = new DataVerifier();
      const result = await verifier.verifyEmail('test@example.com');

      expect(result.plausible).toBe(true);
      expect(result.checks.formatValid).toBe(true);
      expect(result.checks.domainValid).toBe(true);
    });

    it('should reject invalid email addresses', async () => {
      const verifier = new DataVerifier();
      const result = await verifier.verifyEmail('invalid-email');

      expect(result.plausible).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect disposable emails', async () => {
      const verifier = new DataVerifier();
      const result = await verifier.verifyEmail('test@tempmail.com');

      expect(result.checks.disposable).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should suggest corrections for typos', async () => {
      const verifier = new DataVerifier();
      const result = await verifier.verifyEmail('test@gmial.com');

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0].suggested).toBe('gmail.com');
    });
  });

  describe('Phone Verification', () => {
    it('should verify valid phone numbers', async () => {
      const verifier = new DataVerifier();
      const result = await verifier.verifyPhone('+1-555-123-4567');

      expect(result.plausible).toBe(true);
      expect(result.checks.validLength).toBe(true);
    });

    it('should reject too short phone numbers', async () => {
      const verifier = new DataVerifier();
      const result = await verifier.verifyPhone('12345');

      expect(result.plausible).toBe(false);
      expect(result.errors.some(e => e.code === 'TOO_SHORT')).toBe(true);
    });

    it('should detect country codes', async () => {
      const verifier = new DataVerifier();
      const result = await verifier.verifyPhone('+1-555-123-4567');

      expect(result.country).toBe('US');
    });

    it('should format phone numbers', async () => {
      const verifier = new DataVerifier();
      const result = await verifier.verifyPhone('5551234567');

      expect(result.formatted).toBeDefined();
    });
  });

  describe('Crypto Address Verification', () => {
    it('should verify Bitcoin addresses', async () => {
      const verifier = new DataVerifier();
      const result = await verifier.verifyCrypto('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');

      expect(result.plausible).toBe(true);
      expect(result.coin).toBe('Bitcoin');
    });

    it('should verify Ethereum addresses', async () => {
      const verifier = new DataVerifier();
      const result = await verifier.verifyCrypto('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');

      expect(result.plausible).toBe(true);
      expect(result.coin).toBe('Ethereum');
    });

    it('should include explorer URLs', async () => {
      const verifier = new DataVerifier();
      const result = await verifier.verifyCrypto('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');

      expect(result.explorer).toContain('etherscan');
    });

    it('should reject invalid addresses', async () => {
      const verifier = new DataVerifier();
      const result = await verifier.verifyCrypto('invalid-crypto-address');

      expect(result.plausible).toBe(false);
    });
  });

  describe('IP Address Verification', () => {
    it('should verify valid IPv4 addresses', async () => {
      const verifier = new DataVerifier();
      const result = await verifier.verifyIP('192.168.1.1');

      expect(result.plausible).toBe(true);
      expect(result.version).toBe(4);
    });

    it('should detect private IP addresses', async () => {
      const verifier = new DataVerifier();
      const result = await verifier.verifyIP('192.168.1.1');

      expect(result.checks.isPrivate).toBe(true);
    });

    it('should detect loopback addresses', async () => {
      const verifier = new DataVerifier();
      const result = await verifier.verifyIP('127.0.0.1');

      expect(result.checks.isLoopback).toBe(true);
    });

    it('should reject invalid IP addresses', async () => {
      const verifier = new DataVerifier();
      const result = await verifier.verifyIP('999.999.999.999');

      expect(result.plausible).toBe(false);
    });
  });

  describe('Domain Verification', () => {
    it('should verify valid domains', async () => {
      const verifier = new DataVerifier();
      const result = await verifier.verifyDomain('example.com');

      expect(result.plausible).toBe(true);
      expect(result.tld).toBe('com');
    });

    it('should normalize domains', async () => {
      const verifier = new DataVerifier();
      const result = await verifier.verifyDomain('https://www.EXAMPLE.com/path');

      expect(result.normalized).toBe('example.com');
    });
  });

  describe('URL Verification', () => {
    it('should verify valid URLs', async () => {
      const verifier = new DataVerifier();
      const result = await verifier.verifyURL('https://example.com/path');

      expect(result.plausible).toBe(true);
      expect(result.protocol).toBe('https:');
    });

    it('should reject invalid URLs', async () => {
      const verifier = new DataVerifier();
      const result = await verifier.verifyURL('not a url');

      expect(result.plausible).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should track verification statistics', async () => {
      const verifier = new DataVerifier();

      await verifier.verify('email', 'test@example.com');
      await verifier.verify('phone', '555-123-4567');

      const stats = verifier.getStats();
      expect(stats.totalVerifications).toBe(2);
    });
  });
});

// =============================================================================
// ProvenanceCapture Tests
// =============================================================================

describe('ProvenanceCapture', () => {
  let ProvenanceCapture, SourceType, CaptureMethod;

  beforeEach(() => {
    jest.resetModules();

    // Reset mock document
    mockDocument.querySelector = jest.fn((selector) => {
      if (selector === 'link[rel="canonical"]') {
        return { href: 'https://example.com/canonical' };
      }
      return null;
    });

    const provenance = require('../../utils/data-pipeline/provenance.js');
    ProvenanceCapture = provenance.ProvenanceCapture;
    SourceType = provenance.SourceType;
    CaptureMethod = provenance.CaptureMethod;
  });

  describe('Basic Capture', () => {
    it('should capture page provenance', () => {
      const capture = new ProvenanceCapture();
      const result = capture.capture();

      expect(result.source_url).toBe('https://example.com/test');
      expect(result.page_title).toBe('Test Page');
      expect(result.page_domain).toBe('example.com');
    });

    it('should include capture timestamp', () => {
      const capture = new ProvenanceCapture();
      const result = capture.capture();

      expect(result.source_date).toBeDefined();
      expect(result.capture_timestamp).toBeDefined();
    });

    it('should include capture method', () => {
      const capture = new ProvenanceCapture();
      const result = capture.capture({ captureMethod: CaptureMethod.ELEMENT_PICKER });

      expect(result.capture_method).toBe(CaptureMethod.ELEMENT_PICKER);
    });
  });

  describe('Source Type Detection', () => {
    it('should detect website source type', () => {
      const capture = new ProvenanceCapture();
      const result = capture.capture();

      expect(result.source_type).toBe(SourceType.WEBSITE);
    });

    it('should detect social media sources', () => {
      mockWindow.location.hostname = 'twitter.com';

      const capture = new ProvenanceCapture();
      const result = capture.capture();

      expect(result.source_type).toBe(SourceType.SOCIAL_MEDIA);

      // Reset
      mockWindow.location.hostname = 'example.com';
    });
  });

  describe('Metadata Extraction', () => {
    it('should capture canonical URL', () => {
      const capture = new ProvenanceCapture();
      const result = capture.capture();

      expect(result.meta.canonical_url).toBe('https://example.com/canonical');
    });

    it('should capture viewport info when configured', () => {
      const capture = new ProvenanceCapture({ captureViewport: true });
      const result = capture.capture();

      expect(result.viewport).toBeDefined();
      expect(result.viewport.width).toBe(1920);
      expect(result.viewport.height).toBe(1080);
    });

    it('should capture user agent when configured', () => {
      const capture = new ProvenanceCapture({ captureUserAgent: true });
      const result = capture.capture();

      expect(result.user_agent).toBe('Mozilla/5.0 Test');
    });
  });

  describe('Minimal Capture', () => {
    it('should capture minimal provenance', () => {
      const capture = new ProvenanceCapture();
      const result = capture.captureMinimal();

      expect(result.source_url).toBeDefined();
      expect(result.source_date).toBeDefined();
      expect(result.page_title).toBeDefined();
      expect(result.viewport).toBeUndefined();
    });
  });

  describe('Ingestion Format', () => {
    it('should generate basset-hound compatible format', () => {
      const capture = new ProvenanceCapture();
      const result = capture.getForIngestion({
        identifierType: 'EMAIL',
        identifierValue: 'test@example.com',
        confidence: 0.95
      });

      expect(result.source_type).toBeDefined();
      expect(result.source_url).toBeDefined();
      expect(result.metadata.identifier_type).toBe('EMAIL');
      expect(result.metadata.identifier_value).toBe('test@example.com');
      expect(result.metadata.confidence).toBe(0.95);
    });
  });

  describe('Statistics', () => {
    it('should track capture statistics', () => {
      const capture = new ProvenanceCapture();

      capture.capture();
      capture.capture();

      const stats = capture.getStats();
      expect(stats.totalCaptures).toBe(2);
    });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Data Pipeline Integration', () => {
  let OSINTFieldDetector, DataVerifier, ProvenanceCapture;

  beforeEach(() => {
    jest.resetModules();

    const fieldDetector = require('../../utils/data-pipeline/field-detector.js');
    const verifier = require('../../utils/data-pipeline/verifier.js');
    const provenance = require('../../utils/data-pipeline/provenance.js');

    OSINTFieldDetector = fieldDetector.OSINTFieldDetector;
    DataVerifier = verifier.DataVerifier;
    ProvenanceCapture = provenance.ProvenanceCapture;
  });

  it('should detect, verify, and capture provenance for email', async () => {
    // Step 1: Detect
    const detector = new OSINTFieldDetector();
    const findings = detector.detectAll('Contact: test@example.com');
    expect(findings.length).toBe(1);

    // Step 2: Verify
    const verifier = new DataVerifier();
    const verification = await verifier.verify('email', findings[0].value);
    expect(verification.plausible).toBe(true);

    // Step 3: Capture provenance
    const capture = new ProvenanceCapture();
    const prov = capture.getForIngestion({
      identifierType: findings[0].identifierType,
      identifierValue: findings[0].value,
      confidence: findings[0].confidence
    });

    expect(prov.metadata.identifier_type).toBe('EMAIL');
    expect(prov.metadata.identifier_value).toBe('test@example.com');
  });

  it('should process multiple findings in batch', async () => {
    const text = `
      Email: user@company.com
      Phone: +1-555-123-4567
      Bitcoin: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
      IP: 8.8.8.8
    `;

    const detector = new OSINTFieldDetector();
    const verifier = new DataVerifier();

    const findings = detector.detectAll(text);
    expect(findings.length).toBeGreaterThan(0);

    // Verify each finding
    const verifiedFindings = [];
    for (const finding of findings) {
      const result = await verifier.verify(finding.identifierType, finding.value);
      if (result.plausible) {
        verifiedFindings.push({
          ...finding,
          verification: result
        });
      }
    }

    expect(verifiedFindings.length).toBeGreaterThan(0);
  });
});
