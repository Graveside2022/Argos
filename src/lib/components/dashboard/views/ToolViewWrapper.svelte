<!-- @constitutional-exemption Article-IV-4.3 issue:#999 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		status?: string;
		onBack: () => void;
		children: Snippet;
	}

	let { title, status = '', onBack, children }: Props = $props();
</script>

<div class="tool-view">
	<div class="tool-view-header">
		<button class="btn btn-ghost btn-sm" onclick={onBack}>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<polyline points="15 18 9 12 15 6" />
			</svg>
			Back
		</button>
		<span class="tool-view-title">{title}</span>
		{#if status}
			<span class="badge badge-success">{status}</span>
		{/if}
	</div>
	<div class="tool-view-content">
		{@render children()}
	</div>
</div>

<style>
	.tool-view {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.tool-view-header {
		height: 40px;
		min-height: 40px;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 0 var(--space-4);
		background: var(--palantir-bg-surface);
		border-bottom: 1px solid var(--palantir-border-subtle);
	}

	.tool-view-title {
		font-size: var(--text-sm);
		font-weight: var(--font-weight-semibold);
		color: var(--palantir-text-primary);
		letter-spacing: var(--letter-spacing-wide);
	}

	.tool-view-content {
		flex: 1;
		overflow: hidden;
	}
</style>
