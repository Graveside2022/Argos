<script lang="ts">
	import { FileKey } from '@lucide/svelte';

	import { importCertificate } from './gp-config-logic';

	interface Props {
		certificatePath?: string;
		onpathchange: (path: string) => void;
	}

	let { certificatePath = '', onpathchange }: Props = $props();

	let certInput = $state(certificatePath ?? '');
	let importMessage = $state('');
	let importSuccess = $state(false);
	let isImporting = $state(false);

	async function handleImport() {
		if (!certInput.trim()) return;
		isImporting = true;
		importMessage = '';
		try {
			const result = await importCertificate(certInput.trim());
			importMessage = result.message;
			importSuccess = result.success;
			if (result.success) {
				onpathchange(certInput.trim());
			}
		} catch {
			importMessage = 'Import failed';
			importSuccess = false;
		} finally {
			isImporting = false;
		}
	}
</script>

<div class="rounded-lg border border-border/60 bg-card/40 p-3">
	<span class="mb-2 block text-sm font-semibold tracking-widest text-muted-foreground"
		>CLIENT CERTIFICATE</span
	>

	<div class="flex flex-col gap-2">
		<label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
			Certificate Path (.p12)
			<div class="flex items-center gap-2">
				<input
					type="text"
					class="h-9 flex-1 rounded-md border border-border/40 bg-muted/20 px-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
					placeholder="/path/to/client.p12"
					bind:value={certInput}
				/>
				<button
					class="inline-flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/20 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/30"
					disabled={!certInput.trim() || isImporting}
					onclick={handleImport}
				>
					<FileKey size={12} />
					{isImporting ? 'Importing...' : 'Import'}
				</button>
			</div>
		</label>

		{#if importMessage}
			<p class="text-xs {importSuccess ? 'text-green-400' : 'text-red-400'}">
				{importMessage}
			</p>
		{/if}

		{#if certificatePath}
			<p class="text-xs text-muted-foreground">
				Active: <span class="text-foreground">{certificatePath}</span>
			</p>
		{/if}
	</div>
</div>
