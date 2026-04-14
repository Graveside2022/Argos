import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

import { logger } from '$lib/utils/logger';

export interface SpectrumEmitter {
	center_mhz: number;
	bandwidth_khz: number;
	peak_dbm: number;
	duty_cycle: number;
	first_seen_ms: number;
	last_seen_ms: number;
}

export interface SpectrumFeatures {
	band: { start_mhz: number; end_mhz: number; bin_hz: number };
	capture: { total_frames: number; duration_sec: number };
	noise_floor_dbm: number;
	emitters: SpectrumEmitter[];
	quiet_bands: Array<{ start_mhz: number; end_mhz: number; width_khz: number }>;
}

interface Frame {
	t: string;
	f0: number;
	f1: number;
	bins: number[];
}

interface MetaLine {
	type: 'meta';
	binHz: number;
}

interface FeatureState {
	peak: Float32Array;
	dutyCount: Int32Array;
	firstSeen: Float64Array;
	lastSeen: Float64Array;
	totalFrames: number;
	firstFrameMs: number | null;
	lastFrameMs: number | null;
	binHz: number;
}

function safeJson(line: string): Record<string, unknown> | null {
	try {
		const v = JSON.parse(line) as unknown;
		return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

function isValidFrameRec(rec: Record<string, unknown>): boolean {
	return (
		typeof rec.t === 'string' &&
		typeof rec.f0 === 'number' &&
		typeof rec.f1 === 'number' &&
		Array.isArray(rec.bins)
	);
}

function parseFrameRec(rec: Record<string, unknown>): Frame {
	return {
		t: rec.t as string,
		f0: rec.f0 as number,
		f1: rec.f1 as number,
		bins: (rec.bins as unknown[]).map(Number)
	};
}

function parseLine(line: string): Frame | MetaLine | null {
	const rec = safeJson(line);
	if (!rec) return null;
	if (rec.type === 'meta') return { type: 'meta', binHz: Number(rec.binHz) };
	return isValidFrameRec(rec) ? parseFrameRec(rec) : null;
}

function makeState(N: number): FeatureState {
	return {
		peak: new Float32Array(N).fill(-Infinity),
		dutyCount: new Int32Array(N),
		firstSeen: new Float64Array(N).fill(Number.POSITIVE_INFINITY),
		lastSeen: new Float64Array(N).fill(0),
		totalFrames: 0,
		firstFrameMs: null,
		lastFrameMs: null,
		binHz: 0
	};
}

function trackHit(state: FeatureState, idx: number, ts: number): void {
	state.dutyCount[idx]++;
	if (ts < state.firstSeen[idx]) state.firstSeen[idx] = ts;
	if (ts > state.lastSeen[idx]) state.lastSeen[idx] = ts;
}

function applyBinSample(
	state: FeatureState,
	idx: number,
	value: number,
	ts: number,
	threshold: number
): void {
	if (value > state.peak[idx]) state.peak[idx] = value;
	if (value > threshold) trackHit(state, idx, ts);
}

function markFrameTiming(state: FeatureState, ts: number): void {
	state.totalFrames++;
	if (state.firstFrameMs === null) state.firstFrameMs = ts;
	state.lastFrameMs = ts;
}

function binIndexFor(fi: number, startHz: number, endHz: number, N: number): number {
	if (fi < startHz || fi > endHz) return -1;
	const idx = Math.floor(((fi - startHz) / (endHz - startHz)) * N);
	return idx >= 0 && idx < N ? idx : -1;
}

function frameOutOfRange(frame: Frame, startHz: number, endHz: number): boolean {
	return frame.f1 < startHz || frame.f0 > endHz || frame.bins.length === 0;
}

function absorbFrame(
	frame: Frame,
	state: FeatureState,
	startHz: number,
	endHz: number,
	N: number,
	provisionalThreshold: number
): void {
	if (frameOutOfRange(frame, startHz, endHz)) return;
	const ts = new Date(frame.t).getTime();
	markFrameTiming(state, ts);
	const step = (frame.f1 - frame.f0) / frame.bins.length;
	for (let i = 0; i < frame.bins.length; i++) {
		const idx = binIndexFor(frame.f0 + i * step + step / 2, startHz, endHz, N);
		if (idx >= 0) applyBinSample(state, idx, frame.bins[i], ts, provisionalThreshold);
	}
}

function applyParsed(
	parsed: Frame | MetaLine,
	state: FeatureState,
	startHz: number,
	endHz: number,
	N: number,
	provisional: number
): void {
	if ('type' in parsed) {
		state.binHz = parsed.binHz;
		return;
	}
	absorbFrame(parsed, state, startHz, endHz, N, provisional);
}

async function streamFrames(
	ndjsonPath: string,
	state: FeatureState,
	startHz: number,
	endHz: number,
	N: number
): Promise<void> {
	const rl = createInterface({
		input: createReadStream(ndjsonPath, { encoding: 'utf8' }),
		crlfDelay: Infinity
	});
	const provisional = -80;
	for await (const line of rl) {
		if (!line) continue;
		const parsed = parseLine(line);
		if (parsed) applyParsed(parsed, state, startHz, endHz, N, provisional);
	}
}

function computeNoiseFloor(peak: Float32Array): number {
	const finite = Array.from(peak).filter((v) => Number.isFinite(v));
	if (finite.length === 0) return -110;
	const sorted = finite.slice().sort((a, b) => a - b);
	const quartile = Math.max(1, Math.floor(sorted.length / 4));
	const bottom = sorted.slice(0, quartile);
	const mid = Math.floor(bottom.length / 2);
	return bottom.length % 2 === 0 ? (bottom[mid - 1] + bottom[mid]) / 2 : bottom[mid];
}

interface Run {
	startIdx: number;
	endIdx: number;
}

function consumeRun(peak: Float32Array, start: number, above: (v: number) => boolean): number {
	let i = start;
	while (i < peak.length && above(peak[i])) i++;
	return i;
}

function findRuns(peak: Float32Array, above: (v: number) => boolean): Run[] {
	const runs: Run[] = [];
	for (let i = 0; i < peak.length; i++) {
		if (!above(peak[i])) continue;
		const end = consumeRun(peak, i, above);
		runs.push({ startIdx: i, endIdx: end - 1 });
		i = end - 1;
	}
	return runs;
}

interface RunStats {
	peak: number;
	maxDuty: number;
	firstSeen: number;
	lastSeen: number;
}

function foldBinIntoStats(s: RunStats, state: FeatureState, j: number): void {
	if (state.peak[j] > s.peak) s.peak = state.peak[j];
	if (state.dutyCount[j] > s.maxDuty) s.maxDuty = state.dutyCount[j];
	if (state.firstSeen[j] < s.firstSeen) s.firstSeen = state.firstSeen[j];
	if (state.lastSeen[j] > s.lastSeen) s.lastSeen = state.lastSeen[j];
}

function aggregateRunStats(state: FeatureState, run: Run): RunStats {
	const s: RunStats = { peak: -Infinity, maxDuty: 0, firstSeen: Infinity, lastSeen: 0 };
	for (let j = run.startIdx; j <= run.endIdx; j++) foldBinIntoStats(s, state, j);
	return s;
}

function runToEmitter(
	run: Run,
	state: FeatureState,
	startHz: number,
	binWidthHz: number
): SpectrumEmitter {
	const startFreq = startHz + run.startIdx * binWidthHz;
	const endFreq = startHz + (run.endIdx + 1) * binWidthHz;
	const s = aggregateRunStats(state, run);
	return {
		center_mhz: (startFreq + endFreq) / 2 / 1e6,
		bandwidth_khz: (endFreq - startFreq) / 1e3,
		peak_dbm: s.peak,
		duty_cycle: state.totalFrames > 0 ? s.maxDuty / state.totalFrames : 0,
		first_seen_ms: Number.isFinite(s.firstSeen) ? s.firstSeen : 0,
		last_seen_ms: s.lastSeen
	};
}

function extractEmitters(
	state: FeatureState,
	threshold: number,
	startHz: number,
	binWidthHz: number
): SpectrumEmitter[] {
	const runs = findRuns(state.peak, (v) => Number.isFinite(v) && v > threshold);
	const emitters = runs.map((r) => runToEmitter(r, state, startHz, binWidthHz));
	emitters.sort((a, b) => b.peak_dbm - a.peak_dbm);
	return emitters.slice(0, 10);
}

function extractQuietBands(
	peak: Float32Array,
	ceilingDbm: number,
	startHz: number,
	binWidthHz: number
): SpectrumFeatures['quiet_bands'] {
	const runs = findRuns(peak, (v) => !Number.isFinite(v) || v < ceilingDbm);
	const bands = runs
		.map((r) => {
			const s = startHz + r.startIdx * binWidthHz;
			const e = startHz + (r.endIdx + 1) * binWidthHz;
			return {
				start_mhz: s / 1e6,
				end_mhz: e / 1e6,
				width_khz: (e - s) / 1e3
			};
		})
		.filter((b) => b.width_khz >= 200);
	bands.sort((a, b) => b.width_khz - a.width_khz);
	return bands.slice(0, 5);
}

function recomputeDuty(state: FeatureState, threshold: number): void {
	// Pass-2 using refined threshold would require frame retention; instead,
	// reuse provisional counts which approximate duty vs noise+15 for bins
	// whose peaks already exceed the refined threshold.
	for (let i = 0; i < state.peak.length; i++) {
		if (!Number.isFinite(state.peak[i]) || state.peak[i] <= threshold) {
			state.dutyCount[i] = 0;
		}
	}
}

async function safeStreamFrames(
	ndjsonPath: string,
	state: FeatureState,
	startHz: number,
	endHz: number,
	N: number
): Promise<void> {
	try {
		await streamFrames(ndjsonPath, state, startHz, endHz, N);
	} catch (error) {
		logger.warn('spectrum-features read failed', {
			ndjsonPath,
			error: error instanceof Error ? error.message : String(error)
		});
	}
}

function durationSeconds(state: FeatureState): number {
	if (state.firstFrameMs === null || state.lastFrameMs === null) return 0;
	return Math.max(0, (state.lastFrameMs - state.firstFrameMs) / 1000);
}

export async function extractSpectrumFeatures(
	ndjsonPath: string,
	startHz: number,
	endHz: number
): Promise<SpectrumFeatures> {
	const N = 1024;
	const state = makeState(N);
	await safeStreamFrames(ndjsonPath, state, startHz, endHz, N);
	const noiseFloor = computeNoiseFloor(state.peak);
	const emitterThreshold = noiseFloor + 15;
	const quietCeiling = noiseFloor + 6;
	recomputeDuty(state, emitterThreshold);
	const binWidthHz = (endHz - startHz) / N;
	const emitters = extractEmitters(state, emitterThreshold, startHz, binWidthHz);
	const quietBands = extractQuietBands(state.peak, quietCeiling, startHz, binWidthHz);
	return {
		band: { start_mhz: startHz / 1e6, end_mhz: endHz / 1e6, bin_hz: state.binHz || binWidthHz },
		capture: { total_frames: state.totalFrames, duration_sec: durationSeconds(state) },
		noise_floor_dbm: noiseFloor,
		emitters,
		quiet_bands: quietBands
	};
}
