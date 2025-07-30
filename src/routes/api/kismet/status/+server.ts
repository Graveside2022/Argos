import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fusionKismetController } from '$lib/server/kismet/fusion_controller';

export const GET: RequestHandler = async ({ url }) => {
	try {
		// Check if we're in development mode
		const isDevelopment = process.env.NODE_ENV === 'development';
		const useMock = url.searchParams.get('mock') === 'true';

		if (isDevelopment || useMock) {
			// Return mock status for development
			return json({
				success: true,
				running: false, // Show as stopped initially in dev mode
				status: 'inactive',
				data: {
					running: false,
					interface: 'wlan0',
					channels: [1, 6, 11],
					deviceCount: 0,
					uptime: 0,
					startTime: null,
					monitorInterfaces: [],
					metrics: {}
				}
			});
		}

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
			error: (error as Error).message,
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
