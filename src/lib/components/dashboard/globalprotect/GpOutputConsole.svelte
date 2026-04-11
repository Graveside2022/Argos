<script lang="ts">
	import { gpOutput } from '$lib/stores/globalprotect-store';

	let consoleEl: HTMLDivElement | undefined = $state();

	$effect(() => {
		if ($gpOutput.length && consoleEl) {
			consoleEl.scrollTop = consoleEl.scrollHeight;
		}
	});
</script>

<div class="flex h-full flex-col rounded-lg border border-border/60 bg-card/40 p-3">
	<span class="mb-2 block text-base font-semibold tracking-widest text-muted-foreground"
		>CONSOLE</span
	>
	<div
		bind:this={consoleEl}
		class="flex-1 overflow-y-auto rounded-md border border-border/30 bg-black/40 p-3 font-mono text-sm leading-relaxed text-muted-foreground"
	>
		{#if $gpOutput.length === 0}
			<span class="italic text-muted-foreground/50"
				>No output — connect to see openconnect logs</span
			>
		{:else}
			{#each $gpOutput as line}
				<div
					class:text-green-400={line.toLowerCase().includes('connected')}
					class:text-red-400={line.toLowerCase().includes('error') ||
						line.toLowerCase().includes('failed')}
					class:text-yellow-400={line.toLowerCase().includes('warning') ||
						line.toLowerCase().includes('dtls')}
				>
					{line}
				</div>
			{/each}
		{/if}
	</div>
</div>
