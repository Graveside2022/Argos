/**
 * OpenCellID API Client
 *
 * Fetches cell tower data from the OpenCellID getInArea API using
 * a tiled approach to work around the 4 km² bbox limit.
 */

import type { CellTower } from '$lib/server/services/cell-towers/cell-tower-service';
import { logger } from '$lib/utils/logger';

// OpenCellID getInArea limits bbox to 4 km² (~2km x 2km).
// We tile a larger radius into ~1.5km x 1.5km tiles and fetch in parallel.
const TILE_SIZE_DEG = 0.014; // ~1.5 km at mid-latitudes

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

interface Tile {
	s: number;
	w: number;
	n: number;
	e: number;
}

/** Coerce a falsy number to 0 */
function n(val: number): number {
	return val || 0;
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
async function fetchTile(tile: Tile, apiKey: string): Promise<OpenCellIDCell[]> {
	const apiUrl = `https://opencellid.org/cell/getInArea?key=${apiKey}&BBOX=${tile.s},${tile.w},${tile.n},${tile.e}&format=json&limit=200`;
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

/**
 * Query OpenCellID API using tiled area requests for larger radii.
 * Returns null if no API key or no results.
 */
export async function queryOpenCellID(
	lat: number,
	lon: number,
	latDelta: number,
	lonDelta: number,
	apiKey: string
): Promise<CellTower[] | null> {
	if (!apiKey) {
		return null;
	}

	try {
		const tiles = buildTiles(lat - latDelta, lat + latDelta, lon - lonDelta, lon + lonDelta, 9);
		const tileResults = await Promise.allSettled(tiles.map((t) => fetchTile(t, apiKey)));
		const allTowers = mergeTileResults(tileResults);

		if (allTowers.length === 0) return null;

		allTowers.sort((a, b) => b.samples - a.samples);
		return allTowers.slice(0, 500);
	} catch (err) {
		logger.error('[cell-tower] OpenCellID tiled fetch error', {
			error: err instanceof Error ? err.message : String(err)
		});
	}

	return null;
}
