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
		const { start_freq, stop_freq } = data;
		return (
			(start_freq && (start_freq < 800 || start_freq > 6000)) ||
			(stop_freq && (stop_freq < 800 || stop_freq > 6000))
		);
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
export function generateStreamRecommendations(
	eventCount: number,
	eventsPerSec: number,
	streamUrl: string,
	errorCount: number,
	validationIssueCount: number,
	maxLatency: number
): string[] {
	const recommendations: string[] = [];

	if (eventCount === 0) {
		recommendations.push('CRITICAL: No events received - stream may be broken');
		recommendations.push('Check: Is the service running? Is hardware connected?');
	} else if (eventsPerSec < 1 && streamUrl === '/api/hackrf/data-stream') {
		recommendations.push('LOW throughput - expected 20 events/sec for HackRF stream');
		recommendations.push('Check: Is HackRF sweep running? Check throttle settings');
	}

	if (errorCount > 0) {
		recommendations.push(`${errorCount} errors during monitoring`);
		recommendations.push('Review error details below');
	}

	if (validationIssueCount > 0) {
		recommendations.push('Data validation issues detected');
		recommendations.push('Review validation_issues below for details');
	}

	if (maxLatency > 1000) {
		recommendations.push('HIGH latency detected (>1s between events)');
		recommendations.push('Possible backpressure or network issues');
	}

	if (recommendations.length === 0) {
		recommendations.push('Stream health looks good');
	}

	return recommendations;
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
