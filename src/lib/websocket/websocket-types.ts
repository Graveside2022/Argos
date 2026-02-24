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

export type ResolvedConfig = Required<Omit<BaseWebSocketConfig, 'protocols'>> & {
	protocols?: string | string[];
};

export const CONFIG_DEFAULTS: Omit<ResolvedConfig, 'url'> = {
	reconnectInterval: 1000,
	maxReconnectAttempts: -1,
	heartbeatInterval: 30000,
	reconnectBackoffMultiplier: 1.5,
	maxReconnectInterval: 30000
};

/** Apply defaults to WebSocket config. */
export function resolveConfig(config: BaseWebSocketConfig): ResolvedConfig {
	return { ...CONFIG_DEFAULTS, ...config } as ResolvedConfig;
}

/** Create a WebSocket instance, handling browser vs Node.js environments. */
export function createWebSocket(url: string, protocols?: string | string[]): WebSocket {
	if (typeof window !== 'undefined' && window.WebSocket) {
		return new WebSocket(url, protocols);
	}
	if (typeof global !== 'undefined' && global.WebSocket) {
		const WsCtor = global.WebSocket as unknown as {
			new (url: string, protocols?: string | string[]): WebSocket;
		};
		return new WsCtor(url, protocols);
	}
	throw new Error('WebSocket not available in this environment');
}
