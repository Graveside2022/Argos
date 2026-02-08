// Canonical store barrel — all reactive state accessible from '$lib/stores'
//
// Top-level store modules (explicit named re-exports)
export {
	bettercapMode,
	bettercapState,
	bettercapRunning,
	sendCommand,
	startBettercapPolling,
	startRecon,
	stopBettercapPolling,
	stopRecon,
} from "./bettercap-store";

export {
	btleRunning,
	btleState,
	startBtle,
	startBtlePolling,
	stopBtle,
	stopBtlePolling,
} from "./btle-store";

export {
	companionStatuses,
	launchApp,
	startCompanionPolling,
	stopApp,
	stopCompanionPolling,
} from "./companion-store";

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
	webSocketStates,
} from "./connection";
export type {
	ServiceConnectionStatus,
	ServiceStatus,
	SystemHealth,
} from "./connection";

export {
	activeMission,
	addSignalCapture,
	areasOfInterest,
	completeMission,
	createMission,
	droneState,
	flightRecorder,
	isOperational,
	missionHistory,
	missionProgress,
	pauseMission,
	recordFlightPoint,
	selectedAOI,
	startMission,
} from "./drone";
export type {
	AreaOfInterest,
	DroneMission,
	DroneState,
	FlightEvent,
	FlightPoint,
	FlightRecorder,
	MissionSettings,
	MissionStatistics,
	SignalCapture,
	Waypoint,
	WaypointAction,
} from "./drone";

export { gsmEvilStore } from "./gsm-evil-store";
export type {
	GSMEvilState,
	ScanResult as GSMScanResult,
} from "./gsm-evil-store";

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
	updateSweepStatus,
} from "./hackrf";
export type {
	ConnectionStatus,
	CycleStatus,
	DeviceInfo,
	EmergencyStopStatus,
	FrequencyRange,
	HackRFConfig,
	SignalHistoryEntry,
	SpectrumData,
	SweepStatus,
} from "./hackrf";

export {
	acquireDevice,
	alfaAvailable,
	alfaDetected,
	alfaOwner,
	forceReleaseDevice,
	hackrfAvailable,
	hackrfDetected,
	hackrfOwner,
	hardwareStatus,
	releaseDevice,
	startPolling as startHardwarePolling,
	stopPolling as stopHardwarePolling,
} from "./hardware-store";

export {
	activeDevices,
	channelDistribution,
	devicesByType,
	kismetStore,
	recentAlerts,
} from "./kismet";

export { notifications } from "./notifications";
export type { Notification } from "./notifications";

export {
	pagermonRunning,
	pagermonState,
	startPagermon,
	startPagermonPolling,
	stopPagermon,
	stopPagermonPolling,
} from "./pagermon-store";

export { rtl433Store } from "./rtl433-store";
export type { CapturedSignal, RTL433State } from "./rtl433-store";

export {
	connectionStatus as usrpConnectionStatus,
	lastError as usrpLastError,
	spectrumData as usrpSpectrumData,
} from "./usrp";

export {
	clearError as clearWifiteError,
	deselectAllTargets,
	dismissLastRun,
	selectAllTargets,
	selectTarget,
	setAttackMode,
	startAttack,
	startWifitePolling,
	stopAttack,
	stopWifitePolling,
	wifiteRunning,
	wifiteState,
} from "./wifite-store";

// Subdirectory re-exports
export * from "./dashboard";
export * from "./hackrfsweep";
export * from "./map";
export * from "./tactical-map";
export * from "./wigletotak";
