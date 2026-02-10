// Map Services — signal aggregation and utilities
export { SignalAggregator } from './signal-aggregator';
export type { AggregatedSignal } from './signal-aggregator';
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
	getSignalOpacity
} from './map-utils';
