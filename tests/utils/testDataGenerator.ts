// Define Signal types locally for testing
interface Signal {
	id: string;
	timestamp: number;
	latitude: number;
	longitude: number;
	strength: number;
	frequency: number;
	metadata: Record<string, string | number | boolean>;
}

interface DroneSignal extends Signal {
	flightPattern?: string;
	controlFreq?: number;
}

export interface SignalOptions {
	area?: 'urban' | 'suburban' | 'rural' | 'stadium';
	timeSpan?: number; // milliseconds
	timeOffset?: number; // milliseconds from now
	density?: 'low' | 'medium' | 'high' | 'very-high';
}

export interface DroneOptions {
	patterns?: Array<'surveillance' | 'delivery' | 'racing' | 'media' | 'inspection'>;
	timeSpan?: number;
	timeOffset?: number;
}

export class TestDataGenerator {
	private seedCounter = 0;

	generateWiFiSignals(count: number, options: SignalOptions = {}): Signal[] {
		const signals: Signal[] = [];
		const centerLat = this.getAreaCenter(options.area).lat;
		const centerLon = this.getAreaCenter(options.area).lon;
		const spread = this.getAreaSpread(options.area);
		const timeSpan = options.timeSpan || 3600000; // 1 hour default
		const timeOffset = options.timeOffset || 0;
		const startTime = Date.now() - timeSpan + timeOffset;

		for (let i = 0; i < count; i++) {
			signals.push({
				id: `wifi_${this.seedCounter++}`,
				timestamp: startTime + Math.random() * timeSpan,
				latitude: centerLat + (Math.random() - 0.5) * spread,
				longitude: centerLon + (Math.random() - 0.5) * spread,
				strength: -30 - Math.random() * 60, // -30 to -90 dBm
				frequency: this.getWiFiFrequency(),
				metadata: {
					type: 'wifi',
					ssid: `Network_${Math.floor(Math.random() * 1000)}`,
					channel: Math.floor(Math.random() * 11) + 1,
					encryption: ['WPA2', 'WPA3', 'Open'][Math.floor(Math.random() * 3)]
				}
			});
		}

		return signals;
	}

	generateBluetoothSignals(count: number, options: SignalOptions = {}): Signal[] {
		const signals: Signal[] = [];
		const centerLat = this.getAreaCenter(options.area).lat;
		const centerLon = this.getAreaCenter(options.area).lon;
		const spread = this.getAreaSpread(options.area) * 0.5; // Bluetooth has shorter range
		const timeSpan = options.timeSpan || 3600000;
		const timeOffset = options.timeOffset || 0;
		const startTime = Date.now() - timeSpan + timeOffset;

		for (let i = 0; i < count; i++) {
			signals.push({
				id: `bt_${this.seedCounter++}`,
				timestamp: startTime + Math.random() * timeSpan,
				latitude: centerLat + (Math.random() - 0.5) * spread,
				longitude: centerLon + (Math.random() - 0.5) * spread,
				strength: -40 - Math.random() * 50, // -40 to -90 dBm
				frequency: 2400000000 + Math.floor(Math.random() * 80) * 1000000, // 2.4-2.48 GHz
				metadata: {
					type: 'bluetooth',
					deviceClass: ['phone', 'headphones', 'watch', 'beacon'][
						Math.floor(Math.random() * 4)
					],
					bluetoothVersion: ['4.0', '4.2', '5.0', '5.1', '5.2'][
						Math.floor(Math.random() * 5)
					]
				}
			});
		}

		return signals;
	}

	generateCellularSignals(count: number, options: SignalOptions = {}): Signal[] {
		const signals: Signal[] = [];
		const centerLat = this.getAreaCenter(options.area).lat;
		const centerLon = this.getAreaCenter(options.area).lon;
		const spread = this.getAreaSpread(options.area) * 2; // Cellular has longer range
		const timeSpan = options.timeSpan || 3600000;
		const timeOffset = options.timeOffset || 0;
		const startTime = Date.now() - timeSpan + timeOffset;

		for (let i = 0; i < count; i++) {
			const band = this.getCellularBand();
			signals.push({
				id: `cell_${this.seedCounter++}`,
				timestamp: startTime + Math.random() * timeSpan,
				latitude: centerLat + (Math.random() - 0.5) * spread,
				longitude: centerLon + (Math.random() - 0.5) * spread,
				strength: -50 - Math.random() * 70, // -50 to -120 dBm
				frequency: band.frequency,
				metadata: {
					type: 'cellular',
					technology: band.technology,
					band: band.band,
					cellId: Math.floor(Math.random() * 10000),
					operator: ['Verizon', 'AT&T', 'T-Mobile', 'Sprint'][
						Math.floor(Math.random() * 4)
					]
				}
			});
		}

		return signals;
	}

	generateDroneSignals(count: number, options: DroneOptions = {}): DroneSignal[] {
		const signals: DroneSignal[] = [];
		const patterns = options.patterns || ['surveillance'];
		const timeSpan = options.timeSpan || 3600000;
		const timeOffset = options.timeOffset || 0;

		// Generate multiple drone flights
		const dronesCount = Math.max(1, Math.floor(count / 100)); // Assume ~100 signals per drone
		const signalsPerDrone = Math.floor(count / dronesCount);

		for (let d = 0; d < dronesCount; d++) {
			const pattern = patterns[Math.floor(Math.random() * patterns.length)];
			const droneId = `drone_${this.seedCounter++}`;
			const startLat = 40.7128 + (Math.random() - 0.5) * 0.1;
			const startLon = -74.006 + (Math.random() - 0.5) * 0.1;
			const startTime = Date.now() - timeSpan + timeOffset + Math.random() * timeSpan * 0.8;
			const flightDuration = Math.min(1800000, timeSpan * 0.5); // Max 30 min flight

			for (let i = 0; i < signalsPerDrone; i++) {
				const progress = i / signalsPerDrone;
				const position = this.getDronePosition(startLat, startLon, pattern, progress);

				signals.push({
					id: `${droneId}_${i}`,
					timestamp: startTime + progress * flightDuration,
					latitude: position.lat,
					longitude: position.lon,
					strength: -35 - Math.random() * 30, // Drones typically have stronger signals
					frequency: this.getDroneFrequency(),
					metadata: {
						type: 'drone',
						droneId,
						pattern,
						altitude: position.alt,
						velocity: JSON.stringify(this.getDroneVelocity(pattern)),
						manufacturer: ['DJI', 'Parrot', 'Autel', 'Skydio'][
							Math.floor(Math.random() * 4)
						],
						model: this.getDroneModel(pattern),
						batteryLevel: 100 - progress * 80, // Battery drains during flight
						gpsAccuracy: 3 + Math.random() * 12,
						flightMode: this.getFlightMode(pattern)
					}
				});
			}
		}

		return signals;
	}

	generateMixedSignals(totalCount: number, options: SignalOptions = {}): Signal[] {
		// Realistic distribution of signal types
		const distribution = {
			wifi: 0.75, // 75% WiFi
			bluetooth: 0.15, // 15% Bluetooth
			cellular: 0.08, // 8% Cellular
			drone: 0.02 // 2% Drone
		};

		const signals: Signal[] = [];

		const wifiSignals = this.generateWiFiSignals(
			Math.floor(totalCount * distribution.wifi),
			options
		);
		const bluetoothSignals = this.generateBluetoothSignals(
			Math.floor(totalCount * distribution.bluetooth),
			options
		);
		const cellularSignals = this.generateCellularSignals(
			Math.floor(totalCount * distribution.cellular),
			options
		);
		const droneSignals = this.generateDroneSignals(
			Math.floor(totalCount * distribution.drone),
			options
		);
		signals.push(...wifiSignals, ...bluetoothSignals, ...cellularSignals, ...droneSignals);

		// Shuffle signals to simulate real-time mixed arrival
		return this.shuffleArray(signals);
	}

	private getAreaCenter(area?: string): { lat: number; lon: number } {
		const centers = {
			urban: { lat: 40.7128, lon: -74.006 }, // NYC
			suburban: { lat: 40.7614, lon: -73.9776 }, // Manhattan suburbs
			rural: { lat: 41.2033, lon: -73.7367 }, // Rural NY
			stadium: { lat: 40.8296, lon: -73.9262 } // Yankee Stadium
		} as const;
		const areaKey = area || 'urban';
		return centers[areaKey as keyof typeof centers] || centers.urban;
	}

	private getAreaSpread(area?: string): number {
		const spreads = {
			urban: 0.05, // ~5km
			suburban: 0.1, // ~10km
			rural: 0.2, // ~20km
			stadium: 0.005 // ~500m
		} as const;
		const areaKey = area || 'urban';
		return spreads[areaKey as keyof typeof spreads] || spreads.urban;
	}

	private getWiFiFrequency(): number {
		const channels = {
			1: 2412000000,
			6: 2437000000,
			11: 2462000000,
			36: 5180000000,
			40: 5200000000,
			44: 5220000000,
			48: 5240000000
		};
		const channelList = Object.values(channels);
		return channelList[Math.floor(Math.random() * channelList.length)];
	}

	private getCellularBand(): { frequency: number; technology: string; band: string } {
		const bands = [
			{ frequency: 850000000, technology: '3G', band: 'B5' },
			{ frequency: 1900000000, technology: '3G', band: 'B2' },
			{ frequency: 700000000, technology: '4G', band: 'B12' },
			{ frequency: 1700000000, technology: '4G', band: 'B4' },
			{ frequency: 2600000000, technology: '4G', band: 'B7' },
			{ frequency: 600000000, technology: '5G', band: 'n71' },
			{ frequency: 3500000000, technology: '5G', band: 'n78' },
			{ frequency: 28000000000, technology: '5G', band: 'n261' }
		];
		return bands[Math.floor(Math.random() * bands.length)];
	}

	private getDroneFrequency(): number {
		// Common drone control frequencies
		const frequencies = [
			2400000000, // 2.4 GHz WiFi control
			2437000000, // 2.4 GHz center channel
			5800000000, // 5.8 GHz video
			915000000, // 915 MHz telemetry
			433000000 // 433 MHz long range
		];
		return frequencies[Math.floor(Math.random() * frequencies.length)];
	}

	private getDronePosition(
		startLat: number,
		startLon: number,
		pattern: string,
		progress: number
	): { lat: number; lon: number; alt: number } {
		switch (pattern) {
			case 'surveillance': {
				// Circular orbit
				const radius = 0.001; // ~100m
				const angle = progress * Math.PI * 2;
				return {
					lat: startLat + radius * Math.cos(angle),
					lon: startLon + radius * Math.sin(angle),
					alt: 100 + Math.sin(progress * Math.PI * 4) * 20
				};
			}

			case 'delivery':
				// Point A to B with descent
				return {
					lat: startLat + progress * 0.01,
					lon: startLon + progress * 0.005,
					alt: 120 - progress * 100 // Descend from 120m to 20m
				};

			case 'racing': {
				// Figure-8 pattern
				const t = progress * Math.PI * 2;
				return {
					lat: startLat + 0.002 * Math.sin(t),
					lon: startLon + 0.001 * Math.sin(2 * t),
					alt: 50 + Math.random() * 20
				};
			}

			case 'inspection': {
				// Grid pattern
				const row = Math.floor(progress * 10);
				const col = (progress * 10) % 1;
				return {
					lat: startLat + row * 0.0002,
					lon: startLon + (row % 2 === 0 ? col : 1 - col) * 0.002,
					alt: 75
				};
			}

			default:
				return { lat: startLat, lon: startLon, alt: 100 };
		}
	}

	private getDroneVelocity(pattern: string): { x: number; y: number; z: number } {
		const baseVelocity = {
			surveillance: { x: 5, y: 5, z: 0 },
			delivery: { x: 15, y: 8, z: -2 },
			racing: { x: 25, y: 25, z: 5 },
			media: { x: 8, y: 8, z: 1 },
			inspection: { x: 3, y: 3, z: 0 }
		} as const;

		const velocity = baseVelocity[pattern as keyof typeof baseVelocity] || { x: 5, y: 5, z: 0 };

		// Add some randomness
		return {
			x: velocity.x + (Math.random() - 0.5) * 2,
			y: velocity.y + (Math.random() - 0.5) * 2,
			z: velocity.z + (Math.random() - 0.5) * 1
		};
	}

	private getDroneModel(pattern: string): string {
		const models = {
			surveillance: ['DJI Matrice 300', 'DJI Phantom 4 Pro', 'Autel EVO II'],
			delivery: ['DJI FlyCart 30', 'Wing Hummingbird', 'Zipline P2'],
			racing: ['DJI FPV', 'TBS Source One', 'ImpulseRC Apex'],
			media: ['DJI Inspire 3', 'DJI Ronin 4D', 'FreeFly Alta X'],
			inspection: ['DJI Matrice 30T', 'Parrot ANAFI USA', 'Skydio X2']
		} as const;

		const modelList = models[pattern as keyof typeof models] || models.surveillance;
		return modelList[Math.floor(Math.random() * modelList.length)];
	}

	private getFlightMode(pattern: string): string {
		const modes = {
			surveillance: ['Orbit', 'Hover', 'Track'],
			delivery: ['Waypoint', 'RTH', 'Landing'],
			racing: ['Acro', 'Sport', 'Manual'],
			media: ['Cinematic', 'Follow', 'POI'],
			inspection: ['Mission', 'Manual', 'Auto']
		} as const;

		const modeList = modes[pattern as keyof typeof modes] || ['Manual'];
		return modeList[Math.floor(Math.random() * modeList.length)];
	}

	private shuffleArray<T>(array: T[]): T[] {
		const shuffled = [...array];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		return shuffled;
	}
}
