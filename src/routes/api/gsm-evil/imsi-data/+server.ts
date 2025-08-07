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
				imsis: []
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
    cursor.execute('SELECT * FROM imsi_data ORDER BY id DESC LIMIT 1000')
    rows = cursor.fetchall()
    
    conn.close()
    
    # Convert to JSON
    print(json.dumps(rows))
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
				imsis: []
			});
		}

		return json({
			success: true,
			count: result.length,
			imsis: result
		});
	} catch (error) {
		console.error('Failed to fetch IMSI data:', error);
		return json({
			success: false,
			message: 'Failed to fetch IMSI data',
			error: error instanceof Error ? error.message : String(error),
			imsis: []
		});
	}
};
