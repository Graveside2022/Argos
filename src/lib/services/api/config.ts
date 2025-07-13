/**
 * API Configuration and utilities for frontend services
 */

// Get API base URL from environment or default to localhost
export const API_BASE_URL =
	(import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:5173';

// API endpoints configuration
export const API_ENDPOINTS = {
	hackrf: `${API_BASE_URL}/api/hackrf`,
	kismet: `${API_BASE_URL}/api/kismet`,
	system: `${API_BASE_URL}/api/system`,
	wigle: `${API_BASE_URL}/api/wigle`
} as const;

// WebSocket endpoints
export const WS_ENDPOINTS = {
	hackrf: `ws://localhost:5173/ws/hackrf`, // WebSocket will upgrade from HTTP
	kismet: `ws://localhost:5173/ws/kismet`
} as const;

/**
 * API Error class for consistent error handling
 */
export class APIError extends Error {
	constructor(
		message: string,
		public status?: number,
		public code?: string,
		public details?: unknown
	) {
		super(message);
		this.name = 'APIError';
	}
}

/**
 * Default request options
 */
export const defaultRequestOptions: globalThis.RequestInit = {
	headers: {
		'Content-Type': 'application/json'
	},
	credentials: 'same-origin'
};

/**
 * Handle API response and extract data
 */
export async function handleResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		let errorData: { message?: string; code?: string; details?: unknown } = {};
		try {
			errorData = (await response.json()) as {
				message?: string;
				code?: string;
				details?: unknown;
			};
		} catch {
			// Response might not be JSON
		}

		throw new APIError(
			errorData.message || `HTTP ${response.status}: ${response.statusText}`,
			response.status,
			errorData.code,
			errorData.details
		);
	}

	// Handle empty responses
	if (response.status === 204 || response.headers.get('content-length') === '0') {
		return {} as T;
	}

	try {
		return (await response.json()) as T;
	} catch {
		throw new APIError('Invalid JSON response from server');
	}
}

/**
 * Build query string from parameters
 */
export function buildQueryString(
	params: Record<string, string | number | boolean | null | undefined>
): string {
	const searchParams = new URLSearchParams();

	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined && value !== null) {
			searchParams.append(key, String(value));
		}
	});

	const queryString = searchParams.toString();
	return queryString ? `?${queryString}` : '';
}

/**
 * Retry configuration
 */
export interface RetryConfig {
	maxAttempts?: number;
	delay?: number;
	backoff?: boolean;
}

/**
 * Retry a request with exponential backoff
 */
export async function retryRequest<T>(
	request: () => Promise<T>,
	config: RetryConfig = {}
): Promise<T> {
	const { maxAttempts = 3, delay = 1000, backoff = true } = config;

	let lastError: Error | undefined;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await request();
		} catch (error) {
			lastError = error as Error;

			if (attempt === maxAttempts) {
				break;
			}

			// Don't retry client errors (4xx)
			if (
				error instanceof APIError &&
				error.status &&
				error.status >= 400 &&
				error.status < 500
			) {
				throw error;
			}

			const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay;
			await new Promise((resolve) => setTimeout(resolve, waitTime));
		}
	}

	throw lastError || new Error('Request failed');
}

/**
 * Create a timeout promise
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) =>
			setTimeout(() => reject(new APIError('Request timeout', 408)), timeoutMs)
		)
	]);
}
