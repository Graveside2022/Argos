<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import HardwareStatusBar from '$lib/components/hardware/HardwareStatusBar.svelte';
	import HardwareConflictModal from '$lib/components/hardware/HardwareConflictModal.svelte';
	import {
		pagermonState,
		startPagermonPolling,
		stopPagermonPolling,
		startPagermon,
		stopPagermon
	} from '$lib/stores/pagermonStore';

	let state = { running: false, frequency: 152000000, messages: [] as any[], messageCount: 0 };
	let freqMHz = 152;
	let loading = false;
	let showConflict = false;
	let conflictOwner = '';

	const unsub = pagermonState.subscribe((s) => {
		state = s;
	});
	onMount(() => {
		startPagermonPolling();
	});
	onDestroy(() => {
		stopPagermonPolling();
		unsub();
	});

	async function handleStart() {
		loading = true;
		try {
			const result = await startPagermon(freqMHz * 1000000);
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
			await stopPagermon();
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Pagermon - POCSAG Pager Decoder | Argos</title>
</svelte:head>

<div class="min-h-screen bg-gray-950 text-white">
	<HardwareStatusBar />

	<header class="bg-gray-900 border-b border-gray-800 p-4">
		<div class="container mx-auto flex items-center gap-4">
			<a href="/" class="text-cyan-500 hover:text-cyan-400 transition-colors">&larr; Back</a>
			<h1 class="text-xl font-bold">
				<span class="text-yellow-400">Pagermon</span> - POCSAG Pager Decoder
			</h1>
		</div>
	</header>

	<main class="container mx-auto p-6 max-w-4xl space-y-6">
		<!-- Controls -->
		<div class="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
			<div class="flex items-center gap-4">
				<div class="flex items-center gap-2">
					<label class="text-sm text-gray-400">Frequency (MHz):</label>
					<input
						type="number"
						bind:value={freqMHz}
						step="0.1"
						min="1"
						max="6000"
						class="w-24 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm"
						disabled={state.running}
					/>
				</div>

				{#if state.running}
					<button
						onclick={handleStop}
						disabled={loading}
						class="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded transition-colors"
					>
						{loading ? 'Stopping...' : 'Stop'}
					</button>
					<span class="text-sm text-green-400">{state.messageCount} messages decoded</span
					>
				{:else}
					<button
						onclick={handleStart}
						disabled={loading}
						class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded transition-colors"
					>
						{loading ? 'Starting...' : 'Start Decoder'}
					</button>
				{/if}
			</div>
		</div>

		<!-- Message Feed -->
		<div class="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
			<div class="px-4 py-2 bg-gray-800 border-b border-gray-700">
				<h3 class="text-sm font-bold text-yellow-400">Message Feed</h3>
			</div>
			<div class="max-h-[60vh] overflow-y-auto">
				{#each [...state.messages].reverse() as msg}
					<div class="px-4 py-3 border-b border-gray-800 hover:bg-gray-800/50">
						<div class="flex items-center justify-between mb-1">
							<span class="font-mono text-xs text-yellow-400">CAP: {msg.capcode}</span
							>
							<span class="text-xs text-gray-500"
								>{new Date(msg.timestamp).toLocaleTimeString()}</span
							>
						</div>
						<p class="text-sm text-white">{msg.content || '<empty>'}</p>
						<span class="text-xs text-gray-600"
							>POCSAG{msg.bitrate} | Func: {msg.functionType}</span
						>
					</div>
				{:else}
					<div class="px-4 py-12 text-center text-gray-600">
						{state.running
							? 'Waiting for messages...'
							: 'Start the decoder to begin capturing'}
					</div>
				{/each}
			</div>
		</div>
	</main>
</div>

<HardwareConflictModal bind:show={showConflict} currentOwner={conflictOwner} device="hackrf" />
