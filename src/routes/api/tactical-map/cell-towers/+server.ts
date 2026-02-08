import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { validateNumericParam, InputValidationError } from '$lib/server/security/input-sanitizer';
import { safeJsonParse } from '$lib/server/security/safe-json';
import { z } from 'zod';

const execFileAsync = promisify(execFile);

// Zod schema for cell tower query results from Python subprocess
const CellTowerResultSchema = z
	.object({
		towers: z.array(
			z.object({
				radio: z.string(),
				mcc: z.number(),
				mnc: z.number(),
				lac: z.number(),
				ci: z.number(),
				lat: z.number(),
				lon: z.number(),
				range: z.number().optional(),
				samples: z.number().optional(),
				updated: z.number().optional()
			})
		),
		count: z.number()
	})
	.passthrough();

export const GET: RequestHandler = async ({ url }) => {
	try {
		// Validate bounding box parameters — all must be finite numbers in geographic range
		const north = url.searchParams.get('north');
		const south = url.searchParams.get('south');
		const east = url.searchParams.get('east');
		const west = url.searchParams.get('west');

		// Build CLI args for the Python script
		const args = [
			'-c',
			`
import sqlite3
import json
import sys

try:
    conn = sqlite3.connect('/home/ubuntu/projects/Argos/data/celltowers/towers.db')
    cursor = conn.cursor()

    query = '''
        SELECT radio, mcc, net as mnc, area as lac, cell as ci,
               lat, lon, range, samples, updated
        FROM towers
        WHERE lat IS NOT NULL AND lon IS NOT NULL
    '''

    params = []

    if len(sys.argv) == 5:
        query += ' AND lat <= ? AND lat >= ? AND lon <= ? AND lon >= ?'
        params = [float(sys.argv[1]), float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])]

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
`
		];

		// If bounding box params are provided, validate and pass as CLI args
		if (north !== null && south !== null && east !== null && west !== null) {
			const validNorth = validateNumericParam(north, 'north', -90, 90);
			const validSouth = validateNumericParam(south, 'south', -90, 90);
			const validEast = validateNumericParam(east, 'east', -180, 180);
			const validWest = validateNumericParam(west, 'west', -180, 180);
			args.push(String(validNorth), String(validSouth), String(validEast), String(validWest));
		}

		// execFile does NOT invoke a shell — immune to injection
		const { stdout } = await execFileAsync('python3', args, { timeout: 15000 });

		const result = safeJsonParse(stdout, CellTowerResultSchema, 'cell-towers');
		if (!result.success) {
			return json(
				{
					success: false,
					towers: [],
					count: 0,
					message: 'Failed to parse cell tower data'
				},
				{ status: 500 }
			);
		}
		return json(result.data);
	} catch (error: unknown) {
		if (error instanceof InputValidationError) {
			return json(
				{
					success: false,
					towers: [],
					message: error.message
				},
				{ status: 400 }
			);
		}
		console.error('Cell tower fetch error:', error);
		return json({
			success: false,
			towers: [],
			message: 'Failed to fetch cell tower data'
		});
	}
};
