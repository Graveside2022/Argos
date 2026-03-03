<!-- RF Propagation parameter controls — compact form for CloudRF computation settings -->
<script lang="ts">
	import { rfParams, updateRFParam } from '$lib/stores/dashboard/rf-propagation-store';

	function handleNumber(
		key: 'frequency' | 'txHeight' | 'rxHeight' | 'radius' | 'resolution',
		e: Event
	) {
		const val = parseFloat((e.target as HTMLInputElement).value);
		if (!Number.isNaN(val)) updateRFParam(key, val);
	}

	function handlePolarization(e: Event) {
		updateRFParam('polarization', parseInt((e.target as HTMLSelectElement).value, 10));
	}
</script>

<section class="rf-controls">
	<h3 class="section-label">RF PARAMETERS</h3>

	<div class="field-grid">
		<label class="field">
			<span class="field-label">FREQUENCY</span>
			<div class="input-row">
				<input
					type="number"
					class="field-input"
					min="1"
					max="100000"
					step="1"
					value={$rfParams.frequency}
					onchange={(e) => handleNumber('frequency', e)}
				/>
				<span class="unit">MHz</span>
			</div>
		</label>

		<label class="field">
			<span class="field-label">POLARIZATION</span>
			<select
				class="field-input field-select"
				value={$rfParams.polarization}
				onchange={handlePolarization}
			>
				<option value={0}>Horizontal</option>
				<option value={1}>Vertical</option>
			</select>
		</label>
	</div>

	<div class="field-grid">
		<label class="field">
			<span class="field-label">TX HEIGHT</span>
			<div class="input-row">
				<input
					type="number"
					class="field-input"
					min="0.5"
					max="500"
					step="0.5"
					value={$rfParams.txHeight}
					onchange={(e) => handleNumber('txHeight', e)}
				/>
				<span class="unit">m</span>
			</div>
		</label>

		<label class="field">
			<span class="field-label">RX HEIGHT</span>
			<div class="input-row">
				<input
					type="number"
					class="field-input"
					min="0.5"
					max="500"
					step="0.5"
					value={$rfParams.rxHeight}
					onchange={(e) => handleNumber('rxHeight', e)}
				/>
				<span class="unit">m</span>
			</div>
		</label>
	</div>

	<div class="field-grid">
		<label class="field">
			<span class="field-label">RADIUS</span>
			<div class="input-row">
				<input
					type="number"
					class="field-input"
					min="0.1"
					max="100"
					step="0.5"
					value={$rfParams.radius}
					onchange={(e) => handleNumber('radius', e)}
				/>
				<span class="unit">km</span>
			</div>
		</label>

		<label class="field">
			<span class="field-label">RESOLUTION</span>
			<div class="input-row">
				<input
					type="number"
					class="field-input"
					min="5"
					max="300"
					step="5"
					value={$rfParams.resolution}
					onchange={(e) => handleNumber('resolution', e)}
				/>
				<span class="unit">m/px</span>
			</div>
		</label>
	</div>
</section>

<style>
	.rf-controls {
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.section-label {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--foreground-secondary, #888888);
		margin: 0;
	}

	.field-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.field-label {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 9px;
		font-weight: 500;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--foreground-secondary, #888888);
	}

	.input-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.field-input {
		flex: 1;
		background: var(--surface-elevated, #151515);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 4px 8px;
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 11px;
		color: var(--foreground);
		min-width: 0;
	}

	.field-input:focus {
		outline: none;
		border-color: var(--primary);
	}

	.field-select {
		appearance: none;
		cursor: pointer;
		padding-right: 20px;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 6px center;
	}

	.field-select option {
		background: var(--card, #1a1a1a);
		color: var(--foreground);
	}

	.unit {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 10px;
		color: var(--foreground-secondary, #888888);
		flex-shrink: 0;
		min-width: 24px;
	}

	/* Hide number input spinners */
	.field-input[type='number']::-webkit-inner-spin-button,
	.field-input[type='number']::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.field-input[type='number'] {
		-moz-appearance: textfield;
	}
</style>
