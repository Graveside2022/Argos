<script lang="ts">
	import { untrack } from 'svelte';

	import TakAuthEnroll from '$lib/components/dashboard/tak/TakAuthEnroll.svelte';
	import TakAuthImport from '$lib/components/dashboard/tak/TakAuthImport.svelte';
	import TakDataPackage from '$lib/components/dashboard/tak/TakDataPackage.svelte';
	import TakTruststore from '$lib/components/dashboard/tak/TakTruststore.svelte';
	import ToolViewWrapper from '$lib/components/dashboard/views/ToolViewWrapper.svelte';
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
	let isConnecting = $state(false);
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

	async function handleConnect() {
		isConnecting = true;
		try {
			const res = await fetch('/api/tak/connection', { method: 'POST' });
			const data = await res.json();
			if (data.success) {
				showMessage('Connecting...', 'success');
			} else {
				showMessage(data.error ?? 'Connection failed', 'error');
			}
		} catch {
			showMessage('Connection request failed', 'error');
		} finally {
			isConnecting = false;
		}
	}

	async function handleDisconnect() {
		isConnecting = true;
		try {
			const res = await fetch('/api/tak/connection', { method: 'DELETE' });
			const data = await res.json();
			if (data.success) {
				showMessage('Disconnected', 'success');
			} else {
				showMessage(data.error ?? 'Disconnect failed', 'error');
			}
		} catch {
			showMessage('Disconnect request failed', 'error');
		} finally {
			isConnecting = false;
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

	function handleCertCleared() {
		config.certPath = undefined;
		config.keyPath = undefined;
		config.caPath = undefined;
		saveConfig();
		showMessage('Certificates cleared', 'success');
	}

	function handleTruststoreCleared() {
		config.truststorePath = undefined;
		saveConfig();
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
			<!-- ═══ STATUS ═══ -->
			<div class="rounded-lg border border-border/60 bg-card/40 p-3">
				<span class="mb-2 block text-xs font-semibold tracking-widest text-muted-foreground"
					>STATUS</span
				>
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2 text-xs">
						<span
							class="size-2.5 shrink-0 rounded-full {$takStatus.status === 'connected'
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
					<div>
						{#if $takStatus.status === 'connected'}
							<button
								onclick={handleDisconnect}
								disabled={isConnecting}
								class="inline-flex items-center gap-1.5 rounded-md border border-red-500/50 bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-600/40 disabled:opacity-50"
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
									><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line
										x1="12"
										y1="2"
										x2="12"
										y2="12"
									/></svg
								>
								{isConnecting ? 'Disconnecting...' : 'Disconnect'}
							</button>
						{:else}
							<button
								onclick={handleConnect}
								disabled={isConnecting || !config.hostname}
								class="inline-flex items-center gap-1.5 rounded-md border border-green-500/50 bg-green-600/20 px-3 py-1.5 text-xs font-medium text-green-400 transition-colors hover:bg-green-600/40 disabled:opacity-50"
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
									><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line
										x1="12"
										y1="2"
										x2="12"
										y2="12"
									/></svg
								>
								{isConnecting ? 'Connecting...' : 'Connect'}
							</button>
						{/if}
					</div>
				</div>
			</div>

			<Separator />

			<!-- ═══ SERVER ═══ -->
			<div class="rounded-lg border border-border/60 bg-card/40 p-3">
				<span class="mb-2 block text-xs font-semibold tracking-widest text-muted-foreground"
					>SERVER</span
				>
				<div class="flex flex-col gap-2">
					<label
						class="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground"
					>
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
						class="flex cursor-pointer flex-row items-center gap-2 rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/40"
					>
						<Switch bind:checked={config.shouldConnectOnStartup} />
						Connect on startup
					</label>
				</div>
			</div>

			<Separator />

			<!-- ═══ AUTHENTICATION ═══ -->
			<div class="rounded-lg border border-border/60 bg-card/40 p-3">
				<span class="mb-2 block text-xs font-semibold tracking-widest text-muted-foreground"
					>AUTHENTICATION</span
				>
				<!-- @constitutional-exemption Article-IV-4.2 issue:#12 — No RadioGroup component installed; native radio with bind:group is idiomatic Svelte -->
				<div class="flex flex-col gap-2">
					<label
						class="flex cursor-pointer flex-row items-center gap-2.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors {config.authMethod ===
						'import'
							? 'border-primary/60 bg-primary/10 text-foreground'
							: 'border-border/40 bg-muted/10 text-muted-foreground hover:bg-muted/30'}"
					>
						<span
							class="flex size-4 shrink-0 items-center justify-center rounded-full border-2 {config.authMethod ===
							'import'
								? 'border-primary'
								: 'border-muted-foreground/50'}"
						>
							{#if config.authMethod === 'import'}
								<span class="size-2 rounded-full bg-primary"></span>
							{/if}
						</span>
						<input
							type="radio"
							bind:group={config.authMethod}
							value="import"
							class="sr-only"
						/>
						Import Certificate (.p12)
					</label>
					<label
						class="flex cursor-pointer flex-row items-center gap-2.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors {config.authMethod ===
						'enroll'
							? 'border-primary/60 bg-primary/10 text-foreground'
							: 'border-border/40 bg-muted/10 text-muted-foreground hover:bg-muted/30'}"
					>
						<span
							class="flex size-4 shrink-0 items-center justify-center rounded-full border-2 {config.authMethod ===
							'enroll'
								? 'border-primary'
								: 'border-muted-foreground/50'}"
						>
							{#if config.authMethod === 'enroll'}
								<span class="size-2 rounded-full bg-primary"></span>
							{/if}
						</span>
						<input
							type="radio"
							bind:group={config.authMethod}
							value="enroll"
							class="sr-only"
						/>
						Enroll for Certificate
					</label>
				</div>
			</div>

			<Separator />

			<!-- ═══ CLIENT CERTIFICATE / ENROLLMENT ═══ -->
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

			<!-- ═══ TRUST STORE ═══ -->
			<div class="rounded-lg border border-border/60 bg-card/40 p-3">
				<TakTruststore
					{config}
					onUploaded={handleTruststoreUploaded}
					onTruststoreCleared={handleTruststoreCleared}
				/>
			</div>

			<Separator />

			<!-- ═══ DATA PACKAGE ═══ -->
			<div class="rounded-lg border border-border/60 bg-card/40 p-3">
				<TakDataPackage configId={config.id} onImported={handlePackageImported} />
			</div>

			<Separator />

			<!-- ═══ SAVE ═══ -->
			<div class="flex items-center gap-2">
				<button
					onclick={saveConfig}
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
