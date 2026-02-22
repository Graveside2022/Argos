/**
 * Shared gpsd TCP socket connection utility.
 * Used by both gps-position-service and gps-satellite-service.
 *
 * Uses a short-lived TCP socket to query gpsd, avoiding process spawns
 * (bash/nc/timeout) that contributed to memory exhaustion over long runs.
 */

import { Socket } from 'net';

interface GpsdQueryOptions {
	/** TCP connection + overall timeout in ms (default: 3000) */
	timeoutMs?: number;
	/** How long to collect data after the WATCH command in ms (default: 2000) */
	collectMs?: number;
}

/** Create a cleanup/finish pair for a gpsd socket connection */
function createSocketHandlers(
	socket: Socket,
	chunks: Buffer[],
	resolve: (value: string) => void,
	reject: (reason: Error) => void
): { finish: (result: string | null, error?: Error) => void } {
	let resolved = false;

	const cleanup = () => {
		if (!socket.destroyed) {
			socket.destroy();
		}
	};

	const finish = (result: string | null, error?: Error) => {
		if (resolved) return;
		resolved = true;
		cleanup();
		if (error) {
			reject(error);
		} else {
			resolve(result || '');
		}
	};

	return { finish };
}

/** Attach event listeners to a gpsd socket */
function attachSocketEvents(
	socket: Socket,
	chunks: Buffer[],
	finish: (result: string | null, error?: Error) => void,
	collectMs: number
): void {
	socket.on('connect', () => {
		socket.write('?WATCH={"enable":true,"json":true}\n');
		setTimeout(() => {
			finish(Buffer.concat(chunks).toString('utf8'));
		}, collectMs);
	});

	socket.on('data', (chunk: Buffer) => {
		chunks.push(chunk);
	});

	socket.on('timeout', () => {
		if (chunks.length > 0) {
			finish(Buffer.concat(chunks).toString('utf8'));
		} else {
			finish(null, new Error('Connection to gpsd timed out'));
		}
	});

	socket.on('error', (err: Error) => {
		finish(null, err);
	});

	socket.on('close', () => {
		if (chunks.length > 0) {
			finish(Buffer.concat(chunks).toString('utf8'));
		} else {
			finish(null, new Error('Connection closed without data'));
		}
	});
}

/**
 * Query gpsd using a short-lived TCP socket connection.
 *
 * @param options.timeoutMs - Socket timeout (default 3000ms)
 * @param options.collectMs - Data collection window after WATCH command (default 2000ms)
 * @returns Raw gpsd JSON output lines
 */
export function queryGpsd(options: GpsdQueryOptions = {}): Promise<string> {
	const { timeoutMs = 3000, collectMs = 2000 } = options;

	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		const socket = new Socket();
		socket.setTimeout(timeoutMs);

		const { finish } = createSocketHandlers(socket, chunks, resolve, reject);
		attachSocketEvents(socket, chunks, finish, collectMs);

		socket.connect(2947, 'localhost');
	});
}
