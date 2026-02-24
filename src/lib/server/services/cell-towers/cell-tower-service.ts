import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { env } from '$lib/server/env';
import { queryOpenCellID } from '$lib/server/services/cell-towers/opencellid-client';
import { logger } from '$lib/utils/logger';

interface TowerRow {
	radio: string;
	mcc: number;
	net: number;
	area: number;
	cell: number;
	lat: number;
	lon: number;
	range: number;
	samples: number;
	created: number;
	updated: number;
	averageSignal: number;
}

/** Coerce a falsy number to 0 */
function n(val: number): number {
	return val || 0;
}

/** Convert a SQLite TowerRow to a CellTower */
function rowToTower(r: TowerRow): CellTower {
	return {
		radio: r.radio || 'Unknown',
		mcc: r.mcc,
		mnc: r.net,
		lac: r.area,
		ci: r.cell,
		lat: r.lat,
		lon: r.lon,
		range: n(r.range),
		samples: n(r.samples),
		updated: n(r.updated),
		avgSignal: n(r.averageSignal)
	};
}

export interface CellTower {
	radio: string;
	mcc: number;
	mnc: number;
	lac: number;
	ci: number;
	lat: number;
	lon: number;
	range: number;
	samples: number;
	updated: number;
	avgSignal: number;
}

export interface CellTowerResult {
	success: boolean;
	source?: 'database' | 'opencellid-api';
	towers: CellTower[];
	count: number;
	message?: string;
}

/**
 * Convert kilometers to degree deltas for bounding box calculations
 */
function calculateBoundingBox(lat: number, radiusKm: number) {
	const latDelta = radiusKm / 111.32;
	const lonDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
	return { latDelta, lonDelta };
}

/**
 * Query local SQLite database for cell towers within bounding box
 */
async function queryLocalDatabase(
	lat: number,
	lon: number,
	latDelta: number,
	lonDelta: number
): Promise<CellTowerResult | null> {
	const dbPaths = [path.join(process.cwd(), 'data', 'celltowers', 'towers.db')];

	for (const dbPath of dbPaths) {
		if (!fs.existsSync(dbPath)) continue;

		try {
			const db = new Database(dbPath, { readonly: true });

			const rows = db
				.prepare(
					`SELECT radio, mcc, net, area, cell, lat, lon, range, samples, updated, averageSignal
				FROM towers
				WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?
				ORDER BY samples DESC
				LIMIT 500`
				)
				.all(lat - latDelta, lat + latDelta, lon - lonDelta, lon + lonDelta);

			db.close();

			return {
				success: true,
				source: 'database',
				towers: (rows as TowerRow[]).map(rowToTower),
				count: rows.length
			};
		} catch (dbErr) {
			logger.warn('[cell-tower] Database query failed', {
				dbPath,
				error: dbErr instanceof Error ? dbErr.message : String(dbErr)
			});
		}
	}

	return null;
}

/**
 * Find cell towers near a GPS position
 * Tries local database first, falls back to OpenCellID API
 *
 * @param lat Latitude (-90 to 90)
 * @param lon Longitude (-180 to 180)
 * @param radiusKm Search radius in kilometers (0.1 to 50)
 * @returns Cell tower data with source and count
 */
export async function findNearbyCellTowers(
	lat: number,
	lon: number,
	radiusKm: number
): Promise<CellTowerResult> {
	const { latDelta, lonDelta } = calculateBoundingBox(lat, radiusKm);

	// Try local database first
	const dbResult = await queryLocalDatabase(lat, lon, latDelta, lonDelta);
	if (dbResult) {
		return dbResult;
	}

	// Fallback to OpenCellID API
	const apiKey = env.OPENCELLID_API_KEY ?? '';
	const towers = await queryOpenCellID(lat, lon, latDelta, lonDelta, apiKey);
	if (towers) {
		return { success: true, source: 'opencellid-api', towers, count: towers.length };
	}

	// No results from either source
	return {
		success: false,
		towers: [],
		count: 0,
		message: !apiKey
			? 'No cell tower database found and OPENCELLID_API_KEY not configured'
			: 'No cell tower database found and API returned no results'
	};
}
