export enum HardwareDevice {
	HACKRF = 'hackrf',
	ALFA = 'alfa',
	BLUETOOTH = 'bluetooth',
	B205 = 'b205'
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
	b205: ResourceState;
}
