import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { hostExec } from '$lib/server/host-exec';

export const GET: RequestHandler = async () => {
	try {
		// Find the IMSI database on the host filesystem
		const { stdout: dbFound } = await hostExec(
			'for p in /usr/src/gsmevil2/database/imsi.db /home/kali/gsmevil-user/database/imsi.db; do [ -f "$p" ] && echo "$p" && break; done'
		).catch(() => ({ stdout: '' }));

		const dbPath = dbFound.trim();
		if (!dbPath) {
			return json({
				success: false,
				imsis: [],
				total: 0,
				message: 'IMSI database not found in any known location'
			});
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

		const { stdout } = await hostExec(`python3 -c '${pythonScript.replace(/'/g, "'\\''")}'`);

		// Parse and return the result
		const result = JSON.parse(stdout);
		return json(result);
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
