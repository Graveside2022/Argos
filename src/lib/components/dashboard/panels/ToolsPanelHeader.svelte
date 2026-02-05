<script lang="ts">
	import {
		toolNavigationPath,
		navigateBack,
		breadcrumbs
	} from '$lib/stores/dashboard/toolsStore';
	import { uiIcons } from '$lib/data/toolIcons';

	let canGoBack = $derived($toolNavigationPath.length > 0);
	let currentBreadcrumbs = $derived($breadcrumbs);
	let breadcrumbText = $derived(currentBreadcrumbs.slice(0, -1).join(' / '));
</script>

<header class="panel-header">
	{#if canGoBack}
		<button class="back-btn" onclick={navigateBack}>
			{@html uiIcons.arrowLeft}
			<span class="breadcrumb-path">{breadcrumbText}</span>
		</button>
	{:else}
		<span class="panel-title">TOOLS</span>
	{/if}
</header>

<style>
	.panel-header {
		padding: var(--space-4);
		border-bottom: 1px solid var(--palantir-border-subtle);
		min-height: 48px;
		display: flex;
		align-items: center;
	}

	.panel-title {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-widest);
		color: var(--palantir-text-secondary);
	}

	.back-btn {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		background: none;
		border: none;
		color: var(--palantir-text-tertiary);
		font-size: var(--text-xs);
		cursor: pointer;
		padding: 0;
		transition: color 0.15s ease;
		width: 100%;
	}

	.back-btn:hover {
		color: var(--palantir-text-primary);
	}

	.back-btn :global(svg) {
		flex-shrink: 0;
	}

	.breadcrumb-path {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		letter-spacing: var(--letter-spacing-wide);
	}
</style>
