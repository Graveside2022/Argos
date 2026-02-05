<script lang="ts">
	import { currentCategory } from '$lib/stores/dashboard/toolsStore';
	import { isCategory } from '$lib/types/tools';
	import ToolCategoryCard from '../shared/ToolCategoryCard.svelte';
	import ToolCategorySection from '../shared/ToolCategorySection.svelte';
	import ToolCard from '../shared/ToolCard.svelte';

	let category = $derived($currentCategory);
	let children = $derived(category?.children || []);
</script>

<div class="tools-navigation-view">
	{#if category?.description}
		<p class="category-description">{category.description}</p>
	{/if}

	<div class="items-list">
		{#each children as item (item.id)}
			{#if isCategory(item)}
				{#if item.collapsible}
					<ToolCategorySection category={item} />
				{:else}
					<ToolCategoryCard category={item} />
				{/if}
			{:else}
				<ToolCard {...item} />
			{/if}
		{/each}
	</div>
</div>

<style>
	.tools-navigation-view {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-3);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.category-description {
		font-size: var(--text-xs);
		color: var(--palantir-text-tertiary);
		line-height: 1.4;
		margin: 0;
		padding: 0 var(--space-1);
	}

	.items-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
</style>
