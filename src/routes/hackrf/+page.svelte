<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { hackrfService } from '$lib/services/hackrf';
	import { logError } from '$lib/utils/logger';
	import HackRFHeader from '$lib/components/hackrf/HackRFHeader.svelte';
	import FrequencyConfig from '$lib/components/hackrf/FrequencyConfig.svelte';
	import SweepControl from '$lib/components/hackrf/SweepControl.svelte';
	import AnalysisTools from '$lib/components/hackrf/AnalysisTools.svelte';
	import StatusDisplay from '$lib/components/hackrf/StatusDisplay.svelte';
	import SpectrumChart from '$lib/components/hackrf/SpectrumChart.svelte';
	import GeometricBackground from '$lib/components/hackrf/GeometricBackground.svelte';

	let isInitializing = true;
	let initError: string | null = null;

	onMount(async () => {
		try {
			// Initialize HackRF service
			await hackrfService.initialize();
			isInitializing = false;
		} catch (error) {
			logError('Failed to initialize HackRF service', {
				error: error instanceof Error ? error.message : String(error)
			});
			initError =
				error instanceof Error ? error.message : 'Failed to initialize HackRF service';
			isInitializing = false;
		}
	});

	onDestroy(() => {
		// Cleanup service
		hackrfService.destroy();
	});
</script>

<div class="font-body text-white flex flex-col min-h-screen leading-body">
	<!-- Geometric Background Layers -->
	<GeometricBackground />

	<!-- Header -->
	<HackRFHeader />

	<!-- Main content container -->
	<div class="min-h-screen bg-black relative">
		<!-- Main Dashboard Section -->
		<section class="py-16 lg:py-24">
			<div class="container mx-auto px-4 lg:px-8 max-w-7xl">
				{#if isInitializing}
					<!-- Loading State -->
					<div class="flex flex-col items-center justify-center min-h-[400px]">
						<div
							class="w-16 h-16 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin mb-4"
						></div>
						<p class="text-text-secondary">Initializing HackRF service...</p>
					</div>
				{:else if initError}
					<!-- Error State -->
					<div class="max-w-md mx-auto">
						<div class="glass-panel rounded-2xl p-8 text-center">
							<svg
								class="w-16 h-16 text-red-400 mx-auto mb-4"
								fill="currentColor"
								viewBox="0 0 20 20"
							>
								<path
									fill-rule="evenodd"
									d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
								/>
							</svg>
							<h2 class="font-heading text-2xl font-bold mb-2">
								Initialization Failed
							</h2>
							<p class="text-text-secondary mb-6">{initError}</p>
							<button
								on:click={() => window.location.reload()}
								class="saasfly-btn saasfly-btn-primary"
							>
								<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
									<path
										fill-rule="evenodd"
										d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
									/>
								</svg>
								Reload Page
							</button>
						</div>
					</div>
				{:else}
					<!-- Dashboard Grid -->
					<div class="grid grid-cols-1 xl:grid-cols-3 gap-8 lg:gap-12">
						<!-- Control Panel Section -->
						<div class="xl:col-span-1">
							<div class="sticky top-24 space-y-8">
								<!-- Frequency Management -->
								<FrequencyConfig />

								<!-- Sweep Control -->
								<SweepControl />

								<!-- Tools Section -->
								<AnalysisTools />
							</div>
						</div>

						<!-- Main Content Area -->
						<div class="xl:col-span-2 space-y-8">
							<!-- Status Display -->
							<StatusDisplay />

							<!-- Spectrum Chart -->
							<SpectrumChart />
						</div>
					</div>
				{/if}
			</div>
		</section>
	</div>
</div>

<style>
	/* Page-specific styles will go here if needed */
</style>
