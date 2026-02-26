import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { env } from '$lib/server/env';
import { DTEDTileIndex } from '$lib/server/services/terrain/dted-tile-index';

// ── Singleton tile index (shared with compute endpoint) ─────────────

let tileIndex: DTEDTileIndex | null = null;

function getTileIndex(): DTEDTileIndex {
	if (!tileIndex) {
		tileIndex = new DTEDTileIndex(env.DTED_DATA_DIR);
	}
	return tileIndex;
}

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
