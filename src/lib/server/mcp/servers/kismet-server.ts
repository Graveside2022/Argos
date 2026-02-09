#!/usr/bin/env node
/**
 * Kismet MCP Server
 * Provides tools for WiFi scanning and device tracking via Kismet
 */

import { config } from 'dotenv';
import { BaseMCPServer, type ToolDefinition } from '../shared/base-server';
import { apiFetch } from '../shared/api-client';

// Load .env for ARGOS_API_KEY
config();

class KismetServer extends BaseMCPServer {
	protected tools: ToolDefinition[] = [
		{
			name: 'get_status',
			description:
				'Get Kismet WiFi scanner service status. Returns running state, device count, interface, and uptime.',
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
			name: 'start_service',
			description:
				'Start Kismet WiFi scanning service. Detects ALFA adapter, sets up monitor mode, and begins WiFi network discovery.',
			inputSchema: {
				type: 'object' as const,
				properties: {}
			},
			execute: async () => {
				const resp = await apiFetch('/api/kismet/control', {
					method: 'POST',
					body: JSON.stringify({ action: 'start' })
				});
				return await resp.json();
			}
		},
		{
			name: 'stop_service',
			description:
				'Stop Kismet WiFi scanning service. Gracefully terminates scanner and cleans up monitor mode interfaces.',
			inputSchema: {
				type: 'object' as const,
				properties: {}
			},
			execute: async () => {
				const resp = await apiFetch('/api/kismet/control', {
					method: 'POST',
					body: JSON.stringify({ action: 'stop' })
				});
				return await resp.json();
			}
		},
		{
			name: 'get_devices',
			description:
				'Get all currently active WiFi devices detected by Kismet. Returns MAC addresses, SSIDs, signal strengths, encryption, manufacturers, and locations.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					filter_type: {
						type: 'string',
						description:
							'Filter by device type: "wifi", "bluetooth", "cellular", or "all"',
						enum: ['wifi', 'bluetooth', 'cellular', 'all']
					},
					min_signal_strength: {
						type: 'number',
						description: 'Minimum signal strength in dBm (default: -90)'
					}
				}
			},
			execute: async (args: Record<string, unknown>) => {
				const resp = await apiFetch('/api/kismet/devices');
				const data = await resp.json();
				let devices = data.devices || [];

				// Apply filters
				const minSignal = (args.min_signal_strength as number) ?? -90;
				devices = devices.filter((d: any) => {
					const sig = d.signalStrength ?? d.signal?.last_signal ?? -100;
					return sig >= minSignal;
				});

				const filterType = (args.filter_type as string) || 'all';
				if (filterType !== 'all') {
					devices = devices.filter((d: any) => {
						const type = (d.type || d.deviceType || 'wifi').toLowerCase();
						return type.includes(filterType);
					});
				}

				return {
					device_count: devices.length,
					source: data.source || 'kismet',
					devices: devices.slice(0, 50).map((d: any) => ({
						mac: d.mac || d.macaddr || 'unknown',
						ssid: d.ssid || d.name || 'Unknown',
						signal_dbm: d.signalStrength ?? d.signal?.last_signal ?? null,
						manufacturer: d.manufacturer || d.manuf || 'Unknown',
						type: d.type || d.deviceType || 'wifi',
						encryption: d.encryption || d.crypt || 'Unknown',
						channel: d.channel || null,
						frequency: d.frequency || null,
						packets: d.packets || d.dataPackets || 0,
						last_seen: d.lastSeen || d.last_time || null,
						location: d.location || null
					}))
				};
			}
		},
		{
			name: 'get_device_details',
			description:
				'Get detailed information about a specific WiFi device by MAC address or SSID name. Returns full device profile with signal history, encryption details, and location data.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					device_id: {
						type: 'string',
						description:
							'Device name or MAC address (e.g., "ARRIS-0DC8", "00:11:22:33:44:55")'
					}
				},
				required: ['device_id']
			},
			execute: async (args: Record<string, unknown>) => {
				const deviceId = (args.device_id as string) || '';
				const resp = await apiFetch('/api/kismet/devices');
				const data = await resp.json();
				const devices = data.devices || [];

				const searchLower = deviceId.toLowerCase();
				const match = devices.find((d: any) => {
					const mac = (d.mac || d.macaddr || '').toLowerCase();
					const ssid = (d.ssid || d.name || '').toLowerCase();
					return mac.includes(searchLower) || ssid.includes(searchLower);
				});

				if (!match) {
					return {
						found: false,
						message: `Device "${deviceId}" not found in ${devices.length} active devices`
					};
				}

				return {
					found: true,
					mac: match.mac || match.macaddr,
					ssid: match.ssid || match.name || 'Unknown',
					signal_dbm: match.signalStrength ?? match.signal?.last_signal ?? null,
					manufacturer: match.manufacturer || match.manuf || 'Unknown',
					type: match.type || match.deviceType || 'wifi',
					encryption: match.encryption || match.crypt || 'Unknown',
					channel: match.channel || null,
					frequency: match.frequency || null,
					packets: match.packets || match.dataPackets || 0,
					last_seen: match.lastSeen || match.last_time || null,
					location: match.location || null,
					first_seen: match.firstSeen || match.first_time || null
				};
			}
		},
		{
			name: 'analyze_security',
			description:
				'Analyze WiFi network security configuration. Returns encryption type, security assessment (CRITICAL/HIGH/MEDIUM/LOW risk), and recommendations for detected networks.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					network_id: {
						type: 'string',
						description: 'Network SSID or BSSID to analyze'
					}
				},
				required: ['network_id']
			},
			execute: async (args: Record<string, unknown>) => {
				const networkId = (args.network_id as string) || '';
				const resp = await apiFetch('/api/kismet/devices');
				const data = await resp.json();
				const devices = data.devices || [];

				const searchLower = networkId.toLowerCase();
				const matches = devices.filter((d: any) => {
					const mac = (d.mac || d.macaddr || '').toLowerCase();
					const ssid = (d.ssid || d.name || '').toLowerCase();
					return mac.includes(searchLower) || ssid.includes(searchLower);
				});

				if (matches.length === 0) {
					return { found: false, message: `Network "${networkId}" not found` };
				}

				return {
					found: true,
					network_count: matches.length,
					networks: matches.map((d: any) => {
						const encryption = (d.encryption || d.crypt || 'None').toUpperCase();
						const isOpen = encryption === 'NONE' || encryption === 'OPEN';
						const isWEP = encryption.includes('WEP');
						const isWPA3 = encryption.includes('WPA3') || encryption.includes('SAE');

						let risk = 'LOW';
						let recommendation = 'Network uses strong encryption';
						if (isOpen) {
							risk = 'CRITICAL';
							recommendation =
								'OPEN NETWORK - No encryption. All traffic visible. Potential evil twin or honeypot.';
						} else if (isWEP) {
							risk = 'HIGH';
							recommendation =
								'WEP encryption is broken. Can be cracked in minutes. Upgrade to WPA3.';
						} else if (!isWPA3 && encryption.includes('WPA2')) {
							risk = 'MEDIUM';
							recommendation =
								'WPA2 is adequate but WPA3 is recommended. Check for KRACK vulnerability.';
						}

						return {
							ssid: d.ssid || d.name || 'Hidden',
							mac: d.mac || d.macaddr,
							encryption,
							risk,
							recommendation,
							signal_dbm: d.signalStrength ?? d.signal?.last_signal ?? null,
							channel: d.channel || null
						};
					})
				};
			}
		}
	];
}

// Start server when run directly
const server = new KismetServer('argos-kismet');
server.start().catch((error) => {
	console.error('[Kismet MCP] Fatal:', error);
	process.exit(1);
});
