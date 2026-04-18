import type { WebSocket } from 'ws';

export const TERMINAL_WS_PATH = '/terminal-ws';
export const INIT_TIMEOUT_MS = 5000;
export const CLEANUP_TIMEOUT_MS = 5 * 60 * 1000;
export const MAX_BUFFER_BYTES = 100 * 1024;

export interface PtySession {
	pty: ReturnType<typeof import('node-pty').spawn>;
	shell: string;
	ws: WebSocket | null;
	outputBuffer: string[];
	bufferSize: number;
	cleanupTimer: ReturnType<typeof setTimeout> | null;
	cols: number;
	rows: number;
}
