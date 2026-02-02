<!-- 
Integration Example for RSSI Localization in tactical-map-simple
Add these changes to your +page.svelte file
-->

<script lang="ts">
	// Add to imports section
	import { onMount, onDestroy } from 'svelte';
	import type { KismetDevice } from '$lib/server/kismet/types';
	import RSSILocalizationControls from '$lib/components/map/RSSILocalizationControls.svelte';
	import { RSSIMapIntegration, addRSSIClickHandler } from './rssi-integration';
	import L from 'leaflet';

	// Add to variables section
	let rssiIntegration: RSSIMapIntegration | null = null;
	let selectedRSSIDevice: string | null = null;
	let rssiEnabled = false;
	let map: any = null;
	let kismetStatus = 'stopped';
	let devices: KismetDevice[] = [];
	let marker: any = null;

	// Mock device icon SVG
	const deviceIconSVG = '<div class="device-icon">📱</div>';

	// Add to onMount, after map initialization
	onMount(async () => {
		// ... existing map initialization code ...

		// Initialize RSSI integration
		if (map) {
			rssiIntegration = new RSSIMapIntegration(map);
			await rssiIntegration.initialize();
		}

		// ... rest of onMount ...
	});

	// Update fetchKismetDevices function
	async function _fetchKismetDevices() {
		if (!map || kismetStatus !== 'running') return;

		try {
			const response = await fetch('/api/kismet/devices');
			if (response.ok) {
				const data = await response.json();

				// Process devices for RSSI localization
				if (rssiIntegration && rssiEnabled) {
					rssiIntegration.processDevices(data.devices);
				}

				// ... existing device processing code ...

				devices.forEach((device: KismetDevice) => {
					// ... existing marker creation code ...

					// Add RSSI click handler to marker
					if (rssiIntegration && marker) {
						addRSSIClickHandler(marker, device.macaddr, rssiIntegration);
					}

					// Highlight selected device
					if (selectedRSSIDevice === device.macaddr) {
						marker.setIcon(
							L.divIcon({
								html: deviceIconSVG,
								iconSize: [50, 50], // Larger for selected
								iconAnchor: [25, 25],
								className: 'kismet-marker selected-rssi'
							})
						);
					}
				});

				// ... rest of function ...
			}
		} catch (error) {
			console.error('Error fetching Kismet devices:', error);
		}
	}

	// Handle RSSI toggle
	function handleRSSIToggle(enabled: boolean) {
		rssiEnabled = enabled;
		if (rssiIntegration) {
			if (enabled) {
				rssiIntegration.enableHeatmap();
			} else {
				rssiIntegration.disableHeatmap();
			}
		}
	}

	// Add to onDestroy
	onDestroy(() => {
		// ... existing cleanup ...

		if (rssiIntegration) {
			rssiIntegration.destroy();
		}
	});
</script>

<!-- Add the RSSI controls component to your template -->
<div class="map-container">
	<!-- ... existing map div ... -->

	<!-- Add RSSI Localization Controls -->
	<RSSILocalizationControls
		selectedDevice={selectedRSSIDevice}
		onHeatmapToggle={handleRSSIToggle}
	/>
</div>

<style>
	/* Add styles for selected RSSI device */
	:global(.kismet-marker.selected-rssi) {
		filter: drop-shadow(0 0 10px #f97316);
		animation: pulse-glow 2s ease-in-out infinite;
	}

	@keyframes pulse-glow {
		0%,
		100% {
			filter: drop-shadow(0 0 10px #f97316);
		}
		50% {
			filter: drop-shadow(0 0 20px #f97316);
		}
	}
</style>
