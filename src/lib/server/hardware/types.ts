export enum HardwareDevice {
	HACKRF = 'hackrf',
	ALFA = 'alfa',
	BLUETOOTH = 'bluetooth'
}

export interface ResourceState {
	device: HardwareDevice;
	isAvailable: boolean;
	owner: string | null;
	connectedSince: number | null;
	isDetected: boolean;
}

export interface ResourceRequest {
	toolName: string;
	device: HardwareDevice;
	priority?: number;
}

export interface ToolRegistration {
	name: string;
	processPatterns: string[];
	containerName?: string;
	device: HardwareDevice;
}

export interface HardwareStatus {
	hackrf: ResourceState;
	alfa: ResourceState;
	bluetooth: ResourceState;
}
