<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { hackrfAPI } from '$lib/services/hackrf/api';
	import { sweepStatus } from '$lib/stores/hackrf';
	
	let isStarted = false;
	let messages: string[] = [];
	
	function log(msg: string) {
		console.warn(msg);
		messages = [...messages, `${new Date().toISOString()}: ${msg}`];
	}
	
	// Subscribe to sweep status
	$: {
		log(`Sweep status update: active=${$sweepStatus.active}`);
		isStarted = $sweepStatus.active;
	}
	
	async function startSweep() {
		try {
			log('Starting sweep...');
			const response = await hackrfAPI.startSweep(
				[{ start: 2400e6, stop: 2500e6, step: 1e6 }],
				10
			);
			log(`Start response: ${JSON.stringify(response)}`);
		} catch (error: unknown) {
			log(`Start error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
	
	async function stopSweep() {
		try {
			log('=== STOP BUTTON CLICKED ===');
			log(`Current isStarted: ${isStarted}`);
			log('Calling hackrfAPI.stopSweep()...');
			
			const response = await hackrfAPI.stopSweep();
			log(`Stop response: ${JSON.stringify(response)}`);
			
			// Force update
			isStarted = false;
			log(`Stop completed. New isStarted: ${isStarted}`);
		} catch (error: unknown) {
			log(`Stop error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
	
	onMount(() => {
		log('Component mounted, connecting to data stream...');
		hackrfAPI.connectToDataStream();
	});
	
	onDestroy(() => {
		log('Component destroyed, disconnecting...');
		hackrfAPI.disconnectDataStream();
	});
</script>

<div class="p-8">
	<h1 class="text-2xl mb-4">HackRF Stop Button Test</h1>
	
	<div class="mb-4">
		<p>Sweep Status: {isStarted ? 'RUNNING' : 'STOPPED'}</p>
	</div>
	
	<div class="flex gap-4 mb-8">
		<button 
			on:click={startSweep}
			disabled={isStarted}
			class="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
		>
			Start Sweep
		</button>
		
		<button 
			on:click={stopSweep}
			disabled={!isStarted}
			class="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
		>
			Stop Sweep (Enabled: {!(!isStarted)})
		</button>
	</div>
	
	<div class="bg-gray-900 p-4 rounded">
		<h2 class="text-lg mb-2">Console Log:</h2>
		<div class="font-mono text-sm">
			{#each messages as msg}
				<div class="text-gray-300">{msg}</div>
			{/each}
		</div>
	</div>
</div>