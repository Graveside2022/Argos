<script lang="ts">
	import { wigleStore } from '$lib/stores/wigletotak/wigleStore';
	import { wigleService } from '$lib/services/wigletotak/wigleService';
	import { logInfo, logError } from '$lib/utils/logger';

	// Reactive state from store
	$: _filterSettings = $wigleStore.filterSettings;

	// Local form state
	let blacklistSSID = '';
	let blacklistMAC = '';
	let blacklistColor = '-65281'; // Default purple

	// Color options for blacklist entries
	const colorOptions = [
		{ value: '-65536', label: 'Red' },
		{ value: '-256', label: 'Yellow' },
		{ value: '-16776961', label: 'Blue' },
		{ value: '-23296', label: 'Orange' },
		{ value: '-65281', label: 'Purple' }
	];

	// Add to blacklist
	async function addToBlacklist() {
		if (!blacklistSSID && !blacklistMAC) {
			alert('Please enter an SSID or MAC address');
			return;
		}

		try {
			await wigleService.addToBlacklist(blacklistSSID || '', blacklistMAC || '', blacklistColor || '0');
			logInfo('Added to blacklist successfully', { 
				ssid: blacklistSSID, 
				mac: blacklistMAC, 
				color: blacklistColor 
			});
			
			// Clear form
			blacklistSSID = '';
			blacklistMAC = '';
			
			alert('Added to blacklist');
		} catch (error) {
			logError('Failed to add to blacklist:', error as any);
			alert('Failed to add to blacklist');
		}
	}
</script>

<!-- Blacklist Filter Card -->
<div class="filter-card">
	<h3 class="card-title">Blacklist</h3>
	<div class="form-group">
		<label for="blacklistSSID">SSID</label>
		<input 
			id="blacklistSSID" 
			type="text" 
			bind:value={blacklistSSID} 
			placeholder="Network name" 
		/>
	</div>
	<div class="form-group">
		<label for="blacklistMAC">MAC Address</label>
		<input 
			id="blacklistMAC" 
			type="text" 
			bind:value={blacklistMAC} 
			placeholder="00:00:00:00:00:00" 
		/>
	</div>
	<div class="form-group">
		<label for="blacklistColor">Color</label>
		<select id="blacklistColor" bind:value={blacklistColor}>
			{#each colorOptions as option}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</div>
	<button class="btn btn-primary" on:click={() => void addToBlacklist()}>
		Add to Blacklist
	</button>
</div>

<style>
	.filter-card {
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

	.form-group input[type="text"],
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