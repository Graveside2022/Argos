<script lang="ts">
	import { onnetCategory } from '$lib/data/onnet';
	import { countTools } from '$lib/data/tool-hierarchy';
	import { uiIcons } from '$lib/data/tool-icons';
	import { activePanel } from '$lib/stores/dashboard/dashboard-store';
	import { navigateToCategory, toolNavigationPath } from '$lib/stores/dashboard/tools-store';

	function handleBack() {
		activePanel.set('tools');
		toolNavigationPath.set([]);
	}

	function handleCategoryClick(categoryId: string) {
		activePanel.set('tools');
		toolNavigationPath.set(['onnet', categoryId]);
	}
</script>

<div class="onnet-panel">
	<header class="panel-header">
		<button class="back-btn" onclick={handleBack}>
			<!-- @constitutional-exemption Article-IX-9.4 issue:#13 — Static hardcoded SVG icon string from tool-icons.ts, no user input -->
			{@html uiIcons.arrowLeft}
			<span class="back-label">TOOLS</span>
		</button>
		<span class="panel-title">ONNET</span>
	</header>

	<div class="cards-container">
		{#each onnetCategory.children as category (category.id)}
			{@const counts =
				'children' in category ? countTools(category) : { installed: 0, total: 0 }}
			<button class="category-card" onclick={() => handleCategoryClick(category.id)}>
				<div class="card-header">
					<span class="card-name">{category.name}</span>
					<!-- @constitutional-exemption Article-IX-9.4 issue:#13 — Static hardcoded SVG icon string from tool-icons.ts, no user input -->
					<div class="chevron">{@html uiIcons.chevronRight}</div>
				</div>
				{#if 'description' in category && category.description}
					<p class="card-description">{category.description}</p>
				{/if}
				<div class="card-meta">
					<span class="tool-count">{counts.installed} / {counts.total} tools</span>
				</div>
			</button>
		{/each}
	</div>
</div>

<style>
	.onnet-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.panel-header {
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.panel-title {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 1.5px;
		color: var(--foreground-muted, #bbbbbb);
	}

	.back-btn {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		background: var(--surface-hover, #1e1e1e);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--interactive, #4a8af4);
		font-size: var(--text-xs);
		cursor: pointer;
		padding: var(--space-1) var(--space-3);
		transition: all 0.15s ease;
		width: fit-content;
	}

	.back-btn:hover {
		background: var(--secondary);
		border-color: var(--interactive);
		color: var(--foreground);
	}

	.back-btn :global(svg) {
		flex-shrink: 0;
	}

	.back-label {
		letter-spacing: var(--letter-spacing-wide);
		font-weight: var(--font-weight-medium);
		color: var(--primary);
	}

	.cards-container {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-3);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

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

	.card-header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.card-name {
		flex: 1;
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 1.2px;
		color: var(--foreground);
	}

	.chevron {
		flex-shrink: 0;
		color: var(--foreground-tertiary, #999999);
	}

	.chevron :global(svg) {
		display: block;
	}

	.card-description {
		font-size: var(--text-xs);
		color: var(--foreground-secondary, #888888);
		line-height: 1.4;
		margin: 0;
	}

	.card-meta {
		font-size: var(--text-xs);
		color: var(--foreground-tertiary, #999999);
	}

	.tool-count {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
</style>
