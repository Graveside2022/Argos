<script lang="ts">
	import { gpsStore } from '$lib/stores/tactical-map/gpsStore';

	$: ({ status } = $gpsStore);
</script>

<!-- GPS Status Display -->
<div class="gps-status-container">
	<div class="gps-status">
		<span class="flag">{status.currentCountry.flag}</span>
		<span class="country">{status.currentCountry.name}</span>
		<div class="coordinates">
			<div class="coord-row">
				<span class="label">Lat:</span>
				<span class="value">{status.formattedCoords.lat}</span>
			</div>
			<div class="coord-row">
				<span class="label">Lon:</span>
				<span class="value">{status.formattedCoords.lon}</span>
			</div>
		</div>
		<div class="mgrs">
			<span class="label">MGRS:</span>
			<span class="mgrs-value">{status.mgrsCoord}</span>
		</div>
	</div>
	
	<div class="gps-fix-info">
		<div class="fix-status" class:has-fix={status.hasGPSFix} class:no-fix={!status.hasGPSFix}>
			<span class="fix-type">{status.fixType} Fix</span>
			<span class="status-text">{status.gpsStatus}</span>
		</div>
		
		{#if status.hasGPSFix}
			<div class="gps-details">
				<div class="detail-item">
					<span class="label">Accuracy:</span>
					<span class="value">{status.accuracy.toFixed(1)}m</span>
				</div>
				<div class="detail-item">
					<span class="label">Satellites:</span>
					<span class="value">{status.satellites}</span>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.gps-status-container {
		display: flex;
		flex-direction: column;
		background: rgba(0, 20, 0, 0.9);
		border: 1px solid #00ff00;
		border-radius: 4px;
		padding: 12px;
		font-family: 'Courier New', monospace;
		color: #00ff00;
		font-size: 12px;
		min-width: 280px;
	}

	.gps-status {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 12px;
	}

	.flag {
		font-size: 16px;
		margin-right: 8px;
	}

	.country {
		font-weight: bold;
		color: #00ff88;
	}

	.coordinates {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.coord-row {
		display: flex;
		justify-content: space-between;
	}

	.label {
		color: #88ff88;
		margin-right: 8px;
	}

	.value {
		color: #ffffff;
		font-weight: bold;
	}

	.mgrs {
		display: flex;
		justify-content: space-between;
		border-top: 1px solid #004400;
		padding-top: 8px;
	}

	.mgrs-value {
		color: #ffff00;
		font-weight: bold;
	}

	.gps-fix-info {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.fix-status {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px;
		border-radius: 4px;
		text-align: center;
	}

	.fix-status.has-fix {
		background: rgba(0, 255, 0, 0.1);
		border: 1px solid #00ff00;
	}

	.fix-status.no-fix {
		background: rgba(255, 0, 0, 0.1);
		border: 1px solid #ff4400;
		color: #ff4400;
	}

	.fix-type {
		font-weight: bold;
		font-size: 14px;
	}

	.status-text {
		font-size: 11px;
		opacity: 0.8;
	}

	.gps-details {
		display: flex;
		justify-content: space-between;
		background: rgba(0, 0, 0, 0.3);
		padding: 6px;
		border-radius: 4px;
	}

	.detail-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}
</style>