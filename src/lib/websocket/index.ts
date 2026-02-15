/**
 * WebSocket Shared Module
 *
 * Shared WebSocket client infrastructure for real-time data streaming.
 * Provides abstract base client for feature-specific implementations.
 */

// --- base ---
export type {
	BaseWebSocketConfig,
	WebSocketEvent,
	WebSocketEventListener,
	WebSocketEventType
} from './base';
export { BaseWebSocket } from './base';
