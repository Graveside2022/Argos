/**
 * POST /api/missions
 *
 * Creates a new mission. Optionally promotes the new mission to active.
 */

import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { getRFDatabase } from '$lib/server/db/database';
import { createMission, setActiveMission } from '$lib/server/services/reports/mission-store';

const CreateMissionSchema = z.object({
	name: z.string().min(1).max(200),
	type: z.enum(['sitrep-loop', 'emcon-survey']),
	unit: z.string().max(100).nullable().optional(),
	ao_mgrs: z.string().max(100).nullable().optional(),
	set_active: z.boolean().optional()
});

export const POST = createHandler(async ({ request }) => {
	const raw = await request.json().catch(() => null);
	const parsed = CreateMissionSchema.safeParse(raw);
	if (!parsed.success) {
		return json(
			{ success: false, error: 'Invalid body', details: parsed.error.issues },
			{ status: 400 }
		);
	}

	const db = getRFDatabase().rawDb;
	const mission = createMission(db, {
		name: parsed.data.name,
		type: parsed.data.type,
		unit: parsed.data.unit ?? null,
		ao_mgrs: parsed.data.ao_mgrs ?? null
	});

	if (parsed.data.set_active) {
		setActiveMission(db, mission.id);
		mission.active = true;
	}

	return { success: true, mission };
});
