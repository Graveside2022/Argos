export interface BettercapDevice {
	mac: string;
	ip: string;
	hostname: string;
	vendor: string;
	firstSeen: string;
	lastSeen: string;
}

export interface BettercapWiFiAP {
	bssid: string;
	essid: string;
	channel: number;
	encryption: string;
	rssi: number;
	clients: number;
	firstSeen: string;
	lastSeen: string;
	handshake: boolean;
}

export interface BettercapBLEDevice {
	mac: string;
	name: string;
	vendor: string;
	rssi: number;
	connectable: boolean;
	services: string[];
	lastSeen: string;
}

export type BettercapMode = 'wifi-recon' | 'ble-recon' | 'net-recon';

export interface BettercapSession {
	started: boolean;
	modules: string[];
	interfaces: string[];
}

export interface BettercapEvent {
	tag: string;
	time: string;
	data: Record<string, unknown>;
}
