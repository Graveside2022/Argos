/**
 * Centralized constants for the Argos application.
 * Replaces magic numbers with named, documented values.
 */

// ─── RF / GSM Limits ───────────────────────────────────────────────

export const GSM_LIMITS = {
	FREQ_MIN_MHZ: 800,
	FREQ_MAX_MHZ: 2000,
	GAIN_MIN_DB: 0,
	GAIN_MAX_DB: 60
} as const;

export const HACKRF_LIMITS = {
	FREQ_MIN_MHZ: 1,
	FREQ_MAX_MHZ: 6000,
	SAMPLE_RATE_HZ: 20_000_000,
	BANDWIDTH_HZ: 20_000_000
} as const;

// ─── Service Ports ─────────────────────────────────────────────────

export const PORTS = {
	ARGOS_WEB: 5173,
	HACKRF_API: 8092,
	KISMET_REST: 2501,
	HACKRF_CONTROL: 3002,
	SPECTRUM_WEB: 8073,
	BETTERCAP: 8081
} as const;

// ─── Timeouts & Intervals ──────────────────────────────────────────

export const TIMEOUTS = {
	/** Delay between Kismet reconnection attempts */
	KISMET_RECONNECT_DELAY_MS: 5000,
	/** How long Kismet cache entries remain valid */
	KISMET_CACHE_TIMEOUT_MS: 30000,
	/** Kismet polling interval when event streaming unavailable */
	KISMET_POLL_INTERVAL_MS: 5000,
	/** Delay before initializing GSM scanner */
	GSM_INIT_DELAY_MS: 2500,
	/** GSM capture duration per frequency */
	GSM_CAPTURE_TIME_SEC: 15,
	/** Post-capture cleanup delay */
	GSM_CLEANUP_DELAY_MS: 500,
	/** One hour in milliseconds */
	ONE_HOUR_MS: 60 * 60 * 1000,
	/** Standard process startup wait */
	PROCESS_STARTUP_DELAY_MS: 2000,
	/** Short operation delay */
	SHORT_DELAY_MS: 1000,
	/** Service health check interval */
	HEALTH_CHECK_INTERVAL_MS: 30000,
	/** Cache cleanup interval */
	CACHE_CLEANUP_INTERVAL_MS: 60000,
	/** Hardware detection refresh interval */
	HARDWARE_REFRESH_INTERVAL_MS: 30000,
	/** WebSocket heartbeat interval */
	WEBSOCKET_HEARTBEAT_MS: 30000
} as const;

// ─── Resource Limits ───────────────────────────────────────────────

export const RESOURCE_LIMITS = {
	MAX_DATA_POINTS: 1000,
	MAX_WEBSOCKET_CLIENTS: 100,
	MAX_RECONNECT_ATTEMPTS: 10,
	/** Maximum devices to return in a single API response */
	MAX_DEVICE_RESPONSE: 50,
	/** Maximum signal history entries */
	MAX_SIGNAL_HISTORY: 500,
	/** Node.js max old space size in MB */
	NODE_MAX_OLD_SPACE_MB: 1024
} as const;

// ─── Geographic Constants ──────────────────────────────────────────

export const GEO = {
	/** Earth radius in meters (WGS84 mean) */
	EARTH_RADIUS_M: 6371000,
	/** Default search radius for nearby signals in meters */
	DEFAULT_SEARCH_RADIUS_M: 100,
	/** Minimum signal power for nearby search in dBm */
	DEFAULT_MIN_POWER_DBM: -100
} as const;
