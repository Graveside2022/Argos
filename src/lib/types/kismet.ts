export interface KismetDevice {
	mac: string;
	last_seen: number;
	signal: {
		last_signal?: number;
		max_signal?: number;
		min_signal?: number;
	};
	manufacturer?: string;
	type: string;
	channel: number;
	frequency: number;
	packets: number;
	datasize: number;
	location?: {
		lat: number;
		lon: number;
	};
}

export interface KismetNetwork {
	ssid: string;
	bssid: string;
	channel: number;
	frequency: number;
	encryption: string;
	last_seen: number;
	signal: {
		last_signal?: number;
	};
	clients: number;
}

export interface KismetAlert {
	id: string;
	type: 'new_device' | 'security' | 'deauth' | 'probe' | 'handshake' | 'suspicious' | 'info';
	severity: 'low' | 'medium' | 'high';
	message: string;
	timestamp: number;
	details?: {
		mac?: string;
		ssid?: string;
		channel?: number;
		signal?: number;
		[key: string]: string | number | boolean | undefined;
	};
}

export interface KismetStatus {
	kismet_running: boolean;
	wigle_running: boolean;
	gps_running: boolean;
}

export interface KismetGPS {
	status: string;
	lat: string;
	lon: string;
	alt: string;
	time: string;
}

export interface KismetStore {
	devices: KismetDevice[];
	networks: KismetNetwork[];
	alerts: KismetAlert[];
	status: KismetStatus;
	gps: KismetGPS;
	lastUpdate: number | null;
	startTime: number | null;
}