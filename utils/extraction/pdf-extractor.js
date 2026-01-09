/**
 * PDF Extractor Utility for Basset Hound Chrome Extension
 *
 * Provides PDF text extraction and analysis:
 * - Detect embedded PDFs in web pages (iframes, object, embed tags)
 * - Extract text from PDFs using PDF.js library
 * - Run OSINT pattern detection on extracted text
 * - Handle multi-page PDFs with progress tracking
 * - Extract metadata and document information
 * - Support various PDF embedding methods
 *
 * Uses PDF.js library (already available in Chrome) for extraction.
 */

class PDFExtractor {
  constructor() {
    this.pdfjsLib = null;
    this.initialized = false;
    this.extractionQueue = [];
    this.activeExtractions = new Map();

    // OSINT patterns to detect in PDF text
    this.osintPatterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
      ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
      ipv6: /\b(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}\b/g,
      url: /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g,
      creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      bitcoin: /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g,
      ethereum: /\b0x[a-fA-F0-9]{40}\b/g,
      passport: /\b[A-Z]{1,2}\d{6,9}\b/g,
      driversLicense: /\b[A-Z]{1,2}\d{6,8}\b/g,
      dateOfBirth: /\b(?:\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{2,4}[-\/]\d{1,2}[-\/]\d{1,2})\b/g,
      coordinates: /[-+]?\d{1,3}\.\d+,\s*[-+]?\d{1,3}\.\d+/g
    };
  }

  /**
   * Initialize PDF.js library
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      return true;
    }

    try {
      // Check if PDF.js is already loaded
      if (typeof pdfjsLib !== 'undefined') {
        this.pdfjsLib = pdfjsLib;
        this.initialized = true;
        return true;
      }

      // Try to load PDF.js from Chrome's built-in version
      // Chrome includes PDF.js for viewing PDFs
      const script = document.createElement('script');
      script.src = 'chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/pdf.js';

      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = () => {
          // Fallback: Try loading from CDN
          const fallbackScript = document.createElement('script');
          fallbackScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          fallbackScript.onload = resolve;
          fallbackScript.onerror = reject;
          document.head.appendChild(fallbackScript);
        };
        document.head.appendChild(script);
      });

      if (typeof pdfjsLib !== 'undefined') {
        this.pdfjsLib = pdfjsLib;
        // Set worker source
        if (pdfjsLib.GlobalWorkerOptions) {
          pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        this.initialized = true;
        return true;
      }

      return false;
    } catch (error) {
      console.error('PDFExtractor: Failed to initialize PDF.js:', error);
      return false;
    }
  }

  /**
   * Detect embedded PDFs on the current page
   * @returns {Array<Object>} - Array of detected PDF elements
   */
  detectEmbeddedPDFs() {
    const detectedPDFs = [];

    try {
      // Method 1: Check iframe elements
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach((iframe, index) => {
        const src = iframe.src || '';
        if (src.toLowerCase().endsWith('.pdf') || src.includes('pdf')) {
          detectedPDFs.push({
            type: 'iframe',
            element: iframe,
            src: src,
            id: iframe.id || `iframe-${index}`,
            width: iframe.width || iframe.clientWidth,
            height: iframe.height || iframe.clientHeight,
            title: iframe.title || 'Untitled PDF'
          });
        }
      });

      // Method 2: Check object elements
      const objects = document.querySelectorAll('object[type="application/pdf"], object[data*=".pdf"]');
      objects.forEach((obj, index) => {
        detectedPDFs.push({
          type: 'object',
          element: obj,
          src: obj.data,
          id: obj.id || `object-${index}`,
          width: obj.width || obj.clientWidth,
          height: obj.height || obj.clientHeight,
          title: obj.title || 'Untitled PDF'
        });
      });

      // Method 3: Check embed elements
      const embeds = document.querySelectorAll('embed[type="application/pdf"], embed[src*=".pdf"]');
      embeds.forEach((embed, index) => {
        detectedPDFs.push({
          type: 'embed',
          element: embed,
          src: embed.src,
          id: embed.id || `embed-${index}`,
          width: embed.width || embed.clientWidth,
          height: embed.height || embed.clientHeight,
          title: embed.title || 'Untitled PDF'
        });
      });

      // Method 4: Check links to PDF files
      const links = document.querySelectorAll('a[href*=".pdf"]');
      links.forEach((link, index) => {
        const href = link.href;
        if (href.toLowerCase().endsWith('.pdf')) {
          detectedPDFs.push({
            type: 'link',
            element: link,
            src: href,
            id: link.id || `link-${index}`,
            title: link.textContent.trim() || link.title || 'Untitled PDF',
            text: link.textContent.trim()
          });
        }
      });

      return detectedPDFs;
    } catch (error) {
      console.error('PDFExtractor: Error detecting embedded PDFs:', error);
      return [];
    }
  }

  /**
   * Extract text from a PDF URL
   * @param {string} url - URL of the PDF
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} - Extraction results
   */
  async extractTextFromURL(url, options = {}) {
    if (!this.initialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        return {
          success: false,
          error: 'Failed to initialize PDF.js library'
        };
      }
    }

    const extractionId = `extract-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      // Create progress tracking
      const progress = {
        id: extractionId,
        url: url,
        status: 'loading',
        currentPage: 0,
        totalPages: 0,
        progress: 0,
        startTime: startTime
      };
      this.activeExtractions.set(extractionId, progress);

      // Load the PDF document
      const loadingTask = this.pdfjsLib.getDocument(url);
      const pdf = await loadingTask.promise;

      progress.totalPages = pdf.numPages;
      progress.status = 'extracting';

      const extractedData = {
        success: true,
        extractionId: extractionId,
        url: url,
        metadata: {},
        pages: [],
        fullText: '',
        osintFindings: {},
        statistics: {
          totalPages: pdf.numPages,
          totalCharacters: 0,
          totalWords: 0,
          extractionTime: 0
        }
      };

      // Extract metadata
      try {
        const metadata = await pdf.getMetadata();
        extractedData.metadata = {
          title: metadata.info.Title || null,
          author: metadata.info.Author || null,
          subject: metadata.info.Subject || null,
          keywords: metadata.info.Keywords || null,
          creator: metadata.info.Creator || null,
          producer: metadata.info.Producer || null,
          creationDate: metadata.info.CreationDate || null,
          modificationDate: metadata.info.ModDate || null,
          pdfVersion: metadata.info.PDFFormatVersion || null
        };
      } catch (error) {
        console.warn('PDFExtractor: Failed to extract metadata:', error);
      }

      // Extract text from each page
      const maxPages = options.maxPages || pdf.numPages;
      const pageLimit = Math.min(maxPages, pdf.numPages);

      for (let pageNum = 1; pageNum <= pageLimit; pageNum++) {
        try {
          progress.currentPage = pageNum;
          progress.progress = Math.round((pageNum / pageLimit) * 100);

          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();

          // Extract text items
          const pageText = textContent.items
            .map(item => item.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          extractedData.pages.push({
            pageNumber: pageNum,
            text: pageText,
            characterCount: pageText.length,
            wordCount: pageText.split(/\s+/).filter(w => w.length > 0).length
          });

          extractedData.fullText += pageText + '\n\n';

          // Update statistics
          extractedData.statistics.totalCharacters += pageText.length;
          extractedData.statistics.totalWords +=
            pageText.split(/\s+/).filter(w => w.length > 0).length;

        } catch (error) {
          console.error(`PDFExtractor: Error extracting page ${pageNum}:`, error);
          extractedData.pages.push({
            pageNumber: pageNum,
            text: '',
            error: error.message,
            characterCount: 0,
            wordCount: 0
          });
        }
      }

      // Run OSINT pattern detection on extracted text
      extractedData.osintFindings = this.detectOSINTPatterns(extractedData.fullText);

      // Calculate extraction time
      extractedData.statistics.extractionTime = Date.now() - startTime;

      // Update progress
      progress.status = 'completed';
      progress.progress = 100;

      // Clean up
      this.activeExtractions.delete(extractionId);

      return extractedData;

    } catch (error) {
      this.activeExtractions.delete(extractionId);
      return {
        success: false,
        extractionId: extractionId,
        url: url,
        error: error.message,
        extractionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Extract text from a PDF blob/array buffer
   * @param {ArrayBuffer|Blob} data - PDF data
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} - Extraction results
   */
  async extractTextFromData(data, options = {}) {
    if (!this.initialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        return {
          success: false,
          error: 'Failed to initialize PDF.js library'
        };
      }
    }

    try {
      // Convert Blob to ArrayBuffer if needed
      let arrayBuffer;
      if (data instanceof Blob) {
        arrayBuffer = await data.arrayBuffer();
      } else {
        arrayBuffer = data;
      }

      // Create a temporary object URL for the data
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      // Extract text using URL method
      const result = await this.extractTextFromURL(url, options);

      // Clean up the object URL
      URL.revokeObjectURL(url);

      return result;

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract text from all detected PDFs on the page
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} - Extraction results for all PDFs
   */
  async extractFromPage(options = {}) {
    const detectedPDFs = this.detectEmbeddedPDFs();

    if (detectedPDFs.length === 0) {
      return {
        success: true,
        pdfs: [],
        count: 0,
        message: 'No PDFs detected on page'
      };
    }

    const results = {
      success: true,
      pdfs: [],
      count: detectedPDFs.length,
      successCount: 0,
      failureCount: 0
    };

    // Extract from each detected PDF
    for (const pdfInfo of detectedPDFs) {
      try {
        // Skip links if not explicitly requested
        if (pdfInfo.type === 'link' && !options.includeLinks) {
          continue;
        }

        const extractionResult = await this.extractTextFromURL(pdfInfo.src, options);

        results.pdfs.push({
          ...pdfInfo,
          extraction: extractionResult
        });

        if (extractionResult.success) {
          results.successCount++;
        } else {
          results.failureCount++;
        }

      } catch (error) {
        results.pdfs.push({
          ...pdfInfo,
          extraction: {
            success: false,
            error: error.message
          }
        });
        results.failureCount++;
      }
    }

    return results;
  }

  /**
   * Detect OSINT patterns in text
   * @param {string} text - Text to analyze
   * @returns {Object} - Detected patterns
   */
  detectOSINTPatterns(text) {
    const findings = {};

    try {
      for (const [patternName, regex] of Object.entries(this.osintPatterns)) {
        const matches = text.match(regex);
        if (matches && matches.length > 0) {
          // Remove duplicates and sort
          const uniqueMatches = [...new Set(matches)].sort();
          findings[patternName] = {
            count: uniqueMatches.length,
            matches: uniqueMatches,
            confidence: this.calculateConfidence(patternName, uniqueMatches)
          };
        }
      }

      // Additional analysis
      findings.summary = {
        totalPatterns: Object.keys(findings).length - 1, // Exclude summary itself
        totalMatches: Object.values(findings)
          .filter(f => f.count !== undefined)
          .reduce((sum, f) => sum + f.count, 0),
        highConfidence: Object.values(findings)
          .filter(f => f.confidence > 0.8).length
      };

    } catch (error) {
      console.error('PDFExtractor: Error detecting OSINT patterns:', error);
    }

    return findings;
  }

  /**
   * Calculate confidence score for pattern matches
   * @param {string} patternName - Name of the pattern
   * @param {Array<string>} matches - Matched values
   * @returns {number} - Confidence score (0-1)
   */
  calculateConfidence(patternName, matches) {
    // Basic confidence calculation based on pattern type and match characteristics
    let confidence = 0.5; // Base confidence

    // Increase confidence based on pattern type
    const highConfidencePatterns = ['email', 'url', 'ipv4', 'bitcoin', 'ethereum'];
    if (highConfidencePatterns.includes(patternName)) {
      confidence += 0.3;
    }

    // Increase confidence based on number of matches
    if (matches.length > 3) {
      confidence += 0.1;
    }

    // Decrease confidence for overly common patterns
    if (matches.length > 50) {
      confidence -= 0.2;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Get extraction progress for an active extraction
   * @param {string} extractionId - ID of the extraction
   * @returns {Object|null} - Progress information or null if not found
   */
  getExtractionProgress(extractionId) {
    return this.activeExtractions.get(extractionId) || null;
  }

  /**
   * Cancel an active extraction
   * @param {string} extractionId - ID of the extraction to cancel
   * @returns {boolean} - Whether cancellation was successful
   */
  cancelExtraction(extractionId) {
    if (this.activeExtractions.has(extractionId)) {
      this.activeExtractions.delete(extractionId);
      return true;
    }
    return false;
  }

  /**
   * Get list of all active extractions
   * @returns {Array<Object>} - Array of active extraction progress objects
   */
  getActiveExtractions() {
    return Array.from(this.activeExtractions.values());
  }

  /**
   * Extract specific page range from PDF
   * @param {string} url - URL of the PDF
   * @param {number} startPage - Starting page number (1-based)
   * @param {number} endPage - Ending page number (1-based)
   * @returns {Promise<Object>} - Extraction results
   */
  async extractPageRange(url, startPage, endPage) {
    if (!this.initialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        return {
          success: false,
          error: 'Failed to initialize PDF.js library'
        };
      }
    }

    try {
      const loadingTask = this.pdfjsLib.getDocument(url);
      const pdf = await loadingTask.promise;

      // Validate page range
      const validStart = Math.max(1, Math.min(startPage, pdf.numPages));
      const validEnd = Math.max(validStart, Math.min(endPage, pdf.numPages));

      const extractedData = {
        success: true,
        url: url,
        pageRange: { start: validStart, end: validEnd },
        pages: [],
        fullText: '',
        osintFindings: {}
      };

      // Extract specified pages
      for (let pageNum = validStart; pageNum <= validEnd; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        const pageText = textContent.items
          .map(item => item.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        extractedData.pages.push({
          pageNumber: pageNum,
          text: pageText,
          characterCount: pageText.length
        });

        extractedData.fullText += pageText + '\n\n';
      }

      // Run OSINT pattern detection
      extractedData.osintFindings = this.detectOSINTPatterns(extractedData.fullText);

      return extractedData;

    } catch (error) {
      return {
        success: false,
        url: url,
        error: error.message
      };
    }
  }

  /**
   * Search for specific text in PDF
   * @param {string} url - URL of the PDF
   * @param {string} searchText - Text to search for
   * @param {Object} options - Search options
   * @returns {Promise<Object>} - Search results
   */
  async searchInPDF(url, searchText, options = {}) {
    if (!this.initialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        return {
          success: false,
          error: 'Failed to initialize PDF.js library'
        };
      }
    }

    const caseSensitive = options.caseSensitive || false;
    const wholeWord = options.wholeWord || false;

    try {
      const loadingTask = this.pdfjsLib.getDocument(url);
      const pdf = await loadingTask.promise;

      const searchResults = {
        success: true,
        url: url,
        searchText: searchText,
        matches: [],
        totalMatches: 0
      };

      // Search each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        const pageText = textContent.items.map(item => item.str).join(' ');

        // Perform search
        let searchRegex;
        if (wholeWord) {
          searchRegex = new RegExp(`\\b${searchText}\\b`, caseSensitive ? 'g' : 'gi');
        } else {
          searchRegex = new RegExp(searchText, caseSensitive ? 'g' : 'gi');
        }

        const matches = pageText.match(searchRegex);
        if (matches && matches.length > 0) {
          searchResults.matches.push({
            pageNumber: pageNum,
            matchCount: matches.length,
            context: this.getSearchContext(pageText, searchText, 50)
          });
          searchResults.totalMatches += matches.length;
        }
      }

      return searchResults;

    } catch (error) {
      return {
        success: false,
        url: url,
        error: error.message
      };
    }
  }

  /**
   * Get context around search matches
   * @param {string} text - Full text
   * @param {string} searchText - Search term
   * @param {number} contextLength - Characters of context on each side
   * @returns {Array<string>} - Context snippets
   */
  getSearchContext(text, searchText, contextLength) {
    const regex = new RegExp(searchText, 'gi');
    const contexts = [];
    let match;

    while ((match = regex.exec(text)) !== null && contexts.length < 5) {
      const start = Math.max(0, match.index - contextLength);
      const end = Math.min(text.length, match.index + match[0].length + contextLength);
      const context = text.substring(start, end);
      contexts.push(context);
    }

    return contexts;
  }

  /**
   * Export extraction results to various formats
   * @param {Object} extractionResults - Results from extraction
   * @param {string} format - Export format ('json', 'txt', 'csv')
   * @returns {string} - Formatted export data
   */
  exportResults(extractionResults, format = 'json') {
    try {
      switch (format.toLowerCase()) {
        case 'json':
          return JSON.stringify(extractionResults, null, 2);

        case 'txt':
          return extractionResults.fullText ||
            extractionResults.pages?.map(p => p.text).join('\n\n') || '';

        case 'csv':
          // Export OSINT findings as CSV
          let csv = 'Pattern Type,Value,Page Numbers\n';
          for (const [patternType, data] of Object.entries(extractionResults.osintFindings || {})) {
            if (data.matches) {
              data.matches.forEach(match => {
                csv += `"${patternType}","${match}","N/A"\n`;
              });
            }
          }
          return csv;

        default:
          return JSON.stringify(extractionResults, null, 2);
      }
    } catch (error) {
      console.error('PDFExtractor: Error exporting results:', error);
      return '';
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PDFExtractor;
}
