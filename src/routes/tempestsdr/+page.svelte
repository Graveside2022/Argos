<script lang="ts">
	import HardwareStatusBar from '$lib/components/hardware/HardwareStatusBar.svelte';
	import CompanionLauncher from '$lib/components/shared/CompanionLauncher.svelte';
</script>

<svelte:head>
	<title>TempestSDR - RF Eavesdropping | Argos</title>
</svelte:head>

<div class="min-h-screen bg-gray-950 text-white">
	<HardwareStatusBar />

	<header class="bg-gray-900 border-b border-gray-800 p-4">
		<div class="container mx-auto flex items-center gap-4">
			<a href="/" class="text-cyan-500 hover:text-cyan-400 transition-colors">&larr; Back</a>
			<h1 class="text-xl font-bold">
				<span class="text-orange-400">TempestSDR</span> - RF Eavesdropping
			</h1>
		</div>
	</header>

	<main class="container mx-auto p-6 max-w-4xl">
		<div class="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4 mb-6">
			<p class="text-amber-300 text-sm">
				<strong>Legal Notice:</strong> This tool intercepts electromagnetic emanations from display
				devices. Use only on equipment you own or have explicit authorization to test.
			</p>
		</div>

		<section class="mb-8">
			<CompanionLauncher
				appName="tempestsdr"
				description="Java-based GUI for intercepting video signals from display electromagnetic emanations. Requires HackRF for RF capture."
				requiredDevice="hackrf"
			/>
		</section>

		<section class="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
			<h2 class="text-lg font-bold text-white mb-3">Common Display Frequencies</h2>
			<div class="grid grid-cols-2 gap-3 text-sm">
				<div class="bg-gray-800/50 rounded p-3">
					<span class="text-orange-400 font-mono">~350 MHz</span>
					<p class="text-gray-400 text-xs mt-1">VGA / HDMI (lower harmonics)</p>
				</div>
				<div class="bg-gray-800/50 rounded p-3">
					<span class="text-orange-400 font-mono">~500 MHz</span>
					<p class="text-gray-400 text-xs mt-1">Standard displays</p>
				</div>
				<div class="bg-gray-800/50 rounded p-3">
					<span class="text-orange-400 font-mono">~700 MHz</span>
					<p class="text-gray-400 text-xs mt-1">HD displays</p>
				</div>
				<div class="bg-gray-800/50 rounded p-3">
					<span class="text-orange-400 font-mono">~1.5 GHz</span>
					<p class="text-gray-400 text-xs mt-1">High-res / Retina displays</p>
				</div>
			</div>
		</section>
	</main>
</div>
