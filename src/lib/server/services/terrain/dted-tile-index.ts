/**
 * DTED tile directory scanner and LRU cache.
 *
 * Scans DTED_DATA_DIR for .dt0 files, builds an in-memory index, and provides
 * tile loading with LRU caching for viewshed computations.
 *
 * @module
 */

import { readdirSync, statSync } from 'node:fs';

import path from 'path';

import type { DTEDTile, DTEDTileIndexEntry, ViewshedBounds } from '$lib/types/viewshed';

import { parseDTEDFile } from './dted-parser';

const DEFAULT_CACHE_CAPACITY = 9;

/** LRU cache entry with access tracking */
interface CacheEntry {
	tile: DTEDTile;
	accessTime: number;
}

/**
 * Manages a directory of DTED .dt0 tiles with indexed lookup and LRU caching.
 * Singleton pattern — initialized once on first API request.
 */
export class DTEDTileIndex {
	private readonly index = new Map<string, DTEDTileIndexEntry>();
	private readonly cache = new Map<string, CacheEntry>();
	private readonly cacheCapacity: number;
	private readonly dataDir: string;

	constructor(dataDir: string, cacheCapacity = DEFAULT_CACHE_CAPACITY) {
		this.dataDir = dataDir;
		this.cacheCapacity = cacheCapacity;
		this.scanDirectory();
	}

	/** Number of indexed tiles on disk */
	get tileCount(): number {
		return this.index.size;
	}

	/** Whether any tiles are indexed */
	get isLoaded(): boolean {
		return this.index.size > 0;
	}

	/** The data directory path */
	get dataDirPath(): string {
		return this.dataDir;
	}

	/** Geographic bounding box covering all indexed tiles */
	get coverageBounds(): ViewshedBounds | null {
		if (this.index.size === 0) return null;

		let north = -Infinity;
		let south = Infinity;
		let east = -Infinity;
		let west = Infinity;

		for (const entry of this.index.values()) {
			south = Math.min(south, entry.originLat);
			north = Math.max(north, entry.originLat + 1); // Each tile spans 1°
			west = Math.min(west, entry.originLon);
			east = Math.max(east, entry.originLon + 1);
		}

		return { north, south, east, west };
	}

	/** Cache statistics for the status endpoint */
	get cacheStats(): { cacheSizeBytes: number; cacheCapacity: number; cacheTiles: number } {
		let totalBytes = 0;
		for (const entry of this.cache.values()) {
			totalBytes += entry.tile.elevations.byteLength;
		}
		return {
			cacheSizeBytes: totalBytes,
			cacheCapacity: this.cacheCapacity,
			cacheTiles: this.cache.size
		};
	}

	/**
	 * Load tiles covering the area around (lat, lon) within radiusM meters.
	 * Returns 1-4 tiles depending on position relative to tile boundaries.
	 */
	getTilesForArea(lat: number, lon: number, radiusM: number): DTEDTile[] {
		const keys = tileKeysForRadius(lat, lon, radiusM);
		const tiles: DTEDTile[] = [];

		for (const key of keys) {
			if (!this.index.has(key)) continue;
			const tile = this.loadTile(key);
			if (tile) tiles.push(tile);
		}

		return tiles;
	}

	/** Check if a specific tile exists in the index */
	hasTile(lat: number, lon: number): boolean {
		return this.index.has(tileKeyFromCoords(Math.floor(lat), Math.floor(lon)));
	}

	/** Scan the data directory and populate the index */
	private scanDirectory(): void {
		if (!isDirectory(this.dataDir)) return;

		for (const westing of readdirSync(this.dataDir)) {
			this.tryIndexWesting(westing);
		}
	}

	/** Attempt to index a single westing subdirectory (skips non-matching entries) */
	private tryIndexWesting(westing: string): void {
		const westingPath = path.join(this.dataDir, westing);
		if (!isDirectory(westingPath)) return;

		const originLon = parseLonFromDirName(westing);
		if (originLon === null) return;

		this.indexTilesInDir(westing, westingPath, originLon);
	}

	/** Index all .dt0 files within a single westing directory */
	private indexTilesInDir(westing: string, westingPath: string, originLon: number): void {
		for (const file of readdirSync(westingPath)) {
			if (!file.endsWith('.dt0')) continue;

			const northing = file.replace('.dt0', '');
			const originLat = parseLatFromFileName(northing);
			if (originLat === null) continue;

			this.index.set(`${westing}/${northing}`, {
				westing,
				northing,
				filePath: path.join(westingPath, file),
				originLon,
				originLat
			});
		}
	}

	/** Load a tile by key, using cache if available */
	private loadTile(key: string): DTEDTile | null {
		// Check cache
		const cached = this.cache.get(key);
		if (cached) {
			cached.accessTime = Date.now();
			return cached.tile;
		}

		// Load from disk
		const entry = this.index.get(key);
		if (!entry) return null;

		try {
			const tile = parseDTEDFile(entry.filePath);
			this.addToCache(key, tile);
			return tile;
		} catch {
			return null;
		}
	}

	/** Add a tile to the LRU cache, evicting oldest if at capacity */
	private addToCache(key: string, tile: DTEDTile): void {
		if (this.cache.size >= this.cacheCapacity) {
			this.evictOldest();
		}
		this.cache.set(key, { tile, accessTime: Date.now() });
	}

	/** Evict the least recently used cache entry */
	private evictOldest(): void {
		let oldestKey: string | null = null;
		let oldestTime = Infinity;

		for (const [key, entry] of this.cache.entries()) {
			if (entry.accessTime < oldestTime) {
				oldestTime = entry.accessTime;
				oldestKey = key;
			}
		}

		if (oldestKey) {
			this.cache.delete(oldestKey);
		}
	}
}

// ── Free-standing helpers (keep class body small) ────────────────────

/** Safely check if a path is an existing directory */
function isDirectory(dirPath: string): boolean {
	try {
		return statSync(dirPath).isDirectory();
	} catch {
		return false;
	}
}

/** Parse longitude from DTED westing directory name: "w117" → -117, "e005" → 5 */
function parseLonFromDirName(name: string): number | null {
	const m = name.match(/^([ew])(\d+)$/i);
	if (!m) return null;
	return m[1].toLowerCase() === 'w' ? -parseInt(m[2], 10) : parseInt(m[2], 10);
}

/** Parse latitude from DTED northing file name: "n34" → 34, "s12" → -12 */
function parseLatFromFileName(name: string): number | null {
	const m = name.match(/^([ns])(\d+)$/i);
	if (!m) return null;
	return m[1].toLowerCase() === 's' ? -parseInt(m[2], 10) : parseInt(m[2], 10);
}

/**
 * Convert lat/lon to tile index key.
 * DTED tiles are named by their SW corner: w117/n34 covers [34°,35°]×[-117°,-116°]
 */
function tileKeyFromCoords(floorLat: number, floorLon: number): string {
	const ew = floorLon < 0 ? 'w' : 'e';
	const ns = floorLat < 0 ? 's' : 'n';
	const lonAbs = String(Math.abs(floorLon)).padStart(3, '0');
	const latAbs = String(Math.abs(floorLat)).padStart(2, '0');
	return `${ew}${lonAbs}/${ns}${latAbs}`;
}

/** Meters per degree of latitude */
const METERS_PER_DEG_LAT = 111320;

/**
 * Compute the set of unique tile keys covering a radius around (lat, lon).
 * Returns 1-4 keys depending on proximity to tile boundaries.
 */
function tileKeysForRadius(lat: number, lon: number, radiusM: number): string[] {
	const metersPerDegLon = METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
	const dLat = radiusM / METERS_PER_DEG_LAT;
	const dLon = radiusM / metersPerDegLon;

	const latMin = Math.floor(lat - dLat);
	const latMax = Math.floor(lat + dLat);
	const lonMin = Math.floor(lon - dLon);
	const lonMax = Math.floor(lon + dLon);

	const keys = new Set<string>();
	for (let la = latMin; la <= latMax; la++) {
		for (let lo = lonMin; lo <= lonMax; lo++) {
			keys.add(tileKeyFromCoords(la, lo));
		}
	}
	return [...keys];
}
