/**
 * Network repository: storage and retrieval of device relationship graphs.
 */

import type Database from 'better-sqlite3';

import { DbRelationshipSchema } from '$lib/schemas/database';
import type { NetworkEdge, NetworkNode } from '$lib/types/network';
import { logger } from '$lib/utils/logger';
import { safeParseWithHandling } from '$lib/utils/validation-error';

import type { DbRelationship } from './types';

/**
 * Store a network graph's edges as relationship rows.
 * Uses INSERT OR REPLACE for idempotent upserts.
 */
export function storeNetworkGraph(
	db: Database.Database,
	_nodes: Map<string, NetworkNode>,
	edges: Map<string, NetworkEdge>
): void {
	const insertRelationship = db.prepare(`
      INSERT OR REPLACE INTO relationships (
        source_device_id, target_device_id, network_id,
        relationship_type, strength, first_seen, last_seen
      ) VALUES (
        @source_device_id, @target_device_id, @network_id,
        @relationship_type, @strength, @first_seen, @last_seen
      )
    `);

	const storeGraph = db.transaction(() => {
		edges.forEach((edge) => {
			const relationshipData = {
				source_device_id: edge.source,
				target_device_id: edge.target,
				network_id: null, // TODO(#9): Implement network detection
				relationship_type: edge.type,
				strength: edge.strength,
				first_seen: edge.metadata.lastSeen,
				last_seen: edge.metadata.lastSeen
			};

			// Validate relationship data before insertion (T035)
			const validated = safeParseWithHandling(
				DbRelationshipSchema,
				relationshipData,
				'background'
			);
			if (validated) {
				insertRelationship.run(validated);
			} else {
				logger.error(
					'Invalid relationship data, skipping',
					{ edge_id: edge.id },
					'relationship-validation-failed'
				);
			}
		});
	});

	storeGraph();
}

/**
 * Retrieve network relationships, optionally filtered by device IDs.
 * When deviceIds is provided, returns relationships where either
 * source or target matches any of the given IDs.
 */
/** Build query and params for relationship lookup, optionally filtered by device IDs. */
function buildRelationshipQuery(deviceIds?: string[]): { query: string; params: unknown[] } {
	const hasFilter = deviceIds && deviceIds.length > 0;
	const base = `SELECT * FROM relationships`;
	if (!hasFilter) return { query: `${base} ORDER BY last_seen DESC LIMIT 1000`, params: [] };
	const placeholders = deviceIds.map(() => '?').join(',');
	return {
		query: `${base} WHERE source_device_id IN (${placeholders}) OR target_device_id IN (${placeholders}) ORDER BY last_seen DESC LIMIT 1000`,
		params: [...deviceIds, ...deviceIds]
	};
}

/** Validate raw DB rows against the relationship schema, logging failures. */
function validateRelationshipRows(rawRows: unknown[]): DbRelationship[] {
	return rawRows.reduce<DbRelationship[]>((acc, row) => {
		const validated = safeParseWithHandling(DbRelationshipSchema, row, 'background');
		if (validated) acc.push(validated);
		else
			logger.error(
				'Invalid relationship data returned from database query',
				{ row },
				'relationship-query-validation-failed'
			);
		return acc;
	}, []);
}

export function getNetworkRelationships(
	db: Database.Database,
	deviceIds?: string[]
): DbRelationship[] {
	const { query, params } = buildRelationshipQuery(deviceIds);
	const rawRows = db.prepare(query).all(...params) as unknown[];
	return validateRelationshipRows(rawRows);
}
