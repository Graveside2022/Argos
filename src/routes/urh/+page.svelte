<script lang="ts">
	import HardwareStatusBar from '$lib/components/hardware/HardwareStatusBar.svelte';
	import CompanionLauncher from '$lib/components/shared/CompanionLauncher.svelte';
</script>

<svelte:head>
	<title>URH - Universal Radio Hacker | Argos</title>
</svelte:head>

<div class="min-h-screen bg-gray-950 text-white">
	<HardwareStatusBar />

	<header class="bg-gray-900 border-b border-gray-800 p-4">
		<div class="container mx-auto flex items-center gap-4">
			<a href="/" class="text-cyan-500 hover:text-cyan-400 transition-colors">&larr; Back</a>
			<h1 class="text-xl font-bold">
				<span class="text-purple-400">URH</span> - Universal Radio Hacker
			</h1>
		</div>
	</header>

	<main class="container mx-auto p-6 max-w-4xl">
		<section class="mb-8">
			<CompanionLauncher
				appName="urh"
				description="Desktop GUI application for signal analysis, protocol reverse engineering, and replay attacks. Launches URH with HackRF access."
				requiredDevice="hackrf"
			/>
		</section>

		<section class="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
			<h2 class="text-lg font-bold text-white mb-3">Capabilities</h2>
			<ul class="space-y-2 text-gray-400 text-sm">
				<li class="flex items-start gap-2">
					<span class="text-purple-400 mt-0.5">&#9656;</span>
					<span
						><strong class="text-gray-200">Signal Recording</strong> - Capture RF signals
						via HackRF for offline analysis</span
					>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-purple-400 mt-0.5">&#9656;</span>
					<span
						><strong class="text-gray-200">Protocol Analysis</strong> - Demodulate and decode
						proprietary wireless protocols</span
					>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-purple-400 mt-0.5">&#9656;</span>
					<span
						><strong class="text-gray-200">Signal Generation</strong> - Craft and transmit
						custom signals for testing</span
					>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-purple-400 mt-0.5">&#9656;</span>
					<span
						><strong class="text-gray-200">Fuzzing</strong> - Automated protocol fuzzing
						for security research</span
					>
				</li>
			</ul>
		</section>
	</main>
</div>
