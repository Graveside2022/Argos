<script lang="ts">
	import { Loader2, PlugZap, Unplug } from '@lucide/svelte';

	import { gpStatus } from '$lib/stores/globalprotect-store';

	interface Props {
		isConnecting: boolean;
		hasPortal: boolean;
		onconnect: (password: string) => void;
		ondisconnect: () => void;
	}

	let { isConnecting, hasPortal, onconnect, ondisconnect }: Props = $props();

	let showPasswordInput = $state(false);
	let password = $state('');

	function handleConnect() {
		if (!showPasswordInput) {
			showPasswordInput = true;
			return;
		}
		if (password.trim()) {
			onconnect(password);
			password = '';
			showPasswordInput = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleConnect();
		if (e.key === 'Escape') {
			showPasswordInput = false;
			password = '';
		}
	}
</script>

<div class="rounded-lg border border-border/60 bg-card/40 p-3">
	<span class="mb-2 block text-sm font-semibold tracking-widest text-muted-foreground"
		>STATUS</span
	>

	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2 text-sm">
			{#if $gpStatus.status === 'connected'}
				<span
					class="size-2.5 shrink-0 rounded-full bg-green-500 shadow-[0_0_6px_theme(colors.green.500)]"
				></span>
				<span class="font-semibold text-foreground">Connected</span>
			{:else if $gpStatus.status === 'connecting' || isConnecting}
				<Loader2 size={10} class="animate-spin text-primary" />
				<span class="font-semibold text-foreground">Connecting...</span>
			{:else if $gpStatus.status === 'error'}
				<span class="size-2.5 shrink-0 rounded-full bg-destructive"></span>
				<span class="font-semibold text-foreground">Error</span>
			{:else}
				<span class="size-2.5 shrink-0 rounded-full bg-muted-foreground"></span>
				<span class="font-semibold text-foreground">Disconnected</span>
			{/if}

			{#if $gpStatus.portal}
				<span class="text-muted-foreground">{$gpStatus.portal}</span>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			{#if $gpStatus.status === 'connected'}
				<button
					class="inline-flex items-center gap-1.5 rounded-md border border-red-500/50 bg-red-600/20 px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-600/30"
					onclick={ondisconnect}
				>
					<Unplug size={12} />
					Disconnect
				</button>
			{:else if !isConnecting && $gpStatus.status !== 'connecting'}
				<button
					class="inline-flex items-center gap-1.5 rounded-md border border-green-500/50 bg-green-600/20 px-3 py-1.5 text-sm font-medium text-green-400 transition-colors hover:bg-green-600/30"
					disabled={!hasPortal}
					onclick={handleConnect}
				>
					<PlugZap size={12} />
					Connect
				</button>
			{/if}
		</div>
	</div>

	{#if $gpStatus.status === 'connected'}
		<div class="mt-2 flex gap-4 text-xs text-muted-foreground">
			{#if $gpStatus.gateway}
				<span>Gateway: <span class="text-foreground">{$gpStatus.gateway}</span></span>
			{/if}
			{#if $gpStatus.assignedIp}
				<span>IP: <span class="text-foreground">{$gpStatus.assignedIp}</span></span>
			{/if}
		</div>
	{/if}

	{#if $gpStatus.lastError}
		<p class="mt-2 text-xs text-red-400">{$gpStatus.lastError}</p>
	{/if}

	{#if showPasswordInput && $gpStatus.status !== 'connected'}
		<div class="mt-2 flex items-center gap-2">
			<input
				type="password"
				class="h-9 flex-1 rounded-md border border-border/40 bg-muted/20 px-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
				placeholder="Enter password"
				bind:value={password}
				onkeydown={handleKeydown}
			/>
			<button
				class="inline-flex items-center rounded-md border border-green-500/50 bg-green-600/20 px-3 py-1.5 text-sm font-medium text-green-400 transition-colors hover:bg-green-600/30"
				onclick={handleConnect}
			>
				Go
			</button>
		</div>
	{/if}
</div>
