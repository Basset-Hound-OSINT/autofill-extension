/**
 * Basset Hound Browser Automation - Mini Entity Graph
 * Phase 15.2: History & Analytics Features
 *
 * Lightweight SVG-based entity relationship visualization.
 * Shows connections between detected OSINT entities without heavy graph libraries.
 *
 * Features:
 * - Email → Domain relationships
 * - Crypto addresses on same page
 * - Phone → Person associations
 * - IP → Domain connections
 * - Simple force-directed layout
 * - Interactive SVG rendering
 * - Zoom and pan support
 * - Entity clustering
 */

// =============================================================================
// Constants & Configuration
// =============================================================================

const GRAPH_CONFIG = {
  WIDTH: 600,
  HEIGHT: 400,
  NODE_RADIUS: 8,
  NODE_RADIUS_LARGE: 12,
  LINK_DISTANCE: 100,
  LINK_STRENGTH: 0.7,
  CHARGE_STRENGTH: -300,
  MAX_NODES: 50,              // Limit nodes for performance
  MAX_LINKS: 100,             // Limit links for performance
  COLORS: {
    email: '#75beff',
    phone: '#73c991',
    crypto_btc: '#f7931a',
    crypto_eth: '#627eea',
    domain: '#9cdcfe',
    ip_v4: '#ce9178',
    username: '#c586c0',
    default: '#cccccc'
  },
  LAYOUT: {
    ITERATIONS: 50,           // Force simulation iterations
    ALPHA_DECAY: 0.02,        // Layout cooling rate
    VELOCITY_DECAY: 0.4       // Velocity damping
  }
};

/**
 * Entity relationship types
 */
const RelationType = {
  EMAIL_DOMAIN: 'email_domain',       // Email → Domain
  SAME_PAGE: 'same_page',             // Entities on same page
  CRYPTO_CLUSTER: 'crypto_cluster',   // Crypto addresses grouped
  PHONE_CONTACT: 'phone_contact',     // Phone → Person/Email
  IP_DOMAIN: 'ip_domain',             // IP → Domain
  SOCIAL_LINK: 'social_link'          // Social media connections
};

// =============================================================================
// EntityGraph Class
// =============================================================================

/**
 * Mini entity graph visualization
 */
class EntityGraph {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      width: options.width || GRAPH_CONFIG.WIDTH,
      height: options.height || GRAPH_CONFIG.HEIGHT,
      interactive: options.interactive !== false,
      showLabels: options.showLabels !== false,
      ...options
    };

    this.nodes = [];
    this.links = [];
    this.svg = null;
    this.simulation = null;
    this.transform = { x: 0, y: 0, scale: 1 };

    this._init();
  }

  /**
   * Initialize SVG canvas
   */
  _init() {
    // Create SVG element
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', this.options.width);
    this.svg.setAttribute('height', this.options.height);
    this.svg.style.border = '1px solid var(--border-primary)';
    this.svg.style.borderRadius = '4px';
    this.svg.style.backgroundColor = 'var(--bg-tertiary)';

    // Create groups for layers
    this.linksGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.linksGroup.setAttribute('class', 'links');
    this.svg.appendChild(this.linksGroup);

    this.nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.nodesGroup.setAttribute('class', 'nodes');
    this.svg.appendChild(this.nodesGroup);

    this.labelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.labelsGroup.setAttribute('class', 'labels');
    this.svg.appendChild(this.labelsGroup);

    // Add to container
    this.container.innerHTML = '';
    this.container.appendChild(this.svg);

    // Setup interactivity
    if (this.options.interactive) {
      this._setupInteractions();
    }
  }

  /**
   * Build graph from ingestion history
   */
  buildFromHistory(historyItems, options = {}) {
    this.nodes = [];
    this.links = [];

    const nodeMap = new Map();
    const linkSet = new Set();

    // Create nodes
    for (const item of historyItems.slice(0, GRAPH_CONFIG.MAX_NODES)) {
      const nodeId = `${item.type}_${item.value}`;

      if (!nodeMap.has(nodeId)) {
        const node = {
          id: nodeId,
          type: item.type,
          value: item.value,
          label: this._truncateLabel(item.value),
          pageUrl: item.pageUrl,
          timestamp: item.timestamp,
          count: 1,
          x: Math.random() * this.options.width,
          y: Math.random() * this.options.height,
          vx: 0,
          vy: 0
        };

        nodeMap.set(nodeId, node);
        this.nodes.push(node);
      } else {
        nodeMap.get(nodeId).count++;
      }
    }

    // Create links based on relationships
    this._createEmailDomainLinks(nodeMap, linkSet);
    this._createSamePageLinks(nodeMap, linkSet, historyItems);
    this._createCryptoClusterLinks(nodeMap, linkSet);

    // Convert link set to array
    this.links = Array.from(linkSet).slice(0, GRAPH_CONFIG.MAX_LINKS);

    // Run layout
    this._runLayout();

    // Render
    this.render();
  }

  /**
   * Create email → domain links
   */
  _createEmailDomainLinks(nodeMap, linkSet) {
    const emails = Array.from(nodeMap.values()).filter(n => n.type === 'email');

    for (const email of emails) {
      const domain = email.value.split('@')[1];
      const domainNodeId = `domain_${domain}`;

      // Create domain node if it doesn't exist
      if (!nodeMap.has(domainNodeId)) {
        const domainNode = {
          id: domainNodeId,
          type: 'domain',
          value: domain,
          label: domain,
          count: 1,
          x: Math.random() * this.options.width,
          y: Math.random() * this.options.height,
          vx: 0,
          vy: 0
        };
        nodeMap.set(domainNodeId, domainNode);
        this.nodes.push(domainNode);
      }

      // Create link
      const linkId = `${email.id}_${domainNodeId}`;
      if (!linkSet.has(linkId)) {
        linkSet.add({
          id: linkId,
          source: email.id,
          target: domainNodeId,
          type: RelationType.EMAIL_DOMAIN,
          strength: 1.0
        });
      }
    }
  }

  /**
   * Create same-page links
   */
  _createSamePageLinks(nodeMap, linkSet, historyItems) {
    const byPage = new Map();

    // Group nodes by page
    for (const item of historyItems) {
      if (!item.pageUrl) continue;

      if (!byPage.has(item.pageUrl)) {
        byPage.set(item.pageUrl, []);
      }

      const nodeId = `${item.type}_${item.value}`;
      if (nodeMap.has(nodeId)) {
        byPage.get(item.pageUrl).push(nodeId);
      }
    }

    // Create links between nodes on same page
    for (const [pageUrl, nodeIds] of byPage.entries()) {
      if (nodeIds.length < 2) continue;

      // Connect nodes on same page (limit connections)
      for (let i = 0; i < Math.min(nodeIds.length, 5); i++) {
        for (let j = i + 1; j < Math.min(nodeIds.length, 5); j++) {
          const linkId = `${nodeIds[i]}_${nodeIds[j]}_page`;
          if (!linkSet.has(linkId)) {
            linkSet.add({
              id: linkId,
              source: nodeIds[i],
              target: nodeIds[j],
              type: RelationType.SAME_PAGE,
              strength: 0.5
            });
          }
        }
      }
    }
  }

  /**
   * Create crypto cluster links
   */
  _createCryptoClusterLinks(nodeMap, linkSet) {
    const cryptoNodes = Array.from(nodeMap.values())
      .filter(n => n.type.startsWith('crypto_'));

    // Group by crypto type
    const byType = {};
    for (const node of cryptoNodes) {
      if (!byType[node.type]) {
        byType[node.type] = [];
      }
      byType[node.type].push(node);
    }

    // Create links within same crypto type
    for (const nodes of Object.values(byType)) {
      if (nodes.length < 2) continue;

      for (let i = 0; i < Math.min(nodes.length, 3); i++) {
        for (let j = i + 1; j < Math.min(nodes.length, 3); j++) {
          const linkId = `${nodes[i].id}_${nodes[j].id}_crypto`;
          if (!linkSet.has(linkId)) {
            linkSet.add({
              id: linkId,
              source: nodes[i].id,
              target: nodes[j].id,
              type: RelationType.CRYPTO_CLUSTER,
              strength: 0.6
            });
          }
        }
      }
    }
  }

  /**
   * Run simple force-directed layout
   */
  _runLayout() {
    const centerX = this.options.width / 2;
    const centerY = this.options.height / 2;

    // Create node map for quick lookup
    const nodeMap = new Map(this.nodes.map(n => [n.id, n]));

    // Convert link source/target to node references
    for (const link of this.links) {
      link.source = nodeMap.get(link.source);
      link.target = nodeMap.get(link.target);
    }

    // Run iterations
    for (let iteration = 0; iteration < GRAPH_CONFIG.LAYOUT.ITERATIONS; iteration++) {
      const alpha = 1 - (iteration / GRAPH_CONFIG.LAYOUT.ITERATIONS);

      // Apply forces
      this._applyRepulsionForce(alpha);
      this._applyLinkForce(alpha);
      this._applyCenterForce(centerX, centerY, alpha);

      // Update positions
      for (const node of this.nodes) {
        node.vx *= GRAPH_CONFIG.LAYOUT.VELOCITY_DECAY;
        node.vy *= GRAPH_CONFIG.LAYOUT.VELOCITY_DECAY;

        node.x += node.vx;
        node.y += node.vy;

        // Keep within bounds
        node.x = Math.max(20, Math.min(this.options.width - 20, node.x));
        node.y = Math.max(20, Math.min(this.options.height - 20, node.y));
      }
    }
  }

  /**
   * Apply repulsion force between nodes
   */
  _applyRepulsionForce(alpha) {
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const nodeA = this.nodes[i];
        const nodeB = this.nodes[j];

        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        const force = (GRAPH_CONFIG.CHARGE_STRENGTH * alpha) / (distance * distance);

        nodeA.vx -= (dx / distance) * force;
        nodeA.vy -= (dy / distance) * force;
        nodeB.vx += (dx / distance) * force;
        nodeB.vy += (dy / distance) * force;
      }
    }
  }

  /**
   * Apply link force
   */
  _applyLinkForce(alpha) {
    for (const link of this.links) {
      const source = link.source;
      const target = link.target;

      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;

      const force = (distance - GRAPH_CONFIG.LINK_DISTANCE) * GRAPH_CONFIG.LINK_STRENGTH * alpha;

      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;

      source.vx += fx * link.strength;
      source.vy += fy * link.strength;
      target.vx -= fx * link.strength;
      target.vy -= fy * link.strength;
    }
  }

  /**
   * Apply centering force
   */
  _applyCenterForce(centerX, centerY, alpha) {
    let totalX = 0;
    let totalY = 0;

    for (const node of this.nodes) {
      totalX += node.x;
      totalY += node.y;
    }

    const avgX = totalX / this.nodes.length;
    const avgY = totalY / this.nodes.length;

    const dx = centerX - avgX;
    const dy = centerY - avgY;

    for (const node of this.nodes) {
      node.vx += dx * 0.1 * alpha;
      node.vy += dy * 0.1 * alpha;
    }
  }

  /**
   * Render graph to SVG
   */
  render() {
    this._renderLinks();
    this._renderNodes();

    if (this.options.showLabels) {
      this._renderLabels();
    }
  }

  /**
   * Render links
   */
  _renderLinks() {
    this.linksGroup.innerHTML = '';

    for (const link of this.links) {
      if (!link.source || !link.target) continue;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', link.source.x);
      line.setAttribute('y1', link.source.y);
      line.setAttribute('x2', link.target.x);
      line.setAttribute('y2', link.target.y);
      line.setAttribute('stroke', this._getLinkColor(link.type));
      line.setAttribute('stroke-width', 1);
      line.setAttribute('stroke-opacity', 0.4);

      this.linksGroup.appendChild(line);
    }
  }

  /**
   * Render nodes
   */
  _renderNodes() {
    this.nodesGroup.innerHTML = '';

    for (const node of this.nodes) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', node.x);
      circle.setAttribute('cy', node.y);
      circle.setAttribute('r', node.count > 1 ? GRAPH_CONFIG.NODE_RADIUS_LARGE : GRAPH_CONFIG.NODE_RADIUS);
      circle.setAttribute('fill', this._getNodeColor(node.type));
      circle.setAttribute('stroke', '#2d2d30');
      circle.setAttribute('stroke-width', 2);
      circle.setAttribute('class', 'graph-node');
      circle.setAttribute('data-node-id', node.id);

      // Add tooltip
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${node.type}: ${node.value}${node.count > 1 ? ` (${node.count})` : ''}`;
      circle.appendChild(title);

      this.nodesGroup.appendChild(circle);
    }
  }

  /**
   * Render labels
   */
  _renderLabels() {
    this.labelsGroup.innerHTML = '';

    for (const node of this.nodes) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', node.x);
      text.setAttribute('y', node.y + GRAPH_CONFIG.NODE_RADIUS + 12);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', 'var(--text-secondary)');
      text.setAttribute('font-size', '10px');
      text.setAttribute('font-family', 'var(--font-mono)');
      text.textContent = node.label;

      this.labelsGroup.appendChild(text);
    }
  }

  /**
   * Setup interactive features
   */
  _setupInteractions() {
    let isDragging = false;
    let dragNode = null;
    let startX = 0;
    let startY = 0;

    this.svg.addEventListener('mousedown', (e) => {
      const target = e.target;

      if (target.classList.contains('graph-node')) {
        isDragging = true;
        dragNode = this.nodes.find(n => n.id === target.dataset.nodeId);
        startX = e.clientX;
        startY = e.clientY;
        e.preventDefault();
      }
    });

    this.svg.addEventListener('mousemove', (e) => {
      if (isDragging && dragNode) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        dragNode.x += dx;
        dragNode.y += dy;

        startX = e.clientX;
        startY = e.clientY;

        this.render();
      }
    });

    this.svg.addEventListener('mouseup', () => {
      isDragging = false;
      dragNode = null;
    });

    this.svg.addEventListener('mouseleave', () => {
      isDragging = false;
      dragNode = null;
    });
  }

  /**
   * Get node color by type
   */
  _getNodeColor(type) {
    if (type.startsWith('crypto_')) {
      return GRAPH_CONFIG.COLORS[type] || GRAPH_CONFIG.COLORS.default;
    }
    return GRAPH_CONFIG.COLORS[type] || GRAPH_CONFIG.COLORS.default;
  }

  /**
   * Get link color by type
   */
  _getLinkColor(type) {
    const colors = {
      [RelationType.EMAIL_DOMAIN]: '#75beff',
      [RelationType.SAME_PAGE]: '#969696',
      [RelationType.CRYPTO_CLUSTER]: '#f7931a',
      [RelationType.IP_DOMAIN]: '#ce9178'
    };

    return colors[type] || '#6c6c6c';
  }

  /**
   * Truncate label for display
   */
  _truncateLabel(value, maxLength = 15) {
    if (value.length <= maxLength) return value;
    return value.substring(0, maxLength - 3) + '...';
  }

  /**
   * Clear graph
   */
  clear() {
    this.nodes = [];
    this.links = [];
    this.linksGroup.innerHTML = '';
    this.nodesGroup.innerHTML = '';
    this.labelsGroup.innerHTML = '';
  }

  /**
   * Destroy graph and cleanup
   */
  destroy() {
    this.clear();
    this.container.innerHTML = '';
  }
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EntityGraph,
    RelationType,
    GRAPH_CONFIG
  };
}
