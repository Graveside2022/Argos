/**
 * WebSocket Services Module
 *
 * WebSocket client infrastructure for real-time data streaming: base
 * abstract client, HackRF and Kismet protocol-specific implementations,
 * unified WebSocket manager, and data stream coordination.
 */

// --- base ---
export { BaseWebSocket } from "./base";
export type {
	BaseWebSocketConfig,
	WebSocketEvent,
	WebSocketEventListener,
	WebSocketEventType,
} from "./base";

// --- hackrf ---
export {
	HackRFWebSocketClient,
	destroyHackRFWebSocketClient,
	getHackRFWebSocketClient,
} from "./hackrf";
export type { HackRFMessage, HackRFWebSocketConfig } from "./hackrf";

// --- kismet ---
export {
	KismetWebSocketClient,
	destroyKismetWebSocketClient,
	getKismetWebSocketClient,
} from "./kismet";
export type { KismetMessage, KismetWebSocketConfig } from "./kismet";

// --- data-stream-manager ---
export { dataStreamManager } from "./data-stream-manager";

// --- test-connection ---
export { testWebSocketConnections } from "./test-connection";

// ---------------------------------------------------------------------------
// Combined WebSocket Manager (defined locally in this barrel)
// ---------------------------------------------------------------------------

import { getHackRFWebSocketClient, type HackRFWebSocketConfig } from "./hackrf";
import { getKismetWebSocketClient, type KismetWebSocketConfig } from "./kismet";

export interface WebSocketManagerConfig {
	hackrf?: HackRFWebSocketConfig;
	kismet?: KismetWebSocketConfig;
	autoConnect?: boolean;
}

export class WebSocketManager {
	private hackrfClient: ReturnType<typeof getHackRFWebSocketClient> | null =
		null;
	private kismetClient: ReturnType<typeof getKismetWebSocketClient> | null =
		null;
	private config: WebSocketManagerConfig;

	constructor(config: WebSocketManagerConfig = {}) {
		this.config = config;
	}

	/**
	 * Initialize all WebSocket clients
	 */
	init(): void {
		if (this.config.hackrf) {
			this.hackrfClient = getHackRFWebSocketClient(this.config.hackrf);
		}
		if (this.config.kismet) {
			this.kismetClient = getKismetWebSocketClient(this.config.kismet);
		}
		if (this.config.autoConnect !== false) {
			this.connect();
		}
	}

	/**
	 * Connect all WebSocket clients
	 */
	connect(): void {
		this.hackrfClient?.connect();
		this.kismetClient?.connect();
	}

	/**
	 * Disconnect all WebSocket clients
	 */
	disconnect(): void {
		this.hackrfClient?.disconnect();
		this.kismetClient?.disconnect();
	}

	/**
	 * Get HackRF client instance
	 */
	getHackRFClient(): ReturnType<typeof getHackRFWebSocketClient> | null {
		return this.hackrfClient;
	}

	/**
	 * Get Kismet client instance
	 */
	getKismetClient(): ReturnType<typeof getKismetWebSocketClient> | null {
		return this.kismetClient;
	}

	/**
	 * Check if all clients are connected
	 */
	isAllConnected(): boolean {
		const hackrfConnected = this.hackrfClient?.isConnected() ?? true;
		const kismetConnected = this.kismetClient?.isConnected() ?? true;
		return hackrfConnected && kismetConnected;
	}

	/**
	 * Destroy all WebSocket clients
	 */
	destroy(): void {
		this.hackrfClient?.destroy();
		this.kismetClient?.destroy();
		this.hackrfClient = null;
		this.kismetClient = null;
	}
}

// Singleton WebSocket manager
let managerInstance: WebSocketManager | null = null;

export function getWebSocketManager(
	config?: WebSocketManagerConfig,
): WebSocketManager {
	if (!managerInstance) {
		managerInstance = new WebSocketManager(config);
	}
	return managerInstance;
}

export function destroyWebSocketManager(): void {
	if (managerInstance) {
		managerInstance.destroy();
		managerInstance = null;
	}
}
