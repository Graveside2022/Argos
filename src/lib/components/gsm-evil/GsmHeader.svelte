<script lang="ts">
	import { Button } from '$lib/components/ui/button';

	let {
		isActive = false,
		buttonText = 'Start Scan',
		onscanbutton
	}: {
		isActive: boolean;
		buttonText: string;
		onscanbutton: () => void;
	} = $props();
</script>

<div class="flex items-center justify-end h-10 px-8 bg-muted/20 border-b border-border/40">
	<div class="flex items-center gap-2">
		<Button
			variant={isActive ? 'destructive' : 'secondary'}
			size="sm"
			onclick={onscanbutton}
			class="h-7 text-xs uppercase tracking-wide font-mono font-bold"
		>
			{buttonText}
		</Button>
	</div>
</div>
