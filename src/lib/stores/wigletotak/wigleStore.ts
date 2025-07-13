import { writable } from 'svelte/store';

// Type definitions for state management
export interface TakSettings {
	serverIp: string;
	serverPort: string;
	multicastEnabled: boolean;
}

export interface AnalysisSettings {
	mode: string; // 'realtime' | 'file'
}

export interface AntennaSettings {
	type: string;
	customSensitivity: string;
}

export interface DirectorySettings {
	wigleDirectory: string;
	selectedFile: string;
	wigleFiles: string[];
}

export interface FilterSettings {
	whitelistSSID: string;
	whitelistMAC: string;
	blacklistSSID: string;
	blacklistMAC: string;
	blacklistColor: string;
}

export interface BroadcastState {
	isConnected: boolean;
	isBroadcasting: boolean;
}

export interface WigleState {
	activeTab: string;
	takSettings: TakSettings;
	analysisSettings: AnalysisSettings;
	antennaSettings: AntennaSettings;
	directorySettings: DirectorySettings;
	filterSettings: FilterSettings;
	broadcastState: BroadcastState;
}

// Initialize default state
const defaultState: WigleState = {
	activeTab: 'settings',
	takSettings: {
		serverIp: '0.0.0.0',
		serverPort: '6666',
		multicastEnabled: false
	},
	analysisSettings: {
		mode: 'realtime'
	},
	antennaSettings: {
		type: 'Standard',
		customSensitivity: '1.0'
	},
	directorySettings: {
		wigleDirectory: '/home/pi/kismet_ops',
		selectedFile: '',
		wigleFiles: []
	},
	filterSettings: {
		whitelistSSID: '',
		whitelistMAC: '',
		blacklistSSID: '',
		blacklistMAC: '',
		blacklistColor: '-65281'
	},
	broadcastState: {
		isConnected: false,
		isBroadcasting: false
	}
};

// Create the store
export const wigleStore = writable<WigleState>(defaultState);

// Store actions
export const wigleActions = {
	// Tab management
	setActiveTab: (tab: string) => {
		wigleStore.update(state => ({
			...state,
			activeTab: tab
		}));
	},

	// TAK Settings actions
	updateTakSettings: (settings: Partial<TakSettings>) => {
		wigleStore.update(state => ({
			...state,
			takSettings: { ...state.takSettings, ...settings }
		}));
	},

	// Analysis Settings actions
	updateAnalysisSettings: (settings: Partial<AnalysisSettings>) => {
		wigleStore.update(state => ({
			...state,
			analysisSettings: { ...state.analysisSettings, ...settings }
		}));
	},

	// Antenna Settings actions
	updateAntennaSettings: (settings: Partial<AntennaSettings>) => {
		wigleStore.update(state => ({
			...state,
			antennaSettings: { ...state.antennaSettings, ...settings }
		}));
	},

	// Directory Settings actions
	updateDirectorySettings: (settings: Partial<DirectorySettings>) => {
		wigleStore.update(state => ({
			...state,
			directorySettings: { ...state.directorySettings, ...settings }
		}));
	},

	// Filter Settings actions
	updateFilterSettings: (settings: Partial<FilterSettings>) => {
		wigleStore.update(state => ({
			...state,
			filterSettings: { ...state.filterSettings, ...settings }
		}));
	},

	// Broadcast State actions
	updateBroadcastState: (state: Partial<BroadcastState>) => {
		wigleStore.update(currentState => ({
			...currentState,
			broadcastState: { ...currentState.broadcastState, ...state }
		}));
	},

	// Clear filter fields
	clearWhitelistFields: () => {
		wigleStore.update(state => ({
			...state,
			filterSettings: {
				...state.filterSettings,
				whitelistSSID: '',
				whitelistMAC: ''
			}
		}));
	},

	clearBlacklistFields: () => {
		wigleStore.update(state => ({
			...state,
			filterSettings: {
				...state.filterSettings,
				blacklistSSID: '',
				blacklistMAC: ''
			}
		}));
	}
};