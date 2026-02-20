import { error, json } from '@sveltejs/kit';
import Database from 'better-sqlite3';
import { z } from 'zod';

import { logger } from '$lib/utils/logger';
import { safeParseWithHandling } from '$lib/utils/validation-error';

import type { RequestHandler } from './$types';

const CleanupRequestSchema = z.object({
	maxAge: z
		.number()
		.min(0)
		.max(86400000)
		.optional()
		.describe('Max age in ms (default 1 hour, max 24 hours)')
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		const rawBody = await request.json();
		const validated = safeParseWithHandling(CleanupRequestSchema, rawBody, 'user-action');
		if (!validated) {
			return error(400, 'Invalid cleanup request');
		}
		const { maxAge } = validated;

		// Open database directly for cleanup operation
		const db = new Database('./rf_signals.db');
		db.pragma('journal_mode = WAL');

		try {
			// Delete old signals
			const cutoff = Date.now() - (maxAge || 3600000); // Default 1 hour

			const result = db
				.prepare(
					`
        DELETE FROM signals 
        WHERE timestamp < ?
      `
				)
				.run(cutoff);

			// Also clean up orphaned devices
			db.prepare(
				`
        DELETE FROM devices 
        WHERE device_id NOT IN (
          SELECT DISTINCT device_id FROM signals WHERE device_id IS NOT NULL
        )
      `
			).run();

			return json({
				success: true,
				deleted: result.changes
			});
		} finally {
			db.close();
		}
	} catch (err: unknown) {
		logger.error('Error cleaning up signals', {
			error: err instanceof Error ? err.message : String(err)
		});
		return error(500, 'Failed to clean up signals');
	}
};
