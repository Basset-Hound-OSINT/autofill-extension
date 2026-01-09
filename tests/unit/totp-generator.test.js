/**
 * Unit Tests for TOTP Generator and Base32 Modules
 * Phase 10: Sock Puppet 2FA Support
 *
 * Tests RFC 6238 TOTP implementation with known test vectors
 * and Base32 encoding/decoding functionality.
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

// =============================================================================
// Mock Setup
// =============================================================================

// Mock Web Crypto API
const mockCrypto = {
  subtle: {
    importKey: jest.fn().mockResolvedValue({ type: 'secret' }),
    sign: jest.fn()
  },
  getRandomValues: jest.fn((array) => {
    // Fill with predictable values for testing
    for (let i = 0; i < array.length; i++) {
      array[i] = i % 256;
    }
    return array;
  })
};

global.crypto = mockCrypto;

// Mock TextEncoder/TextDecoder
global.TextEncoder = class {
  encode(str) {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i);
    }
    return bytes;
  }
};

global.TextDecoder = class {
  decode(bytes) {
    return String.fromCharCode(...bytes);
  }
};

// =============================================================================
// Base32 Tests
// =============================================================================

describe('Base32', () => {
  let Base32;

  beforeEach(() => {
    jest.resetModules();
    Base32 = require('../../utils/auth/base32.js');
  });

  describe('Encoding', () => {
    it('should encode empty input', () => {
      const result = Base32.encode(new Uint8Array(0));
      expect(result).toBe('');
    });

    it('should encode single byte', () => {
      // 'f' (0x66) encodes to 'MY======'
      const result = Base32.encode(new Uint8Array([0x66]));
      expect(result).toBe('MY======');
    });

    it('should encode multiple bytes', () => {
      // 'fo' encodes to 'MZXQ===='
      const result = Base32.encode(new Uint8Array([0x66, 0x6f]));
      expect(result).toBe('MZXQ====');
    });

    it('should encode "foo"', () => {
      // 'foo' encodes to 'MZXW6==='
      const result = Base32.encode(new Uint8Array([0x66, 0x6f, 0x6f]));
      expect(result).toBe('MZXW6===');
    });

    it('should encode "foob"', () => {
      // 'foob' encodes to 'MZXW6YQ='
      const result = Base32.encode(new Uint8Array([0x66, 0x6f, 0x6f, 0x62]));
      expect(result).toBe('MZXW6YQ=');
    });

    it('should encode "fooba"', () => {
      // 'fooba' encodes to 'MZXW6YTB'
      const result = Base32.encode(new Uint8Array([0x66, 0x6f, 0x6f, 0x62, 0x61]));
      expect(result).toBe('MZXW6YTB');
    });

    it('should encode "foobar"', () => {
      // 'foobar' encodes to 'MZXW6YTBOI======'
      const result = Base32.encode(new Uint8Array([0x66, 0x6f, 0x6f, 0x62, 0x61, 0x72]));
      expect(result).toBe('MZXW6YTBOI======');
    });

    it('should encode without padding when disabled', () => {
      const result = Base32.encode(new Uint8Array([0x66]), { padding: false });
      expect(result).toBe('MY');
      expect(result).not.toContain('=');
    });

    it('should encode string to Base32', () => {
      const result = Base32.encodeString('foo');
      expect(result).toBe('MZXW6===');
    });

    it('should encode hex string to Base32', () => {
      // '666f6f' (hex for 'foo') encodes to 'MZXW6==='
      const result = Base32.encodeHex('666f6f');
      expect(result).toBe('MZXW6===');
    });

    it('should throw on non-Uint8Array input', () => {
      expect(() => Base32.encode('string')).toThrow('Input must be a Uint8Array');
    });
  });

  describe('Decoding', () => {
    it('should decode empty input', () => {
      const result = Base32.decode('');
      expect(result).toEqual(new Uint8Array(0));
    });

    it('should decode single character with padding', () => {
      const result = Base32.decode('MY======');
      expect(result).toEqual(new Uint8Array([0x66]));
    });

    it('should decode without padding', () => {
      const result = Base32.decode('MY');
      expect(result).toEqual(new Uint8Array([0x66]));
    });

    it('should decode "MZXW6==="', () => {
      const result = Base32.decode('MZXW6===');
      expect(result).toEqual(new Uint8Array([0x66, 0x6f, 0x6f]));
    });

    it('should decode "MZXW6YTBOI======"', () => {
      const result = Base32.decode('MZXW6YTBOI======');
      expect(result).toEqual(new Uint8Array([0x66, 0x6f, 0x6f, 0x62, 0x61, 0x72]));
    });

    it('should decode lowercase input', () => {
      const result = Base32.decode('mzxw6===');
      expect(result).toEqual(new Uint8Array([0x66, 0x6f, 0x6f]));
    });

    it('should decode with whitespace', () => {
      const result = Base32.decode('MZXW 6===');
      expect(result).toEqual(new Uint8Array([0x66, 0x6f, 0x6f]));
    });

    it('should decode to string', () => {
      const result = Base32.decodeString('MZXW6===');
      expect(result).toBe('foo');
    });

    it('should decode to hex', () => {
      const result = Base32.decodeToHex('MZXW6===');
      expect(result).toBe('666f6f');
    });

    it('should skip invalid characters in non-strict mode', () => {
      const result = Base32.decode('MZX!W6===');
      expect(result).toEqual(new Uint8Array([0x66, 0x6f, 0x6f]));
    });

    it('should throw on invalid characters in strict mode', () => {
      expect(() => Base32.decode('MZX!W6===', { strict: true })).toThrow('Invalid Base32 character');
    });
  });

  describe('Round-trip Encoding/Decoding', () => {
    it('should round-trip empty input', () => {
      const original = new Uint8Array(0);
      const encoded = Base32.encode(original);
      const decoded = Base32.decode(encoded);
      expect(decoded).toEqual(original);
    });

    it('should round-trip various byte lengths', () => {
      for (let len = 1; len <= 10; len++) {
        const original = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          original[i] = (i * 37) % 256;
        }
        const encoded = Base32.encode(original);
        const decoded = Base32.decode(encoded);
        expect(decoded).toEqual(original);
      }
    });

    it('should round-trip random-like data', () => {
      const original = new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0]);
      const encoded = Base32.encode(original);
      const decoded = Base32.decode(encoded);
      expect(decoded).toEqual(original);
    });
  });

  describe('Validation', () => {
    it('should validate valid Base32 strings', () => {
      const result = Base32.validate('MZXW6===');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('MZXW6');
    });

    it('should detect invalid characters', () => {
      const result = Base32.validate('MZXW6!==');
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_CHARACTERS');
    });

    it('should warn about lowercase', () => {
      const result = Base32.validate('mzxw6===');
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].code).toBe('LOWERCASE_CHARACTERS');
    });

    it('should validate empty string', () => {
      const result = Base32.validate('');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('');
    });

    it('should validate padding when required', () => {
      const result = Base32.validate('MZXW6', { requirePadding: true });
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_PADDING');
    });
  });

  describe('Normalization', () => {
    it('should normalize lowercase to uppercase', () => {
      expect(Base32.normalize('mzxw6===')).toBe('MZXW6');
    });

    it('should remove whitespace', () => {
      expect(Base32.normalize('MZXW 6===')).toBe('MZXW6');
    });

    it('should remove padding', () => {
      expect(Base32.normalize('MZXW6===')).toBe('MZXW6');
    });
  });

  describe('TOTP Secret Analysis', () => {
    it('should analyze valid TOTP secrets', () => {
      // 20 byte secret (160 bits) - standard for SHA1
      const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
      const result = Base32.analyzeTOTPSecret(secret);
      expect(result.isValid).toBe(true);
      expect(result.format).toBe('base32');
      expect(result.keyLength).toBe(20);
    });

    it('should warn about short secrets', () => {
      const secret = 'MZXW6===';
      const result = Base32.analyzeTOTPSecret(secret);
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should reject empty secrets', () => {
      const result = Base32.analyzeTOTPSecret('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Secret cannot be empty');
    });

    it('should reject non-string input', () => {
      const result = Base32.analyzeTOTPSecret(123);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Secret must be a string');
    });
  });

  describe('Secret Generation', () => {
    it('should generate secret with default length (20 bytes)', () => {
      const result = Base32.generateSecret();
      expect(result.bytes).toBe(20);
      expect(result.bits).toBe(160);
      expect(result.secret).toBeDefined();
      expect(result.algorithm).toBe('SHA1');
    });

    it('should generate secret with custom length', () => {
      const result = Base32.generateSecret({ length: 32 });
      expect(result.bytes).toBe(32);
      expect(result.bits).toBe(256);
      expect(result.algorithm).toBe('SHA256');
    });

    it('should generate secret for SHA512', () => {
      const result = Base32.generateSecret({ length: 64 });
      expect(result.bytes).toBe(64);
      expect(result.algorithm).toBe('SHA512');
    });
  });
});

// =============================================================================
// TOTP Generator Tests
// =============================================================================

describe('TOTPGenerator', () => {
  let TOTPGenerator, TOTPManager, parseOTPAuthURI, generateOTPAuthURI;

  beforeEach(() => {
    jest.resetModules();

    // Mock HMAC-SHA1 result for RFC 6238 test vectors
    mockCrypto.subtle.sign.mockImplementation(async (algorithm, key, data) => {
      // This is a simplified mock - real tests would use actual HMAC
      // For now, return a predictable result based on input
      const result = new Uint8Array(20);
      const view = new DataView(data.buffer);
      const counter = view.getUint32(4, false);

      // Simple deterministic "hash" for testing
      for (let i = 0; i < 20; i++) {
        result[i] = (counter + i * 7) % 256;
      }

      return result.buffer;
    });

    const totp = require('../../utils/auth/totp-generator.js');
    TOTPGenerator = totp.TOTPGenerator;
    TOTPManager = totp.TOTPManager;
    parseOTPAuthURI = totp.parseOTPAuthURI;
    generateOTPAuthURI = totp.generateOTPAuthURI;
  });

  describe('Configuration', () => {
    it('should create with default configuration', () => {
      const generator = new TOTPGenerator({ secret: 'GEZDGNBVGY3TQOJQ' });
      const info = generator.getInfo();

      expect(info.period).toBe(30);
      expect(info.digits).toBe(6);
      expect(info.algorithm).toBe('SHA1');
      expect(info.hasSecret).toBe(true);
    });

    it('should accept custom configuration', () => {
      const generator = new TOTPGenerator({
        secret: 'GEZDGNBVGY3TQOJQ',
        period: 60,
        digits: 8,
        algorithm: 'SHA256'
      });
      const info = generator.getInfo();

      expect(info.period).toBe(60);
      expect(info.digits).toBe(8);
      expect(info.algorithm).toBe('SHA256');
    });

    it('should throw on invalid digits', () => {
      expect(() => new TOTPGenerator({
        secret: 'GEZDGNBVGY3TQOJQ',
        digits: 5
      })).toThrow();
    });

    it('should throw on invalid algorithm', () => {
      expect(() => new TOTPGenerator({
        secret: 'GEZDGNBVGY3TQOJQ',
        algorithm: 'MD5'
      })).toThrow();
    });

    it('should throw on invalid period', () => {
      expect(() => new TOTPGenerator({
        secret: 'GEZDGNBVGY3TQOJQ',
        period: 0
      })).toThrow();
    });
  });

  describe('Time Counter', () => {
    it('should calculate time counter correctly', () => {
      const generator = new TOTPGenerator({
        secret: 'GEZDGNBVGY3TQOJQ',
        period: 30
      });

      // At T=0, counter should be 0
      expect(generator.getTimeCounter(0)).toBe(0);

      // At T=29999ms (just before 30s), counter should still be 0
      expect(generator.getTimeCounter(29999)).toBe(0);

      // At T=30000ms (30s), counter should be 1
      expect(generator.getTimeCounter(30000)).toBe(1);

      // At T=59999ms, counter should still be 1
      expect(generator.getTimeCounter(59999)).toBe(1);

      // At T=60000ms, counter should be 2
      expect(generator.getTimeCounter(60000)).toBe(2);
    });

    it('should calculate seconds remaining correctly', () => {
      const generator = new TOTPGenerator({
        secret: 'GEZDGNBVGY3TQOJQ',
        period: 30
      });

      // At start of period, 30 seconds remain
      expect(generator.getSecondsRemaining(0)).toBe(30);

      // At 10 seconds in, 20 seconds remain
      expect(generator.getSecondsRemaining(10000)).toBe(20);

      // At 29 seconds in, 1 second remains
      expect(generator.getSecondsRemaining(29000)).toBe(1);

      // At 30 seconds (new period), 30 seconds remain
      expect(generator.getSecondsRemaining(30000)).toBe(30);
    });
  });

  describe('Code Generation', () => {
    it('should generate 6-digit codes', async () => {
      const generator = new TOTPGenerator({
        secret: 'GEZDGNBVGY3TQOJQ',
        digits: 6
      });

      const result = await generator.generate(0);
      expect(result.code).toMatch(/^\d{6}$/);
    });

    it('should generate 8-digit codes', async () => {
      const generator = new TOTPGenerator({
        secret: 'GEZDGNBVGY3TQOJQ',
        digits: 8
      });

      const result = await generator.generate(0);
      expect(result.code).toMatch(/^\d{8}$/);
    });

    it('should include metadata in result', async () => {
      const generator = new TOTPGenerator({
        secret: 'GEZDGNBVGY3TQOJQ'
      });

      const result = await generator.generate(15000);

      expect(result.code).toBeDefined();
      expect(result.counter).toBe(0);
      expect(result.period).toBe(30);
      expect(result.secondsRemaining).toBe(15);
      expect(result.algorithm).toBe('SHA1');
      expect(result.digits).toBe(6);
    });

    it('should generate same code for same counter', async () => {
      const generator = new TOTPGenerator({
        secret: 'GEZDGNBVGY3TQOJQ'
      });

      const code1 = await generator.generateForCounter(100);
      const code2 = await generator.generateForCounter(100);

      expect(code1).toBe(code2);
    });

    it('should generate different codes for different counters', async () => {
      const generator = new TOTPGenerator({
        secret: 'GEZDGNBVGY3TQOJQ'
      });

      const code1 = await generator.generateForCounter(100);
      const code2 = await generator.generateForCounter(101);

      expect(code1).not.toBe(code2);
    });

    it('should throw when secret not set', async () => {
      const generator = new TOTPGenerator({});

      await expect(generator.generate()).rejects.toThrow('Secret key not set');
    });
  });

  describe('Code Verification', () => {
    it('should verify current code', async () => {
      const generator = new TOTPGenerator({
        secret: 'GEZDGNBVGY3TQOJQ'
      });

      const generated = await generator.generate(0);
      const result = await generator.verify(generated.code, 1, 0);

      expect(result.valid).toBe(true);
      expect(result.offset).toBe(0);
    });

    it('should verify code within window', async () => {
      const generator = new TOTPGenerator({
        secret: 'GEZDGNBVGY3TQOJQ'
      });

      // Generate code for counter 1
      const code = await generator.generateForCounter(1);

      // Verify at counter 0 with window of 1 (should find it at offset +1)
      const result = await generator.verify(code, 1, 0);

      expect(result.valid).toBe(true);
      expect(result.offset).toBe(1);
    });

    it('should reject code outside window', async () => {
      const generator = new TOTPGenerator({
        secret: 'GEZDGNBVGY3TQOJQ'
      });

      // Generate code for counter 10
      const code = await generator.generateForCounter(10);

      // Verify at counter 0 with window of 1 (should not find it)
      const result = await generator.verify(code, 1, 0);

      expect(result.valid).toBe(false);
    });

    it('should reject invalid code format', async () => {
      const generator = new TOTPGenerator({
        secret: 'GEZDGNBVGY3TQOJQ',
        digits: 6
      });

      const result = await generator.verify('123', 1, 0);
      expect(result.valid).toBe(false);
    });
  });

  describe('Window Generation', () => {
    it('should generate codes for window', async () => {
      const generator = new TOTPGenerator({
        secret: 'GEZDGNBVGY3TQOJQ'
      });

      const result = await generator.generateWithWindow(2, 60000);

      expect(result.codes.length).toBe(5); // -2 to +2
      expect(result.codes[2].isCurrent).toBe(true);
      expect(result.window).toBe(2);
    });

    it('should mark current code correctly', async () => {
      const generator = new TOTPGenerator({
        secret: 'GEZDGNBVGY3TQOJQ'
      });

      const result = await generator.generateWithWindow(1, 0);

      const current = result.codes.find(c => c.isCurrent);
      expect(current).toBeDefined();
      expect(current.offset).toBe(0);
      expect(result.currentCode).toBe(current.code);
    });
  });

  describe('Secret Management', () => {
    it('should allow setting secret after construction', async () => {
      const generator = new TOTPGenerator({});

      generator.setSecret('GEZDGNBVGY3TQOJQ');

      const result = await generator.generate(0);
      expect(result.code).toBeDefined();
    });

    it('should update secret when set again', async () => {
      const generator = new TOTPGenerator({
        secret: 'GEZDGNBVGY3TQOJQ'
      });

      const code1 = await generator.generateForCounter(0);

      generator.setSecret('JBSWY3DPEHPK3PXP');

      const code2 = await generator.generateForCounter(0);

      expect(code1).not.toBe(code2);
    });
  });
});

// =============================================================================
// TOTP Manager Tests
// =============================================================================

describe('TOTPManager', () => {
  let TOTPManager;

  beforeEach(() => {
    jest.resetModules();

    mockCrypto.subtle.sign.mockImplementation(async (algorithm, key, data) => {
      const result = new Uint8Array(20);
      const view = new DataView(data.buffer);
      const counter = view.getUint32(4, false);
      for (let i = 0; i < 20; i++) {
        result[i] = (counter + i * 7) % 256;
      }
      return result.buffer;
    });

    const totp = require('../../utils/auth/totp-generator.js');
    TOTPManager = totp.TOTPManager;
  });

  describe('Registration', () => {
    it('should register TOTP for identity', () => {
      const manager = new TOTPManager();

      const result = manager.register('identity1', {
        secret: 'GEZDGNBVGY3TQOJQ'
      });

      expect(result.success).toBe(true);
      expect(result.identityId).toBe('identity1');
      expect(manager.has('identity1')).toBe(true);
    });

    it('should reject registration without identity ID', () => {
      const manager = new TOTPManager();

      const result = manager.register('', { secret: 'GEZDGNBVGY3TQOJQ' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Identity ID required');
    });

    it('should reject registration without secret', () => {
      const manager = new TOTPManager();

      const result = manager.register('identity1', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Secret required');
    });

    it('should unregister identity', () => {
      const manager = new TOTPManager();

      manager.register('identity1', { secret: 'GEZDGNBVGY3TQOJQ' });
      const result = manager.unregister('identity1');

      expect(result.success).toBe(true);
      expect(manager.has('identity1')).toBe(false);
    });
  });

  describe('Code Generation', () => {
    it('should generate code for registered identity', async () => {
      const manager = new TOTPManager();
      manager.register('identity1', { secret: 'GEZDGNBVGY3TQOJQ' });

      const result = await manager.generate('identity1', 0);

      expect(result.success).toBe(true);
      expect(result.code).toBeDefined();
      expect(result.identityId).toBe('identity1');
    });

    it('should fail for unregistered identity', async () => {
      const manager = new TOTPManager();

      const result = await manager.generate('unknown', 0);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No TOTP registered');
    });

    it('should generate codes for all identities', async () => {
      const manager = new TOTPManager();
      manager.register('identity1', { secret: 'GEZDGNBVGY3TQOJQ' });
      manager.register('identity2', { secret: 'JBSWY3DPEHPK3PXP' });

      const result = await manager.generateAll(0);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(result.codes.identity1).toBeDefined();
      expect(result.codes.identity2).toBeDefined();
    });
  });

  describe('Statistics', () => {
    it('should track generation statistics', async () => {
      const manager = new TOTPManager();
      manager.register('identity1', { secret: 'GEZDGNBVGY3TQOJQ' });

      await manager.generate('identity1', 0);
      await manager.generate('identity1', 0);

      const stats = manager.getStats();
      expect(stats.totalGenerations).toBe(2);
    });

    it('should track verification statistics', async () => {
      const manager = new TOTPManager();
      manager.register('identity1', { secret: 'GEZDGNBVGY3TQOJQ' });

      const generated = await manager.generate('identity1', 0);
      await manager.verify('identity1', generated.code, 1);
      await manager.verify('identity1', '000000', 1);

      const stats = manager.getStats();
      expect(stats.totalVerifications).toBe(2);
      expect(stats.successfulVerifications).toBe(1);
      expect(stats.failedVerifications).toBe(1);
    });
  });
});

// =============================================================================
// OTPAuth URI Tests
// =============================================================================

describe('OTPAuth URI', () => {
  let parseOTPAuthURI, generateOTPAuthURI;

  beforeEach(() => {
    jest.resetModules();
    const totp = require('../../utils/auth/totp-generator.js');
    parseOTPAuthURI = totp.parseOTPAuthURI;
    generateOTPAuthURI = totp.generateOTPAuthURI;
  });

  describe('URI Parsing', () => {
    it('should parse valid TOTP URI', () => {
      const uri = 'otpauth://totp/Example:user@example.com?secret=GEZDGNBVGY3TQOJQ&issuer=Example';
      const result = parseOTPAuthURI(uri);

      expect(result.valid).toBe(true);
      expect(result.type).toBe('totp');
      expect(result.secret).toBe('GEZDGNBVGY3TQOJQ');
      expect(result.issuer).toBe('Example');
    });

    it('should parse URI with all parameters', () => {
      const uri = 'otpauth://totp/Test?secret=ABCDEFGH&algorithm=SHA256&digits=8&period=60';
      const result = parseOTPAuthURI(uri);

      expect(result.valid).toBe(true);
      expect(result.algorithm).toBe('SHA256');
      expect(result.digits).toBe(8);
      expect(result.period).toBe(60);
    });

    it('should use defaults for missing parameters', () => {
      const uri = 'otpauth://totp/Test?secret=ABCDEFGH';
      const result = parseOTPAuthURI(uri);

      expect(result.valid).toBe(true);
      expect(result.algorithm).toBe('SHA1');
      expect(result.digits).toBe(6);
      expect(result.period).toBe(30);
    });

    it('should reject URI without protocol', () => {
      const result = parseOTPAuthURI('totp/Test?secret=ABCDEFGH');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('URI must start with otpauth://');
    });

    it('should reject URI without secret', () => {
      const result = parseOTPAuthURI('otpauth://totp/Test');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required parameter: secret');
    });

    it('should reject invalid algorithm', () => {
      const uri = 'otpauth://totp/Test?secret=ABCDEFGH&algorithm=MD5';
      const result = parseOTPAuthURI(uri);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Unsupported algorithm'))).toBe(true);
    });
  });

  describe('URI Generation', () => {
    it('should generate valid URI', () => {
      const uri = generateOTPAuthURI({
        secret: 'GEZDGNBVGY3TQOJQ',
        issuer: 'Example',
        account: 'user@example.com'
      });

      expect(uri).toContain('otpauth://totp/');
      expect(uri).toContain('secret=GEZDGNBVGY3TQOJQ');
      expect(uri).toContain('issuer=Example');
    });

    it('should include non-default parameters', () => {
      const uri = generateOTPAuthURI({
        secret: 'GEZDGNBVGY3TQOJQ',
        algorithm: 'SHA256',
        digits: 8,
        period: 60
      });

      expect(uri).toContain('algorithm=SHA256');
      expect(uri).toContain('digits=8');
      expect(uri).toContain('period=60');
    });

    it('should omit default parameters', () => {
      const uri = generateOTPAuthURI({
        secret: 'GEZDGNBVGY3TQOJQ'
      });

      expect(uri).not.toContain('algorithm=');
      expect(uri).not.toContain('digits=');
      expect(uri).not.toContain('period=');
    });

    it('should throw without secret', () => {
      expect(() => generateOTPAuthURI({})).toThrow('Secret is required');
    });
  });

  describe('Round-trip URI', () => {
    it('should round-trip URI with all parameters', () => {
      const config = {
        secret: 'GEZDGNBVGY3TQOJQ',
        issuer: 'TestService',
        account: 'testuser',
        algorithm: 'SHA512',
        digits: 8,
        period: 60
      };

      const uri = generateOTPAuthURI(config);
      const parsed = parseOTPAuthURI(uri);

      expect(parsed.valid).toBe(true);
      expect(parsed.secret).toBe(config.secret);
      expect(parsed.issuer).toBe(config.issuer);
      expect(parsed.algorithm).toBe(config.algorithm);
      expect(parsed.digits).toBe(config.digits);
      expect(parsed.period).toBe(config.period);
    });
  });
});

// =============================================================================
// RFC 6238 Test Vectors (Simplified)
// =============================================================================

describe('RFC 6238 Test Vectors', () => {
  // Note: These are simplified tests. Full RFC compliance would require
  // actual HMAC implementation rather than mocks.

  it('should generate consistent codes for same input', async () => {
    const { TOTPGenerator } = require('../../utils/auth/totp-generator.js');

    const generator = new TOTPGenerator({
      secret: 'GEZDGNBVGY3TQOJQ', // Base32 for "12345678901234567890"
      period: 30,
      digits: 8,
      algorithm: 'SHA1'
    });

    // Same timestamp should produce same code
    const code1 = await generator.generateForCounter(0);
    const code2 = await generator.generateForCounter(0);

    expect(code1).toBe(code2);
    expect(code1.length).toBe(8);
  });

  it('should handle time-based code rotation', async () => {
    const { TOTPGenerator } = require('../../utils/auth/totp-generator.js');

    const generator = new TOTPGenerator({
      secret: 'GEZDGNBVGY3TQOJQ',
      period: 30
    });

    // Codes for different time periods should differ
    const codes = [];
    for (let i = 0; i < 5; i++) {
      codes.push(await generator.generateForCounter(i));
    }

    // All codes should be unique
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(5);
  });
});
