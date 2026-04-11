<script lang="ts">
	import type { GlobalProtectConfig } from '$lib/types/globalprotect';

	interface Props {
		config: GlobalProtectConfig;
		onchange: (config: GlobalProtectConfig) => void;
	}

	let { config, onchange }: Props = $props();

	function update(field: keyof GlobalProtectConfig, value: string | boolean) {
		onchange({ ...config, [field]: value });
	}
</script>

<div class="rounded-lg border border-border/60 bg-card/40 p-3">
	<span class="mb-2 block text-sm font-semibold tracking-widest text-muted-foreground"
		>SERVER</span
	>

	<div class="flex flex-col gap-2">
		<label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
			Portal Address
			<input
				type="text"
				class="h-9 rounded-md border border-border/40 bg-muted/20 px-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
				placeholder="vpn.example.mil"
				value={config.portal}
				oninput={(e) => update('portal', e.currentTarget.value)}
			/>
		</label>

		<label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
			Username
			<input
				type="text"
				class="h-9 rounded-md border border-border/40 bg-muted/20 px-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
				placeholder="operator1"
				value={config.username}
				oninput={(e) => update('username', e.currentTarget.value)}
			/>
		</label>

		<button
			type="button"
			class="flex cursor-pointer flex-row items-center gap-2 rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
			onclick={() => update('connectOnStartup', !config.connectOnStartup)}
		>
			<div
				class="flex h-4 w-7 items-center rounded-full px-0.5 transition-colors {config.connectOnStartup
					? 'bg-primary'
					: 'bg-muted-foreground/30'}"
			>
				<div
					class="size-3 rounded-full bg-white transition-transform {config.connectOnStartup
						? 'translate-x-3'
						: 'translate-x-0'}"
				></div>
			</div>
			Connect on startup
		</button>
	</div>
</div>
