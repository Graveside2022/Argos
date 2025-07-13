<script lang="ts">
	import { frequencyRanges } from '$lib/stores/hackrf';
	
	let newRange = { start: 100, stop: 200, step: 1 };
	
	function addFrequencyRange() {
		frequencyRanges.update(ranges => {
			// Validate the new range
			if (newRange.start >= newRange.stop) {
				alert('Start frequency must be less than stop frequency');
				return ranges;
			}
			if (newRange.step <= 0) {
				alert('Step size must be positive');
				return ranges;
			}
			
			return [...ranges, { ...newRange, id: Date.now().toString() }];
		});
		
		// Reset form
		newRange = { start: 100, stop: 200, step: 1 };
	}
	
	function removeFrequencyRange(id: string) {
		frequencyRanges.update(ranges => ranges.filter(r => r.id !== id));
	}
</script>

<!-- Frequency Configuration -->
<div class="glass-panel rounded-xl p-6">
	<h3 class="text-h4 font-heading font-semibold text-text-primary mb-6 flex items-center">
		<svg class="w-5 h-5 mr-2 text-accent-primary" fill="currentColor" viewBox="0 0 20 20">
			<path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 6.343a1 1 0 010-1.414l1.414-1.414a1 1 0 111.414 1.414l-1.414 1.414a1 1 0 01-1.414 0zM5.05 13.536a1 1 0 011.414 0L8 15.071l1.536-1.535a1 1 0 011.414 1.414L9.414 16.485a2 2 0 01-2.828 0L5.05 14.95a1 1 0 010-1.414z" clip-rule="evenodd"/>
		</svg>
		Frequency Configuration
	</h3>
	
	<!-- Add Frequency Range Form -->
	<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
		<div class="space-y-2">
			<label for="freqStart" class="block font-mono text-xs text-text-muted uppercase tracking-wider">Start (MHz)</label>
			<input 
				id="freqStart"
				type="number" 
				bind:value={newRange.start}
				min="1" 
				max="6000" 
				step="0.1" 
				class="w-full px-4 py-2 glass-input rounded-lg font-mono text-body text-text-primary"
			/>
		</div>
		<div class="space-y-2">
			<label for="freqStop" class="block font-mono text-xs text-text-muted uppercase tracking-wider">Stop (MHz)</label>
			<input 
				id="freqStop"
				type="number" 
				bind:value={newRange.stop}
				min="1" 
				max="6000" 
				step="0.1" 
				class="w-full px-4 py-2 glass-input rounded-lg font-mono text-body text-text-primary"
			/>
		</div>
		<div class="space-y-2">
			<label for="freqStep" class="block font-mono text-xs text-text-muted uppercase tracking-wider">Step (MHz)</label>
			<input 
				id="freqStep"
				type="number" 
				bind:value={newRange.step}
				min="0.1" 
				max="100" 
				step="0.1" 
				class="w-full px-4 py-2 glass-input rounded-lg font-mono text-body text-text-primary"
			/>
		</div>
		<div class="flex items-end">
			<button 
				on:click={addFrequencyRange}
				class="saasfly-button-primary w-full"
			>
				<svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
					<path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
				</svg>
				Add Range
			</button>
		</div>
	</div>
	
	<!-- Frequency Ranges List -->
	<div class="space-y-3">
		{#each $frequencyRanges as range (range.id)}
			<div class="glass-panel-light rounded-lg p-4 flex items-center justify-between hover:border-accent-primary/40 transition-all duration-300 group">
				<div class="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
					<div>
						<span class="font-mono text-xs text-text-muted uppercase tracking-wider">Start</span>
						<p class="font-mono text-body text-text-primary">{range.start} MHz</p>
					</div>
					<div>
						<span class="font-mono text-xs text-text-muted uppercase tracking-wider">Stop</span>
						<p class="font-mono text-body text-text-primary">{range.stop} MHz</p>
					</div>
					<div>
						<span class="font-mono text-xs text-text-muted uppercase tracking-wider">Step</span>
						<p class="font-mono text-body text-text-primary">{range.step} MHz</p>
					</div>
				</div>
				<button 
					on:click={() => removeFrequencyRange(range.id)}
					class="ml-4 p-2 glass-button-danger rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"
				>
					<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
					</svg>
				</button>
			</div>
		{/each}
		
		{#if $frequencyRanges.length === 0}
			<div class="text-center py-8 text-text-muted">
				<svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 20 20">
					<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"/>
				</svg>
				<p class="font-body text-body">No frequency ranges configured</p>
				<p class="font-body text-caption mt-2">Add a frequency range to begin scanning</p>
			</div>
		{/if}
	</div>
</div>