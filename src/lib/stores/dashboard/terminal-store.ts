/**
 * Terminal panel store for VS Code-style terminal management
 * Handles session state, panel visibility, and persistence
 */

import { derived, get } from 'svelte/store';

import { persistedWritable } from '$lib/stores/persisted-writable';
import type { TerminalPanelState, TerminalSession } from '$lib/types/terminal';
import { logger } from '$lib/utils/logger';

import { activeBottomTab, closeBottomPanel, setBottomPanelHeight } from './dashboard-store';
import {
	createNewSession,
	generateId,
	removeSplitSession,
	resolveActiveTab,
	TMUX_SHELLS
} from './terminal-session-helpers';

// Constants
const STORAGE_KEY = 'terminalPanelState';
const DEFAULT_HEIGHT = 300;

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

/** Restore sessions as disconnected and rebuild state from parsed localStorage data. */
function restoreSessions(parsed: Record<string, unknown>): TerminalSession[] {
	return ((parsed.sessions as TerminalSession[]) ?? []).map((s) => ({
		...s,
		isConnected: false
	}));
}

/** Build restored terminal state from parsed data and sessions. */
function buildRestoredState(
	parsed: Record<string, unknown>,
	sessions: TerminalSession[]
): TerminalPanelState {
	return {
		...getDefaultState(),
		height: (parsed.height as number) ?? DEFAULT_HEIGHT,
		preferredShell: (parsed.preferredShell as string) ?? '',
		sessions,
		activeTabId: sessions[0]?.id ?? null,
		isMaximized: false
	};
}

/** Deserialize terminal state from localStorage JSON. */
function deserializeTerminalState(raw: string): TerminalPanelState {
	const parsed = JSON.parse(raw);
	const sessions = restoreSessions(parsed);
	if (sessions.length > 0) {
		logger.info('Restoring terminal sessions', { sessionCount: sessions.length });
		setTimeout(() => activeBottomTab.set('terminal'), 0);
	}
	return buildRestoredState(parsed, sessions);
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
		deserialize: deserializeTerminalState
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
		return {
			...state,
			sessions: newSessions,
			activeTabId: resolveActiveTab(state, sessionId, newSessions),
			splits: removeSplitSession(state.splits, sessionId)
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
