/**
 * Dynamic Argos MCP Server
 * Exposes Argos tools to Claude Code via Model Context Protocol
 *
 * This runs as a standalone process (via npx tsx), so it communicates
 * with the running Argos app via HTTP API calls to localhost:5173.
 */

/* eslint-disable no-undef */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ListResourcesRequestSchema,
	ListToolsRequestSchema,
	ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { config } from 'dotenv';

// Load .env for ARGOS_API_KEY (standalone process, not SvelteKit)
config();

const ARGOS_API = process.env.ARGOS_API_URL || 'http://localhost:5173';

// Type definitions for Kismet device data (dynamic properties from API)
interface KismetDevice {
	mac?: string;
	macaddr?: string;
	ssid?: string;
	name?: string;
	signalStrength?: number;
	signal?: {
		last_signal?: number;
	};
	manufacturer?: string;
	manuf?: string;
	type?: string;
	deviceType?: string;
	encryption?: string;
	crypt?: string;
	channel?: number;
	frequency?: number;
	packets?: number;
	dataPackets?: number;
	lastSeen?: string;
	last_time?: string;
	firstSeen?: string;
	first_time?: string;
	location?: unknown;
}

interface ToolScanEntry {
	installed: boolean;
	deployment?: string;
	binary?: {
		path?: string;
	};
	container?: {
		name?: string;
	};
	service?: {
		name?: string;
	};
}

/**
 * MCP Tool definitions — matches argosTools in tools.ts
 * Each tool maps to an Argos HTTP API endpoint
 */
const ARGOS_TOOLS = [
	{
		name: 'get_active_devices',
		description:
			'Get all currently active WiFi devices within detection range. Returns devices with signal strength, MAC address, SSID, manufacturer, encryption, and location.',
		inputSchema: {
			type: 'object' as const,
			properties: {
				filter_type: {
					type: 'string',
					description: 'Filter by device type: "wifi", "bluetooth", "cellular", or "all"',
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
			let devices: KismetDevice[] = data.devices || [];

			// Apply filters
			const minSignal = (args.min_signal_strength as number) ?? -90;
			devices = devices.filter((d: KismetDevice) => {
				const sig = d.signalStrength ?? d.signal?.last_signal ?? -100;
				return sig >= minSignal;
			});

			const filterType = (args.filter_type as string) || 'all';
			if (filterType !== 'all') {
				devices = devices.filter((d: KismetDevice) => {
					const type = (d.type || d.deviceType || 'wifi').toLowerCase();
					return type.includes(filterType);
				});
			}

			return {
				device_count: devices.length,
				source: data.source || 'kismet',
				devices: devices.slice(0, 50).map((d: KismetDevice) => ({
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
			'Get detailed information about a specific WiFi device by MAC address or name. Returns signal, encryption, manufacturer, packets, and location data.',
		inputSchema: {
			type: 'object' as const,
			properties: {
				device_id: {
					type: 'string',
					description:
						'The device name or MAC address (e.g., "ARRIS-0DC8", "00:11:22:33:44:55")'
				}
			},
			required: ['device_id']
		},
		execute: async (args: Record<string, unknown>) => {
			const deviceId = (args.device_id as string) || '';
			const resp = await apiFetch('/api/kismet/devices');
			const data = await resp.json();
			const devices: KismetDevice[] = data.devices || [];

			const searchLower = deviceId.toLowerCase();
			const match = devices.find((d: KismetDevice) => {
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
		name: 'get_nearby_signals',
		description:
			'Get RF signals detected near a specific GPS location from the signal database. Returns signal strength, frequency, and type.',
		inputSchema: {
			type: 'object' as const,
			properties: {
				latitude: { type: 'number', description: 'Latitude coordinate' },
				longitude: { type: 'number', description: 'Longitude coordinate' },
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
		name: 'analyze_network_security',
		description:
			'Analyze the security configuration of a WiFi network. Returns encryption type, cipher, authentication method, and security assessment.',
		inputSchema: {
			type: 'object' as const,
			properties: {
				network_id: { type: 'string', description: 'The network SSID or BSSID' }
			},
			required: ['network_id']
		},
		execute: async (args: Record<string, unknown>) => {
			const networkId = (args.network_id as string) || '';
			const resp = await apiFetch('/api/kismet/devices');
			const data = await resp.json();
			const devices: KismetDevice[] = data.devices || [];

			const searchLower = networkId.toLowerCase();
			const matches = devices.filter((d: KismetDevice) => {
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
				networks: matches.map((d: KismetDevice) => {
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
	},
	{
		name: 'get_spectrum_data',
		description:
			'Get current RF spectrum/HackRF status and data. Returns sweep status, frequency range, and signal levels.',
		inputSchema: {
			type: 'object' as const,
			properties: {
				start_freq_mhz: { type: 'number', description: 'Start frequency in MHz' },
				end_freq_mhz: { type: 'number', description: 'End frequency in MHz' }
			},
			required: ['start_freq_mhz', 'end_freq_mhz']
		},
		execute: async (_args: Record<string, unknown>) => {
			try {
				const resp = await apiFetch('/api/hackrf/status');
				const data = await resp.json();
				return { hackrf_status: data };
			} catch {
				return { error: 'HackRF not available', status: 'disconnected' };
			}
		}
	},
	{
		name: 'get_cell_towers',
		description:
			'Get nearby cell towers from OpenCellID database. Returns tower radio type, MCC/MNC, LAC, cell ID, location, and signal strength.',
		inputSchema: {
			type: 'object' as const,
			properties: {
				latitude: {
					type: 'number',
					description: 'Latitude (uses current position if not provided)'
				},
				longitude: {
					type: 'number',
					description: 'Longitude (uses current position if not provided)'
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
					error: 'No GPS position provided. Pass latitude and longitude parameters.'
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
	},
	{
		name: 'query_signal_history',
		description:
			'Query historical signal data from the database. Track signal patterns over time for a device or frequency range.',
		inputSchema: {
			type: 'object' as const,
			properties: {
				device_id: { type: 'string', description: 'Device ID to query (optional)' },
				start_time: { type: 'string', description: 'Start time in ISO format (optional)' },
				end_time: { type: 'string', description: 'End time in ISO format (optional)' },
				limit: { type: 'number', description: 'Maximum results (default: 100)' }
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

/**
 * Fetch helper with timeout and error handling
 */
async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
	const url = `${ARGOS_API}${path}`;
	const apiKey = process.env.ARGOS_API_KEY || '';
	const resp = await fetch(url, {
		...options,
		signal: AbortSignal.timeout(15000),
		headers: {
			'Content-Type': 'application/json',
			...(apiKey ? { 'X-API-Key': apiKey } : {}),
			...options?.headers
		}
	});
	if (!resp.ok) {
		throw new Error(`Argos API error: ${resp.status} ${resp.statusText} for ${path}`);
	}
	return resp;
}

/**
 * Argos MCP Server
 */
export class ArgosMCPServer {
	private server: Server;

	constructor() {
		this.server = new Server(
			{ name: 'argos-tools', version: '1.0.0' },
			{ capabilities: { tools: {}, resources: {} } }
		);
		this.setupHandlers();
	}

	private setupHandlers(): void {
		// List tools
		this.server.setRequestHandler(ListToolsRequestSchema, async () => {
			return {
				tools: ARGOS_TOOLS.map(({ name, description, inputSchema }) => ({
					name,
					description,
					inputSchema
				}))
			};
		});

		// Execute tool
		this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
			const { name, arguments: args } = request.params;
			const tool = ARGOS_TOOLS.find((t) => t.name === name);

			if (!tool) {
				return {
					content: [{ type: 'text', text: `Error: Unknown tool "${name}"` }],
					isError: true
				};
			}

			try {
				const result = await tool.execute(args || {});
				return {
					content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
				};
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);

				// Check if Argos app is running
				if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
					return {
						content: [
							{
								type: 'text',
								text: `Error: Cannot reach Argos at ${ARGOS_API}. Is the Argos dev server running? (npm run dev)`
							}
						],
						isError: true
					};
				}

				return {
					content: [{ type: 'text', text: `Error executing ${name}: ${msg}` }],
					isError: true
				};
			}
		});

		// List resources
		this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
			return {
				resources: [
					{
						uri: 'argos://system/status',
						name: 'System Status',
						description: 'Current Argos system status (CPU, memory, uptime)',
						mimeType: 'application/json'
					},
					{
						uri: 'argos://kismet/status',
						name: 'Kismet Status',
						description: 'WiFi scanner service status',
						mimeType: 'application/json'
					},
					{
						uri: 'argos://devices/active',
						name: 'Active Devices',
						description: 'Currently detected WiFi devices',
						mimeType: 'application/json'
					}
				]
			};
		});

		// Read resource
		this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
			const { uri } = request.params;

			try {
				let data: unknown;
				if (uri === 'argos://system/status') {
					const resp = await apiFetch('/api/system/stats');
					data = await resp.json();
				} else if (uri === 'argos://kismet/status') {
					const resp = await apiFetch('/api/kismet/status');
					data = await resp.json();
				} else if (uri === 'argos://devices/active') {
					const resp = await apiFetch('/api/kismet/devices');
					data = await resp.json();
				} else {
					return {
						contents: [
							{ uri, mimeType: 'text/plain', text: `Unknown resource: ${uri}` }
						]
					};
				}

				return {
					contents: [
						{ uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }
					]
				};
			} catch (error) {
				return {
					contents: [
						{
							uri,
							mimeType: 'text/plain',
							text: `Error: ${error instanceof Error ? error.message : String(error)}`
						}
					]
				};
			}
		});
	}

	async start(): Promise<void> {
		console.error(`[ArgosMCP] Starting with ${ARGOS_TOOLS.length} tools`);
		console.error(`[ArgosMCP] Argos API: ${ARGOS_API}`);
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
		console.error('[ArgosMCP] Server ready');
	}

	async stop(): Promise<void> {
		await this.server.close();
	}
}

// Start server when run directly
const server = new ArgosMCPServer();
server.start().catch((error) => {
	console.error('[ArgosMCP] Fatal:', error);
	process.exit(1);
});
