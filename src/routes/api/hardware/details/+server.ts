import { createHandler } from '$lib/server/api/create-handler';
import { getAllHardwareDetails } from '$lib/server/services/hardware/hardware-details-service';

/**
 * GET /api/hardware/details
 * Returns comprehensive hardware details for WiFi, SDR, and GPS devices
 * Uses sysfs enumeration, iw commands, and gpsd queries
 */
export const GET = createHandler(async () => {
	return getAllHardwareDetails();
});
