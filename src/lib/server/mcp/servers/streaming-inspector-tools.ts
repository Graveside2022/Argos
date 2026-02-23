/**
 * Streaming Inspector MCP Server — SSE monitoring and validation helpers.
 * Extracted from streaming-inspector.ts for constitutional compliance (Article 2.2).
 */

interface CapturedEvent {
	type: string;
	data: unknown;
	timestamp: number;
}

interface ValidationIssue {
	issue: string;
	count: number;
}

/** Check if a frequency is outside HackRF range (800-6000 MHz). */
function isFreqOutOfRange(freq: number | undefined): boolean {
	return !!freq && (freq < 800 || freq > 6000);
}

/**
 * Validate HackRF sweep_data events for required fields and frequency ranges.
 */
export function validateSweepData(events: CapturedEvent[]): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const sweepEvents = events.filter((e) => e.type === 'sweep_data');

	if (sweepEvents.length === 0) return issues;

	const invalidFreqs = sweepEvents.filter((e) => {
		const data = e.data as { frequencies?: unknown[] };
		return !data.frequencies || data.frequencies.length === 0;
	});
	if (invalidFreqs.length > 0) {
		issues.push({
			issue: 'sweep_data events missing frequencies array',
			count: invalidFreqs.length
		});
	}

	const invalidPower = sweepEvents.filter((e) => {
		const data = e.data as { power?: unknown[] };
		return !data.power || data.power.length === 0;
	});
	if (invalidPower.length > 0) {
		issues.push({
			issue: 'sweep_data events missing power array',
			count: invalidPower.length
		});
	}

	const outOfRange = sweepEvents.filter((e) => {
		const data = e.data as { start_freq?: number; stop_freq?: number };
		return isFreqOutOfRange(data.start_freq) || isFreqOutOfRange(data.stop_freq);
	});
	if (outOfRange.length > 0) {
		issues.push({
			issue: 'frequency out of HackRF range (800-6000 MHz)',
			count: outOfRange.length
		});
	}

	return issues;
}

/**
 * Check for missing heartbeat events over the monitoring duration.
 */
export function validateHeartbeats(
	events: CapturedEvent[],
	durationSeconds: number
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const heartbeats = events.filter((e) => e.type === 'heartbeat');

	if (durationSeconds >= 20 && heartbeats.length < Math.floor(durationSeconds / 10)) {
		issues.push({
			issue: 'missing heartbeat events (expected every 10s)',
			count: Math.floor(durationSeconds / 10) - heartbeats.length
		});
	}

	return issues;
}

/**
 * Generate recommendations from stream monitoring results.
 */
interface StreamMetrics {
	eventCount: number;
	eventsPerSec: number;
	streamUrl: string;
	errorCount: number;
	validationIssueCount: number;
	maxLatency: number;
}

/** Check for throughput issues. */
function checkThroughput(m: StreamMetrics): string[] {
	if (m.eventCount === 0)
		return [
			'CRITICAL: No events received - stream may be broken',
			'Check: Is the service running? Is hardware connected?'
		];
	if (m.eventsPerSec < 1 && m.streamUrl === '/api/hackrf/data-stream')
		return [
			'LOW throughput - expected 20 events/sec for HackRF stream',
			'Check: Is HackRF sweep running? Check throttle settings'
		];
	return [];
}

/** Declarative recommendation rules. */
const STREAM_RULES: Array<(m: StreamMetrics) => string[]> = [
	checkThroughput,
	(m) =>
		m.errorCount > 0
			? [`${m.errorCount} errors during monitoring`, 'Review error details below']
			: [],
	(m) =>
		m.validationIssueCount > 0
			? ['Data validation issues detected', 'Review validation_issues below for details']
			: [],
	(m) =>
		m.maxLatency > 1000
			? [
					'HIGH latency detected (>1s between events)',
					'Possible backpressure or network issues'
				]
			: []
];

export function generateStreamRecommendations(
	eventCount: number,
	eventsPerSec: number,
	streamUrl: string,
	errorCount: number,
	validationIssueCount: number,
	maxLatency: number
): string[] {
	const metrics: StreamMetrics = {
		eventCount,
		eventsPerSec,
		streamUrl,
		errorCount,
		validationIssueCount,
		maxLatency
	};
	const results = STREAM_RULES.flatMap((rule) => rule(metrics));
	return results.length > 0 ? results : ['Stream health looks good'];
}

/**
 * Calculate latency statistics from captured events.
 */
export function calculateLatencyStats(events: CapturedEvent[]): {
	avgLatency: number;
	maxLatency: number;
} {
	const latencies: number[] = [];
	for (let i = 1; i < events.length; i++) {
		latencies.push(events[i].timestamp - events[i - 1].timestamp);
	}

	return {
		avgLatency:
			latencies.length > 0 ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length : 0,
		maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0
	};
}

/** Known SSE event types to listen for on HackRF streams. */
export const HACKRF_EVENT_TYPES = [
	'connected',
	'status',
	'sweep_data',
	'heartbeat',
	'error',
	'cycle_config'
] as const;

/** Available SSE streaming endpoint definitions. */
export const SSE_ENDPOINTS = [
	{
		name: 'HackRF Data Stream',
		url: '/api/hackrf/data-stream',
		type: 'continuous',
		description: 'Real-time RF spectrum data from HackRF sweep',
		event_types: ['connected', 'sweep_data', 'status', 'heartbeat', 'error'],
		expected_rate: '20 events/sec (throttled)',
		use_cases: [
			'Monitor live spectrum scanning',
			'Debug FFT data issues',
			'Verify sweep configuration'
		]
	},
	{
		name: 'GSM Intelligent Scan Stream',
		url: '/api/gsm-evil/intelligent-scan-stream',
		type: 'one-shot',
		description: 'Progressive updates during GSM frequency band scan',
		event_types: ['message', 'result'],
		expected_rate: 'Variable (scan progress)',
		use_cases: ['Monitor GSM tower scanning', 'Debug IMSI detection', 'Track scan progress']
	},
	{
		name: 'RF Data Stream',
		url: '/api/rf/data-stream',
		type: 'continuous',
		description: 'Generic RF data stream (multiple hardware support)',
		event_types: ['data', 'status'],
		expected_rate: 'Variable',
		use_cases: ['Multi-device RF monitoring', 'Hardware-agnostic streaming']
	}
] as const;
