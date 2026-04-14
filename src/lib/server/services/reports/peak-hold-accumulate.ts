import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

import { logger } from '$lib/utils/logger';

export interface AccumulatedMeta {
	binHz: number;
	captureStartMs: number;
}

export interface AccumulatorResult {
	peak: Float32Array;
	rows: Float32Array[];
	rowTimes: number[];
	meta: AccumulatedMeta | null;
	firstFrameMs: number | null;
	lastFrameMs: number | null;
}

interface Frame {
	t: string;
	f0: number;
	f1: number;
	bw: number;
	bins: number[];
}

interface MetaLine {
	type: 'meta';
	startHz: number;
	endHz: number;
	binHz: number;
	capture_start_dtg: string;
}

function parseMeta(rec: Record<string, unknown>): MetaLine {
	return {
		type: 'meta',
		startHz: Number(rec.startHz),
		endHz: Number(rec.endHz),
		binHz: Number(rec.binHz),
		capture_start_dtg: String(rec.capture_start_dtg)
	};
}

function isValidFrameRec(rec: Record<string, unknown>): boolean {
	return (
		typeof rec.t === 'string' &&
		typeof rec.f0 === 'number' &&
		typeof rec.f1 === 'number' &&
		Array.isArray(rec.bins)
	);
}

function parseFrame(rec: Record<string, unknown>): Frame {
	return {
		t: rec.t as string,
		f0: rec.f0 as number,
		f1: rec.f1 as number,
		bw: typeof rec.bw === 'number' ? rec.bw : 0,
		bins: (rec.bins as unknown[]).map(Number)
	};
}

function safeJsonParse(line: string): Record<string, unknown> | null {
	try {
		const obj = JSON.parse(line) as unknown;
		if (!obj || typeof obj !== 'object') return null;
		return obj as Record<string, unknown>;
	} catch {
		return null;
	}
}

function parseLine(line: string): Frame | MetaLine | null {
	const rec = safeJsonParse(line);
	if (!rec) return null;
	if (rec.type === 'meta') return parseMeta(rec);
	return isValidFrameRec(rec) ? parseFrame(rec) : null;
}

function binIndex(fi: number, startHz: number, endHz: number, N: number): number {
	if (fi < startHz || fi > endHz) return -1;
	const idx = Math.floor(((fi - startHz) / (endHz - startHz)) * N);
	return idx >= 0 && idx < N ? idx : -1;
}

function writeBinIntoRow(
	fi: number,
	p: number,
	startHz: number,
	endHz: number,
	N: number,
	row: Float32Array,
	peak: Float32Array
): void {
	const idx = binIndex(fi, startHz, endHz, N);
	if (idx < 0) return;
	if (p > row[idx]) row[idx] = p;
	if (p > peak[idx]) peak[idx] = p;
}

function frameInBand(frame: Frame, startHz: number, endHz: number): boolean {
	return !(frame.f1 < startHz || frame.f0 > endHz);
}

function hasUsableBins(frame: Frame): boolean {
	return frame.f1 - frame.f0 > 0 && frame.bins.length > 0;
}

function accumulateFrame(
	frame: Frame,
	startHz: number,
	endHz: number,
	N: number,
	peak: Float32Array
): Float32Array | null {
	if (!frameInBand(frame, startHz, endHz)) return null;
	const row = new Float32Array(N).fill(-Infinity);
	if (!hasUsableBins(frame)) return row;
	const step = (frame.f1 - frame.f0) / frame.bins.length;
	for (let i = 0; i < frame.bins.length; i++) {
		const fi = frame.f0 + i * step + step / 2;
		writeBinIntoRow(fi, frame.bins[i], startHz, endHz, N, row, peak);
	}
	return row;
}

function maxInto(dst: Float32Array, src: Float32Array, N: number): void {
	for (let j = 0; j < N; j++) if (src[j] > dst[j]) dst[j] = src[j];
}

function mergeGroup(
	rows: Float32Array[],
	times: number[],
	start: number,
	factor: number,
	N: number
): { row: Float32Array; time: number } {
	const out = new Float32Array(N).fill(-Infinity);
	const end = Math.min(start + factor, rows.length);
	let tSum = 0;
	for (let k = start; k < end; k++) {
		maxInto(out, rows[k], N);
		tSum += times[k];
	}
	const count = end - start;
	return { row: out, time: count ? tSum / count : 0 };
}

function downsampleRows(
	rows: Float32Array[],
	times: number[],
	maxRows: number,
	N: number
): { rows: Float32Array[]; times: number[] } {
	if (rows.length <= maxRows) return { rows, times };
	const factor = Math.ceil(rows.length / maxRows);
	const merged: Float32Array[] = [];
	const mergedTimes: number[] = [];
	for (let i = 0; i < rows.length; i += factor) {
		const g = mergeGroup(rows, times, i, factor, N);
		merged.push(g.row);
		mergedTimes.push(g.time);
	}
	return { rows: merged, times: mergedTimes };
}

interface AccState {
	peak: Float32Array;
	rows: Float32Array[];
	rowTimes: number[];
	meta: AccumulatedMeta | null;
	firstFrameMs: number | null;
	lastFrameMs: number | null;
}

function applyMeta(state: AccState, meta: MetaLine): void {
	state.meta = {
		binHz: meta.binHz,
		captureStartMs: new Date(meta.capture_start_dtg).getTime()
	};
}

function pushFrameRow(state: AccState, frame: Frame, row: Float32Array): void {
	state.rows.push(row);
	const t = new Date(frame.t).getTime();
	state.rowTimes.push(t);
	if (state.firstFrameMs === null) state.firstFrameMs = t;
	state.lastFrameMs = t;
}

function applyParsed(
	parsed: Frame | MetaLine,
	state: AccState,
	startHz: number,
	endHz: number,
	N: number
): void {
	if ('type' in parsed) return applyMeta(state, parsed);
	const row = accumulateFrame(parsed, startHz, endHz, N, state.peak);
	if (row) pushFrameRow(state, parsed, row);
}

async function readAndApply(
	ndjsonPath: string,
	state: AccState,
	startHz: number,
	endHz: number,
	N: number
): Promise<void> {
	const stream = createReadStream(ndjsonPath, { encoding: 'utf8' });
	const rl = createInterface({ input: stream, crlfDelay: Infinity });
	for await (const line of rl) {
		if (!line) continue;
		const parsed = parseLine(line);
		if (!parsed) continue;
		applyParsed(parsed, state, startHz, endHz, N);
	}
}

export async function accumulatePeakHold(
	ndjsonPath: string,
	startHz: number,
	endHz: number,
	N: number,
	maxRows: number
): Promise<AccumulatorResult> {
	const state: AccState = {
		peak: new Float32Array(N).fill(-Infinity),
		rows: [],
		rowTimes: [],
		meta: null,
		firstFrameMs: null,
		lastFrameMs: null
	};
	try {
		await readAndApply(ndjsonPath, state, startHz, endHz, N);
	} catch (error) {
		logger.warn('peak-hold accumulate read failed', {
			ndjsonPath,
			error: error instanceof Error ? error.message : String(error)
		});
		return {
			peak: state.peak,
			rows: [],
			rowTimes: [],
			meta: state.meta,
			firstFrameMs: state.firstFrameMs,
			lastFrameMs: state.lastFrameMs
		};
	}
	const ds = downsampleRows(state.rows, state.rowTimes, maxRows, N);
	return {
		peak: state.peak,
		rows: ds.rows,
		rowTimes: ds.times,
		meta: state.meta,
		firstFrameMs: state.firstFrameMs,
		lastFrameMs: state.lastFrameMs
	};
}
