import { writable, type Writable } from 'svelte/store';

export interface SignalDataPoint {
	frequency: number;
	power: number;
	timestamp: number;
}

export interface SignalAnalysisMetrics {
	peakPower: number;
	averagePower: number;
	noiseFloor: number;
	signalToNoise: number;
	bandwidth: number;
}

export interface SignalProcessingState {
	currentSignalData: SignalDataPoint | null;
	signalHistory: SignalDataPoint[];
	analysisMetrics: SignalAnalysisMetrics;
	processingActive: boolean;
	lastUpdateTime: number;
}

const defaultSignalState: SignalProcessingState = {
	currentSignalData: null,
	signalHistory: [],
	analysisMetrics: {
		peakPower: -100,
		averagePower: -100,
		noiseFloor: -90,
		signalToNoise: 0,
		bandwidth: 0
	},
	processingActive: false,
	lastUpdateTime: 0
};

export const signalStore: Writable<SignalProcessingState> = writable(defaultSignalState);

// Signal processing actions
export const signalActions = {
	updateSignalData: (frequency: number, power: number) => {
		const dataPoint: SignalDataPoint = {
			frequency,
			power,
			timestamp: Date.now()
		};

		signalStore.update(state => {
			const newHistory = [...state.signalHistory, dataPoint].slice(-100); // Keep last 100 readings
			
			// Calculate analysis metrics
			const powers = newHistory.map(d => d.power);
			const peakPower = Math.max(...powers);
			const averagePower = powers.reduce((sum, p) => sum + p, 0) / powers.length;
			const noiseFloor = Math.min(...powers);
			const signalToNoise = peakPower - noiseFloor;
			
			return {
				...state,
				currentSignalData: dataPoint,
				signalHistory: newHistory,
				analysisMetrics: {
					peakPower,
					averagePower,
					noiseFloor,
					signalToNoise,
					bandwidth: 0 // Will be calculated based on sweep range
				},
				lastUpdateTime: Date.now()
			};
		});
	},

	setProcessingActive: (active: boolean) => {
		signalStore.update(state => ({
			...state,
			processingActive: active
		}));
	},

	clearSignalHistory: () => {
		signalStore.update(state => ({
			...state,
			signalHistory: [],
			currentSignalData: null,
			analysisMetrics: {
				peakPower: -100,
				averagePower: -100,
				noiseFloor: -90,
				signalToNoise: 0,
				bandwidth: 0
			}
		}));
	},

	resetSignalProcessing: () => {
		signalStore.set(defaultSignalState);
	}
};

// Helper functions for signal analysis
export const signalUtils = {
	calculateSignalStrength: (dbValue: number): string => {
		if (dbValue >= -30) return 'Very Strong';
		if (dbValue >= -50) return 'Strong';
		if (dbValue >= -70) return 'Moderate';
		if (dbValue >= -85) return 'Weak';
		return 'No Signal';
	},

	calculateSignalPercentage: (dbValue: number): number => {
		// Convert dB value (-90 to -10) to percentage (0% to 100%)
		const clampedDb = Math.max(-90, Math.min(-10, dbValue));
		return ((clampedDb + 90) / 80) * 100;
	},

	formatDbValue: (dbValue: number): string => {
		return `${dbValue.toFixed(1)} dB`;
	},

	calculateFrequencyOffset: (targetFreq: number, detectedFreq: number): string => {
		const offset = detectedFreq - targetFreq;
		return (offset >= 0 ? '+' : '') + offset.toFixed(2) + ' MHz';
	},

	isValidSignalData: (targetFreq: number, detectedFreq: number, toleranceMHz: number = 50): boolean => {
		return Math.abs(detectedFreq - targetFreq) < toleranceMHz;
	},

	getSignalGradientClass: (dbValue: number): string => {
		if (dbValue < -70) return 'gradient-weak';
		if (dbValue < -50) return 'gradient-moderate';
		if (dbValue < -30) return 'gradient-strong';
		return 'gradient-very-strong';
	}
};

export default signalStore;