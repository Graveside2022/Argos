<script lang="ts">
	import { setContext } from 'svelte';
	import { gpsStore } from '$lib/stores/tactical-map/gpsStore';
	import { kismetStore } from '$lib/stores/tactical-map/kismetStore';
	import { layerVisibility, activeBands } from '$lib/stores/dashboard/dashboardStore';
	import { getSignalHex, getSignalBandKey } from '$lib/utils/signalUtils';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import {
		MapLibre,
		Marker,
		Popup,
		GeoJSONSource,
		CircleLayer,
		SymbolLayer,
		FillLayer,
		CustomControl,
		NavigationControl
	} from 'svelte-maplibre-gl';
	import type maplibregl from 'maplibre-gl';
	import type { LngLatLike } from 'maplibre-gl';
	import type { FeatureCollection, Feature } from 'geojson';

	let map: maplibregl.Map | undefined = $state();
	let initialViewSet = false;

	// Alfa AWUS036AXML with basic omnidirectional antenna — signal range bands
	// Log-distance path loss: PL(d) = 40 + 10·n·log₁₀(d), n=3.3 (suburban w/ buildings)
	// Link budget: TX=20dBm + AP_ant=3dBi + Alfa_ant=5dBi, RX floor=-94dBm
	// Signal(d) = -12 - 33·log₁₀(d). Max practical range ≈ 300m
	// Live Kismet data: 241 devices, mean RSSI -78.6 dBm, range -12 to -100 dBm
	// Five bands match device dot colors (getSignalHex in signalUtils.ts)
	// Radii from log-distance model: d = 10^((-12 - rssiThreshold) / 33)
	// Colors: red → orange → yellow → green → blue (strong → weak)
	const RANGE_BANDS = [
		{ outerR: 25, innerR: 0, band: 'vstrong', color: '#dc2626', rssi: '> -50', label: '25m' },
		{
			outerR: 60,
			innerR: 25,
			band: 'strong',
			color: '#f97316',
			rssi: '-50 to -60',
			label: '60m'
		},
		{
			outerR: 100,
			innerR: 60,
			band: 'good',
			color: '#fbbf24',
			rssi: '-60 to -70',
			label: '100m'
		},
		{
			outerR: 175,
			innerR: 100,
			band: 'fair',
			color: '#10b981',
			rssi: '-70 to -80',
			label: '175m'
		},
		{ outerR: 300, innerR: 175, band: 'weak', color: '#4a90e2', rssi: '< -80', label: '300m' }
	];

	// GPS derived state
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
		if (lat === 0 && lon === 0) {
			return { type: 'FeatureCollection' as const, features: [] };
		}
		const rangeFeatures: Feature[] = [];
		for (const b of RANGE_BANDS) {
			rangeFeatures.push({
				...createRingPolygon(lon, lat, b.outerR, b.innerR),
				properties: { band: b.band, color: b.color }
			});
		}
		return { type: 'FeatureCollection' as const, features: rangeFeatures };
	});

	// Device derived state
	let deviceGeoJSON: FeatureCollection = $derived.by(() => {
		const state = $kismetStore;
		const features: Feature[] = [];
		state.devices.forEach((device, mac) => {
			const lat = device.location?.lat;
			const lon = device.location?.lon;
			if (!lat || !lon || (lat === 0 && lon === 0)) return;
			const rssi = device.signal?.last_signal ?? -80;
			features.push({
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [lon, lat] },
				properties: {
					mac,
					ssid: device.ssid || 'Unknown',
					rssi,
					band: getSignalBandKey(rssi),
					type: device.type || 'unknown',
					color: getSignalHex(rssi),
					manufacturer: device.manufacturer || device.manuf || 'Unknown',
					channel: device.channel || 0,
					frequency: device.frequency || 0,
					packets: device.packets || 0,
					last_seen: device.last_seen || 0
				}
			});
		});
		return { type: 'FeatureCollection' as const, features };
	});

	// Cell tower state
	let cellTowerGeoJSON: FeatureCollection = $state({
		type: 'FeatureCollection',
		features: []
	});
	let lastTowerFetchLat = 0;
	let lastTowerFetchLon = 0;

	// Popup state
	let popupLngLat: LngLatLike | null = $state(null);
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
	} | null = $state(null);

	// Cell tower popup state
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

	// Expose context for child components (DevicesPanel uses flyTo)
	setContext('dashboardMap', {
		getMap: () => map,
		flyTo: (lat: number, lon: number, zoom?: number) => {
			if (map) map.flyTo({ center: [lon, lat], zoom: zoom ?? map.getZoom() });
		}
	});

	// Build a GeoJSON polygon approximating a circle (for accuracy visualization)
	function createCirclePolygon(
		lng: number,
		lat: number,
		radiusMeters: number,
		steps = 48
	): Feature {
		const coords: [number, number][] = [];
		const earthRadius = 6371000;
		for (let i = 0; i <= steps; i++) {
			const angle = (i / steps) * 2 * Math.PI;
			const dLat = (radiusMeters * Math.cos(angle)) / earthRadius;
			const dLng =
				(radiusMeters * Math.sin(angle)) / (earthRadius * Math.cos((lat * Math.PI) / 180));
			coords.push([lng + (dLng * 180) / Math.PI, lat + (dLat * 180) / Math.PI]);
		}
		return {
			type: 'Feature',
			properties: {},
			geometry: { type: 'Polygon', coordinates: [coords] }
		};
	}

	// Build a GeoJSON donut/ring polygon for signal range bands
	// When innerRadius > 0, creates a ring (annulus) with a hole punched out
	function createRingPolygon(
		lng: number,
		lat: number,
		outerRadius: number,
		innerRadius: number,
		steps = 48
	): Feature {
		const earthRadius = 6371000;
		const makeRing = (r: number): [number, number][] => {
			const coords: [number, number][] = [];
			for (let i = 0; i <= steps; i++) {
				const angle = (i / steps) * 2 * Math.PI;
				const dLat = (r * Math.cos(angle)) / earthRadius;
				const dLng =
					(r * Math.sin(angle)) / (earthRadius * Math.cos((lat * Math.PI) / 180));
				coords.push([lng + (dLng * 180) / Math.PI, lat + (dLat * 180) / Math.PI]);
			}
			return coords;
		};
		const outer = makeRing(outerRadius);
		const coordinates: [number, number][][] = [outer];
		if (innerRadius > 0) {
			coordinates.push(makeRing(innerRadius).reverse());
		}
		return {
			type: 'Feature',
			properties: {},
			geometry: { type: 'Polygon', coordinates }
		};
	}

	// Build heading cone SVG
	function buildConeSVG(heading: number): string {
		const size = 80;
		const half = size / 2;
		const coneLength = 34;
		const coneSpread = 28;
		const rad1 = ((heading - coneSpread) * Math.PI) / 180;
		const rad2 = ((heading + coneSpread) * Math.PI) / 180;
		const x1 = half + coneLength * Math.sin(rad1);
		const y1 = half - coneLength * Math.cos(rad1);
		const x2 = half + coneLength * Math.sin(rad2);
		const y2 = half - coneLength * Math.cos(rad2);
		return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
			<defs><radialGradient id="hc" cx="50%" cy="50%" r="50%">
				<stop offset="0%" stop-color="#4a9eff" stop-opacity="0.5"/>
				<stop offset="100%" stop-color="#4a9eff" stop-opacity="0"/>
			</radialGradient></defs>
			<path d="M ${half} ${half} L ${x1} ${y1} A ${coneLength} ${coneLength} 0 0 1 ${x2} ${y2} Z" fill="url(#hc)"/>
		</svg>`;
	}

	// Cell tower radio type → color
	function getRadioColor(radio: string): string {
		switch (radio?.toUpperCase()) {
			case 'LTE':
				return '#4a9eff';
			case 'NR':
				return '#ec4899';
			case 'UMTS':
				return '#10b981';
			case 'GSM':
				return '#f97316';
			case 'CDMA':
				return '#8b5cf6';
			default:
				return '#9aa0a6';
		}
	}

	// Haversine distance in km
	function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
		const R = 6371;
		const dLat = ((lat2 - lat1) * Math.PI) / 180;
		const dLon = ((lon2 - lon1) * Math.PI) / 180;
		const a =
			Math.sin(dLat / 2) ** 2 +
			Math.cos((lat1 * Math.PI) / 180) *
				Math.cos((lat2 * Math.PI) / 180) *
				Math.sin(dLon / 2) ** 2;
		return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	}

	// Fetch nearby cell towers from API
	async function fetchCellTowers(lat: number, lon: number) {
		try {
			const res = await fetch(`/api/cell-towers/nearby?lat=${lat}&lon=${lon}&radius=5`);
			if (!res.ok) return;
			const data = await res.json();
			if (!data.success || !data.towers?.length) return;

			const features: Feature[] = data.towers.map(
				(t: {
					radio: string;
					mcc: number;
					mnc: number;
					lac: number;
					ci: number;
					lat: number;
					lon: number;
					range: number;
					samples: number;
					avgSignal: number;
				}) => ({
					type: 'Feature' as const,
					geometry: { type: 'Point' as const, coordinates: [t.lon, t.lat] },
					properties: {
						radio: t.radio,
						mcc: t.mcc,
						mnc: t.mnc,
						lac: t.lac,
						ci: t.ci,
						range: t.range,
						samples: t.samples,
						avgSignal: t.avgSignal,
						color: getRadioColor(t.radio)
					}
				})
			);

			cellTowerGeoJSON = { type: 'FeatureCollection', features };
			lastTowerFetchLat = lat;
			lastTowerFetchLon = lon;
		} catch (_error: unknown) {
			// silent — cell tower data is optional
		}
	}

	// Side effect: fly to initial GPS position
	$effect(() => {
		const { lat, lon } = $gpsStore.position;
		if (!initialViewSet && $gpsStore.status.hasGPSFix && map && lat !== 0 && lon !== 0) {
			map.flyTo({ center: [lon, lat], zoom: 15 });
			initialViewSet = true;
		}
	});

	// Side effect: fetch cell towers when GPS position changes significantly
	$effect(() => {
		const { lat, lon } = $gpsStore.position;
		if (lat === 0 && lon === 0) return;
		if (lastTowerFetchLat === 0 && lastTowerFetchLon === 0) {
			fetchCellTowers(lat, lon);
		} else if (haversineKm(lat, lon, lastTowerFetchLat, lastTowerFetchLon) > 1) {
			fetchCellTowers(lat, lon);
		}
	});

	// Add custom POI/building label layers the Stadia dark style omits.
	// The Stadia alidade_smooth_dark style only shows parks, universities, and hospitals.
	// We add broader POI labels, house numbers, and enhanced building outlines.
	// NOTE: Uses pure expression syntax — do NOT mix with legacy filter syntax.
	function handleMapLoad() {
		if (!map) return;

		// Enhanced building outlines (brighter than the subtle default)
		map.addLayer(
			{
				id: 'building-outline-enhanced',
				type: 'line',
				source: 'openmaptiles',
				'source-layer': 'building',
				minzoom: 15,
				paint: {
					'line-color': 'hsla(0, 0%, 50%, 0.3)',
					'line-width': 0.5
				}
			},
			'poi_gen1'
		);

		// House numbers on buildings (zoom 17+)
		map.addLayer({
			id: 'housenumber-labels',
			type: 'symbol',
			source: 'openmaptiles',
			'source-layer': 'housenumber',
			minzoom: 17,
			layout: {
				'text-field': ['get', 'housenumber'],
				'text-font': ['Stadia Regular'],
				'text-size': 10,
				'text-anchor': 'center',
				'text-optional': true,
				'text-allow-overlap': false
			},
			paint: {
				'text-color': '#7a8290',
				'text-halo-color': '#111119',
				'text-halo-width': 1,
				'text-halo-blur': 0.5
			}
		});

		// ALL named POIs — no class or rank filter (zoom 14+)
		// Uses coalesce to try name:latin first, then name
		map.addLayer({
			id: 'poi-labels-all',
			type: 'symbol',
			source: 'openmaptiles',
			'source-layer': 'poi',
			minzoom: 14,
			filter: ['any', ['has', 'name:latin'], ['has', 'name']],
			layout: {
				'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
				'text-font': ['Stadia Regular'],
				'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 18, 13],
				'text-anchor': 'top',
				'text-offset': [0, 0.6],
				'text-max-width': 8,
				'text-optional': true,
				'text-allow-overlap': false,
				'text-padding': 2
			},
			paint: {
				'text-color': '#b0b8c4',
				'text-halo-color': '#111119',
				'text-halo-width': 1.5,
				'text-halo-blur': 0.5
			}
		});

		// Pointer cursor for clickable layers
		for (const layer of ['device-clusters', 'device-circles', 'cell-tower-circles']) {
			map.on('mouseenter', layer, () => {
				if (map) map.getCanvas().style.cursor = 'pointer';
			});
			map.on('mouseleave', layer, () => {
				if (map) map.getCanvas().style.cursor = '';
			});
		}

		// Apply initial layer visibility after declarative layers mount
		setTimeout(() => applyLayerVisibility(), 200);
	}

	function applyLayerVisibility() {
		if (!map) return;
		const vis = $layerVisibility;
		for (const [key, layerIds] of Object.entries(LAYER_MAP)) {
			const visible = vis[key] !== false;
			for (const id of layerIds) {
				if (map.getLayer(id)) {
					map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
				}
			}
		}
		if (map.getLayer('device-circles')) {
			const bandList = Array.from($activeBands);
			map.setFilter('device-circles', [
				'all',
				['!', ['has', 'point_count']],
				['in', ['get', 'band'], ['literal', bandList]]
			]);
		}
	}

	function handleLocateClick() {
		if (map && gpsLngLat) {
			map.flyTo({ center: gpsLngLat as [number, number], zoom: 18 });
		}
	}

	function handleDeviceClick(ev: maplibregl.MapMouseEvent) {
		const features = map?.queryRenderedFeatures(ev.point, { layers: ['device-circles'] });
		if (features && features.length > 0) {
			const props = features[0].properties;
			const geom = features[0].geometry;
			if (geom.type === 'Point') {
				popupLngLat = geom.coordinates as [number, number];
				popupContent = {
					ssid: props?.ssid ?? 'Unknown',
					mac: props?.mac ?? '',
					rssi: props?.rssi ?? -80,
					type: props?.type ?? 'unknown',
					manufacturer: props?.manufacturer ?? 'Unknown',
					channel: props?.channel ?? 0,
					frequency: props?.frequency ?? 0,
					packets: props?.packets ?? 0,
					last_seen: props?.last_seen ?? 0
				};
			}
		}
	}

	async function handleClusterClick(ev: maplibregl.MapMouseEvent) {
		const features = map?.queryRenderedFeatures(ev.point, { layers: ['device-clusters'] });
		if (!features || features.length === 0 || !map) return;

		const clusterId = features[0].properties?.cluster_id;
		if (clusterId === undefined) return;

		const source = map.getSource('devices-src') as maplibregl.GeoJSONSource;
		if (!source) return;

		try {
			const zoom = await source.getClusterExpansionZoom(clusterId);
			const geom = features[0].geometry;
			if (geom.type === 'Point') {
				map.easeTo({
					center: geom.coordinates as [number, number],
					zoom: Math.min(zoom, 18)
				});
			}
		} catch (_error: unknown) {
			// cluster may have been removed between click and resolution
		}
	}

	function formatTimeAgo(timestamp: number): string {
		if (!timestamp) return '—';
		const now = Date.now();
		const ts = timestamp < 1e12 ? timestamp * 1000 : timestamp;
		const diff = Math.max(0, now - ts);
		const secs = Math.floor(diff / 1000);
		if (secs < 60) return `${secs}s ago`;
		const mins = Math.floor(secs / 60);
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h ago`;
		return `${Math.floor(hrs / 24)}d ago`;
	}

	function handleTowerClick(ev: maplibregl.MapMouseEvent) {
		const features = map?.queryRenderedFeatures(ev.point, {
			layers: ['cell-tower-circles']
		});
		if (features && features.length > 0) {
			const props = features[0].properties;
			const geom = features[0].geometry;
			if (geom.type === 'Point') {
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
		}
	}

	function formatFrequency(freq: number): string {
		if (!freq) return '—';
		// Kismet reports in KHz (e.g. 5240000 = 5.24 GHz)
		if (freq >= 1000000) return `${(freq / 1000000).toFixed(2)} GHz`;
		if (freq >= 1000) return `${(freq / 1000).toFixed(0)} MHz`;
		return `${freq} MHz`;
	}

	// Layer visibility — maps toggle keys to MapLibre layer IDs
	const LAYER_MAP: Record<string, string[]> = {
		deviceDots: ['device-clusters', 'device-cluster-count', 'device-circles'],
		cellTowers: ['cell-tower-circles', 'cell-tower-labels'],
		signalMarkers: ['detection-range-fill'],
		accuracyCircle: ['accuracy-fill']
	};

	$effect(() => {
		if (!map) return;
		const vis = $layerVisibility;
		for (const [key, layerIds] of Object.entries(LAYER_MAP)) {
			const visible = vis[key] !== false;
			for (const id of layerIds) {
				if (map.getLayer(id)) {
					map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
				}
			}
		}
	});

	// Signal band filtering — update MapLibre filter on device-circles when bands change
	$effect(() => {
		if (!map || !map.getLayer('device-circles')) return;
		const bandList = Array.from($activeBands);
		map.setFilter('device-circles', [
			'all',
			['!', ['has', 'point_count']],
			['in', ['get', 'band'], ['literal', bandList]]
		]);
	});
</script>

<div class="map-area">
	<MapLibre
		bind:map
		style="https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json?api_key=252362a2-df9a-4b94-a050-c8cf8d882a55"
		center={[0, 0]}
		zoom={3}
		attributionControl={false}
		autoloadGlobalCss={false}
		class="map-container"
		onload={handleMapLoad}
	>
		<!-- Signal range donut rings — colors match device dots (getSignalHex) -->
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

		<!-- Detection range legend — bottom of bottom-right stack -->
		<CustomControl position="bottom-right">
			<div class="range-legend">
				<div class="legend-title">DETECTION RANGE</div>
				<div class="legend-row">
					<span class="legend-dot" style="background:#dc2626"></span>
					<span class="legend-dist">25m</span>
					<span class="legend-rssi">&gt; -50 dBm</span>
				</div>
				<div class="legend-row">
					<span class="legend-dot" style="background:#f97316"></span>
					<span class="legend-dist">60m</span>
					<span class="legend-rssi">-50 to -60</span>
				</div>
				<div class="legend-row">
					<span class="legend-dot" style="background:#fbbf24"></span>
					<span class="legend-dist">100m</span>
					<span class="legend-rssi">-60 to -70</span>
				</div>
				<div class="legend-row">
					<span class="legend-dot" style="background:#10b981"></span>
					<span class="legend-dist">175m</span>
					<span class="legend-rssi">-70 to -80</span>
				</div>
				<div class="legend-row">
					<span class="legend-dot" style="background:#4a90e2"></span>
					<span class="legend-dist">300m</span>
					<span class="legend-rssi">&lt; -80 dBm</span>
				</div>
			</div>
		</CustomControl>

		<!-- Navigation (zoom +/-) — above legend -->
		<NavigationControl position="bottom-right" showCompass={false} />

		<!-- Center-on-location button — top of bottom-right stack -->
		<CustomControl position="bottom-right">
			<button class="locate-btn" onclick={handleLocateClick} title="Center on my location">
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
					<circle cx="12" cy="12" r="8" />
					<circle cx="12" cy="12" r="3" fill="currentColor" />
					<line x1="12" y1="2" x2="12" y2="4" />
					<line x1="12" y1="20" x2="12" y2="22" />
					<line x1="2" y1="12" x2="4" y2="12" />
					<line x1="20" y1="12" x2="22" y2="12" />
				</svg>
			</button>
		</CustomControl>

		<!-- GPS accuracy circle fill -->
		<GeoJSONSource id="accuracy-src" data={accuracyGeoJSON}>
			<FillLayer
				id="accuracy-fill"
				paint={{
					'fill-color': '#4a9eff',
					'fill-opacity': 0.18
				}}
			/>
		</GeoJSONSource>

		<!-- Cell tower markers (toggled via Layers panel) -->
		<GeoJSONSource id="cell-towers-src" data={cellTowerGeoJSON}>
			<CircleLayer
				id="cell-tower-circles"
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
			<SymbolLayer
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
					'text-color': '#888',
					'text-halo-color': '#111119',
					'text-halo-width': 1
				}}
			/>
		</GeoJSONSource>

		<!-- Device markers with zoom-aware clustering -->
		<GeoJSONSource
			id="devices-src"
			data={deviceGeoJSON}
			cluster={true}
			clusterRadius={50}
			clusterMaxZoom={16}
			clusterMinPoints={3}
		>
			<!-- Cluster circles (sized by device count) -->
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

			<!-- Cluster count labels -->
			<SymbolLayer
				id="device-cluster-count"
				filter={['has', 'point_count']}
				layout={{
					'text-field': ['get', 'point_count_abbreviated'],
					'text-font': ['Stadia Regular'],
					'text-size': 12,
					'text-allow-overlap': true
				}}
				paint={{
					'text-color': '#e0e0e8'
				}}
			/>

			<!-- Individual unclustered device dots -->
			<CircleLayer
				id="device-circles"
				filter={['!', ['has', 'point_count']]}
				paint={{
					'circle-radius': 4,
					'circle-color': ['get', 'color'],
					'circle-opacity': 0.85,
					'circle-stroke-width': 0.5,
					'circle-stroke-color': ['get', 'color'],
					'circle-stroke-opacity': 0.4
				}}
				onclick={handleDeviceClick}
			/>
		</GeoJSONSource>

		<!-- Device popup -->
		{#if popupLngLat && popupContent}
			<Popup
				lnglat={popupLngLat}
				class="palantir-popup"
				closeButton={true}
				onclose={() => {
					popupLngLat = null;
					popupContent = null;
				}}
			>
				<div class="map-popup">
					<div class="popup-title">{popupContent.ssid}</div>
					<div class="popup-row">
						<span class="popup-label">MAC</span>
						<span class="popup-value">{popupContent.mac}</span>
					</div>
					<div class="popup-row">
						<span class="popup-label">VENDOR</span>
						<span class="popup-value">{popupContent.manufacturer}</span>
					</div>
					<div class="popup-row">
						<span class="popup-label">TYPE</span>
						<span class="popup-value">{popupContent.type}</span>
					</div>
					<div class="popup-divider"></div>
					<div class="popup-row">
						<span class="popup-label">RSSI</span>
						<span class="popup-value">{popupContent.rssi} dBm</span>
					</div>
					<div class="popup-row">
						<span class="popup-label">CHANNEL</span>
						<span class="popup-value">{popupContent.channel || '—'}</span>
					</div>
					<div class="popup-row">
						<span class="popup-label">FREQ</span>
						<span class="popup-value">{formatFrequency(popupContent.frequency)}</span>
					</div>
					<div class="popup-divider"></div>
					<div class="popup-row">
						<span class="popup-label">PACKETS</span>
						<span class="popup-value">{popupContent.packets.toLocaleString()}</span>
					</div>
					<div class="popup-row">
						<span class="popup-label">LAST SEEN</span>
						<span class="popup-value">{formatTimeAgo(popupContent.last_seen)}</span>
					</div>
				</div>
			</Popup>
		{/if}

		<!-- Cell tower popup -->
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
				<div class="map-popup">
					<div class="popup-title tower-title">
						<span
							class="tower-radio-dot"
							style="background: {getRadioColor(towerPopupContent.radio)}"
						></span>
						{towerPopupContent.radio} Tower
					</div>
					<div class="popup-row">
						<span class="popup-label">MCC</span>
						<span class="popup-value">{towerPopupContent.mcc}</span>
					</div>
					<div class="popup-row">
						<span class="popup-label">MNC</span>
						<span class="popup-value">{towerPopupContent.mnc}</span>
					</div>
					<div class="popup-row">
						<span class="popup-label">LAC</span>
						<span class="popup-value">{towerPopupContent.lac}</span>
					</div>
					<div class="popup-row">
						<span class="popup-label">CELL ID</span>
						<span class="popup-value">{towerPopupContent.ci}</span>
					</div>
					<div class="popup-divider"></div>
					<div class="popup-row">
						<span class="popup-label">RANGE</span>
						<span class="popup-value"
							>{towerPopupContent.range >= 1000
								? `${(towerPopupContent.range / 1000).toFixed(1)} km`
								: `${towerPopupContent.range} m`}</span
						>
					</div>
					<div class="popup-row">
						<span class="popup-label">SAMPLES</span>
						<span class="popup-value">{towerPopupContent.samples.toLocaleString()}</span
						>
					</div>
					{#if towerPopupContent.avgSignal}
						<div class="popup-row">
							<span class="popup-label">AVG SIGNAL</span>
							<span class="popup-value">{towerPopupContent.avgSignal} dBm</span>
						</div>
					{/if}
				</div>
			</Popup>
		{/if}

		<!-- Heading cone (shows only when moving) -->
		{#if gpsLngLat && showCone && headingDeg !== null}
			<Marker lnglat={gpsLngLat} anchor="center">
				{#snippet content()}
					<div class="heading-cone">
						{@html buildConeSVG(headingDeg)}
					</div>
				{/snippet}
			</Marker>
		{/if}

		<!-- GPS blue dot -->
		{#if gpsLngLat}
			<Marker lnglat={gpsLngLat} anchor="center">
				{#snippet content()}
					<div class="gps-dot"></div>
				{/snippet}
			</Marker>
		{/if}
	</MapLibre>
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

	/* GPS blue dot */
	.gps-dot {
		width: 16px;
		height: 16px;
		background: #4a9eff;
		border: 2px solid #ffffff;
		border-radius: 50%;
		box-shadow: 0 0 6px rgba(74, 158, 255, 0.5);
	}

	/* Heading cone wrapper */
	.heading-cone {
		pointer-events: none;
	}

	/* Locate button */
	.locate-btn {
		width: 34px;
		height: 34px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		background: #1a1a2e;
		color: #4a9eff;
		border: 1px solid #2a2a3e;
		border-radius: 4px;
		padding: 0;
		margin: 0;
	}

	.locate-btn:hover {
		background: #222244;
		color: #6cb8ff;
	}

	/* MapLibre zoom controls — dark theme to match UI */
	.map-area :global(.maplibregl-ctrl-group) {
		background: rgba(20, 20, 32, 0.92) !important;
		border: 1px solid #2a2a3e !important;
		border-radius: 6px !important;
		box-shadow: none !important;
	}

	.map-area :global(.maplibregl-ctrl-group button) {
		width: 34px !important;
		height: 34px !important;
		background: transparent !important;
		border: none !important;
		border-bottom: 1px solid #2a2a3e !important;
		color: #888 !important;
	}

	.map-area :global(.maplibregl-ctrl-group button:last-child) {
		border-bottom: none !important;
	}

	.map-area :global(.maplibregl-ctrl-group button:hover) {
		background: #222244 !important;
		color: #6cb8ff !important;
	}

	.map-area :global(.maplibregl-ctrl-group button .maplibregl-ctrl-icon) {
		filter: invert(0.6);
	}

	.map-area :global(.maplibregl-ctrl-group button:hover .maplibregl-ctrl-icon) {
		filter: invert(0.8) sepia(1) saturate(3) hue-rotate(190deg);
	}

	/* Detection range legend */
	.range-legend {
		background: rgba(20, 20, 32, 0.92);
		border: 1px solid #2a2a3e;
		border-radius: 6px;
		padding: 8px 10px;
		margin-bottom: 6px;
		box-shadow: none;
	}

	/* Remove MapLibre default white wrapper on custom controls */
	.map-area :global(.maplibregl-ctrl) {
		background: transparent !important;
		box-shadow: none !important;
		border: none !important;
	}

	/* Tighten spacing between bottom-right controls (locate + zoom) */
	.map-area :global(.maplibregl-ctrl-bottom-right > .maplibregl-ctrl) {
		margin-bottom: 4px !important;
	}

	.legend-title {
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.1em;
		color: #666;
		margin-bottom: 6px;
	}

	.legend-row {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 1.5px 0;
	}

	.legend-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.legend-dist {
		font-family: monospace;
		font-size: 11px;
		color: #e0e0e8;
		min-width: 34px;
	}

	.legend-rssi {
		font-size: 10px;
		color: #777;
	}

	/* Popup styling (Palantir theme) */
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

	.map-popup {
		min-width: 180px;
	}

	.popup-title {
		font-weight: 600;
		font-size: 13px;
		margin-bottom: 8px;
		color: var(--palantir-text-primary, #e0e0e8);
	}

	.popup-row {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		padding: 2px 0;
	}

	.popup-label {
		color: var(--palantir-text-tertiary, #666);
		letter-spacing: 0.05em;
	}

	.popup-value {
		color: var(--palantir-text-secondary, #aaa);
		font-family: monospace;
	}

	.popup-divider {
		border-top: 1px solid var(--palantir-border-default, #2a2a3e);
		margin: 4px 0;
	}

	/* Cell tower popup */
	.tower-title {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.tower-radio-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
</style>
