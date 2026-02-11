<script lang="ts">
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import { currentCategory } from '$lib/stores/dashboard/tools-store';
	import { isCategory, type ToolDefinition, type ToolStatus } from '$lib/types/tools';
	import { activeView, activePanel } from '$lib/stores/dashboard/dashboard-store';
	import { kismetStore, setKismetStatus } from '$lib/stores/tactical-map/kismet-store';
	import ToolCategoryCard from '$lib/components/dashboard/shared/ToolCategoryCard.svelte';
	import ToolCard from '$lib/components/dashboard/shared/ToolCard.svelte';

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
		openwebrx: { controlUrl: '/api/openwebrx/control' }
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
		if (tool.externalUrl) {
			window.open(tool.externalUrl, '_blank');
		} else if (tool.viewName) {
			activeView.set(tool.viewName);
			activePanel.set(null);
		}
	}

	async function handleStart(tool: ToolDefinition) {
		const ep = toolEndpoints[tool.id];
		if (!ep) return;

		// Set starting state
		if (tool.id === 'kismet-wifi') {
			setKismetStatus('starting');
		} else {
			setLocalStatus(tool.id, 'starting');
		}

		try {
			let res: Response;
			if (ep.controlUrl) {
				res = await fetch(ep.controlUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'start' })
				});
			} else {
				res = await fetch(ep.startUrl!, { method: 'POST' });
			}

			const data = await res.json();

			if (tool.id === 'kismet-wifi') {
				setKismetStatus(data.success ? 'running' : 'stopped');
			} else {
				// If start was rejected (409) because the tool is already running, check status
				if (!data.success && ep.controlUrl) {
					const statusRes = await fetch(ep.controlUrl, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ action: 'status' })
					});
					const statusData = await statusRes.json();
					setLocalStatus(tool.id, statusData.running ? 'running' : 'stopped');
				} else {
					setLocalStatus(tool.id, data.success ? 'running' : 'stopped');
				}
			}
		} catch {
			if (tool.id === 'kismet-wifi') {
				setKismetStatus('running');
			} else {
				setLocalStatus(tool.id, 'stopped');
			}
		}
	}

	async function handleStop(tool: ToolDefinition) {
		const ep = toolEndpoints[tool.id];
		if (!ep) return;

		// Set stopping state
		if (tool.id === 'kismet-wifi') {
			setKismetStatus('stopping');
		} else {
			setLocalStatus(tool.id, 'stopping');
		}

		try {
			let res: Response;
			if (ep.controlUrl) {
				res = await fetch(ep.controlUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'stop' })
				});
			} else {
				res = await fetch(ep.stopUrl!, { method: 'POST' });
			}

			const data = await res.json();

			if (tool.id === 'kismet-wifi') {
				setKismetStatus(data.success ? 'stopped' : 'running');
			} else {
				setLocalStatus(tool.id, data.success ? 'stopped' : 'running');
			}
		} catch {
			if (tool.id === 'kismet-wifi') {
				setKismetStatus('running');
			} else {
				setLocalStatus(tool.id, 'stopped');
			}
		}
	}

	/** Check initial status of tools on mount */
	onMount(() => {
		// Check OpenWebRX container status
		const openwebrxEp = toolEndpoints['openwebrx'];
		if (openwebrxEp?.controlUrl) {
			fetch(openwebrxEp.controlUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'status' })
			})
				.then((r) => r.json())
				.then((data) => {
					if (data.running) setLocalStatus('openwebrx', 'running');
				})
				.catch(() => {});
		}

		// Check GSM Evil process status (uses dedicated GET endpoint)
		fetch('/api/gsm-evil/status')
			.then((r) => r.json())
			.then((data) => {
				if (data.status === 'running') setLocalStatus('gsm-evil', 'running');
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
					installed={item.installed}
					canOpen={item.canOpen}
					showControls={item.showControls}
					externalUrl={item.externalUrl}
					status={getLiveStatus(item)}
					count={getLiveCount(item)}
					onopen={() => handleOpen(item)}
					onstart={() => handleStart(item)}
					onstop={() => handleStop(item)}
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
		color: var(--palantir-text-tertiary);
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
