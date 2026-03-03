/**
 * POST /api/rf-propagation/route
 *
 * Computes path loss from a transmitter to each waypoint along a route.
 * Uses CloudRF /path endpoint for each waypoint pair.
 */

import { json } from '@sveltejs/kit';
import type { z } from 'zod';

import { RouteRequestSchema } from '$lib/schemas/rf-propagation';
import { createHandler } from '$lib/server/api/create-handler';
import { CloudRFError, computePath } from '$lib/server/services/cloudrf/cloudrf-client';
import type { RouteSegment } from '$lib/types/rf-propagation';
import { safeParseWithHandling } from '$lib/utils/validation-error';

type ValidatedRoute = z.infer<typeof RouteRequestSchema>;

/** Parse and validate request JSON; returns null with a response on failure */
async function parseRouteRequest(request: Request) {
	let rawBody: unknown;
	try {
		rawBody = await request.json();
	} catch {
		return {
			validated: null as ValidatedRoute | null,
			errorResponse: json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
		};
	}
	const validated = safeParseWithHandling(RouteRequestSchema, rawBody, 'api');
	if (!validated) {
		return {
			validated: null as ValidatedRoute | null,
			errorResponse: json({ success: false, error: 'Invalid route request' }, { status: 400 })
		};
	}
	return { validated, errorResponse: null };
}

/** Compute all route segments and accumulate max distance */
async function computeRouteSegments(validated: ValidatedRoute) {
	const segments: RouteSegment[] = [];
	let totalDistanceM = 0;

	for (const [lat, lon] of validated.waypoints) {
		const result = await computePath({
			txLat: validated.txLat,
			txLon: validated.txLon,
			rxLat: lat,
			rxLon: lon,
			frequency: validated.frequency,
			polarization: validated.polarization,
			txHeight: validated.txHeight,
			rxHeight: validated.rxHeight
		});

		totalDistanceM = Math.max(totalDistanceM, result.distanceM);
		segments.push({
			lat,
			lon,
			distanceFromTx: result.distanceM,
			loss: result.lossAtRx,
			elevation: result.elevationProfile[result.elevationProfile.length - 1] ?? 0,
			error: result.error
		});
	}

	return { segments, totalDistanceM };
}

export const POST = createHandler(async ({ request }) => {
	const { validated, errorResponse } = await parseRouteRequest(request);
	if (!validated) return errorResponse;

	try {
		const { segments, totalDistanceM } = await computeRouteSegments(validated);
		return { success: true, segments, totalDistanceM };
	} catch (err: unknown) {
		if (err instanceof CloudRFError) {
			return json({ success: false, error: err.message }, { status: err.statusCode });
		}
		throw err;
	}
});
