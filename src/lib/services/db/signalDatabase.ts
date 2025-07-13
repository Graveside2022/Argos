/**
 * Client-side Signal Database Service
 * Uses IndexedDB for browser-based storage with spatial indexing
 */

import type { SignalMarker } from '$lib/stores/map/signals';
import type { NetworkEdge } from '$lib/services/map/networkAnalyzer';
import type { SignalSource, DeviceRecord as SharedDeviceRecord } from '$lib/types/shared';
import { SignalSource as SignalSourceEnum } from '$lib/types/enums';

export interface SignalRecord {
	id: string;
	deviceId: string;
	timestamp: number;
	lat: number;
	lon: number;
	gridLat: number; // For spatial indexing
	gridLon: number;
	power: number;
	frequency: number;
	source: SignalSource;
	metadata?: Record<string, unknown>;
}

// Use the shared DeviceRecord type for consistency
export type DeviceRecord = SharedDeviceRecord;

export interface RelationshipRecord {
	id: string;
	sourceDeviceId: string;
	targetDeviceId: string;
	type: string;
	strength: number;
	firstSeen: number;
	lastSeen: number;
}

export interface SpatialQuery {
	lat: number;
	lon: number;
	radiusMeters: number;
	startTime?: number;
	endTime?: number;
	limit?: number;
}

class SignalDatabase {
	private db: IDBDatabase | null = null;
	private dbName = 'RFSignalsDB';
	private version = 1;

	async initialize(): Promise<void> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, this.version);

			request.onerror = () =>
				reject(new Error(request.error?.message || 'Database open failed'));
			request.onsuccess = () => {
				this.db = request.result;
				resolve();
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;

				// Signals store
				if (!db.objectStoreNames.contains('signals')) {
					const signalStore = db.createObjectStore('signals', { keyPath: 'id' });
					signalStore.createIndex('timestamp', 'timestamp');
					signalStore.createIndex('deviceId', 'deviceId');
					signalStore.createIndex('spatial', ['gridLat', 'gridLon']);
					signalStore.createIndex('frequency', 'frequency');
					signalStore.createIndex('power', 'power');
				}

				// Devices store
				if (!db.objectStoreNames.contains('devices')) {
					const deviceStore = db.createObjectStore('devices', { keyPath: 'id' });
					deviceStore.createIndex('type', 'type');
					deviceStore.createIndex('lastSeen', 'lastSeen');
					deviceStore.createIndex('spatial', ['lastLat', 'lastLon']);
				}

				// Relationships store
				if (!db.objectStoreNames.contains('relationships')) {
					const relStore = db.createObjectStore('relationships', { keyPath: 'id' });
					relStore.createIndex('source', 'sourceDeviceId');
					relStore.createIndex('target', 'targetDeviceId');
					relStore.createIndex('lastSeen', 'lastSeen');
				}

				// Patterns store
				if (!db.objectStoreNames.contains('patterns')) {
					const patternStore = db.createObjectStore('patterns', { keyPath: 'id' });
					patternStore.createIndex('type', 'type');
					patternStore.createIndex('priority', 'priority');
					patternStore.createIndex('timestamp', 'timestamp');
				}
			};
		});
	}

	/**
	 * Store a signal and update device info
	 */
	async storeSignal(signal: SignalMarker): Promise<void> {
		if (!this.db) throw new Error('Database not initialized');

		const deviceId = this.generateDeviceId(signal);
		const gridScale = 10000; // ~11m resolution

		const signalRecord: SignalRecord = {
			id: signal.id,
			deviceId,
			timestamp: signal.timestamp,
			lat: signal.lat,
			lon: signal.lon,
			gridLat: Math.floor(signal.lat * gridScale),
			gridLon: Math.floor(signal.lon * gridScale),
			power: signal.power,
			frequency: signal.frequency,
			source: signal.source,
			metadata: signal.metadata
		};

		const tx = this.db.transaction(['signals', 'devices'], 'readwrite');

		// Store signal
		const signalPut = tx.objectStore('signals').put(signalRecord);
		await new Promise<void>((resolve, reject) => {
			signalPut.onsuccess = () => resolve();
			signalPut.onerror = () => reject(new Error('Failed to store signal'));
		});

		// Update device
		const deviceStore = tx.objectStore('devices');
		const deviceReq = deviceStore.get(deviceId);

		await new Promise<void>((resolve, reject) => {
			deviceReq.onsuccess = async () => {
				const existing = deviceReq.result as DeviceRecord | undefined;

				if (existing) {
					// Update existing device
					existing.lastSeen = signal.timestamp;
					existing.lastLat = signal.lat;
					existing.lastLon = signal.lon;
					existing.avgPower =
						(existing.avgPower * existing.signalCount + signal.power) /
						(existing.signalCount + 1);
					existing.signalCount++;
					existing.freqMin = Math.min(existing.freqMin, signal.frequency);
					existing.freqMax = Math.max(existing.freqMax, signal.frequency);

					const putReq = deviceStore.put(existing);
					await new Promise<void>((resolve, reject) => {
						putReq.onsuccess = () => resolve();
						putReq.onerror = () => reject(new Error('Failed to update device'));
					});
				} else {
					// Create new device
					const device: DeviceRecord = {
						id: deviceId,
						type: this.detectDeviceType(signal),
						firstSeen: signal.timestamp,
						lastSeen: signal.timestamp,
						avgPower: signal.power,
						freqMin: signal.frequency,
						freqMax: signal.frequency,
						signalCount: 1,
						lastLat: signal.lat,
						lastLon: signal.lon,
						metadata: signal.metadata
					};

					const putReq = deviceStore.put(device);
					await new Promise<void>((resolve, reject) => {
						putReq.onsuccess = () => resolve();
						putReq.onerror = () => reject(new Error('Failed to create device'));
					});
				}
				resolve();
			};

			deviceReq.onerror = () =>
				reject(new Error(deviceReq.error?.message || 'Failed to get device'));
		});

		// Transaction commits automatically when all operations complete
	}

	/**
	 * Batch store signals
	 */
	async storeSignalsBatch(signals: SignalMarker[]): Promise<void> {
		if (!this.db) throw new Error('Database not initialized');

		const tx = this.db.transaction(['signals', 'devices'], 'readwrite');
		const signalStore = tx.objectStore('signals');
		const deviceStore = tx.objectStore('devices');

		const deviceUpdates = new Map<string, DeviceRecord>();

		for (const signal of signals) {
			const deviceId = this.generateDeviceId(signal);
			const gridScale = 10000;

			const signalRecord: SignalRecord = {
				id: signal.id,
				deviceId,
				timestamp: signal.timestamp,
				lat: signal.lat,
				lon: signal.lon,
				gridLat: Math.floor(signal.lat * gridScale),
				gridLon: Math.floor(signal.lon * gridScale),
				power: signal.power,
				frequency: signal.frequency,
				source: signal.source,
				metadata: signal.metadata
			};

			signalStore.put(signalRecord);

			// Aggregate device updates
			if (!deviceUpdates.has(deviceId)) {
				// Create new device entry
				deviceUpdates.set(deviceId, {
					id: deviceId,
					type: this.detectDeviceType(signal),
					firstSeen: signal.timestamp,
					lastSeen: signal.timestamp,
					avgPower: signal.power,
					freqMin: signal.frequency,
					freqMax: signal.frequency,
					signalCount: 0,
					lastLat: signal.lat,
					lastLon: signal.lon,
					metadata: signal.metadata
				});
			}

			const device = deviceUpdates.get(deviceId);
			if (!device) continue;
			device.lastSeen = Math.max(device.lastSeen, signal.timestamp);
			device.avgPower =
				(device.avgPower * device.signalCount + signal.power) / (device.signalCount + 1);
			device.signalCount++;
			device.freqMin = Math.min(device.freqMin, signal.frequency);
			device.freqMax = Math.max(device.freqMax, signal.frequency);
			device.lastLat = signal.lat;
			device.lastLon = signal.lon;
		}

		// Store all device updates
		for (const device of deviceUpdates.values()) {
			deviceStore.put(device);
		}

		// Wait for transaction to complete
		await new Promise<void>((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(new Error('Transaction failed'));
		});
	}

	/**
	 * Find signals within radius using spatial index
	 */
	async findSignalsInRadius(query: SpatialQuery): Promise<SignalMarker[]> {
		if (!this.db) throw new Error('Database not initialized');

		const gridScale = 10000;
		const latRange = query.radiusMeters / 111320;
		const lonRange = query.radiusMeters / (111320 * Math.cos((query.lat * Math.PI) / 180));

		const minGridLat = Math.floor((query.lat - latRange) * gridScale);
		const maxGridLat = Math.ceil((query.lat + latRange) * gridScale);
		const minGridLon = Math.floor((query.lon - lonRange) * gridScale);
		const maxGridLon = Math.ceil((query.lon + lonRange) * gridScale);

		const signals: SignalMarker[] = [];
		const tx = this.db.transaction(['signals'], 'readonly');
		const store = tx.objectStore('signals');
		const index = store.index('spatial');

		// Query each grid cell in the range
		for (let gridLat = minGridLat; gridLat <= maxGridLat; gridLat++) {
			for (let gridLon = minGridLon; gridLon <= maxGridLon; gridLon++) {
				const range = IDBKeyRange.only([gridLat, gridLon]);
				const request = index.openCursor(range);

				await new Promise<void>((resolve) => {
					request.onsuccess = (event) => {
						const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>)
							.result;
						if (cursor) {
							const record = cursor.value as SignalRecord;

							// Check exact distance and time
							const distance = this.calculateDistance(
								record.lat,
								record.lon,
								query.lat,
								query.lon
							);

							if (distance <= query.radiusMeters) {
								if (!query.startTime || record.timestamp >= query.startTime) {
									if (!query.endTime || record.timestamp <= query.endTime) {
										signals.push(this.recordToSignalMarker(record));
									}
								}
							}

							cursor.continue();
						} else {
							resolve();
						}
					};
				});
			}
		}

		// Sort by timestamp and apply limit
		signals.sort((a, b) => b.timestamp - a.timestamp);
		if (query.limit) {
			return signals.slice(0, query.limit);
		}

		return signals;
	}

	/**
	 * Get devices in area
	 */
	async getDevicesInArea(bounds: {
		minLat: number;
		maxLat: number;
		minLon: number;
		maxLon: number;
	}): Promise<DeviceRecord[]> {
		if (!this.db) throw new Error('Database not initialized');

		const devices: DeviceRecord[] = [];
		const tx = this.db.transaction(['devices'], 'readonly');
		const store = tx.objectStore('devices');

		const cursorRequest = store.openCursor();

		return new Promise((resolve) => {
			cursorRequest.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
				if (cursor) {
					const device = cursor.value as DeviceRecord;

					if (
						device.lastLat >= bounds.minLat &&
						device.lastLat <= bounds.maxLat &&
						device.lastLon >= bounds.minLon &&
						device.lastLon <= bounds.maxLon
					) {
						devices.push(device);
					}

					cursor.continue();
				} else {
					resolve(devices);
				}
			};
		});
	}

	/**
	 * Store network relationships
	 */
	async storeRelationships(edges: NetworkEdge[]): Promise<void> {
		if (!this.db) throw new Error('Database not initialized');

		const tx = this.db.transaction(['relationships'], 'readwrite');
		const store = tx.objectStore('relationships');

		for (const edge of edges) {
			const record: RelationshipRecord = {
				id: edge.id,
				sourceDeviceId: edge.source,
				targetDeviceId: edge.target,
				type: edge.type,
				strength: edge.strength,
				firstSeen: edge.metadata.lastSeen,
				lastSeen: edge.metadata.lastSeen
			};

			store.put(record);
		}

		// Wait for transaction to complete
		await new Promise<void>((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(new Error('Transaction failed'));
		});
	}

	/**
	 * Get signal statistics
	 */
	async getStatistics(
		timeWindow: number = 3600000
	): Promise<{ totalSignals: number; activeDevices: number; timeWindow: number }> {
		if (!this.db) throw new Error('Database not initialized');

		const since = Date.now() - timeWindow;
		const tx = this.db.transaction(['signals', 'devices'], 'readonly');

		// Count signals
		const signalStore = tx.objectStore('signals');
		const timeIndex = signalStore.index('timestamp');
		const range = IDBKeyRange.lowerBound(since);
		const signalCountRequest = timeIndex.count(range);
		const signalCount = await new Promise<number>((resolve) => {
			signalCountRequest.onsuccess = () => resolve(signalCountRequest.result);
		});

		// Count active devices
		const deviceStore = tx.objectStore('devices');
		const deviceIndex = deviceStore.index('lastSeen');
		const deviceCountRequest = deviceIndex.count(range);
		const deviceCount = await new Promise<number>((resolve) => {
			deviceCountRequest.onsuccess = () => resolve(deviceCountRequest.result);
		});

		return {
			totalSignals: signalCount,
			activeDevices: deviceCount,
			timeWindow
		};
	}

	/**
	 * Clear old data
	 */
	async cleanupOldData(maxAge: number = 3600000): Promise<number> {
		if (!this.db) throw new Error('Database not initialized');

		const cutoff = Date.now() - maxAge;
		let deleted = 0;

		const tx = this.db.transaction(['signals'], 'readwrite');
		const store = tx.objectStore('signals');
		const index = store.index('timestamp');
		const range = IDBKeyRange.upperBound(cutoff);

		const cursorRequest = index.openCursor(range);

		return new Promise((resolve) => {
			cursorRequest.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
				if (cursor) {
					cursor.delete();
					deleted++;
					cursor.continue();
				} else {
					resolve(deleted);
				}
			};
		});
	}

	/**
	 * Helper methods
	 */
	private generateDeviceId(signal: SignalMarker): string {
		return `${signal.metadata?.type || 'unknown'}_${Math.floor(signal.frequency)}_${Math.floor(signal.power / 10) * 10}`;
	}

	private detectDeviceType(signal: SignalMarker): string {
		const freq = signal.frequency;
		if (freq >= 2400 && freq <= 2484) return 'wifi_2.4';
		if (freq >= 5150 && freq <= 5875) return 'wifi_5';
		if (freq >= 2400 && freq <= 2480 && signal.metadata?.type === 'bluetooth')
			return 'bluetooth';
		return 'unknown';
	}

	private recordToSignalMarker(record: SignalRecord): SignalMarker {
		return {
			id: record.id,
			lat: record.lat,
			lon: record.lon,
			power: record.power,
			frequency: record.frequency,
			timestamp: record.timestamp,
			source: this.normalizeSignalSource(record.source),
			metadata: (record.metadata || {}) as Record<string, unknown>
		};
	}

	private normalizeSignalSource(source: string): SignalSource {
		// Map string values to enum values
		const sourceMap: Record<string, SignalSource> = {
			'hackrf': SignalSourceEnum.HackRF,
			'kismet': SignalSourceEnum.Kismet,
			'manual': SignalSourceEnum.Manual,
			'rtl-sdr': SignalSourceEnum.RtlSdr,
			'other': SignalSourceEnum.Other
		};
		return sourceMap[source.toLowerCase()] || SignalSourceEnum.Other;
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
let dbInstance: SignalDatabase | null = null;

export async function getSignalDatabase(): Promise<SignalDatabase> {
	if (!dbInstance) {
		dbInstance = new SignalDatabase();
		await dbInstance.initialize();
	}
	return dbInstance;
}

export type { SignalDatabase };
