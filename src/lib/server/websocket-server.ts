import { WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';

// WebSocket message interface
interface WebSocketMessage {
  type: string;
  config?: {
    startFreq?: number;
    endFreq?: number;
  };
  streams?: string[];
}

// Store for active connections
const connections = new Map<string, Set<WebSocket>>();

// Message handlers for different endpoints
const messageHandlers = new Map<string, (ws: WebSocket, message: WebSocketMessage) => void>();

/**
 * Initialize WebSocket server
 */
export function initializeWebSocketServer(server: unknown, port: number = 5173) {
  const wss = new WebSocketServer({ 
    port,
    perMessageDeflate: {
      zlibDeflateOptions: {
        chunkSize: 1024,
        memLevel: 7,
        level: 3
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024
      },
      clientNoContextTakeover: true,
      serverNoContextTakeover: true,
      serverMaxWindowBits: 10,
      concurrencyLimit: 10,
      threshold: 1024
    }
  });

  console.warn(`WebSocket server listening on port ${port}`);

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = req.url || '/';
    const endpoint = url.split('?')[0];
    
    console.warn(`New WebSocket connection to ${endpoint}`);
    
    // Add to connections
    if (!connections.has(endpoint)) {
      connections.set(endpoint, new Set());
    }
    connections.get(endpoint)?.add(ws);
    
    // Send initial connection success
    ws.send(JSON.stringify({
      type: 'connected',
      endpoint,
      timestamp: Date.now()
    }));
    
    // Setup message handling
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;
        
        // Handle ping/pong
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          return;
        }
        
        // Route to appropriate handler
        const handler = messageHandlers.get(endpoint);
        if (handler) {
          handler(ws, message);
        } else {
          ws.send(JSON.stringify({
            type: 'error',
            message: `No handler for endpoint ${endpoint}`
          }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });
    
    ws.on('close', () => {
      console.warn(`WebSocket connection closed for ${endpoint}`);
      connections.get(endpoint)?.delete(ws);
    });
    
    ws.on('error', (error: Error) => {
      console.error(`WebSocket error for ${endpoint}:`, error);
    });
  });
  
  return wss;
}

/**
 * Register HackRF WebSocket handler
 */
messageHandlers.set('/hackrf', (ws, message) => {
  switch (message.type) {
    case 'request_status':
      ws.send(JSON.stringify({
        type: 'status',
        data: {
          connected: true,
          sweeping: false,
          frequency: 100000000,
          sampleRate: 20000000,
          gain: 40
        }
      }));
      break;
      
    case 'request_sweep_status':
      ws.send(JSON.stringify({
        type: 'sweep_status',
        data: {
          active: false,
          startFreq: 88000000,
          endFreq: 108000000,
          currentFreq: 0,
          progress: 0
        }
      }));
      break;
      
    case 'start_sweep': {
      ws.send(JSON.stringify({
        type: 'sweep_status',
        data: {
          active: true,
          startFreq: message.config?.startFreq || 88000000,
          endFreq: message.config?.endFreq || 108000000,
          currentFreq: message.config?.startFreq || 88000000,
          progress: 0
        }
      }));
      
      // Simulate sweep progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        if (progress > 100) {
          clearInterval(interval);
          ws.send(JSON.stringify({
            type: 'sweep_status',
            data: { active: false, progress: 100 }
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'spectrum_data',
            data: {
              frequencies: Array.from({ length: 100 }, (_, i) => 88000000 + i * 200000),
              power: Array.from({ length: 100 }, () => -80 + Math.random() * 40),
              timestamp: Date.now()
            }
          }));
        }
      }, 1000);
      break;
    }
      
    case 'stop_sweep':
      ws.send(JSON.stringify({
        type: 'sweep_status',
        data: { active: false }
      }));
      break;
      
    case 'subscribe':
      ws.send(JSON.stringify({
        type: 'subscribed',
        streams: message.streams
      }));
      break;
      
    default:
      ws.send(JSON.stringify({
        type: 'error',
        message: `Unknown message type: ${message.type}`
      }));
  }
});

/**
 * Register Kismet WebSocket handler
 */
messageHandlers.set('/kismet', (ws, message) => {
  switch (message.type) {
    case 'request_status':
      ws.send(JSON.stringify({
        type: 'status',
        data: {
          running: true,
          connected: true,
          devices: 42,
          uptime: 3600,
          packetsPerSecond: 150
        }
      }));
      break;
      
    case 'request_devices':
      ws.send(JSON.stringify({
        type: 'devices_list',
        data: [
          {
            mac: '00:11:22:33:44:55',
            ssid: 'TestNetwork',
            manufacturer: 'Example Corp',
            signalStrength: -45,
            channel: 6,
            firstSeen: new Date(Date.now() - 3600000).toISOString(),
            lastSeen: new Date().toISOString(),
            packets: 1234
          },
          {
            mac: 'AA:BB:CC:DD:EE:FF',
            ssid: 'AnotherNetwork',
            manufacturer: 'Device Inc',
            signalStrength: -72,
            channel: 11,
            firstSeen: new Date(Date.now() - 1800000).toISOString(),
            lastSeen: new Date().toISOString(),
            packets: 567
          }
        ]
      }));
      break;
      
    case 'refresh':
      ws.send(JSON.stringify({
        type: 'status',
        data: {
          running: true,
          connected: true,
          devices: 45,
          uptime: 3700,
          packetsPerSecond: 175
        }
      }));
      break;
      
    default:
      ws.send(JSON.stringify({
        type: 'error',
        message: `Unknown message type: ${message.type}`
      }));
  }
});

/**
 * Broadcast message to all connections on an endpoint
 */
export function broadcast(endpoint: string, message: unknown) {
  const conns = connections.get(endpoint);
  if (conns) {
    const data = JSON.stringify(message);
    conns.forEach(ws => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(data);
      }
    });
  }
}

/**
 * Get connection count for an endpoint
 */
export function getConnectionCount(endpoint: string): number {
  return connections.get(endpoint)?.size || 0;
}