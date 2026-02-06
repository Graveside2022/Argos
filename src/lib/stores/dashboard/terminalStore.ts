/**
 * Terminal panel store for VS Code-style terminal management
 * Handles session state, panel visibility, and persistence
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import type { TerminalSession, TerminalPanelState } from '$lib/types/terminal';
import { activeBottomTab, closeBottomPanel, setBottomPanelHeight } from './dashboardStore';

// Constants
const STORAGE_KEY = 'terminalPanelState';
const DEFAULT_HEIGHT = 300;

/** Generate unique session ID */
function generateId(): string {
	return Math.random().toString(36).substring(2, 9);
}

/** Get initial state from localStorage or defaults */
function getInitialState(): TerminalPanelState {
	if (!browser) {
		return getDefaultState();
	}

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			// Restore sessions marked as disconnected — they may reattach to server PTYs
			const restoredSessions: TerminalSession[] = (parsed.sessions ?? []).map(
				(s: TerminalSession) => ({
					...s,
					isConnected: false // Will be set true on reattach
				})
			);
			return {
				...getDefaultState(),
				height: parsed.height ?? DEFAULT_HEIGHT,
				preferredShell: parsed.preferredShell ?? '',
				sessions: restoredSessions,
				activeTabId: restoredSessions.length > 0 ? restoredSessions[0].id : null,
				isMaximized: false // Always start non-maximized
			};
		}
	} catch {
		// Invalid stored state, use defaults
	}

	return getDefaultState();
}

/** Default terminal panel state */
function getDefaultState(): TerminalPanelState {
	return {
		isOpen: false,
		height: DEFAULT_HEIGHT,
		activeTabId: null,
		sessions: [],
		splits: null,
		preferredShell: '',
		isMaximized: false
	};
}

/** Main terminal panel state store */
export const terminalPanelState = writable<TerminalPanelState>(getInitialState());

// Persist relevant state to localStorage
if (browser) {
	terminalPanelState.subscribe((state) => {
		const toPersist = {
			height: state.height,
			preferredShell: state.preferredShell,
			sessions: state.sessions
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist));
	});
}

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
	const shellName = shell.split('/').pop() || 'terminal';
	return {
		id: generateId(),
		title: shellName,
		shell,
		isConnected: false,
		createdAt: Date.now()
	};
}

export function createSession(shell?: string): string {
	const state = get(terminalPanelState);
	const shellToUse = shell || state.preferredShell || '/bin/zsh';
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
