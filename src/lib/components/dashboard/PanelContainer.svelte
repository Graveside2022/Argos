<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import { browser } from '$app/environment';
	import { activePanel } from '$lib/stores/dashboard/dashboard-store';
	import { themeStore } from '$lib/stores/theme-store.svelte';

	import HardwareConfigPanel from './panels/HardwareConfigPanel.svelte';
	import LayersPanel from './panels/LayersPanel.svelte';
	import OnnetToolsPanel from './panels/OnnetToolsPanel.svelte';
	import OverviewPanel from './panels/OverviewPanel.svelte';
	import SettingsPanel from './panels/SettingsPanel.svelte';
	import ToolsPanel from './panels/ToolsPanel.svelte';

	let isOpen = $derived($activePanel !== null);
	let isHorizontal = $derived(
		themeStore.railPosition === 'top' || themeStore.railPosition === 'bottom'
	);

	// Resizable height state for top/bottom positions
	let panelHeight = $state(320);
	let isDragging = $state(false);
	let startY = $state(0);
	let startHeight = $state(0);

	const MIN_HEIGHT = 100;
	let maxHeight = $derived(browser ? window.innerHeight * 0.6 : 500);

	function handleMouseDown(e: MouseEvent) {
		e.preventDefault();
		isDragging = true;
		startY = e.clientY;
		startHeight = panelHeight;
		document.body.style.cursor = 'ns-resize';
		document.body.style.userSelect = 'none';
	}

	function handleTouchStart(e: TouchEvent) {
		if (e.touches.length !== 1) return;
		isDragging = true;
		startY = e.touches[0].clientY;
		startHeight = panelHeight;
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;
		const deltaY = themeStore.railPosition === 'top' ? e.clientY - startY : startY - e.clientY;
		panelHeight = Math.max(MIN_HEIGHT, Math.min(maxHeight, startHeight + deltaY));
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isDragging || e.touches.length !== 1) return;
		const deltaY =
			themeStore.railPosition === 'top'
				? e.touches[0].clientY - startY
				: startY - e.touches[0].clientY;
		panelHeight = Math.max(MIN_HEIGHT, Math.min(maxHeight, startHeight + deltaY));
	}

	function handleMouseUp() {
		if (!isDragging) return;
		isDragging = false;
		document.body.style.cursor = '';
		document.body.style.userSelect = '';
	}

	function handleDoubleClick() {
		const midHeight = browser ? window.innerHeight * 0.4 : 320;
		if (panelHeight < midHeight * 0.8) {
			panelHeight = midHeight;
		} else {
			panelHeight = MIN_HEIGHT;
		}
	}

	onMount(() => {
		if (!browser) return;
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
		window.addEventListener('touchmove', handleTouchMove);
		window.addEventListener('touchend', handleMouseUp);

		return () => {
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);
			window.removeEventListener('touchmove', handleTouchMove);
			window.removeEventListener('touchend', handleMouseUp);
		};
	});

	onDestroy(() => {
		if (browser) {
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		}
	});
</script>

<aside
	class="panel-container"
	class:open={isOpen}
	class:dragging={isDragging}
	data-position={themeStore.railPosition}
	style:height={isHorizontal && isOpen ? `${panelHeight}px` : undefined}
	style:min-height={isHorizontal && isOpen ? `${panelHeight}px` : undefined}
>
	{#if isOpen}
		<!-- Drag handle for top position (at bottom edge) -->
		{#if themeStore.railPosition === 'top'}
			<div class="panel-content">
				{#if $activePanel === 'overview'}
					<OverviewPanel />
				{:else if $activePanel === 'tools'}
					<ToolsPanel />
				{:else if $activePanel === 'layers'}
					<LayersPanel />
				{:else if $activePanel === 'settings'}
					<SettingsPanel />
				{:else if $activePanel === 'hardware'}
					<HardwareConfigPanel />
				{:else if $activePanel === 'onnet-tools'}
					<OnnetToolsPanel />
				{/if}
			</div>
			<div
				class="drag-handle"
				role="separator"
				aria-orientation="horizontal"
				aria-valuenow={panelHeight}
				aria-valuemin={MIN_HEIGHT}
				aria-valuemax={maxHeight}
				tabindex="0"
				onmousedown={handleMouseDown}
				ontouchstart={handleTouchStart}
				ondblclick={handleDoubleClick}
				onkeydown={(e) => {
					if (e.key === 'ArrowDown') {
						e.preventDefault();
						panelHeight = Math.min(maxHeight, panelHeight + 20);
					} else if (e.key === 'ArrowUp') {
						e.preventDefault();
						panelHeight = Math.max(MIN_HEIGHT, panelHeight - 20);
					}
				}}
			>
				<div class="drag-indicator"></div>
			</div>
		{:else if themeStore.railPosition === 'bottom'}
			<!-- Drag handle for bottom position (at top edge) -->
			<div
				class="drag-handle"
				role="separator"
				aria-orientation="horizontal"
				aria-valuenow={panelHeight}
				aria-valuemin={MIN_HEIGHT}
				aria-valuemax={maxHeight}
				tabindex="0"
				onmousedown={handleMouseDown}
				ontouchstart={handleTouchStart}
				ondblclick={handleDoubleClick}
				onkeydown={(e) => {
					if (e.key === 'ArrowUp') {
						e.preventDefault();
						panelHeight = Math.min(maxHeight, panelHeight + 20);
					} else if (e.key === 'ArrowDown') {
						e.preventDefault();
						panelHeight = Math.max(MIN_HEIGHT, panelHeight - 20);
					}
				}}
			>
				<div class="drag-indicator"></div>
			</div>
			<div class="panel-content">
				{#if $activePanel === 'overview'}
					<OverviewPanel />
				{:else if $activePanel === 'tools'}
					<ToolsPanel />
				{:else if $activePanel === 'layers'}
					<LayersPanel />
				{:else if $activePanel === 'settings'}
					<SettingsPanel />
				{:else if $activePanel === 'hardware'}
					<HardwareConfigPanel />
				{:else if $activePanel === 'onnet-tools'}
					<OnnetToolsPanel />
				{/if}
			</div>
		{:else}
			<!-- Left/Right: no drag handle -->
			<div class="panel-content">
				{#if $activePanel === 'overview'}
					<OverviewPanel />
				{:else if $activePanel === 'tools'}
					<ToolsPanel />
				{:else if $activePanel === 'layers'}
					<LayersPanel />
				{:else if $activePanel === 'settings'}
					<SettingsPanel />
				{:else if $activePanel === 'hardware'}
					<HardwareConfigPanel />
				{:else if $activePanel === 'onnet-tools'}
					<OnnetToolsPanel />
				{/if}
			</div>
		{/if}
	{/if}
</aside>

<style>
	@import './panel-container.css';

	/* ---- Default (left) ---- */
	.panel-container {
		width: 0;
		min-width: 0;
		overflow: hidden;
		background: var(--surface-elevated, #151515);
		border-right: 1px solid var(--border);
		box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
		transition:
			width 0.2s ease,
			min-width 0.2s ease,
			height 0.2s ease,
			min-height 0.2s ease;
		display: flex;
		flex-direction: column;
		z-index: 5;
		flex-shrink: 0;
	}

	.panel-container.dragging {
		transition: none;
		user-select: none;
	}

	.panel-container.open {
		width: var(--panel-width);
		min-width: var(--panel-width);
	}

	.panel-content {
		width: var(--panel-width);
		height: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}

	/* ---- Right ---- */
	.panel-container[data-position='right'] {
		border-right: none;
		border-left: 1px solid var(--border);
		box-shadow: -2px 0 8px rgba(0, 0, 0, 0.3);
	}

	/* ---- Top ---- */
	.panel-container[data-position='top'],
	.panel-container[data-position='bottom'] {
		width: 100%;
		min-width: 100%;
		height: 0;
		min-height: 0;
		border-right: none;
		box-shadow: none;
	}

	.panel-container[data-position='top'].open,
	.panel-container[data-position='bottom'].open {
		width: 100%;
		min-width: 100%;
		height: 320px;
		min-height: 100px;
	}

	.panel-container[data-position='top'] .panel-content,
	.panel-container[data-position='bottom'] .panel-content {
		width: 100%;
	}

	.panel-container[data-position='top'] {
		border-bottom: 1px solid var(--border);
	}

	/* ---- Bottom ---- */
	.panel-container[data-position='bottom'] {
		border-top: 1px solid var(--border);
	}
</style>
