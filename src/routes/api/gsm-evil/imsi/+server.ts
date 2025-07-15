import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export const GET: RequestHandler = async () => {
  try {
    // First check if database exists
    const dbPath = '/usr/src/gsmevil2/database/imsi.db';
    try {
      await fs.access(dbPath);
    } catch {
      return json({
        success: false,
        imsis: [],
        total: 0,
        message: 'IMSI database not found'
      });
    }

    // Create a Python script file temporarily
    const scriptContent = `#!/usr/bin/env python3
import sqlite3
import json

try:
    conn = sqlite3.connect('/usr/src/gsmevil2/database/imsi.db')
    cursor = conn.cursor()
    
    # Get total count
    cursor.execute('SELECT COUNT(*) FROM imsi_data')
    total = cursor.fetchone()[0]
    
    # Get latest 10 IMSIs
    cursor.execute('''
        SELECT id, imsi, tmsi, mcc, mnc, lac, ci, date_time 
        FROM imsi_data 
        ORDER BY id DESC 
        LIMIT 10
    ''')
    
    rows = cursor.fetchall()
    imsis = []
    
    for row in rows:
        imsis.append({
            "id": row[0],
            "imsi": row[1],
            "tmsi": row[2] or "N/A",
            "mcc": row[3],
            "mnc": row[4],
            "lac": row[5],
            "ci": row[6],
            "timestamp": row[7]
        })
    
    conn.close()
    
    print(json.dumps({
        "success": True,
        "total": total,
        "imsis": imsis,
        "message": f"Found {total} IMSIs"
    }))
    
except Exception as e:
    print(json.dumps({
        "success": False,
        "message": str(e),
        "imsis": [],
        "total": 0
    }))
`;

    // Write script to temp file
    const tmpScript = '/tmp/fetch_imsis.py';
    await fs.writeFile(tmpScript, scriptContent);
    await fs.chmod(tmpScript, '755');

    // Execute the script
    const { stdout } = await execAsync(`python3 ${tmpScript}`);
    
    // Clean up
    await fs.unlink(tmpScript).catch(() => {});
    
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