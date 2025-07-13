<script lang="ts">
	import { gpsStore } from '$lib/stores/tactical-map/gpsStore';

	export let kismetDeviceCount: number = 0;
	export let signalMarkerCount: number = 0;
	export let isSearching: boolean = false;
	export let targetFrequency: number = 2437;

	$: gpsState = $gpsStore;
</script>

<!-- Map Legend and Status -->
<div class="map-legend">
	<div class="legend-header">
		<h3>Tactical Map Legend</h3>
	</div>
	
	<div class="legend-sections">
		<!-- GPS Section -->
		<div class="legend-section">
			<h4>📍 GPS Status</h4>
			<div class="legend-items">
				<div class="legend-item">
					<span class="marker-sample user-marker-sample">🇺🇸</span>
					<span class="legend-text">Your Position</span>
				</div>
				<div class="legend-item">
					<span class="marker-sample accuracy-circle-sample"></span>
					<span class="legend-text">GPS Accuracy Circle</span>
				</div>
			</div>
		</div>

		<!-- Kismet Section -->
		<div class="legend-section">
			<h4>📡 Kismet Devices ({kismetDeviceCount})</h4>
			<div class="legend-items">
				<div class="legend-item">
					<span class="marker-sample wifi-sample">📶</span>
					<span class="legend-text">WiFi Device</span>
				</div>
				<div class="legend-item">
					<span class="marker-sample bluetooth-sample">🔵</span>
					<span class="legend-text">Bluetooth Device</span>
				</div>
				<div class="legend-item">
					<span class="marker-sample unknown-sample">❓</span>
					<span class="legend-text">Unknown Device</span>
				</div>
			</div>
		</div>

		<!-- HackRF Section -->
		<div class="legend-section">
			<h4>📊 HackRF Signals ({signalMarkerCount})</h4>
			<div class="legend-items">
				<div class="legend-item">
					<span class="marker-sample signal-sample high-signal">●</span>
					<span class="legend-text">Strong Signal (&gt; -60 dBm)</span>
				</div>
				<div class="legend-item">
					<span class="marker-sample signal-sample medium-signal">●</span>
					<span class="legend-text">Medium Signal (-60 to -80 dBm)</span>
				</div>
				<div class="legend-item">
					<span class="marker-sample signal-sample weak-signal">●</span>
					<span class="legend-text">Weak Signal (&lt; -80 dBm)</span>
				</div>
			</div>
		</div>

		<!-- Search Status -->
		<div class="legend-section">
			<h4>🔍 Search Status</h4>
			<div class="legend-items">
				<div class="legend-item">
					<span class="status-indicator" class:active={isSearching} class:inactive={!isSearching}></span>
					<span class="legend-text">
						{isSearching ? 'Searching' : 'Stopped'}
						{#if isSearching}
							<span class="frequency-info">@ {targetFrequency} MHz</span>
						{/if}
					</span>
				</div>
			</div>
		</div>

		<!-- Coordinates Display -->
		{#if gpsState.status.hasGPSFix}
			<div class="legend-section coordinates-section">
				<h4>📐 Current Position</h4>
				<div class="coordinate-display">
					<div class="coord-line">
						<span class="coord-label">Lat:</span>
						<span class="coord-value">{gpsState.status.formattedCoords.lat}</span>
					</div>
					<div class="coord-line">
						<span class="coord-label">Lon:</span>
						<span class="coord-value">{gpsState.status.formattedCoords.lon}</span>
					</div>
					<div class="coord-line mgrs-line">
						<span class="coord-label">MGRS:</span>
						<span class="coord-value mgrs-value">{gpsState.status.mgrsCoord}</span>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.map-legend {
		background: rgba(0, 20, 0, 0.95);
		border: 1px solid #00ff00;
		border-radius: 6px;
		padding: 16px;
		font-family: 'Courier New', monospace;
		color: #00ff00;
		font-size: 12px;
		max-width: 300px;
		min-width: 250px;
	}

	.legend-header h3 {
		margin: 0 0 16px 0;
		color: #00ff88;
		font-size: 14px;
		text-align: center;
		border-bottom: 1px solid #004400;
		padding-bottom: 8px;
	}

	.legend-sections {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.legend-section {
		border-bottom: 1px solid #002200;
		padding-bottom: 12px;
	}

	.legend-section:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.legend-section h4 {
		margin: 0 0 8px 0;
		color: #88ff88;
		font-size: 12px;
		font-weight: bold;
	}

	.legend-items {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.marker-sample {
		display: inline-block;
		width: 20px;
		text-align: center;
		font-size: 14px;
	}

	.user-marker-sample {
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
	}

	.accuracy-circle-sample {
		width: 16px;
		height: 16px;
		border: 2px solid #3b82f6;
		border-radius: 50%;
		background: rgba(59, 130, 246, 0.15);
	}

	.wifi-sample {
		color: #00ff00;
	}

	.bluetooth-sample {
		color: #0099ff;
	}

	.unknown-sample {
		color: #ffaa00;
	}

	.signal-sample {
		font-size: 16px;
		font-weight: bold;
	}

	.high-signal {
		color: #ff0000;
	}

	.medium-signal {
		color: #ffaa00;
	}

	.weak-signal {
		color: #00ff00;
	}

	.legend-text {
		color: #ffffff;
		font-size: 11px;
	}

	.frequency-info {
		color: #ffff00;
		font-weight: bold;
		margin-left: 4px;
	}

	.status-indicator {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		display: inline-block;
	}

	.status-indicator.active {
		background: #00ff00;
		box-shadow: 0 0 8px #00ff00;
		animation: pulse 2s infinite;
	}

	.status-indicator.inactive {
		background: #444444;
		border: 1px solid #666666;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.coordinates-section {
		background: rgba(0, 0, 0, 0.3);
		padding: 8px;
		border-radius: 4px;
	}

	.coordinate-display {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.coord-line {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.coord-label {
		color: #88ff88;
		font-weight: bold;
	}

	.coord-value {
		color: #ffffff;
		font-family: 'Courier New', monospace;
	}

	.mgrs-line {
		border-top: 1px solid #004400;
		padding-top: 4px;
		margin-top: 4px;
	}

	.mgrs-value {
		color: #ffff00;
		font-weight: bold;
	}
</style>