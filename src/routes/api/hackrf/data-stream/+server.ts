import type { RequestHandler } from './$types';
import type { SpectrumData } from '$lib/server/hackrf/types';
import { sweepManager } from '$lib/server/hackrf/sweepManager';
import { logInfo, logDebug } from '$lib/utils/logger';

// Track active SSE connections with metadata
interface ConnectionInfo {
  id: string;
  sendEvent: (event: string, data: unknown) => void;
  connectedAt: Date;
  lastActivity: Date;
}

const activeConnections = new Map<string, ConnectionInfo>();

// Generate unique connection ID
let connectionCounter = 0;
const getConnectionId = () => `sse-${Date.now()}-${++connectionCounter}`;

// Periodic cleanup of stale connections
let cleanupInterval: ReturnType<typeof setInterval> | null = null;
const startCleanupInterval = () => {
  if (cleanupInterval) return;
  
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    const staleTimeout = 60000; // 1 minute of inactivity
    
    activeConnections.forEach((conn, id) => {
      if (now - conn.lastActivity.getTime() > staleTimeout) {
        logDebug(`Removing stale SSE connection: ${id}`);
        activeConnections.delete(id);
      }
    });
    
    if (activeConnections.size === 0 && cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
  }, 30000); // Check every 30 seconds
};

export const GET: RequestHandler = () => {
  // Create a readable stream for Server-Sent Events
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const connectionId = getConnectionId();
      
      // Helper function to send SSE messages
      let isConnectionClosed = false;
      const sendEvent = (event: string, data: unknown) => {
        if (isConnectionClosed) return;
        
        try {
          const sseMessage = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(sseMessage));
          
          // Update last activity
          const conn = activeConnections.get(connectionId);
          if (conn) {
            conn.lastActivity = new Date();
          }
        } catch (error: unknown) {
          // Connection is closed, mark it and clean up
          isConnectionClosed = true;
          activeConnections.delete(connectionId);
          
          // Only log if it's not a normal close
          if (error instanceof Error && !error.message.includes('Controller is already closed')) {
            logDebug(`SSE connection ${connectionId} closed with error`, {
              message: error.message,
              stack: error.stack,
              name: error.name
            });
          }
        }
      };
      
      // Add to active connections
      const connectionInfo: ConnectionInfo = {
        id: connectionId,
        sendEvent,
        connectedAt: new Date(),
        lastActivity: new Date()
      };
      activeConnections.set(connectionId, connectionInfo);
      logInfo(`SSE connection established: ${connectionId}`, { totalConnections: activeConnections.size });
      
      // Start cleanup interval if needed
      startCleanupInterval();
      
      // Set SSE emitter for sweepManager
      if (activeConnections.size === 1) {
        // First connection, set up the emitter
        sweepManager.setSseEmitter((event: string, data: unknown) => {
          // Send to all active connections
          activeConnections.forEach(conn => conn.sendEvent(event, data));
        });
      }
      
      // Send initial connection message
      sendEvent('connected', { 
        message: 'Connected to HackRF data stream',
        timestamp: new Date().toISOString()
      });
      
      // Send current status
      const status = sweepManager.getStatus();
      sendEvent('status', status);
      
      // Throttle spectrum data to prevent overwhelming frontend
      let lastSpectrumTime = 0;
      const SPECTRUM_THROTTLE = 50; // Min 50ms between updates (20Hz max)
      
      // Subscribe to sweep manager events
      const onSpectrum = (data: SpectrumData) => {
        const now = Date.now();
        if (now - lastSpectrumTime >= SPECTRUM_THROTTLE) {
          sendEvent('sweep_data', data);
          lastSpectrumTime = now;
        }
      };
      const onStatus = (status: unknown) => sendEvent('status', status);
      const onError = (error: unknown) => sendEvent('error', error);
      const onCycleConfig = (config: unknown) => sendEvent('cycle_config', config);
      const onStatusChange = (change: unknown) => sendEvent('status_change', change);
      
      sweepManager.on('spectrum', onSpectrum);
      sweepManager.on('status', onStatus);
      sweepManager.on('error', onError);
      sweepManager.on('cycle_config', onCycleConfig);
      sweepManager.on('status_change', onStatusChange);
      
      // Keep-alive heartbeat - more frequent to prevent timeouts
      const heartbeat = setInterval(() => {
        sendEvent('heartbeat', { 
          timestamp: new Date().toISOString(),
          connectionId,
          uptime: Date.now() - connectionInfo.connectedAt.getTime()
        });
      }, 10000); // Every 10 seconds (very frequent to ensure stable connection)
      
      // Cleanup on close
      return () => {
        isConnectionClosed = true;
        
        // Remove from active connections
        activeConnections.delete(connectionId);
        logInfo(`SSE connection closed: ${connectionId}`, { remainingConnections: activeConnections.size });
        
        // If last connection, clear SSE emitter
        if (activeConnections.size === 0) {
          sweepManager.setSseEmitter(null);
          logDebug('All SSE connections closed, clearing emitter');
        }
        
        // Unsubscribe from events
        sweepManager.off('spectrum', onSpectrum);
        sweepManager.off('status', onStatus);
        sweepManager.off('error', onError);
        sweepManager.off('cycle_config', onCycleConfig);
        sweepManager.off('status_change', onStatusChange);
        
        // Clear heartbeat
        clearInterval(heartbeat);
      };
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable proxy buffering
    }
  });
};