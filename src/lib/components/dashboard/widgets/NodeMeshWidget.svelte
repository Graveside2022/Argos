<script lang="ts">
	interface TakServer {
		name: string;
		status: 'online' | 'offline';
		port: number;
		latency?: number;
		clients?: number;
		tls?: boolean;
	}

	interface MeshPeer {
		callsign: string;
		latency?: number;
		status: 'online' | 'offline';
	}

	interface Props {
		connectedNodes?: number;
		totalNodes?: number;
		takServers?: TakServer[];
		peers?: MeshPeer[];
		onclose?: () => void;
	}

	let {
		connectedNodes = 0,
		totalNodes = 0,
		takServers = [],
		peers = [],
		onclose
	}: Props = $props();

	let meshStatus = $derived(
		connectedNodes === totalNodes && totalNodes > 0 ? 'Mesh OK' : 'Degraded'
	);
</script>

<div class="widget">
	<div class="widget-header">
		<span class="widget-label">NODE MESH</span>
		<span class="node-count">{connectedNodes}/{totalNodes}</span>
		<span class="spacer"></span>
		{#if onclose}
			<button class="widget-close" onclick={onclose}>
				<svg
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		{/if}
	</div>

	<div class="widget-content">
		<!-- TAK Servers Section -->
		<div class="section-row">
			<svg
				width="12"
				height="12"
				viewBox="0 0 24 24"
				fill="none"
				stroke="var(--primary)"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
				<path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4" />
				<circle cx="12" cy="12" r="2" />
				<path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.4" />
				<path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
			</svg>
			<span class="section-title">TAK Servers</span>
		</div>

		{#if takServers.length === 0}
			<span class="empty-text">No servers configured</span>
		{:else}
			{#each takServers as server (server.name)}
				<div class="server-row">
					<span class="status-dot" class:healthy={server.status === 'online'}></span>
					<span class="server-name">{server.name}</span>
					<span class="server-detail">:{server.port}</span>
					{#if server.latency !== undefined}
						<span class="server-detail">{server.latency}ms</span>
					{/if}
					{#if server.tls}
						<span class="tls-badge">TLS</span>
					{/if}
				</div>
			{/each}
		{/if}

		<div class="widget-divider"></div>

		<!-- Peer Mesh Section -->
		<div class="section-row">
			<svg
				width="12"
				height="12"
				viewBox="0 0 24 24"
				fill="none"
				stroke="var(--foreground-secondary, #888888)"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
				<rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
				<line x1="6" y1="6" x2="6.01" y2="6" />
				<line x1="6" y1="18" x2="6.01" y2="18" />
			</svg>
			<span class="section-title">Peer Mesh</span>
		</div>

		{#if peers.length === 0}
			<span class="empty-text">No peers detected</span>
		{:else}
			{#each peers as peer (peer.callsign)}
				<div class="server-row">
					<span class="status-dot" class:healthy={peer.status === 'online'}></span>
					<span class="server-name">{peer.callsign}</span>
					{#if peer.latency !== undefined}
						<span class="server-detail">{peer.latency}ms</span>
					{:else if peer.status === 'offline'}
						<span class="offline-label">OFFLINE</span>
					{/if}
				</div>
			{/each}
		{/if}
	</div>

	<div class="widget-footer">
		<span
			class="status-dot"
			class:healthy={meshStatus === 'Mesh OK'}
			class:warning={meshStatus === 'Degraded'}
		></span>
		<span class="status-label">{meshStatus}</span>
		<span class="spacer"></span>
	</div>
</div>

<style>
	@import './widget.css';

	.node-count {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: var(--text-status, 10px);
		color: var(--foreground-secondary, #888888);
	}

	.section-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.section-title {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--foreground-secondary, #888888);
	}

	.server-row {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 2px 0;
	}

	.server-name {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: var(--text-status, 10px);
		color: var(--foreground);
	}

	.server-detail {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: var(--text-status, 10px);
		color: var(--foreground-tertiary, #999999);
	}

	.tls-badge {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 8px;
		font-weight: 600;
		color: var(--status-healthy, #8bbfa0);
		border: 1px solid var(--status-healthy, #8bbfa0);
		border-radius: 2px;
		padding: 0 3px;
		letter-spacing: 0.5px;
	}

	.offline-label {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 9px;
		font-weight: 600;
		color: var(--status-error-muted, #c45b4a);
		letter-spacing: 0.5px;
	}

	.empty-text {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: var(--text-status, 10px);
		color: var(--foreground-tertiary, #999999);
		padding: 2px 0;
	}
</style>
