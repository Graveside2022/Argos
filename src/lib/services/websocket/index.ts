export * from './base';
export * from './hackrf';
export * from './kismet';

import { getHackRFWebSocketClient, type HackRFWebSocketConfig } from './hackrf';
import { getKismetWebSocketClient, type KismetWebSocketConfig } from './kismet';

// Combined WebSocket manager
export interface WebSocketManagerConfig {
    hackrf?: HackRFWebSocketConfig;
    kismet?: KismetWebSocketConfig;
    autoConnect?: boolean;
}

export class WebSocketManager {
    private hackrfClient: ReturnType<typeof getHackRFWebSocketClient> | null = null;
    private kismetClient: ReturnType<typeof getKismetWebSocketClient> | null = null;
    private config: WebSocketManagerConfig;

    constructor(config: WebSocketManagerConfig = {}) {
        this.config = config;
    }

    /**
     * Initialize all WebSocket clients
     */
    init(): void {
        // Initialize HackRF client
        if (this.config.hackrf) {
            this.hackrfClient = getHackRFWebSocketClient(this.config.hackrf);
        }

        // Initialize Kismet client
        if (this.config.kismet) {
            this.kismetClient = getKismetWebSocketClient(this.config.kismet);
        }

        // Auto-connect if enabled
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

export function getWebSocketManager(config?: WebSocketManagerConfig): WebSocketManager {
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