#!/usr/bin/env node
/**
 * Database Inspector MCP Server
 * Provides tools for SQLite database inspection, safe querying, and health monitoring
 */

import { config } from 'dotenv';

import { logger } from '$lib/utils/logger';

import { apiFetch } from '../shared/api-client';
import { BaseMCPServer, type ToolDefinition } from '../shared/base-server';
import { debugSpatialIndex, queryRecentActivity } from './database-inspector-tools';

// Load .env for ARGOS_API_KEY
config();

/** Simplify schema to names and counts only. */
function simplifySchema(schema: Record<string, unknown[]>) {
	return {
		tables: (schema.tables as Array<{ name: string; row_count: number }>).map((t) => ({
			name: t.name,
			row_count: t.row_count
		})),
		indexes: (schema.indexes as Array<{ name: string; table: string }>).map((i) => ({
			name: i.name,
			table: i.table
		})),
		views: (schema.views as Array<{ name: string }>).map((v) => ({ name: v.name }))
	};
}

/** Generate schema health recommendations. */
function generateSchemaRecs(schema: Record<string, unknown[]>): string[] {
	const recs: string[] = [];
	const signalsTable = (schema.tables as Array<{ name: string; row_count: number }>).find(
		(t) => t.name === 'signals'
	);
	if (signalsTable && signalsTable.row_count > 500000) {
		recs.push('Large signals table - consider cleanup policy');
	}
	const spatialIndex = (schema.indexes as Array<{ name: string }>).find(
		(i) => i.name === 'idx_signals_spatial_grid'
	);
	if (!spatialIndex) {
		recs.push('CRITICAL: Missing spatial index - queries will be slow');
	}
	return recs.length > 0 ? recs : ['Schema looks healthy'];
}

/** Generate query performance recommendations. */
function generateQueryRecs(executionTimeMs: number, rowCount: number): string[] {
	const recs: string[] = [];
	if (executionTimeMs > 1000) recs.push('Slow query (>1s) - consider adding indexes');
	if (rowCount === 1000) recs.push('Result set truncated at 1000 rows - add WHERE clause');
	return recs;
}

/** Generate truncation note if applicable. */
function truncationNote(rowCount: number): string | undefined {
	return rowCount > 100 ? `Showing first 100 of ${rowCount} rows` : undefined;
}

class DatabaseInspector extends BaseMCPServer {
	protected tools: ToolDefinition[] = [
		{
			name: 'inspect_schema',
			description:
				'Inspect database schema (tables, indexes, views). Returns table structures, row counts, and statistics.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					detailed: {
						type: 'boolean',
						description: 'Include full SQL definitions (default: true)'
					}
				}
			},
			execute: async (args: Record<string, unknown>) => {
				const detailed = args.detailed !== false;
				const resp = await apiFetch('/api/database/schema');
				const data = await resp.json();

				if (!data.success) {
					return { status: 'ERROR', error: data.error };
				}

				const schema = detailed ? data.schema : simplifySchema(data.schema);
				return {
					status: 'SUCCESS',
					schema,
					stats: data.stats,
					recommendations: generateSchemaRecs(data.schema)
				};
			}
		},
		{
			name: 'query_database',
			description:
				'Execute safe SELECT query on database. Read-only with automatic LIMIT enforcement (max 1000 rows).',
			inputSchema: {
				type: 'object' as const,
				properties: {
					query: {
						type: 'string',
						description: 'SQL SELECT query (read-only, max 1000 rows)'
					},
					params: {
						type: 'array',
						description: 'Query parameters for prepared statement',
						items: { anyOf: [{ type: 'string' }, { type: 'number' }] }
					}
				},
				required: ['query']
			},
			execute: async (args: Record<string, unknown>) => {
				const query = args.query as string;
				// Safe: MCP tool args.params validated as array by schema
				const params = (args.params as Array<string | number>) || [];

				const resp = await apiFetch('/api/database/query', {
					method: 'POST',
					body: JSON.stringify({ query, params })
				});

				const data = await resp.json();

				if (!data.success) {
					return { status: 'ERROR', error: data.error };
				}

				return {
					status: 'SUCCESS',
					query: data.query,
					row_count: data.row_count,
					execution_time_ms: data.execution_time_ms,
					results: data.results.slice(0, 100),
					note: truncationNote(data.row_count),
					recommendations: generateQueryRecs(data.execution_time_ms, data.row_count)
				};
			}
		},
		{
			name: 'analyze_database_health',
			description:
				'Analyze database health and integrity. Checks orphaned records, stale data, missing indexes, corruption.',
			inputSchema: { type: 'object' as const, properties: {} },
			execute: async () => {
				const resp = await apiFetch('/api/database/health');
				const data = await resp.json();

				if (!data.success) {
					return { status: 'ERROR', error: data.error };
				}

				return {
					status: 'SUCCESS',
					overall_health: data.overall_health,
					integrity_ok: data.integrity_ok,
					summary: {
						total_issues: data.stats.total_issues,
						critical: data.stats.critical,
						warnings: data.stats.warnings,
						info: data.stats.info
					},
					issues: data.issues,
					recommendations: data.recommendations
				};
			}
		},
		{
			name: 'get_recent_activity',
			description:
				'Get recent database activity (last N minutes). Shows new signals, active devices, network changes.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					minutes: {
						type: 'number',
						description: 'Time window in minutes (default: 5, max: 60)'
					}
				}
			},
			execute: async (args: Record<string, unknown>) => {
				const minutes = Math.min((args.minutes as number) || 5, 60);
				return queryRecentActivity(minutes);
			}
		},
		{
			name: 'debug_spatial_index',
			description:
				'Debug R-tree spatial index for location-based queries. Tests spatial query performance.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					test_location: {
						type: 'object',
						description: 'Test coordinates {lat, lon} (default: use latest signal)',
						properties: { lat: { type: 'number' }, lon: { type: 'number' } }
					},
					radius_meters: {
						type: 'number',
						description: 'Test radius in meters (default: 1000)'
					}
				}
			},
			execute: async (args: Record<string, unknown>) => {
				const radius = (args.radius_meters as number) || 1000;
				const testLocation = args.test_location as { lat: number; lon: number } | undefined;
				return debugSpatialIndex(testLocation, radius);
			}
		}
	];
}

// Start server when run directly
const server = new DatabaseInspector('argos-database-inspector');
server.start().catch((error) => {
	logger.error('Database Inspector fatal error', {
		error: error instanceof Error ? error.message : String(error)
	});
	process.exit(1);
});
