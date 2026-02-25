<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import { countTools } from '$lib/data/tool-hierarchy';
	import { uiIcons } from '$lib/data/tool-icons';
	import { navigateToCategory } from '$lib/stores/dashboard/tools-store';
	import type { ToolCategory } from '$lib/types/tools';

	interface Props {
		category: ToolCategory;
	}

	let { category }: Props = $props();

	let toolCount = $derived(countTools(category));
</script>

<button class="category-card" onclick={() => navigateToCategory(category.id)}>
	<div class="category-header">
		{#if category.icon}
			<!-- @constitutional-exemption Article-IX-9.4 issue:#13 — Static hardcoded SVG icon string from tool-icons.ts, no user input -->
			<div class="category-icon">{@html category.icon}</div>
		{/if}
		<span class="category-name">{category.name}</span>
		<!-- @constitutional-exemption Article-IX-9.4 issue:#13 — Static hardcoded SVG icon string from tool-icons.ts, no user input -->
		<div class="chevron-right">{@html uiIcons.chevronRight}</div>
	</div>
	{#if category.description}
		<p class="category-description">{category.description}</p>
	{/if}
	<div class="category-meta">
		<span class="tool-count">{toolCount.installed} / {toolCount.total} tools</span>
	</div>
</button>

<style>
	.category-card {
		padding: 8px 12px;
		background: var(--surface-elevated, #151515);
		border: none;
		border-bottom: 1px solid var(--border);
		border-radius: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: 100%;
		text-align: left;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.category-card:hover {
		border-color: var(--interactive);
		background: var(--surface-hover, #1e1e1e);
	}

	.category-header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.category-icon {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		color: var(--foreground-secondary, #888888);
	}

	.category-name {
		flex: 1;
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 1.2px;
		color: var(--foreground);
	}

	.chevron-right {
		flex-shrink: 0;
		color: var(--foreground-tertiary, #999999);
	}

	.chevron-right :global(svg) {
		display: block;
	}

	.category-description {
		font-size: var(--text-xs);
		color: var(--foreground-secondary, #888888);
		line-height: 1.4;
		margin: 0;
	}

	.category-meta {
		font-size: var(--text-xs);
		color: var(--foreground-tertiary, #999999);
	}

	.tool-count {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
</style>
