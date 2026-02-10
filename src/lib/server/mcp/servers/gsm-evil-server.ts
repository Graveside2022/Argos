#!/usr/bin/env node
/**
 * GSM Evil MCP Server
 * Provides tools for GSM signal monitoring and IMSI detection
 */

import { config } from 'dotenv';
import { BaseMCPServer, type ToolDefinition } from '../shared/base-server';
import { apiFetch } from '../shared/api-client';

// Load .env for ARGOS_API_KEY
config();

class GSMEvilServer extends BaseMCPServer {
	protected tools: ToolDefinition[] = [
		{
			name: 'get_status',
			description:
				'Get GSM Evil service status and detected IMSI data. Returns monitoring state, captured identifiers, and GSMTAP pipeline health.',
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
			name: 'start_monitoring',
			description:
				'Start GSM Evil monitoring service. Acquires HackRF hardware, starts grgsm_livemon_headless and GsmEvil2 pipeline for IMSI/GSM packet capture.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					frequency: {
						type: 'string',
						description: 'GSM frequency in MHz (default: 947.2, range: 800-1000)'
					}
				}
			},
			execute: async (args: Record<string, unknown>) => {
				const resp = await apiFetch('/api/gsm-evil/control', {
					method: 'POST',
					body: JSON.stringify({
						action: 'start',
						frequency: args.frequency || '947.2'
					})
				});
				return await resp.json();
			}
		},
		{
			name: 'stop_monitoring',
			description:
				'Stop GSM Evil monitoring service. Gracefully terminates grgsm and GsmEvil processes, releases HackRF hardware resource.',
			inputSchema: {
				type: 'object' as const,
				properties: {}
			},
			execute: async () => {
				const resp = await apiFetch('/api/gsm-evil/control', {
					method: 'POST',
					body: JSON.stringify({ action: 'stop' })
				});
				return await resp.json();
			}
		},
		{
			name: 'scan_towers',
			description:
				'Perform intelligent GSM tower scan across frequency bands. Auto-detects active towers, measures signal strength, identifies MCC/MNC codes.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					band: {
						type: 'string',
						description: 'GSM band to scan: GSM900, DCS1800, or ALL',
						enum: ['GSM900', 'DCS1800', 'ALL']
					}
				}
			},
			execute: async (args: Record<string, unknown>) => {
				const resp = await apiFetch('/api/gsm-evil/scan', {
					method: 'POST',
					body: JSON.stringify({ band: args.band || 'ALL' })
				});
				return await resp.json();
			}
		},
		{
			name: 'get_imsi_data',
			description:
				'Get captured IMSI identifiers. Returns detected mobile subscriber identities with timestamps and associated tower information.',
			inputSchema: {
				type: 'object' as const,
				properties: {}
			},
			execute: async () => {
				const resp = await apiFetch('/api/gsm-evil/imsi-data');
				return await resp.json();
			}
		},
		{
			name: 'get_frames',
			description:
				'Get captured GSM frames from GSMTAP pipeline. Returns raw GSM layer 2/3 frames for protocol analysis and decoding.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					limit: {
						type: 'number',
						description: 'Maximum number of frames to return (default: 100)'
					}
				}
			},
			execute: async (args: Record<string, unknown>) => {
				const limit = (args.limit as number) || 100;
				const resp = await apiFetch(`/api/gsm-evil/frames?limit=${limit}`);
				return await resp.json();
			}
		},
		{
			name: 'get_activity',
			description:
				'Get recent GSM activity feed. Returns timeline of detected events: IMSI captures, tower changes, channel activity.',
			inputSchema: {
				type: 'object' as const,
				properties: {}
			},
			execute: async () => {
				const resp = await apiFetch('/api/gsm-evil/activity');
				return await resp.json();
			}
		}
	];
}

// Start server when run directly
const server = new GSMEvilServer('argos-gsm-evil');
server.start().catch((error) => {
	console.error('[GSM Evil MCP] Fatal:', error);
	process.exit(1);
});
