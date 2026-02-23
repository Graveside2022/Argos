import { error, json } from '@sveltejs/kit';

import { errMsg } from '$lib/server/api/error-utils';
import { getRFDatabase } from '$lib/server/db/database';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

/** Read a float search param with a fallback default. */
function floatParam(sp: URLSearchParams, key: string, fallback: string): number {
	return parseFloat(sp.get(key) || fallback);
}

/** Read an integer search param with a fallback default. */
function intParam(sp: URLSearchParams, key: string, fallback: string): number {
	return parseInt(sp.get(key) || fallback);
}

/** Shape of raw database statistics rows. */
interface RawAreaStatistics {
	total_signals?: number;
	unique_devices?: number;
	avg_power?: number;
	min_power?: number;
	max_power?: number;
	freq_bands?: number;
}

/** Parse geographic bounds from URL search params. */
function parseBoundsParams(searchParams: URLSearchParams) {
	return {
		minLat: floatParam(searchParams, 'minLat', '-90'),
		maxLat: floatParam(searchParams, 'maxLat', '90'),
		minLon: floatParam(searchParams, 'minLon', '-180'),
		maxLon: floatParam(searchParams, 'maxLon', '180')
	};
}

/** Return a numeric value or 0 if undefined/null. */
function numOrZero(value: number | undefined): number {
	return value || 0;
}

/** Format raw database statistics into the API response shape. */
function formatStatisticsResponse(stats: RawAreaStatistics, timeWindow: number) {
	return {
		totalSignals: numOrZero(stats.total_signals),
		uniqueDevices: numOrZero(stats.unique_devices),
		avgPower: numOrZero(stats.avg_power),
		minPower: numOrZero(stats.min_power),
		maxPower: numOrZero(stats.max_power),
		freqBands: numOrZero(stats.freq_bands),
		timeRange: {
			start: Date.now() - timeWindow,
			end: Date.now()
		}
	};
}

export const GET: RequestHandler = ({ url }) => {
	try {
		const db = getRFDatabase();
		const timeWindow = intParam(url.searchParams, 'timeWindow', '3600000');
		const bounds = parseBoundsParams(url.searchParams);

		const stats = db.getAreaStatistics(bounds, timeWindow);
		return json(formatStatisticsResponse(stats as RawAreaStatistics, timeWindow));
	} catch (err: unknown) {
		logger.error('Error getting statistics', { error: errMsg(err) });
		return error(500, 'Failed to get statistics');
	}
};
