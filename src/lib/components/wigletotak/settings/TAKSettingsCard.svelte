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
	let takSettings = $state({
		serverIp: '0.0.0.0',
		serverPort: '6666',
		multicastEnabled: false
	});

	// Local input bindings
	let takServerIp = $state(takSettings.serverIp);
	let takServerPort = $state(takSettings.serverPort);
	let multicastEnabled = $state(takSettings.multicastEnabled);

	// Initialize in browser only
	onMount(async () => {
		if (browser) {
			// Dynamic imports to prevent SSR issues
			const { wigleStore: ws, wigleActions: wa } = await import(
				'$lib/stores/wigletotak/wigleStore'
			);
			const { wigleService: wserv } = await import('$lib/services/wigletotak/wigleService');
			const { logInfo: li, logError: le } = await import('$lib/utils/logger');

			wigleStore = ws;
			_wigleActions = wa;
			wigleService = wserv;
			logInfo = li;
			logError = le;

			// Subscribe to store updates
			wigleStore.subscribe((state: any) => {
				takSettings = state.takSettings;
				takServerIp = takSettings.serverIp;
				takServerPort = takSettings.serverPort;
				multicastEnabled = takSettings.multicastEnabled;
			});
		}
	});

	// Update local values when store changes
	$effect(() => {
		takServerIp = takSettings.serverIp;
		takServerPort = takSettings.serverPort;
		multicastEnabled = takSettings.multicastEnabled;
	});

	// Update TAK server settings
	async function updateTakSettings() {
		try {
			await wigleService.updateTakSettings(takServerIp, takServerPort);
			logInfo('TAK settings updated successfully');
		} catch (error) {
			logError('Failed to update TAK settings:', error);
		}
	}

	// Update multicast state
	async function updateMulticastState() {
		try {
			await wigleService.updateMulticastState(multicastEnabled);
			logInfo('Multicast state updated successfully');
		} catch (error) {
			logError('Failed to update multicast state:', error);
		}
	}
</script>

<div class="settings-card">
	<h3 class="card-title">TAK Server Settings</h3>
	<div class="form-group">
		<label for="takServerIp">Server IP</label>
		<input id="takServerIp" type="text" bind:value={takServerIp} placeholder="0.0.0.0" />
	</div>
	<div class="form-group">
		<label for="takServerPort">Server Port</label>
		<input id="takServerPort" type="number" bind:value={takServerPort} placeholder="6666" />
	</div>
	<div class="checkbox-group">
		<label>
			<input
				type="checkbox"
				bind:checked={multicastEnabled}
				onchange={() => void updateMulticastState()}
			/>
			<span>Enable Multicast (239.2.3.1:6969)</span>
		</label>
	</div>
	<button class="btn btn-primary" onclick={() => void updateTakSettings()}>
		Save Settings
	</button>
</div>

<style>
	.settings-card {
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

	.form-group input[type='text'],
	.form-group input[type='number'] {
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

	.checkbox-group {
		margin-bottom: 1rem;
	}

	.checkbox-group label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #9aa0a6;
		cursor: pointer;
		margin-bottom: 0.5rem;
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
