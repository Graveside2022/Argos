import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { env } from '$lib/server/env';
import { DTEDTileIndex } from '$lib/server/services/terrain/dted-tile-index';
import { computeViewshed } from '$lib/server/services/terrain/viewshed-compute';

// ── Zod validation schema ───────────────────────────────────────────

const viewshedRequestSchema = z.object({
	lat: z.number().min(-90).max(90),
	lon: z.number().min(-180).max(180),
	heightAgl: z.number().min(0.5).max(100).default(2.0),
	radiusM: z.number().min(100).max(50000).default(5000),
	greenOpacity: z.number().min(0).max(1).default(0.37),
	redOpacity: z.number().min(0).max(1).default(0.92),
	noCache: z.boolean().optional()
});

// ── Singleton tile index ────────────────────────────────────────────

let tileIndex: DTEDTileIndex | null = null;

function getTileIndex(): DTEDTileIndex {
	if (!tileIndex) {
		tileIndex = new DTEDTileIndex(env.DTED_DATA_DIR);
	}
	return tileIndex;
}

// ── Result cache (single most-recent result) ────────────────────────

interface CachedResult {
	key: string;
	result: {
		imageDataUri: string;
		bounds: { north: number; south: number; east: number; west: number };
		meta: {
			computeTimeMs: number;
			cellCount: number;
			tilesUsed: number;
			imageWidth: number;
			imageHeight: number;
			cached: boolean;
		};
	};
}

let cachedResult: CachedResult | null = null;

function buildCacheKey(params: {
	lat: number;
	lon: number;
	heightAgl: number;
	radiusM: number;
	greenOpacity: number;
	redOpacity: number;
}): string {
	return [
		Math.floor(params.lat * 1000),
		Math.floor(params.lon * 1000),
		params.heightAgl,
		params.radiusM,
		params.greenOpacity,
		params.redOpacity
	].join(',');
}

// ── Response builders ────────────────────────────────────────────────

function validationErrorResponse(issues: { path: (string | number)[]; message: string }[]) {
	return json(
		{
			error: 'Validation failed',
			details: issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
		},
		{ status: 400 }
	);
}

function noCoverageResponse(lat: number, lon: number) {
	return json({
		imageDataUri: null,
		bounds: null,
		meta: {
			computeTimeMs: 0,
			cellCount: 0,
			tilesUsed: 0,
			imageWidth: 0,
			imageHeight: 0,
			cached: false
		},
		reason: `No DTED elevation data available for coordinates (${lat.toFixed(3)}, ${lon.toFixed(3)}).`
	});
}

/** Check if the cache holds a matching result */
function getCachedResult(key: string, noCache?: boolean): CachedResult['result'] | null {
	if (noCache) return null;
	if (cachedResult?.key !== key) return null;
	return { ...cachedResult.result, meta: { ...cachedResult.result.meta, cached: true } };
}

// ── POST handler ────────────────────────────────────────────────────

export const POST = createHandler(
	async ({ request }) => {
		const parsed = viewshedRequestSchema.safeParse(await request.json());
		if (!parsed.success) return validationErrorResponse(parsed.error.issues);

		const params = parsed.data;
		const index = getTileIndex();

		if (!index.hasTile(params.lat, params.lon)) {
			return noCoverageResponse(params.lat, params.lon);
		}

		const cacheKey = buildCacheKey(params);
		const cached = getCachedResult(cacheKey, params.noCache);
		if (cached) return json(cached);

		const result = computeViewshed(params, index);
		cachedResult = { key: cacheKey, result };
		return json(result);
	},
	{ method: 'POST /api/viewshed/compute' }
);
