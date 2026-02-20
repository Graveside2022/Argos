export interface DeviceState {
	device: string;
	isAvailable: boolean;
	owner: string | null;
	connectedSince: number | null;
	isDetected: boolean;
}

export interface HardwareStatus {
	hackrf: DeviceState;
	alfa: DeviceState;
	bluetooth: DeviceState;
}

export interface HardwareDetails {
	wifi?: {
		interface?: string;
		monitorInterface?: string;
		mac?: string;
		driver?: string;
		chipset?: string;
		mode?: string;
		channel?: string;
		bands?: string[];
	};
	sdr?: {
		serial?: string;
		product?: string;
		manufacturer?: string;
		firmwareApi?: string;
		usbSpeed?: string;
		maxPower?: string;
		configuration?: string;
	};
	gps?: {
		device?: string;
		protocol?: string;
		baudRate?: number;
		usbAdapter?: string;
		gpsdVersion?: string;
	};
}

export function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatUptime(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (h > 24) {
		const d = Math.floor(h / 24);
		return `${d}d ${h % 24}h`;
	}
	return `${h}h ${m}m`;
}
