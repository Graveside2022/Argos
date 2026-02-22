/**
 * MCP tool definitions for device and signal analysis.
 *
 * Contains the first group of Argos MCP tools: WiFi device discovery,
 * device details, nearby signals, network security analysis, spectrum
 * data, and cell tower lookup. Each tool maps to an Argos HTTP API endpoint.
 */

import type { ApiFetchFn, ArgosTool, KismetDevice } from './dynamic-server-types';

/**
 * Device and signal analysis MCP tools.
 *
 * Includes: get_active_devices, get_device_details, get_nearby_signals,
 * analyze_network_security, get_spectrum_data, get_cell_towers.
 */
export function createDeviceTools(apiFetch: ApiFetchFn): ArgosTool[] {
	return [
		{
			name: 'get_active_devices',
			description:
				'Get all currently active WiFi devices within detection range. Returns devices with signal strength, MAC address, SSID, manufacturer, encryption, and location.',
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
				let devices: KismetDevice[] = data.devices || [];

				// Safe: MCP SDK validates args against inputSchema before execute() is called
				const minSignal = (args.min_signal_strength as number) ?? -90;
				devices = devices.filter((d: KismetDevice) => {
					const sig = d.signalStrength ?? d.signal?.last_signal ?? -100;
					return sig >= minSignal;
				});

				// Safe: MCP SDK validates args against inputSchema before execute() is called
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
				// Safe: MCP SDK validates args against inputSchema (required: device_id) before execute() is called
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
				// Safe: MCP SDK validates args against inputSchema (required: latitude, longitude) before execute() is called
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
				// Safe: MCP SDK validates args against inputSchema (required: network_id) before execute() is called
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
				// Safe: MCP SDK validates args against inputSchema before execute() is called
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
		}
	];
}
