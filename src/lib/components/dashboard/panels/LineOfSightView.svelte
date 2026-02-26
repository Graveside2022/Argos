<script lang="ts">
	import { layerVisibility, toggleLayerVisibility } from '$lib/stores/dashboard/dashboard-store';
	import {
		rfRangeStore,
		setActivePreset,
		setFrequencySource,
		setManualFrequency,
		setRFRangeEnabled,
		updateCustomProfile
	} from '$lib/stores/dashboard/rf-range-store';
	import { hackrfStore } from '$lib/stores/tactical-map/hackrf-store';
	import { getPresetById, RF_PROFILE_LIMITS, RF_RANGE_PRESETS } from '$lib/types/rf-range';
	import { calculateFriisRange, clampDisplayRange } from '$lib/utils/rf-propagation';

	// Band legend definitions (label + fallback hex for swatches)
	const BAND_LEGEND = [
		{ key: 'strong', label: 'Strong', color: '#8bbfa0', fraction: 0.25 },
		{ key: 'usable', label: 'Usable', color: '#809ad0', fraction: 0.5 },
		{ key: 'marginal', label: 'Marginal', color: '#d4a054', fraction: 0.75 },
		{ key: 'maximum', label: 'Maximum', color: '#c45b4a', fraction: 1.0 }
	] as const;

	// Derived state from store
	let activeProfile = $derived(
		$rfRangeStore.activePresetId === 'custom'
			? $rfRangeStore.customProfile
			: (getPresetById($rfRangeStore.activePresetId) ?? $rfRangeStore.customProfile)
	);

	let activeFrequencyMHz = $derived(
		$rfRangeStore.frequencySource === 'auto'
			? $hackrfStore.targetFrequency
			: $rfRangeStore.manualFrequencyMHz
	);

	// Compute range for display
	let computedRange = $derived.by(() => {
		const freqHz = activeFrequencyMHz * 1e6;
		const rawRange = calculateFriisRange(
			freqHz,
			activeProfile.txPowerDbm,
			activeProfile.antennaGainDbi,
			activeProfile.rxAntennaGainDbi,
			activeProfile.sensitivityDbm
		);
		return clampDisplayRange(rawRange);
	});

	let rangeDisplay = $derived(
		computedRange.displayRange >= 1000
			? `${(computedRange.displayRange / 1000).toFixed(1)} km`
			: `${Math.round(computedRange.displayRange)} m`
	);

	// Compute band radii for legend
	let bandRadii = $derived(
		BAND_LEGEND.map((b) => {
			const r = computedRange.displayRange * b.fraction;
			return {
				...b,
				distance: r >= 1000 ? `${(r / 1000).toFixed(1)} km` : `${Math.round(r)} m`
			};
		})
	);

	let isCustom = $derived($rfRangeStore.activePresetId === 'custom');

	function handlePresetChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		setActivePreset(target.value);
	}

	function handleFreqSourceChange(source: 'auto' | 'manual') {
		setFrequencySource(source);
	}
</script>

<div class="los-view">
	<!-- Master enable toggle -->
	<section class="panel-section">
		<label class="toggle-row">
			<span class="toggle-label">Enable RF Range</span>
			<button
				class="toggle-switch"
				class:on={$rfRangeStore.isEnabled}
				onclick={() => setRFRangeEnabled(!$rfRangeStore.isEnabled)}
				role="switch"
				aria-checked={$rfRangeStore.isEnabled}
			>
				<span class="toggle-knob"></span>
			</button>
		</label>
	</section>

	{#if $rfRangeStore.isEnabled}
		<!-- Preset selector -->
		<section class="panel-section">
			<div class="section-label">HARDWARE PRESET</div>
			<select
				class="preset-select"
				value={$rfRangeStore.activePresetId}
				onchange={handlePresetChange}
			>
				{#each RF_RANGE_PRESETS as preset (preset.id)}
					<option value={preset.id}>{preset.label}</option>
				{/each}
				<option value="custom">Custom</option>
			</select>
		</section>

		<!-- TX parameters -->
		<section class="panel-section">
			<div class="section-label">TX PARAMETERS</div>

			<div class="param-row">
				<span class="param-label">TX Power</span>
				<div class="param-input-group">
					<input
						type="range"
						class="param-slider"
						min={RF_PROFILE_LIMITS.TX_POWER_MIN_DBM}
						max={RF_PROFILE_LIMITS.TX_POWER_MAX_DBM}
						step="1"
						value={activeProfile.txPowerDbm}
						disabled={!isCustom}
						oninput={(e) => {
							const val = Number((e.target as HTMLInputElement).value);
							updateCustomProfile({ txPowerDbm: val });
						}}
					/>
					<span class="param-value">{activeProfile.txPowerDbm} dBm</span>
				</div>
			</div>

			<div class="param-row">
				<span class="param-label">Antenna Gain</span>
				<div class="param-input-group">
					<input
						type="range"
						class="param-slider"
						min={RF_PROFILE_LIMITS.ANTENNA_GAIN_MIN_DBI}
						max={RF_PROFILE_LIMITS.ANTENNA_GAIN_MAX_DBI}
						step="0.5"
						value={activeProfile.antennaGainDbi}
						disabled={!isCustom}
						oninput={(e) => {
							const val = Number((e.target as HTMLInputElement).value);
							updateCustomProfile({ antennaGainDbi: val });
						}}
					/>
					<span class="param-value">{activeProfile.antennaGainDbi} dBi</span>
				</div>
			</div>

			<div class="param-row">
				<span class="param-label">RX Gain</span>
				<div class="param-input-group">
					<input
						type="range"
						class="param-slider"
						min={RF_PROFILE_LIMITS.ANTENNA_GAIN_MIN_DBI}
						max={RF_PROFILE_LIMITS.ANTENNA_GAIN_MAX_DBI}
						step="0.5"
						value={activeProfile.rxAntennaGainDbi}
						disabled={!isCustom}
						oninput={(e) => {
							const val = Number((e.target as HTMLInputElement).value);
							updateCustomProfile({ rxAntennaGainDbi: val });
						}}
					/>
					<span class="param-value">{activeProfile.rxAntennaGainDbi} dBi</span>
				</div>
			</div>

			<div class="param-row">
				<span class="param-label">Sensitivity</span>
				<div class="param-input-group">
					<input
						type="range"
						class="param-slider"
						min={RF_PROFILE_LIMITS.SENSITIVITY_MIN_DBM}
						max={RF_PROFILE_LIMITS.SENSITIVITY_MAX_DBM}
						step="1"
						value={activeProfile.sensitivityDbm}
						disabled={!isCustom}
						oninput={(e) => {
							const val = Number((e.target as HTMLInputElement).value);
							updateCustomProfile({ sensitivityDbm: val });
						}}
					/>
					<span class="param-value">{activeProfile.sensitivityDbm} dBm</span>
				</div>
			</div>

			<div class="param-row">
				<span class="param-label">Height AGL</span>
				<div class="param-input-group">
					<input
						type="range"
						class="param-slider"
						min={RF_PROFILE_LIMITS.HEIGHT_MIN_M}
						max={RF_PROFILE_LIMITS.HEIGHT_MAX_M}
						step="0.5"
						value={activeProfile.heightAglMeters}
						disabled={!isCustom}
						oninput={(e) => {
							const val = Number((e.target as HTMLInputElement).value);
							updateCustomProfile({ heightAglMeters: val });
						}}
					/>
					<span class="param-value">{activeProfile.heightAglMeters} m</span>
				</div>
			</div>
		</section>

		<!-- Frequency source -->
		<section class="panel-section">
			<div class="section-label">FREQUENCY SOURCE</div>
			<div class="freq-source-row">
				<button
					class="freq-btn"
					class:active={$rfRangeStore.frequencySource === 'auto'}
					onclick={() => handleFreqSourceChange('auto')}
				>
					Auto (SDR)
				</button>
				<button
					class="freq-btn"
					class:active={$rfRangeStore.frequencySource === 'manual'}
					onclick={() => handleFreqSourceChange('manual')}
				>
					Manual
				</button>
			</div>

			{#if $rfRangeStore.frequencySource === 'manual'}
				<div class="manual-freq-row">
					<input
						type="number"
						class="freq-input"
						min={RF_PROFILE_LIMITS.FREQUENCY_MIN_MHZ}
						max={RF_PROFILE_LIMITS.FREQUENCY_MAX_MHZ}
						step="1"
						value={$rfRangeStore.manualFrequencyMHz}
						oninput={(e) => {
							const val = Number((e.target as HTMLInputElement).value);
							if (!isNaN(val)) setManualFrequency(val);
						}}
					/>
					<span class="freq-unit">MHz</span>
				</div>
			{:else}
				<div class="auto-freq-display">
					<span class="freq-value">{activeFrequencyMHz} MHz</span>
					<span class="freq-source-label">from HackRF</span>
				</div>
			{/if}
		</section>

		<!-- Computed range readout -->
		<section class="panel-section range-readout">
			<div class="section-label">COMPUTED RANGE</div>
			<div class="range-hero">
				<span class="range-value">{rangeDisplay}</span>
				{#if computedRange.isCapped}
					<span class="range-capped">CAPPED</span>
				{/if}
			</div>
			<div class="model-badge">Free-Space Estimate</div>
		</section>

		<!-- Band legend -->
		<section class="panel-section">
			<div class="section-label">RANGE BANDS</div>
			<div class="band-legend">
				{#each bandRadii as band (band.key)}
					<div class="legend-row">
						<span class="legend-swatch" style="background: {band.color}"></span>
						<span class="legend-label">{band.label}</span>
						<span class="legend-distance">{band.distance}</span>
					</div>
				{/each}
			</div>
		</section>

		<!-- Layer visibility toggle -->
		<section class="panel-section">
			<label class="toggle-row">
				<span class="toggle-label">Show on Map</span>
				<button
					class="toggle-switch"
					class:on={$layerVisibility.rfRange}
					onclick={() => toggleLayerVisibility('rfRange')}
					role="switch"
					aria-checked={$layerVisibility.rfRange}
				>
					<span class="toggle-knob"></span>
				</button>
			</label>
		</section>
	{/if}
</div>

<style>
	@import './map-settings-shared.css';

	.los-view {
		display: flex;
		flex-direction: column;
	}

	.preset-select {
		width: 100%;
		padding: 6px 8px;
		background: var(--background);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--foreground);
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 11px;
		cursor: pointer;
	}

	.preset-select option {
		background: var(--background);
		color: var(--foreground);
	}

	.param-row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.param-label {
		font-size: 10px;
		color: var(--foreground-secondary, #888888);
		font-family: var(--font-mono, 'Fira Code', monospace);
	}

	.param-input-group {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.param-slider {
		flex: 1;
		height: 4px;
		accent-color: var(--primary);
		cursor: pointer;
	}

	.param-slider:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.param-value {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 10px;
		color: var(--foreground);
		min-width: 56px;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.freq-source-row {
		display: flex;
		gap: 4px;
	}

	.freq-btn {
		flex: 1;
		padding: 6px;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--foreground-secondary, #888888);
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 10px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.freq-btn:hover {
		background: var(--surface-hover, #1e1e1e);
	}

	.freq-btn.active {
		background: color-mix(in srgb, var(--primary) 15%, transparent);
		border-color: var(--primary);
		color: var(--foreground);
	}

	.manual-freq-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: 4px;
	}

	.freq-input {
		flex: 1;
		padding: 4px 8px;
		background: var(--background);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--foreground);
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 11px;
	}

	.freq-unit {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 10px;
		color: var(--foreground-secondary, #888888);
	}

	.auto-freq-display {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		margin-top: 4px;
	}

	.freq-value {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 12px;
		color: var(--foreground);
		font-variant-numeric: tabular-nums;
	}

	.freq-source-label {
		font-size: 10px;
		color: var(--foreground-tertiary, #666666);
	}

	.range-readout {
		align-items: center;
	}

	.range-hero {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
	}

	.range-value {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 24px;
		font-weight: 600;
		color: var(--primary);
		font-variant-numeric: tabular-nums;
	}

	.range-capped {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 1px;
		color: var(--status-warning, #d4a054);
		padding: 1px 4px;
		border: 1px solid var(--status-warning, #d4a054);
		border-radius: 2px;
	}

	.model-badge {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 9px;
		letter-spacing: 1px;
		color: var(--foreground-tertiary, #666666);
		margin-top: 2px;
	}

	.band-legend {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.legend-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.legend-swatch {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.legend-label {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 10px;
		color: var(--foreground-secondary, #888888);
		flex: 1;
	}

	.legend-distance {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 10px;
		color: var(--foreground);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
</style>
