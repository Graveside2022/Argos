import { json } from '@sveltejs/kit';

import { getRFDatabase } from '$lib/server/db/database';

import type { RequestHandler } from './$types';

// Safe query execution with limits and validation
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { query, params = [] } = body;

		if (!query || typeof query !== 'string') {
			return json({
				success: false,
				error: 'Query is required and must be a string'
			});
		}

		// Safety checks
		const queryLower = query.toLowerCase().trim();

		// Block dangerous operations
		const dangerousKeywords = [
			'drop ',
			'delete ',
			'update ',
			'insert ',
			'alter ',
			'create ',
			'pragma ',
			'attach ',
			'detach '
		];

		for (const keyword of dangerousKeywords) {
			if (queryLower.includes(keyword)) {
				return json({
					success: false,
					error: `Query contains disallowed keyword: ${keyword.trim()}. Use read-only SELECT queries only.`
				});
			}
		}

		// Enforce SELECT only
		if (!queryLower.startsWith('select ')) {
			return json({
				success: false,
				error: 'Only SELECT queries are allowed'
			});
		}

		// Enforce LIMIT clause (max 1000 rows)
		const hasLimit = queryLower.includes('limit ');
		let finalQuery = query;

		if (!hasLimit) {
			finalQuery = `${query.trim().replace(/;$/, '')} LIMIT 1000`;
		} else {
			// Extract limit value and cap at 1000
			const limitMatch = queryLower.match(/limit\s+(\d+)/);
			if (limitMatch) {
				const limitValue = parseInt(limitMatch[1]);
				if (limitValue > 1000) {
					return json({
						success: false,
						error: 'LIMIT cannot exceed 1000 rows'
					});
				}
			}
		}

		const db = getRFDatabase();
		const dbInternal = db.rawDb;

		const startTime = Date.now();
		const stmt = dbInternal.prepare(finalQuery);

		let results;
		if (params.length > 0) {
			results = stmt.all(...params);
		} else {
			results = stmt.all();
		}

		const executionTime = Date.now() - startTime;

		return json({
			success: true,
			query: finalQuery,
			row_count: results.length,
			execution_time_ms: executionTime,
			results
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		return json({
			success: false,
			error: msg
		});
	}
};
