<script lang="ts">
	const COLORMAPS = [
		{
			id: 'RAINBOW.dBm',
			label: 'Rainbow',
			gradient: 'linear-gradient(90deg, blue, cyan, green, yellow, red)'
		},
		{
			id: 'GREYSCALE.dBm',
			label: 'Greyscale',
			gradient: 'linear-gradient(90deg, #222, #aaa, #fff)'
		},
		{
			id: 'HEAT.dBm',
			label: 'Heat',
			gradient: 'linear-gradient(90deg, #000, #800, #f00, #ff0, #fff)'
		},
		{
			id: 'LTE.dBm',
			label: 'LTE',
			gradient: 'linear-gradient(90deg, #d00, #f80, #ff0, #0c0, #080)'
		},
		{
			id: 'MBPS.dBm',
			label: 'Mbps',
			gradient: 'linear-gradient(90deg, #00f, #0cf, #0f0, #ff0, #f00)'
		},
		{
			id: 'RdYlGn_r.dBm',
			label: 'Red-Ylw-Grn',
			gradient: 'linear-gradient(90deg, #1a9641, #a6d96a, #ffffbf, #fdae61, #d7191c)'
		},
		{
			id: 'CLOUD_35.dBm',
			label: 'Cloud 35',
			gradient: 'linear-gradient(90deg, #1b2a49, #3567a0, #5ba55f, #f0e443, #f04040)'
		}
	] as const;

	let { value, onchange }: { value: string; onchange: (name: string) => void } = $props();
</script>

<div class="colormap-selector">
	<div class="section-label">COLORMAP</div>
	<div class="options">
		{#each COLORMAPS as cm (cm.id)}
			<button class="cm-btn" class:selected={value === cm.id} onclick={() => onchange(cm.id)}>
				<span class="swatch" style="background: {cm.gradient}"></span>
				<span class="cm-name">{cm.label}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.colormap-selector {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.section-label {
		font-family: 'Fira Code', monospace;
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 1.2px;
		color: var(--foreground-secondary);
		margin-bottom: 2px;
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.cm-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 28px;
		padding: 0 8px;
		background: transparent;
		border: none;
		border-left: 2px solid transparent;
		cursor: pointer;
		border-radius: 2px;
		transition:
			background 0.15s,
			border-color 0.15s;
	}

	.cm-btn:hover {
		background: var(--surface-hover);
	}

	.cm-btn.selected {
		border-left-color: var(--primary);
	}

	.swatch {
		width: 20px;
		height: 12px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.cm-name {
		font-family: 'Fira Code', monospace;
		font-size: 10px;
		color: var(--foreground);
	}
</style>
