/**
 * Hardware Schema Validation Tests
 * Tests runtime validation for hardware detection objects
 */

import { describe, expect, it } from 'vitest';

import {
	BluetoothCapabilitiesSchema,
	DetectedHardwareSchema,
	GPSCapabilitiesSchema,
	HardwareCategorySchema,
	SDRCapabilitiesSchema,
	validateDetectedHardware,
	validateSDRCapabilities,
	WiFiCapabilitiesSchema
} from '$lib/schemas/hardware';

describe('HardwareCategory Schema', () => {
	it('should accept valid hardware categories', () => {
		expect(HardwareCategorySchema.parse('sdr')).toBe('sdr');
		expect(HardwareCategorySchema.parse('wifi')).toBe('wifi');
		expect(HardwareCategorySchema.parse('bluetooth')).toBe('bluetooth');
		expect(HardwareCategorySchema.parse('gps')).toBe('gps');
		expect(HardwareCategorySchema.parse('network')).toBe('network');
	});

	it('should reject invalid hardware categories', () => {
		expect(() => HardwareCategorySchema.parse('invalid')).toThrow();
		expect(() => HardwareCategorySchema.parse('')).toThrow();
		expect(() => HardwareCategorySchema.parse(null)).toThrow();
		expect(() => HardwareCategorySchema.parse(undefined)).toThrow();
	});
});

describe('SDRCapabilities Schema', () => {
	it('should accept valid SDR capabilities', () => {
		const validSDR = {
			minFrequency: 1_000_000,
			maxFrequency: 6_000_000_000,
			sampleRate: 20_000_000,
			canTransmit: true,
			canReceive: true
		};

		expect(SDRCapabilitiesSchema.parse(validSDR)).toEqual(validSDR);
	});

	it('should accept optional fields', () => {
		const sdrWithOptional = {
			minFrequency: 1_000_000,
			maxFrequency: 6_000_000_000,
			sampleRate: 20_000_000,
			bandwidth: 20_000_000,
			canTransmit: true,
			canReceive: true,
			fullDuplex: false
		};

		expect(SDRCapabilitiesSchema.parse(sdrWithOptional)).toEqual(sdrWithOptional);
	});

	it('should reject negative frequencies', () => {
		const invalidSDR = {
			minFrequency: -100,
			maxFrequency: 6_000_000_000,
			sampleRate: 20_000_000,
			canTransmit: true,
			canReceive: true
		};

		expect(() => SDRCapabilitiesSchema.parse(invalidSDR)).toThrow(
			'Min frequency must be positive'
		);
	});

	it('should reject missing required fields', () => {
		const incomplete = {
			minFrequency: 1_000_000,
			maxFrequency: 6_000_000_000
			// Missing sampleRate, canTransmit, canReceive
		};

		expect(() => SDRCapabilitiesSchema.parse(incomplete)).toThrow();
	});
});

describe('WiFiCapabilities Schema', () => {
	it('should accept valid WiFi capabilities', () => {
		const validWiFi = {
			interface: 'wlan0',
			hasMonitorMode: true,
			canInject: true,
			frequencyBands: ['2.4GHz', '5GHz'],
			channels: [1, 6, 11, 36, 40]
		};

		expect(WiFiCapabilitiesSchema.parse(validWiFi)).toEqual(validWiFi);
	});

	it('should reject empty interface name', () => {
		const invalid = {
			interface: '',
			hasMonitorMode: true,
			canInject: false,
			frequencyBands: [],
			channels: []
		};

		expect(() => WiFiCapabilitiesSchema.parse(invalid)).toThrow('Interface name required');
	});
});

describe('BluetoothCapabilities Schema', () => {
	it('should accept valid Bluetooth capabilities', () => {
		const validBT = {
			interface: 'hci0',
			hasBleSupport: true,
			hasClassicSupport: true
		};

		expect(BluetoothCapabilitiesSchema.parse(validBT)).toEqual(validBT);
	});

	it('should accept optional fields', () => {
		const btWithOptional = {
			interface: 'hci0',
			hasBleSupport: true,
			hasClassicSupport: false,
			version: '5.0',
			manufacturer: 'Intel'
		};

		expect(BluetoothCapabilitiesSchema.parse(btWithOptional)).toEqual(btWithOptional);
	});
});

describe('GPSCapabilities Schema', () => {
	it('should accept valid GPS capabilities', () => {
		const validGPS = {
			device: '/dev/ttyUSB0',
			protocol: 'NMEA',
			baudRate: 9600,
			updateRate: 1
		};

		expect(GPSCapabilitiesSchema.parse(validGPS)).toEqual(validGPS);
	});

	it('should reject empty device path', () => {
		const invalid = {
			device: '',
			protocol: 'NMEA'
		};

		expect(() => GPSCapabilitiesSchema.parse(invalid)).toThrow('Device path required');
	});

	it('should reject negative baud rate', () => {
		const invalid = {
			device: '/dev/ttyUSB0',
			baudRate: -9600
		};

		expect(() => GPSCapabilitiesSchema.parse(invalid)).toThrow('Baud rate must be positive');
	});
});

describe('DetectedHardware Schema', () => {
	it('should accept valid HackRF device', () => {
		const hackrf = {
			id: 'hackrf-123456',
			name: 'HackRF One',
			category: 'sdr' as const,
			connectionType: 'usb' as const,
			status: 'connected' as const,
			capabilities: {
				minFrequency: 1_000_000,
				maxFrequency: 6_000_000_000,
				sampleRate: 20_000_000,
				canTransmit: true,
				canReceive: true,
				fullDuplex: false
			},
			manufacturer: 'Great Scott Gadgets',
			model: 'HackRF One',
			serial: '123456',
			vendorId: '1d50',
			productId: '604b',
			lastSeen: Date.now(),
			firstSeen: Date.now(),
			compatibleTools: ['spectrum.analysis.hackrf']
		};

		const result = DetectedHardwareSchema.safeParse(hackrf);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.id).toBe('hackrf-123456');
			expect(result.data.category).toBe('sdr');
		}
	});

	it('should accept network USRP device', () => {
		const usrp = {
			id: 'usrp-net-192-168-1-100',
			name: 'Network USRP',
			category: 'sdr' as const,
			connectionType: 'network' as const,
			status: 'connected' as const,
			capabilities: {
				minFrequency: 70_000_000,
				maxFrequency: 6_000_000_000,
				sampleRate: 61_440_000,
				canTransmit: true,
				canReceive: true,
				fullDuplex: true
			},
			manufacturer: 'Ettus Research',
			ipAddress: '192.168.1.100',
			port: 49153,
			lastSeen: Date.now(),
			firstSeen: Date.now()
		};

		const result = DetectedHardwareSchema.safeParse(usrp);
		expect(result.success).toBe(true);
	});

	it('should reject device without required fields', () => {
		const incomplete = {
			id: 'test-123',
			name: 'Test Device'
			// Missing: category, connectionType, status, capabilities
		};

		const result = DetectedHardwareSchema.safeParse(incomplete);
		expect(result.success).toBe(false);
	});

	it('should reject device with empty ID', () => {
		const invalid = {
			id: '',
			name: 'Test Device',
			category: 'sdr',
			connectionType: 'usb',
			status: 'connected',
			capabilities: {
				minFrequency: 1_000_000,
				maxFrequency: 6_000_000_000,
				sampleRate: 20_000_000,
				canTransmit: true,
				canReceive: true
			}
		};

		const result = DetectedHardwareSchema.safeParse(invalid);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.message).toContain('Hardware ID required');
		}
	});

	it('should reject device with invalid category', () => {
		const invalid = {
			id: 'test-123',
			name: 'Test Device',
			category: 'invalid-category',
			connectionType: 'usb',
			status: 'connected',
			capabilities: {}
		};

		const result = DetectedHardwareSchema.safeParse(invalid);
		expect(result.success).toBe(false);
	});

	it('should accept partial objects that satisfy required fields', () => {
		const partial = {
			id: 'minimal-device',
			name: 'Minimal Device',
			category: 'network' as const,
			connectionType: 'network' as const,
			status: 'connected' as const,
			capabilities: {
				service: 'test-service',
				version: '1.0'
			}
		};

		const result = DetectedHardwareSchema.safeParse(partial);
		expect(result.success).toBe(true);
	});
});

describe('validateDetectedHardware helper', () => {
	it('should return success for valid hardware', () => {
		const validDevice = {
			id: 'test-123',
			name: 'Test Device',
			category: 'sdr',
			connectionType: 'usb',
			status: 'connected',
			capabilities: {
				minFrequency: 1_000_000,
				maxFrequency: 6_000_000_000,
				sampleRate: 20_000_000,
				canTransmit: true,
				canReceive: true
			}
		};

		const result = validateDetectedHardware(validDevice);
		expect(result.success).toBe(true);
		expect(result.data).toBeDefined();
		expect(result.error).toBeUndefined();
	});

	it('should return error for invalid hardware', () => {
		const invalidDevice = {
			id: '',
			name: 'Test'
		};

		const result = validateDetectedHardware(invalidDevice);
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
		expect(result.details).toBeDefined();
		expect(result.data).toBeUndefined();
	});
});

describe('validateSDRCapabilities helper', () => {
	it('should return success for valid SDR capabilities', () => {
		const validSDR = {
			minFrequency: 1_000_000,
			maxFrequency: 6_000_000_000,
			sampleRate: 20_000_000,
			canTransmit: true,
			canReceive: true
		};

		const result = validateSDRCapabilities(validSDR);
		expect(result.success).toBe(true);
		expect(result.data).toEqual(validSDR);
	});

	it('should return error for invalid SDR capabilities', () => {
		const invalid = {
			minFrequency: -100,
			maxFrequency: 1000
		};

		const result = validateSDRCapabilities(invalid);
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});
});

describe('Edge Cases', () => {
	it('should handle zero values where valid', () => {
		const gps = {
			device: '/dev/ttyUSB0',
			updateRate: 0 // Invalid - must be positive
		};

		expect(() => GPSCapabilitiesSchema.parse(gps)).toThrow();
	});

	it('should handle very large numbers', () => {
		const sdr = {
			minFrequency: 1,
			maxFrequency: Number.MAX_SAFE_INTEGER,
			sampleRate: 1_000_000_000,
			canTransmit: true,
			canReceive: true
		};

		expect(SDRCapabilitiesSchema.parse(sdr)).toEqual(sdr);
	});

	it('should reject null values for required fields', () => {
		const invalid = {
			id: null,
			name: 'Test',
			category: 'sdr',
			connectionType: 'usb',
			status: 'connected',
			capabilities: {}
		};

		const result = DetectedHardwareSchema.safeParse(invalid);
		expect(result.success).toBe(false);
	});

	it('should handle empty arrays in capabilities', () => {
		const wifi = {
			interface: 'wlan0',
			hasMonitorMode: false,
			canInject: false,
			frequencyBands: [],
			channels: []
		};

		expect(WiFiCapabilitiesSchema.parse(wifi)).toEqual(wifi);
	});
});
