<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { HackRFService } from '$lib/services/tactical-map/hackrfService';
	import { hackrfStore } from '$lib/stores/tactical-map/hackrfStore';

	export let targetFrequency: number = 2437;
	export let onFrequencyChange: ((frequency: number) => void) | undefined = undefined;

	const hackrfService = new HackRFService();

	$: hackrfState = $hackrfStore;

	// Handle frequency input changes
	function handleFrequencyChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const frequency = parseFloat(target.value);
		if (!isNaN(frequency) && frequency > 0) {
			targetFrequency = frequency;
			if (onFrequencyChange) {
				onFrequencyChange(frequency);
			}
		}
	}

	// Toggle search state
	function toggleSearch() {
		hackrfService.toggleSearch(targetFrequency);
	}

	// Clear all signals
	function clearSignals() {
		hackrfService.stopSearch();
	}

	// Navigate to spectrum analyzer
	function goToSpectrum() {
		hackrfService.navigateToSpectrum();
	}

	onMount(() => {
		hackrfService.connectToHackRF();
	});

	onDestroy(() => {
		hackrfService.disconnectFromHackRF();
	});
</script>

<!-- HackRF Control Panel -->
<div class="hackrf-controller">
	<div class="controller-header">
		<h3>🔍 HackRF Signal Search</h3>
		<div class="connection-status" class:connected={hackrfState.connectionStatus === 'Connected'} class:disconnected={hackrfState.connectionStatus === 'Disconnected'}>
			<span class="status-indicator"></span>
			<span class="status-text">{hackrfState.connectionStatus}</span>
		</div>
	</div>

	<div class="frequency-control">
		<label for="frequency-input">Target Frequency (MHz):</label>
		<input
			id="frequency-input"
			type="number"
			bind:value={targetFrequency}
			on:input={handleFrequencyChange}
			min="1"
			max="6000"
			step="0.1"
			class="frequency-input"
		/>
	</div>

	<div class="control-buttons">
		<button
			class="search-button"
			class:searching={hackrfState.isSearching}
			on:click={toggleSearch}
			disabled={hackrfState.connectionStatus === 'Disconnected'}
		>
			{hackrfState.isSearching ? '⏹️ Stop Search' : '🔍 Start Search'}
		</button>

		<button
			class="clear-button"
			on:click={clearSignals}
			disabled={hackrfState.signalCount === 0}
		>
			🗑️ Clear Signals
		</button>

		<button
			class="spectrum-button"
			on:click={goToSpectrum}
		>
			📊 View Spectrum
		</button>
	</div>

	<div class="search-status">
		<div class="status-item">
			<span class="label">Signals Found:</span>
			<span class="value">{hackrfState.signalCount}</span>
		</div>
		
		<div class="status-item">
			<span class="label">Target:</span>
			<span class="value">{hackrfState.targetFrequency} MHz</span>
		</div>

		{#if hackrfState.currentSignal}
			<div class="current-signal">
				<span class="label">Current Signal:</span>
				<span class="signal-info">
					{hackrfState.currentSignal.frequency.toFixed(1)} MHz 
					({hackrfState.currentSignal.power.toFixed(1)} dBm)
				</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.hackrf-controller {
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

	.connection-status {
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

	.connection-status.connected .status-indicator {
		background: #00ff00;
		box-shadow: 0 0 6px #00ff00;
	}

	.connection-status.disconnected .status-indicator {
		background: #ff4400;
		box-shadow: 0 0 6px #ff4400;
	}

	.status-text {
		font-weight: bold;
	}

	.frequency-control {
		margin-bottom: 16px;
	}

	.frequency-control label {
		display: block;
		margin-bottom: 6px;
		color: #88ff88;
		font-size: 12px;
		font-weight: bold;
	}

	.frequency-input {
		width: 100%;
		padding: 8px;
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid #004400;
		border-radius: 4px;
		color: #ffffff;
		font-family: 'Courier New', monospace;
		font-size: 14px;
	}

	.frequency-input:focus {
		outline: none;
		border-color: #00ff00;
		box-shadow: 0 0 8px rgba(0, 255, 0, 0.3);
	}

	.control-buttons {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 16px;
	}

	.search-button,
	.clear-button,
	.spectrum-button {
		padding: 10px 16px;
		border: none;
		border-radius: 4px;
		font-family: 'Courier New', monospace;
		font-size: 12px;
		font-weight: bold;
		cursor: pointer;
		transition: all 0.2s;
	}

	.search-button {
		background: #0088ff;
		color: white;
		border: 1px solid #0066cc;
	}

	.search-button.searching {
		background: #ff4400;
		border-color: #cc3300;
		animation: pulse 2s infinite;
	}

	.search-button:hover:not(:disabled) {
		background: #0066cc;
		box-shadow: 0 0 8px rgba(0, 136, 255, 0.4);
	}

	.search-button.searching:hover:not(:disabled) {
		background: #cc3300;
		box-shadow: 0 0 8px rgba(255, 68, 0, 0.4);
	}

	.clear-button {
		background: #ff4444;
		color: white;
		border: 1px solid #cc3333;
	}

	.clear-button:hover:not(:disabled) {
		background: #cc3333;
		box-shadow: 0 0 8px rgba(255, 68, 68, 0.4);
	}

	.spectrum-button {
		background: #884400;
		color: white;
		border: 1px solid #663300;
	}

	.spectrum-button:hover {
		background: #663300;
		box-shadow: 0 0 8px rgba(136, 68, 0, 0.4);
	}

	.search-button:disabled,
	.clear-button:disabled {
		background: #333333;
		color: #666666;
		border-color: #555555;
		cursor: not-allowed;
		box-shadow: none;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.7; }
	}

	.search-status {
		display: flex;
		flex-direction: column;
		gap: 8px;
		background: rgba(0, 0, 0, 0.3);
		padding: 12px;
		border-radius: 4px;
		border: 1px solid #002200;
	}

	.status-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 12px;
	}

	.label {
		color: #88ff88;
		font-weight: bold;
	}

	.value {
		color: #ffffff;
		font-weight: bold;
	}

	.current-signal {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding-top: 8px;
		border-top: 1px solid #004400;
	}

	.signal-info {
		color: #ffff00;
		font-weight: bold;
		font-size: 11px;
	}
</style>