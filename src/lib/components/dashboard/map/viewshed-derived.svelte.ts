/** Viewshed derived reactive state — watches GPS + store params, fetches viewshed API. */
import { fromStore } from 'svelte/store';

import { rfRangeStore } from '$lib/stores/dashboard/rf-range-store';
import { viewshedComputing, viewshedStore } from '$lib/stores/dashboard/viewshed-store';
import { type GPSState, gpsStore } from '$lib/stores/tactical-map/gps-store';
import { hackrfStore } from '$lib/stores/tactical-map/hackrf-store';
import { getPresetById } from '$lib/types/rf-range';
import type { ViewshedBounds, ViewshedResult } from '$lib/types/viewshed';
import { haversineMeters } from '$lib/utils/geo';
import { logger } from '$lib/utils/logger';
import { calculateFriisRange, GPS_STALE_TIMEOUT_MS } from '$lib/utils/rf-propagation';

const POSITION_DELTA_M = 50;
const DEBOUNCE_MS = 500;

function hasValidGPSFix(gps: GPSState): boolean {
	return gps.status.hasGPSFix && !(gps.position.lat === 0 && gps.position.lon === 0);
}

export interface ViewshedDerivedState {
	readonly viewshedImageUrl: string | null;
	readonly viewshedBounds: ViewshedBounds | null;
	readonly viewshedActive: boolean;
	readonly viewshedInactiveReason: string | null;
	readonly isComputing: boolean;
	readonly isRfCapped: boolean;
	readonly effectiveRadiusM: number;
}

/** Create all viewshed-derived reactive state. Call once from createMapState(). */
export function createViewshedDerivedState(): ViewshedDerivedState {
	const gps$ = fromStore(gpsStore);
	const vs$ = fromStore(viewshedStore);
	const rf$ = fromStore(rfRangeStore);
	const hrf$ = fromStore(hackrfStore);

	let viewshedImageUrl: string | null = $state(null);
	let viewshedBounds: ViewshedBounds | null = $state(null);
	let viewshedActive = $state(false);
	let viewshedInactiveReason: string | null = $state('Overlay disabled');
	let isComputing = $state(false);

	// ── RF range cap derivation ──────────────────────────────────────
	const activeProfile = $derived(
		rf$.current.activePresetId === 'custom'
			? rf$.current.customProfile
			: (getPresetById(rf$.current.activePresetId) ?? rf$.current.customProfile)
	);

	const activeFrequencyHz = $derived(
		(rf$.current.frequencySource === 'auto'
			? hrf$.current.targetFrequency
			: rf$.current.manualFrequencyMHz) * 1e6
	);

	const rfRangeM = $derived(
		calculateFriisRange(
			activeFrequencyHz,
			activeProfile.txPowerDbm,
			activeProfile.antennaGainDbi,
			activeProfile.rxAntennaGainDbi,
			activeProfile.sensitivityDbm
		)
	);

	const effectiveRadiusM = $derived(Math.min(vs$.current.radiusM, rfRangeM));
	const isRfCapped = $derived(vs$.current.radiusM > rfRangeM);

	// Memoization: track last fetch inputs to skip redundant calls
	let prevLat = Infinity;
	let prevLon = Infinity;
	let prevHeightAgl = 0;
	let prevRadiusM = 0;
	let prevGreenOpacity = 0;
	let prevRedOpacity = 0;

	// GPS stale tracking
	let lastGPSFixTime = 0;
	let lastKnownLat = 0;
	let lastKnownLon = 0;
	let gpsStaleTick = $state(0);
	let staleTimeoutId: ReturnType<typeof setTimeout> | null = null;

	// Debounce
	let debounceId: ReturnType<typeof setTimeout> | null = null;

	// In-flight abort
	let abortController: AbortController | null = null;

	function scheduleStaleExpiry(remainingMs: number): void {
		if (staleTimeoutId !== null) return;
		staleTimeoutId = setTimeout(() => {
			staleTimeoutId = null;
			gpsStaleTick++;
		}, remainingMs);
	}

	function clearStaleTimer(): void {
		if (staleTimeoutId !== null) {
			clearTimeout(staleTimeoutId);
			staleTimeoutId = null;
		}
	}

	function clearOverlay(): void {
		viewshedImageUrl = null;
		viewshedBounds = null;
		viewshedActive = false;
	}

	/** Track whether GPS was ever acquired (for stale vs never-had-fix messaging) */
	let hadGPSFix = false;

	function resolvePosition(gps: GPSState): { lat: number; lon: number } | null {
		if (hasValidGPSFix(gps)) {
			lastGPSFixTime = Date.now();
			lastKnownLat = gps.position.lat;
			lastKnownLon = gps.position.lon;
			hadGPSFix = true;
			clearStaleTimer();
			return { lat: gps.position.lat, lon: gps.position.lon };
		}
		// Stale fallback — freeze overlay at last known position for 30s
		if (lastGPSFixTime > 0) {
			const elapsed = Date.now() - lastGPSFixTime;
			if (elapsed < GPS_STALE_TIMEOUT_MS) {
				scheduleStaleExpiry(GPS_STALE_TIMEOUT_MS - elapsed);
				return { lat: lastKnownLat, lon: lastKnownLon };
			}
		}
		clearStaleTimer();
		return null;
	}

	function hasParamsChanged(
		lat: number,
		lon: number,
		heightAgl: number,
		radiusM: number,
		greenOp: number,
		redOp: number
	): boolean {
		const posDelta = haversineMeters(prevLat, prevLon, lat, lon);
		if (posDelta >= POSITION_DELTA_M) return true;
		return (
			heightAgl !== prevHeightAgl ||
			radiusM !== prevRadiusM ||
			greenOp !== prevGreenOpacity ||
			redOp !== prevRedOpacity
		);
	}

	function saveMemoState(
		lat: number,
		lon: number,
		heightAgl: number,
		radiusM: number,
		greenOp: number,
		redOp: number
	): void {
		prevLat = lat;
		prevLon = lon;
		prevHeightAgl = heightAgl;
		prevRadiusM = radiusM;
		prevGreenOpacity = greenOp;
		prevRedOpacity = redOp;
	}

	function handleNoPosition(): void {
		clearOverlay();
		viewshedInactiveReason = hadGPSFix ? 'GPS signal lost' : 'No GPS fix';
	}

	function handleFetchError(err: unknown): void {
		if (err instanceof DOMException && err.name === 'AbortError') return;
		logger.error('Viewshed fetch failed', { err }, 'viewshed-fetch-error');
		viewshedInactiveReason = 'Computation failed';
		clearOverlay();
	}

	async function fetchViewshed(
		lat: number,
		lon: number,
		heightAgl: number,
		radiusM: number,
		greenOpacity: number,
		redOpacity: number
	): Promise<void> {
		abortController?.abort();
		abortController = new AbortController();

		isComputing = true;
		viewshedComputing.set(true);
		try {
			const res = await fetch('/api/viewshed/compute', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lat, lon, heightAgl, radiusM, greenOpacity, redOpacity }),
				signal: abortController.signal
			});
			if (!res.ok) {
				viewshedInactiveReason = `API error: ${res.status}`;
				clearOverlay();
				return;
			}
			const result: ViewshedResult = await res.json();
			applyResult(result);
		} catch (err: unknown) {
			handleFetchError(err);
		} finally {
			isComputing = false;
			viewshedComputing.set(false);
		}
	}

	function applyResult(result: ViewshedResult): void {
		if (result.imageDataUri) {
			viewshedImageUrl = result.imageDataUri;
			viewshedBounds = result.bounds;
			viewshedActive = true;
			viewshedInactiveReason = null;
		} else {
			clearOverlay();
			viewshedInactiveReason =
				(result as ViewshedResult & { reason?: string }).reason ?? 'No DTED coverage';
		}
		logger.info(`Viewshed computed in ${result.meta.computeTimeMs}ms`, {
			cells: result.meta.cellCount,
			tiles: result.meta.tilesUsed
		});
	}

	// ── Main reactive effect ─────────────────────────────────────────

	$effect(() => {
		const gps = gps$.current;
		const vs = vs$.current;
		void gpsStaleTick; // Reactive dependency for stale timeout

		if (!vs.isEnabled) {
			clearOverlay();
			viewshedInactiveReason = 'Overlay disabled';
			return;
		}

		const pos = resolvePosition(gps);
		if (!pos) {
			handleNoPosition();
			return;
		}

		const { heightAglM, greenOpacity, redOpacity } = vs;
		const cappedRadius = effectiveRadiusM;
		if (
			!hasParamsChanged(pos.lat, pos.lon, heightAglM, cappedRadius, greenOpacity, redOpacity)
		) {
			return;
		}

		// Debounce to avoid rapid API calls during slider changes.
		// Memo is saved inside the callback so rapid changes aren't dropped.
		if (debounceId !== null) clearTimeout(debounceId);
		debounceId = setTimeout(() => {
			debounceId = null;
			saveMemoState(pos.lat, pos.lon, heightAglM, cappedRadius, greenOpacity, redOpacity);
			fetchViewshed(pos.lat, pos.lon, heightAglM, cappedRadius, greenOpacity, redOpacity);
		}, DEBOUNCE_MS);

		return () => {
			if (debounceId !== null) clearTimeout(debounceId);
			abortController?.abort();
		};
	});

	return {
		get viewshedImageUrl() {
			return viewshedImageUrl;
		},
		get viewshedBounds() {
			return viewshedBounds;
		},
		get viewshedActive() {
			return viewshedActive;
		},
		get viewshedInactiveReason() {
			return viewshedInactiveReason;
		},
		get isComputing() {
			return isComputing;
		},
		get isRfCapped() {
			return isRfCapped;
		},
		get effectiveRadiusM() {
			return effectiveRadiusM;
		}
	};
}
