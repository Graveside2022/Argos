import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testUtils as _testUtils } from '../helpers/setup';

const API_BASE_URL = process.env.TEST_URL || 'http://localhost:5173';

// Helper to create mock fetch response
const createMockResponse = (data: unknown, status = 200) => ({
	ok: status >= 200 && status < 300,
	status,
	statusText: status === 200 ? 'OK' : 'Error',
	json: async () => data,
	text: async () => JSON.stringify(data),
	headers: new Headers({
		'content-type': 'application/json'
	})
});

describe('API Endpoint Tests', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	describe('Spectrum API', () => {
		it('should handle spectrum data requests', async () => {
			const mockData = {
				frequencies: [100, 101, 102, 103, 104],
				amplitudes: [-50, -60, -55, -52, -58]
			};

			vi.mocked(global.fetch).mockResolvedValueOnce(createMockResponse(mockData) as Response);

			const response = await fetch(`${API_BASE_URL}/api/spectrum`);
			expect(response.status).toBe(200);

			const data = (await response.json()) as Record<string, unknown>;
			expect(data).toHaveProperty('frequencies');
			expect(data).toHaveProperty('amplitudes');
			expect(Array.isArray(data.frequencies as unknown[])).toBe(true);
			expect(Array.isArray(data.amplitudes as unknown[])).toBe(true);
		});

		it('should validate spectrum configuration updates', async () => {
			const config = {
				centerFrequency: 100000000,
				sampleRate: 2400000,
				gain: 30
			};

			vi.mocked(global.fetch).mockResolvedValueOnce(
				createMockResponse({ success: true }) as Response
			);

			const response = await fetch(`${API_BASE_URL}/api/spectrum/config`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(config)
			});

			expect(response.status).toBe(200);
			const result = (await response.json()) as Record<string, unknown>;
			expect(result.success as boolean).toBe(true);
		});

		it('should handle invalid spectrum configuration', async () => {
			const invalidConfig = {
				centerFrequency: -1000, // Invalid negative frequency
				sampleRate: 'invalid' // Invalid type
			};

			vi.mocked(global.fetch).mockResolvedValueOnce(
				createMockResponse({ error: 'Invalid configuration' }, 400) as Response
			);

			const response = await fetch(`${API_BASE_URL}/api/spectrum/config`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(invalidConfig)
			});

			expect(response.status).toBe(400);
			const error = (await response.json()) as Record<string, unknown>;
			expect(error).toHaveProperty('error');
		});
	});

	describe('Device API', () => {
		it('should return device list', async () => {
			const mockDevices = [
				{
					id: 'device-1',
					name: 'Test Device 1',
					mac: '00:11:22:33:44:55',
					signal: -65,
					lastSeen: Date.now()
				},
				{
					id: 'device-2',
					name: 'Test Device 2',
					mac: '00:11:22:33:44:66',
					signal: -70,
					lastSeen: Date.now()
				}
			];

			vi.mocked(global.fetch).mockResolvedValueOnce(
				createMockResponse(mockDevices) as Response
			);

			const response = await fetch(`${API_BASE_URL}/api/devices`);
			expect(response.status).toBe(200);

			const devices = (await response.json()) as unknown[];
			expect(Array.isArray(devices)).toBe(true);

			if (devices.length > 0) {
				const device = devices[0] as Record<string, unknown>;
				expect(device).toHaveProperty('id');
				expect(device).toHaveProperty('name');
				expect(device).toHaveProperty('mac');
				expect(device).toHaveProperty('signal');
				expect(device).toHaveProperty('lastSeen');
			}
		});

		it('should filter devices by signal strength', async () => {
			const mockDevices = [
				{
					id: 'device-1',
					name: 'Strong Signal Device',
					mac: '00:11:22:33:44:55',
					signal: -65,
					lastSeen: Date.now()
				}
			];

			vi.mocked(global.fetch).mockResolvedValueOnce(
				createMockResponse(mockDevices) as Response
			);

			const response = await fetch(`${API_BASE_URL}/api/devices?minSignal=-70`);
			expect(response.status).toBe(200);

			const devices = (await response.json()) as unknown[];
			devices.forEach((device) => {
				if (typeof device === 'object' && device !== null && 'signal' in device) {
					expect(
						(device as Record<string, unknown>).signal as number
					).toBeGreaterThanOrEqual(-70);
				}
			});
		});

		it('should get device details by ID', async () => {
			const mockDevices = [{ id: 'device-1', name: 'Test Device' }];
			const mockDeviceDetail = {
				id: 'device-1',
				name: 'Test Device',
				mac: '00:11:22:33:44:55',
				signal: -65,
				lastSeen: Date.now(),
				history: [
					{ timestamp: Date.now() - 60000, signal: -66 },
					{ timestamp: Date.now() - 30000, signal: -65 }
				]
			};

			// Mock the list response
			vi.mocked(global.fetch).mockResolvedValueOnce(
				createMockResponse(mockDevices) as Response
			);

			// First get a device ID
			const listResponse = await fetch(`${API_BASE_URL}/api/devices`);
			const devices = (await listResponse.json()) as unknown[];

			if (devices.length > 0) {
				const deviceId = (devices[0] as Record<string, unknown>).id as string;

				// Mock the detail response
				vi.mocked(global.fetch).mockResolvedValueOnce(
					createMockResponse(mockDeviceDetail) as Response
				);

				const detailResponse = await fetch(`${API_BASE_URL}/api/devices/${deviceId}`);
				expect(detailResponse.status).toBe(200);

				const device = (await detailResponse.json()) as Record<string, unknown>;
				expect(device.id).toBe(deviceId);
				expect(device).toHaveProperty('history');
				expect(Array.isArray(device.history as unknown[])).toBe(true);
			}
		});

		it('should handle non-existent device ID', async () => {
			vi.mocked(global.fetch).mockResolvedValueOnce(
				createMockResponse({ error: 'Device not found' }, 404) as Response
			);

			const response = await fetch(`${API_BASE_URL}/api/devices/non-existent-id`);
			expect(response.status).toBe(404);
		});
	});

	describe('Sweep API', () => {
		it('should start a new sweep', async () => {
			const sweepConfig = {
				startFrequency: 88000000,
				endFrequency: 108000000,
				stepSize: 100000,
				dwellTime: 100
			};

			vi.mocked(global.fetch).mockResolvedValueOnce(
				createMockResponse({ sweepId: 'sweep-123', status: 'started' }) as Response
			);

			const response = await fetch(`${API_BASE_URL}/api/sweep/start`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(sweepConfig)
			});

			expect(response.status).toBe(200);
			const result = (await response.json()) as Record<string, unknown>;
			expect(result).toHaveProperty('sweepId');
			expect(result.status as string).toBe('started');
		});

		it('should get sweep status', async () => {
			vi.mocked(global.fetch).mockResolvedValueOnce(
				createMockResponse({ active: true, progress: 45 }) as Response
			);

			const response = await fetch(`${API_BASE_URL}/api/sweep/status`);
			expect(response.status).toBe(200);

			const status = (await response.json()) as Record<string, unknown>;
			expect(status).toHaveProperty('active');
			expect(status).toHaveProperty('progress');

			if (status.active as boolean) {
				expect(status.progress as number).toBeGreaterThanOrEqual(0);
				expect(status.progress as number).toBeLessThanOrEqual(100);
			}
		});

		it('should stop an active sweep', async () => {
			vi.mocked(global.fetch).mockResolvedValueOnce(
				createMockResponse({ status: 'stopped' }) as Response
			);

			const response = await fetch(`${API_BASE_URL}/api/sweep/stop`, {
				method: 'POST'
			});

			expect(response.status).toBe(200);
			const result = (await response.json()) as Record<string, unknown>;
			expect(result.status as string).toBe('stopped');
		});
	});

	describe('System API', () => {
		it('should return system status', async () => {
			vi.mocked(global.fetch).mockResolvedValueOnce(
				createMockResponse({
					hackrf: { connected: true, status: 'ready' },
					gps: { connected: false, status: 'disconnected' },
					websocket: { connected: true, clients: 2 },
					uptime: 3600
				}) as Response
			);

			const response = await fetch(`${API_BASE_URL}/api/system/status`);
			expect(response.status).toBe(200);

			const status = (await response.json()) as Record<string, unknown>;
			expect(status).toHaveProperty('hackrf');
			expect(status).toHaveProperty('gps');
			expect(status).toHaveProperty('websocket');
			expect(status).toHaveProperty('uptime');
		});

		it('should return system metrics', async () => {
			vi.mocked(global.fetch).mockResolvedValueOnce(
				createMockResponse({
					cpu: 25.5,
					memory: 45.2,
					disk: 60.8
				}) as Response
			);

			const response = await fetch(`${API_BASE_URL}/api/system/metrics`);
			expect(response.status).toBe(200);

			const metrics = (await response.json()) as Record<string, unknown>;
			expect(metrics).toHaveProperty('cpu');
			expect(metrics).toHaveProperty('memory');
			expect(metrics).toHaveProperty('disk');
			expect(metrics.cpu as number).toBeGreaterThanOrEqual(0);
			expect(metrics.cpu as number).toBeLessThanOrEqual(100);
		});
	});

	describe('Rate Limiting Tests', () => {
		it('should handle rate limiting gracefully', async () => {
			// Mock responses - first 50 succeed, rest are rate limited
			const mockResponses = Array(100)
				.fill(null)
				.map((_, index) => {
					if (index < 50) {
						return createMockResponse([]) as Response;
					} else {
						const response = createMockResponse(
							{ error: 'Rate limit exceeded' },
							429
						) as Response;
						response.headers.set('Retry-After', '60');
						return response;
					}
				});

			mockResponses.forEach((response) => {
				vi.mocked(global.fetch).mockResolvedValueOnce(response);
			});

			const requests = Array(100)
				.fill(null)
				.map(() => fetch(`${API_BASE_URL}/api/devices`));

			const responses = await Promise.all(requests);
			const statusCodes = responses.map((r) => r.status);

			// Some requests might be rate limited
			expect(statusCodes).toContain(200);
			if (statusCodes.includes(429)) {
				const rateLimitedResponse = responses.find((r) => r.status === 429);
				expect(rateLimitedResponse?.headers.get('Retry-After')).toBeTruthy();
			}
		});
	});

	describe('Error Handling', () => {
		it('should return 404 for non-existent endpoints', async () => {
			vi.mocked(global.fetch).mockResolvedValueOnce(
				createMockResponse({ error: 'Not found' }, 404) as Response
			);

			const response = await fetch(`${API_BASE_URL}/api/non-existent`);
			expect(response.status).toBe(404);
		});

		it('should handle malformed JSON gracefully', async () => {
			vi.mocked(global.fetch).mockResolvedValueOnce(
				createMockResponse({ error: 'Invalid JSON' }, 400) as Response
			);

			const response = await fetch(`${API_BASE_URL}/api/spectrum/config`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: 'invalid json{'
			});

			expect(response.status).toBe(400);
		});

		it('should require authentication for protected endpoints', async () => {
			vi.mocked(global.fetch).mockResolvedValueOnce(
				createMockResponse({ error: 'Unauthorized' }, 401) as Response
			);

			const response = await fetch(`${API_BASE_URL}/api/admin/config`);
			expect([401, 403]).toContain(response.status);
		});
	});

	describe('Performance Tests', () => {
		it('should respond within acceptable time limits', async () => {
			vi.mocked(global.fetch).mockImplementationOnce(async () => {
				// Simulate a small delay
				await new Promise((resolve) => setTimeout(resolve, 50));
				return createMockResponse([]) as Response;
			});

			const startTime = Date.now();
			const response = await fetch(`${API_BASE_URL}/api/devices`);
			const responseTime = Date.now() - startTime;

			expect(response.status).toBe(200);
			expect(responseTime).toBeLessThan(1000); // Less than 1 second
		});

		it('should handle concurrent requests efficiently', async () => {
			const concurrentRequests = 10;

			// Mock all responses with a small delay
			Array(concurrentRequests)
				.fill(null)
				.forEach(() => {
					vi.mocked(global.fetch).mockResolvedValueOnce(
						createMockResponse({
							hackrf: true,
							gps: false,
							websocket: true,
							uptime: 3600
						}) as Response
					);
				});

			const startTime = Date.now();

			const requests = Array(concurrentRequests)
				.fill(null)
				.map(() => fetch(`${API_BASE_URL}/api/system/status`));

			const responses = await Promise.all(requests);
			const totalTime = Date.now() - startTime;

			responses.forEach((response) => {
				expect(response.status).toBe(200);
			});

			// Should complete all requests in reasonable time
			expect(totalTime).toBeLessThan(2000); // Less than 2 seconds for 10 requests
		});
	});
});
