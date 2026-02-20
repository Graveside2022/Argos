<!-- @constitutional-exemption Article-IV-4.3 issue:#999 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import 'maplibre-gl/dist/maplibre-gl.css';

	import type { Feature, FeatureCollection } from 'geojson';
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

	import type { SatelliteLayer } from '$lib/map/layers/SatelliteLayer';
	import type { SymbolLayer } from '$lib/map/layers/SymbolLayer';
	import { SymbolFactory } from '$lib/map/symbols/SymbolFactory';
	import {
		type DeviceForVisibility,
		filterByVisibility,
		promotedDevices,
		visibilityMode
	} from '$lib/map/VisibilityEngine';
	import { selectDevice } from '$lib/stores/dashboard/agent-context-store';
	import {
		activeBands,
		isolatedDeviceMAC,
		isolateDevice,
		layerVisibility
	} from '$lib/stores/dashboard/dashboard-store';
	import { GOOGLE_SATELLITE_STYLE, mapSettings } from '$lib/stores/dashboard/map-settings-store';
	import { gpsStore } from '$lib/stores/tactical-map/gps-store';
	import { type Affiliation, kismetStore } from '$lib/stores/tactical-map/kismet-store';
	import { takCotMessages } from '$lib/stores/tak-store';
	import { themeStore } from '$lib/stores/theme-store.svelte';
	import { parseCotToFeature } from '$lib/utils/cot-parser';
	import { getSignalBandKey, getSignalHex } from '$lib/utils/signal-utils';
	import { resolveThemeColor } from '$lib/utils/theme-colors';

	import DeviceOverlay from './map/DeviceOverlay.svelte';
	import {
		bezierArc,
		buildConeSVG,
		createCirclePolygon,
		createRingPolygon,
		fetchCellTowers,
		haversineKm,
		LAYER_MAP,
		spreadClientPosition
	} from './map/map-helpers';
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
	let lastTowerFetchLat = 0;
	let lastTowerFetchLon = 0;

	let _popupLngLat: LngLatLike | null = $state(null);
	let popupContent: {
		ssid: string;
		mac: string;
		rssi: number;
		type: string;
		manufacturer: string;
		channel: number;
		frequency: number;
		packets: number;
		last_seen: number;
		clientCount: number;
		parentAP: string;
		affiliation: Affiliation;
	} | null = $state(null);
	let towerPopupLngLat: LngLatLike | null = $state(null);
	let towerPopupContent: {
		radio: string;
		mcc: number;
		mnc: number;
		lac: number;
		ci: number;
		range: number;
		samples: number;
		avgSignal: number;
	} | null = $state(null);

	let accuracyColor = $derived.by(() => {
		const _p = themeStore.palette;
		const _r = cssReady;
		return resolveThemeColor('--primary', '#4a9eff');
	});

	let RANGE_BANDS = $derived.by(() => {
		const _p = themeStore.palette;
		return [
			{
				outerR: 25,
				innerR: 0,
				band: 'vstrong',
				color: resolveThemeColor('--signal-critical', '#dc2626'),
				rssi: '> -50',
				label: '25m'
			},
			{
				outerR: 60,
				innerR: 25,
				band: 'strong',
				color: resolveThemeColor('--signal-strong', '#f97316'),
				rssi: '-50 to -60',
				label: '60m'
			},
			{
				outerR: 100,
				innerR: 60,
				band: 'good',
				color: resolveThemeColor('--signal-good', '#fbbf24'),
				rssi: '-60 to -70',
				label: '100m'
			},
			{
				outerR: 175,
				innerR: 100,
				band: 'fair',
				color: resolveThemeColor('--signal-fair', '#10b981'),
				rssi: '-70 to -80',
				label: '175m'
			},
			{
				outerR: 300,
				innerR: 175,
				band: 'weak',
				color: resolveThemeColor('--signal-weak', '#4a90e2'),
				rssi: '< -80',
				label: '300m'
			}
		];
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

	let accuracyGeoJSON: FeatureCollection = $derived.by(() => {
		const { lat, lon } = $gpsStore.position;
		const acc = $gpsStore.status.accuracy;
		if ((lat === 0 && lon === 0) || acc <= 0) {
			return { type: 'FeatureCollection' as const, features: [] };
		}
		return {
			type: 'FeatureCollection' as const,
			features: [createCirclePolygon(lon, lat, acc)]
		};
	});

	let detectionRangeGeoJSON: FeatureCollection = $derived.by(() => {
		const { lat, lon } = $gpsStore.position;
		if (lat === 0 && lon === 0) return { type: 'FeatureCollection' as const, features: [] };
		const rangeFeatures: Feature[] = [];
		for (const b of RANGE_BANDS) {
			rangeFeatures.push({
				...createRingPolygon(lon, lat, b.outerR, b.innerR),
				properties: { band: b.band, color: b.color }
			});
		}
		return { type: 'FeatureCollection' as const, features: rangeFeatures };
	});

	let deviceGeoJSON: FeatureCollection = $derived.by(() => {
		const state = $kismetStore;
		const isoMac = $isolatedDeviceMAC;
		const bands = $activeBands;
		const vMode = $visibilityMode;
		const promoted = $promotedDevices;
		const features: Feature[] = [];

		let visibleMACs: Set<string> | null = null;
		if (isoMac) {
			const ap = state.devices.get(isoMac);
			visibleMACs = new Set([isoMac]);
			if (ap?.clients?.length) for (const c of ap.clients) visibleMACs.add(c);
		}

		const devicesForVisibility: (DeviceForVisibility & { mac: string })[] = [];
		state.devices.forEach((device, mac) => {
			if (visibleMACs && !visibleMACs.has(mac)) return;
			const lat = device.location?.lat;
			const lon = device.location?.lon;
			if (!lat || !lon || (lat === 0 && lon === 0)) return;
			devicesForVisibility.push({
				mac,
				rssi: device.signal?.last_signal ?? 0,
				lastSeen: device.last_seen || 0
			});
		});

		const visibleDevices = filterByVisibility(devicesForVisibility, vMode, promoted);
		const visibleMacSet = new Set(visibleDevices.map((d) => d.mac));

		state.devices.forEach((device, mac) => {
			if (!visibleMacSet.has(mac)) return;
			let lat = device.location?.lat;
			let lon = device.location?.lon;
			if (!lat || !lon || (lat === 0 && lon === 0)) return;
			const rssi = device.signal?.last_signal ?? 0;
			const band = getSignalBandKey(rssi);
			if (!bands.has(band)) return;

			if (device.parentAP) {
				const ap = state.devices.get(device.parentAP);
				if (ap?.location?.lat && ap?.location?.lon) {
					const [sLon, sLat] = spreadClientPosition(
						lon,
						lat,
						ap.location.lon,
						ap.location.lat,
						mac,
						rssi
					);
					lon = sLon;
					lat = sLat;
				}
			}

			features.push({
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [lon, lat] },
				properties: {
					mac,
					ssid: device.ssid || 'Unknown',
					rssi,
					band,
					type: device.type || 'unknown',
					color: getSignalHex(rssi),
					manufacturer: device.manufacturer || device.manuf || 'Unknown',
					channel: device.channel || 0,
					frequency: device.frequency || 0,
					packets: device.packets || 0,
					last_seen: device.last_seen || 0,
					clientCount: device.clients?.length ?? 0,
					parentAP: device.parentAP ?? ''
				}
			});
		});
		return { type: 'FeatureCollection' as const, features };
	});

	let visibleDeviceMACs: Set<string> = $derived(
		new Set(deviceGeoJSON.features.map((f) => f.properties?.mac as string).filter(Boolean))
	);

	let connectionLinesGeoJSON: FeatureCollection = $derived.by(() => {
		const state = $kismetStore;
		const isoMac = $isolatedDeviceMAC;
		const layerOn = $layerVisibility.connectionLines;
		if (!isoMac && !layerOn) return { type: 'FeatureCollection' as const, features: [] };

		const features: Feature[] = [];
		state.devices.forEach((device) => {
			if (!device.clients?.length) return;
			if (isoMac && device.mac !== isoMac) return;
			const apLat = device.location?.lat;
			const apLon = device.location?.lon;
			if (!apLat || !apLon) return;
			const apColor = getSignalHex(device.signal?.last_signal ?? 0);
			for (const clientMac of device.clients) {
				if (!visibleDeviceMACs.has(clientMac)) continue;
				const client = state.devices.get(clientMac);
				if (!client?.location?.lat || !client?.location?.lon) continue;
				const [cLon, cLat] = spreadClientPosition(
					client.location.lon,
					client.location.lat,
					apLon,
					apLat,
					clientMac,
					client.signal?.last_signal ?? -70
				);
				features.push({
					type: 'Feature',
					geometry: {
						type: 'LineString',
						coordinates: bezierArc([apLon, apLat], [cLon, cLat])
					},
					properties: { apMac: device.mac, clientMac, color: apColor }
				});
			}
		});
		return { type: 'FeatureCollection' as const, features };
	});

	setContext('dashboardMap', {
		getMap: () => map,
		flyTo: (lat: number, lon: number, zoom?: number) => {
			if (map) map.flyTo({ center: [lon, lat], zoom: zoom ?? map.getZoom() });
		}
	});

	// Probe Stadia style availability
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
		if (!symbolLayer) return;
		let features: Feature[] = [];
		if (deviceGeoJSON) {
			features = deviceGeoJSON.features.map((f) => {
				const props = f.properties || {};
				const mac = (props.mac || '').toUpperCase();
				const affiliation = $kismetStore.deviceAffiliations.get(mac) || 'unknown';
				return {
					...f,
					properties: {
						...props,
						sidc: SymbolFactory.getSidcForDevice(props.type || 'unknown', affiliation),
						label: props.ssid || props.mac || 'Unknown'
					}
				};
			});
		}
		const cotMsgs = $takCotMessages;
		if (cotMsgs.length > 0)
			features = [
				...features,
				...(cotMsgs
					.map((xml) => parseCotToFeature(xml))
					.filter((f) => f !== null) as Feature[])
			];
		symbolLayer.update(features);
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
		if (lat === 0 && lon === 0) return;
		const shouldFetch =
			(lastTowerFetchLat === 0 && lastTowerFetchLon === 0) ||
			haversineKm(lat, lon, lastTowerFetchLat, lastTowerFetchLon) > 1;
		if (shouldFetch)
			fetchCellTowers(lat, lon).then((r) => {
				if (r) {
					cellTowerGeoJSON = r;
					lastTowerFetchLat = lat;
					lastTowerFetchLon = lon;
				}
			});
	});

	$effect(() => {
		if (!map) return;
		const vis = $layerVisibility;
		const isoMac = $isolatedDeviceMAC;
		if (symbolLayer) symbolLayer.setVisible(vis.milSyms !== false);
		for (const [key, layerIds] of Object.entries(LAYER_MAP)) {
			const visible =
				key === 'connectionLines'
					? vis[key] !== false || isoMac !== null
					: vis[key] !== false;
			for (const id of layerIds) {
				if (map.getLayer(id))
					map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
			}
		}
	});

	$effect(() => {
		if (!map) return;
		const isoMac = $isolatedDeviceMAC;
		const dotsVisible = $layerVisibility.deviceDots !== false;
		const clusterVis = isoMac ? 'none' : dotsVisible ? 'visible' : 'none';
		if (map.getLayer('device-clusters'))
			map.setLayoutProperty('device-clusters', 'visibility', clusterVis);
		if (map.getLayer('device-cluster-count'))
			map.setLayoutProperty('device-cluster-count', 'visibility', clusterVis);
	});

	$effect(() => {
		const _p = themeStore.palette;
		if (!map) return;
		const fg = resolveThemeColor('--foreground', '#e0e0e8'),
			mutedFg = resolveThemeColor('--muted-foreground', '#888'),
			bg = resolveThemeColor('--background', '#111119'),
			secondary = resolveThemeColor('--secondary', '#3a3a5c'),
			border = resolveThemeColor('--border', '#6a6a8e');
		if (map.getLayer('device-clusters')) {
			map.setPaintProperty('device-clusters', 'circle-color', secondary);
			map.setPaintProperty('device-clusters', 'circle-stroke-color', border);
		}
		if (map.getLayer('device-cluster-count'))
			map.setPaintProperty('device-cluster-count', 'text-color', fg);
		if (map.getLayer('cell-tower-labels')) {
			map.setPaintProperty('cell-tower-labels', 'text-color', mutedFg);
			map.setPaintProperty('cell-tower-labels', 'text-halo-color', bg);
		}
		if (map.getLayer('housenumber-labels')) {
			map.setPaintProperty('housenumber-labels', 'text-color', mutedFg);
			map.setPaintProperty('housenumber-labels', 'text-halo-color', bg);
		}
		if (map.getLayer('poi-labels-all')) {
			map.setPaintProperty('poi-labels-all', 'text-color', fg);
			map.setPaintProperty('poi-labels-all', 'text-halo-color', bg);
		}
		if (map.getLayer('building-outline-enhanced'))
			map.setPaintProperty('building-outline-enhanced', 'line-color', `${border}4D`);
	});

	function handleMapLoad() {
		if (!map) return;
		const m = map;
		const init = () => {
			const r = setupMap(
				m,
				handleDeviceClick,
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

	function handleDeviceClick(ev: maplibregl.MapMouseEvent) {
		const features = map?.queryRenderedFeatures(ev.point, {
			layers: ['device-circles', 'mil-sym-layer'].filter((l) => map?.getLayer(l))
		});
		if (!features?.length) return;
		const props = features[0].properties,
			geom = features[0].geometry;
		if (geom.type !== 'Point') return;
		_popupLngLat = geom.coordinates as [number, number];
		popupContent = {
			ssid: props?.ssid ?? 'Unknown',
			mac: props?.mac ?? '',
			rssi: props?.rssi ?? -80,
			type: props?.type ?? 'unknown',
			manufacturer: props?.manufacturer ?? 'Unknown',
			channel: props?.channel ?? 0,
			frequency: props?.frequency ?? 0,
			packets: props?.packets ?? 0,
			last_seen: props?.last_seen ?? 0,
			clientCount: props?.clientCount ?? 0,
			parentAP: props?.parentAP ?? '',
			affiliation:
				$kismetStore.deviceAffiliations.get((props?.mac ?? '').toUpperCase()) || 'unknown'
		};
		selectDevice(props?.mac ?? '', popupContent);
		if ((props?.clientCount ?? 0) > 0) isolateDevice(props?.mac ?? '');
		else if (props?.parentAP) isolateDevice(props.parentAP);
		else isolateDevice(null);
	}

	async function handleClusterClick(ev: maplibregl.MapMouseEvent) {
		const features = map?.queryRenderedFeatures(ev.point, { layers: ['device-clusters'] });
		if (!features?.length || !map) return;
		const clusterId = features[0].properties?.cluster_id;
		if (clusterId === undefined) return;
		const source = map.getSource('devices-src') as maplibregl.GeoJSONSource;
		if (!source) return;
		try {
			const zoom = await source.getClusterExpansionZoom(clusterId);
			const geom = features[0].geometry;
			if (geom.type === 'Point')
				map.easeTo({
					center: geom.coordinates as [number, number],
					zoom: Math.min(zoom, 18)
				});
		} catch {
			/* cluster removed */
		}
	}

	function handleTowerClick(ev: maplibregl.MapMouseEvent) {
		const features = map?.queryRenderedFeatures(ev.point, { layers: ['cell-tower-circles'] });
		if (!features?.length) return;
		const props = features[0].properties,
			geom = features[0].geometry;
		if (geom.type !== 'Point') return;
		towerPopupLngLat = geom.coordinates as [number, number];
		towerPopupContent = {
			radio: props?.radio ?? 'Unknown',
			mcc: props?.mcc ?? 0,
			mnc: props?.mnc ?? 0,
			lac: props?.lac ?? 0,
			ci: props?.ci ?? 0,
			range: props?.range ?? 0,
			samples: props?.samples ?? 0,
			avgSignal: props?.avgSignal ?? 0
		};
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
				onclick={handleTowerClick}
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
				paint={{ 'text-color': '#888', 'text-halo-color': '#111119', 'text-halo-width': 1 }}
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
					'circle-color': '#3a3a5c',
					'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 26, 100, 32],
					'circle-opacity': 0.85,
					'circle-stroke-width': 2,
					'circle-stroke-color': '#6a6a8e'
				}}
				onclick={handleClusterClick}
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
				paint={{ 'text-color': '#e0e0e8' }}
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
				onclick={handleDeviceClick}
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
						<!-- @constitutional-exemption Article-IX-9.4 issue:#999 — buildConeSVG() returns hardcoded SVG string from numeric heading, no user input -->
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
	.map-area :global(.maplibregl-ctrl-group) {
		background: color-mix(in srgb, var(--card) 97%, transparent) !important;
		border: 1px solid var(--border) !important;
		border-radius: 6px !important;
		box-shadow: none !important;
	}
	.map-area :global(.maplibregl-ctrl-group button) {
		width: 34px !important;
		height: 34px !important;
		background: transparent !important;
		border: none !important;
		border-bottom: 1px solid var(--border) !important;
		color: var(--muted-foreground) !important;
	}
	.map-area :global(.maplibregl-ctrl-group button:last-child) {
		border-bottom: none !important;
	}
	.map-area :global(.maplibregl-ctrl-group button:hover) {
		background: var(--accent) !important;
		color: var(--primary) !important;
	}
	.map-area :global(.maplibregl-ctrl-group button .maplibregl-ctrl-icon) {
		filter: invert(0.85);
	}
	.map-area :global(.maplibregl-ctrl-group button:hover .maplibregl-ctrl-icon) {
		filter: invert(0.8) sepia(1) saturate(3) hue-rotate(190deg);
	}
	.map-area :global(.maplibregl-ctrl) {
		background: transparent !important;
		box-shadow: none !important;
		border: none !important;
	}
	.map-area :global(.maplibregl-ctrl-bottom-right > .maplibregl-ctrl) {
		margin-bottom: 4px !important;
	}
	.map-area :global(.maplibregl-popup-content) {
		background: var(--palantir-bg-panel, #141420);
		color: var(--palantir-text-primary, #e0e0e8);
		border: 1px solid var(--palantir-border-default, #2a2a3e);
		border-radius: 8px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
		padding: 12px;
	}
	.map-area :global(.maplibregl-popup-tip) {
		border-top-color: var(--palantir-bg-panel, #141420);
	}
	.map-area :global(.maplibregl-popup-close-button) {
		color: var(--palantir-text-tertiary, #666);
		font-size: 18px;
		padding: 2px 6px;
	}
	.map-area :global(.maplibregl-popup-close-button:hover) {
		color: var(--palantir-text-primary, #e0e0e8);
		background: transparent;
	}
</style>
