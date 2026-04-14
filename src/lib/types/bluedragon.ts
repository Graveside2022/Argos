export type BluedragonProfile = 'clean' | 'volume' | 'max';

export type BluedragonStatus = 'stopped' | 'starting' | 'running' | 'stopping';

export type BluetoothAddrType =
	| 'public'
	| 'random_static'
	| 'random_resolvable'
	| 'random_nonresolvable'
	| 'classic_lap'
	| 'unknown';

export type BluetoothPhy = 'LE 1M' | 'LE 2M' | 'LE Coded' | 'BR/EDR' | 'unknown';

export type BluetoothCategory =
	| 'phone'
	| 'phone_or_computer'
	| 'computer'
	| 'audio_earbud'
	| 'audio_speaker'
	| 'wearable'
	| 'tracker'
	| 'beacon'
	| 'peripheral'
	| 'iot'
	| 'media'
	| 'printer'
	| 'sensor'
	| 'vehicle'
	| 'unknown';

export interface BluetoothDevice {
	addr: string;
	addrType: BluetoothAddrType;
	firstSeen: number;
	lastSeen: number;
	packetCount: number;
	rssiAvg: number | null;
	rssiMin: number | null;
	rssiMax: number | null;
	vendor: string | null;
	product: string | null;
	category: BluetoothCategory;
	phy: BluetoothPhy;
	services: string[];
	isIbeacon: boolean;
	isAirtag: boolean;
	appleContinuityType: string | null;
	bdClassic: boolean;
}

export interface BluedragonControlResult {
	success: boolean;
	message: string;
	details?: string;
	error?: string;
}

export interface BluedragonStatusResult {
	success: boolean;
	isRunning: boolean;
	status: BluedragonStatus;
	pid: number | null;
	startedAt: number | null;
	packetCount: number;
	deviceCount: number;
	profile: BluedragonProfile | null;
}

export interface BluedragonControlRequest {
	action: 'start' | 'stop';
	profile?: BluedragonProfile;
}

export interface BluetoothDeviceUpdateMessage {
	type: 'bluetooth_device_update';
	data: { op: 'upsert' | 'remove'; device: BluetoothDevice };
	timestamp: number;
}

export interface BluetoothStatusUpdateMessage {
	type: 'bluetooth_status_update';
	data: BluedragonStatusResult;
	timestamp: number;
}
