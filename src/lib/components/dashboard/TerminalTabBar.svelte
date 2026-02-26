<!-- Terminal tab bar: session tabs and shell dropdown for TerminalPanel -->
<script lang="ts">
	import {
		setActiveSession,
		terminalPanelState,
		terminalSessions
	} from '$lib/stores/dashboard/terminal-store';
	import type { ShellInfo } from '$lib/types/terminal';

	interface Props {
		availableShells: ShellInfo[];
		showShellDropdown: boolean;
		onCreateSession: (shell?: string) => void;
		onCloseSession: (e: MouseEvent, sessionId: string) => void;
		onToggleShellDropdown: () => void;
	}

	let {
		availableShells,
		showShellDropdown,
		onCreateSession,
		onCloseSession,
		onToggleShellDropdown
	}: Props = $props();
</script>

<div class="toolbar-left">
	<div class="tab-list" role="tablist">
		{#each $terminalSessions as session (session.id)}
			<div
				class="terminal-tab"
				class:active={session.id === $terminalPanelState.activeTabId}
				role="tab"
				aria-selected={session.id === $terminalPanelState.activeTabId}
				tabindex="0"
				onclick={() => setActiveSession(session.id)}
				onkeydown={(e) => e.key === 'Enter' && setActiveSession(session.id)}
			>
				<span class="tab-icon">
					<svg
						width="12"
						height="12"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<polyline points="4 17 10 11 4 5" />
						<line x1="12" y1="19" x2="20" y2="19" />
					</svg>
				</span>
				<span class="tab-title">{session.title}</span>
				<button
					class="tab-close"
					aria-label="Close terminal"
					onclick={(e) => onCloseSession(e, session.id)}
				>
					<svg
						width="12"
						height="12"
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
		{/each}
	</div>

	<!-- Add new terminal button with dropdown -->
	<div class="shell-dropdown-wrapper">
		<button
			class="toolbar-btn add-btn"
			aria-label={$terminalPanelState.splits ? 'Add split pane' : 'New terminal'}
			title={$terminalPanelState.splits ? 'Add split pane' : 'New terminal'}
			onclick={() => onCreateSession()}
		>
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<line x1="12" y1="5" x2="12" y2="19" />
				<line x1="5" y1="12" x2="19" y2="12" />
			</svg>
		</button>
		<button
			class="toolbar-btn dropdown-toggle"
			aria-label={$terminalPanelState.splits
				? 'Select tmux profile for split'
				: 'Select tmux profile'}
			title={$terminalPanelState.splits
				? 'Select tmux profile for split'
				: 'Select tmux profile'}
			onclick={onToggleShellDropdown}
		>
			<svg
				width="10"
				height="10"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<polyline points="6 9 12 15 18 9" />
			</svg>
		</button>

		{#if showShellDropdown}
			<div class="dropdown-menu">
				{#each availableShells as shell}
					<button class="dropdown-item" onclick={() => onCreateSession(shell.path)}>
						<span style="flex: 1">{shell.name}</span>
						{#if shell.isDefault}
							<span class="default-badge">default</span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.toolbar-left {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex: 1;
		min-width: 0;
	}

	.tab-list {
		display: flex;
		align-items: center;
		gap: 4px;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.tab-list::-webkit-scrollbar {
		display: none;
	}

	.terminal-tab {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: 6px 12px;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--foreground-muted);
		font-size: var(--text-sm);
		cursor: pointer;
		white-space: nowrap;
		transition:
			background 0.1s ease,
			color 0.1s ease;
	}

	.terminal-tab:hover,
	.terminal-tab.active {
		background: var(--surface-elevated);
		color: var(--foreground);
	}

	.tab-icon {
		display: flex;
		align-items: center;
		color: var(--foreground-secondary);
	}

	.tab-title {
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tab-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--foreground-secondary);
		cursor: pointer;
		opacity: 0;
		transition:
			opacity 0.1s ease,
			background 0.1s ease;
	}

	.terminal-tab:hover .tab-close,
	.terminal-tab.active .tab-close {
		opacity: 1;
	}

	.tab-close:hover {
		background: var(--card);
		color: var(--foreground);
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
		color: var(--foreground-muted);
		cursor: pointer;
		transition:
			background 0.1s ease,
			color 0.1s ease;
	}

	.toolbar-btn:hover {
		background: var(--surface-elevated);
		color: var(--foreground);
	}

	.add-btn {
		border-radius: var(--radius-sm) 0 0 var(--radius-sm);
	}

	.dropdown-toggle {
		width: 16px;
		border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
		border-left: 1px solid var(--border);
	}

	.shell-dropdown-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		margin-left: var(--space-1);
		padding-left: var(--space-2);
		border-left: 1px solid var(--border);
	}

	.dropdown-menu {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: var(--space-2);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
		z-index: 1000;
		min-width: 140px;
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
		color: var(--foreground-muted);
		font-size: var(--text-sm);
		text-align: left;
		cursor: pointer;
		transition: background 0.1s ease;
		white-space: nowrap;
	}

	.dropdown-item:hover {
		background: var(--surface-elevated);
		color: var(--foreground);
	}

	.default-badge {
		font-size: var(--text-status);
		padding: 1px 4px;
		background: var(--surface-elevated);
		border-radius: var(--radius-sm);
		color: var(--foreground-secondary);
	}
</style>
