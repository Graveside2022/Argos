// Canonical store barrel — all reactive state accessible from '$lib/stores'
//
// Top-level store modules (explicit named re-exports)
export {
	allConnected,
	anyConnecting,
	connectionErrors,
	expressConnection,
	getConnectionStatusClass,
	getHealthStatusClass,
	getWebSocketStateText,
	hackrfConnection,
	kismetConnection,
	removeServiceStatus,
	removeWebSocketState,
	resetConnectionStores,
	runningServices,
	serviceStatuses,
	stoppedServices,
	systemHealth,
	systemHealthy,
	totalReconnectAttempts,
	updateExpressConnection,
	updateHackRFConnection,
	updateKismetConnection,
	updateServiceStatus,
	updateSystemHealth,
	updateWebSocketState,
	webSocketStates
} from './connection';
export type { ServiceConnectionStatus, ServiceStatus, SystemHealth } from './connection';

export {
	averagePower,
	clearSpectrumHistory,
	config,
	connectionStatus,
	cycleStatus,
	deviceInfo,
	emergencyStopStatus,
	formatFrequency,
	formatPower,
	formatSampleRate,
	frequencyRanges,
	isActive,
	isEmergencyStopped,
	peakFrequency,
	resetStores,
	signalHistory,
	signalStrength,
	spectrumData,
	spectrumHistory,
	sweepDuration,
	sweepProgress,
	sweepStatus,
	updateConfig,
	updateConnectionStatus,
	updateCycleStatus,
	updateDeviceInfo,
	updateEmergencyStopStatus,
	updateSignalHistory,
	updateSpectrumData,
	updateSweepStatus
} from './hackrf';
export type {
	ConnectionStatus,
	CycleStatus,
	DeviceInfo,
	EmergencyStopStatus,
	FrequencyRange,
	HackRFConfig,
	SignalHistoryEntry,
	SpectrumData,
	SweepStatus
} from './hackrf';

export {
	activeDevices,
	channelDistribution,
	devicesByType,
	kismetStore,
	recentAlerts
} from './kismet';

export { notifications } from './notifications';
export type { Notification } from './notifications';

export {
	connectionStatus as usrpConnectionStatus,
	lastError as usrpLastError,
	spectrumData as usrpSpectrumData
} from './usrp';

// Subdirectory re-exports
export * from './dashboard';
export * from './map';
export * from './tactical-map';
