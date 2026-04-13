/**
 * Mission / capture / report repository.
 *
 * Module of pure functions following the `network-repository` pattern:
 * every function takes the `db` handle as its first argument. Prepared
 * statements are cached per Database instance (see ./mission-store-internals)
 * so the same statements are reused across calls without leaking between DBs.
 */

import type Database from 'better-sqlite3';

import { type CaptureLoadout, hashLoadout } from './loadout-hash';
import {
	captureEmitterRowFromDb,
	captureRowToCapture,
	missionRowToMission,
	reportRowToReport,
	slugify,
	stmts
} from './mission-store-internals';
import type {
	CaptureEmitterRow,
	CaptureRole,
	CaptureRow,
	Mission,
	MissionType,
	ReportInput,
	ReportRow,
	ReportType
} from './types';

export function createMission(
	db: Database.Database,
	input: { name: string; type: MissionType; unit?: string | null; ao_mgrs?: string | null }
): Mission {
	const created_at = Date.now();
	const id = `m_${created_at}_${slugify(input.name) || 'mission'}`;
	stmts(db).insertMission.run({
		id,
		name: input.name,
		type: input.type,
		unit: input.unit ?? null,
		ao_mgrs: input.ao_mgrs ?? null,
		created_at,
		active: 0
	});
	const mission = getMission(db, id);
	if (!mission) throw new Error(`mission ${id} missing after insert`);
	return mission;
}

export function getMission(db: Database.Database, id: string): Mission | null {
	const row = stmts(db).getMission.get(id) as Record<string, unknown> | undefined;
	return row ? missionRowToMission(row) : null;
}

export function listMissions(db: Database.Database): Mission[] {
	const rows = stmts(db).listMissions.all() as Record<string, unknown>[];
	return rows.map(missionRowToMission);
}

export function deleteMission(db: Database.Database, id: string): void {
	stmts(db).deleteMission.run(id);
}

export function setActiveMission(db: Database.Database, id: string): void {
	const s = stmts(db);
	const tx = db.transaction((mid: string) => {
		s.clearActive.run();
		s.setActive.run(mid);
	});
	tx(id);
}

export function getActiveMission(db: Database.Database): Mission | null {
	const row = stmts(db).getActive.get() as Record<string, unknown> | undefined;
	return row ? missionRowToMission(row) : null;
}

export function createCapture(
	db: Database.Database,
	input: { mission_id: string; role: CaptureRole; loadout: CaptureLoadout }
): CaptureRow {
	const start_dtg = Date.now();
	const id = `c_${start_dtg}`;
	stmts(db).insertCapture.run({
		id,
		mission_id: input.mission_id,
		role: input.role,
		start_dtg,
		end_dtg: null,
		loadout_hash: hashLoadout(input.loadout),
		loadout_json: JSON.stringify(input.loadout),
		status: 'running'
	});
	const cap = getCapture(db, id);
	if (!cap) throw new Error(`capture ${id} missing after insert`);
	return cap;
}

export function stopCapture(db: Database.Database, capture_id: string, end_dtg: number): void {
	stmts(db).stopCapture.run(end_dtg, capture_id);
}

export function getCapture(db: Database.Database, id: string): CaptureRow | null {
	const row = stmts(db).getCapture.get(id) as Record<string, unknown> | undefined;
	return row ? captureRowToCapture(row) : null;
}

export function listCapturesForMission(db: Database.Database, mission_id: string): CaptureRow[] {
	const rows = stmts(db).listCapturesForMission.all(mission_id) as Record<string, unknown>[];
	return rows.map(captureRowToCapture);
}

export function getBaselineAndPosture(
	db: Database.Database,
	mission_id: string
): { baseline: CaptureRow | null; posture: CaptureRow | null } {
	const s = stmts(db);
	const b = s.getBaseline.get(mission_id) as Record<string, unknown> | undefined;
	const p = s.getPosture.get(mission_id) as Record<string, unknown> | undefined;
	return {
		baseline: b ? captureRowToCapture(b) : null,
		posture: p ? captureRowToCapture(p) : null
	};
}

function nn<T>(v: T | undefined | null): T | null {
	return v == null ? null : v;
}

function captureEmitterInsertParams(
	capture_id: string,
	r: CaptureEmitterRow
): Record<string, unknown> {
	return {
		capture_id,
		source_table: r.source_table,
		source_id: r.source_id,
		signal_type: r.signal_type,
		identifier: nn(r.identifier),
		fingerprint_key: r.fingerprint_key,
		freq_hz: nn(r.freq_hz),
		power_dbm: nn(r.power_dbm),
		modulation: nn(r.modulation),
		mgrs: nn(r.mgrs),
		classification: nn(r.classification),
		sensor_tool: nn(r.sensor_tool),
		raw_json: r.raw_json
	};
}

export function snapshotCaptureEmitters(
	db: Database.Database,
	capture_id: string,
	rows: CaptureEmitterRow[]
): void {
	const insert = stmts(db).insertCaptureEmitter;
	const tx = db.transaction((batch: CaptureEmitterRow[]) => {
		for (const r of batch) {
			insert.run(captureEmitterInsertParams(capture_id, r));
		}
	});
	tx(rows);
}

export function getCaptureEmitters(db: Database.Database, capture_id: string): CaptureEmitterRow[] {
	const rows = stmts(db).getCaptureEmitters.all(capture_id) as Record<string, unknown>[];
	return rows.map(captureEmitterRowFromDb);
}

function zz(v: number | undefined): number {
	return v ?? 0;
}

function reportInsertParams(
	id: string,
	generated_at: number,
	input: ReportInput
): Record<string, unknown> {
	return {
		id,
		mission_id: input.mission_id,
		type: input.type,
		title: input.title,
		generated_at,
		capture_ids: JSON.stringify(input.capture_ids),
		flagged_hostile: zz(input.flagged_hostile),
		flagged_suspect: zz(input.flagged_suspect),
		emitter_count: zz(input.emitter_count),
		source_qmd_path: input.source_qmd_path,
		html_path: input.html_path,
		pdf_path: nn(input.pdf_path),
		slides_html_path: nn(input.slides_html_path),
		slides_pdf_path: nn(input.slides_pdf_path)
	};
}

export function createReport(db: Database.Database, input: ReportInput): ReportRow {
	const generated_at = Date.now();
	const id = `r_${generated_at}_${slugify(input.title) || 'report'}`;
	stmts(db).insertReport.run(reportInsertParams(id, generated_at, input));
	const report = getReport(db, id);
	if (!report) throw new Error(`report ${id} missing after insert`);
	return report;
}

export function listReports(
	db: Database.Database,
	opts?: { type?: ReportType; limit?: number }
): ReportRow[] {
	const limit = opts?.limit ?? 100;
	const s = stmts(db);
	const rows = opts?.type
		? (s.listReportsByType.all(opts.type, limit) as Record<string, unknown>[])
		: (s.listReports.all(limit) as Record<string, unknown>[]);
	return rows.map(reportRowToReport);
}

export function getReport(db: Database.Database, id: string): ReportRow | null {
	const row = stmts(db).getReport.get(id) as Record<string, unknown> | undefined;
	return row ? reportRowToReport(row) : null;
}

export function deleteReport(db: Database.Database, id: string): void {
	stmts(db).deleteReport.run(id);
}
