/**
 * RF range derived reactive state for the dashboard map.
 *
 * Computes a GeoJSON FeatureCollection of concentric RF range bands
 * centered on the operator's GPS position, sized by Friis free-space
 * path loss from the active HackRF frequency and TX profile.
 *
 * Memoized: skips rebuild when position delta < 10m, frequency unchanged,
 * and profile unchanged.
 */
import type { FeatureCollection } from 'geojson';
import { fromStore } from 'svelte/store';

import { GEO } from '$lib/constants/limits';
import { rfRangeStore } from '$lib/stores/dashboard/rf-range-store';
import { type GPSState, gpsStore } from '$lib/stores/tactical-map/gps-store';
import { type HackRFState, hackrfStore } from '$lib/stores/tactical-map/hackrf-store';
import type { RFRangeBand, RFRangeProfile, RFRangeStoreState } from '$lib/types/rf-range';
import { getPresetById } from '$lib/types/rf-range';
import {
	buildRFRangeBands,
	calculateFriisRange,
	clampDisplayRange,
	GPS_STALE_TIMEOUT_MS
} from '$lib/utils/rf-propagation';

import { buildDetectionRangeGeoJSON } from './map-geojson';

// ── Constants ────────────────────────────────────────────────────────

const EMPTY_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] };
const POSITION_THRESHOLD_DEG = 0.0001; // ~11m at equator

// ── Helpers ──────────────────────────────────────────────────────────

/** Build a single-point GeoJSON for the overlay label at the northern edge of the outer ring. */
function buildLabelGeoJSON(
	lat: number,
	lon: number,
	rangeM: number,
	isCapped: boolean
): FeatureCollection {
	const labelLat = lat + rangeM / GEO.METERS_PER_DEGREE_LAT;
	const text = isCapped ? 'Free-Space Estimate (capped)' : 'Free-Space Estimate';
	return {
		type: 'FeatureCollection',
		features: [
			{
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [lon, labelLat] },
				properties: { label: text }
			}
		]
	};
}

const FALLBACK_PRESET = getPresetById('hackrf-bare') as RFRangeProfile;

function resolveActiveProfile(state: RFRangeStoreState): RFRangeProfile {
	if (state.activePresetId === 'custom') return state.customProfile;
	return getPresetById(state.activePresetId) ?? FALLBACK_PRESET;
}

function resolveFrequencyHz(rfState: RFRangeStoreState, hackrf: HackRFState): number {
	if (rfState.frequencySource === 'manual') {
		return rfState.manualFrequencyMHz * 1e6;
	}
	// Auto: use hackrfStore.targetFrequency (MHz) → Hz
	return hackrf.targetFrequency * 1e6;
}

function hasValidGPSFix(gps: GPSState): boolean {
	return gps.status.hasGPSFix && !(gps.position.lat === 0 && gps.position.lon === 0);
}

function isOverlayActive(
	rfState: RFRangeStoreState,
	gps: GPSState,
	hackrf: HackRFState
): { active: boolean; reason: string | null } {
	if (!rfState.isEnabled) return { active: false, reason: 'Overlay disabled' };
	if (!hasValidGPSFix(gps)) return { active: false, reason: 'No GPS fix' };
	if (rfState.frequencySource === 'auto' && hackrf.connectionStatus === 'Disconnected') {
		return { active: false, reason: 'SDR disconnected' };
	}
	return { active: true, reason: null };
}

// ── Exported state factory ───────────────────────────────────────────

export interface RFRangeDerivedState {
	readonly rfRangeGeoJSON: FeatureCollection;
	readonly rfRangeLabelGeoJSON: FeatureCollection;
	readonly rfRangeActive: boolean;
	readonly rfRangeInactiveReason: string | null;
	readonly displayRangeMeters: number;
	readonly isCapped: boolean;
	readonly rangeBands: RFRangeBand[];
}

/** Create all RF-range-derived reactive state. Call once from createMapState(). */
export function createRFRangeDerivedState(): RFRangeDerivedState {
	const gps$ = fromStore(gpsStore);
	const hackrf$ = fromStore(hackrfStore);
	const rfRange$ = fromStore(rfRangeStore);

	// Memoization guards
	let prevLat = Infinity;
	let prevLon = Infinity;
	let prevFreqHz = 0;
	let prevPresetId = '';
	let prevTxPower = 0;
	let prevGain = 0;
	let prevRxGain = 0;
	let prevSensitivity = 0;
	let cachedGeoJSON: FeatureCollection = EMPTY_COLLECTION;
	let cachedLabelGeoJSON: FeatureCollection = EMPTY_COLLECTION;
	let cachedBands: RFRangeBand[] = [];
	let cachedDisplayRange = 0;
	let cachedIsCapped = false;

	// GPS stale tracking
	let lastGPSFixTime = 0;
	let lastKnownLat = 0;
	let lastKnownLon = 0;
	let gpsStaleTick = $state(0); // Reactive trigger for stale timeout expiry
	let staleTimeoutId: ReturnType<typeof setTimeout> | null = null;

	function scheduleStaleExpiry(remainingMs: number): void {
		if (staleTimeoutId !== null) return; // Already scheduled
		staleTimeoutId = setTimeout(() => {
			staleTimeoutId = null;
			gpsStaleTick++; // Triggers $derived.by() re-evaluation
		}, remainingMs);
	}

	function clearStaleTimer(): void {
		if (staleTimeoutId !== null) {
			clearTimeout(staleTimeoutId);
			staleTimeoutId = null;
		}
	}

	/** Reset all cached values to empty state. */
	function clearCache(): void {
		cachedGeoJSON = EMPTY_COLLECTION;
		cachedLabelGeoJSON = EMPTY_COLLECTION;
		cachedBands = [];
		cachedDisplayRange = 0;
		cachedIsCapped = false;
	}

	/** Update stale tracking with fresh GPS and return the live position. */
	function recordLivePosition(gps: GPSState): { lat: number; lon: number } {
		lastGPSFixTime = Date.now();
		lastKnownLat = gps.position.lat;
		lastKnownLon = gps.position.lon;
		clearStaleTimer();
		return { lat: gps.position.lat, lon: gps.position.lon };
	}

	/** Return the stale fallback position if within timeout, otherwise null. */
	function getStalePosition(): { lat: number; lon: number } | null {
		const elapsed = Date.now() - lastGPSFixTime;
		if (elapsed >= GPS_STALE_TIMEOUT_MS) return null;
		scheduleStaleExpiry(GPS_STALE_TIMEOUT_MS - elapsed);
		return { lat: lastKnownLat, lon: lastKnownLon };
	}

	/** Resolve operator position from live GPS or stale fallback. Returns null to clear overlay. */
	function resolvePosition(
		active: boolean,
		gps: GPSState,
		rfState: RFRangeStoreState
	): { lat: number; lon: number } | null {
		if (active && gps.status.hasGPSFix) return recordLivePosition(gps);
		if (rfState.isEnabled && lastGPSFixTime > 0) return getStalePosition();
		clearStaleTimer();
		return null;
	}

	/** Check whether position or frequency memoization guards have changed. */
	function hasPositionOrFreqChanged(lat: number, lon: number, freqHz: number): boolean {
		return (
			Math.abs(lat - prevLat) > POSITION_THRESHOLD_DEG ||
			Math.abs(lon - prevLon) > POSITION_THRESHOLD_DEG ||
			freqHz !== prevFreqHz
		);
	}

	/** Check whether RF profile memoization guards have changed. */
	function hasProfileChanged(profile: RFRangeProfile): boolean {
		return (
			profile.id !== prevPresetId ||
			profile.txPowerDbm !== prevTxPower ||
			profile.antennaGainDbi !== prevGain ||
			profile.rxAntennaGainDbi !== prevRxGain ||
			profile.sensitivityDbm !== prevSensitivity
		);
	}

	/** Save current inputs as memoization state. */
	function saveMemoState(
		lat: number,
		lon: number,
		freqHz: number,
		profile: RFRangeProfile
	): void {
		prevLat = lat;
		prevLon = lon;
		prevFreqHz = freqHz;
		prevPresetId = profile.id;
		prevTxPower = profile.txPowerDbm;
		prevGain = profile.antennaGainDbi;
		prevRxGain = profile.rxAntennaGainDbi;
		prevSensitivity = profile.sensitivityDbm;
	}

	const rfRangeGeoJSON: FeatureCollection = $derived.by(() => {
		const gps = gps$.current;
		const hackrf = hackrf$.current;
		const rfState = rfRange$.current;
		void gpsStaleTick; // Reactive dependency for stale timeout expiry

		const { active } = isOverlayActive(rfState, gps, hackrf);
		const pos = resolvePosition(active, gps, rfState);
		if (!pos) {
			clearCache();
			return EMPTY_COLLECTION;
		}

		const profile = resolveActiveProfile(rfState);
		const freqHz = resolveFrequencyHz(rfState, hackrf);
		if (!hasPositionOrFreqChanged(pos.lat, pos.lon, freqHz) && !hasProfileChanged(profile)) {
			return cachedGeoJSON;
		}

		saveMemoState(pos.lat, pos.lon, freqHz, profile);
		if (freqHz <= 0) {
			clearCache();
			return EMPTY_COLLECTION;
		}

		const rawRange = calculateFriisRange(
			freqHz,
			profile.txPowerDbm,
			profile.antennaGainDbi,
			profile.rxAntennaGainDbi,
			profile.sensitivityDbm
		);
		const { displayRange, isCapped } = clampDisplayRange(rawRange);
		const bands = buildRFRangeBands(displayRange);

		cachedDisplayRange = displayRange;
		cachedIsCapped = isCapped;
		cachedBands = bands;
		cachedGeoJSON = buildDetectionRangeGeoJSON(pos.lat, pos.lon, bands);
		cachedLabelGeoJSON = buildLabelGeoJSON(pos.lat, pos.lon, displayRange, isCapped);
		return cachedGeoJSON;
	});

	const rfRangeActive = $derived.by(() => {
		const { active } = isOverlayActive(rfRange$.current, gps$.current, hackrf$.current);
		return active;
	});

	const rfRangeInactiveReason = $derived.by(() => {
		const { reason } = isOverlayActive(rfRange$.current, gps$.current, hackrf$.current);
		return reason;
	});

	return {
		get rfRangeGeoJSON() {
			return rfRangeGeoJSON;
		},
		get rfRangeLabelGeoJSON() {
			return cachedLabelGeoJSON;
		},
		get rfRangeActive() {
			return rfRangeActive;
		},
		get rfRangeInactiveReason() {
			return rfRangeInactiveReason;
		},
		get displayRangeMeters() {
			return cachedDisplayRange;
		},
		get isCapped() {
			return cachedIsCapped;
		},
		get rangeBands() {
			return cachedBands;
		}
	};
}
