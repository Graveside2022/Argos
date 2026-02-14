// Map Services — signal aggregation and utilities
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
export type { AggregatedSignal } from './signal-aggregator';
export { SignalAggregator } from './signal-aggregator';
