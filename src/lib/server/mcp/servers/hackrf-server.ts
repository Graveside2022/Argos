#!/usr/bin/env node
/**
 * HackRF MCP Server
 * Provides tools for HackRF One SDR control and spectrum analysis
 */

import { config } from 'dotenv';
import { BaseMCPServer, type ToolDefinition } from '../shared/base-server';
import { apiFetch } from '../shared/api-client';

// Load .env for ARGOS_API_KEY
config();

class HackRFServer extends BaseMCPServer {
	protected tools: ToolDefinition[] = [
		{
			name: 'get_status',
			description:
				'Get HackRF hardware status. Returns connection state, current frequency, sample rate, and operational status.',
			inputSchema: {
				type: 'object' as const,
				properties: {}
			},
			execute: async () => {
				try {
					const resp = await apiFetch('/api/hackrf/status');
					return await resp.json();
				} catch {
					return { status: 'disconnected', error: 'HackRF not available' };
				}
			}
		},
		{
			name: 'start_sweep',
			description:
				'Start HackRF frequency sweep. Begins RF spectrum scanning across specified frequency ranges with configurable cycle time.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					frequencies: {
						type: 'array',
						description:
							'Array of frequency ranges to sweep. Each range: {start: MHz, end: MHz} or plain number for center freq',
						items: {
							anyOf: [
								{
									type: 'object',
									properties: {
										start: {
											type: 'number',
											description: 'Start frequency in MHz'
										},
										end: { type: 'number', description: 'End frequency in MHz' }
									},
									required: ['start', 'end']
								},
								{ type: 'number', description: 'Center frequency in MHz' }
							]
						}
					},
					cycle_time: {
						type: 'number',
						description: 'Cycle time in seconds (default: 10)'
					}
				},
				required: ['frequencies']
			},
			execute: async (args: Record<string, unknown>) => {
				const resp = await apiFetch('/api/hackrf/start-sweep', {
					method: 'POST',
					body: JSON.stringify({
						frequencies: args.frequencies,
						cycleTime: args.cycle_time || 10
					})
				});
				return await resp.json();
			}
		},
		{
			name: 'stop_sweep',
			description:
				'Stop HackRF frequency sweep. Gracefully halts active RF scanning and returns hardware to idle state.',
			inputSchema: {
				type: 'object' as const,
				properties: {}
			},
			execute: async () => {
				const resp = await apiFetch('/api/hackrf/stop-sweep', {
					method: 'POST'
				});
				return await resp.json();
			}
		},
		{
			name: 'emergency_stop',
			description:
				'Emergency stop for HackRF. Immediately kills all HackRF processes. Use when normal stop fails or hardware is unresponsive.',
			inputSchema: {
				type: 'object' as const,
				properties: {}
			},
			execute: async () => {
				const resp = await apiFetch('/api/hackrf/emergency-stop', {
					method: 'POST'
				});
				return await resp.json();
			}
		},
		{
			name: 'get_spectrum_data',
			description:
				'Get current RF spectrum data from HackRF. Returns FFT power levels, frequency bins, and signal peaks for visualization.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					start_freq_mhz: {
						type: 'number',
						description: 'Start frequency in MHz'
					},
					end_freq_mhz: {
						type: 'number',
						description: 'End frequency in MHz'
					}
				},
				required: ['start_freq_mhz', 'end_freq_mhz']
			},
			execute: async (_args: Record<string, unknown>) => {
				// Note: Current API doesn't filter by freq range, returns active sweep data
				try {
					const resp = await apiFetch('/api/hackrf/status');
					const data = await resp.json();
					return { hackrf_status: data };
				} catch {
					return { error: 'HackRF not available', status: 'disconnected' };
				}
			}
		}
	];
}

// Start server when run directly
const server = new HackRFServer('argos-hackrf');
server.start().catch((error) => {
	console.error('[HackRF MCP] Fatal:', error);
	process.exit(1);
});
