import { json } from '@sveltejs/kit';
import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { z } from 'zod';

import { getAllowedImsiDbPaths, getGsmEvilDir } from '$lib/server/gsm-database-path';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

// Zod schema for GSM Evil IMSI query result
const GsmEvilImsiResultSchema = z
	.object({
		success: z.boolean(),
		total: z.number(),
		imsis: z.array(
			z.object({
				id: z.number(),
				imsi: z.string(),
				tmsi: z.string(),
				mcc: z
					.union([z.number(), z.string()])
					.transform((val) => (typeof val === 'string' ? parseInt(val) || 0 : val)),
				mnc: z
					.union([z.number(), z.string()])
					.transform((val) => (typeof val === 'string' ? parseInt(val) || 0 : val)),
				lac: z
					.union([z.number(), z.string()])
					.transform((val) =>
						typeof val === 'string' && val !== ''
							? parseInt(val)
							: typeof val === 'number'
								? val
								: 0
					),
				ci: z
					.union([z.number(), z.string()])
					.transform((val) =>
						typeof val === 'string' && val !== ''
							? parseInt(val)
							: typeof val === 'number'
								? val
								: 0
					),
				timestamp: z.string(),
				lat: z.union([z.number(), z.null()]),
				lon: z.union([z.number(), z.null()])
			})
		),
		message: z.string().optional()
	})
	.passthrough();

interface ImsiRow {
	id: number;
	imsi: string;
	tmsi: string | null;
	mcc: number | string;
	mnc: number | string;
	lac: number | string;
	ci: number | string;
	date_time: string;
}

export const GET: RequestHandler = async () => {
	try {
		// Find the IMSI database on the host filesystem
		const gsmDir = getGsmEvilDir();
		const searchPaths = [`${gsmDir}/database/imsi.db`, '/tmp/gsm_db.sqlite'];
		const dbPath = searchPaths.find((p) => existsSync(p)) || '';

		if (!dbPath) {
			return json({
				success: false,
				imsis: [],
				total: 0,
				message: 'IMSI database not found in any known location'
			});
		}

		// Validate dbPath against known allowlist to prevent path traversal
		const allowedPaths = getAllowedImsiDbPaths();
		if (!allowedPaths.includes(dbPath)) {
			return json({ success: false, message: 'Invalid database path', imsis: [], total: 0 });
		}

		// Query the IMSI database directly with better-sqlite3
		const db = new Database(dbPath, { readonly: true });
		try {
			const total = (
				db.prepare('SELECT COUNT(*) as count FROM imsi_data').get() as { count: number }
			).count;
			const rows = db
				.prepare(
					'SELECT id, imsi, tmsi, mcc, mnc, lac, ci, date_time FROM imsi_data ORDER BY id DESC'
				)
				.all() as ImsiRow[];

			const imsis = rows.map((row) => ({
				id: row.id,
				imsi: row.imsi,
				tmsi: row.tmsi || 'N/A',
				mcc: row.mcc,
				mnc: row.mnc,
				lac: row.lac,
				ci: row.ci,
				timestamp: row.date_time,
				lat: null,
				lon: null
			}));

			const rawResult = {
				success: true,
				total,
				imsis,
				message: `Found ${total} IMSIs`
			};

			// Validate with Zod schema
			const parsed = GsmEvilImsiResultSchema.safeParse(rawResult);
			if (!parsed.success) {
				logger.error('[gsm-evil-imsi] Schema validation failed', {
					error: parsed.error.message
				});
				return json(
					{
						success: false,
						imsis: [],
						total: 0,
						message: 'IMSI data failed schema validation'
					},
					{ status: 500 }
				);
			}

			return json(parsed.data);
		} finally {
			db.close();
		}
	} catch (error: unknown) {
		logger.error('IMSI fetch error', { error: (error as Error).message });
		return json({
			success: false,
			imsis: [],
			total: 0,
			message: 'Failed to fetch IMSI data',
			// Safe: Catch block error cast to Error for message extraction
			error: (error as Error).message
		});
	}
};
