<script lang="ts">
	import { onMount } from 'svelte';
	import { btleState, startBtlePolling, stopBtlePolling } from '$lib/stores/btleStore';

	interface Props {
		isOpen?: boolean;
		onClose?: () => void;
	}

	let { isOpen = false, onClose = () => {} }: Props = $props();

	let state = $derived($btleState);

	onMount(() => {
		startBtlePolling();
		return () => {
			stopBtlePolling();
		};
	});

	// Aggregate unique devices from packets
	function getUniqueDevices(): {
		mac: string;
		name: string | null;
		rssi: number;
		lastSeen: string;
	}[] {
		const deviceMap = new Map<
			string,
			{ mac: string; name: string | null; rssi: number; lastSeen: string }
		>();
		for (const pkt of state.packets) {
			const existing = deviceMap.get(pkt.mac);
			if (!existing || pkt.timestamp > existing.lastSeen) {
				deviceMap.set(pkt.mac, {
					mac: pkt.mac,
					name: pkt.name,
					rssi: pkt.rssi,
					lastSeen: pkt.timestamp
				});
			}
		}
		return Array.from(deviceMap.values()).sort((a, b) => b.rssi - a.rssi);
	}

	function getRssiColor(rssi: number): string {
		if (rssi > -50) return 'text-green-400';
		if (rssi > -70) return 'text-yellow-400';
		return 'text-red-400';
	}

	let uniqueDevices = $derived(getUniqueDevices());
</script>

{#if isOpen}
	<div
		class="fixed top-0 right-0 w-96 h-full bg-gray-900/95 border-l border-gray-700 z-[1000] overflow-y-auto"
	>
		<div class="flex items-center justify-between p-4 border-b border-gray-700">
			<h2 class="text-sm font-bold text-blue-400">BTLE Devices</h2>
			<button onclick={onClose} class="text-gray-400 hover:text-white text-lg">&times;</button
			>
		</div>

		<div class="p-4 space-y-4">
			<div class="flex items-center gap-3 text-xs">
				<div class="flex items-center gap-1">
					<div
						class="w-2 h-2 rounded-full {state.running
							? 'bg-green-500'
							: 'bg-gray-600'}"
					></div>
					<span class="text-gray-400"
						>{state.running ? `CH ${state.channel}` : 'Stopped'}</span
					>
				</div>
				<span class="text-gray-500"
					>{state.packetCount} pkts | {state.uniqueDevices} devices</span
				>
			</div>

			{#if uniqueDevices.length > 0}
				{#each uniqueDevices.slice(0, 30) as device}
					<div class="bg-gray-800/50 rounded p-2 text-xs">
						<div class="flex items-center justify-between">
							<span class="text-white font-mono">{device.name || device.mac}</span>
							<span class="font-mono {getRssiColor(device.rssi)}"
								>{device.rssi} dBm</span
							>
						</div>
						{#if device.name}
							<div class="text-gray-500 font-mono">{device.mac}</div>
						{/if}
						<div class="text-gray-600">
							{new Date(device.lastSeen).toLocaleTimeString()}
						</div>
					</div>
				{/each}
			{:else}
				<div class="text-center text-gray-600 py-8 text-sm">
					{state.running
						? 'Listening for BLE packets...'
						: 'Start BTLE capture to see devices'}
				</div>
			{/if}
		</div>
	</div>
{/if}
