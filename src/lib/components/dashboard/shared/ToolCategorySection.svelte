<script lang="ts">
	import type { ToolCategory } from '$lib/types/tools';
	import { expandedCategories, toggleCategory } from '$lib/stores/dashboard/toolsStore';
	import { isCategory } from '$lib/types/tools';
	import ToolCard from './ToolCard.svelte';
	import { uiIcons } from '$lib/data/toolIcons';

	interface Props {
		category: ToolCategory;
	}

	let { category }: Props = $props();
	let isExpanded = $derived($expandedCategories.has(category.id));
</script>

<div class="category-section">
	<button class="section-header" onclick={() => toggleCategory(category.id)}>
		<div class="chevron" class:expanded={isExpanded}>
			{@html uiIcons.chevronDown}
		</div>
		<span class="section-label">{category.name}</span>
		<span class="tool-count">{category.children.length}</span>
	</button>

	{#if isExpanded}
		<div class="section-content">
			{#each category.children as item (item.id)}
				{#if !isCategory(item)}
					<ToolCard {...item} />
				{/if}
			{/each}
		</div>
	{/if}
</div>

<style>
	.category-section {
		display: flex;
		flex-direction: column;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-1);
		background: none;
		border: none;
		cursor: pointer;
		width: 100%;
		transition: background 0.15s ease;
	}

	.section-header:hover {
		background: var(--palantir-bg-hover);
		border-radius: var(--radius-sm);
	}

	.chevron {
		flex-shrink: 0;
		color: var(--palantir-text-tertiary);
		transition: transform 0.2s ease;
		display: flex;
		align-items: center;
	}

	.chevron.expanded {
		transform: rotate(0deg);
	}

	.chevron:not(.expanded) {
		transform: rotate(-90deg);
	}

	.chevron :global(svg) {
		display: block;
	}

	.section-label {
		flex: 1;
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-widest);
		color: var(--palantir-text-tertiary);
		text-align: left;
	}

	.tool-count {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--palantir-text-tertiary);
		font-variant-numeric: tabular-nums;
	}

	.section-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding-left: var(--space-5);
		margin-top: var(--space-2);
	}
</style>
