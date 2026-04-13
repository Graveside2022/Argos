/**
 * GET /api/reports/:id/view?format=html|pdf|revealjs|slides-pdf
 *
 * Streams the rendered report artifact (html, pdf, reveal.js slides, or
 * slides pdf) with frame-ancestors locked to self.
 */

import { existsSync, readFileSync } from 'node:fs';

import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { getRFDatabase } from '$lib/server/db/database';
import { getReport } from '$lib/server/services/reports/mission-store';
import type { ReportRow } from '$lib/server/services/reports/types';

type ViewFormat = 'html' | 'pdf' | 'revealjs' | 'slides-pdf';

const ALLOWED_FORMATS: ViewFormat[] = ['html', 'pdf', 'revealjs', 'slides-pdf'];

const MIME: Record<ViewFormat, string> = {
	html: 'text/html; charset=utf-8',
	pdf: 'application/pdf',
	revealjs: 'text/html; charset=utf-8',
	'slides-pdf': 'application/pdf'
};

function resolveArtifactPath(report: ReportRow, format: ViewFormat): string | null {
	switch (format) {
		case 'html':
			return report.html_path;
		case 'pdf':
			return report.pdf_path;
		case 'revealjs':
			return report.slides_html_path;
		case 'slides-pdf':
			return report.slides_pdf_path;
	}
}

type Resolved = { ok: true; path: string } | { ok: false; status: number; error: string };

function resolveReportArtifact(id: string, format: ViewFormat): Resolved {
	const db = getRFDatabase().rawDb;
	const report = getReport(db, id);
	if (!report) return { ok: false, status: 404, error: 'Report not found' };
	const path = resolveArtifactPath(report, format);
	if (!path) {
		return { ok: false, status: 404, error: `Artifact not available for format: ${format}` };
	}
	if (!existsSync(path)) {
		return { ok: false, status: 500, error: `Artifact missing on disk: ${path}` };
	}
	return { ok: true, path };
}

function streamArtifact(path: string, format: ViewFormat): Response {
	const buffer = readFileSync(path);
	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': MIME[format],
			'X-Frame-Options': 'SAMEORIGIN',
			'Content-Security-Policy': "frame-ancestors 'self'"
		}
	});
}

export const GET = createHandler(({ params, url }) => {
	const id = params.id;
	if (!id) {
		return json({ success: false, error: 'Missing report id' }, { status: 400 });
	}
	const formatParam = (url.searchParams.get('format') ?? 'html') as ViewFormat;
	if (!ALLOWED_FORMATS.includes(formatParam)) {
		return json({ success: false, error: 'Invalid format' }, { status: 400 });
	}
	const resolved = resolveReportArtifact(id, formatParam);
	if (!resolved.ok) {
		return json({ success: false, error: resolved.error }, { status: resolved.status });
	}
	return streamArtifact(resolved.path, formatParam);
});
