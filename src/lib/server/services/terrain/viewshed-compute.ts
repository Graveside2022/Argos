/**
 * Radial line-of-sight viewshed computation with PNG encoding.
 *
 * Sweeps 360 rays from the observer position, sampling terrain elevation
 * along each ray. Classifies cells as visible (green) or obstructed (red)
 * based on elevation angle tracking. Encodes the result as a PNG image.
 *
 * @module
 */

import { PNG } from 'pngjs';

import type { ViewshedBounds, ViewshedParams, ViewshedResult } from '$lib/types/viewshed';

import { getElevationFromTiles } from './dted-parser';
import type { DTEDTileIndex } from './dted-tile-index';

// ── Constants ────────────────────────────────────────────────────────

/** Meters per degree of latitude (constant at all latitudes) */
const METERS_PER_DEG_LAT = 111320;

/** Maximum output image dimension */
const MAX_IMAGE_DIM = 256;

/** Number of azimuth rays to sweep */
const NUM_RAYS = 360;

// ── RGBA pixel colors ───────────────────────────────────────────────

const VISIBLE_R = 0;
const VISIBLE_G = 200;
const VISIBLE_B = 0;

const OBSTRUCTED_R = 200;
const OBSTRUCTED_G = 0;
const OBSTRUCTED_B = 0;

// ── Public API ──────────────────────────────────────────────────────

/** Viewshed computation context passed through helper functions */
interface SweepContext {
	params: ViewshedParams;
	tiles: import('$lib/types/viewshed').DTEDTile[];
	observerHeight: number;
	metersPerDegLon: number;
	bounds: ViewshedBounds;
	/** Binary visibility grid: 1=visible, 2=obstructed, 0=empty */
	grid: Uint8Array;
	width: number;
	height: number;
	/** Terrain elevation MSL at observer (meters) — returned in meta when GPS mode active */
	terrainElevationM: number;
	/** Effective AGL used (meters) — returned in meta when GPS mode active */
	effectiveAglM: number;
}

/** Visibility grid values */
const VIS_EMPTY = 0;
const VIS_VISIBLE = 1;
const VIS_OBSTRUCTED = 2;

/** Single-entry terrain cache — stores the visibility grid for re-use when only opacity changes */
interface TerrainCache {
	key: string;
	grid: Uint8Array;
	bounds: ViewshedBounds;
	width: number;
	height: number;
	cellCount: number;
	tilesUsed: number;
}

let terrainCache: TerrainCache | null = null;

/** Reset the terrain cache. Exported for testing only. */
export function resetTerrainCache(): void {
	terrainCache = null;
}

function terrainCacheKey(lat: number, lon: number, heightAgl: number, radiusM: number): string {
	return `${Math.floor(lat * 1000)},${Math.floor(lon * 1000)},${heightAgl},${radiusM}`;
}

/**
 * Compute a terrain-aware viewshed from the given observer position.
 * Returns a base64-encoded PNG image with green (visible) and red (obstructed) cells.
 *
 * When terrain parameters (lat, lon, height, radius) match the cache,
 * skips the expensive ray sweep and only re-encodes with new opacity values.
 */
export function computeViewshed(params: ViewshedParams, tileIndex: DTEDTileIndex): ViewshedResult {
	const startTime = performance.now();

	const ctx = buildSweepContext(params, tileIndex);
	if (!ctx) return emptyResult();

	const tKey = terrainCacheKey(params.lat, params.lon, ctx.effectiveAglM, params.radiusM);
	const gpsMeta = resolveGpsMeta(params, ctx);

	// Fast path: terrain unchanged, only opacity differs — re-encode from cached grid
	const cached = tryReencodeFromCache(tKey, params, startTime, gpsMeta);
	if (cached) return cached;

	let cellCount = 0;
	for (let rayDeg = 0; rayDeg < NUM_RAYS; rayDeg++) {
		cellCount += sweepRay(ctx, rayDeg);
	}

	terrainCache = {
		key: tKey,
		grid: ctx.grid,
		bounds: ctx.bounds,
		width: ctx.width,
		height: ctx.height,
		cellCount,
		tilesUsed: ctx.tiles.length
	};

	return encodeResult(
		ctx.grid,
		ctx.width,
		ctx.height,
		ctx.bounds,
		params,
		startTime,
		cellCount,
		ctx.tiles.length,
		false,
		gpsMeta
	);
}

function resolveGpsMeta(params: ViewshedParams, ctx: SweepContext): Record<string, number> {
	if (params.gpsMslAltitude === undefined) return {};
	return { terrainElevationM: ctx.terrainElevationM, computedAglM: ctx.effectiveAglM };
}

function tryReencodeFromCache(
	tKey: string,
	params: ViewshedParams,
	startTime: number,
	gpsMeta: Record<string, number>
): ViewshedResult | null {
	if (!terrainCache || terrainCache.key !== tKey) return null;
	return encodeResult(
		terrainCache.grid,
		terrainCache.width,
		terrainCache.height,
		terrainCache.bounds,
		params,
		startTime,
		terrainCache.cellCount,
		terrainCache.tilesUsed,
		true,
		gpsMeta
	);
}

function encodeResult(
	grid: Uint8Array,
	width: number,
	height: number,
	bounds: ViewshedBounds,
	params: ViewshedParams,
	startTime: number,
	cellCount: number,
	tilesUsed: number,
	cached: boolean,
	gpsMeta: Record<string, number>
): ViewshedResult {
	const rgba = gridToRgba(grid, width, height, params.greenOpacity, params.redOpacity);
	return {
		imageDataUri: encodePng(rgba, width, height),
		bounds,
		meta: {
			computeTimeMs: Math.round(performance.now() - startTime),
			cellCount,
			tilesUsed,
			imageWidth: width,
			imageHeight: height,
			cached,
			...gpsMeta
		}
	};
}

/** Minimum AGL clamp — observer eyes can't be underground */
const MIN_AGL_M = 0.5;

/** Build sweep context: load tiles, resolve observer elevation, compute bounds + image dims */
function buildSweepContext(params: ViewshedParams, tileIndex: DTEDTileIndex): SweepContext | null {
	const tiles = tileIndex.getTilesForArea(params.lat, params.lon, params.radiusM);
	if (tiles.length === 0) return null;

	const observerElev = getElevationFromTiles(tiles, params.lat, params.lon);
	if (observerElev === null) return null;

	// When GPS MSL altitude is provided, derive AGL from terrain; otherwise use manual heightAgl
	const effectiveAgl =
		params.gpsMslAltitude !== undefined
			? Math.max(params.gpsMslAltitude - observerElev, MIN_AGL_M)
			: params.heightAgl;

	const metersPerDegLon = METERS_PER_DEG_LAT * Math.cos((params.lat * Math.PI) / 180);
	const degreesLat = params.radiusM / METERS_PER_DEG_LAT;
	const degreesLon = params.radiusM / metersPerDegLon;

	const width = MAX_IMAGE_DIM;
	const height = width;

	return {
		params,
		tiles,
		observerHeight: observerElev + effectiveAgl,
		metersPerDegLon,
		bounds: {
			north: params.lat + degreesLat,
			south: params.lat - degreesLat,
			east: params.lon + degreesLon,
			west: params.lon - degreesLon
		},
		grid: new Uint8Array(width * height),
		width,
		height,
		terrainElevationM: observerElev,
		effectiveAglM: effectiveAgl
	};
}

/** Sweep a single azimuth ray, returning the number of cells classified */
function sweepRay(ctx: SweepContext, rayDeg: number): number {
	const angleRad = (rayDeg * Math.PI) / 180;
	const cosA = Math.cos(angleRad);
	const sinA = Math.sin(angleRad);
	const sampleSpacing = (2 * ctx.params.radiusM) / ctx.width;

	let maxElevAngle = -Infinity;
	let cells = 0;

	for (let dist = sampleSpacing; dist <= ctx.params.radiusM; dist += sampleSpacing) {
		const sampLat = ctx.params.lat + (dist * cosA) / METERS_PER_DEG_LAT;
		const sampLon = ctx.params.lon + (dist * sinA) / ctx.metersPerDegLon;

		const sampElev = getElevationFromTiles(ctx.tiles, sampLat, sampLon);
		if (sampElev === null) continue;

		const elevAngle = Math.atan2(sampElev - ctx.observerHeight, dist);
		const isVisible = elevAngle >= maxElevAngle;
		maxElevAngle = Math.max(maxElevAngle, elevAngle);

		setPixel(ctx, sampLat, sampLon, isVisible);
		cells++;
	}
	return cells;
}

// ── Internal helpers ────────────────────────────────────────────────

/** Convert geographic position to grid index, or -1 if out of bounds */
function geoToGridIndex(ctx: SweepContext, lat: number, lon: number): number {
	const x = Math.floor(
		((lon - ctx.bounds.west) / (ctx.bounds.east - ctx.bounds.west)) * (ctx.width - 1)
	);
	const y = Math.floor(
		((ctx.bounds.north - lat) / (ctx.bounds.north - ctx.bounds.south)) * (ctx.height - 1)
	);

	if (x < 0 || x >= ctx.width || y < 0 || y >= ctx.height) return -1;
	return y * ctx.width + x;
}

/** Set a pixel in the visibility grid based on lat/lon position */
function setPixel(ctx: SweepContext, lat: number, lon: number, isVisible: boolean): void {
	const idx = geoToGridIndex(ctx, lat, lon);
	if (idx < 0 || ctx.grid[idx] !== VIS_EMPTY) return;
	ctx.grid[idx] = isVisible ? VIS_VISIBLE : VIS_OBSTRUCTED;
}

/** Write a single RGBA pixel into the buffer */
function writePixel(
	buf: Uint8Array,
	off: number,
	r: number,
	g: number,
	b: number,
	a: number
): void {
	buf[off] = r;
	buf[off + 1] = g;
	buf[off + 2] = b;
	buf[off + 3] = a;
}

/** Map a visibility cell to RGBA colour + alpha */
function cellToPixel(
	rgba: Uint8Array,
	off: number,
	vis: number,
	greenA: number,
	redA: number
): void {
	if (vis === VIS_VISIBLE) writePixel(rgba, off, VISIBLE_R, VISIBLE_G, VISIBLE_B, greenA);
	else writePixel(rgba, off, OBSTRUCTED_R, OBSTRUCTED_G, OBSTRUCTED_B, redA);
}

/** Convert a visibility grid to an RGBA buffer using the given opacity values */
function gridToRgba(
	grid: Uint8Array,
	width: number,
	height: number,
	greenOpacity: number,
	redOpacity: number
): Uint8Array {
	const rgba = new Uint8Array(width * height * 4);
	const greenA = Math.round(greenOpacity * 255);
	const redA = Math.round(redOpacity * 255);

	for (let i = 0; i < grid.length; i++) {
		if (grid[i] !== VIS_EMPTY) cellToPixel(rgba, i * 4, grid[i], greenA, redA);
	}
	return rgba;
}

/** Encode RGBA buffer as a base64 PNG data URI */
function encodePng(rgba: Uint8Array, width: number, height: number): string {
	const png = new PNG({ width, height, filterType: -1 });
	png.data = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
	const pngBuf = PNG.sync.write(png);
	return 'data:image/png;base64,' + pngBuf.toString('base64');
}

/** Return an empty result when no elevation data is available */
function emptyResult(): ViewshedResult {
	return {
		imageDataUri: null,
		bounds: { north: 0, south: 0, east: 0, west: 0 },
		meta: {
			computeTimeMs: 0,
			cellCount: 0,
			tilesUsed: 0,
			imageWidth: 0,
			imageHeight: 0,
			cached: false
		}
	};
}
