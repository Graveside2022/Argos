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
	let directorySettings: any = $state({
		wigleDirectory: '/home/pi/kismet_ops',
		selectedFile: '',
		wigleFiles: []
	});
	let broadcastState = $state({
		isBroadcasting: false
	});

	// Local input bindings
	let wigleDirectory = $state(directorySettings.wigleDirectory);
	let selectedFile = $state(directorySettings.selectedFile);
	let wigleFiles: any[] = $state(directorySettings.wigleFiles);

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
				directorySettings = state.directorySettings;
				broadcastState = state.broadcastState;
				wigleDirectory = directorySettings.wigleDirectory;
				selectedFile = directorySettings.selectedFile;
				wigleFiles = directorySettings.wigleFiles;
			});
		}
	});

	// Update local values when store changes
	$effect(() => {
		wigleDirectory = directorySettings.wigleDirectory;
		selectedFile = directorySettings.selectedFile;
		wigleFiles = directorySettings.wigleFiles;
	});

	// List Wigle files in directory
	async function listWigleFiles() {
		try {
			await wigleService.listWigleFiles(wigleDirectory);
			logInfo('Wigle files listed successfully');
		} catch (error) {
			logError('Failed to list Wigle files:', error);
		}
	}

	// Start broadcast with selected file
	async function startBroadcast() {
		if (!selectedFile) {
			alert('Please select a file to broadcast');
			return;
		}

		try {
			await wigleService.startBroadcast(selectedFile);
			logInfo('Broadcast started successfully');
		} catch (error) {
			logError('Failed to start broadcast:', error);
		}
	}

	// Stop broadcast
	async function stopBroadcast() {
		try {
			await wigleService.stopBroadcast();
			logInfo('Broadcast stopped successfully');
		} catch (error) {
			logError('Failed to stop broadcast:', error);
		}
	}
</script>

<div class="settings-card">
	<h3 class="card-title">Wigle CSV Directory</h3>
	<div class="form-group">
		<label for="wigleDirectory">Directory Path</label>
		<div class="input-with-button">
			<input
				id="wigleDirectory"
				type="text"
				bind:value={wigleDirectory}
				placeholder="/home/pi/kismet_ops"
			/>
			<button class="btn btn-secondary" onclick={() => void listWigleFiles()}>
				List Files
			</button>
		</div>
	</div>
	{#if wigleFiles.length > 0}
		<div class="form-group">
			<label for="selectedFile">Select File</label>
			<select id="selectedFile" bind:value={selectedFile}>
				{#each wigleFiles as file}
					<option value={file}>{file}</option>
				{/each}
			</select>
		</div>
		<div class="button-group">
			<button
				class="btn btn-success"
				onclick={() => void startBroadcast()}
				disabled={broadcastState.isBroadcasting}
			>
				Start Broadcast
			</button>
			<button
				class="btn btn-danger"
				onclick={() => void stopBroadcast()}
				disabled={!broadcastState.isBroadcasting}
			>
				Stop Broadcast
			</button>
		</div>
	{/if}
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
	.form-group select {
		width: 100%;
		background: #0e1116;
		border: 1px solid #262626;
		border-radius: 0.25rem;
		padding: 0.5rem;
		color: #fff;
		font-family: inherit;
	}

	.form-group input:focus,
	.form-group select:focus {
		outline: none;
		border-color: #f97316;
	}

	.input-with-button {
		display: flex;
		gap: 0.5rem;
	}

	.input-with-button input {
		flex: 1;
	}

	.button-group {
		display: flex;
		gap: 0.5rem;
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

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: #404040;
		border-color: #525252;
	}

	.btn-success {
		background: #10b981;
		border-color: #10b981;
		color: #000;
	}

	.btn-success:hover {
		background: #059669;
	}

	.btn-danger {
		background: #ef4444;
		border-color: #ef4444;
		color: #fff;
	}

	.btn-danger:hover {
		background: #dc2626;
	}
</style>
