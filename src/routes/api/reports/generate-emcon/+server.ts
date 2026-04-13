/**
 * POST /api/reports/generate-emcon
 *
 * Generates an EMCON survey report. Requires both a baseline and a posture
 * capture on the resolved mission. Diffs the two via `diffCaptures`, then
 * renders the Quarto source produced by the emcon template builder.
 */

import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { json } from '@sveltejs/kit';
import type Database from 'better-sqlite3';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { getRFDatabase } from '$lib/server/db/database';
import { diffCaptures } from '$lib/server/services/reports/emcon-diff';
import { buildEmconQmd } from '$lib/server/services/reports/emcon-template';
import {
	createReport,
	getActiveMission,
	getBaselineAndPosture,
	getCaptureEmitters,
	getMission
} from '$lib/server/services/reports/mission-store';
import { renderQuartoDoc } from '$lib/server/services/reports/quarto-runner';
import type {
	Capture,
	CaptureEmitterRow,
	CaptureRow,
	DiffResult,
	EmitterRow,
	EmitterSignalType,
	Mission,
	ReportRow
} from '$lib/server/services/reports/types';

const GenerateEmconSchema = z.object({
	mission_id: z.string().min(1).optional(),
	narrative: z.string().max(10_000).optional()
});

type EmconBody = z.infer<typeof GenerateEmconSchema>;

const VALID_SIGNAL_TYPES: EmitterSignalType[] = [
	'wifi-ap',
	'wifi-client',
	'gsm',
	'bluetooth',
	'rf'
];

function normalizeSignalType(raw: string): EmitterSignalType {
	return (VALID_SIGNAL_TYPES as string[]).includes(raw) ? (raw as EmitterSignalType) : 'rf';
}

function parseRawJson(raw: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(raw) as unknown;
		return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

function captureEmitterToEmitterRow(row: CaptureEmitterRow): EmitterRow {
	const extra = parseRawJson(row.raw_json);
	const bssid = typeof extra.bssid === 'string' ? extra.bssid : null;
	const ssid = typeof extra.ssid === 'string' ? extra.ssid : null;
	return {
		fingerprint_key: row.fingerprint_key,
		signal_type: normalizeSignalType(row.signal_type),
		identifier: row.identifier,
		freq_hz: row.freq_hz,
		power_dbm: row.power_dbm,
		modulation: row.modulation,
		mgrs: row.mgrs,
		classification: row.classification,
		source_table: row.source_table,
		source_id: row.source_id,
		bssid,
		ssid,
		sensor_tool: row.sensor_tool ?? undefined
	};
}

function hydrateCapture(row: CaptureRow, emitters: CaptureEmitterRow[]): Capture {
	return {
		id: row.id,
		loadout: row.loadout,
		emitters: emitters.map(captureEmitterToEmitterRow)
	};
}

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

async function parseEmconBody(
	request: Request
): Promise<{ ok: true; data: EmconBody } | { ok: false; error: string; details?: unknown }> {
	const raw = await request.json().catch(() => ({}));
	const parsed = GenerateEmconSchema.safeParse(raw);
	if (!parsed.success) {
		return { ok: false, error: 'Invalid body', details: parsed.error.issues };
	}
	return { ok: true, data: parsed.data };
}

type EmconBundle = {
	baseline: CaptureRow;
	posture: CaptureRow;
	baselineEmitters: CaptureEmitterRow[];
	postureEmitters: CaptureEmitterRow[];
	diff: DiffResult;
};

function buildEmconBundle(db: Database.Database, missionId: string): EmconBundle | null {
	const { baseline, posture } = getBaselineAndPosture(db, missionId);
	if (!baseline || !posture) return null;
	const baselineEmitters = getCaptureEmitters(db, baseline.id);
	const postureEmitters = getCaptureEmitters(db, posture.id);
	const diff = diffCaptures(
		hydrateCapture(baseline, baselineEmitters),
		hydrateCapture(posture, postureEmitters)
	);
	return { baseline, posture, baselineEmitters, postureEmitters, diff };
}

function writeEmconQmd(
	reportId: string,
	mission: Mission,
	bundle: EmconBundle,
	narrative: string | undefined
): string {
	const reportDir = join(process.cwd(), 'data', 'reports', reportId);
	if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });
	const qmdPath = join(reportDir, 'source.qmd');
	const serial = reportId.slice(0, 8).toUpperCase();
	const qmd = buildEmconQmd({
		mission,
		baseline: bundle.baseline,
		posture: bundle.posture,
		baselineEmitters: bundle.baselineEmitters,
		postureEmitters: bundle.postureEmitters,
		diff: bundle.diff,
		narrative,
		serial
	});
	writeFileSync(qmdPath, qmd, 'utf-8');
	return qmdPath;
}

function summarizeDiff(diff: DiffResult): {
	flagged_hostile: number;
	flagged_suspect: number;
	emitter_count: number;
} {
	return {
		flagged_hostile: diff.critical.length,
		flagged_suspect: diff.notable.length + diff.new.length,
		emitter_count:
			diff.new.length +
			diff.missing.length +
			diff.unchanged.length +
			diff.notable.length +
			diff.critical.length
	};
}

async function persistEmconReport(
	db: Database.Database,
	missionId: string,
	mission: Mission,
	bundle: EmconBundle,
	qmdPath: string
): Promise<ReportRow> {
	const render = await renderQuartoDoc(qmdPath);
	const summary = summarizeDiff(bundle.diff);
	const title = `EMCON Survey — ${mission.name} — ${new Date().toISOString()}`;
	return createReport(db, {
		mission_id: missionId,
		type: 'emcon-survey',
		title,
		capture_ids: [bundle.baseline.id, bundle.posture.id],
		...summary,
		source_qmd_path: qmdPath,
		html_path: render.htmlPath,
		pdf_path: render.pdfPath,
		slides_html_path: render.slidesHtmlPath,
		slides_pdf_path: render.slidesPdfPath
	});
}

export const POST = createHandler(async ({ request }) => {
	const body = await parseEmconBody(request);
	if (!body.ok) {
		return json({ success: false, error: body.error, details: body.details }, { status: 400 });
	}

	const db = getRFDatabase().rawDb;
	const resolved = resolveMission(db, body.data.mission_id);
	if (!resolved.ok) {
		return json({ success: false, error: resolved.error }, { status: resolved.status });
	}
	const { missionId, mission } = resolved;

	const bundle = buildEmconBundle(db, missionId);
	if (!bundle) {
		return json(
			{ success: false, error: 'Mission must have both a baseline and a posture capture' },
			{ status: 400 }
		);
	}

	const reportId = randomUUID();
	const qmdPath = writeEmconQmd(reportId, mission, bundle, body.data.narrative);
	const report = await persistEmconReport(db, missionId, mission, bundle, qmdPath);

	return { success: true, report };
});
