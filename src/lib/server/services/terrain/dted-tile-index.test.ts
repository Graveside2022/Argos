import { describe, expect, it } from 'vitest';

import { DTEDTileIndex } from './dted-tile-index';

const DTED_DIR = 'data/dted';

describe('DTEDTileIndex', () => {
	describe('constructor + scanDirectory', () => {
		it('should scan and index tiles from the data directory', () => {
			const index = new DTEDTileIndex(DTED_DIR);

			expect(index.tileCount).toBeGreaterThan(0);
			expect(index.isLoaded).toBe(true);
		});

		it('should index the expected number of tiles', () => {
			const index = new DTEDTileIndex(DTED_DIR);

			// Should match the extracted tile count (25,663)
			expect(index.tileCount).toBeGreaterThan(25000);
			expect(index.tileCount).toBeLessThan(27000);
		});

		it('should handle non-existent directory gracefully', () => {
			const index = new DTEDTileIndex('/nonexistent/path');

			expect(index.tileCount).toBe(0);
			expect(index.isLoaded).toBe(false);
		});
	});

	describe('coverageBounds', () => {
		it('should compute global coverage bounds', () => {
			const index = new DTEDTileIndex(DTED_DIR);
			const bounds = index.coverageBounds;

			expect(bounds).not.toBeNull();
			// DTED Level 0 covers most of the globe
			expect(bounds!.south).toBeLessThan(0);
			expect(bounds!.north).toBeGreaterThan(50);
			expect(bounds!.west).toBeLessThan(-100);
			expect(bounds!.east).toBeGreaterThan(100);
		});

		it('should return null for empty index', () => {
			const index = new DTEDTileIndex('/nonexistent/path');
			expect(index.coverageBounds).toBeNull();
		});
	});

	describe('hasTile', () => {
		it('should find the NTC tile', () => {
			const index = new DTEDTileIndex(DTED_DIR);
			expect(index.hasTile(34.5, -116.5)).toBe(true);
		});

		it('should return false for ocean-only areas', () => {
			const index = new DTEDTileIndex(DTED_DIR);
			// Deep South Pacific — no DTED coverage
			expect(index.hasTile(-50, -170)).toBe(false);
		});
	});

	describe('getTilesForArea', () => {
		it('should load the NTC tile', () => {
			const index = new DTEDTileIndex(DTED_DIR);
			const tiles = index.getTilesForArea(34.5, -116.5, 5000);

			expect(tiles.length).toBeGreaterThanOrEqual(1);
			expect(tiles[0].header.originLat).toBe(34);
			expect(tiles[0].header.originLon).toBe(-117);
		});

		it('should load multiple tiles near a tile boundary', () => {
			const index = new DTEDTileIndex(DTED_DIR);
			// Position near the boundary of 4 tiles (35°N, -117°W corner)
			const tiles = index.getTilesForArea(35.0, -117.0, 5000);

			// Should load 2-4 tiles depending on radius
			expect(tiles.length).toBeGreaterThanOrEqual(1);
		});

		it('should return empty array for uncovered area', () => {
			const index = new DTEDTileIndex(DTED_DIR);
			// Deep South Pacific — no DTED coverage
			const tiles = index.getTilesForArea(-50, -170, 5000);

			expect(tiles.length).toBe(0);
		});
	});

	describe('LRU cache', () => {
		it('should cache loaded tiles', () => {
			const index = new DTEDTileIndex(DTED_DIR, 3);

			// First load — cache miss
			const tiles1 = index.getTilesForArea(34.5, -116.5, 1000);
			expect(tiles1.length).toBe(1);

			// Second load — should hit cache (same result)
			const tiles2 = index.getTilesForArea(34.5, -116.5, 1000);
			expect(tiles2.length).toBe(1);
			expect(tiles2[0]).toBe(tiles1[0]); // Same object reference
		});

		it('should report cache statistics', () => {
			const index = new DTEDTileIndex(DTED_DIR, 9);

			// Load a tile to populate cache
			index.getTilesForArea(34.5, -116.5, 1000);
			const stats = index.cacheStats;

			expect(stats.cacheCapacity).toBe(9);
			expect(stats.cacheTiles).toBeGreaterThanOrEqual(1);
			expect(stats.cacheSizeBytes).toBeGreaterThan(0);
		});

		it('should evict oldest tile when cache is full', () => {
			const index = new DTEDTileIndex(DTED_DIR, 2);

			// Load 3 different tiles to force eviction
			index.getTilesForArea(34.5, -116.5, 1000); // tile 1
			index.getTilesForArea(35.5, -116.5, 1000); // tile 2
			index.getTilesForArea(36.5, -116.5, 1000); // tile 3, evicts tile 1

			const stats = index.cacheStats;
			expect(stats.cacheTiles).toBe(2);
		});
	});
});
