// Database layer: SQLite with R-tree spatial indexing, signal storage, and device tracking

// cleanup-service
export { DatabaseCleanupService } from "./cleanup-service";

// database (facade)
export { RFDatabase, getRFDatabase } from "./database";

// db-optimizer
export { DatabaseOptimizer } from "./db-optimizer";

// device-service
export { ensureDeviceExists, updateDeviceFromSignal } from "./device-service";

// geo
export {
	calculateDistance,
	convertRadiusToGrid,
	dbSignalToMarker,
	detectDeviceType,
	generateDeviceId,
} from "./geo";

// network-repository
export {
	getNetworkRelationships,
	storeNetworkGraph,
} from "./network-repository";

// signal-repository
export {
	findSignalsInRadius,
	insertSignal,
	insertSignalsBatch,
	updateSignal,
} from "./signal-repository";

// spatial-repository
export { findDevicesNearby, getAreaStatistics } from "./spatial-repository";

// types
export type {
	DbDevice,
	DbNetwork,
	DbRelationship,
	DbSignal,
	SpatialQuery,
	TimeQuery,
} from "./types";
