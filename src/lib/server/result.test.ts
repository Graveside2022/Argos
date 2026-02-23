import { describe, expect, it } from 'vitest';

import { safe, safeSync } from './result';

describe('safe', () => {
	it('returns [data, null] on success', async () => {
		const [data, err] = await safe(() => Promise.resolve(42));
		expect(data).toBe(42);
		expect(err).toBeNull();
	});

	it('returns [null, Error] on rejection', async () => {
		const [data, err] = await safe(() => Promise.reject(new Error('fail')));
		expect(data).toBeNull();
		expect(err).toBeInstanceOf(Error);
		expect(err?.message).toBe('fail');
	});

	it('normalizes string throws to Error', async () => {
		const [data, err] = await safe(() => Promise.reject('string error'));
		expect(data).toBeNull();
		expect(err).toBeInstanceOf(Error);
		expect(err?.message).toBe('string error');
	});

	it('normalizes non-Error thrown values', async () => {
		const [data, err] = await safe(() => Promise.reject(404));
		expect(data).toBeNull();
		expect(err).toBeInstanceOf(Error);
		expect(err?.message).toBe('404');
	});

	it('narrows types correctly on success check', async () => {
		const [data, err] = await safe(() => Promise.resolve('hello'));
		if (err) {
			// TypeScript should narrow err to Error here
			expect(err.message).toBeDefined();
			return;
		}
		// TypeScript should narrow data to string here
		expect(data.toUpperCase()).toBe('HELLO');
	});
});

describe('safeSync', () => {
	it('returns [data, null] on success', () => {
		const [data, err] = safeSync(() => 'sync value');
		expect(data).toBe('sync value');
		expect(err).toBeNull();
	});

	it('returns [null, Error] on throw', () => {
		const [data, err] = safeSync(() => {
			throw new Error('sync fail');
		});
		expect(data).toBeNull();
		expect(err).toBeInstanceOf(Error);
		expect(err?.message).toBe('sync fail');
	});

	it('normalizes string throws to Error', () => {
		const [data, err] = safeSync(() => {
			throw 'string throw';
		});
		expect(data).toBeNull();
		expect(err).toBeInstanceOf(Error);
		expect(err?.message).toBe('string throw');
	});
});
