<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { KismetService } from '$lib/services/tactical-map/kismetService';
	import { kismetStore, setWhitelistMAC } from '$lib/stores/tactical-map/kismetStore';

	export let whitelistMAC: string = '';

	const kismetService = new KismetService();

	$: kismetState = $kismetStore;

	// Handle whitelist MAC input
	function handleWhitelistChange(event: Event) {
		const target = event.target as HTMLInputElement;
		whitelistMAC = target.value;
		setWhitelistMAC(whitelistMAC);
	}

	// Toggle Kismet service
	async function toggleKismet() {
		await kismetService.toggleKismet();
	}

	// Clear all devices
	function clearDevices() {
		kismetService.clearDevices();
	}

	onMount(() => {
		kismetService.startPeriodicStatusCheck();
		kismetService.startPeriodicDeviceFetch();
	});

	onDestroy(() => {
		kismetService.stopPeriodicChecks();
	});
</script>

<!-- Kismet Control Panel -->
<div class="kismet-controller">
	<div class="controller-header">
		<h3>📡 Kismet Device Scanner</h3>
		<div class="service-status" class:running={kismetState.status === 'running'} class:stopped={kismetState.status === 'stopped'} class:transitioning={kismetState.status === 'starting' || kismetState.status === 'stopping'}>
			<span class="status-indicator"></span>
			<span class="status-text">{kismetState.status.charAt(0).toUpperCase() + kismetState.status.slice(1)}</span>
		</div>
	</div>

	<div class="whitelist-control">
		<label for="whitelist-input">Whitelist MAC (filter):</label>
		<input
			id="whitelist-input"
			type="text"
			bind:value={whitelistMAC}
			on:input={handleWhitelistChange}
			placeholder="AA:BB:CC:DD:EE:FF"
			class="whitelist-input"
		/>
		<p class="whitelist-help">Enter MAC address to filter devices (optional)</p>
	</div>

	<div class="control-buttons">
		<button
			class="service-button"
			class:start={kismetState.status === 'stopped'}
			class:stop={kismetState.status === 'running'}
			on:click={toggleKismet}
			disabled={kismetState.status === 'starting' || kismetState.status === 'stopping'}
		>
			{#if kismetState.status === 'stopped'}
				▶️ Start Kismet
			{:else if kismetState.status === 'running'}
				⏹️ Stop Kismet
			{:else if kismetState.status === 'starting'}
				⏳ Starting...
			{:else}
				⏳ Stopping...
			{/if}
		</button>

		<button
			class="clear-button"
			on:click={clearDevices}
			disabled={kismetState.deviceCount === 0}
		>
			🗑️ Clear Devices
		</button>
	</div>

	<div class="device-stats">
		<div class="stats-header">
			<h4>Device Statistics</h4>
		</div>
		
		<div class="stat-item">
			<span class="stat-label">Total Devices:</span>
			<span class="stat-value">{kismetState.deviceCount}</span>
		</div>

		{#if kismetState.distributions.byType.size > 0}
			<div class="distribution-section">
				<h5>By Type:</h5>
				<div class="distribution-list">
					{#each Array.from(kismetState.distributions.byType.entries()) as [type, count]}
						<div class="distribution-item">
							<span class="dist-type">{type}:</span>
							<span class="dist-count">{count}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if kismetState.distributions.byManufacturer.size > 0}
			<div class="distribution-section">
				<h5>Top Manufacturers:</h5>
				<div class="distribution-list">
					{#each Array.from(kismetState.distributions.byManufacturer.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5) as [manufacturer, count]}
						<div class="distribution-item">
							<span class="dist-manufacturer">{manufacturer}:</span>
							<span class="dist-count">{count}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if kismetState.distributions.byChannel.size > 0}
			<div class="distribution-section">
				<h5>By Channel:</h5>
				<div class="distribution-list">
					{#each Array.from(kismetState.distributions.byChannel.entries()).sort((a, b) => parseInt(b[0]) - parseInt(a[0])) as [channel, count]}
						<div class="distribution-item">
							<span class="dist-channel">Ch {channel}:</span>
							<span class="dist-count">{count}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.kismet-controller {
		background: rgba(0, 20, 0, 0.9);
		border: 1px solid #00ff00;
		border-radius: 6px;
		padding: 16px;
		font-family: 'Courier New', monospace;
		color: #00ff00;
		min-width: 300px;
	}

	.controller-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
		border-bottom: 1px solid #004400;
		padding-bottom: 8px;
	}

	.controller-header h3 {
		margin: 0;
		color: #00ff88;
		font-size: 14px;
	}

	.service-status {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
	}

	.status-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		display: inline-block;
	}

	.service-status.running .status-indicator {
		background: #00ff00;
		box-shadow: 0 0 6px #00ff00;
	}

	.service-status.stopped .status-indicator {
		background: #666666;
		border: 1px solid #888888;
	}

	.service-status.transitioning .status-indicator {
		background: #ffaa00;
		box-shadow: 0 0 6px #ffaa00;
		animation: pulse 1s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.status-text {
		font-weight: bold;
	}

	.whitelist-control {
		margin-bottom: 16px;
	}

	.whitelist-control label {
		display: block;
		margin-bottom: 6px;
		color: #88ff88;
		font-size: 12px;
		font-weight: bold;
	}

	.whitelist-input {
		width: 100%;
		padding: 8px;
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid #004400;
		border-radius: 4px;
		color: #ffffff;
		font-family: 'Courier New', monospace;
		font-size: 12px;
	}

	.whitelist-input:focus {
		outline: none;
		border-color: #00ff00;
		box-shadow: 0 0 8px rgba(0, 255, 0, 0.3);
	}

	.whitelist-help {
		margin: 4px 0 0 0;
		font-size: 10px;
		color: #888888;
		opacity: 0.8;
	}

	.control-buttons {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 16px;
	}

	.service-button,
	.clear-button {
		padding: 10px 16px;
		border: none;
		border-radius: 4px;
		font-family: 'Courier New', monospace;
		font-size: 12px;
		font-weight: bold;
		cursor: pointer;
		transition: all 0.2s;
	}

	.service-button.start {
		background: #00aa00;
		color: white;
		border: 1px solid #008800;
	}

	.service-button.start:hover:not(:disabled) {
		background: #008800;
		box-shadow: 0 0 8px rgba(0, 170, 0, 0.4);
	}

	.service-button.stop {
		background: #ff4400;
		color: white;
		border: 1px solid #cc3300;
	}

	.service-button.stop:hover:not(:disabled) {
		background: #cc3300;
		box-shadow: 0 0 8px rgba(255, 68, 0, 0.4);
	}

	.clear-button {
		background: #666666;
		color: white;
		border: 1px solid #555555;
	}

	.clear-button:hover:not(:disabled) {
		background: #555555;
		box-shadow: 0 0 8px rgba(102, 102, 102, 0.4);
	}

	.service-button:disabled,
	.clear-button:disabled {
		background: #333333;
		color: #666666;
		border-color: #555555;
		cursor: not-allowed;
		box-shadow: none;
	}

	.device-stats {
		background: rgba(0, 0, 0, 0.3);
		padding: 12px;
		border-radius: 4px;
		border: 1px solid #002200;
	}

	.stats-header h4 {
		margin: 0 0 12px 0;
		color: #88ff88;
		font-size: 12px;
		font-weight: bold;
		border-bottom: 1px solid #004400;
		padding-bottom: 6px;
	}

	.stat-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 12px;
		margin-bottom: 8px;
	}

	.stat-label {
		color: #88ff88;
		font-weight: bold;
	}

	.stat-value {
		color: #ffffff;
		font-weight: bold;
	}

	.distribution-section {
		margin-top: 12px;
		padding-top: 8px;
		border-top: 1px solid #004400;
	}

	.distribution-section h5 {
		margin: 0 0 6px 0;
		color: #88ff88;
		font-size: 11px;
		font-weight: bold;
	}

	.distribution-list {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.distribution-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 10px;
	}

	.dist-type,
	.dist-manufacturer,
	.dist-channel {
		color: #ffffff;
		opacity: 0.8;
	}

	.dist-count {
		color: #ffff00;
		font-weight: bold;
	}
</style>