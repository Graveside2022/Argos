<script lang="ts">
	import { sweepStatus, cycleStatus, emergencyStopStatus, frequencyRanges } from '$lib/stores/hackrf';
	import { hackrfAPI } from '$lib/services/hackrf/api';
	
	let cycleTime = 10;
	let starting = false;
	let stopping = false;
	
	function startSweep() {
		if ($frequencyRanges.length === 0) {
			alert('Please configure at least one frequency range');
			return;
		}
		
		starting = true;
		try {
			const frequencies = $frequencyRanges.map(range => ({
				start: range.start,
				stop: range.stop,
				step: range.step
			}));
			
			void hackrfAPI.startSweep(frequencies, cycleTime);
		} catch (error) {
			console.error('Failed to start sweep:', error);
			alert('Failed to start sweep. Check console for details.');
		} finally {
			starting = false;
		}
	}
	
	function stopSweep() {
		stopping = true;
		try {
			void hackrfAPI.stopSweep();
		} catch (error) {
			console.error('Failed to stop sweep:', error);
			alert('Failed to stop sweep. Check console for details.');
		} finally {
			stopping = false;
		}
	}
	
	function emergencyStop() {
		try {
			void hackrfAPI.emergencyStop();
		} catch (error) {
			console.error('Emergency stop failed:', error);
			alert('Emergency stop failed! Try manual shutdown.');
		}
	}
	
</script>

<!-- Sweep Control Panel -->
<div class="glass-panel rounded-xl p-6">
	<h3 class="text-h4 font-heading font-semibold text-text-primary mb-6 flex items-center">
		<svg class="w-5 h-5 mr-2 text-accent-muted" fill="currentColor" viewBox="0 0 20 20">
			<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 0016 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM12 10a1 1 0 100 2 1 1 0 000-2zm7 0a1 1 0 11-2 0 1 1 0 012 0z" clip-rule="evenodd"/>
		</svg>
		Sweep Control
	</h3>
	
	<!-- Cycle Time Configuration -->
	<div class="mb-6">
		<label for="sweepCycleTime" class="block font-mono text-xs text-text-muted uppercase tracking-wider mb-2">Cycle Time (seconds)</label>
		<div class="flex items-center space-x-4">
			<input 
				id="sweepCycleTime"
				type="range" 
				bind:value={cycleTime}
				min="1" 
				max="60" 
				class="flex-1 h-2 bg-bg-muted rounded-lg appearance-none cursor-pointer accent-accent-primary"
				disabled={$sweepStatus.active}
			/>
			<div class="w-20 text-center">
				<span class="font-mono text-h4 text-accent-primary">{cycleTime}s</span>
			</div>
		</div>
		<div class="flex justify-between mt-2">
			<span class="font-mono text-caption text-text-muted">Fast</span>
			<span class="font-mono text-caption text-text-muted">Slow</span>
		</div>
	</div>
	
	<!-- Status Information -->
	<div class="grid grid-cols-2 gap-4 mb-6">
		<div class="glass-panel-light rounded-lg p-4">
			<span class="font-mono text-xs text-text-muted uppercase tracking-wider">Status</span>
			<p class="font-mono text-body {$sweepStatus.active ? 'text-neon-green' : 'text-text-secondary'} mt-1">
				{$sweepStatus.active ? 'Sweeping' : 'Idle'}
			</p>
		</div>
		<div class="glass-panel-light rounded-lg p-4">
			<span class="font-mono text-xs text-text-muted uppercase tracking-wider">Progress</span>
			<p class="font-mono text-body text-text-primary mt-1">
				{#if $cycleStatus.currentCycle && $cycleStatus.totalCycles}
					{$cycleStatus.currentCycle} / {$cycleStatus.totalCycles}
				{:else}
					--
				{/if}
			</p>
		</div>
	</div>
	
	<!-- Control Buttons -->
	<div class="flex space-x-4">
		{#if !$sweepStatus.active}
			<button 
				on:click={startSweep}
				disabled={starting || $frequencyRanges.length === 0}
				class="flex-1 saasfly-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{#if starting}
					<svg class="w-5 h-5 mr-2 animate-spin" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
					</svg>
					Starting...
				{:else}
					<svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 0016 0zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
					</svg>
					Start Sweep
				{/if}
			</button>
		{:else}
			<button 
				on:click={stopSweep}
				disabled={stopping}
				class="flex-1 glass-button rounded-lg hover:bg-bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{#if stopping}
					<svg class="w-5 h-5 mr-2 animate-spin" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
					</svg>
					Stopping...
				{:else}
					<div class="flex items-center justify-center">
						<svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 0016 0zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clip-rule="evenodd"/>
						</svg>
						Stop Sweep
					</div>
				{/if}
			</button>
			<button 
				on:click={emergencyStop}
				class="px-6 py-3 bg-red-500/20 text-red-400 border border-red-500/40 rounded-lg hover:bg-red-500/30 hover:shadow-red-glow transition-all duration-200 font-semibold"
			>
				<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
					<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1z" clip-rule="evenodd"/>
				</svg>
			</button>
		{/if}
	</div>
	
	<!-- Emergency Stop Warning -->
	{#if $emergencyStopStatus.active}
		<div class="mt-4 p-4 bg-red-500/20 border border-red-500/40 rounded-lg animate-pulse">
			<p class="font-mono text-caption text-red-400 flex items-center">
				<svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
					<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
				</svg>
				Emergency stop activated. Restart the application to continue.
			</p>
		</div>
	{/if}
</div>