import { controlStore, controlActions, type SweepControlState } from '$lib/stores/hackrfsweep/controlStore';
import { frequencyStore } from '$lib/stores/hackrfsweep/frequencyStore';
import { hackrfAPI } from '$lib/services/hackrf/api';
import { get } from 'svelte/store';

export class ControlService {
	private unsubscribe: (() => void) | null = null;

	constructor() {
		this.initialize();
	}

	private initialize(): void {
		// Subscribe to frequency changes to update control availability
		this.unsubscribe = frequencyStore.subscribe((frequencyState) => {
			const hasValidFrequencies = frequencyState.frequencies.length > 0 && 
				frequencyState.frequencies.some(f => f.value);
			
			// Only enable controls if we have valid frequencies and not currently sweeping
			const currentControl = get(controlStore);
			if (!currentControl.sweepControl.isStarted && !currentControl.sweepControl.isLoading) {
				controlActions.setControlsEnabled(hasValidFrequencies);
			}
		});
	}

	// Control Management
	setCycleTime(time: number): void {
		controlActions.setCycleTime(time);
	}

	async startSweep(): Promise<void> {
		const frequencyState = get(frequencyStore);
		const validFrequencies = frequencyState.frequencies.filter(f => f.value);

		if (validFrequencies.length === 0) {
			throw new Error('Please add at least one frequency');
		}

		controlActions.setSweepLoading(true);

		try {
			const validFreqs = validFrequencies.map(f => ({
				start: Number(f.value) - 10,
				stop: Number(f.value) + 10,
				step: 1
			}));

			const controlState = get(controlStore);
			await hackrfAPI.startSweep(validFreqs, controlState.sweepControl.cycleTime);
			
			controlActions.setSweepStarted();
		} catch (error) {
			controlActions.setSweepLoading(false);
			throw error;
		}
	}

	async stopSweep(): Promise<void> {
		controlActions.setSweepLoading(true);

		try {
			await hackrfAPI.stopSweep();
			controlActions.setSweepStopped();
		} catch (error) {
			controlActions.setSweepLoading(false);
			throw error;
		}
	}

	async emergencyStop(): Promise<void> {
		try {
			await fetch('/api/hackrf/emergency-stop', { method: 'POST' });
			controlActions.setSweepStopped();
		} catch {
			throw new Error('Emergency stop failed');
		}
	}

	// State Management
	isReadyToStart(): boolean {
		const controlState = get(controlStore);
		const frequencyState = get(frequencyStore);
		
		return !controlState.sweepControl.isStarted && 
			   !controlState.sweepControl.isLoading &&
			   frequencyState.frequencies.some(f => f.value);
	}

	getCurrentState(): SweepControlState {
		return get(controlStore).sweepControl;
	}

	// Control Validation
	validateSweepParameters(): { valid: boolean; error?: string } {
		const frequencyState = get(frequencyStore);
		const controlState = get(controlStore);

		if (frequencyState.frequencies.length === 0) {
			return { valid: false, error: 'No frequencies configured' };
		}

		const validFrequencies = frequencyState.frequencies.filter(f => f.value);
		if (validFrequencies.length === 0) {
			return { valid: false, error: 'No valid frequencies specified' };
		}

		if (controlState.sweepControl.cycleTime < 1 || controlState.sweepControl.cycleTime > 30) {
			return { valid: false, error: 'Cycle time must be between 1 and 30 seconds' };
		}

		return { valid: true };
	}

	// Reset Controls
	resetControls(): void {
		controlActions.resetControls();
	}

	// Cleanup
	destroy(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
	}
}

// Create service instance
export const controlService = new ControlService();

// Helper functions for components
export const controlHelpers = {
	startSweep: () => controlService.startSweep(),
	stopSweep: () => controlService.stopSweep(),
	emergencyStop: () => controlService.emergencyStop(),
	setCycleTime: (time: number) => controlService.setCycleTime(time),
	isReadyToStart: () => controlService.isReadyToStart(),
	validateParameters: () => controlService.validateSweepParameters(),
	resetControls: () => controlService.resetControls()
};