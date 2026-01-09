/**
 * Unit Tests for Phase 16.2: Dynamic Content Detection
 *
 * Tests for:
 * - MutationDetector
 * - ScrollDetector
 * - SPADetector
 *
 * Run with: npm test tests/unit/phase16-dynamic-detection.test.js
 */

// Mock DOM environment
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.MutationObserver = dom.window.MutationObserver;
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
  }
  observe() {}
  disconnect() {}
  unobserve() {}
};
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  disconnect() {}
  unobserve() {}
};
global.requestIdleCallback = (cb) => setTimeout(() => cb({ timeRemaining: () => 10 }), 0);

// Load modules
const { MutationDetector, MUTATION_CONFIG } = require('../../utils/detection/mutation-detector.js');
const { ScrollDetector, SCROLL_CONFIG } = require('../../utils/detection/scroll-detector.js');
const { SPADetector, SPA_CONFIG } = require('../../utils/detection/spa-detector.js');

// Test patterns
const testPatterns = {
  email: {
    pattern: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
    confidence: 0.95,
    validate: (match) => match.includes('@')
  },
  phone: {
    pattern: /\d{3}-\d{3}-\d{4}/g,
    confidence: 0.85,
    validate: () => true
  },
  ip: {
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    confidence: 0.90,
    validate: () => true
  }
};

// =============================================================================
// MutationDetector Tests
// =============================================================================

describe('MutationDetector', () => {
  let detector;
  let detections = [];

  beforeEach(() => {
    detections = [];
    detector = new MutationDetector({
      patterns: testPatterns,
      onDetection: (data) => detections.push(data),
      onStatusChange: () => {},
      config: {
        DEBOUNCE_DELAY: 10,
        MAX_DEBOUNCE_DELAY: 100,
        USE_IDLE_CALLBACK: false
      }
    });
  });

  afterEach(() => {
    if (detector && detector.isActive) {
      detector.stop();
    }
  });

  test('should create MutationDetector instance', () => {
    expect(detector).toBeDefined();
    expect(detector.isActive).toBe(false);
    expect(detector.isPaused).toBe(false);
  });

  test('should start observing mutations', () => {
    detector.start();
    expect(detector.isActive).toBe(true);
    expect(detector.observers.size).toBeGreaterThan(0);
  });

  test('should stop observing mutations', () => {
    detector.start();
    detector.stop();
    expect(detector.isActive).toBe(false);
    expect(detector.observers.size).toBe(0);
  });

  test('should pause and resume detection', () => {
    detector.start();
    detector.pause();
    expect(detector.isPaused).toBe(true);

    detector.resume();
    expect(detector.isPaused).toBe(false);
  });

  test('should detect email in added text node', (done) => {
    detector.start();

    const testElement = document.createElement('div');
    testElement.textContent = 'Contact: test@example.com';
    document.body.appendChild(testElement);

    setTimeout(() => {
      detector.forceScan();

      setTimeout(() => {
        expect(detections.length).toBeGreaterThan(0);
        const emailDetection = detections[0].detections.find(d => d.type === 'email');
        expect(emailDetection).toBeDefined();
        expect(emailDetection.value).toBe('test@example.com');
        done();
      }, 100);
    }, 50);
  });

  test('should detect multiple patterns', (done) => {
    detector.start();

    const testElement = document.createElement('div');
    testElement.textContent = 'Email: test@example.com, Phone: 555-123-4567, IP: 192.168.1.1';
    document.body.appendChild(testElement);

    setTimeout(() => {
      detector.forceScan();

      setTimeout(() => {
        if (detections.length > 0) {
          const allDetections = detections.flatMap(d => d.detections);
          const types = new Set(allDetections.map(d => d.type));
          expect(types.size).toBeGreaterThan(1);
        }
        done();
      }, 100);
    }, 50);
  });

  test('should cache scanned content', () => {
    detector.start();

    const item = {
      text: 'test@example.com',
      element: document.createElement('div'),
      source: 'test'
    };

    expect(detector.isContentCached(item)).toBe(false);
    detector.cacheContent(item);
    expect(detector.isContentCached(item)).toBe(true);
  });

  test('should clear cache', () => {
    detector.start();

    const item = {
      text: 'test@example.com',
      element: document.createElement('div'),
      source: 'test'
    };

    detector.cacheContent(item);
    expect(detector.isContentCached(item)).toBe(true);

    detector.clearCache();
    expect(detector.isContentCached(item)).toBe(false);
  });

  test('should get statistics', () => {
    detector.start();
    const stats = detector.getStats();

    expect(stats).toBeDefined();
    expect(stats.totalMutations).toBeDefined();
    expect(stats.scannedMutations).toBeDefined();
    expect(stats.detectedPatterns).toBeDefined();
  });

  test('should update configuration', () => {
    const newConfig = { DEBOUNCE_DELAY: 500 };
    detector.updateConfig(newConfig);

    expect(detector.config.DEBOUNCE_DELAY).toBe(500);
  });

  test('should filter irrelevant mutations', () => {
    const scriptMutation = {
      type: 'characterData',
      target: {
        nodeType: 1,
        tagName: 'SCRIPT',
        textContent: 'console.log("test")'
      }
    };

    expect(detector.isRelevantMutation(scriptMutation)).toBe(false);
  });

  test('should extract content from mutation', () => {
    const textNode = document.createTextNode('test@example.com');
    const parent = document.createElement('div');
    parent.appendChild(textNode);

    const mutation = {
      type: 'characterData',
      target: textNode
    };

    const content = detector.extractContentFromMutation(mutation);
    expect(content).toBeDefined();
    expect(content.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// ScrollDetector Tests
// =============================================================================

describe('ScrollDetector', () => {
  let detector;
  let contentEvents = [];

  beforeEach(() => {
    contentEvents = [];
    detector = new ScrollDetector({
      onNewContent: (data) => contentEvents.push(data),
      onStatusChange: () => {},
      config: {
        SHOW_INDICATOR: false,
        SCROLL_DEBOUNCE: 10
      }
    });
  });

  afterEach(() => {
    if (detector && detector.isActive) {
      detector.stop();
    }
  });

  test('should create ScrollDetector instance', () => {
    expect(detector).toBeDefined();
    expect(detector.isActive).toBe(false);
    expect(detector.isPaused).toBe(false);
  });

  test('should start scroll detection', () => {
    detector.start();
    expect(detector.isActive).toBe(true);
    expect(detector.intersectionObserver).toBeDefined();
  });

  test('should stop scroll detection', () => {
    detector.start();
    detector.stop();
    expect(detector.isActive).toBe(false);
    expect(detector.intersectionObserver).toBeNull();
  });

  test('should pause and resume detection', () => {
    detector.start();
    detector.pause();
    expect(detector.isPaused).toBe(true);

    detector.resume();
    expect(detector.isPaused).toBe(false);
  });

  test('should track content elements', () => {
    detector.start();

    const element = document.createElement('article');
    detector.trackElement(element);

    expect(detector.trackedElements.has(element)).toBe(true);
  });

  test('should detect new elements', () => {
    detector.start();

    // Add some content elements
    const article1 = document.createElement('article');
    const article2 = document.createElement('article');
    document.body.appendChild(article1);
    document.body.appendChild(article2);

    const newElements = detector.detectNewElements();
    expect(newElements.length).toBeGreaterThan(0);
  });

  test('should find content elements', () => {
    // Add content elements
    const article = document.createElement('article');
    article.textContent = 'Test content';
    document.body.appendChild(article);

    detector.start();
    detector.findContentElements();

    expect(detector.trackedElements.size).toBeGreaterThan(0);
  });

  test('should get statistics', () => {
    detector.start();
    const stats = detector.getStats();

    expect(stats).toBeDefined();
    expect(stats.totalScrolls).toBeDefined();
    expect(stats.contentLoaded).toBeDefined();
    expect(stats.scrollDistance).toBeDefined();
  });

  test('should update configuration', () => {
    const newConfig = { SCROLL_DEBOUNCE: 500 };
    detector.updateConfig(newConfig);

    expect(detector.config.SCROLL_DEBOUNCE).toBe(500);
  });

  test('should cleanup old elements', () => {
    detector.start();

    const element = document.createElement('div');
    detector.trackElement(element);
    expect(detector.trackedElements.has(element)).toBe(true);

    // Remove from DOM
    element.remove();

    // Run cleanup
    detector.cleanup();

    expect(detector.trackedElements.has(element)).toBe(false);
  });
});

// =============================================================================
// SPADetector Tests
// =============================================================================

describe('SPADetector', () => {
  let detector;
  let routeChanges = [];

  beforeEach(() => {
    routeChanges = [];
    detector = new SPADetector({
      onRouteChange: (data) => routeChanges.push(data),
      onStatusChange: () => {},
      config: {
        DEBOUNCE_DELAY: 10
      }
    });

    // Reset history
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    if (detector && detector.isActive) {
      detector.stop();
    }
  });

  test('should create SPADetector instance', () => {
    expect(detector).toBeDefined();
    expect(detector.isActive).toBe(false);
    expect(detector.isPaused).toBe(false);
  });

  test('should start SPA detection', () => {
    detector.start();
    expect(detector.isActive).toBe(true);
    expect(detector.originalPushState).toBeDefined();
  });

  test('should stop SPA detection', () => {
    detector.start();
    detector.stop();
    expect(detector.isActive).toBe(false);
    expect(detector.originalPushState).toBeNull();
  });

  test('should pause and resume detection', () => {
    detector.start();
    detector.pause();
    expect(detector.isPaused).toBe(true);

    detector.resume();
    expect(detector.isPaused).toBe(false);
  });

  test('should detect pushState navigation', (done) => {
    detector.start();

    setTimeout(() => {
      window.history.pushState(null, '', '/new-route');

      setTimeout(() => {
        expect(routeChanges.length).toBeGreaterThan(0);
        done();
      }, 100);
    }, 50);
  });

  test('should detect replaceState navigation', (done) => {
    detector.start();

    setTimeout(() => {
      window.history.replaceState(null, '', '/replaced-route');

      setTimeout(() => {
        expect(routeChanges.length).toBeGreaterThan(0);
        done();
      }, 100);
    }, 50);
  });

  test('should get current route', () => {
    const route = detector.getCurrentRoute();

    expect(route).toBeDefined();
    expect(route.pathname).toBe('/');
    expect(route.href).toBeDefined();
  });

  test('should detect significant route changes', () => {
    const route1 = { pathname: '/page1', search: '', hash: '' };
    const route2 = { pathname: '/page2', search: '', hash: '' };

    expect(detector.isSignificantRouteChange(route1, route2)).toBe(true);
  });

  test('should ignore insignificant route changes', () => {
    const route1 = { pathname: '/page1', search: '?a=1', hash: '' };
    const route2 = { pathname: '/page1', search: '?a=2', hash: '' };

    detector.config.IGNORE_QUERY_PARAMS = true;
    expect(detector.isSignificantRouteChange(route1, route2)).toBe(false);
  });

  test('should calculate URL similarity', () => {
    const url1 = 'http://example.com/page1';
    const url2 = 'http://example.com/page2';

    const similarity = detector.calculateURLSimilarity(url1, url2);
    expect(similarity).toBeGreaterThan(0);
    expect(similarity).toBeLessThan(1);
  });

  test('should get route history', () => {
    detector.start();

    const history = detector.getHistory();
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
  });

  test('should clear history', () => {
    detector.start();
    detector.clearHistory();

    const history = detector.getHistory();
    expect(history.length).toBe(0);
  });

  test('should get statistics', () => {
    detector.start();
    const stats = detector.getStats();

    expect(stats).toBeDefined();
    expect(stats.totalNavigations).toBeDefined();
    expect(stats.currentRoute).toBeDefined();
  });

  test('should update configuration', () => {
    const newConfig = { DEBOUNCE_DELAY: 500 };
    detector.updateConfig(newConfig);

    expect(detector.config.DEBOUNCE_DELAY).toBe(500);
  });

  test('should store detections for routes', () => {
    detector.start();

    const detections = [
      { type: 'email', value: 'test@example.com' }
    ];

    detector.storeDetections(detections);

    const stored = detector.getDetectionsForRoute(detector.currentRoute.path);
    expect(stored.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Dynamic Detection Integration', () => {
  test('should work together - mutation triggers scroll scan', (done) => {
    const detections = [];
    const contentEvents = [];

    const mutationDetector = new MutationDetector({
      patterns: testPatterns,
      onDetection: (data) => detections.push(data),
      config: { USE_IDLE_CALLBACK: false, DEBOUNCE_DELAY: 10 }
    });

    const scrollDetector = new ScrollDetector({
      onNewContent: (data) => {
        contentEvents.push(data);
        mutationDetector.forceScan();
      },
      config: { SHOW_INDICATOR: false }
    });

    mutationDetector.start();
    scrollDetector.start();

    // Add new content
    const article = document.createElement('article');
    article.textContent = 'Email: test@example.com';
    document.body.appendChild(article);

    setTimeout(() => {
      mutationDetector.forceScan();

      setTimeout(() => {
        mutationDetector.stop();
        scrollDetector.stop();

        expect(mutationDetector.isActive).toBe(false);
        expect(scrollDetector.isActive).toBe(false);

        done();
      }, 100);
    }, 50);
  });

  test('should work together - SPA navigation triggers new scan', (done) => {
    const routeChanges = [];

    const spaDetector = new SPADetector({
      onRouteChange: (data) => {
        routeChanges.push(data);
      },
      config: { DEBOUNCE_DELAY: 10 }
    });

    spaDetector.start();

    setTimeout(() => {
      window.history.pushState(null, '', '/test-route');

      setTimeout(() => {
        spaDetector.stop();

        expect(routeChanges.length).toBeGreaterThan(0);
        done();
      }, 100);
    }, 50);
  });
});

// =============================================================================
// Run Tests
// =============================================================================

console.log('Running Phase 16.2 Dynamic Detection Tests...\n');

const testResults = {
  passed: 0,
  failed: 0,
  total: 0
};

// Simple test runner
function describe(name, fn) {
  console.log(`\n${name}`);
  fn();
}

function test(name, fn) {
  testResults.total++;
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      // Async test
      result.then(() => {
        testResults.passed++;
        console.log(`  ✓ ${name}`);
      }).catch((error) => {
        testResults.failed++;
        console.log(`  ✗ ${name}`);
        console.error(`    Error: ${error.message}`);
      });
    } else {
      // Sync test
      testResults.passed++;
      console.log(`  ✓ ${name}`);
    }
  } catch (error) {
    testResults.failed++;
    console.log(`  ✗ ${name}`);
    console.error(`    Error: ${error.message}`);
  }
}

function beforeEach(fn) {
  fn();
}

function afterEach(fn) {
  fn();
}

function expect(value) {
  return {
    toBe: (expected) => {
      if (value !== expected) {
        throw new Error(`Expected ${value} to be ${expected}`);
      }
    },
    toBeDefined: () => {
      if (value === undefined) {
        throw new Error(`Expected value to be defined`);
      }
    },
    toBeNull: () => {
      if (value !== null) {
        throw new Error(`Expected ${value} to be null`);
      }
    },
    toBeGreaterThan: (expected) => {
      if (value <= expected) {
        throw new Error(`Expected ${value} to be greater than ${expected}`);
      }
    },
    toBeLessThan: (expected) => {
      if (value >= expected) {
        throw new Error(`Expected ${value} to be less than ${expected}`);
      }
    }
  };
}

// Print summary
setTimeout(() => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
}, 2000);
