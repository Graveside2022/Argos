import { json } from '@sveltejs/kit';
import { wiresharkController } from '$lib/server/wireshark';
import { getSpectrumAnalyzer } from '$lib/server/gnuradio/spectrum_analyzer';
import { fusionKismetController } from '$lib/server/kismet/fusion_controller';
import { checkInstalledTools, getMissingToolsMessage } from '$lib/server/toolChecker';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		console.log('Fusion Security Center start requested');
		
		// Check installed tools first
		const toolStatus = checkInstalledTools();
		console.log('Tool availability:', toolStatus);
		
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
		
		const results = {
			wireshark: { success: false, error: null },
			gnuradio: { success: false, error: null },
			kismet: { success: false, error: null }
		};
		
		// Start Wireshark with better error handling
		try {
			// Check if already running
			const wiresharkStatus = wiresharkController.getStatus();
			if (wiresharkStatus.running) {
				console.log('Wireshark already running, skipping start');
				results.wireshark.success = true;
			} else {
				await wiresharkController.start();
				results.wireshark.success = true;
				console.log('Wireshark started successfully');
			}
		} catch (error) {
			results.wireshark.error = error.message;
			console.error('Failed to start Wireshark:', error);
			
			// Try to reset and restart if in invalid state
			try {
				await wiresharkController.stop();
				await new Promise(resolve => setTimeout(resolve, 1000));
				await wiresharkController.start();
				results.wireshark.success = true;
				console.log('Wireshark restarted successfully after reset');
			} catch (retryError) {
				results.wireshark.error = `Reset failed: ${retryError.message}`;
				console.error('Wireshark reset failed:', retryError);
			}
		}
		
		// Start GNU Radio with better error handling
		try {
			const analyzer = getSpectrumAnalyzer();
			const gnuradioStatus = analyzer.getStatus();
			
			if (gnuradioStatus.running) {
				console.log('GNU Radio already running, skipping start');
				results.gnuradio.success = true;
			} else {
				await analyzer.start();
				results.gnuradio.success = true;
				console.log('GNU Radio started successfully');
			}
		} catch (error) {
			results.gnuradio.error = error.message;
			console.error('Failed to start GNU Radio:', error);
			
			// Try to reset and restart if in invalid state
			try {
				const analyzer = getSpectrumAnalyzer();
				await analyzer.stop();
				await new Promise(resolve => setTimeout(resolve, 1000));
				await analyzer.start();
				results.gnuradio.success = true;
				console.log('GNU Radio restarted successfully after reset');
			} catch (retryError) {
				results.gnuradio.error = `Reset failed: ${retryError.message}`;
				console.error('GNU Radio reset failed:', retryError);
			}
		}
		
		// Start Kismet with better error handling
		try {
			const kismetStatus = fusionKismetController.getStatus();
			if (kismetStatus.running) {
				console.log('Kismet already running, skipping start');
				results.kismet.success = true;
			} else {
				await fusionKismetController.start();
				results.kismet.success = true;
				console.log('Kismet started successfully');
			}
		} catch (error) {
			results.kismet.error = error.message;
			console.error('Failed to start Kismet:', error);
			
			// For Kismet, the "Operation not supported" error is likely interface-related
			// Try common fixes
			if (error.message.includes('Operation not supported')) {
				results.kismet.error = 'WiFi interface not available or not in monitor mode. Please check WiFi adapter configuration.';
			}
		}
		
		const successCount = Object.values(results).filter(r => r.success).length;
		const totalTools = Object.keys(results).length;
		
		// Add tool availability info
		const missingToolsMsg = getMissingToolsMessage();
		const message = successCount === 0 && !toolStatus.tshark?.installed && !toolStatus.gnuradio?.installed && !toolStatus.kismet?.installed
			? `No RF monitoring tools are installed. ${missingToolsMsg}`
			: `Fusion Security Center: ${successCount}/${totalTools} tools started`;
		
		return json({
			success: successCount > 0,
			message,
			results,
			status: successCount === totalTools ? 'fully_started' : successCount > 0 ? 'partially_started' : 'failed',
			toolStatus,
			missingTools: missingToolsMsg
		});
		
	} catch (error) {
		console.error('Fusion start error:', error);
		
		return json({
			success: false,
			error: error.message,
			message: 'Failed to start Fusion Security Center',
			details: error.stack
		}, {
			status: 500
		});
	}
};