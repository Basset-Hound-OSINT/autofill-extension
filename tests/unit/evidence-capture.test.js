/**
 * Unit Tests for Evidence Capture Module
 * Phase 11.1: Evidence Bundling for Law Enforcement
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock chrome API
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    lastError: null
  },
  tabs: {
    captureVisibleTab: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

// Mock crypto for SHA-256
const crypto = require('crypto');
global.crypto = {
  subtle: {
    digest: jest.fn(async (algo, data) => {
      const hash = crypto.createHash('sha256').update(Buffer.from(data)).digest();
      return hash.buffer;
    })
  }
};

global.TextEncoder = require('util').TextEncoder;

// Mock window and document
const mockDocument = {
  title: 'Test Evidence Page',
  body: {
    innerText: 'Sample evidence content'
  },
  documentElement: {
    lang: 'en',
    outerHTML: '<html><head></head><body>Test content</body></html>'
  },
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(() => []),
  createElement: jest.fn(() => ({
    className: '',
    style: {},
    innerHTML: '',
    appendChild: jest.fn(),
    remove: jest.fn()
  })),
  contentType: 'text/html',
  characterSet: 'UTF-8',
  lastModified: new Date().toISOString()
};

const mockWindow = {
  location: {
    href: 'https://evidence.example.com/case/12345',
    hostname: 'evidence.example.com',
    pathname: '/case/12345',
    hash: '',
    search: '',
    protocol: 'https:'
  },
  innerWidth: 1920,
  innerHeight: 1080,
  scrollX: 0,
  scrollY: 0,
  devicePixelRatio: 1,
  getComputedStyle: jest.fn(() => ({
    display: 'block',
    visibility: 'visible',
    position: 'static',
    backgroundColor: 'white',
    color: 'black',
    fontSize: '16px',
    fontFamily: 'Arial'
  }))
};

global.document = mockDocument;
global.window = mockWindow;
global.navigator = {
  userAgent: 'Mozilla/5.0 Evidence Test Agent'
};
global.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };
global.Blob = class Blob {
  constructor(parts) {
    this.parts = parts;
    this.size = parts.reduce((acc, p) => acc + (typeof p === 'string' ? p.length : 0), 0);
  }
};

// =============================================================================
// EvidenceCapture Tests
// =============================================================================

describe('EvidenceCapture', () => {
  let EvidenceCapture, EvidenceStatus, EvidenceType, CaptureQuality;

  beforeEach(() => {
    jest.resetModules();
    const evidenceModule = require('../../utils/evidence/evidence-capture.js');
    EvidenceCapture = evidenceModule.EvidenceCapture;
    EvidenceStatus = evidenceModule.EvidenceStatus;
    EvidenceType = evidenceModule.EvidenceType;
    CaptureQuality = evidenceModule.CaptureQuality;

    // Reset mocks
    chrome.tabs.captureVisibleTab.mockReset();
    chrome.runtime.sendMessage.mockReset();
  });

  describe('Constructor', () => {
    it('should create instance with default config', () => {
      const capture = new EvidenceCapture();

      expect(capture.config.examinerID).toBeNull();
      expect(capture.config.caseNumber).toBeNull();
      expect(capture.config.autoInitCustody).toBe(true);
      expect(capture.config.defaultQuality).toBe('HIGH');
      expect(capture.evidenceItems.size).toBe(0);
    });

    it('should create instance with custom config', () => {
      const capture = new EvidenceCapture({
        examinerID: 'EXM-001',
        caseNumber: 'CASE-2024-001',
        defaultQuality: 'MEDIUM'
      });

      expect(capture.config.examinerID).toBe('EXM-001');
      expect(capture.config.caseNumber).toBe('CASE-2024-001');
      expect(capture.config.defaultQuality).toBe('MEDIUM');
    });
  });

  describe('Evidence Types', () => {
    it('should define all evidence types', () => {
      expect(EvidenceType.SCREENSHOT).toBe('screenshot');
      expect(EvidenceType.PAGE_CONTENT).toBe('page_content');
      expect(EvidenceType.ELEMENT_DATA).toBe('element_data');
      expect(EvidenceType.NETWORK_DATA).toBe('network_data');
    });

    it('should define all evidence statuses', () => {
      expect(EvidenceStatus.CAPTURED).toBe('captured');
      expect(EvidenceStatus.VERIFIED).toBe('verified');
      expect(EvidenceStatus.EXPORTED).toBe('exported');
      expect(EvidenceStatus.SEALED).toBe('sealed');
    });

    it('should define capture quality settings', () => {
      expect(CaptureQuality.LOW.format).toBe('jpeg');
      expect(CaptureQuality.LOW.quality).toBe(60);
      expect(CaptureQuality.HIGH.format).toBe('png');
      expect(CaptureQuality.HIGH.quality).toBe(100);
    });
  });

  describe('Screenshot Capture', () => {
    it('should capture screenshot with metadata', async () => {
      const mockDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      chrome.tabs.captureVisibleTab.mockImplementation((windowId, options, callback) => {
        callback(mockDataUrl);
      });

      const capture = new EvidenceCapture({
        examinerID: 'EXM-001',
        caseNumber: 'CASE-2024-001'
      });

      const result = await capture.captureScreenshot({
        notes: 'Test screenshot'
      });

      expect(result.success).toBe(true);
      expect(result.evidenceId).toBeDefined();
      expect(result.hash).toBeDefined();
      expect(result.evidence.type).toBe('screenshot');
      expect(result.evidence.status).toBe('captured');
      expect(result.evidence.caseNumber).toBe('CASE-2024-001');
      expect(result.evidence.examinerID).toBe('EXM-001');
    });

    it('should generate exhibit numbers sequentially', async () => {
      chrome.tabs.captureVisibleTab.mockImplementation((windowId, options, callback) => {
        callback('data:image/png;base64,test');
      });

      const capture = new EvidenceCapture();

      const result1 = await capture.captureScreenshot();
      const result2 = await capture.captureScreenshot();

      expect(result1.evidence.exhibitNumber).toBe('EXH-0001');
      expect(result2.evidence.exhibitNumber).toBe('EXH-0002');
    });

    it('should handle screenshot failure', async () => {
      chrome.tabs.captureVisibleTab.mockImplementation((windowId, options, callback) => {
        chrome.runtime.lastError = { message: 'Cannot capture' };
        callback(null);
        chrome.runtime.lastError = null;
      });

      const capture = new EvidenceCapture();
      const result = await capture.captureScreenshot();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Page Content Capture', () => {
    it('should capture page content as evidence', async () => {
      const capture = new EvidenceCapture({
        examinerID: 'EXM-002',
        caseNumber: 'CASE-2024-002'
      });

      const result = await capture.capturePageContent({
        notes: 'Full page capture'
      });

      expect(result.success).toBe(true);
      expect(result.evidenceId).toBeDefined();
      expect(result.hash).toBeDefined();
      expect(result.evidence.type).toBe('page_content');
      expect(result.evidence.format).toBe('html');
    });

    it('should capture specific element by selector', async () => {
      const mockElement = {
        outerHTML: '<div id="target">Test content</div>'
      };
      mockDocument.querySelector.mockReturnValue(mockElement);

      const capture = new EvidenceCapture();
      const result = await capture.capturePageContent({
        selector: '#target'
      });

      expect(result.success).toBe(true);
      expect(result.evidence.captureMethod).toBe('element_capture');
    });

    it('should fail gracefully for invalid selector', async () => {
      mockDocument.querySelector.mockReturnValue(null);

      const capture = new EvidenceCapture();
      const result = await capture.capturePageContent({
        selector: '#nonexistent'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Element Capture', () => {
    it('should capture element data with full context', async () => {
      const mockElement = {
        tagName: 'DIV',
        id: 'evidence-element',
        className: 'content-box',
        outerHTML: '<div id="evidence-element" class="content-box">Content</div>',
        innerText: 'Content',
        attributes: [
          { name: 'id', value: 'evidence-element' },
          { name: 'class', value: 'content-box' }
        ],
        getBoundingClientRect: () => ({
          top: 100, left: 50, width: 300, height: 200, bottom: 300, right: 350
        }),
        parentElement: null,
        previousElementSibling: null,
        nodeType: 1
      };

      const capture = new EvidenceCapture();
      const result = await capture.captureElement(mockElement);

      expect(result.success).toBe(true);
      expect(result.evidence.type).toBe('element_data');
      expect(result.evidence.format).toBe('json');
    });

    it('should capture element by selector', async () => {
      const mockElement = {
        tagName: 'SPAN',
        id: 'test-span',
        className: '',
        outerHTML: '<span id="test-span">Test</span>',
        innerText: 'Test',
        attributes: [{ name: 'id', value: 'test-span' }],
        getBoundingClientRect: () => ({ top: 0, left: 0, width: 100, height: 20, bottom: 20, right: 100 }),
        parentElement: null,
        previousElementSibling: null,
        nodeType: 1
      };

      mockDocument.querySelector.mockReturnValue(mockElement);

      const capture = new EvidenceCapture();
      const result = await capture.captureElement('#test-span');

      expect(result.success).toBe(true);
    });
  });

  describe('Evidence Management', () => {
    it('should retrieve evidence by ID', async () => {
      chrome.tabs.captureVisibleTab.mockImplementation((windowId, options, callback) => {
        callback('data:image/png;base64,test');
      });

      const capture = new EvidenceCapture();
      const captureResult = await capture.captureScreenshot();

      const result = capture.getEvidence(captureResult.evidenceId);

      expect(result.success).toBe(true);
      expect(result.evidence.id).toBe(captureResult.evidenceId);
    });

    it('should return error for non-existent evidence', () => {
      const capture = new EvidenceCapture();
      const result = capture.getEvidence('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Evidence not found');
    });

    it('should list evidence with filters', async () => {
      chrome.tabs.captureVisibleTab.mockImplementation((windowId, options, callback) => {
        callback('data:image/png;base64,test');
      });

      const capture = new EvidenceCapture({ caseNumber: 'CASE-001' });
      await capture.captureScreenshot();
      await capture.captureScreenshot();
      await capture.capturePageContent();

      const result = capture.listEvidence({ type: 'screenshot' });

      expect(result.success).toBe(true);
      expect(result.items.length).toBe(2);
      expect(result.pagination.total).toBe(2);
    });
  });

  describe('Evidence Verification', () => {
    it('should verify evidence integrity', async () => {
      chrome.tabs.captureVisibleTab.mockImplementation((windowId, options, callback) => {
        callback('data:image/png;base64,test');
      });

      const capture = new EvidenceCapture();
      const captureResult = await capture.captureScreenshot();

      const verifyResult = await capture.verifyEvidence(captureResult.evidenceId);

      expect(verifyResult.success).toBe(true);
      expect(verifyResult.isIntact).toBe(true);
      expect(verifyResult.originalHash).toBe(verifyResult.currentHash);
    });

    it('should detect integrity violations', async () => {
      chrome.tabs.captureVisibleTab.mockImplementation((windowId, options, callback) => {
        callback('data:image/png;base64,test');
      });

      const capture = new EvidenceCapture();
      const captureResult = await capture.captureScreenshot();

      // Modify the evidence data
      const evidence = capture.evidenceItems.get(captureResult.evidenceId);
      evidence.data = 'modified data';

      const verifyResult = await capture.verifyEvidence(captureResult.evidenceId);

      expect(verifyResult.success).toBe(true);
      expect(verifyResult.isIntact).toBe(false);
      expect(verifyResult.originalHash).not.toBe(verifyResult.currentHash);
    });
  });

  describe('Evidence Export', () => {
    it('should export evidence in NIST-DF compatible format', async () => {
      chrome.tabs.captureVisibleTab.mockImplementation((windowId, options, callback) => {
        callback('data:image/png;base64,test');
      });

      const capture = new EvidenceCapture({
        examinerID: 'EXM-001',
        caseNumber: 'CASE-2024-001'
      });

      const captureResult = await capture.captureScreenshot();
      const exportResult = await capture.exportEvidence(captureResult.evidenceId);

      expect(exportResult.success).toBe(true);
      expect(exportResult.export.exportMetadata.standard).toBe('NIST-DF');
      expect(exportResult.export.evidence.case.caseNumber).toBe('CASE-2024-001');
      expect(exportResult.export.chainOfCustody).toBeDefined();
      expect(exportResult.exportHash).toBeDefined();
    });

    it('should export case bundle with multiple evidence items', async () => {
      chrome.tabs.captureVisibleTab.mockImplementation((windowId, options, callback) => {
        callback('data:image/png;base64,test');
      });

      const capture = new EvidenceCapture({ caseNumber: 'CASE-BUNDLE-001' });
      const result1 = await capture.captureScreenshot();
      const result2 = await capture.capturePageContent();

      const bundleResult = await capture.exportCaseBundle([result1.evidenceId, result2.evidenceId]);

      expect(bundleResult.success).toBe(true);
      expect(bundleResult.evidenceCount).toBe(2);
      expect(bundleResult.bundle.caseMetadata.caseNumber).toBe('CASE-BUNDLE-001');
      expect(bundleResult.bundleHash).toBeDefined();
    });
  });

  describe('Chain of Custody', () => {
    it('should initialize chain of custody on capture', async () => {
      chrome.tabs.captureVisibleTab.mockImplementation((windowId, options, callback) => {
        callback('data:image/png;base64,test');
      });

      const capture = new EvidenceCapture({
        examinerID: 'EXM-001',
        autoInitCustody: true
      });

      const captureResult = await capture.captureScreenshot();
      const custody = capture.getChainOfCustody(captureResult.evidenceId);

      expect(custody.success).toBe(true);
      expect(custody.recordCount).toBe(1);
      expect(custody.chainOfCustody[0].action).toBe('captured');
      expect(custody.chainOfCustody[0].userID).toBe('EXM-001');
    });

    it('should record custody events', async () => {
      chrome.tabs.captureVisibleTab.mockImplementation((windowId, options, callback) => {
        callback('data:image/png;base64,test');
      });

      const capture = new EvidenceCapture({ examinerID: 'EXM-001' });
      const captureResult = await capture.captureScreenshot();

      capture.recordCustodyEvent(captureResult.evidenceId, 'viewed', {
        userID: 'EXM-002',
        notes: 'Evidence reviewed'
      });

      const custody = capture.getChainOfCustody(captureResult.evidenceId);

      expect(custody.recordCount).toBe(2);
      expect(custody.chainOfCustody[1].action).toBe('viewed');
      expect(custody.chainOfCustody[1].userID).toBe('EXM-002');
    });
  });

  describe('Configuration', () => {
    it('should update case number', () => {
      const capture = new EvidenceCapture({ caseNumber: 'OLD-001' });
      const result = capture.setCaseNumber('NEW-002');

      expect(result.success).toBe(true);
      expect(result.previousCaseNumber).toBe('OLD-001');
      expect(result.newCaseNumber).toBe('NEW-002');
    });

    it('should update examiner ID', () => {
      const capture = new EvidenceCapture({ examinerID: 'EXM-001' });
      const result = capture.setExaminerID('EXM-002');

      expect(result.success).toBe(true);
      expect(result.previousExaminerID).toBe('EXM-001');
      expect(result.newExaminerID).toBe('EXM-002');
    });

    it('should return current config', () => {
      const capture = new EvidenceCapture({
        caseNumber: 'CASE-001',
        examinerID: 'EXM-001'
      });

      const result = capture.getConfig();

      expect(result.success).toBe(true);
      expect(result.config.caseNumber).toBe('CASE-001');
      expect(result.config.examinerID).toBe('EXM-001');
    });
  });

  describe('Statistics', () => {
    it('should track capture statistics', async () => {
      chrome.tabs.captureVisibleTab.mockImplementation((windowId, options, callback) => {
        callback('data:image/png;base64,test');
      });

      const capture = new EvidenceCapture();
      await capture.captureScreenshot();
      await capture.captureScreenshot();
      await capture.capturePageContent();

      const stats = capture.getStats();

      expect(stats.success).toBe(true);
      expect(stats.stats.totalCaptures).toBe(3);
      expect(stats.stats.byType.screenshot).toBe(2);
      expect(stats.stats.byType.page_content).toBe(1);
      expect(stats.evidenceCount).toBe(3);
    });
  });
});

// =============================================================================
// ChainOfCustody Tests
// =============================================================================

describe('ChainOfCustody', () => {
  let ChainOfCustody, CustodyAction, createChainOfCustody;

  beforeEach(() => {
    jest.resetModules();
    const custodyModule = require('../../utils/evidence/chain-of-custody.js');
    ChainOfCustody = custodyModule.ChainOfCustody;
    CustodyAction = custodyModule.CustodyAction;
    createChainOfCustody = custodyModule.createChainOfCustody;
  });

  describe('Constructor', () => {
    it('should create instance with evidence info', () => {
      const custody = new ChainOfCustody({
        evidenceId: 'evd_123',
        initialHash: 'abc123hash',
        createdBy: 'EXM-001'
      });

      expect(custody.config.evidenceId).toBe('evd_123');
      expect(custody.config.initialHash).toBe('abc123hash');
      expect(custody.config.createdBy).toBe('EXM-001');
      expect(custody.records.length).toBe(1);
    });

    it('should add initial capture record', () => {
      const custody = new ChainOfCustody({
        evidenceId: 'evd_123',
        initialHash: 'abc123',
        createdBy: 'EXM-001'
      });

      expect(custody.records[0].action).toBe(CustodyAction.CAPTURED);
      expect(custody.records[0].hashAfter).toBe('abc123');
    });
  });

  describe('Custody Actions', () => {
    it('should define all custody action types', () => {
      expect(CustodyAction.CAPTURED).toBe('captured');
      expect(CustodyAction.VIEWED).toBe('viewed');
      expect(CustodyAction.MODIFIED).toBe('modified');
      expect(CustodyAction.EXPORTED).toBe('exported');
      expect(CustodyAction.SHARED).toBe('shared');
      expect(CustodyAction.TRANSFERRED).toBe('transferred');
      expect(CustodyAction.VERIFIED).toBe('verified');
    });
  });

  describe('Record Access', () => {
    it('should record view access', () => {
      const custody = new ChainOfCustody({
        evidenceId: 'evd_123',
        initialHash: 'abc123',
        createdBy: 'EXM-001'
      });

      const result = custody.recordView('EXM-002', { notes: 'Reviewed evidence' });

      expect(result.success).toBe(true);
      expect(result.record.action).toBe(CustodyAction.VIEWED);
      expect(result.record.userID).toBe('EXM-002');
    });

    it('should record modification with hash change', () => {
      const custody = new ChainOfCustody({
        evidenceId: 'evd_123',
        initialHash: 'abc123',
        createdBy: 'EXM-001'
      });

      const result = custody.recordModification('EXM-002', 'abc123', 'def456', {
        notes: 'Added annotation'
      });

      expect(result.success).toBe(true);
      expect(result.record.hashBefore).toBe('abc123');
      expect(result.record.hashAfter).toBe('def456');
    });

    it('should record export', () => {
      const custody = new ChainOfCustody({
        evidenceId: 'evd_123',
        initialHash: 'abc123',
        createdBy: 'EXM-001'
      });

      const result = custody.recordExport('EXM-001', {
        format: 'json',
        destination: 'court-system'
      });

      expect(result.success).toBe(true);
      expect(result.record.additionalData.format).toBe('json');
      expect(result.record.additionalData.destination).toBe('court-system');
    });

    it('should record share with recipient', () => {
      const custody = new ChainOfCustody({
        evidenceId: 'evd_123',
        initialHash: 'abc123',
        createdBy: 'EXM-001'
      });

      const result = custody.recordShare('EXM-001', 'PROSECUTOR-001', {
        permissions: ['view', 'export']
      });

      expect(result.success).toBe(true);
      expect(result.record.additionalData.recipientID).toBe('PROSECUTOR-001');
      expect(result.record.additionalData.permissions).toEqual(['view', 'export']);
    });

    it('should record custody transfer', () => {
      const custody = new ChainOfCustody({
        evidenceId: 'evd_123',
        initialHash: 'abc123',
        createdBy: 'EXM-001'
      });

      const result = custody.recordTransfer('EXM-001', 'EXM-003', {
        reason: 'Case reassignment'
      });

      expect(result.success).toBe(true);
      expect(result.record.additionalData.fromUserID).toBe('EXM-001');
      expect(result.record.additionalData.toUserID).toBe('EXM-003');
    });

    it('should record verification', () => {
      const custody = new ChainOfCustody({
        evidenceId: 'evd_123',
        initialHash: 'abc123',
        createdBy: 'EXM-001'
      });

      const result = custody.recordVerification('EXM-002', true, 'abc123');

      expect(result.success).toBe(true);
      expect(result.record.additionalData.isValid).toBe(true);
    });
  });

  describe('Query Methods', () => {
    it('should get all records', () => {
      const custody = new ChainOfCustody({
        evidenceId: 'evd_123',
        initialHash: 'abc123',
        createdBy: 'EXM-001'
      });

      custody.recordView('EXM-002');
      custody.recordExport('EXM-001');

      const result = custody.getRecords();

      expect(result.success).toBe(true);
      expect(result.records.length).toBe(3);
    });

    it('should filter records by action', () => {
      const custody = new ChainOfCustody({
        evidenceId: 'evd_123',
        initialHash: 'abc123',
        createdBy: 'EXM-001'
      });

      custody.recordView('EXM-002');
      custody.recordView('EXM-003');
      custody.recordExport('EXM-001');

      const result = custody.getRecordsByAction(CustodyAction.VIEWED);

      expect(result.records.length).toBe(2);
    });

    it('should filter records by user', () => {
      const custody = new ChainOfCustody({
        evidenceId: 'evd_123',
        initialHash: 'abc123',
        createdBy: 'EXM-001'
      });

      custody.recordView('EXM-002');
      custody.recordView('EXM-001');
      custody.recordExport('EXM-002');

      const result = custody.getRecordsByUser('EXM-002');

      expect(result.records.length).toBe(2);
    });

    it('should get latest record', () => {
      const custody = new ChainOfCustody({
        evidenceId: 'evd_123',
        initialHash: 'abc123',
        createdBy: 'EXM-001'
      });

      custody.recordView('EXM-002');
      custody.recordExport('EXM-001');

      const result = custody.getLatestRecord();

      expect(result.success).toBe(true);
      expect(result.record.action).toBe(CustodyAction.EXPORTED);
    });

    it('should get hash history', () => {
      const custody = new ChainOfCustody({
        evidenceId: 'evd_123',
        initialHash: 'abc123',
        createdBy: 'EXM-001'
      });

      custody.recordModification('EXM-002', 'abc123', 'def456');

      const result = custody.getHashHistory();

      expect(result.success).toBe(true);
      expect(result.history.length).toBe(1);
      expect(result.currentHash).toBe('def456');
    });
  });

  describe('Export Methods', () => {
    it('should export audit log in JSON format', () => {
      const custody = new ChainOfCustody({
        evidenceId: 'evd_123',
        initialHash: 'abc123',
        createdBy: 'EXM-001'
      });

      custody.recordView('EXM-002');

      const result = custody.exportAuditLog();

      expect(result.success).toBe(true);
      expect(result.data.exportInfo.standard).toBe('NIST-DF');
      expect(result.data.chainOfCustody.length).toBe(2);
      expect(result.mimeType).toBe('application/json');
    });

    it('should export audit log in CSV format', () => {
      const custody = new ChainOfCustody({
        evidenceId: 'evd_123',
        initialHash: 'abc123',
        createdBy: 'EXM-001'
      });

      custody.recordView('EXM-002');

      const result = custody.exportAuditLog({ format: 'csv' });

      expect(result.success).toBe(true);
      expect(result.mimeType).toBe('text/csv');
      expect(result.data).toContain('Index,Timestamp,Action');
    });

    it('should export in NIST format', () => {
      const custody = new ChainOfCustody({
        evidenceId: 'evd_123',
        initialHash: 'abc123',
        createdBy: 'EXM-001'
      });

      const result = custody.exportNISTFormat();

      expect(result.success).toBe(true);
      expect(result.data['NIST-DF']).toBeDefined();
      expect(result.data['NIST-DF'].evidenceItem.id).toBe('evd_123');
    });
  });

  describe('Validation', () => {
    it('should validate chain integrity', () => {
      const custody = new ChainOfCustody({
        evidenceId: 'evd_123',
        initialHash: 'abc123',
        createdBy: 'EXM-001'
      });

      custody.recordView('EXM-002');
      custody.recordExport('EXM-001');

      const result = custody.validateChain();

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    it('should check if evidence has been modified', () => {
      const custody = new ChainOfCustody({
        evidenceId: 'evd_123',
        initialHash: 'abc123',
        createdBy: 'EXM-001'
      });

      const result = custody.hasBeenModified('abc123');

      expect(result.success).toBe(true);
      expect(result.modified).toBe(false);
    });

    it('should detect modifications', () => {
      const custody = new ChainOfCustody({
        evidenceId: 'evd_123',
        initialHash: 'abc123',
        createdBy: 'EXM-001'
      });

      custody.recordModification('EXM-002', 'abc123', 'def456');

      const result = custody.hasBeenModified('abc123');

      expect(result.modified).toBe(true);
      expect(result.modificationCount).toBe(1);
    });
  });

  describe('Summary and Metadata', () => {
    it('should get chain summary', () => {
      const custody = new ChainOfCustody({
        evidenceId: 'evd_123',
        initialHash: 'abc123',
        createdBy: 'EXM-001'
      });

      custody.recordView('EXM-002');
      custody.recordView('EXM-003');

      const result = custody.getSummary();

      expect(result.success).toBe(true);
      expect(result.summary.totalRecords).toBe(3);
      expect(result.summary.uniqueUsers).toContain('EXM-001');
      expect(result.summary.uniqueUsers).toContain('EXM-002');
    });

    it('should get metadata', () => {
      const custody = new ChainOfCustody({
        evidenceId: 'evd_123',
        initialHash: 'abc123',
        createdBy: 'EXM-001'
      });

      const result = custody.getMetadata();

      expect(result.success).toBe(true);
      expect(result.metadata.evidenceId).toBe('evd_123');
      expect(result.metadata.initialHash).toBe('abc123');
    });
  });

  describe('Factory Function', () => {
    it('should create chain of custody via factory', () => {
      const custody = createChainOfCustody('evd_456', 'hash789', 'EXM-001');

      expect(custody.config.evidenceId).toBe('evd_456');
      expect(custody.config.initialHash).toBe('hash789');
      expect(custody.config.createdBy).toBe('EXM-001');
    });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Evidence and Chain of Custody Integration', () => {
  let EvidenceCapture, ChainOfCustody, createChainOfCustody;

  beforeEach(() => {
    jest.resetModules();
    const evidenceModule = require('../../utils/evidence/evidence-capture.js');
    const custodyModule = require('../../utils/evidence/chain-of-custody.js');

    EvidenceCapture = evidenceModule.EvidenceCapture;
    ChainOfCustody = custodyModule.ChainOfCustody;
    createChainOfCustody = custodyModule.createChainOfCustody;

    chrome.tabs.captureVisibleTab.mockImplementation((windowId, options, callback) => {
      callback('data:image/png;base64,test');
    });
  });

  it('should create integrated evidence and custody chain', async () => {
    const capture = new EvidenceCapture({
      examinerID: 'EXM-001',
      caseNumber: 'CASE-INT-001'
    });

    // Capture evidence
    const captureResult = await capture.captureScreenshot({
      notes: 'Initial evidence capture'
    });

    expect(captureResult.success).toBe(true);

    // Get the chain of custody from evidence
    const custodyResult = capture.getChainOfCustody(captureResult.evidenceId);
    expect(custodyResult.success).toBe(true);
    expect(custodyResult.recordCount).toBe(1);

    // Add more custody events
    capture.recordCustodyEvent(captureResult.evidenceId, 'viewed', {
      userID: 'EXM-002',
      notes: 'Evidence reviewed by second examiner'
    });

    const updatedCustody = capture.getChainOfCustody(captureResult.evidenceId);
    expect(updatedCustody.recordCount).toBe(2);
  });

  it('should maintain chain integrity through export', async () => {
    const capture = new EvidenceCapture({
      examinerID: 'EXM-001',
      caseNumber: 'CASE-INT-002'
    });

    const captureResult = await capture.captureScreenshot();
    const exportResult = await capture.exportEvidence(captureResult.evidenceId);

    expect(exportResult.success).toBe(true);
    expect(exportResult.export.chainOfCustody.length).toBeGreaterThanOrEqual(1);

    // Check that export was recorded in custody
    const custody = capture.getChainOfCustody(captureResult.evidenceId);
    const exportRecord = custody.chainOfCustody.find(r => r.action === 'exported');
    expect(exportRecord).toBeDefined();
  });
});
