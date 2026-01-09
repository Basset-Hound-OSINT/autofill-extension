/**
 * Unit Tests for Phase 15: DevTools Ingest Tab
 * Tests pattern detection and DevTools integration
 */

const { PatternDetector, OSINT_PATTERNS } = require('../../utils/osint/pattern-detector.js');
const { DataVerifier } = require('../../utils/data-pipeline/verifier.js');

describe('Phase 15: DevTools Ingest Tab', () => {

  // ==========================================================================
  // Pattern Detector Tests
  // ==========================================================================

  describe('PatternDetector', () => {
    let detector;
    let verifier;

    beforeEach(() => {
      verifier = new DataVerifier({ strictMode: false });
      detector = new PatternDetector({ verifier });
    });

    describe('Email Detection', () => {
      test('should detect email addresses', () => {
        const text = 'Contact us at support@example.com or sales@test.org';
        const detections = detector.detectAll(text);

        const emails = detections.filter(d => d.type === 'email');
        expect(emails.length).toBe(2);
        expect(emails[0].value).toBe('support@example.com');
        expect(emails[1].value).toBe('sales@test.org');
      });

      test('should include context for detections', () => {
        const text = 'Email: john@example.com for support';
        const detections = detector.detectAll(text, { includeContext: true });

        expect(detections.length).toBeGreaterThan(0);
        expect(detections[0].context).toBeDefined();
        expect(detections[0].context).toContain('john@example.com');
      });

      test('should not detect invalid email formats', () => {
        const text = 'Invalid emails: @example.com, user@, user@@example.com';
        const detections = detector.detectAll(text);

        const emails = detections.filter(d => d.type === 'email');
        expect(emails.length).toBe(0);
      });
    });

    describe('Phone Number Detection', () => {
      test('should detect US phone numbers', () => {
        const text = 'Call us at (555) 123-4567 or 555-987-6543';
        const detections = detector.detectAll(text);

        const phones = detections.filter(d => d.type === 'phone');
        expect(phones.length).toBeGreaterThanOrEqual(1);
      });

      test('should detect international formats', () => {
        const text = 'International: +1 555 123 4567';
        const detections = detector.detectAll(text);

        const phones = detections.filter(d => d.type === 'phone');
        expect(phones.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('Cryptocurrency Detection', () => {
      test('should detect Bitcoin addresses', () => {
        const text = 'Send BTC to bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
        const detections = detector.detectAll(text);

        const btc = detections.filter(d => d.type === 'bitcoin');
        expect(btc.length).toBe(1);
        expect(btc[0].value).toBe('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh');
        expect(btc[0].category).toBe('crypto');
      });

      test('should detect Ethereum addresses', () => {
        const text = 'ETH address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
        const detections = detector.detectAll(text);

        const eth = detections.filter(d => d.type === 'ethereum');
        expect(eth.length).toBeGreaterThanOrEqual(1);
      });

      test('should detect legacy Bitcoin addresses', () => {
        const text = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
        const detections = detector.detectAll(text);

        const btc = detections.filter(d => d.type === 'bitcoin');
        expect(btc.length).toBe(1);
      });

      test('should detect Litecoin addresses', () => {
        const text = 'LTC: LM2WMpR1Rp6j3Sa59cMXMs1SPzj9eXpGc1';
        const detections = detector.detectAll(text);

        const ltc = detections.filter(d => d.type === 'litecoin');
        expect(ltc.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('IP Address Detection', () => {
      test('should detect IPv4 addresses', () => {
        const text = 'Server IP: 192.168.1.1 and 8.8.8.8';
        const detections = detector.detectAll(text);

        const ips = detections.filter(d => d.type === 'ipv4');
        expect(ips.length).toBe(2);
        expect(ips[0].value).toBe('192.168.1.1');
        expect(ips[1].value).toBe('8.8.8.8');
      });

      test('should detect IPv6 addresses', () => {
        const text = 'IPv6: 2001:0db8:85a3:0000:0000:8a2e:0370:7334';
        const detections = detector.detectAll(text);

        const ips = detections.filter(d => d.type === 'ipv6');
        expect(ips.length).toBeGreaterThanOrEqual(1);
      });

      test('should not detect invalid IP addresses', () => {
        const text = 'Invalid IPs: 999.999.999.999, 192.168.1';
        const detections = detector.detectAll(text);

        const ips = detections.filter(d => d.type === 'ipv4');
        // Should either detect 0 or only valid parts
        expect(ips.every(ip => {
          const octets = ip.value.split('.');
          return octets.every(o => parseInt(o) <= 255);
        })).toBe(true);
      });
    });

    describe('Domain Detection', () => {
      test('should detect domain names', () => {
        const text = 'Visit example.com and test.org for more info';
        const detections = detector.detectAll(text);

        const domains = detections.filter(d => d.type === 'domain');
        expect(domains.length).toBeGreaterThanOrEqual(2);
      });

      test('should not detect emails as domains', () => {
        const text = 'Email: user@example.com';
        const detections = detector.detectAll(text);

        // Should detect email, not domain
        const emails = detections.filter(d => d.type === 'email');
        expect(emails.length).toBe(1);
      });
    });

    describe('URL Detection', () => {
      test('should detect HTTP URLs', () => {
        const text = 'Visit http://example.com or https://test.org/path';
        const detections = detector.detectAll(text);

        const urls = detections.filter(d => d.type === 'url');
        expect(urls.length).toBe(2);
        expect(urls[0].value).toBe('http://example.com');
        expect(urls[1].value).toBe('https://test.org/path');
      });

      test('should detect URLs with query parameters', () => {
        const text = 'Link: https://example.com/page?id=123&name=test';
        const detections = detector.detectAll(text);

        const urls = detections.filter(d => d.type === 'url');
        expect(urls.length).toBe(1);
        expect(urls[0].value).toContain('?id=123');
      });
    });

    describe('Social Media Detection', () => {
      test('should detect Twitter handles', () => {
        const text = 'Follow @twitter_user and @another_user for updates';
        const detections = detector.detectAll(text);

        const handles = detections.filter(d => d.type === 'twitter');
        expect(handles.length).toBe(2);
        expect(handles[0].value).toBe('@twitter_user');
      });

      test('should detect GitHub usernames in URLs', () => {
        const text = 'Check out github.com/johndoe and github.com/janedoe';
        const detections = detector.detectAll(text);

        const github = detections.filter(d => d.type === 'github');
        expect(github.length).toBe(2);
      });

      test('should detect Instagram handles', () => {
        const text = 'Instagram: @insta_user and @another.user';
        const detections = detector.detectAll(text);

        const handles = detections.filter(d => d.type === 'instagram');
        expect(handles.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('Coordinates Detection', () => {
      test('should detect latitude/longitude pairs', () => {
        const text = 'Location: 40.7128, -74.0060 (New York)';
        const detections = detector.detectAll(text);

        const coords = detections.filter(d => d.type === 'coordinates');
        expect(coords.length).toBe(1);
        expect(coords[0].value).toBe('40.7128, -74.0060');
        expect(coords[0].category).toBe('location');
      });
    });

    describe('Sensitive Data Detection', () => {
      test('should not detect credit cards by default', () => {
        const text = 'Card: 4532-1488-0343-6467';
        const detections = detector.detectAll(text);

        const cards = detections.filter(d => d.type === 'creditCard');
        expect(cards.length).toBe(0); // Not detected by default
      });

      test('should detect credit cards when enabled', () => {
        detector.config.detectSensitive = true;
        const text = 'Card: 4532-1488-0343-6467';
        const detections = detector.detectAll(text);

        const cards = detections.filter(d => d.type === 'creditCard');
        expect(cards.length).toBe(1);
        expect(cards[0].sensitive).toBe(true);
      });
    });

    describe('Pattern Filtering', () => {
      test('should only detect enabled patterns', () => {
        detector.setEnabledPatterns(['email', 'phone']);
        const text = 'Email: test@example.com, Phone: 555-1234, BTC: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
        const detections = detector.detectAll(text);

        const types = detections.map(d => d.type);
        expect(types).toContain('email');
        expect(types).toContain('phone');
        expect(types).not.toContain('bitcoin');
      });
    });

    describe('Duplicate Detection', () => {
      test('should not return duplicate values', () => {
        const text = 'Email: test@example.com and test@example.com again';
        const detections = detector.detectAll(text);

        const emails = detections.filter(d => d.type === 'email');
        expect(emails.length).toBe(1);
      });
    });

    describe('Validation Integration', () => {
      test('should validate detected patterns', async () => {
        const text = 'Valid email: john@example.com';
        const detections = detector.detectAll(text);
        const validated = await detector.validateDetections(detections);

        const email = validated.find(d => d.type === 'email');
        expect(email.validation).toBeDefined();
        expect(email.validation.plausible).toBe(true);
        expect(email.verified).toBe(true);
      });

      test('should mark invalid patterns', async () => {
        const text = 'Invalid IP: 999.999.999.999';
        const detections = detector.detectAll(text);
        const validated = await detector.validateDetections(detections);

        const ips = validated.filter(d => d.type === 'ipv4');
        if (ips.length > 0) {
          expect(ips[0].validation.plausible).toBe(false);
        }
      });
    });

    describe('Statistics', () => {
      test('should track detection statistics', () => {
        detector.resetStats();
        const text = 'Email: test@example.com, Phone: 555-1234';
        detector.detectAll(text);

        const stats = detector.getStats();
        expect(stats.totalDetections).toBeGreaterThanOrEqual(2);
        expect(stats.byType).toBeDefined();
      });

      test('should reset statistics', () => {
        detector.detectAll('test@example.com');
        detector.resetStats();

        const stats = detector.getStats();
        expect(stats.totalDetections).toBe(0);
        expect(Object.keys(stats.byType).length).toBe(0);
      });
    });

    describe('Pattern Metadata', () => {
      test('should include pattern metadata', () => {
        const text = 'Email: test@example.com';
        const detections = detector.detectAll(text);

        const email = detections.find(d => d.type === 'email');
        expect(email.name).toBe('Email Address');
        expect(email.icon).toBe('📧');
        expect(email.color).toBeDefined();
        expect(email.category).toBe('contact');
        expect(email.priority).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // OSINT Patterns Tests
  // ==========================================================================

  describe('OSINT_PATTERNS', () => {
    test('should define all expected pattern types', () => {
      const expectedTypes = [
        'email', 'phone', 'bitcoin', 'ethereum', 'litecoin', 'ripple',
        'ipv4', 'ipv6', 'domain', 'url', 'twitter', 'instagram', 'github',
        'creditCard', 'coordinates', 'apiKey'
      ];

      expectedTypes.forEach(type => {
        expect(OSINT_PATTERNS[type]).toBeDefined();
        expect(OSINT_PATTERNS[type].name).toBeDefined();
        expect(OSINT_PATTERNS[type].pattern).toBeDefined();
        expect(OSINT_PATTERNS[type].icon).toBeDefined();
        expect(OSINT_PATTERNS[type].color).toBeDefined();
        expect(OSINT_PATTERNS[type].category).toBeDefined();
        expect(OSINT_PATTERNS[type].priority).toBeDefined();
      });
    });

    test('should have unique priorities', () => {
      const priorities = Object.values(OSINT_PATTERNS).map(p => p.priority);
      const uniquePriorities = new Set(priorities);
      expect(uniquePriorities.size).toBe(priorities.length);
    });

    test('should mark sensitive patterns', () => {
      expect(OSINT_PATTERNS.creditCard.sensitive).toBe(true);
      expect(OSINT_PATTERNS.apiKey.sensitive).toBe(true);
    });

    test('should have valid regex patterns', () => {
      Object.entries(OSINT_PATTERNS).forEach(([type, config]) => {
        expect(config.pattern).toBeInstanceOf(RegExp);
        expect(() => new RegExp(config.pattern.source)).not.toThrow();
      });
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration Tests', () => {
    let detector;
    let verifier;

    beforeEach(() => {
      verifier = new DataVerifier({ strictMode: false });
      detector = new PatternDetector({ verifier });
    });

    test('should detect multiple pattern types in mixed content', async () => {
      const text = `
        Contact: support@example.com
        Phone: (555) 123-4567
        Bitcoin: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
        Server: 192.168.1.1
        Website: https://example.com
        Twitter: @example_user
      `;

      const detections = detector.detectAll(text);
      const validated = await detector.validateDetections(detections);

      expect(validated.length).toBeGreaterThanOrEqual(5);

      const types = new Set(validated.map(d => d.type));
      expect(types.has('email')).toBe(true);
      expect(types.has('phone')).toBe(true);
      expect(types.has('bitcoin')).toBe(true);
      expect(types.has('ipv4')).toBe(true);
      expect(types.has('url')).toBe(true);
    });

    test('should handle empty input', () => {
      const detections = detector.detectAll('');
      expect(detections).toEqual([]);
    });

    test('should handle null input', () => {
      const detections = detector.detectAll(null);
      expect(detections).toEqual([]);
    });

    test('should handle very long text', () => {
      const longText = 'test@example.com '.repeat(1000);
      const detections = detector.detectAll(longText);

      // Should detect only unique values
      const emails = detections.filter(d => d.type === 'email');
      expect(emails.length).toBe(1);
    });
  });

  // ==========================================================================
  // DOM Detection Tests (Mock Environment)
  // ==========================================================================

  describe('DOM Detection (Mocked)', () => {
    test('should provide detectInDOM method', () => {
      const detector = new PatternDetector();
      expect(typeof detector.detectInDOM).toBe('function');
    });

    test('should provide detectInAttributes method', () => {
      const detector = new PatternDetector();
      expect(typeof detector.detectInAttributes).toBe('function');
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    let detector;

    beforeEach(() => {
      detector = new PatternDetector();
    });

    test('should handle malformed regex gracefully', () => {
      // Test should not throw even with invalid input
      expect(() => {
        detector.detectAll('test [unclosed bracket');
      }).not.toThrow();
    });

    test('should handle special characters', () => {
      const text = 'Special: $#@%^&*()_+{}|:"<>?';
      expect(() => {
        detector.detectAll(text);
      }).not.toThrow();
    });

    test('should handle unicode characters', () => {
      const text = 'Unicode: 你好世界 test@example.com مرحبا';
      const detections = detector.detectAll(text);
      expect(detections.length).toBeGreaterThanOrEqual(1);
    });
  });
});
