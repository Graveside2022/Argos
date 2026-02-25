<script lang="ts">
	import type { Snippet } from 'svelte';

	import IconRail from './IconRail.svelte';
	import TopStatusBar from './TopStatusBar.svelte';

	interface Props {
		mode: 'sidebar' | 'full-width';
		sidebar?: Snippet;
		content?: Snippet;
		fullWidth?: Snippet;
		bottomPanel?: Snippet;
	}

	let { mode, sidebar, content, fullWidth, bottomPanel }: Props = $props();
</script>

<div class="dashboard-shell">
	<IconRail />
	<div class="shell-right">
		<TopStatusBar />
		<div class="content-area" class:content-sidebar={mode === 'sidebar'}>
			{#if mode === 'sidebar'}
				{#if sidebar}
					<div class="left-panel">
						{@render sidebar()}
					</div>
				{/if}
				{#if content}
					<div class="main-content">
						{@render content()}
					</div>
				{/if}
			{:else if fullWidth}
				<div class="full-width">
					{@render fullWidth()}
				</div>
			{/if}
		</div>
		{#if bottomPanel}
			<div class="bottom-area">
				{@render bottomPanel()}
			</div>
		{/if}
	</div>
</div>

<style>
	.dashboard-shell {
		height: 100vh;
		width: 100vw;
		display: flex;
		flex-direction: row;
		overflow: hidden;
		background: var(--background);
		color: var(--foreground);
		font-family: var(--font-sans);
	}

	.shell-right {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-width: 0;
	}

	.content-area {
		flex: 1;
		display: flex;
		overflow: hidden;
		min-height: 0;
	}

	.content-area.content-sidebar {
		flex-direction: row;
	}

	.left-panel {
		width: var(--panel-width, 280px);
		min-width: var(--panel-width, 280px);
		flex: 0 0 var(--panel-width, 280px);
		overflow-y: auto;
		overflow-x: hidden;
		background: var(--card);
		border-right: 1px solid var(--border);
	}

	.main-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-width: 0;
		min-height: 0;
	}

	.full-width {
		flex: 1;
		overflow: auto;
		min-width: 0;
	}

	.bottom-area {
		flex: 0 0 auto;
	}
</style>
