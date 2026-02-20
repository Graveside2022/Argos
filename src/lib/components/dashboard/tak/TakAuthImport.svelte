<script lang="ts">
	import Input from '$lib/components/ui/input/input.svelte';
	import type { TakServerConfig } from '$lib/types/tak';

	interface Props {
		config: TakServerConfig;
		onCertUploaded: (data: {
			id: string;
			paths: { certPath: string; keyPath: string; caPath?: string };
		}) => void;
		onCertCleared?: () => void;
	}

	let { config, onCertUploaded, onCertCleared }: Props = $props();

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

<div class="flex flex-col gap-2.5">
	<span class="text-xs font-semibold tracking-widest text-muted-foreground">
		CLIENT CERTIFICATE
	</span>
	<p class="text-[10px] leading-relaxed text-muted-foreground/70">
		Upload your <strong class="text-muted-foreground">client identity certificate</strong>
		(.p12) — e.g.
		<code class="rounded bg-muted/50 px-1 text-foreground/80">truststore-intermediate.p12</code>
	</p>

	<!-- File picker -->
	<label class="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
		Certificate File (.p12)
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
				{p12File && p12File.length > 0 ? p12File[0].name : 'Choose .p12 file...'}
			</span>
			<input type="file" accept=".p12" bind:files={p12File} class="sr-only" />
		</label>
	</label>

	<!-- Password -->
	<label class="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
		Certificate Password
		<Input
			type="password"
			bind:value={p12Password}
			placeholder="atakatak"
			class="h-8 text-xs"
		/>
	</label>

	<!-- Upload button -->
	<div class="flex items-center gap-2">
		<button
			onclick={uploadCert}
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
			Upload Certificate
		</button>
		{#if uploadStatus}
			<span class="text-[10px] text-muted-foreground">{uploadStatus}</span>
		{/if}
	</div>

	<!-- Status indicator -->
	{#if config.certPath}
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
				<span class="text-[10px] font-medium text-green-400">Certificates loaded</span>
			</div>
			<button
				onclick={() => onCertCleared?.()}
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
