/**
 * Validation limits for RF operations
 * Used for input validation to prevent command injection
 */

export const GSM_LIMITS = {
	FREQ_MIN_MHZ: 800,
	FREQ_MAX_MHZ: 2000,
	GAIN_MIN_DB: 0,
	GAIN_MAX_DB: 60
} as const;

export const TIMEOUTS = {
	KISMET_RECONNECT_DELAY_MS: 5000,
	KISMET_CACHE_TIMEOUT_MS: 30000,
	KISMET_POLL_INTERVAL_MS: 5000,
	GSM_INIT_DELAY_MS: 2500,
	GSM_CAPTURE_TIME_SEC: 15,
	GSM_CLEANUP_DELAY_MS: 500,
	ONE_HOUR_MS: 60 * 60 * 1000
} as const;

export const RESOURCE_LIMITS = {
	MAX_DATA_POINTS: 1000,
	MAX_WEBSOCKET_CLIENTS: 100,
	MAX_RECONNECT_ATTEMPTS: 10
} as const;
