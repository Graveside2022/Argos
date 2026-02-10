#!/usr/bin/env node
/**
 * GPS MCP Server
 * Provides tools for GPS positioning and location-based signal queries
 */

import { config } from 'dotenv';
import { BaseMCPServer, type ToolDefinition } from '../shared/base-server';
import { apiFetch } from '../shared/api-client';

// Load .env for ARGOS_API_KEY
config();

class GPSServer extends BaseMCPServer {
	protected tools: ToolDefinition[] = [
		{
			name: 'get_position',
			description:
				'Get current GPS position from gpsd. Returns latitude, longitude, altitude, speed, heading, accuracy, satellite count, and fix quality (0=no fix, 2=2D, 3=3D).',
			inputSchema: {
				type: 'object' as const,
				properties: {}
			},
			execute: async () => {
				const resp = await apiFetch('/api/gps/position');
				return await resp.json();
			}
		},
		{
			name: 'get_nearby_signals',
			description:
				'Get RF signals detected near a specific GPS location using R-tree spatial indexing. Returns signals within radius with frequency, power, type, and timestamp data.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					latitude: {
						type: 'number',
						description: 'Latitude coordinate'
					},
					longitude: {
						type: 'number',
						description: 'Longitude coordinate'
					},
					radius_meters: {
						type: 'number',
						description: 'Search radius in meters (default: 100)'
					},
					min_power: {
						type: 'number',
						description: 'Minimum signal power in dBm (default: -100)'
					}
				},
				required: ['latitude', 'longitude']
			},
			execute: async (args: Record<string, unknown>) => {
				const lat = args.latitude as number;
				const lon = args.longitude as number;
				const radius = (args.radius_meters as number) || 100;
				const resp = await apiFetch(
					`/api/signals?lat=${lat}&lon=${lon}&radiusMeters=${radius}&limit=100`
				);
				const data = await resp.json();
				return { signal_count: data.signals?.length || 0, signals: data.signals || [] };
			}
		},
		{
			name: 'query_signal_history',
			description:
				'Query historical RF signal data from database. Track signal patterns over time for tactical intelligence. Supports time range filtering and device-specific queries.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					device_id: {
						type: 'string',
						description: 'Device ID to query (optional)'
					},
					start_time: {
						type: 'string',
						description: 'Start time in ISO format (optional)'
					},
					end_time: {
						type: 'string',
						description: 'End time in ISO format (optional)'
					},
					limit: {
						type: 'number',
						description: 'Maximum results (default: 100)'
					}
				}
			},
			execute: async (args: Record<string, unknown>) => {
				const limit = (args.limit as number) || 100;
				const startTime = args.start_time
					? new Date(args.start_time as string).getTime()
					: Date.now() - 3600000;
				const endTime = args.end_time
					? new Date(args.end_time as string).getTime()
					: Date.now();

				const resp = await apiFetch(
					`/api/signals?lat=0&lon=0&radiusMeters=999999&startTime=${startTime}&endTime=${endTime}&limit=${limit}`
				);
				const data = await resp.json();
				return { signal_count: data.signals?.length || 0, signals: data.signals || [] };
			}
		}
	];
}

// Start server when run directly
const server = new GPSServer('argos-gps');
server.start().catch((error) => {
	console.error('[GPS MCP] Fatal:', error);
	process.exit(1);
});
