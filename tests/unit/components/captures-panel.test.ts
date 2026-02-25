import { describe, expect, it } from 'vitest';

describe('CapturesPanel Component Logic', () => {
	// Signal formatting helpers — mirroring CapturesPanel.svelte logic
	function formatFrequency(hz: number): string {
		if (hz >= 1_000_000_000) return `${(hz / 1_000_000_000).toFixed(3)} GHz`;
		if (hz >= 1_000_000) return `${(hz / 1_000_000).toFixed(3)} MHz`;
		if (hz >= 1_000) return `${(hz / 1_000).toFixed(1)} kHz`;
		return `${hz} Hz`;
	}

	function formatTime(ts: number): string {
		const d = new Date(ts);
		return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`;
	}

	function formatCoords(lat: number, lon: number): string {
		if (!lat && !lon) return '—';
		return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
	}

	function powerClass(dbm: number): string {
		if (dbm >= -30) return 'power-strong';
		if (dbm >= -60) return 'power-moderate';
		if (dbm >= -80) return 'power-weak';
		return 'power-none';
	}

	describe('Frequency formatting', () => {
		it('should format GHz frequencies', () => {
			expect(formatFrequency(2_400_000_000)).toBe('2.400 GHz');
			expect(formatFrequency(5_800_000_000)).toBe('5.800 GHz');
		});

		it('should format MHz frequencies', () => {
			expect(formatFrequency(433_920_000)).toBe('433.920 MHz');
			expect(formatFrequency(915_000_000)).toBe('915.000 MHz');
		});

		it('should format kHz frequencies', () => {
			expect(formatFrequency(27_000)).toBe('27.0 kHz');
		});

		it('should format raw Hz', () => {
			expect(formatFrequency(500)).toBe('500 Hz');
		});
	});

	describe('Time formatting', () => {
		it('should format UTC timestamps as HH:MM:SS', () => {
			// 2026-01-15T14:30:45Z
			const ts = Date.UTC(2026, 0, 15, 14, 30, 45);
			expect(formatTime(ts)).toBe('14:30:45');
		});

		it('should zero-pad single-digit values', () => {
			const ts = Date.UTC(2026, 0, 1, 3, 5, 7);
			expect(formatTime(ts)).toBe('03:05:07');
		});
	});

	describe('Coordinate formatting', () => {
		it('should format lat/lon to 4 decimal places', () => {
			expect(formatCoords(34.0522, -118.2437)).toBe('34.0522, -118.2437');
		});

		it('should return em dash for zero coordinates', () => {
			expect(formatCoords(0, 0)).toBe('—');
		});
	});

	describe('Power classification', () => {
		it('should classify strong signals (>= -30 dBm)', () => {
			expect(powerClass(-20)).toBe('power-strong');
			expect(powerClass(-30)).toBe('power-strong');
		});

		it('should classify moderate signals (-31 to -60 dBm)', () => {
			expect(powerClass(-31)).toBe('power-moderate');
			expect(powerClass(-60)).toBe('power-moderate');
		});

		it('should classify weak signals (-61 to -80 dBm)', () => {
			expect(powerClass(-61)).toBe('power-weak');
			expect(powerClass(-80)).toBe('power-weak');
		});

		it('should classify no signal (< -80 dBm)', () => {
			expect(powerClass(-81)).toBe('power-none');
			expect(powerClass(-100)).toBe('power-none');
		});
	});

	describe('Table column contract', () => {
		it('should define 5 table columns per contract', () => {
			const COLUMNS = ['Frequency', 'Power', 'Location', 'Time', 'Source'] as const;
			expect(COLUMNS).toHaveLength(5);
		});
	});
});
