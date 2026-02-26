/**
 * Persisted RF range configuration store.
 *
 * Manages preset selection, custom profile parameters, and frequency source.
 * State persists to localStorage via persistedWritable.
 */
import { z } from 'zod';

import {
	DEFAULT_CUSTOM_PROFILE,
	type FrequencySource,
	RF_PROFILE_LIMITS,
	type RFRangeProfile,
	type RFRangeStoreState
} from '$lib/types/rf-range';

import { persistedWritable } from '../persisted-writable';

// ── Zod schema for localStorage validation ───────────────────────────

const RFRangeStoreSchema = z.object({
	isEnabled: z.boolean(),
	activePresetId: z.string(),
	customProfile: z.object({
		id: z.string(),
		label: z.string(),
		txPowerDbm: z
			.number()
			.min(RF_PROFILE_LIMITS.TX_POWER_MIN_DBM)
			.max(RF_PROFILE_LIMITS.TX_POWER_MAX_DBM),
		antennaGainDbi: z
			.number()
			.min(RF_PROFILE_LIMITS.ANTENNA_GAIN_MIN_DBI)
			.max(RF_PROFILE_LIMITS.ANTENNA_GAIN_MAX_DBI),
		rxAntennaGainDbi: z
			.number()
			.min(RF_PROFILE_LIMITS.ANTENNA_GAIN_MIN_DBI)
			.max(RF_PROFILE_LIMITS.ANTENNA_GAIN_MAX_DBI),
		sensitivityDbm: z
			.number()
			.min(RF_PROFILE_LIMITS.SENSITIVITY_MIN_DBM)
			.max(RF_PROFILE_LIMITS.SENSITIVITY_MAX_DBM),
		heightAglMeters: z
			.number()
			.min(RF_PROFILE_LIMITS.HEIGHT_MIN_M)
			.max(RF_PROFILE_LIMITS.HEIGHT_MAX_M),
		propagationModel: z.enum(['free-space', 'terrain-aware'])
	}),
	frequencySource: z.enum(['auto', 'manual']),
	manualFrequencyMHz: z
		.number()
		.min(RF_PROFILE_LIMITS.FREQUENCY_MIN_MHZ)
		.max(RF_PROFILE_LIMITS.FREQUENCY_MAX_MHZ)
});

// ── Default state ────────────────────────────────────────────────────

const DEFAULT_STATE: RFRangeStoreState = {
	isEnabled: false,
	activePresetId: 'hackrf-bare',
	customProfile: { ...DEFAULT_CUSTOM_PROFILE },
	frequencySource: 'auto',
	manualFrequencyMHz: 2437
};

// ── Store ────────────────────────────────────────────────────────────

export const rfRangeStore = persistedWritable<RFRangeStoreState>('rfRangeConfig', DEFAULT_STATE, {
	validate: (value) => {
		const result = RFRangeStoreSchema.safeParse(value);
		return result.success ? result.data : null;
	}
});

// ── Convenience setters ──────────────────────────────────────────────

export function setRFRangeEnabled(enabled: boolean): void {
	rfRangeStore.update((s) => ({ ...s, isEnabled: enabled }));
}

export function setActivePreset(presetId: string): void {
	rfRangeStore.update((s) => ({ ...s, activePresetId: presetId }));
}

const PROFILE_CLAMP_RANGES: Record<string, [number, number]> = {
	txPowerDbm: [RF_PROFILE_LIMITS.TX_POWER_MIN_DBM, RF_PROFILE_LIMITS.TX_POWER_MAX_DBM],
	antennaGainDbi: [
		RF_PROFILE_LIMITS.ANTENNA_GAIN_MIN_DBI,
		RF_PROFILE_LIMITS.ANTENNA_GAIN_MAX_DBI
	],
	rxAntennaGainDbi: [
		RF_PROFILE_LIMITS.ANTENNA_GAIN_MIN_DBI,
		RF_PROFILE_LIMITS.ANTENNA_GAIN_MAX_DBI
	],
	sensitivityDbm: [RF_PROFILE_LIMITS.SENSITIVITY_MIN_DBM, RF_PROFILE_LIMITS.SENSITIVITY_MAX_DBM],
	heightAboveGroundM: [RF_PROFILE_LIMITS.HEIGHT_MIN_M, RF_PROFILE_LIMITS.HEIGHT_MAX_M]
};

function clampProfileField(key: string, value: unknown): unknown {
	if (typeof value !== 'number') return value;
	const range = PROFILE_CLAMP_RANGES[key];
	return range ? Math.max(range[0], Math.min(range[1], value)) : value;
}

export function updateCustomProfile(partial: Partial<RFRangeProfile>): void {
	const clamped = Object.fromEntries(
		Object.entries(partial).map(([k, v]) => [k, clampProfileField(k, v)])
	) as Partial<RFRangeProfile>;
	rfRangeStore.update((s) => ({
		...s,
		activePresetId: 'custom',
		customProfile: { ...s.customProfile, ...clamped }
	}));
}

export function setFrequencySource(source: FrequencySource): void {
	rfRangeStore.update((s) => ({ ...s, frequencySource: source }));
}

export function setManualFrequency(mhz: number): void {
	const clamped = Math.max(
		RF_PROFILE_LIMITS.FREQUENCY_MIN_MHZ,
		Math.min(RF_PROFILE_LIMITS.FREQUENCY_MAX_MHZ, mhz)
	);
	rfRangeStore.update((s) => ({ ...s, manualFrequencyMHz: clamped }));
}
