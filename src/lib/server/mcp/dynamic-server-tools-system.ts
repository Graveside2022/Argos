/**
 * MCP tool definitions for system status and hardware scanning.
 *
 * Contains the second group of Argos MCP tools: signal history queries,
 * system stats, Kismet status, GSM status, installed tool scanning,
 * and hardware scanning. Each tool maps to an Argos HTTP API endpoint.
 */

import type { ApiFetchFn, ArgosTool, ToolScanEntry } from './dynamic-server-types';

/**
 * System status and hardware scanning MCP tools.
 *
 * Includes: query_signal_history, get_system_stats, get_kismet_status,
 * get_gsm_status, scan_installed_tools, scan_hardware.
 */
export function createSystemTools(apiFetch: ApiFetchFn): ArgosTool[] {
	return [
		{
			name: 'query_signal_history',
			description:
				'Query historical signal data from the database. Track signal patterns over time for a device or frequency range.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					device_id: { type: 'string', description: 'Device ID to query (optional)' },
					start_time: {
						type: 'string',
						description: 'Start time in ISO format (optional)'
					},
					end_time: { type: 'string', description: 'End time in ISO format (optional)' },
					limit: { type: 'number', description: 'Maximum results (default: 100)' }
				}
			},
			execute: async (args: Record<string, unknown>) => {
				// Safe: MCP SDK validates args against inputSchema before execute() is called
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
		},
		{
			name: 'get_system_stats',
			description:
				'Get Argos system statistics: CPU usage, memory usage, hostname, uptime. Useful for monitoring system health.',
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
			name: 'get_kismet_status',
			description:
				'Get Kismet WiFi scanner service status: running state, device count, interface, uptime.',
			inputSchema: {
				type: 'object' as const,
				properties: {}
			},
			execute: async () => {
				try {
					const resp = await apiFetch('/api/kismet/status');
					return await resp.json();
				} catch {
					return { status: 'disconnected', error: 'Kismet not available' };
				}
			}
		},
		{
			name: 'get_gsm_status',
			description:
				'Get GSM Evil service status and detected IMSI data. Shows GSM monitoring state and captured identifiers.',
			inputSchema: {
				type: 'object' as const,
				properties: {}
			},
			execute: async () => {
				try {
					const [statusResp, imsiResp] = await Promise.all([
						apiFetch('/api/gsm-evil/status'),
						apiFetch('/api/gsm-evil/imsi-data')
					]);
					const status = await statusResp.json();
					const imsi = await imsiResp.json();
					return { ...status, imsi_data: imsi };
				} catch {
					return { status: 'disconnected', error: 'GSM Evil not available' };
				}
			}
		},
		{
			name: 'scan_installed_tools',
			description:
				'Scan system for all 90+ OFFNET/ONNET tools and their installation status. Detects Docker containers, native binaries, and systemd services. Returns installed tools with deployment type (docker/native/service). Run this to discover what RF/network analysis capabilities are available.',
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
				const tools: Record<string, ToolScanEntry> = data.tools || {};
				const entries = Object.entries(tools);

				const installed = entries
					.filter(([_, t]: [string, ToolScanEntry]) => t.installed)
					.map(([id, t]: [string, ToolScanEntry]) => ({
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
						.filter(([_, t]: [string, ToolScanEntry]) => !t.installed)
						.map(([id]: [string, ToolScanEntry]) => id);
					result.not_installed_count = notInstalled.length;
					result.not_installed = notInstalled;
				}

				return result;
			}
		},
		{
			name: 'scan_hardware',
			description:
				'Scan for all connected hardware: SDR devices (HackRF, RTL-SDR, USRP), WiFi adapters (ALFA), Bluetooth, GPS modules, cellular modems, serial devices. Returns categories, connection types, capabilities, and compatible tools. Detects USB, serial, and network-attached hardware.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					category: {
						type: 'string',
						description:
							'Filter by category: sdr, wifi, bluetooth, gps, cellular, serial, network',
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

				// Safe: MCP SDK validates args against inputSchema before execute() is called
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
		}
	];
}
