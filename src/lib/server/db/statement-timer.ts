/**
 * Statement timing proxy — wraps a better-sqlite3 Statement so that every
 * call to run/get/all is measured and reported via a callback.
 */

import type Database from 'better-sqlite3';
import { performance } from 'perf_hooks';

export type TimingCallback = (label: string, durationMs: number) => void;

/**
 * Wraps a prepared statement with timing instrumentation.
 * Intercepts `run`, `get`, and `all` calls, records wall-clock duration,
 * and invokes `onTiming` with the label and elapsed milliseconds.
 * All other property accesses are forwarded transparently.
 */
export function wrapStatement<P extends unknown[], R>(
	stmt: Database.Statement<P, R>,
	label: string,
	onTiming: TimingCallback
): Database.Statement<P, R> {
	const timed =
		<M extends (...args: unknown[]) => unknown>(
			fn: M
		): ((...args: Parameters<M>) => ReturnType<M>) =>
		(...args: Parameters<M>): ReturnType<M> => {
			const start = performance.now();
			const result = fn(...args) as ReturnType<M>;
			onTiming(label, performance.now() - start);
			return result;
		};

	return new Proxy(stmt, {
		get(target, prop, receiver) {
			if (prop === 'run' || prop === 'get' || prop === 'all') {
				const original = Reflect.get(target, prop, receiver) as (
					...args: unknown[]
				) => unknown;
				return timed(original.bind(target));
			}
			return Reflect.get(target, prop, receiver);
		}
	}) as Database.Statement<P, R>;
}
