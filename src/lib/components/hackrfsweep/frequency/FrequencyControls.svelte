<script lang="ts">
	interface Props {
		onAddFrequency: () => void;
		onLoadFrequencies: () => void;
		disabled?: boolean;
	}

	let { onAddFrequency, onLoadFrequencies, disabled = false }: Props = $props();
</script>

<div class="frequency-controls space-y-4">
	<!-- Add Frequency Button -->
	<button onclick={onAddFrequency} {disabled} class="saasfly-btn saasfly-btn-add w-full">
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
	<button onclick={onLoadFrequencies} {disabled} class="saasfly-btn saasfly-btn-secondary w-full">
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
				onclick={() =>
					onAddFrequency &&
					(onAddFrequency(),
					setTimeout(() => {
						// Add 2.4GHz preset
						const event = new CustomEvent('preset-frequency', {
							detail: { frequency: 2400 }
						});
						document.dispatchEvent(event);
					}, 50))}
				{disabled}
				class="preset-btn px-3 py-2 text-xs bg-bg-card/40 border border-border-primary/40 rounded-lg hover:bg-bg-card/60 hover:border-border-hover hover:border-opacity-50 transition-all duration-200"
			>
				2.4 GHz
			</button>
			<button
				onclick={() =>
					onAddFrequency &&
					(onAddFrequency(),
					setTimeout(() => {
						// Add 5GHz preset
						const event = new CustomEvent('preset-frequency', {
							detail: { frequency: 5000 }
						});
						document.dispatchEvent(event);
					}, 50))}
				{disabled}
				class="preset-btn px-3 py-2 text-xs bg-bg-card/40 border border-border-primary/40 rounded-lg hover:bg-bg-card/60 hover:border-border-hover hover:border-opacity-50 transition-all duration-200"
			>
				5 GHz
			</button>
			<button
				onclick={() =>
					onAddFrequency &&
					(onAddFrequency(),
					setTimeout(() => {
						// Add 915MHz preset
						const event = new CustomEvent('preset-frequency', {
							detail: { frequency: 915 }
						});
						document.dispatchEvent(event);
					}, 50))}
				{disabled}
				class="preset-btn px-3 py-2 text-xs bg-bg-card/40 border border-border-primary/40 rounded-lg hover:bg-bg-card/60 hover:border-border-hover hover:border-opacity-50 transition-all duration-200"
			>
				915 MHz
			</button>
			<button
				onclick={() =>
					onAddFrequency &&
					(onAddFrequency(),
					setTimeout(() => {
						// Add 433MHz preset
						const event = new CustomEvent('preset-frequency', {
							detail: { frequency: 433 }
						});
						document.dispatchEvent(event);
					}, 50))}
				{disabled}
				class="preset-btn px-3 py-2 text-xs bg-bg-card/40 border border-border-primary/40 rounded-lg hover:bg-bg-card/60 hover:border-border-hover hover:border-opacity-50 transition-all duration-200"
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
		@apply border text-neon-cyan transition-all duration-200;
		background-color: rgb(from var(--neon-cyan) r g b / 0.2);
		border-color: rgb(from var(--neon-cyan) r g b / 0.4);
	}

	.saasfly-btn-add:hover {
		background-color: rgb(from var(--neon-cyan) r g b / 0.3);
		border-color: rgb(from var(--neon-cyan) r g b / 0.6);
	}

	.saasfly-btn-secondary {
		@apply border text-text-primary transition-all duration-200;
		background-color: rgb(from var(--bg-card) r g b / 0.4);
		border-color: rgb(from var(--border-primary) r g b / 0.4);
	}

	.saasfly-btn-secondary:hover {
		background-color: rgb(from var(--bg-card) r g b / 0.6);
		border-color: var(--border-hover);
	}
</style>
