/**
 * Canonical Bettercap type definitions.
 * Used by both server/bettercap and stores/bettercap-store.
 */

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
