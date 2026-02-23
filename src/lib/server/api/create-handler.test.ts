import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createHandler } from './create-handler';

/** Build a Request from optional body */
function buildRequest(url: URL, body?: unknown): Request {
	const hasBody = body !== undefined;
	return new Request(url, {
		method: hasBody ? 'POST' : 'GET',
		body: hasBody ? JSON.stringify(body) : undefined,
		headers: hasBody ? { 'Content-Type': 'application/json' } : {}
	});
}

/** Create a minimal mock RequestEvent */
function mockEvent(overrides: { pathname?: string; body?: unknown } = {}) {
	const url = new URL(`http://localhost:5173${overrides.pathname ?? '/api/test'}`);

	return {
		url,
		request: buildRequest(url, overrides.body),
		params: {},
		route: { id: overrides.pathname ?? '/api/test' },
		cookies: {
			get: vi.fn(),
			set: vi.fn(),
			delete: vi.fn(),
			getAll: vi.fn(),
			serialize: vi.fn()
		},
		locals: {},
		platform: undefined,
		isDataRequest: false,
		isSubRequest: false,
		fetch: vi.fn()
	} as unknown as Parameters<ReturnType<typeof createHandler>>[0];
}

describe('createHandler', () => {
	it('wraps a plain object result in json()', async () => {
		const handler = createHandler(async () => ({ signals: [1, 2, 3] }));
		const response = await handler(mockEvent());

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.signals).toEqual([1, 2, 3]);
	});

	it('passes through Response objects untouched', async () => {
		const customResponse = new Response('custom', { status: 201 });
		const handler = createHandler(async () => customResponse);
		const response = await handler(mockEvent());

		expect(response.status).toBe(201);
		expect(await response.text()).toBe('custom');
	});

	it('catches errors and returns 500 with generic message', async () => {
		const handler = createHandler(async () => {
			throw new Error('db connection failed');
		});
		const response = await handler(mockEvent());

		expect(response.status).toBe(500);
		const body = await response.json();
		expect(body.success).toBe(false);
		expect(body.error).toBe('Internal server error');
	});

	it('uses custom errorStatus when provided', async () => {
		const handler = createHandler(
			async () => {
				throw new Error('not found');
			},
			{ errorStatus: 503 }
		);
		const response = await handler(mockEvent());
		expect(response.status).toBe(503);
	});

	it('validates request body with Zod schema', async () => {
		const schema = z.object({ name: z.string(), age: z.number() });
		const handler = createHandler(
			async ({ request }) => {
				const body = await request.json();
				return { received: body };
			},
			{ validateBody: schema }
		);

		// Valid body
		const validResponse = await handler(mockEvent({ body: { name: 'test', age: 25 } }));
		expect(validResponse.status).toBe(200);

		// Invalid body
		const invalidResponse = await handler(mockEvent({ body: { name: 123 } }));
		expect(invalidResponse.status).toBe(400);
		const errorBody = await invalidResponse.json();
		expect(errorBody.success).toBe(false);
		expect(errorBody.error).toBe('Validation failed');
		expect(errorBody.details).toBeDefined();
	});

	it('works with synchronous handler functions', async () => {
		const handler = createHandler(() => ({ sync: true }));
		const response = await handler(mockEvent());

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.sync).toBe(true);
	});

	it('handles non-Error thrown values', async () => {
		const handler = createHandler(async () => {
			throw 'string error';
		});
		const response = await handler(mockEvent());

		expect(response.status).toBe(500);
		const body = await response.json();
		expect(body.success).toBe(false);
	});

	it('uses URL pathname as default logging context', async () => {
		const logSpy = vi.fn();
		const originalError = (await import('$lib/utils/logger')).logger.error;
		const { logger } = await import('$lib/utils/logger');
		logger.error = logSpy;

		const handler = createHandler(async () => {
			throw new Error('test error');
		});
		await handler(mockEvent({ pathname: '/api/custom-path' }));

		expect(logSpy).toHaveBeenCalledWith('[/api/custom-path] test error');

		logger.error = originalError;
	});

	it('uses method option as logging context when provided', async () => {
		const logSpy = vi.fn();
		const { logger } = await import('$lib/utils/logger');
		const originalError = logger.error;
		logger.error = logSpy;

		const handler = createHandler(
			async () => {
				throw new Error('fail');
			},
			{ method: 'GET /signals' }
		);
		await handler(mockEvent());

		expect(logSpy).toHaveBeenCalledWith('[GET /signals] fail');

		logger.error = originalError;
	});
});
