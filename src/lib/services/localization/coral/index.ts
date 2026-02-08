/**
 * Coral TPU Acceleration Module
 *
 * Hardware-accelerated RSSI localization using Google Coral Edge TPU.
 * Provides both v1 and v2 accelerator implementations.
 */

// --- coral-accelerator (v1) ---
export { CoralAccelerator, createCoralAccelerator } from "./coral-accelerator";
export type { CoralPrediction } from "./coral-accelerator";

// --- coral-accelerator-v2 (aliased to avoid name conflicts with v1) ---
export {
	CoralAccelerator as CoralAcceleratorV2,
	createCoralAccelerator as createCoralAcceleratorV2,
} from "./coral-accelerator-v2";
export type { CoralPrediction as CoralPredictionV2 } from "./coral-accelerator-v2";

// --- integration-example ---
export { setupLocalizer } from "./integration-example";
