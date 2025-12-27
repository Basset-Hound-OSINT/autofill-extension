/**
 * Mock WebSocket Server for Extension Testing
 *
 * Simulates the palletAI WebSocket server to test extension communication.
 */

const WebSocket = require('ws');

class MockWSServer {
  constructor(port = 8765) {
    this.port = port;
    this.wss = null;
    this.clients = new Set();
    this.messages = [];
    this.handlers = new Map();
  }

  start() {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocket.Server({ port: this.port }, () => {
          console.log(`[MockWS] Server started on port ${this.port}`);
          resolve();
        });

        this.wss.on('error', (error) => {
          console.error('[MockWS] Server error:', error);
          reject(error);
        });

        this.wss.on('connection', (ws, req) => {
          console.log('[MockWS] Client connected');
          this.clients.add(ws);

          ws.on('message', (data) => {
            try {
              const msg = JSON.parse(data.toString());
              console.log('[MockWS] Received:', msg.type || msg.command || 'unknown');
              this.messages.push({ received: msg, timestamp: Date.now() });
              this.handleMessage(ws, msg);
            } catch (error) {
              console.error('[MockWS] Failed to parse message:', error);
            }
          });

          ws.on('close', () => {
            console.log('[MockWS] Client disconnected');
            this.clients.delete(ws);
          });

          ws.on('error', (error) => {
            console.error('[MockWS] Client error:', error);
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  handleMessage(ws, msg) {
    // Built-in handlers
    if (msg.type === 'status' && msg.status === 'connected') {
      console.log('[MockWS] Extension connected with capabilities:', msg.data?.capabilities?.length || 0);
      return;
    }

    if (msg.type === 'heartbeat') {
      return; // Ignore heartbeats
    }

    if (msg.command === 'get_status' || msg.type === 'get_status') {
      this.sendResponse(ws, msg.id || msg.command_id, { status: 'ready' });
      return;
    }

    // Custom handlers
    const handler = this.handlers.get(msg.command || msg.type);
    if (handler) {
      const response = handler(msg);
      this.sendResponse(ws, msg.id || msg.command_id, response);
    }
  }

  sendResponse(ws, requestId, data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'response',
        command_id: requestId,
        success: true,
        ...data
      }));
    }
  }

  // Register custom command handler
  on(command, handler) {
    this.handlers.set(command, handler);
    return this;
  }

  // Send command to all clients
  broadcast(command) {
    const data = JSON.stringify(command);
    let sent = 0;
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
        sent++;
      }
    });
    console.log(`[MockWS] Broadcast to ${sent} clients:`, command.type || command.command);
  }

  // Send to first connected client
  sendToFirst(command) {
    const client = [...this.clients][0];
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(command));
      return true;
    }
    return false;
  }

  getMessages() {
    return [...this.messages];
  }

  clearMessages() {
    this.messages = [];
  }

  getClientCount() {
    return this.clients.size;
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.wss) {
        resolve();
        return;
      }

      // Close all client connections
      this.clients.forEach(client => {
        client.close();
      });
      this.clients.clear();

      this.wss.close(() => {
        console.log('[MockWS] Server stopped');
        resolve();
      });
    });
  }
}

// Allow running standalone
if (require.main === module) {
  const server = new MockWSServer(8765);

  server.on('navigate', (msg) => ({
    success: true,
    url: msg.params?.url || msg.url
  }));

  server.on('get_page_state', (msg) => ({
    success: true,
    state: { title: 'Test Page', url: 'https://example.com' }
  }));

  server.start().then(() => {
    console.log('Mock WebSocket server running on ws://localhost:8765');
    console.log('Press Ctrl+C to stop');
  });

  process.on('SIGINT', () => {
    server.stop().then(() => process.exit(0));
  });
}

module.exports = { MockWSServer };
