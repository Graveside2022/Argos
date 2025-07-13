<script lang="ts">
	export let frequencies: Array<{ id: number; value: number | string }> = [];
	export let onRemoveFrequency: (id: number) => void;

	// Reactive statements for validation
	$: hasValidFrequencies = frequencies.some((f) => f.value);
	$: frequencyCount = frequencies.length;
</script>

<div class="frequency-list">
	<div
		class="block text-sm font-medium text-text-muted mb-3 uppercase tracking-wide"
	>
		Frequencies
	</div>
	<div class="space-y-3 mb-6 max-h-[300px] overflow-y-auto">
		{#each frequencies as freq (freq.id)}
			<div
				class="frequency-item saasfly-interactive-card flex items-center gap-3 p-4 bg-gradient-to-r from-bg-card/40 to-bg-card/20 rounded-xl border border-border-primary/40 hover:border-border-hover/50 hover:bg-gradient-to-r hover:from-bg-card/60 hover:to-bg-card/40 hover:shadow-md transition-all duration-300"
			>
				<span
					class="font-mono text-sm text-text-muted font-semibold min-w-[24px] text-center bg-neon-cyan/10 rounded-lg px-2 py-1"
					>{freq.id}</span
				>
				<div class="flex-1 relative">
					<label class="sr-only" for="freq-{freq.id}"
						>Frequency {freq.id} in MHz</label
					>
					<input
						id="freq-{freq.id}"
						type="number"
						bind:value={freq.value}
						placeholder="Enter frequency"
						class="glass-input font-mono w-full pl-3 pr-12 py-2 bg-bg-input/80 border border-border-primary/60 rounded-lg text-text-primary outline-none focus:border-neon-cyan focus:bg-bg-input focus:shadow-neon-cyan-sm transition-all duration-300"
					/>
					<span
						class="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-sm text-text-secondary font-medium pointer-events-none"
						>MHz</span
					>
				</div>
				{#if frequencyCount > 1}
					<button
						on:click={() => onRemoveFrequency(freq.id)}
						class="remove-frequency-btn p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
						aria-label="Remove frequency {freq.id}"
					>
						<svg
							class="w-4 h-4"
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path
								fill-rule="evenodd"
								d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
							/>
						</svg>
					</button>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Frequency validation status -->
	{#if frequencies.length > 0 && !hasValidFrequencies}
		<div class="mt-2 text-sm text-amber-400 flex items-center gap-2">
			<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
				<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
			</svg>
			Please enter at least one frequency
		</div>
	{/if}
</div>

<style>
	.frequency-list {
		@apply space-y-2;
	}

	.glass-input:focus {
		box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.3);
	}
</style>