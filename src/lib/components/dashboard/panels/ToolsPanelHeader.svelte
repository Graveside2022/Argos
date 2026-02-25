<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import { uiIcons } from '$lib/data/tool-icons';
	import {
		breadcrumbs,
		navigateBack,
		toolNavigationPath
	} from '$lib/stores/dashboard/tools-store';

	let canGoBack = $derived($toolNavigationPath.length > 0);
	let currentBreadcrumbs = $derived($breadcrumbs);
	let currentTitle = $derived(currentBreadcrumbs[currentBreadcrumbs.length - 1] || 'TOOLS');
	let parentTitle = $derived(currentBreadcrumbs[currentBreadcrumbs.length - 2] || 'TOOLS');
</script>

<header class="panel-header">
	{#if canGoBack}
		<button class="back-btn" onclick={navigateBack}>
			<!-- @constitutional-exemption Article-IX-9.4 issue:#13 — Static hardcoded SVG icon string from tool-icons.ts, no user input -->
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
		background: var(--hover-tint);
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
		background: var(--secondary);
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
