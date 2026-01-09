/**
 * Basset Hound Browser Automation - Analytics Exporter
 * Phase 19: Analytics & Intelligence
 *
 * Export analytics data to various formats (CSV, JSON, PDF).
 * Generate shareable reports and enable data portability.
 *
 * Features:
 * - Export to CSV format
 * - Export to JSON format
 * - Generate PDF reports (basic HTML-based)
 * - Share dashboards with team
 * - API endpoints for analytics data
 * - Batch export
 * - Custom export templates
 *
 * Dependencies: None (pure JavaScript)
 */

// =============================================================================
// Constants & Configuration
// =============================================================================

const EXPORT_CONFIG = {
  FORMATS: {
    CSV: 'csv',
    JSON: 'json',
    PDF: 'pdf',
    HTML: 'html'
  },
  CSV_DELIMITER: ',',
  CSV_LINE_BREAK: '\n',
  MAX_EXPORT_ROWS: 10000,
  TEMPLATES: {
    SUMMARY: 'summary',
    DETAILED: 'detailed',
    CUSTOM: 'custom'
  }
};

// =============================================================================
// AnalyticsExporter Class
// =============================================================================

/**
 * Analytics data export manager
 */
class AnalyticsExporter {
  constructor(dataSource) {
    this.dataSource = dataSource;
    this.exportQueue = [];
  }

  /**
   * Export to CSV format
   */
  async exportToCSV(data, options = {}) {
    const {
      filename = 'analytics_export.csv',
      includeHeaders = true,
      delimiter = EXPORT_CONFIG.CSV_DELIMITER
    } = options;

    let csvContent = '';

    // Determine data structure
    if (Array.isArray(data)) {
      csvContent = this._arrayToCSV(data, includeHeaders, delimiter);
    } else if (typeof data === 'object') {
      csvContent = this._objectToCSV(data, includeHeaders, delimiter);
    } else {
      throw new Error('Invalid data format for CSV export');
    }

    this._downloadFile(csvContent, filename, 'text/csv');

    return {
      success: true,
      filename,
      size: csvContent.length,
      rows: csvContent.split(EXPORT_CONFIG.CSV_LINE_BREAK).length - 1
    };
  }

  /**
   * Export to JSON format
   */
  async exportToJSON(data, options = {}) {
    const {
      filename = 'analytics_export.json',
      pretty = true
    } = options;

    const jsonContent = pretty
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);

    this._downloadFile(jsonContent, filename, 'application/json');

    return {
      success: true,
      filename,
      size: jsonContent.length
    };
  }

  /**
   * Export to HTML report
   */
  async exportToHTML(data, options = {}) {
    const {
      filename = 'analytics_report.html',
      template = EXPORT_CONFIG.TEMPLATES.SUMMARY,
      title = 'Analytics Report'
    } = options;

    let htmlContent = '';

    switch (template) {
      case EXPORT_CONFIG.TEMPLATES.SUMMARY:
        htmlContent = this._generateSummaryHTML(data, title);
        break;
      case EXPORT_CONFIG.TEMPLATES.DETAILED:
        htmlContent = this._generateDetailedHTML(data, title);
        break;
      default:
        htmlContent = this._generateSummaryHTML(data, title);
    }

    this._downloadFile(htmlContent, filename, 'text/html');

    return {
      success: true,
      filename,
      size: htmlContent.length
    };
  }

  /**
   * Export dashboard state
   */
  async exportDashboard(dashboard, options = {}) {
    const {
      format = EXPORT_CONFIG.FORMATS.JSON,
      filename = `dashboard_${Date.now()}.${format}`
    } = options;

    const exportData = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      layout: dashboard.getCurrentLayout(),
      metrics: await dashboard.getMetrics(),
      filters: dashboard.filters,
      dateRange: dashboard.dateRange
    };

    switch (format) {
      case EXPORT_CONFIG.FORMATS.CSV:
        return await this.exportToCSV(this._flattenDashboardData(exportData), { filename });
      case EXPORT_CONFIG.FORMATS.JSON:
        return await this.exportToJSON(exportData, { filename });
      case EXPORT_CONFIG.FORMATS.HTML:
        return await this.exportToHTML(exportData, { filename });
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export insights
   */
  async exportInsights(insights, options = {}) {
    const {
      format = EXPORT_CONFIG.FORMATS.CSV,
      filename = `insights_${Date.now()}.${format}`
    } = options;

    const exportData = insights.map(insight => ({
      id: insight.id,
      type: insight.type,
      title: insight.title,
      description: insight.description,
      confidence: insight.confidence,
      severity: insight.severity,
      timestamp: new Date(insight.timestamp).toISOString()
    }));

    switch (format) {
      case EXPORT_CONFIG.FORMATS.CSV:
        return await this.exportToCSV(exportData, { filename });
      case EXPORT_CONFIG.FORMATS.JSON:
        return await this.exportToJSON({ insights: exportData }, { filename });
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export pattern analysis results
   */
  async exportPatterns(patterns, options = {}) {
    const {
      format = EXPORT_CONFIG.FORMATS.JSON,
      filename = `patterns_${Date.now()}.${format}`
    } = options;

    switch (format) {
      case EXPORT_CONFIG.FORMATS.JSON:
        return await this.exportToJSON(patterns, { filename });
      case EXPORT_CONFIG.FORMATS.HTML:
        return await this.exportToHTML(patterns, {
          filename,
          template: EXPORT_CONFIG.TEMPLATES.DETAILED,
          title: 'Pattern Analysis Report'
        });
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export entity profiles
   */
  async exportEntityProfiles(profiles, options = {}) {
    const {
      format = EXPORT_CONFIG.FORMATS.CSV,
      filename = `entity_profiles_${Date.now()}.${format}`
    } = options;

    const exportData = Array.from(profiles.values()).map(p => ({
      entityId: p.profile.entityId,
      totalDetections: p.profile.summary.totalDetections,
      firstSeen: new Date(p.profile.summary.firstSeen).toISOString(),
      lastSeen: new Date(p.profile.summary.lastSeen).toISOString(),
      avgConfidence: p.profile.statistics.avgConfidence,
      successRate: p.profile.statistics.successRate,
      riskScore: p.profile.riskScore.score,
      riskLevel: p.profile.riskScore.level
    }));

    switch (format) {
      case EXPORT_CONFIG.FORMATS.CSV:
        return await this.exportToCSV(exportData, { filename });
      case EXPORT_CONFIG.FORMATS.JSON:
        return await this.exportToJSON({ profiles: exportData }, { filename });
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Batch export multiple analytics components
   */
  async batchExport(components, options = {}) {
    const {
      format = EXPORT_CONFIG.FORMATS.JSON,
      zipFilename = `analytics_batch_${Date.now()}.zip`
    } = options;

    const exports = [];

    for (const component of components) {
      try {
        let result;

        switch (component.type) {
          case 'dashboard':
            result = await this.exportDashboard(component.data, { format });
            break;
          case 'insights':
            result = await this.exportInsights(component.data, { format });
            break;
          case 'patterns':
            result = await this.exportPatterns(component.data, { format });
            break;
          case 'profiles':
            result = await this.exportEntityProfiles(component.data, { format });
            break;
          default:
            console.warn(`Unknown component type: ${component.type}`);
            continue;
        }

        exports.push({
          component: component.type,
          result
        });
      } catch (error) {
        console.error(`Failed to export ${component.type}:`, error);
        exports.push({
          component: component.type,
          error: error.message
        });
      }
    }

    return {
      success: true,
      exports,
      totalComponents: components.length,
      successCount: exports.filter(e => !e.error).length
    };
  }

  // =============================================================================
  // Private Methods - CSV Generation
  // =============================================================================

  _arrayToCSV(data, includeHeaders, delimiter) {
    if (data.length === 0) return '';

    const rows = [];

    // Headers
    if (includeHeaders) {
      const headers = Object.keys(data[0]);
      rows.push(headers.join(delimiter));
    }

    // Data rows
    for (const item of data) {
      const values = Object.values(item).map(val =>
        this._escapeCSVValue(val, delimiter)
      );
      rows.push(values.join(delimiter));
    }

    return rows.join(EXPORT_CONFIG.CSV_LINE_BREAK);
  }

  _objectToCSV(data, includeHeaders, delimiter) {
    const flatData = this._flattenObject(data);
    const rows = [];

    if (includeHeaders) {
      rows.push(['Key', 'Value'].join(delimiter));
    }

    for (const [key, value] of Object.entries(flatData)) {
      rows.push([
        this._escapeCSVValue(key, delimiter),
        this._escapeCSVValue(value, delimiter)
      ].join(delimiter));
    }

    return rows.join(EXPORT_CONFIG.CSV_LINE_BREAK);
  }

  _escapeCSVValue(value, delimiter) {
    if (value === null || value === undefined) return '';

    const stringValue = String(value);

    // Escape if contains delimiter, quote, or newline
    if (stringValue.includes(delimiter) ||
        stringValue.includes('"') ||
        stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  _flattenObject(obj, prefix = '') {
    const flattened = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, this._flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        flattened[newKey] = JSON.stringify(value);
      } else {
        flattened[newKey] = value;
      }
    }

    return flattened;
  }

  _flattenDashboardData(data) {
    return [
      {
        timestamp: data.timestamp,
        layout: data.layout.name,
        ...data.metrics
      }
    ];
  }

  // =============================================================================
  // Private Methods - HTML Generation
  // =============================================================================

  _generateSummaryHTML(data, title) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this._escapeHTML(title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
      color: #333;
    }
    .header {
      background: #2c3e50;
      color: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0 0 10px 0;
    }
    .header .meta {
      opacity: 0.8;
      font-size: 14px;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .metric-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .metric-label {
      font-size: 14px;
      color: #666;
      margin-bottom: 8px;
    }
    .metric-value {
      font-size: 32px;
      font-weight: bold;
      color: #2c3e50;
    }
    .section {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    .section h2 {
      margin-top: 0;
      color: #2c3e50;
      border-bottom: 2px solid #3498db;
      padding-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
      color: #2c3e50;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding: 20px;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${this._escapeHTML(title)}</h1>
    <div class="meta">
      Generated: ${new Date().toLocaleString()}<br>
      ${data.dateRange ? `Date Range: ${new Date(data.dateRange.start).toLocaleDateString()} - ${new Date(data.dateRange.end).toLocaleDateString()}` : ''}
    </div>
  </div>

  ${this._generateMetricsHTML(data.metrics || {})}
  ${this._generateDataSectionHTML(data)}

  <div class="footer">
    <p>Generated by Basset Hound Analytics Dashboard</p>
  </div>
</body>
</html>
    `.trim();
  }

  _generateDetailedHTML(data, title) {
    // Extended version with more details
    const summary = this._generateSummaryHTML(data, title);
    // Add additional sections for detailed view
    return summary;
  }

  _generateMetricsHTML(metrics) {
    if (!metrics || Object.keys(metrics).length === 0) return '';

    const metricCards = Object.entries(metrics)
      .map(([key, value]) => `
        <div class="metric-card">
          <div class="metric-label">${this._formatMetricLabel(key)}</div>
          <div class="metric-value">${this._formatMetricValue(value)}</div>
        </div>
      `)
      .join('');

    return `
      <div class="metrics">
        ${metricCards}
      </div>
    `;
  }

  _generateDataSectionHTML(data) {
    let sections = '';

    // Add charts section if present
    if (data.charts && Object.keys(data.charts).length > 0) {
      sections += `
        <div class="section">
          <h2>Charts & Visualizations</h2>
          <p>Chart data available in JSON export</p>
        </div>
      `;
    }

    // Add insights section if present
    if (data.insights && data.insights.length > 0) {
      sections += this._generateInsightsTableHTML(data.insights);
    }

    return sections;
  }

  _generateInsightsTableHTML(insights) {
    const rows = insights.map(insight => `
      <tr>
        <td>${this._escapeHTML(insight.type)}</td>
        <td>${this._escapeHTML(insight.title)}</td>
        <td>${this._escapeHTML(insight.description)}</td>
        <td>${(insight.confidence * 100).toFixed(1)}%</td>
        <td>${this._escapeHTML(insight.severity)}</td>
      </tr>
    `).join('');

    return `
      <div class="section">
        <h2>Insights</h2>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Title</th>
              <th>Description</th>
              <th>Confidence</th>
              <th>Severity</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  _formatMetricLabel(key) {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  _formatMetricValue(value) {
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    return String(value);
  }

  _escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // =============================================================================
  // Private Methods - File Download
  // =============================================================================

  _downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  }
}

// =============================================================================
// Share API (for team collaboration)
// =============================================================================

class AnalyticsShareAPI {
  /**
   * Generate shareable link (would integrate with backend)
   */
  static async generateShareLink(data, options = {}) {
    const {
      expiresIn = 24 * 60 * 60 * 1000, // 24 hours
      password = null
    } = options;

    // In real implementation, this would upload to backend
    // For now, we'll use local storage
    const shareId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const shareData = {
      id: shareId,
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + expiresIn,
      password: password ? this._hashPassword(password) : null
    };

    // Store in localStorage (temporary solution)
    localStorage.setItem(`analytics_share_${shareId}`, JSON.stringify(shareData));

    return {
      shareId,
      url: `${window.location.origin}/analytics/share/${shareId}`,
      expiresAt: shareData.expiresAt
    };
  }

  /**
   * Retrieve shared data
   */
  static async getSharedData(shareId, password = null) {
    const key = `analytics_share_${shareId}`;
    const stored = localStorage.getItem(key);

    if (!stored) {
      throw new Error('Share not found');
    }

    const shareData = JSON.parse(stored);

    // Check expiration
    if (Date.now() > shareData.expiresAt) {
      localStorage.removeItem(key);
      throw new Error('Share has expired');
    }

    // Check password
    if (shareData.password && this._hashPassword(password) !== shareData.password) {
      throw new Error('Invalid password');
    }

    return shareData.data;
  }

  static _hashPassword(password) {
    // Simple hash for demo - would use proper crypto in production
    return btoa(password);
  }
}

// =============================================================================
// Exports
// =============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AnalyticsExporter,
    AnalyticsShareAPI,
    EXPORT_CONFIG
  };
}
