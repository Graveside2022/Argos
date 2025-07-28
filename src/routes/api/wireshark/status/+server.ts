import { json } from '@sveltejs/kit';
import { wiresharkController } from '$lib/server/wireshark';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const status = wiresharkController.getStatus();
		
		return json({
			success: true,
			status: status.running ? 'running' : 'stopped',
			data: status
		});
		
	} catch (error) {
		console.error('Failed to get Wireshark status:', error);
		
		return json({
			success: false,
			error: (error as Error).message,
			message: 'Failed to retrieve Wireshark status'
		}, {
			status: 500
		});
	}
};