/**
 * Basset Hound Browser Automation - Visualization Components
 * Phase 19: Analytics & Intelligence
 *
 * Lightweight visualization components for analytics dashboard.
 * Pure JavaScript implementation without heavy dependencies.
 *
 * Features:
 * - Timeline visualization
 * - Network graph (entity relationships)
 * - Heat maps (activity by time/location)
 * - Sankey diagrams (data flow)
 * - Statistical charts (bar, line, pie, scatter)
 * - Interactive and responsive
 * - SVG-based rendering
 *
 * Dependencies: None (pure vanilla JavaScript + SVG)
 */

// =============================================================================
// Constants & Configuration
// =============================================================================

const VIZ_CONFIG = {
  COLORS: {
    primary: '#3794ff',
    success: '#73c991',
    warning: '#f48771',
    error: '#f14c4c',
    info: '#75beff',
    neutral: '#6c6c6c',
    text: '#cccccc',
    grid: '#3c3c3c'
  },
  CHART_DEFAULTS: {
    width: 600,
    height: 400,
    margin: { top: 20, right: 20, bottom: 40, left: 50 },
    fontSize: 12,
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  ANIMATIONS: {
    duration: 300,
    easing: 'ease-in-out'
  }
};

// =============================================================================
// Base Chart Class
// =============================================================================

class BaseChart {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    this.options = {
      ...VIZ_CONFIG.CHART_DEFAULTS,
      ...options
    };

    this.svg = null;
    this.chart = null;
    this.tooltip = null;
  }

  _createSVG() {
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', this.options.width);
    this.svg.setAttribute('height', this.options.height);
    this.svg.style.fontFamily = this.options.fontFamily;
    this.svg.style.fontSize = `${this.options.fontSize}px`;

    this.container.innerHTML = '';
    this.container.appendChild(this.svg);

    return this.svg;
  }

  _createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'chart-tooltip';
    this.tooltip.style.cssText = `
      position: absolute;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 1000;
    `;
    document.body.appendChild(this.tooltip);
  }

  _showTooltip(content, x, y) {
    if (!this.tooltip) this._createTooltip();

    this.tooltip.innerHTML = content;
    this.tooltip.style.left = `${x + 10}px`;
    this.tooltip.style.top = `${y - 10}px`;
    this.tooltip.style.opacity = '1';
  }

  _hideTooltip() {
    if (this.tooltip) {
      this.tooltip.style.opacity = '0';
    }
  }

  clear() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    if (this.tooltip && this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip);
      this.tooltip = null;
    }
  }
}

// =============================================================================
// Line Chart
// =============================================================================

class LineChart extends BaseChart {
  render(data) {
    const { labels, datasets } = data;
    const { width, height, margin } = this.options;

    this._createSVG();

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Create chart group
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${margin.left},${margin.top})`);
    this.svg.appendChild(g);

    // Calculate scales
    const maxValue = Math.max(...datasets.flatMap(d => d.data));
    const scaleX = chartWidth / (labels.length - 1);
    const scaleY = chartHeight / maxValue;

    // Draw grid
    this._drawGrid(g, chartWidth, chartHeight, maxValue);

    // Draw axes
    this._drawAxes(g, chartWidth, chartHeight, labels);

    // Draw lines
    for (const dataset of datasets) {
      this._drawLine(g, dataset, scaleX, scaleY, chartHeight);
    }

    // Draw legend
    this._drawLegend(g, datasets, chartWidth);
  }

  _drawGrid(g, width, height, maxValue) {
    const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gridGroup.setAttribute('class', 'grid');
    gridGroup.setAttribute('opacity', '0.1');

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = (height / 5) * i;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', y);
      line.setAttribute('x2', width);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', VIZ_CONFIG.COLORS.grid);
      line.setAttribute('stroke-width', '1');
      gridGroup.appendChild(line);
    }

    g.appendChild(gridGroup);
  }

  _drawAxes(g, width, height, labels) {
    // X-axis
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', '0');
    xAxis.setAttribute('y1', height);
    xAxis.setAttribute('x2', width);
    xAxis.setAttribute('y2', height);
    xAxis.setAttribute('stroke', VIZ_CONFIG.COLORS.grid);
    xAxis.setAttribute('stroke-width', '2');
    g.appendChild(xAxis);

    // Y-axis
    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', '0');
    yAxis.setAttribute('y1', '0');
    yAxis.setAttribute('x2', '0');
    yAxis.setAttribute('y2', height);
    yAxis.setAttribute('stroke', VIZ_CONFIG.COLORS.grid);
    yAxis.setAttribute('stroke-width', '2');
    g.appendChild(yAxis);

    // X-axis labels
    const step = Math.ceil(labels.length / 6);
    for (let i = 0; i < labels.length; i += step) {
      const x = (width / (labels.length - 1)) * i;
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x);
      text.setAttribute('y', height + 20);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', VIZ_CONFIG.COLORS.text);
      text.textContent = labels[i];
      g.appendChild(text);
    }
  }

  _drawLine(g, dataset, scaleX, scaleY, height) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let pathData = '';

    for (let i = 0; i < dataset.data.length; i++) {
      const x = i * scaleX;
      const y = height - (dataset.data[i] * scaleY);

      if (i === 0) {
        pathData += `M ${x} ${y}`;
      } else {
        pathData += ` L ${x} ${y}`;
      }
    }

    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', dataset.color || VIZ_CONFIG.COLORS.primary);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');

    g.appendChild(path);

    // Draw points
    for (let i = 0; i < dataset.data.length; i++) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', i * scaleX);
      circle.setAttribute('cy', height - (dataset.data[i] * scaleY));
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', dataset.color || VIZ_CONFIG.COLORS.primary);
      circle.setAttribute('stroke', 'white');
      circle.setAttribute('stroke-width', '2');

      // Tooltip
      circle.addEventListener('mouseenter', (e) => {
        this._showTooltip(
          `<strong>${dataset.label}</strong><br/>Value: ${dataset.data[i]}`,
          e.pageX,
          e.pageY
        );
      });
      circle.addEventListener('mouseleave', () => this._hideTooltip());

      g.appendChild(circle);
    }
  }

  _drawLegend(g, datasets, width) {
    const legendGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    legendGroup.setAttribute('transform', `translate(${width - 100}, -10)`);

    let y = 0;
    for (const dataset of datasets) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '0');
      rect.setAttribute('y', y);
      rect.setAttribute('width', '15');
      rect.setAttribute('height', '15');
      rect.setAttribute('fill', dataset.color || VIZ_CONFIG.COLORS.primary);
      legendGroup.appendChild(rect);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', '20');
      text.setAttribute('y', y + 12);
      text.setAttribute('fill', VIZ_CONFIG.COLORS.text);
      text.setAttribute('font-size', '11');
      text.textContent = dataset.label;
      legendGroup.appendChild(text);

      y += 20;
    }

    g.appendChild(legendGroup);
  }
}

// =============================================================================
// Bar Chart
// =============================================================================

class BarChart extends BaseChart {
  render(data) {
    const { labels, datasets } = data;
    const { width, height, margin } = this.options;

    this._createSVG();

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${margin.left},${margin.top})`);
    this.svg.appendChild(g);

    const maxValue = Math.max(...datasets[0].data);
    const barWidth = chartWidth / labels.length - 10;
    const scaleY = chartHeight / maxValue;

    // Draw grid
    this._drawGrid(g, chartWidth, chartHeight);

    // Draw bars
    for (let i = 0; i < labels.length; i++) {
      const value = datasets[0].data[i];
      const x = (chartWidth / labels.length) * i + 5;
      const barHeight = value * scaleY;
      const y = chartHeight - barHeight;

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', barWidth);
      rect.setAttribute('height', barHeight);
      rect.setAttribute('fill', datasets[0].colors ? datasets[0].colors[i] : VIZ_CONFIG.COLORS.primary);
      rect.setAttribute('rx', '3');

      // Tooltip
      rect.addEventListener('mouseenter', (e) => {
        this._showTooltip(
          `<strong>${labels[i]}</strong><br/>Value: ${value}`,
          e.pageX,
          e.pageY
        );
      });
      rect.addEventListener('mouseleave', () => this._hideTooltip());

      g.appendChild(rect);

      // Label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x + barWidth / 2);
      text.setAttribute('y', chartHeight + 15);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', VIZ_CONFIG.COLORS.text);
      text.setAttribute('font-size', '10');
      text.textContent = labels[i];
      g.appendChild(text);
    }
  }

  _drawGrid(g, width, height) {
    for (let i = 0; i <= 5; i++) {
      const y = (height / 5) * i;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', y);
      line.setAttribute('x2', width);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', VIZ_CONFIG.COLORS.grid);
      line.setAttribute('stroke-width', '1');
      line.setAttribute('opacity', '0.1');
      g.appendChild(line);
    }
  }
}

// =============================================================================
// Pie Chart
// =============================================================================

class PieChart extends BaseChart {
  render(data) {
    const { labels, datasets } = data;
    const { width, height } = this.options;

    this._createSVG();

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 40;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svg.appendChild(g);

    const total = datasets[0].data.reduce((a, b) => a + b, 0);
    let currentAngle = -Math.PI / 2;

    for (let i = 0; i < labels.length; i++) {
      const value = datasets[0].data[i];
      const angle = (value / total) * 2 * Math.PI;

      const path = this._createArc(
        centerX,
        centerY,
        radius,
        currentAngle,
        currentAngle + angle
      );

      path.setAttribute('fill', datasets[0].colors[i]);
      path.setAttribute('stroke', 'white');
      path.setAttribute('stroke-width', '2');

      // Tooltip
      path.addEventListener('mouseenter', (e) => {
        const percent = ((value / total) * 100).toFixed(1);
        this._showTooltip(
          `<strong>${labels[i]}</strong><br/>Value: ${value} (${percent}%)`,
          e.pageX,
          e.pageY
        );
      });
      path.addEventListener('mouseleave', () => this._hideTooltip());

      g.appendChild(path);

      currentAngle += angle;
    }

    // Draw legend
    this._drawLegend(g, labels, datasets[0].colors, width);
  }

  _createArc(x, y, radius, startAngle, endAngle) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    const x1 = x + radius * Math.cos(startAngle);
    const y1 = y + radius * Math.sin(startAngle);
    const x2 = x + radius * Math.cos(endAngle);
    const y2 = y + radius * Math.sin(endAngle);

    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

    const pathData = [
      `M ${x} ${y}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ');

    path.setAttribute('d', pathData);

    return path;
  }

  _drawLegend(g, labels, colors, width) {
    const legendGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    legendGroup.setAttribute('transform', `translate(${width - 120}, 20)`);

    for (let i = 0; i < labels.length; i++) {
      const y = i * 20;

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '0');
      rect.setAttribute('y', y);
      rect.setAttribute('width', '15');
      rect.setAttribute('height', '15');
      rect.setAttribute('fill', colors[i]);
      legendGroup.appendChild(rect);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', '20');
      text.setAttribute('y', y + 12);
      text.setAttribute('fill', VIZ_CONFIG.COLORS.text);
      text.setAttribute('font-size', '11');
      text.textContent = labels[i];
      legendGroup.appendChild(text);
    }

    g.appendChild(legendGroup);
  }
}

// =============================================================================
// Timeline Visualization
// =============================================================================

class TimelineChart extends BaseChart {
  render(data) {
    const { width, height, margin } = this.options;

    this._createSVG();

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${margin.left},${margin.top})`);
    this.svg.appendChild(g);

    // Sort by timestamp
    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);

    if (sortedData.length === 0) return;

    const minTime = sortedData[0].timestamp;
    const maxTime = sortedData[sortedData.length - 1].timestamp;
    const timeRange = maxTime - minTime || 1;

    // Draw timeline
    const timelineY = chartHeight / 2;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '0');
    line.setAttribute('y1', timelineY);
    line.setAttribute('x2', chartWidth);
    line.setAttribute('y2', timelineY);
    line.setAttribute('stroke', VIZ_CONFIG.COLORS.grid);
    line.setAttribute('stroke-width', '2');
    g.appendChild(line);

    // Draw events
    for (let i = 0; i < sortedData.length; i++) {
      const event = sortedData[i];
      const x = ((event.timestamp - minTime) / timeRange) * chartWidth;
      const y = timelineY + (i % 2 === 0 ? -30 : 30);

      // Event line
      const eventLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      eventLine.setAttribute('x1', x);
      eventLine.setAttribute('y1', timelineY);
      eventLine.setAttribute('x2', x);
      eventLine.setAttribute('y2', y);
      eventLine.setAttribute('stroke', VIZ_CONFIG.COLORS.text);
      eventLine.setAttribute('stroke-width', '1');
      eventLine.setAttribute('stroke-dasharray', '2,2');
      g.appendChild(eventLine);

      // Event circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', timelineY);
      circle.setAttribute('r', '6');
      circle.setAttribute('fill', this._getEventColor(event));
      circle.setAttribute('stroke', 'white');
      circle.setAttribute('stroke-width', '2');

      circle.addEventListener('mouseenter', (e) => {
        this._showTooltip(
          `<strong>${event.type}</strong><br/>${new Date(event.timestamp).toLocaleString()}`,
          e.pageX,
          e.pageY
        );
      });
      circle.addEventListener('mouseleave', () => this._hideTooltip());

      g.appendChild(circle);

      // Event label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x);
      text.setAttribute('y', y);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', VIZ_CONFIG.COLORS.text);
      text.setAttribute('font-size', '10');
      text.textContent = event.type || 'Event';
      g.appendChild(text);
    }
  }

  _getEventColor(event) {
    if (event.status === 'success') return VIZ_CONFIG.COLORS.success;
    if (event.status === 'failed') return VIZ_CONFIG.COLORS.error;
    if (event.status === 'pending') return VIZ_CONFIG.COLORS.warning;
    return VIZ_CONFIG.COLORS.info;
  }
}

// =============================================================================
// Heatmap Visualization
// =============================================================================

class HeatmapChart extends BaseChart {
  render(data) {
    const { width, height, margin } = this.options;

    this._createSVG();

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${margin.left},${margin.top})`);
    this.svg.appendChild(g);

    const hours = 24;
    const days = 7;
    const cellWidth = chartWidth / hours;
    const cellHeight = chartHeight / days;

    const maxValue = Math.max(...data.map(d => d.value));

    for (const cell of data) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', cell.hour * cellWidth);
      rect.setAttribute('y', cell.day * cellHeight);
      rect.setAttribute('width', cellWidth - 1);
      rect.setAttribute('height', cellHeight - 1);

      const intensity = cell.value / maxValue;
      rect.setAttribute('fill', this._getHeatColor(intensity));

      rect.addEventListener('mouseenter', (e) => {
        this._showTooltip(
          `Hour: ${cell.hour}:00<br/>Day: ${cell.day}<br/>Value: ${cell.value}`,
          e.pageX,
          e.pageY
        );
      });
      rect.addEventListener('mouseleave', () => this._hideTooltip());

      g.appendChild(rect);
    }

    // Add labels
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 0; i < days; i++) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', '-5');
      text.setAttribute('y', i * cellHeight + cellHeight / 2 + 5);
      text.setAttribute('text-anchor', 'end');
      text.setAttribute('fill', VIZ_CONFIG.COLORS.text);
      text.setAttribute('font-size', '10');
      text.textContent = dayNames[i];
      g.appendChild(text);
    }
  }

  _getHeatColor(intensity) {
    const r = Math.floor(55 + intensity * 200);
    const g = Math.floor(148 - intensity * 100);
    const b = Math.floor(255 - intensity * 100);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

// =============================================================================
// Network Graph Visualization
// =============================================================================

class NetworkGraph extends BaseChart {
  render(data) {
    const { nodes, edges } = data;
    const { width, height } = this.options;

    this._createSVG();

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 60;

    // Simple circular layout
    const positions = this._calculateCircularLayout(nodes, centerX, centerY, radius);

    // Draw edges first (so they're behind nodes)
    for (const edge of edges) {
      const sourcePos = positions.get(edge.source);
      const targetPos = positions.get(edge.target);

      if (!sourcePos || !targetPos) continue;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', sourcePos.x);
      line.setAttribute('y1', sourcePos.y);
      line.setAttribute('x2', targetPos.x);
      line.setAttribute('y2', targetPos.y);
      line.setAttribute('stroke', VIZ_CONFIG.COLORS.grid);
      line.setAttribute('stroke-width', Math.min(edge.weight / 2, 3));
      line.setAttribute('opacity', '0.3');
      this.svg.appendChild(line);
    }

    // Draw nodes
    for (const node of nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', pos.x);
      circle.setAttribute('cy', pos.y);
      circle.setAttribute('r', Math.min(5 + node.weight, 20));
      circle.setAttribute('fill', this._getNodeColor(node.type));
      circle.setAttribute('stroke', 'white');
      circle.setAttribute('stroke-width', '2');

      circle.addEventListener('mouseenter', (e) => {
        this._showTooltip(
          `<strong>${node.value}</strong><br/>Type: ${node.type}<br/>Connections: ${node.degree}`,
          e.pageX,
          e.pageY
        );
      });
      circle.addEventListener('mouseleave', () => this._hideTooltip());

      this.svg.appendChild(circle);

      // Label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', pos.x);
      text.setAttribute('y', pos.y - 15);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', VIZ_CONFIG.COLORS.text);
      text.setAttribute('font-size', '9');
      text.textContent = node.value.substring(0, 15);
      this.svg.appendChild(text);
    }
  }

  _calculateCircularLayout(nodes, centerX, centerY, radius) {
    const positions = new Map();
    const angleStep = (2 * Math.PI) / nodes.length;

    nodes.forEach((node, index) => {
      const angle = angleStep * index;
      positions.set(node.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      });
    });

    return positions;
  }

  _getNodeColor(type) {
    const colors = {
      email: VIZ_CONFIG.COLORS.info,
      phone: VIZ_CONFIG.COLORS.success,
      crypto: VIZ_CONFIG.COLORS.warning,
      ip: VIZ_CONFIG.COLORS.neutral,
      domain: VIZ_CONFIG.COLORS.primary
    };
    return colors[type] || VIZ_CONFIG.COLORS.neutral;
  }
}

// =============================================================================
// Chart Factory
// =============================================================================

class ChartFactory {
  static create(type, containerId, options = {}) {
    switch (type) {
      case 'line':
        return new LineChart(containerId, options);
      case 'bar':
        return new BarChart(containerId, options);
      case 'pie':
      case 'doughnut':
        return new PieChart(containerId, options);
      case 'timeline':
        return new TimelineChart(containerId, options);
      case 'heatmap':
        return new HeatmapChart(containerId, options);
      case 'network':
        return new NetworkGraph(containerId, options);
      default:
        throw new Error(`Unknown chart type: ${type}`);
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ChartFactory,
    LineChart,
    BarChart,
    PieChart,
    TimelineChart,
    HeatmapChart,
    NetworkGraph,
    VIZ_CONFIG
  };
}
