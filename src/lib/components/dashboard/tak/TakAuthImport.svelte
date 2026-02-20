<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import type { TakServerConfig } from '$lib/types/tak';

	interface Props {
		config: TakServerConfig;
		onCertUploaded: (data: {
			id: string;
			paths: { certPath: string; keyPath: string; caPath?: string };
		}) => void;
	}

	let { config, onCertUploaded }: Props = $props();

	let p12File: FileList | undefined = $state();
	let p12Password = $state('');
	let uploadStatus = $state('');

	async function uploadCert() {
		if (!p12File || p12File.length === 0 || !p12Password) {
			uploadStatus = 'Select file and enter password';
			return;
		}
		const formData = new FormData();
		formData.append('p12File', p12File[0]);
		formData.append('password', p12Password);
		if (config.id) formData.append('id', config.id);

		uploadStatus = 'Uploading...';
		try {
			const res = await fetch('/api/tak/certs', { method: 'POST', body: formData });
			const data = await res.json();
			if (data.success) {
				onCertUploaded({ id: data.id, paths: data.paths });
				uploadStatus = 'Certificate uploaded';
			} else {
				uploadStatus = 'Failed: ' + (data.error ?? 'Unknown error');
			}
		} catch {
			uploadStatus = 'Upload error';
		}
	}
</script>

<div class="flex flex-col gap-2">
	<span class="text-xs font-semibold tracking-widest text-muted-foreground">
		CLIENT CERTIFICATE
	</span>
	<p class="text-[10px] leading-relaxed text-muted-foreground/70">
		Upload your <strong class="text-muted-foreground">client identity certificate</strong>
		(.p12) — e.g.
		<code class="rounded bg-muted/50 px-1 text-foreground/80">truststore-intermediate.p12</code>
	</p>
	<label class="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
		Certificate File (.p12)
		<Input type="file" accept=".p12" bind:files={p12File} class="h-8 text-[10px]" />
	</label>
	<label class="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
		Certificate Password
		<Input
			type="password"
			bind:value={p12Password}
			placeholder="atakatak"
			class="h-8 text-xs"
		/>
	</label>
	<div class="flex items-center gap-2">
		<Button size="sm" onclick={uploadCert}>Upload Certificate</Button>
		{#if uploadStatus}
			<span class="text-[10px] text-muted-foreground">{uploadStatus}</span>
		{/if}
	</div>
	{#if config.certPath}
		<span class="text-[10px] text-green-400">✓ Certificates loaded</span>
	{/if}
</div>
