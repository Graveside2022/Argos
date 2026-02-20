<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';

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
			const data = await res.json();
			if (data.success) {
				onImported({
					hostname: data.config.hostname,
					port: data.config.port,
					description: data.config.description,
					truststorePath: data.config.truststorePath,
					id: data.id,
					warning: data.warning
				});
				packageStatus = data.warning ?? 'Package imported';
			} else {
				packageStatus = data.error ?? 'Import failed';
			}
		} catch {
			packageStatus = 'Import error';
		}
	}
</script>

<div class="flex flex-col gap-2">
	<span class="text-xs font-semibold tracking-widest text-muted-foreground">DATA PACKAGE</span>
	<label class="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
		TAK Data Package (.zip)
		<Input type="file" accept=".zip" bind:files={packageFile} class="h-8 text-[10px]" />
	</label>
	<div class="flex items-center gap-2">
		<Button size="sm" onclick={importDataPackage}>Import Package</Button>
		{#if packageStatus}
			<span class="text-[10px] text-muted-foreground">{packageStatus}</span>
		{/if}
	</div>
</div>
