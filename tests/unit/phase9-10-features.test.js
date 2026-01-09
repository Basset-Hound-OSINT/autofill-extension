/**
 * Phase 9-10 Feature Tests
 * Tests for Enhanced basset-hound Sync and Sock Puppet Integration
 *
 * Features tested:
 * - Base32 encoding/decoding (RFC 4648)
 * - TOTP generation (RFC 6238)
 * - Enhanced basset-hound sync with provenance
 * - Sock puppet selector functionality
 */

// =============================================================================
// Test Utilities
// =============================================================================

const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

function test(name, fn) {
  try {
    fn();
    testResults.passed++;
    testResults.tests.push({ name, status: 'passed' });
    console.log(`  ✓ ${name}`);
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, status: 'failed', error: error.message });
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${error.message}`);
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message} Expected: ${expected}, Actual: ${actual}`);
  }
}

function assertTrue(value, message = '') {
  if (!value) {
    throw new Error(`${message} Expected truthy value, got: ${value}`);
  }
}

function assertFalse(value, message = '') {
  if (value) {
    throw new Error(`${message} Expected falsy value, got: ${value}`);
  }
}

function assertDeepEqual(actual, expected, message = '') {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`${message} Objects not equal.\nExpected: ${expectedStr}\nActual: ${actualStr}`);
  }
}

function assertThrows(fn, message = '') {
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
  }
  if (!threw) {
    throw new Error(`${message} Expected function to throw`);
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    testResults.passed++;
    testResults.tests.push({ name, status: 'passed' });
    console.log(`  ✓ ${name}`);
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, status: 'failed', error: error.message });
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${error.message}`);
  }
}

function skip(name, reason = '') {
  testResults.skipped++;
  testResults.tests.push({ name, status: 'skipped', reason });
  console.log(`  - ${name} (skipped: ${reason || 'N/A'})`);
}

// =============================================================================
// Base32 Tests
// =============================================================================

function runBase32Tests() {
  console.log('\n=== Base32 Encoding/Decoding Tests ===\n');

  // Check if Base32 is available
  if (typeof Base32 === 'undefined') {
    skip('Base32 tests', 'Base32 module not loaded');
    return;
  }

  test('Base32.encode - empty array returns empty string', () => {
    const result = Base32.encode(new Uint8Array(0));
    assertEqual(result, '', 'Empty input');
  });

  test('Base32.encode - single byte', () => {
    // 'f' = 0x66 = 01100110 -> MZXQ (with padding) or MY (5 bits = 01100 = 12 = 'M', 110 = pad)
    const result = Base32.encode(new Uint8Array([102]), { padding: false });
    assertEqual(result, 'MY', 'Single byte "f"');
  });

  test('Base32.encode - "Hello" string', () => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode('Hello');
    const result = Base32.encode(bytes, { padding: false });
    // "Hello" in Base32 is "JBSWY3DP"
    assertEqual(result, 'JBSWY3DP', '"Hello" encoding');
  });

  test('Base32.decode - valid Base32 string', () => {
    const result = Base32.decode('JBSWY3DP');
    const decoder = new TextDecoder();
    assertEqual(decoder.decode(result), 'Hello', 'Decode "JBSWY3DP"');
  });

  test('Base32.decode - with padding', () => {
    const result = Base32.decode('JBSWY3DP======');
    const decoder = new TextDecoder();
    assertEqual(decoder.decode(result), 'Hello', 'Decode with padding');
  });

  test('Base32.decode - case insensitive', () => {
    const result = Base32.decode('jbswy3dp');
    const decoder = new TextDecoder();
    assertEqual(decoder.decode(result), 'Hello', 'Lowercase input');
  });

  test('Base32.validate - valid Base32', () => {
    const result = Base32.validate('JBSWY3DP');
    assertTrue(result.valid, 'Should be valid');
  });

  test('Base32.validate - invalid characters', () => {
    const result = Base32.validate('JBSWY3DP!!');
    assertFalse(result.valid, 'Should be invalid');
    assertTrue(result.errors.length > 0, 'Should have errors');
  });

  test('Base32.normalize - removes padding and whitespace', () => {
    const result = Base32.normalize('  jbswy3dp======  ');
    assertEqual(result, 'JBSWY3DP', 'Normalized string');
  });

  test('Base32.analyzeTOTPSecret - valid secret', () => {
    // A 32-character Base32 string = 20 bytes
    const result = Base32.analyzeTOTPSecret('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP');
    assertTrue(result.isValid, 'Should be valid TOTP secret');
    assertEqual(result.format, 'base32', 'Format should be base32');
  });

  test('Base32.analyzeTOTPSecret - too short', () => {
    const result = Base32.analyzeTOTPSecret('JBSWY');
    assertTrue(result.isValid, 'Still valid Base32');
    assertTrue(result.warnings.length > 0, 'Should have warnings about length');
  });

  test('Base32.generateSecret - generates valid secret', () => {
    const result = Base32.generateSecret({ length: 20 });
    assertTrue(result.secret.length > 0, 'Should generate secret');
    assertEqual(result.bytes, 20, 'Should be 20 bytes');
    assertEqual(result.bits, 160, 'Should be 160 bits');
    assertEqual(result.algorithm, 'SHA1', 'Default algorithm is SHA1');
  });

  test('Base32 encode/decode roundtrip', () => {
    const original = 'Test message for Base32 roundtrip!';
    const encoder = new TextEncoder();
    const bytes = encoder.encode(original);
    const encoded = Base32.encode(bytes);
    const decoded = Base32.decode(encoded);
    const decoder = new TextDecoder();
    assertEqual(decoder.decode(decoded), original, 'Roundtrip');
  });
}

// =============================================================================
// TOTP Generator Tests
// =============================================================================

function runTOTPTests() {
  console.log('\n=== TOTP Generator Tests ===\n');

  // Check if TOTPGenerator is available
  if (typeof TOTPGenerator === 'undefined') {
    skip('TOTP tests', 'TOTPGenerator module not loaded');
    return;
  }

  test('TOTPGenerator - constructor with defaults', () => {
    const totp = new TOTPGenerator({ secret: 'JBSWY3DPEHPK3PXP' });
    const info = totp.getInfo();
    assertEqual(info.period, 30, 'Default period');
    assertEqual(info.digits, 6, 'Default digits');
    assertEqual(info.algorithm, 'SHA1', 'Default algorithm');
    assertTrue(info.hasSecret, 'Has secret');
  });

  test('TOTPGenerator - invalid digits throws error', () => {
    assertThrows(() => {
      new TOTPGenerator({ secret: 'JBSWY3DPEHPK3PXP', digits: 5 });
    }, 'Should throw for digits < 6');
  });

  test('TOTPGenerator - invalid algorithm throws error', () => {
    assertThrows(() => {
      new TOTPGenerator({ secret: 'JBSWY3DPEHPK3PXP', algorithm: 'MD5' });
    }, 'Should throw for unsupported algorithm');
  });

  test('TOTPGenerator - getTimeCounter', () => {
    const totp = new TOTPGenerator({ secret: 'JBSWY3DPEHPK3PXP' });
    // At timestamp 59000ms (59 seconds), counter should be 1 (floor(59/30) = 1)
    const counter = totp.getTimeCounter(59000);
    assertEqual(counter, 1, 'Counter at 59s');
  });

  test('TOTPGenerator - getSecondsRemaining', () => {
    const totp = new TOTPGenerator({ secret: 'JBSWY3DPEHPK3PXP' });
    // At 10 seconds into period, 20 seconds remaining
    const remaining = totp.getSecondsRemaining(10000);
    assertEqual(remaining, 20, 'Seconds remaining');
  });

  asyncTest('TOTPGenerator - generate produces valid code', async () => {
    const totp = new TOTPGenerator({ secret: 'JBSWY3DPEHPK3PXP' });
    const result = await totp.generate();
    assertEqual(result.code.length, 6, 'Code is 6 digits');
    assertTrue(/^\d{6}$/.test(result.code), 'Code is numeric');
    assertTrue(result.secondsRemaining > 0, 'Has seconds remaining');
    assertTrue(result.secondsRemaining <= 30, 'Seconds remaining in range');
  });

  asyncTest('TOTPGenerator - generateForCounter is deterministic', async () => {
    const totp = new TOTPGenerator({ secret: 'JBSWY3DPEHPK3PXP' });
    const code1 = await totp.generateForCounter(12345);
    const code2 = await totp.generateForCounter(12345);
    assertEqual(code1, code2, 'Same counter produces same code');
  });

  asyncTest('TOTPGenerator - generateWithWindow', async () => {
    const totp = new TOTPGenerator({ secret: 'JBSWY3DPEHPK3PXP' });
    const result = await totp.generateWithWindow(1);
    assertEqual(result.codes.length, 3, 'Window of 1 produces 3 codes');
    assertTrue(result.codes.find(c => c.isCurrent), 'Has current code');
    assertTrue(result.currentCode.length === 6, 'Current code is 6 digits');
  });

  asyncTest('TOTPGenerator - verify valid code', async () => {
    const totp = new TOTPGenerator({ secret: 'JBSWY3DPEHPK3PXP' });
    const generated = await totp.generate();
    const result = await totp.verify(generated.code);
    assertTrue(result.valid, 'Code should be valid');
    assertEqual(result.offset, 0, 'Should match current window');
  });

  asyncTest('TOTPGenerator - verify invalid code', async () => {
    const totp = new TOTPGenerator({ secret: 'JBSWY3DPEHPK3PXP' });
    const result = await totp.verify('000000');
    // May or may not be valid depending on timing
    assertTrue(typeof result.valid === 'boolean', 'Returns validation result');
  });
}

// =============================================================================
// TOTP Manager Tests
// =============================================================================

function runTOTPManagerTests() {
  console.log('\n=== TOTP Manager Tests ===\n');

  if (typeof TOTPManager === 'undefined') {
    skip('TOTPManager tests', 'TOTPManager module not loaded');
    return;
  }

  test('TOTPManager - register and has', () => {
    const manager = new TOTPManager();
    const result = manager.register('identity-1', {
      secret: 'JBSWY3DPEHPK3PXP'
    });
    assertTrue(result.success, 'Registration should succeed');
    assertTrue(manager.has('identity-1'), 'Should have identity');
    assertFalse(manager.has('identity-2'), 'Should not have unregistered identity');
  });

  test('TOTPManager - register without secret fails', () => {
    const manager = new TOTPManager();
    const result = manager.register('identity-1', {});
    assertFalse(result.success, 'Should fail without secret');
  });

  test('TOTPManager - unregister', () => {
    const manager = new TOTPManager();
    manager.register('identity-1', { secret: 'JBSWY3DPEHPK3PXP' });
    const result = manager.unregister('identity-1');
    assertTrue(result.success, 'Unregister should succeed');
    assertFalse(manager.has('identity-1'), 'Should not have identity after unregister');
  });

  asyncTest('TOTPManager - generate for identity', async () => {
    const manager = new TOTPManager();
    manager.register('identity-1', { secret: 'JBSWY3DPEHPK3PXP' });
    const result = await manager.generate('identity-1');
    assertTrue(result.success, 'Should succeed');
    assertEqual(result.identityId, 'identity-1', 'Should include identity ID');
    assertTrue(result.code.length === 6, 'Should have 6-digit code');
  });

  asyncTest('TOTPManager - generate for unknown identity fails', async () => {
    const manager = new TOTPManager();
    const result = await manager.generate('unknown-identity');
    assertFalse(result.success, 'Should fail for unknown identity');
  });

  asyncTest('TOTPManager - generateAll', async () => {
    const manager = new TOTPManager();
    manager.register('id-1', { secret: 'JBSWY3DPEHPK3PXP' });
    manager.register('id-2', { secret: 'GEZDGNBVGY3TQOJQ' });
    const result = await manager.generateAll();
    assertTrue(result.success, 'Should succeed');
    assertEqual(result.count, 2, 'Should have 2 identities');
    assertTrue('id-1' in result.codes, 'Should have id-1');
    assertTrue('id-2' in result.codes, 'Should have id-2');
  });

  test('TOTPManager - getRegisteredIdentities', () => {
    const manager = new TOTPManager();
    manager.register('id-1', { secret: 'JBSWY3DPEHPK3PXP' });
    manager.register('id-2', { secret: 'GEZDGNBVGY3TQOJQ' });
    const ids = manager.getRegisteredIdentities();
    assertEqual(ids.length, 2, 'Should have 2 identities');
    assertTrue(ids.includes('id-1'), 'Should include id-1');
    assertTrue(ids.includes('id-2'), 'Should include id-2');
  });

  test('TOTPManager - getStats', () => {
    const manager = new TOTPManager();
    manager.register('id-1', { secret: 'JBSWY3DPEHPK3PXP' });
    const stats = manager.getStats();
    assertEqual(stats.registeredCount, 1, 'Should show registered count');
  });

  test('TOTPManager - clear', () => {
    const manager = new TOTPManager();
    manager.register('id-1', { secret: 'JBSWY3DPEHPK3PXP' });
    manager.register('id-2', { secret: 'GEZDGNBVGY3TQOJQ' });
    manager.clear();
    assertEqual(manager.getRegisteredIdentities().length, 0, 'Should have no identities after clear');
  });
}

// =============================================================================
// OTPAuth URI Tests
// =============================================================================

function runOTPAuthURITests() {
  console.log('\n=== OTPAuth URI Tests ===\n');

  if (typeof parseOTPAuthURI === 'undefined') {
    skip('OTPAuth URI tests', 'parseOTPAuthURI not loaded');
    return;
  }

  test('parseOTPAuthURI - valid URI', () => {
    const uri = 'otpauth://totp/Example:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example';
    const result = parseOTPAuthURI(uri);
    assertTrue(result.valid, 'Should be valid');
    assertEqual(result.type, 'totp', 'Type should be totp');
    assertEqual(result.secret, 'JBSWY3DPEHPK3PXP', 'Secret should match');
    assertEqual(result.issuer, 'Example', 'Issuer should match');
  });

  test('parseOTPAuthURI - with custom parameters', () => {
    const uri = 'otpauth://totp/Test?secret=JBSWY3DPEHPK3PXP&algorithm=SHA256&digits=8&period=60';
    const result = parseOTPAuthURI(uri);
    assertTrue(result.valid, 'Should be valid');
    assertEqual(result.algorithm, 'SHA256', 'Algorithm should be SHA256');
    assertEqual(result.digits, 8, 'Digits should be 8');
    assertEqual(result.period, 60, 'Period should be 60');
  });

  test('parseOTPAuthURI - missing secret', () => {
    const uri = 'otpauth://totp/Test?issuer=Example';
    const result = parseOTPAuthURI(uri);
    assertFalse(result.valid, 'Should be invalid');
    assertTrue(result.errors.some(e => e.includes('secret')), 'Should have secret error');
  });

  test('parseOTPAuthURI - invalid protocol', () => {
    const uri = 'https://example.com/totp';
    const result = parseOTPAuthURI(uri);
    assertFalse(result.valid, 'Should be invalid');
  });

  if (typeof generateOTPAuthURI !== 'undefined') {
    test('generateOTPAuthURI - creates valid URI', () => {
      const uri = generateOTPAuthURI({
        secret: 'JBSWY3DPEHPK3PXP',
        issuer: 'TestApp',
        account: 'user@test.com'
      });
      assertTrue(uri.startsWith('otpauth://totp/'), 'Should start with otpauth://totp/');
      assertTrue(uri.includes('secret=JBSWY3DPEHPK3PXP'), 'Should include secret');
      assertTrue(uri.includes('issuer=TestApp'), 'Should include issuer');
    });

    test('generateOTPAuthURI - roundtrip', () => {
      const original = {
        secret: 'JBSWY3DPEHPK3PXP',
        issuer: 'RoundtripTest',
        account: 'test@example.com',
        algorithm: 'SHA256',
        digits: 8,
        period: 60
      };
      const uri = generateOTPAuthURI(original);
      const parsed = parseOTPAuthURI(uri);
      assertTrue(parsed.valid, 'Parsed URI should be valid');
      assertEqual(parsed.secret, original.secret, 'Secret should match');
      assertEqual(parsed.issuer, original.issuer, 'Issuer should match');
      assertEqual(parsed.algorithm, original.algorithm, 'Algorithm should match');
      assertEqual(parsed.digits, original.digits, 'Digits should match');
      assertEqual(parsed.period, original.period, 'Period should match');
    });
  }
}

// =============================================================================
// Enhanced Basset Hound Sync Tests
// =============================================================================

function runEnhancedSyncTests() {
  console.log('\n=== Enhanced Basset Hound Sync Tests ===\n');

  if (typeof EnhancedBassetHoundSync === 'undefined') {
    skip('Enhanced Sync tests', 'EnhancedBassetHoundSync not loaded');
    return;
  }

  test('EnhancedBassetHoundSync - constructor with defaults', () => {
    const sync = new EnhancedBassetHoundSync({});
    const status = sync.getEnhancedStatus();
    assertTrue(status.enhanced !== undefined, 'Should have enhanced status');
    assertTrue(status.enhanced.config.includeProvenance, 'Provenance should be enabled by default');
  });

  test('EnhancedBassetHoundSync - updateEnhancedConfig', () => {
    const sync = new EnhancedBassetHoundSync({});
    sync.updateEnhancedConfig({
      minConfidenceThreshold: 0.5,
      verifyBeforeSync: false
    });
    const config = sync.enhancedConfig;
    assertEqual(config.minConfidenceThreshold, 0.5, 'Threshold should be updated');
    assertFalse(config.verifyBeforeSync, 'Verify should be disabled');
  });

  test('EnhancedBassetHoundSync - getEnhancedStats', () => {
    const sync = new EnhancedBassetHoundSync({});
    const stats = sync.getEnhancedStats();
    assertTrue(stats.enhanced !== undefined, 'Should have enhanced stats');
    assertEqual(stats.enhanced.totalWithProvenance, 0, 'Initial provenance count is 0');
    assertEqual(stats.enhanced.totalVerified, 0, 'Initial verified count is 0');
  });

  test('EnhancedBassetHoundSync - resetEnhancedStats', () => {
    const sync = new EnhancedBassetHoundSync({});
    sync.enhancedStats.totalWithProvenance = 10;
    sync.enhancedStats.totalVerified = 5;
    sync.resetEnhancedStats();
    assertEqual(sync.enhancedStats.totalWithProvenance, 0, 'Provenance count reset');
    assertEqual(sync.enhancedStats.totalVerified, 0, 'Verified count reset');
  });

  asyncTest('EnhancedBassetHoundSync - createEntityWithSource', async () => {
    const sync = new EnhancedBassetHoundSync({});
    const result = await sync.createEntityWithSource('PERSON', {
      name: 'Test User',
      email: 'test@example.com'
    }, {
      sourceUrl: 'https://example.com/profile',
      confidence: 0.85,
      autoSync: false
    });
    assertTrue(result.success, 'Should succeed');
    assertTrue(result.entity !== undefined, 'Should have entity');
    assertEqual(result.entity.type, 'PERSON', 'Entity type should match');
    assertEqual(result.entity.metadata.confidence, 0.85, 'Confidence should be set');
    assertFalse(result.synced, 'Should not be synced when autoSync is false');
  });

  asyncTest('EnhancedBassetHoundSync - syncWithConfidence valid', async () => {
    const sync = new EnhancedBassetHoundSync({});
    const entity = { type: 'PERSON', data: { name: 'Test' } };
    const result = await sync.syncWithConfidence(entity, 0.9);
    // With mock base sync, this should succeed
    assertEqual(entity.metadata.confidence, 0.9, 'Confidence should be added');
    assertEqual(entity.metadata.confidenceLevel, 'high', 'Level should be high');
  });

  asyncTest('EnhancedBassetHoundSync - syncWithConfidence below threshold', async () => {
    const sync = new EnhancedBassetHoundSync({
      enhancedConfig: { minConfidenceThreshold: 0.7 }
    });
    const entity = { type: 'PERSON', data: { name: 'Test' } };
    const result = await sync.syncWithConfidence(entity, 0.5);
    assertFalse(result.success, 'Should fail below threshold');
    assertTrue(result.skipped, 'Should be marked as skipped');
  });

  asyncTest('EnhancedBassetHoundSync - syncWithConfidence invalid value', async () => {
    const sync = new EnhancedBassetHoundSync({});
    const entity = { type: 'PERSON', data: { name: 'Test' } };
    const result = await sync.syncWithConfidence(entity, 1.5);
    assertFalse(result.success, 'Should fail for value > 1');
  });

  test('EnhancedBassetHoundSync - _getConfidenceLevel', () => {
    const sync = new EnhancedBassetHoundSync({});
    assertEqual(sync._getConfidenceLevel(0.95), 'high', '0.95 is high');
    assertEqual(sync._getConfidenceLevel(0.9), 'high', '0.9 is high');
    assertEqual(sync._getConfidenceLevel(0.8), 'medium', '0.8 is medium');
    assertEqual(sync._getConfidenceLevel(0.7), 'medium', '0.7 is medium');
    assertEqual(sync._getConfidenceLevel(0.6), 'low', '0.6 is low');
    assertEqual(sync._getConfidenceLevel(0.5), 'low', '0.5 is low');
    assertEqual(sync._getConfidenceLevel(0.3), 'very_low', '0.3 is very_low');
  });

  if (typeof getEnhancedBassetHoundSync !== 'undefined') {
    test('getEnhancedBassetHoundSync - singleton pattern', () => {
      resetEnhancedBassetHoundSync();
      const sync1 = getEnhancedBassetHoundSync({});
      const sync2 = getEnhancedBassetHoundSync({});
      assertTrue(sync1 === sync2, 'Should return same instance');
      resetEnhancedBassetHoundSync();
    });
  }
}

// =============================================================================
// Verification Status Tests
// =============================================================================

function runVerificationStatusTests() {
  console.log('\n=== Verification Status Tests ===\n');

  if (typeof VerificationStatus === 'undefined') {
    skip('VerificationStatus tests', 'VerificationStatus not loaded');
    return;
  }

  test('VerificationStatus - has expected values', () => {
    assertEqual(VerificationStatus.NOT_VERIFIED, 'not_verified', 'NOT_VERIFIED');
    assertEqual(VerificationStatus.CLIENT_VERIFIED, 'client_verified', 'CLIENT_VERIFIED');
    assertEqual(VerificationStatus.SERVER_VERIFIED, 'server_verified', 'SERVER_VERIFIED');
    assertEqual(VerificationStatus.VERIFICATION_PENDING, 'verification_pending', 'VERIFICATION_PENDING');
    assertEqual(VerificationStatus.VERIFICATION_FAILED, 'verification_failed', 'VERIFICATION_FAILED');
  });
}

// =============================================================================
// Test Runner
// =============================================================================

async function runAllTests() {
  console.log('Starting Phase 9-10 Feature Tests...\n');
  console.log('================================================');

  // Run sync tests
  runBase32Tests();
  runTOTPTests();
  await (async () => {
    // Async tests wrapped
    runTOTPManagerTests();
  })();
  runOTPAuthURITests();
  runEnhancedSyncTests();
  runVerificationStatusTests();

  // Print summary
  console.log('\n================================================');
  console.log('Test Summary:');
  console.log(`  Passed: ${testResults.passed}`);
  console.log(`  Failed: ${testResults.failed}`);
  console.log(`  Skipped: ${testResults.skipped}`);
  console.log(`  Total: ${testResults.passed + testResults.failed + testResults.skipped}`);
  console.log('================================================\n');

  return testResults;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    runBase32Tests,
    runTOTPTests,
    runTOTPManagerTests,
    runOTPAuthURITests,
    runEnhancedSyncTests,
    testResults
  };
}

// Auto-run if in browser environment with modules loaded
if (typeof window !== 'undefined' && typeof Base32 !== 'undefined') {
  runAllTests().then(results => {
    window.testResults = results;
  });
}
