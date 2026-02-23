import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TimeoutError, withTimeout } from './timeout';

/**
 * Create a promise that never resolves.
 * Used in timeout tests to guarantee the timeout fires
 * without leaving dangling resolved promises.
 */
function neverResolves(): Promise<string> {
	return new Promise(() => {
		// Intentionally never resolves or rejects
	});
}

describe('withTimeout', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns the result when operation completes before timeout', async () => {
		const fn = vi.fn().mockResolvedValue('fast result');

		const timedFn = withTimeout(fn, { timeoutMs: 5000 });
		const result = await timedFn();

		expect(result).toBe('fast result');
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('throws TimeoutError when operation exceeds timeout', async () => {
		const fn = vi.fn().mockImplementation(() => neverResolves());

		const timedFn = withTimeout(fn, { timeoutMs: 1000 });
		const promise = timedFn();

		// Attach catch early to prevent unhandled rejection during timer advance
		const settled = promise.catch((err: unknown) => err);

		await vi.advanceTimersByTimeAsync(1000);

		const result = await settled;
		expect(result).toBeInstanceOf(TimeoutError);
		expect((result as TimeoutError).message).toBe('Operation timed out after 1000ms');
	});

	it('uses custom error message when provided', async () => {
		const fn = vi.fn().mockImplementation(() => neverResolves());

		const timedFn = withTimeout(fn, {
			timeoutMs: 500,
			message: 'GPS fix acquisition timed out'
		});
		const promise = timedFn();

		const settled = promise.catch((err: unknown) => err);

		await vi.advanceTimersByTimeAsync(500);

		const result = await settled;
		expect(result).toBeInstanceOf(TimeoutError);
		expect((result as TimeoutError).message).toBe('GPS fix acquisition timed out');
	});

	it('TimeoutError has correct properties', async () => {
		const fn = vi.fn().mockImplementation(() => neverResolves());

		const timedFn = withTimeout(fn, { timeoutMs: 2000 });
		const promise = timedFn();

		const settled = promise.catch((err: unknown) => err);

		await vi.advanceTimersByTimeAsync(2000);

		const result = await settled;
		expect(result).toBeInstanceOf(TimeoutError);
		expect(result).toBeInstanceOf(Error);
		const timeoutErr = result as TimeoutError;
		expect(timeoutErr.name).toBe('TimeoutError');
		expect(timeoutErr.timeoutMs).toBe(2000);
		expect(timeoutErr.message).toBe('Operation timed out after 2000ms');
	});

	it('cleans up timer after successful resolution', async () => {
		const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

		const fn = vi.fn().mockResolvedValue('done');
		const timedFn = withTimeout(fn, { timeoutMs: 5000 });

		await timedFn();

		expect(clearTimeoutSpy).toHaveBeenCalled();
		clearTimeoutSpy.mockRestore();
	});

	it('propagates errors from the wrapped function', async () => {
		const fn = vi.fn().mockRejectedValue(new Error('network failure'));

		const timedFn = withTimeout(fn, { timeoutMs: 5000 });

		await expect(timedFn()).rejects.toThrow('network failure');
	});
});
