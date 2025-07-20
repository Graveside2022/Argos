import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpectrumAnalyzer } from '$lib/server/gnuradio';

export const GET: RequestHandler = async () => {
	try {
		// Get spectrum analyzer instance
		const analyzer = getSpectrumAnalyzer();
		
		// Get current configuration
		const status = analyzer.getStatus();
		
		return json({
			success: true,
			message: 'GNU Radio configuration retrieved',
			data: {
				config: status.config,
				device: status.device,
				devices: analyzer.getDevices()
			}
		});
		
	} catch (error) {
		console.error('GNU Radio config get error:', error);
		
		return json({
			success: false,
			error: error.message,
			message: 'Failed to get GNU Radio configuration'
		}, {
			status: 500
		});
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Parse configuration from request body
		const body = await request.text();
		const newConfig = JSON.parse(body);
		
		// Get spectrum analyzer instance
		const analyzer = getSpectrumAnalyzer();
		
		// Update configuration
		analyzer.updateConfig(newConfig);
		
		// Get updated status
		const status = analyzer.getStatus();
		
		console.log('GNU Radio configuration updated:', newConfig);
		
		return json({
			success: true,
			message: 'GNU Radio configuration updated',
			data: {
				config: status.config,
				device: status.device,
				running: status.running
			}
		});
		
	} catch (error) {
		console.error('GNU Radio config update error:', error);
		
		return json({
			success: false,
			error: error.message,
			message: 'Failed to update GNU Radio configuration'
		}, {
			status: 500
		});
	}
};