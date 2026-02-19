import { json } from '@sveltejs/kit';
import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { z } from 'zod';

import { getAllowedImsiDbPaths, getGsmEvilDir } from '$lib/server/gsm-database-path';

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

export const GET: RequestHandler = async () => {
	try {
		// Find the IMSI database using fs.existsSync instead of shell
		const gsmDir = getGsmEvilDir();
		const searchPaths = [`${gsmDir}/database/imsi.db`, '/tmp/gsm_db.sqlite'];
		const dbPath = searchPaths.find((p) => existsSync(p)) || '';

		if (!dbPath) {
			return json({
				success: false,
				message: 'IMSI database not found',
				data: []
			});
		}

		// Validate dbPath against known allowlist to prevent path traversal
		const allowedPaths = getAllowedImsiDbPaths();
		if (!allowedPaths.includes(dbPath)) {
			return json({ success: false, message: 'Invalid database path', data: [] });
		}

		// Query IMSI data directly with better-sqlite3 instead of Python subprocess
		let data;
		try {
			const db = new Database(dbPath, { readonly: true });
			const rows = db
				.prepare(
					'SELECT id, imsi, tmsi, mcc, mnc, lac, ci, date_time FROM imsi_data ORDER BY id DESC LIMIT 1000'
				)
				.all() as ImsiRow[];
			db.close();

			data = rows.map((row) => ({
				id: row.id,
				imsi: row.imsi || '',
				tmsi: row.tmsi || '',
				mcc: String(row.mcc) || '',
				mnc: String(row.mnc) || '',
				lac: String(row.lac) || '',
				ci: String(row.ci) || '',
				datetime: row.date_time || ''
			}));
		} catch (dbError) {
			return json({
				success: false,
				message: 'Failed to read database',
				error: dbError instanceof Error ? dbError.message : String(dbError),
				data: []
			});
		}

		const parseResult = GsmEvilImsiDataSchema.safeParse(data);
		if (!parseResult.success) {
			return json(
				{
					success: false,
					message: 'Failed to parse IMSI data from database',
					data: []
				},
				{ status: 500 }
			);
		}

		return json({
			success: true,
			count: parseResult.data.length,
			data: parseResult.data
		});
	} catch (error) {
		console.error('Failed to fetch IMSI data:', error);
		return json({
			success: false,
			message: 'Failed to fetch IMSI data',
			error: error instanceof Error ? error.message : String(error),
			data: []
		});
	}
};
