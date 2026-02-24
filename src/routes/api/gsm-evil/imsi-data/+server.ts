import { json } from '@sveltejs/kit';
import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { z } from 'zod';

import { getAllowedImsiDbPaths } from '$lib/server/gsm-database-path';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

// Zod schema for GSM Evil IMSI detailed data from better-sqlite3
const GsmEvilImsiDataSchema = z.array(
	z
		.object({
			id: z.number(),
			imsi: z.string(),
			tmsi: z.string(),
			mcc: z.string(),
			mnc: z.string(),
			lac: z.string(),
			ci: z.string(),
			datetime: z.string()
		})
		.passthrough()
);

interface ImsiRow {
	id: number;
	imsi: string | null;
	tmsi: string | null;
	mcc: string | number | null;
	mnc: string | number | null;
	lac: string | number | null;
	ci: string | number | null;
	date_time: string | null;
}

function toStringOrEmpty(value: string | number | null): string {
	if (value == null) return '';
	return String(value);
}

function transformImsiRow(row: ImsiRow) {
	return {
		id: row.id,
		imsi: row.imsi || '',
		tmsi: row.tmsi || '',
		mcc: toStringOrEmpty(row.mcc),
		mnc: toStringOrEmpty(row.mnc),
		lac: toStringOrEmpty(row.lac),
		ci: toStringOrEmpty(row.ci),
		datetime: row.date_time || ''
	};
}

function findValidatedImsiDatabase(): { path: string; error?: string } {
	const searchPaths = getAllowedImsiDbPaths();
	const dbPath = searchPaths.find((p) => existsSync(p)) || '';
	if (!dbPath) return { path: '', error: 'IMSI database not found' };
	const allowedPaths = getAllowedImsiDbPaths();
	if (!allowedPaths.includes(dbPath)) return { path: '', error: 'Invalid database path' };
	return { path: dbPath };
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function queryImsiData(dbPath: string) {
	const db = new Database(dbPath, { readonly: true });
	try {
		const rows = db
			.prepare(
				'SELECT id, imsi, tmsi, mcc, mnc, lac, ci, date_time FROM imsi_data ORDER BY id DESC LIMIT 1000'
			)
			.all() as ImsiRow[];
		return { success: true as const, data: rows.map(transformImsiRow) };
	} catch (dbError) {
		return {
			success: false as const,
			message: 'Failed to read database',
			error: formatError(dbError)
		};
	} finally {
		db.close();
	}
}

export const GET: RequestHandler = async () => {
	try {
		const dbLookup = findValidatedImsiDatabase();
		if (!dbLookup.path) {
			return json({ success: false, message: dbLookup.error, data: [] });
		}

		const queryResult = queryImsiData(dbLookup.path);
		if (!queryResult.success) {
			return json({
				success: false,
				message: queryResult.message,
				error: queryResult.error,
				data: []
			});
		}

		const parseResult = GsmEvilImsiDataSchema.safeParse(queryResult.data);
		if (!parseResult.success) {
			return json(
				{ success: false, message: 'Failed to parse IMSI data from database', data: [] },
				{ status: 500 }
			);
		}

		return json({
			success: true,
			count: parseResult.data.length,
			data: parseResult.data
		});
	} catch (error) {
		logger.error('Failed to fetch IMSI data', { error: formatError(error) });
		return json({
			success: false,
			message: 'Failed to fetch IMSI data',
			error: formatError(error),
			data: []
		});
	}
};
