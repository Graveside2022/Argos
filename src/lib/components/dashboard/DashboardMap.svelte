<!-- @constitutional-exemption Article-IV-4.3 issue:#999 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import 'maplibre-gl/dist/maplibre-gl.css';

	import type { Feature, FeatureCollection } from 'geojson';
	import type { LngLatLike } from 'maplibre-gl';
	import maplibregl from 'maplibre-gl'; // Runtime import for MapLibre GL library
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

	import { SatelliteLayer } from '$lib/map/layers/SatelliteLayer';
	import { SymbolLayer } from '$lib/map/layers/SymbolLayer';
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
	import { mapSettings } from '$lib/stores/dashboard/map-settings-store';
	import { gpsStore } from '$lib/stores/tactical-map/gps-store';
	import { kismetStore } from '$lib/stores/tactical-map/kismet-store';
	import { takCotMessages } from '$lib/stores/tak-store';
	import { themeStore } from '$lib/stores/theme-store.svelte';
	import { parseCotToFeature } from '$lib/utils/cot-parser';
	import { getSignalBandKey, getSignalHex } from '$lib/utils/signal-utils';
	import { resolveThemeColor } from '$lib/utils/theme-colors';

	let map: maplibregl.Map | undefined = $state();
	let symbolLayer: SymbolLayer | undefined = $state();
	let initialViewSet = false;

	// Alfa AWUS036AXML with basic omnidirectional antenna — signal range bands
	// Log-distance path loss: PL(d) = 40 + 10·n·log₁₀(d), n=3.3 (suburban w/ buildings)
	// Link budget: TX=20dBm + AP_ant=3dBi + Alfa_ant=5dBi, RX floor=-94dBm
	// Signal(d) = -12 - 33·log₁₀(d). Max practical range ≈ 300m
	// Live Kismet data: 241 devices, mean RSSI -78.6 dBm, range -12 to -100 dBm
	// Five bands match device dot colors (getSignalHex in signalUtils.ts)
	// Radii from log-distance model: d = 10^((-12 - rssiThreshold) / 33)
	// Colors: resolved from CSS signal variables (respond to palette/semantic changes)
	let RANGE_BANDS = $derived.by(() => {
		// Depend on themeStore to re-resolve when palette changes
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

	// GPS derived state
	let gpsLngLat: LngLatLike | null = $derived.by(() => {
		const { lat, lon } = $gpsStore.position;
		if (lat === 0 && lon === 0) return null;
		// Safe: [lon, lat] array narrowed to LngLatLike for MapLibre coordinate type compatibility
		return [lon, lat] as LngLatLike;
	});

	// Reactive theme color for accuracy circle (blue bubble)
	let accuracyColor = $derived.by(() => {
		const _p = themeStore.palette; // React to palette changes
		return resolveThemeColor('--primary', '#4a9eff');
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
			// Safe: GeoJSON type literal narrowed to const for strict FeatureCollection type matching
			return { type: 'FeatureCollection' as const, features: [] };
		}
		return {
			// Safe: GeoJSON type literal narrowed to const for strict FeatureCollection type matching
			type: 'FeatureCollection' as const,
			features: [createCirclePolygon(lon, lat, acc)]
		};
	});

	let detectionRangeGeoJSON: FeatureCollection = $derived.by(() => {
		const { lat, lon } = $gpsStore.position;
		if (lat === 0 && lon === 0) {
			// Safe: GeoJSON type literal narrowed to const for strict FeatureCollection type matching
			return { type: 'FeatureCollection' as const, features: [] };
		}
		const rangeFeatures: Feature[] = [];
		for (const b of RANGE_BANDS) {
			rangeFeatures.push({
				...createRingPolygon(lon, lat, b.outerR, b.innerR),
				properties: { band: b.band, color: b.color }
			});
		}
		// Safe: GeoJSON type literal narrowed to const for strict FeatureCollection type matching
		return { type: 'FeatureCollection' as const, features: rangeFeatures };
	});

	// --- Radial spread: clients sharing AP's exact GPS get fanned out in a circle ---
	// Deterministic angle from MAC so each client gets a stable unique position
	function macToAngle(mac: string): number {
		let hash = 0;
		for (let i = 0; i < mac.length; i++) {
			hash = (hash << 5) - hash + mac.charCodeAt(i);
			hash |= 0;
		}
		return (Math.abs(hash) % 360) * (Math.PI / 180);
	}

	// Estimate distance from RSSI using log-distance path loss model
	// PL(d) = 40 + 10·n·log₁₀(d), n=3.3 (suburban w/ buildings)
	// Signal(d) = -12 - 33·log₁₀(d) → d = 10^((-12 - rssi) / 33)
	// Clamped to [10m, 300m] to match detection range bands
	function rssiToMeters(rssi: number): number {
		if (rssi === 0 || rssi >= -12) return 40; // no-signal fallback
		const d = Math.pow(10, (-12 - rssi) / 33);
		return Math.max(10, Math.min(300, d));
	}

	// Returns [lon, lat] — offset if client shares AP's exact coords, otherwise original
	// Uses RSSI-based distance estimation: strong signal → close, weak → far
	function spreadClientPosition(
		clientLon: number,
		clientLat: number,
		apLon: number,
		apLat: number,
		clientMac: string,
		clientRssi: number
	): [number, number] {
		const samePos =
			Math.abs(clientLat - apLat) < 0.00001 && Math.abs(clientLon - apLon) < 0.00001;
		if (!samePos) return [clientLon, clientLat];
		const distMeters = rssiToMeters(clientRssi);
		const angle = macToAngle(clientMac);
		const dLat = (distMeters * Math.cos(angle)) / 111320;
		const dLon = (distMeters * Math.sin(angle)) / (111320 * Math.cos((apLat * Math.PI) / 180));
		return [apLon + dLon, apLat + dLat];
	}

	// Quadratic bezier curve between two points (bows outward for visual separation)
	function bezierArc(
		start: [number, number],
		end: [number, number],
		steps = 16
	): [number, number][] {
		const dx = end[0] - start[0];
		const dy = end[1] - start[1];
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist < 1e-8) return [start, end];
		// Control point: perpendicular offset at midpoint (15% of line length)
		const mx = (start[0] + end[0]) / 2;
		const my = (start[1] + end[1]) / 2;
		const bow = dist * 0.15;
		const cx = mx - (dy / dist) * bow;
		const cy = my + (dx / dist) * bow;
		const pts: [number, number][] = [];
		for (let i = 0; i <= steps; i++) {
			const t = i / steps;
			const u = 1 - t;
			pts.push([
				u * u * start[0] + 2 * u * t * cx + t * t * end[0],
				u * u * start[1] + 2 * u * t * cy + t * t * end[1]
			]);
		}
		return pts;
	}

	// Device derived state — filters at data level for reliability (MapLibre expression filters
	// don't work reliably on clustered sources, same pattern used for isolation filtering)
	let deviceGeoJSON: FeatureCollection = $derived.by(() => {
		const state = $kismetStore;
		const isoMac = $isolatedDeviceMAC;
		const bands = $activeBands;
		const vMode = $visibilityMode;
		const promoted = $promotedDevices;
		const features: Feature[] = [];

		// Build set of visible MACs when isolated
		let visibleMACs: Set<string> | null = null;
		if (isoMac) {
			const ap = state.devices.get(isoMac);
			visibleMACs = new Set([isoMac]);
			if (ap?.clients?.length) {
				for (const c of ap.clients) visibleMACs.add(c);
			}
		}

		// Pre-filter devices by visibility mode (FR-013)
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
			// FR-013 visibility filter
			if (!visibleMacSet.has(mac)) return;

			let lat = device.location?.lat;
			let lon = device.location?.lon;
			if (!lat || !lon || (lat === 0 && lon === 0)) return;
			const rssi = device.signal?.last_signal ?? 0;
			const band = getSignalBandKey(rssi);

			// Filter by active signal bands (skip devices whose band is toggled off)
			if (!bands.has(band)) return;

			// Radial spread: clients sharing AP's position get fanned out
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
		// Safe: GeoJSON type literal narrowed to const for strict FeatureCollection type matching
		return { type: 'FeatureCollection' as const, features };
	});

	// AP-to-client connection arcs — curved lines for visual clarity
	let connectionLinesGeoJSON: FeatureCollection = $derived.by(() => {
		const state = $kismetStore;
		const isoMac = $isolatedDeviceMAC;
		const layerOn = $layerVisibility.connectionLines;
		// Safe: GeoJSON type literal narrowed to const for empty FeatureCollection return
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
				const client = state.devices.get(clientMac);
				if (!client?.location?.lat || !client?.location?.lon) continue;
				// Use spread position for client end of the arc
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
					properties: {
						apMac: device.mac,
						clientMac,
						color: apColor
					}
				});
			}
		});
		// Safe: GeoJSON type literal narrowed to const for strict FeatureCollection type matching
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
		const coneColor = resolveThemeColor('--primary', '#4a9eff');
		return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
			<defs><radialGradient id="hc" cx="50%" cy="50%" r="50%">
				<stop offset="0%" stop-color="${coneColor}" stop-opacity="0.5"/>
				<stop offset="100%" stop-color="${coneColor}" stop-opacity="0"/>
			</radialGradient></defs>
			<path d="M ${half} ${half} L ${x1} ${y1} A ${coneLength} ${coneLength} 0 0 1 ${x2} ${y2} Z" fill="url(#hc)"/>
		</svg>`;
	}

	// Cell tower radio type → color (resolved from chart CSS variables)
	function getRadioColor(radio: string): string {
		switch (radio?.toUpperCase()) {
			case 'LTE':
				return resolveThemeColor('--chart-1', '#4a9eff');
			case 'NR':
				return resolveThemeColor('--chart-5', '#ec4899');
			case 'UMTS':
				return resolveThemeColor('--chart-2', '#10b981');
			case 'GSM':
				return resolveThemeColor('--chart-3', '#f97316');
			case 'CDMA':
				return resolveThemeColor('--chart-4', '#8b5cf6');
			default:
				return resolveThemeColor('--muted-foreground', '#9aa0a6');
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
					// Safe: GeoJSON Feature type literal narrowed to const for strict type matching
					type: 'Feature' as const,
					// Safe: GeoJSON Point geometry type literal narrowed to const for strict type matching
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
		const mapInstance = map;

		// Initialize Satellite Layer
		const satLayer = new SatelliteLayer(map);

		// Initialize Symbol Layer (MIL-STD-2525)
		symbolLayer = new SymbolLayer(map);

		// Sync with settings (Satellite)
		mapSettings.subscribe((settings) => {
			if (settings.type === 'satellite') {
				satLayer.add(settings.url, settings.attribution);
				satLayer.setVisible(true);
			} else {
				satLayer.setVisible(false);
			}
		});

		// Sync Symbols with Device Data and TAK CoT
		// We use an effect to push updates to the imperative layer
		$effect(() => {
			// 1. Kismet Features
			let features: Feature[] = [];

			if (deviceGeoJSON) {
				// Transform features to include SIDC
				const deviceFeatures = deviceGeoJSON.features.map((f) => {
					const props = f.properties || {};
					const type = props.type || 'unknown';
					const sidc = SymbolFactory.getSidcForDevice(type, 'unknown');

					return {
						...f,
						properties: {
							...props,
							sidc,
							label: props.ssid || props.mac || 'Unknown'
						}
					};
				});
				features = [...deviceFeatures];
			}

			// 2. TAK Features
			const cotMsgs = $takCotMessages;
			if (cotMsgs.length > 0) {
				const takFeatures = cotMsgs
					.map((xml) => parseCotToFeature(xml))
					.filter((f) => f !== null) as Feature[];
				features = [...features, ...takFeatures];
			}

			// 3. Update layer
			if (symbolLayer) {
				symbolLayer.update(features);
			}
		});

		// Click on empty map background → dismiss overlay and clear isolation
		mapInstance.on('click', (e) => {
			const features = mapInstance.queryRenderedFeatures(e.point, {
				layers: ['device-circles', 'device-clusters', 'cell-tower-circles']
			});
			if (!features || features.length === 0) {
				_popupLngLat = null;
				popupContent = null;
				isolateDevice(null);
			}
		});

		// Enhanced building outlines (brighter than the subtle default)
		mapInstance.addLayer(
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
		mapInstance.addLayer({
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
		mapInstance.addLayer({
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
	}

	function handleLocateClick() {
		if (map && gpsLngLat) {
			// Safe: LngLatLike narrowed to coordinate tuple [number, number] for MapLibre flyTo method
			map.flyTo({ center: gpsLngLat as [number, number], zoom: 18 });
		}
	}

	function handleDeviceClick(ev: maplibregl.MapMouseEvent) {
		const features = map?.queryRenderedFeatures(ev.point, { layers: ['device-circles'] });
		if (features && features.length > 0) {
			const props = features[0].properties;
			const geom = features[0].geometry;
			if (geom.type === 'Point') {
				// Safe: GeoJSON Point geometry coordinates narrowed to [number, number] tuple for popup positioning
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
					parentAP: props?.parentAP ?? ''
				};

				// Notify agent context store (AG-UI shared state bridge)
				selectDevice(props?.mac ?? '', popupContent);

				// Sync with devices table — isolate to show relationships
				const mac = props?.mac ?? '';
				const clientCount = props?.clientCount ?? 0;
				const parentAP = props?.parentAP ?? '';
				if (clientCount > 0) {
					// This is an AP with clients — isolate to it
					isolateDevice(mac);
				} else if (parentAP) {
					// This is a client — isolate to its parent AP
					isolateDevice(parentAP);
				} else {
					// Standalone device — clear isolation
					isolateDevice(null);
				}
			}
		}
	}

	async function handleClusterClick(ev: maplibregl.MapMouseEvent) {
		const features = map?.queryRenderedFeatures(ev.point, { layers: ['device-clusters'] });
		if (!features || features.length === 0 || !map) return;

		const clusterId = features[0].properties?.cluster_id;
		if (clusterId === undefined) return;

		// Safe: MapLibre getSource returns Source type, narrowing to GeoJSONSource for cluster methods
		const source = map.getSource('devices-src') as maplibregl.GeoJSONSource;
		if (!source) return;

		try {
			const zoom = await source.getClusterExpansionZoom(clusterId);
			const geom = features[0].geometry;
			if (geom.type === 'Point') {
				map.easeTo({
					// Safe: GeoJSON Point geometry coordinates narrowed to [number, number] tuple for map easeTo center
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
				// Safe: GeoJSON Point geometry coordinates narrowed to [number, number] tuple for tower popup positioning
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
		connectionLines: ['device-connection-lines'],
		cellTowers: ['cell-tower-circles', 'cell-tower-labels'],
		signalMarkers: ['detection-range-fill'],
		accuracyCircle: ['accuracy-fill']
	};

	$effect(() => {
		if (!map) return;
		const vis = $layerVisibility;
		const isoMac = $isolatedDeviceMAC;

		// Update SymbolLayer visibility
		if (symbolLayer) {
			symbolLayer.setVisible(vis.milSyms !== false);
		}

		for (const [key, layerIds] of Object.entries(LAYER_MAP)) {
			// Connection lines: show when isolated OR when layer manually enabled
			const visible =
				key === 'connectionLines'
					? vis[key] !== false || isoMac !== null
					: vis[key] !== false;
			for (const id of layerIds) {
				if (map.getLayer(id)) {
					map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
				}
			}
		}
	});

	// Isolation mode — hide clusters when viewing a single AP's relationships
	$effect(() => {
		if (!map) return;
		const isoMac = $isolatedDeviceMAC;
		if (isoMac) {
			// Hide clusters during isolation (only a few devices visible)
			if (map.getLayer('device-clusters')) {
				map.setLayoutProperty('device-clusters', 'visibility', 'none');
			}
			if (map.getLayer('device-cluster-count')) {
				map.setLayoutProperty('device-cluster-count', 'visibility', 'none');
			}
		} else {
			// Restore cluster visibility based on layer toggle
			const vis = $layerVisibility;
			const dotsVisible = vis.deviceDots !== false;
			if (map.getLayer('device-clusters')) {
				map.setLayoutProperty(
					'device-clusters',
					'visibility',
					dotsVisible ? 'visible' : 'none'
				);
			}
			if (map.getLayer('device-cluster-count')) {
				map.setLayoutProperty(
					'device-cluster-count',
					'visibility',
					dotsVisible ? 'visible' : 'none'
				);
			}
		}
	});

	// Re-apply MapLibre paint properties when theme changes
	$effect(() => {
		const _p = themeStore.palette;
		if (!map) return;

		const fg = resolveThemeColor('--foreground', '#e0e0e8');
		const mutedFg = resolveThemeColor('--muted-foreground', '#888');
		const bg = resolveThemeColor('--background', '#111119');
		const secondary = resolveThemeColor('--secondary', '#3a3a5c');
		const border = resolveThemeColor('--border', '#6a6a8e');

		// Cluster circles
		if (map.getLayer('device-clusters')) {
			map.setPaintProperty('device-clusters', 'circle-color', secondary);
			map.setPaintProperty('device-clusters', 'circle-stroke-color', border);
		}
		// Cluster count text
		if (map.getLayer('device-cluster-count')) {
			map.setPaintProperty('device-cluster-count', 'text-color', fg);
		}
		// Cell tower labels
		if (map.getLayer('cell-tower-labels')) {
			map.setPaintProperty('cell-tower-labels', 'text-color', mutedFg);
			map.setPaintProperty('cell-tower-labels', 'text-halo-color', bg);
		}
		// Imperative layers (added in handleMapLoad)
		if (map.getLayer('housenumber-labels')) {
			map.setPaintProperty('housenumber-labels', 'text-color', mutedFg);
			map.setPaintProperty('housenumber-labels', 'text-halo-color', bg);
		}
		if (map.getLayer('poi-labels-all')) {
			map.setPaintProperty('poi-labels-all', 'text-color', fg);
			map.setPaintProperty('poi-labels-all', 'text-halo-color', bg);
		}
		if (map.getLayer('building-outline-enhanced')) {
			map.setPaintProperty('building-outline-enhanced', 'line-color', `${border}4D`);
		}
	});
</script>

<div class="map-area">
	<MapLibre
		bind:map
		style="/api/map-tiles/styles/alidade_smooth_dark.json"
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

		<!-- Navigation (zoom +/-) -->
		<NavigationControl position="bottom-right" showCompass={false} />

		<!-- Center-on-location button — top of bottom-right stack -->
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
						<circle cx="12" cy="12" r="8" />
						<circle cx="12" cy="12" r="3" fill="currentColor" />
						<line x1="12" y1="2" x2="12" y2="4" />
						<line x1="12" y1="20" x2="12" y2="22" />
						<line x1="2" y1="12" x2="4" y2="12" />
						<line x1="20" y1="12" x2="22" y2="12" />
					</svg>
				</button>
			</div>
		</CustomControl>

		<!-- GPS accuracy circle fill -->
		<GeoJSONSource id="accuracy-src" data={accuracyGeoJSON}>
			<FillLayer
				id="accuracy-fill"
				paint={{
					'fill-color': accuracyColor,
					'fill-opacity': 0.18
				}}
			/>
		</GeoJSONSource>

		<!-- Cell tower markers (toggled via Layers panel) -->
		<GeoJSONSource id="cell-towers-src" data={cellTowerGeoJSON}>
			<!-- Cell Towers (Circles) -->
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
				paint={{
					'text-color': '#888',
					'text-halo-color': '#111119',
					'text-halo-width': 1
				}}
			/>
		</GeoJSONSource>

		<!-- AP-to-client connection lines -->
		<GeoJSONSource id="connection-lines-src" data={connectionLinesGeoJSON}>
			<LineLayer
				id="device-connection-lines"
				paint={{
					'line-color': ['get', 'color'],
					'line-width': 1.5,
					'line-opacity': 0.7
				}}
			/>
		</GeoJSONSource>

		<!-- Device markers with zoom-aware clustering -->
		<GeoJSONSource
			id="devices-src"
			data={deviceGeoJSON}
			cluster={!$isolatedDeviceMAC}
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
			<MapLibreSymbolLayer
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

			<!-- Individual unclustered device dots — APs with clients are bigger, zoom-aware -->
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

		<!-- Device popup is rendered as fixed overlay outside MapLibre -->

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
						<!-- @constitutional-exemption Article-IX-9.4 issue:#999 — buildConeSVG() returns hardcoded SVG string from numeric heading, no user input -->
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

	<!-- Device info overlay — fixed in top-right corner -->
	{#if popupContent}
		<div class="device-overlay">
			<button
				class="overlay-close"
				onclick={() => {
					_popupLngLat = null;
					popupContent = null;
					isolateDevice(null);
				}}
			>
				<svg
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					><line x1="18" y1="6" x2="6" y2="18" /><line
						x1="6"
						y1="6"
						x2="18"
						y2="18"
					/></svg
				>
			</button>
			<div class="overlay-title">{popupContent.ssid}</div>
			<div class="overlay-row">
				<span class="overlay-label">MAC</span>
				<span class="overlay-value">{popupContent.mac}</span>
			</div>
			<div class="overlay-row">
				<span class="overlay-label">VENDOR</span>
				<span class="overlay-value">{popupContent.manufacturer}</span>
			</div>
			<div class="overlay-row">
				<span class="overlay-label">TYPE</span>
				<span class="overlay-value">{popupContent.type}</span>
			</div>
			<div class="overlay-divider"></div>
			<div class="overlay-row">
				<span class="overlay-label">RSSI</span>
				<span class="overlay-value"
					>{popupContent.rssi !== 0 ? `${popupContent.rssi} dBm` : '—'}</span
				>
			</div>
			<div class="overlay-row">
				<span class="overlay-label">CH</span>
				<span class="overlay-value">{popupContent.channel || '—'}</span>
			</div>
			<div class="overlay-row">
				<span class="overlay-label">FREQ</span>
				<span class="overlay-value">{formatFrequency(popupContent.frequency)}</span>
			</div>
			<div class="overlay-divider"></div>
			<div class="overlay-row">
				<span class="overlay-label">PKTS</span>
				<span class="overlay-value">{popupContent.packets.toLocaleString()}</span>
			</div>
			<div class="overlay-row">
				<span class="overlay-label">LAST</span>
				<span class="overlay-value">{formatTimeAgo(popupContent.last_seen)}</span>
			</div>
			{#if popupContent.clientCount > 0}
				<div class="overlay-divider"></div>
				<div class="overlay-row">
					<span class="overlay-label">CLIENTS</span>
					<span class="overlay-value overlay-accent">{popupContent.clientCount}</span>
				</div>
			{/if}
			{#if popupContent.parentAP}
				<div class="overlay-divider"></div>
				<div class="overlay-row">
					<span class="overlay-label">PARENT</span>
					<span class="overlay-value overlay-mono">{popupContent.parentAP}</span>
				</div>
			{/if}
		</div>
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

	/* GPS blue dot */
	.gps-dot {
		width: 16px;
		height: 16px;
		background: var(--primary);
		border: 2px solid var(--primary-foreground);
		border-radius: 50%;
		box-shadow: 0 0 6px color-mix(in srgb, var(--primary) 50%, transparent);
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

	/* MapLibre zoom controls — theme-aware */
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

	.popup-accent {
		color: var(--palantir-accent, #4a90e2);
	}

	.popup-mono {
		font-size: 10px;
		word-break: break-all;
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

	/* Device info overlay — fixed in top-right of map */
	.device-overlay {
		position: absolute;
		top: 10px;
		right: 10px;
		z-index: 10;
		background: color-mix(in srgb, var(--card) 95%, transparent);
		border: 1px solid var(--palantir-border-default, #2a2a3e);
		border-radius: 8px;
		padding: 10px 12px;
		min-width: 180px;
		max-width: 220px;
		box-shadow: 0 4px 16px color-mix(in srgb, var(--background) 50%, transparent);
		backdrop-filter: blur(8px);
		pointer-events: auto;
	}

	.overlay-close {
		position: absolute;
		top: 6px;
		right: 6px;
		background: none;
		border: none;
		color: var(--palantir-text-tertiary, #666);
		cursor: pointer;
		padding: 2px;
		display: flex;
		align-items: center;
	}

	.overlay-close:hover {
		color: var(--palantir-text-primary, #e0e0e8);
	}

	.overlay-title {
		font-weight: 600;
		font-size: 13px;
		margin-bottom: 6px;
		padding-right: 16px;
		color: var(--palantir-text-primary, #e0e0e8);
	}

	.overlay-row {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		padding: 1.5px 0;
	}

	.overlay-label {
		color: var(--palantir-text-tertiary, #666);
		letter-spacing: 0.05em;
	}

	.overlay-value {
		color: var(--palantir-text-secondary, #aaa);
		font-family: var(--font-mono, monospace);
		font-size: 10px;
	}

	.overlay-accent {
		color: var(--palantir-accent, #4a90e2);
	}

	.overlay-mono {
		font-size: 9px;
		word-break: break-all;
	}

	.overlay-divider {
		border-top: 1px solid var(--palantir-border-default, #2a2a3e);
		margin: 3px 0;
	}

	.control-stack {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
</style>
