import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpectrumAnalyzer } from '$lib/server/gnuradio';

export const POST: RequestHandler = async () => {
	try {
		console.log('GNU Radio stop requested - Phase 2 implementation');
		
		// Get spectrum analyzer instance
		const analyzer = getSpectrumAnalyzer();
		
		// Stop spectrum analysis
		await analyzer.stop();
		
		// Get current status
		const status = analyzer.getStatus();
		
		console.log('GNU Radio spectrum analyzer stopped successfully');
		
		return json({
			success: true,
			status: 'stopped',
			message: 'GNU Radio RF spectrum analysis stopped',
			data: {
				device: status.device,
				config: status.config,
				performance: status.performance
			}
		});
		
	} catch (error) {
		console.error('GNU Radio stop error:', error);
		
		return json({
			success: false,
			error: error.message,
			message: 'Failed to stop GNU Radio spectrum analyzer',
			details: error.stack
		}, {
			status: 500
		});
	}
};