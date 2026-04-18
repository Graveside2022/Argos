<script lang="ts">
	import type {
		Preset,
		PresetInput,
		SystemType
	} from '$lib/server/services/trunk-recorder/types';

	interface Props {
		preset?: Preset | null;
		onSave: (input: PresetInput) => Promise<void>;
		onCancel: () => void;
	}

	let { preset, onSave, onCancel }: Props = $props();

	// Convert existing preset to form state. Control channels come in Hz and
	// display as MHz for operator ergonomics. We keep MHz in state, convert to
	// Hz only at submit — avoids floating-point drift on round-trips.
	function hzToMhzString(hz: number): string {
		return (hz / 1e6).toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
	}

	let name = $state(preset?.name ?? '');
	let systemType = $state<SystemType>(preset?.systemType ?? 'p25');
	let systemLabel = $state(preset?.systemLabel ?? '');
	let controlChannelsMhz = $state<string[]>(preset?.controlChannels.map(hzToMhzString) ?? ['']);
	let talkgroupsCsv = $state(preset?.talkgroupsCsv ?? '');
	let centerMhz = $state(preset ? hzToMhzString(preset.sourceConfig.center) : '856');
	let rateHz = $state(String(preset?.sourceConfig.rate ?? 8_000_000));
	let gain = $state(String(preset?.sourceConfig.gain ?? 40));
	let ifGain = $state(String(preset?.sourceConfig.ifGain ?? 32));
	let bbGain = $state(String(preset?.sourceConfig.bbGain ?? 16));

	let advancedOpen = $state(false);
	let submitting = $state(false);
	let errorMessage = $state<string | null>(null);

	function addControlChannel(): void {
		controlChannelsMhz = [...controlChannelsMhz, ''];
	}

	function removeControlChannel(index: number): void {
		controlChannelsMhz = controlChannelsMhz.filter((_, i) => i !== index);
		if (controlChannelsMhz.length === 0) controlChannelsMhz = [''];
	}

	function updateControlChannel(index: number, value: string): void {
		controlChannelsMhz = controlChannelsMhz.map((v, i) => (i === index ? value : v));
	}

	function parseMhzToHz(raw: string): number | null {
		const n = Number.parseFloat(raw);
		if (!Number.isFinite(n) || n <= 0) return null;
		return Math.round(n * 1e6);
	}

	function parseOneControlChannel(mhz: string): number | null | { error: string } {
		if (!mhz.trim()) return null;
		const hz = parseMhzToHz(mhz);
		if (hz === null) return { error: `Invalid control channel MHz: ${mhz}` };
		return hz;
	}

	function tryAddChannel(channels: number[], mhz: string): { error: string } | null {
		const parsed = parseOneControlChannel(mhz);
		if (parsed === null) return null;
		if (typeof parsed !== 'number') return parsed;
		channels.push(parsed);
		return null;
	}

	function parseControlChannels(): number[] | { error: string } {
		const channels: number[] = [];
		for (const mhz of controlChannelsMhz) {
			const err = tryAddChannel(channels, mhz);
			if (err) return err;
		}
		if (channels.length === 0) return { error: 'At least one control channel required' };
		return channels;
	}

	function parseIntegerField(raw: string, label: string): number | { error: string } {
		const n = Number.parseInt(raw, 10);
		if (!Number.isFinite(n)) return { error: `Invalid ${label}` };
		return n;
	}

	type SourceNumbers = {
		center: number;
		rate: number;
		gain: number;
		ifGain: number;
		bbGain: number;
	};

	function parseSourceConfig(): SourceNumbers | { error: string } {
		const center = parseMhzToHz(centerMhz);
		if (center === null) return { error: `Invalid center MHz: ${centerMhz}` };
		const specs: Array<{ raw: string; label: string }> = [
			{ raw: rateHz, label: 'sample rate' },
			{ raw: gain, label: 'gain' },
			{ raw: ifGain, label: 'IF gain' },
			{ raw: bbGain, label: 'BB gain' }
		];
		const parsed: number[] = [];
		for (const s of specs) {
			const v = parseIntegerField(s.raw, s.label);
			if (typeof v !== 'number') return v;
			parsed.push(v);
		}
		if (parsed[0] <= 0) return { error: 'Invalid sample rate' };
		const [rate, gainN, ifGainN, bbGainN] = parsed;
		return { center, rate, gain: gainN, ifGain: ifGainN, bbGain: bbGainN };
	}

	function buildInput(): PresetInput | { error: string } {
		if (!name.trim()) return { error: 'Name required' };
		const channels = parseControlChannels();
		if ('error' in channels) return channels;
		const src = parseSourceConfig();
		if ('error' in src) return src;
		return {
			id: preset?.id,
			name: name.trim(),
			systemType,
			systemLabel: systemLabel.trim(),
			controlChannels: channels,
			talkgroupsCsv,
			sourceConfig: { ...src, driver: 'osmosdr', device: 'hackrf=0', error: 0 }
		};
	}

	async function handleSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		errorMessage = null;
		const result = buildInput();
		if ('error' in result) {
			errorMessage = result.error;
			return;
		}
		submitting = true;
		try {
			await onSave(result);
		} catch (err) {
			errorMessage = `Save failed: ${String(err)}`;
		} finally {
			submitting = false;
		}
	}
</script>

<form class="preset-form" onsubmit={handleSubmit}>
	<h2>{preset ? 'Edit Preset' : 'New Preset'}</h2>

	<label>
		<span>Name</span>
		<input type="text" bind:value={name} required maxlength="80" />
	</label>

	<label>
		<span>System type</span>
		<select bind:value={systemType}>
			<option value="p25">P25 (Phase 1 / Phase 2)</option>
			<option value="smartnet">Motorola SmartNet / SmartZone</option>
		</select>
	</label>

	<label>
		<span>System label (rdio-scanner display)</span>
		<input type="text" bind:value={systemLabel} maxlength="80" placeholder={name} />
	</label>

	<fieldset>
		<legend>Control channels (MHz)</legend>
		{#each controlChannelsMhz as mhz, index (index)}
			<div class="channel-row">
				<input
					type="text"
					value={mhz}
					oninput={(e) =>
						updateControlChannel(index, (e.currentTarget as HTMLInputElement).value)}
					placeholder="851.0125"
					inputmode="decimal"
				/>
				<button
					type="button"
					class="btn-ghost"
					onclick={() => removeControlChannel(index)}
					disabled={controlChannelsMhz.length === 1}
				>
					&minus;
				</button>
			</div>
		{/each}
		<button type="button" class="btn-ghost" onclick={addControlChannel}>+ add channel</button>
	</fieldset>

	<label>
		<span>Talkgroups CSV</span>
		<textarea
			bind:value={talkgroupsCsv}
			rows="6"
			placeholder="Decimal,Mode,Description,Alpha Tag,Tag,Category,Priority"
			spellcheck="false"
		></textarea>
	</label>

	<details bind:open={advancedOpen}>
		<summary>Advanced — SDR source</summary>
		<div class="advanced-grid">
			<label>
				<span>Center (MHz)</span>
				<input type="text" bind:value={centerMhz} inputmode="decimal" />
			</label>
			<label>
				<span>Sample rate (Hz)</span>
				<input type="text" bind:value={rateHz} inputmode="numeric" />
			</label>
			<label>
				<span>RF gain</span>
				<input type="text" bind:value={gain} inputmode="numeric" />
			</label>
			<label>
				<span>IF gain</span>
				<input type="text" bind:value={ifGain} inputmode="numeric" />
			</label>
			<label>
				<span>BB gain</span>
				<input type="text" bind:value={bbGain} inputmode="numeric" />
			</label>
			<label>
				<span>SDR device</span>
				<input type="text" value="hackrf=0" readonly />
			</label>
		</div>
	</details>

	{#if errorMessage}
		<div class="error" role="alert">{errorMessage}</div>
	{/if}

	<div class="actions">
		<button type="button" class="btn btn-cancel" onclick={onCancel} disabled={submitting}>
			Cancel
		</button>
		<button type="submit" class="btn btn-save" disabled={submitting}>
			{submitting ? 'Saving…' : 'Save'}
		</button>
	</div>
</form>

<style>
	.preset-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--card);
		color: var(--foreground);
		border: 1px solid var(--border);
		max-width: 640px;
		font-family: 'Fira Code', monospace;
		font-size: 11px;
	}
	.preset-form h2 {
		margin: 0;
		font-size: 13px;
		letter-spacing: 1.2px;
		text-transform: uppercase;
	}
	.preset-form label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.preset-form label > span {
		font-size: 10px;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--muted-foreground, #9ca3af);
	}
	.preset-form input[type='text'],
	.preset-form select,
	.preset-form textarea {
		background: var(--background);
		color: var(--foreground);
		border: 1px solid var(--border);
		padding: 0.4rem 0.5rem;
		font-family: inherit;
		font-size: 11px;
	}
	.preset-form textarea {
		resize: vertical;
	}
	.preset-form input[readonly] {
		opacity: 0.6;
	}
	fieldset {
		border: 1px solid var(--border);
		padding: 0.5rem;
	}
	fieldset legend {
		font-size: 10px;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--muted-foreground, #9ca3af);
		padding: 0 0.25rem;
	}
	.channel-row {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 0.25rem;
	}
	.channel-row input {
		flex: 1;
	}
	details > summary {
		cursor: pointer;
		font-size: 10px;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--muted-foreground, #9ca3af);
		padding: 0.25rem 0;
	}
	.advanced-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
		padding-top: 0.5rem;
	}
	.error {
		padding: 0.4rem 0.5rem;
		background: rgba(196, 91, 74, 0.15);
		color: #ff5c33;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}
	.btn {
		padding: 0.35rem 1rem;
		font-family: inherit;
		font-size: 11px;
		letter-spacing: 1px;
		text-transform: uppercase;
		border: 1px solid var(--border);
		background: var(--card);
		color: var(--foreground);
		cursor: pointer;
	}
	.btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.btn-save {
		border-color: #8bbfa0;
		color: #8bbfa0;
	}
	.btn-ghost {
		background: transparent;
		border: 1px dashed var(--border);
		color: var(--muted-foreground, #9ca3af);
		padding: 0.25rem 0.75rem;
		font-family: inherit;
		font-size: 11px;
		cursor: pointer;
	}
	.btn-ghost:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
