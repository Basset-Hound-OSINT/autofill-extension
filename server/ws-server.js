/**
 * Basset Hound - Simple WebSocket Test Server
 *
 * This server acts as the palletAI backend for testing the browser extension.
 * Run with: node ws-server.js
 *
 * The extension connects to ws://localhost:8765/browser
 */

const WebSocket = require('ws');
const http = require('http');

const PORT = 8765;

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Basset Hound WebSocket Server running on port ' + PORT);
});

// Create WebSocket server
const wss = new WebSocket.Server({ server, path: '/browser' });

console.log(`
╔══════════════════════════════════════════════════════════════╗
║       Basset Hound WebSocket Test Server                     ║
║══════════════════════════════════════════════════════════════║
║  WebSocket: ws://localhost:${PORT}/browser                      ║
║  HTTP:      http://localhost:${PORT}                            ║
╚══════════════════════════════════════════════════════════════╝
`);

// Track connected clients
let clientCount = 0;

wss.on('connection', (ws, req) => {
  clientCount++;
  const clientId = clientCount;
  console.log(`\n[${new Date().toISOString()}] Client #${clientId} connected from ${req.socket.remoteAddress}`);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to Basset Hound WebSocket Server',
    clientId: clientId,
    timestamp: Date.now()
  }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`\n[Client #${clientId}] Received:`, JSON.stringify(message, null, 2));

      // Handle different message types
      if (message.type === 'status') {
        // Status update from extension
        console.log(`  → Extension status: ${message.status}`);
      } else if (message.type === 'response') {
        // Response to a command
        console.log(`  → Command ${message.command_id} completed: ${message.success ? 'SUCCESS' : 'FAILED'}`);
        if (message.data) {
          console.log(`  → Data:`, JSON.stringify(message.data, null, 2).substring(0, 500));
        }
        if (message.error) {
          console.log(`  → Error: ${message.error}`);
        }
      } else {
        // Echo back unknown messages
        console.log(`  → Unknown message type: ${message.type}`);
      }
    } catch (e) {
      console.log(`[Client #${clientId}] Raw message:`, data.toString().substring(0, 200));
    }
  });

  ws.on('close', () => {
    console.log(`\n[${new Date().toISOString()}] Client #${clientId} disconnected`);
  });

  ws.on('error', (error) => {
    console.error(`[Client #${clientId}] Error:`, error.message);
  });
});

// Interactive command sender
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n📝 Commands you can type:');
console.log('  navigate <url>     - Navigate to URL');
console.log('  screenshot         - Take screenshot');
console.log('  state              - Get page state');
console.log('  tabs               - Get all tabs');
console.log('  forms              - Detect forms on page');
console.log('  captcha            - Detect CAPTCHAs');
console.log('  cookies            - Get cookies');
console.log('  shodan <ip>        - Shodan host lookup (needs API key in command)');
console.log('  hibp <email>       - Check email in breaches (needs API key)');
console.log('  wayback <url>      - Check Wayback Machine');
console.log('  whois <domain>     - WHOIS lookup');
console.log('  social <username>  - Social media search');
console.log('  help               - Show available commands');
console.log('  raw <json>         - Send raw JSON command');
console.log('  quit               - Exit server\n');

let commandId = 0;

function sendToAllClients(message) {
  const msgStr = JSON.stringify(message);
  let sent = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msgStr);
      sent++;
    }
  });
  console.log(`→ Sent to ${sent} client(s):`, JSON.stringify(message, null, 2));
}

rl.on('line', (input) => {
  const parts = input.trim().split(' ');
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  commandId++;
  let message = null;

  switch (cmd) {
    case 'navigate':
      message = {
        command_id: String(commandId),
        type: 'navigate',
        params: { url: args || 'https://example.com' }
      };
      break;

    case 'screenshot':
      message = {
        command_id: String(commandId),
        type: 'screenshot',
        params: {}
      };
      break;

    case 'state':
      message = {
        command_id: String(commandId),
        type: 'get_page_state',
        params: {}
      };
      break;

    case 'tabs':
      message = {
        command_id: String(commandId),
        type: 'get_tabs',
        params: {}
      };
      break;

    case 'forms':
      message = {
        command_id: String(commandId),
        type: 'detect_forms',
        params: {}
      };
      break;

    case 'captcha':
      message = {
        command_id: String(commandId),
        type: 'detect_captcha',
        params: {}
      };
      break;

    case 'cookies':
      message = {
        command_id: String(commandId),
        type: 'get_cookies',
        params: {}
      };
      break;

    case 'shodan':
      message = {
        command_id: String(commandId),
        type: 'shodan_host',
        params: { ip: args || '8.8.8.8', apiKey: 'YOUR_SHODAN_API_KEY' }
      };
      console.log('⚠️  Note: Replace YOUR_SHODAN_API_KEY in the command');
      break;

    case 'hibp':
      message = {
        command_id: String(commandId),
        type: 'hibp_check_email',
        params: { email: args || 'test@example.com', apiKey: 'YOUR_HIBP_API_KEY' }
      };
      console.log('⚠️  Note: Replace YOUR_HIBP_API_KEY in the command');
      break;

    case 'wayback':
      message = {
        command_id: String(commandId),
        type: 'wayback_check',
        params: { url: args || 'example.com' }
      };
      break;

    case 'whois':
      message = {
        command_id: String(commandId),
        type: 'whois_domain',
        params: { domain: args || 'example.com' }
      };
      break;

    case 'social':
      message = {
        command_id: String(commandId),
        type: 'social_search',
        params: { username: args || 'test' }
      };
      break;

    case 'fingerprint':
      message = {
        command_id: String(commandId),
        type: 'enable_fingerprint_protection',
        params: { options: { canvas: true, webgl: true, audio: true, navigator: true } }
      };
      break;

    case 'raw':
      try {
        message = JSON.parse(args);
        if (!message.command_id) {
          message.command_id = String(commandId);
        }
      } catch (e) {
        console.log('❌ Invalid JSON:', e.message);
        return;
      }
      break;

    case 'help':
      console.log('\n📝 Available commands:');
      console.log('  navigate <url>     - Navigate to URL');
      console.log('  screenshot         - Take screenshot of current tab');
      console.log('  state              - Get current page state');
      console.log('  tabs               - List all browser tabs');
      console.log('  forms              - Detect forms on current page');
      console.log('  captcha            - Detect CAPTCHAs on current page');
      console.log('  cookies            - Get cookies for current domain');
      console.log('  shodan <ip>        - Shodan host lookup');
      console.log('  hibp <email>       - HaveIBeenPwned email check');
      console.log('  wayback <url>      - Wayback Machine availability check');
      console.log('  whois <domain>     - WHOIS domain lookup');
      console.log('  social <username>  - Social media username search');
      console.log('  fingerprint        - Enable fingerprint protection');
      console.log('  raw <json>         - Send raw JSON command');
      console.log('  quit               - Exit server\n');
      return;

    case 'quit':
    case 'exit':
      console.log('Shutting down...');
      process.exit(0);

    default:
      console.log(`Unknown command: ${cmd}. Type 'help' for available commands.`);
      return;
  }

  if (message) {
    sendToAllClients(message);
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`\n✅ Server listening on port ${PORT}`);
  console.log('Waiting for extension to connect...\n');
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  wss.close();
  server.close();
  process.exit(0);
});
