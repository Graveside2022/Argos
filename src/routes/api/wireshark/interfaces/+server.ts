import { json } from '@sveltejs/kit';
import { wiresharkController } from '$lib/server/wireshark';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const interfaces = await wiresharkController.listInterfaces();
		
		return json({
			success: true,
			interfaces,
			current: wiresharkController.getStatus().interface
		});
		
	} catch (error) {
		console.error('Failed to list network interfaces:', error);
		
		return json({
			success: false,
			error: error.message,
			message: 'Failed to list network interfaces'
		}, {
			status: 500
		});
	}
};