import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
  const timestamp = Date.now();
  
  // Test response to verify API is working
  return json({
    success: true,
    message: 'Infrastructure test endpoint',
    timestamp,
    infrastructure: {
      api: {
        status: 'operational',
        endpoints: {
          hackrf: '/api/hackrf',
          kismet: '/api/kismet',
          test: '/api/test'
        }
      },
      websocket: {
        status: 'requires separate server',
        port: 5173,
        endpoints: {
          hackrf: 'ws://localhost:5173/ws/hackrf',
          kismet: 'ws://localhost:5173/ws/kismet'
        }
      },
      pages: {
        main: '/',
        hackrf: '/hackrf',
        kismet: '/kismet',
        test: '/test'
      }
    },
    instructions: {
      start_websocket: 'npm run ws:dev',
      start_dev: 'npm run dev',
      start_all: 'npm run dev:all',
      test_infrastructure: './test-infrastructure.sh'
    }
  });
};