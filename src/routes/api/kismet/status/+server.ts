import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fusionKismetController } from '$lib/server/kismet/fusion_controller';

export const GET: RequestHandler = async () => {
	try {
		const status = fusionKismetController.getStatus();
		
		return json({
			success: true,
			status: status.running ? 'running' : 'stopped',
			data: {
				running: status.running,
				interface: status.interface,
				channels: status.channels,
				deviceCount: status.deviceCount,
				uptime: status.uptime,
				startTime: status.startTime,
				monitorInterfaces: status.monitorInterfaces,
				metrics: status.metrics
			}
		});
		
	} catch (error) {
		console.error('Error getting Kismet status:', error);
		
		return json({
			success: false,
			status: 'error',
			error: error.message,
			data: {
				running: false,
				interface: null,
				channels: [],
				deviceCount: 0,
				uptime: 0
			}
		});
	}
};