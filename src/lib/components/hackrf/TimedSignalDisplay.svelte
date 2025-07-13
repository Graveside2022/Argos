<script lang="ts">
	import { timeWindowFilter, formatAge, getAgeColor, getRelevanceIcon } from '$lib/services/hackrf/timeWindowFilter';
	import { onMount, onDestroy } from 'svelte';
	import { scale as _scale, fade as _fade } from 'svelte/transition';
	
	// Get stores
	const { signals, activeSignals: _activeSignals, fadingSignals: _fadingSignals, stats } = timeWindowFilter;
	
	// Display options
	let showFading = true;
	let sortBy: 'power' | 'age' | 'frequency' = 'power';
	let maxDisplay = 20;
	
	// Animation frame for smooth updates
	let animationFrame: number;
	
	// Sorted signals
	$: sortedSignals = [...$signals].sort((a, b) => {
		switch (sortBy) {
			case 'power':
				return b.power - a.power;
			case 'age':
				return a.age - b.age;
			case 'frequency':
				return a.frequency - b.frequency;
			default:
				return 0;
		}
	}).slice(0, maxDisplay);
	
	// Format frequency
	function formatFrequency(freq: number): string {
		if (freq >= 1e9) {
			return `${(freq / 1e9).toFixed(3)} GHz`;
		} else if (freq >= 1e6) {
			return `${(freq / 1e6).toFixed(3)} MHz`;
		} else {
			return `${(freq / 1e3).toFixed(1)} kHz`;
		}
	}
	
	// Get signal strength class
	function getSignalStrengthClass(power: number): string {
		if (power > -30) return 'text-red-400';
		if (power > -50) return 'text-orange-400';
		if (power > -70) return 'text-yellow-400';
		if (power > -90) return 'text-green-400';
		return 'text-blue-400';
	}
	
	// Continuous update for smooth animations
	function updateDisplay() {
		// Animation frame for smooth visual updates
		// The derived store updates automatically, no need to force reassignment
		animationFrame = requestAnimationFrame(updateDisplay);
	}
	
	onMount(() => {
		updateDisplay();
	});
	
	onDestroy(() => {
		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
		}
	});
</script>

<div class="glass-panel rounded-xl p-6 space-y-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h3 class="text-h5 font-heading font-semibold text-text-primary flex items-center">
			<svg class="w-5 h-5 mr-2 text-neon-cyan" fill="currentColor" viewBox="0 0 20 20">
				<path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
				<path fill-rule="evenodd" d="M4 5a2 2 0 012-2 1 1 0 000 2H6a2 2 0 100 4h2a2 2 0 100 4h-2a1 1 0 100 2 2 2 0 01-2-2v-1a2 2 0 01-2-2V7a2 2 0 012-2h5a1 1 0 100-2H6a2 2 0 00-2 2z" clip-rule="evenodd"/>
			</svg>
			Live Signals
		</h3>
		<div class="flex items-center gap-2">
			<!-- Sort selector -->
			<select
				bind:value={sortBy}
				class="px-3 py-1 text-sm bg-bg-secondary border border-border-primary rounded-lg text-text-secondary focus:border-accent-primary focus:outline-none"
			>
				<option value="power">Power</option>
				<option value="age">Age</option>
				<option value="frequency">Frequency</option>
			</select>
			
			<!-- Fading toggle -->
			<label class="flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					bind:checked={showFading}
					class="w-4 h-4 text-accent-primary bg-bg-input border-border-primary rounded focus:ring-accent-primary"
				>
				<span class="text-sm text-text-secondary">Show Fading</span>
			</label>
		</div>
	</div>
	
	<!-- Signal list -->
	<div class="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
		{#each sortedSignals as signal (signal.id)}
			{#if showFading || !signal.isExpiring}
				<div
					transition:_scale={{ duration: 200 }}
					class="relative p-3 rounded-lg border transition-all duration-300"
					style="
						opacity: {signal.opacity};
						border-color: rgba(255, 255, 255, {signal.opacity * 0.2});
						background-color: rgba(20, 20, 20, {signal.opacity * 0.6});
					"
				>
					<!-- Fade overlay for expiring signals -->
					{#if signal.isExpiring}
						<div 
							class="absolute inset-0 rounded-lg pointer-events-none"
							style="
								background: linear-gradient(90deg, 
									transparent 0%, 
									rgba(239, 68, 68, {(1 - signal.opacity) * 0.1}) 100%
								);
							"
						/>
					{/if}
					
					<div class="relative flex items-center justify-between">
						<!-- Signal info -->
						<div class="flex-1">
							<div class="flex items-center gap-3">
								<!-- Relevance indicator -->
								<span 
									class="text-lg" 
									style="color: {getAgeColor((signal.age / signal.timeToLive) * 100)}"
									title="Signal relevance: {(signal.relevance * 100).toFixed(0)}%"
								>
									{getRelevanceIcon(signal.relevance)}
								</span>
								
								<!-- Frequency -->
								<span class="font-mono text-sm text-accent-primary">
									{formatFrequency(signal.frequency)}
								</span>
								
								<!-- Power -->
								<span class="font-mono text-sm {getSignalStrengthClass(signal.power)}">
									{signal.power.toFixed(1)} dBm
								</span>
								
								<!-- Age -->
								<span class="font-mono text-xs text-text-muted">
									{formatAge(signal.age)}
								</span>
							</div>
							
							<!-- Additional info -->
							{#if signal.bandwidth}
								<div class="mt-1 text-xs text-text-muted">
									BW: {(signal.bandwidth / 1e3).toFixed(1)} kHz
								</div>
							{/if}
						</div>
						
						<!-- Time to live indicator -->
						{#if signal.isExpiring}
							<div class="text-right">
								<div class="text-xs text-red-400 font-mono">
									{Math.ceil(signal.timeToLive)}s
								</div>
								<div class="text-xs text-text-muted">
									remaining
								</div>
							</div>
						{/if}
					</div>
					
					<!-- Progress bar showing age -->
					<div class="mt-2 h-1 bg-bg-secondary rounded-full overflow-hidden">
						<div 
							class="h-full transition-all duration-500"
							style="
								width: {(signal.age / signal.timeToLive) * 100}%;
								background-color: {getAgeColor((signal.age / signal.timeToLive) * 100)};
							"
						/>
					</div>
				</div>
			{/if}
		{/each}
		
		{#if sortedSignals.length === 0}
			<div class="text-center py-8 text-text-muted">
				<svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="currentColor" viewBox="0 0 20 20">
					<path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"/>
				</svg>
				<p>No signals detected</p>
			</div>
		{/if}
	</div>
	
	<!-- Footer stats -->
	<div class="flex items-center justify-between text-xs text-text-muted border-t border-border-primary pt-3">
		<span>Showing {Math.min(maxDisplay, $signals.length)} of {$signals.length} signals</span>
		<span>Avg age: {$stats.averageAge.toFixed(1)}s</span>
	</div>
</div>

<style>
	.custom-scrollbar {
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
	}
	
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background-color: rgba(255, 255, 255, 0.2);
		border-radius: 3px;
	}
	
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background-color: rgba(255, 255, 255, 0.3);
	}
</style>