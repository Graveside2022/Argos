<script lang="ts">
	interface WifiInterface {
		name: string;
		ip: string;
		mac: string;
	}

	interface Props {
		interfaces: WifiInterface[];
	}

	let { interfaces }: Props = $props();
</script>

{#if interfaces.length > 0}
	<section class="panel-section">
		<div class="section-label">WIFI INTERFACES</div>
		{#each interfaces as iface (iface.name)}
			<div class="iface-row">
				<span class="iface-name">{iface.name}</span>
				<span class="iface-mac mono">{iface.mac}</span>
			</div>
		{/each}
	</section>
{/if}

<style>
	.panel-section {
		padding: var(--space-4);
		border-bottom: 1px solid var(--palantir-border-subtle);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.section-label {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-widest);
		color: var(--palantir-text-tertiary);
	}

	.iface-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-1) var(--space-2);
		background: var(--palantir-bg-elevated);
		border-radius: var(--radius-sm);
	}

	.iface-name {
		font-size: var(--text-sm);
		color: var(--palantir-text-primary);
	}

	.iface-mac {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--palantir-text-tertiary);
	}
</style>
