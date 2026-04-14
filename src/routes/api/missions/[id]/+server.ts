/**
 * DELETE /api/missions/:id
 *
 * Cascade-deletes a mission and all associated captures, emitters, reports.
 */

import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { getRFDatabase } from '$lib/server/db/database';
import { deleteMission, getMission } from '$lib/server/services/reports/mission-store';

export const DELETE = createHandler(({ params }) => {
	const id = params.id;
	if (!id) {
		return json({ success: false, error: 'Missing mission id' }, { status: 400 });
	}

	const db = getRFDatabase().rawDb;
	const existing = getMission(db, id);
	if (!existing) {
		return json({ success: false, error: 'Mission not found' }, { status: 404 });
	}

	deleteMission(db, id);
	return { success: true, deleted: true };
});
