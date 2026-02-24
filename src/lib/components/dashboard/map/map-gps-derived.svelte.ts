/**
 * GPS-derived reactive state for the dashboard map.
 * Memoized GeoJSON builders that skip expensive rebuilds when positions haven't changed.
 */
import type { FeatureCollection } from 'geojson';
import type { LngLatLike } from 'maplibre-gl';
import { fromStore } from 'svelte/store';

import { gpsStore } from '$lib/stores/tactical-map/gps-store';
import { themeStore } from '$lib/stores/theme-store.svelte';

import { MAP_UI_COLORS, resolveMapColor } from './map-colors';
import { buildAccuracyGeoJSON, buildDetectionRangeGeoJSON } from './map-geojson';
import { buildRangeBands } from './map-handlers';

/** Whether a heading value is a valid finite number */
export function isValidHeading(h: number | null | undefined): h is number {
	return h !== null && h !== undefined && !isNaN(h);
}

/** Whether the speed indicates the device is moving */
export function isMoving(spd: number | null | undefined): boolean {
	return spd !== null && spd !== undefined && spd > 0.5;
}

/** Whether a GPS position represents a real fix (non-zero coords with fix flag) */
export function hasRealGPSFix(lat: number, lon: number, hasFix: boolean): boolean {
	return hasFix && lat !== 0 && lon !== 0;
}

/** Create all GPS-derived reactive state. Call once from the main map state factory. */
export function createGpsDerivedState(cssReady: { current: boolean }) {
	const gps$ = fromStore(gpsStore);

	// GPS memoization: skip expensive GeoJSON rebuilds when position hasn't changed
	// Infinity ensures first real GPS fix always triggers a build
	let prevGpsLat = Infinity;
	let prevGpsLon = Infinity;
	let prevGpsAccuracy = Infinity;
	let cachedAccuracyGeoJSON: FeatureCollection = { type: 'FeatureCollection', features: [] };
	let prevDetLat = Infinity;
	let prevDetLon = Infinity;
	let cachedDetectionGeoJSON: FeatureCollection = { type: 'FeatureCollection', features: [] };

	const accuracyColor = $derived.by(() => {
		const _p = themeStore.palette;
		const _r = cssReady.current;
		return resolveMapColor(MAP_UI_COLORS.primary);
	});

	const RANGE_BANDS = $derived.by(() => {
		const _p = themeStore.palette;
		return buildRangeBands();
	});

	const gpsLngLat: LngLatLike | null = $derived.by(() => {
		const { lat, lon } = gps$.current.position;
		if (lat === 0 && lon === 0) return null;
		return [lon, lat] as LngLatLike;
	});

	const headingDeg: number | null = $derived.by(() => {
		const h = gps$.current.status.heading;
		const spd = gps$.current.status.speed;
		return isValidHeading(h) && isMoving(spd) ? h : null;
	});

	const showCone = $derived(headingDeg !== null);

	const accuracyGeoJSON: FeatureCollection = $derived.by(() => {
		const lat = gps$.current.position.lat;
		const lon = gps$.current.position.lon;
		const acc = gps$.current.status.accuracy ?? 0;
		const latChanged = Math.abs(lat - prevGpsLat) > 0.00001;
		const lonChanged = Math.abs(lon - prevGpsLon) > 0.00001;
		const accChanged = Math.abs(acc - prevGpsAccuracy) > 0.1;
		if (!latChanged && !lonChanged && !accChanged) return cachedAccuracyGeoJSON;
		prevGpsLat = lat;
		prevGpsLon = lon;
		prevGpsAccuracy = acc;
		cachedAccuracyGeoJSON = buildAccuracyGeoJSON(lat, lon, acc);
		return cachedAccuracyGeoJSON;
	});

	const detectionRangeGeoJSON: FeatureCollection = $derived.by(() => {
		const lat = gps$.current.position.lat;
		const lon = gps$.current.position.lon;
		const latChanged = Math.abs(lat - prevDetLat) > 0.00001;
		const lonChanged = Math.abs(lon - prevDetLon) > 0.00001;
		if (!latChanged && !lonChanged) return cachedDetectionGeoJSON;
		prevDetLat = lat;
		prevDetLon = lon;
		cachedDetectionGeoJSON = buildDetectionRangeGeoJSON(lat, lon, RANGE_BANDS);
		return cachedDetectionGeoJSON;
	});

	return {
		gps$,
		get accuracyColor() {
			return accuracyColor;
		},
		get gpsLngLat() {
			return gpsLngLat;
		},
		get headingDeg() {
			return headingDeg;
		},
		get showCone() {
			return showCone;
		},
		get accuracyGeoJSON() {
			return accuracyGeoJSON;
		},
		get detectionRangeGeoJSON() {
			return detectionRangeGeoJSON;
		}
	};
}
