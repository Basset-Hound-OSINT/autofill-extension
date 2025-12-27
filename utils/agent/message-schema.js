/**
 * Basset Hound Browser Automation - Message Schema
 *
 * Phase 6 palletAI Integration message schema for:
 * - JSON Schema definitions for all message types
 * - Message validation
 * - Schema versioning and negotiation
 */

// =============================================================================
// Schema Version
// =============================================================================

const SCHEMA_VERSION = '1.0.0';
const MIN_COMPATIBLE_VERSION = '1.0.0';

// =============================================================================
// Message Types
// =============================================================================

const MessageType = {
  // Commands
  COMMAND: 'command',
  COMMAND_RESPONSE: 'command_response',

  // Callbacks
  CAPTCHA_HELP_REQUEST: 'captcha_help_request',
  CAPTCHA_HELP_RESPONSE: 'captcha_help_response',
  APPROVAL_REQUEST: 'approval_request',
  APPROVAL_RESPONSE: 'approval_response',
  PROGRESS_UPDATE: 'progress_update',
  BREAKPOINT_HIT: 'breakpoint_hit',
  BREAKPOINT_RESUME: 'breakpoint_resume',

  // Status
  STATUS: 'status',
  HEARTBEAT: 'heartbeat',
  ERROR: 'error',

  // Streaming
  STREAM_START: 'stream_start',
  STREAM_CHUNK: 'stream_chunk',
  STREAM_END: 'stream_end',

  // Negotiation
  VERSION_NEGOTIATION: 'version_negotiation',
  VERSION_RESPONSE: 'version_response'
};

// =============================================================================
// JSON Schema Definitions
// =============================================================================

const MESSAGE_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'basset-hound-message-schema',
  version: SCHEMA_VERSION,
  title: 'Basset Hound Message Schema',
  description: 'Schema for all messages between Basset Hound extension and palletAI backend',

  definitions: {
    // Common timestamp field
    timestamp: {
      type: 'number',
      description: 'Unix timestamp in milliseconds'
    },

    // Common ID field
    id: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      pattern: '^[a-zA-Z0-9_-]+$',
      description: 'Unique identifier'
    },

    // Base message structure
    baseMessage: {
      type: 'object',
      required: ['type', 'timestamp'],
      properties: {
        type: {
          type: 'string',
          enum: Object.values(MessageType),
          description: 'Message type'
        },
        timestamp: { $ref: '#/definitions/timestamp' },
        version: {
          type: 'string',
          pattern: '^\\d+\\.\\d+\\.\\d+$',
          description: 'Schema version'
        }
      }
    },

    // Command message
    command: {
      allOf: [
        { $ref: '#/definitions/baseMessage' },
        {
          type: 'object',
          required: ['command_id', 'type', 'params'],
          properties: {
            command_id: { $ref: '#/definitions/id' },
            type: {
              type: 'string',
              description: 'Command type to execute'
            },
            params: {
              type: 'object',
              description: 'Command parameters'
            },
            timeout: {
              type: 'number',
              minimum: 0,
              maximum: 600000,
              description: 'Command timeout in ms'
            },
            priority: {
              type: 'string',
              enum: ['high', 'normal', 'low'],
              default: 'normal'
            }
          }
        }
      ]
    },

    // Command response
    commandResponse: {
      allOf: [
        { $ref: '#/definitions/baseMessage' },
        {
          type: 'object',
          required: ['command_id', 'success'],
          properties: {
            command_id: { $ref: '#/definitions/id' },
            success: {
              type: 'boolean',
              description: 'Whether command succeeded'
            },
            result: {
              description: 'Command result data'
            },
            error: {
              type: ['string', 'null'],
              description: 'Error message if failed'
            },
            duration: {
              type: 'number',
              minimum: 0,
              description: 'Execution duration in ms'
            }
          }
        }
      ]
    },

    // CAPTCHA help request
    captchaHelpRequest: {
      allOf: [
        { $ref: '#/definitions/baseMessage' },
        {
          type: 'object',
          required: ['request_id', 'captcha'],
          properties: {
            request_id: { $ref: '#/definitions/id' },
            captcha: {
              type: 'object',
              required: ['type'],
              properties: {
                type: {
                  type: 'string',
                  description: 'CAPTCHA type'
                },
                provider: {
                  type: 'string',
                  description: 'CAPTCHA provider'
                },
                siteKey: {
                  type: ['string', 'null'],
                  description: 'Site key'
                },
                state: {
                  type: 'string',
                  enum: ['unsolved', 'solved', 'expired', 'challenge_visible', 'loading', 'error', 'invisible', 'unknown']
                },
                selector: {
                  type: ['string', 'null'],
                  description: 'CSS selector'
                },
                boundingBox: {
                  type: ['object', 'null'],
                  properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                    width: { type: 'number' },
                    height: { type: 'number' }
                  }
                }
              }
            },
            screenshot: {
              type: ['string', 'null'],
              description: 'Base64 encoded screenshot'
            },
            priority: {
              type: 'string',
              enum: ['high', 'normal', 'low']
            }
          }
        }
      ]
    },

    // CAPTCHA help response
    captchaHelpResponse: {
      allOf: [
        { $ref: '#/definitions/baseMessage' },
        {
          type: 'object',
          required: ['request_id', 'success'],
          properties: {
            request_id: { $ref: '#/definitions/id' },
            success: {
              type: 'boolean'
            },
            token: {
              type: ['string', 'null'],
              description: 'CAPTCHA response token'
            },
            message: {
              type: 'string'
            }
          }
        }
      ]
    },

    // Approval request
    approvalRequest: {
      allOf: [
        { $ref: '#/definitions/baseMessage' },
        {
          type: 'object',
          required: ['request_id', 'action', 'details'],
          properties: {
            request_id: { $ref: '#/definitions/id' },
            action: {
              type: 'string',
              description: 'Action type requiring approval'
            },
            details: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                data: { type: 'object' },
                risk: {
                  type: 'string',
                  enum: ['low', 'medium', 'high', 'critical']
                },
                context: { type: ['object', 'null'] }
              }
            },
            timeout: {
              type: 'number',
              minimum: 0
            },
            autoApproveOnTimeout: {
              type: 'boolean',
              default: false
            }
          }
        }
      ]
    },

    // Approval response
    approvalResponse: {
      allOf: [
        { $ref: '#/definitions/baseMessage' },
        {
          type: 'object',
          required: ['request_id', 'approved'],
          properties: {
            request_id: { $ref: '#/definitions/id' },
            approved: {
              type: 'boolean'
            },
            reason: {
              type: ['string', 'null']
            },
            decidedBy: {
              type: 'string'
            },
            metadata: {
              type: 'object'
            }
          }
        }
      ]
    },

    // Progress update
    progressUpdate: {
      allOf: [
        { $ref: '#/definitions/baseMessage' },
        {
          type: 'object',
          required: ['task_id', 'progress'],
          properties: {
            task_id: { $ref: '#/definitions/id' },
            progress: {
              type: 'number',
              minimum: 0,
              maximum: 100
            },
            message: {
              type: 'string'
            },
            status: {
              type: 'string',
              enum: ['running', 'completed', 'failed', 'cancelled']
            },
            metadata: {
              type: 'object',
              properties: {
                total: { type: ['number', 'null'] },
                completed: { type: ['number', 'null'] },
                eta: { type: ['number', 'null'] },
                phase: { type: ['string', 'null'] }
              }
            }
          }
        }
      ]
    },

    // Breakpoint hit
    breakpointHit: {
      allOf: [
        { $ref: '#/definitions/baseMessage' },
        {
          type: 'object',
          required: ['breakpoint_id'],
          properties: {
            breakpoint_id: { $ref: '#/definitions/id' },
            condition: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                expression: { type: ['string', 'null'] },
                description: { type: 'string' }
              }
            },
            hitCount: {
              type: 'number',
              minimum: 1
            },
            context: {
              type: 'object'
            }
          }
        }
      ]
    },

    // Breakpoint resume
    breakpointResume: {
      allOf: [
        { $ref: '#/definitions/baseMessage' },
        {
          type: 'object',
          required: ['breakpoint_id'],
          properties: {
            breakpoint_id: { $ref: '#/definitions/id' },
            reason: {
              type: 'string'
            },
            context: {
              type: 'object'
            }
          }
        }
      ]
    },

    // Stream start
    streamStart: {
      allOf: [
        { $ref: '#/definitions/baseMessage' },
        {
          type: 'object',
          required: ['stream_id'],
          properties: {
            stream_id: { $ref: '#/definitions/id' },
            totalChunks: {
              type: ['number', 'null'],
              minimum: 0
            },
            totalSize: {
              type: ['number', 'null'],
              minimum: 0
            },
            contentType: {
              type: 'string'
            },
            metadata: {
              type: 'object'
            }
          }
        }
      ]
    },

    // Stream chunk
    streamChunk: {
      allOf: [
        { $ref: '#/definitions/baseMessage' },
        {
          type: 'object',
          required: ['stream_id', 'chunk_index', 'data'],
          properties: {
            stream_id: { $ref: '#/definitions/id' },
            chunk_index: {
              type: 'number',
              minimum: 0
            },
            data: {
              description: 'Chunk data (string or base64 encoded)'
            },
            isLast: {
              type: 'boolean',
              default: false
            }
          }
        }
      ]
    },

    // Stream end
    streamEnd: {
      allOf: [
        { $ref: '#/definitions/baseMessage' },
        {
          type: 'object',
          required: ['stream_id', 'success'],
          properties: {
            stream_id: { $ref: '#/definitions/id' },
            success: {
              type: 'boolean'
            },
            totalChunks: {
              type: 'number',
              minimum: 0
            },
            totalSize: {
              type: 'number',
              minimum: 0
            },
            error: {
              type: ['string', 'null']
            }
          }
        }
      ]
    },

    // Version negotiation
    versionNegotiation: {
      allOf: [
        { $ref: '#/definitions/baseMessage' },
        {
          type: 'object',
          required: ['client_version'],
          properties: {
            client_version: {
              type: 'string',
              pattern: '^\\d+\\.\\d+\\.\\d+$'
            },
            supported_versions: {
              type: 'array',
              items: {
                type: 'string',
                pattern: '^\\d+\\.\\d+\\.\\d+$'
              }
            },
            capabilities: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      ]
    },

    // Version response
    versionResponse: {
      allOf: [
        { $ref: '#/definitions/baseMessage' },
        {
          type: 'object',
          required: ['server_version', 'compatible'],
          properties: {
            server_version: {
              type: 'string',
              pattern: '^\\d+\\.\\d+\\.\\d+$'
            },
            negotiated_version: {
              type: 'string',
              pattern: '^\\d+\\.\\d+\\.\\d+$'
            },
            compatible: {
              type: 'boolean'
            },
            capabilities: {
              type: 'array',
              items: { type: 'string' }
            },
            warnings: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      ]
    },

    // Status message
    status: {
      allOf: [
        { $ref: '#/definitions/baseMessage' },
        {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              enum: ['connected', 'disconnected', 'reconnecting', 'error', 'ready', 'busy']
            },
            data: {
              type: 'object'
            }
          }
        }
      ]
    },

    // Heartbeat
    heartbeat: {
      allOf: [
        { $ref: '#/definitions/baseMessage' },
        {
          type: 'object',
          properties: {
            sequence: {
              type: 'number',
              minimum: 0
            }
          }
        }
      ]
    },

    // Error message
    error: {
      allOf: [
        { $ref: '#/definitions/baseMessage' },
        {
          type: 'object',
          required: ['code', 'message'],
          properties: {
            code: {
              type: 'string'
            },
            message: {
              type: 'string'
            },
            details: {
              type: 'object'
            },
            recoverable: {
              type: 'boolean',
              default: true
            }
          }
        }
      ]
    }
  },

  // Main message type (oneOf)
  oneOf: [
    { $ref: '#/definitions/command' },
    { $ref: '#/definitions/commandResponse' },
    { $ref: '#/definitions/captchaHelpRequest' },
    { $ref: '#/definitions/captchaHelpResponse' },
    { $ref: '#/definitions/approvalRequest' },
    { $ref: '#/definitions/approvalResponse' },
    { $ref: '#/definitions/progressUpdate' },
    { $ref: '#/definitions/breakpointHit' },
    { $ref: '#/definitions/breakpointResume' },
    { $ref: '#/definitions/streamStart' },
    { $ref: '#/definitions/streamChunk' },
    { $ref: '#/definitions/streamEnd' },
    { $ref: '#/definitions/versionNegotiation' },
    { $ref: '#/definitions/versionResponse' },
    { $ref: '#/definitions/status' },
    { $ref: '#/definitions/heartbeat' },
    { $ref: '#/definitions/error' }
  ]
};

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validation result structure
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether message is valid
 * @property {Array<Object>} errors - Validation errors
 * @property {Array<Object>} warnings - Validation warnings
 * @property {Object} message - Original or sanitized message
 */

/**
 * Validate a message against the schema
 * @param {Object} message - Message to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.strict - Fail on additional properties (default: false)
 * @param {boolean} options.coerce - Coerce types where possible (default: true)
 * @param {string} options.expectedType - Expected message type (optional)
 * @returns {ValidationResult} - Validation result
 */
function validateMessage(message, options = {}) {
  const {
    strict = false,
    coerce = true,
    expectedType = null
  } = options;

  const errors = [];
  const warnings = [];

  // Check message is an object
  if (!message || typeof message !== 'object') {
    return {
      valid: false,
      errors: [{ path: '', message: 'Message must be an object', code: 'INVALID_TYPE' }],
      warnings: [],
      message
    };
  }

  // Check required base fields
  if (!message.type) {
    errors.push({ path: 'type', message: 'Message type is required', code: 'REQUIRED_FIELD' });
  } else if (!Object.values(MessageType).includes(message.type)) {
    errors.push({ path: 'type', message: `Unknown message type: ${message.type}`, code: 'INVALID_VALUE' });
  }

  // Check expected type if specified
  if (expectedType && message.type !== expectedType) {
    errors.push({
      path: 'type',
      message: `Expected message type '${expectedType}' but got '${message.type}'`,
      code: 'TYPE_MISMATCH'
    });
  }

  // Check timestamp
  if (message.timestamp === undefined) {
    if (coerce) {
      message.timestamp = Date.now();
      warnings.push({ path: 'timestamp', message: 'Timestamp was added', code: 'COERCED' });
    } else {
      errors.push({ path: 'timestamp', message: 'Timestamp is required', code: 'REQUIRED_FIELD' });
    }
  } else if (typeof message.timestamp !== 'number') {
    if (coerce && !isNaN(Number(message.timestamp))) {
      message.timestamp = Number(message.timestamp);
      warnings.push({ path: 'timestamp', message: 'Timestamp was coerced to number', code: 'COERCED' });
    } else {
      errors.push({ path: 'timestamp', message: 'Timestamp must be a number', code: 'INVALID_TYPE' });
    }
  }

  // Type-specific validation
  if (message.type && errors.length === 0) {
    const typeErrors = validateByType(message, strict);
    errors.push(...typeErrors.errors);
    warnings.push(...typeErrors.warnings);
  }

  // Check version if present
  if (message.version) {
    const versionCheck = checkVersionCompatibility(message.version);
    if (!versionCheck.compatible) {
      warnings.push({
        path: 'version',
        message: `Version ${message.version} may not be fully compatible`,
        code: 'VERSION_WARNING'
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    message
  };
}

/**
 * Validate message by its type
 * @param {Object} message - Message to validate
 * @param {boolean} strict - Strict mode
 * @returns {Object} - Errors and warnings
 */
function validateByType(message, strict) {
  const errors = [];
  const warnings = [];

  switch (message.type) {
    case MessageType.COMMAND:
      if (!message.command_id) {
        errors.push({ path: 'command_id', message: 'Command ID is required', code: 'REQUIRED_FIELD' });
      }
      if (message.params !== undefined && typeof message.params !== 'object') {
        errors.push({ path: 'params', message: 'Params must be an object', code: 'INVALID_TYPE' });
      }
      break;

    case MessageType.COMMAND_RESPONSE:
      if (!message.command_id) {
        errors.push({ path: 'command_id', message: 'Command ID is required', code: 'REQUIRED_FIELD' });
      }
      if (typeof message.success !== 'boolean') {
        errors.push({ path: 'success', message: 'Success must be a boolean', code: 'INVALID_TYPE' });
      }
      break;

    case MessageType.CAPTCHA_HELP_REQUEST:
      if (!message.request_id) {
        errors.push({ path: 'request_id', message: 'Request ID is required', code: 'REQUIRED_FIELD' });
      }
      if (!message.captcha || typeof message.captcha !== 'object') {
        errors.push({ path: 'captcha', message: 'Captcha object is required', code: 'REQUIRED_FIELD' });
      } else if (!message.captcha.type) {
        errors.push({ path: 'captcha.type', message: 'Captcha type is required', code: 'REQUIRED_FIELD' });
      }
      break;

    case MessageType.CAPTCHA_HELP_RESPONSE:
      if (!message.request_id) {
        errors.push({ path: 'request_id', message: 'Request ID is required', code: 'REQUIRED_FIELD' });
      }
      if (typeof message.success !== 'boolean') {
        errors.push({ path: 'success', message: 'Success must be a boolean', code: 'INVALID_TYPE' });
      }
      break;

    case MessageType.APPROVAL_REQUEST:
      if (!message.request_id) {
        errors.push({ path: 'request_id', message: 'Request ID is required', code: 'REQUIRED_FIELD' });
      }
      if (!message.action) {
        errors.push({ path: 'action', message: 'Action is required', code: 'REQUIRED_FIELD' });
      }
      if (!message.details || typeof message.details !== 'object') {
        errors.push({ path: 'details', message: 'Details object is required', code: 'REQUIRED_FIELD' });
      }
      break;

    case MessageType.APPROVAL_RESPONSE:
      if (!message.request_id) {
        errors.push({ path: 'request_id', message: 'Request ID is required', code: 'REQUIRED_FIELD' });
      }
      if (typeof message.approved !== 'boolean') {
        errors.push({ path: 'approved', message: 'Approved must be a boolean', code: 'INVALID_TYPE' });
      }
      break;

    case MessageType.PROGRESS_UPDATE:
      if (!message.task_id) {
        errors.push({ path: 'task_id', message: 'Task ID is required', code: 'REQUIRED_FIELD' });
      }
      if (typeof message.progress !== 'number' || message.progress < 0 || message.progress > 100) {
        errors.push({ path: 'progress', message: 'Progress must be a number between 0 and 100', code: 'INVALID_VALUE' });
      }
      break;

    case MessageType.BREAKPOINT_HIT:
    case MessageType.BREAKPOINT_RESUME:
      if (!message.breakpoint_id) {
        errors.push({ path: 'breakpoint_id', message: 'Breakpoint ID is required', code: 'REQUIRED_FIELD' });
      }
      break;

    case MessageType.STREAM_START:
    case MessageType.STREAM_END:
      if (!message.stream_id) {
        errors.push({ path: 'stream_id', message: 'Stream ID is required', code: 'REQUIRED_FIELD' });
      }
      break;

    case MessageType.STREAM_CHUNK:
      if (!message.stream_id) {
        errors.push({ path: 'stream_id', message: 'Stream ID is required', code: 'REQUIRED_FIELD' });
      }
      if (typeof message.chunk_index !== 'number') {
        errors.push({ path: 'chunk_index', message: 'Chunk index is required', code: 'REQUIRED_FIELD' });
      }
      if (message.data === undefined) {
        errors.push({ path: 'data', message: 'Chunk data is required', code: 'REQUIRED_FIELD' });
      }
      break;

    case MessageType.VERSION_NEGOTIATION:
      if (!message.client_version) {
        errors.push({ path: 'client_version', message: 'Client version is required', code: 'REQUIRED_FIELD' });
      }
      break;

    case MessageType.VERSION_RESPONSE:
      if (!message.server_version) {
        errors.push({ path: 'server_version', message: 'Server version is required', code: 'REQUIRED_FIELD' });
      }
      if (typeof message.compatible !== 'boolean') {
        errors.push({ path: 'compatible', message: 'Compatible must be a boolean', code: 'INVALID_TYPE' });
      }
      break;

    case MessageType.STATUS:
      if (!message.status) {
        errors.push({ path: 'status', message: 'Status is required', code: 'REQUIRED_FIELD' });
      }
      break;

    case MessageType.ERROR:
      if (!message.code) {
        errors.push({ path: 'code', message: 'Error code is required', code: 'REQUIRED_FIELD' });
      }
      if (!message.message) {
        errors.push({ path: 'message', message: 'Error message is required', code: 'REQUIRED_FIELD' });
      }
      break;

    case MessageType.HEARTBEAT:
      // No required fields beyond base
      break;

    default:
      warnings.push({ path: 'type', message: `Unhandled message type: ${message.type}`, code: 'UNKNOWN_TYPE' });
  }

  return { errors, warnings };
}

// =============================================================================
// Version Functions
// =============================================================================

/**
 * Get the current schema version
 * @returns {Object} - Version info
 */
function getSchemaVersion() {
  return {
    version: SCHEMA_VERSION,
    minCompatible: MIN_COMPATIBLE_VERSION,
    timestamp: Date.now()
  };
}

/**
 * Parse a version string
 * @param {string} version - Version string (e.g., '1.0.0')
 * @returns {Object} - Parsed version with major, minor, patch
 */
function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return null;
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    string: version
  };
}

/**
 * Compare two versions
 * @param {string} v1 - First version
 * @param {string} v2 - Second version
 * @returns {number} - -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
  const p1 = parseVersion(v1);
  const p2 = parseVersion(v2);

  if (!p1 || !p2) {
    throw new Error('Invalid version format');
  }

  if (p1.major !== p2.major) return p1.major < p2.major ? -1 : 1;
  if (p1.minor !== p2.minor) return p1.minor < p2.minor ? -1 : 1;
  if (p1.patch !== p2.patch) return p1.patch < p2.patch ? -1 : 1;
  return 0;
}

/**
 * Check if a version is compatible
 * @param {string} version - Version to check
 * @returns {Object} - Compatibility result
 */
function checkVersionCompatibility(version) {
  const parsed = parseVersion(version);
  const minParsed = parseVersion(MIN_COMPATIBLE_VERSION);
  const currentParsed = parseVersion(SCHEMA_VERSION);

  if (!parsed) {
    return {
      compatible: false,
      reason: 'Invalid version format'
    };
  }

  // Check if version is at least minimum compatible
  if (compareVersions(version, MIN_COMPATIBLE_VERSION) < 0) {
    return {
      compatible: false,
      reason: `Version ${version} is below minimum compatible version ${MIN_COMPATIBLE_VERSION}`
    };
  }

  // Check if major version matches
  if (parsed.major !== currentParsed.major) {
    return {
      compatible: false,
      reason: `Major version mismatch: ${parsed.major} vs ${currentParsed.major}`
    };
  }

  // Fully compatible
  if (compareVersions(version, SCHEMA_VERSION) === 0) {
    return {
      compatible: true,
      exact: true
    };
  }

  // Compatible but different version
  return {
    compatible: true,
    exact: false,
    warning: version > SCHEMA_VERSION
      ? 'Client version is newer than server'
      : 'Client version is older than server'
  };
}

/**
 * Negotiate version with client
 * @param {string} clientVersion - Client's schema version
 * @param {Array<string>} clientSupportedVersions - Client's supported versions
 * @param {Array<string>} clientCapabilities - Client's capabilities
 * @returns {Object} - Negotiation result
 */
function negotiateVersion(clientVersion, clientSupportedVersions = [], clientCapabilities = []) {
  const result = {
    serverVersion: SCHEMA_VERSION,
    negotiatedVersion: null,
    compatible: false,
    capabilities: [],
    warnings: []
  };

  // Check direct compatibility
  const directCheck = checkVersionCompatibility(clientVersion);
  if (directCheck.compatible) {
    result.negotiatedVersion = clientVersion;
    result.compatible = true;
    if (directCheck.warning) {
      result.warnings.push(directCheck.warning);
    }
  } else {
    // Try to find a compatible version from supported list
    const sortedVersions = [...clientSupportedVersions].sort(compareVersions).reverse();

    for (const version of sortedVersions) {
      const check = checkVersionCompatibility(version);
      if (check.compatible) {
        result.negotiatedVersion = version;
        result.compatible = true;
        result.warnings.push(`Negotiated to version ${version} from supported versions`);
        break;
      }
    }

    if (!result.compatible) {
      result.warnings.push(directCheck.reason);
      result.warnings.push(`No compatible version found. Client supports: ${clientSupportedVersions.join(', ')}`);
    }
  }

  // Define server capabilities
  const serverCapabilities = [
    'commands',
    'callbacks',
    'streaming',
    'breakpoints',
    'progress_reporting',
    'captcha_help',
    'approval_workflow',
    'version_negotiation'
  ];

  // Find common capabilities
  result.capabilities = serverCapabilities.filter(cap =>
    clientCapabilities.length === 0 || clientCapabilities.includes(cap)
  );

  return result;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create a message with proper structure
 * @param {string} type - Message type
 * @param {Object} data - Message data
 * @returns {Object} - Properly structured message
 */
function createMessage(type, data = {}) {
  return {
    type,
    timestamp: Date.now(),
    version: SCHEMA_VERSION,
    ...data
  };
}

/**
 * Get the full schema
 * @returns {Object} - Full JSON Schema
 */
function getSchema() {
  return MESSAGE_SCHEMA;
}

/**
 * Get schema for a specific message type
 * @param {string} type - Message type
 * @returns {Object|null} - Schema definition or null
 */
function getSchemaForType(type) {
  const typeToSchema = {
    [MessageType.COMMAND]: 'command',
    [MessageType.COMMAND_RESPONSE]: 'commandResponse',
    [MessageType.CAPTCHA_HELP_REQUEST]: 'captchaHelpRequest',
    [MessageType.CAPTCHA_HELP_RESPONSE]: 'captchaHelpResponse',
    [MessageType.APPROVAL_REQUEST]: 'approvalRequest',
    [MessageType.APPROVAL_RESPONSE]: 'approvalResponse',
    [MessageType.PROGRESS_UPDATE]: 'progressUpdate',
    [MessageType.BREAKPOINT_HIT]: 'breakpointHit',
    [MessageType.BREAKPOINT_RESUME]: 'breakpointResume',
    [MessageType.STREAM_START]: 'streamStart',
    [MessageType.STREAM_CHUNK]: 'streamChunk',
    [MessageType.STREAM_END]: 'streamEnd',
    [MessageType.VERSION_NEGOTIATION]: 'versionNegotiation',
    [MessageType.VERSION_RESPONSE]: 'versionResponse',
    [MessageType.STATUS]: 'status',
    [MessageType.HEARTBEAT]: 'heartbeat',
    [MessageType.ERROR]: 'error'
  };

  const schemaName = typeToSchema[type];
  if (!schemaName) {
    return null;
  }

  return MESSAGE_SCHEMA.definitions[schemaName];
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.MessageSchema = {
    // Constants
    SCHEMA_VERSION,
    MIN_COMPATIBLE_VERSION,
    MessageType,
    MESSAGE_SCHEMA,

    // Validation
    validateMessage,

    // Version
    getSchemaVersion,
    negotiateVersion,
    parseVersion,
    compareVersions,
    checkVersionCompatibility,

    // Utility
    createMessage,
    getSchema,
    getSchemaForType
  };
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SCHEMA_VERSION,
    MIN_COMPATIBLE_VERSION,
    MessageType,
    MESSAGE_SCHEMA,
    validateMessage,
    getSchemaVersion,
    negotiateVersion,
    parseVersion,
    compareVersions,
    checkVersionCompatibility,
    createMessage,
    getSchema,
    getSchemaForType
  };
}
