<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import type { IMSICapture } from '$lib/stores/gsm-evil-store';

	interface ActivityStatus {
		hasActivity: boolean;
		packetCount: number;
		recentIMSI: boolean;
		currentFrequency: string;
		message: string;
	}

	let {
		gsmFrames = [],
		activityStatus,
		capturedIMSIs = []
	}: {
		gsmFrames: string[];
		activityStatus: ActivityStatus;
		capturedIMSIs: IMSICapture[];
	} = $props();
</script>

<div class="mx-4 mt-2 bg-black/30 border border-border rounded-lg p-4">
	<h4 class="text-base font-semibold text-foreground mb-4 text-center uppercase tracking-wide">
		<span class="text-destructive">Live</span> GSM Frames
		<span class="ml-2 text-xs font-normal text-muted-foreground">
			<span class="text-foreground">Listening on</span>
			<Badge variant="destructive" class="mx-1">{activityStatus.currentFrequency} MHz</Badge>
			<span class="text-muted-foreground">• {gsmFrames.length} frames</span>
		</span>
	</h4>
	<div class="live-frames-console">
		{#if gsmFrames.length > 0}
			{#each gsmFrames as frame, i}
				<div class="frame-line {i === gsmFrames.length - 1 ? 'latest' : ''}">
					{frame}
				</div>
			{/each}
		{:else}
			<div class="frame-line text-muted-foreground">Waiting for GSM frames...</div>
			<div class="frame-line text-muted-foreground/60 text-xs">
				{#if activityStatus.packetCount > 0}
					Processing {activityStatus.packetCount} packets/sec
				{:else}
					Listening for GSM traffic on {activityStatus.currentFrequency} MHz
				{/if}
			</div>
			<div class="frame-line text-muted-foreground/60 text-xs">
				{#if capturedIMSIs.length > 0}
					<Badge variant="outline" class="text-green-400 border-green-400/30">
						✓ {capturedIMSIs.length} devices detected
					</Badge>
				{:else}
					IMSI sniffer active - devices will appear when detected
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.live-frames-console {
		background: color-mix(in oklch, var(--color-background) 90%, black);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		padding: 0.75rem;
		max-height: calc(100vh - 350px);
		min-height: 600px;
		overflow-y: auto;
		font-family: monospace;
		font-size: 0.75rem;
	}

	.frame-line {
		white-space: pre-wrap;
		font-family: 'Monaco', 'Menlo', monospace;
		font-size: 0.7rem;
		line-height: 1.4;
		padding: 0.2rem 0;
		color: var(--color-muted-foreground);
	}

	.frame-line.latest {
		color: var(--color-chart-2);
	}
</style>
