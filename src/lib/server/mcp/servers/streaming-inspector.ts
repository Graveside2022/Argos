#!/usr/bin/env node
/**
 * Streaming Inspector MCP Server
 * Provides tools for debugging Server-Sent Events (SSE) endpoints
 */

import { config } from 'dotenv';

import { logger } from '$lib/utils/logger';

import { apiFetch } from '../shared/api-client';
import { BaseMCPServer, type ToolDefinition } from '../shared/base-server';
import {
	calculateLatencyStats,
	generateStreamRecommendations,
	HACKRF_EVENT_TYPES,
	SSE_ENDPOINTS,
	validateHeartbeats,
	validateSweepData
} from './streaming-inspector-tools';

// Load .env for ARGOS_API_KEY
config();

class StreamingInspector extends BaseMCPServer {
	protected tools: ToolDefinition[] = [
		{
			name: 'inspect_sse_stream',
			description:
				'Monitor a live SSE stream for specified duration. Captures events, validates data, measures throughput. Use when debugging HackRF spectrum data or GSM scan streams.',
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
						description: 'Validate data structure (default: true)'
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
					return { status: 'ERROR', error: 'ARGOS_API_KEY not set in environment' };
				}

				const fullUrl = `${apiUrl}${streamUrl}`;
				const { EventSource } = await import('eventsource');

				return new Promise((resolve) => {
					const events: Array<{ type: string; data: unknown; timestamp: number }> = [];
					const errors: Array<{ message: string; timestamp: number }> = [];
					const startTime = Date.now();
					let eventCount = 0;
					let byteCount = 0;
					const eventTypes = new Set<string>();

					const eventSource = new EventSource(fullUrl, {
						fetch: (input, init) =>
							fetch(input, {
								...init,
								headers: { ...init?.headers, 'X-API-Key': apiKey }
							})
					});

					const handleEvent = (type: string, data: string) => {
						const now = Date.now();
						eventCount++;
						byteCount += data.length;
						try {
							events.push({ type, data: JSON.parse(data), timestamp: now });
							eventTypes.add(type);
						} catch (parseError) {
							errors.push({
								message: `Failed to parse ${type}: ${(parseError as Error).message}`,
								timestamp: now
							});
						}
					};

					eventSource.onmessage = (event: { type: string; data: string }) => {
						handleEvent(event.type || 'message', event.data);
					};

					eventSource.onerror = (error: unknown) => {
						errors.push({ message: String(error), timestamp: Date.now() });
					};

					for (const eventType of HACKRF_EVENT_TYPES) {
						eventSource.addEventListener(eventType, (event: { data: string }) => {
							handleEvent(eventType, event.data);
						});
					}

					setTimeout(() => {
						eventSource.close();
						const endTime = Date.now();
						const totalDuration = (endTime - startTime) / 1000;
						const eventsPerSec = eventCount / totalDuration;

						const { avgLatency, maxLatency } = calculateLatencyStats(events);

						const validationIssues = validateData
							? [
									...validateSweepData(events),
									...validateHeartbeats(events, duration)
								]
							: [];

						const recommendations = generateStreamRecommendations(
							eventCount,
							eventsPerSec,
							streamUrl,
							errors.length,
							validationIssues.length,
							maxLatency
						);

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
									(byteCount / totalDuration).toFixed(0)
								),
								avg_latency_ms: parseFloat(avgLatency.toFixed(2)),
								max_latency_ms: maxLatency
							},
							validation_issues: validationIssues,
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
				'Quick connectivity test for SSE endpoint. Connects, waits for first event, then disconnects.',
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
						description: 'Max wait for first event (default: 5)'
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
					return { status: 'ERROR', error: 'ARGOS_API_KEY not set in environment' };
				}

				const fullUrl = `${apiUrl}${streamUrl}`;
				const { EventSource } = await import('eventsource');

				return new Promise((resolve) => {
					const startTime = Date.now();
					let resolved = false;

					const eventSource = new EventSource(fullUrl, {
						fetch: (input, init) =>
							fetch(input, {
								...init,
								headers: { ...init?.headers, 'X-API-Key': apiKey }
							})
					});

					const onFirstEvent = (type: string, dataSize: number) => {
						if (resolved) return;
						resolved = true;
						eventSource.close();
						resolve({
							status: 'SUCCESS',
							stream_url: streamUrl,
							first_event_latency_ms: Date.now() - startTime,
							event_type: type,
							event_data_size_bytes: dataSize,
							recommendation: 'SSE connection successful'
						});
					};

					eventSource.onmessage = (event: { type: string; data: string }) => {
						onFirstEvent(event.type || 'message', event.data.length);
					};

					eventSource.addEventListener('connected', (event: { data: string }) => {
						onFirstEvent('connected', event.data.length);
					});

					eventSource.onerror = (error: unknown) => {
						if (resolved) return;
						resolved = true;
						eventSource.close();
						resolve({
							status: 'ERROR',
							stream_url: streamUrl,
							error: String(error),
							recommendation: 'Connection failed - check if service is running'
						});
					};

					setTimeout(() => {
						if (resolved) return;
						resolved = true;
						eventSource.close();
						resolve({
							status: 'TIMEOUT',
							stream_url: streamUrl,
							timeout_seconds: timeout,
							recommendation:
								'No events received within timeout - service may be idle'
						});
					}, timeout * 1000);
				});
			}
		},
		{
			name: 'list_sse_endpoints',
			description: 'List all available SSE streaming endpoints in Argos.',
			inputSchema: { type: 'object' as const, properties: {} },
			execute: async () => {
				const resp = await apiFetch('/api/streaming/status');
				const data = await resp.json();

				if (!data.success) {
					return { status: 'ERROR', error: data.error };
				}

				return {
					status: 'SUCCESS',
					total_endpoints: SSE_ENDPOINTS.length,
					endpoints: SSE_ENDPOINTS,
					recommendations: [
						'Use test_sse_connection for quick connectivity checks',
						'Use inspect_sse_stream for detailed performance analysis',
						'HackRF stream should maintain ~20 events/sec when sweep is active'
					]
				};
			}
		}
	];
}

// Start server when run directly
const server = new StreamingInspector('argos-streaming-inspector');
server.start().catch((error) => {
	logger.error('Streaming Inspector fatal error', {
		error: error instanceof Error ? error.message : String(error)
	});
	process.exit(1);
});
