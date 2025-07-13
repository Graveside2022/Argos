<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let devices: Array<{
		mac: string;
		ssid?: string;
		type: string;
		channel?: number;
		signal?: number;
		encryptionType?: string[];
		lastSeen: string;
		[key: string]: unknown;
	}> = [];
	let stats: {
		total: number;
		byType: { AP?: number; Client?: number; [key: string]: unknown };
		activeInLast5Min: number;
		[key: string]: unknown;
	} | null = null;
	let isLoading = true;
	let error = '';
	let refreshInterval: ReturnType<typeof setInterval>;

	onMount(() => {
		void loadData();
		refreshInterval = setInterval(() => void loadData(), 5000);
	});

	onDestroy(() => {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}
	});

	async function loadData() {
		try {
			// Fetch devices
			const devicesRes = await fetch('/api/kismet/devices');
			if (devicesRes.ok) {
				devices = (await devicesRes.json()) as typeof devices;
			}

			// Fetch stats
			const statsRes = await fetch('/api/kismet/devices/stats');
			if (statsRes.ok) {
				stats = (await statsRes.json()) as typeof stats;
			}

			isLoading = false;
			error = '';
		} catch (err) {
			error = 'Failed to load Kismet data';
			console.error('Error loading Kismet data:', err);
		}
	}

	function _getSignalStrength(signal: number): string {
		if (signal > -50) return 'Excellent';
		if (signal > -70) return 'Good';
		if (signal > -85) return 'Fair';
		return 'Poor';
	}

	function getSignalColor(signal: number): string {
		if (signal > -50) return 'text-green-500';
		if (signal > -70) return 'text-yellow-500';
		if (signal > -85) return 'text-orange-500';
		return 'text-red-500';
	}
</script>

<div class="min-h-screen bg-black p-6">
	<!-- Header -->
	<header class="mb-8">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-4">
				<a href="/" class="text-cyan-500 hover:text-cyan-400 transition-colors">
					← Back to Console
				</a>
				<h1 class="text-2xl font-bold text-white">Kismet Dashboard</h1>
			</div>
			<a
				href="/kismet"
				class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded transition-colors"
			>
				Full Kismet UI →
			</a>
		</div>
	</header>

	{#if error}
		<div class="bg-red-900/20 border border-red-700 rounded-lg p-4 mb-6">
			<p class="text-red-400">{error}</p>
		</div>
	{/if}

	{#if isLoading}
		<div class="flex items-center justify-center h-64">
			<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
		</div>
	{:else}
		<!-- Stats Grid -->
		{#if stats}
			<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
				<div class="bg-gray-900 border border-gray-800 rounded-lg p-4">
					<h3 class="text-gray-400 text-sm mb-2">Total Devices</h3>
					<p class="text-2xl font-bold text-cyan-500">{stats?.total ?? 0}</p>
				</div>
				<div class="bg-gray-900 border border-gray-800 rounded-lg p-4">
					<h3 class="text-gray-400 text-sm mb-2">Access Points</h3>
					<p class="text-2xl font-bold text-green-500">{stats?.byType?.AP ?? 0}</p>
				</div>
				<div class="bg-gray-900 border border-gray-800 rounded-lg p-4">
					<h3 class="text-gray-400 text-sm mb-2">Clients</h3>
					<p class="text-2xl font-bold text-blue-500">{stats?.byType?.Client ?? 0}</p>
				</div>
				<div class="bg-gray-900 border border-gray-800 rounded-lg p-4">
					<h3 class="text-gray-400 text-sm mb-2">Active (5m)</h3>
					<p class="text-2xl font-bold text-yellow-500">{stats?.activeInLast5Min ?? 0}</p>
				</div>
			</div>
		{/if}

		<!-- Devices Table -->
		<div class="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
			<div class="px-6 py-4 border-b border-gray-800">
				<h2 class="text-lg font-semibold text-white">Detected Devices</h2>
			</div>

			<div class="overflow-x-auto">
				<table class="w-full">
					<thead>
						<tr class="border-b border-gray-800">
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
								>MAC Address</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
								>SSID/Name</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
								>Type</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
								>Channel</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
								>Signal</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
								>Encryption</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
								>Last Seen</th
							>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-800">
						{#each devices as device}
							<tr class="hover:bg-gray-800/50 transition-colors">
								<td
									class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-300"
								>
									{device?.mac ?? ''}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
									{device.ssid || '-'}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm">
									<span
										class="px-2 py-1 text-xs rounded-full {device.type === 'AP'
											? 'bg-green-900/50 text-green-400'
											: device.type === 'Client'
												? 'bg-blue-900/50 text-blue-400'
												: 'bg-gray-700 text-gray-400'}"
									>
										{device.type}
									</span>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
									{device.channel || '-'}
								</td>
								<td
									class="px-6 py-4 whitespace-nowrap text-sm {device.signal
										? getSignalColor(device.signal)
										: 'text-gray-400'}"
								>
									{device.signal ? `${device.signal} dBm` : '-'}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
									{device.encryptionType?.join(', ') || 'Open'}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
									{new Date(device.lastSeen).toLocaleTimeString()}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>
