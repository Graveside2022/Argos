import { createHandler } from '$lib/server/api/create-handler';
import { getGpsPosition } from '$lib/server/services/gps/gps-position-service';

/**
 * GET /api/gps/position
 * Returns current GPS position with circuit breaker and caching
 */
export const GET = createHandler(async () => {
	const position = await getGpsPosition();

	return new Response(JSON.stringify(position), {
		status: position.success ? 200 : 503,
		headers: { 'Content-Type': 'application/json' }
	});
});
