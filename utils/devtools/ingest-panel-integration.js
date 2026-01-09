/**
 * Phase 15.2: Ingest History & Analytics Integration
 * This file contains the integration code for devtools-panel.js
 */

// Initialize history and analytics modules
let ingestHistory = null;
let detectionAnalytics = null;
let entityGraph = null;
let currentHistoryPage = 1;
let currentHistoryFilters = {};

/**
 * Initialize ingest history and analytics
 */
async function initIngestAnalytics() {
  try {
    // Initialize ingest history
    ingestHistory = new IngestHistory();
    await ingestHistory._init();

    // Initialize analytics
    detectionAnalytics = new DetectionAnalytics(ingestHistory);

    // Setup section tabs
    setupSectionTabs();

    // Setup history controls
    setupHistoryControls();

    // Setup analytics controls
    setupAnalyticsControls();

    // Setup entity graph controls
    setupEntityGraphControls();

    // Initial render
    refreshAnalyticsDashboard();
    refreshHistory();

    console.log('[DevTools] Ingest analytics initialized');
  } catch (error) {
    console.error('[DevTools] Failed to initialize ingest analytics:', error);
  }
}

/**
 * Setup section tabs (Statistics, History, Graph)
 */
function setupSectionTabs() {
  const tabs = document.querySelectorAll('.section-tab');
  const panels = document.querySelectorAll('.section-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const sectionName = tab.dataset.section;

      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update active panel
      panels.forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(`${sectionName}-panel`);
      if (panel) {
        panel.classList.add('active');

        // Refresh content when switching tabs
        if (sectionName === 'stats') {
          refreshAnalyticsDashboard();
        } else if (sectionName === 'history') {
          refreshHistory();
        } else if (sectionName === 'graph') {
          refreshEntityGraph();
        }
      }
    });
  });
}

/**
 * Setup history controls and filters
 */
function setupHistoryControls() {
  // Search input
  const searchInput = document.getElementById('historySearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      currentHistoryFilters.search = searchInput.value;
      currentHistoryPage = 1;
      refreshHistory();
    }, 300));
  }

  // Type filter
  const typeSelect = document.getElementById('historyTypeSelect');
  if (typeSelect) {
    typeSelect.addEventListener('change', () => {
      currentHistoryFilters.type = typeSelect.value || undefined;
      currentHistoryPage = 1;
      refreshHistory();
    });
  }

  // Status filter
  const statusSelect = document.getElementById('historyStatusSelect');
  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      currentHistoryFilters.status = statusSelect.value || undefined;
      currentHistoryPage = 1;
      refreshHistory();
    });
  }

  // Date filters
  const dateStart = document.getElementById('historyDateStart');
  const dateEnd = document.getElementById('historyDateEnd');

  if (dateStart) {
    dateStart.addEventListener('change', () => {
      currentHistoryFilters.startDate = dateStart.value || undefined;
      currentHistoryPage = 1;
      refreshHistory();
    });
  }

  if (dateEnd) {
    dateEnd.addEventListener('change', () => {
      currentHistoryFilters.endDate = dateEnd.value || undefined;
      currentHistoryPage = 1;
      refreshHistory();
    });
  }

  // Refresh button
  const refreshBtn = document.getElementById('historyRefreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshHistory);
  }

  // Export buttons
  const exportJSONBtn = document.getElementById('exportHistoryJSON');
  if (exportJSONBtn) {
    exportJSONBtn.addEventListener('click', exportHistoryJSON);
  }

  const exportCSVBtn = document.getElementById('exportHistoryCSV');
  if (exportCSVBtn) {
    exportCSVBtn.addEventListener('click', exportHistoryCSV);
  }

  // Clear button
  const clearBtn = document.getElementById('clearHistory');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearHistoryFunc);
  }

  // Pagination
  const prevBtn = document.getElementById('historyPrevPage');
  const nextBtn = document.getElementById('historyNextPage');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentHistoryPage > 1) {
        currentHistoryPage--;
        refreshHistory();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentHistoryPage++;
      refreshHistory();
    });
  }
}

/**
 * Setup analytics controls
 */
function setupAnalyticsControls() {
  const chartSelect = document.getElementById('chartSelect');
  if (chartSelect) {
    chartSelect.addEventListener('change', () => {
      renderAnalyticsChart(chartSelect.value);
    });
  }
}

/**
 * Setup entity graph controls
 */
function setupEntityGraphControls() {
  const refreshBtn = document.getElementById('refreshGraph');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshEntityGraph);
  }

  const filterSelect = document.getElementById('graphFilter');
  if (filterSelect) {
    filterSelect.addEventListener('change', refreshEntityGraph);
  }

  const showLabelsCheckbox = document.getElementById('graphShowLabels');
  if (showLabelsCheckbox) {
    showLabelsCheckbox.addEventListener('change', refreshEntityGraph);
  }
}

/**
 * Refresh analytics dashboard
 */
function refreshAnalyticsDashboard() {
  if (!detectionAnalytics) return;

  try {
    const summary = detectionAnalytics.getSummary();

    // Update stat cards
    updateElementText('statTotalIngested', summary.totalDetections);
    updateElementText('statSuccessRate', `${summary.successRate}%`);
    updateElementText('statVerifiedItems', summary.verifiedCount);
    updateElementText('statUniquePagesAnalytics', summary.uniquePages);

    // Render top lists
    renderTopTypes();
    renderTopPages();

    // Render default chart
    const chartSelect = document.getElementById('chartSelect');
    if (chartSelect) {
      renderAnalyticsChart(chartSelect.value);
    }
  } catch (error) {
    console.error('[DevTools] Failed to refresh analytics dashboard:', error);
  }
}

/**
 * Render analytics chart
 */
function renderAnalyticsChart(chartType) {
  const chartCanvas = document.getElementById('analyticsChart');
  if (!chartCanvas || !detectionAnalytics) return;

  try {
    let html = '';

    switch (chartType) {
      case 'type':
        const typeData = detectionAnalytics.getCountsByType();
        html = renderSimpleBarChart(typeData.topTypes.map(t => ({
          label: t.type,
          value: t.count
        })));
        break;

      case 'category':
        const categoryData = detectionAnalytics.getCountsByCategory();
        html = renderSimpleBarChart(categoryData.map(c => ({
          label: c.category,
          value: c.count
        })));
        break;

      case 'trend':
        const trendData = detectionAnalytics.getTrend('day', 7);
        html = `<div class="chart-text">
          <p>Total detections in last 7 days: ${trendData.summary.total}</p>
          <p>Average per day: ${trendData.summary.avgPerBucket}</p>
          <p>Peak: ${trendData.summary.peakValue} on ${trendData.summary.peakDate ? new Date(trendData.summary.peakDate).toLocaleDateString() : 'N/A'}</p>
        </div>`;
        break;

      case 'status':
        const statusData = detectionAnalytics.getStatusDistribution();
        html = renderSimpleBarChart(statusData.map(s => ({
          label: s.status,
          value: s.count
        })));
        break;

      default:
        html = '<div class="empty-state">Select a chart type</div>';
    }

    chartCanvas.innerHTML = html;
  } catch (error) {
    console.error('[DevTools] Failed to render chart:', error);
    chartCanvas.innerHTML = '<div class="empty-state text-error">Error rendering chart</div>';
  }
}

/**
 * Render simple bar chart (text-based)
 */
function renderSimpleBarChart(data) {
  if (!data || data.length === 0) {
    return '<div class="empty-state">No data to display</div>';
  }

  const maxValue = Math.max(...data.map(d => d.value));

  return `
    <div style="padding: 16px;">
      ${data.map(item => {
        const percentage = maxValue > 0 ? (item.value / maxValue * 100) : 0;
        return `
          <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px;">
              <span style="color: var(--text-primary);">${escapeHtml(item.label)}</span>
              <span style="color: var(--accent-info); font-weight: 600;">${item.value}</span>
            </div>
            <div style="background: var(--bg-tertiary); height: 8px; border-radius: 4px; overflow: hidden;">
              <div style="background: var(--accent-primary); height: 100%; width: ${percentage}%;"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Render top types list
 */
function renderTopTypes() {
  const container = document.getElementById('topTypes');
  if (!container || !detectionAnalytics) return;

  try {
    const data = detectionAnalytics.getCountsByType();

    if (data.topTypes.length === 0) {
      container.innerHTML = '<div class="empty-state">No data</div>';
      return;
    }

    container.innerHTML = data.topTypes.slice(0, 5).map(item => `
      <div class="list-item">
        <span class="list-item-label">${escapeHtml(item.type)}</span>
        <span class="list-item-count">${item.count}</span>
      </div>
    `).join('');
  } catch (error) {
    console.error('[DevTools] Failed to render top types:', error);
  }
}

/**
 * Render top pages list
 */
function renderTopPages() {
  const container = document.getElementById('topPages');
  if (!container || !detectionAnalytics) return;

  try {
    const data = detectionAnalytics.getTopPages(5);

    if (data.length === 0) {
      container.innerHTML = '<div class="empty-state">No data</div>';
      return;
    }

    container.innerHTML = data.map(item => `
      <div class="list-item">
        <span class="list-item-label" title="${escapeHtml(item.url)}">${escapeHtml(truncateUrl(item.url, 20))}</span>
        <span class="list-item-count">${item.count}</span>
      </div>
    `).join('');
  } catch (error) {
    console.error('[DevTools] Failed to render top pages:', error);
  }
}

/**
 * Refresh history table
 */
function refreshHistory() {
  if (!ingestHistory) return;

  try {
    const result = ingestHistory.getItems({
      ...currentHistoryFilters,
      page: currentHistoryPage,
      limit: 50
    });

    // Update info
    const infoElement = document.getElementById('historyInfo');
    if (infoElement) {
      infoElement.textContent = `${result.total} items`;
    }

    // Update pagination
    const pageInfoElement = document.getElementById('historyPageInfo');
    if (pageInfoElement) {
      pageInfoElement.textContent = `Page ${result.page} of ${result.pages}`;
    }

    const prevBtn = document.getElementById('historyPrevPage');
    const nextBtn = document.getElementById('historyNextPage');

    if (prevBtn) {
      prevBtn.disabled = result.page <= 1;
    }

    if (nextBtn) {
      nextBtn.disabled = result.page >= result.pages;
    }

    // Render table
    const tbody = document.getElementById('historyTableBody');
    if (tbody) {
      if (result.items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">No history items</div></td></tr>';
      } else {
        tbody.innerHTML = result.items.map(item => `
          <tr>
            <td>${formatTime(item.timestamp)}</td>
            <td><span class="type-badge">${escapeHtml(item.type)}</span></td>
            <td title="${escapeHtml(item.value)}">${escapeHtml(truncateValue(item.value, 30))}</td>
            <td><span class="status-badge-inline ${item.status}">${escapeHtml(item.status)}</span></td>
            <td title="${escapeHtml(item.pageUrl || '')}">${escapeHtml(truncateUrl(item.pageUrl || '--', 25))}</td>
            <td>${item.confidence ? item.confidence.toFixed(2) : '--'}</td>
          </tr>
        `).join('');
      }
    }
  } catch (error) {
    console.error('[DevTools] Failed to refresh history:', error);
  }
}

/**
 * Refresh entity graph
 */
function refreshEntityGraph() {
  const container = document.getElementById('entityGraphContainer');
  if (!container || !ingestHistory) return;

  try {
    const filterSelect = document.getElementById('graphFilter');
    const showLabels = document.getElementById('graphShowLabels');

    let items = ingestHistory.items;
    const filter = filterSelect ? filterSelect.value : 'all';

    // Apply filter
    if (filter === 'recent') {
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      items = items.filter(item => item.timestamp >= oneDayAgo);
    } else if (filter === 'email') {
      items = items.filter(item => item.type === 'email');
    } else if (filter === 'crypto') {
      items = items.filter(item => item.type.startsWith('crypto_'));
    }

    // Limit to 50 most recent items for performance
    items = items.slice(0, 50);

    // Create or update graph
    if (!entityGraph) {
      entityGraph = new EntityGraph(container, {
        width: container.clientWidth || 600,
        height: 300,
        showLabels: showLabels ? showLabels.checked : true
      });
    }

    if (items.length > 0) {
      entityGraph.buildFromHistory(items);
    } else {
      container.innerHTML = '<div class="empty-state">No entities to display</div>';
    }
  } catch (error) {
    console.error('[DevTools] Failed to refresh entity graph:', error);
    container.innerHTML = '<div class="empty-state text-error">Error rendering graph</div>';
  }
}

/**
 * Export history to JSON
 */
function exportHistoryJSON() {
  if (!ingestHistory) return;

  try {
    const data = ingestHistory.exportJSON(currentHistoryFilters);
    downloadJSON(data, `ingest-history-${Date.now()}.json`);
    if (typeof addAuditLog !== 'undefined') {
      addAuditLog('info', 'Ingest history exported to JSON');
    }
  } catch (error) {
    console.error('[DevTools] Failed to export history JSON:', error);
  }
}

/**
 * Export history to CSV
 */
function exportHistoryCSV() {
  if (!ingestHistory) return;

  try {
    const csv = ingestHistory.exportCSV(currentHistoryFilters);
    downloadCSV(csv, `ingest-history-${Date.now()}.csv`);
    if (typeof addAuditLog !== 'undefined') {
      addAuditLog('info', 'Ingest history exported to CSV');
    }
  } catch (error) {
    console.error('[DevTools] Failed to export history CSV:', error);
  }
}

/**
 * Clear all history
 */
async function clearHistoryFunc() {
  if (!ingestHistory) return;

  if (!confirm('Are you sure you want to clear all ingestion history? This cannot be undone.')) {
    return;
  }

  try {
    const count = await ingestHistory.clearAll();
    if (typeof addAuditLog !== 'undefined') {
      addAuditLog('info', `Cleared ${count} history items`);
    }
    refreshHistory();
    refreshAnalyticsDashboard();
  } catch (error) {
    console.error('[DevTools] Failed to clear history:', error);
  }
}

/**
 * Download CSV file
 */
function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Truncate URL for display
 */
function truncateUrl(url, maxLength) {
  if (!url || url.length <= maxLength) return url;
  return url.substring(0, maxLength - 3) + '...';
}

/**
 * Truncate value for display
 */
function truncateValue(value, maxLength) {
  if (!value || value.length <= maxLength) return value;
  return value.substring(0, maxLength - 3) + '...';
}

/**
 * Update element text content
 */
function updateElementText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

/**
 * Debounce function for input handlers
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// escapeHtml is defined in devtools-panel.js

// Initialize ingest analytics when panel loads
if (typeof IngestHistory !== 'undefined') {
  setTimeout(initIngestAnalytics, 1000); // Wait for other scripts to load
}
