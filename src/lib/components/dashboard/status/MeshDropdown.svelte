<script lang="ts">
	import type { TakServer } from '$lib/types/network';

	interface Props {
		takServers: TakServer[];
		loading: boolean;
		onrefresh: () => void;
	}

	let { takServers, loading, onrefresh }: Props = $props();

	function formatUptime(ms: number | undefined): string {
		if (!ms) return '\u2014';
		const totalSec = Math.round(ms / 1000);
		if (totalSec < 60) return `${totalSec}s`;
		const mins = Math.round(totalSec / 60);
		if (mins < 60) return `${mins}m`;
		const hours = Math.round(mins / 60);
		return `${hours}h`;
	}
</script>

<div class="popup">
	<div class="popup-header">
		<span class="popup-title">NODE MESH</span>
		<button class="refresh-btn" onclick={onrefresh} disabled={loading}>
			{loading ? '...' : '\u21BA'}
		</button>
	</div>

	{#if takServers.length === 0}
		<div class="empty-text">No TAK server configured</div>
	{/if}

	{#each takServers as server}
		<div class="server-block">
			<div class="server-row">
				<span
					class="server-dot"
					class:active={server.connected}
					class:inactive={!server.connected}
				></span>
				<span class="server-name">{server.name}</span>
			</div>
			<div class="detail-grid">
				<span class="key">Host</span>
				<span class="val">{server.host}:{server.port}</span>
				<span class="key">Status</span>
				<span class="val" class:val-ok={server.connected} class:val-err={!server.connected}>
					{server.connected ? 'CONNECTED' : 'DISCONNECTED'}
				</span>
				<span class="key">Uptime</span>
				<span class="val">{formatUptime(server.uptime)}</span>
				<span class="key">CoT Msgs</span>
				<span class="val">{server.messageCount ?? 0}</span>
			</div>
		</div>
	{/each}
</div>

<style>
	.popup {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		min-width: 240px;
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 12px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
		z-index: 200;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.popup-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
	}

	.popup-title {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 1.2px;
		color: var(--muted-foreground);
	}

	.refresh-btn {
		background: none;
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--foreground);
		font-family: var(--font-mono);
		font-size: 12px;
		padding: 1px 6px;
		cursor: pointer;
		line-height: 1;
	}

	.refresh-btn:hover {
		background: var(--surface-hover);
	}

	.refresh-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.empty-text {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-inactive);
		padding: 2px 0;
	}

	.server-block {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 4px 0;
	}

	.server-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.server-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.server-dot.active {
		background: var(--success);
	}

	.server-dot.inactive {
		background: var(--destructive);
	}

	.server-name {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
		color: var(--foreground);
	}

	.detail-grid {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 3px 12px;
		padding-left: 12px;
	}

	.key {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--muted-foreground);
	}

	.val {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--foreground);
	}

	.val-ok {
		color: var(--success);
	}

	.val-err {
		color: var(--destructive);
	}
</style>
