<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';

	interface Props {
		whitelistedMACs: string[];
		onAdd: (mac: string) => void;
		onRemove: (mac: string) => void;
	}

	let { whitelistedMACs, onAdd, onRemove }: Props = $props();

	let whitelistInput = $state('');

	function addToWhitelist() {
		const mac = whitelistInput.trim().toUpperCase();
		if (mac && !whitelistedMACs.includes(mac)) {
			onAdd(mac);
			whitelistInput = '';
		}
	}
</script>

<section class="whitelist-section">
	<div class="section-label">WHITELIST ({whitelistedMACs.length})</div>

	<div class="whitelist-input-row">
		<Input
			class="h-7 text-xs flex-1"
			type="text"
			placeholder="MAC address..."
			bind:value={whitelistInput}
			onkeydown={(e) => e.key === 'Enter' && addToWhitelist()}
		/>
		<Button variant="secondary" size="sm" onclick={addToWhitelist}>Add</Button>
	</div>

	{#if whitelistedMACs.length > 0}
		<div class="whitelist-items">
			{#each whitelistedMACs as mac (mac)}
				<div class="whitelist-item">
					<span class="whitelist-mac">{mac}</span>
					<button class="whitelist-remove" onclick={() => onRemove(mac)}>
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<line x1="18" y1="6" x2="6" y2="18" /><line
								x1="6"
								y1="6"
								x2="18"
								y2="18"
							/>
						</svg>
					</button>
				</div>
			{/each}
		</div>
	{/if}
</section>

<style>
	.whitelist-section {
		padding: var(--space-3);
		border-top: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		flex-shrink: 0;
	}

	.section-label {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-widest);
		color: var(--foreground-secondary);
	}

	.whitelist-input-row {
		display: flex;
		gap: var(--space-2);
	}

	.whitelist-items {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.whitelist-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-1) var(--space-2);
		background: var(--surface-elevated);
		border-radius: var(--radius-sm);
	}

	.whitelist-mac {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--foreground);
	}

	.whitelist-remove {
		background: none;
		border: none;
		color: var(--foreground-secondary);
		cursor: pointer;
		padding: 2px;
		display: flex;
		align-items: center;
	}

	.whitelist-remove:hover {
		color: var(--destructive);
	}
</style>
