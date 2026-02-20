import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { KismetProxy } from '$lib/server/kismet/kismet-proxy';
import { getGpsPosition } from '$lib/server/services/gps/gps-position-service';
import type { GPSPosition } from '$lib/server/services/kismet.service';
import { KismetService } from '$lib/server/services/kismet.service';

// Mock the KismetProxy module
vi.mock('$lib/server/kismet/kismet-proxy', () => ({
	KismetProxy: {
		getDevices: vi.fn(),
		proxyGet: vi.fn()
	}
}));

// Mock the GPS position service (direct import, no HTTP round-trip)
vi.mock('$lib/server/services/gps/gps-position-service', () => ({
	getGpsPosition: vi.fn()
}));

// Mock the logger
vi.mock('$lib/utils/logger', () => ({
	logInfo: vi.fn(),
	logError: vi.fn(),
	logWarn: vi.fn()
}));

describe('KismetService', () => {
	const mockGPSPosition: GPSPosition = {
		latitude: 50.083933333,
		longitude: 8.274061667
	};

	const mockGetGpsPosition = getGpsPosition as Mock;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('getGPSPosition()', () => {
		it('should return GPS position when service call succeeds', async () => {
			mockGetGpsPosition.mockResolvedValueOnce({
				success: true,
				data: {
					latitude: 52.520008,
					longitude: 13.404954
				}
			});

			const position = await KismetService.getGPSPosition();

			expect(mockGetGpsPosition).toHaveBeenCalled();
			expect(position).toEqual({
				latitude: 52.520008,
				longitude: 13.404954
			});
		});

		it('should return null when service call fails', async () => {
			mockGetGpsPosition.mockRejectedValueOnce(new Error('GPS service error'));

			const position = await KismetService.getGPSPosition();

			expect(position).toBeNull();
		});

		it('should return null when service returns no data', async () => {
			mockGetGpsPosition.mockResolvedValueOnce({
				success: false,
				error: 'GPS not available'
			});

			const position = await KismetService.getGPSPosition();

			expect(position).toBeNull();
		});

		it('should return null when coordinates are 0,0', async () => {
			mockGetGpsPosition.mockResolvedValueOnce({
				success: true,
				data: {
					latitude: 0,
					longitude: 0
				}
			});

			const position = await KismetService.getGPSPosition();

			expect(position).toBeNull();
		});
	});

	describe('getDevices()', () => {
		beforeEach(() => {
			// Mock successful GPS position for all getDevices tests
			mockGetGpsPosition.mockResolvedValueOnce({
				success: true,
				data: {
					latitude: 52.520008,
					longitude: 13.404954
				}
			});
		});

		it('should return devices from Method 1 when KismetProxy.getDevices succeeds', async () => {
			const mockKismetDevices = [
				{
					mac: 'AA:BB:CC:DD:EE:FF',
					lastSeen: '2024-01-10T12:00:00Z',
					signal: -75,
					manufacturer: 'Apple',
					type: 'WiFi Client',
					channel: 6,
					packets: 250,
					location: {
						lat: 52.520008,
						lon: 13.404954
					}
				}
			];

			// Safe: Test: Mock object typed for test expectations
			(KismetProxy.getDevices as Mock).mockResolvedValueOnce(mockKismetDevices);

			const result = await KismetService.getDevices();

			expect(KismetProxy.getDevices).toHaveBeenCalled();
			expect(KismetProxy.proxyGet).not.toHaveBeenCalled();
			expect(result.source).toBe('kismet');
			expect(result.error).toBeNull();
			expect(result.devices).toHaveLength(1);
			expect(result.devices[0]).toMatchObject({
				mac: 'AA:BB:CC:DD:EE:FF',
				manufacturer: 'Apple',
				type: 'wifi client',
				channel: 6,
				location: {
					lat: 52.520008,
					lon: 13.404954
				}
			});
		});

		it('should fallback to Method 2 when KismetProxy.getDevices fails', async () => {
			const mockRawDevices = [
				{
					'kismet.device.base.macaddr': 'FF:EE:DD:CC:BB:AA',
					'kismet.device.base.last_time': 1704888000,
					'kismet.device.base.signal': {
						'kismet.common.signal.last_signal': -70,
						'kismet.common.signal.max_signal': -65,
						'kismet.common.signal.min_signal': -75
					},
					'kismet.device.base.manuf': 'Samsung',
					'kismet.device.base.type': 'WiFi AP',
					'kismet.device.base.channel': 11,
					'kismet.device.base.packets.total': 500
				}
			];

			// Safe: Test: Mock object typed for test expectations
			(KismetProxy.getDevices as Mock).mockRejectedValueOnce(new Error('Connection refused'));
			// Safe: Test: Mock object typed for test expectations
			(KismetProxy.proxyGet as Mock).mockResolvedValueOnce(mockRawDevices);

			const result = await KismetService.getDevices();

			expect(KismetProxy.getDevices).toHaveBeenCalled();
			expect(KismetProxy.proxyGet).toHaveBeenCalledWith(
				expect.stringContaining('/devices/last-time/')
			);
			expect(result.source).toBe('kismet');
			expect(result.error).toBeNull();
			expect(result.devices).toHaveLength(1);
			expect(result.devices[0]).toMatchObject({
				mac: 'FF:EE:DD:CC:BB:AA',
				manufacturer: 'Samsung',
				type: 'wifi ap',
				channel: 11,
				signal: {
					last_signal: -70,
					max_signal: -70,
					min_signal: -70
				}
			});
		});

		it('should fallback to Method 3 when Methods 1 and 2 fail', async () => {
			const mockSummaryDevices = [
				{
					'kismet.device.base.macaddr': '12:34:56:78:90:AB',
					'kismet.device.base.last_time': 1704888000,
					'kismet.device.base.signal': -85,
					'kismet.device.base.type': 'WiFi Client'
				}
			];

			// Safe: Test: Mock object typed for test expectations
			(KismetProxy.getDevices as Mock).mockRejectedValueOnce(new Error('Connection refused'));
			// Safe: Test: Mock object typed for test expectations
			(KismetProxy.proxyGet as Mock)
				.mockRejectedValueOnce(new Error('404 Not Found'))
				.mockResolvedValueOnce(mockSummaryDevices);

			const result = await KismetService.getDevices();

			expect(KismetProxy.getDevices).toHaveBeenCalled();
			expect(KismetProxy.proxyGet).toHaveBeenCalledTimes(2);
			expect(KismetProxy.proxyGet).toHaveBeenLastCalledWith('/devices/summary/devices.json');
			expect(result.source).toBe('kismet');
			expect(result.error).toBeNull();
			expect(result.devices).toHaveLength(1);
			expect(result.devices[0].mac).toBe('12:34:56:78:90:AB');
		});

		it('should return fallback devices when all methods fail', async () => {
			// Safe: Test: Mock object typed for test expectations
			(KismetProxy.getDevices as Mock).mockRejectedValueOnce(new Error('Connection refused'));
			// Safe: Test: Mock object typed for test expectations
			(KismetProxy.proxyGet as Mock)
				.mockRejectedValueOnce(new Error('404 Not Found'))
				.mockRejectedValueOnce(new Error('500 Server Error'));

			const result = await KismetService.getDevices();

			expect(KismetProxy.getDevices).toHaveBeenCalled();
			expect(KismetProxy.proxyGet).toHaveBeenCalledTimes(2);
			expect(result.source).toBe('fallback');
			expect(result.error).toBe('Connection refused');
			expect(result.devices).toHaveLength(0); // Empty when all methods fail
		});

		it('should use GPS position for device locations in all scenarios', async () => {
			// Test with Method 1 success - device without location
			const mockDeviceNoLocation = [
				{
					mac: 'AA:BB:CC:DD:EE:FF',
					lastSeen: '2024-01-10T12:00:00Z',
					signal: -75,
					manufacturer: 'Apple'
					// No location field
				}
			];

			// Safe: Test: Mock object typed for test expectations
			(KismetProxy.getDevices as Mock).mockResolvedValueOnce(mockDeviceNoLocation);

			const result = await KismetService.getDevices();

			// Device should have location near GPS position with variance
			expect(Math.abs(result.devices[0].location.lat - 52.520008)).toBeLessThanOrEqual(0.003);
			expect(Math.abs(result.devices[0].location.lon - 13.404954)).toBeLessThanOrEqual(0.003);
		});

		it('should handle error messages and logging correctly', async () => {
			const customError = new Error('Custom error message');
			// Safe: Test: Mock object typed for test expectations
			(KismetProxy.getDevices as Mock).mockRejectedValueOnce(customError);
			// Safe: Test: Mock object typed for test expectations
			(KismetProxy.proxyGet as Mock)
				.mockRejectedValueOnce(new Error('REST API error'))
				.mockRejectedValueOnce(new Error('Summary API error'));

			const result = await KismetService.getDevices();

			expect(result.error).toBe('Custom error message');
			expect(result.source).toBe('fallback');
		});

		it('should limit devices from summary endpoint to 50', async () => {
			// Create 100 mock devices
			const manyDevices = Array(100)
				.fill(null)
				.map((_, i) => ({
					'kismet.device.base.macaddr': `AA:BB:CC:DD:EE:${i.toString(16).padStart(2, '0').toUpperCase()}`,
					'kismet.device.base.last_time': 1704888000,
					'kismet.device.base.signal': -80
				}));

			// Safe: Test: Mock object typed for test expectations
			(KismetProxy.getDevices as Mock).mockRejectedValueOnce(new Error('Failed'));
			// Safe: Test: Mock object typed for test expectations
			(KismetProxy.proxyGet as Mock)
				.mockRejectedValueOnce(new Error('Failed'))
				.mockResolvedValueOnce(manyDevices);

			const result = await KismetService.getDevices();

			expect(result.devices).toHaveLength(50); // Should be limited to 50
		});

		it('should handle non-array responses gracefully', async () => {
			// Safe: Test: Mock object typed for test expectations
			(KismetProxy.getDevices as Mock).mockRejectedValueOnce(new Error('Failed'));
			// Safe: Test: Mock object typed for test expectations
			(KismetProxy.proxyGet as Mock)
				.mockResolvedValueOnce({ error: 'Invalid response' }) // Non-array
				.mockResolvedValueOnce(null); // Null response

			const result = await KismetService.getDevices();

			expect(result.source).toBe('fallback');
			expect(result.devices).toHaveLength(0); // Empty when all methods fail
		});

		it('should handle empty arrays from Kismet', async () => {
			// Safe: Test: Mock object typed for test expectations
			(KismetProxy.getDevices as Mock).mockResolvedValueOnce([]);

			const result = await KismetService.getDevices();

			expect(result.source).toBe('kismet');
			expect(result.error).toBeNull();
			expect(result.devices).toHaveLength(0);
		});
	});

	describe('transformKismetDevices()', () => {
		it('should transform normal device data correctly', () => {
			const kismetDevices = [
				{
					mac: 'AA:BB:CC:DD:EE:FF',
					lastSeen: '2024-01-10T12:00:00Z',
					signal: -75,
					manufacturer: 'Apple',
					type: 'WiFi Client',
					channel: 6,
					packets: 250,
					location: {
						lat: 50.084,
						lon: 8.274
					}
				}
			];

			const result = KismetService['transformKismetDevices'](kismetDevices, mockGPSPosition);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				mac: 'AA:BB:CC:DD:EE:FF',
				last_seen: new Date('2024-01-10T12:00:00Z').getTime(),
				signal: {
					last_signal: -75,
					max_signal: -75,
					min_signal: -75
				},
				manufacturer: 'Apple',
				type: 'wifi client',
				channel: 6,
				frequency: 2430, // channel * 5 + 2400
				packets: 250,
				datasize: 250,
				location: {
					lat: 50.084,
					lon: 8.274
				}
			});
		});

		it('should handle missing/null values with defaults', () => {
			const kismetDevices = [
				{
					mac: '11:22:33:44:55:66',
					lastSeen: '2024-01-10T13:00:00Z'
					// Missing signal, manufacturer, type, channel, packets, location
				}
			];

			const result = KismetService['transformKismetDevices'](kismetDevices, mockGPSPosition);

			expect(result).toHaveLength(1);
			const device = result[0];

			expect(device.signal.last_signal).toBe(-100); // DEFAULT_SIGNAL
			expect(device.manufacturer).toBe('Unknown');
			expect(device.type).toBe('unknown');
			expect(device.channel).toBe(0);
			expect(device.frequency).toBe(2400); // 0 * 5 + 2400
			expect(device.packets).toBe(0);
			expect(device.datasize).toBe(0);

			// Location should have variance applied
			expect(device.location.lat).toBeCloseTo(mockGPSPosition.latitude, 2);
			expect(device.location.lon).toBeCloseTo(mockGPSPosition.longitude, 2);
			expect(Math.abs(device.location.lat - mockGPSPosition.latitude)).toBeLessThanOrEqual(
				0.002
			); // Signal-based variance: ~20-200m → ~0.0002-0.002 degrees
			expect(Math.abs(device.location.lon - mockGPSPosition.longitude)).toBeLessThanOrEqual(
				0.002
			);
		});

		it('should calculate location with variance when location is missing', () => {
			const kismetDevices = Array(10)
				.fill(null)
				.map((_, i) => ({
					mac: `AA:BB:CC:DD:EE:${i.toString(16).padStart(2, '0').toUpperCase()}`,
					lastSeen: '2024-01-10T12:00:00Z',
					signal: -80
					// No location provided
				}));

			const result = KismetService['transformKismetDevices'](kismetDevices, mockGPSPosition);

			// All devices should have locations near the GPS position but with variance
			result.forEach((device) => {
				expect(
					Math.abs(device.location.lat - mockGPSPosition.latitude)
				).toBeLessThanOrEqual(0.003);
				expect(
					Math.abs(device.location.lon - mockGPSPosition.longitude)
				).toBeLessThanOrEqual(0.003);
			});

			// Locations should be different due to random variance
			const uniqueLocations = new Set(
				result.map((d) => `${d.location.lat},${d.location.lon}`)
			);
			expect(uniqueLocations.size).toBeGreaterThan(1);
		});
	});

	describe('transformRawKismetDevices()', () => {
		it('should extract nested signal data correctly', () => {
			const rawDevices = [
				{
					'kismet.device.base.macaddr': 'FF:EE:DD:CC:BB:AA',
					'kismet.device.base.last_time': 1704888000, // Unix timestamp
					'kismet.device.base.signal': {
						'kismet.common.signal.last_signal': -70,
						'kismet.common.signal.max_signal': -65,
						'kismet.common.signal.min_signal': -75
					},
					'kismet.device.base.manuf': 'Samsung',
					'kismet.device.base.type': 'WiFi AP',
					'kismet.device.base.channel': 11,
					'kismet.device.base.packets.total': 500,
					'kismet.device.base.location': {
						'kismet.common.location.lat': 50.085,
						'kismet.common.location.lon': 8.275
					}
				}
			];

			const result = KismetService['transformRawKismetDevices'](rawDevices, mockGPSPosition);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				mac: 'FF:EE:DD:CC:BB:AA',
				last_seen: 1704888000000, // Converted to milliseconds
				signal: {
					last_signal: -70,
					max_signal: -70,
					min_signal: -70
				},
				manufacturer: 'Samsung',
				type: 'wifi ap',
				channel: 11,
				frequency: 2455, // 11 * 5 + 2400
				packets: 500,
				datasize: 500,
				location: {
					lat: 50.085,
					lon: 8.275
				}
			});
		});

		it('should handle missing fields with defaults', () => {
			const rawDevices = [
				{
					// Minimal data - only MAC address
					'kismet.device.base.macaddr': '12:34:56:78:90:AB'
				}
			];

			const result = KismetService['transformRawKismetDevices'](rawDevices, mockGPSPosition);

			expect(result).toHaveLength(1);
			const device = result[0];

			expect(device.mac).toBe('12:34:56:78:90:AB');
			expect(device.last_seen).toBe(0); // Default when missing
			expect(device.signal.last_signal).toBe(-100); // DEFAULT_SIGNAL
			expect(device.manufacturer).toBe('Unknown');
			expect(device.type).toBe('unknown');
			expect(device.channel).toBe(0);
			expect(device.frequency).toBe(2400);
			expect(device.packets).toBe(0);
			expect(device.datasize).toBe(0);

			// Location should have variance applied
			expect(Math.abs(device.location.lat - mockGPSPosition.latitude)).toBeLessThanOrEqual(
				0.003
			);
			expect(Math.abs(device.location.lon - mockGPSPosition.longitude)).toBeLessThanOrEqual(
				0.003
			);
		});

		it('should handle signal as number instead of object', () => {
			const rawDevices = [
				{
					'kismet.device.base.macaddr': 'AB:CD:EF:01:23:45',
					'kismet.device.base.signal': -85, // Direct number value
					'kismet.device.base.type': 'WiFi Client'
				}
			];

			const result = KismetService['transformRawKismetDevices'](rawDevices, mockGPSPosition);

			expect(result[0].signal).toEqual({
				last_signal: -85,
				max_signal: -85,
				min_signal: -85
			});
		});
	});

	// Test suite for extractSignalFromDevice() removed - method was inlined into transformRawKismetDevices() during type safety remediation
	// Test suite for createFallbackDevices() removed - method was deleted during refactoring
	// If this functionality is needed in the future, test suites can be restored from git history
});
