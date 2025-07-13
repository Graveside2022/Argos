<script lang="ts">
	import { hackrfAPI } from '$lib/services/hackrf/api';
	import { controlStore, controlActions } from '$lib/stores/hackrfsweep/controlStore';
	import { frequencyStore } from '$lib/stores/hackrfsweep/frequencyStore';
	import { displayActions } from '$lib/services/hackrfsweep/displayService';
	import { connectionStatus, sweepStatus, cycleStatus } from '$lib/stores/hackrf';

	$: controlState = $controlStore.sweepControl;
	$: frequencies = $frequencyStore.frequencies;

	async function startSweep() {
		if (frequencies.length === 0 || !frequencies.some((f) => f.value)) {
			alert('Please add at least one frequency');
			return;
		}

		try {
			controlActions.setSweepLoading(true);

			const validFreqs = frequencies
				.filter((f) => f.value)
				.map((f) => ({
					start: Number(f.value) - 10,
					stop: Number(f.value) + 10,
					step: 1
				}));

			await hackrfAPI.startSweep(validFreqs, controlState.cycleTime);
			
			// Update display with first frequency
			const validFreqValues = frequencies.filter((f) => f.value);
			if (validFreqValues.length > 0) {
				displayActions.setCurrentFrequency(validFreqValues[0].value + ' MHz');
				displayActions.setTargetFrequency(validFreqValues[0].value + ' MHz');
			}

			controlActions.setSweepStarted();
			displayActions.setStatusMessage('Sweep started successfully');
			displayActions.startLocalTimer();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			displayActions.setStatusMessage('Failed to start sweep: ' + errorMessage);
			controlActions.setSweepLoading(false);
		}
	}

	async function stopSweep() {
		try {
			controlActions.setSweepLoading(true);
			
			await hackrfAPI.stopSweep();
			
			controlActions.setSweepStopped();
			displayActions.setStatusMessage('Sweep stopped');
			displayActions.resetDisplays();
			displayActions.stopLocalTimer();

			// Force update the stores
			sweepStatus.set({
				active: false,
				startFreq: 0,
				endFreq: 0,
				currentFreq: 0,
				progress: 0
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			displayActions.setStatusMessage('Failed to stop sweep: ' + errorMessage);
			controlActions.setSweepLoading(false);
		}
	}

	async function emergencyStop() {
		try {
			await fetch('/api/hackrf/emergency-stop', { method: 'POST' });
			
			// Force reset everything
			controlActions.setSweepStopped();
			displayActions.setStatusMessage('Emergency stop executed');
			displayActions.resetDisplays();
			displayActions.stopLocalTimer();

			// Force update stores
			sweepStatus.set({
				active: false,
				startFreq: 0,
				endFreq: 0,
				currentFreq: 0,
				progress: 0
			});

			cycleStatus.set({
				active: false,
				currentCycle: 0,
				totalCycles: 0,
				progress: 0
			});
		} catch {
			displayActions.setStatusMessage('Emergency stop failed');
		}
	}

	async function reconnectToHackRF() {
		// Placeholder for reconnection logic
		displayActions.setStatusMessage('Attempting to reconnect...');
	}
</script>

<!-- Sweep Control Section -->
<div class="space-y-6">
	<div>
		<label
			for="cycleTimeInput"
			class="block text-sm font-medium text-text-muted mb-3 uppercase tracking-wide"
		>
			Cycle Time (seconds)
		</label>
		<input
			id="cycleTimeInput"
			type="number"
			value={controlState.cycleTime}
			on:input={(e) => controlActions.setCycleTime(Number(e.currentTarget.value))}
			min="1"
			max="30"
			placeholder="1-30"
			class="w-full px-4 py-3 bg-bg-input/80 border border-border-primary/60 rounded-xl text-text-primary outline-none focus:border-accent-primary focus:bg-bg-input focus:shadow-lg focus:shadow-accent-primary/20 transition-all duration-300"
		/>
	</div>

	<div class="grid grid-cols-1 gap-3">
		<button
			on:click={startSweep}
			disabled={!controlState.canStart || controlState.isLoading}
			class="saasfly-btn saasfly-btn-start w-full"
		>
			<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
				<path
					fill-rule="evenodd"
					d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
				/>
			</svg>
			{controlState.isLoading ? 'Starting...' : 'Start Sweep'}
		</button>
		
		<button
			on:click={stopSweep}
			disabled={!controlState.canStop || controlState.isLoading}
			class="saasfly-btn saasfly-btn-stop w-full"
		>
			<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
				<path
					fill-rule="evenodd"
					d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 012 0v6a1 1 0 11-2 0V7z"
				/>
			</svg>
			{controlState.isLoading ? 'Stopping...' : 'Stop Sweep'}
		</button>

		{#if controlState.canEmergencyStop}
			<button
				on:click={emergencyStop}
				class="saasfly-btn w-full mt-2 bg-red-600/20 border-red-500/40 hover:bg-red-600/30 hover:border-border-hover/50 text-red-400"
			>
				<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
						clip-rule="evenodd"
					/>
				</svg>
				Force Stop
			</button>
		{/if}
	</div>

	{#if $connectionStatus.error}
		<div
			class="mt-4 p-3 rounded-lg text-sm {$connectionStatus.error.includes('please refresh')
				? 'bg-red-500/10 border border-red-500/20 text-red-400'
				: 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'} {$connectionStatus.error.includes('Recovering') || $connectionStatus.error.includes('Reconnecting')
				? 'animate-pulse'
				: ''}"
		>
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-2">
					{#if $connectionStatus.error.includes('Recovering') || $connectionStatus.error.includes('Reconnecting')}
						<svg class="w-4 h-4 animate-spin" fill="currentColor" viewBox="0 0 20 20">
							<path d="M10 3v2a5 5 0 0 0 0 10v2a7 7 0 1 1 0-14z" />
						</svg>
					{:else}
						<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
								clip-rule="evenodd"
							/>
						</svg>
					{/if}
					<span>{$connectionStatus.error}</span>
				</div>
				{#if $connectionStatus.error.includes('please refresh') || $connectionStatus.error.includes('stale')}
					<button
						on:click={reconnectToHackRF}
						class="px-3 py-1 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 rounded transition-colors"
					>
						Reconnect
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.saasfly-btn {
		@apply flex items-center justify-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed;
	}

	.saasfly-btn-start {
		@apply bg-green-600/20 border border-green-500/40 text-green-400 hover:bg-green-600/30 hover:border-border-hover/50 hover:shadow-lg hover:shadow-green-400/20;
	}

	.saasfly-btn-stop {
		@apply bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/30 hover:border-border-hover/50 hover:shadow-lg hover:shadow-red-400/20;
	}
</style>