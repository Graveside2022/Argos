import { WebSocketEvent as WebSocketEventEnum } from '$lib/types/enums';
import { logger } from '$lib/utils/logger';

import type { HeartbeatState } from './websocket-heartbeat';
import { startHeartbeat, stopHeartbeat } from './websocket-heartbeat';
import type { ReconnectState } from './websocket-reconnect';
import { scheduleReconnect, shouldReconnect } from './websocket-reconnect';
import type { ResolvedConfig } from './websocket-types';
import { createWebSocket, resolveConfig } from './websocket-types';

// Re-export all public types so existing consumers need only import from base.ts
export type { HeartbeatState } from './websocket-heartbeat';
export type { ReconnectState } from './websocket-reconnect';
export type {
	BaseWebSocketConfig,
	WebSocketEvent,
	WebSocketEventListener,
	WebSocketEventType
} from './websocket-types';
export { CONFIG_DEFAULTS, createWebSocket, resolveConfig } from './websocket-types';

export abstract class BaseWebSocket {
	protected ws: WebSocket | null = null;
	protected config: ResolvedConfig;
	protected isIntentionalClose = false;

	// Reconnect state (delegated to websocket-reconnect.ts helpers)
	private reconnectState: ReconnectState;

	// Heartbeat state (delegated to websocket-heartbeat.ts helpers)
	private heartbeatState: HeartbeatState;

	private eventListeners = new Map<
		WebSocketEventEnum,
		Set<
			(event: {
				type: WebSocketEventEnum;
				data?: unknown;
				error?: Error;
				timestamp: number;
			}) => void
		>
	>();
	private messageHandlers = new Map<string, Set<(data: unknown) => void>>();

	constructor(config: import('./websocket-types').BaseWebSocketConfig) {
		this.config = resolveConfig(config);
		this.reconnectState = {
			reconnectAttempts: 0,
			currentReconnectInterval: this.config.reconnectInterval,
			reconnectTimer: null
		};
		this.heartbeatState = {
			heartbeatTimer: null,
			lastHeartbeat: 0
		};
	}

	connect(): void {
		if (this.ws?.readyState === WebSocket.OPEN) return;

		this.isIntentionalClose = false;
		this.emit(WebSocketEventEnum.Reconnecting, {
			attempt: this.reconnectState.reconnectAttempts
		});

		try {
			this.ws = createWebSocket(this.config.url, this.config.protocols);
			this.setupEventHandlers();
		} catch (error) {
			logger.error('Failed to create WebSocket', { source: this.constructor.name, error });
			this.handleConnectionError(error);
		}
	}

	disconnect(): void {
		this.isIntentionalClose = true;
		this.cleanup();

		if (this.ws) {
			this.ws.close(1000, 'Client disconnect');
			this.ws = null;
		}

		this.reconnectState.reconnectAttempts = 0;
		this.reconnectState.currentReconnectInterval = this.config.reconnectInterval;
	}

	send(data: unknown): boolean {
		if (this.ws?.readyState !== WebSocket.OPEN) {
			logger.warn('Cannot send message, WebSocket is not connected', {
				source: this.constructor.name
			});
			return false;
		}
		try {
			const message = typeof data === 'string' ? data : JSON.stringify(data);
			this.ws.send(message);
			return true;
		} catch (error) {
			logger.error('Failed to send message', { source: this.constructor.name, error });
			return false;
		}
	}

	on(
		event: WebSocketEventEnum,
		listener: (evt: {
			type: WebSocketEventEnum;
			data?: unknown;
			error?: Error;
			timestamp: number;
		}) => void
	): void {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, new Set());
		}
		this.eventListeners.get(event)?.add(listener);
	}

	off(
		event: WebSocketEventEnum,
		listener: (evt: {
			type: WebSocketEventEnum;
			data?: unknown;
			error?: Error;
			timestamp: number;
		}) => void
	): void {
		this.eventListeners.get(event)?.delete(listener);
	}

	onMessage(type: string, handler: (data: unknown) => void): void {
		if (!this.messageHandlers.has(type)) {
			this.messageHandlers.set(type, new Set());
		}
		this.messageHandlers.get(type)?.add(handler);
	}

	offMessage(type: string, handler: (data: unknown) => void): void {
		this.messageHandlers.get(type)?.delete(handler);
	}

	public isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	getState(): number | undefined {
		return this.ws?.readyState;
	}

	protected setupEventHandlers(): void {
		if (!this.ws) return;

		this.ws.onopen = () => {
			this.reconnectState.reconnectAttempts = 0;
			this.reconnectState.currentReconnectInterval = this.config.reconnectInterval;
			this.emit(WebSocketEventEnum.Open, {});
			this.onConnected();
			this.startHeartbeat();
		};

		this.ws.onmessage = (event) => {
			try {
				// @constitutional-exemption Article-II-2.1 issue:#14 — WebSocket message data type narrowing — browser API returns union type
				const data = this.parseMessage(event.data as string | ArrayBuffer | Blob);
				this.emit(WebSocketEventEnum.Message, { data });
				this.handleMessage(data);
			} catch (error) {
				logger.error('Failed to parse message', { source: this.constructor.name, error });
			}
		};

		this.ws.onerror = () => {
			const error = new Error('WebSocket error');
			this.emit(WebSocketEventEnum.Error, { error });
			this.handleConnectionError(error);
		};

		this.ws.onclose = (event) => {
			this.emit(WebSocketEventEnum.Close, { code: event.code, reason: event.reason });
			this.onDisconnected();
			this.cleanup();

			if (!this.isIntentionalClose && shouldReconnect(this.reconnectState, this.config)) {
				scheduleReconnect(this.reconnectState, this.config, () => this.connect());
			}
		};
	}

	protected parseMessage(data: string | ArrayBuffer | Blob): unknown {
		try {
			return typeof data === 'string' ? JSON.parse(data) : data;
		} catch (_error: unknown) {
			return data;
		}
	}

	protected handleMessage(data: unknown): void {
		if (data && typeof data === 'object' && 'type' in data) {
			// @constitutional-exemption Article-II-2.1 issue:#14 — WebSocket message data type narrowing — browser API returns union type
			const typedData = data as { type: string; data?: unknown };
			const handlers = this.messageHandlers.get(typedData.type);
			if (handlers) {
				handlers.forEach((handler) => {
					try {
						handler(typedData.data ?? data);
					} catch (error) {
						logger.error('Message handler error', {
							source: this.constructor.name,
							error
						});
					}
				});
			}
		}
		this.handleIncomingMessage(data);
	}

	protected handleConnectionError(error: unknown): void {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		this.emit(WebSocketEventEnum.Error, { error: errorObj });
		this.onError(errorObj);
	}

	protected startHeartbeat(): void {
		if (!this.ws) return;
		startHeartbeat(
			this.heartbeatState,
			this.config,
			this.ws,
			() => this.sendHeartbeat(),
			this.constructor.name
		);
	}

	protected stopHeartbeat(): void {
		stopHeartbeat(this.heartbeatState);
	}

	protected cleanup(): void {
		stopHeartbeat(this.heartbeatState);

		if (this.reconnectState.reconnectTimer !== null) {
			clearTimeout(this.reconnectState.reconnectTimer);
			this.reconnectState.reconnectTimer = null;
		}
	}

	protected emit(event: WebSocketEventEnum, data: Record<string, unknown>): void {
		const listeners = this.eventListeners.get(event);
		if (!listeners) return;

		const eventData = {
			type: event,
			timestamp: Date.now(),
			data: data.data,
			error: data.error as Error | undefined
		};

		listeners.forEach((listener) => {
			try {
				listener(eventData);
			} catch (error) {
				logger.error('Event listener error', { source: this.constructor.name, error });
			}
		});
	}

	destroy(): void {
		this.disconnect();
		this.eventListeners.clear();
		this.messageHandlers.clear();
	}

	protected abstract onConnected(): void;
	protected abstract onDisconnected(): void;
	protected abstract handleIncomingMessage(data: unknown): void;
	protected abstract onError(error: Error): void;
	protected abstract sendHeartbeat(): void;
}
