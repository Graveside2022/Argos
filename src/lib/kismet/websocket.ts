import { kismetStore } from '$lib/kismet/stores';
import { updateKismetConnection } from '$lib/stores/connection';
import { handleTakMessage } from '$lib/stores/tak-store';
import { KismetEvent } from '$lib/types/enums';
import { logger } from '$lib/utils/logger';
import { BaseWebSocket, type BaseWebSocketConfig } from '$lib/websocket/base';

import {
	handleAlert,
	handleDeviceRemoved,
	handleDevicesList,
	handleDeviceUpdate,
	handleErrorMessage,
	handleGpsUpdate,
	handleNetworksList,
	handleNetworkUpdate,
	handleNewDevice,
	handleStatusUpdate
} from './websocket-handlers';

export type KismetWebSocketConfig = BaseWebSocketConfig;

export interface KismetMessage {
	type: string;
	data?: unknown;
	error?: string;
}

export class KismetWebSocketClient extends BaseWebSocket {
	protected lastHeartbeat: number = Date.now();

	constructor(config: Partial<KismetWebSocketConfig> = {}) {
		const finalConfig: KismetWebSocketConfig = {
			url: 'ws://localhost:8002/ws/kismet',
			reconnectInterval: 5000,
			maxReconnectAttempts: -1,
			heartbeatInterval: 30000,
			...config
		};
		super(finalConfig);

		this.setupMessageHandlers();
	}

	private setupMessageHandlers(): void {
		// TAK updates
		this.onMessage('tak_status', (data) => {
			handleTakMessage({ type: 'tak_status', data: data as Record<string, unknown> });
		});
		this.onMessage('tak_cot', (data) => {
			handleTakMessage({ type: 'tak_cot', data: data as Record<string, unknown> });
		});

		// Status updates
		this.onMessage('status', (data) => handleStatusUpdate(data));

		// Device updates
		this.onMessage(KismetEvent.DeviceUpdate, (data) => handleDeviceUpdate(data));
		this.onMessage(KismetEvent.DeviceNew, (data) => handleNewDevice(data));
		this.onMessage('device_removed', (data) => handleDeviceRemoved(data));
		this.onMessage('devices_list', (data) => handleDevicesList(data));

		// Network updates
		this.onMessage('network_update', (data) => handleNetworkUpdate(data));
		this.onMessage('networks_list', (data) => handleNetworksList(data));

		// Alerts
		this.onMessage('alert', (data) => handleAlert(data));

		// GPS updates
		this.onMessage('gps_update', (data) => handleGpsUpdate(data));

		// Errors
		this.onMessage('error', (data) => handleErrorMessage(data));

		// Heartbeat
		this.onMessage('pong', () => {
			this.lastHeartbeat = Date.now();
		});
	}

	protected onConnected(): void {
		updateKismetConnection({
			isConnected: true,
			isConnecting: false,
			error: null,
			reconnectAttempts: 0,
			lastConnected: Date.now()
		});

		this.requestStatus();
		this.requestDevicesList();
		this.requestNetworksList();
	}

	protected onDisconnected(): void {
		updateKismetConnection({
			isConnected: false,
			isConnecting: false
		});

		kismetStore.updateStatus({ kismet_running: false });
	}

	protected handleIncomingMessage(_data: unknown): void {
		// Base message handling is done through message handlers
	}

	protected onError(error: Error): void {
		logger.error('[Kismet] WebSocket error', { error });

		updateKismetConnection({
			error: error.message,
			lastError: error.message
		});
	}

	// Request methods
	public requestStatus(): void {
		this.send({ command: 'get_status' });
	}

	public requestDevicesList(): void {
		this.send({ command: 'get_devices' });
	}

	public requestNetworksList(): void {
		this.send({ command: 'get_networks' });
	}

	public requestDevice(mac: string): void {
		this.send({ command: 'get_device', mac });
	}

	// Service control methods
	public startService(service: 'kismet' | 'wigle' | 'gps' | 'all'): void {
		this.send({ command: 'start_service', service });
	}

	public stopService(service: 'kismet' | 'wigle' | 'gps' | 'all'): void {
		this.send({ command: 'stop_service', service });
	}

	public restartService(service: 'kismet' | 'wigle' | 'gps' | 'all'): void {
		this.send({ command: 'restart_service', service });
	}

	// Send heartbeat
	protected sendHeartbeat(): void {
		if (this.ws && this.ws.readyState === 1) {
			this.send({ command: 'ping' });
		}
	}

	// Clean disconnect
	public disconnect(): void {
		if (this.ws && this.ws.readyState === 1) {
			this.send({ command: 'disconnect' });
		}
		super.disconnect();
	}
}

// Singleton instance
let kismetWebSocketInstance: KismetWebSocketClient | null = null;

export function getKismetWebSocketClient(config?: KismetWebSocketConfig): KismetWebSocketClient {
	if (!kismetWebSocketInstance) {
		kismetWebSocketInstance = new KismetWebSocketClient(config);
	}
	return kismetWebSocketInstance;
}

export function destroyKismetWebSocketClient(): void {
	if (kismetWebSocketInstance) {
		kismetWebSocketInstance.disconnect();
		kismetWebSocketInstance = null;
	}
}
