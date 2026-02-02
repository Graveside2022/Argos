<script lang="ts">
	import { wigleStore } from '$lib/stores/wigletotak/wigleStore';
	import { wigleService } from '$lib/services/wigletotak/wigleService';
	import { logInfo, logError } from '$lib/utils/logger';

	// Reactive state from store
	$: _filterSettings = $wigleStore.filterSettings;

	// Local form state
	let whitelistSSID = '';
	let whitelistMAC = '';

	// Add to whitelist
	async function addToWhitelist() {
		if (!whitelistSSID && !whitelistMAC) {
			alert('Please enter an SSID or MAC address');
			return;
		}

		try {
			await wigleService.addToWhitelist(whitelistSSID || '', whitelistMAC || '');
			logInfo('Added to whitelist successfully', { ssid: whitelistSSID, mac: whitelistMAC });

			// Clear form
			whitelistSSID = '';
			whitelistMAC = '';

			alert('Added to whitelist');
		} catch (error) {
			logError('Failed to add to whitelist:', error as any);
			alert('Failed to add to whitelist');
		}
	}
</script>

<!-- Whitelist Filter Card -->
<div class="filter-card">
	<h3 class="card-title">Whitelist</h3>
	<div class="form-group">
		<label for="whitelistSSID">SSID</label>
		<input
			id="whitelistSSID"
			type="text"
			bind:value={whitelistSSID}
			placeholder="Network name"
		/>
	</div>
	<div class="form-group">
		<label for="whitelistMAC">MAC Address</label>
		<input
			id="whitelistMAC"
			type="text"
			bind:value={whitelistMAC}
			placeholder="00:00:00:00:00:00"
		/>
	</div>
	<button class="btn btn-primary" on:click={() => void addToWhitelist()}>
		Add to Whitelist
	</button>
</div>

<style>
	.filter-card {
		background: #1c1f26;
		border: 1px solid #262626;
		border-radius: 0.5rem;
		padding: 1.5rem;
	}

	.card-title {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 1rem;
		color: #f97316;
	}

	.form-group {
		margin-bottom: 1rem;
	}

	.form-group label {
		display: block;
		font-size: 0.875rem;
		color: #9aa0a6;
		margin-bottom: 0.25rem;
	}

	.form-group input[type='text'] {
		width: 100%;
		background: #0e1116;
		border: 1px solid #262626;
		border-radius: 0.25rem;
		padding: 0.5rem;
		color: #fff;
		font-family: inherit;
	}

	.form-group input:focus {
		outline: none;
		border-color: #f97316;
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
		background: #2a2d35;
	}

	.btn-primary {
		background: #f97316;
		border-color: #f97316;
		color: #000;
	}

	.btn-primary:hover {
		background: #f97316;
	}
</style>
