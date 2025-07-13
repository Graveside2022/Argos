<script lang="ts">
	import {
		timeWindowFilter,
		formatAge as _formatAge,
		getAgeColor as _getAgeColor,
		type TimeWindowConfig
	} from '$lib/services/hackrf/timeWindowFilter';
	import { onMount, onDestroy } from 'svelte';

	// Get stores from the filter
	const {
		signals: _signals,
		activeSignals: _activeSignals,
		fadingSignals: _fadingSignals,
		stats
	} = timeWindowFilter;

	// Configuration
	let windowDuration = 30; // seconds
	let fadeStartPercent = 60;
	let maxSignalAge = 45;
	let autoRemoveOld = true;

	// UI state
	let showAdvanced = false;
	let selectedPreset: string = 'drone';

	// Computed property for selected preset description
	$: selectedPresetData =
		selectedPreset && presets[selectedPreset as keyof typeof presets]
			? presets[selectedPreset as keyof typeof presets]
			: null;

	// Preset configurations
	const presets = {
		drone: {
			name: 'Drone Operations',
			windowDuration: 30,
			fadeStartPercent: 60,
			maxSignalAge: 45,
			description: 'Optimized for moving drone with 30s relevance window'
		},
		stationary: {
			name: 'Stationary Monitoring',
			windowDuration: 120,
			fadeStartPercent: 75,
			maxSignalAge: 180,
			description: 'Extended window for fixed position monitoring'
		},
		rapid: {
			name: 'Rapid Scan',
			windowDuration: 10,
			fadeStartPercent: 50,
			maxSignalAge: 15,
			description: 'Fast-moving platform or quick area scan'
		},
		surveillance: {
			name: 'Surveillance',
			windowDuration: 300,
			fadeStartPercent: 80,
			maxSignalAge: 600,
			description: 'Long-term pattern detection and analysis'
		}
	};

	// Apply configuration changes
	function applyConfig() {
		const config: Partial<TimeWindowConfig> = {
			windowDuration,
			fadeStartPercent,
			maxSignalAge
		};
		timeWindowFilter.setConfig(config);
	}

	// Apply preset
	function applyPreset(presetKey: string) {
		const preset = presets[presetKey as keyof typeof presets];
		if (preset) {
			windowDuration = preset.windowDuration;
			fadeStartPercent = preset.fadeStartPercent;
			maxSignalAge = preset.maxSignalAge;
			selectedPreset = presetKey;
			applyConfig();
		}
	}

	// Clear old signals manually
	function clearOldSignals() {
		const removed = timeWindowFilter.clearOlderThan(windowDuration);

		console.warn(`Removed ${removed} old signals`);
	}

	// Clear all signals
	function clearAllSignals() {
		timeWindowFilter.clear();
	}

	// Auto-remove timer
	let autoRemoveInterval: NodeJS.Timeout | null = null;

	$: if (autoRemoveOld) {
		if (autoRemoveInterval) clearInterval(autoRemoveInterval);
		autoRemoveInterval = setInterval(() => {
			timeWindowFilter.clearOlderThan(maxSignalAge);
		}, 5000); // Check every 5 seconds
	} else if (autoRemoveInterval) {
		clearInterval(autoRemoveInterval);
		autoRemoveInterval = null;
	}

	onMount(() => {
		// Apply default preset
		applyPreset('drone');
	});

	onDestroy(() => {
		if (autoRemoveInterval) {
			clearInterval(autoRemoveInterval);
		}
	});
</script>

<div class="glass-panel rounded-xl p-6 space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h3 class="text-h5 font-heading font-semibold text-text-primary flex items-center">
			<svg class="w-5 h-5 mr-2 text-neon-cyan" fill="currentColor" viewBox="0 0 20 20">
				<path
					fill-rule="evenodd"
					d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415l-2.536-2.536V6z"
					clip-rule="evenodd"
				/>
			</svg>
			Time Window Filter
		</h3>
		<button
			on:click={() => (showAdvanced = !showAdvanced)}
			class="text-text-muted hover:text-text-primary transition-colors"
		>
			<svg
				class="w-5 h-5 transform transition-transform {showAdvanced ? 'rotate-180' : ''}"
				fill="currentColor"
				viewBox="0 0 20 20"
			>
				<path
					fill-rule="evenodd"
					d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
					clip-rule="evenodd"
				/>
			</svg>
		</button>
	</div>

	<!-- Statistics Overview -->
	<div class="grid grid-cols-3 gap-3">
		<div class="text-center">
			<div class="text-2xl font-mono font-bold text-neon-green">{$stats.activeSignals}</div>
			<div class="text-xs text-text-muted uppercase">Active</div>
		</div>
		<div class="text-center">
			<div class="text-2xl font-mono font-bold text-amber-400">{$stats.fadingSignals}</div>
			<div class="text-xs text-text-muted uppercase">Fading</div>
		</div>
		<div class="text-center">
			<div class="text-2xl font-mono font-bold text-text-secondary">
				{$stats.totalSignals}
			</div>
			<div class="text-xs text-text-muted uppercase">Total</div>
		</div>
	</div>

	<!-- Presets -->
	<div class="space-y-2">
		<div class="text-sm font-medium text-text-muted uppercase tracking-wide">Quick Presets</div>
		<div class="grid grid-cols-2 gap-2">
			{#each Object.entries(presets) as [key, preset]}
				<button
					on:click={() => applyPreset(key)}
					class="p-3 rounded-lg border transition-all text-left
						{selectedPreset === key
						? 'bg-accent-primary/20 border-accent-primary text-text-primary'
						: 'bg-bg-card/50 border-border-primary hover:border-accent-primary/50 text-text-secondary hover:text-text-primary'}"
				>
					<div class="font-medium text-sm">{preset.name}</div>
					<div class="text-xs text-text-muted mt-1">{preset.windowDuration}s window</div>
				</button>
			{/each}
		</div>
		{#if selectedPresetData}
			<p class="text-xs text-text-muted mt-2">{selectedPresetData.description}</p>
		{/if}
	</div>

	<!-- Advanced Settings -->
	{#if showAdvanced}
		<div class="space-y-4 pt-4 border-t border-border-primary">
			<!-- Window Duration -->
			<div>
				<label
					for="windowDuration"
					class="flex items-center justify-between text-sm font-medium text-text-secondary mb-2"
				>
					<span>Window Duration</span>
					<span class="font-mono text-accent-primary">{windowDuration}s</span>
				</label>
				<input
					id="windowDuration"
					type="range"
					bind:value={windowDuration}
					on:change={applyConfig}
					min="5"
					max="300"
					step="5"
					class="w-full h-2 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-accent-primary"
				/>
			</div>

			<!-- Fade Start -->
			<div>
				<label
					for="fadeStart"
					class="flex items-center justify-between text-sm font-medium text-text-secondary mb-2"
				>
					<span>Fade Start</span>
					<span class="font-mono text-amber-400">{fadeStartPercent}%</span>
				</label>
				<input
					id="fadeStart"
					type="range"
					bind:value={fadeStartPercent}
					on:change={applyConfig}
					min="20"
					max="90"
					step="5"
					class="w-full h-2 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-amber-400"
				/>
			</div>

			<!-- Max Age -->
			<div>
				<label
					for="maxAge"
					class="flex items-center justify-between text-sm font-medium text-text-secondary mb-2"
				>
					<span>Max Signal Age</span>
					<span class="font-mono text-red-400">{maxSignalAge}s</span>
				</label>
				<input
					id="maxAge"
					type="range"
					bind:value={maxSignalAge}
					on:change={applyConfig}
					min="10"
					max="600"
					step="5"
					class="w-full h-2 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-red-400"
				/>
			</div>

			<!-- Auto-remove toggle -->
			<label class="flex items-center space-x-3 cursor-pointer">
				<input
					type="checkbox"
					bind:checked={autoRemoveOld}
					class="w-4 h-4 text-accent-primary bg-bg-input border-border-primary rounded focus:ring-accent-primary"
				/>
				<span class="text-sm text-text-secondary">Auto-remove expired signals</span>
			</label>

			<!-- Actions -->
			<div class="flex gap-2 pt-2">
				<button
					on:click={clearOldSignals}
					class="flex-1 px-3 py-2 text-sm bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg transition-colors"
				>
					Clear Old
				</button>
				<button
					on:click={clearAllSignals}
					class="flex-1 px-3 py-2 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
				>
					Clear All
				</button>
			</div>
		</div>
	{/if}

	<!-- Turnover Rate -->
	<div class="flex items-center justify-between text-xs text-text-muted">
		<span>Signal Turnover</span>
		<span class="font-mono">{$stats.signalTurnover.toFixed(1)}/s</span>
	</div>
</div>

<style>
	/* Custom range slider styling */
	input[type='range']::-webkit-slider-thumb {
		appearance: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: currentColor;
		cursor: pointer;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	input[type='range']::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: currentColor;
		cursor: pointer;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		border: none;
	}
</style>
