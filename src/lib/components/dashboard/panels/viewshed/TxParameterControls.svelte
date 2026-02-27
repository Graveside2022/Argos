<script lang="ts">
	import { rfRangeStore, updateCustomProfile } from '$lib/stores/dashboard/rf-range-store';
	import { getPresetById, RF_PROFILE_LIMITS } from '$lib/types/rf-range';

	// Active profile: preset values (read-only) or custom (editable)
	let isCustom = $derived($rfRangeStore.activePresetId === 'custom');
	let profile = $derived(
		isCustom
			? $rfRangeStore.customProfile
			: (getPresetById($rfRangeStore.activePresetId) ?? $rfRangeStore.customProfile)
	);

	function handleSlider(field: string, e: Event): void {
		const val = Number((e.target as HTMLInputElement).value);
		if (!isNaN(val)) updateCustomProfile({ [field]: val });
	}
</script>

<section class="panel-section">
	<div class="section-label">
		TX PARAMETERS {#if !isCustom}<span class="preset-lock">PRESET</span>{/if}
	</div>

	<div class="tx-param">
		<div class="param-header">
			<span class="param-name">TX Power</span>
			<span class="param-readout">{profile.txPowerDbm} dBm</span>
		</div>
		<input
			type="range"
			class="tx-slider"
			min={RF_PROFILE_LIMITS.TX_POWER_MIN_DBM}
			max={RF_PROFILE_LIMITS.TX_POWER_MAX_DBM}
			step="1"
			value={profile.txPowerDbm}
			oninput={(e) => handleSlider('txPowerDbm', e)}
			disabled={!isCustom}
		/>
	</div>

	<div class="tx-param">
		<div class="param-header">
			<span class="param-name">TX Antenna Gain</span>
			<span class="param-readout">{profile.antennaGainDbi} dBi</span>
		</div>
		<input
			type="range"
			class="tx-slider"
			min={RF_PROFILE_LIMITS.ANTENNA_GAIN_MIN_DBI}
			max={RF_PROFILE_LIMITS.ANTENNA_GAIN_MAX_DBI}
			step="1"
			value={profile.antennaGainDbi}
			oninput={(e) => handleSlider('antennaGainDbi', e)}
			disabled={!isCustom}
		/>
	</div>

	<div class="tx-param">
		<div class="param-header">
			<span class="param-name">RX Antenna Gain</span>
			<span class="param-readout">{profile.rxAntennaGainDbi} dBi</span>
		</div>
		<input
			type="range"
			class="tx-slider"
			min={RF_PROFILE_LIMITS.ANTENNA_GAIN_MIN_DBI}
			max={RF_PROFILE_LIMITS.ANTENNA_GAIN_MAX_DBI}
			step="1"
			value={profile.rxAntennaGainDbi}
			oninput={(e) => handleSlider('rxAntennaGainDbi', e)}
			disabled={!isCustom}
		/>
	</div>

	<div class="tx-param">
		<div class="param-header">
			<span class="param-name">RX Sensitivity</span>
			<span class="param-readout">{profile.sensitivityDbm} dBm</span>
		</div>
		<input
			type="range"
			class="tx-slider"
			min={RF_PROFILE_LIMITS.SENSITIVITY_MIN_DBM}
			max={RF_PROFILE_LIMITS.SENSITIVITY_MAX_DBM}
			step="1"
			value={profile.sensitivityDbm}
			oninput={(e) => handleSlider('sensitivityDbm', e)}
			disabled={!isCustom}
		/>
	</div>

	<div class="tx-param">
		<div class="param-header">
			<span class="param-name">Antenna Height AGL</span>
			<span class="param-readout">{profile.heightAglMeters.toFixed(1)} m</span>
		</div>
		<input
			type="range"
			class="tx-slider"
			min={RF_PROFILE_LIMITS.HEIGHT_MIN_M}
			max={RF_PROFILE_LIMITS.HEIGHT_MAX_M}
			step="0.5"
			value={profile.heightAglMeters}
			oninput={(e) => handleSlider('heightAglMeters', e)}
			disabled={!isCustom}
		/>
	</div>
</section>

<style>
	@import '../map-settings-shared.css';

	.tx-param {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.param-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.param-name {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 10px;
		color: var(--foreground-secondary);
	}
	.param-readout {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 11px;
		color: var(--foreground);
		font-variant-numeric: tabular-nums;
	}
	.tx-slider {
		width: 100%;
		height: 4px;
		accent-color: var(--primary);
		cursor: pointer;
	}
	.tx-slider:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.preset-lock {
		font-size: 8px;
		font-weight: 600;
		letter-spacing: 1px;
		color: var(--text-secondary);
		padding: 1px 4px;
		border: 1px solid var(--border);
		border-radius: 2px;
		margin-left: 6px;
	}
</style>
