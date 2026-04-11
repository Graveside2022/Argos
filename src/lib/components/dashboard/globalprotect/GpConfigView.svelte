<script lang="ts">
	import './gp-config-view.css';

	import { Save, Unplug } from '@lucide/svelte';
	import { untrack } from 'svelte';

	import GpOutputConsole from '$lib/components/dashboard/globalprotect/GpOutputConsole.svelte';
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
	let password = $state('');
	let isLoading = $state(true);
	let isSaving = $state(false);
	let isConnecting = $state(false);
	let message = $state('');
	let messageType: 'success' | 'error' = $state('success');
	let leftWidth = $state(340);
	let isDragging = $state(false);

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

	async function handleConnect() {
		if (!password.trim()) return;
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

	function onDragStart(e: MouseEvent) {
		e.preventDefault();
		isDragging = true;
		const onMove = (ev: MouseEvent) => {
			const container = (e.target as HTMLElement).parentElement;
			if (!container) return;
			const rect = container.getBoundingClientRect();
			const x = ev.clientX - rect.left;
			leftWidth = Math.max(280, Math.min(x, rect.width - 200));
		};
		const onUp = () => {
			isDragging = false;
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		};
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	}
</script>

<ToolViewWrapper
	title="GLOBALPROTECT VPN"
	status={$gpStatus.status === 'connected' ? 'Connected' : ''}
	onBack={() => activeView.set('map')}
>
	{#snippet actions()}
		{#if $gpStatus.status === 'connected'}
			<button
				class="inline-flex items-center gap-1.5 rounded-md border border-red-500/50 bg-red-600/20 px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-600/30"
				onclick={handleDisconnect}
			>
				<Unplug size={12} />
				Disconnect
			</button>
		{/if}
	{/snippet}
	<div class="gp-split-layout">
		{#if isLoading}
			<p class="loading-text">Loading configuration...</p>
		{:else}
			<div class="gp-left-panel" style="width: {leftWidth}px">
				<GpStatusSection
					{isConnecting}
					hasPortal={!!config.portal.trim() &&
						!!config.username.trim() &&
						!!password.trim()}
					onconnect={handleConnect}
				/>

				<Separator />

				<GpServerForm
					{config}
					onchange={(updated) => (config = updated)}
					{password}
					onpassword={(p) => (password = p)}
				/>

				<Separator />

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

				<button
					type="button"
					role="switch"
					aria-checked={config.connectOnStartup}
					class="startup-toggle"
					onclick={() =>
						(config = { ...config, connectOnStartup: !config.connectOnStartup })}
				>
					<div class="toggle-track" class:active={config.connectOnStartup}>
						<div class="toggle-thumb" class:active={config.connectOnStartup}></div>
					</div>
					Connect on startup
				</button>
			</div>

			<div
				class="gp-drag-handle"
				class:dragging={isDragging}
				role="separator"
				aria-orientation="vertical"
				aria-valuenow={leftWidth}
				tabindex="0"
				onmousedown={onDragStart}
				onkeydown={(e) => {
					if (e.key === 'ArrowLeft') {
						leftWidth = Math.max(280, leftWidth - 20);
						e.preventDefault();
					}
					if (e.key === 'ArrowRight') {
						leftWidth = leftWidth + 20;
						e.preventDefault();
					}
				}}
			></div>

			<div class="gp-right-panel">
				<GpOutputConsole />
			</div>
		{/if}
	</div>
</ToolViewWrapper>
