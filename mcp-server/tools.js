/**
 * Basset Hound MCP Tools
 *
 * Tool definitions for all browser automation commands available through
 * the Basset Hound Chrome extension. These tools are exposed via the MCP
 * protocol to AI agents like Claude.
 *
 * @author Basset Hound Team
 * @license MIT
 */

/**
 * Get all available MCP tools
 * @returns {Array} Array of tool definitions
 */
function getTools() {
  return [
    // =========================================================================
    // Navigation & Page Interaction
    // =========================================================================
    {
      name: 'navigate',
      description: 'Navigate to a URL in the browser',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to navigate to',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID. If not provided, uses active tab',
          },
        },
        required: ['url'],
      },
    },
    {
      name: 'click',
      description: 'Click an element on the page',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the element to click',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID. If not provided, uses active tab',
          },
        },
        required: ['selector'],
      },
    },
    {
      name: 'wait_for_element',
      description: 'Wait for an element to appear on the page',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the element to wait for',
          },
          timeout: {
            type: 'number',
            description: 'Maximum time to wait in milliseconds (default: 10000)',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['selector'],
      },
    },
    {
      name: 'get_content',
      description: 'Get text content from an element or the entire page',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the element (optional - if not provided, gets full page text)',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
      },
    },
    {
      name: 'get_page_source',
      description: 'Get the HTML source code of the current page',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
      },
    },
    {
      name: 'get_page_state',
      description: 'Get comprehensive page state including URL, title, forms, links, and metadata',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
      },
    },
    {
      name: 'execute_script',
      description: 'Execute JavaScript code on the page',
      inputSchema: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'JavaScript code to execute',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['code'],
      },
    },
    {
      name: 'screenshot',
      description: 'Take a screenshot of the current page',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
          format: {
            type: 'string',
            enum: ['png', 'jpeg'],
            description: 'Image format (default: png)',
          },
          quality: {
            type: 'number',
            description: 'JPEG quality 0-100 (only for jpeg format)',
          },
        },
      },
    },

    // =========================================================================
    // Form Automation
    // =========================================================================
    {
      name: 'fill_form',
      description: 'Fill form fields on the page',
      inputSchema: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            description: 'Object mapping CSS selectors to values',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['data'],
      },
    },
    {
      name: 'auto_fill_form',
      description: 'Automatically detect and fill forms with provided data',
      inputSchema: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            description: 'Form data with field names/types as keys',
          },
          formSelector: {
            type: 'string',
            description: 'Optional CSS selector for specific form',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['data'],
      },
    },
    {
      name: 'detect_forms',
      description: 'Detect all forms on the current page',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
      },
    },
    {
      name: 'submit_form',
      description: 'Submit a form on the page',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the form',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['selector'],
      },
    },
    {
      name: 'get_form_validation',
      description: 'Get form validation errors',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the form',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['selector'],
      },
    },
    {
      name: 'fill_select',
      description: 'Fill a select dropdown',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the select element',
          },
          value: {
            type: 'string',
            description: 'Value to select',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['selector', 'value'],
      },
    },
    {
      name: 'fill_checkbox',
      description: 'Check or uncheck a checkbox',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the checkbox',
          },
          checked: {
            type: 'boolean',
            description: 'Whether to check or uncheck',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['selector', 'checked'],
      },
    },
    {
      name: 'fill_radio',
      description: 'Select a radio button',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the radio button',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['selector'],
      },
    },
    {
      name: 'fill_date',
      description: 'Fill a date input field',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the date input',
          },
          date: {
            type: 'string',
            description: 'Date in YYYY-MM-DD format',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['selector', 'date'],
      },
    },

    // =========================================================================
    // Cookies & Storage
    // =========================================================================
    {
      name: 'get_cookies',
      description: 'Get cookies for the current domain',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'Optional URL (defaults to current tab URL)',
          },
          name: {
            type: 'string',
            description: 'Optional cookie name to filter',
          },
        },
      },
    },
    {
      name: 'set_cookies',
      description: 'Set cookies for a domain',
      inputSchema: {
        type: 'object',
        properties: {
          cookies: {
            type: 'array',
            description: 'Array of cookie objects to set',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                value: { type: 'string' },
                url: { type: 'string' },
                domain: { type: 'string' },
                path: { type: 'string' },
                secure: { type: 'boolean' },
                httpOnly: { type: 'boolean' },
                expirationDate: { type: 'number' },
              },
            },
          },
        },
        required: ['cookies'],
      },
    },
    {
      name: 'get_local_storage',
      description: 'Get localStorage data from the current page',
      inputSchema: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'Optional key to get specific item',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
      },
    },
    {
      name: 'set_local_storage',
      description: 'Set localStorage data on the current page',
      inputSchema: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            description: 'Key-value pairs to set in localStorage',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['data'],
      },
    },
    {
      name: 'get_session_storage',
      description: 'Get sessionStorage data from the current page',
      inputSchema: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'Optional key to get specific item',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
      },
    },
    {
      name: 'set_session_storage',
      description: 'Set sessionStorage data on the current page',
      inputSchema: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            description: 'Key-value pairs to set in sessionStorage',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['data'],
      },
    },
    {
      name: 'clear_storage',
      description: 'Clear localStorage and/or sessionStorage',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['local', 'session', 'both'],
            description: 'Which storage to clear',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['type'],
      },
    },

    // =========================================================================
    // Network Monitoring
    // =========================================================================
    {
      name: 'get_network_requests',
      description: 'Get captured network requests',
      inputSchema: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            description: 'Optional filter (e.g., "xhr", "fetch", "image")',
          },
        },
      },
    },
    {
      name: 'start_network_capture',
      description: 'Start capturing network traffic',
      inputSchema: {
        type: 'object',
        properties: {
          filter: {
            type: 'object',
            description: 'Optional filter configuration',
          },
        },
      },
    },
    {
      name: 'stop_network_capture',
      description: 'Stop capturing network traffic',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get_network_log',
      description: 'Get network log in HAR format',
      inputSchema: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['har', 'json'],
            description: 'Output format (default: har)',
          },
        },
      },
    },
    {
      name: 'clear_network_log',
      description: 'Clear network capture log',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get_network_stats',
      description: 'Get network statistics',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },

    // =========================================================================
    // Request Interception
    // =========================================================================
    {
      name: 'add_request_rule',
      description: 'Add a request interception rule',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'URL pattern to match (glob pattern)',
          },
          action: {
            type: 'string',
            enum: ['block', 'redirect', 'modify', 'mock'],
            description: 'Action to take on matching requests',
          },
          config: {
            type: 'object',
            description: 'Action-specific configuration',
          },
        },
        required: ['pattern', 'action'],
      },
    },
    {
      name: 'remove_request_rule',
      description: 'Remove a request interception rule',
      inputSchema: {
        type: 'object',
        properties: {
          ruleId: {
            type: 'string',
            description: 'Rule ID to remove',
          },
        },
        required: ['ruleId'],
      },
    },
    {
      name: 'block_urls',
      description: 'Block requests to specific URLs',
      inputSchema: {
        type: 'object',
        properties: {
          patterns: {
            type: 'array',
            description: 'Array of URL patterns to block',
            items: { type: 'string' },
          },
        },
        required: ['patterns'],
      },
    },
    {
      name: 'unblock_urls',
      description: 'Unblock previously blocked URLs',
      inputSchema: {
        type: 'object',
        properties: {
          patterns: {
            type: 'array',
            description: 'Array of URL patterns to unblock',
            items: { type: 'string' },
          },
        },
        required: ['patterns'],
      },
    },
    {
      name: 'get_interception_rules',
      description: 'Get all active interception rules',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'clear_interception_rules',
      description: 'Clear all interception rules',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },

    // =========================================================================
    // Frame/Iframe Handling
    // =========================================================================
    {
      name: 'get_frames',
      description: 'Get all frames/iframes on the page',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
      },
    },
    {
      name: 'get_frame_info',
      description: 'Get information about a specific frame',
      inputSchema: {
        type: 'object',
        properties: {
          frameId: {
            type: 'string',
            description: 'Frame ID',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['frameId'],
      },
    },
    {
      name: 'execute_in_frame',
      description: 'Execute a command in a specific frame',
      inputSchema: {
        type: 'object',
        properties: {
          frameId: {
            type: 'string',
            description: 'Frame ID',
          },
          command: {
            type: 'string',
            description: 'Command to execute',
          },
          params: {
            type: 'object',
            description: 'Command parameters',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['frameId', 'command'],
      },
    },

    // =========================================================================
    // CAPTCHA Detection
    // =========================================================================
    {
      name: 'detect_captcha',
      description: 'Detect CAPTCHAs on the current page',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
      },
    },
    {
      name: 'get_captcha_state',
      description: 'Get current CAPTCHA state for a tab',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: {
            type: 'number',
            description: 'Tab ID',
          },
        },
        required: ['tabId'],
      },
    },

    // =========================================================================
    // Date Picker Handling
    // =========================================================================
    {
      name: 'get_date_pickers',
      description: 'Find all date picker elements on the page',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
      },
    },
    {
      name: 'set_date',
      description: 'Set a date in a date picker',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for date picker',
          },
          date: {
            type: 'string',
            description: 'Date to set (YYYY-MM-DD format)',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['selector', 'date'],
      },
    },

    // =========================================================================
    // Tab Management
    // =========================================================================
    {
      name: 'create_tab_group',
      description: 'Create a new tab group',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Group title',
          },
          color: {
            type: 'string',
            description: 'Group color',
          },
          tabIds: {
            type: 'array',
            description: 'Tab IDs to add to group',
            items: { type: 'number' },
          },
        },
      },
    },
    {
      name: 'add_to_group',
      description: 'Add tabs to an existing group',
      inputSchema: {
        type: 'object',
        properties: {
          groupId: {
            type: 'number',
            description: 'Group ID',
          },
          tabIds: {
            type: 'array',
            description: 'Tab IDs to add',
            items: { type: 'number' },
          },
        },
        required: ['groupId', 'tabIds'],
      },
    },
    {
      name: 'remove_from_group',
      description: 'Remove tabs from their group',
      inputSchema: {
        type: 'object',
        properties: {
          tabIds: {
            type: 'array',
            description: 'Tab IDs to remove',
            items: { type: 'number' },
          },
        },
        required: ['tabIds'],
      },
    },
    {
      name: 'get_tab_groups',
      description: 'Get all tab groups',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get_tab_state',
      description: 'Get state of a specific tab',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: {
            type: 'number',
            description: 'Tab ID',
          },
        },
        required: ['tabId'],
      },
    },
    {
      name: 'get_all_tab_states',
      description: 'Get states of all tabs',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },

    // =========================================================================
    // File Upload
    // =========================================================================
    {
      name: 'get_file_inputs',
      description: 'Find all file input elements on the page',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
      },
    },
    {
      name: 'handle_file_upload',
      description: 'Handle file upload (Note: actual file content must be handled by extension)',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for file input',
          },
          fileName: {
            type: 'string',
            description: 'File name to simulate',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['selector', 'fileName'],
      },
    },

    // =========================================================================
    // Multi-Step Forms & Wizards
    // =========================================================================
    {
      name: 'detect_wizard',
      description: 'Detect if page contains a multi-step wizard/form',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
      },
    },
    {
      name: 'get_wizard_state',
      description: 'Get current state of a wizard form',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
      },
    },
    {
      name: 'wizard_next',
      description: 'Navigate to next step in wizard',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
      },
    },
    {
      name: 'wizard_previous',
      description: 'Navigate to previous step in wizard',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
      },
    },
    {
      name: 'fill_wizard_step',
      description: 'Fill current step of wizard form',
      inputSchema: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            description: 'Form data for current step',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['data'],
      },
    },

    // =========================================================================
    // User Agent & Rate Limiting
    // =========================================================================
    {
      name: 'set_user_agent',
      description: 'Set custom user agent string',
      inputSchema: {
        type: 'object',
        properties: {
          userAgent: {
            type: 'string',
            description: 'User agent string to set',
          },
        },
        required: ['userAgent'],
      },
    },
    {
      name: 'rotate_user_agent',
      description: 'Rotate to a different user agent',
      inputSchema: {
        type: 'object',
        properties: {
          platform: {
            type: 'string',
            enum: ['desktop', 'mobile', 'tablet'],
            description: 'Platform type',
          },
        },
      },
    },
    {
      name: 'reset_user_agent',
      description: 'Reset to default user agent',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'set_rate_limit',
      description: 'Set rate limiting for actions',
      inputSchema: {
        type: 'object',
        properties: {
          maxActions: {
            type: 'number',
            description: 'Maximum actions per time window',
          },
          timeWindow: {
            type: 'number',
            description: 'Time window in milliseconds',
          },
        },
        required: ['maxActions', 'timeWindow'],
      },
    },

    // =========================================================================
    // Select Element Handling
    // =========================================================================
    {
      name: 'get_select_elements',
      description: 'Get all select elements on the page',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
      },
    },
    {
      name: 'get_select_options',
      description: 'Get options for a specific select element',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for select element',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['selector'],
      },
    },
    {
      name: 'set_select_value',
      description: 'Set value of a select element',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for select element',
          },
          value: {
            type: 'string',
            description: 'Value to set',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['selector', 'value'],
      },
    },
    {
      name: 'set_multi_select_values',
      description: 'Set multiple values for a multi-select element',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for multi-select element',
          },
          values: {
            type: 'array',
            description: 'Array of values to select',
            items: { type: 'string' },
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['selector', 'values'],
      },
    },

    // =========================================================================
    // Batch Command Execution
    // =========================================================================
    {
      name: 'batch_execute',
      description: 'Execute multiple commands in sequence',
      inputSchema: {
        type: 'object',
        properties: {
          commands: {
            type: 'array',
            description: 'Array of commands to execute',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                params: { type: 'object' },
              },
            },
          },
          stopOnError: {
            type: 'boolean',
            description: 'Stop execution on first error (default: true)',
          },
        },
        required: ['commands'],
      },
    },
    {
      name: 'queue_commands',
      description: 'Queue commands for asynchronous execution',
      inputSchema: {
        type: 'object',
        properties: {
          commands: {
            type: 'array',
            description: 'Array of commands to queue',
          },
          priority: {
            type: 'number',
            description: 'Queue priority (higher = executes first)',
          },
        },
        required: ['commands'],
      },
    },
    {
      name: 'get_queue_status',
      description: 'Get status of command queue',
      inputSchema: {
        type: 'object',
        properties: {
          queueId: {
            type: 'string',
            description: 'Optional queue ID to check specific queue',
          },
        },
      },
    },
    {
      name: 'cancel_queue',
      description: 'Cancel a queued command batch',
      inputSchema: {
        type: 'object',
        properties: {
          queueId: {
            type: 'string',
            description: 'Queue ID to cancel',
          },
        },
        required: ['queueId'],
      },
    },

    // =========================================================================
    // Dynamic Form Handling
    // =========================================================================
    {
      name: 'wait_for_field',
      description: 'Wait for a form field to appear',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the field',
          },
          timeout: {
            type: 'number',
            description: 'Maximum wait time in ms',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['selector'],
      },
    },
    {
      name: 'wait_for_form_stable',
      description: 'Wait for form to stop changing (useful for dynamic forms)',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the form',
          },
          timeout: {
            type: 'number',
            description: 'Maximum wait time in ms',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['selector'],
      },
    },
    {
      name: 'observe_form_changes',
      description: 'Start observing form for changes',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the form',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['selector'],
      },
    },
    {
      name: 'get_dynamic_fields',
      description: 'Get dynamically added fields in a form',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the form',
          },
          tabId: {
            type: 'number',
            description: 'Optional tab ID',
          },
        },
        required: ['selector'],
      },
    },

    // =========================================================================
    // Privacy & Security
    // =========================================================================
    {
      name: 'clear_browsing_data',
      description: 'Clear browsing data',
      inputSchema: {
        type: 'object',
        properties: {
          dataTypes: {
            type: 'array',
            description: 'Types of data to clear (cookies, cache, history, etc.)',
            items: { type: 'string' },
          },
          since: {
            type: 'number',
            description: 'Time in ms since epoch (clear data from this time)',
          },
        },
        required: ['dataTypes'],
      },
    },
    {
      name: 'get_privacy_status',
      description: 'Get current privacy settings status',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },

    // =========================================================================
    // Audit & Logging
    // =========================================================================
    {
      name: 'get_audit_log',
      description: 'Get audit log of extension actions',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of entries to return',
          },
          since: {
            type: 'number',
            description: 'Get entries since this timestamp',
          },
        },
      },
    },
    {
      name: 'clear_audit_log',
      description: 'Clear audit log',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ];
}

module.exports = {
  getTools,
};
