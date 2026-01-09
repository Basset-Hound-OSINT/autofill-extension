/**
 * Basset Hound Browser Automation - Pattern Analysis Engine
 * Phase 19: Analytics & Intelligence
 *
 * Advanced pattern detection and analysis across multiple investigations.
 * Identifies relationships, correlations, anomalies, and behavioral patterns.
 *
 * Features:
 * - Cross-investigation pattern detection
 * - Entity relationship analysis
 * - Timeline correlation analysis
 * - Geographic/spatial analysis
 * - Network analysis (entity connections)
 * - Anomaly detection
 * - Behavioral pattern recognition
 * - Statistical analysis
 *
 * Dependencies: None (pure JavaScript implementation)
 */

// =============================================================================
// Constants & Configuration
// =============================================================================

const PATTERN_CONFIG = {
  MIN_CORRELATION_STRENGTH: 0.6,     // Minimum correlation coefficient
  MIN_PATTERN_OCCURRENCES: 3,         // Minimum occurrences to be a pattern
  MAX_TIME_GAP_MS: 60 * 60 * 1000,   // Max time gap for correlation (1 hour)
  ANOMALY_THRESHOLD: 2.0,             // Standard deviations for anomaly
  CLUSTERING_DISTANCE: 0.3,           // Distance threshold for clustering
  NETWORK_MIN_CONNECTIONS: 2          // Minimum connections to show in network
};

const PatternType = {
  TEMPORAL: 'temporal',               // Time-based patterns
  SPATIAL: 'spatial',                 // Location-based patterns
  BEHAVIORAL: 'behavioral',           // Behavior patterns
  RELATIONAL: 'relational',           // Relationship patterns
  SEQUENTIAL: 'sequential',           // Sequence patterns
  ANOMALY: 'anomaly'                  // Anomalous patterns
};

// =============================================================================
// PatternAnalysis Class
// =============================================================================

/**
 * Pattern analysis engine
 */
class PatternAnalysis {
  constructor(dataSource) {
    this.dataSource = dataSource;
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Detect patterns across multiple investigations
   */
  async detectPatterns(options = {}) {
    const cacheKey = 'all_patterns';
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    const data = await this._getData();
    const patterns = {
      temporal: this._detectTemporalPatterns(data),
      spatial: this._detectSpatialPatterns(data),
      behavioral: this._detectBehavioralPatterns(data),
      relational: this._detectRelationalPatterns(data),
      sequential: this._detectSequentialPatterns(data),
      anomalies: this._detectAnomalies(data)
    };

    this._setCache(cacheKey, patterns);
    return patterns;
  }

  /**
   * Analyze entity relationships
   */
  async analyzeEntityRelationships(options = {}) {
    const data = await this._getData();
    const relationships = [];

    // Group by entity value
    const entities = this._groupByEntity(data);

    // Find co-occurrences
    for (const [entity1, items1] of Object.entries(entities)) {
      for (const [entity2, items2] of Object.entries(entities)) {
        if (entity1 >= entity2) continue; // Avoid duplicates and self-loops

        const coOccurrences = this._findCoOccurrences(items1, items2);
        if (coOccurrences.length >= PATTERN_CONFIG.MIN_PATTERN_OCCURRENCES) {
          relationships.push({
            entity1,
            entity2,
            strength: coOccurrences.length,
            confidence: this._calculateRelationshipConfidence(coOccurrences),
            contexts: coOccurrences.map(c => ({
              pageUrl: c.pageUrl,
              timestamp: c.timestamp,
              caseId: c.caseId
            }))
          });
        }
      }
    }

    return relationships.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Perform timeline correlation analysis
   */
  async analyzeTimelineCorrelations(options = {}) {
    const data = await this._getData();
    const correlations = [];

    // Sort by timestamp
    const sorted = data.sort((a, b) => a.timestamp - b.timestamp);

    // Find events happening within time windows
    for (let i = 0; i < sorted.length; i++) {
      const event1 = sorted[i];
      const cluster = [event1];

      // Find events within time window
      for (let j = i + 1; j < sorted.length; j++) {
        const event2 = sorted[j];
        const timeDiff = event2.timestamp - event1.timestamp;

        if (timeDiff > PATTERN_CONFIG.MAX_TIME_GAP_MS) break;

        cluster.push(event2);
      }

      if (cluster.length >= PATTERN_CONFIG.MIN_PATTERN_OCCURRENCES) {
        correlations.push({
          timestamp: event1.timestamp,
          duration: cluster[cluster.length - 1].timestamp - event1.timestamp,
          eventCount: cluster.length,
          events: cluster,
          types: [...new Set(cluster.map(e => e.type))],
          pages: [...new Set(cluster.map(e => e.pageUrl))]
        });
      }
    }

    return this._deduplicateCorrelations(correlations);
  }

  /**
   * Perform geographic/spatial analysis
   */
  async analyzeSpatialPatterns(options = {}) {
    const data = await this._getData();
    const spatialPatterns = {
      byDomain: {},
      byCountry: {},
      byRegion: {},
      clusters: []
    };

    // Group by domain
    for (const item of data) {
      if (!item.pageUrl) continue;

      const domain = this._extractDomain(item.pageUrl);
      if (!spatialPatterns.byDomain[domain]) {
        spatialPatterns.byDomain[domain] = {
          domain,
          count: 0,
          types: new Set(),
          pages: new Set()
        };
      }

      spatialPatterns.byDomain[domain].count++;
      spatialPatterns.byDomain[domain].types.add(item.type);
      spatialPatterns.byDomain[domain].pages.add(item.pageUrl);
    }

    // Convert sets to arrays
    for (const domain in spatialPatterns.byDomain) {
      const pattern = spatialPatterns.byDomain[domain];
      pattern.types = Array.from(pattern.types);
      pattern.pages = Array.from(pattern.pages);
    }

    // Geographic clustering (would integrate with geolocation data)
    spatialPatterns.clusters = this._performSpatialClustering(data);

    return spatialPatterns;
  }

  /**
   * Perform network analysis (entity connections)
   */
  async analyzeNetwork(options = {}) {
    const data = await this._getData();
    const network = {
      nodes: [],
      edges: [],
      communities: [],
      metrics: {}
    };

    // Build nodes
    const nodeMap = new Map();
    for (const item of data) {
      const nodeId = `${item.type}:${item.value}`;

      if (!nodeMap.has(nodeId)) {
        nodeMap.set(nodeId, {
          id: nodeId,
          type: item.type,
          value: item.value,
          degree: 0,
          weight: 1,
          metadata: {
            firstSeen: item.timestamp,
            lastSeen: item.timestamp,
            occurrences: 1,
            pages: new Set([item.pageUrl]),
            cases: new Set([item.caseId].filter(Boolean))
          }
        });
      } else {
        const node = nodeMap.get(nodeId);
        node.weight++;
        node.metadata.occurrences++;
        node.metadata.lastSeen = Math.max(node.metadata.lastSeen, item.timestamp);
        if (item.pageUrl) node.metadata.pages.add(item.pageUrl);
        if (item.caseId) node.metadata.cases.add(item.caseId);
      }
    }

    network.nodes = Array.from(nodeMap.values()).map(node => ({
      ...node,
      metadata: {
        ...node.metadata,
        pages: Array.from(node.metadata.pages),
        cases: Array.from(node.metadata.cases)
      }
    }));

    // Build edges (based on co-occurrence)
    const edges = new Map();
    const pageGroups = this._groupByPage(data);

    for (const items of Object.values(pageGroups)) {
      if (items.length < 2) continue;

      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const node1Id = `${items[i].type}:${items[i].value}`;
          const node2Id = `${items[j].type}:${items[j].value}`;
          const edgeId = [node1Id, node2Id].sort().join('->');

          if (!edges.has(edgeId)) {
            edges.set(edgeId, {
              source: node1Id,
              target: node2Id,
              weight: 1,
              contexts: []
            });
          } else {
            edges.get(edgeId).weight++;
          }

          edges.get(edgeId).contexts.push({
            pageUrl: items[i].pageUrl,
            timestamp: items[i].timestamp
          });
        }
      }
    }

    network.edges = Array.from(edges.values())
      .filter(edge => edge.weight >= PATTERN_CONFIG.NETWORK_MIN_CONNECTIONS);

    // Update node degrees
    for (const edge of network.edges) {
      const sourceNode = network.nodes.find(n => n.id === edge.source);
      const targetNode = network.nodes.find(n => n.id === edge.target);
      if (sourceNode) sourceNode.degree++;
      if (targetNode) targetNode.degree++;
    }

    // Calculate network metrics
    network.metrics = {
      nodeCount: network.nodes.length,
      edgeCount: network.edges.length,
      density: this._calculateNetworkDensity(network),
      avgDegree: this._calculateAvgDegree(network),
      clustering: this._calculateClusteringCoefficient(network),
      centralNodes: this._findCentralNodes(network)
    };

    // Detect communities
    network.communities = this._detectCommunities(network);

    return network;
  }

  /**
   * Detect anomalies in data
   */
  async detectAnomalies(options = {}) {
    const data = await this._getData();
    const anomalies = [];

    // Statistical anomalies (outliers)
    const statisticalAnomalies = this._detectStatisticalAnomalies(data);
    anomalies.push(...statisticalAnomalies);

    // Behavioral anomalies
    const behavioralAnomalies = this._detectBehavioralAnomalies(data);
    anomalies.push(...behavioralAnomalies);

    // Temporal anomalies
    const temporalAnomalies = this._detectTemporalAnomalies(data);
    anomalies.push(...temporalAnomalies);

    // Pattern deviation anomalies
    const patternAnomalies = this._detectPatternDeviations(data);
    anomalies.push(...patternAnomalies);

    return anomalies.sort((a, b) => b.severity - a.severity);
  }

  /**
   * Analyze behavior patterns
   */
  async analyzeBehaviorPatterns(options = {}) {
    const data = await this._getData();
    const patterns = {
      frequencyPatterns: this._analyzeFrequencyPatterns(data),
      sequencePatterns: this._analyzeSequencePatterns(data),
      timingPatterns: this._analyzeTimingPatterns(data),
      volumePatterns: this._analyzeVolumePatterns(data)
    };

    return patterns;
  }

  // =============================================================================
  // Private Methods - Pattern Detection
  // =============================================================================

  _detectTemporalPatterns(data) {
    const patterns = [];

    // Time-of-day patterns
    const hourDistribution = new Array(24).fill(0);
    for (const item of data) {
      const hour = new Date(item.timestamp).getHours();
      hourDistribution[hour]++;
    }

    const peakHours = hourDistribution
      .map((count, hour) => ({ hour, count }))
      .filter(h => h.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    if (peakHours.length > 0) {
      patterns.push({
        type: PatternType.TEMPORAL,
        subtype: 'peak_hours',
        description: `Peak activity hours: ${peakHours.map(h => `${h.hour}:00`).join(', ')}`,
        data: peakHours,
        confidence: 0.8
      });
    }

    // Day-of-week patterns
    const dayDistribution = new Array(7).fill(0);
    for (const item of data) {
      const day = new Date(item.timestamp).getDay();
      dayDistribution[day]++;
    }

    const peakDays = dayDistribution
      .map((count, day) => ({ day, count }))
      .filter(d => d.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 2);

    if (peakDays.length > 0) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      patterns.push({
        type: PatternType.TEMPORAL,
        subtype: 'peak_days',
        description: `Peak activity days: ${peakDays.map(d => dayNames[d.day]).join(', ')}`,
        data: peakDays,
        confidence: 0.75
      });
    }

    return patterns;
  }

  _detectSpatialPatterns(data) {
    const patterns = [];

    // Domain clustering
    const domainCounts = {};
    for (const item of data) {
      if (!item.pageUrl) continue;
      const domain = this._extractDomain(item.pageUrl);
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    }

    const topDomains = Object.entries(domainCounts)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    if (topDomains.length > 0 && topDomains[0].count > PATTERN_CONFIG.MIN_PATTERN_OCCURRENCES) {
      patterns.push({
        type: PatternType.SPATIAL,
        subtype: 'domain_clustering',
        description: `High concentration on domains: ${topDomains.map(d => d.domain).join(', ')}`,
        data: topDomains,
        confidence: 0.85
      });
    }

    return patterns;
  }

  _detectBehavioralPatterns(data) {
    const patterns = [];

    // Type preference patterns
    const typeCounts = {};
    for (const item of data) {
      typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
    }

    const dominantTypes = Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count, percentage: (count / data.length) * 100 }))
      .filter(t => t.percentage > 30)
      .sort((a, b) => b.percentage - a.percentage);

    if (dominantTypes.length > 0) {
      patterns.push({
        type: PatternType.BEHAVIORAL,
        subtype: 'type_preference',
        description: `Strong preference for ${dominantTypes[0].type} (${dominantTypes[0].percentage.toFixed(1)}%)`,
        data: dominantTypes,
        confidence: 0.9
      });
    }

    return patterns;
  }

  _detectRelationalPatterns(data) {
    const patterns = [];

    // Find frequently co-occurring entities
    const coOccurrences = this._findFrequentCoOccurrences(data);

    if (coOccurrences.length > 0) {
      patterns.push({
        type: PatternType.RELATIONAL,
        subtype: 'frequent_pairs',
        description: `Frequent entity pairs detected: ${coOccurrences.length}`,
        data: coOccurrences,
        confidence: 0.8
      });
    }

    return patterns;
  }

  _detectSequentialPatterns(data) {
    const patterns = [];

    // Sort by timestamp
    const sorted = data.sort((a, b) => a.timestamp - b.timestamp);

    // Find common sequences
    const sequences = this._findSequencePatterns(sorted);

    if (sequences.length > 0) {
      patterns.push({
        type: PatternType.SEQUENTIAL,
        subtype: 'common_sequences',
        description: `Common detection sequences found: ${sequences.length}`,
        data: sequences,
        confidence: 0.7
      });
    }

    return patterns;
  }

  _detectAnomalies(data) {
    const anomalies = [];

    // Low confidence items
    const lowConfidence = data.filter(item =>
      item.confidence !== null && item.confidence < 0.3
    );

    if (lowConfidence.length > 0) {
      anomalies.push({
        type: PatternType.ANOMALY,
        subtype: 'low_confidence',
        description: `${lowConfidence.length} items with unusually low confidence`,
        data: lowConfidence,
        severity: 0.6
      });
    }

    // Failed ingestions
    const failed = data.filter(item => item.status === 'failed');

    if (failed.length > data.length * 0.1) { // More than 10% failed
      anomalies.push({
        type: PatternType.ANOMALY,
        subtype: 'high_failure_rate',
        description: `High failure rate: ${((failed.length / data.length) * 100).toFixed(1)}%`,
        data: failed,
        severity: 0.8
      });
    }

    return anomalies;
  }

  // =============================================================================
  // Private Methods - Statistical Analysis
  // =============================================================================

  _detectStatisticalAnomalies(data) {
    const anomalies = [];

    // Calculate statistics for confidence scores
    const confidences = data
      .filter(item => item.confidence !== null)
      .map(item => item.confidence);

    if (confidences.length > 0) {
      const stats = this._calculateStatistics(confidences);
      const threshold = stats.mean - (PATTERN_CONFIG.ANOMALY_THRESHOLD * stats.stdDev);

      const outliers = data.filter(item =>
        item.confidence !== null && item.confidence < threshold
      );

      if (outliers.length > 0) {
        anomalies.push({
          type: 'statistical',
          subtype: 'confidence_outlier',
          description: `${outliers.length} items with confidence below ${threshold.toFixed(2)}`,
          items: outliers,
          severity: 0.7
        });
      }
    }

    return anomalies;
  }

  _detectBehavioralAnomalies(data) {
    const anomalies = [];

    // Detect unusual type combinations
    const typeFrequencies = {};
    for (const item of data) {
      typeFrequencies[item.type] = (typeFrequencies[item.type] || 0) + 1;
    }

    const avgFrequency = Object.values(typeFrequencies).reduce((a, b) => a + b, 0) / Object.keys(typeFrequencies).length;

    for (const [type, frequency] of Object.entries(typeFrequencies)) {
      if (frequency < avgFrequency * 0.1 && frequency < PATTERN_CONFIG.MIN_PATTERN_OCCURRENCES) {
        const items = data.filter(item => item.type === type);
        anomalies.push({
          type: 'behavioral',
          subtype: 'rare_type',
          description: `Rare detection type: ${type} (${frequency} occurrences)`,
          items,
          severity: 0.5
        });
      }
    }

    return anomalies;
  }

  _detectTemporalAnomalies(data) {
    const anomalies = [];

    // Detect unusual time gaps
    const sorted = data.sort((a, b) => a.timestamp - b.timestamp);
    const gaps = [];

    for (let i = 1; i < sorted.length; i++) {
      gaps.push(sorted[i].timestamp - sorted[i - 1].timestamp);
    }

    if (gaps.length > 0) {
      const stats = this._calculateStatistics(gaps);
      const threshold = stats.mean + (PATTERN_CONFIG.ANOMALY_THRESHOLD * stats.stdDev);

      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i].timestamp - sorted[i - 1].timestamp;
        if (gap > threshold) {
          anomalies.push({
            type: 'temporal',
            subtype: 'unusual_gap',
            description: `Unusual time gap: ${this._formatDuration(gap)}`,
            data: {
              before: sorted[i - 1],
              after: sorted[i],
              gap
            },
            severity: 0.6
          });
        }
      }
    }

    return anomalies;
  }

  _detectPatternDeviations(data) {
    // Detect items that deviate from established patterns
    // Placeholder for now
    return [];
  }

  // =============================================================================
  // Private Methods - Behavior Analysis
  // =============================================================================

  _analyzeFrequencyPatterns(data) {
    const frequencies = {};

    for (const item of data) {
      const key = `${item.type}:${item.value}`;
      frequencies[key] = (frequencies[key] || 0) + 1;
    }

    return Object.entries(frequencies)
      .map(([key, count]) => {
        const [type, value] = key.split(':');
        return { type, value, frequency: count };
      })
      .sort((a, b) => b.frequency - a.frequency);
  }

  _analyzeSequencePatterns(data) {
    const sequences = [];
    const sorted = data.sort((a, b) => a.timestamp - b.timestamp);

    // Find common 2-grams and 3-grams
    for (let i = 0; i < sorted.length - 1; i++) {
      const seq = [sorted[i].type, sorted[i + 1].type];
      sequences.push(seq.join(' -> '));
    }

    const sequenceCounts = {};
    for (const seq of sequences) {
      sequenceCounts[seq] = (sequenceCounts[seq] || 0) + 1;
    }

    return Object.entries(sequenceCounts)
      .map(([sequence, count]) => ({ sequence, count }))
      .filter(s => s.count >= PATTERN_CONFIG.MIN_PATTERN_OCCURRENCES)
      .sort((a, b) => b.count - a.count);
  }

  _analyzeTimingPatterns(data) {
    const intervals = [];
    const sorted = data.sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 1; i < sorted.length; i++) {
      intervals.push(sorted[i].timestamp - sorted[i - 1].timestamp);
    }

    if (intervals.length === 0) return null;

    const stats = this._calculateStatistics(intervals);

    return {
      avgInterval: stats.mean,
      medianInterval: stats.median,
      minInterval: Math.min(...intervals),
      maxInterval: Math.max(...intervals),
      stdDev: stats.stdDev
    };
  }

  _analyzeVolumePatterns(data) {
    const hourlyVolume = new Array(24).fill(0);
    const dailyVolume = {};

    for (const item of data) {
      const date = new Date(item.timestamp);
      hourlyVolume[date.getHours()]++;

      const dateKey = date.toISOString().split('T')[0];
      dailyVolume[dateKey] = (dailyVolume[dateKey] || 0) + 1;
    }

    return {
      hourlyVolume,
      dailyVolume,
      peakHour: hourlyVolume.indexOf(Math.max(...hourlyVolume)),
      avgDailyVolume: Object.values(dailyVolume).reduce((a, b) => a + b, 0) / Object.keys(dailyVolume).length
    };
  }

  // =============================================================================
  // Private Methods - Utilities
  // =============================================================================

  async _getData() {
    return this.dataSource.items || [];
  }

  _groupByEntity(data) {
    const groups = {};

    for (const item of data) {
      const key = `${item.type}:${item.value}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    }

    return groups;
  }

  _groupByPage(data) {
    const groups = {};

    for (const item of data) {
      if (!item.pageUrl) continue;
      if (!groups[item.pageUrl]) {
        groups[item.pageUrl] = [];
      }
      groups[item.pageUrl].push(item);
    }

    return groups;
  }

  _findCoOccurrences(items1, items2) {
    const coOccurrences = [];

    for (const item1 of items1) {
      for (const item2 of items2) {
        if (item1.pageUrl === item2.pageUrl &&
            Math.abs(item1.timestamp - item2.timestamp) < PATTERN_CONFIG.MAX_TIME_GAP_MS) {
          coOccurrences.push({
            pageUrl: item1.pageUrl,
            timestamp: item1.timestamp,
            caseId: item1.caseId
          });
        }
      }
    }

    return coOccurrences;
  }

  _findFrequentCoOccurrences(data) {
    const pairs = new Map();
    const pageGroups = this._groupByPage(data);

    for (const items of Object.values(pageGroups)) {
      if (items.length < 2) continue;

      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const pair = [
            `${items[i].type}:${items[i].value}`,
            `${items[j].type}:${items[j].value}`
          ].sort().join(' <-> ');

          pairs.set(pair, (pairs.get(pair) || 0) + 1);
        }
      }
    }

    return Array.from(pairs.entries())
      .map(([pair, count]) => ({ pair, count }))
      .filter(p => p.count >= PATTERN_CONFIG.MIN_PATTERN_OCCURRENCES)
      .sort((a, b) => b.count - a.count);
  }

  _findSequencePatterns(sortedData) {
    // Simplified sequence pattern detection
    const sequences = [];
    const windowSize = 3;

    for (let i = 0; i <= sortedData.length - windowSize; i++) {
      const window = sortedData.slice(i, i + windowSize);
      const sequence = window.map(item => item.type).join(' -> ');
      sequences.push(sequence);
    }

    const counts = {};
    for (const seq of sequences) {
      counts[seq] = (counts[seq] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([sequence, count]) => ({ sequence, count }))
      .filter(s => s.count >= PATTERN_CONFIG.MIN_PATTERN_OCCURRENCES)
      .sort((a, b) => b.count - a.count);
  }

  _calculateRelationshipConfidence(coOccurrences) {
    // Simple confidence based on frequency
    const frequency = coOccurrences.length;
    return Math.min(frequency / 10, 1.0);
  }

  _deduplicateCorrelations(correlations) {
    // Remove overlapping correlation windows
    const unique = [];
    const used = new Set();

    for (const corr of correlations.sort((a, b) => b.eventCount - a.eventCount)) {
      let overlap = false;
      for (const event of corr.events) {
        if (used.has(event.id || `${event.timestamp}:${event.value}`)) {
          overlap = true;
          break;
        }
      }

      if (!overlap) {
        unique.push(corr);
        corr.events.forEach(e => used.add(e.id || `${e.timestamp}:${e.value}`));
      }
    }

    return unique;
  }

  _extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  _performSpatialClustering(data) {
    // Simplified clustering - group by domain
    const clusters = this._groupByPage(data);
    return Object.entries(clusters)
      .map(([page, items]) => ({
        page,
        count: items.length,
        types: [...new Set(items.map(i => i.type))]
      }))
      .filter(c => c.count >= PATTERN_CONFIG.MIN_PATTERN_OCCURRENCES);
  }

  _calculateNetworkDensity(network) {
    const n = network.nodes.length;
    if (n <= 1) return 0;
    const maxEdges = (n * (n - 1)) / 2;
    return network.edges.length / maxEdges;
  }

  _calculateAvgDegree(network) {
    if (network.nodes.length === 0) return 0;
    const totalDegree = network.nodes.reduce((sum, node) => sum + node.degree, 0);
    return totalDegree / network.nodes.length;
  }

  _calculateClusteringCoefficient(network) {
    // Simplified clustering coefficient
    return 0.5; // Placeholder
  }

  _findCentralNodes(network) {
    return network.nodes
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 5)
      .map(node => ({ id: node.id, degree: node.degree, weight: node.weight }));
  }

  _detectCommunities(network) {
    // Simplified community detection - group by type
    const communities = {};

    for (const node of network.nodes) {
      if (!communities[node.type]) {
        communities[node.type] = [];
      }
      communities[node.type].push(node.id);
    }

    return Object.entries(communities).map(([type, nodes]) => ({
      type,
      size: nodes.length,
      nodes
    }));
  }

  _calculateStatistics(values) {
    if (values.length === 0) {
      return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const median = sorted[Math.floor(sorted.length / 2)];

    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      median,
      stdDev,
      min: sorted[0],
      max: sorted[sorted.length - 1]
    };
  }

  _formatDuration(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${Math.floor(ms / 1000)}s`;
  }

  _getCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.cacheExpiry) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  _setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
}

// =============================================================================
// Exports
// =============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PatternAnalysis,
    PATTERN_CONFIG,
    PatternType
  };
}
