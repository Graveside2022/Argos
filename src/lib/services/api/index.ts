/**
 * API Services Module
 *
 * Central export point for all REST API client services: HackRF, Kismet,
 * and System APIs with shared configuration, error handling, and retry logic.
 */

// --- config ---
export {
	API_BASE_URL,
	API_ENDPOINTS,
	APIError,
	WS_ENDPOINTS,
	buildQueryString,
	defaultRequestOptions,
	handleResponse,
	retryRequest,
	withTimeout,
} from "./config";
export type { RetryConfig } from "./config";

// --- hackrf ---
export { hackrfAPI } from "./hackrf";
export type {
	HackRFConfig,
	HackRFStatus,
	SignalDetection,
	SpectrumData,
	SweepResult,
} from "./hackrf";

// --- kismet ---
export { kismetAPI } from "./kismet";
export type {
	DeviceFilter,
	KismetConfig,
	KismetDevice,
	KismetScript,
	KismetStats,
	KismetStatus,
} from "./kismet";

// --- system ---
export { systemAPI } from "./system";
export type {
	LogEntry,
	NetworkInterface,
	ServiceStatus,
	SystemHealth,
	SystemInfo,
} from "./system";

// --- example-usage ---
export { hackrfExample, kismetExample, systemExample } from "./example-usage";
