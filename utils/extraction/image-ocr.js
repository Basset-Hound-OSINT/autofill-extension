/**
 * Image OCR Utility for Basset Hound Chrome Extension
 *
 * Provides optical character recognition (OCR) for images:
 * - Detect images that might contain text
 * - Extract text from images using Tesseract.js
 * - Run OSINT pattern detection on OCR results
 * - Handle common image formats (PNG, JPG, WebP)
 * - Show OCR confidence scores
 * - Support screenshots and document images
 *
 * Uses Tesseract.js for in-browser OCR processing.
 */

class ImageOCR {
  constructor() {
    this.tesseract = null;
    this.initialized = false;
    this.activeOCRJobs = new Map();
    this.supportedFormats = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/bmp'];

    // OSINT patterns to detect in OCR text
    this.osintPatterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
      ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
      url: /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g,
      creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      address: /\b\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|highway|hwy|lane|ln|drive|dr|court|ct|circle|cir|boulevard|blvd)\b/gi,
      zipCode: /\b\d{5}(?:-\d{4})?\b/g,
      dateOfBirth: /\b(?:\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{2,4}[-\/]\d{1,2}[-\/]\d{1,2})\b/g,
      passport: /\b[A-Z]{1,2}\d{6,9}\b/g,
      licensePlate: /\b[A-Z0-9]{2,3}[-\s]?[A-Z0-9]{3,4}\b/g,
      coordinates: /[-+]?\d{1,3}\.\d+,\s*[-+]?\d{1,3}\.\d+/g
    };

    // Image heuristics for text detection
    this.textImageHeuristics = {
      minWidth: 50,
      minHeight: 20,
      suspiciousClassNames: ['screenshot', 'document', 'scan', 'invoice', 'receipt', 'id', 'license'],
      suspiciousAltText: ['screenshot', 'document', 'scan', 'text', 'form', 'invoice', 'receipt']
    };
  }

  /**
   * Initialize Tesseract.js library
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      return true;
    }

    try {
      // Check if Tesseract is already loaded
      if (typeof Tesseract !== 'undefined') {
        this.tesseract = Tesseract;
        this.initialized = true;
        return true;
      }

      // Load Tesseract.js from CDN
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4.1.1/dist/tesseract.min.js';

      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });

      if (typeof Tesseract !== 'undefined') {
        this.tesseract = Tesseract;
        this.initialized = true;
        return true;
      }

      return false;
    } catch (error) {
      console.error('ImageOCR: Failed to initialize Tesseract.js:', error);
      return false;
    }
  }

  /**
   * Detect images that likely contain text
   * @param {Object} options - Detection options
   * @returns {Array<Object>} - Array of image elements likely to contain text
   */
  detectTextImages(options = {}) {
    const detectedImages = [];

    try {
      const images = document.querySelectorAll('img');

      images.forEach((img, index) => {
        const score = this.calculateTextLikelihood(img);

        // Only include images with likelihood score above threshold
        const threshold = options.threshold || 0.3;
        if (score >= threshold) {
          detectedImages.push({
            element: img,
            src: img.src,
            alt: img.alt || '',
            id: img.id || `img-${index}`,
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
            className: img.className,
            textLikelihood: score,
            reasons: this.getTextLikelihoodReasons(img, score)
          });
        }
      });

      // Also check canvas elements (might contain screenshots)
      const canvases = document.querySelectorAll('canvas');
      canvases.forEach((canvas, index) => {
        if (canvas.width > this.textImageHeuristics.minWidth &&
            canvas.height > this.textImageHeuristics.minHeight) {
          detectedImages.push({
            element: canvas,
            type: 'canvas',
            id: canvas.id || `canvas-${index}`,
            width: canvas.width,
            height: canvas.height,
            textLikelihood: 0.5, // Moderate likelihood for canvas
            reasons: ['Canvas element (may contain screenshots)']
          });
        }
      });

      return detectedImages;
    } catch (error) {
      console.error('ImageOCR: Error detecting text images:', error);
      return [];
    }
  }

  /**
   * Calculate likelihood that an image contains text
   * @param {HTMLImageElement} img - Image element
   * @returns {number} - Likelihood score (0-1)
   */
  calculateTextLikelihood(img) {
    let score = 0;

    // Check dimensions (text images are often rectangular)
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    if (width >= this.textImageHeuristics.minWidth &&
        height >= this.textImageHeuristics.minHeight) {
      score += 0.2;
    }

    // Check aspect ratio (documents/screenshots often have specific ratios)
    const aspectRatio = width / height;
    if ((aspectRatio > 1.3 && aspectRatio < 1.8) || // Landscape document
        (aspectRatio > 0.7 && aspectRatio < 0.8)) {  // Portrait document
      score += 0.2;
    }

    // Check class names
    const className = img.className.toLowerCase();
    if (this.textImageHeuristics.suspiciousClassNames.some(name => className.includes(name))) {
      score += 0.3;
    }

    // Check alt text
    const altText = img.alt.toLowerCase();
    if (this.textImageHeuristics.suspiciousAltText.some(text => altText.includes(text))) {
      score += 0.3;
    }

    // Check file extension
    const src = img.src.toLowerCase();
    if (src.includes('screenshot') || src.includes('document') || src.includes('scan')) {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  /**
   * Get reasons for text likelihood score
   * @param {HTMLImageElement} img - Image element
   * @param {number} score - Likelihood score
   * @returns {Array<string>} - Reasons for the score
   */
  getTextLikelihoodReasons(img, score) {
    const reasons = [];

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    if (width >= this.textImageHeuristics.minWidth &&
        height >= this.textImageHeuristics.minHeight) {
      reasons.push(`Adequate size (${width}x${height})`);
    }

    const className = img.className.toLowerCase();
    const matchedClass = this.textImageHeuristics.suspiciousClassNames.find(name => className.includes(name));
    if (matchedClass) {
      reasons.push(`Suspicious class: ${matchedClass}`);
    }

    const altText = img.alt.toLowerCase();
    const matchedAlt = this.textImageHeuristics.suspiciousAltText.find(text => altText.includes(text));
    if (matchedAlt) {
      reasons.push(`Suspicious alt text: ${matchedAlt}`);
    }

    if (reasons.length === 0) {
      reasons.push('General heuristics');
    }

    return reasons;
  }

  /**
   * Extract text from an image element or URL
   * @param {HTMLImageElement|string} source - Image element or URL
   * @param {Object} options - OCR options
   * @returns {Promise<Object>} - OCR results
   */
  async extractText(source, options = {}) {
    if (!this.initialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        return {
          success: false,
          error: 'Failed to initialize Tesseract.js library'
        };
      }
    }

    const jobId = `ocr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      // Track job progress
      const progress = {
        id: jobId,
        status: 'initializing',
        progress: 0,
        startTime: startTime
      };
      this.activeOCRJobs.set(jobId, progress);

      // Get image source
      let imageSource;
      if (typeof source === 'string') {
        imageSource = source;
      } else if (source instanceof HTMLImageElement) {
        imageSource = source.src;
      } else if (source instanceof HTMLCanvasElement) {
        imageSource = source;
      } else {
        throw new Error('Invalid source type');
      }

      // Configure OCR options
      const language = options.language || 'eng';
      const ocrMode = options.ocrMode || 'PSM_AUTO';

      // Perform OCR
      progress.status = 'processing';

      const result = await this.tesseract.recognize(
        imageSource,
        language,
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              progress.progress = Math.round(m.progress * 100);
            }
          }
        }
      );

      // Process results
      const extractedData = {
        success: true,
        jobId: jobId,
        text: result.data.text,
        confidence: result.data.confidence,
        words: result.data.words.map(word => ({
          text: word.text,
          confidence: word.confidence,
          bbox: word.bbox
        })),
        lines: result.data.lines.map(line => ({
          text: line.text,
          confidence: line.confidence,
          bbox: line.bbox
        })),
        blocks: result.data.blocks.map(block => ({
          text: block.text,
          confidence: block.confidence,
          bbox: block.bbox
        })),
        statistics: {
          totalWords: result.data.words.length,
          totalLines: result.data.lines.length,
          totalBlocks: result.data.blocks.length,
          averageConfidence: this.calculateAverageConfidence(result.data.words),
          processingTime: Date.now() - startTime
        }
      };

      // Run OSINT pattern detection
      extractedData.osintFindings = this.detectOSINTPatterns(extractedData.text);

      // Update progress
      progress.status = 'completed';
      progress.progress = 100;

      // Clean up
      this.activeOCRJobs.delete(jobId);

      return extractedData;

    } catch (error) {
      this.activeOCRJobs.delete(jobId);
      return {
        success: false,
        jobId: jobId,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Calculate average confidence score
   * @param {Array<Object>} words - Array of word objects with confidence scores
   * @returns {number} - Average confidence (0-100)
   */
  calculateAverageConfidence(words) {
    if (words.length === 0) return 0;

    const totalConfidence = words.reduce((sum, word) => sum + word.confidence, 0);
    return Math.round(totalConfidence / words.length);
  }

  /**
   * Extract text from multiple images
   * @param {Array<HTMLImageElement|string>} sources - Array of image elements or URLs
   * @param {Object} options - OCR options
   * @returns {Promise<Object>} - Results for all images
   */
  async extractFromMultiple(sources, options = {}) {
    const results = {
      success: true,
      images: [],
      count: sources.length,
      successCount: 0,
      failureCount: 0
    };

    for (const source of sources) {
      try {
        const result = await this.extractText(source, options);

        results.images.push({
          source: typeof source === 'string' ? source : source.src,
          result: result
        });

        if (result.success) {
          results.successCount++;
        } else {
          results.failureCount++;
        }

      } catch (error) {
        results.images.push({
          source: typeof source === 'string' ? source : source.src,
          result: {
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
   * Extract text from all detected text images on page
   * @param {Object} options - OCR options
   * @returns {Promise<Object>} - OCR results for all detected images
   */
  async extractFromPage(options = {}) {
    const detectedImages = this.detectTextImages(options);

    if (detectedImages.length === 0) {
      return {
        success: true,
        images: [],
        count: 0,
        message: 'No text images detected on page'
      };
    }

    // Limit number of images to process
    const maxImages = options.maxImages || 10;
    const imagesToProcess = detectedImages.slice(0, maxImages);

    const results = {
      success: true,
      images: [],
      count: imagesToProcess.length,
      successCount: 0,
      failureCount: 0
    };

    for (const imageInfo of imagesToProcess) {
      try {
        const result = await this.extractText(imageInfo.element, options);

        results.images.push({
          ...imageInfo,
          ocr: result
        });

        if (result.success) {
          results.successCount++;
        } else {
          results.failureCount++;
        }

      } catch (error) {
        results.images.push({
          ...imageInfo,
          ocr: {
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
   * Detect OSINT patterns in OCR text
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
            confidence: this.calculatePatternConfidence(patternName, uniqueMatches)
          };
        }
      }

      // Additional analysis
      findings.summary = {
        totalPatterns: Object.keys(findings).length - 1,
        totalMatches: Object.values(findings)
          .filter(f => f.count !== undefined)
          .reduce((sum, f) => sum + f.count, 0),
        highConfidence: Object.values(findings)
          .filter(f => f.confidence > 0.8).length
      };

    } catch (error) {
      console.error('ImageOCR: Error detecting OSINT patterns:', error);
    }

    return findings;
  }

  /**
   * Calculate confidence score for pattern matches
   * @param {string} patternName - Name of the pattern
   * @param {Array<string>} matches - Matched values
   * @returns {number} - Confidence score (0-1)
   */
  calculatePatternConfidence(patternName, matches) {
    let confidence = 0.5; // Base confidence

    // OCR can introduce errors, so reduce confidence slightly
    confidence -= 0.1;

    // Increase confidence based on pattern type
    const highConfidencePatterns = ['email', 'url', 'ipv4'];
    if (highConfidencePatterns.includes(patternName)) {
      confidence += 0.3;
    }

    // Increase confidence based on number of matches
    if (matches.length > 2) {
      confidence += 0.1;
    }

    // Decrease confidence for overly common patterns
    if (matches.length > 20) {
      confidence -= 0.2;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Preprocess image for better OCR results
   * @param {HTMLImageElement|HTMLCanvasElement} source - Image source
   * @param {Object} options - Preprocessing options
   * @returns {Promise<HTMLCanvasElement>} - Preprocessed canvas
   */
  async preprocessImage(source, options = {}) {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Get source dimensions
      let width, height;
      if (source instanceof HTMLImageElement) {
        width = source.naturalWidth || source.width;
        height = source.naturalHeight || source.height;
      } else {
        width = source.width;
        height = source.height;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw image to canvas
      ctx.drawImage(source, 0, 0, width, height);

      // Get image data
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Apply preprocessing
      if (options.grayscale !== false) {
        // Convert to grayscale
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          data[i] = avg;     // Red
          data[i + 1] = avg; // Green
          data[i + 2] = avg; // Blue
        }
      }

      if (options.threshold) {
        // Apply threshold
        const threshold = options.threshold || 128;
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          const value = avg > threshold ? 255 : 0;
          data[i] = value;
          data[i + 1] = value;
          data[i + 2] = value;
        }
      }

      if (options.contrast) {
        // Increase contrast
        const factor = (259 * (options.contrast + 255)) / (255 * (259 - options.contrast));
        for (let i = 0; i < data.length; i += 4) {
          data[i] = factor * (data[i] - 128) + 128;
          data[i + 1] = factor * (data[i + 1] - 128) + 128;
          data[i + 2] = factor * (data[i + 2] - 128) + 128;
        }
      }

      // Put processed data back
      ctx.putImageData(imageData, 0, 0);

      return canvas;

    } catch (error) {
      console.error('ImageOCR: Error preprocessing image:', error);
      return source;
    }
  }

  /**
   * Get OCR job progress
   * @param {string} jobId - ID of the OCR job
   * @returns {Object|null} - Progress information or null if not found
   */
  getJobProgress(jobId) {
    return this.activeOCRJobs.get(jobId) || null;
  }

  /**
   * Cancel an active OCR job
   * @param {string} jobId - ID of the job to cancel
   * @returns {boolean} - Whether cancellation was successful
   */
  cancelJob(jobId) {
    if (this.activeOCRJobs.has(jobId)) {
      this.activeOCRJobs.delete(jobId);
      return true;
    }
    return false;
  }

  /**
   * Get list of all active OCR jobs
   * @returns {Array<Object>} - Array of active job progress objects
   */
  getActiveJobs() {
    return Array.from(this.activeOCRJobs.values());
  }

  /**
   * Export OCR results to various formats
   * @param {Object} ocrResults - Results from OCR
   * @param {string} format - Export format ('json', 'txt', 'csv')
   * @returns {string} - Formatted export data
   */
  exportResults(ocrResults, format = 'json') {
    try {
      switch (format.toLowerCase()) {
        case 'json':
          return JSON.stringify(ocrResults, null, 2);

        case 'txt':
          return ocrResults.text || '';

        case 'csv':
          // Export words with positions and confidence
          let csv = 'Text,Confidence,X,Y,Width,Height\n';
          if (ocrResults.words) {
            ocrResults.words.forEach(word => {
              csv += `"${word.text}",${word.confidence},${word.bbox.x0},${word.bbox.y0},${word.bbox.x1 - word.bbox.x0},${word.bbox.y1 - word.bbox.y0}\n`;
            });
          }
          return csv;

        case 'hocr':
          // Export in hOCR format (HTML-based OCR format)
          return this.exportToHOCR(ocrResults);

        default:
          return JSON.stringify(ocrResults, null, 2);
      }
    } catch (error) {
      console.error('ImageOCR: Error exporting results:', error);
      return '';
    }
  }

  /**
   * Export results to hOCR format
   * @param {Object} ocrResults - OCR results
   * @returns {string} - hOCR formatted HTML
   */
  exportToHOCR(ocrResults) {
    let hocr = '<?xml version="1.0" encoding="UTF-8"?>\n';
    hocr += '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">\n';
    hocr += '<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">\n';
    hocr += '<head><title>OCR Results</title></head>\n';
    hocr += '<body>\n';

    if (ocrResults.lines) {
      ocrResults.lines.forEach((line, idx) => {
        const bbox = line.bbox;
        hocr += `  <span class="ocr_line" title="bbox ${bbox.x0} ${bbox.y0} ${bbox.x1} ${bbox.y1}; x_wconf ${line.confidence}">${line.text}</span>\n`;
      });
    }

    hocr += '</body>\n</html>';
    return hocr;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImageOCR;
}
