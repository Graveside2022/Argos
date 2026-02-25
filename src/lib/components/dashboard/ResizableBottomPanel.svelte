<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import { browser } from '$app/environment';

	/** Height of the always-visible tab bar strip */
	const TAB_BAR_HEIGHT = 40;

	interface Props {
		isOpen: boolean;
		height: number;
		minHeight?: number;
		maxHeightPercent?: number;
		onHeightChange?: (height: number) => void;
		onOpen?: () => void;
		children?: import('svelte').Snippet;
	}

	let {
		isOpen,
		height,
		minHeight = 120,
		maxHeightPercent = 0.8,
		onHeightChange,
		onOpen,
		children
	}: Props = $props();

	let isDragging = $state(false);
	let startY = $state(0);
	let startHeight = $state(0);

	let maxHeight = $derived(browser ? window.innerHeight * maxHeightPercent : 600);

	// When open: full height (tab bar + content). When collapsed: tab bar only.
	let panelHeight = $derived(isOpen ? height : TAB_BAR_HEIGHT);

	function handleMouseDown(e: MouseEvent) {
		e.preventDefault();
		isDragging = true;
		startY = e.clientY;
		startHeight = height;
		document.body.style.cursor = 'ns-resize';
		document.body.style.userSelect = 'none';
	}

	function handleTouchStart(e: TouchEvent) {
		if (e.touches.length !== 1) return;
		isDragging = true;
		startY = e.touches[0].clientY;
		startHeight = height;
	}

	function applyDrag(deltaY: number) {
		if (!isOpen && deltaY > 10) onOpen?.();
		const newHeight = Math.max(
			minHeight + TAB_BAR_HEIGHT,
			Math.min(maxHeight, startHeight + deltaY)
		);
		onHeightChange?.(newHeight);
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;
		applyDrag(startY - e.clientY);
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isDragging || e.touches.length !== 1) return;
		applyDrag(startY - e.touches[0].clientY);
	}

	function handleMouseUp() {
		if (!isDragging) return;
		isDragging = false;
		document.body.style.cursor = '';
		document.body.style.userSelect = '';
	}

	const KEY_HEIGHTS: Record<string, () => number> = {
		ArrowUp: () => Math.min(maxHeight, height + 20),
		ArrowDown: () => Math.max(minHeight + TAB_BAR_HEIGHT, height - 20)
	};

	function handleKeydown(e: KeyboardEvent) {
		if (!isOpen || !(e.key in KEY_HEIGHTS)) return;
		e.preventDefault();
		onHeightChange?.(KEY_HEIGHTS[e.key]());
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

<div class="resizable-panel" class:dragging={isDragging} style="height: {panelHeight}px">
	<!-- Drag handle at the very top — grab here to resize -->
	<div
		class="drag-handle"
		role="separator"
		aria-orientation="horizontal"
		aria-label="Resize panel"
		aria-valuenow={height}
		aria-valuemin={minHeight}
		aria-valuemax={maxHeight}
		tabindex="0"
		onmousedown={handleMouseDown}
		ontouchstart={handleTouchStart}
		onkeydown={handleKeydown}
	>
		<div class="drag-indicator"></div>
	</div>

	<!-- Panel content (tab bar + body) -->
	<div class="panel-body">
		{@render children?.()}
	</div>
</div>

{#if isDragging}
	<div class="drag-overlay" role="presentation"></div>
{/if}

<style>
	.resizable-panel {
		display: flex;
		flex-direction: column;
		background: var(--card, #1a1a1a);
		border-top: 1px solid var(--border, #2e2e2e);
		flex-shrink: 0;
		overflow: hidden;
		transition: height 0.15s ease;
	}

	.resizable-panel.dragging {
		transition: none;
	}

	.drag-handle {
		height: 12px;
		min-height: 12px;
		flex-shrink: 0;
		background: #161616;
		cursor: ns-resize;
		display: flex;
		align-items: center;
		justify-content: center;
		border-bottom: 1px solid var(--border, #2e2e2e);
		transition: background 0.15s ease;
	}

	.drag-handle:hover,
	.drag-handle:focus {
		background: #2a2a2a;
		outline: none;
	}

	.drag-indicator {
		width: 40px;
		height: 4px;
		background: #606060;
		border-radius: 3px;
		transition: background 0.15s ease;
	}

	.drag-handle:hover .drag-indicator,
	.drag-handle:focus .drag-indicator {
		background: #888888;
	}

	.panel-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-height: 0;
	}

	.drag-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		z-index: 9999;
		cursor: ns-resize;
	}
</style>
