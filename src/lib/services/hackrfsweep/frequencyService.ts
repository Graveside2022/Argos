import { frequencyStore, frequencyActions, type FrequencyItem } from '$lib/stores/hackrfsweep/frequencyStore';
import { get } from 'svelte/store';

export class FrequencyService {
	private unsubscribe?: () => void;

	constructor() {
		// Subscribe to frequency store for reactive updates
		this.unsubscribe = frequencyStore.subscribe(_state => {
			// Handle frequency state changes if needed
		});
	}

	addFrequency(): void {
		frequencyActions.addFrequency();
	}

	removeFrequency(id: number): void {
		frequencyActions.removeFrequency(id);
	}

	updateFrequency(id: number, value: number | string): void {
		frequencyActions.updateFrequency(id, value);
	}

	setCycleTime(time: number): void {
		frequencyActions.setCycleTime(time);
	}

	getValidFrequencies(): Array<{ start: number; stop: number; step: number }> {
		const state = get(frequencyStore);
		return frequencyActions.getValidFrequencies(state.frequencies);
	}

	validateFrequencies(): boolean {
		const state = get(frequencyStore);
		return frequencyActions.validateFrequencies(state.frequencies);
	}

	updateCurrentFrequency(frequency: string): void {
		frequencyActions.updateCurrentFrequency(frequency);
	}

	updateTargetFrequency(frequency: string): void {
		frequencyActions.updateTargetFrequency(frequency);
	}

	updateDetectedFrequency(frequency: string, targetFreq: string): void {
		const detectedFreqMHz = parseFloat(frequency);
		const targetFreqMHz = parseFloat(targetFreq);

		// Only update if we're within reasonable range (±50 MHz) of target
		if (!isNaN(targetFreqMHz) && Math.abs(detectedFreqMHz - targetFreqMHz) < 50) {
			const detectedDisplay = detectedFreqMHz.toFixed(2) + ' MHz';
			const offset = detectedFreqMHz - targetFreqMHz;
			const offsetDisplay = (offset >= 0 ? '+' : '') + offset.toFixed(2) + ' MHz';
			
			frequencyActions.updateDetectedFrequency(detectedDisplay, offsetDisplay);
		}
	}

	resetFrequencyDisplays(): void {
		frequencyActions.resetFrequencyDisplays();
	}

	loadPresetFrequencies(preset: 'wifi' | 'bluetooth' | 'ism' | 'cellular'): void {
		let frequencies: number[] = [];

		switch (preset) {
			case 'wifi':
				frequencies = [2400, 2450, 5000, 5200, 5500, 5800];
				break;
			case 'bluetooth':
				frequencies = [2400, 2440, 2480];
				break;
			case 'ism':
				frequencies = [433, 868, 915, 2400];
				break;
			case 'cellular':
				frequencies = [800, 900, 1800, 1900, 2100];
				break;
		}

		// Clear existing frequencies and add presets
		const _state = get(frequencyStore);
		frequencyStore.update(currentState => {
			currentState.frequencies = frequencies.map((freq, index) => ({
				id: index + 1,
				value: freq
			}));
			currentState.frequencyCounter = frequencies.length;
			return currentState;
		});
	}

	getCurrentFrequencyIndex(frequencies: FrequencyItem[], currentDisplay: string): number {
		for (let i = 0; i < frequencies.length; i++) {
			if (frequencies[i].value && currentDisplay.includes(frequencies[i].value.toString())) {
				return i;
			}
		}
		return -1;
	}

	getNextFrequency(frequencies: FrequencyItem[], currentIndex: number): FrequencyItem | null {
		const validFreqs = frequencies.filter(f => f.value);
		if (validFreqs.length === 0) return null;

		const nextIndex = (currentIndex + 1) % validFreqs.length;
		return validFreqs[nextIndex];
	}

	destroy(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
		}
	}
}