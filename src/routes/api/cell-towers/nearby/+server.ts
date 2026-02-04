import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const OPENCELLID_API_KEY = 'pk.d6291c07a2907c915cd8994fb22bc189';

// OpenCellID getInArea limits bbox to 4 km² (~2km x 2km).
// We tile a larger radius into ~1.5km x 1.5km tiles and fetch in parallel.
const TILE_SIZE_DEG = 0.014; // ~1.5 km at mid-latitudes

interface CellTower {
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

/**
 * GET /api/cell-towers/nearby?lat=...&lon=...&radius=5
 * Returns cell towers within radius (km) of the given GPS position.
 * Tries local OpenCellID database first, falls back to tiled API area queries.
 */
export const GET: RequestHandler = async ({ url }) => {
	const lat = parseFloat(url.searchParams.get('lat') || '0');
	const lon = parseFloat(url.searchParams.get('lon') || '0');
	const radiusKm = Math.min(parseFloat(url.searchParams.get('radius') || '5'), 20);

	if (lat === 0 && lon === 0) {
		return json({ success: false, towers: [], message: 'No GPS position provided' });
	}

	// Convert km to approximate degree deltas for bounding box
	const latDelta = radiusKm / 111.32;
	const lonDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));

	// Try local database first
	const dbPaths = [
		path.join(process.cwd(), 'data', 'celltowers', 'towers.db'),
		'/home/ubuntu/projects/Argos/data/celltowers/towers.db',
		'/home/kali/Documents/Argos/Argos/data/celltowers/towers.db'
	];

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

			return json({
				success: true,
				source: 'database',
				towers: (rows as any[]).map((r) => ({
					radio: r.radio || 'Unknown',
					mcc: r.mcc,
					mnc: r.net,
					lac: r.area,
					ci: r.cell,
					lat: r.lat,
					lon: r.lon,
					range: r.range || 0,
					samples: r.samples || 0,
					updated: r.updated || 0,
					avgSignal: r.averageSignal || 0
				})),
				count: rows.length
			});
		} catch (dbErr) {
			console.log(`Cell tower DB at ${dbPath} failed:`, (dbErr as Error).message);
		}
	}

	// Fallback: OpenCellID getInArea API with tiled requests
	// The API limits each request to 4 km² (~2km x 2km bbox).
	// We break the full radius into small tiles and fetch them in parallel.
	try {
		const south = lat - latDelta;
		const north = lat + latDelta;
		const west = lon - lonDelta;
		const east = lon + lonDelta;

		// Build tile bounding boxes
		const tiles: { s: number; w: number; n: number; e: number }[] = [];
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

		// Cap tile count to stay within API rate limits (5000/day).
		// 9 tiles covers ~2km radius adequately.
		const maxTiles = 9;
		const tileBatch = tiles.slice(0, maxTiles);

		// Fetch all tiles in parallel
		const tileResults = await Promise.allSettled(
			tileBatch.map(async (t) => {
				const apiUrl = `https://opencellid.org/cell/getInArea?key=${OPENCELLID_API_KEY}&BBOX=${t.s},${t.w},${t.n},${t.e}&format=json&limit=200`;
				const res = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
				if (!res.ok) return [];
				const data = await res.json();
				if (data.cells && Array.isArray(data.cells)) return data.cells;
				return [];
			})
		);

		// Merge and deduplicate by MCC+MNC+LAC+CI
		const seen = new Set<string>();
		const allTowers: CellTower[] = [];

		for (const result of tileResults) {
			if (result.status !== 'fulfilled') continue;
			for (const c of result.value) {
				const ci = c.cellid || c.cid || c.cell || 0;
				const key = `${c.mcc}-${c.mnc}-${c.lac}-${ci}`;
				if (seen.has(key)) continue;
				seen.add(key);
				allTowers.push({
					radio: c.radio || 'Unknown',
					mcc: c.mcc,
					mnc: c.mnc,
					lac: c.lac,
					ci,
					lat: c.lat,
					lon: c.lon,
					range: c.range || 0,
					samples: c.samples || 0,
					updated: c.updated || 0,
					avgSignal: c.averageSignalStrength || 0
				});
			}
		}

		if (allTowers.length > 0) {
			// Sort by samples descending, cap at 500
			allTowers.sort((a, b) => b.samples - a.samples);
			const capped = allTowers.slice(0, 500);

			return json({
				success: true,
				source: 'opencellid-api',
				towers: capped,
				count: capped.length
			});
		}
	} catch (err) {
		console.error('OpenCellID tiled fetch error:', err);
	}

	return json({
		success: false,
		towers: [],
		message: 'No cell tower database found and API returned no results'
	});
};
