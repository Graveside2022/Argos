import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
  return json({
    success: true,
    message: 'HackRF API',
    version: '1.0.0',
    endpoints: [
      '/api/hackrf/health',
      '/api/hackrf/start-sweep',
      '/api/hackrf/stop-sweep',
      '/api/hackrf/cycle-status',
      '/api/hackrf/emergency-stop',
      '/api/hackrf/force-cleanup',
      '/api/hackrf/data-stream'
    ],
    timestamp: Date.now()
  });
};