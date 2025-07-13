// HackRF API Types and Interfaces

export interface SweepConfig {
	centerFrequency: number;
	bandwidth?: number;
	sampleRate?: number;
	lnaGain?: number;
	vgaGain?: number;
	txvgaGain?: number;
	ampEnable?: boolean;
	antennaEnable?: boolean;
	binSize?: number;
	numSweeps?: number;
	sweepRate?: number;
	// Support for multi-frequency cycling
	frequencies?: Array<{ value: number; unit: string }>;
	cycleTime?: number; // Time per frequency in ms
}

import type { SweepManagerState } from '$lib/types/shared';

export interface SweepStatus {
	state: SweepManagerState;
	currentFrequency?: number;
	sweepProgress?: number;
	totalSweeps?: number;
	completedSweeps?: number;
	startTime?: number;
	error?: string;
}

export interface SpectrumDataPoint {
	frequency: number;
	power: number;
	timestamp: number;
}

export interface SpectrumData {
	timestamp: Date;
	frequency: number; // Peak frequency in MHz
	power: number; // Peak power in dB
	unit?: string;
	binData?: number[]; // Array of power values
	startFreq?: number; // Start frequency for validation
	endFreq?: number; // End frequency for validation
	powerValues?: number[]; // Power values array for validation
	metadata?: {
		targetFrequency?: { value: number; unit: string };
		currentIndex?: number;
		totalFrequencies?: number;
		frequencyRange?: {
			low: number;
			high: number;
			center: number;
		};
		binWidth?: number;
		signalStrength?: string;
		date?: string;
		time?: string;
		peakBinIndex?: number;
		[key: string]: unknown; // Allow complex types in metadata
	};
}

export interface HackRFHealth {
	connected: boolean;
	serialNumber?: string;
	firmwareVersion?: string;
	temperature?: number;
	deviceInfo?: string;
	error?: string;
	lastUpdate: number;
}

export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
	timestamp: number;
}
