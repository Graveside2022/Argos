/**
 * Centralized constants for the Argos application.
 * Replaces magic numbers with named, documented values.
 */

// ─── RF / GSM Limits ───────────────────────────────────────────────

// Safe: Object literal narrowed to const for readonly constant configuration values
export const GSM_LIMITS = {
	FREQ_MIN_MHZ: 800,
	FREQ_MAX_MHZ: 2000,
	GAIN_MIN_DB: 0,
	GAIN_MAX_DB: 60
} as const;

// ─── Geographic Constants ──────────────────────────────────────────

// Safe: Object literal narrowed to const for readonly geographic constant configuration
export const GEO = {
	/** Earth radius in meters (WGS84 mean) */
	EARTH_RADIUS_M: 6371000,
	/** Default search radius for nearby signals in meters */
	DEFAULT_SEARCH_RADIUS_M: 100,
	/** Minimum signal power for nearby search in dBm */
	DEFAULT_MIN_POWER_DBM: -100
} as const;
