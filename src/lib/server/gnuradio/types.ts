export interface SpectrumPoint {
	frequency: number;
	power: number;
}

export interface WaterfallData {
	timestamp: Date;
	spectrum: SpectrumPoint[];
}

export interface SignalDetection {
	centerFrequency: number;
	bandwidth: number;
	power: number;
	timestamp: Date;
	modulation?: string;
}

export interface GNURadioStatus {
	running: boolean;
	centerFrequency: number;
	sampleRate: number;
	gain: number;
	packetsProcessed: number;
	detectedSignals: number;
}