/**
 * Type definitions for terrain-aware viewshed analysis (022-terrain-viewshed).
 * Pure types + constants — no side effects, no imports from Svelte or browser APIs.
 */

/** Parsed metadata from the UHL (User Header Label) section of a DTED .dt0 file */
export interface DTEDTileHeader {
	/** Origin longitude in decimal degrees (southwest corner) */
	originLon: number;
	/** Origin latitude in decimal degrees (southwest corner) */
	originLat: number;
	/** Longitude interval in arc-seconds (e.g., 30 for Level 0 at mid-latitudes) */
	lonIntervalArcSec: number;
	/** Latitude interval in arc-seconds (always 30 for Level 0) */
	latIntervalArcSec: number;
	/** Number of longitude lines (columns). Varies by latitude zone: 121 at 0-50° */
	numLonLines: number;
	/** Number of latitude points per column (rows). Always 121 for Level 0 */
	numLatPoints: number;
}

/** A fully parsed DTED tile with header metadata and elevation grid */
export interface DTEDTile {
	/** Parsed header metadata */
	header: DTEDTileHeader;
	/** Absolute file path on disk */
	filePath: string;
	/** Column-major elevation grid: elevations[col * numLatPoints + row] */
	elevations: Float32Array;
}

/** An entry in the in-memory tile index */
export interface DTEDTileIndexEntry {
	/** Westing directory name, e.g., "w117" */
	westing: string;
	/** Northing filename (without extension), e.g., "n34" */
	northing: string;
	/** Absolute file path to the .dt0 file */
	filePath: string;
	/** Origin longitude in decimal degrees (parsed from directory name) */
	originLon: number;
	/** Origin latitude in decimal degrees (parsed from filename) */
	originLat: number;
}

/** Input parameters for a viewshed computation request */
export interface ViewshedParams {
	/** Observer latitude in decimal degrees */
	lat: number;
	/** Observer longitude in decimal degrees */
	lon: number;
	/** Observer height above ground level in meters */
	heightAgl: number;
	/** Maximum viewshed radius in meters */
	radiusM: number;
	/** Opacity for visible (green) areas: 0.0 to 1.0 */
	greenOpacity: number;
	/** Opacity for obstructed (red) areas: 0.0 to 1.0 */
	redOpacity: number;
}

/** Output of a viewshed computation */
export interface ViewshedResult {
	/** PNG image as a base64 data URI, or null when no elevation data covers the area */
	imageDataUri: string | null;
	/** Geographic bounding box for the image overlay */
	bounds: ViewshedBounds;
	/** Computation metadata */
	meta: ViewshedMeta;
}

/** Geographic bounding box for the viewshed image overlay */
export interface ViewshedBounds {
	north: number;
	south: number;
	east: number;
	west: number;
}

/** Viewshed computation metadata */
export interface ViewshedMeta {
	/** Wall-clock computation time in milliseconds */
	computeTimeMs: number;
	/** Number of grid cells evaluated */
	cellCount: number;
	/** Number of DTED tiles used */
	tilesUsed: number;
	/** Output image width in pixels */
	imageWidth: number;
	/** Output image height in pixels */
	imageHeight: number;
	/** Whether the result was served from cache */
	cached: boolean;
}

/** Client-side persisted store state for viewshed settings */
export interface ViewshedStoreState {
	/** Whether the viewshed overlay is enabled */
	isEnabled: boolean;
	/** Observer height above ground level in meters */
	heightAglM: number;
	/** Viewshed radius in meters */
	radiusM: number;
	/** Visible (green) area opacity: 0.0 to 1.0 */
	greenOpacity: number;
	/** Obstructed (red) area opacity: 0.0 to 1.0 */
	redOpacity: number;
	/** Whether opacity sliders are linked */
	adjustTogether: boolean;
}

/** Sentinel value for void/no-data elevation posts in DTED */
export const DTED_VOID_VALUE = -32767;

/** Viewshed parameter limits */
export const VIEWSHED_LIMITS = {
	HEIGHT_AGL_MIN_M: 0.5,
	HEIGHT_AGL_MAX_M: 100,
	RADIUS_MIN_M: 100,
	RADIUS_MAX_M: 50000,
	OPACITY_MIN: 0,
	OPACITY_MAX: 1
} as const;

/** Default viewshed store state (matches ATAK defaults) */
export const VIEWSHED_DEFAULTS: ViewshedStoreState = {
	isEnabled: false,
	heightAglM: 2.0,
	radiusM: 5000,
	greenOpacity: 0.37,
	redOpacity: 0.92,
	adjustTogether: true
} as const;
