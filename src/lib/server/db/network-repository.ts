/**
 * Network repository: storage and retrieval of device relationship graphs.
 */

import type Database from 'better-sqlite3';

import { DbRelationshipSchema } from '$lib/schemas/database';
import type { NetworkEdge, NetworkNode } from '$lib/types/network';
import { logError } from '$lib/utils/logger';
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
				logError(
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
export function getNetworkRelationships(
	db: Database.Database,
	deviceIds?: string[]
): DbRelationship[] {
	let query = `SELECT * FROM relationships`;
	let params: unknown[] = [];

	if (deviceIds && deviceIds.length > 0) {
		query += ` WHERE source_device_id IN (${deviceIds.map(() => '?').join(',')})
                    OR target_device_id IN (${deviceIds.map(() => '?').join(',')})`;
		params = [...deviceIds, ...deviceIds];
	}

	query += ` ORDER BY last_seen DESC LIMIT 1000`;

	const stmt = db.prepare(query);
	const rawRows = stmt.all(...params) as unknown[];

	// Validate all returned rows (T035)
	const validatedRows: DbRelationship[] = [];
	for (const row of rawRows) {
		const validated = safeParseWithHandling(DbRelationshipSchema, row, 'background');
		if (validated) {
			validatedRows.push(validated);
		} else {
			logError(
				'Invalid relationship data returned from database query',
				{ row },
				'relationship-query-validation-failed'
			);
		}
	}

	return validatedRows;
}
