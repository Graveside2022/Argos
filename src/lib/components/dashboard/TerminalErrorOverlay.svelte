<!-- Terminal connection error overlay shown when WebSocket retries are exhausted -->
<script lang="ts">
	interface Props {
		maxRetries: number;
	}

	let { maxRetries }: Props = $props();
</script>

<div class="error-overlay">
	<div class="error-content">
		<svg
			width="32"
			height="32"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<polyline points="4 17 10 11 4 5" />
			<line x1="12" y1="19" x2="20" y2="19" />
		</svg>
		<span class="error-title">Terminal Unavailable</span>
		<span class="error-detail"
			>Could not connect to terminal server after {maxRetries} attempts.</span
		>
		<code class="error-cmd">Check that the dev server is running (npm run dev)</code>
	</div>
</div>

<style>
	.error-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(14, 17, 22, 0.9);
		z-index: 10;
	}
	.error-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-8);
		color: var(--palantir-text-secondary);
		text-align: center;
	}
	.error-content svg {
		color: var(--palantir-text-tertiary);
	}
	.error-title {
		font-size: var(--text-lg);
		font-weight: var(--font-weight-semibold);
		color: var(--palantir-text-primary);
	}
	.error-detail {
		font-size: var(--text-sm);
		color: var(--palantir-text-tertiary);
	}
	.error-detail code {
		font-family: var(--font-mono);
		color: var(--palantir-accent);
	}
	.error-cmd {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		background: var(--palantir-bg-elevated);
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius-md);
		color: var(--palantir-accent);
		border: 1px solid var(--palantir-border-subtle);
	}
</style>
