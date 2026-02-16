<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';

	let {
		isActive = false,
		buttonText = 'Start Scan',
		imsiCaptureActive = false,
		onscanbutton
	}: {
		isActive: boolean;
		buttonText: string;
		imsiCaptureActive: boolean;
		onscanbutton: () => void;
	} = $props();
</script>

<header class="header">
	<div class="w-full mx-auto px-4">
		<div class="flex items-center justify-between h-16">
			<!-- Left Section - Logo and Title -->
			<div class="flex items-center gap-4">
				<Button variant="ghost" href="/" class="uppercase tracking-wide font-mono text-sm">
					<span class="font-bold">Back to Console</span>
				</Button>
				<div class="flex items-center">
					<div class="flex items-center gap-3">
						<div class="icon-wrapper">
							<svg
								class="w-6 h-6 text-destructive"
								fill="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									d="M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1M12,18A1,1 0 0,0 13,17A1,1 0 0,0 12,16A1,1 0 0,0 11,17A1,1 0 0,0 12,18M8,8H16V10H8V8M8,11H13V13H8V11Z"
								></path>
							</svg>
						</div>
						<div class="flex flex-col">
							<h1
								class="font-heading text-h4 font-semibold tracking-tight leading-tight"
							>
								<span class="text-destructive">GSM</span>
								<span class="font-bold text-foreground">Evil</span>
							</h1>
							<span class="subtitle"> Cellular Network Analysis </span>
						</div>
					</div>
				</div>
			</div>

			<!-- Right Section - Buttons -->
			<div class="flex items-center gap-3">
				{#if imsiCaptureActive}
					<Badge
						variant="outline"
						class="text-green-400 border-green-400/30 animate-pulse"
					>
						<span class="status-dot"></span>
						IMSI Capture Active
					</Badge>
				{/if}

				<Button
					variant={isActive ? 'destructive' : 'default'}
					onclick={onscanbutton}
					class="uppercase tracking-wide font-mono text-sm"
				>
					<span class="font-bold">{buttonText}</span>
				</Button>
			</div>
		</div>
	</div>
</header>

<style>
	.header {
		background: linear-gradient(
			to bottom,
			color-mix(in oklch, var(--color-destructive) 10%, transparent),
			color-mix(in oklch, var(--color-background) 95%, transparent)
		);
		border-bottom: 1px solid color-mix(in oklch, var(--color-destructive) 20%, transparent);
		position: relative;
		z-index: 50;
	}

	.icon-wrapper {
		padding: 0.75rem;
		border-radius: 0.75rem;
		background: linear-gradient(
			135deg,
			color-mix(in oklch, var(--color-destructive) 20%, transparent) 0%,
			color-mix(in oklch, var(--color-destructive) 10%, transparent) 100%
		);
		border: 1px solid color-mix(in oklch, var(--color-destructive) 20%, transparent);
		box-shadow:
			0 8px 25px color-mix(in oklch, var(--color-destructive) 20%, transparent),
			0 0 15px color-mix(in oklch, var(--color-destructive) 15%, transparent);
	}

	.subtitle {
		font-family: 'Courier New', monospace;
		font-size: 0.625rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--color-muted-foreground);
		font-weight: bold;
	}

	.status-dot {
		display: inline-block;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--color-chart-2, oklch(0.795 0.184 86.047));
		box-shadow: 0 0 8px
			color-mix(in oklch, var(--color-chart-2, oklch(0.795 0.184 86.047)) 60%, transparent);
		margin-right: 0.25rem;
	}
</style>
