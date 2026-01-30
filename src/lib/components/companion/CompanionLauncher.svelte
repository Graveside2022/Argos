<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		companionStatuses,
		startCompanionPolling,
		stopCompanionPolling,
		launchApp,
		stopApp
	} from '$lib/stores/companionStore';
	import {
		hardwareStatus,
		startPolling,
		stopPolling as _stopPolling
	} from '$lib/stores/hardwareStore';
	import HardwareConflictModal from '$lib/components/hardware/HardwareConflictModal.svelte';

	export let appName: string;
	export let description: string = '';
	export let requiredDevice: 'hackrf' | 'alfa' = 'hackrf';

	let running = false;
	let loading = false;
	let deviceAvailable = true;
	let deviceOwner: string | null = null;
	let showConflict = false;
	let conflictOwner = '';

	const unsubStatus = companionStatuses.subscribe((s) => {
		const status = s[appName];
		if (status) {
			running = status.running;
		}
	});

	const unsubHw = hardwareStatus.subscribe((s) => {
		const device = s[requiredDevice];
		deviceAvailable = device.available;
		deviceOwner = device.owner;
	});

	onMount(() => {
		startCompanionPolling(appName);
		startPolling();
	});

	onDestroy(() => {
		stopCompanionPolling(appName);
		unsubStatus();
		unsubHw();
	});

	async function handleLaunch() {
		if (!deviceAvailable && deviceOwner !== appName) {
			conflictOwner = deviceOwner || 'unknown';
			showConflict = true;
			return;
		}

		loading = true;
		try {
			const result = await launchApp(appName);
			if (!result.success && result.error) {
				if (result.error.includes('in use')) {
					conflictOwner = deviceOwner || 'unknown';
					showConflict = true;
				} else {
					alert(result.error);
				}
			}
		} finally {
			loading = false;
		}
	}

	async function handleStop() {
		loading = true;
		try {
			await stopApp(appName);
		} finally {
			loading = false;
		}
	}

	function handleConflictTakeOver() {
		showConflict = false;
		handleLaunch();
	}
</script>

<div class="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
	{#if description}
		<p class="text-gray-400 mb-4">{description}</p>
	{/if}

	<div class="flex items-center gap-4">
		<div class="flex items-center gap-2">
			<div
				class="w-3 h-3 rounded-full {running
					? 'bg-green-500 animate-pulse'
					: 'bg-gray-600'}"
			></div>
			<span class="text-sm font-mono {running ? 'text-green-400' : 'text-gray-500'}">
				{running ? 'Running' : 'Stopped'}
			</span>
		</div>

		{#if running}
			<button
				on:click={handleStop}
				disabled={loading}
				class="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded transition-colors"
			>
				{loading ? 'Stopping...' : 'Stop'}
			</button>
		{:else}
			<button
				on:click={handleLaunch}
				disabled={loading}
				class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded transition-colors"
			>
				{loading ? 'Launching...' : 'Launch'}
			</button>
		{/if}

		{#if !deviceAvailable && deviceOwner && deviceOwner !== appName}
			<span class="text-xs text-amber-400 font-mono">
				{requiredDevice.toUpperCase()}: {deviceOwner}
			</span>
		{/if}
	</div>
</div>

<HardwareConflictModal
	bind:show={showConflict}
	currentOwner={conflictOwner}
	device={requiredDevice}
	onTakeOver={handleConflictTakeOver}
/>
