import { error, json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { getRFDatabase } from '$lib/server/db/database';
import {
	createPreset,
	deletePreset,
	getPreset,
	listPresets,
	updatePreset
} from '$lib/server/services/trunk-recorder/preset-repository';
import { PresetInputSchema } from '$lib/server/services/trunk-recorder/types';

/** GET /api/trunk-recorder/config — list all saved presets, or one by ?id= */
export const GET = createHandler(async ({ url }) => {
	const db = getRFDatabase().rawDb;
	const id = url.searchParams.get('id');
	if (id) {
		const preset = getPreset(db, id);
		if (!preset) throw error(404, `Preset ${id} not found`);
		return { success: true, preset };
	}
	return { success: true, presets: listPresets(db) };
});

/** POST /api/trunk-recorder/config — create a new preset. */
export const POST = createHandler(
	async ({ request }) => {
		const body = await request.json();
		const input = PresetInputSchema.parse(body);
		const db = getRFDatabase().rawDb;
		const preset = createPreset(db, input);
		return json({ success: true, preset }, { status: 201 });
	},
	{ validateBody: PresetInputSchema }
);

/** PUT /api/trunk-recorder/config?id=... — update existing preset. */
export const PUT = createHandler(
	async ({ request, url }) => {
		const id = url.searchParams.get('id');
		if (!id) throw error(400, 'Query param ?id= required for update');
		const body = await request.json();
		const input = PresetInputSchema.parse(body);
		const db = getRFDatabase().rawDb;
		const preset = updatePreset(db, id, input);
		if (!preset) throw error(404, `Preset ${id} not found`);
		return { success: true, preset };
	},
	{ validateBody: PresetInputSchema }
);

/** DELETE /api/trunk-recorder/config?id=... */
export const DELETE = createHandler(async ({ url }) => {
	const id = url.searchParams.get('id');
	if (!id) throw error(400, 'Query param ?id= required for delete');
	const db = getRFDatabase().rawDb;
	const removed = deletePreset(db, id);
	if (!removed) throw error(404, `Preset ${id} not found`);
	return { success: true };
});
