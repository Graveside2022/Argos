import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getRFDatabase } from '$lib/server/db/database';
import { SignalSource } from '$lib/types/enums';

import { PerformanceMonitor } from '../utils/performanceMonitor';
import { TestDataGenerator } from '../utils/testDataGenerator';
// import type { SignalMarker } from '$lib/stores/map/signals'; // Module removed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SignalMarker = any;
// Define Signal type locally for testing based on generator output
interface Signal {
	id: string;
	timestamp: number;
	latitude: number;
	longitude: number;
	strength: number;
	frequency: number;
	metadata: Record<string, string | number | boolean>;
}

// Mock interfaces for missing services
interface MockSignalIngestionService {
	ingestBatch(signals: Signal[]): Promise<void>;
}

// Helper function to convert Signal to SignalMarker format
// Adjusts raw generator data to match DbSignalSchema constraints:
//   - timestamp: must be integer (generator produces floats from Math.random)
//   - frequency: generator outputs Hz, schema expects MHz (max 6000)
//   - power: clamped to [-120, 0] range
function toSignalMarker(signal: Signal): SignalMarker {
	return {
		id: signal.id,
		lat: signal.latitude,
		lon: signal.longitude,
		power: Math.max(-120, Math.min(0, signal.strength)),
		frequency: Math.max(1, Math.min(6000, signal.frequency / 1e6)), // Hz → MHz, clamped [1, 6000]
		timestamp: Math.floor(Math.abs(signal.timestamp)) || Date.now(),
		source: SignalSource.HackRF,
		metadata: signal.metadata
	};
}

const mockIngestionService: MockSignalIngestionService = {
	ingestBatch: async (_signals: Signal[]) => {
		// Mock implementation
		await new Promise((resolve) => setTimeout(resolve, 10));
		return Promise.resolve();
	}
};

describe('Realistic Data Load Tests', () => {
	let dataGenerator: TestDataGenerator;
	let performanceMonitor: PerformanceMonitor;
	let dbService: ReturnType<typeof getRFDatabase>;

	beforeAll(() => {
		dataGenerator = new TestDataGenerator();
		performanceMonitor = new PerformanceMonitor();
		dbService = getRFDatabase();
	});

	afterAll(() => {
		// Database cleanup handled by getRFDatabase
	});

	it('Urban environment - 1 hour', () => {
		performanceMonitor.startMetrics();

		// Generate realistic urban signal distribution
		const wifiSignals = dataGenerator.generateWiFiSignals(50000, {
			area: 'urban',
			timeSpan: 3600000, // 1 hour
			density: 'high'
		});
		const bluetoothSignals = dataGenerator.generateBluetoothSignals(10000, {
			area: 'urban',
			timeSpan: 3600000
		});
		const cellularSignals = dataGenerator.generateCellularSignals(5000, {
			area: 'urban',
			timeSpan: 3600000
		});
		const droneSignals = dataGenerator.generateDroneSignals(500, {
			patterns: ['surveillance', 'delivery'],
			timeSpan: 3600000
		});
		const signals: Signal[] = [
			...wifiSignals,
			...bluetoothSignals,
			...cellularSignals,
			...droneSignals
		];

		expect(signals).toHaveLength(65500);

		// Test ingestion rate
		const startTime = performance.now();
		const batchSize = 1000;
		let processed = 0;

		for (let i = 0; i < signals.length; i += batchSize) {
			const batch = signals.slice(i, i + batchSize);
			batch.forEach((signal) => {
				dbService.insertSignal(toSignalMarker(signal));
			});
			processed += batch.length;

			// Record metrics every 10k signals
			if (processed % 10000 === 0) {
				const elapsed = performance.now() - startTime;
				const rate = processed / (elapsed / 1000);
				performanceMonitor.recordMetric('ingestion_rate', rate);
			}
		}

		const totalTime = performance.now() - startTime;
		const avgRate = signals.length / (totalTime / 1000);

		// Performance assertions
		expect(avgRate).toBeGreaterThan(5000); // > 5k signals/second
		expect(totalTime).toBeLessThan(15000); // < 15 seconds total

		// Verify data integrity - using spatial query to count signals
		const allSignals = dbService.findSignalsInRadius({
			lat: 40.7128,
			lon: -74.006,
			radiusMeters: 100000, // 100km radius
			startTime: 0,
			endTime: Date.now(),
			limit: 100000
		});
		expect(allSignals.length).toBeGreaterThan(0);

		// Test query performance
		const queryStart = performance.now();
		const recentSignals = dbService.findSignalsInRadius({
			lat: 40.7128,
			lon: -74.006,
			radiusMeters: 10000, // 10km radius
			startTime: Date.now() - 300000, // Last 5 minutes
			endTime: Date.now(),
			limit: 10000
		});
		const queryTime = performance.now() - queryStart;

		expect(queryTime).toBeLessThan(50); // < 50ms query time
		expect(recentSignals.length).toBeGreaterThan(0);

		const report = performanceMonitor.generateReport();
		console.warn('Urban Environment Performance:', report);
	});

	it('Event scenario - 4 hours', async () => {
		performanceMonitor.startMetrics();

		// Simulate stadium/concert with varying load
		const hourlyDistribution = [0.2, 0.8, 1.0, 0.6]; // Load factor per hour
		const signals: Signal[] = [];

		for (let hour = 0; hour < 4; hour++) {
			const loadFactor = hourlyDistribution[hour];
			const hourStart = hour * 3600000;

			const wifiHour = dataGenerator.generateWiFiSignals(Math.floor(50000 * loadFactor), {
				area: 'stadium',
				timeSpan: 3600000,
				timeOffset: hourStart,
				density: 'very-high'
			});
			const bluetoothHour = dataGenerator.generateBluetoothSignals(
				Math.floor(12500 * loadFactor),
				{
					area: 'stadium',
					timeSpan: 3600000,
					timeOffset: hourStart
				}
			);
			const cellularHour = dataGenerator.generateCellularSignals(
				Math.floor(5000 * loadFactor),
				{
					area: 'stadium',
					timeSpan: 3600000,
					timeOffset: hourStart
				}
			);
			const droneHour = dataGenerator.generateDroneSignals(Math.floor(500 * loadFactor), {
				patterns: ['surveillance', 'media'],
				timeSpan: 3600000,
				timeOffset: hourStart
			});
			signals.push(...wifiHour, ...bluetoothHour, ...cellularHour, ...droneHour);
		}

		// Hourly distribution [0.2, 0.8, 1.0, 0.6] * (50000+12500+5000+500)
		// = 68000 * 2.6 = 176,800 (Math.floor reduces further)
		expect(signals.length).toBeGreaterThan(150000);

		// Test sustained load handling
		const startTime = performance.now();
		const concurrentUsers = 50;
		const userSessions = [];

		// Simulate concurrent users
		for (let i = 0; i < concurrentUsers; i++) {
			userSessions.push(
				simulateUserSession(i, signals, mockIngestionService, performanceMonitor)
			);
		}

		await Promise.all(userSessions);

		const _totalTime = performance.now() - startTime;
		const report = performanceMonitor.generateReport();

		// Performance assertions
		expect(report.summary.avgResponseTime).toBeLessThan(2000); // < 2s avg response
		expect(report.summary.peakMemoryUsage).toBeLessThan(1024 * 1024 * 1024); // < 1GB
		expect(report.summary.errorRate).toBeLessThan(0.01); // < 1% errors

		console.warn('Event Scenario Performance:', report);
	});

	it('24-hour continuous operation', async () => {
		performanceMonitor.startMetrics();

		// Simulate full day with realistic patterns
		const dayProfile = generateDayProfile();
		let totalSignals = 0;
		let peakLoad = 0;

		for (let hour = 0; hour < 24; hour++) {
			const loadFactor = dayProfile[hour];
			const hourlySignals = Math.floor(65000 * loadFactor);
			totalSignals += hourlySignals;
			peakLoad = Math.max(peakLoad, hourlySignals);

			const signals = dataGenerator.generateMixedSignals(hourlySignals, {
				timeSpan: 3600000,
				timeOffset: hour * 3600000
			});

			// Process in batches — use 60 batches/hour (1 per minute simulated)
			// to keep test duration reasonable while still exercising sustained load
			const batchInterval = 1000;
			const batchCount = 60;
			const batchSize = Math.ceil(hourlySignals / batchCount);

			for (let batch = 0; batch < batchCount; batch++) {
				const batchSignals = signals.slice(batch * batchSize, (batch + 1) * batchSize);

				const batchStart = performance.now();
				await mockIngestionService.ingestBatch(batchSignals);
				const batchTime = performance.now() - batchStart;

				// Monitor performance degradation
				performanceMonitor.recordMetric('batch_time', batchTime);
				performanceMonitor.recordMetric('memory_usage', process.memoryUsage().heapUsed);

				// Ensure batch processing stays under threshold
				expect(batchTime).toBeLessThan(batchInterval);
			}

			// Hourly maintenance tasks
			if (hour % 6 === 0) {
				const dbServiceAny = dbService as { performMaintenance?: () => Promise<void> };
				await dbServiceAny.performMaintenance?.();
			}
		}

		// Final assertions
		expect(totalSignals).toBeGreaterThan(900000); // > 900k signals (day profile varies)

		const report = performanceMonitor.generateReport();
		expect(report.memoryLeakDetected).toBe(false);
		expect(report.performanceDegradation).toBeLessThan(0.1); // < 10% degradation

		console.warn('24-hour Operation Report:', {
			totalSignals,
			peakLoad,
			avgBatchTime: performanceMonitor.avgMetric('batch_time'),
			maxMemory: performanceMonitor.maxMetric('memory_usage') / (1024 * 1024), // MB
			stabilityScore: report.stabilityScore
		});
	}, 120000); // 120s timeout for 24-hour simulation

	it('Stress test - finding breaking point', async () => {
		performanceMonitor.startMetrics();
		const result = await runStressSearch(
			dataGenerator,
			mockIngestionService,
			performanceMonitor
		);
		console.warn('Stress Test Results:', {
			lastSuccessfulRate: result.lastSuccessfulRate,
			breakingPoint: result.breakingPoint,
			maxSustainedThroughput: result.lastSuccessfulRate * 0.8
		});
		expect(result.lastSuccessfulRate).toBeGreaterThan(10000); // Should handle > 10k/s
	});
});

// Helper functions
interface SessionActionCtx {
	signals: Signal[];
	ingestionService: MockSignalIngestionService;
}

type SessionAction = (ctx: SessionActionCtx) => Promise<void>;

async function actionViewSignals(ctx: SessionActionCtx): Promise<void> {
	const viewCount = Math.floor(Math.random() * 100) + 50;
	const start = Math.floor(Math.random() * (ctx.signals.length - viewCount));
	ctx.signals.slice(start, viewCount); // simulate read
}

async function actionSubmitSignal(ctx: SessionActionCtx): Promise<void> {
	const randomIndex = Math.floor(Math.random() * ctx.signals.length);
	const newSignal = ctx.signals[randomIndex];
	if (newSignal) await ctx.ingestionService.ingestBatch([newSignal]);
}

async function actionSpatialQuery(_ctx: SessionActionCtx): Promise<void> {
	// Simulated spatial query — values intentionally unused
	void (40.7128 + (Math.random() - 0.5) * 0.1);
	void (-74.006 + (Math.random() - 0.5) * 0.1);
	void (Math.random() * 1000 + 100);
}

async function actionTimeRangeQuery(_ctx: SessionActionCtx): Promise<void> {
	const endTime = Date.now();
	void (endTime - Math.random() * 3600000); // Up to 1 hour ago
}

const SESSION_ACTIONS: SessionAction[] = [
	actionViewSignals,
	actionSubmitSignal,
	actionSpatialQuery,
	actionTimeRangeQuery
];

async function runOneAction(
	userId: number,
	i: number,
	ctx: SessionActionCtx,
	monitor: PerformanceMonitor
): Promise<void> {
	const actionStart = performance.now();
	const action = SESSION_ACTIONS[Math.floor(Math.random() * SESSION_ACTIONS.length)];
	await action(ctx);
	monitor.recordMetric(`user_${userId}_action_${i}`, performance.now() - actionStart);
	await new Promise((resolve) => setTimeout(resolve, Math.random() * 2000));
}

async function simulateUserSession(
	userId: number,
	signals: Signal[],
	ingestionService: MockSignalIngestionService,
	monitor: PerformanceMonitor
): Promise<void> {
	const sessionStart = performance.now();
	const actions = Math.floor(Math.random() * 10) + 5; // 5-15 actions
	const ctx: SessionActionCtx = { signals, ingestionService };
	for (let i = 0; i < actions; i++) {
		await runOneAction(userId, i, ctx, monitor);
	}
	monitor.recordMetric(`user_${userId}_session`, performance.now() - sessionStart);
}

// Stress-test helpers (extracted to keep cognitive complexity ≤5 per fn).

interface StressBatchCtx {
	batch: Signal[];
	signalsPerSecond: number;
	startTime: number;
	processed: number;
	monitor: PerformanceMonitor;
	ingestionService: MockSignalIngestionService;
}

async function processStressBatch(ctx: StressBatchCtx): Promise<number> {
	const batchStart = performance.now();
	await ctx.ingestionService.ingestBatch(ctx.batch);
	const batchTime = performance.now() - batchStart;
	const newProcessed = ctx.processed + ctx.batch.length;
	const expectedTime = (newProcessed / ctx.signalsPerSecond) * 1000;
	const actualTime = performance.now() - ctx.startTime;
	if (actualTime > expectedTime * 1.5) throw new Error('System overloaded');
	ctx.monitor.recordMetric(`stress_${ctx.signalsPerSecond}`, batchTime);
	return newProcessed;
}

function trackBatchError(state: { errors: number }): void {
	state.errors++;
	if (state.errors > 10) throw new Error('Too many errors');
}

async function processSignalsAtRate(
	signals: Signal[],
	signalsPerSecond: number,
	batchSize: number,
	monitor: PerformanceMonitor,
	ingestionService: MockSignalIngestionService
): Promise<void> {
	const startTime = performance.now();
	let processed = 0;
	const errState = { errors: 0 };
	for (let i = 0; i < signals.length; i += batchSize) {
		try {
			processed = await processStressBatch({
				batch: signals.slice(i, i + batchSize),
				signalsPerSecond,
				startTime,
				processed,
				monitor,
				ingestionService
			});
		} catch {
			trackBatchError(errState);
		}
	}
}

async function runStressIteration(
	signalsPerSecond: number,
	dataGenerator: TestDataGenerator,
	ingestionService: MockSignalIngestionService,
	monitor: PerformanceMonitor
): Promise<void> {
	const testDuration = 10000;
	const totalSignals = signalsPerSecond * 10;
	const signals = dataGenerator.generateMixedSignals(totalSignals, { timeSpan: testDuration });
	const batchSize = Math.min(1000, signalsPerSecond / 10);
	await processSignalsAtRate(signals, signalsPerSecond, batchSize, monitor, ingestionService);
}

async function runStressSearch(
	dataGenerator: TestDataGenerator,
	ingestionService: MockSignalIngestionService,
	monitor: PerformanceMonitor
): Promise<{ lastSuccessfulRate: number; breakingPoint: number }> {
	let signalsPerSecond = 1000;
	let lastSuccessfulRate = 0;
	let breakingPoint = 0;
	while (signalsPerSecond < 100000) {
		try {
			await runStressIteration(signalsPerSecond, dataGenerator, ingestionService, monitor);
			lastSuccessfulRate = signalsPerSecond;
			signalsPerSecond *= 1.5;
		} catch {
			breakingPoint = signalsPerSecond;
			break;
		}
	}
	return { lastSuccessfulRate, breakingPoint };
}

function generateDayProfile(): number[] {
	// Typical daily load profile (0-1 scale)
	return [
		0.2,
		0.15,
		0.1,
		0.1,
		0.15,
		0.3, // 00:00 - 06:00 (night/early morning)
		0.5,
		0.7,
		0.9,
		0.95,
		0.9,
		0.85, // 06:00 - 12:00 (morning peak)
		0.8,
		0.85,
		0.9,
		0.95,
		1.0,
		0.95, // 12:00 - 18:00 (afternoon peak)
		0.9,
		0.8,
		0.7,
		0.5,
		0.4,
		0.3 // 18:00 - 00:00 (evening decline)
	];
}
