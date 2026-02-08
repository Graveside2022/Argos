<script lang="ts">
	import { onMount } from 'svelte';
	import { KismetService } from '$lib/services/tactical-map/kismet-service';
	import { MapService } from '$lib/services/tactical-map/map-service';
	import {
		kismetStore,
		addKismetDeviceMarker,
		removeKismetDeviceMarker
	} from '$lib/stores/tactical-map/kismet-store';
	import { mapStore } from '$lib/stores/tactical-map/map-store';
	import { gpsStore } from '$lib/stores/tactical-map/gps-store';
	import type { KismetDevice } from '$lib/types/kismet';

	const _kismetService = new KismetService();
	const _mapService = new MapService();

	let L: any = null; // Leaflet library
	let deviceObservers = new Map<string, any>(); // Track device changes

	let kismetState = $derived($kismetStore);
	let mapState = $derived($mapStore);
	let gpsState = $derived($gpsStore);

	onMount(async () => {
		// Import Leaflet dynamically
		if (typeof window !== 'undefined') {
			L = (await import('leaflet')).default;
		}

		return () => {
			// Clean up device markers and observers
			clearAllDeviceMarkers();
			deviceObservers.clear();
		};
	});

	// Reactive statement to handle device changes
	$effect(() => {
		if (L && mapState.map && kismetState.devices) {
			updateDeviceMarkers();
		}
	});

	function updateDeviceMarkers() {
		if (!L || !mapState.map) return;

		// Filter devices by whitelist if specified
		const filteredDevices = filterDevicesByWhitelist();

		// Remove markers for devices no longer present
		kismetState.deviceMarkers.forEach((marker, markerId) => {
			if (markerId.startsWith('kismet_')) {
				const mac = markerId.replace('kismet_', '');
				if (!filteredDevices.has(mac)) {
					mapState.map?.removeLayer(marker);
					removeKismetDeviceMarker(mac);
				}
			}
		});

		// Add or update markers for current devices
		filteredDevices.forEach((device, mac) => {
			const markerId = `kismet_${mac}`;
			const existingMarker = kismetState.deviceMarkers.get(markerId);

			if (existingMarker) {
				// Update existing marker
				if (device.location?.lat && device.location?.lon) {
					existingMarker.setLatLng([device.location.lat, device.location.lon]);

					// Update popup content if open
					const popupContent = createDevicePopupContent(device);
					if (existingMarker.isPopupOpen()) {
						existingMarker.setPopupContent(popupContent);
					} else {
						existingMarker.getPopup().setContent(popupContent);
					}
				}
			} else if (device.location?.lat && device.location?.lon) {
				// Create new marker
				createDeviceMarker(device);
			}
		});
	}

	function filterDevicesByWhitelist(): Map<string, KismetDevice> {
		const filtered = new Map<string, KismetDevice>();

		kismetState.devices.forEach((device, mac) => {
			// Apply whitelist filter if specified
			if (kismetState.whitelistMAC && kismetState.whitelistMAC.trim()) {
				const whitelist = kismetState.whitelistMAC.toLowerCase().trim();
				if (!mac.toLowerCase().includes(whitelist)) {
					return; // Skip this device
				}
			}
			filtered.set(mac, device);
		});

		return filtered;
	}

	function createDeviceMarker(device: KismetDevice) {
		if (!L || !mapState.map || !device.location?.lat || !device.location?.lon) return;

		const color = getDeviceColor(device.type);
		const _icon = getDeviceIcon(device.type);

		// Create circle marker for device
		const marker = L.circleMarker([device.location.lat, device.location.lon], {
			radius: 8,
			color: color,
			fillColor: color,
			fillOpacity: 0.7,
			weight: 2,
			className: 'kismet-device-marker'
		});

		// Bind popup with device information
		const popupContent = createDevicePopupContent(device);
		marker.bindPopup(popupContent, {
			maxWidth: 350,
			className: 'device-popup',
			autoClose: false,
			closeOnClick: false
		});

		// Add click handler
		marker.on('click', () => {
			marker.openPopup();
		});

		// Add to map
		marker.addTo(mapState.map);

		// Store marker
		addKismetDeviceMarker(device.mac, marker);
	}

	function createDevicePopupContent(device: KismetDevice): string {
		// Calculate distance from user if GPS available
		let distanceInfo = '';
		if (gpsState.status.hasGPSFix && device.location?.lat && device.location?.lon) {
			const distance = calculateDistance(
				gpsState.position.lat,
				gpsState.position.lon,
				device.location.lat,
				device.location.lon
			);
			distanceInfo = `
				<tr>
					<td style="padding: 2px 8px 2px 0; font-weight: bold; color: #88ff88;">Distance:</td>
					<td style="padding: 2px 0; color: #ffffff;">${distance.toFixed(0)} m</td>
				</tr>
			`;
		}

		const lastSeen = device.last_seen
			? new Date(device.last_seen * 1000).toLocaleTimeString()
			: 'Unknown';
		const encryption = 'None'; // Encryption info not available in current interface
		const channel = device.channel?.toString() || 'Unknown';

		return `
			<div style="font-family: 'Courier New', monospace; min-width: 250px; color: #ffffff;">
				<h4 style="margin: 0 0 8px 0; color: ${getDeviceColor(device.type)}; font-size: 14px;">
					${getDeviceIcon(device.type)} ${device.type || 'Unknown Device'}
				</h4>
				<table style="width: 100%; border-collapse: collapse; font-size: 11px;">
					<tr>
						<td style="padding: 2px 8px 2px 0; font-weight: bold; color: #88ff88;">MAC:</td>
						<td style="padding: 2px 0; color: #fbbf24; font-family: monospace; font-weight: bold;">${device.mac}</td>
					</tr>
					${
						device.manufacturer
							? `
					<tr>
						<td style="padding: 2px 8px 2px 0; font-weight: bold; color: #88ff88;">Manufacturer:</td>
						<td style="padding: 2px 0; color: #ffffff;">${device.manufacturer}</td>
					</tr>
					`
							: ''
					}
					<tr>
						<td style="padding: 2px 8px 2px 0; font-weight: bold; color: #88ff88;">Channel:</td>
						<td style="padding: 2px 0; color: #ffffff;">${channel}</td>
					</tr>
					<tr>
						<td style="padding: 2px 8px 2px 0; font-weight: bold; color: #88ff88;">Encryption:</td>
						<td style="padding: 2px 0; color: ${encryption === 'None' ? '#f87171' : '#44ff44'};">${encryption}</td>
					</tr>
					${
						device.signal.last_signal
							? `
					<tr>
						<td style="padding: 2px 8px 2px 0; font-weight: bold; color: #88ff88;">Signal:</td>
						<td style="padding: 2px 0; color: ${getSignalColor(device.signal.last_signal)}; font-weight: bold;">${device.signal.last_signal} dBm</td>
					</tr>
					`
							: ''
					}
					${distanceInfo}
					<tr>
						<td style="padding: 2px 8px 2px 0; font-weight: bold; color: #88ff88;">Last Seen:</td>
						<td style="padding: 2px 0; color: #ffffff;">${lastSeen}</td>
					</tr>
					${
						device.location?.lat && device.location?.lon
							? `
					<tr>
						<td style="padding: 2px 8px 2px 0; font-weight: bold; color: #88ff88;">Position:</td>
						<td style="padding: 2px 0; color: #88ff88; font-family: monospace;">${device.location.lat.toFixed(6)}, ${device.location.lon.toFixed(6)}</td>
					</tr>
					`
							: ''
					}
				</table>
			</div>
		`;
	}

	function getDeviceColor(type: string | undefined): string {
		switch (type?.toLowerCase()) {
			case 'wi-fi ap':
			case 'access point':
				return '#00aaff'; // Blue for APs
			case 'wi-fi device':
			case 'station':
				return '#4ade80'; // Green for clients
			case 'bluetooth':
				return '#f97316'; // Orange for Bluetooth
			case 'zigbee':
				return '#ff00ff'; // Magenta for Zigbee
			case 'probe':
				return '#fbbf24'; // Yellow for probes
			default:
				return '#ffffff'; // White for unknown
		}
	}

	function getDeviceIcon(type: string | undefined): string {
		switch (type?.toLowerCase()) {
			case 'wi-fi ap':
			case 'access point':
				return '📶'; // WiFi AP
			case 'wi-fi device':
			case 'station':
				return '📱'; // Client device
			case 'bluetooth':
				return '🔷'; // Bluetooth
			case 'zigbee':
				return '🔗'; // Zigbee
			case 'probe':
				return '🔍'; // Probe request
			default:
				return '❓'; // Unknown
		}
	}

	function getSignalColor(signal: number): string {
		if (signal > -50) return '#4ade80'; // Green - excellent signal
		if (signal > -70) return '#fbbf24'; // Yellow - good signal
		if (signal > -85) return '#fbbf24'; // Orange - fair signal
		return '#f87171'; // Red - poor signal
	}

	function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
		const R = 6371000; // Earth's radius in meters
		const φ1 = (lat1 * Math.PI) / 180;
		const φ2 = (lat2 * Math.PI) / 180;
		const Δφ = ((lat2 - lat1) * Math.PI) / 180;
		const Δλ = ((lon2 - lon1) * Math.PI) / 180;

		const a =
			Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
			Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

		return R * c;
	}

	// Export function to clear all device markers
	export function clearAllDeviceMarkers() {
		if (mapState.map) {
			kismetState.deviceMarkers.forEach((marker, markerId) => {
				if (markerId.startsWith('kismet_')) {
					mapState.map?.removeLayer(marker);
				}
			});
		}
	}
</script>

<!-- This component manages Kismet device visualization on the map -->
<!-- It has no visual representation but handles device marker creation and updates -->

<style>
	:global(.kismet-device-marker) {
		transition: all 0.3s ease;
	}

	:global(.kismet-device-marker:hover) {
		filter: brightness(1.2);
		transform: scale(1.1);
	}

	:global(.device-popup .leaflet-popup-content-wrapper) {
		background: rgba(0, 0, 0, 0.95);
		border: 1px solid #4ade80;
		border-radius: 6px;
		box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
	}

	:global(.device-popup .leaflet-popup-content) {
		margin: 0;
		padding: 0;
	}

	:global(.device-popup .leaflet-popup-tip) {
		background: rgba(0, 0, 0, 0.95);
		border: 1px solid #4ade80;
	}

	:global(.device-popup .leaflet-popup-close-button) {
		color: #4ade80;
		font-size: 16px;
		font-weight: bold;
		padding: 4px 8px;
	}

	:global(.device-popup .leaflet-popup-close-button:hover) {
		color: #ffffff;
		background: rgba(0, 255, 0, 0.2);
	}
</style>
