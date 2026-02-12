import type { RequestHandler } from './$types';
import { getGpsPosition } from '$lib/server/services/gps/gps-position-service';

/**
 * GET /api/gps/position
 * Returns current GPS position with circuit breaker and caching
 */
export const GET: RequestHandler = async () => {
	const position = await getGpsPosition();

	return new Response(JSON.stringify(position), {
		headers: { 'Content-Type': 'application/json' }
	});
};
