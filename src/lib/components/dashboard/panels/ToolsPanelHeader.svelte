<script lang="ts">
	import {
		toolNavigationPath,
		navigateBack,
		breadcrumbs
	} from '$lib/stores/dashboard/toolsStore';
	import { uiIcons } from '$lib/data/toolIcons';

	let canGoBack = $derived($toolNavigationPath.length > 0);
	let currentBreadcrumbs = $derived($breadcrumbs);
	let currentTitle = $derived(currentBreadcrumbs[currentBreadcrumbs.length - 1] || 'TOOLS');
	let parentTitle = $derived(currentBreadcrumbs[currentBreadcrumbs.length - 2] || 'TOOLS');
</script>

<header class="panel-header">
	{#if canGoBack}
		<button class="back-btn" onclick={navigateBack}>
			{@html uiIcons.arrowLeft}
			<span class="back-label">{parentTitle}</span>
		</button>
	{/if}
	<span class="panel-title">{currentTitle}</span>
</header>

<style>
	.panel-header {
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--palantir-border-subtle);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.panel-title {
		font-size: var(--text-sm);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-widest);
		color: var(--palantir-text-primary);
	}

	.back-btn {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid var(--palantir-border-subtle);
		border-radius: var(--radius-sm);
		color: var(--palantir-accent);
		font-size: var(--text-xs);
		cursor: pointer;
		padding: var(--space-1) var(--space-3);
		transition: all 0.15s ease;
		width: fit-content;
	}

	.back-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		border-color: var(--palantir-accent);
		color: var(--palantir-text-primary);
	}

	.back-btn :global(svg) {
		flex-shrink: 0;
	}

	.back-label {
		letter-spacing: var(--letter-spacing-wide);
		font-weight: var(--font-weight-medium);
	}
</style>
