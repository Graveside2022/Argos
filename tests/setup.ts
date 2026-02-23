import '@testing-library/jest-dom';

import { config } from 'dotenv';
import { vi } from 'vitest';

// Load .env for test environment (provides ARGOS_API_KEY and other env vars)
config();

// Set test API key if not present in .env (allows unit tests to run without .env)
if (!process.env.ARGOS_API_KEY) {
	process.env.ARGOS_API_KEY = 'test-api-key-for-vitest-minimum-32-chars-required';
}

// Mock WebSocket
global.WebSocket = vi.fn(() => ({
	send: vi.fn(),
	close: vi.fn(),
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
	readyState: 1,
	CONNECTING: 0,
	OPEN: 1,
	CLOSING: 2,
	CLOSED: 3
})) as unknown as typeof WebSocket;

// Store original fetch for integration tests that need real HTTP calls
(globalThis as typeof globalThis & { __realFetch?: typeof fetch }).__realFetch = globalThis.fetch;

// Mock fetch for unit tests (integration tests restore real fetch via __realFetch)
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn()
};
// Safe: Test: Mock object typed for test expectations
global.localStorage = localStorageMock as unknown as Storage;

// Mock canvas — Proxy auto-stubs any property access (methods return vi.fn(), values return sensible defaults)
HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextId: string) => {
	if (contextId === '2d') {
		const fnCache = new Map<string | symbol, ReturnType<typeof vi.fn>>();
		return new Proxy(
			{ canvas: document.createElement('canvas') },
			{
				get(target, prop) {
					if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
					if (prop === 'measureText')
						return vi.fn(() => ({ width: 0, actualBoundingBoxAscent: 0 }));
					if (prop === 'getImageData' || prop === 'createImageData')
						return vi.fn(() => ({
							data: new Uint8ClampedArray(4),
							width: 1,
							height: 1
						}));
					if (!fnCache.has(prop)) fnCache.set(prop, vi.fn());
					return fnCache.get(prop);
				},
				set(target, prop, value) {
					(target as Record<string | symbol, unknown>)[prop] = value;
					return true;
				}
			}
		) as unknown as CanvasRenderingContext2D;
	}
	return null;
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn()
})) as unknown as typeof ResizeObserver;

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn()
})) as unknown as typeof IntersectionObserver;
