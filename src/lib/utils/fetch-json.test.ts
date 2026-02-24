import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchJSON } from './fetch-json';

describe('fetchJSON', () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it('returns parsed JSON on success', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ name: 'test' })
		});

		const result = await fetchJSON<{ name: string }>('/api/test');
		expect(result).toEqual({ name: 'test' });
	});

	it('returns null on non-ok response', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500
		});

		const result = await fetchJSON('/api/test');
		expect(result).toBeNull();
	});

	it('returns null and logs on network error', async () => {
		globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

		const result = await fetchJSON('/api/test');
		expect(result).toBeNull();
		expect(console.error).toHaveBeenCalledWith(
			'[fetchJSON] GET /api/test failed:',
			expect.any(Error)
		);
	});

	it('passes options through to fetch', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ success: true })
		});

		await fetchJSON('/api/test', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data: 1 })
		});

		expect(globalThis.fetch).toHaveBeenCalledWith('/api/test', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data: 1 })
		});
	});

	it('logs method name in error for non-GET requests', async () => {
		globalThis.fetch = vi.fn().mockRejectedValue(new Error('fail'));

		await fetchJSON('/api/test', { method: 'DELETE' });
		expect(console.error).toHaveBeenCalledWith(
			'[fetchJSON] DELETE /api/test failed:',
			expect.any(Error)
		);
	});
});
