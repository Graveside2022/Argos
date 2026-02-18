<!-- @constitutional-exemption Article-IV-4.3 issue:#999 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
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
</script>

<div class="settings-panel">
	<header class="panel-header">
		<span class="panel-title">SETTINGS</span>
	</header>

	<section class="panel-section">
		<span class="section-title">APPEARANCE</span>

		<!-- Palette Selector (T014, T015) -->
		<div class="setting-row">
			<span class="setting-label">Color Palette</span>
			<Select.Root
				type="single"
				value={themeStore.palette}
				onValueChange={handlePaletteChange}
			>
				<Select.Trigger class="w-[140px] h-8 text-xs">
					{paletteOptions.find((p) => p.value === themeStore.palette)?.label ?? 'Default'}
				</Select.Trigger>
				<Select.Content>
					{#each paletteOptions as option (option.value)}
						<Select.Item value={option.value}>{option.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>

		<!-- Navigation Rail Position -->
		<div class="setting-row">
			<span class="setting-label">Navigation Rail</span>
			<Select.Root
				type="single"
				value={themeStore.railPosition}
				onValueChange={handleRailChange}
			>
				<Select.Trigger class="w-[140px] h-8 text-xs">
					{railOptions.find((r) => r.value === themeStore.railPosition)?.label ?? 'Left'}
				</Select.Trigger>
				<Select.Content>
					{#each railOptions as option (option.value)}
						<Select.Item value={option.value}>{option.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
	</section>

	<section class="panel-section">
		<span class="section-title">CONNECTIVITY</span>

		<div class="setting-row">
			<span class="setting-label">TAK Server</span>
			<a href="/settings/tak" class="text-xs text-blue-400 hover:text-blue-300"
				>Configure &rarr;</a
			>
		</div>
	</section>
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

	.panel-section {
		padding: var(--space-4);
		border-bottom: 1px solid var(--palantir-border-subtle);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.section-title {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-widest);
		color: var(--palantir-text-tertiary);
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
</style>
