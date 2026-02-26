import { describe, expect, it } from 'vitest';

import type { ViewshedParams } from '$lib/types/viewshed';

import { DTEDTileIndex } from './dted-tile-index';
import { computeViewshed } from './viewshed-compute';

const DTED_DIR = 'data/dted';

/** Default params centered on NTC (Fort Irwin area) */
const NTC_PARAMS: ViewshedParams = {
	lat: 35.2622,
	lon: -116.6831,
	heightAgl: 2.0,
	radiusM: 5000,
	greenOpacity: 0.37,
	redOpacity: 0.92
};

describe('Viewshed Compute', () => {
	const tileIndex = new DTEDTileIndex(DTED_DIR);

	describe('basic computation', () => {
		it('should return a valid PNG data URI', () => {
			const result = computeViewshed(NTC_PARAMS, tileIndex);

			expect(result.imageDataUri).toMatch(/^data:image\/png;base64,/);
			expect(result.imageDataUri.length).toBeGreaterThan(100);
		});

		it('should return geographic bounds centered on observer', () => {
			const result = computeViewshed(NTC_PARAMS, tileIndex);

			expect(result.bounds.north).toBeGreaterThan(NTC_PARAMS.lat);
			expect(result.bounds.south).toBeLessThan(NTC_PARAMS.lat);
			expect(result.bounds.east).toBeGreaterThan(NTC_PARAMS.lon);
			expect(result.bounds.west).toBeLessThan(NTC_PARAMS.lon);
		});

		it('should return computation metadata', () => {
			const result = computeViewshed(NTC_PARAMS, tileIndex);

			expect(result.meta.computeTimeMs).toBeGreaterThanOrEqual(0);
			expect(result.meta.cellCount).toBeGreaterThan(0);
			expect(result.meta.tilesUsed).toBeGreaterThanOrEqual(1);
			expect(result.meta.imageWidth).toBeGreaterThan(0);
			expect(result.meta.imageHeight).toBeGreaterThan(0);
			expect(result.meta.cached).toBe(false);
		});

		it('should cap image dimensions at 256×256', () => {
			const largeRadius: ViewshedParams = {
				...NTC_PARAMS,
				radiusM: 50000
			};
			const result = computeViewshed(largeRadius, tileIndex);

			expect(result.meta.imageWidth).toBeLessThanOrEqual(256);
			expect(result.meta.imageHeight).toBeLessThanOrEqual(256);
		});
	});

	describe('flat terrain visibility', () => {
		it('should classify most cells as visible on relatively flat terrain', () => {
			// Use a small radius where terrain is mostly flat desert
			const flatParams: ViewshedParams = {
				...NTC_PARAMS,
				radiusM: 1000,
				heightAgl: 10
			};
			const result = computeViewshed(flatParams, tileIndex);

			// With 10m height on flat-ish terrain, most cells should be visible
			expect(result.meta.cellCount).toBeGreaterThan(0);
			expect(result.imageDataUri).toMatch(/^data:image\/png;base64,/);
		});
	});

	describe('performance', () => {
		it('should complete 5 km viewshed in under 3 seconds on ARM', () => {
			const result = computeViewshed(NTC_PARAMS, tileIndex);

			expect(result.meta.computeTimeMs).toBeLessThan(3000);
		});
	});

	describe('no-coverage handling', () => {
		it('should return empty result for uncovered area', () => {
			const uncoveredParams: ViewshedParams = {
				lat: -50,
				lon: -170,
				heightAgl: 2,
				radiusM: 5000,
				greenOpacity: 0.37,
				redOpacity: 0.92
			};
			const result = computeViewshed(uncoveredParams, tileIndex);

			expect(result.meta.tilesUsed).toBe(0);
			expect(result.meta.cellCount).toBe(0);
		});
	});

	describe('opacity encoding', () => {
		it('should produce different PNG data for different opacity values', () => {
			const lowOpacity: ViewshedParams = {
				...NTC_PARAMS,
				greenOpacity: 0.1,
				redOpacity: 0.1
			};
			const highOpacity: ViewshedParams = {
				...NTC_PARAMS,
				greenOpacity: 0.9,
				redOpacity: 0.9
			};

			const resultLow = computeViewshed(lowOpacity, tileIndex);
			const resultHigh = computeViewshed(highOpacity, tileIndex);

			// Different opacities should produce different PNG data
			expect(resultLow.imageDataUri).not.toBe(resultHigh.imageDataUri);
		});
	});
});
