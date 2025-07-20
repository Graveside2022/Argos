import { json } from '@sveltejs/kit';
import { wiresharkController } from '$lib/server/wireshark';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json().catch(() => ({}));
		const { interface: networkInterface } = body;
		
		// Set interface if provided
		if (networkInterface) {
			wiresharkController.setInterface(networkInterface);
		}
		
		await wiresharkController.start();
		
		return json({
			success: true,
			status: 'started',
			interface: wiresharkController.getStatus().interface,
			message: 'Wireshark packet capture started successfully'
		});
		
	} catch (error) {
		console.error('Failed to start Wireshark:', error);
		
		return json({
			success: false,
			error: error.message,
			message: 'Failed to start Wireshark packet capture'
		}, {
			status: 500
		});
	}
};