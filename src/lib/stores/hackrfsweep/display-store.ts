import { writable, type Writable } from 'svelte/store';

export interface TimerState {
	currentFrequencyDisplay: string;
	switchTimer: string;
	timerProgress: number;
	isSwitching: boolean;
	localTimeRemaining: number;
}

export interface SignalAnalysisState {
	dbLevelValue: string;
	signalStrengthText: string;
	targetFrequency: string;
	detectedFrequency: string;
	frequencyOffset: string;
	signalFillWidth: string;
	dbIndicatorPosition: string;
	dbCurrentValue: string;
}

export interface SystemStatusState {
	statusMessage: string;
	isReady: boolean;
}

export interface DisplayState {
	timer: TimerState;
	signalAnalysis: SignalAnalysisState;
	systemStatus: SystemStatusState;
}

const defaultDisplayState: DisplayState = {
	timer: {
		currentFrequencyDisplay: '--',
		switchTimer: '--',
		timerProgress: 0,
		isSwitching: false,
		localTimeRemaining: 0
	},
	signalAnalysis: {
		dbLevelValue: '--.--',
		signalStrengthText: 'No Signal',
		targetFrequency: '--',
		detectedFrequency: '--',
		frequencyOffset: '--',
		signalFillWidth: '0%',
		dbIndicatorPosition: '0%',
		dbCurrentValue: '-90 dB'
	},
	systemStatus: {
		statusMessage: '',
		isReady: true
	}
};

export const displayStore: Writable<DisplayState> = writable(defaultDisplayState);

// Helper functions for display management
export const displayActions = {
	updateTimerState: (state: Partial<TimerState>) => {
		displayStore.update(current => ({
			...current,
			timer: { ...current.timer, ...state }
		}));
	},

	updateSignalAnalysis: (state: Partial<SignalAnalysisState>) => {
		displayStore.update(current => ({
			...current,
			signalAnalysis: { ...current.signalAnalysis, ...state }
		}));
	},

	updateSystemStatus: (message: string, isReady: boolean = true) => {
		displayStore.update(current => ({
			...current,
			systemStatus: { statusMessage: message, isReady }
		}));
	},

	resetDisplays: () => {
		displayStore.set(defaultDisplayState);
	},

	// Signal strength calculation helpers
	calculateSignalFill: (dbValue: number): string => {
		// Convert dB value (-90 to -10) to percentage (0% to 100%)
		const normalizedValue = Math.max(0, Math.min(100, ((dbValue + 90) / 80) * 100));
		return `${normalizedValue}%`;
	},

	calculateDbIndicatorPosition: (dbValue: number): string => {
		// Convert dB value (-90 to -10) to position percentage
		const normalizedValue = Math.max(0, Math.min(100, ((dbValue + 90) / 80) * 100));
		return `${normalizedValue}%`;
	},

	formatDbValue: (dbValue: number): string => {
		return `${dbValue.toFixed(0)} dB`;
	},

	getSignalStrengthText: (dbValue: number): string => {
		if (dbValue >= -30) return 'Very Strong';
		if (dbValue >= -50) return 'Strong';
		if (dbValue >= -70) return 'Moderate';
		if (dbValue >= -85) return 'Weak';
		return 'No Signal';
	},

	// Additional helper methods for components
	setCurrentFrequency: (frequency: string) => {
		displayActions.updateTimerState({ currentFrequencyDisplay: frequency });
	},

	setTargetFrequency: (frequency: string) => {
		displayActions.updateSignalAnalysis({ targetFrequency: frequency });
	},

	setStatusMessage: (message: string) => {
		displayActions.updateSystemStatus(message, true);
	},

	startLocalTimer: () => {
		// Timer management handled by DisplayService
	},

	stopLocalTimer: () => {
		// Timer management handled by DisplayService
	}
};

export default displayStore;