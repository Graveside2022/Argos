<script lang="ts">
	import { onMount } from 'svelte';
	import {
		bettercapState,
		startBettercapPolling,
		stopBettercapPolling,
		startRecon,
		stopRecon,
		sendCommand
	} from '$lib/stores/bettercapStore';
	import { hardwareStatus } from '$lib/stores/hardwareStore';
	import HardwareConflictModal from '$lib/components/shared/HardwareConflictModal.svelte';

	let state: any = $state({
		mode: null as string | null,
		running: false,
		wifiAPs: [] as any[],
		bleDevices: [] as any[],
		commandHistory: [] as string[],
		commandOutput: [] as string[]
	});
	let selectedMode: 'wifi-recon' | 'ble-recon' | 'net-recon' = $state('wifi-recon');
	let commandInput = $state('');
	let loading = $state(false);
	let showConflict = $state(false);
	let conflictOwner = $state('');
	let alfaAvailable = $state(true);

	onMount(() => {
		const unsubState = bettercapState.subscribe((s) => {
			state = s;
		});
		const unsubHw = hardwareStatus.subscribe((s) => {
			alfaAvailable = s.alfa.available;
		});

		startBettercapPolling();

		return () => {
			stopBettercapPolling();
			unsubState();
			unsubHw();
		};
	});

	async function handleStart() {
		loading = true;
		try {
			const result = await startRecon(selectedMode);
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
			await stopRecon();
		} finally {
			loading = false;
		}
	}

	async function handleCommand() {
		if (!commandInput.trim()) return;
		await sendCommand(commandInput);
		commandInput = '';
	}
</script>

<div class="space-y-6">
	<!-- Mode Selector -->
	<div class="flex items-center gap-4">
		<div class="flex gap-2">
			{#each [{ value: 'wifi-recon', label: 'WiFi', color: 'cyan' }, { value: 'ble-recon', label: 'BLE', color: 'blue' }, { value: 'net-recon', label: 'Network', color: 'green' }] as mode}
				<button
					onclick={() => (selectedMode = mode.value as any)}
					class="px-4 py-2 rounded text-sm font-medium transition-colors
						{selectedMode === mode.value
						? `bg-${mode.color}-600 text-white`
						: 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
				>
					{mode.label}
				</button>
			{/each}
		</div>

		{#if state.running}
			<button
				onclick={handleStop}
				disabled={loading}
				class="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded transition-colors"
			>
				{loading ? 'Stopping...' : 'Stop'}
			</button>
		{:else}
			<button
				onclick={handleStart}
				disabled={loading}
				class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded transition-colors"
			>
				{loading ? 'Starting...' : 'Start Recon'}
			</button>
		{/if}

		{#if selectedMode === 'wifi-recon' && !alfaAvailable}
			<span class="text-xs text-amber-400 font-mono">ALFA in use</span>
		{/if}
	</div>

	<!-- WiFi APs -->
	{#if selectedMode === 'wifi-recon'}
		<div class="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
			<div class="px-4 py-2 bg-gray-800 border-b border-gray-700">
				<h3 class="text-sm font-bold text-cyan-400">
					WiFi Access Points ({state.wifiAPs.length})
				</h3>
			</div>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="text-left text-gray-500 border-b border-gray-700">
							<th class="px-4 py-2">BSSID</th>
							<th class="px-4 py-2">ESSID</th>
							<th class="px-4 py-2">CH</th>
							<th class="px-4 py-2">Enc</th>
							<th class="px-4 py-2">RSSI</th>
							<th class="px-4 py-2">Clients</th>
						</tr>
					</thead>
					<tbody>
						{#each state.wifiAPs as ap}
							<tr class="border-b border-gray-800 hover:bg-gray-800/50">
								<td class="px-4 py-2 font-mono text-gray-300">{ap.bssid}</td>
								<td class="px-4 py-2 text-white">{ap.essid || '<hidden>'}</td>
								<td class="px-4 py-2 text-gray-400">{ap.channel}</td>
								<td class="px-4 py-2 text-gray-400">{ap.encryption}</td>
								<td class="px-4 py-2 text-gray-400">{ap.rssi} dBm</td>
								<td class="px-4 py-2 text-gray-400">{ap.clients}</td>
							</tr>
						{:else}
							<tr
								><td colspan="6" class="px-4 py-8 text-center text-gray-600"
									>No APs discovered yet</td
								></tr
							>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- BLE Devices -->
	{#if selectedMode === 'ble-recon'}
		<div class="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
			<div class="px-4 py-2 bg-gray-800 border-b border-gray-700">
				<h3 class="text-sm font-bold text-blue-400">
					BLE Devices ({state.bleDevices.length})
				</h3>
			</div>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="text-left text-gray-500 border-b border-gray-700">
							<th class="px-4 py-2">MAC</th>
							<th class="px-4 py-2">Name</th>
							<th class="px-4 py-2">Vendor</th>
							<th class="px-4 py-2">RSSI</th>
							<th class="px-4 py-2">Connectable</th>
						</tr>
					</thead>
					<tbody>
						{#each state.bleDevices as device}
							<tr class="border-b border-gray-800 hover:bg-gray-800/50">
								<td class="px-4 py-2 font-mono text-gray-300">{device.mac}</td>
								<td class="px-4 py-2 text-white">{device.name || 'Unknown'}</td>
								<td class="px-4 py-2 text-gray-400">{device.vendor}</td>
								<td class="px-4 py-2 text-gray-400">{device.rssi} dBm</td>
								<td class="px-4 py-2 text-gray-400"
									>{device.connectable ? 'Yes' : 'No'}</td
								>
							</tr>
						{:else}
							<tr
								><td colspan="5" class="px-4 py-8 text-center text-gray-600"
									>No BLE devices discovered yet</td
								></tr
							>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- Command Console -->
	<div class="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
		<div class="px-4 py-2 bg-gray-800 border-b border-gray-700">
			<h3 class="text-sm font-bold text-green-400">Command Console</h3>
		</div>
		<div class="p-4 max-h-48 overflow-y-auto font-mono text-xs bg-black/50">
			{#each state.commandOutput as output, i}
				<div class="text-gray-500">&gt; {state.commandHistory[i]}</div>
				<div class="text-green-300 mb-1">{output}</div>
			{:else}
				<div class="text-gray-600">Type a bettercap command below...</div>
			{/each}
		</div>
		<div class="flex border-t border-gray-700">
			<input
				type="text"
				bind:value={commandInput}
				onkeydown={(e) => e.key === 'Enter' && handleCommand()}
				placeholder="Enter bettercap command..."
				class="flex-1 bg-gray-900 text-white px-4 py-2 text-sm font-mono outline-none"
				disabled={!state.running}
			/>
			<button
				onclick={handleCommand}
				disabled={!state.running || !commandInput.trim()}
				class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white text-sm transition-colors"
			>
				Send
			</button>
		</div>
	</div>
</div>

<HardwareConflictModal bind:show={showConflict} currentOwner={conflictOwner} device="alfa" />
