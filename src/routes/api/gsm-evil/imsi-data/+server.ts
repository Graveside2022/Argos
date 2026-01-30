import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { hostExec } from '$lib/server/hostExec';

export const GET: RequestHandler = async () => {
	try {
		// Find the IMSI database on the host
		const { stdout: dbFound } = await hostExec(
			'for p in /usr/src/gsmevil2/database/imsi.db /home/kali/gsmevil-user/database/imsi.db; do [ -f "$p" ] && echo "$p" && break; done'
		).catch(() => ({ stdout: '' }));

		const dbPath = dbFound.trim();
		if (!dbPath) {
			return json({
				success: false,
				message: 'IMSI database not found',
				data: []
			});
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
		const result = JSON.parse(stdout);

		if (result.error) {
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
