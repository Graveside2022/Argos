<script lang="ts">
	import { activeView } from '$lib/stores/dashboard/dashboard-store';
	import { takStatus } from '$lib/stores/tak-store';

	let isOpen = $state(false);

	function toggle() {
		isOpen = !isOpen;
	}

	function configure() {
		isOpen = false;
		activeView.set('tak-config');
	}

	function formatUptime(seconds: number | undefined): string {
		if (!seconds) return '—';
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		if (h > 0) return `${h}h ${m}m`;
		return `${m}m`;
	}
</script>

<svelte:window
	onclick={(e) => {
		if (isOpen && !(e.target as HTMLElement)?.closest('.tak-indicator-wrapper')) {
			isOpen = false;
		}
	}}
/>

<div class="tak-indicator-wrapper">
	<button class="tak-indicator" onclick={toggle}>
		<span
			class="tak-dot"
			class:connected={$takStatus.status === 'connected'}
			class:error={$takStatus.status === 'error'}
		></span>
		<span class="tak-label">TAK</span>
	</button>

	{#if isOpen}
		<div class="tak-dropdown">
			<div class="dropdown-title">TAK SERVER</div>
			{#if $takStatus.status === 'connected'}
				<div class="dropdown-row">
					<span class="dropdown-key">Server</span>
					<span class="dropdown-val">{$takStatus.serverName ?? 'TAK Server'}</span>
				</div>
				<div class="dropdown-row">
					<span class="dropdown-key">Address</span>
					<span class="dropdown-val">{$takStatus.serverHost ?? '—'}</span>
				</div>
				<div class="dropdown-row">
					<span class="dropdown-key">Uptime</span>
					<span class="dropdown-val">{formatUptime($takStatus.uptime)}</span>
				</div>
				<div class="dropdown-row">
					<span class="dropdown-key">Messages</span>
					<span class="dropdown-val">{$takStatus.messageCount ?? 0}</span>
				</div>
			{:else}
				<div class="dropdown-row">
					<span class="dropdown-val dim">Not connected</span>
				</div>
				<button class="configure-btn" onclick={configure}>Configure</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.tak-indicator-wrapper {
		position: relative;
	}
	.tak-indicator {
		display: flex;
		align-items: center;
		gap: 5px;
		background: none;
		border: none;
		cursor: pointer;
		padding: 2px 6px;
		border-radius: 4px;
		color: var(--palantir-text-secondary);
		font-size: 11px;
	}
	.tak-indicator:hover {
		background: var(--palantir-bg-hover, rgba(255, 255, 255, 0.04));
	}
	.tak-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--palantir-text-tertiary);
		flex-shrink: 0;
	}
	.tak-dot.connected {
		background: var(--palantir-success, #10b981);
		box-shadow: 0 0 5px var(--palantir-success, #10b981);
	}
	.tak-dot.error {
		background: var(--palantir-error, #ef4444);
	}
	.tak-label {
		font-weight: 600;
		letter-spacing: 0.05em;
	}
	.tak-dropdown {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		width: 200px;
		background: var(--palantir-bg-surface, #161b22);
		border: 1px solid var(--palantir-border-default, #30363d);
		border-radius: 6px;
		padding: 8px 0;
		z-index: 50;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
	}
	.dropdown-title {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.1em;
		color: var(--palantir-text-tertiary);
		padding: 4px 12px 8px;
	}
	.dropdown-row {
		display: flex;
		justify-content: space-between;
		padding: 3px 12px;
		font-size: 11px;
	}
	.dropdown-key {
		color: var(--palantir-text-tertiary);
	}
	.dropdown-val {
		color: var(--palantir-text-primary);
		font-weight: 500;
	}
	.dropdown-val.dim {
		color: var(--palantir-text-tertiary);
		font-style: italic;
	}
	.configure-btn {
		display: block;
		width: calc(100% - 24px);
		margin: 8px 12px 4px;
		padding: 4px 0;
		font-size: 11px;
		font-weight: 500;
		color: var(--palantir-accent, #4a9eff);
		background: transparent;
		border: 1px solid var(--palantir-accent, #4a9eff);
		border-radius: 4px;
		cursor: pointer;
	}
	.configure-btn:hover {
		background: rgba(74, 158, 255, 0.1);
	}
</style>
