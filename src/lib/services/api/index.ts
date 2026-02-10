/**
 * API Services Module
 *
 * Central export point for HackRF and Kismet REST API client services
 * with shared configuration, error handling, and retry logic.
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
	withTimeout
} from './config';
export type { RetryConfig } from './config';

// --- hackrf ---
export { hackrfAPI } from './hackrf';
export type {
	HackRFConfig,
	HackRFStatus,
	SignalDetection,
	SpectrumData,
	SweepResult
} from './hackrf';

// --- kismet ---
export { kismetAPI } from './kismet';
export type {
	DeviceFilter,
	KismetConfig,
	KismetDevice,
	KismetScript,
	KismetStats,
	KismetStatus
} from './kismet';
