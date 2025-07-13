<script lang="ts">
	import { timeWindowFilter } from '$lib/services/hackrf/timeWindowFilter';
	import type { SignalDetection } from '$lib/services/api/hackrf';

	// Demo signal generation
	let isGenerating = false;
	let generationInterval: NodeJS.Timeout | null = null;
	let signalCount = 0;

	// Signal generation parameters
	let minFreq = 2400; // MHz
	let maxFreq = 2480; // MHz
	let minPower = -90; // dBm
	let maxPower = -30; // dBm
	let signalsPerSecond = 2;

	function generateRandomSignal(): SignalDetection {
		const frequency = minFreq + Math.random() * (maxFreq - minFreq);
		const power = minPower + Math.random() * (maxPower - minPower);
		const bandwidth = 1 + Math.random() * 20; // 1-20 MHz

		signalCount++;

		return {
			frequency: frequency * 1e6, // Convert to Hz
			power,
			bandwidth: bandwidth * 1e6, // Convert to Hz
			timestamp: Date.now(),
			modulation: Math.random() > 0.5 ? 'FM' : 'AM'
		};
	}

	function startGeneration() {
		if (generationInterval) return;

		isGenerating = true;

		// Generate initial batch
		const initialBatch: SignalDetection[] = [];
		for (let i = 0; i < 10; i++) {
			initialBatch.push(generateRandomSignal());
		}
		timeWindowFilter.addSignalBatch(initialBatch);

		// Continue generating at specified rate
		generationInterval = setInterval(() => {
			const signal = generateRandomSignal();
			timeWindowFilter.addSignal(signal);
		}, 1000 / signalsPerSecond);
	}

	function stopGeneration() {
		if (generationInterval) {
			clearInterval(generationInterval);
			generationInterval = null;
		}
		isGenerating = false;
	}

	function clearAll() {
		stopGeneration();
		timeWindowFilter.clear();
		signalCount = 0;
	}

	// Simulate drone movement
	let isDroneMoving = false;
	let droneSpeed = 10; // m/s
	let droneInterval: NodeJS.Timeout | null = null;

	function simulateDroneMovement() {
		if (droneInterval) {
			clearInterval(droneInterval);
			droneInterval = null;
			isDroneMoving = false;
			return;
		}

		isDroneMoving = true;
		let position = 0;

		droneInterval = setInterval(() => {
			position += droneSpeed;

			// Change frequency range based on position (simulating different areas)
			const zoneIndex = Math.floor(position / 100) % 4;
			switch (zoneIndex) {
				case 0: // WiFi zone
					minFreq = 2400;
					maxFreq = 2480;
					break;
				case 1: // 5 GHz zone
					minFreq = 5150;
					maxFreq = 5250;
					break;
				case 2: // ISM band
					minFreq = 900;
					maxFreq = 930;
					break;
				case 3: // Mixed zone
					minFreq = 2400;
					maxFreq = 5850;
					break;
			}

			// Generate location-specific signals
			if (isGenerating) {
				const locationSignals = Math.floor(Math.random() * 3) + 1;
				for (let i = 0; i < locationSignals; i++) {
					timeWindowFilter.addSignal(generateRandomSignal());
				}
			}
		}, 1000);
	}

	function exportData() {
		const data = timeWindowFilter.exportState();
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `signal-analysis-${Date.now()}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="glass-panel rounded-xl p-6 space-y-6">
	<h3 class="text-h5 font-heading font-semibold text-text-primary flex items-center">
		<svg class="w-5 h-5 mr-2 text-neon-cyan" fill="currentColor" viewBox="0 0 20 20">
			<path
				fill-rule="evenodd"
				d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zM4 6h12v10H4V6z"
				clip-rule="evenodd"
			/>
		</svg>
		Time Filter Demo
	</h3>

	<!-- Signal Generation Controls -->
	<div class="space-y-4">
		<h4 class="text-sm font-medium text-text-secondary uppercase tracking-wide">
			Signal Generation
		</h4>

		<div class="grid grid-cols-2 gap-4">
			<div>
				<label class="text-xs text-text-muted">Frequency Range (MHz)</label>
				<div class="flex items-center gap-2 mt-1">
					<input
						type="number"
						bind:value={minFreq}
						class="w-20 px-2 py-1 text-sm bg-bg-secondary border border-border-primary rounded"
					/>
					<span class="text-text-muted">-</span>
					<input
						type="number"
						bind:value={maxFreq}
						class="w-20 px-2 py-1 text-sm bg-bg-secondary border border-border-primary rounded"
					/>
				</div>
			</div>

			<div>
				<label class="text-xs text-text-muted">Power Range (dBm)</label>
				<div class="flex items-center gap-2 mt-1">
					<input
						type="number"
						bind:value={minPower}
						class="w-20 px-2 py-1 text-sm bg-bg-secondary border border-border-primary rounded"
					/>
					<span class="text-text-muted">-</span>
					<input
						type="number"
						bind:value={maxPower}
						class="w-20 px-2 py-1 text-sm bg-bg-secondary border border-border-primary rounded"
					/>
				</div>
			</div>
		</div>

		<div>
			<label
				for="signalRate"
				class="flex items-center justify-between text-xs text-text-muted"
			>
				<span>Signals/Second</span>
				<span class="font-mono text-accent-primary">{signalsPerSecond}</span>
			</label>
			<input
				id="signalRate"
				type="range"
				bind:value={signalsPerSecond}
				min="0.5"
				max="10"
				step="0.5"
				class="w-full h-2 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-accent-primary mt-1"
			/>
		</div>

		<!-- Control Buttons -->
		<div class="grid grid-cols-3 gap-2">
			<button
				on:click={() => (isGenerating ? stopGeneration() : startGeneration())}
				class="px-3 py-2 text-sm rounded-lg transition-colors
					{isGenerating
					? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
					: 'bg-green-500/20 hover:bg-green-500/30 text-green-400'}"
			>
				{isGenerating ? 'Stop' : 'Start'} Generation
			</button>

			<button
				on:click={simulateDroneMovement}
				class="px-3 py-2 text-sm rounded-lg transition-colors
					{isDroneMoving
					? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400'
					: 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400'}"
			>
				{isDroneMoving ? 'Stop' : 'Start'} Drone
			</button>

			<button
				on:click={clearAll}
				class="px-3 py-2 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
			>
				Clear All
			</button>
		</div>

		<!-- Drone Status -->
		{#if isDroneMoving}
			<div class="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
				<div class="flex items-center gap-2 text-sm text-blue-400">
					<svg class="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
						<path
							d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"
						/>
					</svg>
					<span>Drone moving at {droneSpeed} m/s</span>
				</div>
			</div>
		{/if}

		<!-- Export Button -->
		<button
			on:click={exportData}
			class="w-full px-3 py-2 text-sm bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors flex items-center justify-center gap-2"
		>
			<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
				<path
					fill-rule="evenodd"
					d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
					clip-rule="evenodd"
				/>
			</svg>
			Export Analysis Data
		</button>
	</div>

	<!-- Status -->
	<div class="text-xs text-text-muted text-center">
		Generated {signalCount} signals
	</div>
</div>

<style>
	input[type='range']::-webkit-slider-thumb {
		appearance: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: currentColor;
		cursor: pointer;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	input[type='range']::-moz-range-thumb {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: currentColor;
		cursor: pointer;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		border: none;
	}
</style>
