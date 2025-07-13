<script lang="ts">
	export let onAddFrequency: () => void;
	export let onLoadFrequencies: () => void;
	export let disabled: boolean = false;
</script>

<div class="frequency-controls space-y-4">
	<!-- Add Frequency Button -->
	<button
		on:click={onAddFrequency}
		{disabled}
		class="saasfly-btn saasfly-btn-add w-full"
	>
		<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
			<path
				fill-rule="evenodd"
				d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
				clip-rule="evenodd"
			/>
		</svg>
		Add Frequency
	</button>

	<!-- Load Frequencies Button -->
	<button
		on:click={onLoadFrequencies}
		{disabled}
		class="saasfly-btn saasfly-btn-secondary w-full"
	>
		<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
			<path
				fill-rule="evenodd"
				d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
				clip-rule="evenodd"
			/>
		</svg>
		Load Frequencies
	</button>

	<!-- Quick Preset Frequencies -->
	<div class="preset-frequencies">
		<div class="text-xs font-medium text-text-muted mb-2 uppercase tracking-wide">
			Quick Presets
		</div>
		<div class="grid grid-cols-2 gap-2">
			<button
				on:click={() => onAddFrequency && (onAddFrequency(), setTimeout(() => {
					// Add 2.4GHz preset
					const event = new CustomEvent('preset-frequency', { detail: { frequency: 2400 } });
					document.dispatchEvent(event);
				}, 50))}
				{disabled}
				class="preset-btn px-3 py-2 text-xs bg-bg-card/40 border border-border-primary/40 rounded-lg hover:bg-bg-card/60 hover:border-border-hover/50 transition-all duration-200"
			>
				2.4 GHz
			</button>
			<button
				on:click={() => onAddFrequency && (onAddFrequency(), setTimeout(() => {
					// Add 5GHz preset
					const event = new CustomEvent('preset-frequency', { detail: { frequency: 5000 } });
					document.dispatchEvent(event);
				}, 50))}
				{disabled}
				class="preset-btn px-3 py-2 text-xs bg-bg-card/40 border border-border-primary/40 rounded-lg hover:bg-bg-card/60 hover:border-border-hover/50 transition-all duration-200"
			>
				5 GHz
			</button>
			<button
				on:click={() => onAddFrequency && (onAddFrequency(), setTimeout(() => {
					// Add 915MHz preset
					const event = new CustomEvent('preset-frequency', { detail: { frequency: 915 } });
					document.dispatchEvent(event);
				}, 50))}
				{disabled}
				class="preset-btn px-3 py-2 text-xs bg-bg-card/40 border border-border-primary/40 rounded-lg hover:bg-bg-card/60 hover:border-border-hover/50 transition-all duration-200"
			>
				915 MHz
			</button>
			<button
				on:click={() => onAddFrequency && (onAddFrequency(), setTimeout(() => {
					// Add 433MHz preset
					const event = new CustomEvent('preset-frequency', { detail: { frequency: 433 } });
					document.dispatchEvent(event);
				}, 50))}
				{disabled}
				class="preset-btn px-3 py-2 text-xs bg-bg-card/40 border border-border-primary/40 rounded-lg hover:bg-bg-card/60 hover:border-border-hover/50 transition-all duration-200"
			>
				433 MHz
			</button>
		</div>
	</div>
</div>

<style>
	.frequency-controls {
		@apply flex flex-col space-y-4;
	}

	.preset-btn:hover {
		@apply shadow-md;
	}

	.saasfly-btn-add {
		@apply bg-neon-cyan/20 border border-neon-cyan/40 hover:bg-neon-cyan/30 hover:border-neon-cyan/60 text-neon-cyan transition-all duration-200;
	}

	.saasfly-btn-secondary {
		@apply bg-bg-card/40 border border-border-primary/40 hover:bg-bg-card/60 hover:border-border-hover/50 text-text-primary transition-all duration-200;
	}
</style>