<script lang="ts">
	import type { ToolCategory } from '$lib/types/tools';
	import { navigateToCategory } from '$lib/stores/dashboard/tools-store';
	import { countTools } from '$lib/data/tool-hierarchy';
	import { uiIcons } from '$lib/data/tool-icons';

	interface Props {
		category: ToolCategory;
	}

	let { category }: Props = $props();

	let toolCount = $derived(countTools(category));
</script>

<button class="category-card" onclick={() => navigateToCategory(category.id)}>
	<div class="category-header">
		{#if category.icon}
			<div class="category-icon">{@html category.icon}</div>
		{/if}
		<span class="category-name">{category.name}</span>
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
		padding: var(--space-3);
		background: var(--palantir-bg-elevated);
		border: 1px solid var(--palantir-border-subtle);
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: 100%;
		text-align: left;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.category-card:hover {
		border-color: var(--palantir-accent);
		background: var(--palantir-bg-hover);
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
		color: var(--palantir-text-secondary);
	}

	.category-name {
		flex: 1;
		font-size: var(--text-sm);
		font-weight: var(--font-weight-medium);
		color: var(--palantir-text-primary);
	}

	.chevron-right {
		flex-shrink: 0;
		color: var(--palantir-text-tertiary);
	}

	.chevron-right :global(svg) {
		display: block;
	}

	.category-description {
		font-size: var(--text-xs);
		color: var(--palantir-text-tertiary);
		line-height: 1.4;
		margin: 0;
	}

	.category-meta {
		font-size: var(--text-xs);
		color: var(--palantir-text-tertiary);
	}

	.tool-count {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
</style>
