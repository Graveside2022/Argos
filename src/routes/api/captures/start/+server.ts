/**
 * POST /api/captures/start
 *
 * Opens a new capture (baseline, posture, or tick) against a mission.
 * Falls back to the active mission if `mission_id` is omitted.
 */

import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { getRFDatabase } from '$lib/server/db/database';
import { sweepManager } from '$lib/server/hackrf/sweep-manager';
import {
	createCapture,
	getActiveMission,
	getMission
} from '$lib/server/services/reports/mission-store';
import { logger } from '$lib/utils/logger';

const SensorSchema = z.object({
	tool: z.string().min(1).max(100),
	interface: z.string().max(100).optional(),
	gain: z.number().optional(),
	channels: z.array(z.string()).optional()
});

const LoadoutSchema = z.object({
	sensors: z.array(SensorSchema),
	spectrum_start_hz: z.number().positive().optional(),
	spectrum_end_hz: z.number().positive().optional(),
	spectrum_bin_hz: z.number().positive().optional()
});

const StartCaptureSchema = z.object({
	mission_id: z.string().min(1).optional(),
	role: z.enum(['baseline', 'posture', 'tick']),
	loadout: LoadoutSchema
});

type ResolvedMission =
	| { ok: true; missionId: string }
	| { ok: false; status: number; error: string };

function resolveMissionId(
	db: ReturnType<typeof getRFDatabase>['rawDb'],
	requested: string | undefined
): ResolvedMission {
	if (!requested) {
		const active = getActiveMission(db);
		if (!active) {
			return {
				ok: false,
				status: 400,
				error: 'No active mission — provide mission_id or activate one'
			};
		}
		return { ok: true, missionId: active.id };
	}
	if (!getMission(db, requested)) {
		return { ok: false, status: 404, error: 'Mission not found' };
	}
	return { ok: true, missionId: requested };
}

async function runStartNarrowBandSweep(
	captureId: string,
	startHz: number,
	endHz: number,
	binHz: number
): Promise<void> {
	try {
		await sweepManager.startNarrowBandSweep({ captureId, startHz, endHz, binHz });
	} catch (error) {
		logger.warn('captures/start: startNarrowBandSweep failed, continuing without sweep log', {
			captureId,
			error: error instanceof Error ? error.message : String(error)
		});
	}
}

const HACKRF_MIN_BIN_HZ = 2445;
const HACKRF_DEFAULT_BIN_HZ = 3000;

async function maybeStartNarrowBandSweep(
	captureId: string,
	loadout: z.infer<typeof LoadoutSchema>
): Promise<void> {
	const { spectrum_start_hz, spectrum_end_hz, spectrum_bin_hz } = loadout;
	if (!spectrum_start_hz || !spectrum_end_hz) return;
	const requested = spectrum_bin_hz ?? HACKRF_DEFAULT_BIN_HZ;
	const binHz = Math.max(requested, HACKRF_MIN_BIN_HZ);
	await runStartNarrowBandSweep(captureId, spectrum_start_hz, spectrum_end_hz, binHz);
}

export const POST = createHandler(async ({ request }) => {
	const raw = await request.json().catch(() => null);
	const parsed = StartCaptureSchema.safeParse(raw);
	if (!parsed.success) {
		return json(
			{ success: false, error: 'Invalid body', details: parsed.error.issues },
			{ status: 400 }
		);
	}
	const db = getRFDatabase().rawDb;
	const resolved = resolveMissionId(db, parsed.data.mission_id);
	if (!resolved.ok) {
		return json({ success: false, error: resolved.error }, { status: resolved.status });
	}
	const capture = createCapture(db, {
		mission_id: resolved.missionId,
		role: parsed.data.role,
		loadout: parsed.data.loadout
	});
	await maybeStartNarrowBandSweep(capture.id, parsed.data.loadout);
	return { success: true, capture };
});
