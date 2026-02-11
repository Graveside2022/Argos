#!/usr/bin/env node
/**
 * Streaming Inspector MCP Server
 * Provides tools for debugging Server-Sent Events (SSE) endpoints
 */

import { config } from 'dotenv';
import { BaseMCPServer, type ToolDefinition } from '../shared/base-server';
import { apiFetch } from '../shared/api-client';

// Load .env for ARGOS_API_KEY
config();

class StreamingInspector extends BaseMCPServer {
	protected tools: ToolDefinition[] = [
		{
			name: 'inspect_sse_stream',
			description:
				'Monitor a live Server-Sent Events (SSE) stream for specified duration. Captures events, validates data structure, measures throughput and latency. Use when debugging HackRF spectrum data or GSM scan streams.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					stream_url: {
						type: 'string',
						description: 'SSE endpoint to monitor',
						enum: [
							'/api/hackrf/data-stream',
							'/api/gsm-evil/intelligent-scan-stream',
							'/api/rf/data-stream'
						]
					},
					duration_seconds: {
						type: 'number',
						description: 'How long to monitor (default: 10, max: 60)'
					},
					validate_data: {
						type: 'boolean',
						description: 'Validate data structure and ranges (default: true)'
					}
				},
				required: ['stream_url']
			},
			execute: async (args: Record<string, unknown>) => {
				const streamUrl = args.stream_url as string;
				const duration = Math.min((args.duration_seconds as number) || 10, 60);
				const validateData = args.validate_data !== false;

				const apiUrl = process.env.ARGOS_API_URL || 'http://localhost:5173';
				const apiKey = process.env.ARGOS_API_KEY || '';

				if (!apiKey) {
					return {
						status: 'ERROR',
						error: 'ARGOS_API_KEY not set in environment'
					};
				}

				const fullUrl = `${apiUrl}${streamUrl}`;

				// Use dynamic import for eventsource
				const { EventSource } = await import('eventsource');

				return new Promise((resolve) => {
					const events: Array<{ type: string; data: unknown; timestamp: number }> = [];
					const errors: Array<{ message: string; timestamp: number }> = [];
					const startTime = Date.now();
					let _lastEventTime = startTime;
					let eventCount = 0;
					let byteCount = 0;

					const eventSource = new EventSource(fullUrl, {
						fetch: (input, init) =>
							fetch(input, {
								...init,
								headers: {
									...init?.headers,
									'X-API-Key': apiKey
								}
							})
					});

					// Track all event types
					const eventTypes = new Set<string>();

					// Generic message handler (catches all events)
					eventSource.onmessage = (event: { type: string; data: string }) => {
						const now = Date.now();
						eventCount++;
						byteCount += event.data.length;
						_lastEventTime = now;

						try {
							const parsed = JSON.parse(event.data);
							events.push({
								type: event.type || 'message',
								data: parsed,
								timestamp: now
							});
							eventTypes.add(event.type || 'message');
						} catch (parseError) {
							errors.push({
								message: `Failed to parse event data: ${(parseError as Error).message}`,
								timestamp: now
							});
						}
					};

					eventSource.onerror = (error: unknown) => {
						errors.push({
							message: String(error),
							timestamp: Date.now()
						});
					};

					// Listen for specific event types (HackRF stream)
					[
						'connected',
						'status',
						'sweep_data',
						'heartbeat',
						'error',
						'cycle_config'
					].forEach((eventType) => {
						eventSource.addEventListener(eventType, (event: { data: string }) => {
							const now = Date.now();
							eventCount++;
							byteCount += event.data.length;
							_lastEventTime = now;

							try {
								const parsed = JSON.parse(event.data);
								events.push({
									type: eventType,
									data: parsed,
									timestamp: now
								});
								eventTypes.add(eventType);
							} catch (parseError) {
								errors.push({
									message: `Failed to parse ${eventType}: ${(parseError as Error).message}`,
									timestamp: now
								});
							}
						});
					});

					// Monitor for specified duration
					setTimeout(() => {
						eventSource.close();

						const endTime = Date.now();
						const totalDuration = (endTime - startTime) / 1000;
						const throughputBytesPerSec = byteCount / totalDuration;
						const eventsPerSec = eventCount / totalDuration;

						// Calculate latency stats
						const latencies = [];
						for (let i = 1; i < events.length; i++) {
							latencies.push(events[i].timestamp - events[i - 1].timestamp);
						}
						const avgLatency =
							latencies.length > 0
								? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
								: 0;
						const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;

						// Validate data structure if requested
						const validationResults: Array<{ issue: string; count: number }> = [];

						if (validateData) {
							// Validate HackRF sweep_data events
							const sweepEvents = events.filter((e) => e.type === 'sweep_data');
							if (sweepEvents.length > 0) {
								const invalidFreqs = sweepEvents.filter((e) => {
									const data = e.data as { frequencies?: unknown[] };
									return !data.frequencies || data.frequencies.length === 0;
								});
								if (invalidFreqs.length > 0) {
									validationResults.push({
										issue: 'sweep_data events missing frequencies array',
										count: invalidFreqs.length
									});
								}

								const invalidPower = sweepEvents.filter((e) => {
									const data = e.data as { power?: unknown[] };
									return !data.power || data.power.length === 0;
								});
								if (invalidPower.length > 0) {
									validationResults.push({
										issue: 'sweep_data events missing power array',
										count: invalidPower.length
									});
								}

								// Check for frequency range issues
								const outOfRange = sweepEvents.filter((e) => {
									const data = e.data as {
										start_freq?: number;
										stop_freq?: number;
									};
									const { start_freq, stop_freq } = data;
									return (
										(start_freq && (start_freq < 800 || start_freq > 6000)) ||
										(stop_freq && (stop_freq < 800 || stop_freq > 6000))
									);
								});
								if (outOfRange.length > 0) {
									validationResults.push({
										issue: 'frequency out of HackRF range (800-6000 MHz)',
										count: outOfRange.length
									});
								}
							}

							// Check for dropped heartbeats (should be every 10s)
							const heartbeats = events.filter((e) => e.type === 'heartbeat');
							if (duration >= 20 && heartbeats.length < Math.floor(duration / 10)) {
								validationResults.push({
									issue: 'missing heartbeat events (expected every 10s)',
									count: Math.floor(duration / 10) - heartbeats.length
								});
							}
						}

						const recommendations = [];

						// Analyze results and generate recommendations
						if (eventCount === 0) {
							recommendations.push(
								'🔴 CRITICAL: No events received - stream may be broken'
							);
							recommendations.push(
								'💡 Check: Is the service running? Is hardware connected?'
							);
						} else if (eventsPerSec < 1 && streamUrl === '/api/hackrf/data-stream') {
							recommendations.push(
								'⚠️ LOW throughput - expected 20 events/sec for HackRF stream'
							);
							recommendations.push(
								'💡 Check: Is HackRF sweep running? Check throttle settings'
							);
						}

						if (errors.length > 0) {
							recommendations.push(`⚠️ ${errors.length} errors during monitoring`);
							recommendations.push('💡 Review error details below');
						}

						if (validationResults.length > 0) {
							recommendations.push('⚠️ Data validation issues detected');
							recommendations.push('💡 Review validation_issues below for details');
						}

						if (maxLatency > 1000) {
							recommendations.push('⚠️ HIGH latency detected (>1s between events)');
							recommendations.push('💡 Possible backpressure or network issues');
						}

						if (recommendations.length === 0) {
							recommendations.push('✅ Stream health looks good');
						}

						resolve({
							status: 'SUCCESS',
							stream_url: streamUrl,
							duration_monitored_seconds: totalDuration,
							summary: {
								total_events: eventCount,
								unique_event_types: Array.from(eventTypes),
								bytes_received: byteCount,
								errors: errors.length
							},
							performance: {
								events_per_second: parseFloat(eventsPerSec.toFixed(2)),
								throughput_bytes_per_sec: parseFloat(
									throughputBytesPerSec.toFixed(0)
								),
								avg_latency_ms: parseFloat(avgLatency.toFixed(2)),
								max_latency_ms: maxLatency
							},
							validation_issues: validationResults,
							recommendations,
							sample_events: events.slice(0, 5).map((e) => ({
								type: e.type,
								data_keys: Object.keys((e.data as object) || {}),
								timestamp: new Date(e.timestamp).toISOString()
							})),
							errors: errors.slice(0, 10)
						});
					}, duration * 1000);
				});
			}
		},
		{
			name: 'test_sse_connection',
			description:
				'Quick connectivity test for SSE endpoint. Attempts to connect, waits for first event, then disconnects. Use to verify endpoint is reachable and responding.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					stream_url: {
						type: 'string',
						description: 'SSE endpoint to test',
						enum: [
							'/api/hackrf/data-stream',
							'/api/gsm-evil/intelligent-scan-stream',
							'/api/rf/data-stream'
						]
					},
					timeout_seconds: {
						type: 'number',
						description: 'Max wait time for first event (default: 5)'
					}
				},
				required: ['stream_url']
			},
			execute: async (args: Record<string, unknown>) => {
				const streamUrl = args.stream_url as string;
				const timeout = (args.timeout_seconds as number) || 5;

				const apiUrl = process.env.ARGOS_API_URL || 'http://localhost:5173';
				const apiKey = process.env.ARGOS_API_KEY || '';

				if (!apiKey) {
					return {
						status: 'ERROR',
						error: 'ARGOS_API_KEY not set in environment'
					};
				}

				const fullUrl = `${apiUrl}${streamUrl}`;

				// Use dynamic import for eventsource
				const { EventSource } = await import('eventsource');

				return new Promise((resolve) => {
					const startTime = Date.now();
					let resolved = false;

					const eventSource = new EventSource(fullUrl, {
						fetch: (input, init) =>
							fetch(input, {
								...init,
								headers: {
									...init?.headers,
									'X-API-Key': apiKey
								}
							})
					});

					eventSource.onmessage = (event: { type: string; data: string }) => {
						if (resolved) return;
						resolved = true;
						eventSource.close();

						const latency = Date.now() - startTime;

						resolve({
							status: 'SUCCESS',
							stream_url: streamUrl,
							first_event_latency_ms: latency,
							event_type: event.type || 'message',
							event_data_size_bytes: event.data.length,
							recommendation: '✅ SSE connection successful'
						});
					};

					// Also listen for 'connected' event (HackRF stream)
					eventSource.addEventListener('connected', (event: { data: string }) => {
						if (resolved) return;
						resolved = true;
						eventSource.close();

						const latency = Date.now() - startTime;

						resolve({
							status: 'SUCCESS',
							stream_url: streamUrl,
							first_event_latency_ms: latency,
							event_type: 'connected',
							event_data_size_bytes: event.data.length,
							recommendation: '✅ SSE connection successful'
						});
					});

					eventSource.onerror = (error: unknown) => {
						if (resolved) return;
						resolved = true;
						eventSource.close();

						resolve({
							status: 'ERROR',
							stream_url: streamUrl,
							error: String(error),
							recommendation: '🔴 Connection failed - check if service is running'
						});
					};

					// Timeout after specified seconds
					setTimeout(() => {
						if (resolved) return;
						resolved = true;
						eventSource.close();

						resolve({
							status: 'TIMEOUT',
							stream_url: streamUrl,
							timeout_seconds: timeout,
							recommendation:
								'⚠️ No events received within timeout - service may be idle'
						});
					}, timeout * 1000);
				});
			}
		},
		{
			name: 'list_sse_endpoints',
			description:
				'List all available SSE streaming endpoints in Argos with descriptions. Use to discover what streams are available for monitoring.',
			inputSchema: {
				type: 'object' as const,
				properties: {}
			},
			execute: async () => {
				const resp = await apiFetch('/api/streaming/status');
				const data = await resp.json();

				if (!data.success) {
					return {
						status: 'ERROR',
						error: data.error
					};
				}

				// Add descriptions and usage notes
				const endpoints = [
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
						use_cases: [
							'Monitor GSM tower scanning',
							'Debug IMSI detection',
							'Track scan progress'
						]
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
				];

				return {
					status: 'SUCCESS',
					total_endpoints: endpoints.length,
					endpoints,
					recommendations: [
						'💡 Use test_sse_connection for quick connectivity checks',
						'💡 Use inspect_sse_stream for detailed performance analysis',
						'💡 HackRF stream should maintain ~20 events/sec when sweep is active'
					]
				};
			}
		}
	];
}

// Start server when run directly
const server = new StreamingInspector('argos-streaming-inspector');
server.start().catch((error) => {
	console.error('[Streaming Inspector] Fatal:', error);
	process.exit(1);
});
