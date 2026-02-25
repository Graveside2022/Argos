<script lang="ts">
	import type { TakStatus } from '$lib/types/tak';

	interface Props {
		takStatus: TakStatus;
	}

	let { takStatus }: Props = $props();

	const nowUtc = new Date().toISOString().slice(11, 16) + 'Z';

	let isConnected = $derived(takStatus.status === 'connected');
	let serverName = $derived(takStatus.serverName ?? 'TAK PRIMARY');
	let serverHost = $derived(takStatus.serverHost ?? '—');
</script>

<div class="popup">
	<div class="popup-header">
		<span class="popup-title">NODE MESH</span>
		<span class="count-badge">{isConnected ? '1 / 1' : '0 / 1'}</span>
		<button class="popup-close" onclick={() => {}}>×</button>
	</div>

	<div class="section-label">⟡ TAK SERVERS</div>

	<div class="server-block">
		<div class="server-row">
			<span class="server-dot" class:active={isConnected} class:inactive={!isConnected}
			></span>
			<span class="server-name">{serverName}</span>
			<span class="server-port"
				>{serverHost.includes(':') ? serverHost : `${serverHost}:8089`}</span
			>
		</div>
		<div class="server-meta">
			<span class="meta-val"
				>{takStatus.uptime ? `${Math.round(takStatus.uptime / 1000)}ms` : '—'}</span
			>
			<span class="meta-sep">·</span>
			<span class="meta-val">{takStatus.messageCount ?? 0} clients</span>
			<span class="meta-sep">·</span>
			<span class="meta-tag">TLS</span>
		</div>
	</div>

	<div class="divider"></div>

	<div class="section-label">⟡ PEER MESH</div>

	{#if isConnected}
		<div class="peer-row">
			<span class="peer-dot active"></span>
			<span class="peer-name">ARGOS-1</span>
			<span class="peer-latency">local</span>
		</div>
	{:else}
		<div class="peer-row muted">
			<span class="peer-dot inactive"></span>
			<span class="peer-name">No peers</span>
			<span class="peer-latency">OFFLINE</span>
		</div>
	{/if}

	<div class="divider"></div>

	<div class="footer">
		<span class="mesh-status-dot" class:active={isConnected}></span>
		<span class="footer-label">{isConnected ? 'Mesh OK' : 'Mesh Down'}</span>
		<span class="footer-time">– {nowUtc}</span>
		<button class="action-btn">↺ Refresh</button>
	</div>
</div>

<style>
	.popup {
		position: absolute;
		bottom: calc(100% + 6px);
		right: 0;
		min-width: 260px;
		background: var(--card, #1a1a1a);
		border: 1px solid var(--border, #2e2e2e);
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
		background: var(--success, #8bbfa0);
	}

	.server-dot.inactive {
		background: var(--muted-foreground, #555);
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
		color: var(--border, #2e2e2e);
		font-size: 10px;
	}

	.meta-tag {
		font-family: var(--font-mono);
		font-size: 9px;
		color: var(--primary, #a8b8e0);
		letter-spacing: 0.5px;
	}

	.divider {
		height: 1px;
		background: var(--border, #2e2e2e);
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
		background: var(--success, #8bbfa0);
	}

	.peer-dot.inactive {
		background: var(--muted-foreground, #555);
	}

	.peer-name {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--foreground);
	}

	.peer-latency {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--muted-foreground);
		margin-left: auto;
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
		background: var(--muted-foreground, #555);
	}

	.mesh-status-dot.active {
		background: var(--success, #8bbfa0);
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
		border: 1px solid var(--border, #2e2e2e);
		border-radius: 4px;
		color: var(--foreground);
		font-family: var(--font-mono);
		font-size: 10px;
		padding: 2px 8px;
		cursor: pointer;
	}

	.action-btn:hover {
		background: var(--surface-hover, #2a2a2a);
	}
</style>
