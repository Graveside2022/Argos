<script lang="ts">
	import { onMount } from 'svelte';
	import { kismetStore } from '$lib/stores/kismet';
	
	export let height = '400px';
	export let showControls = true;
	
	let mapContainer: HTMLDivElement;
	let centerLat = 0;
	let centerLon = 0;
	let zoomLevel = 13;
	
	// Placeholder for future map integration
	// This could integrate with Leaflet, Mapbox, or other mapping libraries
	
	onMount(() => {
		// Subscribe to GPS updates from the store
		const unsubscribe = kismetStore.subscribe($store => {
			if ($store.gps.lat !== 'N/A' && $store.gps.lon !== 'N/A') {
				centerLat = parseFloat($store.gps.lat);
				centerLon = parseFloat($store.gps.lon);
			}
		});
		
		return () => {
			unsubscribe();
		};
	});
	
	function zoomIn() {
		if (zoomLevel < 18) zoomLevel++;
	}
	
	function zoomOut() {
		if (zoomLevel > 1) zoomLevel--;
	}
	
	function centerOnGPS() {
		// Center map on current GPS location
		// TODO: Implement GPS centering logic
	}
</script>

<div class="map-view" style="height: {height}">
	<div class="map-header">
		<h3>Device Map</h3>
		{#if showControls}
			<div class="map-controls">
				<button class="map-control-btn" on:click={zoomIn} title="Zoom In">
					<span>+</span>
				</button>
				<button class="map-control-btn" on:click={zoomOut} title="Zoom Out">
					<span>-</span>
				</button>
				<button class="map-control-btn" on:click={centerOnGPS} title="Center on GPS">
					<span>⊕</span>
				</button>
			</div>
		{/if}
	</div>
	
	<div class="map-container" bind:this={mapContainer}>
		<div class="map-placeholder">
			<div class="map-grid">
				{#each Array(5) as _, _row}
					{#each Array(5) as _, _col}
						<div class="grid-cell"></div>
					{/each}
				{/each}
			</div>
			
			<div class="map-info">
				<p class="placeholder-text">Map View</p>
				<p class="coordinates">
					{centerLat.toFixed(6)}°, {centerLon.toFixed(6)}°
				</p>
				<p class="zoom-info">Zoom: {zoomLevel}</p>
			</div>
			
			<!-- Animated radar sweep effect -->
			<div class="radar-sweep"></div>
		</div>
	</div>
	
	<div class="map-legend">
		<div class="legend-item">
			<span class="legend-icon wifi-ap">📡</span>
			<span class="legend-label">WiFi AP</span>
		</div>
		<div class="legend-item">
			<span class="legend-icon wifi-client">📱</span>
			<span class="legend-label">Client</span>
		</div>
		<div class="legend-item">
			<span class="legend-icon bluetooth">🔷</span>
			<span class="legend-label">Bluetooth</span>
		</div>
	</div>
</div>

<style>
	.map-view {
		display: flex;
		flex-direction: column;
		background: rgba(12, 22, 48, 0.65);
		border: 1px solid rgba(0, 190, 215, 0.35);
		border-radius: 8px;
		overflow: hidden;
	}

	.map-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background: rgba(12, 22, 48, 0.85);
		border-bottom: 2px solid #00d2ff;
		box-shadow: 0 0 20px rgba(0, 220, 255, 0.5);
	}

	.map-header h3 {
		margin: 0;
		font-size: 1em;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 2px;
		color: #fff;
		text-shadow: 0 0 10px rgba(124, 58, 237, 0.8);
	}

	.map-controls {
		display: flex;
		gap: 4px;
	}

	.map-control-btn {
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid #00d2ff;
		border-radius: 4px;
		color: #00d2ff;
		cursor: pointer;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.3s ease;
		font-size: 1.2em;
		font-weight: bold;
	}

	.map-control-btn:hover {
		background: rgba(0, 210, 255, 0.2);
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(0, 210, 255, 0.3);
	}

	.map-control-btn:active {
		transform: translateY(0);
	}

	.map-container {
		flex: 1;
		position: relative;
		overflow: hidden;
		background: rgba(3, 6, 16, 0.8);
	}

	.map-placeholder {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: 
			radial-gradient(circle at center, rgba(0, 190, 215, 0.1) 0%, transparent 70%);
	}

	.map-grid {
		position: absolute;
		inset: 0;
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		grid-template-rows: repeat(5, 1fr);
		opacity: 0.1;
	}

	.grid-cell {
		border: 1px solid #00d2ff;
		background: linear-gradient(45deg, 
			transparent 48%, 
			rgba(0, 210, 255, 0.1) 50%, 
			transparent 52%
		);
	}

	.map-info {
		position: relative;
		text-align: center;
		z-index: 2;
		background: rgba(12, 22, 48, 0.9);
		padding: 20px 40px;
		border-radius: 8px;
		border: 1px solid rgba(0, 190, 215, 0.4);
		box-shadow: 0 0 30px rgba(0, 220, 255, 0.3);
	}

	.placeholder-text {
		margin: 0;
		font-size: 1.5em;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 3px;
		color: #00d2ff;
		text-shadow: 0 0 20px rgba(0, 210, 255, 0.8);
		margin-bottom: 10px;
	}

	.coordinates {
		margin: 5px 0;
		font-family: 'Courier New', monospace;
		color: #c0e8ff;
		font-size: 0.9em;
	}

	.zoom-info {
		margin: 5px 0;
		color: #737373;
		font-size: 0.85em;
	}

	.radar-sweep {
		position: absolute;
		inset: 0;
		background: conic-gradient(
			from 0deg,
			transparent 0deg,
			rgba(0, 210, 255, 0.3) 30deg,
			transparent 60deg,
			transparent 360deg
		);
		animation: radar-rotate 4s linear infinite;
		opacity: 0.6;
		mix-blend-mode: screen;
	}

	@keyframes radar-rotate {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.map-legend {
		display: flex;
		gap: 16px;
		padding: 8px 16px;
		background: rgba(12, 22, 48, 0.85);
		border-top: 1px solid rgba(0, 190, 215, 0.35);
		font-size: 0.85em;
		justify-content: center;
		flex-wrap: wrap;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.legend-icon {
		font-size: 1.2em;
	}

	.legend-label {
		color: #c0e8ff;
	}

	/* Mobile optimization */
	@media (max-width: 768px) {
		.map-header {
			padding: 10px 12px;
		}

		.map-control-btn {
			width: 36px;
			height: 36px;
		}

		.map-info {
			padding: 16px 24px;
		}

		.placeholder-text {
			font-size: 1.2em;
		}

		.map-legend {
			padding: 6px 12px;
			font-size: 0.8em;
		}
	}
</style>