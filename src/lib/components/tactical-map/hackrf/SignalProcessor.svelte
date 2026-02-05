<script lang="ts">
	import { onMount } from 'svelte';
	import { HackRFService } from '$lib/services/tactical-map/hackrfService';
	import { MapService } from '$lib/services/tactical-map/mapService';
	import {
		hackrfStore,
		addSignal,
		updateSignal,
		addSignalMarker
	} from '$lib/stores/tactical-map/hackrfStore';
	import { mapStore } from '$lib/stores/tactical-map/mapStore';
	import { gpsStore } from '$lib/stores/tactical-map/gpsStore';
	import type { SimplifiedSignal } from '$lib/stores/tactical-map/hackrfStore';

	interface Props {
		updateRate?: number;
		tolerance?: number;
	}

	let { updateRate = 2000, tolerance = 5 }: Props = $props();

	const hackrfService = new HackRFService();
	const _mapService = new MapService();

	let processingInterval: NodeJS.Timeout | null = null;
	let L: any = null; // Leaflet library

	let hackrfState = $derived($hackrfStore);
	let mapState = $derived($mapStore);
	let gpsState = $derived($gpsStore);

	onMount(async () => {
		// Import Leaflet dynamically
		if (typeof window !== 'undefined') {
			L = (await import('leaflet')).default;
		}

		// Start signal processing interval
		processingInterval = setInterval(() => {
			if (hackrfState.isSearching && mapState.map) {
				processSignals();
			}
		}, updateRate);

		return () => {
			if (processingInterval) {
				clearInterval(processingInterval);
				processingInterval = null;
			}
		};
	});

	function processSignals() {
		if (!hackrfState.isSearching || !mapState.map || !L) return;

		// Get aggregated signals matching target frequency
		const aggregatedSignals = hackrfService.getAggregatedSignals(
			hackrfState.targetFrequency,
			tolerance
		);

		if (aggregatedSignals.length === 0) return;

		// Get current user position
		const userPosition = {
			lat: gpsState.position.lat,
			lon: gpsState.position.lon
		};

		aggregatedSignals.forEach((signal) => {
			const signalId = `signal_${signal.frequency.toFixed(1)}_${signal.lat.toFixed(6)}_${signal.lon.toFixed(6)}`;

			// Update or add signal to store
			if (hackrfState.signals.has(signalId)) {
				updateSignal(signalId, signal);
			} else {
				addSignal({ ...signal, id: signalId });
			}

			// Create or update marker
			updateSignalMarker(signalId, signal, userPosition);
		});
	}

	function updateSignalMarker(
		signalId: string,
		signal: SimplifiedSignal,
		userPosition: { lat: number; lon: number }
	) {
		if (!L || !mapState.map) return;

		const existingMarker = hackrfState.signalMarkers.get(signalId);

		if (existingMarker) {
			// Update existing marker
			existingMarker.setLatLng([signal.lat, signal.lon]);

			// Update popup content
			const popupContent = createSignalPopupContent(signal, userPosition);
			if (existingMarker.isPopupOpen()) {
				existingMarker.setPopupContent(popupContent);
			} else {
				existingMarker.getPopup().setContent(popupContent);
			}
		} else {
			// Create new marker
			const color = getSignalColor(signal.power);
			const marker = L.circleMarker([signal.lat, signal.lon], {
				radius: Math.max(4, Math.min(20, signal.count * 2)),
				color: color,
				fillColor: color,
				fillOpacity: 0.6,
				weight: 2
			});

			// Bind popup
			const popupContent = createSignalPopupContent(signal, userPosition);
			marker.bindPopup(popupContent, {
				maxWidth: 300,
				className: 'signal-popup',
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
			addSignalMarker(signalId, marker);
		}
	}

	function createSignalPopupContent(
		signal: SimplifiedSignal,
		userPosition: { lat: number; lon: number }
	): string {
		// Calculate distance from user
		const distance = calculateDistance(
			userPosition.lat,
			userPosition.lon,
			signal.lat,
			signal.lon
		);

		const timestamp = new Date(signal.timestamp).toLocaleTimeString();

		return `
			<div style="font-family: 'Courier New', monospace; min-width: 200px; color: #ffffff;">
				<h4 style="margin: 0 0 8px 0; color: ${getSignalColor(signal.power)}; font-size: 14px;">
					📡 Signal Detection
				</h4>
				<table style="width: 100%; border-collapse: collapse; font-size: 11px;">
					<tr>
						<td style="padding: 2px 8px 2px 0; font-weight: bold; color: #88ff88;">Frequency:</td>
						<td style="padding: 2px 0; color: #fbbf24; font-weight: bold;">${signal.frequency.toFixed(1)} MHz</td>
					</tr>
					<tr>
						<td style="padding: 2px 8px 2px 0; font-weight: bold; color: #88ff88;">Power:</td>
						<td style="padding: 2px 0; color: ${getSignalColor(signal.power)}; font-weight: bold;">${signal.power.toFixed(1)} dBm</td>
					</tr>
					<tr>
						<td style="padding: 2px 8px 2px 0; font-weight: bold; color: #88ff88;">Count:</td>
						<td style="padding: 2px 0; color: #ffffff;">${signal.count}</td>
					</tr>
					<tr>
						<td style="padding: 2px 8px 2px 0; font-weight: bold; color: #88ff88;">Distance:</td>
						<td style="padding: 2px 0; color: #ffffff;">${distance.toFixed(0)} m</td>
					</tr>
					<tr>
						<td style="padding: 2px 8px 2px 0; font-weight: bold; color: #88ff88;">Time:</td>
						<td style="padding: 2px 0; color: #ffffff;">${timestamp}</td>
					</tr>
					<tr>
						<td style="padding: 2px 8px 2px 0; font-weight: bold; color: #88ff88;">Position:</td>
						<td style="padding: 2px 0; color: #88ff88; font-family: monospace;">${signal.lat.toFixed(6)}, ${signal.lon.toFixed(6)}</td>
					</tr>
				</table>
			</div>
		`;
	}

	function getSignalColor(power: number): string {
		if (power > -60) return '#dc2626'; // Red - strong signal
		if (power > -80) return '#fbbf24'; // Orange - medium signal
		return '#4ade80'; // Green - weak signal
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

	// Export function to clear signal markers
	export function clearSignalMarkers() {
		if (mapState.map) {
			hackrfState.signalMarkers.forEach((marker) => {
				mapState.map?.removeLayer(marker);
			});
		}
		// Clear from store
		hackrfService.flushAggregator();
	}
</script>

<!-- This component processes and displays HackRF signals on the map -->
<!-- It has no visual representation but manages signal detection and visualization -->
