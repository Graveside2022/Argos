<script lang="ts">
	import type { TakServerConfig } from '$lib/types/tak';

	let { config = $bindable() }: { config: TakServerConfig } = $props();
</script>

<!-- @constitutional-exemption Article-IV-4.2 issue:#12 — No RadioGroup component installed; native radio with bind:group is idiomatic Svelte -->
<div class="rounded-lg border border-border/60 bg-card/40 p-3">
	<span class="mb-2 block text-xs font-semibold tracking-widest text-muted-foreground"
		>AUTHENTICATION</span
	>
	<div class="flex flex-col gap-2">
		<label
			class="flex cursor-pointer flex-row items-center gap-2.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors {config.authMethod ===
			'import'
				? 'border-primary/60 bg-primary/10 text-foreground'
				: 'border-border/40 bg-muted/10 text-muted-foreground hover:bg-muted/30'}"
		>
			<span
				class="flex size-4 shrink-0 items-center justify-center rounded-full border-2 {config.authMethod ===
				'import'
					? 'border-primary'
					: 'border-muted-foreground/50'}"
			>
				{#if config.authMethod === 'import'}<span class="size-2 rounded-full bg-primary"
					></span>{/if}
			</span>
			<input type="radio" bind:group={config.authMethod} value="import" class="sr-only" />
			Import Certificate (.p12)
		</label>
		<label
			class="flex cursor-pointer flex-row items-center gap-2.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors {config.authMethod ===
			'enroll'
				? 'border-primary/60 bg-primary/10 text-foreground'
				: 'border-border/40 bg-muted/10 text-muted-foreground hover:bg-muted/30'}"
		>
			<span
				class="flex size-4 shrink-0 items-center justify-center rounded-full border-2 {config.authMethod ===
				'enroll'
					? 'border-primary'
					: 'border-muted-foreground/50'}"
			>
				{#if config.authMethod === 'enroll'}<span class="size-2 rounded-full bg-primary"
					></span>{/if}
			</span>
			<input type="radio" bind:group={config.authMethod} value="enroll" class="sr-only" />
			Enroll for Certificate
		</label>
	</div>
</div>
