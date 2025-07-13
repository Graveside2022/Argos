import { WebSocketEvent as WebSocketEventEnum } from '$lib/types/enums';

export type WebSocketEventType = WebSocketEventEnum;

export interface WebSocketEvent {
	type: WebSocketEventType;
	data?: unknown;
	error?: Error;
	timestamp: number;
}

export interface BaseWebSocketConfig {
	url: string;
	reconnectInterval?: number;
	maxReconnectAttempts?: number;
	heartbeatInterval?: number;
	reconnectBackoffMultiplier?: number;
	maxReconnectInterval?: number;
	protocols?: string | string[];
}

export type WebSocketEventListener = (event: WebSocketEvent) => void;

export abstract class BaseWebSocket {
	protected ws: WebSocket | null = null;
	protected config: Required<Omit<BaseWebSocketConfig, 'protocols'>> & {
		protocols?: string | string[];
	};
	protected reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	protected heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	protected isIntentionalClose = false;
	protected reconnectAttempts = 0;
	protected lastHeartbeat = 0;
	protected currentReconnectInterval: number;

	private eventListeners = new Map<WebSocketEventType, Set<WebSocketEventListener>>();
	private messageHandlers = new Map<string, Set<(data: unknown) => void>>();

	constructor(config: BaseWebSocketConfig) {
		this.config = {
			url: config.url,
			reconnectInterval: config.reconnectInterval || 1000,
			maxReconnectAttempts: config.maxReconnectAttempts || -1, // -1 = infinite
			heartbeatInterval: config.heartbeatInterval || 30000,
			reconnectBackoffMultiplier: config.reconnectBackoffMultiplier || 1.5,
			maxReconnectInterval: config.maxReconnectInterval || 30000,
			protocols: config.protocols
		};
		this.currentReconnectInterval = this.config.reconnectInterval;
	}

	/**
	 * Connect to the WebSocket server
	 */
	connect(): void {
		if (this.ws?.readyState === 1) {
			// WebSocket.OPEN
			// console.info(`[${this.constructor.name}] Already connected`);
			return;
		}

		this.isIntentionalClose = false;
		this.emit(WebSocketEventEnum.Reconnecting, { attempt: this.reconnectAttempts });

		try {
			// Handle both browser and server environments
			if (typeof window !== 'undefined' && window.WebSocket) {
				this.ws = new WebSocket(this.config.url, this.config.protocols);
			} else if (typeof global !== 'undefined' && global.WebSocket) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				this.ws = new (global.WebSocket as any)(this.config.url, this.config.protocols);
			} else {
				// In Node.js environment, we'd need to import ws package
				throw new Error('WebSocket not available in this environment');
			}
			this.setupEventHandlers();
		} catch (error) {
			console.error(`[${this.constructor.name}] Failed to create WebSocket:`, error);
			this.handleConnectionError(error);
		}
	}

	/**
	 * Disconnect from the WebSocket server
	 */
	disconnect(): void {
		this.isIntentionalClose = true;
		this.cleanup();

		if (this.ws) {
			this.ws.close(1000, 'Client disconnect');
			this.ws = null;
		}

		this.reconnectAttempts = 0;
		this.currentReconnectInterval = this.config.reconnectInterval;
	}

	/**
	 * Send a message through the WebSocket
	 */
	send(data: unknown): boolean {
		if (this.ws?.readyState === 1) {
			// WebSocket.OPEN
			try {
				const message = typeof data === 'string' ? data : JSON.stringify(data);
				this.ws.send(message);
				return true;
			} catch (error) {
				console.error(`[${this.constructor.name}] Failed to send message:`, error);
				return false;
			}
		} else {
			console.warn(
				`[${this.constructor.name}] Cannot send message, WebSocket is not connected`
			);
			return false;
		}
	}

	/**
	 * Add an event listener
	 */
	on(event: WebSocketEventType, listener: WebSocketEventListener): void {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, new Set());
		}
		this.eventListeners.get(event)?.add(listener);
	}

	/**
	 * Remove an event listener
	 */
	off(event: WebSocketEventType, listener: WebSocketEventListener): void {
		this.eventListeners.get(event)?.delete(listener);
	}

	/**
	 * Add a message handler for a specific message type
	 */
	onMessage(type: string, handler: (data: unknown) => void): void {
		if (!this.messageHandlers.has(type)) {
			this.messageHandlers.set(type, new Set());
		}
		this.messageHandlers.get(type)?.add(handler);
	}

	/**
	 * Remove a message handler
	 */
	offMessage(type: string, handler: (data: unknown) => void): void {
		this.messageHandlers.get(type)?.delete(handler);
	}

	/**
	 * Check if connected
	 */
	public isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	/**
	 * Get the current WebSocket state
	 */
	getState(): number | undefined {
		return this.ws?.readyState;
	}

	/**
	 * Setup WebSocket event handlers
	 */
	protected setupEventHandlers(): void {
		if (!this.ws) return;

		this.ws.onopen = (event) => {
			// console.info(`[${this.constructor.name}] WebSocket connected`);

			this.reconnectAttempts = 0;
			this.currentReconnectInterval = this.config.reconnectInterval;

			this.emit(WebSocketEventEnum.Open, { event });
			this.onConnected();
			this.startHeartbeat();
		};

		this.ws.onmessage = (event) => {
			try {
				const data = this.parseMessage(event.data as string | ArrayBuffer | Blob);
				this.emit(WebSocketEventEnum.Message, { data, event });
				this.handleMessage(data);
			} catch (error) {
				console.error(`[${this.constructor.name}] Failed to parse message:`, error);
			}
		};

		this.ws.onerror = (event) => {
			console.error(`[${this.constructor.name}] WebSocket error:`, event);
			const error = new Error('WebSocket error');
			this.emit(WebSocketEventEnum.Error, { error, event });
			this.handleConnectionError(error);
		};

		this.ws.onclose = (event) => {
			// console.info(`[${this.constructor.name}] WebSocket closed:`, event.code, event.reason);

			this.emit(WebSocketEventEnum.Close, { code: event.code, reason: event.reason, event });
			this.onDisconnected();
			this.cleanup();

			// Attempt reconnection if not intentional close
			if (!this.isIntentionalClose && this.shouldReconnect()) {
				this.scheduleReconnect();
			}
		};
	}

	/**
	 * Parse incoming message
	 */
	protected parseMessage(data: string | ArrayBuffer | Blob): unknown {
		try {
			return typeof data === 'string' ? JSON.parse(data) : data;
		} catch {
			return data;
		}
	}

	/**
	 * Handle incoming message
	 */
	protected handleMessage(data: unknown): void {
		// Handle typed messages
		if (data && typeof data === 'object' && 'type' in data) {
			const typedData = data as { type: string; data?: unknown };
			const handlers = this.messageHandlers.get(typedData.type);
			if (handlers) {
				handlers.forEach((handler) => {
					try {
						handler(typedData.data || data);
					} catch (error) {
						console.error(`[${this.constructor.name}] Message handler error:`, error);
					}
				});
			}
		}

		// Call abstract method for subclass handling
		this.handleIncomingMessage(data);
	}

	/**
	 * Handle connection error
	 */
	protected handleConnectionError(error: unknown): void {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		this.emit(WebSocketEventEnum.Error, { error: errorObj });
		this.onError(errorObj);
	}

	/**
	 * Check if should reconnect
	 */
	protected shouldReconnect(): boolean {
		return (
			this.config.maxReconnectAttempts === -1 ||
			this.reconnectAttempts < this.config.maxReconnectAttempts
		);
	}

	/**
	 * Schedule reconnection attempt
	 */
	protected scheduleReconnect(): void {
		if (this.reconnectTimer) return;

		this.reconnectAttempts++;
		// console.info(`[${this.constructor.name}] Scheduling reconnect attempt ${this.reconnectAttempts} in ${this.currentReconnectInterval}ms`);

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.connect();
		}, this.currentReconnectInterval);

		// Apply backoff
		this.currentReconnectInterval = Math.min(
			this.currentReconnectInterval * this.config.reconnectBackoffMultiplier,
			this.config.maxReconnectInterval
		);
	}

	/**
	 * Start heartbeat mechanism
	 */
	protected startHeartbeat(): void {
		this.stopHeartbeat();

		this.heartbeatTimer = setInterval(() => {
			if (this.ws?.readyState === 1) {
				// WebSocket.OPEN
				this.sendHeartbeat();

				// Check if we've received a response recently
				if (
					this.lastHeartbeat &&
					Date.now() - this.lastHeartbeat > this.config.heartbeatInterval * 2
				) {
					console.warn(
						`[${this.constructor.name}] Heartbeat timeout, closing connection`
					);
					this.ws.close(4000, 'Heartbeat timeout');
				}
			}
		}, this.config.heartbeatInterval);
	}

	/**
	 * Stop heartbeat mechanism
	 */
	protected stopHeartbeat(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
	}

	/**
	 * Cleanup timers and resources
	 */
	protected cleanup(): void {
		this.stopHeartbeat();

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	/**
	 * Emit an event to all listeners
	 */
	protected emit(event: WebSocketEventType, data?: Record<string, unknown>): void {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			const eventData: WebSocketEvent = {
				type: event,
				timestamp: Date.now(),
				data: data?.data,
				error: data?.error as Error | undefined
			};

			listeners.forEach((listener) => {
				try {
					listener(eventData);
				} catch (error) {
					console.error(`[${this.constructor.name}] Event listener error:`, error);
				}
			});
		}
	}

	/**
	 * Destroy the WebSocket connection and clean up
	 */
	destroy(): void {
		this.disconnect();
		this.eventListeners.clear();
		this.messageHandlers.clear();
	}

	// Abstract methods to be implemented by subclasses
	protected abstract onConnected(): void;
	protected abstract onDisconnected(): void;
	protected abstract handleIncomingMessage(data: unknown): void;
	protected abstract onError(error: Error): void;
	protected abstract sendHeartbeat(): void;
}
