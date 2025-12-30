/**
 * Content Extractor Utility for Basset Hound Chrome Extension
 *
 * Provides comprehensive content extraction capabilities:
 * - Extract HTML tables with structured data
 * - Extract all links with metadata and attributes
 * - Extract images with src, alt, and dimensions
 * - Extract structured data (JSON-LD, Microdata, RDFa)
 * - Extract metadata (meta tags, Open Graph, Twitter Cards)
 * - Extract clean text content without HTML markup
 * - Download page resources (images, CSS, JS files)
 */

/**
 * ContentExtractor class for extracting various types of content from web pages
 */
class ContentExtractor {
  /**
   * Create a new ContentExtractor instance
   * @param {Document} document - Document to extract from (defaults to window.document)
   */
  constructor(document = window.document) {
    this.document = document;
  }

  /**
   * Extract all HTML tables with data
   * @param {Object} options - Extraction options
   * @param {string} options.selector - CSS selector for tables (default: 'table')
   * @param {boolean} options.includeHeaders - Include table headers (default: true)
   * @param {boolean} options.parseNumbers - Try to parse numeric values (default: false)
   * @param {number} options.minRows - Minimum number of rows to include table (default: 0)
   * @param {number} options.maxTables - Maximum number of tables to extract (default: all)
   * @returns {Object} - Extracted tables data
   */
  extractTables(options = {}) {
    try {
      const selector = options.selector || 'table';
      const includeHeaders = options.includeHeaders !== false;
      const parseNumbers = options.parseNumbers || false;
      const minRows = options.minRows || 0;
      const maxTables = options.maxTables || Infinity;

      const tables = this.document.querySelectorAll(selector);
      const extractedTables = [];

      for (let i = 0; i < Math.min(tables.length, maxTables); i++) {
        const table = tables[i];
        const tableData = this._extractTableData(table, includeHeaders, parseNumbers);

        // Filter by minimum rows
        if (tableData.rows.length >= minRows) {
          extractedTables.push({
            index: i,
            id: table.id || null,
            className: table.className || null,
            headers: tableData.headers,
            rows: tableData.rows,
            rowCount: tableData.rows.length,
            columnCount: tableData.headers?.length || 0,
            caption: this._getTableCaption(table),
            summary: table.getAttribute('summary') || null
          });
        }
      }

      return {
        success: true,
        tables: extractedTables,
        count: extractedTables.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract all links with metadata
   * @param {Object} options - Extraction options
   * @param {string} options.selector - CSS selector for links (default: 'a[href]')
   * @param {boolean} options.includeInternal - Include internal links (default: true)
   * @param {boolean} options.includeExternal - Include external links (default: true)
   * @param {boolean} options.includeAnchors - Include anchor links (default: true)
   * @param {Array<string>} options.attributes - Additional attributes to extract
   * @param {number} options.maxLinks - Maximum number of links to extract
   * @returns {Object} - Extracted links data
   */
  extractLinks(options = {}) {
    try {
      const selector = options.selector || 'a[href]';
      const includeInternal = options.includeInternal !== false;
      const includeExternal = options.includeExternal !== false;
      const includeAnchors = options.includeAnchors !== false;
      const attributes = options.attributes || [];
      const maxLinks = options.maxLinks || Infinity;

      const links = this.document.querySelectorAll(selector);
      const extractedLinks = [];
      const baseUrl = this.document.location.href;

      for (let i = 0; i < Math.min(links.length, maxLinks); i++) {
        const link = links[i];
        const href = link.href;
        const linkType = this._getLinkType(href, baseUrl);

        // Filter by link type
        if (
          (linkType === 'internal' && !includeInternal) ||
          (linkType === 'external' && !includeExternal) ||
          (linkType === 'anchor' && !includeAnchors)
        ) {
          continue;
        }

        const linkData = {
          href: href,
          text: link.textContent.trim(),
          title: link.title || null,
          target: link.target || null,
          rel: link.rel || null,
          type: linkType,
          protocol: this._getProtocol(href),
          domain: this._getDomain(href)
        };

        // Extract additional attributes
        for (const attr of attributes) {
          linkData[attr] = link.getAttribute(attr);
        }

        extractedLinks.push(linkData);
      }

      // Group links by type
      const grouped = {
        internal: extractedLinks.filter(l => l.type === 'internal'),
        external: extractedLinks.filter(l => l.type === 'external'),
        anchor: extractedLinks.filter(l => l.type === 'anchor'),
        other: extractedLinks.filter(l => l.type === 'other')
      };

      return {
        success: true,
        links: extractedLinks,
        count: extractedLinks.length,
        grouped: {
          internal: grouped.internal.length,
          external: grouped.external.length,
          anchor: grouped.anchor.length,
          other: grouped.other.length
        },
        groupedLinks: grouped,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract all images with metadata
   * @param {Object} options - Extraction options
   * @param {string} options.selector - CSS selector for images (default: 'img')
   * @param {boolean} options.includeDataUrls - Include data URLs (default: false)
   * @param {boolean} options.includeDimensions - Include image dimensions (default: true)
   * @param {Array<string>} options.attributes - Additional attributes to extract
   * @param {number} options.maxImages - Maximum number of images to extract
   * @returns {Object} - Extracted images data
   */
  extractImages(options = {}) {
    try {
      const selector = options.selector || 'img';
      const includeDataUrls = options.includeDataUrls || false;
      const includeDimensions = options.includeDimensions !== false;
      const attributes = options.attributes || [];
      const maxImages = options.maxImages || Infinity;

      const images = this.document.querySelectorAll(selector);
      const extractedImages = [];

      for (let i = 0; i < Math.min(images.length, maxImages); i++) {
        const img = images[i];
        const src = img.src;

        // Filter data URLs if not included
        if (!includeDataUrls && src.startsWith('data:')) {
          continue;
        }

        const imageData = {
          src: src,
          alt: img.alt || null,
          title: img.title || null,
          loading: img.loading || null,
          crossOrigin: img.crossOrigin || null
        };

        // Include dimensions if requested
        if (includeDimensions) {
          imageData.width = img.width || img.naturalWidth || null;
          imageData.height = img.height || img.naturalHeight || null;
          imageData.naturalWidth = img.naturalWidth || null;
          imageData.naturalHeight = img.naturalHeight || null;
        }

        // Extract additional attributes
        for (const attr of attributes) {
          imageData[attr] = img.getAttribute(attr);
        }

        // Extract srcset if present
        if (img.srcset) {
          imageData.srcset = img.srcset;
          imageData.sizes = img.sizes || null;
        }

        extractedImages.push(imageData);
      }

      return {
        success: true,
        images: extractedImages,
        count: extractedImages.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract structured data (JSON-LD, Microdata, RDFa)
   * @param {Object} options - Extraction options
   * @param {boolean} options.includeJsonLd - Include JSON-LD (default: true)
   * @param {boolean} options.includeMicrodata - Include Microdata (default: true)
   * @param {boolean} options.includeRdfa - Include RDFa (default: true)
   * @returns {Object} - Extracted structured data
   */
  extractStructuredData(options = {}) {
    try {
      const includeJsonLd = options.includeJsonLd !== false;
      const includeMicrodata = options.includeMicrodata !== false;
      const includeRdfa = options.includeRdfa !== false;

      const structuredData = {};

      // Extract JSON-LD
      if (includeJsonLd) {
        structuredData.jsonLd = this._extractJsonLd();
      }

      // Extract Microdata
      if (includeMicrodata) {
        structuredData.microdata = this._extractMicrodata();
      }

      // Extract RDFa
      if (includeRdfa) {
        structuredData.rdfa = this._extractRdfa();
      }

      return {
        success: true,
        structuredData: structuredData,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract metadata (meta tags, Open Graph, Twitter Cards)
   * @param {Object} options - Extraction options
   * @param {boolean} options.includeStandard - Include standard meta tags (default: true)
   * @param {boolean} options.includeOpenGraph - Include Open Graph tags (default: true)
   * @param {boolean} options.includeTwitter - Include Twitter Card tags (default: true)
   * @param {boolean} options.includeDublinCore - Include Dublin Core tags (default: true)
   * @returns {Object} - Extracted metadata
   */
  extractMetadata(options = {}) {
    try {
      const includeStandard = options.includeStandard !== false;
      const includeOpenGraph = options.includeOpenGraph !== false;
      const includeTwitter = options.includeTwitter !== false;
      const includeDublinCore = options.includeDublinCore !== false;

      const metadata = {
        title: this.document.title,
        url: this.document.location.href,
        baseUrl: this.document.baseURI,
        charset: this.document.characterSet,
        lang: this.document.documentElement.lang || null
      };

      // Extract standard meta tags
      if (includeStandard) {
        metadata.standard = this._extractStandardMeta();
      }

      // Extract Open Graph tags
      if (includeOpenGraph) {
        metadata.openGraph = this._extractOpenGraph();
      }

      // Extract Twitter Card tags
      if (includeTwitter) {
        metadata.twitter = this._extractTwitterCard();
      }

      // Extract Dublin Core tags
      if (includeDublinCore) {
        metadata.dublinCore = this._extractDublinCore();
      }

      // Extract link tags
      metadata.links = this._extractLinkTags();

      return {
        success: true,
        metadata: metadata,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract clean text content without HTML markup
   * @param {Object} options - Extraction options
   * @param {string} options.selector - CSS selector for content (default: 'body')
   * @param {boolean} options.preserveWhitespace - Preserve whitespace (default: false)
   * @param {boolean} options.includeHidden - Include hidden elements (default: false)
   * @param {Array<string>} options.excludeSelectors - Selectors to exclude
   * @param {number} options.maxLength - Maximum text length
   * @returns {Object} - Extracted text content
   */
  extractTextContent(options = {}) {
    try {
      const selector = options.selector || 'body';
      const preserveWhitespace = options.preserveWhitespace || false;
      const includeHidden = options.includeHidden || false;
      const excludeSelectors = options.excludeSelectors || ['script', 'style', 'noscript'];
      const maxLength = options.maxLength || Infinity;

      const element = this.document.querySelector(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }

      // Clone element to avoid modifying the DOM
      const clone = element.cloneNode(true);

      // Remove excluded elements
      for (const excludeSelector of excludeSelectors) {
        const excluded = clone.querySelectorAll(excludeSelector);
        excluded.forEach(el => el.remove());
      }

      // Remove hidden elements if not included
      if (!includeHidden) {
        const hidden = Array.from(clone.querySelectorAll('*')).filter(el => {
          const style = window.getComputedStyle(el);
          return style.display === 'none' || style.visibility === 'hidden';
        });
        hidden.forEach(el => el.remove());
      }

      // Extract text content
      let text = clone.textContent || '';

      // Clean whitespace if not preserved
      if (!preserveWhitespace) {
        text = text.replace(/\s+/g, ' ').trim();
      }

      // Truncate if exceeds max length
      if (text.length > maxLength) {
        text = text.substring(0, maxLength) + '...';
      }

      return {
        success: true,
        text: text,
        length: text.length,
        wordCount: this._countWords(text),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Download page resources (images, CSS, JS)
   * @param {Object} options - Download options
   * @param {Array<string>} options.types - Resource types to download ('images', 'css', 'js')
   * @param {string} options.urlPattern - Filter resources by URL pattern (regex)
   * @param {number} options.maxSize - Maximum file size in bytes
   * @param {number} options.maxResources - Maximum number of resources to download
   * @returns {Promise<Object>} - Download results
   */
  async downloadResources(options = {}) {
    try {
      const types = options.types || ['images', 'css', 'js'];
      const urlPattern = options.urlPattern ? new RegExp(options.urlPattern) : null;
      const maxSize = options.maxSize || Infinity;
      const maxResources = options.maxResources || 100;

      const resources = [];

      // Collect resources based on types
      if (types.includes('images')) {
        const images = this.document.querySelectorAll('img[src]');
        for (const img of images) {
          resources.push({
            type: 'image',
            url: img.src,
            filename: this._getFilename(img.src)
          });
        }
      }

      if (types.includes('css')) {
        const links = this.document.querySelectorAll('link[rel="stylesheet"]');
        for (const link of links) {
          resources.push({
            type: 'css',
            url: link.href,
            filename: this._getFilename(link.href)
          });
        }
      }

      if (types.includes('js')) {
        const scripts = this.document.querySelectorAll('script[src]');
        for (const script of scripts) {
          resources.push({
            type: 'js',
            url: script.src,
            filename: this._getFilename(script.src)
          });
        }
      }

      // Filter by URL pattern
      let filteredResources = resources;
      if (urlPattern) {
        filteredResources = resources.filter(r => urlPattern.test(r.url));
      }

      // Limit number of resources
      filteredResources = filteredResources.slice(0, maxResources);

      // Download resources
      const downloaded = [];
      const failed = [];

      for (const resource of filteredResources) {
        try {
          const result = await this._downloadResource(resource.url, resource.filename, maxSize);
          if (result.success) {
            downloaded.push({
              ...resource,
              size: result.size,
              downloadId: result.downloadId
            });
          } else {
            failed.push({
              ...resource,
              error: result.error
            });
          }
        } catch (error) {
          failed.push({
            ...resource,
            error: error.message
          });
        }
      }

      return {
        success: true,
        downloaded: downloaded,
        failed: failed,
        totalResources: filteredResources.length,
        downloadedCount: downloaded.length,
        failedCount: failed.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Extract table data
   * @private
   */
  _extractTableData(table, includeHeaders, parseNumbers) {
    const headers = [];
    const rows = [];

    // Extract headers
    const headerRows = table.querySelectorAll('thead tr, tr:first-child');
    if (headerRows.length > 0 && includeHeaders) {
      const headerCells = headerRows[0].querySelectorAll('th, td');
      for (const cell of headerCells) {
        headers.push(cell.textContent.trim());
      }
    }

    // Extract rows
    const bodyRows = table.querySelectorAll('tbody tr, tr');
    const startIndex = includeHeaders && headerRows.length > 0 ? 1 : 0;

    for (let i = startIndex; i < bodyRows.length; i++) {
      const row = bodyRows[i];
      const cells = row.querySelectorAll('td, th');
      const rowData = [];

      for (const cell of cells) {
        let value = cell.textContent.trim();

        // Try to parse as number if requested
        if (parseNumbers && !isNaN(value) && value !== '') {
          value = parseFloat(value);
        }

        rowData.push(value);
      }

      if (rowData.length > 0) {
        rows.push(rowData);
      }
    }

    return { headers, rows };
  }

  /**
   * Get table caption
   * @private
   */
  _getTableCaption(table) {
    const caption = table.querySelector('caption');
    return caption ? caption.textContent.trim() : null;
  }

  /**
   * Get link type (internal, external, anchor)
   * @private
   */
  _getLinkType(href, baseUrl) {
    if (href.startsWith('#')) {
      return 'anchor';
    }

    try {
      const url = new URL(href, baseUrl);
      const base = new URL(baseUrl);

      if (url.hostname === base.hostname) {
        return 'internal';
      } else {
        return 'external';
      }
    } catch (e) {
      return 'other';
    }
  }

  /**
   * Get protocol from URL
   * @private
   */
  _getProtocol(href) {
    try {
      const url = new URL(href);
      return url.protocol.replace(':', '');
    } catch (e) {
      return null;
    }
  }

  /**
   * Get domain from URL
   * @private
   */
  _getDomain(href) {
    try {
      const url = new URL(href);
      return url.hostname;
    } catch (e) {
      return null;
    }
  }

  /**
   * Extract JSON-LD structured data
   * @private
   */
  _extractJsonLd() {
    const scripts = this.document.querySelectorAll('script[type="application/ld+json"]');
    const jsonLdData = [];

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        jsonLdData.push(data);
      } catch (e) {
        // Skip invalid JSON
      }
    }

    return jsonLdData;
  }

  /**
   * Extract Microdata
   * @private
   */
  _extractMicrodata() {
    const items = this.document.querySelectorAll('[itemscope]');
    const microdataItems = [];

    for (const item of items) {
      const itemData = {
        type: item.getAttribute('itemtype'),
        properties: {}
      };

      const props = item.querySelectorAll('[itemprop]');
      for (const prop of props) {
        const name = prop.getAttribute('itemprop');
        const value = prop.getAttribute('content') || prop.textContent.trim();
        itemData.properties[name] = value;
      }

      microdataItems.push(itemData);
    }

    return microdataItems;
  }

  /**
   * Extract RDFa data
   * @private
   */
  _extractRdfa() {
    const elements = this.document.querySelectorAll('[typeof], [property]');
    const rdfaData = [];

    for (const element of elements) {
      const data = {
        type: element.getAttribute('typeof'),
        property: element.getAttribute('property'),
        content: element.getAttribute('content') || element.textContent.trim(),
        resource: element.getAttribute('resource'),
        about: element.getAttribute('about')
      };

      rdfaData.push(data);
    }

    return rdfaData;
  }

  /**
   * Extract standard meta tags
   * @private
   */
  _extractStandardMeta() {
    const meta = {};
    const metaTags = this.document.querySelectorAll('meta[name]');

    for (const tag of metaTags) {
      const name = tag.getAttribute('name');
      const content = tag.getAttribute('content');
      if (name && content) {
        meta[name] = content;
      }
    }

    return meta;
  }

  /**
   * Extract Open Graph tags
   * @private
   */
  _extractOpenGraph() {
    const og = {};
    const ogTags = this.document.querySelectorAll('meta[property^="og:"]');

    for (const tag of ogTags) {
      const property = tag.getAttribute('property').replace('og:', '');
      const content = tag.getAttribute('content');
      if (property && content) {
        og[property] = content;
      }
    }

    return og;
  }

  /**
   * Extract Twitter Card tags
   * @private
   */
  _extractTwitterCard() {
    const twitter = {};
    const twitterTags = this.document.querySelectorAll('meta[name^="twitter:"]');

    for (const tag of twitterTags) {
      const name = tag.getAttribute('name').replace('twitter:', '');
      const content = tag.getAttribute('content');
      if (name && content) {
        twitter[name] = content;
      }
    }

    return twitter;
  }

  /**
   * Extract Dublin Core tags
   * @private
   */
  _extractDublinCore() {
    const dc = {};
    const dcTags = this.document.querySelectorAll('meta[name^="DC."], meta[name^="dc."]');

    for (const tag of dcTags) {
      const name = tag.getAttribute('name').replace(/^DC\./i, '');
      const content = tag.getAttribute('content');
      if (name && content) {
        dc[name] = content;
      }
    }

    return dc;
  }

  /**
   * Extract link tags
   * @private
   */
  _extractLinkTags() {
    const links = {};
    const linkTags = this.document.querySelectorAll('link[rel]');

    for (const tag of linkTags) {
      const rel = tag.getAttribute('rel');
      const href = tag.href;
      if (rel && href) {
        if (!links[rel]) {
          links[rel] = [];
        }
        links[rel].push({
          href: href,
          type: tag.type || null,
          sizes: tag.sizes?.toString() || null,
          media: tag.media || null
        });
      }
    }

    return links;
  }

  /**
   * Count words in text
   * @private
   */
  _countWords(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Get filename from URL
   * @private
   */
  _getFilename(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
      return filename || 'resource';
    } catch (e) {
      return 'resource';
    }
  }

  /**
   * Download a resource
   * @private
   */
  async _downloadResource(url, filename, maxSize) {
    return new Promise((resolve, reject) => {
      // Note: This function needs to be called from background script
      // as content scripts don't have access to chrome.downloads API
      chrome.runtime.sendMessage(
        {
          action: 'download_resource',
          url: url,
          filename: filename,
          maxSize: maxSize
        },
        response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });
  }
}

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.ContentExtractor = ContentExtractor;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ContentExtractor };
}
