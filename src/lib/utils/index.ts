// Utility barrel — shared helpers for geo, CSS, device rendering, logging, and signal display
export { detectCountry, formatCoordinates } from "./country-detector";

export {
	isCriticalCSSLoaded,
	loadCSS,
	markCSSLoaded,
	preloadCSS,
	waitForCriticalCSS,
} from "./css-loader";
export type { CSSLoadOptions } from "./css-loader";

export {
	getDeviceIcon,
	iconAP,
	iconBluetooth,
	iconBridge,
	iconCellTower,
	iconClient,
	iconIoT,
	iconSDR,
	iconUnknown,
} from "./device-icons";

export {
	logDebug,
	logError,
	logInfo,
	logWarn,
	logger,
	LogLevel,
} from "./logger";

export { formatMGRS, getMGRSPrecision, latLonToMGRS } from "./mgrs-converter";

export { cellTowerPopupHTML, devicePopupHTML } from "./popup-templates";

export {
	formatLastSeen,
	getSignalBandKey,
	getSignalColor,
	getSignalHex,
	signalBands,
} from "./signal-utils";
export type { SignalBand } from "./signal-utils";

// Subdirectory re-exports
export {
	calculateFrequencyOffset as hackrfCalculateFrequencyOffset,
	calculateSignalStrength as hackrfCalculateSignalStrength,
	formatFrequency as hackrfFormatFrequency,
	getSignalColor as hackrfGetSignalColor,
	updateSignalVisualization as hackrfUpdateSignalVisualization,
} from "./hackrf";
