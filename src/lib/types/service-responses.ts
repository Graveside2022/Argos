/**
 * Service response type definitions
 * Used by: kismet/status, kismet/devices, agent-context-store
 */

export interface KismetStatusResponse {
	isRunning: boolean;
	uptime: number;
	interface: string;
	deviceCount: number;
	metrics: {
		packetsProcessed: number;
		devicesDetected: number;
		packetsPerSecond: number;
		bytesPerSecond: number;
	};
	channels: string[];
	monitorInterfaces: string[];
	startTime?: number;
}
