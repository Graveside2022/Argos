<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { hackrfAPI } from '$lib/services/hackrf/api';
	import { spectrumData } from '$lib/stores/hackrf';
	import { SignalAggregator } from '$lib/services/map/signal-aggregator';
	import { detectCountry, formatCoordinates } from '$lib/utils/countryDetector';
	import { latLonToMGRS } from '$lib/utils/mgrsConverter';
	import { estimateDistanceFromRSSI, formatDistanceEstimate } from '$lib/services/map/mapUtils';
	// AirSignalRFButton component replaced with design system button in sidebar Quick Actions (Plan 5)
	import AirSignalOverlay from '$lib/components/map/AirSignalOverlay.svelte';
	// KismetDashboardButton replaced with design system button in sidebar (Plan 3)
	import KismetDashboardOverlay from '$lib/components/map/KismetDashboardOverlay.svelte';
	import BettercapOverlay from '$lib/components/map/BettercapOverlay.svelte';
	import BTLEOverlay from '$lib/components/map/BTLEOverlay.svelte';

	// Define GPS API response interfaces
	interface GPSPositionData {
		latitude: number;
		longitude: number;
		altitude?: number | null;
		speed?: number | null;
		heading?: number | null;
		accuracy?: number;
		satellites?: number;
		fix?: number;
		time?: string;
	}

	interface GPSApiResponse {
		success: boolean;
		data?: GPSPositionData;
		error?: string;
		mode?: number;
		details?: string;
	}

	// Define SystemInfo interface to match the API response
	interface SystemInfo {
		hostname: string;
		ip: string;
		wifiInterfaces: Array<{
			name: string;
			ip: string;
			mac: string;
		}>;
		cpu: {
			usage: number;
			model: string;
			cores: number;
		};
		memory: {
			total: number;
			used: number;
			free: number;
			percentage: number;
		};
		storage: {
			total: number;
			used: number;
			free: number;
			percentage: number;
		};
		temperature: number | null;
		uptime: number;
		battery?: {
			level: number;
			charging: boolean;
		};
	}
	import type { KismetDevice } from '$lib/types/kismet';

	// Kismet API response interface
	interface KismetDevicesResponse {
		devices: KismetDevice[];
	}

	// Kismet control state
	let kismetStatus: 'stopped' | 'starting' | 'running' | 'stopping' = 'stopped';
	let statusCheckInterval: ReturnType<typeof setInterval>;

	// Import Leaflet only on client side
	// TypeScript interfaces for Leaflet
	interface LeafletIcon {
		Default: {
			prototype: { _getIconUrl?: unknown };
			mergeOptions: (options: Record<string, string>) => void;
		};
	}

	interface LeafletLibrary {
		map: (container: HTMLElement) => LeafletMap;
		tileLayer: (url: string, options?: Record<string, unknown>) => LeafletTileLayer;
		marker: (latlng: [number, number], options?: Record<string, unknown>) => LeafletMarker;
		circle: (latlng: [number, number], options?: Record<string, unknown>) => LeafletCircle;
		circleMarker: (
			latlng: [number, number],
			options?: Record<string, unknown>
		) => LeafletCircleMarker;
		divIcon: (options: Record<string, unknown>) => unknown;
		popup: (options?: Record<string, unknown>) => LeafletPopup;
		Icon: LeafletIcon;
	}

	interface LeafletMap {
		setView: (center: [number, number], zoom: number) => LeafletMap;
		attributionControl: {
			setPrefix: (prefix: string) => void;
		};
		addLayer: (layer: LeafletLayer) => void;
		removeLayer: (layer: LeafletLayer) => void;
		flyTo: (center: [number, number], zoom: number) => void;
		getZoom: () => number;
		getBounds: () => unknown;
		on: (event: string, handler: (e: LeafletEvent) => void) => void;
		off: (event: string, handler?: (e: LeafletEvent) => void) => void;
		remove: () => void;
	}

	interface LeafletTileLayer extends LeafletLayer {
		addTo: (map: LeafletMap) => LeafletTileLayer;
	}

	interface LeafletMarker extends LeafletLayer {
		addTo: (map: LeafletMap) => LeafletMarker;
		setLatLng: (latlng: [number, number]) => LeafletMarker;
		remove: () => void;
		bindPopup: (
			content: string | LeafletPopup,
			options?: Record<string, unknown>
		) => LeafletMarker;
		openPopup: () => LeafletMarker;
		closePopup: () => LeafletMarker;
		setPopupContent: (content: string) => LeafletMarker;
		on: (event: string, handler: (e: LeafletEvent) => void) => LeafletMarker;
		setIcon: (icon: unknown) => LeafletMarker;
		setOpacity: (opacity: number) => LeafletMarker;
		isPopupOpen: () => boolean;
		getPopup: () => LeafletPopup;
	}

	interface LeafletCircle extends LeafletLayer {
		addTo: (map: LeafletMap) => LeafletCircle;
		setLatLng: (latlng: [number, number]) => LeafletCircle;
		setRadius: (radius: number) => LeafletCircle;
		remove: () => void;
	}

	interface LeafletCircleMarker extends LeafletLayer {
		addTo: (map: LeafletMap) => LeafletCircleMarker;
		setLatLng: (latlng: [number, number]) => LeafletCircleMarker;
		setRadius: (radius: number) => LeafletCircleMarker;
		bindPopup: (content: string, options?: Record<string, unknown>) => LeafletCircleMarker;
		openPopup: () => LeafletCircleMarker;
		on: (event: string, handler: (e: LeafletEvent) => void) => LeafletCircleMarker;
		remove: () => void;
		setStyle: (style: Record<string, unknown>) => LeafletCircleMarker;
		getPopup: () => LeafletPopup | null;
		isPopupOpen?: () => boolean;
		setPopupContent?: (content: string) => LeafletCircleMarker;
	}

	interface LeafletLayer {
		addTo: (map: LeafletMap) => LeafletLayer;
		remove: () => void;
	}

	interface LeafletEvent {
		latlng: {
			lat: number;
			lng: number;
		};
		originalEvent?: Event;
	}

	interface LeafletPopup {
		setContent: (content: string) => LeafletPopup;
		setLatLng: (latlng: [number, number]) => LeafletPopup;
		openOn: (map: LeafletMap) => LeafletPopup;
	}

	let L: LeafletLibrary;

	// Simple signal interface
	interface SimplifiedSignal {
		id: string;
		frequency: number; // MHz
		power: number; // dBm
		timestamp: number;
		persistence: number; // seconds detected
		position: {
			lat: number;
			lon: number;
		};
		_clearTimeout?: NodeJS.Timeout;
	}

	// Component state
	let map: LeafletMap | null = null;
	let mapContainer: HTMLDivElement;
	let searchFrequencies = ['', '', ''];
	let targetFrequency = 0;
	let isSearching = false;
	let kismetWhitelistMAC = '';
	let connectionStatus = 'Disconnected';
	let signalCount = 0;
	let currentSignal: SimplifiedSignal | null = null;

	// GPS position and status
	let userPosition = {
		lat: 0,
		lon: 0
	};
	let hasGPSFix = false;
	let userMarker: LeafletMarker | null = null;
	let accuracyCircle: LeafletCircle | null = null;
	let gpsStatus = 'Requesting GPS...';
	let accuracy = 0;
	let satellites = 0;
	let fixType = 'No';
	let positionInterval: NodeJS.Timeout | null = null;
	let currentCountry = { name: 'Unknown', flag: '🌍' };
	let formattedCoords = { lat: '0.000000°N', lon: '0.000000°E' };
	let mgrsCoord = 'Invalid';

	// System info for Pi popup
	let systemInfo: SystemInfo | null = null;
	let _systemInfoInterval: NodeJS.Timeout | null = null;

	// Signal storage
	const signals = new Map<string, SimplifiedSignal>();
	const signalMarkers = new Map<string, LeafletCircleMarker>();
	const aggregator = new SignalAggregator();

	// Kismet device storage
	const kismetDevices = new Map<string, KismetDevice>();
	const kismetMarkers = new Map<string, LeafletMarker>();
	let kismetInterval: NodeJS.Timeout | null = null;
	let kismetDeviceCount = 0; // Reactive counter for Kismet devices
	let whitelistedMACs = new Set<string>(); // Store whitelisted MAC addresses
	let whitelistedDeviceCount = 0; // Reactive counter for whitelisted devices

	// Device table sorting state (Plan 6)
	let sortColumn: 'mac' | 'rssi' | 'type' = 'rssi';
	let sortDirection: 'asc' | 'desc' = 'desc';
	let selectedDeviceKey: string | null = null;

	// Sidebar collapse state (Plan 7)
	let sidebarCollapsed = false;

	// Auto-collapse sidebar on small screens (Plan 7)
	$: if (browser && typeof window !== 'undefined') {
		if (window.innerWidth < 1200 && !sidebarCollapsed) {
			sidebarCollapsed = true;
		}
	}

	// Signal legend filter state
	let hiddenSignalBands = new Set<string>();

	const signalBands = [
		{
			key: 'red',
			color: '#dc2626',
			label: '> -50 dBm (Very Strong)',
			min: -50
		},
		{
			key: 'orange',
			color: '#f97316',
			label: '-50 to -60 dBm (Strong)',
			min: -60
		},
		{
			key: 'yellow',
			color: '#fbbf24',
			label: '-60 to -70 dBm (Good)',
			min: -70
		},
		{
			key: 'green',
			color: '#4ade80',
			label: '-70 to -80 dBm (Fair)',
			min: -80
		},
		{
			key: 'blue',
			color: '#4a90e2',
			label: '< -80 dBm (Weak)',
			min: -Infinity
		}
	];

	function getSignalBandKey(rssi: number): string {
		if (rssi > -50) return 'red';
		if (rssi > -60) return 'orange';
		if (rssi > -70) return 'yellow';
		if (rssi > -80) return 'green';
		return 'blue';
	}

	function formatDeviceLastSeen(device: KismetDevice): string {
		const ts = device.last_seen || device.last_time || 0;
		const msTs = ts > 1e12 ? ts : ts * 1000;
		const secs = Math.floor((Date.now() - msTs) / 1000);
		if (secs < 5) return 'Just now';
		if (secs < 60) return `${secs}s ago`;
		if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
		return `${Math.floor(secs / 3600)}h ago`;
	}

	function toggleSignalBand(key: string): void {
		if (hiddenSignalBands.has(key)) {
			hiddenSignalBands.delete(key);
		} else {
			hiddenSignalBands.add(key);
		}
		hiddenSignalBands = new Set(hiddenSignalBands); // trigger reactivity
		applySignalBandFilter();
	}

	// Computed sorted and filtered device list (Plan 6)
	$: sortedVisibleDevices = Array.from(kismetDevices.values())
		.filter((device) => {
			// Filter out devices whose signal band is hidden
			const rssi = device.signal?.last_signal || -100;
			const band = getSignalBandKey(rssi);
			return !hiddenSignalBands.has(band);
		})
		.sort((a, b) => {
			let comparison = 0;

			if (sortColumn === 'mac') {
				// Sort by MAC address alphabetically
				const macA = a.mac || '';
				const macB = b.mac || '';
				comparison = macA.localeCompare(macB);
			} else if (sortColumn === 'rssi') {
				// Sort by signal strength
				const rssiA = a.signal?.last_signal || -100;
				const rssiB = b.signal?.last_signal || -100;
				comparison = rssiB - rssiA; // Stronger signals first (less negative)
			} else if (sortColumn === 'type') {
				// Sort by device type
				const typeA = a.type || 'unknown';
				const typeB = b.type || 'unknown';
				// Priority: ap > client > unknown
				const typeOrder: Record<string, number> = { ap: 0, client: 1, unknown: 2 };
				comparison = (typeOrder[typeA] || 2) - (typeOrder[typeB] || 2);
			}

			return sortDirection === 'asc' ? comparison : -comparison;
		});

	function applySignalBandFilter(): void {
		kismetMarkers.forEach((marker, markerId) => {
			const device = kismetDevices.get(markerId);
			if (!device) return;
			const band = getSignalBandKey(device.signal?.last_signal || -100);
			if (hiddenSignalBands.has(band)) {
				marker.setOpacity(0);
				if (marker.getPopup && marker.isPopupOpen()) {
					marker.closePopup();
				}
			} else {
				const lastSeenTs = device.last_seen || device.last_time || 0;
				const lastSeenMs = lastSeenTs > 1e12 ? lastSeenTs : lastSeenTs * 1000;
				const ageSecs = (Date.now() - lastSeenMs) / 1000;
				marker.setOpacity(ageSecs < 60 ? 1.0 : Math.max(0.3, 1.0 - (ageSecs - 60) / 300));
			}
		});
	}

	// Kismet Dashboard state
	let showKismetDashboard = false;

	// AirSignal Overlay state
	let showAirSignalOverlay = false;

	// Bettercap Overlay state
	let showBettercapOverlay = false;

	// BTLE Overlay state
	let showBtleOverlay = false;

	// Function to persist dashboard state
	function setDashboardState(isOpen: boolean) {
		showKismetDashboard = isOpen;
		if (browser) {
			sessionStorage.setItem('kismetDashboardOpen', String(isOpen));
		}
	}

	// Function to persist AirSignal overlay state
	function setAirSignalOverlayState(isOpen: boolean) {
		showAirSignalOverlay = isOpen;
		if (browser) {
			sessionStorage.setItem('airSignalOverlayOpen', String(isOpen));
		}
	}

	// Function to persist Bettercap overlay state
	function setBettercapOverlayState(isOpen: boolean) {
		showBettercapOverlay = isOpen;
		if (browser) {
			sessionStorage.setItem('bettercapOverlayOpen', String(isOpen));
		}
	}

	// Function to persist BTLE overlay state
	function setBtleOverlayState(isOpen: boolean) {
		showBtleOverlay = isOpen;
		if (browser) {
			sessionStorage.setItem('btleOverlayOpen', String(isOpen));
		}
	}

	// Signal strength distribution
	let signalDistribution = {
		veryStrong: 0, // > -50 dBm
		strong: 0, // -50 to -60 dBm
		good: 0, // -60 to -70 dBm
		fair: 0, // -70 to -80 dBm
		weak: 0 // < -80 dBm
	};

	// Device type distribution
	let deviceTypeDistribution = {
		ap: 0,
		client: 0,
		unknown: 0
	};

	// Cell tower state
	const cellTowers = new Map<string, any>();
	const cellTowerMarkers = new Map<string, LeafletMarker>();
	let _cellTowerCount = 0;
	let showCellTowers = false;
	let cellTowerInterval: NodeJS.Timeout | null = null;

	// Subscriptions
	let spectrumUnsubscribe: (() => void) | null = null;
	let updateInterval: NodeJS.Timeout | null = null;

	// Constants
	const _MAX_SIGNALS_PER_FREQUENCY = 1; // Maximum 1 signal per unique frequency
	const UPDATE_RATE = 500; // 2Hz update rate

	// Initialize map
	function initializeMap() {
		if (!mapContainer || map || !hasGPSFix || !L) return;

		map = L.map(mapContainer).setView([userPosition.lat, userPosition.lon], 15);

		// Add map tiles
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '', // Remove attribution text
			maxZoom: 18
		}).addTo(map);

		// Remove Leaflet attribution control
		map.attributionControl.setPrefix('');
	}

	// Handle frequency search
	function handleSearch() {
		// Get all valid frequencies
		const validFreqs = searchFrequencies
			.map((f) => parseFloat(f))
			.filter((f) => !isNaN(f) && f > 0);

		if (validFreqs.length === 0) {
			alert('Please enter at least one valid frequency in MHz');
			return;
		}

		// For now, search the first valid frequency
		// TODO: Implement multi-frequency search
		targetFrequency = validFreqs[0];
		isSearching = true;

		// Clear existing signals but preserve targetFrequency display
		clearSignals();
	}

	// Add MAC to whitelist
	function addToWhitelist() {
		if (kismetWhitelistMAC.trim()) {
			const mac = kismetWhitelistMAC.trim().toUpperCase();
			whitelistedMACs.add(mac);
			whitelistedDeviceCount = whitelistedMACs.size;
			kismetWhitelistMAC = '';
		}
	}

	// Handle device table sorting (Plan 6)
	function handleSort(column: 'mac' | 'rssi' | 'type') {
		if (sortColumn === column) {
			// Toggle direction if same column
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			// New column, default to descending
			sortColumn = column;
			sortDirection = 'desc';
		}
	}

	// Handle device table row click (Plan 6)
	function handleDeviceRowClick(device: KismetDevice) {
		// Set selected device
		selectedDeviceKey = device.mac || null;

		// Get the marker for this device
		const marker = kismetMarkers.get(device.mac || '');
		if (marker && map) {
			// Center map on marker
			const lat = device.location?.lat || 0;
			const lon = device.location?.lon || 0;

			if (lat !== 0 && lon !== 0) {
				map.flyTo([lat, lon], 18);
				marker.openPopup();
			}
		}
	}

	// Open spectrum analyzer
	async function openSpectrumAnalyzer() {
		// Stop the HackRF sweep if it's running
		if (isSearching) {
			// Stop HackRF sweep through API
			try {
				await fetch('/api/hackrf/stop-sweep', { method: 'POST' });
			} catch (error) {
				console.error('Error stopping HackRF sweep:', error);
			}
			isSearching = false;
		}

		// Navigate to spectrum analyzer
		window.location.href = '/viewspectrum';
	}

	// Clear all signals
	function clearSignals() {
		signalMarkers.forEach((marker) => {
			map?.removeLayer(marker);
		});
		signalMarkers.clear();
		signals.clear();
		signalCount = 0;
		// Don't clear currentSignal immediately - let processSignals handle it
		aggregator.flush(); // Clear the aggregator buffer

		// Clear Kismet devices
		kismetMarkers.forEach((marker) => {
			map?.removeLayer(marker);
		});
		kismetMarkers.clear();
		kismetDevices.clear();
		kismetDeviceCount = 0;

		// Reset distributions
		signalDistribution = {
			veryStrong: 0,
			strong: 0,
			good: 0,
			fair: 0,
			weak: 0
		};
		deviceTypeDistribution = {
			ap: 0,
			client: 0,
			unknown: 0
		};

		// Clear whitelist
		whitelistedMACs.clear();
		whitelistedDeviceCount = 0;

		// Clear cell towers
		cellTowerMarkers.forEach((marker) => {
			map?.removeLayer(marker);
		});
		cellTowerMarkers.clear();
		cellTowers.clear();
		_cellTowerCount = 0;
	}

	// Get carrier name from MCC-MNC
	function getMncCarrier(mccMnc: string): string {
		const mncToCarrier: { [key: string]: string } = {
			// USA (310)
			'310-410': 'AT&T',
			'310-260': 'T-Mobile',
			'310-004': 'Verizon',
			// Germany (262)
			'262-01': 'T-Mobile',
			'262-02': 'Vodafone',
			'262-03': 'O2'
			// Add more mappings as needed
		};

		return mncToCarrier[mccMnc] || 'Unknown';
	}

	// Fetch cell towers from GSM Evil
	async function fetchCellTowers() {
		try {
			// Import gsmEvilStore to access tower data
			const { gsmEvilStore } = await import('$lib/stores/gsmEvilStore');

			// Get current store state
			let storeState: any;
			const unsubscribe = gsmEvilStore.subscribe((state) => {
				storeState = state;
			});

			// Process captured IMSIs and their tower locations
			if (storeState && storeState.capturedIMSIs) {
				const processedTowers = new Set<string>();

				for (const imsi of storeState.capturedIMSIs) {
					if (imsi.mcc && imsi.mnc && imsi.lac && imsi.ci) {
						const towerId = `${imsi.mcc}-${imsi.mnc}-${imsi.lac}-${imsi.ci}`;

						// Skip if already processed
						if (processedTowers.has(towerId)) continue;
						processedTowers.add(towerId);

						// Check if we have location data for this tower
						const towerLocationKey = `${imsi.mcc}-${imsi.mnc.toString().padStart(2, '0')}-${imsi.lac}-${imsi.ci}`;
						const location = storeState.towerLocations[towerLocationKey];

						if (location && location.lat && location.lon) {
							// Get carrier name from MNC mapping
							const mccMnc = `${imsi.mcc}-${imsi.mnc.toString().padStart(2, '0')}`;
							const carrier = getMncCarrier(mccMnc) || 'Unknown Carrier';

							const towerData = {
								mcc: imsi.mcc,
								mnc: imsi.mnc,
								lac: imsi.lac,
								ci: imsi.ci,
								lat: location.lat,
								lon: location.lon,
								carrier: carrier,
								radio: location.radio || 'GSM',
								range: location.range,
								samples: location.samples || 1
							};

							await addCellTower(towerData);
						}
					}
				}
			}

			unsubscribe();
		} catch (error) {
			console.error('Error fetching cell towers from GSM Evil:', error);
		}
	}

	// Add cell tower to map
	async function addCellTower(tower: any) {
		const towerId = `${tower.mcc}-${tower.mnc}-${tower.lac}-${tower.ci}`;

		// Skip if already displayed
		if (cellTowers.has(towerId)) return;

		// Check if tower has location data
		if (tower.lat && tower.lon) {
			try {
				const location = {
					lat: tower.lat,
					lon: tower.lon,
					range: tower.range || null,
					carrier: tower.carrier || 'Unknown Carrier'
				};

				// Determine tower status
				let status = 'ok';
				let iconColor = '#10b981'; // Green

				if (tower.mcc === '000' || tower.mcc === '001' || tower.mcc === '999') {
					status = 'fake';
					iconColor = '#dc2626'; // Dark red
				} else if (tower.radio === 'UMTS' || tower.radio === 'LTE') {
					status = 'modern';
					iconColor = '#3b82f6'; // Blue
				} else if (!location.carrier || location.carrier === 'Unknown Carrier') {
					status = 'unknown';
					iconColor = '#f59e0b'; // Orange
				}

				// Create tower icon with 🗼 emoji
				const towerIcon = L.divIcon({
					className: 'cell-tower-marker',
					html: `
							<div style="position: relative; width: 40px; height: 40px; text-align: center;">
								<div style="font-size: 30px; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));">🗼</div>
								${status === 'fake' ? '<div style="position: absolute; top: -5px; right: -5px; font-size: 16px;">⚠️</div>' : ''}
							</div>
						`,
					iconSize: [40, 40],
					iconAnchor: [20, 20]
				});

				// Create marker
				const marker = L.marker([location.lat, location.lon], {
					icon: towerIcon
				});

				// Add popup with tower info
				const gridRef = latLonToMGRS(location.lat, location.lon);
				const popupContent = `
						<div style="font-family: sans-serif; min-width: 300px;">
							<h4 style="margin: 0 0 8px 0; color: ${iconColor}">
								🗼 Cell Tower
							</h4>
							<table style="width: 100%; border-collapse: collapse;">
								<tr>
									<td style="padding: 4px 8px 4px 0; font-weight: bold;">Carrier:</td>
									<td style="padding: 4px 0;">${location.carrier || 'Unknown'}</td>
								</tr>
								<tr>
									<td style="padding: 4px 8px 4px 0; font-weight: bold;">MCC-MNC:</td>
									<td style="padding: 4px 0;">${tower.mcc}-${tower.mnc}</td>
								</tr>
								<tr>
									<td style="padding: 4px 8px 4px 0; font-weight: bold;">LAC/CI:</td>
									<td style="padding: 4px 0;">${tower.lac}/${tower.ci}</td>
								</tr>
								<tr>
									<td style="padding: 4px 8px 4px 0; font-weight: bold;">Location:</td>
									<td style="padding: 4px 0;">${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}</td>
								</tr>
								<tr>
									<td style="padding: 4px 8px 4px 0; font-weight: bold;">Grid Ref:</td>
									<td style="padding: 4px 0; font-family: monospace;">${gridRef}</td>
								</tr>
								<tr>
									<td style="padding: 4px 8px 4px 0; font-weight: bold;">Radio:</td>
									<td style="padding: 4px 0;">${tower.radio || 'GSM'}</td>
								</tr>
								<tr>
									<td style="padding: 4px 8px 4px 0; font-weight: bold;">Status:</td>
									<td style="padding: 4px 0; color: ${iconColor}">${status.toUpperCase()}</td>
								</tr>
								${
									location.range
										? `
								<tr>
									<td style="padding: 4px 8px 4px 0; font-weight: bold;">Range:</td>
									<td style="padding: 4px 0;">${location.range}m</td>
								</tr>
								`
										: ''
								}
								${
									tower.samples
										? `
								<tr>
									<td style="padding: 4px 8px 4px 0; font-weight: bold;">Samples:</td>
									<td style="padding: 4px 0;">${tower.samples}</td>
								</tr>
								`
										: ''
								}
							</table>
						</div>
					`;

				marker.bindPopup(popupContent, {
					maxWidth: 300,
					className:
						status === 'fake' || status === 'suspicious' ? 'signal-popup' : 'pi-popup'
				});

				if (map && showCellTowers) {
					marker.addTo(map);
				}

				cellTowerMarkers.set(towerId, marker);
				cellTowers.set(towerId, { ...tower, location, status });
				_cellTowerCount = cellTowers.size;
			} catch (error) {
				console.error('Error adding tower to map:', error);
			}
		}
	}

	// Toggle cell tower display
	function toggleCellTowers() {
		showCellTowers = !showCellTowers;

		if (showCellTowers) {
			// Show all cell tower markers
			cellTowerMarkers.forEach((marker) => {
				if (map) marker.addTo(map);
			});
			// Start fetching cell towers
			fetchCellTowers();
			if (!cellTowerInterval) {
				cellTowerInterval = setInterval(fetchCellTowers, 30000); // Update every 30 seconds
			}
		} else {
			// Hide all cell tower markers
			cellTowerMarkers.forEach((marker) => {
				map?.removeLayer(marker);
			});
			// Stop fetching
			if (cellTowerInterval) {
				clearInterval(cellTowerInterval);
				cellTowerInterval = null;
			}
		}
	}

	// Get signal color based on power
	function getSignalColor(power: number): string {
		// Note: Higher dBm (closer to 0) = stronger signal
		if (power > -50) return '#dc2626'; // Red (very strong)
		if (power > -60) return '#f97316'; // Orange (strong)
		if (power > -70) return '#fbbf24'; // Yellow (good)
		if (power > -80) return '#4ade80'; // Green (fair)
		return '#4a90e2'; // Blue (weak)
	}

	// Update signal and device type distributions
	function updateDistributions() {
		// Reset distributions
		signalDistribution = {
			veryStrong: 0,
			strong: 0,
			good: 0,
			fair: 0,
			weak: 0
		};

		deviceTypeDistribution = {
			ap: 0,
			client: 0,
			unknown: 0
		};

		// Count devices by signal strength and type
		kismetDevices.forEach((device) => {
			// Signal strength distribution
			const signalStrength = device.signal?.last_signal || -100;
			if (signalStrength > -50) signalDistribution.veryStrong++;
			else if (signalStrength > -60) signalDistribution.strong++;
			else if (signalStrength > -70) signalDistribution.good++;
			else if (signalStrength > -80) signalDistribution.fair++;
			else signalDistribution.weak++;

			// Device type distribution
			const type = device.type?.toLowerCase() || '';
			const manufacturer = device.manufacturer?.toLowerCase() || '';

			if (
				type.includes('ap') ||
				type.includes('access') ||
				manufacturer.includes('arris') ||
				manufacturer.includes('router') ||
				manufacturer.includes('gateway')
			) {
				deviceTypeDistribution.ap++;
			} else if (
				type.includes('client') ||
				type.includes('mobile') ||
				manufacturer.includes('phone') ||
				manufacturer.includes('smartphone') ||
				manufacturer.includes('android') ||
				manufacturer.includes('iphone')
			) {
				deviceTypeDistribution.client++;
			} else {
				deviceTypeDistribution.unknown++;
			}
		});
	}

	// Fetch system information
	async function fetchSystemInfo() {
		try {
			// Add timeout to the fetch
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

			const response = await fetch('/api/system/info', {
				signal: controller.signal,
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json'
				}
			});

			clearTimeout(timeoutId);

			if (response.ok) {
				const responseText = await response.text();

				try {
					systemInfo = JSON.parse(responseText) as SystemInfo;
				} catch (parseError) {
					console.error('Failed to parse JSON response:', parseError);
					console.error('Response text was:', responseText);
				}
			} else {
				const errorText = await response.text();
				console.error('System info response not ok:', response.status, errorText);
			}
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				console.error('System info fetch timed out after 10 seconds');
			} else {
				console.error('Error fetching system info:', error);
			}
		}
	}

	// Show Pi popup with system information
	async function showPiPopup() {
		if (!userMarker) {
			console.error('No user marker available for popup');
			return;
		}

		// Show loading message first
		const loadingPopup = L.popup({
			maxWidth: 300,
			className: 'pi-popup',
			autoClose: false,
			closeOnClick: false
		}).setContent('<div style="padding: 10px; color: #fff;">Loading system info...</div>');

		userMarker.bindPopup(loadingPopup).openPopup();

		// Fetch latest system info
		await fetchSystemInfo();

		if (!systemInfo) {
			console.error('No system info available after fetch');
			const errorPopup = L.popup({
				maxWidth: 300,
				className: 'pi-popup',
				autoClose: false,
				closeOnClick: false
			}).setContent(`
				<div style="padding: 10px; color: #f87171;">
					<h4>Failed to load system info</h4>
					<p>Check the browser console for error details.</p>
					<p>API might be unreachable or returning invalid data.</p>
				</div>
			`);

			userMarker.bindPopup(errorPopup).openPopup();
			return;
		}

		// Format uptime
		const hours = Math.floor(systemInfo.uptime / 3600);
		const minutes = Math.floor((systemInfo.uptime % 3600) / 60);
		const uptimeStr = `${hours}h ${minutes}m`;

		// Format storage sizes
		const formatBytes = (bytes: number) => {
			const gb = bytes / (1024 * 1024 * 1024);
			return gb.toFixed(1) + ' GB';
		};

		// Build WiFi interfaces list
		let wifiInterfacesHtml = '';
		const wifiInterfaces = systemInfo.wifiInterfaces || [];
		if (wifiInterfaces.length > 0) {
			wifiInterfacesHtml = wifiInterfaces
				.map(
					(iface) => `
        <tr>
          <td style="padding: 4px 8px 4px 0; font-weight: bold;">${iface.name}:</td>
          <td style="padding: 4px 0; font-family: monospace;">${iface.ip || 'N/A'}</td>
        </tr>
      `
				)
				.join('');
		}

		const popupContent = `
      <div style="font-family: sans-serif; min-width: 250px;">
        <h4 style="margin: 0 0 8px 0; color: #3b82f6;">
          Raspberry Pi System Info
        </h4>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 8px 4px 0; font-weight: bold;">Position:</td>
            <td style="padding: 4px 0;">${formattedCoords.lat}, ${formattedCoords.lon}</td>
          </tr>
          <tr>
            <td style="padding: 4px 8px 4px 0; font-weight: bold;">MGRS:</td>
            <td style="padding: 4px 0; font-family: monospace; color: #fbbf24;">${mgrsCoord}</td>
          </tr>
          <tr>
            <td style="padding: 4px 8px 4px 0; font-weight: bold;">Hostname:</td>
            <td style="padding: 4px 0;">${systemInfo.hostname}</td>
          </tr>
          <tr>
            <td style="padding: 4px 8px 4px 0; font-weight: bold;">Primary IP:</td>
            <td style="padding: 4px 0; font-family: monospace;">${systemInfo.ip}</td>
          </tr>
          ${wifiInterfacesHtml}
          <tr>
            <td colspan="2" style="padding: 8px 0 4px 0; border-top: 1px solid #2c2f36;">
              <strong>System Resources:</strong>
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 8px 4px 0; font-weight: bold;">CPU:</td>
            <td style="padding: 4px 0;">
              <span style="color: ${systemInfo.cpu.usage > 80 ? '#f87171' : systemInfo.cpu.usage > 60 ? '#fbbf24' : '#4ade80'}">
                ${systemInfo.cpu.usage.toFixed(1)}%
              </span>
              (${systemInfo.cpu.cores} cores)
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 8px 4px 0; font-weight: bold;">Memory:</td>
            <td style="padding: 4px 0;">
              <span style="color: ${systemInfo.memory.percentage > 80 ? '#f87171' : systemInfo.memory.percentage > 60 ? '#fbbf24' : '#4ade80'}">
                ${systemInfo.memory.percentage.toFixed(1)}%
              </span>
              (${formatBytes(systemInfo.memory.used)} / ${formatBytes(systemInfo.memory.total)})
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 8px 4px 0; font-weight: bold;">Storage:</td>
            <td style="padding: 4px 0;">
              <span style="color: ${systemInfo.storage.percentage > 80 ? '#f87171' : systemInfo.storage.percentage > 60 ? '#fbbf24' : '#4ade80'}">
                ${systemInfo.storage.percentage}%
              </span>
              (${formatBytes(systemInfo.storage.used)} / ${formatBytes(systemInfo.storage.total)})
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 8px 4px 0; font-weight: bold;">Temperature:</td>
            <td style="padding: 4px 0;">
              ${
					systemInfo.temperature !== null
						? `<span style="color: ${systemInfo.temperature > 70 ? '#f87171' : systemInfo.temperature > 60 ? '#fbbf24' : '#4ade80'}">
                     ${systemInfo.temperature.toFixed(1)}°C
                   </span>`
						: '<span class="text-tertiary" style="">N/A</span>'
				}
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 8px 4px 0; font-weight: bold;">Uptime:</td>
            <td style="padding: 4px 0;">${uptimeStr}</td>
          </tr>
          ${
				systemInfo.battery
					? `
          <tr>
            <td style="padding: 4px 8px 4px 0; font-weight: bold;">Battery:</td>
            <td style="padding: 4px 0;">
              <span style="color: ${systemInfo.battery.level < 20 ? '#f87171' : systemInfo.battery.level < 50 ? '#fbbf24' : '#4ade80'}">
                ${systemInfo.battery.level}%
              </span>
              ${systemInfo.battery.charging ? '(Charging)' : ''}
            </td>
          </tr>
          `
					: ''
			}
        </table>
      </div>
    `;

		// Create and bind popup on demand
		const popup = L.popup({
			maxWidth: 300,
			className: 'pi-popup',
			autoClose: false,
			closeOnClick: false
		}).setContent(popupContent);

		userMarker.bindPopup(popup).openPopup();
	}

	// Get device icon SVG based on type - Enhanced with more device categories
	function getDeviceIconSVG(device: KismetDevice, color: string): string {
		const type = device.type?.toLowerCase() || '';
		const manufacturer = device.manufacturer?.toLowerCase() || '';
		const _mac = device.mac?.toLowerCase() || '';

		// Router/Access Point/Infrastructure
		if (
			type.includes('ap') ||
			type.includes('access') ||
			manufacturer.includes('arris') ||
			manufacturer.includes('router') ||
			manufacturer.includes('gateway') ||
			manufacturer.includes('netgear') ||
			manufacturer.includes('linksys') ||
			manufacturer.includes('tp-link') ||
			manufacturer.includes('cisco') ||
			manufacturer.includes('ubiquiti')
		) {
			return `
        <svg width="40" height="40" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="20" width="10" height="4" fill="${color}" stroke="#fff" stroke-width="0.5"/>
          <rect x="13" y="18" width="4" height="2" fill="${color}"/>
          <line x1="15" y1="18" x2="15" y2="12" stroke="${color}" stroke-width="2"/>
          <path d="M10 14 Q15 10 20 14" stroke="${color}" stroke-width="1.5" fill="none"/>
          <path d="M8 16 Q15 8 22 16" stroke="${color}" stroke-width="1" fill="none" opacity="0.6"/>
        </svg>`;
		}

		// Smartphone (Apple/Android)
		if (
			(manufacturer.includes('apple') &&
				(manufacturer.includes('iphone') || type.includes('phone'))) ||
			(manufacturer.includes('samsung') && type.includes('phone')) ||
			manufacturer.includes('android') ||
			type.includes('mobile') ||
			type.includes('phone')
		) {
			return `
        <svg width="40" height="40" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
          <rect x="11" y="6" width="8" height="18" rx="2" fill="${color}" stroke="#fff" stroke-width="1"/>
          <rect x="12" y="8" width="6" height="12" fill="#fff" opacity="0.3"/>
          <circle cx="15" cy="22" r="1" fill="#fff"/>
          <rect x="13" y="7" width="4" height="0.5" fill="#fff" opacity="0.5"/>
        </svg>`;
		}

		// Laptop/Computer
		if (
			manufacturer.includes('intel') ||
			manufacturer.includes('dell') ||
			(manufacturer.includes('hp') && !type.includes('printer')) ||
			manufacturer.includes('lenovo') ||
			manufacturer.includes('asus') ||
			manufacturer.includes('acer') ||
			(manufacturer.includes('apple') &&
				!manufacturer.includes('iphone') &&
				!manufacturer.includes('ipad')) ||
			type.includes('computer') ||
			type.includes('laptop')
		) {
			return `
        <svg width="40" height="40" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
          <rect x="8" y="12" width="14" height="10" rx="1" fill="${color}" stroke="#fff" stroke-width="1"/>
          <rect x="9" y="13" width="12" height="7" fill="#fff" opacity="0.3"/>
          <rect x="6" y="22" width="18" height="2" rx="1" fill="${color}" stroke="#fff" stroke-width="1"/>
          <circle cx="15" cy="23" r="0.5" fill="#fff"/>
        </svg>`;
		}

		// Tablet (iPad/Android tablets)
		if (
			manufacturer.includes('ipad') ||
			(manufacturer.includes('apple') && type.includes('tablet')) ||
			type.includes('tablet')
		) {
			return `
        <svg width="40" height="40" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
          <rect x="9" y="7" width="12" height="16" rx="2" fill="${color}" stroke="#fff" stroke-width="1"/>
          <rect x="10" y="9" width="10" height="12" fill="#fff" opacity="0.3"/>
          <circle cx="15" cy="8" r="0.5" fill="#fff"/>
          <circle cx="15" cy="22" r="1" fill="#fff"/>
        </svg>`;
		}

		// Smart TV/Media Device
		if (
			(manufacturer.includes('samsung') && type.includes('tv')) ||
			manufacturer.includes('lg') ||
			manufacturer.includes('roku') ||
			manufacturer.includes('chromecast') ||
			(manufacturer.includes('apple') && type.includes('tv')) ||
			type.includes('media') ||
			type.includes('streaming') ||
			type.includes('tv')
		) {
			return `
        <svg width="40" height="40" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" y="10" width="18" height="12" rx="1" fill="${color}" stroke="#fff" stroke-width="1"/>
          <rect x="7" y="11" width="16" height="8" fill="#fff" opacity="0.3"/>
          <rect x="13" y="22" width="4" height="2" fill="${color}"/>
          <rect x="10" y="24" width="10" height="1" fill="${color}"/>
        </svg>`;
		}

		// Gaming Console
		if (
			(manufacturer.includes('sony') &&
				(type.includes('playstation') || type.includes('gaming'))) ||
			(manufacturer.includes('microsoft') && type.includes('xbox')) ||
			manufacturer.includes('nintendo') ||
			type.includes('gaming') ||
			type.includes('console')
		) {
			return `
        <svg width="40" height="40" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
          <rect x="7" y="12" width="16" height="8" rx="2" fill="${color}" stroke="#fff" stroke-width="1"/>
          <circle cx="11" cy="16" r="1.5" fill="#fff"/>
          <circle cx="19" cy="16" r="1.5" fill="#fff"/>
          <rect x="14" y="14" width="2" height="4" fill="#fff"/>
          <rect x="13" y="15" width="4" height="2" fill="#fff"/>
        </svg>`;
		}

		// Smart Home/IoT Device
		if (
			manufacturer.includes('amazon') ||
			manufacturer.includes('google') ||
			manufacturer.includes('nest') ||
			manufacturer.includes('ring') ||
			manufacturer.includes('philips') ||
			manufacturer.includes('sonos') ||
			type.includes('iot') ||
			type.includes('smart')
		) {
			return `
        <svg width="40" height="40" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
          <circle cx="15" cy="15" r="8" fill="${color}" stroke="#fff" stroke-width="1"/>
          <circle cx="15" cy="15" r="4" fill="#fff" opacity="0.3"/>
          <circle cx="15" cy="15" r="2" fill="#fff"/>
          <circle cx="8" cy="10" r="1.5" fill="${color}" opacity="0.6"/>
          <circle cx="22" cy="10" r="1.5" fill="${color}" opacity="0.6"/>
          <circle cx="8" cy="20" r="1.5" fill="${color}" opacity="0.6"/>
          <circle cx="22" cy="20" r="1.5" fill="${color}" opacity="0.6"/>
        </svg>`;
		}

		// Printer
		if (
			(manufacturer.includes('hp') && type.includes('printer')) ||
			manufacturer.includes('canon') ||
			manufacturer.includes('epson') ||
			manufacturer.includes('brother') ||
			type.includes('printer')
		) {
			return `
        <svg width="40" height="40" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
          <rect x="8" y="12" width="14" height="8" rx="1" fill="${color}" stroke="#fff" stroke-width="1"/>
          <rect x="10" y="8" width="10" height="4" fill="${color}" stroke="#fff" stroke-width="1"/>
          <rect x="10" y="20" width="10" height="3" fill="${color}" stroke="#fff" stroke-width="1"/>
          <rect x="9" y="15" width="2" height="1" fill="#fff"/>
          <circle cx="23" cy="16" r="1" fill="#fff"/>
        </svg>`;
		}

		// Security Camera
		if (
			manufacturer.includes('ring') ||
			manufacturer.includes('arlo') ||
			(manufacturer.includes('nest') && type.includes('camera')) ||
			type.includes('camera') ||
			type.includes('security')
		) {
			return `
        <svg width="40" height="40" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
          <circle cx="15" cy="15" r="6" fill="${color}" stroke="#fff" stroke-width="1"/>
          <circle cx="15" cy="15" r="3" fill="#fff"/>
          <circle cx="15" cy="15" r="1.5" fill="${color}"/>
          <rect x="21" y="14" width="3" height="2" fill="${color}"/>
          <circle cx="18" cy="10" r="1" fill="${color}"/>
        </svg>`;
		}

		// Network Bridge/Switch
		if (type.includes('bridge') || type.includes('switch') || manufacturer.includes('switch')) {
			return `
        <svg width="40" height="40" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
          <rect x="7" y="13" width="16" height="6" rx="1" fill="${color}" stroke="#fff" stroke-width="1"/>
          <circle cx="10" cy="16" r="1" fill="#4ade80"/>
          <circle cx="13" cy="16" r="1" fill="#4ade80"/>
          <circle cx="16" cy="16" r="1" fill="#fbbf24"/>
          <circle cx="19" cy="16" r="1" fill="#dc2626"/>
          <rect x="22" y="15" width="2" height="2" fill="#fff"/>
        </svg>`;
		}

		// Generic Client Device
		if (type.includes('client')) {
			return `
        <svg width="40" height="40" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
          <rect x="11" y="8" width="8" height="14" rx="1" fill="none" stroke="${color}" stroke-width="2"/>
          <rect x="12.5" y="10" width="5" height="9" fill="${color}" opacity="0.3"/>
          <circle cx="15" cy="20.5" r="0.8" fill="${color}"/>
        </svg>`;
		}

		// Unknown device (skull icon for easy identification)
		return `
      <svg width="40" height="40" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
        <!-- Skull shape -->
        <path d="M15 4 C20 4 24 8 24 13 C24 16 23 18 21 19 L21 22 C21 23 20 24 19 24 L11 24 C10 24 9 23 9 22 L9 19 C7 18 6 16 6 13 C6 8 10 4 15 4 Z" fill="${color}" stroke="#fff" stroke-width="1"/>
        <!-- Eye sockets -->
        <circle cx="12" cy="12" r="2.5" fill="#000"/>
        <circle cx="18" cy="12" r="2.5" fill="#000"/>
        <!-- Glowing eyes -->
        <circle cx="12" cy="12" r="1" fill="#dc2626" opacity="0.8"/>
        <circle cx="18" cy="12" r="1" fill="#dc2626" opacity="0.8"/>
        <!-- Nasal cavity -->
        <path d="M15 14 L13 18 L17 18 Z" fill="#000"/>
        <!-- Teeth -->
        <rect x="13" y="20" width="1" height="2" fill="#fff"/>
        <rect x="15" y="19" width="1" height="3" fill="#fff"/>
        <rect x="17" y="20" width="1" height="2" fill="#fff"/>
        <!-- Warning triangle -->
        <path d="M15 25 L12 29 L18 29 Z" fill="#dc2626" opacity="0.6"/>
        <text x="15" y="28" text-anchor="middle" font-family="Arial" font-size="6" font-weight="bold" fill="#fff">!</text>
      </svg>`;
	}

	// Calculate signal position (spiral pattern)
	function calculateSignalPosition(
		signalStrength: number,
		index: number
	): { lat: number; lon: number } {
		// Position based on signal strength
		// Stronger = closer to center
		const distance = (100 + signalStrength) * 0.00001;
		const angle = index * 137.5 * (Math.PI / 180); // Golden angle

		return {
			lat: userPosition.lat + distance * Math.cos(angle),
			lon: userPosition.lon + distance * Math.sin(angle)
		};
	}

	// Get GPS position from gpsd
	async function updateGPSPosition() {
		try {
			const response = await fetch('/api/gps/position');
			const result = (await response.json()) as GPSApiResponse;

			if (result.success && result.data) {
				userPosition = {
					lat: result.data.latitude,
					lon: result.data.longitude
				};
				accuracy = result.data.accuracy || 0;
				satellites = result.data.satellites || 0;
				const fix = result.data.fix || 0;
				fixType = fix === 3 ? '3D' : fix === 2 ? '2D' : 'No';
				gpsStatus = `GPS: ${fixType} Fix (${satellites} sats)`;

				// Update country and formatted coordinates
				currentCountry = detectCountry(userPosition.lat, userPosition.lon);
				formattedCoords = formatCoordinates(userPosition.lat, userPosition.lon);

				// Update MGRS coordinates
				mgrsCoord = latLonToMGRS(userPosition.lat, userPosition.lon);

				// Set GPS fix flag and initialize map if needed
				if (!hasGPSFix && fix >= 2) {
					hasGPSFix = true;
					initializeMap();
				}

				// Update map and markers
				if (map && L) {
					// Update or create user marker
					if (userMarker) {
						userMarker.setLatLng([userPosition.lat, userPosition.lon]);
					} else {
						// Create user marker with American flag emoji
						const userIcon = L.divIcon({
							className: 'user-marker',
							html: '<div style="font-size: 36px; text-align: center; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5)); cursor: pointer; z-index: 1000;">🇺🇸</div>',
							iconSize: [40, 40],
							iconAnchor: [20, 20]
						});
						userMarker = L.marker([userPosition.lat, userPosition.lon], {
							icon: userIcon
						}).addTo(map);

						// Add click handler to user marker (remove popup binding that might interfere)
						userMarker.on('click', (e) => {
							e.originalEvent?.stopPropagation();
							void showPiPopup();
						});

						userMarker.on('dblclick', (e) => {
							e.originalEvent?.stopPropagation();
							void showPiPopup();
						});

						map.setView([userPosition.lat, userPosition.lon], 15);
					}

					// Update or create accuracy circle
					if (accuracyCircle) {
						accuracyCircle.setLatLng([userPosition.lat, userPosition.lon]);
						accuracyCircle.setRadius(accuracy);
					} else if (accuracy > 0) {
						accuracyCircle = L.circle([userPosition.lat, userPosition.lon], {
							radius: accuracy,
							color: '#3b82f6',
							fillColor: '#3b82f6',
							fillOpacity: 0.15,
							weight: 1
						}).addTo(map);
					}
				}
			} else {
				// Handle no GPS fix case with detailed information
				if (result.data) {
					const fix = result.data.fix || 0;
					const sats = result.data.satellites || 0;
					fixType = fix === 3 ? '3D' : fix === 2 ? '2D' : 'No';
					satellites = sats;
					accuracy = 0;

					if (sats > 0) {
						gpsStatus = `GPS: No Fix (${sats} sats visible)`;
					} else {
						gpsStatus = 'GPS: No Fix (searching satellites)';
					}
				} else {
					gpsStatus = 'GPS: No Fix';
				}

				// Clear GPS fix flag
				hasGPSFix = false;
			}
		} catch (error) {
			console.error('GPS fetch error:', error);
			gpsStatus = 'GPS: Error';
		}
	}

	// Connect to HackRF data stream
	function connectToHackRF() {
		// TODO: Add connection status logging
		hackrfAPI.connectToDataStream();

		// Subscribe to spectrum data
		spectrumUnsubscribe = spectrumData.subscribe((data) => {
			if (data && isSearching) {
				aggregator.addSpectrumData(data);
			}
		});

		connectionStatus = 'Connected';
	}

	// Disconnect from HackRF
	function disconnectFromHackRF() {
		// TODO: Add disconnection status logging
		hackrfAPI.disconnect();

		if (spectrumUnsubscribe) {
			spectrumUnsubscribe();
			spectrumUnsubscribe = null;
		}

		connectionStatus = 'Disconnected';
	}

	// Fetch Kismet devices
	async function fetchKismetDevices() {
		if (!map) return;

		// Debug: Always try to fetch devices if map is available
		// This bypasses the status check since Kismet might be running even if status is wrong

		try {
			const response = await fetch('/api/kismet/devices');
			if (response.ok) {
				const data = (await response.json()) as KismetDevicesResponse;

				// Debug: Log device count

				// Update or create markers for each device
				const devices = data.devices;
				let _devicesWithLocation = 0;
				let _devicesWithoutLocation = 0;
				let _markersCreated = 0;
				let _markersUpdated = 0;

				devices.forEach((device: KismetDevice) => {
					const markerId = `kismet_${device.mac}`;

					// Track location data
					if (device.location?.lat && device.location?.lon) {
						_devicesWithLocation++;
					} else {
						_devicesWithoutLocation++;
					}

					// Check if marker already exists
					let marker = kismetMarkers.get(markerId);

					if (!marker) {
						// Create new marker with device type icon
						const iconColor = getSignalColor(device.signal?.last_signal || -100);
						const deviceIconSVG = getDeviceIconSVG(device, iconColor);

						marker = L.marker(
							[
								device.location?.lat || userPosition.lat,
								device.location?.lon || userPosition.lon
							],
							{
								icon: L.divIcon({
									html: deviceIconSVG,
									iconSize: [40, 40],
									iconAnchor: [20, 20],
									className: 'kismet-marker'
								})
							}
						);

						// Create popup content
						const popupContent = `
              <div style="font-family: sans-serif; min-width: 200px;">
                <h4 style="margin: 0 0 8px 0; color: ${getSignalColor(device.signal?.last_signal || -100)}">
                  ${device.ssid || 'Kismet Device'}
                </h4>
                <table style="width: 100%; border-collapse: collapse;">
                  ${
						device.ssid
							? `
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">SSID:</td>
                    <td style="padding: 4px 0; font-weight: bold; color: #00ff88;">${device.ssid}</td>
                  </tr>
                  `
							: ''
					}
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">Type:</td>
                    <td style="padding: 4px 0;">${device.type || 'Unknown'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">MAC:</td>
                    <td style="padding: 4px 0; font-family: monospace;">${device.mac}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">Signal:</td>
                    <td style="padding: 4px 0; color: ${getSignalColor(device.signal?.last_signal || -100)}">
                      ${device.signal?.last_signal || -100} dBm
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">Est. Distance:</td>
                    <td style="padding: 4px 0; color: ${getSignalColor(device.signal?.last_signal || -100)}">
                      ${formatDistanceEstimate(estimateDistanceFromRSSI(device.signal?.last_signal || -100, device.frequency))}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">Channel:</td>
                    <td style="padding: 4px 0;">${device.channel || 'Unknown'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">Packets:</td>
                    <td style="padding: 4px 0;">${device.packets}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">Manufacturer:</td>
                    <td style="padding: 4px 0;">${device.manufacturer || 'Unknown'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">Last Seen:</td>
                    <td style="padding: 4px 0; color: #aaa;">${formatDeviceLastSeen(device)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">MGRS:</td>
                    <td style="padding: 4px 0; font-family: monospace; color: #fbbf24;">${latLonToMGRS(device.location?.lat || userPosition.lat, device.location?.lon || userPosition.lon)}</td>
                  </tr>
                </table>
              </div>
            `;

						marker.bindPopup(popupContent, {
							maxWidth: 300,
							className: 'signal-popup',
							autoClose: false,
							closeOnClick: false
						});

						marker.on('click', () => {
							if (marker) {
								marker.openPopup();
							}
						});

						if (map) {
							marker.addTo(map);
							_markersCreated++;
						}
						kismetMarkers.set(markerId, marker);
					} else {
						// Update existing marker
						const iconColor = getSignalColor(device.signal?.last_signal || -100);
						const deviceIconSVG = getDeviceIconSVG(device, iconColor);

						if (marker) {
							marker.setIcon(
								L.divIcon({
									html: deviceIconSVG,
									iconSize: [30, 30],
									iconAnchor: [15, 15],
									className: 'kismet-marker'
								})
							);
							_markersUpdated++;
						}

						// Update popup if needed
						const popupContent = `
              <div style="font-family: sans-serif; min-width: 200px;">
                <h4 style="margin: 0 0 8px 0; color: ${getSignalColor(device.signal?.last_signal || -100)}">
                  ${device.ssid || 'Kismet Device'}
                </h4>
                <table style="width: 100%; border-collapse: collapse;">
                  ${
						device.ssid
							? `
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">SSID:</td>
                    <td style="padding: 4px 0; font-weight: bold; color: #00ff88;">${device.ssid}</td>
                  </tr>
                  `
							: ''
					}
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">Type:</td>
                    <td style="padding: 4px 0;">${device.type || 'Unknown'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">MAC:</td>
                    <td style="padding: 4px 0; font-family: monospace;">${device.mac}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">Signal:</td>
                    <td style="padding: 4px 0; color: ${getSignalColor(device.signal?.last_signal || -100)}">
                      ${device.signal?.last_signal || -100} dBm
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">Est. Distance:</td>
                    <td style="padding: 4px 0; color: ${getSignalColor(device.signal?.last_signal || -100)}">
                      ${formatDistanceEstimate(estimateDistanceFromRSSI(device.signal?.last_signal || -100, device.frequency))}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">Channel:</td>
                    <td style="padding: 4px 0;">${device.channel || 'Unknown'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">Packets:</td>
                    <td style="padding: 4px 0;">${device.packets}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">Manufacturer:</td>
                    <td style="padding: 4px 0;">${device.manufacturer || 'Unknown'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">Last Seen:</td>
                    <td style="padding: 4px 0; color: #aaa;">${formatDeviceLastSeen(device)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">MGRS:</td>
                    <td style="padding: 4px 0; font-family: monospace; color: #fbbf24;">${latLonToMGRS(device.location?.lat || userPosition.lat, device.location?.lon || userPosition.lon)}</td>
                  </tr>
                </table>
              </div>
            `;

						if (marker.isPopupOpen()) {
							marker.setPopupContent(popupContent);
						} else {
							marker.getPopup().setContent(popupContent);
						}
					}

					// Store device data
					kismetDevices.set(markerId, device);

					// Apply signal band filter + age-based opacity
					const band = getSignalBandKey(device.signal?.last_signal || -100);
					const lastSeenTs = device.last_seen || device.last_time || 0;
					const lastSeenMs = lastSeenTs > 1e12 ? lastSeenTs : lastSeenTs * 1000;
					const ageSecs = (Date.now() - lastSeenMs) / 1000;
					const ageOpacity =
						ageSecs < 60 ? 1.0 : Math.max(0.3, 1.0 - (ageSecs - 60) / 300);

					if (hiddenSignalBands.has(band)) {
						marker.setOpacity(0);
					} else {
						marker.setOpacity(ageOpacity);
					}
				});

				// Clean up markers for devices that no longer exist
				let removedDevices = 0;
				kismetMarkers.forEach((marker, id) => {
					if (!data.devices.find((d: KismetDevice) => `kismet_${d.mac}` === id)) {
						if (map) {
							map.removeLayer(marker);
						}
						kismetMarkers.delete(id);
						kismetDevices.delete(id);
						removedDevices++;
					}
				});

				if (removedDevices > 0) {
					// Stale device markers already removed in loop above
				}

				// Update the reactive counter and distributions
				kismetDeviceCount = kismetDevices.size;
				updateDistributions();
			}
		} catch (error) {
			console.error('Error fetching Kismet devices:', error);
		}
	}

	// Process aggregated signals
	function processSignals() {
		if (!isSearching || !map) return;

		// Get aggregated signals matching target frequency
		const aggregatedSignals = aggregator.getAggregatedSignals(targetFrequency);

		// Group signals by frequency and keep only the strongest per frequency
		const frequencyMap = new Map<number, (typeof aggregatedSignals)[0]>();
		aggregatedSignals.forEach((signal) => {
			const existing = frequencyMap.get(signal.frequency);
			if (!existing || signal.power > existing.power) {
				frequencyMap.set(signal.frequency, signal);
			}
		});

		// Convert map to array and sort by power (strongest first)
		const uniqueFrequencySignals = Array.from(frequencyMap.values()).sort(
			(a, b) => b.power - a.power
		);

		// Keep track of which signals to keep
		const signalsToKeep = new Set<string>();

		// Process the strongest signal per unique frequency
		uniqueFrequencySignals.forEach((aggSignal, index) => {
			const signalId = `freq_${aggSignal.frequency}`;
			signalsToKeep.add(signalId);

			// Check if signal already exists
			let signal = signals.get(signalId);

			if (!signal) {
				// Create new signal
				const position = calculateSignalPosition(aggSignal.power, index);
				signal = {
					id: signalId,
					frequency: aggSignal.frequency,
					power: aggSignal.power,
					timestamp: aggSignal.lastSeen,
					persistence: aggregator.getSignalPersistence(aggSignal),
					position
				};
				signals.set(signalId, signal);

				// Create marker with popup
				const marker = L.circleMarker([position.lat, position.lon], {
					radius: 8 + (aggSignal.power + 100) / 10, // Size based on power
					fillColor: getSignalColor(aggSignal.power),
					color: '#ffffff',
					weight: 1,
					opacity: 1,
					fillOpacity: 0.8
				});

				// Bind popup with signal information
				const popupContent = `
          <div style="font-family: sans-serif; min-width: 200px;">
            <h4 style="margin: 0 0 8px 0; color: ${getSignalColor(aggSignal.power)}">
              Signal Details
            </h4>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 8px 4px 0; font-weight: bold;">Frequency:</td>
                <td style="padding: 4px 0;">${aggSignal.frequency.toFixed(2)} MHz</td>
              </tr>
              <tr>
                <td style="padding: 4px 8px 4px 0; font-weight: bold;">Power:</td>
                <td style="padding: 4px 0; color: ${getSignalColor(aggSignal.power)}">
                  ${aggSignal.power.toFixed(1)} dBm
                </td>
              </tr>
              <tr>
                <td style="padding: 4px 8px 4px 0; font-weight: bold;">Position:</td>
                <td style="padding: 4px 0;">
                  ${position.lat.toFixed(6)}, ${position.lon.toFixed(6)}
                </td>
              </tr>
              <tr>
                <td style="padding: 4px 8px 4px 0; font-weight: bold;">MGRS:</td>
                <td style="padding: 4px 0; font-family: monospace; color: #fbbf24;">
                  ${latLonToMGRS(position.lat, position.lon)}
                </td>
              </tr>
              <tr>
                <td style="padding: 4px 8px 4px 0; font-weight: bold;">Persistence:</td>
                <td style="padding: 4px 0;">${signal.persistence.toFixed(1)}s</td>
              </tr>
              <tr>
                <td style="padding: 4px 8px 4px 0; font-weight: bold;">Detections:</td>
                <td style="padding: 4px 0;">${aggSignal.count}</td>
              </tr>
            </table>
          </div>
        `;

				marker.bindPopup(popupContent, {
					maxWidth: 300,
					className: 'signal-popup',
					autoClose: false,
					closeOnClick: false,
					closeOnEscapeKey: false,
					autoPan: false,
					keepInView: false
				});

				// Add click handler to ensure popup stays open
				marker.on('click', () => {
					marker.openPopup();
				});

				if (map) {
					marker.addTo(map);
				}
				signalMarkers.set(signalId, marker);
			} else {
				// Update existing signal
				signal.power = aggSignal.power;
				signal.timestamp = aggSignal.lastSeen;
				signal.persistence = aggregator.getSignalPersistence(aggSignal);

				// Update marker and popup
				const marker = signalMarkers.get(signalId);
				if (marker) {
					marker.setStyle({
						fillColor: getSignalColor(aggSignal.power),
						radius: 8 + (aggSignal.power + 100) / 10
					});

					// Ensure popup has correct options
					if (!marker.getPopup()) {
						marker.bindPopup('', {
							maxWidth: 300,
							className: 'signal-popup',
							autoClose: false,
							closeOnClick: false,
							closeOnEscapeKey: false,
							autoPan: false,
							keepInView: false
						});
					}

					// Update popup content
					const popupContent = `
            <div style="font-family: sans-serif; min-width: 200px;">
              <h4 style="margin: 0 0 8px 0; color: ${getSignalColor(signal.power)}">
                Signal Details
              </h4>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 4px 8px 4px 0; font-weight: bold;">Frequency:</td>
                  <td style="padding: 4px 0;">${signal.frequency.toFixed(2)} MHz</td>
                </tr>
                <tr>
                  <td style="padding: 4px 8px 4px 0; font-weight: bold;">Power:</td>
                  <td style="padding: 4px 0; color: ${getSignalColor(signal.power)}">
                    ${signal.power.toFixed(1)} dBm
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 8px 4px 0; font-weight: bold;">Position:</td>
                  <td style="padding: 4px 0;">
                    ${signal.position.lat.toFixed(6)}, ${signal.position.lon.toFixed(6)}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 8px 4px 0; font-weight: bold;">MGRS:</td>
                  <td style="padding: 4px 0; font-family: monospace; color: #fbbf24;">
                    ${latLonToMGRS(signal.position.lat, signal.position.lon)}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 8px 4px 0; font-weight: bold;">Persistence:</td>
                  <td style="padding: 4px 0;">${signal.persistence.toFixed(1)}s</td>
                </tr>
                <tr>
                  <td style="padding: 4px 8px 4px 0; font-weight: bold;">Detections:</td>
                  <td style="padding: 4px 0;">${aggSignal.count}</td>
                </tr>
              </table>
            </div>
          `;

					// Only update popup content if it's currently open
					if (marker.isPopupOpen && marker.isPopupOpen()) {
						if (marker.setPopupContent) {
							marker.setPopupContent(popupContent);
						}
					} else {
						// Update the popup without opening it
						const popup = marker.getPopup();
						if (popup) {
							popup.setContent(popupContent);
						}
					}
				}
			}

			// Update current signal display with the strongest signal
			if (!currentSignal || signal.power > currentSignal.power) {
				currentSignal = signal;
			}
		});

		// Remove signals that are no longer being detected (not in signalsToKeep)
		signals.forEach((signal, id) => {
			if (!signalsToKeep.has(id)) {
				// Remove marker from map
				const marker = signalMarkers.get(id);
				if (marker) {
					marker.remove();
					signalMarkers.delete(id);
				}
				signals.delete(id);
			}
		});

		// Update signal count
		signalCount = signals.size;

		// Only clear currentSignal if no signals exist and we've been searching for a while
		// This prevents flickering when signals temporarily disappear
		if (signals.size === 0 && currentSignal) {
			// Give it a grace period before clearing the display
			if (!currentSignal._clearTimeout) {
				currentSignal._clearTimeout = setTimeout(() => {
					currentSignal = null;
				}, 2000); // 2 second grace period
			}
		} else if (signals.size > 0 && currentSignal?._clearTimeout) {
			// Cancel the clear timeout if signals are found again
			clearTimeout(currentSignal._clearTimeout);
			delete currentSignal._clearTimeout;
		}
	}

	// Kismet control functions
	async function checkKismetStatus() {
		try {
			// Use our API to check status
			const response = await fetch('/api/kismet/control', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ action: 'status' })
			});

			if (response.ok) {
				const data = (await response.json()) as { running: boolean };
				if (data.running && kismetStatus === 'stopped') {
					kismetStatus = 'running';
				} else if (!data.running && kismetStatus === 'running') {
					kismetStatus = 'stopped';
				}
			}
		} catch (error) {
			console.error('Error checking Kismet status:', error);
		}
	}

	async function startKismet() {
		if (kismetStatus === 'starting' || kismetStatus === 'stopping') return;

		kismetStatus = 'starting';

		try {
			// Use our own API to control Kismet
			const response = await fetch('/api/kismet/control', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ action: 'start' })
			});

			if (response.ok) {
				// Wait a bit for services to start
				setTimeout(() => {
					void checkKismetStatus();
					kismetStatus = 'running';
					// Start fetching devices immediately when service starts
					void fetchKismetDevices();
				}, 2000);
			} else {
				const errorText = await response.text();
				throw new Error(`Failed to start Kismet: ${errorText}`);
			}
		} catch (error: unknown) {
			console.error('Error starting Kismet:', error);
			kismetStatus = 'stopped';
		}
	}

	async function stopKismet() {
		if (kismetStatus === 'starting' || kismetStatus === 'stopping') return;

		kismetStatus = 'stopping';

		try {
			const response = await fetch('/api/kismet/control', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ action: 'stop' })
			});

			if (response.ok) {
				setTimeout(() => {
					kismetStatus = 'stopped';
					isSearching = false; // Stop HackRF signal processing
					clearSignals(); // Clear all devices and signals from the map
				}, 2000);
			} else {
				const data = (await response.json()) as { message?: string };
				throw new Error(data.message || 'Failed to stop Kismet');
			}
		} catch (error: unknown) {
			console.error('Error stopping Kismet:', error);
			kismetStatus = 'running';
		}
	}

	function _toggleKismet() {
		if (kismetStatus === 'running') {
			stopKismet().catch((error) => {
				console.error('Error stopping Kismet:', error);
			});
		} else if (kismetStatus === 'stopped') {
			startKismet().catch((error) => {
				console.error('Error starting Kismet:', error);
			});
		}
	}

	onMount(async () => {
		// Import Leaflet dynamically on client side
		const leafletModule = await import('leaflet');
		L = leafletModule.default as unknown as LeafletLibrary;
		await import('leaflet/dist/leaflet.css');

		// Restore dashboard state from sessionStorage
		const savedDashboardState = sessionStorage.getItem('kismetDashboardOpen');
		if (savedDashboardState === 'true') {
			showKismetDashboard = true;
		}

		// Restore AirSignal overlay state from sessionStorage
		const savedAirSignalState = sessionStorage.getItem('airSignalOverlayOpen');
		if (savedAirSignalState === 'true') {
			showAirSignalOverlay = true;
		}

		// Restore Bettercap overlay state from sessionStorage
		const savedBettercapState = sessionStorage.getItem('bettercapOverlayOpen');
		if (savedBettercapState === 'true') {
			showBettercapOverlay = true;
		}

		// Restore BTLE overlay state from sessionStorage
		const savedBtleState = sessionStorage.getItem('btleOverlayOpen');
		if (savedBtleState === 'true') {
			showBtleOverlay = true;
		}

		// Start GPS updates (map will initialize after GPS fix)
		void updateGPSPosition();
		positionInterval = setInterval(() => void updateGPSPosition(), 5000); // Update every 5 seconds

		connectToHackRF();

		// Start update interval
		updateInterval = setInterval(processSignals, UPDATE_RATE);

		// Set up Kismet device fetching interval (will only fetch when running)
		kismetInterval = setInterval(() => void fetchKismetDevices(), 10000);

		// Fetch devices immediately since we know Kismet is working
		setTimeout(() => void fetchKismetDevices(), 1000);

		// Check initial Kismet status immediately and more frequently at start
		checkKismetStatus().catch((error) => {
			console.error('Initial Kismet status check failed:', error);
			// If status check fails, assume running since devices endpoint works
			kismetStatus = 'running';
		});

		// Set up more frequent initial status checks, then slower periodic checks
		let initialCheckCount = 0;
		const initialCheckInterval = setInterval(() => {
			checkKismetStatus().catch((error) => {
				console.error('Initial Kismet status check failed:', error);
			});
			initialCheckCount++;
			if (initialCheckCount >= 3) {
				clearInterval(initialCheckInterval);
				// Set up slower periodic status checks
				statusCheckInterval = setInterval(() => {
					checkKismetStatus().catch((error) => {
						console.error('Periodic Kismet status check failed:', error);
					});
				}, 5000);
			}
		}, 1000);
	});

	onDestroy(() => {
		disconnectFromHackRF();

		if (updateInterval) {
			clearInterval(updateInterval);
			updateInterval = null;
		}

		if (positionInterval) {
			clearInterval(positionInterval);
			positionInterval = null;
		}

		if (kismetInterval) {
			clearInterval(kismetInterval);
			kismetInterval = null;
		}
		if (cellTowerInterval) {
			clearInterval(cellTowerInterval);
			cellTowerInterval = null;
		}

		if (statusCheckInterval) {
			clearInterval(statusCheckInterval);
		}

		if (map) {
			map.remove();
			map = null;
		}
	});
</script>

<div class="tactical-map-simple">
	<!-- Top Navigation Bar -->
	<header class="tactical-top-nav">
		<button class="back-console-button" onclick={() => (window.location.href = '/')}>
			<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
				<path
					fill-rule="evenodd"
					d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L4.414 9H17a1 1 0 110 2H4.414l5.293 5.293a1 1 0 010 1.414z"
				/>
			</svg>
			Back to Console
		</button>

		<button
			class="sidebar-toggle-btn"
			onclick={() => (sidebarCollapsed = !sidebarCollapsed)}
			aria-label="Toggle sidebar"
			aria-expanded={!sidebarCollapsed}
			title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
		>
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				{#if sidebarCollapsed}
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13 5l7 7-7 7M5 5l7 7-7 7"
					/>
				{:else}
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
					/>
				{/if}
			</svg>
		</button>

		<div class="status">
			<span class="status-item">
				<span class="text-primary">GPS:</span>
				{#if fixType !== 'No'}
					<span class="text-success" style="margin-left: 0.25rem;">{fixType} Fix</span>
					<span class="text-tertiary" style="margin-left: 0.25rem;"
						>({satellites} sats)</span
					>
					<span style="color: #e8eaed; margin-left: 0.5rem;">|</span>
					<span class="text-info" style="margin-left: 0.5rem;"
						>{formattedCoords.lat}, {formattedCoords.lon}</span
					>
					<span style="color: #e8eaed; margin-left: 0.5rem;">|</span>
					<span class="text-warning" style="margin-left: 0.5rem; font-family: monospace;"
						>{mgrsCoord}</span
					>
					<span style="font-size: 1.2em; margin-left: 0.5rem;">{currentCountry.flag}</span
					>
				{:else}
					<span class="text-error" style="margin-left: 0.25rem;">No Fix</span>
				{/if}
			</span>
		</div>
	</header>

	<!-- Main Content: Sidebar + Map -->
	<div class="tactical-main-content">
		<!-- Sidebar (empty for now - will be filled in Plans 3-6) -->
		<aside class="tactical-sidebar" class:collapsed={sidebarCollapsed}>
			<!-- Section 1: Kismet Control -->
			<div class="tactical-sidebar-section">
				<h3 class="section-header">KISMET CONTROL</h3>

				<div class="metric-row">
					<span class="metric-label">Status</span>
					{#if kismetStatus === 'running'}
						<span class="badge badge-success">Running</span>
					{:else if kismetStatus === 'stopped'}
						<span class="badge badge-neutral">Stopped</span>
					{:else if kismetStatus === 'starting'}
						<span class="badge badge-info">Starting...</span>
					{:else if kismetStatus === 'stopping'}
						<span class="badge badge-info">Stopping...</span>
					{/if}
				</div>

				<button
					class="btn btn-danger btn-full"
					onclick={stopKismet}
					disabled={kismetStatus === 'stopping' || kismetStatus === 'stopped'}
				>
					Stop Kismet Service
				</button>

				<button class="btn btn-secondary btn-full" onclick={() => setDashboardState(true)}>
					View Dashboard ({kismetDeviceCount})
				</button>
			</div>

			<!-- Section 2: RF Scan Control -->
			<div class="tactical-sidebar-section">
				<h3 class="section-header">RF SCAN CONTROL</h3>

				<div class="metric-row">
					<span class="metric-label">Device</span>
					<div style="display: flex; align-items: center; gap: var(--space-2);">
						{#if connectionStatus === 'Connected'}
							<span class="badge badge-success">Connected</span>
						{:else}
							<span class="badge badge-error">Disconnected</span>
						{/if}
						<span class="text-tertiary" style="font-size: var(--text-xs);">USRP</span>
					</div>
				</div>

				<label class="metric-label" style="margin-top: var(--space-2);">
					Target Frequencies (MHz)
				</label>

				<input
					type="number"
					class="input-field input-field-sm"
					bind:value={searchFrequencies[0]}
					placeholder="e.g., 2450.0"
					step="0.01"
					onkeydown={(e) => e.key === 'Enter' && handleSearch()}
				/>

				<input
					type="number"
					class="input-field input-field-sm"
					bind:value={searchFrequencies[1]}
					placeholder="e.g., 433.92"
					step="0.01"
					onkeydown={(e) => e.key === 'Enter' && handleSearch()}
				/>

				<input
					type="number"
					class="input-field input-field-sm"
					bind:value={searchFrequencies[2]}
					placeholder="e.g., 915.0"
					step="0.01"
					onkeydown={(e) => e.key === 'Enter' && handleSearch()}
				/>

				<button
					class="btn btn-primary btn-full"
					onclick={handleSearch}
					disabled={!searchFrequencies.some((f) => f)}
				>
					Search Frequencies
				</button>

				<button
					class="btn btn-secondary btn-full"
					onclick={clearSignals}
					disabled={signalCount === 0 && kismetDeviceCount === 0}
				>
					Clear All Signals
				</button>
			</div>

			<!-- Section 3: Quick Actions -->
			<div class="tactical-sidebar-section">
				<h3 class="section-header">QUICK ACTIONS</h3>

				<button class="btn btn-ghost btn-full" onclick={openSpectrumAnalyzer}>
					📊 View Spectrum Analyzer
				</button>

				<button
					class="btn btn-ghost btn-full"
					onclick={() => setAirSignalOverlayState(true)}
				>
					📡 AirSignal RF Tools
				</button>

				<button
					class="btn btn-ghost btn-full"
					onclick={() => setBettercapOverlayState(!showBettercapOverlay)}
				>
					🔧 Bettercap Controls
				</button>

				<button
					class="btn btn-ghost btn-full"
					onclick={() => setBtleOverlayState(!showBtleOverlay)}
				>
					📘 BTLE Scanner
				</button>

				<button class="btn btn-ghost btn-full" onclick={toggleCellTowers}>
					📍 {showCellTowers ? 'Hide' : 'Show'} Cell Towers
				</button>
			</div>

			<!-- Section 4: Device Data Table (Scrollable) -->
			<div class="tactical-sidebar-section tactical-sidebar-section-scrollable">
				<h3 class="section-header">DETECTED DEVICES ({kismetDeviceCount})</h3>

				<!-- Signal Filter Badges -->
				<div
					style="display: flex; flex-wrap: wrap; gap: var(--space-1); margin-bottom: var(--space-2);"
					role="group"
					aria-label="Signal strength filters"
				>
					<span class="metric-label" style="width: 100%;">Filter by Signal:</span>
					{#each signalBands as band}
						<button
							class="badge {hiddenSignalBands.has(band.key) ? 'badge-neutral' : ''}"
							style="
								{hiddenSignalBands.has(band.key)
								? ''
								: `
									background-color: ${band.color}20;
									color: ${band.color};
									border-color: ${band.color}40;
								`}
								cursor: pointer;
								opacity: {hiddenSignalBands.has(band.key) ? '0.5' : '1'};
							"
							role="switch"
							aria-checked={!hiddenSignalBands.has(band.key)}
							aria-label="Toggle {band.label} signal visibility"
							onclick={() => toggleSignalBand(band.key)}
						>
							{band.label.split(' ')[0]}
							{band.label.split(' ')[1]}
						</button>
					{/each}
				</div>

				<!-- Device Table -->
				{#if kismetStatus === 'starting'}
					<div
						style="padding: var(--space-4); text-align: center; color: var(--palantir-text-secondary);"
					>
						<p>Starting Kismet service...</p>
					</div>
				{:else if kismetDeviceCount === 0}
					<div
						style="padding: var(--space-4); text-align: center; color: var(--palantir-text-secondary);"
					>
						<p>No devices detected yet</p>
						<p style="font-size: var(--text-xs); margin-top: var(--space-2);">
							Ensure Kismet is monitoring the correct interface
						</p>
					</div>
				{:else if sortedVisibleDevices.length === 0}
					<div
						style="padding: var(--space-4); text-align: center; color: var(--palantir-text-secondary);"
					>
						<p>All devices hidden by signal filters</p>
						<p style="font-size: var(--text-xs); margin-top: var(--space-2);">
							Click filter badges to show devices
						</p>
					</div>
				{:else}
					<table
						class="data-table data-table-compact"
						role="grid"
						aria-label="Detected WiFi devices"
					>
						<thead>
							<tr>
								<th
									scope="col"
									role="button"
									tabindex="0"
									aria-sort={sortColumn === 'mac'
										? sortDirection === 'asc'
											? 'ascending'
											: 'descending'
										: 'none'}
									aria-label="Sort by MAC address"
									onclick={() => handleSort('mac')}
									onkeydown={(e) => e.key === 'Enter' && handleSort('mac')}
									style="cursor: pointer;"
								>
									MAC {sortColumn === 'mac'
										? sortDirection === 'asc'
											? '▲'
											: '▼'
										: ''}
								</th>
								<th
									scope="col"
									role="button"
									tabindex="0"
									aria-sort={sortColumn === 'rssi'
										? sortDirection === 'asc'
											? 'ascending'
											: 'descending'
										: 'none'}
									aria-label="Sort by signal strength"
									onclick={() => handleSort('rssi')}
									onkeydown={(e) => e.key === 'Enter' && handleSort('rssi')}
									style="cursor: pointer;"
								>
									RSSI {sortColumn === 'rssi'
										? sortDirection === 'asc'
											? '▲'
											: '▼'
										: ''}
								</th>
								<th
									scope="col"
									role="button"
									tabindex="0"
									aria-sort={sortColumn === 'type'
										? sortDirection === 'asc'
											? 'ascending'
											: 'descending'
										: 'none'}
									aria-label="Sort by device type"
									onclick={() => handleSort('type')}
									onkeydown={(e) => e.key === 'Enter' && handleSort('type')}
									style="cursor: pointer;"
								>
									Type {sortColumn === 'type'
										? sortDirection === 'asc'
											? '▲'
											: '▼'
										: ''}
								</th>
								<th scope="col" aria-label="Signal indicator"></th>
							</tr>
						</thead>
						<tbody>
							{#each sortedVisibleDevices as device (device.mac)}
								{@const rssi = device.signal?.last_signal || -100}
								{@const deviceType = device.type || 'unknown'}
								{@const macDisplay = (device.mac || '').slice(-8)}

								<tr
									data-device-key={device.mac}
									class:selected={selectedDeviceKey === device.mac}
									onclick={() => handleDeviceRowClick(device)}
									style="cursor: pointer;"
								>
									<td title={device.mac}>{macDisplay}</td>
									<td style="color: {getSignalColor(rssi)};">{rssi} dBm</td>
									<td>{deviceType}</td>
									<td>
										<span
											class="signal-indicator"
											style="background-color: {getSignalColor(rssi)};"
											aria-label="Signal strength indicator"
										></span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>

					<!-- Summary Stats -->
					<div
						style="padding: var(--space-2); border-top: 1px solid var(--palantir-border-subtle); font-size: var(--text-xs); color: var(--palantir-text-secondary);"
					>
						{#if deviceTypeDistribution.ap > 0}
							🛜 {deviceTypeDistribution.ap} APs •
						{/if}
						{#if deviceTypeDistribution.client > 0}
							📱 {deviceTypeDistribution.client} Clients •
						{/if}
						{#if deviceTypeDistribution.unknown > 0}
							❓ {deviceTypeDistribution.unknown} Unknown
						{/if}
					</div>
				{/if}
			</div>

			<!-- Section 5: MAC Whitelist -->
			<div class="tactical-sidebar-section">
				<h3 class="section-header">MAC WHITELIST</h3>

				<label for="whitelist-mac-input" class="metric-label">Add MAC Address</label>
				<input
					id="whitelist-mac-input"
					type="text"
					class="input-field"
					bind:value={kismetWhitelistMAC}
					placeholder="FF:FF:FF:FF:FF:FF"
					pattern="[0-9A-Fa-f:]{17}"
					aria-label="MAC address to whitelist"
					aria-describedby="whitelist-count"
					onkeydown={(e) => e.key === 'Enter' && addToWhitelist()}
				/>

				<div class="metric-row" style="margin-top: var(--space-2);">
					<span class="metric-label">Whitelisted Devices</span>
					<span id="whitelist-count" class="badge badge-info" aria-live="polite"
						>{whitelistedDeviceCount}</span
					>
				</div>
			</div>
		</aside>

		<!-- Map Container -->
		<main class="tactical-map-container" bind:this={mapContainer}>
			{#if !hasGPSFix}
				<div class="gps-waiting">
					<div class="gps-waiting-content">
						<svg class="gps-icon" viewBox="0 0 24 24" fill="currentColor">
							<path
								d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"
							/>
						</svg>
						<h3>Waiting for GPS Fix</h3>
						<p>{gpsStatus}</p>
					</div>
				</div>
			{/if}

			<!-- Signal Strength Legend - interactive filter -->
			<div class="signal-legend">
				<span class="legend-title">Signal Filter (click to toggle):</span>
				{#each signalBands as band}
					<button
						class="legend-item-btn {hiddenSignalBands.has(band.key)
							? 'legend-disabled'
							: ''}"
						onclick={() => toggleSignalBand(band.key)}
					>
						<span class="legend-color" style="background: {band.color}"></span>
						<span class="legend-label">{band.label}</span>
					</button>
				{/each}
			</div>
		</main>
	</div>
	<!-- End of tactical-main-content -->

	<!-- signal-info footer removed - all controls migrated to sidebar in Plan 6 -->

	<!-- Data Footer (Now HackRF Data) -->
	<div class="data-footer">
		<div class="footer-section hackrf-label">
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="currentColor"
				style="vertical-align: middle;"
			>
				<path d="M4 20v-2h2v2H4zm4 0v-5h2v5H8zm4 0V10h2v10h-2zm4 0V4h2v16h-2z"></path>
			</svg>
			<span style="font-weight: 600; letter-spacing: 0.05em; font-size: 12px;">
				<span class="text-brand">USRP</span>
				<span class="text-primary">SWEEP</span>
			</span>
		</div>

		{#if isSearching && signalCount > 0}
			<div class="footer-section">
				<span class="footer-label">Target:</span>
				<span class="frequency-value">{targetFrequency} MHz</span>
			</div>

			<div class="footer-divider"></div>

			<div class="footer-section">
				<span class="footer-label">Signals:</span>
				<span class="signal-count">{signalCount}</span>
			</div>

			{#if currentSignal}
				<div class="footer-divider"></div>

				<div class="footer-section">
					<span class="footer-label">Strongest:</span>
					<span class="frequency-value">{currentSignal.frequency.toFixed(2)} MHz</span>
					<span class="power-value" style="color: {getSignalColor(currentSignal.power)}">
						@ {currentSignal.power.toFixed(1)} dBm
					</span>
				</div>
			{/if}
		{:else if isSearching}
			<div class="footer-section">
				<span class="footer-label">Searching:</span>
				<span class="frequency-value">{targetFrequency} MHz</span>
			</div>
		{/if}
		<!-- All utility buttons moved to sidebar Quick Actions in Plan 5 -->
	</div>

	<!-- Kismet Dashboard Overlay -->
	<KismetDashboardOverlay isOpen={showKismetDashboard} onClose={() => setDashboardState(false)} />

	<!-- AirSignal Overlay -->
	<AirSignalOverlay
		isOpen={showAirSignalOverlay}
		onClose={() => setAirSignalOverlayState(false)}
	/>

	<!-- Bettercap Overlay -->
	<BettercapOverlay
		isOpen={showBettercapOverlay}
		onClose={() => setBettercapOverlayState(false)}
	/>

	<!-- BTLE Overlay -->
	<BTLEOverlay isOpen={showBtleOverlay} onClose={() => setBtleOverlayState(false)} />
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	/* Support for iPhone safe areas (notch, dynamic island) */
	:global(html) {
		padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)
			env(safe-area-inset-left);
	}

	/* Prevent horizontal scrolling on mobile */
	:global(html, body) {
		overflow-x: hidden;
		-webkit-overflow-scrolling: touch;
	}

	.tactical-map-simple {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: #1a1d23;
		color: #e8eaed;
		position: relative;
	}

	/* Top Navigation Bar */
	.tactical-top-nav {
		height: 50px;
		background: var(--palantir-bg-elevated);
		border-bottom: 1px solid var(--palantir-border-default);
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 var(--space-4);
	}

	.tactical-top-nav .status {
		display: flex;
		gap: var(--space-2);
	}

	/* Main Content Container */
	.tactical-main-content {
		display: flex;
		flex-direction: row;
		flex: 1;
		overflow: hidden;
	}

	.frequency-inputs {
		display: flex;
		gap: 0.5rem;
	}

	.frequency-input {
		flex: 1;
		padding: 0.5rem 1rem;
		background: #1a1d23;
		border: 1px solid #35383f;
		border-radius: 4px;
		color: #e8eaed;
		font-size: 16px;
	}

	.frequency-input:focus {
		outline: none;
		border-color: #4a90e2;
	}

	.frequency-input-small {
		width: 100px;
		padding: 0.5rem 0.75rem;
		background: #1a1d23;
		border: 1px solid #35383f;
		border-radius: 4px;
		color: #e8eaed;
		font-size: 14px;
	}

	.frequency-input-small:focus {
		outline: none;
		border-color: #4a90e2;
	}

	.frequency-input-small::placeholder {
		color: #666;
	}

	/* Footer Frequency Controls */
	/* Frequency controls CSS removed - controls moved to sidebar in Plan 4 */

	.search-button-footer,
	.clear-button-footer {
		padding: 0.25rem 0.75rem;
		border: none;
		border-radius: 4px;
		font-size: 11px;
		cursor: pointer;
		transition: background-color 0.2s;
		white-space: nowrap;
		height: 28px;
	}

	.search-button-footer {
		background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%) !important;
		color: white !important;
		box-shadow: none !important;
	}

	.search-button-footer:hover:not(:disabled) {
		background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
		box-shadow: none !important;
		transform: translateY(-1px);
	}

	.search-button-footer:disabled {
		background: #35383f;
		cursor: not-allowed;
	}

	.clear-button-footer {
		background: #f87171;
		color: white !important;
	}

	.clear-button-footer:hover:not(:disabled) {
		background: #ff6666;
	}

	.clear-button-footer:disabled {
		background: #2c2f36;
		color: white !important;
		cursor: not-allowed;
	}

	.start-kismet-button-footer {
		padding: 0.25rem 0.75rem;
		border: none;
		border-radius: 4px;
		font-size: 11px;
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
		height: 28px;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
		color: white !important;
		box-shadow: none !important;
	}

	.start-kismet-button-footer:hover:not(:disabled) {
		background: linear-gradient(135deg, #059669 0%, #047857 100%) !important;
		box-shadow: none !important;
		transform: translateY(-1px);
	}

	.start-kismet-button-footer:disabled {
		background: #35383f;
		cursor: not-allowed;
	}

	.mac-input {
		width: 200px;
		padding: 0.5rem 0.75rem;
		background: #1a1d23;
		border: 1px solid #35383f;
		border-radius: 4px;
		color: #e8eaed;
		font-size: 14px;
	}

	.mac-input:focus {
		outline: none;
		border-color: #4a9eff;
	}

	.mac-input::placeholder {
		color: #666;
		font-size: 12px;
	}

	/* Footer MAC input styles removed - whitelist moved to sidebar in Plan 6 */

	.tactical-top-nav .back-console-button {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		background: var(--palantir-bg-input);
		color: var(--palantir-text-primary);
		border: 1px solid var(--palantir-border-default);
		border-radius: var(--radius-md);
		padding: var(--space-2) var(--space-3);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.tactical-top-nav .back-console-button:hover {
		background: var(--palantir-bg-hover);
		border-color: var(--palantir-accent);
	}

	.back-console-button svg {
		width: 16px;
		height: 16px;
	}

	.cell-towers-toggle-button {
		display: inline-flex;
		align-items: center;
		padding: 0.5rem 1rem;
		margin-left: 0.5rem;
		background: #374151;
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.cell-towers-toggle-button:hover {
		background: #4b5563;
		color: white;
		transform: translateY(-1px);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
	}

	.cell-towers-toggle-button.active {
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: white;
		box-shadow:
			0 2px 8px rgba(16, 185, 129, 0.3),
			0 0 20px rgba(16, 185, 129, 0.1);
	}

	.cell-towers-toggle-button.active:hover {
		background: linear-gradient(135deg, #059669 0%, #047857 100%);
		box-shadow:
			0 4px 12px rgba(16, 185, 129, 0.4),
			0 0 30px rgba(16, 185, 129, 0.2);
	}

	.search-button,
	.clear-button {
		padding: 0.5rem 1.5rem;
		border: none;
		border-radius: 4px;
		font-size: 16px;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.search-button {
		background: #4a90e2;
		color: white;
	}

	.search-button:hover:not(:disabled) {
		background: #0066cc;
	}

	.search-button:disabled {
		background: #35383f;
		cursor: not-allowed;
	}

	.clear-button {
		background: #f87171 !important;
		color: white !important;
	}

	.clear-button:hover:not(:disabled) {
		background: #ff6666 !important;
	}

	.clear-button:disabled {
		background: #333 !important;
		color: #666 !important;
		cursor: not-allowed;
	}

	/* Status Display */
	.status {
		display: flex;
		gap: 2rem;
		font-size: 14px;
	}

	.status-item {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.status-label {
		color: #5f6368;
	}

	.status-value {
		font-weight: 500;
	}

	.status-value.connected {
		color: #4ade80;
	}

	.status-value.disconnected {
		color: #f87171;
	}

	/* Map Container */
	.tactical-map-container {
		flex: 1;
		position: relative;
	}

	/* Signal Legend */
	.signal-legend {
		position: absolute;
		bottom: 10px;
		right: 10px;
		background: rgba(42, 42, 42, 0.9);
		border: 1px solid #35383f;
		border-radius: 4px;
		padding: 0.5rem;
		font-size: 12px;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		z-index: 1000;
	}

	.legend-title {
		font-weight: 600;
		margin-bottom: 0.25rem;
		color: #ccc;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.legend-item-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: none;
		border: none;
		color: #ddd;
		font-size: 12px;
		padding: 2px 4px;
		cursor: pointer;
		border-radius: 3px;
		transition:
			opacity 0.2s,
			background 0.2s;
		width: 100%;
		text-align: left;
	}

	.legend-item-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.legend-item-btn.legend-disabled {
		opacity: 0.3;
	}

	.legend-item-btn.legend-disabled .legend-label {
		text-decoration: line-through;
	}

	.legend-color {
		width: 12px;
		height: 12px;
		border-radius: 2px;
		display: inline-block;
		flex-shrink: 0;
	}

	/* Signal Info Bar removed - migrated to sidebar in Plan 6 */

	/* Data Footer */
	.data-footer {
		background: #25282f;
		border-top: 1px solid #35383f;
		padding: 0.5rem 1rem;
		display: flex;
		align-items: center;
		gap: 1rem;
		font-size: 12px;
		color: #ccc;
		height: 55px;
		line-height: 1.2;
	}

	/* Kismet footer styles removed - controls moved to sidebar in Plans 3 & 6 */

	.hackrf-label {
		padding-right: 1.5rem;
		border-right: 1px solid #35383f;
	}

	.hackrf-title {
		font-weight: 600;
		color: #f97316;
		letter-spacing: 0.05em;
		font-size: 12px;
	}

	.frequency-value {
		color: #f97316;
		font-weight: 500;
	}

	.power-value {
		font-weight: 600;
	}

	.signal-count {
		color: #4ade80;
		font-weight: 600;
	}

	.device-count {
		color: #4a9eff;
		font-weight: 600;
	}

	.frequency-count {
		color: #f97316;
		font-weight: 600;
	}

	.offline-status {
		color: #f87171;
	}

	/* loading-status removed - Plan 6 */

	.footer-button {
		background: #2c2f36;
		border: 1px solid #3e4149;
		color: #ccc;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 11px;
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
		height: 28px;
	}

	.footer-button:hover {
		background: #35383f;
		border-color: #666;
		color: #fff;
	}

	/* Saasfly button styles removed - replaced with Palantir design system buttons in sidebar (Plan 5) */

	.w-4 {
		width: 1rem;
	}

	.h-4 {
		height: 1rem;
	}

	.footer-section {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.footer-label {
		color: #5f6368;
		font-weight: 500;
		margin-right: 0.375rem;
		font-size: 11px;
	}

	.signal-stat {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.signal-indicator {
		width: 12px;
		height: 12px;
		border-radius: 2px;
		display: inline-block;
	}

	/* device-stat removed - stats moved to sidebar in Plan 6 */

	.footer-divider {
		width: 1px;
		height: 16px;
		background: #35383f;
	}

	.info-content {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.info-label {
		color: #5f6368;
		font-size: 14px;
	}

	.info-value {
		font-weight: 500;
		font-size: 14px;
	}

	/* GPS Waiting Screen */
	.gps-waiting {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #1a1d23;
	}

	.gps-waiting-content {
		text-align: center;
		color: #5f6368;
	}

	.gps-icon {
		width: 64px;
		height: 64px;
		margin-bottom: 1rem;
		opacity: 0.5;
		animation: pulse 2s infinite;
	}

	.gps-waiting h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
		font-weight: 500;
		color: #ccc;
	}

	.gps-waiting p {
		margin: 0;
		font-size: 0.9rem;
	}

	/* User Position Marker */
	:global(.user-marker) {
		position: relative;
		background: transparent !important;
		border: none !important;
	}

	@keyframes pulse {
		0% {
			transform: scale(1);
			opacity: 0.3;
		}
		50% {
			transform: scale(1.2);
			opacity: 0.1;
		}
		100% {
			transform: scale(1);
			opacity: 0.3;
		}
	}

	/* Leaflet Popup Styling */
	:global(.signal-popup .leaflet-popup-content-wrapper) {
		background: #25282f;
		color: #e8eaed;
		border: 1px solid #35383f;
		border-radius: 6px;
		box-shadow: 0 3px 14px rgba(0, 0, 0, 0.5);
	}

	:global(.signal-popup .leaflet-popup-tip) {
		background: #25282f;
		border-bottom: 1px solid #35383f;
		border-right: 1px solid #35383f;
	}

	:global(.signal-popup .leaflet-popup-content) {
		margin: 12px;
		line-height: 1.4;
	}

	:global(.signal-popup .leaflet-popup-close-button) {
		color: #5f6368;
		font-size: 20px;
		font-weight: normal;
		padding: 4px 4px 0 0;
	}

	:global(.signal-popup .leaflet-popup-close-button:hover) {
		color: #fff;
	}

	/* Pi System Info Popup - styled like Kismet device boxes */
	:global(.pi-popup .leaflet-popup-content-wrapper) {
		background: #25282f;
		border: 1px solid #35383f;
		border-radius: 6px;
		box-shadow: 0 3px 14px rgba(0, 0, 0, 0.5);
		color: #fff;
	}

	:global(.pi-popup .leaflet-popup-tip) {
		background: #25282f;
		border-bottom: 1px solid #35383f;
		border-right: 1px solid #35383f;
	}

	:global(.pi-popup .leaflet-popup-content) {
		margin: 12px;
	}

	:global(.pi-popup .leaflet-popup-close-button) {
		color: #5f6368;
		font-size: 20px;
		font-weight: normal;
	}

	:global(.pi-popup .leaflet-popup-close-button:hover) {
		color: #fff;
	}

	/* Kismet Device Icons */
	:global(.kismet-marker) {
		background: transparent !important;
		border: none !important;
	}

	:global(.kismet-marker svg) {
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
	}

	@keyframes pulse-glow {
		0%,
		100% {
			transform: scale(1);
			filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
		}
		50% {
			transform: scale(1.05);
			filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
		}
	}

	/* iPhone Portrait Mode (320px - 428px width) */
	@media (max-width: 428px) and (orientation: portrait) {
		.tactical-map-simple {
			height: 100vh;
			overflow: hidden;
		}

		/* Search Bar - Compact for portrait */
		.search-bar {
			padding: 8px;
			flex-direction: column;
			gap: 8px;
			position: sticky;
			top: 0;
			z-index: 1000;
		}

		.search-container {
			min-width: auto;
			width: 100%;
			flex-direction: column;
			gap: 8px;
		}

		/* Back button - smaller in portrait */
		.back-console-button {
			width: 100%;
			font-size: 12px;
			padding: 6px 12px;
		}

		/* Footer MAC input removed - Plan 6 */

		/* Frequency inputs - horizontal scroll if needed */
		.frequency-inputs {
			width: 100%;
			display: flex;
			gap: 6px;
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
		}

		.frequency-input-small {
			min-width: 80px;
			width: 30%;
			font-size: 13px;
			padding: 6px 8px;
		}

		/* Buttons - side by side */
		.search-button,
		.clear-button {
			flex: 1;
			font-size: 14px;
			padding: 8px 12px;
		}

		/* Status - minimal in portrait */
		.status {
			width: 100%;
			font-size: 11px;
			justify-content: center;
		}

		/* Map container - maximize space */
		.map-container {
			flex: 1;
			width: 100%;
			min-height: 0; /* Allow shrinking */
			position: relative;
		}

		/* Legend - bottom right of map */
		.signal-legend {
			position: absolute !important;
			bottom: 10px !important;
			right: 10px !important;
			left: auto !important;
			width: auto;
			max-width: 60%;
			background: rgba(0, 0, 0, 0.9) !important;
			padding: 8px !important;
			border-radius: 8px;
			font-size: 10px;
			z-index: 999;
			max-height: 120px;
			overflow-y: auto;
		}

		.legend-title {
			font-size: 11px;
			display: block;
			margin-bottom: 4px;
		}

		.legend-item,
		.legend-item-btn {
			font-size: 10px;
			display: inline-flex;
			margin-right: 8px;
			margin-bottom: 4px;
		}

		.legend-color {
			width: 12px;
			height: 12px;
		}

		/* Footer - hidden in portrait to save space */
		.footer {
			display: none;
		}

		/* GPS waiting overlay */
		.gps-waiting {
			font-size: 14px;
		}

		.gps-icon {
			width: 48px;
			height: 48px;
		}

		/* signal-info removed - Plan 6 */

		.data-footer {
			height: 40px !important;
			padding: 8px !important;
		}

		/* HackRF footer specific adjustments for 40px height in portrait */
		.data-footer .footer-section {
			font-size: 10px !important;
			gap: 6px !important;
		}

		.data-footer .footer-label {
			font-size: 10px !important;
			margin-right: 4px !important;
		}

		.data-footer .footer-divider {
			height: 16px !important;
			margin: 0 6px !important;
		}

		/* HackRF buttons removed - replaced with sidebar controls (Plan 5) */

		/* Ensure proper vertical centering in 50px container */
		.data-footer {
			display: flex !important;
			align-items: center !important;
		}

		/* HackRF status text adjustments */
		.data-footer .frequency-value,
		.data-footer .signal-count,
		.data-footer .power-value {
			font-size: 10px !important;
		}

		/* Kismet label removed - Plan 6 */

		/* Kismet controls compact styling for portrait */
		.kismet-control-btn {
			font-size: 8px !important;
			padding: 0.25rem 0.5rem !important;
			gap: 0.125rem !important;
		}

		.kismet-control-btn svg {
			width: 10px !important;
			height: 10px !important;
		}

		.kismet-title {
			font-size: 10px !important;
		}

		/* Footer frequency controls - portrait mobile */
		/* Frequency controls CSS removed - controls moved to sidebar in Plan 4 */
	}

	/* iPhone Landscape Mode (568px - 926px width) */
	@media (max-height: 428px) and (orientation: landscape) {
		.tactical-map-simple {
			height: 100vh;
			overflow: hidden;
		}

		/* Search Bar - Reduced padding by 10px from top/bottom */
		.search-bar {
			padding: 2px 12px;
			flex-direction: row;
			gap: 8px;
			flex-wrap: nowrap;
			height: 40px; /* Match the footer heights */
		}

		.search-container {
			flex-direction: row;
			gap: 4px;
			align-items: center;
		}

		/* Back button - more compact */
		.back-console-button {
			font-size: 11px;
			padding: 2px 8px;
			white-space: nowrap;
			height: 24px;
		}

		.back-console-button svg {
			width: 12px;
			height: 12px;
		}

		/* Footer MAC input removed - Plan 6 */

		/* Frequency inputs - more compact */
		.frequency-inputs {
			flex-direction: row;
			gap: 3px;
		}

		.frequency-input-small {
			width: 65px !important;
			font-size: 11px;
			padding: 2px 4px;
			height: 24px;
		}

		/* Buttons - smaller to prevent overlap */
		.search-button,
		.clear-button {
			font-size: 11px;
			padding: 2px 10px;
			height: 24px;
			white-space: nowrap;
		}

		/* Status - more compact */
		.status {
			font-size: 9px;
			gap: 0.5rem;
		}

		/* Map container - full remaining space */
		.map-container {
			flex: 1;
			width: 100%;
			position: relative;
		}

		/* Legend - bottom right of map */
		.signal-legend {
			position: absolute !important;
			bottom: 10px !important;
			right: 10px !important;
			top: auto !important;
			left: auto !important;
			width: 180px;
			background: rgba(0, 0, 0, 0.9) !important;
			padding: 4px 6px !important;
			border-radius: 6px;
			font-size: 8px;
			z-index: 999;
		}

		.legend-title {
			font-size: 9px;
			margin-bottom: 2px;
		}

		.legend-item,
		.legend-item-btn {
			font-size: 8px;
			display: flex;
			margin-bottom: 1px;
		}

		.legend-color {
			width: 8px;
			height: 8px;
		}

		/* Footer - hidden in landscape */
		.footer {
			display: none;
		}

		/* GPS waiting - smaller */
		.gps-waiting {
			font-size: 11px;
		}

		.gps-icon {
			width: 32px;
			height: 32px;
		}

		.gps-waiting h3 {
			font-size: 12px;
		}

		/* Signal info popup - compact */
		/* signal-info removed - Plan 6 */

		/* Status items - prevent overlap */
		.status-item {
			white-space: nowrap;
		}

		.status-value {
			font-size: 9px;
		}

		/* signal-info footer removed - Plan 6 */

		.data-footer {
			height: 40px !important;
			padding: 2px 12px !important;
		}

		/* HackRF footer specific adjustments for 40px height */
		.data-footer .footer-section {
			font-size: 8px !important;
			gap: 4px !important;
		}

		.data-footer .footer-label {
			font-size: 8px !important;
			margin-right: 2px !important;
		}

		.data-footer .footer-divider {
			height: 14px !important;
			margin: 0 4px !important;
		}

		/* HackRF buttons removed - replaced with sidebar controls (Plan 5) */

		/* Ensure proper vertical centering in 50px container */
		.data-footer {
			display: flex !important;
			align-items: center !important;
		}

		/* HackRF status text adjustments */
		.data-footer .frequency-value,
		.data-footer .signal-count,
		.data-footer .power-value {
			font-size: 9px !important;
		}

		/* Kismet label removed - Plan 6 */

		/* Kismet controls compact styling for landscape */
		.kismet-control-btn {
			font-size: 7px !important;
			padding: 0.1875rem 0.375rem !important;
			gap: 0.1rem !important;
		}

		.kismet-control-btn svg {
			width: 8px !important;
			height: 8px !important;
		}

		.kismet-title {
			font-size: 9px !important;
		}

		/* signal-info footer removed - Plan 6 */

		/* signal-info footer CSS removed - Plan 6 */

		/* Footer frequency controls - landscape mobile */
		/* Frequency controls CSS removed - controls moved to sidebar in Plan 4 */

		.search-button-footer,
		.clear-button-footer {
			font-size: 10px;
			padding: 4px 8px;
		}
	}

	/* Tablet and Desktop - General Mobile Responsive */
	@media (max-width: 768px) {
		/* Header adjustments */
		.header {
			padding: 8px;
		}

		h1 {
			font-size: 1.2em;
		}

		/* Search bar - make it fully responsive */
		.search-bar {
			padding: 0.75rem;
			flex-direction: column;
			gap: 10px;
		}

		.search-container {
			min-width: auto;
			width: 100%;
			flex-direction: column;
			gap: 10px;
		}

		/* Frequency inputs - remove fixed width */
		input[type='number'] {
			width: 100% !important;
			min-width: 0;
		}

		/* MAC input - full width */
		input[type='text'] {
			width: 100% !important;
			min-width: 0;
		}

		/* Search button - full width on mobile */
		button {
			width: 100%;
			margin-top: 8px;
		}

		/* Map container - ensure proper sizing */
		.map-container {
			width: 100vw;
			margin-left: -0.75rem;
			margin-right: -0.75rem;
			min-height: 400px;
		}

		/* Legend - reposition to avoid overlap */
		.legend {
			position: relative !important;
			margin: 10px;
			right: auto !important;
			bottom: auto !important;
			width: calc(100% - 20px);
			max-width: 100%;
			background: rgba(0, 12, 28, 0.95);
		}

		/* Status section */
		.status {
			font-size: 12px;
			gap: 1rem;
			flex-wrap: wrap;
			justify-content: center;
		}

		.status-item {
			min-width: 100px;
		}

		/* signal-info removed - Plan 6 */

		/* Footer - stack all sections vertically */
		.footer {
			grid-template-columns: 1fr !important;
			gap: 15px;
			padding: 15px 10px;
		}

		.footer-section {
			border-right: none !important;
			border-bottom: 1px solid rgba(74, 158, 255, 0.2);
			padding-right: 0;
			padding-bottom: 15px;
		}

		.footer-section:last-child {
			border-bottom: none;
			padding-bottom: 0;
		}

		.footer-section h3 {
			font-size: 0.9em;
			margin-bottom: 8px;
		}

		.footer-section p {
			font-size: 0.85em;
			line-height: 1.4;
		}

		/* Footer status items */
		.footer-status {
			flex-direction: column;
			gap: 8px;
			font-size: 0.85em;
		}

		.footer-status .status-dot {
			margin-right: 6px;
		}

		/* Footer actions */
		.footer-actions {
			flex-direction: column;
			gap: 8px;
		}

		.btn-footer {
			width: 100%;
			font-size: 0.85em;
			padding: 8px 12px;
		}

		/* Stats grid */
		.stats-grid {
			font-size: 0.85em;
			gap: 8px;
		}

		/* GPS info */
		.gps-info {
			font-size: 0.85em;
			flex-wrap: wrap;
			justify-content: center;
		}

		.gps-stat {
			min-width: 80px;
		}

		/* Distribution charts */
		.distribution-grid {
			gap: 10px;
		}

		.distribution-chart h4 {
			font-size: 0.85em;
		}

		.chart-bar-label {
			font-size: 0.7em;
		}

		.chart-bar-count {
			font-size: 0.65em;
		}

		/* Device count display */
		.device-count {
			font-size: 0.9em;
		}

		/* Footer frequency controls - tablet/desktop */
		.frequency-controls-section {
			gap: 0.6rem;
			flex-direction: row;
			flex-wrap: wrap;
		}

		.frequency-inputs-footer {
			gap: 6px;
		}

		.frequency-input-footer {
			width: 75px;
			font-size: 12px;
			padding: 6px 8px;
		}

		.search-button-footer,
		.clear-button-footer {
			font-size: 12px;
			padding: 6px 12px;
		}
	}

	/* Sidebar collapse (Plan 7) */
	.tactical-sidebar.collapsed {
		width: 0;
		min-width: 0;
		overflow: hidden;
		padding: 0;
		border-right: none;
		transition: all 0.3s ease-in-out;
	}

	.sidebar-toggle-btn {
		display: none;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		background: var(--palantir-bg-secondary);
		border: 1px solid var(--palantir-border);
		border-radius: 4px;
		color: var(--palantir-text-primary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.sidebar-toggle-btn:hover {
		background: var(--palantir-bg-hover);
		border-color: var(--palantir-accent);
	}

	@media (max-width: 1200px) {
		.sidebar-toggle-btn {
			display: flex;
		}
	}

	/* Accessibility: Focus indicators */
	*:focus-visible {
		outline: 2px solid var(--palantir-accent);
		outline-offset: 2px;
	}

	.data-table:focus-visible {
		outline: 2px solid var(--palantir-accent);
		outline-offset: -2px;
	}

	.data-table th:focus-visible {
		outline: 2px solid var(--palantir-accent);
		outline-offset: -2px;
	}

	.badge:focus-visible {
		outline: 2px solid var(--palantir-accent);
		outline-offset: 2px;
	}

	.input-field:focus-visible {
		outline: 2px solid var(--palantir-accent);
		outline-offset: -1px;
	}
</style>
