export interface PagerMessage {
	timestamp: string;
	capcode: string;
	content: string;
	functionType: number;
	bitrate: number;
}

export interface PagermonStatus {
	running: boolean;
	frequency: number;
	messageCount: number;
	lastMessage: PagerMessage | null;
}

export interface PagermonConfig {
	frequency: number; // Default 152 MHz
	gain: number;
	sampleRate: number;
}
