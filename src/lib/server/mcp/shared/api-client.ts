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
export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
	const { timeout = 15000, ...fetchOptions } = options;
	const url = `${ARGOS_API}${path}`;
	const apiKey = process.env.ARGOS_API_KEY || '';

	const resp = await fetch(url, {
		...fetchOptions,
		signal: AbortSignal.timeout(timeout),
		headers: {
			'Content-Type': 'application/json',
			...(apiKey ? { 'X-API-Key': apiKey } : {}),
			...fetchOptions.headers
		}
	});

	if (!resp.ok) {
		throw new Error(`Argos API error: ${resp.status} ${resp.statusText} for ${path}`);
	}

	return resp;
}

/**
 * Check if Argos app is reachable
 */
export async function checkArgosConnection(): Promise<boolean> {
	try {
		const resp = await apiFetch('/api/health', { timeout: 3000 });
		return resp.ok;
	} catch {
		return false;
	}
}

/**
 * Get error message for connection failures
 */
export function getConnectionErrorMessage(): string {
	return `Error: Cannot reach Argos at ${ARGOS_API}. Is the Argos dev server running? (npm run dev)`;
}
