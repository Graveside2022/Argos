/**
 * POST /api/captures/:id/stop
 *
 * Closes a capture. Optionally snapshots an operator-supplied emitter list
 * into the `capture_emitters` table. In v1, emitters are passed by the
 * frontend — auto-snapshotting from live tables is future work.
 */

import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { getRFDatabase } from '$lib/server/db/database';
import { sweepManager } from '$lib/server/hackrf/sweep-manager';
import {
	getCapture,
	snapshotCaptureEmitters,
	stopCapture
} from '$lib/server/services/reports/mission-store';
import { logger } from '$lib/utils/logger';

const CaptureEmitterSchema = z.object({
	capture_id: z.string(),
	source_table: z.string(),
	source_id: z.string(),
	signal_type: z.string(),
	identifier: z.string().nullable(),
	fingerprint_key: z.string(),
	freq_hz: z.number().nullable(),
	power_dbm: z.number().nullable(),
	modulation: z.string().nullable(),
	mgrs: z.string().nullable(),
	classification: z.string().nullable(),
	sensor_tool: z.string().nullable(),
	raw_json: z.string()
});

const StopCaptureSchema = z.object({
	emitters: z.array(CaptureEmitterSchema).optional()
});

type ParsedStop =
	| { ok: true; emitters?: z.infer<typeof CaptureEmitterSchema>[] }
	| { ok: false; status: number; error: string; details?: unknown };

async function parseStopBody(request: Request): Promise<ParsedStop> {
	let body: unknown = {};
	try {
		const text = await request.text();
		if (text) body = JSON.parse(text);
	} catch {
		return { ok: false, status: 400, error: 'Invalid JSON body' };
	}
	const parsed = StopCaptureSchema.safeParse(body);
	if (!parsed.success) {
		return {
			ok: false,
			status: 400,
			error: 'Invalid body',
			details: parsed.error.issues
		};
	}
	return { ok: true, emitters: parsed.data.emitters };
}

function applyStop(id: string, emitters: z.infer<typeof CaptureEmitterSchema>[] | undefined) {
	const db = getRFDatabase().rawDb;
	if (!getCapture(db, id)) return null;
	stopCapture(db, id, Date.now());
	if (emitters && emitters.length > 0) {
		const normalized = emitters.map((e) => ({ ...e, capture_id: id }));
		snapshotCaptureEmitters(db, id, normalized);
	}
	return getCapture(db, id);
}

async function closeSweepLogSafe(id: string): Promise<void> {
	try {
		await sweepManager.closeSweepLogForCapture(id);
	} catch (error) {
		logger.warn('captures/stop: closeSweepLogForCapture failed', {
			captureId: id,
			error: error instanceof Error ? error.message : String(error)
		});
	}
}

export const POST = createHandler(async ({ params, request }) => {
	const id = params.id;
	if (!id) {
		return json({ success: false, error: 'Missing capture id' }, { status: 400 });
	}
	const parsed = await parseStopBody(request);
	if (!parsed.ok) {
		return json(
			{ success: false, error: parsed.error, details: parsed.details },
			{ status: parsed.status }
		);
	}
	const capture = applyStop(id, parsed.emitters);
	if (!capture) {
		return json({ success: false, error: 'Capture not found' }, { status: 404 });
	}
	await closeSweepLogSafe(id);
	return { success: true, capture };
});
