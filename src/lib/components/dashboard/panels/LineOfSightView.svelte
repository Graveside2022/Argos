<script lang="ts">
	import { layerVisibility, toggleLayerVisibility } from '$lib/stores/dashboard/dashboard-store';
	import {
		rfRangeStore,
		setActivePreset,
		setFrequencySource,
		setManualFrequency
	} from '$lib/stores/dashboard/rf-range-store';
	import { setViewshedEnabled, viewshedStore } from '$lib/stores/dashboard/viewshed-store';
	import { hackrfStore } from '$lib/stores/tactical-map/hackrf-store';
	import { getPresetById, RF_PROFILE_LIMITS, RF_RANGE_PRESETS } from '$lib/types/rf-range';
	import { calculateFriisRange, clampDisplayRange } from '$lib/utils/rf-propagation';

	import DTEDStatus from './viewshed/DTEDStatus.svelte';
	import OpacityControls from './viewshed/OpacityControls.svelte';
	import ViewshedControls from './viewshed/ViewshedControls.svelte';

	// Derived: active RF profile for range readout
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

	let computedRange = $derived.by(() => {
		const freqHz = activeFrequencyMHz * 1e6;
		return clampDisplayRange(
			calculateFriisRange(
				freqHz,
				activeProfile.txPowerDbm,
				activeProfile.antennaGainDbi,
				activeProfile.rxAntennaGainDbi,
				activeProfile.sensitivityDbm
			)
		);
	});

	let rangeDisplay = $derived(
		computedRange.displayRange >= 1000
			? `${(computedRange.displayRange / 1000).toFixed(1)} km`
			: `${Math.round(computedRange.displayRange)} m`
	);

	// RF cap: effective viewshed radius is min(user radius, Friis range)
	let rfRangeM = $derived(
		calculateFriisRange(
			activeFrequencyMHz * 1e6,
			activeProfile.txPowerDbm,
			activeProfile.antennaGainDbi,
			activeProfile.rxAntennaGainDbi,
			activeProfile.sensitivityDbm
		)
	);
	let isRfCapped = $derived($viewshedStore.radiusM > rfRangeM);
	let effectiveRadiusM = $derived(Math.min($viewshedStore.radiusM, rfRangeM));

	function handlePresetChange(e: Event) {
		setActivePreset((e.target as HTMLSelectElement).value);
	}
</script>

<div class="los-view">
	<!-- Enable toggle -->
	<section class="panel-section">
		<label class="toggle-row">
			<span class="toggle-label">Enable Line of Sight</span>
			<button
				class="toggle-switch"
				class:on={$viewshedStore.isEnabled}
				onclick={() => setViewshedEnabled(!$viewshedStore.isEnabled)}
				role="switch"
				aria-checked={$viewshedStore.isEnabled}
			>
				<span class="toggle-knob"></span>
			</button>
		</label>
	</section>

	{#if $viewshedStore.isEnabled}
		<DTEDStatus />

		<ViewshedControls {isRfCapped} {effectiveRadiusM} />

		<!-- Hardware preset -->
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

		<!-- Frequency source -->
		<section class="panel-section">
			<div class="section-label">FREQUENCY SOURCE</div>
			<div class="freq-source-row">
				<button
					class="freq-btn"
					class:active={$rfRangeStore.frequencySource === 'auto'}
					onclick={() => setFrequencySource('auto')}
				>
					Auto (SDR)
				</button>
				<button
					class="freq-btn"
					class:active={$rfRangeStore.frequencySource === 'manual'}
					onclick={() => setFrequencySource('manual')}
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

		<!-- RF range readout -->
		<section class="panel-section range-readout">
			<div class="section-label">COMPUTED RANGE</div>
			<div class="range-hero">
				<span class="range-value">{rangeDisplay}</span>
				{#if computedRange.isCapped}
					<span class="range-capped">CAPPED</span>
				{/if}
			</div>
			<div class="model-badge">Terrain-Aware Viewshed</div>
		</section>

		<OpacityControls />

		<!-- Show on Map toggle -->
		<section class="panel-section">
			<label class="toggle-row">
				<span class="toggle-label">Show on Map</span>
				<button
					class="toggle-switch"
					class:on={$layerVisibility.viewshed}
					onclick={() => toggleLayerVisibility('viewshed')}
					role="switch"
					aria-checked={$layerVisibility.viewshed}
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
</style>
