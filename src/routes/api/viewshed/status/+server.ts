import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { getTileIndex } from '$lib/server/services/terrain/tile-index-singleton';

// ── GET handler ─────────────────────────────────────────────────────

export const GET = createHandler(() => {
	const index = getTileIndex();

	if (!index.isLoaded) {
		return json({
			loaded: false,
			tileCount: 0,
			coverage: null,
			dataDir: index.dataDirPath,
			message: 'No DTED tiles found. Extract DTED .zip to data/dted/ directory.'
		});
	}

	const { cacheSizeBytes, cacheCapacity, cacheTiles } = index.cacheStats;

	return json({
		loaded: true,
		tileCount: index.tileCount,
		coverage: index.coverageBounds,
		dataDir: index.dataDirPath,
		cacheSizeBytes,
		cacheCapacity,
		cacheTiles
	});
});
