// Tactical map stores — GPS, HackRF signals, Kismet devices, map state, and system telemetry
export { gpsStore, updateGPSPosition, updateGPSStatus } from "./gps-store";
export type { GPSPosition, GPSState, GPSStatus } from "./gps-store";

export {
	addSignal as tacticalAddSignal,
	addSignalMarker,
	clearAllSignalMarkers,
	clearAllSignals,
	hackrfStore,
	removeSignal as tacticalRemoveSignal,
	removeSignalMarker,
	setConnectionStatus,
	setCurrentSignal,
	setSearchingState,
	setTargetFrequency,
	updateSignal,
	updateSignalCount,
} from "./hackrf-store";
export type { HackRFState, SimplifiedSignal } from "./hackrf-store";

export {
	addKismetDevice,
	addKismetDeviceMarker,
	clearAllKismetDevices,
	kismetStore as tacticalKismetStore,
	removeKismetDevice,
	removeKismetDeviceMarker,
	setKismetStatus,
	setWhitelistMAC,
	updateDistributions,
	updateKismetDevice,
} from "./kismet-store";
export type { KismetState } from "./kismet-store";

export {
	mapStore,
	setAccuracyCircle,
	setMap,
	setUserMarker,
} from "./map-store";
export type {
	LeafletCircle,
	LeafletCircleMarker,
	LeafletMap,
	LeafletMarker,
	MapState,
} from "./map-store";

export {
	clearSystemInfo,
	formatBytes,
	formatUptime,
	getSystemHealthStatus,
	setAutoRefresh,
	setSystemError,
	setSystemInfo,
	setSystemLoading,
	systemStore,
} from "./system-store";
export type { SystemInfo, SystemState } from "./system-store";
