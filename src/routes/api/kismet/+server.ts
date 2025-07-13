// GET /api/kismet - List all available Kismet API endpoints
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
  const endpoints = {
    service: {
      status: {
        method: 'GET',
        path: '/api/kismet/service/status',
        description: 'Get Kismet service status'
      },
      start: {
        method: 'POST',
        path: '/api/kismet/service/start',
        description: 'Start Kismet service'
      },
      stop: {
        method: 'POST',
        path: '/api/kismet/service/stop',
        description: 'Stop Kismet service'
      },
      restart: {
        method: 'POST',
        path: '/api/kismet/service/restart',
        description: 'Restart Kismet service'
      }
    },
    devices: {
      list: {
        method: 'GET',
        path: '/api/kismet/devices/list',
        description: 'List WiFi devices',
        queryParams: {
          type: 'Filter by device type (AP, Client, Bridge, Unknown)',
          ssid: 'Filter by SSID',
          manufacturer: 'Filter by manufacturer',
          minSignal: 'Minimum signal strength',
          maxSignal: 'Maximum signal strength',
          seenWithin: 'Devices seen within N minutes'
        }
      },
      stats: {
        method: 'GET',
        path: '/api/kismet/devices/stats',
        description: 'Get device statistics'
      }
    },
    scripts: {
      list: {
        method: 'GET',
        path: '/api/kismet/scripts/list',
        description: 'List available scripts'
      },
      execute: {
        method: 'POST',
        path: '/api/kismet/scripts/execute',
        description: 'Execute a script',
        body: {
          scriptPath: 'Full path to the script'
        }
      }
    },
    websocket: {
      endpoint: '/api/kismet/ws',
      description: 'WebSocket endpoint for real-time updates',
      note: 'Requires platform-specific WebSocket server implementation'
    }
  };

  return json({
    success: true,
    api: 'Kismet API',
    version: '1.0.0',
    endpoints,
    timestamp: new Date().toISOString()
  });
};