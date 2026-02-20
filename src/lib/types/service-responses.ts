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

export interface ServiceHealthResponse {
	service: string;
	status: 'running' | 'stopped' | 'error';
	uptime?: number;
	message?: string;
	metrics?: Record<string, number>;
}

export interface GPSStateResponse {
	hasFix: boolean;
	latitude: number;
	longitude: number;
	altitude?: number;
	accuracy?: number;
	speed?: number;
	heading?: number;
	satellites?: number;
	timestamp: number;
}

export interface HackRFStatusResponse {
	isConnected: boolean;
	isSweeping: boolean;
	device?: {
		serial: string;
		boardId: number;
		firmwareVersion: string;
	};
	config?: {
		startFreq: number;
		endFreq: number;
		binWidth: number;
		fftSize: number;
	};
}
