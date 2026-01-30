<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		bettercapState,
		startBettercapPolling,
		stopBettercapPolling
	} from '$lib/stores/bettercapStore';

	export let isOpen = false;
	export let onClose: () => void = () => {};

	let state = {
		mode: null as string | null,
		running: false,
		wifiAPs: [] as any[],
		bleDevices: [] as any[],
		commandHistory: [] as string[],
		commandOutput: [] as string[]
	};

	const unsub = bettercapState.subscribe((s) => {
		state = s;
	});
	onMount(() => {
		startBettercapPolling();
	});
	onDestroy(() => {
		stopBettercapPolling();
		unsub();
	});
</script>

{#if isOpen}
	<div
		class="fixed top-0 right-0 w-96 h-full bg-gray-900/95 border-l border-gray-700 z-[1000] overflow-y-auto"
	>
		<div class="flex items-center justify-between p-4 border-b border-gray-700">
			<h2 class="text-sm font-bold text-green-400">Bettercap Devices</h2>
			<button on:click={onClose} class="text-gray-400 hover:text-white text-lg"
				>&times;</button
			>
		</div>

		<div class="p-4 space-y-4">
			<div class="flex items-center gap-2 text-xs">
				<div
					class="w-2 h-2 rounded-full {state.running ? 'bg-green-500' : 'bg-gray-600'}"
				></div>
				<span class="text-gray-400"
					>{state.running ? `Scanning (${state.mode || 'idle'})` : 'Stopped'}</span
				>
			</div>

			{#if state.wifiAPs.length > 0}
				<div>
					<h3 class="text-xs font-bold text-cyan-400 mb-2">
						WiFi APs ({state.wifiAPs.length})
					</h3>
					{#each state.wifiAPs.slice(0, 20) as ap}
						<div class="bg-gray-800/50 rounded p-2 mb-1 text-xs">
							<div class="text-white font-mono">{ap.essid || '<hidden>'}</div>
							<div class="text-gray-500">
								{ap.bssid} | CH {ap.channel} | {ap.rssi} dBm
							</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if state.bleDevices.length > 0}
				<div>
					<h3 class="text-xs font-bold text-blue-400 mb-2">
						BLE Devices ({state.bleDevices.length})
					</h3>
					{#each state.bleDevices.slice(0, 20) as device}
						<div class="bg-gray-800/50 rounded p-2 mb-1 text-xs">
							<div class="text-white font-mono">{device.name || 'Unknown'}</div>
							<div class="text-gray-500">{device.mac} | {device.rssi} dBm</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if state.wifiAPs.length === 0 && state.bleDevices.length === 0}
				<div class="text-center text-gray-600 py-8 text-sm">
					{state.running ? 'Scanning for devices...' : 'Start Bettercap to see devices'}
				</div>
			{/if}
		</div>
	</div>
{/if}
