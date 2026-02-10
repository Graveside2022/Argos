/**
 * WebSocket Services Module
 *
 * WebSocket client infrastructure for real-time data streaming: base
 * abstract client, HackRF and Kismet protocol-specific implementations.
 */

// --- base ---
export { BaseWebSocket } from './base';
export type {
	BaseWebSocketConfig,
	WebSocketEvent,
	WebSocketEventListener,
	WebSocketEventType
} from './base';

// --- hackrf ---
export {
	HackRFWebSocketClient,
	destroyHackRFWebSocketClient,
	getHackRFWebSocketClient
} from './hackrf';
export type { HackRFMessage, HackRFWebSocketConfig } from './hackrf';

// --- kismet ---
export {
	KismetWebSocketClient,
	destroyKismetWebSocketClient,
	getKismetWebSocketClient
} from './kismet';
export type { KismetMessage, KismetWebSocketConfig } from './kismet';
