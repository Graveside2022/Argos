export interface BettercapDevice {
	mac: string;
	ip: string;
	hostname: string;
	vendor: string;
	firstSeen: string;
	lastSeen: string;
}

// Re-export canonical types from $lib/types/bettercap (Phase 0.6.2 backward compat)
export type { BettercapWiFiAP, BettercapBLEDevice, BettercapMode } from '$lib/types/bettercap';

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
