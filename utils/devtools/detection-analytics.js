/**
 * Basset Hound Browser Automation - Detection Analytics
 * Phase 15.2: History & Analytics Features
 *
 * Provides analytics and statistics for OSINT detection patterns.
 * Generates insights from ingestion history for visualization.
 *
 * Features:
 * - Detection counts by pattern type
 * - Trend analysis over time
 * - Success/failure rates
 * - Most detected patterns
 * - Page-level statistics
 * - Format validation analytics
 * - Time-based grouping (hour, day, week, month)
 * - Chart data preparation for visualization
 */

// =============================================================================
// Constants & Configuration
// =============================================================================

const ANALYTICS_CONFIG = {
  TIME_BUCKETS: {
    HOUR: 'hour',
    DAY: 'day',
    WEEK: 'week',
    MONTH: 'month'
  },
  TOP_N_LIMIT: 10,               // Top N items for rankings
  TREND_WINDOW_DAYS: 30,         // Days to include in trend analysis
  MIN_CONFIDENCE_THRESHOLD: 0.7  // Minimum confidence for "valid" detection
};

/**
 * Pattern type categories for grouping
 */
const PatternCategory = {
  IDENTITY: ['email', 'phone', 'phone_intl', 'ssn'],
  CRYPTO: ['crypto_btc', 'crypto_eth', 'crypto_ltc', 'crypto_xrp', 'crypto_doge', 'crypto_bch', 'crypto_sol'],
  NETWORK: ['ip_v4', 'ip_v6', 'ip_v6_compressed', 'domain', 'mac'],
  SOCIAL: ['username_twitter', 'username_instagram', 'username_github', 'username_reddit'],
  FINANCIAL: ['credit_card', 'iban', 'routing_number'],
  DEVICE: ['imei', 'imsi', 'serial_number']
};

// =============================================================================
// DetectionAnalytics Class
// =============================================================================

/**
 * Analytics engine for OSINT detection data
 */
class DetectionAnalytics {
  constructor(ingestHistory) {
    this.history = ingestHistory;
  }

  /**
   * Get overall analytics summary
   */
  getSummary() {
    const stats = this.history.getStats();
    const items = this.history.items;

    return {
      totalDetections: stats.totalIngested,
      successRate: stats.totalIngested > 0
        ? (stats.totalSuccess / stats.totalIngested * 100).toFixed(2)
        : 0,
      failureRate: stats.totalIngested > 0
        ? (stats.totalFailed / stats.totalIngested * 100).toFixed(2)
        : 0,
      verifiedCount: items.filter(i => i.verified).length,
      verificationRate: items.length > 0
        ? (items.filter(i => i.verified).length / items.length * 100).toFixed(2)
        : 0,
      uniquePages: Object.keys(stats.byPage).length,
      uniqueTypes: Object.keys(stats.byType).length,
      avgConfidence: this._calculateAverageConfidence(items),
      timeRange: {
        first: stats.firstIngestion,
        last: stats.lastIngestion,
        days: stats.firstIngestion
          ? Math.ceil((stats.lastIngestion - stats.firstIngestion) / (24 * 60 * 60 * 1000))
          : 0
      }
    };
  }

  /**
   * Get detection counts by pattern type
   */
  getCountsByType() {
    const stats = this.history.getStats();
    const byType = stats.byType;

    // Convert to array and sort by count
    const sorted = Object.entries(byType)
      .map(([type, count]) => ({
        type,
        count,
        percentage: stats.totalIngested > 0
          ? ((count / stats.totalIngested) * 100).toFixed(2)
          : 0,
        category: this._getPatternCategory(type)
      }))
      .sort((a, b) => b.count - a.count);

    return {
      types: sorted,
      topTypes: sorted.slice(0, ANALYTICS_CONFIG.TOP_N_LIMIT)
    };
  }

  /**
   * Get detection counts by category
   */
  getCountsByCategory() {
    const byType = this.history.getStats().byType;
    const byCategory = {};

    for (const [type, count] of Object.entries(byType)) {
      const category = this._getPatternCategory(type);
      byCategory[category] = (byCategory[category] || 0) + count;
    }

    const total = Object.values(byCategory).reduce((sum, count) => sum + count, 0);

    return Object.entries(byCategory)
      .map(([category, count]) => ({
        category,
        count,
        percentage: total > 0 ? ((count / total) * 100).toFixed(2) : 0
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get status distribution
   */
  getStatusDistribution() {
    const stats = this.history.getStats();
    const byStatus = stats.byStatus;
    const total = stats.totalIngested;

    return Object.entries(byStatus)
      .map(([status, count]) => ({
        status,
        count,
        percentage: total > 0 ? ((count / total) * 100).toFixed(2) : 0
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get top pages by detection count
   */
  getTopPages(limit = ANALYTICS_CONFIG.TOP_N_LIMIT) {
    const stats = this.history.getStats();
    const byPage = stats.byPage;

    return Object.entries(byPage)
      .map(([url, count]) => ({
        url,
        count,
        domain: this._extractDomain(url),
        percentage: stats.totalIngested > 0
          ? ((count / stats.totalIngested) * 100).toFixed(2)
          : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get top domains by detection count
   */
  getTopDomains(limit = ANALYTICS_CONFIG.TOP_N_LIMIT) {
    const byPage = this.history.getStats().byPage;
    const byDomain = {};

    for (const [url, count] of Object.entries(byPage)) {
      const domain = this._extractDomain(url);
      byDomain[domain] = (byDomain[domain] || 0) + count;
    }

    const total = Object.values(byDomain).reduce((sum, count) => sum + count, 0);

    return Object.entries(byDomain)
      .map(([domain, count]) => ({
        domain,
        count,
        percentage: total > 0 ? ((count / total) * 100).toFixed(2) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get trend data over time
   */
  getTrend(bucket = ANALYTICS_CONFIG.TIME_BUCKETS.DAY, days = ANALYTICS_CONFIG.TREND_WINDOW_DAYS) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const items = this.history.items.filter(i => i.timestamp >= cutoff);

    const buckets = {};

    for (const item of items) {
      const bucketKey = this._getBucketKey(item.timestamp, bucket);
      if (!buckets[bucketKey]) {
        buckets[bucketKey] = {
          timestamp: bucketKey,
          total: 0,
          success: 0,
          failed: 0,
          skipped: 0,
          verified: 0,
          byType: {}
        };
      }

      buckets[bucketKey].total++;
      buckets[bucketKey][item.status]++;

      if (item.verified) {
        buckets[bucketKey].verified++;
      }

      buckets[bucketKey].byType[item.type] = (buckets[bucketKey].byType[item.type] || 0) + 1;
    }

    // Convert to sorted array
    const trend = Object.values(buckets).sort((a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    return {
      bucket,
      days,
      dataPoints: trend,
      summary: {
        total: items.length,
        avgPerBucket: trend.length > 0 ? (items.length / trend.length).toFixed(2) : 0,
        peakValue: Math.max(...trend.map(t => t.total), 0),
        peakDate: trend.length > 0
          ? trend.reduce((max, t) => t.total > max.total ? t : max).timestamp
          : null
      }
    };
  }

  /**
   * Get confidence score distribution
   */
  getConfidenceDistribution() {
    const items = this.history.items.filter(i => i.confidence !== null);

    const buckets = {
      'High (>0.9)': 0,
      'Good (0.8-0.9)': 0,
      'Medium (0.7-0.8)': 0,
      'Low (<0.7)': 0
    };

    for (const item of items) {
      const conf = item.confidence;
      if (conf > 0.9) buckets['High (>0.9)']++;
      else if (conf >= 0.8) buckets['Good (0.8-0.9)']++;
      else if (conf >= 0.7) buckets['Medium (0.7-0.8)']++;
      else buckets['Low (<0.7)']++;
    }

    return Object.entries(buckets).map(([range, count]) => ({
      range,
      count,
      percentage: items.length > 0 ? ((count / items.length) * 100).toFixed(2) : 0
    }));
  }

  /**
   * Get most common values (for duplicate detection)
   */
  getMostCommonValues(type = null, limit = ANALYTICS_CONFIG.TOP_N_LIMIT) {
    let items = this.history.items;

    if (type) {
      items = items.filter(i => i.type === type);
    }

    const valueCounts = {};

    for (const item of items) {
      if (item.value) {
        valueCounts[item.value] = (valueCounts[item.value] || 0) + 1;
      }
    }

    return Object.entries(valueCounts)
      .map(([value, count]) => ({
        value,
        count,
        type: type || 'all',
        percentage: items.length > 0 ? ((count / items.length) * 100).toFixed(2) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get detection rate over time (detections per hour/day)
   */
  getDetectionRate(bucket = ANALYTICS_CONFIG.TIME_BUCKETS.DAY) {
    const trend = this.getTrend(bucket, 30);
    const rates = [];

    for (let i = 1; i < trend.dataPoints.length; i++) {
      const current = trend.dataPoints[i];
      const previous = trend.dataPoints[i - 1];

      const change = current.total - previous.total;
      const changePercent = previous.total > 0
        ? ((change / previous.total) * 100).toFixed(2)
        : 0;

      rates.push({
        timestamp: current.timestamp,
        count: current.total,
        change,
        changePercent,
        trend: change > 0 ? 'increasing' : change < 0 ? 'decreasing' : 'stable'
      });
    }

    return rates;
  }

  /**
   * Get verification analytics
   */
  getVerificationAnalytics() {
    const items = this.history.items;
    const verified = items.filter(i => i.verified);
    const withResult = verified.filter(i => i.verificationResult !== null);

    const byType = {};
    const byResult = {};

    for (const item of verified) {
      byType[item.type] = (byType[item.type] || 0) + 1;

      if (item.verificationResult) {
        const resultKey = item.verificationResult.valid ? 'valid' : 'invalid';
        byResult[resultKey] = (byResult[resultKey] || 0) + 1;
      }
    }

    return {
      totalVerified: verified.length,
      verificationRate: items.length > 0
        ? ((verified.length / items.length) * 100).toFixed(2)
        : 0,
      withResults: withResult.length,
      validCount: byResult.valid || 0,
      invalidCount: byResult.invalid || 0,
      validRate: withResult.length > 0
        ? (((byResult.valid || 0) / withResult.length) * 100).toFixed(2)
        : 0,
      byType: Object.entries(byType)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
    };
  }

  /**
   * Get session analytics
   */
  getSessionAnalytics() {
    const items = this.history.items;
    const withSession = items.filter(i => i.sessionId);

    const bySession = {};

    for (const item of withSession) {
      if (!bySession[item.sessionId]) {
        bySession[item.sessionId] = {
          sessionId: item.sessionId,
          caseId: item.caseId,
          count: 0,
          byType: {},
          firstDetection: item.timestamp,
          lastDetection: item.timestamp
        };
      }

      const session = bySession[item.sessionId];
      session.count++;
      session.byType[item.type] = (session.byType[item.type] || 0) + 1;

      if (item.timestamp < session.firstDetection) {
        session.firstDetection = item.timestamp;
      }
      if (item.timestamp > session.lastDetection) {
        session.lastDetection = item.timestamp;
      }
    }

    const sessions = Object.values(bySession).sort((a, b) => b.count - a.count);

    return {
      totalSessions: sessions.length,
      itemsWithSession: withSession.length,
      itemsWithoutSession: items.length - withSession.length,
      avgItemsPerSession: sessions.length > 0
        ? (withSession.length / sessions.length).toFixed(2)
        : 0,
      sessions: sessions.slice(0, ANALYTICS_CONFIG.TOP_N_LIMIT)
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    const items = this.history.items;
    const stats = this.history.getStats();

    // Calculate time between detections
    const sortedByTime = [...items].sort((a, b) => a.timestamp - b.timestamp);
    const intervals = [];

    for (let i = 1; i < sortedByTime.length; i++) {
      intervals.push(sortedByTime[i].timestamp - sortedByTime[i - 1].timestamp);
    }

    const avgInterval = intervals.length > 0
      ? intervals.reduce((sum, i) => sum + i, 0) / intervals.length
      : 0;

    return {
      totalDetections: items.length,
      timeSpan: stats.lastIngestion - stats.firstIngestion,
      avgDetectionInterval: avgInterval,
      detectionsPerDay: stats.lastIngestion && stats.firstIngestion
        ? (items.length / ((stats.lastIngestion - stats.firstIngestion) / (24 * 60 * 60 * 1000))).toFixed(2)
        : 0,
      peakDetectionsInDay: this._getPeakDetectionsInDay(),
      successRate: stats.totalIngested > 0
        ? ((stats.totalSuccess / stats.totalIngested) * 100).toFixed(2)
        : 0
    };
  }

  /**
   * Prepare chart data for visualization
   */
  getChartData(type, options = {}) {
    switch (type) {
      case 'type-distribution':
        return this._prepareTypeDistributionChart();

      case 'category-distribution':
        return this._prepareCategoryDistributionChart();

      case 'trend':
        return this._prepareTrendChart(options.bucket, options.days);

      case 'status-distribution':
        return this._prepareStatusDistributionChart();

      case 'confidence-distribution':
        return this._prepareConfidenceDistributionChart();

      case 'top-pages':
        return this._prepareTopPagesChart(options.limit);

      case 'top-domains':
        return this._prepareTopDomainsChart(options.limit);

      case 'verification':
        return this._prepareVerificationChart();

      default:
        throw new Error(`Unknown chart type: ${type}`);
    }
  }

  // =============================================================================
  // Chart Data Preparation Methods
  // =============================================================================

  _prepareTypeDistributionChart() {
    const data = this.getCountsByType();

    return {
      type: 'pie',
      labels: data.topTypes.map(t => t.type),
      datasets: [{
        data: data.topTypes.map(t => t.count),
        backgroundColor: this._generateColors(data.topTypes.length)
      }]
    };
  }

  _prepareCategoryDistributionChart() {
    const data = this.getCountsByCategory();

    return {
      type: 'doughnut',
      labels: data.map(c => c.category),
      datasets: [{
        data: data.map(c => c.count),
        backgroundColor: this._generateColors(data.length)
      }]
    };
  }

  _prepareTrendChart(bucket, days) {
    const trend = this.getTrend(bucket, days);

    return {
      type: 'line',
      labels: trend.dataPoints.map(t => this._formatDateLabel(t.timestamp, bucket)),
      datasets: [
        {
          label: 'Total Detections',
          data: trend.dataPoints.map(t => t.total),
          borderColor: '#3794ff',
          backgroundColor: 'rgba(55, 148, 255, 0.1)',
          fill: true
        },
        {
          label: 'Success',
          data: trend.dataPoints.map(t => t.success),
          borderColor: '#73c991',
          backgroundColor: 'rgba(115, 201, 145, 0.1)',
          fill: false
        },
        {
          label: 'Failed',
          data: trend.dataPoints.map(t => t.failed),
          borderColor: '#f14c4c',
          backgroundColor: 'rgba(241, 76, 76, 0.1)',
          fill: false
        }
      ]
    };
  }

  _prepareStatusDistributionChart() {
    const data = this.getStatusDistribution();

    return {
      type: 'bar',
      labels: data.map(s => s.status),
      datasets: [{
        label: 'Count',
        data: data.map(s => s.count),
        backgroundColor: data.map(s => this._getStatusColor(s.status))
      }]
    };
  }

  _prepareConfidenceDistributionChart() {
    const data = this.getConfidenceDistribution();

    return {
      type: 'bar',
      labels: data.map(d => d.range),
      datasets: [{
        label: 'Count',
        data: data.map(d => d.count),
        backgroundColor: ['#73c991', '#75beff', '#cca700', '#f48771']
      }]
    };
  }

  _prepareTopPagesChart(limit) {
    const data = this.getTopPages(limit);

    return {
      type: 'horizontalBar',
      labels: data.map(p => this._truncateUrl(p.url, 30)),
      datasets: [{
        label: 'Detections',
        data: data.map(p => p.count),
        backgroundColor: '#3794ff'
      }]
    };
  }

  _prepareTopDomainsChart(limit) {
    const data = this.getTopDomains(limit);

    return {
      type: 'horizontalBar',
      labels: data.map(d => d.domain),
      datasets: [{
        label: 'Detections',
        data: data.map(d => d.count),
        backgroundColor: '#75beff'
      }]
    };
  }

  _prepareVerificationChart() {
    const data = this.getVerificationAnalytics();

    return {
      type: 'doughnut',
      labels: ['Valid', 'Invalid', 'Not Verified'],
      datasets: [{
        data: [
          data.validCount,
          data.invalidCount,
          this.history.items.length - data.totalVerified
        ],
        backgroundColor: ['#73c991', '#f14c4c', '#6c6c6c']
      }]
    };
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  _getPatternCategory(type) {
    for (const [category, types] of Object.entries(PatternCategory)) {
      if (types.includes(type)) {
        return category;
      }
    }
    return 'OTHER';
  }

  _calculateAverageConfidence(items) {
    const withConfidence = items.filter(i => i.confidence !== null);
    if (withConfidence.length === 0) return null;

    const sum = withConfidence.reduce((acc, i) => acc + i.confidence, 0);
    return (sum / withConfidence.length).toFixed(3);
  }

  _extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return url;
    }
  }

  _getBucketKey(timestamp, bucket) {
    const date = new Date(timestamp);

    switch (bucket) {
      case ANALYTICS_CONFIG.TIME_BUCKETS.HOUR:
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()).toISOString();

      case ANALYTICS_CONFIG.TIME_BUCKETS.DAY:
        return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().split('T')[0];

      case ANALYTICS_CONFIG.TIME_BUCKETS.WEEK:
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().split('T')[0];

      case ANALYTICS_CONFIG.TIME_BUCKETS.MONTH:
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      default:
        return date.toISOString().split('T')[0];
    }
  }

  _formatDateLabel(timestamp, bucket) {
    const date = new Date(timestamp);

    switch (bucket) {
      case ANALYTICS_CONFIG.TIME_BUCKETS.HOUR:
        return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' });

      case ANALYTICS_CONFIG.TIME_BUCKETS.DAY:
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      case ANALYTICS_CONFIG.TIME_BUCKETS.WEEK:
        return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

      case ANALYTICS_CONFIG.TIME_BUCKETS.MONTH:
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      default:
        return date.toLocaleDateString();
    }
  }

  _getPeakDetectionsInDay() {
    const byDate = this.history.getStats().byDate;
    if (Object.keys(byDate).length === 0) return 0;

    return Math.max(...Object.values(byDate));
  }

  _generateColors(count) {
    const colors = [
      '#3794ff', '#73c991', '#f48771', '#cca700', '#75beff',
      '#ce9178', '#569cd6', '#9cdcfe', '#c586c0', '#4ec9b0'
    ];

    return Array.from({ length: count }, (_, i) => colors[i % colors.length]);
  }

  _getStatusColor(status) {
    const colors = {
      success: '#73c991',
      failed: '#f14c4c',
      pending: '#cca700',
      skipped: '#6c6c6c',
      verified: '#75beff'
    };

    return colors[status] || '#cccccc';
  }

  _truncateUrl(url, maxLength) {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  }
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DetectionAnalytics,
    ANALYTICS_CONFIG,
    PatternCategory
  };
}
