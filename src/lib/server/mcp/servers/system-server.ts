#!/usr/bin/env node
/**
 * System MCP Server
 * Provides tools for system monitoring, hardware scanning, and infrastructure diagnostics
 */

import { config } from 'dotenv';
import { BaseMCPServer, type ToolDefinition } from '../shared/base-server';
import { apiFetch } from '../shared/api-client';

// Load .env for ARGOS_API_KEY
config();

class SystemServer extends BaseMCPServer {
	protected tools: ToolDefinition[] = [
		{
			name: 'get_stats',
			description:
				'Get Argos system statistics. Returns CPU usage, memory usage, hostname, uptime, and process health. Useful for monitoring RPi5 resource consumption.',
			inputSchema: {
				type: 'object' as const,
				properties: {}
			},
			execute: async () => {
				const resp = await apiFetch('/api/system/stats');
				return await resp.json();
			}
		},
		{
			name: 'scan_hardware',
			description:
				'Scan for all connected RF/network hardware. Detects SDR devices (HackRF, RTL-SDR, USRP), WiFi adapters (ALFA), Bluetooth, GPS modules, cellular modems, serial devices. Returns USB/serial/network-attached devices with capabilities and compatible tools.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					category: {
						type: 'string',
						description:
							'Filter by category: sdr, wifi, bluetooth, gps, cellular, serial, network, all',
						enum: [
							'sdr',
							'wifi',
							'bluetooth',
							'gps',
							'cellular',
							'serial',
							'network',
							'all'
						]
					}
				}
			},
			execute: async (args: Record<string, unknown>) => {
				const resp = await apiFetch('/api/hardware/scan');
				const data = await resp.json();

				if (!data.success) {
					return { error: data.error || 'Hardware scan failed' };
				}

				const filterCategory = (args.category as string) || 'all';
				let hardware = data.hardware || {};

				if (filterCategory !== 'all') {
					hardware = { [filterCategory]: hardware[filterCategory] || [] };
				}

				return {
					stats: data.stats,
					hardware
				};
			}
		},
		{
			name: 'scan_installed_tools',
			description:
				'Scan system for all 90+ OFFNET/ONNET RF tools. Detects Docker containers, native binaries, and systemd services. Returns installed tools with deployment type (docker/native/service). Use this to discover available tactical capabilities.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					installed_only: {
						type: 'boolean',
						description: 'Only return installed tools (default: true)'
					}
				}
			},
			execute: async (args: Record<string, unknown>) => {
				const resp = await apiFetch('/api/tools/scan');
				const data = await resp.json();

				if (!data.success) {
					return { error: data.error || 'Tool scan failed' };
				}

				const installedOnly = args.installed_only !== false;
				const tools = data.tools || {};
				const entries = Object.entries(tools);

				const installed = entries
					.filter(([_, t]: [string, any]) => t.installed)
					.map(([id, t]: [string, any]) => ({
						id,
						deployment: t.deployment,
						binary: t.binary?.path || null,
						container: t.container?.name || null,
						service: t.service?.name || null
					}));

				const result: Record<string, unknown> = {
					stats: data.stats,
					installed_count: installed.length,
					installed
				};

				if (!installedOnly) {
					const notInstalled = entries
						.filter(([_, t]: [string, any]) => !t.installed)
						.map(([id]: [string, any]) => id);
					result.not_installed_count = notInstalled.length;
					result.not_installed = notInstalled;
				}

				return result;
			}
		},
		{
			name: 'get_cell_towers',
			description:
				'Get nearby cell towers from OpenCellID database. Returns tower locations, radio types (LTE/GSM/UMTS), MCC/MNC codes, LAC, cell IDs, and estimated signal strength.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					latitude: {
						type: 'number',
						description: 'Latitude (uses current GPS position if not provided)'
					},
					longitude: {
						type: 'number',
						description: 'Longitude (uses current GPS position if not provided)'
					},
					radius_km: {
						type: 'number',
						description: 'Search radius in kilometers (default: 5)'
					}
				}
			},
			execute: async (args: Record<string, unknown>) => {
				const lat = (args.latitude as number) || 0;
				const lon = (args.longitude as number) || 0;
				const radius = (args.radius_km as number) || 5;

				if (lat === 0 && lon === 0) {
					return {
						error: 'No GPS position provided. Pass latitude and longitude parameters or ensure GPS has a fix.'
					};
				}

				const resp = await apiFetch(
					`/api/cell-towers/nearby?lat=${lat}&lon=${lon}&radius=${radius}`
				);
				const data = await resp.json();
				return {
					success: data.success,
					source: data.source,
					tower_count: data.count || data.towers?.length || 0,
					towers: (data.towers || []).slice(0, 20)
				};
			}
		}
	];
}

// Start server when run directly
const server = new SystemServer('argos-system');
server.start().catch((error) => {
	console.error('[System MCP] Fatal:', error);
	process.exit(1);
});
