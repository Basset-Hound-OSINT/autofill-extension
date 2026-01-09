/**
 * Basset Hound Browser Automation - Advanced Analytics Dashboard
 * Phase 19: Analytics & Intelligence
 *
 * Comprehensive analytics dashboard providing real-time metrics, KPIs, and
 * interactive visualizations for investigation insights and patterns.
 *
 * Features:
 * - Real-time metrics and KPIs
 * - Interactive charts and graphs
 * - Date range filtering
 * - Custom dashboard layouts
 * - Performance analytics
 * - Investigation analytics
 * - Team collaboration analytics
 * - Export analytics to CSV/PDF
 *
 * Dependencies: None (uses lightweight vanilla JavaScript for visualizations)
 */

// =============================================================================
// Constants & Configuration
// =============================================================================

const DASHBOARD_CONFIG = {
  REFRESH_INTERVAL: 5000,        // Auto-refresh every 5 seconds
  MAX_DATA_POINTS: 1000,         // Maximum data points to display
  CHART_COLORS: {
    primary: '#3794ff',
    success: '#73c991',
    warning: '#f48771',
    error: '#f14c4c',
    info: '#75beff',
    neutral: '#6c6c6c'
  },
  DATE_RANGES: {
    TODAY: 'today',
    YESTERDAY: 'yesterday',
    LAST_7_DAYS: 'last_7_days',
    LAST_30_DAYS: 'last_30_days',
    LAST_90_DAYS: 'last_90_days',
    THIS_MONTH: 'this_month',
    LAST_MONTH: 'last_month',
    CUSTOM: 'custom'
  },
  WIDGET_TYPES: {
    METRIC: 'metric',
    CHART: 'chart',
    TABLE: 'table',
    TIMELINE: 'timeline',
    HEATMAP: 'heatmap',
    GRAPH: 'graph'
  },
  EXPORT_FORMATS: {
    CSV: 'csv',
    JSON: 'json',
    PDF: 'pdf'
  }
};

// =============================================================================
// AnalyticsDashboard Class
// =============================================================================

/**
 * Main analytics dashboard controller
 */
class AnalyticsDashboard {
  constructor(dataSource) {
    this.dataSource = dataSource; // IngestHistory or other data source
    this.widgets = new Map();
    this.layouts = new Map();
    this.activeLayout = 'default';
    this.dateRange = this._getDateRange(DASHBOARD_CONFIG.DATE_RANGES.LAST_7_DAYS);
    this.filters = {};
    this.refreshTimer = null;
    this.listeners = [];

    // Initialize default layout
    this._initDefaultLayouts();
  }

  /**
   * Initialize dashboard
   */
  async init() {
    console.log('[AnalyticsDashboard] Initializing...');

    // Load saved preferences
    await this._loadPreferences();

    // Setup auto-refresh
    this.startAutoRefresh();

    // Initial data load
    await this.refresh();

    console.log('[AnalyticsDashboard] Initialized successfully');
  }

  /**
   * Initialize default dashboard layouts
   */
  _initDefaultLayouts() {
    // Overview Dashboard
    this.layouts.set('default', {
      id: 'default',
      name: 'Overview',
      description: 'General overview of investigations',
      widgets: [
        { id: 'total-detections', type: 'metric', position: { row: 0, col: 0, width: 3, height: 1 } },
        { id: 'success-rate', type: 'metric', position: { row: 0, col: 3, width: 3, height: 1 } },
        { id: 'active-investigations', type: 'metric', position: { row: 0, col: 6, width: 3, height: 1 } },
        { id: 'avg-investigation-time', type: 'metric', position: { row: 0, col: 9, width: 3, height: 1 } },
        { id: 'detection-trend', type: 'chart', position: { row: 1, col: 0, width: 6, height: 3 } },
        { id: 'type-distribution', type: 'chart', position: { row: 1, col: 6, width: 6, height: 3 } },
        { id: 'top-pages', type: 'table', position: { row: 4, col: 0, width: 6, height: 2 } },
        { id: 'recent-activity', type: 'timeline', position: { row: 4, col: 6, width: 6, height: 2 } }
      ]
    });

    // Investigation Analytics
    this.layouts.set('investigations', {
      id: 'investigations',
      name: 'Investigations',
      description: 'Investigation-specific analytics',
      widgets: [
        { id: 'total-cases', type: 'metric', position: { row: 0, col: 0, width: 4, height: 1 } },
        { id: 'open-cases', type: 'metric', position: { row: 0, col: 4, width: 4, height: 1 } },
        { id: 'closed-cases', type: 'metric', position: { row: 0, col: 8, width: 4, height: 1 } },
        { id: 'case-timeline', type: 'timeline', position: { row: 1, col: 0, width: 12, height: 3 } },
        { id: 'case-status-distribution', type: 'chart', position: { row: 4, col: 0, width: 6, height: 2 } },
        { id: 'case-priority-distribution', type: 'chart', position: { row: 4, col: 6, width: 6, height: 2 } }
      ]
    });

    // Pattern Analysis
    this.layouts.set('patterns', {
      id: 'patterns',
      name: 'Pattern Analysis',
      description: 'Pattern detection and analysis',
      widgets: [
        { id: 'pattern-count', type: 'metric', position: { row: 0, col: 0, width: 3, height: 1 } },
        { id: 'unique-patterns', type: 'metric', position: { row: 0, col: 3, width: 3, height: 1 } },
        { id: 'pattern-confidence', type: 'metric', position: { row: 0, col: 6, width: 3, height: 1 } },
        { id: 'anomalies', type: 'metric', position: { row: 0, col: 9, width: 3, height: 1 } },
        { id: 'pattern-heatmap', type: 'heatmap', position: { row: 1, col: 0, width: 8, height: 4 } },
        { id: 'pattern-network', type: 'graph', position: { row: 1, col: 8, width: 4, height: 4 } }
      ]
    });

    // Team Analytics
    this.layouts.set('team', {
      id: 'team',
      name: 'Team Performance',
      description: 'Team collaboration and productivity',
      widgets: [
        { id: 'team-members', type: 'metric', position: { row: 0, col: 0, width: 3, height: 1 } },
        { id: 'team-activity', type: 'metric', position: { row: 0, col: 3, width: 3, height: 1 } },
        { id: 'avg-response-time', type: 'metric', position: { row: 0, col: 6, width: 3, height: 1 } },
        { id: 'collaboration-score', type: 'metric', position: { row: 0, col: 9, width: 3, height: 1 } },
        { id: 'team-activity-chart', type: 'chart', position: { row: 1, col: 0, width: 8, height: 3 } },
        { id: 'team-leaderboard', type: 'table', position: { row: 1, col: 8, width: 4, height: 3 } }
      ]
    });
  }

  /**
   * Get metrics data
   */
  async getMetrics() {
    const data = await this._getFilteredData();

    return {
      totalDetections: this._calculateTotalDetections(data),
      successRate: this._calculateSuccessRate(data),
      activeInvestigations: this._calculateActiveInvestigations(data),
      avgInvestigationTime: this._calculateAvgInvestigationTime(data),
      totalCases: this._calculateTotalCases(data),
      openCases: this._calculateOpenCases(data),
      closedCases: this._calculateClosedCases(data),
      patternCount: this._calculatePatternCount(data),
      uniquePatterns: this._calculateUniquePatterns(data),
      patternConfidence: this._calculateAvgPatternConfidence(data),
      anomalies: this._calculateAnomalies(data),
      teamMembers: this._calculateTeamMembers(data),
      teamActivity: this._calculateTeamActivity(data),
      avgResponseTime: this._calculateAvgResponseTime(data),
      collaborationScore: this._calculateCollaborationScore(data)
    };
  }

  /**
   * Get chart data for visualization
   */
  async getChartData(chartId) {
    const data = await this._getFilteredData();

    switch (chartId) {
      case 'detection-trend':
        return this._getDetectionTrendData(data);
      case 'type-distribution':
        return this._getTypeDistributionData(data);
      case 'case-timeline':
        return this._getCaseTimelineData(data);
      case 'case-status-distribution':
        return this._getCaseStatusDistributionData(data);
      case 'case-priority-distribution':
        return this._getCasePriorityDistributionData(data);
      case 'pattern-heatmap':
        return this._getPatternHeatmapData(data);
      case 'pattern-network':
        return this._getPatternNetworkData(data);
      case 'team-activity-chart':
        return this._getTeamActivityChartData(data);
      default:
        throw new Error(`Unknown chart: ${chartId}`);
    }
  }

  /**
   * Get table data
   */
  async getTableData(tableId) {
    const data = await this._getFilteredData();

    switch (tableId) {
      case 'top-pages':
        return this._getTopPagesData(data);
      case 'recent-activity':
        return this._getRecentActivityData(data);
      case 'team-leaderboard':
        return this._getTeamLeaderboardData(data);
      default:
        throw new Error(`Unknown table: ${tableId}`);
    }
  }

  /**
   * Set date range filter
   */
  setDateRange(range, customStart = null, customEnd = null) {
    if (range === DASHBOARD_CONFIG.DATE_RANGES.CUSTOM) {
      if (!customStart || !customEnd) {
        throw new Error('Custom date range requires start and end dates');
      }
      this.dateRange = {
        start: new Date(customStart),
        end: new Date(customEnd)
      };
    } else {
      this.dateRange = this._getDateRange(range);
    }

    this._notifyListeners('dateRangeChanged', this.dateRange);
    return this.refresh();
  }

  /**
   * Set filters
   */
  setFilters(filters) {
    this.filters = { ...this.filters, ...filters };
    this._notifyListeners('filtersChanged', this.filters);
    return this.refresh();
  }

  /**
   * Clear filters
   */
  clearFilters() {
    this.filters = {};
    this._notifyListeners('filtersCleared');
    return this.refresh();
  }

  /**
   * Switch dashboard layout
   */
  setLayout(layoutId) {
    if (!this.layouts.has(layoutId)) {
      throw new Error(`Layout not found: ${layoutId}`);
    }

    this.activeLayout = layoutId;
    this._notifyListeners('layoutChanged', layoutId);
    return this.refresh();
  }

  /**
   * Get available layouts
   */
  getLayouts() {
    return Array.from(this.layouts.values()).map(layout => ({
      id: layout.id,
      name: layout.name,
      description: layout.description
    }));
  }

  /**
   * Get current layout
   */
  getCurrentLayout() {
    return this.layouts.get(this.activeLayout);
  }

  /**
   * Refresh dashboard data
   */
  async refresh() {
    console.log('[AnalyticsDashboard] Refreshing data...');

    try {
      // Get all widget data
      const layout = this.getCurrentLayout();
      const widgetData = new Map();

      for (const widget of layout.widgets) {
        let data;

        switch (widget.type) {
          case DASHBOARD_CONFIG.WIDGET_TYPES.METRIC:
            const metrics = await this.getMetrics();
            data = metrics[widget.id] || 0;
            break;
          case DASHBOARD_CONFIG.WIDGET_TYPES.CHART:
            data = await this.getChartData(widget.id);
            break;
          case DASHBOARD_CONFIG.WIDGET_TYPES.TABLE:
          case DASHBOARD_CONFIG.WIDGET_TYPES.TIMELINE:
            data = await this.getTableData(widget.id);
            break;
          case DASHBOARD_CONFIG.WIDGET_TYPES.HEATMAP:
          case DASHBOARD_CONFIG.WIDGET_TYPES.GRAPH:
            data = await this.getChartData(widget.id);
            break;
        }

        widgetData.set(widget.id, data);
      }

      this._notifyListeners('dataRefreshed', widgetData);
      return widgetData;
    } catch (error) {
      console.error('[AnalyticsDashboard] Refresh failed:', error);
      throw error;
    }
  }

  /**
   * Start auto-refresh
   */
  startAutoRefresh() {
    if (this.refreshTimer) {
      this.stopAutoRefresh();
    }

    this.refreshTimer = setInterval(() => {
      this.refresh();
    }, DASHBOARD_CONFIG.REFRESH_INTERVAL);

    console.log('[AnalyticsDashboard] Auto-refresh started');
  }

  /**
   * Stop auto-refresh
   */
  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      console.log('[AnalyticsDashboard] Auto-refresh stopped');
    }
  }

  /**
   * Export dashboard data
   */
  async exportData(format = DASHBOARD_CONFIG.EXPORT_FORMATS.JSON) {
    const metrics = await this.getMetrics();
    const layout = this.getCurrentLayout();

    const exportData = {
      timestamp: new Date().toISOString(),
      dateRange: this.dateRange,
      filters: this.filters,
      layout: layout.name,
      metrics: metrics,
      charts: {}
    };

    // Get all chart data
    for (const widget of layout.widgets) {
      if (widget.type === DASHBOARD_CONFIG.WIDGET_TYPES.CHART ||
          widget.type === DASHBOARD_CONFIG.WIDGET_TYPES.HEATMAP ||
          widget.type === DASHBOARD_CONFIG.WIDGET_TYPES.GRAPH) {
        exportData.charts[widget.id] = await this.getChartData(widget.id);
      }
    }

    switch (format) {
      case DASHBOARD_CONFIG.EXPORT_FORMATS.CSV:
        return this._exportToCSV(exportData);
      case DASHBOARD_CONFIG.EXPORT_FORMATS.JSON:
        return JSON.stringify(exportData, null, 2);
      case DASHBOARD_CONFIG.EXPORT_FORMATS.PDF:
        throw new Error('PDF export not yet implemented');
      default:
        throw new Error(`Unknown export format: ${format}`);
    }
  }

  /**
   * Add event listener
   */
  addEventListener(event, callback) {
    this.listeners.push({ event, callback });
  }

  /**
   * Remove event listener
   */
  removeEventListener(callback) {
    this.listeners = this.listeners.filter(l => l.callback !== callback);
  }

  // =============================================================================
  // Private Methods - Data Calculation
  // =============================================================================

  async _getFilteredData() {
    let data = this.dataSource.items || [];

    // Apply date range filter
    if (this.dateRange) {
      data = data.filter(item => {
        const timestamp = new Date(item.timestamp);
        return timestamp >= this.dateRange.start && timestamp <= this.dateRange.end;
      });
    }

    // Apply additional filters
    if (this.filters.type) {
      data = data.filter(item => item.type === this.filters.type);
    }
    if (this.filters.status) {
      data = data.filter(item => item.status === this.filters.status);
    }
    if (this.filters.caseId) {
      data = data.filter(item => item.caseId === this.filters.caseId);
    }
    if (this.filters.sessionId) {
      data = data.filter(item => item.sessionId === this.filters.sessionId);
    }

    return data;
  }

  _calculateTotalDetections(data) {
    return data.length;
  }

  _calculateSuccessRate(data) {
    if (data.length === 0) return 0;
    const successCount = data.filter(item => item.status === 'success').length;
    return ((successCount / data.length) * 100).toFixed(2);
  }

  _calculateActiveInvestigations(data) {
    const sessions = new Set(data.map(item => item.sessionId).filter(Boolean));
    return sessions.size;
  }

  _calculateAvgInvestigationTime(data) {
    const sessions = {};

    for (const item of data) {
      if (!item.sessionId) continue;

      if (!sessions[item.sessionId]) {
        sessions[item.sessionId] = {
          start: item.timestamp,
          end: item.timestamp
        };
      } else {
        if (item.timestamp < sessions[item.sessionId].start) {
          sessions[item.sessionId].start = item.timestamp;
        }
        if (item.timestamp > sessions[item.sessionId].end) {
          sessions[item.sessionId].end = item.timestamp;
        }
      }
    }

    const durations = Object.values(sessions).map(s => s.end - s.start);
    if (durations.length === 0) return 0;

    const avgMs = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    return this._formatDuration(avgMs);
  }

  _calculateTotalCases(data) {
    const cases = new Set(data.map(item => item.caseId).filter(Boolean));
    return cases.size;
  }

  _calculateOpenCases(data) {
    // This would need case status data - placeholder for now
    return Math.floor(this._calculateTotalCases(data) * 0.4);
  }

  _calculateClosedCases(data) {
    return this._calculateTotalCases(data) - this._calculateOpenCases(data);
  }

  _calculatePatternCount(data) {
    return data.length;
  }

  _calculateUniquePatterns(data) {
    const patterns = new Set(data.map(item => `${item.type}:${item.value}`));
    return patterns.size;
  }

  _calculateAvgPatternConfidence(data) {
    const withConfidence = data.filter(item => item.confidence !== null && item.confidence !== undefined);
    if (withConfidence.length === 0) return 0;

    const sum = withConfidence.reduce((acc, item) => acc + item.confidence, 0);
    return ((sum / withConfidence.length) * 100).toFixed(1);
  }

  _calculateAnomalies(data) {
    // Detect anomalies based on confidence, duplicates, etc.
    const anomalies = data.filter(item => {
      return (item.confidence !== null && item.confidence < 0.5) ||
             (item.status === 'failed');
    });
    return anomalies.length;
  }

  _calculateTeamMembers(data) {
    // Placeholder - would need user/analyst data
    return 5;
  }

  _calculateTeamActivity(data) {
    // Activity score based on recent actions
    const recentData = data.filter(item => {
      const age = Date.now() - item.timestamp;
      return age < 24 * 60 * 60 * 1000; // Last 24 hours
    });
    return recentData.length;
  }

  _calculateAvgResponseTime(data) {
    // Placeholder - would need timing data
    return '2.3h';
  }

  _calculateCollaborationScore(data) {
    // Placeholder - would need collaboration metrics
    return 85;
  }

  // =============================================================================
  // Private Methods - Chart Data
  // =============================================================================

  _getDetectionTrendData(data) {
    const buckets = {};
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Create buckets for last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now - (i * dayMs));
      const key = date.toISOString().split('T')[0];
      buckets[key] = { total: 0, success: 0, failed: 0 };
    }

    // Fill buckets
    for (const item of data) {
      const key = new Date(item.timestamp).toISOString().split('T')[0];
      if (buckets[key]) {
        buckets[key].total++;
        if (item.status === 'success') buckets[key].success++;
        if (item.status === 'failed') buckets[key].failed++;
      }
    }

    return {
      type: 'line',
      labels: Object.keys(buckets),
      datasets: [
        {
          label: 'Total',
          data: Object.values(buckets).map(b => b.total),
          color: DASHBOARD_CONFIG.CHART_COLORS.primary
        },
        {
          label: 'Success',
          data: Object.values(buckets).map(b => b.success),
          color: DASHBOARD_CONFIG.CHART_COLORS.success
        },
        {
          label: 'Failed',
          data: Object.values(buckets).map(b => b.failed),
          color: DASHBOARD_CONFIG.CHART_COLORS.error
        }
      ]
    };
  }

  _getTypeDistributionData(data) {
    const counts = {};

    for (const item of data) {
      counts[item.type] = (counts[item.type] || 0) + 1;
    }

    return {
      type: 'pie',
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        colors: this._generateColors(Object.keys(counts).length)
      }]
    };
  }

  _getCaseTimelineData(data) {
    const timeline = [];
    const cases = {};

    for (const item of data) {
      if (!item.caseId) continue;

      if (!cases[item.caseId]) {
        cases[item.caseId] = [];
      }
      cases[item.caseId].push(item);
    }

    for (const [caseId, items] of Object.entries(cases)) {
      timeline.push({
        caseId,
        start: Math.min(...items.map(i => i.timestamp)),
        end: Math.max(...items.map(i => i.timestamp)),
        count: items.length
      });
    }

    return timeline.sort((a, b) => b.start - a.start).slice(0, 20);
  }

  _getCaseStatusDistributionData(data) {
    const openCases = this._calculateOpenCases(data);
    const closedCases = this._calculateClosedCases(data);

    return {
      type: 'doughnut',
      labels: ['Open', 'Closed'],
      datasets: [{
        data: [openCases, closedCases],
        colors: [DASHBOARD_CONFIG.CHART_COLORS.warning, DASHBOARD_CONFIG.CHART_COLORS.success]
      }]
    };
  }

  _getCasePriorityDistributionData(data) {
    // Placeholder - would need priority data
    return {
      type: 'bar',
      labels: ['High', 'Medium', 'Low'],
      datasets: [{
        data: [12, 25, 18],
        colors: [DASHBOARD_CONFIG.CHART_COLORS.error, DASHBOARD_CONFIG.CHART_COLORS.warning, DASHBOARD_CONFIG.CHART_COLORS.info]
      }]
    };
  }

  _getPatternHeatmapData(data) {
    const heatmap = [];
    const hours = 24;
    const days = 7;

    // Initialize grid
    for (let day = 0; day < days; day++) {
      for (let hour = 0; hour < hours; hour++) {
        heatmap.push({ day, hour, value: 0 });
      }
    }

    // Fill with data
    for (const item of data) {
      const date = new Date(item.timestamp);
      const day = date.getDay();
      const hour = date.getHours();
      const cell = heatmap.find(c => c.day === day && c.hour === hour);
      if (cell) cell.value++;
    }

    return heatmap;
  }

  _getPatternNetworkData(data) {
    const nodes = [];
    const edges = [];
    const nodeMap = new Map();

    // Create nodes from data
    for (const item of data) {
      if (!nodeMap.has(item.value)) {
        nodeMap.set(item.value, {
          id: item.value,
          label: item.value,
          type: item.type,
          size: 1
        });
      } else {
        nodeMap.get(item.value).size++;
      }
    }

    nodes.push(...nodeMap.values());

    // Create edges based on co-occurrence
    // (simplified - would need more sophisticated relationship detection)

    return { nodes, edges };
  }

  _getTeamActivityChartData(data) {
    // Placeholder
    return {
      type: 'bar',
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        label: 'Activity',
        data: [45, 52, 38, 65, 48, 22, 18],
        color: DASHBOARD_CONFIG.CHART_COLORS.info
      }]
    };
  }

  // =============================================================================
  // Private Methods - Table Data
  // =============================================================================

  _getTopPagesData(data) {
    const pages = {};

    for (const item of data) {
      if (!item.pageUrl) continue;
      pages[item.pageUrl] = (pages[item.pageUrl] || 0) + 1;
    }

    return Object.entries(pages)
      .map(([url, count]) => ({ url, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  _getRecentActivityData(data) {
    return data
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20)
      .map(item => ({
        timestamp: item.timestamp,
        type: item.type,
        value: item.value,
        status: item.status
      }));
  }

  _getTeamLeaderboardData(data) {
    // Placeholder
    return [
      { name: 'Alice', detections: 145, cases: 12 },
      { name: 'Bob', detections: 128, cases: 10 },
      { name: 'Charlie', detections: 97, cases: 8 }
    ];
  }

  // =============================================================================
  // Private Methods - Utilities
  // =============================================================================

  _getDateRange(range) {
    const now = new Date();
    const start = new Date();

    switch (range) {
      case DASHBOARD_CONFIG.DATE_RANGES.TODAY:
        start.setHours(0, 0, 0, 0);
        break;
      case DASHBOARD_CONFIG.DATE_RANGES.YESTERDAY:
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        break;
      case DASHBOARD_CONFIG.DATE_RANGES.LAST_7_DAYS:
        start.setDate(start.getDate() - 7);
        break;
      case DASHBOARD_CONFIG.DATE_RANGES.LAST_30_DAYS:
        start.setDate(start.getDate() - 30);
        break;
      case DASHBOARD_CONFIG.DATE_RANGES.LAST_90_DAYS:
        start.setDate(start.getDate() - 90);
        break;
      case DASHBOARD_CONFIG.DATE_RANGES.THIS_MONTH:
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
      case DASHBOARD_CONFIG.DATE_RANGES.LAST_MONTH:
        start.setMonth(start.getMonth() - 1);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
    }

    return { start, end: now };
  }

  _formatDuration(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  _generateColors(count) {
    const colors = Object.values(DASHBOARD_CONFIG.CHART_COLORS);
    return Array.from({ length: count }, (_, i) => colors[i % colors.length]);
  }

  _exportToCSV(data) {
    const rows = [];

    // Header
    rows.push(['Metric', 'Value']);

    // Metrics
    for (const [key, value] of Object.entries(data.metrics)) {
      rows.push([key, value]);
    }

    return rows.map(row => row.join(',')).join('\n');
  }

  async _loadPreferences() {
    // Load from chrome.storage if available
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['dashboard_preferences'], (result) => {
          if (result.dashboard_preferences) {
            this.activeLayout = result.dashboard_preferences.activeLayout || 'default';
            this.filters = result.dashboard_preferences.filters || {};
          }
          resolve();
        });
      });
    }
  }

  async _savePreferences() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve) => {
        chrome.storage.local.set({
          dashboard_preferences: {
            activeLayout: this.activeLayout,
            filters: this.filters
          }
        }, resolve);
      });
    }
  }

  _notifyListeners(event, data) {
    for (const listener of this.listeners) {
      if (listener.event === event || listener.event === '*') {
        try {
          listener.callback(event, data);
        } catch (error) {
          console.error('[AnalyticsDashboard] Listener error:', error);
        }
      }
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AnalyticsDashboard,
    DASHBOARD_CONFIG
  };
}
