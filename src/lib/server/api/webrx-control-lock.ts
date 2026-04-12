/**
 * Shared operation lock for WebRX-family tool control endpoints.
 *
 * OpenWebRX and NovaSDR both drive the same HackRF One and must never run
 * simultaneously. Their control endpoints (/api/openwebrx/control and
 * /api/novasdr/control) import this module-level lock so that concurrent
 * start/stop/restart requests from either endpoint are serialized into a
 * single Promise chain.
 *
 * Without this lock, two concurrent `start` requests can interleave:
 *   A: stops peer container → B: stops my container → A: starts mine →
 *   B: starts mine → HackRF USB device contention, indeterminate state.
 *
 * Pattern borrowed from
 * src/lib/server/services/spiderfoot/spiderfoot-control-service.ts
 * which uses the same Promise-chain serializer for its own process lifecycle.
 */

let operationLock: Promise<unknown> = Promise.resolve();

/**
 * Serialize an async operation so it runs only after any prior withWebRxLock
 * callers have finished. The returned Promise resolves (or rejects) with the
 * result of `fn`. Callers from both the OpenWebRX and NovaSDR control
 * endpoints share this single lock instance, guaranteeing mutual exclusion
 * across WebRX-family start/stop/restart actions.
 */
export function withWebRxLock<T>(fn: () => Promise<T>): Promise<T> {
	const prev = operationLock;
	let release: () => void = () => {};
	operationLock = new Promise<void>((resolve) => {
		release = resolve;
	});
	return prev.then(fn).finally(() => release());
}
