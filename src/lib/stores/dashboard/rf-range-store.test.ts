/**
 * Unit tests for the RF range configuration store.
 */
import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';

// Mock $app/environment — persistedWritable imports it for the `browser` check.
// The $app virtual module requires SvelteKit's __sveltekit package only available during build/dev.
vi.mock('$app/environment', () => ({
	browser: false,
	dev: true,
	building: false,
	version: 'test'
}));

import {
	rfRangeStore,
	setActivePreset,
	setFrequencySource,
	setManualFrequency,
	setRFRangeEnabled,
	updateCustomProfile
} from './rf-range-store';

describe('rfRangeStore', () => {
	it('initializes with default state', () => {
		const state = get(rfRangeStore);
		expect(state.isEnabled).toBe(false);
		expect(state.activePresetId).toBe('hackrf-bare');
		expect(state.frequencySource).toBe('auto');
		expect(state.manualFrequencyMHz).toBe(2437);
		expect(state.customProfile.id).toBe('custom');
	});

	it('setRFRangeEnabled toggles enabled state', () => {
		setRFRangeEnabled(true);
		expect(get(rfRangeStore).isEnabled).toBe(true);

		setRFRangeEnabled(false);
		expect(get(rfRangeStore).isEnabled).toBe(false);
	});

	it('setActivePreset updates active preset', () => {
		setActivePreset('hackrf-amplifier');
		expect(get(rfRangeStore).activePresetId).toBe('hackrf-amplifier');

		setActivePreset('hackrf-directional');
		expect(get(rfRangeStore).activePresetId).toBe('hackrf-directional');

		// Reset
		setActivePreset('hackrf-bare');
	});

	it('updateCustomProfile switches to custom and updates fields', () => {
		updateCustomProfile({ txPowerDbm: 25 });
		const state = get(rfRangeStore);
		expect(state.activePresetId).toBe('custom');
		expect(state.customProfile.txPowerDbm).toBe(25);
		// Other fields remain at defaults
		expect(state.customProfile.antennaGainDbi).toBe(0);

		// Reset
		setActivePreset('hackrf-bare');
	});

	it('updateCustomProfile merges partial updates', () => {
		updateCustomProfile({ txPowerDbm: 15 });
		updateCustomProfile({ antennaGainDbi: 8 });
		const state = get(rfRangeStore);
		expect(state.customProfile.txPowerDbm).toBe(15);
		expect(state.customProfile.antennaGainDbi).toBe(8);

		// Reset
		setActivePreset('hackrf-bare');
	});

	it('setFrequencySource toggles frequency source', () => {
		setFrequencySource('manual');
		expect(get(rfRangeStore).frequencySource).toBe('manual');

		setFrequencySource('auto');
		expect(get(rfRangeStore).frequencySource).toBe('auto');
	});

	it('setManualFrequency updates and clamps value', () => {
		setManualFrequency(900);
		expect(get(rfRangeStore).manualFrequencyMHz).toBe(900);

		// Clamp below minimum (1 MHz)
		setManualFrequency(0);
		expect(get(rfRangeStore).manualFrequencyMHz).toBe(1);

		// Clamp above maximum (6000 MHz)
		setManualFrequency(10000);
		expect(get(rfRangeStore).manualFrequencyMHz).toBe(6000);

		// Reset
		setManualFrequency(2437);
	});
});
