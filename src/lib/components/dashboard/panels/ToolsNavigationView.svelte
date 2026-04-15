<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import { toast } from 'svelte-sonner';

	import ToolCard from '$lib/components/dashboard/shared/ToolCard.svelte';
	import ToolCategoryCard from '$lib/components/dashboard/shared/ToolCategoryCard.svelte';
	import { activePanel, activeView } from '$lib/stores/dashboard/dashboard-store';
	import { currentCategory } from '$lib/stores/dashboard/tools-store';
	import { kismetStore, setKismetStatus } from '$lib/stores/tactical-map/kismet-store';
	import { isCategory, type ToolDefinition, type ToolStatus } from '$lib/types/tools';

	/**
	 * Tool endpoint configuration.
	 * - url/body pattern: single endpoint with action in JSON body (e.g. OpenWebRX)
	 * - startUrl/stopUrl pattern: separate endpoints (e.g. Kismet)
	 */
	interface ToolEndpoint {
		startUrl?: string;
		stopUrl?: string;
		controlUrl?: string; // Single URL with action body
	}

	const toolEndpoints: Record<string, ToolEndpoint> = {
		'kismet-wifi': { controlUrl: '/api/kismet/control' },
		'gsm-evil': { controlUrl: '/api/gsm-evil/control' },
		openwebrx: { controlUrl: '/api/openwebrx/control' },
		novasdr: { controlUrl: '/api/novasdr/control' },
		bluehood: { controlUrl: '/api/bluehood/control' },
		'blue-dragon': { controlUrl: '/api/bluedragon/control' },
		wigletotak: { controlUrl: '/api/wigletotak/control' },
		sightline: { controlUrl: '/api/sightline/control' },
		spiderfoot: { controlUrl: '/api/spiderfoot/control' },
		'sparrow-wifi': { controlUrl: '/api/sparrow/control' },
		sdrpp: { controlUrl: '/api/sdrpp/control' }
	};

	/** Local status store for tools without their own dedicated store (e.g. Docker-based tools) */
	const localStatuses = writable<Record<string, ToolStatus>>({});

	function setLocalStatus(toolId: string, status: ToolStatus) {
		localStatuses.update((s) => ({ ...s, [toolId]: status }));
	}

	/** Get live status — checks dedicated stores first, then local status map */
	function getLiveStatus(tool: ToolDefinition): ToolStatus {
		if (tool.id === 'kismet-wifi') return $kismetStore.status;
		return $localStatuses[tool.id] ?? tool.status ?? 'stopped';
	}

	/** Get live device count for tools that report it */
	function getLiveCount(tool: ToolDefinition): number | null {
		if (tool.id === 'kismet-wifi') return $kismetStore.deviceCount || null;
		return tool.count ?? null;
	}

	function handleOpen(tool: ToolDefinition) {
		if (tool.viewName) {
			activeView.set(tool.viewName);
			activePanel.set(null);
		} else if (tool.externalUrl) {
			window.open(tool.externalUrl, '_blank');
		}
	}

	/** Unified status setter that delegates to Kismet or local status. */
	function setToolStatus(toolId: string, status: ToolStatus) {
		if (toolId === 'kismet-wifi') setKismetStatus(status);
		else setLocalStatus(toolId, status);
	}

	/** Send a control action (start/stop/status) to a control URL. */
	function postControl(controlUrl: string, action: string): Promise<Response> {
		return fetch(controlUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action }),
			credentials: 'same-origin'
		});
	}

	/** Determine the fetch call for a start action. */
	function fetchStartAction(ep: (typeof toolEndpoints)[string]): Promise<Response> {
		if (ep.controlUrl) return postControl(ep.controlUrl, 'start');
		if (ep.startUrl) return fetch(ep.startUrl, { method: 'POST', credentials: 'same-origin' });
		throw new Error('No start URL configured for tool');
	}

	/** Determine the fetch call for a stop action. */
	function fetchStopAction(ep: (typeof toolEndpoints)[string]): Promise<Response> {
		if (ep.controlUrl) return postControl(ep.controlUrl, 'stop');
		if (ep.stopUrl) return fetch(ep.stopUrl, { method: 'POST', credentials: 'same-origin' });
		throw new Error('No stop URL configured for tool');
	}

	/** Handle a failed start by checking actual status via controlUrl. */
	async function checkStatusFallback(toolId: string, ep: (typeof toolEndpoints)[string]) {
		if (!ep.controlUrl) {
			setLocalStatus(toolId, 'stopped');
			return;
		}
		const statusRes = await postControl(ep.controlUrl, 'status');
		const statusData = await statusRes.json();
		const running = statusData.isRunning || statusData.running;
		setLocalStatus(toolId, running ? 'running' : 'stopped');
	}

	/** Handle start result for a non-Kismet tool. Returns true on success. */
	async function applyStartResult(
		toolId: string,
		data: Record<string, unknown>,
		ep: (typeof toolEndpoints)[string]
	): Promise<boolean> {
		if (data.success) {
			setLocalStatus(toolId, 'running');
			return true;
		}
		await checkStatusFallback(toolId, ep);
		return false;
	}

	/** Resolve the catch-block fallback status for a tool. Kismet assumes running on error. */
	function catchFallbackStatus(toolId: string): ToolStatus {
		return toolId === 'kismet-wifi' ? 'running' : 'stopped';
	}

	/** Apply Kismet-specific start result. */
	function applyKismetStartResult(data: Record<string, unknown>) {
		setKismetStatus(data.success ? 'running' : 'stopped');
	}

	/** Build the start-failure toast: prefer a HackRF conflict message, then server error, then generic. */
	function buildStartFailureMessage(tool: ToolDefinition, data: Record<string, unknown>): string {
		if (typeof data.conflictingService === 'string' && data.conflictingService.length > 0) {
			return `HackRF is in use by ${data.conflictingService}. Stop it first.`;
		}
		if (typeof data.error === 'string' && data.error.length > 0) return data.error;
		return `Failed to start ${tool.name}`;
	}

	/**
	 * Map of WebRX-family tools to their sibling. When a start auto-stops
	 * the peer via ResourceManager.forceRelease, we also refresh the peer's
	 * card so the UI reflects the new Stopped state without waiting for the
	 * next onMount or the 30s background poll.
	 */
	const WEBRX_PEER_OF: Record<string, string[]> = {
		openwebrx: ['novasdr', 'sdrpp'],
		novasdr: ['openwebrx', 'sdrpp'],
		sdrpp: ['openwebrx', 'novasdr']
	};

	/** Dispatch the start result to the Kismet-specific or generic path. Returns success. */
	async function dispatchStartResult(
		tool: ToolDefinition,
		data: Record<string, unknown>,
		ep: (typeof toolEndpoints)[string]
	): Promise<boolean> {
		if (tool.id === 'kismet-wifi') {
			applyKismetStartResult(data);
			return !!data.success;
		}
		return applyStartResult(tool.id, data, ep);
	}

	/** Apply the ok/error toast + refresh the WebRX peer card when applicable. */
	function finalizeStartResult(
		tool: ToolDefinition,
		data: Record<string, unknown>,
		ok: boolean
	): void {
		if (!ok) {
			toast.error(buildStartFailureMessage(tool, data));
			return;
		}
		toast.success(`${tool.name} started`);
		// If this tool has a WebRX peer, its server-side auto-stop may have
		// just happened — refresh the peer's card so it flips to Stopped.
		const peers = WEBRX_PEER_OF[tool.id];
		if (peers) peers.forEach((p) => refreshPeerStatus(p));
	}

	async function handleStart(tool: ToolDefinition) {
		const ep = toolEndpoints[tool.id];
		if (!ep) return;
		setToolStatus(tool.id, 'starting');
		try {
			const data = await (await fetchStartAction(ep)).json();
			const ok = await dispatchStartResult(tool, data, ep);
			finalizeStartResult(tool, data, ok);
		} catch {
			setToolStatus(tool.id, catchFallbackStatus(tool.id));
			toast.error(`Failed to start ${tool.name}`);
		}
	}

	/** Apply stop result: update status and show appropriate toast. */
	function applyStopResult(tool: ToolDefinition, data: Record<string, unknown>) {
		setToolStatus(tool.id, data.success ? 'stopped' : 'running');
		if (data.success) toast.success(`${tool.name} stopped`);
		else toast.error(`Failed to stop ${tool.name}`);
	}

	async function handleStop(tool: ToolDefinition) {
		const ep = toolEndpoints[tool.id];
		if (!ep) return;
		setToolStatus(tool.id, 'stopping');
		try {
			const data = await (await fetchStopAction(ep)).json();
			applyStopResult(tool, data);
		} catch {
			setToolStatus(tool.id, catchFallbackStatus(tool.id));
			toast.error(`Failed to stop ${tool.name}`);
		}
	}

	/** Check a tool's status via its controlUrl endpoint */
	function checkControlStatus(toolId: string): void {
		const ep = toolEndpoints[toolId];
		if (!ep?.controlUrl) return;
		postControl(ep.controlUrl, 'status')
			.then((r) => r.json())
			.then((data) => {
				if (data.isRunning || data.running) setLocalStatus(toolId, 'running');
			})
			.catch(() => {});
	}

	/**
	 * Bidirectional status refresh — unlike checkControlStatus, this sets the
	 * local state to either 'running' or 'stopped' based on the API response.
	 * Used to flip a peer WebSDR card to Stopped after the other WebSDR's start
	 * action auto-stopped it via ResourceManager.forceRelease.
	 */
	function refreshPeerStatus(toolId: string): void {
		const ep = toolEndpoints[toolId];
		if (!ep?.controlUrl) return;
		postControl(ep.controlUrl, 'status')
			.then((r) => r.json())
			.then((data) => {
				const running = data.isRunning || data.running;
				setLocalStatus(toolId, running ? 'running' : 'stopped');
			})
			.catch(() => {});
	}

	/** Check initial status of tools on mount */
	onMount(() => {
		checkControlStatus('openwebrx');
		checkControlStatus('novasdr');
		checkControlStatus('sightline');
		checkControlStatus('spiderfoot');

		// Tools with dedicated GET status endpoints
		fetch('/api/gsm-evil/status')
			.then((r) => r.json())
			.then((data) => {
				if (data.status === 'running') setLocalStatus('gsm-evil', 'running');
			})
			.catch(() => {});

		fetch('/api/bluehood/status')
			.then((r) => r.json())
			.then((data) => {
				if (data.isRunning) setLocalStatus('bluehood', 'running');
			})
			.catch(() => {});

		fetch('/api/wigletotak/status')
			.then((r) => r.json())
			.then((data) => {
				if (data.isRunning) setLocalStatus('wigletotak', 'running');
			})
			.catch(() => {});
	});
</script>

<div class="tools-navigation-view">
	{#if $currentCategory?.description}
		<p class="category-description">{$currentCategory.description}</p>
	{/if}

	<div class="items-list">
		{#each $currentCategory?.children || [] as item (item.id)}
			{#if isCategory(item)}
				<ToolCategoryCard category={item} />
			{:else}
				<ToolCard
					name={item.name}
					description={item.description}
					icon={item.icon}
					isInstalled={item.isInstalled}
					canOpen={item.canOpen}
					shouldShowControls={item.shouldShowControls}
					externalUrl={item.externalUrl}
					status={getLiveStatus(item)}
					count={getLiveCount(item)}
					onOpen={() => handleOpen(item)}
					onStart={() => handleStart(item)}
					onStop={() => handleStop(item)}
				/>
			{/if}
		{/each}
	</div>
</div>

<style>
	.tools-navigation-view {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-3);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.category-description {
		font-size: var(--text-xs);
		color: var(--foreground-secondary, #888888);
		line-height: 1.4;
		margin: 0;
		padding: 0 var(--space-1);
	}

	.items-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
</style>
