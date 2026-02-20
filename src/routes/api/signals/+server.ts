import { error, json } from '@sveltejs/kit';

import { getRFDatabase } from '$lib/server/db/database';
import type { SignalMarker } from '$lib/types/signals';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	try {
		logger.debug('GET /api/signals - Starting request');
		const db = getRFDatabase();
		logger.debug('Database instance created');

		// Parse query parameters
		const lat = parseFloat(url.searchParams.get('lat') || '0');
		const lon = parseFloat(url.searchParams.get('lon') || '0');
		const radiusMeters = parseFloat(url.searchParams.get('radiusMeters') || '1000');
		const startTime = parseInt(url.searchParams.get('startTime') || '0');
		const endTime = parseInt(url.searchParams.get('endTime') || String(Date.now()));
		const limit = parseInt(url.searchParams.get('limit') || '1000');

		logger.debug('Signal query params', { lat, lon, radiusMeters, startTime, endTime, limit });

		// Execute spatial query
		const signals = db.findSignalsInRadius({
			lat,
			lon,
			radiusMeters,
			startTime,
			endTime,
			limit
		});

		logger.debug('Found signals', { count: signals.length });
		return json({ signals });
	} catch (err: unknown) {
		logger.error('Error querying signals', {
			error: err instanceof Error ? err.message : String(err)
		});
		return error(500, 'Failed to query signals');
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const db = getRFDatabase();
		// Safe: Request body validated as SignalMarker type before database insertion
		const signal = (await request.json()) as SignalMarker;

		// Store signal in database
		const dbSignal = db.insertSignal(signal);

		return json({
			success: true,
			id: dbSignal.id
		});
	} catch (err: unknown) {
		logger.error('Error storing signal', {
			error: err instanceof Error ? err.message : String(err)
		});
		return error(500, 'Failed to store signal');
	}
};
