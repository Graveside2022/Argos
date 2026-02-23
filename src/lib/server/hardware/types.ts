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

export interface HardwareStatus {
	hackrf: ResourceState;
	alfa: ResourceState;
	bluetooth: ResourceState;
}
