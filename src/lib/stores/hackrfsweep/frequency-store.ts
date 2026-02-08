import { writable, type Writable } from 'svelte/store';

export interface FrequencyItem {
	id: number;
	value: number | string;
}

export interface FrequencyState {
	frequencies: FrequencyItem[];
	frequencyCounter: number;
	cycleTime: number;
	currentFrequencyDisplay: string;
	targetFrequency: string;
	detectedFrequency: string;
	frequencyOffset: string;
}

const defaultFrequencyState: FrequencyState = {
	frequencies: [{ id: 1, value: 2400 }],
	frequencyCounter: 1,
	cycleTime: 10,
	currentFrequencyDisplay: '--',
	targetFrequency: '--',
	detectedFrequency: '--',
	frequencyOffset: '--'
};

export const frequencyStore: Writable<FrequencyState> = writable(defaultFrequencyState);

// Helper functions for frequency management
export const frequencyActions = {
	addFrequency: () => {
		frequencyStore.update(state => {
			state.frequencyCounter++;
			state.frequencies = [...state.frequencies, { id: state.frequencyCounter, value: '' }];
			return state;
		});
	},

	removeFrequency: (id: number) => {
		frequencyStore.update(state => {
			state.frequencies = state.frequencies.filter(f => f.id !== id);
			return state;
		});
	},

	updateFrequency: (id: number, value: number | string) => {
		frequencyStore.update(state => {
			const freq = state.frequencies.find(f => f.id === id);
			if (freq) {
				freq.value = value;
			}
			return state;
		});
	},

	setCycleTime: (time: number) => {
		frequencyStore.update(state => {
			state.cycleTime = Math.max(1, Math.min(30, time));
			return state;
		});
	},

	updateCurrentFrequency: (frequency: string) => {
		frequencyStore.update(state => {
			state.currentFrequencyDisplay = frequency;
			return state;
		});
	},

	updateTargetFrequency: (frequency: string) => {
		frequencyStore.update(state => {
			state.targetFrequency = frequency;
			return state;
		});
	},

	updateDetectedFrequency: (frequency: string, offset: string) => {
		frequencyStore.update(state => {
			state.detectedFrequency = frequency;
			state.frequencyOffset = offset;
			return state;
		});
	},

	resetFrequencyDisplays: () => {
		frequencyStore.update(state => {
			state.currentFrequencyDisplay = '--';
			state.targetFrequency = '--';
			state.detectedFrequency = '--';
			state.frequencyOffset = '--';
			return state;
		});
	},

	getValidFrequencies: (frequencies: FrequencyItem[]) => {
		return frequencies.filter(f => f.value).map(f => ({
			start: Number(f.value) - 10,
			stop: Number(f.value) + 10,
			step: 1
		}));
	},

	validateFrequencies: (frequencies: FrequencyItem[]) => {
		return frequencies.length > 0 && frequencies.some(f => f.value);
	}
};

export default frequencyStore;