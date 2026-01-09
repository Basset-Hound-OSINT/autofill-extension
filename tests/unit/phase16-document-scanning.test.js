/**
 * Unit Tests for Phase 16: Document Scanning (PDF, OCR, Tables)
 *
 * Tests the document scanning functionality including:
 * - PDF text extraction
 * - Image OCR processing
 * - Table parsing and analysis
 */

describe('Phase 16: Document Scanning', () => {
  describe('PDFExtractor', () => {
    let extractor;

    beforeEach(() => {
      extractor = new PDFExtractor();
    });

    describe('initialization', () => {
      it('should initialize successfully', async () => {
        // Mock PDF.js library
        global.pdfjsLib = {
          getDocument: jest.fn(),
          GlobalWorkerOptions: {}
        };

        const result = await extractor.initialize();
        expect(result).toBe(true);
        expect(extractor.initialized).toBe(true);
      });

      it('should return true if already initialized', async () => {
        extractor.initialized = true;
        const result = await extractor.initialize();
        expect(result).toBe(true);
      });
    });

    describe('detectEmbeddedPDFs', () => {
      it('should detect iframe PDFs', () => {
        document.body.innerHTML = `
          <iframe src="document.pdf" id="pdf1"></iframe>
          <iframe src="another.pdf"></iframe>
        `;

        const detected = extractor.detectEmbeddedPDFs();
        expect(detected).toHaveLength(2);
        expect(detected[0].type).toBe('iframe');
        expect(detected[0].src).toContain('.pdf');
      });

      it('should detect object PDFs', () => {
        document.body.innerHTML = `
          <object type="application/pdf" data="doc.pdf"></object>
        `;

        const detected = extractor.detectEmbeddedPDFs();
        expect(detected).toHaveLength(1);
        expect(detected[0].type).toBe('object');
      });

      it('should detect embed PDFs', () => {
        document.body.innerHTML = `
          <embed type="application/pdf" src="embedded.pdf">
        `;

        const detected = extractor.detectEmbeddedPDFs();
        expect(detected).toHaveLength(1);
        expect(detected[0].type).toBe('embed');
      });

      it('should detect PDF links', () => {
        document.body.innerHTML = `
          <a href="document.pdf">Download PDF</a>
        `;

        const detected = extractor.detectEmbeddedPDFs();
        expect(detected).toHaveLength(1);
        expect(detected[0].type).toBe('link');
      });

      it('should return empty array if no PDFs found', () => {
        document.body.innerHTML = '<div>No PDFs here</div>';
        const detected = extractor.detectEmbeddedPDFs();
        expect(detected).toHaveLength(0);
      });
    });

    describe('detectOSINTPatterns', () => {
      it('should detect email addresses', () => {
        const text = 'Contact us at john@example.com or jane@test.org';
        const findings = extractor.detectOSINTPatterns(text);

        expect(findings.email).toBeDefined();
        expect(findings.email.count).toBe(2);
        expect(findings.email.matches).toContain('john@example.com');
        expect(findings.email.matches).toContain('jane@test.org');
      });

      it('should detect phone numbers', () => {
        const text = 'Call us at (555) 123-4567 or 555-987-6543';
        const findings = extractor.detectOSINTPatterns(text);

        expect(findings.phone).toBeDefined();
        expect(findings.phone.count).toBeGreaterThan(0);
      });

      it('should detect IP addresses', () => {
        const text = 'Server IP: 192.168.1.1 and 10.0.0.1';
        const findings = extractor.detectOSINTPatterns(text);

        expect(findings.ipv4).toBeDefined();
        expect(findings.ipv4.count).toBe(2);
      });

      it('should detect URLs', () => {
        const text = 'Visit https://example.com and http://test.org';
        const findings = extractor.detectOSINTPatterns(text);

        expect(findings.url).toBeDefined();
        expect(findings.url.count).toBe(2);
      });

      it('should detect SSN', () => {
        const text = 'SSN: 123-45-6789';
        const findings = extractor.detectOSINTPatterns(text);

        expect(findings.ssn).toBeDefined();
        expect(findings.ssn.count).toBe(1);
      });

      it('should return summary of findings', () => {
        const text = 'Email: test@example.com, Phone: 555-1234, IP: 192.168.1.1';
        const findings = extractor.detectOSINTPatterns(text);

        expect(findings.summary).toBeDefined();
        expect(findings.summary.totalPatterns).toBeGreaterThan(0);
        expect(findings.summary.totalMatches).toBeGreaterThan(0);
      });
    });

    describe('calculateConfidence', () => {
      it('should return high confidence for well-known patterns', () => {
        const confidence = extractor.calculateConfidence('email', ['test@example.com']);
        expect(confidence).toBeGreaterThan(0.7);
      });

      it('should increase confidence with multiple matches', () => {
        const lowCount = extractor.calculateConfidence('email', ['test@example.com']);
        const highCount = extractor.calculateConfidence('email', [
          'a@b.com', 'c@d.com', 'e@f.com', 'g@h.com'
        ]);
        expect(highCount).toBeGreaterThanOrEqual(lowCount);
      });

      it('should decrease confidence for excessive matches', () => {
        const matches = Array(100).fill('test@example.com');
        const confidence = extractor.calculateConfidence('email', matches);
        expect(confidence).toBeLessThan(1);
      });
    });

    describe('exportResults', () => {
      const sampleResults = {
        fullText: 'Sample PDF text',
        pages: [{ text: 'Page 1' }, { text: 'Page 2' }],
        osintFindings: {
          email: { matches: ['test@example.com'] }
        }
      };

      it('should export as JSON', () => {
        const exported = extractor.exportResults(sampleResults, 'json');
        expect(() => JSON.parse(exported)).not.toThrow();
      });

      it('should export as plain text', () => {
        const exported = extractor.exportResults(sampleResults, 'txt');
        expect(exported).toBe('Sample PDF text');
      });

      it('should export as CSV', () => {
        const exported = extractor.exportResults(sampleResults, 'csv');
        expect(exported).toContain('Pattern Type,Value');
        expect(exported).toContain('email');
      });

      it('should default to JSON for unknown formats', () => {
        const exported = extractor.exportResults(sampleResults, 'unknown');
        expect(() => JSON.parse(exported)).not.toThrow();
      });
    });
  });

  describe('ImageOCR', () => {
    let ocr;

    beforeEach(() => {
      ocr = new ImageOCR();
    });

    describe('initialization', () => {
      it('should initialize successfully', async () => {
        global.Tesseract = {
          recognize: jest.fn()
        };

        const result = await ocr.initialize();
        expect(result).toBe(true);
        expect(ocr.initialized).toBe(true);
      });
    });

    describe('calculateTextLikelihood', () => {
      it('should return higher score for adequate dimensions', () => {
        const img = document.createElement('img');
        Object.defineProperty(img, 'naturalWidth', { value: 800 });
        Object.defineProperty(img, 'naturalHeight', { value: 600 });

        const score = ocr.calculateTextLikelihood(img);
        expect(score).toBeGreaterThan(0);
      });

      it('should increase score for suspicious class names', () => {
        const img1 = document.createElement('img');
        const img2 = document.createElement('img');

        Object.defineProperty(img1, 'naturalWidth', { value: 800 });
        Object.defineProperty(img1, 'naturalHeight', { value: 600 });
        Object.defineProperty(img2, 'naturalWidth', { value: 800 });
        Object.defineProperty(img2, 'naturalHeight', { value: 600 });

        img2.className = 'screenshot-image';

        const score1 = ocr.calculateTextLikelihood(img1);
        const score2 = ocr.calculateTextLikelihood(img2);
        expect(score2).toBeGreaterThan(score1);
      });

      it('should increase score for suspicious alt text', () => {
        const img = document.createElement('img');
        Object.defineProperty(img, 'naturalWidth', { value: 800 });
        Object.defineProperty(img, 'naturalHeight', { value: 600 });
        img.alt = 'document scan';

        const score = ocr.calculateTextLikelihood(img);
        expect(score).toBeGreaterThan(0.3);
      });
    });

    describe('detectTextImages', () => {
      it('should detect images with high text likelihood', () => {
        document.body.innerHTML = `
          <img src="doc.jpg" class="screenshot" width="800" height="600">
          <img src="photo.jpg" width="100" height="100">
        `;

        const detected = ocr.detectTextImages({ threshold: 0.3 });
        expect(detected.length).toBeGreaterThan(0);
      });

      it('should filter by threshold', () => {
        document.body.innerHTML = `
          <img src="doc.jpg" class="document" width="800" height="600">
        `;

        const lowThreshold = ocr.detectTextImages({ threshold: 0.1 });
        const highThreshold = ocr.detectTextImages({ threshold: 0.9 });

        expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length);
      });

      it('should detect canvas elements', () => {
        document.body.innerHTML = `
          <canvas width="800" height="600"></canvas>
        `;

        const detected = ocr.detectTextImages();
        expect(detected).toHaveLength(1);
        expect(detected[0].type).toBe('canvas');
      });
    });

    describe('detectOSINTPatterns', () => {
      it('should detect patterns in OCR text', () => {
        const text = 'Invoice from john@example.com\nTotal: $1,234.56';
        const findings = ocr.detectOSINTPatterns(text);

        expect(findings.email).toBeDefined();
        expect(findings.email.count).toBe(1);
      });

      it('should calculate pattern confidence', () => {
        const text = 'Contact: test@example.com';
        const findings = ocr.detectOSINTPatterns(text);

        expect(findings.email).toBeDefined();
        expect(findings.email.confidence).toBeGreaterThan(0);
        expect(findings.email.confidence).toBeLessThanOrEqual(1);
      });
    });

    describe('calculateAverageConfidence', () => {
      it('should calculate average from word confidences', () => {
        const words = [
          { text: 'Hello', confidence: 90 },
          { text: 'World', confidence: 80 }
        ];

        const avg = ocr.calculateAverageConfidence(words);
        expect(avg).toBe(85);
      });

      it('should return 0 for empty array', () => {
        const avg = ocr.calculateAverageConfidence([]);
        expect(avg).toBe(0);
      });
    });

    describe('exportResults', () => {
      const sampleResults = {
        text: 'Extracted text',
        confidence: 85,
        words: [
          { text: 'Hello', confidence: 90, bbox: { x0: 0, y0: 0, x1: 100, y1: 20 } }
        ]
      };

      it('should export as JSON', () => {
        const exported = ocr.exportResults(sampleResults, 'json');
        expect(() => JSON.parse(exported)).not.toThrow();
      });

      it('should export as plain text', () => {
        const exported = ocr.exportResults(sampleResults, 'txt');
        expect(exported).toBe('Extracted text');
      });

      it('should export as CSV', () => {
        const exported = ocr.exportResults(sampleResults, 'csv');
        expect(exported).toContain('Text,Confidence,X,Y');
        expect(exported).toContain('Hello');
      });
    });
  });

  describe('TableParser', () => {
    let parser;

    beforeEach(() => {
      parser = new TableParser();
    });

    describe('parseHTMLTable', () => {
      it('should parse simple table', () => {
        document.body.innerHTML = `
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th></tr>
            </thead>
            <tbody>
              <tr><td>John</td><td>john@example.com</td></tr>
              <tr><td>Jane</td><td>jane@example.com</td></tr>
            </tbody>
          </table>
        `;

        const table = document.querySelector('table');
        const result = parser.parseHTMLTable(table);

        expect(result.success).toBe(true);
        expect(result.headers).toHaveLength(2);
        expect(result.rows).toHaveLength(2);
      });

      it('should extract table metadata', () => {
        document.body.innerHTML = `
          <table id="data-table" class="table-class">
            <caption>Employee Data</caption>
            <tr><th>Name</th></tr>
            <tr><td>John</td></tr>
          </table>
        `;

        const table = document.querySelector('table');
        const result = parser.parseHTMLTable(table);

        expect(result.metadata.id).toBe('data-table');
        expect(result.metadata.className).toBe('table-class');
        expect(result.metadata.caption).toBe('Employee Data');
      });

      it('should detect column types', () => {
        document.body.innerHTML = `
          <table>
            <tr><th>Email</th><th>Phone</th></tr>
            <tr><td>john@example.com</td><td>555-1234</td></tr>
            <tr><td>jane@example.com</td><td>555-5678</td></tr>
          </table>
        `;

        const table = document.querySelector('table');
        const result = parser.parseHTMLTable(table, { detectTypes: true });

        expect(result.columnTypes).toBeDefined();
        expect(result.columnTypes[0].primaryType).toBe('email');
      });

      it('should analyze for OSINT data', () => {
        document.body.innerHTML = `
          <table>
            <tr><th>Email</th></tr>
            <tr><td>test@example.com</td></tr>
          </table>
        `;

        const table = document.querySelector('table');
        const result = parser.parseHTMLTable(table, { analyzeOSINT: true });

        expect(result.osintFindings).toBeDefined();
        expect(result.osintFindings.riskLevel).toBeDefined();
      });
    });

    describe('detectColumnTypes', () => {
      it('should detect email columns', () => {
        const headers = [{ text: 'Email Address', index: 0 }];
        const rows = [
          [{ text: 'john@example.com' }],
          [{ text: 'jane@example.com' }]
        ];

        const types = parser.detectColumnTypes(headers, rows);
        expect(types[0].primaryType).toBe('email');
      });

      it('should detect phone columns', () => {
        const headers = [{ text: 'Phone', index: 0 }];
        const rows = [
          [{ text: '555-1234' }],
          [{ text: '555-5678' }]
        ];

        const types = parser.detectColumnTypes(headers, rows);
        expect(types[0].primaryType).toBe('phone');
      });

      it('should calculate confidence scores', () => {
        const headers = [{ text: 'Email', index: 0 }];
        const rows = [
          [{ text: 'john@example.com' }],
          [{ text: 'jane@example.com' }]
        ];

        const types = parser.detectColumnTypes(headers, rows);
        expect(types[0].confidence).toBeGreaterThan(0);
      });
    });

    describe('analyzeTableForOSINT', () => {
      it('should identify sensitive columns', () => {
        const headers = [{ text: 'Email', index: 0 }, { text: 'SSN', index: 1 }];
        const rows = [
          [{ text: 'test@example.com' }, { text: '123-45-6789' }]
        ];
        const columnTypes = [
          { columnIndex: 0, primaryType: 'email', confidence: 0.9 },
          { columnIndex: 1, primaryType: 'ssn', confidence: 0.9 }
        ];

        const findings = parser.analyzeTableForOSINT(headers, rows, columnTypes);

        expect(findings.sensitiveColumns).toHaveLength(2);
        expect(findings.riskLevel).toBe('high');
      });

      it('should calculate risk levels', () => {
        const headers = [{ text: 'Name', index: 0 }];
        const rows = [[{ text: 'John' }]];
        const columnTypes = [
          { columnIndex: 0, primaryType: 'text', confidence: 0.5 }
        ];

        const findings = parser.analyzeTableForOSINT(headers, rows, columnTypes);
        expect(findings.riskLevel).toBe('low');
      });

      it('should provide recommendations', () => {
        const headers = [{ text: 'SSN', index: 0 }];
        const rows = [[{ text: '123-45-6789' }]];
        const columnTypes = [
          { columnIndex: 0, primaryType: 'ssn', confidence: 0.9 }
        ];

        const findings = parser.analyzeTableForOSINT(headers, rows, columnTypes);
        expect(findings.recommendations.length).toBeGreaterThan(0);
      });
    });

    describe('exportTable', () => {
      const sampleTable = {
        headers: [{ text: 'Name' }, { text: 'Email' }],
        rows: [
          [{ text: 'John' }, { text: 'john@example.com' }]
        ]
      };

      it('should export as JSON', () => {
        const exported = parser.exportTable(sampleTable, 'json');
        expect(() => JSON.parse(exported)).not.toThrow();
      });

      it('should export as CSV', () => {
        const exported = parser.exportTable(sampleTable, 'csv');
        expect(exported).toContain('Name');
        expect(exported).toContain('john@example.com');
      });

      it('should export as TSV', () => {
        const exported = parser.exportTable(sampleTable, 'tsv');
        expect(exported).toContain('\t');
      });

      it('should export as HTML', () => {
        const exported = parser.exportTable(sampleTable, 'html');
        expect(exported).toContain('<table');
        expect(exported).toContain('<th>Name</th>');
      });

      it('should export as Markdown', () => {
        const exported = parser.exportTable(sampleTable, 'markdown');
        expect(exported).toContain('|');
        expect(exported).toContain('---');
      });
    });

    describe('searchTable', () => {
      const sampleTable = {
        headers: [{ text: 'Name' }, { text: 'Email' }],
        rows: [
          [{ text: 'John Doe' }, { text: 'john@example.com' }],
          [{ text: 'Jane Smith' }, { text: 'jane@test.org' }]
        ]
      };

      it('should find matches in table', () => {
        const results = parser.searchTable(sampleTable, 'john');
        expect(results.totalMatches).toBeGreaterThan(0);
      });

      it('should be case insensitive by default', () => {
        const results = parser.searchTable(sampleTable, 'JOHN');
        expect(results.totalMatches).toBeGreaterThan(0);
      });

      it('should support case sensitive search', () => {
        const results = parser.searchTable(sampleTable, 'JOHN', { caseSensitive: true });
        expect(results.totalMatches).toBe(0);
      });
    });

    describe('filterTable', () => {
      const sampleTable = {
        headers: [{ text: 'Name' }, { text: 'Age' }],
        rows: [
          [{ text: 'John' }, { text: '25' }],
          [{ text: 'Jane' }, { text: '30' }],
          [{ text: 'Bob' }, { text: '25' }]
        ]
      };

      it('should filter rows by exact match', () => {
        const filtered = parser.filterTable(sampleTable, { 1: '25' });
        expect(filtered.rows).toHaveLength(2);
      });

      it('should filter rows by regex', () => {
        const filtered = parser.filterTable(sampleTable, { 0: /^J/ });
        expect(filtered.rows).toHaveLength(2);
      });
    });

    describe('sortTable', () => {
      const sampleTable = {
        headers: [{ text: 'Name' }, { text: 'Age' }],
        rows: [
          [{ text: 'Charlie' }, { text: '30' }],
          [{ text: 'Alice' }, { text: '25' }],
          [{ text: 'Bob' }, { text: '35' }]
        ]
      };

      it('should sort alphabetically ascending', () => {
        const sorted = parser.sortTable(sampleTable, 0, 'asc');
        expect(sorted.rows[0][0].text).toBe('Alice');
      });

      it('should sort alphabetically descending', () => {
        const sorted = parser.sortTable(sampleTable, 0, 'desc');
        expect(sorted.rows[0][0].text).toBe('Charlie');
      });

      it('should sort numerically', () => {
        const sorted = parser.sortTable(sampleTable, 1, 'asc');
        expect(sorted.rows[0][1].text).toBe('25');
      });
    });
  });
});
