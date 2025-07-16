<script lang="ts">
	import { gpsStore } from '$lib/stores/tactical-map/gpsStore';
	import { GPSService } from '$lib/services/tactical-map/gpsService';
	import { onMount, onDestroy } from 'svelte';

	const gpsService = new GPSService();
	let showDetails = false;

	onMount(() => {
		// Start GPS tracking
		gpsService.startPositionUpdates();
	});

	onDestroy(() => {
		// Stop GPS tracking
		gpsService.stopPositionUpdates();
	});

	$: ({ status } = $gpsStore);
	
	// Debug logging - commented out for production
	// $: console.log('[GPS Button Debug] Status:', status);
	// $: console.log('[GPS Button Debug] hasGPSFix:', status.hasGPSFix, 'fixType:', status.fixType, 'satellites:', status.satellites);

	function toggleDetails() {
		showDetails = !showDetails;
	}

	function getStatusColor() {
		if (status.hasGPSFix) {
			return status.fixType === '3D' ? '#00ff00' : '#ffff00';
		}
		return '#ff4400';
	}

	function getStatusIcon() {
		// Return different icon based on GPS status
		return status.hasGPSFix ? 'fix' : 'searching';
	}

	function getButtonClass() {
		const buttonClass = status.hasGPSFix 
			? (status.fixType === '3D' ? 'saasfly-btn-add' : 'saasfly-btn-spectrum')
			: 'saasfly-btn-stop';
		// console.log('[GPS Button Debug] Button class:', buttonClass);
		return buttonClass;
	}
</script>

<div class="gps-button-container">
	<button
		class="saasfly-btn {getButtonClass()}"
		on:click={toggleDetails}
		title="GPS Status: {status.gpsStatus}"
	>
		{#if getStatusIcon() === 'fix'}
			<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
				<path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
			</svg>
		{:else}
			<svg class="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
				<path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.88.869a7 7 0 1011.2 8.42c.067-.435.098-.892.09-1.347a1 1 0 00-1.7-.71 5 5 0 01-7.26-6.847zm-3.89 3.89a2.5 2.5 0 003.5 2.056A4.002 4.002 0 018 10a4 4 0 01-.505-7.554zM10 13a1 1 0 100 2 1 1 0 000-2z" />
			</svg>
		{/if}
		{status.fixType} ({status.satellites})
	</button>

	{#if showDetails}
		<div class="gps-details-popup">
			<div class="popup-header">
				<span class="popup-title">GPS Status</span>
				<button class="close-btn" on:click={toggleDetails}>×</button>
			</div>
			
			<div class="popup-content">
				<div class="status-row">
					<span class="label">Status:</span>
					<span class="value" style="color: {getStatusColor()};">{status.gpsStatus}</span>
				</div>
				
				<div class="status-row">
					<span class="label">Fix Type:</span>
					<span class="value" style="color: {getStatusColor()};">{status.fixType}</span>
				</div>
				
				<div class="status-row">
					<span class="label">Satellites:</span>
					<span class="value">{status.satellites}</span>
				</div>
				
				{#if status.hasGPSFix}
					<div class="status-row">
						<span class="label">Accuracy:</span>
						<span class="value">{status.accuracy.toFixed(1)}m</span>
					</div>
					
					<div class="status-row">
						<span class="label">Coordinates:</span>
						<span class="value">{status.formattedCoords.lat}, {status.formattedCoords.lon}</span>
					</div>
					
					<div class="status-row">
						<span class="label">MGRS:</span>
						<span class="value">{status.mgrsCoord}</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.gps-button-container {
		position: relative;
	}

	/* Saasfly button base styles */
	:global(.saasfly-btn) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-weight: 500;
		transition-property: all;
		transition-duration: 200ms;
	}

	:global(.saasfly-btn:focus) {
		outline: none;
		box-shadow:
			0 0 0 2px var(--bg-primary),
			0 0 0 4px currentColor;
	}

	/* Add button - Green gradient (for 3D GPS fix) */
	:global(.saasfly-btn-add) {
		background: linear-gradient(135deg, #34d399 0%, #10b981 100%) !important;
		color: white !important;
		border: none !important;
		box-shadow:
			0 2px 8px rgba(52, 211, 153, 0.3),
			0 0 20px rgba(52, 211, 153, 0.1) !important;
	}

	:global(.saasfly-btn-add:hover) {
		background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
		box-shadow:
			0 4px 12px rgba(52, 211, 153, 0.4),
			0 0 30px rgba(52, 211, 153, 0.2) !important;
		transform: translateY(-1px);
	}

	/* Spectrum button - Blue gradient (for 2D GPS fix) */
	:global(.saasfly-btn-spectrum) {
		background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
		color: white !important;
		border: none !important;
		box-shadow:
			0 2px 8px rgba(59, 130, 246, 0.3),
			0 0 20px rgba(59, 130, 246, 0.1) !important;
	}

	:global(.saasfly-btn-spectrum:hover) {
		background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
		box-shadow:
			0 4px 12px rgba(59, 130, 246, 0.4),
			0 0 30px rgba(59, 130, 246, 0.2) !important;
		transform: translateY(-1px);
	}

	/* Stop button - Red gradient (for no GPS fix) */
	:global(.saasfly-btn-stop) {
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
		color: white !important;
		border: none !important;
		box-shadow:
			0 2px 8px rgba(239, 68, 68, 0.3),
			0 0 20px rgba(239, 68, 68, 0.1) !important;
	}

	:global(.saasfly-btn-stop:hover) {
		background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%) !important;
		box-shadow:
			0 4px 12px rgba(239, 68, 68, 0.4),
			0 0 30px rgba(239, 68, 68, 0.2) !important;
		transform: translateY(-1px);
	}

	.gps-details-popup {
		position: absolute;
		top: 100%;
		right: 0;
		z-index: 1000;
		background: rgba(0, 0, 0, 0.95);
		border: 1px solid #333;
		border-radius: 8px;
		padding: 0;
		min-width: 280px;
		backdrop-filter: blur(10px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
		margin-top: 8px;
	}

	.popup-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px;
		border-bottom: 1px solid #333;
		background: rgba(0, 0, 0, 0.7);
	}

	.popup-title {
		font-weight: bold;
		color: #fff;
		font-size: 14px;
	}

	.close-btn {
		background: none;
		border: none;
		color: #ccc;
		font-size: 18px;
		cursor: pointer;
		padding: 0;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.close-btn:hover {
		color: #fff;
	}

	.popup-content {
		padding: 12px;
		font-family: 'Courier New', monospace;
		font-size: 12px;
	}

	.status-row {
		display: flex;
		justify-content: space-between;
		margin-bottom: 8px;
		padding: 4px 0;
	}

	.status-row:last-child {
		margin-bottom: 0;
	}

	.label {
		color: #888;
		font-weight: normal;
	}

	.value {
		color: #fff;
		font-weight: bold;
	}
</style>