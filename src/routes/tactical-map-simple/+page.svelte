<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { hackrfAPI } from '$lib/services/hackrf/api';
	import { spectrumData } from '$lib/stores/hackrf';
	import { SignalAggregator } from './SignalAggregator';
	import { detectCountry, formatCoordinates } from '$lib/utils/countryDetector';
	import { latLonToMGRS } from '$lib/utils/mgrsConverter';

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
		temperature: number;
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
		bindPopup: (content: string, options?: Record<string, unknown>) => LeafletMarker;
		openPopup: () => LeafletMarker;
		setPopupContent: (content: string) => LeafletMarker;
		on: (event: string, handler: () => void) => LeafletMarker;
		setIcon: (icon: unknown) => LeafletMarker;
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
		on: (event: string, handler: () => void) => LeafletCircleMarker;
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
	}

	interface LeafletPopup {
		setContent: (content: string) => LeafletPopup;
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

		console.warn(`Searching for signals near ${targetFrequency} MHz`);
	}

	// Add MAC to whitelist
	function addToWhitelist() {
		if (kismetWhitelistMAC.trim()) {
			const mac = kismetWhitelistMAC.trim().toUpperCase();
			console.warn('Adding MAC to whitelist:', mac);
			whitelistedMACs.add(mac);
			whitelistedDeviceCount = whitelistedMACs.size;
			kismetWhitelistMAC = '';
		}
	}

	// Load frequencies function (placeholder for now)
	function loadFrequencies() {
		console.warn('Load frequencies clicked - implementation pending');
		// TODO: Implement frequency loading
	}

	// Open spectrum analyzer
	async function openSpectrumAnalyzer() {
		// Stop the HackRF sweep if it's running
		if (isSearching) {
			console.warn('Stopping HackRF sweep before opening spectrum analyzer...');
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
	}

	// Get signal color based on power
	function getSignalColor(power: number): string {
		// Note: Higher dBm (closer to 0) = stronger signal
		if (power > -50) return '#ff0000'; // Red (very strong)
		if (power > -60) return '#ff8800'; // Orange (strong)
		if (power > -70) return '#ffff00'; // Yellow (good)
		if (power > -80) return '#00ff00'; // Green (fair)
		return '#0088ff'; // Blue (weak)
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
			const response = await fetch('/api/system/info');
			if (response.ok) {
				systemInfo = (await response.json()) as SystemInfo;
			}
		} catch (error) {
			console.error('Error fetching system info:', error);
		}
	}

	// Show Pi popup with system information
	async function showPiPopup() {
		if (!userMarker) return;

		// Fetch latest system info
		await fetchSystemInfo();

		if (!systemInfo) {
			userMarker.setPopupContent('<div style="padding: 10px;">Loading system info...</div>');
			userMarker.openPopup();
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
            <td style="padding: 4px 0; font-family: monospace; color: #ffaa00;">${mgrsCoord}</td>
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
            <td colspan="2" style="padding: 8px 0 4px 0; border-top: 1px solid #333;">
              <strong>System Resources:</strong>
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 8px 4px 0; font-weight: bold;">CPU:</td>
            <td style="padding: 4px 0;">
              <span style="color: ${systemInfo.cpu.usage > 80 ? '#ff4444' : systemInfo.cpu.usage > 60 ? '#ffaa00' : '#00ff00'}">
                ${systemInfo.cpu.usage.toFixed(1)}%
              </span>
              (${systemInfo.cpu.cores} cores)
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 8px 4px 0; font-weight: bold;">Memory:</td>
            <td style="padding: 4px 0;">
              <span style="color: ${systemInfo.memory.percentage > 80 ? '#ff4444' : systemInfo.memory.percentage > 60 ? '#ffaa00' : '#00ff00'}">
                ${systemInfo.memory.percentage.toFixed(1)}%
              </span>
              (${formatBytes(systemInfo.memory.used)} / ${formatBytes(systemInfo.memory.total)})
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 8px 4px 0; font-weight: bold;">Storage:</td>
            <td style="padding: 4px 0;">
              <span style="color: ${systemInfo.storage.percentage > 80 ? '#ff4444' : systemInfo.storage.percentage > 60 ? '#ffaa00' : '#00ff00'}">
                ${systemInfo.storage.percentage}%
              </span>
              (${formatBytes(systemInfo.storage.used)} / ${formatBytes(systemInfo.storage.total)})
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 8px 4px 0; font-weight: bold;">Temperature:</td>
            <td style="padding: 4px 0;">
              <span style="color: ${systemInfo.temperature > 70 ? '#ff4444' : systemInfo.temperature > 60 ? '#ffaa00' : '#00ff00'}">
                ${systemInfo.temperature.toFixed(1)}°C
              </span>
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
              <span style="color: ${systemInfo.battery.level < 20 ? '#ff4444' : systemInfo.battery.level < 50 ? '#ffaa00' : '#00ff00'}">
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

		userMarker.setPopupContent(popupContent);
		userMarker.openPopup();
	}

	// Get device icon SVG based on type
	function getDeviceIconSVG(device: KismetDevice, color: string): string {
		const type = device.type?.toLowerCase() || '';
		const manufacturer = device.manufacturer?.toLowerCase() || '';

		// Access Point / Router icon (antenna with waves)
		if (
			type.includes('ap') ||
			type.includes('access') ||
			manufacturer.includes('arris') ||
			manufacturer.includes('router') ||
			manufacturer.includes('gateway')
		) {
			return `
        <svg width="40" height="40" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
          <!-- Router body -->
          <rect x="10" y="20" width="10" height="6" fill="${color}" stroke="#fff" stroke-width="0.5"/>
          <!-- Antenna -->
          <line x1="15" y1="20" x2="15" y2="10" stroke="${color}" stroke-width="2"/>
          <!-- Signal waves -->
          <path d="M 10 15 Q 15 13 20 15" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.8"/>
          <path d="M 7 12 Q 15 9 23 12" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.6"/>
          <path d="M 4 9 Q 15 5 26 9" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.4"/>
        </svg>
      `;
		}

		// Mobile/Client device icon (smartphone/laptop outline)
		if (
			type.includes('client') ||
			type.includes('mobile') ||
			manufacturer.includes('phone') ||
			manufacturer.includes('smartphone') ||
			manufacturer.includes('android') ||
			manufacturer.includes('iphone')
		) {
			return `
        <svg width="40" height="40" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
          <!-- Phone body -->
          <rect x="11" y="8" width="8" height="14" rx="1" fill="none" stroke="${color}" stroke-width="2"/>
          <!-- Screen -->
          <rect x="12.5" y="10" width="5" height="9" fill="${color}" opacity="0.3"/>
          <!-- Home button -->
          <circle cx="15" cy="20.5" r="0.8" fill="${color}"/>
        </svg>
      `;
		}

		// Unknown device icon (network node)
		return `
      <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
        <!-- Node circle -->
        <circle cx="15" cy="15" r="8" fill="none" stroke="${color}" stroke-width="2"/>
        <!-- Question mark -->
        <text x="15" y="19" text-anchor="middle" font-size="10" font-weight="bold" fill="${color}">?</text>
        <!-- Connection points -->
        <circle cx="15" cy="7" r="1.5" fill="${color}"/>
        <circle cx="23" cy="15" r="1.5" fill="${color}"/>
        <circle cx="15" cy="23" r="1.5" fill="${color}"/>
        <circle cx="7" cy="15" r="1.5" fill="${color}"/>
      </svg>
    `;
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
							html: '<div style="font-size: 36px; text-align: center; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));">🇺🇸</div>',
							iconSize: [40, 40],
							iconAnchor: [20, 20]
						});
						userMarker = L.marker([userPosition.lat, userPosition.lon], {
							icon: userIcon
						}).addTo(map);

						// Add click handler to user marker
						userMarker.on('click', () => {
							void showPiPopup();
						});

						// Bind popup to user marker
						userMarker.bindPopup('', {
							maxWidth: 300,
							className: 'pi-popup',
							autoClose: false,
							closeOnClick: false
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
				gpsStatus = 'GPS: No Fix';
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
		if (!map || kismetStatus !== 'running') return;

		try {
			const response = await fetch('/api/kismet/devices');
			if (response.ok) {
				const data = (await response.json()) as KismetDevicesResponse;

				// Update or create markers for each device
				const devices = data.devices;
				devices.forEach((device: KismetDevice) => {
					const markerId = `kismet_${device.mac}`;

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
                  Kismet Device
                </h4>
                <table style="width: 100%; border-collapse: collapse;">
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
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">Channel:</td>
                    <td style="padding: 4px 0;">${device.channel || 'Unknown'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">Packets:</td>
                    <td style="padding: 4px 0;">${device.packets}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">Manufacturer:</td>
                    <td style="padding: 4px 0;">${device.manufacturer}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">MGRS:</td>
                    <td style="padding: 4px 0; font-family: monospace; color: #ffaa00;">${latLonToMGRS(device.location?.lat || userPosition.lat, device.location?.lon || userPosition.lon)}</td>
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
						}

						// Update popup if needed
						const popupContent = `
              <div style="font-family: sans-serif; min-width: 200px;">
                <h4 style="margin: 0 0 8px 0; color: ${getSignalColor(device.signal?.last_signal || -100)}">
                  Kismet Device
                </h4>
                <table style="width: 100%; border-collapse: collapse;">
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
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">Channel:</td>
                    <td style="padding: 4px 0;">${device.channel || 'Unknown'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">Packets:</td>
                    <td style="padding: 4px 0;">${device.packets}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">Manufacturer:</td>
                    <td style="padding: 4px 0;">${device.manufacturer}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 8px 4px 0; font-weight: bold;">MGRS:</td>
                    <td style="padding: 4px 0; font-family: monospace; color: #ffaa00;">${latLonToMGRS(device.location?.lat || userPosition.lat, device.location?.lon || userPosition.lon)}</td>
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
				});

				// Clean up markers for devices that no longer exist
				kismetMarkers.forEach((marker, id) => {
					if (!data.devices.find((d: KismetDevice) => `kismet_${d.mac}` === id)) {
						if (map) {
							map.removeLayer(marker);
						}
						kismetMarkers.delete(id);
						kismetDevices.delete(id);
					}
				});

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
                <td style="padding: 4px 0; font-family: monospace; color: #ffaa00;">
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
                  <td style="padding: 4px 0; font-family: monospace; color: #ffaa00;">
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

		// Start GPS updates (map will initialize after GPS fix)
		void updateGPSPosition();
		positionInterval = setInterval(() => void updateGPSPosition(), 5000); // Update every 5 seconds

		connectToHackRF();

		// Start update interval
		updateInterval = setInterval(processSignals, UPDATE_RATE);

		// Set up Kismet device fetching interval (will only fetch when running)
		kismetInterval = setInterval(() => void fetchKismetDevices(), 10000);

		// Check initial Kismet status immediately and more frequently at start
		checkKismetStatus().catch((error) => {
			console.error('Initial Kismet status check failed:', error);
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
	<!-- Search Bar -->
	<div class="search-bar">
		<div class="search-container">
			<button
				class="back-console-button"
				on:click={() => (window.location.href = '/hackrfsweep')}
			>
				<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L4.414 9H17a1 1 0 110 2H4.414l5.293 5.293a1 1 0 010 1.414z"
					/>
				</svg>
				Back to Console
			</button>
		</div>
		<div class="status">
			<span class="status-item">
				<span style="color: #ffffff;">GPS:</span>
				{#if fixType !== 'No'}
					<span style="color: #00ff00; margin-left: 0.25rem;">{fixType} Fix</span>
					<span style="color: #888; margin-left: 0.25rem;">({satellites} sats)</span>
					<span style="color: #ffffff; margin-left: 0.5rem;">|</span>
					<span style="color: #88ccff; margin-left: 0.5rem;"
						>{formattedCoords.lat}, {formattedCoords.lon}</span
					>
					<span style="color: #ffffff; margin-left: 0.5rem;">|</span>
					<span style="color: #ffaa00; margin-left: 0.5rem; font-family: monospace;"
						>{mgrsCoord}</span
					>
					<span style="font-size: 1.2em; margin-left: 0.5rem;">{currentCountry.flag}</span
					>
				{:else}
					<span style="color: #ff4444; margin-left: 0.25rem;">No Fix</span>
				{/if}
			</span>
		</div>
	</div>

	<!-- Map Container -->
	<div class="map-container" bind:this={mapContainer}>
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

		<!-- Signal Strength Legend - moved inside map container -->
		<div class="signal-legend">
			<span class="legend-title">Signal Strength Legend:</span>
			<span class="legend-item">
				<span class="legend-color" style="background: #ff0000"></span>
				&gt; -50 dBm (Very Strong)
			</span>
			<span class="legend-item">
				<span class="legend-color" style="background: #ff8800"></span>
				-50 to -60 dBm (Strong)
			</span>
			<span class="legend-item">
				<span class="legend-color" style="background: #ffff00"></span>
				-60 to -70 dBm (Good)
			</span>
			<span class="legend-item">
				<span class="legend-color" style="background: #00ff00"></span>
				-70 to -80 dBm (Fair)
			</span>
			<span class="legend-item">
				<span class="legend-color" style="background: #0088ff"></span>
				&lt; -80 dBm (Weak)
			</span>
		</div>
	</div>

	<!-- Signal Info Bar (Now Kismet Data) -->
	<div class="signal-info">
		<div class="footer-section kismet-label">
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="currentColor"
				style="vertical-align: middle;"
			>
				<path
					d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.07 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"
				></path>
			</svg>
			<span class="kismet-title">KISMET</span>
		</div>

		<div class="footer-section kismet-controls">
			<button
				on:click={startKismet}
				disabled={kismetStatus === 'starting' || kismetStatus === 'running'}
				class="start-kismet-button-footer"
			>
				Start
			</button>
			<button
				on:click={stopKismet}
				disabled={kismetStatus === 'stopping' || kismetStatus === 'stopped'}
				class="clear-button-footer"
			>
				Stop
			</button>
		</div>

		<div class="footer-divider"></div>

		<div class="footer-section kismet-whitelist-footer">
			<span class="footer-label">MAC Whitelist</span>
			<input
				type="text"
				bind:value={kismetWhitelistMAC}
				placeholder="FF:FF:FF:FF:FF:FF"
				class="mac-input-footer"
				on:keydown={(e) => e.key === 'Enter' && addToWhitelist()}
			/>
		</div>

		<div class="footer-divider"></div>

		<div class="footer-section">
			<span class="footer-label">Total Devices Whitelisted:</span>
			<span class="device-count">{whitelistedDeviceCount}</span>
		</div>

		{#if kismetDeviceCount > 0}
			<div class="footer-section">
				<span class="footer-label">Signal Distribution:</span>
				{#if signalDistribution.veryStrong > 0}
					<span class="signal-stat">
						<span class="signal-indicator" style="background: #ff0000"></span>
						{signalDistribution.veryStrong}
					</span>
				{/if}
				{#if signalDistribution.strong > 0}
					<span class="signal-stat">
						<span class="signal-indicator" style="background: #ff8800"></span>
						{signalDistribution.strong}
					</span>
				{/if}
				{#if signalDistribution.good > 0}
					<span class="signal-stat">
						<span class="signal-indicator" style="background: #ffff00"></span>
						{signalDistribution.good}
					</span>
				{/if}
				{#if signalDistribution.fair > 0}
					<span class="signal-stat">
						<span class="signal-indicator" style="background: #00ff00"></span>
						{signalDistribution.fair}
					</span>
				{/if}
				{#if signalDistribution.weak > 0}
					<span class="signal-stat">
						<span class="signal-indicator" style="background: #0088ff"></span>
						{signalDistribution.weak}
					</span>
				{/if}
			</div>

			<div class="footer-divider"></div>

			<div class="footer-section">
				<span class="footer-label">Device Types:</span>
				{#if deviceTypeDistribution.ap > 0}
					<span class="device-stat">
						<svg
							width="16"
							height="16"
							viewBox="0 0 30 30"
							style="vertical-align: middle;"
						>
							<rect
								x="10"
								y="20"
								width="10"
								height="6"
								fill="#888"
								stroke="#fff"
								stroke-width="0.5"
							/>
							<line x1="15" y1="20" x2="15" y2="10" stroke="#888" stroke-width="2" />
							<path
								d="M 10 15 Q 15 13 20 15"
								fill="none"
								stroke="#888"
								stroke-width="1.5"
								opacity="0.8"
							/>
							<path
								d="M 7 12 Q 15 9 23 12"
								fill="none"
								stroke="#888"
								stroke-width="1.5"
								opacity="0.6"
							/>
						</svg>
						{deviceTypeDistribution.ap} APs
					</span>
				{/if}
				{#if deviceTypeDistribution.client > 0}
					<span class="device-stat">
						<svg
							width="16"
							height="16"
							viewBox="0 0 30 30"
							style="vertical-align: middle;"
						>
							<rect
								x="11"
								y="8"
								width="8"
								height="14"
								rx="1"
								fill="none"
								stroke="#888"
								stroke-width="2"
							/>
							<rect x="12.5" y="10" width="5" height="9" fill="#888" opacity="0.3" />
							<circle cx="15" cy="20.5" r="0.8" fill="#888" />
						</svg>
						{deviceTypeDistribution.client} Clients
					</span>
				{/if}
				{#if deviceTypeDistribution.unknown > 0}
					<span class="device-stat">
						<svg
							width="16"
							height="16"
							viewBox="0 0 30 30"
							style="vertical-align: middle;"
						>
							<circle
								cx="15"
								cy="15"
								r="8"
								fill="none"
								stroke="#888"
								stroke-width="2"
							/>
							<text
								x="15"
								y="19"
								text-anchor="middle"
								font-size="10"
								font-weight="bold"
								fill="#888">?</text
							>
						</svg>
						{deviceTypeDistribution.unknown} Unknown
					</span>
				{/if}
			</div>

			<div class="footer-section">
				<span class="footer-label">Total Devices:</span>
				<span class="device-count">{kismetDeviceCount}</span>
			</div>
		{:else}
			<div class="footer-section">
				<span class="loading-status">Pulling data...</span>
			</div>
		{/if}
	</div>

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
				<span style="color: #fb923c;">HACKRF</span>
				<span style="color: #ffffff;">SWEEP</span>
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
		{:else}
			<div
				class="footer-section"
				style="flex-direction: column; align-items: flex-start; gap: 0.25rem;"
			>
				<div>
					<span style="color: #ffffff;">Device:</span>
					<span
						style="color: {connectionStatus === 'Connected'
							? '#00ff00'
							: '#ff4444'}; margin-left: 0.25rem;"
					>
						{connectionStatus}
					</span>
				</div>
				<div>
					<span style="color: #ffffff;">Broadcast:</span>
					<span style="color: #ff4444; margin-left: 0.25rem;">Offline</span>
				</div>
			</div>

			<div class="footer-divider"></div>

			<div
				class="footer-section"
				style="flex-direction: column; align-items: flex-start; gap: 0.25rem;"
			>
				<div>
					<span style="color: #fb923c;">Frequencies</span>
				</div>
				<div>
					<span style="color: #ffffff;">Detected:</span>
					<span style="color: #888; font-weight: 600; margin-left: 0.25rem;"
						>{signalCount}</span
					>
				</div>
			</div>

			<div class="footer-divider"></div>

			<!-- Frequency Controls Section -->
			<div class="footer-section frequency-controls-section">
				<div class="frequency-inputs-footer">
					{#each searchFrequencies as _freq, idx}
						<input
							type="number"
							bind:value={searchFrequencies[idx]}
							placeholder="Freq {idx + 1}"
							on:keydown={(e) => e.key === 'Enter' && handleSearch()}
							class="frequency-input-footer"
						/>
					{/each}
				</div>
				<button
					on:click={handleSearch}
					class="search-button-footer"
					disabled={!searchFrequencies.some((f) => f)}
				>
					Search
				</button>
				<button
					on:click={clearSignals}
					class="clear-button-footer"
					disabled={signalCount === 0 && kismetDeviceCount === 0}
				>
					Clear
				</button>
			</div>
		{/if}

		<div class="footer-divider"></div>

		<button class="saasfly-btn saasfly-btn-load" on:click={loadFrequencies}>
			<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
				<path
					fill-rule="evenodd"
					d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
				/>
			</svg>
			Load Frequencies
		</button>

		<div class="footer-divider"></div>

		<button class="saasfly-btn saasfly-btn-spectrum" on:click={openSpectrumAnalyzer}>
			<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
				<path
					d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"
				/>
			</svg>
			View Spectrum
		</button>
	</div>
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
		background: #1a1a1a;
		color: #ffffff;
		position: relative;
	}

	/* Search Bar */
	.search-bar {
		background: #2a2a2a;
		border-bottom: 1px solid #444;
		padding: 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.search-container {
		display: flex;
		gap: 0.5rem;
		flex: 1;
		min-width: 300px;
		align-items: center;
	}

	.frequency-inputs {
		display: flex;
		gap: 0.5rem;
	}

	.frequency-input {
		flex: 1;
		padding: 0.5rem 1rem;
		background: #1a1a1a;
		border: 1px solid #444;
		border-radius: 4px;
		color: #ffffff;
		font-size: 16px;
	}

	.frequency-input:focus {
		outline: none;
		border-color: #0088ff;
	}

	.frequency-input-small {
		width: 100px;
		padding: 0.5rem 0.75rem;
		background: #1a1a1a;
		border: 1px solid #444;
		border-radius: 4px;
		color: #ffffff;
		font-size: 14px;
	}

	.frequency-input-small:focus {
		outline: none;
		border-color: #0088ff;
	}

	.frequency-input-small::placeholder {
		color: #666;
	}

	/* Footer Frequency Controls */
	.frequency-controls-section {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.frequency-inputs-footer {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.frequency-input-footer {
		width: 80px;
		padding: 0.25rem 0.375rem;
		background: #1a1a1a;
		border: 1px solid #444;
		border-radius: 4px;
		color: #ffffff;
		font-size: 11px;
		height: 28px;
		text-align: center;
	}

	.frequency-input-footer:focus {
		outline: none;
		border-color: #0088ff;
	}

	.frequency-input-footer::placeholder {
		color: #666;
		font-size: 11px;
	}

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
		background: #444;
		cursor: not-allowed;
	}

	.clear-button-footer {
		background: #ff4444;
		color: white !important;
	}

	.clear-button-footer:hover:not(:disabled) {
		background: #ff6666;
	}

	.clear-button-footer:disabled {
		background: #333;
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
		background: #444;
		cursor: not-allowed;
	}

	.mac-input {
		width: 200px;
		padding: 0.5rem 0.75rem;
		background: #1a1a1a;
		border: 1px solid #444;
		border-radius: 4px;
		color: #ffffff;
		font-size: 14px;
	}

	.mac-input:focus {
		outline: none;
		border-color: #00d2ff;
	}

	.mac-input::placeholder {
		color: #666;
		font-size: 12px;
	}

	/* Footer MAC input styles */
	.kismet-whitelist-footer {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.mac-input-footer {
		width: 140px;
		padding: 0.25rem 0.375rem;
		background: #1a1a1a;
		border: 1px solid #444;
		border-radius: 3px;
		color: #ffffff;
		font-size: 11px;
		height: 28px;
		text-align: center;
	}

	.mac-input-footer:focus {
		outline: none;
		border-color: #00d2ff;
	}

	.mac-input-footer::placeholder {
		color: #666;
		font-size: 11px;
	}

	.back-console-button {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow:
			0 2px 8px rgba(16, 185, 129, 0.3),
			0 0 20px rgba(16, 185, 129, 0.1);
	}

	.back-console-button:hover {
		background: linear-gradient(135deg, #059669 0%, #047857 100%);
		box-shadow:
			0 4px 12px rgba(16, 185, 129, 0.4),
			0 0 30px rgba(16, 185, 129, 0.2);
		transform: translateY(-1px);
	}

	.back-console-button svg {
		width: 16px;
		height: 16px;
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
		background: #0088ff;
		color: white;
	}

	.search-button:hover:not(:disabled) {
		background: #0066cc;
	}

	.search-button:disabled {
		background: #444;
		cursor: not-allowed;
	}

	.clear-button {
		background: #ff4444 !important;
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
		color: #888;
	}

	.status-value {
		font-weight: 500;
	}

	.status-value.connected {
		color: #00ff00;
	}

	.status-value.disconnected {
		color: #ff4444;
	}

	/* Map Container */
	.map-container {
		flex: 1;
		position: relative;
	}

	/* Signal Legend */
	.signal-legend {
		position: absolute;
		bottom: 10px;
		right: 10px;
		background: rgba(42, 42, 42, 0.9);
		border: 1px solid #444;
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

	.legend-color {
		width: 12px;
		height: 12px;
		border-radius: 2px;
		display: inline-block;
	}

	/* Signal Info Bar */
	.signal-info {
		background: #2a2a2a;
		border-top: 1px solid #444;
		padding: 0.5rem 1rem;
		display: flex;
		align-items: center;
		gap: 1rem;
		height: 55px;
		font-size: 12px;
		line-height: 1.2;
	}

	/* Data Footer */
	.data-footer {
		background: #2a2a2a;
		border-top: 1px solid #444;
		padding: 0.5rem 1rem;
		display: flex;
		align-items: center;
		gap: 1rem;
		font-size: 12px;
		color: #ccc;
		height: 55px;
		line-height: 1.2;
	}

	.kismet-label {
		padding-right: 2rem;
		border-right: 1px solid #444;
	}

	.kismet-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.kismet-control-btn {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.75rem;
		font-size: 11px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
		height: 28px;
		white-space: nowrap;
	}

	.kismet-control-btn.btn-start {
		background: #0088ff;
		color: white;
	}

	.kismet-control-btn.btn-start:hover {
		background: #0066cc;
	}

	.kismet-control-btn.btn-stop {
		background: #ff4444;
		color: white;
	}

	.kismet-control-btn.btn-stop:hover {
		background: #ff6666;
	}

	.kismet-control-btn.btn-disabled {
		background: #6b7280;
		color: #9ca3af;
		cursor: not-allowed;
	}

	.kismet-control-btn svg {
		flex-shrink: 0;
	}

	.kismet-title {
		font-weight: 600;
		color: #00d2ff;
		letter-spacing: 0.05em;
		font-size: 12px;
	}

	.hackrf-label {
		padding-right: 1.5rem;
		border-right: 1px solid #444;
	}

	.hackrf-title {
		font-weight: 600;
		color: #fb923c;
		letter-spacing: 0.05em;
		font-size: 12px;
	}

	.frequency-value {
		color: #fb923c;
		font-weight: 500;
	}

	.power-value {
		font-weight: 600;
	}

	.signal-count {
		color: #00ff00;
		font-weight: 600;
	}

	.device-count {
		color: #00d2ff;
		font-weight: 600;
	}

	.frequency-count {
		color: #fb923c;
		font-weight: 600;
	}

	.offline-status {
		color: #ff4444;
	}

	.loading-status {
		color: #888;
		font-style: italic;
	}

	.footer-button {
		background: #333;
		border: 1px solid #555;
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
		background: #444;
		border-color: #666;
		color: #fff;
	}

	/* Saasfly button styles */
	.saasfly-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding: 0.25rem 0.5rem;
		border-radius: 0.375rem;
		font-weight: 500;
		font-size: 11px;
		transition-property: all;
		transition-duration: 200ms;
		border: none;
		cursor: pointer;
		height: 28px;
	}

	.saasfly-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none !important;
	}

	.saasfly-btn svg {
		width: 12px;
		height: 12px;
	}

	/* Load button - Purple gradient */
	.saasfly-btn-load {
		background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%);
		color: white;
		box-shadow:
			0 2px 8px rgba(168, 85, 247, 0.3),
			0 0 20px rgba(168, 85, 247, 0.1);
	}

	.saasfly-btn-load:hover {
		background: linear-gradient(135deg, #9333ea 0%, #7c3aed 100%);
		box-shadow:
			0 4px 12px rgba(168, 85, 247, 0.4),
			0 0 30px rgba(168, 85, 247, 0.2);
		transform: translateY(-1px);
	}

	/* Spectrum analyzer button - Blue gradient */
	.saasfly-btn-spectrum {
		background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
		color: white;
		box-shadow:
			0 2px 8px rgba(59, 130, 246, 0.3),
			0 0 20px rgba(59, 130, 246, 0.1);
	}

	.saasfly-btn-spectrum:hover {
		background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
		box-shadow:
			0 4px 12px rgba(59, 130, 246, 0.4),
			0 0 30px rgba(59, 130, 246, 0.2);
		transform: translateY(-1px);
	}

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
		color: #888;
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

	.device-stat {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		color: #bbb;
	}

	.footer-divider {
		width: 1px;
		height: 16px;
		background: #444;
	}

	.info-content {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.info-label {
		color: #888;
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
		background: #1a1a1a;
	}

	.gps-waiting-content {
		text-align: center;
		color: #888;
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
		background: #2a2a2a;
		color: #ffffff;
		border: 1px solid #444;
		border-radius: 6px;
		box-shadow: 0 3px 14px rgba(0, 0, 0, 0.5);
	}

	:global(.signal-popup .leaflet-popup-tip) {
		background: #2a2a2a;
		border-bottom: 1px solid #444;
		border-right: 1px solid #444;
	}

	:global(.signal-popup .leaflet-popup-content) {
		margin: 12px;
		line-height: 1.4;
	}

	:global(.signal-popup .leaflet-popup-close-button) {
		color: #888;
		font-size: 20px;
		font-weight: normal;
		padding: 4px 4px 0 0;
	}

	:global(.signal-popup .leaflet-popup-close-button:hover) {
		color: #fff;
	}

	/* Pi System Info Popup - styled like Kismet device boxes */
	:global(.pi-popup .leaflet-popup-content-wrapper) {
		background: #2a2a2a;
		border: 1px solid #444;
		border-radius: 6px;
		box-shadow: 0 3px 14px rgba(0, 0, 0, 0.5);
		color: #fff;
	}

	:global(.pi-popup .leaflet-popup-tip) {
		background: #2a2a2a;
		border-bottom: 1px solid #444;
		border-right: 1px solid #444;
	}

	:global(.pi-popup .leaflet-popup-content) {
		margin: 12px;
	}

	:global(.pi-popup .leaflet-popup-close-button) {
		color: #888;
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

		/* Footer MAC input - portrait styles */
		.kismet-whitelist-footer {
			gap: 6px;
		}

		.mac-input-footer {
			width: 110px !important;
			font-size: 11px;
			padding: 4px 6px;
			height: 26px;
		}

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

		.legend-item {
			font-size: 10px;
			display: inline-block;
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

		/* Reduce footer heights for more map space on portrait */
		.signal-info {
			height: 40px !important;
			padding: 8px !important;
			font-size: 11px;
		}

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

		/* HackRF buttons - properly sized for 40px container in portrait */
		.data-footer .saasfly-btn {
			height: 28px !important;
			padding: 3px 8px !important;
			font-size: 10px !important;
			gap: 4px !important;
			display: flex !important;
			align-items: center !important;
			justify-content: center !important;
			white-space: nowrap !important;
		}

		.data-footer .saasfly-btn svg {
			width: 14px !important;
			height: 14px !important;
			flex-shrink: 0 !important;
		}

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

		/* Kismet label compact styling */
		.kismet-label {
			font-size: 10px !important;
			gap: 4px !important;
		}

		.kismet-label svg {
			width: 16px !important;
			height: 16px !important;
		}

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
		.frequency-controls-section {
			gap: 0.5rem;
			flex-direction: column;
			align-items: stretch;
		}

		.frequency-inputs-footer {
			gap: 4px;
			justify-content: center;
		}

		.frequency-input-footer {
			width: 70px;
			font-size: 11px;
			padding: 6px 4px;
		}

		.search-button-footer,
		.clear-button-footer {
			font-size: 11px;
			padding: 6px 12px;
		}
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

		/* Footer MAC input - mobile styles */
		.kismet-whitelist-footer {
			gap: 3px;
		}

		.mac-input-footer {
			width: 100px !important;
			font-size: 10px;
			padding: 2px 4px;
			height: 22px;
		}

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

		.legend-item {
			font-size: 8px;
			display: block;
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
		.signal-info {
			font-size: 9px;
		}

		/* Status items - prevent overlap */
		.status-item {
			white-space: nowrap;
		}

		.status-value {
			font-size: 9px;
		}

		/* Reduce footer heights for more map space */
		.signal-info {
			height: 40px !important;
			padding: 2px 12px !important;
		}

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

		/* HackRF buttons - properly sized for 40px container */
		.data-footer .saasfly-btn {
			height: 24px !important;
			padding: 2px 6px !important;
			font-size: 9px !important;
			gap: 4px !important;
			display: flex !important;
			align-items: center !important;
			justify-content: center !important;
			white-space: nowrap !important;
		}

		.data-footer .saasfly-btn svg {
			width: 12px !important;
			height: 12px !important;
			flex-shrink: 0 !important;
		}

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

		/* Kismet label compact styling */
		.kismet-label {
			font-size: 9px !important;
			gap: 3px !important;
			padding-right: 10px !important; /* Reduced padding */
		}

		.kismet-label svg {
			width: 14px !important;
			height: 14px !important;
		}

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

		/* Kismet footer specific adjustments for landscape */
		.signal-info .footer-section {
			font-size: 8px !important;
			gap: 4px !important;
			flex-wrap: nowrap !important;
			white-space: nowrap !important;
		}

		.signal-info .footer-label {
			font-size: 8px !important;
			margin-right: 2px !important;
			white-space: nowrap !important;
		}

		.signal-info .footer-divider {
			height: 14px !important;
			margin: 0 4px !important;
		}

		/* Fix text cutoff for "Total Devices Whitelisted" in landscape */
		.signal-info .footer-section:last-child {
			min-width: 0;
			flex: 0 1 auto;
		}

		.signal-info .footer-section:last-child .footer-label {
			font-size: 7px !important; /* Smaller font for the long text */
		}

		/* Ensure signal distribution icons don't overflow */
		.signal-info .signal-stat,
		.signal-info .device-stat {
			font-size: 7px !important;
			gap: 2px !important;
		}

		.signal-info .signal-indicator {
			width: 8px !important;
			height: 8px !important;
		}

		.signal-info svg {
			width: 12px !important;
			height: 12px !important;
		}

		/* Reduce gap between footer sections */
		.signal-info {
			gap: 8px !important;
		}

		/* Footer frequency controls - landscape mobile */
		.frequency-controls-section {
			gap: 0.3rem;
			flex-direction: row;
			flex-wrap: nowrap;
		}

		.frequency-inputs-footer {
			gap: 2px;
		}

		.frequency-input-footer {
			width: 55px;
			font-size: 10px;
			padding: 4px 2px;
		}

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

		/* Signal info */
		.signal-info {
			padding: 0.75rem;
			font-size: 12px;
		}

		/* Footer - stack all sections vertically */
		.footer {
			grid-template-columns: 1fr !important;
			gap: 15px;
			padding: 15px 10px;
		}

		.footer-section {
			border-right: none !important;
			border-bottom: 1px solid rgba(0, 220, 255, 0.2);
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
</style>
