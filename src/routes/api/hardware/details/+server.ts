import { getAllHardwareDetails } from '$lib/server/services/hardware/hardware-details-service';

import type { RequestHandler } from './$types';

/**
 * GET /api/hardware/details
 * Returns comprehensive hardware details for WiFi, SDR, and GPS devices
 * Uses sysfs enumeration, iw commands, and gpsd queries
 */
export const GET: RequestHandler = async () => {
	const hardwareDetails = await getAllHardwareDetails();

	return new Response(JSON.stringify(hardwareDetails), {
		headers: { 'Content-Type': 'application/json' }
	});
};
