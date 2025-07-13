/**
 * Test-specific type utilities for type-safe test assertions
 */

import { vi, expect, type Mock } from 'vitest';
import type { DatabaseError } from '$lib/types/errors';

/**
 * Type for database statement mocks
 */
export interface MockDatabaseStatement {
	get: Mock;
	all: Mock;
	run: Mock;
	prepare?: Mock;
}

/**
 * Type for database mock
 */
export interface MockDatabase {
	prepare: Mock<(source: string) => MockDatabaseStatement>;
	close?: Mock;
	exec?: Mock;
}

/**
 * Create a typed mock database statement
 */
export function createMockStatement(
	overrides?: Partial<MockDatabaseStatement>
): MockDatabaseStatement {
	return {
		get: vi.fn(),
		all: vi.fn(),
		run: vi.fn(),
		...overrides
	};
}

/**
 * Type guard for test errors with code property
 */
export function isTestErrorWithCode(error: unknown): error is Error & { code: string } {
	return (
		error instanceof Error &&
		'code' in error &&
		typeof (error as Error & { code: unknown }).code === 'string'
	);
}

/**
 * Assert error has expected code
 */
export function assertErrorCode(
	error: unknown,
	expectedCode: string
): asserts error is DatabaseError {
	if (!isTestErrorWithCode(error)) {
		throw new Error(`Expected error with code property, got: ${error}`);
	}

	if (error.code !== expectedCode) {
		throw new Error(`Expected error code "${expectedCode}", got "${error.code}"`);
	}
}

/**
 * Type-safe expectation helpers
 */
export const expectError = {
	/**
	 * Expect an error with a specific code
	 */
	withCode: (error: unknown, code: string) => {
		expect(isTestErrorWithCode(error)).toBe(true);
		if (isTestErrorWithCode(error)) {
			expect(error.code).toBe(code);
		}
	},

	/**
	 * Expect an error with a specific message
	 */
	withMessage: (error: unknown, message: string) => {
		expect(error).toBeInstanceOf(Error);
		if (error instanceof Error) {
			expect(error.message).toBe(message);
		}
	},

	/**
	 * Expect an error to match a pattern
	 */
	matching: (error: unknown, pattern: RegExp) => {
		expect(error).toBeInstanceOf(Error);
		if (error instanceof Error) {
			expect(error.message).toMatch(pattern);
		}
	}
};

/**
 * Mock response builder for fetch mocks
 */
export function mockResponse<T>(data: T, options?: Partial<Response>): Response {
	return {
		ok: true,
		status: 200,
		statusText: 'OK',
		headers: new Headers(),
		json: async () => data,
		text: async () => JSON.stringify(data),
		blob: async () => new Blob([JSON.stringify(data)]),
		arrayBuffer: async () => new ArrayBuffer(0),
		formData: async () => new FormData(),
		clone: () => mockResponse(data, options),
		...options
	} as Response;
}

/**
 * Mock error response builder
 */
export function mockErrorResponse(status: number, message?: string): Response {
	return mockResponse(
		{ error: message || 'Error' },
		{
			ok: false,
			status,
			statusText: message || 'Error'
		}
	);
}

/**
 * Type-safe mock builder
 */
export function createTypedMock<T>(): Mock<() => T> {
	return vi.fn<() => T>();
}

/**
 * Async delay helper for testing
 */
export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a deferred promise for testing async operations
 */
export interface DeferredPromise<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (error: unknown) => void;
}

export function createDeferred<T>(): DeferredPromise<T> {
	let resolve: (value: T) => void = () => {};
	let reject: (error: unknown) => void = () => {};

	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return {
		promise,
		resolve,
		reject
	};
}
