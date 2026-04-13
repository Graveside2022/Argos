/**
 * DELETE /api/reports/:id
 *
 * Removes a report row and deletes the on-disk artifact directory
 * (`data/reports/<id>/`) if it exists.
 */

import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { getRFDatabase } from '$lib/server/db/database';
import { deleteReport, getReport } from '$lib/server/services/reports/mission-store';
import { logger } from '$lib/utils/logger';

function removeArtifactDir(id: string): void {
	const reportDir = join(process.cwd(), 'data', 'reports', id);
	if (!existsSync(reportDir)) return;
	try {
		rmSync(reportDir, { recursive: true, force: true });
	} catch (err) {
		logger.warn('Failed to remove report artifact directory', {
			reportDir,
			error: err instanceof Error ? err.message : String(err)
		});
	}
}

export const DELETE = createHandler(({ params }) => {
	const id = params.id;
	if (!id) {
		return json({ success: false, error: 'Missing report id' }, { status: 400 });
	}

	const db = getRFDatabase().rawDb;
	const existing = getReport(db, id);
	if (!existing) {
		return json({ success: false, error: 'Report not found' }, { status: 404 });
	}

	removeArtifactDir(id);
	deleteReport(db, id);
	return { success: true, deleted: true };
});
