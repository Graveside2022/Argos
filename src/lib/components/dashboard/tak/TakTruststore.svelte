<script lang="ts">
	import Input from '$lib/components/ui/input/input.svelte';
	import type { TakServerConfig } from '$lib/types/tak';

	interface Props {
		config: TakServerConfig;
		onUploaded: (data: { truststorePath: string; caPath?: string; id?: string }) => void;
		onTruststoreCleared?: () => void;
	}

	let { config, onUploaded, onTruststoreCleared }: Props = $props();

	let truststoreFile: FileList | undefined = $state();
	let truststoreStatus = $state('');

	/** Handle the truststore upload API response. */
	function handleTruststoreResponse(data: Record<string, unknown>): void {
		if (!data.success) {
			truststoreStatus = (data.error as string) ?? 'Invalid truststore file';
			return;
		}
		const paths = data.paths as { truststorePath: string; caPath?: string };
		onUploaded({
			truststorePath: paths.truststorePath,
			caPath: paths.caPath,
			id: data.id as string | undefined
		});
		truststoreStatus = 'Truststore validated';
	}

	async function uploadTruststore() {
		if (!truststoreFile || truststoreFile.length === 0) {
			truststoreStatus = 'Select a .p12 file';
			return;
		}
		const formData = new FormData();
		formData.append('p12File', truststoreFile[0]);
		formData.append('password', config.truststorePass);
		if (config.id) formData.append('id', config.id);

		truststoreStatus = 'Validating...';
		try {
			const res = await fetch('/api/tak/truststore', { method: 'POST', body: formData });
			handleTruststoreResponse(await res.json());
		} catch {
			truststoreStatus = 'Upload error';
		}
	}
</script>

<div class="flex flex-col gap-2.5">
	<span class="text-xs font-semibold tracking-widest text-muted-foreground">TRUST STORE</span>
	<p class="text-[10px] leading-relaxed text-muted-foreground/70">
		Upload the <strong class="text-muted-foreground">root CA truststore</strong> (.p12) — e.g.
		<code class="rounded bg-muted/50 px-1 text-foreground/80">truststore-root.p12</code>
	</p>

	<!-- File picker -->
	<label class="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
		Truststore File (.p12)
		<label
			class="group flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-2 transition-colors hover:border-primary/50 hover:bg-muted/20"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="shrink-0 text-muted-foreground/60 group-hover:text-primary"
				><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
					points="17 8 12 3 7 8"
				/><line x1="12" y1="3" x2="12" y2="15" /></svg
			>
			<span class="text-[11px] text-muted-foreground group-hover:text-foreground">
				{truststoreFile && truststoreFile.length > 0
					? truststoreFile[0].name
					: 'Choose .p12 file...'}
			</span>
			<input type="file" accept=".p12" bind:files={truststoreFile} class="sr-only" />
		</label>
	</label>

	<!-- Password -->
	<label class="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
		Truststore Password
		<Input
			type="password"
			bind:value={config.truststorePass}
			placeholder="atakatak"
			class="h-8 text-xs"
		/>
	</label>

	<!-- Upload button -->
	<div class="flex items-center gap-2">
		<button
			onclick={uploadTruststore}
			class="inline-flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-primary/30"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
					points="17 8 12 3 7 8"
				/><line x1="12" y1="3" x2="12" y2="15" /></svg
			>
			Upload Truststore
		</button>
		{#if truststoreStatus}
			<span class="text-[10px] text-muted-foreground">{truststoreStatus}</span>
		{/if}
	</div>

	<!-- Status indicator -->
	{#if config.truststorePath}
		<div
			class="flex items-center justify-between rounded-md border border-green-500/30 bg-green-500/10 px-2.5 py-1.5"
		>
			<div class="flex items-center gap-1.5">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="text-green-400"><polyline points="20 6 9 17 4 12" /></svg
				>
				<span class="text-[10px] font-medium text-green-400">Truststore loaded</span>
			</div>
			<button
				onclick={() => onTruststoreCleared?.()}
				class="inline-flex items-center gap-1 rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500/25"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><line x1="18" y1="6" x2="6" y2="18" /><line
						x1="6"
						y1="6"
						x2="18"
						y2="18"
					/></svg
				>
				Clear
			</button>
		</div>
	{/if}
</div>
