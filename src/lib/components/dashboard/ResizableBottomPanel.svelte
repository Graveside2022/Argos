<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import { browser } from '$app/environment';

	interface Props {
		isOpen: boolean;
		height: number;
		minHeight?: number;
		maxHeightPercent?: number;
		onHeightChange?: (height: number) => void;
		onClose?: () => void;
		children?: import('svelte').Snippet;
	}

	let {
		isOpen,
		height,
		minHeight = 100,
		maxHeightPercent = 0.8,
		onHeightChange,
		onClose: _onClose,
		children
	}: Props = $props();

	let isDragging = $state(false);
	let startY = $state(0);
	let startHeight = $state(0);
	let panelEl: HTMLDivElement | undefined = $state();

	// Calculate max height based on viewport
	let maxHeight = $derived(browser ? window.innerHeight * maxHeightPercent : 600);

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

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;
		const deltaY = startY - e.clientY;
		const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
		onHeightChange?.(newHeight);
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isDragging || e.touches.length !== 1) return;
		const deltaY = startY - e.touches[0].clientY;
		const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
		onHeightChange?.(newHeight);
	}

	function handleMouseUp() {
		if (!isDragging) return;
		isDragging = false;
		document.body.style.cursor = '';
		document.body.style.userSelect = '';
	}

	function handleDoubleClick() {
		// Toggle between min height and 50% of viewport
		const midHeight = browser ? window.innerHeight * 0.5 : 400;
		if (height < midHeight * 0.8) {
			onHeightChange?.(midHeight);
		} else {
			onHeightChange?.(minHeight);
		}
	}

	// Global mouse/touch event handlers
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

{#if isOpen}
	<div
		class="resizable-panel"
		class:dragging={isDragging}
		style="height: {height}px"
		bind:this={panelEl}
	>
		<!-- Drag handle -->
		<div
			class="drag-handle"
			role="separator"
			aria-orientation="horizontal"
			aria-valuenow={height}
			aria-valuemin={minHeight}
			aria-valuemax={maxHeight}
			tabindex="0"
			onmousedown={handleMouseDown}
			ontouchstart={handleTouchStart}
			ondblclick={handleDoubleClick}
			onkeydown={(e) => {
				if (e.key === 'ArrowUp') {
					e.preventDefault();
					onHeightChange?.(Math.min(maxHeight, height + 20));
				} else if (e.key === 'ArrowDown') {
					e.preventDefault();
					onHeightChange?.(Math.max(minHeight, height - 20));
				}
			}}
		>
			<div class="drag-indicator"></div>
		</div>

		<!-- Panel content -->
		<div class="panel-content">
			{@render children?.()}
		</div>
	</div>

	{#if isDragging}
		<div class="drag-overlay" role="presentation"></div>
	{/if}
{/if}

<style>
	.resizable-panel {
		display: flex;
		flex-direction: column;
		background: var(--palantir-bg-panel, #0e1116);
		border-top: 1px solid var(--palantir-border-default, #2a2f38);
		overflow: hidden;
		flex-shrink: 0;
		transition: height 0.05s ease-out;
	}

	.resizable-panel.dragging {
		transition: none;
		user-select: none;
	}

	.drag-handle {
		height: 6px;
		min-height: 6px;
		background: var(--palantir-bg-surface, #12161c);
		cursor: ns-resize;
		display: flex;
		align-items: center;
		justify-content: center;
		border-bottom: 1px solid var(--palantir-border-subtle, #1e2228);
		transition: background 0.15s ease;
	}

	.drag-handle:hover,
	.drag-handle:focus {
		background: var(--palantir-bg-elevated, #1a1f27);
	}

	.drag-handle:focus {
		outline: none;
		box-shadow: inset 0 0 0 2px var(--palantir-accent, #4a9eff);
	}

	.drag-indicator {
		width: 40px;
		height: 3px;
		background: var(--palantir-border-default, #2a2f38);
		border-radius: 2px;
		transition: background 0.15s ease;
	}

	.drag-handle:hover .drag-indicator,
	.drag-handle:focus .drag-indicator {
		background: var(--palantir-text-tertiary, #5f6368);
	}

	.panel-content {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
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
