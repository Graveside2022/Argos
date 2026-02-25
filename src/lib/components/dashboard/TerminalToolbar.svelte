<!-- Terminal toolbar: right-side action buttons for TerminalPanel -->
<script lang="ts">
	import {
		closeTerminalPanel,
		terminalPanelState,
		toggleMaximize,
		unsplit
	} from '$lib/stores/dashboard/terminal-store';

	interface Props {
		showMoreMenu: boolean;
		onSplit: (e: MouseEvent) => void;
		onCreateSession: (shell?: string) => void;
		onToggleMoreMenu: () => void;
		onCloseActiveSession: () => void;
	}

	let { showMoreMenu, onSplit, onCreateSession, onToggleMoreMenu, onCloseActiveSession }: Props =
		$props();
</script>

<div class="toolbar-right">
	<!-- Split/Unsplit button -->
	{#if $terminalPanelState.splits}
		<button
			class="toolbar-btn"
			aria-label="Unsplit terminal"
			title="Unsplit terminal"
			onclick={() => unsplit()}
		>
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<rect x="3" y="3" width="18" height="18" rx="2" />
			</svg>
		</button>
	{:else}
		<button
			class="toolbar-btn split-btn"
			aria-label="Split terminal"
			title="Split terminal"
			onclick={onSplit}
		>
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<rect x="3" y="3" width="18" height="18" rx="2" />
				<line x1="12" y1="3" x2="12" y2="21" />
			</svg>
		</button>
	{/if}

	<!-- More menu -->
	<div class="more-menu-wrapper">
		<button class="toolbar-btn" aria-label="More actions" onclick={onToggleMoreMenu}>
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<circle cx="12" cy="12" r="1" />
				<circle cx="12" cy="5" r="1" />
				<circle cx="12" cy="19" r="1" />
			</svg>
		</button>

		{#if showMoreMenu}
			<div class="dropdown-menu more-menu">
				<button class="dropdown-item" onclick={() => onToggleMoreMenu()}> Clear </button>
				{#if $terminalPanelState.splits}
					<button
						class="dropdown-item"
						onclick={() => {
							unsplit();
							onToggleMoreMenu();
						}}
					>
						Unsplit
					</button>
				{:else}
					<button class="dropdown-item" onclick={onSplit}> Split Right </button>
				{/if}
				<div class="dropdown-divider"></div>
				<button class="dropdown-item danger" onclick={onCloseActiveSession}>
					Kill Terminal
				</button>
			</div>
		{/if}
	</div>

	<!-- Maximize/restore button -->
	<button
		class="toolbar-btn"
		aria-label={$terminalPanelState.isMaximized ? 'Restore panel' : 'Maximize panel'}
		title={$terminalPanelState.isMaximized ? 'Restore panel' : 'Maximize panel'}
		onclick={toggleMaximize}
	>
		{#if $terminalPanelState.isMaximized}
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<polyline points="4 14 10 14 10 20" />
				<polyline points="20 10 14 10 14 4" />
				<line x1="14" y1="10" x2="21" y2="3" />
				<line x1="3" y1="21" x2="10" y2="14" />
			</svg>
		{:else}
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<polyline points="15 3 21 3 21 9" />
				<polyline points="9 21 3 21 3 15" />
				<line x1="21" y1="3" x2="14" y2="10" />
				<line x1="3" y1="21" x2="10" y2="14" />
			</svg>
		{/if}
	</button>

	<!-- System logs button -->
	<button
		class="toolbar-btn"
		aria-label="View system logs"
		title="View system logs"
		onclick={() => onCreateSession('scripts/tmux/tmux-logs.sh')}
	>
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
			<line x1="12" y1="8" x2="20" y2="8" />
			<line x1="8" y1="12" x2="20" y2="12" />
			<line x1="16" y1="16" x2="20" y2="16" />
		</svg>
	</button>

	<!-- Close panel button -->
	<button
		class="toolbar-btn"
		aria-label="Close panel"
		title="Close panel"
		onclick={closeTerminalPanel}
	>
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	</button>
</div>

<style>
	.toolbar-right {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		flex-shrink: 0;
	}

	.toolbar-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--palantir-text-secondary);
		cursor: pointer;
		transition:
			background 0.1s ease,
			color 0.1s ease;
	}

	.toolbar-btn:hover {
		background: var(--palantir-bg-elevated, #2e2e2e);
		color: var(--palantir-text-primary);
	}

	.more-menu-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.dropdown-menu {
		position: absolute;
		top: calc(100% + 4px);
		background: var(--palantir-bg-panel);
		border: 1px solid var(--palantir-border-default);
		border-radius: var(--radius-md);
		padding: var(--space-2);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
		z-index: 1000;
		min-width: 140px;
	}

	.more-menu {
		right: 0;
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		width: 100%;
		padding: var(--space-2) var(--space-3);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--palantir-text-secondary);
		font-size: var(--text-sm);
		text-align: left;
		cursor: pointer;
		transition: background 0.1s ease;
		white-space: nowrap;
	}

	.dropdown-item:hover {
		background: var(--palantir-bg-elevated, #2e2e2e);
		color: var(--palantir-text-primary);
	}

	.dropdown-item.danger:hover {
		background: color-mix(in srgb, var(--palantir-error) 10%, transparent);
		color: var(--palantir-error, #f87171);
	}

	.dropdown-divider {
		height: 1px;
		background: var(--palantir-border-subtle);
		margin: var(--space-1) 0;
	}
</style>
