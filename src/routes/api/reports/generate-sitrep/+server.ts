/**
 * POST /api/reports/generate-sitrep
 *
 * Builds a SITREP Quarto source, renders it, and persists the report row.
 * Uses the active mission if `mission_id` is omitted. Pulls the latest
 * `tick`-role capture within the window and emits its snapshot.
 */

import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { json } from '@sveltejs/kit';
import type Database from 'better-sqlite3';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { getRFDatabase } from '$lib/server/db/database';
import {
	createReport,
	getActiveMission,
	getCaptureEmitters,
	getMission,
	listCapturesForMission
} from '$lib/server/services/reports/mission-store';
import { renderQuartoDoc } from '$lib/server/services/reports/quarto-runner';
import { countByClass } from '$lib/server/services/reports/sitrep-template';
import type {
	CaptureEmitterRow,
	CaptureRow,
	Mission,
	ReportRow
} from '$lib/server/services/reports/types';

import { writeQmdSource } from './qmd-writer';
import { resolveSpectrumAssets } from './spectrum-assets';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

const GenerateSitrepSchema = z.object({
	mission_id: z.string().min(1).optional(),
	period_start: z.number().int().nonnegative().optional(),
	period_end: z.number().int().nonnegative().optional(),
	narrative: z.string().max(10_000).optional(),
	spectrum_image_path: z.string().max(500).optional(),
	spectrum_caption: z.string().max(500).optional(),
	spectrum_start_hz: z.number().positive().optional(),
	spectrum_end_hz: z.number().positive().optional(),
	spectrum_analysis: z.string().max(10_000).optional()
});

type SitrepBody = z.infer<typeof GenerateSitrepSchema>;

type ResolvedMission =
	| { ok: true; missionId: string; mission: Mission }
	| { ok: false; status: number; error: string };

function resolveMission(db: Database.Database, bodyMissionId?: string): ResolvedMission {
	const missionId = bodyMissionId ?? getActiveMission(db)?.id;
	if (!missionId) {
		return {
			ok: false,
			status: 400,
			error: 'No active mission — provide mission_id or activate one'
		};
	}
	const mission = getMission(db, missionId);
	if (!mission) return { ok: false, status: 404, error: 'Mission not found' };
	return { ok: true, missionId, mission };
}

function pickLatestTick(
	db: Database.Database,
	missionId: string,
	periodStart: number,
	periodEnd: number
): CaptureRow | null {
	const captures = listCapturesForMission(db, missionId);
	const filtered = captures
		.filter((c) => c.role === 'tick' && c.start_dtg >= periodStart && c.start_dtg <= periodEnd)
		.sort((a, b) => b.start_dtg - a.start_dtg);
	return filtered[0] ?? null;
}

async function persistSitrepReport(
	db: Database.Database,
	missionId: string,
	mission: Mission,
	captureId: string,
	emitters: CaptureEmitterRow[],
	qmdPath: string,
	periodEnd: number
): Promise<ReportRow> {
	const render = await renderQuartoDoc(qmdPath);
	const title = `SITREP — ${mission.name} — ${new Date(periodEnd).toISOString()}`;
	const counts = countByClass(emitters);
	return createReport(db, {
		mission_id: missionId,
		type: 'sitrep',
		title,
		capture_ids: [captureId],
		emitter_count: emitters.length,
		flagged_hostile: counts.hostile,
		flagged_suspect: counts.suspect,
		source_qmd_path: qmdPath,
		html_path: render.htmlPath,
		pdf_path: render.pdfPath,
		slides_html_path: render.slidesHtmlPath,
		slides_pdf_path: render.slidesPdfPath
	});
}

async function parseSitrepBody(
	request: Request
): Promise<{ ok: true; data: SitrepBody } | { ok: false; error: string; details?: unknown }> {
	const raw = await request.json().catch(() => ({}));
	const parsed = GenerateSitrepSchema.safeParse(raw);
	if (!parsed.success) {
		return { ok: false, error: 'Invalid body', details: parsed.error.issues };
	}
	return { ok: true, data: parsed.data };
}

export const POST = createHandler(async ({ request }) => {
	const body = await parseSitrepBody(request);
	if (!body.ok) {
		return json({ success: false, error: body.error, details: body.details }, { status: 400 });
	}

	const db = getRFDatabase().rawDb;
	const resolved = resolveMission(db, body.data.mission_id);
	if (!resolved.ok) {
		return json({ success: false, error: resolved.error }, { status: resolved.status });
	}
	const { missionId, mission } = resolved;

	const periodEnd = body.data.period_end ?? Date.now();
	const periodStart = body.data.period_start ?? periodEnd - FIFTEEN_MINUTES_MS;
	return renderSitrep({
		db,
		missionId,
		mission,
		periodStart,
		periodEnd,
		narrative: body.data.narrative,
		spectrumImagePath: body.data.spectrum_image_path,
		spectrumCaption: body.data.spectrum_caption,
		spectrumAnalysis: body.data.spectrum_analysis,
		spectrumStartHzOverride: body.data.spectrum_start_hz,
		spectrumEndHzOverride: body.data.spectrum_end_hz
	});
});

interface RenderSitrepOptions {
	db: Database.Database;
	missionId: string;
	mission: Mission;
	periodStart: number;
	periodEnd: number;
	narrative: string | undefined;
	spectrumImagePath: string | undefined;
	spectrumCaption: string | undefined;
	spectrumAnalysis: string | undefined;
	spectrumStartHzOverride?: number;
	spectrumEndHzOverride?: number;
}

async function renderSitrep(opts: RenderSitrepOptions): Promise<Response> {
	const { db, missionId, mission, periodStart, periodEnd } = opts;
	const tickCapture = pickLatestTick(db, missionId, periodStart, periodEnd);
	if (!tickCapture) {
		return json(
			{ success: false, error: 'No tick-role capture found in the requested period' },
			{ status: 400 }
		);
	}
	const emitters = getCaptureEmitters(db, tickCapture.id);
	const reportId = randomUUID();
	const reportDir = join(process.cwd(), 'data', 'reports', reportId);
	if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });
	const { spectrumImagePath, spectrumCaption, spectrumAnalysis } = await resolveSpectrumAssets(
		db,
		tickCapture.id,
		reportDir,
		opts
	);
	const qmdPath = writeQmdSource({
		reportId,
		mission,
		capture: tickCapture,
		emitters,
		periodStart,
		periodEnd,
		narrative: opts.narrative,
		spectrumImagePath,
		spectrumCaption,
		spectrumAnalysis
	});
	const report = await persistSitrepReport(
		db,
		missionId,
		mission,
		tickCapture.id,
		emitters,
		qmdPath,
		periodEnd
	);
	return json({ success: true, report });
}
