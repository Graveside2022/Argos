import { getSatelliteData } from '$lib/server/services/gps/gps-satellite-service';

import type { RequestHandler } from './$types';

/**
 * GET /api/gps/satellites
 * Returns visible GPS satellites from gpsd (constellation, signal strength, position)
 * Uses circuit breaker and caching for reliability
 */
export const GET: RequestHandler = async () => {
	const response = await getSatelliteData();

	return new Response(JSON.stringify(response), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
};
