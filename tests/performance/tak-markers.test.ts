import { performance } from 'perf_hooks';
import { describe, expect, it } from 'vitest';

import { SymbolFactory } from '../../src/lib/map/symbols/SymbolFactory';
import { type DeviceForVisibility, filterByVisibility } from '../../src/lib/map/VisibilityEngine';

/**
 * Performance stress test for TAK marker pipeline (SC-006).
 * Validates that 100+ markers can be processed without introducing UI lag.
 *
 * Tests cover server-side processing throughput:
 * - SIDC resolution via SymbolFactory
 * - CoT type → SIDC mapping
 * - VisibilityEngine filtering at scale
 *
 * Note: Actual MapLibre FPS rendering (>30 FPS) requires Playwright E2E testing.
 */

describe('TAK Marker Performance (SC-006)', () => {
	const MARKER_COUNT = 150;

	it(`should resolve ${MARKER_COUNT} SIDCs in < 10ms`, () => {
		const types = ['wifi', 'ap', 'client', 'bluetooth', 'cell_tower', 'drone', 'unknown'];

		const start = performance.now();
		for (let i = 0; i < MARKER_COUNT; i++) {
			const type = types[i % types.length];
			SymbolFactory.getSidcForDevice(type, 'unknown');
		}
		const elapsed = performance.now() - start;

		console.warn(`SIDC resolution: ${MARKER_COUNT} devices in ${elapsed.toFixed(2)}ms`);
		expect(elapsed).toBeLessThan(10);
	});

	it(`should map ${MARKER_COUNT} CoT types to SIDCs in < 10ms`, () => {
		const cotTypes = [
			'a-f-G-U-C-I', // friendly ground unit combat infantry
			'a-h-G-E-V', // hostile ground equipment vehicle
			'a-n-A-C-F', // neutral air fixed wing
			'a-u-G-I', // unknown ground infrastructure
			'a-f-G-U-C', // friendly ground unit combat
			'a-h-G-U', // hostile ground unit
			'a-u-S-X' // unknown sea
		];

		const start = performance.now();
		for (let i = 0; i < MARKER_COUNT; i++) {
			const cotType = cotTypes[i % cotTypes.length];
			SymbolFactory.cotTypeToSidc(cotType);
		}
		const elapsed = performance.now() - start;

		console.warn(`CoT→SIDC mapping: ${MARKER_COUNT} messages in ${elapsed.toFixed(2)}ms`);
		expect(elapsed).toBeLessThan(10);
	});

	it('should produce valid 15-char SIDCs for all device types', () => {
		const types = [
			'wifi',
			'ap',
			'client',
			'bluetooth',
			'cell_tower',
			'drone',
			'self',
			'unknown'
		];
		const affiliations: Array<'friendly' | 'hostile' | 'neutral' | 'unknown'> = [
			'friendly',
			'hostile',
			'neutral',
			'unknown'
		];

		for (const type of types) {
			for (const aff of affiliations) {
				const sidc = SymbolFactory.getSidcForDevice(type, aff);
				// milsymbol expects 15-char SIDCs or at least 10 significant chars
				expect(sidc.length).toBeGreaterThanOrEqual(10);
				// First char must be S (warfighting)
				expect(sidc[0]).toBe('S');
				// Second char must be valid affiliation
				expect(['F', 'H', 'N', 'U']).toContain(sidc[1]);
			}
		}
	});

	it('should produce distinct SIDCs for different device types', () => {
		const wifiSidc = SymbolFactory.getSidcForDevice('wifi', 'unknown');
		const cellSidc = SymbolFactory.getSidcForDevice('cell_tower', 'unknown');
		const droneSidc = SymbolFactory.getSidcForDevice('drone', 'unknown');
		const btSidc = SymbolFactory.getSidcForDevice('bluetooth', 'unknown');

		// Each type should produce a unique SIDC
		const sidcs = new Set([wifiSidc, cellSidc, droneSidc, btSidc]);
		expect(sidcs.size).toBe(4);
	});

	it('should correctly map CoT atom types to SIDCs', () => {
		// Friendly ground unit
		const friendly = SymbolFactory.cotTypeToSidc('a-f-G-U-C-I');
		expect(friendly[1]).toBe('F'); // friendly affiliation
		expect(friendly[2]).toBe('G'); // ground

		// Hostile air
		const hostile = SymbolFactory.cotTypeToSidc('a-h-A-C-F');
		expect(hostile[1]).toBe('H'); // hostile
		expect(hostile[2]).toBe('A'); // air

		// Unknown fallback
		const unknown = SymbolFactory.cotTypeToSidc('not-a-cot-type');
		expect(unknown).toContain('U'); // should default to unknown
	});

	it(`should filter ${MARKER_COUNT} devices through VisibilityEngine in < 5ms`, () => {
		const now = Math.floor(Date.now() / 1000);
		const devices: DeviceForVisibility[] = Array.from({ length: MARKER_COUNT }, (_, i) => ({
			mac: `00:11:22:33:44:${i.toString(16).padStart(2, '0')}`,
			rssi: -40 - (i % 60), // Range from -40 to -99
			lastSeen: now - i * 10 // Spread over time
		}));

		const promoted = new Set(['00:11:22:33:44:05', '00:11:22:33:44:63']);

		// Test each mode
		for (const mode of ['dynamic', 'all', 'manual'] as const) {
			const start = performance.now();
			const result = filterByVisibility(devices, mode, promoted, now);
			const elapsed = performance.now() - start;

			console.warn(
				`VisibilityEngine [${mode}]: ${result.length}/${MARKER_COUNT} visible in ${elapsed.toFixed(2)}ms`
			);
			expect(elapsed).toBeLessThan(5);
		}
	});

	it('VisibilityEngine dynamic mode should filter weak/stale signals', () => {
		const now = Math.floor(Date.now() / 1000);

		const devices: DeviceForVisibility[] = [
			{ mac: 'strong-recent', rssi: -50, lastSeen: now - 10 },
			{ mac: 'weak-recent', rssi: -90, lastSeen: now - 10 },
			{ mac: 'strong-stale', rssi: -50, lastSeen: now - 600 },
			{ mac: 'promoted-weak', rssi: -95, lastSeen: now - 600 }
		];

		const promoted = new Set(['promoted-weak']);
		const result = filterByVisibility(devices, 'dynamic', promoted, now);
		const visibleMacs = result.map((d) => d.mac);

		expect(visibleMacs).toContain('strong-recent');
		expect(visibleMacs).not.toContain('weak-recent');
		expect(visibleMacs).not.toContain('strong-stale');
		expect(visibleMacs).toContain('promoted-weak'); // Promoted always visible
	});

	it('VisibilityEngine manual mode should only show promoted devices', () => {
		const now = Math.floor(Date.now() / 1000);
		const devices: DeviceForVisibility[] = [
			{ mac: 'dev-1', rssi: -50, lastSeen: now },
			{ mac: 'dev-2', rssi: -50, lastSeen: now },
			{ mac: 'dev-3', rssi: -50, lastSeen: now }
		];

		const promoted = new Set(['dev-2']);
		const result = filterByVisibility(devices, 'manual', promoted, now);

		expect(result).toHaveLength(1);
		expect(result[0].mac).toBe('dev-2');
	});
});
