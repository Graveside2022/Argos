<script lang="ts">
	interface Props {
		configId?: string;
		onImported: (data: {
			hostname?: string;
			port?: number;
			description?: string;
			truststorePath?: string;
			id?: string;
			warning?: string;
		}) => void;
	}

	let { configId, onImported }: Props = $props();

	let packageFile: FileList | undefined = $state();
	let packageStatus = $state('');

	/** Handle the package import API response. */
	function handlePackageResponse(data: Record<string, unknown>): void {
		if (!data.success) {
			packageStatus = (data.error as string) ?? 'Import failed';
			return;
		}
		const cfg = data.config as Record<string, unknown>;
		onImported({
			hostname: cfg.hostname as string | undefined,
			port: cfg.port as number | undefined,
			description: cfg.description as string | undefined,
			truststorePath: cfg.truststorePath as string | undefined,
			id: data.id as string | undefined,
			warning: data.warning as string | undefined
		});
		packageStatus = (data.warning as string) ?? 'Package imported';
	}

	async function importDataPackage() {
		if (!packageFile || packageFile.length === 0) {
			packageStatus = 'Select a .zip file';
			return;
		}
		const formData = new FormData();
		formData.append('packageFile', packageFile[0]);
		if (configId) formData.append('id', configId);

		packageStatus = 'Importing...';
		try {
			const res = await fetch('/api/tak/import-package', { method: 'POST', body: formData });
			handlePackageResponse(await res.json());
		} catch {
			packageStatus = 'Import error';
		}
	}
</script>

<div class="flex flex-col gap-2.5">
	<span class="text-xs font-semibold tracking-widest text-muted-foreground">DATA PACKAGE</span>

	<!-- File picker -->
	<label class="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
		TAK Data Package (.zip)
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
				><path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" /></svg
			>
			<span class="text-[11px] text-muted-foreground group-hover:text-foreground">
				{packageFile && packageFile.length > 0
					? packageFile[0].name
					: 'Choose .zip file...'}
			</span>
			<input type="file" accept=".zip" bind:files={packageFile} class="sr-only" />
		</label>
	</label>

	<!-- Import button -->
	<div class="flex items-center gap-2">
		<button
			onclick={importDataPackage}
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
					points="7 10 12 15 17 10"
				/><line x1="12" y1="15" x2="12" y2="3" /></svg
			>
			Import Package
		</button>
		{#if packageStatus}
			<span
				class="text-[10px] {packageStatus.includes('error') ||
				packageStatus.includes('failed') ||
				packageStatus.includes('Failed')
					? 'text-red-400'
					: packageStatus.includes('enroll') || packageStatus.includes('certificate')
						? 'text-amber-400'
						: 'text-muted-foreground'}"
			>
				{packageStatus}
			</span>
		{/if}
	</div>
</div>
