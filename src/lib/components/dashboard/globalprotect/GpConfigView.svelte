<script lang="ts">
	import './gp-config-view.css';

	import { Save } from '@lucide/svelte';
	import { untrack } from 'svelte';

	import GpAuthMethodPicker from '$lib/components/dashboard/globalprotect/GpAuthMethodPicker.svelte';
	import GpCertImport from '$lib/components/dashboard/globalprotect/GpCertImport.svelte';
	import GpServerForm from '$lib/components/dashboard/globalprotect/GpServerForm.svelte';
	import GpStatusSection from '$lib/components/dashboard/globalprotect/GpStatusSection.svelte';
	import ToolViewWrapper from '$lib/components/dashboard/views/ToolViewWrapper.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { activeView } from '$lib/stores/dashboard/dashboard-store';
	import { gpStatus } from '$lib/stores/globalprotect-store';
	import type { GlobalProtectConfig } from '$lib/types/globalprotect';

	import {
		connectVpn,
		DEFAULT_CONFIG,
		disconnectVpn,
		loadConfig,
		saveConfig
	} from './gp-config-logic';

	let config: GlobalProtectConfig = $state({ ...DEFAULT_CONFIG });
	let isLoading = $state(true);
	let isSaving = $state(false);
	let isConnecting = $state(false);
	let message = $state('');
	let messageType: 'success' | 'error' = $state('success');

	$effect(() => {
		untrack(() => initConfig());
	});

	async function initConfig() {
		isLoading = true;
		try {
			config = await loadConfig();
		} catch {
			showMessage('Failed to load configuration', 'error');
		} finally {
			isLoading = false;
		}
	}

	async function handleSave() {
		isSaving = true;
		const result = await saveConfig(config);
		if (result.success) {
			showMessage('Configuration saved', 'success');
		} else {
			showMessage(result.message, 'error');
		}
		isSaving = false;
	}

	async function handleConnect(password: string) {
		isConnecting = true;
		const status = await connectVpn(config.portal, config.username, password);
		if (status.status === 'error') {
			showMessage(status.lastError ?? 'Connection failed', 'error');
		} else {
			showMessage('VPN connected', 'success');
		}
		isConnecting = false;
	}

	async function handleDisconnect() {
		await disconnectVpn();
		showMessage('VPN disconnected', 'success');
	}

	function showMessage(text: string, type: 'success' | 'error') {
		message = text;
		messageType = type;
		setTimeout(() => (message = ''), 4000);
	}
</script>

<ToolViewWrapper
	title="GLOBALPROTECT VPN"
	status={$gpStatus.status === 'connected' ? 'Connected' : ''}
	onBack={() => activeView.set('map')}
>
	<div class="gp-body">
		{#if isLoading}
			<p class="loading-text">Loading configuration...</p>
		{:else}
			<GpStatusSection
				{isConnecting}
				hasPortal={!!config.portal.trim() && !!config.username.trim()}
				onconnect={handleConnect}
				ondisconnect={handleDisconnect}
			/>

			<Separator />

			<GpServerForm {config} onchange={(updated) => (config = updated)} />

			<Separator />

			<GpAuthMethodPicker
				authMethod={config.authMethod}
				onchange={(method) => (config = { ...config, authMethod: method })}
			/>

			{#if config.authMethod === 'certificate'}
				<Separator />

				<GpCertImport
					certificatePath={config.certificatePath}
					onpathchange={(path) => (config = { ...config, certificatePath: path })}
				/>
			{/if}

			<Separator />

			<!-- SAVE -->
			<div class="save-row">
				<button onclick={handleSave} disabled={isSaving} class="save-btn">
					<Save size={14} />
					{isSaving ? 'Saving...' : 'Save Configuration'}
				</button>
				{#if message}
					<span
						class="save-message"
						class:success={messageType === 'success'}
						class:error={messageType === 'error'}
					>
						{message}
					</span>
				{/if}
			</div>
		{/if}
	</div>
</ToolViewWrapper>
