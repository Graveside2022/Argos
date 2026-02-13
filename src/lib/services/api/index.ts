/**
 * API Services Module
 *
 * Central export point for HackRF and Kismet REST API client services
 * with shared configuration, error handling, and retry logic.
 */

// --- config ---
export type { RetryConfig } from './config';
export {
	API_BASE_URL,
	API_ENDPOINTS,
	APIError,
	buildQueryString,
	defaultRequestOptions,
	handleResponse,
	retryRequest,
	withTimeout,
	WS_ENDPOINTS
} from './config';

// --- hackrf ---
export type {
	HackRFConfig,
	HackRFStatus,
	SignalDetection,
	SpectrumData,
	SweepResult
} from './hackrf';
export { hackrfAPI } from './hackrf';

// --- kismet ---
export type {
	DeviceFilter,
	KismetConfig,
	KismetDevice,
	KismetScript,
	KismetStats,
	KismetStatus
} from '$lib/kismet/api';
export { kismetAPI } from '$lib/kismet/api';
