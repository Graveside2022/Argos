<script lang="ts">
	interface Props {
		connected?: boolean;
		latency?: number;
		jitter?: number;
		packetLoss?: number;
		serverLatency?: number;
		lastPinged?: string;
		onclose?: () => void;
		onping?: () => void;
	}

	let {
		connected = false,
		latency = 0,
		jitter = 0,
		packetLoss = 0,
		serverLatency,
		lastPinged = '',
		onclose,
		onping
	}: Props = $props();

	let qualityLabel = $derived(
		latency < 50 ? 'Excellent' : latency < 100 ? 'Good' : latency < 200 ? 'Fair' : 'Poor'
	);

	let latencyPercent = $derived(Math.min(100, (latency / 500) * 100));
</script>

<div class="widget">
	<div class="widget-header">
		<span class="widget-label">NETWORK LATENCY</span>
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
		<div
			class="source-row"
			style="color: var({connected ? '--status-healthy' : '--status-error-muted'});"
		>
			{connected ? 'Connected' : 'Disconnected'} — {serverLatency ?? latency}ms
		</div>

		<div class="metric-block">
			<div class="metric-row">
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
					<path d="M2 20h.01" /><path d="M7 20v-4" /><path d="M12 20v-8" /><path
						d="M17 20V8"
					/>
				</svg>
				<span class="metric-label">LATENCY</span>
				<span class="spacer"></span>
				<span class="metric-value">{latency}ms</span>
			</div>
			<div class="progress-track">
				<div
					class="progress-fill"
					style="width: {latencyPercent}%; background: var(--primary);"
				></div>
			</div>
		</div>

		<div class="kv-row">
			<span class="kv-label">Jitter</span>
			<span class="kv-value">{jitter}ms</span>
		</div>
		<div class="kv-row">
			<span class="kv-label">Packet Loss</span>
			<span class="kv-value">{packetLoss}%</span>
		</div>
	</div>

	<div class="widget-footer">
		<span
			class="status-dot"
			class:healthy={latency < 100}
			class:warning={latency >= 100 && latency < 200}
		></span>
		<span class="status-label">{qualityLabel}</span>
		<span class="timestamp">{lastPinged || '—'}</span>
		<span class="spacer"></span>
		{#if onping}
			<button class="widget-action" onclick={onping}>
				<svg
					width="10"
					height="10"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M2 20h.01" /><path d="M7 20v-4" /><path d="M12 20v-8" /><path
						d="M17 20V8"
					/>
				</svg>
				Ping
			</button>
		{/if}
	</div>
</div>

<style>
	@import './widget.css';
</style>
