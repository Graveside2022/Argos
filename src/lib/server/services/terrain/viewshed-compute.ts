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

/** DTED Level 0 post spacing in meters (~900m at equator) */
const POST_SPACING_M = 900;

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
	rgba: Uint8Array;
	width: number;
	height: number;
}

/**
 * Compute a terrain-aware viewshed from the given observer position.
 * Returns a base64-encoded PNG image with green (visible) and red (obstructed) cells.
 */
export function computeViewshed(params: ViewshedParams, tileIndex: DTEDTileIndex): ViewshedResult {
	const startTime = performance.now();

	const ctx = buildSweepContext(params, tileIndex);
	if (!ctx) return emptyResult();

	let cellCount = 0;
	for (let rayDeg = 0; rayDeg < NUM_RAYS; rayDeg++) {
		cellCount += sweepRay(ctx, rayDeg);
	}

	const imageDataUri = encodePng(ctx.rgba, ctx.width, ctx.height);
	const computeTimeMs = Math.round(performance.now() - startTime);

	return {
		imageDataUri,
		bounds: ctx.bounds,
		meta: {
			computeTimeMs,
			cellCount,
			tilesUsed: ctx.tiles.length,
			imageWidth: ctx.width,
			imageHeight: ctx.height,
			cached: false
		}
	};
}

/** Build sweep context: load tiles, resolve observer elevation, compute bounds + image dims */
function buildSweepContext(params: ViewshedParams, tileIndex: DTEDTileIndex): SweepContext | null {
	const tiles = tileIndex.getTilesForArea(params.lat, params.lon, params.radiusM);
	if (tiles.length === 0) return null;

	const observerElev = getElevationFromTiles(tiles, params.lat, params.lon);
	if (observerElev === null) return null;

	const metersPerDegLon = METERS_PER_DEG_LAT * Math.cos((params.lat * Math.PI) / 180);
	const degreesLat = params.radiusM / METERS_PER_DEG_LAT;
	const degreesLon = params.radiusM / metersPerDegLon;

	const rawDim = Math.ceil((2 * params.radiusM) / (POST_SPACING_M / 2));
	const width = Math.min(rawDim, MAX_IMAGE_DIM);
	const height = width;

	return {
		params,
		tiles,
		observerHeight: observerElev + params.heightAgl,
		metersPerDegLon,
		bounds: {
			north: params.lat + degreesLat,
			south: params.lat - degreesLat,
			east: params.lon + degreesLon,
			west: params.lon - degreesLon
		},
		rgba: new Uint8Array(width * height * 4),
		width,
		height
	};
}

/** Sweep a single azimuth ray, returning the number of cells classified */
function sweepRay(ctx: SweepContext, rayDeg: number): number {
	const angleRad = (rayDeg * Math.PI) / 180;
	const cosA = Math.cos(angleRad);
	const sinA = Math.sin(angleRad);
	const sampleSpacing = POST_SPACING_M / 2;

	let maxElevAngle = -Infinity;
	let cells = 0;

	for (let dist = sampleSpacing; dist <= ctx.params.radiusM; dist += sampleSpacing) {
		const sampLat = ctx.params.lat + (dist * cosA) / METERS_PER_DEG_LAT;
		const sampLon = ctx.params.lon + (dist * sinA) / ctx.metersPerDegLon;

		const sampElev = getElevationFromTiles(ctx.tiles, sampLat, sampLon);
		if (sampElev === null) continue;

		const elevAngle = Math.atan2(sampElev - ctx.observerHeight, dist);
		const isVisible = elevAngle > maxElevAngle;
		maxElevAngle = Math.max(maxElevAngle, elevAngle);

		setPixel(ctx, sampLat, sampLon, isVisible);
		cells++;
	}
	return cells;
}

// ── Internal helpers ────────────────────────────────────────────────

/** Convert geographic position to pixel index, or -1 if out of bounds */
function geoToPixelIndex(ctx: SweepContext, lat: number, lon: number): number {
	const x = Math.floor(
		((lon - ctx.bounds.west) / (ctx.bounds.east - ctx.bounds.west)) * (ctx.width - 1)
	);
	const y = Math.floor(
		((ctx.bounds.north - lat) / (ctx.bounds.north - ctx.bounds.south)) * (ctx.height - 1)
	);

	if (x < 0 || x >= ctx.width || y < 0 || y >= ctx.height) return -1;
	return (y * ctx.width + x) * 4;
}

/** Get RGBA color for a visibility classification */
function visibilityColor(
	params: ViewshedParams,
	isVisible: boolean
): [number, number, number, number] {
	if (isVisible) {
		return [VISIBLE_R, VISIBLE_G, VISIBLE_B, Math.round(params.greenOpacity * 255)];
	}
	return [OBSTRUCTED_R, OBSTRUCTED_G, OBSTRUCTED_B, Math.round(params.redOpacity * 255)];
}

/** Set a pixel in the RGBA buffer based on lat/lon position */
function setPixel(ctx: SweepContext, lat: number, lon: number, isVisible: boolean): void {
	const idx = geoToPixelIndex(ctx, lat, lon);
	if (idx < 0 || ctx.rgba[idx + 3] > 0) return;

	const [r, g, b, a] = visibilityColor(ctx.params, isVisible);
	ctx.rgba[idx] = r;
	ctx.rgba[idx + 1] = g;
	ctx.rgba[idx + 2] = b;
	ctx.rgba[idx + 3] = a;
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
		imageDataUri: '',
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
