import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fusionKismetController } from '$lib/server/kismet/fusion_controller';

export const POST: RequestHandler = async ({ url }) => {
	try {
		console.warn('Starting Kismet WiFi discovery...');

		// Check if we're in development mode
		const isDevelopment = process.env.NODE_ENV === 'development';
		const useMock = url.searchParams.get('mock') === 'true';

		if (isDevelopment || useMock) {
			// Return mock success for development
			return json({
				success: true,
				status: 'started',
				message: 'Kismet WiFi discovery started (development mode)',
				data: {
					interface: 'wlan0',
					channels: [1, 6, 11],
					deviceCount: 0,
					uptime: 0
				}
			});
		}

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

		return json(
			{
				success: false,
				error: (error as Error).message,
				message: 'Failed to start Kismet'
			},
			{
				status: 500
			}
		);
	}
};
