<script lang="ts">
	interface Props {
		temperature?: number;
		conditions?: string;
		windSpeed?: number;
		windDirection?: string;
		humidity?: number;
		visibility?: number;
		sunrise?: string;
		sunset?: string;
		onclose?: () => void;
		onrefresh?: () => void;
	}

	let {
		temperature,
		conditions = '—',
		windSpeed,
		windDirection = '',
		humidity,
		visibility,
		sunrise = '',
		sunset = '',
		onclose,
		onrefresh
	}: Props = $props();
</script>

<div class="widget">
	<div class="widget-header">
		<span class="widget-label">WEATHER</span>
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
				<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
				<circle cx="12" cy="10" r="3" />
			</svg>
			Open-Meteo — Local GPS
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
					<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
				</svg>
				<span class="metric-label">TEMPERATURE</span>
				<span class="spacer"></span>
				<span class="metric-value"
					>{temperature !== undefined ? `${temperature}°C` : '—'}</span
				>
			</div>
		</div>

		<div class="kv-row">
			<span class="kv-label">Conditions</span>
			<span class="kv-value">{conditions}</span>
		</div>
		<div class="kv-row">
			<span class="kv-label">Wind</span>
			<span class="kv-value"
				>{windSpeed !== undefined ? `${windSpeed} km/h ${windDirection}` : '—'}</span
			>
		</div>
		<div class="kv-row">
			<span class="kv-label">Humidity</span>
			<span class="kv-value">{humidity !== undefined ? `${humidity}%` : '—'}</span>
		</div>
		<div class="kv-row">
			<span class="kv-label">Visibility</span>
			<span class="kv-value">{visibility !== undefined ? `${visibility} km` : '—'}</span>
		</div>
	</div>

	<div class="widget-footer">
		<svg
			width="10"
			height="10"
			viewBox="0 0 24 24"
			fill="none"
			stroke="var(--status-warning, #d4a054)"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<circle cx="12" cy="12" r="5" />
			<line x1="12" y1="1" x2="12" y2="3" />
			<line x1="12" y1="21" x2="12" y2="23" />
			<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
			<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
			<line x1="1" y1="12" x2="3" y2="12" />
			<line x1="21" y1="12" x2="23" y2="12" />
			<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
			<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
		</svg>
		<span class="status-label">{sunrise || '—'}</span>
		<span class="timestamp">{sunset || '—'}</span>
		<span class="spacer"></span>
		{#if onrefresh}
			<button class="widget-action" onclick={onrefresh}>
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
				Refresh
			</button>
		{/if}
	</div>
</div>

<style>
	@import './widget.css';
</style>
