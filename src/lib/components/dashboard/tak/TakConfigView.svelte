<script lang="ts">
	import { untrack } from 'svelte';

	import TakAuthEnroll from '$lib/components/dashboard/tak/TakAuthEnroll.svelte';
	import TakAuthImport from '$lib/components/dashboard/tak/TakAuthImport.svelte';
	import TakAuthMethodPicker from '$lib/components/dashboard/tak/TakAuthMethodPicker.svelte';
	import TakDataPackage from '$lib/components/dashboard/tak/TakDataPackage.svelte';
	import TakServerForm from '$lib/components/dashboard/tak/TakServerForm.svelte';
	import TakStatusSection from '$lib/components/dashboard/tak/TakStatusSection.svelte';
	import TakTruststore from '$lib/components/dashboard/tak/TakTruststore.svelte';
	import ToolViewWrapper from '$lib/components/dashboard/views/ToolViewWrapper.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { activeView } from '$lib/stores/dashboard/dashboard-store';
	import { takStatus } from '$lib/stores/tak-store';
	import type { TakServerConfig } from '$lib/types/tak';

	import {
		applyCertPaths,
		applyPackageImport,
		applyTruststoreResult,
		clearCertPaths,
		clearTruststore,
		connectToServer,
		DEFAULT_CONFIG,
		disconnectFromServer,
		loadConfig,
		saveConfig
	} from './tak-config-logic';

	let config: TakServerConfig = $state({ ...DEFAULT_CONFIG });
	let isLoading = $state(false);
	let isSaving = $state(false);
	let isConnecting = $state(false);
	let message = $state('');
	let messageType: 'success' | 'error' = $state('success');

	$effect(() => {
		untrack(() => initConfig());
	});

	async function initConfig() {
		isLoading = true;
		config = await loadConfig();
		isLoading = false;
	}

	async function handleSave() {
		isSaving = true;
		const result = await saveConfig(config);
		if (result.success && result.config) {
			config = result.config;
			showMessage('Configuration saved', 'success');
		} else {
			showMessage(result.error ?? 'Save failed', 'error');
		}
		isSaving = false;
	}

	async function handleConnect() {
		isConnecting = true;
		const result = await connectToServer();
		showMessage(
			result.success ? 'Connecting...' : (result.error ?? 'Connection failed'),
			result.success ? 'success' : 'error'
		);
		isConnecting = false;
	}

	async function handleDisconnect() {
		isConnecting = true;
		const result = await disconnectFromServer();
		showMessage(
			result.success ? 'Disconnected' : (result.error ?? 'Disconnect failed'),
			result.success ? 'success' : 'error'
		);
		isConnecting = false;
	}

	function applyPaths(data: {
		id?: string;
		paths?: { certPath?: string; keyPath?: string; caPath?: string };
	}) {
		config = applyCertPaths(config, data);
		handleSave();
	}

	function handleTruststoreUploaded(data: {
		truststorePath: string;
		caPath?: string;
		id?: string;
	}) {
		config = applyTruststoreResult(config, data);
		handleSave();
	}

	function handlePackageImported(data: {
		hostname?: string;
		port?: number;
		description?: string;
		truststorePath?: string;
		id?: string;
	}) {
		config = applyPackageImport(config, data);
		handleSave();
	}

	function showMessage(text: string, type: 'success' | 'error') {
		message = text;
		messageType = type;
		setTimeout(() => (message = ''), 4000);
	}

	function handleCertCleared() {
		config = clearCertPaths(config);
		handleSave();
		showMessage('Certificates cleared', 'success');
	}

	function handleTruststoreCleared() {
		config = clearTruststore(config);
		handleSave();
		showMessage('Truststore cleared', 'success');
	}
</script>

<ToolViewWrapper
	title="TAK Server Configuration"
	status={$takStatus.status === 'connected' ? 'Connected' : ''}
	onBack={() => activeView.set('map')}
>
	<div class="flex h-full flex-col gap-3 overflow-y-auto p-4">
		{#if isLoading}
			<p class="py-5 text-xs text-muted-foreground">Loading configuration...</p>
		{:else}
			<TakStatusSection
				port={config.port}
				{isConnecting}
				onConnect={handleConnect}
				onDisconnect={handleDisconnect}
				hasHostname={!!config.hostname}
			/>

			<Separator />
			<TakServerForm bind:config />

			<Separator />
			<TakAuthMethodPicker bind:config />

			<Separator />

			<!-- CLIENT CERTIFICATE / ENROLLMENT -->
			<div class="rounded-lg border border-border/60 bg-card/40 p-3">
				{#if config.authMethod === 'import'}
					<TakAuthImport
						{config}
						onCertUploaded={applyPaths}
						onCertCleared={handleCertCleared}
					/>
				{:else}
					<TakAuthEnroll {config} onEnrolled={applyPaths} />
				{/if}
			</div>

			<Separator />

			<div class="rounded-lg border border-border/60 bg-card/40 p-3">
				<TakTruststore
					{config}
					onUploaded={handleTruststoreUploaded}
					onTruststoreCleared={handleTruststoreCleared}
				/>
			</div>

			<Separator />

			<div class="rounded-lg border border-border/60 bg-card/40 p-3">
				<TakDataPackage configId={config.id} onImported={handlePackageImported} />
			</div>

			<Separator />

			<!-- SAVE -->
			<div class="flex items-center gap-2">
				<button
					onclick={handleSave}
					disabled={isSaving}
					class="inline-flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/20 px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/40 disabled:opacity-50"
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
						><path
							d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
						/><polyline points="17 21 17 13 7 13 7 21" /><polyline
							points="7 3 7 8 15 8"
						/></svg
					>
					{isSaving ? 'Saving...' : 'Save Configuration'}
				</button>
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
