import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fusionKismetController } from '$lib/server/kismet/fusion_controller';

export const POST: RequestHandler = async () => {
	try {
		console.log('Stopping Kismet WiFi discovery...');
		
		await fusionKismetController.stop();
		
		return json({
			success: true,
			status: 'stopped',
			message: 'Kismet WiFi discovery stopped successfully'
		});
		
	} catch (error) {
		console.error('Kismet stop error:', error);
		
		return json({
			success: false,
			error: (error as Error).message,
			message: 'Failed to stop Kismet'
		}, {
			status: 500
		});
	}
};