/**
 * Terminal panel store for VS Code-style terminal management
 * Handles session state, panel visibility, and persistence
 */

import { derived, get } from 'svelte/store';

import { persistedWritable } from '$lib/stores/persisted-writable';
import type { TerminalPanelState, TerminalSession } from '$lib/types/terminal';
import { logger } from '$lib/utils/logger';

import { activeBottomTab, closeBottomPanel, setBottomPanelHeight } from './dashboard-store';

// Constants
const STORAGE_KEY = 'terminalPanelState';
const DEFAULT_HEIGHT = 300;

/** Generate unique session ID */
function generateId(): string {
	return Math.random().toString(36).substring(2, 9);
}

/** Default terminal panel state */
function getDefaultState(): TerminalPanelState {
	return {
		isOpen: false,
		height: DEFAULT_HEIGHT,
		activeTabId: null,
		sessions: [],
		splits: null,
		preferredShell: 'scripts/tmux/tmux-0.sh',
		isMaximized: false
	};
}

/** Main terminal panel state store — persists height, preferredShell, sessions to localStorage */
export const terminalPanelState = persistedWritable<TerminalPanelState>(
	STORAGE_KEY,
	getDefaultState(),
	{
		serialize: (state) =>
			JSON.stringify({
				height: state.height,
				preferredShell: state.preferredShell,
				sessions: state.sessions
			}),
		deserialize: (raw) => {
			const parsed = JSON.parse(raw);
			// Restore sessions marked as disconnected — they may reattach to server PTYs
			const restoredSessions: TerminalSession[] = (parsed.sessions ?? []).map(
				(s: TerminalSession) => ({
					...s,
					isConnected: false
				})
			);

			if (restoredSessions.length > 0) {
				logger.info('Restoring terminal sessions, auto-opening panel', {
					sessionCount: restoredSessions.length
				});
				setTimeout(() => activeBottomTab.set('terminal'), 0);
			}

			return {
				...getDefaultState(),
				height: parsed.height ?? DEFAULT_HEIGHT,
				preferredShell: parsed.preferredShell ?? '',
				sessions: restoredSessions,
				activeTabId: restoredSessions.length > 0 ? restoredSessions[0].id : null,
				isMaximized: false
			};
		}
	}
);

// Derived stores for convenience
export const terminalSessions = derived(terminalPanelState, ($state) => $state.sessions);

export const activeSession = derived(terminalPanelState, ($state) => {
	if (!$state.activeTabId) return null;
	return $state.sessions.find((s) => s.id === $state.activeTabId) ?? null;
});

export const isTerminalOpen = derived(activeBottomTab, ($tab) => $tab === 'terminal');

export const terminalHeight = derived(terminalPanelState, ($state) => $state.height);

export const preferredShell = derived(terminalPanelState, ($state) => $state.preferredShell);

// Panel visibility functions
export function openTerminalPanel(): void {
	terminalPanelState.update((state) => {
		// If no sessions exist, create one
		if (state.sessions.length === 0) {
			const newSession = createNewSession(state.preferredShell || '/bin/zsh');
			return {
				...state,
				isOpen: true,
				sessions: [newSession],
				activeTabId: newSession.id
			};
		}
		return { ...state, isOpen: true };
	});
	// Open via bottom panel tab system
	activeBottomTab.set('terminal');
}

export function closeTerminalPanel(): void {
	terminalPanelState.update((state) => ({ ...state, isOpen: false }));
	closeBottomPanel();
}

export function toggleTerminalPanel(): void {
	const tab = get(activeBottomTab);
	if (tab === 'terminal') {
		closeTerminalPanel();
	} else {
		openTerminalPanel();
	}
}

// Session management
function createNewSession(shell: string): TerminalSession {
	let shellName = shell.split('/').pop() || 'terminal';

	// Friendly names for tmux profiles
	if (shell.includes('tmux-0.sh')) {
		shellName = 'Tmux 0';
	} else if (shell.includes('tmux-1.sh')) {
		shellName = 'Tmux 1';
	} else if (shell.includes('tmux-2.sh')) {
		shellName = 'Tmux 2';
	} else if (shell.includes('tmux-3.sh')) {
		shellName = 'Tmux 3';
	} else if (shell.includes('tmux-logs.sh')) {
		shellName = 'System Logs';
	}

	return {
		id: generateId(),
		title: shellName,
		shell,
		isConnected: false,
		createdAt: Date.now()
	};
}

const TMUX_SHELLS = [
	'scripts/tmux/tmux-0.sh',
	'scripts/tmux/tmux-1.sh',
	'scripts/tmux/tmux-2.sh',
	'scripts/tmux/tmux-3.sh'
];

export function createSession(shell?: string): string {
	const state = get(terminalPanelState);

	let shellToUse: string;
	if (shell) {
		// Explicit shell requested (from dropdown)
		shellToUse = shell;
	} else {
		// Auto-pick next available tmux session
		const openShells = new Set(state.sessions.map((s) => s.shell));
		const nextShell = TMUX_SHELLS.find((s) => !openShells.has(s));
		shellToUse = nextShell || state.preferredShell || '/bin/zsh';
	}

	const newSession = createNewSession(shellToUse);

	terminalPanelState.update((s) => ({
		...s,
		sessions: [...s.sessions, newSession],
		activeTabId: newSession.id,
		isOpen: true
	}));

	return newSession.id;
}

export function closeSession(sessionId: string): void {
	terminalPanelState.update((state) => {
		const newSessions = state.sessions.filter((s) => s.id !== sessionId);
		let newActiveTabId = state.activeTabId;

		// If we closed the active tab, select another
		if (state.activeTabId === sessionId) {
			const closedIndex = state.sessions.findIndex((s) => s.id === sessionId);
			if (newSessions.length > 0) {
				// Prefer the tab to the left, or the first tab
				const newIndex = Math.max(0, closedIndex - 1);
				newActiveTabId = newSessions[newIndex]?.id ?? null;
			} else {
				newActiveTabId = null;
			}
		}

		// Also remove from splits if present
		let newSplits = state.splits;
		if (newSplits && newSplits.sessionIds.includes(sessionId)) {
			const idx = newSplits.sessionIds.indexOf(sessionId);
			const newSessionIds = newSplits.sessionIds.filter((id) => id !== sessionId);
			const newWidths = newSplits.widths.filter((_, i) => i !== idx);

			if (newSessionIds.length <= 1) {
				newSplits = null; // No longer a split
			} else {
				// Redistribute widths
				const totalWidth = newWidths.reduce((a, b) => a + b, 0);
				newSplits = {
					...newSplits,
					sessionIds: newSessionIds,
					widths: newWidths.map((w) => (w / totalWidth) * 100)
				};
			}
		}

		return {
			...state,
			sessions: newSessions,
			activeTabId: newActiveTabId,
			splits: newSplits
		};
	});
}

export function setActiveSession(sessionId: string): void {
	terminalPanelState.update((state) => {
		if (state.sessions.some((s) => s.id === sessionId)) {
			return { ...state, activeTabId: sessionId };
		}
		return state;
	});
}

export function renameSession(sessionId: string, newTitle: string): void {
	terminalPanelState.update((state) => ({
		...state,
		sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s))
	}));
}

export function updateSessionConnection(sessionId: string, isConnected: boolean): void {
	terminalPanelState.update((state) => ({
		...state,
		sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, isConnected } : s))
	}));
}

// Panel sizing — delegates to shared bottom panel height
export function setPanelHeight(height: number): void {
	setBottomPanelHeight(height);
	terminalPanelState.update((state) => ({
		...state,
		isMaximized: false // Resizing clears maximized state
	}));
}

export function toggleMaximize(): void {
	terminalPanelState.update((state) => ({
		...state,
		isMaximized: !state.isMaximized
	}));
}

// Shell preference
export function setPreferredShell(shell: string): void {
	terminalPanelState.update((state) => ({
		...state,
		preferredShell: shell
	}));
}

// Split pane management
export function splitTerminal(sessionId: string): void {
	// Create a new session for the split
	const newSessionId = createSession();

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
			// Create new split
			return {
				...s,
				splits: {
					id: generateId(),
					sessionIds: [sessionId, newSessionId],
					widths: [50, 50]
				}
			};
		}
	});
}

export function unsplit(): void {
	terminalPanelState.update((state) => ({
		...state,
		splits: null
	}));
}

export function updateSplitWidths(widths: number[]): void {
	terminalPanelState.update((state) => {
		if (!state.splits) return state;
		return {
			...state,
			splits: {
				...state.splits,
				widths
			}
		};
	});
}

// Navigation helpers
export function nextTab(): void {
	terminalPanelState.update((state) => {
		if (state.sessions.length <= 1) return state;
		const currentIndex = state.sessions.findIndex((s) => s.id === state.activeTabId);
		const nextIndex = (currentIndex + 1) % state.sessions.length;
		return { ...state, activeTabId: state.sessions[nextIndex].id };
	});
}

export function previousTab(): void {
	terminalPanelState.update((state) => {
		if (state.sessions.length <= 1) return state;
		const currentIndex = state.sessions.findIndex((s) => s.id === state.activeTabId);
		const prevIndex = (currentIndex - 1 + state.sessions.length) % state.sessions.length;
		return { ...state, activeTabId: state.sessions[prevIndex].id };
	});
}
