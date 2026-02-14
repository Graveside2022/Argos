<!-- @constitutional-exemption Article-IV-4.3 issue:#TBD — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<!-- @constitutional-exemption Article-IV-4.2 issue:#TBD — Button pattern extraction deferred to component library refactor -->
<script lang="ts">
	interface Props {
		name: string;
		description?: string;
		icon: string;
		status?: 'stopped' | 'starting' | 'running' | 'stopping';
		count?: number | null;
		canOpen?: boolean;
		showControls?: boolean;
		externalUrl?: string | null;
		isInstalled?: boolean;
		onStart?: () => void;
		onStop?: () => void;
		onOpen?: () => void;
	}

	let {
		name,
		description = '',
		icon,
		status = 'stopped',
		count = null,
		canOpen = true,
		showControls = true,
		externalUrl = null,
		isInstalled = true,
		onStart,
		onStop,
		onOpen
	}: Props = $props();

	let isRunning = $derived(status === 'running');
	let isTransitioning = $derived(status === 'starting' || status === 'stopping');
	let statusLabel = $derived(
		status === 'starting'
			? 'Starting...'
			: status === 'stopping'
				? 'Stopping...'
				: status === 'running'
					? 'Running'
					: 'Stopped'
	);
</script>

<div class="tool-card" class:running={isRunning} class:not-installed={!isInstalled}>
	<div class="tool-header">
		<div class="tool-icon">
			{@html icon}
		</div>
		<div class="tool-info">
			<span class="tool-name">{name}</span>
			<div class="tool-status-row">
				{#if isInstalled}
					<span
						class="tool-status-dot"
						class:dot-active={isRunning}
						class:dot-transition={isTransitioning}
						class:dot-stopped={status === 'stopped'}
					></span>
					<span class="tool-status-label">{statusLabel}</span>
					{#if count !== null && isRunning}
						<span class="tool-count">{count}</span>
					{/if}
				{:else}
					<span class="installation-badge">Not Installed</span>
				{/if}
			</div>
		</div>
	</div>

	{#if !isRunning && description}
		<p class="tool-description">{description}</p>
	{/if}

	{#if isInstalled}
		<div class="tool-actions">
			{#if canOpen}
				{#if externalUrl}
					<a
						class="btn btn-open btn-sm"
						href={externalUrl}
						target="_blank"
						rel="noopener noreferrer">Open</a
					>
				{:else}
					<button class="btn btn-open btn-sm" onclick={() => onOpen?.()}>Open</button>
				{/if}
			{/if}
			{#if showControls}
				{#if isRunning}
					<button
						class="btn btn-danger btn-sm"
						disabled={isTransitioning}
						onclick={() => onStop?.()}>Stop</button
					>
				{:else}
					<button
						class="btn btn-start btn-sm"
						disabled={isTransitioning}
						onclick={() => onStart?.()}>Start</button
					>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	.tool-card {
		padding: var(--space-3);
		background: var(--palantir-bg-elevated);
		border: 1px solid var(--palantir-border-subtle);
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		transition: border-color 0.15s ease;
	}

	.tool-card.running {
		border-color: var(--palantir-border-default);
	}

	.tool-card.not-installed {
		opacity: 0.6;
	}

	.tool-card.not-installed .tool-name {
		color: var(--palantir-text-tertiary);
	}

	.tool-header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.tool-icon {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		color: var(--palantir-text-secondary);
	}

	.tool-card.running .tool-icon {
		color: var(--palantir-accent);
	}

	.tool-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.tool-name {
		font-size: var(--text-sm);
		font-weight: var(--font-weight-medium);
		color: var(--palantir-text-primary);
	}

	.tool-status-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.tool-status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.dot-active {
		background: var(--palantir-success);
		box-shadow: 0 0 4px rgba(74, 222, 128, 0.5);
	}

	.dot-transition {
		background: var(--palantir-warning);
		animation: pulse 1s infinite;
	}

	.dot-stopped {
		background: var(--palantir-text-tertiary);
	}

	.tool-status-label {
		font-size: var(--text-xs);
		color: var(--palantir-text-tertiary);
		letter-spacing: var(--letter-spacing-wide);
	}

	.tool-count {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--palantir-accent);
		font-variant-numeric: tabular-nums;
		margin-left: auto;
	}

	.tool-description {
		font-size: var(--text-xs);
		color: var(--palantir-text-tertiary);
		line-height: 1.4;
		margin: 0;
	}

	.installation-badge {
		font-size: var(--text-xs);
		color: var(--palantir-text-tertiary);
		padding: 2px var(--space-2);
		border: 1px dashed var(--palantir-border-subtle);
		border-radius: var(--radius-sm);
	}

	.tool-actions {
		display: flex;
		gap: 0;
	}

	.tool-actions :global(.btn-sm) {
		padding: var(--space-1) var(--space-2);
	}

	.tool-actions :global(.btn-sm:first-child) {
		padding-left: 0;
	}

	.tool-actions a {
		text-decoration: none;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}
</style>
