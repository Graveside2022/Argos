<script lang="ts">
	import Badge from '$lib/components/ui/badge/badge.svelte';

	interface ActivityStatus {
		hasActivity: boolean;
		packetCount: number;
		recentIMSI: boolean;
		currentFrequency: string;
		message: string;
	}

	let {
		gsmFrames = [],
		activityStatus
	}: {
		gsmFrames: string[];
		activityStatus: ActivityStatus;
	} = $props();
</script>

<div class="mx-4 mt-2 rounded-lg border bg-card text-card-foreground shadow-sm">
	<div class="flex items-center justify-between border-b px-4 py-2">
		<h4 class="text-sm font-semibold uppercase tracking-wide">
			<span class="text-destructive">Live</span> Frames
		</h4>
		<div class="flex items-center gap-2 text-xs text-muted-foreground">
			{#if activityStatus.packetCount > 0}
				<span>{activityStatus.packetCount} pkts/s</span>
			{/if}
			<Badge variant="outline" class="font-mono text-[10px] h-5">
				{activityStatus.currentFrequency} MHz
			</Badge>
			<span class="font-mono">{gsmFrames.length} frames</span>
		</div>
	</div>

	<div class="live-frames-console p-3 font-mono text-xs">
		{#if gsmFrames.length > 0}
			{#each gsmFrames as frame, i}
				<div
					class="mb-0.5 whitespace-pre-wrap break-all {i === gsmFrames.length - 1
						? 'text-primary font-medium'
						: 'text-muted-foreground'}"
				>
					{frame}
				</div>
			{/each}
		{:else}
			<div class="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
				<p>Waiting for GSM frames...</p>
				<p class="text-[10px] opacity-70">
					Listening on {activityStatus.currentFrequency} MHz
				</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.live-frames-console {
		max-height: calc(100vh - 350px);
		min-height: 400px;
		overflow-y: auto;
		background: var(--color-background);
	}
</style>
