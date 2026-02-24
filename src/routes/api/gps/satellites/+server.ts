import { createHandler } from '$lib/server/api/create-handler';
import { getSatelliteData } from '$lib/server/services/gps/gps-satellite-service';

/**
 * GET /api/gps/satellites
 * Returns visible GPS satellites from gpsd (constellation, signal strength, position)
 * Uses circuit breaker and caching for reliability
 */
export const GET = createHandler(async () => {
	const response = await getSatelliteData();
	return response;
});
