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
    # Connect to IMSI database
    imsi_conn = sqlite3.connect('/usr/src/gsmevil2/database/imsi.db')
    
    # Try to connect to towers database (optional)
    towers_conn = None
    try:
        towers_conn = sqlite3.connect('/home/ubuntu/projects/Argos/data/celltowers/towers.db')
    except:
        pass  # Towers database is optional
    
    imsi_cursor = imsi_conn.cursor()
    towers_cursor = towers_conn.cursor() if towers_conn else None
    
    # Get total count
    imsi_cursor.execute('SELECT COUNT(*) FROM imsi_data')
    total = imsi_cursor.fetchone()[0]
    
    # Get all IMSIs
    imsi_cursor.execute('''
        SELECT id, imsi, tmsi, mcc, mnc, lac, ci, date_time 
        FROM imsi_data 
        ORDER BY id DESC
    ''')
    
    rows = imsi_cursor.fetchall()
    imsis = []
    
    for row in rows:
        imsi_entry = {
            "id": row[0],
            "imsi": row[1],
            "tmsi": row[2] or "N/A",
            "mcc": row[3],
            "mnc": row[4],
            "lac": row[5],
            "ci": row[6],
            "timestamp": row[7],
            "lat": None,
            "lon": None
        }
        
        # Try to get location from towers database if available
        if towers_cursor and row[3] and row[4] and row[5] and row[6]:  # If we have MCC, MNC, LAC, CI
            towers_cursor.execute('''
                SELECT lat, lon 
                FROM towers 
                WHERE mcc = ? AND net = ? AND area = ? AND cell = ?
                LIMIT 1
            ''', (row[3], row[4], row[5], row[6]))
            
            location = towers_cursor.fetchone()
            if location:
                imsi_entry["lat"] = location[0]
                imsi_entry["lon"] = location[1]
        
        imsis.append(imsi_entry)
    
    imsi_conn.close()
    if towers_conn:
        towers_conn.close()
    
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