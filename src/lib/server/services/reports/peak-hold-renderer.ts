import { createWriteStream, existsSync } from 'node:fs';
import { join } from 'node:path';

import { PNG } from 'pngjs';

import { logger } from '$lib/utils/logger';

import { accumulatePeakHold } from './peak-hold-accumulate';
import { drawText } from './peak-hold-font';

const W = 1920;
const H = 900;
const TITLE_H = 60;
const WATER_H = 480;
const PEAK_H = 360;
const LEFT_AXIS = 60;
const RIGHT_PAD = 20;
const N = W - LEFT_AXIS - RIGHT_PAD;
const CLIP_MIN = -120;
const CLIP_MAX = -20;

const BG: [number, number, number] = [0x11, 0x11, 0x11];
const GRID: [number, number, number] = [0x2e, 0x2e, 0x2e];
const TEXT: [number, number, number] = [0xdd, 0xdd, 0xdd];
const TRACE: [number, number, number] = [0xa8, 0xb8, 0xe0];

type RGB = [number, number, number];

const MAGMA_KEYS: Array<[number, RGB]> = [
	[0, [0, 0, 0]],
	[40, [40, 40, 80]],
	[120, [120, 60, 120]],
	[200, [200, 90, 80]],
	[255, [250, 250, 200]]
];

function findKeySegment(i: number): [[number, RGB], [number, RGB]] {
	for (let k = 0; k < MAGMA_KEYS.length - 1; k++) {
		if (i >= MAGMA_KEYS[k][0] && i <= MAGMA_KEYS[k + 1][0]) {
			return [MAGMA_KEYS[k], MAGMA_KEYS[k + 1]];
		}
	}
	return [MAGMA_KEYS[0], MAGMA_KEYS[MAGMA_KEYS.length - 1]];
}

function interpolateKey(i: number, lo: [number, RGB], hi: [number, RGB]): RGB {
	const span = hi[0] - lo[0] || 1;
	const t = (i - lo[0]) / span;
	return [
		Math.round(lo[1][0] + (hi[1][0] - lo[1][0]) * t),
		Math.round(lo[1][1] + (hi[1][1] - lo[1][1]) * t),
		Math.round(lo[1][2] + (hi[1][2] - lo[1][2]) * t)
	];
}

function buildLut(): RGB[] {
	const lut: RGB[] = [];
	for (let i = 0; i < 256; i++) {
		const [lo, hi] = findKeySegment(i);
		lut.push(interpolateKey(i, lo, hi));
	}
	return lut;
}

const LUT = buildLut();

function setPx(buf: Buffer, x: number, y: number, rgb: RGB): void {
	if (x < 0 || x >= W || y < 0 || y >= H) return;
	const idx = (W * y + x) << 2;
	buf[idx] = rgb[0];
	buf[idx + 1] = rgb[1];
	buf[idx + 2] = rgb[2];
	buf[idx + 3] = 0xff;
}

function fillBackground(buf: Buffer): void {
	for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) setPx(buf, x, y, BG);
}

function clipNorm(dbm: number): number | null {
	if (!Number.isFinite(dbm)) return null;
	const clamped = Math.max(CLIP_MIN, Math.min(CLIP_MAX, dbm));
	return (clamped - CLIP_MIN) / (CLIP_MAX - CLIP_MIN);
}

function drawWaterfallBin(buf: Buffer, x: number, yTop: number, yBot: number, dbm: number): void {
	const norm = clipNorm(dbm);
	if (norm === null) return;
	const lutIdx = Math.floor(norm * 255);
	const rgb = LUT[Math.max(0, Math.min(255, lutIdx))];
	for (let yy = yTop; yy < yBot; yy++) setPx(buf, x, yy, rgb);
}

function drawWaterfallRow(buf: Buffer, row: Float32Array, yTop: number, yBot: number): void {
	for (let j = 0; j < N; j++) {
		drawWaterfallBin(buf, LEFT_AXIS + j, yTop, yBot, row[j]);
	}
}

function drawWaterfall(buf: Buffer, rows: Float32Array[]): void {
	if (rows.length === 0) return;
	for (let i = 0; i < rows.length; i++) {
		const yTop = TITLE_H + Math.floor((i * WATER_H) / rows.length);
		const yBot = TITLE_H + Math.floor(((i + 1) * WATER_H) / rows.length);
		drawWaterfallRow(buf, rows[i], yTop, yBot);
	}
}

function drawPeakGridHLines(buf: Buffer, panelTop: number): void {
	for (let db = CLIP_MIN; db <= CLIP_MAX; db += 10) {
		const norm = (db - CLIP_MIN) / (CLIP_MAX - CLIP_MIN);
		const y = panelTop + Math.round((1 - norm) * (PEAK_H - 20));
		for (let x = LEFT_AXIS; x < LEFT_AXIS + N; x += 4) setPx(buf, x, y, GRID);
	}
}

function drawPeakGridVLines(buf: Buffer, panelTop: number): void {
	for (let g = 0; g <= 10; g++) {
		const x = LEFT_AXIS + Math.floor((g * N) / 10);
		for (let y = panelTop; y < panelTop + PEAK_H - 20; y += 4) setPx(buf, x, y, GRID);
	}
}

function drawPeakGrid(buf: Buffer): void {
	const panelTop = TITLE_H + WATER_H;
	drawPeakGridHLines(buf, panelTop);
	drawPeakGridVLines(buf, panelTop);
}

function drawTraceSegment(buf: Buffer, x: number, y: number | null, prevY: number | null): void {
	if (y === null) return;
	if (prevY === null) {
		setPx(buf, x, y, TRACE);
		return;
	}
	const ymin = Math.min(prevY, y);
	const ymax = Math.max(prevY, y);
	for (let yy = ymin; yy <= ymax; yy++) setPx(buf, x, yy, TRACE);
}

function drawPeakTrace(buf: Buffer, peak: Float32Array): void {
	const panelTop = TITLE_H + WATER_H;
	const usableH = PEAK_H - 20;
	const toY = (idx: number): number | null => {
		const norm = clipNorm(peak[idx]);
		if (norm === null) return null;
		return panelTop + Math.round((1 - norm) * usableH);
	};
	let prevY = toY(0);
	for (let i = 1; i < N; i++) {
		const y = toY(i);
		drawTraceSegment(buf, LEFT_AXIS + i, y, prevY);
		prevY = y;
	}
}

function formatMHz(n: number): string {
	return n.toFixed(1);
}

function drawTitle(buf: Buffer, startMHz: number, endMHz: number, binHz: number): void {
	const title = `PEAK-HOLD ${formatMHz(startMHz)}-${formatMHz(endMHz)} MHZ · ${Math.round(binHz / 1000)} KHZ BINS`;
	drawText(buf, W, LEFT_AXIS, 24, title, TEXT);
}

function drawYLabels(buf: Buffer): void {
	const panelTop = TITLE_H + WATER_H;
	for (let db = CLIP_MIN; db <= CLIP_MAX; db += 20) {
		const norm = (db - CLIP_MIN) / (CLIP_MAX - CLIP_MIN);
		const y = panelTop + Math.round((1 - norm) * (PEAK_H - 20));
		drawText(buf, W, 6, y - 2, `${db}`, TEXT);
	}
}

function drawXLabels(buf: Buffer, startMHz: number, endMHz: number): void {
	const y = H - 14;
	for (let g = 0; g <= 10; g++) {
		const freq = startMHz + ((endMHz - startMHz) * g) / 10;
		const x = LEFT_AXIS + Math.floor((g * N) / 10) - 6;
		drawText(buf, W, x, y, formatMHz(freq), TEXT);
	}
	drawText(buf, W, W - 40, y, 'MHZ', TEXT);
}

function drawWaterfallTimeLabels(
	buf: Buffer,
	firstFrameMs: number | null,
	lastFrameMs: number | null
): void {
	if (firstFrameMs === null || lastFrameMs === null) return;
	const first = new Date(firstFrameMs).toISOString().substring(11, 19);
	const last = new Date(lastFrameMs).toISOString().substring(11, 19);
	drawText(buf, W, 4, TITLE_H + 4, first, TEXT);
	drawText(buf, W, 4, TITLE_H + WATER_H - 10, last, TEXT);
}

function hasAnyPeak(peak: Float32Array): boolean {
	for (let i = 0; i < peak.length; i++) if (Number.isFinite(peak[i])) return true;
	return false;
}

async function writePng(png: PNG, pngPath: string): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const out = createWriteStream(pngPath);
		out.on('error', reject);
		out.on('finish', () => resolve());
		png.pack().pipe(out);
	});
}

export interface RenderPeakHoldOptions {
	captureId: string;
	startHz: number;
	endHz: number;
	outputDir: string;
	ndjsonPath?: string;
}

export interface RenderPeakHoldResult {
	pngPath: string;
	caption: string;
}

type AccumulateResult = Awaited<ReturnType<typeof accumulatePeakHold>>;

function paintFrame(buf: Buffer, opts: RenderPeakHoldOptions, result: AccumulateResult): void {
	fillBackground(buf);
	drawTitle(buf, opts.startHz / 1e6, opts.endHz / 1e6, result.meta?.binHz ?? 2000);
	drawWaterfall(buf, result.rows);
	drawWaterfallTimeLabels(buf, result.firstFrameMs, result.lastFrameMs);
	drawPeakGrid(buf);
	drawPeakTrace(buf, result.peak);
	drawYLabels(buf);
	drawXLabels(buf, opts.startHz / 1e6, opts.endHz / 1e6);
}

function buildCaption(opts: RenderPeakHoldOptions, result: AccumulateResult): string {
	const binHz = result.meta?.binHz ?? 2000;
	const durationMin =
		result.firstFrameMs !== null && result.lastFrameMs !== null
			? (result.lastFrameMs - result.firstFrameMs) / 60000
			: 0;
	return `Peak-hold ${(opts.startHz / 1e6).toFixed(1)}–${(opts.endHz / 1e6).toFixed(1)} MHz @ ${(binHz / 1000).toFixed(0)} kHz bins, ${durationMin.toFixed(1)} min capture`;
}

async function tryWritePng(png: PNG, pngPath: string, captureId: string): Promise<boolean> {
	try {
		await writePng(png, pngPath);
		return true;
	} catch (error) {
		logger.warn('peak-hold: png write failed', {
			captureId,
			error: error instanceof Error ? error.message : String(error)
		});
		return false;
	}
}

export async function renderPeakHoldPng(
	opts: RenderPeakHoldOptions
): Promise<RenderPeakHoldResult | null> {
	const ndjsonPath =
		opts.ndjsonPath ?? join(process.cwd(), 'data', 'captures', opts.captureId, 'sweep.ndjson');
	if (!existsSync(ndjsonPath)) {
		logger.info('peak-hold: no sweep log for capture', { captureId: opts.captureId });
		return null;
	}
	const result = await accumulatePeakHold(ndjsonPath, opts.startHz, opts.endHz, N, WATER_H);
	if (!hasAnyPeak(result.peak)) {
		logger.info('peak-hold: empty accumulator', { captureId: opts.captureId });
		return null;
	}
	const png = new PNG({ width: W, height: H });
	paintFrame(png.data, opts, result);
	const pngPath = join(opts.outputDir, `peak-hold-${opts.captureId}.png`);
	if (!(await tryWritePng(png, pngPath, opts.captureId))) return null;
	return { pngPath, caption: buildCaption(opts, result) };
}
