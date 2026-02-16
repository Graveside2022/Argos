<!-- @constitutional-exemption Article-IV-4.3 issue:#999 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import * as Select from '$lib/components/ui/select';
	import { Switch } from '$lib/components/ui/switch';
	import type { ThemePalette } from '$lib/stores/theme-store.svelte';
	import { themeStore } from '$lib/stores/theme-store.svelte';
	import { palettes } from '$lib/themes/palettes';

	const paletteOptions = palettes.map((p) => ({ value: p.label, label: p.name }));

	function handlePaletteChange(value: string | undefined) {
		if (value) {
			themeStore.setPalette(value as ThemePalette);
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

		<!-- Mode Toggle (T016, T017) -->
		<div class="setting-row">
			<div class="setting-label-group">
				<span class="setting-label">Mode</span>
				<span class="setting-hint">{themeStore.mode === 'dark' ? 'Dark' : 'Light'}</span>
			</div>
			<Switch
				checked={themeStore.mode === 'dark'}
				onCheckedChange={(checked) => themeStore.setMode(checked ? 'dark' : 'light')}
			/>
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

	.setting-label-group {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.setting-label {
		font-size: var(--text-sm);
		color: var(--palantir-text-primary);
	}

	.setting-hint {
		font-size: var(--text-xs);
		color: var(--palantir-text-tertiary);
	}
</style>
