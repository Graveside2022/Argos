/**
 * Store Performance Benchmarks — SC-003
 *
 * Validates that batchUpdateDevices completes within performance budget
 * for realistic device counts (150 devices = typical Kismet field deployment).
 */
import { describe, expect, it } from 'vitest';

import type { KismetDevice } from '$lib/kismet/types';
import { batchUpdateDevices, kismetStore } from '$lib/stores/tactical-map/kismet-store';

function createMockDevice(index: number): KismetDevice {
	return {
		mac: `AA:BB:CC:DD:EE:${index.toString(16).padStart(2, '0').toUpperCase()}`,
		ssid: `TestNetwork-${index}`,
		type: index % 3 === 0 ? 'Wi-Fi AP' : index % 3 === 1 ? 'Wi-Fi Client' : 'Bluetooth',
		manufacturer: `Vendor-${index % 10}`,
		channel: (index % 14) + 1,
		frequency: 2412 + (index % 14) * 5,
		signal: { last_signal: -30 - (index % 60) },
		packets: index * 100,
		last_seen: Date.now() - index * 1000,
		location: { lat: 34.0 + index * 0.0001, lon: -118.0 + index * 0.0001 }
	} as KismetDevice;
}

describe('Store Performance Benchmarks', () => {
	it('batchUpdateDevices: 150 devices completes in <50ms (SC-003)', () => {
		const devices = Array.from({ length: 150 }, (_, i) => createMockDevice(i));
		const existing = new Map<string, KismetDevice>();

		const start = performance.now();
		batchUpdateDevices(devices, existing);
		const elapsed = performance.now() - start;

		expect(elapsed).toBeLessThan(50);
	});

	it('batchUpdateDevices: incremental update (10 new, 140 existing) completes in <50ms', () => {
		const devices = Array.from({ length: 150 }, (_, i) => createMockDevice(i));
		const existing = new Map(devices.slice(0, 140).map((d) => [d.mac, d]));

		const start = performance.now();
		batchUpdateDevices(devices, existing);
		const elapsed = performance.now() - start;

		expect(elapsed).toBeLessThan(50);
	});

	it('batchUpdateDevices: produces correct distributions', () => {
		const devices = Array.from({ length: 30 }, (_, i) => createMockDevice(i));
		batchUpdateDevices(devices, new Map());

		let storeState: { deviceCount: number; distributions: { byType: Map<string, number> } } = {
			deviceCount: 0,
			distributions: { byType: new Map() }
		};
		kismetStore.subscribe((s) => (storeState = s))();

		expect(storeState.deviceCount).toBe(30);
		expect(storeState.distributions.byType.size).toBeGreaterThan(0);
	});
});
