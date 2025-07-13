import { displayStore, displayActions, type SignalAnalysisState } from '$lib/stores/hackrfsweep/displayStore';

export class DisplayService {
	private unsubscribe?: () => void;
	private timerInterval?: ReturnType<typeof setInterval>;
	private progressInterval?: ReturnType<typeof setInterval>;

	constructor() {
		this.unsubscribe = displayStore.subscribe(_state => {
			// Handle display state changes if needed
		});
	}

	// Timer Display Management
	startLocalTimer(cycleTime: number): void {
		this.stopLocalTimer();
		
		let localTimeRemaining = cycleTime;
		
		this.timerInterval = setInterval(() => {
			localTimeRemaining--;
			
			displayActions.updateTimerState({
				localTimeRemaining,
				switchTimer: this.formatTimeRemaining(localTimeRemaining)
			});
			
			if (localTimeRemaining <= 0) {
				this.stopLocalTimer();
				displayActions.updateTimerState({
					isSwitching: true,
					switchTimer: 'Switching...'
				});
			}
		}, 1000);

		// Progress bar update
		this.progressInterval = setInterval(() => {
			const elapsed = cycleTime - localTimeRemaining;
			const progress = (elapsed / cycleTime) * 100;
			
			displayActions.updateTimerState({
				timerProgress: Math.min(100, Math.max(0, progress))
			});
		}, 100);
	}

	stopLocalTimer(): void {
		if (this.timerInterval) {
			clearInterval(this.timerInterval);
			this.timerInterval = undefined;
		}
		if (this.progressInterval) {
			clearInterval(this.progressInterval);
			this.progressInterval = undefined;
		}
	}

	resetTimer(): void {
		this.stopLocalTimer();
		displayActions.updateTimerState({
			currentFrequencyDisplay: '--',
			switchTimer: '--',
			timerProgress: 0,
			isSwitching: false,
			localTimeRemaining: 0
		});
	}

	updateCurrentFrequency(frequency: string): void {
		displayActions.updateTimerState({
			currentFrequencyDisplay: frequency
		});
	}

	// Signal Analysis Display Management
	updateSignalMetrics(dbLevel: number, targetFreq: string, detectedFreq?: string): void {
		const signalUpdate: Partial<SignalAnalysisState> = {
			dbLevelValue: dbLevel.toFixed(2),
			signalStrengthText: displayActions.getSignalStrengthText(dbLevel),
			targetFrequency: targetFreq,
			signalFillWidth: displayActions.calculateSignalFill(dbLevel),
			dbIndicatorPosition: displayActions.calculateDbIndicatorPosition(dbLevel),
			dbCurrentValue: displayActions.formatDbValue(dbLevel)
		};

		if (detectedFreq) {
			signalUpdate.detectedFrequency = detectedFreq;
			
			// Calculate frequency offset
			const targetMHz = parseFloat(targetFreq.replace(' MHz', ''));
			const detectedMHz = parseFloat(detectedFreq.replace(' MHz', ''));
			
			if (!isNaN(targetMHz) && !isNaN(detectedMHz)) {
				const offset = detectedMHz - targetMHz;
				signalUpdate.frequencyOffset = (offset >= 0 ? '+' : '') + offset.toFixed(2) + ' MHz';
			}
		}

		displayActions.updateSignalAnalysis(signalUpdate);
	}

	resetSignalDisplay(): void {
		displayActions.updateSignalAnalysis({
			dbLevelValue: '--.--',
			signalStrengthText: 'No Signal',
			targetFrequency: '--',
			detectedFrequency: '--',
			frequencyOffset: '--',
			signalFillWidth: '0%',
			dbIndicatorPosition: '0%',
			dbCurrentValue: '-90 dB'
		});
	}

	// System Status Display Management
	updateSystemStatus(message: string, isReady: boolean = true): void {
		displayActions.updateSystemStatus(message, isReady);
	}

	setReadyStatus(): void {
		displayActions.updateSystemStatus('Ready to start monitoring', true);
	}

	setErrorStatus(error: string): void {
		displayActions.updateSystemStatus(`Error: ${error}`, false);
	}

	setSweepStarted(): void {
		displayActions.updateSystemStatus('Sweep started successfully', true);
	}

	setSweepStopped(): void {
		displayActions.updateSystemStatus('Sweep stopped', true);
	}

	// Utility Methods
	private formatTimeRemaining(seconds: number): string {
		if (seconds <= 0) return '00:00';
		
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}

	// Complete reset
	resetAllDisplays(): void {
		this.stopLocalTimer();
		displayActions.resetDisplays();
	}

	// Frequency switching animation
	triggerFrequencySwitch(newFrequency: string, switchDelay: number = 3): void {
		displayActions.updateTimerState({
			isSwitching: true,
			switchTimer: 'Switching...'
		});

		// After switch delay, update to new frequency
		setTimeout(() => {
			displayActions.updateTimerState({
				currentFrequencyDisplay: newFrequency,
				isSwitching: false
			});
		}, switchDelay * 1000);
	}

	destroy(): void {
		this.stopLocalTimer();
		if (this.unsubscribe) {
			this.unsubscribe();
		}
	}
}

// Create service instance
export const displayService = new DisplayService();

// Re-export displayActions for components
export { displayActions };