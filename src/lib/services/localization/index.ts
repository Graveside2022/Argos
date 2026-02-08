/**
 * RSSI Localization Module
 *
 * Signal-strength-based device localization using Gaussian Process
 * Regression, with optional Google Coral TPU hardware acceleration.
 */

// --- types ---
export type {
	CoralPrediction,
	GPRPrediction,
	GeoBounds,
	RSSIMeasurement,
	SourceEstimate,
} from "./types";

// --- hybrid-rssi-localizer ---
export { HybridRSSILocalizer } from "./hybrid-rssi-localizer";

// --- rssi-localizer ---
export { RSSILocalizer } from "./rssi-localizer";

// --- coral/ subdirectory ---
export {
	CoralAccelerator,
	CoralAcceleratorV2,
	createCoralAccelerator,
	createCoralAcceleratorV2,
	setupLocalizer,
} from "./coral";
export type { CoralPredictionV2 } from "./coral";
