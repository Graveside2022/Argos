import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

export const GET: RequestHandler = async () => {
	try {
		// Path to GSM Evil IMSI database
		const dbPath = '/home/ubuntu/gsmevil-user/database/imsi.db';

		// Check if database exists
		try {
			await fs.access(dbPath);
		} catch {
			return json({
				success: false,
				message: 'IMSI database not found',
				data: []
			});
		}

		// Query the database using Python (since sqlite3 might not be installed)
		const pythonScript = `
import sqlite3
import json

try:
    conn = sqlite3.connect('${dbPath}')
    cursor = conn.cursor()
    
    # Get all IMSI data, ordered by ID descending (newest first)
    cursor.execute('SELECT id, imsi, tmsi, mcc, mnc, lac, ci, date_time FROM imsi_data ORDER BY id DESC LIMIT 1000')
    rows = cursor.fetchall()
    
    conn.close()
    
    # Convert rows to objects with proper field names
    data = []
    for row in rows:
        data.append({
            'id': row[0],
            'imsi': row[1] if row[1] else '',
            'tmsi': row[2] if row[2] else '',
            'mcc': str(row[3]) if row[3] else '',
            'mnc': str(row[4]) if row[4] else '',
            'lac': str(row[5]) if row[5] else '',
            'ci': str(row[6]) if row[6] else '',
            'datetime': row[7] if row[7] else ''
        })
    
    # Convert to JSON
    print(json.dumps(data))
except Exception as e:
    print(json.dumps({'error': str(e)}))
`;

		const { stdout } = await execAsync(`python3 -c "${pythonScript}"`);
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
