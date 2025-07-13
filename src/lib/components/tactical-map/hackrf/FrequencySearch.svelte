<script lang="ts">
	import { HackRFService } from '$lib/services/tactical-map/hackrfService';
	import { hackrfStore } from '$lib/stores/tactical-map/hackrfStore';

	export let onFrequencySelected: ((frequency: number) => void) | undefined = undefined;

	const hackrfService = new HackRFService();

	// Common frequency presets
	const frequencyPresets = [
		{ name: 'WiFi Ch 1', frequency: 2412, description: '2.4 GHz WiFi Channel 1' },
		{ name: 'WiFi Ch 6', frequency: 2437, description: '2.4 GHz WiFi Channel 6' },
		{ name: 'WiFi Ch 11', frequency: 2462, description: '2.4 GHz WiFi Channel 11' },
		{ name: 'WiFi 5G', frequency: 5180, description: '5 GHz WiFi' },
		{ name: 'Bluetooth', frequency: 2440, description: 'Bluetooth Classic' },
		{ name: 'BLE', frequency: 2402, description: 'Bluetooth Low Energy' },
		{ name: 'Zigbee', frequency: 2405, description: 'Zigbee/802.15.4' },
		{ name: 'ISM 433', frequency: 433.92, description: '433 MHz ISM Band' },
		{ name: 'ISM 868', frequency: 868, description: '868 MHz ISM Band' },
		{ name: 'ISM 915', frequency: 915, description: '915 MHz ISM Band' },
		{ name: 'FM Radio', frequency: 100, description: 'FM Broadcast Band' },
		{ name: 'Aircraft', frequency: 121.5, description: 'Aviation Emergency' },
		{ name: 'Marine', frequency: 156.8, description: 'Marine VHF Ch 16' },
		{ name: 'Ham 2m', frequency: 146, description: '2 Meter Amateur Band' },
		{ name: 'Ham 70cm', frequency: 446, description: '70 cm Amateur Band' },
		{ name: 'Cellular', frequency: 850, description: 'Cellular Band' }
	];

	$: hackrfState = $hackrfStore;

	function selectFrequency(frequency: number) {
		if (onFrequencySelected) {
			onFrequencySelected(frequency);
		}
		
		// If currently searching, switch to new frequency
		if (hackrfState.isSearching) {
			hackrfService.startSearch(frequency);
		}
	}

	function quickSearch(frequency: number) {
		hackrfService.startSearch(frequency);
		if (onFrequencySelected) {
			onFrequencySelected(frequency);
		}
	}
</script>

<!-- Frequency Search and Presets -->
<div class="frequency-search">
	<div class="search-header">
		<h3>📻 Frequency Presets</h3>
		<p class="description">Quick access to common frequencies</p>
	</div>

	<div class="frequency-categories">
		<!-- WiFi & IoT -->
		<div class="frequency-category">
			<h4>📶 WiFi & IoT</h4>
			<div class="preset-grid">
				{#each frequencyPresets.filter(p => p.frequency >= 2400 && p.frequency <= 5200) as preset}
					<button 
						class="frequency-preset"
						class:active={hackrfState.targetFrequency === preset.frequency}
						on:click={() => selectFrequency(preset.frequency)}
						title={preset.description}
					>
						<span class="preset-name">{preset.name}</span>
						<span class="preset-freq">{preset.frequency} MHz</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- ISM Bands -->
		<div class="frequency-category">
			<h4>🏭 ISM Bands</h4>
			<div class="preset-grid">
				{#each frequencyPresets.filter(p => [433.92, 868, 915].includes(p.frequency)) as preset}
					<button 
						class="frequency-preset"
						class:active={hackrfState.targetFrequency === preset.frequency}
						on:click={() => selectFrequency(preset.frequency)}
						title={preset.description}
					>
						<span class="preset-name">{preset.name}</span>
						<span class="preset-freq">{preset.frequency} MHz</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- VHF/UHF -->
		<div class="frequency-category">
			<h4>📡 VHF/UHF</h4>
			<div class="preset-grid">
				{#each frequencyPresets.filter(p => p.frequency >= 100 && p.frequency <= 500 && ![433.92].includes(p.frequency)) as preset}
					<button 
						class="frequency-preset"
						class:active={hackrfState.targetFrequency === preset.frequency}
						on:click={() => selectFrequency(preset.frequency)}
						title={preset.description}
					>
						<span class="preset-name">{preset.name}</span>
						<span class="preset-freq">{preset.frequency} MHz</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- Cellular -->
		<div class="frequency-category">
			<h4>📱 Cellular</h4>
			<div class="preset-grid">
				{#each frequencyPresets.filter(p => p.frequency >= 800 && p.frequency <= 900) as preset}
					<button 
						class="frequency-preset"
						class:active={hackrfState.targetFrequency === preset.frequency}
						on:click={() => selectFrequency(preset.frequency)}
						title={preset.description}
					>
						<span class="preset-name">{preset.name}</span>
						<span class="preset-freq">{preset.frequency} MHz</span>
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Quick Search Actions -->
	<div class="quick-actions">
		<h4>⚡ Quick Actions</h4>
		<div class="action-buttons">
			<button 
				class="quick-search-btn wifi"
				on:click={() => quickSearch(2437)}
				disabled={hackrfState.connectionStatus === 'Disconnected'}
			>
				🔍 Search WiFi
			</button>
			<button 
				class="quick-search-btn bluetooth"
				on:click={() => quickSearch(2440)}
				disabled={hackrfState.connectionStatus === 'Disconnected'}
			>
				🔍 Search Bluetooth
			</button>
			<button 
				class="quick-search-btn ism"
				on:click={() => quickSearch(433.92)}
				disabled={hackrfState.connectionStatus === 'Disconnected'}
			>
				🔍 Search 433 MHz
			</button>
		</div>
	</div>
</div>

<style>
	.frequency-search {
		background: rgba(0, 20, 0, 0.9);
		border: 1px solid #00ff00;
		border-radius: 6px;
		padding: 16px;
		font-family: 'Courier New', monospace;
		color: #00ff00;
		max-width: 400px;
	}

	.search-header {
		margin-bottom: 16px;
		border-bottom: 1px solid #004400;
		padding-bottom: 8px;
	}

	.search-header h3 {
		margin: 0 0 4px 0;
		color: #00ff88;
		font-size: 14px;
	}

	.description {
		margin: 0;
		font-size: 11px;
		color: #88ff88;
		opacity: 0.8;
	}

	.frequency-categories {
		display: flex;
		flex-direction: column;
		gap: 16px;
		margin-bottom: 16px;
	}

	.frequency-category h4 {
		margin: 0 0 8px 0;
		color: #88ff88;
		font-size: 12px;
		font-weight: bold;
	}

	.preset-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
		gap: 6px;
	}

	.frequency-preset {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 8px 6px;
		background: rgba(0, 0, 0, 0.4);
		border: 1px solid #004400;
		border-radius: 4px;
		color: #ffffff;
		font-family: 'Courier New', monospace;
		font-size: 10px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.frequency-preset:hover {
		border-color: #00ff00;
		background: rgba(0, 255, 0, 0.1);
		box-shadow: 0 0 6px rgba(0, 255, 0, 0.3);
	}

	.frequency-preset.active {
		border-color: #ffff00;
		background: rgba(255, 255, 0, 0.1);
		color: #ffff00;
		box-shadow: 0 0 8px rgba(255, 255, 0, 0.4);
	}

	.preset-name {
		font-weight: bold;
		color: #00ff88;
		margin-bottom: 2px;
	}

	.frequency-preset.active .preset-name {
		color: #ffff00;
	}

	.preset-freq {
		font-size: 9px;
		opacity: 0.8;
	}

	.quick-actions {
		border-top: 1px solid #004400;
		padding-top: 12px;
	}

	.quick-actions h4 {
		margin: 0 0 8px 0;
		color: #88ff88;
		font-size: 12px;
		font-weight: bold;
	}

	.action-buttons {
		display: grid;
		grid-template-columns: 1fr;
		gap: 6px;
	}

	.quick-search-btn {
		padding: 8px 12px;
		border: none;
		border-radius: 4px;
		font-family: 'Courier New', monospace;
		font-size: 11px;
		font-weight: bold;
		cursor: pointer;
		transition: all 0.2s;
		color: white;
	}

	.quick-search-btn.wifi {
		background: #0088ff;
		border: 1px solid #0066cc;
	}

	.quick-search-btn.wifi:hover:not(:disabled) {
		background: #0066cc;
		box-shadow: 0 0 8px rgba(0, 136, 255, 0.4);
	}

	.quick-search-btn.bluetooth {
		background: #0099ff;
		border: 1px solid #0077cc;
	}

	.quick-search-btn.bluetooth:hover:not(:disabled) {
		background: #0077cc;
		box-shadow: 0 0 8px rgba(0, 153, 255, 0.4);
	}

	.quick-search-btn.ism {
		background: #ff8800;
		border: 1px solid #cc6600;
	}

	.quick-search-btn.ism:hover:not(:disabled) {
		background: #cc6600;
		box-shadow: 0 0 8px rgba(255, 136, 0, 0.4);
	}

	.quick-search-btn:disabled {
		background: #333333;
		color: #666666;
		border-color: #555555;
		cursor: not-allowed;
		box-shadow: none;
	}
</style>