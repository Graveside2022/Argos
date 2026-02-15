/**
 * Shared API Module
 *
 * Shared API configuration, utilities, and type definitions
 * used across multiple feature modules.
 */

// --- config ---
export {
	API_BASE_URL,
	API_ENDPOINTS,
	APIError,
	defaultRequestOptions,
	handleResponse,
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
