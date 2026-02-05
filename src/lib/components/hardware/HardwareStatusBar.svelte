<script lang="ts">
	import { onMount } from 'svelte';
	import {
		hardwareStatus,
		startPolling,
		stopPolling,
		forceReleaseDevice
	} from '$lib/stores/hardwareStore';

	let status = $state({
		hackrf: { available: true, owner: null as string | null, detected: false },
		alfa: { available: true, owner: null as string | null, detected: false },
		bluetooth: { available: true, owner: null as string | null, detected: false }
	});

	onMount(() => {
		const unsubscribe = hardwareStatus.subscribe((s) => {
			status = {
				hackrf: {
					available: s.hackrf.available,
					owner: s.hackrf.owner,
					detected: s.hackrf.detected
				},
				alfa: {
					available: s.alfa.available,
					owner: s.alfa.owner,
					detected: s.alfa.detected
				},
				bluetooth: {
					available: s.bluetooth.available,
					owner: s.bluetooth.owner,
					detected: s.bluetooth.detected
				}
			};
		});

		startPolling();

		return () => {
			stopPolling();
			unsubscribe();
		};
	});

	function getBadgeColor(detected: boolean, available: boolean): string {
		if (!detected) return 'bg-red-500';
		if (available) return 'bg-green-500';
		return 'bg-amber-500';
	}

	function getStatusText(detected: boolean, available: boolean, owner: string | null): string {
		if (!detected) return 'Disconnected';
		if (available) return 'Available';
		return owner ?? 'In Use';
	}

	async function handleForceRelease(device: string) {
		await forceReleaseDevice(device);
	}
</script>

<div class="flex items-center gap-4 px-4 py-2 bg-gray-900/80 border-b border-gray-800 text-sm">
	<span class="text-gray-500 font-mono uppercase text-xs tracking-wider">Hardware</span>

	<!-- HackRF -->
	<div class="flex items-center gap-2">
		<div
			class="w-2 h-2 rounded-full {getBadgeColor(
				status.hackrf.detected,
				status.hackrf.available
			)}"
			class:animate-pulse={status.hackrf.detected && status.hackrf.available}
		></div>
		<span class="text-gray-300">HackRF:</span>
		<span class="text-gray-400"
			>{getStatusText(
				status.hackrf.detected,
				status.hackrf.available,
				status.hackrf.owner
			)}</span
		>
		{#if !status.hackrf.available && status.hackrf.owner}
			<button
				onclick={() => handleForceRelease('hackrf')}
				class="text-xs text-red-400 hover:text-red-300 underline"
			>
				Release
			</button>
		{/if}
	</div>

	<span class="text-gray-700">|</span>

	<!-- ALFA -->
	<div class="flex items-center gap-2">
		<div
			class="w-2 h-2 rounded-full {getBadgeColor(
				status.alfa.detected,
				status.alfa.available
			)}"
			class:animate-pulse={status.alfa.detected && status.alfa.available}
		></div>
		<span class="text-gray-300">ALFA:</span>
		<span class="text-gray-400"
			>{getStatusText(status.alfa.detected, status.alfa.available, status.alfa.owner)}</span
		>
		{#if !status.alfa.available && status.alfa.owner}
			<button
				onclick={() => handleForceRelease('alfa')}
				class="text-xs text-red-400 hover:text-red-300 underline"
			>
				Release
			</button>
		{/if}
	</div>
</div>
