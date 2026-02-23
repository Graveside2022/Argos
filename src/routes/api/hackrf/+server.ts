import { createHandler } from '$lib/server/api/create-handler';

export const GET = createHandler(() => ({
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
}));
