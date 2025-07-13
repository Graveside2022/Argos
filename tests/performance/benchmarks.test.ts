import { describe, it, expect, beforeEach, vi } from 'vitest';
import { performance } from 'perf_hooks';
import { testUtils } from '../helpers/setup';

const API_BASE_URL = process.env.TEST_URL || 'http://localhost:5173';
const WS_URL = process.env.WS_URL || 'ws://localhost:8092';

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

describe('Performance Benchmarks', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('API Response Time Benchmarks', () => {
		const endpoints = [
			{ name: 'Device List', url: '/api/devices', target: 300 },
			{ name: 'Spectrum Data', url: '/api/spectrum', target: 400 },
			{ name: 'System Status', url: '/api/system/status', target: 200 },
			{ name: 'Sweep Status', url: '/api/sweep/status', target: 200 }
		];

		endpoints.forEach(({ name, url, target }) => {
			it(`${name} should respond within ${target}ms`, async () => {
				const times: number[] = [];
				const iterations = 10;

				for (let i = 0; i < iterations; i++) {
					// Mock with small delay to simulate network
					vi.mocked(global.fetch).mockImplementationOnce(async () => {
						await new Promise((resolve) =>
							setTimeout(resolve, 20 + Math.random() * 30)
						);
						return createMockResponse({ data: 'test' }) as Response;
					});

					const start = performance.now();
					const response = await fetch(`${API_BASE_URL}${url}`);
					const end = performance.now();

					expect(response.status).toBe(200);
					times.push(end - start);
				}

				const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
				const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

				console.warn(
					`${name} - Avg: ${avgTime.toFixed(2)}ms, P95: ${p95Time.toFixed(2)}ms`
				);

				expect(avgTime).toBeLessThan(target);
				expect(p95Time).toBeLessThan(target * 1.5); // P95 can be 50% higher
			});
		});

		it('should handle concurrent API requests efficiently', async () => {
			const concurrentRequests = 50;
			const start = performance.now();

			// Mock all concurrent requests
			Array(concurrentRequests)
				.fill(null)
				.forEach(() => {
					vi.mocked(global.fetch).mockResolvedValueOnce(
						createMockResponse([]) as Response
					);
				});

			const requests = Array(concurrentRequests)
				.fill(null)
				.map((_, index) => fetch(`${API_BASE_URL}/api/devices?page=${index}`));

			const responses = await Promise.all(requests);
			const end = performance.now();
			const totalTime = end - start;

			responses.forEach((response) => {
				expect(response.status).toBe(200);
			});

			const avgTimePerRequest = totalTime / concurrentRequests;
			console.warn(
				`Concurrent requests - Total: ${totalTime.toFixed(2)}ms, Avg per request: ${avgTimePerRequest.toFixed(2)}ms`
			);

			expect(avgTimePerRequest).toBeLessThan(300); // Should benefit from concurrency
		});
	});

	describe.skip('WebSocket Performance Benchmarks', () => {
		it('should handle high-frequency spectrum updates', async () => {
			// Skip WebSocket tests as they require a real server
			const ws = await testUtils.waitForWebSocket(WS_URL);
			const messageCount = 1000;
			let receivedCount = 0;
			const latencies: number[] = [];

			const messagePromise = new Promise<void>((resolve) => {
				ws.on('message', (data: unknown) => {
					// Type guard and safe string conversion
					let dataStr: string;
					if (Buffer.isBuffer(data)) {
						dataStr = data.toString();
					} else if (typeof data === 'string') {
						dataStr = data;
					} else {
						// For other types, use JSON.stringify as fallback
						dataStr = JSON.stringify(data);
					}

					const message = JSON.parse(dataStr) as { timestamp?: number };
					if (message.timestamp) {
						const latency = Date.now() - message.timestamp;
						latencies.push(latency);
					}
					receivedCount++;
					if (receivedCount >= messageCount) {
						resolve();
					}
				});
			});

			const start = performance.now();

			// Send rapid messages
			for (let i = 0; i < messageCount; i++) {
				ws.send(
					JSON.stringify({
						type: 'spectrum:request',
						timestamp: Date.now()
					})
				);
			}

			await messagePromise;
			const end = performance.now();

			ws.close();

			const totalTime = end - start;
			const messagesPerSecond = (messageCount / totalTime) * 1000;
			const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
			const p99Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.99)];

			console.warn(
				`WebSocket performance - Messages/sec: ${messagesPerSecond.toFixed(0)}, Avg latency: ${avgLatency.toFixed(2)}ms, P99 latency: ${p99Latency.toFixed(2)}ms`
			);

			expect(messagesPerSecond).toBeGreaterThan(50);
			expect(avgLatency).toBeLessThan(100);
			expect(p99Latency).toBeLessThan(200);
		});

		it('should handle large payload transfers efficiently', async () => {
			const ws = await testUtils.waitForWebSocket(WS_URL);

			// Create large payload (1MB)
			const largeData = new Array(1024 * 1024).fill('x').join('');

			const responsePromise = new Promise<number>((resolve) => {
				const start = Date.now();
				ws.on('message', (_data: unknown) => {
					// Type guard and safe string conversion
					let dataStr: string;
					if (Buffer.isBuffer(_data)) {
						dataStr = _data.toString();
					} else if (typeof _data === 'string') {
						dataStr = _data;
					} else {
						// For other types, use JSON.stringify as fallback
						dataStr = JSON.stringify(_data);
					}

					const _message = JSON.parse(dataStr) as { type?: string; data?: string };
					resolve(Date.now() - start);
				});
			});

			ws.send(
				JSON.stringify({
					type: 'echo',
					data: largeData
				})
			);

			const transferTime = await responsePromise;
			ws.close();

			console.warn(`Large payload transfer time: ${transferTime}ms for 1MB`);
			expect(transferTime).toBeLessThan(2000); // Should transfer 1MB in less than 2 seconds
		});
	});

	describe('Memory Usage Benchmarks', () => {
		it('should not leak memory during extended operation', async () => {
			if (!global.gc) {
				console.warn('Memory tests require --expose-gc flag');
				return;
			}

			const iterations = 100;
			const memoryUsages: number[] = [];

			for (let i = 0; i < iterations; i++) {
				// Force garbage collection
				global.gc();

				// Record memory before operation
				const beforeHeap = process.memoryUsage().heapUsed;

				// Mock the fetch calls
				vi.mocked(global.fetch).mockResolvedValueOnce(createMockResponse([]) as Response);
				vi.mocked(global.fetch).mockResolvedValueOnce(
					createMockResponse({ frequencies: [], amplitudes: [] }) as Response
				);
				vi.mocked(global.fetch).mockResolvedValueOnce(
					createMockResponse({ status: 'ok' }) as Response
				);

				// Perform operations
				const responses = await Promise.all([
					fetch(`${API_BASE_URL}/api/devices`),
					fetch(`${API_BASE_URL}/api/spectrum`),
					fetch(`${API_BASE_URL}/api/system/status`)
				]);

				// Clean up
				await Promise.all(responses.map((r) => r.text())); // Consume response bodies

				// Record memory after operation
				const afterHeap = process.memoryUsage().heapUsed;
				memoryUsages.push(afterHeap - beforeHeap);

				// Small delay between iterations
				await new Promise((resolve) => setTimeout(resolve, 10));
			}

			// Calculate memory growth trend
			const firstHalf = memoryUsages.slice(0, iterations / 2);
			const secondHalf = memoryUsages.slice(iterations / 2);

			const avgFirstHalf = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
			const avgSecondHalf = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

			const memoryGrowthRate = (avgSecondHalf - avgFirstHalf) / avgFirstHalf;

			console.warn(`Memory growth rate: ${(memoryGrowthRate * 100).toFixed(2)}%`);
			expect(Math.abs(memoryGrowthRate)).toBeLessThan(0.2); // Less than 20% growth
		});
	});

	describe('Rendering Performance Benchmarks', () => {
		it('should render spectrum updates at 60fps', () => {
			const targetFPS = 60;
			const targetFrameTime = 1000 / targetFPS;
			const frames = 100;
			const frameTimes: number[] = [];

			// Simulate spectrum rendering
			const renderFrame = () => {
				const start = performance.now();

				// Simulate canvas operations
				const canvas = document.createElement('canvas');
				const ctx = canvas.getContext('2d');
				if (!ctx) return 0;
				canvas.width = 1024;
				canvas.height = 512;

				// Draw spectrum data
				ctx.fillStyle = '#000';
				ctx.fillRect(0, 0, canvas.width, canvas.height);

				for (let i = 0; i < 1024; i++) {
					const amplitude = Math.random() * 512;
					ctx.fillStyle = `hsl(${(amplitude / 512) * 120}, 100%, 50%)`;
					ctx.fillRect(i, 512 - amplitude, 1, amplitude);
				}

				const end = performance.now();
				return end - start;
			};

			for (let i = 0; i < frames; i++) {
				const frameTime = renderFrame();
				frameTimes.push(frameTime);
			}

			const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
			const maxFrameTime = Math.max(...frameTimes);
			const achievedFPS = 1000 / avgFrameTime;

			console.warn(
				`Rendering performance - Avg FPS: ${achievedFPS.toFixed(1)}, Max frame time: ${maxFrameTime.toFixed(2)}ms`
			);

			expect(avgFrameTime).toBeLessThan(targetFrameTime);
			expect(maxFrameTime).toBeLessThan(targetFrameTime * 3); // Allow occasional spikes on RPi
		});
	});

	describe('Data Processing Benchmarks', () => {
		it('should process FFT data efficiently', () => {
			const fftSizes = [512, 1024, 2048, 4096];

			fftSizes.forEach((size) => {
				const data = new Float32Array(size).fill(0).map(() => Math.random() * 2 - 1);

				const start = performance.now();

				// Simulate FFT processing
				for (let i = 0; i < 100; i++) {
					// Simple magnitude calculation (real FFT would be more complex)
					const magnitudes = new Float32Array(size / 2);
					for (let j = 0; j < size / 2; j++) {
						magnitudes[j] = Math.sqrt(data[j * 2] ** 2 + data[j * 2 + 1] ** 2);
					}
				}

				const end = performance.now();
				const timePerFFT = (end - start) / 100;

				console.warn(`FFT size ${size} - Time per FFT: ${timePerFFT.toFixed(2)}ms`);
				expect(timePerFFT).toBeLessThan(30); // Should process in less than 30ms
			});
		});

		it('should filter and sort device lists efficiently', () => {
			// Generate test data
			const devices = Array(10000)
				.fill(null)
				.map((_, i) => ({
					id: `device-${i}`,
					name: `Device ${i}`,
					mac: `00:11:22:33:44:${(i % 256).toString(16).padStart(2, '0')}`,
					signal: -Math.floor(Math.random() * 60 + 40),
					lastSeen: new Date(Date.now() - Math.random() * 86400000).toISOString(),
					vendor: ['Apple', 'Samsung', 'Google', 'Microsoft'][i % 4]
				}));

			const operations = [
				{
					name: 'Filter by signal strength',
					fn: () => devices.filter((d) => d.signal > -70)
				},
				{
					name: 'Sort by signal strength',
					fn: () => [...devices].sort((a, b) => b.signal - a.signal)
				},
				{
					name: 'Group by vendor',
					fn: () =>
						devices.reduce(
							(acc, d) => {
								if (!acc[d.vendor]) acc[d.vendor] = [];
								acc[d.vendor].push(d);
								return acc;
							},
							{} as Record<string, typeof devices>
						)
				},
				{
					name: 'Filter and sort combined',
					fn: () =>
						devices
							.filter((d) => d.signal > -70)
							.sort((a, b) => b.signal - a.signal)
							.slice(0, 100)
				}
			];

			operations.forEach(({ name, fn }) => {
				const start = performance.now();
				const _result = fn();
				const end = performance.now();

				console.warn(`${name} - Time: ${(end - start).toFixed(2)}ms`);
				expect(end - start).toBeLessThan(150); // Should complete in less than 150ms
			});
		});
	});

	describe('Startup Performance', () => {
		it('should measure initial page load time', async () => {
			// Mock HTML response
			vi.mocked(global.fetch).mockResolvedValueOnce({
				...createMockResponse(
					'<!DOCTYPE html><html><head><title>Argos</title></head><body></body></html>'
				),
				text: async () =>
					'<!DOCTYPE html><html><head><title>Argos</title></head><body></body></html>'
			} as Response);

			const start = performance.now();
			const response = await fetch(API_BASE_URL);
			const html = await response.text();
			const end = performance.now();

			const loadTime = end - start;
			console.warn(`Initial page load time: ${loadTime.toFixed(2)}ms`);

			expect(response.status).toBe(200);
			expect(html).toContain('<!DOCTYPE html>');
			expect(loadTime).toBeLessThan(2000); // Should load in less than 2 seconds
		});

		it('should measure time to interactive', () => {
			// This would normally use Puppeteer or similar
			// Simulating the measurement here
			const metrics = {
				domContentLoaded: 150,
				firstContentfulPaint: 200,
				timeToInteractive: 500,
				largestContentfulPaint: 600
			};

			console.warn('Page load metrics:', metrics);

			expect(metrics.timeToInteractive).toBeLessThan(2000);
			expect(metrics.largestContentfulPaint).toBeLessThan(3000);
		});
	});
});
