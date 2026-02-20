<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import type { TakServerConfig } from '$lib/types/tak';

	interface Props {
		config: TakServerConfig;
		onUploaded: (data: { truststorePath: string; caPath?: string; id?: string }) => void;
	}

	let { config, onUploaded }: Props = $props();

	let truststoreFile: FileList | undefined = $state();
	let truststoreStatus = $state('');

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
			const data = await res.json();
			if (data.success) {
				onUploaded({
					truststorePath: data.paths.truststorePath,
					caPath: data.paths.caPath,
					id: data.id
				});
				truststoreStatus = 'Truststore validated';
			} else {
				truststoreStatus = data.error ?? 'Invalid truststore file';
			}
		} catch {
			truststoreStatus = 'Upload error';
		}
	}
</script>

<div class="flex flex-col gap-2">
	<span class="text-xs font-semibold tracking-widest text-muted-foreground">TRUST STORE</span>
	<p class="text-[10px] leading-relaxed text-muted-foreground/70">
		Upload the <strong class="text-muted-foreground">root CA truststore</strong> (.p12) — e.g.
		<code class="rounded bg-muted/50 px-1 text-foreground/80">truststore-root.p12</code>
	</p>
	<label class="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
		Truststore File (.p12)
		<Input type="file" accept=".p12" bind:files={truststoreFile} class="h-8 text-[10px]" />
	</label>
	<label class="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
		Truststore Password
		<Input
			type="password"
			bind:value={config.truststorePass}
			placeholder="atakatak"
			class="h-8 text-xs"
		/>
	</label>
	<div class="flex items-center gap-2">
		<Button size="sm" onclick={uploadTruststore}>Upload Truststore</Button>
		{#if truststoreStatus}
			<span class="text-[10px] text-muted-foreground">{truststoreStatus}</span>
		{/if}
	</div>
	{#if config.truststorePath}
		<span class="text-[10px] text-green-400">✓ Truststore loaded</span>
	{/if}
</div>
