<script lang="ts">
	import HardwareStatusBar from '$lib/components/hardware/HardwareStatusBar.svelte';
	import BettercapDashboard from '$lib/components/bettercap/BettercapDashboard.svelte';
</script>

<svelte:head>
	<title>Bettercap - WiFi/BLE/Network Recon | Argos</title>
</svelte:head>

<div class="min-h-screen bg-gray-950 text-white">
	<HardwareStatusBar />

	<header class="bg-gray-900 border-b border-gray-800 p-4">
		<div class="container mx-auto flex items-center gap-4">
			<a href="/" class="text-cyan-500 hover:text-cyan-400 transition-colors">&larr; Back</a>
			<h1 class="text-xl font-bold">
				<span class="text-green-400">Bettercap</span> - WiFi/BLE/Network Recon
			</h1>
		</div>
	</header>

	<main class="container mx-auto p-6 max-w-6xl">
		<BettercapDashboard />
	</main>
</div>
