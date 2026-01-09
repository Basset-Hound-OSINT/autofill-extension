/**
 * Unit Tests for Phase 15.2: History & Analytics Features
 *
 * Tests for:
 * - IngestHistory class
 * - DetectionAnalytics class
 * - EntityGraph class
 */

// Mock chrome.storage.local for testing
global.chrome = {
  storage: {
    local: {
      data: {},
      get: function(key, callback) {
        const result = {};
        if (Array.isArray(key)) {
          key.forEach(k => {
            result[k] = this.data[k];
          });
        } else {
          result[key] = this.data[key];
        }
        if (callback) callback(result);
        return Promise.resolve(result);
      },
      set: function(items, callback) {
        Object.assign(this.data, items);
        if (callback) callback();
        return Promise.resolve();
      },
      clear: function(callback) {
        this.data = {};
        if (callback) callback();
        return Promise.resolve();
      },
      getBytesInUse: function(key, callback) {
        const size = JSON.stringify(this.data[key] || {}).length;
        if (callback) callback(size);
        return Promise.resolve(size);
      }
    }
  }
};

// Import modules (assuming Node.js environment for tests)
const { IngestHistory, IngestEventType, IngestStatus, HISTORY_CONFIG } = require('../../utils/devtools/ingest-history.js');
const { DetectionAnalytics, ANALYTICS_CONFIG, PatternCategory } = require('../../utils/devtools/detection-analytics.js');
const { EntityGraph, RelationType, GRAPH_CONFIG } = require('../../utils/devtools/entity-graph-mini.js');

describe('Phase 15.2: Ingest History & Analytics', () => {

  // =============================================================================
  // IngestHistory Tests
  // =============================================================================

  describe('IngestHistory', () => {
    let history;

    beforeEach(async () => {
      chrome.storage.local.data = {};
      history = new IngestHistory();
      await history._init();
    });

    test('should initialize with empty history', () => {
      expect(history.items).toEqual([]);
      expect(history.stats.totalIngested).toBe(0);
      expect(history.version).toBe(HISTORY_CONFIG.VERSION);
    });

    test('should add history item', async () => {
      const item = {
        type: 'email',
        value: 'test@example.com',
        status: IngestStatus.SUCCESS,
        pageUrl: 'https://example.com',
        confidence: 0.95
      };

      const result = await history.addItem(item);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('timestamp');
      expect(result.type).toBe('email');
      expect(result.value).toBe('test@example.com');
      expect(history.items.length).toBe(1);
      expect(history.stats.totalIngested).toBe(1);
      expect(history.stats.totalSuccess).toBe(1);
    });

    test('should add multiple items', async () => {
      const items = [
        { type: 'email', value: 'user1@test.com', status: IngestStatus.SUCCESS },
        { type: 'phone', value: '555-1234', status: IngestStatus.SUCCESS },
        { type: 'crypto_btc', value: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', status: IngestStatus.FAILED }
      ];

      const results = await history.addBatch(items);

      expect(results.length).toBe(3);
      expect(history.items.length).toBe(3);
      expect(history.stats.totalIngested).toBe(3);
      expect(history.stats.totalSuccess).toBe(2);
      expect(history.stats.totalFailed).toBe(1);
    });

    test('should update stats correctly', async () => {
      await history.addItem({ type: 'email', value: 'test1@example.com', status: IngestStatus.SUCCESS });
      await history.addItem({ type: 'email', value: 'test2@example.com', status: IngestStatus.SUCCESS });
      await history.addItem({ type: 'phone', value: '555-0000', status: IngestStatus.FAILED });

      expect(history.stats.totalIngested).toBe(3);
      expect(history.stats.totalSuccess).toBe(2);
      expect(history.stats.totalFailed).toBe(1);
      expect(history.stats.byType.email).toBe(2);
      expect(history.stats.byType.phone).toBe(1);
    });

    test('should filter items by type', async () => {
      await history.addItem({ type: 'email', value: 'test@example.com', status: IngestStatus.SUCCESS });
      await history.addItem({ type: 'phone', value: '555-1234', status: IngestStatus.SUCCESS });
      await history.addItem({ type: 'email', value: 'another@example.com', status: IngestStatus.SUCCESS });

      const result = history.getItems({ type: 'email' });

      expect(result.items.length).toBe(2);
      expect(result.items.every(item => item.type === 'email')).toBe(true);
    });

    test('should filter items by status', async () => {
      await history.addItem({ type: 'email', value: 'test1@example.com', status: IngestStatus.SUCCESS });
      await history.addItem({ type: 'email', value: 'test2@example.com', status: IngestStatus.FAILED });
      await history.addItem({ type: 'email', value: 'test3@example.com', status: IngestStatus.SUCCESS });

      const result = history.getItems({ status: IngestStatus.SUCCESS });

      expect(result.items.length).toBe(2);
      expect(result.items.every(item => item.status === IngestStatus.SUCCESS)).toBe(true);
    });

    test('should filter items by date range', async () => {
      const now = Date.now();
      const yesterday = now - (24 * 60 * 60 * 1000);

      await history.addItem({ type: 'email', value: 'old@example.com', status: IngestStatus.SUCCESS });
      history.items[0].timestamp = yesterday;

      await history.addItem({ type: 'email', value: 'new@example.com', status: IngestStatus.SUCCESS });

      const result = history.getItems({ startDate: new Date(now - 1000).toISOString() });

      expect(result.items.length).toBe(1);
      expect(result.items[0].value).toBe('new@example.com');
    });

    test('should search items', async () => {
      await history.addItem({ type: 'email', value: 'john@example.com', status: IngestStatus.SUCCESS });
      await history.addItem({ type: 'email', value: 'jane@example.com', status: IngestStatus.SUCCESS });
      await history.addItem({ type: 'email', value: 'bob@test.com', status: IngestStatus.SUCCESS });

      const result = history.getItems({ search: 'john' });

      expect(result.items.length).toBe(1);
      expect(result.items[0].value).toBe('john@example.com');
    });

    test('should paginate results', async () => {
      // Add 10 items
      for (let i = 0; i < 10; i++) {
        await history.addItem({ type: 'email', value: `user${i}@example.com`, status: IngestStatus.SUCCESS });
      }

      const page1 = history.getItems({ page: 1, limit: 5 });
      const page2 = history.getItems({ page: 2, limit: 5 });

      expect(page1.items.length).toBe(5);
      expect(page2.items.length).toBe(5);
      expect(page1.total).toBe(10);
      expect(page1.pages).toBe(2);
      expect(page1.items[0].value).not.toBe(page2.items[0].value);
    });

    test('should update existing item', async () => {
      const item = await history.addItem({
        type: 'email',
        value: 'test@example.com',
        status: IngestStatus.SUCCESS,
        notes: 'Original note'
      });

      const updated = await history.updateItem(item.id, {
        notes: 'Updated note',
        verified: true
      });

      expect(updated.notes).toBe('Updated note');
      expect(updated.verified).toBe(true);
      expect(updated.id).toBe(item.id);
    });

    test('should delete item', async () => {
      const item = await history.addItem({ type: 'email', value: 'test@example.com', status: IngestStatus.SUCCESS });

      await history.deleteItem(item.id);

      expect(history.items.length).toBe(0);
      expect(history.stats.totalIngested).toBe(0);
    });

    test('should clear all history', async () => {
      await history.addItem({ type: 'email', value: 'test1@example.com', status: IngestStatus.SUCCESS });
      await history.addItem({ type: 'email', value: 'test2@example.com', status: IngestStatus.SUCCESS });

      const count = await history.clearAll();

      expect(count).toBe(2);
      expect(history.items.length).toBe(0);
      expect(history.stats.totalIngested).toBe(0);
    });

    test('should export to JSON', async () => {
      await history.addItem({ type: 'email', value: 'test@example.com', status: IngestStatus.SUCCESS });
      await history.addItem({ type: 'phone', value: '555-1234', status: IngestStatus.SUCCESS });

      const exported = history.exportJSON();

      expect(exported).toHaveProperty('version');
      expect(exported).toHaveProperty('exportDate');
      expect(exported).toHaveProperty('items');
      expect(exported.items.length).toBe(2);
      expect(exported.itemCount).toBe(2);
    });

    test('should export to CSV', async () => {
      await history.addItem({ type: 'email', value: 'test@example.com', status: IngestStatus.SUCCESS });

      const csv = history.exportCSV();

      expect(typeof csv).toBe('string');
      expect(csv).toContain('ID,Timestamp');
      expect(csv).toContain('test@example.com');
      expect(csv).toContain('email');
    });

    test('should persist to storage', async () => {
      await history.addItem({ type: 'email', value: 'test@example.com', status: IngestStatus.SUCCESS });
      await history.save();

      const storedData = await chrome.storage.local.get(HISTORY_CONFIG.STORAGE_KEY);
      const data = storedData[HISTORY_CONFIG.STORAGE_KEY];

      expect(data).toBeDefined();
      expect(data.items.length).toBe(1);
      expect(data.items[0].value).toBe('test@example.com');
    });

    test('should load from storage', async () => {
      // Setup storage with data
      await chrome.storage.local.set({
        [HISTORY_CONFIG.STORAGE_KEY]: {
          version: '1.0',
          items: [{ id: 'test_123', type: 'email', value: 'stored@example.com', timestamp: Date.now() }],
          stats: { totalIngested: 1 },
          lastUpdated: Date.now()
        }
      });

      // Create new history instance
      const newHistory = new IngestHistory();
      await newHistory._init();

      expect(newHistory.items.length).toBe(1);
      expect(newHistory.items[0].value).toBe('stored@example.com');
    });
  });

  // =============================================================================
  // DetectionAnalytics Tests
  // =============================================================================

  describe('DetectionAnalytics', () => {
    let history;
    let analytics;

    beforeEach(async () => {
      chrome.storage.local.data = {};
      history = new IngestHistory();
      await history._init();
      analytics = new DetectionAnalytics(history);

      // Add sample data
      await history.addItem({ type: 'email', value: 'test1@example.com', status: IngestStatus.SUCCESS, pageUrl: 'https://example.com', confidence: 0.95 });
      await history.addItem({ type: 'email', value: 'test2@example.com', status: IngestStatus.SUCCESS, pageUrl: 'https://example.com', confidence: 0.90 });
      await history.addItem({ type: 'phone', value: '555-1234', status: IngestStatus.SUCCESS, pageUrl: 'https://test.com', confidence: 0.85 });
      await history.addItem({ type: 'crypto_btc', value: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', status: IngestStatus.FAILED, pageUrl: 'https://example.com', confidence: 0.70 });
    });

    test('should generate summary', () => {
      const summary = analytics.getSummary();

      expect(summary.totalDetections).toBe(4);
      expect(parseFloat(summary.successRate)).toBeGreaterThan(0);
      expect(summary.uniquePages).toBe(2);
      expect(summary.uniqueTypes).toBe(3);
    });

    test('should count by type', () => {
      const counts = analytics.getCountsByType();

      expect(counts.types.length).toBe(3);
      expect(counts.types.find(t => t.type === 'email').count).toBe(2);
      expect(counts.types.find(t => t.type === 'phone').count).toBe(1);
      expect(counts.types.find(t => t.type === 'crypto_btc').count).toBe(1);
    });

    test('should count by category', () => {
      const counts = analytics.getCountsByCategory();

      expect(counts.length).toBeGreaterThan(0);
      expect(counts.some(c => c.category === 'IDENTITY')).toBe(true);
      expect(counts.some(c => c.category === 'CRYPTO')).toBe(true);
    });

    test('should get status distribution', () => {
      const distribution = analytics.getStatusDistribution();

      const success = distribution.find(d => d.status === IngestStatus.SUCCESS);
      const failed = distribution.find(d => d.status === IngestStatus.FAILED);

      expect(success.count).toBe(3);
      expect(failed.count).toBe(1);
    });

    test('should get top pages', () => {
      const topPages = analytics.getTopPages(5);

      expect(topPages.length).toBe(2);
      expect(topPages[0].count).toBeGreaterThan(0);
      expect(topPages[0]).toHaveProperty('url');
      expect(topPages[0]).toHaveProperty('domain');
    });

    test('should get top domains', () => {
      const topDomains = analytics.getTopDomains(5);

      expect(topDomains.length).toBe(2);
      expect(topDomains.some(d => d.domain === 'example.com')).toBe(true);
    });

    test('should calculate trend', () => {
      const trend = analytics.getTrend('day', 7);

      expect(trend).toHaveProperty('dataPoints');
      expect(trend).toHaveProperty('summary');
      expect(trend.summary.total).toBe(4);
    });

    test('should get confidence distribution', () => {
      const distribution = analytics.getConfidenceDistribution();

      expect(distribution.length).toBeGreaterThan(0);
      expect(distribution.every(d => d.hasOwnProperty('range'))).toBe(true);
      expect(distribution.every(d => d.hasOwnProperty('count'))).toBe(true);
    });

    test('should generate chart data', () => {
      const chartData = analytics.getChartData('type-distribution');

      expect(chartData).toHaveProperty('type');
      expect(chartData).toHaveProperty('labels');
      expect(chartData).toHaveProperty('datasets');
    });
  });

  // =============================================================================
  // EntityGraph Tests
  // =============================================================================

  describe('EntityGraph', () => {
    let container;
    let graph;

    beforeEach(() => {
      // Create mock container
      container = {
        innerHTML: '',
        appendChild: jest.fn(),
        clientWidth: 600,
        clientHeight: 400
      };
    });

    test('should initialize graph', () => {
      graph = new EntityGraph(container);

      expect(graph.nodes).toEqual([]);
      expect(graph.links).toEqual([]);
      expect(graph.container).toBe(container);
    });

    test('should build graph from history', () => {
      graph = new EntityGraph(container);

      const historyItems = [
        { type: 'email', value: 'test@example.com', pageUrl: 'https://example.com', timestamp: Date.now() },
        { type: 'email', value: 'another@example.com', pageUrl: 'https://example.com', timestamp: Date.now() },
        { type: 'phone', value: '555-1234', pageUrl: 'https://example.com', timestamp: Date.now() }
      ];

      graph.buildFromHistory(historyItems);

      expect(graph.nodes.length).toBeGreaterThan(0);
    });

    test('should create email-domain links', () => {
      graph = new EntityGraph(container);

      const historyItems = [
        { type: 'email', value: 'user@example.com', pageUrl: 'https://example.com', timestamp: Date.now() }
      ];

      graph.buildFromHistory(historyItems);

      // Should have email node and domain node
      expect(graph.nodes.some(n => n.type === 'email')).toBe(true);
      expect(graph.nodes.some(n => n.type === 'domain')).toBe(true);

      // Should have link between them
      expect(graph.links.length).toBeGreaterThan(0);
    });

    test('should clear graph', () => {
      graph = new EntityGraph(container);

      const historyItems = [
        { type: 'email', value: 'test@example.com', pageUrl: 'https://example.com', timestamp: Date.now() }
      ];

      graph.buildFromHistory(historyItems);
      expect(graph.nodes.length).toBeGreaterThan(0);

      graph.clear();
      expect(graph.nodes.length).toBe(0);
      expect(graph.links.length).toBe(0);
    });
  });
});

// Run tests if executed directly
if (require.main === module) {
  console.log('Running Phase 15.2 tests...');
  // Note: In actual testing, use Jest or similar test runner
}
