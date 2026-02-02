<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { MapService } from '$lib/services/tactical-map/mapService';
	import { mapStore } from '$lib/stores/tactical-map/mapStore';
	import { gpsStore } from '$lib/stores/tactical-map/gpsStore';

	export let onMapInitialized: ((map: any) => void) | undefined = undefined;

	const mapService = new MapService();
	let mapContainer: HTMLDivElement;
	let isMapReady = false;

	$: gpsState = $gpsStore;
	$: mapState = $mapStore;

	// Initialize map when GPS fix is obtained
	$: if (gpsState.status.hasGPSFix && !mapState.isInitialized && mapContainer && !isMapReady) {
		initializeMap();
	}

	async function initializeMap() {
		if (isMapReady) return;

		isMapReady = true;

		try {
			const map = await mapService.initializeMap(mapContainer);
			if (map && onMapInitialized) {
				onMapInitialized(map);
			}
		} catch (error) {
			console.error('Failed to initialize map:', error);
			isMapReady = false;
		}
	}

	onMount(async () => {
		await mapService.initializeLeaflet();
	});

	onDestroy(() => {
		const _mapState = mapStore;
		// Cleanup is handled by the MapService when the store is cleared
	});
</script>

<!-- Map Container -->
<div class="map-container">
	{#if !gpsState.status.hasGPSFix}
		<div class="map-placeholder">
			<div class="placeholder-content">
				<div class="loading-spinner"></div>
				<p>Waiting for GPS fix...</p>
				<p class="status">{gpsState.status.gpsStatus}</p>
			</div>
		</div>
	{:else}
		<div bind:this={mapContainer} class="leaflet-map"></div>
	{/if}
</div>

<style>
	.map-container {
		width: 100%;
		height: 600px;
		position: relative;
		border: 2px solid #4ade80;
		border-radius: 8px;
		overflow: hidden;
		background: #001100;
	}

	.leaflet-map {
		width: 100%;
		height: 100%;
	}

	.map-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 20, 0, 0.9);
		color: #4ade80;
		font-family: 'Courier New', monospace;
	}

	.placeholder-content {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(0, 255, 0, 0.3);
		border-top: 3px solid #4ade80;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.placeholder-content p {
		margin: 0;
		font-size: 16px;
	}

	.status {
		font-size: 14px;
		opacity: 0.8;
		color: #88ff88;
	}

	/* Override Leaflet styles for tactical theme */
	:global(.leaflet-control-container) {
		font-family: 'Courier New', monospace !important;
	}

	:global(.leaflet-popup-content-wrapper) {
		background: rgba(0, 20, 0, 0.95) !important;
		border: 1px solid #4ade80 !important;
		border-radius: 4px !important;
		color: #4ade80 !important;
		font-family: 'Courier New', monospace !important;
	}

	:global(.leaflet-popup-tip) {
		background: rgba(0, 20, 0, 0.95) !important;
		border: 1px solid #4ade80 !important;
	}

	:global(.pi-popup) {
		background: rgba(0, 20, 0, 0.95) !important;
		border: 1px solid #4ade80 !important;
		border-radius: 4px !important;
		color: #4ade80 !important;
		font-family: 'Courier New', monospace !important;
	}

	:global(.signal-popup) {
		background: rgba(20, 0, 0, 0.95) !important;
		border: 1px solid #ff4400 !important;
		border-radius: 4px !important;
		color: #ff4400 !important;
		font-family: 'Courier New', monospace !important;
	}
</style>
