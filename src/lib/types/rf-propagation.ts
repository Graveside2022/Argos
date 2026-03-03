/**
 * Type definitions for RF propagation analysis using CloudRF cloud API.
 * Pure types + constants — no side effects, no imports.
 */

/** Propagation computation mode */
export type PropagationMode = 'coverage' | 'p2p' | 'route';

/** CloudRF colormap identifiers (verified against live API) */
export type CloudRFColormapName = 'RAINBOW45.dBm' | 'LTE.dBm' | 'HF.dBm';

/** CloudRF propagation model IDs (verified against API docs) */
export type PropagationModelId = 1 | 3 | 6 | 9 | 11;

/** CloudRF clutter/environment profile filenames */
export type ClutterProfile = 'Minimal.clt' | 'Temperate.clt' | 'Jungle.clt';

/** Reliability percentage options (CloudRF rel parameter) */
export type ReliabilityPercent = 50 | 75 | 90 | 95;

/** UI display constants for propagation models */
export const PROPAGATION_MODELS: { id: PropagationModelId; label: string; band: string }[] = [
	{ id: 1, label: 'ITM (Longley-Rice)', band: 'HF–UHF' },
	{ id: 3, label: 'Hata', band: 'VHF/UHF' },
	{ id: 6, label: 'COST-Hata', band: 'UHF/SHF' },
	{ id: 9, label: 'Free Space', band: 'Any' },
	{ id: 11, label: 'Egli', band: 'VHF/UHF' }
];

/** UI display constants for clutter profiles */
export const CLUTTER_PROFILES: { id: ClutterProfile; label: string }[] = [
	{ id: 'Minimal.clt', label: 'Minimal (open/desert)' },
	{ id: 'Temperate.clt', label: 'Temperate (forest)' },
	{ id: 'Jungle.clt', label: 'Jungle (tropical)' }
];

/** UI display constants for reliability options */
export const RELIABILITY_OPTIONS: { value: ReliabilityPercent; label: string }[] = [
	{ value: 50, label: '50%' },
	{ value: 75, label: '75%' },
	{ value: 90, label: '90%' },
	{ value: 95, label: '95% (default)' }
];

/**
 * Auto-select the best propagation model based on frequency.
 * HF (1–30 MHz) → ITM, VHF/UHF (30–1000 MHz) → Egli, SHF (>1 GHz) → COST-Hata
 */
export function autoSelectPropModel(freqMHz: number): PropagationModelId {
	if (freqMHz < 30) return 1; // ITM — best for HF
	if (freqMHz <= 1000) return 11; // Egli — best for VHF/UHF
	return 6; // COST-Hata — best for SHF/microwave
}

// ── Coverage ────────────────────────────────────────────────────────

/** Input parameters for a coverage computation */
export interface CoverageRequest {
	/** Transmitter latitude (decimal degrees) */
	lat: number;
	/** Transmitter longitude (decimal degrees) */
	lon: number;
	/** RF frequency in MHz */
	frequency: number;
	/** Antenna polarization: 0=horizontal, 1=vertical */
	polarization: number;
	/** Transmitter height above ground in meters */
	txHeight: number;
	/** Receiver height above ground in meters */
	rxHeight: number;
	/** Coverage radius in km (0.1–100) */
	radius: number;
	/** Resolution in meters per pixel (5–300) */
	resolution: number;
	/** CloudRF colormap for the output image */
	colormap: CloudRFColormapName;
	/** Transmitter power in watts (CloudRF txw, default 5) */
	txPower?: number;
	/** Receiver sensitivity in dBm (CloudRF rxs, default -90) */
	rxSensitivity?: number;
	/** Clutter/environment profile (CloudRF clt, default 'Minimal.clt') */
	clutterProfile?: ClutterProfile;
	/** Propagation model ID (CloudRF pm, null = auto-select by frequency) */
	propagationModel?: PropagationModelId | null;
	/** Reliability percentage (CloudRF rel, default 95) */
	reliability?: ReliabilityPercent;
	/** Optional site name for CloudRF */
	site?: string;
	/** Optional network name for CloudRF */
	network?: string;
}

/** Result of a coverage computation */
export interface CoverageResult {
	/** PNG image as a base64 data URI */
	imageDataUri: string;
	/** Geographic bounding box for the image overlay */
	bounds: PropagationBounds;
	/** Computation metadata */
	meta: CoverageMeta;
	/** Color legend from CloudRF */
	legend: CoverageLegendEntry[];
}

/** Geographic bounding box for overlay positioning */
export interface PropagationBounds {
	north: number;
	south: number;
	east: number;
	west: number;
}

/** Coverage computation metadata */
export interface CoverageMeta {
	/** Wall-clock computation time in milliseconds */
	elapsed: number;
	/** Coverage area in sq km */
	area: number;
	/** Coverage percentage */
	coverage: number;
	/** CloudRF calculation ID */
	calculationId: number;
}

/** A single legend entry from CloudRF (field `l` is the dBm label) */
export interface CoverageLegendEntry {
	r: number;
	g: number;
	b: number;
	/** Signal level label, e.g. "-20dBm" */
	l: string;
}

// ── Point-to-Point ──────────────────────────────────────────────────

/** Input parameters for a P2P computation */
export interface P2PRequest {
	/** Transmitter latitude */
	txLat: number;
	/** Transmitter longitude */
	txLon: number;
	/** Receiver latitude */
	rxLat: number;
	/** Receiver longitude */
	rxLon: number;
	/** RF frequency in MHz */
	frequency: number;
	/** Antenna polarization: 0=horizontal, 1=vertical */
	polarization: number;
	/** Transmitter height above ground in meters */
	txHeight: number;
	/** Receiver height above ground in meters */
	rxHeight: number;
	/** CloudRF site name (optional, defaults to 'Argos') */
	site?: string;
	/** CloudRF network name (optional, defaults to 'Argos') */
	network?: string;
}

/** Result of a P2P computation */
export interface P2PResult {
	/** Path loss at receiver in dB */
	lossAtRx: number;
	/** Distance between TX and RX in meters */
	distanceM: number;
	/** Bearing from TX to RX in degrees */
	bearingDeg: number;
	/** Loss profile along the path */
	lossProfile: number[];
	/** Elevation profile along the path */
	elevationProfile: number[];
	/** Distances for each step */
	distances: number[];
	/** Error code (0 = success) */
	error: number;
}

// ── Route ───────────────────────────────────────────────────────────

/** Input parameters for a route computation */
export interface RouteRequest {
	/** Transmitter latitude */
	txLat: number;
	/** Transmitter longitude */
	txLon: number;
	/** RF frequency in MHz */
	frequency: number;
	/** Antenna polarization */
	polarization: number;
	/** Transmitter height above ground in meters */
	txHeight: number;
	/** Receiver height above ground in meters */
	rxHeight: number;
	/** Route waypoints as [lat, lon] pairs */
	waypoints: [number, number][];
}

/** Result of a route computation */
export interface RouteResult {
	/** Loss at each waypoint */
	segments: RouteSegment[];
	/** Total route distance in meters */
	totalDistanceM: number;
}

/** One segment of a route result */
export interface RouteSegment {
	/** Waypoint latitude */
	lat: number;
	/** Waypoint longitude */
	lon: number;
	/** Distance from TX in meters */
	distanceFromTx: number;
	/** Path loss at this waypoint in dB */
	loss: number;
	/** Ground elevation at this waypoint in meters */
	elevation: number;
	/** Error code for this segment */
	error: number;
}

// ── Status ──────────────────────────────────────────────────────────

/** CloudRF engine status */
export interface CloudRFStatus {
	/** Whether the CloudRF API is reachable and key is valid */
	available: boolean;
	/** Engine identifier */
	engine: 'cloudrf';
}
