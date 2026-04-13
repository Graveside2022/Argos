import type Database from 'better-sqlite3';

import { getCapture } from '$lib/server/services/reports/mission-store';
import { renderPeakHoldPng } from '$lib/server/services/reports/peak-hold-renderer';
import type { CaptureRow } from '$lib/server/services/reports/types';
import { logger } from '$lib/utils/logger';

export interface SpectrumAssetOptions {
	spectrumImagePath: string | undefined;
	spectrumCaption: string | undefined;
	spectrumAnalysis: string | undefined;
	spectrumStartHzOverride?: number;
	spectrumEndHzOverride?: number;
}

export interface SpectrumAssets {
	spectrumImagePath: string | undefined;
	spectrumCaption: string | undefined;
	spectrumAnalysis: string | undefined;
}

interface PeakHoldResult {
	pngPath: string;
	caption: string;
}

async function safeRenderPeakHold(
	captureId: string,
	startHz: number,
	endHz: number,
	reportDir: string
): Promise<PeakHoldResult | null> {
	try {
		return await renderPeakHoldPng({ captureId, startHz, endHz, outputDir: reportDir });
	} catch (error) {
		logger.warn('generate-sitrep: peak-hold render failed', {
			captureId,
			error: error instanceof Error ? error.message : String(error)
		});
		return null;
	}
}

async function maybeRenderPeakHold(
	captureLoadout: CaptureRow['loadout'],
	captureId: string,
	reportDir: string,
	startOverride: number | undefined,
	endOverride: number | undefined
): Promise<PeakHoldResult | null> {
	const startHz = startOverride ?? captureLoadout.spectrum_start_hz;
	const endHz = endOverride ?? captureLoadout.spectrum_end_hz;
	if (!startHz || !endHz) return null;
	return safeRenderPeakHold(captureId, startHz, endHz, reportDir);
}

function resultFromRender(
	rendered: PeakHoldResult | null,
	opts: SpectrumAssetOptions
): SpectrumAssets {
	return {
		spectrumImagePath: rendered?.pngPath,
		spectrumCaption: rendered
			? (opts.spectrumCaption ?? rendered.caption)
			: opts.spectrumCaption,
		spectrumAnalysis: opts.spectrumAnalysis
	};
}

async function renderForCapture(
	db: Database.Database,
	tickCaptureId: string,
	reportDir: string,
	opts: SpectrumAssetOptions
): Promise<SpectrumAssets> {
	const fullCapture = getCapture(db, tickCaptureId);
	if (!fullCapture) return resultFromRender(null, opts);
	const rendered = await maybeRenderPeakHold(
		fullCapture.loadout,
		fullCapture.id,
		reportDir,
		opts.spectrumStartHzOverride,
		opts.spectrumEndHzOverride
	);
	return resultFromRender(rendered, opts);
}

export async function resolveSpectrumAssets(
	db: Database.Database,
	tickCaptureId: string,
	reportDir: string,
	opts: SpectrumAssetOptions
): Promise<SpectrumAssets> {
	if (opts.spectrumImagePath) {
		return {
			spectrumImagePath: opts.spectrumImagePath,
			spectrumCaption: opts.spectrumCaption,
			spectrumAnalysis: opts.spectrumAnalysis
		};
	}
	return renderForCapture(db, tickCaptureId, reportDir, opts);
}
