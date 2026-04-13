/**
 * POST /api/missions/:id/activate
 *
 * Promotes the specified mission to active (unsets any prior active mission).
 */

import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { getRFDatabase } from '$lib/server/db/database';
import { getMission, setActiveMission } from '$lib/server/services/reports/mission-store';

export const POST = createHandler(({ params }) => {
	const id = params.id;
	if (!id) {
		return json({ success: false, error: 'Missing mission id' }, { status: 400 });
	}

	const db = getRFDatabase().rawDb;
	const existing = getMission(db, id);
	if (!existing) {
		return json({ success: false, error: 'Mission not found' }, { status: 404 });
	}

	setActiveMission(db, id);
	return { success: true, active_mission_id: id };
});
