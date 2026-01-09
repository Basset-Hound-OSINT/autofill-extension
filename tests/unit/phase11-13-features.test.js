/**
 * Phase 11-13 Feature Tests
 * Tests for Evidence Annotation, Blockchain/Phone/Email Verification, Investigation Context, and Entity Form Filling
 *
 * Features tested:
 * - Annotation Tools (Phase 11.2): Evidence annotation for law enforcement
 * - Blockchain Verifier (Phase 12.1): Cryptocurrency address verification
 * - Phone Verifier (Phase 12.2): Phone number validation and formatting
 * - Email Domain Verifier (Phase 12.3): Email/domain verification with DNS
 * - Investigation Context (Phase 13.1): Investigation lifecycle and entity linking
 * - Entity Form Filler (Phase 10.2): Smart form filling from entities
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

function describe(suiteName, fn) {
  console.log(`\n=== ${suiteName} ===\n`);
  fn();
}

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

// Alias for test
const it = test;

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message} Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`);
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

function assertContains(array, item, message = '') {
  if (!array.includes(item)) {
    throw new Error(`${message} Expected array to contain: ${item}`);
  }
}

function assertInstanceOf(value, constructor, message = '') {
  if (!(value instanceof constructor)) {
    throw new Error(`${message} Expected instance of ${constructor.name}`);
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

// Mock fetch for testing
function createMockFetch(responses = {}) {
  return async function mockFetch(url, options = {}) {
    const urlStr = url.toString();
    for (const [pattern, response] of Object.entries(responses)) {
      if (urlStr.includes(pattern)) {
        return {
          ok: response.ok !== false,
          status: response.status || 200,
          json: async () => response.data || {},
          text: async () => response.text || ''
        };
      }
    }
    return {
      ok: false,
      status: 404,
      json: async () => ({}),
      text: async () => 'Not found'
    };
  };
}

// =============================================================================
// Annotation Tools Tests
// =============================================================================

function runAnnotationToolsTests() {
  describe('Annotation Tools Tests', () => {
    // Check if module is available
    if (typeof AnnotationToolType === 'undefined') {
      skip('Annotation Tools tests', 'AnnotationTools module not loaded');
      return;
    }

    test('AnnotationToolType enum has correct values', () => {
      assertEqual(AnnotationToolType.SELECT, 'select', 'SELECT');
      assertEqual(AnnotationToolType.HIGHLIGHT, 'highlight', 'HIGHLIGHT');
      assertEqual(AnnotationToolType.REDACTION, 'redaction', 'REDACTION');
      assertEqual(AnnotationToolType.TEXT, 'text', 'TEXT');
      assertEqual(AnnotationToolType.ARROW, 'arrow', 'ARROW');
      assertEqual(AnnotationToolType.RECTANGLE, 'rectangle', 'RECTANGLE');
    });

    test('AnnotationType enum has correct values', () => {
      assertEqual(AnnotationType.HIGHLIGHT, 'highlight', 'HIGHLIGHT');
      assertEqual(AnnotationType.REDACTION, 'redaction', 'REDACTION');
      assertEqual(AnnotationType.TEXT, 'text', 'TEXT');
      assertEqual(AnnotationType.ARROW, 'arrow', 'ARROW');
      assertEqual(AnnotationType.RECTANGLE, 'rectangle', 'RECTANGLE');
    });

    test('HighlightColors has all expected colors', () => {
      assertTrue(HighlightColors.YELLOW !== undefined, 'YELLOW exists');
      assertTrue(HighlightColors.GREEN !== undefined, 'GREEN exists');
      assertTrue(HighlightColors.BLUE !== undefined, 'BLUE exists');
      assertTrue(HighlightColors.PINK !== undefined, 'PINK exists');
      assertTrue(HighlightColors.ORANGE !== undefined, 'ORANGE exists');
      assertTrue(HighlightColors.PURPLE !== undefined, 'PURPLE exists');
    });

    test('HighlightColors have correct structure', () => {
      const yellow = HighlightColors.YELLOW;
      assertTrue(yellow.name === 'Yellow', 'Has name');
      assertTrue(yellow.fill.includes('rgba'), 'Has rgba fill');
      assertTrue(yellow.stroke.startsWith('#'), 'Has hex stroke');
    });

    test('TextStyles has all expected styles', () => {
      assertTrue(TextStyles.LABEL !== undefined, 'LABEL exists');
      assertTrue(TextStyles.CALLOUT !== undefined, 'CALLOUT exists');
      assertTrue(TextStyles.NOTE !== undefined, 'NOTE exists');
    });

    test('TextStyles have correct structure', () => {
      const label = TextStyles.LABEL;
      assertEqual(label.fontSize, 14, 'Font size');
      assertTrue(label.fontFamily.includes('Arial'), 'Font family');
      assertTrue(label.fill !== undefined, 'Has fill');
      assertTrue(label.background !== undefined, 'Has background');
      assertTrue(label.padding !== undefined, 'Has padding');
    });

    test('AnnotationTools constructor with defaults', () => {
      const tools = new AnnotationTools();
      assertEqual(tools.state.isOpen, false, 'Not open by default');
      assertEqual(tools.state.currentTool, AnnotationToolType.HIGHLIGHT, 'Default tool is highlight');
      assertEqual(tools.state.currentColor, 'YELLOW', 'Default color is yellow');
      assertEqual(tools.state.annotations.length, 0, 'No annotations');
    });

    test('AnnotationTools constructor with options', () => {
      const tools = new AnnotationTools({
        examinerID: 'EXAM001',
        caseNumber: 'CASE-2024-001'
      });
      assertEqual(tools.config.examinerID, 'EXAM001', 'Examiner ID set');
      assertEqual(tools.config.caseNumber, 'CASE-2024-001', 'Case number set');
    });

    test('setTool changes current tool', () => {
      const tools = new AnnotationTools();
      const result = tools.setTool(AnnotationToolType.REDACTION);
      assertTrue(result.success, 'setTool succeeds');
      assertEqual(result.tool, AnnotationToolType.REDACTION, 'Tool changed');
      assertEqual(tools.state.currentTool, AnnotationToolType.REDACTION, 'State updated');
    });

    test('setTool rejects invalid tool', () => {
      const tools = new AnnotationTools();
      const result = tools.setTool('invalid_tool');
      assertFalse(result.success, 'setTool fails for invalid');
      assertTrue(result.error !== undefined, 'Has error message');
    });

    test('setColor changes current color', () => {
      const tools = new AnnotationTools();
      const result = tools.setColor('BLUE');
      assertTrue(result.success, 'setColor succeeds');
      assertEqual(result.color, 'BLUE', 'Color changed');
      assertEqual(tools.state.currentColor, 'BLUE', 'State updated');
    });

    test('setColor rejects invalid color', () => {
      const tools = new AnnotationTools();
      const result = tools.setColor('INVALID_COLOR');
      assertFalse(result.success, 'setColor fails for invalid');
      assertTrue(result.error !== undefined, 'Has error message');
    });

    test('getAnnotations returns copy of annotations array', () => {
      const tools = new AnnotationTools();
      tools.state.annotations = [{ id: 'test1' }, { id: 'test2' }];
      const annotations = tools.getAnnotations();
      assertEqual(annotations.length, 2, 'Returns 2 annotations');
      // Verify it's a copy, not the original
      annotations.push({ id: 'test3' });
      assertEqual(tools.state.annotations.length, 2, 'Original unchanged');
    });

    test('clearAnnotations removes all annotations', () => {
      const tools = new AnnotationTools();
      tools.state.annotations = [
        { id: 'ann1', type: 'highlight' },
        { id: 'ann2', type: 'redaction' }
      ];
      const result = tools.clearAnnotations();
      assertTrue(result.success, 'Clear succeeds');
      assertEqual(result.cleared, 2, 'Reports 2 cleared');
      assertEqual(tools.state.annotations.length, 0, 'All cleared');
    });

    test('deleteAnnotation removes specific annotation', () => {
      const tools = new AnnotationTools();
      tools.state.annotations = [
        { id: 'ann1', type: 'highlight', x: 0, y: 0 },
        { id: 'ann2', type: 'redaction', x: 10, y: 10 },
        { id: 'ann3', type: 'text', x: 20, y: 20 }
      ];
      const result = tools.deleteAnnotation('ann2');
      assertTrue(result.success, 'Delete succeeds');
      assertEqual(result.deletedId, 'ann2', 'Correct ID deleted');
      assertEqual(tools.state.annotations.length, 2, 'One removed');
      assertFalse(tools.state.annotations.find(a => a.id === 'ann2'), 'ann2 gone');
    });

    test('deleteAnnotation fails for non-existent annotation', () => {
      const tools = new AnnotationTools();
      tools.state.annotations = [{ id: 'ann1', type: 'highlight' }];
      const result = tools.deleteAnnotation('nonexistent');
      assertFalse(result.success, 'Delete fails');
      assertTrue(result.error !== undefined, 'Has error message');
    });

    test('undo removes last annotation', () => {
      const tools = new AnnotationTools();
      tools.state.annotations = [
        { id: 'ann1', type: 'highlight' },
        { id: 'ann2', type: 'redaction' }
      ];
      const result = tools.undo();
      assertTrue(result.success, 'Undo succeeds');
      assertEqual(result.undoneId, 'ann2', 'Last annotation undone');
      assertEqual(tools.state.annotations.length, 1, 'One remaining');
    });

    test('undo returns error when no annotations', () => {
      const tools = new AnnotationTools();
      const result = tools.undo();
      assertFalse(result.success, 'Undo fails');
      assertTrue(result.error !== undefined, 'Has error message');
    });

    test('exportNISTFormat returns correct structure', () => {
      const tools = new AnnotationTools({
        examinerID: 'EXAM001',
        caseNumber: 'CASE-2024-001'
      });
      tools.state.evidenceId = 'EVD001';
      tools.state.annotations = [
        { id: 'ann1', type: 'highlight', x: 10, y: 20, width: 100, height: 50, color: 'YELLOW', createdAt: '2024-01-01T00:00:00Z' }
      ];
      tools.state.imageWidth = 1920;
      tools.state.imageHeight = 1080;

      const result = tools.exportNISTFormat();
      assertTrue(result.success, 'Export succeeds');
      assertTrue(result.data['NIST-DF'] !== undefined, 'Has NIST-DF root');

      const nistDf = result.data['NIST-DF'];
      assertEqual(nistDf.version, '1.0', 'Version is 1.0');
      assertEqual(nistDf.annotationMetadata.evidenceId, 'EVD001', 'Evidence ID');
      assertEqual(nistDf.annotationMetadata.examinerID, 'EXAM001', 'Examiner ID');
      assertEqual(nistDf.annotationMetadata.caseNumber, 'CASE-2024-001', 'Case number');
      assertEqual(nistDf.annotations.length, 1, 'One annotation');
      assertEqual(nistDf.summary.totalAnnotations, 1, 'Summary count');
    });

    test('open fails when already open', () => {
      const tools = new AnnotationTools();
      tools.state.isOpen = true;
      const result = tools.open('data:image/png;base64,test');
      assertFalse(result.success, 'Open fails when already open');
      assertTrue(result.error.includes('Already open'), 'Error message');
    });

    test('open fails without image data', () => {
      const tools = new AnnotationTools();
      const result = tools.open(null);
      assertFalse(result.success, 'Open fails without image');
      assertTrue(result.error !== undefined, 'Has error');
    });

    test('close fails when not open', () => {
      const tools = new AnnotationTools();
      const result = tools.close();
      assertFalse(result.success, 'Close fails when not open');
      assertTrue(result.error !== undefined, 'Has error');
    });

    test('createAnnotationTools factory function', () => {
      if (typeof createAnnotationTools === 'undefined') {
        skip('createAnnotationTools factory', 'Function not exported');
        return;
      }
      const tools = createAnnotationTools({ examinerID: 'TEST' });
      assertTrue(tools instanceof AnnotationTools, 'Creates AnnotationTools instance');
      assertEqual(tools.config.examinerID, 'TEST', 'Options applied');
    });
  });
}

// =============================================================================
// Blockchain Verifier Tests
// =============================================================================

function runBlockchainVerifierTests() {
  describe('Blockchain Verifier Tests', () => {
    if (typeof BlockchainVerifier === 'undefined') {
      skip('Blockchain Verifier tests', 'BlockchainVerifier module not loaded');
      return;
    }

    // Test detectChain function
    test('detectChain - Bitcoin P2PKH address (starts with 1)', () => {
      const result = detectChain('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2');
      assertTrue(result !== null, 'Detected');
      assertEqual(result.chain, 'BTC', 'Chain is BTC');
      assertEqual(result.type, 'P2PKH', 'Type is P2PKH');
      assertEqual(result.network, 'mainnet', 'Network is mainnet');
    });

    test('detectChain - Bitcoin P2SH address (starts with 3)', () => {
      const result = detectChain('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy');
      assertTrue(result !== null, 'Detected');
      assertEqual(result.chain, 'BTC', 'Chain is BTC');
      assertEqual(result.type, 'P2SH', 'Type is P2SH');
    });

    test('detectChain - Bitcoin Bech32 address (starts with bc1q)', () => {
      const result = detectChain('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq');
      assertTrue(result !== null, 'Detected');
      assertEqual(result.chain, 'BTC', 'Chain is BTC');
      assertEqual(result.type, 'Bech32', 'Type is Bech32');
    });

    test('detectChain - Ethereum address', () => {
      const result = detectChain('0x742d35Cc6634C0532925a3b844Bc9e7595f15aB7');
      assertTrue(result !== null, 'Detected');
      assertEqual(result.chain, 'ETH', 'Chain is ETH');
      assertEqual(result.type, 'ERC20', 'Type is ERC20');
    });

    test('detectChain - Litecoin Legacy address (starts with L)', () => {
      const result = detectChain('LaMT348PWRnrqeeWArpwQPbuanpXDZGEUz');
      assertTrue(result !== null, 'Detected');
      assertEqual(result.chain, 'LTC', 'Chain is LTC');
      assertEqual(result.type, 'Legacy', 'Type is Legacy');
    });

    test('detectChain - Litecoin P2SH address (starts with M)', () => {
      const result = detectChain('MJKmXvjb1WxYrG6EYCYr5XKzD6VjH4VnCe');
      assertTrue(result !== null, 'Detected');
      assertEqual(result.chain, 'LTC', 'Chain is LTC');
      assertEqual(result.type, 'P2SH', 'Type is P2SH');
    });

    test('detectChain - Litecoin Bech32 address (starts with ltc1)', () => {
      const result = detectChain('ltc1qg42tkwuuxefutzxezdkdel39gfstuap288mfea');
      assertTrue(result !== null, 'Detected');
      assertEqual(result.chain, 'LTC', 'Chain is LTC');
      assertEqual(result.type, 'Bech32', 'Type is Bech32');
    });

    test('detectChain - invalid address returns null', () => {
      const result = detectChain('not_a_valid_address');
      assertEqual(result, null, 'Returns null for invalid');
    });

    test('detectChain - empty input returns null', () => {
      assertEqual(detectChain(''), null, 'Empty string');
      assertEqual(detectChain(null), null, 'Null');
      assertEqual(detectChain(undefined), null, 'Undefined');
    });

    // Test validateEthereumChecksum
    test('validateEthereumChecksum - lowercase address is valid', () => {
      const result = validateEthereumChecksum('0x742d35cc6634c0532925a3b844bc9e7595f15ab7');
      assertTrue(result, 'Lowercase is valid');
    });

    test('validateEthereumChecksum - uppercase address is valid', () => {
      const result = validateEthereumChecksum('0x742D35CC6634C0532925A3B844BC9E7595F15AB7');
      assertTrue(result, 'Uppercase is valid');
    });

    test('validateBase58 - valid Base58 string', () => {
      const result = validateBase58('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2');
      assertTrue(result, 'Valid Base58');
    });

    test('validateBase58 - invalid Base58 (contains 0)', () => {
      const result = validateBase58('0BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2');
      assertFalse(result, '0 is not valid Base58');
    });

    test('validateBase58 - invalid Base58 (contains O)', () => {
      const result = validateBase58('OBvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2');
      assertFalse(result, 'O is not valid Base58');
    });

    test('validateBech32 - valid Bech32 string', () => {
      const result = validateBech32('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq');
      assertTrue(result, 'Valid Bech32');
    });

    // Test BlockchainVerifier class
    test('BlockchainVerifier constructor with defaults', () => {
      const verifier = new BlockchainVerifier();
      assertTrue(verifier.config.useCache === true, 'Cache enabled by default');
      assertEqual(verifier.stats.totalVerifications, 0, 'Initial verifications is 0');
    });

    test('BlockchainVerifier constructor with options', () => {
      const verifier = new BlockchainVerifier({
        etherscanApiKey: 'test-key',
        useCache: false
      });
      assertEqual(verifier.config.etherscanApiKey, 'test-key', 'API key set');
      assertEqual(verifier.config.useCache, false, 'Cache disabled');
    });

    test('BlockchainVerifier getSupportedChains', () => {
      const verifier = new BlockchainVerifier();
      const chains = verifier.getSupportedChains();
      assertTrue(Array.isArray(chains), 'Returns array');
      assertTrue(chains.length >= 3, 'At least 3 chains');
      assertTrue(chains.find(c => c.code === 'BTC'), 'Has BTC');
      assertTrue(chains.find(c => c.code === 'ETH'), 'Has ETH');
      assertTrue(chains.find(c => c.code === 'LTC'), 'Has LTC');
    });

    test('BlockchainVerifier getStats', () => {
      const verifier = new BlockchainVerifier();
      const stats = verifier.getStats();
      assertEqual(stats.totalVerifications, 0, 'Total verifications');
      assertEqual(stats.successful, 0, 'Successful');
      assertEqual(stats.failed, 0, 'Failed');
      assertTrue(stats.cache !== undefined, 'Has cache stats');
      assertTrue(stats.rateLimits !== undefined, 'Has rate limit stats');
    });

    test('BlockchainVerifier resetStats', () => {
      const verifier = new BlockchainVerifier();
      verifier.stats.totalVerifications = 10;
      verifier.stats.successful = 8;
      verifier.resetStats();
      assertEqual(verifier.stats.totalVerifications, 0, 'Reset total');
      assertEqual(verifier.stats.successful, 0, 'Reset successful');
    });

    test('BlockchainVerifier clearCache', () => {
      const verifier = new BlockchainVerifier();
      verifier.cache.set('test', 'BTC', { data: 'test' });
      verifier.clearCache();
      assertEqual(verifier.cache.cache.size, 0, 'Cache cleared');
    });

    // Test RateLimiter
    test('RateLimiter canRequest - allows within limit', () => {
      const limiter = new RateLimiter(5, 60000);
      const result = limiter.canRequest();
      assertTrue(result.allowed, 'Request allowed');
    });

    test('RateLimiter recordRequest increments counter', () => {
      const limiter = new RateLimiter(5, 60000);
      limiter.recordRequest();
      const status = limiter.getStatus();
      assertEqual(status.requestsInWindow, 1, 'One request recorded');
      assertEqual(status.totalRequests, 1, 'Total requests');
    });

    test('RateLimiter canRequest - denies when limit reached', () => {
      const limiter = new RateLimiter(2, 60000);
      limiter.recordRequest();
      limiter.recordRequest();
      const result = limiter.canRequest();
      assertFalse(result.allowed, 'Request denied');
      assertTrue(result.waitMs > 0, 'Has wait time');
    });

    test('RateLimiter reset clears all data', () => {
      const limiter = new RateLimiter(5, 60000);
      limiter.recordRequest();
      limiter.recordRequest();
      limiter.reset();
      const status = limiter.getStatus();
      assertEqual(status.requestsInWindow, 0, 'Window cleared');
      assertEqual(status.totalRequests, 0, 'Total cleared');
    });

    // Test VerificationCache
    test('VerificationCache set and get', () => {
      const cache = new VerificationCache(60000);
      cache.set('0x123', 'ETH', { balance: 1.5 });
      const result = cache.get('0x123', 'ETH');
      assertTrue(result !== null, 'Retrieved from cache');
      assertEqual(result.balance, 1.5, 'Correct data');
    });

    test('VerificationCache has', () => {
      const cache = new VerificationCache(60000);
      cache.set('0x123', 'ETH', { balance: 1.5 });
      assertTrue(cache.has('0x123', 'ETH'), 'Has entry');
      assertFalse(cache.has('0x456', 'ETH'), 'Does not have');
    });

    test('VerificationCache getStats', () => {
      const cache = new VerificationCache(60000, 100);
      cache.set('0x123', 'ETH', { balance: 1.5 });
      cache.get('0x123', 'ETH'); // hit
      cache.get('0x456', 'ETH'); // miss

      const stats = cache.getStats();
      assertEqual(stats.hits, 1, 'One hit');
      assertEqual(stats.misses, 1, 'One miss');
      assertEqual(stats.size, 1, 'One entry');
    });

    // Test formatBlockchainResults
    test('formatBlockchainResults - successful result', () => {
      const result = {
        success: true,
        address: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
        chain: 'BTC',
        valid: true,
        exists: true,
        addressType: 'P2PKH',
        network: 'mainnet',
        confidence: 0.95,
        data: { balance: 0.5, txCount: 10 },
        explorer: 'https://mempool.space/address/1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
        checks: { formatValid: true, checksumValid: true, onChainVerified: true }
      };

      const formatted = formatBlockchainResults(result);
      assertTrue(formatted.success, 'Success');
      assertEqual(formatted.data.chain, 'BTC', 'Chain');
      assertEqual(formatted.data.chainName, 'Bitcoin', 'Chain name');
      assertEqual(formatted.data.valid, true, 'Valid');
      assertEqual(formatted.data.confidenceLevel, 'high', 'Confidence level');
    });

    test('formatBlockchainResults - failed result', () => {
      const result = {
        success: false,
        errors: [{ code: 'INVALID_FORMAT', message: 'Not a valid address' }]
      };

      const formatted = formatBlockchainResults(result);
      assertFalse(formatted.success, 'Not success');
      assertTrue(formatted.error !== undefined, 'Has error');
      assertEqual(formatted.error.code, 'INVALID_FORMAT', 'Error code');
    });
  });
}

// =============================================================================
// Phone Verifier Tests
// =============================================================================

function runPhoneVerifierTests() {
  describe('Phone Verifier Tests', () => {
    if (typeof PhoneVerifier === 'undefined') {
      skip('Phone Verifier tests', 'PhoneVerifier module not loaded');
      return;
    }

    test('PhoneVerifier constructor with defaults', () => {
      const verifier = new PhoneVerifier();
      assertEqual(verifier.defaultCountry, 'US', 'Default country US');
      assertFalse(verifier.strictMode, 'Strict mode off by default');
    });

    test('PhoneVerifier constructor with options', () => {
      const verifier = new PhoneVerifier({
        defaultCountry: 'CA',
        strictMode: true
      });
      assertEqual(verifier.defaultCountry, 'CA', 'Default country CA');
      assertTrue(verifier.strictMode, 'Strict mode on');
    });

    // Test parsePhoneNumber
    test('parsePhoneNumber - US number with country code', () => {
      const verifier = new PhoneVerifier();
      const result = verifier.parsePhoneNumber('+12025551234');
      assertTrue(result.success, 'Parse succeeds');
      assertEqual(result.countryCode, '1', 'Country code');
      assertEqual(result.nationalNumber, '2025551234', 'National number');
    });

    test('parsePhoneNumber - US number without country code', () => {
      const verifier = new PhoneVerifier({ defaultCountry: 'US' });
      const result = verifier.parsePhoneNumber('2025551234');
      assertTrue(result.success, 'Parse succeeds');
      assertEqual(result.country, 'US', 'Country detected');
      assertEqual(result.nationalNumber, '2025551234', 'National number');
    });

    test('parsePhoneNumber - formatted US number', () => {
      const verifier = new PhoneVerifier();
      const result = verifier.parsePhoneNumber('(202) 555-1234', 'US');
      assertTrue(result.success, 'Parse succeeds');
      assertEqual(result.nationalNumber, '2025551234', 'National number extracted');
    });

    test('parsePhoneNumber - UK number', () => {
      const verifier = new PhoneVerifier({ defaultCountry: 'UK' });
      const result = verifier.parsePhoneNumber('+447911123456');
      assertTrue(result.success, 'Parse succeeds');
      assertEqual(result.countryCode, '44', 'Country code');
      assertEqual(result.country, 'UK', 'Country is UK');
    });

    test('parsePhoneNumber - with extension', () => {
      const verifier = new PhoneVerifier();
      const result = verifier.parsePhoneNumber('+12025551234 ext 567', 'US');
      assertTrue(result.success, 'Parse succeeds');
      assertEqual(result.extension, '567', 'Extension extracted');
    });

    test('parsePhoneNumber - too short', () => {
      const verifier = new PhoneVerifier();
      const result = verifier.parsePhoneNumber('12345');
      assertFalse(result.success, 'Parse fails');
      assertTrue(result.errors.length > 0, 'Has errors');
      assertEqual(result.errors[0].code, 'TOO_SHORT', 'Too short error');
    });

    test('parsePhoneNumber - too long', () => {
      const verifier = new PhoneVerifier();
      const result = verifier.parsePhoneNumber('1234567890123456789');
      assertFalse(result.success, 'Parse fails');
      assertEqual(result.errors[0].code, 'TOO_LONG', 'Too long error');
    });

    test('parsePhoneNumber - no digits', () => {
      const verifier = new PhoneVerifier();
      const result = verifier.parsePhoneNumber('not a number');
      assertFalse(result.success, 'Parse fails');
      assertEqual(result.errors[0].code, 'NO_DIGITS', 'No digits error');
    });

    // Test formatE164
    test('formatE164 - US number', () => {
      const verifier = new PhoneVerifier();
      const result = verifier.formatE164('2025551234', 'US');
      assertEqual(result, '+12025551234', 'E.164 format');
    });

    test('formatE164 - UK number', () => {
      const verifier = new PhoneVerifier();
      const result = verifier.formatE164('7911123456', 'UK');
      assertEqual(result, '+447911123456', 'E.164 format');
    });

    test('formatE164 - invalid number returns null', () => {
      const verifier = new PhoneVerifier();
      const result = verifier.formatE164('123', 'US');
      assertEqual(result, null, 'Returns null for invalid');
    });

    // Test formatNational
    test('formatNational - US number', () => {
      const verifier = new PhoneVerifier();
      const result = verifier.formatNational('2025551234', 'US');
      assertEqual(result, '(202) 555-1234', 'National format');
    });

    // Test formatInternational
    test('formatInternational - US number', () => {
      const verifier = new PhoneVerifier();
      const result = verifier.formatInternational('2025551234', 'US');
      assertEqual(result, '+1 202-555-1234', 'International format');
    });

    // Test validate
    test('validate - valid US number', () => {
      const verifier = new PhoneVerifier();
      const result = verifier.validate('2025551234', { defaultCountry: 'US' });
      assertTrue(result.plausible, 'Is plausible');
      assertTrue(result.valid, 'Is valid');
      assertTrue(result.checks.hasDigits, 'Has digits');
      assertTrue(result.checks.validLength, 'Valid length');
      assertTrue(result.checks.validCountryCode, 'Valid country code');
    });

    test('validate - invalid number', () => {
      const verifier = new PhoneVerifier();
      const result = verifier.validate('12345');
      assertFalse(result.plausible, 'Not plausible');
      assertFalse(result.valid, 'Not valid');
      assertTrue(result.errors.length > 0, 'Has errors');
    });

    // Test detectNumberType
    test('detectNumberType - US mobile', () => {
      const verifier = new PhoneVerifier();
      const result = verifier.detectNumberType('2025551234', 'US');
      assertTrue(result.possibleTypes.length > 0, 'Has possible types');
    });

    test('detectNumberType - UK mobile', () => {
      const verifier = new PhoneVerifier();
      const result = verifier.detectNumberType('7911123456', 'UK');
      assertEqual(result.type, 'mobile', 'Detected as mobile');
    });

    // Test isMobile and isLandline
    test('isMobile - UK mobile number', () => {
      const verifier = new PhoneVerifier();
      const result = verifier.isMobile('+447911123456');
      assertTrue(result, 'Is mobile');
    });

    // Test getCountry
    test('getCountry - from international number', () => {
      const verifier = new PhoneVerifier();
      const result = verifier.getCountry('+12025551234');
      assertTrue(result === 'US' || result === 'CA', 'US or CA (NANP)');
    });

    // Test getSupportedCountries
    test('getSupportedCountries returns list', () => {
      const verifier = new PhoneVerifier();
      const countries = verifier.getSupportedCountries();
      assertTrue(Array.isArray(countries), 'Returns array');
      assertTrue(countries.length > 10, 'Has many countries');
      assertTrue(countries.find(c => c.code === 'US'), 'Has US');
      assertTrue(countries.find(c => c.code === 'UK'), 'Has UK');
    });

    // Test getExampleNumber
    test('getExampleNumber - US', () => {
      const verifier = new PhoneVerifier();
      const example = verifier.getExampleNumber('US');
      assertTrue(example !== null, 'Has example');
      assertTrue(example.mobile !== undefined, 'Has mobile example');
    });

    // Test isValid shortcut
    test('isValid - valid number', () => {
      const verifier = new PhoneVerifier();
      assertTrue(verifier.isValid('+12025551234'), 'Valid');
    });

    test('isValid - invalid number', () => {
      const verifier = new PhoneVerifier();
      assertFalse(verifier.isValid('12345'), 'Invalid');
    });

    // Test isPlausible shortcut
    test('isPlausible - plausible number', () => {
      const verifier = new PhoneVerifier();
      assertTrue(verifier.isPlausible('2025551234', 'US'), 'Plausible');
    });

    // Test statistics
    test('getStats returns statistics', () => {
      const verifier = new PhoneVerifier();
      verifier.validate('2025551234', { defaultCountry: 'US' });
      const stats = verifier.getStats();
      assertEqual(stats.totalValidations, 1, 'One validation');
    });

    test('resetStats clears statistics', () => {
      const verifier = new PhoneVerifier();
      verifier.validate('2025551234', { defaultCountry: 'US' });
      verifier.resetStats();
      const stats = verifier.getStats();
      assertEqual(stats.totalValidations, 0, 'Stats reset');
    });

    // Test enhancedVerifyPhone helper
    test('enhancedVerifyPhone returns DataVerifier-compatible result', () => {
      if (typeof enhancedVerifyPhone === 'undefined') {
        skip('enhancedVerifyPhone', 'Function not exported');
        return;
      }
      const result = enhancedVerifyPhone('+12025551234');
      assertTrue(result.plausible !== undefined, 'Has plausible');
      assertTrue(result.valid !== undefined, 'Has valid');
      assertTrue(result.checks !== undefined, 'Has checks');
      assertTrue(result.normalized !== undefined, 'Has normalized');
    });
  });
}

// =============================================================================
// Email Domain Verifier Tests
// =============================================================================

function runEmailDomainVerifierTests() {
  describe('Email Domain Verifier Tests', () => {
    if (typeof EmailDomainVerifier === 'undefined') {
      skip('Email Domain Verifier tests', 'EmailDomainVerifier module not loaded');
      return;
    }

    test('EmailDomainVerifier constructor with defaults', () => {
      const verifier = new EmailDomainVerifier();
      assertTrue(verifier.config.useCache === true, 'Cache enabled');
      assertEqual(verifier.config.dnsProvider, 'google', 'Google DNS default');
    });

    test('EmailDomainVerifier constructor with options', () => {
      const verifier = new EmailDomainVerifier({
        useCache: false,
        dnsProvider: 'cloudflare'
      });
      assertFalse(verifier.config.useCache, 'Cache disabled');
      assertEqual(verifier.config.dnsProvider, 'cloudflare', 'Cloudflare DNS');
    });

    // Test checkDisposable
    test('checkDisposable - known disposable domain', () => {
      const verifier = new EmailDomainVerifier();
      const result = verifier.checkDisposable('user@tempmail.com');
      assertTrue(result.success, 'Check succeeds');
      assertTrue(result.isDisposable, 'Is disposable');
      assertTrue(result.confidence >= 0.9, 'High confidence');
      assertTrue(result.reasons.length > 0, 'Has reasons');
    });

    test('checkDisposable - legitimate domain', () => {
      const verifier = new EmailDomainVerifier();
      const result = verifier.checkDisposable('user@gmail.com');
      assertTrue(result.success, 'Check succeeds');
      assertFalse(result.isDisposable, 'Not disposable');
      assertTrue(result.confidence < 0.5, 'Low confidence');
    });

    test('checkDisposable - pattern match (guerrillamail)', () => {
      const verifier = new EmailDomainVerifier();
      const result = verifier.checkDisposable('user@guerrillamail.com');
      assertTrue(result.isDisposable, 'Is disposable');
    });

    test('checkDisposable - invalid email', () => {
      const verifier = new EmailDomainVerifier();
      const result = verifier.checkDisposable('not-an-email');
      assertFalse(result.success, 'Check fails');
      assertTrue(result.error !== undefined, 'Has error');
    });

    // Test suggestCorrection
    test('suggestCorrection - gmail typo', () => {
      const verifier = new EmailDomainVerifier();
      const result = verifier.suggestCorrection('user@gmial.com');
      assertTrue(result.success, 'Check succeeds');
      assertTrue(result.hasTypo, 'Has typo');
      assertEqual(result.correctedDomain, 'gmail.com', 'Corrected to gmail');
      assertEqual(result.suggestion, 'user@gmail.com', 'Full suggestion');
      assertTrue(result.confidence > 0.9, 'High confidence');
    });

    test('suggestCorrection - yahoo typo', () => {
      const verifier = new EmailDomainVerifier();
      const result = verifier.suggestCorrection('user@yaho.com');
      assertTrue(result.hasTypo, 'Has typo');
      assertEqual(result.correctedDomain, 'yahoo.com', 'Corrected to yahoo');
    });

    test('suggestCorrection - hotmail typo', () => {
      const verifier = new EmailDomainVerifier();
      const result = verifier.suggestCorrection('user@hotmal.com');
      assertTrue(result.hasTypo, 'Has typo');
      assertEqual(result.correctedDomain, 'hotmail.com', 'Corrected to hotmail');
    });

    test('suggestCorrection - outlook typo', () => {
      const verifier = new EmailDomainVerifier();
      const result = verifier.suggestCorrection('user@outloo.com');
      assertTrue(result.hasTypo, 'Has typo');
      assertEqual(result.correctedDomain, 'outlook.com', 'Corrected to outlook');
    });

    test('suggestCorrection - TLD typo (.con -> .com)', () => {
      const verifier = new EmailDomainVerifier();
      const result = verifier.suggestCorrection('user@gmail.con');
      assertTrue(result.hasTypo, 'Has typo');
      assertEqual(result.correctedDomain, 'gmail.com', 'TLD corrected');
    });

    test('suggestCorrection - no typo', () => {
      const verifier = new EmailDomainVerifier();
      const result = verifier.suggestCorrection('user@gmail.com');
      assertFalse(result.hasTypo, 'No typo');
      assertEqual(result.suggestion, null, 'No suggestion');
    });

    test('suggestCorrection - edit distance match', () => {
      const verifier = new EmailDomainVerifier();
      const result = verifier.suggestCorrection('user@gmal.com');
      assertTrue(result.hasTypo, 'Has typo');
      assertEqual(result.correctedDomain, 'gmail.com', 'Corrected via edit distance');
    });

    // Test statistics
    test('getStats returns statistics', () => {
      const verifier = new EmailDomainVerifier();
      verifier.checkDisposable('user@tempmail.com');
      const stats = verifier.getStats();
      assertEqual(stats.disposableDetections, 1, 'One detection');
    });

    test('resetStats clears statistics', () => {
      const verifier = new EmailDomainVerifier();
      verifier.checkDisposable('user@tempmail.com');
      verifier.resetStats();
      const stats = verifier.getStats();
      assertEqual(stats.disposableDetections, 0, 'Stats reset');
    });

    test('clearCache clears DNS cache', () => {
      const verifier = new EmailDomainVerifier();
      verifier.cache.set('test', { data: 'test' });
      verifier.clearCache();
      assertEqual(verifier.cache.cache.size, 0, 'Cache cleared');
    });

    // Test DISPOSABLE_EMAIL_DOMAINS constant
    test('DISPOSABLE_EMAIL_DOMAINS is a Set', () => {
      assertTrue(DISPOSABLE_EMAIL_DOMAINS instanceof Set, 'Is a Set');
      assertTrue(DISPOSABLE_EMAIL_DOMAINS.size > 100, 'Has many entries');
      assertTrue(DISPOSABLE_EMAIL_DOMAINS.has('tempmail.com'), 'Has tempmail.com');
      assertTrue(DISPOSABLE_EMAIL_DOMAINS.has('mailinator.com'), 'Has mailinator.com');
    });

    // Test EMAIL_TYPO_CORRECTIONS constant
    test('EMAIL_TYPO_CORRECTIONS has common typos', () => {
      assertTrue(EMAIL_TYPO_CORRECTIONS['gmial.com'] === 'gmail.com', 'Gmail typo');
      assertTrue(EMAIL_TYPO_CORRECTIONS['yaho.com'] === 'yahoo.com', 'Yahoo typo');
      assertTrue(EMAIL_TYPO_CORRECTIONS['hotmal.com'] === 'hotmail.com', 'Hotmail typo');
    });
  });
}

// =============================================================================
// Investigation Context Tests
// =============================================================================

function runInvestigationContextTests() {
  describe('Investigation Context Tests', () => {
    if (typeof InvestigationContext === 'undefined' && typeof startInvestigation === 'undefined') {
      skip('Investigation Context tests', 'InvestigationContext module not loaded');
      return;
    }

    // Use module exports directly if available
    const IC = typeof InvestigationContext !== 'undefined' ? InvestigationContext : {
      InvestigationConfig,
      InvestigationStatus,
      EntityRelationType,
      startInvestigation,
      switchInvestigation,
      endInvestigation,
      getCurrentInvestigation,
      getAllInvestigations,
      withInvestigationContext,
      linkEntityToInvestigation,
      unlinkEntityFromInvestigation,
      executeInvestigationCommand
    };

    test('InvestigationStatus enum has correct values', () => {
      assertEqual(IC.InvestigationStatus.ACTIVE, 'active', 'ACTIVE');
      assertEqual(IC.InvestigationStatus.PAUSED, 'paused', 'PAUSED');
      assertEqual(IC.InvestigationStatus.COMPLETED, 'completed', 'COMPLETED');
      assertEqual(IC.InvestigationStatus.ARCHIVED, 'archived', 'ARCHIVED');
    });

    test('EntityRelationType enum has correct values', () => {
      assertEqual(IC.EntityRelationType.TARGET, 'target', 'TARGET');
      assertEqual(IC.EntityRelationType.RELATED, 'related', 'RELATED');
      assertEqual(IC.EntityRelationType.DISCOVERED, 'discovered', 'DISCOVERED');
      assertEqual(IC.EntityRelationType.LINKED, 'linked', 'LINKED');
      assertEqual(IC.EntityRelationType.ALIAS, 'alias', 'ALIAS');
      assertEqual(IC.EntityRelationType.ASSOCIATED, 'associated', 'ASSOCIATED');
      assertEqual(IC.EntityRelationType.COMMUNICATION, 'communication', 'COMMUNICATION');
      assertEqual(IC.EntityRelationType.FINANCIAL, 'financial', 'FINANCIAL');
      assertEqual(IC.EntityRelationType.LOCATION, 'location', 'LOCATION');
    });

    test('InvestigationConfig has expected settings', () => {
      assertTrue(IC.InvestigationConfig.MAX_CONCURRENT_INVESTIGATIONS > 0, 'Has max concurrent');
      assertTrue(IC.InvestigationConfig.MAX_ENTITY_LINKS_PER_INVESTIGATION > 0, 'Has max entity links');
      assertTrue(IC.InvestigationConfig.MAX_HISTORY_ENTRIES > 0, 'Has max history');
    });

    asyncTest('startInvestigation creates new investigation', async () => {
      const result = await IC.startInvestigation('test-inv-1', {
        name: 'Test Investigation',
        description: 'A test investigation',
        caseNumber: 'CASE-001'
      });
      assertTrue(result.success, 'Start succeeds');
      assertEqual(result.investigationId, 'test-inv-1', 'Correct ID');
      assertTrue(result.context !== undefined, 'Has context');
      assertEqual(result.context.status, IC.InvestigationStatus.ACTIVE, 'Status is active');
    });

    asyncTest('startInvestigation fails without ID', async () => {
      const result = await IC.startInvestigation(null);
      assertFalse(result.success, 'Start fails');
      assertTrue(result.error !== undefined, 'Has error');
    });

    asyncTest('startInvestigation fails for duplicate ID', async () => {
      // First, ensure test-inv-dup exists
      await IC.startInvestigation('test-inv-dup', { name: 'Dup Test' });
      // Try to create again
      const result = await IC.startInvestigation('test-inv-dup', { name: 'Dup Test 2' });
      assertFalse(result.success, 'Duplicate fails');
      assertTrue(result.error.includes('already exists'), 'Error mentions exists');
    });

    asyncTest('switchInvestigation changes active investigation', async () => {
      // Create two investigations
      await IC.startInvestigation('test-inv-switch-1', { name: 'Switch Test 1' });
      await IC.startInvestigation('test-inv-switch-2', { name: 'Switch Test 2' });

      // Switch to first one
      const result = await IC.switchInvestigation('test-inv-switch-1');
      assertTrue(result.success, 'Switch succeeds');
      assertEqual(result.investigationId, 'test-inv-switch-1', 'Switched to correct ID');
      assertEqual(result.previousInvestigationId, 'test-inv-switch-2', 'Tracked previous');
    });

    asyncTest('switchInvestigation fails for non-existent investigation', async () => {
      const result = await IC.switchInvestigation('non-existent-id');
      assertFalse(result.success, 'Switch fails');
      assertTrue(result.error.includes('not found'), 'Error mentions not found');
    });

    asyncTest('endInvestigation completes investigation', async () => {
      await IC.startInvestigation('test-inv-end', { name: 'End Test' });
      const result = await IC.endInvestigation('test-inv-end', {
        summary: 'Investigation complete',
        status: IC.InvestigationStatus.COMPLETED
      });
      assertTrue(result.success, 'End succeeds');
      assertTrue(result.summary !== undefined, 'Has summary');
      assertEqual(result.summary.status, IC.InvestigationStatus.COMPLETED, 'Status is completed');
    });

    asyncTest('endInvestigation fails for non-existent investigation', async () => {
      const result = await IC.endInvestigation('non-existent-end');
      assertFalse(result.success, 'End fails');
      assertTrue(result.error.includes('not found'), 'Error mentions not found');
    });

    asyncTest('getCurrentInvestigation returns active investigation', async () => {
      await IC.startInvestigation('test-inv-current', { name: 'Current Test' });
      const current = await IC.getCurrentInvestigation();
      assertTrue(current !== null, 'Has current');
      assertEqual(current.id, 'test-inv-current', 'Correct ID');
    });

    asyncTest('getAllInvestigations returns list', async () => {
      await IC.startInvestigation('test-inv-all-1', { name: 'All Test 1' });
      const all = await IC.getAllInvestigations();
      assertTrue(Array.isArray(all), 'Returns array');
      assertTrue(all.length >= 1, 'Has at least one');
    });

    asyncTest('linkEntityToInvestigation adds entity link', async () => {
      await IC.startInvestigation('test-inv-link', { name: 'Link Test' });
      const result = await IC.linkEntityToInvestigation(
        'test-inv-link',
        'entity-123',
        IC.EntityRelationType.TARGET,
        { source: 'manual' }
      );
      assertTrue(result.success, 'Link succeeds');
      assertEqual(result.entityId, 'entity-123', 'Correct entity ID');
      assertEqual(result.relationType, IC.EntityRelationType.TARGET, 'Correct relation type');
    });

    asyncTest('linkEntityToInvestigation fails without IDs', async () => {
      const result = await IC.linkEntityToInvestigation(null, 'entity-1');
      assertFalse(result.success, 'Fails without investigation ID');

      const result2 = await IC.linkEntityToInvestigation('inv-1', null);
      assertFalse(result2.success, 'Fails without entity ID');
    });

    asyncTest('unlinkEntityFromInvestigation removes entity', async () => {
      await IC.startInvestigation('test-inv-unlink', { name: 'Unlink Test' });
      await IC.linkEntityToInvestigation('test-inv-unlink', 'entity-unlink');

      const result = await IC.unlinkEntityFromInvestigation('test-inv-unlink', 'entity-unlink');
      assertTrue(result.success, 'Unlink succeeds');
    });

    asyncTest('withInvestigationContext wraps command data', async () => {
      await IC.startInvestigation('test-inv-wrap', { name: 'Wrap Test', caseNumber: 'CASE-WRAP' });
      const wrapped = await IC.withInvestigationContext('test_command', { data: 'test' });

      assertEqual(wrapped.command, 'test_command', 'Command preserved');
      assertTrue(wrapped.context.has_context, 'Has context');
      assertEqual(wrapped.data.investigation_id, 'test-inv-wrap', 'Has investigation ID');
      assertTrue(wrapped.data.investigation_context !== undefined, 'Has investigation context');
    });

    asyncTest('withInvestigationContext handles no active investigation', async () => {
      // End all active investigations first
      const all = await IC.getAllInvestigations({ status: IC.InvestigationStatus.ACTIVE });
      for (const inv of all) {
        await IC.endInvestigation(inv.id);
      }

      const wrapped = await IC.withInvestigationContext('test_command', { data: 'test' });
      assertFalse(wrapped.context.has_context, 'No context when no active');
    });

    // Test MCP command execution
    asyncTest('executeInvestigationCommand - set_investigation_context', async () => {
      const result = await IC.executeInvestigationCommand('set_investigation_context', {
        investigation_id: 'test-mcp-inv',
        metadata: { name: 'MCP Test' }
      });
      assertTrue(result.success, 'Command succeeds');
      assertTrue(result.action === 'created' || result.action === 'switched', 'Created or switched');
    });

    asyncTest('executeInvestigationCommand - get_investigation_context', async () => {
      await IC.startInvestigation('test-mcp-get', { name: 'MCP Get Test' });
      const result = await IC.executeInvestigationCommand('get_investigation_context', {});
      assertTrue(result.success, 'Command succeeds');
      assertTrue(result.has_active_investigation !== undefined, 'Has active flag');
    });

    asyncTest('executeInvestigationCommand - link_entity_to_investigation', async () => {
      await IC.startInvestigation('test-mcp-link', { name: 'MCP Link Test' });
      const result = await IC.executeInvestigationCommand('link_entity_to_investigation', {
        entity_id: 'entity-mcp',
        relation_type: IC.EntityRelationType.DISCOVERED
      });
      assertTrue(result.success, 'Command succeeds');
      assertEqual(result.entityId, 'entity-mcp', 'Entity linked');
    });

    asyncTest('executeInvestigationCommand - unknown command', async () => {
      const result = await IC.executeInvestigationCommand('unknown_command', {});
      assertFalse(result.success, 'Unknown command fails');
      assertTrue(result.error.includes('Unknown command'), 'Error mentions unknown');
      assertTrue(Array.isArray(result.available_commands), 'Lists available commands');
    });
  });
}

// =============================================================================
// Entity Form Filler Tests
// =============================================================================

function runEntityFormFillerTests() {
  describe('Entity Form Filler Tests', () => {
    if (typeof EntityFormFiller === 'undefined') {
      skip('Entity Form Filler tests', 'EntityFormFiller module not loaded');
      return;
    }

    test('EntityFormFiller constructor with defaults', () => {
      const filler = new EntityFormFiller();
      assertEqual(filler.config.apiBaseUrl, 'http://localhost:8000', 'Default API URL');
      assertTrue(filler.config.simulateTyping, 'Typing simulation on');
      assertTrue(filler.config.verifyAfterFill, 'Verification on');
    });

    test('EntityFormFiller constructor with options', () => {
      const filler = new EntityFormFiller({
        apiBaseUrl: 'http://custom:9000',
        simulateTyping: false,
        typingDelay: 50
      });
      assertEqual(filler.config.apiBaseUrl, 'http://custom:9000', 'Custom API URL');
      assertFalse(filler.config.simulateTyping, 'Typing simulation off');
      assertEqual(filler.config.typingDelay, 50, 'Custom delay');
    });

    // Test EntityFieldMappings
    test('EntityFieldMappings has expected field mappings', () => {
      assertTrue(EntityFieldMappings.firstName !== undefined, 'Has firstName');
      assertTrue(EntityFieldMappings.lastName !== undefined, 'Has lastName');
      assertTrue(EntityFieldMappings.email !== undefined, 'Has email');
      assertTrue(EntityFieldMappings.phone !== undefined, 'Has phone');
      assertTrue(EntityFieldMappings.address !== undefined, 'Has address');
      assertTrue(EntityFieldMappings.username !== undefined, 'Has username');
      assertTrue(EntityFieldMappings.password !== undefined, 'Has password');
      assertTrue(EntityFieldMappings.totp !== undefined, 'Has totp');
    });

    test('EntityFieldMappings fields have correct structure', () => {
      const emailMapping = EntityFieldMappings.email;
      assertTrue(Array.isArray(emailMapping.formPatterns), 'Has form patterns');
      assertTrue(Array.isArray(emailMapping.autocomplete), 'Has autocomplete');
      assertTrue(Array.isArray(emailMapping.inputTypes), 'Has input types');
      assertTrue(emailMapping.priority > 0, 'Has priority');
    });

    // Test FieldNameNormalizations
    test('FieldNameNormalizations has common variations', () => {
      assertEqual(FieldNameNormalizations['firstname'], 'firstName', 'firstname');
      assertEqual(FieldNameNormalizations['first_name'], 'firstName', 'first_name');
      assertEqual(FieldNameNormalizations['lastname'], 'lastName', 'lastname');
      assertEqual(FieldNameNormalizations['emailaddress'], 'email', 'emailaddress');
      assertEqual(FieldNameNormalizations['telephone'], 'phone', 'telephone');
      assertEqual(FieldNameNormalizations['postalcode'], 'zipCode', 'postalcode');
    });

    // Test _normalizeFieldName
    test('EntityFormFiller normalizes field names', () => {
      const filler = new EntityFormFiller();
      assertEqual(filler._normalizeFieldName('first_name'), 'firstName', 'Normalized first_name');
      assertEqual(filler._normalizeFieldName('FirstName'), 'firstName', 'Normalized FirstName');
      assertEqual(filler._normalizeFieldName('FIRST-NAME'), 'firstName', 'Normalized FIRST-NAME');
    });

    // Test splitAddress
    test('splitAddress parses full address', () => {
      const filler = new EntityFormFiller();
      const result = filler.splitAddress('123 Main St, Suite 100, New York, NY 10001');

      assertTrue(result.address !== '', 'Has address');
      assertTrue(result.city !== '' || result.state !== '', 'Has city or state');
    });

    test('splitAddress handles empty input', () => {
      const filler = new EntityFormFiller();
      const result = filler.splitAddress('');

      assertEqual(result.address, '', 'Empty address');
      assertEqual(result.city, '', 'Empty city');
      assertEqual(result.state, '', 'Empty state');
    });

    test('splitAddress handles null input', () => {
      const filler = new EntityFormFiller();
      const result = filler.splitAddress(null);

      assertEqual(result.address, '', 'Empty address');
    });

    // Test _extractEntityData
    test('EntityFormFiller extracts entity data', () => {
      const filler = new EntityFormFiller();
      const entity = {
        data: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        }
      };
      const extracted = filler._extractEntityData(entity);
      assertEqual(extracted.firstName, 'John', 'firstName extracted');
      assertEqual(extracted.lastName, 'Doe', 'lastName extracted');
    });

    // Test _buildSockPuppetEntityData
    test('EntityFormFiller builds sock puppet entity data', () => {
      const filler = new EntityFormFiller();
      const sockPuppet = {
        name: 'John Doe',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '555-1234',
        username: 'johndoe',
        password: 'secret123'
      };

      const data = filler._buildSockPuppetEntityData(sockPuppet, true);
      assertEqual(data.fullName, 'John Doe', 'fullName');
      assertEqual(data.firstName, 'John', 'firstName');
      assertEqual(data.email, 'john@example.com', 'email');
      assertEqual(data.username, 'johndoe', 'username included');
      assertEqual(data.password, 'secret123', 'password included');
    });

    test('EntityFormFiller builds sock puppet data without credentials', () => {
      const filler = new EntityFormFiller();
      const sockPuppet = {
        name: 'John Doe',
        username: 'johndoe',
        password: 'secret123'
      };

      const data = filler._buildSockPuppetEntityData(sockPuppet, false);
      assertEqual(data.fullName, 'John Doe', 'fullName');
      assertEqual(data.username, undefined, 'username excluded');
      assertEqual(data.password, undefined, 'password excluded');
    });

    // Test _maskSensitiveValue
    test('EntityFormFiller masks sensitive values', () => {
      const filler = new EntityFormFiller();
      const masked = filler._maskSensitiveValue('password', 'secret123');
      assertEqual(masked, '*********', 'Password masked');

      const notMasked = filler._maskSensitiveValue('email', 'user@example.com');
      assertEqual(notMasked, 'user@example.com', 'Email not masked');
    });

    test('EntityFormFiller masks TOTP values', () => {
      const filler = new EntityFormFiller();
      const masked = filler._maskSensitiveValue('totp', '123456');
      assertEqual(masked, '******', 'TOTP masked');
    });

    // Test statistics
    test('getStats returns fill statistics', () => {
      const filler = new EntityFormFiller();
      const stats = filler.getStats();
      assertEqual(stats.totalFills, 0, 'Initial total');
      assertEqual(stats.successfulFills, 0, 'Initial successful');
      assertEqual(stats.failedFills, 0, 'Initial failed');
    });

    test('resetStats clears statistics', () => {
      const filler = new EntityFormFiller();
      filler.stats.totalFills = 10;
      filler.resetStats();
      const stats = filler.getStats();
      assertEqual(stats.totalFills, 0, 'Stats reset');
    });

    // Test MCP command handlers
    test('handleMapEntityToForm requires entityData', () => {
      if (typeof handleMapEntityToForm === 'undefined') {
        skip('handleMapEntityToForm', 'Function not exported');
        return;
      }
      const result = handleMapEntityToForm({});
      assertFalse(result.success, 'Fails without entityData');
      assertTrue(result.error.includes('entityData'), 'Error mentions entityData');
    });

    asyncTest('handleFillFormWithEntity requires entityId', async () => {
      if (typeof handleFillFormWithEntity === 'undefined') {
        skip('handleFillFormWithEntity', 'Function not exported');
        return;
      }
      const result = await handleFillFormWithEntity({});
      assertFalse(result.success, 'Fails without entityId');
      assertTrue(result.error.includes('entityId'), 'Error mentions entityId');
    });

    asyncTest('handleFillFormWithSockPuppet requires sockPuppetId', async () => {
      if (typeof handleFillFormWithSockPuppet === 'undefined') {
        skip('handleFillFormWithSockPuppet', 'Function not exported');
        return;
      }
      const result = await handleFillFormWithSockPuppet({});
      assertFalse(result.success, 'Fails without sockPuppetId');
      assertTrue(result.error.includes('sockPuppetId'), 'Error mentions sockPuppetId');
    });

    asyncTest('handleFillFormWithData requires data', async () => {
      if (typeof handleFillFormWithData === 'undefined') {
        skip('handleFillFormWithData', 'Function not exported');
        return;
      }
      const result = await handleFillFormWithData({});
      assertFalse(result.success, 'Fails without data');
      assertTrue(result.error.includes('data'), 'Error mentions data');
    });

    // Test getEntityFormFiller singleton
    test('getEntityFormFiller returns singleton', () => {
      if (typeof getEntityFormFiller === 'undefined') {
        skip('getEntityFormFiller', 'Function not exported');
        return;
      }
      const filler1 = getEntityFormFiller();
      const filler2 = getEntityFormFiller();
      assertTrue(filler1 === filler2, 'Same instance');
    });

    test('resetEntityFormFiller resets singleton', () => {
      if (typeof resetEntityFormFiller === 'undefined') {
        skip('resetEntityFormFiller', 'Function not exported');
        return;
      }
      const filler1 = getEntityFormFiller();
      resetEntityFormFiller();
      const filler2 = getEntityFormFiller();
      assertFalse(filler1 === filler2, 'Different instance after reset');
    });
  });
}

// =============================================================================
// Test Runner
// =============================================================================

async function runAllTests() {
  console.log('Starting Phase 11-13 Feature Tests...\n');
  console.log('================================================');

  // Run all test suites
  runAnnotationToolsTests();
  runBlockchainVerifierTests();
  runPhoneVerifierTests();
  runEmailDomainVerifierTests();
  await runInvestigationContextTests();
  runEntityFormFillerTests();

  // Print summary
  console.log('\n================================================');
  console.log('Test Summary:');
  console.log(`  Passed: ${testResults.passed}`);
  console.log(`  Failed: ${testResults.failed}`);
  console.log(`  Skipped: ${testResults.skipped}`);
  console.log(`  Total: ${testResults.passed + testResults.failed + testResults.skipped}`);
  console.log('================================================\n');

  if (testResults.failed > 0) {
    console.log('Failed tests:');
    testResults.tests
      .filter(t => t.status === 'failed')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
    console.log('');
  }

  return testResults;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    runAnnotationToolsTests,
    runBlockchainVerifierTests,
    runPhoneVerifierTests,
    runEmailDomainVerifierTests,
    runInvestigationContextTests,
    runEntityFormFillerTests,
    testResults
  };
}

// Auto-run if in browser environment with modules loaded
if (typeof window !== 'undefined') {
  // Check if key modules are loaded
  const modulesLoaded = typeof AnnotationTools !== 'undefined' ||
                        typeof BlockchainVerifier !== 'undefined' ||
                        typeof PhoneVerifier !== 'undefined' ||
                        typeof EmailDomainVerifier !== 'undefined';

  if (modulesLoaded) {
    runAllTests().then(results => {
      window.phase11_13_testResults = results;
    });
  }
}
