/**
 * Unified Data Access Layer
 * Provides a consistent API for both server-side (SQLite) and client-side (IndexedDB) storage
 */

import { browser } from '$app/environment';
import type { SignalMarker } from '$lib/stores/map/signals';
import type { NetworkEdge } from '$lib/services/map/networkAnalyzer';
import { getSignalDatabase, type SignalDatabase, type SpatialQuery } from './signalDatabase';

export interface DataQuery {
	lat?: number;
	lon?: number;
	radiusMeters?: number;
	startTime?: number;
	endTime?: number;
	limit?: number;
	deviceIds?: string[];
	signalTypes?: string[];
}

export interface SignalStatistics {
	totalSignals: number;
	uniqueDevices: number;
	avgPower: number;
	minPower: number;
	maxPower: number;
	freqBands: Map<number, number>;
	timeRange: { start: number; end: number };
}

export interface DeviceInfo {
	id: string;
	type: string;
	manufacturer?: string;
	firstSeen: number;
	lastSeen: number;
	avgPower: number;
	signalCount: number;
	lastPosition: { lat: number; lon: number };
	frequencyRange: { min: number; max: number };
}

class DataAccessLayer {
	private clientDb: SignalDatabase | null = null;
	private initialized = false;

	async initialize(): Promise<void> {
		if (this.initialized) return;

		if (browser) {
			// Client-side: Initialize IndexedDB
			this.clientDb = await getSignalDatabase();
		}

		this.initialized = true;
	}

	/**
	 * Store a single signal
	 */
	async storeSignal(signal: SignalMarker): Promise<void> {
		await this.initialize();

		if (browser && this.clientDb) {
			// Client-side storage
			await this.clientDb.storeSignal(signal);
		} else {
			// Server-side storage via API
			await fetch('/api/signals', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(signal)
			});
		}
	}

	/**
	 * Store multiple signals efficiently
	 */
	async storeSignalsBatch(signals: SignalMarker[]): Promise<void> {
		await this.initialize();

		if (browser && this.clientDb) {
			// Client-side batch storage
			await this.clientDb.storeSignalsBatch(signals);
		} else {
			// Server-side batch storage via API
			await fetch('/api/signals/batch', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ signals })
			});
		}
	}

	/**
	 * Query signals with various filters
	 */
	async querySignals(query: DataQuery): Promise<SignalMarker[]> {
		await this.initialize();

		if (browser && this.clientDb && query.lat && query.lon && query.radiusMeters) {
			// Use client-side spatial query
			const spatialQuery: SpatialQuery = {
				lat: query.lat,
				lon: query.lon,
				radiusMeters: query.radiusMeters,
				startTime: query.startTime,
				endTime: query.endTime,
				limit: query.limit
			};

			const signals = await this.clientDb.findSignalsInRadius(spatialQuery);

			// Apply additional filters
			return this.applyFilters(signals, query);
		} else {
			// Server-side query via API
			const params = new URLSearchParams();
			Object.entries(query).forEach(([key, value]) => {
				if (value !== undefined) {
					params.append(key, String(value));
				}
			});

			const response = await fetch(`/api/signals?${params}`);
			const data = (await response.json()) as { signals?: SignalMarker[] };
			return data.signals || [];
		}
	}

	/**
	 * Get devices in an area
	 */
	async getDevicesInArea(bounds: {
		minLat: number;
		maxLat: number;
		minLon: number;
		maxLon: number;
	}): Promise<DeviceInfo[]> {
		await this.initialize();

		if (browser && this.clientDb) {
			// Client-side query
			const devices = await this.clientDb.getDevicesInArea(bounds);
			return devices.map((d) => ({
				id: d.id,
				type: d.type,
				manufacturer: undefined,
				firstSeen: d.firstSeen,
				lastSeen: d.lastSeen,
				avgPower: d.avgPower,
				signalCount: d.signalCount,
				lastPosition: { lat: d.lastLat, lon: d.lastLon },
				frequencyRange: { min: d.freqMin, max: d.freqMax }
			}));
		} else {
			// Server-side query
			const response = await fetch('/api/devices/area', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ bounds })
			});
			return (await response.json()) as DeviceInfo[];
		}
	}

	/**
	 * Store network relationships
	 */
	async storeNetworkRelationships(edges: NetworkEdge[]): Promise<void> {
		await this.initialize();

		if (browser && this.clientDb) {
			await this.clientDb.storeRelationships(edges);
		} else {
			await fetch('/api/relationships', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ edges })
			});
		}
	}

	/**
	 * Get signal statistics for a time window
	 */
	async getStatistics(timeWindow: number = 3600000): Promise<SignalStatistics> {
		await this.initialize();

		if (browser && this.clientDb) {
			const stats = (await this.clientDb.getStatistics(timeWindow)) as {
				totalSignals: number;
				activeDevices: number;
				timeWindow: number;
			};
			return {
				totalSignals: stats.totalSignals,
				uniqueDevices: stats.activeDevices,
				avgPower: 0, // TODO: Calculate from signals
				minPower: 0,
				maxPower: 0,
				freqBands: new Map(),
				timeRange: {
					start: Date.now() - timeWindow,
					end: Date.now()
				}
			};
		} else {
			const response = await fetch(`/api/signals/statistics?timeWindow=${timeWindow}`);
			return (await response.json()) as SignalStatistics;
		}
	}

	/**
	 * Find signals near a path (for tracking movement)
	 */
	async findSignalsAlongPath(
		points: Array<{ lat: number; lon: number }>,
		radiusMeters: number = 50
	): Promise<SignalMarker[]> {
		const allSignals: SignalMarker[] = [];
		const signalIds = new Set<string>();

		// Query signals near each point
		for (const point of points) {
			const signals = await this.querySignals({
				lat: point.lat,
				lon: point.lon,
				radiusMeters
			});

			// Add unique signals
			signals.forEach((signal) => {
				if (!signalIds.has(signal.id)) {
					signalIds.add(signal.id);
					allSignals.push(signal);
				}
			});
		}

		// Sort by timestamp
		return allSignals.sort((a, b) => a.timestamp - b.timestamp);
	}

	/**
	 * Get signal density heatmap data
	 */
	async getSignalDensity(
		bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
		gridSize: number = 100
	): Promise<Array<{ lat: number; lon: number; density: number }>> {
		const signals = await this.querySignals({
			lat: (bounds.minLat + bounds.maxLat) / 2,
			lon: (bounds.minLon + bounds.maxLon) / 2,
			radiusMeters: this.calculateBoundsRadius(bounds)
		});

		// Create density grid
		const grid = new Map<string, number>();
		const latStep = (bounds.maxLat - bounds.minLat) / gridSize;
		const lonStep = (bounds.maxLon - bounds.minLon) / gridSize;

		signals.forEach((signal) => {
			const gridLat = Math.floor((signal.lat - bounds.minLat) / latStep);
			const gridLon = Math.floor((signal.lon - bounds.minLon) / lonStep);
			const key = `${gridLat},${gridLon}`;
			grid.set(key, (grid.get(key) || 0) + 1);
		});

		// Convert to array
		const densityData: Array<{ lat: number; lon: number; density: number }> = [];
		grid.forEach((count, key) => {
			const [gridLat, gridLon] = key.split(',').map(Number);
			densityData.push({
				lat: bounds.minLat + (gridLat + 0.5) * latStep,
				lon: bounds.minLon + (gridLon + 0.5) * lonStep,
				density: count
			});
		});

		return densityData;
	}

	/**
	 * Clean up old data
	 */
	async cleanupOldData(maxAge: number = 3600000): Promise<number> {
		await this.initialize();

		if (browser && this.clientDb) {
			return await this.clientDb.cleanupOldData(maxAge);
		} else {
			const response = await fetch('/api/signals/cleanup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ maxAge })
			});
			const result = (await response.json()) as { deleted?: number };
			return result.deleted || 0;
		}
	}

	/**
	 * Helper methods
	 */
	private applyFilters(signals: SignalMarker[], query: DataQuery): SignalMarker[] {
		let filtered = signals;

		// Filter by device IDs
		if (query.deviceIds && query.deviceIds.length > 0) {
			const deviceSet = new Set(query.deviceIds);
			filtered = filtered.filter(
				(s) =>
					s.metadata &&
					'deviceId' in s.metadata &&
					deviceSet.has(s.metadata.deviceId as string)
			);
		}

		// Filter by signal types
		if (query.signalTypes && query.signalTypes.length > 0) {
			const typeSet = new Set(query.signalTypes);
			filtered = filtered.filter((s) => s.metadata?.type && typeSet.has(s.metadata.type));
		}

		return filtered;
	}

	private calculateBoundsRadius(bounds: {
		minLat: number;
		maxLat: number;
		minLon: number;
		maxLon: number;
	}): number {
		const centerLat = (bounds.minLat + bounds.maxLat) / 2;
		const centerLon = (bounds.minLon + bounds.maxLon) / 2;

		// Calculate corner distances
		const distances = [
			this.calculateDistance(centerLat, centerLon, bounds.minLat, bounds.minLon),
			this.calculateDistance(centerLat, centerLon, bounds.minLat, bounds.maxLon),
			this.calculateDistance(centerLat, centerLon, bounds.maxLat, bounds.minLon),
			this.calculateDistance(centerLat, centerLon, bounds.maxLat, bounds.maxLon)
		];

		return Math.max(...distances);
	}

	private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
		const R = 6371e3;
		const φ1 = (lat1 * Math.PI) / 180;
		const φ2 = (lat2 * Math.PI) / 180;
		const Δφ = ((lat2 - lat1) * Math.PI) / 180;
		const Δλ = ((lon2 - lon1) * Math.PI) / 180;

		const a =
			Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
			Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

		return R * c;
	}
}

// Singleton instance
let dataLayer: DataAccessLayer | null = null;

export function getDataAccessLayer(): DataAccessLayer {
	if (!dataLayer) {
		dataLayer = new DataAccessLayer();
	}
	return dataLayer;
}

// Export for direct use
export const DAL = getDataAccessLayer();
