import { createHandler } from '$lib/server/api/create-handler';
import { errMsg } from '$lib/server/api/error-utils';
import { getRFDatabase } from '$lib/server/db/database';

const DANGEROUS_KEYWORDS = [
	'drop ', 'delete ', 'update ', 'insert ',
	'alter ', 'create ', 'pragma ', 'attach ', 'detach '
];

/** Check if query contains dangerous SQL keywords. Returns the keyword or null. */
function findDangerousKeyword(queryLower: string): string | null {
	for (const keyword of DANGEROUS_KEYWORDS) {
		if (queryLower.includes(keyword)) return keyword.trim();
	}
	return null;
}

/** Validate the query is a safe SELECT. Returns error message or null. */
function validateQuery(query: unknown): string | null {
	if (!query || typeof query !== 'string') return 'Query is required and must be a string';
	const lower = (query as string).toLowerCase().trim();
	const dangerous = findDangerousKeyword(lower);
	if (dangerous) return `Query contains disallowed keyword: ${dangerous}. Use read-only SELECT queries only.`;
	if (!lower.startsWith('select ')) return 'Only SELECT queries are allowed';
	return null;
}

/** Enforce LIMIT clause, capping at 1000. Returns final query or error. */
function enforceLimit(query: string): { query?: string; error?: string } {
	const lower = query.toLowerCase().trim();
	if (!lower.includes('limit ')) {
		return { query: `${query.trim().replace(/;$/, '')} LIMIT 1000` };
	}
	const limitMatch = lower.match(/limit\s+(\d+)/);
	if (limitMatch && parseInt(limitMatch[1]) > 1000) {
		return { error: 'LIMIT cannot exceed 1000 rows' };
	}
	return { query };
}

/** Execute a prepared SELECT query with optional params. */
function executeQuery(finalQuery: string, params: unknown[]): { results: unknown[]; duration: number } {
	const db = getRFDatabase().rawDb;
	const startTime = Date.now();
	const results = params.length > 0
		? db.prepare(finalQuery).all(...params)
		: db.prepare(finalQuery).all();
	return { results, duration: Date.now() - startTime };
}

/** Validate and prepare the query, returning error response or final query. */
function prepareQuery(query: unknown): { finalQuery?: string; errorMsg?: string } {
	const valErr = validateQuery(query);
	if (valErr) return { errorMsg: valErr };
	const limitResult = enforceLimit(query as string);
	if (limitResult.error) return { errorMsg: limitResult.error };
	return { finalQuery: limitResult.query };
}

// Safe query execution with limits and validation
export const POST = createHandler(async ({ request }) => {
	try {
		const body = await request.json();
		const { query, params = [] } = body;

		const prepared = prepareQuery(query);
		if (prepared.errorMsg) return { success: false, error: prepared.errorMsg };

		const { results, duration } = executeQuery(prepared.finalQuery as string, params);
		return {
			success: true,
			query: prepared.finalQuery,
			row_count: results.length,
			execution_time_ms: duration,
			results
		};
	} catch (error) {
		return { success: false, error: errMsg(error) };
	}
});
