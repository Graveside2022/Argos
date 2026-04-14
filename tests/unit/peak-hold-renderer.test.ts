import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PNG } from 'pngjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { renderPeakHoldPng } from '../../src/lib/server/services/reports/peak-hold-renderer';

const FIXTURE = join(__dirname, '..', 'fixtures', 'reports', 'sweep-sample.ndjson');

let workDir: string;

const CAPTURE_ID = 'test-capture-peakhold';

const LEFT_AXIS = 60;
const RIGHT_PAD = 20;
const W = 1920;
const H = 900;
const PLOT_WIDTH = W - LEFT_AXIS - RIGHT_PAD;
const TITLE_H = 60;
const WATER_H = 480;
const PEAK_H = 360;
const START_MHZ = 925;
const END_MHZ = 960;
const CLIP_MIN = -120;
const CLIP_MAX = -20;
const USABLE_PEAK_H = PEAK_H - 20;
const PANEL_TOP = TITLE_H + WATER_H;

type RGB = [number, number, number];

function pixelAt(png: PNG, x: number, y: number): RGB {
	const idx = (W * y + x) << 2;
	return [png.data[idx], png.data[idx + 1], png.data[idx + 2]];
}

function freqToX(mhz: number): number {
	return LEFT_AXIS + Math.floor(((mhz - START_MHZ) / (END_MHZ - START_MHZ)) * PLOT_WIDTH);
}

function binCenterX(binIdx: number): number {
	return freqToX(START_MHZ + binIdx + 0.5);
}

function peakY(dbm: number): number {
	const norm = (dbm - CLIP_MIN) / (CLIP_MAX - CLIP_MIN);
	return PANEL_TOP + Math.round((1 - norm) * USABLE_PEAK_H);
}

function isSteelBlue(rgb: [number, number, number]): boolean {
	return rgb[0] > 0x80 && rgb[1] > 0x80 && rgb[2] > 0xb0;
}

function rowHasSteelBlue(png: PNG, cx: number, y: number): boolean {
	for (let dx = -6; dx <= 6; dx++) {
		if (isSteelBlue(pixelAt(png, cx + dx, y))) return true;
	}
	return false;
}

function findPeakNear(png: PNG, cx: number, cy: number): boolean {
	for (let dy = -6; dy <= 6; dy++) {
		if (rowHasSteelBlue(png, cx, cy + dy)) return true;
	}
	return false;
}

function isBackgroundColumn(png: PNG, cx: number, cy: number): boolean {
	for (let dy = -3; dy <= 3; dy++) {
		const [r, g, b] = pixelAt(png, cx, cy + dy);
		if (r > 0x50 || g > 0x50 || b > 0x80) return false;
	}
	return true;
}

function hasBrightWaterfall(png: PNG, cx: number, y: number): boolean {
	for (let dx = -6; dx <= 6; dx++) {
		const [r, g, b] = pixelAt(png, cx + dx, y);
		if (r + g + b > 200) return true;
	}
	return false;
}

beforeAll(() => {
	workDir = mkdtempSync(join(tmpdir(), 'peakhold-'));
});

afterAll(() => {
	try {
		rmSync(workDir, { recursive: true, force: true });
	} catch {
		/* noop */
	}
});

describe('renderPeakHoldPng', () => {
	it('renders composite PNG from fixture NDJSON', async () => {
		const result = await renderPeakHoldPng({
			captureId: CAPTURE_ID,
			startHz: 925_000_000,
			endHz: 960_000_000,
			outputDir: workDir,
			ndjsonPath: FIXTURE
		});

		expect(result).not.toBeNull();
		if (!result) return;
		expect(existsSync(result.pngPath)).toBe(true);
		expect(result.caption).toMatch(/Peak-hold 925\.0–960\.0 MHz @ 2 kHz bins/);

		const png = PNG.sync.read(readFileSync(result.pngPath));
		expect(png.width).toBe(W);
		expect(png.height).toBe(H);

		const x925bin = binCenterX(0);
		const y30 = peakY(-30);
		expect(findPeakNear(png, x925bin, y30)).toBe(true);

		// 932 MHz is between fixture peaks — should stay at background color.
		const x932 = freqToX(932);
		expect(isBackgroundColumn(png, x932, y30)).toBe(true);

		const waterRowTop = TITLE_H + 4;
		expect(hasBrightWaterfall(png, x925bin, waterRowTop)).toBe(true);
	});
});
