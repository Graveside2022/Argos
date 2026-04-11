<script lang="ts">
	import { Loader2, PlugZap, Shield, ShieldCheck, ShieldX } from '@lucide/svelte';

	import { gpStatus } from '$lib/stores/globalprotect-store';

	interface Props {
		isConnecting: boolean;
		hasPortal: boolean;
		onconnect: () => void;
	}

	let { isConnecting, hasPortal, onconnect }: Props = $props();
</script>

<div class="rounded-lg border border-border/60 bg-card/40 p-4">
	<div class="flex items-start gap-3">
		<div class="mt-0.5">
			{#if $gpStatus.status === 'connected'}
				<div
					class="flex size-10 items-center justify-center rounded-lg bg-green-600/15 border border-green-500/30"
				>
					<ShieldCheck size={20} class="text-green-400" />
				</div>
			{:else if $gpStatus.status === 'connecting' || isConnecting}
				<div
					class="flex size-10 items-center justify-center rounded-lg bg-primary/15 border border-primary/30"
				>
					<Loader2 size={20} class="animate-spin text-primary" />
				</div>
			{:else if $gpStatus.status === 'error'}
				<div
					class="flex size-10 items-center justify-center rounded-lg bg-red-600/15 border border-red-500/30"
				>
					<ShieldX size={20} class="text-red-400" />
				</div>
			{:else}
				<div
					class="flex size-10 items-center justify-center rounded-lg bg-muted/30 border border-border/40"
				>
					<Shield size={20} class="text-muted-foreground" />
				</div>
			{/if}
		</div>

		<div class="flex-1 min-w-0">
			<div class="flex items-center justify-between">
				<div>
					<span class="text-sm font-semibold text-foreground">
						{#if $gpStatus.status === 'connected'}
							VPN Connected
						{:else if $gpStatus.status === 'connecting' || isConnecting}
							Establishing Connection
						{:else if $gpStatus.status === 'error'}
							Connection Failed
						{:else}
							VPN Disconnected
						{/if}
					</span>
					{#if $gpStatus.portal}
						<p class="mt-0.5 text-xs text-muted-foreground truncate">
							{$gpStatus.portal}
						</p>
					{/if}
				</div>

				{#if !isConnecting && $gpStatus.status !== 'connecting' && $gpStatus.status !== 'connected'}
					<button
						class="inline-flex items-center gap-1.5 rounded-md border border-green-500/50 bg-green-600/20 px-3 py-1.5 text-sm font-medium text-green-400 transition-colors hover:bg-green-600/30"
						disabled={!hasPortal}
						onclick={onconnect}
					>
						<PlugZap size={12} />
						Connect
					</button>
				{/if}
			</div>

			{#if $gpStatus.status === 'connected'}
				<div class="mt-2 flex gap-4 text-xs">
					{#if $gpStatus.assignedIp}
						<div class="flex flex-col">
							<span class="text-muted-foreground">Assigned IP</span>
							<span class="font-medium text-foreground">{$gpStatus.assignedIp}</span>
						</div>
					{/if}
				</div>
			{/if}

			{#if $gpStatus.lastError}
				<p class="mt-2 text-xs text-red-400">{$gpStatus.lastError}</p>
			{/if}
		</div>
	</div>
</div>
