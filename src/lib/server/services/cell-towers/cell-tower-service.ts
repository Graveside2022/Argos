import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { env } from '$lib/server/env';
import { logger } from '$lib/utils/logger';

// OpenCellID getInArea limits bbox to 4 km² (~2km x 2km).
// We tile a larger radius into ~1.5km x 1.5km tiles and fetch in parallel.
const TILE_SIZE_DEG = 0.014; // ~1.5 km at mid-latitudes
const OPENCELLID_API_KEY = env.OPENCELLID_API_KEY;

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

/** Raw cell record shape from OpenCellID getInArea API response. */
interface OpenCellIDCell {
	radio?: string;
	mcc: number;
	mnc: number;
	lac: number;
	/** Cell ID — may appear as cellid, cid, or cell depending on API version. */
	cellid?: number;
	cid?: number;
	cell?: number;
	lat: number;
	lon: number;
	range?: number;
	samples?: number;
	updated?: number;
	averageSignalStrength?: number;
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

interface Tile {
	s: number;
	w: number;
	n: number;
	e: number;
}

/** Build tile bounding boxes from outer bbox, capped at maxTiles */
function buildTiles(
	south: number,
	north: number,
	west: number,
	east: number,
	maxTiles: number
): Tile[] {
	const tiles: Tile[] = [];
	for (let tLat = south; tLat < north; tLat += TILE_SIZE_DEG) {
		for (let tLon = west; tLon < east; tLon += TILE_SIZE_DEG) {
			tiles.push({
				s: tLat,
				w: tLon,
				n: Math.min(tLat + TILE_SIZE_DEG, north),
				e: Math.min(tLon + TILE_SIZE_DEG, east)
			});
		}
	}
	return tiles.slice(0, maxTiles);
}

/** Fetch a single OpenCellID tile, returning cell objects or empty array */
async function fetchTile(tile: Tile): Promise<OpenCellIDCell[]> {
	const apiUrl = `https://opencellid.org/cell/getInArea?key=${OPENCELLID_API_KEY}&BBOX=${tile.s},${tile.w},${tile.n},${tile.e}&format=json&limit=200`;
	const res = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
	if (!res.ok) return [];
	const data = await res.json();
	return Array.isArray(data.cells) ? (data.cells as OpenCellIDCell[]) : [];
}

/** Extract cell ID from a raw API cell object */
function extractCellId(c: OpenCellIDCell): number {
	return c.cellid || c.cid || c.cell || 0;
}

/** Extract optional numeric metadata fields from a raw API cell. */
function extractCellMeta(
	c: OpenCellIDCell
): Pick<CellTower, 'range' | 'samples' | 'updated' | 'avgSignal'> {
	return {
		range: n(c.range ?? 0),
		samples: n(c.samples ?? 0),
		updated: n(c.updated ?? 0),
		avgSignal: n(c.averageSignalStrength ?? 0)
	};
}

/** Convert a raw OpenCellID API cell to a CellTower */
function apiCellToTower(c: OpenCellIDCell, ci: number): CellTower {
	return {
		radio: c.radio || 'Unknown',
		mcc: c.mcc,
		mnc: c.mnc,
		lac: c.lac,
		ci,
		lat: c.lat,
		lon: c.lon,
		...extractCellMeta(c)
	};
}

/** Extract fulfilled cell arrays, flattening into a single list */
function flattenFulfilledCells(
	tileResults: PromiseSettledResult<OpenCellIDCell[]>[]
): OpenCellIDCell[] {
	return tileResults
		.filter((r): r is PromiseFulfilledResult<OpenCellIDCell[]> => r.status === 'fulfilled')
		.flatMap((r) => r.value);
}

/** Deduplicate cell records by MCC+MNC+LAC+CI */
function deduplicateCells(cells: OpenCellIDCell[]): CellTower[] {
	const seen = new Set<string>();
	const towers: CellTower[] = [];
	for (const c of cells) {
		const ci = extractCellId(c);
		const key = `${c.mcc}-${c.mnc}-${c.lac}-${ci}`;
		if (seen.has(key)) continue;
		seen.add(key);
		towers.push(apiCellToTower(c, ci));
	}
	return towers;
}

/** Merge and deduplicate tile results by MCC+MNC+LAC+CI */
function mergeTileResults(tileResults: PromiseSettledResult<OpenCellIDCell[]>[]): CellTower[] {
	return deduplicateCells(flattenFulfilledCells(tileResults));
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
			// Safe: Error handling
			logger.warn('[cell-tower] Database query failed', {
				dbPath,
				error: (dbErr as Error).message
			});
		}
	}

	return null;
}

/**
 * Query OpenCellID API using tiled area requests for larger radii
 */
async function queryOpenCellID(
	lat: number,
	lon: number,
	latDelta: number,
	lonDelta: number
): Promise<CellTowerResult | null> {
	if (!OPENCELLID_API_KEY) {
		return null;
	}

	try {
		const tiles = buildTiles(lat - latDelta, lat + latDelta, lon - lonDelta, lon + lonDelta, 9);
		const tileResults = await Promise.allSettled(tiles.map(fetchTile));
		const allTowers = mergeTileResults(tileResults);

		if (allTowers.length === 0) return null;

		allTowers.sort((a, b) => b.samples - a.samples);
		const capped = allTowers.slice(0, 500);
		return { success: true, source: 'opencellid-api', towers: capped, count: capped.length };
	} catch (err) {
		logger.error('[cell-tower] OpenCellID tiled fetch error', {
			error: err instanceof Error ? err.message : String(err)
		});
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
	// Calculate bounding box
	const { latDelta, lonDelta } = calculateBoundingBox(lat, radiusKm);

	// Try local database first
	const dbResult = await queryLocalDatabase(lat, lon, latDelta, lonDelta);
	if (dbResult) {
		return dbResult;
	}

	// Fallback to OpenCellID API
	const apiResult = await queryOpenCellID(lat, lon, latDelta, lonDelta);
	if (apiResult) {
		return apiResult;
	}

	// No results from either source
	return {
		success: false,
		towers: [],
		count: 0,
		message: !OPENCELLID_API_KEY
			? 'No cell tower database found and OPENCELLID_API_KEY not configured'
			: 'No cell tower database found and API returned no results'
	};
}
