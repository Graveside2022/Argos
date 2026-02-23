/**
 * MCP tool definitions for device and signal analysis.
 *
 * Contains the first group of Argos MCP tools: WiFi device discovery,
 * device details, nearby signals, network security analysis, spectrum
 * data, and cell tower lookup. Each tool maps to an Argos HTTP API endpoint.
 */

import type { ApiFetchFn, ArgosTool, KismetDevice } from './dynamic-server-types';

/** Get device signal strength with fallback chain. */
function deviceSignal(d: KismetDevice): number | null {
	return d.signalStrength ?? d.signal?.last_signal ?? null;
}

/** Get device MAC with fallback. */
function deviceMac(d: KismetDevice): string {
	return d.mac || d.macaddr || 'unknown';
}

/** Get device SSID with fallback. */
function deviceSsid(d: KismetDevice): string {
	return d.ssid || d.name || 'Unknown';
}

/** Get device manufacturer with fallback. */
function deviceManuf(d: KismetDevice): string {
	return d.manufacturer || d.manuf || 'Unknown';
}

/** Get device type with fallback. */
function deviceType(d: KismetDevice): string {
	return d.type || d.deviceType || 'wifi';
}

/** Get device encryption with fallback. */
function deviceEncryption(d: KismetDevice): string {
	return d.encryption || d.crypt || 'Unknown';
}

/** Get device packet count with fallback. */
function devicePackets(d: KismetDevice): number {
	return d.packets || d.dataPackets || 0;
}

/** Get device last seen timestamp with fallback. */
function deviceLastSeen(d: KismetDevice): string | null {
	return d.lastSeen || d.last_time || null;
}

/** Normalize a KismetDevice to a summary object. */
function normalizeDevice(d: KismetDevice): Record<string, unknown> {
	return {
		mac: deviceMac(d),
		ssid: deviceSsid(d),
		signal_dbm: deviceSignal(d),
		manufacturer: deviceManuf(d),
		type: deviceType(d),
		encryption: deviceEncryption(d),
		channel: d.channel ?? null,
		frequency: d.frequency ?? null,
		packets: devicePackets(d),
		last_seen: deviceLastSeen(d),
		location: d.location ?? null
	};
}

/** Filter devices by minimum signal strength. */
function filterBySignal(devices: KismetDevice[], minSignal: number): KismetDevice[] {
	return devices.filter((d) => (deviceSignal(d) ?? -100) >= minSignal);
}

/** Filter devices by type. */
function filterByType(devices: KismetDevice[], filterType: string): KismetDevice[] {
	if (filterType === 'all') return devices;
	return devices.filter((d) =>
		(d.type || d.deviceType || 'wifi').toLowerCase().includes(filterType)
	);
}

/** Find device by MAC or SSID search string. */
function findDevice(devices: KismetDevice[], searchLower: string): KismetDevice | undefined {
	return devices.find((d) => {
		const mac = deviceMac(d).toLowerCase();
		const ssid = deviceSsid(d).toLowerCase();
		return mac.includes(searchLower) || ssid.includes(searchLower);
	});
}

/** Filter devices matching MAC or SSID search string. */
function filterDevices(devices: KismetDevice[], searchLower: string): KismetDevice[] {
	return devices.filter((d) => {
		const mac = deviceMac(d).toLowerCase();
		const ssid = deviceSsid(d).toLowerCase();
		return mac.includes(searchLower) || ssid.includes(searchLower);
	});
}

interface RiskAssessment {
	risk: string;
	recommendation: string;
}

/** Check if encryption indicates an open network. */
function isOpenNetwork(upper: string): boolean {
	return upper === 'NONE' || upper === 'OPEN';
}

/** Check if encryption indicates WPA3/SAE. */
function isWpa3(upper: string): boolean {
	return upper.includes('WPA3') || upper.includes('SAE');
}

/** Classify encryption risk level. */
function classifyEncryptionRisk(encryption: string): RiskAssessment {
	const upper = encryption.toUpperCase();
	if (isOpenNetwork(upper)) {
		return {
			risk: 'CRITICAL',
			recommendation:
				'OPEN NETWORK - No encryption. All traffic visible. Potential evil twin or honeypot.'
		};
	}
	if (upper.includes('WEP')) {
		return {
			risk: 'HIGH',
			recommendation: 'WEP encryption is broken. Can be cracked in minutes. Upgrade to WPA3.'
		};
	}
	if (!isWpa3(upper) && upper.includes('WPA2')) {
		return {
			risk: 'MEDIUM',
			recommendation:
				'WPA2 is adequate but WPA3 is recommended. Check for KRACK vulnerability.'
		};
	}
	return { risk: 'LOW', recommendation: 'Network uses strong encryption' };
}

/** Build network security summary for a device. */
function buildNetworkSecurity(d: KismetDevice): Record<string, unknown> {
	const encryption = d.encryption || d.crypt || 'None';
	const { risk, recommendation } = classifyEncryptionRisk(encryption);
	return {
		ssid: deviceSsid(d),
		mac: deviceMac(d),
		encryption: encryption.toUpperCase(),
		risk,
		recommendation,
		signal_dbm: deviceSignal(d),
		channel: d.channel || null
	};
}

/** Build detailed device info. */
function buildDeviceDetails(d: KismetDevice): Record<string, unknown> {
	return {
		found: true,
		...normalizeDevice(d),
		first_seen: d.firstSeen || d.first_time || null
	};
}

/** Count towers from API response. */
function countTowers(data: Record<string, unknown>): number {
	return (data.count as number) || (data.towers as unknown[] | undefined)?.length || 0;
}

/** Extract numeric arg with default. */
function numArg(args: Record<string, unknown>, key: string, def: number): number {
	return (args[key] as number) ?? def;
}

/** Check if coordinates are missing (both zero). */
function isMissingCoords(lat: number, lon: number): boolean {
	return lat === 0 && lon === 0;
}

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
				const minSignal = (args.min_signal_strength as number) ?? -90;
				const filterType = (args.filter_type as string) || 'all';
				const filtered = filterByType(
					filterBySignal(data.devices || [], minSignal),
					filterType
				);

				return {
					device_count: filtered.length,
					source: data.source || 'kismet',
					devices: filtered.slice(0, 50).map(normalizeDevice)
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
				const match = findDevice(devices, deviceId.toLowerCase());

				if (!match) {
					return {
						found: false,
						message: `Device "${deviceId}" not found in ${devices.length} active devices`
					};
				}
				return buildDeviceDetails(match);
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
				const networkId = (args.network_id as string) || '';
				const resp = await apiFetch('/api/kismet/devices');
				const data = await resp.json();
				const matches = filterDevices(data.devices || [], networkId.toLowerCase());

				if (matches.length === 0) {
					return { found: false, message: `Network "${networkId}" not found` };
				}

				return {
					found: true,
					network_count: matches.length,
					networks: matches.map(buildNetworkSecurity)
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
				const lat = numArg(args, 'latitude', 0);
				const lon = numArg(args, 'longitude', 0);
				if (isMissingCoords(lat, lon)) {
					return {
						error: 'No GPS position provided. Pass latitude and longitude parameters.'
					};
				}
				const radius = numArg(args, 'radius_km', 5);
				const resp = await apiFetch(
					`/api/cell-towers/nearby?lat=${lat}&lon=${lon}&radius=${radius}`
				);
				const data = await resp.json();
				return {
					success: data.success,
					source: data.source,
					tower_count: countTowers(data),
					towers: ((data.towers as unknown[]) ?? []).slice(0, 20)
				};
			}
		}
	];
}
