/**
 * GET /api/missions/list
 *
 * Returns all missions (ordered by creation time, most recent first).
 */

import { createHandler } from '$lib/server/api/create-handler';
import { getRFDatabase } from '$lib/server/db/database';
import { listMissions } from '$lib/server/services/reports/mission-store';

export const GET = createHandler(() => {
	const db = getRFDatabase().rawDb;
	const missions = listMissions(db);
	return { success: true, missions };
});
