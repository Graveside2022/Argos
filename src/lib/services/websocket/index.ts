/**
 * WebSocket Services Module
 *
 * WebSocket client infrastructure for real-time data streaming: base
 * abstract client, HackRF and Kismet protocol-specific implementations.
 */

// --- base ---
export type {
	BaseWebSocketConfig,
	WebSocketEvent,
	WebSocketEventListener,
	WebSocketEventType
} from './base';
export { BaseWebSocket } from './base';

// --- hackrf ---
export type { HackRFMessage, HackRFWebSocketConfig } from './hackrf';
export {
	destroyHackRFWebSocketClient,
	getHackRFWebSocketClient,
	HackRFWebSocketClient} from './hackrf';

// --- kismet ---
export type { KismetMessage, KismetWebSocketConfig } from './kismet';
export {
	destroyKismetWebSocketClient,
	getKismetWebSocketClient,
	KismetWebSocketClient} from './kismet';
