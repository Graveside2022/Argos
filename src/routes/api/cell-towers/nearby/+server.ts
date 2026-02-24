import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { validateNumericParam } from '$lib/server/security/input-sanitizer';
import { findNearbyCellTowers } from '$lib/server/services/cell-towers/cell-tower-service';

/**
 * GET /api/cell-towers/nearby?lat=...&lon=...&radius=5
 * Returns cell towers within radius (km) of the given GPS position.
 */
export const GET = createHandler(async ({ url }) => {
	// Validate and extract parameters
	let lat: number, lon: number, radiusKm: number;
	try {
		lat = validateNumericParam(url.searchParams.get('lat'), 'latitude', -90, 90);
		lon = validateNumericParam(url.searchParams.get('lon'), 'longitude', -180, 180);
		radiusKm = validateNumericParam(url.searchParams.get('radius') || '5', 'radius', 0.1, 50);
	} catch (validationError) {
		return json(
			{
				success: false,
				towers: [],
				// Safe: Validation error from parameter checks cast to Error for message extraction
				message: `Invalid parameter: ${(validationError as Error).message}`
			},
			{ status: 400 }
		);
	}

	// Delegate to service
	const result = await findNearbyCellTowers(lat, lon, radiusKm);

	return result;
});
