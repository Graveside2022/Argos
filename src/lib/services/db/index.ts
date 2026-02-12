/**
 * Client-Side Database Services Module
 *
 * IndexedDB-backed signal storage with spatial indexing for offline
 * caching and client-side querying of RF signal data.
 */

// --- signal-database ---
export type {
	DeviceRecord,
	RelationshipRecord,
	SignalDatabase,
	SignalRecord,
	SpatialQuery,
} from "./signal-database";
export { getSignalDatabase } from "./signal-database";
