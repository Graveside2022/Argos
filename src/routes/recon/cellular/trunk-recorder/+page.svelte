<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';

	import { invalidateAll } from '$app/navigation';
	import type {
		Preset,
		PresetInput,
		TrunkRecorderStatus
	} from '$lib/server/services/trunk-recorder/types';

	import type { PageData } from './$types';
	import PresetForm from './PresetForm.svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let presets = $state<Preset[]>(data.presets);
	let status = $state<TrunkRecorderStatus>(data.status);
	let selectedPresetId = $state<string | null>(data.presets[0]?.id ?? null);
	let errorMessage = $state<string | null>(null);
	let isBusy = $state(false);
	let pollHandle: ReturnType<typeof setInterval> | null = null;

	let formMode = $state<'closed' | 'new' | 'edit'>('closed');

	// Keep local state in sync with fresh page data (after invalidateAll()).
	// Read only `data.*` in tracking scope; reads/writes of local state go
	// through `untrack` so the effect doesn't re-trigger itself.
	$effect(() => {
		const nextPresets = data.presets;
		const nextStatus = data.status;
		untrack(() => {
			presets = nextPresets;
			status = nextStatus;
			if (selectedPresetId && !nextPresets.find((p) => p.id === selectedPresetId)) {
				selectedPresetId = nextPresets[0]?.id ?? null;
			}
		});
	});

	const selectedPreset = $derived(presets.find((p) => p.id === selectedPresetId) ?? null);
	const canStart = $derived(!status.running && !isBusy && !!selectedPresetId);
	const canStop = $derived(status.running && !isBusy);
	const canEdit = $derived(!status.running && !!selectedPreset);
	const canDelete = $derived(!status.running && !!selectedPreset);

	async function callControl(
		action: 'start' | 'stop' | 'restart',
		presetId?: string
	): Promise<void> {
		isBusy = true;
		errorMessage = null;
		try {
			const res = await fetch('/api/trunk-recorder/control', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action, presetId })
			});
			const body = await res.json();
			if (!res.ok || body.success === false) {
				errorMessage = body.message ?? `Control ${action} failed (HTTP ${res.status})`;
			}
		} catch (err) {
			errorMessage = `Network error: ${String(err)}`;
		} finally {
			isBusy = false;
			await refreshStatus();
		}
	}

	async function refreshStatus(): Promise<void> {
		try {
			const res = await fetch('/api/trunk-recorder/status');
			if (!res.ok) return;
			const body = (await res.json()) as TrunkRecorderStatus & { success: boolean };
			status = body;
		} catch {
			/* transient — keep last status */
		}
	}

	async function handleStart(): Promise<void> {
		if (!selectedPresetId) {
			errorMessage = 'Select a preset before starting';
			return;
		}
		await callControl('start', selectedPresetId);
	}

	async function handleStop(): Promise<void> {
		await callControl('stop');
	}

	function buildSavePresetUrl(editingId: string | null): { url: string; method: 'POST' | 'PUT' } {
		return editingId
			? {
					url: `/api/trunk-recorder/config?id=${encodeURIComponent(editingId)}`,
					method: 'PUT'
				}
			: { url: '/api/trunk-recorder/config', method: 'POST' };
	}

	async function sendPresetPayload(
		url: string,
		method: 'POST' | 'PUT',
		input: PresetInput
	): Promise<{ preset?: { id?: string } }> {
		const res = await fetch(url, {
			method,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(input)
		});
		const body = await res.json();
		if (!res.ok || body.success === false)
			throw new Error(body.message ?? `HTTP ${res.status}`);
		return body;
	}

	async function handleSavePreset(input: PresetInput): Promise<void> {
		errorMessage = null;
		const editingId = formMode === 'edit' ? selectedPresetId : null;
		const { url, method } = buildSavePresetUrl(editingId);
		const body = await sendPresetPayload(url, method, input);
		formMode = 'closed';
		if (body.preset?.id) selectedPresetId = body.preset.id;
		await invalidateAll();
	}

	async function handleDelete(): Promise<void> {
		if (!selectedPresetId) return;
		if (!confirm(`Delete preset "${selectedPreset?.name}"?`)) return;
		const res = await fetch(
			`/api/trunk-recorder/config?id=${encodeURIComponent(selectedPresetId)}`,
			{
				method: 'DELETE'
			}
		);
		if (!res.ok) {
			errorMessage = `Delete failed (HTTP ${res.status})`;
			return;
		}
		selectedPresetId = null;
		await invalidateAll();
	}

	onMount(() => {
		pollHandle = setInterval(refreshStatus, 5000);
	});

	onDestroy(() => {
		if (pollHandle) clearInterval(pollHandle);
	});

	function formatOwner(owner: string | null): string {
		if (!owner) return 'free';
		return owner;
	}
</script>

<div class="page">
	<header class="control-strip">
		<div class="preset-select">
			<label for="preset">Preset</label>
			<select id="preset" bind:value={selectedPresetId} disabled={status.running}>
				{#if presets.length === 0}
					<option value={null}>No presets yet — click + New</option>
				{:else}
					{#each presets as preset (preset.id)}
						<option value={preset.id}>
							{preset.name} — {preset.systemType.toUpperCase()}
						</option>
					{/each}
				{/if}
			</select>
			<button
				type="button"
				class="btn-ghost"
				onclick={() => (formMode = 'new')}
				disabled={status.running}
			>
				+ New
			</button>
			<button
				type="button"
				class="btn-ghost"
				onclick={() => (formMode = 'edit')}
				disabled={!canEdit}
			>
				Edit
			</button>
			<button
				type="button"
				class="btn-ghost danger"
				onclick={handleDelete}
				disabled={!canDelete}
			>
				Delete
			</button>
		</div>

		<div class="status">
			<span class="status-dot" class:on={status.running}></span>
			<span class="status-text">
				{status.running ? 'RUNNING' : 'STOPPED'}
			</span>
			<span class="status-meta">HackRF: {formatOwner(status.owner)}</span>
			<span class="status-meta">
				rdio-scanner: {status.rdioScannerRunning ? 'up' : 'down'}
			</span>
		</div>

		<div class="actions">
			<button type="button" class="btn btn-start" disabled={!canStart} onclick={handleStart}>
				Start
			</button>
			<button type="button" class="btn btn-stop" disabled={!canStop} onclick={handleStop}>
				Stop
			</button>
		</div>
	</header>

	{#if errorMessage}
		<div class="error" role="alert">{errorMessage}</div>
	{/if}

	{#if formMode !== 'closed'}
		<div class="form-drawer">
			<PresetForm
				preset={formMode === 'edit' ? selectedPreset : null}
				onSave={handleSavePreset}
				onCancel={() => (formMode = 'closed')}
			/>
		</div>
	{/if}

	{#if selectedPreset && !status.running && formMode === 'closed'}
		<div class="preset-summary">
			<h3>{selectedPreset.name}</h3>
			<dl>
				<dt>System</dt>
				<dd>{selectedPreset.systemType.toUpperCase()} {selectedPreset.systemLabel}</dd>
				<dt>Control channels</dt>
				<dd>
					{selectedPreset.controlChannels.map((hz) => (hz / 1e6).toFixed(4)).join(', ')} MHz
				</dd>
				<dt>SDR</dt>
				<dd>{selectedPreset.sourceConfig.device}</dd>
			</dl>
		</div>
	{/if}

	<div class="iframe-wrap" class:active={status.rdioScannerRunning}>
		{#if status.rdioScannerRunning}
			<iframe src="/rdio/" title="rdio-scanner" class="rdio-frame"></iframe>
		{:else}
			<div class="iframe-placeholder">
				<p>rdio-scanner is not running.</p>
				<p>Starting trunk-recorder will bring rdio-scanner up automatically.</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		background: var(--background);
		color: var(--foreground);
	}
	.control-strip {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border);
		background: var(--card);
		flex-wrap: wrap;
	}
	.preset-select {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.preset-select label {
		font-family: 'Fira Code', monospace;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 1.2px;
	}
	.preset-select select {
		background: var(--background);
		color: var(--foreground);
		border: 1px solid var(--border);
		padding: 0.25rem 0.5rem;
		font-family: 'Fira Code', monospace;
		font-size: 11px;
		min-width: 280px;
	}
	.btn-ghost {
		background: transparent;
		border: 1px dashed var(--border);
		color: var(--muted-foreground, #9ca3af);
		padding: 0.25rem 0.75rem;
		font-family: 'Fira Code', monospace;
		font-size: 11px;
		cursor: pointer;
	}
	.btn-ghost:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.btn-ghost.danger:not(:disabled) {
		border-color: #c45b4a;
		color: #c45b4a;
	}
	.status {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-family: 'Fira Code', monospace;
		font-size: 11px;
	}
	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--muted-foreground, #555);
	}
	.status-dot.on {
		background: #8bbfa0;
	}
	.status-text {
		font-weight: 600;
		letter-spacing: 1.2px;
	}
	.status-meta {
		color: var(--muted-foreground, #9ca3af);
		font-size: 10px;
	}
	.actions {
		margin-left: auto;
		display: flex;
		gap: 0.5rem;
	}
	.btn {
		padding: 0.35rem 1rem;
		font-family: 'Fira Code', monospace;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 1px;
		border: 1px solid var(--border);
		background: var(--card);
		color: var(--foreground);
		cursor: pointer;
	}
	.btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.btn-start:not(:disabled) {
		border-color: #8bbfa0;
		color: #8bbfa0;
	}
	.btn-stop:not(:disabled) {
		border-color: #d4a054;
		color: #d4a054;
	}
	.error {
		padding: 0.5rem 1rem;
		background: rgba(196, 91, 74, 0.15);
		color: #ff5c33;
		font-family: 'Fira Code', monospace;
		font-size: 11px;
	}
	.form-drawer {
		padding: 1rem;
		border-bottom: 1px solid var(--border);
	}
	.preset-summary {
		padding: 1rem;
		border-bottom: 1px solid var(--border);
	}
	.preset-summary h3 {
		font-family: 'Fira Code', monospace;
		font-size: 12px;
		margin: 0 0 0.5rem 0;
	}
	.preset-summary dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem 1rem;
		font-family: 'Fira Code', monospace;
		font-size: 10px;
		margin: 0;
	}
	.preset-summary dt {
		text-transform: uppercase;
		letter-spacing: 1.2px;
		color: var(--muted-foreground, #9ca3af);
	}
	.preset-summary dd {
		margin: 0;
	}
	.iframe-wrap {
		flex: 1;
		min-height: 0;
		position: relative;
	}
	.rdio-frame {
		width: 100%;
		height: 100%;
		border: 0;
		background: #000;
	}
	.iframe-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 0.5rem;
		font-family: 'Fira Code', monospace;
		font-size: 11px;
		color: var(--muted-foreground, #9ca3af);
	}
</style>
