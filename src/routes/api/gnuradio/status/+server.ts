import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { spectrumAnalyzer } from '$lib/server/gnuradio';

export const GET: RequestHandler = async () => {
	try {
		const status = spectrumAnalyzer.getStatus();
		
		return json({
			success: true,
			status: status.running ? 'running' : 'stopped',
			data: {
				running: status.running,
				centerFrequency: status.config.centerFrequency,
				sampleRate: status.config.sampleRate,
				gain: status.config.gain,
				deviceArgs: status.config.deviceArgs
			}
		});
		
	} catch (error) {
		console.error('Error getting GNU Radio status:', error);
		return json({
			success: false,
			status: 'error',
			error: error.message
		}, { status: 500 });
	}
};