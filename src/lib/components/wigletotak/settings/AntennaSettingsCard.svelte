<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	// Services and stores - loaded dynamically to prevent SSR issues
	let wigleStore: any;
	let _wigleActions: any;
	let wigleService: any;
	let logInfo: any;
	let logError: any;

	// Reactive state from store with safe defaults
	let antennaSettings = {
		type: 'Standard',
		customSensitivity: 1.0
	};

	// Local input bindings
	let antennaType = antennaSettings.type;
	let customSensitivity = antennaSettings.customSensitivity;

	// Initialize in browser only
	onMount(async () => {
		if (browser) {
			// Dynamic imports to prevent SSR issues
			const { wigleStore: ws, wigleActions: wa } = await import('$lib/stores/wigletotak/wigleStore');
			const { wigleService: wserv } = await import('$lib/services/wigletotak/wigleService');
			const { logInfo: li, logError: le } = await import('$lib/utils/logger');
			
			wigleStore = ws;
			_wigleActions = wa;
			wigleService = wserv;
			logInfo = li;
			logError = le;

			// Subscribe to store updates
			wigleStore.subscribe((state: any) => {
				antennaSettings = state.antennaSettings;
				antennaType = antennaSettings.type;
				customSensitivity = antennaSettings.customSensitivity;
			});
		}
	});

	// Update local values when store changes
	$: {
		antennaType = antennaSettings.type;
		customSensitivity = antennaSettings.customSensitivity;
	}

	// Update antenna sensitivity
	async function updateAntennaSensitivity() {
		try {
			await wigleService.updateAntennaSensitivity(antennaType, customSensitivity);
			logInfo('Antenna sensitivity updated successfully');
		} catch (error) {
			logError('Failed to update antenna sensitivity:', error);
		}
	}

	// Load antenna settings on mount
	onMount(async () => {
		try {
			await wigleService.loadAntennaSettings();
			logInfo('Antenna settings loaded successfully');
		} catch (error) {
			logError('Failed to load antenna settings:', error);
		}
	});
</script>

<div class="settings-card">
	<h3 class="card-title">Antenna Sensitivity</h3>
	<div class="form-group">
		<label for="antennaType">Antenna Type</label>
		<select id="antennaType" bind:value={antennaType}>
			<option value="Standard">Standard (1.0x)</option>
			<option value="Alfa Card">Alfa Card (1.5x)</option>
			<option value="High Gain">High Gain (2.0x)</option>
			<option value="RPi Internal">RPi Internal (0.7x)</option>
			<option value="Custom">Custom</option>
		</select>
	</div>
	{#if antennaType === 'Custom'}
		<div class="form-group">
			<label for="customSensitivity">Custom Factor</label>
			<input 
				id="customSensitivity" 
				type="number" 
				bind:value={customSensitivity} 
				step="0.1" 
				placeholder="1.0" 
			/>
		</div>
	{/if}
	<button class="btn btn-primary" on:click={() => void updateAntennaSensitivity()}>
		Save Antenna Settings
	</button>
</div>

<style>
	.settings-card {
		background: #141414;
		border: 1px solid #262626;
		border-radius: 0.5rem;
		padding: 1.5rem;
	}

	.card-title {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 1rem;
		color: #fb923c;
	}

	.form-group {
		margin-bottom: 1rem;
	}

	.form-group label {
		display: block;
		font-size: 0.875rem;
		color: #a3a3a3;
		margin-bottom: 0.25rem;
	}

	.form-group input[type="number"],
	.form-group select {
		width: 100%;
		background: #0a0a0a;
		border: 1px solid #262626;
		border-radius: 0.25rem;
		padding: 0.5rem;
		color: #fff;
		font-family: inherit;
	}

	.form-group input:focus,
	.form-group select:focus {
		outline: none;
		border-color: #fb923c;
	}

	.btn {
		background: #262626;
		border: 1px solid #404040;
		border-radius: 0.25rem;
		padding: 0.5rem 1rem;
		color: #fff;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		font-family: inherit;
	}

	.btn:hover {
		background: #2d2d2d;
	}

	.btn-primary {
		background: #fb923c;
		border-color: #fb923c;
		color: #000;
	}

	.btn-primary:hover {
		background: #f97316;
	}
</style>