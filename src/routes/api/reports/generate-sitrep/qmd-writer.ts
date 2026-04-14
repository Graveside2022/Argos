import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

import { buildSitrepQmd } from '$lib/server/services/reports/sitrep-template';
import type { CaptureEmitterRow, CaptureRow, Mission } from '$lib/server/services/reports/types';

export interface WriteQmdOptions {
	reportId: string;
	mission: Mission;
	capture: CaptureRow;
	emitters: CaptureEmitterRow[];
	periodStart: number;
	periodEnd: number;
	narrative: string | undefined;
	spectrumImagePath: string | undefined;
	spectrumCaption: string | undefined;
	spectrumAnalysis: string | undefined;
}

// Allow-list directories the spectrum image may live in. Any absolute path
// outside these roots is rejected to prevent path traversal via the
// spectrum_image_path request body field.
function isSafeSpectrumPath(p: string): boolean {
	const resolved = resolve(p);
	const dataRoot = resolve(process.cwd(), 'data');
	const tmpRoot = resolve('/tmp');
	const inData = resolved === dataRoot || resolved.startsWith(dataRoot + '/');
	const inTmp = resolved === tmpRoot || resolved.startsWith(tmpRoot + '/');
	if (!inData && !inTmp) return false;
	return existsSync(resolved);
}

function copySpectrumImage(
	reportDir: string,
	spectrumImagePath: string | undefined
): string | undefined {
	if (!spectrumImagePath || !isSafeSpectrumPath(spectrumImagePath)) return undefined;
	const fname = basename(spectrumImagePath);
	copyFileSync(spectrumImagePath, join(reportDir, fname));
	return fname;
}

export function writeQmdSource(opts: WriteQmdOptions): string {
	const reportDir = join(process.cwd(), 'data', 'reports', opts.reportId);
	if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });
	const qmdPath = join(reportDir, 'source.qmd');
	const serial = opts.reportId.slice(0, 8).toUpperCase();
	const spectrumRelPath = copySpectrumImage(reportDir, opts.spectrumImagePath);
	const qmd = buildSitrepQmd({
		mission: opts.mission,
		capture: opts.capture,
		period_start: opts.periodStart,
		period_end: opts.periodEnd,
		emitters: opts.emitters,
		narrative: opts.narrative,
		serial,
		spectrum_image_path: spectrumRelPath,
		spectrum_caption: opts.spectrumCaption,
		spectrum_analysis: opts.spectrumAnalysis
	});
	writeFileSync(qmdPath, qmd, 'utf-8');
	return qmdPath;
}
