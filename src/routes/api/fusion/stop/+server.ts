import { json } from '@sveltejs/kit';
import { wiresharkController } from '$lib/server/wireshark';
import { spectrumAnalyzer } from '$lib/server/gnuradio/spectrum_analyzer';
import { fusionKismetController } from '$lib/server/kismet/fusion_controller';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	try {
		console.log('Fusion Security Center stop requested');
		
		const results = {
			wireshark: { success: false, error: null as string | null },
			gnuradio: { success: false, error: null as string | null },
			kismet: { success: false, error: null as string | null }
		};
		
		// Stop Wireshark
		try {
			await wiresharkController.stop();
			results.wireshark.success = true;
			console.log('Wireshark stopped successfully');
		} catch (error) {
			results.wireshark.error = (error as Error).message;
			console.error('Failed to stop Wireshark:', error);
		}
		
		// Stop GNU Radio
		try {
			await spectrumAnalyzer.stop();
			results.gnuradio.success = true;
			console.log('GNU Radio stopped successfully');
		} catch (error) {
			results.gnuradio.error = (error as Error).message;
			console.error('Failed to stop GNU Radio:', error);
		}
		
		// Stop Kismet
		try {
			await fusionKismetController.stop();
			results.kismet.success = true;
			console.log('Kismet stopped successfully');
		} catch (error) {
			results.kismet.error = (error as Error).message;
			console.error('Failed to stop Kismet:', error);
		}
		
		const successCount = Object.values(results).filter(r => r.success).length;
		const totalTools = Object.keys(results).length;
		
		return json({
			success: successCount > 0,
			message: `Fusion Security Center: ${successCount}/${totalTools} tools stopped`,
			results,
			status: successCount === totalTools ? 'fully_stopped' : successCount > 0 ? 'partially_stopped' : 'failed'
		});
		
	} catch (error) {
		console.error('Fusion stop error:', error);
		
		return json({
			success: false,
			error: (error as Error).message,
			message: 'Failed to stop Fusion Security Center',
			details: (error as Error).stack
		}, {
			status: 500
		});
	}
};