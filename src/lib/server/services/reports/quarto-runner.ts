/**
 * Quarto render runner.
 *
 * Wraps `quarto render` invocation for report generation. Input validation
 * is strict: the qmd path must be absolute, must exist, and must end in
 * `.qmd`. Each requested format is rendered in a separate invocation so a
 * failure in one format is surfaced clearly without blocking the others.
 */

import { existsSync } from 'node:fs';
import { basename, dirname, isAbsolute, join } from 'node:path';

import { execFileAsync } from '$lib/server/exec';
import { logger } from '$lib/utils/logger';

export type QuartoFormat = 'html' | 'pdf' | 'revealjs' | 'slides-pdf';

export type QuartoRenderResult = {
	htmlPath: string;
	pdfPath: string | null;
	slidesHtmlPath: string | null;
	slidesPdfPath: string | null;
};

export type QuartoRenderOptions = {
	formats?: QuartoFormat[];
	timeout?: number;
};

const QUARTO_BIN = '/usr/local/bin/quarto';
const DEFAULT_TIMEOUT_MS = 120_000;

function validateQmdPath(qmdPath: string): void {
	if (!isAbsolute(qmdPath)) {
		throw new Error(`quarto-runner: qmdPath must be absolute: ${qmdPath}`);
	}
	if (!qmdPath.endsWith('.qmd')) {
		throw new Error(`quarto-runner: qmdPath must end with .qmd: ${qmdPath}`);
	}
	if (!existsSync(qmdPath)) {
		throw new Error(`quarto-runner: qmdPath does not exist: ${qmdPath}`);
	}
}

function outputPathFor(qmdPath: string, format: QuartoFormat): string {
	const dir = dirname(qmdPath);
	const base = basename(qmdPath, '.qmd');
	switch (format) {
		case 'html':
			return join(dir, `${base}.html`);
		case 'pdf':
			return join(dir, `${base}.pdf`);
		case 'revealjs':
			return join(dir, `${base}-slides.html`);
		case 'slides-pdf':
			return join(dir, `${base}-slides.pdf`);
	}
}

function quartoFormatArg(format: QuartoFormat): string {
	switch (format) {
		case 'html':
			return 'argos-reports-html';
		case 'pdf':
			return 'argos-reports-typst';
		case 'revealjs':
			return 'argos-reports-revealjs';
		case 'slides-pdf':
			return 'argos-reports-typst';
	}
}

async function renderOne(qmdPath: string, format: QuartoFormat, timeout: number): Promise<string> {
	const arg = quartoFormatArg(format);
	try {
		await execFileAsync(QUARTO_BIN, ['render', qmdPath, '--to', arg], {
			timeout,
			cwd: process.cwd()
		});
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		logger.error('quarto render failed', { qmdPath, format, error: msg });
		throw new Error(`quarto render ${format} failed: ${msg}`);
	}
	return outputPathFor(qmdPath, format);
}

const FORMAT_TARGETS: Record<QuartoFormat, keyof QuartoRenderResult> = {
	html: 'htmlPath',
	pdf: 'pdfPath',
	revealjs: 'slidesHtmlPath',
	'slides-pdf': 'slidesPdfPath'
};

function assignFormatResult(
	result: QuartoRenderResult,
	format: QuartoFormat,
	outPath: string
): void {
	const key = FORMAT_TARGETS[format];
	(result as Record<string, string | null>)[key] = outPath;
}

function resolveRenderOptions(opts: QuartoRenderOptions | undefined): {
	formats: QuartoFormat[];
	timeout: number;
} {
	return {
		formats: opts?.formats ?? ['html', 'pdf', 'revealjs'],
		timeout: opts?.timeout ?? DEFAULT_TIMEOUT_MS
	};
}

export async function renderQuartoDoc(
	qmdPath: string,
	opts?: QuartoRenderOptions
): Promise<QuartoRenderResult> {
	validateQmdPath(qmdPath);
	const { formats, timeout } = resolveRenderOptions(opts);

	const result: QuartoRenderResult = {
		htmlPath: outputPathFor(qmdPath, 'html'),
		pdfPath: null,
		slidesHtmlPath: null,
		slidesPdfPath: null
	};

	for (const format of formats) {
		const outPath = await renderOne(qmdPath, format, timeout);
		assignFormatResult(result, format, outPath);
	}

	logger.info('quarto render complete', { qmdPath, formats });
	return result;
}
