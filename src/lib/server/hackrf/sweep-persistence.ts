import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { join } from 'node:path';

import { logger } from '$lib/utils/logger';

export interface SweepBandMeta {
	startHz: number;
	endHz: number;
	binHz: number;
	capture_start_dtg: string;
}

export interface SweepFrameRecord {
	t: string;
	f0: number;
	f1: number;
	bw: number;
	bins: number[];
}

const streams = new Map<string, WriteStream>();

function captureDir(captureId: string): string {
	return join(process.cwd(), 'data', 'captures', captureId);
}

function safeWrite(captureId: string, stream: WriteStream, line: string): void {
	try {
		stream.write(line);
	} catch (error) {
		logger.warn('sweep-persistence write failed', {
			captureId,
			error: error instanceof Error ? error.message : String(error)
		});
	}
}

export function openSweepLog(captureId: string, meta: SweepBandMeta): void {
	try {
		if (streams.has(captureId)) return;
		const dir = captureDir(captureId);
		mkdirSync(dir, { recursive: true });
		const path = join(dir, 'sweep.ndjson');
		const stream = createWriteStream(path, { flags: 'a' });
		stream.on('error', (error: Error) => {
			logger.warn('sweep-persistence stream error', {
				captureId,
				error: error.message
			});
		});
		streams.set(captureId, stream);
		const metaLine = JSON.stringify({ type: 'meta', ...meta }) + '\n';
		safeWrite(captureId, stream, metaLine);
		logger.info('sweep-persistence opened log', { captureId, path });
	} catch (error) {
		logger.warn('sweep-persistence openSweepLog failed', {
			captureId,
			error: error instanceof Error ? error.message : String(error)
		});
	}
}

export function appendFrame(captureId: string, frame: SweepFrameRecord): void {
	const stream = streams.get(captureId);
	if (!stream) return;
	try {
		const line = JSON.stringify(frame) + '\n';
		safeWrite(captureId, stream, line);
	} catch (error) {
		logger.warn('sweep-persistence appendFrame failed', {
			captureId,
			error: error instanceof Error ? error.message : String(error)
		});
	}
}

export function closeSweepLog(captureId: string): void {
	const stream = streams.get(captureId);
	if (!stream) return;
	try {
		stream.end();
	} catch (error) {
		logger.warn('sweep-persistence closeSweepLog failed', {
			captureId,
			error: error instanceof Error ? error.message : String(error)
		});
	}
	streams.delete(captureId);
}
