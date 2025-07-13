import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { KismetService } from '$lib/server/services';

export const GET: RequestHandler = async ({ fetch }) => {
	try {
		const response = await KismetService.getDevices(fetch);
		
		return json(response);
	} catch (error: unknown) {
		console.error('Error in Kismet devices endpoint:', error);
		return json({ 
			devices: [], 
			error: (error as { message?: string }).message || 'Unknown error',
			source: 'fallback' as const
		});
	}
};