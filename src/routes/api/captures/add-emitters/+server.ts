/**
 * POST /api/captures/add-emitters
 *
 * Inserts a batch of emitter snapshot rows into an existing capture.
 * Used by the Fort Irwin SITREP automation script to hydrate a tick capture
 * with live Kismet WiFi + Bluetooth devices before the SITREP renders.
 */

import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { getRFDatabase } from '$lib/server/db/database';
import { getCapture, snapshotCaptureEmitters } from '$lib/server/services/reports/mission-store';
import type { CaptureEmitterRow } from '$lib/server/services/reports/types';

const EmitterRowSchema = z.object({
	source_table: z.string().min(1).max(100),
	source_id: z.string().min(1).max(200),
	signal_type: z.string().min(1).max(50),
	identifier: z.string().max(500).nullable(),
	fingerprint_key: z.string().min(1).max(500),
	freq_hz: z.number().int().nonnegative().nullable(),
	power_dbm: z.number().nullable(),
	modulation: z.string().max(50).nullable(),
	mgrs: z.string().max(50).nullable(),
	classification: z.string().max(50).nullable(),
	sensor_tool: z.string().max(100).nullable(),
	raw_json: z.string()
});

const AddEmittersSchema = z.object({
	capture_id: z.string().min(1),
	emitters: z.array(EmitterRowSchema).max(5000)
});

export const POST = createHandler(async ({ request }) => {
	const raw = await request.json().catch(() => null);
	const parsed = AddEmittersSchema.safeParse(raw);
	if (!parsed.success) {
		return json(
			{ success: false, error: 'Invalid body', details: parsed.error.issues },
			{ status: 400 }
		);
	}

	const db = getRFDatabase().rawDb;
	const capture = getCapture(db, parsed.data.capture_id);
	if (!capture) {
		return json({ success: false, error: 'Capture not found' }, { status: 404 });
	}

	const rows = parsed.data.emitters as unknown as CaptureEmitterRow[];
	snapshotCaptureEmitters(db, parsed.data.capture_id, rows);

	return json({ success: true, inserted: rows.length, capture_id: parsed.data.capture_id });
});
