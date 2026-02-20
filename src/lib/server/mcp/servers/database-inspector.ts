#!/usr/bin/env node
/**
 * Database Inspector MCP Server
 * Provides tools for SQLite database inspection, safe querying, and health monitoring
 */

import { config } from 'dotenv';

import { logger } from '$lib/utils/logger';

import { apiFetch } from '../shared/api-client';
import { BaseMCPServer, type ToolDefinition } from '../shared/base-server';

// Load .env for ARGOS_API_KEY
config();

class DatabaseInspector extends BaseMCPServer {
	protected tools: ToolDefinition[] = [
		{
			name: 'inspect_schema',
			description:
				'Inspect database schema (tables, indexes, views). Returns table structures, row counts, and database statistics. Use to understand database organization or before writing queries.',
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
					return {
						status: 'ERROR',
						error: data.error
					};
				}

				// Simplify output if not detailed
				const schema = detailed
					? data.schema
					: {
							tables: data.schema.tables.map(
								(t: { name: string; row_count: number }) => ({
									name: t.name,
									row_count: t.row_count
								})
							),
							indexes: data.schema.indexes.map(
								(i: { name: string; table: string }) => ({
									name: i.name,
									table: i.table
								})
							),
							views: data.schema.views.map((v: { name: string }) => ({
								name: v.name
							}))
						};

				const recommendations = [];

				// Analyze schema
				const signalsTable = data.schema.tables.find(
					(t: { name: string }) => t.name === 'signals'
				);
				if (signalsTable && signalsTable.row_count > 500000) {
					recommendations.push('⚠️ Large signals table - consider cleanup policy');
				}

				const spatialIndex = data.schema.indexes.find(
					(i: { name: string }) => i.name === 'idx_signals_spatial_grid'
				);
				if (!spatialIndex) {
					recommendations.push(
						'🔴 CRITICAL: Missing spatial index - queries will be slow'
					);
				}

				if (recommendations.length === 0) {
					recommendations.push('✅ Schema looks healthy');
				}

				return {
					status: 'SUCCESS',
					schema,
					stats: data.stats,
					recommendations
				};
			}
		},
		{
			name: 'query_database',
			description:
				'Execute safe SELECT query on database. Read-only with automatic LIMIT enforcement (max 1000 rows). Use for data exploration and debugging. Returns results with execution time.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					query: {
						type: 'string',
						description: 'SQL SELECT query (read-only, max 1000 rows)'
					},
					params: {
						type: 'array',
						description: 'Query parameters for prepared statement (optional)',
						items: {
							anyOf: [{ type: 'string' }, { type: 'number' }]
						}
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
					return {
						status: 'ERROR',
						error: data.error
					};
				}

				const recommendations = [];

				if (data.execution_time_ms > 1000) {
					recommendations.push(
						'⚠️ Slow query (>1s) - consider adding indexes or reducing result set'
					);
				}

				if (data.row_count === 1000) {
					recommendations.push(
						'ℹ️ Result set truncated at 1000 rows - add WHERE clause for more specific query'
					);
				}

				return {
					status: 'SUCCESS',
					query: data.query,
					row_count: data.row_count,
					execution_time_ms: data.execution_time_ms,
					results: data.results.slice(0, 100), // Show max 100 in MCP response
					note:
						data.row_count > 100
							? `Showing first 100 of ${data.row_count} rows`
							: undefined,
					recommendations
				};
			}
		},
		{
			name: 'analyze_database_health',
			description:
				'Analyze database health and integrity. Checks for orphaned records, stale data, large tables, missing indexes, and data corruption. Returns issues with severity levels and fix recommendations.',
			inputSchema: {
				type: 'object' as const,
				properties: {}
			},
			execute: async () => {
				const resp = await apiFetch('/api/database/health');
				const data = await resp.json();

				if (!data.success) {
					return {
						status: 'ERROR',
						error: data.error
					};
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
				'Get recent database activity (last N minutes). Shows new signals, active devices, and network changes. Use to verify data is being captured correctly.',
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
				const timestamp = Date.now() - minutes * 60 * 1000;

				// Query recent signals
				const signalsResp = await apiFetch('/api/database/query', {
					method: 'POST',
					body: JSON.stringify({
						query: 'SELECT COUNT(*) as count FROM signals WHERE timestamp > ?',
						params: [timestamp]
					})
				});

				const signalsData = await signalsResp.json();
				const signalCount = signalsData.success ? signalsData.results[0]?.count || 0 : 0;

				// Query active devices
				const devicesResp = await apiFetch('/api/database/query', {
					method: 'POST',
					body: JSON.stringify({
						query: 'SELECT COUNT(*) as count FROM devices WHERE last_seen > ?',
						params: [timestamp]
					})
				});

				const devicesData = await devicesResp.json();
				const deviceCount = devicesData.success ? devicesData.results[0]?.count || 0 : 0;

				// Query recent patterns
				const patternsResp = await apiFetch('/api/database/query', {
					method: 'POST',
					body: JSON.stringify({
						query: 'SELECT COUNT(*) as count FROM patterns WHERE timestamp > ?',
						params: [timestamp]
					})
				});

				const patternsData = await patternsResp.json();
				const patternCount = patternsData.success ? patternsData.results[0]?.count || 0 : 0;

				const recommendations = [];

				if (signalCount === 0) {
					recommendations.push('⚠️ No signals captured in last ' + minutes + ' minutes');
					recommendations.push(
						'💡 Check: Are hardware sources running? (HackRF, Kismet)'
					);
				} else {
					const rate = (signalCount / minutes).toFixed(1);
					recommendations.push(`✅ ${signalCount} signals captured (${rate}/min)`);
				}

				if (deviceCount === 0 && signalCount > 0) {
					recommendations.push('ℹ️ Signals captured but no devices tracked');
				}

				return {
					status: 'SUCCESS',
					time_window_minutes: minutes,
					activity: {
						new_signals: signalCount,
						active_devices: deviceCount,
						new_patterns: patternCount,
						signal_rate_per_minute: parseFloat((signalCount / minutes).toFixed(1))
					},
					recommendations
				};
			}
		},
		{
			name: 'debug_spatial_index',
			description:
				'Debug R-tree spatial index for location-based queries. Tests spatial query performance and validates grid-based indexing. Use when spatial queries are slow or returning incorrect results.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					test_location: {
						type: 'object',
						description: 'Test coordinates {lat, lon} (default: use latest signal)',
						properties: {
							lat: { type: 'number' },
							lon: { type: 'number' }
						}
					},
					radius_meters: {
						type: 'number',
						description: 'Test radius in meters (default: 1000)'
					}
				}
			},
			execute: async (args: Record<string, unknown>) => {
				const radius = (args.radius_meters as number) || 1000;
				let lat = 0;
				let lon = 0;

				// Get test location
				if (args.test_location) {
					const loc = args.test_location as { lat: number; lon: number };
					lat = loc.lat;
					lon = loc.lon;
				} else {
					// Use latest signal location
					const latestResp = await apiFetch('/api/database/query', {
						method: 'POST',
						body: JSON.stringify({
							query: 'SELECT latitude, longitude FROM signals ORDER BY timestamp DESC LIMIT 1'
						})
					});

					const latestData = await latestResp.json();
					if (latestData.success && latestData.results.length > 0) {
						lat = latestData.results[0].latitude;
						lon = latestData.results[0].longitude;
					} else {
						return {
							status: 'ERROR',
							error: 'No signals in database - cannot test spatial index'
						};
					}
				}

				// Calculate grid bounds (matching schema grid index)
				const gridLat = Math.floor(lat * 10000);
				const gridLon = Math.floor(lon * 10000);
				const gridRadius = Math.floor((radius / 1000) * 10000); // Convert meters to grid units

				// Test query with grid index
				const gridQuery = `
          SELECT COUNT(*) as count
          FROM signals
          WHERE CAST(latitude * 10000 AS INTEGER) >= ${gridLat - gridRadius}
            AND CAST(latitude * 10000 AS INTEGER) <= ${gridLat + gridRadius}
            AND CAST(longitude * 10000 AS INTEGER) >= ${gridLon - gridRadius}
            AND CAST(longitude * 10000 AS INTEGER) <= ${gridLon + gridRadius}
        `;

				const gridStartTime = Date.now();
				const gridResp = await apiFetch('/api/database/query', {
					method: 'POST',
					body: JSON.stringify({ query: gridQuery })
				});
				const gridTime = Date.now() - gridStartTime;

				const gridData = await gridResp.json();
				const gridCount = gridData.success ? gridData.results[0]?.count || 0 : 0;

				// Test query without index (full table scan)
				const fullQuery = `
          SELECT COUNT(*) as count
          FROM signals
          WHERE latitude BETWEEN ${lat - 0.01} AND ${lat + 0.01}
            AND longitude BETWEEN ${lon - 0.01} AND ${lon + 0.01}
        `;

				const fullStartTime = Date.now();
				const fullResp = await apiFetch('/api/database/query', {
					method: 'POST',
					body: JSON.stringify({ query: fullQuery })
				});
				const fullTime = Date.now() - fullStartTime;

				const fullData = await fullResp.json();
				const fullCount = fullData.success ? fullData.results[0]?.count || 0 : 0;

				const recommendations = [];

				const speedup = fullTime / Math.max(gridTime, 1);

				if (speedup < 2) {
					recommendations.push(
						'⚠️ Grid index not providing significant speedup - may be missing or not used'
					);
					recommendations.push('💡 Check: EXPLAIN QUERY PLAN for spatial queries');
				} else {
					recommendations.push(`✅ Grid index working (${speedup.toFixed(1)}x faster)`);
				}

				if (Math.abs(gridCount - fullCount) > 10) {
					recommendations.push(
						'⚠️ Grid query and full scan return different counts - potential index issue'
					);
				}

				return {
					status: 'SUCCESS',
					test_location: { lat, lon },
					radius_meters: radius,
					results: {
						grid_indexed_query: {
							count: gridCount,
							execution_time_ms: gridTime
						},
						full_table_scan: {
							count: fullCount,
							execution_time_ms: fullTime
						},
						speedup: parseFloat(speedup.toFixed(2))
					},
					recommendations
				};
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
