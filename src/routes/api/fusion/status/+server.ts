import { json } from '@sveltejs/kit';
import { wiresharkController } from '$lib/server/wireshark';
import { spectrumAnalyzer } from '$lib/server/gnuradio';
import { fusionKismetController } from '$lib/server/kismet/fusion_controller';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		// Get status from all tools
		const wiresharkStatus = wiresharkController.getStatus();
		
		// Get GNU Radio status
		const gnuradioStatus = spectrumAnalyzer.getStatus();
		
		// Get Kismet status
		const kismetStatus = fusionKismetController.getStatus();
		
		const status = {
			fusion: {
				running: wiresharkStatus.running || gnuradioStatus.running || kismetStatus.running,
				tools_active: [
					wiresharkStatus.running && 'wireshark',
					gnuradioStatus.running && 'gnuradio', 
					kismetStatus.running && 'kismet'
				].filter(Boolean)
			},
			wireshark: wiresharkStatus.running ? 'running' : 'stopped',
			gnuradio: gnuradioStatus.running ? 'running' : 'stopped',
			kismet: kismetStatus.running ? 'running' : 'stopped',
			details: {
				wireshark: wiresharkStatus,
				gnuradio: gnuradioStatus,
				kismet: kismetStatus
			}
		};
		
		return json({
			success: true,
			...status
		});
		
	} catch (error) {
		console.error('Failed to get Fusion status:', error);
		
		return json({
			success: false,
			error: error.message,
			message: 'Failed to retrieve Fusion Security Center status'
		}, {
			status: 500
		});
	}
};