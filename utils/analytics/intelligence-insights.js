/**
 * Basset Hound Browser Automation - Intelligence Insights
 * Phase 19: Analytics & Intelligence
 *
 * Automatic insight generation, risk scoring, entity profiling,
 * and behavioral analysis with actionable recommendations.
 *
 * Features:
 * - Automatic insight generation
 * - Risk scoring and threat assessment
 * - Entity profiling and enrichment
 * - Behavior analysis
 * - Trend identification
 * - Actionable recommendations
 * - Alert generation
 * - Predictive analytics
 *
 * Dependencies: PatternAnalysis (for pattern data)
 */

// =============================================================================
// Constants & Configuration
// =============================================================================

const INSIGHTS_CONFIG = {
  RISK_LEVELS: {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
    MINIMAL: 'minimal'
  },
  INSIGHT_TYPES: {
    TREND: 'trend',
    ANOMALY: 'anomaly',
    CORRELATION: 'correlation',
    PREDICTION: 'prediction',
    RECOMMENDATION: 'recommendation',
    ALERT: 'alert'
  },
  MIN_CONFIDENCE: 0.6,
  ALERT_THRESHOLD: 0.75,
  PROFILE_CACHE_TTL: 10 * 60 * 1000  // 10 minutes
};

const RiskFactors = {
  HIGH_FAILURE_RATE: { weight: 0.3, threshold: 0.2 },
  LOW_CONFIDENCE: { weight: 0.25, threshold: 0.5 },
  ANOMALOUS_BEHAVIOR: { weight: 0.2, threshold: 0.7 },
  SUSPICIOUS_PATTERNS: { weight: 0.15, threshold: 0.6 },
  RAPID_VOLUME_CHANGE: { weight: 0.1, threshold: 2.0 }
};

// =============================================================================
// IntelligenceInsights Class
// =============================================================================

/**
 * Intelligence and insights engine
 */
class IntelligenceInsights {
  constructor(dataSource, patternAnalysis) {
    this.dataSource = dataSource;
    this.patternAnalysis = patternAnalysis;
    this.insights = [];
    this.entityProfiles = new Map();
    this.riskScores = new Map();
    this.alerts = [];
  }

  /**
   * Generate all insights
   */
  async generateInsights() {
    console.log('[IntelligenceInsights] Generating insights...');

    const insights = [];

    // Generate different types of insights
    const trendInsights = await this._generateTrendInsights();
    const anomalyInsights = await this._generateAnomalyInsights();
    const correlationInsights = await this._generateCorrelationInsights();
    const predictionInsights = await this._generatePredictionInsights();
    const recommendations = await this._generateRecommendations();

    insights.push(...trendInsights);
    insights.push(...anomalyInsights);
    insights.push(...correlationInsights);
    insights.push(...predictionInsights);
    insights.push(...recommendations);

    // Sort by confidence
    this.insights = insights.sort((a, b) => b.confidence - a.confidence);

    // Generate alerts from high-confidence insights
    this._generateAlerts();

    console.log(`[IntelligenceInsights] Generated ${insights.length} insights`);
    return this.insights;
  }

  /**
   * Calculate risk score for entity or investigation
   */
  async calculateRiskScore(entityId) {
    const cached = this.riskScores.get(entityId);
    if (cached && Date.now() - cached.timestamp < INSIGHTS_CONFIG.PROFILE_CACHE_TTL) {
      return cached.score;
    }

    const data = await this._getEntityData(entityId);
    const score = this._computeRiskScore(data);

    this.riskScores.set(entityId, {
      score,
      timestamp: Date.now()
    });

    return score;
  }

  /**
   * Generate entity profile
   */
  async generateEntityProfile(entityId) {
    const cached = this.entityProfiles.get(entityId);
    if (cached && Date.now() - cached.timestamp < INSIGHTS_CONFIG.PROFILE_CACHE_TTL) {
      return cached.profile;
    }

    const data = await this._getEntityData(entityId);
    const profile = {
      entityId,
      summary: this._generateEntitySummary(data),
      statistics: this._calculateEntityStatistics(data),
      behavior: this._analyzeEntityBehavior(data),
      relationships: await this._getEntityRelationships(entityId),
      timeline: this._buildEntityTimeline(data),
      riskScore: await this.calculateRiskScore(entityId),
      insights: this._getEntityInsights(data),
      recommendations: this._getEntityRecommendations(data)
    };

    this.entityProfiles.set(entityId, {
      profile,
      timestamp: Date.now()
    });

    return profile;
  }

  /**
   * Analyze behavior patterns
   */
  async analyzeBehavior(options = {}) {
    const data = await this._getData();
    const patterns = await this.patternAnalysis.analyzeBehaviorPatterns();

    return {
      frequencyAnalysis: this._analyzeBehaviorFrequency(data, patterns),
      sequenceAnalysis: this._analyzeBehaviorSequences(data, patterns),
      timingAnalysis: this._analyzeBehaviorTiming(data, patterns),
      volumeAnalysis: this._analyzeBehaviorVolume(data, patterns),
      deviations: this._detectBehaviorDeviations(data, patterns)
    };
  }

  /**
   * Generate recommendations
   */
  async getRecommendations(context = null) {
    return await this._generateRecommendations(context);
  }

  /**
   * Get active alerts
   */
  getAlerts(filter = {}) {
    let alerts = [...this.alerts];

    if (filter.level) {
      alerts = alerts.filter(a => a.level === filter.level);
    }
    if (filter.type) {
      alerts = alerts.filter(a => a.type === filter.type);
    }
    if (filter.unread) {
      alerts = alerts.filter(a => !a.read);
    }

    return alerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Mark alert as read
   */
  markAlertRead(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.read = true;
    }
  }

  /**
   * Clear all alerts
   */
  clearAlerts() {
    this.alerts = [];
  }

  // =============================================================================
  // Private Methods - Insight Generation
  // =============================================================================

  async _generateTrendInsights() {
    const insights = [];
    const data = await this._getData();

    // Volume trends
    const volumeTrend = this._analyzeVolumeTrend(data);
    if (volumeTrend.significant) {
      insights.push({
        id: this._generateId(),
        type: INSIGHTS_CONFIG.INSIGHT_TYPES.TREND,
        title: volumeTrend.direction === 'increasing' ? 'Increasing Detection Volume' : 'Decreasing Detection Volume',
        description: `Detection volume has ${volumeTrend.direction} by ${volumeTrend.changePercent.toFixed(1)}% over the last 7 days`,
        data: volumeTrend,
        confidence: volumeTrend.confidence,
        timestamp: Date.now(),
        severity: volumeTrend.direction === 'increasing' ? 'medium' : 'low'
      });
    }

    // Type trends
    const typeTrends = this._analyzeTypeTrends(data);
    for (const trend of typeTrends) {
      if (trend.significant) {
        insights.push({
          id: this._generateId(),
          type: INSIGHTS_CONFIG.INSIGHT_TYPES.TREND,
          title: `${trend.type} Detection Trend`,
          description: `${trend.type} detections are ${trend.direction} (${trend.changePercent.toFixed(1)}% change)`,
          data: trend,
          confidence: trend.confidence,
          timestamp: Date.now(),
          severity: 'low'
        });
      }
    }

    return insights;
  }

  async _generateAnomalyInsights() {
    const insights = [];
    const anomalies = await this.patternAnalysis.detectAnomalies();

    for (const anomaly of anomalies) {
      if (anomaly.severity >= INSIGHTS_CONFIG.MIN_CONFIDENCE) {
        insights.push({
          id: this._generateId(),
          type: INSIGHTS_CONFIG.INSIGHT_TYPES.ANOMALY,
          title: this._getAnomalyTitle(anomaly),
          description: anomaly.description,
          data: anomaly,
          confidence: anomaly.severity,
          timestamp: Date.now(),
          severity: this._mapSeverityToRisk(anomaly.severity)
        });
      }
    }

    return insights;
  }

  async _generateCorrelationInsights() {
    const insights = [];
    const correlations = await this.patternAnalysis.analyzeTimelineCorrelations();

    // Significant correlations
    const significant = correlations.filter(c =>
      c.eventCount >= 5 && c.types.length > 1
    );

    for (const corr of significant.slice(0, 5)) {
      insights.push({
        id: this._generateId(),
        type: INSIGHTS_CONFIG.INSIGHT_TYPES.CORRELATION,
        title: 'Correlated Detection Events',
        description: `${corr.eventCount} related events detected within ${this._formatDuration(corr.duration)}`,
        data: corr,
        confidence: Math.min(corr.eventCount / 10, 0.9),
        timestamp: Date.now(),
        severity: 'medium'
      });
    }

    return insights;
  }

  async _generatePredictionInsights() {
    const insights = [];
    const data = await this._getData();

    // Predict next likely detection type
    const prediction = this._predictNextDetectionType(data);
    if (prediction.confidence >= INSIGHTS_CONFIG.MIN_CONFIDENCE) {
      insights.push({
        id: this._generateId(),
        type: INSIGHTS_CONFIG.INSIGHT_TYPES.PREDICTION,
        title: 'Detection Type Prediction',
        description: `Next detection likely to be ${prediction.type} (${(prediction.confidence * 100).toFixed(1)}% confidence)`,
        data: prediction,
        confidence: prediction.confidence,
        timestamp: Date.now(),
        severity: 'low'
      });
    }

    // Predict volume
    const volumePrediction = this._predictVolume(data);
    if (volumePrediction.confidence >= INSIGHTS_CONFIG.MIN_CONFIDENCE) {
      insights.push({
        id: this._generateId(),
        type: INSIGHTS_CONFIG.INSIGHT_TYPES.PREDICTION,
        title: 'Volume Prediction',
        description: `Expected ${volumePrediction.predictedCount} detections in next 24 hours`,
        data: volumePrediction,
        confidence: volumePrediction.confidence,
        timestamp: Date.now(),
        severity: 'low'
      });
    }

    return insights;
  }

  async _generateRecommendations(context = null) {
    const recommendations = [];
    const data = await this._getData();

    // Performance recommendations
    const failureRate = data.filter(d => d.status === 'failed').length / data.length;
    if (failureRate > 0.1) {
      recommendations.push({
        id: this._generateId(),
        type: INSIGHTS_CONFIG.INSIGHT_TYPES.RECOMMENDATION,
        title: 'High Failure Rate Detected',
        description: `${(failureRate * 100).toFixed(1)}% of detections are failing. Review detection patterns and validation logic.`,
        actions: [
          'Review failed detection logs',
          'Check pattern validation rules',
          'Verify data formats'
        ],
        confidence: 0.9,
        timestamp: Date.now(),
        severity: 'high',
        priority: 1
      });
    }

    // Low confidence recommendations
    const lowConfidence = data.filter(d => d.confidence !== null && d.confidence < 0.5);
    if (lowConfidence.length > data.length * 0.2) {
      recommendations.push({
        id: this._generateId(),
        type: INSIGHTS_CONFIG.INSIGHT_TYPES.RECOMMENDATION,
        title: 'Low Confidence Detections',
        description: `${lowConfidence.length} detections have low confidence scores. Consider manual review.`,
        actions: [
          'Review low-confidence items manually',
          'Adjust confidence thresholds',
          'Improve pattern matching algorithms'
        ],
        confidence: 0.85,
        timestamp: Date.now(),
        severity: 'medium',
        priority: 2
      });
    }

    // Coverage recommendations
    const types = new Set(data.map(d => d.type));
    if (types.size < 5) {
      recommendations.push({
        id: this._generateId(),
        type: INSIGHTS_CONFIG.INSIGHT_TYPES.RECOMMENDATION,
        title: 'Limited Pattern Coverage',
        description: `Only ${types.size} pattern types detected. Expand detection patterns for better coverage.`,
        actions: [
          'Add more pattern types',
          'Review target pages for additional data types',
          'Enable additional detection modules'
        ],
        confidence: 0.7,
        timestamp: Date.now(),
        severity: 'low',
        priority: 3
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  _generateAlerts() {
    const newAlerts = this.insights
      .filter(insight =>
        insight.confidence >= INSIGHTS_CONFIG.ALERT_THRESHOLD &&
        (insight.severity === 'high' || insight.severity === 'critical')
      )
      .map(insight => ({
        id: this._generateId(),
        insightId: insight.id,
        type: insight.type,
        title: insight.title,
        description: insight.description,
        level: insight.severity,
        timestamp: Date.now(),
        read: false,
        data: insight.data
      }));

    this.alerts.push(...newAlerts);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  // =============================================================================
  // Private Methods - Risk Scoring
  // =============================================================================

  _computeRiskScore(data) {
    let riskScore = 0;
    const factors = [];

    // Factor 1: Failure rate
    const failureRate = data.filter(d => d.status === 'failed').length / Math.max(data.length, 1);
    if (failureRate > RiskFactors.HIGH_FAILURE_RATE.threshold) {
      const factor = RiskFactors.HIGH_FAILURE_RATE.weight * (failureRate / RiskFactors.HIGH_FAILURE_RATE.threshold);
      riskScore += factor;
      factors.push({ name: 'High Failure Rate', score: factor });
    }

    // Factor 2: Low confidence
    const lowConfidenceRate = data.filter(d =>
      d.confidence !== null && d.confidence < RiskFactors.LOW_CONFIDENCE.threshold
    ).length / Math.max(data.length, 1);

    if (lowConfidenceRate > 0.1) {
      const factor = RiskFactors.LOW_CONFIDENCE.weight * (lowConfidenceRate / 0.5);
      riskScore += factor;
      factors.push({ name: 'Low Confidence', score: factor });
    }

    // Factor 3: Anomalous behavior (placeholder)
    // Would integrate with anomaly detection

    // Factor 4: Suspicious patterns (placeholder)
    // Would integrate with pattern analysis

    // Factor 5: Rapid volume changes
    const volumeChange = this._calculateVolumeChange(data);
    if (Math.abs(volumeChange) > RiskFactors.RAPID_VOLUME_CHANGE.threshold) {
      const factor = RiskFactors.RAPID_VOLUME_CHANGE.weight * (Math.abs(volumeChange) / 5);
      riskScore += Math.min(factor, RiskFactors.RAPID_VOLUME_CHANGE.weight);
      factors.push({ name: 'Rapid Volume Change', score: factor });
    }

    return {
      score: Math.min(riskScore, 1.0),
      level: this._getRiskLevel(riskScore),
      factors,
      timestamp: Date.now()
    };
  }

  _getRiskLevel(score) {
    if (score >= 0.8) return INSIGHTS_CONFIG.RISK_LEVELS.CRITICAL;
    if (score >= 0.6) return INSIGHTS_CONFIG.RISK_LEVELS.HIGH;
    if (score >= 0.4) return INSIGHTS_CONFIG.RISK_LEVELS.MEDIUM;
    if (score >= 0.2) return INSIGHTS_CONFIG.RISK_LEVELS.LOW;
    return INSIGHTS_CONFIG.RISK_LEVELS.MINIMAL;
  }

  // =============================================================================
  // Private Methods - Entity Profiling
  // =============================================================================

  _generateEntitySummary(data) {
    return {
      totalDetections: data.length,
      firstSeen: data.length > 0 ? Math.min(...data.map(d => d.timestamp)) : null,
      lastSeen: data.length > 0 ? Math.max(...data.map(d => d.timestamp)) : null,
      types: [...new Set(data.map(d => d.type))],
      pages: [...new Set(data.map(d => d.pageUrl).filter(Boolean))],
      cases: [...new Set(data.map(d => d.caseId).filter(Boolean))]
    };
  }

  _calculateEntityStatistics(data) {
    const confidences = data.filter(d => d.confidence !== null).map(d => d.confidence);
    const avgConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : null;

    const successRate = data.filter(d => d.status === 'success').length / Math.max(data.length, 1);

    return {
      avgConfidence,
      successRate,
      failureRate: 1 - successRate,
      verifiedCount: data.filter(d => d.verified).length,
      totalOccurrences: data.length
    };
  }

  _analyzeEntityBehavior(data) {
    const sorted = data.sort((a, b) => a.timestamp - b.timestamp);
    const intervals = [];

    for (let i = 1; i < sorted.length; i++) {
      intervals.push(sorted[i].timestamp - sorted[i - 1].timestamp);
    }

    const avgInterval = intervals.length > 0
      ? intervals.reduce((a, b) => a + b, 0) / intervals.length
      : null;

    return {
      activityPattern: this._classifyActivityPattern(intervals),
      avgInterval,
      mostActiveHour: this._getMostActiveHour(data),
      mostActiveDomain: this._getMostActiveDomain(data)
    };
  }

  async _getEntityRelationships(entityId) {
    const relationships = await this.patternAnalysis.analyzeEntityRelationships();
    return relationships
      .filter(r => r.entity1 === entityId || r.entity2 === entityId)
      .slice(0, 10);
  }

  _buildEntityTimeline(data) {
    return data
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(item => ({
        timestamp: item.timestamp,
        type: item.type,
        status: item.status,
        pageUrl: item.pageUrl,
        caseId: item.caseId
      }));
  }

  _getEntityInsights(data) {
    const insights = [];

    // Frequency insight
    if (data.length > 10) {
      insights.push({
        type: 'frequency',
        message: `Highly active entity with ${data.length} detections`
      });
    }

    // Confidence insight
    const avgConf = this._calculateEntityStatistics(data).avgConfidence;
    if (avgConf !== null && avgConf > 0.8) {
      insights.push({
        type: 'confidence',
        message: `High average confidence (${(avgConf * 100).toFixed(1)}%)`
      });
    }

    return insights;
  }

  _getEntityRecommendations(data) {
    const recommendations = [];
    const stats = this._calculateEntityStatistics(data);

    if (stats.failureRate > 0.2) {
      recommendations.push({
        priority: 'high',
        message: 'High failure rate - review detection pattern',
        action: 'review_pattern'
      });
    }

    if (data.length > 20 && stats.verifiedCount === 0) {
      recommendations.push({
        priority: 'medium',
        message: 'Frequent entity not verified - consider verification',
        action: 'verify_entity'
      });
    }

    return recommendations;
  }

  // =============================================================================
  // Private Methods - Behavior Analysis
  // =============================================================================

  _analyzeBehaviorFrequency(data, patterns) {
    const frequencies = patterns.frequencyPatterns || [];
    return {
      mostFrequent: frequencies.slice(0, 5),
      totalUnique: frequencies.length,
      avgFrequency: frequencies.length > 0
        ? frequencies.reduce((sum, f) => sum + f.frequency, 0) / frequencies.length
        : 0
    };
  }

  _analyzeBehaviorSequences(data, patterns) {
    const sequences = patterns.sequencePatterns || [];
    return {
      commonSequences: sequences.slice(0, 5),
      totalPatterns: sequences.length
    };
  }

  _analyzeBehaviorTiming(data, patterns) {
    return patterns.timingPatterns || {};
  }

  _analyzeBehaviorVolume(data, patterns) {
    return patterns.volumePatterns || {};
  }

  _detectBehaviorDeviations(data, patterns) {
    // Detect significant deviations from normal behavior
    const deviations = [];

    // Volume deviation
    const volumePattern = patterns.volumePatterns;
    if (volumePattern && volumePattern.avgDailyVolume) {
      const recentVolume = data.filter(d =>
        Date.now() - d.timestamp < 24 * 60 * 60 * 1000
      ).length;

      const deviation = Math.abs(recentVolume - volumePattern.avgDailyVolume) / volumePattern.avgDailyVolume;

      if (deviation > 0.5) {
        deviations.push({
          type: 'volume',
          message: `Volume deviation: ${(deviation * 100).toFixed(1)}% from average`,
          severity: deviation > 1.0 ? 'high' : 'medium'
        });
      }
    }

    return deviations;
  }

  // =============================================================================
  // Private Methods - Analysis Helpers
  // =============================================================================

  _analyzeVolumeTrend(data) {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    const lastWeek = data.filter(d => now - d.timestamp < weekMs);
    const previousWeek = data.filter(d =>
      now - d.timestamp >= weekMs && now - d.timestamp < 2 * weekMs
    );

    if (previousWeek.length === 0) {
      return { significant: false };
    }

    const changePercent = ((lastWeek.length - previousWeek.length) / previousWeek.length) * 100;
    const direction = changePercent > 0 ? 'increasing' : 'decreasing';
    const significant = Math.abs(changePercent) > 20;

    return {
      significant,
      direction,
      changePercent: Math.abs(changePercent),
      lastWeekCount: lastWeek.length,
      previousWeekCount: previousWeek.length,
      confidence: Math.min(Math.abs(changePercent) / 100, 0.9)
    };
  }

  _analyzeTypeTrends(data) {
    const trends = [];
    const types = [...new Set(data.map(d => d.type))];
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    for (const type of types) {
      const typeData = data.filter(d => d.type === type);
      const lastWeek = typeData.filter(d => now - d.timestamp < weekMs);
      const previousWeek = typeData.filter(d =>
        now - d.timestamp >= weekMs && now - d.timestamp < 2 * weekMs
      );

      if (previousWeek.length === 0) continue;

      const changePercent = ((lastWeek.length - previousWeek.length) / previousWeek.length) * 100;

      if (Math.abs(changePercent) > 30) {
        trends.push({
          type,
          direction: changePercent > 0 ? 'increasing' : 'decreasing',
          changePercent: Math.abs(changePercent),
          significant: true,
          confidence: Math.min(Math.abs(changePercent) / 100, 0.85)
        });
      }
    }

    return trends;
  }

  _predictNextDetectionType(data) {
    const types = data.map(d => d.type);
    const typeCounts = {};

    for (const type of types) {
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }

    const mostCommon = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])[0];

    if (!mostCommon) {
      return { confidence: 0 };
    }

    return {
      type: mostCommon[0],
      confidence: mostCommon[1] / types.length
    };
  }

  _predictVolume(data) {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const recentDays = 7;
    const dailyCounts = [];

    for (let i = 0; i < recentDays; i++) {
      const dayStart = now - ((i + 1) * dayMs);
      const dayEnd = now - (i * dayMs);
      const count = data.filter(d => d.timestamp >= dayStart && d.timestamp < dayEnd).length;
      dailyCounts.push(count);
    }

    const avgCount = dailyCounts.reduce((a, b) => a + b, 0) / dailyCounts.length;

    return {
      predictedCount: Math.round(avgCount),
      confidence: 0.65,
      basedOnDays: recentDays
    };
  }

  _calculateVolumeChange(data) {
    const sorted = data.sort((a, b) => a.timestamp - b.timestamp);
    if (sorted.length < 2) return 0;

    const mid = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, mid).length;
    const secondHalf = sorted.length - mid;

    return (secondHalf - firstHalf) / firstHalf;
  }

  _classifyActivityPattern(intervals) {
    if (intervals.length === 0) return 'unknown';

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const hourMs = 60 * 60 * 1000;

    if (avgInterval < hourMs) return 'rapid';
    if (avgInterval < 24 * hourMs) return 'frequent';
    if (avgInterval < 7 * 24 * hourMs) return 'regular';
    return 'sporadic';
  }

  _getMostActiveHour(data) {
    const hours = new Array(24).fill(0);
    for (const item of data) {
      hours[new Date(item.timestamp).getHours()]++;
    }
    return hours.indexOf(Math.max(...hours));
  }

  _getMostActiveDomain(data) {
    const domains = {};
    for (const item of data) {
      if (!item.pageUrl) continue;
      const domain = this._extractDomain(item.pageUrl);
      domains[domain] = (domains[domain] || 0) + 1;
    }

    const entries = Object.entries(domains);
    if (entries.length === 0) return null;

    return entries.sort((a, b) => b[1] - a[1])[0][0];
  }

  _getAnomalyTitle(anomaly) {
    const titles = {
      'low_confidence': 'Low Confidence Detections',
      'high_failure_rate': 'High Failure Rate',
      'confidence_outlier': 'Confidence Score Outliers',
      'rare_type': 'Rare Detection Type',
      'unusual_gap': 'Unusual Time Gap'
    };
    return titles[anomaly.subtype] || 'Anomaly Detected';
  }

  _mapSeverityToRisk(severity) {
    if (severity >= 0.8) return 'critical';
    if (severity >= 0.6) return 'high';
    if (severity >= 0.4) return 'medium';
    return 'low';
  }

  // =============================================================================
  // Private Methods - Utilities
  // =============================================================================

  async _getData() {
    return this.dataSource.items || [];
  }

  async _getEntityData(entityId) {
    const allData = await this._getData();
    return allData.filter(item => `${item.type}:${item.value}` === entityId);
  }

  _extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  _formatDuration(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${Math.floor(ms / 1000)}s`;
  }

  _generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// =============================================================================
// Exports
// =============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    IntelligenceInsights,
    INSIGHTS_CONFIG,
    RiskFactors
  };
}
