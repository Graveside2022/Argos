<script lang="ts">
	import type { TailscalePeer, TakServer } from '$lib/types/network';

	interface Props {
		takServers: TakServer[];
		peers: TailscalePeer[];
		selfHostname: string;
		loading: boolean;
		onrefresh: () => void;
	}

	let { takServers, peers, selfHostname, loading, onrefresh }: Props = $props();

	let onlinePeers = $derived(peers.filter((p) => p.online).length);
	let totalPeers = $derived(peers.length);
	let hasTakConnection = $derived(takServers.some((s) => s.connected));
	let meshOk = $derived(onlinePeers > 0 || hasTakConnection);
	let nowUtc = $derived(new Date().toISOString().slice(11, 16) + 'Z');

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
		<span class="count-badge">{onlinePeers} / {totalPeers}</span>
		<button class="popup-close" onclick={() => {}}>×</button>
	</div>

	<div class="section-label">TAK SERVERS</div>

	{#if takServers.length === 0}
		<div class="empty-text">No TAK servers configured</div>
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
				<span class="server-port">:{server.port}</span>
			</div>
			<div class="server-meta">
				<span class="meta-val">{formatUptime(server.uptime)}</span>
				<span class="meta-sep">·</span>
				<span class="meta-val">{server.messageCount ?? 0} msgs</span>
				{#if server.tls}
					<span class="meta-sep">·</span>
					<span class="meta-tag">TLS</span>
				{/if}
				{#if server.connectionHealth}
					<span class="meta-sep">·</span>
					<span class="meta-val">{server.connectionHealth}</span>
				{/if}
			</div>
		</div>
	{/each}

	<div class="divider"></div>

	<div class="section-label">PEER MESH</div>

	{#if peers.length === 0}
		<div class="empty-text">No Tailscale peers found</div>
	{/if}

	{#each peers as peer}
		<div class="peer-row" class:muted={!peer.online}>
			<span class="peer-dot" class:active={peer.online} class:inactive={!peer.online}></span>
			<span
				class="peer-name"
				class:self-host={peer.name.toLowerCase() === selfHostname.toLowerCase()}
			>
				{peer.name.toUpperCase()}
			</span>
			<span
				class="peer-status"
				class:status-online={peer.online}
				class:status-offline={!peer.online}
			>
				{peer.online ? 'ONLINE' : 'OFFLINE'}
			</span>
		</div>
	{/each}

	<div class="divider"></div>

	<div class="footer">
		<span class="mesh-status-dot" class:active={meshOk}></span>
		<span class="footer-label">{meshOk ? 'Mesh OK' : 'Mesh Down'}</span>
		<span class="footer-time">· {nowUtc}</span>
		<button class="action-btn" onclick={onrefresh} disabled={loading}>
			{loading ? '...' : 'Refresh'}
		</button>
	</div>
</div>

<style>
	.popup {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		min-width: 260px;
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
		align-items: center;
		gap: 8px;
		margin-bottom: 4px;
	}

	.popup-title {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 1.2px;
		color: var(--muted-foreground);
	}

	.count-badge {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--foreground);
		margin-left: 4px;
	}

	.popup-close {
		background: none;
		border: none;
		color: var(--muted-foreground);
		cursor: pointer;
		font-size: 14px;
		padding: 0;
		line-height: 1;
		margin-left: auto;
	}

	.section-label {
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 1.2px;
		color: var(--muted-foreground);
		text-transform: uppercase;
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
		gap: 3px;
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
		background: var(--text-inactive);
	}

	.server-name {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
		color: var(--foreground);
	}

	.server-port {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--muted-foreground);
		margin-left: auto;
	}

	.server-meta {
		display: flex;
		align-items: center;
		gap: 4px;
		padding-left: 12px;
	}

	.meta-val {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--muted-foreground);
	}

	.meta-sep {
		color: var(--text-inactive);
		font-size: 10px;
	}

	.meta-tag {
		font-family: var(--font-mono);
		font-size: 9px;
		color: var(--primary);
		letter-spacing: 0.5px;
	}

	.divider {
		height: 1px;
		background: var(--border);
		margin: 2px 0;
	}

	.peer-row {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 2px 0;
	}

	.peer-row.muted {
		opacity: 0.6;
	}

	.peer-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.peer-dot.active {
		background: var(--success);
	}

	.peer-dot.inactive {
		background: var(--text-inactive);
	}

	.peer-name {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--foreground);
	}

	.peer-name.self-host {
		color: var(--primary);
		font-weight: 600;
	}

	.peer-status {
		font-family: var(--font-mono);
		font-size: 10px;
		margin-left: auto;
	}

	.peer-status.status-online {
		color: var(--success);
	}

	.peer-status.status-offline {
		color: var(--destructive);
		font-weight: 600;
	}

	.footer {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 2px;
	}

	.mesh-status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
		background: var(--text-inactive);
	}

	.mesh-status-dot.active {
		background: var(--success);
	}

	.footer-label {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--foreground);
	}

	.footer-time {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--muted-foreground);
		margin-left: auto;
	}

	.action-btn {
		background: none;
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--foreground);
		font-family: var(--font-mono);
		font-size: 10px;
		padding: 2px 8px;
		cursor: pointer;
	}

	.action-btn:hover {
		background: var(--surface-hover);
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
