/**
 * Server availability check for integration/security tests.
 * Tests that require a running dev server should use this to skip gracefully.
 *
 * Usage in test files:
 *   import { setupIntegrationTest } from '../helpers/server-check';
 *   const { serverAvailable } = await setupIntegrationTest();
 *   describe.runIf(serverAvailable)('My Integration Tests', () => { ... });
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:5173';

// Use the real (unmocked) fetch for server checks
const realFetch: typeof fetch =
	(globalThis as typeof globalThis & { __realFetch?: typeof fetch }).__realFetch ??
	globalThis.fetch;

let _serverAvailable: boolean | null = null;

/**
 * Check if the Argos dev server is running and accessible.
 * Results are cached for the duration of the test run.
 */
export async function isServerAvailable(): Promise<boolean> {
	if (_serverAvailable !== null) return _serverAvailable;

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 2000);
		const response = await realFetch(`${BASE_URL}/api/health`, {
			signal: controller.signal
		});
		clearTimeout(timeout);
		_serverAvailable = response.ok;
	} catch {
		_serverAvailable = false;
	}
	return _serverAvailable;
}

/**
 * Restore real fetch and check server availability.
 * Call at the top of integration test files that need real HTTP.
 */
export function restoreRealFetch(): void {
	const realFetch = (globalThis as typeof globalThis & { __realFetch?: typeof fetch })
		.__realFetch;
	if (realFetch) {
		globalThis.fetch = realFetch;
	}
}

/** Common security/integration test setup: restores real fetch, provides BASE_URL, API_KEY, and canRun flag. */
export async function setupSecurityTest() {
	restoreRealFetch();
	const baseUrl = 'http://localhost:5173';
	const apiKey = process.env.ARGOS_API_KEY || '';
	const canRun = apiKey.length >= 32 && (await isServerAvailable());
	return { BASE_URL: baseUrl, API_KEY: apiKey, canRun };
}
