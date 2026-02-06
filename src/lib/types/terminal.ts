/**
 * Type definitions for VS Code-style terminal panel
 */

/** Individual terminal session */
export interface TerminalSession {
	id: string;
	title: string;
	shell: string;
	isConnected: boolean;
	createdAt: number;
}

/** Split pane configuration */
export interface SplitPaneConfig {
	id: string;
	sessionIds: string[]; // Left to right
	widths: number[]; // Percentages (should sum to 100)
}

/** Terminal panel state */
export interface TerminalPanelState {
	isOpen: boolean;
	height: number; // Panel height in pixels
	activeTabId: string | null;
	sessions: TerminalSession[];
	splits: SplitPaneConfig | null; // null = no split, single terminal
	preferredShell: string;
	isMaximized: boolean;
}

/** Shell information from API */
export interface ShellInfo {
	path: string;
	name: string;
	isDefault: boolean;
}

/** API response for available shells */
export interface ShellsResponse {
	shells: ShellInfo[];
	defaultShell: string;
}

/** WebSocket init message for shell selection */
export interface TerminalInitMessage {
	type: 'init';
	shell: string;
	sessionId?: string;
}

/** WebSocket ready response */
export interface TerminalReadyMessage {
	type: 'ready';
	shell: string;
	sessionId?: string;
}

/** WebSocket reattached response (session resumed after reconnect) */
export interface TerminalReattachedMessage {
	type: 'reattached';
	shell: string;
	sessionId: string;
}

/** WebSocket sessions list response */
export interface TerminalSessionsMessage {
	type: 'sessions';
	sessions: { id: string; shell: string; alive: boolean }[];
}

/** WebSocket input message */
export interface TerminalInputMessage {
	type: 'input';
	data: string;
}

/** WebSocket resize message */
export interface TerminalResizeMessage {
	type: 'resize';
	cols: number;
	rows: number;
}

/** All terminal WebSocket message types */
export type TerminalMessage =
	| TerminalInitMessage
	| TerminalReadyMessage
	| TerminalReattachedMessage
	| TerminalSessionsMessage
	| TerminalInputMessage
	| TerminalResizeMessage;
