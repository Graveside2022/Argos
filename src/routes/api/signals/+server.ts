import { createHandler } from '$lib/server/api/create-handler';
import { getRFDatabase } from '$lib/server/db/database';
import type { SignalMarker } from '$lib/types/signals';
import { logger } from '$lib/utils/logger';

/** Read a float search param with a fallback default. */
function floatParam(sp: URLSearchParams, key: string, fallback: string): number {
	return parseFloat(sp.get(key) || fallback);
}

/** Read an integer search param with a fallback default. */
function intParam(sp: URLSearchParams, key: string, fallback: string): number {
	return parseInt(sp.get(key) || fallback);
}

/** Parse signal spatial query parameters from URL search params. */
function parseSignalQueryParams(searchParams: URLSearchParams) {
	return {
		lat: floatParam(searchParams, 'lat', '0'),
		lon: floatParam(searchParams, 'lon', '0'),
		radiusMeters: floatParam(searchParams, 'radiusMeters', '1000'),
		startTime: intParam(searchParams, 'startTime', '0'),
		endTime: intParam(searchParams, 'endTime', String(Date.now())),
		limit: intParam(searchParams, 'limit', '1000')
	};
}

export const GET = createHandler(({ url }) => {
	logger.debug('GET /api/signals - Starting request');
	const db = getRFDatabase();
	const params = parseSignalQueryParams(url.searchParams);
	const signals = db.findSignalsInRadius(params);
	logger.debug('Found signals', { count: signals.length });
	return { signals };
});

export const POST = createHandler(async ({ request }) => {
	const db = getRFDatabase();
	const signal = (await request.json()) as SignalMarker;
	const dbSignal = db.insertSignal(signal);
	return { success: true, id: dbSignal.id };
});
