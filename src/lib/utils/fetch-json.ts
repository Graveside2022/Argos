/**
 * Typed client-side fetch wrapper for JSON API calls.
 * Handles try-catch, response.ok check, and JSON parsing.
 * Returns null on failure with console.error logging.
 *
 * For use in client-side code (stores, components, .svelte.ts files).
 * Server-side code should use direct fetch with proper error handling.
 */
export async function fetchJSON<T>(
	url: string,
	options?: globalThis.RequestInit
): Promise<T | null> {
	try {
		const res = await fetch(url, options);
		if (!res.ok) return null;
		return (await res.json()) as T;
	} catch (error: unknown) {
		console.error(`[fetchJSON] ${options?.method ?? 'GET'} ${url} failed:`, error);
		return null;
	}
}
