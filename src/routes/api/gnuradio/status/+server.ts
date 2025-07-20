import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpectrumAnalyzer } from '$lib/server/gnuradio';

export const GET: RequestHandler = async () => {
	try {
		// Get spectrum analyzer instance
		const analyzer = getSpectrumAnalyzer();
		
		// Get current status
		const status = analyzer.getStatus();
		
		// Get available devices
		const devices = analyzer.getDevices();
		
		return json({
			success: true,
			status: status.running ? 'running' : 'stopped',
			data: {
				running: status.running,
				device: status.device,
				config: status.config,
				devices: devices,
				performance: status.performance,
				lastUpdate: status.lastUpdate,
				error: status.error
			}
		});
		
	} catch (error) {
		console.error('GNU Radio status error:', error);
		
		return json({
			success: false,
			error: error.message,
			message: 'Failed to get GNU Radio status',
			data: {
				running: false,
				device: null,
				config: null,
				devices: [],
				performance: null,
				lastUpdate: 0,
				error: error.message
			}
		}, {
			status: 500
		});
	}
};