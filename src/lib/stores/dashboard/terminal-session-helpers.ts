/**
 * Pure helper functions for terminal session management.
 * No store dependencies — safe to import from anywhere.
 */

import type { TerminalPanelState, TerminalSession } from '$lib/types/terminal';

/** Generate a short random unique ID for terminal sessions and split panes. */
export function generateId(): string {
	return Math.random().toString(36).substring(2, 9);
}

/** Friendly display names for known tmux profile scripts. */
export const TMUX_NAMES: [string, string][] = [
	['tmux-0.sh', 'Tmux 0'],
	['tmux-1.sh', 'Tmux 1'],
	['tmux-2.sh', 'Tmux 2'],
	['tmux-3.sh', 'Tmux 3'],
	['tmux-logs.sh', 'System Logs']
];

/** Ordered list of tmux shell script paths for auto-assignment. */
export const TMUX_SHELLS = [
	'scripts/tmux/tmux-0.sh',
	'scripts/tmux/tmux-1.sh',
	'scripts/tmux/tmux-2.sh',
	'scripts/tmux/tmux-3.sh'
];

/** Resolve a human-readable shell name from a shell path. */
export function resolveShellName(shell: string): string {
	const match = TMUX_NAMES.find(([key]) => shell.includes(key));
	return match ? match[1] : shell.split('/').pop() || 'terminal';
}

/** Build a new TerminalSession object for the given shell path. */
export function createNewSession(shell: string): TerminalSession {
	return {
		id: generateId(),
		title: resolveShellName(shell),
		shell,
		isConnected: false,
		createdAt: Date.now()
	};
}

/**
 * Resolve which tab ID becomes active after a session is closed.
 * Returns the current active tab if it is not the closed session.
 * Otherwise selects the nearest preceding session.
 */
export function resolveActiveTab(
	state: TerminalPanelState,
	sessionId: string,
	remaining: TerminalSession[]
): string | null {
	if (state.activeTabId !== sessionId) return state.activeTabId;
	if (remaining.length === 0) return null;
	const closedIndex = state.sessions.findIndex((s) => s.id === sessionId);
	return remaining[Math.max(0, closedIndex - 1)]?.id ?? null;
}

/**
 * Remove a session from the split pane config.
 * Returns null when the split dissolves to a single pane.
 * Redistributes widths proportionally when a pane is removed.
 */
export function removeSplitSession(
	splits: TerminalPanelState['splits'],
	sessionId: string
): TerminalPanelState['splits'] {
	if (!splits || !splits.sessionIds.includes(sessionId)) return splits;
	const idx = splits.sessionIds.indexOf(sessionId);
	const ids = splits.sessionIds.filter((id) => id !== sessionId);
	const widths = splits.widths.filter((_, i) => i !== idx);
	if (ids.length <= 1) return null;
	const total = widths.reduce((a, b) => a + b, 0);
	return { ...splits, sessionIds: ids, widths: widths.map((w) => (w / total) * 100) };
}
