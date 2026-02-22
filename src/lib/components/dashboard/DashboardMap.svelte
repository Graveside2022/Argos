<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import 'maplibre-gl/dist/maplibre-gl.css';

	import type { FeatureCollection } from 'geojson';
	import type { LngLatLike } from 'maplibre-gl';
	import maplibregl from 'maplibre-gl';
	import { setContext } from 'svelte';
	import {
		CircleLayer,
		CustomControl,
		FillLayer,
		GeoJSONSource,
		LineLayer,
		MapLibre,
		Marker,
		NavigationControl,
		Popup,
		SymbolLayer as MapLibreSymbolLayer
	} from 'svelte-maplibre-gl';

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

	import DeviceOverlay from './map/DeviceOverlay.svelte';
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
	import { buildConeSVG } from './map/map-helpers';
	import { setupMap } from './map/map-setup';
	import TowerPopup from './map/TowerPopup.svelte';

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

	let accuracyColor = $derived.by(() => {
		const _p = themeStore.palette;
		const _r = cssReady;
		return resolveMapColor(MAP_UI_COLORS.primary);
	});

	let RANGE_BANDS = $derived.by(() => {
		const _p = themeStore.palette;
		return buildRangeBands();
	});

	let gpsLngLat: LngLatLike | null = $derived.by(() => {
		const { lat, lon } = $gpsStore.position;
		if (lat === 0 && lon === 0) return null;
		return [lon, lat] as LngLatLike;
	});

	let headingDeg: number | null = $derived.by(() => {
		const h = $gpsStore.status.heading;
		const spd = $gpsStore.status.speed;
		const hasH = h !== null && h !== undefined && !isNaN(h);
		const moving = spd !== null && spd !== undefined && spd > 0.5;
		return hasH && moving ? h : null;
	});

	let showCone = $derived(headingDeg !== null);

	let accuracyGeoJSON: FeatureCollection = $derived(
		buildAccuracyGeoJSON(
			$gpsStore.position.lat,
			$gpsStore.position.lon,
			$gpsStore.status.accuracy
		)
	);

	let detectionRangeGeoJSON: FeatureCollection = $derived(
		buildDetectionRangeGeoJSON($gpsStore.position.lat, $gpsStore.position.lon, RANGE_BANDS)
	);

	let deviceGeoJSON: FeatureCollection = $derived(
		buildDeviceGeoJSON(
			$kismetStore,
			$isolatedDeviceMAC,
			$activeBands,
			$visibilityMode,
			$promotedDevices
		)
	);

	let visibleDeviceMACs: Set<string> = $derived(
		new Set(deviceGeoJSON.features.map((f) => f.properties?.mac as string).filter(Boolean))
	);

	let connectionLinesGeoJSON: FeatureCollection = $derived(
		buildConnectionLinesGeoJSON(
			$kismetStore,
			$isolatedDeviceMAC,
			$layerVisibility.connectionLines,
			visibleDeviceMACs
		)
	);

	setContext('dashboardMap', {
		getMap: () => map,
		flyTo: (lat: number, lon: number, zoom?: number) => {
			if (map) map.flyTo({ center: [lon, lat], zoom: zoom ?? map.getZoom() });
		}
	});

	// ── Effects ──

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
		const settings = $mapSettings;
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
				$kismetStore.deviceAffiliations,
				$takCotMessages
			);
	});

	$effect(() => {
		const { lat, lon } = $gpsStore.position;
		if (!initialViewSet && $gpsStore.status.hasGPSFix && map && lat !== 0 && lon !== 0) {
			map.flyTo({ center: [lon, lat], zoom: 15 });
			initialViewSet = true;
		}
	});

	$effect(() => {
		const { lat, lon } = $gpsStore.position;
		maybeFetchCellTowers(lat, lon, towerFetchState).then((r) => {
			if (r) cellTowerGeoJSON = r;
		});
	});

	$effect(() => {
		if (map) syncLayerVisibility(map, $layerVisibility, $isolatedDeviceMAC, symbolLayer);
	});

	$effect(() => {
		if (map)
			syncClusterVisibility(map, $isolatedDeviceMAC, $layerVisibility.deviceDots !== false);
	});

	$effect(() => {
		const _p = themeStore.palette;
		if (map) syncThemePaint(map);
	});

	// ── Handlers ──

	function handleMapLoad() {
		if (!map) return;
		const m = map;
		const init = () => {
			const r = setupMap(
				m,
				(ev: maplibregl.MapMouseEvent) => {
					const result = deviceClickHandler(m, ev, $kismetStore.deviceAffiliations);
					if (!result) return;
					_popupLngLat = result.lngLat;
					popupContent = result.content;
					selectDevice(result.content.mac, { ...result.content });
					if (result.content.clientCount > 0) isolateDevice(result.content.mac);
					else if (result.content.parentAP) isolateDevice(result.content.parentAP);
					else isolateDevice(null);
				},
				() => {
					_popupLngLat = null;
					popupContent = null;
					isolateDevice(null);
				},
				$layerVisibility
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
</script>

<div class="map-area">
	<MapLibre
		bind:map
		style={mapStyle}
		center={[0, 0]}
		zoom={3}
		attributionControl={false}
		autoloadGlobalCss={false}
		class="map-container"
		onload={handleMapLoad}
	>
		<GeoJSONSource id="detection-range-src" data={detectionRangeGeoJSON}>
			<FillLayer
				id="detection-range-fill"
				paint={{
					'fill-color': ['get', 'color'],
					'fill-opacity': [
						'match',
						['get', 'band'],
						'vstrong',
						0.14,
						'strong',
						0.11,
						'good',
						0.09,
						'fair',
						0.07,
						'weak',
						0.05,
						0.07
					]
				}}
			/>
		</GeoJSONSource>

		<NavigationControl position="bottom-right" showCompass={false} />
		<!-- @constitutional-exemption Article-IV-4.2 — Map overlay control requires MapLibre-specific positioning -->
		<CustomControl position="bottom-right">
			<div class="control-stack">
				<button
					class="locate-btn"
					onclick={handleLocateClick}
					title="Center on my location"
				>
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="12" cy="12" r="8" /><circle
							cx="12"
							cy="12"
							r="3"
							fill="currentColor"
						/>
						<line x1="12" y1="2" x2="12" y2="4" /><line
							x1="12"
							y1="20"
							x2="12"
							y2="22"
						/>
						<line x1="2" y1="12" x2="4" y2="12" /><line
							x1="20"
							y1="12"
							x2="22"
							y2="12"
						/>
					</svg>
				</button>
			</div>
		</CustomControl>

		<GeoJSONSource id="accuracy-src" data={accuracyGeoJSON}>
			<FillLayer
				id="accuracy-fill"
				paint={{ 'fill-color': accuracyColor, 'fill-opacity': 0.18 }}
			/>
		</GeoJSONSource>

		<GeoJSONSource id="cell-towers-src" data={cellTowerGeoJSON}>
			<CircleLayer
				id="cell-tower-circles"
				source="cell-towers-src"
				paint={{
					'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 14, 8, 18, 12],
					'circle-color': ['get', 'color'],
					'circle-opacity': 0.25,
					'circle-stroke-width': 2.5,
					'circle-stroke-color': ['get', 'color'],
					'circle-stroke-opacity': 0.9
				}}
				onclick={(ev) => {
					if (!map) return;
					const result = towerClickHandler(map, ev);
					if (result) {
						towerPopupLngLat = result.lngLat;
						towerPopupContent = result.content;
					}
				}}
			/>
			<MapLibreSymbolLayer
				id="cell-tower-labels"
				minzoom={12}
				layout={{
					'text-field': ['get', 'radio'],
					'text-font': ['Stadia Regular'],
					'text-size': 9,
					'text-offset': [0, 1.6],
					'text-allow-overlap': false,
					'text-optional': true
				}}
				paint={{
					'text-color': MAP_UI_COLORS.mutedForeground.fallback,
					'text-halo-color': MAP_UI_COLORS.background.fallback,
					'text-halo-width': 1
				}}
			/>
		</GeoJSONSource>

		<GeoJSONSource id="connection-lines-src" data={connectionLinesGeoJSON}>
			<LineLayer
				id="device-connection-lines"
				paint={{ 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': 0.7 }}
			/>
		</GeoJSONSource>

		<GeoJSONSource
			id="devices-src"
			data={deviceGeoJSON}
			cluster={!$isolatedDeviceMAC}
			clusterRadius={50}
			clusterMaxZoom={16}
			clusterMinPoints={3}
		>
			<CircleLayer
				id="device-clusters"
				filter={['has', 'point_count']}
				paint={{
					'circle-color': MAP_UI_COLORS.secondary.fallback,
					'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 26, 100, 32],
					'circle-opacity': 0.85,
					'circle-stroke-width': 2,
					'circle-stroke-color': MAP_UI_COLORS.border.fallback
				}}
				onclick={(ev) => {
					if (map) onClusterClick(map, ev);
				}}
			/>
			<MapLibreSymbolLayer
				id="device-cluster-count"
				filter={['has', 'point_count']}
				layout={{
					'text-field': ['get', 'point_count_abbreviated'],
					'text-font': ['Stadia Regular'],
					'text-size': 12,
					'text-allow-overlap': true
				}}
				paint={{ 'text-color': MAP_UI_COLORS.foreground.fallback }}
			/>
			<CircleLayer
				id="device-circles"
				filter={['!', ['has', 'point_count']]}
				paint={{
					'circle-radius': [
						'interpolate',
						['linear'],
						['zoom'],
						10,
						[
							'interpolate',
							['linear'],
							['get', 'clientCount'],
							0,
							3,
							1,
							4,
							5,
							5,
							15,
							7
						],
						14,
						[
							'interpolate',
							['linear'],
							['get', 'clientCount'],
							0,
							5,
							1,
							7,
							5,
							9,
							15,
							12
						],
						18,
						[
							'interpolate',
							['linear'],
							['get', 'clientCount'],
							0,
							6,
							1,
							9,
							5,
							12,
							15,
							16
						]
					],
					'circle-color': ['get', 'color'],
					'circle-opacity': 0.9,
					'circle-stroke-width': ['case', ['>', ['get', 'clientCount'], 0], 1.5, 0.8],
					'circle-stroke-color': ['get', 'color'],
					'circle-stroke-opacity': ['case', ['>', ['get', 'clientCount'], 0], 0.7, 0.5]
				}}
				onclick={(ev) => {
					if (!map) return;
					const result = deviceClickHandler(map, ev, $kismetStore.deviceAffiliations);
					if (!result) return;
					_popupLngLat = result.lngLat;
					popupContent = result.content;
					selectDevice(result.content.mac, { ...result.content });
					if (result.content.clientCount > 0) isolateDevice(result.content.mac);
					else if (result.content.parentAP) isolateDevice(result.content.parentAP);
					else isolateDevice(null);
				}}
			/>
		</GeoJSONSource>

		{#if towerPopupLngLat && towerPopupContent}
			<Popup
				lnglat={towerPopupLngLat}
				class="palantir-popup"
				closeButton={true}
				onclose={() => {
					towerPopupLngLat = null;
					towerPopupContent = null;
				}}
			>
				<TowerPopup content={towerPopupContent} />
			</Popup>
		{/if}

		{#if gpsLngLat && showCone && headingDeg !== null}
			<Marker lnglat={gpsLngLat} anchor="center">
				{#snippet content()}
					<div class="heading-cone">
						<!-- @constitutional-exemption Article-IX-9.4 issue:#13 — buildConeSVG() returns hardcoded SVG string from numeric heading, no user input -->
						{@html buildConeSVG(headingDeg)}
					</div>
				{/snippet}
			</Marker>
		{/if}

		{#if gpsLngLat}
			<Marker lnglat={gpsLngLat} anchor="center">
				{#snippet content()}<div class="gps-dot"></div>{/snippet}
			</Marker>
		{/if}
	</MapLibre>

	{#if popupContent}
		<DeviceOverlay
			content={popupContent}
			onclose={() => {
				_popupLngLat = null;
				popupContent = null;
			}}
		/>
	{/if}
</div>

<style>
	@import './map/map-overrides.css';

	.map-area {
		flex: 1;
		position: relative;
		overflow: hidden;
	}
	.map-area :global(.map-container) {
		width: 100%;
		height: 100%;
	}
	.gps-dot {
		width: 16px;
		height: 16px;
		background: var(--primary);
		border: 2px solid var(--primary-foreground);
		border-radius: 50%;
		box-shadow: 0 0 6px color-mix(in srgb, var(--primary) 50%, transparent);
	}
	.heading-cone {
		pointer-events: none;
	}
	.locate-btn {
		width: 34px;
		height: 34px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		background: var(--card);
		color: var(--primary);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 0;
		margin: 0;
	}
	.locate-btn:hover {
		background: var(--accent);
		color: color-mix(in srgb, var(--primary) 80%, white);
	}
	.control-stack {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
</style>
