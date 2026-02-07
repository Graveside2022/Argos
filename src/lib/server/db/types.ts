/**
 * Shared type definitions for the RF database layer.
 * Extracted from database.ts to enable clean module boundaries.
 */

export interface DbSignal {
	id?: number;
	signal_id: string;
	device_id?: string;
	timestamp: number;
	latitude: number;
	longitude: number;
	altitude?: number;
	power: number;
	frequency: number;
	bandwidth?: number | null;
	modulation?: string | null;
	source: string;
	metadata?: string;
}

export interface DbDevice {
	id?: number;
	device_id: string;
	type: string;
	manufacturer?: string;
	first_seen: number;
	last_seen: number;
	avg_power?: number;
	freq_min?: number;
	freq_max?: number;
	metadata?: string;
}

export interface DbNetwork {
	id?: number;
	network_id: string;
	name?: string;
	type: string;
	encryption?: string;
	channel?: number;
	first_seen: number;
	last_seen: number;
	center_lat?: number;
	center_lon?: number;
	radius?: number;
}

export interface DbRelationship {
	id?: number;
	source_device_id: string;
	target_device_id: string;
	network_id?: string;
	relationship_type: string;
	strength?: number;
	first_seen: number;
	last_seen: number;
}

export interface SpatialQuery {
	lat: number;
	lon: number;
	radiusMeters: number;
}

export interface TimeQuery {
	startTime?: number;
	endTime?: number;
	limit?: number;
}
