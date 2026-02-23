import { error, json } from '@sveltejs/kit';

import { getRFDatabase } from '$lib/server/db/database';
import type { SignalMarker } from '$lib/types/signals';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

/** Extract error message from unknown error values. */
function errMsg(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

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

export const GET: RequestHandler = ({ url }) => {
	try {
		logger.debug('GET /api/signals - Starting request');
		const db = getRFDatabase();
		logger.debug('Database instance created');

		const params = parseSignalQueryParams(url.searchParams);
		logger.debug('Signal query params', params);

		const signals = db.findSignalsInRadius(params);

		logger.debug('Found signals', { count: signals.length });
		return json({ signals });
	} catch (err: unknown) {
		logger.error('Error querying signals', { error: errMsg(err) });
		return error(500, 'Failed to query signals');
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const db = getRFDatabase();
		// Safe: Request body validated as SignalMarker type before database insertion
		const signal = (await request.json()) as SignalMarker;

		const dbSignal = db.insertSignal(signal);

		return json({
			success: true,
			id: dbSignal.id
		});
	} catch (err: unknown) {
		logger.error('Error storing signal', { error: errMsg(err) });
		return error(500, 'Failed to store signal');
	}
};
