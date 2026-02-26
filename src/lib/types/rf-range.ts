/**
 * Type definitions and hardware presets for the RF range overlay.
 * Pure types + constants — no side effects, no imports from Svelte or browser APIs.
 */

/** Propagation model type — 'terrain-aware' reserved for P3 */
export type PropagationModel = 'free-space' | 'terrain-aware';

/** Frequency source for the RF range overlay */
export type FrequencySource = 'auto' | 'manual';

/** A named preset or custom RF range configuration */
export interface RFRangeProfile {
	/** Unique preset identifier, or 'custom' for user-defined */
	id: string;
	/** Human-readable label (e.g., "HackRF Bare") */
	label: string;
	/** Transmit power in dBm (range: -30 to 47) */
	txPowerDbm: number;
	/** Transmit antenna gain in dBi (range: -5 to 30) */
	antennaGainDbi: number;
	/** Receive antenna gain in dBi (range: -5 to 30, default 0) */
	rxAntennaGainDbi: number;
	/** Receiver sensitivity threshold in dBm (range: -120 to -20) */
	sensitivityDbm: number;
	/** Antenna height above ground level in meters (range: 0.5 to 100) */
	heightAglMeters: number;
	/** Active propagation model */
	propagationModel: PropagationModel;
}

/** Signal quality band key for RF range overlay */
export type RFBandKey = 'strong' | 'usable' | 'marginal' | 'maximum';

/** A concentric signal quality zone within the RF range overlay */
export interface RFRangeBand {
	/** Outer radius in meters */
	outerR: number;
	/** Inner radius in meters (0 for innermost band) */
	innerR: number;
	/** Band quality key */
	band: RFBandKey;
	/** Resolved hex color for MapLibre rendering */
	color: string;
	/** Signal margin label (e.g., "> 12 dB margin") */
	marginLabel: string;
	/** Distance label (e.g., "2.4 km") */
	distanceLabel: string;
}

/** Computed RF range state derived from profile + active frequency + GPS */
export interface RFRangeState {
	/** Whether the RF range overlay is enabled by the user */
	isEnabled: boolean;
	/** The active profile (preset or custom) */
	activeProfile: RFRangeProfile;
	/** Active frequency in Hz (from HackRF SSE stream or manual entry) */
	frequencyHz: number;
	/** Frequency source: 'auto' (from SDR) or 'manual' (user-entered) */
	frequencySource: FrequencySource;
	/** Computed maximum range in meters (Friis result, before capping) */
	computedMaxRangeMeters: number;
	/** Display range in meters (after min/max capping) */
	displayRangeMeters: number;
	/** Whether the display range is capped */
	isCapped: boolean;
	/** Computed range bands for rendering */
	rangeBands: RFRangeBand[];
	/** Whether all prerequisites are met (SDR connected + GPS fix) */
	isActive: boolean;
	/** Reason the overlay is inactive, if applicable */
	inactiveReason: string | null;
}

/** Persisted store shape for RF range configuration */
export interface RFRangeStoreState {
	isEnabled: boolean;
	activePresetId: string;
	customProfile: RFRangeProfile;
	frequencySource: FrequencySource;
	manualFrequencyMHz: number;
}

// ── Validation ranges ────────────────────────────────────────────────

export const RF_PROFILE_LIMITS = {
	TX_POWER_MIN_DBM: -30,
	TX_POWER_MAX_DBM: 47,
	ANTENNA_GAIN_MIN_DBI: -5,
	ANTENNA_GAIN_MAX_DBI: 30,
	SENSITIVITY_MIN_DBM: -120,
	SENSITIVITY_MAX_DBM: -20,
	HEIGHT_MIN_M: 0.5,
	HEIGHT_MAX_M: 100,
	FREQUENCY_MIN_MHZ: 1,
	FREQUENCY_MAX_MHZ: 6000
} as const;

// ── Hardware presets ─────────────────────────────────────────────────

export const RF_RANGE_PRESETS: readonly RFRangeProfile[] = [
	{
		id: 'hackrf-bare',
		label: 'HackRF Bare',
		txPowerDbm: 10,
		antennaGainDbi: 0,
		rxAntennaGainDbi: 0,
		sensitivityDbm: -90,
		heightAglMeters: 1.5,
		propagationModel: 'free-space'
	},
	{
		id: 'hackrf-amplifier',
		label: 'HackRF + Amplifier',
		txPowerDbm: 20,
		antennaGainDbi: 0,
		rxAntennaGainDbi: 0,
		sensitivityDbm: -90,
		heightAglMeters: 1.5,
		propagationModel: 'free-space'
	},
	{
		id: 'hackrf-directional',
		label: 'HackRF + Directional',
		txPowerDbm: 10,
		antennaGainDbi: 12,
		rxAntennaGainDbi: 0,
		sensitivityDbm: -90,
		heightAglMeters: 1.5,
		propagationModel: 'free-space'
	}
] as const;

/** Look up a preset by ID, returns undefined if not found */
export function getPresetById(id: string): RFRangeProfile | undefined {
	return RF_RANGE_PRESETS.find((p) => p.id === id);
}

/** Default custom profile — initialized from HackRF Bare */
export const DEFAULT_CUSTOM_PROFILE: RFRangeProfile = {
	id: 'custom',
	label: 'Custom',
	txPowerDbm: 10,
	antennaGainDbi: 0,
	rxAntennaGainDbi: 0,
	sensitivityDbm: -90,
	heightAglMeters: 1.5,
	propagationModel: 'free-space'
};
