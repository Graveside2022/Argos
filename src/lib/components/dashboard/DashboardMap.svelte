<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import 'maplibre-gl/dist/maplibre-gl.css';

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

	import { isolatedDeviceMAC } from '$lib/stores/dashboard/dashboard-store';
	import { gpsStore } from '$lib/stores/tactical-map/gps-store';

	import { createMapState, MAP_UI_COLORS, onClusterClick } from './dashboard-map-logic.svelte';
	import DeviceOverlay from './map/DeviceOverlay.svelte';
	import { buildConeSVG } from './map/map-helpers';
	import TowerPopup from './map/TowerPopup.svelte';

	const ms = createMapState();

	setContext('dashboardMap', {
		getMap: () => ms.map,
		flyTo: (lat: number, lon: number, zoom?: number) => {
			if (ms.map) ms.map.flyTo({ center: [lon, lat], zoom: zoom ?? ms.map.getZoom() });
		}
	});
</script>

<div class="map-area">
	<MapLibre
		bind:map={ms.map}
		style={ms.mapStyle}
		center={[0, 0]}
		zoom={3}
		attributionControl={false}
		autoloadGlobalCss={false}
		class="map-container"
		onload={ms.handleMapLoad}
	>
		<GeoJSONSource id="detection-range-src" data={ms.detectionRangeGeoJSON}>
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
					onclick={ms.handleLocateClick}
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

		<GeoJSONSource id="accuracy-src" data={ms.accuracyGeoJSON}>
			<FillLayer
				id="accuracy-fill"
				paint={{ 'fill-color': ms.accuracyColor, 'fill-opacity': 0.18 }}
			/>
		</GeoJSONSource>

		<GeoJSONSource id="cell-towers-src" data={ms.cellTowerGeoJSON}>
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
				onclick={ms.handleTowerCircleClick}
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

		<GeoJSONSource id="connection-lines-src" data={ms.connectionLinesGeoJSON}>
			<LineLayer
				id="device-connection-lines"
				paint={{ 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': 0.7 }}
			/>
		</GeoJSONSource>

		<GeoJSONSource
			id="devices-src"
			data={ms.deviceGeoJSON}
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
					if (ms.map) onClusterClick(ms.map, ev);
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
				onclick={ms.handleDeviceCircleClick}
			/>
		</GeoJSONSource>

		{#if ms.towerPopupLngLat && ms.towerPopupContent}
			<Popup
				lnglat={ms.towerPopupLngLat}
				class="palantir-popup"
				closeButton={true}
				onclose={ms.closeTowerPopup}
			>
				<TowerPopup content={ms.towerPopupContent} />
			</Popup>
		{/if}

		{#if ms.gpsLngLat && ms.showCone && ms.headingDeg !== null}
			<Marker lnglat={ms.gpsLngLat} anchor="center">
				{#snippet content()}
					<div class="heading-cone">
						<!-- @constitutional-exemption Article-IX-9.4 issue:#13 — buildConeSVG() returns hardcoded SVG string from numeric heading, no user input -->
						{@html buildConeSVG(ms.headingDeg ?? 0)}
					</div>
				{/snippet}
			</Marker>
		{/if}

		{#if ms.gpsLngLat}
			<Marker lnglat={ms.gpsLngLat} anchor="center">
				{#snippet content()}<div class="gps-dot"></div>{/snippet}
			</Marker>
		{/if}
	</MapLibre>

	{#if ms.popupContent}
		<DeviceOverlay content={ms.popupContent} onclose={ms.closeDevicePopup} />
	{/if}

	{#if $gpsStore.status.hasGPSFix}
		<div class="gps-legend">
			<div class="legend-row">
				<span class="legend-label">GPS</span>
				<span class="legend-value legend-fix"
					>{$gpsStore.status.fixType} · {$gpsStore.status.satellites} sat</span
				>
			</div>
			<div class="legend-divider"></div>
			<div class="legend-row">
				<span class="legend-label">Location</span>
				<span class="legend-value">{$gpsStore.status.currentCountry.name}</span>
			</div>
			<div class="legend-row">
				<span class="legend-label">Lat/Lon</span>
				<span class="legend-value"
					>{$gpsStore.status.formattedCoords.lat}
					{$gpsStore.status.formattedCoords.lon}</span
				>
			</div>
			<div class="legend-row">
				<span class="legend-label">MGRS</span>
				<span class="legend-value">{$gpsStore.status.mgrsCoord}</span>
			</div>
		</div>
	{/if}
</div>

<style>
	@import './map/map-overrides.css';
	@import './map/map-markers.css';
	.map-area {
		flex: 1;
		position: relative;
		overflow: hidden;
	}
	.map-area :global(.map-container) {
		width: 100%;
		height: 100%;
	}

	.gps-legend {
		position: absolute;
		bottom: 16px;
		left: 16px;
		background: rgba(17, 17, 17, 0.85);
		border: 1px solid var(--border, #2e2e2e);
		border-radius: 6px;
		padding: 8px 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		backdrop-filter: blur(4px);
		z-index: 10;
		min-width: 180px;
		pointer-events: none;
	}

	.legend-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
	}

	.legend-label {
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 1px;
		text-transform: uppercase;
		color: var(--muted-foreground, #555555);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.legend-value {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--foreground, #e8e8e8);
		text-align: right;
	}

	.legend-fix {
		color: var(--success, #8bbfa0);
	}

	.legend-divider {
		height: 1px;
		background: var(--border, #2e2e2e);
		margin: 2px 0;
	}
</style>
