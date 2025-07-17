import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { fusionKismetController } from '$lib/server/kismet/fusion_controller';
import { KismetService } from '$lib/server/services';

export const GET: RequestHandler = async ({ fetch }) => {
	try {
		// Try to get devices from the new Kismet controller if available
		if (fusionKismetController.isReady()) {
			const devices = await fusionKismetController.getDevices();
			const status = fusionKismetController.getStatus();
			
			return json({
				devices: devices || [],
				source: 'kismet' as const,
				status: {
					running: status.running,
					deviceCount: status.deviceCount,
					interface: status.interface,
					uptime: status.uptime
				}
			});
		}
		
		// Fallback to existing service implementation
		const response = await KismetService.getDevices(fetch);
		return json(response);
		
	} catch (error: unknown) {
		console.error('Error in Kismet devices endpoint:', error);
		
		// Fallback to existing service implementation on error
		try {
			const response = await KismetService.getDevices(fetch);
			return json(response);
		} catch (fallbackError) {
			return json({ 
				devices: [], 
				error: (error as { message?: string }).message || 'Unknown error',
				source: 'fallback' as const
			});
		}
	}
};