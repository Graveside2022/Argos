import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpectrumAnalyzer } from '$lib/server/gnuradio/spectrum_analyzer';

export const POST: RequestHandler = async ({ request }) => {
	try {
		console.log('GNU Radio start requested - Phase 2 implementation');
		
		// Get spectrum analyzer instance
		const analyzer = getSpectrumAnalyzer();
		
		// Parse optional configuration from request
		let config = {};
		try {
			const body = await request.text();
			if (body) {
				config = JSON.parse(body);
			}
		} catch (parseError) {
			console.warn('Failed to parse request body, using defaults');
		}
		
		// Update configuration if provided
		if (Object.keys(config).length > 0) {
			analyzer.updateConfig(config);
		}
		
		// Start spectrum analysis
		await analyzer.start();
		
		// Get current status
		const status = analyzer.getStatus();
		
		console.log('GNU Radio spectrum analyzer started successfully');
		
		return json({
			success: true,
			status: 'started',
			message: 'GNU Radio RF spectrum analysis started',
			data: {
				device: status.device,
				config: status.config,
				devices: analyzer.getDevices(),
				performance: status.performance
			}
		});
		
	} catch (error) {
		console.error('GNU Radio start error:', error);
		
		return json({
			success: false,
			error: error.message,
			message: 'Failed to start GNU Radio spectrum analyzer',
			details: error.stack
		}, {
			status: 500
		});
	}
};