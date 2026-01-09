/**
 * Basset Hound - Workflow Manager
 *
 * CRUD operations for workflow definitions.
 * Manages workflow storage, retrieval, and validation.
 *
 * @version 1.0.0
 * @date 2026-01-09
 */

/**
 * Workflow Manager
 *
 * Handles creation, reading, updating, and deletion of workflows.
 */
class WorkflowManager {
  constructor() {
    this.STORAGE_KEY = 'workflows';
    this.METADATA_KEY = 'workflow_metadata';
    this.workflowCache = new Map();
  }

  /**
   * Create a new workflow
   *
   * @param {Object} workflow - Workflow definition
   * @returns {Promise<Object>} Created workflow
   */
  async createWorkflow(workflow) {
    // Validate workflow
    this.validateWorkflow(workflow);

    // Generate ID if not provided
    if (!workflow.id) {
      workflow.id = this.generateWorkflowId();
    }

    // Add metadata
    workflow.createdAt = Date.now();
    workflow.updatedAt = Date.now();
    workflow.version = workflow.version || '1.0.0';

    // Check if workflow with this ID already exists
    const existing = await this.getWorkflow(workflow.id);
    if (existing) {
      throw new Error(`Workflow with ID ${workflow.id} already exists`);
    }

    // Save to storage
    await this.saveWorkflow(workflow);

    // Update cache
    this.workflowCache.set(workflow.id, workflow);

    // Update metadata
    await this.updateMetadata('create', workflow);

    return workflow;
  }

  /**
   * Get a workflow by ID
   *
   * @param {string} workflowId - Workflow ID
   * @returns {Promise<Object|null>} Workflow or null
   */
  async getWorkflow(workflowId) {
    // Check cache first
    if (this.workflowCache.has(workflowId)) {
      return this.workflowCache.get(workflowId);
    }

    // Load from storage
    const workflows = await this.loadAllWorkflows();
    const workflow = workflows.find((w) => w.id === workflowId);

    if (workflow) {
      this.workflowCache.set(workflowId, workflow);
    }

    return workflow || null;
  }

  /**
   * Update an existing workflow
   *
   * @param {string} workflowId - Workflow ID
   * @param {Object} updates - Workflow updates
   * @returns {Promise<Object>} Updated workflow
   */
  async updateWorkflow(workflowId, updates) {
    // Get existing workflow
    const existing = await this.getWorkflow(workflowId);

    if (!existing) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Merge updates
    const updated = {
      ...existing,
      ...updates,
      id: workflowId, // Prevent ID change
      createdAt: existing.createdAt, // Preserve creation time
      updatedAt: Date.now()
    };

    // Validate updated workflow
    this.validateWorkflow(updated);

    // Save to storage
    await this.saveWorkflow(updated);

    // Update cache
    this.workflowCache.set(workflowId, updated);

    // Update metadata
    await this.updateMetadata('update', updated);

    return updated;
  }

  /**
   * Delete a workflow
   *
   * @param {string} workflowId - Workflow ID
   * @returns {Promise<boolean>} Success
   */
  async deleteWorkflow(workflowId) {
    // Check if workflow exists
    const existing = await this.getWorkflow(workflowId);

    if (!existing) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Load all workflows
    const workflows = await this.loadAllWorkflows();

    // Remove the workflow
    const filtered = workflows.filter((w) => w.id !== workflowId);

    // Save back to storage
    await chrome.storage.local.set({ [this.STORAGE_KEY]: filtered });

    // Remove from cache
    this.workflowCache.delete(workflowId);

    // Update metadata
    await this.updateMetadata('delete', existing);

    return true;
  }

  /**
   * List all workflows
   *
   * @param {Object} filter - Filter options
   * @returns {Promise<Array>} Array of workflows
   */
  async listWorkflows(filter = {}) {
    const workflows = await this.loadAllWorkflows();

    let filtered = workflows;

    // Apply filters
    if (filter.category) {
      filtered = filtered.filter((w) => w.category === filter.category);
    }

    if (filter.tags) {
      const tags = Array.isArray(filter.tags) ? filter.tags : [filter.tags];
      filtered = filtered.filter((w) =>
        tags.some((tag) => w.tags?.includes(tag))
      );
    }

    if (filter.author) {
      filtered = filtered.filter((w) => w.author === filter.author);
    }

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter(
        (w) =>
          w.name.toLowerCase().includes(searchLower) ||
          w.description?.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    const sortBy = filter.sortBy || 'updatedAt';
    const sortOrder = filter.sortOrder || 'desc';

    filtered.sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    // Limit
    if (filter.limit) {
      filtered = filtered.slice(0, filter.limit);
    }

    return filtered;
  }

  /**
   * Get workflow summary (without full steps)
   *
   * @param {string} workflowId - Workflow ID
   * @returns {Promise<Object|null>} Workflow summary
   */
  async getWorkflowSummary(workflowId) {
    const workflow = await this.getWorkflow(workflowId);

    if (!workflow) {
      return null;
    }

    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      version: workflow.version,
      author: workflow.author,
      category: workflow.category,
      tags: workflow.tags,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      stepCount: workflow.steps?.length || 0
    };
  }

  /**
   * Clone a workflow
   *
   * @param {string} workflowId - Workflow ID to clone
   * @param {Object} options - Clone options
   * @returns {Promise<Object>} Cloned workflow
   */
  async cloneWorkflow(workflowId, options = {}) {
    const source = await this.getWorkflow(workflowId);

    if (!source) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Create clone
    const clone = {
      ...source,
      id: this.generateWorkflowId(),
      name: options.name || `${source.name} (Copy)`,
      description: options.description || source.description,
      author: options.author || source.author,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Save clone
    await this.saveWorkflow(clone);

    // Update cache
    this.workflowCache.set(clone.id, clone);

    // Update metadata
    await this.updateMetadata('create', clone);

    return clone;
  }

  /**
   * Import a workflow from JSON
   *
   * @param {string|Object} data - Workflow JSON or object
   * @returns {Promise<Object>} Imported workflow
   */
  async importWorkflow(data) {
    // Parse if string
    const workflow = typeof data === 'string' ? JSON.parse(data) : data;

    // Generate new ID to avoid conflicts
    const originalId = workflow.id;
    workflow.id = this.generateWorkflowId();

    // Validate
    this.validateWorkflow(workflow);

    // Add metadata
    workflow.createdAt = Date.now();
    workflow.updatedAt = Date.now();
    workflow.importedFrom = originalId;

    // Save
    await this.saveWorkflow(workflow);

    // Update cache
    this.workflowCache.set(workflow.id, workflow);

    // Update metadata
    await this.updateMetadata('import', workflow);

    return workflow;
  }

  /**
   * Export a workflow to JSON
   *
   * @param {string} workflowId - Workflow ID
   * @returns {Promise<string>} Workflow JSON
   */
  async exportWorkflow(workflowId) {
    const workflow = await this.getWorkflow(workflowId);

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Remove internal metadata
    const exported = {
      ...workflow
    };

    delete exported.createdAt;
    delete exported.updatedAt;
    delete exported.importedFrom;

    return JSON.stringify(exported, null, 2);
  }

  /**
   * Search workflows
   *
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Matching workflows
   */
  async searchWorkflows(query, options = {}) {
    const workflows = await this.loadAllWorkflows();

    const queryLower = query.toLowerCase();

    const results = workflows.filter((workflow) => {
      // Search in name, description, tags
      const matchName = workflow.name.toLowerCase().includes(queryLower);
      const matchDesc = workflow.description?.toLowerCase().includes(queryLower);
      const matchTags = workflow.tags?.some((tag) =>
        tag.toLowerCase().includes(queryLower)
      );

      return matchName || matchDesc || matchTags;
    });

    // Rank by relevance
    results.sort((a, b) => {
      const aScore = this.calculateRelevanceScore(a, queryLower);
      const bScore = this.calculateRelevanceScore(b, queryLower);
      return bScore - aScore;
    });

    if (options.limit) {
      return results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Get workflow categories
   *
   * @returns {Promise<Array>} Array of categories with counts
   */
  async getCategories() {
    const workflows = await this.loadAllWorkflows();

    const categories = {};

    for (const workflow of workflows) {
      const category = workflow.category || 'general';
      categories[category] = (categories[category] || 0) + 1;
    }

    return Object.entries(categories).map(([name, count]) => ({
      name,
      count
    }));
  }

  /**
   * Get workflow tags
   *
   * @returns {Promise<Array>} Array of tags with counts
   */
  async getTags() {
    const workflows = await this.loadAllWorkflows();

    const tags = {};

    for (const workflow of workflows) {
      if (workflow.tags) {
        for (const tag of workflow.tags) {
          tags[tag] = (tags[tag] || 0) + 1;
        }
      }
    }

    return Object.entries(tags)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get workflow statistics
   *
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics() {
    const workflows = await this.loadAllWorkflows();
    const metadata = await this.getMetadata();

    return {
      totalWorkflows: workflows.length,
      categories: await this.getCategories(),
      tags: await this.getTags(),
      averageStepCount:
        workflows.reduce((sum, w) => sum + (w.steps?.length || 0), 0) /
        workflows.length || 0,
      recentlyCreated: workflows
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 5)
        .map((w) => ({ id: w.id, name: w.name, createdAt: w.createdAt })),
      recentlyUpdated: workflows
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 5)
        .map((w) => ({ id: w.id, name: w.name, updatedAt: w.updatedAt })),
      mostUsed: (metadata.usageCount || []).slice(0, 5)
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Load all workflows from storage
   *
   * @returns {Promise<Array>} Array of workflows
   */
  async loadAllWorkflows() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      return result[this.STORAGE_KEY] || [];
    } catch (error) {
      console.error('[WorkflowManager] Failed to load workflows:', error);
      return [];
    }
  }

  /**
   * Save a workflow to storage
   *
   * @param {Object} workflow - Workflow to save
   * @returns {Promise<void>}
   */
  async saveWorkflow(workflow) {
    const workflows = await this.loadAllWorkflows();

    // Remove existing workflow with same ID
    const filtered = workflows.filter((w) => w.id !== workflow.id);

    // Add updated workflow
    filtered.push(workflow);

    // Save to storage
    await chrome.storage.local.set({ [this.STORAGE_KEY]: filtered });
  }

  /**
   * Validate workflow definition
   *
   * @param {Object} workflow - Workflow to validate
   * @throws {Error} If workflow is invalid
   */
  validateWorkflow(workflow) {
    if (!workflow) {
      throw new Error('Workflow is required');
    }

    if (!workflow.name) {
      throw new Error('Workflow must have a name');
    }

    if (!workflow.steps || !Array.isArray(workflow.steps)) {
      throw new Error('Workflow must have steps array');
    }

    if (workflow.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    // Validate each step has required fields
    for (const step of workflow.steps) {
      if (!step.id) {
        throw new Error('Step must have an id');
      }

      if (!step.type) {
        throw new Error(`Step ${step.id} must have a type`);
      }
    }
  }

  /**
   * Generate a unique workflow ID
   *
   * @returns {string} Workflow ID
   */
  generateWorkflowId() {
    return (
      'wf_' +
      Date.now() +
      '_' +
      Math.random().toString(36).substr(2, 9)
    );
  }

  /**
   * Calculate relevance score for search
   *
   * @param {Object} workflow - Workflow
   * @param {string} query - Search query
   * @returns {number} Relevance score
   */
  calculateRelevanceScore(workflow, query) {
    let score = 0;

    // Name match (highest weight)
    if (workflow.name.toLowerCase().includes(query)) {
      score += 10;
    }

    // Description match
    if (workflow.description?.toLowerCase().includes(query)) {
      score += 5;
    }

    // Tag match
    if (workflow.tags?.some((tag) => tag.toLowerCase().includes(query))) {
      score += 3;
    }

    return score;
  }

  /**
   * Get metadata
   *
   * @returns {Promise<Object>} Metadata
   */
  async getMetadata() {
    try {
      const result = await chrome.storage.local.get(this.METADATA_KEY);
      return result[this.METADATA_KEY] || { usageCount: [] };
    } catch (error) {
      console.error('[WorkflowManager] Failed to load metadata:', error);
      return { usageCount: [] };
    }
  }

  /**
   * Update metadata
   *
   * @param {string} operation - Operation type
   * @param {Object} workflow - Workflow
   * @returns {Promise<void>}
   */
  async updateMetadata(operation, workflow) {
    const metadata = await this.getMetadata();

    // Update usage count
    if (operation === 'execute') {
      const usage = metadata.usageCount.find((u) => u.workflowId === workflow.id);

      if (usage) {
        usage.count++;
        usage.lastUsed = Date.now();
      } else {
        metadata.usageCount.push({
          workflowId: workflow.id,
          name: workflow.name,
          count: 1,
          lastUsed: Date.now()
        });
      }

      // Sort by usage count
      metadata.usageCount.sort((a, b) => b.count - a.count);
    }

    // Save metadata
    await chrome.storage.local.set({ [this.METADATA_KEY]: metadata });
  }

  /**
   * Clear workflow cache
   */
  clearCache() {
    this.workflowCache.clear();
  }

  /**
   * Get cache size
   *
   * @returns {number} Cache size
   */
  getCacheSize() {
    return this.workflowCache.size;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WorkflowManager };
}
