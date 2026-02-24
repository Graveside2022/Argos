// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { SweepManager } from '$lib/server/hackrf/sweep-manager';
import type { WebSocketManager } from '$lib/server/kismet/web-socket-manager';
import type { RateLimiter } from '$lib/server/security/rate-limiter';

declare global {
	// Argos globalThis singletons — persisted via globalThis to survive Vite HMR reloads.
	// These are typed here so consumers don't need unsafe `as Record<string, unknown>` casts.
	var __argos_sweepManager: SweepManager | undefined;
	var __argos_wsManager: WebSocketManager | undefined;
	var __rateLimiter: RateLimiter | undefined;
	var __rateLimiterCleanup: ReturnType<typeof setInterval> | undefined;
	var __argos_db_shutdown_registered: boolean | undefined;
	var __argos_hooks_shutdown_registered: boolean | undefined;

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
