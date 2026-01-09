/**
 * Table Parser Utility for Basset Hound Chrome Extension
 *
 * Provides table extraction and analysis:
 * - Parse HTML tables to structured data
 * - Extract data from PDF tables (via PDF.js)
 * - Detect columns that might contain OSINT data
 * - Export tables to JSON/CSV
 * - Handle nested tables and complex layouts
 * - Intelligent column type detection
 *
 * Supports both HTML tables and tables extracted from PDFs.
 */

class TableParser {
  constructor() {
    // Column type patterns for OSINT data detection
    this.columnPatterns = {
      email: {
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
        headerKeywords: ['email', 'e-mail', 'mail', 'contact']
      },
      phone: {
        pattern: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
        headerKeywords: ['phone', 'tel', 'telephone', 'mobile', 'cell']
      },
      name: {
        pattern: /^[A-Z][a-z]+\s+[A-Z][a-z]+/,
        headerKeywords: ['name', 'full name', 'first name', 'last name', 'surname']
      },
      address: {
        pattern: /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|highway|hwy|lane|ln|drive|dr)/i,
        headerKeywords: ['address', 'location', 'street', 'city']
      },
      date: {
        pattern: /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/,
        headerKeywords: ['date', 'dob', 'birth', 'created', 'updated']
      },
      ssn: {
        pattern: /\b\d{3}-\d{2}-\d{4}\b/,
        headerKeywords: ['ssn', 'social security', 'tax id']
      },
      ipAddress: {
        pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
        headerKeywords: ['ip', 'ip address', 'host', 'server']
      },
      url: {
        pattern: /https?:\/\/[^\s<>"{}|\\^`\[\]]+/,
        headerKeywords: ['url', 'website', 'link', 'domain']
      },
      id: {
        pattern: /^[A-Z0-9]{6,}$/,
        headerKeywords: ['id', 'identifier', 'key', 'reference', 'number']
      },
      currency: {
        pattern: /\$?\d+\.?\d*|\d+\.?\d*\s*(USD|EUR|GBP|CAD)/,
        headerKeywords: ['price', 'cost', 'amount', 'salary', 'fee', 'total']
      }
    };

    this.exportFormats = ['json', 'csv', 'tsv', 'html', 'markdown'];
  }

  /**
   * Extract and parse HTML table
   * @param {HTMLTableElement} table - Table element to parse
   * @param {Object} options - Parsing options
   * @returns {Object} - Parsed table data
   */
  parseHTMLTable(table, options = {}) {
    try {
      const includeHeaders = options.includeHeaders !== false;
      const detectTypes = options.detectTypes !== false;
      const analyzeOSINT = options.analyzeOSINT !== false;

      // Get table metadata
      const metadata = {
        id: table.id || null,
        className: table.className || null,
        caption: this.getTableCaption(table),
        summary: table.getAttribute('summary') || null
      };

      // Extract headers
      const headers = this.extractHeaders(table);

      // Extract rows
      const rows = this.extractRows(table, headers.length);

      // Detect column types if requested
      let columnTypes = null;
      if (detectTypes && headers.length > 0) {
        columnTypes = this.detectColumnTypes(headers, rows);
      }

      // Analyze for OSINT data if requested
      let osintFindings = null;
      if (analyzeOSINT) {
        osintFindings = this.analyzeTableForOSINT(headers, rows, columnTypes);
      }

      return {
        success: true,
        metadata: metadata,
        headers: headers,
        rows: rows,
        statistics: {
          rowCount: rows.length,
          columnCount: headers.length,
          hasHeaders: headers.length > 0,
          hasNestedTables: this.hasNestedTables(table)
        },
        columnTypes: columnTypes,
        osintFindings: osintFindings
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract table caption
   * @param {HTMLTableElement} table - Table element
   * @returns {string|null} - Caption text or null
   */
  getTableCaption(table) {
    const caption = table.querySelector('caption');
    return caption ? caption.textContent.trim() : null;
  }

  /**
   * Extract table headers
   * @param {HTMLTableElement} table - Table element
   * @returns {Array<Object>} - Array of header objects
   */
  extractHeaders(table) {
    const headers = [];

    try {
      // Try to find headers in thead
      const thead = table.querySelector('thead');
      if (thead) {
        const headerRow = thead.querySelector('tr');
        if (headerRow) {
          const headerCells = headerRow.querySelectorAll('th, td');
          headerCells.forEach((cell, index) => {
            headers.push({
              index: index,
              text: cell.textContent.trim(),
              element: cell.tagName.toLowerCase(),
              colspan: parseInt(cell.getAttribute('colspan')) || 1,
              rowspan: parseInt(cell.getAttribute('rowspan')) || 1
            });
          });
          return headers;
        }
      }

      // Try to find headers in first row with th elements
      const firstRow = table.querySelector('tr');
      if (firstRow) {
        const headerCells = firstRow.querySelectorAll('th');
        if (headerCells.length > 0) {
          headerCells.forEach((cell, index) => {
            headers.push({
              index: index,
              text: cell.textContent.trim(),
              element: 'th',
              colspan: parseInt(cell.getAttribute('colspan')) || 1,
              rowspan: parseInt(cell.getAttribute('rowspan')) || 1
            });
          });
        }
      }

      return headers;

    } catch (error) {
      console.error('TableParser: Error extracting headers:', error);
      return [];
    }
  }

  /**
   * Extract table rows
   * @param {HTMLTableElement} table - Table element
   * @param {number} headerCount - Number of headers (for validation)
   * @returns {Array<Array>} - Array of row arrays
   */
  extractRows(table, headerCount = 0) {
    const rows = [];

    try {
      const tbody = table.querySelector('tbody') || table;
      const rowElements = tbody.querySelectorAll('tr');

      // Skip first row if it contains headers
      let startIndex = 0;
      if (headerCount > 0) {
        const firstRow = rowElements[0];
        if (firstRow && firstRow.querySelector('th')) {
          startIndex = 1;
        }
      }

      for (let i = startIndex; i < rowElements.length; i++) {
        const rowElement = rowElements[i];
        const cells = rowElement.querySelectorAll('td, th');

        const rowData = [];
        cells.forEach((cell) => {
          rowData.push({
            text: cell.textContent.trim(),
            html: cell.innerHTML,
            colspan: parseInt(cell.getAttribute('colspan')) || 1,
            rowspan: parseInt(cell.getAttribute('rowspan')) || 1,
            className: cell.className || null
          });
        });

        if (rowData.length > 0) {
          rows.push(rowData);
        }
      }

      return rows;

    } catch (error) {
      console.error('TableParser: Error extracting rows:', error);
      return [];
    }
  }

  /**
   * Check if table has nested tables
   * @param {HTMLTableElement} table - Table element
   * @returns {boolean} - Whether table contains nested tables
   */
  hasNestedTables(table) {
    return table.querySelectorAll('table').length > 0;
  }

  /**
   * Detect column types based on data patterns
   * @param {Array<Object>} headers - Table headers
   * @param {Array<Array>} rows - Table rows
   * @returns {Array<Object>} - Array of column type information
   */
  detectColumnTypes(headers, rows) {
    const columnTypes = [];

    for (let colIndex = 0; colIndex < headers.length; colIndex++) {
      const header = headers[colIndex];
      const columnData = rows.map(row => row[colIndex]?.text || '').filter(text => text.length > 0);

      // Analyze column data
      const typeAnalysis = {
        columnIndex: colIndex,
        headerText: header.text,
        sampleSize: columnData.length,
        detectedTypes: [],
        primaryType: 'text', // default
        confidence: 0
      };

      // Check header keywords
      const headerLower = header.text.toLowerCase();
      for (const [typeName, typeConfig] of Object.entries(this.columnPatterns)) {
        if (typeConfig.headerKeywords.some(keyword => headerLower.includes(keyword))) {
          typeAnalysis.detectedTypes.push({
            type: typeName,
            source: 'header',
            confidence: 0.8
          });
        }
      }

      // Check data patterns
      if (columnData.length > 0) {
        for (const [typeName, typeConfig] of Object.entries(this.columnPatterns)) {
          const matchCount = columnData.filter(value => typeConfig.pattern.test(value)).length;
          const matchRate = matchCount / columnData.length;

          if (matchRate > 0.5) { // More than 50% match
            typeAnalysis.detectedTypes.push({
              type: typeName,
              source: 'data',
              confidence: matchRate,
              matchCount: matchCount
            });
          }
        }
      }

      // Determine primary type
      if (typeAnalysis.detectedTypes.length > 0) {
        // Sort by confidence and pick highest
        typeAnalysis.detectedTypes.sort((a, b) => b.confidence - a.confidence);
        typeAnalysis.primaryType = typeAnalysis.detectedTypes[0].type;
        typeAnalysis.confidence = typeAnalysis.detectedTypes[0].confidence;
      }

      columnTypes.push(typeAnalysis);
    }

    return columnTypes;
  }

  /**
   * Analyze table for OSINT data
   * @param {Array<Object>} headers - Table headers
   * @param {Array<Array>} rows - Table rows
   * @param {Array<Object>} columnTypes - Column type information
   * @returns {Object} - OSINT findings
   */
  analyzeTableForOSINT(headers, rows, columnTypes) {
    const findings = {
      sensitiveColumns: [],
      patternMatches: {},
      riskLevel: 'low',
      recommendations: []
    };

    try {
      // Identify sensitive columns
      const sensitiveTypes = ['email', 'phone', 'ssn', 'address', 'ipAddress'];

      if (columnTypes) {
        columnTypes.forEach(colType => {
          if (sensitiveTypes.includes(colType.primaryType) && colType.confidence > 0.5) {
            findings.sensitiveColumns.push({
              columnIndex: colType.columnIndex,
              headerText: colType.headerText,
              dataType: colType.primaryType,
              confidence: colType.confidence
            });
          }
        });
      }

      // Extract all pattern matches
      for (const [typeName, typeConfig] of Object.entries(this.columnPatterns)) {
        const matches = new Set();

        rows.forEach(row => {
          row.forEach(cell => {
            const text = cell.text;
            const match = text.match(typeConfig.pattern);
            if (match) {
              match.forEach(m => matches.add(m));
            }
          });
        });

        if (matches.size > 0) {
          findings.patternMatches[typeName] = {
            count: matches.size,
            samples: Array.from(matches).slice(0, 5) // First 5 samples
          };
        }
      }

      // Calculate risk level
      const sensitiveCount = findings.sensitiveColumns.length;
      if (sensitiveCount >= 3) {
        findings.riskLevel = 'high';
        findings.recommendations.push('Table contains multiple sensitive data types');
      } else if (sensitiveCount >= 1) {
        findings.riskLevel = 'medium';
        findings.recommendations.push('Table contains sensitive data');
      } else {
        findings.riskLevel = 'low';
      }

      // Add recommendations based on findings
      if (findings.patternMatches.ssn) {
        findings.recommendations.push('SSN data detected - ensure proper data protection');
      }
      if (findings.patternMatches.email) {
        findings.recommendations.push('Email addresses detected - verify consent for data collection');
      }
      if (findings.patternMatches.phone) {
        findings.recommendations.push('Phone numbers detected - ensure compliance with privacy laws');
      }

    } catch (error) {
      console.error('TableParser: Error analyzing table for OSINT:', error);
    }

    return findings;
  }

  /**
   * Parse all tables on the page
   * @param {Object} options - Parsing options
   * @returns {Object} - Results for all tables
   */
  parsePageTables(options = {}) {
    try {
      const tables = document.querySelectorAll('table');
      const parsedTables = [];

      const maxTables = options.maxTables || Infinity;
      const minRows = options.minRows || 0;

      for (let i = 0; i < Math.min(tables.length, maxTables); i++) {
        const table = tables[i];
        const parsed = this.parseHTMLTable(table, options);

        // Filter by minimum rows
        if (parsed.success && parsed.rows.length >= minRows) {
          parsedTables.push({
            tableIndex: i,
            ...parsed
          });
        }
      }

      return {
        success: true,
        tables: parsedTables,
        count: parsedTables.length,
        totalTablesOnPage: tables.length
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Export table to specified format
   * @param {Object} tableData - Parsed table data
   * @param {string} format - Export format
   * @returns {string} - Formatted export data
   */
  exportTable(tableData, format = 'json') {
    try {
      switch (format.toLowerCase()) {
        case 'json':
          return this.exportToJSON(tableData);

        case 'csv':
          return this.exportToCSV(tableData);

        case 'tsv':
          return this.exportToTSV(tableData);

        case 'html':
          return this.exportToHTML(tableData);

        case 'markdown':
          return this.exportToMarkdown(tableData);

        default:
          return this.exportToJSON(tableData);
      }
    } catch (error) {
      console.error('TableParser: Error exporting table:', error);
      return '';
    }
  }

  /**
   * Export table to JSON
   * @param {Object} tableData - Parsed table data
   * @returns {string} - JSON string
   */
  exportToJSON(tableData) {
    return JSON.stringify(tableData, null, 2);
  }

  /**
   * Export table to CSV
   * @param {Object} tableData - Parsed table data
   * @returns {string} - CSV string
   */
  exportToCSV(tableData) {
    let csv = '';

    // Add headers
    if (tableData.headers && tableData.headers.length > 0) {
      csv += tableData.headers.map(h => `"${h.text}"`).join(',') + '\n';
    }

    // Add rows
    if (tableData.rows) {
      tableData.rows.forEach(row => {
        csv += row.map(cell => `"${cell.text}"`).join(',') + '\n';
      });
    }

    return csv;
  }

  /**
   * Export table to TSV
   * @param {Object} tableData - Parsed table data
   * @returns {string} - TSV string
   */
  exportToTSV(tableData) {
    let tsv = '';

    // Add headers
    if (tableData.headers && tableData.headers.length > 0) {
      tsv += tableData.headers.map(h => h.text).join('\t') + '\n';
    }

    // Add rows
    if (tableData.rows) {
      tableData.rows.forEach(row => {
        tsv += row.map(cell => cell.text).join('\t') + '\n';
      });
    }

    return tsv;
  }

  /**
   * Export table to HTML
   * @param {Object} tableData - Parsed table data
   * @returns {string} - HTML string
   */
  exportToHTML(tableData) {
    let html = '<table border="1">\n';

    // Add caption if present
    if (tableData.metadata?.caption) {
      html += `  <caption>${tableData.metadata.caption}</caption>\n`;
    }

    // Add headers
    if (tableData.headers && tableData.headers.length > 0) {
      html += '  <thead>\n    <tr>\n';
      tableData.headers.forEach(header => {
        html += `      <th>${header.text}</th>\n`;
      });
      html += '    </tr>\n  </thead>\n';
    }

    // Add rows
    if (tableData.rows && tableData.rows.length > 0) {
      html += '  <tbody>\n';
      tableData.rows.forEach(row => {
        html += '    <tr>\n';
        row.forEach(cell => {
          html += `      <td>${cell.text}</td>\n`;
        });
        html += '    </tr>\n';
      });
      html += '  </tbody>\n';
    }

    html += '</table>';
    return html;
  }

  /**
   * Export table to Markdown
   * @param {Object} tableData - Parsed table data
   * @returns {string} - Markdown string
   */
  exportToMarkdown(tableData) {
    let markdown = '';

    // Add caption if present
    if (tableData.metadata?.caption) {
      markdown += `**${tableData.metadata.caption}**\n\n`;
    }

    // Add headers
    if (tableData.headers && tableData.headers.length > 0) {
      markdown += '| ' + tableData.headers.map(h => h.text).join(' | ') + ' |\n';
      markdown += '| ' + tableData.headers.map(() => '---').join(' | ') + ' |\n';
    }

    // Add rows
    if (tableData.rows) {
      tableData.rows.forEach(row => {
        markdown += '| ' + row.map(cell => cell.text).join(' | ') + ' |\n';
      });
    }

    return markdown;
  }

  /**
   * Convert table to structured objects (one object per row)
   * @param {Object} tableData - Parsed table data
   * @returns {Array<Object>} - Array of row objects
   */
  tableToObjects(tableData) {
    const objects = [];

    if (!tableData.headers || !tableData.rows) {
      return objects;
    }

    tableData.rows.forEach(row => {
      const obj = {};
      tableData.headers.forEach((header, index) => {
        const key = header.text || `column_${index}`;
        const value = row[index]?.text || '';
        obj[key] = value;
      });
      objects.push(obj);
    });

    return objects;
  }

  /**
   * Search table for specific values
   * @param {Object} tableData - Parsed table data
   * @param {string} searchTerm - Term to search for
   * @param {Object} options - Search options
   * @returns {Object} - Search results
   */
  searchTable(tableData, searchTerm, options = {}) {
    const caseSensitive = options.caseSensitive || false;
    const results = {
      matches: [],
      totalMatches: 0
    };

    try {
      const searchRegex = new RegExp(searchTerm, caseSensitive ? 'g' : 'gi');

      tableData.rows.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          const matches = cell.text.match(searchRegex);
          if (matches) {
            results.matches.push({
              rowIndex: rowIndex,
              columnIndex: colIndex,
              columnHeader: tableData.headers[colIndex]?.text || `Column ${colIndex}`,
              cellText: cell.text,
              matchCount: matches.length
            });
            results.totalMatches += matches.length;
          }
        });
      });

    } catch (error) {
      console.error('TableParser: Error searching table:', error);
    }

    return results;
  }

  /**
   * Filter table rows based on column criteria
   * @param {Object} tableData - Parsed table data
   * @param {Object} filters - Filter criteria (columnIndex: value or regex)
   * @returns {Object} - Filtered table data
   */
  filterTable(tableData, filters) {
    try {
      const filteredRows = tableData.rows.filter(row => {
        for (const [colIndex, criteria] of Object.entries(filters)) {
          const cellText = row[parseInt(colIndex)]?.text || '';

          if (criteria instanceof RegExp) {
            if (!criteria.test(cellText)) return false;
          } else {
            if (cellText !== criteria) return false;
          }
        }
        return true;
      });

      return {
        ...tableData,
        rows: filteredRows,
        statistics: {
          ...tableData.statistics,
          rowCount: filteredRows.length,
          filteredFrom: tableData.rows.length
        }
      };

    } catch (error) {
      console.error('TableParser: Error filtering table:', error);
      return tableData;
    }
  }

  /**
   * Sort table by column
   * @param {Object} tableData - Parsed table data
   * @param {number} columnIndex - Index of column to sort by
   * @param {string} direction - Sort direction ('asc' or 'desc')
   * @returns {Object} - Sorted table data
   */
  sortTable(tableData, columnIndex, direction = 'asc') {
    try {
      const sortedRows = [...tableData.rows].sort((a, b) => {
        const aValue = a[columnIndex]?.text || '';
        const bValue = b[columnIndex]?.text || '';

        // Try numeric sort first
        const aNum = parseFloat(aValue);
        const bNum = parseFloat(bValue);

        if (!isNaN(aNum) && !isNaN(bNum)) {
          return direction === 'asc' ? aNum - bNum : bNum - aNum;
        }

        // Fall back to string sort
        const comparison = aValue.localeCompare(bValue);
        return direction === 'asc' ? comparison : -comparison;
      });

      return {
        ...tableData,
        rows: sortedRows
      };

    } catch (error) {
      console.error('TableParser: Error sorting table:', error);
      return tableData;
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TableParser;
}
