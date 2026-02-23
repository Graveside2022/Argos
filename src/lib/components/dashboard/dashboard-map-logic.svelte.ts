/** Reactive logic for DashboardMap: effects, derived state, and event handlers. */
import type { FeatureCollection } from 'geojson';
import type { LngLatLike } from 'maplibre-gl';
import type maplibregl from 'maplibre-gl';
import { fromStore } from 'svelte/store';

import type { SatelliteLayer } from '$lib/map/layers/satellite-layer';
import type { SymbolLayer } from '$lib/map/layers/symbol-layer';
import { promotedDevices, visibilityMode } from '$lib/map/visibility-engine';
import { selectDevice } from '$lib/stores/dashboard/agent-context-store';
import {
	activeBands,
	isolatedDeviceMAC,
	isolateDevice,
	layerVisibility
} from '$lib/stores/dashboard/dashboard-store';
import { GOOGLE_SATELLITE_STYLE, mapSettings } from '$lib/stores/dashboard/map-settings-store';
import { gpsStore } from '$lib/stores/tactical-map/gps-store';
import { kismetStore } from '$lib/stores/tactical-map/kismet-store';
import { takCotMessages } from '$lib/stores/tak-store';
import { themeStore } from '$lib/stores/theme-store.svelte';

import { MAP_UI_COLORS, resolveMapColor } from './map/map-colors';
import {
	buildAccuracyGeoJSON,
	buildConnectionLinesGeoJSON,
	buildDetectionRangeGeoJSON,
	buildDeviceGeoJSON
} from './map/map-geojson';
import {
	buildRangeBands,
	type CellTowerFetchState,
	handleClusterClick as onClusterClick,
	handleDeviceClick as deviceClickHandler,
	handleTowerClick as towerClickHandler,
	maybeFetchCellTowers,
	type PopupState,
	syncClusterVisibility,
	syncLayerVisibility,
	syncThemePaint,
	type TowerPopupState,
	updateSymbolLayer
} from './map/map-handlers';
import { setupMap } from './map/map-setup';

export type { CellTowerFetchState, PopupState, TowerPopupState };
export { MAP_UI_COLORS, onClusterClick, towerClickHandler };

/** Create all reactive map state and effects. Call once from the component. */
export function createMapState() {
	const gps$ = fromStore(gpsStore);
	const kismet$ = fromStore(kismetStore);
	const takCot$ = fromStore(takCotMessages);
	const isolatedMAC$ = fromStore(isolatedDeviceMAC);
	const bands$ = fromStore(activeBands);
	const visMode$ = fromStore(visibilityMode);
	const promoted$ = fromStore(promotedDevices);
	const layerVis$ = fromStore(layerVisibility);
	const mapS$ = fromStore(mapSettings);

	let map: maplibregl.Map | undefined = $state();
	let symbolLayer: SymbolLayer | undefined = $state();
	let satLayer: SatelliteLayer | undefined = $state();
	let initialViewSet = false;
	let layersInitialized = false;
	let cssReady = $state(false);
	let mapStyle: maplibregl.StyleSpecification | string = $state(GOOGLE_SATELLITE_STYLE);
	let cellTowerGeoJSON: FeatureCollection = $state({ type: 'FeatureCollection', features: [] });
	const towerFetchState: CellTowerFetchState = { lastLat: 0, lastLon: 0 };
	let _popupLngLat: LngLatLike | null = $state(null);
	let popupContent: PopupState | null = $state(null);
	let towerPopupLngLat: LngLatLike | null = $state(null);
	let towerPopupContent: TowerPopupState | null = $state(null);
	// GPS memoization: skip expensive GeoJSON rebuilds when position hasn't changed
	let prevGpsLat = NaN;
	let prevGpsLon = NaN;
	let prevGpsAccuracy = NaN;
	let cachedAccuracyGeoJSON: FeatureCollection = { type: 'FeatureCollection', features: [] };
	let cachedDetectionGeoJSON: FeatureCollection = { type: 'FeatureCollection', features: [] };

	const accuracyColor = $derived.by(() => {
		const _p = themeStore.palette;
		const _r = cssReady;
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
		const hasH = h !== null && h !== undefined && !isNaN(h);
		const moving = spd !== null && spd !== undefined && spd > 0.5;
		return hasH && moving ? h : null;
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
		const latChanged = Math.abs(lat - prevGpsLat) > 0.00001;
		const lonChanged = Math.abs(lon - prevGpsLon) > 0.00001;
		if (!latChanged && !lonChanged) return cachedDetectionGeoJSON;
		cachedDetectionGeoJSON = buildDetectionRangeGeoJSON(lat, lon, RANGE_BANDS);
		return cachedDetectionGeoJSON;
	});
	const deviceGeoJSON: FeatureCollection = $derived(
		buildDeviceGeoJSON(
			kismet$.current,
			isolatedMAC$.current,
			bands$.current,
			visMode$.current,
			promoted$.current
		)
	);
	const visibleDeviceMACs: Set<string> = $derived(
		new Set(deviceGeoJSON.features.map((f) => f.properties?.mac as string).filter(Boolean))
	);
	const connectionLinesGeoJSON: FeatureCollection = $derived(
		buildConnectionLinesGeoJSON(
			kismet$.current,
			isolatedMAC$.current,
			layerVis$.current.connectionLines,
			visibleDeviceMACs
		)
	);

	$effect(() => {
		fetch('/api/map-tiles/styles/alidade_smooth_dark.json', { method: 'HEAD' })
			.then((res) => {
				mapStyle = res.ok
					? '/api/map-tiles/styles/alidade_smooth_dark.json'
					: GOOGLE_SATELLITE_STYLE;
				mapSettings.stadiaAvailable.set(res.ok);
			})
			.catch(() => mapSettings.stadiaAvailable.set(false));
	});
	$effect(() => {
		queueMicrotask(() => {
			cssReady = true;
		});
	});
	$effect(() => {
		if (map && !layersInitialized) {
			handleMapLoad();
			layersInitialized = true;
		}
	});
	$effect(() => {
		if (!satLayer) return;
		const settings = mapS$.current;
		if (settings.type === 'satellite') {
			satLayer.add(settings.url, settings.attribution);
			satLayer.setVisible(true);
		} else satLayer.setVisible(false);
	});
	$effect(() => {
		if (symbolLayer)
			updateSymbolLayer(
				symbolLayer,
				deviceGeoJSON,
				kismet$.current.deviceAffiliations,
				takCot$.current
			);
	});
	$effect(() => {
		const { lat, lon } = gps$.current.position;
		if (!initialViewSet && gps$.current.status.hasGPSFix && map && lat !== 0 && lon !== 0) {
			map.flyTo({ center: [lon, lat], zoom: 15 });
			initialViewSet = true;
		}
	});
	$effect(() => {
		const { lat, lon } = gps$.current.position;
		maybeFetchCellTowers(lat, lon, towerFetchState).then((r) => {
			if (r) cellTowerGeoJSON = r;
		});
	});
	$effect(() => {
		if (map) syncLayerVisibility(map, layerVis$.current, isolatedMAC$.current, symbolLayer);
	});
	$effect(() => {
		if (map)
			syncClusterVisibility(
				map,
				isolatedMAC$.current,
				layerVis$.current.deviceDots !== false
			);
	});
	$effect(() => {
		const _p = themeStore.palette;
		if (map) syncThemePaint(map);
	});

	function applyDeviceClick(m: maplibregl.Map, ev: maplibregl.MapMouseEvent) {
		const result = deviceClickHandler(m, ev, kismet$.current.deviceAffiliations);
		if (!result) return;
		_popupLngLat = result.lngLat;
		popupContent = result.content;
		selectDevice(result.content.mac, { ...result.content });
		if (result.content.clientCount > 0) isolateDevice(result.content.mac);
		else if (result.content.parentAP) isolateDevice(result.content.parentAP);
		else isolateDevice(null);
	}
	function handleMapLoad() {
		if (!map) return;
		const m = map;
		const init = () => {
			const r = setupMap(
				m,
				(ev) => applyDeviceClick(m, ev),
				closeDevicePopup,
				layerVis$.current
			);
			satLayer = r.satLayer;
			symbolLayer = r.symbolLayer;
		};
		if (!map.loaded()) map.once('load', init);
		else init();
	}
	function handleLocateClick() {
		if (map && gpsLngLat) map.flyTo({ center: gpsLngLat as [number, number], zoom: 18 });
	}
	function handleDeviceCircleClick(ev: maplibregl.MapMouseEvent) {
		if (map) applyDeviceClick(map, ev);
	}
	function handleTowerCircleClick(ev: maplibregl.MapMouseEvent) {
		if (!map) return;
		const result = towerClickHandler(map, ev);
		if (result) {
			towerPopupLngLat = result.lngLat;
			towerPopupContent = result.content;
		}
	}
	function closeTowerPopup(): void {
		towerPopupLngLat = null;
		towerPopupContent = null;
	}
	function closeDevicePopup() {
		_popupLngLat = null;
		popupContent = null;
		isolateDevice(null);
	}
	return {
		get map() {
			return map;
		},
		set map(v) {
			map = v;
		},
		get mapStyle() {
			return mapStyle;
		},
		get cellTowerGeoJSON() {
			return cellTowerGeoJSON;
		},
		get popupContent() {
			return popupContent;
		},
		get towerPopupLngLat() {
			return towerPopupLngLat;
		},
		get towerPopupContent() {
			return towerPopupContent;
		},
		get accuracyColor() {
			return accuracyColor;
		},
		get accuracyGeoJSON() {
			return accuracyGeoJSON;
		},
		get detectionRangeGeoJSON() {
			return detectionRangeGeoJSON;
		},
		get deviceGeoJSON() {
			return deviceGeoJSON;
		},
		get connectionLinesGeoJSON() {
			return connectionLinesGeoJSON;
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
		handleMapLoad,
		handleLocateClick,
		handleDeviceCircleClick,
		handleTowerCircleClick,
		closeTowerPopup,
		closeDevicePopup
	};
}
