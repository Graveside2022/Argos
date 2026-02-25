<script lang="ts">
	interface Props {
		serverName?: string;
		downloadSpeed?: number;
		uploadSpeed?: number;
		downloadProgress?: number;
		uploadProgress?: number;
		lastTested?: string;
		onclose?: () => void;
		onretest?: () => void;
	}

	let {
		serverName = 'N/A',
		downloadSpeed = 0,
		uploadSpeed = 0,
		downloadProgress = 0,
		uploadProgress = 0,
		lastTested = '',
		onclose,
		onretest
	}: Props = $props();
</script>

<div class="widget">
	<div class="widget-header">
		<span class="widget-label">SPEED TEST</span>
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
		<div class="source-row">
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
				<circle cx="12" cy="12" r="2" /><path
					d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"
				/>
			</svg>
			{serverName}
		</div>

		<div class="metric-block">
			<div class="metric-row">
				<svg
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="var(--status-healthy, #8bbfa0)"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
				</svg>
				<span class="metric-label">DOWNLOAD</span>
				<span class="spacer"></span>
				<span class="metric-value">{downloadSpeed.toFixed(1)} Mbps</span>
			</div>
			<div class="progress-track">
				<div
					class="progress-fill"
					style="width: {downloadProgress}%; background: var(--status-healthy, #8bbfa0);"
				></div>
			</div>
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
					<line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
				</svg>
				<span class="metric-label">UPLOAD</span>
				<span class="spacer"></span>
				<span class="metric-value">{uploadSpeed.toFixed(1)} Mbps</span>
			</div>
			<div class="progress-track">
				<div
					class="progress-fill"
					style="width: {uploadProgress}%; background: var(--primary);"
				></div>
			</div>
		</div>
	</div>

	<div class="widget-footer">
		<span class="status-dot healthy"></span>
		<span class="status-label">Last test</span>
		<span class="timestamp">{lastTested || '—'}</span>
		<span class="spacer"></span>
		{#if onretest}
			<button class="widget-action" onclick={onretest}>
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
					<polyline points="1 4 1 10 7 10" /><path
						d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"
					/>
				</svg>
				Retest
			</button>
		{/if}
	</div>
</div>

<style>
	@import './widget.css';
</style>
