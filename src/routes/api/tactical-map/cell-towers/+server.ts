import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export const GET: RequestHandler = async ({ url }) => {
  try {
    // Get query parameters for bounding box
    const north = url.searchParams.get('north');
    const south = url.searchParams.get('south');
    const east = url.searchParams.get('east');
    const west = url.searchParams.get('west');
    
    // Query towers from local OpenCellID database
    const scriptContent = `#!/usr/bin/env python3
import sqlite3
import json

try:
    # Connect to the towers database
    conn = sqlite3.connect('/home/ubuntu/projects/Argos/data/celltowers/towers.db')
    cursor = conn.cursor()
    
    # Base query
    query = '''
        SELECT radio, mcc, net as mnc, area as lac, cell as ci, 
               lat, lon, range, samples, updated
        FROM towers 
        WHERE lat IS NOT NULL AND lon IS NOT NULL
    '''
    
    params = []
    
    # Add bounding box filter if provided
    if ${north} and ${south} and ${east} and ${west}:
        query += ' AND lat <= ? AND lat >= ? AND lon <= ? AND lon >= ?'
        params = [${north}, ${south}, ${east}, ${west}]
    
    # Limit results for performance
    query += ' ORDER BY samples DESC LIMIT 1000'
    
    if params:
        cursor.execute(query, params)
    else:
        cursor.execute(query)
    
    rows = cursor.fetchall()
    towers = []
    
    for row in rows:
        towers.append({
            "radio": row[0],
            "mcc": str(row[1]),
            "mnc": str(row[2]),
            "lac": str(row[3]),
            "ci": str(row[4]),
            "lat": row[5],
            "lon": row[6],
            "range": row[7],
            "samples": row[8],
            "updated": row[9]
        })
    
    conn.close()
    
    print(json.dumps({
        "success": True,
        "towers": towers,
        "count": len(towers)
    }))
    
except Exception as e:
    print(json.dumps({
        "success": False,
        "message": str(e),
        "towers": []
    }))
`;

    // Write script to temp file
    const tmpScript = '/tmp/fetch_towers.py';
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
    console.error('Cell tower fetch error:', error);
    return json({
      success: false,
      towers: [],
      message: 'Failed to fetch cell tower data',
      error: (error as Error).message
    });
  }
};