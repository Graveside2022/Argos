<!-- @constitutional-exemption Article-IV-4.3 issue:#TBD — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<!-- @constitutional-exemption Article-IV-4.2 issue:#TBD — Button pattern extraction deferred to component library refactor -->
<script lang="ts">
	import { onMount } from 'svelte';

	import { browser } from '$app/environment';
	import {
		activeSession,
		closeSession,
		closeTerminalPanel,
		createSession,
		renameSession,
		setActiveSession,
		terminalPanelState,
		terminalSessions,
		toggleMaximize,
		unsplit
	} from '$lib/stores/dashboard/terminal-store';
	import type { ShellInfo } from '$lib/types/terminal';

	import TerminalTabContent from './TerminalTabContent.svelte';

	// Available shells from API
	let availableShells = $state<ShellInfo[]>([]);
	let showShellDropdown = $state(false);
	let showMoreMenu = $state(false);
	let pendingSplitSessionId = $state<string | null>(null); // Track if we're adding a split

	// Fetch available shells on mount
	onMount(async () => {
		if (!browser) return;

		try {
			const res = await fetch('/api/terminal/shells');
			if (res.ok) {
				const data = await res.json();
				availableShells = data.shells;
			}
		} catch {
			// Use fallback
			availableShells = [{ path: '/bin/zsh', name: 'zsh', isDefault: true }];
		}
	});

	function handleCreateSession(shell?: string) {
		const newSessionId = createSession(shell);

		// If we're adding a split (pendingSplitSessionId is set)
		if (pendingSplitSessionId) {
			const originalSessionId = pendingSplitSessionId;
			terminalPanelState.update((s) => {
				if (s.splits) {
					// Already split - add to existing split (max 4 panes)
					if (s.splits.sessionIds.length >= 4) return s;

					const newSessionIds = [...s.splits.sessionIds, newSessionId];
					const equalWidth = 100 / newSessionIds.length;
					return {
						...s,
						splits: {
							...s.splits,
							sessionIds: newSessionIds,
							widths: newSessionIds.map(() => equalWidth)
						}
					};
				} else {
					// Create new split with the original session and the new one
					return {
						...s,
						splits: {
							id: Math.random().toString(36).substring(2, 9),
							sessionIds: [originalSessionId, newSessionId],
							widths: [50, 50]
						}
					};
				}
			});
			pendingSplitSessionId = null;
		}

		showShellDropdown = false;
	}

	function handleCloseSession(e: MouseEvent, sessionId: string) {
		e.stopPropagation();
		closeSession(sessionId);
	}

	function handleTitleChange(sessionId: string, newTitle: string) {
		renameSession(sessionId, newTitle);
	}

	function handleSplit(e: MouseEvent) {
		e.stopPropagation(); // Prevent window click handler from closing the dropdown
		const active = $activeSession;
		if (active) {
			// Instead of auto-creating a split, open the dropdown to choose
			pendingSplitSessionId = active.id;
			showShellDropdown = true;
		}
		showMoreMenu = false;
	}

	// Close dropdowns when clicking outside
	function handleWindowClick(e: MouseEvent) {
		// Safe: MouseEvent.target is EventTarget, narrowing to HTMLElement for DOM navigation methods
		const target = e.target as HTMLElement;
		// Don't close dropdown if clicking the split button (it opens the dropdown)
		if (!target.closest('.shell-dropdown-wrapper') && !target.closest('.split-btn')) {
			showShellDropdown = false;
			pendingSplitSessionId = null; // Clear pending split if clicking away
		}
		if (!target.closest('.more-menu-wrapper')) {
			showMoreMenu = false;
		}
	}
</script>

<svelte:window onclick={handleWindowClick} />

<div class="terminal-panel" class:maximized={$terminalPanelState.isMaximized}>
	<!-- VS Code-style toolbar -->
	<div class="terminal-toolbar">
		<!-- Left side: Tabs -->
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
							onclick={(e) => handleCloseSession(e, session.id)}
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
					onclick={() => handleCreateSession()}
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
					onclick={() => (showShellDropdown = !showShellDropdown)}
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
					<div class="dropdown-menu shell-menu">
						{#each availableShells as shell}
							<button
								class="dropdown-item"
								onclick={() => handleCreateSession(shell.path)}
							>
								<span class="shell-name">{shell.name}</span>
								{#if shell.isDefault}
									<span class="default-badge">default</span>
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Right side: Actions -->
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
					onclick={handleSplit}
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
				<button
					class="toolbar-btn"
					aria-label="More actions"
					onclick={() => (showMoreMenu = !showMoreMenu)}
				>
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
						<button
							class="dropdown-item"
							onclick={() => {
								showMoreMenu = false;
							}}
						>
							Clear
						</button>
						{#if $terminalPanelState.splits}
							<button
								class="dropdown-item"
								onclick={() => {
									unsplit();
									showMoreMenu = false;
								}}
							>
								Unsplit
							</button>
						{:else}
							<button class="dropdown-item" onclick={handleSplit}>
								Split Right
							</button>
						{/if}
						<div class="dropdown-divider"></div>
						<button
							class="dropdown-item danger"
							onclick={() => {
								closeSession($terminalPanelState.activeTabId || '');
								showMoreMenu = false;
							}}
						>
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
	</div>

	<!-- Terminal content area -->
	<div class="terminal-content">
		{#if $terminalPanelState.splits}
			<!-- Split pane view -->
			<div class="split-container">
				{#each $terminalPanelState.splits.sessionIds as sessionId, index (sessionId)}
					{@const session = $terminalSessions.find((s) => s.id === sessionId)}
					{#if session}
						<div
							class="split-pane"
							style="width: {$terminalPanelState.splits.widths[index]}%"
						>
							<TerminalTabContent
								sessionId={session.id}
								shell={session.shell}
								isActive={true}
								onTitleChange={(title: string) =>
									handleTitleChange(session.id, title)}
							/>
						</div>
						{#if index < $terminalPanelState.splits.sessionIds.length - 1}
							<div class="split-divider"></div>
						{/if}
					{/if}
				{/each}
			</div>
		{:else}
			<!-- Single terminal view (tabs) -->
			{#each $terminalSessions as session (session.id)}
				<TerminalTabContent
					sessionId={session.id}
					shell={session.shell}
					isActive={session.id === $terminalPanelState.activeTabId}
					onTitleChange={(title: string) => handleTitleChange(session.id, title)}
				/>
			{/each}
		{/if}

		{#if $terminalSessions.length === 0}
			<div class="empty-state">
				<p>No terminals open</p>
				<button class="create-btn" onclick={() => handleCreateSession()}>
					Create Terminal
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.terminal-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--palantir-bg-panel, #0e1116);
	}

	.terminal-panel.maximized {
		position: fixed;
		inset: 0;
		z-index: 100;
	}

	/* Toolbar */
	.terminal-toolbar {
		height: 32px;
		min-height: 32px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--space-2);
		background: var(--palantir-bg-surface, #12161c);
		border-bottom: 1px solid var(--palantir-border-subtle, #1e2228);
		gap: var(--space-2);
	}

	.toolbar-left {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex: 1;
		min-width: 0;
	}

	.toolbar-right {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		flex-shrink: 0;
	}

	/* Tab list */
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

	/* Individual tab */
	.terminal-tab {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: 6px 12px;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--palantir-text-secondary);
		font-size: var(--text-sm);
		cursor: pointer;
		white-space: nowrap;
		transition:
			background 0.1s ease,
			color 0.1s ease;
	}

	.terminal-tab:hover {
		background: var(--palantir-bg-elevated, #1a1f27);
		color: var(--palantir-text-primary);
	}

	.terminal-tab.active {
		display: flex !important;
		align-items: center;
		background: var(--palantir-bg-elevated, #1a1f27);
		color: var(--palantir-text-primary);
	}

	.tab-icon {
		display: flex;
		align-items: center;
		color: var(--palantir-text-tertiary);
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
		color: var(--palantir-text-tertiary);
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
		background: var(--palantir-bg-panel);
		color: var(--palantir-text-primary);
	}

	/* Toolbar buttons */
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
		background: var(--palantir-bg-elevated, #1a1f27);
		color: var(--palantir-text-primary);
	}

	.add-btn {
		border-radius: var(--radius-sm) 0 0 var(--radius-sm);
	}

	.dropdown-toggle {
		width: 16px;
		border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
		border-left: 1px solid var(--palantir-border-subtle);
	}

	/* Dropdown wrapper */
	.shell-dropdown-wrapper,
	.more-menu-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.shell-dropdown-wrapper {
		margin-left: var(--space-1);
		padding-left: var(--space-2);
		border-left: 1px solid var(--palantir-border-subtle);
	}

	/* Dropdown menu */
	.dropdown-menu {
		position: absolute;
		top: calc(100% + 4px);
		background: var(--palantir-bg-panel, #0e1116);
		border: 1px solid var(--palantir-border-default, #2a2f38);
		border-radius: var(--radius-md);
		padding: var(--space-2);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
		z-index: 1000;
		min-width: 140px;
	}

	.shell-menu {
		left: 0;
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
		background: var(--palantir-bg-elevated, #1a1f27);
		color: var(--palantir-text-primary);
	}

	.dropdown-item.danger:hover {
		background: rgba(248, 113, 113, 0.1);
		color: var(--palantir-error, #f87171);
	}

	.dropdown-divider {
		height: 1px;
		background: var(--palantir-border-subtle);
		margin: var(--space-1) 0;
	}

	.shell-name {
		flex: 1;
	}

	.default-badge {
		font-size: 10px;
		padding: 1px 4px;
		background: var(--palantir-bg-elevated);
		border-radius: var(--radius-sm);
		color: var(--palantir-text-tertiary);
	}

	/* Terminal content */
	.terminal-content {
		flex: 1;
		overflow: hidden;
		position: relative;
		display: flex;
	}

	/* Empty state */
	.empty-state {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
		color: var(--palantir-text-tertiary);
		font-size: var(--text-sm);
	}

	.create-btn {
		padding: var(--space-2) var(--space-4);
		background: var(--palantir-accent, #4a9eff);
		border: none;
		border-radius: var(--radius-md);
		color: white;
		font-size: var(--text-sm);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.create-btn:hover {
		background: var(--palantir-accent-hover, #3d8ae6);
	}

	/* Split pane layout */
	.split-container {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.split-pane {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-width: 200px;
	}

	.split-divider {
		width: 4px;
		background: var(--palantir-border-subtle, #1e2228);
		cursor: col-resize;
		flex-shrink: 0;
		transition: background 0.15s ease;
	}

	.split-divider:hover {
		background: var(--palantir-accent, #4a9eff);
	}
</style>
