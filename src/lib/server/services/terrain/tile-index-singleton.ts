/**
 * Shared singleton DTEDTileIndex instance.
 *
 * Both the /api/viewshed/compute and /api/viewshed/status endpoints import
 * this module to share a single tile index (and its LRU cache).
 *
 * @module
 */

import { env } from '$lib/server/env';

import { DTEDTileIndex } from './dted-tile-index';

let instance: DTEDTileIndex | null = null;

/** Get or create the singleton tile index (lazy-initialized on first call) */
export function getTileIndex(): DTEDTileIndex {
	if (!instance) {
		instance = new DTEDTileIndex(env.DTED_DATA_DIR);
	}
	return instance;
}
