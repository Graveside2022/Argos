/**
 * Unit tests for RF propagation math.
 *
 * Test matrix: 900 MHz / 2.4 GHz / 5.8 GHz × 3 presets = 9 known-good values.
 * Plus edge cases: clamping behavior, band proportions, zero/negative inputs.
 */
import { describe, expect, it } from 'vitest';

import { RF_RANGE_PRESETS } from '$lib/types/rf-range';

import {
	buildRFRangeBandsFallback,
	calculateFriisRange,
	clampDisplayRange,
	RF_RANGE_LIMITS
} from './rf-propagation';

// ── Helper: compute Friis from a preset + frequency ──────────────────

function friisFromPreset(presetId: string, frequencyHz: number): number {
	const preset = RF_RANGE_PRESETS.find((p) => p.id === presetId);
	if (!preset) throw new Error(`Unknown preset: ${presetId}`);
	return calculateFriisRange(
		frequencyHz,
		preset.txPowerDbm,
		preset.antennaGainDbi,
		preset.rxAntennaGainDbi,
		preset.sensitivityDbm
	);
}

// ── Reference values computed by hand using Friis equation ───────────
// Link Budget = Pt + Gt + Gr - Sensitivity
// d_max = 10^((LB - 20·log10(f) + 147.55) / 20)

// HackRF Bare: LB = 10 + 0 + 0 - (-90) = 100 dB
// HackRF + Amplifier: LB = 20 + 0 + 0 - (-90) = 110 dB
// HackRF + Directional: LB = 10 + 12 + 0 - (-90) = 112 dB

describe('calculateFriisRange', () => {
	describe('HackRF Bare preset (LB=100 dB)', () => {
		it('computes correct range at 900 MHz', () => {
			const range = friisFromPreset('hackrf-bare', 900e6);
			// d_max = 10^((100 - 179.085 + 147.55) / 20) = 10^(68.465/20) = 10^3.42325 ≈ 2651 m
			expect(range).toBeGreaterThan(2500);
			expect(range).toBeLessThan(2800);
		});

		it('computes correct range at 2.4 GHz', () => {
			const range = friisFromPreset('hackrf-bare', 2.4e9);
			// d_max = 10^((100 - 187.604 + 147.55) / 20) = 10^(59.946/20) = 10^2.9973 ≈ 994 m
			expect(range).toBeGreaterThan(900);
			expect(range).toBeLessThan(1100);
		});

		it('computes correct range at 5.8 GHz', () => {
			const range = friisFromPreset('hackrf-bare', 5.8e9);
			// d_max = 10^((100 - 195.268 + 147.55) / 20) = 10^(52.282/20) = 10^2.6141 ≈ 411 m
			expect(range).toBeGreaterThan(380);
			expect(range).toBeLessThan(450);
		});
	});

	describe('HackRF + Amplifier preset (LB=110 dB)', () => {
		it('computes correct range at 900 MHz', () => {
			const range = friisFromPreset('hackrf-amplifier', 900e6);
			// LB 10 dB higher → d_max × 10^(10/20) = × 3.162
			// ≈ 2651 × 3.162 ≈ 8382 m
			expect(range).toBeGreaterThan(7800);
			expect(range).toBeLessThan(8900);
		});

		it('computes correct range at 2.4 GHz', () => {
			const range = friisFromPreset('hackrf-amplifier', 2.4e9);
			// ≈ 994 × 3.162 ≈ 3142 m
			expect(range).toBeGreaterThan(2900);
			expect(range).toBeLessThan(3400);
		});

		it('computes correct range at 5.8 GHz', () => {
			const range = friisFromPreset('hackrf-amplifier', 5.8e9);
			// ≈ 411 × 3.162 ≈ 1300 m
			expect(range).toBeGreaterThan(1200);
			expect(range).toBeLessThan(1400);
		});
	});

	describe('HackRF + Directional preset (LB=112 dB)', () => {
		it('computes correct range at 900 MHz', () => {
			const range = friisFromPreset('hackrf-directional', 900e6);
			// LB 12 dB higher than bare → × 10^(12/20) = × 3.981
			// ≈ 2651 × 3.981 ≈ 10553 m
			expect(range).toBeGreaterThan(10000);
			expect(range).toBeLessThan(11200);
		});

		it('computes correct range at 2.4 GHz', () => {
			const range = friisFromPreset('hackrf-directional', 2.4e9);
			// ≈ 994 × 3.981 ≈ 3957 m
			expect(range).toBeGreaterThan(3700);
			expect(range).toBeLessThan(4200);
		});

		it('computes correct range at 5.8 GHz', () => {
			const range = friisFromPreset('hackrf-directional', 5.8e9);
			// ≈ 411 × 3.981 ≈ 1636 m
			expect(range).toBeGreaterThan(1500);
			expect(range).toBeLessThan(1750);
		});
	});

	describe('edge cases', () => {
		it('returns 0 for zero frequency', () => {
			expect(calculateFriisRange(0, 10, 0, 0, -90)).toBe(0);
		});

		it('returns 0 for negative frequency', () => {
			expect(calculateFriisRange(-1, 10, 0, 0, -90)).toBe(0);
		});

		it('handles very low frequency (1 MHz) — large range', () => {
			const range = calculateFriisRange(1e6, 10, 0, 0, -90);
			// Very low frequency → very large range (hundreds of km)
			expect(range).toBeGreaterThan(100_000);
		});

		it('handles very high frequency (6 GHz) — small range', () => {
			const range = calculateFriisRange(6e9, 10, 0, 0, -90);
			// High frequency → small range
			expect(range).toBeGreaterThan(100);
			expect(range).toBeLessThan(500);
		});

		it('higher TX power increases range', () => {
			const lowPower = calculateFriisRange(2.4e9, 0, 0, 0, -90);
			const highPower = calculateFriisRange(2.4e9, 20, 0, 0, -90);
			expect(highPower).toBeGreaterThan(lowPower);
		});

		it('higher antenna gain increases range', () => {
			const noGain = calculateFriisRange(2.4e9, 10, 0, 0, -90);
			const withGain = calculateFriisRange(2.4e9, 10, 12, 0, -90);
			expect(withGain).toBeGreaterThan(noGain);
		});

		it('better sensitivity (more negative) increases range', () => {
			const poor = calculateFriisRange(2.4e9, 10, 0, 0, -60);
			const good = calculateFriisRange(2.4e9, 10, 0, 0, -120);
			expect(good).toBeGreaterThan(poor);
		});
	});
});

describe('clampDisplayRange', () => {
	it('clamps below minimum to 50m', () => {
		const result = clampDisplayRange(10);
		expect(result.displayRange).toBe(RF_RANGE_LIMITS.MIN_DISPLAY_METERS);
		expect(result.isCapped).toBe(true);
	});

	it('clamps above maximum to 50km', () => {
		const result = clampDisplayRange(100_000);
		expect(result.displayRange).toBe(RF_RANGE_LIMITS.MAX_DISPLAY_METERS);
		expect(result.isCapped).toBe(true);
	});

	it('does not clamp within range', () => {
		const result = clampDisplayRange(5000);
		expect(result.displayRange).toBe(5000);
		expect(result.isCapped).toBe(false);
	});

	it('treats exactly-at-minimum as within range', () => {
		const result = clampDisplayRange(51);
		expect(result.displayRange).toBe(51);
		expect(result.isCapped).toBe(false);
	});

	it('treats exactly-at-maximum as within range', () => {
		const result = clampDisplayRange(49_999);
		expect(result.displayRange).toBe(49_999);
		expect(result.isCapped).toBe(false);
	});

	it('clamps zero to minimum', () => {
		const result = clampDisplayRange(0);
		expect(result.displayRange).toBe(RF_RANGE_LIMITS.MIN_DISPLAY_METERS);
		expect(result.isCapped).toBe(true);
	});
});

describe('buildRFRangeBandsFallback', () => {
	const bands = buildRFRangeBandsFallback(1000);

	it('produces exactly 4 bands', () => {
		expect(bands).toHaveLength(4);
	});

	it('bands are ordered inner → outer', () => {
		expect(bands[0].band).toBe('strong');
		expect(bands[1].band).toBe('usable');
		expect(bands[2].band).toBe('marginal');
		expect(bands[3].band).toBe('maximum');
	});

	it('band radii are proportional (25/50/75/100%)', () => {
		expect(bands[0].outerR).toBe(250);
		expect(bands[0].innerR).toBe(0);
		expect(bands[1].outerR).toBe(500);
		expect(bands[1].innerR).toBe(250);
		expect(bands[2].outerR).toBe(750);
		expect(bands[2].innerR).toBe(500);
		expect(bands[3].outerR).toBe(1000);
		expect(bands[3].innerR).toBe(750);
	});

	it('each band has a non-empty color', () => {
		for (const band of bands) {
			expect(band.color).toBeTruthy();
			expect(band.color).toMatch(/^#[0-9a-fA-F]{6}$/);
		}
	});

	it('each band has a margin label', () => {
		expect(bands[0].marginLabel).toContain('12 dB');
		expect(bands[3].marginLabel).toContain('0-3 dB');
	});

	it('distance labels are formatted correctly', () => {
		expect(bands[0].distanceLabel).toBe('250 m');
		expect(bands[1].distanceLabel).toBe('500 m');
		expect(bands[2].distanceLabel).toBe('750 m');
		expect(bands[3].distanceLabel).toBe('1.0 km');
	});

	it('handles very large range (50 km)', () => {
		const bigBands = buildRFRangeBandsFallback(50_000);
		expect(bigBands[3].outerR).toBe(50_000);
		expect(bigBands[3].distanceLabel).toBe('50.0 km');
	});

	it('handles minimum range (50 m)', () => {
		const smallBands = buildRFRangeBandsFallback(50);
		expect(smallBands[0].outerR).toBeCloseTo(12.5);
		expect(smallBands[3].outerR).toBe(50);
	});
});
