<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import {
		signalFilter,
		type FilteringOptions,
		DRONE_FREQUENCY_BANDS,
		INTERFERENCE_BANDS
	} from '$lib/services/map/signalFiltering';
	import { type DroneDetectionResult } from '$lib/services/map/droneDetection';

	export let signalCount = 0;
	export let filteredCount = 0;
	export let showControls = true;

	const dispatch = createEventDispatcher();

	// Filter settings
	let filterOptions: FilteringOptions = {
		minPower: -80,
		maxPower: 0,
		gridSize: 50,
		aggregationMethod: 'weighted',
		timeWindow: 30000 as number,
		maxSignalsPerArea: 10,
		priorityMode: 'anomalous' as 'strongest' | 'newest' | 'persistent' | 'anomalous',
		droneFrequencies: true,
		movingSignalsOnly: false
	};

	// Quick presets
	const filterPresets = {
		'drone-surveillance': {
			name: 'Drone Surveillance',
			description: 'Focus on drone control and video frequencies',
			options: {
				droneFrequencies: true,
				minPower: -70,
				priorityMode: 'anomalous' as 'strongest' | 'newest' | 'persistent' | 'anomalous',
				movingSignalsOnly: false,
				maxSignalsPerArea: 20
			}
		},
		'high-priority': {
			name: 'High Priority Only',
			description: 'Show only strongest and most anomalous signals',
			options: {
				minPower: -60,
				priorityMode: 'strongest' as 'strongest' | 'newest' | 'persistent' | 'anomalous',
				maxSignalsPerArea: 5,
				timeWindow: 10000
			}
		},
		'movement-tracking': {
			name: 'Movement Tracking',
			description: 'Focus on moving signals only',
			options: {
				movingSignalsOnly: true,
				minPower: -75,
				priorityMode: 'newest' as 'strongest' | 'newest' | 'persistent' | 'anomalous',
				timeWindow: 60000
			}
		},
		'dense-reduction': {
			name: 'Dense Area Reduction',
			description: 'Aggressive filtering for crowded areas',
			options: {
				gridSize: 100,
				maxSignalsPerArea: 3,
				aggregationMethod: 'max' as 'max' | 'avg' | 'density' | 'weighted',
				minPower: -70
			}
		}
	};

	let selectedPreset = 'drone-surveillance';
	let showAdvanced = false;
	let droneDetectionEnabled = true;
	let droneResults: DroneDetectionResult | null = null;

	// Frequency band toggles
	let enabledBands = new Map<string, boolean>();

	// Initialize the Map with proper type safety
	DRONE_FREQUENCY_BANDS.forEach((band) => enabledBands.set(band.name, true));
	INTERFERENCE_BANDS.forEach((band) => enabledBands.set(band.name, false));

	// Apply filter preset
	function applyPreset(presetKey: string) {
		if (presetKey in filterPresets) {
			const preset = filterPresets[presetKey as keyof typeof filterPresets];
			filterOptions = { ...filterOptions, ...preset.options } as FilteringOptions;
			selectedPreset = presetKey;
			applyFilters();
		}
	}

	// Apply current filters
	function applyFilters() {
		// Update frequency bands based on toggles
		const enabledFreqBands = [...DRONE_FREQUENCY_BANDS, ...INTERFERENCE_BANDS].filter((band) =>
			enabledBands.get(band.name)
		);

		const excludedFreqBands = [...DRONE_FREQUENCY_BANDS, ...INTERFERENCE_BANDS].filter(
			(band) => !enabledBands.get(band.name)
		);

		const options: FilteringOptions = {
			...filterOptions,
			frequencyBands: filterOptions.droneFrequencies ? undefined : enabledFreqBands,
			excludeBands: filterOptions.droneFrequencies ? undefined : excludedFreqBands
		};

		signalFilter.setOptions(options);

		dispatch('filterChange', {
			options,
			droneDetection: droneDetectionEnabled
		});
	}

	// Handle slider changes with debouncing
	let updateTimer: ReturnType<typeof setTimeout> | undefined;
	function handleSliderChange() {
		if (updateTimer) clearTimeout(updateTimer);
		updateTimer = setTimeout(applyFilters, 300);
	}

	// Update drone detection results
	export function updateDroneResults(results: DroneDetectionResult) {
		droneResults = results;
	}

	// Initialize
	applyPreset(selectedPreset);
</script>

<div class="signal-filter-controls {showControls ? 'expanded' : 'collapsed'}">
	<div class="controls-header">
		<button
			class="toggle-btn"
			on:click={() => (showControls = !showControls)}
			aria-label="Toggle filter controls"
		>
			<svg
				class="w-4 h-4 transform transition-transform {showControls ? 'rotate-180' : ''}"
				fill="currentColor"
				viewBox="0 0 20 20"
			>
				<path
					fill-rule="evenodd"
					d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
				/>
			</svg>
		</button>

		<div class="header-info">
			<h3 class="text-sm font-semibold text-white">Signal Filtering</h3>
			<div class="signal-counts">
				<span class="count-badge total">{signalCount}</span>
				<svg
					class="w-4 h-4 text-gray-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13 7l5 5m0 0l-5 5m5-5H6"
					/>
				</svg>
				<span class="count-badge filtered">{filteredCount}</span>
				{#if signalCount > 0}
					<span class="reduction-badge">
						-{Math.round((1 - filteredCount / signalCount) * 100)}%
					</span>
				{/if}
			</div>
		</div>
	</div>

	{#if showControls}
		<div class="controls-body">
			<!-- Quick Presets -->
			<div class="preset-section">
				<label class="section-label">Quick Presets</label>
				<div class="preset-grid">
					{#each Object.entries(filterPresets) as [key, preset]}
						<button
							class="preset-btn {selectedPreset === key ? 'active' : ''}"
							on:click={() => applyPreset(key)}
							title={preset.description}
						>
							{preset.name}
						</button>
					{/each}
				</div>
			</div>

			<!-- Signal Strength Filter -->
			<div class="filter-section">
				<label class="section-label">Signal Strength (dBm)</label>
				<div class="range-slider">
					<input
						type="range"
						min="-100"
						max="0"
						bind:value={filterOptions.minPower}
						on:input={handleSliderChange}
						class="slider min-slider"
					/>
					<input
						type="range"
						min="-100"
						max="0"
						bind:value={filterOptions.maxPower}
						on:input={handleSliderChange}
						class="slider max-slider"
					/>
					<div class="range-values">
						<span>{filterOptions.minPower}</span>
						<span>to</span>
						<span>{filterOptions.maxPower}</span>
					</div>
				</div>
			</div>

			<!-- Spatial Aggregation -->
			<div class="filter-section">
				<label class="section-label">Spatial Aggregation</label>
				<div class="grid grid-cols-2 gap-2">
					<div>
						<label class="sub-label">Grid Size (m)</label>
						<select
							bind:value={filterOptions.gridSize}
							on:change={applyFilters}
							class="select-input"
						>
							<option value={25}>25m (Fine)</option>
							<option value={50}>50m (Default)</option>
							<option value={100}>100m (Coarse)</option>
							<option value={200}>200m (Very Coarse)</option>
						</select>
					</div>
					<div>
						<label class="sub-label">Max per Cell</label>
						<input
							type="number"
							min="1"
							max="50"
							bind:value={filterOptions.maxSignalsPerArea}
							on:change={applyFilters}
							class="number-input"
						/>
					</div>
				</div>
			</div>

			<!-- Priority Mode -->
			<div class="filter-section">
				<label class="section-label">Priority Mode</label>
				<select
					bind:value={filterOptions.priorityMode}
					on:change={applyFilters}
					class="select-input"
				>
					<option value="anomalous">Anomalous Signals</option>
					<option value="strongest">Strongest Signals</option>
					<option value="newest">Newest Signals</option>
					<option value="persistent">Persistent Signals</option>
				</select>
			</div>

			<!-- Drone Detection -->
			<div class="filter-section">
				<label class="flex items-center space-x-2 cursor-pointer">
					<input
						type="checkbox"
						bind:checked={droneDetectionEnabled}
						on:change={applyFilters}
						class="checkbox"
					/>
					<span class="text-sm text-gray-300">Enable Drone Detection</span>
				</label>

				{#if droneDetectionEnabled && droneResults}
					<div class="drone-stats">
						<div class="stat-item">
							<span class="stat-label">Active Drones:</span>
							<span class="stat-value">{droneResults.activeDrones.length}</span>
						</div>
						<div class="stat-item">
							<span class="stat-label">Alerts:</span>
							<span class="stat-value alerts">{droneResults.alerts.length}</span>
						</div>
					</div>
				{/if}
			</div>

			<!-- Movement Filter -->
			<div class="filter-section">
				<label class="flex items-center space-x-2 cursor-pointer">
					<input
						type="checkbox"
						bind:checked={filterOptions.movingSignalsOnly}
						on:change={applyFilters}
						class="checkbox"
					/>
					<span class="text-sm text-gray-300">Moving Signals Only</span>
				</label>
			</div>

			<!-- Advanced Options -->
			<button class="advanced-toggle" on:click={() => (showAdvanced = !showAdvanced)}>
				{showAdvanced ? 'Hide' : 'Show'} Advanced Options
				<svg
					class="w-4 h-4 ml-1 transform transition-transform {showAdvanced
						? 'rotate-180'
						: ''}"
					fill="currentColor"
					viewBox="0 0 20 20"
				>
					<path
						fill-rule="evenodd"
						d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
					/>
				</svg>
			</button>

			{#if showAdvanced}
				<div class="advanced-section">
					<!-- Frequency Bands -->
					<div class="filter-section">
						<label class="section-label">Frequency Bands</label>
						<div class="frequency-toggles">
							<div class="freq-group">
								<h4 class="freq-group-title">Drone Frequencies</h4>
								{#each DRONE_FREQUENCY_BANDS as band}
									<label class="freq-toggle">
										<input
											type="checkbox"
											checked={enabledBands.get(band.name)}
											on:change={(e) => {
												enabledBands.set(
													band.name,
													e.currentTarget.checked
												);
												applyFilters();
											}}
											class="checkbox"
										/>
										<span class="freq-label">
											{band.name}
											<span class="freq-range"
												>({band.minFreq}-{band.maxFreq} MHz)</span
											>
										</span>
									</label>
								{/each}
							</div>

							<div class="freq-group">
								<h4 class="freq-group-title">Common Interference</h4>
								{#each INTERFERENCE_BANDS as band}
									<label class="freq-toggle">
										<input
											type="checkbox"
											checked={enabledBands.get(band.name)}
											on:change={(e) => {
												enabledBands.set(
													band.name,
													e.currentTarget.checked
												);
												applyFilters();
											}}
											class="checkbox"
										/>
										<span class="freq-label">
											{band.name}
											<span class="freq-range"
												>({band.minFreq}-{band.maxFreq} MHz)</span
											>
										</span>
									</label>
								{/each}
							</div>
						</div>
					</div>

					<!-- Temporal Settings -->
					<div class="filter-section">
						<label class="section-label">Temporal Settings</label>
						<div class="grid grid-cols-2 gap-2">
							<div>
								<label class="sub-label">Time Window (s)</label>
								<input
									type="number"
									min="5"
									max="300"
									value={(filterOptions.timeWindow || 30000) / 1000}
									on:change={(e) => {
										filterOptions.timeWindow =
											parseInt(e.currentTarget.value) * 1000;
										applyFilters();
									}}
									class="number-input"
								/>
							</div>
							<div>
								<label class="sub-label">Aggregation</label>
								<select
									bind:value={filterOptions.aggregationMethod}
									on:change={applyFilters}
									class="select-input"
								>
									<option value="max">Maximum</option>
									<option value="avg">Average</option>
									<option value="weighted">Weighted</option>
									<option value="density">Density</option>
								</select>
							</div>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.signal-filter-controls {
		background-color: rgb(17 24 39 / 0.95);
		backdrop-filter: blur(4px);
		border-radius: 0.5rem;
		box-shadow:
			0 10px 15px -3px rgb(0 0 0 / 0.1),
			0 4px 6px -4px rgb(0 0 0 / 0.1);
		transition: all 0.3s;
		max-width: 320px;
	}

	.signal-filter-controls.collapsed {
		background-color: rgb(17 24 39 / 0.9);
	}

	.controls-header {
		padding: 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.toggle-btn {
		padding: 0.25rem;
		border-radius: 0.25rem;
		transition-property: color, background-color;
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
		transition-duration: 150ms;
		color: rgb(156 163 175);
	}
	.toggle-btn:hover {
		background-color: rgb(31 41 55);
		color: rgb(255 255 255);
	}

	.header-info {
		flex: 1 1 0%;
	}

	.signal-counts {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.count-badge {
		padding: 0.125rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		line-height: 1rem;
		font-family:
			ui-monospace, SFMono-Regular, 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono',
			'Courier New', monospace;
	}

	.count-badge.total {
		background-color: rgb(55 65 81);
		color: rgb(209 213 219);
	}

	.count-badge.filtered {
		background-color: rgb(8 145 178 / 0.2);
		color: rgb(34 211 238);
		border: 1px solid rgb(8 145 178 / 0.3);
	}

	.reduction-badge {
		padding: 0.125rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		line-height: 1rem;
		font-weight: 700;
		background-color: rgb(22 163 74 / 0.2);
		color: rgb(74 222 128);
		border: 1px solid rgb(22 163 74 / 0.3);
	}

	.controls-body {
		padding: 0 0.75rem 0.75rem 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.preset-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.preset-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
	}

	.preset-btn {
		padding: 0.5rem 0.75rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		line-height: 1rem;
		font-weight: 500;
		background-color: rgb(31 41 55);
		color: rgb(209 213 219);
		border: 1px solid rgb(55 65 81);
		transition: all 0.2s;
	}
	.preset-btn:hover {
		background-color: rgb(55 65 81);
		border-color: rgb(75 85 99);
	}

	.preset-btn.active {
		background-color: rgb(8 145 178 / 0.2);
		color: rgb(34 211 238);
		border-color: rgb(8 145 178 / 0.5);
	}
	.preset-btn.active:hover {
		background-color: rgb(8 145 178 / 0.3);
		border-color: rgb(8 145 178 / 0.7);
	}

	.filter-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.section-label {
		display: block;
		font-size: 0.875rem;
		line-height: 1.25rem;
		font-weight: 500;
		color: rgb(209 213 219);
	}

	.sub-label {
		display: block;
		font-size: 0.75rem;
		line-height: 1rem;
		color: rgb(156 163 175);
		margin-bottom: 0.25rem;
	}

	.range-slider {
		position: relative;
		height: 3rem;
	}

	.slider {
		position: absolute;
		width: 100%;
		height: 0.25rem;
		background-color: rgb(55 65 81);
		border-radius: 0.5rem;
		appearance: none;
		cursor: pointer;
		top: 50%;
		transform: translateY(-50%);
	}

	.slider::-webkit-slider-thumb {
		appearance: none;
		width: 1rem;
		height: 1rem;
		background-color: rgb(6 182 212);
		border-radius: 9999px;
		cursor: pointer;
		transition-property: color, background-color;
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
		transition-duration: 150ms;
	}
	.slider::-webkit-slider-thumb:hover {
		background-color: rgb(34 211 238);
	}

	.range-values {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		line-height: 1rem;
		color: rgb(156 163 175);
	}

	.select-input {
		width: 100%;
		padding: 0.25rem 0.5rem;
		background-color: rgb(31 41 55);
		border: 1px solid rgb(55 65 81);
		border-radius: 0.25rem;
		font-size: 0.875rem;
		line-height: 1.25rem;
		color: rgb(255 255 255);
	}
	.select-input:focus {
		border-color: rgb(6 182 212);
		outline: 2px solid transparent;
		outline-offset: 2px;
	}

	.number-input {
		width: 100%;
		padding: 0.25rem 0.5rem;
		background-color: rgb(31 41 55);
		border: 1px solid rgb(55 65 81);
		border-radius: 0.25rem;
		font-size: 0.875rem;
		line-height: 1.25rem;
		color: rgb(255 255 255);
	}
	.number-input:focus {
		border-color: rgb(6 182 212);
		outline: 2px solid transparent;
		outline-offset: 2px;
	}

	.checkbox {
		width: 1rem;
		height: 1rem;
		color: rgb(8 145 178);
		background-color: rgb(55 65 81);
		border-color: rgb(75 85 99);
		border-radius: 0.25rem;
	}
	.checkbox:focus {
		box-shadow: 0 0 0 2px rgb(6 182 212);
		ring-offset-width: 0px;
	}

	.drone-stats {
		margin-top: 0.5rem;
		padding: 0.5rem;
		background-color: rgb(31 41 55 / 0.5);
		border-radius: 0.25rem;
		border: 1px solid rgb(55 65 81);
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
	}

	.stat-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.stat-label {
		font-size: 0.75rem;
		line-height: 1rem;
		color: rgb(156 163 175);
	}

	.stat-value {
		font-size: 0.875rem;
		line-height: 1.25rem;
		font-weight: 700;
		color: rgb(255 255 255);
	}

	.stat-value.alerts {
		color: rgb(251 146 60);
	}

	.advanced-toggle {
		width: 100%;
		padding: 0.5rem 0.75rem;
		margin-top: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.875rem;
		line-height: 1.25rem;
		color: rgb(156 163 175);
		background-color: rgb(31 41 55 / 0.5);
		border-radius: 0.25rem;
		transition-property: color, background-color;
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
		transition-duration: 200ms;
	}
	.advanced-toggle:hover {
		color: rgb(255 255 255);
		background-color: rgb(31 41 55);
	}

	.advanced-section {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid rgb(31 41 55);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.frequency-toggles {
		margin-top: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.freq-group {
		margin-top: 0.25rem;
		margin-bottom: 0.25rem;
	}

	.freq-group-title {
		font-size: 0.75rem;
		line-height: 1rem;
		font-weight: 600;
		color: rgb(156 163 175);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.25rem;
	}

	.freq-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 0.25rem;
		padding-left: 0.25rem;
		padding-right: 0.25rem;
	}
	.freq-toggle:hover {
		background-color: rgb(31 41 55 / 0.5);
	}

	.freq-label {
		font-size: 0.75rem;
		line-height: 1rem;
		color: rgb(209 213 219);
	}

	.freq-range {
		color: rgb(107 114 128);
		margin-left: 0.25rem;
	}
</style>
