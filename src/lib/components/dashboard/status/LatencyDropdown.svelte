<script lang="ts">
	import type { PingResult } from '$lib/types/network';

	interface Props {
		results: PingResult[];
		loading: boolean;
		onping: () => void;
	}

	let { results, loading, onping }: Props = $props();

	let bestLatency = $derived(
		results.reduce<number | null>((best, r) => {
			if (r.latencyMs === null) return best;
			return best === null ? r.latencyMs : Math.min(best, r.latencyMs);
		}, null)
	);

	let qualityLabel = $derived(
		bestLatency === null
			? 'Unknown'
			: bestLatency < 50
				? 'Excellent'
				: bestLatency < 120
					? 'Good'
					: bestLatency < 300
						? 'Fair'
						: 'Poor'
	);

	let qualityClass = $derived(
		bestLatency === null
			? 'muted'
			: bestLatency < 50
				? 'success'
				: bestLatency < 120
					? 'warn-low'
					: bestLatency < 300
						? 'warn'
						: 'error'
	);

	function statusDotClass(status: PingResult['status']): string {
		if (status === 'ok') return 'success';
		if (status === 'timeout') return 'warn';
		return 'error';
	}

	const nowUtc =
		new Date().getUTCHours().toString().padStart(2, '0') +
		':' +
		new Date().getUTCMinutes().toString().padStart(2, '0') +
		'Z';
</script>

<div class="popup">
	<div class="popup-header">
		<span class="popup-title">NETWORK LATENCY</span>
		<button class="popup-close" onclick={() => {}}>×</button>
	</div>

	<div class="status-row">
		<span class="signal-bars">
			<span class="bar bar-1" class:active={bestLatency !== null}></span>
			<span class="bar bar-2" class:active={bestLatency !== null && bestLatency < 300}></span>
			<span class="bar bar-3" class:active={bestLatency !== null && bestLatency < 120}></span>
			<span class="bar bar-4" class:active={bestLatency !== null && bestLatency < 50}></span>
		</span>
		<span class="status-label">{bestLatency !== null ? 'Connected' : 'No Response'}</span>
		{#if bestLatency !== null}
			<span class="status-value">— {bestLatency}ms</span>
		{/if}
	</div>

	<div class="divider"></div>

	{#each results as result}
		<div class="target-section">
			<div class="target-header">
				<span class="quality-dot {statusDotClass(result.status)}"></span>
				<span class="target-label">{result.label}</span>
				<span class="target-host">{result.target}</span>
			</div>
			<div class="row">
				<span class="key">Latency</span>
				<span class="val"
					>{result.latencyMs !== null ? `${result.latencyMs} ms` : '--'}</span
				>
			</div>
			<div class="row">
				<span class="key">Jitter</span>
				<span class="val">{result.jitterMs !== null ? `${result.jitterMs} ms` : '--'}</span>
			</div>
			<div class="row">
				<span class="key">Packet Loss</span>
				<span class="val">{result.packetLoss}%</span>
			</div>
		</div>
	{:else}
		<div class="row">
			<span class="key">No targets</span>
			<span class="val">--</span>
		</div>
	{/each}

	<div class="divider"></div>

	<div class="footer">
		<span class="quality-dot {qualityClass}"></span>
		<span class="quality-label">{qualityLabel}</span>
		<span class="footer-time">· {nowUtc}</span>
		<button class="action-btn" onclick={onping} disabled={loading}>
			{loading ? '⟳ Pinging...' : '↺ Ping'}
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

	.popup-close {
		background: none;
		border: none;
		color: var(--muted-foreground);
		cursor: pointer;
		font-size: 14px;
		padding: 0;
		line-height: 1;
	}

	.status-row {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--foreground);
	}

	.signal-bars {
		display: flex;
		align-items: flex-end;
		gap: 1px;
		height: 12px;
	}

	.bar {
		width: 3px;
		border-radius: 1px;
		background: var(--text-inactive);
	}

	.bar-1 {
		height: 4px;
	}
	.bar-2 {
		height: 6px;
	}
	.bar-3 {
		height: 9px;
	}
	.bar-4 {
		height: 12px;
	}

	.bar.active {
		background: var(--success);
	}

	.status-label {
		color: var(--muted-foreground);
	}

	.status-value {
		color: var(--foreground);
		margin-left: auto;
	}

	.divider {
		height: 1px;
		background: var(--border);
		margin: 2px 0;
	}

	.target-section {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: 4px 0;
	}

	.target-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 2px;
	}

	.target-label {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
		color: var(--foreground);
	}

	.target-host {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--muted-foreground);
		margin-left: auto;
	}

	.row {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding-left: 12px;
	}

	.key {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--muted-foreground);
	}

	.val {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--foreground);
	}

	.footer {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 2px;
	}

	.quality-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.quality-dot.success {
		background: var(--success);
	}
	.quality-dot.warn-low {
		background: var(--warning);
	}
	.quality-dot.warn {
		background: var(--warning);
	}
	.quality-dot.error {
		background: var(--destructive);
	}
	.quality-dot.muted {
		background: var(--text-inactive);
	}

	.quality-label {
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
