import { writable, type Writable } from 'svelte/store';

export interface SweepControlState {
	cycleTime: number;
	isStarted: boolean;
	isLoading: boolean;
	canStart: boolean;
	canStop: boolean;
	canEmergencyStop: boolean;
}

export interface ControlState {
	sweepControl: SweepControlState;
}

const defaultControlState: ControlState = {
	sweepControl: {
		cycleTime: 10,
		isStarted: false,
		isLoading: false,
		canStart: true,
		canStop: false,
		canEmergencyStop: false
	}
};

export const controlStore: Writable<ControlState> = writable(defaultControlState);

// Helper functions for control management
export const controlActions = {
	setCycleTime: (time: number) => {
		controlStore.update(state => ({
			...state,
			sweepControl: {
				...state.sweepControl,
				cycleTime: Math.max(1, Math.min(30, time))
			}
		}));
	},

	setSweepStarted: () => {
		controlStore.update(state => ({
			...state,
			sweepControl: {
				...state.sweepControl,
				isStarted: true,
				isLoading: false,
				canStart: false,
				canStop: true,
				canEmergencyStop: true
			}
		}));
	},

	setSweepStopped: () => {
		controlStore.update(state => ({
			...state,
			sweepControl: {
				...state.sweepControl,
				isStarted: false,
				isLoading: false,
				canStart: true,
				canStop: false,
				canEmergencyStop: false
			}
		}));
	},

	setSweepLoading: (loading: boolean) => {
		controlStore.update(state => ({
			...state,
			sweepControl: {
				...state.sweepControl,
				isLoading: loading,
				canStart: !loading && !state.sweepControl.isStarted,
				canStop: !loading && state.sweepControl.isStarted
			}
		}));
	},

	setControlsEnabled: (enabled: boolean) => {
		controlStore.update(state => ({
			...state,
			sweepControl: {
				...state.sweepControl,
				canStart: enabled && !state.sweepControl.isStarted,
				canStop: enabled && state.sweepControl.isStarted,
				canEmergencyStop: enabled && state.sweepControl.isStarted
			}
		}));
	},

	resetControls: () => {
		controlStore.set(defaultControlState);
	}
};

export default controlStore;