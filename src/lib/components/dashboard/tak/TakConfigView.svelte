<script lang="ts">
	import { untrack } from 'svelte';

	import TakAuthEnroll from '$lib/components/dashboard/tak/TakAuthEnroll.svelte';
	import TakAuthImport from '$lib/components/dashboard/tak/TakAuthImport.svelte';
	import TakDataPackage from '$lib/components/dashboard/tak/TakDataPackage.svelte';
	import TakTruststore from '$lib/components/dashboard/tak/TakTruststore.svelte';
	import ToolViewWrapper from '$lib/components/dashboard/views/ToolViewWrapper.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import Switch from '$lib/components/ui/switch/switch.svelte';
	import { activeView } from '$lib/stores/dashboard/dashboard-store';
	import { takStatus } from '$lib/stores/tak-store';
	import type { TakServerConfig } from '$lib/types/tak';
	import { logger } from '$lib/utils/logger';

	const DEFAULT_CONFIG: TakServerConfig = {
		id: '',
		name: 'TAK Server',
		hostname: '',
		port: 8089,
		protocol: 'tls',
		shouldConnectOnStartup: false,
		authMethod: 'import',
		truststorePass: 'atakatak',
		certPass: 'atakatak',
		enrollmentPort: 8446
	};

	let config: TakServerConfig = $state({ ...DEFAULT_CONFIG });
	let isLoading = $state(false);
	let isSaving = $state(false);
	let message = $state('');
	let messageType: 'success' | 'error' = $state('success');

	$effect(() => {
		untrack(() => loadConfig());
	});

	async function loadConfig() {
		isLoading = true;
		try {
			const res = await fetch('/api/tak/config');
			const data = await res.json();
			if (data && data.id) config = data;
		} catch (e) {
			logger.error('[TakConfigView] Failed to load config', { error: e });
		} finally {
			isLoading = false;
		}
	}

	async function saveConfig() {
		isSaving = true;
		try {
			if (!config.id) config.id = crypto.randomUUID();
			const res = await fetch('/api/tak/config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(config)
			});
			const data = await res.json();
			if (data.success && data.config) {
				config = data.config;
				showMessage('Configuration saved', 'success');
			} else {
				showMessage(data.error ?? 'Save failed', 'error');
			}
		} catch {
			showMessage('Failed to save configuration', 'error');
		} finally {
			isSaving = false;
		}
	}

	function applyPaths(data: {
		id?: string;
		paths?: { certPath?: string; keyPath?: string; caPath?: string };
	}) {
		if (data.id) config.id = data.id;
		if (data.paths?.certPath) config.certPath = data.paths.certPath;
		if (data.paths?.keyPath) config.keyPath = data.paths.keyPath;
		if (data.paths?.caPath) config.caPath = data.paths.caPath;
		saveConfig();
	}

	function handleTruststoreUploaded(data: {
		truststorePath: string;
		caPath?: string;
		id?: string;
	}) {
		config.truststorePath = data.truststorePath;
		if (data.caPath) config.caPath = data.caPath;
		if (data.id) config.id = data.id;
		saveConfig();
	}

	function handlePackageImported(data: {
		hostname?: string;
		port?: number;
		description?: string;
		truststorePath?: string;
		id?: string;
	}) {
		if (data.hostname) config.hostname = data.hostname;
		if (data.port) config.port = data.port;
		if (data.description) config.name = data.description;
		if (data.truststorePath) config.truststorePath = data.truststorePath;
		if (data.id) config.id = data.id;
		saveConfig();
	}

	function showMessage(text: string, type: 'success' | 'error') {
		message = text;
		messageType = type;
		setTimeout(() => (message = ''), 4000);
	}
</script>

<ToolViewWrapper
	title="TAK Server Configuration"
	status={$takStatus.status === 'connected' ? 'Connected' : ''}
	onBack={() => activeView.set('map')}
>
	<div class="flex h-full flex-col gap-4 overflow-y-auto p-4">
		{#if isLoading}
			<p class="py-5 text-xs text-muted-foreground">Loading configuration...</p>
		{:else}
			<!-- Status -->
			<div class="flex flex-col gap-2">
				<span class="text-[10px] font-semibold tracking-widest text-muted-foreground"
					>STATUS</span
				>
				<div class="flex items-center gap-2 text-xs">
					<span
						class="size-2 shrink-0 rounded-full {$takStatus.status === 'connected'
							? 'bg-green-500 shadow-[0_0_6px_theme(colors.green.500)]'
							: $takStatus.status === 'error'
								? 'bg-destructive'
								: 'bg-muted-foreground'}"
					></span>
					<span class="font-semibold text-foreground"
						>{$takStatus.status.toUpperCase()}</span
					>
					{#if $takStatus.serverHost}
						<span class="text-muted-foreground"
							>{$takStatus.serverHost}:{config.port}</span
						>
					{/if}
				</div>
			</div>

			<!-- Server Info -->
			<div class="flex flex-col gap-2">
				<span class="text-[10px] font-semibold tracking-widest text-muted-foreground"
					>SERVER</span
				>
				<label class="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
					Description
					<Input
						type="text"
						bind:value={config.name}
						placeholder="Unit TAK Server"
						class="h-8 text-xs"
					/>
				</label>
				<div class="flex gap-2">
					<label
						class="flex flex-[2] flex-col gap-1 text-[11px] font-medium text-muted-foreground"
					>
						Hostname / IP
						<Input
							type="text"
							bind:value={config.hostname}
							placeholder="192.168.1.100"
							class="h-8 text-xs"
						/>
					</label>
					<label
						class="flex flex-1 flex-col gap-1 text-[11px] font-medium text-muted-foreground"
					>
						Port
						<Input
							type="number"
							bind:value={config.port}
							placeholder="8089"
							class="h-8 text-xs"
						/>
					</label>
				</div>
				<label
					class="flex cursor-pointer flex-row items-center gap-1.5 text-xs font-medium text-foreground"
				>
					<Switch bind:checked={config.shouldConnectOnStartup} />
					Connect on startup
				</label>
			</div>

			<!-- Authentication Method -->
			<div class="flex flex-col gap-2">
				<span class="text-[10px] font-semibold tracking-widest text-muted-foreground"
					>AUTHENTICATION</span
				>
				<!-- @constitutional-exemption Article-IV-4.2 issue:#12 — No RadioGroup component installed; native radio with bind:group is idiomatic Svelte -->
				<div class="flex flex-col gap-1.5">
					<label
						class="flex cursor-pointer flex-row items-center gap-1.5 text-xs font-medium text-foreground"
					>
						<input
							type="radio"
							bind:group={config.authMethod}
							value="import"
							class="accent-primary"
						/>
						Import Certificate (.p12)
					</label>
					<label
						class="flex cursor-pointer flex-row items-center gap-1.5 text-xs font-medium text-foreground"
					>
						<input
							type="radio"
							bind:group={config.authMethod}
							value="enroll"
							class="accent-primary"
						/>
						Enroll for Certificate
					</label>
				</div>
			</div>

			{#if config.authMethod === 'import'}
				<TakAuthImport {config} onCertUploaded={applyPaths} />
			{:else}
				<TakAuthEnroll {config} onEnrolled={applyPaths} />
			{/if}

			<TakTruststore {config} onUploaded={handleTruststoreUploaded} />
			<TakDataPackage configId={config.id} onImported={handlePackageImported} />

			<!-- Save -->
			<Separator />
			<div class="flex items-center gap-2">
				<Button onclick={saveConfig} disabled={isSaving} size="sm">
					{isSaving ? 'Saving...' : 'Save Configuration'}
				</Button>
				{#if message}
					<span
						class="text-[10px] {messageType === 'success'
							? 'text-green-400'
							: 'text-destructive'}"
					>
						{message}
					</span>
				{/if}
			</div>
		{/if}
	</div>
</ToolViewWrapper>
