<script lang="ts">
	import type { GlobalProtectConfig } from '$lib/types/globalprotect';

	interface Props {
		config: GlobalProtectConfig;
		onchange: (config: GlobalProtectConfig) => void;
		password: string;
		onpassword: (password: string) => void;
	}

	let { config, onchange, password, onpassword }: Props = $props();

	function update(field: keyof GlobalProtectConfig, value: string | boolean) {
		onchange({ ...config, [field]: value });
	}
</script>

<div class="rounded-lg border border-border/60 bg-card/40 p-3">
	<span class="mb-2 block text-base font-semibold tracking-widest text-muted-foreground"
		>SERVER CONFIGURATION</span
	>

	<div class="flex flex-col gap-2">
		<label class="flex flex-col gap-1 text-sm font-medium text-muted-foreground">
			Portal Address
			<input
				type="text"
				class="h-9 rounded-md border border-border/40 px-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
				style="background-color: #2a2a2a"
				placeholder="vpn.example.mil"
				value={config.portal}
				oninput={(e) => update('portal', e.currentTarget.value)}
			/>
		</label>

		<label class="flex flex-col gap-1 text-sm font-medium text-muted-foreground">
			Username
			<input
				type="text"
				class="h-9 rounded-md border border-border/40 px-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
				style="background-color: #2a2a2a"
				placeholder="operator1"
				value={config.username}
				oninput={(e) => update('username', e.currentTarget.value)}
			/>
		</label>

		<label class="flex flex-col gap-1 text-sm font-medium text-muted-foreground">
			Password
			<input
				type="password"
				class="h-9 rounded-md border border-border/40 px-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
				style="background-color: #2a2a2a"
				placeholder="Enter password"
				value={password}
				oninput={(e) => onpassword(e.currentTarget.value)}
			/>
		</label>
	</div>
</div>
