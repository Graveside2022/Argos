/**
 * DTED Level 0 binary file parser.
 *
 * Parses .dt0 files containing terrain elevation data in the MIL-PRF-89020B format.
 * Column-major layout, signed-magnitude encoding, 30 arc-second (~900m) resolution.
 *
 * @module
 */

import { readFileSync } from 'fs';

import type { DTEDTile, DTEDTileHeader } from '$lib/types/viewshed';
import { DTED_VOID_VALUE } from '$lib/types/viewshed';

// ── UHL header field offsets and sizes ───────────────────────────────

const UHL_SENTINEL = 'UHL1';
const UHL_LENGTH = 80;
const DSI_LENGTH = 648;
const ACC_LENGTH = 2700;
const DATA_OFFSET = UHL_LENGTH + DSI_LENGTH + ACC_LENGTH; // 3428

/** Column block header: 1 sentinel + 3 block count + 2 lon count + 2 lat count = 8 bytes */
const COL_HEADER_SIZE = 8;
/** Column block footer: 4-byte checksum */
const COL_FOOTER_SIZE = 4;

// ── UHL field positions (relative to UHL start) ─────────────────────

const UHL_FIELDS = {
	lonOrigin: { offset: 4, length: 8 },
	latOrigin: { offset: 12, length: 8 },
	lonInterval: { offset: 20, length: 4 },
	latInterval: { offset: 24, length: 4 },
	accuracyCode: { offset: 28, length: 4 },
	securityCode: { offset: 32, length: 3 },
	uniqueRef: { offset: 35, length: 12 },
	numLonLines: { offset: 47, length: 4 },
	numLatPoints: { offset: 51, length: 4 }
} as const;

/**
 * Parse a DTED .dt0 file from disk into a DTEDTile.
 * Handles UHL sentinel scanning for files with optional VOL/HDR prefixes.
 */
export function parseDTEDFile(filePath: string): DTEDTile {
	const buf = readFileSync(filePath);
	return parseDTEDBuffer(buf, filePath);
}

/**
 * Parse a DTED buffer into a DTEDTile.
 * Scans for the UHL1 sentinel in case VOL/HDR records precede it.
 */
export function parseDTEDBuffer(buf: Buffer, filePath: string): DTEDTile {
	const uhlOffset = findUHLOffset(buf);
	if (uhlOffset < 0) {
		throw new Error(`No UHL1 sentinel found in ${filePath}`);
	}

	const header = parseUHLHeader(buf, uhlOffset);
	const dataStart = uhlOffset + DATA_OFFSET;
	const elevations = parseElevationGrid(buf, dataStart, header);

	return { header, filePath, elevations };
}

/**
 * Scan the buffer for the "UHL1" sentinel.
 * Most files start at byte 0, but some have VOL/HDR records before UHL.
 */
function findUHLOffset(buf: Buffer): number {
	// Fast path: check byte 0 first (99% of files)
	if (buf.length >= 4 && buf.toString('ascii', 0, 4) === UHL_SENTINEL) {
		return 0;
	}
	// Slow path: scan for UHL1 sentinel
	for (let i = 1; i <= buf.length - UHL_LENGTH; i++) {
		if (buf.toString('ascii', i, i + 4) === UHL_SENTINEL) {
			return i;
		}
	}
	return -1;
}

/** Parse the 80-byte UHL header starting at the given offset */
function parseUHLHeader(buf: Buffer, uhlOffset: number): DTEDTileHeader {
	const field = (name: keyof typeof UHL_FIELDS): string => {
		const f = UHL_FIELDS[name];
		return buf.toString('ascii', uhlOffset + f.offset, uhlOffset + f.offset + f.length).trim();
	};

	return {
		originLon: parseDTEDCoordinate(field('lonOrigin')),
		originLat: parseDTEDCoordinate(field('latOrigin')),
		lonIntervalArcSec: parseInt(field('lonInterval'), 10) / 10,
		latIntervalArcSec: parseInt(field('latInterval'), 10) / 10,
		numLonLines: parseInt(field('numLonLines'), 10),
		numLatPoints: parseInt(field('numLatPoints'), 10)
	};
}

/**
 * Parse a DTED UHL coordinate string to decimal degrees.
 * Both lon and lat are stored as DDDMMSSH (8 chars) in the UHL:
 * - "1170000W" → -117.0
 * - "0340000N" → 34.0
 */
function parseDTEDCoordinate(raw: string): number {
	const hemisphere = raw.slice(-1);
	const numeric = raw.slice(0, -1);

	// Both lon and lat use 3-digit degrees in UHL: DDDMMSS (7 digits + hemisphere)
	const degrees = parseInt(numeric.slice(0, 3), 10);
	const minutes = parseInt(numeric.slice(3, 5), 10);
	const seconds = parseInt(numeric.slice(5, 7), 10);

	let decimal = degrees + minutes / 60 + seconds / 3600;
	if (hemisphere === 'S' || hemisphere === 'W') {
		decimal = -decimal;
	}
	return decimal;
}

/**
 * Parse the elevation grid from column-major data blocks.
 * Each column block: 1-byte sentinel (0xAA) + 3 block count + 2 lon + 2 lat + (numLatPoints * 2) elevations + 4 checksum.
 * Elevations are 16-bit big-endian signed-magnitude encoded.
 */
function parseElevationGrid(buf: Buffer, dataStart: number, header: DTEDTileHeader): Float32Array {
	const { numLonLines, numLatPoints } = header;
	const elevations = new Float32Array(numLonLines * numLatPoints);
	const colDataSize = numLatPoints * 2;
	const colBlockSize = COL_HEADER_SIZE + colDataSize + COL_FOOTER_SIZE;

	for (let col = 0; col < numLonLines; col++) {
		const postsStart = dataStart + col * colBlockSize + COL_HEADER_SIZE;
		parseColumn(buf, postsStart, elevations, col * numLatPoints, numLatPoints);
	}

	return elevations;
}

/** Decode one column of signed-magnitude elevation posts into the output array */
function parseColumn(
	buf: Buffer,
	postsStart: number,
	out: Float32Array,
	baseIdx: number,
	count: number
): void {
	for (let row = 0; row < count; row++) {
		const postOffset = postsStart + row * 2;
		out[baseIdx + row] =
			postOffset + 1 < buf.length
				? decodeSignedMagnitude(buf.readUInt16BE(postOffset))
				: DTED_VOID_VALUE;
	}
}

/** Decode 16-bit signed-magnitude (bit 15 = sign, bits 0-14 = magnitude) */
function decodeSignedMagnitude(raw: number): number {
	return raw & 0x8000 ? -(raw & 0x7fff) : raw;
}

/** Check if grid indices are within tile bounds */
function isInBounds(col: number, row: number, numCols: number, numRows: number): boolean {
	return col >= 0 && col < numCols && row >= 0 && row < numRows;
}

/** Read elevation from the grid, returning null for void values */
function readPost(elevations: Float32Array, index: number): number | null {
	const v = elevations[index];
	return v === DTED_VOID_VALUE ? null : v;
}

/** Check if a tile's geographic extent contains the given point */
function tileContainsPoint(tile: DTEDTile, lat: number, lon: number): boolean {
	const {
		originLon,
		originLat,
		numLonLines,
		numLatPoints,
		lonIntervalArcSec,
		latIntervalArcSec
	} = tile.header;
	const lonSpan = (numLonLines - 1) * (lonIntervalArcSec / 3600);
	const latSpan = (numLatPoints - 1) * (latIntervalArcSec / 3600);
	return (
		lon >= originLon &&
		lon <= originLon + lonSpan &&
		lat >= originLat &&
		lat <= originLat + latSpan
	);
}

/**
 * Get elevation at exact grid coordinates using nearest-neighbor lookup.
 * Returns null for void data or out-of-bounds coordinates.
 */
export function getElevationNearest(tile: DTEDTile, lat: number, lon: number): number | null {
	const { originLon, originLat, numLonLines, numLatPoints } = tile.header;

	const col = Math.round((lon - originLon) * (numLonLines - 1));
	const row = Math.round((lat - originLat) * (numLatPoints - 1));

	if (!isInBounds(col, row, numLonLines, numLatPoints)) return null;
	return readPost(tile.elevations, col * numLatPoints + row);
}

/**
 * Get elevation using bilinear interpolation.
 * Returns null if any corner post is void or out of bounds.
 */
export function getElevation(tile: DTEDTile, lat: number, lon: number): number | null {
	const { originLon, originLat, numLonLines, numLatPoints } = tile.header;

	const colF = (lon - originLon) * (numLonLines - 1);
	const rowF = (lat - originLat) * (numLatPoints - 1);

	const col0 = Math.floor(colF);
	const row0 = Math.floor(rowF);

	if (!isInBounds(col0, row0, numLonLines - 1, numLatPoints - 1)) return null;

	const corners = readBilinearCorners(tile.elevations, col0, row0, numLatPoints);
	if (!corners) return null;

	const dx = colF - col0;
	const dy = rowF - row0;
	return (
		corners[0] * (1 - dx) * (1 - dy) +
		corners[1] * dx * (1 - dy) +
		corners[2] * (1 - dx) * dy +
		corners[3] * dx * dy
	);
}

/** Read four corner posts for bilinear interpolation, returning null if any is void */
function readBilinearCorners(
	elevations: Float32Array,
	col0: number,
	row0: number,
	numLatPoints: number
): [number, number, number, number] | null {
	const e00 = readPost(elevations, col0 * numLatPoints + row0);
	const e10 = readPost(elevations, (col0 + 1) * numLatPoints + row0);
	const e01 = readPost(elevations, col0 * numLatPoints + (row0 + 1));
	const e11 = readPost(elevations, (col0 + 1) * numLatPoints + (row0 + 1));

	if (e00 === null || e10 === null || e01 === null || e11 === null) return null;
	return [e00, e10, e01, e11];
}

/**
 * Get elevation from an array of tiles. Tries each tile until one covers the point.
 * Uses nearest-neighbor for speed during viewshed sweeps.
 */
export function getElevationFromTiles(tiles: DTEDTile[], lat: number, lon: number): number | null {
	for (const tile of tiles) {
		if (tileContainsPoint(tile, lat, lon)) {
			return getElevationNearest(tile, lat, lon);
		}
	}
	return null;
}
