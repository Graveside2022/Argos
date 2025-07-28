import { json } from '@sveltejs/kit';
import { wiresharkController } from '$lib/server/wireshark';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	try {
		await wiresharkController.stop();
		
		return json({
			success: true,
			status: 'stopped',
			message: 'Wireshark packet capture stopped successfully'
		});
		
	} catch (error) {
		console.error('Failed to stop Wireshark:', error);
		
		return json({
			success: false,
			error: (error as Error).message,
			message: 'Failed to stop Wireshark packet capture'
		}, {
			status: 500
		});
	}
};