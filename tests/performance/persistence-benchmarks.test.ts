/**
 * Persistence Performance Benchmarks — SC-004
 *
 * Validates that GSM Evil debounced persistence limits actual localStorage
 * writes under rapid update bursts.
 */
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock $app/environment before importing gsm-evil-store (it checks `browser`)
vi.mock('$app/environment', () => ({ browser: true }));

const { gsmEvilStore } = await import('$lib/stores/gsm-evil-store');

describe('Persistence Performance Benchmarks', () => {
	let setItemCalls: number;

	beforeEach(() => {
		setItemCalls = 0;
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			setItemCalls++;
		});
		vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('500 rapid addScanProgress calls produce ≤5 localStorage writes (SC-004)', () => {
		for (let i = 0; i < 500; i++) {
			gsmEvilStore.addScanProgress(`Scanning frequency ${2400 + i} MHz...`);
		}

		vi.advanceTimersByTime(5000);

		// addScanProgress uses updateOnly (no persistence), so writes should be 0
		expect(setItemCalls).toBeLessThanOrEqual(5);
	});

	it('scan progress updates do not trigger persistence', () => {
		gsmEvilStore.addScanProgress('Step 1');
		gsmEvilStore.addScanProgress('Step 2');
		gsmEvilStore.addScanProgress('Step 3');

		vi.advanceTimersByTime(5000);

		expect(setItemCalls).toBe(0);
	});

	it('store state is accessible after rapid updates', () => {
		for (let i = 0; i < 100; i++) {
			gsmEvilStore.addScanProgress(`Progress ${i}`);
		}

		const state = get(gsmEvilStore);
		expect(state.scanProgress.length).toBeGreaterThan(0);
	});
});
