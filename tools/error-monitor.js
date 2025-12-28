#!/usr/bin/env node
/**
 * Error Monitor for Chrome Extension Development
 *
 * Connects to Chrome's remote debugging port via CDP (Chrome DevTools Protocol)
 * and streams console errors and exceptions to the terminal in real-time.
 *
 * Usage:
 *   node error-monitor.js [--host localhost] [--port 9222] [--auto]
 *
 * Options:
 *   --host    Chrome debugging host (default: localhost)
 *   --port    Chrome debugging port (default: 9222)
 *   --auto    Auto-connect to extension service worker targets
 *   --all     Monitor all targets simultaneously
 *   --filter  Filter by target type: page, service_worker, worker, other
 */

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',

    // Foreground colors
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',

    // Background colors
    bgRed: '\x1b[41m',
    bgYellow: '\x1b[43m',
};

function printHelp() {
    console.log(`
${colors.bold}Chrome Error Monitor${colors.reset}

Connects to Chrome's remote debugging port and streams errors to the terminal.

${colors.bold}Usage:${colors.reset}
  node error-monitor.js [options]

${colors.bold}Options:${colors.reset}
  --host, -h    Chrome debugging host (default: localhost)
  --port, -p    Chrome debugging port (default: 9222)
  --auto, -a    Auto-connect to extension service worker targets
  --all         Monitor all available targets simultaneously
  --filter, -f  Filter by target type: page, service_worker, worker, other
  --help        Show this help message

${colors.bold}Examples:${colors.reset}
  node error-monitor.js                     # Interactive target selection
  node error-monitor.js --auto              # Auto-connect to extension
  node error-monitor.js --all               # Monitor all targets
  node error-monitor.js --port 9223         # Custom port
  node error-monitor.js --filter page       # Only monitor page targets

${colors.bold}Installation:${colors.reset}
  npm install chrome-remote-interface
`);
}

// Check for --help early (before requiring CDP)
if (process.argv.includes('--help')) {
    printHelp();
    process.exit(0);
}

// Try to load chrome-remote-interface
let CDP;
try {
    CDP = require('chrome-remote-interface');
} catch (error) {
    console.error(`${colors.red}${colors.bold}Error: Missing dependency 'chrome-remote-interface'${colors.reset}\n`);
    console.log(`${colors.yellow}Please install it first:${colors.reset}`);
    console.log(`  ${colors.cyan}npm install chrome-remote-interface${colors.reset}\n`);
    console.log(`${colors.gray}Or add it to your project:${colors.reset}`);
    console.log(`  ${colors.cyan}npm install --save-dev chrome-remote-interface${colors.reset}\n`);
    process.exit(1);
}

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        host: 'localhost',
        port: 9222,
        auto: false,
        all: false,
        filter: null,
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--host':
            case '-h':
                options.host = args[++i];
                break;
            case '--port':
            case '-p':
                options.port = parseInt(args[++i], 10);
                break;
            case '--auto':
            case '-a':
                options.auto = true;
                break;
            case '--all':
                options.all = true;
                break;
            case '--filter':
            case '-f':
                options.filter = args[++i];
                break;
        }
    }

    return options;
}

// Format timestamp
function formatTimestamp() {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false });
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${colors.gray}[${time}.${ms}]${colors.reset}`;
}

// Format log level with appropriate color
function formatLevel(level) {
    const levelColors = {
        'error': `${colors.bgRed}${colors.white}${colors.bold} ERROR ${colors.reset}`,
        'warning': `${colors.bgYellow}${colors.bold} WARN  ${colors.reset}`,
        'info': `${colors.blue} INFO  ${colors.reset}`,
        'log': `${colors.white} LOG   ${colors.reset}`,
        'debug': `${colors.gray} DEBUG ${colors.reset}`,
        'trace': `${colors.dim} TRACE ${colors.reset}`,
        'exception': `${colors.bgRed}${colors.white}${colors.bold} EXCEPTION ${colors.reset}`,
    };
    return levelColors[level] || `${colors.white} ${level.toUpperCase().padEnd(5)} ${colors.reset}`;
}

// Format source location
function formatSource(url, lineNumber, columnNumber) {
    if (!url) return '';

    // Shorten the URL for display
    let shortUrl = url;
    if (url.includes('://')) {
        const parts = url.split('://');
        shortUrl = parts[1] || url;
    }
    if (shortUrl.length > 60) {
        shortUrl = '...' + shortUrl.slice(-57);
    }

    let location = `${colors.cyan}${shortUrl}${colors.reset}`;
    if (lineNumber !== undefined) {
        location += `${colors.gray}:${lineNumber}${colors.reset}`;
        if (columnNumber !== undefined) {
            location += `${colors.gray}:${columnNumber}${colors.reset}`;
        }
    }
    return location;
}

// Format stack trace
function formatStackTrace(stackTrace) {
    if (!stackTrace || !stackTrace.callFrames) return '';

    const frames = stackTrace.callFrames.slice(0, 10); // Limit to 10 frames
    let output = `\n${colors.gray}Stack trace:${colors.reset}\n`;

    frames.forEach((frame, index) => {
        const funcName = frame.functionName || '(anonymous)';
        const location = formatSource(frame.url, frame.lineNumber, frame.columnNumber);
        output += `${colors.gray}  ${index}:${colors.reset} ${colors.yellow}${funcName}${colors.reset}`;
        if (location) {
            output += ` ${colors.gray}at${colors.reset} ${location}`;
        }
        output += '\n';
    });

    return output;
}

// Format console argument values
function formatArg(arg) {
    if (!arg) return 'undefined';

    switch (arg.type) {
        case 'string':
            return arg.value;
        case 'number':
        case 'boolean':
            return String(arg.value);
        case 'undefined':
            return 'undefined';
        case 'null':
            return 'null';
        case 'object':
            if (arg.subtype === 'null') return 'null';
            if (arg.subtype === 'array') {
                return arg.description || 'Array';
            }
            if (arg.subtype === 'error') {
                return arg.description || 'Error';
            }
            if (arg.preview) {
                try {
                    const props = arg.preview.properties || [];
                    const pairs = props.map(p => `${p.name}: ${p.value}`).join(', ');
                    return `{${pairs}}`;
                } catch (e) {
                    return arg.description || 'Object';
                }
            }
            return arg.description || 'Object';
        case 'function':
            return arg.description || 'function()';
        case 'symbol':
            return arg.description || 'Symbol';
        default:
            return arg.description || arg.value || String(arg.type);
    }
}

// Print console message
function printConsoleMessage(params, targetInfo) {
    const { type, args, stackTrace, executionContextId } = params;

    // Format the message from args
    const message = args ? args.map(formatArg).join(' ') : '';

    // Get source location from stack trace if available
    let source = '';
    if (stackTrace && stackTrace.callFrames && stackTrace.callFrames.length > 0) {
        const frame = stackTrace.callFrames[0];
        source = formatSource(frame.url, frame.lineNumber, frame.columnNumber);
    }

    // Build output
    const timestamp = formatTimestamp();
    const level = formatLevel(type);
    const targetLabel = targetInfo ? `${colors.magenta}[${targetInfo.title || targetInfo.type}]${colors.reset} ` : '';

    console.log(`${timestamp} ${level} ${targetLabel}${message}`);

    if (source) {
        console.log(`${colors.gray}         at ${colors.reset}${source}`);
    }

    // Show stack trace for errors
    if ((type === 'error' || type === 'trace') && stackTrace) {
        console.log(formatStackTrace(stackTrace));
    }
}

// Print exception
function printException(params, targetInfo) {
    const { exceptionDetails } = params;
    if (!exceptionDetails) return;

    const { text, exception, lineNumber, columnNumber, url, stackTrace } = exceptionDetails;

    const timestamp = formatTimestamp();
    const level = formatLevel('exception');
    const targetLabel = targetInfo ? `${colors.magenta}[${targetInfo.title || targetInfo.type}]${colors.reset} ` : '';

    // Get the error message
    let message = text || '';
    if (exception) {
        if (exception.description) {
            message = exception.description;
        } else if (exception.value) {
            message = String(exception.value);
        }
    }

    console.log(`\n${timestamp} ${level} ${targetLabel}`);
    console.log(`${colors.red}${colors.bold}${message}${colors.reset}`);

    // Source location
    if (url) {
        const source = formatSource(url, lineNumber, columnNumber);
        console.log(`${colors.gray}         at ${colors.reset}${source}`);
    }

    // Stack trace
    if (stackTrace) {
        console.log(formatStackTrace(stackTrace));
    }

    console.log(''); // Empty line for readability
}

// List available targets
async function listTargets(options) {
    try {
        const targets = await CDP.List({ host: options.host, port: options.port });
        return targets;
    } catch (error) {
        throw new Error(`Failed to list targets: ${error.message}`);
    }
}

// Display targets for selection
function displayTargets(targets, filter) {
    let filtered = targets;

    if (filter) {
        filtered = targets.filter(t => t.type === filter);
    }

    console.log(`\n${colors.bold}Available Targets:${colors.reset}\n`);

    filtered.forEach((target, index) => {
        const typeColor = {
            'page': colors.green,
            'service_worker': colors.yellow,
            'worker': colors.blue,
            'other': colors.gray,
        }[target.type] || colors.white;

        const title = target.title || '(untitled)';
        const url = target.url || '';
        const shortUrl = url.length > 60 ? url.slice(0, 57) + '...' : url;

        console.log(`  ${colors.bold}${index + 1})${colors.reset} ${typeColor}[${target.type}]${colors.reset} ${title}`);
        if (shortUrl) {
            console.log(`     ${colors.gray}${shortUrl}${colors.reset}`);
        }
    });

    console.log('');
    return filtered;
}

// Find extension targets
function findExtensionTargets(targets) {
    return targets.filter(t =>
        t.type === 'service_worker' &&
        (t.url.startsWith('chrome-extension://') || t.title.includes('extension'))
    );
}

// Connect to a target and set up monitoring
async function monitorTarget(options, target, reconnect = true) {
    let client = null;
    let isConnected = false;

    const targetInfo = {
        title: target.title || target.type,
        type: target.type,
        url: target.url,
    };

    async function connect() {
        try {
            console.log(`${colors.green}Connecting to:${colors.reset} ${targetInfo.title}`);
            console.log(`${colors.gray}URL: ${target.url}${colors.reset}`);
            console.log(`${colors.gray}Type: ${target.type}${colors.reset}\n`);

            client = await CDP({
                host: options.host,
                port: options.port,
                target: target.id || target.webSocketDebuggerUrl,
            });

            isConnected = true;

            // Enable Runtime domain
            await client.Runtime.enable();

            // Subscribe to console events
            client.Runtime.consoleAPICalled((params) => {
                printConsoleMessage(params, targetInfo);
            });

            // Subscribe to exception events
            client.Runtime.exceptionThrown((params) => {
                printException(params, targetInfo);
            });

            console.log(`${colors.green}${colors.bold}Connected and monitoring...${colors.reset}`);
            console.log(`${colors.gray}Press Ctrl+C to exit${colors.reset}\n`);
            console.log(`${colors.gray}${'='.repeat(60)}${colors.reset}\n`);

            // Handle disconnection
            client.on('disconnect', () => {
                isConnected = false;
                console.log(`\n${colors.yellow}Disconnected from target${colors.reset}`);

                if (reconnect) {
                    console.log(`${colors.gray}Attempting to reconnect in 2 seconds...${colors.reset}`);
                    setTimeout(() => attemptReconnect(), 2000);
                }
            });

            return client;

        } catch (error) {
            isConnected = false;
            throw error;
        }
    }

    async function attemptReconnect() {
        const maxRetries = 10;
        let retries = 0;

        while (retries < maxRetries && !isConnected) {
            try {
                // Refresh target list to find the new target
                const targets = await listTargets(options);

                // Try to find a matching target
                let newTarget = targets.find(t => t.url === target.url);

                // If not found by URL, try to find by type
                if (!newTarget && target.type === 'service_worker') {
                    const extTargets = findExtensionTargets(targets);
                    if (extTargets.length > 0) {
                        newTarget = extTargets[0];
                    }
                }

                if (newTarget) {
                    target = newTarget;
                    await connect();
                    return;
                }

            } catch (error) {
                // Ignore and retry
            }

            retries++;
            if (retries < maxRetries && !isConnected) {
                console.log(`${colors.gray}Retry ${retries}/${maxRetries}...${colors.reset}`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        if (!isConnected) {
            console.log(`${colors.red}Failed to reconnect after ${maxRetries} attempts${colors.reset}`);
            process.exit(1);
        }
    }

    return connect();
}

// Interactive target selection
async function selectTarget(targets) {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(`${colors.bold}Enter target number (or 'q' to quit): ${colors.reset}`, (answer) => {
            rl.close();

            if (answer.toLowerCase() === 'q') {
                console.log('Exiting...');
                process.exit(0);
            }

            const index = parseInt(answer, 10) - 1;
            if (isNaN(index) || index < 0 || index >= targets.length) {
                console.log(`${colors.red}Invalid selection${colors.reset}`);
                process.exit(1);
            }

            resolve(targets[index]);
        });
    });
}

// Monitor multiple targets
async function monitorAllTargets(options, targets) {
    console.log(`\n${colors.bold}Monitoring ${targets.length} targets...${colors.reset}\n`);

    const clients = [];

    for (const target of targets) {
        try {
            const client = await monitorTarget(options, target, false);
            clients.push(client);
        } catch (error) {
            console.log(`${colors.yellow}Could not connect to ${target.title}: ${error.message}${colors.reset}`);
        }
    }

    if (clients.length === 0) {
        console.log(`${colors.red}No targets connected successfully${colors.reset}`);
        process.exit(1);
    }

    console.log(`\n${colors.green}${colors.bold}Monitoring ${clients.length} targets...${colors.reset}`);
    console.log(`${colors.gray}Press Ctrl+C to exit${colors.reset}\n`);
    console.log(`${colors.gray}${'='.repeat(60)}${colors.reset}\n`);

    return clients;
}

// Main function
async function main() {
    const options = parseArgs();

    console.log(`\n${colors.bold}${colors.cyan}Chrome Error Monitor${colors.reset}`);
    console.log(`${colors.gray}Connecting to ${options.host}:${options.port}...${colors.reset}\n`);

    try {
        // Get available targets
        const targets = await listTargets(options);

        if (targets.length === 0) {
            console.log(`${colors.red}No targets available.${colors.reset}`);
            console.log(`${colors.yellow}Make sure Chrome is running with remote debugging enabled:${colors.reset}`);
            console.log(`${colors.gray}  chrome --remote-debugging-port=${options.port}${colors.reset}`);
            process.exit(1);
        }

        let selectedTargets = [];

        if (options.all) {
            // Monitor all targets
            selectedTargets = options.filter
                ? targets.filter(t => t.type === options.filter)
                : targets;
            await monitorAllTargets(options, selectedTargets);

        } else if (options.auto) {
            // Auto-connect to extension targets
            const extTargets = findExtensionTargets(targets);

            if (extTargets.length > 0) {
                console.log(`${colors.green}Found ${extTargets.length} extension target(s)${colors.reset}`);
                await monitorTarget(options, extTargets[0]);
            } else {
                console.log(`${colors.yellow}No extension targets found. Showing all targets:${colors.reset}`);
                const filtered = displayTargets(targets, options.filter);
                const selected = await selectTarget(filtered);
                await monitorTarget(options, selected);
            }

        } else {
            // Interactive selection
            const filtered = displayTargets(targets, options.filter);
            const selected = await selectTarget(filtered);
            await monitorTarget(options, selected);
        }

    } catch (error) {
        console.error(`${colors.red}Error: ${error.message}${colors.reset}`);

        if (error.message.includes('ECONNREFUSED')) {
            console.log(`\n${colors.yellow}Chrome remote debugging is not accessible.${colors.reset}`);
            console.log(`${colors.gray}Make sure Chrome is running with:${colors.reset}`);
            console.log(`${colors.cyan}  chrome --remote-debugging-port=${options.port}${colors.reset}`);
        }

        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(`\n\n${colors.yellow}Shutting down...${colors.reset}`);
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log(`\n\n${colors.yellow}Shutting down...${colors.reset}`);
    process.exit(0);
});

// Run
main().catch((error) => {
    console.error(`${colors.red}Unhandled error: ${error.message}${colors.reset}`);
    process.exit(1);
});
