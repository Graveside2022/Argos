import { BaseWebSocket, type BaseWebSocketConfig } from './base';
import { kismetStore } from '$lib/stores/kismet';
import { updateKismetConnection } from '$lib/stores/connection';
import { get } from 'svelte/store';
import type { 
    KismetDevice,
    KismetNetwork,
    KismetStatus,
    KismetAlert,
    KismetGPS
} from '$lib/types/kismet';
import { KismetEvent } from '$lib/types/enums';

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
        
        // Setup message handlers
        this.setupMessageHandlers();
    }

    private setupMessageHandlers(): void {
        // Status updates
        this.onMessage('status', (data) => {
            this.handleStatusUpdate(data);
        });

        // Device updates
        this.onMessage(KismetEvent.DeviceUpdate, (data) => {
            this.handleDeviceUpdate(data);
        });

        this.onMessage(KismetEvent.DeviceNew, (data) => {
            this.handleNewDevice(data);
        });

        this.onMessage('device_removed', (data) => {
            this.handleDeviceRemoved(data);
        });

        this.onMessage('devices_list', (data) => {
            this.handleDevicesList(data);
        });

        // Network updates
        this.onMessage('network_update', (data) => {
            this.handleNetworkUpdate(data);
        });

        this.onMessage('networks_list', (data) => {
            this.handleNetworksList(data);
        });

        // Alerts
        this.onMessage('alert', (data) => {
            this.handleAlert(data);
        });

        // GPS updates
        this.onMessage('gps_update', (data) => {
            this.handleGpsUpdate(data);
        });

        // Errors
        this.onMessage('error', (data) => {
            this.handleError(data);
        });

        // Heartbeat
        this.onMessage('pong', () => {
            this.lastHeartbeat = Date.now();
        });
    }

    protected onConnected(): void {
        // console.info('[Kismet] WebSocket connected');

        updateKismetConnection({
            connected: true,
            connecting: false,
            error: null,
            reconnectAttempts: 0,
            lastConnected: Date.now()
        });

        // Request initial data
        this.requestStatus();
        this.requestDevicesList();
        this.requestNetworksList();
    }

    protected onDisconnected(): void {
        // console.info('[Kismet] WebSocket disconnected');

        updateKismetConnection({
            connected: false,
            connecting: false
        });

        kismetStore.updateStatus({ kismet_running: false });
    }

    protected handleIncomingMessage(_data: unknown): void {
        // Base message handling is done through message handlers
        // This is for any raw message processing if needed
    }

    protected onError(error: Error): void {
        console.error('[Kismet] WebSocket error:', error);

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

    // Handler methods
    private handleStatusUpdate(status: unknown): void {
        if (!status || typeof status !== 'object' || status === null) return;
        
        // Build partial status with proper type checking
        const partialStatus: Partial<KismetStatus> = {};
        const statusObj = status as Record<string, unknown>;
        
        // Type-safe property extraction
        const kismetRunning = statusObj.kismet_running;
        if (typeof kismetRunning === 'boolean') {
            partialStatus.kismet_running = kismetRunning;
        }
        
        const wigleRunning = statusObj.wigle_running;
        if (typeof wigleRunning === 'boolean') {
            partialStatus.wigle_running = wigleRunning;
        }
        
        const gpsRunning = statusObj.gps_running;
        if (typeof gpsRunning === 'boolean') {
            partialStatus.gps_running = gpsRunning;
        }
        
        kismetStore.updateStatus(partialStatus);
    }

    private handleDeviceUpdate(device: unknown): void {
        if (!device || typeof device !== 'object' || device === null) return;
        
        // Type narrowing with explicit checks
        const deviceObj = device as Record<string, unknown>;
        if (!('mac' in deviceObj) || typeof deviceObj.mac !== 'string') return;
        
        // Now safe to use as KismetDevice
        const store = get(kismetStore);
        const devices = [...store.devices];
        const index = devices.findIndex(d => d.mac === deviceObj.mac);
        
        // Safely cast to KismetDevice after validation
        const kismetDevice = device as KismetDevice;
        if (index >= 0) {
            devices[index] = { ...devices[index], ...kismetDevice };
        } else {
            devices.push(kismetDevice);
        }
        
        kismetStore.updateDevices(devices);
    }

    private handleNewDevice(device: unknown): void {
        if (!device || typeof device !== 'object' || device === null) return;
        
        // Type narrowing with explicit checks
        const deviceObj = device as Record<string, unknown>;
        if (!('mac' in deviceObj) || typeof deviceObj.mac !== 'string') return;
        
        // Type assertion is safe after mac validation
        const kismetDevice = device as KismetDevice;
        // Add device to store - addDevice doesn't exist, must add to array
        const store = get(kismetStore);
        const devices = [...store.devices, kismetDevice];
        kismetStore.updateDevices(devices);
        
        const deviceName = (deviceObj.last_ssid !== null && 
                           deviceObj.last_ssid !== undefined && 
                           typeof deviceObj.last_ssid === 'string')
            ? deviceObj.last_ssid 
            : String(deviceObj.mac);
        
        kismetStore.addAlert({
            type: 'new_device',
            severity: 'low',
            message: `New device detected: ${deviceName}`,
            timestamp: Date.now() / 1000
        });
    }

    private handleDeviceRemoved(data: unknown): void {
        if (!data || typeof data !== 'object' || data === null) return;
        
        const dataObj = data as Record<string, unknown>;
        if (!('mac' in dataObj) || typeof dataObj.mac !== 'string') return;
        
        // Remove device from array - removeDevice doesn't exist
        const store = get(kismetStore);
        const devices = store.devices.filter(d => d.mac !== dataObj.mac);
        kismetStore.updateDevices(devices);
    }

    private handleDevicesList(data: unknown): void {
        if (!data || typeof data !== 'object' || data === null) return;
        
        const dataObj = data as Record<string, unknown>;
        if (!('devices' in dataObj) || !Array.isArray(dataObj.devices)) return;
        
        // Type-safe array handling
        const devices = dataObj.devices as unknown[];
        const validDevices = devices.filter(
            (device): device is KismetDevice => 
                device !== null && 
                typeof device === 'object' && 
                'mac' in device
        );
        
        kismetStore.updateDevices(validDevices);
    }

    private handleNetworkUpdate(network: unknown): void {
        if (!network || typeof network !== 'object' || network === null) return;
        
        // Type narrowing with explicit checks
        const networkObj = network as Record<string, unknown>;
        if (!('ssid' in networkObj) || typeof networkObj.ssid !== 'string') return;
        
        const store = get(kismetStore);
        const networks = [...store.networks];
        const index = networks.findIndex(n => n.ssid === networkObj.ssid);
        
        // Safely cast to KismetNetwork after validation
        const kismetNetwork = network as KismetNetwork;
        if (index >= 0) {
            networks[index] = { ...networks[index], ...kismetNetwork };
        } else {
            networks.push(kismetNetwork);
        }
        
        kismetStore.updateNetworks(networks);
    }

    private handleNetworksList(data: unknown): void {
        if (!data || typeof data !== 'object' || data === null) return;
        
        const dataObj = data as Record<string, unknown>;
        if (!('networks' in dataObj) || !Array.isArray(dataObj.networks)) return;
        
        // Type-safe array handling
        const networks = dataObj.networks as unknown[];
        const validNetworks = networks.filter(
            (network): network is KismetNetwork => 
                network !== null && 
                typeof network === 'object' && 
                'ssid' in network
        );
        
        kismetStore.updateNetworks(validNetworks);
    }

    private handleAlert(alert: unknown): void {
        if (!alert || typeof alert !== 'object' || alert === null) return;
        
        const alertObj = alert as Record<string, unknown>;
        const message = 'message' in alertObj && typeof alertObj.message === 'string' 
            ? alertObj.message : 'Unknown alert';
        
        let severity: 'low' | 'medium' | 'high' = 'low';
        if ('severity' in alertObj && typeof alertObj.severity === 'string') {
            const sev = alertObj.severity;
            if (sev === 'low' || sev === 'medium' || sev === 'high') {
                severity = sev;
            }
        }
        
        const timestamp = 'timestamp' in alertObj && typeof alertObj.timestamp === 'number'
            ? alertObj.timestamp : Date.now() / 1000;
        
        // Default alert type if not provided
        let alertType: KismetAlert['type'] = 'info';
        if ('type' in alertObj && typeof alertObj.type === 'string') {
            const type = alertObj.type;
            if (type === 'new_device' || type === 'security' || type === 'deauth' || 
                type === 'probe' || type === 'handshake' || type === 'suspicious' || type === 'info') {
                alertType = type;
            }
        }
        
        kismetStore.addAlert({ 
            type: alertType,
            severity, 
            message, 
            timestamp 
        });
    }

    private handleGpsUpdate(gps: unknown): void {
        if (!gps || typeof gps !== 'object' || gps === null) return;
        
        const gpsObj = gps as Record<string, unknown>;
        
        // Build a proper KismetGPS object with defaults
        const gpsData: KismetGPS = {
            status: typeof gpsObj.status === 'string' ? gpsObj.status : 'No Fix',
            lat: typeof gpsObj.lat === 'string' ? gpsObj.lat : 'N/A',
            lon: typeof gpsObj.lon === 'string' ? gpsObj.lon : 'N/A',
            alt: typeof gpsObj.alt === 'string' ? gpsObj.alt : 'N/A',
            time: typeof gpsObj.time === 'string' ? gpsObj.time : 'N/A'
        };
        
        kismetStore.updateGPS(gpsData);
    }

    private handleError(error: unknown): void {
        console.error('[Kismet] Server error:', error);
        
        const errorMessage = error && typeof error === 'object' && 'message' in error 
            ? (error as { message: string }).message 
            : 'Unknown server error';
            
        kismetStore.addAlert({
            type: 'security',
            severity: 'high',
            message: errorMessage,
            timestamp: Date.now() / 1000
        });
    }

    // Send heartbeat
    protected sendHeartbeat(): void {
        if (this.ws && this.ws.readyState === 1) { // WebSocket.OPEN
            this.send({ command: 'ping' });
        }
    }

    // Clean disconnect
    public disconnect(): void {
        if (this.ws && this.ws.readyState === 1) { // WebSocket.OPEN
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