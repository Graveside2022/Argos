/**
 * WebSocket Services Module (Legacy Re-exports)
 *
 * DEPRECATED: This module re-exports from the new shared websocket module
 * and feature modules. Use direct imports instead:
 * - Base: import from '$lib/websocket/base'
 * - HackRF: import from '$lib/hackrf/websocket'
 * - Kismet: import from '$lib/kismet/websocket'
 *
 * This file will be removed in Phase 5.7 cleanup.
 */

// --- base (re-export from shared module) ---
export type {
	BaseWebSocketConfig,
	WebSocketEvent,
	WebSocketEventListener,
	WebSocketEventType
} from '$lib/websocket/base';
export { BaseWebSocket } from '$lib/websocket/base';

// --- hackrf (re-export from feature module) ---
export type { HackRFMessage, HackRFWebSocketConfig } from '$lib/hackrf/websocket';
export {
	destroyHackRFWebSocketClient,
	getHackRFWebSocketClient,
	HackRFWebSocketClient
} from '$lib/hackrf/websocket';

// --- kismet (re-export from feature module) ---
export type { KismetMessage, KismetWebSocketConfig } from '$lib/kismet/websocket';
export {
	destroyKismetWebSocketClient,
	getKismetWebSocketClient,
	KismetWebSocketClient
} from '$lib/kismet/websocket';
