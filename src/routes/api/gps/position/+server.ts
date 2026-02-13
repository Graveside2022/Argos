import { GPSPositionSchema } from '$lib/gps/types';
import { getGpsPosition } from '$lib/server/services/gps/gps-position-service';
import { ApiResponseSchema } from '$lib/types/api';

import type { RequestHandler } from './$types';

/**
 * GET /api/gps/position
 * Returns current GPS position with circuit breaker and caching
 * Task: T028 - Constitutional Audit Remediation (P1)
 */
export const GET: RequestHandler = async () => {
	const position = await getGpsPosition();

	// Create the response schema: ApiResponse<GPSPosition>
	const ResponseSchema = ApiResponseSchema(GPSPositionSchema);

	// Validate response with Zod (T028)
	const validated = ResponseSchema.parse(position);

	return new Response(JSON.stringify(validated), {
		headers: { 'Content-Type': 'application/json' }
	});
};
