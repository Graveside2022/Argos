<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import HardwareStatusBar from '$lib/components/hardware/HardwareStatusBar.svelte';
	import HardwareConflictModal from '$lib/components/hardware/HardwareConflictModal.svelte';
	import {
		btleState,
		startBtlePolling,
		stopBtlePolling,
		startBtle,
		stopBtle
	} from '$lib/stores/btleStore';

	let state = {
		running: false,
		channel: 37,
		packets: [] as any[],
		packetCount: 0,
		uniqueDevices: 0
	};
	let selectedChannel = 37;
	let loading = false;
	let showConflict = false;
	let conflictOwner = '';

	const unsub = btleState.subscribe((s) => {
		state = s;
	});
	onMount(() => {
		startBtlePolling();
	});
	onDestroy(() => {
		stopBtlePolling();
		unsub();
	});

	async function handleStart() {
		loading = true;
		try {
			const result = await startBtle(selectedChannel);
			if (!result.success && result.error?.includes('in use')) {
				conflictOwner = result.error;
				showConflict = true;
			}
		} finally {
			loading = false;
		}
	}

	async function handleStop() {
		loading = true;
		try {
			await stopBtle();
		} finally {
			loading = false;
		}
	}

	function getRssiColor(rssi: number): string {
		if (rssi > -50) return 'text-green-400';
		if (rssi > -70) return 'text-yellow-400';
		return 'text-red-400';
	}
</script>

<svelte:head>
	<title>BTLE - BLE Sniffer | Argos</title>
</svelte:head>

<div class="min-h-screen bg-gray-950 text-white">
	<HardwareStatusBar />

	<header class="bg-gray-900 border-b border-gray-800 p-4">
		<div class="container mx-auto flex items-center gap-4">
			<a href="/" class="text-cyan-500 hover:text-cyan-400 transition-colors">&larr; Back</a>
			<h1 class="text-xl font-bold">
				<span class="text-blue-400">BTLE</span> - BLE Sniffer
			</h1>
		</div>
	</header>

	<main class="container mx-auto p-6 max-w-5xl space-y-6">
		<!-- Controls -->
		<div class="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
			<div class="flex items-center gap-4">
				<span class="text-sm text-gray-400">Channel:</span>
				{#each [37, 38, 39] as ch}
					<button
						on:click={() => (selectedChannel = ch)}
						disabled={state.running}
						class="px-3 py-1.5 rounded text-sm font-mono transition-colors
							{selectedChannel === ch ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
					>
						{ch}
					</button>
				{/each}

				{#if state.running}
					<button
						on:click={handleStop}
						disabled={loading}
						class="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded transition-colors"
					>
						{loading ? 'Stopping...' : 'Stop'}
					</button>
					<span class="text-sm text-green-400 font-mono"
						>{state.packetCount} pkts | {state.uniqueDevices} devices</span
					>
				{:else}
					<button
						on:click={handleStart}
						disabled={loading}
						class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded transition-colors"
					>
						{loading ? 'Starting...' : 'Start Capture'}
					</button>
				{/if}
			</div>
		</div>

		<!-- Packet Table -->
		<div class="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
			<div class="px-4 py-2 bg-gray-800 border-b border-gray-700">
				<h3 class="text-sm font-bold text-blue-400">BLE Packets</h3>
			</div>
			<div class="overflow-x-auto max-h-[60vh] overflow-y-auto">
				<table class="w-full text-sm">
					<thead class="sticky top-0 bg-gray-800">
						<tr class="text-left text-gray-500 border-b border-gray-700">
							<th class="px-4 py-2">MAC</th>
							<th class="px-4 py-2">Name</th>
							<th class="px-4 py-2">CH</th>
							<th class="px-4 py-2">RSSI</th>
							<th class="px-4 py-2">PDU Type</th>
							<th class="px-4 py-2">Time</th>
						</tr>
					</thead>
					<tbody>
						{#each [...state.packets].reverse().slice(0, 100) as pkt}
							<tr class="border-b border-gray-800 hover:bg-gray-800/50">
								<td class="px-4 py-2 font-mono text-gray-300">{pkt.mac}</td>
								<td class="px-4 py-2 text-white">{pkt.name || '-'}</td>
								<td class="px-4 py-2 text-gray-400">{pkt.channel}</td>
								<td class="px-4 py-2 font-mono {getRssiColor(pkt.rssi)}"
									>{pkt.rssi} dBm</td
								>
								<td class="px-4 py-2 text-gray-400">{pkt.pduType}</td>
								<td class="px-4 py-2 text-gray-500 text-xs"
									>{new Date(pkt.timestamp).toLocaleTimeString()}</td
								>
							</tr>
						{:else}
							<tr
								><td colspan="6" class="px-4 py-12 text-center text-gray-600">
									{state.running
										? 'Listening for BLE packets...'
										: 'Start capture to begin'}
								</td></tr
							>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</main>
</div>

<HardwareConflictModal bind:show={showConflict} currentOwner={conflictOwner} device="hackrf" />
