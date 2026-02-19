<script lang="ts">
	import Badge from '$lib/components/ui/badge/badge.svelte';

	let { scanProgress = [], isScanning = false }: { scanProgress: string[]; isScanning: boolean } =
		$props();
</script>

<div class="my-4 border-2 border-border rounded-lg overflow-hidden shadow-lg">
	<div class="console-header">
		<span class="text-base font-semibold text-foreground uppercase tracking-wide">CONSOLE</span>
		{#if isScanning}
			<Badge variant="outline" class="text-yellow-400 border-yellow-400/30 animate-pulse"
				>SCANNING...</Badge
			>
		{:else if scanProgress.length > 0}
			<Badge variant="secondary">COMPLETE</Badge>
		{/if}
	</div>
	<div class="console-body scan-progress-body">
		{#if scanProgress.length > 0}
			{#each scanProgress as line}
				<div
					class="console-line {line.startsWith('[ERROR]')
						? 'error'
						: line.startsWith('[CMD]')
							? 'command'
							: line.startsWith('[TEST')
								? 'test'
								: line.includes('=====')
									? 'header'
									: ''}"
				>
					{line}
				</div>
			{/each}
			{#if isScanning}
				<div class="console-cursor">█</div>
			{/if}
		{:else}
			<div class="console-line text-muted-foreground">Click 'Start Scan' to begin</div>
		{/if}
	</div>
</div>

<style>
	.console-header {
		background: linear-gradient(
			to right,
			var(--color-muted),
			color-mix(in oklch, var(--color-muted) 80%, transparent)
		);
		padding: 0.75rem 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid var(--color-border);
	}

	.console-body {
		padding: 1rem;
		height: 400px;
		overflow-y: auto;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.875rem;
		line-height: 1.6;
		background: color-mix(in oklch, var(--color-background) 80%, black);
	}

	.console-line {
		color: var(--color-muted-foreground);
		white-space: pre-wrap;
		word-break: break-all;
		margin-bottom: 0.25rem;
	}

	.console-line.error {
		color: var(--color-destructive);
		font-weight: bold;
	}

	.console-line.command {
		color: var(--color-chart-2);
	}

	.console-line.test {
		color: var(--color-chart-1);
	}

	.console-line.header {
		color: var(--color-chart-4);
		font-weight: bold;
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.console-cursor {
		display: inline-block;
		animation: blink 1s infinite;
		color: var(--color-chart-2);
		font-weight: bold;
	}

	.console-body::-webkit-scrollbar {
		width: 10px;
	}

	.console-body::-webkit-scrollbar-track {
		background: var(--color-muted);
		border-radius: 5px;
	}

	.console-body::-webkit-scrollbar-thumb {
		background: var(--color-border);
		border-radius: 5px;
	}

	.console-body::-webkit-scrollbar-thumb:hover {
		background: color-mix(in oklch, var(--color-muted-foreground) 30%, transparent);
	}

	@keyframes blink {
		0%,
		50% {
			opacity: 1;
		}
		51%,
		100% {
			opacity: 0;
		}
	}
</style>
