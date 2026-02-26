<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<!-- @constitutional-exemption Article-IV-4.2 issue:#12 — Button pattern extraction deferred to component library refactor -->
<script lang="ts">
	import { onMount } from 'svelte';

	import { browser } from '$app/environment';
	import {
		activeSession,
		closeSession,
		createSession,
		renameSession,
		terminalPanelState,
		terminalSessions
	} from '$lib/stores/dashboard/terminal-store';
	import type { ShellInfo } from '$lib/types/terminal';
	import { fetchJSON } from '$lib/utils/fetch-json';

	import TerminalTabBar from './TerminalTabBar.svelte';
	import TerminalTabContent from './TerminalTabContent.svelte';
	import TerminalToolbar from './TerminalToolbar.svelte';

	// Available shells from API
	let availableShells = $state<ShellInfo[]>([]);
	let showShellDropdown = $state(false);
	let showMoreMenu = $state(false);
	let pendingSplitSessionId = $state<string | null>(null);

	onMount(async () => {
		if (!browser) return;

		const data = await fetchJSON<{ shells: ShellInfo[] }>('/api/terminal/shells');
		availableShells = data?.shells ?? [{ path: '/bin/zsh', name: 'zsh', isDefault: true }];
	});

	function handleCreateSession(shell?: string) {
		const newSessionId = createSession(shell);

		if (pendingSplitSessionId) {
			const originalSessionId = pendingSplitSessionId;
			terminalPanelState.update((s) => {
				if (s.splits) {
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
		e.stopPropagation();
		const active = $activeSession;
		if (active) {
			pendingSplitSessionId = active.id;
			showShellDropdown = true;
		}
		showMoreMenu = false;
	}

	function handleWindowClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.shell-dropdown-wrapper') && !target.closest('.split-btn')) {
			showShellDropdown = false;
			pendingSplitSessionId = null;
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
		<TerminalTabBar
			{availableShells}
			{showShellDropdown}
			onCreateSession={handleCreateSession}
			onCloseSession={handleCloseSession}
			onToggleShellDropdown={() => (showShellDropdown = !showShellDropdown)}
		/>

		<TerminalToolbar
			{showMoreMenu}
			onSplit={handleSplit}
			onCreateSession={handleCreateSession}
			onToggleMoreMenu={() => (showMoreMenu = !showMoreMenu)}
			onCloseActiveSession={() => {
				closeSession($terminalPanelState.activeTabId || '');
				showMoreMenu = false;
			}}
		/>
	</div>

	<!-- Terminal content area -->
	<div class="terminal-content">
		{#if $terminalPanelState.splits}
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
		background: var(--card);
	}

	.terminal-panel.maximized {
		position: fixed;
		inset: 0;
		z-index: 100;
	}

	.terminal-toolbar {
		height: 32px;
		min-height: 32px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--space-2);
		background: var(--card);
		border-bottom: 1px solid var(--border);
		gap: var(--space-2);
	}

	.terminal-content {
		flex: 1;
		overflow: hidden;
		position: relative;
		display: flex;
	}

	.empty-state {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
		color: var(--foreground-secondary);
		font-size: var(--text-sm);
	}

	.create-btn {
		padding: var(--space-2) var(--space-4);
		background: var(--primary);
		border: none;
		border-radius: var(--radius-md);
		color: white;
		font-size: var(--text-sm);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.create-btn:hover {
		background: var(--ring);
	}

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
		background: var(--border);
		cursor: col-resize;
		flex-shrink: 0;
		transition: background 0.15s ease;
	}

	.split-divider:hover {
		background: var(--primary);
	}
</style>
