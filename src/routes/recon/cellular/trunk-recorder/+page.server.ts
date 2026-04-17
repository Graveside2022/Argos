import { getRFDatabase } from '$lib/server/db/database';
import { listPresets } from '$lib/server/services/trunk-recorder/preset-repository';
import { getStatus } from '$lib/server/services/trunk-recorder/service';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const db = getRFDatabase().rawDb;
	return {
		presets: listPresets(db),
		status: await getStatus()
	};
};
