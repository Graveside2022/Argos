/**
 * Map Services Module
 *
 * Spatial analysis, signal processing, and visualization services for
 * the tactical map: heatmaps, clustering, filtering, interpolation,
 * contour generation, drone detection, grid processing, and WebGL rendering.
 */

// --- altitude-layer-manager ---
export {
	AltitudeLayerManager,
	getAltitudeLayerManager,
} from "./altitude-layer-manager";
export type { AltitudeBand, LayerBlendMode } from "./altitude-layer-manager";

// --- contour-generator ---
export {
	DEFAULT_CONTOUR_CONFIG,
	generateContours,
	smoothContours,
} from "./contour-generator";
export type {
	ContourConfig,
	ContourLine,
	ContourPoint,
} from "./contour-generator";

// --- drone-detection ---
export { DroneDetectionService, droneDetector } from "./drone-detection";
export type {
	DroneAlert,
	DroneCharacteristics,
	DroneDetectionResult,
	DroneSignature,
	DroneStatistics,
	TrajectoryData,
} from "./drone-detection";

// --- grid-processor ---
export { GridProcessor, getGridProcessor } from "./grid-processor";
export type {
	FrequencyInfo,
	GridBounds,
	GridCell,
	GridProcessResult,
	GridSignal,
	GridStatsResult,
} from "./grid-processor";

// --- heatmap-service ---
export { HeatmapService, getHeatmapService } from "./heatmap-service";
export type {
	HeatmapConfig,
	HeatmapLayer,
	HeatmapPoint,
} from "./heatmap-service";

// --- kismet-rssi-service ---
export { KismetRSSIService, kismetRSSIService } from "./kismet-rssi-service";
export type { RSSILocalizationConfig } from "./kismet-rssi-service";

// --- map-utils ---
export {
	calculateDistance,
	createHeatmapData,
	createSignalMarker,
	createSignalPopup,
	estimateDistanceFromRSSI,
	exportAsGeoJSON,
	exportAsKML,
	fixLeafletIcons,
	formatDistance,
	formatDistanceEstimate,
	getClusterOptions,
	getSignalColor,
	getSignalOpacity,
} from "./map-utils";

// --- network-analyzer ---
export {
	analyzeNetworkRelationships,
	calculateNetworkLayout,
} from "./network-analyzer";
export type {
	NetworkCluster,
	NetworkEdge,
	NetworkGraph,
	NetworkNode,
} from "./network-analyzer";

// --- performance-monitor ---
export { PerformanceMonitor } from "./performance-monitor";
export type {
	PerformanceMetrics,
	PerformanceThresholds,
} from "./performance-monitor";

// --- signal-aggregator ---
export { SignalAggregator } from "./signal-aggregator";
export type { AggregatedSignal } from "./signal-aggregator";

// --- signal-clustering ---
export {
	DEFAULT_CLUSTER_OPTIONS,
	clusterSignals,
	createClusterPopupContent,
	detectSignalType,
	getClusterIcon,
	getSimplifiedSignalType,
} from "./signal-clustering";
export type { ClusterOptions, SignalCluster } from "./signal-clustering";

// --- signal-filtering ---
export {
	DRONE_FREQUENCY_BANDS,
	INTERFERENCE_BANDS,
	SignalFilterService,
	signalFilter,
} from "./signal-filtering";
export type {
	Anomaly,
	FilteredResult,
	FilteringOptions,
	FrequencyBand,
} from "./signal-filtering";

// --- signal-interpolation ---
export { SignalInterpolator } from "./signal-interpolation";
export type {
	InterpolationConfig,
	InterpolationMethod,
	InterpolationPoint,
} from "./signal-interpolation";

// --- webgl-heatmap-renderer ---
export { WebGLHeatmapRenderer } from "./webgl-heatmap-renderer";
