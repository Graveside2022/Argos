<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import SelectRoot from '$lib/components/ui/select/select.svelte';
	import SelectContent from '$lib/components/ui/select/select-content.svelte';
	import SelectItem from '$lib/components/ui/select/select-item.svelte';
	import SelectTrigger from '$lib/components/ui/select/select-trigger.svelte';

	const Select = {
		Root: SelectRoot,
		Trigger: SelectTrigger,
		Content: SelectContent,
		Item: SelectItem
	};
	import { activePanel, activeView } from '$lib/stores/dashboard/dashboard-store';
	import type { RailPosition, ThemePalette } from '$lib/stores/theme-store.svelte';
	import { themeStore } from '$lib/stores/theme-store.svelte';
	import { palettes } from '$lib/themes/palettes';

	const paletteOptions = palettes.map((p) => ({ value: p.label, label: p.name }));

	const railOptions = [
		{ value: 'left', label: 'Left' },
		{ value: 'right', label: 'Right' },
		{ value: 'top', label: 'Top' },
		{ value: 'bottom', label: 'Bottom' }
	];

	function handlePaletteChange(value: string | undefined) {
		if (value) {
			themeStore.setPalette(value as ThemePalette);
		}
	}

	function handleRailChange(value: string | undefined) {
		if (value) {
			themeStore.setRailPosition(value as RailPosition);
		}
	}

	function openView(view: 'tak-config' | 'logs-analytics') {
		activeView.set(view);
		activePanel.set(null);
	}
</script>

<div class="settings-panel">
	<header class="panel-header">
		<span class="panel-title">SETTINGS</span>
	</header>

	<div class="cards-container">
		<!-- Appearance Card -->
		<div class="settings-card">
			<div class="card-header">
				<svg
					class="card-icon"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="12" cy="12" r="10" /><path d="M12 2a7 7 0 0 0 0 14h7" />
				</svg>
				<span class="card-title">Appearance</span>
			</div>
			<p class="card-description">Customize colors and layout</p>
			<div class="card-body">
				<div class="setting-row">
					<span class="setting-label">Color Palette</span>
					<Select.Root
						type="single"
						value={themeStore.palette}
						onValueChange={handlePaletteChange}
					>
						<Select.Trigger class="w-[140px] h-8 text-xs">
							{paletteOptions.find((p) => p.value === themeStore.palette)?.label ??
								'Default'}
						</Select.Trigger>
						<Select.Content>
							{#each paletteOptions as option (option.value)}
								<Select.Item value={option.value}>{option.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="setting-row">
					<span class="setting-label">Navigation Rail</span>
					<Select.Root
						type="single"
						value={themeStore.railPosition}
						onValueChange={handleRailChange}
					>
						<Select.Trigger class="w-[140px] h-8 text-xs">
							{railOptions.find((r) => r.value === themeStore.railPosition)?.label ??
								'Left'}
						</Select.Trigger>
						<Select.Content>
							{#each railOptions as option (option.value)}
								<Select.Item value={option.value}>{option.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			</div>
		</div>

		<!-- Connectivity Card -->
		<div class="settings-card">
			<div class="card-header">
				<svg
					class="card-icon"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
					<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
				</svg>
				<span class="card-title">Connectivity</span>
			</div>
			<p class="card-description">External service connections</p>
			<div class="card-body">
				<div class="setting-row">
					<span class="setting-label">TAK Server</span>
					<button class="open-btn" onclick={() => openView('tak-config')}>
						Open
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<polyline points="9 18 15 12 9 6" />
						</svg>
					</button>
				</div>
			</div>
		</div>

		<!-- Logs & Analytics Card -->
		<div class="settings-card">
			<div class="card-header">
				<svg
					class="card-icon"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="18" y1="20" x2="18" y2="10" />
					<line x1="12" y1="20" x2="12" y2="4" />
					<line x1="6" y1="20" x2="6" y2="14" />
				</svg>
				<span class="card-title">Logs & Analytics</span>
			</div>
			<p class="card-description">System logs and diagnostics</p>
			<div class="card-body">
				<div class="setting-row">
					<span class="setting-label">System Logs</span>
					<button class="open-btn" onclick={() => openView('logs-analytics')}>
						Open
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<polyline points="9 18 15 12 9 6" />
						</svg>
					</button>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.settings-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.panel-header {
		padding: var(--space-4);
		border-bottom: 1px solid var(--palantir-border-subtle);
	}

	.panel-title {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-widest);
		color: var(--palantir-text-secondary);
	}

	.cards-container {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		overflow-y: auto;
	}

	.settings-card {
		padding: var(--space-3);
		background: var(--palantir-bg-elevated);
		border: 1px solid var(--palantir-border-subtle);
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.card-icon {
		flex-shrink: 0;
		color: var(--palantir-text-secondary);
	}

	.card-title {
		font-size: var(--text-sm);
		font-weight: var(--font-weight-medium);
		color: var(--palantir-text-primary);
	}

	.card-description {
		font-size: var(--text-xs);
		color: var(--palantir-text-tertiary);
		line-height: 1.4;
		margin: 0;
	}

	.card-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin-top: var(--space-1);
	}

	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.setting-label {
		font-size: var(--text-sm);
		color: var(--palantir-text-primary);
	}

	.open-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 10px;
		font-size: var(--text-xs);
		color: var(--palantir-accent);
		background: transparent;
		border: 1px solid var(--palantir-border-subtle);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.open-btn:hover {
		background: var(--palantir-bg-hover);
		border-color: var(--palantir-accent);
	}
</style>
