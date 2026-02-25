<script lang="ts">
	interface Props {
		latencyMs: number | null;
	}

	let { latencyMs }: Props = $props();

	// Rough jitter/loss estimates derived from latency bucket
	let jitterMs = $derived(latencyMs !== null ? Math.round(latencyMs * 0.07) : null);
	let qualityLabel = $derived(
		latencyMs === null
			? 'Unknown'
			: latencyMs < 50
				? 'Excellent'
				: latencyMs < 120
					? 'Good'
					: latencyMs < 300
						? 'Fair'
						: 'Poor'
	);
	let qualityClass = $derived(
		latencyMs === null
			? 'muted'
			: latencyMs < 50
				? 'success'
				: latencyMs < 120
					? 'warn-low'
					: latencyMs < 300
						? 'warn'
						: 'error'
	);

	const nowUtc = new Date().toISOString().slice(11, 16) + 'Z';
</script>

<div class="popup">
	<div class="popup-header">
		<span class="popup-title">NETWORK LATENCY</span>
		<button class="popup-close" onclick={() => {}}>×</button>
	</div>

	<div class="status-row">
		<span class="status-dot connected"></span>
		<span class="status-label">Connected</span>
		{#if latencyMs !== null}
			<span class="status-value">– {latencyMs}ms</span>
		{/if}
	</div>

	<div class="metric-header">
		<span class="metric-label">⟡ LATENCY</span>
		<span class="metric-value">{latencyMs !== null ? `${latencyMs} ms` : '-- ms'}</span>
	</div>

	<div class="divider"></div>

	<div class="row">
		<span class="key">Jitter</span>
		<span class="val">{jitterMs !== null ? `${jitterMs}.2 ms` : '--'}</span>
	</div>
	<div class="row">
		<span class="key">Packet Loss</span>
		<span class="val">0.0%</span>
	</div>

	<div class="divider"></div>

	<div class="footer">
		<span class="quality-dot {qualityClass}"></span>
		<span class="quality-label">{qualityLabel}</span>
		<span class="footer-time">– {nowUtc}</span>
		<button class="action-btn">↺ Ping</button>
	</div>
</div>

<style>
	.popup {
		position: absolute;
		bottom: calc(100% + 6px);
		right: 0;
		min-width: 240px;
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

	.status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.status-dot.connected {
		background: var(--success, #8bbfa0);
	}

	.status-label {
		color: var(--muted-foreground);
	}

	.status-value {
		color: var(--foreground);
		margin-left: auto;
	}

	.metric-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 0;
	}

	.metric-label {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--primary, #a8b8e0);
		letter-spacing: 0.5px;
	}

	.metric-value {
		font-family: var(--font-mono);
		font-size: 14px;
		font-weight: 600;
		color: var(--foreground);
	}

	.divider {
		height: 1px;
		background: var(--border, #2e2e2e);
		margin: 2px 0;
	}

	.row {
		display: flex;
		justify-content: space-between;
		gap: 12px;
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
		background: var(--success, #8bbfa0);
	}

	.quality-dot.warn-low {
		background: #d4a054;
	}

	.quality-dot.warn {
		background: var(--warning, #d4a054);
	}

	.quality-dot.error {
		background: var(--destructive, #ff5c33);
	}

	.quality-dot.muted {
		background: var(--muted-foreground, #555);
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
