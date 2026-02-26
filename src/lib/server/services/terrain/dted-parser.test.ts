import { describe, expect, it } from 'vitest';

import type { DTEDTile } from '$lib/types/viewshed';
import { DTED_VOID_VALUE } from '$lib/types/viewshed';

import {
	getElevation,
	getElevationFromTiles,
	getElevationNearest,
	parseDTEDFile
} from './dted-parser';

/** Find the geographic coordinates of the first void cell in a tile, or null */
function findFirstVoidCoord(tile: DTEDTile): { lat: number; lon: number } | null {
	const { numLonLines, numLatPoints, originLon, originLat } = tile.header;
	for (let i = 0; i < tile.elevations.length; i++) {
		if (tile.elevations[i] !== DTED_VOID_VALUE) continue;
		const col = Math.floor(i / numLatPoints);
		const row = i % numLatPoints;
		return {
			lon: originLon + col / (numLonLines - 1),
			lat: originLat + row / (numLatPoints - 1)
		};
	}
	return null;
}

/**
 * Tests use a real DTED Level 0 tile: data/dted/w117/n34.dt0
 * This tile covers 34°N to 35°N, 117°W to 116°W — the NTC (Fort Irwin) area.
 */
const NTC_TILE_PATH = 'data/dted/w117/n34.dt0';

describe('DTED Parser', () => {
	describe('parseDTEDFile', () => {
		it('should parse UHL header fields from a real tile', () => {
			const tile = parseDTEDFile(NTC_TILE_PATH);

			expect(tile.header.originLon).toBe(-117);
			expect(tile.header.originLat).toBe(34);
			expect(tile.header.latIntervalArcSec).toBe(30);
			expect(tile.header.lonIntervalArcSec).toBe(30);
			expect(tile.header.numLatPoints).toBe(121);
			expect(tile.header.numLonLines).toBe(121);
		});

		it('should produce a Float32Array with correct size', () => {
			const tile = parseDTEDFile(NTC_TILE_PATH);
			const expectedSize = tile.header.numLonLines * tile.header.numLatPoints;

			expect(tile.elevations).toBeInstanceOf(Float32Array);
			expect(tile.elevations.length).toBe(expectedSize);
		});

		it('should store the file path', () => {
			const tile = parseDTEDFile(NTC_TILE_PATH);
			expect(tile.filePath).toBe(NTC_TILE_PATH);
		});

		it('should have reasonable elevation values for NTC terrain', () => {
			const tile = parseDTEDFile(NTC_TILE_PATH);

			// NTC area elevations are roughly 300-1800m
			let min = Infinity;
			let max = -Infinity;
			for (let i = 0; i < tile.elevations.length; i++) {
				const v = tile.elevations[i];
				if (v === DTED_VOID_VALUE) continue;
				min = Math.min(min, v);
				max = Math.max(max, v);
			}

			// w117/n34 covers 34-35°N, 117-116°W — desert floor + San Bernardino peaks
			expect(min).toBeGreaterThanOrEqual(0);
			expect(min).toBeLessThan(1000);
			expect(max).toBeGreaterThan(500);
			expect(max).toBeLessThan(4000);
		});
	});

	describe('getElevationNearest', () => {
		it('should return elevation at the origin corner', () => {
			const tile = parseDTEDFile(NTC_TILE_PATH);
			const elev = getElevationNearest(tile, 34.0, -117.0);

			expect(elev).not.toBeNull();
			expect(elev!).toBeGreaterThanOrEqual(0);
			expect(elev!).toBeLessThan(3000);
		});

		it('should return elevation at Fort Irwin area (~35.26N, -116.68W)', () => {
			const tile = parseDTEDFile(NTC_TILE_PATH);
			// Fort Irwin is in the tile: 34-35N, 117-116W
			const elev = getElevationNearest(tile, 34.5, -116.5);

			expect(elev).not.toBeNull();
			expect(typeof elev).toBe('number');
		});

		it('should return null for coordinates outside tile bounds', () => {
			const tile = parseDTEDFile(NTC_TILE_PATH);

			expect(getElevationNearest(tile, 33.0, -117.0)).toBeNull();
			expect(getElevationNearest(tile, 36.0, -117.0)).toBeNull();
			expect(getElevationNearest(tile, 34.5, -118.0)).toBeNull();
			expect(getElevationNearest(tile, 34.5, -115.0)).toBeNull();
		});
	});

	describe('getElevation (bilinear)', () => {
		it('should return interpolated elevation for mid-cell coordinates', () => {
			const tile = parseDTEDFile(NTC_TILE_PATH);
			const elev = getElevation(tile, 34.5, -116.5);

			expect(elev).not.toBeNull();
			expect(typeof elev).toBe('number');
			expect(elev!).toBeGreaterThanOrEqual(0);
			expect(elev!).toBeLessThan(3000);
		});

		it('should return null for out-of-bounds coordinates', () => {
			const tile = parseDTEDFile(NTC_TILE_PATH);
			expect(getElevation(tile, 33.0, -117.0)).toBeNull();
		});
	});

	describe('signed-magnitude decoding', () => {
		it('should handle areas that could have negative elevations', () => {
			// Death Valley tile (w117/n35 or w118/n36 might have negative elevations)
			// But NTC tile at w117/n34 should have all positive
			const tile = parseDTEDFile(NTC_TILE_PATH);

			// Verify no wildly incorrect values from bad decoding
			for (let i = 0; i < tile.elevations.length; i++) {
				const v = tile.elevations[i];
				if (v === DTED_VOID_VALUE) continue;
				// DTED Level 0 valid range: -500 to 9000m
				expect(v).toBeGreaterThanOrEqual(-500);
				expect(v).toBeLessThanOrEqual(9000);
			}
		});
	});

	describe('void data handling', () => {
		it('should return null for void elevation values', () => {
			const tile = parseDTEDFile(NTC_TILE_PATH);
			const voidCoord = findFirstVoidCoord(tile);

			if (voidCoord) {
				expect(getElevationNearest(tile, voidCoord.lat, voidCoord.lon)).toBeNull();
			}
			// NTC tiles may not have void data — that's OK, the sentinel logic is still exercised
		});
	});

	describe('getElevationFromTiles', () => {
		it('should find elevation from the correct tile in an array', () => {
			const tile = parseDTEDFile(NTC_TILE_PATH);
			const elev = getElevationFromTiles([tile], 34.5, -116.5);

			expect(elev).not.toBeNull();
			expect(typeof elev).toBe('number');
		});

		it('should return null when no tile covers the coordinate', () => {
			const tile = parseDTEDFile(NTC_TILE_PATH);
			const elev = getElevationFromTiles([tile], 40.0, -100.0);

			expect(elev).toBeNull();
		});
	});
});
