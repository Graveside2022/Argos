/**
 * Shared HTTP API client for MCP servers
 * Communicates with running Argos app via authenticated API calls
 */

const ARGOS_API = process.env.ARGOS_API_URL || 'http://localhost:5173';

export interface ApiFetchOptions extends globalThis.RequestInit {
	timeout?: number;
}

/**
 * Fetch helper with authentication, timeout, and error handling
 */
/** Build auth headers (API key if present). */
function buildAuthHeaders(): Record<string, string> {
	const apiKey = process.env.ARGOS_API_KEY || '';
	return apiKey ? { 'X-API-Key': apiKey } : {};
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
	const { timeout = 15000, ...fetchOptions } = options;
	const resp = await fetch(`${ARGOS_API}${path}`, {
		...fetchOptions,
		signal: AbortSignal.timeout(timeout),
		headers: {
			'Content-Type': 'application/json',
			...buildAuthHeaders(),
			...fetchOptions.headers
		}
	});
	if (!resp.ok) throw new Error(`Argos API error: ${resp.status} ${resp.statusText} for ${path}`);
	return resp;
}

/**
 * Get error message for connection failures
 */
export function getConnectionErrorMessage(): string {
	return `Error: Cannot reach Argos at ${ARGOS_API}. Is the Argos dev server running? (npm run dev)`;
}
