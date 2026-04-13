import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { extractSpectrumFeatures } from '$lib/server/services/reports/spectrum-features';

const FIXTURE = join(process.cwd(), 'tests', 'fixtures', 'reports', 'sweep-sample.ndjson');

describe('extractSpectrumFeatures', () => {
	it('parses the sweep fixture and detects injected peaks', async () => {
		const features = await extractSpectrumFeatures(FIXTURE, 925e6, 960e6);

		expect(features.band.start_mhz).toBe(925);
		expect(features.band.end_mhz).toBe(960);
		expect(features.capture.total_frames).toBe(10);
		expect(features.noise_floor_dbm).toBeGreaterThan(-115);
		expect(features.noise_floor_dbm).toBeLessThan(-105);

		expect(features.emitters.length).toBeGreaterThanOrEqual(3);

		const top3 = features.emitters.slice(0, 3);
		const centers = top3.map((e) => e.center_mhz);
		const near = (target: number): boolean => centers.some((c) => Math.abs(c - target) <= 2);
		expect(near(925.5)).toBe(true);
		expect(near(940.5)).toBe(true);
		expect(near(955.5)).toBe(true);

		const topEmitter = features.emitters[0];
		expect(topEmitter.duty_cycle).toBeGreaterThanOrEqual(0.3);
		expect(topEmitter.duty_cycle).toBeLessThanOrEqual(1.0);

		expect(features.quiet_bands).toBeDefined();
		for (const band of features.quiet_bands) {
			for (const emitter of features.emitters) {
				const overlap =
					emitter.center_mhz >= band.start_mhz && emitter.center_mhz <= band.end_mhz;
				expect(overlap).toBe(false);
			}
		}
	});
});
