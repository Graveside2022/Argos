import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { hostExec } from '$lib/server/host-exec';
import { safeJsonParse } from '$lib/server/security/safe-json';

import type { RequestHandler } from './$types';

// Zod schema for GSM Evil IMSI detailed data from Python subprocess
const GsmEvilImsiDataSchema = z.union([
	z.array(
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
	),
	z
		.object({
			error: z.string()
		})
		.passthrough()
]);

export const GET: RequestHandler = async () => {
	try {
		// Find the IMSI database on the host
		const { stdout: dbFound } = await hostExec(
			'for p in /usr/src/gsmevil2/database/imsi.db /home/kali/gsmevil-user/database/imsi.db; do [ -f "$p" ] && echo "$p" && break; done'
		).catch((error: unknown) => {
			console.error('[gsm-evil-imsi-data] Database path search failed', {
				error: String(error)
			});
			return { stdout: '' };
		});

		const dbPath = dbFound.trim();
		if (!dbPath) {
			return json({
				success: false,
				message: 'IMSI database not found',
				data: []
			});
		}

		// Validate dbPath against known allowlist to prevent shell injection
		const ALLOWED_IMSI_DB_PATHS = [
			'/usr/src/gsmevil2/database/imsi.db',
			'/home/kali/gsmevil-user/database/imsi.db'
			// Safe: Array literal narrowed to const readonly tuple for strict allowlist matching
		] as const;

		// Safe: dbPath cast to any for includes() check against readonly const array (TypeScript limitation)
		if (!ALLOWED_IMSI_DB_PATHS.includes(dbPath as any)) {
			return json({ success: false, message: 'Invalid database path', data: [] });
		}

		// Run python on the host where the DB lives
		const pythonScript = `
import sqlite3, json
try:
    conn = sqlite3.connect('${dbPath}')
    cursor = conn.cursor()
    cursor.execute('SELECT id, imsi, tmsi, mcc, mnc, lac, ci, date_time FROM imsi_data ORDER BY id DESC LIMIT 1000')
    rows = cursor.fetchall()
    conn.close()
    data = [{'id':r[0],'imsi':r[1] or '','tmsi':r[2] or '','mcc':str(r[3]) if r[3] else '','mnc':str(r[4]) if r[4] else '','lac':str(r[5]) if r[5] else '','ci':str(r[6]) if r[6] else '','datetime':r[7] or ''} for r in rows]
    print(json.dumps(data))
except Exception as e:
    print(json.dumps({'error': str(e)}))
`;

		const { stdout } = await hostExec(`python3 -c '${pythonScript.replace(/'/g, "'\\''")}'`);

		const parseResult = safeJsonParse(stdout, GsmEvilImsiDataSchema, 'gsm-evil-imsi-data');
		if (!parseResult.success) {
			return json(
				{
					success: false,
					message: 'Failed to parse IMSI data from subprocess',
					data: []
				},
				{ status: 500 }
			);
		}

		const result = parseResult.data;
		if (typeof result === 'object' && 'error' in result && result.error) {
			return json({
				success: false,
				message: 'Failed to read database',
				error: result.error,
				data: []
			});
		}

		return json({
			success: true,
			count: result.length,
			data: result // Changed from 'imsis' to 'data' to match what IMSIDisplay expects
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
