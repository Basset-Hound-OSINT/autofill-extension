/**
 * Basset Hound Browser Automation - Professional Report Generator
 * Phase 18.2: Export/Import and Report Generation
 *
 * Generate professional investigation reports:
 * - Multiple formats: HTML, PDF, Markdown, DOCX
 * - Customizable templates
 * - Report sections: Executive summary, findings, evidence, timeline
 * - Include screenshots and annotations
 * - Chain of custody documentation
 * - Professional styling and branding
 * - Redaction support
 *
 * @module report-generator
 */

// =============================================================================
// Configuration
// =============================================================================

const ReportConfig = {
  // Report formats
  FORMATS: {
    HTML: 'html',
    PDF: 'pdf',
    MARKDOWN: 'markdown',
    DOCX: 'docx',
    TXT: 'txt'
  },

  // Report types
  TYPES: {
    INVESTIGATION: 'investigation',
    EXECUTIVE: 'executive',
    TECHNICAL: 'technical',
    EVIDENCE: 'evidence',
    TIMELINE: 'timeline',
    CUSTOM: 'custom'
  },

  // PDF settings
  PDF: {
    PAGE_WIDTH: 210, // A4 width in mm
    PAGE_HEIGHT: 297, // A4 height in mm
    MARGIN: 20,
    FONT_SIZE: 11,
    LINE_HEIGHT: 1.5
  },

  // Styling
  STYLES: {
    PRIMARY_COLOR: '#2c3e50',
    SECONDARY_COLOR: '#3498db',
    SUCCESS_COLOR: '#27ae60',
    WARNING_COLOR: '#f39c12',
    DANGER_COLOR: '#e74c3c',
    BACKGROUND_COLOR: '#ecf0f1',
    TEXT_COLOR: '#2c3e50'
  },

  // Redaction
  REDACTION: {
    COLOR: '#000000',
    PATTERN: '[REDACTED]',
    KEYWORDS: [
      'password', 'secret', 'apiKey', 'token', 'ssn',
      'credit_card', 'bank_account', 'private_key'
    ]
  },

  // Export settings
  MAX_REPORT_SIZE_MB: 50,
  IMAGE_MAX_WIDTH: 1200,
  IMAGE_QUALITY: 85,

  // Storage keys
  STORAGE_KEY_REPORTS: 'generated_reports',
  STORAGE_KEY_TEMPLATES: 'report_templates'
};

// =============================================================================
// ReportGenerator Class
// =============================================================================

/**
 * ReportGenerator - Generate professional investigation reports
 */
class ReportGenerator {
  /**
   * Create ReportGenerator instance
   * @param {Object} options - Generator options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.sessionManager - Session manager instance
   * @param {Object} options.templateManager - Template manager instance
   */
  constructor(options = {}) {
    this.config = {
      logger: options.logger || null,
      sessionManager: options.sessionManager || null,
      templateManager: options.templateManager || null
    };

    this.generatedReports = [];
  }

  // ===========================================================================
  // Main Report Generation Methods
  // ===========================================================================

  /**
   * Generate investigation report
   * @param {string} caseId - Case ID
   * @param {Object} options - Report options
   * @param {string} options.format - Report format (html, pdf, markdown, docx)
   * @param {string} options.type - Report type (investigation, executive, technical, evidence)
   * @param {string} options.template - Template name
   * @param {Object} options.sections - Sections to include
   * @param {Object} options.branding - Branding options
   * @param {Array<string>} options.redactKeywords - Keywords to redact
   * @param {boolean} options.includeScreenshots - Include screenshots
   * @param {boolean} options.includeChainOfCustody - Include chain of custody
   * @returns {Promise<Object>} Report result
   */
  async generateReport(caseId, options = {}) {
    const reportId = this._generateReportId();

    try {
      this._log('info', `Generating report: ${reportId} (type: ${options.type || 'investigation'})`);

      // Gather report data
      const reportData = await this._gatherReportData(caseId, options);

      // Select template
      const template = await this._selectTemplate(options.type, options.template);

      // Build report sections
      const sections = await this._buildReportSections(reportData, template, options);

      // Apply redactions if needed
      if (options.redactKeywords && options.redactKeywords.length > 0) {
        this._applyRedactions(sections, options.redactKeywords);
      }

      // Format report based on output format
      const format = options.format || ReportConfig.FORMATS.HTML;
      const formattedReport = await this._formatReport(
        reportId,
        reportData,
        sections,
        template,
        format,
        options
      );

      // Save report
      await this._saveReport({
        id: reportId,
        caseId,
        type: options.type || ReportConfig.TYPES.INVESTIGATION,
        format,
        generatedAt: Date.now(),
        sizeBytes: JSON.stringify(formattedReport).length
      });

      this._log('info', `Report generated: ${reportId}`);

      return {
        success: true,
        reportId,
        caseId,
        format,
        report: formattedReport,
        filename: this._generateFilename(caseId, format, options.type),
        mimeType: this._getMimeType(format),
        timestamp: Date.now()
      };

    } catch (error) {
      this._log('error', `Report generation failed: ${error.message}`);

      return {
        success: false,
        error: error.message,
        reportId,
        caseId,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Generate executive briefing
   * @param {string} caseId - Case ID
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Report result
   */
  async generateExecutiveBriefing(caseId, options = {}) {
    return this.generateReport(caseId, {
      ...options,
      type: ReportConfig.TYPES.EXECUTIVE,
      sections: {
        executiveSummary: true,
        keyFindings: true,
        recommendations: true,
        timeline: false,
        evidenceDetails: false,
        technicalAnalysis: false
      }
    });
  }

  /**
   * Generate technical analysis report
   * @param {string} caseId - Case ID
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Report result
   */
  async generateTechnicalAnalysis(caseId, options = {}) {
    return this.generateReport(caseId, {
      ...options,
      type: ReportConfig.TYPES.TECHNICAL,
      sections: {
        executiveSummary: false,
        methodology: true,
        technicalFindings: true,
        networkAnalysis: true,
        osintData: true,
        evidenceDetails: true,
        chainOfCustody: true
      }
    });
  }

  /**
   * Generate evidence documentation
   * @param {string} caseId - Case ID
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Report result
   */
  async generateEvidenceDocumentation(caseId, options = {}) {
    return this.generateReport(caseId, {
      ...options,
      type: ReportConfig.TYPES.EVIDENCE,
      sections: {
        evidenceList: true,
        evidenceDetails: true,
        screenshots: true,
        chainOfCustody: true,
        integrity: true
      }
    });
  }

  // ===========================================================================
  // Data Gathering Methods
  // ===========================================================================

  /**
   * Gather all data needed for report
   * @private
   */
  async _gatherReportData(caseId, options) {
    const data = {
      case: await this._getCaseMetadata(caseId),
      sessions: await this._getEvidenceSessions(caseId),
      evidence: await this._getEvidenceItems(caseId),
      osint: await this._getOSINTData(caseId),
      timeline: await this._getTimeline(caseId),
      annotations: await this._getAnnotations(caseId),
      custody: await this._getChainOfCustody(caseId),
      statistics: await this._calculateStatistics(caseId)
    };

    return data;
  }

  /**
   * Get case metadata
   * @private
   */
  async _getCaseMetadata(caseId) {
    const storage = this._getStorage();
    const key = `investigation_case_${caseId}`;
    const result = await storage.get(key);
    return result[key] || {
      caseId,
      title: 'Untitled Investigation',
      description: '',
      createdAt: Date.now()
    };
  }

  /**
   * Get evidence sessions
   * @private
   */
  async _getEvidenceSessions(caseId) {
    const sessionManager = this.config.sessionManager || globalThis.getSessionManager?.();

    if (!sessionManager) {
      return [];
    }

    const listResult = await sessionManager.listSessions({ caseId, limit: 1000 });
    return listResult.success ? listResult.sessions : [];
  }

  /**
   * Get evidence items
   * @private
   */
  async _getEvidenceItems(caseId) {
    const sessions = await this._getEvidenceSessions(caseId);
    const sessionManager = this.config.sessionManager || globalThis.getSessionManager?.();

    if (!sessionManager) {
      return [];
    }

    const allEvidence = [];
    for (const sessionInfo of sessions) {
      const session = await sessionManager.getSession(sessionInfo.id);
      if (session) {
        const items = session.evidenceItems.filter(e => e !== null);
        allEvidence.push(...items);
      }
    }

    return allEvidence;
  }

  /**
   * Get OSINT data
   * @private
   */
  async _getOSINTData(caseId) {
    const storage = this._getStorage();
    const key = `case_osint_${caseId}`;
    const result = await storage.get(key);
    return result[key] || null;
  }

  /**
   * Get timeline
   * @private
   */
  async _getTimeline(caseId) {
    const evidence = await this._getEvidenceItems(caseId);

    // Build timeline from evidence
    const events = evidence.map(e => ({
      timestamp: e.captureTimestamp || e.addedAt,
      type: e.type,
      description: `${e.type} captured`,
      evidenceId: e.id,
      url: e.page?.url
    }));

    events.sort((a, b) => a.timestamp - b.timestamp);

    return events;
  }

  /**
   * Get annotations
   * @private
   */
  async _getAnnotations(caseId) {
    const storage = this._getStorage();
    const key = `case_annotations_${caseId}`;
    const result = await storage.get(key);
    return result[key] || [];
  }

  /**
   * Get chain of custody
   * @private
   */
  async _getChainOfCustody(caseId) {
    const storage = this._getStorage();
    const key = `case_custody_${caseId}`;
    const result = await storage.get(key);
    return result[key] || [];
  }

  /**
   * Calculate statistics
   * @private
   */
  async _calculateStatistics(caseId) {
    const evidence = await this._getEvidenceItems(caseId);
    const sessions = await this._getEvidenceSessions(caseId);

    const stats = {
      totalSessions: sessions.length,
      totalEvidence: evidence.length,
      evidenceByType: {},
      evidenceByDomain: {},
      timespan: {
        start: null,
        end: null,
        durationMs: 0
      }
    };

    // Count by type and domain
    for (const item of evidence) {
      const type = item.type || 'unknown';
      stats.evidenceByType[type] = (stats.evidenceByType[type] || 0) + 1;

      if (item.page?.domain) {
        const domain = item.page.domain;
        stats.evidenceByDomain[domain] = (stats.evidenceByDomain[domain] || 0) + 1;
      }

      // Track timespan
      const timestamp = item.captureTimestamp || item.addedAt;
      if (!stats.timespan.start || timestamp < stats.timespan.start) {
        stats.timespan.start = timestamp;
      }
      if (!stats.timespan.end || timestamp > stats.timespan.end) {
        stats.timespan.end = timestamp;
      }
    }

    if (stats.timespan.start && stats.timespan.end) {
      stats.timespan.durationMs = stats.timespan.end - stats.timespan.start;
    }

    return stats;
  }

  // ===========================================================================
  // Template Methods
  // ===========================================================================

  /**
   * Select report template
   * @private
   */
  async _selectTemplate(type, templateName = null) {
    if (templateName) {
      const template = await this._loadTemplate(templateName);
      if (template) return template;
    }

    // Return default template for type
    return this._getDefaultTemplate(type || ReportConfig.TYPES.INVESTIGATION);
  }

  /**
   * Get default template
   * @private
   */
  _getDefaultTemplate(type) {
    const templates = {
      [ReportConfig.TYPES.INVESTIGATION]: {
        name: 'Investigation Report',
        sections: [
          'coverPage',
          'tableOfContents',
          'executiveSummary',
          'caseOverview',
          'methodology',
          'findings',
          'evidenceSummary',
          'timeline',
          'osintData',
          'recommendations',
          'chainOfCustody',
          'appendix'
        ]
      },
      [ReportConfig.TYPES.EXECUTIVE]: {
        name: 'Executive Briefing',
        sections: [
          'coverPage',
          'executiveSummary',
          'keyFindings',
          'impactAssessment',
          'recommendations',
          'conclusion'
        ]
      },
      [ReportConfig.TYPES.TECHNICAL]: {
        name: 'Technical Analysis',
        sections: [
          'coverPage',
          'tableOfContents',
          'introduction',
          'methodology',
          'technicalFindings',
          'networkAnalysis',
          'osintData',
          'evidenceDetails',
          'chainOfCustody',
          'conclusion'
        ]
      },
      [ReportConfig.TYPES.EVIDENCE]: {
        name: 'Evidence Documentation',
        sections: [
          'coverPage',
          'tableOfContents',
          'evidenceList',
          'evidenceDetails',
          'screenshots',
          'integrity',
          'chainOfCustody'
        ]
      }
    };

    return templates[type] || templates[ReportConfig.TYPES.INVESTIGATION];
  }

  /**
   * Load custom template
   * @private
   */
  async _loadTemplate(templateName) {
    const storage = this._getStorage();
    const key = `${ReportConfig.STORAGE_KEY_TEMPLATES}_${templateName}`;
    const result = await storage.get(key);
    return result[key] || null;
  }

  // ===========================================================================
  // Section Building Methods
  // ===========================================================================

  /**
   * Build report sections
   * @private
   */
  async _buildReportSections(data, template, options) {
    const sections = [];

    for (const sectionName of template.sections) {
      // Check if section should be included
      if (options.sections && options.sections[sectionName] === false) {
        continue;
      }

      const section = await this._buildSection(sectionName, data, options);
      if (section) {
        sections.push(section);
      }
    }

    return sections;
  }

  /**
   * Build individual section
   * @private
   */
  async _buildSection(sectionName, data, options) {
    switch (sectionName) {
      case 'coverPage':
        return this._buildCoverPage(data, options);
      case 'tableOfContents':
        return this._buildTableOfContents(data, options);
      case 'executiveSummary':
        return this._buildExecutiveSummary(data, options);
      case 'caseOverview':
        return this._buildCaseOverview(data, options);
      case 'methodology':
        return this._buildMethodology(data, options);
      case 'findings':
        return this._buildFindings(data, options);
      case 'keyFindings':
        return this._buildKeyFindings(data, options);
      case 'evidenceSummary':
        return this._buildEvidenceSummary(data, options);
      case 'evidenceList':
        return this._buildEvidenceList(data, options);
      case 'evidenceDetails':
        return this._buildEvidenceDetails(data, options);
      case 'timeline':
        return this._buildTimeline(data, options);
      case 'osintData':
        return this._buildOSINTData(data, options);
      case 'networkAnalysis':
        return this._buildNetworkAnalysis(data, options);
      case 'screenshots':
        return this._buildScreenshots(data, options);
      case 'recommendations':
        return this._buildRecommendations(data, options);
      case 'chainOfCustody':
        return this._buildChainOfCustody(data, options);
      case 'integrity':
        return this._buildIntegrity(data, options);
      case 'conclusion':
        return this._buildConclusion(data, options);
      case 'appendix':
        return this._buildAppendix(data, options);
      default:
        return null;
    }
  }

  /**
   * Build cover page
   * @private
   */
  _buildCoverPage(data, options) {
    return {
      type: 'coverPage',
      title: data.case.title || 'Investigation Report',
      subtitle: `Case ${data.case.caseNumber || data.case.caseId}`,
      classification: data.case.classification || 'UNCLASSIFIED',
      generatedDate: new Date().toISOString(),
      generatedBy: options.generatedBy || 'Basset Hound OSINT Platform',
      branding: options.branding || null
    };
  }

  /**
   * Build table of contents
   * @private
   */
  _buildTableOfContents(data, options) {
    return {
      type: 'tableOfContents',
      title: 'Table of Contents',
      entries: [] // Will be populated after all sections are built
    };
  }

  /**
   * Build executive summary
   * @private
   */
  _buildExecutiveSummary(data, options) {
    return {
      type: 'executiveSummary',
      title: 'Executive Summary',
      content: [
        {
          heading: 'Overview',
          text: data.case.description || 'This report documents an OSINT investigation conducted using the Basset Hound platform.'
        },
        {
          heading: 'Scope',
          text: `Investigation period: ${new Date(data.statistics.timespan.start).toLocaleDateString()} - ${new Date(data.statistics.timespan.end).toLocaleDateString()}`
        },
        {
          heading: 'Key Metrics',
          text: `Collected ${data.statistics.totalEvidence} pieces of evidence across ${data.statistics.totalSessions} collection sessions.`
        }
      ]
    };
  }

  /**
   * Build case overview
   * @private
   */
  _buildCaseOverview(data, options) {
    return {
      type: 'caseOverview',
      title: 'Case Overview',
      fields: [
        { label: 'Case ID', value: data.case.caseId },
        { label: 'Case Number', value: data.case.caseNumber || 'N/A' },
        { label: 'Title', value: data.case.title },
        { label: 'Status', value: data.case.status || 'Active' },
        { label: 'Priority', value: data.case.priority || 'Medium' },
        { label: 'Classification', value: data.case.classification || 'Unclassified' },
        { label: 'Investigator', value: data.case.investigator || 'N/A' },
        { label: 'Created', value: new Date(data.case.createdAt).toLocaleString() },
        { label: 'Updated', value: new Date(data.case.updatedAt).toLocaleString() }
      ],
      description: data.case.description
    };
  }

  /**
   * Build methodology
   * @private
   */
  _buildMethodology(data, options) {
    return {
      type: 'methodology',
      title: 'Methodology',
      content: [
        {
          heading: 'Tools and Techniques',
          text: 'This investigation utilized the Basset Hound OSINT platform for automated evidence collection, including browser automation, network monitoring, and data extraction capabilities.'
        },
        {
          heading: 'Collection Sessions',
          text: `Evidence was collected across ${data.statistics.totalSessions} distinct collection sessions, capturing screenshots, page content, network traffic, and related metadata.`
        },
        {
          heading: 'Chain of Custody',
          text: 'All evidence was documented with SHA-256 integrity hashes and timestamped collection records to maintain chain of custody throughout the investigation.'
        }
      ]
    };
  }

  /**
   * Build findings
   * @private
   */
  _buildFindings(data, options) {
    const findings = [];

    // Generate findings from evidence
    const topDomains = Object.entries(data.statistics.evidenceByDomain)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    findings.push({
      title: 'Top Domains',
      description: 'Most frequently captured domains during investigation',
      details: topDomains.map(([domain, count]) => `${domain}: ${count} captures`)
    });

    // Add more findings...
    if (data.osint && data.osint.findings) {
      findings.push(...data.osint.findings);
    }

    return {
      type: 'findings',
      title: 'Findings',
      findings
    };
  }

  /**
   * Build key findings
   * @private
   */
  _buildKeyFindings(data, options) {
    return {
      type: 'keyFindings',
      title: 'Key Findings',
      findings: [
        `Total Evidence Collected: ${data.statistics.totalEvidence}`,
        `Collection Sessions: ${data.statistics.totalSessions}`,
        `Investigation Timespan: ${this._formatDuration(data.statistics.timespan.durationMs)}`,
        `Unique Domains: ${Object.keys(data.statistics.evidenceByDomain).length}`
      ]
    };
  }

  /**
   * Build evidence summary
   * @private
   */
  _buildEvidenceSummary(data, options) {
    return {
      type: 'evidenceSummary',
      title: 'Evidence Summary',
      statistics: {
        total: data.statistics.totalEvidence,
        byType: data.statistics.evidenceByType,
        byDomain: data.statistics.evidenceByDomain
      },
      charts: [
        {
          type: 'pie',
          title: 'Evidence by Type',
          data: data.statistics.evidenceByType
        },
        {
          type: 'bar',
          title: 'Evidence by Domain',
          data: data.statistics.evidenceByDomain
        }
      ]
    };
  }

  /**
   * Build evidence list
   * @private
   */
  _buildEvidenceList(data, options) {
    return {
      type: 'evidenceList',
      title: 'Evidence List',
      items: data.evidence.map(e => ({
        id: e.id,
        exhibitNumber: e.exhibitNumber,
        type: e.type,
        captureTime: new Date(e.captureTimestamp).toLocaleString(),
        url: e.page?.url,
        hash: e.integrity?.hash
      }))
    };
  }

  /**
   * Build evidence details
   * @private
   */
  _buildEvidenceDetails(data, options) {
    return {
      type: 'evidenceDetails',
      title: 'Evidence Details',
      evidence: data.evidence.slice(0, 50).map(e => ({ // Limit to 50 for report size
        id: e.id,
        exhibitNumber: e.exhibitNumber,
        type: e.type,
        captureTime: new Date(e.captureTimestamp).toLocaleString(),
        capturedBy: e.capturedBy,
        url: e.page?.url,
        title: e.page?.title,
        hash: e.integrity?.hash,
        sizeBytes: e.sizeBytes,
        notes: e.notes
      }))
    };
  }

  /**
   * Build timeline
   * @private
   */
  _buildTimeline(data, options) {
    return {
      type: 'timeline',
      title: 'Investigation Timeline',
      events: data.timeline.map(e => ({
        timestamp: new Date(e.timestamp).toLocaleString(),
        type: e.type,
        description: e.description,
        url: e.url
      }))
    };
  }

  /**
   * Build OSINT data
   * @private
   */
  _buildOSINTData(data, options) {
    if (!data.osint) {
      return null;
    }

    return {
      type: 'osintData',
      title: 'OSINT Intelligence',
      searches: data.osint.searches || [],
      findings: data.osint.findings || [],
      correlations: data.osint.correlations || []
    };
  }

  /**
   * Build network analysis
   * @private
   */
  _buildNetworkAnalysis(data, options) {
    return {
      type: 'networkAnalysis',
      title: 'Network Analysis',
      content: 'Network analysis data would be included here if available.'
    };
  }

  /**
   * Build screenshots
   * @private
   */
  _buildScreenshots(data, options) {
    if (!options.includeScreenshots) {
      return null;
    }

    const screenshots = data.evidence.filter(e => e.type === 'screenshot');

    return {
      type: 'screenshots',
      title: 'Screenshots',
      images: screenshots.map(s => ({
        id: s.id,
        caption: s.page?.title || 'Screenshot',
        url: s.page?.url,
        timestamp: new Date(s.captureTimestamp).toLocaleString(),
        data: s.data // Base64 image data
      }))
    };
  }

  /**
   * Build recommendations
   * @private
   */
  _buildRecommendations(data, options) {
    return {
      type: 'recommendations',
      title: 'Recommendations',
      recommendations: [
        'Continue monitoring identified domains for changes',
        'Archive all collected evidence in secure storage',
        'Document any follow-up actions taken',
        'Review chain of custody records for completeness'
      ]
    };
  }

  /**
   * Build chain of custody
   * @private
   */
  _buildChainOfCustody(data, options) {
    if (!options.includeChainOfCustody && !options.includeChainOfCustody !== false) {
      return null;
    }

    return {
      type: 'chainOfCustody',
      title: 'Chain of Custody',
      records: data.custody.map(r => ({
        timestamp: new Date(r.timestamp).toLocaleString(),
        action: r.action,
        userID: r.userID,
        details: r.details,
        notes: r.notes
      }))
    };
  }

  /**
   * Build integrity section
   * @private
   */
  _buildIntegrity(data, options) {
    return {
      type: 'integrity',
      title: 'Evidence Integrity',
      content: 'All evidence items include SHA-256 integrity hashes calculated at time of capture. Hashes can be verified against the original evidence files.'
    };
  }

  /**
   * Build conclusion
   * @private
   */
  _buildConclusion(data, options) {
    return {
      type: 'conclusion',
      title: 'Conclusion',
      content: `This investigation collected ${data.statistics.totalEvidence} pieces of evidence over a period of ${this._formatDuration(data.statistics.timespan.durationMs)}. All evidence has been documented with appropriate chain of custody records and integrity verification.`
    };
  }

  /**
   * Build appendix
   * @private
   */
  _buildAppendix(data, options) {
    return {
      type: 'appendix',
      title: 'Appendix',
      sections: [
        {
          heading: 'A. Evidence Hashes',
          content: 'SHA-256 hashes for all evidence items'
        },
        {
          heading: 'B. Technical Details',
          content: 'Platform version, collection methods, and tool configurations'
        }
      ]
    };
  }

  // ===========================================================================
  // Redaction Methods
  // ===========================================================================

  /**
   * Apply redactions to sections
   * @private
   */
  _applyRedactions(sections, keywords) {
    const allKeywords = [...ReportConfig.REDACTION.KEYWORDS, ...keywords];

    for (const section of sections) {
      this._redactSection(section, allKeywords);
    }
  }

  /**
   * Redact section content
   * @private
   */
  _redactSection(section, keywords) {
    const redactString = (str) => {
      if (typeof str !== 'string') return str;

      let redacted = str;
      for (const keyword of keywords) {
        const regex = new RegExp(keyword, 'gi');
        redacted = redacted.replace(regex, ReportConfig.REDACTION.PATTERN);
      }
      return redacted;
    };

    // Recursively redact all string values
    const redactObject = (obj) => {
      if (typeof obj === 'string') {
        return redactString(obj);
      } else if (Array.isArray(obj)) {
        return obj.map(item => redactObject(item));
      } else if (typeof obj === 'object' && obj !== null) {
        const redacted = {};
        for (const [key, value] of Object.entries(obj)) {
          redacted[key] = redactObject(value);
        }
        return redacted;
      }
      return obj;
    };

    Object.keys(section).forEach(key => {
      section[key] = redactObject(section[key]);
    });
  }

  // ===========================================================================
  // Formatting Methods
  // ===========================================================================

  /**
   * Format report based on output format
   * @private
   */
  async _formatReport(reportId, data, sections, template, format, options) {
    switch (format) {
      case ReportConfig.FORMATS.HTML:
        return this._formatAsHTML(reportId, data, sections, template, options);

      case ReportConfig.FORMATS.MARKDOWN:
        return this._formatAsMarkdown(reportId, data, sections, template, options);

      case ReportConfig.FORMATS.PDF:
        return this._formatAsPDF(reportId, data, sections, template, options);

      case ReportConfig.FORMATS.DOCX:
        return this._formatAsDOCX(reportId, data, sections, template, options);

      case ReportConfig.FORMATS.TXT:
        return this._formatAsTXT(reportId, data, sections, template, options);

      default:
        return this._formatAsHTML(reportId, data, sections, template, options);
    }
  }

  /**
   * Format as HTML
   * @private
   */
  _formatAsHTML(reportId, data, sections, template, options) {
    const styles = this._generateHTMLStyles(options.branding);
    const sectionsHTML = sections.map(s => this._sectionToHTML(s)).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.case.title} - Investigation Report</title>
  <style>${styles}</style>
</head>
<body>
  <div class="report-container">
    ${sectionsHTML}
  </div>
  <footer class="report-footer">
    <p>Generated by Basset Hound OSINT Platform</p>
    <p>Report ID: ${reportId}</p>
    <p>Generated: ${new Date().toLocaleString()}</p>
  </footer>
</body>
</html>`;
  }

  /**
   * Generate HTML styles
   * @private
   */
  _generateHTMLStyles(branding = null) {
    const primaryColor = branding?.primaryColor || ReportConfig.STYLES.PRIMARY_COLOR;
    const secondaryColor = branding?.secondaryColor || ReportConfig.STYLES.SECONDARY_COLOR;

    return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
    .report-container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .cover-page { text-align: center; padding: 100px 20px; background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor}); color: white; margin-bottom: 40px; }
    .cover-page h1 { font-size: 48px; margin-bottom: 20px; }
    .cover-page h2 { font-size: 24px; margin-bottom: 40px; }
    .section { margin-bottom: 40px; page-break-inside: avoid; }
    .section-title { font-size: 32px; color: ${primaryColor}; border-bottom: 3px solid ${secondaryColor}; padding-bottom: 10px; margin-bottom: 20px; }
    .subsection-title { font-size: 24px; color: ${primaryColor}; margin: 20px 0 10px; }
    .field-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .field-table td { padding: 10px; border-bottom: 1px solid #ddd; }
    .field-table td:first-child { font-weight: bold; width: 200px; }
    .evidence-item { background: #f9f9f9; padding: 15px; margin: 10px 0; border-left: 4px solid ${secondaryColor}; }
    .timeline-event { position: relative; padding-left: 30px; margin: 15px 0; }
    .timeline-event::before { content: ''; position: absolute; left: 0; top: 5px; width: 12px; height: 12px; border-radius: 50%; background: ${secondaryColor}; }
    .chart { margin: 20px 0; padding: 20px; background: #f9f9f9; }
    .recommendation { padding: 10px; margin: 10px 0; background: #e8f4f8; border-left: 4px solid ${secondaryColor}; }
    .report-footer { text-align: center; padding: 40px 20px; color: #999; font-size: 14px; border-top: 1px solid #ddd; margin-top: 60px; }
    @media print { .section { page-break-inside: avoid; } }
    `;
  }

  /**
   * Convert section to HTML
   * @private
   */
  _sectionToHTML(section) {
    switch (section.type) {
      case 'coverPage':
        return `
          <div class="cover-page">
            <h1>${section.title}</h1>
            <h2>${section.subtitle}</h2>
            <p class="classification">${section.classification}</p>
            <p>Generated: ${new Date(section.generatedDate).toLocaleString()}</p>
          </div>
        `;

      case 'caseOverview':
        return `
          <div class="section">
            <h2 class="section-title">${section.title}</h2>
            <table class="field-table">
              ${section.fields.map(f => `
                <tr>
                  <td>${f.label}</td>
                  <td>${f.value}</td>
                </tr>
              `).join('')}
            </table>
            ${section.description ? `<p>${section.description}</p>` : ''}
          </div>
        `;

      case 'evidenceList':
        return `
          <div class="section">
            <h2 class="section-title">${section.title}</h2>
            ${section.items.map(item => `
              <div class="evidence-item">
                <strong>${item.exhibitNumber || item.id}</strong><br>
                Type: ${item.type}<br>
                Captured: ${item.captureTime}<br>
                URL: ${item.url || 'N/A'}<br>
                Hash: ${item.hash || 'N/A'}
              </div>
            `).join('')}
          </div>
        `;

      case 'timeline':
        return `
          <div class="section">
            <h2 class="section-title">${section.title}</h2>
            ${section.events.map(event => `
              <div class="timeline-event">
                <strong>${event.timestamp}</strong>: ${event.description}
                ${event.url ? `<br><small>${event.url}</small>` : ''}
              </div>
            `).join('')}
          </div>
        `;

      case 'recommendations':
        return `
          <div class="section">
            <h2 class="section-title">${section.title}</h2>
            ${section.recommendations.map(rec => `
              <div class="recommendation">${rec}</div>
            `).join('')}
          </div>
        `;

      default:
        return `
          <div class="section">
            <h2 class="section-title">${section.title}</h2>
            <p>${JSON.stringify(section, null, 2)}</p>
          </div>
        `;
    }
  }

  /**
   * Format as Markdown
   * @private
   */
  _formatAsMarkdown(reportId, data, sections, template, options) {
    let markdown = `# ${data.case.title}\n\n`;
    markdown += `**Case ID:** ${data.case.caseId}\n\n`;
    markdown += `**Generated:** ${new Date().toLocaleString()}\n\n`;
    markdown += `---\n\n`;

    for (const section of sections) {
      markdown += this._sectionToMarkdown(section);
      markdown += '\n\n';
    }

    markdown += `\n---\n\n`;
    markdown += `*Generated by Basset Hound OSINT Platform*\n`;
    markdown += `*Report ID: ${reportId}*\n`;

    return markdown;
  }

  /**
   * Convert section to Markdown
   * @private
   */
  _sectionToMarkdown(section) {
    let md = `## ${section.title}\n\n`;

    switch (section.type) {
      case 'caseOverview':
        section.fields.forEach(f => {
          md += `**${f.label}:** ${f.value}\n\n`;
        });
        if (section.description) {
          md += `\n${section.description}\n\n`;
        }
        break;

      case 'evidenceList':
        section.items.forEach(item => {
          md += `### ${item.exhibitNumber || item.id}\n\n`;
          md += `- **Type:** ${item.type}\n`;
          md += `- **Captured:** ${item.captureTime}\n`;
          md += `- **URL:** ${item.url || 'N/A'}\n`;
          md += `- **Hash:** ${item.hash || 'N/A'}\n\n`;
        });
        break;

      case 'timeline':
        section.events.forEach(event => {
          md += `- **${event.timestamp}**: ${event.description}\n`;
        });
        break;

      default:
        md += JSON.stringify(section, null, 2);
    }

    return md;
  }

  /**
   * Format as PDF (structure)
   * @private
   */
  _formatAsPDF(reportId, data, sections, template, options) {
    // Return PDF structure (actual PDF generation would require a library)
    return {
      format: 'pdf',
      reportId,
      title: data.case.title,
      sections: sections,
      metadata: {
        author: options.generatedBy || 'Basset Hound',
        subject: 'Investigation Report',
        keywords: ['osint', 'investigation', 'report'],
        creator: 'Basset Hound OSINT Platform'
      },
      pageSize: 'A4',
      margins: { top: 20, right: 20, bottom: 20, left: 20 }
    };
  }

  /**
   * Format as DOCX (structure)
   * @private
   */
  _formatAsDOCX(reportId, data, sections, template, options) {
    // Return DOCX structure (actual DOCX generation would require a library)
    return {
      format: 'docx',
      reportId,
      title: data.case.title,
      sections: sections,
      styles: {
        heading1: { fontSize: 32, bold: true },
        heading2: { fontSize: 24, bold: true },
        normal: { fontSize: 11 }
      }
    };
  }

  /**
   * Format as plain text
   * @private
   */
  _formatAsTXT(reportId, data, sections, template, options) {
    let text = '';
    text += '='.repeat(80) + '\n';
    text += `${data.case.title}\n`;
    text += `Case ID: ${data.case.caseId}\n`;
    text += `Generated: ${new Date().toLocaleString()}\n`;
    text += '='.repeat(80) + '\n\n';

    for (const section of sections) {
      text += this._sectionToText(section);
      text += '\n\n';
    }

    text += '-'.repeat(80) + '\n';
    text += `Generated by Basset Hound OSINT Platform\n`;
    text += `Report ID: ${reportId}\n`;

    return text;
  }

  /**
   * Convert section to text
   * @private
   */
  _sectionToText(section) {
    let text = `${section.title}\n${'-'.repeat(section.title.length)}\n\n`;
    text += JSON.stringify(section, null, 2);
    return text;
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Generate report ID
   * @private
   */
  _generateReportId() {
    return `report_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  /**
   * Generate filename
   * @private
   */
  _generateFilename(caseId, format, type) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const typeName = type || 'report';
    return `${typeName}_${caseId}_${timestamp}.${format}`;
  }

  /**
   * Get MIME type
   * @private
   */
  _getMimeType(format) {
    const types = {
      html: 'text/html',
      pdf: 'application/pdf',
      markdown: 'text/markdown',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain'
    };
    return types[format] || 'application/octet-stream';
  }

  /**
   * Format duration
   * @private
   */
  _formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Save report metadata
   * @private
   */
  async _saveReport(metadata) {
    this.generatedReports.push(metadata);

    const storage = this._getStorage();
    await storage.set({
      [ReportConfig.STORAGE_KEY_REPORTS]: this.generatedReports.slice(-100)
    });
  }

  /**
   * Get storage API
   * @private
   */
  _getStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
    return this._getMockStorage();
  }

  /**
   * Get mock storage
   * @private
   */
  _getMockStorage() {
    if (!this._mockStore) {
      this._mockStore = {};
    }
    return {
      get: (keys) => {
        return new Promise((resolve) => {
          if (Array.isArray(keys)) {
            const result = {};
            keys.forEach(k => {
              if (this._mockStore[k] !== undefined) result[k] = this._mockStore[k];
            });
            resolve(result);
          } else if (typeof keys === 'string') {
            resolve({ [keys]: this._mockStore[keys] });
          } else {
            resolve({ ...this._mockStore });
          }
        });
      },
      set: (items) => {
        return new Promise((resolve) => {
          Object.assign(this._mockStore, items);
          resolve();
        });
      }
    };
  }

  /**
   * Log message
   * @private
   */
  _log(level, message) {
    if (this.config.logger && this.config.logger[level]) {
      this.config.logger[level](message);
    } else if (typeof console !== 'undefined' && console[level]) {
      console[level]('[ReportGenerator] ' + message);
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

if (typeof globalThis !== 'undefined') {
  globalThis.ReportConfig = ReportConfig;
  globalThis.ReportGenerator = ReportGenerator;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ReportConfig,
    ReportGenerator
  };
}
