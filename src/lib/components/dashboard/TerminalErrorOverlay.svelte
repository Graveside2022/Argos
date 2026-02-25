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
		background: rgba(17, 17, 17, 0.9);
		z-index: 10;
	}
	.error-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 32px;
		color: var(--foreground-secondary, #888888);
		text-align: center;
	}
	.error-content svg {
		color: var(--foreground-tertiary, #999999);
	}
	.error-title {
		font-family: var(--font-secondary, Geist, sans-serif);
		font-size: 16px;
		font-weight: 600;
		color: var(--foreground);
	}
	.error-detail {
		font-family: var(--font-secondary, Geist, sans-serif);
		font-size: 14px;
		color: var(--foreground-secondary, #888888);
	}
	.error-cmd {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 14px;
		background: var(--card);
		padding: 8px 16px;
		border-radius: 4px;
		color: var(--interactive);
		border: 1px solid var(--border);
	}
</style>
