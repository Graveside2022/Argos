<script lang="ts">
	import {
		Eye,
		FileText,
		Maximize2,
		Minimize2,
		Plus,
		Presentation,
		RefreshCw,
		Trash2,
		X
	} from '@lucide/svelte';

	import { persistedWritable } from '$lib/stores/persisted-writable';

	const reportsPreviewHeight = persistedWritable<number>('reportsPreviewHeight', 360, {});
	const MIN_PREVIEW = 180;
	const MAX_PREVIEW_PCT = 0.85;

	interface ReportRow {
		id: string;
		mission_id: string;
		type: 'sitrep' | 'emcon-survey';
		title: string;
		generated_at: number;
		capture_ids: string;
		flagged_hostile: number;
		flagged_suspect: number;
		emitter_count: number;
		source_qmd_path: string;
		html_path: string;
		pdf_path: string | null;
		slides_html_path: string | null;
		slides_pdf_path: string | null;
	}

	type FilterType = 'all' | 'sitrep' | 'emcon-survey';

	let reports = $state<ReportRow[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let selectedReportId = $state<string | null>(null);
	let fullScreen = $state(false);
	let filterType = $state<FilterType>('all');
	let searchQuery = $state('');
	let previewHeight = $state(360);
	let isResizing = $state(false);
	let dragStartY = 0;
	let dragStartHeight = 0;

	$effect(() => {
		const unsub = reportsPreviewHeight.subscribe((v) => {
			const max = typeof window !== 'undefined' ? window.innerHeight * MAX_PREVIEW_PCT : v;
			previewHeight = Math.max(MIN_PREVIEW, Math.min(max, v));
		});
		return unsub;
	});

	function onResizeDown(e: MouseEvent): void {
		e.preventDefault();
		isResizing = true;
		dragStartY = e.clientY;
		dragStartHeight = previewHeight;
		document.body.style.cursor = 'ns-resize';
		document.body.style.userSelect = 'none';
	}

	function onResizeMove(e: MouseEvent): void {
		if (!isResizing) return;
		const delta = dragStartY - e.clientY;
		const max = window.innerHeight * MAX_PREVIEW_PCT;
		const next = Math.max(MIN_PREVIEW, Math.min(max, dragStartHeight + delta));
		previewHeight = next;
		reportsPreviewHeight.set(next);
	}

	function onResizeUp(): void {
		if (!isResizing) return;
		isResizing = false;
		document.body.style.cursor = '';
		document.body.style.userSelect = '';
	}

	function onResizeKeydown(e: KeyboardEvent): void {
		const step = e.shiftKey ? 50 : 10;
		const max = window.innerHeight * MAX_PREVIEW_PCT;
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			previewHeight = Math.min(max, previewHeight + step);
			reportsPreviewHeight.set(previewHeight);
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			previewHeight = Math.max(MIN_PREVIEW, previewHeight - step);
			reportsPreviewHeight.set(previewHeight);
		}
	}

	$effect(() => {
		if (typeof window === 'undefined') return;
		window.addEventListener('mousemove', onResizeMove);
		window.addEventListener('mouseup', onResizeUp);
		return () => {
			window.removeEventListener('mousemove', onResizeMove);
			window.removeEventListener('mouseup', onResizeUp);
		};
	});

	// New Mission modal state
	let showNewMissionModal = $state(false);
	let missionName = $state('');
	let missionType = $state<'sitrep-loop' | 'emcon-survey'>('sitrep-loop');
	let missionUnit = $state('');
	let missionAoMgrs = $state('');
	let missionSetActive = $state(true);
	let missionSubmitting = $state(false);
	let missionError = $state<string | null>(null);
	let missionSuccess = $state<string | null>(null);

	const filteredReports = $derived(
		reports
			.filter((r) => filterType === 'all' || r.type === filterType)
			.filter(
				(r) => !searchQuery || r.title.toLowerCase().includes(searchQuery.toLowerCase())
			)
	);

	function toMessage(e: unknown): string {
		return e instanceof Error ? e.message : String(e);
	}

	async function loadReportsFromApi(): Promise<ReportRow[]> {
		const res = await fetch('/api/reports/list');
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const data = (await res.json()) as {
			success: boolean;
			reports?: ReportRow[];
			error?: string;
		};
		if (!data.success) throw new Error(data.error ?? 'Unknown error');
		return data.reports ?? [];
	}

	async function fetchReports(): Promise<void> {
		try {
			reports = await loadReportsFromApi();
			error = null;
		} catch (e) {
			error = toMessage(e);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		void fetchReports();
		const interval = setInterval(() => {
			void fetchReports();
		}, 30_000);
		return () => clearInterval(interval);
	});

	/**
	 * Format epoch millis as DTG (Date-Time Group): DDHHMMZMONYY
	 * e.g. 121430ZAPR26
	 */
	function formatDTG(epochMs: number): string {
		const d = new Date(epochMs);
		const dd = String(d.getUTCDate()).padStart(2, '0');
		const hh = String(d.getUTCHours()).padStart(2, '0');
		const mm = String(d.getUTCMinutes()).padStart(2, '0');
		const months = [
			'JAN',
			'FEB',
			'MAR',
			'APR',
			'MAY',
			'JUN',
			'JUL',
			'AUG',
			'SEP',
			'OCT',
			'NOV',
			'DEC'
		];
		const mon = months[d.getUTCMonth()];
		const yy = String(d.getUTCFullYear()).slice(-2);
		return `${dd}${hh}${mm}Z${mon}${yy}`;
	}

	function typeLabel(t: ReportRow['type']): string {
		return t === 'sitrep' ? 'SITREP' : 'EMCON SRV';
	}

	function viewReport(id: string): void {
		selectedReportId = id;
	}

	function openExternal(id: string, format: 'pdf' | 'revealjs' | 'slides-pdf'): void {
		window.open(`/api/reports/${id}/view?format=${format}`, '_blank', 'noopener');
	}

	async function requestDelete(id: string): Promise<void> {
		const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		if (selectedReportId === id) selectedReportId = null;
		await fetchReports();
	}

	async function deleteReport(id: string): Promise<void> {
		if (!confirm('Delete this report? This cannot be undone.')) return;
		try {
			await requestDelete(id);
		} catch (e) {
			error = toMessage(e);
		}
	}

	function closePreview(): void {
		selectedReportId = null;
		fullScreen = false;
	}

	function toggleFullScreen(): void {
		fullScreen = !fullScreen;
	}

	function openNewMissionModal(): void {
		showNewMissionModal = true;
		missionError = null;
		missionSuccess = null;
	}

	function closeNewMissionModal(): void {
		showNewMissionModal = false;
		missionName = '';
		missionType = 'sitrep-loop';
		missionUnit = '';
		missionAoMgrs = '';
		missionSetActive = true;
		missionError = null;
	}

	async function postMission(): Promise<void> {
		const res = await fetch('/api/missions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: missionName.trim(),
				type: missionType,
				unit: missionUnit.trim() || undefined,
				ao_mgrs: missionAoMgrs.trim() || undefined,
				set_active: missionSetActive
			})
		});
		if (!res.ok) {
			const body = (await res.json().catch(() => ({}))) as { error?: string };
			throw new Error(body.error ?? `HTTP ${res.status}`);
		}
	}

	async function submitNewMission(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		if (!missionName.trim()) {
			missionError = 'Mission name is required';
			return;
		}
		missionSubmitting = true;
		missionError = null;
		try {
			await postMission();
			missionSuccess = `Mission "${missionName.trim()}" created`;
			setTimeout(() => {
				closeNewMissionModal();
				missionSuccess = null;
			}, 1200);
		} catch (err) {
			missionError = toMessage(err);
		} finally {
			missionSubmitting = false;
		}
	}
</script>

<section class="reports-view" class:fullscreen={fullScreen} aria-label="Reports">
	<!-- Toolbar -->
	<header class="toolbar">
		<h2 class="section-label">REPORTS</h2>
		<button
			class="btn btn-primary"
			type="button"
			onclick={openNewMissionModal}
			aria-label="New Mission"
		>
			<Plus size={12} />
			<span>NEW MISSION</span>
		</button>

		<div class="toolbar-group">
			<label class="field-label" for="filter-type">FILTER</label>
			<select
				id="filter-type"
				class="select"
				bind:value={filterType}
				aria-label="Filter by type"
			>
				<option value="all">ALL</option>
				<option value="sitrep">SITREP</option>
				<option value="emcon-survey">EMCON SURVEY</option>
			</select>
		</div>

		<div class="toolbar-group">
			<label class="field-label" for="search-query">SEARCH</label>
			<input
				id="search-query"
				class="input"
				type="text"
				bind:value={searchQuery}
				placeholder="TITLE..."
				aria-label="Search reports"
			/>
		</div>

		<div class="toolbar-spacer"></div>

		<button
			class="btn"
			type="button"
			onclick={() => void fetchReports()}
			aria-label="Refresh"
			title="Refresh"
		>
			<RefreshCw size={12} />
		</button>

		{#if selectedReportId}
			<button
				class="btn"
				type="button"
				onclick={toggleFullScreen}
				aria-label={fullScreen ? 'Exit full screen' : 'Full screen'}
				title={fullScreen ? 'Exit full screen' : 'Full screen'}
			>
				{#if fullScreen}
					<Minimize2 size={12} />
				{:else}
					<Maximize2 size={12} />
				{/if}
			</button>
		{/if}
	</header>

	<!-- Grid -->
	<div class="grid-wrap" class:collapsed={fullScreen && selectedReportId}>
		{#if loading}
			<div class="grid-skeleton" aria-busy="true" aria-label="Loading reports">
				<div class="skeleton-row"></div>
				<div class="skeleton-row"></div>
				<div class="skeleton-row"></div>
			</div>
		{:else if error}
			<div class="state-card error-card" role="alert">
				<p class="state-title">ERROR LOADING REPORTS</p>
				<p class="state-detail">{error}</p>
				<button class="btn" type="button" onclick={() => void fetchReports()}>
					<RefreshCw size={12} />
					<span>RETRY</span>
				</button>
			</div>
		{:else if filteredReports.length === 0}
			<div class="state-card empty-card">
				<p class="state-title">NO REPORTS</p>
				<p class="state-detail">
					{reports.length === 0
						? 'No reports have been generated yet.'
						: 'No reports match the current filter.'}
				</p>
			</div>
		{:else}
			<div class="grid" role="table" aria-label="Reports">
				<div class="grid-head" role="row">
					<div
						class="col col-dtg"
						role="columnheader"
						title="Report generation timestamp (UTC)"
					>
						TIMESTAMP
					</div>
					<div
						class="col col-type"
						role="columnheader"
						title="Report type (sitrep or emcon-survey)"
					>
						TYPE
					</div>
					<div class="col col-title" role="columnheader">TITLE</div>
					<div
						class="col col-host"
						role="columnheader"
						title="Count of emitters classified as HOSTILE"
					>
						HOST
					</div>
					<div
						class="col col-susp"
						role="columnheader"
						title="Count of emitters classified as SUSPECT"
					>
						SUSP
					</div>
					<div
						class="col col-emit"
						role="columnheader"
						title="Total emitter count for this tick capture"
					>
						EMIT
					</div>
					<div class="col col-actions" role="columnheader">ACTIONS</div>
				</div>
				{#each filteredReports as r (r.id)}
					<div class="grid-row" class:selected={selectedReportId === r.id} role="row">
						<div class="col col-dtg" role="cell">{formatDTG(r.generated_at)}</div>
						<div class="col col-type" role="cell">{typeLabel(r.type)}</div>
						<div class="col col-title" role="cell" title={r.title}>{r.title}</div>
						<div
							class="col col-host"
							role="cell"
							class:count-danger={r.flagged_hostile > 0}
							class:count-zero={r.flagged_hostile === 0}
						>
							{r.flagged_hostile}
						</div>
						<div
							class="col col-susp"
							role="cell"
							class:count-warning={r.flagged_suspect > 0}
							class:count-zero={r.flagged_suspect === 0}
						>
							{r.flagged_suspect}
						</div>
						<div class="col col-emit" role="cell">{r.emitter_count}</div>
						<div class="col col-actions" role="cell">
							<button
								class="icon-btn"
								type="button"
								aria-label="View report"
								title="View"
								onclick={() => viewReport(r.id)}
							>
								<Eye size={12} />
							</button>
							<button
								class="icon-btn"
								type="button"
								aria-label="Open PDF"
								title="PDF"
								disabled={!r.pdf_path}
								onclick={() => openExternal(r.id, 'pdf')}
							>
								<FileText size={12} />
							</button>
							<button
								class="icon-btn icon-btn-danger"
								type="button"
								aria-label="Delete report"
								title="Delete"
								onclick={() => void deleteReport(r.id)}
							>
								<Trash2 size={12} />
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Preview pane -->
	{#if selectedReportId}
		<div
			class="preview-resize-handle"
			role="separator"
			aria-orientation="horizontal"
			aria-label="Resize preview pane"
			aria-valuenow={Math.round(previewHeight)}
			aria-valuemin={MIN_PREVIEW}
			aria-valuemax={2000}
			tabindex="0"
			onmousedown={onResizeDown}
			onkeydown={onResizeKeydown}
		></div>
		<div class="preview-pane" style="height: {previewHeight}px">
			<div class="preview-toolbar">
				<span class="field-label">PREVIEW</span>
				<div class="toolbar-spacer"></div>
				<button
					class="btn"
					type="button"
					onclick={() => openExternal(selectedReportId ?? '', 'pdf')}
				>
					<FileText size={12} />
					<span>PDF</span>
				</button>
				<button
					class="btn"
					type="button"
					onclick={() => openExternal(selectedReportId ?? '', 'revealjs')}
				>
					<Presentation size={12} />
					<span>SLIDES HTML</span>
				</button>
				<button
					class="btn"
					type="button"
					onclick={() => openExternal(selectedReportId ?? '', 'slides-pdf')}
				>
					<Presentation size={12} />
					<span>SLIDES PDF</span>
				</button>
				<button class="btn" type="button" onclick={closePreview} aria-label="Close preview">
					<X size={12} />
					<span>CLOSE</span>
				</button>
			</div>
			<iframe
				src={`/api/reports/${selectedReportId}/view?format=pdf#toolbar=0&navpanes=0`}
				title="Report preview"
				class="report-iframe"
			></iframe>
		</div>
	{/if}

	<!-- New Mission modal -->
	{#if showNewMissionModal}
		<div
			class="modal-backdrop"
			role="presentation"
			tabindex="-1"
			onclick={(e) => {
				if (e.target === e.currentTarget) closeNewMissionModal();
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') closeNewMissionModal();
			}}
		>
			<div
				class="modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby="mission-modal-title"
			>
				<header class="modal-header">
					<h3 id="mission-modal-title" class="section-label">NEW MISSION</h3>
					<button
						class="icon-btn"
						type="button"
						onclick={closeNewMissionModal}
						aria-label="Close"
					>
						<X size={12} />
					</button>
				</header>
				<form class="modal-body" onsubmit={submitNewMission}>
					<label class="form-field">
						<span class="field-label">NAME</span>
						<input
							class="input"
							type="text"
							bind:value={missionName}
							required
							disabled={missionSubmitting}
						/>
					</label>
					<label class="form-field">
						<span class="field-label">TYPE</span>
						<select
							class="select"
							bind:value={missionType}
							disabled={missionSubmitting}
						>
							<option value="sitrep-loop">SITREP LOOP</option>
							<option value="emcon-survey">EMCON SURVEY</option>
						</select>
					</label>
					<label class="form-field">
						<span class="field-label">UNIT</span>
						<input
							class="input"
							type="text"
							bind:value={missionUnit}
							disabled={missionSubmitting}
						/>
					</label>
					<label class="form-field">
						<span class="field-label">AO (MGRS)</span>
						<input
							class="input"
							type="text"
							bind:value={missionAoMgrs}
							disabled={missionSubmitting}
						/>
					</label>
					<label class="form-field form-field-inline">
						<input
							type="checkbox"
							bind:checked={missionSetActive}
							disabled={missionSubmitting}
						/>
						<span class="field-label">SET ACTIVE</span>
					</label>

					{#if missionError}
						<p class="form-error" role="alert">{missionError}</p>
					{/if}
					{#if missionSuccess}
						<p class="form-success" role="status">{missionSuccess}</p>
					{/if}

					<div class="modal-footer">
						<button
							class="btn"
							type="button"
							onclick={closeNewMissionModal}
							disabled={missionSubmitting}
						>
							CANCEL
						</button>
						<button class="btn btn-primary" type="submit" disabled={missionSubmitting}>
							{missionSubmitting ? 'CREATING...' : 'CREATE'}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</section>

<style>
	.reports-view {
		display: grid;
		grid-template-rows: auto 1fr auto;
		width: 100%;
		height: 100%;
		background: var(--background);
		color: var(--foreground);
		font-family: 'Fira Code', monospace;
		overflow: hidden;
	}

	.toolbar {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 16px;
		border-bottom: 1px solid var(--border);
		background: var(--card);
		min-height: 40px;
	}

	.section-label {
		font-family: 'Fira Code', monospace;
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--foreground);
		margin: 0;
	}

	.field-label {
		font-family: 'Fira Code', monospace;
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.toolbar-group {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.toolbar-spacer {
		flex: 1;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 10px;
		background: transparent;
		color: var(--foreground);
		border: 1px solid var(--border);
		border-radius: 0;
		font-family: 'Fira Code', monospace;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 1px;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease;
	}

	.btn:hover:not(:disabled) {
		background: var(--surface-hover, #ffffff0a);
		border-color: var(--primary);
	}

	.btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.btn-primary {
		border-color: var(--primary);
		color: var(--primary);
	}

	.select,
	.input {
		background: var(--background);
		color: var(--foreground);
		border: 1px solid var(--border);
		border-radius: 0;
		padding: 4px 8px;
		font-family: 'Fira Code', monospace;
		font-size: 10px;
		letter-spacing: 0.5px;
		min-width: 100px;
		outline: none;
	}

	.input:focus,
	.select:focus {
		border-color: var(--primary);
	}

	.grid-wrap {
		overflow: auto;
		min-height: 0;
	}

	.grid-wrap.collapsed {
		display: none;
	}

	.grid {
		display: grid;
		grid-template-columns:
			minmax(140px, auto) minmax(90px, auto) minmax(200px, 1fr)
			60px 60px 60px minmax(180px, auto);
	}

	.grid-head,
	.grid-row {
		display: contents;
	}

	.grid-head .col {
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--muted-foreground);
		background: var(--card);
		border-bottom: 1px solid var(--border);
		padding: 10px 12px;
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
	}

	.grid-row .col {
		font-size: 13px;
		padding: 10px 12px;
		border-bottom: 1px solid var(--border);
		color: var(--foreground);
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		min-width: 0;
		border-left: 2px solid transparent;
	}

	.grid-row.selected .col:first-child {
		border-left: 2px solid var(--primary);
	}

	.grid-row:hover .col {
		background: #ffffff06;
	}

	.col-title {
		justify-content: flex-start;
		text-align: left;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.col-host,
	.col-susp,
	.col-emit {
		font-variant-numeric: tabular-nums;
	}

	.count-danger {
		color: #ff5c33;
	}

	.count-warning {
		color: #d4a054;
	}

	.count-zero {
		color: var(--muted-foreground);
	}

	.col-actions {
		gap: 4px;
	}

	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		padding: 0;
		background: transparent;
		border: 1px solid transparent;
		color: var(--muted-foreground);
		cursor: pointer;
		border-radius: 0;
		transition:
			color 0.15s ease,
			border-color 0.15s ease;
	}

	.icon-btn:hover:not(:disabled) {
		color: var(--primary);
		border-color: var(--border);
	}

	.icon-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.icon-btn-danger:hover:not(:disabled) {
		color: #ff5c33;
	}

	/* States */
	.grid-skeleton {
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.skeleton-row {
		height: 28px;
		background: var(--card);
		border: 1px solid var(--border);
		animation: pulse 1.6s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.4;
		}
		50% {
			opacity: 0.8;
		}
	}

	.state-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 32px;
		margin: 24px;
		border: 1px solid var(--border);
		background: var(--card);
	}

	.error-card {
		border-color: #ff5c33;
	}

	.state-title {
		font-family: 'Fira Code', monospace;
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--foreground);
		margin: 0;
	}

	.error-card .state-title {
		color: #ff5c33;
	}

	.state-detail {
		font-family: 'Fira Code', monospace;
		font-size: 10px;
		color: var(--muted-foreground);
		margin: 0;
		text-align: center;
	}

	/* Preview */
	.preview-resize-handle {
		height: 8px;
		cursor: ns-resize;
		background: var(--border);
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
		transition: background 0.15s ease;
		flex-shrink: 0;
	}

	.preview-resize-handle:hover {
		background: var(--primary);
	}

	.reports-view.fullscreen .preview-resize-handle {
		display: none;
	}

	.preview-pane {
		display: flex;
		flex-direction: column;
		border-top: 1px solid var(--border);
		background: #ffffff;
		min-height: 180px;
		flex-shrink: 0;
	}

	.reports-view.fullscreen .preview-pane {
		height: auto !important;
		flex: 1;
	}

	.preview-toolbar {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-bottom: 1px solid var(--border);
		min-height: 36px;
		background: var(--card);
		color: var(--foreground);
	}

	.report-iframe {
		flex: 1;
		width: 100%;
		border: none;
		background: #ffffff;
	}

	/* Modal */
	.modal-backdrop {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		border: none;
		padding: 0;
	}

	.modal {
		background: var(--card);
		border: 1px solid var(--border);
		min-width: 360px;
		max-width: 480px;
		width: 100%;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
	}

	.modal-body {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 14px;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.form-field-inline {
		flex-direction: row;
		align-items: center;
		gap: 8px;
	}

	.form-error {
		font-family: 'Fira Code', monospace;
		font-size: 10px;
		color: #ff5c33;
		margin: 0;
	}

	.form-success {
		font-family: 'Fira Code', monospace;
		font-size: 10px;
		color: #8bbfa0;
		margin: 0;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 6px;
	}

	.reports-view.fullscreen {
		position: absolute;
		inset: 0;
		z-index: 50;
	}
</style>
