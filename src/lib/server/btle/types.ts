export interface BLEPacket {
	mac: string;
	channel: number;
	rssi: number;
	pduType: string;
	advData: string;
	angle: number | null;
	timestamp: string;
	name: string | null;
}

export interface BTLEStatus {
	running: boolean;
	packetCount: number;
	uniqueDevices: number;
	channel: number;
}

export interface BTLEConfig {
	channel: number; // 37, 38, or 39
	gain: number;
}
