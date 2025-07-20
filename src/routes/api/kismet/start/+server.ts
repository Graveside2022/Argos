import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fusionKismetController } from '$lib/server/kismet/fusion_controller';

export const POST: RequestHandler = async ({ request }) => {
	try {
		console.log('Starting Kismet WiFi discovery...');
		
		// Initialize and start Kismet controller
		if (!fusionKismetController.isReady()) {
			await fusionKismetController.initialize();
		}
		
		await fusionKismetController.start();
		
		const status = fusionKismetController.getStatus();
		
		return json({
			success: true,
			status: 'started',
			message: 'Kismet WiFi discovery started successfully',
			data: {
				interface: status.interface,
				channels: status.channels,
				deviceCount: status.deviceCount,
				uptime: status.uptime
			}
		});
		
	} catch (error) {
		console.error('Kismet start error:', error);
		
		return json({
			success: false,
			error: error.message,
			message: 'Failed to start Kismet'
		}, {
			status: 500
		});
	}
};