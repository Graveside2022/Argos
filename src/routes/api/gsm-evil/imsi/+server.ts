import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { hostExec } from '$lib/server/host-exec';
import { safeJsonParse } from '$lib/server/security/safe-json';
import { z } from 'zod';

// Zod schema for GSM Evil IMSI query result from Python subprocess
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

export const GET: RequestHandler = async () => {
	try {
		// Find the IMSI database on the host filesystem
		const { stdout: dbFound } = await hostExec(
			'for p in /usr/src/gsmevil2/database/imsi.db /home/kali/gsmevil-user/database/imsi.db; do [ -f "$p" ] && echo "$p" && break; done'
		).catch((error: unknown) => {
			console.error('[gsm-evil-imsi] Database path search failed', { error: String(error) });
			return { stdout: '' };
		});

		const dbPath = dbFound.trim();
		if (!dbPath) {
			return json({
				success: false,
				imsis: [],
				total: 0,
				message: 'IMSI database not found in any known location'
			});
		}

		// Validate dbPath against known allowlist to prevent shell injection
		const ALLOWED_IMSI_DB_PATHS = [
			'/usr/src/gsmevil2/database/imsi.db',
			'/home/kali/gsmevil-user/database/imsi.db'
		] as const;
		if (!ALLOWED_IMSI_DB_PATHS.includes(dbPath as any)) {
			return json({ success: false, message: 'Invalid database path', imsis: [], total: 0 });
		}

		// Run the python query on the host where the DB lives
		const pythonScript = `
import sqlite3, json
try:
    conn = sqlite3.connect('${dbPath}')
    c = conn.cursor()
    c.execute('SELECT COUNT(*) FROM imsi_data')
    total = c.fetchone()[0]
    c.execute('SELECT id, imsi, tmsi, mcc, mnc, lac, ci, date_time FROM imsi_data ORDER BY id DESC')
    rows = c.fetchall()
    imsis = [{"id":r[0],"imsi":r[1],"tmsi":r[2] or "N/A","mcc":r[3],"mnc":r[4],"lac":r[5],"ci":r[6],"timestamp":r[7],"lat":None,"lon":None} for r in rows]
    conn.close()
    print(json.dumps({"success":True,"total":total,"imsis":imsis,"message":f"Found {total} IMSIs"}))
except Exception as e:
    print(json.dumps({"success":False,"message":str(e),"imsis":[],"total":0}))
`;

		const { stdout, stderr } = await hostExec(
			`python3 -c '${pythonScript.replace(/'/g, "'\\''")}'`
		);

		console.log('[gsm-evil-imsi] Python stdout length:', stdout.length);
		console.log('[gsm-evil-imsi] Python stderr:', stderr);
		if (stdout.length < 100) {
			console.log('[gsm-evil-imsi] Full stdout:', stdout);
		}

		// Parse and return the result
		const result = safeJsonParse(stdout, GsmEvilImsiResultSchema, 'gsm-evil-imsi');
		if (!result.success) {
			console.error('[gsm-evil-imsi] Parse failed. Raw stdout:', stdout.substring(0, 500));
			return json(
				{
					success: false,
					imsis: [],
					total: 0,
					message: 'Failed to parse IMSI data from subprocess',
					debug: { stdout: stdout.substring(0, 200), stderr }
				},
				{ status: 500 }
			);
		}
		return json(result.data);
	} catch (error: unknown) {
		console.error('IMSI fetch error:', error);
		return json({
			success: false,
			imsis: [],
			total: 0,
			message: 'Failed to fetch IMSI data',
			error: (error as Error).message
		});
	}
};
