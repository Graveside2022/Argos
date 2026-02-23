import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withRetry } from './retry';

describe('withRetry', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('succeeds on first try without retrying', async () => {
		const fn = vi.fn().mockResolvedValue('ok');
		const retryFn = withRetry(fn);

		const result = await retryFn();

		expect(result).toBe('ok');
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('retries on failure then succeeds', async () => {
		const fn = vi
			.fn()
			.mockRejectedValueOnce(new Error('fail-1'))
			.mockResolvedValue('recovered');

		const retryFn = withRetry(fn, { attempts: 3, delayMs: 100 });
		const promise = retryFn();

		await vi.advanceTimersByTimeAsync(100);

		const result = await promise;
		expect(result).toBe('recovered');
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('throws the last error after exhausting all attempts', async () => {
		const fn = vi
			.fn()
			.mockRejectedValueOnce(new Error('fail-1'))
			.mockRejectedValueOnce(new Error('fail-2'))
			.mockRejectedValueOnce(new Error('fail-3'));

		const retryFn = withRetry(fn, { attempts: 3, delayMs: 50 });
		const promise = retryFn();

		// Attach a catch handler early to prevent unhandled rejection warnings
		// while we advance timers for the retry delays
		const settled = promise.catch((err: unknown) => err);

		await vi.advanceTimersByTimeAsync(50);
		await vi.advanceTimersByTimeAsync(100);

		const result = await settled;
		expect(result).toBeInstanceOf(Error);
		expect((result as Error).message).toBe('fail-3');
		expect(fn).toHaveBeenCalledTimes(3);
	});

	it('applies exponential backoff delays', async () => {
		const fn = vi
			.fn()
			.mockRejectedValueOnce(new Error('fail-1'))
			.mockRejectedValueOnce(new Error('fail-2'))
			.mockResolvedValue('ok');

		const retryFn = withRetry(fn, {
			attempts: 3,
			delayMs: 100,
			backoff: 'exponential'
		});
		const promise = retryFn();

		// First retry: 100 * 2^0 = 100ms
		expect(fn).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(99);
		expect(fn).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(fn).toHaveBeenCalledTimes(2);

		// Second retry: 100 * 2^1 = 200ms
		await vi.advanceTimersByTimeAsync(199);
		expect(fn).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(1);
		expect(fn).toHaveBeenCalledTimes(3);

		const result = await promise;
		expect(result).toBe('ok');
	});

	it('applies linear backoff delays', async () => {
		const fn = vi
			.fn()
			.mockRejectedValueOnce(new Error('fail-1'))
			.mockRejectedValueOnce(new Error('fail-2'))
			.mockResolvedValue('ok');

		const retryFn = withRetry(fn, {
			attempts: 3,
			delayMs: 100,
			backoff: 'linear'
		});
		const promise = retryFn();

		// First retry: 100ms (linear = constant)
		await vi.advanceTimersByTimeAsync(100);
		expect(fn).toHaveBeenCalledTimes(2);

		// Second retry: still 100ms (not 200ms like exponential)
		await vi.advanceTimersByTimeAsync(100);
		expect(fn).toHaveBeenCalledTimes(3);

		const result = await promise;
		expect(result).toBe('ok');
	});

	it('stops retrying when shouldRetry returns false', async () => {
		const fn = vi
			.fn()
			.mockRejectedValueOnce(new Error('non-retryable'))
			.mockResolvedValue('should not reach');

		const retryFn = withRetry(fn, {
			attempts: 5,
			delayMs: 100,
			shouldRetry: (err) => err.message !== 'non-retryable'
		});

		await expect(retryFn()).rejects.toThrow('non-retryable');
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('works with default options (3 attempts, exponential, 1000ms)', async () => {
		const fn = vi.fn().mockRejectedValueOnce(new Error('fail-1')).mockResolvedValue('ok');

		const retryFn = withRetry(fn);
		const promise = retryFn();

		// Default: 1000 * 2^0 = 1000ms
		await vi.advanceTimersByTimeAsync(1000);

		const result = await promise;
		expect(result).toBe('ok');
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('normalizes non-Error thrown values', async () => {
		const fn = vi.fn().mockRejectedValueOnce('string error').mockRejectedValueOnce(42);

		const retryFn = withRetry(fn, { attempts: 2, delayMs: 10 });
		const promise = retryFn();

		// Attach catch handler early to prevent unhandled rejection during timer advance
		const settled = promise.catch((err: unknown) => err);

		await vi.advanceTimersByTimeAsync(10);

		const result = await settled;
		expect(result).toBeInstanceOf(Error);
		expect((result as Error).message).toBe('42');
	});
});
