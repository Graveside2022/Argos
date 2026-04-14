/**
 * GET /api/reports/list?type=sitrep|emcon-survey&limit=N
 *
 * Lists persisted reports, newest first.
 */

import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { getRFDatabase } from '$lib/server/db/database';
import { listReports } from '$lib/server/services/reports/mission-store';
import type { ReportType } from '$lib/server/services/reports/types';

const ALLOWED_TYPES: ReportType[] = ['sitrep', 'emcon-survey'];

type ParsedQuery = { ok: true; type?: ReportType; limit?: number } | { ok: false; error: string };

function parseType(raw: string | null): { ok: true; value?: ReportType } | { ok: false } {
	if (raw === null) return { ok: true };
	if (!ALLOWED_TYPES.includes(raw as ReportType)) return { ok: false };
	return { ok: true, value: raw as ReportType };
}

function parseLimit(raw: string | null): { ok: true; value?: number } | { ok: false } {
	if (raw === null) return { ok: true };
	const n = Number(raw);
	if (!Number.isFinite(n) || n <= 0) return { ok: false };
	return { ok: true, value: Math.floor(n) };
}

function parseQuery(url: URL): ParsedQuery {
	const t = parseType(url.searchParams.get('type'));
	if (!t.ok) return { ok: false, error: 'Invalid type' };
	const l = parseLimit(url.searchParams.get('limit'));
	if (!l.ok) return { ok: false, error: 'Invalid limit' };
	return { ok: true, type: t.value, limit: l.value };
}

export const GET = createHandler(({ url }) => {
	const parsed = parseQuery(url);
	if (!parsed.ok) {
		return json({ success: false, error: parsed.error }, { status: 400 });
	}

	const db = getRFDatabase().rawDb;
	const reports = listReports(db, { type: parsed.type, limit: parsed.limit });
	return { success: true, reports };
});
